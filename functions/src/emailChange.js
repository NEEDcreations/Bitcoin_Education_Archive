'use strict';

// Email change. prepareEmailChange records an HMAC of the new address after
// a fresh sign-in and authenticator step-up. The client then calls
// verifyBeforeUpdateEmail. syncEmailChange runs on sign-in, copies the Auth
// email onto users/{uid}, and holds sats for 72 hours when the address
// changed without that prep row. Nothing here logs an email address.

const accountTombstone = require('./accountTombstone');

const PREP_TTL_MS = 60 * 60 * 1000;
const SATS_HOLD_MS = 72 * 60 * 60 * 1000;
const PREPARE_WINDOW_MS = 24 * 60 * 60 * 1000;
const PREPARE_MAX = 3;
const SYNC_WINDOW_MS = 60 * 60 * 1000;
const SYNC_MAX = 30;
const HISTORY_CAP = 20;
const REAUTH_MAX_AGE_SEC = 5 * 60;
const CANT_USE = "That email can't be used.";
const SIGN_IN_AGAIN = 'Sign in again, then try this.';
const TOO_MANY = 'Too many attempts. Try again later.';
const TRY_LATER = 'Try again later.';
const CHANGED_NOTICE = 'Your sign-in email was changed. Not you? Use the revert link sent to your old address or contact support.';

const DISPOSABLE_DOMAINS = {
    'mailinator.com': 1,
    'guerrillamail.com': 1,
    'guerrillamailblock.com': 1,
    'sharklasers.com': 1,
    'grr.la': 1,
    'yopmail.com': 1,
    'tempmail.com': 1,
    'temp-mail.org': 1,
    '10minutemail.com': 1,
    'trashmail.com': 1,
    'getnada.com': 1,
    'dispostable.com': 1,
    'maildrop.cc': 1,
    'fakeinbox.com': 1,
    'throwawaymail.com': 1,
    'mintemail.com': 1,
    'mohmal.com': 1,
    'emailondeck.com': 1,
    'spamgourmet.com': 1,
    'mailnesia.com': 1,
    'mytemp.email': 1,
    'tmpmail.org': 1,
    'tmpmail.net': 1,
    'moakt.com': 1,
    'inboxkitten.com': 1,
    'discard.email': 1,
    'guerrillamail.info': 1,
    'guerrillamail.net': 1,
    'guerrillamail.org': 1,
    'trashmail.de': 1,
    'tempmailo.com': 1,
};

function httpsError(HttpsError, code, message) {
    return new HttpsError(code, message);
}

function isAnonymous(auth) {
    const firebase = auth && auth.token && auth.token.firebase;
    return !!(firebase && firebase.sign_in_provider === 'anonymous');
}

function authTimeOk(auth, nowSec) {
    const authTime = auth && auth.token && Number(auth.token.auth_time);
    const age = nowSec - authTime;
    return Number.isFinite(authTime) && age >= 0 && age <= REAUTH_MAX_AGE_SEC;
}

function userNotFound(err) {
    const code = err && (err.code || (err.errorInfo && err.errorInfo.code)) || '';
    return code === 'auth/user-not-found' || code === 'user-not-found';
}

function domainBlocked(domain) {
    if (DISPOSABLE_DOMAINS[domain]) return true;
    const parts = String(domain || '').split('.');
    for (let i = 0; i < parts.length - 1; i++) {
        if (DISPOSABLE_DOMAINS[parts.slice(i).join('.')]) return true;
    }
    return false;
}

