#!/usr/bin/env node
// Waving-hand search (wave/hi/hello) and a per-user Recent tab of the top 5 emojis.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'global-chat.js'), 'utf8');

function makeStorage() {
    const store = {};
    return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; }
    };
}

function load(uid) {
    const start = src.indexOf('var EMOJI_CATEGORIES = {');
    const end = src.indexOf('window.showEmojiPicker = function() {');
    if (start < 0 || end < 0 || end <= start) throw new Error('could not slice emoji helpers');
    const prelude = 'var CUSTOM_EMOJIS = { btc: { keywords: "bitcoin btc" } };\n';
    const code = prelude + src.slice(start, end);
    const sandbox = {
        window: {},
        auth: uid ? { currentUser: { uid: uid } } : { currentUser: null },
        localStorage: makeStorage(),
        Date: Date,
        Object: Object,
        Array: Array,
        String: String,
        Number: Number,
        JSON: JSON,
        console: console
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox;
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.message));
        failed++;
    }
}

test('waving hand is in the Gestures picker list', function () {
    const ctx = load(null);
    assert.ok(ctx.EMOJI_CATEGORIES.Gestures.indexOf('\u{1F44B}') !== -1);
});

test('searching wave, hi, or hello finds the waving hand', function () {
    const ctx = load(null);
    const wave = ctx._emojiSearchMatches('wave');
    const hi = ctx._emojiSearchMatches('hi');
    const hello = ctx._emojiSearchMatches('hello');
    assert.ok(wave.indexOf('\u{1F44B}') !== -1, 'wave should find waving hand, got ' + wave.join(','));
    assert.ok(hi.indexOf('\u{1F44B}') !== -1, 'hi should find waving hand, got ' + hi.join(','));
    assert.ok(hello.indexOf('\u{1F44B}') !== -1, 'hello should find waving hand, got ' + hello.join(','));
});

test('searching wave still finds the water wave', function () {
    const ctx = load(null);
    const wave = ctx._emojiSearchMatches('wave');
    assert.ok(wave.indexOf('\u{1F30A}') !== -1, 'wave should still find ocean wave');
});

test('Recent is the first emoji tab', function () {
    const ctx = load(null);
    const cats = ctx._emojiPickerCats(true);
    assert.strictEqual(cats[0], 'Recent');
    assert.ok(cats.indexOf('Smileys') > 0);
    assert.ok(cats.indexOf('Custom') > 0);
    const reactCats = ctx._emojiPickerCats(false);
    assert.strictEqual(reactCats[0], 'Recent');
    assert.ok(reactCats.indexOf('Custom') === -1);
});

test('Recent tab keeps a user top 5, most used first', function () {
    const ctx = load('user-a');
    function bump(e, n) { for (var i = 0; i < n; i++) ctx._emojiRecordUse(e); }
    bump('\u{1F44B}', 6);
    bump('\u{1F44D}', 5);
    bump('x1', 4);
    bump('x2', 3);
    bump('x3', 2);
    bump('\u{1F600}', 1);
    const top = ctx._emojiRecentTop(5);
    assert.deepStrictEqual(top, ['\u{1F44B}', '\u{1F44D}', 'x1', 'x2', 'x3']);
    assert.ok(top.indexOf('\u{1F600}') === -1, 'sixth emoji stays off the tab');
});

test('Recent counts are stored per user', function () {
    const ctxA = load('alice');
    const ctxB = load('bob');
    ctxA._emojiRecordUse('\u{1F44B}');
    ctxA._emojiRecordUse('\u{1F44B}');
    assert.deepStrictEqual(ctxA._emojiRecentTop(5), ['\u{1F44B}']);
    assert.deepStrictEqual(ctxB._emojiRecentTop(5), []);
});

console.log('Passed ' + passed + ', failed ' + failed);
process.exit(failed ? 1 : 0);
