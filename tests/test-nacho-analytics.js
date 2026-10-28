#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const nacho = require(path.join(__dirname, '..', 'functions/src/nachoAnalytics'));
const reset = require(path.join(__dirname, '..', 'functions/src/nachoAnalyticsReset'));

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
            if (value && value._inc) {
                const parts = key.split('.');
                if (parts.length === 2) {
                    cur[parts[0]] = Object.assign({}, cur[parts[0]] || {});
                    cur[parts[0]][parts[1]] = (Number(cur[parts[0]][parts[1]]) || 0) + value._inc;
                } else {
                    cur[key] = (Number(cur[key]) || 0) + value._inc;
                }
            } else if (value && value._ts) {
                cur[key] = 1;
            } else {
                cur[key] = value;
            }
        });
        docs[pathKey] = cur;
    }
    function ref(pathKey) {
        return { path: pathKey };
    }
    const db = {
        docs: docs,
        collection: function (name) { return { doc: function (id) { return ref(name + '/' + id); } }; },
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
HttpsError.prototype = Object.create(Error.prototype);

const admin = {
    firestore: {
        FieldValue: {
            increment: function (n) { return { _inc: n }; },
            serverTimestamp: function () { return { _ts: true }; },
        },
    },
};

test('a question bump adds exactly 1', async function () {
    const db = memory();
    const bump = nacho.createNachoBump({ admin: admin, db: db, HttpsError: HttpsError, now: function () { return 1000; } });
    const result = await bump({ kind: 'question', topic: 'Mining!', source: 'kb' }, { auth: { uid: 'u1' } });
    assert.strictEqual(result.ok, true);
    const doc = db.docs['stats/nacho-analytics'];
    assert.strictEqual(doc.totalQuestions, 1);
    assert.strictEqual(doc.topics.mining, 1);
    assert.strictEqual(doc.sources.kb, 1);
    assert.strictEqual(db.docs['nacho_analytics_rate/u1'].stamps.length, 1);
});

test('the rate limit stops a loop', async function () {
    const db = memory();
    let now = 5000;
    const bump = nacho.createNachoBump({
        admin: admin,
        db: db,
        HttpsError: HttpsError,
        now: function () { return now; },
        maxPerWindow: 2,
        windowMs: 10000,
    });
    const ctx = { auth: { uid: 'u1' } };
    await bump({ kind: 'up' }, ctx);
    now += 10;
    await bump({ kind: 'down' }, ctx);
    now += 10;
    let code = '';
    try { await bump({ kind: 'up' }, ctx); } catch (e) { code = e.code; }
    assert.strictEqual(code, 'resource-exhausted');
    assert.strictEqual(db.docs['stats/nacho-analytics'].upvotes, 1);
    assert.strictEqual(db.docs['stats/nacho-analytics'].downvotes, 1);
});

test('topic and source keys must be on the allowlist', async function () {
    const db = memory();
    const bump = nacho.createNachoBump({ admin: admin, db: db, HttpsError: HttpsError, now: function () { return 1000; } });
    const ctx = { auth: { uid: 'u1' } };
    await bump({ kind: 'question', topic: 'Mining!', source: 'kb' }, ctx);
    await bump({ kind: 'question', topic: '<script>', source: 'not-a-source' }, ctx);
    const doc = db.docs['stats/nacho-analytics'];
    assert.strictEqual(doc.totalQuestions, 2);
    assert.strictEqual(doc.topics.mining, 1);
    assert.strictEqual(doc.topics.script, undefined);
    assert.strictEqual(doc.sources.kb, 1);
    assert.strictEqual(doc.sources['not-a-source'], undefined);
    assert.strictEqual(nacho.allowKey('pwned', nacho.TOPIC_KEYS), '');
    assert.strictEqual(nacho.allowKey('other', nacho.TOPIC_KEYS), 'other');
});

test('unsigned and unknown events are rejected', async function () {
    const db = memory();
    const bump = nacho.createNachoBump({ admin: admin, db: db, HttpsError: HttpsError });
    let code = '';
    try { await bump({ kind: 'question' }, {}); } catch (e) { code = e.code; }
    assert.strictEqual(code, 'unauthenticated');
    code = '';
    try { await bump({ kind: 'totalQuestions', topic: 'x' }, { auth: { uid: 'u1' } }); } catch (e) { code = e.code; }
    assert.strictEqual(code, 'invalid-argument');
    assert.strictEqual(db.docs['stats/nacho-analytics'], undefined);
});

test('reset drops injected fields and sets sane totals', function () {
    const plan = reset.planNachoReset({
        totalQuestions: 999999999999,
        upvotes: 5,
        downvotes: -3,
        topics: { mining: 12, '<script>': 4, hacked: 1e20 },
        sources: { kb: 10 },
        missCount: 50,
        recentMisses: { a: { q: 'secret question' } },
        pwned: true,
    });
    assert.strictEqual(plan.next.totalQuestions, 12);
    assert.strictEqual(plan.next.upvotes, 5);
    assert.strictEqual(plan.next.downvotes, 0);
    assert.deepStrictEqual(plan.next.topics, { mining: 12 });
    assert.deepStrictEqual(plan.next.sources, { kb: 10 });
    assert.ok(plan.removedFields.indexOf('missCount') !== -1);
    assert.ok(plan.removedFields.indexOf('recentMisses') !== -1);
    assert.ok(plan.removedFields.indexOf('pwned') !== -1);
    assert.ok(!JSON.stringify(plan).includes('secret question'));
});

Promise.all(pending).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
