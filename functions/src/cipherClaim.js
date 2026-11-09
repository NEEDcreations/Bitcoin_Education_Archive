'use strict';

// Pure helpers for cipher-prize claims. No Firebase, so tests can run them directly.
// Mirrors the claimSats entry errors (verified email, 7-day account, satsDisabled, ledger ban).

// One payout age for every path (antiDrain.MIN_PAYOUT_ACCOUNT_AGE_DAYS, Phil to confirm 7).
const MIN_ACCOUNT_AGE_DAYS = require('./antiDrain').MIN_PAYOUT_ACCOUNT_AGE_DAYS;
const LOOKUP_ATTEMPTS = 4;
const LOOKUP_INTERVAL_MS = 20000; // 3 gaps = 60s between the first and last lookup

const EMAIL_ERROR = 'Verified email required. Link and verify your email in Account settings.';
const AGE_UNKNOWN_ERROR = 'Could not verify account age. Try again later.';
const SATS_DISABLED_ERROR = 'Sats withdrawals are disabled on this account. Contact support if you believe this is an error.';
const SATS_BANNED_ERROR = 'Sats are disabled on this account. Contact support if you believe this is an error.';

function isSatsBanned(user, ledger) {
    return !!(user && user.satsDisabled === true) || !!(ledger && ledger.banned === true);
}

// Same flags the sats payouts use, plus a profile ban_reason or banned flag.
function rewardBlocked(user, ledger) {
    const u = user || {};
    const l = ledger || {};
    if (u.ban_reason) return true;
    if (u.banned === true) return true;
    return isSatsBanned(u, l);
}

function assessCipherClaim(input) {
    const src = input || {};
    if (!src.email || src.emailVerified !== true) {
        return { ok: false, error: EMAIL_ERROR };
    }
    if (src.ageKnown !== true) {
        return { ok: false, error: AGE_UNKNOWN_ERROR };
    }
    const ageDays = Math.floor(Number(src.ageDays));
    const shown = Number.isFinite(ageDays) ? ageDays : 0;
    if (shown < MIN_ACCOUNT_AGE_DAYS) {
        return {
            ok: false,
            error: 'Account must be at least ' + MIN_ACCOUNT_AGE_DAYS + ' days old. Yours is ' + shown + ' days.',
        };
    }
    if (isSatsBanned({ satsDisabled: src.satsDisabled === true }, { banned: src.ledgerBanned === true })) {
        return { ok: false, error: SATS_DISABLED_ERROR };
    }
    return { ok: true };
}

function paymentHashFromDecoded(decoded) {
    if (!decoded || typeof decoded !== 'object') return '';
    const tags = Array.isArray(decoded.tags) ? decoded.tags : [];
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        if (!tag) continue;
        const name = tag.tagName || tag.tag;
        if (name === 'payment_hash' && tag.data) return String(tag.data);
    }
    if (decoded.paymentHash) return String(decoded.paymentHash);
    return '';
}

function lookupRequestFromDecoded(decoded) {
    const paymentHash = paymentHashFromDecoded(decoded);
    if (!paymentHash) return null;
    return { payment_hash: paymentHash };
}

// NWC error codes. A pay-phase refusal is NOT proof the payment failed:
// PAYMENT_FAILED is also returned when the wallet times out and the payment
// is still pending. Match the code field only. A message that merely contains
// one of these words is not a refusal.
const EXPLICIT_PAY_REFUSALS = ['PAYMENT_FAILED', 'INSUFFICIENT_BALANCE', 'QUOTA_EXCEEDED', 'RATE_LIMITED'];

function explicitPayRefusal(error) {
    if (!error || error.code == null || error.code === '') return false;
    const code = String(error.code).toUpperCase();
    return EXPLICIT_PAY_REFUSALS.indexOf(code) !== -1;
}

// Release only when pay_invoice was never called (balance check, wallet low).
// After pay_invoice, including PAYMENT_FAILED and timeouts, look the payment
// hash up before any refund. Confirmed failure releases. Pending or unknown holds.
function payErrorAction(info) {
    const src = info || {};
    if (src.payResult && src.payResult.preimage) return 'paid';
    if (src.phase !== 'pay') return 'release';
    return 'lookup';
}

function shouldLookupPay(info) {
    return payErrorAction(info) === 'lookup';
}

