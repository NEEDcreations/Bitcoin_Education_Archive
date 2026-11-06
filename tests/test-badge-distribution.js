// Public badge distribution: Auth lookups stay within the 100-id cap,
// hidden and non-public holdings stay out of the counts, and one failed
// Auth batch does not abort the run or get logged with a uid or email.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dist = require('../functions/src/badgeDistribution');

let passed = 0;
let failed = 0;

function test(name, fn) {
    const run = fn();
    const ok = function () { console.log('✅ ' + name); passed++; };
    const bad = function (e) { console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e)); failed++; };
    if (run && typeof run.then === 'function') return run.then(ok, bad);
    try { ok(); } catch (e) { bad(e); }
    return Promise.resolve();
}

const adminSdk = {
    firestore: {
        FieldPath: { documentId: function () { return '__name__'; } },
        FieldValue: { serverTimestamp: function () { return { _serverTimestamp: true }; } },
    },
    auth: function () { throw new Error('refresh must use opts.auth'); },
};

function pad(n) {
    return String(n).padStart(4, '0');
}

function signedIn(email) {
    return {
        providerData: [{ providerId: 'google.com' }],
        email: email || 'person@example.com',
    };
}

function createWorld(spec) {
    const users = spec.users || {};
    const awards = spec.awards || {};
    const calls = [];
    const logs = [];
    const writes = [];
    const missing = spec.missing || {};
    const anon = spec.anon || {};
    const failWhen = spec.failWhen || function () { return false; };
    const authByUid = spec.authByUid || {};
    const db = {
        collectionGroup: function (name) {
            return {
                get: async function () {
                    if (spec.awardError) throw spec.awardError;
                    if (name !== 'badge_awards') {
                        return { empty: true, size: 0, docs: [], forEach: function () {} };
                    }
                    const docs = [];
                    Object.keys(awards).forEach(function (uid) {
                        (awards[uid] || []).forEach(function (row) {
                            docs.push({
                                id: row.id,
                                ref: { path: 'users/' + uid + '/badge_awards/' + row.id },
                                data: function () { return row.data || {}; },
                            });
                        });
                    });
                    return {
                        empty: docs.length === 0,
                        size: docs.length,
                        docs: docs,
                        forEach: function (fn) { docs.forEach(fn); },
                    };
                },
            };
        },
        collection: function (name) {
            if (name === 'stats') {
                return {
                    doc: function () {
                        return {
                            set: async function (payload, options) {
                                writes.push({ payload: payload, options: options || null });
                            },
                        };
                    },
                };
            }
            if (name !== 'users') throw new Error('unexpected collection ' + name);
            return {
                orderBy: function () { return limited(null, dist.USER_PAGE); },
            };
        },
    };

    function page(cursorId, n) {
        const ids = Object.keys(users).sort();
        let start = 0;
        if (cursorId) {
            const idx = ids.indexOf(cursorId);
            start = idx === -1 ? ids.length : idx + 1;
        }
        const slice = ids.slice(start, start + n);
        const docs = slice.map(function (id) {
            return { id: id, data: function () { return users[id]; } };
        });
        return {
            empty: docs.length === 0,
            size: docs.length,
            docs: docs,
        };
    }

    function limited(cursorId, n) {
        return {
            startAfter: function (doc) { return limited(doc && doc.id, n); },
            limit: function (next) { return limited(cursorId, next); },
            get: async function () { return page(cursorId, n); },
        };
    }

    const auth = {
        getUsers: async function (ids) {
            const uids = ids.map(function (row) { return row.uid; });
            calls.push(uids.slice());
            if (!Array.isArray(ids) || ids.length > dist.AUTH_LOOKUP_MAX) {
                const err = new Error('too many identifiers for ' + (uids[0] || '') + ' leak@example.com');
                err.code = 'auth/too-many';
                throw err;
            }
            if (failWhen(uids)) {
                const err = new Error('lookup failed for uid ' + uids[0] + ' email poison@example.com');
                err.code = 'auth/internal-error';
                throw err;
            }
            const found = [];
            const notFound = [];
            uids.forEach(function (uid) {
                if (missing[uid]) {
                    notFound.push({ uid: uid });
                    return;
                }
                const rec = Object.assign({ uid: uid }, anon[uid] ? { providerData: [], email: 'anon@example.com' } : (authByUid[uid] || signedIn('person@example.com')));
                found.push(rec);
            });
            return { users: found, notFound: notFound };
        },
    };

    return { db: db, auth: auth, calls: calls, logs: logs, writes: writes };
}

