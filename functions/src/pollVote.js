'use strict';

const POLL_BANK = require('./pollBank.json');
const { planDailyXp } = require('./dailyXp');
const { rewardBlocked } = require('./cipherClaim');
const { grantFamily, offsetDateKey } = require('./grantBadge');

const POLL_XP = 50;

function pollForDay(day) {
    const len = POLL_BANK.length;
    if (!len) return null;
    const dayOfYear = Math.floor((Date.parse(day + 'T00:00:00Z') - Date.parse('2026-01-01T00:00:00Z')) / 86400000);
    const seed = ((dayOfYear * 13 + 2026) % len + len) % len;
    return { index: seed, poll: POLL_BANK[seed] };
}

function createPollVote(opts) {
    const admin = opts.admin;
    const db = opts.db;
    const HttpsError = opts.HttpsError;

    return async function pollVote(data, context) {
        if (!context || !context.auth || !context.auth.uid) {
            throw new HttpsError('unauthenticated', 'Must be signed in');
        }
        const provider = context.auth.token && context.auth.token.firebase && context.auth.token.firebase.sign_in_provider;
        if (provider === 'anonymous') throw new HttpsError('permission-denied', 'Sign in to vote');
        const uid = context.auth.uid;
        const chosen = Number(data && data.chosenIdx);
        if (!Number.isInteger(chosen) || chosen < 0 || chosen > 3) {
            throw new HttpsError('invalid-argument', 'Pick one of the four answers');
        }
        const day = offsetDateKey(Date.now());
        const today = pollForDay(day);
        if (!today || !today.poll) throw new HttpsError('failed-precondition', 'No poll today');

        const userRef = db.collection('users').doc(uid);
        const voteRef = db.collection('polls').doc(day).collection('votes').doc(uid);
        const proofRef = userRef.collection('daily_action_counts').doc(day + '_poll_vote');
        const dailyRef = userRef.collection('daily_points').doc(day);
        const tallyRef = db.collection('poll_votes').doc((today.poll.id || 'poll') + '_' + day);
        const ledgerRef = db.collection('faucet_ledger').doc(uid);

        const result = await db.runTransaction(async function (t) {
            const [userSnap, voteSnap, dailySnap, tallySnap, ledgerSnap] = await Promise.all([
                t.get(userRef), t.get(voteRef), t.get(dailyRef), t.get(tallyRef), t.get(ledgerRef),
            ]);
            if (!userSnap.exists) throw new HttpsError('not-found', 'Profile not found');
            const user = userSnap.data() || {};
            const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : null;
            if (rewardBlocked(user, ledger)) throw new HttpsError('permission-denied', 'Voting is unavailable');
            if (voteSnap.exists) return { already: true, day: day };
            const prevVotes = tallySnap.exists && Array.isArray(tallySnap.data().votes)
                ? tallySnap.data().votes.slice(0, 4) : [0, 0, 0, 0];
            while (prevVotes.length < 4) prevVotes.push(0);
            prevVotes[chosen] = Number(prevVotes[chosen] || 0) + 1;
            const dailyUsed = dailySnap.exists ? Number(dailySnap.data().total || 0) : 0;
            const split = planDailyXp(dailyUsed, POLL_XP);
            const update = { pollDays: admin.firestore.FieldValue.increment(1), lastPollDate: day };
            if (split.awarded > 0) {
                update.points = admin.firestore.FieldValue.increment(split.awarded);
                update.weeklyXP = admin.firestore.FieldValue.increment(split.awarded);
                update.monthlyXP = admin.firestore.FieldValue.increment(split.awarded);
            }
            t.set(voteRef, {
                uid: uid,
                day: day,
                chosenIdx: chosen,
                pollIndex: today.index,
                at: admin.firestore.FieldValue.serverTimestamp(),
            });
            t.set(proofRef, {
                day: day,
                count: 1,
                serverPoll: true,
                at: admin.firestore.FieldValue.serverTimestamp(),
            });
            t.set(tallyRef, {
                pollId: today.poll.id || '',
                day: day,
                question: today.poll.q || '',
                options: today.poll.options || [],
                votes: prevVotes,
                total: prevVotes[0] + prevVotes[1] + prevVotes[2] + prevVotes[3],
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            // All-time tally. One increment per accepted daily vote. The
            // polls/{day}/votes/{uid} doc above is the one-vote-per-user gate.
            // Merge with #143 (db7bdf9b): that change is the XP lines above
            // (boostPoints, then planDailyXp). It does not touch this write.
            // Land #143 first, then rebase, so both stay. If this lands first,
            // keep this block when applying the XP hunk.
            const cumulativeId = String(today.poll.id || 'poll').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'poll';
            const cumulativeRef = db.collection('poll_cumulative').doc(cumulativeId);
            const cumulativePatch = {
                total: admin.firestore.FieldValue.increment(1),
                pollId: today.poll.id || cumulativeId,
                question: today.poll.q || '',
            };
            cumulativePatch['option_' + chosen] = admin.firestore.FieldValue.increment(1);
            t.set(cumulativeRef, cumulativePatch, { merge: true });
            t.update(userRef, update);
            if (split.awarded > 0) {
                t.set(dailyRef, { total: dailyUsed + split.awarded }, { merge: true });
            }
            return { already: false, day: day, awarded: split.awarded, votes: prevVotes };
        });

        if (!result.already && typeof opts.afterVote === 'function') {
            try { await opts.afterVote(uid, day); } catch (err) {
                console.warn('[pollVote] follow-up skipped', err && err.message);
            }
        }
        if (!result.already) {
            try { await grantFamily(db, admin, uid, ['poll_first', 'poll_10', 'poll_50', 'poll_100', 'poll_days_7', 'poll_days_30', 'poll_days_100'], { day: day }); }
            catch (err) { console.warn('[pollVote] badge grant skipped', err && err.message); }
        }
        return { success: true, already: result.already === true, day: day, awarded: result.awarded || 0, pollIndex: today.index };
    };
}

module.exports = {
    pollForDay: pollForDay,
    createPollVote: createPollVote,
    POLL_XP: POLL_XP,
};
