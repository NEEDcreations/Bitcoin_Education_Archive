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
```

## billingStartsAt

Implemented with Stripe `subscription_data.trial_end` (not `billing_cycle_anchor`):
no charge today and no proration invoice.

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
- `premium_email_entitlements/{sha256 key}`: purchases from the public page, claimed by `claimPremiumByEmail` once the buyer signs in with that verified email.
- `premium_orders/{orderId}`, `premium_counters/founders` (sold + holds), `premium_events/{id}` (once-only webhook markers), `premium_review/{id}`, `premium_rate/{key}`, `premium_allowance/{uid}`, `premium_allowance_ledger/{id}`.

## Functions

| Function | Kind | Secrets |
|---|---|---|
| createPremiumCheckout | callable, App Check | STRIPE_SECRET_KEY, BTCPAY_API_KEY, BTCPAY_URL, BTCPAY_STORE_ID |
| premiumPublicCheckout | HTTPS, CORS allowlist + Turnstile + per-IP limit | same + Turnstile secret |
| createPremiumPortal | callable, App Check | STRIPE_SECRET_KEY |
| premiumStripeWebhook | HTTPS, Stripe signature | STRIPE_WEBHOOK_SECRET |
| premiumBtcpayWebhook | HTTPS, BTCPay-Sig | BTCPAY_WEBHOOK_SECRET, BTCPAY_API_KEY, BTCPAY_URL, BTCPAY_STORE_ID |
| getPremiumStatus, claimPremiumByEmail, claimPremiumAllowance | callable, App Check | none |
| premiumExpirySweep | hourly schedule | none |

## Fails closed when

Unknown project; live key on staging or test key on live; checkout or Lightning
switched off; amount/currency/session mismatch (goes to `premium_review`); bad
or stale signature (300 s); livemode event on staging; BTCPay invoice not
Settled on re-read or from another store; Founders sold out (holds count
against the 500); refunds, disputes and failed payments (review, no auto-grant).

## Allowance

50 cosmetic credits per America/New_York month for active Premium. Cosmetic
only: never sats, never raffles, chances, packs or battle items. The module has
a test that fails if it ever references sats balances, points, tickets or NWC.

## Setup steps for Phil (staging first)

1. Create staging runtime service accounts for the 5 new secret-bound functions and grant secret access (needs Phil's OK: new IAM).
2. Add Secret Manager secrets on staging: STRIPE_SECRET_KEY (sk_test_), STRIPE_WEBHOOK_SECRET, and later BTCPAY_*.
3. Deploy rules + functions by name to `bitcoin-quest-staging`.
4. Add a Stripe test webhook endpoint pointing at `premiumStripeWebhook` with events: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired, invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted, charge.refunded, charge.dispute.created.
5. Write `premium_config/settings` on staging with `checkoutEnabled: true`.
6. Lightning: BTCPay store (Lightning only) connected to a new receive-only Alby Hub wallet; webhook to `premiumBtcpayWebhook`; then `lightningEnabled: true`.
7. `/premium` route: the seo-router Worker needs a route for `/premium` and its CSP `connect-src` must allow the functions host (staging host for previews).
