'use strict';
const assert = require('assert');
const path = require('path');
const recon = require(path.join(__dirname, '../functions/src/payoutReconcile.js'));
const alerts = require(path.join(__dirname, '../functions/src/payoutAlerts.js'));

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

const NOW = Date.UTC(2026, 10, 17, 18, 0); // Nov 17 2026 18:00 UTC

test('normalizeHash accepts hex and rejects junk', function () {
    assert.strictEqual(recon.normalizeHash('ABCdef01'), 'abcdef01');
    assert.strictEqual(recon.normalizeHash('zz'), '');
    assert.strictEqual(recon.normalizeHash(''), '');
});

test('stuck paying over 15 minutes is flagged and alerted; fresh paying is not', async function () {
    const db = memDb({
        'sf_block_claims/e1_b3': { status: 'paying', payingAtMs: NOW - 16 * 60 * 1000, amount: 4200, paymentHash: 'aa'.repeat(16) },
        'sf_block_claims/e1_b4': { status: 'paying', payingAtMs: NOW - 60 * 1000, amount: 4200, paymentHash: 'bb'.repeat(16) },
        'sf_block_claims/e1_b0': { status: 'paid', paidAtMs: NOW - 3600000, amount: 4190, walletSpentSats: 4190, paymentHash: 'cc'.repeat(16) },
        'sf_block_payouts/e1_b0': { paidAtMs: NOW - 3600000, walletSpentSats: 4190, paymentHash: 'cc'.repeat(16) },
    });
    const emitted = [];
    const r = await recon.reconcile({
        db: db,
        admin: { firestore: { FieldValue: { serverTimestamp: function () { return NOW; } } } },
        emitAlert: async function (o) { emitted.push(o); return true; },
    }, { nowMs: NOW });
    assert.strictEqual(r.stuckPaying.length, 1);
    assert.strictEqual(r.stuckPaying[0].id, 'e1_b3');
    assert.strictEqual(r.flagsCreated, 1);
    assert.ok(db.store['payout_reconcile_flags/stuck_favor_e1_b3']);
    assert.ok(emitted.some(function (a) { return a.kind === 'stuck_paying'; }));
    assert.ok(r.runId);
    assert.ok(db.store['payout_reconcile_runs/' + r.runId]);
});

test('wallet listing is off by default and matches payment hashes when enabled', async function () {
    const hash = 'dd'.repeat(16);
    const db = memDb({
        'sf_block_payouts/e1_b3': { paidAtMs: NOW, walletSpentSats: 4190, paymentHash: hash },
    });
    const listed = [];
    const off = await recon.reconcile({
        db: db,
        listWalletPayments: async function (q) { listed.push(q); return [{ paymentHash: 'ee'.repeat(16), type: 'outgoing', amountSats: 50 }]; },
        emitAlert: async function () { return true; },
    }, { nowMs: NOW });
    assert.strictEqual(off.walletListed, false);
    assert.strictEqual(listed.length, 0);
    assert.strictEqual(off.unmatchedWallet.length, 0);

    const emitted = [];
    const on = await recon.reconcile({
        db: db,
        readConfig: async function () { return { listWallet: true }; },
        listWalletPayments: async function () {
            return [
                { paymentHash: hash, type: 'outgoing', amountSats: 4190 },
                { paymentHash: 'ee'.repeat(16), type: 'outgoing', amountSats: 50 },
                { paymentHash: 'ff'.repeat(16), type: 'incoming', amountSats: 99 },
            ];
        },
        emitAlert: async function (o) { emitted.push(o); return true; },
    }, { nowMs: NOW, forceWalletList: false });
    assert.strictEqual(on.walletListed, true);
    assert.strictEqual(on.unmatchedWallet.length, 1);
    assert.strictEqual(on.unmatchedWallet[0].paymentHashSuffix, 'eeeeeeee');
    assert.ok(emitted.some(function (a) { return a.kind === 'unmatched_payment'; }));
    assert.ok(db.store[Object.keys(db.store).find(function (k) { return k.indexOf('payout_reconcile_flags/unmatched_') === 0; })]);
});

test('monthly budget alert fires at 80k and uses Favor payout spend, not the claim twice', async function () {
    const db = memDb({
        'sf_block_claims/e1_b3': { status: 'paid', paidAtMs: NOW, amount: 50000, walletSpentSats: 50000, paymentHash: '11'.repeat(16) },
        'sf_block_payouts/e1_b3': { paidAtMs: NOW, walletSpentSats: 81000, paymentHash: '11'.repeat(16) },
        'faucet_invoices/f1': { tsMs: NOW, status: 'used', amount: 200, paymentHash: '22'.repeat(16) },
    });
    const emitted = [];
    const r = await recon.reconcile({
        db: db,
        emitAlert: async function (o) { emitted.push(o); return true; },
    }, { nowMs: NOW });
    assert.strictEqual(r.monthlySpentSats, 81200);
    assert.strictEqual(r.budgetBand, 'warn');
    assert.ok(emitted.some(function (a) { return a.kind === 'budget_nearing' && /81200/.test(a.text); }));
});

