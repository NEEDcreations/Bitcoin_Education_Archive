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
const { publicTriviaBody } = require(path.join(root, 'functions/build-reward-banks'));

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

test('served client files do not contain trivia answers or explanations', function () {
    const pub = loadBank('data/trivia-bank.js');
    const priv = loadBank('functions/src/trivia-bank.js');
    assert.strictEqual(pub.length, priv.length);
    assert.strictEqual(read('data/trivia-bank.js'), publicTriviaBody(priv));
    const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };
    pub.forEach(function (row, i) {
        assert.deepStrictEqual(Object.keys(row).sort(), ['options', 'q']);
        assert.strictEqual(row.q, priv[i].q);
        assert.deepStrictEqual(row.options, priv[i].options);
        assert.ok(Number.isInteger(priv[i].answer) && priv[i].answer >= 0 && priv[i].answer < 4);
        assert.strictEqual(priv[i].options[priv[i].answer] !== undefined, true);
        assert.ok(priv[i].explanation && priv[i].explanation.length > 20);
        counts[priv[i].answer]++;
    });
    // The old bank put the correct choice first on 157 of 158 rows.
    Object.keys(counts).forEach(function (slot) {
        assert.ok(counts[slot] < 60, 'answer slot ' + slot + ' has ' + counts[slot]);
    });
    const files = servedFiles();
    assert.ok(files.indexOf('data/trivia-bank.js') !== -1);
    assert.ok(files.indexOf('quests.js') !== -1);
    assert.ok(files.indexOf('index.html') !== -1);
    assert.strictEqual(files.indexOf('functions/src/trivia-bank.js'), -1);
    const needles = priv.map(function (row) { return row.explanation; });
    files.forEach(function (rel) {
        const text = read(rel);
        needles.forEach(function (explanation) {
            assert.ok(text.indexOf(explanation) === -1, rel + ' contains a trivia explanation');
        });
    });
    const publicText = read('data/trivia-bank.js');
    assert.ok(!/"answer"\s*:/.test(publicText));
    assert.ok(!/\bexplanation\s*:/.test(publicText));
});

test('grading returns the explanation only after a real attempt', function () {
    const dayKey = reward.offsetDateKey(Date.now());
    const index = reward.triviaIndexForDay(dayKey);
    const question = reward.triviaQuestion(index);
    const correctText = question.options[question.answer];
    const wrong = question.options.find(function (option) { return option !== correctText; });
    const base = { dayKey: dayKey, questionIndex: index, q: question.q, now: Date.now(), dailyUsed: 0 };
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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
