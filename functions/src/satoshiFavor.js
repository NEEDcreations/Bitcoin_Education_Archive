/**
 * satoshiFavor – Satoshi's Favor Cloud Functions
 * Community-driven mining game for Bitcoin Education Archive.
 *
 * DO NOT call admin.initializeApp() here — it's called in index.js.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

const db = admin.firestore();

const DIFFICULTY_TARGET = 1000;
const HASH_COOLDOWN_SECONDS = 60; // max 10 hashes per 60 seconds (rate limit enforced server‑side)
const FAVOR_DURATION_MINUTES = 60;
const BONUS_MINUTES_PER_POINT = 3;
const POINTS_TO_ACTIVATE = 21;

// Point values by source
const POINT_VALUES = {
  'quiz_daily_3': 1,
  'level_up': 1,
  'level_up_5': 5,
  'level_up_10': 10,
  'badge_earned': 1,
};

/**
 * Helper: Get today's date string in YYYY-MM-DD format
 */
function getTodayString() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Helper: Check if favor has expired and reset if needed.
 * Must be called inside a transaction with the current state doc ref.
 * Returns the (possibly reset) state data.
 */
function checkAndResetFavor(stateData, transaction, stateRef) {
  if (!stateData.favorActive) return stateData;

  const now = Date.now();
  const favorEndBase = stateData.favorEndBase ? stateData.favorEndBase.toMillis() : 0;
  const bonusMs = (stateData.bonusMinutes || 0) * 60 * 1000;
  const effectiveEnd = favorEndBase + bonusMs;

  if (now > effectiveEnd) {
    // Favor has expired — reset
    const resetData = {
      points: 0,
      favorActive: false,
      favorStart: null,
      favorEndBase: null,
      bonusMinutes: 0,
      lastReset: admin.firestore.Timestamp.now(),
      currentCycleId: stateData.currentCycleId || null,
    };
    transaction.set(stateRef, resetData);
    return resetData;
  }

  return stateData;
}

/**
 * contributeFavor (onCall)
 * Called when community earns a Satoshi's Favor point.
 */
