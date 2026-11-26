'use strict';

// One-tap 18+ confirmation. The client cannot write over18 / ageConfirmed18;
// only this callable sets them, with a server timestamp. Idempotent.
// Ads (PR #401 hasKnownAdultAge) already treats user.over18 === true as a
// known adult, so no ads-code change is required once this field is present.
// Never create a user doc here: a missing doc fails closed so sign-up can
// still create the profile.

const kidsAccount = require('../kids-account');

const THROTTLE_MS = 30000;
const AUDIT = 'admin_audit_log';

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
    return kidsAccount.isKidsAccount(user);
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
    const throttleMs = options.throttleMs == null ? THROTTLE_MS : options.throttleMs;
    const nowFn = options.now || Date.now;
    const stepUp = options.stepUp || async function (data, context) {
        const sf = require('./secondFactor');
        return sf.requireAdminStepUp(sf.stamp(data, context), 'adminUnconfirmAge18');
    };

    function stamp() {
        if (admin && admin.firestore && admin.firestore.FieldValue && admin.firestore.FieldValue.serverTimestamp) {
            return admin.firestore.FieldValue.serverTimestamp();
        }
        return new Date();
    }

    function deleted() {
        if (admin && admin.firestore && admin.firestore.FieldValue && admin.firestore.FieldValue.delete) {
            return admin.firestore.FieldValue.delete();
        }
        return { _delete: true };
    }

    function throttleRef(uid) {
        return db.collection(AUDIT).doc('age18_throttle_' + uid);
    }

    function auditRef(kind, uid, ms) {
        return db.collection(AUDIT).doc('age18_' + kind + '_' + uid + '_' + ms);
    }

    function tooSoon(data) {
        if (!data) return false;
        const last = typeof data.lastAtMs === 'number' ? data.lastAtMs : 0;
        if (!last) return false;
        return (nowFn() - last) < throttleMs;
    }

    async function writeThrottle(uid, atMs) {
        await throttleRef(uid).set({ uid: uid, lastAtMs: atMs, lastAt: stamp() }, { merge: true });
    }

    async function writeAudit(kind, uid, extra, atMs) {
        const row = Object.assign({
            action: kind === 'unconfirm' ? 'age_unconfirm' : 'age_confirm',
            uid: uid,
            at: stamp(),
            atMs: atMs
        }, extra || {});
        try {
            await auditRef(kind, uid, atMs).set(row);
        } catch (e) { /* audit is best-effort and has no PII beyond uid */ }
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
        // Idempotent success is never throttled, so a double-tap after a
        // confirmed write still returns already.
        const prior = await userRef.get();
        if (prior && prior.exists && alreadyConfirmed(prior.data() || {})) {
            return { success: true, over18: true, ageConfirmed18: true, already: true };
        }

        const tSnap = await throttleRef(uid).get();
        const tData = tSnap && tSnap.exists ? (tSnap.data() || {}) : null;
        if (tooSoon(tData)) {
            throw new HttpsError('resource-exhausted', 'Please try again in a moment.');
        }

        const outcome = { already: false, missing: false, kids: false };
        await db.runTransaction(async function (t) {
            const snap = await t.get(userRef);
            if (!snap || !snap.exists) {
                outcome.missing = true;
                return;
            }
            const user = snap.data() || {};
            if (isKidsAccount(user)) {
                outcome.kids = true;
                return;
            }
            if (alreadyConfirmed(user)) {
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
            t.set(userRef, patch, { merge: true });
        });

        const atMs = nowFn();
        if (outcome.missing) {
            await writeThrottle(uid, atMs);
            throw new HttpsError('failed-precondition', 'Account not found.');
        }
        if (outcome.kids) {
            await writeThrottle(uid, atMs);
            throw new HttpsError('permission-denied', 'This account cannot confirm adult age.');
        }
        if (outcome.already) {
            return { success: true, over18: true, ageConfirmed18: true, already: true };
        }

        await writeThrottle(uid, atMs);
        await writeAudit('confirm', uid, null, atMs);
        return { success: true, over18: true, ageConfirmed18: true, already: false };
    }

    async function adminUnconfirmAge18(data, context) {
        if (!context || !context.auth || !context.auth.token || context.auth.token.admin !== true) {
            throw new HttpsError('permission-denied', 'Admins only.');
        }
        await stepUp(data, context);

        const targetUid = String((data && data.uid) || '').trim();
        if (!targetUid) {
            throw new HttpsError('invalid-argument', 'Enter the account id.');
        }

        const userRef = db.collection('users').doc(targetUid);
        const snap = await userRef.get();
        if (!snap || !snap.exists) {
            throw new HttpsError('failed-precondition', 'Account not found.');
        }

        const del = deleted();
        await userRef.set({
            over18: del,
            over18ConfirmedAt: del,
            ageConfirmed18: del,
            ageConfirmed18At: del
        }, { merge: true });

        const atMs = nowFn();
        await writeAudit('unconfirm', targetUid, { adminUid: context.auth.uid }, atMs);
        return { success: true, over18: false, uid: targetUid };
    }

    return {
        confirmAge18: confirmAge18,
        adminUnconfirmAge18: adminUnconfirmAge18,
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
        confirmAge18: functionsV1.runWith(opts).https.onCall(handlers.confirmAge18),
        adminUnconfirmAge18: functionsV1.runWith(opts).https.onCall(handlers.adminUnconfirmAge18)
    };
}

module.exports = {
    createConfirmAge18Handlers: createConfirmAge18Handlers,
    bindConfirmAge18: bindConfirmAge18,
    alreadyConfirmed: alreadyConfirmed,
    isKidsAccount: isKidsAccount,
    THROTTLE_MS: THROTTLE_MS
};
