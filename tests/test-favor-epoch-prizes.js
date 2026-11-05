'use strict';

const assert = require('assert');
const P = require('../functions/src/favorEpochPrizes');

function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); }
    catch (e) { console.error('  ✗ ' + name); throw e; }
}

console.log('Favor epoch prizes');

test('H1: pay by block count matches announcement math', function () {
    const now = Date.now();
    const created = now - 30 * 86400000;
    const bd = P.buildEpochBreakdown({
        epochNumber: 4,
        nowMs: now,
        blocks: [
            { uid: 'a1', username: 'Alice', value: 1, foundAtMs: now },
            { uid: 'a1', username: 'Alice', value: 2, foundAtMs: now },
            { uid: 'b2', username: 'Bob', value: 3, foundAtMs: now },
            { uid: 'c3', username: 'Carol', value: 4, foundAtMs: now },
            { uid: 'd4', username: 'Dan', value: 5, foundAtMs: now },
        ],
        players: ['a1', 'b2', 'c3', 'd4'].map(function (uid) {
            return {
                uid: uid, user: { username: uid }, ledger: {}, authKnown: true,
                ageDays: 30, createdMs: created, emailVerified: true,
                lightningAddressAtClose: uid + '@w.com',
            };
        }),
        config: { epochPotSats: 21000, minAccountAgeDays: 7 },
    });
    assert.strictEqual(bd.perBlockSats, 4200);
    assert.strictEqual(bd.notifyShare, 4200);
    const alice = bd.recipients.find(function (r) { return r.uid === 'a1'; });
    assert.ok(alice);
    assert.strictEqual(alice.contribution, 2);
    assert.strictEqual(alice.sats, 8400);
    assert.strictEqual(alice.mode, 'manual'); // > 5000
    assert.strictEqual(bd.recipients.filter(function (r) { return r.uid !== 'a1'; }).every(function (r) { return r.sats === 4200; }), true);
});

test('H1: per-person cap off by default, on when set', function () {
    const now = Date.now();
    const created = now - 30 * 86400000;
    const mk = function (cap) {
        return P.buildEpochBreakdown({
            epochNumber: 7,
            nowMs: now,
            blocks: [
                { uid: 'a1', username: 'A', value: 1, foundAtMs: now },
                { uid: 'a1', username: 'A', value: 2, foundAtMs: now },
                { uid: 'b2', username: 'B', value: 3, foundAtMs: now },
            ],
            players: [
                { uid: 'a1', user: { username: 'A' }, ledger: {}, authKnown: true, ageDays: 30, createdMs: created, emailVerified: true, lightningAddressAtClose: 'a@w.com' },
                { uid: 'b2', user: { username: 'B' }, ledger: {}, authKnown: true, ageDays: 30, createdMs: created, emailVerified: true, lightningAddressAtClose: 'b@w.com' },
            ],
            config: { epochPotSats: 21000, perPersonCapSats: cap },
        });
    };
    const off = mk(0);
    assert.strictEqual(off.recipients.find(function (r) { return r.uid === 'a1'; }).sats, 14000); // 2 of 3 blocks
    const on = mk(5000);
    assert.strictEqual(on.recipients.find(function (r) { return r.uid === 'a1'; }).sats, 5000);
    assert.strictEqual(on.recipients.find(function (r) { return r.uid === 'a1'; }).capped, true);
});

test('H2: shared lightning address sends whole group to manual review', function () {
    const now = Date.now();
    const created = now - 30 * 86400000;
    const bd = P.buildEpochBreakdown({
        epochNumber: 8,
        nowMs: now,
        blocks: [
            { uid: 'u1', username: 'One', value: 1, foundAtMs: now },
            { uid: 'u2', username: 'Two', value: 2, foundAtMs: now },
            { uid: 'u3', username: 'Three', value: 3, foundAtMs: now },
        ],
        players: [
            { uid: 'u1', user: { username: 'One' }, ledger: {}, authKnown: true, ageDays: 30, createdMs: created, emailVerified: true, lightningAddressAtClose: 'shared@w.com' },
            { uid: 'u2', user: { username: 'Two' }, ledger: {}, authKnown: true, ageDays: 30, createdMs: created, emailVerified: true, lightningAddressAtClose: 'shared@w.com' },
            { uid: 'u3', user: { username: 'Three' }, ledger: {}, authKnown: true, ageDays: 30, createdMs: created, emailVerified: true, lightningAddressAtClose: 'solo@w.com' },
        ],
        config: { epochPotSats: 21000, clusterFlagPct: 30 },
    });
    assert.strictEqual(bd.recipients.length, 1);
    assert.strictEqual(bd.recipients[0].uid, 'u3');
    assert.ok(bd.lightningClusters.length >= 1);
    assert.ok(bd.excluded.filter(function (e) { return e.reason.indexOf('shared lightning') !== -1; }).length >= 2);
});

