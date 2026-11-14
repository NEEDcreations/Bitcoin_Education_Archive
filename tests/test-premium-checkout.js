#!/usr/bin/env node
'use strict';
// Premium checkout: prices, discounts, existing-user eligibility, Founders cap,
// webhook signatures, idempotency, BTCPay re-read, entitlements, trials,
// billingStartsAt, public /premium checkout, allowance and fail-closed checks.
// Offline: in-memory Firestore fake, mocked Stripe and BTCPay. No network and
// no real keys (the fake values below are not secrets).
const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const pricing = require('../functions/src/premiumPricing');
const premium = require('../functions/src/premium');

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name: name, fn: fn }); }

// ---------- in-memory Firestore fake (enough for this module)
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function makeDb() {
    const store = new Map();
    function snap(p) {
        const v = store.get(p);
        return { exists: v !== undefined, id: p.split('/').pop(), ref: docRef(p), data: function () { return clone(v); } };
    }
    function merge(a, b) {
        const out = Object.assign({}, a || {});
        Object.keys(b).forEach(function (k) {
            if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && out[k] && typeof out[k] === 'object') out[k] = merge(out[k], b[k]);
            else out[k] = b[k];
        });
        return out;
    }
    function write(p, op, data, opts) {
        if (op === 'create') { if (store.has(p)) throw new Error('ALREADY_EXISTS ' + p); store.set(p, clone(data)); }
        else if (op === 'set') store.set(p, opts && opts.merge ? merge(store.get(p), clone(data)) : clone(data));
        else if (op === 'update') { if (!store.has(p)) throw new Error('NOT_FOUND ' + p); store.set(p, Object.assign(store.get(p), clone(data))); }
    }
    function docRef(p) {
        return {
            path: p, id: p.split('/').pop(),
            get: async function () { return snap(p); },
            set: async function (d, o) { write(p, 'set', d, o); },
            update: async function (d) { write(p, 'update', d); },
            create: async function (d) { write(p, 'create', d); },
        };
    }
    function collection(c) {
        const filters = [];
        let lim = Infinity;
        const q = {
            doc: function (id) { return docRef(c + '/' + id); },
            where: function (f, op, v) { filters.push([f, op, v]); return q; },
            limit: function (n) { lim = n; return q; },
            get: async function () {
                const docs = [];
                for (const [p, v] of store) {
                    if (p.indexOf(c + '/') !== 0 || p.split('/').length !== 2) continue;
                    const ok = filters.every(function (f) {
                        const x = v[f[0]];
                        if (x === null || x === undefined) return false;
                        if (f[1] === '<=') return x <= f[2];
                        if (f[1] === '==') return x === f[2];
                        throw new Error('op');
                    });
                    if (ok) docs.push(snap(p));
                }
                return { docs: docs.slice(0, lim) };
            },
        };
        return q;
    }
    async function runTransaction(fn) {
        const writes = [];
        const tx = {
            get: async function (r) { if (writes.length) throw new Error('read after write in transaction'); return snap(r.path); },
            set: function (r, d, o) { writes.push([r.path, 'set', d, o]); },
            update: function (r, d) { writes.push([r.path, 'update', d]); },
            create: function (r, d) { writes.push([r.path, 'create', d]); },
        };
        const out = await fn(tx);
        const backup = new Map(Array.from(store.entries()).map(function (e) { return [e[0], clone(e[1])]; }));
        try { writes.forEach(function (w) { write(w[0], w[1], w[2], w[3]); }); }
        catch (e) { store.clear(); backup.forEach(function (v, k) { store.set(k, v); }); throw e; }
        return out;
    }
    return { store: store, collection: collection, runTransaction: runTransaction };
}

class HttpsError extends Error {
    constructor(code, message, details) { super(message); this.code = code; this.details = details; }
}

const T0 = Date.parse('2026-11-20T15:00:00.000Z');
const LAUNCH = Date.parse('2026-11-15T00:00:00.000Z');
const OLD = Date.parse('2026-03-01T00:00:00.000Z');
const NEW = Date.parse('2026-11-18T00:00:00.000Z');
const JAN3 = Date.parse('2027-01-03T00:00:00-05:00');
const FAKE_ENV = {
    STRIPE_SECRET_KEY: 'sk_test_' + 'x'.repeat(24),
    STRIPE_WEBHOOK_SECRET: 'whsec_test_fake_value',
    BTCPAY_API_KEY: 'fake-btcpay-key',
    BTCPAY_WEBHOOK_SECRET: 'fake-btcpay-hook-secret',
    BTCPAY_URL: 'https://btcpay.example.test',
    BTCPAY_STORE_ID: 'StoreABC12345',
};

