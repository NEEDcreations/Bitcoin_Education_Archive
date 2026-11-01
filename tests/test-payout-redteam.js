// PR #196 Red Team + QA fixes: Favor in the monthly total, attempt-owned
// release/refund, daily faucet ceiling, atomic rollback refund, wallet floor
// reservations, one cipher review threshold, one Favor epoch number.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const pb = require('../functions/src/payoutBudget');
const pl = require('../functions/src/payoutLedger');
const { DateTime } = require('../functions/node_modules/luxon');

let passed = 0, failed = 0;
const pending = [];
function test(name, fn) {
    pending.push(Promise.resolve().then(fn).then(
        () => { passed++; console.log('  ✓ ' + name); },
        (e) => { failed++; console.log('  ✗ ' + name + ': ' + e.message); }));
}
const etMs = (iso) => DateTime.fromISO(iso, { zone: 'America/New_York' }).toMillis();
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'functions', f), 'utf8');

// Minimal in-memory Firestore with transactions (enough for payoutLedger).
function fakeDb() {
    const docs = {};
    const inc = (n) => ({ __inc: n });
    const del = () => ({ __del: true });
    function merge(base, patch) {
        const out = Object.assign({}, base);
        Object.keys(patch).forEach((k) => {
            const v = patch[k];
            if (v && v.__inc !== undefined) out[k] = (Number(out[k]) || 0) + v.__inc;
            else if (v && v.__del) delete out[k];
            else if (v && typeof v === 'object' && !Array.isArray(v) && !v.__ts) out[k] = merge(out[k] || {}, v);
            else out[k] = v;
        });
        return out;
    }
    function ref(p) {
        return { path: p, collection: undefined, update: async (u) => { docs[p] = merge(docs[p] || {}, u); } };
    }
    const db = {
        docs,
        collection: (c) => ({ doc: (d) => ref(c + '/' + d) }),
        runTransaction: async (fn) => {
            const writes = [];
            const t = {
                get: async (r) => ({ exists: !!docs[r.path], data: () => docs[r.path] }),
                set: (r, v, o) => writes.push(() => { docs[r.path] = o && o.merge ? merge(docs[r.path] || {}, v) : merge({}, v); }),
                update: (r, v) => writes.push(() => { docs[r.path] = merge(docs[r.path] || {}, v); }),
                delete: (r) => writes.push(() => { delete docs[r.path]; }),
            };
            const out = await fn(t);
            writes.forEach((w) => w());
            return out;
        },
    };
    const admin = { firestore: { FieldValue: { increment: inc, delete: del, serverTimestamp: () => ({ __ts: 1 }) } } };
    return { db, admin };
}

console.log('PR #196 Red Team fixes');

// H1
test('H1: Favor epoch blocked when it would push the month past 25,000', () => {
    const caps = pb.readCaps(null);
    const r = pb.assessFavorEpoch({ caps, favorReserve: 30000, monthDoc: { bySource: { faucet: 8000, misc: 5000 } } });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'budget_total');
});
test('H1: Favor epoch allowed when reserve and month total both have room', () => {
    const caps = pb.readCaps(null);
    const r = pb.assessFavorEpoch({ caps, favorReserve: 21000, monthDoc: { bySource: { faucet: 4000 } } });
    assert.strictEqual(r.ok, true);
    assert.ok(r.monthAfter <= caps.total);
});
test('H1: reserve shortfall still reported first', () => {
    const r = pb.assessFavorEpoch({ favorReserve: 100, monthDoc: {} });
    assert.strictEqual(r.code, 'favor_reserve');
});

