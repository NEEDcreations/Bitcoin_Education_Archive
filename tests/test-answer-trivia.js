#!/usr/bin/env node
// answerTrivia tallies the same bank slot it graded. The Firestore
// transaction is mocked: a first claim increments once, and a repeat,
// a ban, an unmatched choice, an optionId/text mismatch, two optionIds,
// or a non-string optionId does not pick a second slot. A wrong day or
// wrong question is rejected before any claim or tally write.
'use strict';

const assert = require('assert');
const path = require('path');

const root = path.join(__dirname, '..');
const reward = require(path.join(root, 'functions/src/questReward'));
const triviaKey = require(path.join(root, 'functions/src/triviaKey'));
const FAKE_TRIVIA = require('./fake-trivia-key');
triviaKey.useTriviaKeyForTests(FAKE_TRIVIA);

const state = { docs: Object.create(null), writes: [] };

function applyWrite(pathKey, data, merge) {
    const cur = merge && state.docs[pathKey] ? Object.assign({}, state.docs[pathKey]) : {};
    Object.keys(data || {}).forEach(function (key) {
        const value = data[key];
        if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, '_inc')) {
            cur[key] = (Number(cur[key]) || 0) + value._inc;
        } else {
            cur[key] = value;
        }
    });
    state.docs[pathKey] = cur;
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
    const data = state.docs[pathKey];
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
            state.writes.push(write);
            applyWrite(write.path, write.data, write.merge);
        });
        return result;
    },
};

function firestore() { return db; }
firestore.FieldValue = {
    serverTimestamp: function () { return { _serverTimestamp: true }; },
    increment: function (n) { return { _inc: n }; },
};

const adminPath = require.resolve('firebase-admin', { paths: [path.join(root, 'functions')] });
require.cache[adminPath] = {
    id: adminPath,
    filename: adminPath,
    loaded: true,
    exports: { firestore: firestore, initializeApp: function () {}, apps: [] },
};

const { answerTrivia } = require(path.join(root, 'functions/src/questCallables'));

let passed = 0;
let failed = 0;

let chain = Promise.resolve();
function test(name, fn) {
    chain = chain.then(function () {
        return Promise.resolve().then(fn).then(function () {
            passed++;
            console.log('✅ ' + name);
        }).catch(function (err) {
            failed++;
            console.log('❌ ' + name + ': ' + (err && err.stack ? err.stack : err));
        });
    });
}

function reset(seed) {
    state.docs = Object.create(null);
    Object.keys(seed || {}).forEach(function (key) { state.docs[key] = seed[key]; });
    state.writes = [];
}

function todayPayload(chosen, extra) {
    const now = Date.now();
    const dayKey = reward.offsetDateKey(now);
    const questionIndex = reward.triviaIndexForDay(dayKey, FAKE_TRIVIA.length);
    const question = FAKE_TRIVIA[questionIndex];
    return {
        dayKey: dayKey,
        questionIndex: questionIndex,
        question: question,
        data: Object.assign({
            dayKey: dayKey,
            questionIndex: questionIndex,
            q: question.q,
            chosen: chosen,
        }, extra || {}),
    };
}

function context(uid) {
    return { auth: { uid: uid, token: { firebase: { sign_in_provider: 'password' } } } };
}

function tallyWrites() {
    return state.writes.filter(function (write) {
        return write.path.indexOf('trivia_stats/') === 0 || write.path.indexOf('trivia_cumulative/') === 0;
    });
}

function assertCountedOnce(pack, slot) {
    const stats = tallyWrites().filter(function (write) { return write.path === 'trivia_stats/' + pack.dayKey; });
    const cumulative = tallyWrites().filter(function (write) {
        return write.path === 'trivia_cumulative/t_' + pack.questionIndex;
    });
    assert.strictEqual(stats.length, 1);
    assert.strictEqual(cumulative.length, 1);
    [stats[0], cumulative[0]].forEach(function (write) {
        assert.deepStrictEqual(write.data.total, { _inc: 1 });
        assert.deepStrictEqual(write.data['option_' + slot], { _inc: 1 });
        const optionKeys = Object.keys(write.data).filter(function (key) { return key.indexOf('option_') === 0; });
        assert.deepStrictEqual(optionKeys, ['option_' + slot]);
    });
    assert.strictEqual(cumulative[0].data.triviaIndex, pack.questionIndex);
}

