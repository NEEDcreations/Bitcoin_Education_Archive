'use strict';

// Account-level "Your Privacy Choices" opt-out. Written with the Admin SDK
// so firestore.rules do not need a new client-writable field. The client
// also stores the choice in localStorage and honors GPC without this
// callable, so ads still respect an opt-out if the function is not deployed.

function createSetPrivacyShareOptOut(deps) {
    const options = deps || {};
    const db = options.db;
    const admin = options.admin;
    const HttpsError = options.HttpsError || function (code, message) {
        const err = new Error(message);
        err.code = code;
        return err;
    };

    async function setPrivacyShareOptOut(data, context) {
        if (!context || !context.auth || !context.auth.uid) {
            throw new HttpsError('unauthenticated', 'Must be signed in.');
        }
        const token = context.auth.token || {};
        const firebaseToken = token.firebase || {};
        if (firebaseToken.sign_in_provider === 'anonymous') {
            throw new HttpsError('permission-denied', 'Account required.');
        }
        if (!data || typeof data.optedOut !== 'boolean') {
            throw new HttpsError('invalid-argument', 'optedOut must be a boolean.');
        }
        if (!db || !db.collection) {
            throw new HttpsError('internal', 'Database unavailable.');
        }
        const uid = String(context.auth.uid);
        const stamp = (admin && admin.firestore && admin.firestore.FieldValue && admin.firestore.FieldValue.serverTimestamp)
            ? admin.firestore.FieldValue.serverTimestamp()
            : new Date();
        await db.collection('users').doc(uid).set({
            privacyShareOptOut: data.optedOut,
            privacyShareOptOutAt: stamp
        }, { merge: true });
        return { ok: true, optedOut: data.optedOut };
    }

    return { setPrivacyShareOptOut };
}

function bindPrivacyShareOptOut(functionsV1, deps) {
    const handlers = createSetPrivacyShareOptOut(deps);
    return {
        setPrivacyShareOptOut: functionsV1.https.onCall(handlers.setPrivacyShareOptOut),
        handlers: handlers
    };
}

module.exports = {
    createSetPrivacyShareOptOut,
    bindPrivacyShareOptOut
};
