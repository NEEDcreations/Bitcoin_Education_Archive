'use strict';

// answerTrivia and gradeQuest. App Check is required. A per-uid rate limit
// sits in the same transaction as the payout. Banned accounts
// (users.satsDisabled or faucet_ledger.banned) receive nothing.
// Grading uses questReward.js and the bundled bank, never client answer keys.
// A perfect part is stored under users/{uid}/quest_completions.
// An older server key on completedQuests (quest_<topic> for part 1,
// quest_<topic>__N for part N) also blocks a repeat payout. It never grants one.
// A payout also writes a bell notification, same as the other reward callables.

const functionsV1 = require('firebase-functions/v1');
const admin = require('firebase-admin');
const reward = require('./questReward');
const rewardNotify = require('./rewardNotify');
const { DAILY_CAP, TAPER_FULL_UNTIL, TAPER_HALF_UNTIL } = require('./dailyXp');
const { grantFamily, familyFor } = require('./grantBadge');
const { planQuestDay } = require('./badgeProgress');

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const RATE_WINDOW_MS = 60 * 1000;
const TRIVIA_RATE_MAX = 8;
const QUEST_RATE_MAX = 12;

function httpsError(code, message) {
    return new functionsV1.https.HttpsError(code, message);
}

function requireUser(context) {
    if (!context.auth) throw httpsError('unauthenticated', 'Must be signed in');
    const firebaseToken = context.auth.token && context.auth.token.firebase;
    const provider = firebaseToken && firebaseToken.sign_in_provider;
    if (provider === 'anonymous') throw httpsError('unauthenticated', 'Must use a real account');
    return context.auth.uid;
}

function onCall(handler) {
    return functionsV1.runWith({ enforceAppCheck: true }).https.onCall(handler);
}

function meterFrom(used, awarded) {
    const before = Math.max(0, Number(used) || 0);
    const paid = Math.max(0, Number(awarded) || 0);
    const dailyXp = before + paid;
    return {
        dailyXp: dailyXp,
        dailyCap: DAILY_CAP,
        fullUntil: TAPER_FULL_UNTIL,
        halfUntil: TAPER_HALF_UNTIL,
        pastCap: before >= DAILY_CAP,
        dailyQuizXp: dailyXp,
        dailyQuizCap: DAILY_CAP,
    };
}

function applyRate(tx, rateRef, rateDoc, now, max, kind) {
    const existing = rateDoc.exists ? rateDoc.data() : null;
    const rate = reward.nextCallRate(existing, now, RATE_WINDOW_MS, max);
    if (!rate.ok) {
        throw httpsError('resource-exhausted', 'Too many attempts. Try again in a minute.');
    }
    tx.set(rateRef, { windowStartMs: rate.windowStartMs, count: rate.count, kind: kind });
}

