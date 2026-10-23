'use strict';

// Badge XP uses one daily counter: users/{uid}/daily_points/{day}.total.
// Full XP until that total is 600, then floor(half) until 1,000, then 0.
// The rest is dropped. This module never writes pendingOverflow.
//
// PR #68 (cursor/trivia-xp-taper-b25b) owns the shared helper
// dailyXp.planDailyXp. When that export is present, this calls it.
// Until then the same taper lives here so the swap does not change the grant.
//
// { bypass: true } grants the full amount and does not read or write the
// daily counter. The badge XP backfill passes that.

const dailyXp = require('./dailyXp');

const DAILY_XP_CAP = 1000;
const TAPER_FULL_UNTIL = 600;

function taperDailyXp(want, used) {
    const amount = Math.max(0, Math.floor(Number(want) || 0));
    const cursor0 = Math.max(0, Math.floor(Number(used) || 0));
    if (amount <= 0 || cursor0 >= DAILY_XP_CAP) {
        return {
            awarded: 0,
            dailyXp: Math.min(cursor0, DAILY_XP_CAP),
            dropped: Math.max(0, Number(want) || 0),
        };
    }
    let awarded = 0;
    let cursor = cursor0;
    let left = amount;
    if (cursor < TAPER_FULL_UNTIL) {
        const fullRoom = Math.min(left, TAPER_FULL_UNTIL - cursor);
        awarded += fullRoom;
        cursor += fullRoom;
        left -= fullRoom;
    }
    if (left > 0 && cursor < DAILY_XP_CAP) {
        const half = Math.floor(left / 2);
        const take = Math.min(half, DAILY_XP_CAP - cursor);
        awarded += take;
        cursor += take;
    }
    return {
        awarded: awarded,
        dailyXp: cursor,
        dropped: Math.max(0, (Number(want) || 0) - awarded),
    };
}

function planBadgeDailyXp(dailyUsed, pts) {
    if (typeof dailyXp.planDailyXp === 'function') return dailyXp.planDailyXp(dailyUsed, pts);
    const tapered = taperDailyXp(pts, dailyUsed);
    const used = Math.max(0, Number(dailyUsed) || 0);
    return {
        awarded: tapered.awarded,
        overflowAdded: 0,
        capped: used + tapered.awarded >= DAILY_XP_CAP,
        pastCap: used >= DAILY_XP_CAP,
        dailyXp: tapered.dailyXp,
        dailyCap: DAILY_XP_CAP,
        fullUntil: TAPER_FULL_UNTIL,
        dropped: tapered.dropped,
    };
}

async function applyDailyXp(uid, amount, tx, opts) {
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
    const plan = planBadgeDailyXp(dailyUsed, want);
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
};
