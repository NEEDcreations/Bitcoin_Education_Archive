# Premium checkout (staging only until Phil signs off)

Code: `functions/src/premiumPricing.js` (prices, discounts, config) and
`functions/src/premium.js` (checkout, webhooks, entitlements). Public page:
`premium.html` + `premium.js`. In-app buy screen: `premium-buy.js`
(`/?premium=buy`, `/?premium=founders`, `window.bqOpenPremium()`). Route:
`workers/seo-router/worker.js` (`/premium`, noindex until `PREMIUM_PAGE_PUBLIC`).
Tests: `tests/test-premium-checkout.js`, `tests/test-premium-page.js`,
`tests/test-premium-buy.js`, `tests/test-premium-route.js`, `tests/rules/premium-rules.js`.

## Phil's decisions (Nov 18, 2026)

- **Charged at purchase on every plan.** No deferred billing. `billingStartsAt` is gone (ignored if present).
- **Perks:** Embers (100/mo, roll over to 300) and Citadel perks start `perksStartAt` = Jan 3, 2027 12:00 AM ET for anyone who bought earlier. Every other perk starts at purchase.
- **Citadel perks are cosmetic only** (Citadel spec, Nov 18). `citadelPerks` is a yes/no flag and must never speed up collecting parts, timers or cooldowns. Citadel parts, timer and cooldown code must never read Premium or Embers. No parts-ticket bonus for Premium.
- **OrangeTix perk:** Premium can buy up to 20 OrangeTix a day with the player's own XP (Phil, Nov 18). Nothing broader.
- **No free trial.** `trialsEnabled` must be exactly `true` to offer one (missing = off); `trialDays` is then 1..14. Planned for about early Feb 2027.
- **No refunds on any plan.** Monthly/Yearly cancel at period end and keep paid time (portal `subscription_cancel.mode=at_period_end`, `proration_behavior=none`). Founders and bitcoin payments are final. Shown before payment: the server refuses a checkout without `acceptNoRefunds: true` (`terms_required`), and Stripe's pay button carries the same text (`REFUND_POLICY`). Orders record `refundPolicy` and `noRefundAckAtMs`.
- **Kill switch:** `createPremiumCheckout` (card and BTCPay invoice create) and `premiumPublicCheckout` refuse new orders while `config/killSwitch` is on, and fail closed if it can't be read (`kill_switch`, HTTP 503 on the public route). `premiumStripeWebhook`, `premiumBtcpayWebhook`, `getPremiumStatus` and the sweep keep running.
- **Offline checkout dropped:** the app stays online; nothing special is kept for offline.
- **Founders seat never returns to sale** (refunded seats count as `retired`; `sold` never decrements).

Nothing here is live. Checkout is closed by default (`checkoutEnabled: false`),
Lightning is closed by default (`lightningEnabled: false`), and the code refuses
to run on any project other than `bitcoin-education-archive` (live keys only)
and `bitcoin-quest-staging` / `demo-*` (test keys only).

## Prices (server-side only; the client never sends an amount)

| Plan | Card | Lightning (10% off) | Existing player, card (5%) | Existing player, Lightning (15%) |
|---|---|---|---|---|
| Monthly | $5.00/mo subscription | not offered | $4.75 | n/a |
| Yearly | $50.00/yr subscription | $45.00 for 12 months | $47.50 | $42.50 |
| Founders' Lifetime (500 seats) | $150.00 once | $135.00 | $142.50 | $127.50 |
| Prepaid months (1-12) | not offered | $4.50 each | n/a | $4.25 each |
| Family/Classroom | $9.99/mo (inactive) | $8.99/mo prepaid (inactive) | | |

Stacking is additive by default (5% + 10% = 15%). `stackMode: 'sequential'`
compounds instead. Discount percentages are clamped to 0..25.

### Existing-player 5% (in-app only)

Applied only by the `createPremiumCheckout` callable, never by the public page.
All of these must hold, checked on the server:

