'use strict';

// Every profile-XP grant plans through planXpGrant.
//
// Order, matching key sends and Lightning tips:
//   1. Source caps that limit the raw award (conversation 40, per-action
//      daily limits, a fixed catalog amount) apply to the base.
//   2. While users.doubleXpUntil is still ahead of server now, the base is
//      doubled once. Expiry at exactly now is over. A zero base is not doubled.
//   3. The shared daily taper then runs on that doubled amount: full through
//      500, half through 900, quarter through 1,000. The cap is not applied
//      before doubling. Cap-exempt grants (the certification bonus) skip
//      step 3 and pay the doubled amount in full.
//
// The multiplier is 2 or 1. It is never applied twice. alreadyBoosted means
// this figure was already doubled by planXpGrant (a stored ledger replay).
// Callers pass the raw base and must not pre-multiply.
//
// kind other than 'xp' (sats, tickets, orangeTickets, freezes, closet) is
// returned unchanged. Historical backfills pass boost: false so a repair of
// an old base is not doubled.
//
// The ledger row records base (pre-multiplier) and boosted (after the
// multiplier, before the taper) plus awarded (what was actually credited).

const doubleXp = require('./doubleXp');
const { planDailyXp, DAILY_CAP, TAPER_FULL_UNTIL, TAPER_HALF_UNTIL } = require('./dailyXp');

const NON_XP = {
    sats: true,
    tickets: true,
    orangeTickets: true,
    freezes: true,
    closet: true,
};

function clean(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
}

function planXpGrant(opts) {
    const src = opts || {};
    const kind = src.kind || 'xp';
    const base = clean(src.base != null ? src.base : src.amount);
    const now = src.now == null || src.now === '' ? Date.now() : (Number(src.now) || 0);
    if (NON_XP[kind]) {
        return {
            kind: kind,
            base: base,
            boosted: base,
            awarded: base,
            doubled: false,
            multiplier: 1,
            until: 0,
            dropped: 0,
            capped: false,
            pastCap: false,
            dailyXp: null,
            dailyCap: DAILY_CAP,
            fullUntil: TAPER_FULL_UNTIL,
            halfUntil: TAPER_HALF_UNTIL,
            capExempt: false,
            replay: false,
        };
    }
    let boosted = base;
    let doubled = false;
    let until = doubleXp.untilMillis(src.user);
    let multiplier = 1;
    if (src.alreadyBoosted === true) {
        boosted = clean(src.boosted != null ? src.boosted : base);
        doubled = src.doubled === true;
        multiplier = doubled ? 2 : 1;
        until = src.until != null ? (Number(src.until) || 0) : until;
    } else if (src.boost !== false && base > 0) {
        const win = doubleXp.boostPoints(base, src.user, now);
        boosted = win.points;
        doubled = win.doubled === true;
        until = win.until || 0;
        multiplier = doubled ? 2 : 1;
    }
    const capExempt = src.capExempt === true || src.bypass === true;
    if (capExempt) {
        return {
            kind: 'xp',
            base: base,
            boosted: boosted,
            awarded: boosted,
            doubled: doubled,
            multiplier: multiplier,
            until: until,
            dropped: 0,
            capped: false,
            pastCap: false,
            dailyXp: null,
            dailyCap: DAILY_CAP,
            fullUntil: TAPER_FULL_UNTIL,
            halfUntil: TAPER_HALF_UNTIL,
            capExempt: true,
            replay: false,
        };
    }
    const used = Math.max(0, Number(src.dailyUsed) || 0);
    const plan = planDailyXp(used, boosted);
    return {
        kind: 'xp',
        base: base,
        boosted: boosted,
        awarded: plan.awarded,
        doubled: doubled,
        multiplier: multiplier,
        until: until,
        dropped: boosted - plan.awarded,
        capped: plan.capped,
        pastCap: plan.pastCap,
        dailyXp: plan.dailyXp,
        dailyCap: plan.dailyCap != null ? plan.dailyCap : DAILY_CAP,
        fullUntil: plan.fullUntil != null ? plan.fullUntil : TAPER_FULL_UNTIL,
        halfUntil: plan.halfUntil != null ? plan.halfUntil : TAPER_HALF_UNTIL,
        capExempt: false,
        replay: false,
    };
}

function ledgerData(plan, extra) {
    const src = extra || {};
    const row = plan || {};
    return {
        kind: 'xp',
        source: src.source || '',
        base: clean(row.base),
        boosted: clean(row.boosted),
        awarded: clean(row.awarded),
        doubled: row.doubled === true,
        multiplier: row.doubled === true ? 2 : 1,
        until: Number(row.until) || 0,
        day: src.day || '',
        uid: src.uid || '',
        capExempt: row.capExempt === true,
    };
}

function replayFromLedger(data) {
    const row = data || {};
    const base = clean(row.base);
    const boosted = clean(row.boosted);
    const awarded = clean(row.awarded);
    return {
        kind: 'xp',
        base: base,
        boosted: boosted,
        awarded: awarded,
        doubled: row.doubled === true,
        multiplier: row.doubled === true ? 2 : 1,
        until: Number(row.until) || 0,
        dropped: Math.max(0, boosted - awarded),
        capped: false,
        pastCap: false,
        dailyXp: null,
        capExempt: row.capExempt === true,
        replay: true,
    };
}

function ledgerRefFor(userRef, id) {
    const safe = String(id || 'grant').replace(/[^\w.-]/g, '_').slice(0, 700);
    return userRef.collection('xp_ledger').doc(safe);
}

// Halve an allowlist figure only when the client sent the doubled payout
// (flex 10, chat-streak 20/50) and the server stored that payout as xp.
// A doubled claim whose stored xp is the real base (quiz 20 → 10) is left
// alone so planXpGrant can double it once.
function baseFromAllowlist(xp, clientPts, requiresDoubleXp) {
    const amount = clean(xp);
    const sent = clean(clientPts);
    if (requiresDoubleXp && sent === amount && amount > 0 && amount % 2 === 0) return amount / 2;
    return amount;
}

module.exports = {
    NON_XP: NON_XP,
    planXpGrant: planXpGrant,
    ledgerData: ledgerData,
    replayFromLedger: replayFromLedger,
    ledgerRefFor: ledgerRefFor,
    baseFromAllowlist: baseFromAllowlist,
};
