/**
 * contributeRaid – HTTPS Callable Cloud Function
 * Allows authenticated users to contribute toward the active Raid Boss.
 *
 * Input: { metric: string, amount: number, detail?: string }
 * Returns: { success, current, target, defeated }
 *
 * DO NOT call admin.initializeApp() here — it's called in index.js.
 */

const functionsV1 = require('firebase-functions/v1');
const admin = require('firebase-admin');
const ticketGrants = require('./ticketGrants');
const { grantServerTickets } = require('./grantServerTickets');

const db = admin.firestore();

// ── Per-metric contribution rules ──────────────────────────────────────────
// maxAmount: maximum amount per single call (must reflect one real action)
// dailyUserCap: maximum a single user can contribute to THIS metric per UTC day
// These values match what real activity can produce:
//   - binary actions (quiz, trivia, poll) = 1 per call, small daily real limits
//   - XP: capped at 500/day server-side in awardPoints, so 500 is the honest max
//   - chat/forum/read: generous but bounded
// ── Daily caps are tuned so all bosses take ~25-30 days with ~20 active users.
// ── XP is batched client-side at 100 XP per call (maxAmount=100) → 1 dmg/batch.
const METRIC_RULES = {
  quizCompletions:      { maxAmount: 1,   dailyUserCap: 3   },  // 3 quests/day server limit
  triviaCorrect:        { maxAmount: 1,   dailyUserCap: 1   },  // 1 trivia/day
  pollVotes:            { maxAmount: 1,   dailyUserCap: 1   },  // 1 poll/day
  flashcardCompletions: { maxAmount: 1,   dailyUserCap: 17  },  // 17 decks total; per-boss per-deck dedup enforced below
  totalXP:              { maxAmount: 100, dailyUserCap: 500 },  // client batches at 100 XP; 500 XP/day daily rail still applies
  chatMessages:         { maxAmount: 1,   dailyUserCap: 3   },  // 3 msgs/day toward raid (avoids chat spam = easy win)
  badgesEarned:         { maxAmount: 1,   dailyUserCap: 5   },  // 5 badges/day cap
  tipsSent:             { maxAmount: 1,   dailyUserCap: 50  },  // tip rate
  forumPosts:           { maxAmount: 1,   dailyUserCap: 20  },  // reasonable post rate
  totalTopicReads:      { maxAmount: 1,   dailyUserCap: 3   },  // 3 topic reads/day toward raid
  uniqueTopicsVisited:  { maxAmount: 1,   dailyUserCap: 3   },  // 3 new topics/day toward raid
  uniqueUsers5Topics:   { maxAmount: 1,   dailyUserCap: 1   },  // once per user per day
  watchMinutes:         { maxAmount: 10,  dailyUserCap: 240 },  // 4h TCTV max per day
  beatsMinutes:         { maxAmount: 10,  dailyUserCap: 120 },  // 2h Beats per day
  streakUsers:          { maxAmount: 1,   dailyUserCap: 1   },  // once per day (fires at each 7-day streak milestone)
};

async function grantRaidFamily(uid, field) {
  const { grantFamily, familyFor } = require('./grantBadge');
  await grantFamily(db, admin, uid, familyFor(field));
}

