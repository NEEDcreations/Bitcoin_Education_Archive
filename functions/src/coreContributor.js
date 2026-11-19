'use strict';

// Core Contributor display rules. The title is earned by 7 NY-calendar-day
// daily spins in one BIP Breakthrough week (dailySpin). That write sets
// coreContributorUntil to now + 7 days. An expired title needs another week.
//
// Display (for every viewer) requires:
//   1. coreContributorUntil still in the future (the 7-spin entitlement window)
//   2. the owner has not turned Show Core Contributor off
//
// The weekly bipBreakthroughStreak counter resets every Monday, so it is not
// used as a live display gate. Requiring it would hide a still-valid 7-day
// title at week rollover. The 7-spin streak is enforced at grant time.

const TITLE_ID = 'core_contributor';
const STREAK_TARGET = 7;
const TITLE_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function toMs(v) {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v instanceof Date) return v.getTime();
    if (typeof v._seconds === 'number') return v._seconds * 1000;
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    return 0;
}

function titleActive(user, nowMs) {
    return toMs(user && user.coreContributorUntil) > (Number(nowMs) || Date.now());
}

function showPrefOn(user) {
    return !user || user.showCoreContributor !== false;
}

function isVisible(user, nowMs) {
    return titleActive(user, nowMs) && showPrefOn(user);
}

module.exports = {
    TITLE_ID: TITLE_ID,
    STREAK_TARGET: STREAK_TARGET,
    TITLE_DAYS_MS: TITLE_DAYS_MS,
    toMs: toMs,
    titleActive: titleActive,
    showPrefOn: showPrefOn,
    isVisible: isVisible,
};
