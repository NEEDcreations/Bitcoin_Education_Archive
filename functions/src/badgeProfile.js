'use strict';

// Badges a profile already shows, including legacy arrays, maps, and single fields.
// A later counter update must not pay those again.

const LIST_FIELDS = ['badges', 'visibleBadges', 'hiddenBadges', 'earnedHidden', 'donationBadges'];
const SINGLE_FIELDS = ['displayBadge', 'equippedBadge'];

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

// Collection completion. These lists are server-only in firestore.rules.
// earnedHidden, displayBadge, and equippedBadge are client-writable and do not count.
const SERVER_LIST_FIELDS = ['badges', 'visibleBadges', 'hiddenBadges', 'donationBadges'];

function serverHeldBadgeIds(user, extraIds) {
    const held = collectIds(user, SERVER_LIST_FIELDS, []);
    (extraIds || []).forEach(function (raw) {
        const id = cleanBadgeId(raw);
        if (id) held.add(id);
    });
    return held;
}

function profileHoldsBadge(user, badgeId) {
    const id = cleanBadgeId(badgeId);
    if (!id) return false;
    return profileBadgeIds(user).has(id);
}

module.exports = {
    LIST_FIELDS: LIST_FIELDS,
    SINGLE_FIELDS: SINGLE_FIELDS,
    cleanBadgeId: cleanBadgeId,
    collectIds: collectIds,
    SERVER_LIST_FIELDS: SERVER_LIST_FIELDS,
    profileBadgeIds: profileBadgeIds,
    profileHoldsBadge: profileHoldsBadge,
    serverHeldBadgeIds: serverHeldBadgeIds,
};
