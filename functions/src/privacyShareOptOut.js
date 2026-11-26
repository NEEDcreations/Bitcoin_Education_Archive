'use strict';

// Account-level "Your Privacy Choices" opt-out. Written with the Admin SDK
// so firestore.rules do not need a new client-writable field. The client
// also stores the choice in localStorage and honors GPC without this
// callable, so ads still respect an opt-out if the function is not deployed.
//
// Uses update() (or a transaction) so a missing users/{uid} doc is never
// created as a partial profile. A merge-set here can break signup, because
// the later client write goes through the update rule and points is
// server-only.

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_PREFIX = 'privacy_share_optout_';

function createSetPrivacyShareOptOut(deps) {
    const options = deps || {};
    const db = options.db;
    const admin = options.admin;
    const nowFn = options.now || Date.now;
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

    function checkRateLimit(rateData, now) {
        const windowStart = rateData && rateData.windowStart ? Number(rateData.windowStart) : 0;
        const count = rateData && rateData.count ? Number(rateData.count) : 0;
        if (!windowStart || now - windowStart >= RATE_LIMIT_WINDOW_MS) {
            return { ok: true, windowStart: now, count: 1 };
        }
        if (count >= RATE_LIMIT_MAX) {
            return { ok: false };
        }
        return { ok: true, windowStart: windowStart, count: count + 1 };
    }

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
        const userRef = db.collection('users').doc(uid);
        const rateRef = db.collection('rate_limits').doc(RATE_LIMIT_PREFIX + uid);
        const now = nowFn();
        const fields = {
            privacyShareOptOut: data.optedOut,
            privacyShareOptOutAt: stamp()
        };

        if (typeof db.runTransaction === 'function') {
            await db.runTransaction(async function (tx) {
                const userSnap = await tx.get(userRef);
                if (!userSnap || !userSnap.exists) {
                    throw new HttpsError('failed-precondition', 'Account not found.');
                }
                const rateSnap = await tx.get(rateRef);
                const rateData = rateSnap && rateSnap.exists && typeof rateSnap.data === 'function'
                    ? rateSnap.data()
                    : null;
                const next = checkRateLimit(rateData, now);
                if (!next.ok) {
                    throw new HttpsError('resource-exhausted', 'Too many privacy choice changes. Try again in a minute.');
                }
                tx.update(userRef, fields);
                tx.set(rateRef, { windowStart: next.windowStart, count: next.count }, { merge: true });
            });
        } else {
            // Tests or a thin Admin stub without transactions still must not
            // merge-set a missing user doc.
            if (typeof userRef.get !== 'function' || typeof userRef.update !== 'function') {
                throw new HttpsError('internal', 'Database unavailable.');
            }
            const userSnap = await userRef.get();
            if (!userSnap || !userSnap.exists) {
                throw new HttpsError('failed-precondition', 'Account not found.');
            }
            if (typeof rateRef.get === 'function') {
                const rateSnap = await rateRef.get();
                const rateData = rateSnap && rateSnap.exists && typeof rateSnap.data === 'function'
                    ? rateSnap.data()
                    : null;
                const next = checkRateLimit(rateData, now);
                if (!next.ok) {
                    throw new HttpsError('resource-exhausted', 'Too many privacy choice changes. Try again in a minute.');
                }
                if (typeof rateRef.set === 'function') {
                    await rateRef.set({ windowStart: next.windowStart, count: next.count }, { merge: true });
                }
            }
            await userRef.update(fields);
        }
        return { ok: true, optedOut: data.optedOut };
    }

    return { setPrivacyShareOptOut };
}

function bindPrivacyShareOptOut(functionsV1, deps) {
    const handlers = createSetPrivacyShareOptOut(deps);
    if (!functionsV1 || typeof functionsV1.runWith !== 'function') {
        throw new Error('functionsV1.runWith is required so App Check stays on.');
    }
    return {
        setPrivacyShareOptOut: functionsV1.runWith({ enforceAppCheck: true }).https.onCall(handlers.setPrivacyShareOptOut),
        handlers: handlers
    };
}

module.exports = {
    createSetPrivacyShareOptOut,
    bindPrivacyShareOptOut,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS
};