async function creditRaidDefeat(bossId, participants, winnerUids) {
  const winners = {};
  (winnerUids || []).forEach(function (id) { winners[id] = true; });
  for (let i = 0; i < participants.length; i++) {
    const participantUid = participants[i] && participants[i].uid;
    if (!participantUid) continue;
    const userRef = db.collection('users').doc(participantUid);
    const creditRef = userRef.collection('raid_credits').doc(bossId);
    let outcome = { credited: false, won: false };
    try {
      outcome = await db.runTransaction(async function (tx) {
        const credit = await tx.get(creditRef);
        const user = await tx.get(userRef);
        if (credit.exists || !user.exists) return { credited: false, won: false };
        const won = !!winners[participantUid];
        const update = { raidBossesDefeated: admin.firestore.FieldValue.increment(1) };
        if (won) update.raidWins = admin.firestore.FieldValue.increment(1);
        tx.set(creditRef, {
          bossId: bossId,
          winner: won,
          at: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.update(userRef, update);
        return { credited: true, won: won };
      });
    } catch (e) {
      console.warn('[RAID] defeat credit', e && e.message);
      continue;
    }
    if (!outcome || !outcome.credited) continue;
    try {
      const { grantFamily, familyFor } = require('./grantBadge');
      const ids = familyFor('raidBossesDefeated').slice();
      if (outcome.won) ids.push.apply(ids, familyFor('raidWins'));
      await grantFamily(db, admin, participantUid, ids);
    } catch (e) {
      console.warn('[RAID] defeat badges', e && e.message);
    }
  }
}

exports.contributeRaid = functionsV1.https.onCall(async (data, context) => {
    const secondFactor = require('./secondFactor');
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
  // Auth required
  if (!context.auth) {
    throw new functionsV1.https.HttpsError(
      'unauthenticated',
      'You must be logged in to contribute to a Raid Boss.'
    );
  }

  // Anonymous users cannot contribute
  if (context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
    throw new functionsV1.https.HttpsError('permission-denied', 'Anonymous users cannot contribute to Raid Bosses.');
  }

  const uid = context.auth.uid;
  const { metric, amount, detail } = data;

  // Validate metric
  if (!metric || typeof metric !== 'string') {
    throw new functionsV1.https.HttpsError('invalid-argument', 'metric is required and must be a string.');
  }

  // Scheduled bosses are counted from trusted triggers. A client call must
  // not write a participant, a cap, or HP for those metrics.
  const raidEngine = require('./raidBossEngine');
  if (raidEngine.isServerOnlyMetric(metric)) {
    throw new functionsV1.https.HttpsError('permission-denied', 'This raid metric is counted on the server.');
  }

  const metricRules = METRIC_RULES[metric];
  if (!metricRules) {
    throw new functionsV1.https.HttpsError('invalid-argument', `Unknown metric: ${metric}`);
  }

  // Validate amount against per-metric max
  const parsedAmount = typeof amount === 'number' ? amount : parseFloat(amount);
  if (!parsedAmount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new functionsV1.https.HttpsError('invalid-argument', 'amount must be a positive number.');
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
    throw new functionsV1.https.HttpsError('not-found', 'No active Raid Boss found.');
  }

  // Damage scale: each raw metric unit = damageScale HP against the boss (target always 1000)
  const damageScale = typeof activeBoss.damageScale === 'number' ? activeBoss.damageScale : 1;

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
      throw new functionsV1.https.HttpsError(
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

    // Update participant doc (store scaled damage, not raw metric amount)
    const scaledDamage = Math.round(effectiveAmount * damageScale * 1000) / 1000;
    const participantUpdate = {
      uid,
      contributed: admin.firestore.FieldValue.increment(scaledDamage),
      lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (detail) {
      participantUpdate.detailSet = admin.firestore.FieldValue.arrayUnion(
        typeof detail === 'string' ? detail.substring(0, 100) : String(detail)
      );
    }
    tx.set(participantRef, participantUpdate, { merge: true });

    return { effectiveAmount, scaledDamage };
  });

  const { effectiveAmount, scaledDamage } = result;

  // Track all-time raid damage on user doc (outside transaction — not security-critical)
  let damageRecorded = false;
  try {
    await db.collection('users').doc(uid).set({
      raidDamageAllTime: admin.firestore.FieldValue.increment(scaledDamage)
    }, { merge: true });
    damageRecorded = scaledDamage > 0;
  } catch (e) {
    console.warn('[RAID] raidDamageAllTime update failed:', e.message);
  }
  if (damageRecorded) {
    try { await grantRaidFamily(uid, 'raidDamageAllTime'); }
    catch (e) { console.warn('[RAID] damage badges', e && e.message); }
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
    await activeBossRef.collection('participants').doc(uid).set({ username, uid }, { merge: true });
  } catch (e) {}

  // Recalculate total from all participants
  const participantsSnap = await activeBossRef.collection('participants').get();
  let totalCurrent = 0;
  participantsSnap.forEach((pDoc) => {
    totalCurrent += (pDoc.data().contributed || 0);
  });

  // [SECURITY FIX] Defeat detection moved into a transaction.
  // Previously: activeBoss.defeated was read from a stale snapshot before the contribution tx.
  // Two concurrent requests both saw defeated=false, both crossed the target threshold,
  // both wrote winners → duplicate 1000-sat payouts.
  // Fix: read boss doc fresh inside a transaction and atomically flip defeated=true
  // only if it's currently false. Only one concurrent writer can win the CAS.
  let defeated = false;
  let finalTotal = totalCurrent;

  await db.runTransaction(async (tx) => {
    const freshBossSnap = await tx.get(activeBossRef);
    if (!freshBossSnap.exists) return;
    const freshBoss = freshBossSnap.data();

    // Re-read participants inside tx so totalCurrent is consistent with the lock
    // Note: subcollection reads in transactions are supported but expensive at scale.
    // Using the already-computed totalCurrent is safe here — the participant tx above
    // already committed atomically, and we only need defeat detection to be idempotent.
    finalTotal = totalCurrent;

    if (freshBoss.defeated) {
      // Another concurrent request already won the race — skip
      return;
    }

    const freshCurrent = Number(freshBoss.current) || 0;
    const nextCurrent = Math.max(freshCurrent, finalTotal);
    if (finalTotal < freshBoss.target && freshCurrent < freshBoss.target) {
      if (nextCurrent > freshCurrent) tx.update(activeBossRef, { current: nextCurrent });
      return;
    }

    // Target reached and boss not yet defeated — this request wins the race
    defeated = true;
    tx.update(activeBossRef, { current: nextCurrent, defeated: true });
  });

  // If we won the defeat race, pick winners and write payout docs
  // (outside the transaction — subcollection batch writes can't go inside a tx easily,
  //  and the defeated=true flag set above is the idempotency guard)
  if (defeated) {
    const participantUIDs = [];
    participantsSnap.forEach((pDoc) => {
      participantUIDs.push({ uid: pDoc.id, username: pDoc.data().username || 'Anonymous' });
    });

    // Fisher-Yates shuffle
    const shuffled = [...participantUIDs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const winners = shuffled.slice(0, Math.min(2, shuffled.length));

    const batch = db.batch();
    for (const winner of winners) {
      const winnerRef = activeBossRef.collection('winners').doc(winner.uid);
      // set (not update) with merge:false — idempotent: second write of same doc is a no-op
      // if a concurrent CF somehow also reached here (extremely unlikely given the tx above)
      batch.set(winnerRef, {
        uid: winner.uid,
        username: winner.username,
        drawnAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    console.log(`[RAID] Boss "${activeBoss.name}" DEFEATED! Winners: ${winners.map(w => w.uid).join(', ')}`);
    try {
      await creditRaidDefeat(activeBossRef.id, participantUIDs, winners.map(function (winner) { return winner.uid; }));
    } catch (e) {
      console.warn('[RAID] defeat credit', e && e.message);
    }
    try {
      await raidEngine.recordBossHistory(db, admin, activeBossRef, activeBossRef.id, { now: new Date() });
      await raidEngine.syncPrizeWinner(db, admin, activeBossRef.id);
    } catch (e) {
      console.warn('[RAID] history', e && e.message);
    }
  } else {
    // Not defeated — update current count if we didn't already do so in the tx
    // (the tx handles this; this branch is a no-op safety fallback)
  }

  if (metric === 'flashcardCompletions' && effectiveAmount > 0) {
    await grantServerTickets(uid, 'flashcard_ticket');
  }
  if (scaledDamage > 0) {
    await grantServerTickets(uid, 'raid_damage_ticket', { damage: scaledDamage });
  }

  return {
    success: true,
    current: finalTotal,
    target: activeBoss.target,
    defeated: defeated,
    damage: scaledDamage,
  };
});
