# Citadel shop: notes (branch feat/citadel-shop-1119)

Not meant to ship as-is. Client and server prep, committed locally only.
Rufus decides whether this file and the branch stay in the repo.

**NEVER DEPLOYED to live:** `getCitadelShopStatus`, `buyCitadelStage`,
`buildCitadelPart`, `claimLessonParts` are exported from `functions/index.js`.
Staging only: deployed by name to `bitcoin-quest-staging` on Nov 19, 2026 at
8:58 AM ET (all four v1) for the preview. Live deploy is by name only, after
review, Red Team GO, Security sign-off and Phil's OK, because `buyCitadelStage`
debits OrangeTix. The `firestore.rules` additions are undeployed everywhere
(staging and live); the preview works without them, but they must ship with
or before the live functions so clients cannot write `users/{uid}.citadel`.

Review fixes (Rufus, Nov 19): `claimLessonParts` is also closed before the open
date (status reports no pending grant while closed); a requestId replay only
returns a row whose stored uid matches the caller; `buyCitadelStage`,
`buildCitadelPart` and `claimLessonParts` are on the kill-switch `GATED.rewards`
list as well as self-checking `isOffline` (fail closed); the client reads
`open` from status and shows "Opens Jan 3, 2027" instead of Buy/Build.
`openEarly` is honored only when the runtime project id is exactly
`bitcoin-quest-staging`.

Files: `citadel-shop.js` (new, lazy-loaded by the Citadel tab in `quests.js`),
`tests/test-citadel-shop.js`; server `functions/src/citadelShop.js` (logic),
`functions/src/citadelShopFns.js` (wiring), `tests/test-citadel-shop-server.js`. SW cache `btc-archive-v2616`; `quests.js` pin
`20261119_v2616` in `index.html` and `404.html` (identical).

## Rules the UI follows (server is the authority for all of them)

- The shop is its own section (Quest Hub, Citadel tab). Everyone can see it.
- Only Premium (`users/{uid}.premium.active === true`) can buy stages or build.
  Non-Premium players see locked "Premium only" buttons and one Get Premium
  button that opens the existing Premium buy screen (`window.bqOpenPremium()`
  from #322, falling back to `/?premium=buy`).
- The 5 lesson parts are earned by free and Premium players and kept. They show
  as "Owned, earned from lessons". Building with them is Premium-only.
- Purchases are capped at 120 OrangeTix a week. The UI shows "N / 120 used this
  week" and "N OrangeTix left", and disables Buy when a stage costs more than
  what is left.
- Footer keeps the exact line: "Paying never changes who wins a battle."
- Referral-week Premium buying is behind `config/citadelShop.referralWeekPremiumBuy`,
  default `false`. Live stays off. Staging can set it to `true`. The client does
  not read the doc; the server sends it back as `flags` in `getCitadelShopStatus`.

## Callables (implemented in functions/src/citadelShop.js)

| Name | Input | Output |
|---|---|---|
| `getCitadelShopStatus` | `{}` | `{ success, premiumActive, open, buildOpen, flags: { referralWeekPremiumBuy }, stages: {walls,...} (built), ownedStages: {walls,...} (collected), parts: { walls: { owned, built, total }, ... }, lessonParts: {lesson_walls: true, ...}, lessonBuilt: {...}, lessonGrantPending, weekSpent, weekCap, weekResetsAt, newTickets }` |
| `buyCitadelStage` | `{ partId, stage, requestId }` | `{ success, partId, stage, price, ownedStages, stages, weekSpent, weekCap, newTickets, repeat? }` or `{ success: false, code, message }` |
| `buildCitadelPart` | `{ lessonPartId, requestId }` or `{ partId, stage, requestId }` | `{ success, lessonPartId, lessonBuilt, repeat? }` or `{ success, partId, stage, stages, ownedStages, repeat? }` or `{ success: false, code, message }` |
| `claimLessonParts` | `{}` | `{ success, granted: [lessonPartId], lessonParts }` |

`requestId` is a client random id for idempotency. Error `code` values the UI
can map: `unauthenticated`, `guest`, `kill_switch`, `not_open`, `bad_request`,
`not_premium`, `trial`, `flag_off`, `account_age`, `no_profile`, `already_owned`,
`wrong_stage`, `weekly_cap`, `balance`, `not_owned`, `already_built`. Each comes
with a plain `message`. `repeat: true` means a retried `requestId` got its first
result back with no second debit.

## Server checks (all implemented; see the server section below)

- **Premium active:** `premium_entitlements/{uid}` read in the transaction,
  judged by #322's `isPremiumActive` (local copy of the same rules until #322
  is in this build). Never the client's `users.premium` mirror.
