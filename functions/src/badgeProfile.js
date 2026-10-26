'use strict';

// Badges a profile already shows, including legacy arrays, maps, and single fields.
// Award proof is only the server-owned lists. displayBadge, equippedBadge,
// earnedHidden, and hiddenBadges are not proof: a player can write the first
// three, and hiddenBadges was client-writable on older rules.
// An unbacked source:legacy row is not Favor or XP credit. It counts toward
// milestone, set, and collection progress only while its server criteria pass.

const badgeRules = require('./badgeRules');

const LIST_FIELDS = ['badges', 'visibleBadges', 'hiddenBadges', 'earnedHidden', 'donationBadges'];
const SINGLE_FIELDS = ['displayBadge', 'equippedBadge'];
const SERVER_LIST_FIELDS = ['badges', 'visibleBadges', 'donationBadges'];
const ID_ALIASES = { country_set: 'global_citizen' };

function cleanBadgeId(raw) {
    return String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 60);
}

function canonicalBadgeId(raw) {
    const id = cleanBadgeId(raw);
    if (!id) return '';
    return ID_ALIASES[id] || id;
}

function collectIds(user, listFields, singleFields) {
    const set = new Set();
    if (!user || typeof user !== 'object') return set;
    (listFields || []).forEach(function (key) {
        const value = user[key];
        if (Array.isArray(value)) {
            value.forEach(function (item) {
                if (typeof item === 'string') {
                    const id = cleanBadgeId(item);
                    if (id) set.add(id);
                } else if (item && typeof item === 'object' && item.id) {
                    const id = cleanBadgeId(item.id);
                    if (id) set.add(id);
                }
            });
            return;
        }
        if (value && typeof value === 'object') {
            Object.keys(value).forEach(function (itemKey) {
                const id = cleanBadgeId(itemKey);
                if (id) set.add(id);
            });
        }
    });
    (singleFields || []).forEach(function (key) {
        if (typeof user[key] !== 'string') return;
        const id = cleanBadgeId(user[key]);
        if (id) set.add(id);
    });
    return set;
}

function profileBadgeIds(user) {
    return collectIds(user, LIST_FIELDS, SINGLE_FIELDS);
}

function profileHoldsBadge(user, badgeId) {
    const id = cleanBadgeId(badgeId);
    if (!id) return false;
    return profileBadgeIds(user).has(id);
}

function serverBadgeIds(user) {
    const set = new Set();
    collectIds(user, SERVER_LIST_FIELDS, []).forEach(function (id) {
        const canon = ID_ALIASES[id] || id;
        if (canon) set.add(canon);
    });
    return set;
}

function serverHoldsBadge(user, badgeId) {
    const id = canonicalBadgeId(badgeId);
    if (!id) return false;
    return serverBadgeIds(user).has(id);
}

function hiddenOnlyBadge(user, badgeId) {
    const id = canonicalBadgeId(badgeId);
    if (!id || serverHoldsBadge(user, id)) return false;
    let found = false;
    collectIds(user, ['hiddenBadges'], []).forEach(function (item) {
        if ((ID_ALIASES[item] || item) === id) found = true;
    });
    return found;
}

// A source:legacy row has no server list behind it. That row is not proof
// for Favor or XP. Progress counting rechecks the badge's own criteria.
function unbackedLegacyAward(user, badgeId, award) {
    return !!(award && award.source === 'legacy' && !serverHoldsBadge(user, badgeId));
}

function awardCountsForBonus(user, badgeId, award) {
    return !unbackedLegacyAward(user, badgeId, award);
}

// Ids that count toward milestone, set, and collection progress.
// Backed rows and non-legacy rows always count. An unbacked legacy row counts
// only while its server criteria pass, and the check runs again next time.
function progressAwardIds(user, rows, ctx) {
    const bag = ctx || {};
    const countable = new Set();
    const pending = [];
    (rows || []).forEach(function (row) {
        if (!row || !row.id) return;
        const id = canonicalBadgeId(row.id);
        if (!id) return;
        const award = row.award || row;
        if (awardCountsForBonus(user, id, award)) {
            countable.add(id);
            return;
        }
        if (award && award.source === 'legacy') pending.push(id);
    });
    let added = true;
    while (added) {
        added = false;
        const payingCount = badgeRules.countPaying(countable);
        for (let i = 0; i < pending.length; i++) {
            const id = pending[i];
            if (countable.has(id)) continue;
            const rule = badgeRules.ruleFor(id);
            if (!rule) continue;
            const met = badgeRules.meets(rule, user, {
                awardSet: countable,
                payingCount: payingCount,
                signedIn: bag.signedIn !== false,
                flexClaims: bag.flexClaims || null,
                scholarExamPassed: bag.scholarExamPassed === true,
                scholarExamsPassed: bag.scholarExamsPassed || null,
            });
            if (!met) continue;
            countable.add(id);
            added = true;
        }
    }
    return countable;
}

module.exports = {
    LIST_FIELDS: LIST_FIELDS,
    SINGLE_FIELDS: SINGLE_FIELDS,
    SERVER_LIST_FIELDS: SERVER_LIST_FIELDS,
    cleanBadgeId: cleanBadgeId,
    canonicalBadgeId: canonicalBadgeId,
    collectIds: collectIds,
    profileBadgeIds: profileBadgeIds,
    profileHoldsBadge: profileHoldsBadge,
    serverBadgeIds: serverBadgeIds,
    serverHoldsBadge: serverHoldsBadge,
    hiddenOnlyBadge: hiddenOnlyBadge,
    unbackedLegacyAward: unbackedLegacyAward,
    awardCountsForBonus: awardCountsForBonus,
    progressAwardIds: progressAwardIds,
};
