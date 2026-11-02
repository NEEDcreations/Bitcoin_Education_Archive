'use strict';

// Cipher sats balance claims. Pure decisions, no Firebase.
// A faucet withdrawal clock is not an input. This module never reads or
// writes that clock, and it does not touch faucet daily or lifetime caps.
// Caps here are only the cipher claim caps and the config flag.

const { assessCipherClaim, SATS_BANNED_ERROR } = require('./cipherClaim');
const faucetGuard = require('./faucetGuard');
const { satsDisposition } = require('./cipherReward');

const CLAIM_MIN = 100;
const CLAIM_MAX = 200;
const PLAYER_DAILY_CAP = 200;
const SITE_DAILY_CAP = 2000;
// Longer than the 180s claim function so a live pay cannot be treated as abandoned.
const ABANDON_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 6;

const UNAVAILABLE = 'Cipher sats claims are unavailable right now.';
const LOW_BALANCE = 'Cipher sats balance is below the claim minimum.';
const IN_FLIGHT = 'A claim is already in progress.';
const RATE_ERROR = 'Please wait a moment and try again.';
const NEED_ADDRESS = 'Save a Lightning Address in Settings before claiming.';
const ADDRESS_UNUSABLE = 'That Lightning Address cannot be used for this claim.';
const HELD = 'Sats withdrawals are paused on this account. Try again later.';
const AUTH_ERROR = 'Must be signed in';

const USER_FIELDS = ['cipherSatsBalance'];

function nonNeg(value) {
    const n = Math.floor(Number(value) || 0);
    return n > 0 ? n : 0;
}

function fail(code, error) {
    return {
        ok: false,
        code: code,
        error: error,
        writesLastSatsClaim: false,
        touchesFaucetCaps: false,
        userFields: USER_FIELDS,
    };
}

function creditDocId(cipherId, role) {
    const id = String(cipherId || '');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return '';
    return id + '_' + (role === 'sender' ? 'sender' : 'opener');
}

// Second call for the same cipher and role does not credit again.
function applyCipherBalanceCredit(books, input) {
    const src = input || {};
    const next = {
        users: Object.assign({}, (books && books.users) || {}),
        credits: Object.assign({}, (books && books.credits) || {}),
    };
    const id = creditDocId(src.cipherId, src.role);
    if (!id) return { books: next, credited: false, reason: 'bad-id' };
    if (next.credits[id]) return { books: next, credited: false, reason: 'already' };
    const amount = Math.floor(Number(src.amount) || 0);
    if (satsDisposition(amount) !== 'balance') {
        return { books: next, credited: false, reason: satsDisposition(amount) };
    }
    const uid = String(src.uid || '');
    if (!uid) return { books: next, credited: false, reason: 'no-uid' };
    const user = Object.assign({}, next.users[uid] || {});
    user.cipherSatsBalance = nonNeg(user.cipherSatsBalance) + amount;
    next.users[uid] = user;
    next.credits[id] = { uid: uid, amount: amount, role: src.role === 'sender' ? 'sender' : 'opener' };
    return { books: next, credited: true, reason: 'ok', balance: user.cipherSatsBalance };
}

function assessLockedAddress(info) {
    const src = info || {};
    const saved = faucetGuard.normalizeLightningAddress(src.saved || '');
    if (!faucetGuard.validLightningAddress(saved)) {
        return { ok: false, code: 'no-address', error: NEED_ADDRESS };
    }
    if (src.lockExists !== true) {
        return { ok: false, code: 'unlocked', error: NEED_ADDRESS };
    }
    if (String(src.lockOwner || '') !== String(src.uid || '')) {
        return { ok: false, code: 'conflict', error: ADDRESS_UNUSABLE };
    }
    return { ok: true, address: saved, createLock: false };
}

// A missing settings doc disables claims. An existing doc disables them only
// when disabled is true.
function claimsDisabledFromConfig(exists, data) {
    if (exists !== true) return true;
    return !!(data && data.disabled === true);
}

