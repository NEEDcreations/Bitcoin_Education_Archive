/**
 * pvpResolveRound — Firestore onWrite trigger
 * Server-side PVP round resolution.
 * Grades from pvp_answer_keys only. Client `correct` flags are ignored.
 * Rewards are settled separately when status becomes finished or forfeit.
 */
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const pvpFlow = require('./pvpFlow');
const db = admin.firestore();

exports.pvpResolveRound = onDocumentWritten('pvp_matches/{matchId}', async (event) => {
    const change = { before: event.data.before, after: event.data.after };
    const context = { params: event.params };
    if (!change.after.exists) return null;
    const data = change.after.data();

    if (data.status !== 'active') return null;

    const q = data.currentQ;
    const p1Answers = (data.player1 && data.player1.answers) || [];
    const p2Answers = (data.player2 && data.player2.answers) || [];
    if (p1Answers.length <= q || p2Answers.length <= q) return null;

    const matchId = context.params.matchId;
    const matchRef = db.collection('pvp_matches').doc(matchId);
    const keyRef = db.collection('pvp_answer_keys').doc(matchId);

    return db.runTransaction(async tx => {
        const snap = await tx.get(matchRef);
        const keySnap = await tx.get(keyRef);
        if (!snap.exists) return;
        const d = snap.data();
        if (d.status !== 'active' || d.currentQ !== q) return;

        const a1 = (d.player1.answers || [])[q];
        const a2 = (d.player2.answers || [])[q];
        if (!a1 || !a2) return;
        if (!keySnap.exists) return;

        const keyEntry = (keySnap.data().keys || []).find(function (k) { return k.questionIndex === q; });
        if (!keyEntry || typeof keyEntry.correct !== 'number') return;

        const graded = pvpFlow.gradeRound(a1.selected, a2.selected, keyEntry.correct, a1.answeredAt, a2.answeredAt);
        const p1Ans = d.player1.answers.slice();
        const p2Ans = d.player2.answers.slice();
        const update = { resolvedAt: Date.now() };

        if (graded.outcome === 'reroll') {
            update['player1.answers'] = p1Ans.slice(0, q);
            update['player2.answers'] = p2Ans.slice(0, q);
            update.questionWinner = 'reroll';
            update.status = 'question_result';
            tx.update(matchRef, update);
            return;
        }

        const p1correct = graded.p1correct;
        const p2correct = graded.p2correct;
        if (graded.outcome === 'player1') {
            p1Ans[q] = Object.assign({}, a1, { won: true, correct: p1correct });
            p2Ans[q] = Object.assign({}, a2, { won: false, correct: p2correct });
            const pts = pvpFlow.streakPts(p1Ans, q);
            update['player1.answers'] = p1Ans;
            update['player1.score'] = (d.player1.score || 0) + pts;
            update['player1.correct'] = (d.player1.correct || 0) + 1;
            update['player2.answers'] = p2Ans;
            update.questionWinner = 'player1';
        } else {
            p1Ans[q] = Object.assign({}, a1, { won: false, correct: p1correct });
            p2Ans[q] = Object.assign({}, a2, { won: true, correct: p2correct });
            const pts = pvpFlow.streakPts(p2Ans, q);
            update['player2.answers'] = p2Ans;
            update['player2.score'] = (d.player2.score || 0) + pts;
            update['player2.correct'] = (d.player2.correct || 0) + 1;
            update['player1.answers'] = p1Ans;
            update.questionWinner = 'player2';
        }

        const p1Wins = pvpFlow.countWins(p1Ans);
        const p2Wins = pvpFlow.countWins(p2Ans);
        update.status = pvpFlow.matchShouldFinish(p1Wins, p2Wins) ? 'finished' : 'question_result';
        tx.update(matchRef, update);
    });
});
