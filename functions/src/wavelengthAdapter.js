'use strict';
// Wavelength payout adapter. Feature-flagged, default off (see payoutRail.js).
// Uses the official prepare-send then send flow. The HTTP client is injected
// so tests never touch the network. Ledger collections (wl_payouts, wl_float,
// wl_address_changes) are append-only: docs are created, never deleted.
//
// Approved limits live in wavelengthLimits.js. The Lightning fee uses the
// same lnFee.quote(gross) as the NWC paths. A payment whose net does not
// match the prepared amount, or whose expected fee is over the fee ceiling,
// is refused and not sent.

const lnFee = require('./lnFee');
const { readLimits } = require('./wavelengthLimits');
const payoutRail = require('./payoutRail');
const payoutAlerts = (function () {
    try { return require('./payoutAlerts'); } catch (e) { return null; }
})();

const LEDGER = Object.freeze({
    payouts: 'wl_payouts',
    float: 'wl_float',
    addressChanges: 'wl_address_changes',
});

class WavelengthRefuse extends Error {
    constructor(code, extra) {
        super(code);
        this.code = code;
        this.extra = extra || {};
    }
}

function destKey(dest) {
    return String(dest || '').trim().toLowerCase().slice(0, 200);
}

function inWindow(atMs, nowMs, windowMs) {
    const t = Number(atMs) || 0;
    return t > 0 && (nowMs - t) >= 0 && (nowMs - t) < windowMs;
}

function sumLedger(rows, nowMs, windowMs, dest) {
    let total = 0;
    (rows || []).forEach(function (row) {
        const d = row.data || row;
        if (d.status && d.status !== 'paid' && d.status !== 'prepared' && d.status !== 'pending_approval') return;
        // pending_approval and prepared still occupy the cap until they expire or fail.
        if (d.status === 'failed' || d.status === 'refused') return;
        if (!inWindow(d.atMs, nowMs, windowMs)) return;
        if (dest && destKey(d.dest) !== destKey(dest)) return;
        const n = Math.floor(Number(d.grossSats || d.amountSats || 0));
        if (n > 0) total += n;
    });
    return total;
}

async function listCol(db, name) {
    const snap = await db.collection(name).get();
    return (snap.docs || []).map(function (d) {
        return { id: d.id, data: (typeof d.data === 'function' ? d.data() : d.data) || {} };
    });
}

