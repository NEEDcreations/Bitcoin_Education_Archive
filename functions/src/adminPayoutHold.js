'use strict';

const functionsV1 = require('firebase-functions/v1');
const admin = require('./firebaseAdmin.js');
const { runtimeSa } = require('./runtimeServiceAccounts');

const db = admin.firestore();

// Admin Clear Hold button (Settings > Account > Payout holds). Clears the
// global payout_safety/hold satsHold and/or cipherHold before their 30-day
// expiry. Admin claim only (no address allowlist), App Check, second factor when the
// admin has one enrolled, a typed confirm phrase, and a permanent
// payout_safety_audit row. Sends nothing; payouts resume on the next claim,
// and every per-claim guard still runs.
const adminClearPayoutHold = functionsV1.runWith({
    enforceAppCheck: true,
    timeoutSeconds: 30,
    serviceAccount: runtimeSa('adminClearPayoutHold'),
}).https.onCall(async (data, context) => {
    if (!context.auth) throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    if (!context.auth.token || context.auth.token.admin !== true) {
        throw new functionsV1.https.HttpsError('permission-denied', 'Admin only');
    }
    const secondFactor = require('./secondFactor');
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    const payoutSafety = require('./payoutSafety');
    const which = String((data && data.which) || '').trim();
    if (!Object.prototype.hasOwnProperty.call(payoutSafety.CLEAR_TARGETS, which)) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Unknown hold');
    }
    if (String((data && data.confirm) || '') !== payoutSafety.confirmPhrase(which)) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Confirm phrase does not match');
    }
    const plan = await payoutSafety.clearHold(db, admin, {
        which: which,
        adminUid: context.auth.uid,
        note: String((data && data.note) || ''),
    });
    if (!plan || !plan.ok) throw new functionsV1.https.HttpsError('invalid-argument', 'Unknown hold');
    return { ok: true, cleared: plan.cleared };
});

module.exports = { adminClearPayoutHold: adminClearPayoutHold };
