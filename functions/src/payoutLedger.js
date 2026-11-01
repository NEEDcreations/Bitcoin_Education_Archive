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
    t.set(ctx.refs.rates, Object.assign({}, ctx.rates, { lockedAt: stamp }));
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
    if (ctx.alreadyRecorded) return false;
    const amt = Math.max(0, Math.floor(Number(amount) || 0));
    const inc = admin.firestore.FieldValue.increment;
    const patch = { month: ctx.info.month, total: inc(amt), updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    patch.bySource = {};
    patch.bySource[source] = inc(amt);
    t.set(ctx.refs.month, patch, { merge: true });
    if (ctx.refs.ledger) {
        t.set(ctx.refs.ledger, Object.assign({
            source: source, amount: amt, month: ctx.info.month, day: ctx.info.day,
            status: 'recorded', payoutId: String(payoutId || ''),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, meta || {}));
    }
    ctx.alreadyRecorded = true;
    return true;
}

// Gives a failed payout back to the month it was recorded in. Idempotent.
async function refundPayout(db, admin, payoutId) {
    if (!payoutId) return false;
    const ledgerRef = db.collection('payout_ledger').doc(String(payoutId).replace(/\//g, '_').slice(0, 200));
    let done = false;
    await db.runTransaction(async (t) => {
        const snap = await t.get(ledgerRef);
        if (!snap.exists) return;
        const row = snap.data() || {};
        if (row.status === 'refunded') return;
        const inc = admin.firestore.FieldValue.increment;
        const patch = { total: inc(-row.amount), bySource: {} };
        patch.bySource[row.source] = inc(-row.amount);
        t.set(db.collection('payout_budget').doc(row.month), patch, { merge: true });
        t.update(ledgerRef, { status: 'refunded', refundedAt: admin.firestore.FieldValue.serverTimestamp() });
        done = true;
    });
    return done;
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

module.exports = { refs, readBudgetTx, writeRatesTx, recordPayoutTx, refundPayout, noteWalletLow, reservedPotSats };
