'use strict';

// confirmTipSent records one tip confirmation per UTC day.
// Today's lock is read before any network call. A LUD-21 host is resolved
// and rejected if it is internal before it is fetched. The NWC wallet is
// not queried until that guard passes. XP is awarded only after verification.

const functionsV1 = require('firebase-functions/v1');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const bolt11 = require('bolt11');
const tipConfirm = require('./tipConfirm');
const doubleXp = require('./doubleXp');
const referrals = require('./referrals');
const { assertPublicHost } = require('./publicHost');
const { splitDailyXp } = require('./dailyXp');
const { paymentHashFromDecoded } = require('./cipherClaim');

const NWC_URL = process.env.NWC_URL || '';

function db() {
    return admin.firestore();
}

function httpsError(code, message) {
    return new functionsV1.https.HttpsError(code, message);
}

function requireUser(context) {
    if (!context || !context.auth) throw httpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token && context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw httpsError('permission-denied', 'Sign in to record a tip');
    }
    return context.auth.uid;
}

function offsetDateKey(nowMs) {
    const shifted = new Date((Number(nowMs) || Date.now()) - 5 * 3600 * 1000);
    return shifted.toISOString().split('T')[0];
}

function hashFromInvoice(invoice) {
    const text = String(invoice || '').trim();
    if (!text || text.length > 8000) return '';
    try {
        return tipConfirm.normalizePaymentHash(paymentHashFromDecoded(bolt11.decode(text)));
    } catch (e) {
        return '';
    }
}

function invoiceSats(invoice) {
    const text = String(invoice || '').trim();
    if (!text || text.length > 8000) return 0;
    try {
        const decoded = bolt11.decode(text);
        let sats = 0;
        if (decoded && Number(decoded.satoshis) > 0) sats = Math.floor(Number(decoded.satoshis));
        else if (decoded && Number(decoded.millisatoshis) > 0) sats = Math.floor(Number(decoded.millisatoshis) / 1000);
        if (!Number.isFinite(sats) || sats <= 0) return 0;
        return Math.min(sats, 1000000000);
    } catch (e) {
        return 0;
    }
}

async function tryLud21(verifyUrl, expectedHash) {
    const safe = String(verifyUrl || '');
    if (safe.indexOf('https://') !== 0) return { verified: false, reason: 'no-verify-url' };
    try {
        const res = await fetch(safe, { timeout: 4000, size: 65536, redirect: 'manual' });
        if (res.status !== 200) return { verified: false, reason: 'lud21-unverified' };
        const body = await res.json();
        const prHash = hashFromInvoice(body && body.pr) || tipConfirm.normalizePaymentHash(body && (body.prHash || body.payment_hash || body.paymentHash || body.pr));
        return tipConfirm.interpretLud21(200, Object.assign({}, body, { prHash: prHash }), expectedHash);
    } catch (e) {
        return { verified: false, reason: 'lud21-unverified' };
    }
}

async function tryNwc(paymentHash) {
    const hash = tipConfirm.normalizePaymentHash(paymentHash);
    if (!hash || !NWC_URL) return { verified: false, reason: NWC_URL ? 'no-payment-hash' : 'nwc-not-configured' };
    try {
        const { NWCClient } = require('@getalby/sdk');
        const nwc = new NWCClient({ nostrWalletConnectUrl: NWC_URL });
        const lookup = nwc.lookupInvoice({ payment_hash: hash });
        const invoice = await Promise.race([
            lookup,
            new Promise(function(_, reject) {
                setTimeout(function() { reject(new Error('nwc-timeout')); }, 4000);
            }),
        ]);
        return tipConfirm.interpretNwcLookup(invoice, hash);
    } catch (e) {
        return { verified: false, reason: 'nwc-not-found' };
    }
}

function domainOfAddress(address) {
    const text = String(address || '').trim().toLowerCase();
    const at = text.lastIndexOf('@');
    if (at < 1 || at === text.length - 1) return '';
    const host = text.slice(at + 1);
    if (!/^[a-z0-9.-]+$/.test(host) || host.indexOf('..') !== -1) return '';
    return host;
}

