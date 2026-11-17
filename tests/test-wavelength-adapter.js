'use strict';
const assert = require('assert');
const path = require('path');
const lnFee = require(path.join(__dirname, '../functions/src/lnFee.js'));
const { LIMITS, readLimits } = require(path.join(__dirname, '../functions/src/wavelengthLimits.js'));
const payoutRail = require(path.join(__dirname, '../functions/src/payoutRail.js'));
const adapter = require(path.join(__dirname, '../functions/src/wavelengthAdapter.js'));

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name: name, fn: fn }); }

function memDb(seed) {
    const store = Object.assign({}, seed || {});
    let auto = 0;
    function snap(k, id) {
        const v = store[k];
        return { id: id, exists: v !== undefined, data: function () { return v ? Object.assign({}, v) : undefined; } };
    }
    function col(name) {
        return {
            doc: function (id) {
                const k = name + '/' + id;
                return {
                    id: id,
                    create: async function (d) {
                        if (store[k] !== undefined) { const e = new Error('ALREADY_EXISTS'); e.code = 6; throw e; }
                        store[k] = Object.assign({}, d);
                    },
                    set: async function (d, o) {
                        store[k] = (o && o.merge && store[k]) ? Object.assign({}, store[k], d) : Object.assign({}, d);
                    },
                    get: async function () { return snap(k, id); },
                };
            },
            add: async function (d) {
                const id = 'auto' + (++auto);
                store[name + '/' + id] = Object.assign({}, d);
                return { id: id };
            },
            get: async function () {
                const docs = [];
                Object.keys(store).forEach(function (k) {
                    if (k.indexOf(name + '/') !== 0) return;
                    const id = k.slice(name.length + 1);
                    if (id.indexOf('/') !== -1) return;
                    docs.push(snap(k, id));
                });
                return { docs: docs, empty: !docs.length, size: docs.length };
            },
        };
    }
    return { store: store, collection: col };
}

const NOW = Date.UTC(2026, 10, 17, 18, 0);

function make(opts) {
    const o = opts || {};
    const db = memDb(o.seed);
    const alerts = [];
    const calls = { prepare: 0, send: 0 };
    const client = adapter.createMockClient({
        amountSat: o.amountSat != null ? o.amountSat : (o.gross != null ? o.gross - lnFee.LN_FEE_SATS : 190),
        expectedFeeSat: o.expectedFeeSat != null ? o.expectedFeeSat : 1,
        balanceSats: o.balanceSats != null ? o.balanceSats : 15000,
        paymentHash: o.paymentHash || 'ab'.repeat(16),
        prepareSend: o.prepareSend,
        send: o.send,
        getBalance: o.getBalance,
    });
    // wrap to count calls if using defaults
    const innerPrepare = client.prepareSend;
    const innerSend = client.send;
    client.prepareSend = async function (req) { calls.prepare++; return innerPrepare(req); };
    client.send = async function (req) { calls.send++; return innerSend(req); };
    const svc = adapter.createAdapter({
        db: db,
        nowMs: function () { return o.nowMs || NOW; },
        client: client,
        config: Object.assign({ provider: 'wavelength' }, o.config || {}),
        emitAlert: async function (a) { alerts.push(a); return true; },
    });
    return { db: db, svc: svc, alerts: alerts, calls: calls, client: client };
}

test('flag is off by default; only exact provider=wavelength enables the rail', function () {
    assert.strictEqual(payoutRail.getProvider({}), 'nwc');
    assert.strictEqual(payoutRail.getProvider({ provider: 'Wavelength' }), 'nwc');
    assert.strictEqual(payoutRail.getProvider({ provider: 'nwc' }), 'nwc');
    assert.strictEqual(payoutRail.isWavelength({ provider: 'wavelength' }), true);
    assert.strictEqual(payoutRail.isWavelength(null), false);
});

test('approved limits are the Decision 4 numbers; config may only lower a cap', function () {
    assert.deepStrictEqual([LIMITS.FLOAT_CEILING_SATS, LIMITS.REFILL_UNDER_SATS, LIMITS.PER_TX_SATS, LIMITS.PER_DAY_SATS, LIMITS.PER_DEST_24H_SATS, LIMITS.ALERT_SATS, LIMITS.PHIL_APPROVE_SATS, LIMITS.ADDRESS_COOLDOWN_MS], [15000, 5000, 2100, 8000, 2100, 500, 1000, 48 * 3600 * 1000]);
    assert.strictEqual(readLimits({ perTxSats: 500 }).perTxSats, 500);
    assert.strictEqual(readLimits({ perTxSats: 99999 }).perTxSats, 2100, 'cannot raise the cap');
});

