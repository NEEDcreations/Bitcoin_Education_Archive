#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const pleb = require(path.join(__dirname, '..', 'functions/src/plebNumber'));

let passed = 0;
let failed = 0;
const pending = [];
function test(name, fn) {
    pending.push(Promise.resolve().then(fn).then(function () {
        console.log('✅ ' + name);
        passed++;
    }, function (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack || e.message));
        failed++;
    }));
}

test('an empty guest shell is not counted', function () {
    const decision = pleb.countDecision({
        before: null,
        after: { points: 0, guestLinkNonce: 'abc' },
        signedIn: false,
    });
    assert.strictEqual(decision.count, false);
    assert.strictEqual(decision.reason, 'shell');
});

test('first XP counts, a later XP does not', function () {
    const first = pleb.countDecision({
        before: { points: 0 },
        after: { points: 25 },
        signedIn: false,
    });
    assert.strictEqual(first.count, true);
    assert.strictEqual(first.reason, 'xp');
    const again = pleb.countDecision({
        before: { points: 25, plebNumber: 4 },
        after: { points: 40, plebNumber: 4 },
        signedIn: true,
    });
    assert.strictEqual(again.count, false);
    assert.strictEqual(again.reason, 'already');
});

test('a signed-in account with no XP still counts', function () {
    const decision = pleb.countDecision({
        before: null,
        after: { points: 0 },
        signedIn: true,
    });
    assert.strictEqual(decision.count, true);
    assert.strictEqual(decision.reason, 'signed-in');
});

test('existing pleb numbers are left alone', function () {
    const decision = pleb.countDecision({
        before: null,
        after: { points: 0, plebNumber: 12 },
        signedIn: true,
    });
    assert.strictEqual(decision.reason, 'already');
});

test('nostr and lightning uids are signed-in accounts', function () {
    assert.strictEqual(pleb.isSignedInAccount('nostr:abc', null), true);
    assert.strictEqual(pleb.isSignedInAccount('ln:abc', null), true);
    assert.strictEqual(pleb.isSignedInAccount('guestUid', null), false);
    assert.strictEqual(pleb.isSignedInAccount('guestUid', { providerData: [] }), false);
    assert.strictEqual(pleb.isSignedInAccount('realUid', {
        providerData: [{ providerId: 'google.com' }],
    }), true);
    assert.strictEqual(pleb.isSignedInAccount('mailUid', { email: 'a@b.co', providerData: [] }), true);
});

test('assignPlebNumber increments once', async function () {
    const docs = {
        'users/new': { points: 10 },
        'stats/global': { userCount: 7 },
    };
    function ref(key) {
        return {
            path: key,
            id: key.split('/').pop(),
        };
    }
    const db = {
        collection: function (name) {
            return { doc: function (id) { return ref(name + '/' + id); } };
        },
        runTransaction: async function (fn) {
            const pending = [];
            const tx = {
                get: async function (docRef) {
                    const data = docs[docRef.path];
                    return { exists: data != null, data: function () { return data; } };
                },
                set: function (docRef, data, opts) {
                    pending.push({ path: docRef.path, data: data, merge: !!(opts && opts.merge) });
                },
            };
            const result = await fn(tx);
            pending.forEach(function (write) {
                const cur = write.merge && docs[write.path] ? Object.assign({}, docs[write.path]) : {};
                Object.keys(write.data).forEach(function (key) {
                    const value = write.data[key];
                    if (value && value._inc) cur[key] = (Number(cur[key]) || 0) + value._inc;
                    else cur[key] = value;
                });
                docs[write.path] = cur;
            });
            return result;
        },
    };
    const admin = { firestore: { FieldValue: { increment: function (n) { return { _inc: n }; } } } };
    const first = await pleb.assignPlebNumber(db, admin, 'new');
    const second = await pleb.assignPlebNumber(db, admin, 'new');
    assert.strictEqual(first.assigned, true);
    assert.strictEqual(first.plebNumber, 8);
    assert.strictEqual(docs['users/new'].plebNumber, 8);
    assert.strictEqual(docs['stats/global'].userCount, 8);
    assert.strictEqual(second.assigned, false);
    assert.strictEqual(second.plebNumber, 8);
    assert.strictEqual(docs['stats/global'].userCount, 8);
});

Promise.all(pending).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
