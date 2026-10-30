#!/usr/bin/env node
// Nacho Radio shuffle bag. Every eligible track plays once per cycle.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const radio = require('../functions/src/nachoRadio');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
    return function () {
        let run;
        try { run = fn(); }
        catch (e) {
            console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
            failed++;
            return Promise.resolve();
        }
        const ok = function () { console.log('✅ ' + name); passed++; };
        const bad = function (e) { console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e)); failed++; };
        if (run && typeof run.then === 'function') return run.then(ok, bad);
        ok();
        return Promise.resolve();
    };
}

function sameMembers(actual, expected) {
    assert.deepEqual(actual.slice().sort(), expected.slice().sort());
}

function roll(n) { return n - 1; }

const admin = {
    firestore: {
        FieldValue: {
            serverTimestamp: function () { return { _serverTimestamp: true }; },
        },
        FieldPath: {
            documentId: function () { return '__name__'; },
        },
    },
};

const silent = { log: function () {}, error: function () {}, warn: function () {} };
let clock = 1700000000000;

function memoryDb(seed) {
    const docs = {};
    Object.keys(seed || {}).forEach(function (key) {
        docs[key] = seed[key];
    });
    let tail = Promise.resolve();
    let seq = 0;
    const db = {
        docs: docs,
        pages: 0,
        counts: 0,
        txCount: 0,
        chats: [],
        failCatalog: false,
    };
    function rowsUnder(prefix) {
        const head = prefix + '/';
        const out = [];
        Object.keys(docs).forEach(function (p) {
            if (p.indexOf(head) !== 0) return;
            const rest = p.slice(head.length);
            if (!rest || rest.indexOf('/') !== -1) return;
            out.push({
                id: rest,
                exists: true,
                data: function () {
                    return docs[p] ? Object.assign({}, docs[p]) : undefined;
                },
            });
        });
        return out;
    }
    function pack(list) {
        return {
            empty: list.length === 0,
            size: list.length,
            docs: list,
            forEach: function (fn) { list.forEach(fn); },
        };
    }
    function clone(data) {
        const copy = {};
        Object.keys(data || {}).forEach(function (key) {
            const value = data[key];
            if (value && value._serverTimestamp) {
                const ms = clock;
                copy[key] = {
                    _seconds: Math.floor(ms / 1000),
                    toMillis: function () { return ms; },
                };
            } else if (Array.isArray(value)) {
                copy[key] = value.slice();
            } else {
                copy[key] = value;
            }
        });
        return copy;
    }
    function ref(docPath) {
        return {
            path: docPath,
            id: docPath.split('/').pop(),
            get: async function () {
                const has = Object.prototype.hasOwnProperty.call(docs, docPath);
                const data = docs[docPath];
                return {
                    exists: has,
                    id: docPath.split('/').pop(),
                    data: function () { return has ? Object.assign({}, data) : undefined; },
                };
            },
        };
    }
    function collectionAt(prefix) {
        return {
            path: prefix,
            doc: function (id) { return ref(prefix + '/' + id); },
            add: async function (data) {
                const id = 'm' + (++seq);
                const stored = clone(data);
                docs[prefix + '/' + id] = stored;
                if (prefix === 'global_chat') db.chats.push(stored);
                return { id: id };
            },
            count: function () {
                return {
                    get: async function () {
                        db.counts += 1;
                        const n = rowsUnder(prefix).length;
                        return { data: function () { return { count: n }; } };
                    },
                };
            },
            orderBy: function () {
                const state = { lim: null, after: null };
                const api = {
                    limit: function (n) { state.lim = n; return api; },
                    startAfter: function (snap) { state.after = snap && snap.id; return api; },
                    get: async function () {
                        if (db.failCatalog && prefix === 'beats_tracks') throw new Error('catalog down');
                        if (prefix === 'beats_tracks') db.pages += 1;
                        let rows = rowsUnder(prefix).sort(function (a, b) {
                            if (a.id < b.id) return -1;
                            if (a.id > b.id) return 1;
                            return 0;
                        });
                        if (state.after) rows = rows.filter(function (row) { return row.id > state.after; });
                        if (state.lim != null) rows = rows.slice(0, state.lim);
                        return pack(rows);
                    },
                };
                return api;
            },
        };
    }
    db.collection = function (name) { return collectionAt(name); };
    db.runTransaction = function (fn) {
        db.txCount += 1;
        const run = tail.then(async function () {
            const staged = [];
            const tx = {
                get: function (r) { return r.get(); },
                set: function (r, data) { staged.push({ path: r.path, data: data }); },
            };
            const result = await fn(tx);
            staged.forEach(function (w) { docs[w.path] = clone(w.data); });
            return result;
        });
        tail = run.then(function () { return null; }, function () { return null; });
        return run;
    };
    return db;
}