function run(world, extra) {
    return dist.refreshBadgeDistribution(world.db, adminSdk, Object.assign({
        auth: world.auth,
        now: Date.parse('2026-10-29T00:00:00Z'),
        log: function (line) { world.logs.push(line); },
    }, extra || {}));
}

function assertNoSecrets(text, secrets) {
    secrets.forEach(function (secret) {
        assert.ok(text.indexOf(secret) === -1, 'leaked ' + secret);
    });
}

const queue = [];

queue.push(test('Auth batches stay at 100 and a later page is still counted', async function () {
    assert.ok(dist.AUTH_BATCH <= 100);
    assert.strictEqual(dist.AUTH_LOOKUP_MAX, 100);
    const users = {};
    for (let i = 0; i < 201; i++) {
        users['holder' + pad(i)] = {
            visibleBadges: ['first_channel'],
            lastActive: Date.parse('2026-10-20T00:00:00Z'),
        };
    }
    const world = createWorld({ users: users });
    const result = await run(world);
    assert.deepStrictEqual(world.calls.map(function (ids) { return ids.length; }), [100, 100, 1]);
    world.calls.forEach(function (ids) { assert.ok(ids.length <= 100); });
    assert.strictEqual(result.totalUsers, 201);
    assert.strictEqual(result.activeUsers30d, 201);
    assert.strictEqual(result.failedBatches, 0);
    assert.strictEqual(result.notFound, 0);
    assert.strictEqual(result.wrote, true);
    assert.strictEqual(world.writes[0].payload.counts.first_channel, 201);
    assert.strictEqual(world.writes[0].options.merge, false);
}));

queue.push(test('a failed Auth batch is skipped and the rest of the run is counted', async function () {
    const users = {};
    for (let i = 0; i < 101; i++) {
        users['holder' + pad(i)] = { visibleBadges: ['first_channel'], lastActive: 0 };
    }
    const world = createWorld({
        users: users,
        failWhen: function (uids) { return uids.length > 1; },
    });
    const result = await run(world);
    assert.strictEqual(result.failedBatches, 1);
    assert.strictEqual(result.totalUsers, 1);
    assert.strictEqual(result.activeUsers30d, 0);
    assert.strictEqual(result.wrote, true);
    assert.strictEqual(world.writes[0].payload.counts.first_channel, 1);
    assert.strictEqual(world.calls.length, 2);
    const logged = world.logs.join('\n');
    assert.ok(logged.indexOf('auth batch failed size=100 code=auth/internal-error') !== -1);
    assert.ok(logged.indexOf('users=1') !== -1);
    assert.ok(logged.indexOf('failedBatches=1') !== -1);
    assert.ok(logged.indexOf('wrote=1') !== -1);
    assertNoSecrets(logged, ['holder0000', 'holder0100', 'poison@example.com', 'leak@example.com', 'person@example.com', '@']);
    assertNoSecrets(JSON.stringify(world.writes[0].payload), ['holder', '@', 'poison', 'person@example.com']);
}));

