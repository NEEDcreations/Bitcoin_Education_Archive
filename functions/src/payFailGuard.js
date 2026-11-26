'use strict';

// Released payout failures. Pure rules, no Firebase, so tests can run them directly.
//
// A claim whose Lightning payment definitely failed (nothing was sent) gets its
// daily claim back, after a short wait. The server decides this from the wallet
// result inside the claim function. No client field can ask for it.
//
// Limits, per claim path (faucet and cipher sats keep separate rows):
// - at most MAX_RELEASES recipient-side ('theirs') released failures per uid
//   in a rolling 24 hours, and the same per Lightning address
// - failures on our side ('ours': our node unreachable or low before the send,
//   or our wallet refusing with its own limit code) always release and never count
// - a failure whose side is not certain counts as 'theirs'
// - after any release, the uid and the address both wait RETRY_WAIT_MS
// Past the cap, a failure still refunds what was reserved, but the normal
// daily limit stays used. An unknown or pending payment is never released here.

const crypto = require('crypto');

const RETRY_WAIT_MS = 10 * 60 * 1000;
const MAX_RELEASES = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000;

const RELEASED_MESSAGE = 'Your wallet couldn\'t receive the payment. No sats were sent. You can try again in 10 minutes.';
const OUR_SIDE_MESSAGE = 'The payment wallet is not responding. No sats were sent. You can try again in 10 minutes.';
const RECEIVER_UNRESPONSIVE_MESSAGE = 'Your wallet\'s address didn\'t respond. No sats were sent. You can try again in 10 minutes.';
const UNCONFIRMED_MESSAGE = 'The payment didn\'t go through and your balance is back. The wallet couldn\'t confirm the failure, so the normal daily limit still applies.';
const CAPPED_MESSAGE = 'Payment failed. No sats were sent. There have been too many failed attempts today, so the normal daily limit applies.';

function _row(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    return {
        at: Array.isArray(src.at) ? src.at : [],
        retryAfterMs: Number(src.retryAfterMs) || 0,
    };
}

function pruneReleases(list, nowMs) {
    const now = Number(nowMs) || 0;
    const out = [];
    const src = Array.isArray(list) ? list : [];
    for (let i = 0; i < src.length; i++) {
        const ts = Number(src[i]) || 0;
        if (ts > 0 && now - ts < WINDOW_MS && ts <= now + 60000) out.push(ts);
    }
    return out.sort(function(a, b) { return a - b; });
}

function waitMessage(minutes) {
    const m = Math.max(1, Math.ceil(Number(minutes) || 1));
    return 'Your last payment failed and no sats were sent. You can try again in ' + m + ' minute' + (m === 1 ? '' : 's') + '.';
}

// Called inside the claim transaction, before anything is reserved.
// uidRow and addrRow are the stored guard rows (or undefined).
function assessRetryWait(uidRow, addrRow, nowMs) {
    const now = Number(nowMs) || 0;
    const until = Math.max(_row(uidRow).retryAfterMs, _row(addrRow).retryAfterMs);
    if (until > now) {
        return { ok: false, retryAfterMs: until, error: waitMessage((until - now) / 60000) };
    }
    return { ok: true };
}

// Called inside the release transaction, only after the wallet result says
// nothing was sent. kind: 'refused' (the wallet refused or the receiver failed)
// or 'ours' (our node was unreachable or low before any send).
// Returns release: true when the daily claim goes back, plus the new rows.
// 'ours' and 'theirs' are confirmed failures (nothing can settle).
// 'unconfirmed' is an explicit refusal the wallet lookup could not confirm:
// refund only, the daily limit stays used, nothing is counted.
function reasonClass(kind) {
    if (kind === 'ours') return 'ours';
    if (kind === 'unconfirmed') return 'unconfirmed';
    return 'theirs';
}

