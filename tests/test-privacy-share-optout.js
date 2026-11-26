#!/usr/bin/env node
'use strict';
const assert = require('assert');
const {
    createSetPrivacyShareOptOut,
    bindPrivacyShareOptOut,
    RATE_LIMIT_MAX
} = require('../functions/src/privacyShareOptOut');

function HttpsError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

const admin = {
    firestore: {
        FieldValue: {
            serverTimestamp: function () { return { _serverTimestamp: true }; }
        }
    }
};

function mockDb(opts) {
    opts = opts || {};
    const users = Object.assign({}, opts.users || { 'user-1': { uid: 'user-1' } });
    const rates = Object.assign({}, opts.rates || {});
    const ops = [];

    function ref(name, id) {
        return { _name: name, _id: id };
    }

    return {
        ops: ops,
        users: users,
        rates: rates,
        collection: function (name) {
            return {
                doc: function (id) {
                    return ref(name, id);
                }
            };
        },
        runTransaction: function (fn) {
            const tx = {
                get: function (r) {
                    if (r._name === 'users') {
                        const data = users[r._id];
                        return Promise.resolve({ exists: !!data, data: function () { return data; } });
                    }
                    if (r._name === 'rate_limits') {
                        const data = rates[r._id];
                        return Promise.resolve({ exists: !!data, data: function () { return data; } });
                    }
                    return Promise.resolve({ exists: false, data: function () { return undefined; } });
                },
                update: function (r, data) {
                    if (r._name === 'users') {
                        if (!users[r._id]) throw new Error('No document to update: ' + r._id);
                        Object.assign(users[r._id], data);
                    }
                    ops.push({ op: 'update', collection: r._name, id: r._id, data: data });
                },
                set: function (r, data, maybe) {
                    if (r._name === 'rate_limits') {
                        rates[r._id] = Object.assign({}, rates[r._id] || {}, data);
                    }
                    if (r._name === 'users') {
                        users[r._id] = Object.assign({}, users[r._id] || {}, data);
                    }
                    ops.push({ op: 'set', collection: r._name, id: r._id, data: data, merge: !!(maybe && maybe.merge) });
                }
            };
            return Promise.resolve(fn(tx));
        }
    };
}

let passed = 0, failed = 0;
function test(name, fn) {
    return Promise.resolve().then(function () {
        return fn();
    }).then(function () {
        console.log('✅ ' + name);
        passed++;
    }).catch(function (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
    });
}

function handlerFor(db, now) {
    return createSetPrivacyShareOptOut({
        db: db,
        admin: admin,
        HttpsError: HttpsError,
        now: now || function () { return 1_000_000; }
    }).setPrivacyShareOptOut;
}

const signed = { auth: { uid: 'user-1', token: { firebase: { sign_in_provider: 'google.com' } } } };

const pending = [];
pending.push(test('rejects signed-out callers', async function () {
    const handler = handlerFor(mockDb());
    try {
        await handler({ optedOut: true }, {});
        assert.fail('expected error');
    } catch (e) {
        assert.strictEqual(e.code, 'unauthenticated');
    }
}));
pending.push(test('rejects anonymous accounts', async function () {
    const handler = handlerFor(mockDb());
    try {
        await handler({ optedOut: true }, { auth: { uid: 'anon', token: { firebase: { sign_in_provider: 'anonymous' } } } });
        assert.fail('expected error');
    } catch (e) {
        assert.strictEqual(e.code, 'permission-denied');
    }
}));
pending.push(test('rejects a missing optedOut boolean', async function () {
    const handler = handlerFor(mockDb());
    try {
        await handler({}, signed);
        assert.fail('expected error');
    } catch (e) {
        assert.strictEqual(e.code, 'invalid-argument');
    }
}));
pending.push(test('updates an existing user doc and does not merge-set it', async function () {
    const db = mockDb();
    const handler = handlerFor(db);
    const out = await handler({ optedOut: true }, signed);
    assert.deepStrictEqual(out, { ok: true, optedOut: true });
    const userWrites = db.ops.filter(function (o) { return o.collection === 'users'; });
    assert.strictEqual(userWrites.length, 1);
    assert.strictEqual(userWrites[0].op, 'update');
    assert.strictEqual(userWrites[0].id, 'user-1');
    assert.strictEqual(userWrites[0].data.privacyShareOptOut, true);
    assert.ok(userWrites[0].data.privacyShareOptOutAt);
    assert.strictEqual(db.users['user-1'].privacyShareOptOut, true);
    const out2 = await handler({ optedOut: false }, signed);
    assert.strictEqual(out2.optedOut, false);
    assert.strictEqual(db.users['user-1'].privacyShareOptOut, false);
}));
pending.push(test('throws failed-precondition when users/{uid} is missing', async function () {
    const db = mockDb({ users: {} });
    const handler = handlerFor(db);
    try {
        await handler({ optedOut: true }, signed);
        assert.fail('expected error');
    } catch (e) {
        assert.strictEqual(e.code, 'failed-precondition');
    }
    assert.strictEqual(db.ops.length, 0);
    assert.strictEqual(db.users['user-1'], undefined);
}));
pending.push(test('rate-limits a uid to about 10 calls per minute', async function () {
    const db = mockDb();
    const handler = handlerFor(db, function () { return 5_000_000; });
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
        const out = await handler({ optedOut: i % 2 === 0 }, signed);
        assert.strictEqual(out.ok, true);
    }
    try {
        await handler({ optedOut: true }, signed);
        assert.fail('expected error');
    } catch (e) {
        assert.strictEqual(e.code, 'resource-exhausted');
    }
    assert.strictEqual(db.rates['privacy_share_optout_user-1'].count, RATE_LIMIT_MAX);
}));
pending.push(test('the rate-limit window resets after a minute', async function () {
    let now = 5_000_000;
    const db = mockDb();
    const handler = handlerFor(db, function () { return now; });
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
        await handler({ optedOut: true }, signed);
    }
    now = 5_000_000 + 60 * 1000;
    const out = await handler({ optedOut: false }, signed);
    assert.strictEqual(out.ok, true);
    assert.strictEqual(db.rates['privacy_share_optout_user-1'].count, 1);
    assert.strictEqual(db.rates['privacy_share_optout_user-1'].windowStart, now);
}));
pending.push(test('bindPrivacyShareOptOut enables App Check with runWith', function () {
    const calls = [];
    const functionsV1 = {
        runWith: function (opts) {
            calls.push(opts);
            return {
                https: {
                    onCall: function (fn) { return fn; }
                }
            };
        },
        https: {
            onCall: function () {
                throw new Error('bare https.onCall must not be used');
            }
        }
    };
    const bound = bindPrivacyShareOptOut(functionsV1, { db: mockDb(), admin: admin, HttpsError: HttpsError });
    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(calls[0], { enforceAppCheck: true });
    assert.strictEqual(typeof bound.setPrivacyShareOptOut, 'function');
    assert.strictEqual(typeof bound.handlers.setPrivacyShareOptOut, 'function');
}));

Promise.all(pending).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
