'use strict';

// Daily trifecta SF credit and the all-five badge.
// The TV step is the award_claims doc #65 writes:
// users/{uid}/award_claims/{day}_tctv_watch_ticket
// Trivia and quest proof docs are still written by the current graders.
// Poll proof is only the server poll vote doc.

const TCTV_WATCH_DEPLOYED = true;

function tctvClaimId(day) {
    return day + '_tctv_watch_ticket';
}

const { rewardBlocked } = require('./cipherClaim');
const DAILY_FIVE_XP = 100;
const DAILY_FIVE_TICKETS = 1;
const { planDailyXp } = require('./dailyXp');
const { grantFamily } = require('./grantBadge');

function offsetDateKey(nowMs) {
    const shifted = new Date(Number(nowMs || Date.now()) - 5 * 3600 * 1000);
    return shifted.toISOString().slice(0, 10);
}

function previousOffsetDay(nowMs) {
    return offsetDateKey(Number(nowMs || Date.now()) - 24 * 3600 * 1000);
}

async function proofsFor(db, uid, day) {
    const base = db.collection('users').doc(uid);
    const [trivia, quest, poll, sayHi, tctv] = await Promise.all([
        base.collection('daily_action_counts').doc(day + '_trivia').get(),
        base.collection('daily_action_counts').doc(day + '_quest').get(),
        db.collection('polls').doc(day).collection('votes').doc(uid).get(),
        base.collection('daily_action_counts').doc(day + '_say_hi').get(),
        base.collection('award_claims').doc(tctvClaimId(day)).get(),
    ]);
    return {
        trivia: !!(trivia && trivia.exists),
        quest: !!(quest && quest.exists && Number((quest.data() || {}).count || 0) >= 1),
        poll: !!(poll && poll.exists),
        sayHi: !!(sayHi && sayHi.exists),
        tctv: !!(tctv && tctv.exists),
    };
}

async function maybeCompleteTrifecta(opts) {
    const o = opts || {};
    const credit = o.creditDailyAllThree;
    if (typeof credit !== 'function') return { ok: false, reason: 'no_credit' };
    if (!o.uid || !o.day) return { ok: false, reason: 'missing' };
    if (o.anonymous) return { ok: false, reason: 'anonymous' };
    if (o.banned) return { ok: false, reason: 'banned' };
    const proofs = o.proofs || await proofsFor(o.db, o.uid, o.day);
    if (!proofs.trivia || !proofs.quest || !proofs.poll) {
        return { ok: false, reason: 'incomplete', proofs: proofs };
    }
    const credited = await credit(o.uid, o.day);
    if (credited && credited.created && o.db && o.admin) {
        await grantFamily(o.db, o.admin, o.uid, [
            'daily_triple_1', 'daily_triple_7', 'daily_triple_30', 'daily_triple_90', 'daily_triple_365',
            'sf_trifecta_10', 'sf_trifecta_50', 'sf_trifecta_100',
        ], { day: o.day });
    }
    return { ok: !!(credited && (credited.created || credited.already)), credited: credited, proofs: proofs };
}

async function maybeCompleteDailyFive(opts) {
    const o = opts || {};
    const deployed = o.tctvWatchDeployed != null ? o.tctvWatchDeployed === true : TCTV_WATCH_DEPLOYED;
    if (!deployed) return { ok: false, reason: 'tctv_not_deployed' };
    if (!o.db || !o.admin || !o.uid || !o.day) return { ok: false, reason: 'missing' };
    if (o.anonymous) return { ok: false, reason: 'anonymous' };
    if (o.banned) return { ok: false, reason: 'banned' };
    const proofs = o.proofs || await proofsFor(o.db, o.uid, o.day);
    if (!proofs.trivia || !proofs.quest || !proofs.poll || !proofs.sayHi || !proofs.tctv) {
        return { ok: false, reason: 'incomplete', proofs: proofs };
    }
    const userRef = o.db.collection('users').doc(o.uid);
    const markerRef = userRef.collection('daily_action_counts').doc(o.day + '_daily_five');
    const dailyRef = userRef.collection('daily_points').doc(o.day);
    const ledgerRef = o.db.collection('faucet_ledger').doc(o.uid);
    const prev = previousOffsetDay(Date.parse(o.day + 'T12:00:00Z'));
    const prevRef = userRef.collection('daily_action_counts').doc(prev + '_daily_five');

    const written = await o.db.runTransaction(async function (t) {
        const [userSnap, markerSnap, dailySnap, prevSnap, ledgerSnap] = await Promise.all([
            t.get(userRef), t.get(markerRef), t.get(dailyRef), t.get(prevRef), t.get(ledgerRef),
        ]);
        if (!userSnap.exists) return { created: false, reason: 'no_user' };
        const user = userSnap.data() || {};
        const ledger = ledgerSnap && ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
        if (rewardBlocked(user, ledger)) return { created: false, reason: 'banned' };
        if (markerSnap.exists) return { created: false, reason: 'already' };
        const days = Number(user.dailyFiveDays || 0) + 1;
        const streak = prevSnap.exists ? Number(user.dailyFiveStreak || 0) + 1 : 1;
        const dailyUsed = dailySnap.exists ? Number(dailySnap.data().total || 0) : 0;
        const split = planDailyXp(dailyUsed, DAILY_FIVE_XP);
        const update = {
            dailyFiveDays: days,
            dailyFiveStreak: streak,
            orangeTickets: o.admin.firestore.FieldValue.increment(DAILY_FIVE_TICKETS),
        };
        if (split.awarded > 0) {
            update.points = o.admin.firestore.FieldValue.increment(split.awarded);
            update.weeklyXP = o.admin.firestore.FieldValue.increment(split.awarded);
            update.monthlyXP = o.admin.firestore.FieldValue.increment(split.awarded);
        }
        t.set(markerRef, { day: o.day, at: o.admin.firestore.FieldValue.serverTimestamp() });
        t.update(userRef, update);
        if (split.awarded > 0) {
            t.set(dailyRef, { total: dailyUsed + split.awarded }, { merge: true });
        }
        return { created: true, days: days, streak: streak, awarded: split.awarded };
    });
    if (written && written.created) {
        await grantFamily(o.db, o.admin, o.uid, [
            'daily_five_1', 'daily_five_7', 'daily_five_30', 'daily_five_100', 'daily_five_streak_7',
        ], { day: o.day });
    }
    return { ok: !!(written && (written.created || written.reason === 'already')), result: written, proofs: proofs };
}

module.exports = {
    TCTV_WATCH_DEPLOYED: TCTV_WATCH_DEPLOYED,
    tctvClaimId: tctvClaimId,
    rewardBlocked: rewardBlocked,
    offsetDateKey: offsetDateKey,
    previousOffsetDay: previousOffsetDay,
    proofsFor: proofsFor,
    maybeCompleteTrifecta: maybeCompleteTrifecta,
    maybeCompleteDailyFive: maybeCompleteDailyFive,
};
