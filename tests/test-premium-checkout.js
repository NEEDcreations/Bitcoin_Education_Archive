#!/usr/bin/env node
'use strict';
// Premium checkout: prices, discounts, existing-user eligibility, Founders cap,
// webhook signatures, idempotency, BTCPay re-read, entitlements, trials,
// charge-at-purchase + Jan 3 perks, no-refund terms, kill switch, public /premium checkout, allowance and fail-closed checks.
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
            delete: async function () { store.delete(p); },
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
                        if (f[1] === '>=') return x >= f[2];
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
    PREMIUM_HASH_KEY: 'fake-premium-hash-key-0123456789',
};

function setup(opts) {
    const o = opts || {};
    const db = makeDb();
    const clock = { now: o.now || T0 };
    const calls = [];
    const btcInvoices = {};
    const a_ts = [];
    let idn = 0;
    const fetchMock = async function (url, init) {
        calls.push({ url: url, init: init });
        if (o.providerDown) return { ok: false, status: 503, json: async function () { return {}; } };
        const exm = url.match(/^https:\/\/api\.stripe\.com\/v1\/checkout\/sessions\/([A-Za-z0-9_]+)\/expire$/);
        if (exm && init.method === 'POST') {
            if (o.expireFail) return { ok: false, status: 500, json: async function () { return { error: { code: 'api_error' } }; } };
            return { ok: true, status: 200, json: async function () { return { id: exm[1], status: 'expired' }; } };
        }
        const ivm = url.match(/^https:\/\/api\.stripe\.com\/v1\/invoices\/([A-Za-z0-9_]+)$/);
        if (ivm && init.method === 'GET') {
            const iv = o.invoices && o.invoices[ivm[1]];
            return iv ? { ok: true, status: 200, json: async function () { return clone(iv); } } : { ok: false, status: 404, json: async function () { return { error: { code: 'resource_missing' } }; } };
        }
        const sbm = url.match(/^https:\/\/api\.stripe\.com\/v1\/subscriptions\/([A-Za-z0-9_]+)$/);
        if (sbm && init.method === 'GET') {
            const sb = o.subs && o.subs[sbm[1]];
            return sb ? { ok: true, status: 200, json: async function () { return clone(sb); } } : { ok: false, status: 404, json: async function () { return {}; } };
        }
        const ssm = url.match(/^https:\/\/api\.stripe\.com\/v1\/checkout\/sessions\?limit=1&subscription=([A-Za-z0-9_]+)$/);
        if (ssm && init.method === 'GET') {
            const ss = o.subSessions && o.subSessions[ssm[1]];
            return { ok: true, status: 200, json: async function () { return { data: ss ? [clone(ss)] : [] }; } };
        }
        const ipm = url.match(/^https:\/\/api\.stripe\.com\/v1\/invoice_payments\?limit=1&payment\[type\]=payment_intent&payment\[payment_intent\]=([A-Za-z0-9_]+)$/);
        if (ipm && init.method === 'GET') {
            const inv = o.invoicePayments && o.invoicePayments[ipm[1]];
            return { ok: true, status: 200, json: async function () { return { data: inv ? [{ invoice: inv }] : [] }; } };
        }
        if (url.indexOf('https://api.stripe.com/v1/checkout/sessions') === 0 && init.method === 'POST') {
            return { ok: true, status: 200, json: async function () { return { id: 'cs_test_' + (++idn), url: 'https://checkout.stripe.test/' + idn }; } };
        }
        const sm = url.match(/^https:\/\/api\.stripe\.com\/v1\/checkout\/sessions\/([A-Za-z0-9_]+)\?/);
        if (sm && init.method === 'GET') {
            let fp;
            if (o.cardFp && Object.prototype.hasOwnProperty.call(o.cardFp, sm[1])) fp = o.cardFp[sm[1]];
            else fp = o.defaultCardFp || 'fp_default_card';
            const pm = (fp == null) ? { card: {} } : { card: { fingerprint: fp } };
            return { ok: true, status: 200, json: async function () { return { id: sm[1], payment_intent: { payment_method: pm }, setup_intent: null, subscription: { default_payment_method: pm } }; } };
        }
        const subDel = url.match(/^https:\/\/api\.stripe\.com\/v1\/subscriptions\/([A-Za-z0-9_]+)$/);
        if (subDel && init.method === 'DELETE') {
            if (o.cancelSubFail) return { ok: false, status: 500, json: async function () { return { error: { code: 'cancel_failed' } }; } };
            return { ok: true, status: 200, json: async function () { return { id: subDel[1], status: 'canceled' }; } };
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
        const pm = url.match(/\/api\/v1\/stores\/StoreABC12345\/invoices\/([A-Za-z0-9]+)\/payment-methods$/);
        if (pm && init.method === 'GET') {
            const method = (o.btcMethod && o.btcMethod[pm[1]]) || 'BTC-LN';
            return { ok: true, status: 200, json: async function () { return [{ paymentMethodId: method, payments: [{ id: 'p1', value: '0.0001', status: 'Settled' }] }, { paymentMethodId: method === 'BTC-LN' ? 'BTC-CHAIN' : 'BTC-LN', payments: [] }]; } };
        }
        if (m && init.method === 'GET') {
            const inv = btcInvoices[m[1]];
            return inv ? { ok: true, status: 200, json: async function () { return clone(inv); } } : { ok: false, status: 404, json: async function () { return {}; } };
        }
        const chm = url.match(/^https:\/\/api\.stripe\.com\/v1\/charges\/([A-Za-z0-9_]+)$/);
        if (chm && init.method === 'GET') {
            const ch = o.charges && o.charges[chm[1]];
            return ch ? { ok: true, status: 200, json: async function () { return clone(ch); } } : { ok: false, status: 404, json: async function () { return {}; } };
        }
        const slm = url.match(/^https:\/\/api\.stripe\.com\/v1\/checkout\/sessions\?limit=1&payment_intent=([A-Za-z0-9_]+)$/);
        if (slm && init.method === 'GET') {
            const ss = o.piSessions && o.piSessions[slm[1]];
            return { ok: true, status: 200, json: async function () { return { data: ss ? [clone(ss)] : [] }; } };
        }
        throw new Error('unexpected fetch ' + url);
    };
    const created = Object.assign({ old: OLD, new: NEW }, o.created || {});
    const envObj = Object.assign({}, FAKE_ENV, o.env || {});
    const h0 = premium.createPremiumHandlers({
        db: db,
        HttpsError: HttpsError,
        now: function () { return clock.now; },
        env: envObj,
        fetch: fetchMock,
        projectId: o.projectId || 'bitcoin-quest-staging',
        getAuthUser: async function (uid) { return { metadata: { creationTime: new Date(created[uid] || OLD).toUTCString() } }; },
        verifyTurnstile: async function (token, remoteip) {
            a_ts.push({ token: token, remoteip: remoteip });
            if (token === 'ok-token') return { success: true, hostname: o.tsHost || 'bitcoin-quest-staging.web.app', action: o.tsAction || 'premium_checkout' };
            return { success: false, hostname: null, action: null };
        },
        stepUp: o.stepUp || async function () { return true; },
        isOffline: o.isOffline || async function () { return false; },
    });
    // Every buyer in these tests has ticked the final-sale box unless the
    // test says otherwise (acceptNoRefunds present in the payload).
    function ack(d) { return d && typeof d === 'object' && !Object.prototype.hasOwnProperty.call(d, 'acceptNoRefunds') ? Object.assign({ acceptNoRefunds: true }, d) : d; }
    const h = Object.assign({}, h0, {
        raw: h0,
        createPremiumCheckout: function (d, c) { return h0.createPremiumCheckout(ack(d), c); },
        publicCheckout: function (b, ip, base) { return h0.publicCheckout(ack(b), ip, base); },
        premiumPublicCheckout: function (rq, rs) {
            if (rq && rq.body && typeof rq.body === 'object') rq.body = ack(rq.body);
            else if (rq && typeof rq.body === 'string') { try { rq.body = JSON.stringify(ack(JSON.parse(rq.body))); } catch (e) { /* bad json test */ } }
            return h0.premiumPublicCheckout(rq, rs);
        },
    });
    if (o.config !== false) {
        db.store.set('premium_config/settings', Object.assign({ checkoutEnabled: true, lightningEnabled: true, btcpayHost: 'btcpay.example.test', checkoutLaunchedAtMs: LAUNCH, trialDays: 0 }, o.config || {}));
    }
    db.store.set('users/old', { displayName: 'Old' });
    db.store.set('users/new', { displayName: 'New' });
    return { db: db, h: h, clock: clock, calls: calls, btcInvoices: btcInvoices, ts: a_ts, env: envObj };
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
test('bad config never raises a discount or grants a trial; perksStartAt defaults to Jan 3 00:00 ET', async function () {
    const wild = pricing.normalizeConfig({ btcDiscountPct: 90, existingUserDiscountPct: -5, stackMode: 'x', checkoutEnabled: 'yes', lightningEnabled: 1, trialDays: 30 });
    assert.strictEqual(wild.btcDiscountPct, 10);
    assert.strictEqual(wild.existingUserDiscountPct, 5);
    assert.strictEqual(wild.stackMode, 'additive');
    assert.strictEqual(wild.checkoutEnabled, false);
    assert.strictEqual(wild.lightningEnabled, false);
    assert.strictEqual(wild.trialDays, 0);
    // Fail-closed trial flag: only trialsEnabled === true with trialDays 1..14.
    assert.strictEqual(pricing.DEFAULT_CONFIG.trialsEnabled, false);
    assert.strictEqual(pricing.normalizeConfig({}).trialDays, 0);
    assert.strictEqual(pricing.normalizeConfig({ trialDays: 7 }).trialDays, 0);
    assert.strictEqual(pricing.normalizeConfig({ trialsEnabled: 'true', trialDays: 7 }).trialDays, 0);
    assert.strictEqual(pricing.normalizeConfig({ trialsEnabled: 1, trialDays: 7 }).trialsEnabled, false);
    assert.strictEqual(pricing.normalizeConfig({ trialsEnabled: true }).trialDays, 0);
    assert.strictEqual(pricing.normalizeConfig({ trialsEnabled: true, trialDays: 30 }).trialDays, 0);
    assert.strictEqual(pricing.normalizeConfig({ trialsEnabled: true, trialDays: 7 }).trialDays, 7);
    // Old deferred-billing flag is ignored; perks start defaults to Jan 3 00:00 ET.
    assert.strictEqual(pricing.normalizeConfig({ billingStartsAt: '2027-01-03T00:00:00-05:00' }).billingStartsAtMs, undefined);
    assert.strictEqual(pricing.PERKS_START_MS, JAN3);
    assert.strictEqual(pricing.normalizeConfig({}).perksStartAtMs, JAN3);
    assert.strictEqual(pricing.normalizeConfig({ perksStartAt: 'garbage' }).perksStartAtMs, JAN3);
    assert.strictEqual(pricing.normalizeConfig({ perksStartAt: '2027-01-10T00:00:00-05:00' }).perksStartAtMs, Date.parse('2027-01-10T05:00:00Z'));
    assert.strictEqual(pricing.DEFAULT_CONFIG.foundersRequireVerifiedEmail, true);
    assert.strictEqual(pricing.normalizeConfig({}).foundersRequireVerifiedEmail, true);
    assert.strictEqual(pricing.normalizeConfig({ foundersRequireVerifiedEmail: false }).foundersRequireVerifiedEmail, false);
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
    assert.ok(body.indexOf('payment_method_types[0]=card') !== -1);
    assert.ok(body.indexOf('payment_method_types[1]') === -1);
    assert.ok(body.indexOf('metadata[src]=yt-1217') !== -1);
    assert.ok(body.indexOf('subscription_data[metadata][src]=yt-1217') !== -1);
    assert.ok(body.indexOf('trial_end') === -1);
    assert.ok(body.indexOf('success_url=https://dev.bitcoineducation.quest/') !== -1);
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
    const a = setup({ config: { stripePortalConfigId: 'bpc_test123456' } });
    await rejects(a.h.createPremiumPortal({}, ctx('old')), 'no_customer');
    const out = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('old'));
    await stripePost(a, completed(out.orderId, 'cs_test_1', { amount_total: 475 }));
    await rejects(a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old')), 'already_subscribed');
    await rejects(a.h.createPremiumCheckout({ plan: 'yearly', rail: 'lightning' }, ctx('old')), 'subscription_renewing');
    assert.strictEqual((await a.h.createPremiumPortal({}, ctx('old'))).url, 'https://billing.stripe.test/p');
    assert.ok(bodyOf(a.calls[a.calls.length - 1]).indexOf('customer=cus_1') !== -1);
    // Always our own portal configuration (promotion codes off), never Stripe's default.
    assert.ok(bodyOf(a.calls[a.calls.length - 1]).indexOf('configuration=bpc_test123456') !== -1);
    const noCfg = setup();
    noCfg.db.store.set('premium_entitlements/old', { stripeCustomerId: 'cus_9' });
    await rejects(noCfg.h.createPremiumPortal({}, ctx('old')), 'portal_not_configured');
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
test('7-day trial (only when trialsEnabled is switched on): no charge today, trial_period_days = 7, access now, trial used once', async function () {
    const a = setup({ config: { trialsEnabled: true, trialDays: 7 } });
    const out = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('new'));
    const body = bodyOf(a.calls[0]);
    const trialEnd = T0 + 7 * 86400000;
    assert.ok(body.indexOf('subscription_data[trial_period_days]=7') !== -1);
    assert.ok(body.indexOf('subscription_data[trial_end]=') === -1);
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

test('Phil Nov 18: no trial by default; subscriptions are charged at purchase and Premium starts now', async function () {
    // Staging still carries trialDays: 7 and an old billingStartsAt: both must be ignored.
    const a = setup({ config: { trialDays: 7, billingStartsAt: '2027-01-03T00:00:00-05:00' } });
    const out = await a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('new'));
    assert.strictEqual(out.chargedNow, true);
    assert.strictEqual(out.deferredPerksStartAtMs, JAN3);
    const body = bodyOf(a.calls[0]);
    assert.ok(body.indexOf('trial_period_days') === -1);
    assert.ok(body.indexOf('trial_end') === -1);
    assert.ok(body.indexOf("custom_text[submit][message]=You're charged today.") !== -1);
    assert.ok(body.indexOf('Embers and Citadel cosmetics start Jan 3, 2027 at 12:00 AM ET. Your other Premium perks start right away.') !== -1);
    assert.ok(body.indexOf('All sales are final. No refunds.') !== -1);
    const order = a.db.store.get('premium_orders/' + out.orderId);
    assert.strictEqual(order.expectedTotalCents, 5000);
    assert.strictEqual(order.trialDays, 0);
    assert.strictEqual(order.trialEndMs, null);
    assert.strictEqual(order.startsAtMs, null);
    assert.strictEqual(order.deferredPerksStartAtMs, JAN3);
    assert.strictEqual(order.refundPolicy, pricing.REFUND_POLICY.id);
    assert.strictEqual(order.noRefundAckAtMs, T0);
    // A $0 "trial" session is refused for a paid order.
    assert.strictEqual((await stripePost(a, completed(out.orderId, 'cs_test_1', { amount_total: 0, payment_status: 'no_payment_required' }))).body.outcome, 'review');
    const b = setup({ config: { trialDays: 7 } });
    const o2 = await b.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('new'));
    assert.strictEqual((await stripePost(b, completed(o2.orderId, 'cs_test_1', { amount_total: 500 }))).body.outcome, 'granted');
    const ent = b.db.store.get('premium_entitlements/new');
    assert.strictEqual(ent.active, true);
    assert.strictEqual(ent.pendingStart, false);
    assert.strictEqual(ent.startsAtMs, null);
    assert.ok(!ent.trialUsed);
    assert.strictEqual(ent.deferredPerksStartAtMs, JAN3);
    const mirror = b.db.store.get('users/new').premium;
    assert.strictEqual(mirror.active, true);
    assert.strictEqual(mirror.perksStartAtMs, JAN3);
    const st = await b.h.getPremiumStatus({}, ctx('new'));
    assert.strictEqual(st.active, true);
    assert.strictEqual(st.inTrial, false);
    assert.strictEqual(st.trialsOpen, false);
    assert.strictEqual(st.chargedAtPurchase, true);
    assert.strictEqual(st.perksStartAtMs, JAN3);
    assert.strictEqual(st.deferredPerksOpen, false);
    assert.strictEqual(st.citadelPerks, false);
    assert.strictEqual(st.embersPerMonth, 0);
    assert.strictEqual(st.billingStartsAtMs, undefined);
    assert.strictEqual(st.refundPolicy.id, pricing.REFUND_POLICY.id);
});

test('Embers and Citadel perks wait for Jan 3, 2027 12:00 AM ET; other perks start at purchase', async function () {
    const a = setup();
    a.db.store.set('premium_entitlements/old', { prepaidUntilMs: Date.parse('2027-03-01T00:00:00Z') });
    const before = await a.h.claimPremiumAllowance({}, ctx('old'));
    assert.strictEqual(before.granted, 0);
    assert.strictEqual(before.reason, 'perks_start');
    assert.strictEqual(before.perksStartAtMs, JAN3);
    assert.strictEqual(premium.isPremiumActive(a.db.store.get('premium_entitlements/old'), T0), true);
    assert.strictEqual(premium.citadelPerksAllowed(a.db.store.get('premium_entitlements/old'), T0), false);
    a.clock.now = JAN3 - 1;
    assert.strictEqual((await a.h.claimPremiumAllowance({}, ctx('old'))).reason, 'perks_start');
    a.clock.now = JAN3;
    const at = await a.h.claimPremiumAllowance({}, ctx('old'));
    assert.strictEqual(at.granted, 100);
    assert.strictEqual(premium.citadelPerksAllowed(a.db.store.get('premium_entitlements/old'), JAN3), true);
    const st = await a.h.getPremiumStatus({}, ctx('old'));
    assert.strictEqual(st.deferredPerksOpen, true);
    assert.strictEqual(st.citadelPerks, true);
    assert.strictEqual(st.embersPerMonth, 100);
    // Missing or bad perks start is never earlier than Jan 3.
    assert.strictEqual(premium.deferredPerksOpen(JAN3 - 1, undefined), false);
    assert.strictEqual(premium.deferredPerksOpen(JAN3 - 1, 'x'), false);
    assert.strictEqual(premium.embersGrantAllowed({ founders: true }, JAN3 - 1), false);
    assert.strictEqual(premium.embersGrantAllowed({ founders: true }, JAN3), true);
});

test('Founders charged at purchase: seat sold now, lifetime active now, Embers from Jan 3', async function () {
    const a = setup({ config: { trialDays: 7, billingStartsAt: '2027-01-03T00:00:00-05:00' } });
    const out = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('new'));
    const body = bodyOf(a.calls[0]);
    assert.ok(body.indexOf('mode=payment') !== -1);
    assert.ok(body.indexOf('trial_end') === -1);
    assert.ok(body.indexOf("Founders' Lifetime is a one-time payment and never renews.") !== -1);
    assert.ok(body.indexOf("Founders' Lifetime and bitcoin payments are final.") !== -1);
    const r = await stripePost(a, completed(out.orderId, 'cs_test_1', { amount_total: 15000, mode: 'payment', subscription: null }));
    assert.strictEqual(r.body.outcome, 'granted');
    assert.strictEqual(a.db.store.get('premium_counters/founders').sold, 1);
    const ent = a.db.store.get('premium_entitlements/new');
    assert.strictEqual(ent.founders, true);
    assert.strictEqual(ent.active, true);
    assert.strictEqual(ent.startsAtMs, null);
    assert.strictEqual((await a.h.claimPremiumAllowance({}, ctx('new'))).reason, 'perks_start');
});

test('prepaid Lightning months count from purchase, not from Jan 3', async function () {
    const a = setup({ config: { billingStartsAt: '2027-01-03T00:00:00-05:00' } });
    const o = await a.h.createPremiumCheckout({ plan: 'months', rail: 'lightning', months: 1 }, ctx('new'));
    const inv = a.db.store.get('premium_orders/' + o.orderId).providerInvoiceId;
    a.btcInvoices[inv].status = 'Settled';
    await btcPost(a, { type: 'InvoiceSettled', invoiceId: inv, storeId: 'StoreABC12345' });
    const ent = a.db.store.get('premium_entitlements/new');
    assert.strictEqual(ent.prepaidUntilMs, pricing.addMonths(T0, 1));
    assert.strictEqual(ent.active, true);
    assert.strictEqual(ent.startsAtMs, null);
    assert.strictEqual(ent.deferredPerksStartAtMs, JAN3);
});

test('final-sale box: checkout refuses without acceptNoRefunds (in-app and public), nothing written', async function () {
    const a = setup();
    for (const v of [undefined, false, 'true', 1]) {
        const d = { plan: 'monthly', rail: 'card' };
        if (v !== undefined) d.acceptNoRefunds = v; else d.acceptNoRefunds = undefined;
        await rejects(a.h.raw.createPremiumCheckout(d, ctx('old')), 'terms_required');
    }
    await rejects(a.h.raw.publicCheckout({ plan: 'monthly', rail: 'card', email: 'buyer@example.com', turnstileToken: 'ok-token' }, '203.0.113.9', null), 'terms_required');
    assert.strictEqual(a.calls.length, 0);
    assert.strictEqual(rows(a, 'premium_orders').length, 0);
    assert.strictEqual(a.ts.length, 0); // refused before Turnstile is spent
    assert.ok(/no refunds/i.test(pricing.REFUND_POLICY.text));
});

test('kill switch: both checkout entry points refuse (fail closed); the Stripe webhook keeps running', async function () {
    const on = setup({ isOffline: async function () { return true; } });
    await rejects(on.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('old')), 'kill_switch');
    await rejects(on.h.publicCheckout({ plan: 'monthly', rail: 'card', email: 'buyer@example.com', turnstileToken: 'ok-token' }, '203.0.113.9', null), 'kill_switch');
    const res = fakeRes();
    await on.h.premiumPublicCheckout(req(null, { origin: 'https://dev.bitcoineducation.quest' }, { body: { plan: 'monthly', rail: 'card', email: 'buyer@example.com', turnstileToken: 'ok-token' } }), res);
    assert.strictEqual(res.code, 503);
    assert.strictEqual(res.body.reason, 'kill_switch');
    const broken = setup({ isOffline: async function () { throw new Error('unreadable'); } });
    await rejects(broken.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('old')), 'kill_switch');
    const weird = setup({ isOffline: async function () { return undefined; } });
    await rejects(weird.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('old')), 'kill_switch');
    // Bitcoin (BTCPay invoice create) refuses too, before any BTCPay call.
    await rejects(on.h.createPremiumCheckout({ plan: 'founders', rail: 'lightning' }, ctx('old')), 'kill_switch');
    await rejects(on.h.createPremiumCheckout({ plan: 'months', rail: 'lightning', months: 3 }, ctx('new')), 'kill_switch');
    assert.ok(!on.db.store.has('premium_counters/founders') || Object.keys(on.db.store.get('premium_counters/founders').holds || {}).length === 0, 'no Founders hold taken');
    assert.strictEqual(on.calls.length + broken.calls.length + weird.calls.length, 0);
    // Status keeps working so players can see what they own.
    const st = await on.h.getPremiumStatus({}, ctx('old'));
    assert.strictEqual(typeof st.active, 'boolean');
    // A checkout opened before the switch went on still completes by webhook.
    const flag = { off: false };
    const a = setup({ isOffline: async function () { return flag.off; } });
    const out = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('old'));
    flag.off = true;
    assert.strictEqual((await stripePost(a, completed(out.orderId, 'cs_test_1', { amount_total: 475 }))).body.outcome, 'granted');
    // Default wiring reads config/killSwitch (no deps.isOffline).
    const h = premium.createPremiumHandlers({ db: a.db, HttpsError: HttpsError, now: function () { return T0; }, env: FAKE_ENV, fetch: async function () { throw new Error('no'); }, projectId: 'bitcoin-quest-staging', getAuthUser: async function () { return { metadata: { creationTime: new Date(OLD).toUTCString() } }; } });
    a.db.store.set('config/killSwitch', { enabled: true });
    await rejects(h.createPremiumCheckout({ plan: 'monthly', rail: 'card', acceptNoRefunds: true }, ctx('new')), 'kill_switch');
    const idx = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    assert.ok(/bindPremium\(functionsV1, \{[\s\S]{0,200}isOffline: function \(\) \{ return killSwitchIsOn\(\); \}/.test(idx));
});

