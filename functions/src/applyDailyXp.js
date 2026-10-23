'use strict';

// One daily counter: users/{uid}/daily_points/{day}.total.
// Full XP until that total is 500, then floor(half) until 900, then
// floor(quarter) until 1,000, then 0. An award that crosses a tier is
// split, and each tier floors on its own. The rest is dropped.
// This module never writes pendingOverflow.
//
// applyDailyXp(uid, amount, tx, opts) is the hook other grants call inside
// their transaction. Badge grants use the same hook. The taper itself is
// dailyXp.planDailyXp.
// { bypass: true } grants the full amount and does not read or write the
// daily counter. One-time backfills, including the badge XP backfill, pass that.

const { planDailyXp, DAILY_CAP, TAPER_FULL_UNTIL, TAPER_HALF_UNTIL } = require('./dailyXp');

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

async function applyDailyXp(uid, amount, tx, opts) {
    void uid;
    const options = opts || {};
    const want = Math.max(0, Number(amount) || 0);
    if (options.bypass === true) {
        return {
            awarded: want,
            overflowAdded: 0,
            dropped: 0,
            capped: false,
            bypass: true,
            dailyUsed: null,
            dailyXp: null,
            dailyRef: null,
        };
    }
    const day = options.day;
    const userRef = options.userRef;
    if (!tx || !userRef || !day) {
        throw new Error('applyDailyXp needs a transaction, userRef, and day');
    }
    const dailyRef = userRef.collection('daily_points').doc(day);
    const dailySnap = await tx.get(dailyRef);
    const dailyUsed = dailySnap && dailySnap.exists ? Number((dailySnap.data() || {}).total || 0) : 0;
    const plan = planDailyXp(dailyUsed, want);
    return {
        awarded: plan.awarded,
        overflowAdded: 0,
        dropped: plan.dropped,
        capped: !!plan.capped,
        bypass: false,
        dailyUsed: dailyUsed,
        dailyXp: plan.dailyXp,
        dailyRef: dailyRef,
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