function setup(opts) {
    const o = opts || {};
    const db = makeDb();
    const clock = { now: o.now || T0 };
    const calls = [];
    const btcInvoices = {};
    let idn = 0;
    const fetchMock = async function (url, init) {
        calls.push({ url: url, init: init });
        if (o.providerDown) return { ok: false, status: 503, json: async function () { return {}; } };
        if (url.indexOf('https://api.stripe.com/v1/checkout/sessions') === 0) {
            return { ok: true, status: 200, json: async function () { return { id: 'cs_test_' + (++idn), url: 'https://checkout.stripe.test/' + idn }; } };
        }
        if (url.indexOf('https://api.stripe.com/v1/billing_portal/sessions') === 0) {
            return { ok: true, status: 200, json: async function () { return { url: 'https://billing.stripe.test/p' }; } };
        }
        const m = url.match(/\/api\/v1\/stores\/StoreABC12345\/invoices(?:\/([A-Za-z0-9]+))?$/);
        if (m && init.method === 'POST') {
            const body = JSON.parse(init.body);
            const id = 'Inv' + String(++idn).padStart(8, '0');
            btcInvoices[id] = { id: id, status: 'New', amount: body.amount, currency: body.currency, metadata: body.metadata, checkoutLink: 'https://btcpay.example.test/i/' + id };
            return { ok: true, status: 200, json: async function () { return clone(btcInvoices[id]); } };
        }
        if (m && init.method === 'GET') {
            const inv = btcInvoices[m[1]];
            return inv ? { ok: true, status: 200, json: async function () { return clone(inv); } } : { ok: false, status: 404, json: async function () { return {}; } };
        }
        throw new Error('unexpected fetch ' + url);
    };
    const created = Object.assign({ old: OLD, new: NEW }, o.created || {});
    const h = premium.createPremiumHandlers({
        db: db,
        HttpsError: HttpsError,
        now: function () { return clock.now; },
        env: Object.assign({}, FAKE_ENV, o.env || {}),
        fetch: fetchMock,
        projectId: o.projectId || 'bitcoin-quest-staging',
        getAuthUser: async function (uid) { return { metadata: { creationTime: new Date(created[uid] || OLD).toUTCString() } }; },
        verifyTurnstile: async function (token) { return token === 'ok-token'; },
    });
    if (o.config !== false) {
        db.store.set('premium_config/settings', Object.assign({ checkoutEnabled: true, lightningEnabled: true, checkoutLaunchedAtMs: LAUNCH, trialDays: 0 }, o.config || {}));
    }
    db.store.set('users/old', { displayName: 'Old' });
    db.store.set('users/new', { displayName: 'New' });
    return { db: db, h: h, clock: clock, calls: calls, btcInvoices: btcInvoices };
}
function ctx(uid, extra) {
    return { auth: { uid: uid, token: Object.assign({ firebase: { sign_in_provider: 'password' }, email: uid + '@example.com', email_verified: true }, extra || {}) }, app: {} };
}
async function rejects(p, reason) {
    try { await p; } catch (e) {
        assert.ok(e instanceof HttpsError, 'expected HttpsError, got ' + e.message);
        if (reason) assert.strictEqual(e.details && e.details.reason, reason, 'reason ' + (e.details && e.details.reason) + ' != ' + reason);
        return e;
    }
    throw new Error('expected rejection ' + (reason || ''));
}
function stripeSigned(event, secret, tSec) {
    const raw = Buffer.from(JSON.stringify(event));
    const sig = crypto.createHmac('sha256', secret).update(tSec + '.' + raw.toString('utf8')).digest('hex');
    return { raw: raw, header: 't=' + tSec + ',v1=' + sig };
}
function fakeRes() {
    const r = { code: null, body: null, headers: {} };
    r.status = function (c) { r.code = c; return r; };
    r.send = function (b) { r.body = b; return r; };
    r.json = function (b) { r.body = b; return r; };
    r.set = function (k, v) { r.headers[k.toLowerCase()] = v; return r; };
    return r;
}
function req(raw, headers, extra) {
    const hs = {};
    Object.keys(headers).forEach(function (k) { hs[k.toLowerCase()] = headers[k]; });
    return Object.assign({ method: 'POST', rawBody: raw, headers: hs, get: function (k) { return hs[k.toLowerCase()]; } }, extra || {});
}
function bodyOf(call) { return decodeURIComponent(call.init.body); }

// ---------- pricing
test('prices: card $5/$50/$150, Lightning 10% off yearly/founders/months', async function () {
    const q = function (plan, rail, months) { return pricing.quote({ plan: plan, rail: rail, months: months, nowMs: T0 }, {}).amountCents; };
    assert.strictEqual(q('monthly', 'card'), 500);
    assert.strictEqual(q('yearly', 'card'), 5000);
    assert.strictEqual(q('founders', 'card'), 15000);
    assert.strictEqual(q('yearly', 'lightning'), 4500);
    assert.strictEqual(q('founders', 'lightning'), 13500);
    assert.strictEqual(q('months', 'lightning', 1), 450);
    assert.strictEqual(q('months', 'lightning', 3), 1350);
});
test('eligible existing users: 5% by card, 15% with bitcoin (additive default)', async function () {
    const q = function (plan, rail, months) { return pricing.quote({ plan: plan, rail: rail, months: months, nowMs: T0, existingUserEligible: true }, {}); };
    assert.strictEqual(q('monthly', 'card').amountCents, 475);
    assert.strictEqual(q('yearly', 'card').amountCents, 4750);
    assert.strictEqual(q('founders', 'card').amountCents, 14250);
    assert.strictEqual(q('yearly', 'lightning').amountCents, 4250);
    assert.strictEqual(q('founders', 'lightning').amountCents, 12750);
    assert.strictEqual(q('months', 'lightning', 1).amountCents, 425);
    assert.deepStrictEqual(q('yearly', 'lightning').discounts.map(function (d) { return d.kind + d.pct; }), ['existing_user5', 'bitcoin10']);
    assert.strictEqual(pricing.DEFAULT_CONFIG.stackMode, 'additive');
    assert.strictEqual(pricing.quote({ plan: 'yearly', rail: 'lightning', nowMs: T0, existingUserEligible: true }, { stackMode: 'sequential' }).amountCents, 4275);
});
test('existing-user discount ends 2027-01-01T00:00:00-05:00', async function () {
    const end = Date.parse('2027-01-01T00:00:00-05:00');
    assert.strictEqual(pricing.EXISTING_DISCOUNT_ENDS_MS, end);
    assert.strictEqual(pricing.quote({ plan: 'yearly', rail: 'card', nowMs: end - 1, existingUserEligible: true }, {}).amountCents, 4750);
    assert.strictEqual(pricing.quote({ plan: 'yearly', rail: 'card', nowMs: end, existingUserEligible: true }, {}).amountCents, 5000);
    assert.strictEqual(pricing.quote({ plan: 'yearly', rail: 'lightning', nowMs: end, existingUserEligible: true }, {}).amountCents, 4500);
});
test('bad config never raises a discount; billingStartsAt parses ET string', async function () {
    const wild = pricing.normalizeConfig({ btcDiscountPct: 90, existingUserDiscountPct: -5, stackMode: 'x', checkoutEnabled: 'yes', lightningEnabled: 1, trialDays: 30 });
    assert.strictEqual(wild.btcDiscountPct, 10);
    assert.strictEqual(wild.existingUserDiscountPct, 5);
    assert.strictEqual(wild.stackMode, 'additive');
    assert.strictEqual(wild.checkoutEnabled, false);
    assert.strictEqual(wild.lightningEnabled, false);
    assert.strictEqual(wild.trialDays, 7);
    assert.strictEqual(pricing.normalizeConfig({}).billingStartsAtMs, null);
    assert.strictEqual(pricing.normalizeConfig({ billingStartsAt: '2027-01-03T00:00:00-05:00' }).billingStartsAtMs, JAN3);
});
test('rails: monthly not on Lightning, months not on card, family refused, months 1..12', async function () {
    const code = function (input) { try { pricing.quote(Object.assign({ nowMs: T0 }, input), {}); return 'ok'; } catch (e) { return e.code; } };
    assert.strictEqual(code({ plan: 'monthly', rail: 'lightning' }), 'rail_not_offered');
    assert.strictEqual(code({ plan: 'months', rail: 'card', months: 1 }), 'rail_not_offered');
    assert.strictEqual(code({ plan: 'family_monthly', rail: 'card' }), 'family_inactive');
    assert.strictEqual(code({ plan: 'family_months', rail: 'lightning', months: 1 }), 'family_inactive');
    assert.strictEqual(code({ plan: 'months', rail: 'lightning', months: 0 }), 'bad_months');
    assert.strictEqual(code({ plan: 'months', rail: 'lightning', months: 13 }), 'bad_months');
    assert.strictEqual(code({ plan: 'months', rail: 'lightning', months: 1.5 }), 'bad_months');
    assert.strictEqual(code({ plan: '__proto__', rail: 'card' }), 'bad_plan');
    assert.strictEqual(code({ plan: 'constructor', rail: 'card' }), 'bad_plan');
    assert.strictEqual(pricing.FOUNDERS_CAP, 500);
    assert.strictEqual(pricing.applyDiscounts(999, [10], 'additive'), 899); // Family prepaid would be $8.99
});

