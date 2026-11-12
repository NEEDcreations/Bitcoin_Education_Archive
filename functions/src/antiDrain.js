'use strict';

// Anti-drain guards for every Lightning payout (Red Team, Nov 9 2026, after
// the Nov 8 LNbits drain wave: fresh throwaway accounts pulling sats out).
//
// Applied in claimSats, claimCipherSats and claimCipherWin, the only callables
// that send sats out of the wallet. Every sats reward (cipher opens, cipher
// share credits, TCTV pot, gift sats, XP -> faucet) lands in a balance first
// and can only leave through one of those three.
//
//   1. identity: no anonymous accounts and a verified email (Auth record or
//      ID token).
//   2. account age: MIN_PAYOUT_ACCOUNT_AGE_DAYS (Phil Nov 9: 7).
//   3. per-user rate limit across all three paths (Phil Nov 9: 3/h, 6/24h).
//   4. per-wallet cap: sats to one Lightning address in a rolling 24h across
//      every account and path (Phil Nov 9: 2,500).
//   5. float circuit breaker: if the wallet balance fell more than
//      FLOAT_DROP_SATS below its peak inside FLOAT_DROP_WINDOW_MS, set the
//      global satsHold (payout_safety/hold, see payoutSafety.js) and stop.
//      (Phil Nov 9: 5,000 sats / 1h.) Sampled right before every payout AND
//      every 10 minutes by payoutFloatWatch (Phil Nov 9: 10-minute wallet
//      drain check), so a drain that goes around our functions also trips it.
//
// Phil approved every value on Nov 9 (7 days, 3/h, 6/24h, 2,500 sats per
// address per 24h, 5,000 sats/h breaker). Unverified accounts keep earning
// sats into their balance; only cashing out needs the verified email.
//
// Privacy (User Data/Backups + Spam/Abuse must-fix): guard doc ids are an
// HMAC-SHA256 keyed with the PAYOUT_GUARD_HMAC_KEY Secret Manager secret,
// over the uid (payout_guard_users) and over the wallet fingerprint
// (payout_guard_wallets). No raw uid, address or static-salt hash is stored.
// Each write sets expireAt = now + 30 days for the Firestore TTL policy, and
// events older than the 24h window are pruned on every write. The docs are
// kept on account deletion (deleteAccount RETAINED_COLLECTIONS) so a
// delete-and-recreate cannot reset the windows; TTL still expires them.
// A missing key fails closed (no payout).
//
// Wallet fingerprint (Spam/Abuse M2): the per-address cap is charged to every
// key of one payout: the normalized address (lowercase, lightning:/mailto:
// prefix, www., trailing dot and port stripped, LNURL bech32 decoded,
// known alias domains folded) AND the resolved LNURL-pay callback (host +
// path + query). Two strings that land on the same wallet callback share
// one cap. What cannot be collapsed: a wallet that hands out a different
// callback per address or per request, and two genuinely different
// addresses at one custodian owned by the same person.
//
// Pure planners are exported for tests. reservePayout runs them in one
// Firestore transaction right before pay_invoice.

const crypto = require('crypto');
const payoutSafety = require('./payoutSafety');

// ---- Config (Phil approved Nov 9) ----
const MIN_PAYOUT_ACCOUNT_AGE_DAYS = 7;
const USER_MAX_PAYOUTS_PER_HOUR = 3;
const USER_MAX_PAYOUTS_PER_DAY = 6;
const WALLET_DAILY_CAP_SATS = 2500;
const FLOAT_DROP_WINDOW_MS = 60 * 60 * 1000;
const FLOAT_DROP_SATS = 5000;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_SAMPLES = 120;

const GUARD_TTL_MS = 30 * DAY_MS;
const SECRET_ENV = 'PAYOUT_GUARD_HMAC_KEY';
const MIN_SECRET_LEN = 16;
// Domains that serve the same wallets under another name. Add only aliases
// that are confirmed to resolve the same username to the same wallet.
const DOMAIN_ALIASES = Object.freeze({
    'pay.bitcoinbeach.com': 'blink.sv',
});

const USERS_COLLECTION = 'payout_guard_users';
const WALLETS_COLLECTION = 'payout_guard_wallets';
const FLOAT_DOC = 'float';

