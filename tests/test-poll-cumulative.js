'use strict';

// dailyPollVote increments poll_cumulative inside the same transaction as the vote.
// A second vote does not move the total again.
const assert = require('assert');
const path = require('path');
const { createPollVote, pollForDay } = require(path.join(__dirname, '..', 'functions/src/pollVote'));
const { offsetDateKey } = require(path.join(__dirname, '..', 'functions/src/grantBadge'));

const fs = require('fs');
const docs = Object.create(null);
const writes = [];
const gets = [];
const batches = [];

function applyWrite(pathKey, data, merge) {
    const cur = merge && docs[pathKey] ? Object.assign({}, docs[pathKey]) : {};
    Object.keys(data || {}).forEach(function (key) {
        const value = data[key];
        if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, '_inc')) {
            cur[key] = (Number(cur[key]) || 0) + value._inc;
        } else {
            cur[key] = value;
        }
    });
    docs[pathKey] = cur;
}

function ref(pathKey) {
    return {
        path: pathKey,
        collection: function (name) { return col(pathKey + '/' + name); },
    };
}

function col(pathKey) {
    return { doc: function (id) { return ref(pathKey + '/' + id); } };
}

function snap(pathKey) {
    const data = docs[pathKey];
    return {
        exists: data != null,
        id: pathKey.split('/').pop(),
        data: function () { return data ? Object.assign({}, data) : undefined; },
    };
}

const db = {
    collection: function (name) { return col(name); },
    runTransaction: async function (fn) {
        const pending = [];
        const tx = {
            get: async function (docRef) {
                gets.push(docRef.path);
                return snap(docRef.path);
            },
            set: function (docRef, data, opts) {
                pending.push({ path: docRef.path, data: data, merge: !!(opts && opts.merge) });
            },
            update: function (docRef, data) {
                pending.push({ path: docRef.path, data: data, merge: true });
            },
        };
        const result = await fn(tx);
        batches.push(pending.slice());
        pending.forEach(function (write) {
            writes.push(write);
            applyWrite(write.path, write.data, write.merge);
        });
        return result;
    },
};

function FieldValue() {}
FieldValue.serverTimestamp = function () { return { _serverTimestamp: true }; };
FieldValue.increment = function (n) { return { _inc: n }; };

function HttpsError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

const admin = { firestore: { FieldValue: FieldValue } };
const vote = createPollVote({
    admin: admin,
    db: db,
    HttpsError: HttpsError,
});

function context(uid) {
    return { auth: { uid: uid, token: { firebase: { sign_in_provider: 'password' } } } };
}

(async function main() {
    const day = offsetDateKey(Date.now());
    const today = pollForDay(day);
    assert.ok(today && today.poll && today.poll.id);
    const tallyId = today.poll.id + '_' + day;
    docs['users/ada'] = { points: 10, username: 'ada' };
    const first = await vote({ chosenIdx: 1 }, context('ada'));
    assert.strictEqual(first.success, true);
    assert.strictEqual(first.already, false);
    const cumulative = docs['poll_cumulative/' + tallyId];
    assert.ok(cumulative, 'poll_cumulative doc missing');
    assert.strictEqual(cumulative.total, 1);
    assert.strictEqual(cumulative.option_1, 1);
    assert.strictEqual(cumulative.option_0, undefined);
    assert.strictEqual(cumulative.day, day);
    const second = await vote({ chosenIdx: 2 }, context('ada'));
    assert.strictEqual(second.already, true);
    assert.strictEqual(docs['poll_cumulative/' + tallyId].total, 1);
    assert.strictEqual(docs['poll_cumulative/' + tallyId].option_1, 1);
    assert.strictEqual(docs['poll_cumulative/' + tallyId].option_2, undefined);
    const tallyWrites = writes.filter(function (write) { return write.path.indexOf('poll_cumulative/') === 0; });
    assert.strictEqual(tallyWrites.length, 1);
    assert.ok(gets.indexOf('poll_cumulative/' + tallyId) !== -1, 'cumulative tally is read in the transaction');
    const firstBatch = batches[0];
    assert.ok(firstBatch.some(function (write) { return write.path === 'poll_votes/' + tallyId; }));
    assert.ok(firstBatch.some(function (write) { return write.path === 'poll_cumulative/' + tallyId; }));
    docs['users/bob'] = { points: 0, username: 'bob' };
    const third = await vote({ chosenIdx: 0 }, context('bob'));
    assert.strictEqual(third.already, false);
    assert.strictEqual(docs['poll_cumulative/' + tallyId].total, 2);
    assert.strictEqual(docs['poll_cumulative/' + tallyId].option_0, 1);
    assert.strictEqual(docs['poll_cumulative/' + tallyId].option_1, 1);
    assert.strictEqual(docs['poll_votes/' + tallyId].votes[0], 1);
    assert.strictEqual(docs['poll_votes/' + tallyId].votes[1], 1);
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    function rulesBlock(marker) {
        const at = rules.indexOf(marker);
        assert.ok(at > 0, marker);
        return rules.slice(at, rules.indexOf('\n    match /', at + marker.length));
    }
    ['match /poll_votes/{pollId}', 'match /poll_cumulative/{pollId}', 'match /polls/{pollId}'].forEach(function (marker) {
        const block = rulesBlock(marker);
        assert.ok(block.includes('allow read: if true'), marker);
        assert.ok(block.includes('allow create, update, delete: if false'), marker);
        assert.strictEqual(block.includes('allow create: if request.auth'), false, marker);
    });
    const quests = fs.readFileSync(path.join(__dirname, '..', 'quests.js'), 'utf8');
    assert.ok(quests.includes("httpsCallable('dailyPollVote')"));
    assert.strictEqual(quests.includes("collection('poll_votes').doc(pollId).set"), false);
    assert.strictEqual(quests.includes("collection('poll_cumulative').doc"), false);
    console.log('poll cumulative tests ok');
})().catch(function (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
