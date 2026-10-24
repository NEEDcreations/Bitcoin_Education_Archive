// Timechain TV live viewer counter.
// Locks the read-cost fix: the minute job and the TV page must not scan
// tctv_presence, and only a recent server timestamp counts as a viewer.
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

const now = 1_700_000_000_000;

test('a heartbeat inside 90s counts', () => {
    const counts = {};
    lib.accumulatePresence(counts, { station: 'pleb-underground', ts: ts(now - 30_000) }, now);
    assert.deepStrictEqual(counts, { 'pleb-underground': 1 });
});

test('a doc older than 90s does not count', () => {
    const counts = {};
    lib.accumulatePresence(counts, { station: 'pleb-underground', ts: ts(now - lib.FRESH_MS - 1) }, now);
    assert.deepStrictEqual(counts, {});
});

test('tsClient alone does not count', () => {
    const counts = {};
    lib.accumulatePresence(counts, { station: 'pleb-underground', tsClient: now }, now);
    assert.deepStrictEqual(counts, {});
});

test('a far-future timestamp does not count', () => {
    const counts = {};
    lib.accumulatePresence(counts, { station: 'pleb-underground', ts: ts(now + lib.FUTURE_SKEW_MS + 1) }, now);
    assert.deepStrictEqual(counts, {});
});

test('station id must be a short string', () => {
    const counts = {};
    lib.accumulatePresence(counts, { station: '', ts: ts(now) }, now);
    lib.accumulatePresence(counts, { station: 'x'.repeat(50), ts: ts(now) }, now);
    lib.accumulatePresence(counts, { station: 12, ts: ts(now) }, now);
    assert.deepStrictEqual(counts, {});
});

test('two viewers on one station add', () => {
    const counts = {};
    lib.accumulatePresence(counts, { station: 'news', ts: ts(now - 1000) }, now);
    lib.accumulatePresence(counts, { station: 'news', ts: ts(now - 2000) }, now);
    lib.accumulatePresence(counts, { station: 'music', ts: ts(now - 3000) }, now);
    assert.deepStrictEqual(counts, { news: 2, music: 1 });
});

test('unchanged station maps skip the write', () => {
    assert.strictEqual(lib.stationCountsEqual({ news: 2, art: 1 }, { art: 1, news: 2 }), true);
    assert.strictEqual(lib.stationCountsEqual({ news: 2 }, { news: 1 }), false);
    assert.strictEqual(lib.stationCountsEqual({}, {}), true);
    assert.strictEqual(lib.stationCountsEqual(null, {}), true);
    assert.strictEqual(lib.stationCountsEqual({ news: 1 }, {}), false);
});

test('cleanup reasons', () => {
    assert.strictEqual(lib.presenceDeleteReason({ ts: ts(now - 30_000) }, now), null);
    assert.strictEqual(lib.presenceDeleteReason({ ts: ts(now - lib.STALE_MS - 1) }, now), 'stale');
    assert.strictEqual(lib.presenceDeleteReason({ ts: ts(now + lib.FUTURE_SKEW_MS + 1) }, now), 'future');
    assert.strictEqual(lib.presenceDeleteReason({}, now), 'missing-ts');
    assert.strictEqual(lib.presenceDeleteReason({ tsClient: now - lib.STALE_MS - 5 }, now), 'stale');
    assert.strictEqual(lib.presenceDeleteReason({ tsClient: now }, now), null);
});

test('numeric and seconds timestamps are understood', () => {
    assert.strictEqual(lib.timestampMillis(now - 1000), now - 1000);
    assert.strictEqual(lib.timestampMillis({ _seconds: 10, _nanoseconds: 5_000_000 }), 10_005);
});

test('fresh window is 90s, stale delete is 10 min, batch is bounded', () => {
    assert.strictEqual(lib.FRESH_MS, 90 * 1000);
    assert.strictEqual(lib.STALE_MS, 10 * 60 * 1000);
    assert.ok(lib.STALE_DELETE_LIMIT > 0 && lib.STALE_DELETE_LIMIT <= 200);
});

