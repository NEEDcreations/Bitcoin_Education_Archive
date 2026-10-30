#!/usr/bin/env node
// The public trivia file and every other served client file must not carry
// the answer index or the explanation. Grading returns both only after a
// real attempt. Guest play does not award XP.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const reward = require(path.join(root, 'functions/src/questReward'));
const triviaKey = require(path.join(root, 'functions/src/triviaKey'));
const uploader = require(path.join(root, 'functions/scripts/upload-trivia-key'));
const { publicTriviaBody } = require(path.join(root, 'functions/build-reward-banks'));
const FAKE_TRIVIA = require('./fake-trivia-key');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (err) {
        console.log('❌ ' + name + ': ' + (err && err.stack ? err.stack : err));
        failed++;
    }
}

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

function loadBank(rel) {
    return new Function(read(rel) + '\nreturn TRIVIA_BANK;')();
}

const SKIP_DIR = {
    functions: true,
    tests: true,
    scripts: true,
    workers: true,
    docs: true,
    node_modules: true,
    '.git': true,
    '.github': true,
    '.githooks': true,
    '.oss-scanner': true,
    dev: true,
};

function servedFiles() {
    const out = [];
    function walk(dir, rel) {
        fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
            if (ent.name === '.' || ent.name === '..') return;
            const nextRel = rel ? rel + '/' + ent.name : ent.name;
            if (ent.isDirectory()) {
                if (SKIP_DIR[ent.name] || ent.name.startsWith('.')) return;
                walk(path.join(dir, ent.name), nextRel);
                return;
            }
            if (!ent.isFile()) return;
            if (/\.(md|src|sh|py|mjs|rules)$/.test(ent.name)) return;
            if (/\.(js|html|json|css)$/.test(ent.name)) out.push(nextRel);
        });
    }
    walk(root, '');
    return out;
}

test('committed trivia files are questions and options only', function () {
    const pub = loadBank('data/trivia-bank.js');
    const priv = loadBank('functions/src/trivia-bank.js');
    assert.strictEqual(pub.length, 158);
    assert.strictEqual(priv.length, pub.length);
    assert.strictEqual(read('data/trivia-bank.js'), publicTriviaBody(priv));
    pub.forEach(function (row, i) {
        assert.deepStrictEqual(Object.keys(row).sort(), ['options', 'q']);
        assert.deepStrictEqual(Object.keys(priv[i]).sort(), ['options', 'q']);
        assert.strictEqual(row.q, priv[i].q);
        assert.deepStrictEqual(row.options, priv[i].options);
        assert.strictEqual(row.options.length, 4);
    });
    function assertTriviaPublic(rows, name) {
        rows.forEach(function (row, i) {
            assert.deepStrictEqual(Object.keys(row).sort(), ['options', 'q'], name + ' ' + i);
        });
    }
    const banks = JSON.parse(read('functions/reward-banks.json'));
    const prev = JSON.parse(read('functions/reward-banks.prev.json'));
    assertTriviaPublic(banks.trivia, 'reward-banks');
    assertTriviaPublic(prev.trivia, 'reward-banks.prev');
    assert.strictEqual(banks.trivia.length, pub.length);
    const rules = read('firestore.rules');
    const block = rules.slice(rules.indexOf('match /private_banks/{docId}'), rules.indexOf('match /private_banks/{docId}') + 180);
    assert.ok(block.includes('allow read, write: if false'));
    assert.ok(read('.gitignore').includes('functions/private-bank/trivia-key.json'));
    assert.ok(String(uploader.EXPECTED).endsWith('functions/private-bank/trivia-key.json'));
});

