# Bitcoin Quest kill switch runbook

Last updated: 12 November 2026, 5:36 AM ET.

This is the operator guide for the admin-shield kill switch. Nothing in this document is sent automatically. The user email and X post below are drafts for Phil to approve; do not send them until he says so.

## What it does

The kill switch takes Bitcoin Quest offline for everyone except admins.

1. An admin opens **Admin tools → Kill switch**. The confirm screen checks that backups exist (latest managed Firestore export under about 26 hours old, point-in-time recovery on, and the newest R2 object when that can be checked). A stale or missing backup is a **warning**, not a block. An emergency shutdown must never wait on a backup check.
2. The admin types a reason, types **OFFLINE**, and enters a fresh authenticator code. The factor must be at least 24 hours old and on the server-recorded known-factor list (#302). The callable also requires the admin claim, App Check, and a recent sign-in.
3. The public flag (`config/killSwitch`) flips first. That doc holds only `enabled`, `mode`, `message`, `since`, and `autoReenableAt`. Reason, who flipped it, and the snapshot path live on `config/killSwitchAdmin` (admins only). Clients show a calm maintenance page. Payout, reward, ticket, XP and write callables return “temporarily offline.” Scheduled payout jobs skip that run. **All** non-admin client writes are denied in Firestore rules (forum, chat, DMs, notifications, reports, marketplace, beats, profiles, and the rest). Admins can still open Admin tools and turn the switch off. Each write evaluation does one extra `get()` of `config/killSwitch` (cached for the request).
4. After the flag is on, the function starts a managed Firestore export in the background to `gs://<project>-backups/kill-switch/<timestamp>/` (or `gs://$BQ_BACKUP_BUCKET/kill-switch/<timestamp>/` when that env var is set). The small manifest records who flipped it, why, the export operation name, and the output URI prefix. The manifest is written as soon as the export is accepted; the function does **not** wait for the export to finish. If a snapshot was already started in the last 6 hours, that one is reused instead of starting another full export. A failed snapshot **never** turns the app back on or delays the shutdown. The export operation id is also written to the append-only `kill_switch_audit` log and shown in the admin UI (not on the public flag).
5. Every admin is notified (in-app + the admin notifications collection, with the actor uid masked). Phil also gets a Telegram DM when that path is configured. Alerts fire on every state write (flip, reason change, or auto-return change) and once when the auto-return actually fires (`killSwitchAutoReturnTick`, every 5 minutes). A no-op write (for example OFF while already off) does not alert and does not use the rate budget. Flips that change state are rate-limited (8 per admin per hour, 20 global per hour). Status/preflight is limited separately (30 per admin per hour). Audit rows are never deleted.
6. Sending **ON** while the switch is already on is refused unless the auto-return moves **later** (a later deadline, or dropping the deadline). That extension still alerts every admin and DMs Phil. A reason-only change, a shorten, or a re-arm with no later deadline is rejected.

Turning it off is the same flow, typing **ONLINE** and a reason. No new snapshot is started on the way back.

Angle brackets are stripped from the reason so it cannot carry markup into notices.

## Backup IAM (fn-admin-kill-switch)

Phil (or someone with `resourcemanager.projects.setIamPolicy` and bucket IAM) must create the custom role and bind it. `rufus2-deploy` cannot create service accounts or custom roles. The setup script is `functions/scripts/runtime-sa-plan.js` (batch “admin kill switch”).

The runtime SA must **not** be able to import over live data or delete nightlies.

```bash
P=bitcoin-education-archive
SA=fn-admin-kill-switch@$P.iam.gserviceaccount.com
BUCKET=bitcoin-education-archive-backups

# Custom role: export + operations.get only. No import.
gcloud iam roles describe killSwitchExport --project "$P" >/dev/null 2>&1 \
  || gcloud iam roles create killSwitchExport --project "$P" \
      --title "Kill switch Firestore export" \
      --description "Start a managed Firestore export and poll the operation. Cannot import." \
      --permissions datastore.databases.export,datastore.operations.get
gcloud iam roles update killSwitchExport --project "$P" \
  --permissions datastore.databases.export,datastore.operations.get
gcloud projects add-iam-policy-binding "$P" \
  --member "serviceAccount:$SA" \
  --role "projects/$P/roles/killSwitchExport" \
  --condition=None

# List/read nightlies for the preflight check. Viewer cannot delete.
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member "serviceAccount:$SA" \
  --role roles/storage.objectViewer

# Create objects only under kill-switch/. No delete, and no writes elsewhere.
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member "serviceAccount:$SA" \
  --role roles/storage.objectCreator \
  --condition='expression=resource.name.startsWith("projects/_/buckets/'"$BUCKET"'/objects/kill-switch/"),title=kill-switch-prefix-only,description=Create objects only under kill-switch/; no delete'

# listUsers so notifyAdmins can page Auth. Viewer, not admin.
gcloud projects add-iam-policy-binding "$P" \
  --member "serviceAccount:$SA" \
  --role roles/firebaseauth.viewer \
  --condition=None
```

Repeat for staging (`bitcoin-quest-staging`, bucket `bitcoin-quest-staging-backups-use1` in us-east1, matching staging Firestore). The default-named `bitcoin-quest-staging-backups` bucket is in us-central1 and cannot receive managed exports from that database. Point the staging function at the us-east1 bucket with `BQ_BACKUP_BUCKET`; do not set that env var on live, which already uses the compatible US multi-region `bitcoin-education-archive-backups`.

The function only lists/reads existing export metadata and **creates** objects under a unique `kill-switch/<timestamp>/` prefix (manifest `save` uses `ifGenerationMatch: 0` so it will not overwrite). It never deletes or overwrites backup objects. Do **not** grant `roles/storage.objectAdmin` or `roles/datastore.importExportAdmin`.

### Retention, versioning, and lifecycle (recommended)

- Turn on object versioning on `gs://bitcoin-education-archive-backups` so a mistaken overwrite of a nightly can be recovered.
- Prefer a retention policy or bucket lock on the daily `YYYY-MM-DD/` exports if Legal agrees (this is a policy change; Phil must approve).
- Add a lifecycle config so `kill-switch/` snapshots do not grow forever, and so noncurrent versions (after versioning is turned on) do not pile up. **`gcloud storage buckets update --lifecycle-file` replaces the bucket's entire lifecycle setup.** A file that only has the `kill-switch/` rule would wipe the existing 90-day delete rule on the nightly `YYYY-MM-DD/` exports. The file in the repo already includes every current rule plus the new ones. Re-read the live config before applying, and do not apply this until Phil says so.

The complete file is `docs/kill-switch-lifecycle.json`. It keeps the existing 90-day delete for all objects, adds a 90-day delete scoped to `kill-switch/` (Phil can pick a longer window), and deletes noncurrent versions after 30 days (`daysSinceNoncurrentTime: 30`) once versioning is on.

```bash
# Read the live rules first. If they have changed, edit the file so it still
# includes every existing rule, then apply.
gcloud storage buckets describe gs://bitcoin-education-archive-backups --format='json(lifecycle_config)'

gcloud storage buckets update gs://bitcoin-education-archive-backups --versioning
gcloud storage buckets update gs://bitcoin-education-archive-backups --lifecycle-file=docs/kill-switch-lifecycle.json
```

Do not apply a short lifecycle only to the daily `YYYY-MM-DD/` prefixes, and do not apply a file that omits the existing 90-day rule.

## How to fix issues while the app is offline

The live app being off does not stop you from working. Use staging, then deploy named fixes. Do not deploy-all. Do not write anything to live except the named fix Phil has approved.

### 1. Reproduce on staging (about 15–60 minutes)

- Use `bitcoin-quest-staging` only. Never point tools at the live project for a repro.
- Staging has its own kill-switch flag. Leave staging online unless you are specifically testing the switch there, and turn it off again when you are done.
- Reproduce the bug with a staging test account. Capture the function logs and a note of the exact callable or page.

### 2. Deploy a named fix only (about 5–15 minutes per function)

- Ship one function (or a short, named list) after review:

      firebase deploy --project bitcoin-education-archive --only functions:functionName

- When first shipping `adminSetKillSwitch` and `killSwitchAutoReturnTick` to live (and after any rollback-and-redeploy of those functions), set `PHIL_TELEGRAM_CHAT_ID` on both. The functions read that env var to DM Phil. If it is missing, flips still succeed but the Telegram DM is skipped and the log says `PHIL_TELEGRAM_CHAT_ID is missing`. Do not put a live `BQ_BACKUP_BUCKET` in a committed `.env`; live keeps the default `bitcoin-education-archive-backups` bucket.

- For a client fix, deploy hosting / Pages only after Phil’s OK, and only the files that changed. The service worker placeholder on this PR is `btc-archive-v2551` and must be renumbered at ship.
- Do not deploy the kill switch itself a second time unless that is the fix. Do not `firebase deploy` without `--only`.
- Rules changes (`firestore:rules`) need their own named deploy and a second review, because they affect writes immediately.

### 3. Point-in-time recovery (PITR), last resort (about 30–90+ minutes)

- Live Firestore PITR keeps a 7-day window. This can roll the database back to a minute before the incident.
- PITR restore **overwrites** the current database. Only Phil can approve this. Do it only if the snapshot and the daily export are not enough, and after you have a current export to fall back to.
- Prefer restoring into a new database or a staging copy first, then copy selected data, rather than restoring over live.
- The kill-switch snapshot folder (`gs://bitcoin-education-archive-backups/kill-switch/<timestamp>/`) is an export of exactly what the database looked like just after the shutdown. Importing it is also a last-resort, Phil-approved operation. Import does not happen automatically. The kill-switch runtime SA **cannot** import.

## Break-glass (rate limit or a compromised admin)

If the 8/20-per-hour write budget is exhausted, or a compromised admin is flipping the switch, do this in order:

1. **Revoke the admin claim first** on the compromised account(s). Do not leave them able to open Admin tools.
2. Write the flag from the Firebase console or from an Admin SDK session that is **not** the kill-switch SA (Phil’s user, or `rufus2-deploy` used only for this write). Set `config/killSwitch` to `{enabled: false, mode: "offline", message: null, since: null, autoReenableAt: null}` and update `config/killSwitchAdmin` with a reason such as “break-glass: rate limit / compromised admin”. Console / Admin SDK writes bypass the callable rate limit.
3. Add an audit note (a new `kill_switch_audit` row, or a written log) of who did the break-glass and why.
4. Rotate or disable the compromised admin’s factors and sessions.

## Catch-up after missed weekly / monthly payouts

`resetWeeklyXP` and `resetMonthlyXP` (and the prize jobs `payWeeklyQuestLB` / `payMonthlyQuestLB`) **skip** while the switch is on. They do **not** backfill a missed period on the next cron.

`lbPrizes.settleXp` is idempotent per `periodKey` via `lb_prize_markers`. After bringing the app back:

1. Check `lb_prize_markers` / `leaderboard_winners` for the missed `periodKey`.
2. If that period was not paid, run a one-off of the named job with the missed period’s `now` (Monday 05:00 UTC for weekly, 1st 00:00 UTC for monthly). A later cron will settle a **different** period.
3. Only do this with Phil’s OK.


## Catch-up after an outage longer than 24 hours

2nd-gen trigger retries stop after 24 hours. After a longer outage, do not assume the deferred events will arrive. With Phil's OK, review and catch up these paths (they are idempotent where noted):

1. **Tickets:** forum post (`forum_post_ticket`), marketplace listing (`marketplace_listing_ticket`), IRL listing (`irl_listing_ticket`), and daily chat (`daily_chat_ticket`). Grant only for content that still exists and would have qualified.
2. **Push badge:** `onPushDeviceWritten` / `pushEnabled` for users who wrote a device token during the outage and do not yet have the badge.
3. **Article XP:** `onArticlePublishXp` for articles published (or first published) during the window whose XP was not written.
4. **Badge bonuses:** `onBadgeAwardCreated` collection bonuses and GG queue rows for awards created during the window that never settled.
5. **PvP settlement:** `onPvpMatchFinished` / `settlePvpMatch` for matches that became finished or forfeit during the window and have no `pvp_rewards` / `rewardsGranted` row.
6. **Daily proofs:** `reconcileDailyProofs` only processes the previous offset day. The next 05:15 UTC run will not backfill older days. For each missed day, run a one-off with that day's key.

## Triggers that defer or skip

- **Defer** (throw, `retry: true`, redelivered after the switch is off): `onArticlePublishXp`, `onBadgeAwardCreated`, `onPvpMatchFinished` (includes `settlePvpMatch` XP/badges), `onForumPost` (forum-post ticket), `onMarketplaceListingCount` (listing ticket + marketListings badge), `onMarketplaceMessageCount` (marketMessages badge), `onIrlEventCreated` (IRL listing ticket), `onChatMessageCreated` (daily chat ticket + raid credit), `onPushDeviceWritten` (pushEnabled badge). These are 2nd-gen Firestore triggers (`firebase-functions/v2/firestore`). Their retry window is **24 hours**, not 7 days. If an outage lasts longer than 24 hours, redelivery stops and those events need a manual catch-up (see below). On redelivery, `onForumPost` and `onMarketplaceListingCount` re-read the live doc and skip if it was deleted or removed.
- **Skip** (return, no grant; new client content is already blocked by rules): `flushBadgeGgBursts` (queue stays), `onUserReferral` (the hourly `payQualifiedReferrals` scan will catch pending rows after return), activity badge counters (`onChatBadgeCount`, `onDmBadgeCount`, `onForumPostBadgeCount`, `onForumReplyBadgeCount`, `onBeatsUploadBadgeCount`, `onArticleBadgeCount`), `onMarketplaceSaleCount` (marketSold badge; a later server write can grant after return). Admin-authored content during an outage will not increment those counters.
- **Callables / HTTP (in addition to the payout and reward wraps):** `managePeer` is a client callable and is wrapped with the other reward gates (accept grants peerCount badges and peer-accept XP). `decryptCipher` is also wrapped: a successful solve can grant XP, tickets, sats, and badges. `stravaAuth` is a public HTTP handler and cannot use `gateExport`; it returns early when the switch is on, *before* the one-time OAuth nonce is consumed, so the user can retry later.
- **Ungated on purpose** (the coverage test asserts this exact list; nothing that grants XP, sats, badges, or tickets belongs here):
  - `onUserDocCreated`: assigns plebNumber / join date and bumps userCount (no signup bonus).
  - `onUserQuestCompleted`: bumps a global counter only (the gradeQuest callable is already gated).
  - `satoshiFavorAutoReset`: expires an already-running boost and posts a heads-up; it does not grant favor or XP.
  - `syncPublicProfile`: public mirror, not a grant.

## Bringing the app back (checklist)

Do this in order. Typical time: 1–2 seconds for the flip, 5–15 minutes for the checks around it.

1. Confirm the incident is contained (or that you are only taking a maintenance window down). Note the time in Eastern Time.
2. Open **Admin tools → Kill switch**. Read the current snapshot status (STARTED / SUCCESS / START_FAILED / reused). A failed snapshot is not a reason to stay offline, but write down the operation id from the audit log (or the admin-only doc).
3. Sign in again if prompted, so your sign-in is recent. Enter a fresh authenticator code. Type a reason and **ONLINE**.
4. Confirm the maintenance page is gone for a signed-out window and for a test user. Confirm you can open the home screen, sign in, and that a harmless read works.
5. Confirm a payout path is no longer paused: one staging or tiny live check that Phil has approved (for example a staging claim, not a real user payout, unless he asks). Scheduled payouts that were **skipped** while the switch was on were not paid and were not taken from the reserve. If a weekly or monthly cron was due during the outage, follow the catch-up section above. Do not assume the next cron will backfill a missed window.
6. Confirm the audit log has the OFF row (who, when, why) and that admins got the “back online” alert (or the auto-return alert, if it came back on its own).
7. If you used a client or function fix, confirm its version is what you intended (SW / cache buster, function revision).
8. If user-facing downtime needs a public note, use the drafts below, only after Phil approves and only send what he approves.

## Realistic timings

| Step | Typical time |
| --- | --- |
| Confirm screen + backup check | 2–5 seconds |
| Flip on or off | 1–2 seconds |
| Maintenance page visible to open clients | a few seconds (Firestore listener); new visits are immediate once the client bundle with `kill-switch.js` is loaded |
| Snapshot request accepted (or reused if one started in the last 6 hours) | 1–3 seconds after the flip |
| Snapshot finished | 5–20 minutes, depending on database size |
| Admin alert delivery | usually under a minute |
| Auto-return tick | up to 5 minutes after the deadline |
| Staging repro | 15–60 minutes |
| Named function deploy | 5–15 minutes |
| PITR or export import (if approved) | 30–90+ minutes |
| Full “we’re back” checklist | 5–15 minutes after the flip off |

## Drafts for Phil to approve (do not send automatically)

Nothing is emailed or posted by the kill switch. If the outage is user-visible and Phil wants a public note, use or edit these.

### User email (draft)

Subject: Bitcoin Quest is temporarily offline

Hello,

Bitcoin Quest is temporarily offline for maintenance. Your sats, progress, and account are safe.

We will write again when the app is back. Thank you for your patience.

— The Bitcoin Quest team

### X post (draft)

Bitcoin Quest is temporarily offline for maintenance. Your sats and progress are safe. We’ll post again when we’re back.

## Contacts and project names

- Live project: `bitcoin-education-archive`
- Staging project: `bitcoin-quest-staging`
- Backup bucket (live): `gs://bitcoin-education-archive-backups`
- Kill-switch snapshots: `gs://bitcoin-education-archive-backups/kill-switch/<timestamp>/`
- Daily exports: `gs://bitcoin-education-archive-backups/<YYYY-MM-DD>/`
- R2 copy: GitHub Action `r2-nightly-backup` (not checkable from the function itself)
- Runtime SA: `fn-admin-kill-switch@bitcoin-education-archive.iam.gserviceaccount.com` (needs `roles/firebaseauth.viewer` so it can list admin uids)
- Live Telegram DM: set `PHIL_TELEGRAM_CHAT_ID` on `adminSetKillSwitch` and `killSwitchAutoReturnTick`
- Custom role: `projects/bitcoin-education-archive/roles/killSwitchExport` (`datastore.databases.export`, `datastore.operations.get` only)
- Audit collection: `kill_switch_audit` (append-only)
- Public flag: `config/killSwitch`
- Admin-only details: `config/killSwitchAdmin`
