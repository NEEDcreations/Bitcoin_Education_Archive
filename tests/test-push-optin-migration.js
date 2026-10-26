// Migration that keeps current push subscribers on. No network.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mig = require('../scripts/migrate-push-optin');

function test(name, fn) {
    const done = fn();
    if (done && typeof done.then === 'function') {
        return done.then(function () { console.log('✅ ' + name); });
    }
    console.log('✅ ' + name);
}

const TOKEN = 'a'.repeat(40);

function user(extra) {
    return Object.assign({ notificationPrefs: {} }, extra || {});
}

function record(parts) {
    return mig.buildRecord(parts);
}

const queue = [];

queue.push(test('a token of 20 to 512 characters is registered, and a short one is not', function () {
    assert.strictEqual(mig.validPushToken('a'.repeat(19)), false);
    assert.strictEqual(mig.validPushToken('a'.repeat(20)), true);
    assert.strictEqual(mig.validPushToken('a'.repeat(512)), true);
    assert.strictEqual(mig.validPushToken('a'.repeat(513)), false);
    assert.strictEqual(mig.validPushToken('  ' + 'a'.repeat(20)), false);
    assert.strictEqual(mig.validPushToken(TOKEN + '\n'), false);
    assert.strictEqual(mig.validPushToken(12345678901234567890), false);
    assert.strictEqual(mig.classifyUser(record({
        uid: 'short_token',
        user: user(),
        devices: [{ token: 'too-short' }]
    })), 'skip-no-token');
}));

queue.push(test('device, parent, and legacy user tokens all count', function () {
    assert.strictEqual(mig.classifyUser(record({
        uid: 'device_user',
        user: user(),
        devices: [{ token: TOKEN }]
    })), 'write');
    assert.strictEqual(mig.classifyUser(record({
        uid: 'parent_user',
        user: user(),
        parent: { token: TOKEN }
    })), 'write');
    assert.strictEqual(mig.classifyUser(record({
        uid: 'fcm_user',
        user: user({ fcmToken: TOKEN })
    })), 'write');
    assert.strictEqual(mig.classifyUser(record({
        uid: 'push_user',
        user: user({ pushToken: TOKEN })
    })), 'write');
    assert.strictEqual(mig.classifyUser(record({
        uid: 'empty_user',
        user: user()
    })), 'skip-no-token');
}));

queue.push(test('missing master is written, explicit opt-out and banned users are not', function () {
    assert.strictEqual(mig.classifyUser(record({
        uid: 'missing_master',
        user: { fcmToken: TOKEN },
        devices: [{ token: TOKEN }]
    })), 'write');
    assert.strictEqual(mig.classifyUser(record({
        uid: 'already_on',
        user: user({ notificationPrefs: { master: true, rewards: false }, fcmToken: TOKEN })
    })), 'already');
    assert.strictEqual(mig.classifyUser(record({
        uid: 'opted_out',
        user: user({ notificationPrefs: { master: false, rewards: true }, fcmToken: TOKEN })
    })), 'skip-opt-out');
    assert.strictEqual(mig.classifyUser(record({
        uid: 'banned_user',
        user: user({ banned: true, fcmToken: TOKEN })
    })), 'skip-banned');
    assert.strictEqual(mig.classifyUser(record({
        uid: 'banned_opt_out',
        user: user({ banned: true, notificationPrefs: { master: false }, fcmToken: TOKEN })
    })), 'skip-opt-out');
    assert.strictEqual(mig.classifyUser(record({
        uid: 'string_false',
        user: user({ notificationPrefs: { master: 'false' }, fcmToken: TOKEN })
    })), 'write');
    assert.strictEqual(mig.classifyUser(record({
        uid: 'guest_user',
        user: user({ anonymous: true, fcmToken: TOKEN })
    })), 'write');
    assert.strictEqual(mig.classifyUser(record({
        uid: 'no_user_doc',
        user: null,
        parent: { token: TOKEN }
    })), 'skip-missing');
}));

