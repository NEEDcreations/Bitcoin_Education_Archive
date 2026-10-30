'use strict';

// dailyPollVote increments poll_cumulative inside the same transaction as the vote.
// A second vote does not move the total again.
const assert = require('assert');
const path = require('path');
const { createPollVote, pollForDay } = require(path.join(__dirname, '..', 'functions/src/pollVote'));
const { offsetDateKey } = require(path.join(__dirname, '..', 'functions/src/grantBadge'));

const docs = Object.create(null);
const writes = [];

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
            get: async function (docRef) { return snap(docRef.path); },
            set: function (docRef, data, opts) {
                pending.push({ path: docRef.path, data: data, merge: !!(opts && opts.merge) });
            },
            update: function (docRef, data) {
                pending.push({ path: docRef.path, data: data, merge: true });
            },
        };
        const result = await fn(tx);
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
    console.log('poll cumulative tests ok');
})().catch(function (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
