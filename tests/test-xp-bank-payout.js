// Planner for the one-time overflow-bank payout. No Firestore.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const bank = require('../scripts/xp-bank-payout');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

test('payout is capped at 2000 and a farm flag does not change it', function() {
    const row = bank.planBankPayout({ uid: 'abc', pendingOverflow: 5000, points: 10, email: 'a@b.c', username: 'hidden' });
    assert.strictEqual(row.payout, 2000);
    assert.strictEqual(row.banked, 5000);
    assert.strictEqual(row.farmed, true);
    assert.ok(row.reasons.indexOf('bank-over-5x-points') !== -1);
    assert.ok(row.reasons.indexOf('bank-with-under-100-points') !== -1);
    assert.strictEqual(row.status, 'held for review');
    assert.strictEqual(row.willPay, false);
    const reported = bank.reportRow(row);
    assert.deepStrictEqual(Object.keys(reported).sort(), ['banked', 'farmed', 'payout', 'reasons', 'status', 'uid']);
    assert.strictEqual(reported.status, 'held for review');
    assert.strictEqual(JSON.stringify(reported).includes('a@b.c'), false);
    assert.strictEqual(JSON.stringify(reported).includes('hidden'), false);
    assert.strictEqual(JSON.stringify(reported).includes('@'), false);
});

test('farm flags and ordinary banks', function() {
    const huge = bank.planBankPayout({ uid: 'u1', pendingOverflow: 10000, points: 100000 });
    assert.strictEqual(huge.farmed, true);
    assert.ok(huge.reasons.indexOf('bank-over-10000') !== -1);
    assert.strictEqual(huge.payout, 2000);
    assert.strictEqual(huge.status, 'held for review');
    assert.strictEqual(huge.willPay, false);
    const ratio = bank.planBankPayout({ uid: 'u2', pendingOverflow: 2500, points: 400 });
    assert.strictEqual(ratio.farmed, true);
    assert.ok(ratio.reasons.indexOf('bank-over-5x-points') !== -1);
    assert.strictEqual(ratio.status, 'held for review');
    const low = bank.planBankPayout({ uid: 'u3', pendingOverflow: 2000, points: 50 });
    assert.strictEqual(low.farmed, true);
    assert.ok(low.reasons.indexOf('bank-with-under-100-points') !== -1);
    assert.strictEqual(low.status, 'held for review');
    const normal = bank.planBankPayout({ uid: 'u4', pendingOverflow: 1500, points: 10 });
    assert.strictEqual(normal.farmed, false);
    assert.strictEqual(normal.payout, 1500);
    assert.strictEqual(normal.status, 'pay');
    assert.strictEqual(normal.willPay, true);
    const under = bank.planBankPayout({ uid: 'u5', pendingOverflow: 1999, points: 0 });
    assert.strictEqual(under.farmed, false);
    assert.strictEqual(under.payout, 1999);
    assert.strictEqual(under.status, 'pay');
    const empty = bank.planBankPayout({ uid: 'u6', pendingOverflow: 0, points: 10 });
    assert.strictEqual(empty.payout, 0);
    assert.strictEqual(empty.skip, true);
    assert.strictEqual(empty.status, 'skip');
    assert.strictEqual(empty.willPay, false);
    const negative = bank.planBankPayout({ uid: 'u7', pendingOverflow: -40, points: 10 });
    assert.strictEqual(negative.banked, 0);
    assert.strictEqual(negative.payout, 0);
    assert.strictEqual(negative.status, 'skip');
});