function assertNotCounted() {
    assert.strictEqual(tallyWrites().length, 0);
}

function assertNoAnswerWrites() {
    state.writes.forEach(function (write) {
        assert.ok(write.path.indexOf('rate_limits/') === 0, 'unexpected write ' + write.path);
    });
    assertNotCounted();
}

test('gradeTrivia counts a valid optionId and drops a mismatch', function () {
    const now = Date.now();
    const dayKey = reward.offsetDateKey(now);
    const questionIndex = reward.triviaIndexForDay(dayKey, FAKE_TRIVIA.length);
    const question = FAKE_TRIVIA[questionIndex];
    const correctText = question.options[question.answer];
    const other = question.options.find(function (option) { return option !== correctText; });
    const base = { dayKey: dayKey, questionIndex: questionIndex, q: question.q, now: now, dailyUsed: 0, trivia: FAKE_TRIVIA };
    const idOnly = reward.gradeTrivia(Object.assign({}, base, { chosen: { optionId: reward.optionId(correctText) } }));
    assert.strictEqual(idOnly.correct, true);
    assert.strictEqual(idOnly.optionIndex, question.answer);
    const mismatch = reward.gradeTrivia(Object.assign({}, base, {
        chosen: { text: correctText, optionId: reward.optionId(other) },
    }));
    assert.strictEqual(mismatch.ok, true);
    assert.strictEqual(mismatch.correct, false);
    assert.strictEqual(mismatch.optionIndex, -1);
});

test('a first claim counts once and a repeat claim does not', async function () {
    const pack = todayPayload(null);
    const correctText = pack.question.options[pack.question.answer];
    const slot = pack.question.answer;
    reset({ 'users/alice': { points: 100000 } });
    const first = await answerTrivia.run(Object.assign({}, pack.data, { chosen: correctText }), context('alice'));
    assert.strictEqual(first.success, true);
    assert.strictEqual(first.correct, true);
    assert.strictEqual(first.statsRecorded, true);
    assert.strictEqual(first.alreadyClaimed, false);
    assert.strictEqual(first.answerIndex, slot);
    assert.strictEqual(first.explanation, pack.question.explanation);
    assert.ok(first.explanation);
    assertCountedOnce(pack, slot);

    const second = await answerTrivia.run(Object.assign({}, pack.data, { chosen: correctText }), context('alice'));
    assert.strictEqual(second.success, true);
    assert.strictEqual(second.alreadyClaimed, true);
    assert.strictEqual(second.statsRecorded, false);
    assert.strictEqual(second.answerIndex, slot);
    assert.strictEqual(second.explanation, pack.question.explanation);
    assert.strictEqual(tallyWrites().length, 2);
});

test('an optionId-only answer counts that bank slot', async function () {
    const pack = todayPayload(null);
    const correctText = pack.question.options[pack.question.answer];
    reset({ 'users/idonly': { points: 100000 } });
    const result = await answerTrivia.run(Object.assign({}, pack.data, {
        chosen: { optionId: reward.optionId(correctText) },
    }), context('idonly'));
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.correct, true);
    assert.strictEqual(result.statsRecorded, true);
    assertCountedOnce(pack, pack.question.answer);
});

test('a missing trivia key pays nothing and does not reveal an answer', async function () {
    triviaKey.useTriviaKeyForTests(null);
    const pack = todayPayload('Red');
    reset({ 'users/nokey': { points: 10 } });
    const result = await answerTrivia.run(pack.data, context('nokey'));
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'unavailable');
    assert.strictEqual(result.awarded, 0);
    assert.strictEqual(result.correct, false);
    assert.strictEqual(result.graded, false);
    assert.strictEqual(result.explanation, undefined);
    assert.strictEqual(result.answerIndex, undefined);
    assertNoAnswerWrites();
    triviaKey.useTriviaKeyForTests(FAKE_TRIVIA);
});