// ---------- existing-user eligibility (Phil: verified BQ account, in app only)
test('eligibility: verified, non-anonymous, profile, created before cutoff, before Jan 1', async function () {
    const cfg = pricing.normalizeConfig({ checkoutLaunchedAtMs: LAUNCH });
    const base = { tokenVerified: true, provider: 'password', emailVerified: true, profileExists: true, banned: false, accountCreatedMs: OLD, nowMs: T0 };
    const why = function (patch, c) { return premium.existingUserEligible(Object.assign({}, base, patch), c || cfg).why; };
    assert.strictEqual(why({}), 'eligible');
    assert.strictEqual(why({ tokenVerified: false }), 'no_token');
    assert.strictEqual(why({ provider: 'anonymous' }), 'anonymous');
    assert.strictEqual(why({ emailVerified: false }), 'email_not_verified');
    assert.strictEqual(why({ profileExists: false }), 'no_profile');
    assert.strictEqual(why({ banned: true }), 'no_profile');
    assert.strictEqual(why({ accountCreatedMs: NEW }), 'new_account');
    assert.strictEqual(why({}, pricing.normalizeConfig({})), 'new_account'); // no cutoff configured = nobody
    assert.strictEqual(why({ nowMs: Date.parse('2027-01-01T05:00:00Z') }), 'ended');
});
test('in-app checkout applies 5% only for eligible accounts', async function () {
    const a = setup();
    assert.strictEqual((await a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old'))).amountCents, 4750);
    assert.strictEqual((await a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('new'))).amountCents, 5000);
    const b = setup();
    assert.strictEqual((await b.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old', { email_verified: false }))).amountCents, 5000);
    const c = setup();
    assert.strictEqual((await c.h.createPremiumCheckout({ plan: 'yearly', rail: 'lightning' }, ctx('old'))).amountCents, 4250);
    const st = await setup().h.getPremiumStatus({}, ctx('old'));
    assert.deepStrictEqual(st.existingUserOffer, { pct: 5, endsAtMs: Date.parse('2027-01-01T05:00:00Z') });
    assert.strictEqual((await setup().h.getPremiumStatus({}, ctx('new'))).existingUserOffer, null);
});

// ---------- fail closed
test('unknown project refuses; staging refuses live Stripe keys', async function () {
    const a = setup({ projectId: 'some-other-project' });
    await rejects(a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old')), 'unknown_project');
    const b = setup({ env: { STRIPE_SECRET_KEY: 'sk_' + 'live_' + 'y'.repeat(24) } });
    await rejects(b.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old')), 'stripe_key');
    assert.strictEqual(b.calls.length, 0);
    assert.strictEqual(premium.stripeKeyOk('sk_test_' + 'x'.repeat(24), 'live'), false);
    assert.strictEqual(premium.providerMode('bitcoin-education-archive'), 'live');
});
test('checkout closed by default; Lightning closed until lightningEnabled', async function () {
    await rejects(setup({ config: false }).h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old')), 'checkout_closed');
    const a = setup({ config: { lightningEnabled: false } });
    await rejects(a.h.createPremiumCheckout({ plan: 'yearly', rail: 'lightning' }, ctx('old')), 'lightning_closed');
    assert.strictEqual(a.calls.length, 0);
    const st = await a.h.getPremiumStatus({}, ctx('old'));
    assert.ok(st.offers.every(function (o) { return o.rail === 'card'; }));
});
test('signed out, anonymous, banned and minor accounts refused', async function () {
    const a = setup();
    await rejects(a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, {}), 'signed_out');
    await rejects(a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old', { firebase: { sign_in_provider: 'anonymous' } })), 'anonymous');
    a.db.store.set('users/kid', { ageBand: 'under13' });
    await rejects(a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('kid')), 'minor');
    a.db.store.set('users/bad', { banned: true });
    await rejects(a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('bad')), 'banned');
    assert.strictEqual(a.calls.length, 0);
});
test('missing BTCPay config refuses before holding a Founders seat', async function () {
    const a = setup({ env: { BTCPAY_URL: 'http://insecure.example' } });
    await rejects(a.h.createPremiumCheckout({ plan: 'founders', rail: 'lightning' }, ctx('old')), 'btcpay_config');
    assert.ok(!a.db.store.has('premium_counters/founders'));
});

// ---------- Stripe checkout + webhook
test('card checkout: server amount, client amount ignored, src tag in metadata', async function () {
    const a = setup();
    const out = await a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card', amountCents: 1, price: 1, src: 'YT-1217' }, ctx('old'));
    assert.strictEqual(out.amountCents, 4750);
    const body = bodyOf(a.calls[0]);
    assert.ok(body.indexOf('line_items[0][price_data][unit_amount]=4750') !== -1);
    assert.ok(body.indexOf('line_items[0][price_data][recurring][interval]=year') !== -1);
    assert.ok(body.indexOf('mode=subscription') !== -1);
    assert.ok(body.indexOf('metadata[src]=yt-1217') !== -1);
    assert.ok(body.indexOf('subscription_data[metadata][src]=yt-1217') !== -1);
    assert.ok(body.indexOf('trial_end') === -1);
    assert.ok(body.indexOf('success_url=https://bitcoin-quest-staging.web.app/') !== -1);
    assert.strictEqual(a.calls[0].init.headers['Idempotency-Key'], 'bq-checkout-' + out.orderId);
    assert.ok(/^Bearer sk_test_/.test(a.calls[0].init.headers.Authorization));
    const order = a.db.store.get('premium_orders/' + out.orderId);
    assert.strictEqual(order.uid, 'old');
    assert.strictEqual(order.src, 'yt-1217');
    assert.strictEqual(order.status, 'pending');
    assert.strictEqual(order.providerSessionId, 'cs_test_1');
    assert.strictEqual(premium.cleanSrc('<script>'), null);
    assert.strictEqual(premium.cleanSrc('yt-teaser'), 'yt-teaser');
});

async function stripePost(a, event, opts) {
    const o = opts || {};
    const t = Math.floor(a.clock.now / 1000) + (o.skew || 0);
    const s = stripeSigned(event, o.secret || FAKE_ENV.STRIPE_WEBHOOK_SECRET, t);
    const res = fakeRes();
    await a.h.stripeWebhook(req(o.tamper ? Buffer.from(s.raw.toString().replace('4750', '1')) : s.raw, { 'Stripe-Signature': s.header }), res);
    return res;
}
function completed(orderId, session, extra) {
    return {
        id: 'evt_' + crypto.randomBytes(4).toString('hex'),
        type: 'checkout.session.completed',
        livemode: false,
        data: { object: Object.assign({ id: session, client_reference_id: orderId, amount_total: 4750, currency: 'usd', mode: 'subscription', payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1' }, extra || {}) },
    };
}

test('Stripe webhook: bad, stale, tampered or wrong-secret signatures rejected', async function () {
    const a = setup();
    const out = await a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old'));
    const ev = completed(out.orderId, 'cs_test_1');
    assert.strictEqual((await stripePost(a, ev, { secret: 'whsec_wrong' })).code, 400);
    assert.strictEqual((await stripePost(a, ev, { skew: -301 })).code, 400);
    assert.strictEqual((await stripePost(a, ev, { tamper: true })).code, 400);
    const res = fakeRes();
    await a.h.stripeWebhook(req(Buffer.from(JSON.stringify(ev)), {}), res);
    assert.strictEqual(res.code, 400);
    assert.ok(!a.db.store.has('premium_entitlements/old'));
});

test('Stripe subscription: grant once, idempotent on replay, invoice.paid sets period, users mirror', async function () {
    const a = setup();
    const out = await a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old'));
    const ev = completed(out.orderId, 'cs_test_1');
    const r1 = await stripePost(a, ev);
    assert.strictEqual(r1.code, 200);
    assert.strictEqual(r1.body.outcome, 'granted');
    assert.strictEqual((await stripePost(a, ev)).body.outcome, 'duplicate');
    let ent = a.db.store.get('premium_entitlements/old');
    assert.strictEqual(ent.active, true);
    assert.strictEqual(ent.stripeCustomerId, 'cus_1');
    assert.strictEqual(ent.autoRenew, true);
    const periodEnd = Math.floor(Date.parse('2027-11-20T15:00:00Z') / 1000);
    const inv = { id: 'evt_inv1', type: 'invoice.paid', livemode: false, data: { object: { id: 'in_1', currency: 'usd', amount_paid: 4750, customer: 'cus_1', parent: { subscription_details: { subscription: 'sub_1', metadata: { orderId: out.orderId } } }, lines: { data: [{ period: { end: periodEnd } }] } } } };
    assert.strictEqual((await stripePost(a, inv)).body.outcome, 'granted');
    ent = a.db.store.get('premium_entitlements/old');
    assert.strictEqual(ent.subscriptionUntilMs, periodEnd * 1000 + 3 * 86400000);
    assert.strictEqual(a.db.store.get('users/old').premium.active, true);
    assert.strictEqual(a.db.store.get('users/old').displayName, 'Old');
    const upd = { id: 'evt_upd', type: 'customer.subscription.updated', livemode: false, data: { object: { id: 'sub_1', status: 'active', cancel_at_period_end: true, metadata: { orderId: out.orderId } } } };
    assert.strictEqual((await stripePost(a, upd)).body.outcome, 'not_renewing');
    ent = a.db.store.get('premium_entitlements/old');
    assert.strictEqual(ent.active, true);
    assert.strictEqual(ent.autoRenew, false);
});

test('Stripe: livemode event refused on staging; amount or session mismatch goes to review', async function () {
    const a = setup();
    const out = await a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old'));
    const live = completed(out.orderId, 'cs_test_1');
    live.livemode = true;
    assert.strictEqual((await stripePost(a, live)).code, 400);
    assert.strictEqual((await stripePost(a, completed(out.orderId, 'cs_test_1', { amount_total: 100 }))).body.outcome, 'review');
    assert.ok(!a.db.store.has('premium_entitlements/old'));
    const b = setup();
    const o2 = await b.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old'));
    assert.strictEqual((await stripePost(b, completed(o2.orderId, 'cs_test_OTHER'))).body.outcome, 'review');
    assert.ok(!b.db.store.has('premium_entitlements/old'));
});

test('already subscribed / lifetime refused; portal needs a Stripe customer', async function () {
    const a = setup();
    await rejects(a.h.createPremiumPortal({}, ctx('old')), 'no_customer');
    const out = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('old'));
    await stripePost(a, completed(out.orderId, 'cs_test_1', { amount_total: 475 }));
    await rejects(a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old')), 'already_subscribed');
    await rejects(a.h.createPremiumCheckout({ plan: 'yearly', rail: 'lightning' }, ctx('old')), 'subscription_renewing');
    assert.strictEqual((await a.h.createPremiumPortal({}, ctx('old'))).url, 'https://billing.stripe.test/p');
    assert.ok(bodyOf(a.calls[a.calls.length - 1]).indexOf('customer=cus_1') !== -1);
});

test('provider error releases the order and the Founders hold', async function () {
    const a = setup({ providerDown: true });
    await rejects(a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old')), 'provider_error');
    assert.strictEqual(Object.keys(a.db.store.get('premium_counters/founders').holds).length, 0);
    const orders = Array.from(a.db.store.entries()).filter(function (e) { return e[0].indexOf('premium_orders/') === 0; });
    assert.strictEqual(orders[0][1].status, 'error');
});

test('rate limit: 6 in-app checkouts per hour per account', async function () {
    const a = setup();
    for (let i = 0; i < 6; i++) await a.h.createPremiumCheckout({ plan: 'months', rail: 'lightning', months: 1 }, ctx('new'));
    await rejects(a.h.createPremiumCheckout({ plan: 'months', rail: 'lightning', months: 1 }, ctx('new')), 'rate_limited');
    a.clock.now += 3600001;
    await a.h.createPremiumCheckout({ plan: 'months', rail: 'lightning', months: 1 }, ctx('new'));
});

// ---------- trials + billingStartsAt
test('7-day trial (flag off): no charge today, trial_end = now + 7d, access now, trial used once', async function () {
    const a = setup({ config: { trialDays: 7 } });
    const out = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('new'));
    const body = bodyOf(a.calls[0]);
    const trialEnd = T0 + 7 * 86400000;
    assert.ok(body.indexOf('subscription_data[trial_end]=' + Math.floor(trialEnd / 1000)) !== -1);
    assert.ok(body.indexOf('custom_text[submit][message]=You will not be charged today. Your first charge is on Nov 27, 2026.') !== -1);
    assert.strictEqual(a.db.store.get('premium_orders/' + out.orderId).expectedTotalCents, 0);
    const r = await stripePost(a, completed(out.orderId, 'cs_test_1', { amount_total: 0, payment_status: 'no_payment_required' }));
    assert.strictEqual(r.body.outcome, 'granted');
    const ent = a.db.store.get('premium_entitlements/new');
    assert.strictEqual(ent.active, true);
    assert.strictEqual(ent.trialUsed, true);
    assert.strictEqual(ent.trialUntilMs, trialEnd);
    assert.strictEqual(ent.startsAtMs, null);
    const st = await a.h.getPremiumStatus({}, ctx('new'));
    assert.strictEqual(st.inTrial, true);
    // A paid-zero session for a non-trial order is refused.
    const b = setup();
    const o2 = await b.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('new'));
    assert.strictEqual((await stripePost(b, completed(o2.orderId, 'cs_test_1', { amount_total: 0, payment_status: 'no_payment_required' }))).body.outcome, 'review');
});

test('billingStartsAt set: subscriptions bill from Jan 3 (+7 day trial), entitlements start Jan 3', async function () {
    const a = setup({ config: { trialDays: 7, billingStartsAt: '2027-01-03T00:00:00-05:00' } });
    const out = await a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('new'));
    const body = bodyOf(a.calls[0]);
    const trialEnd = JAN3 + 7 * 86400000;
    assert.ok(body.indexOf('subscription_data[trial_end]=' + Math.floor(trialEnd / 1000)) !== -1);
    assert.ok(body.indexOf('Premium perks unlock with Citadel Spark on Jan 3, 2027. You will not be charged today. Your first charge is on Jan 10, 2027.') !== -1);
    await stripePost(a, completed(out.orderId, 'cs_test_1', { amount_total: 0, payment_status: 'no_payment_required' }));
    let ent = a.db.store.get('premium_entitlements/new');
    assert.strictEqual(ent.startsAtMs, JAN3);
    assert.strictEqual(ent.active, false);
    assert.strictEqual(ent.pendingStart, true);
    assert.strictEqual(a.db.store.get('users/new').premium.active, false);
    a.clock.now = JAN3 + 60000;
    const sw = await a.h.sweepExpired(100);
    assert.strictEqual(sw.flipped, 1);
    ent = a.db.store.get('premium_entitlements/new');
    assert.strictEqual(ent.active, true);
    assert.strictEqual(ent.pendingStart, false);
    assert.strictEqual(a.db.store.get('users/new').premium.active, true);
    // Trial already used: second account-holder subscription bills on Jan 3 exactly.
    const b = setup({ config: { trialDays: 7, billingStartsAt: '2027-01-03T00:00:00-05:00' } });
    b.db.store.set('premium_entitlements/new', { trialUsed: true });
    await b.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('new'));
    assert.ok(bodyOf(b.calls[0]).indexOf('subscription_data[trial_end]=' + Math.floor(JAN3 / 1000)) !== -1);
    assert.ok(bodyOf(b.calls[0]).indexOf('Your first charge is on Jan 3, 2027.') !== -1);
});

test('billingStartsAt set: Founders charged now, seat reserved now, perks start Jan 3', async function () {
    const a = setup({ config: { trialDays: 7, billingStartsAt: '2027-01-03T00:00:00-05:00' } });
    const out = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('new'));
    const body = bodyOf(a.calls[0]);
    assert.ok(body.indexOf('mode=payment') !== -1);
    assert.ok(body.indexOf('trial_end') === -1);
    assert.ok(body.indexOf("You're charged today and your Founders' seat is reserved now.") !== -1);
    const r = await stripePost(a, completed(out.orderId, 'cs_test_1', { amount_total: 15000, mode: 'payment', subscription: null }));
    assert.strictEqual(r.body.outcome, 'granted');
    assert.strictEqual(a.db.store.get('premium_counters/founders').sold, 1);
    const ent = a.db.store.get('premium_entitlements/new');
    assert.strictEqual(ent.founders, true);
    assert.strictEqual(ent.active, false);
    assert.strictEqual(ent.startsAtMs, JAN3);
});

test('billingStartsAt set: prepaid Lightning months count from Jan 3', async function () {
    const a = setup({ config: { billingStartsAt: '2027-01-03T00:00:00-05:00' } });
    const o = await a.h.createPremiumCheckout({ plan: 'months', rail: 'lightning', months: 1 }, ctx('new'));
    const inv = a.db.store.get('premium_orders/' + o.orderId).providerInvoiceId;
    a.btcInvoices[inv].status = 'Settled';
    await btcPost(a, { type: 'InvoiceSettled', invoiceId: inv, storeId: 'StoreABC12345' });
    const ent = a.db.store.get('premium_entitlements/new');
    assert.strictEqual(ent.prepaidUntilMs, Date.parse('2027-02-03T05:00:00.000Z'));
    assert.strictEqual(ent.active, false);
    assert.strictEqual(ent.startsAtMs, JAN3);
});

// ---------- Founders cap
test('Founders: exactly 500 seats, one open hold per account, holds expire, sold out refuses', async function () {
    const a = setup();
    a.db.store.set('premium_counters/founders', { sold: 498, holds: {} });
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    await rejects(a.h.createPremiumCheckout({ plan: 'founders', rail: 'lightning' }, ctx('old')), 'hold_exists');
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'lightning' }, ctx('new'));
    a.db.store.set('users/third', {});
    await rejects(a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('third')), 'founders_sold_out');
    a.clock.now += 40 * 60000;
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('third'));
    assert.strictEqual((await a.h.getPremiumStatus({}, ctx('third'))).foundersLeft, 1);
});