const answerTrivia = onCall(async (data, context) => {
    const uid = requireUser(context);
    const now = Date.now();
    const dayKey = reward.offsetDateKey(now);
    const payload = data || {};

    const userRef = db.collection('users').doc(uid);
    const ledgerRef = db.collection('faucet_ledger').doc(uid);
    const rateRef = db.collection('rate_limits').doc('trivia_' + uid);
    const claimRef = userRef.collection('daily_action_counts').doc(dayKey + '_trivia');
    const dailyPtsRef = userRef.collection('daily_points').doc(dayKey);

    const triviaResult = await db.runTransaction(async (tx) => {
        const rateDoc = await tx.get(rateRef);
        const userDoc = await tx.get(userRef);
        const ledgerDoc = await tx.get(ledgerRef);
        const claimDoc = await tx.get(claimRef);
        const dailyDoc = await tx.get(dailyPtsRef);

        const user = userDoc.exists ? (userDoc.data() || {}) : {};
        const ledger = ledgerDoc.exists ? ledgerDoc.data() : null;
        const banned = reward.isRewardBanned(user, ledger);
        const alreadyClaimed = claimDoc.exists;
        const dailyUsed = dailyDoc.exists ? (dailyDoc.data().total || 0) : 0;
        const graded = reward.gradeTrivia({
            dayKey: payload.dayKey,
            questionIndex: payload.questionIndex,
            question: typeof payload.q === 'string' ? payload.q : payload.question,
            chosen: payload.chosen,
            optionId: typeof payload.optionId === 'string' ? payload.optionId : '',
            now: now,
            banned: banned,
            dailyUsed: alreadyClaimed ? 0 : dailyUsed,
            user: user,
        });
        const awarded = (graded.ok && !alreadyClaimed) ? (graded.awarded || 0) : 0;
        const pointsBefore = user.points || 0;
        const prevById = await rewardNotify.readRankPrev(tx, db, uid, pointsBefore, awarded);

        applyRate(tx, rateRef, rateDoc, now, TRIVIA_RATE_MAX, 'trivia');

        if (!graded.ok) {
            return { success: false, correct: false, awarded: 0, reason: graded.reason };
        }
        if (!userDoc.exists) throw httpsError('not-found', 'User not found');
        if (alreadyClaimed) {
            return {
                success: true,
                correct: claimDoc.data().correct === true,
                awarded: 0,
                alreadyClaimed: true,
                statsRecorded: false,
                reason: 'already-claimed',
            };
        }

        let statsRecorded = false;
        if (!banned) {
            const last = user.lastTriviaDate || '';
            const yesterday = reward.previousDateKey(dayKey);
            const currentStreak = user.triviaStreak || 0;
            const newStreak = last === yesterday ? currentStreak + 1 : 1;
            const userUpdate = {
                triviaAnswered: FieldValue.increment(1),
                lastTriviaDate: dayKey,
                triviaStreak: newStreak,
            };
            if (graded.correct) userUpdate.triviaCorrect = FieldValue.increment(1);
            if (graded.awarded > 0) {
                userUpdate.points = FieldValue.increment(graded.awarded);
                userUpdate.weeklyXP = FieldValue.increment(graded.awarded);
                userUpdate.monthlyXP = FieldValue.increment(graded.awarded);
                tx.set(dailyPtsRef, {
                    total: dailyUsed + graded.awarded,
                    lastUpdated: FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            tx.update(userRef, userUpdate);
            tx.set(claimRef, {
                count: 1,
                correct: graded.correct === true,
                at: FieldValue.serverTimestamp(),
            });
            // Same bank slot gradeTrivia resolved. A mismatch stays at -1 and is not counted.
            const optionIndex = graded.optionIndex;
            if (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < 4
                && Number.isInteger(graded.questionIndex) && graded.questionIndex >= 0) {
                const optionKey = 'option_' + optionIndex;
                const statPatch = { total: FieldValue.increment(1) };
                statPatch[optionKey] = FieldValue.increment(1);
                tx.set(db.collection('trivia_stats').doc(dayKey), statPatch, { merge: true });
                const cumulativePatch = {
                    total: FieldValue.increment(1),
                    triviaIndex: graded.questionIndex,
                };
                cumulativePatch[optionKey] = FieldValue.increment(1);
                tx.set(db.collection('trivia_cumulative').doc('t_' + graded.questionIndex), cumulativePatch, { merge: true });
                statsRecorded = true;
            }
            if (awarded > 0) {
                try {
                    rewardNotify.apply(tx, db, FieldValue.serverTimestamp(), rewardNotify.plan({
                        uid: uid,
                        onceKey: 'trivia_' + dayKey,
                        xp: awarded,
                        sourceLabel: 'daily trivia',
                        icon: '🧠',
                        pointsBefore: pointsBefore,
                        pointsDelta: awarded,
                        prevById: prevById,
                    }));
                } catch (notifyErr) {
                    console.warn('[TRIVIA] reward notify skipped:', notifyErr && notifyErr.message);
                }
            }
        }

        return Object.assign({
            success: true,
            correct: graded.correct === true,
            awarded: graded.awarded || 0,
            doubled: graded.doubled === true,
            capped: graded.capped === true,
            banned: banned,
            alreadyClaimed: false,
            graded: true,
            statsRecorded: statsRecorded,
            reason: banned ? 'banned' : (graded.correct ? '' : 'incorrect'),
        }, meterFrom(dailyUsed, banned ? 0 : (graded.awarded || 0)));
    });
    if (triviaResult && triviaResult.correct === true && triviaResult.success === true && triviaResult.alreadyClaimed !== true && triviaResult.banned !== true) {
        await require('./raidBossEngine').noteTrusted(db, admin, {
            metric: 'triviaCorrect',
            uid: uid,
            dedupeKey: 'trivia-' + uid + '-' + dayKey,
            amount: 1,
            now: new Date(now),
        });
    }
    return triviaResult;
});

const gradeQuest = onCall(async (data, context) => {
    const uid = requireUser(context);
    const now = Date.now();
    const dayKey = reward.offsetDateKey(now);
    const payload = data || {};
    const graded = reward.gradeQuestSubmission({
        topicKey: payload.topicKey,
        questIndex: payload.questIndex,
        isRetry: payload.isRetry === true,
        answers: payload.answers,
        serverNow: now,
    });

    const userRef = db.collection('users').doc(uid);
    const ledgerRef = db.collection('faucet_ledger').doc(uid);
    const rateRef = db.collection('rate_limits').doc('quest_' + uid);
    const dailyQuestRef = userRef.collection('daily_action_counts').doc(dayKey + '_quest');
    const dailyPtsRef = userRef.collection('daily_points').doc(dayKey);
    // Look the part up even when this submission will not record a new
    // completion. A previous-bank match and a failed completion write still
    // have to see a part that was already finished.
    const partKey = graded.completionKey
        || (graded.ok && graded.topicKey && Number.isInteger(graded.questIndex) && graded.questIndex >= 0
            ? reward.questCompletionKey(graded.topicKey, graded.questIndex)
            : '');
    const completionRef = partKey
        ? userRef.collection('quest_completions').doc(partKey)
        : null;
    const passKey = graded.ok && graded.topicKey && Number.isInteger(graded.questIndex) && graded.questIndex >= 0
        ? reward.questCompletionKey(graded.topicKey, graded.questIndex)
        : '';
    const passRef = passKey ? userRef.collection('quest_passes').doc(passKey) : null;

    const result = await db.runTransaction(async (tx) => {
        const rateDoc = await tx.get(rateRef);
        const userDoc = await tx.get(userRef);
        const ledgerDoc = await tx.get(ledgerRef);
        const questCountDoc = await tx.get(dailyQuestRef);
        const dailyDoc = await tx.get(dailyPtsRef);
        const completionDoc = completionRef ? await tx.get(completionRef) : null;
        const passDoc = passRef ? await tx.get(passRef) : null;

        const user = userDoc.exists ? (userDoc.data() || {}) : {};
        const banned = reward.isRewardBanned(user, ledgerDoc.exists ? ledgerDoc.data() : null);
        const questsToday = questCountDoc.exists ? (questCountDoc.data().count || 0) : 0;
        const dailyUsed = dailyDoc.exists ? (dailyDoc.data().total || 0) : 0;
        const settled = graded.ok ? reward.settleQuizReward({
            graded: graded,
            banned: banned,
            dailyUsed: dailyUsed,
            alreadyPerfect: !!(completionDoc && completionDoc.exists)
                || reward.legacyPartRecorded(user.completedQuests, graded.topicKey, graded.questIndex),
            questsToday: questsToday,
            user: user,
            now: now,
        }) : { awarded: 0, reason: graded.reason || 'need-text-answers' };
        const awarded = settled.awarded || 0;
        const pointsBefore = user.points || 0;
        const prevById = await rewardNotify.readRankPrev(tx, db, uid, pointsBefore, awarded);

        applyRate(tx, rateRef, rateDoc, now, QUEST_RATE_MAX, 'quest');
        if (!graded.ok) {
            return { success: false, score: 0, pts: 0, awarded: 0, graded: false, reason: graded.reason || 'need-text-answers' };
        }
        if (!userDoc.exists) throw httpsError('not-found', 'User not found');
        if (settled.reason === 'daily-limit') {
            return {
                success: false,
                score: 0,
                pts: 0,
                awarded: 0,
                graded: false,
                reason: 'daily-limit',
                capped: false,
                banned: banned === true,
            };
        }

        if (settled.countQuest) {
            tx.set(dailyQuestRef, {
                count: FieldValue.increment(1),
                lastAt: FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        const userUpdate = {};
        let questsPassed = false;
        let questDay = false;
        if ((settled.score || 0) >= 3 && !banned) {
            const plannedDay = planQuestDay({ day: dayKey, lastQuestDate: user.lastQuestDate || '' });
            if (plannedDay.increment) {
                questDay = true;
                userUpdate.questDays = FieldValue.increment(1);
                userUpdate.lastQuestDate = dayKey;
            }
        }
        if (settled.countQuest) {
            const yesterday = reward.previousDateKey(dayKey);
            userUpdate.lastQuizDate = dayKey;
            userUpdate.quizStreak = reward.nextActivityStreak(user.lastQuizDate || '', user.quizStreak || 0, dayKey, yesterday);
            userUpdate.quizAnswered = FieldValue.increment(5);
            if ((settled.score || 0) > 0) userUpdate.quizCorrect = FieldValue.increment(settled.score);
            if ((settled.score || 0) >= 3 && !banned && passRef && !(passDoc && passDoc.exists)) {
                questsPassed = true;
                userUpdate.questsPassed = FieldValue.increment(1);
                tx.set(passRef, {
                    topicKey: graded.topicKey,
                    questIndex: graded.questIndex,
                    score: settled.score,
                    at: FieldValue.serverTimestamp(),
                });
            }
        }
        if (settled.awarded > 0) {
            userUpdate.points = FieldValue.increment(settled.awarded);
            userUpdate.weeklyXP = FieldValue.increment(settled.awarded);
            userUpdate.monthlyXP = FieldValue.increment(settled.awarded);
            tx.set(dailyPtsRef, {
                total: dailyUsed + settled.awarded,
                lastUpdated: FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        if (settled.completionKey && completionRef) {
            tx.set(completionRef, {
                topicKey: graded.topicKey,
                questIndex: graded.questIndex,
                part: graded.questIndex + 1,
                at: FieldValue.serverTimestamp(),
            });
        }
        if (Object.keys(userUpdate).length) tx.update(userRef, userUpdate);
        if (awarded > 0) {
            try {
                rewardNotify.apply(tx, db, FieldValue.serverTimestamp(), rewardNotify.plan({
                    uid: uid,
                    onceKey: 'quest_' + dayKey + '_' + (questsToday + 1),
                    xp: awarded,
                    sourceLabel: 'a quest',
                    icon: '🏆',
                    pointsBefore: pointsBefore,
                    pointsDelta: awarded,
                    prevById: prevById,
                }));
            } catch (notifyErr) {
                console.warn('[QUEST] reward notify skipped:', notifyErr && notifyErr.message);
            }
        }

        return Object.assign({
            success: true,
            score: settled.score,
            pts: settled.pts,
            awarded: settled.awarded,
            doubled: settled.doubled === true,
            capped: settled.capped === true,
            banned: banned === true,
            reason: settled.reason || '',
            graded: true,
            questsToday: questsToday + (settled.countQuest ? 1 : 0),
            dailyQuestLimit: reward.DAILY_QUEST_LIMIT,
            questsPassed: questsPassed,
            questDay: questDay,
        }, meterFrom(dailyUsed, settled.awarded || 0));
    });
    if (result && result.questsPassed) {
        try { await grantFamily(db, admin, uid, familyFor('questsPassed')); }
        catch (questBadgeErr) { console.warn('[gradeQuest] badges', questBadgeErr && questBadgeErr.message); }
    }
    if (result && result.questDay) {
        try { await grantFamily(db, admin, uid, familyFor('questDays')); }
        catch (questDayErr) { console.warn('[gradeQuest] quest days', questDayErr && questDayErr.message); }
    }
    if (result && result.questsPassed && result.banned !== true) {
        await require('./raidBossEngine').noteTrusted(db, admin, {
            metric: 'quizCompletions',
            uid: uid,
            dedupeKey: 'quest-' + uid + '-' + dayKey + '-' + String(result.questsToday || 1),
            amount: 1,
            now: new Date(now),
        });
    }
    return result;
});

// Older clients still call this before gradeQuest. It no longer stores the
// answer key the browser sent, and it no longer locks every part of a topic
// after part 1. gradeQuest is the only payout.
const startQuest = onCall(async (data, context) => {
    const uid = requireUser(context);
    const now = Date.now();
    const rateRef = db.collection('rate_limits').doc('quest_start_' + uid);
    await db.runTransaction(async (tx) => {
        const rateDoc = await tx.get(rateRef);
        applyRate(tx, rateRef, rateDoc, now, QUEST_RATE_MAX, 'quest-start');
    });
    return {
        questId: uid + '_quest_' + now,
        gradedBy: 'server-bank',
    };
});

const triviaXpStatus = onCall(async (data, context) => {
    void data;
    const uid = requireUser(context);
    const dayKey = reward.offsetDateKey(Date.now());
    const snap = await db.collection('users').doc(uid).collection('daily_points').doc(dayKey).get();
    const used = snap.exists ? (Number((snap.data() || {}).total) || 0) : 0;
    return Object.assign({ day: dayKey }, meterFrom(used, 0));
});

module.exports = {
    answerTrivia: answerTrivia,
    gradeQuest: gradeQuest,
    startQuest: startQuest,
    triviaXpStatus: triviaXpStatus,
};
