#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const visits = require(path.join(__dirname, '..', 'functions/src/siteVisit'));

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
    const db = {
        docs: docs,
        collection: function (name) { return { doc: function (id) { return { path: name + '/' + id }; } }; },
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

const admin = { firestore: { FieldValue: { increment: function (n) { return { _inc: n }; } } } };

test('one uid counts once per UTC day', async function () {
    const db = memory();
    const now = Date.parse('2026-10-28T15:00:00Z');
    const record = visits.createSiteVisit({
        admin: admin,
        db: db,
        HttpsError: HttpsError,
        now: function () { return now; },
    });
    const ctx = { auth: { uid: 'u1' } };
    const first = await record({}, ctx);
    const second = await record({}, ctx);
    assert.strictEqual(first.counted, true);
    assert.strictEqual(second.counted, false);
    assert.strictEqual(db.docs['stats/visits'].total, 1);
    assert.strictEqual(db.docs['visits/u1'].lastVisit, '2026-10-28');
});

test('a signed-out call is rejected', async function () {
    const db = memory();
    const record = visits.createSiteVisit({ admin: admin, db: db, HttpsError: HttpsError });
    let code = '';
    try { await record({}, {}); } catch (e) { code = e.code; }
    assert.strictEqual(code, 'unauthenticated');
    assert.strictEqual(db.docs['stats/visits'], undefined);
});

Promise.all(pending).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
