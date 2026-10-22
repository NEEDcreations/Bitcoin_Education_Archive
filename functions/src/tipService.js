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

async function tryLud21(verifyUrl) {
    const safe = String(verifyUrl || '');
    if (safe.indexOf('https://') !== 0) return { verified: false, reason: 'no-verify-url' };
    try {
        const res = await fetch(safe, { timeout: 4000, size: 65536, redirect: 'manual' });
        if (res.status !== 200) return { verified: false, reason: 'lud21-unverified' };
        const body = await res.json();
        return tipConfirm.interpretLud21(200, body);
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
        return tipConfirm.interpretNwcLookup(invoice);
    } catch (e) {
        return { verified: false, reason: 'nwc-not-found' };
    }
}

async function verifyPayment(data) {
    const decodedHash = hashFromInvoice(data && data.invoice);
    const clientHash = tipConfirm.normalizePaymentHash(data && data.paymentHash);
    const paymentHash = decodedHash || clientHash;
    const rawUrl = data && data.verifyUrl;
    const supplied = String(rawUrl || '').trim();
    let ludReason = 'no-verify-url';
    if (supplied) {
        const safe = tipConfirm.safeVerifyUrl(rawUrl);
        if (!safe) return { verified: false, reason: 'bad-verify-url', paymentHash: paymentHash };
        try {
            await assertPublicHost(new URL(safe).hostname);
        } catch (e) {
            return { verified: false, reason: 'verify-host-blocked', paymentHash: paymentHash };
        }
        const lud = await tryLud21(safe);
        if (lud.verified) return Object.assign({ paymentHash: paymentHash }, lud);
        ludReason = lud.reason || 'lud21-unverified';
    }
    if (paymentHash) {
        const nwc = await tryNwc(paymentHash);
        if (nwc.verified) return Object.assign({ paymentHash: paymentHash }, nwc);
        return { verified: false, reason: ludReason === 'no-verify-url' ? nwc.reason : ludReason, paymentHash: paymentHash };
    }
    return { verified: false, reason: ludReason, paymentHash: '' };
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
        verification = await verifyPayment(data || {});
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
    let result = null;

    await db().runTransaction(async function(t) {
        const [userDoc, lockDoc, dailyDoc] = await Promise.all([
            t.get(userRef),
            t.get(lockRef),
            t.get(dailyRef),
        ]);
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
        t.update(userRef, userUpdate);
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
        };
    });
    return result || { success: false, awarded: 0 };
}

module.exports = {
    confirmTipSent: confirmTipSent,
    verifyPayment: verifyPayment,
    hashFromInvoice: hashFromInvoice,
};
