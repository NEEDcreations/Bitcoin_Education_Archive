'use strict';

// One-time withdrawal address for an account whose saved address is missing,
// malformed, or fails a live lookup. A working address is never replaced.
// The proof invoice is requested and not paid. The marker lives in ln_resets,
// which clients cannot write.

const faucetGuard = require('./faucetGuard');
const { emailOk } = require('./referrals');
const {
    resolveLnurlInvoice,
    normalizeLnAddress,
    PROOF_MSATS,
    PROOF_MAX_MSATS,
    RESOLVE_ERROR,
} = require('./lnurlResolve');

function storedAddress(user) {
    const u = user || {};
    return normalizeLnAddress(u.lightningAddress || u.lightning || u.lnAddress || '');
}

function identityOk(context, user) {
    const token = (context && context.auth && context.auth.token) || {};
    const fromDoc = Array.isArray(user && user.providers) ? user.providers.filter(Boolean) : [];
    const firebaseToken = token.firebase || {};
    const provider = firebaseToken.sign_in_provider || '';
    const providers = fromDoc.length ? fromDoc : (provider ? [provider] : []);
    const emailVerified = token.email_verified === true || (user && user.emailVerified === true);
    return emailOk({ providers: providers, emailVerified: emailVerified });
}

function markerUsed(snap) {
    if (!snap || !snap.exists) return false;
    const data = typeof snap.data === 'function' ? (snap.data() || {}) : {};
    return !!data.ln_reset_used;
}