function assessEmail(raw) {
    const email = String(raw || '').trim().toLowerCase();
    if (email.length < 6 || email.length > 320) return '';
    const at = email.indexOf('@');
    if (at < 1 || email.indexOf('@', at + 1) !== -1) return '';
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (!local || local.length > 64 || !domain || domain.length > 253) return '';
    if (local.charAt(0) === '.' || local.charAt(local.length - 1) === '.' || local.indexOf('..') !== -1) return '';
    if (domain.charAt(0) === '.' || domain.charAt(domain.length - 1) === '.' || domain.indexOf('..') !== -1) return '';
    if (domain.indexOf('.') === -1) return '';
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) return '';
    if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return '';
    if (!/^[a-z0-9.-]+$/.test(domain)) return '';
    if (domainBlocked(domain)) return '';
    return email;
}

function millisOf(value) {
    if (!value) return 0;
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    return 0;
}

async function takeRate(db, docId, nowMs, windowMs, max) {
    const ref = db.collection('rate_limits').doc(docId);
    await db.runTransaction(async function (tx) {
        const snap = await tx.get(ref);
        const data = snap && snap.exists ? (snap.data() || {}) : {};
        const start = millisOf(data.windowStart);
        const age = nowMs - start;
        const inWindow = !!start && age < windowMs && age >= -60000;
        const count = inWindow ? (Number(data.count) || 0) : 0;
        if (count >= max) {
            const err = new Error(TOO_MANY);
            err.code = 'resource-exhausted';
            throw err;
        }
        tx.set(ref, {
            windowStart: inWindow ? data.windowStart : nowMs,
            count: count + 1,
            expireAt: new Date(nowMs + windowMs + 60 * 60 * 1000),
        });
    });
}

async function revokeTrust(db, authApi, uid) {
    async function dropWhere(name) {
        if (!db || typeof db.collection !== 'function') return;
        const snap = await db.collection(name).where('uid', '==', uid).get();
        if (!snap || typeof snap.forEach !== 'function') return;
        const batch = db.batch();
        let n = 0;
        snap.forEach(function (doc) {
            batch.delete(doc.ref);
            n += 1;
        });
        if (n && typeof batch.commit === 'function') await batch.commit();
    }
    try { await dropWhere('totp_sessions'); } catch (e) { /* session rows are best-effort */ }
    try { await dropWhere('trusted_devices'); } catch (e) { /* device rows are best-effort */ }
    try {
        await db.collection('totp_sessions').doc(uid).delete();
    } catch (e) { /* legacy session doc */ }
    if (authApi && typeof authApi.revokeRefreshTokens === 'function') {
        try { await authApi.revokeRefreshTokens(uid); } catch (e) { /* already gone */ }
    }
}