test('flags and runs are create-only (a second pass does not delete or overwrite)', async function () {
    const db = memDb({
        'cipher_sats_payouts/c1': { status: 'paying', payingAtMs: NOW - 20 * 60 * 1000, amount: 200 },
    });
    const r1 = await recon.reconcile({ db: db, emitAlert: async function () { return true; } }, { nowMs: NOW });
    const flagId = 'payout_reconcile_flags/stuck_cipher_sats_c1';
    const first = Object.assign({}, db.store[flagId]);
    const r2 = await recon.reconcile({ db: db, emitAlert: async function () { return false; } }, { nowMs: NOW + 1000 });
    assert.strictEqual(r1.flagsCreated, 1);
    assert.strictEqual(r2.flagsCreated, 0);
    assert.deepStrictEqual(db.store[flagId], first);
    const runs = Object.keys(db.store).filter(function (k) { return k.indexOf('payout_reconcile_runs/') === 0; });
    assert.strictEqual(runs.length, 2);
});

test('faucet monthly spend counts only used rows with a real timestamp, including ts', async function () {
    const ts = { toMillis: function () { return NOW; } };
    const db = memDb({
        'faucet_invoices/used_ts': { ts: ts, status: 'used', amount: 300, paymentHash: '33'.repeat(16) },
        'faucet_invoices/used_tsMs': { tsMs: NOW, status: 'used', amount: 200, paymentHash: '44'.repeat(16) },
        'faucet_invoices/pending': { tsMs: NOW, status: 'pending', amount: 9000, net_sent: 9000, paymentHash: '55'.repeat(16) },
        'faucet_invoices/unknown': { tsMs: NOW, status: 'unknown', amount: 8000, paymentHash: '66'.repeat(16) },
        'faucet_invoices/no_status': { tsMs: NOW, amount: 7000, paymentHash: '77'.repeat(16) },
        'faucet_invoices/no_time': { status: 'used', amount: 6000, paymentHash: '88'.repeat(16) },
        'faucet_invoices/last_month': { tsMs: Date.UTC(2026, 8, 15), status: 'used', amount: 5000, paymentHash: '99'.repeat(16) },
    });
    const r = await recon.reconcile({
        db: db,
        emitAlert: async function () { return true; },
    }, { nowMs: NOW });
    assert.strictEqual(r.monthlySpentSats, 500);
    assert.strictEqual(r.budgetBand, '');
});

test('faucet pending or unknown older than 15 minutes is flagged; used and fresh pending are not', async function () {
    const db = memDb({
        'faucet_invoices/old_pending': { status: 'pending', tsMs: NOW - 16 * 60 * 1000, amount: 200, paymentHash: 'aa'.repeat(16) },
        'faucet_invoices/old_unknown': { status: 'unknown', ts: { toMillis: function () { return NOW - 20 * 60 * 1000; } }, amount: 200, paymentHash: 'bb'.repeat(16) },
        'faucet_invoices/fresh_pending': { status: 'pending', tsMs: NOW - 60 * 1000, amount: 200, paymentHash: 'cc'.repeat(16) },
        'faucet_invoices/used': { status: 'used', tsMs: NOW - 20 * 60 * 1000, amount: 200, paymentHash: 'dd'.repeat(16) },
    });
    const emitted = [];
    const r = await recon.reconcile({
        db: db,
        emitAlert: async function (o) { emitted.push(o); return true; },
    }, { nowMs: NOW });
    const ids = r.stuckPaying.map(function (s) { return s.id; }).sort();
    assert.deepStrictEqual(ids, ['old_pending', 'old_unknown']);
    assert.ok(r.stuckPaying.every(function (s) { return s.source === 'faucet'; }));
    assert.ok(db.store['payout_reconcile_flags/stuck_faucet_old_pending']);
    assert.ok(db.store['payout_reconcile_flags/stuck_faucet_old_unknown']);
    assert.ok(!db.store['payout_reconcile_flags/stuck_faucet_fresh_pending']);
    assert.ok(!db.store['payout_reconcile_flags/stuck_faucet_used']);
    assert.ok(emitted.some(function (a) { return a.kind === 'stuck_paying'; }));
    assert.strictEqual(r.monthlySpentSats, 200); // only the used row
});

test('monthly spend skips faucet rows with winId or a cipher_ id so auto-claimed wins are not counted twice', async function () {
    const db = memDb({
        'cipher_wins/w1': { status: 'paid', paidAtMs: NOW, amount: 2000, paymentHash: '11'.repeat(16) },
        'faucet_invoices/cipher_abcd': { tsMs: NOW, status: 'used', amount: 2000, winId: 'w1', paymentHash: '11'.repeat(16) },
        'faucet_invoices/cipher_no_winid': { tsMs: NOW, status: 'used', amount: 1500, paymentHash: '22'.repeat(16) },
        'faucet_invoices/with_winId': { tsMs: NOW, status: 'used', amount: 700, winId: 'w2', paymentHash: '33'.repeat(16) },
        'faucet_invoices/real_faucet': { tsMs: NOW, status: 'used', amount: 300, paymentHash: '44'.repeat(16) },
    });
    const r = await recon.reconcile({
        db: db,
        emitAlert: async function () { return true; },
    }, { nowMs: NOW });
    // 2000 from cipher_wins/w1 + 300 from the real faucet. The three
    // duplicate faucet rows are skipped.
    assert.strictEqual(r.monthlySpentSats, 2300);
    assert.strictEqual(recon.isDuplicateFaucetRow({ source: 'faucet', id: 'cipher_abcd', data: {} }), true);
    assert.strictEqual(recon.isDuplicateFaucetRow({ source: 'faucet', id: 'with_winId', data: { winId: 'w2' } }), true);
    assert.strictEqual(recon.isDuplicateFaucetRow({ source: 'faucet', id: 'real_faucet', data: {} }), false);
    assert.strictEqual(recon.isDuplicateFaucetRow({ source: 'cipher_win', id: 'cipher_abcd', data: { winId: 'w1' } }), false);
});