- **Weekly 120 OT cap:** `citadel_weekly/{uid}_{weekKey}` (week = Monday 12:00 AM
  ET) in one transaction with the OrangeTix debit. Reject if
  `spent + price > 120`. Hard cap, no partial stages.
- **Balance:** debit `orangeTickets` in the same transaction; reject below price.
- **Collect now, build later (Phil, Nov 18):** from Jan 3 players collect parts;
  building stays locked. Buying puts the stage in `citadel.ownedStages` (it does
  not build it). `stage` must equal `ownedStages[partId] + 1` and not exceed the
  part's stage count. `buildCitadelPart` builds the next collected paid stage
  (`stage == stages[partId] + 1 <= ownedStages[partId]`) or an owned, unbuilt
  lesson part, only when `config/citadelShop.buildOpen === true` (missing or any
  other value = closed, on staging and live; `openEarly` never opens building;
  error `not_build_open`, "Building opens later."). A later build timer attaches
  to `buildCitadelPart`. Older docs with `stages` and no `ownedStages` count
  built stages as collected.
- **Prices:** server catalog only (draft: Walls 4x75, Lightning Turret 2x100,
  Vault 2x120, Node Tower 3x100, Keep 4x115 = 1,500). Ignore any client price.
- **Referral flag:** only honor referral-week Premium buying when
  `config/citadelShop.referralWeekPremiumBuy === true` (staging). Default off.
  The server reads `config/citadelShop`; clients do not (rules unchanged, the
  `config` match only exposes `killSwitch`).
- **Account age:** reject buys while `created` is newer than the minimum (TODO toggle).
- **Signed-in, non-guest:** reject anonymous sessions.
- **Idempotency:** `citadel_purchases/{uid}_{requestId}` is created in the same
  transaction; a retry returns the stored result and does not debit again.
