// Timechain TV total views and peak.
// Views are one manual tune per viewer per channel per UTC day, folded by the
// minute job. Block-surf does not record a tune. Peak only moves up, and only
// from the aggregator's own concurrent total. Clients cannot write either doc.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const lib = require('../functions/tctv-presence-lib');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (err) {
        console.log('❌ ' + name + ': ' + err.message);
        failed++;
    }
}

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

function ts(ms) {
    return { toMillis: function () { return ms; } };
}

const now = Date.UTC(2026, 9, 22, 15, 4, 0);

test('one viewer, one channel, one UTC day shares a doc id', () => {
    const a = lib.tuneToRecord('v_guest12345', 'news', now, false);
    const b = lib.tuneToRecord('v_guest12345', 'news', now + 60 * 1000, false);
    assert.ok(a && a.id);
    assert.strictEqual(a.id, b.id);
    assert.strictEqual(a.day, '20261022');
    assert.strictEqual(a.id, '20261022_v_guest12345_news');
});

test('a different channel or the next UTC day is a new view', () => {
    const first = lib.tuneToRecord('uid123456', 'news', now, false);
    const other = lib.tuneToRecord('uid123456', 'music', now, false);
    const tomorrow = lib.tuneToRecord('uid123456', 'news', now + 24 * 60 * 60 * 1000, false);
    assert.notStrictEqual(first.id, other.id);
    assert.notStrictEqual(first.id, tomorrow.id);
    assert.strictEqual(tomorrow.day, '20261023');
});

test('block-surf does not record a tune', () => {
    assert.strictEqual(lib.tuneToRecord('v_guest12345', 'news', now, true), null);
    assert.ok(lib.tuneToRecord('v_guest12345', 'news', now, false));
});

test('invented channel ids are not views and not live viewers', () => {
    assert.strictEqual(lib.tuneToRecord('v_guest12345', 'not-a-channel', now, false), null);
    const counts = {};
    lib.accumulatePresence(counts, { station: 'not-a-channel', ts: ts(now) }, now);
    lib.accumulatePresence(counts, { station: 'news', ts: ts(now) }, now);
    assert.deepStrictEqual(counts, { news: 1 });
});

test('a tune doc counts once, and only on its own UTC day', () => {
    const id = '20261022_v_guest12345_news';
    const data = { viewerId: 'v_guest12345', station: 'news', day: '20261022', ts: ts(now) };
    assert.strictEqual(lib.validViewDoc(data, id, now), true);
    assert.strictEqual(lib.validViewDoc(Object.assign({}, data, { counted: true }), id, now), false);
    assert.strictEqual(lib.validViewDoc(Object.assign({}, data, { day: '20261023' }), '20261023_v_guest12345_news', now), false);
    assert.strictEqual(lib.validViewDoc(Object.assign({}, data, { station: 'music' }), id, now), false);
    assert.strictEqual(lib.validViewDoc(data, 'other-id', now), false);
});

test('views are added to the stored total and never replaced by the live total', () => {
    assert.strictEqual(lib.addedViews(48213, 2), 48215);
    assert.strictEqual(lib.addedViews(0, 1), 1);
    assert.strictEqual(lib.addedViews(null, 3), 3);
    assert.strictEqual(lib.addedViews(48213, 0), null);
    assert.strictEqual(lib.addedViews('48213', 1), null);
    assert.notStrictEqual(lib.addedViews(48213, 2), 4);
});

test('peak only rises above the stored value', () => {
    assert.strictEqual(lib.nextPeak(40, 12), null);
    assert.strictEqual(lib.nextPeak(40, 40), null);
    assert.strictEqual(lib.nextPeak(40, 41), 41);
    assert.strictEqual(lib.nextPeak(100000, 6), null);
    assert.strictEqual(lib.nextPeak(null, 0), null);
    assert.strictEqual(lib.nextPeak(null, 4), 4);
    assert.strictEqual(lib.nextPeak('40', 41), null);
});