1. The call carries a verified Firebase ID token (callable `context.auth`) and passes App Check.
2. Sign-in provider is not `anonymous`.
3. Token `email_verified === true`.
4. `users/{uid}` exists and is not banned.
5. Firebase Auth `metadata.creationTime` is before the cutoff: `existingUserCutoffMs`, else
   `checkoutLaunchedAtMs`. If neither is set, nobody gets it.
6. Server time is before `2027-01-01T00:00:00-05:00` (hard-coded; config cannot extend it).

## Config doc `premium_config/settings` (admin-only; rules deny all clients)

```
checkoutEnabled: false          // master switch
lightningEnabled: false         // BTCPay rail; flip after the Alby receive-only wallet is wired
btcDiscountPct: 10
existingUserDiscountPct: 5
stackMode: 'additive'           // or 'sequential'
existingUserCutoffMs: null      // accounts created before this are "existing"
checkoutLaunchedAtMs: null      // fallback cutoff
perksStartAt: '2027-01-03T00:00:00-05:00' // Embers + Citadel perks start (default; string or perksStartAtMs)
trialsEnabled: false            // must be exactly true to offer a trial; missing = no trial
trialDays: 0                    // 1..14, only read when trialsEnabled === true
publicOrdersPerHour: 60         // global cap on public-page orders per hour (all IPs)
maxLiveFoundersHolds: 25        // cap on Founders' seats in checkout at once
foundersHoldsAlertThreshold: 15 // holds at/above this for > 1 hour -> review row + admin alert
publicOrderEmailRetentionMonths: 3 // unclaimed public orders: plain email cleared after this (User Data, Nov 18)
foundersCardHoldMinutes: 10    // Founders card seat hold (5..30); bitcoin hold = 15-min invoice + 5-min grace
foundersHoldCooldownMinutes: 30 // wait after an unpaid Founders hold lapses (0..240, 0 = off)
foundersIpHoldCooldownMinutes: 30 // same wait for that hold's network (keyed IP hash; 0..240, 0 = off)
btcpayHost: null                // exact BTCPay hostname; the app only follows bitcoin links on it. Unset = bitcoin closed
stripePortalConfigId: null      // bpc_... from functions/scripts/premium-portal-config.js; portal closed until set
existingUserDiscountEndsAtMs    // may end the 5% earlier; clamped to 2027-01-01 00:00 ET at most
foundersRequireVerifiedEmail: true // Founders in-app requires a verified email; false turns this off. Absent = on
```

## Charging and perk start

| | Before Jan 3, 2027 12:00 AM ET | After |
|---|---|---|
| Monthly/Yearly (card) | charged today; renews monthly/yearly from today; Embers + Citadel perks wait for Jan 3, other perks now | charged today; all perks now |
| Founders (card or bitcoin) | charged today, seat sold now; Embers + Citadel perks Jan 3 | charged today, all perks now |
| Bitcoin prepaid months / Yearly | paid now; time counts from now; Embers + Citadel perks Jan 3 | paid now, all perks now |

Entitlements record `deferredPerksStartAtMs`; `getPremiumStatus` returns
`perksStartAtMs`, `deferredPerksOpen`, `citadelPerks`, `chargedAtPurchase: true`,
`trialsOpen`, `trialDays` and `refundPolicy`. `claimPremiumAllowance` returns
`perks_start` before Jan 3.

Stripe pay-button text (`custom_text.submit`): "You're charged today." + (Founders line)
+ "Embers and Citadel cosmetics start Jan 3, 2027 at 12:00 AM ET. Your other Premium
perks start right away." (only before Jan 3) + the no-refunds text.

Discounts are baked into the subscription's `price_data`, so a subscriber who
buys with the existing-player 5% before Jan 1 keeps that price on renewals.

## Data model (all server-only)