queue.push(test('the report lists eligible uids and counts, and never an address or a token', function () {
    const records = mig.indexSubscribers({
        tokenDocs: [
            { id: 'device_user', token: '' },
            { id: 'opted_out', token: TOKEN }
        ],
        devicesByUid: {
            device_user: [{ token: TOKEN, ua: 'secret-agent' }],
            banned_user: [{ token: TOKEN }]
        },
        userDocs: [
            { id: 'device_user', data: { notificationPrefs: { rewards: true }, email: 'one@example.com', username: 'nacho' } },
            { id: 'already_on', data: { notificationPrefs: { master: true }, fcmToken: TOKEN, email: 'two@example.com' } },
            { id: 'opted_out', data: { notificationPrefs: { master: false }, email: 'three@example.com' } },
            { id: 'banned_user', data: { banned: true, email: 'four@example.com' } },
            { id: 'plain_user', data: { email: 'five@example.com', username: 'plain' } },
            { id: 'bad uid', data: { fcmToken: TOKEN, email: 'six@example.com' } }
        ]
    });
    const summary = mig.summarize(records);
    assert.strictEqual(summary.counts.eligible, 2);
    assert.strictEqual(summary.counts.willWrite, 1);
    assert.strictEqual(summary.counts.already, 1);
    assert.strictEqual(summary.counts.skipOptOut, 1);
    assert.strictEqual(summary.counts.skipBanned, 1);
    assert.deepStrictEqual(summary.uids, ['already_on', 'device_user']);
    const report = mig.formatReport('dry-run', summary);
    assert.ok(report.includes('mode=dry-run'));
    assert.ok(report.includes('eligible=2'));
    assert.ok(report.includes('willWrite=1'));
    assert.ok(report.includes('already_on'));
    assert.ok(report.includes('device_user'));
    assert.strictEqual(report.includes('opted_out'), false);
    assert.strictEqual(report.includes('banned_user'), false);
    assert.strictEqual(report.includes('@'), false);
    assert.strictEqual(report.includes(TOKEN), false);
    assert.strictEqual(report.includes('secret-agent'), false);
    assert.strictEqual(report.includes('nacho'), false);
    assert.strictEqual(report.includes('example.com'), false);
}));

queue.push(test('dry-run is the default and --apply is explicit', function () {
    assert.strictEqual(mig.parseArgs(['node', 'scripts/migrate-push-optin.js']).apply, false);
    assert.strictEqual(mig.parseArgs(['node', 'scripts/migrate-push-optin.js', '--apply']).apply, true);
    assert.strictEqual(mig.parseArgs(['node', 'scripts/migrate-push-optin.js', '--help']).help, true);
    assert.ok(mig.APPLY_BATCH > 0 && mig.APPLY_BATCH <= 500);
    assert.deepStrictEqual(mig.USER_FIELDS.indexOf('email'), -1);
    assert.deepStrictEqual(mig.USER_FIELDS.indexOf('username'), -1);
    const src = fs.readFileSync(path.join(root, 'scripts/migrate-push-optin.js'), 'utf8');
    assert.ok(src.includes('dry-run'));
    assert.ok(src.includes("indexOf('--apply')"));
    assert.ok(src.includes("'notificationPrefs.master': true"));
    assert.ok(src.includes('runTransaction'));
    assert.ok(src.includes('if (!args.apply)'));
    assert.ok(src.includes('require.main === module'));
    assert.strictEqual(src.includes('service-account'), false);
    const notes = fs.readFileSync(path.join(root, 'patch-notes.html'), 'utf8');
    const privacy = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');
    const terms = fs.readFileSync(path.join(root, 'terms.html'), 'utf8');
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.ok(notes.includes('Devices that were already registered stay on unless you had turned them off.'));
    assert.ok(privacy.includes('If a device already had a push token and you had not turned notifications off, that registration stays on.'));
    assert.ok(terms.includes('when it already had a push token and you had not turned notifications off'));
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2373'"));
    assert.ok(!sw.includes('btc-archive-v2361'));
    assert.ok(!sw.includes('btc-archive-v2360'));
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
    assert.strictEqual(sw.includes('btc-archive-v2333'), false);
    assert.ok(!sw.includes('btc-archive-v2332'));
    assert.ok(!sw.includes('btc-archive-v2331'));
    assert.ok(!sw.includes('btc-archive-v2330'));
    assert.strictEqual(sw.includes('btc-archive-v2329'), false);
    assert.strictEqual(sw.includes('btc-archive-v2325'), false);
}));

