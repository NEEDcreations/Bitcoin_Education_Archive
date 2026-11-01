// Variable payouts: budget caps, daily rates, 24h claim gap, cipher review,
// Favor retarget. Pure logic, no Firebase.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const pb = require('../functions/src/payoutBudget');
const { DateTime } = require('../functions/node_modules/luxon');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ✓ ' + name); }
    catch (e) { failed++; console.log('  ✗ ' + name + ': ' + e.message); }
}
const etMs = (iso) => DateTime.fromISO(iso, { zone: 'America/New_York' }).toMillis();

console.log('Payout budget');
test('caps sum to the 25,000 monthly total', () => {
    const c = pb.readCaps(null);
    assert.strictEqual(c.total, 25000);
    assert.strictEqual(c.faucet + c.drip + c.misc + c.favor + c.buffer, 25000);
});
test('Nov 1 2026 (DST end) is a 25h ET day', () => {
    const i = pb.periodInfo(etMs('2026-11-01T12:00'));
    assert.strictEqual(i.day, '2026-11-01');
    assert.strictEqual(i.nextDayMs - i.dayStartMs, 25 * 3600000);
    assert.strictEqual(i.daysInMonth, 30);
});
test('11:30 PM ET Oct 31 is still October (UTC is Nov 1)', () => {
    const i = pb.periodInfo(etMs('2026-10-31T23:30'));
    assert.strictEqual(i.month, '2026-10');
});
test('source cap blocks and resumes on the 1st ET', () => {
    const caps = pb.readCaps(null);
    const now = etMs('2026-11-20T10:00');
    const r = pb.assessPayout({ total: caps.faucet, bySource: { faucet: caps.faucet } }, 'faucet', 100, caps, now);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'budget_source');
    assert.strictEqual(r.resumeAtMs, etMs('2026-12-01T00:00'));
});
test('under cap is ok', () => {
    const caps = pb.readCaps(null);
    assert.strictEqual(pb.assessPayout({ total: 0, bySource: {} }, 'faucet', 200, caps, Date.now()).ok, true);
});
test('auto sources cannot eat the buffer or the Favor share', () => {
    const caps = pb.readCaps(null);
    const doc = { total: caps.faucet + caps.drip + caps.misc - 50, bySource: { faucet: caps.faucet - 50, drip: caps.drip, misc: caps.misc } };
    assert.strictEqual(pb.assessPayout(doc, 'faucet', 100, caps, Date.now()).ok, false);
});

console.log('Claim gap');
test('early claim gives a countdown', () => {
    const now = Date.now();
    const r = pb.assessClaimGap(now - (24 * 3600000 - (4 * 3600000 + 12 * 60000)), now);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'claim_gap');
    assert.ok(/You can claim again in 4h 12m/.test(r.error), r.error);
});
test('24h later is ok, regardless of midnight', () => {
    const now = Date.now();
    assert.strictEqual(pb.assessClaimGap(now - 24 * 3600000, now).ok, true);
    assert.strictEqual(pb.assessClaimGap(0, now).ok, true);
});
test('formatWait', () => {
    assert.strictEqual(pb.formatWait(4 * 3600000 + 12 * 60000), '4h 12m');
});

console.log('Daily rates');
test('bounded and moves at most 10% a day', () => {
    let prev = { minSats: 100, pointsPerSat: 10 };
    for (let d = 2; d <= 30; d++) {
        const now = etMs('2026-11-' + String(d).padStart(2, '0') + 'T00:01');
        const r = pb.planDailyRates(prev, { nowMs: now, monthDoc: { total: 0, bySource: {} }, walletLow: false });
        assert.ok(r.minSats >= 50 && r.minSats <= 100);
        assert.ok(r.pointsPerSat >= 10 && r.pointsPerSat <= 20);
        assert.ok(Math.abs(r.minSats - prev.minSats) <= prev.minSats * 0.1 + 1e-9);
        assert.ok(Math.abs(r.pointsPerSat - prev.pointsPerSat) <= prev.pointsPerSat * 0.1 + 1e-9);
        prev = r;
    }
    assert.strictEqual(prev.minSats, 50, 'under-pace drifts to the floor');
    assert.strictEqual(prev.pointsPerSat, 10);
});
test('ahead of pace or wallet low raises min and XP rate', () => {
    const caps = pb.readCaps(null);
    const now = etMs('2026-11-10T00:01');
    const hot = { total: caps.faucet, bySource: { faucet: caps.faucet } };
    const r = pb.planDailyRates({ minSats: 70, pointsPerSat: 12 }, { nowMs: now, monthDoc: hot });
    assert.ok(r.minSats > 70 && r.minSats <= 77);
    assert.ok(r.pointsPerSat > 12 && r.pointsPerSat <= 13.2);
    const w = pb.planDailyRates({ minSats: 70, pointsPerSat: 12 }, { nowMs: now, monthDoc: {}, walletLow: true });
    assert.ok(w.minSats > 70);
});
test('same inputs give the same rates (lazy create is safe)', () => {
    const ctx = { nowMs: etMs('2026-11-05T00:01'), monthDoc: { total: 900, bySource: { faucet: 900 } } };
    assert.deepStrictEqual(pb.planDailyRates({ minSats: 90, pointsPerSat: 11 }, ctx), pb.planDailyRates({ minSats: 90, pointsPerSat: 11 }, ctx));
});
test('XP conversion never rounds in the user\'s favor', () => {
    assert.strictEqual(pb.satsForPoints(1099, 11), 99);
    assert.strictEqual(pb.pointsForSats(100, 10.5), 1050);
    assert.strictEqual(pb.pointsForSats(3, 10.5), 32);
});

