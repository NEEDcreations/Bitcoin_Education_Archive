'use strict';

const badgeRules = require('./badgeRules');

const PAGE = 200;
const THIRTY_DAYS = 30 * 24 * 3600 * 1000;

function awardId(doc) {
    let bid = doc.id;
    if (/^[A-Za-z0-9]{20,}$/.test(bid)) {
        const data = doc.data() || {};
        bid = data.badge || data.badgeId || '';
    }
    return typeof bid === 'string' ? bid : '';
}

function millisOf(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const n = Date.parse(value);
        return Number.isNaN(n) ? 0 : n;
    }
    return 0;
}

function isAnonymousRecord(rec) {
    if (!rec) return true;
    const providers = rec.providerData || [];
    return providers.length === 0;
}

async function refreshBadgeDistribution(db, adminSdk, opts) {
    const o = opts || {};
    const authApi = o.auth || adminSdk.auth();
    const now = o.now || Date.now();
    const awardSets = {};
    const awardSnap = await db.collectionGroup('badge_awards').get();
    awardSnap.forEach(function (doc) {
        const parts = doc.ref.path.split('/');
        if (parts.length < 4 || parts[0] !== 'users') return;
        const uid = parts[1];
        const bid = awardId(doc);
        if (!bid) return;
        if (!awardSets[uid]) awardSets[uid] = new Set();
        awardSets[uid].add(bid);
    });

    const counts = {};
    let totalUsers = 0;
    let activeUsers30d = 0;
    let cursor = null;
    while (true) {
        let q = db.collection('users').orderBy(adminSdk.firestore.FieldPath.documentId()).limit(PAGE);
        if (cursor) q = q.startAfter(cursor);
        const snap = await q.get();
        if (snap.empty) break;
        const ids = snap.docs.map(function (doc) { return { uid: doc.id }; });
        let found = { users: [] };
        try {
            found = await authApi.getUsers(ids);
        } catch (err) {
            found = { users: [] };
        }
        const byUid = {};
        (found.users || []).forEach(function (rec) { byUid[rec.uid] = rec; });
        snap.docs.forEach(function (doc) {
            const data = doc.data() || {};
            const rec = byUid[doc.id];
            if (!rec || isAnonymousRecord(rec)) return;
            if (data.ban_reason || data.banned === true || data.isBot === true || data.isTest === true) return;
            if (doc.id === 'nacho-bot' || doc.id === 'system') return;
            totalUsers += 1;
            if (now - millisOf(data.lastActive) <= THIRTY_DAYS) activeUsers30d += 1;
            const held = new Set(awardSets[doc.id] ? Array.from(awardSets[doc.id]) : []);
            (Array.isArray(data.visibleBadges) ? data.visibleBadges : []).forEach(function (id) { if (typeof id === 'string') held.add(id); });
            (Array.isArray(data.hiddenBadges) ? data.hiddenBadges : []).forEach(function (id) { if (typeof id === 'string') held.add(id); });
            held.forEach(function (id) {
                if (!badgeRules.isKnown(id)) return;
                counts[id] = (counts[id] || 0) + 1;
            });
        });
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }

    const payload = {
        totalUsers: totalUsers,
        activeUsers30d: activeUsers30d,
        counts: counts,
        catalogVersion: badgeRules.catalog.version || 1,
        updatedAt: adminSdk.firestore.FieldValue.serverTimestamp(),
    };
    if (o.write !== false) {
        await db.collection('stats').doc('badge_distribution').set(payload);
    }
    return { totalUsers: totalUsers, activeUsers30d: activeUsers30d, badgeCount: Object.keys(counts).length };
}

function heldThatFail(user, awardIds, ctx) {
    const failed = [];
    const extra = ctx || {};
    (awardIds || []).forEach(function (id) {
        const rule = badgeRules.ruleFor(id);
        if (!rule || rule.cosmetic) return;
        const set = new Set(awardIds);
        const bag = Object.assign({
            awardSet: set,
            payingCount: badgeRules.countPaying(set),
            signedIn: true,
        }, extra);
        if (!badgeRules.meets(rule, user || {}, bag)) {
            failed.push(id);
        }
    });
    return failed;
}

module.exports = {
    refreshBadgeDistribution: refreshBadgeDistribution,
    heldThatFail: heldThatFail,
    isAnonymousRecord: isAnonymousRecord,
};