test('cipher wins and sats payouts with status unknown older than 15 minutes are flagged; fresh unknown and paid are not', async function () {
    const db = memDb({
        'cipher_wins/old_unknown': { status: 'unknown', createdAtMs: NOW - 20 * 60 * 1000, amount: 400, paymentHash: 'aa'.repeat(16) },
        'cipher_wins/fresh_unknown': { status: 'unknown', createdAtMs: NOW - 60 * 1000, amount: 400, paymentHash: 'bb'.repeat(16) },
        'cipher_wins/paid': { status: 'paid', paidAtMs: NOW - 20 * 60 * 1000, amount: 400, paymentHash: 'cc'.repeat(16) },
        'cipher_sats_payouts/old_unknown': { status: 'unknown', ts: { toMillis: function () { return NOW - 16 * 60 * 1000; } }, amount: 250, paymentHash: 'dd'.repeat(16) },
        'cipher_sats_payouts/fresh_unknown': { status: 'unknown', payingAtMs: NOW - 2 * 60 * 1000, amount: 250, paymentHash: 'ee'.repeat(16) },
        'cipher_sats_payouts/paid': { status: 'paid', paidAtMs: NOW - 20 * 60 * 1000, amount: 250, paymentHash: 'ff'.repeat(16) },
    });
    const emitted = [];
    const r = await recon.reconcile({
        db: db,
        emitAlert: async function (o) { emitted.push(o); return true; },
    }, { nowMs: NOW });
    const stuck = r.stuckPaying.map(function (s) { return s.source + ':' + s.id; }).sort();
    assert.deepStrictEqual(stuck, ['cipher_sats:old_unknown', 'cipher_win:old_unknown']);
    assert.ok(r.stuckPaying.every(function (s) { return s.status === 'unknown'; }));
    assert.ok(db.store['payout_reconcile_flags/stuck_cipher_win_old_unknown']);
    assert.ok(db.store['payout_reconcile_flags/stuck_cipher_sats_old_unknown']);
    assert.ok(!db.store['payout_reconcile_flags/stuck_cipher_win_fresh_unknown']);
    assert.ok(!db.store['payout_reconcile_flags/stuck_cipher_sats_fresh_unknown']);
    assert.ok(!db.store['payout_reconcile_flags/stuck_cipher_win_paid']);
    assert.ok(!db.store['payout_reconcile_flags/stuck_cipher_sats_paid']);
    assert.ok(emitted.some(function (a) { return a.kind === 'stuck_paying'; }));
    // paid cipher win (400) + paid cipher sats (250); unknown and faucet-less
    assert.strictEqual(r.monthlySpentSats, 650);
});

test('alert helpers: budget bands and uid masking', function () {
    assert.strictEqual(alerts.budgetBand(79999), '');
    assert.strictEqual(alerts.budgetBand(80000), 'warn');
    assert.strictEqual(alerts.budgetBand(95000), 'critical');
    assert.strictEqual(alerts.budgetBand(100000), 'cap');
    assert.strictEqual(alerts.maskUid('aliceUid000001'), 'al…01');
    assert.ok(/America\/New_York/.test(Function.prototype.toString.call(alerts.etDayKey)));
});

test('emit writes admin_notifications once per key per ET day', async function () {
    const db = memDb();
    const deps = { db: db, admin: { firestore: { FieldValue: { serverTimestamp: function () { return NOW; } } } } };
    const a = await alerts.emit(deps, { kind: 'address_change', key: 'ln_reset_x', text: 'A payout address was changed for account al…01.', nowMs: NOW });
    const b = await alerts.emit(deps, { kind: 'address_change', key: 'ln_reset_x', text: 'A payout address was changed for account al…01.', nowMs: NOW });
    assert.strictEqual(a, true);
    assert.strictEqual(b, false);
    const notes = Object.keys(db.store).filter(function (k) { return k.indexOf('admin_notifications/') === 0; });
    assert.strictEqual(notes.length, 1);
    assert.strictEqual(db.store[notes[0]].type, 'payout_address_change');
});

(async function main() {
    for (const t of queue) {
        try { await t.fn(); console.log('\u2705 ' + t.name); passed++; }
        catch (e) { console.log('\u274c ' + t.name + ': ' + (e && e.stack || e)); failed++; }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