const ANON_ERROR = 'Sign in with a real account to withdraw sats.';
const EMAIL_ERROR = 'Verified email required. Link and verify your email in Account settings.';
const PROVIDER_ERROR = 'Link a sign-in method to your account before withdrawing sats.';
const RATE_ERROR = 'Too many withdrawals for now. Try again in a little while.';
const WALLET_ERROR = 'That Lightning address has reached its daily limit. Try again tomorrow.';
const KEY_ERROR = 'Sats payouts are paused right now. Try again later.';

function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function guardError(message, reason) {
    return new payoutSafety.PayoutHoldError(message, reason);
}

// Pure. token = context.auth.token, authUser = admin.auth().getUser() record.
function assessIdentity(token, authUser) {
    const tok = token || {};
    const fb = tok.firebase || {};
    if (!tok || fb.sign_in_provider === 'anonymous') return { ok: false, error: ANON_ERROR, reason: 'anonymous' };
    const user = authUser || null;
    if (!user) return { ok: false, error: EMAIL_ERROR, reason: 'no_user' };
    // Nostr / Lightning (custom-token) accounts have an empty providerData
    // list, so only its shape is checked. The verified email is the gate.
    if (!Array.isArray(user.providerData)) return { ok: false, error: PROVIDER_ERROR, reason: 'no_provider' };
    const authVerified = !!(user.email && user.emailVerified === true);
    const tokenVerified = !!(tok.email && tok.email_verified === true);
    if (!authVerified && !tokenVerified) return { ok: false, error: EMAIL_ERROR, reason: 'unverified' };
    return { ok: true };
}

function ageError(days) {
    return 'Account must be at least ' + MIN_PAYOUT_ACCOUNT_AGE_DAYS + ' days old. Yours is ' + Math.max(0, Math.floor(num(days))) + ' days.';
}

// Pure. ageDays may be NaN/unknown: unknown fails closed.
function assessAccountAge(ageDays) {
    const n = Number(ageDays);
    if (ageDays === null || ageDays === undefined || !Number.isFinite(n)) {
        return { ok: false, error: 'Could not verify account age. Try again later.', reason: 'age_unknown' };
    }
    if (Math.floor(n) < MIN_PAYOUT_ACCOUNT_AGE_DAYS) return { ok: false, error: ageError(n), reason: 'too_new' };
    return { ok: true };
}

function recent(list, afterMs, nowMs) {
    return (Array.isArray(list) ? list : []).filter(function (e) {
        return e && num(e.ms) > afterMs && num(e.ms) <= nowMs;
    });
}

// Pure. state = payout_guard_users/{uid}.
function planUserRate(state, path, nowMs) {
    const now = num(nowMs);
    const events = recent(state && state.events, now - DAY_MS, now);
    const lastHour = events.filter(function (e) { return num(e.ms) > now - HOUR_MS; }).length;
    if (lastHour >= USER_MAX_PAYOUTS_PER_HOUR || events.length >= USER_MAX_PAYOUTS_PER_DAY) {
        return { ok: false, error: RATE_ERROR, reason: 'user_rate', lastHour: lastHour, lastDay: events.length };
    }
    return { ok: true, events: events.concat([{ ms: now, path: String(path || '').slice(0, 40) }]).slice(-MAX_SAMPLES) };
}

// Pure. state = payout_guard_wallets/{hash}.
function planWalletCap(state, sats, path, nowMs) {
    const now = num(nowMs);
    const amount = Math.max(0, Math.floor(num(sats)));
    const events = recent(state && state.events, now - DAY_MS, now);
    const used = events.reduce(function (s, e) { return s + Math.max(0, Math.floor(num(e.sats))); }, 0);
    if (used + amount > WALLET_DAILY_CAP_SATS) {
        return { ok: false, error: WALLET_ERROR, reason: 'wallet_cap', used: used };
    }
    return { ok: true, used: used, events: events.concat([{ ms: now, sats: amount, path: String(path || '').slice(0, 40) }]).slice(-MAX_SAMPLES) };
}

