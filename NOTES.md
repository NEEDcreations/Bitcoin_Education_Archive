# Citadel shop: client notes (branch feat/citadel-shop-1119)

Not meant to ship as-is. This is client-only prep with stubbed callables that
do not exist on the server yet. Rufus decides whether this file and the branch
stay in the repo. No functions or Firestore rules were written.

Files: `citadel-shop.js` (new, lazy-loaded by the Citadel tab in `quests.js`),
`tests/test-citadel-shop.js`. SW cache `btc-archive-v2616`; `quests.js` pin
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

## Callables (stubbed client names, httpsCallable)

| Name | Input | Output |
|---|---|---|
| `getCitadelShopStatus` | `{}` | `{ success, premiumActive, flags: { referralWeekPremiumBuy }, stages: {walls,turret,vault,tower,keep}, lessonParts: {lesson_walls: true, ...}, lessonBuilt: {...}, lessonGrantPending, weekSpent, weekCap, weekResetsAt, newTickets }` |
| `buyCitadelStage` | `{ partId, stage, requestId }` | `{ success, stages, weekSpent, weekCap, newTickets }` or `{ success: false, code, message }` |
| `buildCitadelPart` | `{ lessonPartId, requestId }` | `{ success, lessonBuilt }` or `{ success: false, code, message }` |
| `claimLessonParts` | `{}` | `{ success, granted: [lessonPartId], lessonParts }` |

`requestId` is a client random id for idempotency. Error `code` values the UI
can map: `not_premium`, `weekly_cap`, `balance`, `account_age`, `not_owned`,
`already_owned`, `wrong_stage`, `flag_off`, `kill_switch`.

## Server checks needed

- **Premium active:** read `premium.active` server-side on every buy and build.
  Never trust the client. Lapsed Premium: see TODO toggle below.
- **Weekly 120 OT cap:** keep `citadel.weekSpent` and `citadel.weekKey` (ISO week,
  America/New_York) in one transaction with the OrangeTix debit. Reject if
  `weekSpent + price > 120`. No partial stages.
- **Balance:** debit `orangeTickets` in the same transaction; reject below price.
- **Part ownership and order:** `stage` must equal `stages[partId] + 1` and not
  exceed the part's stage count. `buildCitadelPart` requires the lesson part to
  be owned and not built.
- **Prices:** server catalog only (draft: Walls 4x75, Lightning Turret 2x100,
  Vault 2x120, Node Tower 3x100, Keep 4x115 = 1,500). Ignore any client price.
- **Referral flag:** only honor referral-week Premium buying when
  `config/citadelShop.referralWeekPremiumBuy === true` (staging). Default off.
  `config/citadelShop` needs public read in rules; writes admin-only.
- **Account age:** reject buys while `created` is newer than the minimum (TODO toggle).
- **Signed-in, non-guest:** reject anonymous sessions.
- **Idempotency:** store `requestId` per uid (for example
  `users/{uid}/citadelOps/{requestId}`) and return the first result on retry.
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
- `users/{uid}.citadel.stages.{walls|turret|vault|tower|keep}` (numbers)
- `users/{uid}.citadel.lessonParts.{lesson_*}` (true when earned)
- `users/{uid}.citadel.lessonBuilt.{lesson_*}` (true when built)
- `users/{uid}.citadel.weekSpent`, `users/{uid}.citadel.weekCap`
- `config/citadelShop.referralWeekPremiumBuy` (server-side only, returned in `flags`)

`citadel.*` must be server-write-only in rules.

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
| `citadel-shop.js` (new, lazy) | 26,204 B | about 8.0 KB (budget 30 KB) |
| `quests.js` change (Citadel loader + skeleton) | +535 B | +192 B |
| `index.html` / `404.html` | 0 B (pin text only, same length) | 0 B |

1. **Own lazy file:** met. `citadel-shop.js` is not in `index.html`, `404.html`,
   the bundle, `build.sh` or the SW precache. The Citadel tab loads it on its
   first open. `quests.js` (itself lazy) grows by 192 B gzip for the loader, so
   the first app load is 0 KB heavier.
2. **30 KB compressed:** met, about 8.0 KB gzip. Tested.
3. **Placeholder within 100 ms:** the tab draws a skeleton synchronously in
   `_renderCitadelTab` before the script is requested, and the shop's first paint
   is synchronous from the saved user doc before any server call. Not timed in
   a real browser on a slow phone; needs a check on staging.
4. **Art:** no raster art exists yet. The shop uses inline Lucide SVG icons
   (inside the 8 KB), so nothing loads before the tab opens. When part art
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