test('no refunds: portal cancels at period end only, no proration credit, no plan switching or promo codes', function () {
    const src = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'scripts', 'premium-portal-config.js'), 'utf8');
    assert.ok(/subscription_cancel: \{ enabled: true, mode: 'at_period_end', proration_behavior: 'none' \}/.test(src));
    assert.ok(/subscription_update: \{ enabled: false/.test(src));
    assert.ok(!/mode: 'immediately'/.test(src));
});

test('staging app hosts: dev.bitcoineducation.quest and bq-staging previews are allowed origins and return hosts', async function () {
    const a = setup();
    const c = ctx('old');
    c.rawRequest = { headers: { origin: 'https://premium-322.bq-staging.pages.dev' }, get: function (k) { return this.headers[k.toLowerCase()]; } };
    await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, c);
    assert.ok(bodyOf(a.calls[0]).indexOf('success_url=https://premium-322.bq-staging.pages.dev/?premium=success') !== -1);
    const evil = ctx('old');
    evil.rawRequest = { headers: { origin: 'https://evil.example' }, get: function (k) { return this.headers[k.toLowerCase()]; } };
    a.clock.now += 1;
    await a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, evil);
    assert.ok(bodyOf(a.calls[1]).indexOf('success_url=https://dev.bitcoineducation.quest/?premium=success') !== -1);
    ['https://dev.bitcoineducation.quest', 'https://bq-staging.pages.dev', 'https://abc123.bq-staging.pages.dev'].forEach(function (o) {
        const res = fakeRes();
        a.h.premiumPublicCheckout(req(null, { origin: o }, { method: 'OPTIONS' }), res);
        assert.strictEqual(res.headers['access-control-allow-origin'], o, o);
    });
    const bad = fakeRes();
    a.h.premiumPublicCheckout(req(null, { origin: 'https://bq-staging.pages.dev.evil.example' }, { method: 'OPTIONS' }), bad);
    assert.strictEqual(bad.code, 403);
    const live = setup({ projectId: 'bitcoin-education-archive', env: { STRIPE_SECRET_KEY: 'sk_live_' + 'x'.repeat(24) } });
    const lr = fakeRes();
    live.h.premiumPublicCheckout(req(null, { origin: 'https://dev.bitcoineducation.quest' }, { method: 'OPTIONS' }), lr);
    assert.strictEqual(lr.code, 403);
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
    await a.h.premiumPublicCheckout(req(null, { Origin: origin || 'https://preview1.bitcoin-quest.pages.dev', 'X-Forwarded-For': ip || '203.0.113.9' }, { body: body }), res);
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
    assert.ok(body.indexOf('success_url=https://preview1.bitcoin-quest.pages.dev/premium?premium=success') !== -1);
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
    const ek = premium.emailKey('buyer@example.com', FAKE_ENV.PREMIUM_HASH_KEY);
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

test('BTCPay Founders (mock store): $135 / $127.50, 15-min invoice + hold, final-sale label, seat sold once; fails closed', async function () {
    const a = setup();
    const f = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'lightning' }, ctx('new'));
    assert.strictEqual(f.amountCents, 13500);
    assert.strictEqual(f.provider, 'btcpay');
    const post = JSON.parse(a.calls[0].init.body);
    assert.strictEqual(post.amount, '135.00');
    assert.strictEqual(post.checkout.expirationMinutes, 15);
    assert.strictEqual(post.checkout.redirectAutomatically, false);
    assert.ok(/^https:\/\/dev\.bitcoineducation\.quest\/\?premium=success&order=/.test(post.checkout.redirectURL));
    assert.ok(/final sale, no refunds/.test(post.metadata.itemDesc));
    assert.strictEqual(post.metadata.orderId, f.orderId);
    assert.strictEqual(a.calls[0].init.redirect, 'error');
    const hold = a.db.store.get('premium_counters/founders').holds[f.orderId];
    assert.strictEqual(hold.expMs, T0 + 20 * 60000);
    const old = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'lightning' }, ctx('old'));
    assert.strictEqual(old.amountCents, 12750);
    const fi = a.db.store.get('premium_orders/' + f.orderId).providerInvoiceId;
    a.btcInvoices[fi].status = 'Settled';
    const ev = { type: 'InvoiceSettled', invoiceId: fi, storeId: 'StoreABC12345' };
    // Unsigned / missing signature refused.
    const res = fakeRes();
    await a.h.btcpayWebhook(req(Buffer.from(JSON.stringify(ev)), {}), res);
    assert.strictEqual(res.code, 400);
    assert.strictEqual((await btcPost(a, ev)).body.outcome, 'granted');
    assert.strictEqual((await btcPost(a, ev)).body.outcome, 'duplicate');
    assert.strictEqual(a.db.store.get('premium_counters/founders').sold, 1);
    assert.strictEqual(a.db.store.get('premium_entitlements/new').founders, true);
    // Lightning closed: refused before any invoice.
    const b = setup({ config: { lightningEnabled: false } });
    await rejects(b.h.createPremiumCheckout({ plan: 'founders', rail: 'lightning' }, ctx('new')), 'lightning_closed');
    assert.strictEqual(b.calls.length, 0);
    // No BTCPay config: webhook answers 503 (BTCPay retries), nothing granted.
    const c = setup({ env: { BTCPAY_STORE_ID: '' } });
    const r503 = fakeRes();
    const raw = Buffer.from(JSON.stringify(ev));
    await c.h.btcpayWebhook(req(raw, { 'BTCPay-Sig': 'sha256=' + crypto.createHmac('sha256', FAKE_ENV.BTCPAY_WEBHOOK_SECRET).update(raw).digest('hex') }), r503);
    assert.strictEqual(r503.code, 503);
    // Late settle after the hold expired with the cap full goes to review.
    const d = setup();
    d.db.store.set('premium_counters/founders', { sold: 499, holds: {} });
    const late = await d.h.createPremiumCheckout({ plan: 'founders', rail: 'lightning' }, ctx('old'));
    const li = d.db.store.get('premium_orders/' + late.orderId).providerInvoiceId;
    d.clock.now += 21 * 60000;
    d.db.store.set('premium_counters/founders', { sold: 500, holds: {} });
    d.btcInvoices[li].status = 'Settled';
    assert.strictEqual((await btcPost(d, { type: 'InvoiceSettled', invoiceId: li, storeId: 'StoreABC12345' })).body.outcome, 'review');
    assert.strictEqual(d.db.store.get('premium_counters/founders').sold, 500);
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

