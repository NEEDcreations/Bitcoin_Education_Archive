'use strict';

const assert = require('assert');
const crypto = require('crypto');
const proof = require('../functions/src/cipherRollProof');
const { ROLL_SPACE, ROLL_SCHEMA, prizeFromRoll } = require('../functions/src/cipherReward');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

const SECRET = 'test-cipher-roll-secret-do-not-use';
const OTHER = 'other-cipher-roll-secret-xxxxx';
const NOW = Date.parse('2026-11-20T15:00:00.000Z');
const NEXT_DAY = Date.parse('2026-11-21T00:00:00.000Z');

test('period id is the UTC calendar day', () => {
    assert.strictEqual(proof.periodIdFromMs(NOW), '2026-11-20');
    assert.strictEqual(proof.periodIdFromMs(Date.parse('2026-11-20T23:59:59.999Z')), '2026-11-20');
    assert.strictEqual(proof.periodIdFromMs(NEXT_DAY), '2026-11-21');
    const bounds = proof.periodBounds('2026-11-20');
    assert.strictEqual(bounds.startMs, Date.parse('2026-11-20T00:00:00.000Z'));
    assert.strictEqual(bounds.endMs, NEXT_DAY);
    assert.strictEqual(proof.periodIsRevealed('2026-11-20', NOW), false);
    assert.strictEqual(proof.periodIsRevealed('2026-11-20', NEXT_DAY), true);
    assert.strictEqual(proof.periodIsRevealed('2026-11-20', NEXT_DAY - 1), false);
});

test('commitment is SHA256 of the period seed and does not reveal it', () => {
    const seed = proof.periodSeed(SECRET, '2026-11-20');
    const commit = proof.periodCommitment(seed);
    assert.strictEqual(seed.length, 64);
    assert.strictEqual(commit.length, 64);
    assert.notStrictEqual(seed, commit);
    assert.strictEqual(commit, crypto.createHash('sha256').update('bq-cipher-commit-v1:' + seed, 'utf8').digest('hex'));
    assert.notStrictEqual(proof.periodSeed(OTHER, '2026-11-20'), seed);
    assert.notStrictEqual(proof.periodSeed(SECRET, '2026-11-21'), seed);
});

test('rejection sampling is unbiased over the 1e12 space', () => {
    assert.strictEqual(ROLL_SPACE, 1000000000000);
    const threshold = proof.rejectionThreshold(ROLL_SPACE);
    const uint64 = 1n << 64n;
    assert.strictEqual(threshold, (uint64 / BigInt(ROLL_SPACE)) * BigInt(ROLL_SPACE));
    assert.ok(threshold % BigInt(ROLL_SPACE) === 0n);
    assert.ok(threshold < uint64);
    assert.ok(uint64 - threshold < BigInt(ROLL_SPACE));

    const accepted = Buffer.alloc(8);
    accepted.writeBigUInt64BE(threshold - 1n);
    const rejected = Buffer.alloc(8);
    rejected.writeBigUInt64BE(threshold);
    const tooHigh = Buffer.alloc(8);
    tooHigh.writeBigUInt64BE(uint64 - 1n);
    const zero = Buffer.alloc(8);

    const calls = [];
    const mixed = proof.uniformInt(function (i) {
        calls.push(i);
        if (i === 0) return rejected;
        if (i === 1) return tooHigh;
        return accepted;
    }, ROLL_SPACE);
    assert.deepStrictEqual(calls, [0, 1, 2]);
    assert.strictEqual(mixed, Number((threshold - 1n) % BigInt(ROLL_SPACE)));

    assert.strictEqual(proof.uniformInt(function () { return zero; }, ROLL_SPACE), 0);
    assert.strictEqual(proof.uniformInt(function () { return rejected; }, ROLL_SPACE, 3), null);

    const first = proof.uniformInt(function () { return accepted; }, ROLL_SPACE);
    assert.ok(first >= 0 && first < ROLL_SPACE);
    assert.ok(Number.isSafeInteger(first));
});

test('openCipherReward is deterministic and the prize matches the roll', () => {
    const a = proof.openCipherReward(SECRET, {
        cipherId: 'cipherA', openerUid: 'user1', keyId: 'keyA', nowMs: NOW,
    });
    const b = proof.openCipherReward(SECRET, {
        cipherId: 'cipherA', openerUid: 'user1', keyId: 'keyA', nowMs: NOW,
    });
    assert.ok(a && b);
    assert.strictEqual(a.roll, b.roll);
    assert.strictEqual(a.receiptMac, b.receiptMac);
    assert.strictEqual(a.periodId, '2026-11-20');
    assert.strictEqual(a.commitment, proof.periodCommitment(proof.periodSeed(SECRET, '2026-11-20')));
    const prize = prizeFromRoll(a.roll);
    assert.strictEqual(a.reward.rewardType, prize.rewardType);
    if (prize.rewardType === 'sats') {
        assert.strictEqual(a.reward.satsAmount, prize.satsAmount);
    } else {
        assert.ok(a.reward.xpAmount >= 50 && a.reward.xpAmount <= 250);
        assert.ok(a.reward.ticketCount >= 0 && a.reward.ticketCount <= 10);
    }
    assert.strictEqual(a.reward.rollSchema, ROLL_SCHEMA);
    assert.strictEqual(ROLL_SCHEMA, 3);
});