// Pay only when this claim still owns the lock and the payout is still reserved.
function claimReadyToPay(info) {
    const src = info || {};
    const claimId = String(src.claimId || '');
    const lock = src.lock;
    const audit = src.audit;
    if (!claimId || !lock || !audit) return false;
    if (String(lock.claimId || '') !== claimId) return false;
    if (String(lock.phase || '') !== 'reserved') return false;
    if (String(audit.claimId || '') !== claimId) return false;
    if (String(audit.status || '') !== 'reserved') return false;
    if (src.uid && lock.uid && String(lock.uid) !== String(src.uid)) return false;
    return true;
}

function lockOwnedByClaim(lock, claimId) {
    const id = String(claimId || '');
    return !!(id && lock && String(lock.claimId || '') === id);
}

// Held claims (unknown/hold) can be resolved any time. A paying claim can
// be resolved only after the abandon window, so a live pay is left alone.
function adminMayResolveClaim(info) {
    const src = info || {};
    const status = String(src.status || '');
    if (status === 'unknown' || status === 'hold') return { ok: true, reason: 'held' };
    if (status === 'paying') {
        const started = Number(src.payingAtMs) || 0;
        const now = Number(src.nowMs) || 0;
        if (started > 0 && now - started >= ABANDON_MS) return { ok: true, reason: 'stale-paying' };
        return { ok: false, reason: 'paying-fresh' };
    }
    return { ok: false, reason: 'not-held' };
}

// Wallet lookup before a refund. Only an explicit failure proves it was not paid.
function adminReleaseFromLookup(kind) {
    if (kind === 'paid') return 'paid';
    if (kind === 'failed') return 'release';
    return 'refuse';
}

function assessAttemptRate(row, nowMs) {
    const start = Number(row && row.windowStartMs) || 0;
    const count = nonNeg(row && row.count);
    const now = Number(nowMs) || 0;
    if (!start || now - start >= RATE_WINDOW_MS) {
        return { ok: true, count: 1, windowStartMs: now };
    }
    if (count >= RATE_MAX) return { ok: false, count: count, windowStartMs: start };
    return { ok: true, count: count + 1, windowStartMs: start };
}

// A reserved claim that never reached the wallet can be released.
// paying and unknown stay locked so a payment cannot be sent twice.
function normalizeClaimState(input) {
    const src = input || {};
    const nowMs = Number(src.nowMs) || 0;
    const day = String(src.day || '');
    let balance = nonNeg(src.balance);
    let playerDayUsed = nonNeg(src.playerDayUsed);
    let siteDayUsed = nonNeg(src.siteDayUsed);
    const lock = src.lock && typeof src.lock === 'object' ? src.lock : null;
    let abandon = null;
    let inFlight = false;
    if (lock && lock.phase) {
        const age = nowMs - (Number(lock.startedAtMs) || 0);
        const staleReserve = lock.phase === 'reserved' && age >= ABANDON_MS;
        if (staleReserve) {
            const amt = nonNeg(lock.amount);
            balance += amt;
            if (String(lock.day || '') === day) {
                playerDayUsed = Math.max(0, playerDayUsed - amt);
                siteDayUsed = Math.max(0, siteDayUsed - amt);
            }
            abandon = {
                claimId: String(lock.claimId || ''),
                amount: amt,
                day: String(lock.day || ''),
            };
        } else {
            inFlight = true;
        }
    }
    return {
        balance: balance,
        playerDayUsed: playerDayUsed,
        siteDayUsed: siteDayUsed,
        abandon: abandon,
        inFlight: inFlight,
        nowMs: nowMs,
        day: day,
        originalBalance: nonNeg(src.balance),
    };
}