function fakeDb(state) {
    const updates = [];
    function userRef(id) {
        return {
            path: 'users/' + id,
            id: id,
            collection: function () { throw new Error('users have no devices'); }
        };
    }
    function parentRef(id) {
        return {
            path: 'push_tokens/' + id,
            id: id,
            collection: function (sub) {
                return { path: 'push_tokens/' + id + '/' + sub, id: id, sub: sub, query: true };
            }
        };
    }
    return {
        updates: updates,
        collection: function (name) {
            return {
                doc: function (id) {
                    return name === 'users' ? userRef(id) : parentRef(id);
                }
            };
        },
        runTransaction: function (fn) {
            const tx = {
                get: function (ref) {
                    if (ref.query) {
                        const list = state.devices[ref.id] || [];
                        return Promise.resolve({
                            forEach: function (cb) {
                                list.forEach(function (row) {
                                    cb({ get: function (key) { return row[key]; } });
                                });
                            }
                        });
                    }
                    if (ref.path.indexOf('users/') === 0) {
                        const data = state.users[ref.id];
                        return Promise.resolve({
                            exists: !!data,
                            data: function () { return data; }
                        });
                    }
                    const parent = state.parents[ref.id];
                    return Promise.resolve({
                        exists: !!parent,
                        get: function (key) { return parent ? parent[key] : undefined; }
                    });
                },
                update: function (ref, patch) {
                    updates.push({ id: ref.id, patch: patch });
                    const data = state.users[ref.id];
                    data.notificationPrefs = Object.assign({}, data.notificationPrefs, { master: patch['notificationPrefs.master'] });
                }
            };
            return fn(tx);
        }
    };
}

queue.push(test('apply writes master true once and leaves opt-out and banned users alone', async function () {
    const state = {
        users: {
            missing_master: { notificationPrefs: { rewards: false }, fcmToken: TOKEN },
            already_on: { notificationPrefs: { master: true, news: true }, fcmToken: TOKEN },
            opted_out: { notificationPrefs: { master: false, rewards: true }, fcmToken: TOKEN },
            banned_user: { banned: true, notificationPrefs: { rewards: true }, fcmToken: TOKEN }
        },
        parents: {},
        devices: {
            missing_master: [{ token: TOKEN }],
            already_on: [{ token: TOKEN }],
            opted_out: [{ token: TOKEN }],
            banned_user: [{ token: TOKEN }]
        }
    };
    const db = fakeDb(state);
    assert.strictEqual(await mig.applyUser(db, 'missing_master'), 'wrote');
    assert.deepStrictEqual(db.updates, [{ id: 'missing_master', patch: { 'notificationPrefs.master': true } }]);
    assert.strictEqual(state.users.missing_master.notificationPrefs.rewards, false);
    assert.strictEqual(await mig.applyUser(db, 'missing_master'), 'already');
    assert.strictEqual(db.updates.length, 1);
    assert.strictEqual(await mig.applyUser(db, 'opted_out'), 'skip-opt-out');
    assert.strictEqual(await mig.applyUser(db, 'banned_user'), 'skip-banned');
    assert.strictEqual(await mig.applyUser(db, 'already_on'), 'already');
    assert.strictEqual(db.updates.length, 1);
    state.users.raced = { notificationPrefs: { master: false }, fcmToken: TOKEN };
    state.devices.raced = [{ token: TOKEN }];
    assert.strictEqual(await mig.applyUser(db, 'raced'), 'skip-opt-out');
    assert.strictEqual(db.updates.length, 1);
}));

queue.push(test('writes run in batches and an error does not stop the rest', async function () {
    const state = { users: {}, parents: {}, devices: {} };
    const uids = [];
    for (let i = 0; i < mig.APPLY_BATCH + 1; i++) {
        const uid = 'user_' + i;
        uids.push(uid);
        state.users[uid] = { fcmToken: TOKEN, notificationPrefs: {} };
        state.devices[uid] = [{ token: TOKEN }];
    }
    const db = fakeDb(state);
    const real = db.runTransaction;
    let calls = 0;
    db.runTransaction = function (fn) {
        calls++;
        if (calls === 2) return Promise.reject(new Error('boom secret@example.com'));
        return real(fn);
    };
    const logs = [];
    const original = console.log;
    console.log = function (line) { logs.push(line); };
    try {
        const result = await mig.applyWrites(db, uids);
        assert.strictEqual(result.wrote, uids.length - 1);
        assert.strictEqual(result.errors, 1);
        assert.ok(logs.join('\n').includes('[redacted]'));
        assert.strictEqual(logs.join('\n').includes('secret@example.com'), false);
        assert.ok(calls > mig.APPLY_BATCH);
    } finally {
        console.log = original;
    }
}));

Promise.all(queue).then(function () {
    console.log('push opt-in migration tests ok');
}).catch(function (err) {
    console.error(err);
    process.exit(1);
});
