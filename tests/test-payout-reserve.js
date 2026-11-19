'use strict';
const assert = require('assert');
const path = require('path');
const msat = require(path.join(__dirname, '../functions/src/payoutMsat.js'));

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e && e.stack || e)); failed++; }
}

test('satsToMsat always rounds up; zero and junk are 0', function () {
    assert.strictEqual(msat.satsToMsat(1), 1000);
    assert.strictEqual(msat.satsToMsat(1.1), 1100);
    assert.strictEqual(msat.satsToMsat(0.0004), 1);
    assert.strictEqual(msat.satsToMsat(0), 0);
    assert.strictEqual(msat.satsToMsat(-3), 0);
    assert.strictEqual(msat.satsToMsat('nope'), 0);
});

test('msatToSatsCeil rounds up partial sats', function () {
    assert.strictEqual(msat.msatToSatsCeil(1000), 1);
    assert.strictEqual(msat.msatToSatsCeil(1001), 2);
    assert.strictEqual(msat.msatToSatsCeil(1), 1);
    assert.strictEqual(msat.msatToSatsCeil(0), 0);
});

test('reserveSpendMsat is net + max fee, both ceiled', function () {
    assert.strictEqual(msat.reserveSpendMsat(4190, 41900), 4190 * 1000 + 41900);
    assert.strictEqual(msat.reserveSpendMsat(100, 0), 100000);
    assert.strictEqual(msat.reserveSpendMsat(0, 1000), 0);
});

test('spendCapMsat keeps the 12,600 and 21,000 prize caps usable for a full day of blocks', function () {
    function feeLimit(sats) { return Math.max(10 * 1000, Math.ceil(sats * 1000 * 10000 / 1e6)); }
    const reservedOne = msat.reserveSpendMsat(4190, feeLimit(4190));
    assert.ok(3 * reservedOne <= msat.spendCapMsat(12600, feeLimit), '3 blocks still fit the player-day cap');
    assert.ok(5 * reservedOne <= msat.spendCapMsat(21000, feeLimit), '5 blocks still fit the site-day cap');
});

test('add / release / true-up keep sats and msats in sync and never go negative', function () {
    const reserved = msat.reserveSpendMsat(4190, 41900);
    const added = msat.addReserved(null, 4200, reserved, 10);
    assert.strictEqual(added.sats, 4200);
    assert.strictEqual(added.msats, reserved);
    const mid = msat.addReserved(added, 4200, reserved, 11);
    assert.strictEqual(mid.sats, 8400);
    assert.strictEqual(mid.msats, reserved * 2);
    const released = msat.releaseReserved(mid, 4200, reserved);
    assert.strictEqual(released.sats, 4200);
    assert.strictEqual(released.msats, reserved);
    const paid = msat.trueUpSpend(released, reserved, 4190 * 1000, 0);
    assert.strictEqual(paid.sats, 4200);
    assert.strictEqual(paid.msats, 4190 * 1000);
    const budget = msat.trueUpSpend(released, reserved, 4190 * 1000, -4200 + 4190);
    assert.strictEqual(budget.sats, 4190);
    const floor = msat.releaseReserved({ sats: 10, msats: 100 }, 999, 999999);
    assert.strictEqual(floor.sats, 0);
    assert.strictEqual(floor.msats, 0);
});

test('legacy docs with only sats fall back to sats*1000', function () {
    assert.strictEqual(msat.counterMsats({ sats: 4200 }), 4200000);
    assert.strictEqual(msat.counterMsats({ sats: 4200, msats: 4190000 }), 4190000);
    assert.strictEqual(msat.reservedMsatFromClaim({ reservedMsat: 123 }, 4200, 0), 123);
    assert.strictEqual(msat.reservedMsatFromClaim({}, 4200, 0), 4200000);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
