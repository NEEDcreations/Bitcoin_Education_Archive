'use strict';
// Scheduled payout reconciliation (ledger first; wallet listing optional).
// Matches outgoing claim/payout records to one another, flags claims stuck
// in `paying`, and (when a read-only wallet list is provided) flags wallet
// payments that have no matching claim. Writes append-only run and flag
// docs; never deletes payout, claim, or audit records.
//
// Wallet listing is off by default. The scheduled function binds no wallet
// secret, so it can run with only Firestore. A later deploy may inject a
// read-only list after a dedicated connection is created.

const alerts = require('./payoutAlerts');

const STUCK_PAYING_MS = 15 * 60 * 1000;
const FLAGS_COLLECTION = 'payout_reconcile_flags';
const RUNS_COLLECTION = 'payout_reconcile_runs';
const DEFAULT_SCHEDULE = 'every 15 minutes';

const CLAIM_SOURCES = Object.freeze([
    { collection: 'sf_block_claims', payoutCollection: 'sf_block_payouts', source: 'favor' },
    { collection: 'cipher_sats_payouts', payoutCollection: null, source: 'cipher_sats' },
    { collection: 'cipher_wins', payoutCollection: null, source: 'cipher_win' },
    { collection: 'faucet_invoices', payoutCollection: null, source: 'faucet' },
]);

function normalizeHash(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s || s.length < 8 || s.length > 128) return '';
    if (!/^[0-9a-f]+$/.test(s)) return '';
    return s;
}

function hashFromDoc(data) {
    if (!data) return '';
    return normalizeHash(data.paymentHash || data.payment_hash || data.invoiceHash);
}

function statusOf(data) {
    return String((data && data.status) || '').toLowerCase();
}

function payingAtMs(data) {
    const n = Number(data && (data.payingAtMs != null ? data.payingAtMs : (data.payingAt && data.payingAt.toMillis ? data.payingAt.toMillis() : data.payingAt)));
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function paidSatsOf(data) {
    const candidates = [data && data.walletSpentSats, data && data.netSats, data && data.net_sent, data && data.amount, data && data.sats];
    for (let i = 0; i < candidates.length; i++) {
        const n = Number(candidates[i]);
        if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }
    return 0;
}

function monthStartMs(monthKey) {
    // monthKey is YYYY-MM in America/New_York. Use noon UTC on the 1st as a
    // safe lower bound; callers also filter by etMonthKey.
    const parts = String(monthKey || '').split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isInteger(y) || !Number.isInteger(m)) return 0;
    return Date.UTC(y, m - 2, 28); // a few days before the ET month, inclusive
}

async function listCollection(db, name) {
    const snap = await db.collection(name).get();
    return (snap.docs || []).map(function (d) {
        return { id: d.id, data: (typeof d.data === 'function' ? d.data() : d.data) || {} };
    });
}

async function createFlag(db, flag) {
    const id = String(flag.id).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 200);
    const ref = db.collection(FLAGS_COLLECTION).doc(id);
    try {
        await ref.create(Object.assign({ createdAtMs: flag.atMs, status: 'open' }, flag, { id: id }));
        return 'created';
    } catch (e) {
        return 'exists';
    }
}

async function loadLedger(db, listFn) {
    const list = listFn || listCollection;
    const claims = [];
    const payouts = [];
    for (let i = 0; i < CLAIM_SOURCES.length; i++) {
        const src = CLAIM_SOURCES[i];
        const rows = await list(db, src.collection);
        rows.forEach(function (row) {
            claims.push({
                id: row.id,
                source: src.source,
                collection: src.collection,
                data: row.data,
                status: statusOf(row.data),
                paymentHash: hashFromDoc(row.data),
                payingAtMs: payingAtMs(row.data),
                paidSats: paidSatsOf(row.data),
            });
        });
        if (src.payoutCollection) {
            const pays = await list(db, src.payoutCollection);
            pays.forEach(function (row) {
                payouts.push({
                    id: row.id,
                    source: src.source,
                    collection: src.payoutCollection,
                    data: row.data,
                    paymentHash: hashFromDoc(row.data),
                    paidSats: paidSatsOf(row.data),
                });
            });
        }
    }
    return { claims: claims, payouts: payouts };
}

