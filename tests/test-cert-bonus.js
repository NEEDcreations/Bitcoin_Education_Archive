#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const certBonus = require('../functions/src/certBonus');
const script = require('../functions/scripts/backfill_cert_bonus');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

test('a full day still plans the whole 2,100 outside the cap', function () {
    const plan = certBonus.planCertBonus({
        type: 'properties',
        passed: true,
        banned: false,
        alreadyPaid: false,
    });
    assert.strictEqual(plan.pay, true);
    assert.strictEqual(plan.amount, 2100);
    assert.strictEqual(plan.capExempt, true);
    assert.strictEqual(plan.source, 'cert_bonus');
    const again = certBonus.planCertBonus({
        type: 'technical',
        passed: true,
        banned: false,
        alreadyPaid: true,
    });
    assert.strictEqual(again.pay, false);
    assert.strictEqual(again.amount, 0);
    assert.strictEqual(again.reason, 'already');
});

test('a failed score and a ban do not pay', function () {
    assert.strictEqual(certBonus.planCertBonus({ type: 'properties', passed: false }).reason, 'not-passed');
    assert.strictEqual(certBonus.planCertBonus({ type: 'technical', passed: true, banned: true }).reason, 'banned');
    assert.strictEqual(certBonus.eligiblePass({ passed: true, score: 19 }), false);
    assert.strictEqual(certBonus.eligiblePass({ passed: true, score: 20 }), true);
    assert.strictEqual(certBonus.eligiblePass({ passed: true }), false);
});

test('marker or ledger means already paid', function () {
    const yes = { exists: true, data: function () { return { source: 'cert_bonus' }; } };
    const no = { exists: false, data: function () { return {}; } };
    assert.strictEqual(certBonus.alreadyPaid(yes, no), true);
    assert.strictEqual(certBonus.alreadyPaid(no, yes), true);
    assert.strictEqual(certBonus.alreadyPaid(no, no), false);
});

test('backfill lists the full amount and skips a second marker', function () {
    const fresh = certBonus.planBackfillRow({
        uid: 'u1',
        username: 'Ada',
        type: 'properties',
        exam: { passed: true, score: 22, type: 'properties' },
        banned: false,
        alreadyPaid: false,
    });
    assert.strictEqual(fresh.pay, true);
    assert.strictEqual(fresh.amount, 2100);
    const again = certBonus.planBackfillRow({
        uid: 'u1',
        type: 'properties',
        exam: { passed: true, score: 22 },
        alreadyPaid: true,
    });
    assert.strictEqual(again.pay, false);
    assert.strictEqual(again.amount, 0);
    assert.strictEqual(again.reason, 'already');
    const thin = certBonus.planBackfillRow({
        uid: 'u2',
        type: 'technical',
        exam: { passed: true },
    });
    assert.strictEqual(thin.amount, 0);
    assert.strictEqual(thin.reason, 'unverified-score');
    assert.deepStrictEqual(script.parseArgs(['--apply']), { help: false, apply: true });
    assert.strictEqual(script.parseArgs([]).apply, false);
});

test('gradeScholarExam pays cert_bonus and does not taper it', function () {
    const index = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const scholar = index.slice(index.indexOf('exports.gradeScholarExam'), index.indexOf('exports.startQuest'));
    assert.ok(scholar.indexOf('certBonus.planCertBonus') !== -1);
    assert.ok(scholar.indexOf('certBonus.writeMarkers') !== -1);
    assert.ok(scholar.indexOf('planDailyXp') === -1);
    assert.ok(scholar.indexOf('daily_points') === -1);
    assert.ok(scholar.indexOf('boostPoints') === -1);
    assert.ok(scholar.indexOf("already: true") !== -1);
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const block = rules.split('match /users/{userId}/cert_bonuses/{docId}')[1].split('match /')[0];
    assert.ok(block.indexOf('allow read, write: if false') !== -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