test('view cursor moves forward and an empty run does not rewind it', () => {
    assert.strictEqual(lib.advanceViewCursor(null, now, null, 0, 200), now - 30000);
    assert.strictEqual(lib.advanceViewCursor(1000, now, null, 0, 200), 1000);
    assert.strictEqual(lib.advanceViewCursor(1000, now, 5000, 3, 200), 5000);
    assert.strictEqual(lib.advanceViewCursor(1000, now, 5000, 200, 200), 4999);
    assert.strictEqual(lib.advanceViewCursor(5000, now, 5000, 200, 200), 5000);
});

test('aggregator folds tunes by ts, increments views, and does not scan', () => {
    const src = read('functions/index.js');
    const start = src.indexOf('exports.tctvAggregatePresence');
    const end = src.indexOf('exports.stravaInitAuth');
    assert.ok(start > 0 && end > start);
    const fn = src.slice(start, end);
    assert.ok(fn.includes("collection('tctv_view_days')"));
    assert.ok(fn.includes(".where('ts', '>', admin.firestore.Timestamp.fromMillis(cursorMs))"));
    assert.ok(fn.includes('.orderBy(\'ts\', \'asc\')'));
    assert.ok(fn.includes('VIEW_FOLD_LIMIT'));
    assert.ok(fn.includes('FieldValue.increment(freshRefs.length)'));
    assert.ok(fn.includes('nextPeak'));
    assert.ok(fn.includes("doc('view_cursor')"));
    assert.ok(fn.includes('getUTCMinutes() === 0'));
    assert.ok(!fn.includes(".collection('tctv_presence').get()"));
    assert.ok(!fn.includes(".collection('tctv_view_days').get()"));
    assert.ok(!fn.includes('count: total'));
    const viewsSet = fn.indexOf("doc('views')");
    assert.ok(viewsSet > 0);
    assert.ok(!fn.slice(viewsSet, viewsSet + 900).includes('count: total'));
});

test('rules deny client writes to views and peak and keep presence rules', () => {
    const rules = read('firestore.rules');
    const statsStart = rules.indexOf('match /tctv_stats/{docId}');
    const presenceStart = rules.indexOf('match /tctv_presence/{viewerId}');
    assert.ok(statsStart > 0 && presenceStart > statsStart);
    const stats = rules.slice(statsStart, presenceStart);
    assert.ok(stats.includes('allow read: if true'));
    assert.ok(stats.includes('allow write: if false'));
    assert.ok(!stats.includes('allow create'));
    assert.ok(!stats.includes('allow update'));
    assert.ok(!stats.includes('count == resource.data'));
    assert.ok(!stats.includes('100000'));

    const daysStart = rules.indexOf('match /tctv_view_days/{docId}');
    const aiStart = rules.indexOf('match /ai_tools_opens/');
    assert.ok(daysStart > presenceStart && aiStart > daysStart);
    const days = rules.slice(daysStart, aiStart);
    assert.ok(days.includes('allow get, list: if false'));
    assert.ok(days.includes('allow update, delete: if false'));
    assert.ok(days.includes('request.resource.data.day == tctvUtcDay()'));
    assert.ok(days.includes('request.resource.data.ts == request.time'));
    assert.ok(days.includes('request.resource.data.viewerId == request.auth.uid'));
    assert.ok(days.includes("viewerId.matches('^v_[a-z0-9]{5,40}$')"));
    assert.ok(days.includes('tctvStationOk'));
    assert.ok(!days.includes('counted'));

    const presence = rules.slice(presenceStart, daysStart);
    assert.ok(presence.includes('allow list: if false'));
    assert.ok(presence.includes("request.resource.data.ts == request.time"));
    assert.ok(presence.includes('expiresAt'));
    assert.ok(presence.includes("keys().hasOnly(['station', 'ts', 'tsClient', 'expiresAt'])"));
    assert.ok(presence.includes("docId == 'live'"));
    assert.ok(presence.includes('allow write: if false'));

    const faucet = rules.indexOf('match /faucet_ledger/{docId}');
    assert.ok(faucet > 0);
    assert.ok(rules.slice(faucet, faucet + 180).includes('allow read, write: if false'));
});

