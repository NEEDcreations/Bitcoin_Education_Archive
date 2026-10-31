'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const joinDate = require('../functions/src/joinDate');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    const done = Promise.resolve().then(fn);
    return done.then(function () {
        console.log('✅ ' + name);
        passed++;
    }).catch(function (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    });
}

const NOW = Date.parse('2026-10-31T18:00:00.000Z');
const APRIL = Date.parse('2026-04-02T15:00:00.000Z');
const APRIL_SEC = Math.floor(APRIL / 1000);

function clientApi() {
    const src = read('messaging.js');
    const start = src.indexOf('// PROFILE_JOIN_START');
    const end = src.indexOf('// PROFILE_JOIN_END');
    assert.ok(start !== -1 && end > start);
    const block = src.slice(start, end);
    const fn = new Function(block + '\nreturn { profileJoinMillis: profileJoinMillis, profileJoinMillisFromSources: profileJoinMillisFromSources, profileJoinLabel: profileJoinLabel };');
    return { api: fn(), block: block };
}

function fakeAdmin(records) {
    return {
        auth: function () {
            return {
                getUser: async function (uid) {
                    if (!records[uid]) {
                        const err = new Error('missing');
                        err.code = 'auth/user-not-found';
                        throw err;
                    }
                    return records[uid];
                },
            };
        },
        firestore: {
            Timestamp: {
                fromMillis: function (ms) {
                    return { toMillis: function () { return ms; }, _ms: ms };
                },
            },
            FieldValue: {
                serverTimestamp: function () { return { _op: 'server' }; },
            },
        },
    };
}

const tests = [];

tests.push(test('millis accepts timestamp shapes and rejects a wrong era', function () {
    assert.strictEqual(joinDate.joinMillis(APRIL, NOW), APRIL);
    assert.strictEqual(joinDate.joinMillis(String(APRIL), NOW), APRIL);
    assert.strictEqual(joinDate.joinMillis(APRIL_SEC, NOW), null);
    assert.strictEqual(joinDate.joinMillis(String(APRIL_SEC), NOW), null);
    assert.strictEqual(joinDate.joinMillis({ seconds: APRIL_SEC, nanoseconds: 0 }, NOW), APRIL_SEC * 1000);
    assert.strictEqual(joinDate.joinMillis({ _seconds: APRIL_SEC, _nanoseconds: 0 }, NOW), APRIL_SEC * 1000);
    assert.strictEqual(joinDate.joinMillis({ toDate: function () { return new Date(APRIL); } }, NOW), APRIL);
    assert.strictEqual(joinDate.joinMillis({ toMillis: function () { return APRIL; } }, NOW), APRIL);
    assert.strictEqual(joinDate.joinMillis(new Date(APRIL), NOW), APRIL);
    assert.strictEqual(joinDate.joinMillis('2026-04-02T15:00:00.000Z', NOW), APRIL);
    assert.strictEqual(joinDate.joinMillis(new Date(0), NOW), null);
    assert.strictEqual(joinDate.joinMillis(3840, NOW), null);
    assert.strictEqual(joinDate.joinMillis(Date.parse('1970-01-20T00:00:00.000Z'), NOW), null);
    assert.strictEqual(joinDate.joinMillis(NOW + 7 * 24 * 60 * 60 * 1000, NOW), null);
    assert.strictEqual(joinDate.joinMillis('not-a-date', NOW), null);
    assert.strictEqual(joinDate.joinMillis('', NOW), null);
    assert.strictEqual(joinDate.joinMillis(null, NOW), null);
    assert.strictEqual(joinDate.joinMillis(true, NOW), null);
}));

tests.push(test('field variants win in order and last login is ignored', function () {
    const badCreated = { created: new Date(0), createdAt: APRIL };
    assert.strictEqual(joinDate.hasJoin(badCreated, NOW), true);
    assert.strictEqual(joinDate.joinMillis(badCreated.created, NOW), null);
    const onlyLogin = { lastLogin: APRIL, lastSeen: APRIL, lastVisit: '2026-04-02' };
    assert.strictEqual(joinDate.hasJoin(onlyLogin, NOW), false);
    const joinedAt = { joinedAt: { seconds: APRIL_SEC, nanoseconds: 0 } };
    assert.strictEqual(joinDate.hasJoin(joinedAt, NOW), true);
    const msField = { createdAtMs: APRIL };
    assert.strictEqual(joinDate.hasJoin(msField, NOW), true);
}));

