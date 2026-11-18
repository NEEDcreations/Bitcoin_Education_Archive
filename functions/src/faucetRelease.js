'use strict';

// Faucet claim refund after a definite payment failure. Firestore is passed in
// so tests can run it against an in-memory store.

const payFailGuard = require('./payFailGuard');

// Definite failure only (nothing was sent). One transaction, keyed on the
// pending invoice record, so a second call for the same claim does nothing.
// Always refunds the reserved points and caps. The daily claim (cooldown,
// address slot) goes back only while the uid and the address are under the
// released-failure cap. Unknown or pending payments never come here.
async function releaseFailedClaim(deps, info, today, lnRateRef, kind) {
    const db = deps.db;
    const admin = deps.admin;
    const uid = info.uid;
    const amount = info.amount;
    const ledgerRef = db.collection('faucet_ledger').doc(uid);
    const dailyRef = info.userRef.collection('sats_daily').doc(today);
    const globalRef = db.collection('faucet_stats').doc(today);
    let out = { released: false, message: 'Payment failed. No sats were sent.' };
    try {
        await db.runTransaction(async (t) => {
            const invoiceSnap = await t.get(info.invoiceRef);
            const ledgerSnap = await t.get(ledgerRef);
            const rateSnap = await t.get(lnRateRef);
            const inv = invoiceSnap.exists ? (invoiceSnap.data() || {}) : null;
            if (!inv || inv.status !== 'pending' || String(inv.uid || '') !== uid) {
                console.error('[FAUCET] release skipped, invoice not pending for uid=' + uid);
                out = { released: false, message: 'Payment failed. No sats were sent.' };
                return;
            }
            const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
            const rate = rateSnap.exists ? (rateSnap.data() || {}) : {};
            const nowMs = Date.now();
            const plan = payFailGuard.planRelease({
                kind: kind,
                nowMs: nowMs,
                uidRow: ledger.faucetFailGuard,
                addrRow: rate.faucetFailGuard,
            });
            const pointsToRefund = amount * deps.pointsPerSat;
            const userPatch = {
                pointsClaimed: admin.firestore.FieldValue.increment(-pointsToRefund),
                satsWithdrawn: admin.firestore.FieldValue.increment(-amount),
                _pendingClaim: admin.firestore.FieldValue.delete(),
                _pendingClaimAt: admin.firestore.FieldValue.delete(),
            };
            const ledgerPatch = {
                satsWithdrawn: admin.firestore.FieldValue.increment(-amount),
                claimCount: admin.firestore.FieldValue.increment(-1),
                faucetFailGuard: plan.uidRow,
            };
            const ratePatch = { faucetFailGuard: plan.addrRow };
            if (plan.release) {
                const priorUser = Number(inv.priorUserLastMs) || 0;
                const priorLedger = Number(inv.priorLedgerLastMs) || 0;
                userPatch.lastSatsClaim = priorUser ? admin.firestore.Timestamp.fromMillis(priorUser) : admin.firestore.FieldValue.delete();
                ledgerPatch.lastSatsClaim = priorLedger ? admin.firestore.Timestamp.fromMillis(priorLedger) : admin.firestore.FieldValue.delete();
                const entryTs = Number(inv.rateEntryTs) || 0;
                const claims = Array.isArray(rate.claims) ? rate.claims : [];
                ratePatch.claims = claims.filter(function(c) {
                    return !(c && String(c.uid || '') === uid && Number(c.ts) === entryTs);
                });
            }
            t.update(info.userRef, userPatch);
            t.set(ledgerRef, ledgerPatch, { merge: true });
            t.set(dailyRef, { amount: admin.firestore.FieldValue.increment(-amount) }, { merge: true });
            t.set(globalRef, {
                totalPaid: admin.firestore.FieldValue.increment(-amount),
                claimCount: admin.firestore.FieldValue.increment(-1),
            }, { merge: true });
            t.set(lnRateRef, ratePatch, { merge: true });
            // Keep the record (status failed) so this invoice can never be paid later.
            t.set(info.invoiceRef, {
                status: 'failed',
                released: plan.release,
                failKind: String(kind || ''),
                failedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            out = { released: plan.release, message: plan.message };
        });
        console.log('[FAUCET] Failed claim refunded ' + amount + ' sats uid=' + uid + ' released=' + out.released);
    } catch (e) {
        console.error('[FAUCET] CRITICAL: failed-claim refund did not commit for ' + uid + ', amount=' + amount + ':', e.message);
        out = { released: false, message: deps.supportError('Payment failed. No sats were sent.') };
    }
    return out;
}

module.exports = { releaseFailedClaim: releaseFailedClaim };
