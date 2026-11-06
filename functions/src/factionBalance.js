'use strict';

// Faction race balance. Server only. Clients never send a multiplier, a join
// time, or a faction score. Every number here comes from server data read in
// the same transaction that writes the points.
//
// 1. Underdog join bonus: a player who joins the faction with fewer members
//    earns +25% on their own faction points for 7 days. Set once, by
//    chooseFaction, because the faction choice itself is permanent.
// 2. Underdog multiplier: while a faction trails by 1,000 or more race points,
//    its new points count 1.2x. It turns off by itself once the gap closes.
// 3. Loser head start: the faction that lost the previous race earns 1.1x on
//    its FIRST 1,000 base points of the next race, then normal. Tracked on the
//    totals doc per race (headStartUsed_<raceId>), set by the race-end job.
//    Stacking with the underdog boost: we take the MAX of the two (1.2x vs
//    1.1x), never multiply them. The personal join bonus still multiplies.
// 4. Members are counted on the totals doc so the board can show a fair
//    average per member next to the race total.

const FACTIONS = ['cyber_hornets', 'honey_badgers'];
const UNDERDOG_GAP = 1000;
const UNDERDOG_MULT = 1.2;
const JOIN_BONUS_MULT = 1.25;
const JOIN_BONUS_DAYS = 7;
const JOIN_BONUS_MS = JOIN_BONUS_DAYS * 24 * 60 * 60 * 1000;
const RACE_TARGET = 10000;
const HEAD_START_MULT = 1.1;
const HEAD_START_POINTS = 1000;

function raceIdOf(totals) { return String((totals && totals.raceId) || 'race1'); }
function headStartUsedField(totals) { return 'headStartUsed_' + raceIdOf(totals).replace(/[^A-Za-z0-9_-]/g, '_'); }
// Base points still eligible for the head start (0 when none).
function headStartRemaining(totals, faction) {
    const t = totals || {};
    const hs = t.headStart;
    if (!hs || hs.faction !== faction || !isFaction(faction)) return 0;
    if (String(hs.afterRaceId || '') === raceIdOf(t)) return 0; // previous race still current
    const cap = Math.min(num(hs.points) || HEAD_START_POINTS, HEAD_START_POINTS);
    return Math.max(0, cap - num(t[headStartUsedField(t)]));
}

function isFaction(f) { return f === 'cyber_hornets' || f === 'honey_badgers'; }
function other(f) { return f === 'cyber_hornets' ? 'honey_badgers' : 'cyber_hornets'; }
function num(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; }
function memberField(f) { return 'members_' + f; }

function toMs(v) {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v instanceof Date) return v.getTime();
    if (typeof v._seconds === 'number') return v._seconds * 1000;
    return 0;
}

// Which faction is smaller for new joins. Members first; scores break a tie
// or cover the time before member counts exist. Null when even.
function smallerFaction(totals) {
    const t = totals || {};
    const mh = num(t[memberField('cyber_hornets')]);
    const mb = num(t[memberField('honey_badgers')]);
    if (mh !== mb) return mh < mb ? 'cyber_hornets' : 'honey_badgers';
    const sh = num(t.cyber_hornets);
    const sb = num(t.honey_badgers);
    if (sh !== sb) return sh < sb ? 'cyber_hornets' : 'honey_badgers';
    return null;
}

// True while this faction trails the other by UNDERDOG_GAP or more.
function underdogActive(totals, faction) {
    if (!isFaction(faction)) return false;
    const t = totals || {};
    return num(t[other(faction)]) - num(t[faction]) >= UNDERDOG_GAP;
}

function joinBonusActive(user, nowMs) {
    const until = toMs(user && user.factionBonusUntil);
    return until > 0 && (Number(nowMs) || Date.now()) < until;
}

function round2(x) { return Math.round(x * 100) / 100; }

// Race points for an earned Favor contribution. The Favor meter and the
// player's own SF counter keep the base points. Only the faction race uses
// this value.
function racePoints(base, faction, totals, user, nowMs) {
    const b = num(base);
    if (!b || !isFaction(faction)) return { points: b, mult: 1, underdog: false, joinBonus: false };
    const underdog = underdogActive(totals, faction);
    const joinBonus = !!(user && user.faction === faction) && joinBonusActive(user, nowMs);
    const hsLeft = headStartRemaining(totals, faction);
    const hsBase = Math.min(b, hsLeft); // only the part inside the first 1,000
    const factionMult = underdog ? UNDERDOG_MULT : 1;
    // Head-start slice: max(underdog, 1.1). Rest: underdog only.
    const hsMult = Math.max(factionMult, hsBase > 0 ? HEAD_START_MULT : 1);
    let pts = hsBase * hsMult + (b - hsBase) * factionMult;
    if (joinBonus) pts *= JOIN_BONUS_MULT;
    const mult = round2(pts / b);
    return { points: round2(pts), mult: mult, underdog: underdog, joinBonus: joinBonus,
        headStart: hsBase > 0, headStartBase: hsBase, headStartField: hsBase > 0 ? headStartUsedField(totals) : null };
}

// Average race points per member, rounded to one decimal.
function perMember(totals, faction) {
    const t = totals || {};
    const m = num(t[memberField(faction)]);
    return m ? Math.round((num(t[faction]) / m) * 10) / 10 : 0;
}

module.exports = {
    FACTIONS, UNDERDOG_GAP, UNDERDOG_MULT, JOIN_BONUS_MULT, JOIN_BONUS_DAYS, JOIN_BONUS_MS, RACE_TARGET, HEAD_START_MULT, HEAD_START_POINTS,
    isFaction, headStartRemaining, headStartUsedField, memberField, smallerFaction, underdogActive, joinBonusActive, racePoints, perMember, toMs,
};
