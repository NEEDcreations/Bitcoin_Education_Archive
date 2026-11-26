'use strict';

// Spark Citizen teaser credit. The client may send { phase: 'start'|'complete' }.
// Elapsed time, the day, and the running count are never read from the body.

const functionsV1 = require('firebase-functions/v1');
const admin = require('./src/firebaseAdmin.js');
const spark = require('./src/sparkCitizen');
const { rewardBlocked } = require('./src/cipherClaim');
const { serverHoldsBadge } = require('./src/badgeProfile');
const badgeTiers = require('./src/badgeTiers');

const db = admin.firestore();

function tierCrossed(before, after) {
    const ids = badgeTiers.familyForField('sparkCitizenCount');
    const info = badgeTiers.tierInfo;
    return ids.some(function (id) {
        const gte = info(id).gte;
        return before < gte && after >= gte;
    });
}

const sparkCitizenTeaser = functionsV1.runWith({
    enforceAppCheck: true,
}).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const provider = context.auth.token && context.auth.token.firebase
        ? context.auth.token.firebase.sign_in_provider
        : '';
    if (provider === 'anonymous') {
        throw new functionsV1.https.HttpsError('permission-denied', 'Sign in required');
    }

    const phase = data && data.phase;
    if (phase !== 'start' && phase !== 'complete') {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Unknown phase');
    }

    const nowMs = Date.now();
    if (!spark.launchOpen(nowMs)) {
        throw new functionsV1.https.HttpsError('failed-precondition', 'Not available yet');
    }

    const uid = context.auth.uid;
    const stateRef = db.collection('spark_citizen').doc(uid);
    const userRef = db.collection('users').doc(uid);
    const ledgerRef = db.collection('faucet_ledger').doc(uid);
    const rateRef = db.collection('rate_limits').doc('sparkcitizen_' + uid);

    const result = await db.runTransaction(async (tx) => {
        const stateSnap = await tx.get(stateRef);
        const userSnap = await tx.get(userRef);
        const ledgerSnap = await tx.get(ledgerRef);
        const rateSnap = await tx.get(rateRef);

        if (!userSnap.exists) {
            throw new functionsV1.https.HttpsError('not-found', 'User not found');
        }

        const ratePrev = rateSnap.exists ? (rateSnap.data() || {}) : {};
        const rate = spark.nextRate({
            windowStartMs: spark.creditMillis(ratePrev.windowStartMs) != null
                ? ratePrev.windowStartMs
                : spark.creditMillis(ratePrev.windowStart),
            count: ratePrev.count,
        }, nowMs);
        if (!rate.ok) {
            throw new functionsV1.https.HttpsError('resource-exhausted', 'Slow down');
        }

        const user = userSnap.data() || {};
        const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
        const stored = stateSnap.exists ? (stateSnap.data() || {}) : {};
        const banned = rewardBlocked(user, ledger);
        const input = {
            startAtMs: spark.creditMillis(stored.startAtMs),
            creditDay: stored.creditDay || '',
            banned: banned,
        };
        const decision = phase === 'start'
            ? spark.applyStart(input, nowMs)
            : spark.applyComplete(input, nowMs);

        const expireAtMs = spark.rateExpireAt(rate.windowStartMs);
        tx.set(rateRef, {
            windowStartMs: rate.windowStartMs,
            windowStart: admin.firestore.Timestamp.fromMillis(rate.windowStartMs),
            count: rate.count,
            expireAt: admin.firestore.Timestamp.fromMillis(expireAtMs),
        });

        if (decision.state) {
            const payload = {
                creditDay: decision.state.creditDay || '',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (typeof decision.state.startAtMs === 'number') {
                payload.startAtMs = decision.state.startAtMs;
            } else {
                payload.startAtMs = null;
            }
            tx.set(stateRef, payload, { merge: true });
        }

        const before = Math.max(0, Math.floor(Number(user.sparkCitizenCount) || 0));
        if (decision.credit > 0) {
            tx.set(userRef, {
                sparkCitizenCount: admin.firestore.FieldValue.increment(decision.credit),
            }, { merge: true });
        }

        const awardedIds = badgeTiers.familyIds('spark_citizen').filter(function (id) {
            return serverHoldsBadge(user, id);
        });
        return {
            ok: decision.ok !== false && decision.reason !== 'banned',
            reason: decision.reason,
            credit: decision.credit || 0,
            count: before + (decision.credit || 0),
            day: decision.day || spark.offsetDateKey(nowMs),
            tierCrossed: decision.credit > 0 && tierCrossed(before, before + decision.credit),
            retryGrant: decision.reason === 'day-cap' && spark.needsGrant(before, awardedIds),
        };
    });

    if (result && (result.tierCrossed || result.retryGrant || result.credit > 0)) {
        try {
            const grant = require('./src/grantBadge');
            await grant.grantFamily(db, admin, uid, grant.familyFor('sparkCitizenCount'));
        } catch (e) { console.warn('[sparkCitizen] tier badges', e && e.message); }
    }
    if (result) {
        delete result.tierCrossed;
        delete result.retryGrant;
    }
    return result;
});

module.exports = {
    sparkCitizenTeaser: sparkCitizenTeaser,
};