test('Founders paid: seat sold, lifetime granted; late payment past the cap goes to review', async function () {
    const a = setup();
    a.db.store.set('premium_counters/founders', { sold: 499, holds: {} });
    const o1 = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    assert.strictEqual((await stripePost(a, completed(o1.orderId, 'cs_test_1', { amount_total: 14250, mode: 'payment', subscription: null }))).body.outcome, 'granted');
    assert.strictEqual(a.db.store.get('premium_counters/founders').sold, 500);
    const ent = a.db.store.get('premium_entitlements/old');
    assert.strictEqual(ent.founders, true);
    assert.strictEqual(ent.expiresAtMs, null);
    assert.strictEqual(ent.foundersSeat, 500);
    await rejects(a.h.createPremiumCheckout({ plan: 'yearly', rail: 'lightning' }, ctx('old')), 'already_lifetime');

    const b = setup();
    b.db.store.set('premium_counters/founders', { sold: 499, holds: {} });
    const o2 = await b.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('new'));
    b.clock.now += 40 * 60000;
    b.db.store.set('premium_counters/founders', { sold: 500, holds: {} });
    assert.strictEqual((await stripePost(b, completed(o2.orderId, 'cs_test_1', { amount_total: 15000, mode: 'payment', subscription: null }))).body.outcome, 'review');
    assert.strictEqual(b.db.store.get('premium_counters/founders').sold, 500);
    assert.ok(!b.db.store.has('premium_entitlements/new'));
});

