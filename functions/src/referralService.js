'use strict';

// Firestore wiring for referrals. Decisions live in referrals.js so tests
// can run without Firebase. Admin SDK writes bypass the security rules.

const functionsV1 = require('firebase-functions/v1');
const admin = require('firebase-admin');
const referrals = require('./referrals');
const rewardNotify = require('./rewardNotify');

function db() {
    return admin.firestore();
}

function httpsError(code, message) {
    return new functionsV1.https.HttpsError(code, message);
}

function requireUser(context) {
    if (!context || !context.auth) throw httpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token && context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw httpsError('permission-denied', 'Anonymous users cannot use referrals');
    }
    return context.auth.uid;
}

function requestIp(context) {
    const req = context && context.rawRequest;
    if (!req) return '';
    const headers = req.headers || {};
    const forwarded = String(headers['x-forwarded-for'] || '').split(',')[0].trim();
    return String(forwarded || req.ip || '').slice(0, 64);
}

function userView(uid, data) {
    return Object.assign({ uid: uid }, data || {});
}

async function lookupReferrerUid(code, selfUid) {
    const normalized = referrals.normalizeCode(code);
    if (!normalized) return '';
    const codeDoc = await db().collection('referralCodes').doc(normalized).get();
    if (codeDoc.exists) {
        const owner = codeDoc.data().uid || '';
        if (owner && owner !== selfUid) return owner;
    }
    const byField = await db().collection('users').where('referralCode', '==', normalized).limit(2).get();
    if (byField.size === 1 && byField.docs[0].id !== selfUid) return byField.docs[0].id;
    if (byField.size > 1) return '';
    const prefix = await db().collection('users')
        .orderBy(admin.firestore.FieldPath.documentId())
        .startAt(normalized)
        .endAt(normalized + '\uf8ff')
        .limit(5)
        .get();
    const hits = prefix.docs.filter(function(doc) {
        return doc.id.indexOf(normalized) === 0 && doc.id !== selfUid;
    });
    if (hits.length === 1) return hits[0].id;
    return '';
}

