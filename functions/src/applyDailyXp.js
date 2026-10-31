'use strict';

// One daily counter: users/{uid}/daily_points/{day}.total.
// Full XP until that total is 500, then floor(half) until 900, then
// floor(quarter) until 1,000, then 0. An award that crosses a tier is
// split, and each tier floors on its own. The rest is dropped.
// This module never writes pendingOverflow.
//
// applyDailyXp(uid, amount, tx, opts) is the hook other grants call inside
// their transaction. The amount is the base XP. planXpGrant doubles it once
// while the server Double XP window is open, then the taper runs on the
// doubled amount. That is the same order key sends and tips use.
// Pass opts.user when the profile was already read. Otherwise the user doc
// is read here, before any write this function performs (it does not write).
// { bypass: true } is a historical backfill: the full base is granted, the
// daily counter is not touched, and the window is not applied.
// { boost: false } skips the window without skipping the taper.
// kind other than 'xp' is not doubled and is not tapered.

const { planDailyXp, DAILY_CAP, TAPER_FULL_UNTIL, TAPER_HALF_UNTIL } = require('./dailyXp');
const { planXpGrant } = require('./grantXp');

const DAILY_XP_CAP = DAILY_CAP;

function taperDailyXp(want, used) {
    const plan = planDailyXp(used, want);
    return {
        awarded: plan.awarded,
        dailyXp: plan.dailyXp,
        dropped: plan.dropped,
    };
}

function planBadgeDailyXp(dailyUsed, pts) {
    return planDailyXp(dailyUsed, pts);
}

function emptyBypass(want) {
    return {
        awarded: want,
        base: want,
        boosted: want,
        doubled: false,
        multiplier: 1,
        until: 0,
        overflowAdded: 0,
        dropped: 0,
        capped: false,
        bypass: true,
        capExempt: true,
        dailyUsed: null,
        dailyXp: null,
        dailyRef: null,
        replay: false,
    };
}

async function applyDailyXp(uid, amount, tx, opts) {
    void uid;
    const options = opts || {};
    const want = Math.max(0, Number(amount) || 0);
    if (options.kind && options.kind !== 'xp') {
        const plain = planXpGrant({
            kind: options.kind,
            base: want,
            now: options.now,
        });
        return {
            awarded: plain.awarded,
            base: plain.base,
            boosted: plain.boosted,
            doubled: false,
            multiplier: 1,
            until: 0,
            overflowAdded: 0,
            dropped: 0,
            capped: false,
            bypass: false,
            dailyUsed: null,
            dailyXp: null,
            dailyRef: null,
            replay: false,
        };
    }
    if (options.bypass === true) {
        return emptyBypass(want);
    }
    const day = options.day;
    const userRef = options.userRef;
    if (!tx || !userRef || !day) {
        throw new Error('applyDailyXp needs a transaction, userRef, and day');
    }
    const dailyRef = userRef.collection('daily_points').doc(day);
    const dailySnap = await tx.get(dailyRef);
    let user = options.user || null;
    if (!user && options.boost !== false) {
        const userSnap = await tx.get(userRef);
        if (userSnap && userSnap.exists && typeof userSnap.data === 'function') user = userSnap.data() || {};
    }
    const dailyUsed = dailySnap && dailySnap.exists ? Number((dailySnap.data() || {}).total || 0) : 0;
    const plan = planXpGrant({
        base: want,
        user: user,
        now: options.now,
        dailyUsed: dailyUsed,
        alreadyBoosted: options.alreadyBoosted === true,
        boosted: options.boosted,
        doubled: options.doubled,
        until: options.until,
        boost: options.boost !== false,
        kind: 'xp',
    });
    return {
        awarded: plan.awarded,
        base: plan.base,
        boosted: plan.boosted,
        doubled: plan.doubled,
        multiplier: plan.multiplier,
        until: plan.until,
        overflowAdded: 0,
        dropped: plan.dropped,
        capped: !!plan.capped,
        pastCap: plan.pastCap,
        bypass: false,
        capExempt: false,
        dailyUsed: dailyUsed,
        dailyXp: plan.dailyXp,
        dailyCap: plan.dailyCap,
        fullUntil: plan.fullUntil,
        halfUntil: plan.halfUntil,
        dailyRef: dailyRef,
        replay: false,
    };
}

module.exports = {
    applyDailyXp: applyDailyXp,
    taperDailyXp: taperDailyXp,
    planBadgeDailyXp: planBadgeDailyXp,
    DAILY_XP_CAP: DAILY_XP_CAP,
    TAPER_FULL_UNTIL: TAPER_FULL_UNTIL,
    TAPER_HALF_UNTIL: TAPER_HALF_UNTIL,
};