function track(fields) {
    return Object.assign({
        title: 'Song',
        artist: 'Artist',
        audioUrl: 'https://example/audio',
        duration: 120,
        authorId: 'author',
        coverUrl: 'https://example/cover',
    }, fields || {});
}

function endedBooth(extra) {
    return Object.assign({
        active: true,
        isNachoDJ: true,
        djUid: 'nacho-dj',
        djName: '🦌 Nacho',
        trackId: 'prev',
        trackTitle: 'Prev',
        trackDuration: 120,
        trackStartedAt: { _seconds: 1, toMillis: function () { return 1000; } },
        startedAt: { pin: 1 },
    }, extra || {});
}

function savedQueue(ids, pos, catalogCount) {
    return { version: 1, ids: ids.slice(), pos: pos, catalogCount: catalogCount };
}

function tick(db, extra) {
    return radio.runNachoRadioTick(Object.assign({
        db: db,
        admin: admin,
        now: function () { return clock; },
        randomInt: roll,
        pageSize: 2,
        log: silent,
    }, extra || {}));
}

function advance() { clock += 1000000; }

const queue = [];

queue.push(test('fisher-yates is a permutation and does not mutate the source', function () {
    const src = ['a', 'b', 'c'];
    const out = radio.fisherYates(src, function () { return 0; });
    assert.deepEqual(src, ['a', 'b', 'c']);
    assert.deepEqual(out, ['b', 'c', 'a']);
    const once = radio.shuffleCycle(['only'], 'only');
    assert.deepEqual(once, ['only']);
    for (let i = 0; i < 30; i++) {
        const shuffled = radio.shuffleCycle(['a', 'b', 'c', 'd'], 'a');
        assert.notStrictEqual(shuffled[0], 'a');
        sameMembers(shuffled, ['a', 'b', 'c', 'd']);
    }
    assert.deepEqual(radio.shuffleCycle(['a', 'b', 'c'], 'a', roll), ['c', 'b', 'a']);
}));

