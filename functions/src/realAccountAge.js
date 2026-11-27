'use strict';

// Claims age-gate hardening (Nov 27 2026).
//
// Sats claims need an account that is at least 7 days old. The age now starts
// at the later of Auth metadata.creationTime and users.realAccountAt.
// realAccountAt is server-only. reconcileEmail stamps it once, when the first
// verified email or first real sign-in provider reaches the profile:
//   - account under 24h old at that moment: realAccountAt = creationTime
//     (a normal signup is not delayed);
//   - older account (for example a guest that was upgraded later):
//     realAccountAt = that moment, so the 7 days start then.
// Existing accounts: a profile that was already synced (emailHash or
// providersHash present) before this shipped has no realAccountAt and keeps
// creationTime, so no existing player is locked out. A profile that is still
// unsynced at deploy time is covered by scripts/backfill-real-account-at.js
// (dry run by default), run right before the deploy.
// Deleted-account (tombstone) age is never credited here. Tombstones still
// carry bans, caps and cooldowns.

const DAY_MS = 86400000;
const FRESH_SIGNUP_MS = 24 * 60 * 60 * 1000;

function millisOf(value) {
    if (!value) return 0;
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    return 0;
}

function createdMsOf(authUser) {
    const raw = authUser && authUser.metadata && authUser.metadata.creationTime;
    if (!raw) return NaN;
    const ms = new Date(raw).getTime();
    return Number.isFinite(ms) ? ms : NaN;
}

// True when the profile was synced before realAccountAt existed.
function legacySynced(user) {
    const u = user || {};
    return !!(u.emailHash || u.providersHash);
}

// Value to stamp when the first real identity reaches the profile, or null.
// Call this only when the first verified email or first provider set is being
// written. Unknown creation time is treated as an old account (stamp now).
function stampFor(user, authUser, nowMs) {
    const u = user || {};
    if (millisOf(u.realAccountAt) > 0) return null;
    if (legacySynced(u)) return null;
    const now = Number(nowMs) || Date.now();
    const created = createdMsOf(authUser);
    if (Number.isFinite(created) && created <= now && now - created < FRESH_SIGNUP_MS) return created;
    return now;
}

// When the 7-day clock starts. known=false only when Auth has no usable
// creation time (callers refuse the claim then).
function startMs(authUser, user) {
    const created = createdMsOf(authUser);
    if (!Number.isFinite(created)) return { known: false, ms: NaN };
    const u = user || {};
    const real = millisOf(u.realAccountAt);
    if (real > 0) return { known: true, ms: Math.max(created, real), linked: real > created };
    if (legacySynced(u)) return { known: true, ms: created, linked: false };
    // Never synced: no verified email or provider reached the profile yet.
    // Not eligible until reconcileEmail stamps it.
    return { known: true, ms: Infinity, linked: true };
}

function ageFrom(authUser, user, nowMs) {
    const start = startMs(authUser, user);
    if (!start.known) return { ageKnown: false, ageDays: 0, ageSource: 'unknown' };
    const source = start.linked ? 'linked' : 'created';
    if (start.ms === Infinity) return { ageKnown: true, ageDays: 0, ageSource: source };
    const now = Number(nowMs) || Date.now();
    return { ageKnown: true, ageDays: Math.max(0, Math.floor((now - start.ms) / DAY_MS)), ageSource: source };
}

// Refusal text for a too-young account. When the clock started at the first
// email or sign-in link, say so, so the number matches what the player sees.
function tooYoungMessage(minDays, ageDays, ageSource) {
    const shown = Number.isFinite(Number(ageDays)) ? Math.floor(Number(ageDays)) : 0;
    if (ageSource === 'linked') {
        return 'Sats claims open ' + minDays + ' days after you linked your email or sign-in. It has been ' + shown + ' days.';
    }
    return 'Account must be at least ' + minDays + ' days old. Yours is ' + shown + ' days.';
}

module.exports = {
    DAY_MS: DAY_MS,
    FRESH_SIGNUP_MS: FRESH_SIGNUP_MS,
    millisOf: millisOf,
    createdMsOf: createdMsOf,
    legacySynced: legacySynced,
    stampFor: stampFor,
    startMs: startMs,
    ageFrom: ageFrom,
    tooYoungMessage: tooYoungMessage,
};
