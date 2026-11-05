'use strict';

// Faction race end prizes. Server only.
//
// When a faction first reaches RACE_TARGET race points:
//   1. One transaction writes faction_race_results/{raceId} (create-only),
//      the public banner doc, and Nacho's big announcement in global chat.
//      A retry sees the result doc and does nothing.
//   2. Badges, titles, and 30-day chat flair are granted with arrayUnion /
//      fixed values, so a retry cannot double anything.
//   3. The pot of sats breakdown is computed and stored. Nothing is paid until
//      an admin taps "Approve & pay" (adminApproveFactionPayout). Approval
//      creates one cipher_wins row per recipient (deterministic id, create-only),
//      and the player withdraws it through claimCipherWin, which re-runs every
//      sats gate (verified email, 7-day age, ban/satsDisabled/ledger ban,
//      tombstone, satsHold) at pay time.
//
// Public text never shows a uid, email, IP, or price/"worth" label.

const RACE_TARGET = require('./factionBalance').RACE_TARGET;
const { rewardBlocked } = require('./cipherClaim');

const FACTIONS = ['cyber_hornets', 'honey_badgers'];
const DEFAULTS = {
    winnerPotSats: 121000,
    loserPotSats: 2100,
    loserTopN: 10,
    minContribution: 3,
    minAccountAgeDays: 7,
    headStartPct: 10,
};
const FLAIR_DAYS = 30;
const FLAIR_MS = FLAIR_DAYS * 86400000;
const MAX_POT = 1000000;

const IDENTITY = {
    cyber_hornets: {
        name: 'Cyber Hornets', emoji: '🐝', badgeId: 'race_champion_hornets', titleId: 'hive_mind_champion',
        title: 'Hive Mind Champion', flair: '🐝👑',
    },
    honey_badgers: {
        name: 'Honey Badgers', emoji: '🦡', badgeId: 'race_champion_badgers', titleId: 'honey_badger_champion',
        title: "Honey Badger Don't Care Champion", flair: '🦡👑',
    },
};
const COMEBACK_BADGE = 'race_comeback_kid';
const FINISHER_BADGE = 'race_10k_finisher';

function isFaction(f) { return FACTIONS.indexOf(f) !== -1; }
function other(f) { return f === 'cyber_hornets' ? 'honey_badgers' : 'cyber_hornets'; }
function num(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; }

function intIn(v, lo, hi, dflt) {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= lo && n <= hi ? n : dflt;
}

function readConfig(data) {
    const d = data || {};
    return {
        winnerPotSats: intIn(d.winnerPotSats, 0, MAX_POT, DEFAULTS.winnerPotSats),
        loserPotSats: intIn(d.loserPotSats, 0, MAX_POT, DEFAULTS.loserPotSats),
        loserTopN: intIn(d.loserTopN, 1, 100, DEFAULTS.loserTopN),
        minContribution: intIn(d.minContribution, 0, 10000, DEFAULTS.minContribution),
        minAccountAgeDays: intIn(d.minAccountAgeDays, 0, 365, DEFAULTS.minAccountAgeDays),
        headStartPct: intIn(d.headStartPct, 0, 50, DEFAULTS.headStartPct),
    };
}

function raceIdOf(totals) {
    const id = String((totals && totals.raceId) || 'race1');
    return /^[A-Za-z0-9_-]{1,40}$/.test(id) ? id : 'race1';
}

// Winner = the faction at or past the target. If both crossed in one write,
// the higher total wins; an exact tie goes to neither (wait for next point).
function decideWinner(totals) {
    const t = totals || {};
    const h = num(t.cyber_hornets);
    const b = num(t.honey_badgers);
    if (h < RACE_TARGET && b < RACE_TARGET) return null;
    if (h === b) return null;
    return h > b ? 'cyber_hornets' : 'honey_badgers';
}

function truncateUid(uid) {
    const s = String(uid || '');
    return s.length <= 6 ? s.slice(0, 2) + '…' : s.slice(0, 6) + '…';
}

function publicName(name) {
    const s = String(name || '').replace(/\s+/g, ' ').trim();
    if (!s || s.indexOf('@') !== -1) return 'Anon';
    return s.slice(0, 40);
}

function round2(x) { return Math.round(x * 100) / 100; }

// rows: [{ uid, faction, factionPoints, pointsAdded }]
function tallyContributions(rows, faction) {
    const by = {};
    (rows || []).forEach(function (r) {
        if (!r || !r.uid || r.faction !== faction) return;
        const p = num(r.factionPoints) || num(r.pointsAdded) || 1;
        by[r.uid] = round2((by[r.uid] || 0) + p);
    });
    return by;
}

// Why a contributor gets no sats. Order matters: first match is reported.
function exclusionReason(c, cfg, nowMs) {
    const u = c.user;
    if (!u) return 'account deleted';
    if (c.factionMismatch) return 'no longer on this faction';
    if (rewardBlocked(u, c.ledger)) return 'banned or sats disabled';
    if (u.multiAccount === true) return 'flagged multi-account';
    if (num(u.satsHold) > nowMs) return 'sats on hold';
    if (c.contribution < cfg.minContribution) return 'below minimum contribution (' + cfg.minContribution + ')';
    if (!c.authKnown) return 'account age unknown';
    if (c.ageDays < cfg.minAccountAgeDays) return 'account younger than ' + cfg.minAccountAgeDays + ' days';
    if (c.emailVerified !== true) return 'no verified email';
    return '';
}

