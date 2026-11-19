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
const { classifyLookup } = require('./cipherClaim');

// Refunded failures (#376): faucet invoices marked failed and cipher payouts
// marked restored. If one of them later shows as settled in the wallet, it is
// flagged for review. Nothing is paid, retried or clawed back here.
const FAILED_RECHECK_MS = 48 * 3600 * 1000;
const FAILED_RECHECK_MAX = 50;

function refundedFailure(claim) {
    if (!claim || !claim.paymentHash) return false;
    if (claim.source === 'faucet') return claim.status === 'failed' && !isDuplicateFaucetRow(claim);
    if (claim.source === 'cipher_sats') return claim.status === 'restored';
    return false;
}

function refundedAtMs(claim) {
    return eventMs(claim && claim.data, ['failedAt', 'restoredAt', 'heldAt', 'payingAtMs', 'payingAt', 'tsMs', 'ts', 'createdAtMs', 'createdAt']);
}

function failuresToRecheck(claims, nowMs, windowMs) {
    const w = windowMs != null ? windowMs : FAILED_RECHECK_MS;
    return (claims || []).filter(function (c) {
        if (!refundedFailure(c)) return false;
        const at = refundedAtMs(c);
        return at > 0 && (nowMs - at) <= w;
    });
}

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

function toMs(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : 0;
    if (typeof v.toMillis === 'function') {
        const n = Number(v.toMillis());
        return Number.isFinite(n) && n > 0 ? n : 0;
    }
    if (typeof v.seconds === 'number') return v.seconds * 1000 > 0 ? v.seconds * 1000 : 0;
    if (typeof v._seconds === 'number') return v._seconds * 1000 > 0 ? v._seconds * 1000 : 0;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function eventMs(data, fields) {
    const d = data || {};
    const list = fields || [];
    for (let i = 0; i < list.length; i++) {
        const n = toMs(d[list[i]]);
        if (n) return n;
    }
    return 0;
}

function payingAtMs(data) {
    return eventMs(data, ['payingAtMs', 'payingAt']);
}

// Production faucet invoices use `ts` (Timestamp) and status used/pending/unknown.
// Favor / cipher docs use paidAtMs or tsMs. A missing date is not "this month".
function paidAtMsOf(data) {
    return eventMs(data, ['paidAtMs', 'tsMs', 'ts', 'paidAt']);
}

function faucetCountsAsPaid(status) {
    return status === 'used';
}

function faucetLooksStuck(status) {
    return status === 'pending' || status === 'unknown';
}

// claimCipherWin also writes faucet_invoices/cipher_<hash> (often with winId)
// status used, so auto-claimed cipher wins and faction prizes would be counted
// twice if those faucet rows were included in monthly spend.
function isDuplicateFaucetRow(claim) {
    if (!claim || claim.source !== 'faucet') return false;
    if (claim.data && claim.data.winId) return true;
    if (String(claim.id || '').indexOf('cipher_') === 0) return true;
    return false;
}

const WINDOW_FIELDS = Object.freeze({
    sf_block_claims: [
        { field: 'paidAtMs', as: 'ms' },
        { field: 'payingAtMs', as: 'ms' },
        { field: 'createdAtMs', as: 'ms' },
    ],
    sf_block_payouts: [{ field: 'paidAtMs', as: 'ms' }],
    faucet_invoices: [
        { field: 'ts', as: 'ts' },
        { field: 'tsMs', as: 'ms' },
        { field: 'paidAtMs', as: 'ms' },
    ],
    // Production writers use Firestore Timestamps (paidAt, createdAt,
    // payingAt, heldAt). The *Ms names are kept for older or mixed docs.
    cipher_sats_payouts: [
        { field: 'paidAtMs', as: 'ms' },
        { field: 'payingAtMs', as: 'ms' },
        { field: 'createdAtMs', as: 'ms' },
        { field: 'paidAt', as: 'ts' },
        { field: 'createdAt', as: 'ts' },
        { field: 'payingAt', as: 'ts' },
        { field: 'heldAt', as: 'ts' },
    ],
    cipher_wins: [
        { field: 'paidAtMs', as: 'ms' },
        { field: 'payingAtMs', as: 'ms' },
        { field: 'createdAtMs', as: 'ms' },
        { field: 'ts', as: 'ts' },
        { field: 'paidAt', as: 'ts' },
        { field: 'createdAt', as: 'ts' },
        { field: 'payingAt', as: 'ts' },
    ],
});
const OPEN_STATUSES = Object.freeze(['paying', 'pending', 'unknown']);

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

function mapQueryDocs(snap) {
    return (snap.docs || []).map(function (d) {
        return { id: d.id, data: (typeof d.data === 'function' ? d.data() : d.data) || {} };
    });
}

// Time-windowed read when the collection supports where(). Falls back to a
// full get if no bounded query works (tests, or a missing index).
async function listCollection(db, name, sinceMs) {
    const col = db.collection(name);
    function absorb(into, snap) {
        (snap.docs || []).forEach(function (d) {
            into[d.id] = { id: d.id, data: (typeof d.data === 'function' ? d.data() : d.data) || {} };
        });
    }
    if (!sinceMs || typeof col.where !== 'function') {
        return mapQueryDocs(await col.get());
    }
    const byId = Object.create(null);
    let boundedOk = false;
    const fields = WINDOW_FIELDS[name] || [
        { field: 'paidAtMs', as: 'ms' },
        { field: 'tsMs', as: 'ms' },
        { field: 'ts', as: 'ts' },
    ];
    for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        const value = f.as === 'ts' ? new Date(sinceMs) : sinceMs;
        try {
            absorb(byId, await col.where(f.field, '>=', value).get());
            boundedOk = true;
        } catch (e) { /* no index, wrong type, or test mock */ }
    }
    try {
        absorb(byId, await col.where('status', 'in', OPEN_STATUSES.slice()).get());
        boundedOk = true;
    } catch (e) { /* no index or test mock */ }
    if (!boundedOk) {
        console.warn('[payoutReconcile] falling back to a full read of ' + name);
        return mapQueryDocs(await col.get());
    }
    return Object.keys(byId).map(function (id) { return byId[id]; });
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

async function loadLedger(db, listFn, sinceMs) {
    const list = listFn || function (database, name) {
        return listCollection(database, name, sinceMs);
    };
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
        settledAfterFailure: [],
        failedRechecked: 0,
        monthlySpentSats: 0,
        budgetBand: '',
        flagsCreated: 0,
        alerts: 0,
    };

    const ledger = await loadLedger(db, deps.listCollection, monthStartMs(monthKey));
    const claimsByHash = indexByHash(ledger.claims);
    const payoutsByHash = indexByHash(ledger.payouts);

    function inMonth(data) {
        const paidAt = paidAtMsOf(data);
        if (!paidAt) return false;
        return alerts.etMonthKey(paidAt) === monthKey;
    }
    ledger.claims.forEach(function (c) {
        let stuckAt = 0;
        if (c.status === 'paying' && c.payingAtMs && (nowMs - c.payingAtMs) >= stuckAfterMs) {
            stuckAt = c.payingAtMs;
        } else if (c.source === 'faucet' && faucetLooksStuck(c.status)) {
            const start = c.payingAtMs || eventMs(c.data, ['payingAtMs', 'tsMs', 'ts', 'createdAtMs']);
            if (start && (nowMs - start) >= stuckAfterMs) stuckAt = start;
        } else if ((c.source === 'cipher_win' || c.source === 'cipher_sats') && c.status === 'unknown') {
            const start = c.payingAtMs || eventMs(c.data, ['payingAtMs', 'payingAt', 'tsMs', 'ts', 'createdAtMs', 'createdAt']);
            if (start && (nowMs - start) >= stuckAfterMs) stuckAt = start;
        }
        if (stuckAt) {
            result.stuckPaying.push({ source: c.source, id: c.id, payingAtMs: stuckAt, status: c.status });
        }
        // Favor spend is taken from sf_block_payouts only, so it is not
        // double-counted from the claim doc.
        if (c.source === 'favor') return;
        // Skip faucet mirrors of cipher wins / faction prizes (winId or cipher_ id).
        if (isDuplicateFaucetRow(c)) return;
        const counts = c.source === 'faucet' ? faucetCountsAsPaid(c.status) : c.status === 'paid';
        if (inMonth(c.data) && counts) {
            result.monthlySpentSats += c.paidSats;
        }
    });
    ledger.payouts.forEach(function (p) {
        if (!inMonth(p.data)) return;
        result.monthlySpentSats += p.paidSats;
    });

    result.budgetBand = alerts.budgetBand(result.monthlySpentSats);

    const settledSeen = Object.create(null);
    function noteSettled(c, via) {
        const key = c.source + ':' + c.id;
        if (settledSeen[key]) return;
        settledSeen[key] = true;
        result.settledAfterFailure.push({ source: c.source, id: c.id, paymentHashSuffix: c.paymentHash.slice(0, 8), via: via });
    }

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
            (claimsByHash[hash] || []).forEach(function (c) {
                if (refundedFailure(c)) noteSettled(c, 'wallet_list');
            });
            if (!matched) {
                result.unmatchedWallet.push({ paymentHashSuffix: hash.slice(0, 8), amountSats: Math.max(0, Math.floor(Number(row.amountSats || row.amount_sats || row.amount) || 0)) });
            }
        });
    }

    // Per-hash lookup of recent refunded failures. Needs a wallet lookup hook,
    // which is not wired by default (this function binds no wallet secret).
    if (typeof deps.lookupPayment === 'function') {
        const recheck = failuresToRecheck(ledger.claims, nowMs).slice(0, FAILED_RECHECK_MAX);
        for (let i = 0; i < recheck.length; i++) {
            const c = recheck[i];
            result.failedRechecked++;
            let raw = null;
            try { raw = await deps.lookupPayment({ payment_hash: c.paymentHash }); }
            catch (e) { raw = null; }
            if (raw && classifyLookup(raw).kind === 'paid') noteSettled(c, 'lookup');
        }
    }

    for (let i = 0; i < result.settledAfterFailure.length; i++) {
        const f = result.settledAfterFailure[i];
        const created = await createFlag(db, {
            id: 'settled_after_failure_' + f.source + '_' + f.id,
            kind: 'settled_after_failure',
            source: f.source,
            claimId: f.id,
            paymentHashSuffix: f.paymentHashSuffix,
            via: f.via,
            atMs: nowMs,
        });
        if (created === 'created') result.flagsCreated++;
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
        if (result.settledAfterFailure.length) {
            const fired = await emit({
                kind: 'settled_after_failure',
                key: 'settled_after_failure',
                nowMs: nowMs,
                text: result.settledAfterFailure.length + ' refunded failed payout(s) show as settled in the wallet. Flagged for review; nothing was paid or reversed.',
                extra: { count: result.settledAfterFailure.length },
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
        settledAfterFailure: result.settledAfterFailure.length,
        failedRechecked: result.failedRechecked,
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
            lookupPayment: deps.lookupPayment,
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
    toMs: toMs,
    paidAtMsOf: paidAtMsOf,
    faucetCountsAsPaid: faucetCountsAsPaid,
    isDuplicateFaucetRow: isDuplicateFaucetRow,
    reconcile: reconcile,
    FAILED_RECHECK_MS: FAILED_RECHECK_MS,
    refundedFailure: refundedFailure,
    failuresToRecheck: failuresToRecheck,
    factory: factory,
    monthStartMs: monthStartMs,
};