function indexByHash(rows) {
    const map = Object.create(null);
    rows.forEach(function (row) {
        if (!row.paymentHash) return;
        if (!map[row.paymentHash]) map[row.paymentHash] = [];
        map[row.paymentHash].push(row);
    });
    return map;
}

async function reconcile(deps, opts) {
    const db = deps.db;
    const o = opts || {};
    const nowMs = o.nowMs != null ? o.nowMs : (deps.nowMs ? deps.nowMs() : Date.now());
    const stuckAfterMs = o.stuckAfterMs != null ? o.stuckAfterMs : STUCK_PAYING_MS;
    const monthKey = alerts.etMonthKey(nowMs);
    const result = {
        atMs: nowMs,
        monthKey: monthKey,
        walletListed: false,
        stuckPaying: [],
        unmatchedWallet: [],
        unmatchedLedger: [],
        monthlySpentSats: 0,
        budgetBand: '',
        flagsCreated: 0,
        alerts: 0,
    };

    const ledger = await loadLedger(db, deps.listCollection);
    const claimsByHash = indexByHash(ledger.claims);
    const payoutsByHash = indexByHash(ledger.payouts);

    function inMonth(data) {
        const paidAt = Number(data && (data.paidAtMs || data.tsMs || 0)) || 0;
        return !paidAt || alerts.etMonthKey(paidAt) === monthKey;
    }
    ledger.claims.forEach(function (c) {
        if (c.status === 'paying' && c.payingAtMs && (nowMs - c.payingAtMs) >= stuckAfterMs) {
            result.stuckPaying.push({ source: c.source, id: c.id, payingAtMs: c.payingAtMs });
        }
        // Favor spend is taken from sf_block_payouts only, so it is not
        // double-counted from the claim doc.
        if (c.source === 'favor') return;
        if (inMonth(c.data) && (c.status === 'paid' || c.source === 'faucet')) {
            result.monthlySpentSats += c.paidSats;
        }
    });
    ledger.payouts.forEach(function (p) {
        if (!inMonth(p.data)) return;
        result.monthlySpentSats += p.paidSats;
    });

    result.budgetBand = alerts.budgetBand(result.monthlySpentSats);

    const listWallet = (o.listWallet !== false) && typeof deps.listWalletPayments === 'function'
        && (o.forceWalletList || (deps.readConfig && (await deps.readConfig()).listWallet === true));
    if (listWallet) {
        result.walletListed = true;
        const sinceMs = o.walletSinceMs != null ? o.walletSinceMs : (nowMs - 48 * 3600 * 1000);
        let walletRows = [];
        try {
            walletRows = await deps.listWalletPayments({ sinceMs: sinceMs, nowMs: nowMs });
        } catch (e) {
            result.walletListError = 'list_failed';
        }
        (walletRows || []).forEach(function (row) {
            const hash = normalizeHash(row && (row.paymentHash || row.payment_hash || row.hash));
            const typ = String((row && (row.type || row.typ)) || 'outgoing').toLowerCase();
            if (!hash) return;
            if (typ && typ !== 'outgoing' && typ !== 'out' && typ !== 'send' && typ !== 'paid') return;
            const matched = (claimsByHash[hash] && claimsByHash[hash].length) || (payoutsByHash[hash] && payoutsByHash[hash].length);
            if (!matched) {
                result.unmatchedWallet.push({ paymentHashSuffix: hash.slice(0, 8), amountSats: Math.max(0, Math.floor(Number(row.amountSats || row.amount_sats || row.amount) || 0)) });
            }
        });
    }

    for (let i = 0; i < result.stuckPaying.length; i++) {
        const s = result.stuckPaying[i];
        const created = await createFlag(db, {
            id: 'stuck_' + s.source + '_' + s.id,
            kind: 'stuck_paying',
            source: s.source,
            claimId: s.id,
            payingAtMs: s.payingAtMs,
            atMs: nowMs,
        });
        if (created === 'created') result.flagsCreated++;
    }
    for (let i = 0; i < result.unmatchedWallet.length; i++) {
        const u = result.unmatchedWallet[i];
        const created = await createFlag(db, {
            id: 'unmatched_' + u.paymentHashSuffix + '_' + alerts.etDayKey(nowMs),
            kind: 'unmatched_payment',
            paymentHashSuffix: u.paymentHashSuffix,
            amountSats: u.amountSats,
            atMs: nowMs,
        });
        if (created === 'created') result.flagsCreated++;
    }

    if (typeof deps.emitAlert === 'function' || deps.alerts !== false) {
        const emit = deps.emitAlert || function (payload) { return alerts.emit(deps, payload); };
        if (result.stuckPaying.length) {
            const fired = await emit({
                kind: 'stuck_paying',
                key: 'stuck_paying',
                nowMs: nowMs,
                text: result.stuckPaying.length + ' payout claim(s) have been in paying for over 15 minutes. Flagged for review; not retried.',
                extra: { count: result.stuckPaying.length },
            });
            if (fired) result.alerts++;
        }
        if (result.unmatchedWallet.length) {
            const fired = await emit({
                kind: 'unmatched_payment',
                key: 'unmatched_payment',
                nowMs: nowMs,
                text: result.unmatchedWallet.length + ' outgoing wallet payment(s) have no matching claim record.',
                extra: { count: result.unmatchedWallet.length },
            });
            if (fired) result.alerts++;
        }
        const budgetText = alerts.budgetAlertText(result.monthlySpentSats, monthKey);
        if (budgetText) {
            const fired = await emit({
                kind: 'budget_nearing',
                key: 'budget_' + result.budgetBand + '_' + monthKey,
                nowMs: nowMs,
                text: budgetText,
                extra: { spentSats: result.monthlySpentSats, monthKey: monthKey, band: result.budgetBand },
            });
            if (fired) result.alerts++;
        }
    }

    const runId = 'run_' + nowMs + '_' + Math.floor(Math.random() * 1e6);
    const runDoc = {
        atMs: nowMs,
        monthKey: monthKey,
        walletListed: result.walletListed,
        stuckPaying: result.stuckPaying.length,
        unmatchedWallet: result.unmatchedWallet.length,
        monthlySpentSats: result.monthlySpentSats,
        budgetBand: result.budgetBand,
        flagsCreated: result.flagsCreated,
        alerts: result.alerts,
    };
    if (result.walletListError) runDoc.walletListError = result.walletListError;
    try {
        await db.collection(RUNS_COLLECTION).doc(runId).create(runDoc);
        result.runId = runId;
    } catch (e) {
        console.warn('[payoutReconcile] run record write failed');
    }
    return result;
}

function factory(functionsV1, deps) {
    const onSchedule = deps.onSchedule;
    const handler = async function () {
        return reconcile({
            db: deps.db,
            admin: deps.admin,
            nowMs: Date.now,
            listWalletPayments: deps.listWalletPayments,
            readConfig: deps.readConfig || async function () {
                try {
                    const snap = await deps.db.collection('config').doc('payoutReconcile').get();
                    return snap.exists ? (snap.data() || {}) : {};
                } catch (e) { return {}; }
            },
        });
    };
    const scheduled = onSchedule ? onSchedule({
        schedule: DEFAULT_SCHEDULE,
        timeZone: 'America/New_York',
        retryCount: 0,
        timeoutSeconds: 120,
    }, handler) : handler;
    return { reconcilePayouts: scheduled, run: handler };
}

module.exports = {
    STUCK_PAYING_MS: STUCK_PAYING_MS,
    FLAGS_COLLECTION: FLAGS_COLLECTION,
    RUNS_COLLECTION: RUNS_COLLECTION,
    CLAIM_SOURCES: CLAIM_SOURCES,
    normalizeHash: normalizeHash,
    hashFromDoc: hashFromDoc,
    reconcile: reconcile,
    factory: factory,
    monthStartMs: monthStartMs,
};