function createAdapter(deps) {
    const db = deps.db;
    const now = deps.nowMs || Date.now;
    const client = deps.client;
    if (!client || typeof client.prepareSend !== 'function' || typeof client.send !== 'function') {
        throw new Error('wavelength client required');
    }

    async function emit(kind, text, extra) {
        const payload = { kind: kind, key: kind, text: text, extra: extra || {}, nowMs: now() };
        try {
            if (typeof deps.emitAlert === 'function') await deps.emitAlert(payload);
            else if (payoutAlerts) await payoutAlerts.emit({ db: db, admin: deps.admin }, payload);
        } catch (e) { /* alerts are best-effort */ }
    }

    async function recordFloat(balanceSats, reason) {
        const id = 'float_' + now() + '_' + Math.floor(Math.random() * 1e6);
        try {
            await db.collection(LEDGER.float).doc(id).create({
                atMs: now(), balanceSats: balanceSats, reason: reason || 'check',
            });
        } catch (e) { /* snapshot is best-effort; payments do not depend on it */ }
    }

    async function checkLimits(req, limits, ledger) {
        const gross = Math.floor(Number(req.grossSats) || 0);
        if (gross <= 0) throw new WavelengthRefuse('bad_amount');
        if (gross > limits.perTxSats) throw new WavelengthRefuse('per_tx_cap', { cap: limits.perTxSats });
        const dayUsed = sumLedger(ledger, now(), 24 * 3600 * 1000, null);
        if (dayUsed + gross > limits.perDaySats) throw new WavelengthRefuse('per_day_cap', { used: dayUsed, cap: limits.perDaySats });
        if (req.dest) {
            const destUsed = sumLedger(ledger, now(), 24 * 3600 * 1000, req.dest);
            if (destUsed + gross > limits.perDest24hSats) throw new WavelengthRefuse('per_dest_cap', { used: destUsed, cap: limits.perDest24hSats });
            const lastChange = Number(req.addressChangedAtMs) || 0;
            if (lastChange && (now() - lastChange) < limits.addressCooldownMs) {
                throw new WavelengthRefuse('address_cooldown', { remainingMs: limits.addressCooldownMs - (now() - lastChange) });
            }
        }
        return { dayUsed: dayUsed };
    }

    async function pay(req) {
        const cfg = Object.assign({}, deps.config || {}, req.config || {});
        if (!payoutRail.isWavelength(cfg)) {
            return { ok: false, code: 'rail_off' };
        }
        const limits = readLimits(cfg);
        const gross = Math.floor(Number(req.grossSats) || 0);
        const quote = lnFee.quote(gross);
        if (!quote.ok) return { ok: false, code: 'fee_too_big', error: quote.error };
        const invoice = String(req.invoice || '');
        if (!invoice) return { ok: false, code: 'bad_invoice' };

        const ledger = await listCol(db, LEDGER.payouts);
        try {
            await checkLimits(Object.assign({}, req, { grossSats: gross }), limits, ledger);
        } catch (e) {
            if (e instanceof WavelengthRefuse) return { ok: false, code: e.code, extra: e.extra };
            throw e;
        }

        let balanceSats = null;
        if (typeof client.getBalance === 'function') {
            const bal = await client.getBalance();
            const raw = bal && (bal.balanceSats != null ? bal.balanceSats : (Number(bal.balance) >= 1000 ? Math.floor(Number(bal.balance) / 1000) : Number(bal.balance)));
            if (Number.isFinite(Number(raw))) balanceSats = Math.floor(Number(raw));
        }
        if (balanceSats != null) {
            await recordFloat(balanceSats, 'pre_pay');
            if (balanceSats < quote.net) return { ok: false, code: 'wallet_low', balanceSats: balanceSats };
            if (balanceSats < limits.refillUnderSats) {
                await emit('budget_nearing', 'Wavelength hot float is under ' + limits.refillUnderSats + ' sats (' + balanceSats + '). Refill from cold storage.', { balanceSats: balanceSats });
            }
        }

        if (req.addressChangedAtMs && (now() - Number(req.addressChangedAtMs)) < limits.addressAlertMs) {
            await emit('address_change', 'Wavelength payout is within 72 hours of an address change.', { uidMasked: req.uidMasked || null });
        }
        if (gross >= limits.alertSats) {
            await emit('cap_hit', 'Wavelength payout of ' + gross + ' sats is at or above the alert threshold.', { grossSats: gross });
        }
        if (gross >= limits.philApproveSats) {
            const id = String(req.idempotencyKey || ('need_' + now() + '_' + Math.floor(Math.random() * 1e6)));
            await db.collection(LEDGER.payouts).doc(id).create({
                atMs: now(), status: 'pending_approval', grossSats: gross, netSats: quote.net,
                feeCharged: quote.fee, dest: destKey(req.dest), uidMasked: req.uidMasked || null,
                source: req.source || 'unknown',
            });
            return { ok: false, code: 'needs_approval', payoutId: id, grossSats: gross };
        }

        const prepared = await client.prepareSend({
            invoice: invoice,
            max_fee_sat: String(lnFee.LN_FEE_SATS),
        });
        const amountSat = Math.floor(Number(prepared && (prepared.amount_sat != null ? prepared.amount_sat : prepared.amountSat)) || 0);
        const expectedFee = Math.floor(Number(prepared && (prepared.expected_fee_sat != null ? prepared.expected_fee_sat : prepared.expectedFeeSat)) || 0);
        const intentId = prepared && (prepared.send_intent_id || prepared.sendIntentId);
        const paymentHash = prepared && (prepared.payment_hash || prepared.paymentHash) || '';
        if (!intentId) return { ok: false, code: 'prepare_failed' };
        if (amountSat !== quote.net) return { ok: false, code: 'amount_mismatch', expected: quote.net, got: amountSat };
        if (expectedFee > lnFee.LN_FEE_SATS) return { ok: false, code: 'fee_over_cap', expectedFeeSat: expectedFee };

        const payoutId = String(req.idempotencyKey || intentId);
        try {
            await db.collection(LEDGER.payouts).doc(payoutId).create({
                atMs: now(),
                status: 'prepared',
                grossSats: gross,
                netSats: quote.net,
                feeCharged: quote.fee,
                expectedFeeSat: expectedFee,
                sendIntentId: String(intentId),
                paymentHash: String(paymentHash),
                dest: destKey(req.dest),
                uidMasked: req.uidMasked || null,
                source: req.source || 'unknown',
            });
        } catch (e) {
            return { ok: false, code: 'duplicate' };
        }

        let sent;
        try {
            sent = await client.send({ send_intent_id: String(intentId) });
        } catch (e) {
            await db.collection(LEDGER.payouts).doc(payoutId).set({ status: 'unknown', unknownAtMs: now() }, { merge: true });
            return { ok: false, code: 'unknown', payoutId: payoutId };
        }
        const ok = sent && (sent.ok === true || sent.status === 'paid' || sent.preimage || sent.payment_preimage);
        if (!ok) {
            await db.collection(LEDGER.payouts).doc(payoutId).set({ status: 'unknown', unknownAtMs: now() }, { merge: true });
            return { ok: false, code: 'unknown', payoutId: payoutId };
        }
        await db.collection(LEDGER.payouts).doc(payoutId).set({
            status: 'paid',
            paidAtMs: now(),
            preimageHash: sent.preimageHash || null,
            feePaidSat: sent.fee_paid_sat != null ? Number(sent.fee_paid_sat) : (sent.feePaidSat != null ? Number(sent.feePaidSat) : expectedFee),
        }, { merge: true });
        return {
            ok: true,
            payoutId: payoutId,
            amount: gross,
            sent: quote.net,
            fee: quote.fee,
            paymentHash: String(paymentHash),
            sendIntentId: String(intentId),
        };
    }

    async function recordAddressChange(row) {
        const id = String(row.id || ('chg_' + now() + '_' + Math.floor(Math.random() * 1e6)));
        await db.collection(LEDGER.addressChanges).doc(id).create({
            atMs: now(),
            uidMasked: row.uidMasked || null,
            // Previous and next destinations are stored only as a short hash so
            // the append-only history does not become a plaintext address log.
            destHash: row.destHash || null,
        });
        return { ok: true, id: id };
    }

    return { pay: pay, recordAddressChange: recordAddressChange, limits: readLimits(deps.config), LEDGER: LEDGER };
}

function createMockClient(handlers) {
    const h = handlers || {};
    return {
        prepareSend: h.prepareSend || async function (req) {
            return {
                send_intent_id: 'intent_test',
                amount_sat: h.amountSat != null ? h.amountSat : 0,
                expected_fee_sat: h.expectedFeeSat != null ? h.expectedFeeSat : 1,
                payment_hash: h.paymentHash || 'ab'.repeat(16),
                fee_known: true,
            };
        },
        send: h.send || async function () {
            return { ok: true, status: 'paid', preimage: 'cd'.repeat(16) };
        },
        getBalance: h.getBalance || async function () {
            return { balanceSats: h.balanceSats != null ? h.balanceSats : 15000 };
        },
    };
}

module.exports = {
    LEDGER: LEDGER,
    WavelengthRefuse: WavelengthRefuse,
    createAdapter: createAdapter,
    createMockClient: createMockClient,
    destKey: destKey,
    sumLedger: sumLedger,
};
