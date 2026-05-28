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

exports.contributeRaid = functions.https.onCall(async (data, context) => {
  // Auth required
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be logged in to contribute to a Raid Boss.'
    );
  }

  const uid = context.auth.uid;
  const { metric, amount, detail } = data;

  // Validate input
  if (!metric || typeof metric !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'metric is required and must be a string.');
  }
  if (!amount || typeof amount !== 'number' || amount <= 0 || !Number.isFinite(amount)) {
    throw new functions.https.HttpsError('invalid-argument', 'amount must be a positive number.');
  }
  if (amount > 10000) {
    throw new functions.https.HttpsError('invalid-argument', 'amount exceeds maximum allowed per contribution.');
  }

  const now = admin.firestore.Timestamp.now();

  // Find active boss: startTime <= now, endTime > now, not defeated, not placeholder
  const bossQuery = await db.collection('raid_bosses')
    .where('defeated', '==', false)
    .where('placeholder', '==', false)
    .where('startTime', '<=', now)
    .orderBy('startTime', 'desc')
    .limit(5)
    .get();

  // Filter for endTime > now (Firestore can't do two inequality filters on different fields)
  let activeBoss = null;
  let activeBossRef = null;
  bossQuery.forEach((doc) => {
    if (!activeBoss) {
      const d = doc.data();
      if (d.endTime && d.endTime.toDate() > now.toDate()) {
        activeBoss = d;
        activeBossRef = doc.ref;
      }
    }
  });

  if (!activeBoss) {
    throw new functions.https.HttpsError('not-found', 'No active Raid Boss found.');
  }

  // Check if the contribution metric matches the boss metric
  if (activeBoss.metric !== metric) {
    return {
      success: false,
      current: activeBoss.current,
      target: activeBoss.target,
      defeated: activeBoss.defeated,
      message: `This boss requires metric "${activeBoss.metric}", not "${metric}".`,
    };
  }

  // Get username from users collection
  let username = 'Anonymous';
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      username = userData.displayName || userData.username || userData.email || 'Anonymous';
    }
  } catch (e) {
    console.warn(`Could not fetch username for ${uid}:`, e.message);
  }

  // Update participant doc
  const participantRef = activeBossRef.collection('participants').doc(uid);
  const updateData = {
    username: username,
    contributed: admin.firestore.FieldValue.increment(amount),
    lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (detail) {
    updateData.detailSet = admin.firestore.FieldValue.arrayUnion(detail);
  }
  await participantRef.set(updateData, { merge: true });

  // Recalculate total current from all participants
  const participantsSnap = await activeBossRef.collection('participants').get();
  let totalCurrent = 0;
  participantsSnap.forEach((pDoc) => {
    const pData = pDoc.data();
    totalCurrent += (pData.contributed || 0);
  });

  // Update the boss current total
  const updateBoss = { current: totalCurrent };
  let defeated = false;

  // Check if boss is defeated
  if (totalCurrent >= activeBoss.target) {
    updateBoss.defeated = true;
    defeated = true;

    // Pick 2 random winners from participants
    const participantUIDs = [];
    participantsSnap.forEach((pDoc) => {
      participantUIDs.push({ uid: pDoc.id, username: pDoc.data().username });
    });

    // Shuffle and pick up to 2
    const shuffled = participantUIDs.sort(() => 0.5 - Math.random());
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

    console.log(`Raid Boss "${activeBoss.name}" DEFEATED! Winners: ${winners.map(w => w.uid).join(', ')}`);
  }

  await activeBossRef.update(updateBoss);

  return {
    success: true,
    current: totalCurrent,
    target: activeBoss.target,
    defeated: defeated,
  };
});
