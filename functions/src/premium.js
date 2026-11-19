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
//     (no app bundle). Full price, never the 5%. The buyer's
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
//   - Kill switch (Phil, Nov 18): both checkout entry points refuse while
//     config/killSwitch is effectively on (or unreadable). Webhooks keep
//     running so payments already made are still recorded.
//   - Charged at purchase (Phil, Nov 18). Embers and Citadel perks start at
//     perksStartAt (Jan 3, 2027 12:00 AM ET); every other perk starts now.
//   - No refunds (pricing.REFUND_POLICY). The buyer must acknowledge it
//     (acceptNoRefunds) before a checkout is created. Refunds Phil issues by
//     hand in Stripe still freeze perks; a Founders' seat never returns.
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
    [STAGING_PROJECT]: 'https://dev.bitcoineducation.quest',
});

// Browser origins allowed to call premiumPublicCheckout.
const PUBLIC_ORIGINS = Object.freeze({
    live: [/^https:\/\/(www\.)?bitcoineducation\.quest$/],
    test: [/^https:\/\/bitcoin-quest-staging\.web\.app$/, /^https:\/\/dev\.bitcoineducation\.quest$/, /^https:\/\/([a-z0-9-]+\.)?bq-staging\.pages\.dev$/, /^https:\/\/[a-z0-9-]+\.bitcoin-quest\.pages\.dev$/, /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/],
});