test('Embers: 100 a month for paid Premium, once per ET month, rollover cap 300', async function () {
    assert.strictEqual(premium.EMBERS_PER_MONTH, 100);
    assert.strictEqual(premium.EMBERS_CAP, 300);
    const a = setup({ config: { perksStartAtMs: LAUNCH } });
    await rejects(a.h.claimPremiumAllowance({}, ctx('old')), 'not_premium');
    a.db.store.set('premium_entitlements/old', { prepaidUntilMs: T0 + 86400000 * 400 });
    const r1 = await a.h.claimPremiumAllowance({}, ctx('old'));
    assert.strictEqual(r1.granted, 100);
    assert.strictEqual(r1.embers, 100);
    assert.strictEqual(r1.name, 'Embers');
    const r2 = await a.h.claimPremiumAllowance({}, ctx('old'));
    assert.strictEqual(r2.granted, 0);
    assert.strictEqual(r2.embers, 100);
    assert.strictEqual(r2.reason, 'already_granted');
    a.clock.now = Date.parse('2026-12-01T05:00:00.000Z');
    const r3 = await a.h.claimPremiumAllowance({}, ctx('old'));
    assert.strictEqual(r3.granted, 100);
    assert.strictEqual(r3.embers, 200);
    assert.strictEqual(premium.etMonthKey(Date.parse('2026-12-01T04:59:00.000Z')), '2026-11');
    // Rollover caps at 300: 250 + 100 grants only 50.
    a.clock.now = Date.parse('2027-01-01T05:00:00.000Z');
    a.db.store.set('premium_allowance/old', Object.assign(a.db.store.get('premium_allowance/old'), { embers: 250, cosmeticCredits: 250 }));
    const r4 = await a.h.claimPremiumAllowance({}, ctx('old'));
    assert.strictEqual(r4.granted, 50);
    assert.strictEqual(r4.embers, 300);
    a.clock.now = Date.parse('2027-02-01T05:00:00.000Z');
    const r5 = await a.h.claimPremiumAllowance({}, ctx('old'));
    assert.strictEqual(r5.granted, 0);
    assert.strictEqual(r5.embers, 300);
    assert.strictEqual(r5.reason, 'at_cap');
});
test('Embers: trial and referral weeks get none; Founders and Family buyer get 100; cancel keeps leftovers', async function () {
    const a = setup({ config: { perksStartAtMs: LAUNCH } });
    // Trial: Premium is active but no Embers.
    a.db.store.set('premium_entitlements/old', { subscriptionUntilMs: T0 + 86400000 * 20, trialUntilMs: T0 + 86400000 * 7, autoRenew: true, stripeSubscriptionId: 'sub_t', subscriptionPlan: 'monthly' });
    const trial = await a.h.claimPremiumAllowance({}, ctx('old'));
    assert.strictEqual(trial.granted, 0);
    assert.strictEqual(trial.reason, 'trial');
    assert.strictEqual(trial.embers, 0);
    // Referral week.
    const b = setup({ config: { perksStartAtMs: LAUNCH } });
    b.db.store.set('premium_entitlements/old', { prepaidUntilMs: T0 + 86400000 * 40, referralWeekUntilMs: T0 + 86400000 * 7 });
    const refw = await b.h.claimPremiumAllowance({}, ctx('old'));
    assert.strictEqual(refw.granted, 0);
    assert.strictEqual(refw.reason, 'referral_week');
    // Founders: 100 even with autoRenew false and no subscription.
    const c = setup({ config: { perksStartAtMs: LAUNCH } });
    c.db.store.set('premium_entitlements/old', { founders: true });
    assert.strictEqual((await c.h.claimPremiumAllowance({}, ctx('old'))).granted, 100);
    // Family: 100 for the buyer only.
    const d = setup({ config: { perksStartAtMs: LAUNCH } });
    d.db.store.set('premium_entitlements/old', { prepaidUntilMs: T0 + 86400000 * 40, subscriptionPlan: 'family' });
    assert.strictEqual((await d.h.claimPremiumAllowance({}, ctx('old'))).granted, 100);
    await rejects(d.h.claimPremiumAllowance({}, ctx('new')), 'not_premium');
    // After cancel: leftovers kept, no new grant.
    const e = setup({ config: { perksStartAtMs: LAUNCH } });
    e.db.store.set('premium_entitlements/old', { subscriptionUntilMs: T0 + 86400000 * 20, autoRenew: false, stripeSubscriptionId: 'sub_c', subscriptionPlan: 'monthly' });
    e.db.store.set('premium_allowance/old', { embers: 175, cosmeticCredits: 175, lastMonth: '2026-10', periodGranted: 0, periodSpent: 0 });
    const canceled = await e.h.claimPremiumAllowance({}, ctx('old'));
    assert.strictEqual(canceled.granted, 0);
    assert.strictEqual(canceled.reason, 'canceled');
    assert.strictEqual(canceled.embers, 175);
});
test('Embers: a full refund removes that period\'s unspent Embers; spent stay spent', async function () {
    assert.strictEqual(premium.periodUnspentEmbers({ embers: 275, periodGranted: 100, periodSpent: 25 }), 75);
    assert.strictEqual(premium.periodUnspentEmbers({ embers: 40, periodGranted: 100, periodSpent: 80 }), 20);
    const a = setup();
    const out = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('old'));
    await stripePost(a, completed(out.orderId, 'cs_test_1', { amount_total: 475 }));
    await stripePost(a, invoicePaid(out.orderId, 475, { billing_reason: 'subscription_create' }));
    a.db.store.set('premium_allowance/old', { embers: 275, cosmeticCredits: 275, lastMonth: '2026-11', periodGranted: 100, periodSpent: 25 });
    await stripePost(a, { id: 'evt_fr_emb', type: 'charge.refunded', livemode: false, data: { object: { id: 'ch_emb', refunded: true, amount_refunded: 475, customer: 'cus_1' } } });
    const w = a.db.store.get('premium_allowance/old');
    assert.strictEqual(w.embers, 200);
    assert.strictEqual(w.clawedBack, 75);
    assert.strictEqual(a.db.store.get('premium_entitlements/old').frozen, true);
    await rejects(a.h.claimPremiumAllowance({}, ctx('old')), 'not_premium');
    // Extra Embers cannot be bought.
    const src = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'src', 'premium.js'), 'utf8');
    ['buyEmbers', 'purchaseEmbers', 'embersPrice', 'buyAllowance'].forEach(function (wrd) {
        assert.strictEqual(src.indexOf(wrd), -1, wrd);
    });
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

// ---------- Security pass (Nov 14): Red Team, Spam/Abuse, User Data/Backups
function ipCtx(uid, ip, extra) {
    const c = ctx(uid, extra);
    c.rawRequest = { headers: { 'x-forwarded-for': ip }, socket: { remoteAddress: '10.0.0.1' } };
    return c;
}
function lastOrderId(a) { const k = Array.from(a.db.store.keys()).filter(function (x) { return x.indexOf('premium_orders/') === 0; }); return k[k.length - 1].split('/')[1]; }
function storeJson(a) { return JSON.stringify(Array.from(a.db.store.entries())); }
function rows(a, prefix) { return Array.from(a.db.store.entries()).filter(function (e) { return e[0].indexOf(prefix + '/') === 0; }).map(function (e) { return e[1]; }); }
function invoicePaid(orderId, amount, extra) {
    const periodEnd = Math.floor((T0 + 30 * 86400000) / 1000);
    return { id: 'evt_' + crypto.randomBytes(4).toString('hex'), type: 'invoice.paid', livemode: false, data: { object: Object.assign({ id: 'in_' + crypto.randomBytes(3).toString('hex'), currency: 'usd', amount_paid: amount, customer: 'cus_1', billing_reason: 'subscription_cycle', parent: { subscription_details: { subscription: 'sub_1', metadata: { orderId: orderId } } }, lines: { data: [{ period: { end: periodEnd } }] } }, extra || {}) } };
}