queue.push(test('partial notFound results still count the users Auth returned', async function () {
    const world = createWorld({
        users: {
            keeper: { visibleBadges: ['quest_1'], lastActive: Date.parse('2026-10-28T00:00:00Z') },
            gone: { visibleBadges: ['quest_1'], hiddenBadges: ['block_42'] },
            other: { visibleBadges: ['explorer_10'] },
        },
        missing: { gone: true },
    });
    const result = await run(world);
    assert.strictEqual(result.notFound, 1);
    assert.strictEqual(result.failedBatches, 0);
    assert.strictEqual(result.totalUsers, 2);
    assert.strictEqual(result.activeUsers30d, 1);
    assert.strictEqual(world.writes[0].payload.counts.quest_1, 1);
    assert.strictEqual(world.writes[0].payload.counts.explorer_10, 1);
    assert.strictEqual(world.writes[0].payload.counts.block_42, undefined);
    assert.ok(world.logs.join('\n').indexOf('notFound=1') !== -1);
    assertNoSecrets(world.logs.join('\n'), ['gone', 'keeper', '@']);
}));

queue.push(test('hidden badges and private lists stay out of the public counts', async function () {
    assert.strictEqual(dist.isPublicBadge('first_channel'), true);
    assert.strictEqual(dist.isPublicBadge('block_42'), false);
    assert.strictEqual(dist.isPublicBadge('speed_runner'), false);
    assert.strictEqual(dist.isPublicBadge('not_a_real_badge'), false);
    const world = createWorld({
        users: {
            ada: {
                visibleBadges: ['first_channel', 'block_42', 'not_a_real_badge'],
                hiddenBadges: ['speed_runner', 'night_owl', 'first_channel'],
                earnedHidden: ['explorer_10'],
                displayBadge: 'quest_1',
                equippedBadge: 'streak_7',
                lastActive: Date.parse('2026-10-01T00:00:00Z'),
            },
            bob: {
                visibleBadges: ['night_owl'],
                hiddenBadges: ['block_42'],
            },
            cay: {},
            banned: { banned: true, visibleBadges: ['first_channel'] },
            reason: { ban_reason: 'ledger', visibleBadges: ['first_channel'] },
            bot: { isBot: true, visibleBadges: ['first_channel'] },
            testacct: { isTest: true, visibleBadges: ['first_channel'] },
            'nacho-bot': { visibleBadges: ['first_channel'] },
            system: { visibleBadges: ['first_channel'] },
        },
        anon: { cay: true },
        awards: {
            ada: [
                { id: 'first_channel', data: {} },
                { id: 'block_42', data: {} },
                { id: 'ABCDEFGHIJKLMNOPQRSTUV', data: { badge: 'explorer_25' } },
                { id: 'ZZZZZZZZZZZZZZZZZZZZZZ', data: { badgeId: 'speed_runner' } },
            ],
            bob: [{ id: 'quest_1', data: {} }],
        },
    });
    const first = await run(world);
    const second = await run(world);
    assert.strictEqual(first.totalUsers, 2);
    assert.strictEqual(second.totalUsers, 2);
    assert.deepStrictEqual(first, second);
    const counts = world.writes[0].payload.counts;
    assert.strictEqual(counts.first_channel, 1);
    assert.strictEqual(counts.explorer_25, 1);
    assert.strictEqual(counts.night_owl, 1);
    assert.strictEqual(counts.quest_1, 1);
    assert.strictEqual(counts.block_42, undefined);
    assert.strictEqual(counts.speed_runner, undefined);
    assert.strictEqual(counts.explorer_10, undefined);
    assert.strictEqual(counts.streak_7, undefined);
    assert.strictEqual(world.writes[1].payload.counts.first_channel, 1);
    assert.strictEqual(world.writes[0].options.merge, false);
    assert.strictEqual(world.writes[1].options.merge, false);
    assert.strictEqual(world.writes[0].payload.updatedAt._serverTimestamp, true);
    const packed = JSON.stringify(world.writes[0].payload) + '\n' + world.logs.join('\n');
    assertNoSecrets(packed, ['ada', 'bob', 'cay', '@', 'person@example.com', 'anon@example.com']);
}));