function planRelease(input) {
    const src = input || {};
    const now = Number(src.nowMs) || 0;
    const reason = reasonClass(src.kind);
    const uidAt = pruneReleases(_row(src.uidRow).at, now);
    const addrAt = pruneReleases(_row(src.addrRow).at, now);
    const retryAfterMs = now + RETRY_WAIT_MS;
    if (reason === 'unconfirmed') {
        return {
            release: false,
            reasonClass: reason,
            uidRow: { at: uidAt, retryAfterMs: _row(src.uidRow).retryAfterMs },
            addrRow: { at: addrAt, retryAfterMs: _row(src.addrRow).retryAfterMs },
            message: UNCONFIRMED_MESSAGE,
        };
    }
    if (reason === 'ours') {
        // Our wallet or node failed. The player did nothing wrong, so it never counts.
        return {
            release: true,
            reasonClass: reason,
            retryAfterMs: retryAfterMs,
            uidRow: { at: uidAt, retryAfterMs: Math.max(retryAfterMs, _row(src.uidRow).retryAfterMs) },
            addrRow: { at: addrAt, retryAfterMs: Math.max(retryAfterMs, _row(src.addrRow).retryAfterMs) },
            message: OUR_SIDE_MESSAGE,
        };
    }
    const capped = uidAt.length >= MAX_RELEASES || addrAt.length >= MAX_RELEASES;
    if (capped) {
        return {
            release: false,
            reasonClass: reason,
            uidRow: { at: uidAt, retryAfterMs: _row(src.uidRow).retryAfterMs },
            addrRow: { at: addrAt, retryAfterMs: _row(src.addrRow).retryAfterMs },
            message: CAPPED_MESSAGE,
        };
    }
    return {
        release: true,
        reasonClass: reason,
        retryAfterMs: retryAfterMs,
        uidRow: { at: uidAt.concat([now]), retryAfterMs: retryAfterMs },
        addrRow: { at: addrAt.concat([now]), retryAfterMs: retryAfterMs },
        message: RELEASED_MESSAGE,
    };
}

// One audit row per processed definite failure. Never the raw uid or address.
const AUDIT_COLLECTION = 'payout_fail_releases';

function maskUid(uid) {
    return require('./favorBlockClaims').maskUid(uid);
}

function uidHash(uid) {
    const u = String(uid || '');
    return u ? crypto.createHash('sha256').update('payfail:' + u).digest('hex').slice(0, 24) : '';
}

function addressHash(address) {
    const a = String(address || '').trim().toLowerCase();
    return a ? crypto.createHash('sha256').update('payfail-addr:' + a).digest('hex').slice(0, 24) : '';
}

function auditEntry(input) {
    const src = input || {};
    const plan = src.plan || {};
    return {
        path: String(src.path || ''),
        claimId: String(src.claimId || '').slice(0, 64),
        uidMasked: maskUid(src.uid),
        uidHash: uidHash(src.uid),
        addressHash: addressHash(src.address),
        reasonClass: plan.reasonClass || reasonClass(src.kind),
        released: plan.release === true,
        uidCount: plan.uidRow && Array.isArray(plan.uidRow.at) ? plan.uidRow.at.length : 0,
        addrCount: plan.addrRow && Array.isArray(plan.addrRow.at) ? plan.addrRow.at.length : 0,
        retryAfterMs: plan.release ? (Number(plan.retryAfterMs) || 0) : 0,
        createdAtMs: Number(src.nowMs) || 0,
    };
}

module.exports = {
    RETRY_WAIT_MS: RETRY_WAIT_MS,
    MAX_RELEASES: MAX_RELEASES,
    WINDOW_MS: WINDOW_MS,
    RELEASED_MESSAGE: RELEASED_MESSAGE,
    OUR_SIDE_MESSAGE: OUR_SIDE_MESSAGE,
    CAPPED_MESSAGE: CAPPED_MESSAGE,
    RECEIVER_UNRESPONSIVE_MESSAGE: RECEIVER_UNRESPONSIVE_MESSAGE,
    UNCONFIRMED_MESSAGE: UNCONFIRMED_MESSAGE,
    pruneReleases: pruneReleases,
    waitMessage: waitMessage,
    assessRetryWait: assessRetryWait,
    planRelease: planRelease,
    reasonClass: reasonClass,
    AUDIT_COLLECTION: AUDIT_COLLECTION,
    maskUid: maskUid,
    uidHash: uidHash,
    addressHash: addressHash,
    auditEntry: auditEntry,
};
