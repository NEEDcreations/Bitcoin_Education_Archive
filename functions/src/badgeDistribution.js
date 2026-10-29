'use strict';

const badgeRules = require('./badgeRules');

// Firestore pages stay at 200. Identity Toolkit getUsers accepts at most 100
// identifiers, so each page is split before the Auth call.
const USER_PAGE = 200;
const AUTH_LOOKUP_MAX = 100;
const AUTH_BATCH = 100;
const THIRTY_DAYS = 30 * 24 * 3600 * 1000;

// Holder lists that are allowed to move the public distribution.
// hiddenBadges is a private list. earnedHidden, displayBadge, and
// equippedBadge are not public holder lists either.
const PUBLIC_LIST_FIELDS = ['visibleBadges'];

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

function isPublicBadge(id) {
    if (typeof id !== 'string' || !id) return false;
    const rule = badgeRules.ruleFor(id);
    return !!(rule && rule.hidden !== true);
}

function addPublicIds(target, list) {
    if (!Array.isArray(list)) return;
    list.forEach(function (id) {
        if (isPublicBadge(id)) target.add(id);
    });
}

function chunkIds(ids) {
    const size = Math.min(AUTH_BATCH, AUTH_LOOKUP_MAX);
    const out = [];
    const list = Array.isArray(ids) ? ids : [];
    const step = size > 0 ? size : 1;
    for (let i = 0; i < list.length; i += step) {
        out.push(list.slice(i, i + step));
    }
    return out;
}

function countLogger(log) {
    return typeof log === 'function' ? log : function (line) { console.log(line); };
}

function safeCode(err) {
    const code = err && typeof err.code === 'string' ? err.code : '';
    return /^[a-z0-9/_-]{1,64}$/i.test(code) ? code : 'unknown';
}

function logLine(log, line) {
    countLogger(log)(line);
}

// One Auth batch failure is counted and skipped. Found users in a successful
// response are kept even when that same response lists other identifiers in
// notFound. Identifiers are never written to the log.
async function lookupAuthUsers(authApi, ids, log) {
    const byUid = {};
    let notFound = 0;
    let failedBatches = 0;
    let batches = 0;
    const chunks = chunkIds(ids);
    for (let i = 0; i < chunks.length; i++) {
        const batch = chunks[i];
        if (!batch.length || batch.length > AUTH_LOOKUP_MAX) {
            failedBatches += 1;
            logLine(log, '[BADGE DIST] auth batch skipped size=' + (batch ? batch.length : 0));
            continue;
        }
        batches += 1;
        try {
            const found = await authApi.getUsers(batch);
            if (!found || typeof found !== 'object') {
                failedBatches += 1;
                logLine(log, '[BADGE DIST] auth batch failed size=' + batch.length + ' code=unknown');
                continue;
            }
            const users = Array.isArray(found.users) ? found.users : [];
            users.forEach(function (rec) {
                if (rec && typeof rec.uid === 'string' && rec.uid) byUid[rec.uid] = rec;
            });
            notFound += Array.isArray(found.notFound) ? found.notFound.length : 0;
        } catch (err) {
            failedBatches += 1;
            logLine(log, '[BADGE DIST] auth batch failed size=' + batch.length + ' code=' + safeCode(err));
        }
    }
    return { byUid: byUid, notFound: notFound, failedBatches: failedBatches, batches: batches };
}

function summaryLine(info) {
    return '[BADGE DIST]'
        + ' users=' + info.totalUsers
        + ' active30d=' + info.activeUsers30d
        + ' badges=' + info.badgeCount
        + ' authBatches=' + info.authBatches
        + ' failedBatches=' + info.failedBatches
        + ' notFound=' + info.notFound
        + ' wrote=' + (info.wrote ? 1 : 0);
}

async function refreshBadgeDistribution(db, adminSdk, opts) {
    const o = opts || {};
    const log = o.log;
    try {
        return await rebuildBadgeDistribution(db, adminSdk, o, log);
    } catch (err) {
        logLine(log, '[BADGE DIST] refresh failed');
        throw new Error('badge distribution refresh failed');
    }
}

async function rebuildBadgeDistribution(db, adminSdk, o, log) {
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
    let notFound = 0;
    let failedBatches = 0;
    let authBatches = 0;
    let seenUsers = 0;
    let cursor = null;
    while (true) {
        let q = db.collection('users').orderBy(adminSdk.firestore.FieldPath.documentId()).limit(USER_PAGE);
        if (cursor) q = q.startAfter(cursor);
        const snap = await q.get();
        if (snap.empty) break;
        seenUsers += snap.size;
        const ids = snap.docs.map(function (doc) { return { uid: doc.id }; });
        const looked = await lookupAuthUsers(authApi, ids, log);
        authBatches += looked.batches;
        failedBatches += looked.failedBatches;
        notFound += looked.notFound;
        const byUid = looked.byUid;
        snap.docs.forEach(function (doc) {
            const data = doc.data() || {};
            const rec = byUid[doc.id];
            if (!rec || isAnonymousRecord(rec)) return;
            if (data.ban_reason || data.banned === true || data.isBot === true || data.isTest === true) return;
            if (data.lock && data.lock.state === 'locked') return;
            if (doc.id === 'nacho-bot' || doc.id === 'system') return;
            totalUsers += 1;
            if (now - millisOf(data.lastActive) <= THIRTY_DAYS) activeUsers30d += 1;
            const held = new Set();
            if (awardSets[doc.id]) {
                awardSets[doc.id].forEach(function (id) {
                    if (isPublicBadge(id)) held.add(id);
                });
            }
            PUBLIC_LIST_FIELDS.forEach(function (field) {
                addPublicIds(held, data[field]);
            });
            held.forEach(function (id) {
                counts[id] = (counts[id] || 0) + 1;
            });
        });
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < USER_PAGE) break;
    }

    const publicCounts = {};
    Object.keys(counts).forEach(function (id) {
        if (!isPublicBadge(id)) return;
        const n = counts[id];
        if (typeof n !== 'number' || n <= 0) return;
        publicCounts[id] = n;
    });

    const payload = {
        totalUsers: totalUsers,
        activeUsers30d: activeUsers30d,
        counts: publicCounts,
        catalogVersion: badgeRules.catalog.version || 1,
        updatedAt: adminSdk.firestore.FieldValue.serverTimestamp(),
    };
    // A total Auth outage must not replace the last good snapshot with zeros.
    // A partial outage still publishes the users that resolved. The next run
    // rebuilds the whole document, so a retry does not add to these counts.
    const authDown = failedBatches > 0 && totalUsers === 0 && seenUsers > 0;
    let wrote = false;
    if (o.write !== false && !authDown) {
        await db.collection('stats').doc('badge_distribution').set(payload, { merge: false });
        wrote = true;
    }
    const result = {
        totalUsers: totalUsers,
        activeUsers30d: activeUsers30d,
        badgeCount: Object.keys(publicCounts).length,
        authBatches: authBatches,
        failedBatches: failedBatches,
        notFound: notFound,
        wrote: wrote,
    };
    logLine(log, summaryLine(result));
    return result;
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
    USER_PAGE: USER_PAGE,
    AUTH_BATCH: AUTH_BATCH,
    AUTH_LOOKUP_MAX: AUTH_LOOKUP_MAX,
    isPublicBadge: isPublicBadge,
    refreshBadgeDistribution: refreshBadgeDistribution,
    heldThatFail: heldThatFail,
    isAnonymousRecord: isAnonymousRecord,
};