test('aggregator queries ts and writes one live doc', () => {
    const src = read('functions/index.js');
    const start = src.indexOf('exports.tctvAggregatePresence');
    const end = src.indexOf('exports.stravaInitAuth');
    assert.ok(start > 0 && end > start);
    const fn = src.slice(start, end);
    assert.ok(fn.includes(".where('ts', '>=', freshStart)"));
    assert.ok(fn.includes(".where('ts', '<=', freshEnd)"));
    assert.ok(fn.includes(".where('ts', '<', staleBefore)"));
    assert.ok(fn.includes(".limit(tctvPresence.STALE_DELETE_LIMIT)"));
    assert.ok(fn.includes(".doc('live')"));
    assert.ok(fn.includes('stationCountsEqual'));
    assert.ok(!fn.includes(".collection('tctv_presence').get()"));
    assert.ok(!fn.includes('.collection("tctv_presence").get()'));
});

test('retired copy does not scan presence', () => {
    const src = read('functions/tctv-presence.function.js');
    assert.ok(!src.includes('.collection('));
    assert.ok(!src.includes('.get()'));
    assert.ok(!src.includes('onRun'));
    assert.ok(src.includes('tctvAggregatePresence'));
    assert.ok(src.includes('module.exports = {}'));
});

test('TV page presence code writes expiresAt and listens to one doc', () => {
    const src = read('timechain-tv.js');
    const start = src.indexOf('function c(i){if("undefined"==typeof firebase');
    const end = src.indexOf('!function(){if("undefined"!=typeof window&&!window._tctvPresenceUnloadInstalled)');
    assert.ok(start > 0 && end > start);
    const writes = [];
    const listeners = [];
    const intervals = [];
    let hidden = false;
    const firebase = {
        auth() { return { currentUser: { uid: 'signed_in_user' } }; },
        firestore: Object.assign(function () {
            const db = {
                collection(name) {
                    return {
                        doc(id) {
                            return {
                                set(data) { writes.push({ op: 'set', name, id, data }); return Promise.resolve(); },
                                delete() { writes.push({ op: 'delete', name, id }); return Promise.resolve(); },
                                onSnapshot(cb) {
                                    const entry = { name, id, cb };
                                    listeners.push(entry);
                                    return function () {
                                        const at = listeners.indexOf(entry);
                                        if (at >= 0) listeners.splice(at, 1);
                                    };
                                },
                                get() { return Promise.resolve({ exists: false, data: function () { return null; } }); }
                            };
                        }
                    };
                },
                runTransaction(fn) { return Promise.resolve(fn({ get() { return Promise.resolve({ exists: false }); }, set() {}, update() {} })); }
            };
            return db;
        }, {
            FieldValue: { serverTimestamp() { return 'SERVER_TS'; } },
            Timestamp: { fromMillis(ms) { return { millis: ms }; } }
        })
    };
    const sandbox = {
        firebase,
        document: {
            get hidden() { return hidden; },
            visibilityState: 'visible',
            addEventListener() {}
        },
        window: {},
        localStorage: { getItem() { return null; }, setItem() {} },
        setInterval(fn, ms) { intervals.push(ms); return intervals.length; },
        clearInterval() {},
        s: {},
        r: null,
        l: null,
        kCalls: 0,
        k() { sandbox.kCalls++; },
        u() { return firebase.auth().currentUser.uid; },
        Date, Math, Object, Number, Promise, JSON
    };
    vm.createContext(sandbox);
    vm.runInContext(src.slice(start, end) + '\nthis.api={c:c,B:B,g:g,y:y,stop:tctvStopLiveCounts};', sandbox);
    sandbox.api.g('news');
    assert.strictEqual(writes[0].name, 'tctv_presence');
    assert.strictEqual(writes[0].id, 'signed_in_user');
    assert.strictEqual(writes[0].data.station, 'news');
    assert.strictEqual(writes[0].data.ts, 'SERVER_TS');
    assert.strictEqual(typeof writes[0].data.tsClient, 'number');
    assert.ok(writes[0].data.expiresAt.millis >= writes[0].data.tsClient + 9 * 60 * 1000);
    assert.ok(writes[0].data.expiresAt.millis <= writes[0].data.tsClient + 11 * 60 * 1000);
    assert.deepStrictEqual(intervals, [30000, 5000]);
    assert.strictEqual(listeners.length, 1);
    assert.strictEqual(listeners[0].name, 'tctv_counts');
    assert.strictEqual(listeners[0].id, 'live');
    listeners[0].cb({ exists: true, data: function () { return { stations: { news: 4, art: 0, bad: 'x' } }; } });
    assert.strictEqual(sandbox.s.news, 4);
    assert.deepStrictEqual(Object.keys(sandbox.s).sort(), ['news']);
    assert.ok(sandbox.kCalls >= 1);
    sandbox.api.stop();
    assert.strictEqual(listeners.length, 0);
    hidden = true;
    sandbox.api.B();
    assert.strictEqual(listeners.length, 0);
    hidden = false;
    sandbox.api.B();
    assert.strictEqual(listeners.length, 1);
    sandbox.api.y();
    assert.strictEqual(writes[writes.length - 1].op, 'delete');
    assert.strictEqual(writes[writes.length - 1].name, 'tctv_presence');
});