function classifyLookup(res) {
    if (!res || typeof res !== 'object') return { kind: 'unknown' };
    const meta = res.metadata && typeof res.metadata === 'object' ? res.metadata : {};
    const state = String(res.state || res.status || meta.state || meta.status || '').toLowerCase();
    const preimage = res.preimage ? String(res.preimage) : '';
    if (
        preimage || res.settled_at ||
        state === 'settled' || state === 'paid' || state === 'succeeded' ||
        state === 'success' || state === 'complete' || state === 'completed'
    ) {
        return { kind: 'paid', preimage: preimage };
    }
    // Only an explicit failed state proves nothing was paid.
    // An expired invoice can still settle after expiry, so it is not a failure.
    if (state === 'failed') return { kind: 'failed' };
    if (state === 'pending' || state === 'in_flight' || state === 'inflight' || state === 'processing') {
        return { kind: 'pending' };
    }
    // NIP-47 returns the invoice with no preimage while it is still unpaid.
    if (res.payment_hash || res.invoice || res.amount != null) return { kind: 'pending' };
    return { kind: 'unknown' };
}

// steps: { kind: 'paid'|'failed'|'pending'|'unknown'|'error', preimage? }
// paid → mark paid. An explicit failed lookup → release back to claimable.
// Errors (NOT_FOUND, timeouts), empty results, and anything unclassified hold
// as status 'unknown' and keep the invoice reservation.
function decideAfterLookups(steps) {
    const list = Array.isArray(steps) ? steps : [];
    for (let i = 0; i < list.length; i++) {
        if (list[i].kind === 'paid') return { action: 'paid', preimage: list[i].preimage || '' };
        if (list[i].kind === 'failed') return { action: 'release' };
    }
    return { action: 'hold' };
}

async function lookupSettlement(opts) {
    const src = opts || {};
    const lookup = src.lookup;
    const sleep = src.sleep;
    const attempts = src.attempts || LOOKUP_ATTEMPTS;
    const intervalMs = src.intervalMs != null ? src.intervalMs : LOOKUP_INTERVAL_MS;
    const steps = [];
    for (let i = 0; i < attempts; i++) {
        if (i > 0 && typeof sleep === 'function') await sleep(intervalMs);
        try {
            const raw = await lookup();
            const classified = classifyLookup(raw);
            steps.push(classified);
            if (classified.kind === 'paid' || classified.kind === 'failed') break;
        } catch (e) {
            steps.push({ kind: 'error' });
        }
    }
    return decideAfterLookups(steps);
}

function adminClaimFlag(win, user, ledger) {
    const satsDisabled = !!(user && user.satsDisabled === true);
    const banned = !!(ledger && ledger.banned === true);
    const claimBlocked = satsDisabled || banned;
    let claimBlockReason = '';
    if (satsDisabled && banned) claimBlockReason = 'sats_disabled_and_banned';
    else if (satsDisabled) claimBlockReason = 'sats_disabled';
    else if (banned) claimBlockReason = 'banned';
    const amount = win && Number(win.amount) ? Number(win.amount) : 0;
    return {
        claimBlocked: claimBlocked,
        claimBlockReason: claimBlockReason,
        flagForAdmin: claimBlocked && amount >= 1000,
    };
}

module.exports = {
    MIN_ACCOUNT_AGE_DAYS: MIN_ACCOUNT_AGE_DAYS,
    LOOKUP_ATTEMPTS: LOOKUP_ATTEMPTS,
    LOOKUP_INTERVAL_MS: LOOKUP_INTERVAL_MS,
    EMAIL_ERROR: EMAIL_ERROR,
    AGE_UNKNOWN_ERROR: AGE_UNKNOWN_ERROR,
    SATS_DISABLED_ERROR: SATS_DISABLED_ERROR,
    SATS_BANNED_ERROR: SATS_BANNED_ERROR,
    isSatsBanned: isSatsBanned,
    rewardBlocked: rewardBlocked,
    assessCipherClaim: assessCipherClaim,
    paymentHashFromDecoded: paymentHashFromDecoded,
    lookupRequestFromDecoded: lookupRequestFromDecoded,
    EXPLICIT_PAY_REFUSALS: EXPLICIT_PAY_REFUSALS,
    explicitPayRefusal: explicitPayRefusal,
    payErrorAction: payErrorAction,
    shouldLookupPay: shouldLookupPay,
    classifyLookup: classifyLookup,
    decideAfterLookups: decideAfterLookups,
    lookupSettlement: lookupSettlement,
    adminClaimFlag: adminClaimFlag,
};
