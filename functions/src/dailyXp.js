'use strict';

// One shared daily XP cap for every grant path.
// Each path reads users/{uid}/daily_points/{offsetDay}.total inside the same
// transaction that writes it. The offset day starts at 5 AM UTC.
// Nothing is written to pendingOverflow. One-time backfills do not call this.
//
// Credited XP, not raw XP, picks the rate. The tiers are half-open:
//   [0, 500)     full      divisor 1    credit = raw
//   [500, 900)   half      divisor 2    credit = floor(raw / 2)
//   [900, 1000)  quarter   divisor 4    credit = floor(raw / 4)
//   [1000, ∞)    nothing
// So a day can reach exactly 500 at full rate, exactly 900 at half rate,
// and exactly 1,000 at quarter rate. At 500 the next raw point is half.
// At 900 the next raw point is a quarter. At 1,000 nothing more is credited.
//
// Rounding is floor per tier. An award that crosses a boundary is split.
// Raw needed to fill the current tier is room * divisor. That raw is
// consumed, the tier's credit room is added, and the leftover raw starts
// the next tier and is floored there on its own. If the raw cannot fill
// the tier, credit is floor(raw / divisor) and raw % divisor is dropped.
// That remainder is not carried into the next tier.
//
// Raw XP from zero, and the credit it buys:
//   500 raw  →  500 credit   (lands on 500)
//   1,300 raw →  900 credit   (500 + 800 raw for the half tier)
//   1,700 raw → 1,000 credit  (1,300 + 400 raw for the quarter tier)
// Anything past that is dropped. It is not banked.

const DAILY_CAP = 1000;
const TAPER_FULL_UNTIL = 500;
const TAPER_HALF_UNTIL = 900;
// Older imports used this name for a 500 cap. It is the shared 1,000 cap now.
const DAILY_POINTS_CAP = DAILY_CAP;

const TIERS = [
    { end: TAPER_FULL_UNTIL, divisor: 1 },
    { end: TAPER_HALF_UNTIL, divisor: 2 },
    { end: DAILY_CAP, divisor: 4 },
];

function taperAward(want, used) {
    const amount = Math.max(0, Math.floor(Number(want) || 0));
    const cursor0 = Math.max(0, Math.floor(Number(used) || 0));
    if (amount <= 0 || cursor0 >= DAILY_CAP) {
        return { awarded: 0, dailyXp: Math.min(cursor0, DAILY_CAP) };
    }
    let awarded = 0;
    let cursor = cursor0;
    let left = amount;
    for (let i = 0; i < TIERS.length; i++) {
        if (left <= 0 || cursor >= DAILY_CAP) break;
        const tier = TIERS[i];
        if (cursor >= tier.end) continue;
        const room = tier.end - cursor;
        const rawNeeded = room * tier.divisor;
        if (left >= rawNeeded) {
            awarded += room;
            cursor += room;
            left -= rawNeeded;
        } else {
            const credit = Math.floor(left / tier.divisor);
            awarded += credit;
            cursor += credit;
            left = 0;
        }
    }
    return { awarded: awarded, dailyXp: cursor };
}

function planDailyXp(dailyUsed, pts) {
    const used = Math.max(0, Number(dailyUsed) || 0);
    const tapered = taperAward(pts, used);
    const want = Math.max(0, Number(pts) || 0);
    return {
        awarded: tapered.awarded,
        overflowAdded: 0,
        capped: used + tapered.awarded >= DAILY_CAP,
        pastCap: used >= DAILY_CAP,
        dailyXp: tapered.dailyXp,
        dailyCap: DAILY_CAP,
        fullUntil: TAPER_FULL_UNTIL,
        halfUntil: TAPER_HALF_UNTIL,
        dropped: Math.max(0, want - tapered.awarded),
    };
}

// The cap argument is ignored. Every caller shares the 500 / 900 / 1,000 taper.
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
    TAPER_HALF_UNTIL: TAPER_HALF_UNTIL,
    taperAward: taperAward,
    planDailyXp: planDailyXp,
    splitDailyXp: splitDailyXp,
};