// H2 (source checks; runtime needs the emulator)
test('H2: admin mark-paid refuses a win in status paying', () => {
    const s = src('src/gifting.js');
    const a = s.slice(s.indexOf('const adminMarkCipherWinPaid'));
    assert.ok(/if \(win\.status === 'paying'\) \{\s*throw httpsError/.test(a));
    assert.ok(!/win\.status !== 'paying'/.test(a.slice(0, 3000)));
});
test('H2: claimCipherWin release only reverts its own paying attempt, in one transaction with the refund', () => {
    const s = src('src/gifting.js');
    const c = s.slice(s.indexOf('const claimCipherWin'), s.indexOf('const adminMarkCipherWinPaid'));
    assert.ok(c.includes("if (w.status !== 'paying' || w.payAttemptId !== attemptId) return;"));
    assert.ok(c.includes('payoutLedger.applyRefundTx(t, db, admin, refund, attemptId)'));
    assert.ok(!c.includes("winRef.update({ status: 'claimable'"), 'no unconditional revert left');
    assert.ok(!c.includes("refundPayout(db, admin, 'cipherwin_'"), 'no unconditional refund left');
});

// M3
test('M3: daily faucet ceiling spreads the remaining room over days left', () => {
    const caps = pb.readCaps(null);
    const now = etMs('2026-11-01T12:00');
    const ceil = pb.faucetDailyCeiling({}, 0, caps, now);
    assert.strictEqual(ceil, Math.ceil(caps.faucet / 30));
    assert.strictEqual(pb.assessFaucetDaily({}, ceil - 100, 100, caps, now).ok, true);
    const no = pb.assessFaucetDaily({ bySource: { faucet: ceil } }, ceil, 100, caps, now);
    assert.strictEqual(no.ok, false);
    assert.strictEqual(no.code, 'budget_daily');
    assert.ok(!/\d/.test(no.error), 'error text shows no cap numbers');
});
test('M3: sybils cannot drain the month in one day', () => {
    const caps = pb.readCaps(null);
    const now = etMs('2026-11-01T09:00');
    let paid = 0, month = 0;
    for (let i = 0; i < 200; i++) {
        if (!pb.assessFaucetDaily({ bySource: { faucet: month } }, paid, 100, caps, now).ok) break;
        paid += 100; month += 100;
    }
    assert.ok(paid <= Math.ceil(caps.faucet / 30) && paid < caps.faucet);
});
test('M3: claimSats checks the daily ceiling in the claim transaction', () => {
    assert.ok(src('index.js').includes('payoutBudget.assessFaucetDaily(budget.monthDoc, (budget.rates || {}).faucetPaid'));
});

// M4/M5 runtime with fake db
test('M5: a late refund from an old attempt cannot cancel a newer payout', async () => {
    const { db, admin } = fakeDb();
    const now = etMs('2026-11-10T12:00');
    const rec = async (attemptId) => db.runTransaction(async (t) => {
        const c = await pl.readBudgetTx(t, db, now, 'cipherwin_w1');
        pl.recordPayoutTx(t, admin, c, 'misc', 500, 'cipherwin_w1', { attemptId });
    });
    await rec('A1');
    assert.strictEqual(await pl.refundPayout(db, admin, 'cipherwin_w1', 'A1'), true);
    await rec('A2');
    assert.strictEqual(await pl.refundPayout(db, admin, 'cipherwin_w1', 'A1'), false, 'stale refund ignored');
    assert.strictEqual(db.docs['payout_budget/2026-11'].total, 500);
    assert.strictEqual(await pl.refundPayout(db, admin, 'cipherwin_w1', 'A2'), true);
    assert.strictEqual(db.docs['payout_budget/2026-11'].total, 0);
});
test('M5: a row carried over to a new attempt is re-owned by it', async () => {
    const { db, admin } = fakeDb();
    const now = etMs('2026-11-10T12:00');
    for (const a of ['A1', 'A2']) {
        await db.runTransaction(async (t) => {
            const c = await pl.readBudgetTx(t, db, now, 'cipherwin_w2');
            pl.recordPayoutTx(t, admin, c, 'misc', 100, 'cipherwin_w2', { attemptId: a });
        });
    }
    assert.strictEqual(db.docs['payout_ledger/cipherwin_w2'].attemptId, 'A2');
    assert.strictEqual(db.docs['payout_budget/2026-11'].total, 100, 'recorded once');
    assert.strictEqual(pl.refundAllowed(db.docs['payout_ledger/cipherwin_w2'], 'A1'), false);
});
test('M3+M4: faucet record bumps the ET-day counter; refund in a tx gives it back', async () => {
    const { db, admin } = fakeDb();
    const now = etMs('2026-11-10T12:00');
    await db.runTransaction(async (t) => {
        const c = await pl.readBudgetTx(t, db, now, 'faucet_x');
        pl.recordPayoutTx(t, admin, c, 'faucet', 150, 'faucet_x', {});
    });
    assert.strictEqual(db.docs['payout_rates/2026-11-10'].faucetPaid, 150);
    await db.runTransaction(async (t) => {
        const r = await pl.readRefundTx(t, db, 'faucet_x');
        t.update(db.collection('users').doc('u'), { satsWithdrawn: admin.firestore.FieldValue.increment(-150) });
        pl.applyRefundTx(t, db, admin, r);
    });
    assert.strictEqual(db.docs['payout_rates/2026-11-10'].faucetPaid, 0);
    assert.strictEqual(db.docs['payout_budget/2026-11'].total, 0);
    assert.strictEqual(db.docs['payout_ledger/faucet_x'].status, 'refunded');
});
test('M4: faucet rollback refunds inside its transaction, and the catch still refunds', () => {
    const s = src('index.js');
    const f = s.slice(s.indexOf('async function _rollbackClaim('), s.indexOf('async function _flagFaucetAdmin('));
    assert.ok(f.includes('db.runTransaction'));
    assert.ok(f.includes('payoutLedger.readRefundTx(t, db, payoutId)'));
    assert.ok(f.includes('payoutLedger.applyRefundTx(t, db, admin, refund)'));
    const c = f.slice(f.indexOf('} catch (e) {'));
    assert.ok(c.includes('payoutLedger.refundPayout(db, admin, payoutId)'));
    assert.ok(!f.includes('db.batch()'));
});

// L6
test('L6: in-flight reservations count against the wallet floor', () => {
    const now = 1e12;
    const e = { a: { amt: 200, at: now - 1000 }, b: { amt: 200, at: now - 1000 }, stale: { amt: 5000, at: now - pl.INFLIGHT_TTL_MS - 1 } };
    assert.strictEqual(pl.inflightSats(e, now), 400);
    assert.strictEqual(pl.walletFloorOk(10500, 10000, {}, 200, now), true);
    assert.strictEqual(pl.walletFloorOk(10500, 10000, e, 200, now), false);
});
test('L6: parallel reservations stop at the floor', async () => {
    const { db, admin } = fakeDb();
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await pl.reserveWalletSats(db, admin, 'k' + i, 200, 10500, 10000));
    assert.deepStrictEqual(results, [true, true, false, false, false]);
});