async function recipientLightning(recipientUid) {
    const pub = await db().collection('public_profiles').doc(recipientUid).get();
    if (!pub.exists) return '';
    const data = pub.data() || {};
    return String(data.lightningAddress || data.lightning || data.lnAddress || '').trim().toLowerCase();
}

async function linkedTip(callerUid, recipientUid) {
    const [leftDoc, rightDoc] = await Promise.all([
        db().collection('users').doc(callerUid).get(),
        db().collection('users').doc(recipientUid).get(),
    ]);
    const left = Object.assign({ uid: callerUid }, leftDoc.exists ? leftDoc.data() : {});
    const right = Object.assign({ uid: recipientUid }, rightDoc.exists ? rightDoc.data() : {});
    const flags = referrals.fraudFlags(left, right, '');
    return flags.some(function(flag) {
        return flag === 'self' || flag === 'same-fingerprint' || flag === 'same-email' || flag === 'same-lightning';
    });
}

async function verifyPayment(data, callerUid) {
    const decodedHash = hashFromInvoice(data && data.invoice);
    const clientHash = tipConfirm.normalizePaymentHash(data && data.paymentHash);
    if (decodedHash && clientHash && decodedHash !== clientHash) {
        return { verified: false, reason: 'hash-mismatch', paymentHash: '' };
    }
    const paymentHash = decodedHash || clientHash;
    const recipientUid = String((data && data.recipientUid) || '').trim();
    if (!recipientUid || recipientUid === callerUid) {
        return { verified: false, reason: recipientUid ? 'self-tip' : 'no-recipient', paymentHash: paymentHash };
    }
    const domain = domainOfAddress(await recipientLightning(recipientUid));
    if (!domain) return { verified: false, reason: 'no-lightning-address', paymentHash: paymentHash };
    if (await linkedTip(callerUid, recipientUid)) {
        return { verified: false, reason: 'linked-account', paymentHash: paymentHash };
    }
    const supplied = String((data && data.verifyUrl) || '').trim();
    if (!supplied) return { verified: false, reason: 'no-verify-url', paymentHash: paymentHash };
    const safe = tipConfirm.safeVerifyUrl(data.verifyUrl);
    if (!safe) return { verified: false, reason: 'bad-verify-url', paymentHash: paymentHash };
    let host = '';
    try { host = new URL(safe).hostname.toLowerCase(); } catch (e) {
        return { verified: false, reason: 'bad-verify-url', paymentHash: paymentHash };
    }
    if (host !== domain) return { verified: false, reason: 'verify-host-mismatch', paymentHash: paymentHash };
    try {
        await assertPublicHost(host);
    } catch (e) {
        return { verified: false, reason: 'verify-host-blocked', paymentHash: paymentHash };
    }
    const lud = await tryLud21(safe, paymentHash);
    if (lud.verified) return Object.assign({ paymentHash: paymentHash }, lud);
    if (paymentHash) {
        const nwc = await tryNwc(paymentHash);
        if (nwc.verified) return Object.assign({ paymentHash: paymentHash }, nwc);
        return { verified: false, reason: lud.reason || nwc.reason || 'lud21-unverified', paymentHash: paymentHash };
    }
    return { verified: false, reason: lud.reason || 'lud21-unverified', paymentHash: '' };
}

async function takeTipRate(uid, now) {
    const ref = db().collection('rate_limits').doc('tip_' + uid);
    let decision = { ok: false, reason: 'rate' };
    await db().runTransaction(async function(t) {
        const snap = await t.get(ref);
        const prev = snap.exists ? snap.data() : {};
        decision = tipConfirm.tipRateDecision({
            lastMs: prev.lastCall,
            windowStart: prev.windowStart,
            count: prev.count || 0,
        }, now);
        if (!decision.ok) return;
        t.set(ref, {
            lastCall: admin.firestore.Timestamp.fromMillis(decision.lastMs),
            windowStart: admin.firestore.Timestamp.fromMillis(decision.windowStart),
            count: decision.count,
        });
    });
    return decision;
}

