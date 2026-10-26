#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const attempt = require('../functions/src/scholarAttempt');
const bank = require('../functions/src/scholar-questions.json');
const scholarJs = fs.readFileSync(path.join(root, 'scholar.js'), 'utf8');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (err) {
        console.log('❌ ' + name + ': ' + (err && err.message ? err.message : err));
        failed++;
    }
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

test('the visible timer stays 10 minutes and the server grace is named', function () {
    assert.strictEqual(attempt.EXAM_LIMIT_MS, 10 * 60 * 1000);
    assert.strictEqual(attempt.EXAM_GRACE_MS, 2 * 60 * 1000);
    assert.strictEqual(attempt.EXAM_MIN_SUBMIT_MS, 60 * 1000);
    assert.ok(scholarJs.includes('scholarTimeLeft = 600'));
    assert.ok(!scholarJs.includes('scholarTimeLeft = 720'));
    assert.ok(!scholarJs.includes('12 * 60'));
    const start = 1_000_000;
    assert.strictEqual(attempt.expired(start, start + attempt.EXAM_LIMIT_MS + attempt.EXAM_GRACE_MS), false);
    assert.strictEqual(attempt.expired(start, start + attempt.EXAM_LIMIT_MS + attempt.EXAM_GRACE_MS + 1), true);
    assert.strictEqual(attempt.expired(null, start), true);
    assert.strictEqual(attempt.tooFast(start, start + attempt.EXAM_MIN_SUBMIT_MS - 1), true);
    assert.strictEqual(attempt.tooFast(start, start + attempt.EXAM_MIN_SUBMIT_MS), false);
});

test('the placeholder is excluded and the pools are 213 and 165', function () {
    assert.strictEqual(attempt.POOL_LENGTHS.properties, 213);
    assert.strictEqual(attempt.POOL_LENGTHS.technical, 165);
    assert.strictEqual(bank.properties.length, 213);
    assert.strictEqual(bank.technical.length, 165);
    assert.ok(!bank.properties.some(function (q) { return q.id === 'p119' || q.q === 'The question' || q.a === 'The correct answer'; }));
    assert.ok(!bank.technical.some(function (q) { return q.q === 'The question' || q.a === 'The correct answer'; }));
    assert.ok(!JSON.stringify(bank).includes('The correct answer'));
    assert.ok(!JSON.stringify(bank).includes('Distractor 1'));
    assert.deepStrictEqual(bank.excluded, [{ pool: 'properties', index: 119, q: 'The question' }]);
    bank.properties.concat(bank.technical).forEach(function (q) {
        assert.strictEqual(q.w.length, 4, q.id);
        assert.ok(q.q && q.a);
    });
});

test('a draw is 25 unique questions with opaque option ids', function () {
    const rng = mulberry32(7);
    const drawn = attempt.drawExam('properties', rng);
    assert.strictEqual(drawn.questions.length, 25);
    assert.strictEqual(drawn.served.length, 25);
    const ids = drawn.served.map(function (row) { return row.questionId; });
    assert.strictEqual(new Set(ids).size, 25);
    drawn.questions.forEach(function (q) {
        assert.deepStrictEqual(Object.keys(q).sort(), ['id', 'options', 'q']);
        q.options.forEach(function (opt) {
            assert.deepStrictEqual(Object.keys(opt).sort(), ['id', 'text']);
            assert.ok(!/correct/i.test(opt.id));
        });
    });
    drawn.served.forEach(function (row) {
        assert.ok(row.optionIds.indexOf(row.correctOptionId) !== -1);
    });
    assert.ok(!JSON.stringify(drawn.questions).includes('correctOptionId'));
});

test('10k draws stay inside the uniform band', function () {
    ['properties', 'technical'].forEach(function (type, index) {
        const pool = type === 'technical' ? bank.technical : bank.properties;
        const counts = {};
        pool.forEach(function (q) { counts[q.id] = 0; });
        const rng = mulberry32(20261026 + index);
        const draws = 10000;
        for (let n = 0; n < draws; n++) {
            const drawn = attempt.drawExam(type, rng);
            const seen = {};
            assert.strictEqual(drawn.served.length, 25);
            drawn.served.forEach(function (row) {
                assert.ok(!seen[row.questionId], 'repeat inside one draw');
                seen[row.questionId] = true;
                counts[row.questionId]++;
            });
        }
        const expected = draws * 25 / pool.length;
        Object.keys(counts).forEach(function (id) {
            assert.ok(counts[id] > expected * 0.75 && counts[id] < expected * 1.25, id + ' ' + counts[id] + ' expected ' + expected);
        });
    });
});

test('the dry-run script refuses --apply and does not connect by default', function () {
    const script = path.join(root, 'functions', 'dry-run-cert-records.js');
    const idle = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    assert.strictEqual(idle.status, 0);
    assert.ok(idle.stdout.includes('not executed'));
    assert.ok(idle.stdout.includes('Nothing was written.'));
    const apply = spawnSync(process.execPath, [script, '--apply'], { encoding: 'utf8' });
    assert.strictEqual(apply.status, 1);
    assert.ok((apply.stderr || '').includes('Refusing'));
    assert.ok(!(apply.stdout || '').includes('Certificates that still store'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