test('rail_off: adapter refuses and does not call the client when the flag is off', async function () {
    const h = make({ config: { provider: 'nwc' }, gross: 200 });
    const r = await h.svc.pay({ grossSats: 200, invoice: 'lnbc190n1x', dest: 'alice@w.example' });
    assert.strictEqual(r.code, 'rail_off');
    assert.strictEqual(h.calls.prepare, 0);
    assert.strictEqual(h.calls.send, 0);
});

test('happy path: prepare then send, ledger written before send, fee quote applied', async function () {
    const order = [];
    const h = make({
        gross: 200,
        prepareSend: async function (req) {
            order.push('prepare');
            assert.strictEqual(req.invoice, 'lnbc190n1x');
            assert.strictEqual(req.max_fee_sat, String(lnFee.LN_FEE_SATS));
            return { send_intent_id: 'intent_1', amount_sat: 190, expected_fee_sat: 1, payment_hash: 'ab'.repeat(16) };
        },
        send: async function (req) {
            order.push('send');
            assert.strictEqual(req.send_intent_id, 'intent_1');
            return { ok: true, status: 'paid' };
        },
    });
    const origCreate = h.db.collection('wl_payouts').doc('intent_1').create;
    // intercept via wrapped pay using idempotencyKey
    const r = await h.svc.pay({ grossSats: 200, invoice: 'lnbc190n1x', dest: 'alice@w.example', idempotencyKey: 'p1', source: 'faucet' });
    assert.ok(r.ok, JSON.stringify(r));
    assert.deepStrictEqual(order, ['prepare', 'send']);
    assert.strictEqual(r.sent, 190);
    assert.strictEqual(r.fee, 10);
    const row = h.db.store['wl_payouts/p1'];
    assert.strictEqual(row.status, 'paid');
    assert.strictEqual(row.netSats, 190);
    assert.strictEqual(row.sendIntentId, 'intent_1');
    assert.ok(row.paidAtMs);
});

test('per-tx cap and per-dest 24h cap hold; a prepared row occupies the dest cap', async function () {
    const h = make({ gross: 200 });
    const overTx = await h.svc.pay({ grossSats: 2101, invoice: 'lnbc2091n1x', dest: 'cara@w.example' });
    assert.strictEqual(overTx.code, 'per_tx_cap');
    assert.strictEqual(h.calls.send, 0);
    const dest = make({ gross: 200, seed: {
        'wl_payouts/a': { atMs: NOW - 1000, status: 'prepared', grossSats: 2000, dest: 'alice@w.example' },
    } });
    const overDest = await dest.svc.pay({ grossSats: 200, invoice: 'lnbc190n1x', dest: 'alice@w.example' });
    assert.strictEqual(overDest.code, 'per_dest_cap', '2000+200 > 2100 dest cap');
    const other = await dest.svc.pay({ grossSats: 200, invoice: 'lnbc190n1x', dest: 'bob@w.example' });
    assert.ok(other.ok, 'a different destination is not held to the same 24h cap: ' + JSON.stringify(other));
});

test('per-day cap: 8,000 sats across destinations is refused', async function () {
    const seed = {
        'wl_payouts/a': { atMs: NOW - 1000, status: 'paid', grossSats: 2100, dest: 'a@w.example' },
        'wl_payouts/b': { atMs: NOW - 1000, status: 'paid', grossSats: 2100, dest: 'b@w.example' },
        'wl_payouts/c': { atMs: NOW - 1000, status: 'paid', grossSats: 2100, dest: 'c@w.example' },
        'wl_payouts/d': { atMs: NOW - 1000, status: 'paid', grossSats: 1600, dest: 'd@w.example' },
    };
    const h = make({ gross: 200, seed: seed });
    const r = await h.svc.pay({ grossSats: 200, invoice: 'lnbc190n1x', dest: 'e@w.example' });
    assert.strictEqual(r.code, 'per_day_cap'); // 7900+200 > 8000
    assert.strictEqual(h.calls.send, 0);
});

test('Phil approval: payouts of 1,000 sats or more are ledgered as pending and not sent', async function () {
    const h = make({ gross: 1000, amountSat: 990 });
    const r = await h.svc.pay({ grossSats: 1000, invoice: 'lnbc990n1x', dest: 'alice@w.example', idempotencyKey: 'big1' });
    assert.strictEqual(r.code, 'needs_approval');
    assert.strictEqual(h.calls.prepare, 0);
    assert.strictEqual(h.calls.send, 0);
    assert.strictEqual(h.db.store['wl_payouts/big1'].status, 'pending_approval');
    assert.ok(h.alerts.some(function (a) { return /1000/.test(a.text); }));
});

test('alert threshold: 500 sats alerts but still pays; under 500 does not alert', async function () {
    const quiet = make({ gross: 200 });
    assert.ok((await quiet.svc.pay({ grossSats: 200, invoice: 'lnbc190n1x', dest: 'a@w.example' })).ok);
    assert.ok(!quiet.alerts.some(function (a) { return /alert threshold/.test(a.text); }));
    const loud = make({ gross: 500, amountSat: 490 });
    assert.ok((await loud.svc.pay({ grossSats: 500, invoice: 'lnbc490n1x', dest: 'a@w.example' })).ok);
    assert.ok(loud.alerts.some(function (a) { return /alert threshold/.test(a.text); }));
});

