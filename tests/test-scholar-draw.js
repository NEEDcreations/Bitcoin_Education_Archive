#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
process.env.SCHOLAR_BANK_PATH = require('./scholar-fixture').write('draw');
const attempt = require('../functions/src/scholarAttempt');
const cert = require('../functions/src/scholarCert');
const shape = require('../functions/src/scholarBankShape');
const fixture = require('./scholar-fixture').buildBank();
const scholarJs = fs.readFileSync(path.join(root, 'scholar.js'), 'utf8');
const attemptSrc = fs.readFileSync(path.join(root, 'functions', 'src', 'scholarAttempt.js'), 'utf8');

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
    assert.strictEqual(attempt.missingStart(null), true);
    assert.strictEqual(attempt.missingStart(undefined), true);
    assert.strictEqual(attempt.tooFast(start, start + attempt.EXAM_MIN_SUBMIT_MS - 1), true);
    assert.strictEqual(attempt.tooFast(start, start + attempt.EXAM_MIN_SUBMIT_MS), false);
    assert.strictEqual(attempt.EXAM_EXPIRED_OPEN_MESSAGE, 'This attempt expired. Start a new one.');
    assert.strictEqual(attempt.EXAM_DAILY_MESSAGE, 'You get one try per day (resets at midnight UTC).');
});

test('the fixture bank is 213 and 165 and a placeholder is rejected', function () {
    assert.strictEqual(fixture.properties.length, 213);
    assert.strictEqual(fixture.technical.length, 165);
    const ok = shape.validateBank(fixture);
    assert.strictEqual(ok.ok, true);
    assert.deepStrictEqual(ok.counts, { properties: 213, technical: 165 });
    const short = {
        properties: fixture.properties.slice(0, 10),
        technical: fixture.technical,
    };
    const badCount = shape.validateBank(short);
    assert.strictEqual(badCount.ok, false);
    assert.ok(badCount.errors.join(' ').indexOf('properties count is 10') !== -1);
    const placeholder = JSON.parse(JSON.stringify(fixture));
    placeholder.properties[0].q = 'The question';
    placeholder.properties[0].a = 'The correct answer';
    const badText = shape.validateBank(placeholder);
    assert.strictEqual(badText.ok, false);
    assert.ok(badText.errors.indexOf('properties contains a placeholder') !== -1);
    assert.ok(badText.errors.join('\n').indexOf('Fixture') === -1);
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
        const pool = type === 'technical' ? fixture.technical : fixture.properties;
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

test('draws and certificate ids use crypto and a fixed exam id shape', function () {
    assert.ok(attemptSrc.includes('crypto.randomInt'));
    assert.ok(attempt.examIdOk(attempt.newExamId()));
    assert.strictEqual(attempt.examIdOk('scholar-user_properties_1'), false);
    const first = cert.newCertId();
    const second = cert.newCertId();
    assert.ok(/^CERT-[0-9a-f]{32}$/.test(first));
    assert.notStrictEqual(first, second);
    assert.strictEqual(cert.certIdOk('CERT-M5K2P-AB12CD34'), true);
    assert.strictEqual(cert.certIdOk('../etc'), false);
    assert.strictEqual(cert.scoreLabel(22), '22 / 25');
});

test('a missing bank stays closed and the checker prints counts only', function () {
    const missing = spawnSync(process.execPath, ['-e', [
        "process.env.SCHOLAR_BANK_PATH = '/tmp/scholar-bank-does-not-exist.json';",
        "const bank = require('./functions/src/scholarBank');",
        "if (bank.ready()) process.exit(2);",
        "if (bank.getBank()) process.exit(3);",
        "process.exit(0);",
    ].join('\n')], { cwd: root, encoding: 'utf8' });
    assert.strictEqual(missing.status, 0, missing.stderr || missing.stdout);
    assert.ok(String(missing.stderr || '').includes('[SCHOLAR] exam bank unavailable'));
    assert.ok(!String(missing.stderr || '').includes('Fixture'));

    const bankFile = process.env.SCHOLAR_BANK_PATH;
    const ok = spawnSync(process.execPath, ['functions/scripts/check-bank.js', bankFile], { cwd: root, encoding: 'utf8' });
    assert.strictEqual(ok.status, 0, ok.stderr);
    assert.ok(ok.stdout.includes('properties 213'));
    assert.ok(ok.stdout.includes('technical 165'));
    assert.ok(ok.stdout.includes('\nok'));
    assert.ok(!ok.stdout.includes('Fixture'));
    assert.ok(!String(ok.stderr || '').includes('Fixture'));

    const bad = spawnSync(process.execPath, ['functions/scripts/check-bank.js', '/tmp/scholar-bank-does-not-exist.json'], { cwd: root, encoding: 'utf8' });
    assert.strictEqual(bad.status, 1);
    assert.ok(String(bad.stderr || '').includes('invalid'));
    assert.ok(!String(bad.stdout || '').includes('Fixture'));
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
