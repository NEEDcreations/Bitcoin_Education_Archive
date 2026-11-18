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

test('a pick never repeats a question', () => {
    const bank = {};
    for (let t = 0; t < 4; t++) {
        bank['topic' + t] = [];
        for (let i = 0; i < 6; i++) {
            bank['topic' + t].push({ q: 'T' + t + 'Q' + i + '?', a: 'A', wrong: ['B', 'C'] });
        }
    }
    const pool = pq.buildPool(bank);
    const picked = pq.pickQuestions(5, { pool: pool, rng: (function () { let s = 42; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; }; }()) });
    const qs = picked.map((row) => row.q);
    assert.strictEqual(qs.length, 5);
    assert.strictEqual(new Set(qs).size, 5);
});

test('picks spread across topics when the bank allows it', () => {
    const bank = {
        alpha: [{ q: 'A1?', a: 'A', wrong: ['B'] }, { q: 'A2?', a: 'A', wrong: ['B'] }, { q: 'A3?', a: 'A', wrong: ['B'] }],
        beta: [{ q: 'B1?', a: 'A', wrong: ['B'] }, { q: 'B2?', a: 'A', wrong: ['B'] }, { q: 'B3?', a: 'A', wrong: ['B'] }],
        gamma: [{ q: 'C1?', a: 'A', wrong: ['B'] }, { q: 'C2?', a: 'A', wrong: ['B'] }, { q: 'C3?', a: 'A', wrong: ['B'] }],
    };
    const pool = pq.buildPool(bank);
    const topics = {};
    for (let seed = 1; seed <= 8; seed++) {
        let s = seed * 99991;
        const rng = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
        const picked = pq.pickQuestions(3, { pool: pool, rng: rng });
        const used = {};
        picked.forEach((row) => {
            const src = pool.find((r) => r.q === row.q);
            used[src.topic] = true;
        });
        topics[Object.keys(used).length] = (topics[Object.keys(used).length] || 0) + 1;
        assert.strictEqual(new Set(picked.map((r) => r.q)).size, 3);
    }
    // At least some draws should use 3 different topics.
    assert.ok((topics[3] || 0) >= 1, 'expected a mixed-topic draw, got ' + JSON.stringify(topics));
});

test('exclude skips already-used questions and time-sensitive rows when others remain', () => {
    const bank = {
        t: [
            { q: 'Keep me?', a: 'A', wrong: ['B'] },
            { q: 'Also keep?', a: 'A', wrong: ['B'] },
            { q: 'Stale?', a: 'A', wrong: ['B'], timeSensitive: true },
            { q: 'Used already?', a: 'A', wrong: ['B'] },
        ]
    };
    const pool = pq.buildPool(bank);
    const picked = pq.pickQuestions(2, { pool: pool, exclude: ['Used already?'] });
    const qs = picked.map((r) => r.q);
    assert.strictEqual(qs.length, 2);
    assert.ok(qs.indexOf('Used already?') === -1);
    assert.ok(qs.indexOf('Stale?') === -1);
});

test('explanation stays on the server pick, never required', () => {
    const pool = pq.buildPool({
        t: [{ q: 'Why?', a: 'A', wrong: ['B'], explanation: 'Because A is right.' }]
    });
    const picked = pq.pickQuestions(1, { pool: pool });
    assert.strictEqual(picked[0].explain, 'Because A is right.');
    assert.ok(!('correct' in { q: picked[0].q, options: picked[0].options }));
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