// Pure. state = payout_safety/float. walletSats = balance just read (sats).
// Trips when the balance is more than FLOAT_DROP_SATS below the highest
// sample inside the window. Top-ups only raise the peak.
function planFloat(state, walletSats, nowMs) {
    const now = num(nowMs);
    const bal = Math.floor(num(walletSats));
    const samples = recent(state && state.samples, now - FLOAT_DROP_WINDOW_MS, now);
    const peak = samples.reduce(function (m, s) { return Math.max(m, Math.floor(num(s.sats))); }, bal);
    const drop = peak - bal;
    const next = samples.concat([{ ms: now, sats: bal }]).slice(-MAX_SAMPLES);
    return { trip: drop > FLOAT_DROP_SATS, drop: drop, peak: peak, samples: next };
}

function secretValue() {
    const raw = process.env[SECRET_ENV] || '';
    const t = typeof raw === 'string' ? raw.trim() : '';
    return t.length >= MIN_SECRET_LEN ? t : '';
}

function secretReady() {
    return !!secretValue();
}

function hmac(kind, material) {
    const key = secretValue();
    if (!key || !material) return '';
    return crypto.createHmac('sha256', key).update('bq-payout-guard:v1:' + kind + ':' + String(material), 'utf8').digest('hex').slice(0, 40);
}

// Minimal bech32 decode for LNURL strings (no checksum use beyond shape).
function decodeLnurl(s) {
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const str = String(s || '').toLowerCase();
    const pos = str.lastIndexOf('1');
    if (str.indexOf('lnurl') !== 0 || pos < 1 || str.length - pos < 7) return '';
    const data = [];
    for (let i = pos + 1; i < str.length - 6; i++) {
        const v = CHARSET.indexOf(str[i]);
        if (v === -1) return '';
        data.push(v);
    }
    let acc = 0, bits = 0;
    const out = [];
    for (const v of data) {
        acc = (acc << 5) | v; bits += 5;
        while (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); }
    }
    try { return Buffer.from(out).toString('utf8'); } catch (e) { return ''; }
}

function normalizeDomain(d) {
    let h = String(d || '').trim().toLowerCase().split(':')[0].replace(/\.+$/, '');
    if (h.indexOf('www.') === 0) h = h.slice(4);
    return Object.prototype.hasOwnProperty.call(DOMAIN_ALIASES, h) ? DOMAIN_ALIASES[h] : h;
}

// Pure. One stable string per receiving wallet address. '' when unusable.
function walletFingerprint(address) {
    let a = String(address || '').trim().toLowerCase();
    ['lightning:', 'mailto:'].forEach(function (p) { if (a.indexOf(p) === 0) a = a.slice(p.length).trim(); });
    if (!a) return '';
    if (a.indexOf('lnurl') === 0 && a.indexOf('@') === -1) {
        const url = decodeLnurl(a);
        if (!url) return 'lnurl:' + a;
        try {
            const u = new URL(url);
            const m = u.pathname.match(/^\/\.well-known\/lnurlp\/([^/]+)\/?$/);
            if (m) return decodeURIComponent(m[1]).toLowerCase() + '@' + normalizeDomain(u.hostname);
            return 'url:' + normalizeDomain(u.hostname) + u.pathname + u.search;
        } catch (e) { return 'lnurl:' + a; }
    }
    const at = a.lastIndexOf('@');
    if (at < 1) return a;
    return a.slice(0, at) + '@' + normalizeDomain(a.slice(at + 1));
}

// Pure. LNURL-pay callback (from lnurlResolve.callbackKey) -> stable key.
function callbackFingerprint(callback) {
    const c = String(callback || '').trim();
    if (!c) return '';
    try {
        const u = new URL(c.indexOf('://') === -1 ? 'https://' + c : c);
        return 'cb:' + normalizeDomain(u.hostname) + u.pathname.replace(/\/+$/, '') + u.search;
    } catch (e) { return ''; }
}

// HMAC doc ids. '' when the key is missing or the input is empty.
function walletKey(address) {
    const fp = walletFingerprint(address);
    return fp ? hmac('wallet', fp) : '';
}

function callbackKey(callback) {
    const fp = callbackFingerprint(callback);
    return fp ? hmac('wallet', fp) : '';
}

