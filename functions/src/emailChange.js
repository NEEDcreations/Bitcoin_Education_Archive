'use strict';

// Email change. prepareEmailChange records an HMAC of the new address after
// a fresh sign-in and authenticator step-up, plus a claim so another uid cannot
// take it. The client then calls verifyBeforeUpdateEmail, or links an email
// sign-in link onto the signed-in Lightning account. reconcileEmail copies the
// verified Auth email onto users/{uid} only when no other account already has it.
// A Lightning account's first email must match that claim. Every real email or
// provider-set change holds sats for 72 hours. Nothing here logs an email address.

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
const PAUSED_CLAIMS = 'Sats claims are paused. Try again later.';
const HOLD_ERROR = 'Sats withdrawals are paused on this account. Try again later.';
// Stored after a real last-provider removal. An empty providersHash would look
// like a first sight, so a provider linked later would skip the 72-hour hold.
const NO_PROVIDERS = '__none__';

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

async function appendHashes(db, collectionName, uid, hashes, nowMs) {
    const extra = (hashes || []).map(function (hash) { return String(hash || ''); }).filter(Boolean);
    if (!extra.length) return;
    const ref = db.collection(collectionName).doc(uid);
    const snap = await ref.get();
    const prev = snap && snap.exists && snap.data() && Array.isArray(snap.data().hashes)
        ? snap.data().hashes.slice()
        : [];
    extra.forEach(function (hash) {
        if (prev.indexOf(hash) === -1) prev.push(hash);
    });
    await ref.set({
        hashes: prev.slice(-HISTORY_CAP),
        updatedAt: nowMs,
    });
}

// Server-side email and provider sync. Uses the verified Auth email only.
// A legacy users.email that does not match that address is a change, not a seed.
// providersKnown is true only when authUser is the record getUser returned.
// A missing or token-built user has no provider list, and an empty list then
// is not a removal.
function keepsSignInWithoutPassword(uid, providerData) {
    // A Lightning custom token is a sign-in method even when providerData is
    // only the email link. Any other account must keep a non-password provider.
    if (String(uid || '').indexOf('ln:') === 0) return true;
    const rows = Array.isArray(providerData) ? providerData : [];
    for (let i = 0; i < rows.length; i++) {
        const id = rows[i] && rows[i].providerId;
        if (id && id !== 'password' && id !== 'anonymous') return true;
    }
    return false;
}

async function detachAuthEmail(authApi, uid) {
    // Only a Lightning account can lose an email that was never claimed for it.
    // Unlinking password on anyone else can delete their only sign-in.
    if (String(uid || '').indexOf('ln:') !== 0) return;
    if (!authApi || typeof authApi.updateUser !== 'function') return;
    let providers = null;
    if (typeof authApi.getUser === 'function') {
        try {
            const rec = await authApi.getUser(uid);
            providers = rec && Array.isArray(rec.providerData) ? rec.providerData : [];
        } catch (e) {
            providers = null;
        }
    }
    if (providers && !keepsSignInWithoutPassword(uid, providers)) return;
    try {
        await authApi.updateUser(uid, { providersToUnlink: ['password'] });
        return;
    } catch (e) { /* password provider may already be gone */ }
    if (!keepsSignInWithoutPassword(uid, providers || [])) return;
    try {
        await authApi.updateUser(uid, { email: null, emailVerified: false });
    } catch (e2) { /* the profile write is still refused */ }
}

async function otherProfileHasEmail(db, uid, hash) {
    if (!hash || !db || typeof db.collection !== 'function') return false;
    const users = db.collection('users');
    if (!users || typeof users.where !== 'function') return false;
    let query = users.where('emailHash', '==', hash);
    if (query && typeof query.limit === 'function') query = query.limit(5);
    const snap = await query.get();
    let other = false;
    if (snap && typeof snap.forEach === 'function') {
        snap.forEach(function (doc) {
            if (doc && doc.id && doc.id !== uid) other = true;
        });
    }
    return other;
}

async function readActiveClaim(db, hash, nowMs) {
    if (!hash || !db || typeof db.collection !== 'function') return null;
    const ref = db.collection('email_link_claims').doc(hash);
    if (!ref || typeof ref.get !== 'function') return null;
    const snap = await ref.get();
    if (!snap || !snap.exists) return null;
    const claim = snap.data() || {};
    if (!claim.uid || millisOf(claim.expireAt) <= nowMs) return null;
    return { uid: claim.uid, hash: hash };
}

