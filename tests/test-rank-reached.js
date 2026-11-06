// First-time rank stamps. Thresholds come from the server LEVELS table.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rn = require('../functions/src/rewardNotify');
const rankReached = require('../functions/src/rankReached');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        const result = fn();
        if (result && typeof result.then === 'function') {
            return result.then(function () {
                console.log('✅ ' + name);
                passed++;
            }).catch(function (e) {
                console.log('❌ ' + name + ': ' + e.message);
                failed++;
            });
        }
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
    return Promise.resolve();
}

function clientLevels() {
    const src = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    const start = src.indexOf('const LEVELS = [');
    const end = src.indexOf('];', start);
    const block = src.slice(start, end);
    const rows = [];
    const re = /name:\s*'([^']+)'[\s\S]*?min:\s*(\d+)/g;
    let match;
    while ((match = re.exec(block))) rows.push({ name: match[1], min: Number(match[2]) });
    return rows;
}

function sliceBetween(src, startMarker, endMarker) {
    const start = src.indexOf(startMarker);
    const end = src.indexOf(endMarker, start + startMarker.length);
    assert.ok(start !== -1 && end !== -1, startMarker);
    return src.slice(start, end);
}

function event(before, after, uid) {
    return {
        params: { uid: uid || 'user1' },
        data: {
            before: { exists: !!before, data: function () { return before || {}; } },
            after: { exists: after != null, data: function () { return after || {}; } },
        },
    };
}

function fakeDb(data) {
    const state = {
        data: data ? JSON.parse(JSON.stringify(data)) : null,
        updates: 0,
        gets: 0,
        transactions: 0,
    };
    const ref = { id: 'user1' };
    return {
        state: state,
        collection: function () {
            return { doc: function () { return ref; } };
        },
        runTransaction: async function (fn) {
            state.transactions++;
            const t = {
                get: async function () {
                    state.gets++;
                    return {
                        exists: state.data != null,
                        data: function () { return state.data; },
                    };
                },
                update: function (_ref, patch) {
                    state.updates++;
                    Object.keys(patch).forEach(function (fieldPath) {
                        const parts = fieldPath.split('.');
                        assert.strictEqual(parts.length, 2);
                        if (!state.data[parts[0]] || typeof state.data[parts[0]] !== 'object') state.data[parts[0]] = {};
                        state.data[parts[0]][parts[1]] = patch[fieldPath];
                    });
                },
            };
            await fn(t);
        },
    };
}