test('station allow-list matches the TV page and the rules', () => {
    const src = read('timechain-tv.js');
    const region = src.slice(0, src.indexOf('function u()'));
    const ids = [];
    const re = /\{id:"([^"]+)",name:"([^"]*)",emoji:"([^"]*)"/g;
    let match;
    while ((match = re.exec(region))) ids.push(match[1]);
    assert.deepStrictEqual(ids.slice().sort(), lib.TCTV_STATIONS.slice().sort());
    const rules = read('firestore.rules');
    ids.forEach(id => {
        assert.ok(rules.includes(id), id);
    });
    const indexes = JSON.parse(read('firestore.indexes.json'));
    const hit = (indexes.fieldOverrides || []).find(item => item.collectionGroup === 'tctv_view_days' && item.fieldPath === 'ts');
    assert.ok(hit, 'missing tctv_view_days ts index');
});

test('the TV page does not write views or peak', () => {
    const src = read('timechain-tv.js');
    assert.ok(src.includes('collection("tctv_view_days")'));
    assert.ok(src.includes('surf||tctvRecordTune(i)'));
    assert.ok(src.includes('window._tctvSurfTune=1'));
    assert.ok(src.includes('finally{window._tctvSurfTune=0}'));
    assert.ok(src.includes('tctvReleasePresence()'));
    assert.ok(src.includes('tctvDropGuestPresence'));
    assert.ok(src.includes('tctv_open_tabs'));
    assert.ok(src.includes('doc("views").get()'));
    assert.ok(src.includes('doc("peak").get()'));
    assert.ok(!src.includes('runTransaction'));
    assert.ok(!src.includes('t.update(o,{peak'));
    assert.ok(!src.includes('t.set(o,{peak'));
    assert.ok(!src.includes('doc("views");i.runTransaction'));
    assert.ok(!src.includes('t&&t!==i&&y()'));
    execFileSync(process.execPath, ['--check', path.join(root, 'timechain-tv.js')], { stdio: 'pipe' });
    execFileSync(process.execPath, ['--check', path.join(root, 'functions', 'index.js')], { stdio: 'pipe' });
    execFileSync(process.execPath, ['--check', path.join(root, 'functions', 'tctv-presence-lib.js')], { stdio: 'pipe' });
});

function memoryStorage(seed) {
    const data = Object.assign({}, seed || {});
    return {
        getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
        setItem(key, value) { data[key] = String(value); },
        _data: data,
    };
}

function loadClient(storage, authUser) {
    const src = read('timechain-tv.js');
    const start = src.indexOf('function c(i){if("undefined"==typeof firebase');
    const end = src.indexOf('!function(){if("undefined"!=typeof window&&!window._tctvPresenceUnloadInstalled)');
    assert.ok(start > 0 && end > start);
    const writes = [];
    const intervals = [];
    let currentUser = authUser || null;
    const authWaiters = [];
    const firebase = {
        auth() { return {
            get currentUser() { return currentUser; },
            onAuthStateChanged(cb) { authWaiters.push(cb); },
        }; },
        firestore: Object.assign(function () {
            return {
                collection(name) {
                    return {
                        doc(id) {
                            return {
                                set(data) {
                                    const op = { op: 'set', name, id, data };
                                    writes.push(op);
                                    return {
                                        then(onOk) {
                                            if (onOk) onOk(op);
                                            return this;
                                        },
                                        catch() { return this; },
                                    };
                                },
                                delete() {
                                    writes.push({ op: 'delete', name, id });
                                    return Promise.resolve();
                                },
                                onSnapshot() { return function () {}; },
                            };
                        },
                    };
                },
            };
        }, {
            FieldValue: { serverTimestamp() { return 'SERVER_TS'; } },
            Timestamp: { fromMillis(ms) { return { millis: ms }; } },
        }),
    };
    const listeners = { pagehide: [], beforeunload: [] };
    const sandbox = {
        firebase,
        document: {
            hidden: false,
            visibilityState: 'visible',
            addEventListener() {},
        },
        window: {
            addEventListener(type, fn) { (listeners[type] || (listeners[type] = [])).push(fn); },
            _tctvSurfTune: 0,
        },
        localStorage: storage,
        setInterval(fn, ms) { intervals.push(ms); return intervals.length; },
        clearInterval() {},
        s: {},
        r: null,
        l: null,
        k() {},
        u() {
            if (currentUser) return currentUser.uid;
            return storage.getItem('tctv_viewerId');
        },
        Date, Math, Object, Number, Promise, JSON, RegExp,
    };
    vm.createContext(sandbox);
    vm.runInContext(src.slice(start, end) + '\nthis.g=g;this.tctvRecordTune=tctvRecordTune;this.tctvReleasePresence=tctvReleasePresence;this.tctvDropGuestPresence=tctvDropGuestPresence;', sandbox);
    return { sandbox, writes, intervals, listeners, setUser(user) { currentUser = user; } };
}

