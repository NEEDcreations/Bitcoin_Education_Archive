'use strict';

// Public leaderboard snapshots. One stats doc per board, top 25.
//
// XP week and month refresh every 10 minutes. XP all-time, PvP, and raid
// all-time refresh every 15. Favor hashers refresh every 5 minutes while a
// Satoshi's Favor cycle is active and every 30 minutes otherwise.
//
// A board is rebuilt only when stats/lb_dirty says its source changed after
// the last snapshot. The dirty doc is stamped from syncPublicProfile, which
// sees every user write. lastSeen and other non-board fields do not stamp it.
//
// Rank past 25 is not stored. An exact rank for every player is one count
// query per player, or a full scan of public_profiles. ghostMode is absent on
// most profiles, so a count() cannot drop ghosts either. The snapshot holds
// the exact top 25. A signed-in player outside that list sees "25+" and the
// score already on their own profile. No per-player rank query is issued.
//
// Banned players stay on the board. The existing boards do not hide them.
// Ghost-mode players are left off the public snapshot.

const { displayName, safePic } = require('./streakBoard');

const BOARD_SIZE = 25;
const FETCH_LIMIT = 60;
const INTERVAL_SLACK_MS = 60 * 1000;
const DOC_MAX = 800000;
const DIRTY_DOC = 'lb_dirty';
const FAVOR_STATE = 'current';

const RANK_BEYOND_25 = {
    exact: false,
    label: '25+',
    reason: 'Exact rank past the top 25 is not stored. A true rank is one count query per player, or a full scan of public_profiles, and ghostMode is missing on most profiles so a count cannot drop ghosts. The snapshot keeps the top 25 exact. A signed-in player outside that list sees 25+ and the score already on their profile. No per-player rank query is issued.'
};

const BOARDS = {
    xpAll: { key: 'xpAll', docId: 'lb_xp_alltime', field: 'points', intervalMs: 15 * 60 * 1000, kind: 'xp' },
    xpWeek: { key: 'xpWeek', docId: 'lb_xp_week', field: 'weeklyXP', intervalMs: 10 * 60 * 1000, kind: 'xp' },
    xpMonth: { key: 'xpMonth', docId: 'lb_xp_month', field: 'monthlyXP', intervalMs: 10 * 60 * 1000, kind: 'xp' },
    pvp: { key: 'pvp', docId: 'lb_pvp', intervalMs: 15 * 60 * 1000, kind: 'pvp' },
    favor: { key: 'favor', docId: 'lb_favor_hashers', field: 'sfTotalHashes', intervalMs: 5 * 60 * 1000, idleMs: 30 * 60 * 1000, kind: 'favor' },
    raid: { key: 'raid', docId: 'lb_raid_alltime', field: 'raidDamageAllTime', intervalMs: 15 * 60 * 1000, kind: 'raid' }
};

const BOARD_KEYS = Object.keys(BOARDS);

const METRIC_FIELDS = {
    xpAll: ['points'],
    xpWeek: ['weeklyXP'],
    xpMonth: ['monthlyXP'],
    pvp: ['pvpWins', 'pvpLosses'],
    favor: ['sfTotalHashes', 'sfBlocksFound', 'sfBestHash', 'firstHashAt'],
    raid: ['raidDamageAllTime']
};

const DISPLAY_ALL = ['username', 'username_lower', 'profilePic', 'ghostMode'];
const DISPLAY_XP = ['faction', 'earnedHidden', 'lightningAddress', 'lightning'];

function whole(value) {
    const n = Math.floor(Number(value) || 0);
    return n > 0 ? n : 0;
}

function timeMs(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number' && isFinite(value)) return value > 0 ? value : 0;
    if (typeof value === 'object' && typeof value.toMillis === 'function') {
        const n = Number(value.toMillis());
        return n > 0 ? n : 0;
    }
    if (typeof value === 'object' && typeof value._seconds === 'number') {
        const n = value._seconds * 1000 + Math.floor((Number(value._nanoseconds) || 0) / 1e6);
        return n > 0 ? n : 0;
    }
    if (typeof value === 'object' && typeof value.seconds === 'number') {
        const n = value.seconds * 1000 + Math.floor((Number(value.nanoseconds) || 0) / 1e6);
        return n > 0 ? n : 0;
    }
    if (typeof value === 'string') {
        const n = Date.parse(value);
        return Number.isFinite(n) && n > 0 ? n : 0;
    }
    return 0;
}

function stable(value) {
    if (value == null) return null;
    if (typeof value === 'object' && typeof value.toMillis === 'function') return timeMs(value);
    if (Array.isArray(value) || typeof value === 'object') {
        try { return JSON.stringify(value); } catch (e) { return String(value); }
    }
    return value;
}

