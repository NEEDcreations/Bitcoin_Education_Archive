#!/usr/bin/env node
// Client-side Quests, PvP, and Predictions leaderboard sort toggles.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

const ranking = read('ranking.js');
const sw = read('sw.js');
const html = read('index.html');
const html404 = read('404.html');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }
}

const store = {};
function loadSorts() {
    const start = ranking.indexOf('/* LB_SORTS_START */');
    const end = ranking.indexOf('/* LB_SORTS_END */');
    assert.ok(start !== -1 && end > start, 'sort helper block');
    const sandbox = {
        localStorage: {
            getItem: function(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
            setItem: function(k, v) { store[k] = String(v); },
            removeItem: function(k) { delete store[k]; }
        },
        window: {},
        document: { getElementById: function() { return null; } }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(ranking.slice(start, end) + '\ntrue;', sandbox, { filename: 'lb-sorts.js' });
    return sandbox;
}

test('service worker is v2743 and ranking.js is pinned with index == 404', function() {
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2746'"));
    assert.ok(!sw.includes("const CACHE_NAME = 'btc-archive-v2690'"));
    assert.ok(html.includes('ranking.js?v=20261128_v2746'));
    assert.strictEqual(html, html404);
});

test('the minimum attempts constant is 10 and lives in one place', function() {
    const s = loadSorts();
    assert.strictEqual(s.LB_PCT_MIN_ATTEMPTS, 10);
    const start = ranking.indexOf('/* LB_SORTS_START */');
    const end = ranking.indexOf('/* LB_SORTS_END */');
    const block = ranking.slice(start, end);
    const decls = block.match(/LB_PCT_MIN_ATTEMPTS\s*=\s*\d+/g) || [];
    assert.strictEqual(decls.length, 1);
    assert.strictEqual(decls[0], 'LB_PCT_MIN_ATTEMPTS = 10');
});

test('defaults are total, and the choice is remembered in localStorage', function() {
    Object.keys(store).forEach(function(k) { delete store[k]; });
    const s = loadSorts();
    assert.strictEqual(s._lbSortMode('quest'), 'total');
    assert.strictEqual(s._lbSortMode('pvp'), 'total');
    assert.strictEqual(s._lbSortMode('predict'), 'total');
    s._lbSetSortMode('quest', 'pct');
    s._lbSetSortMode('pvp', 'pct');
    s._lbSetSortMode('predict', 'pct');
    assert.strictEqual(store.btc_lb_sort_quest, 'pct');
    assert.strictEqual(store.btc_lb_sort_pvp, 'pct');
    assert.strictEqual(store.btc_lb_sort_predict, 'pct');
    assert.strictEqual(s._lbSortMode('quest'), 'pct');
    s._lbSetSortMode('quest', 'total');
    assert.strictEqual(s._lbSortMode('quest'), 'total');
});

test('Quests default to completed count, with a percent option', function() {
    const s = loadSorts();
    const rows = [
        { username: 'Ann', passes: 12, pct: 40 },
        { username: 'Bo', passes: 8, pct: 90 },
        { username: 'Cy', passes: 12, pct: 70 }
    ];
    const byTotal = s._lbSortRows(rows, { mode: 'total', applyMin: false, totalKey: 'passes' });
    assert.deepStrictEqual(byTotal.map(function(r) { return r.username; }), ['Cy', 'Ann', 'Bo']);
    assert.strictEqual(byTotal[0].rank, 1);
    const byPct = s._lbSortRows(rows, { mode: 'pct', applyMin: false, totalKey: 'passes' });
    assert.deepStrictEqual(byPct.map(function(r) { return r.username; }), ['Bo', 'Cy', 'Ann']);
});

test('PvP defaults to wins, and win % hides rows under 10 matches', function() {
    const s = loadSorts();
    const rows = [
        { uid: 'a', username: 'Ace', wins: 20, losses: 20 },
        { uid: 'b', username: 'Fox', wins: 9, losses: 0 },
        { uid: 'c', username: 'Gin', wins: 15, losses: 5 }
    ];
    const opts = {
        totalOf: function(row) { return Number(row.wins) || 0; },
        denomOf: function(row) { return (Number(row.wins) || 0) + (Number(row.losses) || 0); },
        pctOf: function(row) { return s._lbPctValue(row.wins, (Number(row.wins) || 0) + (Number(row.losses) || 0)); }
    };
    const byWins = s._lbSortRows(rows, Object.assign({ mode: 'total', applyMin: false }, opts));
    assert.deepStrictEqual(byWins.map(function(r) { return r.username; }), ['Ace', 'Gin', 'Fox']);
    const byPct = s._lbSortRows(rows, Object.assign({ mode: 'pct', applyMin: true }, opts));
    assert.deepStrictEqual(byPct.map(function(r) { return r.username; }), ['Gin', 'Ace']);
    assert.ok(byPct.every(function(r) { return (r.wins + r.losses) >= 10; }));
});

test('Predictions default to correct count, and correct % uses the threshold', function() {
    const s = loadSorts();
    const rows = [
        { username: 'Ann', correct: 20, total: 40, pct: 50 },
        { username: 'Bo', correct: 8, total: 8, pct: 100 },
        { username: 'Cy', correct: 15, total: 20, pct: 75 }
    ];
    const byCorrect = s._lbSortRows(rows, { mode: 'total', applyMin: false, totalKey: 'correct', denomKey: 'total' });
    assert.deepStrictEqual(byCorrect.map(function(r) { return r.username; }), ['Ann', 'Cy', 'Bo']);
    const byPct = s._lbSortRows(rows, { mode: 'pct', applyMin: true, totalKey: 'correct', denomKey: 'total' });
    assert.deepStrictEqual(byPct.map(function(r) { return r.username; }), ['Cy', 'Ann']);
});

test('ranking.js wires toggles into the three boards and does not change functions or rules', function() {
    assert.ok(ranking.indexOf("_lbSortToggleHtml('quest', 'Quests completed', 'Correct %')") !== -1);
    assert.ok(ranking.indexOf("_lbSortToggleHtml('pvp', 'Wins', 'Win %')") !== -1);
    assert.ok(ranking.indexOf("_lbSortToggleHtml('predict', 'Correct predictions', 'Correct %')") !== -1);
    assert.ok(ranking.indexOf("localStorage.setItem(LB_SORT_STORAGE[board], next)") !== -1);
    const start = ranking.indexOf('/* LB_SORTS_START */');
    const end = ranking.indexOf('/* LB_SORTS_END */');
    const block = ranking.slice(start, end);
    assert.ok(block.indexOf('collection(') === -1);
    assert.ok(block.indexOf('httpsCallable') === -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
