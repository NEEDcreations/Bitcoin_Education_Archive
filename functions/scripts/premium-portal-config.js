#!/usr/bin/env node
'use strict';
// Creates the Stripe customer-portal configuration Premium uses, then you put
// its id (bpc_...) in premium_config/settings.stripePortalConfigId.
// createPremiumPortal always passes that id; with no id the portal stays closed.
//
// What it allows: update card, see invoices, cancel at period end.
// What it blocks: plan switching, quantity changes and PROMOTION CODES
// (features.subscription_update.enabled=false, default_allowed_updates=[]),
// so no one can turn a subscription into $0 from the portal.
//
// Dry run by default (prints the request). --apply needs a TEST key in
// STRIPE_SECRET_KEY (sk_test_/rk_test_); live keys are refused here.
// The key is never printed.
const premium = require('../src/premium');

const PARAMS = {
    business_profile: { headline: 'Bitcoin Quest Premium' },
    default_return_url: 'https://bitcoin-quest-staging.web.app/?premium=portal',
    features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        customer_update: { enabled: false },
        subscription_cancel: { enabled: true, mode: 'at_period_end', proration_behavior: 'none' },
        subscription_update: { enabled: false, default_allowed_updates: '', products: '' },
    },
    metadata: { app: 'bitcoin-quest-premium' },
};

async function main() {
    const body = premium.stripeForm(PARAMS);
    if (process.argv.indexOf('--apply') === -1) {
        console.log('Dry run. POST /v1/billing_portal/configurations');
        console.log(decodeURIComponent(body));
        return;
    }
    const key = process.env.STRIPE_SECRET_KEY || '';
    if (!premium.stripeKeyOk(key, 'test')) { console.error('Refusing: STRIPE_SECRET_KEY must be a test key.'); process.exit(2); }
    const res = await fetch('https://api.stripe.com/v1/billing_portal/configurations', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': 'bq-premium-portal-v1' },
        body: body,
    });
    const out = await res.json();
    if (!res.ok) { console.error('Stripe error', res.status, out && out.error && out.error.message); process.exit(1); }
    console.log('Portal configuration: ' + out.id + ' (set premium_config/settings.stripePortalConfigId)');
}
if (require.main === module) main();
module.exports = { PARAMS };
