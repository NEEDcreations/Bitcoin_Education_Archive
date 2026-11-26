'use strict';

// Faucet claim refund after a definite payment failure. Firestore is passed in
// so tests can run it against an in-memory store.

const payFailGuard = require('./payFailGuard');
const sitewideCaps = require('./sitewideCaps');

// Definite failure (nothing was sent), or an unconfirmed explicit refusal (refund only). One transaction, keyed on the
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
            const etDay = String((inv && inv.etDay) || info.etDay || '');
            const capsDailyRef = etDay ? sitewideCaps.dailyRef(db, etDay) : null;
            const capsDailySnap = capsDailyRef ? await t.get(capsDailyRef) : null;
            if (!inv || inv.status !== 'pending' || String(inv.uid || '') !== uid) {
                console.error('[FAUCET] release skipped, invoice not pending for uid=' + payFailGuard.maskUid(uid));
                out = { released: false, skipped: true, message: 'Payment failed. No sats were sent.' };
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
            // Without a release (cap reached, or an unconfirmed refusal) only the
            // balance is refunded: the claim count, the day's cap slot and the
            // cooldown all stay used.
            const confirmed = plan.release === true;
            const ledgerPatch = {
                satsWithdrawn: admin.firestore.FieldValue.increment(-amount),
                faucetFailGuard: plan.uidRow,
            };
            if (confirmed) ledgerPatch.claimCount = admin.firestore.FieldValue.increment(-1);
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
            if (confirmed) {
                t.set(dailyRef, { amount: admin.firestore.FieldValue.increment(-amount) }, { merge: true });
                t.set(globalRef, {
                    totalPaid: admin.firestore.FieldValue.increment(-amount),
                    claimCount: admin.firestore.FieldValue.increment(-1),
                }, { merge: true });
            }
            t.set(lnRateRef, ratePatch, { merge: true });
            // Failed claims are not paid, so always drop the reserved sitewide slot
            // on the original ET day. Held claims never come through this path.
            if (capsDailyRef) {
                const capDay = sitewideCaps.dayFromSnap(capsDailySnap);
                const released = sitewideCaps.planFaucetRelease(capDay.paid, capDay.reserved);
                t.set(capsDailyRef, {
                    paid: released.paid,
                    reserved: released.reserved,
                    held: capDay.held,
                    day: etDay,
                }, { merge: true });
            }
            // Keep the record (status failed) so this invoice can never be paid later.
            t.set(info.invoiceRef, {
                status: 'failed',
                released: plan.release,
                failKind: String(kind || ''),
                failedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            // Server-only audit row (collection is denied to clients by the catch-all rule).
            const entry = payFailGuard.auditEntry({
                path: 'faucet',
                claimId: info.invoiceRef.id,
                uid: uid,
                address: inv.address || info.address,
                kind: kind,
                plan: plan,
                nowMs: nowMs,
            });
            t.set(db.collection(payFailGuard.AUDIT_COLLECTION).doc(), Object.assign({}, entry, {
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }));
            out = { released: plan.release, message: plan.message, reasonClass: plan.reasonClass, audit: entry };
        });
        if (!out.skipped) console.log('[FAUCET] Failed claim refunded ' + amount + ' sats uid=' + payFailGuard.maskUid(uid) + ' released=' + out.released + ' reason=' + (out.reasonClass || ''));
    } catch (e) {
        console.error('[FAUCET] CRITICAL: failed-claim refund did not commit for ' + payFailGuard.maskUid(uid) + ', amount=' + amount + ':', e.message);
        out = { released: false, message: deps.supportError('Payment failed. No sats were sent.') };
    }
    return out;
}

// auditWithdrawals window. Failed (refunded) records are kept, so they are
// separated out page by page and can never push real payouts out of the window.
// fetchPage(afterDoc) returns an array of query document snapshots, newest first.
async function collectWithdrawalWindow(fetchPage, opts) {
    const o = opts || {};
    const want = o.want || 200;
    const maxPages = o.maxPages || 10;
    const out = { withdrawals: [], failed: [], scanned: 0, truncated: false };
    let after = null;
    for (let page = 0; page < maxPages; page++) {
        const docs = (await fetchPage(after)) || [];
        for (let i = 0; i < docs.length; i++) {
            const data = (typeof docs[i].data === 'function' ? docs[i].data() : docs[i].data) || {};
            out.scanned++;
            if (data.status === 'failed') out.failed.push(data);
            else if (out.withdrawals.length < want) out.withdrawals.push(data);
        }
        if (out.withdrawals.length >= want || docs.length === 0) return out;
        after = docs[docs.length - 1];
        if (page === maxPages - 1) out.truncated = true;
    }
    return out;
}

module.exports = { releaseFailedClaim: releaseFailedClaim, collectWithdrawalWindow: collectWithdrawalWindow };
