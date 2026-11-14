'use strict';

// Bitcoin Quest Premium checkout, webhooks and entitlements (server only).
//
// Card: Stripe Checkout + Billing portal (payouts to Phil's bank via his
// Stripe account). Lightning: BTCPay Server invoices settling into a separate
// wallet in Phil's own Alby Hub; we never hold spending rights. Lightning is
// off until premium_config/settings.lightningEnabled is true.
//
// Two entry points:
//   - In-app callable createPremiumCheckout (signed-in). Only this path can
//     apply the existing-user 5% (see existingUserEligible()).
//   - Public HTTPS premiumPublicCheckout, used by the static /premium page
//     (works while the app is offline). Full price, never the 5%. The buyer's
//     email is locked into Stripe Checkout; the entitlement is held under that
//     email until a signed-in account with the same verified email claims it
//     (claimPremiumByEmail), or is granted straight to that account.
//
// Rules this module keeps:
//   - Prices come only from premiumPricing.quote() on the server.
//   - Entitlements are written only here. Clients read their own entitlement
//     and allowance docs and write nothing.
//   - Webhooks are signature-checked on the raw body; every event is processed
//     at most once (premium_events marker in the same transaction as the grant).
//   - BTCPay settlement is re-read from the BTCPay API before granting.
//   - Founders' Lifetime is capped at exactly 500 by a transactional counter
//     with short seat holds while a checkout is open.
//   - Fail closed: unknown project ids refuse; staging refuses live Stripe
//     keys and live-mode events; live refuses test keys and test events;
//     checkout is off until premium_config/settings.checkoutEnabled is true.
//
// Secrets (Secret Manager, exposed as env at runtime; never logged):
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//   BTCPAY_API_KEY, BTCPAY_WEBHOOK_SECRET, BTCPAY_URL, BTCPAY_STORE_ID

const crypto = require('crypto');
const pricing = require('./premiumPricing');
const faucetGuard = require('./faucetGuard');

const LIVE_PROJECT = 'bitcoin-education-archive';
const STAGING_PROJECT = 'bitcoin-quest-staging';

const SITE_URLS = Object.freeze({
    [LIVE_PROJECT]: 'https://bitcoineducation.quest',
    [STAGING_PROJECT]: 'https://bitcoin-quest-staging.web.app',
});

// Browser origins allowed to call premiumPublicCheckout.
const PUBLIC_ORIGINS = Object.freeze({
    live: [/^https:\/\/(www\.)?bitcoineducation\.quest$/],
    test: [/^https:\/\/bitcoin-quest-staging\.web\.app$/, /^https:\/\/[a-z0-9-]+\.bitcoin-quest\.pages\.dev$/, /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/],
});

const TURNSTILE_ACTION = 'premium_checkout';
// Hostnames Turnstile may report for the premium page, per environment.
const TURNSTILE_HOSTS = Object.freeze({
    live: ['bitcoineducation.quest', 'www.bitcoineducation.quest'],
    test: ['bitcoin-quest-staging.web.app', /^[a-z0-9-]+\.bitcoin-quest\.pages\.dev$/, 'localhost', '127.0.0.1'],
});

const SECRET_NAMES = Object.freeze([
    // PREMIUM_HASH_KEY: HMAC key for IP, email and card-fingerprint hashes
    // (User Data/Backups, Nov 14). No plain IP, email key or fingerprint is stored.
    'PREMIUM_HASH_KEY',
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
    'BTCPAY_API_KEY', 'BTCPAY_WEBHOOK_SECRET', 'BTCPAY_URL', 'BTCPAY_STORE_ID',
]);

const STRIPE_API = 'https://api.stripe.com';
const STRIPE_TOLERANCE_SEC = 300;
const STRIPE_CHECKOUT_MINUTES = 31; // Stripe minimum is 30.
const BTCPAY_INVOICE_MINUTES = 15;
const HOLD_GRACE_MS = 5 * 60 * 1000;
const SUB_GRACE_MS = 3 * 24 * 3600 * 1000;
const CARD_SUB_PREPAID_WINDOW_MS = 3 * 24 * 3600 * 1000;
const ORDERS_PER_HOUR = 6;
const PUBLIC_ORDERS_PER_HOUR_PER_IP = 10;
const RETRYABLE_OUTCOMES = Object.freeze(['not_settled', 'not_paid_yet']);
const EMBERS_PER_MONTH = 100; // monthly Embers for paid Premium (not trial or referral weeks)
const EMBERS_CAP = 300; // unspent Embers roll over up to 3 months' worth
const ALLOWANCE_PER_MONTH = EMBERS_PER_MONTH; // alias kept for callers/tests

const COL = Object.freeze({
    config: 'premium_config',
    orders: 'premium_orders',
    entitlements: 'premium_entitlements',
    emailEntitlements: 'premium_email_entitlements',
    counters: 'premium_counters',
    events: 'premium_events',
    review: 'premium_review',
    rate: 'premium_rate',
    allowance: 'premium_allowance',
    allowanceLedger: 'premium_allowance_ledger',
    // Long-term: one marker per keyed hash of a canonical email ('e_') or a
    // card fingerprint ('c_') that already had a free trial.
    trialMarkers: 'premium_trial_markers',
    adminAudit: 'premium_admin_audit',
});

// Financial and audit records. Never deleted by account deletion or any
// cleanup; account deletion only masks the uid and clears email fields.
// The 10-year vault copy must include these (see docs/payments/premium-checkout.md).
const PERMANENT_COLLECTIONS = Object.freeze([
    COL.orders, COL.events, COL.review, COL.allowanceLedger, COL.trialMarkers, COL.adminAudit,
]);
const GLOBAL_PUBLIC_RATE_ID = 'public_global';
const HOLDS_ALERT_AFTER_MS = 3600000;

// ---------------------------------------------------------------- helpers

function providerMode(projectId) {
    if (projectId === LIVE_PROJECT) return 'live';
    if (projectId === STAGING_PROJECT) return 'test';
    if (typeof projectId === 'string' && projectId.indexOf('demo-') === 0) return 'test'; // emulator / unit tests
    return null; // unknown project: refuse
}

// Client IP: faucetGuard.clientIpFromRequest takes the RIGHTMOST
// X-Forwarded-For entry (appended by Google's front end). req.ip is the
// leftmost one, which the caller controls, so it is never used.
function clientIp(req) {
    return faucetGuard.clientIpFromRequest(req) || 'none';
}

// Material hashed for Founders holds and the public per-IP rate key: the IPv6
// /64 (rangeId) or the exact IPv4 address (exactId). Two addresses in one
// IPv6 /64 therefore share a hold and a rate bucket (Red Team, Nov 14).
function networkIpMaterial(ip) {
    const k = faucetGuard.networkKeys(ip);
    if (!k) return ip;
    return k.version === 6 ? k.rangeId : k.exactId;
}

// Keyed hash (HMAC-SHA256) for anything that identifies a person: IPs,
// canonical emails, card fingerprints. Without the key the hash cannot be
// brute-forced back to an IP or email.
function keyedHash(key, kind, value) {
    if (typeof key !== 'string' || key.length < 16) throw new Error('premium_hash_key_missing');
    return crypto.createHmac('sha256', key).update('bq-premium:' + kind + ':' + String(value)).digest('hex').slice(0, 40);
}

// Canonical email for trial-reuse markers only: lowercase, strip +tags,
// and for Gmail drop dots and map googlemail.com to gmail.com.
// Email-held purchases and claimPremiumByEmail use normalizeEmail instead
// (exact address, no +tag or Gmail-dot folding).
function canonicalEmail(v) {
    const e = normalizeEmail(v);
    if (!e) return null;
    const at = e.lastIndexOf('@');
    let local = e.slice(0, at);
    let domain = e.slice(at + 1);
    const plus = local.indexOf('+');
    if (plus > 0) local = local.slice(0, plus);
    if (domain === 'googlemail.com') domain = 'gmail.com';
    if (domain === 'gmail.com') local = local.replace(/\./g, '');
    if (!local) return null;
    return local + '@' + domain;
}

// Stable masked id for a deleted account's financial records. Not reversible
// without the original uid; the same uid always maps to the same mask so an
// accountant can still group one person's records.
function maskDeletedUid(uid) {
    return 'del_' + crypto.createHash('sha256').update('bq-premium-del:' + String(uid)).digest('hex').slice(0, 24);
}

function stripeKeyOk(key, mode) {
    if (typeof key !== 'string' || key.length < 20) return false;
    if (mode === 'live') return /^(sk|rk)_live_/.test(key);
    if (mode === 'test') return /^(sk|rk)_test_/.test(key);
    return false;
}

function timingSafeEqualHex(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false;
    return crypto.timingSafeEqual(Buffer.from(a.toLowerCase(), 'hex'), Buffer.from(b.toLowerCase(), 'hex'));
}

// Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>...]
function verifyStripeSignature(rawBody, header, secret, nowSec) {
    if (!secret || typeof secret !== 'string') return { ok: false, reason: 'no_secret' };
    if (!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string') return { ok: false, reason: 'no_body' };
    if (typeof header !== 'string' || header.length > 2048) return { ok: false, reason: 'no_header' };
    let t = null;
    const sigs = [];
    header.split(',').forEach(function (part) {
        const i = part.indexOf('=');
        if (i < 0) return;
        const k = part.slice(0, i).trim();
        const v = part.slice(i + 1).trim();
        if (k === 't') t = Number(v);
        else if (k === 'v1') sigs.push(v);
    });
    if (!Number.isInteger(t) || !sigs.length) return { ok: false, reason: 'bad_header' };
    if (Math.abs(nowSec - t) > STRIPE_TOLERANCE_SEC) return { ok: false, reason: 'stale' };
    const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    const expected = crypto.createHmac('sha256', secret).update(t + '.' + body, 'utf8').digest('hex');
    const ok = sigs.some(function (s) { return timingSafeEqualHex(expected, s); });
    return ok ? { ok: true } : { ok: false, reason: 'mismatch' };
}

// BTCPay-Sig: sha256=<hex HMAC of raw body>
function verifyBtcpaySignature(rawBody, header, secret) {
    if (!secret || typeof secret !== 'string') return { ok: false, reason: 'no_secret' };
    if (!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string') return { ok: false, reason: 'no_body' };
    if (typeof header !== 'string' || header.indexOf('sha256=') !== 0) return { ok: false, reason: 'bad_header' };
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return timingSafeEqualHex(expected, header.slice(7)) ? { ok: true } : { ok: false, reason: 'mismatch' };
}

// "42.5" -> 4250. Refuses anything that is not a plain non-negative decimal.
function usdToCents(v) {
    const s = String(v == null ? '' : v).trim();
    if (!/^\d{1,9}(\.\d{1,12})?$/.test(s)) return null;
    const parts = s.split('.');
    const frac = (parts[1] || '').padEnd(3, '0');
    let cents = Number(parts[0]) * 100 + Number(frac.slice(0, 2));
    if (Number(frac.charAt(2)) >= 5) cents += 1;
    return cents;
}

// Flattens nested params into Stripe's form encoding: a[b][0][c]=v
function stripeForm(obj) {
    const out = [];
    function walk(prefix, v) {
        if (v === undefined || v === null) return;
        if (Array.isArray(v)) { v.forEach(function (x, i) { walk(prefix + '[' + i + ']', x); }); return; }
        if (typeof v === 'object') { Object.keys(v).forEach(function (k) { walk(prefix ? prefix + '[' + k + ']' : k, v[k]); }); return; }
        out.push(encodeURIComponent(prefix) + '=' + encodeURIComponent(String(v)));
    }
    walk('', obj);
    return out.join('&');
}

// Marketing source tag from ?src= (e.g. yt-teaser, yt-1217). Anything else -> null.
function cleanSrc(v) {
    if (typeof v !== 'string') return null;
    const s = v.trim().toLowerCase();
    return /^[a-z0-9][a-z0-9_-]{0,39}$/.test(s) ? s : null;
}

function normalizeEmail(v) {
    if (typeof v !== 'string') return null;
    const e = v.trim().toLowerCase();
    if (e.length < 6 || e.length > 254 || !/^[^\s@<>"',;]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)) return null;
    return e;
}
// BTCPay Greenfield payment-methods: ids like BTC-LN, BTC-LNURL,
// BTC-LightningNetwork, BTC-LNURLPAY are Lightning; BTC / BTC-CHAIN are on-chain.
function isLightningMethod(id) {
    return /(^|-)(LN|LNURL|LNURLPAY|LIGHTNINGNETWORK)$/i.test(String(id || ''));
}
function nonLightningPayments(pms) {
    if (!Array.isArray(pms)) return ['unreadable'];
    return pms.filter(function (m) {
        const id = m && (m.paymentMethodId || m.paymentMethod);
        return m && Array.isArray(m.payments) && m.payments.length > 0 && !isLightningMethod(id);
    }).map(function (m) { return String(m.paymentMethodId || m.paymentMethod || 'unknown'); });
}

function emailKey(email, key) {
    const e = normalizeEmail(email);
    return e ? keyedHash(key, 'email', e) : null;
}

// Trial-reuse markers only: keyed hash of the canonical email.
function trialEmailKey(email, key) {
    const c = canonicalEmail(email);
    return c ? keyedHash(key, 'email', c) : null;
}

function etMonthKey(nowMs) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit' }).formatToParts(new Date(nowMs));
    const y = parts.find(function (p) { return p.type === 'year'; }).value;
    const m = parts.find(function (p) { return p.type === 'month'; }).value;
    return y + '-' + m;
}

// Existing-user 5% eligibility (in-app only). Phil, Nov 14: "only be shown in
// the app itself for existing users and should only be triggered with a
// verified user BQ account and only work until the Jan 1 12am 2027 deadline".
// All must hold:
//   1. a verified Firebase ID token (callable context.auth; the SDK checks it),
//   2. not an anonymous/guest sign-in,
//   3. token email_verified === true,
//   4. users/{uid} profile exists and is not banned,
//   5. Auth metadata.creationTime is before the cutoff
//      (existingUserCutoffMs, else checkoutLaunchedAtMs),
//   6. server time is before existingUserDiscountEndsAtMs (2027-01-01T05:00Z).
// The public /premium page never gets it.
function existingUserEligible(input, cfg) {
    const i = input || {};
    if (!i.tokenVerified) return { ok: false, why: 'no_token' };
    if (i.provider === 'anonymous') return { ok: false, why: 'anonymous' };
    if (i.emailVerified !== true) return { ok: false, why: 'email_not_verified' };
    if (!i.profileExists || i.banned) return { ok: false, why: 'no_profile' };
    if (!pricing.isExistingUser(i.accountCreatedMs, cfg)) return { ok: false, why: 'new_account' };
    if (!(Number(i.nowMs) < cfg.existingUserDiscountEndsAtMs)) return { ok: false, why: 'ended' };
    return { ok: true, why: 'eligible' };
}

// Entitlement state from its parts. founders = lifetime; otherwise the later
// of the card subscription period and prepaid Lightning time.
function summarize(ent, nowMs) {
    const e = ent || {};
    const founders = e.founders === true;
    const sub = Number(e.subscriptionUntilMs) || 0;
    const pre = Number(e.prepaidUntilMs) || 0;
    const expiresAtMs = founders ? null : (Math.max(sub, pre) || null);
    const covered = e.revoked !== true && e.frozen !== true && (founders || (expiresAtMs != null && expiresAtMs > nowMs));
    const startsAtMs = Number(e.startsAtMs) || null;
    const started = !startsAtMs || nowMs >= startsAtMs;
    const active = covered && started;
    let plan = null;
    if (founders && e.revoked !== true && e.frozen !== true) plan = 'founders';
    else if (active) plan = sub >= pre ? (e.subscriptionPlan || 'monthly') : (e.prepaidPlan || 'months');
    if (!plan && covered) plan = founders ? 'founders' : (sub >= pre ? (e.subscriptionPlan || 'monthly') : (e.prepaidPlan || 'months'));
    const trialUntilMs = Number(e.trialUntilMs) || null;
    return {
        active: active,
        pendingStart: covered && !started,
        startsAtMs: startsAtMs,
        inTrial: active && !!trialUntilMs && nowMs < trialUntilMs,
        trialUntilMs: trialUntilMs,
        founders: founders,
        plan: plan,
        expiresAtMs: expiresAtMs,
        autoRenew: e.autoRenew === true,
    };
}

function isPremiumActive(ent, nowMs) { return summarize(ent, nowMs).active; }

// Paid Premium (including Founders and the Family buyer's account) can claim
// Embers. Trial and referral weeks cannot, and a canceled subscription gets
// no new grants (leftovers are kept). Frozen or inactive entitlements cannot.
function inReferralWeek(ent, nowMs) {
    const e = ent || {};
    if (e.referralWeek === true) return true;
    const until = Number(e.referralWeekUntilMs) || 0;
    return until > 0 && nowMs < until;
}
function embersGrantAllowed(ent, nowMs) {
    const s = summarize(ent, nowMs);
    if (!s.active) return false;
    if (s.inTrial) return false;
    if (inReferralWeek(ent, nowMs)) return false;
    if (s.founders) return true;
    if (ent && ent.stripeSubscriptionId && s.autoRenew !== true) return false;
    return true;
}
function walletEmbers(wallet) {
    const w = wallet || {};
    if (w.embers != null) return Number(w.embers) || 0;
    return Number(w.cosmeticCredits) || 0;
}
// Unspent Embers from this period: the leftover portion of this month's grant.
function periodUnspentEmbers(wallet) {
    const w = wallet || {};
    const granted = Number(w.periodGranted) || 0;
    const spent = Number(w.periodSpent) || 0;
    const unspent = Math.max(0, granted - spent);
    return Math.min(walletEmbers(w), unspent);
}


// Merges an email-held entitlement into an account entitlement.
function mergeEntitlements(a, b, nowMs) {
    const x = Object.assign({}, a || {});
    const xRunning = summarize(x, nowMs || Date.now()).active;
    const y = b || {};
    if (y.founders === true) { x.founders = true; x.foundersOrderId = x.foundersOrderId || y.foundersOrderId; x.foundersSeat = x.foundersSeat || y.foundersSeat; }
    ['subscriptionUntilMs', 'prepaidUntilMs'].forEach(function (k) { x[k] = Math.max(Number(x[k]) || 0, Number(y[k]) || 0) || null; });
    ['stripeCustomerId', 'stripeSubscriptionId', 'subscriptionPlan', 'subscriptionOrderId', 'prepaidPlan', 'stripeSubscriptionStatus'].forEach(function (k) {
        if (y[k] && !x[k]) x[k] = y[k];
    });
    if (y.autoRenew === true) x.autoRenew = true;
    if (y.trialUsed === true) x.trialUsed = true;
    if (y.trialUntilMs) x.trialUntilMs = Math.max(Number(x.trialUntilMs) || 0, Number(y.trialUntilMs));
    // Keep the earlier start of the two; a missing start means already running.
    if (!xRunning) x.startsAtMs = Number(y.startsAtMs) || null;
    return x;
}

function liveHolds(holds, nowMs) {
    const out = {};
    Object.keys(holds || {}).forEach(function (id) {
        const h = holds[id];
        if (h && Number(h.expMs) > nowMs) out[id] = h;
    });
    return out;
}

function foundersLeft(counter, nowMs) {
    const c = counter || {};
    const held = Object.keys(liveHolds(c.holds, nowMs)).length;
    return Math.max(0, pricing.FOUNDERS_CAP - (Number(c.sold) || 0) - held);
}

function fmtEt(msVal) {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(msVal));
}

// Text shown above the pay button on Stripe Checkout (custom_text.submit).
function checkoutNote(q, startMs, trialEndMs) {
    const parts = [];
    if (startMs) parts.push('Premium perks unlock with Citadel Spark on ' + fmtEt(startMs) + '.');
    if (q.cardMode === 'subscription' && trialEndMs) {
        parts.push('You will not be charged today. Your first charge is on ' + fmtEt(trialEndMs) + '. Cancel any time before then and you pay nothing.');
    }
    if (q.lifetime && startMs) parts.push("You're charged today and your Founders' seat is reserved now.");
    return parts.join(' ').slice(0, 1200) || null;
}

// ---------------------------------------------------------------- handlers

function createPremiumHandlers(deps) {
    const db = deps.db;
    const HttpsError = deps.HttpsError;
    const now = deps.now || Date.now;
    const env = deps.env || process.env;
    const fetchImpl = deps.fetch || (typeof fetch === 'function' ? fetch : null);
    const projectId = deps.projectId || env.GCLOUD_PROJECT || env.GCP_PROJECT || '';
    const getAuthUser = deps.getAuthUser || function (uid) { return deps.admin.auth().getUser(uid); };
    const verifyTurnstile = deps.verifyTurnstile || null;
    const newId = deps.newId || function () { return crypto.randomBytes(12).toString('hex'); };
    const log = deps.log || function () {};

    function fail(code, msg, reason) {
        return new HttpsError(code, msg, reason ? { reason: reason } : undefined);
    }
    function ref(col, id) { return db.collection(col).doc(id); }
    // Keyed hash; refuses (fails closed) when PREMIUM_HASH_KEY is not set.
    function H(kind, value) {
        try { return keyedHash(deps.hashKey || env.PREMIUM_HASH_KEY, kind, value); }
        catch (e) { throw fail('failed-precondition', 'Checkout is not set up yet.', 'hash_key'); }
    }
    function ekey(email) { const e = normalizeEmail(email); return e ? H('email', e) : null; }
    function tkey(email) { const c = canonicalEmail(email); return c ? H('email', c) : null; }
    async function trialMarkerExists(kind, hash) {
        if (!hash) return false;
        const snap = await ref(COL.trialMarkers, kind + '_' + hash).get();
        return snap.exists;
    }

    function mode() {
        const m = providerMode(projectId);
        if (!m) throw fail('failed-precondition', 'Payments are not available here.', 'unknown_project');
        return m;
    }
    function siteUrl() {
        return SITE_URLS[projectId] || SITE_URLS[STAGING_PROJECT];
    }
    function stripeKey() {
        const key = env.STRIPE_SECRET_KEY;
        if (!stripeKeyOk(key, mode())) throw fail('failed-precondition', 'Card checkout is not set up yet.', 'stripe_key');
        return key;
    }
    function btcpayCfg() {
        const url = env.BTCPAY_URL;
        const store = env.BTCPAY_STORE_ID;
        const key = env.BTCPAY_API_KEY;
        let u = null;
        try { u = new URL(url); } catch (e) { u = null; }
        if (!u || u.protocol !== 'https:' || u.username || u.password || !store || !/^[A-Za-z0-9]{8,64}$/.test(store) || !key) {
            throw fail('failed-precondition', 'Lightning checkout is not set up yet.', 'btcpay_config');
        }
        return { base: u.origin + u.pathname.replace(/\/+$/, ''), store: store, key: key };
    }

    async function stripeRequest(method, path, params, idemKey) {
        if (!fetchImpl) throw new Error('no fetch');
        const headers = { Authorization: 'Bearer ' + stripeKey() };
        const init = { method: method, headers: headers };
        if (method === 'POST') {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            init.body = stripeForm(params || {});
            if (idemKey) headers['Idempotency-Key'] = idemKey;
        }
        const res = await fetchImpl(STRIPE_API + path, init);
        const json = await res.json().catch(function () { return {}; });
        if (!res.ok) {
            const err = new Error('stripe_' + res.status + (json && json.error && json.error.code ? '_' + json.error.code : ''));
            throw err;
        }
        return json;
    }

    async function btcpayRequest(method, path, body) {
        if (!fetchImpl) throw new Error('no fetch');
        const c = btcpayCfg();
        const res = await fetchImpl(c.base + '/api/v1/stores/' + encodeURIComponent(c.store) + path, {
            method: method,
            headers: { Authorization: 'token ' + c.key, 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
            redirect: 'error',
        });
        const json = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error('btcpay_' + res.status);
        return json;
    }

    async function loadConfig() {
        const snap = await ref(COL.config, 'settings').get();
        return pricing.normalizeConfig(snap.exists ? snap.data() : null);
    }

    function requireUser(context) {
        const auth = context && context.auth;
        if (!auth || !auth.uid) throw fail('unauthenticated', 'Sign in first.', 'signed_out');
        const provider = auth.token && auth.token.firebase && auth.token.firebase.sign_in_provider;
        if (provider === 'anonymous') throw fail('failed-precondition', 'Create an account before subscribing.', 'anonymous');
        return auth;
    }

    function blockedUser(u) {
        if (!u) return null;
        if (u.banned === true) return 'banned';
        // Minors get no sats/prizes and under-13 is blocked from the app.
        if (u.isMinor === true || u.under13 === true || u.ageBand === 'under13' || u.ageBand === 'minor') return 'minor';
        return null;
    }

    async function accountCreatedMs(uid) {
        const user = await getAuthUser(uid);
        const t = user && user.metadata && Date.parse(user.metadata.creationTime);
        return Number.isFinite(t) ? t : null;
    }

    async function eligibilityFor(auth, cfg, nowMs, userDoc) {
        const provider = auth.token && auth.token.firebase && auth.token.firebase.sign_in_provider;
        return existingUserEligible({
            tokenVerified: true,
            provider: provider,
            emailVerified: !!(auth.token && auth.token.email_verified === true),
            profileExists: !!userDoc,
            banned: !!(userDoc && userDoc.banned === true),
            accountCreatedMs: await accountCreatedMs(auth.uid).catch(function () { return null; }),
            nowMs: nowMs,
        }, cfg);
    }

    function quoteOrThrow(input, cfg) {
        try { return pricing.quote(input, cfg); }
        catch (e) {
            if (e instanceof pricing.PricingError) {
                throw fail(e.code === 'family_inactive' ? 'failed-precondition' : 'invalid-argument', e.message, e.code);
            }
            throw e;
        }
    }

    // Shared order + provider session creation.
    // who: { uid|null, email|null, holdKey, rateKey, customerId|null }
    async function startOrder(q, who, cfg, nowMs, src, channel) {
        if (q.rail === 'lightning' && !cfg.lightningEnabled) throw fail('failed-precondition', 'Bitcoin checkout opens soon.', 'lightning_closed');
        const orderId = newId();
        const provider = q.rail === 'card' ? 'stripe' : 'btcpay';
        // billingStartsAt (pending Phil): everything starts then; Founders'
        // is still charged now. Trials run from the start time.
        const startMs = cfg.billingStartsAtMs && cfg.billingStartsAtMs > nowMs ? cfg.billingStartsAtMs : null;
        let trialEndMs = null;
        if (q.cardMode === 'subscription') {
            if (who.trialEligible && cfg.trialDays > 0) trialEndMs = (startMs || nowMs) + cfg.trialDays * 86400000;
            else if (startMs) trialEndMs = startMs;
            // Stripe needs trial_end at least 48h out; closer than that bills now.
            if (trialEndMs && trialEndMs - nowMs < 49 * 3600000) trialEndMs = null;
        }
        const expectedTotalCents = trialEndMs ? 0 : q.amountCents;
        const holdMs = (q.rail === 'card' ? STRIPE_CHECKOUT_MINUTES : BTCPAY_INVOICE_MINUTES) * 60000 + HOLD_GRACE_MS;
        if (provider === 'stripe') stripeKey(); else btcpayCfg(); // before any seat is held

        const orderRef = ref(COL.orders, orderId);
        const counterRef = ref(COL.counters, 'founders');
        const rateRef = ref(COL.rate, who.rateKey);
        const globalRef = channel === 'public' ? ref(COL.rate, GLOBAL_PUBLIC_RATE_ID) : null;
        const limit = who.uid ? ORDERS_PER_HOUR : PUBLIC_ORDERS_PER_HOUR_PER_IP;
        function windowCount(d) {
            const ws = Number(d.windowStartMs) || 0;
            const inW = nowMs - ws < 3600000;
            return { inWindow: inW, windowStart: ws, count: inW ? (Number(d.count) || 0) : 0 };
        }
        await db.runTransaction(async function (tx) {
            const rateSnap = await tx.get(rateRef);
            const globalSnap = globalRef ? await tx.get(globalRef) : null;
            const counterSnap = q.lifetime ? await tx.get(counterRef) : null;
            const rate = rateSnap.exists ? rateSnap.data() : {};
            const w = windowCount(rate);
            const inWindow = w.inWindow;
            const windowStart = w.windowStart;
            const count = w.count;
            if (count >= limit) throw fail('resource-exhausted', 'Too many checkout attempts. Try again in an hour.', 'rate_limited');
            if (globalRef) {
                const g = windowCount(globalSnap.exists ? globalSnap.data() : {});
                if (g.count >= cfg.publicOrdersPerHour) throw fail('resource-exhausted', 'Checkout is busy. Try again in an hour.', 'rate_limited_global');
                const gws = g.inWindow ? g.windowStart : nowMs;
                tx.set(globalRef, { windowStartMs: gws, count: g.count + 1, expireAt: new Date(gws + 2 * 3600000) });
            }
            if (q.lifetime) {
                const c = counterSnap.exists ? counterSnap.data() : { sold: 0, holds: {} };
                const holds = liveHolds(c.holds, nowMs);
                const mine = Object.keys(holds).filter(function (id) { return holds[id].uid === who.holdKey; });
                if (mine.length) throw fail('failed-precondition', "You already have a Founders' checkout open. Finish it or wait about 35 minutes.", 'hold_exists');
                // One live Founders' hold per network (IPv6 /64 or exact IPv4; keyed hash only).
                const sameIp = who.ipHash ? Object.keys(holds).filter(function (id) { return holds[id].ipHash === who.ipHash; }) : [];
                if (sameIp.length) throw fail('failed-precondition', "A Founders' checkout is already open from this network. Finish it or wait about 35 minutes.", 'hold_exists_ip');
                if ((Number(c.sold) || 0) + Object.keys(holds).length >= pricing.FOUNDERS_CAP) {
                    throw fail('resource-exhausted', "Founders' Lifetime is sold out.", 'founders_sold_out');
                }
                if (Object.keys(holds).length >= cfg.maxLiveFoundersHolds) {
                    throw fail('resource-exhausted', "Lots of people are checking out Founders' right now. Try again in about 30 minutes.", 'founders_busy');
                }
                holds[orderId] = { uid: who.holdKey, ipHash: who.ipHash || null, expMs: nowMs + holdMs };
                tx.set(counterRef, Object.assign({}, c, { sold: Number(c.sold) || 0, holds: holds, cap: pricing.FOUNDERS_CAP, updatedAtMs: nowMs }));
            }
            // expireAt: Firestore TTL field (policy on premium_rate.expireAt; see docs).
            const ws = inWindow ? windowStart : nowMs;
            tx.set(rateRef, { windowStartMs: ws, count: count + 1, expireAt: new Date(ws + 2 * 3600000) });
            tx.set(orderRef, {
                uid: who.uid || null,
                emailKey: who.emailKey || null,
                trialEmailKey: who.trialEmailKey || null,
                email: who.uid ? null : who.email,
                // Set only while a plain email is stored; the sweep clears the
                // email after publicOrderEmailRetentionMonths (single-field range query).
                emailHeldSinceMs: who.uid || !who.email ? null : nowMs,
                channel: channel,
                src: src || null,
                plan: q.plan,
                rail: q.rail,
                provider: provider,
                months: q.months,
                termMonths: q.termMonths,
                lifetime: q.lifetime,
                cardMode: q.cardMode,
                interval: q.interval,
                baseCents: q.baseCents,
                unitCents: q.unitCents,
                amountCents: q.amountCents,
                currency: 'usd',
                discounts: q.discounts,
                stackMode: q.stackMode,
                existingUser: q.existingUser,
                status: 'pending',
                founderHold: q.lifetime,
                mode: mode(),
                createdAtMs: nowMs,
                holdExpMs: q.lifetime ? nowMs + holdMs : null,
                startsAtMs: startMs,
                trialEndMs: trialEndMs,
                trialDays: trialEndMs && who.trialEligible && cfg.trialDays > 0 ? cfg.trialDays : 0,
                expectedTotalCents: expectedTotalCents,
            });
        });

        let url = null;
        try {
            const base = who.returnBase || siteUrl();
            const back = channel === 'public' ? base + '/premium' : base + '/';
            const metadata = { orderId: orderId };
            if (src) metadata.src = src;
            if (provider === 'stripe') {
                const params = {
                    mode: q.cardMode,
                    // Cards only (Apple Pay / Google Pay ride on card). Keeps
                    // Klarna, bank debits and other delayed or BNPL methods off
                    // even if the Stripe account has them switched on.
                    payment_method_types: ['card'],
                    client_reference_id: orderId,
                    metadata: metadata,
                    line_items: [{
                        quantity: 1,
                        price_data: {
                            currency: 'usd',
                            unit_amount: q.unitCents,
                            product_data: { name: q.label },
                            recurring: q.cardMode === 'subscription' ? { interval: q.interval } : undefined,
                        },
                    }],
                    success_url: back + '?premium=success&order=' + orderId,
                    cancel_url: back + '?premium=cancel&order=' + orderId,
                    expires_at: Math.floor(nowMs / 1000) + STRIPE_CHECKOUT_MINUTES * 60,
                };
                if (q.cardMode === 'subscription') {
                    params.subscription_data = { metadata: metadata };
                    // No charge today, no proration. A plain N-day trial uses
                    // trial_period_days so the hosted page shows the full N
                    // days even if checkout finishes a few minutes later.
                    // billingStartsAt in the future must stay trial_end:
                    // trial_period_days would start the clock at checkout and
                    // charge before Jan 3 / Jan 10.
                    if (trialEndMs) {
                        if (!startMs && who.trialEligible && cfg.trialDays > 0) {
                            params.subscription_data.trial_period_days = cfg.trialDays;
                        } else {
                            params.subscription_data.trial_end = Math.floor(trialEndMs / 1000);
                        }
                    }
                } else { params.payment_intent_data = { metadata: metadata }; params.customer_creation = 'always'; }
                const note = checkoutNote(q, startMs, trialEndMs);
                if (note) params.custom_text = { submit: { message: note } };
                if (who.customerId) params.customer = who.customerId;
                else if (who.email) params.customer_email = who.email;
                const s = await stripeRequest('POST', '/v1/checkout/sessions', params, 'bq-checkout-' + orderId);
                if (!s || typeof s.id !== 'string' || typeof s.url !== 'string') throw new Error('stripe_bad_response');
                url = s.url;
                await orderRef.update({ providerSessionId: s.id });
            } else {
                const inv = await btcpayRequest('POST', '/invoices', {
                    amount: pricing.centsToUsdString(q.amountCents),
                    currency: 'USD',
                    metadata: Object.assign({ itemDesc: q.label }, metadata),
                    checkout: {
                        expirationMinutes: BTCPAY_INVOICE_MINUTES,
                        redirectURL: back + '?premium=success&order=' + orderId,
                        redirectAutomatically: false,
                    },
                });
                if (!inv || typeof inv.id !== 'string' || typeof inv.checkoutLink !== 'string') throw new Error('btcpay_bad_response');
                url = inv.checkoutLink;
                await orderRef.update({ providerInvoiceId: inv.id });
            }
        } catch (e) {
            log('premium checkout provider error', { orderId: orderId, provider: provider, err: String(e && e.message || e) });
            await releaseOrder(orderId, 'error', nowMs);
            if (e instanceof HttpsError) throw e;
            throw fail('unavailable', 'Checkout could not start. Try again in a minute.', 'provider_error');
        }
        return {
            orderId: orderId,
            url: url,
            amountCents: q.amountCents,
            baseCents: q.baseCents,
            discounts: q.discounts,
            plan: q.plan,
            rail: q.rail,
            months: q.months,
        };
    }

    // ---- In-app checkout (signed in). The only path that can apply the 5%.
    function requirePlanRail(d) {
        if (typeof d.plan !== 'string') throw fail('invalid-argument', 'Unknown plan.', 'bad_plan');
        if (typeof d.rail !== 'string') throw fail('invalid-argument', 'Pick card or Lightning.', 'bad_rail');
    }
    function ipHashFor(ipRaw) {
        if (!ipRaw || ipRaw === 'none') return null;
        return H('ip', networkIpMaterial(ipRaw));
    }
    function requireFoundersVerifiedEmail(auth, cfg) {
        if (!cfg.foundersRequireVerifiedEmail) return;
        if (auth && auth.token && auth.token.email_verified === true) return;
        throw fail('failed-precondition', 'Verify your email first.', 'email_not_verified');
    }

    async function createPremiumCheckout(data, context) {
        const auth = requireUser(context);
        const uid = auth.uid;
        mode();
        const d = data && typeof data === 'object' ? data : {};
        const cfg = await loadConfig();
        if (!cfg.checkoutEnabled) throw fail('failed-precondition', 'Checkout is not open yet.', 'checkout_closed');
        requirePlanRail(d);

        const userSnap = await ref('users', uid).get();
        const userDoc = userSnap.exists ? userSnap.data() : null;
        const blocked = blockedUser(userDoc);
        if (blocked) throw fail('permission-denied', 'This account cannot buy Premium.', blocked);

        const nowMs = now();
        const elig = await eligibilityFor(auth, cfg, nowMs, userDoc);
        const q = quoteOrThrow({
            plan: d.plan,
            rail: d.rail,
            months: d.months == null ? undefined : Number(d.months),
            nowMs: nowMs,
            existingUserEligible: elig.ok,
        }, cfg);
        if (q.lifetime) requireFoundersVerifiedEmail(auth, cfg);

        const entSnap = await ref(COL.entitlements, uid).get();
        const ent = entSnap.exists ? entSnap.data() : {};
        const st = summarize(ent, nowMs);
        if (st.founders) throw fail('failed-precondition', "You already have Founders' Lifetime.", 'already_lifetime');
        const subLive = ent.autoRenew === true && Number(ent.subscriptionUntilMs) > nowMs;
        if (q.cardMode === 'subscription' && subLive) throw fail('failed-precondition', 'You already have a subscription. Use Manage billing to change it.', 'already_subscribed');
        if (q.rail === 'lightning' && subLive) throw fail('failed-precondition', 'Turn off card renewal in Manage billing before prepaying with Lightning.', 'subscription_renewing');
        if (q.cardMode === 'subscription' && Number(ent.prepaidUntilMs) - nowMs > CARD_SUB_PREPAID_WINDOW_MS) {
            throw fail('failed-precondition', 'Your prepaid time is still running. You can start a card plan in its last 3 days.', 'prepaid_active');
        }
        const email = auth.token && auth.token.email_verified === true ? normalizeEmail(auth.token.email) : null;
        const ek = email ? ekey(email) : null;
        const tek = email ? tkey(email) : null;
        // Unknown IP (no raw request): no per-IP hold cap, never a shared bucket.
        const ipRaw = context && context.rawRequest ? clientIp(context.rawRequest) : 'none';
        const ipHash = ipHashFor(ipRaw);
        // A canonical email that already had a free trial starts paid, no trial.
        const emailTrialUsed = await trialMarkerExists('e', tek);
        return startOrder(q, { uid: uid, email: email, emailKey: ek, trialEmailKey: tek, ipHash: ipHash, holdKey: uid, rateKey: uid, customerId: ent.stripeCustomerId || null, trialEligible: !ent.trialUsed && !ent.stripeSubscriptionId && !ent.founders && !emailTrialUsed }, cfg, nowMs, cleanSrc(d.src), 'app');
    }

    // Turnstile siteverify result must be a success, for the premium_checkout
    // action, from a hostname allowed in this environment.
    function turnstileOk(r) {
        const m = providerMode(projectId);
        if (!m || !r || typeof r !== 'object' || r.success !== true) return false;
        if (r.action !== TURNSTILE_ACTION) return false;
        const host = String(r.hostname || '').toLowerCase();
        return TURNSTILE_HOSTS[m].some(function (h) { return typeof h === 'string' ? h === host : h.test(host); });
    }

    // ---- Public checkout for the static /premium page. Full price only.
    function corsOk(req, res) {
        const origin = (req.get ? req.get('origin') : req.headers.origin) || '';
        const m = providerMode(projectId);
        const allowed = m && PUBLIC_ORIGINS[m].some(function (re) { return re.test(origin); });
        if (allowed) {
            res.set('Access-Control-Allow-Origin', origin);
            res.set('Vary', 'Origin');
            res.set('Access-Control-Allow-Methods', 'POST');
            res.set('Access-Control-Allow-Headers', 'Content-Type');
            res.set('Access-Control-Max-Age', '600');
        }
        return allowed;
    }

    async function publicCheckout(body, ip, returnBase) {
        mode();
        const b = body && typeof body === 'object' ? body : {};
        const cfg = await loadConfig();
        if (!cfg.checkoutEnabled) throw fail('failed-precondition', 'Checkout is not open yet.', 'checkout_closed');
        requirePlanRail(b);
        // Founders' seats are scarce: sold only to signed-in accounts (in the
        // app), never to an email on the public page (Red Team, Nov 14).
        // In-app Founders also requires a verified email when
        // foundersRequireVerifiedEmail is on (the default).
        if (b.plan === 'founders') throw fail('failed-precondition', "Sign in to Bitcoin Quest to buy Founders' Lifetime.", 'founders_sign_in');
        const email = normalizeEmail(b.email);
        if (!email || !canonicalEmail(email)) throw fail('invalid-argument', 'Enter a valid email.', 'bad_email');
        if (!verifyTurnstile) throw fail('failed-precondition', 'Checkout is not set up yet.', 'no_turnstile');
        const tsr = await Promise.resolve(verifyTurnstile(String(b.turnstileToken || ''), ip || undefined)).catch(function () { return null; });
        if (!turnstileOk(tsr)) throw fail('permission-denied', 'Please complete the security check.', 'turnstile');
        const nowMs = now();
        const q = quoteOrThrow({
            plan: b.plan,
            rail: b.rail,
            months: b.months == null ? undefined : Number(b.months),
            nowMs: nowMs,
            existingUserEligible: false, // never on the public page
        }, cfg);
        const ek = ekey(email);
        const tek = tkey(email);
        const held = await ref(COL.emailEntitlements, ek).get();
        if (held.exists && held.data().founders === true) throw fail('failed-precondition', "This email already has Founders' Lifetime.", 'already_lifetime');
        const ipHash = ipHashFor(ip) || H('ip', 'none');
        const emailTrialUsed = await trialMarkerExists('e', tek);
        return startOrder(q, { uid: null, email: email, emailKey: ek, trialEmailKey: tek, ipHash: ipHash, holdKey: 'email:' + ek, rateKey: 'ip_' + ipHash, returnBase: returnBase || null, customerId: null, trialEligible: !emailTrialUsed && !(held.exists && (held.data().trialUsed || held.data().stripeSubscriptionId)) }, cfg, nowMs, cleanSrc(b.src), 'public');
    }

    async function premiumPublicCheckout(req, res) {
        const allowed = corsOk(req, res);
        if (req.method === 'OPTIONS') { res.status(allowed ? 204 : 403).send(''); return; }
        if (req.method !== 'POST' || !allowed) { res.status(403).json({ ok: false, reason: 'origin' }); return; }
        let body = req.body;
        if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
        try {
            // Send buyers back to the allowlisted page they came from (live
            // site, staging, or a Pages preview). corsOk already checked it.
            const origin = (req.get ? req.get('origin') : req.headers.origin) || '';
            const out = await publicCheckout(body, clientIp(req), origin);
            res.status(200).json({ ok: true, url: out.url, amountCents: out.amountCents, plan: out.plan });
        } catch (e) {
            if (e instanceof HttpsError) {
                const map = { 'invalid-argument': 400, 'permission-denied': 403, 'failed-precondition': 409, 'resource-exhausted': 429, unavailable: 503 };
                res.status(map[e.code] || 400).json({ ok: false, reason: e.details && e.details.reason, message: e.message });
                return;
            }
            log('premium public checkout error', { err: String(e && e.message || e) });
            res.status(500).json({ ok: false, reason: 'error' });
        }
    }

    // Marks a pending order expired/error and frees its Founders seat hold.
    async function releaseOrder(orderId, status, nowMs) {
        const orderRef = ref(COL.orders, orderId);
        const counterRef = ref(COL.counters, 'founders');
        await db.runTransaction(async function (tx) {
            const o = await tx.get(orderRef);
            if (!o.exists) return;
            const order = o.data();
            const c = order.founderHold ? await tx.get(counterRef) : null;
            if (order.status !== 'pending') return;
            tx.update(orderRef, { status: status, closedAtMs: nowMs });
            if (c && c.exists) {
                const holds = Object.assign({}, c.data().holds || {});
                if (holds[orderId]) {
                    delete holds[orderId];
                    tx.update(counterRef, { holds: holds, updatedAtMs: nowMs });
                }
            }
        });
    }

    // ---- shared grant (inside a transaction, after all reads)
    function writeEntitlement(tx, r) {
        const s = summarize(r.ent, r.nowMs);
        r.ent.active = s.active;
        r.ent.expiresAtMs = s.expiresAtMs;
        r.ent.plan = s.plan;
        r.ent.pendingStart = s.pendingStart;
        r.ent.updatedAtMs = r.nowMs;
        tx.set(r.entRef, r.ent);
        if (r.userExists && r.uid) {
            tx.set(ref('users', r.uid), { premium: { active: s.active, plan: s.plan, founders: s.founders, expiresAtMs: s.expiresAtMs, startsAtMs: s.startsAtMs, inTrial: s.inTrial, updatedAtMs: r.nowMs } }, { merge: true });
        }
    }

    function review(tx, reason, detail, nowMs, id) {
        const rid = id || newId();
        tx.set(ref(COL.review, rid), Object.assign({ reason: reason, createdAtMs: nowMs, resolved: false }, detail));
        return rid;
    }

    function stripeSubId(obj) {
        if (!obj) return null;
        if (typeof obj.subscription === 'string' && obj.subscription) return obj.subscription;
        if (obj.subscription && typeof obj.subscription.id === 'string' && obj.subscription.id) return obj.subscription.id;
        return null;
    }

    // An entitlement that is not already running starts at the order's start
    // time (billingStartsAt) or now. A running one keeps its start.
    function setStart(r, o) {
        if (summarize(r.ent, r.nowMs).active) return;
        r.ent.startsAtMs = o && o.startsAtMs ? o.startsAtMs : null;
    }

    // Runs fn inside a transaction guarded by a one-time event marker.
    // The entitlement owner is the order's uid, else the email holding doc
    // (or the account that claimed it).
    async function once(eventKey, orderId, fn) {
        const eventRef = ref(COL.events, eventKey);
        return db.runTransaction(async function (tx) {
            const ev = await tx.get(eventRef);
            if (ev.exists) return 'duplicate';
            const nowMs = now();
            const orderRef = orderId ? ref(COL.orders, orderId) : null;
            const oSnap = orderRef ? await tx.get(orderRef) : null;
            const order = oSnap && oSnap.exists ? oSnap.data() : null;
            let uid = order && order.uid ? order.uid : null;
            let entRef = null;
            if (order && !uid && order.emailKey) {
                const eRef = ref(COL.emailEntitlements, order.emailKey);
                const eSnap = await tx.get(eRef);
                const claimedBy = eSnap.exists && eSnap.data().claimedByUid;
                if (claimedBy) uid = claimedBy;
                else entRef = eRef;
            }
            if (uid) entRef = ref(COL.entitlements, uid);
            const entSnap = entRef ? await tx.get(entRef) : null;
            const userSnap = uid ? await tx.get(ref('users', uid)) : null;
            const cSnap = order && order.lifetime ? await tx.get(ref(COL.counters, 'founders')) : null;
            const ent = entSnap && entSnap.exists ? Object.assign({}, entSnap.data()) : {};
            // Email-held entitlements keep only the hashed key, never the plain email.
            if (entRef && !uid && order) { delete ent.email; ent.emailKey = order.emailKey; }
            const out = await fn(tx, {
                nowMs: nowMs,
                orderRef: orderRef,
                order: order,
                uid: uid,
                entRef: entRef,
                ent: ent,
                userExists: !!(userSnap && userSnap.exists),
                counter: cSnap && cSnap.exists ? cSnap.data() : { sold: 0, holds: {} },
            });
            // Not-final outcomes leave no marker, so a retry is processed again.
            if (RETRYABLE_OUTCOMES.indexOf(out) === -1) {
                tx.create(eventRef, { at: nowMs, orderId: orderId || null, outcome: out });
            }
            return out;
        });
    }

    // Lifetime grant with the 500-seat cap. Never oversells: if the hold
    // expired and the cap is full, the order goes to manual refund review.
    function grantFounders(tx, r, orderId, providerRef) {
        const c = r.counter;
        const holds = Object.assign({}, c.holds || {});
        const hadHold = !!holds[orderId];
        delete holds[orderId];
        const live = liveHolds(holds, r.nowMs);
        const sold = Number(c.sold) || 0;
        if (!hadHold && sold + Object.keys(live).length >= pricing.FOUNDERS_CAP) {
            tx.set(ref(COL.counters, 'founders'), Object.assign({}, c, { sold: sold, holds: holds, cap: pricing.FOUNDERS_CAP, updatedAtMs: r.nowMs }));
            tx.update(r.orderRef, { status: 'review', reviewReason: 'founders_sold_out_late_payment', paidAtMs: r.nowMs, providerRef: providerRef });
            review(tx, 'founders_sold_out_late_payment', { orderId: orderId, uid: r.uid, providerRef: providerRef, amountCents: r.order.amountCents }, r.nowMs);
            return 'review';
        }
        tx.set(ref(COL.counters, 'founders'), Object.assign({}, c, { sold: sold + 1, holds: holds, cap: pricing.FOUNDERS_CAP, updatedAtMs: r.nowMs }));
        if (r.ent.autoRenew === true && r.ent.stripeSubscriptionId) {
            review(tx, 'founders_with_active_subscription', { orderId: orderId, uid: r.uid, stripeSubscriptionId: r.ent.stripeSubscriptionId }, r.nowMs);
        }
        setStart(r, r.order);
        r.ent.founders = true;
        r.ent.foundersOrderId = orderId;
        r.ent.foundersSeat = sold + 1;
        writeEntitlement(tx, r);
        tx.update(r.orderRef, { status: 'paid', paidAtMs: r.nowMs, providerRef: providerRef });
        return 'granted';
    }

    function grantPrepaid(tx, r, orderId, providerRef) {
        setStart(r, r.order);
        const from = Math.max(r.nowMs, Number(r.order.startsAtMs) || 0, Number(r.ent.prepaidUntilMs) || 0);
        r.ent.prepaidUntilMs = pricing.addMonths(from, Number(r.order.termMonths) || 0);
        r.ent.prepaidPlan = r.order.plan;
        writeEntitlement(tx, r);
        tx.update(r.orderRef, { status: 'paid', paidAtMs: r.nowMs, providerRef: providerRef });
        return 'granted';
    }

    async function sessionCardFingerprint(sessionId) {
        if (typeof sessionId !== 'string' || !/^cs_[A-Za-z0-9_]{6,200}$/.test(sessionId)) return null;
        const q = '?expand[]=setup_intent.payment_method&expand[]=payment_intent.payment_method&expand[]=subscription.default_payment_method';
        const s = await stripeRequest('GET', '/v1/checkout/sessions/' + encodeURIComponent(sessionId) + q);
        const pms = [
            s && s.subscription && s.subscription.default_payment_method,
            s && s.setup_intent && s.setup_intent.payment_method,
            s && s.payment_intent && s.payment_intent.payment_method,
        ];
        for (const pm of pms) {
            if (pm && pm.card && typeof pm.card.fingerprint === 'string' && pm.card.fingerprint) return pm.card.fingerprint;
        }
        return null;
    }

    function orderIdsForCharge(ch) {
        const id = ch && ch.metadata && ch.metadata.orderId;
        return typeof id === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(id) ? [id] : [];
    }

    // Clears the plain email from orders (by id, else by Stripe customer).
    async function clearOrderEmails(orderIds, customerId, why) {
        const nowMs = now();
        const docs = [];
        for (const id of orderIds) { const d = await ref(COL.orders, id).get(); if (d.exists) docs.push(d); }
        if (!docs.length && customerId) {
            const q = await db.collection(COL.orders).where('stripeCustomerId', '==', customerId).limit(50).get();
            q.docs.forEach(function (d) { docs.push(d); });
        }
        let cleared = 0;
        for (const d of docs) {
            if (d.data().email == null && d.data().emailHeldSinceMs == null) continue;
            await d.ref.update({ email: null, emailHeldSinceMs: null, emailClearedAtMs: nowMs, emailClearedReason: why });
            cleared++;
        }
        return cleared;
    }

    // Shared trial gate for checkout.session.completed and invoice.paid.
    // Reads markers before any writes. Idempotent: markers for this order
    // are not reuse, and an order already in trial_reused review is left as-is.
    async function applyTrialGate(tx, r, g) {
        const o = r.order;
        const orderId = g.orderId;
        const fpHash = g.fpHash || null;
        const isTrial = !!(o && o.trialEndMs && o.trialDays > 0);
        if (!isTrial) return { outcome: 'ok', isTrial: false, fpHash: fpHash };

        if (o.status === 'review' && o.reviewReason === 'trial_reused') {
            return {
                outcome: 'review',
                isTrial: true,
                already: true,
                trialReuseSubId: o.stripeSubscriptionId || g.subId || null,
                trialReuseReviewId: o.trialReuseReviewId || null,
                fpHash: o.cardFpHash || fpHash,
            };
        }

        const missingFp = !fpHash;
        const cardRef = fpHash ? ref(COL.trialMarkers, 'c_' + fpHash) : null;
        const trialEk = (o.trialEmailKey || o.emailKey) || null;
        const mailRef = trialEk ? ref(COL.trialMarkers, 'e_' + trialEk) : null;
        const cardSnap = cardRef ? await tx.get(cardRef) : null;
        const mailSnap = mailRef ? await tx.get(mailRef) : null;
        const reused = [cardSnap, mailSnap].filter(function (x) {
            return x && x.exists && x.data().orderId !== orderId;
        });

        if (reused.length || missingFp) {
            const subId = g.subId || o.stripeSubscriptionId || null;
            const by = [];
            if (missingFp) by.push('missing_fingerprint');
            reused.forEach(function (x) { by.push(x === cardSnap ? 'card' : 'email'); });
            const reviewId = o.trialReuseReviewId || newId();
            if (!o.trialReuseReviewId) {
                review(tx, 'trial_reused', {
                    eventId: g.eventId || null,
                    orderId: orderId,
                    uid: o.uid || r.uid || null,
                    customerId: g.customerId || null,
                    sessionId: g.sessionId || o.providerSessionId || null,
                    firstOrderId: reused.length ? (reused[0].data().orderId || null) : null,
                    by: by,
                    subscriptionId: subId,
                    subscription_canceled: false,
                }, r.nowMs, reviewId);
            }
            tx.update(r.orderRef, {
                status: 'review',
                reviewReason: 'trial_reused',
                cardFpHash: fpHash,
                stripeCustomerId: g.customerId || o.stripeCustomerId || null,
                stripeSubscriptionId: subId,
                trialReuseReviewId: reviewId,
                subscription_canceled: o.subscription_canceled === true,
            });
            // If an earlier event already granted time, take it back.
            revokeTrialGrant(tx, r, orderId);
            return {
                outcome: 'review',
                isTrial: true,
                trialReuseSubId: subId,
                trialReuseReviewId: reviewId,
                fpHash: fpHash,
            };
        }

        if (cardRef) tx.set(cardRef, { orderId: orderId, kind: 'card', atMs: r.nowMs });
        if (mailRef) tx.set(mailRef, { orderId: orderId, kind: 'email', atMs: r.nowMs });
        return { outcome: 'ok', isTrial: true, fpHash: fpHash };
    }

    function revokeTrialGrant(tx, r, orderId) {
        const e = r.ent;
        if (!e) return;
        if (e.subscriptionOrderId && e.subscriptionOrderId !== orderId) return;
        const had = e.subscriptionOrderId === orderId || e.trialUsed === true || Number(e.subscriptionUntilMs) > 0 || Number(e.trialUntilMs) > 0;
        if (!had) return;
        e.autoRenew = false;
        e.trialUntilMs = null;
        e.subscriptionUntilMs = 0;
        e.stripeSubscriptionStatus = 'canceled';
        e.trialReused = true;
        e.frozen = true;
        e.frozenReason = 'trial_reused';
        e.frozenAtMs = r.nowMs;
        writeEntitlement(tx, r);
    }

    function grantSubscriptionFromOrder(tx, r, g, periodEndSec) {
        const o = r.order;
        const orderId = g.orderId;
        setStart(r, o);
        if (g.customerId) r.ent.stripeCustomerId = g.customerId;
        if (g.subId) r.ent.stripeSubscriptionId = g.subId;
        else r.ent.stripeSubscriptionId = r.ent.stripeSubscriptionId || null;
        r.ent.subscriptionPlan = o.plan;
        r.ent.subscriptionOrderId = orderId;
        r.ent.autoRenew = true;
        if (o.trialEndMs) { r.ent.trialUsed = true; if (o.trialDays > 0) r.ent.trialUntilMs = o.trialEndMs; }
        const stashed = Number(o.trialInvoicePeriodEnd) || 0;
        const provisional = (o.trialEndMs || pricing.addMonths(r.nowMs, o.interval === 'year' ? 12 : 1)) + SUB_GRACE_MS;
        const fromInvoice = periodEndSec ? (Number(periodEndSec) * 1000 + SUB_GRACE_MS) : (stashed ? stashed * 1000 + SUB_GRACE_MS : 0);
        r.ent.subscriptionUntilMs = Math.max(Number(r.ent.subscriptionUntilMs) || 0, fromInvoice || provisional);
        writeEntitlement(tx, r);
        const orderPatch = {
            status: 'paid',
            paidAtMs: o.paidAtMs || r.nowMs,
            cardFpHash: g.fpHash || o.cardFpHash || null,
            stripeCustomerId: g.customerId || o.stripeCustomerId || null,
            stripeSubscriptionId: r.ent.stripeSubscriptionId,
        };
        if (g.providerRef) orderPatch.providerRef = g.providerRef;
        if (g.invoicePatch) Object.assign(orderPatch, g.invoicePatch);
        tx.update(r.orderRef, orderPatch);
        return 'granted';
    }

    async function cancelTrialReuse(subId, orderId, reviewId) {
        if (!subId) return { status: 200, canceled: false };
        try {
            await stripeRequest('DELETE', '/v1/subscriptions/' + encodeURIComponent(subId));
            if (orderId) {
                const oRef = ref(COL.orders, orderId);
                const oSnap = await oRef.get();
                if (oSnap.exists) await oRef.update({ subscription_canceled: true });
            }
            if (reviewId) {
                const rRef = ref(COL.review, reviewId);
                const rSnap = await rRef.get();
                if (rSnap.exists) await rRef.update({ subscription_canceled: true });
            }
            return { status: 200, canceled: true };
        } catch (e) {
            return { status: 500, canceled: false };
        }
    }

    // ---- Stripe webhook
    async function handleStripeEvent(event) {
        if (!event || typeof event.id !== 'string' || typeof event.type !== 'string') return { status: 400, outcome: 'bad_event' };
        const wantLive = mode() === 'live';
        if (event.livemode !== wantLive) return { status: 400, outcome: 'wrong_mode' };
        const obj = (event.data && event.data.object) || {};
        const key = 'stripe_' + event.id;
        const t = event.type;

        if (t === 'checkout.session.completed' || t === 'checkout.session.async_payment_succeeded') {
            const orderId = String(obj.client_reference_id || (obj.metadata && obj.metadata.orderId) || '');
            // Card fingerprint (hashed) for trial-reuse checks. Webhook payloads
            // never carry the payment method, so read the session back expanded.
            // A failed read throws, the webhook answers 500 and Stripe retries.
            const fp = await sessionCardFingerprint(obj.id);
            const fpHash = fp ? H('card', fp) : null;
            let trialReuseReviewId = null;
            let trialReuseSubId = null;
            const outcome = await once(key, orderId || null, async function (tx, r) {
                const o = r.order;
                if (!o || o.provider !== 'stripe' || o.providerSessionId !== obj.id || !r.entRef) {
                    review(tx, 'stripe_unknown_order', { orderId: orderId || null, sessionId: obj.id || null, eventId: event.id }, r.nowMs);
                    return 'review';
                }
                const want = o.expectedTotalCents != null ? o.expectedTotalCents : o.amountCents;
                if (o.status !== 'review' && (obj.amount_total !== want || obj.currency !== 'usd' || obj.mode !== o.cardMode)) {
                    review(tx, 'stripe_amount_mismatch', { orderId: orderId, uid: o.uid, sessionId: obj.id, got: obj.amount_total, want: want }, r.nowMs);
                    tx.update(r.orderRef, { status: 'review', reviewReason: 'amount_mismatch' });
                    return 'review';
                }
                const settled = obj.payment_status === 'paid' || (want === 0 && obj.payment_status === 'no_payment_required');
                if (!settled) return 'not_paid_yet';
                const subId = stripeSubId(obj) || o.stripeSubscriptionId || null;
                const customerId = typeof obj.customer === 'string' ? obj.customer : (o.stripeCustomerId || null);
                // already_paid must never skip the trial gate.
                const gate = await applyTrialGate(tx, r, {
                    orderId: orderId,
                    fpHash: fpHash,
                    sessionId: obj.id,
                    customerId: customerId,
                    subId: subId,
                    eventId: event.id,
                });
                if (gate.outcome === 'review') {
                    trialReuseSubId = gate.trialReuseSubId;
                    trialReuseReviewId = gate.trialReuseReviewId;
                    return 'review';
                }
                if (o.status === 'review') return 'review';
                if (o.status === 'paid') {
                    const patch = {};
                    if (fpHash && !o.cardFpHash) patch.cardFpHash = fpHash;
                    if (customerId && !o.stripeCustomerId) patch.stripeCustomerId = customerId;
                    if (Object.keys(patch).length) tx.update(r.orderRef, patch);
                    return 'already_paid';
                }
                if (o.lifetime) return grantFounders(tx, r, orderId, obj.id);
                return grantSubscriptionFromOrder(tx, r, {
                    orderId: orderId,
                    fpHash: gate.fpHash || fpHash,
                    customerId: customerId,
                    subId: subId,
                    providerRef: obj.id,
                }, Number(o.trialInvoicePeriodEnd) || 0);
            });
            // Cancel outside the transaction. Also runs on a webhook retry
            // (once() returns 'duplicate') if the first cancel attempt failed.
            if (outcome === 'duplicate' && orderId && !trialReuseSubId) {
                const prev = await ref(COL.orders, orderId).get();
                const po = prev.exists ? prev.data() : null;
                if (po && po.reviewReason === 'trial_reused' && po.subscription_canceled !== true) {
                    trialReuseSubId = po.stripeSubscriptionId || stripeSubId(obj);
                    trialReuseReviewId = po.trialReuseReviewId || null;
                }
            }
            if (trialReuseSubId) {
                const canceled = await cancelTrialReuse(trialReuseSubId, orderId, trialReuseReviewId);
                if (canceled.status === 500) return { status: 500, outcome: 'subscription_cancel_failed' };
            }
            return { status: 200, outcome: outcome };
        }

        if (t === 'invoice.paid') {
            const parent = obj.parent && obj.parent.subscription_details;
            const subId = obj.subscription || (parent && parent.subscription) || null;
            const meta = (obj.subscription_details && obj.subscription_details.metadata) || (parent && parent.metadata) || {};
            const orderId = String(meta.orderId || '');
            // $0 trial opening invoices must pass the same fingerprint/email
            // gate. Fetch the session fingerprint before the transaction, in
            // case this event arrives before checkout.session.completed.
            let fpHash = null;
            if (orderId && Number(obj.amount_paid) === 0 && obj.billing_reason === 'subscription_create') {
                const pre = await ref(COL.orders, orderId).get();
                const po = pre.exists ? pre.data() : null;
                if (po && po.trialEndMs && po.trialDays > 0) {
                    if (!po.providerSessionId) return { status: 500, outcome: 'session_missing' };
                    const fp = await sessionCardFingerprint(po.providerSessionId);
                    fpHash = fp ? H('card', fp) : null;
                }
            }
            let trialReuseReviewId = null;
            let trialReuseSubId = null;
            const outcome = await once(key, orderId || null, async function (tx, r) {
                const o = r.order;
                if (!o || o.provider !== 'stripe' || o.cardMode !== 'subscription' || !subId || !r.entRef) {
                    review(tx, 'stripe_invoice_unknown_order', { orderId: orderId || null, invoiceId: obj.id || null, eventId: event.id }, r.nowMs);
                    return 'review';
                }
                // Orders held for review (e.g. trial reuse) get no time until a human clears them.
                if (o.status === 'review') {
                    review(tx, 'stripe_invoice_order_in_review', { orderId: orderId, uid: o.uid, invoiceId: obj.id, customerId: typeof obj.customer === 'string' ? obj.customer : null, amount: obj.amount_paid }, r.nowMs);
                    if (o.reviewReason === 'trial_reused' && o.subscription_canceled !== true) {
                        trialReuseSubId = o.stripeSubscriptionId || subId;
                        trialReuseReviewId = o.trialReuseReviewId || null;
                    }
                    return 'review';
                }
                if (o.stripeSubscriptionId && o.stripeSubscriptionId !== subId) {
                    review(tx, 'stripe_subscription_mismatch', { orderId: orderId, uid: o.uid, invoiceId: obj.id }, r.nowMs);
                    return 'review';
                }
                if (obj.currency !== 'usd' || (Number(obj.amount_paid) !== o.unitCents && Number(obj.amount_paid) !== 0)) {
                    review(tx, 'stripe_invoice_amount_mismatch', { orderId: orderId, uid: o.uid, invoiceId: obj.id, got: obj.amount_paid, want: o.unitCents }, r.nowMs);
                    return 'review';
                }
                // A $0 invoice is only the trial's opening invoice: the order had
                // a trial, Stripe says subscription_create, and it is the first
                // invoice for this order. Anything else (promo code, credit
                // balance, coupon added later) goes to review, no time granted.
                if (Number(obj.amount_paid) === 0) {
                    const firstInvoice = !(Number(o.invoicesPaid) > 0) && !o.firstInvoiceId;
                    if (!o.trialEndMs || obj.billing_reason !== 'subscription_create' || !firstInvoice) {
                        review(tx, 'stripe_zero_invoice', { orderId: orderId, uid: o.uid, invoiceId: obj.id, billingReason: String(obj.billing_reason || '') }, r.nowMs);
                        return 'review';
                    }
                }
                const lines = (obj.lines && obj.lines.data) || [];
                let periodEnd = 0;
                lines.forEach(function (l) { if (l && l.period && Number(l.period.end) > periodEnd) periodEnd = Number(l.period.end); });
                if (!periodEnd) {
                    review(tx, 'stripe_invoice_no_period', { orderId: orderId, uid: o.uid, invoiceId: obj.id }, r.nowMs);
                    return 'review';
                }
                const customerId = typeof obj.customer === 'string' ? obj.customer : (o.stripeCustomerId || null);
                const invoicePatch = { invoicesPaid: (Number(o.invoicesPaid) || 0) + 1, firstInvoiceId: o.firstInvoiceId || obj.id || null, trialInvoicePeriodEnd: periodEnd };
                if (customerId && !o.stripeCustomerId) invoicePatch.stripeCustomerId = customerId;
                // $0 trial opening invoice: must pass the shared trial gate.
                // It may grant only after the gate passes (idempotent if the
                // session event already granted).
                if (Number(obj.amount_paid) === 0 && o.trialDays > 0) {
                    const gate = await applyTrialGate(tx, r, {
                        orderId: orderId,
                        fpHash: fpHash,
                        sessionId: o.providerSessionId || null,
                        customerId: customerId,
                        subId: subId,
                        eventId: event.id,
                    });
                    if (gate.outcome === 'review') {
                        trialReuseSubId = gate.trialReuseSubId;
                        trialReuseReviewId = gate.trialReuseReviewId;
                        return 'review';
                    }
                    if (o.status === 'paid') {
                        r.ent.stripeSubscriptionId = subId;
                        if (customerId) r.ent.stripeCustomerId = customerId;
                        r.ent.subscriptionUntilMs = Math.max(Number(r.ent.subscriptionUntilMs) || 0, periodEnd * 1000 + SUB_GRACE_MS);
                        writeEntitlement(tx, r);
                        tx.update(r.orderRef, invoicePatch);
                        return 'granted';
                    }
                    return grantSubscriptionFromOrder(tx, r, {
                        orderId: orderId,
                        fpHash: gate.fpHash || fpHash,
                        customerId: customerId,
                        subId: subId,
                        invoicePatch: invoicePatch,
                    }, periodEnd);
                }
                r.ent.stripeSubscriptionId = subId;
                if (customerId) r.ent.stripeCustomerId = customerId;
                r.ent.subscriptionPlan = o.plan;
                r.ent.subscriptionOrderId = orderId;
                r.ent.subscriptionUntilMs = Math.max(Number(r.ent.subscriptionUntilMs) || 0, periodEnd * 1000 + SUB_GRACE_MS);
                writeEntitlement(tx, r);
                if (o.status !== 'paid') Object.assign(invoicePatch, { status: 'paid', paidAtMs: r.nowMs, stripeSubscriptionId: subId });
                tx.update(r.orderRef, invoicePatch);
                return 'granted';
            });
            if (outcome === 'duplicate' && orderId && !trialReuseSubId) {
                const prev = await ref(COL.orders, orderId).get();
                const po = prev.exists ? prev.data() : null;
                if (po && po.reviewReason === 'trial_reused' && po.subscription_canceled !== true) {
                    trialReuseSubId = po.stripeSubscriptionId || subId;
                    trialReuseReviewId = po.trialReuseReviewId || null;
                }
            }
            if (trialReuseSubId) {
                const canceled = await cancelTrialReuse(trialReuseSubId, orderId, trialReuseReviewId);
                if (canceled.status === 500) return { status: 500, outcome: 'subscription_cancel_failed' };
            }
            return { status: 200, outcome: outcome };
        }

        if (t === 'customer.subscription.updated' || t === 'customer.subscription.deleted') {
            const orderId = String((obj.metadata && obj.metadata.orderId) || '');
            const outcome = await once(key, orderId || null, async function (tx, r) {
                const o = r.order;
                if (!o || o.provider !== 'stripe' || !r.entRef || (r.ent.stripeSubscriptionId && r.ent.stripeSubscriptionId !== obj.id)) return 'ignored';
                // A reused trial sent to review must not become renewing again.
                if (o.status === 'review' && o.reviewReason === 'trial_reused') return 'review';
                if (r.ent.trialReused === true || r.ent.frozenReason === 'trial_reused') {
                    r.ent.autoRenew = false;
                    r.ent.stripeSubscriptionStatus = String(obj.status || '');
                    writeEntitlement(tx, r);
                    return 'not_renewing';
                }
                const renewing = t !== 'customer.subscription.deleted' && obj.cancel_at_period_end !== true && (obj.status === 'active' || obj.status === 'trialing');
                r.ent.autoRenew = renewing;
                r.ent.stripeSubscriptionStatus = String(obj.status || '');
                writeEntitlement(tx, r); // paid time already granted stays
                return renewing ? 'renewing' : 'not_renewing';
            });
            return { status: 200, outcome: outcome };
        }

        if (t === 'checkout.session.expired') {
            const orderId = String(obj.client_reference_id || (obj.metadata && obj.metadata.orderId) || '');
            if (orderId) {
                const o = await ref(COL.orders, orderId).get();
                if (o.exists && o.data().providerSessionId === obj.id) await releaseOrder(orderId, 'expired', now());
            }
            await once(key, null, async function () { return 'released'; });
            return { status: 200, outcome: 'released' };
        }

        if (t === 'charge.refunded' || t === 'charge.dispute.created' || t === 'invoice.payment_failed') {
            // Find who this is about: order id from metadata, else the Stripe customer.
            const customerId = typeof obj.customer === 'string' ? obj.customer : null;
            let orderIds = orderIdsForCharge(obj);
            const subMeta = obj.parent && obj.parent.subscription_details && obj.parent.subscription_details.metadata;
            if (!orderIds.length && subMeta && typeof subMeta.orderId === 'string') orderIds = [subMeta.orderId];
            if (!orderIds.length && customerId) {
                const q = await db.collection(COL.orders).where('stripeCustomerId', '==', customerId).limit(10).get();
                orderIds = q.docs.map(function (d) { return d.id; });
            }
            // Entitlements to freeze: by Stripe customer (account and email-held).
            const entRefs = [];
            if (customerId) {
                const a = await db.collection(COL.entitlements).where('stripeCustomerId', '==', customerId).limit(10).get();
                const b = await db.collection(COL.emailEntitlements).where('stripeCustomerId', '==', customerId).limit(10).get();
                a.docs.concat(b.docs).forEach(function (d) { entRefs.push(d.ref); });
            }
            if (t === 'charge.refunded' && obj.refunded === true) {
                // Full refund: the buyer's plain email is no longer needed.
                await clearOrderEmails(orderIds, customerId, 'refunded');
            }
            const firstOrderId = orderIds[0] || null;
            const isFullRefund = t === 'charge.refunded' && obj.refunded === true;
            const outcome = await once(key, firstOrderId, async function (tx, r) {
                const snaps = [];
                for (const er of entRefs) snaps.push(await tx.get(er));
                const uids = [];
                snaps.forEach(function (sn) {
                    if (!sn.exists) return;
                    const isAccount = sn.ref.path.indexOf(COL.entitlements + '/') === 0;
                    if (isAccount) uids.push(sn.id);
                });
                const walletSnaps = [];
                if (isFullRefund) {
                    for (let i = 0; i < uids.length; i++) walletSnaps.push(await tx.get(ref(COL.allowance, uids[i])));
                }
                snaps.forEach(function (sn) {
                    if (!sn.exists) return;
                    const e = Object.assign({}, sn.data(), { frozen: true, frozenAtMs: r.nowMs, frozenReason: t });
                    const isAccount = sn.ref.path.indexOf(COL.entitlements + '/') === 0;
                    writeEntitlement(tx, { nowMs: r.nowMs, uid: isAccount ? sn.id : null, entRef: sn.ref, ent: e, userExists: isAccount });
                });
                if (isFullRefund) {
                    walletSnaps.forEach(function (ws, i) {
                        if (!ws.exists) return;
                        const cur = ws.data();
                        const take = periodUnspentEmbers(cur);
                        if (take <= 0) return;
                        const next = Math.max(0, walletEmbers(cur) - take);
                        tx.set(ws.ref, Object.assign({}, cur, { embers: next, cosmeticCredits: next, periodGranted: 0, periodSpent: 0, clawedBackAtMs: r.nowMs, clawedBack: take, updatedAtMs: r.nowMs }));
                    });
                }
                const uid = (r.order && r.order.uid) || uids[0] || null;
                review(tx, 'stripe_' + t.replace(/\./g, '_'), {
                    eventId: event.id,
                    objectId: obj.id || null,
                    uid: uid,
                    orderId: firstOrderId,
                    customerId: customerId,
                    amount: obj.amount_refunded || obj.amount || obj.amount_due || null,
                    frozen: snaps.filter(function (x) { return x.exists; }).length,
                }, r.nowMs);
                // Human alert: the admin panel's admin_notifications feed.
                tx.set(ref('admin_notifications', newId()), {
                    type: 'premium_review',
                    text: 'Premium ' + t + ': perks frozen until review (order ' + (firstOrderId || 'unknown') + ').',
                    uid: uid ? String(uid).slice(0, 4) + '\u2026' : null,
                    read: false,
                    createdAt: new Date(r.nowMs),
                });
                return 'review';
            });
            return { status: 200, outcome: outcome };
        }

        await once(key, null, async function () { return 'ignored'; });
        return { status: 200, outcome: 'ignored' };
    }

    async function stripeWebhook(req, res) {
        if (req.method !== 'POST') { res.status(405).send('method'); return; }
        try { mode(); } catch (e) { res.status(503).send('unavailable'); return; }
        const v = verifyStripeSignature(req.rawBody, req.get ? req.get('stripe-signature') : req.headers['stripe-signature'], env.STRIPE_WEBHOOK_SECRET, Math.floor(now() / 1000));
        if (!v.ok) { res.status(400).send('signature'); return; }
        let event;
        try { event = JSON.parse(Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : req.rawBody); }
        catch (e) { res.status(400).send('json'); return; }
        try {
            const out = await handleStripeEvent(event);
            res.status(out.status).json({ received: true, outcome: out.outcome });
        } catch (e) {
            log('stripe webhook error', { type: event && event.type, err: String(e && e.message || e) });
            res.status(500).send('retry');
        }
    }

    // ---- BTCPay webhook
    async function handleBtcpayEvent(body) {
        if (!body || typeof body.type !== 'string' || typeof body.invoiceId !== 'string' || !/^[A-Za-z0-9]{8,64}$/.test(body.invoiceId)) {
            return { status: 400, outcome: 'bad_event' };
        }
        const c = btcpayCfg();
        if (body.storeId !== c.store) return { status: 400, outcome: 'wrong_store' };
        const key = 'btcpay_' + body.invoiceId + '_' + body.type;
        const t = body.type;

        if (t === 'InvoiceSettled') {
            const inv = await btcpayRequest('GET', '/invoices/' + encodeURIComponent(body.invoiceId));
            const orderId = String((inv && inv.metadata && inv.metadata.orderId) || '');
            // Lightning only: re-read how it was paid. Any payment on a
            // non-Lightning method (on-chain) goes to review, no grant.
            const pms = await btcpayRequest('GET', '/invoices/' + encodeURIComponent(body.invoiceId) + '/payment-methods');
            const offRail = nonLightningPayments(pms);
            const outcome = await once(key, orderId || null, async function (tx, r) {
                const o = r.order;
                if (!o || o.provider !== 'btcpay' || o.providerInvoiceId !== inv.id || inv.id !== body.invoiceId || !r.entRef) {
                    review(tx, 'btcpay_unknown_order', { orderId: orderId || null, invoiceId: body.invoiceId }, r.nowMs);
                    return 'review';
                }
                if (o.status === 'paid') return 'already_paid';
                if (inv.status !== 'Settled') return 'not_settled';
                if (offRail.length) {
                    review(tx, 'btcpay_not_lightning', { orderId: orderId, uid: o.uid, invoiceId: inv.id, methods: offRail }, r.nowMs);
                    tx.update(r.orderRef, { status: 'review', reviewReason: 'not_lightning' });
                    return 'review';
                }
                if (String(inv.currency).toUpperCase() !== 'USD' || usdToCents(inv.amount) !== o.amountCents) {
                    review(tx, 'btcpay_amount_mismatch', { orderId: orderId, uid: o.uid, invoiceId: inv.id, got: String(inv.amount), want: o.amountCents }, r.nowMs);
                    tx.update(r.orderRef, { status: 'review', reviewReason: 'amount_mismatch' });
                    return 'review';
                }
                if (o.lifetime) return grantFounders(tx, r, orderId, inv.id);
                return grantPrepaid(tx, r, orderId, inv.id);
            });
            return { status: 200, outcome: outcome };
        }

        if (t === 'InvoiceExpired' || t === 'InvoiceInvalid') {
            const orderId = String((body.metadata && body.metadata.orderId) || '');
            if (orderId) {
                const o = await ref(COL.orders, orderId).get();
                if (o.exists && o.data().providerInvoiceId === body.invoiceId) await releaseOrder(orderId, t === 'InvoiceExpired' ? 'expired' : 'invalid', now());
            }
            await once(key, null, async function () { return 'released'; });
            return { status: 200, outcome: 'released' };
        }

        await once(key, null, async function () { return 'ignored'; });
        return { status: 200, outcome: 'ignored' };
    }

    async function btcpayWebhook(req, res) {
        if (req.method !== 'POST') { res.status(405).send('method'); return; }
        try { mode(); btcpayCfg(); } catch (e) { res.status(503).send('unavailable'); return; }
        const sig = req.get ? req.get('btcpay-sig') : req.headers['btcpay-sig'];
        const v = verifyBtcpaySignature(req.rawBody, sig, env.BTCPAY_WEBHOOK_SECRET);
        if (!v.ok) { res.status(400).send('signature'); return; }
        let body;
        try { body = JSON.parse(Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : req.rawBody); }
        catch (e) { res.status(400).send('json'); return; }
        try {
            const out = await handleBtcpayEvent(body);
            res.status(out.status).json({ received: true, outcome: out.outcome });
        } catch (e) {
            log('btcpay webhook error', { type: body && body.type, err: String(e && e.message || e) });
            res.status(500).send('retry');
        }
    }

    // ---- Billing portal
    async function createPremiumPortal(data, context) {
        const auth = requireUser(context);
        mode();
        const entSnap = await ref(COL.entitlements, auth.uid).get();
        const ent = entSnap.exists ? entSnap.data() : {};
        if (!ent.stripeCustomerId) throw fail('failed-precondition', 'No card billing on this account.', 'no_customer');
        // Always our own portal configuration (no promotion codes, no plan
        // switching); never Stripe's default. Missing id = portal stays closed.
        const cfg = await loadConfig();
        if (!cfg.stripePortalConfigId) throw fail('failed-precondition', 'Billing management opens soon.', 'portal_not_configured');
        let s;
        try {
            s = await stripeRequest('POST', '/v1/billing_portal/sessions', { customer: ent.stripeCustomerId, configuration: cfg.stripePortalConfigId, return_url: siteUrl() + '/?premium=portal' });
        } catch (e) {
            if (e instanceof HttpsError) throw e;
            throw fail('unavailable', 'Billing could not open. Try again in a minute.', 'provider_error');
        }
        if (!s || typeof s.url !== 'string') throw fail('unavailable', 'Billing could not open.', 'provider_error');
        return { url: s.url };
    }

    // ---- Claim a Premium bought on the public page (exact verified email).
    async function claimPremiumByEmail(data, context) {
        const auth = requireUser(context);
        const email = auth.token && auth.token.email_verified === true ? normalizeEmail(auth.token.email) : null;
        if (!email) throw fail('failed-precondition', 'Verify your email first.', 'email_not_verified');
        const nowMs = now();
        const ek = ekey(email);
        const eRef = ref(COL.emailEntitlements, ek);
        const aRef = ref(COL.entitlements, auth.uid);
        const uRef = ref('users', auth.uid);
        const out = await db.runTransaction(async function (tx) {
            const e = await tx.get(eRef);
            const a = await tx.get(aRef);
            const u = await tx.get(uRef);
            const blocked = blockedUser(u.exists ? u.data() : null);
            if (blocked) throw fail('permission-denied', 'This account cannot use Premium.', blocked);
            if (!e.exists) return { claimed: false, reason: 'nothing_to_claim' };
            const held = e.data();
            if (held.claimedByUid && held.claimedByUid !== auth.uid) throw fail('failed-precondition', 'Already claimed by another account.', 'claimed_elsewhere');
            if (held.claimedByUid === auth.uid) return { claimed: true, already: true };
            const r = { tx: tx, nowMs: nowMs, uid: auth.uid, entRef: aRef, userExists: u.exists, ent: mergeEntitlements(a.exists ? a.data() : {}, held, nowMs) };
            if (held.frozen === true) { r.ent.frozen = true; r.ent.frozenAtMs = held.frozenAtMs || nowMs; r.ent.frozenReason = held.frozenReason || null; }
            writeEntitlement(tx, r);
            tx.update(eRef, { claimedByUid: auth.uid, claimedAtMs: nowMs });
            const s = summarize(r.ent, nowMs);
            return { claimed: true, active: s.active, plan: s.plan, expiresAtMs: s.expiresAtMs };
        });
        // Claimed: the plain email on its public orders is no longer needed.
        if (out.claimed) {
            const q = await db.collection(COL.orders).where('emailKey', '==', ek).limit(50).get();
            for (const d of q.docs) {
                if (d.data().email != null) await d.ref.update({ email: null, emailHeldSinceMs: null, emailClearedAtMs: nowMs, emailClearedReason: 'claimed' });
            }
        }
        return out;
    }

    // ---- Status + server prices for this player (in-app; may include the 5%)
    async function getPremiumStatus(data, context) {
        const auth = requireUser(context);
        const nowMs = now();
        const [entSnap, counterSnap, userSnap, cfg, walletSnap] = await Promise.all([
            ref(COL.entitlements, auth.uid).get(),
            ref(COL.counters, 'founders').get(),
            ref('users', auth.uid).get(),
            loadConfig(),
            ref(COL.allowance, auth.uid).get(),
        ]);
        const s = summarize(entSnap.exists ? entSnap.data() : {}, nowMs);
        const elig = await eligibilityFor(auth, cfg, nowMs, userSnap.exists ? userSnap.data() : null);
        const offers = [];
        const combos = [['monthly', 'card'], ['yearly', 'card'], ['founders', 'card']];
        if (cfg.lightningEnabled) combos.push(['yearly', 'lightning'], ['founders', 'lightning'], ['months', 'lightning']);
        combos.forEach(function (p) {
            const q = pricing.quote({ plan: p[0], rail: p[1], months: p[0] === 'months' ? 1 : undefined, nowMs: nowMs, existingUserEligible: elig.ok }, cfg);
            offers.push({ plan: q.plan, rail: q.rail, amountCents: q.amountCents, baseCents: q.baseCents, discounts: q.discounts });
        });
        return {
            active: s.active,
            plan: s.plan,
            founders: s.founders,
            expiresAtMs: s.expiresAtMs,
            autoRenew: s.autoRenew,
            startsAtMs: s.startsAtMs,
            pendingStart: s.pendingStart,
            inTrial: s.inTrial,
            billingStartsAtMs: cfg.billingStartsAtMs && cfg.billingStartsAtMs > nowMs ? cfg.billingStartsAtMs : null,
            checkoutOpen: cfg.checkoutEnabled,
            lightningOpen: cfg.lightningEnabled,
            existingUserOffer: elig.ok ? { pct: cfg.existingUserDiscountPct, endsAtMs: cfg.existingUserDiscountEndsAtMs } : null,
            foundersLeft: foundersLeft(counterSnap.exists ? counterSnap.data() : null, nowMs),
            offers: offers,
            embers: walletEmbers(walletSnap.exists ? walletSnap.data() : null),
            embersCap: EMBERS_CAP,
            embersPerMonth: embersGrantAllowed(entSnap.exists ? entSnap.data() : null, nowMs) ? EMBERS_PER_MONTH : 0,
            embersName: 'Embers',
        };
    }

    // ---- Monthly Embers (100/mo for paid Premium, rollover cap 300).
    // Cosmetic-only: never sats, never OrangeTix, never raffles, packs,
    // chance items or battle items. No conversion path and no buying more.
    // Trial and referral weeks get none. After cancel, leftovers are kept
    // but no new grants. Founders gets 100/mo; Family, 100 for the buyer only.
    async function claimPremiumAllowance(data, context) {
        const auth = requireUser(context);
        const uid = auth.uid;
        const nowMs = now();
        const month = etMonthKey(nowMs);
        const entRef = ref(COL.entitlements, uid);
        const walletRef = ref(COL.allowance, uid);
        const ledgerRef = ref(COL.allowanceLedger, uid + '_' + month);
        return db.runTransaction(async function (tx) {
            const e = await tx.get(entRef);
            const w = await tx.get(walletRef);
            const l = await tx.get(ledgerRef);
            const ent = e.exists ? e.data() : null;
            const bal = walletEmbers(w.exists ? w.data() : null);
            if (!isPremiumActive(ent, nowMs)) throw fail('permission-denied', 'Premium is not active.', 'not_premium');
            const out = { granted: 0, embers: bal, cosmeticCredits: bal, month: month, cap: EMBERS_CAP, name: 'Embers' };
            if (!embersGrantAllowed(ent, nowMs)) {
                const s = summarize(ent, nowMs);
                if (s.inTrial) out.reason = 'trial';
                else if (inReferralWeek(ent, nowMs)) out.reason = 'referral_week';
                else out.reason = 'canceled';
                return out;
            }
            if (l.exists || (w.exists && w.data().lastMonth === month)) {
                out.reason = 'already_granted';
                return out;
            }
            const granted = Math.max(0, Math.min(EMBERS_PER_MONTH, EMBERS_CAP - bal));
            const next = bal + granted;
            if (granted === 0) {
                out.reason = 'at_cap';
                out.embers = bal;
                out.cosmeticCredits = bal;
                return out;
            }
            tx.set(walletRef, { embers: next, cosmeticCredits: next, lastMonth: month, periodGranted: granted, periodSpent: 0, updatedAtMs: nowMs });
            tx.create(ledgerRef, { uid: uid, month: month, amount: granted, kind: 'premium_embers', name: 'Embers', atMs: nowMs });
            out.granted = granted;
            out.embers = next;
            out.cosmeticCredits = next;
            return out;
        });
    }

    // ---- Expiry sweep: flips active=false once paid time runs out.
    // Also turns on entitlements whose start time (billingStartsAt) has come.
    async function sweepExpired(limit) {
        const nowMs = now();
        const expired = await db.collection(COL.entitlements).where('expiresAtMs', '<=', nowMs).limit(limit || 300).get();
        const starting = await db.collection(COL.entitlements).where('startsAtMs', '<=', nowMs).limit(limit || 300).get();
        const docs = expired.docs.filter(function (d) { return d.data().active === true; })
            .concat(starting.docs.filter(function (d) { return d.data().pendingStart === true; }));
        const snap = { docs: docs };
        let flipped = 0;
        for (const d of snap.docs) {
            await db.runTransaction(async function (tx) {
                const e = await tx.get(d.ref);
                const u = await tx.get(ref('users', d.id));
                if (!e.exists) return;
                const ent = Object.assign({}, e.data());
                const st = summarize(ent, nowMs);
                if (st.active === (ent.active === true) && st.pendingStart === (ent.pendingStart === true)) return;
                writeEntitlement(tx, { nowMs: nowMs, uid: d.id, entRef: d.ref, ent: ent, userExists: u.exists });
                flipped++;
            });
        }
        const emailsCleared = await clearExpiredOrderEmails(nowMs, limit);
        const holds = await checkHoldsAlert(nowMs);
        return { checked: snap.docs.length, flipped: flipped, emailsCleared: emailsCleared, holdsAlert: holds };
    }

    // Unclaimed public orders: clear the plain email after
    // publicOrderEmailRetentionMonths (default 24) from purchase.
    async function clearExpiredOrderEmails(nowMs, limit) {
        const cfg = await loadConfig();
        const cutoff = pricing.addMonths(nowMs, -cfg.publicOrderEmailRetentionMonths);
        const q = await db.collection(COL.orders).where('emailHeldSinceMs', '<=', cutoff).limit(limit || 300).get();
        let n = 0;
        for (const d of q.docs) {
            await d.ref.update({ email: null, emailHeldSinceMs: null, emailClearedAtMs: nowMs, emailClearedReason: 'retention' });
            n++;
        }
        return n;
    }

    // Founders' holds at or above the threshold for over an hour: one review
    // row plus an admin_notifications alert per high streak.
    async function checkHoldsAlert(nowMs) {
        const cfg = await loadConfig();
        const counterRef = ref(COL.counters, 'founders');
        return db.runTransaction(async function (tx) {
            const c = await tx.get(counterRef);
            if (!c.exists) return 'none';
            const d = c.data();
            const live = Object.keys(liveHolds(d.holds, nowMs)).length;
            if (live < cfg.foundersHoldsAlertThreshold) {
                if (d.holdsHighSinceMs) tx.update(counterRef, { holdsHighSinceMs: null, holdsAlertedAtMs: null });
                return 'ok';
            }
            if (!d.holdsHighSinceMs) { tx.update(counterRef, { holdsHighSinceMs: nowMs }); return 'high'; }
            if (nowMs - d.holdsHighSinceMs < HOLDS_ALERT_AFTER_MS || d.holdsAlertedAtMs) return 'high';
            review(tx, 'founders_holds_high', { liveHolds: live, sinceMs: d.holdsHighSinceMs, threshold: cfg.foundersHoldsAlertThreshold }, nowMs);
            tx.set(ref('admin_notifications', newId()), { type: 'premium_holds_high', text: "Founders' holds have been at " + live + ' or more for over an hour.', read: false, createdAt: new Date(nowMs) });
            tx.update(counterRef, { holdsAlertedAtMs: nowMs });
            return 'alerted';
        });
    }

    // ---- Admin: revoke or restore Premium (refunds, disputes, abuse).
    // Admin claim + fresh 2FA step-up (same as adminSetKillSwitch), audit row
    // in premium_admin_audit (permanent). Not deployed.
    async function adminRevokePremium(data, context) {
        const auth = context && context.auth;
        if (!auth || !auth.token || auth.token.admin !== true) throw fail('permission-denied', 'Admins only.', 'not_admin');
        const d = data && typeof data === 'object' ? data : {};
        const action = d.action;
        if (action !== 'revoke' && action !== 'restore') throw fail('invalid-argument', 'action must be revoke or restore', 'bad_action');
        const target = typeof d.uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(d.uid) ? d.uid : null;
        if (!target) throw fail('invalid-argument', 'uid required', 'bad_uid');
        const reason = String(d.reason || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, 300);
        if (!reason) throw fail('invalid-argument', 'reason required', 'no_reason');
        const stepUp = deps.stepUp || function (dd, ctx) {
            const sf = require('./secondFactor');
            return sf.requireAdminStepUp(sf.stamp(dd, ctx), 'adminRevokePremium');
        };
        await stepUp(data, context);
        const nowMs = now();
        const entRef = ref(COL.entitlements, target);
        return db.runTransaction(async function (tx) {
            const e = await tx.get(entRef);
            const u = await tx.get(ref('users', target));
            if (!e.exists) throw fail('not-found', 'No Premium record for that account.', 'no_entitlement');
            const ent = Object.assign({}, e.data());
            const before = summarize(ent, nowMs);
            if (action === 'revoke') { ent.revoked = true; ent.revokedAtMs = nowMs; }
            else { ent.revoked = false; ent.frozen = false; ent.restoredAtMs = nowMs; }
            writeEntitlement(tx, { nowMs: nowMs, uid: target, entRef: entRef, ent: ent, userExists: u.exists });
            const after = summarize(ent, nowMs);
            tx.set(ref(COL.adminAudit, newId()), {
                action: action, targetUid: target, adminUid: auth.uid, reason: reason,
                activeBefore: before.active, activeAfter: after.active, atMs: nowMs,
            });
            return { ok: true, action: action, active: after.active };
        });
    }

    return {
        createPremiumCheckout: createPremiumCheckout,
        premiumPublicCheckout: premiumPublicCheckout,
        publicCheckout: publicCheckout,
        createPremiumPortal: createPremiumPortal,
        claimPremiumByEmail: claimPremiumByEmail,
        getPremiumStatus: getPremiumStatus,
        claimPremiumAllowance: claimPremiumAllowance,
        stripeWebhook: stripeWebhook,
        btcpayWebhook: btcpayWebhook,
        handleStripeEvent: handleStripeEvent,
        handleBtcpayEvent: handleBtcpayEvent,
        releaseOrder: releaseOrder,
        sweepExpired: sweepExpired,
        adminRevokePremium: adminRevokePremium,
    };
}

// ---- Account deletion (called from deleteAccount.purgeAccount).
// Financial records stay (orders, events, allowance ledger, review rows,
// admin audit) but the uid is replaced by a stable masked id and every email
// field is cleared. Entitlement, allowance, rate and email-held docs go.
// Writes go straight to Firestore (not the deletion batcher, which refuses
// to write retained collections).
async function purgePremiumForAccount(db, uid, nowMs) {
    const masked = maskDeletedUid(uid);
    const t = nowMs || Date.now();
    const out = { masked: masked, orders: 0, ledger: 0, review: 0, deleted: 0, activeSubscription: false };
    const entRef = db.collection(COL.entitlements).doc(uid);
    const entSnap = await entRef.get();
    const ent = entSnap.exists ? entSnap.data() : null;
    // Email-held purchases this account claimed: their email keys.
    const claimed = await db.collection(COL.emailEntitlements).where('claimedByUid', '==', uid).get();
    const keys = claimed.docs.map(function (d) { return d.id; });
    const orderDocs = (await db.collection(COL.orders).where('uid', '==', uid).get()).docs;
    for (const k of keys) {
        (await db.collection(COL.orders).where('emailKey', '==', k).get()).docs.forEach(function (d) { orderDocs.push(d); });
    }
    const seen = new Set();
    for (const d of orderDocs) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        const o = d.data();
        await d.ref.update({ uid: o.uid ? masked : null, uidMasked: true, email: null, emailKey: null, trialEmailKey: null, emailHeldSinceMs: null, emailClearedAtMs: t, emailClearedReason: 'account_deleted' });
        out.orders++;
    }
    const ledger = await db.collection(COL.allowanceLedger).where('uid', '==', uid).get();
    for (const d of ledger.docs) {
        const row = Object.assign({}, d.data(), { uid: masked, uidMasked: true });
        await db.collection(COL.allowanceLedger).doc(masked + '_' + (row.month || d.id)).set(row);
        await d.ref.delete();
        out.ledger++;
    }
    const reviews = await db.collection(COL.review).where('uid', '==', uid).get();
    for (const d of reviews.docs) { await d.ref.update({ uid: masked, uidMasked: true }); out.review++; }
    const audits = await db.collection(COL.adminAudit).where('targetUid', '==', uid).get();
    for (const d of audits.docs) { await d.ref.update({ targetUid: masked, uidMasked: true }); }
    // A renewing card subscription must be cancelled in Stripe by a human.
    if (ent && ent.autoRenew === true && ent.stripeSubscriptionId) {
        out.activeSubscription = true;
        await db.collection(COL.review).doc('del_' + masked).set({
            reason: 'deleted_account_active_subscription', uid: masked, uidMasked: true,
            subscriptionId: ent.stripeSubscriptionId, customerId: ent.stripeCustomerId || null,
            createdAtMs: t, resolved: false,
        });
    }
    // Founders' holds keyed by this uid.
    const cRef = db.collection(COL.counters).doc('founders');
    const c = await cRef.get();
    if (c.exists) {
        const holds = Object.assign({}, c.data().holds || {});
        let changed = false;
        Object.keys(holds).forEach(function (id) { if (holds[id] && holds[id].uid === uid) { holds[id] = Object.assign({}, holds[id], { uid: masked }); changed = true; } });
        if (changed) await cRef.update({ holds: holds });
    }
    const drop = [entRef, db.collection(COL.allowance).doc(uid), db.collection(COL.rate).doc(uid)].concat(claimed.docs.map(function (d) { return d.ref; }));
    for (const r of drop) {
        const s = await r.get();
        if (s.exists) { await r.delete(); out.deleted++; }
    }
    return out;
}

// ---------------------------------------------------------------- bind

// Projects without a BTCPay store yet. Remove staging once its store exists.
const BTCPAY_OFF_PROJECTS = Object.freeze([STAGING_PROJECT]);
function envProject(env) {
    if (env.GCLOUD_PROJECT) return env.GCLOUD_PROJECT;
    try { return (JSON.parse(env.FIREBASE_CONFIG || '{}').projectId) || ''; } catch (e) { return ''; }
}
function btcpayOff(env) {
    return env.PREMIUM_BTCPAY === 'off' || BTCPAY_OFF_PROJECTS.indexOf(envProject(env)) !== -1;
}

function bindPremium(functionsV1, deps) {
    const { defineSecret } = require('firebase-functions/params');
    const { runtimeSa } = require('./runtimeServiceAccounts');
    const s = {};
    // No BTCPay store on staging yet (Phil, Nov 14): there the BTCPay secrets
    // stay unbound and premiumBtcpayWebhook is not exported, so card checkout
    // can deploy without them. Lightning fails closed (btcpay_config).
    // Decided from the project id, which the Firebase CLI sets during
    // discovery (.env files are not loaded then). PREMIUM_BTCPAY=off forces it.
    const btcOn = !btcpayOff(process.env);
    // defineSecret registers a deploy-time param even when unbound, and the
    // CLI then asks for its value, so BTCPay secrets are not defined at all
    // where BTCPay is off.
    SECRET_NAMES.forEach(function (n) {
        if (!btcOn && /^BTCPAY_/.test(n)) return;
        s[n] = defineSecret(n);
    });
    const btc = btcOn ? [s.BTCPAY_API_KEY, s.BTCPAY_URL, s.BTCPAY_STORE_ID] : [];
    const handlers = createPremiumHandlers(Object.assign({ HttpsError: functionsV1.https.HttpsError }, deps || {}));

    const createPremiumCheckout = functionsV1.runWith({
        enforceAppCheck: true,
        timeoutSeconds: 60,
        secrets: [s.PREMIUM_HASH_KEY, s.STRIPE_SECRET_KEY].concat(btc),
        serviceAccount: runtimeSa('createPremiumCheckout'),
    }).https.onCall(handlers.createPremiumCheckout);
    const premiumPublicCheckout = functionsV1.runWith({
        timeoutSeconds: 60,
        secrets: [s.PREMIUM_HASH_KEY, s.STRIPE_SECRET_KEY].concat(btc, [deps.turnstileSecret]).filter(Boolean),
        serviceAccount: runtimeSa('premiumPublicCheckout'),
    }).https.onRequest(handlers.premiumPublicCheckout);
    const createPremiumPortal = functionsV1.runWith({
        enforceAppCheck: true,
        timeoutSeconds: 30,
        secrets: [s.STRIPE_SECRET_KEY],
        serviceAccount: runtimeSa('createPremiumPortal'),
    }).https.onCall(handlers.createPremiumPortal);
    const claimPremiumByEmail = functionsV1.runWith({
        enforceAppCheck: true,
        timeoutSeconds: 30,
        secrets: [s.PREMIUM_HASH_KEY],
        serviceAccount: runtimeSa('claimPremiumByEmail'),
    }).https.onCall(handlers.claimPremiumByEmail);
    const getPremiumStatus = functionsV1.runWith({ enforceAppCheck: true, timeoutSeconds: 30 }).https.onCall(handlers.getPremiumStatus);
    const claimPremiumAllowance = functionsV1.runWith({ enforceAppCheck: true, timeoutSeconds: 30 }).https.onCall(handlers.claimPremiumAllowance);
    const premiumStripeWebhook = functionsV1.runWith({
        timeoutSeconds: 60,
        // STRIPE_SECRET_KEY: re-reads the session for the card fingerprint.
        secrets: [s.STRIPE_WEBHOOK_SECRET, s.STRIPE_SECRET_KEY, s.PREMIUM_HASH_KEY],
        serviceAccount: runtimeSa('premiumStripeWebhook'),
    }).https.onRequest(handlers.stripeWebhook);
    const premiumBtcpayWebhook = !btcOn ? null : functionsV1.runWith({
        timeoutSeconds: 60,
        secrets: [s.BTCPAY_API_KEY, s.BTCPAY_WEBHOOK_SECRET, s.BTCPAY_URL, s.BTCPAY_STORE_ID],
        serviceAccount: runtimeSa('premiumBtcpayWebhook'),
    }).https.onRequest(handlers.btcpayWebhook);
    // Admin-only (admin claim + fresh 2FA step-up). Not deployed until Phil OKs.
    const adminRevokePremium = functionsV1.runWith({ enforceAppCheck: true, timeoutSeconds: 30 }).https.onCall(handlers.adminRevokePremium);
    const premiumExpirySweep = functionsV1.pubsub.schedule('every 60 minutes').timeZone('UTC').onRun(async function () {
        await handlers.sweepExpired(300);
    });
    return {
        createPremiumCheckout: createPremiumCheckout,
        premiumPublicCheckout: premiumPublicCheckout,
        createPremiumPortal: createPremiumPortal,
        claimPremiumByEmail: claimPremiumByEmail,
        getPremiumStatus: getPremiumStatus,
        claimPremiumAllowance: claimPremiumAllowance,
        premiumStripeWebhook: premiumStripeWebhook,
        premiumBtcpayWebhook: btcOn ? premiumBtcpayWebhook : undefined,
        premiumExpirySweep: premiumExpirySweep,
        adminRevokePremium: adminRevokePremium,
    };
}

module.exports = {
    LIVE_PROJECT,
    STAGING_PROJECT,
    SECRET_NAMES,
    COL,
    ALLOWANCE_PER_MONTH,
    EMBERS_PER_MONTH,
    EMBERS_CAP,
    embersGrantAllowed,
    inReferralWeek,
    walletEmbers,
    periodUnspentEmbers,
    providerMode,
    stripeKeyOk,
    verifyStripeSignature,
    verifyBtcpaySignature,
    usdToCents,
    stripeForm,
    checkoutNote,
    cleanSrc,
    normalizeEmail,
    emailKey,
    trialEmailKey,
    etMonthKey,
    existingUserEligible,
    summarize,
    isPremiumActive,
    mergeEntitlements,
    foundersLeft,
    canonicalEmail,
    keyedHash,
    clientIp,
    maskDeletedUid,
    nonLightningPayments,
    purgePremiumForAccount,
    btcpayOff,
    PERMANENT_COLLECTIONS,
    TURNSTILE_ACTION,
    createPremiumHandlers,
    bindPremium,
};
