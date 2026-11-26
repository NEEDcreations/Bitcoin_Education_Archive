'use strict';

// Two-button age confirmation. The client cannot write over18 /
// ageConfirmed18 / ageUnder18; only these callables set them, with a
// server timestamp. Idempotent. Ads (PR #401 hasKnownAdultAge) already
// treats user.over18 === true as a known adult, so under-18 and
// unanswered users stay ad-free. Never create a user doc here: a missing
// doc fails closed so sign-up can still create the profile. An admin
// un-confirm sets ageConfirmBlocked so the user cannot just confirm
// again. A saved under-18 answer also blocks self-confirm; only an admin
// reset (step-up) clears it so the prompt can be shown again.

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

function alreadyUnder18(user) {
    return !!(user && user.ageUnder18 === true);
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
    const stepUp = options.stepUp || async function (data, context, action) {
        const sf = require('./secondFactor');
        return sf.requireAdminStepUp(sf.stamp(data, context), action || 'adminUnconfirmAge18');
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

    function requireSignedIn(context) {
        if (!context || !context.auth || !context.auth.uid) {
            throw new HttpsError('unauthenticated', 'Must be signed in.');
        }
        if (isAnonymous(context)) {
            throw new HttpsError('permission-denied', 'Account required.');
        }
        return context.auth.uid;
    }

    function priorAuditFields(user, adminUid, now, atMs) {
        const u = user || {};
        return {
            uid: null,
            adminUid: adminUid,
            at: now,
            atMs: atMs,
            over18ConfirmedAt: u.over18ConfirmedAt != null ? u.over18ConfirmedAt : null,
            ageConfirmed18At: u.ageConfirmed18At != null ? u.ageConfirmed18At : null,
            ageUnder18At: u.ageUnder18At != null ? u.ageUnder18At : null,
            over18: u.over18 === true,
            ageConfirmed18: u.ageConfirmed18 === true,
            ageUnder18: u.ageUnder18 === true,
            ageConfirmBlocked: u.ageConfirmBlocked === true
        };
    }

    function clearAgeFields(del) {
        return {
            over18: del,
            over18ConfirmedAt: del,
            ageConfirmed18: del,
            ageConfirmed18At: del,
            ageUnder18: del,
            ageUnder18At: del
        };
    }

    async function confirmAge18(data, context) {
        const uid = requireSignedIn(context);
        const userRef = db.collection('users').doc(uid);
        const atMs = nowFn();
        const now = stamp();
        const outcome = { already: false, missing: false, kids: false, blocked: false, under18: false, throttled: false };

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
            if (isBlocked(user) || alreadyUnder18(user)) {
                outcome.blocked = isBlocked(user);
                outcome.under18 = alreadyUnder18(user);
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
        if (outcome.blocked || outcome.under18) {
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

    async function confirmAgeUnder18(data, context) {
        const uid = requireSignedIn(context);
        const userRef = db.collection('users').doc(uid);
        const atMs = nowFn();
        const now = stamp();
        const outcome = { already: false, missing: false, kids: false, blocked: false, confirmed: false, throttled: false };

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
                outcome.confirmed = true;
                return;
            }
            if (alreadyUnder18(user)) {
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

            const patch = { ageUnder18: true };
            if (!user.ageUnder18At) patch.ageUnder18At = now;
            t.set(userRef, patch, { merge: true });
            t.create(auditRef('under18', uid, atMs), {
                action: 'age_under18',
                uid: uid,
                at: now,
                atMs: atMs
            });
            t.set(throttleRef(uid), throttleFields(uid, atMs, now), { merge: true });
        });

        if (outcome.throttled) {
            throw new HttpsError('resource-exhausted', 'Please try again in a moment.');
        }
        if (outcome.blocked || outcome.confirmed) {
            throw new HttpsError('permission-denied', 'This account cannot change its age confirmation.');
        }
        if (outcome.missing) {
            throw new HttpsError('failed-precondition', 'Account not found.');
        }
        if (outcome.kids) {
            throw new HttpsError('permission-denied', 'This account cannot confirm adult age.');
        }
        if (outcome.already) {
            return { success: true, ageUnder18: true, already: true };
        }
        return { success: true, ageUnder18: true, already: false };
    }

    async function adminUnconfirmAge18(data, context) {
        if (!context || !context.auth || !context.auth.token || context.auth.token.admin !== true) {
            throw new HttpsError('permission-denied', 'Admins only.');
        }

        const targetUid = String((data && data.uid) || '').trim();
        if (!TARGET_UID.test(targetUid)) {
            throw new HttpsError('invalid-argument', 'Enter the account id.');
        }

        await stepUp(data, context, 'adminUnconfirmAge18');

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
            const patch = clearAgeFields(del);
            patch.ageConfirmBlocked = true;
            t.set(userRef, patch, { merge: true });
            const row = priorAuditFields(user, context.auth.uid, now, atMs);
            row.action = 'age_unconfirm';
            row.uid = targetUid;
            t.create(auditRef('unconfirm', targetUid, atMs), row);
        });

        if (outcome.missing) {
            throw new HttpsError('failed-precondition', 'Account not found.');
        }
        return { success: true, over18: false, uid: targetUid };
    }

    async function adminResetAge18(data, context) {
        if (!context || !context.auth || !context.auth.token || context.auth.token.admin !== true) {
            throw new HttpsError('permission-denied', 'Admins only.');
        }

        const targetUid = String((data && data.uid) || '').trim();
        if (!TARGET_UID.test(targetUid)) {
            throw new HttpsError('invalid-argument', 'Enter the account id.');
        }

        await stepUp(data, context, 'adminResetAge18');

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
            const patch = clearAgeFields(del);
            patch.ageConfirmBlocked = del;
            t.set(userRef, patch, { merge: true });
            const row = priorAuditFields(user, context.auth.uid, now, atMs);
            row.action = 'age_reset';
            row.uid = targetUid;
            t.create(auditRef('reset', targetUid, atMs), row);
        });

        if (outcome.missing) {
            throw new HttpsError('failed-precondition', 'Account not found.');
        }
        return { success: true, reset: true, uid: targetUid };
    }

    return {
        confirmAge18: confirmAge18,
        confirmAgeUnder18: confirmAgeUnder18,
        adminUnconfirmAge18: adminUnconfirmAge18,
        adminResetAge18: adminResetAge18,
        alreadyConfirmed: alreadyConfirmed,
        alreadyUnder18: alreadyUnder18,
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
        confirmAgeUnder18: functionsV1.runWith(opts).https.onCall(handlers.confirmAgeUnder18),
        adminUnconfirmAge18: functionsV1.runWith(opts).https.onCall(handlers.adminUnconfirmAge18),
        adminResetAge18: functionsV1.runWith(opts).https.onCall(handlers.adminResetAge18)
    };
}

module.exports = {
    createConfirmAge18Handlers: createConfirmAge18Handlers,
    bindConfirmAge18: bindConfirmAge18,
    alreadyConfirmed: alreadyConfirmed,
    alreadyUnder18: alreadyUnder18,
    isKidsAccount: isKidsAccount,
    THROTTLE_MS: THROTTLE_MS,
    TARGET_UID: TARGET_UID
};
