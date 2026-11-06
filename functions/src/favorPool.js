'use strict';

// Pure Satoshi's Favor pool math. awardBadge applies one point inside its
// badge transaction. This does not touch Firestore.

const FAVOR_DURATION_MINUTES = 60;
const BONUS_MINUTES_PER_POINT = 3;
const POINTS_TO_ACTIVATE = 21;
const MAX_BONUS_MINUTES = 180;
const MAX_POINTS = 42;

function millisOf(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value.toMillis === 'function') {
        const ms = value.toMillis();
        return Number.isFinite(ms) ? ms : 0;
    }
    if (typeof value === 'object') {
        if (typeof value.seconds === 'number') return value.seconds * 1000;
        if (typeof value._seconds === 'number') return value._seconds * 1000;
        if (typeof value._ms === 'number') return value._ms;
    }
    return 0;
}

function planFavorPoints(state, nowMs, pointsToAdd) {
    const add = Math.max(0, Math.floor(Number(pointsToAdd) || 0));
    const now = Number(nowMs);
    const at = Number.isFinite(now) ? now : Date.now();
    const src = state && typeof state === 'object' ? state : {};
    let points = Number(src.points) || 0;
    let favorActive = src.favorActive === true;
    let bonusMinutes = Number(src.bonusMinutes) || 0;
    let favorStart = src.favorStart || null;
    let favorEndBase = src.favorEndBase || null;
    const expired = favorActive && at > (millisOf(favorEndBase) + bonusMinutes * 60 * 1000);

    if (expired) {
        points = 0;
        favorActive = false;
        bonusMinutes = 0;
        favorStart = null;
        favorEndBase = null;
    }

    if (favorActive) {
        return {
            expired: expired,
            extended: true,
            activated: false,
            points: points,
            favorActive: true,
            bonusMinutes: Math.min(bonusMinutes + (BONUS_MINUTES_PER_POINT * add), MAX_BONUS_MINUTES),
            favorStart: favorStart,
            favorEndBase: favorEndBase,
            currentCycleId: src.currentCycleId || null,
            eraHashes: src.eraHashes || 0,
        };
    }

    points = Math.min(points + add, MAX_POINTS);
    if (points >= POINTS_TO_ACTIVATE) {
        const overflow = points - POINTS_TO_ACTIVATE;
        return {
            expired: expired,
            extended: false,
            activated: true,
            points: points,
            favorActive: true,
            bonusMinutes: Math.min(overflow * BONUS_MINUTES_PER_POINT, MAX_BONUS_MINUTES),
            favorStartMs: at,
            favorEndBaseMs: at + FAVOR_DURATION_MINUTES * 60 * 1000,
            currentCycleId: 'cycle_' + at,
            eraHashes: src.eraHashes || 0,
        };
    }

    return {
        expired: expired,
        extended: false,
        activated: false,
        points: points,
        favorActive: false,
        bonusMinutes: 0,
        favorStart: null,
        favorEndBase: null,
        currentCycleId: src.currentCycleId || null,
        eraHashes: src.eraHashes || 0,
    };
}

function planFavorPoint(state, nowMs) {
    return planFavorPoints(state, nowMs, 1);
}

module.exports = {
    FAVOR_DURATION_MINUTES: FAVOR_DURATION_MINUTES,
    BONUS_MINUTES_PER_POINT: BONUS_MINUTES_PER_POINT,
    POINTS_TO_ACTIVATE: POINTS_TO_ACTIVATE,
    MAX_BONUS_MINUTES: MAX_BONUS_MINUTES,
    MAX_POINTS: MAX_POINTS,
    millisOf: millisOf,
    planFavorPoint: planFavorPoint,
    planFavorPoints: planFavorPoints,
};