function createEmailChangeHandlers(options) {
    const opts = options || {};
    const db = opts.db;
    const authApi = opts.authApi;
    const HttpsError = opts.HttpsError;
    const nowMsFn = opts.nowMs;
    const nowSecFn = opts.nowSec;

    function nowMs() {
        if (typeof nowMsFn === 'function') return nowMsFn();
        if (typeof nowMsFn === 'number') return nowMsFn;
        return Date.now();
    }
    function nowSec() {
        if (typeof nowSecFn === 'function') return nowSecFn();
        if (typeof nowSecFn === 'number') return nowSecFn;
        return Math.floor(Date.now() / 1000);
    }

    return {
        async prepareEmailChange(data, context) {
            const auth = context && context.auth;
            if (!auth || !auth.uid || isAnonymous(auth)) {
                throw httpsError(HttpsError, 'unauthenticated', SIGN_IN_AGAIN);
            }
            if (!authTimeOk(auth, nowSec())) {
                throw httpsError(HttpsError, 'failed-precondition', SIGN_IN_AGAIN);
            }
            const secondFactor = require('./secondFactor');
            await secondFactor.requireFreshStepUp(secondFactor.stamp(data, context), 'changeEmail');
            const clock = nowMs();
            const uid = auth.uid;
            try {
                await takeRate(db, 'emailchg_' + uid, clock, PREPARE_WINDOW_MS, PREPARE_MAX);
            } catch (err) {
                if (err && err.code === 'resource-exhausted') {
                    throw httpsError(HttpsError, 'resource-exhausted', TOO_MANY);
                }
                throw err;
            }
            if (!accountTombstone.secretReady()) {
                throw httpsError(HttpsError, 'failed-precondition', TRY_LATER);
            }
            const email = assessEmail(data && data.email);
            if (!email) throw httpsError(HttpsError, 'invalid-argument', CANT_USE);
            const current = accountTombstone.normalizeEmail((auth.token && auth.token.email) || '');
            if (current && current === email) throw httpsError(HttpsError, 'invalid-argument', CANT_USE);
            if (authApi && typeof authApi.getUserByEmail === 'function') {
                let existing = null;
                try {
                    existing = await authApi.getUserByEmail(email);
                } catch (err) {
                    if (!userNotFound(err)) throw httpsError(HttpsError, 'unavailable', TRY_LATER);
                }
                if (existing && existing.uid && existing.uid !== uid) {
                    throw httpsError(HttpsError, 'invalid-argument', CANT_USE);
                }
            }
            const looked = await accountTombstone.lookupByMaterials(db, { email: email, uid: '', providers: [] });
            const summary = looked.summary || {};
            if (summary.banned || summary.satsDisabled || summary.ledgerBanned) {
                throw httpsError(HttpsError, 'invalid-argument', CANT_USE);
            }
            const emailHmac = accountTombstone.emailHmac(email);
            if (!emailHmac) throw httpsError(HttpsError, 'failed-precondition', TRY_LATER);
            await db.collection('email_change_pending').doc(uid).set({
                emailHmac: emailHmac,
                expireAt: new Date(clock + PREP_TTL_MS),
                createdAt: clock,
            });
            return { ok: true };
        },

        async syncEmailChange(data, context) {
            const auth = context && context.auth;
            if (!auth || !auth.uid || isAnonymous(auth)) {
                throw httpsError(HttpsError, 'unauthenticated', SIGN_IN_AGAIN);
            }
            const uid = auth.uid;
            const clock = nowMs();
            try {
                await takeRate(db, 'emailsync_' + uid, clock, SYNC_WINDOW_MS, SYNC_MAX);
            } catch (err) {
                if (err && err.code === 'resource-exhausted') {
                    throw httpsError(HttpsError, 'resource-exhausted', TOO_MANY);
                }
                throw err;
            }
            if (!accountTombstone.secretReady()) return { ok: true, skipped: true };
            const email = accountTombstone.normalizeEmail((auth.token && auth.token.email) || '');
            if (!email) return { ok: true, skipped: true };
            const nextHash = accountTombstone.emailHmac(email);
            if (!nextHash) return { ok: true, skipped: true };
            const userRef = db.collection('users').doc(uid);
            const userSnap = await userRef.get();
            const user = userSnap && userSnap.exists ? (userSnap.data() || {}) : {};
            const prevHash = String(user.emailHash || '');
            if (prevHash && prevHash === nextHash) return { ok: true, changed: false };

            let authUser = null;
            if (authApi && typeof authApi.getUser === 'function') {
                try { authUser = await authApi.getUser(uid); } catch (err) { authUser = null; }
            }
            const looked = await accountTombstone.lookupByMaterials(db, accountTombstone.identityFrom({
                uid: uid,
                authUser: authUser,
                token: Object.assign({}, auth.token || {}, { email: email }),
                user: user,
            }));
            if (looked.configured) {
                await accountTombstone.applyIdentityFlags(db, uid, looked.summary);
            }

            if (!prevHash) {
                const seed = { email: email, emailHash: nextHash };
                if (userSnap && userSnap.exists) await userRef.set(seed, { merge: true });
                else await userRef.set(seed, { merge: true });
                return { ok: true, changed: false, first: true };
            }

            const prepRef = db.collection('email_change_pending').doc(uid);
            const prepSnap = await prepRef.get();
            const prep = prepSnap && prepSnap.exists ? (prepSnap.data() || {}) : null;
            const prepExpiry = prep ? millisOf(prep.expireAt) : 0;
            const matched = !!(prep && prep.emailHmac === nextHash && prepExpiry > clock);
            const patch = {
                email: email,
                emailHash: nextHash,
            };
            if (!matched) patch.satsHold = clock + SATS_HOLD_MS;
            await userRef.set(patch, { merge: true });
            if (matched) {
                try { await prepRef.delete(); } catch (e) { /* prep already gone */ }
            }
            const histRef = db.collection('email_history').doc(uid);
            const histSnap = await histRef.get();
            const prevHashes = histSnap && histSnap.exists && Array.isArray(histSnap.data().hashes)
                ? histSnap.data().hashes.slice()
                : [];
            if (prevHashes.indexOf(prevHash) === -1) prevHashes.push(prevHash);
            await histRef.set({
                hashes: prevHashes.slice(-HISTORY_CAP),
                updatedAt: clock,
            });
            await revokeTrust(db, authApi, uid);
            try {
                await db.collection('admin_audit_log').doc('email_' + uid + '_' + clock).set({
                    action: 'email_change',
                    uid: uid,
                    at: clock,
                    prepared: matched,
                    hold: !matched,
                });
            } catch (e) { /* audit is best-effort and never includes an address */ }
            return { ok: true, changed: true, notice: CHANGED_NOTICE, hold: !matched };
        },

        async confirmAccountLink(data, context) {
            const auth = context && context.auth;
            if (!auth || !auth.uid || isAnonymous(auth)) {
                throw httpsError(HttpsError, 'unauthenticated', SIGN_IN_AGAIN);
            }
            if (!authTimeOk(auth, nowSec())) {
                throw httpsError(HttpsError, 'failed-precondition', SIGN_IN_AGAIN);
            }
            const action = data && data.action;
            if (action !== 'linkProvider' && action !== 'unlinkProvider') {
                throw httpsError(HttpsError, 'invalid-argument', 'Try again later.');
            }
            const secondFactor = require('./secondFactor');
            await secondFactor.requireFreshStepUp(secondFactor.stamp(data, context), action);
            const clock = nowMs();
            try {
                await takeRate(db, 'acctlink_' + auth.uid, clock, PREPARE_WINDOW_MS, 20);
            } catch (err) {
                if (err && err.code === 'resource-exhausted') {
                    throw httpsError(HttpsError, 'resource-exhausted', TOO_MANY);
                }
                throw err;
            }
            return { ok: true, action: action };
        },
    };
}

