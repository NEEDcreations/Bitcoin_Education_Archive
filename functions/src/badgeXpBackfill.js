'use strict';

// Plans lifetime XP top-ups for badges a profile already holds.
// Pays max(0, newXP - alreadyPaid). Never claws back. Flex counts
// daily_action_counts claim docs, not flexTotals. Hidden-only ids,
// client-writable fields, unknown ids, and banned users are skipped.
// The caller (functions/scripts/backfill_badge_xp.js) grants the XP
// through applyDailyXp with bypass: true.

const badgeRules = require('./badgeRules');
const badgeXp = require('./badgeXpTable');
const { rewardBlocked } = require('./cipherClaim');
const { classifyHeld } = require('../../scripts/backfill-badge-favor');
const { planLevelFavor, levelNameForPoints } = require('./satoshiFavor');

function legacyZero(award) {
    return !!(award && award.source === 'legacy'
        && Object.prototype.hasOwnProperty.call(award, 'xp')
        && Number(award.xp) === 0);
}

function cappedZero(award) {
    return !!(award && award.source !== 'legacy'
        && Object.prototype.hasOwnProperty.call(award, 'xp')
        && award.xp != null
        && Number(award.xp) === 0);
}

function alreadyPaid(award, badgeId) {
    // A legacy row records 0 because the profile already held the badge.
    // That grant was the old table amount, so only the difference is new.
    if (legacyZero(award)) {
        const old = badgeXp.oldXpOf(badgeId);
        return old == null ? 0 : old;
    }
    if (award && Object.prototype.hasOwnProperty.call(award, 'xp') && award.xp != null) {
        return Number(award.xp) || 0;
    }
    const old = badgeXp.oldXpOf(badgeId);
    return old == null ? 0 : old;
}

function newXpFor(rule) {
    if (!rule) return 0;
    if (rule.cosmetic) return Number(rule.displayXp) || 0;
    return Number(rule.xp) || 0;
}

function planUserBadges(input) {
    const src = input || {};
    const user = src.user || {};
    const ledger = src.ledger || {};
    if (rewardBlocked(user, ledger)) {
        return {
            banned: true,
            xp: 0,
            topUps: [],
            levelUps: [],
            favorPoints: 0,
            pointsBefore: Number(user.points) || 0,
            pointsAfter: Number(user.points) || 0,
            level: levelNameForPoints(user.points),
            excluded: { 'hidden-only': 0, 'client-writable-field': 0, 'not-in-catalog': 0 },
        };
    }
    const classified = classifyHeld({ user: user, awardIds: src.awardIds || [] });
    const awardById = src.awardById || {};
    const awardSet = new Set(src.awardIds || []);
    const payingCount = badgeRules.countPaying(awardSet);
    const flexClaims = badgeRules.tallyFlexClaims(src.flexClaimIds || []);
    const markers = {};
    (src.markerIds || []).forEach(function (id) { markers[id] = true; });
    const credited = {};
    (src.levelContributorIds || []).forEach(function (name) { credited[name] = true; });

    const pointsBefore = Number(user.points) || 0;
    let points = pointsBefore;
    const topUps = [];
    classified.credit.forEach(function (id) {
        const rule = badgeRules.ruleFor(id);
        if (!rule) return;
        const award = awardById[id] || null;
        if (rule.cosmetic && !award) return;
        if (!rule.cosmetic && !badgeRules.meets(rule, user, {
            awardSet: awardSet,
            payingCount: payingCount,
            signedIn: true,
            flexClaims: flexClaims,
        })) return;
        const newXp = newXpFor(rule);
        if (newXp <= 0) return;
        const paid = alreadyPaid(award, id);
        const topUp = Math.max(0, newXp - paid);
        const zeroedByCap = cappedZero(award);
        if (markers[id]) {
            topUps.push({ badgeId: id, newXp: newXp, alreadyPaid: paid, topUp: 0, skip: 'marker', cappedZero: false });
            return;
        }
        if (topUp <= 0) {
            topUps.push({ badgeId: id, newXp: newXp, alreadyPaid: paid, topUp: 0, skip: 'paid', cappedZero: false });
            return;
        }
        points += topUp;
        topUps.push({
            badgeId: id,
            newXp: newXp,
            alreadyPaid: paid,
            topUp: topUp,
            skip: '',
            cappedZero: zeroedByCap,
        });
    });
    const levelUps = planLevelFavor(pointsBefore, points).filter(function (row) {
        return !credited[row.name];
    });
    let favorPoints = 0;
    levelUps.forEach(function (row) { favorPoints += row.points; });
    return {
        banned: false,
        xp: points - pointsBefore,
        topUps: topUps,
        levelUps: levelUps,
        favorPoints: favorPoints,
        pointsBefore: pointsBefore,
        pointsAfter: points,
        level: levelNameForPoints(points),
        excluded: classified.excluded,
    };
}

module.exports = {
    alreadyPaid: alreadyPaid,
    planUserBadges: planUserBadges,
};
