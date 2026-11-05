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
        config: { epochPotSats: 21000 },
    });
    assert.strictEqual(bd.recipients.length, 1);
    assert.strictEqual(bd.recipients[0].uid, 'u3');
    assert.ok(bd.lightningClusters.length >= 1);
    assert.ok(bd.excluded.filter(function (e) { return e.reason.indexOf('shared lightning') !== -1; }).length >= 2);
});

test('no 30% rule: large earner keeps full block share; no concentration flag', function () {
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
        config: { epochPotSats: 21000, perPersonCapSats: 0 },
    });
    // big has 2/5 = 8400 — full earned share, not held or reduced
    const big = bd.recipients.find(function (r) { return r.uid === 'big'; });
    assert.ok(big);
    assert.strictEqual(big.sats, 8400);
    assert.strictEqual(big.contribution, 2);
    assert.ok(!bd.flags);
    assert.ok(!Object.prototype.hasOwnProperty.call(P.readConfig({}), 'clusterFlagPct'));
});

test('M4/L5: claim reserve uses config caps and release clears reserved on no-send', function () {
    const limits = P.claimLimits({ manualAboveSats: 9000, siteDailyCapSats: 500000, walletFloorSats: 9000 });
    assert.strictEqual(limits.manualAboveSats, 5000); // still clamped (manual above)
    assert.strictEqual(limits.siteDailyCapSats, 100000); // site cap still capped at default max
    assert.strictEqual(limits.walletFloorSats, 9000); // floor may be raised above default

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

test('walletFloorSats: missing/invalid → 5000; positive config used as-is including above 5000', function () {
    assert.strictEqual(P.readConfig({}).walletFloorSats, 5000);
    assert.strictEqual(P.readConfig({ walletFloorSats: 0 }).walletFloorSats, 5000);
    assert.strictEqual(P.readConfig({ walletFloorSats: -1 }).walletFloorSats, 5000);
    assert.strictEqual(P.readConfig({ walletFloorSats: 'x' }).walletFloorSats, 5000);
    assert.strictEqual(P.readConfig({ walletFloorSats: 3000 }).walletFloorSats, 3000);
    assert.strictEqual(P.readConfig({ walletFloorSats: 5000 }).walletFloorSats, 5000);
    assert.strictEqual(P.readConfig({ walletFloorSats: 12000 }).walletFloorSats, 12000);
    assert.strictEqual(P.claimLimits({ walletFloorSats: 12000 }).walletFloorSats, 12000);

    // Raised floor must reject a pay that would have passed the default 5k floor
    const raised = P.planFavorClaimReserve({
        amount: 4200,
        reservedSats: 0,
        inFlightSats: 0,
        walletSats: 10000, // 10000 - 4200 = 5800 >= 5000, but < 12000
        lockReserved: false,
        lockInFlight: false,
        config: { walletFloorSats: 12000 },
        day: '2026-11-05',
    });
    assert.strictEqual(raised.ok, false);
    assert.strictEqual(raised.error, 'WALLET_LOW');
});

test('config: 0 siteDailyCap / walletFloor fall back to defaults; perPersonCap 0 stays off', function () {
    const zero = P.readConfig({ siteDailyCapSats: 0, walletFloorSats: 0, perPersonCapSats: 0 });
    assert.strictEqual(zero.siteDailyCapSats, 100000);
    assert.strictEqual(zero.walletFloorSats, 5000);
    assert.strictEqual(zero.perPersonCapSats, 0);

    const missing = P.readConfig({ siteDailyCapSats: null, walletFloorSats: 'nope' });
    assert.strictEqual(missing.siteDailyCapSats, 100000);
    assert.strictEqual(missing.walletFloorSats, 5000);

    const neg = P.readConfig({ siteDailyCapSats: -1, walletFloorSats: -50 });
    assert.strictEqual(neg.siteDailyCapSats, 100000);
    assert.strictEqual(neg.walletFloorSats, 5000);

    const limits = P.claimLimits({ siteDailyCapSats: 0, walletFloorSats: 0 });
    assert.strictEqual(limits.siteDailyCapSats, 100000);
    assert.strictEqual(limits.walletFloorSats, 5000);

    // Cap still enforced (not unlimited) when config tried to zero it out
    const plan = P.planFavorClaimReserve({
        amount: 4200,
        reservedSats: 98000,
        inFlightSats: 0,
        walletSats: 50000,
        lockReserved: false,
        lockInFlight: false,
        config: { siteDailyCapSats: 0 },
        day: '2026-11-05',
    });
    assert.strictEqual(plan.ok, false);
    assert.strictEqual(plan.error, 'SITE_DAILY_CAP');
});

test('rebuild close LN: reuse saved map only; missing → empty (manual review)', function () {
    const saved = { a1: 'alice@w.com', b2: '' };
    assert.strictEqual(P.closeLightningFromSaved(saved, 'a1'), 'alice@w.com');
    assert.strictEqual(P.closeLightningFromSaved(saved, 'b2'), '');
    // uid never snapshotted → empty, not "look up current"
    assert.strictEqual(P.closeLightningFromSaved(saved, 'c3'), '');
    assert.strictEqual(P.closeLightningFromSaved(null, 'a1'), '');
    assert.strictEqual(P.closeLightningFromSaved({}, 'a1'), '');

    // Empty close LN excludes the player (manual review / no auto-approve)
    const now = Date.now();
    const created = now - 30 * 86400000;
    const bd = P.buildEpochBreakdown({
        epochNumber: 11,
        nowMs: now,
        blocks: [
            { uid: 'a1', username: 'A', value: 1, foundAtMs: now },
            { uid: 'c3', username: 'C', value: 2, foundAtMs: now },
        ],
        players: [
            { uid: 'a1', user: { username: 'A' }, ledger: {}, authKnown: true, ageDays: 30, createdMs: created, emailVerified: true, lightningAddressAtClose: 'alice@w.com' },
            { uid: 'c3', user: { username: 'C' }, ledger: {}, authKnown: true, ageDays: 30, createdMs: created, emailVerified: true, lightningAddressAtClose: '' },
        ],
        config: { epochPotSats: 21000 },
    });
    assert.strictEqual(bd.recipients.length, 1);
    assert.strictEqual(bd.recipients[0].uid, 'a1');
    assert.ok(bd.excluded.some(function (e) {
        return e.uid === 'c3' && String(e.reason || '').indexOf('lightning') !== -1;
    }));
});

test('no NWC: 6000-sat Favor win refused as manual before wallet error', function () {
    // Pure gate ordering: manual cutoff fires without any wallet / NWC.
    const gate = P.favorClaimPrechecks({
        win: {
            adminApproved: true,
            amount: 6000,
            status: 'claimable',
            lockedLightningAddress: 'player@w.com',
            source: 'sf_epoch',
        },
        savedLightning: 'player@w.com',
        config: {},
    });
    assert.strictEqual(gate.ok, false);
    assert.strictEqual(gate.error, 'manual');
    assert.ok(String(gate.message).toLowerCase().indexOf('manual') !== -1);

    // Address mismatch also precedes wallet
    const addr = P.favorClaimPrechecks({
        win: {
            adminApproved: true,
            amount: 4200,
            status: 'claimable',
            lockedLightningAddress: 'locked@w.com',
            source: 'sf_epoch',
        },
        savedLightning: 'other@w.com',
        config: {},
    });
    assert.strictEqual(addr.ok, false);
    assert.strictEqual(addr.error, 'ADDRESS_MISMATCH');

    // Double-claim / already paid
    const paid = P.favorClaimPrechecks({
        win: {
            adminApproved: true,
            amount: 4200,
            status: 'paid',
            lockedLightningAddress: 'player@w.com',
        },
        savedLightning: 'player@w.com',
        config: {},
    });
    assert.strictEqual(paid.ok, false);
    assert.strictEqual(paid.error, 'ALREADY_PAID');

    // Claimable under manual threshold still passes prechecks with no NWC involved
    const ok = P.favorClaimPrechecks({
        win: {
            adminApproved: true,
            amount: 4200,
            status: 'claimable',
            lockedLightningAddress: 'player@w.com',
        },
        savedLightning: 'player@w.com',
        config: {},
    });
    assert.strictEqual(ok.ok, true);
});

test('confirm + win id', function () {
    assert.strictEqual(P.confirmText('epoch_4'), 'APPROVE epoch_4');
    assert.ok(P.winId('epoch_4', 'abc').indexOf('sfpay_epoch_4_abc') === 0);
});

console.log('Favor epoch prizes: all passed');
