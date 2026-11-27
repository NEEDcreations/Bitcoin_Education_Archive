'use strict';

// Claims age-gate hardening (Nov 27 2026).
//
// Sats claims need an account that is at least 7 days old. The age now starts
// at the later of Auth metadata.creationTime and users.realAccountAt.
// realAccountAt is server-only. reconcileEmail stamps it once, when the first
// verified email or first real sign-in provider reaches the profile:
//   - Auth created before REAL_ACCOUNT_CUTOFF_MS: realAccountAt = creationTime
//     (every pre-cutoff account, including guests), except accounts listed in
//     config/ageGateHeld, which are stamped now so the 7 days start then;
//   - after the cutoff, account under 24h old: realAccountAt = creationTime
//     (a normal signup is not delayed);
//   - after the cutoff, older account: realAccountAt = that moment, so the
//     7 days start then.
// A held account with no realAccountAt does not fall back to creationTime,
// even after a payout-hold lift, and even after the player links email or a
// sign-in provider (the check is uid-based). The backfill
// functions/scripts/backfill-real-account-at.js (dry run by default) writes
// creationTime for pre-cutoff non-held profiles that are still unstamped.
// The cutoff is compared to Auth metadata.creationTime only, never to
// realAccountAt or client-written profile fields.
// Deleted-account (tombstone) age is never credited here. Tombstones still
// carry bans, caps and cooldowns.

const ageGateHeld = require('./ageGateHeld');

const DAY_MS = 86400000;
const FRESH_SIGNUP_MS = 24 * 60 * 60 * 1000;
const REAL_ACCOUNT_CUTOFF_MS = ageGateHeld.REAL_ACCOUNT_CUTOFF_MS;

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

function isPreCutoff(createdMs) {
    return Number.isFinite(createdMs) && createdMs < ageGateHeld.cutoffMs();
}

// True when the profile was synced before realAccountAt existed.
function legacySynced(user) {
    const u = user || {};
    return !!(u.emailHash || u.providersHash);
}

function isHeld(authUser, held) {
    return ageGateHeld.isHeldUid(authUser && authUser.uid, held);
}

// Value to stamp when the first real identity reaches the profile, or null.
// Call this only when the first verified email or first provider set is being
// written. Never re-stamps. Held uids are always stamped now, including after
// a later payout-hold lift. Unknown creation time is treated as an old
// post-cutoff account (stamp now). `held` is the snapshot from loadHeld.
function stampFor(user, authUser, nowMs, held) {
    const u = user || {};
    if (millisOf(u.realAccountAt) > 0) return null;
    const now = Number(nowMs) || Date.now();
    if (isHeld(authUser, held)) return now;
    const created = createdMsOf(authUser);
    if (isPreCutoff(created)) return created;
    if (legacySynced(u)) return null;
    if (Number.isFinite(created) && created <= now && now - created < FRESH_SIGNUP_MS) return created;
    return now;
}

// When the 7-day clock starts. known=false only when Auth has no usable
// creation time (callers refuse the claim then).
function startMs(authUser, user, held) {
    const created = createdMsOf(authUser);
    if (!Number.isFinite(created)) return { known: false, ms: NaN };
    const u = user || {};
    const real = millisOf(u.realAccountAt);
    if (real > 0) return { known: true, ms: Math.max(created, real), linked: real > created };
    // Held and unstamped: no legacySynced fallback to creationTime.
    if (isHeld(authUser, held)) {
        return { known: true, ms: Infinity, linked: true };
    }
    // Pre-cutoff, not held: credit original join even before the field is written.
    if (isPreCutoff(created)) return { known: true, ms: created, linked: false };
    if (legacySynced(u)) return { known: true, ms: created, linked: false };
    // Post-cutoff, never synced: not eligible until reconcileEmail stamps it.
    return { known: true, ms: Infinity, linked: true };
}

function ageFrom(authUser, user, nowMs, held) {
    const start = startMs(authUser, user, held);
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
    REAL_ACCOUNT_CUTOFF_MS: REAL_ACCOUNT_CUTOFF_MS,
    millisOf: millisOf,
    createdMsOf: createdMsOf,
    isPreCutoff: isPreCutoff,
    isHeld: isHeld,
    legacySynced: legacySynced,
    stampFor: stampFor,
    startMs: startMs,
    ageFrom: ageFrom,
    tooYoungMessage: tooYoungMessage,
    cutoffMs: ageGateHeld.cutoffMs,
};
