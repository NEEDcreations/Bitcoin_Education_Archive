'use strict';

// confirmTipSent records one tip confirmation per UTC day.
// Verification is attempted only when it is cheap:
//   1. LUD-21 verify URL (https, public host, no redirects)
//   2. Our NWC lookupInvoice by payment hash, when NWC_URL is set
// A miss, a timeout, or an invoice that is not ours falls back to the
// confirmation. The tipping daily challenge XP is awarded at most once.

const functionsV1 = require('firebase-functions/v1');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const bolt11 = require('bolt11');
const tipConfirm = require('./tipConfirm');
const doubleXp = require('./doubleXp');
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
    const safe = tipConfirm.safeVerifyUrl(verifyUrl);
    if (!safe) return { verified: false, reason: 'no-verify-url' };
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
    const lud = await tryLud21(data && data.verifyUrl);
    if (lud.verified) return Object.assign({ paymentHash: paymentHash }, lud);
    if (paymentHash) {
        const nwc = await tryNwc(paymentHash);
        if (nwc.verified) return Object.assign({ paymentHash: paymentHash }, nwc);
        return { verified: false, reason: lud.reason === 'no-verify-url' ? nwc.reason : lud.reason, paymentHash: paymentHash };
    }
    return { verified: false, reason: lud.reason || 'confirmation', paymentHash: '' };
}

async function confirmTipSent(data, context) {
    const uid = requireUser(context);
    const now = Date.now();
    const today = tipConfirm.utcDateKey(now);
    const capDay = offsetDateKey(now);
    const challengeId = tipConfirm.challengeIdForDate(today);
    const verification = await verifyPayment(data || {});

    const userRef = db().collection('users').doc(uid);
    const lockRef = userRef.collection('tip_confirmations').doc(today);
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
        const call = tipConfirm.decideTipConfirm({
            today: today,
            challengeId: challengeId,
            confirmedDate: confirmedDate,
        });
        if (!call.record) {
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