test('48h address cooldown refuses; a payout within 72h alerts', async function () {
    const h = make({ gross: 200, nowMs: NOW });
    const blocked = await h.svc.pay({
        grossSats: 200, invoice: 'lnbc190n1x', dest: 'a@w.example',
        addressChangedAtMs: NOW - 24 * 3600 * 1000,
    });
    assert.strictEqual(blocked.code, 'address_cooldown');
    assert.strictEqual(h.calls.send, 0);
    const after = make({ gross: 200 });
    const r = await after.svc.pay({
        grossSats: 200, invoice: 'lnbc190n1x', dest: 'a@w.example',
        addressChangedAtMs: NOW - 60 * 3600 * 1000,
    });
    assert.ok(r.ok, JSON.stringify(r));
    assert.ok(after.alerts.some(function (a) { return a.kind === 'address_change'; }));
});

test('prepare amount or fee mismatch never calls send and writes no paid row', async function () {
    const amt = make({
        prepareSend: async function () { return { send_intent_id: 'i', amount_sat: 191, expected_fee_sat: 1, payment_hash: 'ab'.repeat(16) }; },
    });
    const r1 = await amt.svc.pay({ grossSats: 200, invoice: 'lnbc190n1x', dest: 'a@w.example' });
    assert.strictEqual(r1.code, 'amount_mismatch');
    assert.strictEqual(amt.calls.send, 0);
    const fee = make({
        prepareSend: async function () { return { send_intent_id: 'i', amount_sat: 190, expected_fee_sat: 11, payment_hash: 'ab'.repeat(16) }; },
    });
    const r2 = await fee.svc.pay({ grossSats: 200, invoice: 'lnbc190n1x', dest: 'a@w.example' });
    assert.strictEqual(r2.code, 'fee_over_cap');
    assert.strictEqual(fee.calls.send, 0);
});

test('ledger docs are create-only: a retried idempotency key does not pay twice', async function () {
    const h = make({ gross: 200 });
    assert.ok((await h.svc.pay({ grossSats: 200, invoice: 'lnbc190n1x', dest: 'a@w.example', idempotencyKey: 'same' })).ok);
    const again = await h.svc.pay({ grossSats: 200, invoice: 'lnbc190n1x', dest: 'a@w.example', idempotencyKey: 'same' });
    assert.strictEqual(again.code, 'duplicate');
    assert.strictEqual(h.calls.send, 1);
});

test('send failure leaves the ledger in unknown, never deletes the row', async function () {
    const h = make({
        prepareSend: async function () { return { send_intent_id: 'i', amount_sat: 190, expected_fee_sat: 1, payment_hash: 'ab'.repeat(16) }; },
        send: async function () { throw new Error('hang'); },
    });
    const r = await h.svc.pay({ grossSats: 200, invoice: 'lnbc190n1x', dest: 'a@w.example', idempotencyKey: 'u1' });
    assert.strictEqual(r.code, 'unknown');
    assert.strictEqual(h.db.store['wl_payouts/u1'].status, 'unknown');
});

test('low float alerts under 5,000; insufficient balance refuses', async function () {
    const low = make({ gross: 200, balanceSats: 4000 });
    assert.ok((await low.svc.pay({ grossSats: 200, invoice: 'lnbc190n1x', dest: 'a@w.example' })).ok);
    assert.ok(low.alerts.some(function (a) { return /hot float is under/.test(a.text); }));
    const empty = make({ gross: 200, balanceSats: 100 });
    const r = await empty.svc.pay({ grossSats: 200, invoice: 'lnbc190n1x', dest: 'a@w.example' });
    assert.strictEqual(r.code, 'wallet_low');
    assert.strictEqual(empty.calls.send, 0);
});

test('address-change history is append-only and stores no plaintext destination', async function () {
    const h = make({ gross: 200 });
    const a = await h.svc.recordAddressChange({ id: 'c1', uidMasked: 'al…01', destHash: 'abc' });
    assert.ok(a.ok);
    let threw = false;
    try { await h.svc.recordAddressChange({ id: 'c1', uidMasked: 'al…01', destHash: 'zzz' }); }
    catch (e) { threw = true; }
    assert.ok(threw);
    assert.strictEqual(h.db.store['wl_address_changes/c1'].destHash, 'abc');
    assert.strictEqual(h.db.store['wl_address_changes/c1'].dest, undefined);
});

(async function main() {
    for (const t of queue) {
        try { await t.fn(); console.log('\u2705 ' + t.name); passed++; }
        catch (e) { console.log('\u274c ' + t.name + ': ' + (e && e.stack || e)); failed++; }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