tests.push(test('auth creationTime is the only backfill source', function () {
    const rows = [
        { id: 'has', data: { username: 'ada', created: new Date(APRIL) } },
        { id: 'missing', data: { username: 'bea', points: 3840, lastLogin: new Date(NOW) } },
        { id: 'bad', data: { username: 'cy', created: 3840 } },
        { id: 'gone', data: { username: 'dee' } },
        { id: 'mail', data: { username: 'dee@example.com' } },
    ];
    const auth = { missing: APRIL, bad: APRIL, mail: APRIL };
    const plan = joinDate.planJoinBackfill(rows, auth, NOW);
    assert.strictEqual(plan.already, 1);
    assert.strictEqual(plan.skippedNoAuth, 1);
    assert.strictEqual(plan.wouldStamp.length, 3);
    assert.strictEqual(plan.wouldStamp[0].username, 'bea');
    assert.strictEqual(plan.wouldStamp[0].iso, new Date(APRIL).toISOString());
    assert.strictEqual(plan.wouldStamp[1].username, 'cy');
    assert.strictEqual(plan.wouldStamp[2].username, '');
    assert.ok(!JSON.stringify(plan).includes('missing'));
    assert.ok(!JSON.stringify(plan).includes('@'));
}));

tests.push(test('applyMissingJoin stamps auth time and does not invent now for an old doc', async function () {
    const admin = fakeAdmin({
        ada: { metadata: { creationTime: '2026-04-02T15:00:00.000Z' } },
    });
    const fresh = {};
    await joinDate.applyMissingJoin(admin, 'ada', fresh, { exists: false });
    assert.strictEqual(fresh.created._ms, APRIL);

    const existing = { nostr: 'abc' };
    const snap = { exists: true, data: function () { return { created: { toMillis: function () { return APRIL; } } }; } };
    await joinDate.applyMissingJoin(admin, 'ada', existing, snap);
    assert.strictEqual(existing.created, undefined);

    const old = {};
    const oldSnap = { exists: true, data: function () { return { lastLogin: APRIL }; } };
    await joinDate.applyMissingJoin(fakeAdmin({}), 'missing-auth', old, oldSnap);
    assert.strictEqual(old.created, undefined);

    const createdNow = {};
    await joinDate.applyMissingJoin(fakeAdmin({}), 'missing-auth', createdNow, { exists: false });
    assert.strictEqual(createdNow.created._op, 'server');

    const trigger = {};
    const born = { exists: true, data: function () { return { points: 0 }; } };
    await joinDate.applyMissingJoin(fakeAdmin({}), 'missing-auth', trigger, born, { allowNow: true });
    assert.strictEqual(trigger.created._op, 'server');
}));