(async function main() {
    await test('server thresholds match ranking.js, except Normie at 0', function () {
        const client = clientLevels();
        assert.strictEqual(client[0].name, 'Normie');
        assert.strictEqual(client[0].min, 0);
        const rest = client.slice(1);
        assert.strictEqual(rest.length, rn.LEVELS.length);
        rest.forEach(function (level, i) {
            assert.strictEqual(rn.LEVELS[i].name, level.name);
            assert.strictEqual(rn.LEVELS[i].min, level.min);
        });
        const maxi = rn.LEVELS.filter(function (level) { return level.name === 'Maxi'; })[0];
        assert.strictEqual(maxi.min, 2140);
    });

    await test('integer crossings match the rank-up notification table', function () {
        [[0, 10], [139, 5], [2100, 40], [2000, 8000], [8887, 1], [209999, 1]].forEach(function (pair) {
            const names = rankReached.crossedLevels(pair[0], pair[0] + pair[1]).map(function (level) { return level.name; });
            const notified = rn.levelsCrossed(pair[0], pair[1]).map(function (level) { return level.name; });
            assert.deepStrictEqual(names, notified);
        });
    });

    await test('rank ids match notification slugs', function () {
        assert.strictEqual(rankReached.rankId('Maxi'), 'maxi');
        assert.strictEqual(rankReached.rankId('Pleb II'), 'pleb_ii');
        assert.strictEqual(rankReached.rankId('Papa John'), 'papa_john');
        assert.strictEqual(rankReached.rankId('Full Node'), 'full_node');
        assert.strictEqual(rn.rankDocId('abc', 'Maxi'), 'rank_abc_' + rankReached.rankId('Maxi'));
    });

    await test('crossing Maxi stamps only maxi', function () {
        const patch = rankReached.rankReachedPatch(2100, 2140, {}, 'TS');
        assert.deepStrictEqual(patch, { 'rankReachedAt.maxi': 'TS' });
    });

    await test('one jump stamps every newly crossed rank with the same timestamp', function () {
        const patch = rankReached.rankReachedPatch(0, 10000, {}, 'TS');
        const ids = Object.keys(patch);
        assert.deepStrictEqual(ids, [
            'rankReachedAt.curious',
            'rankReachedAt.pleb',
            'rankReachedAt.pleb_ii',
            'rankReachedAt.pleb_iii',
            'rankReachedAt.stacker',
            'rankReachedAt.stacker_ii',
            'rankReachedAt.stacker_iii',
            'rankReachedAt.maxi',
            'rankReachedAt.maxi_ii',
            'rankReachedAt.maxi_iii',
            'rankReachedAt.papa_john',
        ]);
        ids.forEach(function (key) { assert.strictEqual(patch[key], 'TS'); });
        assert.strictEqual(patch['rankReachedAt.full_node'], undefined);
    });

    await test('a player already past Maxi is not backfilled', function () {
        assert.deepStrictEqual(rankReached.rankReachedPatch(5000, 5010, {}, 'TS'), {});
        const higher = rankReached.rankReachedPatch(6000, 6200, {}, 'TS');
        assert.deepStrictEqual(higher, { 'rankReachedAt.maxi_ii': 'TS' });
        assert.strictEqual(higher['rankReachedAt.maxi'], undefined);
    });

    await test('an existing stamp is never overwritten', function () {
        const existing = { maxi: 'KEEP', pleb: 'KEEP' };
        const patch = rankReached.rankReachedPatch(0, 2140, existing, 'NEW');
        assert.strictEqual(patch['rankReachedAt.maxi'], undefined);
        assert.strictEqual(patch['rankReachedAt.pleb'], undefined);
        assert.strictEqual(patch['rankReachedAt.curious'], 'NEW');
        assert.strictEqual(patch['rankReachedAt.stacker'], 'NEW');
    });

    await test('a drop or a flat total writes nothing', function () {
        assert.deepStrictEqual(rankReached.rankReachedPatch(3000, 1000, {}, 'TS'), {});
        assert.deepStrictEqual(rankReached.rankReachedPatch(2140, 2140, {}, 'TS'), {});
        assert.deepStrictEqual(rankReached.rankIdsToStamp(null, 0, {}), []);
    });

    await test('the trigger writes missing keys once and does not overwrite them', async function () {
        const db = fakeDb({ points: 2200, rankReachedAt: { pleb: 'OLD' } });
        const first = await rankReached.onUserRankReached(event({ points: 100 }, { points: 2200, rankReachedAt: { pleb: 'OLD' } }), db, 'TS1');
        assert.strictEqual(first.wrote, true);
        assert.ok(first.ids.indexOf('maxi') !== -1);
        assert.ok(first.ids.indexOf('pleb') === -1);
        assert.strictEqual(db.state.data.rankReachedAt.pleb, 'OLD');
        assert.strictEqual(db.state.data.rankReachedAt.maxi, 'TS1');
        assert.strictEqual(db.state.updates, 1);
        const again = await rankReached.onUserRankReached(event(
            { points: 100, rankReachedAt: db.state.data.rankReachedAt },
            { points: 2200, rankReachedAt: db.state.data.rankReachedAt }
        ), db, 'TS2');
        assert.strictEqual(again.wrote, false);
        assert.strictEqual(db.state.data.rankReachedAt.maxi, 'TS1');
        assert.strictEqual(db.state.updates, 1);
    });

    await test('a points-neutral write, including the stamp itself, does not read', async function () {
        const db = fakeDb({ points: 2140, rankReachedAt: { maxi: 'TS' } });
        const same = await rankReached.onUserRankReached(event(
            { points: 2140 },
            { points: 2140, rankReachedAt: { maxi: 'TS' } }
        ), db, 'NO');
        assert.strictEqual(same, null);
        assert.strictEqual(db.state.transactions, 0);
        assert.strictEqual(db.state.data.rankReachedAt.maxi, 'TS');
    });

    await test('a non-map rankReachedAt is left alone', async function () {
        const db = fakeDb({ points: 3000, rankReachedAt: 'nope' });
        const result = await rankReached.onUserRankReached(event({ points: 0 }, { points: 3000, rankReachedAt: 'nope' }), db, 'TS');
        assert.strictEqual(result.wrote, false);
        assert.strictEqual(db.state.data.rankReachedAt, 'nope');
        assert.strictEqual(db.state.updates, 0);
    });

    await test('rules keep rankReachedAt server-only and off the public profile', function () {
        const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
        const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
        const serverKeys = sliceBetween(rules, 'function userProfileServerOnlyKeys()', 'match /users/{userId}');
        const blocked = sliceBetween(rules, 'function profileUpdateBlocked()', 'function shareCardsShownOk()');
        const allow = sliceBetween(rules, 'function profileClientFields()', 'function userProfileServerOnlyKeys()');
        const create = sliceBetween(rules, 'allow create: if', 'allow update:');
        const pub = sliceBetween(index, 'const PUBLIC_PROFILE_FIELDS', 'const lbDirtyStampAt');
        assert.ok(serverKeys.includes("'rankReachedAt'"));
        assert.ok(blocked.includes("'rankReachedAt'"));
        assert.ok(!allow.includes('rankReachedAt'));
        assert.ok(!create.includes('rankReachedAt'));
        assert.ok(!pub.includes('rankReachedAt'));
        assert.ok(index.includes('exports.onUserRankReached'));
        const src = fs.readFileSync(path.join(root, 'functions', 'src', 'rankReached.js'), 'utf8');
        assert.ok(!src.includes('rankReachedAtBackfilledAsOf'));
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