queue.push(test('new tracks mix into the unplayed suffix and a dead suffix starts a new cycle', function () {
    const absorbed = radio.absorbNewTracks(['a', 'b', 'c', 'd'], 2, ['e'], roll);
    assert.deepEqual(absorbed, { ids: ['a', 'b', 'c', 'd', 'e'], pos: 2 });
    const mixed = radio.absorbNewTracks(['a', 'b', 'c', 'd'], 2, ['e'], function () { return 0; });
    assert.deepEqual(mixed.ids.slice(0, 2), ['a', 'b']);
    sameMembers(mixed.ids.slice(2), ['c', 'd', 'e']);
    const added = radio.reconcileQueue(
        { ids: ['a', 'b', 'c'], pos: 1, catalogCount: 3 },
        ['a', 'b', 'c', 'd'],
        null,
        roll
    );
    assert.strictEqual(added.rebuilt, false);
    assert.strictEqual(added.pos, 1);
    assert.deepEqual(added.ids, ['a', 'b', 'c', 'd']);
    const removed = radio.reconcileQueue(
        { ids: ['a', 'b', 'c'], pos: 1, catalogCount: 3 },
        ['a', 'c'],
        null,
        roll
    );
    assert.deepEqual(removed.ids, ['a', 'c']);
    assert.strictEqual(removed.pos, 1);
    assert.strictEqual(removed.rebuilt, false);
    const cycle = radio.reconcileQueue(
        { ids: ['a', 'b', 'c'], pos: 3, catalogCount: 3 },
        ['a', 'b', 'c'],
        'a',
        roll
    );
    assert.strictEqual(cycle.rebuilt, 'cycle');
    assert.strictEqual(cycle.pos, 0);
    assert.deepEqual(cycle.ids, ['c', 'b', 'a']);
    assert.notStrictEqual(cycle.ids[0], 'a');
    const fresh = radio.reconcileQueue(null, ['b', 'a'], 'a', roll);
    assert.strictEqual(fresh.rebuilt, 'missing');
    assert.deepEqual(fresh.ids, ['b', 'a']);
}));

queue.push(test('a missing or corrupt queue doc is not playable as-is', function () {
    assert.strictEqual(radio.parseQueue(null), null);
    assert.strictEqual(radio.parseQueue({ ids: ['a'], pos: 0, catalogCount: 1 }), null);
    assert.strictEqual(radio.parseQueue({ version: 1, ids: 'nope', pos: 0, catalogCount: 1 }), null);
    assert.strictEqual(radio.parseQueue({ version: 1, ids: ['a', 'a'], pos: 0, catalogCount: 1 }), null);
    assert.strictEqual(radio.parseQueue({ version: 1, ids: ['a'], pos: -1, catalogCount: 1 }), null);
    assert.strictEqual(radio.parseQueue({ version: 1, ids: ['a'], pos: 2, catalogCount: 1 }), null);
    const ok = radio.parseQueue({ version: 1, ids: ['a'], pos: 1, catalogCount: 4 });
    assert.strictEqual(ok.pos, 1);
    assert.deepEqual(ok.ids, ['a']);
    assert.ok(!radio.isEligible({ title: 'Pod', audioUrl: 'https://x', duration: 120, genre: 'podcast' }));
    assert.ok(!radio.isEligible({ audioUrl: 'https://x', duration: 59 }));
    assert.ok(!radio.isEligible({ audioUrl: 'https://x', duration: 120, hidden: true }));
    assert.ok(!radio.isEligible({ duration: 120 }));
    assert.strictEqual(radio.isEligible({ audioUrl: 'https://x', duration: 60 }), true);
}));

queue.push(test('the scheduler, the censor, and crypto randomness stay wired', function () {
    const src = fs.readFileSync(path.join(root, 'functions/src/nachoRadio.js'), 'utf8');
    const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    assert.ok(src.includes('crypto.randomInt'));
    assert.ok(!src.includes('Math.random'));
    assert.ok(src.includes('runTransaction'));
    assert.ok(!src.includes('limit(500)'));
    assert.ok(src.includes("collection('nacho_radio')"));
    const start = index.indexOf('// NACHO RADIO');
    const end = index.indexOf('// GIFTING, KEYS, CIPHERS');
    const body = index.slice(start, end);
    assert.ok(body.includes('exports.nachoRadioTick'));
    assert.ok(body.includes("schedule: 'every 1 minutes'"));
    assert.ok(body.includes('runNachoRadioTick'));
    assert.ok(body.includes("region: 'us-central1'"));
    assert.ok(body.includes("memory: '256MiB'"));
    assert.ok(!body.includes('Math.random'));
    assert.ok(!body.includes('limit(500)'));
    const at = rules.indexOf('match /nacho_radio/{docId}');
    assert.ok(at !== -1);
    const block = rules.slice(at, rules.indexOf('match /', at + 10));
    assert.ok(block.includes('allow read, write: if false'));
    assert.ok(!/allow\s+read\s*:\s*if\s+true/.test(block));
    assert.ok(!/allow\s+(create|update|write)\s*:\s*if\s+true/.test(block));
}));