test('a manual tune writes one deduped view doc and block-surf does not', () => {
    const storage = memoryStorage();
    const client = loadClient(storage, { uid: 'uid123456' });
    client.sandbox.g('news');
    const tunes = client.writes.filter(item => item.name === 'tctv_view_days');
    assert.strictEqual(tunes.length, 1);
    assert.strictEqual(tunes[0].id, lib.tuneToRecord('uid123456', 'news', Date.now(), false).id);
    assert.strictEqual(tunes[0].data.station, 'news');
    assert.strictEqual(tunes[0].data.ts, 'SERVER_TS');
    assert.ok(!('counted' in tunes[0].data));
    const presence = client.writes.filter(item => item.name === 'tctv_presence' && item.op === 'set');
    assert.strictEqual(presence[0].id, 'uid123456');
    assert.strictEqual(presence[0].data.station, 'news');

    client.sandbox.window._tctvLastJoined = null;
    client.sandbox.g('news');
    assert.strictEqual(client.writes.filter(item => item.name === 'tctv_view_days').length, 1);

    client.sandbox.window._tctvSurfTune = 1;
    client.sandbox.g('music');
    assert.strictEqual(client.writes.filter(item => item.name === 'tctv_view_days').length, 1);
    const musicPresence = client.writes.filter(item => item.op === 'set' && item.name === 'tctv_presence');
    assert.strictEqual(musicPresence[musicPresence.length - 1].data.station, 'music');

    client.sandbox.g('history');
    const after = client.writes.filter(item => item.name === 'tctv_view_days');
    assert.strictEqual(after.length, 2);
    assert.strictEqual(after[1].data.station, 'history');
});

test('closing one of two tabs keeps the presence doc', () => {
    const storage = memoryStorage();
    const first = loadClient(storage, { uid: 'uid123456' });
    const second = loadClient(storage, { uid: 'uid123456' });
    first.sandbox.g('news');
    second.sandbox.g('news');
    const before = first.writes.filter(item => item.op === 'delete').length
        + second.writes.filter(item => item.op === 'delete').length;
    first.sandbox.tctvReleasePresence();
    const deletes = first.writes.filter(item => item.op === 'delete' && item.name === 'tctv_presence');
    assert.strictEqual(deletes.length, before);
    second.sandbox.tctvReleasePresence();
    const last = second.writes.filter(item => item.op === 'delete' && item.name === 'tctv_presence');
    assert.strictEqual(last.length, 1);
    assert.strictEqual(last[0].id, 'uid123456');
});

test('signing in deletes the guest presence doc and does not delete the uid doc', () => {
    const storage = memoryStorage({ tctv_viewerId: 'v_guest12345' });
    const signedOut = loadClient(storage, null);
    signedOut.sandbox.tctvDropGuestPresence();
    assert.strictEqual(signedOut.writes.filter(item => item.op === 'delete').length, 0);

    const signedIn = loadClient(storage, { uid: 'uid123456' });
    signedIn.sandbox.tctvDropGuestPresence();
    const deletes = signedIn.writes.filter(item => item.op === 'delete');
    assert.strictEqual(deletes.length, 1);
    assert.strictEqual(deletes[0].name, 'tctv_presence');
    assert.strictEqual(deletes[0].id, 'v_guest12345');

    storage.setItem('tctv_viewerId', 'not a guest');
    signedIn.writes.length = 0;
    signedIn.sandbox.tctvDropGuestPresence();
    assert.strictEqual(signedIn.writes.length, 0);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
