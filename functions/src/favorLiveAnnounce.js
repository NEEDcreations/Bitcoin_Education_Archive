'use strict';

// One global-chat post when a Satoshi's Favor window opens.
// Idempotent per currentCycleId: the dedup doc and the chat doc are created
// in the same transaction, so trigger retries and overlapping writers post once.
// Contributor totals are the points that filled the pool (capped at the
// points on the window doc). Backfill rows are left out. The text names no
// uid, email, or IP.

const { millisOf, POINTS_TO_ACTIVATE, FAVOR_DURATION_MINUTES } = require('./favorPool');

const LIVE_PREFIX = 'sf_live_';

function shouldAnnounceLive(before, after) {
    if (!after || after.favorActive !== true) return false;
    if (before && before.favorActive === true) return false;
    if ((Number(after.points) || 0) < POINTS_TO_ACTIVATE) return false;
    if (!after.currentCycleId) return false;
    return true;
}

function cycleKey(cycleId) {
    const clean = String(cycleId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
    return clean || '';
}

function pointsOf(row) {
    const raw = Number(row && row.pointsAdded);
    if (!Number.isFinite(raw)) return 1;
    return raw;
}

function isBackfillRow(row) {
    if (!row || row.backfill === true) return true;
    const source = String(row.source || '');
    return /backfill/i.test(source);
}

function rowKind(row) {
    const source = String(row.source || '');
    const badgeId = String(row.badgeId || row.detail || '');
    if (source === 'daily_all_three') return 'trifecta';
    if (source.indexOf('level_up') === 0) return 'level';
    if (badgeId.indexOf('flex_') === 0) return 'flex';
    if (source === 'badge_earned' || badgeId) return 'badge';
    return 'other';
}

// docs are contributor rows. capPoints is the pool size on the window that
// just opened, so bonus-minute rows written after the fill are not counted.
function summarizeContributions(docs, capPoints) {
    const rows = (docs || []).filter(function (row) {
        return row && !isBackfillRow(row) && pointsOf(row) > 0;
    });
    rows.sort(function (a, b) { return millisOf(a.timestamp) - millisOf(b.timestamp); });
    const cap = Number(capPoints) || 0;
    const totals = { flex: 0, badges: 0, trifectas: 0, levels: 0, other: 0, total: 0, players: 0 };
    const uids = new Set();
    rows.forEach(function (row) {
        if (cap && totals.total >= cap) return;
        const pts = pointsOf(row);
        const kind = rowKind(row);
        if (kind === 'flex') totals.flex += pts;
        else if (kind === 'badge') totals.badges += pts;
        else if (kind === 'trifecta') totals.trifectas += pts;
        else if (kind === 'level') totals.levels += pts;
        else totals.other += pts;
        totals.total += pts;
        if (row.uid) uids.add(String(row.uid));
    });
    totals.players = uids.size;
    return totals;
}

function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
}

function formatLiveAnnouncement(summary, fallbackPoints) {
    const stats = summary || {};
    const points = stats.total > 0 ? stats.total : (Number(fallbackPoints) || 0);
    const bits = [];
    if (stats.flex) bits.push(plural(stats.flex, 'flex badge', 'flex badges'));
    if (stats.badges) bits.push(plural(stats.badges, 'badge', 'badges'));
    if (stats.trifectas) bits.push(plural(stats.trifectas, 'daily trifecta', 'daily trifectas'));
    if (stats.levels) bits.push(plural(stats.levels, 'level up', 'level ups'));
    if (stats.other) bits.push(plural(stats.other, 'point', 'points'));
    let text = "⚡ Satoshi's Favor is LIVE! " + plural(points, 'point', 'points');
    if (stats.players > 0) text += ' from ' + plural(stats.players, 'player', 'players');
    if (bits.length) text += ': ' + bits.join(', ');
    text += '. Window open for ' + FAVOR_DURATION_MINUTES + ' min.';
    return text;
}

function rowMillis(row) {
    return millisOf(row && row.timestamp);
}

async function loadCycleContributors(db, after) {
    const col = db.collection('satoshiFavor').doc('current').collection('contributors');
    let snap;
    if (typeof col.orderBy === 'function') {
        snap = await col.orderBy('timestamp', 'desc').limit(80).get();
    } else {
        snap = await col.get();
    }
    const lastResetMs = millisOf(after && after.lastReset);
    const rows = [];
    const visit = function (doc) {
        const data = doc && doc.data ? (doc.data() || {}) : (doc || {});
        if (isBackfillRow(data)) return;
        const ts = rowMillis(data);
        if (lastResetMs && (!ts || ts < lastResetMs)) return;
        rows.push(data);
    };
    if (snap && typeof snap.forEach === 'function') snap.forEach(visit);
    else if (snap && snap.docs) snap.docs.forEach(visit);
    return rows;
}

async function postLiveAnnouncement(db, adminSdk, after) {
    const key = cycleKey(after && after.currentCycleId);
    if (!key) return { posted: false, reason: 'cycle' };
    const rows = await loadCycleContributors(db, after);
    const summary = summarizeContributions(rows, after.points);
    const text = formatLiveAnnouncement(summary, after.points);
    const dedupRef = db.collection('sf_live_announcements').doc(key);
    const chatRef = db.collection('global_chat').doc(LIVE_PREFIX + key);
    return db.runTransaction(async function (t) {
        const dedupSnap = await t.get(dedupRef);
        const chatSnap = await t.get(chatRef);
        if ((dedupSnap && dedupSnap.exists) || (chatSnap && chatSnap.exists)) {
            return { posted: false, reason: 'exists', cycleId: key };
        }
        const stamp = adminSdk.firestore.FieldValue.serverTimestamp();
        t.set(dedupRef, {
            cycleId: key,
            postedAt: stamp,
            chatId: LIVE_PREFIX + key,
        });
        t.set(chatRef, {
            uid: 'nacho-bot',
            name: '🦌 Nacho',
            text: text,
            isNachoAuto: false,
            ts: stamp,
            cycleId: key,
        });
        return { posted: true, cycleId: key, text: text, summary: summary };
    });
}

async function handleFavorLiveWrite(db, adminSdk, before, after) {
    if (!shouldAnnounceLive(before, after)) return { posted: false, reason: 'skip' };
    return postLiveAnnouncement(db, adminSdk, after);
}

module.exports = {
    shouldAnnounceLive: shouldAnnounceLive,
    summarizeContributions: summarizeContributions,
    formatLiveAnnouncement: formatLiveAnnouncement,
    postLiveAnnouncement: postLiveAnnouncement,
    handleFavorLiveWrite: handleFavorLiveWrite,
    cycleKey: cycleKey,
};