exports.contributeFavor = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const uid = context.auth.uid;
  const { source, detail } = data;

  // Validate source
  if (!source || !POINT_VALUES[source]) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Invalid source. Must be one of: ${Object.keys(POINT_VALUES).join(', ')}`
    );
  }

  const pointsToAdd = POINT_VALUES[source];
  const stateRef = db.collection('satoshiFavor').doc('current');
  const today = getTodayString();

  // Build contributor key for dedup
  let contributorKey;
  if (source === 'quiz_daily_3') {
    contributorKey = `${uid}_${today}_quiz`;
  } else {
    // For level-ups, use the detail (level name) for dedup
    const levelName = detail || source;
    contributorKey = `${uid}_${levelName}`;
  }

  const contributorRef = stateRef.collection('contributors').doc(contributorKey);

  // Server-side validation for quiz_daily_3
  if (source === 'quiz_daily_3') {
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'User profile not found.');
    }
    const userData = userDoc.data();
    const questsToday = userData.questsCompletedToday || 0;
    const lastQuestDate = userData.lastQuestDate || '';

    if (questsToday < 3 || lastQuestDate !== today) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Must complete 3 quests today to contribute via quiz_daily_3.'
      );
    }
  }

  // Run in a transaction for atomicity
  const result = await db.runTransaction(async (transaction) => {
    // Check dedup
    const contributorDoc = await transaction.get(contributorRef);
    if (contributorDoc.exists) {
      throw new functions.https.HttpsError(
        'already-exists',
        'You have already contributed for this action.'
      );
    }

    // Get current state
    const stateDoc = await transaction.get(stateRef);
    let stateData = stateDoc.exists ? stateDoc.data() : {
      points: 0,
      favorActive: false,
      favorStart: null,
      favorEndBase: null,
      bonusMinutes: 0,
      lastReset: admin.firestore.Timestamp.now(),
      currentCycleId: null,
    };

    // Check if favor expired, reset if needed
    stateData = checkAndResetFavor(stateData, transaction, stateRef);

    // Record contributor
    transaction.set(contributorRef, {
      uid,
      source,
      detail: detail || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (stateData.favorActive) {
      // Favor is active and not expired — add bonus minutes
      const newBonus = (stateData.bonusMinutes || 0) + (BONUS_MINUTES_PER_POINT * pointsToAdd);
      const updatedState = { ...stateData, bonusMinutes: newBonus };
      transaction.set(stateRef, updatedState);
      return updatedState;
    } else {
      // Favor not active — add points
      const newPoints = (stateData.points || 0) + pointsToAdd;

      if (newPoints >= POINTS_TO_ACTIVATE) {
        // Activate favor! Extra points beyond 21 become bonus minutes
        const overflowPoints = newPoints - POINTS_TO_ACTIVATE;
        const overflowBonus = overflowPoints * BONUS_MINUTES_PER_POINT;
        const now = admin.firestore.Timestamp.now();
        const endBase = admin.firestore.Timestamp.fromMillis(
          now.toMillis() + FAVOR_DURATION_MINUTES * 60 * 1000
        );
        const newCycleId = `cycle_${Date.now()}`;
        const activatedState = {
          points: newPoints,
          favorActive: true,
          favorStart: now,
          favorEndBase: endBase,
          bonusMinutes: overflowBonus,
          lastReset: stateData.lastReset || null,
          currentCycleId: newCycleId,
        };
        transaction.set(stateRef, activatedState);
        return activatedState;
      } else {
        // Just add points
        const updatedState = { ...stateData, points: newPoints };
        transaction.set(stateRef, updatedState);
        return updatedState;
      }
    }
  });

  return {
    success: true,
    points: result.points,
    favorActive: result.favorActive,
    bonusMinutes: result.bonusMinutes || 0,
    currentCycleId: result.currentCycleId || null,
  };
});

/**
 * hashForFavor (onCall)
 * The mining/hashing function. Auth required.
 */
exports.hashForFavor = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const uid = context.auth.uid;

  // Must not be anonymous
  if (context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
    throw new functions.https.HttpsError('permission-denied', 'Anonymous users cannot mine.');
  }

  const stateRef = db.collection('satoshiFavor').doc('current');

  // Check favor state
  const stateDoc = await stateRef.get();
  if (!stateDoc.exists) {
    throw new functions.https.HttpsError('failed-precondition', 'Satoshi\'s Favor has not been initialized.');
  }

  const stateData = stateDoc.data();

  if (!stateData.favorActive) {
    throw new functions.https.HttpsError('failed-precondition', 'Satoshi\'s Favor is not currently active.');
  }

  // Check if favor has expired
  const now = Date.now();
  const favorEndBase = stateData.favorEndBase ? stateData.favorEndBase.toMillis() : 0;
  const bonusMs = (stateData.bonusMinutes || 0) * 60 * 1000;
  const effectiveEnd = favorEndBase + bonusMs;

  if (now > effectiveEnd) {
    throw new functions.https.HttpsError('failed-precondition', 'Satoshi\'s Favor has expired.');
  }

  // Check cooldown via per-user cooldown doc (avoids composite index on hashes subcollection)
  const hashesRef = stateRef.collection('hashes');
  const cooldownRef = stateRef.collection('cooldowns').doc(uid);
  const cooldownDoc = await cooldownRef.get();

  if (cooldownDoc.exists) {
    const lastTime = cooldownDoc.data().lastHash;
    if (lastTime) {
      const lastMs = lastTime.toMillis ? lastTime.toMillis() : lastTime;
      const elapsed = (now - lastMs) / 1000;
      if (elapsed < HASH_COOLDOWN_SECONDS) {
        const remaining = Math.ceil(HASH_COOLDOWN_SECONDS - elapsed);
        throw new functions.https.HttpsError(
          'resource-exhausted',
          `Cooldown active. Wait ${remaining} more seconds.`
        );
      }
    }
  }

  // Get username
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

  // Generate random value 0 to 100,000,000 (inclusive of 0, exclusive of 100,000,001)
  const value = crypto.randomInt(0, 100000001);
  const isWinner = value < DIFFICULTY_TARGET;

  // Write hash to subcollection + update cooldown doc
  const hashDoc = await hashesRef.add({
    uid,
    username,
    value,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    isWinner,
    cycleId: stateData.currentCycleId || null,
  });

  // Update cooldown doc for fast lookup next time
  await cooldownRef.set({
    lastHash: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    value,
    isWinner,
    hashId: hashDoc.id,
  };
});

/**
 * checkFavorState (onCall) — lightweight
 * Returns current state. No auth required. Auto-resets if expired.
 */
exports.checkFavorState = functions.https.onCall(async (data, context) => {
  const stateRef = db.collection('satoshiFavor').doc('current');
  const stateDoc = await stateRef.get();

  if (!stateDoc.exists) {
    return {
      points: 0,
      favorActive: false,
      favorStart: null,
      favorEndBase: null,
      bonusMinutes: 0,
      lastReset: null,
      currentCycleId: null,
    };
  }

  let stateData = stateDoc.data();

  // Check if expired and reset
  if (stateData.favorActive) {
    const now = Date.now();
    const favorEndBase = stateData.favorEndBase ? stateData.favorEndBase.toMillis() : 0;
    const bonusMs = (stateData.bonusMinutes || 0) * 60 * 1000;
    const effectiveEnd = favorEndBase + bonusMs;

    if (now > effectiveEnd) {
      // Reset
      const resetData = {
        points: 0,
        favorActive: false,
        favorStart: null,
        favorEndBase: null,
        bonusMinutes: 0,
        lastReset: admin.firestore.Timestamp.now(),
        currentCycleId: stateData.currentCycleId || null,
      };
      await stateRef.set(resetData);
      stateData = resetData;
    }
  }

  return {
    points: stateData.points || 0,
    favorActive: stateData.favorActive || false,
    favorStart: stateData.favorStart || null,
    favorEndBase: stateData.favorEndBase || null,
    bonusMinutes: stateData.bonusMinutes || 0,
    lastReset: stateData.lastReset || null,
    currentCycleId: stateData.currentCycleId || null,
  };
});

/**
 * getFavorHashes (onCall) — public
 * Returns recent hashes from subcollection, paginated.
 */
exports.getFavorHashes = functions.https.onCall(async (data, context) => {
  const limit = Math.min(Math.max((data && data.limit) || 50, 1), 100);
  const after = (data && data.after) || null;

  const stateRef = db.collection('satoshiFavor').doc('current');
  const hashesRef = stateRef.collection('hashes');

  let query = hashesRef.orderBy('timestamp', 'desc').limit(limit);

  if (after) {
    // Get the cursor document
    const cursorDoc = await hashesRef.doc(after).get();
    if (cursorDoc.exists) {
      query = hashesRef.orderBy('timestamp', 'desc').startAfter(cursorDoc).limit(limit);
    }
  }

  const snapshot = await query.get();
  const hashes = [];

  snapshot.forEach((doc) => {
    const d = doc.data();
    hashes.push({
      id: doc.id,
      uid: d.uid,
      username: d.username,
      value: d.value,
      timestamp: d.timestamp || null,
      isWinner: d.isWinner || false,
      cycleId: d.cycleId || null,
    });
  });

  return {
    hashes,
    count: hashes.length,
    hasMore: hashes.length === limit,
  };
});
