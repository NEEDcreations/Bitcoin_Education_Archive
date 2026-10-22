// Double XP window: multiply while active, stop at expiry, extend from the end.
const assert = require('assert');
const doubleXp = require('../functions/src/doubleXp');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

test('an active window doubles and an expired one does not', () => {
    const now = 1_700_000_000_000;
    const active = { doubleXpUntil: now + 60_000 };
    const doubled = doubleXp.boostPoints(100, active, now);
    assert.strictEqual(doubled.points, 200);
    assert.strictEqual(doubled.doubled, true);

    const expired = doubleXp.boostPoints(100, { doubleXpUntil: now - 1 }, now);
    assert.strictEqual(expired.points, 100);
    assert.strictEqual(expired.doubled, false);

    const exact = doubleXp.boostPoints(100, { doubleXpUntil: now }, now);
    assert.strictEqual(exact.points, 100);
    assert.strictEqual(exact.doubled, false);

    const zero = doubleXp.boostPoints(0, active, now);
    assert.strictEqual(zero.points, 0);
    assert.strictEqual(zero.doubled, false);
});

test('buying while active extends, and an expired window starts now', () => {
    const now = 1_700_000_000_000;
    const hour = doubleXp.DOUBLE_XP_MS;
    const extended = doubleXp.extendUntil(now + 10 * 60_000, now, hour);
    assert.strictEqual(extended, now + 10 * 60_000 + hour);
    const fresh = doubleXp.extendUntil(now - 5_000, now, hour);
    assert.strictEqual(fresh, now + hour);
    assert.strictEqual(doubleXp.minutesLeft(extended, now), 70);
});

test('a Firestore timestamp-shaped expiry still counts', () => {
    const now = 1_700_000_000_000;
    const seconds = Math.floor((now + 120_000) / 1000);
    const boosted = doubleXp.boostPoints(50, { doubleXPExpiry: { seconds: seconds, nanoseconds: 0 } }, now);
    assert.strictEqual(boosted.doubled, true);
    assert.strictEqual(boosted.points, 100);
    assert.strictEqual(doubleXp.untilMillis({ doubleXpUntil: String(now + 1000) }), now + 1000);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
