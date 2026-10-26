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

test('backfill pays only the shortfall and never a second time', function () {
    const preCap = certBonus.planBackfillRow({
        uid: 'abcdefghijklmnop',
        type: 'properties',
        exam: { passed: true, score: 22, type: 'properties', gradedAt: '2026-04-12T00:00:00.000Z' },
    });
    assert.strictEqual(preCap.pay, false);
    assert.strictEqual(preCap.credited, 2100);
    assert.strictEqual(preCap.shortfall, 0);
    assert.strictEqual(preCap.reason, 'settled');

    const tapered = certBonus.planBackfillRow({
        uid: 'abcdefghijklmnop',
        type: 'technical',
        exam: { passed: true, score: 24, type: 'technical', gradedAt: '2026-10-24T00:00:00.000Z' },
        notice: { xp: 1000 },
    });
    assert.strictEqual(tapered.pay, true);
    assert.strictEqual(tapered.credited, 1000);
    assert.strictEqual(tapered.shortfall, 1100);
    assert.strictEqual(tapered.amount, 1100);

    const zero = certBonus.planBackfillRow({
        uid: 'abcdefghijklmnop',
        type: 'technical',
        exam: { passed: true, score: 21, pointsAwarded: 0, gradedAt: '2026-10-24T00:00:00.000Z' },
    });
    assert.strictEqual(zero.credited, 0);
    assert.strictEqual(zero.shortfall, 2100);
    assert.strictEqual(zero.pay, true);

    const again = certBonus.planBackfillRow({
        uid: 'abcdefghijklmnop',
        type: 'technical',
        exam: { passed: true, score: 24, pointsAwarded: 1000 },
        notice: { xp: 1000 },
        alreadyPaid: true,
    });
    assert.strictEqual(again.pay, false);
    assert.strictEqual(again.amount, 0);
    assert.strictEqual(again.shortfall, 0);
    assert.strictEqual(again.reason, 'already');

    const clash = certBonus.planBackfillRow({
        uid: 'zzzzzzzzzzzz',
        type: 'properties',
        exam: { passed: true, score: 22, pointsAwarded: 2100 },
        notice: { xp: 1000 },
    });
    assert.strictEqual(clash.reason, 'unknown');
    assert.strictEqual(clash.pay, false);
    assert.strictEqual(clash.amount, 0);

    const missing = certBonus.planBackfillRow({
        uid: 'zzzzzzzzzzzz',
        type: 'properties',
        exam: { passed: true, score: 22, gradedAt: '2026-10-24T12:00:00.000Z' },
    });
    assert.strictEqual(missing.reason, 'unknown');
    assert.strictEqual(missing.pay, false);

    const thin = certBonus.planBackfillRow({
        uid: 'u2',
        type: 'technical',
        exam: { passed: true },
    });
    assert.strictEqual(thin.amount, 0);
    assert.strictEqual(thin.reason, 'unverified-score');

    const ledger = certBonus.planBackfillRow({
        uid: 'u3',
        type: 'properties',
        exam: { passed: true, score: 23, gradedAt: '2026-10-24T00:00:00.000Z' },
        ledgerDocs: [{ id: 'scholar_prop', source: 'scholar_exam', certType: 'properties', awarded: 400 }],
    });
    assert.strictEqual(ledger.credited, 400);
    assert.strictEqual(ledger.shortfall, 1700);

    const line = script.lineFor(tapered);
    assert.ok(line.indexOf('uid=abcdefgh…') === 0);
    assert.ok(line.indexOf('abcdefghijklmnop') === -1);
    assert.ok(line.indexOf('cert=technical') !== -1);
    assert.ok(line.indexOf('credited=1000') !== -1);
    assert.ok(line.indexOf('shortfall=1100') !== -1);
    assert.ok(line.indexOf('@') === -1);
    assert.strictEqual(script.lineFor(missing).indexOf('credited=unknown') !== -1, true);
    const totals = script.summarize([preCap, tapered, missing]);
    assert.strictEqual(totals.users, 2);
    assert.strictEqual(totals.xp, 1100);
    assert.strictEqual(totals.unknown, 1);
    assert.deepStrictEqual(script.parseArgs(['--apply']), { help: false, apply: true });
    assert.strictEqual(script.parseArgs([]).apply, false);
    assert.strictEqual(certBonus.planCertBonus({ type: 'technical', passed: true }).amount, 2100);
    assert.strictEqual(certBonus.shouldApplyBackfill(preCap), false);
    assert.strictEqual(certBonus.shouldApplyBackfill(tapered), true);
    assert.strictEqual(certBonus.shouldApplyBackfill(missing), false);
    assert.strictEqual(certBonus.shouldApplyBackfill(again), false);
});