test('Red Team 1: forged X-Forwarded-For does not reset the per-IP limit; Turnstile gets the same IP', async function () {
    const a = setup();
    for (let i = 0; i < 10; i++) {
        const r = await publicPost(a, { plan: 'monthly', rail: 'card', email: 'b' + i + '@example.com', turnstileToken: 'ok-token' }, null, '1.2.3.' + i + ', 198.51.100.7');
        assert.strictEqual(r.code, 200, JSON.stringify(r.body));
    }
    const r = await publicPost(a, { plan: 'monthly', rail: 'card', email: 'z@example.com', turnstileToken: 'ok-token' }, null, '9.9.9.9, 198.51.100.7');
    assert.strictEqual(r.code, 429);
    assert.strictEqual(r.body.reason, 'rate_limited');
    a.ts.forEach(function (t) { assert.strictEqual(t.remoteip, '198.51.100.7'); });
    // A different real (rightmost) IP is its own bucket.
    assert.strictEqual((await publicPost(a, { plan: 'monthly', rail: 'card', email: 'z@example.com', turnstileToken: 'ok-token' }, null, '198.51.100.7, 198.51.100.8')).code, 200);
});
test('Red Team 1: global hourly cap on public orders (premium_config.publicOrdersPerHour)', async function () {
    const a = setup({ config: { publicOrdersPerHour: 3 } });
    for (let i = 0; i < 3; i++) assert.strictEqual((await publicPost(a, { plan: 'monthly', rail: 'card', email: 'g' + i + '@example.com', turnstileToken: 'ok-token' }, null, '203.0.113.' + (i + 1))).code, 200);
    const r = await publicPost(a, { plan: 'monthly', rail: 'card', email: 'g9@example.com', turnstileToken: 'ok-token' }, null, '203.0.113.50');
    assert.strictEqual(r.body.reason, 'rate_limited_global');
    a.clock.now += 3600001;
    assert.strictEqual((await publicPost(a, { plan: 'monthly', rail: 'card', email: 'g9@example.com', turnstileToken: 'ok-token' }, null, '203.0.113.50')).code, 200);
    assert.strictEqual(pricing.DEFAULT_CONFIG.publicOrdersPerHour, 60);
});
test('Red Team 2: Founders needs sign-in; live-hold cap; one hold per real IP', async function () {
    const a = setup();
    const r = await publicPost(a, { plan: 'founders', rail: 'card', email: 'f@example.com', turnstileToken: 'ok-token' });
    assert.strictEqual(r.body.reason, 'founders_sign_in');
    assert.ok(!a.db.store.has('premium_counters/founders'));
    // One live hold per real IP across accounts.
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('old', '6.6.6.6, 198.51.100.20'));
    await rejects(a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('new', '7.7.7.7, 198.51.100.20')), 'hold_exists_ip');
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('new', '198.51.100.21'));
    // Cap on total live holds.
    const b = setup({ config: { maxLiveFoundersHolds: 2 } });
    await b.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('u1aaaa'));
    await b.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('u2aaaa'));
    await rejects(b.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('u3aaaa')), 'founders_busy');
    // Holds are stored with an expiry and a keyed IP hash, never a plain IP.
    const holds = a.db.store.get('premium_counters/founders').holds;
    Object.keys(holds).forEach(function (k) { assert.ok(holds[k].expMs > T0); assert.ok(/^[0-9a-f]{40}$/.test(holds[k].ipHash)); });
    assert.strictEqual(storeJson(a).indexOf('198.51.100.20'), -1);
});
test('Red Team L3: IPv6 /64 shares a Founders hold and a public rate key; IPv4 stays exact; unverified Founders is refused', async function () {
    const a = setup();
    const v6a = '2001:db8:85a3:1:1111:2222:3333:4444';
    const v6b = '2001:db8:85a3:1:aaaa:bbbb:cccc:dddd';
    const v6other = '2001:db8:85a3:2::1';
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('old', v6a));
    await rejects(a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('new', v6b)), 'hold_exists_ip');
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('new', v6other));
    const holds = a.db.store.get('premium_counters/founders').holds;
    const hashes = Object.keys(holds).map(function (k) { return holds[k].ipHash; });
    assert.strictEqual(hashes.length, 2);
    assert.notStrictEqual(hashes[0], hashes[1]);
    assert.strictEqual(storeJson(a).indexOf('2001:db8'), -1);

    const r = setup();
    for (let i = 0; i < 10; i++) {
        const out = await publicPost(r, { plan: 'monthly', rail: 'card', email: 'n' + i + '@example.com', turnstileToken: 'ok-token' }, null, v6a);
        assert.strictEqual(out.code, 200, JSON.stringify(out.body));
    }
    const same = await publicPost(r, { plan: 'monthly', rail: 'card', email: 'same64@example.com', turnstileToken: 'ok-token' }, null, v6b);
    assert.strictEqual(same.code, 429);
    assert.strictEqual(same.body.reason, 'rate_limited');
    const other = await publicPost(r, { plan: 'monthly', rail: 'card', email: 'other64@example.com', turnstileToken: 'ok-token' }, null, v6other);
    assert.strictEqual(other.code, 200, JSON.stringify(other.body));
    const rateKeys = Array.from(r.db.store.keys()).filter(function (k) { return k.indexOf('premium_rate/ip_') === 0; });
    assert.strictEqual(rateKeys.length, 2); // one /64 + the other /64; global is not ip_

    const u = setup();
    await rejects(u.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('old', '198.51.100.30', { email_verified: false })), 'email_not_verified');
    assert.ok(!u.db.store.has('premium_counters/founders'));
    assert.strictEqual((await u.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old', { email_verified: false }))).amountCents, 5000);
    const off = setup({ config: { foundersRequireVerifiedEmail: false } });
    const allowed = await off.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('old', '198.51.100.30', { email_verified: false }));
    assert.strictEqual(allowed.amountCents, 15000); // unverified is not eligible for the 5%
});
test('Red Team L1: a non-string plan or rail is refused as bad_plan or bad_rail, in-app and public', async function () {
    const a = setup();
    await rejects(a.h.createPremiumCheckout({ plan: { toString: 'founders' }, rail: 'card' }, ctx('old')), 'bad_plan');
    await rejects(a.h.createPremiumCheckout({ plan: 'monthly', rail: { toString: 'card' } }, ctx('old')), 'bad_rail');
    await rejects(a.h.createPremiumCheckout({ plan: 1, rail: 'card' }, ctx('old')), 'bad_plan');
    const plan = await publicPost(a, { plan: { toString: 'founders' }, rail: 'card', email: 'x@example.com', turnstileToken: 'ok-token' });
    assert.strictEqual(plan.code, 400);
    assert.strictEqual(plan.body.reason, 'bad_plan');
    const rail = await publicPost(a, { plan: 'monthly', rail: { toString: 'card' }, email: 'x@example.com', turnstileToken: 'ok-token' });
    assert.strictEqual(rail.code, 400);
    assert.strictEqual(rail.body.reason, 'bad_rail');
    assert.ok(!a.db.store.has('premium_counters/founders'));
    assert.strictEqual(Array.from(a.db.store.keys()).filter(function (k) { return k.indexOf('premium_orders/') === 0; }).length, 0);
});
test('Red Team 2: holds above threshold for over an hour raise one review row + admin alert', async function () {
    const a = setup({ config: { foundersHoldsAlertThreshold: 2 } });
    a.db.store.set('premium_counters/founders', { sold: 0, holds: { o1: { uid: 'x', expMs: T0 + 9e9 }, o2: { uid: 'y', expMs: T0 + 9e9 } } });
    assert.strictEqual((await a.h.sweepExpired(10)).holdsAlert, 'high');
    a.clock.now += 30 * 60000;
    assert.strictEqual((await a.h.sweepExpired(10)).holdsAlert, 'high');
    a.clock.now += 31 * 60000;
    assert.strictEqual((await a.h.sweepExpired(10)).holdsAlert, 'alerted');
    assert.strictEqual((await a.h.sweepExpired(10)).holdsAlert, 'high'); // once per streak
    assert.strictEqual(rows(a, 'premium_review').filter(function (r) { return r.reason === 'founders_holds_high'; }).length, 1);
    const n = rows(a, 'admin_notifications');
    assert.strictEqual(n.length, 1);
    assert.strictEqual(n[0].type, 'premium_holds_high');
    assert.strictEqual(n[0].read, false);
});
test('Red Team 3: $0 invoice only for the trial opening invoice; renewals must equal the price', async function () {
    const a = setup({ config: { trialsEnabled: true, trialDays: 7 } });
    const out = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('new'));
    await stripePost(a, completed(out.orderId, 'cs_test_1', { amount_total: 0, payment_status: 'no_payment_required' }));
    assert.strictEqual((await stripePost(a, invoicePaid(out.orderId, 0, { billing_reason: 'subscription_cycle' }))).body.outcome, 'review');
    assert.strictEqual((await stripePost(a, invoicePaid(out.orderId, 0, { billing_reason: 'subscription_create' }))).body.outcome, 'granted');
    assert.strictEqual((await stripePost(a, invoicePaid(out.orderId, 0, { billing_reason: 'subscription_create' }))).body.outcome, 'review');
    assert.strictEqual((await stripePost(a, invoicePaid(out.orderId, 499))).body.outcome, 'review');
    assert.strictEqual((await stripePost(a, invoicePaid(out.orderId, 500))).body.outcome, 'granted');
    const reasons = rows(a, 'premium_review').map(function (r) { return r.reason; });
    assert.strictEqual(reasons.filter(function (x) { return x === 'stripe_zero_invoice'; }).length, 2);
    assert.ok(reasons.indexOf('stripe_invoice_amount_mismatch') !== -1);
    // No trial on the order: a $0 invoice (promo code, credit) never grants time.
    const b = setup();
    const o2 = await b.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('new'));
    await stripePost(b, completed(o2.orderId, 'cs_test_1', { amount_total: 500 }));
    assert.strictEqual((await stripePost(b, invoicePaid(o2.orderId, 0, { billing_reason: 'subscription_create' }))).body.outcome, 'review');
});
test('Red Team 4 / Spam: a card that already had a trial sends the order to review (no time)', async function () {
    const a = setup({ config: { trialsEnabled: true, trialDays: 7 }, defaultCardFp: 'fp_same_card' });
    const o1 = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('old', { email: 'one@example.com' }));
    assert.strictEqual((await stripePost(a, completed(o1.orderId, 'cs_test_1', { amount_total: 0, payment_status: 'no_payment_required' }))).body.outcome, 'granted');
    const o2 = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('new', { email: 'two@example.com' }));
    assert.ok(bodyOf(a.calls[a.calls.length - 1]).indexOf('trial_period_days') !== -1); // unknown card at checkout time
    assert.strictEqual((await stripePost(a, completed(o2.orderId, 'cs_test_2', { amount_total: 0, payment_status: 'no_payment_required', customer: 'cus_2', subscription: 'sub_2' }))).body.outcome, 'review');
    assert.strictEqual(a.db.store.get('premium_orders/' + o2.orderId).status, 'review');
    assert.strictEqual((await stripePost(a, invoicePaid(o2.orderId, 0, { billing_reason: 'subscription_create', customer: 'cus_2', parent: { subscription_details: { subscription: 'sub_2', metadata: { orderId: o2.orderId } } } }))).body.outcome, 'review');
    assert.strictEqual(premium.isPremiumActive(a.db.store.get('premium_entitlements/new') || null, a.clock.now), false);
    const row = rows(a, 'premium_review').find(function (r) { return r.reason === 'trial_reused'; });
    assert.deepStrictEqual(row.by, ['card']);
    assert.strictEqual(row.uid, 'new');
    assert.strictEqual(row.customerId, 'cus_2');
    // Markers hold keyed hashes only.
    const markers = Array.from(a.db.store.keys()).filter(function (k) { return k.indexOf('premium_trial_markers/') === 0; });
    assert.strictEqual(markers.length, 2);
    assert.strictEqual(storeJson(a).indexOf('fp_same_card'), -1);
    assert.strictEqual(storeJson(a).indexOf('one@example.com'), -1);
});
test('Red Team 5: trial_reused cancels the Stripe subscription immediately and records subscription_canceled', async function () {
    const a = setup({ config: { trialsEnabled: true, trialDays: 7 }, defaultCardFp: 'fp_same_card' });
    const o1 = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('old', { email: 'one@example.com' }));
    assert.strictEqual((await stripePost(a, completed(o1.orderId, 'cs_test_1', { amount_total: 0, payment_status: 'no_payment_required' }))).body.outcome, 'granted');
    const o2 = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('new', { email: 'two@example.com' }));
    const ev = completed(o2.orderId, 'cs_test_2', { amount_total: 0, payment_status: 'no_payment_required', customer: 'cus_2', subscription: 'sub_2' });
    assert.strictEqual((await stripePost(a, ev)).body.outcome, 'review');
    const del = a.calls.filter(function (c) {
        return c.init.method === 'DELETE' && c.url === 'https://api.stripe.com/v1/subscriptions/sub_2';
    });
    assert.strictEqual(del.length, 1);
    const row = rows(a, 'premium_review').find(function (r) { return r.reason === 'trial_reused'; });
    assert.strictEqual(row.subscription_canceled, true);
    assert.strictEqual(row.subscriptionId, 'sub_2');
    assert.strictEqual(a.db.store.get('premium_orders/' + o2.orderId).subscription_canceled, true);
    assert.strictEqual(a.db.store.get('premium_orders/' + o2.orderId).status, 'review');
    assert.strictEqual(premium.isPremiumActive(a.db.store.get('premium_entitlements/new') || null, a.clock.now), false);
    // Opening invoice after cancel still grants no time.
    assert.strictEqual((await stripePost(a, invoicePaid(o2.orderId, 0, { billing_reason: 'subscription_create', customer: 'cus_2', parent: { subscription_details: { subscription: 'sub_2', metadata: { orderId: o2.orderId } } } }))).body.outcome, 'review');
    assert.strictEqual(premium.isPremiumActive(a.db.store.get('premium_entitlements/new') || null, a.clock.now), false);
});
test('Red Team 6: a trial order with a null card fingerprint is sent to review with no Premium, and the subscription is canceled', async function () {
    const a = setup({ config: { trialsEnabled: true, trialDays: 7 }, cardFp: { cs_test_1: null } });
    const o1 = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('new', { email: 'nofp@example.com' }));
    const ev = completed(o1.orderId, 'cs_test_1', { amount_total: 0, payment_status: 'no_payment_required', customer: 'cus_nf', subscription: 'sub_nf' });
    assert.strictEqual((await stripePost(a, ev)).body.outcome, 'review');
    assert.strictEqual(a.db.store.get('premium_orders/' + o1.orderId).status, 'review');
    assert.strictEqual(a.db.store.get('premium_orders/' + o1.orderId).reviewReason, 'trial_reused');
    assert.strictEqual(premium.isPremiumActive(a.db.store.get('premium_entitlements/new') || null, a.clock.now), false);
    const row = rows(a, 'premium_review').find(function (r) { return r.reason === 'trial_reused'; });
    assert.deepStrictEqual(row.by, ['missing_fingerprint']);
    assert.strictEqual(row.subscription_canceled, true);
    assert.strictEqual(row.subscriptionId, 'sub_nf');
    const del = a.calls.filter(function (c) {
        return c.init.method === 'DELETE' && c.url === 'https://api.stripe.com/v1/subscriptions/sub_nf';
    });
    assert.strictEqual(del.length, 1);
});
test('Spam: invoice.paid first then session.completed still runs the trial gate; reused card goes to review', async function () {
    const a = setup({ config: { trialsEnabled: true, trialDays: 7 }, defaultCardFp: 'fp_same_card' });
    const o1 = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('old', { email: 'one@example.com' }));
    const s1 = a.db.store.get('premium_orders/' + o1.orderId).providerSessionId;
    // Normal order: invoice.paid arrives first, then session.completed.
    const inv1 = invoicePaid(o1.orderId, 0, { billing_reason: 'subscription_create', customer: 'cus_1', parent: { subscription_details: { subscription: 'sub_1', metadata: { orderId: o1.orderId } } } });
    assert.strictEqual((await stripePost(a, inv1)).body.outcome, 'granted');
    const ent1 = a.db.store.get('premium_entitlements/old');
    assert.strictEqual(ent1.trialUsed, true);
    assert.strictEqual(ent1.autoRenew, true);
    assert.ok(ent1.trialUntilMs > T0);
    assert.strictEqual((await stripePost(a, completed(o1.orderId, s1, { amount_total: 0, payment_status: 'no_payment_required', customer: 'cus_1', subscription: 'sub_1' }))).body.outcome, 'already_paid');
    assert.strictEqual(a.db.store.get('premium_entitlements/old').trialUsed, true);
    // Replay of either event does not grant a second time.
    assert.strictEqual((await stripePost(a, inv1)).body.outcome, 'duplicate');
    const ev1b = completed(o1.orderId, s1, { amount_total: 0, payment_status: 'no_payment_required', customer: 'cus_1', subscription: 'sub_1' });
    // New event id, same session: already_paid, still one grant.
    assert.strictEqual((await stripePost(a, ev1b)).body.outcome, 'already_paid');
    assert.strictEqual(rows(a, 'premium_trial_markers').length, 2); // card + email

    // Second account, same card: invoice.paid first, then session.completed.
    const o2 = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('new', { email: 'two@example.com' }));
    const s2 = a.db.store.get('premium_orders/' + o2.orderId).providerSessionId;
    const inv2 = invoicePaid(o2.orderId, 0, { billing_reason: 'subscription_create', customer: 'cus_2', parent: { subscription_details: { subscription: 'sub_2', metadata: { orderId: o2.orderId } } } });
    assert.strictEqual((await stripePost(a, inv2)).body.outcome, 'review');
    assert.strictEqual(a.db.store.get('premium_orders/' + o2.orderId).status, 'review');
    assert.strictEqual(a.db.store.get('premium_orders/' + o2.orderId).reviewReason, 'trial_reused');
    assert.strictEqual(a.db.store.get('premium_orders/' + o2.orderId).subscription_canceled, true);
    assert.strictEqual(premium.isPremiumActive(a.db.store.get('premium_entitlements/new') || null, a.clock.now), false);
    const ev2 = completed(o2.orderId, s2, { amount_total: 0, payment_status: 'no_payment_required', customer: 'cus_2', subscription: 'sub_2' });
    assert.strictEqual((await stripePost(a, ev2)).body.outcome, 'review');
    assert.strictEqual(premium.isPremiumActive(a.db.store.get('premium_entitlements/new') || null, a.clock.now), false);
    const del = a.calls.filter(function (c) {
        return c.init.method === 'DELETE' && c.url === 'https://api.stripe.com/v1/subscriptions/sub_2';
    });
    assert.ok(del.length >= 1);
    const row = rows(a, 'premium_review').find(function (r) { return r.reason === 'trial_reused'; });
    assert.strictEqual(row.subscription_canceled, true);
    // subscription.updated must not turn autoRenew back on or unlock Embers.
    const upd = { id: 'evt_upd_reused', type: 'customer.subscription.updated', livemode: false, data: { object: { id: 'sub_2', status: 'trialing', cancel_at_period_end: false, metadata: { orderId: o2.orderId } } } };
    const updOut = (await stripePost(a, upd)).body.outcome;
    assert.ok(updOut === 'review' || updOut === 'not_renewing', updOut);
    assert.strictEqual(premium.isPremiumActive(a.db.store.get('premium_entitlements/new') || null, a.clock.now), false);
    await rejects(a.h.claimPremiumAllowance({}, ctx('new')), 'not_premium');
});
test('Spam: canonical email (plus-alias, gmail dots) that had a trial gets a paid checkout with no trial', async function () {
    assert.strictEqual(premium.canonicalEmail('J.Doe+promo@GoogleMail.com'), 'jdoe@gmail.com');
    assert.strictEqual(premium.canonicalEmail('j.doe+x@example.com'), 'j.doe@example.com');
    const a = setup({ config: { trialsEnabled: true, trialDays: 7 }, cardFp: { cs_test_1: 'fp_a', cs_test_2: 'fp_b' } });
    const o1 = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('old', { email: 'jdoe@gmail.com' }));
    await stripePost(a, completed(o1.orderId, 'cs_test_1', { amount_total: 0, payment_status: 'no_payment_required' }));
    await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('new', { email: 'J.Doe+again@googlemail.com' }));
    assert.strictEqual(bodyOf(a.calls[a.calls.length - 1]).indexOf('trial_end'), -1);
    const pub = await publicPost(a, { plan: 'monthly', rail: 'card', email: 'jd.oe+3@gmail.com', turnstileToken: 'ok-token' });
    assert.strictEqual(pub.code, 200);
    assert.strictEqual(bodyOf(a.calls[a.calls.length - 1]).indexOf('trial_end'), -1);
});
test('Spam: a dispute freezes perks by Stripe customer, review row + admin alert', async function () {
    const a = setup({ config: { perksStartAtMs: LAUNCH } });
    const out = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('old'));
    await stripePost(a, completed(out.orderId, 'cs_test_1', { amount_total: 475 }));
    await stripePost(a, invoicePaid(out.orderId, 475, { billing_reason: 'subscription_create' }));
    a.db.store.set('premium_entitlements/old', Object.assign(a.db.store.get('premium_entitlements/old'), { prepaidUntilMs: T0 + 9e9 }));
    assert.strictEqual((await a.h.claimPremiumAllowance({}, ctx('old'))).granted, 100);
    a.clock.now = Date.parse('2026-12-02T15:00:00Z');
    const ev = { id: 'evt_disp1', type: 'charge.dispute.created', livemode: false, data: { object: { id: 'dp_1', amount: 475, customer: 'cus_1' } } };
    assert.strictEqual((await stripePost(a, ev)).body.outcome, 'review');
    const ent = a.db.store.get('premium_entitlements/old');
    assert.strictEqual(ent.frozen, true);
    assert.strictEqual(premium.isPremiumActive(ent, a.clock.now), false);
    assert.strictEqual(a.db.store.get('users/old').premium.active, false);
    await rejects(a.h.claimPremiumAllowance({}, ctx('old')), 'not_premium');
    const row = rows(a, 'premium_review').find(function (r) { return r.reason === 'stripe_charge_dispute_created'; });
    assert.strictEqual(a.db.store.get('premium_orders/' + out.orderId).stripeCustomerId, 'cus_1');
    assert.strictEqual(row.uid, 'old');
    assert.strictEqual(row.orderId, out.orderId);
    assert.strictEqual(row.customerId, 'cus_1');
    const n = rows(a, 'admin_notifications');
    assert.strictEqual(n.length, 1);
    assert.strictEqual(n[0].type, 'premium_review');
    // A later renewal does not unfreeze; only the admin tool restores.
    await stripePost(a, invoicePaid(out.orderId, 475));
    assert.strictEqual(a.db.store.get('premium_entitlements/old').frozen, true);
    a.db.store.set('users/adminx', {});
    await a.h.adminRevokePremium({ action: 'restore', uid: 'old', reason: 'dispute won' }, ctx('adminx', { admin: true }));
    assert.strictEqual(premium.isPremiumActive(a.db.store.get('premium_entitlements/old'), a.clock.now), true);
});
test('No refunds: a hand refund is still handled; partial = review only, full = freeze; failed renewal never freezes', async function () {
    const a = setup();
    const out = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('old'));
    await stripePost(a, completed(out.orderId, 'cs_test_1', { amount_total: 475 }));
    await stripePost(a, invoicePaid(out.orderId, 475, { billing_reason: 'subscription_create' }));
    // Failed renewal: review row only; paid time keeps running (Stripe retries).
    const pf = { id: 'evt_pf1', type: 'invoice.payment_failed', livemode: false, data: { object: { id: 'in_pf', customer: 'cus_1', amount_due: 475, attempt_count: 1, parent: { subscription_details: { subscription: 'sub_1', metadata: { orderId: out.orderId } } } } } };
    assert.strictEqual((await stripePost(a, pf)).body.outcome, 'payment_failed_noted');
    assert.strictEqual((await stripePost(a, pf)).body.outcome, 'duplicate');
    assert.ok(!a.db.store.get('premium_entitlements/old').frozen);
    assert.strictEqual(premium.isPremiumActive(a.db.store.get('premium_entitlements/old'), a.clock.now), true);
    assert.strictEqual(rows(a, 'premium_review').filter(function (r) { return r.reason === 'stripe_invoice_payment_failed'; }).length, 1);
    // Partial goodwill refund by hand: no freeze, review row, order marked.
    const part = { id: 'evt_pr1', type: 'charge.refunded', livemode: false, data: { object: { id: 'ch_p', refunded: false, amount_refunded: 100, customer: 'cus_1', metadata: { orderId: out.orderId } } } };
    assert.strictEqual((await stripePost(a, part)).body.outcome, 'review');
    assert.ok(!a.db.store.get('premium_entitlements/old').frozen);
    assert.strictEqual(a.db.store.get('premium_orders/' + out.orderId).refundKind, 'partial');
    const pRow = rows(a, 'premium_review').find(function (r) { return r.reason === 'stripe_charge_refunded'; });
    assert.strictEqual(pRow.partial, true);
    assert.strictEqual(pRow.frozen, 0);
    // Full refund by hand: perks freeze until an admin restores.
    const full = { id: 'evt_fr1', type: 'charge.refunded', livemode: false, data: { object: { id: 'ch_f', refunded: true, amount_refunded: 475, customer: 'cus_1', metadata: { orderId: out.orderId } } } };
    assert.strictEqual((await stripePost(a, full)).body.outcome, 'review');
    assert.strictEqual(a.db.store.get('premium_entitlements/old').frozen, true);
    assert.strictEqual(a.db.store.get('premium_orders/' + out.orderId).refundKind, 'full');
    assert.strictEqual(premium.isPremiumActive(a.db.store.get('premium_entitlements/old'), a.clock.now), false);
    // Cancel = no renewal, paid time stays (no refund, no early cut-off).
    const b = setup();
    const o2 = await b.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old'));
    await stripePost(b, completed(o2.orderId, 'cs_test_1', { amount_total: 4750 }));
    await stripePost(b, invoicePaid(o2.orderId, 4750, { billing_reason: 'subscription_create' }));
    const until = b.db.store.get('premium_entitlements/old').subscriptionUntilMs;
    const upd = { id: 'evt_cx', type: 'customer.subscription.updated', livemode: false, data: { object: { id: 'sub_1', status: 'active', cancel_at_period_end: true, metadata: { orderId: o2.orderId } } } };
    assert.strictEqual((await stripePost(b, upd)).body.outcome, 'not_renewing');
    const e2 = b.db.store.get('premium_entitlements/old');
    assert.strictEqual(e2.autoRenew, false);
    assert.strictEqual(e2.subscriptionUntilMs, until);
    assert.strictEqual(premium.isPremiumActive(e2, b.clock.now), true);
});

