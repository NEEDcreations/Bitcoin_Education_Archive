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

test('live roll stays inside 0..9,999,999 and is shaped correctly', () => {
    const allowed = SATS_TIERS.map(function(tier) { return tier.amount; });
    for (let i = 0; i < 30; i++) {
        const r = rollCipherReward();
        assert.ok(r.roll >= 0 && r.roll < ROLL_SPACE);
        assert.strictEqual(ROLL_SPACE, 10000000);
        if (r.rewardType === 'sats') {
            assert.ok(allowed.indexOf(r.satsAmount) !== -1);
        } else {
            assert.strictEqual(r.rewardType, 'xp_tickets');
            assert.ok(r.xpAmount >= 50 && r.xpAmount <= 250);
            assert.ok(r.ticketCount >= 0 && r.ticketCount <= 10);
        }
    }
});

test('exhaustive slot counts match the stated odds and do not overlap', () => {
    const expected = {
        100000: 1,
        50000: 10,
        10000: 20,
        5000: 100,
        1000: 200,
        500: 1000,
        250: 2000,
        100: 10000,
        50: 100000,
        25: 200000,
        10: 1000000,
        5: 2000000,
    };
    const counts = {};
    let cursor = 0;
    SATS_TIERS.forEach(function(tier) {
        const slots = ROLL_SPACE / tier.odds;
        assert.strictEqual(slots, expected[tier.amount], 'slot count for ' + tier.amount);
        assert.strictEqual(slots * tier.odds, ROLL_SPACE);
        counts[tier.amount] = 0;
        for (let roll = cursor; roll < cursor + slots; roll++) {
            const r = rollCipherReward(roll);
            assert.strictEqual(r.rewardType, 'sats');
            assert.strictEqual(r.satsAmount, tier.amount);
            counts[tier.amount]++;
        }
        const before = rollCipherReward(cursor - 1);
        if (cursor > 0) assert.notStrictEqual(before.satsAmount, tier.amount);
        cursor += slots;
    });
    let total = 0;
    SATS_TIERS.forEach(function(tier) {
        assert.strictEqual(counts[tier.amount], expected[tier.amount]);
        total += counts[tier.amount];
    });
    assert.strictEqual(total, 3313331);
    assert.strictEqual(cursor, total);
    assert.ok(cursor < ROLL_SPACE);
    assert.strictEqual(rollCipherReward(cursor).rewardType, 'xp_tickets');
    assert.strictEqual(rollCipherReward(ROLL_SPACE - 1).rewardType, 'xp_tickets');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