queue.push(test('pagination plays each eligible track once and does not rescan mid-cycle', async function () {
    const db = memoryDb({
        'beats_tracks/a': track({ title: 'Alpha', artist: 'Ann', duration: 60, authorId: 'author-a' }),
        'beats_tracks/b': track({ title: 'Too Short', duration: 59 }),
        'beats_tracks/c': track({ title: 'Cee' }),
        'beats_tracks/d': track({ title: 'Pod', genre: 'podcast', duration: 400 }),
        'beats_tracks/e': track({ title: 'Ee' }),
        'beats_tracks/f': track({ title: 'Hidden', hidden: true, duration: 400 }),
        'beats_tracks/g': track({ title: 'Gee' }),
        'beats_tracks/h': track({ title: 'Silent', audioUrl: '' }),
        'beats_tracks/i': track({ title: 'Eye' }),
    });
    const first = await tick(db);
    assert.strictEqual(first.action, 'played');
    assert.strictEqual(first.trackId, 'a');
    assert.strictEqual(first.songCount, 1);
    assert.strictEqual(db.pages, 5);
    assert.strictEqual(db.counts, 0);
    const bag = db.docs['nacho_radio/queue'];
    assert.deepEqual(bag.ids, ['a', 'c', 'e', 'g', 'i']);
    assert.strictEqual(bag.pos, 1);
    assert.strictEqual(bag.catalogCount, 9);
    assert.strictEqual(bag.version, 1);
    const dj = db.docs['global_chat_meta/live_dj'];
    assert.strictEqual(dj.djUid, 'nacho-dj');
    assert.strictEqual(dj.isNachoDJ, true);
    assert.strictEqual(dj.active, true);
    assert.strictEqual(dj.trackAudioUrl, 'https://example/audio');
    assert.strictEqual(dj.trackCoverArt, 'https://example/cover');
    assert.strictEqual(dj.artistUid, 'author-a');
    assert.strictEqual(dj.trackTitle, 'Alpha');
    assert.ok(db.chats.length === 1);
    assert.strictEqual(db.chats[0].uid, 'nacho-dj');
    assert.strictEqual(db.chats[0].isNachoAuto, true);
    assert.ok(db.chats[0].text.indexOf('is live') !== -1);
    assert.ok(db.chats[0].text.indexOf('Now playing') !== -1);
    assert.ok(db.chats[0].text.indexOf('Alpha') !== -1);
    assert.ok(db.chats[0].text.indexOf('is up next') === -1);

    db.pages = 0;
    db.counts = 0;
    db.docs['global_chat_meta/nacho_radio'].playedRecently = ['a', 'c', 'e', 'g', 'i'];
    advance();
    const second = await tick(db);
    assert.strictEqual(second.trackId, 'c');
    assert.strictEqual(db.pages, 0);
    assert.strictEqual(db.counts, 1);
    assert.strictEqual(db.chats.length, 1);

    const played = ['a', 'c'];
    for (let n = 0; n < 3; n++) {
        advance();
        played.push((await tick(db)).trackId);
    }
    assert.deepEqual(played, ['a', 'c', 'e', 'g', 'i']);
    const before = db.pages;
    advance();
    const nextCycle = await tick(db);
    assert.ok(db.pages > before);
    assert.strictEqual(nextCycle.trackId, 'a');
    assert.notStrictEqual(nextCycle.trackId, 'i');
}));

