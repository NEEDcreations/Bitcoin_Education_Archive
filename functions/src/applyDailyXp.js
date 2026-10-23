'use strict';

// One function for badge XP. awardBadge calls this and does not keep a
// second cap. PR #68 replaces the body with the shared taper: full XP
// through 600, half from 600 to 1,000, then 0, and nothing banked.
//
// Default until that rebase: the live hard cap of 1,000 on
// users/{uid}/daily_points/{day}. XP that does not fit is returned as
// overflowAdded so the caller holds it on pendingOverflow. It is not
// thrown away. This function does not taper.
//
// { bypass: true } grants the full amount and does not read or write the
// daily counter. The badge XP backfill passes that.

const { splitDailyXp } = require('./dailyXp');

const DAILY_XP_CAP = 1000;

async function applyDailyXp(uid, amount, tx, opts) {
    const options = opts || {};
    const want = Math.max(0, Number(amount) || 0);
    if (options.bypass === true) {
        return {
            awarded: want,
            overflowAdded: 0,
            capped: false,
            bypass: true,
            dailyUsed: null,
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
    const split = splitDailyXp(dailyUsed, want, DAILY_XP_CAP);
    return {
        awarded: split.awarded,
        overflowAdded: split.overflowAdded,
        capped: !!split.capped,
        bypass: false,
        dailyUsed: dailyUsed,
        dailyRef: dailyRef,
    };
}

module.exports = {
    applyDailyXp: applyDailyXp,
    DAILY_XP_CAP: DAILY_XP_CAP,
};
