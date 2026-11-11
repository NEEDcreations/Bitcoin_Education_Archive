# Bitcoin Quest kill switch runbook

Last updated: 11 November 2026, 6:15 PM ET.

This is the operator guide for the admin-shield kill switch. Nothing in this document is sent automatically. The user email and X post below are drafts for Phil to approve; do not send them until he says so.

## What it does

The kill switch takes Bitcoin Quest offline for everyone except admins.

1. An admin opens **Admin tools → Kill switch**. The confirm screen checks that backups exist (latest managed Firestore export under about 26 hours old, point-in-time recovery on, and the newest R2 object when that can be checked). A stale or missing backup is a **warning**, not a block. An emergency shutdown must never wait on a backup check.
2. The admin types a reason, types **OFFLINE**, and enters a fresh authenticator code. The factor must be at least 24 hours old. The callable also requires the admin claim, App Check, and a recent sign-in.
3. The flag (`config/killSwitch`) flips first. Clients show a calm maintenance page. Payout, reward, and write callables return “temporarily offline.” Scheduled payout jobs skip that run. Non-admin client writes are denied in Firestore rules for the user profile and a few other cheap paths. Admins can still open Admin tools and turn the switch off.
4. After the flag is on, the function starts a managed Firestore export in the background to `gs://<project>-backups/kill-switch/<timestamp>/`, with a small manifest of who flipped it and why. A failed snapshot **never** turns the app back on or delays the shutdown. The export operation id is written to the append-only `kill_switch_audit` log and shown in the admin UI.
5. Every admin is notified (in-app + the admin notifications collection). Phil also gets a Telegram DM when that path is configured. Flips are rate-limited (8 per admin per hour, 20 global per hour). Audit rows are never deleted.

Turning it off is the same flow, typing **ONLINE** and a reason. No new snapshot is started on the way back.

## How to fix issues while the app is offline

The live app being off does not stop you from working. Use staging, then deploy named fixes. Do not deploy-all. Do not write anything to live except the named fix Phil has approved.

### 1. Reproduce on staging (about 15–60 minutes)

- Use `bitcoin-quest-staging` only. Never point tools at the live project for a repro.
- Staging has its own kill-switch flag. Leave staging online unless you are specifically testing the switch there, and turn it off again when you are done.
- Reproduce the bug with a staging test account. Capture the function logs and a note of the exact callable or page.

### 2. Deploy a named fix only (about 5–15 minutes per function)

- Ship one function (or a short, named list) after review:

      firebase deploy --project bitcoin-education-archive --only functions:functionName

- For a client fix, deploy hosting / Pages only after Phil’s OK, and only the files that changed. The service worker placeholder on this PR is `btc-archive-v2551` and must be renumbered at ship.
- Do not deploy the kill switch itself a second time unless that is the fix. Do not `firebase deploy` without `--only`.
- Rules changes (`firestore:rules`) need their own named deploy and a second review, because they affect writes immediately.

### 3. Point-in-time recovery (PITR), last resort (about 30–90+ minutes)

- Live Firestore PITR keeps a 7-day window. This can roll the database back to a minute before the incident.
- PITR restore **overwrites** the current database. Only Phil can approve this. Do it only if the snapshot and the daily export are not enough, and after you have a current export to fall back to.
- Prefer restoring into a new database or a staging copy first, then copy selected data, rather than restoring over live.
- The kill-switch snapshot folder (`gs://bitcoin-education-archive-backups/kill-switch/<timestamp>/`) is an export of exactly what the database looked like just after the shutdown. Importing it is also a last-resort, Phil-approved operation. Import does not happen automatically.

## Bringing the app back (checklist)

Do this in order. Typical time: 1–2 seconds for the flip, 5–15 minutes for the checks around it.

1. Confirm the incident is contained (or that you are only taking a maintenance window down). Note the time in Eastern Time.
2. Open **Admin tools → Kill switch**. Read the current snapshot status (STARTED / SUCCESS / START_FAILED). A failed snapshot is not a reason to stay offline, but write down the operation id from the audit log.
3. Sign in again if prompted, so your sign-in is recent. Enter a fresh authenticator code. Type a reason and **ONLINE**.
4. Confirm the maintenance page is gone for a signed-out window and for a test user. Confirm you can open the home screen, sign in, and that a harmless read works.
5. Confirm a payout path is no longer paused: one staging or tiny live check that Phil has approved (for example a staging claim, not a real user payout, unless he asks). Scheduled payouts that were **skipped** while the switch was on were not paid and were not taken from the reserve. If a weekly or monthly cron was due during the outage, pay that period manually or run the named job once Phil agrees. Do not assume the next cron will backfill a missed window.
6. Confirm the audit log has the OFF row (who, when, why) and that admins got the “back online” alert.
7. If you used a client or function fix, confirm its version is what you intended (SW / cache buster, function revision).
8. If user-facing downtime needs a public note, use the drafts below, only after Phil approves and only send what he approves.

## Realistic timings

| Step | Typical time |
| --- | --- |
| Confirm screen + backup check | 2–5 seconds |
| Flip on or off | 1–2 seconds |
| Maintenance page visible to open clients | a few seconds (Firestore listener); new visits are immediate once the client bundle with `kill-switch.js` is loaded |
| Snapshot request accepted | 1–3 seconds after the flip |
| Snapshot finished | 5–20 minutes, depending on database size |
| Admin alert delivery | usually under a minute |
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
- Audit collection: `kill_switch_audit` (append-only)
- Flag: `config/killSwitch`