test('No refunds: a refunded Founders seat never returns to sale (sold stays, retired counted once)', async function () {
    const a = setup();
    a.db.store.set('premium_counters/founders', { sold: 499, holds: {} });
    const out = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    await stripePost(a, completed(out.orderId, 'cs_test_1', { amount_total: 14250, mode: 'payment', subscription: null }));
    assert.strictEqual(a.db.store.get('premium_counters/founders').sold, 500);
    const full = { id: 'evt_ffr', type: 'charge.refunded', livemode: false, data: { object: { id: 'ch_ff', refunded: true, amount_refunded: 14250, customer: 'cus_1', metadata: { orderId: out.orderId } } } };
    assert.strictEqual((await stripePost(a, full)).body.outcome, 'review');
    const c = a.db.store.get('premium_counters/founders');
    assert.strictEqual(c.sold, 500);
    assert.strictEqual(c.retired, 1);
    assert.strictEqual(a.db.store.get('premium_orders/' + out.orderId).seatRetired, true);
    assert.strictEqual(a.db.store.get('premium_entitlements/old').frozen, true);
    // Replay with a new event id (e.g. a second refund object) does not double count.
    const again = JSON.parse(JSON.stringify(full)); again.id = 'evt_ffr2';
    await stripePost(a, again);
    assert.strictEqual(a.db.store.get('premium_counters/founders').retired, 1);
    // Still sold out: the refunded seat is not for sale again.
    assert.strictEqual(premium.foundersLeft(a.db.store.get('premium_counters/founders'), a.clock.now), 0);
    await rejects(a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('new')), 'founders_sold_out');
    // Admin restore does not touch the counter either.
    a.db.store.set('users/adminx', {});
    await a.h.adminRevokePremium({ action: 'restore', uid: 'old', reason: 'refund reversed' }, ctx('adminx', { admin: true }));
    assert.strictEqual(a.db.store.get('premium_counters/founders').sold, 500);
});