queue.push(test('a total Auth outage does not wipe the published snapshot', async function () {
    const world = createWorld({
        users: {
            ada: { visibleBadges: ['first_channel'] },
            bob: { visibleBadges: ['quest_1'] },
        },
        failWhen: function () { return true; },
    });
    const result = await run(world);
    assert.strictEqual(result.wrote, false);
    assert.strictEqual(result.totalUsers, 0);
    assert.strictEqual(result.failedBatches, 1);
    assert.strictEqual(world.writes.length, 0);
    assert.ok(world.logs.join('\n').indexOf('wrote=0') !== -1);
    assertNoSecrets(world.logs.join('\n'), ['ada', 'bob', 'poison@example.com', '@']);
}));

queue.push(test('an empty user set still publishes an idempotent zero snapshot', async function () {
    const world = createWorld({ users: {} });
    const result = await run(world);
    assert.strictEqual(result.totalUsers, 0);
    assert.strictEqual(result.badgeCount, 0);
    assert.strictEqual(result.wrote, true);
    assert.strictEqual(world.calls.length, 0);
    assert.deepStrictEqual(world.writes[0].payload.counts, {});
}));

queue.push(test('a read failure aborts without logging the document path', async function () {
    const world = createWorld({
        users: { ada: { visibleBadges: ['first_channel'] } },
        awardError: new Error('users/ada/badge_awards leak@example.com'),
    });
    let message = '';
    try {
        await run(world);
    } catch (err) {
        message = err.message;
    }
    assert.strictEqual(message, 'badge distribution refresh failed');
    assert.deepStrictEqual(world.logs, ['[BADGE DIST] refresh failed']);
    assert.strictEqual(world.writes.length, 0);
    assert.strictEqual(world.calls.length, 0);
}));

queue.push(test('write:false rebuilds the same counts and does not set the doc', async function () {
    const world = createWorld({
        users: { ada: { visibleBadges: ['first_channel', 'first_channel'] } },
        awards: { ada: [{ id: 'first_channel', data: {} }] },
    });
    const preview = await run(world, { write: false });
    const published = await run(world);
    assert.strictEqual(preview.wrote, false);
    assert.strictEqual(published.wrote, true);
    assert.strictEqual(preview.totalUsers, published.totalUsers);
    assert.strictEqual(world.writes.length, 1);
    assert.strictEqual(world.writes[0].payload.counts.first_channel, 1);
}));

queue.push(test('the HTTP trigger cannot start a scan without admin auth', function () {
    const index = fs.readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8');
    const start = index.indexOf('// ── Badge Distribution Cache Refresh');
    const end = index.indexOf('exports.nachoAnnounce');
    const block = index.slice(start, end);
    const httpAt = block.indexOf('exports.refreshBadgeDistributionHttp');
    const http = block.slice(httpAt);
    assert.ok(block.indexOf('exports.refreshBadgeDistribution = onScheduleV2') !== -1);
    assert.ok(block.indexOf('no public invoker') !== -1);
    assert.ok(http.indexOf('timeoutSeconds: 540') !== -1);
    assert.ok(http.indexOf("if (!requireAdmin(req, res)) return;") !== -1);
    assert.ok(http.indexOf('requireAdmin') < http.indexOf('_refreshBadgeDistribution'));
    assert.ok(http.indexOf("console.error('[BADGE DIST HTTP] refresh failed')") !== -1);
    assert.ok(http.indexOf("console.error('[BADGE DIST HTTP]', e)") === -1);
    assert.ok(http.indexOf('res.status(500).json({ error: \'Internal server error\' })') !== -1);
    const schedule = block.slice(0, httpAt);
    assert.ok(schedule.indexOf('https.onRequest') === -1);
    const src = fs.readFileSync(path.join(__dirname, '../functions/src/badgeDistribution.js'), 'utf8');
    assert.ok(src.indexOf('hiddenBadges') !== -1);
    assert.ok(src.indexOf('PUBLIC_LIST_FIELDS') !== -1);
    assert.ok(src.indexOf('AUTH_LOOKUP_MAX') !== -1);
    assert.strictEqual(dist.isAnonymousRecord(null), true);
    assert.strictEqual(dist.isAnonymousRecord({ providerData: [] }), true);
    assert.strictEqual(dist.isAnonymousRecord({ providerData: [{ providerId: 'password' }] }), false);
}));

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
