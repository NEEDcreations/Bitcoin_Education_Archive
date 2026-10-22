// Cipher reward odds — disjoint crypto roll, exact stated probabilities.
const assert = require('assert');
const { rollCipherReward, ROLL_SPACE, SATS_TIERS } = require('../functions/src/cipherReward');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

test('rarest roll is 100,000 sats', () => {
    const r = rollCipherReward(0);
    assert.strictEqual(r.rewardType, 'sats');
    assert.strictEqual(r.satsAmount, 100000);
    assert.strictEqual(r.roll, 0);
});

test('tier boundaries match the stated odds', () => {
    let cursor = 0;
    SATS_TIERS.forEach(function(tier) {
        const slots = ROLL_SPACE / tier.odds;
        assert.strictEqual(slots, Math.floor(slots), 'slots must be whole');
        const first = rollCipherReward(cursor);
        const last = rollCipherReward(cursor + slots - 1);
        assert.strictEqual(first.satsAmount, tier.amount, 'first slot of ' + tier.amount);
        assert.strictEqual(last.satsAmount, tier.amount, 'last slot of ' + tier.amount);
        if (cursor + slots < ROLL_SPACE) {
            const next = rollCipherReward(cursor + slots);
            assert.notStrictEqual(next.satsAmount, tier.amount);
        }
        cursor += slots;
    });
    const consolation = rollCipherReward(cursor);
    assert.strictEqual(consolation.rewardType, 'xp_tickets');
    assert.ok(consolation.xpAmount >= 50 && consolation.xpAmount <= 250);
    assert.ok(consolation.ticketCount >= 0 && consolation.ticketCount <= 10);
});

test('live roll stays inside the space and is shaped correctly', () => {
    for (let i = 0; i < 30; i++) {
        const r = rollCipherReward();
        assert.ok(r.roll >= 0 && r.roll < ROLL_SPACE);
        if (r.rewardType === 'sats') {
            assert.ok([100, 500, 1000, 5000, 10000, 50000, 100000].indexOf(r.satsAmount) !== -1);
        } else {
            assert.strictEqual(r.rewardType, 'xp_tickets');
            assert.ok(r.xpAmount >= 50 && r.xpAmount <= 250);
            assert.ok(r.ticketCount >= 0 && r.ticketCount <= 10);
        }
    }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