// L7
test('L7: one cipher review threshold (> 1000); exactly 1000 pays normally', () => {
    assert.strictEqual(pb.cipherNeedsReview(1000), false);
    assert.strictEqual(pb.cipherNeedsReview(1001), true);
    const s = src('src/gifting.js');
    assert.ok(!s.includes('win.amount >= 1000'));
    assert.ok(s.includes('payoutBudget.cipherNeedsReview(win.amount) || [100, 500, 1000].indexOf(win.amount) === -1'));
});

test('L6: claimCipherSats reserves and releases wallet sats like the faucet', () => {
    const s = src('src/gifting.js');
    const f = s.slice(s.indexOf('async function payCipherBalanceInvoice('));
    const body = f.slice(0, f.indexOf('\n}\n'));
    assert.ok(body.includes('payoutLedger.reserveWalletSats(db, admin, reserveKey, amount, walletSats, floorSats)'));
    assert.ok(body.includes('payoutLedger.releaseWalletSats(db, admin, reserveKey)'));
    assert.ok(body.indexOf('reserveWalletSats') < body.indexOf('payInvoice'));
    assert.ok(s.includes("payCipherBalanceInvoice(invoice, 'ciphersats_' + reserved.claimId, reserved.amount)"));
    assert.ok(!/payCipherBalanceInvoice\(invoice\)/.test(s));
});
test('L7: adminClaimFlag uses the shared > 1000 helper', () => {
    const cc = require('../functions/src/cipherClaim');
    assert.strictEqual(cc.adminClaimFlag({ amount: 1000 }, {}, { banned: true }).flagForAdmin, false);
    assert.strictEqual(cc.adminClaimFlag({ amount: 1001 }, {}, { banned: true }).flagForAdmin, true);
    const s = src('src/cipherClaim.js');
    assert.ok(s.includes('cipherNeedsReview(amount)'));
    assert.ok(!/>=\s*1000/.test(s));
});

// L8
test('L8: Favor block uses one epoch number for ledger read and record', () => {
    const s = src('src/satoshiFavor.js');
    assert.ok(!s.includes('epochNumPre'));
    assert.ok(s.includes("readBudgetTx(tx, db, Date.now(), 'favor_epoch_' + epochNum)"));
    assert.ok(s.includes("'favor', payoutBudget.EPOCH_SATS, 'favor_epoch_' + epochNum"));
});

Promise.all(pending).then(() => {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
});
