'use strict';

// Payout safety follow-up to #273 (Security Team, Nov 9 2026).
//
// 1. Every fee_over_cap flag (routing fee paid > fee charged) alerts Phil
//    in-app through satsReviewAlert.notifyAdminClaim, the same path the
//    sats review holds use.
// 2. Two fee_over_cap flags inside 1 hour set the global satsHold on
//    payout_safety/hold. Every Lightning payout (claimSats, claimCipherSats,
//    claimCipherWin) refuses to pay while it is set.
// 3. Overpaid fees on cipher payouts (claimCipherSats + claimCipherWin) above
//    500 sats in a rolling 24h set cipherHold. Cipher payouts refuse while it
//    is set; the faucet keeps paying.
//
// Holds do not clear on their own in practice (HOLD_MS is 30 days). Phil
// clears them in the Firebase console: payout_safety/hold, set satsHold
// and/or cipherHold to 0. Server-only; clients cannot write payout_safety
// (firestore.rules: admin read, no client writes).

const FEE_FLAG_WINDOW_MS = 60 * 60 * 1000;
const FEE_FLAG_LIMIT = 2;
const CIPHER_OVERPAID_WINDOW_MS = 24 * 60 * 60 * 1000;
const CIPHER_OVERPAID_LIMIT_SATS = 500;
const HOLD_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_EVENTS = 200;
const CIPHER_PATHS = ['claimCipherSats', 'claimCipherWin'];
const PAYOUT_PATHS = ['claimSats', 'claimCipherSats', 'claimCipherWin'];

const HOLD_COLLECTION = 'payout_safety';
const HOLD_DOC = 'hold';
const FEE_WATCH_DOC = 'fee_watch';
const AUDIT_COLLECTION = 'payout_safety_audit';

const HOLD_ERROR = 'Sats payouts are paused right now. Try again later.';

class PayoutHoldError extends Error {
    constructor(message, reason) {
        super(message || HOLD_ERROR);
        this.code = 'PAYOUT_GUARD';
        this.userMessage = message || HOLD_ERROR;
        this.reason = reason || 'hold';
    }
}

function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function isCipherPath(path) {
    return CIPHER_PATHS.indexOf(String(path || '')) !== -1;
}

// Pure. hold = payout_safety/hold data (or null). Returns { ok, error, reason }.
function assessHold(hold, path, nowMs) {
    const h = hold || {};
    const now = num(nowMs);
    if (num(h.satsHold) > now) {
        return { ok: false, error: HOLD_ERROR, reason: 'satsHold' };
    }
    if (isCipherPath(path) && num(h.cipherHold) > now) {
        return { ok: false, error: HOLD_ERROR, reason: 'cipherHold' };
    }
    return { ok: true };
}

function overpaidSats(charged, feePaid) {
    const paid = Math.floor(num(feePaid));
    const c = Math.floor(num(charged));
    return Math.max(0, paid - c);
}

// Pure. Adds one fee_over_cap event and decides which holds to set.
// state = payout_safety/fee_watch data, hold = payout_safety/hold data.
function planFeeEvent(state, hold, event, nowMs) {
    const now = num(nowMs);
    const ev = event || {};
    const path = String(ev.path || 'unknown').slice(0, 40);
    const charged = Math.floor(num(ev.charged));
    const feePaid = Math.floor(num(ev.feePaid));
    const entry = {
        ms: now,
        path: path,
        charged: charged,
        feePaid: feePaid,
        overpaid: overpaidSats(charged, feePaid),
    };
    const prior = Array.isArray(state && state.events) ? state.events : [];
    const keepAfter = now - Math.max(FEE_FLAG_WINDOW_MS, CIPHER_OVERPAID_WINDOW_MS);
    const events = prior
        .filter(function (e) { return e && num(e.ms) > keepAfter && num(e.ms) <= now; })
        .concat([entry])
        .slice(-MAX_EVENTS);
    const hourCount = events.filter(function (e) { return num(e.ms) > now - FEE_FLAG_WINDOW_MS; }).length;
    const cipherOverpaid24h = events
        .filter(function (e) { return isCipherPath(e.path) && num(e.ms) > now - CIPHER_OVERPAID_WINDOW_MS; })
        .reduce(function (sum, e) { return sum + Math.max(0, Math.floor(num(e.overpaid))); }, 0);
    const h = hold || {};
    const satsHeld = num(h.satsHold) > now;
    const cipherHeld = num(h.cipherHold) > now;
    const setSatsHold = !satsHeld && hourCount >= FEE_FLAG_LIMIT;
    const setCipherHold = !cipherHeld && cipherOverpaid24h > CIPHER_OVERPAID_LIMIT_SATS;
    return {
        entry: entry,
        events: events,
        hourCount: hourCount,
        cipherOverpaid24h: cipherOverpaid24h,
        setSatsHold: setSatsHold,
        setCipherHold: setCipherHold,
        holdUntil: now + HOLD_MS,
    };
}

