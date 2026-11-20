// Cipher reward odds — disjoint crypto roll, exact stated probabilities.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    rollCipherReward,
    ROLL_SPACE,
    SATS_TIERS,
    LEGACY_ROLL_SPACE,
    LEGACY_SATS_TIERS,
    prizeFromRoll,
    verifyCipherPrize,
    otherwiseShare,
    satsDisposition,
} = require('../functions/src/cipherReward');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

test('rarest roll is 10,000,000 sats', () => {
    const r = rollCipherReward(0);
    assert.strictEqual(r.rewardType, 'sats');
    assert.strictEqual(r.satsAmount, 10000000);
    assert.strictEqual(r.roll, 0);
});

test('1,000,000 sats sits in the next 1,000 slots', () => {
    const first = rollCipherReward(1);
    const last = rollCipherReward(1000);
    const after = rollCipherReward(1001);
    assert.strictEqual(first.satsAmount, 1000000);
    assert.strictEqual(last.satsAmount, 1000000);
    assert.strictEqual(after.satsAmount, 100000);
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

test('live roll stays inside the 1 trillion space and is shaped correctly', () => {
    const allowed = SATS_TIERS.map(function(tier) { return tier.amount; });
    assert.strictEqual(ROLL_SPACE, 1000000000000);
    for (let i = 0; i < 30; i++) {
        const r = rollCipherReward();
        assert.ok(r.roll >= 0 && r.roll < ROLL_SPACE);
        assert.ok(Number.isSafeInteger(r.roll));
        if (r.rewardType === 'sats') {
            assert.ok(allowed.indexOf(r.satsAmount) !== -1);
        } else {
            assert.strictEqual(r.rewardType, 'xp_tickets');
            assert.ok(r.xpAmount >= 50 && r.xpAmount <= 250);
            assert.ok(r.ticketCount >= 0 && r.ticketCount <= 10);
        }
    }
});

test('slot counts match the stated odds and do not overlap', () => {
    const expected = {
        10000000: 1,
        1000000: 1000,
        100000: 100000,
        50000: 1000000,
        10000: 2000000,
        5000: 10000000,
        1000: 20000000,
        500: 100000000,
        250: 200000000,
        100: 1000000000,
        50: 10000000000,
        25: 20000000000,
        10: 100000000000,
        5: 200000000000,
    };
    let cursor = 0;
    let total = 0;
    SATS_TIERS.forEach(function(tier) {
        const slots = ROLL_SPACE / tier.odds;
        assert.strictEqual(slots, expected[tier.amount], 'slot count for ' + tier.amount);
        assert.strictEqual(slots * tier.odds, ROLL_SPACE);
        const first = prizeFromRoll(cursor);
        const last = prizeFromRoll(cursor + slots - 1);
        assert.strictEqual(first.rewardType, 'sats');
        assert.strictEqual(first.satsAmount, tier.amount);
        assert.strictEqual(last.satsAmount, tier.amount);
        if (cursor > 0) {
            const before = prizeFromRoll(cursor - 1);
            assert.notStrictEqual(before.satsAmount, tier.amount);
        }
        // Walk every slot only for the tiny jackpot tiers.
        if (slots <= 1000) {
            for (let roll = cursor; roll < cursor + slots; roll++) {
                assert.strictEqual(prizeFromRoll(roll).satsAmount, tier.amount);
            }
        }
        cursor += slots;
        total += slots;
    });
    assert.strictEqual(total, 331333101001);
    assert.strictEqual(cursor, total);
    assert.ok(cursor < ROLL_SPACE);
    assert.strictEqual(prizeFromRoll(cursor).rewardType, 'xp_tickets');
    assert.strictEqual(prizeFromRoll(ROLL_SPACE - 1).rewardType, 'xp_tickets');
    assert.strictEqual(prizeFromRoll(ROLL_SPACE), null);
    assert.strictEqual(prizeFromRoll(-1), null);
});

test('otherwise share still displays as about 66.9%', () => {
    const share = otherwiseShare(ROLL_SPACE, SATS_TIERS);
    assert.ok(Math.abs(share - 0.668666898999) < 1e-15);
    assert.strictEqual((share * 100).toFixed(1), '66.9');
});

test('1,000 sats and above stay manual, including the jackpots', () => {
    [5, 10, 25, 50, 100, 250, 500].forEach(function(amount) {
        assert.strictEqual(satsDisposition(amount), 'balance');
    });
    [1000, 5000, 10000, 50000, 100000, 1000000, 10000000].forEach(function(amount) {
        assert.strictEqual(satsDisposition(amount), 'manual');
    });
    assert.strictEqual(satsDisposition(999999), 'invalid');
});

test('verifyCipherPrize accepts a matching roll and rejects a claimed jackpot that was not rolled', () => {
    assert.strictEqual(verifyCipherPrize({ roll: 0, rollSpace: ROLL_SPACE, rewardType: 'sats', satsAmount: 10000000 }).ok, true);
    assert.strictEqual(verifyCipherPrize({ roll: 1, rollSpace: ROLL_SPACE, rewardType: 'sats', amount: 1000000 }).ok, true);
    assert.strictEqual(verifyCipherPrize({ roll: 1001, rollSpace: ROLL_SPACE, rewardType: 'sats', amount: 100000 }).ok, true);
    const fake = verifyCipherPrize({ roll: 331333101001, rollSpace: ROLL_SPACE, rewardType: 'sats', satsAmount: 10000000 });
    assert.strictEqual(fake.ok, false);
    assert.strictEqual(fake.reason, 'amount-mismatch');
    assert.strictEqual(fake.expected.rewardType, 'xp_tickets');
    const wrong = verifyCipherPrize({ roll: 0, rollSpace: ROLL_SPACE, rewardType: 'sats', satsAmount: 100000 });
    assert.strictEqual(wrong.ok, false);
    assert.strictEqual(wrong.expected.satsAmount, 10000000);
});

test('legacy 10-million space still verifies older 100,000 sat wins at roll 0', () => {
    const old = verifyCipherPrize({ roll: 0, amount: 100000 });
    assert.strictEqual(old.ok, true);
    assert.strictEqual(old.expected.satsAmount, 100000);
    const withSpace = verifyCipherPrize({
        roll: 0,
        rollSpace: LEGACY_ROLL_SPACE,
        rewardType: 'sats',
        amount: 100000,
    });
    assert.strictEqual(withSpace.ok, true);
    // The same roll in the new space is the 10M jackpot, not a 100k win.
    const mixed = verifyCipherPrize({
        roll: 0,
        rollSpace: ROLL_SPACE,
        rewardType: 'sats',
        amount: 100000,
    });
    assert.strictEqual(mixed.ok, false);
    assert.strictEqual(mixed.expected.satsAmount, 10000000);
    const legacyLast = prizeFromRoll(3313330, { rollSpace: LEGACY_ROLL_SPACE, tiers: LEGACY_SATS_TIERS });
    assert.strictEqual(legacyLast.satsAmount, 5);
    const legacyXp = prizeFromRoll(3313331, { rollSpace: LEGACY_ROLL_SPACE, tiers: LEGACY_SATS_TIERS });
    assert.strictEqual(legacyXp.rewardType, 'xp_tickets');
});

test('published Terms odds match the cipher roll and Satoshi\'s Favor difficulty', () => {
    const root = path.join(__dirname, '..');
    const terms = fs.readFileSync(path.join(root, 'terms.html'), 'utf8');
    const oddsAt = terms.indexOf('id="odds"');
    const next = terms.indexOf('<h2>17.', oddsAt);
    assert.ok(oddsAt !== -1 && next > oddsAt, 'odds section missing');
    const section = terms.slice(oddsAt, next);
    const rows = [];
    const rowRe = /<tr>\s*<td>([\d,]+) sats<\/td>\s*<td>1 in ([\d,]+)<\/td>\s*<\/tr>/g;
    let row;
    while ((row = rowRe.exec(section))) rows.push(row);
    assert.strictEqual(rows.length, SATS_TIERS.length);
    SATS_TIERS.forEach(function (tier, i) {
        assert.strictEqual(rows[i][1], tier.amount.toLocaleString('en-US'), 'prize row ' + i);
        assert.strictEqual(rows[i][2], tier.odds.toLocaleString('en-US'), 'odds row ' + i);
    });

    const favor = fs.readFileSync(path.join(root, 'satoshi-favor.js'), 'utf8');
    const target = Number(favor.match(/const DIFFICULTY_TARGET = (\d+);/)[1]);
    const hashMax = Number(favor.match(/const HASH_MAX = (\d+);/)[1]);
    assert.ok(target > 0 && hashMax > target);
    assert.strictEqual(hashMax % target, 0);
    const perHash = hashMax / target;
    const pct = (target / hashMax) * 100;
    assert.ok(section.includes('0 to ' + hashMax.toLocaleString('en-US')));
    assert.ok(section.includes('difficulty of ' + target.toLocaleString('en-US')));
    assert.ok(section.includes('1 in ' + perHash.toLocaleString('en-US')));
    assert.ok(section.includes(pct + '%'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