test('a banned user does not count and cannot read the answer', async function () {
    const pack = todayPayload(null);
    const correctText = pack.question.options[pack.question.answer];
    const wrong = pack.question.options.find(function (option) { return option !== correctText; });
    reset({ 'users/banned': { points: 100000, satsDisabled: true } });
    const result = await answerTrivia.run(Object.assign({}, pack.data, { chosen: correctText }), context('banned'));
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.banned, true);
    assert.strictEqual(result.correct, false);
    assert.strictEqual(result.awarded, 0);
    assert.strictEqual(result.graded, false);
    assert.strictEqual(result.statsRecorded, false);
    assert.strictEqual(result.reason, 'banned');
    assert.strictEqual(result.explanation, undefined);
    assert.strictEqual(result.answerIndex, undefined);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'explanation'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'answerIndex'), false);
    assertNotCounted();

    const again = await answerTrivia.run(Object.assign({}, pack.data, { chosen: wrong }), context('banned'));
    assert.strictEqual(again.success, false);
    assert.strictEqual(again.correct, false);
    assert.strictEqual(again.reason, 'banned');
    assert.strictEqual(again.explanation, undefined);
    assert.strictEqual(again.answerIndex, undefined);
    assert.deepStrictEqual(
        { success: again.success, correct: again.correct, explanation: again.explanation, answerIndex: again.answerIndex },
        { success: result.success, correct: result.correct, explanation: result.explanation, answerIndex: result.answerIndex }
    );
    assertNotCounted();

    reset({ 'users/later': { points: 100000 } });
    const first = await answerTrivia.run(Object.assign({}, pack.data, { chosen: correctText }), context('later'));
    assert.strictEqual(first.success, true);
    assert.strictEqual(first.answerIndex, pack.question.answer);
    state.docs['users/later'].satsDisabled = true;
    const later = await answerTrivia.run(Object.assign({}, pack.data, { chosen: wrong }), context('later'));
    assert.strictEqual(later.banned, true);
    assert.strictEqual(later.success, false);
    assert.strictEqual(later.correct, false);
    assert.strictEqual(later.explanation, undefined);
    assert.strictEqual(later.answerIndex, undefined);
});

test('an unmatched option does not count', async function () {
    const pack = todayPayload('not one of today\'s options');
    reset({ 'users/unmatched': { points: 100000 } });
    const result = await answerTrivia.run(pack.data, context('unmatched'));
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.correct, false);
    assert.strictEqual(result.statsRecorded, false);
    assertNotCounted();
});

test('an optionId and text that disagree do not count', async function () {
    const pack = todayPayload(null);
    const correctText = pack.question.options[pack.question.answer];
    const other = pack.question.options.find(function (option) { return option !== correctText; });
    reset({ 'users/mismatch': { points: 100000 } });
    const result = await answerTrivia.run(Object.assign({}, pack.data, {
        chosen: correctText,
        optionId: reward.optionId(other),
    }), context('mismatch'));
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.correct, false);
    assert.strictEqual(result.statsRecorded, false);
    assert.strictEqual(result.awarded, 0);
    assertNotCounted();
});

test('two different optionIds do not count', async function () {
    const pack = todayPayload(null);
    const options = pack.question.options;
    const otherText = options.find(function (option) { return option !== options[0]; });
    const firstId = reward.optionId(options[0]);
    const secondId = reward.optionId(otherText);
    assert.ok(otherText);
    assert.notStrictEqual(firstId, secondId);
    reset({ 'users/twoids': { points: 100000 } });
    const result = await answerTrivia.run(Object.assign({}, pack.data, {
        chosen: { optionId: firstId },
        optionId: secondId,
    }), context('twoids'));
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.correct, false);
    assert.strictEqual(result.statsRecorded, false);
    assert.strictEqual(result.awarded, 0);
    assertNotCounted();
});

