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
//   2. account age: MIN_PAYOUT_ACCOUNT_AGE_DAYS (PHIL: confirm 7).
//   3. per-user rate limit across all three paths (PHIL: confirm 3/h, 6/24h).
//   4. per-wallet cap: sats to one Lightning address in a rolling 24h across
//      every account and path (PHIL: confirm 2,500).
//   5. float circuit breaker: if the wallet balance fell more than
//      FLOAT_DROP_SATS below its peak inside FLOAT_DROP_WINDOW_MS, set the
//      global satsHold (payout_safety/hold, see payoutSafety.js) and stop.
//      (PHIL: confirm 5,000 sats / 1h.)
//
// Pure planners are exported for tests. reservePayout runs them in one
// Firestore transaction right before pay_invoice.

const crypto = require('crypto');
const payoutSafety = require('./payoutSafety');

// ---- Config (flagged for Phil) ----
const MIN_PAYOUT_ACCOUNT_AGE_DAYS = 7;
const USER_MAX_PAYOUTS_PER_HOUR = 3;
const USER_MAX_PAYOUTS_PER_DAY = 6;
const WALLET_DAILY_CAP_SATS = 2500;
const FLOAT_DROP_WINDOW_MS = 60 * 60 * 1000;
const FLOAT_DROP_SATS = 5000;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_SAMPLES = 120;

const USERS_COLLECTION = 'payout_guard_users';
const WALLETS_COLLECTION = 'payout_guard_wallets';
const FLOAT_DOC = 'float';

const ANON_ERROR = 'Sign in with a real account to withdraw sats.';
const EMAIL_ERROR = 'Verified email required. Link and verify your email in Account settings.';
const PROVIDER_ERROR = 'Link a sign-in method to your account before withdrawing sats.';
const RATE_ERROR = 'Too many withdrawals for now. Try again in a little while.';
const WALLET_ERROR = 'That Lightning address has reached its daily limit. Try again tomorrow.';

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

function walletKey(address) {
    const a = String(address || '').trim().toLowerCase();
    if (!a) return '';
    return crypto.createHash('sha256').update('bq-wallet:' + a).digest('hex').slice(0, 40);
}

function userKey(uid) {
    return String(uid || '').replace(/\//g, '_').slice(0, 200);
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
    const uKey = userKey(src.uid);
    const wKey = walletKey(src.address);
    if (!uKey) throw guardError(RATE_ERROR, 'no_uid');
    if (!wKey) throw guardError(WALLET_ERROR, 'no_address');
    const userRef = db.collection(USERS_COLLECTION).doc(uKey);
    const walletRef = db.collection(WALLETS_COLLECTION).doc(wKey);
    const floatRef = db.collection(payoutSafety.HOLD_COLLECTION).doc(FLOAT_DOC);
    const holdRef = db.collection(payoutSafety.HOLD_COLLECTION).doc(payoutSafety.HOLD_DOC);
    let outcome = null;
    await db.runTransaction(async function (t) {
        outcome = null;
        const userSnap = await t.get(userRef);
        const walletSnap = await t.get(walletRef);
        const floatSnap = await t.get(floatRef);
        const holdSnap = await t.get(holdRef);
        const hold = holdSnap.exists ? holdSnap.data() : null;
        const held = payoutSafety.assessHold(hold, src.path, nowMs);
        if (!held.ok) { outcome = { ok: false, error: held.error, reason: held.reason }; return; }
        const fl = planFloat(floatSnap.exists ? floatSnap.data() : null, src.walletSats, nowMs);
        if (fl.trip) {
            const until = nowMs + payoutSafety.HOLD_MS;
            const patch = {
                satsHold: until,
                satsHoldReason: 'float dropped ' + fl.drop + ' sats in ' + Math.round(FLOAT_DROP_WINDOW_MS / 60000) + ' min',
                satsHoldSetAtMs: nowMs,
            };
            t.set(floatRef, { samples: fl.samples, updatedAtMs: nowMs }, { merge: true });
            t.set(holdRef, patch, { merge: true });
            t.set(db.collection(payoutSafety.AUDIT_COLLECTION).doc(), Object.assign({ action: 'auto_hold', source: 'float_breaker', peak: fl.peak, balance: Math.floor(num(src.walletSats)), atMs: nowMs }, patch));
            outcome = { ok: false, error: payoutSafety.HOLD_ERROR, reason: 'float_breaker', drop: fl.drop };
            return;
        }
        const rate = planUserRate(userSnap.exists ? userSnap.data() : null, src.path, nowMs);
        if (!rate.ok) { outcome = rate; t.set(floatRef, { samples: fl.samples, updatedAtMs: nowMs }, { merge: true }); return; }
        const cap = planWalletCap(walletSnap.exists ? walletSnap.data() : null, src.sats, src.path, nowMs);
        if (!cap.ok) { outcome = cap; t.set(floatRef, { samples: fl.samples, updatedAtMs: nowMs }, { merge: true }); return; }
        t.set(floatRef, { samples: fl.samples, updatedAtMs: nowMs }, { merge: true });
        t.set(userRef, { events: rate.events, updatedAtMs: nowMs }, { merge: true });
        t.set(walletRef, { events: cap.events, updatedAtMs: nowMs }, { merge: true });
        outcome = { ok: true };
    });
    if (outcome && outcome.reason === 'float_breaker') {
        try {
            await notify(db, admin, {
                docId: 'float_breaker_' + nowMs,
                message: ('Payout float dropped ' + outcome.drop + ' sats within ' + Math.round(FLOAT_DROP_WINDOW_MS / 60000) + ' min. ALL sats payouts paused (satsHold).').slice(0, 180),
                targetId: 'float_breaker',
            });
        } catch (e) {
            console.error('[antiDrain] float alert failed:', e.message);
        }
    }
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
    walletKey, userKey, reservePayout,
};
