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

// Collection completion. badge_awards is passed in as extraIds.
// badges, visibleBadges, and donationBadges are server-written.
// hiddenBadges counts only when that same id is already in one of those
// sources. An id that appears only in hiddenBadges is not held.
// earnedHidden, displayBadge, and equippedBadge are client-writable and never count.
const TRUSTED_LIST_FIELDS = ['badges', 'visibleBadges', 'donationBadges'];
const HIDDEN_LIST_FIELDS = ['hiddenBadges'];
const SERVER_LIST_FIELDS = TRUSTED_LIST_FIELDS.concat(HIDDEN_LIST_FIELDS);

function serverHeldBadgeIds(user, extraIds) {
    const held = collectIds(user, TRUSTED_LIST_FIELDS, []);
    (extraIds || []).forEach(function (raw) {
        const id = cleanBadgeId(raw);
        if (id) held.add(id);
    });
    return held;
}

// badges, visibleBadges, donationBadges, and hiddenBadges are server-written.
// displayBadge, equippedBadge, and earnedHidden are not in this set.
function serverShownBadgeIds(user) {
    return collectIds(user, SERVER_LIST_FIELDS, []);
}

function serverHoldsBadge(user, badgeId) {
    const id = cleanBadgeId(badgeId);
    if (!id) return false;
    return serverShownBadgeIds(user).has(id);
}

// Collection proof. hiddenBadges counts only when that id is already trusted.
// A hidden-only id does not prove a collection.
function collectionProofIds(user) {
    return collectIds(user, TRUSTED_LIST_FIELDS, []);
}

function legacyAwardCounts(user, badgeId) {
    const id = cleanBadgeId(badgeId);
    if (!id) return false;
    return collectionProofIds(user).has(id);
}

// Award docs are server proof, except a legacy row that no trusted field backs.
function countableAwardIds(user, rows) {
    const backed = collectionProofIds(user);
    const ids = [];
    const map = rows && typeof rows === 'object' ? rows : {};
    Object.keys(map).forEach(function (raw) {
        const id = cleanBadgeId(raw);
        if (!id) return;
        const row = map[raw] || {};
        if (String(row.source || '') === 'legacy' && !backed.has(id)) return;
        ids.push(id);
    });
    return ids;
}

function heldIdsForCollection(user, rows) {
    return serverHeldBadgeIds(user, countableAwardIds(user, rows));
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
    TRUSTED_LIST_FIELDS: TRUSTED_LIST_FIELDS,
    HIDDEN_LIST_FIELDS: HIDDEN_LIST_FIELDS,
    SERVER_LIST_FIELDS: SERVER_LIST_FIELDS,
    profileBadgeIds: profileBadgeIds,
    profileHoldsBadge: profileHoldsBadge,
    serverShownBadgeIds: serverShownBadgeIds,
    serverHoldsBadge: serverHoldsBadge,
    collectionProofIds: collectionProofIds,
    legacyAwardCounts: legacyAwardCounts,
    countableAwardIds: countableAwardIds,
    heldIdsForCollection: heldIdsForCollection,
    serverHeldBadgeIds: serverHeldBadgeIds,
};