test('a wrong day or wrong question writes no claim or tally', async function () {
    const pack = todayPayload(null);
    const correctText = pack.question.options[pack.question.answer];
    reset({ 'users/wrongday': { points: 100000 } });
    const wrongDay = await answerTrivia.run(Object.assign({}, pack.data, {
        chosen: correctText,
        dayKey: '1999-01-01',
    }), context('wrongday'));
    assert.strictEqual(wrongDay.success, false);
    assert.strictEqual(wrongDay.correct, false);
    assert.strictEqual(wrongDay.awarded, 0);
    assert.strictEqual(wrongDay.reason, 'wrong-day');
    assert.strictEqual(wrongDay.explanation, undefined);
    assert.strictEqual(wrongDay.answerIndex, undefined);
    assertNoAnswerWrites();

    reset({ 'users/wrongq': { points: 100000 } });
    const wrongQuestion = await answerTrivia.run(Object.assign({}, pack.data, {
        chosen: correctText,
        questionIndex: -1,
        q: 'not today\'s question',
    }), context('wrongq'));
    assert.strictEqual(wrongQuestion.success, false);
    assert.strictEqual(wrongQuestion.correct, false);
    assert.strictEqual(wrongQuestion.awarded, 0);
    assert.strictEqual(wrongQuestion.reason, 'wrong-question');
    assert.strictEqual(wrongQuestion.explanation, undefined);
    assert.strictEqual(wrongQuestion.answerIndex, undefined);
    assertNoAnswerWrites();
});

test('a non-string optionId does not choose a slot', async function () {
    const pack = todayPayload(null);
    const correctText = pack.question.options[pack.question.answer];
    const numericSlot = (pack.question.answer + 1) % pack.question.options.length;
    assert.notStrictEqual(numericSlot, pack.question.answer);
    reset({ 'users/numid': { points: 100000 } });
    const counted = await answerTrivia.run(Object.assign({}, pack.data, {
        chosen: { text: correctText, optionId: numericSlot },
    }), context('numid'));
    assert.strictEqual(counted.success, true);
    assert.strictEqual(counted.correct, true);
    assert.strictEqual(counted.statsRecorded, true);
    assertCountedOnce(pack, pack.question.answer);

    reset({ 'users/numonly': { points: 100000 } });
    const ignored = await answerTrivia.run(Object.assign({}, pack.data, {
        chosen: { optionId: numericSlot },
    }), context('numonly'));
    assert.strictEqual(ignored.success, true);
    assert.strictEqual(ignored.correct, false);
    assert.strictEqual(ignored.statsRecorded, false);
    assert.strictEqual(ignored.awarded, 0);
    assertNotCounted();
});

test('the trivia key is cached in memory and a miss is not cached', async function () {
    triviaKey.resetTriviaKeyForTests();
    const pub = FAKE_TRIVIA.map(function (row) {
        return { q: row.q, options: row.options.slice() };
    });
    let gets = 0;
    function dbWith(snap) {
        return {
            collection: function () {
                return {
                    doc: function () {
                        return {
                            get: async function () {
                                gets++;
                                return snap;
                            },
                        };
                    },
                };
            },
        };
    }
    const hit = dbWith({ exists: true, data: function () { return { questions: FAKE_TRIVIA }; } });
    const first = await triviaKey.loadTriviaKey(hit, pub, 1000);
    const second = await triviaKey.loadTriviaKey(hit, pub, 2000);
    assert.strictEqual(gets, 1);
    assert.strictEqual(first[0].answer, FAKE_TRIVIA[0].answer);
    assert.strictEqual(second[1].explanation, FAKE_TRIVIA[1].explanation);
    triviaKey.clearTriviaKeyCache();
    gets = 0;
    const miss = dbWith({ exists: false, data: function () { return null; } });
    assert.strictEqual(await triviaKey.loadTriviaKey(miss, pub, 5000), null);
    assert.strictEqual(await triviaKey.loadTriviaKey(miss, pub, 5001), null);
    assert.strictEqual(gets, 2);
    triviaKey.useTriviaKeyForTests(FAKE_TRIVIA);
});

chain.then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
});