test('User Data: full refund clears the plain email at once; partial refund does not', async function () {
    const a = setup();
    const r = await publicPost(a, { plan: 'monthly', rail: 'card', email: 'refund@example.com', turnstileToken: 'ok-token' });
    const orderId = lastOrderId(a);
    await stripePost(a, completed(orderId, a.db.store.get('premium_orders/' + orderId).providerSessionId, { amount_total: 500 }));
    await stripePost(a, { id: 'evt_pr', type: 'charge.refunded', livemode: false, data: { object: { id: 'ch_1', refunded: false, amount_refunded: 100, customer: 'cus_1' } } });
    assert.strictEqual(a.db.store.get('premium_orders/' + orderId).email, 'refund@example.com');
    await stripePost(a, { id: 'evt_fr', type: 'charge.refunded', livemode: false, data: { object: { id: 'ch_1', refunded: true, amount_refunded: 500, customer: 'cus_1' } } });
    const o = a.db.store.get('premium_orders/' + orderId);
    assert.strictEqual(o.email, null);
    assert.strictEqual(o.emailClearedReason, 'refunded');
    assert.ok(/^[0-9a-f]{40}$/.test(o.emailKey));
    // The email-held entitlement never stores the plain email, and is frozen.
    const held = a.db.store.get('premium_email_entitlements/' + o.emailKey);
    assert.strictEqual(held.email, undefined);
    assert.strictEqual(held.frozen, true);
});
test('User Data: unclaimed public order email cleared after 3 months (configurable); claim clears it at once', async function () {
    assert.strictEqual(pricing.DEFAULT_CONFIG.publicOrderEmailRetentionMonths, 3);
    const a = setup();
    const r = await publicPost(a, { plan: 'monthly', rail: 'card', email: 'keep@example.com', turnstileToken: 'ok-token' });
    const id = lastOrderId(a);
    a.clock.now = pricing.addMonths(T0, 3) - 1000;
    assert.strictEqual((await a.h.sweepExpired(10)).emailsCleared, 0);
    a.clock.now = pricing.addMonths(T0, 3) + 1000;
    assert.strictEqual((await a.h.sweepExpired(10)).emailsCleared, 1);
    assert.strictEqual(a.db.store.get('premium_orders/' + id).email, null);
    assert.strictEqual(a.db.store.get('premium_orders/' + id).emailClearedReason, 'retention');
    const b = setup({ config: { publicOrderEmailRetentionMonths: 6 } });
    const r2 = await publicPost(b, { plan: 'monthly', rail: 'card', email: 'six@example.com', turnstileToken: 'ok-token' });
    b.clock.now = pricing.addMonths(T0, 6) + 1;
    await b.h.sweepExpired(10);
    assert.strictEqual(b.db.store.get('premium_orders/' + lastOrderId(b)).email, null);
    // Claim by a verified account clears it immediately.
    const c = setup();
    const r3 = await publicPost(c, { plan: 'monthly', rail: 'card', email: 'claim.me+x@gmail.com', turnstileToken: 'ok-token' });
    await stripePost(c, completed(lastOrderId(c), c.db.store.get('premium_orders/' + lastOrderId(c)).providerSessionId, { amount_total: 500 }));
    c.db.store.set('users/claimer', {});
    assert.strictEqual((await c.h.claimPremiumByEmail({}, ctx('claimer', { email: 'claim.me+x@gmail.com' }))).claimed, true);
    const o = c.db.store.get('premium_orders/' + lastOrderId(c));
    assert.strictEqual(o.email, null);
    assert.strictEqual(o.emailClearedReason, 'claimed');
});
test('Red Team L3: email-held claims use the exact email; plus-tags and Gmail dots cannot take another purchase', async function () {
    const key = FAKE_ENV.PREMIUM_HASH_KEY;
    assert.notStrictEqual(premium.emailKey('alice@corp.com', key), premium.emailKey('alice+x@corp.com', key));
    assert.notStrictEqual(premium.emailKey('j.doe@gmail.com', key), premium.emailKey('jdoe@gmail.com', key));
    assert.strictEqual(premium.emailKey('alice@corp.com', key), premium.emailKey('  ALICE@corp.com ', key));
    assert.strictEqual(premium.trialEmailKey('alice+x@corp.com', key), premium.emailKey('alice@corp.com', key));
    async function paidPublic(a, email, sessionId) {
        const r = await publicPost(a, { plan: 'monthly', rail: 'card', email: email, turnstileToken: 'ok-token' });
        assert.strictEqual(r.code, 200);
        const id = lastOrderId(a);
        await stripePost(a, completed(id, a.db.store.get('premium_orders/' + id).providerSessionId, { amount_total: 500, customer: 'cus_' + sessionId }));
        return id;
    }
    // alice+x@ cannot claim alice@'s held purchase.
    const a = setup();
    await paidPublic(a, 'alice@corp.com', 'a1');
    a.db.store.set('users/plus', {});
    const plus = await a.h.claimPremiumByEmail({}, ctx('plus', { email: 'alice+x@corp.com' }));
    assert.strictEqual(plus.claimed, false);
    assert.strictEqual(plus.reason, 'nothing_to_claim');
    a.db.store.set('users/alice', {});
    assert.strictEqual((await a.h.claimPremiumByEmail({}, ctx('alice', { email: 'alice@corp.com' }))).claimed, true);
    // alice@ cannot claim alice+x@'s held purchase.
    const b = setup();
    await paidPublic(b, 'alice+x@corp.com', 'b1');
    b.db.store.set('users/plain', {});
    const plain = await b.h.claimPremiumByEmail({}, ctx('plain', { email: 'alice@corp.com' }));
    assert.strictEqual(plain.claimed, false);
    assert.strictEqual(plain.reason, 'nothing_to_claim');
    b.db.store.set('users/tagged', {});
    assert.strictEqual((await b.h.claimPremiumByEmail({}, ctx('tagged', { email: 'alice+x@corp.com' }))).claimed, true);
    // Gmail dots: j.doe@ cannot claim jdoe@'s purchase, and the reverse.
    const c = setup();
    await paidPublic(c, 'jdoe@gmail.com', 'c1');
    c.db.store.set('users/dotted', {});
    const dotted = await c.h.claimPremiumByEmail({}, ctx('dotted', { email: 'j.doe@gmail.com' }));
    assert.strictEqual(dotted.claimed, false);
    assert.strictEqual(dotted.reason, 'nothing_to_claim');
    c.db.store.set('users/nodot', {});
    assert.strictEqual((await c.h.claimPremiumByEmail({}, ctx('nodot', { email: 'jdoe@gmail.com' }))).claimed, true);
    const d = setup();
    await paidPublic(d, 'j.doe@gmail.com', 'd1');
    d.db.store.set('users/nodot2', {});
    const nodot = await d.h.claimPremiumByEmail({}, ctx('nodot2', { email: 'jdoe@gmail.com' }));
    assert.strictEqual(nodot.claimed, false);
    assert.strictEqual(nodot.reason, 'nothing_to_claim');
    d.db.store.set('users/dotted2', {});
    assert.strictEqual((await d.h.claimPremiumByEmail({}, ctx('dotted2', { email: 'j.doe@gmail.com' }))).claimed, true);
});
test('Spam: claimPremiumByEmail re-checks banned and minor accounts', async function () {
    const a = setup();
    a.db.store.set('users/bad', { banned: true });
    a.db.store.set('users/kid', { isMinor: true });
    await rejects(a.h.claimPremiumByEmail({}, ctx('bad')), 'banned');
    await rejects(a.h.claimPremiumByEmail({}, ctx('kid')), 'minor');
});
test('Spam: Turnstile must match action premium_checkout and an allowed hostname for the environment', async function () {
    const wrongHost = setup({ tsHost: 'evil.example' });
    assert.strictEqual((await publicPost(wrongHost, { plan: 'monthly', rail: 'card', email: 'a@example.com', turnstileToken: 'ok-token' })).body.reason, 'turnstile');
    const wrongAction = setup({ tsAction: 'login' });
    assert.strictEqual((await publicPost(wrongAction, { plan: 'monthly', rail: 'card', email: 'a@example.com', turnstileToken: 'ok-token' })).body.reason, 'turnstile');
    const liveHostOnStaging = setup({ tsHost: 'bitcoineducation.quest' });
    assert.strictEqual((await publicPost(liveHostOnStaging, { plan: 'monthly', rail: 'card', email: 'a@example.com', turnstileToken: 'ok-token' })).body.reason, 'turnstile');
    const preview = setup({ tsHost: 'abc123.bitcoin-quest.pages.dev' });
    assert.strictEqual((await publicPost(preview, { plan: 'monthly', rail: 'card', email: 'a@example.com', turnstileToken: 'ok-token' })).code, 200);
    assert.strictEqual(premium.TURNSTILE_ACTION, 'premium_checkout');
    const html = require('fs').readFileSync(path.join(__dirname, '..', 'premium.html'), 'utf8');
    assert.ok(/data-action="premium_checkout"/.test(html));
});
test('Red Team 6: unknown project is fail-closed (no test origins, no CORS, no Turnstile pass)', async function () {
    const a = setup({ projectId: 'some-other-project' });
    for (const origin of ['https://bitcoin-quest-staging.web.app', 'https://preview1.bitcoin-quest.pages.dev', 'http://localhost:5000', 'https://bitcoineducation.quest']) {
        const pre = fakeRes();
        await a.h.premiumPublicCheckout(req(null, { Origin: origin }, { method: 'OPTIONS' }), pre);
        assert.strictEqual(pre.code, 403, origin);
        assert.strictEqual(pre.headers['access-control-allow-origin'], undefined);
        assert.strictEqual((await publicPost(a, { plan: 'monthly', rail: 'card', email: 'a@example.com', turnstileToken: 'ok-token' }, origin)).code, 403);
    }
    assert.strictEqual(premium.providerMode('some-other-project'), null);
    assert.strictEqual(a.calls.length, 0);
});
test('5% end date: config can end it earlier, never later than 2027-01-01 00:00 ET', async function () {
    const late = pricing.normalizeConfig({ existingUserDiscountEndsAtMs: Date.parse('2030-01-01T00:00:00Z') });
    assert.strictEqual(late.existingUserDiscountEndsAtMs, pricing.EXISTING_DISCOUNT_ENDS_MS);
    const early = Date.parse('2026-12-15T05:00:00Z');
    assert.strictEqual(pricing.normalizeConfig({ existingUserDiscountEndsAtMs: early }).existingUserDiscountEndsAtMs, early);
    assert.strictEqual(pricing.normalizeConfig({}).existingUserDiscountEndsAtMs, pricing.EXISTING_DISCOUNT_ENDS_MS);
});
test('BTCPay: on-chain settlement goes to review, Lightning grants', async function () {
    const a = setup();
    const o = await a.h.createPremiumCheckout({ plan: 'yearly', rail: 'lightning' }, ctx('old'));
    const invId = a.db.store.get('premium_orders/' + o.orderId).providerInvoiceId;
    a.btcInvoices[invId].status = 'Settled';
    const b2 = setup({ btcMethod: {} });
    void b2;
    // Same store, but mark this invoice as paid on-chain.
    const chain = setup({ btcMethod: { Inv00000001: 'BTC-CHAIN' } });
    const oc = await chain.h.createPremiumCheckout({ plan: 'yearly', rail: 'lightning' }, ctx('old'));
    const ci = chain.db.store.get('premium_orders/' + oc.orderId).providerInvoiceId;
    assert.strictEqual(ci, 'Inv00000001');
    chain.btcInvoices[ci].status = 'Settled';
    assert.strictEqual((await btcPost(chain, { type: 'InvoiceSettled', invoiceId: ci, storeId: 'StoreABC12345' })).body.outcome, 'review');
    assert.strictEqual(chain.db.store.get('premium_orders/' + oc.orderId).reviewReason, 'not_lightning');
    assert.ok(!chain.db.store.has('premium_entitlements/old') || !premium.isPremiumActive(chain.db.store.get('premium_entitlements/old'), T0));
    assert.strictEqual((await btcPost(a, { type: 'InvoiceSettled', invoiceId: invId, storeId: 'StoreABC12345' })).body.outcome, 'granted');
    assert.deepStrictEqual(premium.nonLightningPayments([{ paymentMethodId: 'BTC-LightningNetwork', payments: [{}] }, { paymentMethodId: 'BTC', payments: [] }]), []);
    assert.deepStrictEqual(premium.nonLightningPayments([{ paymentMethodId: 'BTC', payments: [{}] }]), ['BTC']);
    assert.deepStrictEqual(premium.nonLightningPayments(null), ['unreadable']);
});
test('Red Team 5: adminRevokePremium needs admin + fresh step-up and writes an audit row', async function () {
    const a = setup();
    a.db.store.set('premium_entitlements/old', { prepaidUntilMs: T0 + 9e9 });
    await rejects(a.h.adminRevokePremium({ action: 'revoke', uid: 'old', reason: 'abuse' }, ctx('someone')), 'not_admin');
    const denied = setup({ stepUp: async function () { throw new HttpsError('failed-precondition', 'step up', { reason: 'step_up' }); } });
    denied.db.store.set('premium_entitlements/old', { prepaidUntilMs: T0 + 9e9 });
    await assert.rejects(denied.h.adminRevokePremium({ action: 'revoke', uid: 'old', reason: 'abuse' }, ctx('adminx', { admin: true })));
    assert.strictEqual(rows(denied, 'premium_admin_audit').length, 0);
    await rejects(a.h.adminRevokePremium({ action: 'revoke', uid: 'old', reason: '' }, ctx('adminx', { admin: true })), 'no_reason');
    const out = await a.h.adminRevokePremium({ action: 'revoke', uid: 'old', reason: 'chargeback' }, ctx('adminx', { admin: true }));
    assert.strictEqual(out.active, false);
    assert.strictEqual(a.db.store.get('users/old').premium.active, false);
    const audit = rows(a, 'premium_admin_audit');
    assert.strictEqual(audit.length, 1);
    assert.strictEqual(audit[0].adminUid, 'adminx');
    assert.strictEqual(audit[0].activeBefore, true);
    const sf = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'src', 'secondFactor.js'), 'utf8');
    assert.ok(/adminRevokePremium: true/.test(sf));
});
test('User Data: account deletion masks uid on orders/ledger/review, clears emails, drops entitlement', async function () {
    const a = setup({ config: { perksStartAtMs: LAUNCH } });
    const out = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('old'));
    await stripePost(a, completed(out.orderId, 'cs_test_1', { amount_total: 475 }));
    await stripePost(a, invoicePaid(out.orderId, 475, { billing_reason: 'subscription_create' }));
    await a.h.claimPremiumAllowance({}, ctx('old'));
    const r = await publicPost(a, { plan: 'monthly', rail: 'card', email: 'old@example.com', turnstileToken: 'ok-token' });
    const pubId = lastOrderId(a);
    await stripePost(a, completed(lastOrderId(a), a.db.store.get('premium_orders/' + lastOrderId(a)).providerSessionId, { amount_total: 500, customer: 'cus_7', subscription: 'sub_7' }));
    await a.h.claimPremiumByEmail({}, ctx('old'));
    a.db.store.set('premium_review/x1', { reason: 'test', uid: 'old' });
    const res = await premium.purgePremiumForAccount(a.db, 'old', a.clock.now);
    const masked = premium.maskDeletedUid('old');
    assert.strictEqual(res.masked, masked);
    assert.ok(/^del_[0-9a-f]{24}$/.test(masked));
    const o1 = a.db.store.get('premium_orders/' + out.orderId);
    assert.strictEqual(o1.uid, masked);
    assert.strictEqual(o1.email, null);
    assert.strictEqual(o1.emailKey, null);
    const o2 = a.db.store.get('premium_orders/' + pubId);
    assert.strictEqual(o2.email, null);
    assert.strictEqual(o2.emailKey, null);
    assert.ok(!a.db.store.has('premium_entitlements/old'));
    assert.ok(!a.db.store.has('premium_allowance/old'));
    assert.strictEqual(Array.from(a.db.store.keys()).filter(function (k) { return k.indexOf('premium_email_entitlements/') === 0; }).length, 0);
    const ledger = rows(a, 'premium_allowance_ledger');
    assert.strictEqual(ledger.length, 1);
    assert.strictEqual(ledger[0].uid, masked);
    assert.strictEqual(a.db.store.get('premium_review/x1').uid, masked);
    assert.strictEqual(res.activeSubscription, true);
    assert.ok(rows(a, 'premium_review').some(function (x) { return x.reason === 'deleted_account_active_subscription'; }));
    const left = storeJson(a);
    assert.strictEqual(left.indexOf('old@example.com'), -1);
    assert.strictEqual(left.indexOf('"uid":"old"'), -1);
});
test('Retention: orders, events, review, ledger, trial markers, admin audit are permanent everywhere', async function () {
    const perm = premium.PERMANENT_COLLECTIONS;
    ['premium_orders', 'premium_events', 'premium_review', 'premium_allowance_ledger', 'premium_trial_markers', 'premium_admin_audit'].forEach(function (c) { assert.ok(perm.indexOf(c) !== -1, c); });
    ['premium_rate', 'premium_counters', 'premium_entitlements', 'premium_allowance'].forEach(function (c) { assert.strictEqual(perm.indexOf(c), -1, c); });
    const del = require('../functions/src/deleteAccount');
    perm.forEach(function (c) { assert.ok(del.RETAINED_COLLECTIONS.indexOf(c) !== -1, 'deleteAccount retains ' + c); });
    const delSrc = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'src', 'deleteAccount.js'), 'utf8');
    assert.ok(/purgePremiumForAccount\(db, uid\)/.test(delSrc), 'purgeAccount wires the premium purge');
    const doc = require('fs').readFileSync(path.join(__dirname, '..', 'docs', 'payments', 'premium-checkout.md'), 'utf8');
    perm.forEach(function (c) { assert.ok(doc.indexOf(c) !== -1, 'docs vault list ' + c); });
});
test('Portal config script: promotion codes and plan switching off; test keys only', async function () {
    const P = require('../functions/scripts/premium-portal-config').PARAMS;
    assert.strictEqual(P.features.subscription_update.enabled, false);
    assert.strictEqual(P.features.subscription_update.default_allowed_updates, '');
    assert.ok(premium.stripeForm(P).indexOf('promotion_code') === -1);
    assert.strictEqual(pricing.normalizeConfig({ stripePortalConfigId: 'bad id' }).stripePortalConfigId, null);
    assert.strictEqual(pricing.normalizeConfig({ stripePortalConfigId: 'bpc_1AbCdEf' }).stripePortalConfigId, 'bpc_1AbCdEf');
});
test('No BTCPay on staging: secrets unbound and webhook not exported there; live binds them', async function () {
    const fv1 = require(require.resolve('firebase-functions/v1', { paths: [path.join(__dirname, '..', 'functions')] }));
    const names = function (fn) { return ((fn.__endpoint && fn.__endpoint.secretEnvironmentVariables) || []).map(function (x) { return x.key; }).sort(); };
    const prev = process.env.PREMIUM_BTCPAY;
    const prevP = process.env.GCLOUD_PROJECT;
    const prevG = process.env.GOOGLE_CLOUD_PROJECT;
    const prevF = process.env.FIREBASE_CONFIG;
    function restore() {
        if (prev === undefined) delete process.env.PREMIUM_BTCPAY; else process.env.PREMIUM_BTCPAY = prev;
        if (prevP === undefined) delete process.env.GCLOUD_PROJECT; else process.env.GCLOUD_PROJECT = prevP;
        if (prevG === undefined) delete process.env.GOOGLE_CLOUD_PROJECT; else process.env.GOOGLE_CLOUD_PROJECT = prevG;
        if (prevF === undefined) delete process.env.FIREBASE_CONFIG; else process.env.FIREBASE_CONFIG = prevF;
    }
    try {
        delete process.env.PREMIUM_BTCPAY;
        delete process.env.GCLOUD_PROJECT;
        delete process.env.GOOGLE_CLOUD_PROJECT;
        delete process.env.FIREBASE_CONFIG;
        process.env.GCLOUD_PROJECT = 'bitcoin-education-archive';
        const on = premium.bindPremium(fv1, { db: {}, admin: {} });
        assert.ok(names(on.createPremiumCheckout).indexOf('BTCPAY_API_KEY') !== -1);
        delete process.env.GCLOUD_PROJECT;
        process.env.PREMIUM_BTCPAY = 'off';
        const off = premium.bindPremium(fv1, { db: {}, admin: {} });
        assert.deepStrictEqual(names(off.createPremiumCheckout), ['PREMIUM_HASH_KEY', 'STRIPE_SECRET_KEY']);
        assert.strictEqual(names(off.premiumPublicCheckout).indexOf('BTCPAY_URL'), -1);
        assert.strictEqual(off.premiumBtcpayWebhook, undefined);
        assert.ok(on.premiumBtcpayWebhook);
        assert.ok(names(on.premiumBtcpayWebhook).indexOf('BTCPAY_API_KEY') !== -1);
        assert.strictEqual(premium.btcpayOff({ GCLOUD_PROJECT: 'bitcoin-quest-staging' }), true);
        assert.strictEqual(premium.btcpayOff({ FIREBASE_CONFIG: JSON.stringify({ projectId: 'bitcoin-quest-staging' }) }), true);
        assert.strictEqual(premium.btcpayOff({ GCLOUD_PROJECT: 'bitcoin-education-archive' }), false);
        assert.strictEqual(premium.btcpayOff({}), false);
        delete process.env.PREMIUM_BTCPAY;
        process.env.GCLOUD_PROJECT = 'bitcoin-quest-staging';
        const stg = premium.bindPremium(fv1, { db: {}, admin: {} });
        assert.strictEqual(stg.premiumBtcpayWebhook, undefined);
        assert.strictEqual(names(stg.createPremiumCheckout).indexOf('BTCPAY_API_KEY'), -1);
    } finally { restore(); }
});
test('Keyed hashes only: no plain IP or card fingerprint stored; rate docs carry expireAt', async function () {
    const a = setup({ defaultCardFp: 'fp_plain_value' });
    const r = await publicPost(a, { plan: 'monthly', rail: 'card', email: 'kh@example.com', turnstileToken: 'ok-token' }, null, '192.0.2.77');
    await stripePost(a, completed(lastOrderId(a), a.db.store.get('premium_orders/' + lastOrderId(a)).providerSessionId, { amount_total: 500 }));
    const all = storeJson(a);
    assert.strictEqual(all.indexOf('192.0.2.77'), -1);
    assert.strictEqual(all.indexOf('fp_plain_value'), -1);
    const plainSha = crypto.createHash('sha256').update('kh@example.com').digest('hex').slice(0, 40);
    assert.strictEqual(all.indexOf(plainSha), -1);
    rows(a, 'premium_rate').forEach(function (d) { assert.ok(d.expireAt, 'expireAt'); });
    assert.ok(rows(a, 'premium_rate').length >= 2); // per-IP + global
    assert.throws(function () { premium.keyedHash('short', 'ip', '1.2.3.4'); });
    assert.notStrictEqual(premium.keyedHash('k'.repeat(16), 'ip', '1.2.3.4'), premium.keyedHash('j'.repeat(16), 'ip', '1.2.3.4'));
    const noKey = setup({ env: { PREMIUM_HASH_KEY: '' } });
    assert.strictEqual((await publicPost(noKey, { plan: 'monthly', rail: 'card', email: 'kh@example.com', turnstileToken: 'ok-token' })).body.reason, 'hash_key');
});

function subEvent(type, orderId, obj) {
    return { id: 'evt_' + crypto.randomBytes(4).toString('hex'), type: type, livemode: false, data: { object: Object.assign({ id: 'sub_1', metadata: { orderId: orderId } }, obj) } };
}
async function trialGranted(a, uid) {
    const out = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx(uid));
    assert.strictEqual((await stripePost(a, completed(out.orderId, 'cs_test_1', { amount_total: 0, payment_status: 'no_payment_required' }))).body.outcome, 'granted');
    return out;
}

test('Spam MED 2: a trial canceled right away ends at trial_end with no grace period', async function () {
    const a = setup({ config: { trialsEnabled: true, trialDays: 7 } });
    const out = await trialGranted(a, 'new');
    const trialEnd = T0 + 7 * 86400000;
    assert.strictEqual(a.db.store.get('premium_entitlements/new').subscriptionUntilMs, trialEnd + 3 * 86400000);
    const del = subEvent('customer.subscription.deleted', out.orderId, { status: 'canceled', trial_end: trialEnd / 1000, canceled_at: T0 / 1000 + 60, ended_at: T0 / 1000 + 60, cancellation_details: { reason: 'cancellation_requested', comment: null } });
    a.clock.now = T0 + 60000;
    assert.strictEqual((await stripePost(a, del)).body.outcome, 'trial_ends');
    const ent = a.db.store.get('premium_entitlements/new');
    assert.strictEqual(ent.subscriptionUntilMs, trialEnd);
    assert.strictEqual(ent.autoRenew, false);
    assert.strictEqual(ent.subscriptionEndedReason, 'trial_canceled');
    assert.strictEqual(premium.isPremiumActive(ent, trialEnd - 1), true);
    assert.strictEqual(premium.isPremiumActive(ent, trialEnd + 1), false);
    assert.strictEqual(a.db.store.get('users/new').premium.expiresAtMs, trialEnd);
});

test('Spam MED 2: cancel at period end during a trial ends at trial_end; undoing it restores trial_end + grace', async function () {
    const a = setup({ config: { trialsEnabled: true, trialDays: 7 } });
    const out = await trialGranted(a, 'new');
    const trialEnd = T0 + 7 * 86400000;
    const upd = subEvent('customer.subscription.updated', out.orderId, { status: 'trialing', trial_end: trialEnd / 1000, cancel_at_period_end: true, cancel_at: trialEnd / 1000 });
    assert.strictEqual((await stripePost(a, upd)).body.outcome, 'trial_ends');
    assert.strictEqual(a.db.store.get('premium_entitlements/new').subscriptionUntilMs, trialEnd);
    const back = subEvent('customer.subscription.updated', out.orderId, { status: 'trialing', trial_end: trialEnd / 1000, cancel_at_period_end: false });
    assert.strictEqual((await stripePost(a, back)).body.outcome, 'renewing');
    const ent = a.db.store.get('premium_entitlements/new');
    assert.strictEqual(ent.subscriptionUntilMs, trialEnd + 3 * 86400000);
    assert.strictEqual(ent.autoRenew, true);
    assert.strictEqual(ent.subscriptionEndedReason, null);
});

