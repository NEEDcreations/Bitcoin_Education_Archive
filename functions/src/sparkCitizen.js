'use strict';

// Spark Citizen 5-tier badges (Citadel Spark launch).
// Credit is one teaser completion per offset day. The client may name the
// phase (start or complete) and nothing else: elapsed time, the day, and
// the count come from the server clock. A complete is accepted only when a
// start was recorded at least TEASER_MIN_MS and at most TEASER_MAX_MS earlier.
// The in-app teaser is 18.005s; 17s is the floor so a short buffer is allowed,
// and 2 minutes is the ceiling so a stale start cannot be completed later.

const { offsetDateKey } = require('./offsetDay');

const TEASER_DURATION_MS = 18005;
const TEASER_MIN_MS = 17000;
const TEASER_MAX_MS = 2 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 8;

function creditMillis(value) {
    if (value == null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value.toMillis === 'function') {
        const ms = value.toMillis();
        return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
    }
    if (typeof value === 'object' && typeof value._seconds === 'number') {
        const nanos = typeof value._nanoseconds === 'number' ? value._nanoseconds : 0;
        return value._seconds * 1000 + Math.floor(nanos / 1e6);
    }
    return null;
}

function nextRate(prev, nowMs) {
    const start = creditMillis(prev && prev.windowStartMs);
    const count = Math.max(0, Math.floor(Number(prev && prev.count) || 0));
    if (start == null || nowMs - start >= RATE_WINDOW_MS) {
        return { ok: true, windowStartMs: nowMs, count: 1 };
    }
    if (count >= RATE_MAX) return { ok: false, windowStartMs: start, count: count };
    return { ok: true, windowStartMs: start, count: count + 1 };
}

function applyStart(state, nowMs) {
    const banned = !!(state && state.banned);
    if (banned) return { ok: false, reason: 'banned', credit: 0, state: state || {} };
    return {
        ok: true,
        reason: 'started',
        credit: 0,
        state: { startAtMs: nowMs, creditDay: (state && state.creditDay) || '' },
    };
}

function applyComplete(state, nowMs) {
    const banned = !!(state && state.banned);
    if (banned) return { ok: false, reason: 'banned', credit: 0, state: state || {} };
    const startAtMs = creditMillis(state && state.startAtMs);
    if (startAtMs == null) return { ok: true, reason: 'no-start', credit: 0, state: state || {} };
    const elapsed = nowMs - startAtMs;
    const creditDay = (state && state.creditDay) || '';
    const day = offsetDateKey(nowMs);
    if (elapsed < TEASER_MIN_MS) {
        return { ok: true, reason: 'too-fast', credit: 0, state: state };
    }
    if (elapsed > TEASER_MAX_MS) {
        return { ok: true, reason: 'clock', credit: 0, state: { startAtMs: null, creditDay: creditDay } };
    }
    if (creditDay === day) {
        return { ok: true, reason: 'day-cap', credit: 0, state: { startAtMs: null, creditDay: day } };
    }
    return {
        ok: true,
        reason: 'ok',
        credit: 1,
        day: day,
        state: { startAtMs: null, creditDay: day },
    };
}

module.exports = {
    TEASER_DURATION_MS: TEASER_DURATION_MS,
    TEASER_MIN_MS: TEASER_MIN_MS,
    TEASER_MAX_MS: TEASER_MAX_MS,
    RATE_WINDOW_MS: RATE_WINDOW_MS,
    RATE_MAX: RATE_MAX,
    offsetDateKey: offsetDateKey,
    creditMillis: creditMillis,
    nextRate: nextRate,
    applyStart: applyStart,
    applyComplete: applyComplete,
};