async function claimantOwnsEmail(authApi, claimUid, email) {
    if (!authApi || typeof authApi.getUser !== 'function' || !claimUid) return false;
    try {
        const rec = await authApi.getUser(claimUid);
        const theirs = accountTombstone.normalizeEmail(rec && rec.email);
        return !!(rec && rec.emailVerified === true && theirs && theirs === accountTombstone.normalizeEmail(email));
    } catch (e) {
        return false;
    }
}

async function claimsForUid(db, uid) {
    const out = [];
    if (!uid || !db || typeof db.collection !== 'function') return out;
    const col = db.collection('email_link_claims');
    if (!col || typeof col.where !== 'function') return out;
    const snap = await col.where('uid', '==', uid).get();
    if (snap && typeof snap.forEach === 'function') {
        snap.forEach(function (doc) {
            if (doc && doc.id) out.push(doc.id);
        });
    }
    return out;
}

async function releasePreviousClaims(db, uid, keepHash) {
    const pendingSnap = await db.collection('email_change_pending').doc(uid).get();
    const pending = pendingSnap && pendingSnap.exists ? (pendingSnap.data() || {}) : null;
    const prev = pending && pending.emailHmac;
    if (prev && prev !== keepHash) await releaseEmailClaim(db, uid, prev);
    const rows = await claimsForUid(db, uid);
    for (let i = 0; i < rows.length; i++) {
        if (rows[i] && rows[i] !== keepHash) await releaseEmailClaim(db, uid, rows[i]);
    }
}

async function lightningFirstLinkOk(db, uid, hash, nowMs) {
    const prepSnap = await db.collection('email_change_pending').doc(uid).get();
    const prep = prepSnap && prepSnap.exists ? (prepSnap.data() || {}) : null;
    if (prep && prep.emailHmac === hash && millisOf(prep.expireAt) > nowMs) return true;
    const claimSnap = await db.collection('email_link_claims').doc(hash).get();
    const claim = claimSnap && claimSnap.exists ? (claimSnap.data() || {}) : null;
    return !!(claim && claim.uid === uid && millisOf(claim.expireAt) > nowMs);
}

async function releaseEmailClaim(db, uid, hash) {
    if (!hash || !db || typeof db.collection !== 'function') return;
    try {
        const ref = db.collection('email_link_claims').doc(hash);
        const snap = await ref.get();
        const claim = snap && snap.exists ? (snap.data() || {}) : null;
        if (claim && claim.uid === uid && typeof ref.delete === 'function') await ref.delete();
    } catch (e) { /* expiry still bounds a leftover claim */ }
}