function alertText(plan) {
    const e = plan.entry;
    let msg = 'Lightning fee over cap on ' + e.path + ': paid ' + e.feePaid + ' sats, charged ' + e.charged + '.';
    if (plan.setSatsHold) msg += ' 2 in 1h: ALL sats payouts paused (satsHold).';
    if (plan.setCipherHold) msg += ' Cipher overpaid ' + plan.cipherOverpaid24h + ' sats/24h: cipher payouts paused.';
    return msg.slice(0, 180);
}

// Records the event, sets holds, alerts admins. Never throws: the payment
// already left the wallet, so the caller must still finish its bookkeeping.
async function recordFeeOverCap(db, admin, event, deps) {
    const d = deps || {};
    const nowMs = typeof d.nowMs === 'number' ? d.nowMs : Date.now();
    const notify = d.notify || require('./satsReviewAlert').notifyAdminClaim;
    let plan = null;
    try {
        const watchRef = db.collection(HOLD_COLLECTION).doc(FEE_WATCH_DOC);
        const holdRef = db.collection(HOLD_COLLECTION).doc(HOLD_DOC);
        await db.runTransaction(async function (t) {
            const watchSnap = await t.get(watchRef);
            const holdSnap = await t.get(holdRef);
            plan = planFeeEvent(
                watchSnap.exists ? watchSnap.data() : null,
                holdSnap.exists ? holdSnap.data() : null,
                event,
                nowMs
            );
            t.set(watchRef, { events: plan.events, updatedAtMs: nowMs }, { merge: true });
            const patch = {};
            if (plan.setSatsHold) {
                patch.satsHold = plan.holdUntil;
                patch.satsHoldReason = 'fee_over_cap x' + plan.hourCount + ' in 1h';
                patch.satsHoldSetAtMs = nowMs;
            }
            if (plan.setCipherHold) {
                patch.cipherHold = plan.holdUntil;
                patch.cipherHoldReason = 'cipher overpaid fees ' + plan.cipherOverpaid24h + ' sats in 24h';
                patch.cipherHoldSetAtMs = nowMs;
            }
            if (Object.keys(patch).length) {
                t.set(holdRef, patch, { merge: true });
                t.set(db.collection(AUDIT_COLLECTION).doc(), Object.assign({ action: 'auto_hold', atMs: nowMs }, patch));
            }
        });
    } catch (e) {
        console.error('[payoutSafety] fee watch failed:', e.message);
    }
    try {
        const p = plan || planFeeEvent(null, null, event, nowMs);
        await notify(db, admin, {
            docId: 'fee_over_cap_' + nowMs,
            message: alertText(p),
            targetId: 'fee_over_cap',
        });
    } catch (e) {
        console.error('[payoutSafety] fee alert failed:', e.message);
    }
    return plan;
}

// Read the hold doc. Throws PayoutHoldError when this path is held.
// Fails closed: a read error also refuses the payout.
async function assertPayoutsOpen(db, path, nowMs) {
    let hold = null;
    try {
        const snap = await db.collection(HOLD_COLLECTION).doc(HOLD_DOC).get();
        hold = snap.exists ? snap.data() : null;
    } catch (e) {
        throw new PayoutHoldError(HOLD_ERROR, 'hold_unreadable');
    }
    const res = assessHold(hold, path, typeof nowMs === 'number' ? nowMs : Date.now());
    if (!res.ok) throw new PayoutHoldError(res.error, res.reason);
    return true;
}

module.exports = {
    FEE_FLAG_WINDOW_MS, FEE_FLAG_LIMIT, CIPHER_OVERPAID_WINDOW_MS, CIPHER_OVERPAID_LIMIT_SATS,
    HOLD_MS, CIPHER_PATHS, PAYOUT_PATHS, HOLD_COLLECTION, HOLD_DOC, FEE_WATCH_DOC, AUDIT_COLLECTION,
    HOLD_ERROR, PayoutHoldError,
    isCipherPath, assessHold, overpaidSats, planFeeEvent, alertText,
    recordFeeOverCap, assertPayoutsOpen,
};
