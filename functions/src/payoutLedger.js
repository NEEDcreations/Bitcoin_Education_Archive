'use strict';

// Firestore side of payoutBudget. Every function here runs inside the caller's
// transaction: read*Tx first (Firestore needs all reads before writes), then
// write*Tx. All docs are server-only (firestore.rules deny client access):
//   payout_config/settings      caps, rate bounds (Phil edits in console)
//   payout_budget/{yyyy-MM}     { total, bySource.{faucet,drip,misc,favor,jackpot,manual} }
//   payout_rates/{yyyy-MM-dd}   locked daily minimum + XP rate (ET day)
//   payout_rates_public/today   copy for the Claim Sats tooltip (public read)
//   payout_ledger/{payoutId}    one row per payout, makes recording idempotent

const pb = require('./payoutBudget');

function refs(db, nowMs, payoutId) {
    const info = pb.periodInfo(nowMs);
    return {
        info: info,
        config: db.collection('payout_config').doc('settings'),
        month: db.collection('payout_budget').doc(info.month),
        rates: db.collection('payout_rates').doc(info.day),
        prevRates: db.collection('payout_rates').doc(info.prevDay),
        publicRates: db.collection('payout_rates_public').doc('today'),
        ledger: payoutId ? db.collection('payout_ledger').doc(String(payoutId).replace(/\//g, '_').slice(0, 200)) : null,
    };
}

async function readBudgetTx(t, db, nowMs, payoutId) {
    const r = refs(db, nowMs, payoutId);
    const cfgSnap = await t.get(r.config);
    const monthSnap = await t.get(r.month);
    const ratesSnap = await t.get(r.rates);
    const ledgerSnap = r.ledger ? await t.get(r.ledger) : null;
    const config = cfgSnap.exists ? (cfgSnap.data() || {}) : {};
    const monthDoc = monthSnap.exists ? (monthSnap.data() || {}) : {};
    let rates = ratesSnap.exists ? (ratesSnap.data() || null) : null;
    let ratesNew = false;
    if (!rates) {
        // First touch of the day before the midnight job ran: compute from
        // yesterday's locked rates. Same inputs give the same rates, and the
        // doc is create-once, so a race just retries the transaction.
        const prevSnap = await t.get(r.prevRates);
        const prev = prevSnap.exists ? prevSnap.data() : (config.lastRates || pb.DEFAULT_RATES);
        rates = pb.planDailyRates(prev, {
            config: config, monthDoc: monthDoc, nowMs: nowMs,
            walletLow: !!(config.walletLowSince && config.walletLowSince > nowMs - 2 * 86400000),
        });
        ratesNew = true;
    }
    return {
        refs: r, info: r.info, config: config, caps: pb.readCaps(config), monthDoc: monthDoc,
        rates: rates, ratesNew: ratesNew,
        alreadyRecorded: !!(ledgerSnap && ledgerSnap.exists && ledgerSnap.data().status !== 'refunded'),
        paused: config.paused === true,
    };
}

function writeRatesTx(t, admin, ctx) {
    if (!ctx.ratesNew) return;
    const stamp = admin.firestore.FieldValue.serverTimestamp();
    t.set(ctx.refs.rates, Object.assign({}, ctx.rates, { lockedAt: stamp }), { merge: true });
    t.set(ctx.refs.publicRates, {
        day: ctx.rates.day, minSats: ctx.rates.minSats, pointsPerSat: ctx.rates.pointsPerSat,
        xpPer100Sats: ctx.rates.xpPer100Sats, updatedAt: stamp,
    });
    ctx.ratesNew = false;
}

// Records a payout against the month. Call only after assessPayout said ok
// (auto sources) or for manual sources. Idempotent on payoutId.
function recordPayoutTx(t, admin, ctx, source, amount, payoutId, meta) {
    writeRatesTx(t, admin, ctx);
    const attemptId = meta && meta.attemptId ? String(meta.attemptId) : '';
    if (ctx.alreadyRecorded) {
        // Row still counted from an earlier attempt: hand it to this attempt
        // so only this attempt's release can refund it.
        if (attemptId && ctx.refs.ledger) t.set(ctx.refs.ledger, { attemptId: attemptId }, { merge: true });
        return false;
    }
    const amt = Math.max(0, Math.floor(Number(amount) || 0));
    const inc = admin.firestore.FieldValue.increment;
    const patch = { month: ctx.info.month, total: inc(amt), updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    patch.bySource = {};
    patch.bySource[source] = inc(amt);
    t.set(ctx.refs.month, patch, { merge: true });
    // Per-ET-day faucet counter for the daily ceiling (server-only doc).
    if (source === 'faucet') t.set(ctx.refs.rates, { faucetPaid: inc(amt) }, { merge: true });
    if (ctx.refs.ledger) {
        t.set(ctx.refs.ledger, Object.assign({
            source: source, amount: amt, month: ctx.info.month, day: ctx.info.day,
            status: 'recorded', payoutId: String(payoutId || ''), attemptId: '',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, meta || {}));
    }
    ctx.alreadyRecorded = true;
    return true;
}

function ledgerRef(db, payoutId) {
    return db.collection('payout_ledger').doc(String(payoutId).replace(/\//g, '_').slice(0, 200));
}

// Pure: may this refund apply to this row? attemptId, when given, must match
// the row's attempt so a late refund can't cancel a later payout.
function refundAllowed(row, attemptId) {
    if (!row || row.status === 'refunded') return false;
    if (attemptId && String(row.attemptId || '') !== String(attemptId)) return false;
    return true;
}

// In-transaction refund. Call readRefundTx with the other reads, then
// applyRefundTx with the other writes, so the refund commits or rolls back
// together with the caller's state change.
async function readRefundTx(t, db, payoutId) {
    if (!payoutId) return null;
    const ref = ledgerRef(db, payoutId);
    const snap = await t.get(ref);
    return { ref: ref, row: snap.exists ? (snap.data() || {}) : null };
}
function applyRefundTx(t, db, admin, read, attemptId) {
    if (!read || !refundAllowed(read.row, attemptId)) return false;
    const row = read.row;
    const inc = admin.firestore.FieldValue.increment;
    const patch = { total: inc(-row.amount), bySource: {} };
    patch.bySource[row.source] = inc(-row.amount);
    t.set(db.collection('payout_budget').doc(row.month), patch, { merge: true });
    if (row.source === 'faucet' && row.day) {
        t.set(db.collection('payout_rates').doc(row.day), { faucetPaid: inc(-row.amount) }, { merge: true });
    }
    t.update(read.ref, { status: 'refunded', refundedAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
}

// Gives a failed payout back to the month it was recorded in. Idempotent.
async function refundPayout(db, admin, payoutId, attemptId) {
    if (!payoutId) return false;
    let done = false;
    await db.runTransaction(async (t) => {
        done = false;
        const read = await readRefundTx(t, db, payoutId);
        done = applyRefundTx(t, db, admin, read, attemptId);
    });
    return done;
}

// Wallet floor with in-flight reservations (Red Team L6). Concurrent claims
// each reserve their amount in one server-only doc inside a transaction, so N
// parallel claims can't all pass a balance check that only one could afford.
// Entries older than INFLIGHT_TTL_MS are ignored (crashed sends).
const INFLIGHT_TTL_MS = 5 * 60 * 1000;
function inflightSats(entries, nowMs) {
    const e = entries || {};
    return Object.keys(e).reduce(function(sum, k) {
        const row = e[k] || {};
        if (!(Number(row.at) > nowMs - INFLIGHT_TTL_MS)) return sum;
        return sum + Math.max(0, Math.floor(Number(row.amt) || 0));
    }, 0);
}
function walletFloorOk(walletSats, floorSats, entries, amount, nowMs) {
    return (Number(walletSats) || 0) - inflightSats(entries, nowMs) - (Number(amount) || 0) >= (Number(floorSats) || 0);
}
async function reserveWalletSats(db, admin, key, amount, walletSats, floorSats) {
    const ref = db.collection('payout_config').doc('walletInflight');
    const k = String(key).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
    let ok = false;
    await db.runTransaction(async (t) => {
        const snap = await t.get(ref);
        const now = Date.now();
        const entries = snap.exists ? ((snap.data() || {}).entries || {}) : {};
        ok = walletFloorOk(walletSats, floorSats, entries, amount, now);
        if (!ok) return;
        const patch = {}; patch[k] = { amt: Math.floor(Number(amount) || 0), at: now };
        t.set(ref, { entries: patch }, { merge: true });
    });
    return ok;
}
async function releaseWalletSats(db, admin, key) {
    const k = String(key).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
    const upd = {}; upd['entries.' + k] = admin.firestore.FieldValue.delete();
    await db.collection('payout_config').doc('walletInflight').update(upd).catch(function() {});
}

// Wallet-low marker feeds the next day's pacing.
async function noteWalletLow(db, nowMs) {
    try {
        await db.collection('payout_config').doc('settings').set({ walletLowSince: Number(nowMs) || Date.now() }, { merge: true });
    } catch (e) { console.warn('[payout] walletLow note failed', e.message); }
}

// Drip pot reserve (PR #195): sats already set aside for a full pot.
async function reservedPotSats(db) {
    try {
        const snap = await db.collection('tctv_drip_config').doc('reserve').get();
        if (!snap.exists) return 0;
        return Math.max(0, Math.floor(Number((snap.data() || {}).reservedSats) || 0));
    } catch (e) { return 0; }
}

module.exports = { INFLIGHT_TTL_MS, inflightSats, walletFloorOk, reserveWalletSats, releaseWalletSats, refs, ledgerRef, refundAllowed, readRefundTx, applyRefundTx, readBudgetTx, writeRatesTx, recordPayoutTx, refundPayout, noteWalletLow, reservedPotSats };