function planCipherSatsClaim(input) {
    const src = input || {};
    const norm = normalizeClaimState(src);
    if (src.claimsDisabled === true) return fail('disabled', UNAVAILABLE);
    if (src.authed !== true || src.anonymous === true) return fail('auth', AUTH_ERROR);
    const gate = assessCipherClaim({
        email: src.email,
        emailVerified: src.emailVerified === true,
        ageKnown: src.ageKnown === true,
        ageDays: src.ageDays,
        satsDisabled: src.satsDisabled === true,
        ledgerBanned: src.ledgerBanned === true,
    });
    if (!gate.ok) return fail('gate', gate.error);
    if (src.profileBanned === true) return fail('banned', SATS_BANNED_ERROR);
    if (src.satsHeld === true) return fail('held', HELD);
    const addr = assessLockedAddress(src);
    if (!addr.ok) return fail(addr.code, addr.error);
    const rate = assessAttemptRate(src.rate, norm.nowMs);
    if (!rate.ok) return fail('rate', RATE_ERROR);
    if (norm.inFlight) return fail('inflight', IN_FLIGHT);
    if (norm.balance < CLAIM_MIN) return fail('low', LOW_BALANCE);
    const playerLeft = PLAYER_DAILY_CAP - norm.playerDayUsed;
    const siteLeft = SITE_DAILY_CAP - norm.siteDayUsed;
    const amount = Math.min(norm.balance, CLAIM_MAX, playerLeft, siteLeft);
    if (!(amount >= CLAIM_MIN)) return fail('cap', UNAVAILABLE);
    const sameDayAbandon = norm.abandon && norm.abandon.day === norm.day ? norm.abandon.amount : 0;
    const otherDayAbandon = norm.abandon && norm.abandon.day !== norm.day ? norm.abandon : null;
    return {
        ok: true,
        code: 'ok',
        amount: amount,
        address: addr.address,
        balanceAfter: norm.balance - amount,
        balanceDelta: (norm.balance - amount) - norm.originalBalance,
        abandon: norm.abandon,
        playerDelta: amount - sameDayAbandon,
        siteDelta: amount - sameDayAbandon,
        otherDay: otherDayAbandon ? otherDayAbandon.day : '',
        otherDayDelta: otherDayAbandon ? -otherDayAbandon.amount : 0,
        rate: rate,
        userFields: USER_FIELDS.slice(),
        writesLastSatsClaim: false,
        touchesFaucetCaps: false,
    };
}

// The user-doc write for a cipher claim. Faucet withdrawal fields are absent.
function cipherClaimUserPatch(plan) {
    const src = plan || {};
    if (!src.ok) return {};
    return { cipherSatsBalanceDelta: src.balanceDelta };
}

// A faucet withdrawal patch must not mention the cipher balance.
function faucetPatchTouchesCipher(patch) {
    const keys = Object.keys(patch || {});
    for (let i = 0; i < keys.length; i++) {
        if (keys[i].indexOf('cipherSats') !== -1 || keys[i].indexOf('cipher_sats') !== -1) return true;
    }
    return false;
}

module.exports = {
    CLAIM_MIN: CLAIM_MIN,
    CLAIM_MAX: CLAIM_MAX,
    PLAYER_DAILY_CAP: PLAYER_DAILY_CAP,
    SITE_DAILY_CAP: SITE_DAILY_CAP,
    ABANDON_MS: ABANDON_MS,
    claimsDisabledFromConfig: claimsDisabledFromConfig,
    claimReadyToPay: claimReadyToPay,
    lockOwnedByClaim: lockOwnedByClaim,
    adminMayResolveClaim: adminMayResolveClaim,
    adminReleaseFromLookup: adminReleaseFromLookup,
    RATE_WINDOW_MS: RATE_WINDOW_MS,
    RATE_MAX: RATE_MAX,
    UNAVAILABLE: UNAVAILABLE,
    LOW_BALANCE: LOW_BALANCE,
    IN_FLIGHT: IN_FLIGHT,
    RATE_ERROR: RATE_ERROR,
    NEED_ADDRESS: NEED_ADDRESS,
    ADDRESS_UNUSABLE: ADDRESS_UNUSABLE,
    USER_FIELDS: USER_FIELDS,
    creditDocId: creditDocId,
    applyCipherBalanceCredit: applyCipherBalanceCredit,
    assessLockedAddress: assessLockedAddress,
    assessAttemptRate: assessAttemptRate,
    normalizeClaimState: normalizeClaimState,
    planCipherSatsClaim: planCipherSatsClaim,
    cipherClaimUserPatch: cipherClaimUserPatch,
    faucetPatchTouchesCipher: faucetPatchTouchesCipher,
};
