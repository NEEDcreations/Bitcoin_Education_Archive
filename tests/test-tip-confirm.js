// Tip confirmation: once per UTC day, XP only on a tipping challenge.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tip = require('../functions/src/tipConfirm');

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

test('challenge ids match the client card, in order', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'mobile-ux.js'), 'utf8');
    const start = src.indexOf('var DAILY_CHALLENGES');
    const end = src.indexOf('function getDailyChallenge');
    const ids = [];
    const block = src.slice(start, end);
    const re = /id:\s*'([^']+)'/g;
    let match;
    while ((match = re.exec(block))) ids.push(match[1]);
    assert.deepStrictEqual(tip.CHALLENGE_IDS, ids);
    assert.strictEqual(ids.length, 19);
});

test('a tip day awards 100 once, and a second call the same day does not', () => {
    const today = '2026-10-22';
    let challengeId = tip.challengeIdForDate(today);
    // Walk a few days so the assertion does not depend on which challenge today is.
    const tipDay = (function() {
        for (let i = 0; i < 19; i++) {
            const key = new Date(Date.parse(today + 'T00:00:00Z') + i * 86400000).toISOString().split('T')[0];
            if (tip.isTippingChallenge(tip.challengeIdForDate(key))) return key;
        }
        return today;
    })();
    challengeId = tip.challengeIdForDate(tipDay);
    const first = tip.decideTipConfirm({ today: tipDay, challengeId: challengeId, confirmedDate: '' });
    assert.strictEqual(first.record, true);
    assert.strictEqual(first.awardXp, 100);
    assert.strictEqual(first.challengeCompleted, true);
    const second = tip.decideTipConfirm({ today: tipDay, challengeId: challengeId, confirmedDate: tipDay });
    assert.strictEqual(second.record, false);
    assert.strictEqual(second.awardXp, 0);
    assert.strictEqual(second.already, true);
});

test('a non-tip day is recorded with no XP', () => {
    const today = '2026-10-22';
    let quiet = today;
    for (let i = 0; i < 19; i++) {
        const key = new Date(Date.parse(today + 'T00:00:00Z') + i * 86400000).toISOString().split('T')[0];
        if (!tip.isTippingChallenge(tip.challengeIdForDate(key))) { quiet = key; break; }
    }
    const call = tip.decideTipConfirm({ today: quiet, challengeId: tip.challengeIdForDate(quiet), confirmedDate: '' });
    assert.strictEqual(call.record, true);
    assert.strictEqual(call.awardXp, 0);
    assert.strictEqual(call.challengeCompleted, false);
});

test('LUD-21 settled verifies, and private or http URLs are refused', () => {
    assert.strictEqual(tip.interpretLud21(200, { settled: true }).verified, true);
    assert.strictEqual(tip.interpretLud21(200, { settled: false }).reason, 'lud21-not-settled');
    assert.strictEqual(tip.safeVerifyUrl('http://example.com/verify'), '');
    assert.strictEqual(tip.safeVerifyUrl('https://127.0.0.1/verify'), '');
    assert.strictEqual(tip.safeVerifyUrl('https://user:pass@example.com/v'), '');
    assert.ok(tip.safeVerifyUrl('https://example.com/lnurl/verify').indexOf('https://example.com/') === 0);
    assert.strictEqual(tip.normalizePaymentHash('AA'.repeat(32)).length, 64);
    assert.strictEqual(tip.normalizePaymentHash('not-a-hash'), '');
    assert.strictEqual(tip.interpretNwcLookup({ state: 'settled' }).verified, true);
    assert.strictEqual(tip.interpretNwcLookup({}).reason, 'nwc-not-settled');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
