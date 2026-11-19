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
const DAY_MS = 24 * 60 * 60 * 1000;

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

function dayFloorUtc(ms) {
    const n = toMs(ms);
    if (!n) return 0;
    return Math.floor(n / DAY_MS) * DAY_MS;
}

function heldBadgeSet(user) {
    const set = Object.create(null);
    if (!user) return set;
    ['visibleBadges', 'hiddenBadges', 'bipBadges'].forEach(function (key) {
        const list = user[key];
        if (!Array.isArray(list)) return;
        list.forEach(function (id) {
            if (id) set[String(id)] = true;
        });
    });
    return set;
}

function earnedDisplayId(user, rawId, titleIds) {
    const id = String(rawId || '');
    if (!id) return '';
    if (titleIds && titleIds[id]) return '';
    return heldBadgeSet(user)[id] ? id : '';
}

function decoratePublicProfile(pub, user, nowMs, titleIds) {
    const out = pub || {};
    const src = user || {};
    delete out.showCoreContributor;
    delete out.coreContributorUntil;
    ['displayBadge', 'equippedBadge'].forEach(function (key) {
        if (!(key in out) && !(key in src)) return;
        const earned = earnedDisplayId(src, out[key] || src[key], titleIds);
        if (earned) out[key] = earned;
        else delete out[key];
    });
    if (isVisible(src, nowMs)) {
        out.coreContributorVisible = true;
        const day = dayFloorUtc(src.coreContributorUntil);
        if (day) out.coreContributorUntilDay = day;
    } else {
        delete out.coreContributorVisible;
        delete out.coreContributorUntilDay;
        if (out.activeTitle === TITLE_ID) delete out.activeTitle;
    }
    return out;
}

module.exports = {
    TITLE_ID: TITLE_ID,
    STREAK_TARGET: STREAK_TARGET,
    TITLE_DAYS_MS: TITLE_DAYS_MS,
    DAY_MS: DAY_MS,
    toMs: toMs,
    titleActive: titleActive,
    showPrefOn: showPrefOn,
    isVisible: isVisible,
    dayFloorUtc: dayFloorUtc,
    heldBadgeSet: heldBadgeSet,
    earnedDisplayId: earnedDisplayId,
    decoratePublicProfile: decoratePublicProfile,
};
