'use strict';

// Nacho Radio playlist.
//
// Eligible beats_tracks (audio, duration >= 60, not hidden, not podcast) are
// shuffled once into nacho_radio/queue and played in that order. The tick
// reads the queue doc and advances `pos`. It paginates the whole catalog only
// when the queue is missing, corrupt, or exhausted, or when the track count
// changed (a track was added or removed). New ids are shuffled into the
// unplayed suffix. Removed or now-ineligible ids are skipped in the same tick.
// The queue, the booth, and the radio doc commit in one transaction so two
// overlapping minutes cannot play the same track.

const crypto = require('crypto');
const { beatsCensor } = require('./beats-censor.js');

const PAGE_SIZE = 300;
const SKIP_PER_TX = 25;
const QUEUE_VERSION = 1;

function cryptoRandomInt(n) {
    if (n <= 1) return 0;
    return crypto.randomInt(0, n);
}

function isEligible(t) {
    if (!t) return false;
    if (t.hidden === true) return false;
    if (!t.audioUrl) return false;
    if ((t.duration || 0) < 60) return false;
    if (t.genre === 'podcast') return false;
    return true;
}

function dedupeIds(ids) {
    const out = [];
    const seen = new Set();
    (ids || []).forEach(function (id) {
        if (typeof id !== 'string' || !id || seen.has(id)) return;
        seen.add(id);
        out.push(id);
    });
    return out;
}

// Unbiased Fisher-Yates. `randomInt(n)` returns an integer in [0, n).
function fisherYates(ids, randomInt) {
    const roll = randomInt || cryptoRandomInt;
    const a = ids.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = roll(i + 1);
        if (j === i) continue;
        const tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
    return a;
}

// A new cycle must not open on the track that just closed the previous one
// when there is anything else to play.
function shuffleCycle(ids, avoidId, randomInt) {
    const roll = randomInt || cryptoRandomInt;
    const next = fisherYates(ids, roll);
    if (avoidId && next.length > 1 && next[0] === avoidId) {
        const j = 1 + roll(next.length - 1);
        const tmp = next[0];
        next[0] = next[j];
        next[j] = tmp;
    }
    return next;
}

// Mix newly eligible ids into the unplayed suffix. The played prefix stays.
function absorbNewTracks(ids, pos, newIds, randomInt) {
    const roll = randomInt || cryptoRandomInt;
    const prefix = ids.slice(0, pos);
    const seen = new Set(ids);
    const fresh = [];
    (newIds || []).forEach(function (id) {
        if (typeof id !== 'string' || !id || seen.has(id)) return;
        seen.add(id);
        fresh.push(id);
    });
    if (!fresh.length) return { ids: ids.slice(), pos: pos };
    const suffix = fisherYates(ids.slice(pos).concat(fresh), roll);
    return { ids: prefix.concat(suffix), pos: pos };
}

function parseQueue(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.version !== QUEUE_VERSION) return null;
    if (!Array.isArray(data.ids)) return null;
    if (!Number.isInteger(data.pos) || data.pos < 0 || data.pos > data.ids.length) return null;
    if (!Number.isInteger(data.catalogCount) || data.catalogCount < 0) return null;
    const seen = new Set();
    for (let i = 0; i < data.ids.length; i++) {
        const id = data.ids[i];
        if (typeof id !== 'string' || !id || seen.has(id)) return null;
        seen.add(id);
    }
    return {
        ids: data.ids.slice(),
        pos: data.pos,
        catalogCount: data.catalogCount,
    };
}

function rebuild(eligible, avoidId, randomInt, reason) {
    return {
        ids: shuffleCycle(eligible, avoidId, randomInt),
        pos: 0,
        rebuilt: reason,
    };
}

