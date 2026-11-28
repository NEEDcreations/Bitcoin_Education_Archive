'use strict';

// Sats require a confirmed 18+ answer (Phil, Nov 28 2026). One shared check for
// every payout path: claimSats, claimFavorBlock, claimCipherWin, claimCipherSats.
//
// "Confirmed" means the fields the confirmAge18 callable sets on the user doc:
// over18 / ageConfirmed18 (the same test confirmAge18.alreadyConfirmed uses).
// Those fields are server-only, so a client cannot fake them.
//
// docs/AGE-CONFIRM-RUNBOOK.md says nothing about sats for an under-18 player
// who has guardian OK, so the rule is the safe one: under 18 (with or without
// guardianOk) earns no sats. A guardian OK lets them keep playing, nothing more.
// Anyone who unconfirmed by an admin (ageConfirmBlocked) also stays blocked.
// Kids / Classroom accounts never earn sats here.
//
// Earned sats are never removed. Balances (cipherSatsBalance, claimable XP)
// keep accruing; only the withdrawal / payout step is refused.

const kidsAccount = require('../kids-account');

const CODE = 'age_18_required';
const REASON = Object.freeze({
    UNCONFIRMED: 'unconfirmed',
    UNDER18: 'under18',
    BLOCKED: 'blocked',
    KIDS: 'kids',
});
const MESSAGE = "Confirm you're 18+ to earn sats.";
const MESSAGE_UNDER18 = 'Sats are for players 18 and older.';
const MESSAGE_BLOCKED = 'Your age confirmation needs a review. Contact support to earn sats.';

function isConfirmed(user) {
    const u = user || {};
    return u.over18 === true || u.ageConfirmed18 === true;
}

// Returns { ok: true } or { ok: false, code, reason, error, canConfirm }.
// A missing or unreadable user doc fails closed as unconfirmed.
function assess(user) {
    const u = (user && typeof user === 'object') ? user : null;
    if (!u) {
        return { ok: false, code: CODE, reason: REASON.UNCONFIRMED, error: MESSAGE, canConfirm: true };
    }
    if (u.ageConfirmBlocked === true) {
        return { ok: false, code: CODE, reason: REASON.BLOCKED, error: MESSAGE_BLOCKED, canConfirm: false };
    }
    if (kidsAccount.isKidsAccount(u)) {
        return { ok: false, code: CODE, reason: REASON.KIDS, error: MESSAGE_UNDER18, canConfirm: false };
    }
    // A saved under-18 answer wins over any confirm flag, so conflicting data fails closed.
    if (u.ageUnder18 === true) {
        return { ok: false, code: CODE, reason: REASON.UNDER18, error: MESSAGE_UNDER18, canConfirm: false };
    }
    if (!isConfirmed(u)) {
        return { ok: false, code: CODE, reason: REASON.UNCONFIRMED, error: MESSAGE, canConfirm: true };
    }
    return { ok: true };
}

// Shape for callables that return { success: false, error } instead of throwing.
function responseFor(verdict) {
    return { success: false, code: CODE, reason: verdict.reason, error: verdict.error };
}

// HttpsError for callables that throw. The client reads details.code.
function errorFor(HttpsError, verdict) {
    return new HttpsError('failed-precondition', verdict.error, { code: CODE, reason: verdict.reason });
}

module.exports = {
    CODE: CODE,
    REASON: REASON,
    MESSAGE: MESSAGE,
    MESSAGE_UNDER18: MESSAGE_UNDER18,
    MESSAGE_BLOCKED: MESSAGE_BLOCKED,
    isConfirmed: isConfirmed,
    assess: assess,
    responseFor: responseFor,
    errorFor: errorFor,
};
