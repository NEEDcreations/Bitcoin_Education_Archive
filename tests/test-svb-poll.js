'use strict';

// Sats vs Bits tally is created by pollVote, inside the rate-limit transaction.
// The client must not create polls/sats_vs_bits.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createSvbVote } = require(path.join(__dirname, '..', 'functions/src/svbPoll'));

const docs = Object.create(null);
const batches = [];

function apply(pathKey, data, merge) {
    const cur = merge && docs[pathKey] ? Object.assign({}, docs[pathKey]) : {};
    Object.keys(data || {}).forEach(function (key) {
        const value = data[key];
        if (value && value._inc != null) cur[key] = (Number(cur[key]) || 0) + value._inc;
        else cur[key] = value;
    });
    docs[pathKey] = cur;
}

function snap(pathKey) {
    const data = docs[pathKey];
    return {
        exists: data != null,
        data: function () { return data ? Object.assign({}, data) : undefined; },
    };
}

function ref(pathKey) {
    return {
        path: pathKey,
        get: async function () { return snap(pathKey); },
    };
}

const db = {
    doc: function (pathKey) { return ref(pathKey); },
    runTransaction: async function (fn) {
        const pending = [];
        const reads = [];
        const tx = {
            get: async function (docRef) {
                reads.push(docRef.path);
                return snap(docRef.path);
            },
            set: function (docRef, data, opts) {
                pending.push({ path: docRef.path, data: data, merge: !!(opts && opts.merge) });
            },
        };
        const result = await fn(tx);
        batches.push({ reads: reads.slice(), writes: pending.slice() });
        pending.forEach(function (write) { apply(write.path, write.data, write.merge); });
        return result;
    },
};

function FieldValue() {}
FieldValue.increment = function (n) { return { _inc: n }; };
function HttpsError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

const vote = createSvbVote({
    admin: { firestore: { FieldValue: FieldValue } },
    db: db,
    HttpsError: HttpsError,
});

(async function main() {
    const root = path.join(__dirname, '..');
    const client = fs.readFileSync(path.join(root, 'sats-vs-bits.js'), 'utf8');
    assert.ok(client.includes("httpsCallable('pollVote')"));
    assert.strictEqual(client.includes('.set('), false);
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.ok(html.includes('sats-vs-bits.js?v=20261030_v2440'));
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const pollsAt = rules.indexOf('match /polls/{pollId}');
    const polls = rules.slice(pollsAt, rules.indexOf('match /certs/{certId}', pollsAt));
    assert.ok(polls.includes('allow read: if true'));
    assert.ok(polls.includes('allow create, update, delete: if false'));
    assert.strictEqual(polls.includes('allow create: if'), false);

    const created = await vote({
        side: 'sats',
        satsCount: 99999,
        bitsCount: -4,
        fingerprint: 'aa.bb/cc',
    }, { rawRequest: { ip: '203.0.113.9' } });
    assert.strictEqual(created.success, true);
    assert.strictEqual(docs['polls/sats_vs_bits'].sats, 50);
    assert.strictEqual(docs['polls/sats_vs_bits'].bits, undefined);
    assert.ok(batches[0].reads.indexOf('polls/sats_vs_bits') !== -1);
    assert.ok(batches[0].writes.some(function (write) { return write.path === 'polls/sats_vs_bits'; }));
    const ratePath = Object.keys(docs).filter(function (key) { return key.indexOf('poll_rate_limits/') === 0; })[0];
    assert.ok(ratePath);
    assert.strictEqual(docs[ratePath].ip_203_0_113_9, 50);
    assert.strictEqual(docs[ratePath].fp_aabbcc, 50);
    assert.strictEqual(Object.keys(docs[ratePath]).some(function (key) { return key.indexOf('.') !== -1; }), false);

    const more = await vote({ side: 'bits' }, { rawRequest: { ip: '203.0.113.9' } });
    assert.strictEqual(more.success, true);
    assert.strictEqual(docs['polls/sats_vs_bits'].sats, 50);
    assert.strictEqual(docs['polls/sats_vs_bits'].bits, 1);
    assert.strictEqual(more.sats, 50);
    assert.strictEqual(more.bits, 1);

    const bad = await vote({}, {});
    assert.strictEqual(bad.success, false);
    console.log('svb poll tests ok');
})().catch(function (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