test('checkout.session.expired releases the Founders hold', async function () {
    const a = setup();
    const o = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    assert.strictEqual(Object.keys(a.db.store.get('premium_counters/founders').holds).length, 1);
    const ev = { id: 'evt_exp', type: 'checkout.session.expired', livemode: false, data: { object: { id: 'cs_test_1', client_reference_id: o.orderId } } };
    assert.strictEqual((await stripePost(a, ev)).code, 200);
    assert.strictEqual(Object.keys(a.db.store.get('premium_counters/founders').holds).length, 0);
    assert.strictEqual(a.db.store.get('premium_orders/' + o.orderId).status, 'expired');
});

test('Founders counter never exceeds 500 with 520 buyers', async function () {
    const a = setup();
    let sold = 0;
    for (let i = 0; i < 520; i++) {
        const uid = 'u' + i;
        a.db.store.set('users/' + uid, {});
        try {
            const o = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx(uid));
            const sid = a.db.store.get('premium_orders/' + o.orderId).providerSessionId;
            const r = await stripePost(a, completed(o.orderId, sid, { amount_total: o.amountCents, mode: 'payment', subscription: null }));
            if (r.body.outcome === 'granted') sold++;
        } catch (e) { assert.strictEqual(e.details.reason, 'founders_sold_out'); }
    }
    assert.strictEqual(sold, 500);
    assert.strictEqual(a.db.store.get('premium_counters/founders').sold, 500);
});