test('Spam MED 2: grace stays for paid periods (cancel after the trial converted)', async function () {
    const a = setup({ config: { trialsEnabled: true, trialDays: 7 } });
    const out = await trialGranted(a, 'new');
    const trialEnd = T0 + 7 * 86400000;
    const periodEnd = Math.floor((trialEnd + 30 * 86400000) / 1000);
    a.clock.now = trialEnd + 1000;
    assert.strictEqual((await stripePost(a, invoicePaid(out.orderId, 500, { billing_reason: 'subscription_cycle', lines: { data: [{ period: { end: periodEnd } }] } }))).body.outcome, 'granted');
    const paidUntil = a.db.store.get('premium_entitlements/new').subscriptionUntilMs;
    assert.strictEqual(paidUntil, periodEnd * 1000 + 3 * 86400000);
    a.clock.now = trialEnd + 86400000;
    const del = subEvent('customer.subscription.deleted', out.orderId, { status: 'canceled', trial_end: trialEnd / 1000, canceled_at: a.clock.now / 1000, ended_at: a.clock.now / 1000, cancellation_details: { reason: 'cancellation_requested' } });
    assert.strictEqual((await stripePost(a, del)).body.outcome, 'not_renewing');
    assert.strictEqual(a.db.store.get('premium_entitlements/new').subscriptionUntilMs, paidUntil);
    // Paid yearly with no trial: cancel keeps paid time + grace.
    const b = setup();
    const o2 = await b.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old'));
    await stripePost(b, completed(o2.orderId, 'cs_test_1'));
    const before = b.db.store.get('premium_entitlements/old').subscriptionUntilMs;
    const del2 = subEvent('customer.subscription.deleted', o2.orderId, { status: 'canceled', canceled_at: T0 / 1000, ended_at: T0 / 1000, cancellation_details: { reason: 'cancellation_requested' } });
    assert.strictEqual((await stripePost(b, del2)).body.outcome, 'not_renewing');
    assert.strictEqual(b.db.store.get('premium_entitlements/old').subscriptionUntilMs, before);
});

test('Spam MED 1: a subscription canceled for fraud or trial_reused ends Premium now, with a review row for fraud', async function () {
    const cases = [
        { cd: { reason: 'cancellation_requested', comment: 'fraud: stolen card' }, why: 'fraud' },
        { cd: { reason: 'cancellation_requested', comment: 'trial_reused' }, why: 'trial_reused' },
        { cd: { reason: 'payment_disputed' }, why: 'payment_disputed' },
        { cd: { reason: 'cancellation_requested' }, meta: 'fraud', why: 'fraud' },
    ];
    for (const c of cases) {
        const a = setup();
        const out = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('old'));
        await stripePost(a, completed(out.orderId, 'cs_test_1', { amount_total: 475 }));
        assert.strictEqual(premium.isPremiumActive(a.db.store.get('premium_entitlements/old'), a.clock.now), true);
        a.clock.now = T0 + 3600000;
        const meta = { orderId: out.orderId };
        if (c.meta) meta.bqCancelReason = c.meta;
        const del = subEvent('customer.subscription.deleted', out.orderId, { status: 'canceled', canceled_at: a.clock.now / 1000, ended_at: a.clock.now / 1000, cancellation_details: c.cd, metadata: meta });
        assert.strictEqual((await stripePost(a, del)).body.outcome, 'revoked', c.why);
        const ent = a.db.store.get('premium_entitlements/old');
        assert.strictEqual(ent.subscriptionUntilMs, a.clock.now, c.why);
        assert.strictEqual(ent.subscriptionEndedReason, c.why);
        assert.strictEqual(premium.isPremiumActive(ent, a.clock.now), false);
        assert.strictEqual(a.db.store.get('users/old').premium.active, false);
        const rr = rows(a, 'premium_review').filter(function (r) { return r.reason === 'subscription_revoked'; });
        assert.strictEqual(rr.length, c.why === 'trial_reused' ? 0 : 1, c.why);
    }
});

test('Spam MED 1: trial_reused cancel sends cancellation_details[comment]=trial_reused to Stripe', async function () {
    const a = setup({ config: { trialsEnabled: true, trialDays: 7 }, defaultCardFp: 'fp_same_card' });
    await trialGranted(a, 'old');
    const o2 = await a.h.createPremiumCheckout({ plan: 'monthly', rail: 'card' }, ctx('new', { email: 'two@example.com' }));
    await stripePost(a, completed(o2.orderId, 'cs_test_2', { amount_total: 0, payment_status: 'no_payment_required', customer: 'cus_2', subscription: 'sub_2' }));
    const del = a.calls.filter(function (c) { return c.init.method === 'DELETE' && c.url === 'https://api.stripe.com/v1/subscriptions/sub_2'; });
    assert.strictEqual(del.length, 1);
    assert.strictEqual(bodyOf(del[0]), 'cancellation_details[comment]=trial_reused');
    // The first (legit) trial is untouched.
    assert.strictEqual(premium.isPremiumActive(a.db.store.get('premium_entitlements/old'), a.clock.now), true);
});

// ---------- Red Team F1: refund or dispute processed before checkout completes
function fullRefund(id, orderId, extra) {
    return { id: id, type: 'charge.refunded', livemode: false, data: { object: Object.assign({ id: 'ch_' + id, refunded: true, amount_refunded: 4750, metadata: orderId ? { orderId: orderId } : {} }, extra || {}) } };
}
function adminRows(a, type) { return rows(a, 'admin_notifications').filter(function (r) { return r.type === type; }); }
function founderDone(orderId, session) { return completed(orderId, session, { amount_total: 14250, mode: 'payment', subscription: null }); }

test('F1: full refund before completion stamps the order; completion then grants frozen (yearly)', async function () {
    const a = setup();
    const out = await a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old'));
    assert.strictEqual((await stripePost(a, fullRefund('evt_f1r', out.orderId))).body.outcome, 'review');
    const o1 = a.db.store.get('premium_orders/' + out.orderId);
    assert.strictEqual(o1.refundKind, 'full');
    assert.strictEqual(o1.status, 'pending');
    assert.ok(!a.db.store.has('premium_entitlements/old'));
    await stripePost(a, completed(out.orderId, 'cs_test_1'));
    const e = a.db.store.get('premium_entitlements/old');
    assert.strictEqual(e.frozen, true);
    assert.strictEqual(e.frozenReason, 'charge.refunded');
    assert.strictEqual(premium.isPremiumActive(e, a.clock.now), false);
    assert.strictEqual(a.db.store.get('users/old').premium.active, false);
    assert.ok(rows(a, 'premium_review').some(function (r) { return r.reason === 'stripe_completed_after_charge_refunded' && r.orderId === out.orderId; }));
    const n = adminRows(a, 'premium_review').filter(function (r) { return /completed after a full refund/.test(r.text); });
    assert.strictEqual(n.length, 1);
    assert.strictEqual(n[0].uid, 'old\u2026');
});

test('F1: async_payment_succeeded after a full refund also grants frozen', async function () {
    const a = setup();
    const out = await a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old'));
    await stripePost(a, fullRefund('evt_f1ra', out.orderId));
    const ev = completed(out.orderId, 'cs_test_1'); ev.type = 'checkout.session.async_payment_succeeded';
    await stripePost(a, ev);
    assert.strictEqual(a.db.store.get('premium_entitlements/old').frozen, true);
});

test('F1: dispute before completion (no order metadata) is traced through Stripe; completion grants frozen', async function () {
    const piSessions = {};
    const a = setup({ charges: { ch_disp0001: { id: 'ch_disp0001', metadata: {}, payment_intent: 'pi_disp0001' } }, piSessions: piSessions });
    const out = await a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old'));
    piSessions.pi_disp0001 = { id: 'cs_test_1', client_reference_id: out.orderId };
    const disp = { id: 'evt_f1d', type: 'charge.dispute.created', livemode: false, data: { object: { id: 'dp_f1', amount: 4750, charge: 'ch_disp0001' } } };
    assert.strictEqual((await stripePost(a, disp)).body.outcome, 'review');
    const o1 = a.db.store.get('premium_orders/' + out.orderId);
    assert.strictEqual(o1.disputedAtMs, a.clock.now);
    await stripePost(a, completed(out.orderId, 'cs_test_1'));
    const e = a.db.store.get('premium_entitlements/old');
    assert.strictEqual(e.frozen, true);
    assert.strictEqual(e.frozenReason, 'charge.dispute.created');
    assert.ok(rows(a, 'premium_review').some(function (r) { return r.reason === 'stripe_completed_after_charge_dispute_created'; }));
});

test('F1: a payment-intent lookup naming another order\'s session is ignored', async function () {
    const piSessions = {};
    const a = setup({ piSessions: piSessions });
    const out = await a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old'));
    piSessions.pi_other0001 = { id: 'cs_someone_else', client_reference_id: out.orderId };
    const disp = { id: 'evt_f1x', type: 'charge.dispute.created', livemode: false, data: { object: { id: 'dp_x', amount: 4750, payment_intent: 'pi_other0001' } } };
    await stripePost(a, disp);
    assert.ok(!a.db.store.get('premium_orders/' + out.orderId).disputedAtMs);
});

test('F1: Founders refunded before completion: seat sold and retired at once, never back on sale', async function () {
    const a = setup();
    a.db.store.set('premium_counters/founders', { sold: 10, holds: {} });
    const out = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    await stripePost(a, fullRefund('evt_f1fr', out.orderId, { amount_refunded: 14250 }));
    let c = a.db.store.get('premium_counters/founders');
    assert.strictEqual(c.sold, 10);
    assert.ok(!c.retired);
    await stripePost(a, founderDone(out.orderId, 'cs_test_1'));
    c = a.db.store.get('premium_counters/founders');
    assert.strictEqual(c.sold, 11);
    assert.strictEqual(c.retired, 1);
    assert.ok(!c.holds[out.orderId]);
    const o = a.db.store.get('premium_orders/' + out.orderId);
    assert.strictEqual(o.status, 'paid');
    assert.strictEqual(o.seatRetired, true);
    const e = a.db.store.get('premium_entitlements/old');
    assert.strictEqual(e.founders, true);
    assert.strictEqual(e.frozen, true);
    assert.strictEqual(premium.isPremiumActive(e, a.clock.now), false);
    // A second full refund for the same order never counts the seat twice.
    await stripePost(a, fullRefund('evt_f1fr2', out.orderId, { amount_refunded: 14250 }));
    assert.strictEqual(a.db.store.get('premium_counters/founders').retired, 1);
});

test('F1: Founders disputed before completion: seat sold and retired, entitlement frozen', async function () {
    const piSessions = {};
    const a = setup({ piSessions: piSessions });
    a.db.store.set('premium_counters/founders', { sold: 3, holds: {} });
    const out = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    piSessions.pi_fdisp0001 = { id: 'cs_test_1', client_reference_id: out.orderId };
    await stripePost(a, { id: 'evt_f1fd', type: 'charge.dispute.created', livemode: false, data: { object: { id: 'dp_fd', amount: 14250, payment_intent: 'pi_fdisp0001' } } });
    await stripePost(a, founderDone(out.orderId, 'cs_test_1'));
    const c = a.db.store.get('premium_counters/founders');
    assert.strictEqual(c.sold, 4);
    assert.strictEqual(c.retired, 1);
    assert.strictEqual(a.db.store.get('premium_entitlements/old').frozen, true);
    assert.strictEqual(a.db.store.get('premium_entitlements/old').frozenReason, 'charge.dispute.created');
});

test('F1: a partial refund before completion leaves the later grant active', async function () {
    const a = setup();
    const out = await a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old'));
    await stripePost(a, fullRefund('evt_f1p', out.orderId, { refunded: false, amount_refunded: 100 }));
    assert.strictEqual(a.db.store.get('premium_orders/' + out.orderId).refundKind, 'partial');
    await stripePost(a, completed(out.orderId, 'cs_test_1'));
    const e = a.db.store.get('premium_entitlements/old');
    assert.notStrictEqual(e.frozen, true);
    assert.strictEqual(premium.isPremiumActive(e, a.clock.now), true);
});

// ---------- Red Team F2: Founders hold farming
const MIN = 60000;
test('F2: Founders card hold is 10 minutes (config 5..30); bitcoin hold stays matched to the 15-minute invoice', async function () {
    assert.strictEqual(pricing.DEFAULT_CONFIG.foundersCardHoldMinutes, 10);
    assert.strictEqual(pricing.normalizeConfig({ foundersCardHoldMinutes: 2 }).foundersCardHoldMinutes, 10);
    assert.strictEqual(pricing.normalizeConfig({ foundersCardHoldMinutes: 45 }).foundersCardHoldMinutes, 10);
    assert.strictEqual(pricing.normalizeConfig({ foundersCardHoldMinutes: 20 }).foundersCardHoldMinutes, 20);
    const a = setup();
    const c1 = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    assert.strictEqual(a.db.store.get('premium_counters/founders').holds[c1.orderId].expMs, T0 + 10 * MIN);
    assert.strictEqual(a.db.store.get('premium_orders/' + c1.orderId).holdExpMs, T0 + 10 * MIN);
    const c2 = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'lightning' }, ipCtx('new', '198.51.100.77'));
    assert.strictEqual(a.db.store.get('premium_counters/founders').holds[c2.orderId].expMs, T0 + 20 * MIN);
    // Non-Founders card orders hold nothing and keep the 31-minute session.
    const b = setup({ config: { foundersCardHoldMinutes: 20 } });
    const c3 = await b.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    assert.strictEqual(b.db.store.get('premium_counters/founders').holds[c3.orderId].expMs, T0 + 20 * MIN);
});

test('F2: a payment after the short hold lapsed gets a seat only if one is free (never oversold)', async function () {
    const a = setup({ config: { foundersHoldCooldownMinutes: 0 } });
    a.db.store.set('premium_counters/founders', { sold: 498, holds: {} });
    const o1 = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    a.clock.now = T0 + 11 * MIN;
    // Seats are free: the late payment still gets one.
    await stripePost(a, founderDone(o1.orderId, 'cs_test_1'));
    assert.strictEqual(a.db.store.get('premium_counters/founders').sold, 499);
    assert.strictEqual(a.db.store.get('premium_orders/' + o1.orderId).status, 'paid');
    // Last seat: hold lapses, someone else holds the last seat, late payment goes to review.
    const b = setup({ config: { foundersHoldCooldownMinutes: 0 } });
    b.db.store.set('premium_counters/founders', { sold: 499, holds: {} });
    const p1 = await b.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    b.clock.now = T0 + 11 * MIN;
    await b.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('new', '198.51.100.88'));
    assert.strictEqual((await stripePost(b, founderDone(p1.orderId, 'cs_test_1'))).body.outcome, 'review');
    assert.strictEqual(b.db.store.get('premium_counters/founders').sold, 499);
    assert.strictEqual(b.db.store.get('premium_orders/' + p1.orderId).reviewReason, 'founders_sold_out_late_payment');
});

test('F2: live-hold cap hit writes one admin alert + review row per 30 minutes, no uid or email in it', async function () {
    const a = setup({ config: { maxLiveFoundersHolds: 2 } });
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('u1aaaa'));
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('u2aaaa'));
    await rejects(a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('u3aaaa')), 'founders_busy');
    await rejects(a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('u4aaaa')), 'founders_busy');
    const n = adminRows(a, 'premium_founders_cap');
    assert.strictEqual(n.length, 1);
    assert.ok(/2 seats are held/.test(n[0].text));
    assert.ok(!/u3aaaa|u4aaaa|@/.test(JSON.stringify(n)));
    assert.strictEqual(rows(a, 'premium_review').filter(function (r) { return r.reason === 'founders_hold_cap_hit'; }).length, 1);
    // The busy refusal wrote no hold and no order.
    assert.strictEqual(Object.keys(a.db.store.get('premium_counters/founders').holds).length, 2);
    // Next 30-minute window: a new alert.
    a.clock.now = T0 + 31 * MIN;
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('u5aaaa'));
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('u6aaaa'));
    await rejects(a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('u7aaaa')), 'founders_busy');
    assert.strictEqual(adminRows(a, 'premium_founders_cap').length, 2);
});

test('F2: an alert write failure never changes the founders_busy answer', async function () {
    const a = setup({ config: { maxLiveFoundersHolds: 1 } });
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('u1aaaa'));
    const orig = a.db.runTransaction;
    let n = 0;
    a.db.runTransaction = function (fn) { n++; if (n === 2) return Promise.reject(new Error('boom')); return orig.call(a.db, fn); };
    await rejects(a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('u2aaaa')), 'founders_busy');
    a.db.runTransaction = orig;
});

