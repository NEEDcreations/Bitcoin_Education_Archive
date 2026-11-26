'use strict';

// One-tap 18+ confirmation. The client cannot write over18 / ageConfirmed18;
// only this callable sets them, with a server timestamp. Idempotent.
// Ads (PR #401 hasKnownAdultAge) already treats user.over18 === true as a
// known adult, so no ads-code change is required once this field is present.

function isAnonymous(context) {
    const token = (context && context.auth && context.auth.token) || {};
    const firebaseToken = token.firebase || {};
    return firebaseToken.sign_in_provider === 'anonymous';
}

function alreadyConfirmed(user) {
    const u = user || {};
    return u.over18 === true || u.ageConfirmed18 === true;
}

function isKidsAccount(user) {
    const u = user || {};
    if (u.isMinor === true || u.under13 === true) return true;
    const band = String(u.ageBand || u.age_band || '').toLowerCase();
    return band === 'under13' || band === 'minor' || band === 'child' || band === 'kids' || band === 'kid';
}

function createConfirmAge18Handlers(deps) {
    const options = deps || {};
    const db = options.db;
    const admin = options.admin;
    const HttpsError = options.HttpsError || function (code, message) {
        const err = new Error(message);
        err.code = code;
        return err;
    };

    function stamp() {
        if (admin && admin.firestore && admin.firestore.FieldValue && admin.firestore.FieldValue.serverTimestamp) {
            return admin.firestore.FieldValue.serverTimestamp();
        }
        return new Date();
    }

    async function confirmAge18(data, context) {
        if (!context || !context.auth || !context.auth.uid) {
            throw new HttpsError('unauthenticated', 'Must be signed in.');
        }
        if (isAnonymous(context)) {
            throw new HttpsError('permission-denied', 'Account required.');
        }

        const uid = context.auth.uid;
        const userRef = db.collection('users').doc(uid);
        const outcome = { already: false };

        await db.runTransaction(async function (t) {
            const snap = await t.get(userRef);
            const exists = !!(snap && snap.exists);
            const user = exists ? (snap.data() || {}) : {};

            if (isKidsAccount(user)) {
                throw new HttpsError('permission-denied', 'This account cannot confirm adult age.');
            }
            if (exists && alreadyConfirmed(user)) {
                outcome.already = true;
                return;
            }

            const now = stamp();
            const patch = {
                over18: true,
                ageConfirmed18: true
            };
            if (!user.over18ConfirmedAt) patch.over18ConfirmedAt = now;
            if (!user.ageConfirmed18At) patch.ageConfirmed18At = now;
            t.set(userRef, exists ? patch : Object.assign({ uid: uid }, patch), { merge: true });
        });

        return {
            success: true,
            over18: true,
            ageConfirmed18: true,
            already: outcome.already
        };
    }

    return {
        confirmAge18: confirmAge18,
        alreadyConfirmed: alreadyConfirmed,
        isKidsAccount: isKidsAccount
    };
}

function bindConfirmAge18(functionsV1, deps) {
    const handlers = createConfirmAge18Handlers(Object.assign({
        HttpsError: functionsV1.https.HttpsError
    }, deps || {}));
    const opts = { enforceAppCheck: true, timeoutSeconds: 30 };
    return {
        confirmAge18: functionsV1.runWith(opts).https.onCall(handlers.confirmAge18)
    };
}

module.exports = {
    createConfirmAge18Handlers: createConfirmAge18Handlers,
    bindConfirmAge18: bindConfirmAge18,
    alreadyConfirmed: alreadyConfirmed,
    isKidsAccount: isKidsAccount
};
