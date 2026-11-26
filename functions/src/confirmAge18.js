'use strict';

// One-tap 18+ confirmation. The client cannot write over18 / ageConfirmed18;
// only this callable sets them, with a server timestamp. Idempotent.
// Ads (PR #401 hasKnownAdultAge) already treats user.over18 === true as a
// known adult, so no ads-code change is required once this field is present.
// Never create a user doc here: a missing doc fails closed so sign-up can
// still create the profile. An admin un-confirm sets ageConfirmBlocked so
// the user cannot just confirm again.

const kidsAccount = require('../kids-account');

const THROTTLE_MS = 30000;
const AUDIT = 'admin_audit_log';
const THROTTLE = 'age_confirm_throttle';
const TARGET_UID = /^[A-Za-z0-9_-]{1,128}$/;

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

function isBlocked(user) {
    return !!(user && user.ageConfirmBlocked === true);
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
        return db.collection(THROTTLE).doc(uid);
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

    function throttleFields(uid, atMs, now) {
        return { uid: uid, lastAtMs: atMs, lastAt: now };
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
        const atMs = nowFn();
        const now = stamp();
        const outcome = { already: false, missing: false, kids: false, blocked: false, throttled: false };

        await db.runTransaction(async function (t) {
            const snap = await t.get(userRef);
            const tSnap = await t.get(throttleRef(uid));
            const tData = tSnap && tSnap.exists ? (tSnap.data() || {}) : null;

            if (!snap || !snap.exists) {
                if (tooSoon(tData)) {
                    outcome.throttled = true;
                    return;
                }
                outcome.missing = true;
                t.set(throttleRef(uid), throttleFields(uid, atMs, now), { merge: true });
                return;
            }

            const user = snap.data() || {};
            if (isBlocked(user)) {
                outcome.blocked = true;
                return;
            }
            if (alreadyConfirmed(user)) {
                outcome.already = true;
                return;
            }
            if (tooSoon(tData)) {
                outcome.throttled = true;
                return;
            }
            if (isKidsAccount(user)) {
                outcome.kids = true;
                t.set(throttleRef(uid), throttleFields(uid, atMs, now), { merge: true });
                return;
            }

            const patch = {
                over18: true,
                ageConfirmed18: true
            };
            if (!user.over18ConfirmedAt) patch.over18ConfirmedAt = now;
            if (!user.ageConfirmed18At) patch.ageConfirmed18At = now;
            t.set(userRef, patch, { merge: true });
            t.create(auditRef('confirm', uid, atMs), {
                action: 'age_confirm',
                uid: uid,
                at: now,
                atMs: atMs
            });
            t.set(throttleRef(uid), throttleFields(uid, atMs, now), { merge: true });
        });

        if (outcome.throttled) {
            throw new HttpsError('resource-exhausted', 'Please try again in a moment.');
        }
        if (outcome.blocked) {
            throw new HttpsError('permission-denied', 'This account cannot change its age confirmation.');
        }
        if (outcome.missing) {
            throw new HttpsError('failed-precondition', 'Account not found.');
        }
        if (outcome.kids) {
            throw new HttpsError('permission-denied', 'This account cannot confirm adult age.');
        }
        if (outcome.already) {
            return { success: true, over18: true, ageConfirmed18: true, already: true };
        }
        return { success: true, over18: true, ageConfirmed18: true, already: false };
    }

    async function adminUnconfirmAge18(data, context) {
        if (!context || !context.auth || !context.auth.token || context.auth.token.admin !== true) {
            throw new HttpsError('permission-denied', 'Admins only.');
        }

        const targetUid = String((data && data.uid) || '').trim();
        if (!TARGET_UID.test(targetUid)) {
            throw new HttpsError('invalid-argument', 'Enter the account id.');
        }

        await stepUp(data, context);

        const userRef = db.collection('users').doc(targetUid);
        const atMs = nowFn();
        const now = stamp();
        const del = deleted();
        const outcome = { missing: false };

        await db.runTransaction(async function (t) {
            const snap = await t.get(userRef);
            if (!snap || !snap.exists) {
                outcome.missing = true;
                return;
            }
            const user = snap.data() || {};
            t.set(userRef, {
                over18: del,
                over18ConfirmedAt: del,
                ageConfirmed18: del,
                ageConfirmed18At: del,
                ageConfirmBlocked: true
            }, { merge: true });
            t.create(auditRef('unconfirm', targetUid, atMs), {
                action: 'age_unconfirm',
                uid: targetUid,
                adminUid: context.auth.uid,
                at: now,
                atMs: atMs,
                over18ConfirmedAt: user.over18ConfirmedAt != null ? user.over18ConfirmedAt : null,
                ageConfirmed18At: user.ageConfirmed18At != null ? user.ageConfirmed18At : null
            });
        });

        if (outcome.missing) {
            throw new HttpsError('failed-precondition', 'Account not found.');
        }
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
    THROTTLE_MS: THROTTLE_MS,
    TARGET_UID: TARGET_UID
};
