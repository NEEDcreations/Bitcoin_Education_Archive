'use strict';

// Released payout failures. Pure rules, no Firebase, so tests can run them directly.
//
// A claim whose Lightning payment definitely failed (nothing was sent) gets its
// daily claim back, after a short wait. The server decides this from the wallet
// result inside the claim function. No client field can ask for it.
//
// Limits, per claim path (faucet and cipher sats keep separate rows):
// - at most MAX_RELEASES released failures per uid in a rolling 24 hours
// - at most MAX_RELEASES released failures per Lightning address in a rolling 24 hours
// - after a release, the uid and the address both wait RETRY_WAIT_MS
// Past the cap, a failure still refunds what was reserved, but the normal
// daily limit stays used. An unknown or pending payment is never released here.

const RETRY_WAIT_MS = 10 * 60 * 1000;
const MAX_RELEASES = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000;

const RELEASED_MESSAGE = 'Your wallet couldn\'t receive the payment. No sats were sent. You can try again in 10 minutes.';
const OUR_SIDE_MESSAGE = 'The payment wallet is not responding. No sats were sent. You can try again in 10 minutes.';
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
function planRelease(input) {
    const src = input || {};
    const now = Number(src.nowMs) || 0;
    const uidAt = pruneReleases(_row(src.uidRow).at, now);
    const addrAt = pruneReleases(_row(src.addrRow).at, now);
    const capped = uidAt.length >= MAX_RELEASES || addrAt.length >= MAX_RELEASES;
    if (capped) {
        return {
            release: false,
            uidRow: { at: uidAt, retryAfterMs: _row(src.uidRow).retryAfterMs },
            addrRow: { at: addrAt, retryAfterMs: _row(src.addrRow).retryAfterMs },
            message: CAPPED_MESSAGE,
        };
    }
    const retryAfterMs = now + RETRY_WAIT_MS;
    return {
        release: true,
        retryAfterMs: retryAfterMs,
        uidRow: { at: uidAt.concat([now]), retryAfterMs: retryAfterMs },
        addrRow: { at: addrAt.concat([now]), retryAfterMs: retryAfterMs },
        message: src.kind === 'ours' ? OUR_SIDE_MESSAGE : RELEASED_MESSAGE,
    };
}

module.exports = {
    RETRY_WAIT_MS: RETRY_WAIT_MS,
    MAX_RELEASES: MAX_RELEASES,
    WINDOW_MS: WINDOW_MS,
    RELEASED_MESSAGE: RELEASED_MESSAGE,
    OUR_SIDE_MESSAGE: OUR_SIDE_MESSAGE,
    CAPPED_MESSAGE: CAPPED_MESSAGE,
    pruneReleases: pruneReleases,
    waitMessage: waitMessage,
    assessRetryWait: assessRetryWait,
    planRelease: planRelease,
};