test('TV page listens to tctv_counts/live and heartbeats every 30s', () => {
    const src = read('timechain-tv.js');
    assert.ok(src.includes('collection("tctv_counts").doc("live").onSnapshot'));
    assert.ok(src.includes('expiresAt:firebase.firestore.Timestamp.fromMillis(t+6e5)'));
    assert.ok(src.includes('setInterval(function(){r&&c(r)},3e4)'));
    assert.ok(src.includes('tctvStopLiveCounts'));
    assert.ok(src.includes('document.hidden'));
    assert.ok(!src.includes('collection("tctv_presence").get()'));
    assert.ok(!src.includes('setInterval(B,6e4)'));
    execFileSync(process.execPath, ['--check', path.join(root, 'timechain-tv.js')], { stdio: 'pipe' });
});

test('rules validate uid, expiresAt, and close collection scans', () => {
    const rules = read('firestore.rules');
    const start = rules.indexOf('match /tctv_presence/{viewerId}');
    const end = rules.indexOf('match /ai_tools_opens/');
    assert.ok(start > 0 && end > start);
    const block = rules.slice(start, end);
    assert.ok(block.includes('viewerId == request.auth.uid'));
    assert.ok(block.includes('request.auth == null && viewerId.matches'));
    assert.ok(block.includes("request.resource.data.ts == request.time"));
    assert.ok(block.includes('expiresAt'));
    assert.ok(block.includes('allow list: if false'));
    assert.ok(block.includes("match /tctv_counts/{docId}"));
    assert.ok(block.includes("docId == 'live'"));
    assert.ok(block.includes('allow write: if false'));
});

test('single-field index is declared for tctv_presence.ts', () => {
    const indexes = JSON.parse(read('firestore.indexes.json'));
    const hit = (indexes.fieldOverrides || []).find(item => item.collectionGroup === 'tctv_presence' && item.fieldPath === 'ts');
    assert.ok(hit, 'missing field override');
    const orders = (hit.indexes || []).map(item => item.order + ':' + item.queryScope);
    assert.ok(orders.includes('ASCENDING:COLLECTION'));
});

