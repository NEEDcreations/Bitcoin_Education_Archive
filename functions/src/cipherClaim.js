'use strict';

// Pure helpers for cipher-prize claims. No Firebase, so tests can run them directly.
// Mirrors the claimSats entry errors (verified email, 7-day account, satsDisabled, ledger ban).

const MIN_ACCOUNT_AGE_DAYS = 7;
const LOOKUP_ATTEMPTS = 4;
const LOOKUP_INTERVAL_MS = 20000; // 3 gaps = 60s between the first and last lookup

const EMAIL_ERROR = 'Verified email required. Link and verify your email in Account settings.';
const AGE_UNKNOWN_ERROR = 'Could not verify account age. Try again later.';
const SATS_DISABLED_ERROR = 'Sats withdrawals are disabled on this account. Contact support if you believe this is an error.';

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
    if (src.satsDisabled === true || src.ledgerBanned === true) {
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

// A payInvoice timeout, or a result with no preimage, may still have settled.
// Balance-check failures happen before any payment and must not be looked up.
function shouldLookupPay(info) {
    const src = info || {};
    if (src.phase !== 'pay') return false;
    if (src.payResult && src.payResult.preimage) return false;
    if (!src.error) return true;
    const msg = String(src.error.message || src.error);
    return msg.indexOf('[TIMEOUT]') === 0 || msg === 'NO_PREIMAGE';
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
    if (
        state === 'failed' || state === 'failure' || state === 'expired' ||
        state === 'cancelled' || state === 'canceled'
    ) {
        return { kind: 'failed' };
    }
    if (state === 'pending' || state === 'in_flight' || state === 'inflight' || state === 'processing') {
        return { kind: 'pending' };
    }
    // NIP-47 returns the invoice with no preimage while it is still unpaid.
    if (res.payment_hash || res.invoice || res.amount != null) return { kind: 'pending' };
    return { kind: 'unknown' };
}

// steps: { kind: 'paid'|'failed'|'pending'|'unknown'|'error', preimage? }
// paid → mark paid. failed, or unknown with no preimage after the retries → release.
// still pending → hold as status 'unknown' and keep the invoice reservation.
function decideAfterLookups(steps) {
    const list = Array.isArray(steps) ? steps : [];
    for (let i = 0; i < list.length; i++) {
        if (list[i].kind === 'paid') return { action: 'paid', preimage: list[i].preimage || '' };
        if (list[i].kind === 'failed') return { action: 'release' };
    }
    let lastNonError = null;
    for (let i = 0; i < list.length; i++) {
        if (list[i].kind !== 'error') lastNonError = list[i];
    }
    if (lastNonError && lastNonError.kind === 'pending') return { action: 'hold' };
    return { action: 'release' };
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
    assessCipherClaim: assessCipherClaim,
    paymentHashFromDecoded: paymentHashFromDecoded,
    lookupRequestFromDecoded: lookupRequestFromDecoded,
    shouldLookupPay: shouldLookupPay,
    classifyLookup: classifyLookup,
    decideAfterLookups: decideAfterLookups,
    lookupSettlement: lookupSettlement,
    adminClaimFlag: adminClaimFlag,
};