test('F2: unpaid Founders hold that lapses starts a 30-minute per-account cooldown', async function () {
    assert.strictEqual(pricing.DEFAULT_CONFIG.foundersHoldCooldownMinutes, 30);
    const a = setup();
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    a.clock.now = T0 + 11 * MIN;
    await rejects(a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old')), 'founders_cooldown');
    // Another account is not affected; its checkout prunes the lapsed hold and
    // records the cooldown so it survives the pruning.
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('new', '198.51.100.99'));
    const cd = a.db.store.get('premium_rate/fcool_old');
    assert.strictEqual(cd.untilMs, T0 + 40 * MIN);
    assert.strictEqual(new Date(cd.expireAt).getTime(), T0 + 40 * MIN + 3600000);
    a.clock.now = T0 + 39 * MIN;
    await rejects(a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old')), 'founders_cooldown');
    a.clock.now = T0 + 40 * MIN + 1;
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    // Non-Founders plans never see the cooldown.
    const b = setup();
    await b.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    b.clock.now = T0 + 11 * MIN;
    await b.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('old'));
});

test('F2: checkout.session.expired also starts the cooldown; a paid hold or cooldown 0 does not', async function () {
    const a = setup();
    const o = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    a.clock.now = T0 + 5 * MIN;
    await stripePost(a, { id: 'evt_exp_cd', type: 'checkout.session.expired', livemode: false, data: { object: { id: 'cs_test_1', client_reference_id: o.orderId } } });
    assert.strictEqual(a.db.store.get('premium_rate/fcool_old').untilMs, T0 + 35 * MIN);
    await rejects(a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old')), 'founders_cooldown');
    // Paid in time: no cooldown.
    const b = setup();
    const p = await b.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    await stripePost(b, founderDone(p.orderId, 'cs_test_1'));
    b.clock.now = T0 + 11 * MIN;
    await rejects(b.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old')), 'already_lifetime');
    assert.ok(!b.db.store.has('premium_rate/fcool_old'));
    // Cooldown off.
    const c = setup({ config: { foundersHoldCooldownMinutes: 0 } });
    await c.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    c.clock.now = T0 + 11 * MIN;
    await c.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
});

// ---------- Red Team F3 (server side): bitcoin links pinned to btcpayHost
test('F3: btcpayHost validated; status exposes it; bitcoin closed without it; off-host invoice link refused', async function () {
    assert.strictEqual(pricing.normalizeConfig({ btcpayHost: 'Pay.Example.com' }).btcpayHost, 'pay.example.com');
    ['https://pay.example.com', 'pay.example.com/x', 'pay.example.com:443', '1.2.3.4', 'localhost', '', 7, null].forEach(function (v) {
        assert.strictEqual(pricing.normalizeConfig({ btcpayHost: v }).btcpayHost, null, String(v));
    });
    const a = setup();
    const st = await a.h.getPremiumStatus({}, ctx('old'));
    assert.strictEqual(st.btcpayHost, 'btcpay.example.test');
    assert.strictEqual(st.lightningOpen, true);
    const b = setup({ config: { btcpayHost: null } });
    const st2 = await b.h.getPremiumStatus({}, ctx('old'));
    assert.strictEqual(st2.lightningOpen, false);
    assert.strictEqual(st2.btcpayHost, null);
    await rejects(b.h.createPremiumCheckout({ plan: 'yearly', rail: 'lightning' }, ctx('old')), 'lightning_closed');
    // BTCPay answers with a link on another host: refused, Founders hold released.
    const c = setup({ config: { btcpayHost: 'pay.other.example' } });
    await rejects(c.h.createPremiumCheckout({ plan: 'founders', rail: 'lightning' }, ctx('old')), 'provider_error');
    assert.strictEqual(Object.keys(c.db.store.get('premium_counters/founders').holds).length, 0);
});

// ---------- Red Team F1-R: subscription charges carry no order id
async function subOrder(a, plan, uid) {
    const out = await a.h.createPremiumCheckout({ plan: plan, rail: 'card' }, ctx(uid || 'old'));
    const o = a.db.store.get('premium_orders/' + out.orderId);
    return { out: out, order: o };
}
function subFixtures(orderId, opts) {
    const p = opts || {};
    return {
        invoices: { in_sub000001: { id: 'in_sub000001', parent: { subscription_details: { subscription: 'sub_ord000001', metadata: p.invoiceMeta ? { orderId: orderId } : {} } } } },
        subs: { sub_ord000001: { id: 'sub_ord000001', metadata: { orderId: orderId } } },
        subSessions: { sub_ord000001: { id: p.sessionId || 'cs_test_1', client_reference_id: orderId } },
    };
}
['monthly', 'yearly'].forEach(function (plan) {
    test('F1-R: ' + plan + ' card refund before completion with NO order id on the charge finds the order via invoice -> subscription', async function () {
        const fi = {}, fs = {}, fss = {};
        const a = setup({ invoices: fi, subs: fs, subSessions: fss });
        const r = await subOrder(a, plan);
        const f = subFixtures(r.out.orderId);
        Object.assign(fi, f.invoices); Object.assign(fs, f.subs); Object.assign(fss, f.subSessions);
        const ev = { id: 'evt_f1r_' + plan, type: 'charge.refunded', livemode: false, data: { object: { id: 'ch_sub_' + plan, refunded: true, amount_refunded: r.order.amountCents, invoice: 'in_sub000001', payment_intent: 'pi_sub0000001', metadata: {} } } };
        assert.strictEqual((await stripePost(a, ev)).code, 200);
        assert.strictEqual(a.db.store.get('premium_orders/' + r.out.orderId).refundKind, 'full');
        await stripePost(a, completed(r.out.orderId, 'cs_test_1', { amount_total: r.order.expectedTotalCents, subscription: 'sub_ord000001', customer: 'cus_9' }));
        const e = a.db.store.get('premium_entitlements/old');
        assert.strictEqual(e.frozen, true);
        assert.strictEqual(premium.isPremiumActive(e, a.clock.now), false);
    });
    test('F1-R: ' + plan + ' card dispute before completion with NO order id: charge -> invoice (newer API: invoice_payments) -> subscription', async function () {
        const fi = {}, fs = {}, fss = {}; const charges = {}; const ip = {};
        const a = setup({ invoices: fi, subs: fs, subSessions: fss, charges: charges, invoicePayments: ip });
        const r = await subOrder(a, plan);
        const f = subFixtures(r.out.orderId, { invoiceMeta: plan === 'monthly' });
        Object.assign(fi, f.invoices); Object.assign(fs, f.subs); Object.assign(fss, f.subSessions);
        // No invoice field on the charge (newer Stripe API): found via invoice_payments.
        charges.ch_dsub000001 = { id: 'ch_dsub000001', metadata: {}, payment_intent: 'pi_dsub000001' };
        ip.pi_dsub000001 = 'in_sub000001';
        const ev = { id: 'evt_f1d_' + plan, type: 'charge.dispute.created', livemode: false, data: { object: { id: 'dp_sub_' + plan, amount: r.order.amountCents, charge: 'ch_dsub000001' } } };
        assert.strictEqual((await stripePost(a, ev)).code, 200);
        assert.ok(a.db.store.get('premium_orders/' + r.out.orderId).disputedAtMs > 0);
        await stripePost(a, completed(r.out.orderId, 'cs_test_1', { amount_total: r.order.expectedTotalCents, subscription: 'sub_ord000001', customer: 'cus_9' }));
        const e = a.db.store.get('premium_entitlements/old');
        assert.strictEqual(e.frozen, true);
        assert.strictEqual(e.frozenReason, 'charge.dispute.created');
    });
});
test('F1-R: subscription lookup needs the session match; a mismatch or missing objects stamp nothing and never 500', async function () {
    const fi = {}, fs = {}, fss = {};
    const a = setup({ invoices: fi, subs: fs, subSessions: fss });
    const r = await subOrder(a, 'yearly');
    const f = subFixtures(r.out.orderId, { sessionId: 'cs_not_this_order' });
    Object.assign(fi, f.invoices); Object.assign(fs, f.subs); Object.assign(fss, f.subSessions);
    const ev = { id: 'evt_f1r_mm', type: 'charge.refunded', livemode: false, data: { object: { id: 'ch_mm', refunded: true, amount_refunded: 4750, invoice: 'in_sub000001', metadata: {} } } };
    assert.strictEqual((await stripePost(a, ev)).code, 200);
    assert.ok(!a.db.store.get('premium_orders/' + r.out.orderId).refundKind);
    // Unknown invoice (404): treated as not found, webhook still 200.
    const ev2 = { id: 'evt_f1r_404', type: 'charge.refunded', livemode: false, data: { object: { id: 'ch_404', refunded: true, amount_refunded: 4750, invoice: 'in_missing0001', metadata: {} } } };
    assert.strictEqual((await stripePost(a, ev2)).code, 200);
});

// ---------- Red Team F2-R (a): network cooldown
test('F2-R: lapsed Founders hold also cools down its network (keyed IP hash, 30 min, config 0 = off)', async function () {
    assert.strictEqual(pricing.DEFAULT_CONFIG.foundersIpHoldCooldownMinutes, 30);
    assert.strictEqual(pricing.normalizeConfig({ foundersIpHoldCooldownMinutes: 999 }).foundersIpHoldCooldownMinutes, 30);
    const a = setup();
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('old', '198.51.100.31'));
    a.clock.now = T0 + 11 * MIN;
    await rejects(a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('new', '198.51.100.31')), 'founders_cooldown_ip');
    // Another network is fine, and its checkout prunes the lapsed hold and records both cooldowns.
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('u9aaaa', '198.51.100.32'));
    const ipDocs = Array.from(a.db.store.keys()).filter(function (k) { return k.indexOf('premium_rate/fcoolip_') === 0; });
    assert.strictEqual(ipDocs.length, 1);
    assert.ok(/^premium_rate\/fcoolip_[0-9a-f]{40}$/.test(ipDocs[0]));
    assert.strictEqual(a.db.store.get(ipDocs[0]).untilMs, T0 + 40 * MIN);
    assert.strictEqual(storeJson(a).indexOf('198.51.100.31'), -1);
    // Still cooling after pruning; clears after 30 minutes.
    a.db.store.set('users/n2', {});
    await rejects(a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('n2', '198.51.100.31')), 'founders_cooldown_ip');
    a.clock.now = T0 + 40 * MIN + 1;
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('n2', '198.51.100.31'));
    // Off by config.
    const b = setup({ config: { foundersIpHoldCooldownMinutes: 0, foundersHoldCooldownMinutes: 0 } });
    await b.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('old', '198.51.100.33'));
    b.clock.now = T0 + 11 * MIN;
    await b.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('new', '198.51.100.33'));
});
test('F2-R: checkout.session.expired starts the network cooldown too', async function () {
    const a = setup();
    const o = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('old', '198.51.100.41'));
    a.clock.now = T0 + 5 * MIN;
    await stripePost(a, { id: 'evt_exp_ip', type: 'checkout.session.expired', livemode: false, data: { object: { id: 'cs_test_1', client_reference_id: o.orderId } } });
    await rejects(a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('new', '198.51.100.41')), 'founders_cooldown_ip');
});

// ---------- Red Team F2-R (b): lapsed holds can no longer be paid
function expireCalls(a) { return a.calls.filter(function (c) { return c.init.method === 'POST' && /\/v1\/checkout\/sessions\/[^/]+\/expire$/.test(c.url); }); }
test('F2-R: Founders session: expires_at = 31 min (Stripe minimum + margin), hold note on Stripe, holdExpMs returned', async function () {
    const a = setup();
    const o = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    assert.strictEqual(o.holdExpMs, T0 + 10 * MIN);
    const post = a.calls.find(function (c) { return c.init.method === 'POST' && c.url === 'https://api.stripe.com/v1/checkout/sessions'; });
    const body = bodyOf(post);
    assert.ok(body.indexOf('expires_at=' + (Math.floor(T0 / 1000) + 31 * 60)) !== -1);
    assert.ok(body.indexOf('Your Founders seat is held for 10 minutes. Pay before then to keep it.') !== -1);
    const y = await a.h.createPremiumCheckout({ plan: 'yearly', rail: 'card' }, ctx('new'));
    assert.strictEqual(y.holdExpMs, null);
});
test('F2-R: a lapsed Founders hold found by the next checkout gets its Stripe session expired (once)', async function () {
    const a = setup();
    const o = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    a.clock.now = T0 + 11 * MIN;
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('new', '198.51.100.51'));
    const ex = expireCalls(a);
    assert.strictEqual(ex.length, 1);
    assert.strictEqual(ex[0].url, 'https://api.stripe.com/v1/checkout/sessions/cs_test_1/expire');
    assert.strictEqual(a.db.store.get('premium_orders/' + o.orderId).sessionExpiredAtMs, T0 + 11 * MIN);
    // The sweep does not expire it again, and never touches live holds.
    await a.h.sweepExpired(10);
    assert.strictEqual(expireCalls(a).length, 1);
});
test('F2-R: the sweep expires sessions of lapsed holds; paid or bitcoin orders are left alone', async function () {
    const a = setup();
    const o1 = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    const o2 = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('new', '198.51.100.61'));
    await stripePost(a, founderDone(o2.orderId, 'cs_test_2'));
    a.clock.now = T0 + 9 * MIN;
    await a.h.sweepExpired(10);
    assert.strictEqual(expireCalls(a).length, 0);
    a.clock.now = T0 + 12 * MIN;
    const res = await a.h.sweepExpired(10);
    assert.strictEqual(res.sessionsExpired, 1);
    const ex = expireCalls(a);
    assert.strictEqual(ex.length, 1);
    assert.ok(ex[0].url.indexOf('/cs_test_1/expire') !== -1);
    assert.ok(a.db.store.get('premium_orders/' + o1.orderId).sessionExpiredAtMs);
    assert.ok(!a.db.store.get('premium_orders/' + o2.orderId).sessionExpiredAtMs);
});
test('F2-R: the sweep skips session expiry quietly when it runs without the Stripe key', async function () {
    const a = setup();
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    a.clock.now = T0 + 12 * MIN;
    delete a.env.STRIPE_SECRET_KEY;
    const res = await a.h.sweepExpired(10);
    assert.strictEqual(res.sessionsExpired, 0);
    assert.strictEqual(res.sessionsExpireSkipped, true);
    assert.strictEqual(expireCalls(a).length, 0);
});
test('F2-R: a failed expire never throws (checkout and sweep still answer); late payment still has the review fallback', async function () {
    const a = setup({ expireFail: true, config: { foundersHoldCooldownMinutes: 0, foundersIpHoldCooldownMinutes: 0 } });
    a.db.store.set('premium_counters/founders', { sold: 499, holds: {} });
    const o = await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ctx('old'));
    a.clock.now = T0 + 11 * MIN;
    await a.h.createPremiumCheckout({ plan: 'founders', rail: 'card' }, ipCtx('new', '198.51.100.71'));
    assert.strictEqual(expireCalls(a).length, 1);
    assert.ok(!a.db.store.get('premium_orders/' + o.orderId).sessionExpiredAtMs);
    const sw = await a.h.sweepExpired(10);
    assert.strictEqual(sw.sessionsExpired, 0);
    // Session still paid (expire failed) while the last seat is held: review, never oversold.
    assert.strictEqual((await stripePost(a, founderDone(o.orderId, 'cs_test_1'))).body.outcome, 'review');
    assert.strictEqual(a.db.store.get('premium_counters/founders').sold, 499);
});

(async function () {
    for (const t of queue) {
        try { await t.fn(); passed++; console.log('✅ ' + t.name); }
        catch (e) { failed++; console.log('❌ ' + t.name + ': ' + (e && e.stack || e)); }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