function createResetHandlers(deps) {
    const options = deps || {};
    const db = options.db;
    const admin = options.admin;
    const verifyTurnstile = options.verifyTurnstile;
    const requireSecondFactor = options.requireSecondFactor || async function () {};
    const resolve = options.resolveLnurlInvoice || resolveLnurlInvoice;
    const HttpsError = options.HttpsError || function (code, message) {
        const err = new Error(message);
        err.code = code;
        return err;
    };

    function fail(code, error) {
        return { ok: false, code: code, error: error };
    }

    async function prove(address) {
        try {
            return await resolve({ address: address, msats: PROOF_MSATS });
        } catch (e) {
            if (e && e.code === 'below_min' && e.minSendable > PROOF_MSATS && e.minSendable <= PROOF_MAX_MSATS) {
                return await resolve({ address: address, msats: e.minSendable });
            }
            throw e;
        }
    }

    async function resetLightningAddressOnce(data, context) {
        await requireSecondFactor(data, context);
        if (!context || !context.auth || !context.auth.uid) {
            throw new HttpsError('unauthenticated', 'Must be signed in');
        }
        const token = context.auth.token || {};
        const provider = token.firebase && token.firebase.sign_in_provider;
        if (provider === 'anonymous') {
            throw new HttpsError('permission-denied', 'Account required.');
        }

        const uid = context.auth.uid;
        const userRef = db.collection('users').doc(uid);
        const userSnap = await userRef.get();
        const user = userSnap.exists ? (userSnap.data() || {}) : {};
        if (!identityOk(context, user)) {
            return fail('email_required', 'Verified email required. Link and verify your email in Account settings.');
        }

        const tsOk = await verifyTurnstile((data && data.turnstileToken) || '', null);
        if (!tsOk) return fail('turnstile', 'Security check failed. Please refresh and try again.');

        const ledgerSnap = await db.collection('faucet_ledger').doc(uid).get();
        const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
        const ban = faucetGuard.assessBan(user, ledger);
        if (!ban.ok) return fail('banned', ban.error);

        const markerRef = db.collection('ln_resets').doc(uid);
        const markerSnap = await markerRef.get();
        if (markerUsed(markerSnap)) {
            return fail('already_used', 'A fresh Lightning Address was already saved on this account. Email support at ' + faucetGuard.SUPPORT_EMAIL + '.');
        }

        const next = normalizeLnAddress(data && data.lightningAddress);
        if (!faucetGuard.validLightningAddress(next)) {
            return fail('bad_address', 'Invalid Lightning Address format.');
        }

        const saved = storedAddress(user);
        if (faucetGuard.validLightningAddress(saved)) {
            try {
                await prove(saved);
                return fail('address_works', 'Your Lightning Address already works, so it stays on this account.');
            } catch (e) {
                console.error('[LN-RESET] stored address does not resolve domain=' + (saved.split('@')[1] || ''));
            }
        }

        let proved;
        try {
            proved = await prove(next);
        } catch (e) {
            console.error('[LN-RESET] new address rejected domain=' + (next.split('@')[1] || ''));
            const clear = e && (e.code === 'lnurl_error' || e.code === 'below_min' || e.code === 'above_max');
            return fail('address_unresolved', clear && e.message ? e.message : RESOLVE_ERROR);
        }

        const domain = (proved && proved.domain) || (next.split('@')[1] || '');
        try {
            await db.runTransaction(async function (t) {
                const freshUser = await t.get(userRef);
                const freshLedger = await t.get(db.collection('faucet_ledger').doc(uid));
                const freshMarker = await t.get(markerRef);
                const u = freshUser.exists ? (freshUser.data() || {}) : {};
                const l = freshLedger.exists ? (freshLedger.data() || {}) : {};
                const banNow = faucetGuard.assessBan(u, l);
                if (!banNow.ok) {
                    const err = new Error('FAUCET_USER:' + banNow.error);
                    err.code = 'banned';
                    throw err;
                }
                if (markerUsed(freshMarker)) {
                    const err = new Error('FAUCET_USER:A fresh Lightning Address was already saved on this account.');
                    err.code = 'already_used';
                    throw err;
                }
                if (storedAddress(u) !== saved) {
                    const err = new Error('FAUCET_USER:Your Lightning Address changed. Refresh and try again.');
                    err.code = 'changed';
                    throw err;
                }

                const lockRef = db.collection('lightning_addresses').doc(next);
                const lockDoc = await t.get(lockRef);
                const lockOwner = lockDoc.exists ? String((lockDoc.data() || {}).uid || '') : '';
                let lockOwnerBanned = false;
                let otherBanned = false;
                let otherInUse = false;
                if (lockOwner && lockOwner !== uid) {
                    const otherDoc = await t.get(db.collection('users').doc(lockOwner));
                    const otherLedger = await t.get(db.collection('faucet_ledger').doc(lockOwner));
                    const otherUser = otherDoc.exists ? (otherDoc.data() || {}) : {};
                    lockOwnerBanned = otherUser.satsDisabled === true || (otherLedger.exists && (otherLedger.data() || {}).banned === true);
                } else if (!lockOwner) {
                    const byAddress = await t.get(db.collection('users').where('lightningAddress', '==', next).limit(10));
                    const byLightning = await t.get(db.collection('users').where('lightning', '==', next).limit(10));
                    const byLn = await t.get(db.collection('users').where('lnAddress', '==', next).limit(10));
                    const seen = {};
                    [byAddress, byLightning, byLn].forEach(function (snap) {
                        if (!snap || typeof snap.forEach !== 'function') return;
                        snap.forEach(function (d) {
                            if (d.id !== uid) seen[d.id] = (typeof d.data === 'function' ? d.data() : {}) || {};
                        });
                    });
                    const ids = Object.keys(seen);
                    for (let i = 0; i < ids.length; i++) {
                        otherInUse = true;
                        const led = await t.get(db.collection('faucet_ledger').doc(ids[i]));
                        if (seen[ids[i]].satsDisabled === true || (led.exists && (led.data() || {}).banned === true)) {
                            otherBanned = true;
                            break;
                        }
                    }
                }
                const decision = faucetGuard.assessAddressLock({
                    callerUid: uid,
                    requested: next,
                    saved: '',
                    lockOwner: lockOwner,
                    lockOwnerBanned: lockOwnerBanned,
                    otherBanned: otherBanned,
                    otherInUse: otherInUse,
                });
                if (!decision.ok) {
                    const err = new Error('FAUCET_USER:' + decision.error);
                    err.code = decision.code || 'address_conflict';
                    throw err;
                }

                const stamp = admin.firestore.FieldValue.serverTimestamp();
                if (freshUser.exists) t.set(userRef, { lightning: next, lightningAddress: next }, { merge: true });
                else t.set(userRef, { lightning: next, lightningAddress: next });
                if (!lockDoc.exists) {
                    t.set(lockRef, { uid: uid, address: next, lockedAt: stamp });
                }
                t.set(markerRef, { ln_reset_used: stamp, domain: domain, uid: uid });
            });
        } catch (e) {
            const raw = e && e.message ? String(e.message) : '';
            const marker = 'FAUCET_USER:';
            const at = raw.indexOf(marker);
            if (at !== -1) return fail(e.code || 'rejected', raw.slice(at + marker.length));
            console.error('[LN-RESET] transaction failed domain=' + domain);
            return fail('rejected', 'Could not save that Lightning Address. Try again.');
        }
        return { ok: true, address: next };
    }

    return { resetLightningAddressOnce: resetLightningAddressOnce, identityOk: identityOk };
}

function bindResetLightningAddress(functionsV1, deps) {
    const handlers = createResetHandlers(Object.assign({
        HttpsError: functionsV1.https.HttpsError,
    }, deps || {}));
    const opts = { enforceAppCheck: true, timeoutSeconds: 60 };
    return {
        resetLightningAddressOnce: functionsV1.runWith(opts).https.onCall(handlers.resetLightningAddressOnce),
    };
}

module.exports = {
    createResetHandlers: createResetHandlers,
    bindResetLightningAddress: bindResetLightningAddress,
    identityOk: identityOk,
    storedAddress: storedAddress,
};