function userKey(uid) {
    const u = String(uid || '');
    return u ? hmac('user', u) : '';
}

function expiresAt(nowMs) {
    return new Date(num(nowMs) + GUARD_TTL_MS);
}

// Shared by reservePayout and payoutFloatWatch: sample the balance inside a
// transaction and, on a trip, set the global satsHold + permanent audit row.
function applyFloatSample(t, db, state, walletSats, nowMs, source) {
    const floatRef = db.collection(payoutSafety.HOLD_COLLECTION).doc(FLOAT_DOC);
    const holdRef = db.collection(payoutSafety.HOLD_COLLECTION).doc(payoutSafety.HOLD_DOC);
    const fl = planFloat(state, walletSats, nowMs);
    t.set(floatRef, { samples: fl.samples, updatedAtMs: nowMs }, { merge: true });
    if (!fl.trip) return fl;
    const patch = {
        satsHold: nowMs + payoutSafety.HOLD_MS,
        satsHoldReason: 'float dropped ' + fl.drop + ' sats in ' + Math.round(FLOAT_DROP_WINDOW_MS / 60000) + ' min',
        satsHoldSetAtMs: nowMs,
    };
    t.set(holdRef, patch, { merge: true });
    t.set(db.collection(payoutSafety.AUDIT_COLLECTION).doc(), Object.assign({ action: 'auto_hold', source: source || 'float_breaker', peak: fl.peak, balance: Math.floor(num(walletSats)), atMs: nowMs }, patch));
    return fl;
}

async function alertFloat(db, admin, drop, nowMs, notify) {
    try {
        await notify(db, admin, {
            docId: 'float_breaker_' + nowMs,
            message: ('Payout float dropped ' + drop + ' sats within ' + Math.round(FLOAT_DROP_WINDOW_MS / 60000) + ' min. ALL sats payouts paused (satsHold).').slice(0, 180),
            targetId: 'float_breaker',
        });
    } catch (e) {
        console.error('[antiDrain] float alert failed:', e.message);
    }
}

// 10-minute wallet drain check (payoutFloatWatch). walletSats < 0 means the
// balance could not be read: nothing is recorded. Returns the float plan.
async function watchFloat(db, admin, walletSats, deps) {
    const d = deps || {};
    const nowMs = typeof d.nowMs === 'number' ? d.nowMs : Date.now();
    const notify = d.notify || require('./satsReviewAlert').notifyAdminClaim;
    const bal = Number(walletSats);
    if (!Number.isFinite(bal) || bal < 0) return { skipped: true };
    const floatRef = db.collection(payoutSafety.HOLD_COLLECTION).doc(FLOAT_DOC);
    const holdRef = db.collection(payoutSafety.HOLD_COLLECTION).doc(payoutSafety.HOLD_DOC);
    let fl = null;
    let alreadyHeld = false;
    await db.runTransaction(async function (t) {
        const floatSnap = await t.get(floatRef);
        const holdSnap = await t.get(holdRef);
        alreadyHeld = !payoutSafety.assessHold(holdSnap.exists ? holdSnap.data() : null, 'claimSats', nowMs).ok;
        if (alreadyHeld) {
            // Still record the sample; do not re-set the hold or re-alert.
            fl = planFloat(floatSnap.exists ? floatSnap.data() : null, bal, nowMs);
            t.set(floatRef, { samples: fl.samples, updatedAtMs: nowMs }, { merge: true });
            return;
        }
        fl = applyFloatSample(t, db, floatSnap.exists ? floatSnap.data() : null, bal, nowMs, 'float_watch');
    });
    if (fl && fl.trip && !alreadyHeld) await alertFloat(db, admin, fl.drop, nowMs, notify);
    return Object.assign({ alreadyHeld: alreadyHeld }, fl || {});
}