test('backfill skips a current ban and a ban that covered the pass', function () {
    const during = certBonus.bannedAtPass(
        {},
        { bannedAt: '2026-10-01T00:00:00.000Z', unbannedAt: '2026-10-20T00:00:00.000Z' },
        [{ passed: true, score: 22, gradedAt: '2026-10-10T00:00:00.000Z' }]
    );
    assert.strictEqual(during, true);
    const after = certBonus.bannedAtPass(
        {},
        { bannedAt: '2026-10-01T00:00:00.000Z', banEndedAt: '2026-10-20T00:00:00.000Z' },
        [{ passed: true, score: 22, gradedAt: '2026-10-24T00:00:00.000Z' }]
    );
    assert.strictEqual(after, false);
    const openStale = certBonus.bannedAtPass(
        {},
        { bannedAt: '2026-04-01T00:00:00.000Z' },
        [{ passed: true, score: 22, gradedAt: '2026-10-24T00:00:00.000Z' }]
    );
    assert.strictEqual(openStale, false);
    const undated = certBonus.bannedAtPass(
        { banHistory: [{ start: '2026-01-01T00:00:00.000Z', end: '2026-02-01T00:00:00.000Z' }] },
        {},
        [{ passed: true, score: 21 }]
    );
    assert.strictEqual(undated, true);
    const laterClean = certBonus.bannedAtPass(
        {},
        { bannedAt: '2026-04-01T00:00:00.000Z', unbannedAt: '2026-05-01T00:00:00.000Z' },
        [
            { passed: true, score: 22, gradedAt: '2026-04-15T00:00:00.000Z' },
            { passed: true, score: 24, gradedAt: '2026-10-24T00:00:00.000Z' },
        ]
    );
    assert.strictEqual(laterClean, false);
    const bannedRow = certBonus.planBackfillRow({
        uid: 'abcdefgh',
        type: 'properties',
        exam: { passed: true, score: 22, pointsAwarded: 1000, gradedAt: '2026-10-24T00:00:00.000Z' },
        banned: true,
    });
    assert.strictEqual(bannedRow.pay, false);
    assert.strictEqual(bannedRow.reason, 'banned');
    assert.strictEqual(bannedRow.amount, 0);
    assert.strictEqual(certBonus.shouldApplyBackfill(bannedRow), false);
    const backfill = fs.readFileSync(path.join(__dirname, '..', 'functions', 'scripts', 'backfill_cert_bonus.js'), 'utf8');
    assert.ok(backfill.indexOf('shouldApplyBackfill') !== -1);
    assert.ok(backfill.indexOf('bannedAtPass') !== -1);
    assert.ok(backfill.indexOf("row.reason === 'settled'") === -1);
    const credit = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'certBonus.js'), 'utf8');
    const fn = credit.slice(credit.indexOf('async function creditExistingPass'), credit.indexOf('module.exports'));
    assert.ok(fn.indexOf('settle') === -1);
    assert.ok(fn.indexOf('bannedAtPass') !== -1);
    assert.ok(fn.indexOf('shouldApplyBackfill') !== -1);
});

test('a pass during a ban is owed 0 after the user is unbanned', function () {
    const stamped = certBonus.planBackfillRow({
        uid: 'bannedone',
        type: 'properties',
        exams: [{
            passed: true,
            score: 22,
            pointsAwarded: 0,
            gradedAt: '2026-10-24T12:00:00.000Z',
            bonusBlocked: 'banned',
        }],
        banned: false,
    });
    assert.strictEqual(stamped.pay, false);
    assert.strictEqual(stamped.amount, 0);
    assert.strictEqual(stamped.shortfall, 0);
    assert.strictEqual(stamped.reason, 'banned');
    assert.strictEqual(certBonus.shouldApplyBackfill(stamped), false);

    const exams = [{ passed: true, score: 23, pointsAwarded: 0, gradedAt: '2026-10-24T12:00:00.000Z' }];
    const faucet = {
        banHistory: [{ bannedAt: '2026-10-20T00:00:00.000Z', unbannedAt: '2026-10-26T00:00:00.000Z' }],
    };
    const viaHistory = certBonus.planBackfillRow({
        uid: 'bannedone',
        type: 'technical',
        exams: exams,
        banned: certBonus.bannedAtPass({}, faucet, exams),
    });
    assert.strictEqual(certBonus.bannedAtPass({}, faucet, exams), true);
    assert.strictEqual(viaHistory.pay, false);
    assert.strictEqual(viaHistory.reason, 'banned');
    assert.strictEqual(viaHistory.shortfall, 0);
    assert.strictEqual(certBonus.shouldApplyBackfill(viaHistory), false);

    const history = certBonus.banHistoryAfterUnban({
        banned: true,
        bannedAt: '2026-10-20T00:00:00.000Z',
        ban_reason: 'abuse',
    }, '2026-10-26T00:00:00.000Z');
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].bannedAt, '2026-10-20T00:00:00.000Z');
    assert.strictEqual(history[0].unbannedAt, '2026-10-26T00:00:00.000Z');
    const clear = certBonus.banHistoryAfterUnban({ banned: false, banHistory: history }, '2026-11-01T00:00:00.000Z');
    assert.strictEqual(clear.length, 1);
    const later = certBonus.planBackfillRow({
        uid: 'bannedone',
        type: 'properties',
        exams: [
            { passed: true, score: 22, pointsAwarded: 0, bonusBlocked: 'banned', gradedAt: '2026-10-24T12:00:00.000Z' },
            { passed: true, score: 24, pointsAwarded: 1000, gradedAt: '2026-10-26T12:00:00.000Z' },
        ],
        banned: false,
    });
    assert.strictEqual(later.pay, true);
    assert.strictEqual(later.credited, 1000);
    assert.strictEqual(later.shortfall, 1100);

    const index = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const scholar = index.slice(index.indexOf('exports.gradeScholarExam'), index.indexOf('exports.startQuest'));
    assert.ok(scholar.indexOf("bonusBlocked = 'banned'") !== -1);
    assert.ok(scholar.indexOf('bonusBlockedAt') !== -1);
    const unban = index.slice(index.indexOf('exports.adminUnbanUser'), index.indexOf('exports.scheduleRaidBoss'));
    assert.ok(unban.indexOf('banHistoryAfterUnban') !== -1);
    assert.ok(unban.indexOf('banHistory') !== -1);
    assert.ok(unban.indexOf('runTransaction') !== -1);
    assert.ok(unban.indexOf('tx.get(faucetRef)') !== -1);
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