async function confirmTipSent(data, context) {
    const uid = requireUser(context);
    const now = Date.now();
    const today = tipConfirm.utcDateKey(now);
    const capDay = offsetDateKey(now);
    const challengeId = tipConfirm.challengeIdForDate(today);

    const userRef = db().collection('users').doc(uid);
    const lockRef = userRef.collection('tip_confirmations').doc(today);
    const existingLock = await lockRef.get();
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw httpsError('not-found', 'User not found');
    const confirmedDate = existingLock.exists ? today : ((userSnap.data() || {}).tipConfirmedDate || '');
    const early = tipConfirm.decideTipConfirm({
        today: today,
        challengeId: challengeId,
        confirmedDate: confirmedDate,
        verified: false,
    });
    if (early.already) {
        return {
            success: true,
            already: true,
            awarded: 0,
            verified: existingLock.exists ? !!existingLock.data().verified : false,
            challengeCompleted: false,
            challengeId: challengeId,
        };
    }

    const rate = await takeTipRate(uid, now);
    if (!rate.ok) throw httpsError('resource-exhausted', 'Too many tip checks. Wait a moment and try again.');

    let verification = { verified: false, reason: 'not-tip-day', paymentHash: '' };
    if (tipConfirm.isTippingChallenge(challengeId)) {
        verification = await verifyPayment(data || {}, uid);
    }
    if (verification.verified && verification.paymentHash) {
        const used = await db().collection('tip_hashes').doc(verification.paymentHash).get();
        if (used.exists) {
            return {
                success: false,
                already: false,
                awarded: 0,
                verified: false,
                verifyReason: 'hash-used',
                challengeCompleted: false,
                challengeId: challengeId,
            };
        }
    }
    const call = tipConfirm.decideTipConfirm({
        today: today,
        challengeId: challengeId,
        confirmedDate: '',
        verified: !!verification.verified,
    });
    if (!call.record) {
        return {
            success: false,
            already: false,
            awarded: 0,
            verified: false,
            verifyReason: verification.reason || call.reason || 'unverified',
            challengeCompleted: false,
            challengeId: challengeId,
        };
    }

    const dailyRef = userRef.collection('daily_points').doc(capDay);
    const hashRef = (verification.verified && verification.paymentHash)
        ? db().collection('tip_hashes').doc(verification.paymentHash)
        : null;
    const recipientUid = String((data && data.recipientUid) || '').trim();
    const recipientRef = (hashRef && recipientUid) ? db().collection('users').doc(recipientUid) : null;
    const sats = hashRef ? invoiceSats(data && data.invoice) : 0;
    let result = null;

    await db().runTransaction(async function(t) {
        const reads = [t.get(userRef), t.get(lockRef), t.get(dailyRef)];
        if (hashRef) reads.push(t.get(hashRef));
        if (recipientRef) reads.push(t.get(recipientRef));
        const docs = await Promise.all(reads);
        const userDoc = docs[0];
        const lockDoc = docs[1];
        const dailyDoc = docs[2];
        const hashDoc = hashRef ? docs[3] : null;
        const recipientDoc = recipientRef ? docs[4] : null;
        if (hashDoc && hashDoc.exists) {
            result = {
                success: false,
                already: false,
                awarded: 0,
                verified: false,
                verifyReason: 'hash-used',
                challengeCompleted: false,
                challengeId: challengeId,
            };
            return;
        }
        if (!userDoc.exists) throw httpsError('not-found', 'User not found');
        const user = userDoc.data() || {};
        const confirmedDate = lockDoc.exists ? today : (user.tipConfirmedDate || '');
        if (confirmedDate === today) {
            result = {
                success: true,
                already: true,
                awarded: 0,
                verified: lockDoc.exists ? !!lockDoc.data().verified : false,
                challengeCompleted: false,
                challengeId: challengeId,
            };
            return;
        }
        const boost = doubleXp.boostPoints(call.awardXp, user, now);
        const dailyUsed = dailyDoc.exists ? (dailyDoc.data().total || 0) : 0;
        const split = splitDailyXp(dailyUsed, boost.points);
        const userUpdate = { tipConfirmedDate: today };
        if (call.challengeCompleted) userUpdate.tipChallengeDate = today;
        if (split.awarded > 0) {
            userUpdate.points = admin.firestore.FieldValue.increment(split.awarded);
            userUpdate.weeklyXP = admin.firestore.FieldValue.increment(split.awarded);
            userUpdate.monthlyXP = admin.firestore.FieldValue.increment(split.awarded);
            t.set(dailyRef, {
                total: dailyUsed + split.awarded,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        if (split.overflowAdded > 0) {
            userUpdate.pendingOverflow = admin.firestore.FieldValue.increment(split.overflowAdded);
            userUpdate.lastOverflowDate = capDay;
        }
        let tipsCounted = false;
        if (hashRef) {
            userUpdate.tipsVerified = admin.firestore.FieldValue.increment(1);
            if (sats > 0) userUpdate.tipsSentSats = admin.firestore.FieldValue.increment(sats);
            tipsCounted = true;
        }
        t.update(userRef, userUpdate);
        let creditedRecipient = '';
        if (tipsCounted && recipientDoc && recipientDoc.exists) {
            t.update(recipientRef, { tipsReceived: admin.firestore.FieldValue.increment(1) });
            creditedRecipient = recipientUid;
        }
        if (hashRef) {
            t.set(hashRef, {
                uid: uid,
                recipientUid: String((data && data.recipientUid) || ''),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        t.set(lockRef, {
            uid: uid,
            date: today,
            challengeId: challengeId,
            verified: !!verification.verified,
            verifyReason: verification.reason || 'confirmation',
            paymentHash: verification.paymentHash || '',
            awarded: split.awarded,
            doubled: !!boost.doubled,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const note = userRef.collection('notifications').doc();
        const xpText = split.awarded > 0 ? (' +' + split.awarded + ' XP' + (boost.doubled ? ' (2×)' : '') + '.') : '.';
        const body = call.challengeCompleted
            ? ('Tipping challenge complete' + xpText)
            : ('Tip recorded' + (verification.verified ? ' and verified' : '') + xpText);
        t.set(note, {
            type: 'tip_confirmed',
            title: verification.verified ? '⚡ Tip verified' : '⚡ Tip recorded',
            body: body,
            read: false,
            ts: admin.firestore.FieldValue.serverTimestamp(),
        });
        t.set(db().collection('notifications').doc(), {
            recipientId: uid,
            senderId: 'system',
            senderName: 'Lightning',
            type: 'tip_confirmed',
            message: body,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        result = {
            success: true,
            already: false,
            awarded: split.awarded,
            overflowAdded: split.overflowAdded,
            doubled: !!boost.doubled,
            verified: !!verification.verified,
            verifyReason: verification.reason || 'confirmation',
            challengeCompleted: !!call.challengeCompleted,
            challengeId: challengeId,
            tipsCounted: tipsCounted,
            tipsSentSats: tipsCounted ? sats : 0,
            recipientUid: creditedRecipient,
        };
    });
    if (result && result.tipsCounted) {
        try {
            const { grantFamily, familyFor } = require('./grantBadge');
            const ids = familyFor('tipsVerified').slice();
            if (result.tipsSentSats > 0) ids.push.apply(ids, familyFor('tipsSentSats'));
            await grantFamily(db(), admin, uid, ids);
            if (result.recipientUid) {
                await grantFamily(db(), admin, result.recipientUid, familyFor('tipsReceived'));
            }
        } catch (tipBadgeErr) {
            console.warn('[TIP] badges', tipBadgeErr && tipBadgeErr.message);
        }
    }
    return result || { success: false, awarded: 0 };
}

module.exports = {
    confirmTipSent: confirmTipSent,
    verifyPayment: verifyPayment,
    hashFromInvoice: hashFromInvoice,
};
