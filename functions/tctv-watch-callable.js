'use strict';

// Heartbeat for the daily Timechain TV watch reward.
// This is not a second viewer-count heartbeat. Live presence stays on
// tctv_presence, folded by tctvAggregatePresence. This callable only
// runs while the page says the YouTube player is PLAYING, and it credits
// time only when that uid's presence doc is still fresh on a real station.

const functionsV1 = require('firebase-functions/v1');
const admin = require('./src/firebaseAdmin.js');
const tctvPresence = require('./tctv-presence-lib');
const watch = require('./src/tctvWatch');
const rewardNotify = require('./src/rewardNotify');
const ticketGrants = require('./src/ticketGrants');
const { rewardBlocked } = require('./src/cipherClaim');
const claimReqs = require('./src/claimReqs');

const db = admin.firestore();

// True when a lifetime total crosses a 5-tier threshold (badgeTiers).
function tierCrossed(before, after) {
    const ids = require('./src/badgeTiers').familyForField('tctvLifetimeSeconds');
    const info = require('./src/badgeTiers').tierInfo;
    return ids.some(function (id) {
        const gte = info(id).gte;
        return before < gte && after >= gte;
    });
}

const tctvWatchHeartbeat = functionsV1.runWith({
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

    // The body is ignored. Elapsed time, day, and prize amounts from the
    // client are never read.
    const uid = context.auth.uid;
    const nowMs = Date.now();
    const today = watch.offsetDateKey(nowMs);
    const watchRef = db.collection('tctv_watch').doc(uid);
    const userRef = db.collection('users').doc(uid);
    const ledgerRef = db.collection('faucet_ledger').doc(uid);
    const presenceRef = db.collection('tctv_presence').doc(uid);
    const rateRef = db.collection('rate_limits').doc('tctvwatch_' + uid);
    const dailyRef = userRef.collection('daily_points').doc(today);
    const claimRef = userRef.collection('award_claims').doc(ticketGrants.claimId('tctv_watch_ticket', today));

    const watchResult = await db.runTransaction(async (tx) => {
        const watchSnap = await tx.get(watchRef);
        const userSnap = await tx.get(userRef);
        const ledgerSnap = await tx.get(ledgerRef);
        const presenceSnap = await tx.get(presenceRef);
        const rateSnap = await tx.get(rateRef);
        const dailySnap = await tx.get(dailyRef);
        const claimSnap = await tx.get(claimRef);

        if (!userSnap.exists) {
            throw new functionsV1.https.HttpsError('not-found', 'User not found');
        }

        const ratePrev = rateSnap.exists ? (rateSnap.data() || {}) : {};
        const rate = watch.nextWatchRate({
            windowStartMs: watch.creditMillis(ratePrev.windowStartMs) != null
                ? ratePrev.windowStartMs
                : watch.creditMillis(ratePrev.windowStart),
            count: ratePrev.count,
        }, nowMs);
        if (!rate.ok) {
            throw new functionsV1.https.HttpsError('resource-exhausted', 'Slow down');
        }

        const user = userSnap.data() || {};
        const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
        const banned = rewardBlocked(user, ledger);
        const presence = presenceSnap.exists ? (presenceSnap.data() || {}) : null;
        const stored = watchSnap.exists ? (watchSnap.data() || {}) : {};
        const lastCredit = watch.creditMillis(stored.lastCreditAt);
        const stationOk = tctvPresence.isTctvStation(presence && presence.station);
        const freshOk = tctvPresence.isFreshPresence(presence, nowMs);
        const decision = watch.applyWatchHeartbeat({
            uid: uid,
            day: stored.day,
            seconds: stored.seconds,
            lastCreditMs: lastCredit != null ? lastCredit : watch.creditMillis(stored.lastCreditMs),
            awardedDay: stored.awardedDay,
            toastSeen: stored.toastSeen === true,
            banned: banned,
            presenceFresh: freshOk && stationOk,
        }, nowMs);

        // Lifetime watch seconds for the 5-tier badges. Server clock only;
        // keeps counting after the daily goal, up to 3 hours per offset day.
        const life = watch.applyLifetimeCredit({
            lifeDay: stored.lifeDay,
            lifeDaySeconds: stored.lifeDaySeconds,
            lifeLastMs: watch.creditMillis(stored.lifeLastMs),
            banned: banned,
            presenceFresh: freshOk && stationOk,
        }, nowMs);
        const lifeBefore = Math.max(0, Math.floor(Number(user.tctvLifetimeSeconds) || 0));
        if (life.write && life.state) {
            tx.set(watchRef, {
                lifeDay: life.state.lifeDay,
                lifeDaySeconds: life.state.lifeDaySeconds,
                lifeLastMs: life.state.lifeLastMs,
            }, { merge: true });
        }
        if (life.credit > 0) {
            tx.set(userRef, {
                tctvLifetimeSeconds: admin.firestore.FieldValue.increment(life.credit),
            }, { merge: true });
        }

        // 'done' and 'too-fast' must not consume the rate budget unless the
        // lifetime clock wrote. The check above already threw when the
        // stored window was exhausted.
        if ((decision.reason !== 'done' && decision.reason !== 'too-fast') || life.write) {
            tx.set(rateRef, {
                windowStartMs: rate.windowStartMs,
                windowStart: admin.firestore.Timestamp.fromMillis(rate.windowStartMs),
                count: rate.count,
            });
        }

        if (decision.write && decision.state) {
            const payload = {
                day: decision.state.day,
                seconds: decision.state.seconds,
                awardedDay: decision.state.awardedDay || '',
                toastSeen: decision.state.toastSeen === true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (typeof decision.state.lastCreditMs === 'number') {
                payload.lastCreditMs = decision.state.lastCreditMs;
                payload.lastCreditAt = admin.firestore.Timestamp.fromMillis(decision.state.lastCreditMs);
            }
            tx.set(watchRef, payload, { merge: true });
        }

        const view = decision.view || {};
        let xpAwarded = 0;
        let ticketsOut = 0;
        let notice = decision.notice;
        let xpDoubled = false;
        if (view.awarded) {
            const dailyUsed = dailySnap.exists ? ((dailySnap.data() || {}).total || 0) : 0;
            const xpPlan = watch.planWatchXp(
                dailyUsed,
                user.pendingOverflow || 0,
                user.lastOverflowDate || '',
                view.day || today,
                { user: user, now: Date.now() }
            );
            xpAwarded = xpPlan.awarded;
            xpDoubled = xpPlan.doubled === true;
            ticketsOut = (xpPlan.awarded > 0 && !claimSnap.exists) ? watch.REWARD_TICKETS : 0;
            notice = watch.buildWatchNotice(uid, view.day || today, xpPlan.awarded, ticketsOut) || null;
            const userUpdate = {};
            if (ticketsOut > 0) {
                userUpdate.orangeTickets = admin.firestore.FieldValue.increment(ticketsOut);
                userUpdate.tctvWatchDays = admin.firestore.FieldValue.increment(1);
            }
            if (xpPlan.awarded > 0) {
                userUpdate.points = admin.firestore.FieldValue.increment(xpPlan.awarded);
                userUpdate.weeklyXP = admin.firestore.FieldValue.increment(xpPlan.awarded);
                userUpdate.monthlyXP = admin.firestore.FieldValue.increment(xpPlan.awarded);
            }
            if (Object.keys(userUpdate).length) tx.update(userRef, userUpdate);
            if (ticketsOut > 0) {
                tx.set(claimRef, {
                    action: 'tctv_watch_ticket',
                    tickets: ticketsOut,
                    day: view.day || today,
                    at: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            if (xpPlan.awarded > 0) {
                tx.set(dailyRef, {
                    total: xpPlan.dailyXp != null ? xpPlan.dailyXp : ((Number(dailyUsed) || 0) + xpPlan.awarded),
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            if (notice && notice.id && notice.data) {
                rewardNotify.apply(tx, db, admin.firestore.FieldValue.serverTimestamp(), [notice]);
            }
        }

        const watchedSeconds = Math.max(
            Number(view.seconds) || 0,
            decision.state ? Number(decision.state.seconds) || 0 : 0,
            Number(stored.seconds) || 0
        );
        if (claimReqs.tctvQualifies(watchedSeconds) && !claimReqs.stampMillis((user.claimReq || {}).tctvAt)) {
            tx.update(userRef, {
                'claimReq.tctvAt': admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        const showToast = view.showToast === true && (xpAwarded > 0 || ticketsOut > 0);
        return {
            ok: decision.ok !== false && decision.reason !== 'banned',
            reason: decision.reason,
            day: view.day || today,
            seconds: view.seconds || 0,
            minutes: view.minutes || 0,
            done: view.done === true,
            awarded: view.awarded === true,
            showToast: showToast,
            toast: showToast ? ((notice && notice.data && notice.data.message) || watch.TOAST_TEXT) : '',
            xp: view.awarded ? xpAwarded : 0,
            doubled: xpDoubled,
            tickets: view.awarded ? ticketsOut : 0,
            watchDay: ticketsOut > 0,
            // false while lifetime watch time can still be credited today,
            // so the client keeps sending heartbeats after the daily goal.
            lifeCapped: life.capped === true || life.reason === 'banned',
            // Also re-check at the start of each watch session, so a failed
            // grant after a crossing is retried later (grantFamily is idempotent).
            lifeTierCrossed: tierCrossed(lifeBefore, lifeBefore + (life.credit || 0))
                || (life.reason === 'clock' && lifeBefore >= 600),
        };
    });
    if (watchResult && watchResult.watchDay) {
        try {
            const grant = require('./src/grantBadge');
            await grant.grantFamily(db, admin, uid, grant.familyFor('tctvWatchDays'));
        } catch (e) { console.warn('[tctvWatch] badges', e.message); }
        try {
            await require('./src/raidBossEngine').noteTrusted(db, admin, {
                metric: 'tctvWatchDays',
                uid: uid,
                dedupeKey: 'tctv-' + uid + '-' + (watchResult.day || today),
                amount: 1,
                now: new Date(),
            });
        } catch (e) { console.warn('[tctvWatch] raid', e && e.message); }
    }
    if (watchResult && watchResult.lifeTierCrossed) {
        try {
            const grant = require('./src/grantBadge');
            await grant.grantFamily(db, admin, uid, grant.familyFor('tctvLifetimeSeconds'));
        } catch (e) { console.warn('[tctvWatch] tier badges', e.message); }
    }
    if (watchResult) delete watchResult.lifeTierCrossed;
    if (watchResult && watchResult.tickets > 0) {
        try {
            await require('./src/comboActivity').noteComboZone(db, admin, uid, 'tctv', today);
        } catch (comboErr) { /* the watch reward already committed */ }
    }
    return watchResult;
});

module.exports = {
    tctvWatchHeartbeat: tctvWatchHeartbeat,
    tierCrossed: tierCrossed,
};
