'use strict';

const assert = require('assert');
const P = require('../functions/src/favorEpochPrizes');

function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); }
    catch (e) { console.error('  ✗ ' + name); throw e; }
}

console.log('Favor epoch prizes');

test('epochIdOf shapes', function () {
    assert.strictEqual(P.epochIdOf(4), 'epoch_4');
    assert.strictEqual(P.epochIdOf(0), '');
    assert.strictEqual(P.windowIdOf('cycle_123'), 'window_cycle_123');
});

test('equal split of 21000 across 5 winners', function () {
    assert.deepStrictEqual(P.splitEqual(21000, 5), [4200, 4200, 4200, 4200, 4200]);
    assert.deepStrictEqual(P.splitEqual(21001, 5), [4201, 4200, 4200, 4200, 4200]);
});

test('buildEpochBreakdown pays eligible block solvers and lists exclusions', function () {
    const now = Date.now();
    const bd = P.buildEpochBreakdown({
        epochNumber: 4,
        nowMs: now,
        blocks: [
            { uid: 'aaa111', username: 'Alice', value: 1 },
            { uid: 'bbb222', username: 'Bob', value: 2 },
            { uid: 'ccc333', username: 'Carol', value: 3 },
            { uid: 'ddd444', username: 'Dan', value: 4 },
            { uid: 'eee555', username: 'Eve', value: 5 },
        ],
        players: [
            { uid: 'aaa111', user: { username: 'Alice' }, ledger: {}, authKnown: true, ageDays: 30, emailVerified: true, lightningAddressAtClose: 'a@w.com' },
            { uid: 'bbb222', user: { username: 'Bob' }, ledger: {}, authKnown: true, ageDays: 30, emailVerified: true, lightningAddressAtClose: 'b@w.com' },
            { uid: 'ccc333', user: { username: 'Carol' }, ledger: {}, authKnown: true, ageDays: 30, emailVerified: true, lightningAddressAtClose: 'c@w.com' },
            { uid: 'ddd444', user: { username: 'Dan' }, ledger: {}, authKnown: true, ageDays: 30, emailVerified: true, lightningAddressAtClose: 'd@w.com' },
            { uid: 'eee555', user: { username: 'Eve' }, ledger: {}, authKnown: true, ageDays: 30, emailVerified: true, lightningAddressAtClose: 'e@w.com' },
        ],
        config: { epochPotSats: 21000, minAccountAgeDays: 7 },
    });
    assert.strictEqual(bd.epochId, 'epoch_4');
    assert.strictEqual(bd.recipients.length, 5);
    assert.strictEqual(bd.excluded.length, 0);
    assert.strictEqual(bd.satsTotal, 21000);
    assert.ok(bd.balanced);
    bd.recipients.forEach(function (r) {
        assert.strictEqual(r.sats, 4200);
        assert.strictEqual(r.mode, 'claimable');
    });
});

test('multi-account exclusion', function () {
    const bd = P.buildEpochBreakdown({
        epochNumber: 6,
        nowMs: Date.now(),
        blocks: [{ uid: 'm1', username: 'M', value: 1 }],
        players: [{ uid: 'm1', user: { username: 'M', multiAccount: true }, ledger: {}, authKnown: true, ageDays: 30, emailVerified: true, lightningAddressAtClose: 'm@w.com' }],
        config: { epochPotSats: 21000 },
    });
    assert.strictEqual(bd.recipients.length, 0);
    assert.ok(bd.excluded[0].reason.indexOf('multi-account') !== -1);
});

test('buildEpochBreakdown lists age and email exclusions', function () {
    const bd = P.buildEpochBreakdown({
        epochNumber: 5,
        nowMs: Date.now(),
        blocks: [
            { uid: 'young1', username: 'Y', value: 1 },
            { uid: 'unv1', username: 'U', value: 2 },
        ],
        players: [
            { uid: 'young1', user: { username: 'Y' }, ledger: {}, authKnown: true, ageDays: 1, emailVerified: true, lightningAddressAtClose: 'y@w.com' },
            { uid: 'unv1', user: { username: 'U' }, ledger: {}, authKnown: true, ageDays: 30, emailVerified: false, lightningAddressAtClose: 'u@w.com' },
        ],
        config: { epochPotSats: 21000, minAccountAgeDays: 7 },
    });
    assert.strictEqual(bd.recipients.length, 0);
    assert.ok(bd.excluded.some(function (x) { return x.reason.indexOf('younger') !== -1; }));
    assert.ok(bd.excluded.some(function (x) { return x.reason.indexOf('verified email') !== -1; }));
});

test('no lightning address at close excludes', function () {
    const bd = P.buildEpochBreakdown({
        epochNumber: 1,
        nowMs: Date.now(),
        blocks: [{ uid: 'u1', username: 'U', value: 1 }],
        players: [{ uid: 'u1', user: { username: 'U' }, ledger: {}, authKnown: true, ageDays: 30, emailVerified: true, lightningAddressAtClose: '' }],
        config: { epochPotSats: 21000 },
    });
    assert.strictEqual(bd.recipients.length, 0);
    assert.strictEqual(bd.excluded[0].reason, 'no lightning address saved before close');
    assert.strictEqual(bd.unallocated, 21000);
});

test('manual mode above 5000', function () {
    assert.strictEqual(P.payoutStatusForAmount(4200, P.DEFAULTS), 'claimable');
    assert.strictEqual(P.payoutStatusForAmount(5001, P.DEFAULTS), 'manual');
    assert.strictEqual(P.payoutStatusForAmount(0, P.DEFAULTS), 'skipped');
});

test('wallet floor and site cap helpers', function () {
    assert.strictEqual(P.walletAllowsPay(10000, 4200, 5000), true);
    assert.strictEqual(P.walletAllowsPay(9000, 4200, 5000), false);
    assert.strictEqual(P.siteCapAllows(95000, 4200, 100000), true);
    assert.strictEqual(P.siteCapAllows(96000, 5000, 100000), false);
});

test('confirm text and win id', function () {
    assert.strictEqual(P.confirmText('epoch_4'), 'APPROVE epoch_4');
    assert.ok(P.winId('epoch_4', 'abc').indexOf('sfpay_epoch_4_abc') === 0);
});

test('window breakdown with zero pot stays empty', function () {
    const bd = P.buildWindowBreakdown({
        cycleId: 'cycle_1',
        winnerUid: 'u1',
        winnerUsername: 'U',
        player: { user: { username: 'U' }, ledger: {}, authKnown: true, ageDays: 30, emailVerified: true, lightningAddressAtClose: 'u@w.com' },
        config: { windowWinnerSats: 0 },
        nowMs: Date.now(),
    });
    assert.strictEqual(bd.pot, 0);
    assert.strictEqual(bd.recipients.length, 0);
});

test('window breakdown pays lowest-hash winner when pot set', function () {
    const bd = P.buildWindowBreakdown({
        cycleId: 'cycle_9',
        winnerUid: 'u1',
        winnerUsername: 'U',
        player: { user: { username: 'U' }, ledger: {}, authKnown: true, ageDays: 30, emailVerified: true, lightningAddressAtClose: 'u@w.com' },
        config: { windowWinnerSats: 2100 },
        nowMs: Date.now(),
    });
    assert.strictEqual(bd.recipients.length, 1);
    assert.strictEqual(bd.recipients[0].sats, 2100);
    assert.strictEqual(bd.recipients[0].mode, 'claimable');
    assert.ok(bd.recipients[0].why.indexOf('Lowest hash') !== -1);
});

console.log('Favor epoch prizes: all passed');