// `queue` is a parsed queue or null. Eligible ids are the full current set.
function reconcileQueue(queue, eligibleIds, avoidId, randomInt) {
    const eligible = dedupeIds(eligibleIds);
    const avoid = typeof avoidId === 'string' && avoidId ? avoidId : null;
    if (!queue || queue.ids.length === 0 || queue.pos >= queue.ids.length) {
        const reason = queue && queue.ids.length > 0 ? 'cycle' : 'missing';
        return rebuild(eligible, avoid, randomInt, reason);
    }
    const known = new Set(queue.ids);
    const newcomers = [];
    eligible.forEach(function (id) {
        if (!known.has(id)) newcomers.push(id);
    });
    let ids = queue.ids;
    const pos = queue.pos;
    if (newcomers.length) {
        ids = absorbNewTracks(ids, pos, newcomers, randomInt).ids;
    }
    const eligibleSet = new Set(eligible);
    const prefix = ids.slice(0, pos);
    const suffix = ids.slice(pos).filter(function (id) { return eligibleSet.has(id); });
    if (suffix.length === 0) return rebuild(eligible, avoid, randomInt, 'cycle');
    return { ids: prefix.concat(suffix), pos: pos, rebuilt: false };
}

function humanDjActive(dj) {
    return !!(dj && dj.active && dj.djUid && dj.djUid !== 'nacho-dj');
}

function startedMs(value, nowMs) {
    if (!value) return nowMs;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value._seconds) return value._seconds * 1000;
    if (typeof value.toMillis === 'function') return value.toMillis();
    return nowMs;
}

function stillPlaying(dj, nowMs) {
    if (!dj || !dj.active || !dj.isNachoDJ || !dj.trackStartedAt || !dj.trackDuration) return false;
    const start = startedMs(dj.trackStartedAt, nowMs);
    const elapsed = (nowMs - start) / 1000;
    return dj.trackDuration - elapsed > 5;
}

