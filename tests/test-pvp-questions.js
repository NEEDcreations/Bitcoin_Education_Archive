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


test('the live quiz bank keeps option counts, drops removed rows, and flags time-sensitive ones', () => {
    const pool = pq.loadPool();
    assert.ok(pool.length >= 1000, 'expected the full quiz bank, got ' + pool.length);
    const texts = pool.map((r) => r.q);
    const answers = pool.map((r) => r.a);
    function noneMatch(re, label) {
        const hits = pool.filter((r) => re.test(r.q + ' ' + r.a));
        assert.strictEqual(hits.length, 0, label + ': ' + hits.map((r) => r.q).join(' | '));
    }
    noneMatch(/address poisoning/i, 'address poisoning should be gone');
    noneMatch(/billion-to-one/i, 'Bitaxe odds should not say billion-to-one');
    noneMatch(/more hardware than currently exists/i, '51% hardware claim should be gone');
    const bitaxe = pool.find((r) => /Bitaxe miner in July 2024/.test(r.q));
    assert.ok(bitaxe, 'Bitaxe solo-block question should be restored');
    assert.strictEqual(bitaxe.a, 'A Bitaxe solo-mined block 853,742, beating roughly 1-in-a-million daily odds');
    const hashprice = pool.filter((r) => /hashprice/i.test(r.q));
    assert.strictEqual(hashprice.length, 0, 'stale hashprice question should be removed');
    const subsidy = pool.filter((r) => /3\.125 BTC per block/.test(r.a));
    assert.strictEqual(subsidy.length, 1);
    assert.ok(/April 2024/.test(subsidy[0].q));
    assert.strictEqual(subsidy[0].timeSensitive, true);
    const zh = pool.filter((r) => /Zettahash per second/i.test(r.a) || /1 ZH\/s/i.test(r.a + ' ' + r.q));
    assert.strictEqual(zh.length, 1);
    assert.strictEqual(zh[0].timeSensitive, true);
    const gold = pool.find((r) => /gold's market cap/.test(r.q));
    assert.ok(!gold, 'stale gold-market-cap price question should be removed');
    const energy = pool.find((r) => r.q === 'Bitcoin mining primarily uses which type of energy?');
    assert.strictEqual(energy.a, 'About half from sustainable sources, often stranded or wasted energy');
    const hash = pool.find((r) => r.q.indexOf('approximate network hashrate in the 2024') !== -1);
    assert.strictEqual(hash.a, 'Over 700 exahashes per second (EH/s)');
    const fx = pool.find((r) => r.q === 'The first Bitcoin exchange rate was established at approximately:');
    assert.deepStrictEqual(fx.wrong, ['About $0.76 per BTC', 'About $0.10 per BTC', 'About $1.00 per BTC']);
    const bowl = pool.find((r) => /Super Bowl of Bitcoin/.test(r.q));
    assert.strictEqual(bowl.a, 'The Bitcoin Conference');
    const fees = pool.filter((r) => r.q === 'Bitcoin transaction fees are determined by:' || r.q === 'What determines Bitcoin transaction fees?');
    assert.strictEqual(fees.length, 2);
    fees.forEach((r) => {
        assert.ok(/vbytes/.test(r.a));
        assert.ok(!/\bin bytes\b/.test(r.a));
    });
    const flaggedLegal = pool.filter((r) => /legal tender/i.test(r.q + ' ' + r.a) && /El Salvador/i.test(r.q + ' ' + r.a));
    assert.ok(flaggedLegal.length >= 3);
    flaggedLegal.forEach((r) => assert.strictEqual(r.timeSensitive, true, r.q));
    pool.forEach((r) => {
        assert.ok(Array.isArray(r.wrong) && r.wrong.length === 3, r.q);
    });
    const flaggedQs = pool.filter((r) => r.timeSensitive).map((r) => r.q);
    assert.ok(flaggedQs.length >= 7);
    for (let i = 0; i < 20; i++) {
        const picked = pq.pickQuestions(5, { pool: pool });
        assert.strictEqual(picked.length, 5);
        const set = new Set(picked.map((r) => r.q));
        assert.strictEqual(set.size, 5);
        picked.forEach((r) => {
            assert.strictEqual(r.options.length, 4);
            assert.ok(typeof r.correct === 'number' && r.correct >= 0 && r.correct < 4);
            assert.ok(flaggedQs.indexOf(r.q) === -1, 'flagged row leaked into a pick: ' + r.q);
        });
    }
});

test('pvp lobby displays server pvpWins, not a localStorage counter', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'pvp.js.src'), 'utf8');
    const out = fs.readFileSync(path.join(__dirname, '..', 'pvp.js'), 'utf8');
    assert.ok(!src.includes('btc_pvp_wins'));
    assert.ok(!src.includes('btc_pvp_losses'));
    assert.ok(!out.includes('btc_pvp_wins'));
    assert.ok(!out.includes('btc_pvp_losses'));
    assert.ok(src.includes('var wins = serverPvpWins();'));
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