// ---------- public /premium checkout
async function publicPost(a, body, origin, ip) {
    const res = fakeRes();
    await a.h.premiumPublicCheckout(req(null, { Origin: origin || 'https://preview1.bitcoin-quest.pages.dev' }, { body: body, ip: ip || '203.0.113.9' }), res);
    return res;
}
test('public checkout: full price only, src carried, email locked, CORS + Turnstile enforced', async function () {
    const a = setup();
    const res = await publicPost(a, { plan: 'yearly', rail: 'card', email: 'Old@Example.com', src: 'yt-teaser', turnstileToken: 'ok-token' });
    assert.strictEqual(res.code, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.amountCents, 5000); // an existing player's email still pays full price here
    const body = bodyOf(a.calls[0]);
    assert.ok(body.indexOf('customer_email=old@example.com') !== -1);
    assert.ok(body.indexOf('metadata[src]=yt-teaser') !== -1);
    assert.ok(body.indexOf('success_url=https://bitcoin-quest-staging.web.app/premium?premium=success') !== -1);
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://preview1.bitcoin-quest.pages.dev');
    assert.strictEqual((await publicPost(a, { plan: 'yearly', rail: 'card', email: 'x@example.com', turnstileToken: 'ok-token' }, 'https://evil.example')).code, 403);
    assert.strictEqual((await publicPost(a, { plan: 'yearly', rail: 'card', email: 'x@example.com', turnstileToken: 'bad' })).body.reason, 'turnstile');
    assert.strictEqual((await publicPost(a, { plan: 'yearly', rail: 'card', email: 'nope', turnstileToken: 'ok-token' })).body.reason, 'bad_email');
    const live = setup({ projectId: 'bitcoin-education-archive', env: { STRIPE_SECRET_KEY: 'sk_' + 'live_' + 'z'.repeat(24) } });
    assert.strictEqual((await publicPost(live, { plan: 'yearly', rail: 'card', email: 'x@example.com', turnstileToken: 'ok-token' })).code, 403);
    const pre = fakeRes();
    await a.h.premiumPublicCheckout(req(null, { Origin: 'https://bitcoin-quest-staging.web.app' }, { method: 'OPTIONS' }), pre);
    assert.strictEqual(pre.code, 204);
});
test('public checkout: per-IP limit; paid order held by email until a verified account claims it', async function () {
    const a = setup();
    for (let i = 0; i < 10; i++) assert.strictEqual((await publicPost(a, { plan: 'monthly', rail: 'card', email: 'buyer@example.com', turnstileToken: 'ok-token' }, null, '198.51.100.1')).code, 200);
    assert.strictEqual((await publicPost(a, { plan: 'monthly', rail: 'card', email: 'buyer@example.com', turnstileToken: 'ok-token' }, null, '198.51.100.1')).code, 429);
    const b = setup();
    const r = await publicPost(b, { plan: 'monthly', rail: 'card', email: 'buyer@example.com', src: 'yt-1217', turnstileToken: 'ok-token' });
    const order = Array.from(b.db.store.entries()).find(function (e) { return e[0].indexOf('premium_orders/') === 0; });
    const orderId = order[0].split('/')[1];
    assert.strictEqual(order[1].uid, null);
    assert.strictEqual(order[1].src, 'yt-1217');
    assert.strictEqual((await stripePost(b, completed(orderId, order[1].providerSessionId, { amount_total: r.body.amountCents }))).body.outcome, 'granted');
    const ek = premium.emailKey('buyer@example.com');
    assert.strictEqual(b.db.store.get('premium_email_entitlements/' + ek).active, true);
    b.db.store.set('users/buyer', {});
    await rejects(b.h.claimPremiumByEmail({}, ctx('buyer', { email: 'buyer@example.com', email_verified: false })), 'email_not_verified');
    const c = await b.h.claimPremiumByEmail({}, ctx('buyer', { email: 'BUYER@example.com' }));
    assert.strictEqual(c.claimed, true);
    assert.strictEqual(c.active, true);
    assert.strictEqual(b.db.store.get('premium_entitlements/buyer').stripeSubscriptionId, 'sub_1');
    assert.strictEqual(b.db.store.get('users/buyer').premium.active, true);
    await rejects(b.h.claimPremiumByEmail({}, ctx('other', { email: 'buyer@example.com' })), 'claimed_elsewhere');
    // Renewal after the claim lands on the claiming account.
    const periodEnd = Math.floor(Date.parse('2027-01-20T15:00:00Z') / 1000);
    const inv = { id: 'evt_inv9', type: 'invoice.paid', livemode: false, data: { object: { id: 'in_9', currency: 'usd', amount_paid: 500, customer: 'cus_1', parent: { subscription_details: { subscription: 'sub_1', metadata: { orderId: orderId } } }, lines: { data: [{ period: { end: periodEnd } }] } } } };
    assert.strictEqual((await stripePost(b, inv)).body.outcome, 'granted');
    assert.strictEqual(b.db.store.get('premium_entitlements/buyer').subscriptionUntilMs, periodEnd * 1000 + 3 * 86400000);
});