function queueBody(q, admin) {
    return {
        ids: q.ids.slice(),
        pos: q.pos,
        catalogCount: q.catalogCount,
        version: QUEUE_VERSION,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
}

async function countTracks(db) {
    const snap = await db.collection('beats_tracks').count().get();
    const data = snap && typeof snap.data === 'function' ? snap.data() : null;
    const n = data ? data.count : null;
    if (!Number.isInteger(n) || n < 0) throw new Error('bad track count');
    return n;
}

async function loadCatalog(db, admin, pageSize) {
    const idField = admin.firestore.FieldPath.documentId();
    const ids = [];
    let total = 0;
    let last = null;
    let prevId = '';
    const size = pageSize || PAGE_SIZE;
    for (let page = 0; page < 10000; page++) {
        let query = db.collection('beats_tracks').orderBy(idField).limit(size);
        if (last) query = db.collection('beats_tracks').orderBy(idField).startAfter(last).limit(size);
        const snap = await query.get();
        const docs = snap && snap.docs ? snap.docs : [];
        if (!docs.length) break;
        docs.forEach(function (doc) {
            total += 1;
            if (isEligible(doc.data() || {})) ids.push(doc.id);
        });
        const tail = docs[docs.length - 1];
        if (!tail || tail.id === prevId || docs.length < size) break;
        prevId = tail.id;
        last = tail;
    }
    return { ids: dedupeIds(ids), total: total };
}

// Returns { catalog } or { idle: true }. Catalog is null when the saved
// queue is still usable and the collection size has not changed.
async function prepareCatalog(db, admin, queueRef, pageSize) {
    const snap = await queueRef.get();
    const parsed = parseQueue(snap.exists ? snap.data() : null);
    if (!parsed || (parsed.ids.length > 0 && parsed.pos >= parsed.ids.length)) {
        return { catalog: await loadCatalog(db, admin, pageSize) };
    }
    let count;
    try {
        count = await countTracks(db);
    } catch (e) {
        return { catalog: await loadCatalog(db, admin, pageSize) };
    }
    if (count !== parsed.catalogCount) return { catalog: await loadCatalog(db, admin, pageSize) };
    if (parsed.ids.length === 0) return { idle: true };
    return { catalog: null };
}

async function commitAdvance(tx, env) {
    const djSnap = await tx.get(env.djRef);
    const radioSnap = await tx.get(env.radioRef);
    const queueSnap = await tx.get(env.queueRef);
    const dj = djSnap.exists ? (djSnap.data() || {}) : {};
    const radio = radioSnap.exists ? (radioSnap.data() || {}) : {};
    const nowMs = env.now();

    if (humanDjActive(dj)) return { action: 'human', djUid: dj.djUid };
    if (stillPlaying(dj, nowMs)) {
        const start = startedMs(dj.trackStartedAt, nowMs);
        const remaining = dj.trackDuration - ((nowMs - start) / 1000);
        return { action: 'playing', title: dj.trackTitle, remaining: remaining };
    }

    let parsed = parseQueue(queueSnap.exists ? queueSnap.data() : null);
    const catalog = env.catalog;
    let rebuilt = false;
    if (catalog) {
        const reconciled = reconcileQueue(parsed, catalog.ids, dj.trackId || null, env.randomInt);
        rebuilt = reconciled.rebuilt;
        parsed = {
            ids: reconciled.ids,
            pos: reconciled.pos,
            catalogCount: catalog.total,
        };
    } else if (!parsed) {
        return { action: 'reload' };
    } else if (parsed.ids.length > 0 && parsed.pos >= parsed.ids.length) {
        return { action: 'reload' };
    } else if (parsed.ids.length === 0) {
        return { action: 'empty' };
    }

    if (!parsed.ids.length) {
        tx.set(env.queueRef, queueBody({
            ids: [],
            pos: 0,
            catalogCount: parsed.catalogCount,
        }, env.admin));
        return { action: 'empty', rebuilt: rebuilt };
    }

    let pos = parsed.pos;
    let chosen = null;
    let steps = 0;
    while (pos < parsed.ids.length && steps < env.skipPerTx && !chosen) {
        const id = parsed.ids[pos];
        pos += 1;
        steps += 1;
        const trackSnap = await tx.get(env.db.collection('beats_tracks').doc(id));
        const data = trackSnap.exists ? trackSnap.data() : null;
        if (isEligible(data)) chosen = { id: id, data: data };
    }

    const body = queueBody({
        ids: parsed.ids,
        pos: pos,
        catalogCount: parsed.catalogCount,
    }, env.admin);

    if (!chosen) {
        tx.set(env.queueRef, body);
        if (pos < parsed.ids.length) return { action: 'continue' };
        return { action: 'reload', rebuilt: rebuilt };
    }

    const track = Object.assign({ id: chosen.id }, chosen.data);
    const wasActive = dj.active === true;
    const songCount = (radio.songCount || 0) + 1;
    const prevPlayed = Array.isArray(radio.playedRecently) ? radio.playedRecently : [];
    const newPlayed = prevPlayed.concat([track.id]).slice(-80);
    const publicTitle = beatsCensor(track.title || 'Untitled');
    const publicArtist = beatsCensor(track.artist || track.authorName || 'Unknown');
    function stamp() {
        return env.admin.firestore.FieldValue.serverTimestamp();
    }

    tx.set(env.djRef, {
        djUid: 'nacho-dj',
        djName: '🦌 Nacho',
        isNachoDJ: true,
        active: true,
        trackId: track.id,
        trackTitle: publicTitle,
        trackArtist: publicArtist,
        trackAudioUrl: track.audioUrl,
        trackCoverArt: track.coverArt || track.coverUrl || '',
        trackDuration: track.duration || 180,
        trackStartedAt: stamp(),
        artistUid: track.authorId || '',
        songCount: songCount,
        playbackTime: 0,
        playbackUpdatedAt: stamp(),
        startedAt: wasActive ? (dj.startedAt || stamp()) : stamp(),
    });
    tx.set(env.radioRef, {
        playedRecently: newPlayed,
        songCount: songCount,
        lastUpdated: stamp(),
    });
    tx.set(env.queueRef, body);

    const shouldAnnounce = !wasActive || (songCount % 10 === 1);
    const msg = wasActive
        ? `🦌 Nacho Radio: "${publicTitle}" by ${publicArtist} is up next 🎵 Tune in!`
        : `🦌 **Nacho Radio** is live! Spinning beats from the Bitcoin Beats library. Now playing: "${publicTitle}" by ${publicArtist} 🎵 Tune in!`;

    return {
        action: 'played',
        track: track,
        trackId: track.id,
        songCount: songCount,
        wasActive: wasActive,
        shouldAnnounce: shouldAnnounce,
        msg: msg,
        rebuilt: rebuilt,
    };
}

async function runNachoRadioTick(opts) {
    const db = opts.db;
    const admin = opts.admin;
    const now = opts.now || function () { return Date.now(); };
    const randomInt = opts.randomInt || cryptoRandomInt;
    const pageSize = opts.pageSize || PAGE_SIZE;
    const log = opts.log || console;
    const fastPath = opts.fastPath !== false;
    const skipPerTx = opts.skipPerTx || SKIP_PER_TX;

    const djRef = db.collection('global_chat_meta').doc('live_dj');
    const radioRef = db.collection('global_chat_meta').doc('nacho_radio');
    const queueRef = db.collection('nacho_radio').doc('queue');

    if (fastPath) {
        const djSnap = await djRef.get();
        const dj = djSnap.exists ? (djSnap.data() || {}) : {};
        if (humanDjActive(dj)) {
            log.log('[NachoRadio] Human DJ active:', dj.djUid);
            return { action: 'human' };
        }
        if (stillPlaying(dj, now())) {
            const start = startedMs(dj.trackStartedAt, now());
            const remaining = dj.trackDuration - ((now() - start) / 1000);
            log.log('[NachoRadio] Playing: "' + (dj.trackTitle || '') + '" — ' + remaining.toFixed(0) + 's left');
            return { action: 'playing' };
        }
    }

    let prepared;
    try {
        prepared = await prepareCatalog(db, admin, queueRef, pageSize);
    } catch (e) {
        log.error('[NachoRadio] fetch error:', e && e.message ? e.message : e);
        return { action: 'error' };
    }
    if (prepared.idle) {
        log.error('[NachoRadio] No playable tracks found');
        return { action: 'empty' };
    }

    let catalog = prepared.catalog;
    const env = {
        db: db,
        admin: admin,
        now: now,
        randomInt: randomInt,
        djRef: djRef,
        radioRef: radioRef,
        queueRef: queueRef,
        catalog: catalog,
        skipPerTx: skipPerTx,
    };

    for (let hop = 0; hop < 40; hop++) {
        env.catalog = catalog;
        const result = await db.runTransaction(function (tx) {
            return commitAdvance(tx, env);
        });
        if (result.action === 'human') {
            log.log('[NachoRadio] Human DJ active:', result.djUid);
            return result;
        }
        if (result.action === 'playing') {
            log.log('[NachoRadio] Playing: "' + (result.title || '') + '" — ' + Number(result.remaining || 0).toFixed(0) + 's left');
            return result;
        }
        if (result.action === 'played') {
            if (result.rebuilt === 'cycle') log.log('[NachoRadio] Queue exhausted — reshuffling');
            if (result.shouldAnnounce) {
                await db.collection('global_chat').add({
                    uid: 'nacho-dj',
                    name: '🦌 Nacho',
                    text: result.msg,
                    ts: admin.firestore.FieldValue.serverTimestamp(),
                    isNachoAuto: true,
                }).catch(function (e) {
                    log.warn('[NachoRadio] chat post failed:', e && e.message ? e.message : e);
                });
            }
            const track = result.track;
            log.log('[NachoRadio] ▶ "' + (track.title || '') + '" by ' + (track.artist || track.authorName || '') + ' (' + track.duration + 's) | song #' + result.songCount);
            return result;
        }
        if (result.action === 'continue') continue;
        if (result.action === 'reload') {
            if (hop >= 4) {
                log.error('[NachoRadio] No playable tracks found');
                return { action: 'empty' };
            }
            try {
                catalog = await loadCatalog(db, admin, pageSize);
            } catch (e) {
                log.error('[NachoRadio] fetch error:', e && e.message ? e.message : e);
                return { action: 'error' };
            }
            continue;
        }
        log.error('[NachoRadio] No playable tracks found');
        return result;
    }
    log.error('[NachoRadio] No playable tracks found');
    return { action: 'empty' };
}

module.exports = {
    isEligible: isEligible,
    fisherYates: fisherYates,
    shuffleCycle: shuffleCycle,
    absorbNewTracks: absorbNewTracks,
    reconcileQueue: reconcileQueue,
    parseQueue: parseQueue,
    runNachoRadioTick: runNachoRadioTick,
};