async function reconcileEmail(db, authApi, uid, authUser, nowMs, token, providersKnown) {
    const clock = Number(nowMs) || Date.now();
    if (!uid || !accountTombstone.secretReady()) return { ok: true, skipped: true, changed: false, hold: false, tomb: null };
    const knowProviders = providersKnown === true && !!(authUser && Array.isArray(authUser.providerData));
    const identity = accountTombstone.identityFrom({ uid: uid, authUser: authUser || null });
    const verified = identity.emailVerified === true ? identity.email : '';
    const nextHash = verified ? accountTombstone.emailHmac(verified) : '';
    const nextProvidersHash = knowProviders ? accountTombstone.providersHashOf(identity) : '';
    const nextProviderIds = knowProviders ? accountTombstone.providerHashIds(identity) : [];
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const user = userSnap && userSnap.exists ? (userSnap.data() || {}) : {};
    const prevHash = String(user.emailHash || '');
    const prevProvidersHash = String(user.providersHash || '');
    const legacyEmail = accountTombstone.normalizeEmail(user.email || '');
    const emailChanged = !!(nextHash && prevHash && prevHash !== nextHash);
    const seedMismatch = !prevHash && !!nextHash && !!legacyEmail && legacyEmail !== verified;
    const storedNone = prevProvidersHash === NO_PROVIDERS;
    // An empty provider set is a change only when getUser actually returned it.
    // The first set is still only a seed. A stored __none__ marker means the
    // last provider was already removed, so the next set is a change too.
    let providerChanged = false;
    if (knowProviders) {
        if (storedNone) providerChanged = !!nextProvidersHash;
        else if (prevProvidersHash) providerChanged = prevProvidersHash !== nextProvidersHash;
    }

    const lookupIdentity = accountTombstone.identityFrom({
        uid: uid,
        authUser: authUser || null,
        token: token || null,
    });
    const looked = await accountTombstone.lookupByMaterials(db, lookupIdentity);
    if (looked.configured && (looked.summary.banned || looked.summary.satsDisabled || looked.summary.ledgerBanned)) {
        await accountTombstone.applyIdentityFlags(db, uid, looked.summary);
    }

    if (nextHash) {
        let blocked = false;
        let authOwner = '';
        if (authApi && typeof authApi.getUserByEmail === 'function') {
            try {
                const existing = await authApi.getUserByEmail(verified);
                authOwner = existing && existing.uid ? existing.uid : '';
                if (authOwner && authOwner !== uid) blocked = true;
            } catch (err) {
                if (!userNotFound(err)) {
                    return { ok: false, conflict: true, changed: false, hold: false, skipped: true, tomb: looked };
                }
            }
        }
        if (!blocked && await otherProfileHasEmail(db, uid, nextHash)) blocked = true;
        if (!blocked) {
            const reservation = await readActiveClaim(db, nextHash, clock);
            if (reservation && reservation.uid !== uid) {
                // prepareEmailChange only reserves an address. The Auth user who
                // verified it, including an email-link signup, wins and the
                // reservation is dropped. The claim blocks only when that other
                // account already has the verified address.
                const reserved = await claimantOwnsEmail(authApi, reservation.uid, verified);
                if (authOwner === uid || !reserved) await releaseEmailClaim(db, reservation.uid, nextHash);
                else blocked = true;
            }
        }
        if (!blocked && !prevHash && String(uid).indexOf('ln:') === 0) {
            const allowed = await lightningFirstLinkOk(db, uid, nextHash, clock);
            if (!allowed) blocked = true;
        }
        if (blocked) {
            await detachAuthEmail(authApi, uid);
            return { ok: false, conflict: true, changed: false, hold: false, skipped: true, tomb: looked };
        }
    }

    if (!emailChanged && !seedMismatch && !providerChanged) {
        const seed = {};
        if (!prevHash && nextHash) {
            seed.email = verified;
            seed.emailHash = nextHash;
        }
        if (knowProviders && !prevProvidersHash && nextProvidersHash && !storedNone) {
            seed.providersHash = nextProvidersHash;
            seed.providerHashes = nextProviderIds;
        }
        if (Object.keys(seed).length) await userRef.set(seed, { merge: true });
        if (seed.emailHash) await releaseEmailClaim(db, uid, nextHash);
        return {
            ok: true,
            changed: false,
            first: !prevHash && !!nextHash && !seedMismatch,
            hold: false,
            tomb: looked,
        };
    }

    const patch = { satsHold: clock + SATS_HOLD_MS };
    if (nextHash) {
        patch.email = verified;
        patch.emailHash = nextHash;
    }
    if (knowProviders && nextProvidersHash) {
        patch.providersHash = nextProvidersHash;
        patch.providerHashes = nextProviderIds;
    } else if (providerChanged) {
        patch.providersHash = NO_PROVIDERS;
        patch.providerHashes = [NO_PROVIDERS];
    }
    await userRef.set(patch, { merge: true });
    if (patch.emailHash) await releaseEmailClaim(db, uid, nextHash);

    // Only a previously verified hash is history. A legacy users.email was
    // never verified, so its hash is not stored and cannot become a tombstone.
    const historyIds = [];
    if (prevHash && prevHash !== nextHash) historyIds.push(prevHash);
    await appendHashes(db, 'email_history', uid, historyIds, clock);
    if (providerChanged) {
        const priorIds = (user.providerHashes || []).filter(function (id) {
            return id && id !== NO_PROVIDERS;
        });
        await appendHashes(db, 'identity_history', uid, priorIds, clock);
    }

    let prepared = false;
    if (nextHash) {
        const prepRef = db.collection('email_change_pending').doc(uid);
        const prepSnap = await prepRef.get();
        const prep = prepSnap && prepSnap.exists ? (prepSnap.data() || {}) : null;
        const prepExpiry = prep ? millisOf(prep.expireAt) : 0;
        prepared = !!(prep && prep.emailHmac === nextHash && prepExpiry > clock);
        if (prepared) {
            try { await prepRef.delete(); } catch (e) { /* prep already gone */ }
        }
    }
    await revokeTrust(db, authApi, uid);
    try {
        await db.collection('admin_audit_log').doc('email_' + uid + '_' + clock).set({
            action: 'email_change',
            uid: uid,
            at: clock,
            prepared: prepared,
            hold: true,
            providerChanged: providerChanged,
        });
    } catch (e) { /* audit is best-effort and never includes an address */ }
    if (emailChanged || seedMismatch) {
        try {
            await db.collection('notifications').doc('emailchg_notice_' + uid).set({
                recipientId: uid,
                type: 'email_changed',
                title: 'Sign-in email changed',
                body: CHANGED_NOTICE,
                createdAt: clock,
                read: false,
            });
        } catch (e) { /* notice is best-effort and never includes an address */ }
    }
    return {
        ok: true,
        changed: true,
        hold: true,
        notice: CHANGED_NOTICE,
        holdUntil: patch.satsHold,
        prepared: prepared,
        tomb: looked,
    };
}