function bindEmailChange(functionsV1, admin, db, deletionHmacSecret) {
    const secret = deletionHmacSecret || require('firebase-functions/params').defineSecret(accountTombstone.SECRET_ENV);
    const handlers = createEmailChangeHandlers({
        db: db,
        authApi: admin.auth(),
        HttpsError: functionsV1.https.HttpsError,
    });
    function onCall(handler) {
        return functionsV1.runWith({
            enforceAppCheck: true,
            secrets: [secret],
        }).https.onCall(handler);
    }
    return {
        prepareEmailChange: onCall(handlers.prepareEmailChange),
        syncEmailChange: onCall(handlers.syncEmailChange),
        confirmAccountLink: onCall(handlers.confirmAccountLink),
    };
}

module.exports = {
    PREP_TTL_MS: PREP_TTL_MS,
    SATS_HOLD_MS: SATS_HOLD_MS,
    PREPARE_MAX: PREPARE_MAX,
    CANT_USE: CANT_USE,
    SIGN_IN_AGAIN: SIGN_IN_AGAIN,
    TOO_MANY: TOO_MANY,
    CHANGED_NOTICE: CHANGED_NOTICE,
    assessEmail: assessEmail,
    createEmailChangeHandlers: createEmailChangeHandlers,
    bindEmailChange: bindEmailChange,
};