// ---------- BTCPay
async function btcPost(a, body, opts) {
    const o = opts || {};
    const raw = Buffer.from(JSON.stringify(body));
    const sig = 'sha256=' + crypto.createHmac('sha256', o.secret || FAKE_ENV.BTCPAY_WEBHOOK_SECRET).update(raw).digest('hex');
    const res = fakeRes();
    await a.h.btcpayWebhook(req(raw, { 'BTCPay-Sig': sig }), res);
    return res;
}

test('BTCPay yearly: HMAC checked, invoice re-read, 12 months granted once', async function () {
    const a = setup();
    const o = await a.h.createPremiumCheckout({ plan: 'yearly', rail: 'lightning', src: 'yt-1217' }, ctx('old'));
    assert.strictEqual(o.amountCents, 4250);
    const post = JSON.parse(a.calls[0].init.body);
    assert.strictEqual(post.amount, '42.50');
    assert.strictEqual(post.currency, 'USD');
    assert.strictEqual(post.metadata.src, 'yt-1217');
    assert.strictEqual(a.calls[0].init.headers.Authorization, 'token fake-btcpay-key');
    const invId = a.db.store.get('premium_orders/' + o.orderId).providerInvoiceId;
    const body = { type: 'InvoiceSettled', invoiceId: invId, storeId: 'StoreABC12345', deliveryId: 'd1' };
    assert.strictEqual((await btcPost(a, body)).body.outcome, 'not_settled');
    assert.ok(!a.db.store.has('premium_events/btcpay_' + invId + '_InvoiceSettled')); // retry stays possible
    a.btcInvoices[invId].status = 'Settled';
    assert.strictEqual((await btcPost(a, body, { secret: 'wrong' })).code, 400);
    assert.strictEqual((await btcPost(a, body)).body.outcome, 'granted');
    assert.strictEqual((await btcPost(a, body)).body.outcome, 'duplicate');
    const ent = a.db.store.get('premium_entitlements/old');
    assert.strictEqual(ent.prepaidUntilMs, Date.parse('2027-11-20T15:00:00.000Z'));
    assert.strictEqual(ent.active, true);
});