function changed(before, after, fields) {
    const prev = before || {};
    const next = after || {};
    for (let i = 0; i < fields.length; i++) {
        if (stable(prev[fields[i]]) !== stable(next[fields[i]])) return true;
    }
    return false;
}

function dirtyKeys(before, after) {
    if (!before || !after) return BOARD_KEYS.slice();
    if (changed(before, after, DISPLAY_ALL)) return BOARD_KEYS.slice();
    const keys = [];
    BOARD_KEYS.forEach(function (key) {
        if (changed(before, after, METRIC_FIELDS[key])) keys.push(key);
    });
    if (changed(before, after, DISPLAY_XP)) {
        ['xpAll', 'xpWeek', 'xpMonth', 'pvp'].forEach(function (key) {
            if (keys.indexOf(key) === -1) keys.push(key);
        });
    }
    return keys;
}

function dirtyPatch(before, after, nowMs) {
    const keys = dirtyKeys(before, after);
    if (!keys.length) return null;
    const now = Number(nowMs) || Date.now();
    const patch = {};
    keys.forEach(function (key) { patch[key] = now; });
    return patch;
}

function isGhost(data) {
    return !!(data && data.ghostMode === true);
}

function shortText(value, max) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.slice(0, max || 40);
}

function lightningAddress(data) {
    const raw = data && (data.lightningAddress || data.lightning);
    const text = String(raw || '').trim();
    if (!text || text.length > 100) return '';
    if (/[\s<>"'`]/.test(text)) return '';
    if (text.indexOf('@') === -1 && text.indexOf('lnurl') !== 0 && text.toLowerCase().indexOf('lnbc') !== 0) return '';
    return text;
}

function hasCert(data, id) {
    const list = data && data.earnedHidden;
    return Array.isArray(list) && list.indexOf(id) !== -1;
}

function byValue(a, b) {
    const av = Number(a.value) || 0;
    const bv = Number(b.value) || 0;
    if (bv !== av) return bv - av;
    const an = displayName(a.username).toLowerCase();
    const bn = displayName(b.username).toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    return String(a.uid || '').localeCompare(String(b.uid || ''));
}

function baseRow(row, rank) {
    return {
        rank: rank,
        uid: String(row.uid || ''),
        username: displayName(row.username),
        profilePic: safePic(row.profilePic),
        value: whole(row.value)
    };
}

function packRows(rows, decorate) {
    const copy = rows.map(function (row, i) {
        const packed = baseRow(row, i + 1);
        if (decorate) decorate(packed, row);
        return packed;
    });
    return copy;
}

function stripPics(rows) {
    (rows || []).forEach(function (row) { row.profilePic = ''; });
}

function finishDoc(doc) {
    doc.rankBeyond25 = {
        exact: RANK_BEYOND_25.exact,
        label: RANK_BEYOND_25.label,
        reason: RANK_BEYOND_25.reason
    };
    if (JSON.stringify(doc).length > DOC_MAX && doc.rows) stripPics(doc.rows);
    return doc;
}

function xpRows(profiles, field) {
    const rows = [];
    (profiles || []).forEach(function (profile) {
        const data = (profile && profile.data) || {};
        if (isGhost(data)) return;
        const value = whole(data[field]);
        if (value <= 0) return;
        rows.push({
            uid: profile.id,
            username: data.username,
            profilePic: data.profilePic,
            value: value,
            points: whole(data.points),
            faction: shortText(data.faction, 40),
            certScholar: hasCert(data, 'cert_scholar'),
            certTech: hasCert(data, 'cert_tech'),
            lightningAddress: lightningAddress(data),
            lastSeen: timeMs(data.lastSeen)
        });
    });
    rows.sort(byValue);
    return rows.slice(0, BOARD_SIZE);
}

function buildXpDoc(profiles, spec, nowMs) {
    const rows = packRows(xpRows(profiles, spec.field), function (packed, row) {
        packed.points = whole(row.points);
        if (row.faction) packed.faction = row.faction;
        if (row.certScholar) packed.certScholar = true;
        if (row.certTech) packed.certTech = true;
        if (row.lightningAddress) packed.lightningAddress = row.lightningAddress;
        if (row.lastSeen) packed.lastSeen = row.lastSeen;
    });
    return finishDoc({
        updatedAt: Number(nowMs) || Date.now(),
        intervalMs: spec.intervalMs,
        rows: rows
    });
}

function winRate(wins, losses) {
    const total = wins + losses;
    if (total <= 0) return 0;
    return Math.round((wins / total) * 1000) / 10;
}

function pvpRows(winProfiles, lossProfiles) {
    const byId = {};
    function take(profile) {
        if (!profile || byId[profile.id]) return;
        const data = profile.data || {};
        if (isGhost(data)) return;
        const wins = whole(data.pvpWins);
        const losses = whole(data.pvpLosses);
        if (wins + losses <= 0) return;
        byId[profile.id] = {
            uid: profile.id,
            username: data.username,
            profilePic: data.profilePic,
            wins: wins,
            losses: losses,
            value: winRate(wins, losses),
            lightningAddress: lightningAddress(data)
        };
    }
    (winProfiles || []).forEach(take);
    (lossProfiles || []).forEach(take);
    const rows = Object.keys(byId).map(function (id) { return byId[id]; });
    rows.sort(function (a, b) {
        if (b.value !== a.value) return b.value - a.value;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return byValue(a, b);
    });
    return rows.slice(0, BOARD_SIZE);
}

function buildPvpDoc(winProfiles, lossProfiles, nowMs) {
    const rows = packRows(pvpRows(winProfiles, lossProfiles), function (packed, row) {
        packed.wins = row.wins;
        packed.losses = row.losses;
        if (row.lightningAddress) packed.lightningAddress = row.lightningAddress;
    });
    return finishDoc({
        updatedAt: Number(nowMs) || Date.now(),
        intervalMs: BOARDS.pvp.intervalMs,
        rows: rows
    });
}

function favorRows(profiles) {
    const rows = [];
    (profiles || []).forEach(function (profile) {
        const data = (profile && profile.data) || {};
        if (isGhost(data)) return;
        const value = whole(data.sfTotalHashes);
        if (value <= 0) return;
        const best = Number(data.sfBestHash);
        rows.push({
            uid: profile.id,
            username: data.username,
            profilePic: data.profilePic,
            value: value,
            blocks: whole(data.sfBlocksFound),
            bestHash: Number.isFinite(best) ? best : null,
            firstHashAt: timeMs(data.firstHashAt)
        });
    });
    rows.sort(byValue);
    return rows.slice(0, BOARD_SIZE);
}

function buildFavorDoc(profiles, nowMs, favorActive) {
    const active = favorActive === true;
    const rows = packRows(favorRows(profiles), function (packed, row) {
        if (row.blocks) packed.blocks = row.blocks;
        if (row.bestHash != null) packed.bestHash = row.bestHash;
        if (row.firstHashAt) packed.firstHashAt = row.firstHashAt;
    });
    return finishDoc({
        updatedAt: Number(nowMs) || Date.now(),
        intervalMs: active ? BOARDS.favor.intervalMs : BOARDS.favor.idleMs,
        favorActive: active,
        rows: rows
    });
}

function raidRows(profiles) {
    const rows = [];
    (profiles || []).forEach(function (profile) {
        const data = (profile && profile.data) || {};
        if (isGhost(data)) return;
        const value = whole(data.raidDamageAllTime);
        if (value <= 0) return;
        rows.push({
            uid: profile.id,
            username: data.username,
            profilePic: data.profilePic,
            value: value
        });
    });
    rows.sort(byValue);
    return rows.slice(0, BOARD_SIZE);
}

function buildRaidDoc(profiles, nowMs) {
    return finishDoc({
        updatedAt: Number(nowMs) || Date.now(),
        intervalMs: BOARDS.raid.intervalMs,
        rows: packRows(raidRows(profiles))
    });
}

function favorIntervalMs(active) {
    return active ? BOARDS.favor.intervalMs : BOARDS.favor.idleMs;
}

function shouldRebuild(opts) {
    const o = opts || {};
    if (o.force) return { rebuild: true, reason: 'force' };
    if (!o.hasRows) return { rebuild: true, reason: 'missing' };
    const updatedAt = Number(o.updatedAt) || 0;
    const intervalMs = Number(o.intervalMs) || 0;
    const now = Number(o.now) || 0;
    if (updatedAt && intervalMs && now - updatedAt < intervalMs - INTERVAL_SLACK_MS) {
        return { rebuild: false, reason: 'interval' };
    }
    const dirtyAt = Number(o.dirtyAt) || 0;
    const sourceRev = Number(o.sourceRev) || 0;
    if (!dirtyAt || dirtyAt <= sourceRev) return { rebuild: false, reason: 'clean' };
    return { rebuild: true, reason: 'dirty' };
}

function rowsOf(snap) {
    const rows = [];
    if (!snap || !snap.forEach) return rows;
    snap.forEach(function (doc) {
        rows.push({ id: doc.id, data: (doc.data && doc.data()) || {} });
    });
    return rows;
}

async function readTop(db, field) {
    const snap = await db.collection('public_profiles')
        .where(field, '>', 0)
        .orderBy(field, 'desc')
        .limit(FETCH_LIMIT)
        .get();
    return rowsOf(snap);
}

async function readFavorActive(db) {
    const snap = await db.collection('satoshiFavor').doc(FAVOR_STATE).get();
    if (!snap || !snap.exists) return false;
    const data = snap.data() || {};
    return data.favorActive === true;
}

async function loadBoard(db, key, nowMs, favorActive) {
    const spec = BOARDS[key];
    if (!spec) throw new Error('unknown board ' + key);
    const now = Number(nowMs) || Date.now();
    if (spec.kind === 'pvp') {
        const parts = await Promise.all([
            readTop(db, 'pvpWins'),
            readTop(db, 'pvpLosses')
        ]);
        return buildPvpDoc(parts[0], parts[1], now);
    }
    const profiles = await readTop(db, spec.field);
    if (spec.kind === 'favor') return buildFavorDoc(profiles, now, favorActive === true);
    if (spec.kind === 'raid') return buildRaidDoc(profiles, now);
    return buildXpDoc(profiles, spec, now);
}

async function refreshBoard(db, key, nowMs, opts) {
    const spec = BOARDS[key];
    if (!spec) throw new Error('unknown board ' + key);
    const now = Number(nowMs) || Date.now();
    const force = !!(opts && opts.force);
    const snapRef = db.collection('stats').doc(spec.docId);
    const existingSnap = await snapRef.get();
    const existing = existingSnap && existingSnap.exists ? (existingSnap.data() || {}) : null;
    let favorActive = false;
    let intervalMs = spec.intervalMs;
    if (spec.kind === 'favor') {
        favorActive = await readFavorActive(db);
        intervalMs = favorIntervalMs(favorActive);
    }
    let dirtyAt = 0;
    if (!force) {
        const decisionInterval = shouldRebuild({
            now: now,
            updatedAt: existing && existing.updatedAt,
            intervalMs: intervalMs,
            hasRows: !!(existing && Array.isArray(existing.rows)),
            dirtyAt: 1,
            sourceRev: 0,
            force: false
        });
        if (!decisionInterval.rebuild && decisionInterval.reason === 'interval') {
            return { skipped: true, reason: 'interval', docId: spec.docId, updatedAt: existing.updatedAt };
        }
        const dirtySnap = await db.collection('stats').doc(DIRTY_DOC).get();
        const dirty = dirtySnap && dirtySnap.exists ? (dirtySnap.data() || {}) : {};
        dirtyAt = Number(dirty[key]) || 0;
        const decision = shouldRebuild({
            now: now,
            updatedAt: existing && existing.updatedAt,
            sourceRev: existing && existing.sourceRev,
            dirtyAt: dirtyAt,
            intervalMs: intervalMs,
            hasRows: !!(existing && Array.isArray(existing.rows)),
            force: false
        });
        if (!decision.rebuild) {
            return { skipped: true, reason: decision.reason, docId: spec.docId, updatedAt: existing && existing.updatedAt };
        }
    } else {
        const dirtySnap = await db.collection('stats').doc(DIRTY_DOC).get();
        const dirty = dirtySnap && dirtySnap.exists ? (dirtySnap.data() || {}) : {};
        dirtyAt = Number(dirty[key]) || 0;
        if (spec.kind === 'favor' && opts && opts.favorActive != null) favorActive = opts.favorActive === true;
    }
    const doc = await loadBoard(db, key, now, favorActive);
    doc.sourceRev = dirtyAt && dirtyAt <= now ? dirtyAt : now;
    doc.intervalMs = spec.kind === 'favor' ? favorIntervalMs(favorActive) : spec.intervalMs;
    if (spec.kind === 'favor') doc.favorActive = favorActive;
    await snapRef.set(doc);
    return { skipped: false, reason: force ? 'force' : 'dirty', docId: spec.docId, rows: doc.rows.length, doc: doc };
}

async function refreshMany(db, keys, nowMs, opts) {
    const out = [];
    for (let i = 0; i < keys.length; i++) {
        out.push(await refreshBoard(db, keys[i], nowMs, opts));
    }
    return out;
}

module.exports = {
    BOARD_SIZE: BOARD_SIZE,
    FETCH_LIMIT: FETCH_LIMIT,
    INTERVAL_SLACK_MS: INTERVAL_SLACK_MS,
    DIRTY_DOC: DIRTY_DOC,
    RANK_BEYOND_25: RANK_BEYOND_25,
    BOARDS: BOARDS,
    BOARD_KEYS: BOARD_KEYS,
    dirtyKeys: dirtyKeys,
    dirtyPatch: dirtyPatch,
    isGhost: isGhost,
    buildXpDoc: buildXpDoc,
    buildPvpDoc: buildPvpDoc,
    buildFavorDoc: buildFavorDoc,
    buildRaidDoc: buildRaidDoc,
    favorIntervalMs: favorIntervalMs,
    shouldRebuild: shouldRebuild,
    loadBoard: loadBoard,
    refreshBoard: refreshBoard,
    refreshMany: refreshMany,
    winRate: winRate
};
