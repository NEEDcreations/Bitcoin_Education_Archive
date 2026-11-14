# Premium checkout (staging only until Phil signs off)

Code: `functions/src/premiumPricing.js` (prices, discounts, config) and
`functions/src/premium.js` (checkout, webhooks, entitlements). Public page:
`premium.html` + `premium.js`. Tests: `tests/test-premium-checkout.js`,
`tests/test-premium-page.js`, `tests/rules/premium-rules.js`.

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
billingStartsAt: null           // e.g. '2027-01-03T00:00:00-05:00' (string or ms)
trialDays: 7                    // 0..14
publicOrdersPerHour: 60         // global cap on public-page orders per hour (all IPs)
maxLiveFoundersHolds: 25        // cap on Founders' seats in checkout at once
foundersHoldsAlertThreshold: 15 // holds at/above this for > 1 hour -> review row + admin alert
publicOrderEmailRetentionMonths: 24 // unclaimed public orders: plain email cleared after this (Phil to confirm)
stripePortalConfigId: null      // bpc_... from functions/scripts/premium-portal-config.js; portal closed until set
existingUserDiscountEndsAtMs    // may end the 5% earlier; clamped to 2027-01-01 00:00 ET at most
foundersRequireVerifiedEmail: true // Founders in-app requires a verified email; false turns this off. Absent = on
```

## billingStartsAt

Implemented with Stripe subscription trials (not `billing_cycle_anchor`):
no charge today and no proration invoice. A plain N-day trial uses
`subscription_data.trial_period_days` so the hosted page shows the full
N days. When `billingStartsAt` is in the future, the session still uses
`trial_end` (Jan 3, or Jan 3 + trial days); `trial_period_days` would
start the clock at checkout and charge too soon.

| | Flag unset (default) | Flag = 2027-01-03T00:00:00-05:00 |
|---|---|---|
| Monthly/Yearly, first-time subscriber | 7-day free trial from today; first charge day 8; perks start now | $0 today; trial_end = Jan 10 (Jan 3 + 7 days); perks start Jan 3 |
| Monthly/Yearly, trial already used | charged today; perks start now | $0 today; first charge Jan 3; perks start Jan 3 |
| Founders | charged today, seat sold now, perks start now | charged today, seat sold now, perks start Jan 3 |
| Lightning prepaid / Yearly | paid now, time counts from now | paid now, time counts from Jan 3 |

Checkout page text (Stripe `custom_text.submit`):

- Flag unset, trial: "You will not be charged today. Your first charge is on <date>. Cancel any time before then and you pay nothing."
- Flag set, trial: "Premium perks unlock with Citadel Spark on Jan 3, 2027. You will not be charged today. Your first charge is on Jan 10, 2027. Cancel any time before then and you pay nothing."
- Flag set, Founders: "Premium perks unlock with Citadel Spark on Jan 3, 2027. You're charged today and your Founders' seat is reserved now."
- Flag unset, no trial: no extra text (Stripe shows the amount due today).

Entitlements bought early carry `startsAtMs`; `premiumExpirySweep` (hourly) turns them on once that time passes.

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
| Plain email on a public order | Cleared when a verified account claims it, on a full refund, or by the hourly sweep `publicOrderEmailRetentionMonths` (default 24) after purchase. The keyed `emailKey` stays. |
| premium_rate docs (per-IP / per-account / global) | `expireAt` = window start + 2 h |
| Founders holds | `expMs` in `premium_counters/founders.holds` (released on expiry) |
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
- **Turnstile:** server checks success, `action === 'premium_checkout'` (premium.html sets `data-action`), and the hostname against the environment's allowlist (live: bitcoineducation.quest, www; staging: bitcoin-quest-staging.web.app, *.bitcoin-quest.pages.dev, localhost). Unknown project = no origins, no pass.
- **Rate:** 10 public orders per network per hour (IPv6 /64 or exact IPv4), 6 in-app per account per hour, `publicOrdersPerHour` across all public orders.
- **Founders:** in-app only (sign-in required; the public page sends Founders buyers to `/?premium=founders`). A verified email is required unless `foundersRequireVerifiedEmail` is set to false (default is true when absent). One live hold per account and per network (IPv6 /64 or exact IPv4); at most `maxLiveFoundersHolds` live holds. Holds at/above `foundersHoldsAlertThreshold` for over an hour raise one `founders_holds_high` review row and an `admin_notifications` alert.
- **Cancellations:** `customer.subscription.updated` / `.deleted` decide how a canceled subscription ends. Fraud, a dispute or trial reuse (`cancellation_details.reason` `payment_disputed`, a `cancellation_details.comment` or `metadata.bqCancelReason` of `fraud` / `trial_reused`, or an order already in `trial_reused` review) ends the subscription's time immediately; fraud and disputes also write a `subscription_revoked` review row. The server's own trial-reuse cancel sends `cancellation_details[comment]=trial_reused`. A trial canceled before `trial_end` (status `trialing`, or `ended_at` before `trial_end`) keeps access only until `trial_end`, with no grace period; undoing a scheduled trial cancel restores `trial_end` + grace for the first charge. Paid periods keep their paid time plus the 3-day grace period.
- **Trials:** when a trial is granted, the card fingerprint (re-read from the Checkout Session) and canonical email are recorded as keyed-hash markers. A known email gets a paid checkout with no trial; a known card found after checkout, or a trial order whose card fingerprint could not be read, sends the order to review (`trial_reused`) with no Premium, and the Stripe subscription is canceled immediately (`subscription_canceled` on the review row) so nothing is charged at `trial_end`. `checkout.session.completed` and `invoice.paid` share one idempotent trial gate, so a $0 `subscription_create` invoice that arrives first cannot grant time without passing the fingerprint and email checks. `already_paid` never skips that gate.
- **$0 invoices:** granted only for the order's trial opening invoice (order has trialEndMs, `billing_reason === 'subscription_create'`, first invoice). Anything else -> review `stripe_zero_invoice`. Renewals must equal the order's unitCents.
- **Refunds, disputes, failed payments:** entitlements found by stripeCustomerId (account and email-held) get `frozen: true`; frozen means no perks and no allowance until an admin restores with `adminRevokePremium`. A review row carries uid, orderId and customerId, and an `admin_notifications` row (type `premium_review`) alerts a human in the admin panel feed.
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

## Setup steps for Phil (staging first)

1. Create staging runtime service accounts for the 6 new secret-bound functions (incl. fn-premium-claim) and grant secret access (needs Phil's OK: new IAM).
2. Add Secret Manager secrets on staging: PREMIUM_HASH_KEY (32+ random bytes), STRIPE_SECRET_KEY (sk_test_), STRIPE_WEBHOOK_SECRET, and later BTCPAY_*.
2b. Run `node functions/scripts/premium-portal-config.js --apply` with the staging test key and set `stripePortalConfigId`.
3. Deploy rules + functions by name to `bitcoin-quest-staging`.
4. Add a Stripe test webhook endpoint pointing at `premiumStripeWebhook` with events: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired, invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted, charge.refunded, charge.dispute.created.
5. Write `premium_config/settings` on staging with `checkoutEnabled: true`.
6. Lightning: BTCPay store (Lightning only) connected to a new receive-only Alby Hub wallet; webhook to `premiumBtcpayWebhook`; then `lightningEnabled: true`.
7. `/premium` route: the seo-router Worker needs a route for `/premium` and its CSP `connect-src` must allow the functions host (staging host for previews).