test('BTCPay: wrong store, forged invoice, underpaid amount refused', async function () {
    const a = setup();
    const o = await a.h.createPremiumCheckout({ plan: 'months', rail: 'lightning', months: 2 }, ctx('new'));
    assert.strictEqual(o.amountCents, 900);
    const invId = a.db.store.get('premium_orders/' + o.orderId).providerInvoiceId;
    assert.strictEqual((await btcPost(a, { type: 'InvoiceSettled', invoiceId: invId, storeId: 'OtherStore999' })).code, 400);
    a.btcInvoices[invId].status = 'Settled';
    a.btcInvoices[invId].amount = '1.00';
    assert.strictEqual((await btcPost(a, { type: 'InvoiceSettled', invoiceId: invId, storeId: 'StoreABC12345' })).body.outcome, 'review');
    assert.ok(!a.db.store.has('premium_entitlements/new'));
    a.btcInvoices.Forged000001 = { id: 'Forged000001', status: 'Settled', amount: '9.00', currency: 'USD', metadata: { orderId: o.orderId } };
    assert.strictEqual((await btcPost(a, { type: 'InvoiceSettled', invoiceId: 'Forged000001', storeId: 'StoreABC12345' })).body.outcome, 'review');
    assert.ok(!a.db.store.has('premium_entitlements/new'));
});

test('BTCPay prepaid months stack; expired invoice frees Founders hold', async function () {
    const a = setup();
    const o1 = await a.h.createPremiumCheckout({ plan: 'months', rail: 'lightning', months: 1 }, ctx('new'));
    const i1 = a.db.store.get('premium_orders/' + o1.orderId).providerInvoiceId;
    a.btcInvoices[i1].status = 'Settled';
    await btcPost(a, { type: 'InvoiceSettled', invoiceId: i1, storeId: 'StoreABC12345' });
    const o2 = await a.h.createPremiumCheckout({ plan: 'months', rail: 'lightning', months: 2 }, ctx('new'));
    const i2 = a.db.store.get('premium_orders/' + o2.orderId).providerInvoiceId;
    a.btcInvoices[i2].status = 'Settled';
    await btcPost(a, { type: 'InvoiceSettled', invoiceId: i2, storeId: 'StoreABC12345' });
    assert.strictEqual(a.db.store.get('premium_entitlements/new').prepaidUntilMs, Date.parse('2027-02-20T15:00:00.000Z'));
    const f = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'lightning' }, ctx('old'));
    const fi = a.db.store.get('premium_orders/' + f.orderId).providerInvoiceId;
    await btcPost(a, { type: 'InvoiceExpired', invoiceId: fi, storeId: 'StoreABC12345', metadata: { orderId: f.orderId } });
    assert.strictEqual(Object.keys(a.db.store.get('premium_counters/founders').holds).length, 0);
});

// ---------- entitlement + sweep + allowance
test('expiry sweep flips active off when paid time runs out; lifetime never expires', async function () {
    const a = setup();
    a.db.store.set('premium_entitlements/old', { prepaidUntilMs: T0 - 1, active: true, expiresAtMs: T0 - 1 });
    a.db.store.set('premium_entitlements/new', { founders: true, active: true, expiresAtMs: null });
    a.db.store.set('users/old', { premium: { active: true } });
    assert.strictEqual((await a.h.sweepExpired(100)).flipped, 1);
    assert.strictEqual(a.db.store.get('premium_entitlements/old').active, false);
    assert.strictEqual(a.db.store.get('users/old').premium.active, false);
    assert.strictEqual(a.db.store.get('premium_entitlements/new').active, true);
    assert.strictEqual(premium.isPremiumActive({ subscriptionUntilMs: T0 + 1 }, T0), true);
    assert.strictEqual(premium.isPremiumActive({ subscriptionUntilMs: T0 }, T0), false);
    assert.strictEqual(premium.isPremiumActive({ founders: true, startsAtMs: JAN3 }, T0), false);
    assert.strictEqual(premium.isPremiumActive({ founders: true, startsAtMs: JAN3 }, JAN3), true);
});

test('allowance: 50 cosmetic credits per ET month, Premium only, once', async function () {
    const a = setup();
    await rejects(a.h.claimPremiumAllowance({}, ctx('old')), 'not_premium');
    a.db.store.set('premium_entitlements/old', { prepaidUntilMs: T0 + 86400000 * 40 });
    assert.strictEqual((await a.h.claimPremiumAllowance({}, ctx('old'))).granted, 50);
    const r2 = await a.h.claimPremiumAllowance({}, ctx('old'));
    assert.strictEqual(r2.granted, 0);
    assert.strictEqual(r2.cosmeticCredits, 50);
    a.clock.now = Date.parse('2026-12-01T05:00:00.000Z');
    const r3 = await a.h.claimPremiumAllowance({}, ctx('old'));
    assert.strictEqual(r3.granted, 50);
    assert.strictEqual(r3.cosmeticCredits, 100);
    assert.strictEqual(premium.etMonthKey(Date.parse('2026-12-01T04:59:00.000Z')), '2026-11');
});

test('allowance is cosmetic-only: the module never touches sats, points, tickets or raffles', async function () {
    const src = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'src', 'premium.js'), 'utf8');
    ['satsBalance', 'cipherSatsBalance', "'points'", 'orangeTickets', 'raffleEntries', 'payInvoice', 'NWC_URL', 'nwcUrl'].forEach(function (w) {
        assert.strictEqual(src.indexOf(w), -1, w);
    });
});

test('helpers: usdToCents, signatures, form encoding, email', async function () {
    assert.strictEqual(premium.usdToCents('42.5'), 4250);
    assert.strictEqual(premium.usdToCents('42.505'), 4251);
    assert.strictEqual(premium.usdToCents('-1'), null);
    assert.strictEqual(premium.usdToCents('1e3'), null);
    assert.strictEqual(premium.verifyBtcpaySignature(Buffer.from('x'), 'sha256=00', 's').ok, false);
    assert.strictEqual(premium.verifyStripeSignature(Buffer.from('x'), 't=1,v1=zz', '', 1).ok, false);
    assert.strictEqual(premium.stripeForm({ a: { b: [{ c: 'd e' }] } }), 'a%5Bb%5D%5B0%5D%5Bc%5D=d%20e');
    assert.strictEqual(premium.normalizeEmail(' A@B.co '), 'a@b.co');
    assert.strictEqual(premium.normalizeEmail('a@b'), null);
});

(async function () {
    for (const t of queue) {
        try { await t.fn(); passed++; console.log('✅ ' + t.name); }
        catch (e) { failed++; console.log('❌ ' + t.name + ': ' + (e && e.stack || e)); }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
