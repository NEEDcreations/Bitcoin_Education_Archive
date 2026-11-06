'use strict';

// Server-side 2× XP window. The client is hostile, so the multiplier is
// applied here on the base award. doubleXpUntil is epoch milliseconds.

const DOUBLE_XP_MS = 60 * 60 * 1000;

function untilMillis(user) {
    if (!user) return 0;
    const raw = user.doubleXpUntil != null ? user.doubleXpUntil : user.doubleXPExpiry;
    return coerceMillis(raw);
}

function coerceMillis(raw) {
    if (raw == null || raw === '') return 0;
    if (typeof raw === 'number' && isFinite(raw)) return raw;
    if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
    if (typeof raw.toMillis === 'function') {
        const ms = raw.toMillis();
        return typeof ms === 'number' && isFinite(ms) ? ms : 0;
    }
    if (typeof raw === 'object') {
        if (typeof raw.seconds === 'number') return raw.seconds * 1000 + Math.floor((raw.nanoseconds || 0) / 1e6);
        if (typeof raw._seconds === 'number') return raw._seconds * 1000;
    }
    return 0;
}

function isActive(user, nowMs) {
    const until = untilMillis(user);
    const now = Number(nowMs) || 0;
    return until > now;
}

// Base points in, doubled points out while the window is still open.
// A zero or negative base is never doubled. Expiry at exactly `now` is over.
function boostPoints(base, user, nowMs) {
    const amount = Math.floor(Number(base) || 0);
    const until = untilMillis(user);
    const now = Number(nowMs) || 0;
    if (amount <= 0 || !(until > now)) {
        return { points: Math.max(0, amount), doubled: false, until: until };
    }
    return { points: amount * 2, doubled: true, until: until };
}

// Buying while a window is open adds an hour to the end. A fresh or expired
// window starts at `now`. This is the extend behavior (not a hard block).
function extendUntil(existing, nowMs, addMs) {
    const now = Number(nowMs) || 0;
    const extra = Math.max(0, Math.floor(Number(addMs) || 0));
    const current = coerceMillis(existing);
    const base = current > now ? current : now;
    return base + extra;
}

function minutesLeft(until, nowMs) {
    const now = Number(nowMs) || 0;
    const end = coerceMillis(until);
    if (!(end > now)) return 0;
    return Math.ceil((end - now) / 60000);
}

module.exports = {
    DOUBLE_XP_MS: DOUBLE_XP_MS,
    untilMillis: untilMillis,
    coerceMillis: coerceMillis,
    isActive: isActive,
    boostPoints: boostPoints,
    extendUntil: extendUntil,
    minutesLeft: minutesLeft,
};
