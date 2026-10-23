'use strict';

// One shared daily XP cap for every grant path.
// Each path reads users/{uid}/daily_points/{offsetDay}.total inside the same
// transaction that writes it. The offset day starts at 5 AM UTC.
// Full XP until 600 used that day, then floor(half) until 1,000, then 0.
// Nothing is written to pendingOverflow. One-time backfills do not call this.

const DAILY_CAP = 1000;
const TAPER_FULL_UNTIL = 600;
// Older imports used this name for a 500 cap. It is the shared 1,000 cap now.
const DAILY_POINTS_CAP = DAILY_CAP;

function taperAward(want, used, fullUntil, cap) {
    const amount = Math.max(0, Math.floor(Number(want) || 0));
    const cursor0 = Math.max(0, Math.floor(Number(used) || 0));
    const fullEnd = fullUntil == null ? TAPER_FULL_UNTIL : fullUntil;
    const ceiling = cap == null ? DAILY_CAP : cap;
    if (amount <= 0 || cursor0 >= ceiling) {
        return { awarded: 0, dailyXp: Math.min(cursor0, ceiling) };
    }
    let awarded = 0;
    let cursor = cursor0;
    let left = amount;
    if (cursor < fullEnd) {
        const fullRoom = Math.min(left, fullEnd - cursor);
        awarded += fullRoom;
        cursor += fullRoom;
        left -= fullRoom;
    }
    if (left > 0 && cursor < ceiling) {
        const half = Math.floor(left / 2);
        const take = Math.min(half, ceiling - cursor);
        awarded += take;
        cursor += take;
    }
    return { awarded: awarded, dailyXp: cursor };
}

function planDailyXp(dailyUsed, pts) {
    const used = Math.max(0, Number(dailyUsed) || 0);
    const tapered = taperAward(pts, used, TAPER_FULL_UNTIL, DAILY_CAP);
    const want = Math.max(0, Number(pts) || 0);
    return {
        awarded: tapered.awarded,
        overflowAdded: 0,
        capped: used + tapered.awarded >= DAILY_CAP,
        pastCap: used >= DAILY_CAP,
        dailyXp: tapered.dailyXp,
        dailyCap: DAILY_CAP,
        fullUntil: TAPER_FULL_UNTIL,
        dropped: Math.max(0, want - tapered.awarded),
    };
}

// The cap argument is ignored. Every caller shares the 600 / 1,000 taper.
function splitDailyXp(dailyUsed, pts, cap) {
    void cap;
    const plan = planDailyXp(dailyUsed, pts);
    return {
        awarded: plan.awarded,
        overflowAdded: 0,
        capped: plan.capped,
    };
}

module.exports = {
    DAILY_CAP: DAILY_CAP,
    DAILY_POINTS_CAP: DAILY_POINTS_CAP,
    TAPER_FULL_UNTIL: TAPER_FULL_UNTIL,
    taperAward: taperAward,
    planDailyXp: planDailyXp,
    splitDailyXp: splitDailyXp,
};