queue.push(test('every track plays once per cycle and song 11 posts the up-next line', async function () {
    const db = memoryDb({
        'beats_tracks/a': track({ title: 'Alpha', artist: 'Ann' }),
        'beats_tracks/b': track({ title: 'Beta', artist: 'Bea' }),
    });
    const ids = [];
    for (let n = 0; n < 11; n++) {
        const result = await tick(db);
        assert.strictEqual(result.action, 'played');
        ids.push(result.trackId);
        if (n < 10) advance();
    }
    assert.deepEqual(ids, ['a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a']);
    for (let i = 0; i < ids.length - 1; i += 2) {
        sameMembers(ids.slice(i, i + 2), ['a', 'b']);
    }
    assert.strictEqual(db.chats.length, 2);
    assert.ok(db.chats[0].text.indexOf('**Nacho Radio** is live') !== -1);
    assert.ok(db.chats[0].text.indexOf('Alpha') !== -1);
    assert.strictEqual(db.chats[0].uid, 'nacho-dj');
    assert.strictEqual(db.chats[0].isNachoAuto, true);
    assert.ok(db.chats[1].text.indexOf('is up next') !== -1);
    assert.ok(db.chats[1].text.indexOf('Alpha') !== -1);
    assert.ok(db.chats[1].text.indexOf('is live') === -1);
    assert.strictEqual(db.chats[1].uid, 'nacho-dj');
    assert.strictEqual(db.chats[1].isNachoAuto, true);
    assert.strictEqual(db.docs['global_chat_meta/nacho_radio'].songCount, 11);
    assert.strictEqual(db.docs['global_chat_meta/live_dj'].songCount, 11);
}));

queue.push(test('a track added mid-cycle plays before the next cycle, and a removed one is skipped', async function () {
    const db = memoryDb({
        'beats_tracks/a': track({ title: 'A' }),
        'beats_tracks/b': track({ title: 'B' }),
        'beats_tracks/c': track({ title: 'C' }),
        'global_chat_meta/live_dj': endedBooth({ trackId: 'a' }),
        'global_chat_meta/nacho_radio': { songCount: 4, playedRecently: ['a'] },
        'nacho_radio/queue': savedQueue(['a', 'b', 'c'], 1, 3),
    });
    db.docs['beats_tracks/d'] = track({ title: 'D' });
    const rest = [];
    for (let n = 0; n < 3; n++) {
        rest.push((await tick(db)).trackId);
        advance();
    }
    sameMembers(rest, ['b', 'c', 'd']);
    assert.ok(rest.indexOf('a') === -1);
    const cycle = await tick(db);
    assert.notStrictEqual(cycle.trackId, rest[rest.length - 1]);
    assert.strictEqual(cycle.rebuilt, 'cycle');

    const dropped = memoryDb({
        'beats_tracks/b': track({ title: 'B' }),
        'beats_tracks/c': track({ title: 'C' }),
        'global_chat_meta/live_dj': endedBooth({ trackId: 'old' }),
        'global_chat_meta/nacho_radio': { songCount: 2, playedRecently: [] },
        'nacho_radio/queue': savedQueue(['a', 'b', 'c'], 0, 3),
    });
    const skipped = await tick(dropped);
    assert.strictEqual(skipped.action, 'played');
    assert.strictEqual(skipped.trackId, 'b');
    assert.ok(dropped.docs['nacho_radio/queue'].ids.indexOf('a') === -1);

    const hidden = memoryDb({
        'beats_tracks/a': track({ title: 'A', hidden: true }),
        'beats_tracks/b': track({ title: 'B', genre: 'podcast' }),
        'beats_tracks/c': track({ title: 'C' }),
        'global_chat_meta/live_dj': endedBooth({ trackId: 'old' }),
        'global_chat_meta/nacho_radio': { songCount: 2, playedRecently: [] },
        'nacho_radio/queue': savedQueue(['a', 'b', 'c'], 0, 3),
    });
    const before = hidden.pages;
    const hopped = await tick(hidden, { skipPerTx: 1 });
    assert.strictEqual(hopped.trackId, 'c');
    assert.strictEqual(hidden.pages, before);
    assert.ok(hidden.txCount >= 3);
}));