test('grading returns the explanation only after a real attempt', function () {
    const dayKey = reward.offsetDateKey(Date.now());
    const index = reward.triviaIndexForDay(dayKey, FAKE_TRIVIA.length);
    const question = FAKE_TRIVIA[index];
    const correctText = question.options[question.answer];
    const wrong = question.options.find(function (option) { return option !== correctText; });
    const base = { dayKey: dayKey, questionIndex: index, q: question.q, now: Date.now(), dailyUsed: 0, trivia: FAKE_TRIVIA };
    const right = reward.gradeTrivia(Object.assign({}, base, { chosen: correctText }));
    assert.strictEqual(right.correct, true);
    assert.strictEqual(right.awarded, 50);
    assert.strictEqual(right.answerIndex, question.answer);
    assert.strictEqual(right.explanation, question.explanation);
    const missed = reward.gradeTrivia(Object.assign({}, base, { chosen: wrong }));
    assert.strictEqual(missed.correct, false);
    assert.strictEqual(missed.awarded, 0);
    assert.strictEqual(missed.explanation, question.explanation);
    assert.strictEqual(missed.answerIndex, question.answer);
    const wrongDay = reward.gradeTrivia(Object.assign({}, base, { chosen: correctText, dayKey: '1999-01-01' }));
    assert.strictEqual(wrongDay.ok, false);
    assert.strictEqual(wrongDay.explanation, undefined);
    assert.strictEqual(wrongDay.answerIndex, undefined);
    const banned = reward.gradeTrivia(Object.assign({}, base, { chosen: correctText, banned: true }));
    assert.strictEqual(banned.reason, 'banned');
    assert.strictEqual(banned.awarded, 0);
    assert.strictEqual(banned.explanation, undefined);
    assert.strictEqual(banned.answerIndex, undefined);
    const bannedMiss = reward.gradeTrivia(Object.assign({}, base, { chosen: wrong, banned: true }));
    assert.strictEqual(bannedMiss.explanation, undefined);
    assert.strictEqual(bannedMiss.answerIndex, undefined);
    const callables = read('functions/src/questCallables.js');
    assert.ok(callables.includes("provider === 'anonymous'"));
    assert.ok(callables.includes('function triviaReveal'));
    const failAt = callables.indexOf('if (!graded.ok)');
    const failReturn = callables.slice(failAt, callables.indexOf('if (!userDoc.exists)'));
    assert.ok(!failReturn.includes('triviaReveal'));
    assert.ok(failReturn.includes('reason: graded.reason'));
});

