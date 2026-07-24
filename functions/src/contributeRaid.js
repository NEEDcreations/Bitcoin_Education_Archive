/**
 * contributeRaid – HTTPS Callable Cloud Function
 * Allows authenticated users to contribute toward the active Raid Boss.
 *
 * Input: { metric: string, amount: number, detail?: string }
 * Returns: { success, current, target, defeated }
 *
 * DO NOT call admin.initializeApp() here — it's called in index.js.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// ── Per-metric contribution rules ──────────────────────────────────────────
// maxAmount: maximum amount per single call (must reflect one real action)
// dailyUserCap: maximum a single user can contribute to THIS metric per UTC day
// These values match what real activity can produce:
//   - binary actions (quiz, trivia, poll) = 1 per call, small daily real limits
//   - XP: capped at 500/day server-side in awardPoints, so 500 is the honest max
//   - chat/forum/read: generous but bounded
const METRIC_RULES = {
  quizCompletions:      { maxAmount: 1,    dailyUserCap: 3    },  // 3 quests/day server limit
  triviaCorrect:        { maxAmount: 1,    dailyUserCap: 1    },  // 1 trivia/day
  pollVotes:            { maxAmount: 1,    dailyUserCap: 1    },  // 1 poll/day
  flashcardCompletions: { maxAmount: 1,    dailyUserCap: 17   },  // 17 decks total; per-boss per-deck dedup enforced below
  totalXP:              { maxAmount: 500,  dailyUserCap: 500  },  // matches daily XP cap
  chatMessages:         { maxAmount: 1,    dailyUserCap: 100  },  // 100 chat msgs/day max
  badgesEarned:         { maxAmount: 1,    dailyUserCap: 20   },  // realistic badge earn rate
  tipsSent:             { maxAmount: 1,    dailyUserCap: 50   },  // tip rate
  forumPosts:           { maxAmount: 1,    dailyUserCap: 20   },  // reasonable post rate
  totalTopicReads:      { maxAmount: 1,    dailyUserCap: 100  },  // topic browsing
  uniqueTopicsVisited:  { maxAmount: 1,    dailyUserCap: 100  },  // topic browsing
  uniqueUsers5Topics:   { maxAmount: 1,    dailyUserCap: 1    },  // once per user per day
  watchMinutes:         { maxAmount: 10,   dailyUserCap: 240  },  // 4h TCTV max per day
  beatsMinutes:         { maxAmount: 10,   dailyUserCap: 120  },  // 2h Beats per day
  streakUsers:          { maxAmount: 1,    dailyUserCap: 1    },  // once per day (fires at each 7-day streak milestone)
};

exports.contributeRaid = functions.https.onCall(async (data, context) => {
  // Auth required
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be logged in to contribute to a Raid Boss.'
    );
  }

  // Anonymous users cannot contribute
  if (context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
    throw new functions.https.HttpsError('permission-denied', 'Anonymous users cannot contribute to Raid Bosses.');
  }

  const uid = context.auth.uid;
  const { metric, amount, detail } = data;

  // Validate metric
  if (!metric || typeof metric !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'metric is required and must be a string.');
  }

  const metricRules = METRIC_RULES[metric];
  if (!metricRules) {
    throw new functions.https.HttpsError('invalid-argument', `Unknown metric: ${metric}`);
  }

  // Validate amount against per-metric max
  const parsedAmount = typeof amount === 'number' ? amount : parseFloat(amount);
  if (!parsedAmount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'amount must be a positive number.');
  }
  const clampedAmount = Math.min(parsedAmount, metricRules.maxAmount);

  const now = admin.firestore.Timestamp.now();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD UTC

  // Find active boss
  const bossQuery = await db.collection('raid_bosses')
    .orderBy('startTime', 'desc')
    .limit(5)
    .get();

  let activeBoss = null;
  let activeBossRef = null;
  const nowMs = now.toDate().getTime();
  bossQuery.forEach((doc) => {
    if (activeBoss) return;
    const d = doc.data();
    if (d.defeated || d.placeholder) return;
    const startMs = d.startTime ? d.startTime.toDate().getTime() : 0;
    const endMs = d.endTime ? d.endTime.toDate().getTime() : 0;
    if (startMs <= nowMs && endMs > nowMs) {
      activeBoss = d;
      activeBossRef = doc.ref;
    }
  });

  if (!activeBoss) {
    throw new functions.https.HttpsError('not-found', 'No active Raid Boss found.');
  }

  // Check metric matches boss
  if (activeBoss.metric !== metric) {
    return {
      success: false,
      current: activeBoss.current,
      target: activeBoss.target,
      defeated: activeBoss.defeated,
      message: `This boss requires metric "${activeBoss.metric}", not "${metric}".`,
    };
  }

  // Per-user daily cap check (atomic via transaction on a rate-limit doc)
  const dailyCapRef = db.collection('raid_daily_caps').doc(`${uid}_${today}_${metric}`);
  const participantRef = activeBossRef.collection('participants').doc(uid);

  // Per-boss per-deck dedup: flashcard sets can only count once per deck per boss lifetime
  if (metric === 'flashcardCompletions' && detail) {
    const safeDeck = detail.substring(0, 80).replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
    const deckDedupRef = db.collection('raid_deck_completions')
      .doc(`${activeBossRef.id}_${uid}_${safeDeck}`);
    const deckDedupDoc = await deckDedupRef.get();
    if (deckDedupDoc.exists) {
      return {
        success: false,
        current: activeBoss.current,
        target: activeBoss.target,
        defeated: activeBoss.defeated,
        message: `You already completed the "${detail}" deck for this boss!`,
      };
    }
    // Mark it used (outside transaction — write after the main transaction completes)
    await deckDedupRef.set({
      uid,
      deck: detail.substring(0, 80),
      bossId: activeBossRef.id,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  const result = await db.runTransaction(async (tx) => {
    // Check daily user cap for this metric
    const capDoc = await tx.get(dailyCapRef);
    const usedToday = capDoc.exists ? (capDoc.data().contributed || 0) : 0;
    const remaining = metricRules.dailyUserCap - usedToday;

    if (remaining <= 0) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `Daily contribution limit reached for ${metric}. Try again tomorrow.`
      );
    }

    // Clamp to remaining daily allowance
    const effectiveAmount = Math.min(clampedAmount, remaining);

    // Update daily cap
    tx.set(dailyCapRef, {
      contributed: admin.firestore.FieldValue.increment(effectiveAmount),
      lastAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Update participant doc
    const participantUpdate = {
      contributed: admin.firestore.FieldValue.increment(effectiveAmount),
      lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (detail) {
      participantUpdate.detailSet = admin.firestore.FieldValue.arrayUnion(
        typeof detail === 'string' ? detail.substring(0, 100) : String(detail)
      );
    }
    tx.set(participantRef, participantUpdate, { merge: true });

    return { effectiveAmount };
  });

  const { effectiveAmount } = result;

  // Track all-time raid damage on user doc (outside transaction — not security-critical)
  try {
    await db.collection('users').doc(uid).set({
      raidDamageAllTime: admin.firestore.FieldValue.increment(effectiveAmount)
    }, { merge: true });
  } catch (e) {
    console.warn('[RAID] raidDamageAllTime update failed:', e.message);
  }

  // Fetch username
  let username = 'Anonymous';
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      username = userData.username || userData.displayName || 'Anonymous';
    }
  } catch (e) {
    console.warn(`[RAID] Could not fetch username for ${uid}:`, e.message);
  }

  // Persist username on participant doc
  try {
    await activeBossRef.collection('participants').doc(uid).set({ username }, { merge: true });
  } catch (e) {}

  // Recalculate total from all participants
  const participantsSnap = await activeBossRef.collection('participants').get();
  let totalCurrent = 0;
  participantsSnap.forEach((pDoc) => {
    totalCurrent += (pDoc.data().contributed || 0);
  });

  const updateBoss = { current: totalCurrent };
  let defeated = false;

  if (totalCurrent >= activeBoss.target && !activeBoss.defeated) {
    updateBoss.defeated = true;
    defeated = true;

    // Random winner selection from all participants
    const participantUIDs = [];
    participantsSnap.forEach((pDoc) => {
      participantUIDs.push({ uid: pDoc.id, username: pDoc.data().username || 'Anonymous' });
    });

    // Fisher-Yates shuffle using crypto-safe method
    const shuffled = [...participantUIDs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const winners = shuffled.slice(0, Math.min(2, shuffled.length));

    const batch = db.batch();
    for (const winner of winners) {
      const winnerRef = activeBossRef.collection('winners').doc(winner.uid);
      batch.set(winnerRef, {
        uid: winner.uid,
        username: winner.username,
        satsAwarded: 1000,
        drawnAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    console.log(`[RAID] Boss "${activeBoss.name}" DEFEATED! Winners: ${winners.map(w => w.uid).join(', ')}`);
  }

  await activeBossRef.update(updateBoss);

  return {
    success: true,
    current: totalCurrent,
    target: activeBoss.target,
    defeated: defeated,
  };
});