- `premium_entitlements/{uid}`: founders, subscriptionUntilMs, prepaidUntilMs, startsAtMs, trialUsed, trialUntilMs, stripeCustomerId, stripeSubscriptionId, autoRenew, active, pendingStart. Owner can read.
- `users/{uid}.premium`: read-only mirror for the client (rules already deny client writes).
- `premium_email_entitlements/{keyed hash}`: purchases from the public page, claimed by `claimPremiumByEmail` once the buyer signs in with that exact verified email (`normalizeEmail`, no `+tag` or Gmail-dot folding). No plain email is stored here.
- `premium_orders/{orderId}`, `premium_counters/founders` (sold + holds), `premium_events/{id}` (once-only webhook markers), `premium_review/{id}`, `premium_rate/{key}`, `premium_allowance/{uid}`, `premium_allowance_ledger/{id}`.
- `premium_trial_markers/{e_<hash>|c_<hash>}`: one per canonical email / card fingerprint that already had a free trial. Long-term.
- `premium_admin_audit/{id}`: every `adminRevokePremium` revoke/restore.

### Hashing (PREMIUM_HASH_KEY)

IPs, emails and card fingerprints are stored only as keyed hashes:
HMAC-SHA256(PREMIUM_HASH_KEY, 'bq-premium:<kind>:<value>'), 40 hex chars. No
plain IP or card fingerprint is ever written. Email-held entitlements and
`premium_orders.emailKey` use the exact `normalizeEmail` value (trim +
lowercase only). Trial-reuse markers and `premium_orders.trialEmailKey` use
the canonical email: lowercase, `+tag` stripped, dots removed for
gmail.com/googlemail.com, googlemail.com -> gmail.com. Missing key = checkout
refuses (`hash_key`). PREMIUM_HASH_KEY is a new Secret Manager secret (needs
Phil's OK); rotating it resets trial markers and rate buckets.

### Retention

| Data | Kept |
|---|---|
| premium_orders, premium_events, premium_review, premium_allowance_ledger, premium_trial_markers, premium_admin_audit | Permanent (`PERMANENT_COLLECTIONS`). Excluded from every cleanup, retained by account deletion (uid masked). |
| Plain email on a public order | Cleared when a verified account claims it, on a full refund, or by the hourly sweep `publicOrderEmailRetentionMonths` (default 3) after purchase. The keyed `emailKey` stays. |
| premium_rate docs (per-IP / per-account / global) | `expireAt` = window start + 2 h |
| Founders holds | `expMs` in `premium_counters/founders.holds` (released on expiry) |
| Founders hold cooldowns | `premium_rate/fcool_<holdKey>` and `premium_rate/fcoolip_<keyed IP hash>` with `untilMs`; `expireAt` = cooldown end + 1 h |
| premium_entitlements, premium_allowance, premium_email_entitlements | Deleted on account deletion |

TTL: `premium_rate.expireAt` is in place, but no Firestore TTL policy was
created. Creating one (`gcloud firestore fields ttls update expireAt
--collection-group=premium_rate`) is a project config change Phil has to OK;
until then expired rate docs are ignored by the code and stay small.

**10-year vault export:** the repo has no per-collection vault list yet
(`dailyFirestoreBackup` exports all collections; the offline-vault copy job is
not built). When it is built it must include every collection in
`PERMANENT_COLLECTIONS` (functions/src/premium.js): premium_orders,
premium_events, premium_review, premium_allowance_ledger,
premium_trial_markers, premium_admin_audit.

**Account deletion:** `purgeAccount` calls `purgePremiumForAccount`. Orders,
ledger, review and audit rows stay with the uid replaced by
`del_<sha256(uid) prefix>`; every email and emailKey field is cleared; the
entitlement, allowance, rate doc and claimed email entitlements are deleted. A
still-renewing card subscription gets a `deleted_account_active_subscription`
review row so a human cancels it in Stripe.

## Abuse controls

- **IP:** `faucetGuard.clientIpFromRequest` (rightmost X-Forwarded-For entry, which Google's front end appends; forged left entries are ignored). The same IP goes to Turnstile as `remoteip`. Founders holds and the public `ip_` rate key hash `faucetGuard.networkKeys(ip)` (IPv6 /64 `rangeId`, exact IPv4 `exactId`), so addresses in one IPv6 /64 share a bucket. A Firebase Hosting rewrite or any other proxy in front of the function would append another address and break this (the rightmost entry would then be the proxy, not the client).
- **Turnstile:** server checks success, `action === 'premium_checkout'` (premium.html sets `data-action`), and the hostname against the environment's allowlist (live: bitcoineducation.quest, www; staging: bitcoin-quest-staging.web.app, *.bitcoin-quest.pages.dev, dev.bitcoineducation.quest, bq-staging.pages.dev and its previews, localhost). Unknown project = no origins, no pass.
- **Rate:** 10 public orders per network per hour (IPv6 /64 or exact IPv4), 6 in-app per account per hour, `publicOrdersPerHour` across all public orders.
- **Founders:** in-app only (sign-in required; the public page sends Founders buyers to `/?premium=founders`). A verified email is required unless `foundersRequireVerifiedEmail` is set to false (default is true when absent). One live hold per account and per network (IPv6 /64 or exact IPv4); at most `maxLiveFoundersHolds` live holds. Holds at/above `foundersHoldsAlertThreshold` for over an hour raise one `founders_holds_high` review row and an `admin_notifications` alert.
- **Cancellations:** `customer.subscription.updated` / `.deleted` decide how a canceled subscription ends. Fraud, a dispute or trial reuse (`cancellation_details.reason` `payment_disputed`, a `cancellation_details.comment` or `metadata.bqCancelReason` of `fraud` / `trial_reused`, or an order already in `trial_reused` review) ends the subscription's time immediately; fraud and disputes also write a `subscription_revoked` review row. The server's own trial-reuse cancel sends `cancellation_details[comment]=trial_reused`. A trial canceled before `trial_end` (status `trialing`, or `ended_at` before `trial_end`) keeps access only until `trial_end`, with no grace period; undoing a scheduled trial cancel restores `trial_end` + grace for the first charge. Paid periods keep their paid time plus the 3-day grace period.
- **Trials:** when a trial is granted, the card fingerprint (re-read from the Checkout Session) and canonical email are recorded as keyed-hash markers. A known email gets a paid checkout with no trial; a known card found after checkout, or a trial order whose card fingerprint could not be read, sends the order to review (`trial_reused`) with no Premium, and the Stripe subscription is canceled immediately (`subscription_canceled` on the review row) so nothing is charged at `trial_end`. `checkout.session.completed` and `invoice.paid` share one idempotent trial gate, so a $0 `subscription_create` invoice that arrives first cannot grant time without passing the fingerprint and email checks. `already_paid` never skips that gate.
- **$0 invoices:** granted only for the order's trial opening invoice (order has trialEndMs, `billing_reason === 'subscription_create'`, first invoice). Anything else -> review `stripe_zero_invoice`. Renewals must equal the order's unitCents.
- **Refunds (by hand only), disputes, failed payments:** a dispute or a full refund freezes the order owner's entitlement and any found by stripeCustomerId (`frozen: true`: no perks, no allowance until an admin restores with `adminRevokePremium`). A partial refund only writes a review row (`partial: true`). A full refund of a paid Founders order adds 1 to `premium_counters/founders.retired` once (`order.seatRetired`) and never decrements `sold`. `invoice.payment_failed` writes a review row only (Stripe retries; the subscription's own status ends access). A review row carries uid, orderId and customerId, and an `admin_notifications` row (type `premium_review`) alerts a human in the admin panel feed.
- **Portal:** always opened with our own configuration (`stripePortalConfigId`). Promotion codes and plan switching are off in that configuration (`features.subscription_update.enabled=false`, `default_allowed_updates=[]`), created by `functions/scripts/premium-portal-config.js`. Stripe's default portal configuration is never used.
- **BTCPay:** on settle, the invoice and its `/payment-methods` are re-read; any payment on a non-Lightning method (BTC / BTC-CHAIN) -> review `not_lightning`, no grant. An unreadable response fails the webhook so BTCPay retries.
- **Claim:** `claimPremiumByEmail` refuses banned and minor accounts.

## Functions

| Function | Kind | Secrets |
|---|---|---|
| createPremiumCheckout | callable, App Check | PREMIUM_HASH_KEY, STRIPE_SECRET_KEY, BTCPAY_API_KEY, BTCPAY_URL, BTCPAY_STORE_ID |
| premiumPublicCheckout | HTTPS, CORS allowlist + Turnstile + per-IP and global limit | same + Turnstile secret |
| createPremiumPortal | callable, App Check | STRIPE_SECRET_KEY |
| premiumStripeWebhook | HTTPS, Stripe signature | STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY (card fingerprint re-read), PREMIUM_HASH_KEY |
| premiumBtcpayWebhook | HTTPS, BTCPay-Sig | BTCPAY_WEBHOOK_SECRET, BTCPAY_API_KEY, BTCPAY_URL, BTCPAY_STORE_ID |
| claimPremiumByEmail | callable, App Check | PREMIUM_HASH_KEY |
| getPremiumStatus, claimPremiumAllowance | callable, App Check | none |
| adminRevokePremium | callable, App Check, admin claim + fresh 2FA step-up, audit row | none (not deployed) |
| premiumExpirySweep | hourly schedule (expiry, email retention, holds alert) | none |
| deleteAccount | callable (existing); runs the Premium scrub (`purgePremiumForAccount`) | existing (DELETION_HMAC_SECRET) |

## Fails closed when

Unknown project; live key on staging or test key on live; checkout or Lightning
switched off; amount/currency/session mismatch (goes to `premium_review`); bad
or stale signature (300 s); livemode event on staging; BTCPay invoice not
Settled on re-read or from another store; Founders sold out (holds count
against the 500); refunds, disputes and failed payments (review, no auto-grant).

## Embers (monthly cosmetic allowance)

100 Embers per America/New_York month for paid Premium, including Founders'
Lifetime and the Family buyer's account only (not extra seats). Unspent Embers
roll over, capped at 300. Trial and referral weeks get none. After a
subscription is canceled, leftovers are kept but no new Embers are granted.
A full refund removes that period's unspent Embers; already-spent Embers stay
spent. Extra Embers cannot be bought. Cosmetic only: never sats, never raffles,
chances, packs or battle items. The module has a test that fails if it ever
references sats balances, points, tickets or NWC.

## Setup steps for Phil

Staging (done): test secrets, fn-premium-* service accounts, test webhook, portal config, `checkoutEnabled: true`.

Live (Phil only, after Red Team / QA / Security GO):
1. Stripe live mode: create a restricted or secret live key; add `STRIPE_SECRET_KEY` (sk_live_/rk_live_) and `PREMIUM_HASH_KEY` to Secret Manager on `bitcoin-education-archive`.
2. Stripe live webhook to `https://us-central1-bitcoin-education-archive.cloudfunctions.net/premiumStripeWebhook` with: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired, invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted, charge.refunded, charge.dispute.created. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Live portal config (`premium-portal-config.js` is test-only today; create the same settings in the Dashboard: cancel at period end, no proration, no plan switching, no promo codes) and set `stripePortalConfigId`.
4. Live runtime service accounts + secret access for the premium functions (new IAM).
5. Alby Hub: create a new, separate receive-only wallet/connection for Premium (no spend permission).
6. BTCPay: a Lightning-only store paying into that wallet; Greenfield API key with `btcpay.store.canviewinvoices`, `btcpay.store.cancreateinvoice` only; webhook to `premiumBtcpayWebhook` (InvoiceSettled, InvoiceExpired, InvoiceInvalid) with a secret. Secrets: `BTCPAY_URL`, `BTCPAY_STORE_ID`, `BTCPAY_API_KEY`, `BTCPAY_WEBHOOK_SECRET`.
7. Config: `existingUserCutoffMs` (or `checkoutLaunchedAtMs`) so the 5% works, then `lightningEnabled: true` and finally `checkoutEnabled: true`.
8. Public page: flip `PREMIUM_PAGE_PUBLIC` (seo-router) and `PAGE_OPEN_ON_LIVE` (premium.js) together, and deploy the Worker.

## Founders holds and late or reversed payments (Nov 18, Red Team F1/F2)

- Founders card holds last `foundersCardHoldMinutes` (10). The Stripe session
  itself stays open 31 minutes (Stripe's minimum is 30), so a buyer can still
  pay after the hold lapses. Only a live hold reserves a seat: a late payment
  gets a seat if one is free, otherwise it goes to `founders_sold_out_late_payment`
  review. The cap can never be oversold.
- Bitcoin holds stay at the 15-minute invoice + 5-minute grace, so a paid
  invoice is always covered by its hold.
- When live holds reach `maxLiveFoundersHolds`, new Founders checkouts get
  `founders_busy`, and one `admin_notifications` row (`premium_founders_cap`)
  plus one `premium_review` row (`founders_hold_cap_hit`) is written per
  30-minute window.
- An unpaid Founders hold that lapses starts a per-account cooldown
  (`foundersHoldCooldownMinutes`, 30). A new Founders checkout in that time gets
  `founders_cooldown`.
- A full refund or dispute always stamps the order (`refundKind: 'full'`,
  `disputedAtMs`), paid or not. A `checkout.session.completed` or
  `async_payment_succeeded` that arrives later grants the entitlement frozen
  (`frozenReason` = the refund or dispute event), writes a review row and an
  admin alert, and for Founders sells and retires the seat at once.
- A dispute event carries no order metadata, so the webhook reads its charge
  back from Stripe to find the order.

## Round 3 (Nov 18, Red Team F1-R/F2-R)

- Subscription (monthly/yearly) refund or dispute with no order id on the
  charge: charge -> invoice (`charge.invoice`, or `invoice_payments` by payment
  intent on newer Stripe API versions) -> `invoice.parent.subscription_details`
  metadata, else the subscription's metadata. Accepted only when
  `checkout/sessions?subscription=` returns the order's own `providerSessionId`.
  A 4xx on these optional reads means "not found"; other errors answer 500 so
  Stripe retries.
- Lapsed Founders card holds: the Stripe Checkout Session is expired
  (`POST /v1/checkout/sessions/{id}/expire`) when the next Founders checkout
  finds the hold lapsed and by the hourly sweep (holds lapsed in the last 70
  minutes). The order gets `sessionExpiredAtMs`.
  Note: `premiumExpirySweep` runs as the default service account with no
  Stripe key bound, so today it skips this step (`sessionsExpireSkipped`) and
  the checkout-time expiry plus the 31-minute Stripe expiry do the work.
  Turning the sweep step on needs the Stripe key bound to the sweep under a
  dedicated runtime service account (an IAM decision, not made here). A failed expire is logged and
  never throws; a payment that still lands goes to
  `founders_sold_out_late_payment` review if the cap is full.
- Stripe session `expires_at` stays at 31 minutes (Stripe's 30-minute minimum
  plus 1 minute).
- Countdown: the in-app buy screen shows "Your Founders seat is held for N
  minutes" with a live timer and a Pay now button; the Stripe pay-button text
  carries the same line; /premium's Founders note says the seat is held for 10
  minutes once checkout opens.
- Network cooldown: a lapsed or expired Founders hold also cools down its
  network for `foundersIpHoldCooldownMinutes` (`founders_cooldown_ip`).

## Round 4 (Nov 18, Red Team N1)

- Lapsed Founders' holds still leave `holds` in the same transaction that finds
  them, so their seats are free at once (no lock-up, no oversell). Each one
  moves to `premium_counters/founders.expireQueue` (`{ orderId: deadlineMs }`,
  server-only: the counter doc is read/write false for clients). The deadline is
  hold end + 31 minutes, after which Stripe has expired the session itself.
- Every Founders' checkout (and the sweep, when it has the Stripe key) works
  the queue: soonest deadline first, at most 10 Stripe expire calls (30 order
  reads) per call. Entries leave the queue only when done: expired, not a
  pending Stripe Founders' order any more, or past Stripe's own expiry. A
  failed expire stays queued and is retried. The queue keeps at most 300
  entries (latest deadlines kept).
- A refused checkout (sold out, busy, cooldown) prunes nothing, but still
  works the queue plus the lapsed holds it saw.
- Buy-screen copy: "After that your seat is released and may go to someone
  else." (no promise that the checkout itself closes).

## Round 5 (Nov 18, Red Team N3/N4)

- The expire queue moved off the seat counter into its own server-only doc,
  `premium_counters/founders_expire` (`entries: { orderId: deadlineMs }`,
  `lastDrainMs`). Client access is already denied by the existing
  `premium_counters/{docId}` rule; no rules change. The seat transaction still
  prunes lapsed holds from `premium_counters/founders` and adds their entries
  with a blind merge into the queue doc (no read, so it never conflicts with
  queue upkeep). A legacy `expireQueue` field on the counter moves over once.
- Drains run at most once every 15 seconds across all callers (claimed with
  `lastDrainMs` in a transaction). Cap 300, deadlines and retry rules unchanged;
  the cap is applied when a drain finishes.
- A refused Founders' checkout (hold open, cooldown, sold out, busy) still uses
  one attempt from the per-account hourly window; the refusal answer itself is
  unchanged until that limit is reached.

## Live deploy list for #322 (named deploy, in order)

Functions (by name, never all): createPremiumCheckout, premiumPublicCheckout,
createPremiumPortal, premiumStripeWebhook, premiumBtcpayWebhook (once BTCPay
exists), claimPremiumByEmail, getPremiumStatus, claimPremiumAllowance,
premiumExpirySweep, **deleteAccount** (carries the Premium account-deletion
scrub; QA D1, Nov 18). Then rules, then hosting.

Turnstile on live (Round 10): live `premiumPublicCheckout` must keep the REAL
`TURNSTILE_SECRET_KEY` version. Never add Cloudflare's test secret
(`1x0000…AA`) to the live project. After the live deploy, check the function's
bound `TURNSTILE_SECRET_KEY` version is the real one (re-pin if the CLI moved it),
and check the live `/premium` page serves sitekey `0x4AAAAAAD-ivgpRkbXpgz86`
(the repo keeps it; only `scripts/build-staging.sh` swaps it). The server refuses
test-key results on live regardless.

## Round 6 (Nov 18, QA D1)

Account deletion also removes `premium_rate/fcool_<uid>` and
`premium_rate/fcool_email:<key>` for email purchases the account claimed,
masks Founders holds keyed by either, and clears the `orderId` link on any
cooldown row (the per-network cooldown itself stays: keyed hash, anti-abuse).
Orders keep the masked uid with every email field and email hash cleared; the
entitlement, allowance and per-account rate docs are deleted, as before.

## Round 7

- **Manage billing in Settings:** Settings > Account shows a Premium card with a
  Manage billing button only to active card subscribers (`active`, not Founders,
  `autoRenew: true` from `getPremiumStatus`). It opens `createPremiumPortal` and
  follows only `billing.stripe.com`. Founders, bitcoin prepay, non-Premium,
  signed-out and guest users see nothing, and any error leaves it hidden. The
  buy dialog's Manage billing button uses the same check.
- **Final-sale box (in-app):** the buy dialog already refuses the click on the
  client with "Please tick the box to confirm that all sales are final." before
  any server call; the server still refuses without `acceptNoRefunds`.
- **Refund amount:** a full refund now records `refundedCents` too, so a partial
  refund followed by a full refund shows the final amount.
- **Sign-in return:** email sign-in links return to the page path without
  `?premium=buy`; the buy dialog reopens only in the same tab (session storage).
- Staging: `premiumStripeWebhook` redeployed; preview `premium-322` rebuilt with
  `btc-archive-v2610` (ranking.js and premium-buy.js `20261118_v2610`).

## Round 8 (Nov 18, kill switch in getPremiumStatus)

- `getPremiumStatus` reads `config/killSwitch` with the same fail-closed read as
  the checkouts (unreadable = paused). While paused it returns
  `checkoutOpen: false`, `lightningOpen: false`, `checkoutPaused: true`,
  `pausedReason: 'kill_switch'`; ownership fields keep answering.
- The buy dialog shows "Checkout is paused right now." instead of the buy flow.
  Card subscribers still see Manage billing (`createPremiumPortal` is not a
  gated function), with the same note, in the dialog and in Settings.
- Staging: `getPremiumStatus` redeployed; preview rebuilt with `btc-archive-v2611`
  (premium-buy.js `20261118_v2611`; ranking.js stays `20261118_v2610`).

## Round 9 (Nov 18, QA P2 and return from Stripe)

- **Root cause:** with charge at purchase, Stripe sends `invoice.paid` before
  `checkout.session.completed`. The `invoice.paid` first-grant path set the
  plan and paid time but not `autoRenew` or `stripeSubscriptionStatus`, and the
  later completion returned `already_paid`, so the flags were never set.
- **Fix:** both grant paths mark a new card subscription renewing
  (`autoRenew: true`, `stripeSubscriptionStatus: 'active'`, or `'trialing'`
  during a trial) unless a `customer.subscription.updated/deleted` for that
  subscription already set the state. Later subscription events still win.
- **getPremiumStatus `manageBilling`:** true for active, non-Founders card
  monthly/yearly with a Stripe customer and subscription, even when renewal is
  off. The buy dialog and Settings show Manage billing on it (or `autoRenew`).
- **Return from Stripe:** `success_url` already carries `?premium=success`; the
  client shows the toast and then tidies the URL. It now re-reads status a few
  times (1.5 s to 20 s), and once Premium is active it says "Premium is on.",
  refreshes the Settings billing card and fires `bq:premium-status`. A portal
  return refreshes once.
- Staging: `premiumStripeWebhook` and `getPremiumStatus` redeployed; preview
  `btc-archive-v2612` (premium-buy.js `20261118_v2612`). No QA entitlements
  backfilled (the affected ones are refunded/frozen or deleted).

## Round 10 (Nov 19, Turnstile test keys on staging; Phil approved option 2)

- Staging `TURNSTILE_SECRET_KEY` has a new version **3** = Cloudflare's published
  always-pass TEST secret. Versions 1 and 2 are kept. `premiumPublicCheckout` on
  staging binds latest (v3); the v1 pin for it is dropped. `claimSats` and
  `resetLightningAddressOnce` stay on v1 (their widgets keep the real sitekey);
  a future by-name staging deploy of either would bind v3, so pin them to `:1`.
- `scripts/build-staging.sh` swaps only the Premium checkout widget in
  `premium.html` to the TEST sitekey `1x00000000000000000000AA`, after checking the
  build is the staging project. The repo, and so the live build, keeps
  `0x4AAAAAAD-ivgpRkbXpgz86`; `tests/test-staging-turnstile.js` pins both.
- Test-key siteverify results have no action, hostname `example.com` and
  `metadata.result_with_testing_key: true`. The server passes them only on the
  staging project; live refuses them even if a test secret were ever bound there.
  On staging, any non-empty token passes; rate limits, CORS, the kill switch and the
  final-sale box still apply.
- No client files changed, so the SW stays `btc-archive-v2612`.

## Round 11 (Nov 19, signed-out Payment received screen)

- Buyers who return from Stripe or BTCPay while signed out now see a static
  **Payment received** screen: the plan name (only `monthly`, `yearly`, or
  `Founders' Lifetime`; unknown or missing stays blank), "Sign in with the
  email you paid with to claim your Premium", and a Sign in button that opens
  the existing sign-in. Signed-in buyers keep the existing "Thanks! Your
  payment is being confirmed…" toast and status watch.
- The screen never reads or shows an email, name, amount, or order id from the
  return URL, and it never echoes other query values into the DOM. The
  success URL adds an allowlisted `&plan=` slug only. The client then tidies
  `premium`, `order`, `plan`, and `session_id` from the address bar.
- No new Cloud Function. The plan on the signed-out screen comes from that
  allowlisted slug; after sign-in, status still comes from `getPremiumStatus`.
- Public `/premium` uses the same screen (Sign in goes to `/?premium=success`
  with the allowlisted plan only). Light and dark themes, 44px controls, and
  4.5:1 contrast; the card is capped at 460px so it holds at 375px and 1280px.
- Cache bump `btc-archive-v2613` (premium-buy.js and premium.js `20261119_v2613`).