test('guest and offline trivia cannot earn XP', function () {
    const src = read('quests.js');
    const start = src.indexOf('window.triviaAnswer = function');
    const end = src.indexOf('// POLL QUEST SYSTEM');
    assert.ok(start > 0 && end > start);
    const fn = src.slice(start, end);
    assert.ok(fn.includes("httpsCallable('answerTrivia')"));
    assert.ok(fn.includes('Try again later.'));
    assert.ok(fn.includes("d.reason === 'banned'"));
    assert.ok(fn.indexOf("d.reason === 'banned'") < fn.indexOf('_finishTrivia(d.correct'));
    assert.ok(fn.includes('Trivia is unavailable on this account.'));
    assert.ok(fn.includes('Guest and offline answers are not graded and do not earn XP'));
    assert.ok(fn.includes('_triviaCanGrade'));
    assert.ok(fn.includes('_markTriviaChecking'));
    assert.ok(!fn.includes('t.answer'));
    assert.ok(!fn.includes('awardPoints'));
    assert.ok(!fn.includes('chosenIdx ==='));
    assert.ok(!fn.includes('btc_points'));
    const render = src.slice(src.indexOf('function _renderTriviaTab'), start);
    assert.ok(!render.includes('t.answer'));
    assert.ok(!render.includes('t.explanation'));
    assert.ok(render.includes('state.answerIndex'));
    assert.ok(render.includes('state.explanation'));

    const document = {
        createElement: function () {
            return { style: {}, setAttribute: function () {}, appendChild: function () {}, childNodes: [] };
        },
        head: { appendChild: function () {} },
        body: { appendChild: function () {}, removeChild: function () {} },
        getElementById: function () { return null; },
        querySelectorAll: function () { return []; },
        addEventListener: function () {},
        readyState: 'loading',
    };
    const store = {};
    const toasts = [];
    const awards = [];
    const calls = [];
    const sandbox = {
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        document: document,
        Date: Date,
        Math: Math,
        Number: Number,
        String: String,
        parseInt: parseInt,
        isFinite: isFinite,
        getDailyKey: function () { return '2026-10-27'; },
        localStorage: {
            getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
            setItem: function (key, value) { store[key] = String(value); },
        },
        history: { replaceState: function () {}, pushState: function () {} },
        location: { hash: '', pathname: '/' },
        TRIVIA_BANK: [{ q: 'Guest question?', options: ['A', 'B', 'C', 'D'] }],
        POLL_BANK: [],
        auth: { currentUser: { isAnonymous: true, uid: 'guest' } },
        firebase: { functions: function () { throw new Error('guest called functions'); } },
        awardPoints: function () { awards.push(arguments); },
        showToast: function (msg) { toasts.push(msg); },
        db: {
            collection: function () {
                return {
                    doc: function () {
                        return {
                            onSnapshot: function () { return function () {}; },
                            get: function () {
                                return { then: function () { return { catch: function () { return this; } }; } };
                            },
                        };
                    },
                };
            },
        },
    };
    sandbox.window = sandbox;
    sandbox.addEventListener = function () {};
    sandbox.removeEventListener = function () {};
    document.head = document.createElement('head');
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { filename: 'quests.js' });
    sandbox.triviaAnswer(0);
    assert.strictEqual(awards.length, 0);
    assert.strictEqual(calls.length, 0);
    assert.strictEqual(store.btc_trivia_state, undefined);
    assert.strictEqual(store.btc_points, undefined);
    assert.ok(toasts.some(function (msg) { return String(msg).indexOf('do not earn XP') !== -1; }));
    sandbox.auth = { currentUser: null };
    sandbox.triviaAnswer(1);
    assert.strictEqual(awards.length, 0);
    assert.strictEqual(store.btc_points, undefined);
});

test('the uploader plans a fake key and its summary does not contain it', function () {
    const pub = FAKE_TRIVIA.map(function (row) {
        return { q: row.q, options: row.options.slice() };
    });
    const plan = uploader.planUpload(FAKE_TRIVIA, pub);
    assert.strictEqual(plan.ok, true);
    assert.strictEqual(plan.questions, 2);
    const broken = FAKE_TRIVIA.map(function (row, i) {
        return i === 0 ? { q: row.q, options: row.options.slice(), answer: 9, explanation: row.explanation } : row;
    });
    assert.strictEqual(uploader.planUpload(broken, pub).ok, false);
    const mismatched = FAKE_TRIVIA.map(function (row, i) {
        if (i !== 0) return row;
        return {
            q: 'Different question?',
            options: row.options.slice(),
            answer: row.answer,
            explanation: row.explanation,
        };
    });
    assert.strictEqual(uploader.planUpload(mismatched, pub).ok, false);
    const report = JSON.stringify(uploader.summary(plan, false));
    assert.strictEqual(report.indexOf(FAKE_TRIVIA[0].q), -1);
    assert.strictEqual(report.indexOf(FAKE_TRIVIA[0].explanation), -1);
    assert.strictEqual(report.indexOf('Green'), -1);
    const args = uploader.parseArgs(['functions/private-bank/trivia-key.json', '--apply']);
    assert.strictEqual(args.apply, true);
    assert.strictEqual(args.file, 'functions/private-bank/trivia-key.json');
    assert.strictEqual(uploader.parseArgs(['functions/private-bank/trivia-key.json']).apply, false);
    const aligned = triviaKey.questionsAligned(FAKE_TRIVIA, pub);
    assert.strictEqual(aligned.length, 2);
    assert.strictEqual(triviaKey.questionsAligned(broken, pub), null);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