queue.push(test('exhaustion avoids repeating the last track, and a corrupt queue rebuilds', async function () {
    const db = memoryDb({
        'beats_tracks/a': track({ title: 'A' }),
        'beats_tracks/b': track({ title: 'B' }),
        'global_chat_meta/live_dj': endedBooth({ trackId: 'a' }),
        'global_chat_meta/nacho_radio': { songCount: 2, playedRecently: ['b', 'a'] },
        'nacho_radio/queue': savedQueue(['b', 'a'], 2, 2),
    });
    const next = await tick(db);
    assert.strictEqual(next.action, 'played');
    assert.strictEqual(next.trackId, 'b');
    assert.notStrictEqual(next.trackId, 'a');
    assert.strictEqual(next.rebuilt, 'cycle');
    assert.strictEqual(db.docs['global_chat_meta/live_dj'].startedAt.pin, 1);

    const lone = memoryDb({
        'beats_tracks/a': track({ title: 'Only' }),
        'global_chat_meta/live_dj': endedBooth({ trackId: 'a' }),
        'global_chat_meta/nacho_radio': { songCount: 1, playedRecently: ['a'] },
        'nacho_radio/queue': savedQueue(['a'], 1, 1),
    });
    const again = await tick(lone);
    assert.strictEqual(again.trackId, 'a');

    const corrupt = memoryDb({
        'beats_tracks/a': track({ title: 'A' }),
        'beats_tracks/b': track({ title: 'B' }),
        'nacho_radio/queue': { ids: 'nope', pos: 0 },
    });
    const rebuilt = await tick(corrupt);
    assert.strictEqual(rebuilt.trackId, 'a');
    assert.deepEqual(corrupt.docs['nacho_radio/queue'].ids, ['a', 'b']);
    assert.strictEqual(corrupt.docs['nacho_radio/queue'].version, 1);

    const recent = [];
    for (let i = 0; i < 80; i++) recent.push('p' + i);
    const capped = memoryDb({
        'beats_tracks/a': track({ title: 'A' }),
        'global_chat_meta/live_dj': endedBooth(),
        'global_chat_meta/nacho_radio': { songCount: 5, playedRecently: recent },
        'nacho_radio/queue': savedQueue(['a'], 0, 1),
    });
    const played = await tick(capped);
    assert.strictEqual(played.trackId, 'a');
    const history = capped.docs['global_chat_meta/nacho_radio'].playedRecently;
    assert.strictEqual(history.length, 80);
    assert.strictEqual(history[history.length - 1], 'a');
    assert.ok(history.indexOf('p0') === -1);
    assert.ok(history.indexOf('p1') !== -1);
}));

queue.push(test('a human booth and a track still playing do not advance the bag', async function () {
    const human = memoryDb({
        'beats_tracks/a': track(),
        'global_chat_meta/live_dj': { active: true, djUid: 'alice', djName: 'Alice' },
        'nacho_radio/queue': savedQueue(['a'], 0, 1),
    });
    const raced = await tick(human, { fastPath: false });
    assert.strictEqual(raced.action, 'human');
    assert.strictEqual(human.docs['nacho_radio/queue'].pos, 0);
    assert.strictEqual(human.docs['global_chat_meta/live_dj'].djUid, 'alice');
    assert.strictEqual(human.chats.length, 0);
    const txBefore = human.txCount;
    const fast = await tick(human);
    assert.strictEqual(fast.action, 'human');
    assert.strictEqual(human.txCount, txBefore);

    const live = memoryDb({
        'beats_tracks/a': track(),
        'global_chat_meta/live_dj': {
            active: true,
            isNachoDJ: true,
            djUid: 'nacho-dj',
            trackTitle: 'Live',
            trackDuration: 180,
            trackStartedAt: { _seconds: Math.floor(clock / 1000), toMillis: function () { return clock; } },
        },
        'nacho_radio/queue': savedQueue(['a'], 0, 1),
    });
    const held = await tick(live);
    assert.strictEqual(held.action, 'playing');
    assert.strictEqual(live.txCount, 0);
    assert.strictEqual(live.pages, 0);
    assert.strictEqual(live.docs['nacho_radio/queue'].pos, 0);
    const inside = await tick(live, { fastPath: false });
    assert.strictEqual(inside.action, 'playing');
    assert.strictEqual(live.docs['nacho_radio/queue'].pos, 0);
    assert.strictEqual(live.chats.length, 0);
}));