async function beginPayout(db, authApi, uid, authUser, nowMs, token, providersKnown) {
    if (!accountTombstone.secretReady()) {
        return { ok: false, paused: true, error: PAUSED_CLAIMS, tomb: null };
    }
    const clock = Number(nowMs) || Date.now();
    const reconciled = await reconcileEmail(db, authApi, uid, authUser, clock, token, providersKnown);
    if (reconciled && reconciled.conflict) {
        return { ok: false, conflict: true, error: CANT_USE, tomb: reconciled.tomb || null };
    }
    const tomb = reconciled && reconciled.tomb;
    let holdUntil = Number(reconciled && reconciled.holdUntil) || 0;
    try {
        const snap = await db.collection('users').doc(uid).get();
        const user = snap && snap.exists ? (snap.data() || {}) : {};
        holdUntil = Math.max(holdUntil, Number(user.satsHold) || 0);
    } catch (e) { /* the hold written above still applies */ }
    if ((reconciled && reconciled.hold) || holdUntil > clock) {
        return { ok: false, hold: true, error: HOLD_ERROR, holdUntil: holdUntil, tomb: tomb };
    }
    return { ok: true, reconciled: reconciled, holdUntil: holdUntil, tomb: tomb };
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
            const stepUp = await secondFactor.requireFreshStepUp(secondFactor.stamp(data, context), 'changeEmail');
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
            const looked = await accountTombstone.lookupByMaterials(db, {
                email: email,
                emailVerified: true,
                uid: '',
                providers: [],
            });
            const summary = looked.summary || {};
            if (summary.banned || summary.satsDisabled || summary.ledgerBanned) {
                throw httpsError(HttpsError, 'invalid-argument', CANT_USE);
            }
            const emailHmac = accountTombstone.emailHmac(email);
            if (!emailHmac) throw httpsError(HttpsError, 'failed-precondition', TRY_LATER);
            const claimRef = db.collection('email_link_claims').doc(emailHmac);
            const claimSnap = await claimRef.get();
            const claim = claimSnap && claimSnap.exists ? (claimSnap.data() || {}) : null;
            if (claim && claim.uid && claim.uid !== uid && millisOf(claim.expireAt) > clock) {
                throw httpsError(HttpsError, 'invalid-argument', CANT_USE);
            }
            await releasePreviousClaims(db, uid, emailHmac);
            await claimRef.set({
                uid: uid,
                expireAt: new Date(clock + PREP_TTL_MS),
                createdAt: clock,
            });
            await db.collection('email_change_pending').doc(uid).set({
                emailHmac: emailHmac,
                expireAt: new Date(clock + PREP_TTL_MS),
                createdAt: clock,
                stepUp: {
                    totp: !!(stepUp && stepUp.totp),
                    phone: !!(stepUp && stepUp.phone),
                },
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
            let authUser = null;
            let providersKnown = false;
            if (authApi && typeof authApi.getUser === 'function') {
                try {
                    authUser = await authApi.getUser(uid);
                    providersKnown = !!(authUser && Array.isArray(authUser.providerData));
                } catch (err) {
                    authUser = null;
                    providersKnown = false;
                }
            }
            const token = (auth && auth.token) || {};
            const authVerified = !!(authUser && authUser.email && authUser.emailVerified === true);
            if (!authVerified && token.email_verified === true && token.email) {
                // The token proves the email only. It has no provider list.
                providersKnown = false;
                authUser = {
                    uid: uid,
                    email: token.email,
                    emailVerified: true,
                };
            }
            if (!authUser || authUser.emailVerified !== true || !accountTombstone.normalizeEmail(authUser.email)) {
                return { ok: true, skipped: true };
            }
            return reconcileEmail(db, authApi, uid, authUser, clock, token, providersKnown);
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
    function onCall(handler, warm) {
        var opts = {
            enforceAppCheck: true,
            secrets: [secret],
        };
        if (warm === true) opts.minInstances = 1;
        return functionsV1.runWith(opts).https.onCall(handler);
    }
    return {
        prepareEmailChange: onCall(handlers.prepareEmailChange),
        syncEmailChange: onCall(handlers.syncEmailChange, true),
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
    PAUSED_CLAIMS: PAUSED_CLAIMS,
    HOLD_ERROR: HOLD_ERROR,
    NO_PROVIDERS: NO_PROVIDERS,
    assessEmail: assessEmail,
    reconcileEmail: reconcileEmail,
    beginPayout: beginPayout,
    createEmailChangeHandlers: createEmailChangeHandlers,
    bindEmailChange: bindEmailChange,
};
