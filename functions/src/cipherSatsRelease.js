'use strict';

// Cipher sats claim after a definite payment failure (nothing was sent), or an
// explicit refusal the wallet lookup could not confirm ('unconfirmed', refund only).
// Firestore is passed in so tests can run it against an in-memory store.
//
// One transaction, keyed on the claim's audit record and its in-flight lock:
// - it applies only to a claim that is still 'paying' and still owns the lock,
//   so a second call, or a claim already paid or held, changes nothing
// - the balance always comes back
// - the day's limit comes back only while the uid and the address are under
//   the released-failure cap (payFailGuard); past it the day stays used
// Unknown or pending payments never come here; they stay held.

const faucetGuard = require('./faucetGuard');
const payFailGuard = require('./payFailGuard');
const { lockOwnedByClaim } = require('./cipherSatsClaim');

async function failCipherClaim(deps, reserved, kind) {
    const db = deps.db;
    const admin = deps.admin;
    const FieldValue = admin.firestore.FieldValue;
    const lockRef = db.collection('cipher_sats_locks').doc(reserved.lockId);
    const auditRef = db.collection('cipher_sats_payouts').doc(reserved.claimId);
    const userRef = db.collection('users').doc(reserved.uid);
    const playerRef = db.collection('cipher_sats_player_daily').doc(reserved.playerDayId);
    const siteRef = db.collection('cipher_sats_site_daily').doc(reserved.day);
    const ledgerRef = db.collection('faucet_ledger').doc(reserved.uid);
    const addrRateRef = db.collection('faucet_ln_ratelimit').doc(faucetGuard.addressRateDocId(reserved.address || ''));
    let result = { applied: false, released: false, message: '' };
    await db.runTransaction(async (t) => {
        result = { applied: false, released: false, message: '' };
        const auditSnap = await t.get(auditRef);
        const lockSnap = await t.get(lockRef);
        const ledgerSnap = await t.get(ledgerRef);
        const addrRateSnap = await t.get(addrRateRef);
        const audit = auditSnap.exists ? (auditSnap.data() || {}) : {};
        const lock = lockSnap.exists ? (lockSnap.data() || {}) : null;
        if (String(audit.status || '') !== 'paying') return;
        if (!lockOwnedByClaim(lock, reserved.claimId)) return;
        const nowMs = Date.now();
        const plan = payFailGuard.planRelease({
            kind: kind,
            nowMs: nowMs,
            uidRow: ledgerSnap.exists ? (ledgerSnap.data() || {}).cipherFailGuard : null,
            addrRow: addrRateSnap.exists ? (addrRateSnap.data() || {}).cipherFailGuard : null,
        });
        t.update(userRef, { cipherSatsBalance: FieldValue.increment(reserved.amount) });
        if (plan.release) {
            t.set(playerRef, { amount: FieldValue.increment(-reserved.amount) }, { merge: true });
        }
        // Without a release (cap reached, or an unconfirmed refusal) only the
        // balance comes back; both day totals stay used.
        if (plan.release) {
            t.set(siteRef, { amount: FieldValue.increment(-reserved.amount) }, { merge: true });
        }
        t.set(ledgerRef, { cipherFailGuard: plan.uidRow }, { merge: true });
        t.set(addrRateRef, { cipherFailGuard: plan.addrRow }, { merge: true });
        t.set(auditRef, {
            status: 'restored',
            restoredAt: FieldValue.serverTimestamp(),
            failed: true,
            released: plan.release,
            failKind: String(kind || ''),
        }, { merge: true });
        t.delete(lockRef);
        // Server-only audit row (collection is denied to clients by the catch-all rule).
        const entry = payFailGuard.auditEntry({
            path: 'cipher',
            claimId: reserved.claimId,
            uid: reserved.uid,
            address: reserved.address,
            kind: kind,
            plan: plan,
            nowMs: nowMs,
        });
        t.set(db.collection(payFailGuard.AUDIT_COLLECTION).doc(), Object.assign({}, entry, {
            createdAt: FieldValue.serverTimestamp(),
        }));
        result = { applied: true, released: plan.release, message: plan.message, reasonClass: plan.reasonClass, audit: entry };
    });
    if (result.applied) {
        console.log('[claimCipherSats] failed claim restored uid=' + payFailGuard.maskUid(reserved.uid) + ' released=' + result.released + ' reason=' + result.reasonClass);
    }
    return result;
}

module.exports = { failCipherClaim: failCipherClaim };