// One transaction right before pay_invoice. Throws a PAYOUT_GUARD error
// (payoutSafety.PayoutHoldError) on refusal; callers release/refund on it
// exactly like WALLET_LOW. A float trip is persisted (hold + audit) before
// the throw, then Phil is alerted.
async function reservePayout(db, admin, info, deps) {
    const src = info || {};
    const d = deps || {};
    const nowMs = typeof src.nowMs === 'number' ? src.nowMs : Date.now();
    const notify = d.notify || require('./satsReviewAlert').notifyAdminClaim;
    if (!secretReady()) throw guardError(KEY_ERROR, 'guard_key_missing');
    const uKey = userKey(src.uid);
    const wKeys = [];
    [walletKey(src.address), callbackKey(src.callback)].forEach(function (k) { if (k && wKeys.indexOf(k) === -1) wKeys.push(k); });
    if (!uKey) throw guardError(RATE_ERROR, 'no_uid');
    if (!walletKey(src.address)) throw guardError(WALLET_ERROR, 'no_address');
    const userRef = db.collection(USERS_COLLECTION).doc(uKey);
    const walletRefs = wKeys.map(function (k) { return db.collection(WALLETS_COLLECTION).doc(k); });
    const floatRef = db.collection(payoutSafety.HOLD_COLLECTION).doc(FLOAT_DOC);
    const holdRef = db.collection(payoutSafety.HOLD_COLLECTION).doc(payoutSafety.HOLD_DOC);
    let outcome = null;
    await db.runTransaction(async function (t) {
        outcome = null;
        const userSnap = await t.get(userRef);
        const walletSnaps = [];
        for (let i = 0; i < walletRefs.length; i++) walletSnaps.push(await t.get(walletRefs[i]));
        const floatSnap = await t.get(floatRef);
        const holdSnap = await t.get(holdRef);
        const hold = holdSnap.exists ? holdSnap.data() : null;
        const held = payoutSafety.assessHold(hold, src.path, nowMs);
        if (!held.ok) { outcome = { ok: false, error: held.error, reason: held.reason }; return; }
        const fl = applyFloatSample(t, db, floatSnap.exists ? floatSnap.data() : null, src.walletSats, nowMs, 'float_breaker');
        if (fl.trip) {
            outcome = { ok: false, error: payoutSafety.HOLD_ERROR, reason: 'float_breaker', drop: fl.drop };
            return;
        }
        const rate = planUserRate(userSnap.exists ? userSnap.data() : null, src.path, nowMs);
        if (!rate.ok) { outcome = rate; return; }
        const caps = [];
        for (let i = 0; i < walletSnaps.length; i++) {
            const cap = planWalletCap(walletSnaps[i].exists ? walletSnaps[i].data() : null, src.sats, src.path, nowMs);
            if (!cap.ok) { outcome = cap; return; }
            caps.push(cap);
        }
        const exp = expiresAt(nowMs);
        t.set(userRef, { events: rate.events, updatedAtMs: nowMs, expireAt: exp }, { merge: true });
        walletRefs.forEach(function (ref, i) { t.set(ref, { events: caps[i].events, updatedAtMs: nowMs, expireAt: exp }, { merge: true }); });
        outcome = { ok: true };
    });
    if (outcome && outcome.reason === 'float_breaker') await alertFloat(db, admin, outcome.drop, nowMs, notify);
    if (!outcome || !outcome.ok) {
        throw guardError((outcome && outcome.error) || payoutSafety.HOLD_ERROR, (outcome && outcome.reason) || 'unknown');
    }
    return outcome;
}

module.exports = {
    MIN_PAYOUT_ACCOUNT_AGE_DAYS, USER_MAX_PAYOUTS_PER_HOUR, USER_MAX_PAYOUTS_PER_DAY,
    WALLET_DAILY_CAP_SATS, FLOAT_DROP_WINDOW_MS, FLOAT_DROP_SATS,
    USERS_COLLECTION, WALLETS_COLLECTION, FLOAT_DOC,
    ANON_ERROR, EMAIL_ERROR, PROVIDER_ERROR, RATE_ERROR, WALLET_ERROR,
    assessIdentity, assessAccountAge, ageError, planUserRate, planWalletCap, planFloat,
    GUARD_TTL_MS, SECRET_ENV, DOMAIN_ALIASES, KEY_ERROR,
    secretReady, decodeLnurl, walletFingerprint, callbackFingerprint, callbackKey, expiresAt,
    applyFloatSample, watchFloat,
    walletKey, userKey, reservePayout,
};