test('banned accounts are held and an approve file is the only way they are paid', function() {
    const cases = [
        [{ uid: 'ban1', pendingOverflow: 400, points: 50, banned: true }, {}],
        [{ uid: 'ban2', pendingOverflow: 400, points: 50, satsDisabled: true }, {}],
        [{ uid: 'ban3', pendingOverflow: 400, points: 50, ban_reason: 'review' }, {}],
        [{ uid: 'ban4', pendingOverflow: 400, points: 50 }, { banned: true }],
    ];
    cases.forEach(function(pair) {
        const held = bank.planBankPayout(pair[0], pair[1]);
        assert.strictEqual(held.payout, 400, pair[0].uid);
        assert.strictEqual(held.status, 'held for review', pair[0].uid);
        assert.strictEqual(held.willPay, false, pair[0].uid);
        assert.ok(held.reasons.indexOf('banned') !== -1, pair[0].uid);
        assert.strictEqual(bank.reportRow(held).status, 'held for review');
    });
    const blank = bank.planBankPayout({ uid: 'open1', pendingOverflow: 400, points: 50, ban_reason: '' });
    assert.strictEqual(blank.status, 'pay');
    assert.strictEqual(blank.willPay, true);
    const approved = new Set(['ban1', 'farm1']);
    const paidBan = bank.planBankPayout({ uid: 'ban1', pendingOverflow: 400, points: 50, banned: true }, {}, approved);
    assert.strictEqual(paidBan.status, 'approved');
    assert.strictEqual(paidBan.willPay, true);
    assert.strictEqual(paidBan.payout, 400);
    const paidFarm = bank.planBankPayout({ uid: 'farm1', pendingOverflow: 5000, points: 10 }, {}, approved);
    assert.strictEqual(paidFarm.status, 'approved');
    assert.strictEqual(paidFarm.willPay, true);
    assert.strictEqual(paidFarm.payout, 2000);
    const stillHeld = bank.planBankPayout({ uid: 'ban2', pendingOverflow: 400, points: 50, satsDisabled: true }, {}, approved);
    assert.strictEqual(stillHeld.status, 'held for review');
    assert.strictEqual(stillHeld.willPay, false);
    const clean = bank.planBankPayout({ uid: 'clean1', pendingOverflow: 300, points: 20 }, {}, approved);
    assert.strictEqual(clean.status, 'pay');
    assert.strictEqual(clean.willPay, true);
    const skipHeld = bank.planBankPayout({ uid: 'ban1', pendingOverflow: 0, points: 50, banned: true }, { banned: true }, approved);
    assert.strictEqual(skipHeld.status, 'skip');
    assert.strictEqual(skipHeld.willPay, false);
    assert.strictEqual(skipHeld.payout, 0);
});

test('approve file keeps uids and drops comments and other lines', function() {
    const os = require('os');
    const file = path.join(os.tmpdir(), 'xp-approve-' + process.pid + '.txt');
    fs.writeFileSync(file, [
        '# comment',
        'goodUid_1',
        '  spaced-uid  ',
        '',
        'bad uid',
        'a@b.c',
        'also#inline',
        'ok2',
    ].join('\n'));
    const set = bank.readApproveFile(file);
    fs.unlinkSync(file);
    assert.strictEqual(set.has('goodUid_1'), true);
    assert.strictEqual(set.has('spaced-uid'), true);
    assert.strictEqual(set.has('also'), true);
    assert.strictEqual(set.has('ok2'), true);
    assert.strictEqual(set.has('a@b.c'), false);
    assert.strictEqual(set.has('bad uid'), false);
    assert.strictEqual(set.size, 4);
    assert.strictEqual(bank.readApproveFile('').size, 0);
});

test('an applied payout is skipped even if the bank field is still set', function() {
    const again = bank.planBankPayout({ uid: 'u8', pendingOverflow: 800, points: 20, xpBankPayoutApplied: true });
    assert.strictEqual(again.payout, 0);
    assert.strictEqual(again.skip, true);
    assert.strictEqual(again.alreadyApplied, true);
    assert.strictEqual(again.banked, 800);
    assert.strictEqual(again.status, 'skip');
    assert.strictEqual(again.willPay, false);
});

test('the script is a dry run unless --apply and it never reports an email', function() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'xp-bank-payout.js'), 'utf8');
    assert.ok(src.includes("process.argv.indexOf('--apply')"));
    assert.ok(src.includes('runTransaction'));
    assert.ok(src.includes('FieldValue.delete()'));
    assert.ok(src.includes('xpBankPayoutApplied'));
    assert.ok(src.includes('pendingOverflow: FieldValue.delete()'));
    assert.ok(src.includes('if (require.main === module)'));
    assert.ok(src.includes('no Firestore writes'));
    assert.ok(src.includes('held for review'));
    assert.ok(src.includes('--approve-file'));
    assert.ok(src.includes('faucet_ledger'));
    assert.ok(src.includes('ban_reason'));
    assert.ok(src.includes('satsDisabled'));
    assert.ok(src.includes('readApproveFile'));
    assert.strictEqual(src.includes('.email'), false);
    assert.strictEqual(src.includes('displayName'), false);
    assert.strictEqual(src.includes('username'), false);
    assert.ok(src.indexOf('if (apply && plan.willPay)') > src.indexOf("indexOf('--apply')"));
    assert.ok(src.indexOf('if (!plan.willPay)') > src.indexOf('runTransaction'));
    assert.strictEqual(bank.PAYOUT_CAP, 2000);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