test('H2: flag person or cluster over default 30%', function () {
    const now = Date.now();
    const created = now - 30 * 86400000;
    const bd = P.buildEpochBreakdown({
        epochNumber: 9,
        nowMs: now,
        blocks: [
            { uid: 'big', username: 'Big', value: 1, foundAtMs: now },
            { uid: 'big', username: 'Big', value: 2, foundAtMs: now },
            { uid: 's1', username: 'S1', value: 3, foundAtMs: now },
            { uid: 's2', username: 'S2', value: 4, foundAtMs: now },
            { uid: 's3', username: 'S3', value: 5, foundAtMs: now },
        ],
        players: ['big', 's1', 's2', 's3'].map(function (uid) {
            return { uid: uid, user: { username: uid }, ledger: {}, authKnown: true, ageDays: 30, createdMs: created, emailVerified: true, lightningAddressAtClose: uid + '@w.com' };
        }),
        config: { epochPotSats: 21000, clusterFlagPct: 30 },
    });
    // big has 2/5 = 8400/21000 = 40%
    assert.ok(bd.flags.some(function (f) { return f.kind === 'person' && f.sharePct >= 30; }));
});

test('M4/L5: claim reserve uses config caps and release clears reserved on no-send', function () {
    const limits = P.claimLimits({ manualAboveSats: 9000, siteDailyCapSats: 500000, walletFloorSats: 9000 });
    assert.strictEqual(limits.manualAboveSats, 5000); // clamped
    assert.strictEqual(limits.siteDailyCapSats, 100000);
    assert.strictEqual(limits.walletFloorSats, 5000);

    const plan = P.planFavorClaimReserve({
        amount: 4200,
        reservedSats: 0,
        inFlightSats: 0,
        walletSats: 10000,
        lockReserved: false,
        config: {},
        day: '2026-11-05',
    });
    assert.strictEqual(plan.ok, true);
    assert.strictEqual(plan.nextReservedSats, 4200);
    assert.strictEqual(plan.nextInFlightSats, 4200);

    const low = P.planFavorClaimReserve({
        amount: 4200,
        reservedSats: 0,
        inFlightSats: 2000,
        walletSats: 10000,
        lockReserved: false,
        config: {},
        day: '2026-11-05',
    });
    // 10000 - 2000 - 4200 = 3800 < 5000 floor
    assert.strictEqual(low.ok, false);
    assert.strictEqual(low.error, 'WALLET_LOW');

    const rel = P.planFavorClaimRelease({
        amount: 4200,
        reservedSats: 4200,
        inFlightSats: 4200,
        clearInFlight: true,
        clearReserved: true,
        day: '2026-11-05',
    });
    assert.strictEqual(rel.reservedSats, 0);
    assert.strictEqual(rel.inFlightSats, 0);
    assert.strictEqual(rel.day, '2026-11-05');
});

test('Red Team: walletFloorOk tracks inFlight', function () {
    assert.strictEqual(P.walletFloorOk(10000, 0, 4200, 5000), true);
    assert.strictEqual(P.walletFloorOk(10000, 2000, 4200, 5000), false);
});