- **Kill switch:** reject when the app off switch is on, like other spends.
- **No speed-ups:** parts, timers and cooldowns must never read Premium or Embers
  (#322 hard rule). Premium only unlocks the ability to buy and build.

## Lesson parts grant (`claimLessonParts`)

- Idempotent and once per uid: each `lessonParts.<id>` is set at most once
  (transaction; already-true entries are skipped and not re-announced). Safe to
  retry. The client only calls it when `getCitadelShopStatus` returns
  `lessonGrantPending: true`, for signed-in non-guest accounts. Alternatively the
  server can run the grant inside `getCitadelShopStatus` and never set the flag.
- Grants to free and Premium players alike. Parts are kept forever.
- Proof of completion: `users/{uid}.lqPassed` (array of `lq_*` ids). It is
  server-only in `firestore.rules` and filled by the one-time `lq_lesson` claim
  (`functions/src/progressBadges.js`, `grantBadge.js`). Do not use
  `users/{uid}.lqProgress`; the client writes it (`learning-quests.js`).
- Grant rule: for each row below, if `lqPassed` contains `lesson` and
  `citadel.lessonParts.<id>` is not already true, set it true. Players who passed
  before launch get their parts on first grant (back-fill by the same rule).
- `getCitadelShopStatus` sets `lessonGrantPending: true` when any mapped lesson is
  in `lqPassed` but its part is not yet granted.

### Lesson to part mapping

Decided by team for now (Phil, Nov 19, 8:25 AM ET: "you guys decide this for
now"); change freely. Source of truth on the client is
`CONFIG.LESSON_PART_MAP` in `citadel-shop.js`; the server must use the same ids.

| Lesson part id | Part | Part name | Lesson id (`lqPassed`) | lqProgress slug | Lesson title |
|---|---|---|---|---|---|
| `lesson_walls` | Walls | Genesis Stone | `lq_what_is_bitcoin` | `what-is-bitcoin` | What is Bitcoin? |
| `lesson_keep` | Keep | Proof-of-Work Keystone | `lq_mining` | `mining` | Mining & Proof of Work |
| `lesson_tower` | Node Tower | Node Beacon | `lq_nodes` | `nodes` | Nodes & Decentralization |
| `lesson_vault` | Vault | Vault Key | `lq_self_custody` | `self-custody` | Self-Custody & Your Keys |
| `lesson_turret` | Lightning Turret | Lightning Coil | `lq_lightning` | `lightning` | The Lightning Network |

These are the first five of the eight Learning Quests in `LQ_TOPICS` order (the
order players see them). Scarcity, Why Bitcoin and Privacy grant nothing here.

## Firestore fields the UI reads

- `users/{uid}.premium.active`, `users/{uid}.premium.lapsedAt`
- `users/{uid}.orangeTickets`
- `users/{uid}.created`
- `users/{uid}.citadel.ownedStages.{walls|turret|vault|tower|keep}` (collected, numbers)
- `users/{uid}.citadel.stages.{walls|turret|vault|tower|keep}` (built, numbers, <= ownedStages)
- `users/{uid}.citadel.lessonParts.{lesson_*}` (true when earned)
- `users/{uid}.citadel.lessonBuilt.{lesson_*}` (true when built)
- `weekSpent`, `weekCap` come from `getCitadelShopStatus` (kept in
  `citadel_weekly`, not on the user doc)
- `config/citadelShop.referralWeekPremiumBuy` (server-side only, returned in `flags`)

`citadel` is in `userProfileServerOnlyKeys()` in `firestore.rules`, so clients
cannot write it. `citadel_weekly` and `citadel_purchases` deny all client reads
and writes; the UI needs none.

## TODO(phil) toggles (`CONFIG` in citadel-shop.js)

| Constant | Default | Question |
|---|---|---|
| `PROGRESS_LABEL_MODE` | `'stages'` ("7 / 15 stages", spec) | Stage vs part labels |
| `LAPSED_PARTS_MODE` | `'keep_paused'` (kept, buying paused) | Parts after Premium lapses |
| `PRE_JAN3_OT_SPENDABLE` | `true` (Rewards recommendation) | Pre-Jan 3 OrangeTix spendable on parts |
| `MIN_ACCOUNT_AGE_DAYS` | `7` (spec question) | Minimum account age to buy |
| `COSMETICS_TAB` | `false` (Nook only, spec) | Cosmetics tab here vs Nook |

`PRE_JAN3_OT_SPENDABLE` has no client effect yet; the server decides the
spendable balance.

## Differences from the mockups

- Buy is disabled when a stage costs more than what is left of the 120 weekly
  cap. The state-5 mock shows Buy on Node Tower (100) with 75 left.
- Added a "Lesson parts" section (not in the mock) for the lesson-parts add-on,
  with a non-orange "Get Premium" text link so Get Premium stays the only orange CTA.
- The Quest Hub tab bar, nav and sidebar are the app's existing ones, not the mock's.
- The mock footer is split into two lines; the battle line is its own line.
- The "Citadel is coming soon" entry in `features.registry.js` is unchanged.

## Speed budget (Speed/Responsiveness)

Measured on this branch (gzip -9):

| Item | Raw | Gzip |
|---|---|---|
| `citadel-shop.js` (new, lazy) | 26,796 B | 8,326 B, about 8.1 KB (budget 30 KB) |
| `quests.js` change (Citadel loader + skeleton) | +535 B | +192 B |
| `index.html` / `404.html` | 0 B (pin text only, same length) | 0 B |

1. **Own lazy file:** met. `citadel-shop.js` is not in `index.html`, `404.html`,
   the bundle, `build.sh` or the SW precache. The Citadel tab loads it on its
   first open. `quests.js` (itself lazy) grows by 192 B gzip for the loader, so
   the first app load is 0 KB heavier.
2. **30 KB compressed:** met, about 8.1 KB gzip. Tested.
3. **Placeholder within 100 ms:** the tab draws a skeleton synchronously in
   `_renderCitadelTab` before the script is requested, and the shop's first paint
   is synchronous from the saved user doc before any server call. Not timed in
   a real browser on a slow phone; needs a check on staging.
4. **Art:** no raster art exists yet. The shop uses inline Lucide SVG icons
   (inside the 8.1 KB), so nothing loads before the tab opens. When part art
   arrives it must be WebP with width and height set, 15 KB or less each,
   150 KB or less above the fold, `loading="lazy"` below the fold. Not built.
5. **No layout jumps:** skeleton blocks match the shop sections; the progress
   bar is a fixed 12 px track; progress panel, part cards and inventory have
   min-heights. There is no live seat count on this screen (the Founders seat
   count lives in the #322 buy screen), so none is reserved here. Not measured
   with CLS in a browser.
6. **Premium status:** first paint reads `currentUser.premium.active` (saved
   copy); `getCitadelShopStatus.premiumActive` confirms and wins. Payment code is
   not loaded by the shop. Get Premium calls `window.bqOpenPremium()` if present,
   else navigates to `/?premium=buy`. Note: on #322 `premium-buy.js` may already
   be loaded app-wide; making that lazy is #322 work, not this branch.
7. **One read, no listeners left:** one `getCitadelShopStatus` call per open
   (plus `claimLessonParts` only when a grant is pending). No `onSnapshot`, no
   direct Firestore read, no intervals. The click listener sits on a wrapper the
   hub replaces when the tab changes, and late replies are dropped. Tested with
   a fake DOM.

## Server side (functions/src/citadelShop.js)

Admin SDK only, `functionsV1.https.onCall`, no secrets and no service account
(same as `spendTickets`). No App Check, matching `spendTickets`.

Gates, in order, for buy and build: signed in; not a guest
(`guestGate.isGuestCaller`, anonymous with no real provider); second-factor hold
(`secondFactor.requireSecondFactor`, as `spendTickets`); kill switch
(`killSwitch.isOffline`, fails closed); valid ids and `requestId`; open (Jan 3,
2027 12:00 AM ET, or `config/citadelShop.openEarly` on staging only); then in
ONE transaction: requestId replay, profile exists, Premium active, not a trial
(buy), referral-week flag (buy), account age from Auth `creationTime` (buy;
unknown age fails closed), stage order, weekly cap, balance, then debit +
stage + weekly counter + purchase row.

`claimLessonParts`: signed in, not a guest, kill switch, then one transaction
that sets `citadel.lessonParts.<id>` for each mapped lesson in server-only
`lqPassed` that is not already granted. Free and Premium alike; no OrangeTix.
`getCitadelShopStatus`: read-only, no kill-switch block.

### Retention (User Data draft)

- `citadel_weekly/{uid}_{weekKey}`: `expireAt` = week end (next Monday 12:00 AM
  ET) + 14 days. No TTL policy was created; that is a separate ops step.
- `citadel_purchases/{uid}_{requestId}`: kept 13 months; each row has
  `retainUntilMs` = created + 13 months and `expireAt` (a Timestamp) equal to
  the same time, for a Firestore TTL policy. No TTL policy is created in this
  PR; that is a separate ops step for Phil's card, next to the
  `citadel_weekly.expireAt` policy. Fields: uid, kind, part or lesson part id,
  stage, price, weekKey, createdAtMs, retainUntilMs, expireAt, result. No
  email, IP or wallet fields (tested).
- `deleteAccount` deletes the user's `citadel_weekly` and `citadel_purchases`
  rows (uid field query plus `uid_` document-id prefix, in batches). It should
  be on the shop's live deploy list.
- Logs use masked uids (`ab…yz`, same shape as `payoutAlerts.maskUid`).
- `config/citadelShop.firstWindowEndMs` is unset by default, so the first week
  is the ordinary Monday week (Jan 3, 2027 is a Sunday, so that week ends
  Jan 4). Setting it to a later ms (for example Jan 11, 2027 12:00 AM ET)
  stretches the first window; that choice is Phil's.

### Server TODO(phil) constants (citadelShop.js)

| Constant | Default | Question |
|---|---|---|
| `MIN_ACCOUNT_AGE_DAYS` | `7` | Minimum account age to buy |
| `TRIAL_CAN_BUY` | `false` (Rewards rec, same as Embers) | Can a Premium trial buy parts |
| `PRE_JAN3_OT_SPENDABLE` | `true` (not enforced) | false would need an earn-date ledger that does not exist |

### Not done here

- Not deployed to live; no TTL policy was created (ops step for Phil's card).
  `expireAt` is written on both `citadel_weekly` and `citadel_purchases`.
- `claimLessonParts` now uses the same 7-day account-age check as buy, and
  buy, build and claimLessons refuse `rewardBlocked` / banned accounts (ledger
  and profile flags). Ban checks for buy and build run inside the transaction.
- All four shop callables set `enforceAppCheck: true`, same as claimSats, with
  no staging bypass. Staging already has App Check for those other callables.
- The four names are in `APP_CHECK_CALLABLES` in ranking.js so the client waits
  for a token. Cache pins: `citadel-shop.js`, `quests.js` and `ranking.js` at
  `20261119_v2617`. SW stays `btc-archive-v2616` (it does not precache them).
- The client defaults `shopOpen` to false when the server's open state is
  unknown or missing.
- Jan 3 first-week length is unchanged pending Phil. Use
  `config/citadelShop.firstWindowEndMs` to stretch it.
- Lesson completion (`lqPassed`) is still minted client-side before the quiz
  (Red Team F3 / Spam/Abuse M). Server-verified lesson passes are a follow-up.
- #322's `premium.js` is not on this base. The wiring uses it when present and
  otherwise a local copy of its `summarize` rules on `premium_entitlements`.
- Rules emulator suites were not run (a Java process holds the emulator ports).
