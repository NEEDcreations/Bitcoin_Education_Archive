'use strict';

// Quiz and trivia rewards use this cap: 500 points on the offset-day
// daily_points doc. gradeQuest is the main grading path and already used 500.
// awardPoints keeps a separate 1,000 cap for other actions.
// Points past the cap go to pendingOverflow instead of the balance.

const DAILY_POINTS_CAP = 500;

function splitDailyXp(dailyUsed, pts, cap) {
    const limit = cap == null ? DAILY_POINTS_CAP : cap;
    const used = Number(dailyUsed) || 0;
    const amount = Number(pts) || 0;
    let awarded = 0;
    let overflowAdded = 0;
    if (amount > 0) {
        if (used < limit) {
            awarded = amount;
            if (used + amount > limit) {
                awarded = limit - used;
                overflowAdded = amount - awarded;
            }
            if (awarded < 0) awarded = 0;
        } else {
            overflowAdded = amount;
        }
    }
    return {
        awarded: awarded,
        overflowAdded: overflowAdded,
        capped: used + awarded >= limit,
    };
}

module.exports = {
    DAILY_POINTS_CAP: DAILY_POINTS_CAP,
    splitDailyXp: splitDailyXp,
};
