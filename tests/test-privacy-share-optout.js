#!/usr/bin/env node
'use strict';
const assert = require('assert');
const path = require('path');
const { createSetPrivacyShareOptOut } = require('../functions/src/privacyShareOptOut');

const writes = [];

function mockDb() {
    return {
        collection: function (name) {
            return {
                doc: function (id) {
                    return {
                        set: function (data, maybe) {
                            writes.push({ collection: name, id: id, data: data, merge: !!(maybe && maybe.merge) });
                            return Promise.resolve();
                        }
                    };
                }
            };
        }
    };
}

const admin = {
    firestore: {
        FieldValue: {
            serverTimestamp: function () { return { _serverTimestamp: true }; }
        }
    }
};

function HttpsError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

let passed = 0, failed = 0;
function test(name, fn) {
    return Promise.resolve().then(function () {
        writes.length = 0;
        return fn();
    }).then(function () {
        console.log('✅ ' + name);
        passed++;
    }).catch(function (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
    });
}

const handler = createSetPrivacyShareOptOut({ db: mockDb(), admin: admin, HttpsError: HttpsError }).setPrivacyShareOptOut;
const signed = { auth: { uid: 'user-1', token: { firebase: { sign_in_provider: 'google.com' } } } };

const pending = [];
pending.push(test('rejects signed-out callers', async function () {
    try {
        await handler({ optedOut: true }, {});
        assert.fail('expected error');
    } catch (e) {
        assert.strictEqual(e.code, 'unauthenticated');
    }
}));
pending.push(test('rejects anonymous accounts', async function () {
    try {
        await handler({ optedOut: true }, { auth: { uid: 'anon', token: { firebase: { sign_in_provider: 'anonymous' } } } });
        assert.fail('expected error');
    } catch (e) {
        assert.strictEqual(e.code, 'permission-denied');
    }
}));
pending.push(test('rejects a missing optedOut boolean', async function () {
    try {
        await handler({}, signed);
        assert.fail('expected error');
    } catch (e) {
        assert.strictEqual(e.code, 'invalid-argument');
    }
}));
pending.push(test('merges privacyShareOptOut onto the caller user doc only', async function () {
    const out = await handler({ optedOut: true }, signed);
    assert.deepStrictEqual(out, { ok: true, optedOut: true });
    assert.strictEqual(writes.length, 1);
    assert.strictEqual(writes[0].collection, 'users');
    assert.strictEqual(writes[0].id, 'user-1');
    assert.strictEqual(writes[0].merge, true);
    assert.strictEqual(writes[0].data.privacyShareOptOut, true);
    assert.ok(writes[0].data.privacyShareOptOutAt);
    const out2 = await handler({ optedOut: false }, signed);
    assert.strictEqual(out2.optedOut, false);
    assert.strictEqual(writes[1].data.privacyShareOptOut, false);
}));

Promise.all(pending).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