queue.push(test('overlapping ticks play one track', async function () {
    const db = memoryDb({
        'beats_tracks/a': track({ title: 'Alpha', artist: 'Ann' }),
        'beats_tracks/b': track({ title: 'Beta', artist: 'Bea' }),
        'nacho_radio/queue': savedQueue(['a', 'b'], 0, 2),
    });
    const pair = await Promise.all([
        tick(db, { fastPath: false }),
        tick(db, { fastPath: false }),
    ]);
    const played = pair.filter(function (row) { return row.action === 'played'; });
    const held = pair.filter(function (row) { return row.action === 'playing'; });
    assert.strictEqual(played.length, 1);
    assert.strictEqual(held.length, 1);
    assert.strictEqual(played[0].trackId, 'a');
    assert.strictEqual(db.txCount, 2);
    assert.strictEqual(db.docs['nacho_radio/queue'].pos, 1);
    assert.strictEqual(db.docs['global_chat_meta/nacho_radio'].songCount, 1);
    assert.strictEqual(db.docs['global_chat_meta/live_dj'].trackId, 'a');
    assert.strictEqual(db.chats.length, 1);
    assert.strictEqual(db.chats[0].isNachoAuto, true);
    assert.strictEqual(db.chats[0].uid, 'nacho-dj');
}));

queue.push(test('an empty library is remembered, profanity is masked, and a catalog failure does not write the booth', async function () {
    const empty = memoryDb({});
    const none = await tick(empty);
    assert.strictEqual(none.action, 'empty');
    assert.deepEqual(empty.docs['nacho_radio/queue'].ids, []);
    assert.strictEqual(empty.docs['nacho_radio/queue'].catalogCount, 0);
    assert.strictEqual(empty.docs['global_chat_meta/live_dj'], undefined);
    const pages = empty.pages;
    const again = await tick(empty);
    assert.strictEqual(again.action, 'empty');
    assert.strictEqual(empty.pages, pages);
    assert.strictEqual(empty.counts, 1);

    const rude = memoryDb({
        'beats_tracks/a': track({ title: 'Fuck the Fed', artist: 'Shit Band' }),
    });
    const spun = await tick(rude);
    assert.strictEqual(spun.trackId, 'a');
    const booth = rude.docs['global_chat_meta/live_dj'];
    assert.ok(booth.trackTitle.indexOf('F**k') !== -1);
    assert.ok(booth.trackTitle.indexOf('Fuck') === -1);
    assert.ok(booth.trackArtist.indexOf('S**t') !== -1);
    assert.ok(rude.chats[0].text.indexOf('F**k the Fed') !== -1);
    assert.strictEqual(rude.chats[0].uid, 'nacho-dj');
    assert.strictEqual(rude.chats[0].isNachoAuto, true);

    const down = memoryDb({ 'beats_tracks/a': track() });
    down.failCatalog = true;
    const err = await tick(down);
    assert.strictEqual(err.action, 'error');
    assert.strictEqual(down.docs['global_chat_meta/live_dj'], undefined);
    assert.strictEqual(down.chats.length, 0);
}));

queue.reduce(function (p, next) { return p.then(function () { return next(); }); }, Promise.resolve()).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
});