async function ensureReferralCode(uid) {
    const code = referrals.referralCodeForUid(uid);
    if (!code) return '';
    const userRef = db().collection('users').doc(uid);
    const codeRef = db().collection('referralCodes').doc(code);
    await db().runTransaction(async function(t) {
        const [userDoc, codeDoc] = await Promise.all([t.get(userRef), t.get(codeRef)]);
        if (!userDoc.exists) return;
        if (userDoc.data().referralCode !== code) {
            t.update(userRef, { referralCode: code });
        }
        const owner = codeDoc.exists ? (codeDoc.data().uid || '') : '';
        if (!owner) {
            t.set(codeRef, {
                uid: uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
    });
    return code;
}

function referralPayload(referredUid, referrerUid, code, status, flags, signupIp) {
    return {
        referredUserUid: referredUid,
        referredUid: referredUid,
        referredUser: referredUid,
        referrerUid: referrerUid || '',
        referrerCode: code,
        status: status,
        verified: false,
        ticketsAwarded: false,
        rejectionFlags: flags || [],
        signupIp: signupIp || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
}

async function registerReferral(data, context) {
    const uid = requireUser(context);
    const code = referrals.normalizeCode(data && data.refCode);
    if (!code) throw httpsError('invalid-argument', 'Referral code is missing');
    if (referrals.isSelfReferral(uid, code)) return { success: false, reason: 'self' };

    await ensureReferralCode(uid);
    const referrerUid = await lookupReferrerUid(code, uid);
    const signupIp = requestIp(context);
    const referredSnap = await db().collection('users').doc(uid).get();
    if (!referredSnap.exists) throw httpsError('not-found', 'User not found');
    const referred = userView(uid, referredSnap.data());
    let referrer = null;
    if (referrerUid) {
        const referrerSnap = await db().collection('users').doc(referrerUid).get();
        if (referrerSnap.exists) referrer = userView(referrerUid, referrerSnap.data());
    }
    const flags = referrer ? referrals.fraudFlags(referred, referrer, signupIp) : [];
    const status = referrer ? referrals.statusForFlags(flags) : 'pending';

    const refRef = db().collection('referrals').doc(uid);
    const userRef = db().collection('users').doc(uid);
    let created = false;
    await db().runTransaction(async function(t) {
        const existing = await t.get(refRef);
        if (existing.exists) return;
        const fresh = await t.get(userRef);
        if (!fresh.exists) return;
        if (fresh.data().referredBy && fresh.data().referredBy !== code) return;
        t.set(refRef, referralPayload(uid, referrer ? referrer.uid : '', code, status, flags, signupIp));
        t.update(userRef, {
            referredBy: code,
            referralVerified: false,
        });
        created = true;
    });

    let paid = false;
    if ((Number(referred.points) || 0) >= referrals.MAXI_POINTS) {
        const result = await payIfQualified(uid);
        paid = !!(result && result.paid);
    }
    return { success: true, reason: created ? status : 'exists', status: status, paid: paid };
}

async function payIfQualified(referredUid) {
    const uid = String(referredUid || '');
    if (!uid) return { paid: false, reason: 'missing-user' };
    const refRef = db().collection('referrals').doc(uid);
    const referredRef = db().collection('users').doc(uid);
    const pre = await refRef.get();
    if (!pre.exists) {
        const userSnap = await referredRef.get();
        if (!userSnap.exists || !userSnap.data().referredBy) return { paid: false, reason: 'no-referral' };
        const code = referrals.normalizeCode(userSnap.data().referredBy);
        if (!code || referrals.isSelfReferral(uid, code)) return { paid: false, reason: 'self' };
        const referrerUid = await lookupReferrerUid(code, uid);
        await db().runTransaction(async function(t) {
            const again = await t.get(refRef);
            if (again.exists) return;
            t.set(refRef, referralPayload(uid, referrerUid, code, 'pending', [], ''));
        });
    }

    const current = await refRef.get();
    if (!current.exists) return { paid: false, reason: 'no-referral' };
    const referrerUid = current.data().referrerUid || await lookupReferrerUid(current.data().referrerCode, uid);
    if (!referrerUid) return { paid: false, reason: 'missing-user' };
    const referrerRef = db().collection('users').doc(referrerUid);

    let outcome = { paid: false, reason: 'skip' };
    await db().runTransaction(async function(t) {
        const [referralDoc, referredDoc, referrerDoc] = await Promise.all([
            t.get(refRef),
            t.get(referredRef),
            t.get(referrerRef),
        ]);
        if (!referralDoc.exists || !referredDoc.exists || !referrerDoc.exists) {
            outcome = { paid: false, reason: 'missing-user' };
            return;
        }
        const decision = referrals.assessReferralPayout({
            referral: referralDoc.data(),
            referred: userView(uid, referredDoc.data()),
            referrer: userView(referrerUid, referrerDoc.data()),
            signupIp: referralDoc.data().signupIp || '',
        });
        if (decision.action === 'skip') {
            outcome = { paid: false, reason: decision.reason };
            return;
        }
        if (decision.action === 'flag' || decision.action === 'reject') {
            t.update(refRef, {
                status: decision.action === 'reject' ? 'rejected' : 'flagged',
                rejectionFlags: decision.flags || [],
                ticketsAwarded: false,
                verified: false,
            });
            outcome = { paid: false, reason: decision.reason };
            return;
        }
        const tickets = referrals.REFERRAL_TICKETS;
        t.update(refRef, {
            status: 'paid',
            verified: true,
            ticketsAwarded: true,
            referrerUid: referrerUid,
            referredUserUid: uid,
            referredUid: uid,
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            ticketsEach: tickets,
        });
        t.update(referrerRef, {
            orangeTickets: admin.firestore.FieldValue.increment(tickets),
            referralTicketsEarned: admin.firestore.FieldValue.increment(tickets),
            referralCount: admin.firestore.FieldValue.increment(1),
        });
        t.update(referredRef, {
            orangeTickets: admin.firestore.FieldValue.increment(tickets),
            referralVerified: true,
        });
        const stamp = admin.firestore.FieldValue.serverTimestamp();
        rewardNotify.apply(t, db(), stamp, rewardNotify.plan({
            uid: referrerUid,
            tickets: tickets,
            sourceLabel: 'a referral reaching Maxi',
            icon: '🎟️',
            onceKey: 'referral_out_' + uid,
        }));
        rewardNotify.apply(t, db(), stamp, rewardNotify.plan({
            uid: uid,
            tickets: tickets,
            sourceLabel: 'reaching Maxi with a referral',
            icon: '🎟️',
            onceKey: 'referral_in_' + referrerUid,
        }));
        outcome = { paid: true, reason: 'paid', ticketsEach: tickets, referrerUid: referrerUid };
    });
    return outcome;
}

async function onUserWritten(event) {
    const afterSnap = event.data && event.data.after;
    if (!afterSnap || !afterSnap.exists) return null;
    const uid = event.params.uid;
    const before = event.data.before && event.data.before.exists ? (event.data.before.data() || {}) : {};
    const after = afterSnap.data() || {};
    try {
        if (!after.referralCode) await ensureReferralCode(uid);
        const crossed = referrals.crossedMaxi(before.points, after.points);
        const referredByNew = !!after.referredBy && after.referredBy !== before.referredBy;
        const atMaxi = (Number(after.points) || 0) >= referrals.MAXI_POINTS;
        if (crossed || (referredByNew && atMaxi)) await payIfQualified(uid);
    } catch (e) {
        console.error('[onUserReferral]', e && e.message ? e.message : e);
    }
    return null;
}

async function scanPending(limit) {
    const cap = Math.max(1, Math.min(40, Number(limit) || 40));
    const snap = await db().collection('referrals').where('status', '==', 'pending').limit(cap).get();
    let paid = 0;
    for (let i = 0; i < snap.docs.length; i++) {
        try {
            const result = await payIfQualified(snap.docs[i].id);
            if (result && result.paid) paid++;
        } catch (e) {
            console.error('[payQualifiedReferrals]', e && e.message ? e.message : e);
        }
    }
    return { scanned: snap.size, paid: paid };
}

module.exports = {
    registerReferral: registerReferral,
    payIfQualified: payIfQualified,
    onUserWritten: onUserWritten,
    scanPending: scanPending,
    ensureReferralCode: ensureReferralCode,
    lookupReferrerUid: lookupReferrerUid,
};