tests.push(test('client profile card matches the server parser and skips last login', function () {
    const loaded = clientApi();
    assert.ok(!loaded.block.includes('lastLogin'));
    assert.ok(!loaded.block.includes('lastSeen'));
    assert.ok(!loaded.block.includes('lastVisit'));
    const api = loaded.api;
    assert.strictEqual(api.profileJoinMillis(APRIL, NOW), joinDate.joinMillis(APRIL, NOW));
    assert.strictEqual(api.profileJoinMillis(APRIL_SEC, NOW), null);
    assert.strictEqual(api.profileJoinMillis({ _seconds: APRIL_SEC, _nanoseconds: 0 }, NOW), APRIL_SEC * 1000);
    assert.strictEqual(api.profileJoinMillis(3840, NOW), null);
    const label = api.profileJoinLabel([
        { lastLogin: new Date(NOW).toISOString(), points: 3840 },
        { createdAtMs: APRIL },
    ], NOW);
    assert.strictEqual(label, new Date(APRIL).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    const own = api.profileJoinLabel([
        { lastLogin: '2026-10-01T00:00:00.000Z' },
        { created: '2026-04-02T15:00:00.000Z' },
    ], NOW);
    assert.strictEqual(own, new Date(APRIL).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    assert.strictEqual(api.profileJoinLabel([{ lastLogin: APRIL }], NOW), '');
    const modal = read('messaging.js');
    const use = modal.indexOf('var joinSources = [u];');
    assert.ok(use !== -1);
    assert.ok(modal.indexOf('metadata.creationTime') === -1 || modal.indexOf('creationTime') > use);
    assert.ok(!modal.slice(use, use + 900).includes('lastLogin'));
}));

tests.push(test('signup paths stamp created on the server', function () {
    const index = read('functions/index.js');
    const api = read('functions/src/onboardingApi.js');
    const rules = read('firestore.rules');
    const ranking = read('ranking.js');
    assert.ok(index.includes("const joinDate = require('./src/joinDate');"));
    assert.ok(index.includes('await joinDate.applyMissingJoin(admin, nostrUid, nostrPatch, nostrExisting);'));
    assert.ok(index.includes('await joinDate.applyMissingJoin(admin, lnUid, lnPatch, lnExisting);'));
    assert.ok(index.includes('await joinDate.applyMissingJoin(admin, uid, createdPatch, snap, { allowNow: true });'));
    assert.ok(index.includes("'joinedAt'"));
    assert.ok(!index.includes('LAUNCH_DATE'));
    assert.ok(!index.includes("method = 'estimate'"));
    assert.ok(index.includes('writes: false'));
    const at = index.indexOf('exports.backfillJoinDates');
    const backfill = index.slice(at, at + 2200);
    assert.ok(!backfill.includes('.batch('));
    assert.ok(!backfill.includes('.update('));
    assert.ok(api.includes('await joinDate.applyMissingJoin(admin, uid, introPatch, userSnap);'));
    assert.ok(api.includes('await joinDate.applyMissingJoin(admin, uid, guestPatch, snap);'));
    assert.ok(api.includes('created: destJoinStamp || admin.firestore.FieldValue.serverTimestamp()'));
    assert.ok(api.includes('if (!joinDate.hasJoin(dest, nowMs) && destJoinStamp) update.created = destJoinStamp;'));
    assert.ok(api.includes('joinDate.timestampFromUserRecord(admin, authUser, nowMs)'));
    assert.ok(api.includes('if (!joinDate.hasJoin(current, nowMs))'));
    assert.ok(rules.includes("'created', 'createdAt', 'uid'"));
    assert.ok(ranking.includes('if (!nostrDoc.exists) nostrPatch.created = firebase.firestore.FieldValue.serverTimestamp();'));
    assert.ok(!ranking.includes("set({ created: firebase.firestore.FieldValue.serverTimestamp() }"));
    assert.ok(ranking.includes('created: firebase.firestore.FieldValue.serverTimestamp()'));
}));

tests.push(test('join backfill script is dry-run only', function () {
    const script = read('scripts/backfill-join-dates.js');
    assert.ok(script.includes('metadata.creationTime'));
    assert.ok(script.includes('creationTimeMillis'));
    assert.ok(!script.includes('.set('));
    assert.ok(!script.includes('.update('));
    assert.ok(!script.includes('.delete('));
    assert.ok(!script.includes('.batch('));
    assert.ok(!script.includes('lastLogin'));
    const help = spawnSync(process.execPath, [path.join(root, 'scripts/backfill-join-dates.js'), '--help'], { encoding: 'utf8' });
    assert.strictEqual(help.status, 0);
    assert.ok(help.stdout.includes('Does not write'));
    const apply = spawnSync(process.execPath, [path.join(root, 'scripts/backfill-join-dates.js'), '--apply'], { encoding: 'utf8' });
    assert.strictEqual(apply.status, 1);
    assert.ok(apply.stderr.includes('Dry-run only'));
    assert.ok(!apply.stdout.includes('scanned'));
}));

Promise.all(tests).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
