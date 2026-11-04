#!/usr/bin/env node
// pvpCreateMatch must pick questions and the answer key server-side.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const pq = require('../functions/src/pvpQuestions');
let passed = 0, failed = 0;
function test(n, fn) { try { fn(); console.log('  ok  ' + n); passed++; } catch (e) { failed++; console.log('  FAIL ' + n + ': ' + e.message); } }

const pool = pq.loadPool();
const byQ = new Map(pool.map(r => [r.q, r]));

test('server bank is loaded and large', () => assert(pool.length > 100));
test('picks 5 distinct questions from the server bank', () => {
    const qs = pq.pickQuestions(5);
    assert.strictEqual(qs.length, 5);
    assert.strictEqual(new Set(qs.map(q => q.q)).size, 5);
    qs.forEach(q => assert(byQ.has(q.q), 'question not from bank'));
});
test('answer key points at the bank answer', () => {
    for (let k = 0; k < 50; k++) pq.pickQuestions(5).forEach(q => {
        assert.strictEqual(q.options[q.correct], byQ.get(q.q).a);
        assert.strictEqual(q.options.length, byQ.get(q.q).wrong.length + 1);
    });
});
test('correct slot is not fixed', () => {
    const seen = new Set();
    for (let k = 0; k < 40; k++) pq.pickQuestions(5).forEach(q => seen.add(q.correct));
    assert(seen.size >= 3);
});
test('count is clamped to 1..5', () => {
    assert.strictEqual(pq.pickQuestions(99).length, 5);
    assert.strictEqual(pq.pickQuestions(1).length, 1);
});
test('invalid rows are dropped', () => {
    const p = pq.buildPool({ x: [{ q: 'ok', a: 'A', wrong: ['B'] }, { q: 'bad', a: 'A', wrong: ['A'] }, { q: '', a: 'A', wrong: ['B'] }, null] });
    assert.strictEqual(p.length, 1);
});
test('empty pool returns no questions', () => assert.deepStrictEqual(pq.pickQuestions(5, { pool: [] }), []));
test('pvpCreateMatch ignores client questions', () => {
    const src = fs.readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8');
    const body = src.slice(src.indexOf('exports.pvpCreateMatch'), src.indexOf('// ── Scholar Exam'));
    assert(/pvpQuestions'\)\.pickQuestions\(/.test(body));
    assert(!/\bquestions\.map\(/.test(body), 'client questions still mapped');
    assert(!/q\.correct\s*!==\s*'number'/.test(body));
});
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
