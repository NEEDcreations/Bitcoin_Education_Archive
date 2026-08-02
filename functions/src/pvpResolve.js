/**
 * pvpResolveRound — Firestore onWrite trigger
 * Server-side PVP round resolution.
 * Fires on every pvp_matches write; resolves a round when both players
 * have answered the current question, using the authoritative questions[]
 * array stored in Firestore — never trusting client-supplied `correct` flags.
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = admin.firestore();

function countWins(answers) {
  return (answers || []).filter(a => a && a.won).length;
}

function streakPts(answers, winIdx) {
  let streak = 1;
  for (let i = winIdx - 1; i >= 0; i--) {
    if (answers[i] && answers[i].won) streak++;
    else break;
  }
  return 10 + (streak > 1 ? 5 * (streak - 1) : 0);
}

exports.pvpResolveRound = functions.firestore
  .document('pvp_matches/{matchId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return null;
    const data = change.after.data();

    // Only process active matches — prevents re-trigger after CF writes status
    if (data.status !== 'active') return null;

    const q = data.currentQ;
    const p1Len = ((data.player1 && data.player1.answers) || []).length;
    const p2Len = ((data.player2 && data.player2.answers) || []).length;
    if (p1Len <= q || p2Len <= q) return null; // both not yet answered

    const matchRef = db.collection('pvp_matches').doc(context.params.matchId);

    return db.runTransaction(async tx => {
      const snap = await tx.get(matchRef);
      if (!snap.exists) return;
      const d = snap.data();

      // Re-check inside transaction
      if (d.status !== 'active' || d.currentQ !== q) return;
      const a1 = (d.player1.answers || [])[q];
      const a2 = (d.player2.answers || [])[q];
      if (!a1 || !a2) return;

      // Authoritative correct answer — never from client
      const question = (d.questions || [])[q];
      if (!question || question.correct === undefined) return;
      const correctIdx = question.correct;

      const p1correct = (a1.selected === correctIdx);
      const p2correct = (a2.selected === correctIdx);

      const p1Ans = d.player1.answers.slice();
      const p2Ans = d.player2.answers.slice();
      const update = {};

      if (p1correct && !p2correct) {
        p1Ans[q] = { ...a1, won: true, correct: true };
        p2Ans[q] = { ...a2, won: false, correct: false };
        const pts = streakPts(p1Ans, q);
        update['player1.answers'] = p1Ans;
        update['player1.score']   = (d.player1.score || 0) + pts;
        update['player1.correct'] = (d.player1.correct || 0) + 1;
        update['player2.answers'] = p2Ans;
        update.questionWinner = 'player1';
      } else if (p2correct && !p1correct) {
        p1Ans[q] = { ...a1, won: false, correct: false };
        p2Ans[q] = { ...a2, won: true, correct: true };
        const pts = streakPts(p2Ans, q);
        update['player2.answers'] = p2Ans;
        update['player2.score']   = (d.player2.score || 0) + pts;
        update['player2.correct'] = (d.player2.correct || 0) + 1;
        update['player1.answers'] = p1Ans;
        update.questionWinner = 'player2';
      } else {
        // Both right or both wrong → reroll: strip this round's answers, keep same q
        update['player1.answers'] = p1Ans.slice(0, q);
        update['player2.answers'] = p2Ans.slice(0, q);
        update.questionWinner = 'reroll';
        update.status = 'question_result';
        tx.update(matchRef, update);
        return;
      }

      const p1Wins = countWins(p1Ans);
      const p2Wins = countWins(p2Ans);
      const roundsDone = p1Wins + p2Wins;
      update.status = (roundsDone >= 5 || p1Wins >= 3 || p2Wins >= 3)
        ? 'finished'
        : 'question_result';

      tx.update(matchRef, update);
    });
  });
