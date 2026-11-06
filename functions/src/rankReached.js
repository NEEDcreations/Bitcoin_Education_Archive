'use strict';

// First time users.points crosses a rank, stamp users/{uid}.rankReachedAt.{rankId}.
// Thresholds are rewardNotify.LEVELS, the server copy of ranking.js LEVELS.
// Normie (min 0) is the starting rank and is not in that table, so it is
// not stamped. Already-set keys are left alone. Ranks the player already
// held before this write are not backfilled.

const rewardNotify = require('./rewardNotify');

function pointValue(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function rankId(name) {
    return rewardNotify.rankSlug(name);
}

function crossedLevels(beforePoints, afterPoints) {
    const start = pointValue(beforePoints);
    const end = pointValue(afterPoints);
    if (!(end > start)) return [];
    return rewardNotify.LEVELS.filter(function (level) {
        return start < level.min && end >= level.min;
    });
}

function rankIdsToStamp(beforePoints, afterPoints, existing) {
    const have = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
    return crossedLevels(beforePoints, afterPoints).map(function (level) {
        return rankId(level.name);
    }).filter(function (id) {
        return id && have[id] == null;
    });
}

// Dotted paths so a stamp cannot replace the rest of the map.
// `timestamp` is the sentinel the caller wants stored (serverTimestamp()).
function rankReachedPatch(beforePoints, afterPoints, existing, timestamp) {
    const patch = {};
    rankIdsToStamp(beforePoints, afterPoints, existing).forEach(function (id) {
        patch['rankReachedAt.' + id] = timestamp;
    });
    return patch;
}

async function stampRanksForWrite(db, uid, beforePoints, afterPoints, timestamp) {
    if (!uid || !Object.keys(rankReachedPatch(beforePoints, afterPoints, {}, timestamp)).length) {
        return { wrote: false, ids: [] };
    }
    const ref = db.collection('users').doc(uid);
    let written = [];
    await db.runTransaction(async function (t) {
        written = [];
        const snap = await t.get(ref);
        if (!snap.exists) return;
        const live = snap.data() || {};
        const raw = live.rankReachedAt;
        if (raw != null && (typeof raw !== 'object' || Array.isArray(raw))) {
            console.warn('[onUserRankReached] rankReachedAt is not a map uid=' + uid);
            return;
        }
        const patch = rankReachedPatch(beforePoints, afterPoints, raw || {}, timestamp);
        const keys = Object.keys(patch);
        if (!keys.length) return;
        t.update(ref, patch);
        keys.forEach(function (key) { written.push(key.slice('rankReachedAt.'.length)); });
    });
    return { wrote: written.length > 0, ids: written };
}

// v2 onDocumentUpdated event. Points that do not increase return before any read,
// so the stamp write itself does not loop.
async function onUserRankReached(event, db, timestamp) {
    const beforeSnap = event && event.data && event.data.before;
    const afterSnap = event && event.data && event.data.after;
    if (!afterSnap || afterSnap.exists === false) return null;
    const before = beforeSnap && beforeSnap.exists !== false ? (beforeSnap.data() || {}) : {};
    const after = afterSnap.data() || {};
    const beforePts = pointValue(before.points);
    const afterPts = pointValue(after.points);
    if (!(afterPts > beforePts)) return null;
    const uid = event.params && event.params.uid;
    const result = await stampRanksForWrite(db, uid, beforePts, afterPts, timestamp);
    if (result.wrote) console.log('[onUserRankReached] ' + uid + ' ' + result.ids.join(','));
    return result;
}

module.exports = {
    pointValue: pointValue,
    rankId: rankId,
    crossedLevels: crossedLevels,
    rankIdsToStamp: rankIdsToStamp,
    rankReachedPatch: rankReachedPatch,
    stampRanksForWrite: stampRanksForWrite,
    onUserRankReached: onUserRankReached,
};