const TURNSTILE_ACTION = 'premium_checkout';
// Hostnames Turnstile may report for the premium page, per environment.
const TURNSTILE_HOSTS = Object.freeze({
    live: ['bitcoineducation.quest', 'www.bitcoineducation.quest'],
    test: ['bitcoin-quest-staging.web.app', 'dev.bitcoineducation.quest', /^([a-z0-9-]+\.)?bq-staging\.pages\.dev$/, /^[a-z0-9-]+\.bitcoin-quest\.pages\.dev$/, 'localhost', '127.0.0.1'],
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
const STRIPE_CHECKOUT_MINUTES = 31; // Stripe minimum is 30, plus a 1-minute margin.
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
// Embers and Citadel perks start at perksStartAtMs (Jan 3, 2027 12:00 AM ET by
// default; missing or bad value = that default, never earlier).
function deferredPerksOpen(nowMs, perksStartAtMs) {
    const start = Number(perksStartAtMs) > 0 ? Number(perksStartAtMs) : pricing.PERKS_START_MS;
    return Number(nowMs) >= start;
}
// Citadel perks are cosmetic only (Citadel spec, Nov 18): active paid Premium
// after perksStartAt. They never speed up collecting parts, timers or
// cooldowns, and Citadel parts code must never read this flag.
function citadelPerksAllowed(ent, nowMs, perksStartAtMs) {
    return isPremiumActive(ent, nowMs) && deferredPerksOpen(nowMs, perksStartAtMs);
}
function embersGrantAllowed(ent, nowMs, perksStartAtMs) {
    const s = summarize(ent, nowMs);
    if (!s.active) return false;
    if (!deferredPerksOpen(nowMs, perksStartAtMs)) return false;
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

// premium_rate doc id for a Founders' hold cooldown (holdKey is a uid or
// 'email:'+keyed hash, never a plain email).
function foundersCooldownId(holdKey) {
    return 'fcool_' + String(holdKey || '').replace(/[^A-Za-z0-9_:-]/g, '_').slice(0, 200);
}
// Network cooldown doc id: the keyed IP hash (HMAC with PREMIUM_HASH_KEY), never a plain IP.
function foundersIpCooldownId(ipHash) {
    return 'fcoolip_' + String(ipHash || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 128);
}

// Bitcoin checkout link must be https on the exact configured BTCPay host
// (Red Team F3). Unset host = refused.
function btcpayLinkOk(url, cfg) {
    const host = cfg && cfg.btcpayHost;
    if (!host || typeof url !== 'string') return false;
    try {
        const u = new URL(url);
        return u.protocol === 'https:' && u.hostname === host && !u.username && !u.password && (u.port === '' || u.port === '443');
    } catch (e) { return false; }
}

// Lapsed Founders' holds whose Stripe session still needs expiring live in
// their own server-only doc (premium_counters/founders_expire, Red Team N4) as
// entries { orderId: deadlineMs }, so queue upkeep never writes the seat
// counter. The deadline is when the session would have expired on its own (it
// was created before the hold started), so there is nothing to do after it.
const FOUNDERS_EXPIRE_DOC = 'founders_expire';
const EXPIRE_BATCH = 10;
const EXPIRE_QUEUE_MAX = 300;
const EXPIRE_DRAIN_EVERY_MS = 15000; // at most one drain per 15 s, all callers (N3)
// New queue entries for holds that just lapsed (merged into the queue doc).
function lapsedEntries(lapsedHolds, nowMs) {
    const out = {};
    (lapsedHolds || []).forEach(function (e) {
        const deadline = Number(e[1] && e[1].expMs) + STRIPE_CHECKOUT_MINUTES * 60000;
        if (deadline > nowMs) out[e[0]] = deadline;
    });
    return out;
}
// Drops entries past their deadline and keeps at most EXPIRE_QUEUE_MAX, the
// ones with the latest deadlines (still payable the longest).
function trimQueue(queue, nowMs) {
    const out = {};
    Object.keys(queue && typeof queue === 'object' ? queue : {}).forEach(function (id) {
        if (Number(queue[id]) > nowMs) out[id] = Number(queue[id]);
    });
    const ids = Object.keys(out);
    if (ids.length <= EXPIRE_QUEUE_MAX) return out;
    ids.sort(function (x, y) { return out[y] - out[x] || (x < y ? -1 : 1); });
    const kept = {};
    ids.slice(0, EXPIRE_QUEUE_MAX).forEach(function (id) { kept[id] = out[id]; });
    return kept;
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
// perksStartMs: when Embers and Citadel perks start, if still in the future.
// trialEndMs: only when a real trial was granted (trials are off by default).
function checkoutNote(q, perksStartMs, trialEndMs, holdMinutes) {
    const parts = [];
    if (q.cardMode === 'subscription' && trialEndMs) {
        parts.push('You will not be charged today. Your first charge is on ' + fmtEt(trialEndMs) + '.');
    } else {
        parts.push("You're charged today.");
    }
    if (q.lifetime) parts.push("Founders' Lifetime is a one-time payment and never renews.");
    if (q.lifetime && holdMinutes > 0) parts.push('Your Founders seat is held for ' + holdMinutes + ' minutes. Pay before then to keep it.');
    if (perksStartMs) parts.push('Embers and Citadel cosmetics start ' + fmtEt(perksStartMs) + ' at 12:00 AM ET. Your other Premium perks start right away.');
    parts.push(pricing.REFUND_POLICY.text);
    return parts.join(' ').slice(0, 1200);
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
    // Kill switch (config/killSwitch). Fails closed: unreadable = offline.
    const isOfflineFn = deps.isOffline || function () { return require('./killSwitch').isOffline(db, now); };
    async function refuseIfOffline() {
        let off = true;
        try { off = await isOfflineFn(); } catch (e) { off = true; }
        if (off !== false) throw fail('unavailable', 'Bitcoin Quest is temporarily offline for maintenance. Checkout is paused.', 'kill_switch');
    }
    // Phil, Nov 18: no refunds. The buyer must tick the final-sale box.
    function requireNoRefundAck(d) {
        if (!d || d.acceptNoRefunds !== true) throw fail('failed-precondition', 'Please confirm that all sales are final before checkout.', 'terms_required');
    }
    function allowedOrigin(origin) {
        const m = providerMode(projectId);
        return !!(m && typeof origin === 'string' && PUBLIC_ORIGINS[m].some(function (re) { return re.test(origin); }));
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
        if (method === 'POST' || (method === 'DELETE' && params)) {
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
        if (q.rail === 'lightning' && (!cfg.lightningEnabled || !cfg.btcpayHost)) throw fail('failed-precondition', 'Bitcoin checkout opens soon.', 'lightning_closed');
        const orderId = newId();
        const provider = q.rail === 'card' ? 'stripe' : 'btcpay';
        // Phil, Nov 18: every plan is charged at purchase and Premium starts
        // now. Only Embers and Citadel perks wait for perksStartAt (Jan 3,
        // 2027 12:00 AM ET); that is enforced where they are granted, never
        // by delaying the charge or the entitlement.
        const perksStartMs = cfg.perksStartAtMs > nowMs ? cfg.perksStartAtMs : null;
        // Free trial only when Phil has switched trials on (fail-closed flag),
        // for a card subscription, for a first-time subscriber.
        const trialDays = q.cardMode === 'subscription' && cfg.trialsEnabled === true && cfg.trialDays > 0 && who.trialEligible ? cfg.trialDays : 0;
        const trialEndMs = trialDays > 0 ? nowMs + trialDays * 86400000 : null;
        const expectedTotalCents = trialEndMs ? 0 : q.amountCents;
        // Founders' card holds use the shorter config hold (Red Team F2); a
        // bitcoin hold stays matched to the BTCPay invoice it covers.
        const holdMs = q.lifetime && q.rail === 'card'
            ? cfg.foundersCardHoldMinutes * 60000
            : (q.rail === 'card' ? STRIPE_CHECKOUT_MINUTES : BTCPAY_INVOICE_MINUTES) * 60000 + HOLD_GRACE_MS;
        const cooldownMs = (Number(cfg.foundersHoldCooldownMinutes) || 0) * 60000;
        const ipCooldownMs = (Number(cfg.foundersIpHoldCooldownMinutes) || 0) * 60000;
        let lapsedIds = [];
        let foundersStage = false;
        if (provider === 'stripe') stripeKey(); else btcpayCfg(); // before any seat is held
        let capHit = false;

        const orderRef = ref(COL.orders, orderId);
        const counterRef = ref(COL.counters, 'founders');
        const rateRef = ref(COL.rate, who.rateKey);
        const globalRef = channel === 'public' ? ref(COL.rate, GLOBAL_PUBLIC_RATE_ID) : null;
        const coolRef = q.lifetime && cooldownMs > 0 ? ref(COL.rate, foundersCooldownId(who.holdKey)) : null;
        const coolIpRef = q.lifetime && ipCooldownMs > 0 && who.ipHash ? ref(COL.rate, foundersIpCooldownId(who.ipHash)) : null;
        const limit = who.uid ? ORDERS_PER_HOUR : PUBLIC_ORDERS_PER_HOUR_PER_IP;
        function windowCount(d) {
            const ws = Number(d.windowStartMs) || 0;
            const inW = nowMs - ws < 3600000;
            return { inWindow: inW, windowStart: ws, count: inW ? (Number(d.count) || 0) : 0 };
        }
        try { await db.runTransaction(async function (tx) {
            const rateSnap = await tx.get(rateRef);
            const globalSnap = globalRef ? await tx.get(globalRef) : null;
            const counterSnap = q.lifetime ? await tx.get(counterRef) : null;
            const coolSnap = coolRef ? await tx.get(coolRef) : null;
            const coolIpSnap = coolIpRef ? await tx.get(coolIpRef) : null;
            lapsedIds = [];
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
            // From here a Founders' refusal still counts against the per-account
            // rate limit (written after the abort, Red Team N3).
            foundersStage = q.lifetime;
            if (q.lifetime) {
                const c = counterSnap.exists ? counterSnap.data() : { sold: 0, holds: {} };
                const holds = liveHolds(c.holds, nowMs);
                const mine = Object.keys(holds).filter(function (id) { return holds[id].uid === who.holdKey; });
                if (mine.length) throw fail('failed-precondition', "You already have a Founders' checkout open. Finish it or try again in a few minutes.", 'hold_exists');
                // Cooldown after an unpaid Founders' hold lapsed (Red Team F2).
                // Holds that lapsed unpaid are pruned here and each owner gets a
                // cooldown doc (TTL expireAt), so it holds even after pruning.
                const lapsed = Object.keys(c.holds || {}).filter(function (id) { return !holds[id] && c.holds[id]; });
                lapsedIds = lapsed.slice();
                const myLapsed = cooldownMs > 0 ? lapsed.filter(function (id) { return c.holds[id].uid === who.holdKey && Number(c.holds[id].expMs) + cooldownMs > nowMs; }) : [];
                const coolUntil = Math.max(coolSnap && coolSnap.exists ? Number(coolSnap.data().untilMs) || 0 : 0,
                    myLapsed.reduce(function (m, id) { return Math.max(m, Number(c.holds[id].expMs) + cooldownMs); }, 0));
                if (coolUntil > nowMs) {
                    throw fail('resource-exhausted', "Your last Founders' checkout timed out. Try again in " + Math.max(1, Math.ceil((coolUntil - nowMs) / 60000)) + ' minutes.', 'founders_cooldown');
                }
                // Same cooldown per network (keyed IP hash, Red Team F2-R).
                const ipLapsed = ipCooldownMs > 0 && who.ipHash ? lapsed.filter(function (id) { return c.holds[id].ipHash === who.ipHash && Number(c.holds[id].expMs) + ipCooldownMs > nowMs; }) : [];
                const ipCoolUntil = Math.max(coolIpSnap && coolIpSnap.exists ? Number(coolIpSnap.data().untilMs) || 0 : 0,
                    ipLapsed.reduce(function (m, id) { return Math.max(m, Number(c.holds[id].expMs) + ipCooldownMs); }, 0));
                if (ipCoolUntil > nowMs) {
                    throw fail('resource-exhausted', "A Founders' checkout from this network timed out. Try again in " + Math.max(1, Math.ceil((ipCoolUntil - nowMs) / 60000)) + ' minutes.', 'founders_cooldown_ip');
                }
                // One live Founders' hold per network (IPv6 /64 or exact IPv4; keyed hash only).
                const sameIp = who.ipHash ? Object.keys(holds).filter(function (id) { return holds[id].ipHash === who.ipHash; }) : [];
                if (sameIp.length) throw fail('failed-precondition', "A Founders' checkout is already open from this network. Finish it or wait about 35 minutes.", 'hold_exists_ip');
                if ((Number(c.sold) || 0) + Object.keys(holds).length >= pricing.FOUNDERS_CAP) {
                    throw fail('resource-exhausted', "Founders' Lifetime is sold out.", 'founders_sold_out');
                }
                if (Object.keys(holds).length >= cfg.maxLiveFoundersHolds) {
                    capHit = true;
                    throw fail('resource-exhausted', "Lots of people are checking out Founders' right now. Try again in a few minutes.", 'founders_busy');
                }
                lapsed.forEach(function (id) {
                    const h = c.holds[id];
                    const until = Number(h.expMs) + cooldownMs;
                    if (cooldownMs > 0 && h.uid && until > nowMs) {
                        tx.set(ref(COL.rate, foundersCooldownId(h.uid)), { untilMs: until, orderId: id, expireAt: new Date(until + 3600000) });
                    }
                    const ipUntil = Number(h.expMs) + ipCooldownMs;
                    if (ipCooldownMs > 0 && h.ipHash && ipUntil > nowMs) {
                        tx.set(ref(COL.rate, foundersIpCooldownId(h.ipHash)), { untilMs: ipUntil, orderId: id, expireAt: new Date(ipUntil + 3600000) });
                    }
                });
                holds[orderId] = { uid: who.holdKey, ipHash: who.ipHash || null, expMs: nowMs + holdMs };
                // Lapsed holds leave the seat count now (seat freed at once) and
                // move to a server-only queue whose Stripe sessions are expired
                // in small batches until each is done (Red Team N1).
                // Blind merge into the queue doc (no read, so the seat transaction
                // never conflicts with queue upkeep). A legacy queue left on the
                // counter by an earlier build moves over once.
                const newEntries = Object.assign(trimQueue(c.expireQueue, nowMs), lapsedEntries(lapsed.map(function (id) { return [id, c.holds[id]]; }), nowMs));
                if (Object.keys(newEntries).length) tx.set(ref(COL.counters, FOUNDERS_EXPIRE_DOC), { entries: newEntries, updatedAtMs: nowMs }, { merge: true });
                const nextCounter = Object.assign({}, c, { sold: Number(c.sold) || 0, holds: holds, cap: pricing.FOUNDERS_CAP, updatedAtMs: nowMs });
                delete nextCounter.expireQueue;
                tx.set(counterRef, nextCounter);
            }
            foundersStage = false;
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
                // Premium starts at purchase. Embers + Citadel wait for this.
                startsAtMs: null,
                deferredPerksStartAtMs: perksStartMs,
                trialEndMs: trialEndMs,
                trialDays: trialDays,
                expectedTotalCents: expectedTotalCents,
                // Buyer saw and accepted the final-sale terms before checkout.
                refundPolicy: pricing.REFUND_POLICY.id,
                noRefundAckAtMs: nowMs,
            });
        }); } catch (e) {
            if (capHit) await foundersCapAlert(nowMs, cfg);
            if (foundersStage) await countRefusedAttempt(rateRef, nowMs, limit);
            // Nothing was pruned: those lapsed holds stay on the counter and are
            // queued by the next successful hold; expire what we can now.
            if (q.lifetime) await drainExpireQueue(nowMs, lapsedIds);
            throw e;
        }
        // Lapsed Founders' card holds can no longer be paid (Red Team F2-R, N1).
        if (q.lifetime) await drainExpireQueue(nowMs, []);

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
                    // Charged today (no trial_end, no deferred billing). Only
                    // a real trial, when Phil has switched trials on, uses
                    // trial_period_days.
                    if (trialDays > 0) params.subscription_data.trial_period_days = trialDays;
                } else { params.payment_intent_data = { metadata: metadata }; params.customer_creation = 'always'; }
                const note = checkoutNote(q, perksStartMs, trialEndMs, q.lifetime ? Math.round(holdMs / 60000) : 0);
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
                    metadata: Object.assign({ itemDesc: q.label + ' (final sale, no refunds)' }, metadata),
                    checkout: {
                        expirationMinutes: BTCPAY_INVOICE_MINUTES,
                        redirectURL: back + '?premium=success&order=' + orderId,
                        redirectAutomatically: false,
                    },
                });
                if (!inv || typeof inv.id !== 'string' || typeof inv.checkoutLink !== 'string') throw new Error('btcpay_bad_response');
                if (!btcpayLinkOk(inv.checkoutLink, cfg)) throw new Error('btcpay_bad_link');
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
            provider: provider,
            chargedNow: !trialEndMs,
            // Founders' seat hold end, for the buy screen's countdown.
            holdExpMs: q.lifetime ? nowMs + holdMs : null,
            deferredPerksStartAtMs: perksStartMs,
            refundPolicy: pricing.REFUND_POLICY.id,
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
        await refuseIfOffline();
        requirePlanRail(d);
        requireNoRefundAck(d);

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
        // Send the buyer back to the allowlisted app host they came from
        // (live, staging or a staging preview); otherwise the default site.
        const rq = context && context.rawRequest;
        const origin = rq ? ((rq.get ? rq.get('origin') : (rq.headers && rq.headers.origin)) || '') : '';
        return startOrder(q, { uid: uid, email: email, emailKey: ek, trialEmailKey: tek, ipHash: ipHash, holdKey: uid, rateKey: uid, returnBase: allowedOrigin(origin) ? origin : null, customerId: ent.stripeCustomerId || null, trialEligible: !ent.trialUsed && !ent.stripeSubscriptionId && !ent.founders && !emailTrialUsed }, cfg, nowMs, cleanSrc(d.src), 'app');
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
        await refuseIfOffline();
        requirePlanRail(b);
        // Founders' seats are scarce: sold only to signed-in accounts (in the
        // app), never to an email on the public page (Red Team, Nov 14).
        // In-app Founders also requires a verified email when
        // foundersRequireVerifiedEmail is on (the default).
        if (b.plan === 'founders') throw fail('failed-precondition', "Sign in to Bitcoin Quest to buy Founders' Lifetime.", 'founders_sign_in');
        requireNoRefundAck(b);
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

    // Live Founders' holds hit maxLiveFoundersHolds: one admin alert and one
    // review row per 30-minute window (deterministic ids, create-once). A
    // failure here never changes the checkout answer.
    const CAP_ALERT_WINDOW_MS = 30 * 60 * 1000;
    async function foundersCapAlert(nowMs, cfg) {
        const bucket = Math.floor(nowMs / CAP_ALERT_WINDOW_MS);
        try {
            const nRef = ref('admin_notifications', 'premium_founders_cap_' + bucket);
            const rRef = ref(COL.review, 'founders_hold_cap_' + bucket);
            const text = "Founders' checkout is full: " + cfg.maxLiveFoundersHolds + ' seats are held in open checkouts, so new Founders buyers are being turned away. Check for hold farming.';
            await db.runTransaction(async function (tx) {
                const ex = await tx.get(nRef);
                if (ex.exists) return;
                tx.set(nRef, { type: 'premium_founders_cap', text: text, read: false, createdAt: new Date(nowMs) });
                tx.set(rRef, { reason: 'founders_hold_cap_hit', createdAtMs: nowMs, resolved: false, liveHolds: cfg.maxLiveFoundersHolds });
            });
        } catch (e) {
            log('premium founders cap alert failed', { err: String(e && e.message || e) });
        }
    }

    // Expires the Stripe Checkout Session of each lapsed, unpaid Founders' card
    // hold so it can no longer be paid (Red Team F2-R). Best effort: a failed
    // expire is logged and never throws; a payment that still slips through
    // goes to the founders_sold_out_late_payment review path.
    // One order: 'expired', 'skip' (nothing to expire: not a pending Stripe
    // Founders' order, already expired, or no session) or 'failed' (retry later).
    async function expireOne(id, nowMs) {
        try {
            const snap = await ref(COL.orders, id).get();
            if (!snap.exists) return 'skip';
            const o = snap.data();
            if (!o.lifetime || o.provider !== 'stripe' || o.status !== 'pending' || o.sessionExpiredAtMs) return 'skip';
            if (!(Number(o.holdExpMs) <= nowMs)) return 'skip';
            // Stripe has already expired the session on its own by now.
            if (Number(o.createdAtMs) > 0 && nowMs > Number(o.createdAtMs) + (STRIPE_CHECKOUT_MINUTES + 1) * 60000) return 'skip';
            if (typeof o.providerSessionId !== 'string' || !/^cs_[A-Za-z0-9_]{6,200}$/.test(o.providerSessionId)) return 'skip';
            await stripeRequest('POST', '/v1/checkout/sessions/' + encodeURIComponent(o.providerSessionId) + '/expire', {}, 'bq-expire-' + id);
            await ref(COL.orders, id).update({ sessionExpiredAtMs: nowMs });
            return 'expired';
        } catch (e) {
            log('premium founders session expire failed', { orderId: id, err: String(e && e.message || e) });
            return 'failed';
        }
    }
    async function expireLapsedSessions(orderIds, nowMs) {
        let n = 0;
        for (const id of (orderIds || []).slice(0, EXPIRE_BATCH)) {
            if (await expireOne(id, nowMs) === 'expired') n++;
        }
        return n;
    }
    // A refused Founders' checkout still uses one checkout attempt from the
    // per-account hourly window (Red Team N3). Never changes the refusal.
    async function countRefusedAttempt(rateRef, nowMs, limit) {
        try {
            await db.runTransaction(async function (tx) {
                const snap = await tx.get(rateRef);
                const d = snap.exists ? snap.data() : {};
                const ws0 = Number(d.windowStartMs) || 0;
                const inW = nowMs - ws0 < 3600000;
                const count = inW ? (Number(d.count) || 0) : 0;
                if (count >= limit) return;
                const ws = inW ? ws0 : nowMs;
                tx.set(rateRef, { windowStartMs: ws, count: count + 1, expireAt: new Date(ws + 2 * 3600000) });
            });
        } catch (e) {
            log('premium refused attempt count failed', { err: String(e && e.message || e) });
        }
    }
    // Works through the server-only expire queue (its own doc), at most once
    // every EXPIRE_DRAIN_EVERY_MS across all callers (claimed with lastDrainMs
    // in a transaction), and at most EXPIRE_BATCH Stripe calls per drain
    // (soonest deadline first). Then removes only the entries that are done;
    // failed ones stay for a later drain until their Stripe session would have
    // expired on its own anyway. Never writes the seat counter. Never throws.
    async function drainExpireQueue(nowMs, extraIds) {
        try {
            const queueRef = ref(COL.counters, FOUNDERS_EXPIRE_DOC);
            let queue = null;
            await db.runTransaction(async function (tx) {
                queue = null;
                const snap = await tx.get(queueRef);
                const d = snap.exists ? snap.data() : {};
                const last = Number(d.lastDrainMs) || 0;
                if (last <= nowMs && nowMs - last < EXPIRE_DRAIN_EVERY_MS) return;
                queue = d.entries && typeof d.entries === 'object' ? d.entries : {};
                tx.set(queueRef, { lastDrainMs: nowMs }, { merge: true });
            });
            if (!queue) return 0;
            const ids = Object.keys(queue).filter(function (id) { return Number(queue[id]) > nowMs; })
                .sort(function (x, y) { return Number(queue[x]) - Number(queue[y]) || (x < y ? -1 : 1); });
            (extraIds || []).forEach(function (id) { if (ids.indexOf(id) === -1) ids.push(id); });
            const done = [];
            let n = 0;
            let calls = 0;
            // At most EXPIRE_BATCH Stripe calls and 3x that many order reads.
            for (const id of ids.slice(0, EXPIRE_BATCH * 3)) {
                if (calls >= EXPIRE_BATCH) break;
                const r = await expireOne(id, nowMs);
                if (r !== 'skip') calls++;
                if (r === 'expired') n++;
                if (r !== 'failed') done.push(id);
            }
            await db.runTransaction(async function (tx) {
                const qs = await tx.get(queueRef);
                if (!qs.exists) return;
                const cur = qs.data().entries || {};
                const q2 = Object.assign({}, cur);
                done.forEach(function (id) { delete q2[id]; });
                const trimmed = trimQueue(q2, nowMs);
                if (Object.keys(trimmed).length !== Object.keys(cur).length) tx.update(queueRef, { entries: trimmed, updatedAtMs: nowMs });
            });
            return n;
        } catch (e) {
            log('premium founders expire queue failed', { err: String(e && e.message || e) });
            return 0;
        }
    }

    // Sweep: Founders' card orders whose hold lapsed in the last 70 minutes
    // (a Stripe session lives at most ~31) still get their session expired.
    async function expireLapsedFoundersSessions(nowMs) {
        // The sweep runs without the Stripe key bound today; skip quietly then.
        if (!stripeKeyOk(env.STRIPE_SECRET_KEY, mode())) return -1;
        const queued = await drainExpireQueue(nowMs, []);
        const q = await db.collection(COL.orders).where('holdExpMs', '>=', nowMs - 70 * 60000).limit(200).get();
        const ids = q.docs.filter(function (d) {
            const o = d.data();
            return o.lifetime && o.provider === 'stripe' && o.status === 'pending' && !o.sessionExpiredAtMs && Number(o.holdExpMs) <= nowMs;
        }).map(function (d) { return d.id; });
        return queued + (ids.length ? await expireLapsedSessions(ids, nowMs) : 0);
    }

    // Marks a pending order expired/error and frees its Founders seat hold.
    async function releaseOrder(orderId, status, nowMs) {
        const cfgForCooldown = status === 'expired' ? await loadConfig() : {};
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
                const h = holds[orderId];
                if (h) {
                    delete holds[orderId];
                    tx.update(counterRef, { holds: holds, updatedAtMs: nowMs });
                    // Abandoned (expired) Founders' checkout: start the cooldown.
                    const cd = (Number(cfgForCooldown.foundersHoldCooldownMinutes) || 0) * 60000;
                    const lapseAt = Math.min(Number(h.expMs) || nowMs, nowMs);
                    if (status === 'expired' && h.uid && cd > 0) {
                        const until = lapseAt + cd;
                        if (until > nowMs) tx.set(ref(COL.rate, foundersCooldownId(h.uid)), { untilMs: until, orderId: orderId, expireAt: new Date(until + 3600000) });
                    }
                    const icd = (Number(cfgForCooldown.foundersIpHoldCooldownMinutes) || 0) * 60000;
                    if (status === 'expired' && h.ipHash && icd > 0) {
                        const until = lapseAt + icd;
                        if (until > nowMs) tx.set(ref(COL.rate, foundersIpCooldownId(h.ipHash)), { untilMs: until, orderId: orderId, expireAt: new Date(until + 3600000) });
                    }
                }
            }
        });
    }

    // ---- shared grant (inside a transaction, after all reads)
    function writeEntitlement(tx, r) {
        if (r.freezeReason) {
            r.ent.frozen = true;
            r.ent.frozenAtMs = r.nowMs;
            r.ent.frozenReason = r.freezeReason;
        }
        const s = summarize(r.ent, r.nowMs);
        r.ent.active = s.active;
        r.ent.expiresAtMs = s.expiresAtMs;
        r.ent.plan = s.plan;
        r.ent.pendingStart = s.pendingStart;
        r.ent.updatedAtMs = r.nowMs;
        tx.set(r.entRef, r.ent);
        if (r.userExists && r.uid) {
            tx.set(ref('users', r.uid), { premium: { active: s.active, plan: s.plan, founders: s.founders, expiresAtMs: s.expiresAtMs, startsAtMs: s.startsAtMs, perksStartAtMs: Number(r.ent.deferredPerksStartAtMs) || null, inTrial: s.inTrial, updatedAtMs: r.nowMs } }, { merge: true });
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

    // An entitlement that is not already running starts now (orders made
    // since Nov 18 never carry a future startsAtMs). A running one keeps its
    // start. Embers + Citadel wait for deferredPerksStartAtMs (display only;
    // the grant checks config perksStartAt itself).
    function setStart(r, o) {
        const dp = Number(o && o.deferredPerksStartAtMs) || 0;
        if (dp > r.nowMs) r.ent.deferredPerksStartAtMs = Math.max(Number(r.ent.deferredPerksStartAtMs) || 0, dp);
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
    function grantFounders(tx, r, orderId, providerRef, extraPatch) {
        const c = r.counter;
        const holds = Object.assign({}, c.holds || {});
        // Only a live hold reserves a seat: a payment after the hold lapsed
        // gets a seat only if one is still free (Founders' card holds are
        // shorter than the Stripe session).
        const hadHold = !!(holds[orderId] && Number(holds[orderId].expMs) > r.nowMs);
        delete holds[orderId];
        const live = liveHolds(holds, r.nowMs);
        const sold = Number(c.sold) || 0;
        if (!hadHold && sold + Object.keys(live).length >= pricing.FOUNDERS_CAP) {
            tx.set(ref(COL.counters, 'founders'), Object.assign({}, c, { sold: sold, holds: holds, cap: pricing.FOUNDERS_CAP, updatedAtMs: r.nowMs }));
            tx.update(r.orderRef, Object.assign({ status: 'review', reviewReason: 'founders_sold_out_late_payment', paidAtMs: r.nowMs, providerRef: providerRef }, extraPatch || {}));
            review(tx, 'founders_sold_out_late_payment', { orderId: orderId, uid: r.uid, providerRef: providerRef, amountCents: r.order.amountCents }, r.nowMs);
            return 'review';
        }
        // A seat refunded or disputed before completion is sold and retired at
        // once: it never returns to sale (sold is never decremented).
        const retire = r.retireSeat === true ? { retired: (Number(c.retired) || 0) + 1 } : {};
        tx.set(ref(COL.counters, 'founders'), Object.assign({}, c, { sold: sold + 1, holds: holds, cap: pricing.FOUNDERS_CAP, updatedAtMs: r.nowMs }, retire));
        if (r.retireSeat === true) extraPatch = Object.assign({}, extraPatch || {}, { seatRetired: true });
        if (r.ent.autoRenew === true && r.ent.stripeSubscriptionId) {
            review(tx, 'founders_with_active_subscription', { orderId: orderId, uid: r.uid, stripeSubscriptionId: r.ent.stripeSubscriptionId }, r.nowMs);
        }
        setStart(r, r.order);
        r.ent.founders = true;
        r.ent.foundersOrderId = orderId;
        r.ent.foundersSeat = sold + 1;
        writeEntitlement(tx, r);
        tx.update(r.orderRef, Object.assign({ status: 'paid', paidAtMs: r.nowMs, providerRef: providerRef }, extraPatch || {}));
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

    // Stripe GET for an optional lookup: a 4xx (missing object, field not on
    // this API version) means "not found"; anything else throws so the
    // webhook answers 500 and Stripe retries.
    async function stripeGetSoft(path) {
        try { return await stripeRequest('GET', path); } catch (e) {
            if (/^stripe_4\d\d/.test(String(e && e.message || ''))) return null;
            throw e;
        }
    }
    const ORDER_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
    function metaOrderId(m) { return m && typeof m.orderId === 'string' && ORDER_ID_RE.test(m.orderId) ? m.orderId : null; }
    // charge -> invoice -> subscription -> order id, accepted only when the
    // subscription's Checkout Session is the order's own session.
    async function orderIdFromSubscriptionCharge(invoiceId, pi) {
        let inv = null;
        if (!invoiceId && pi && /^pi_[A-Za-z0-9]{6,200}$/.test(pi)) {
            const ip = await stripeGetSoft('/v1/invoice_payments?limit=1&payment[type]=payment_intent&payment[payment_intent]=' + encodeURIComponent(pi));
            const row = ip && Array.isArray(ip.data) ? ip.data[0] : null;
            const iv = row && (typeof row.invoice === 'string' ? row.invoice : (row.invoice && row.invoice.id));
            if (typeof iv === 'string') invoiceId = iv;
        }
        if (!invoiceId || !/^in_[A-Za-z0-9]{6,200}$/.test(invoiceId)) return null;
        inv = await stripeGetSoft('/v1/invoices/' + encodeURIComponent(invoiceId));
        if (!inv) return null;
        const sd = (inv.parent && inv.parent.subscription_details) || inv.subscription_details || null;
        let subId = (sd && typeof sd.subscription === 'string' && sd.subscription) || (typeof inv.subscription === 'string' ? inv.subscription : null);
        let oid = metaOrderId(sd && sd.metadata);
        if (!subId || !/^sub_[A-Za-z0-9]{6,200}$/.test(subId)) return null;
        if (!oid) {
            const sub = await stripeGetSoft('/v1/subscriptions/' + encodeURIComponent(subId));
            oid = metaOrderId(sub && sub.metadata);
        }
        if (!oid) return null;
        const list = await stripeGetSoft('/v1/checkout/sessions?limit=1&subscription=' + encodeURIComponent(subId));
        const sess = list && Array.isArray(list.data) ? list.data[0] : null;
        if (!sess || typeof sess.id !== 'string') return null;
        if (sess.client_reference_id != null && sess.client_reference_id !== oid) return null;
        const od = await ref(COL.orders, oid).get();
        if (!od.exists || od.data().providerSessionId !== sess.id || od.data().provider !== 'stripe') return null;
        return oid;
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

    // How a canceled or cancel-scheduled subscription ends, from the Stripe
    // subscription object (customer.subscription.updated / .deleted):
    //   revoke    fraud, dispute or trial reuse: time ends now
    //             (cancellation_details.reason payment_disputed, a comment or
    //             metadata.bqCancelReason of fraud/trial_reused, or an order or
    //             entitlement already marked trial_reused)
    //   trial_end canceled during a trial (status trialing, or ended before
    //             trial_end): time ends at trial_end, no grace period
    //   null      paid period: the paid time plus grace stays
    function subscriptionEnd(t, obj, o, r) {
        const deleted = t === 'customer.subscription.deleted' || obj.status === 'canceled';
        const trialEndSec = Number(obj.trial_end) || 0;
        const cancelAtSec = Number(obj.cancel_at) || 0;
        const ending = deleted || obj.cancel_at_period_end === true || (cancelAtSec > 0 && trialEndSec > 0 && cancelAtSec <= trialEndSec);
        if (!ending) return null;
        const cd = obj.cancellation_details && typeof obj.cancellation_details === 'object' ? obj.cancellation_details : {};
        const comment = String(cd.comment || '').toLowerCase();
        const meta = String((obj.metadata && obj.metadata.bqCancelReason) || '').toLowerCase();
        let reason = null;
        if (/\btrial_reused\b/.test(comment) || meta === 'trial_reused' || (o && o.reviewReason === 'trial_reused') || r.ent.frozenReason === 'trial_reused') reason = 'trial_reused';
        else if (/\bfraud/.test(comment) || meta === 'fraud') reason = 'fraud';
        else if (cd.reason === 'payment_disputed') reason = 'payment_disputed';
        if (reason) return { kind: 'revoke', reason: reason };
        if (!trialEndSec) return null;
        const nowSec = r.nowMs / 1000;
        const endedSec = Number(obj.ended_at || obj.canceled_at) || 0;
        const inTrial = obj.status === 'trialing' || (deleted && (endedSec ? endedSec < trialEndSec : nowSec < trialEndSec));
        if (!inTrial) return null;
        return { kind: 'trial_end', atMs: trialEndSec * 1000 };
    }

    async function cancelTrialReuse(subId, orderId, reviewId) {
        if (!subId) return { status: 200, canceled: false };
        try {
            // The comment tells our own subscription.deleted handler to end
            // the entitlement now (no trial or grace time).
            await stripeRequest('DELETE', '/v1/subscriptions/' + encodeURIComponent(subId), { cancellation_details: { comment: 'trial_reused' } });
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
                // Refunded in full or disputed before this completion landed:
                // grant frozen, retire a Founders' seat, and open a review row.
                const preFreeze = o.refundKind === 'full' ? 'charge.refunded' : (o.disputedAtMs ? 'charge.dispute.created' : null);
                if (preFreeze) {
                    r.freezeReason = preFreeze;
                    r.retireSeat = !!o.lifetime && o.seatRetired !== true;
                    review(tx, 'stripe_completed_after_' + preFreeze.replace(/\./g, '_'), { eventId: event.id, orderId: orderId, uid: o.uid || null, sessionId: obj.id, frozen: 1 }, r.nowMs);
                    tx.set(ref('admin_notifications', newId()), {
                        type: 'premium_review',
                        text: 'Premium checkout completed after a ' + (preFreeze === 'charge.refunded' ? 'full refund' : 'dispute') + ': perks frozen until review (order ' + orderId + ').',
                        uid: o.uid ? String(o.uid).slice(0, 4) + '\u2026' : null,
                        read: false,
                        createdAt: new Date(r.nowMs),
                    });
                }
                if (o.lifetime) {
                    // Keep the Stripe customer so a later refund or dispute finds it.
                    if (customerId && !r.ent.stripeCustomerId) r.ent.stripeCustomerId = customerId;
                    return grantFounders(tx, r, orderId, obj.id, customerId && !o.stripeCustomerId ? { stripeCustomerId: customerId } : null);
                }
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
                const owns = r.ent.stripeSubscriptionId === obj.id || (!!orderId && r.ent.subscriptionOrderId === orderId);
                const end = owns ? subscriptionEnd(t, obj, o, r) : null;
                if (end && end.kind === 'revoke') {
                    // Fraud, dispute or trial reuse: the subscription's time ends now.
                    r.ent.subscriptionUntilMs = Math.min(Number(r.ent.subscriptionUntilMs) || 0, r.nowMs);
                    r.ent.trialUntilMs = null;
                    r.ent.subscriptionEndedReason = end.reason;
                    r.ent.subscriptionEndedAtMs = r.nowMs;
                    writeEntitlement(tx, r);
                    if (end.reason !== 'trial_reused') {
                        review(tx, 'subscription_revoked', { eventId: event.id, orderId: orderId || null, uid: o.uid || r.uid || null, subscriptionId: obj.id || null, why: end.reason }, r.nowMs);
                    }
                    return 'revoked';
                }
                if (end && end.kind === 'trial_end') {
                    // A canceled trial ends at trial_end with no grace period.
                    r.ent.subscriptionUntilMs = Math.min(Number(r.ent.subscriptionUntilMs) || 0, end.atMs);
                    r.ent.subscriptionEndedReason = 'trial_canceled';
                    r.ent.subscriptionEndedAtMs = r.nowMs;
                    writeEntitlement(tx, r);
                    return 'trial_ends';
                }
                if (owns && renewing && obj.status === 'trialing' && Number(obj.trial_end) > 0 && r.ent.subscriptionEndedReason === 'trial_canceled') {
                    // Trial cancel undone: back to trial_end + grace for the first charge.
                    r.ent.subscriptionUntilMs = Math.max(Number(r.ent.subscriptionUntilMs) || 0, Number(obj.trial_end) * 1000 + SUB_GRACE_MS);
                    r.ent.subscriptionEndedReason = null;
                    r.ent.subscriptionEndedAtMs = null;
                }
                writeEntitlement(tx, r); // paid time already granted stays (with grace)
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

        if (t === 'invoice.payment_failed') {
            // A failed renewal does not freeze anything: Stripe retries, and
            // paid time (period end + 3-day grace) simply runs out if no
            // payment comes. invoice.paid extends it again. Review row only.
            const customerId = typeof obj.customer === 'string' ? obj.customer : null;
            const subMeta = obj.parent && obj.parent.subscription_details && obj.parent.subscription_details.metadata;
            const legacyMeta = obj.subscription_details && obj.subscription_details.metadata;
            const oid = (subMeta && typeof subMeta.orderId === 'string' && subMeta.orderId) || (legacyMeta && typeof legacyMeta.orderId === 'string' && legacyMeta.orderId) || null;
            const outcome = await once(key, oid, async function (tx, r) {
                review(tx, 'stripe_invoice_payment_failed', {
                    eventId: event.id,
                    objectId: obj.id || null,
                    uid: (r.order && r.order.uid) || r.uid || null,
                    orderId: oid,
                    customerId: customerId,
                    amount: obj.amount_due || null,
                    attempt: Number(obj.attempt_count) || null,
                    frozen: 0,
                }, r.nowMs);
                return 'payment_failed_noted';
            });
            return { status: 200, outcome: outcome };
        }

        if (t === 'charge.refunded' || t === 'charge.dispute.created') {
            // Find who this is about: order id from metadata, else the Stripe customer.
            let customerId = typeof obj.customer === 'string' ? obj.customer : null;
            let orderIds = orderIdsForCharge(obj);
            // A dispute object carries no order metadata or customer. Read its
            // charge back so a dispute that lands before checkout completes
            // still stamps the order. A failed read answers 500 (Stripe retries).
            let pi = typeof obj.payment_intent === 'string' ? obj.payment_intent : null;
            let invoiceId = t === 'charge.refunded' && typeof obj.invoice === 'string' ? obj.invoice : null;
            if (t === 'charge.dispute.created' && !orderIds.length && typeof obj.charge === 'string' && /^(ch|py)_[A-Za-z0-9]{6,200}$/.test(obj.charge)) {
                const ch = await stripeRequest('GET', '/v1/charges/' + encodeURIComponent(obj.charge));
                orderIds = orderIdsForCharge(ch);
                if (!customerId && ch && typeof ch.customer === 'string') customerId = ch.customer;
                if (!pi && ch && typeof ch.payment_intent === 'string') pi = ch.payment_intent;
                if (!invoiceId && ch && typeof ch.invoice === 'string') invoiceId = ch.invoice;
            }
            // Still no order (e.g. before checkout completed, when the order has
            // no Stripe customer yet): find the Checkout Session that owns the
            // payment and accept it only if it is the order's own session.
            if (!orderIds.length && pi && /^pi_[A-Za-z0-9]{6,200}$/.test(pi)) {
                const list = await stripeRequest('GET', '/v1/checkout/sessions?limit=1&payment_intent=' + encodeURIComponent(pi));
                const sess = list && Array.isArray(list.data) ? list.data[0] : null;
                const oid = sess && typeof sess.client_reference_id === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(sess.client_reference_id) ? sess.client_reference_id : null;
                if (oid) {
                    const od = await ref(COL.orders, oid).get();
                    if (od.exists && od.data().providerSessionId === sess.id) orderIds = [oid];
                }
            }
            // Subscription (monthly/yearly) charges carry no order id and
            // their session is not found by payment intent: go charge ->
            // invoice -> subscription, then require the session match.
            if (!orderIds.length) {
                const oid = await orderIdFromSubscriptionCharge(invoiceId, pi);
                if (oid) orderIds = [oid];
            }
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
            // No-refund policy: any refund is one Phil made by hand. A partial
            // refund (goodwill credit) leaves Premium running and only writes
            // a review row; a full refund or a dispute freezes perks.
            const freeze = t === 'charge.dispute.created' || isFullRefund;
            const outcome = await once(key, firstOrderId, async function (tx, r) {
                const snaps = [];
                for (const er of entRefs) snaps.push(await tx.get(er));
                // Targets: entitlements by Stripe customer, plus the order
                // owner's entitlement (Founders' card orders may carry no
                // customer on the entitlement).
                const targets = [];
                snaps.forEach(function (sn) {
                    if (!sn.exists) return;
                    const isAccount = sn.ref.path.indexOf(COL.entitlements + '/') === 0;
                    targets.push({ ref: sn.ref, data: sn.data(), isAccount: isAccount, id: sn.id });
                });
                if (r.entRef && r.ent && Object.keys(r.ent).length && !targets.some(function (x) { return x.ref.path === r.entRef.path; })) {
                    targets.push({ ref: r.entRef, data: Object.assign({}, r.ent), isAccount: !!r.uid, id: r.uid || r.entRef.id });
                }
                const uids = targets.filter(function (x) { return x.isAccount; }).map(function (x) { return x.id; });
                const walletSnaps = [];
                if (isFullRefund) {
                    for (let i = 0; i < uids.length; i++) walletSnaps.push(await tx.get(ref(COL.allowance, uids[i])));
                }
                if (freeze) {
                    targets.forEach(function (x) {
                        const e = Object.assign({}, x.data, { frozen: true, frozenAtMs: r.nowMs, frozenReason: t });
                        writeEntitlement(tx, { nowMs: r.nowMs, uid: x.isAccount ? x.id : null, entRef: x.ref, ent: e, userExists: x.isAccount && (x.ref.path !== (r.entRef && r.entRef.path) || r.userExists) });
                    });
                }
                // Founders' seat never returns to sale (Phil, Nov 18): sold is
                // never decremented. A fully refunded seat is counted as retired.
                const orderPatch = {};
                if (isFullRefund && r.order && r.order.lifetime && r.order.status === 'paid' && r.order.seatRetired !== true) {
                    const c = r.counter || {};
                    tx.set(ref(COL.counters, 'founders'), { retired: (Number(c.retired) || 0) + 1, updatedAtMs: r.nowMs }, { merge: true });
                    orderPatch.seatRetired = true;
                }
                // Always stamp the order, paid or not, so a completion that
                // arrives after the refund or dispute is granted frozen.
                if (r.order && t === 'charge.refunded') {
                    Object.assign(orderPatch, isFullRefund ? { refundedAtMs: r.nowMs, refundKind: 'full' } : { partialRefundAtMs: r.nowMs, refundKind: r.order.refundKind === 'full' ? 'full' : 'partial', refundedCents: Number(obj.amount_refunded) || null });
                }
                if (r.order && t === 'charge.dispute.created' && !r.order.disputedAtMs) orderPatch.disputedAtMs = r.nowMs;
                if (r.orderRef && Object.keys(orderPatch).length) tx.update(r.orderRef, orderPatch);
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
                    partial: t === 'charge.refunded' && !isFullRefund,
                    frozen: freeze ? targets.length : 0,
                }, r.nowMs);
                // Human alert: the admin panel's admin_notifications feed.
                tx.set(ref('admin_notifications', newId()), {
                    type: 'premium_review',
                    text: 'Premium ' + t + (freeze ? ': perks frozen until review' : ': partial refund, perks unchanged') + ' (order ' + (firstOrderId || 'unknown') + ').',
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
        if (cfg.lightningEnabled && cfg.btcpayHost) combos.push(['yearly', 'lightning'], ['founders', 'lightning'], ['months', 'lightning']);
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
            // Embers + Citadel perks start here (Jan 3, 2027 12:00 AM ET).
            perksStartAtMs: cfg.perksStartAtMs,
            deferredPerksOpen: deferredPerksOpen(nowMs, cfg.perksStartAtMs),
            citadelPerks: citadelPerksAllowed(entSnap.exists ? entSnap.data() : null, nowMs, cfg.perksStartAtMs),
            chargedAtPurchase: true,
            trialsOpen: cfg.trialsEnabled === true && cfg.trialDays > 0,
            trialDays: cfg.trialsEnabled === true ? cfg.trialDays : 0,
            refundPolicy: { id: pricing.REFUND_POLICY.id, text: pricing.REFUND_POLICY.text },
            checkoutOpen: cfg.checkoutEnabled,
            lightningOpen: cfg.lightningEnabled && !!cfg.btcpayHost,
            // The app follows a bitcoin checkout link only on this exact host.
            btcpayHost: cfg.lightningEnabled ? cfg.btcpayHost : null,
            existingUserOffer: elig.ok ? { pct: cfg.existingUserDiscountPct, endsAtMs: cfg.existingUserDiscountEndsAtMs } : null,
            foundersLeft: foundersLeft(counterSnap.exists ? counterSnap.data() : null, nowMs),
            offers: offers,
            embers: walletEmbers(walletSnap.exists ? walletSnap.data() : null),
            embersCap: EMBERS_CAP,
            embersPerMonth: embersGrantAllowed(entSnap.exists ? entSnap.data() : null, nowMs, cfg.perksStartAtMs) ? EMBERS_PER_MONTH : 0,
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
        const cfg = await loadConfig();
        return db.runTransaction(async function (tx) {
            const e = await tx.get(entRef);
            const w = await tx.get(walletRef);
            const l = await tx.get(ledgerRef);
            const ent = e.exists ? e.data() : null;
            const bal = walletEmbers(w.exists ? w.data() : null);
            if (!isPremiumActive(ent, nowMs)) throw fail('permission-denied', 'Premium is not active.', 'not_premium');
            const out = { granted: 0, embers: bal, cosmeticCredits: bal, month: month, cap: EMBERS_CAP, name: 'Embers' };
            if (!embersGrantAllowed(ent, nowMs, cfg.perksStartAtMs)) {
                const s = summarize(ent, nowMs);
                if (!deferredPerksOpen(nowMs, cfg.perksStartAtMs)) { out.reason = 'perks_start'; out.perksStartAtMs = cfg.perksStartAtMs; }
                else if (s.inTrial) out.reason = 'trial';
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
    // Also turns on any older entitlement that still carries a future
    // startsAtMs (orders made since Nov 18 always start at purchase).
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
        let sessionsExpired = 0;
        let sessionsExpireSkipped = false;
        try { sessionsExpired = await expireLapsedFoundersSessions(nowMs); if (sessionsExpired < 0) { sessionsExpired = 0; sessionsExpireSkipped = true; } } catch (e) { log('premium sweep session expire failed', { err: String(e && e.message || e) }); }
        return { checked: snap.docs.length, flipped: flipped, emailsCleared: emailsCleared, holdsAlert: holds, sessionsExpired: sessionsExpired, sessionsExpireSkipped: sessionsExpireSkipped };
    }

    // Unclaimed public orders: clear the plain email after
    // publicOrderEmailRetentionMonths (default 3) from purchase.
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
    // Founders' holds and hold cooldowns keyed by this account: the uid, and
    // 'email:<key>' for email purchases it claimed.
    const holdKeys = [uid].concat(keys.map(function (k) { return 'email:' + k; }));
    const cRef = db.collection(COL.counters).doc('founders');
    const c = await cRef.get();
    if (c.exists) {
        const holds = Object.assign({}, c.data().holds || {});
        let changed = false;
        Object.keys(holds).forEach(function (id) { if (holds[id] && holdKeys.indexOf(holds[id].uid) !== -1) { holds[id] = Object.assign({}, holds[id], { uid: masked }); changed = true; } });
        if (changed) await cRef.update({ holds: holds });
    }
    // Cooldown rows that point at this account's orders (the per-network one
    // stays, it is keyed by a keyed network hash, but loses the order link).
    for (const id of seen) {
        const rows = await db.collection(COL.rate).where('orderId', '==', id).get();
        for (const d of rows.docs) { await d.ref.update({ orderId: null }); out.cooldownsUnlinked = (out.cooldownsUnlinked || 0) + 1; }
    }
    const drop = [entRef, db.collection(COL.allowance).doc(uid), db.collection(COL.rate).doc(uid)]
        .concat(holdKeys.map(function (k) { return db.collection(COL.rate).doc(foundersCooldownId(k)); }))
        .concat(claimed.docs.map(function (d) { return d.ref; }));
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
    foundersCooldownId,
    ALLOWANCE_PER_MONTH,
    EMBERS_PER_MONTH,
    EMBERS_CAP,
    embersGrantAllowed,
    deferredPerksOpen,
    citadelPerksAllowed,
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