test('L6/M3: blocks in first 7 days excluded from pot', function () {
    const now = Date.now();
    const youngCreated = now - 2 * 86400000;
    const oldCreated = now - 30 * 86400000;
    const bd = P.buildEpochBreakdown({
        epochNumber: 10,
        nowMs: now,
        blocks: [
            { uid: 'young', username: 'Y', value: 1, foundAtMs: now },
            { uid: 'old', username: 'O', value: 2, foundAtMs: now },
        ],
        players: [
            { uid: 'young', user: { username: 'Y' }, ledger: {}, authKnown: true, ageDays: 2, createdMs: youngCreated, emailVerified: true, lightningAddressAtClose: 'y@w.com' },
            { uid: 'old', user: { username: 'O' }, ledger: {}, authKnown: true, ageDays: 30, createdMs: oldCreated, emailVerified: true, lightningAddressAtClose: 'o@w.com' },
        ],
        config: { epochPotSats: 21000, minAccountAgeDays: 7 },
    });
    assert.strictEqual(bd.recipients.length, 1);
    assert.strictEqual(bd.recipients[0].uid, 'old');
    assert.strictEqual(bd.recipients[0].sats, 21000); // only 1 counted block
    assert.strictEqual(bd.perBlockSats, 21000);
});

test('Red Team: reserved lock retry re-adds inFlight, floor-checks, no double cap', function () {
    // Crash left reserved=true but inFlight was never recorded on the lock
    // (or was cleared). Retry must: not double-count site cap, re-add inFlight,
    // and still enforce the wallet floor.
    const nearCap = P.planFavorClaimReserve({
        amount: 4200,
        reservedSats: 4200, // already includes this claim
        inFlightSats: 0,    // not currently in-flight on site
        walletSats: 10000,
        lockReserved: true,
        lockInFlight: false,
        config: {},
        day: '2026-11-05',
    });
    assert.strictEqual(nearCap.ok, true);
    assert.strictEqual(nearCap.nextReservedSats, 4200); // no double add
    assert.strictEqual(nearCap.nextInFlightSats, 4200); // re-add
    assert.strictEqual(nearCap.setLockInFlight, true);

    // Cap would fail if we double-counted (4200+4200 > ... use a tight cap via raw)
    // With site at 98000 reserved and amount 4200 already in it, cap 100000:
    // double-count would be 98000+4200=102200 > 100000. Correct path: used=98000 <= 100000.
    const capOk = P.planFavorClaimReserve({
        amount: 4200,
        reservedSats: 98000,
        inFlightSats: 0,
        walletSats: 50000,
        lockReserved: true,
        lockInFlight: false,
        config: { siteDailyCapSats: 100000 },
        day: '2026-11-05',
    });
    assert.strictEqual(capOk.ok, true);
    assert.strictEqual(capOk.nextReservedSats, 98000);

    // Fresh claim at same numbers would exceed cap
    const freshCap = P.planFavorClaimReserve({
        amount: 4200,
        reservedSats: 98000,
        inFlightSats: 0,
        walletSats: 50000,
        lockReserved: false,
        lockInFlight: false,
        config: { siteDailyCapSats: 100000 },
        day: '2026-11-05',
    });
    assert.strictEqual(freshCap.ok, false);
    assert.strictEqual(freshCap.error, 'SITE_DAILY_CAP');

    // Floor still enforced on retry when re-adding inFlight
    const low = P.planFavorClaimReserve({
        amount: 4200,
        reservedSats: 4200,
        inFlightSats: 2000,
        walletSats: 10000,
        lockReserved: true,
        lockInFlight: false,
        config: {},
        day: '2026-11-05',
    });
    // 10000 - 2000 - 4200 = 3800 < 5000
    assert.strictEqual(low.ok, false);
    assert.strictEqual(low.error, 'WALLET_LOW');

    // Already in-flight: do not re-add; floor uses amount-inside-inflight
    const held = P.planFavorClaimReserve({
        amount: 4200,
        reservedSats: 4200,
        inFlightSats: 4200,
        walletSats: 10000,
        lockReserved: true,
        lockInFlight: true,
        config: {},
        day: '2026-11-05',
    });
    assert.strictEqual(held.ok, true);
    assert.strictEqual(held.nextReservedSats, 4200);
    assert.strictEqual(held.nextInFlightSats, 4200); // no double add
});

test('confirm + win id', function () {
    assert.strictEqual(P.confirmText('epoch_4'), 'APPROVE epoch_4');
    assert.ok(P.winId('epoch_4', 'abc').indexOf('sfpay_epoch_4_abc') === 0);
});

console.log('Favor epoch prizes: all passed');
