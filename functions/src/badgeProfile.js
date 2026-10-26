'use strict';

// Badges a profile already shows, including legacy arrays, maps, and single fields.
// Award proof is only the server-owned lists. displayBadge, equippedBadge,
// earnedHidden, and hiddenBadges are not proof: a player can write the first
// three, and hiddenBadges was client-writable on older rules.

const LIST_FIELDS = ['badges', 'visibleBadges', 'hiddenBadges', 'earnedHidden', 'donationBadges'];
const SINGLE_FIELDS = ['displayBadge', 'equippedBadge'];
const SERVER_LIST_FIELDS = ['badges', 'visibleBadges', 'donationBadges'];

function cleanBadgeId(raw) {
    return String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 60);
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
    return collectIds(user, SERVER_LIST_FIELDS, []);
}

function serverHoldsBadge(user, badgeId) {
    const id = cleanBadgeId(badgeId);
    if (!id) return false;
    return serverBadgeIds(user).has(id);
}

// A source:legacy row counts toward milestones and set bonuses only when the
// same id is in badges, visibleBadges, or donationBadges.
function unbackedLegacyAward(user, badgeId, award) {
    return !!(award && award.source === 'legacy' && !serverHoldsBadge(user, badgeId));
}

function awardCountsForBonus(user, badgeId, award) {
    return !unbackedLegacyAward(user, badgeId, award);
}

module.exports = {
    LIST_FIELDS: LIST_FIELDS,
    SINGLE_FIELDS: SINGLE_FIELDS,
    SERVER_LIST_FIELDS: SERVER_LIST_FIELDS,
    cleanBadgeId: cleanBadgeId,
    collectIds: collectIds,
    profileBadgeIds: profileBadgeIds,
    profileHoldsBadge: profileHoldsBadge,
    serverBadgeIds: serverBadgeIds,
    serverHoldsBadge: serverHoldsBadge,
    unbackedLegacyAward: unbackedLegacyAward,
    awardCountsForBonus: awardCountsForBonus,
};
