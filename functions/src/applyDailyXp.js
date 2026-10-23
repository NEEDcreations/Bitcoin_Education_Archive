'use strict';

// Shared daily XP hook. awardBadge and the per-action grants call this.
// Signature stays (uid, amount, tx, opts) so PR #68 can keep calling it.
//
// One 1,000/day cap on users/{uid}/daily_points/{day}. Full XP until the
// day's awarded total reaches 600, half rate from 600 to 1,000, then 0.
// XP that does not fit is dropped. overflowAdded is always 0. Nothing is
// written to pendingOverflow.
//
// { bypass: true } grants the full amount and does not read or write the
// daily counter. The badge XP backfill passes that.

const DAILY_XP_CAP = 1000;
const FULL_UNTIL = 600;

function taperDailyXp(dailyUsed, amount, cap) {
    const limit = cap == null ? DAILY_XP_CAP : cap;
    const fullUntil = Math.min(FULL_UNTIL, limit);
    let used = Math.max(0, Number(dailyUsed) || 0);
    let left = Math.max(0, Math.floor(Number(amount) || 0));
    const requested = left;
    let awarded = 0;
    if (used < fullUntil && left > 0) {
        const take = Math.min(left, fullUntil - used);
        awarded += take;
        left -= take;
        used += take;
    }
    if (used < limit && left > 0) {
        const room = limit - used;
        const take = Math.min(room, Math.floor(left / 2));
        awarded += take;
        used += take;
    }
    return {
        awarded: awarded,
        overflowAdded: 0,
        capped: awarded < requested || used >= limit,
    };
}

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
    const split = taperDailyXp(dailyUsed, want, DAILY_XP_CAP);
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
    taperDailyXp: taperDailyXp,
    DAILY_XP_CAP: DAILY_XP_CAP,
    FULL_UNTIL: FULL_UNTIL,
};