console.log('Ciphers, wallet, Favor');
test('cipher prizes over 1,000 need review', () => {
    assert.strictEqual(pb.cipherNeedsReview(1000), false);
    assert.strictEqual(pb.cipherNeedsReview(5000), true);
});
test('cipher EV is about 3.35 sats per open', () => {
    const ev = pb.cipherExpectedValue(require('../functions/src/cipherReward').SATS_TIERS);
    assert.ok(Math.abs(ev - 3.35) < 0.005, String(ev));
});
test('wallet floor is 10,000 plus the reserved drip pot', () => {
    assert.strictEqual(pb.walletFloor(5000), 15000);
    assert.strictEqual(pb.walletFloor(0), 10000);
});
test('Favor epoch waits when the reserve cannot cover 21,000', () => {
    assert.strictEqual(pb.assessFavorEpoch({ favorReserve: 10500 }).ok, false);
    assert.strictEqual(pb.assessFavorEpoch({ favorReserve: 21000 }).ok, true);
});
test('retarget is clamped to 4x either way', () => {
    const caps = pb.readCaps(null);
    const fast = pb.planRetarget({ currentTarget: 20000, windowDays: 14, caps, otherPaidInWindow: 6000, blocksInWindow: 500 });
    assert.strictEqual(fast.target, 5000);
    const none = pb.planRetarget({ currentTarget: 20000, windowDays: 14, caps, otherPaidInWindow: 6000, blocksInWindow: 0 });
    assert.strictEqual(none.target, 80000);
});
test('on-pace retarget aims at about one epoch per two months', () => {
    const caps = pb.readCaps(null);
    // other sources spend their caps; Favor gets its share
    const other = (caps.faucet + caps.drip + caps.misc) * 14 / 30;
    const r = pb.planRetarget({ currentTarget: 20000, windowDays: 14, caps, otherPaidInWindow: other, blocksInWindow: 0 + 1 });
    assert.ok(Math.abs(r.targetEpochsPerMonth - 0.5) < 0.01, String(r.targetEpochsPerMonth));
});
test('history lookup keeps old blocks on their old target', () => {
    const h = [{ target: 1000, since: '2026-01-01T00:00:00Z' }, { target: 20000, since: '2026-06-01T00:00:00Z' }, { target: 5000, since: Date.parse('2026-11-15T00:00:00Z') }];
    assert.strictEqual(pb.targetAtTime(h, Date.parse('2026-03-01'), 7), 1000);
    assert.strictEqual(pb.targetAtTime(h, Date.parse('2026-11-01'), 7), 20000);
    assert.strictEqual(pb.targetAtTime(h, Date.parse('2026-12-01'), 7), 5000);
});

console.log('Wiring');
const root = path.join(__dirname, '..');
const idx = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
test('claimSats uses the budget ledger and the 24h gap', () => {
    assert.ok(idx.includes("readBudgetTx(t, db"));
    assert.ok(idx.includes('assessClaimGap'));
    assert.ok(idx.includes("assessPayout(budgetCtx.monthDoc, 'faucet'") || idx.includes("'faucet'"));
    assert.ok(idx.includes("timeZone: 'America/New_York'"));
});
test('rules deny client access to budget docs', () => {
    ['payout_config', 'payout_budget', 'payout_rates', 'payout_ledger', 'admin_alerts'].forEach((c) => {
        const m = rules.match(new RegExp('match /' + c + '/\\{[^}]+\\} \\{\\s*allow read, write: if false;'));
        assert.ok(m, c);
    });
    assert.ok(/match \/payout_rates_public\/\{docId\} \{\s*allow read: if true;\s*allow write: if false;/.test(rules));
});
test('UI reads today\'s rates and shows a countdown', () => {
    assert.ok(ranking.includes("collection('payout_rates_public').doc('today')"));
    assert.ok(ranking.includes("result.data.code === 'claim_gap'"));
    assert.ok(ranking.includes('You can claim again in'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
