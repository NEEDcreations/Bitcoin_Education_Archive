'use strict';

// Owner-only acknowledgement of the one-time backfill badge toast.
// The body is ignored. This deletes users/{uid}.badgeBackfillToast.

const functionsV1 = require('firebase-functions/v1');
const admin = require('firebase-admin');
const ack = require('./src/ackBadgeBackfill');

const db = admin.firestore();

const ackBadgeBackfillToast = functionsV1.runWith({
    enforceAppCheck: true,
}).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const provider = context.auth.token && context.auth.token.firebase
        ? context.auth.token.firebase.sign_in_provider
        : '';
    if (provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Sign in required');
    }
    void data;
    const ref = db.collection('users').doc(context.auth.uid);
    const snap = await ref.get();
    if (!snap.exists) return { ok: true, cleared: false };
    const plan = ack.planAck(snap.data() || {});
    if (!plan.clear) return { ok: true, cleared: false };
    await ref.update({
        badgeBackfillToast: admin.firestore.FieldValue.delete(),
    });
    return { ok: true, cleared: true };
});

module.exports = {
    ackBadgeBackfillToast: ackBadgeBackfillToast,
};