test('a different cipher, key, day, or secret produces a different roll or receipt', () => {
    const base = { cipherId: 'cipherA', openerUid: 'user1', keyId: 'keyA', nowMs: NOW };
    const a = proof.openCipherReward(SECRET, base);
    const otherCipher = proof.openCipherReward(SECRET, Object.assign({}, base, { cipherId: 'cipherB' }));
    const otherKey = proof.openCipherReward(SECRET, Object.assign({}, base, { keyId: 'keyB' }));
    const otherDay = proof.openCipherReward(SECRET, Object.assign({}, base, { nowMs: NEXT_DAY }));
    const otherSecret = proof.openCipherReward(OTHER, base);
    assert.notStrictEqual(otherCipher.roll === a.roll && otherCipher.receiptMac === a.receiptMac, true);
    assert.notStrictEqual(a.roll, otherKey.roll);
    assert.notStrictEqual(a.periodId, otherDay.periodId);
    assert.notStrictEqual(a.receiptMac, otherSecret.receiptMac);
});

test('an edited receipt fails the HMAC and a claimed jackpot that was not rolled fails the audit', () => {
    const opened = proof.openCipherReward(SECRET, {
        cipherId: 'cipherA', openerUid: 'user1', keyId: 'keyA', nowMs: NOW,
    });
    const rec = Object.assign({}, opened.body, { receiptMac: opened.receiptMac, openedBy: 'user1' });
    const good = proof.auditOpen(SECRET, rec, NOW);
    assert.strictEqual(good.ok, true);
    assert.strictEqual(good.seed, null, 'seed stays hidden during the period');

    const edited = Object.assign({}, rec, { satsAmount: 10000000, rewardType: 'sats' });
    const bad = proof.auditOpen(SECRET, edited, NOW);
    assert.strictEqual(bad.ok, false);
    const mac = bad.checks.find(function (c) { return c.name === 'receipt-mac'; });
    assert.strictEqual(mac.ok, false);

    const later = proof.auditOpen(SECRET, rec, NEXT_DAY);
    assert.strictEqual(later.ok, true);
    assert.ok(later.seed);
    assert.strictEqual(later.seed, proof.periodSeed(SECRET, '2026-11-20'));
    const recomputed = proof.recomputeRoll(SECRET, rec);
    assert.strictEqual(recomputed, rec.roll);
});

test('public listings commit future days and only reveal seeds after the day ends', () => {
    const rows = proof.listPeriodPublic(SECRET, NOW, { back: 1, forward: 2 });
    const ids = rows.map(function (r) { return r.periodId; });
    assert.ok(ids.indexOf('2026-11-19') !== -1);
    assert.ok(ids.indexOf('2026-11-20') !== -1);
    assert.ok(ids.indexOf('2026-11-21') !== -1);
    assert.ok(ids.indexOf('2026-11-22') !== -1);
    rows.forEach(function (row) {
        assert.ok(row.commitment);
        if (row.periodId === '2026-11-19') {
            assert.strictEqual(row.revealed, true);
            assert.ok(row.seed);
            assert.strictEqual(proof.periodCommitment(row.seed), row.commitment);
        } else {
            assert.strictEqual(row.revealed, false);
            assert.strictEqual(row.seed, null);
        }
    });
    const shown = proof.publicProof(SECRET, proof.openCipherReward(SECRET, {
        cipherId: 'cipherA', openerUid: 'user1', keyId: 'keyA', nowMs: NOW,
    }).body, NOW);
    assert.strictEqual(shown.seed, null);
    assert.strictEqual(shown.revealed, false);
    const after = proof.publicProof(SECRET, proof.openCipherReward(SECRET, {
        cipherId: 'cipherA', openerUid: 'user1', keyId: 'keyA', nowMs: NOW,
    }).body, NEXT_DAY);
    assert.ok(after.seed);
    assert.strictEqual(after.revealed, true);
});

test('legacy records without a receipt still check the prize and do not need a secret', () => {
    const legacy = proof.auditOpen('', {
        roll: 0,
        rollSpace: 10000000,
        rewardType: 'sats',
        satsAmount: 100000,
    }, NOW);
    assert.strictEqual(legacy.ok, true);
    const fakeLegacy = proof.auditOpen('', {
        roll: 0,
        rollSpace: 10000000,
        rewardType: 'sats',
        satsAmount: 10000000,
    }, NOW);
    assert.strictEqual(fakeLegacy.ok, false);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
