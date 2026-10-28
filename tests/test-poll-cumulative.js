#!/usr/bin/env node
'use strict';

// dailyPollVote creates and increments poll_cumulative once per accepted vote.
// A second vote the same day does not add another tally.
const assert = require('assert');
const path = require('path');
const { createPollVote } = require(path.join(__dirname, '..', 'functions/src/pollVote'));

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

function memory() {
    const docs = {};
    function apply(pathKey, data, merge) {
        const cur = merge && docs[pathKey] ? Object.assign({}, docs[pathKey]) : {};
        Object.keys(data || {}).forEach(function (key) {
            const value = data[key];
            if (value && value._inc) cur[key] = (Number(cur[key]) || 0) + value._inc;
            else cur[key] = value;
        });
        docs[pathKey] = cur;
    }
    function ref(pathKey) {
        const node = {
            path: pathKey,
            id: pathKey.split('/').pop(),
            collection: function (name) { return col(pathKey + '/' + name); },
            get: async function () {
                const data = docs[pathKey];
                return { exists: data != null, data: function () { return data; }, id: node.id };
            },
        };
        return node;
    }
    function col(pathKey) {
        return {
            doc: function (id) { return ref(pathKey + '/' + id); },
            get: async function () { return { docs: [], forEach: function () {} }; },
        };
    }
    const db = {
        docs: docs,
        collection: function (name) { return col(name); },
        runTransaction: async function (fn) {
            const pending = [];
            const tx = {
                get: async function (docRef) { return docRef.get(); },
                set: function (docRef, data, opts) {
                    pending.push({ path: docRef.path, data: data, merge: !!(opts && opts.merge) });
                },
                update: function (docRef, data) {
                    pending.push({ path: docRef.path, data: data, merge: true });
                },
            };
            const result = await fn(tx);
            pending.forEach(function (write) { apply(write.path, write.data, write.merge); });
            return result;
        },
    };
    return db;
}

function HttpsError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

const admin = {
    firestore: {
        FieldValue: {
            increment: function (n) { return { _inc: n }; },
            serverTimestamp: function () { return { _ts: true }; },
        },
    },
};

test('one vote creates the cumulative tally and a repeat does not', async function () {
    const db = memory();
    db.docs['users/u1'] = { points: 0 };
    const vote = createPollVote({ admin: admin, db: db, HttpsError: HttpsError });
    const ctx = { auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } } };
    const first = await vote({ chosenIdx: 1 }, ctx);
    assert.strictEqual(first.success, true);
    assert.strictEqual(first.already, false);
    const cumulative = Object.keys(db.docs).filter(function (key) { return key.indexOf('poll_cumulative/') === 0; });
    assert.strictEqual(cumulative.length, 1);
    assert.strictEqual(db.docs[cumulative[0]].total, 1);
    assert.strictEqual(db.docs[cumulative[0]].option_1, 1);
    const second = await vote({ chosenIdx: 2 }, ctx);
    assert.strictEqual(second.already, true);
    assert.strictEqual(db.docs[cumulative[0]].total, 1);
    assert.strictEqual(db.docs[cumulative[0]].option_2, undefined);
});

test('an anonymous caller does not write a tally', async function () {
    const db = memory();
    db.docs['users/guest'] = { points: 0 };
    const vote = createPollVote({ admin: admin, db: db, HttpsError: HttpsError });
    let code = '';
    try {
        await vote({ chosenIdx: 0 }, { auth: { uid: 'guest', token: { firebase: { sign_in_provider: 'anonymous' } } } });
    } catch (e) { code = e.code; }
    assert.strictEqual(code, 'permission-denied');
    const cumulative = Object.keys(db.docs).filter(function (key) { return key.indexOf('poll_cumulative/') === 0; });
    assert.strictEqual(cumulative.length, 0);
});

test('rules close client writes on the cumulative tally', function () {
    const fs = require('fs');
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const at = rules.indexOf('match /poll_cumulative/{pollId}');
    assert.ok(at > 0);
    const block = rules.slice(at, rules.indexOf('match /', at + 10));
    assert.ok(block.includes('allow read: if true'));
    assert.ok(block.includes('allow create, update, delete: if false'));
    assert.strictEqual(block.includes('request.resource.data.total'), false);
    const stats = rules.slice(rules.indexOf('match /stats/{statId}'), rules.indexOf('match /nacho_analytics_rate/'));
    assert.ok(stats.includes('allow read: if true'));
    assert.ok(stats.includes('allow create, update, delete: if false'));
    assert.strictEqual(stats.includes("statId == 'global'"), false);
    assert.strictEqual(stats.includes("statId == 'visits'"), false);
    assert.strictEqual(stats.includes("statId == 'nacho-analytics'"), false);
});

Promise.all(pending).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