test('cache name is v2358 and the TV script cache-buster moved', () => {
    const sw = read('sw.js');
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2360'"));
    assert.ok(!sw.includes('btc-archive-v2359'));
    assert.ok(!sw.includes('btc-archive-v2358'));
    assert.ok(!sw.includes('btc-archive-v2357'));
    assert.ok(!sw.includes('btc-archive-v2356'));
    assert.ok(!sw.includes('btc-archive-v2355'));
    assert.ok(!sw.includes('btc-archive-v2354'));
    assert.ok(!sw.includes('btc-archive-v2353'));
    assert.ok(!sw.includes('btc-archive-v2352'));
    assert.ok(!sw.includes('btc-archive-v2351'));
    assert.ok(!sw.includes('btc-archive-v2350'));
    assert.ok(!sw.includes('btc-archive-v2349'));
    assert.ok(!sw.includes('btc-archive-v2348'));
    assert.ok(!sw.includes('btc-archive-v2347'));
    assert.ok(!sw.includes('btc-archive-v2346'));
    assert.ok(!sw.includes('btc-archive-v2345'));
    assert.ok(!sw.includes('btc-archive-v2344'));
    assert.ok(!sw.includes('btc-archive-v2343'));
    assert.ok(!sw.includes('btc-archive-v2342'));
    assert.ok(!sw.includes('btc-archive-v2340'));
    assert.ok(!sw.includes('btc-archive-v2341'));
    assert.ok(!sw.includes('btc-archive-v2339'));
    assert.ok(!sw.includes('btc-archive-v2338'));
    assert.ok(!sw.includes('btc-archive-v2334'));
    assert.ok(!sw.includes('btc-archive-v2333'));
    assert.ok(!sw.includes('btc-archive-v2332'));
    assert.ok(!sw.includes('btc-archive-v2331'));
    assert.ok(!sw.includes('btc-archive-v2330'));
    assert.ok(!sw.includes('btc-archive-v2329'));
    assert.ok(!sw.includes('btc-archive-v2327'));
    assert.ok(!sw.includes('btc-archive-v2326'));
    assert.ok(!sw.includes('btc-archive-v2325'));
    assert.ok(!sw.includes('btc-archive-v2324'));
    assert.ok(!sw.includes('btc-archive-v2323'));
    assert.ok(!sw.includes('btc-archive-v2322'));
    assert.ok(!sw.includes('btc-archive-v2301'));
    assert.ok(!sw.includes('btc-archive-v2295'));
    assert.ok(!sw.includes('btc-archive-v2293'));
    assert.ok(!sw.includes('btc-archive-v2286'));
    assert.ok(!sw.includes('btc-archive-v2279'));
    assert.ok(!sw.includes('btc-archive-v2272'));
    assert.ok(!sw.includes('nacho-fly.svg'));
    assert.ok(sw.includes('nacho-deer.svg'));
    assert.ok(!sw.includes('btc-archive-v2272'));
    assert.ok(!sw.includes('btc-archive-v2271'));
    assert.ok(!sw.includes('btc-archive-v2270'));
    assert.ok(!sw.includes('btc-archive-v2269'));
    assert.ok(!sw.includes('btc-archive-v2268'));
    assert.ok(!sw.includes('btc-archive-v2267'));
    assert.ok(!sw.includes('btc-archive-v2266'));
    assert.ok(!sw.includes('btc-archive-v2265'));
    assert.ok(!sw.includes('btc-archive-v2264'));
    assert.ok(!sw.includes('btc-archive-v2263'));
    assert.ok(!sw.includes('btc-archive-v2262'));
    assert.ok(!sw.includes('btc-archive-v2261'));
    assert.ok(!sw.includes('btc-archive-v2260'));
    assert.ok(!sw.includes('btc-archive-v2255'));
    assert.ok(!sw.includes('btc-archive-v2254'));
    assert.ok(!sw.includes('btc-archive-v2253'));
    assert.ok(!sw.includes('btc-archive-v2252'));
    assert.ok(!sw.includes('btc-archive-v2251'));
    assert.ok(!sw.includes('btc-archive-v2250'));
    assert.ok(!sw.includes('btc-archive-v2249'));
    assert.ok(!sw.includes('btc-archive-v2248'));
    assert.ok(!sw.includes('btc-archive-v2247'));
    assert.ok(!sw.includes('btc-archive-v2246'));
    assert.ok(!sw.includes('btc-archive-v2245'));
    assert.ok(!sw.includes('btc-archive-v2244'));
    assert.ok(!sw.includes('btc-archive-v2243'));
    assert.ok(!sw.includes('btc-archive-v2242'));
    assert.ok(!sw.includes('btc-archive-v2241'));
    assert.ok(!sw.includes('btc-archive-v2240'));
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(html.includes('timechain-tv.js?v=20261024_v2353'));
    assert.ok(!html.includes('timechain-tv.js?v=20261022_v2266'));
    assert.ok(!html.includes('timechain-tv.js?v=20261022_tctv3'));
    assert.ok(!html.includes('timechain-tv.js?v=20261022_tctvwatch'));
    assert.ok(html.includes('gifting.js?v=20261024_v2358'));
    assert.ok(!html.includes('gifting.js?v=20261024_v2357'));
    assert.ok(!html.includes('gifting.js?v=20261022_v2254'));
    assert.ok(html.includes('notifications.js?v=20261024_v2357'));
    assert.ok(!html.includes('notifications.js?v=20261024_v2355'));
    assert.ok(!html.includes('notifications.js?v=20261024_v2354'));
    assert.ok(!html.includes('notifications.js?v=20261024_v2352'));
    assert.ok(!html.includes('notifications.js?v=20261022_v2262'));
    assert.ok(!html.includes('notifications.js?v=20261022_v2254'));
    assert.ok(!html.includes('gifting.js?v=20261022_lightfix'));
    assert.ok(!html.includes('notifications.js?v=20261022_gifts'));
    assert.ok(html.includes("'quests.js?v=20261024_v2358'"));
    assert.ok(!html.includes("'quests.js?v=20261024_v2352'"));
    assert.ok(!html.includes("'quests.js?v=20261024_v2351'"));
    assert.ok(!html.includes("'quests.js?v=20261024_v2350'"));
    assert.ok(!html.includes("'quests.js?v=20261023_v2341'"));
    assert.ok(!html.includes("'quests.js?v=20261023_v2334'"));
    assert.ok(!html.includes("'quests.js?v=20261023_v2333'"));
    assert.ok(!html.includes("'quests.js?v=20261023_v2324'"));
    assert.ok(!html.includes('quests.js?v=20261022_v2279'));
    assert.ok(!html.includes('quests.js?v=20261022_v2251'));
    assert.ok(html.includes('ranking.js?v=20261024_v2358'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2357'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2356'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2355'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2354'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2352'));
    assert.ok(!html.includes('ranking.js?v=20261024_repickc'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2350'));
    assert.ok(!html.includes('ranking.js?v=20261024_repickb'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2351'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2349'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2342'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2341'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2334'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2333'));
    assert.ok(!html.includes('ranking.js?v=20261022_v2269'));
    assert.ok(!html.includes('ranking.js?v=20261022_lightfix'));
    assert.ok(!html.includes('ranking.js?v=20261022_v2251'));
    assert.ok(!html.includes('gifting.js?v=20261022_v2251'));
    assert.ok(html.includes('bundle.min.js?v=20261024_v2360'));
    assert.ok(!html.includes('bundle.min.js?v=20261024_v2358'));
    assert.ok(!html.includes('bundle.min.js?v=20261024_v2350'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2348'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2347'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2346'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2345'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2344'));
    assert.strictEqual(html.includes('bundle.min.js?v=20261023_v2344'), false);
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2343'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2342'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2341'));
    assert.strictEqual(html.includes('bundle.min.js?v=20261023_v2341'), false);
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2340'));
    assert.strictEqual(html.includes('bundle.min.js?v=20261023_v2340'), false);
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2341'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2340'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2333'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2295'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2293'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2279'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2271'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2268'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2266'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2265'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2263'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2261'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2252'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2246'));
    assert.ok(html.includes('global-chat.js?v=20261024_v2360'));
    assert.ok(!html.includes('global-chat.js?v=20261024_v2350'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2345'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2343'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2342'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2341'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2333'));
    assert.strictEqual(html.includes('global-chat.js?v=20261023_v2333'), false);
    assert.ok(!html.includes('global-chat.js?v=20261023_v2333'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2272'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2269'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2267'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2265'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2264'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2263'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2261'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2252'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2251'));
    assert.ok(html.includes('features.registry.js?v=20261024_v2358'));
    assert.ok(!html.includes('features.registry.js?v=20261024_v2357'));
    assert.ok(!html.includes('features.registry.js?v=20261024_v2355'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2342'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2341'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2339'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2330'));
    assert.ok(!html.includes('features.registry.js?v=20261022_v2266'));
    assert.ok(!html.includes('features.registry.js?v=20261022_v2265'));
    assert.ok(html.includes('satoshi-favor.js?v=20261024_v2352'));
    assert.ok(!html.includes('satoshi-favor.js?v=20261024_v2351'));
    assert.ok(!html.includes('satoshi-favor.js?v=20261023_v2323'));
    assert.ok(!html.includes('satoshi-favor.js?v=20261022_v2250'));
    assert.ok(!html.includes('ranking.js?v=20261022_v2250'));
    assert.ok(!html.includes('ranking.js?v=20261022_v2246'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2250'));
    assert.ok(html.includes('lightning.js?v=20261023_v2323'));
    assert.ok(!html.includes('timechain-tv.js?v=20261022_tctv2'));
    assert.ok(!html.includes('timechain-tv.js?v=20261007_2230'));
    assert.ok(!html.includes('ranking.js?v=20261022_appcheck'));
});

test('cleanup script stays a dry-run unless --apply', () => {
    const src = read('functions/cleanup-tctv-presence.js');
    assert.ok(src.includes("process.argv.indexOf('--apply')"));
    assert.ok(src.includes('tctv_presence'));
    assert.ok(src.includes("doc.id !== 'live'"));
    assert.ok(src.includes('gcloud firestore fields ttls update expiresAt'));
    execFileSync(process.execPath, ['--check', path.join(root, 'functions', 'cleanup-tctv-presence.js')], { stdio: 'pipe' });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