// Largest-remainder split so the sats add up to the pot exactly.
function splitPot(pot, rows) {
    const total = rows.reduce(function (s, r) { return s + r.contribution; }, 0);
    if (!pot || !total) return rows.map(function () { return 0; });
    const raw = rows.map(function (r) { return pot * r.contribution / total; });
    const out = raw.map(Math.floor);
    let left = pot - out.reduce(function (s, x) { return s + x; }, 0);
    const order = raw.map(function (x, i) { return { i: i, f: x - Math.floor(x), c: rows[i].contribution, uid: rows[i].uid }; })
        .sort(function (a, b) { return b.f - a.f || b.c - a.c || (a.uid < b.uid ? -1 : 1); });
    for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k].i] += 1;
    return out;
}

// contributors: [{ uid, contribution, user, ledger, authKnown, ageDays, emailVerified }]
function buildPot(contributors, pot, cfg, nowMs, topN) {
    const sorted = (contributors || []).slice().sort(function (a, b) {
        return b.contribution - a.contribution || (a.uid < b.uid ? -1 : 1);
    });
    const eligible = [];
    const excluded = [];
    sorted.forEach(function (c) {
        const reason = exclusionReason(c, cfg, nowMs);
        const row = { uid: c.uid, uidShort: truncateUid(c.uid), username: publicName(c.user && c.user.username), contribution: c.contribution };
        if (reason) excluded.push(Object.assign(row, { reason: reason }));
        else eligible.push(row);
    });
    let paid = eligible;
    if (topN && eligible.length > topN) {
        eligible.slice(topN).forEach(function (r) { excluded.push(Object.assign({}, r, { reason: 'outside top ' + topN })); });
        paid = eligible.slice(0, topN);
    }
    const sats = splitPot(pot, paid);
    const shareTotal = paid.reduce(function (s, r) { return s + r.contribution; }, 0);
    const recipients = paid.map(function (r, i) {
        return Object.assign({}, r, { sharePct: shareTotal ? round2(100 * r.contribution / shareTotal) : 0, sats: sats[i] });
    });
    const satsTotal = sats.reduce(function (s, x) { return s + x; }, 0);
    return {
        pot: pot,
        satsTotal: satsTotal,
        balanced: recipients.length ? satsTotal === pot : true,
        unallocated: recipients.length ? 0 : pot,
        recipients: recipients,
        excluded: excluded,
        contributionTotal: round2(shareTotal),
    };
}

function buildBreakdown(input) {
    const cfg = readConfig(input.config);
    const now = Number(input.nowMs) || Date.now();
    return {
        raceId: input.raceId,
        winner: input.winner,
        loser: other(input.winner),
        config: cfg,
        winners: buildPot(input.winnerContributors, cfg.winnerPotSats, cfg, now, 0),
        losers: buildPot(input.loserContributors, cfg.loserPotSats, cfg, now, cfg.loserTopN),
    };
}

function announcementText(winner, totals) {
    const w = IDENTITY[winner];
    const l = IDENTITY[other(winner)];
    const wPts = Math.floor(num(totals && totals[winner])).toLocaleString('en-US');
    const lPts = Math.floor(num(totals && totals[other(winner)])).toLocaleString('en-US');
    const quip = winner === 'cyber_hornets'
        ? "Don't trust. Verify. Then sting. 🐝"
        : "Bitten by a cobra. Still hodling. Honey badger don't care. 🦡";
    return '🏆🦌 THE RACE IS OVER! The ' + w.emoji + ' ' + w.name + ' hit 10,000 points first and WIN the faction race! (' +
        wPts + ' to ' + lPts + ') ' + quip + ' Every ' + w.name + ' contributor earns the ' + w.title +
        ' badge and title, champion chat flair for 30 days, and a share of the pot of sats. ' +
        l.emoji + ' ' + l.name + ', you fought hard: every contributor gets the Comeback Kid badge, your top 10 split a pot of sats, and you start the next race with a head start. GG, plebs! 🧡';
}

// Grants for one contributor. Fixed values + arrayUnion: safe to repeat.
function grantPatch(side, faction, nowMs, FieldValue) {
    const patch = { factionRaceBadges: FieldValue.arrayUnion(FINISHER_BADGE) };
    if (side === 'winner') {
        const id = IDENTITY[faction];
        patch.factionRaceBadges = FieldValue.arrayUnion(FINISHER_BADGE, id.badgeId);
        patch.earnedTitles = FieldValue.arrayUnion(id.titleId);
        patch.factionChampionUntil = nowMs + FLAIR_MS;
        patch.factionChampionFlair = id.flair;
    } else {
        patch.factionRaceBadges = FieldValue.arrayUnion(FINISHER_BADGE, COMEBACK_BADGE);
    }
    return patch;
}

function winId(raceId, side, uid) {
    return 'frace_' + raceId + '_' + side + '_' + uid;
}

module.exports = {
    FACTIONS, DEFAULTS, FLAIR_DAYS, FLAIR_MS, IDENTITY, COMEBACK_BADGE, FINISHER_BADGE, RACE_TARGET, MAX_POT,
    isFaction, other, readConfig, raceIdOf, decideWinner, truncateUid, publicName,
    tallyContributions, exclusionReason, splitPot, buildPot, buildBreakdown, announcementText, grantPatch, winId,
};
