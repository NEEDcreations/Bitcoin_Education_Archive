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

// One-way hash of uid for public dedup (prevents uid exposure in readable docs)
function uidHash(uid) {
  return crypto.createHash('sha256').update('sf_dedup_' + uid).digest('hex').substring(0, 16);
}

const DIFFICULTY_TARGET = 1000;
const HASHES_PER_MINUTE = 10;
const HASH_WINDOW_MS = 60000; // 60 seconds
const FAVOR_DURATION_MINUTES = 60;
const BONUS_MINUTES_PER_POINT = 3;
const POINTS_TO_ACTIVATE = 21;

// Point values by source
const POINT_VALUES = {
  'daily_all_three': 1,
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

// Valid level names per source tier (server-side whitelist)
const LEVEL_TIERS = {
  'level_up': ['Pleb','Pleb II','Pleb III','Stacker','Stacker II','Stacker III'],
  'level_up_5': ['Maxi','Maxi II','Maxi III'],
  'level_up_10': ['Papa John','Full Node','Whale','Sovereign','Cypherpunk','Satoshi'],
};

// Minimum XP thresholds per level (must match client LEVELS array)
const LEVEL_MIN_POINTS = {
  'Pleb': 144, 'Pleb II': 170, 'Pleb III': 256,
  'Stacker': 500, 'Stacker II': 1913, 'Stacker III': 2016,
  'Maxi': 2140, 'Maxi II': 6102, 'Maxi III': 8888,
  'Papa John': 10000, 'Full Node': 18333, 'Whale': 50000,
  'Sovereign': 100000, 'Cypherpunk': 133337, 'Satoshi': 210000,
};

// Max bonus minutes cap (prevent infinite favor window)
const MAX_BONUS_MINUTES = 180; // 3 hours max extension
const MAX_POINTS = 42; // 2x activation threshold — prevents unbounded accumulation

/**
 * contributeFavor (onCall)
 * Called when community earns a Satoshi's Favor point.
 */
exports.contributeFavor = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  // Block anonymous users
  if (context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
    throw new functions.https.HttpsError('permission-denied', 'Anonymous users cannot contribute to Satoshi\'s Favor.');
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

  // Fetch user doc for ALL source types (needed for validation)
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('failed-precondition', 'User profile not found.');
  }
  const userData = userDoc.data();

  // Server-side validation for daily_all_three
  if (source === 'daily_all_three') {
    const allThreeDate = userData.dailyAllThreeDate || '';
    if (allThreeDate !== today) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Must complete daily quiz, trivia, and poll to earn Satoshi\'s Favor.'
      );
    }
  }

  // Server-side validation for level-ups
  if (source === 'level_up' || source === 'level_up_5' || source === 'level_up_10') {
    const validLevels = LEVEL_TIERS[source];
    const levelName = detail || '';
    // Validate the level name is in the correct tier
    if (!validLevels || !validLevels.includes(levelName)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Invalid level name for ${source}: ${levelName}`
      );
    }
    // Validate the user actually has enough points for this level
    const requiredPoints = LEVEL_MIN_POINTS[levelName];
    const userPoints = userData.points || 0;
    if (userPoints < requiredPoints) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `User has ${userPoints} XP but needs ${requiredPoints} for ${levelName}.`
      );
    }
  }

  // Server-side validation for badge_earned
  if (source === 'badge_earned') {
    // detail should be a badge identifier — just sanitize length
    if (!detail || typeof detail !== 'string' || detail.length > 100) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid badge detail.');
    }
  }

  // Build contributor key for dedup — server-controlled, NOT from client detail
  // Level-up and badge keys use today's date so they reset daily (not permanently blocked)
  let contributorKey;
  if (source === 'daily_all_three') {
    contributorKey = `${uid}_${today}_allthree`;
  } else if (source === 'level_up' || source === 'level_up_5' || source === 'level_up_10') {
    // Dedup by uid + validated level name + date (one level-up credit per level per day)
    const validatedLevel = detail; // already validated above against whitelist
    contributorKey = `${uid}_${today}_level_${validatedLevel}`;
  } else if (source === 'badge_earned') {
    // Dedup by uid + sanitized badge id + date (one badge credit per badge per day)
    const safeBadge = detail.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
    contributorKey = `${uid}_${today}_badge_${safeBadge}`;
  } else {
    contributorKey = `${uid}_${source}_${today}`;
  }

  const contributorRef = stateRef.collection('contributors').doc(contributorKey);

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
      // Favor is active and not expired — add bonus minutes (capped)
      const rawBonus = (stateData.bonusMinutes || 0) + (BONUS_MINUTES_PER_POINT * pointsToAdd);
      const newBonus = Math.min(rawBonus, MAX_BONUS_MINUTES);
      const updatedState = { ...stateData, bonusMinutes: newBonus };
      transaction.set(stateRef, updatedState);
      return updatedState;
    } else {
      // Favor not active — add points (capped)
      const rawPoints = (stateData.points || 0) + pointsToAdd;
      const newPoints = Math.min(rawPoints, MAX_POINTS);

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

  // Get username (outside transaction — read-only, not security-critical)
  let username = 'Anonymous';
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      username = userData.username || userData.displayName || 'Anonymous';
    }
  } catch (e) {
    console.warn(`Could not fetch username for ${uid}:`, e.message);
  }

  // Atomic rate-limit check + hash generation inside a transaction
  // Prevents TOCTOU: concurrent requests all reading the same cooldown state
  const hashesRef = stateRef.collection('hashes');
  const cooldownRef = stateRef.collection('cooldowns').doc(uid);

  const { value, isWinner } = await db.runTransaction(async (transaction) => {
    const cooldownDoc = await transaction.get(cooldownRef);
    let timestamps = [];

    if (cooldownDoc.exists) {
      const cdData = cooldownDoc.data();
      timestamps = (cdData.timestamps || []).filter(t => {
        const ms = t.toMillis ? t.toMillis() : t;
        return now - ms < HASH_WINDOW_MS;
      });
      if (timestamps.length >= HASHES_PER_MINUTE) {
        const oldestMs = timestamps[0].toMillis ? timestamps[0].toMillis() : timestamps[0];
        const waitSec = Math.ceil((HASH_WINDOW_MS - (now - oldestMs)) / 1000);
        throw new functions.https.HttpsError(
          'resource-exhausted',
          `Rate limit: ${waitSec}s until next hash (10/min).`
        );
      }
    }

    // Generate random value 0 to 100,000,000
    const val = crypto.randomInt(0, 100000001);
    const winner = val < DIFFICULTY_TARGET;

    // Append timestamp and write cooldown atomically
    timestamps.push(admin.firestore.Timestamp.now());
    transaction.set(cooldownRef, { timestamps });

    return { value: val, isWinner: winner };
  });

  // Write hash doc outside transaction (not security-critical, just record-keeping)
  // NOTE: uid stored in hash doc for internal server use (cooldown, dedup) but stripped from public responses
  const hashDoc = await hashesRef.add({
    uid,
    username,
    value,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    isWinner,
    cycleId: stateData.currentCycleId || null,
  });

  // Update personal best — per-user doc (avoids single-doc bloat)
  const pbRef = db.collection('satoshiFavor').doc('personalBests').collection('users').doc(uid);
  try {
    const pbDoc = await pbRef.get();
    const prev = pbDoc.exists ? pbDoc.data() : null;
    if (!prev || value < prev.value) {
      await pbRef.set({ value, username, timestamp: admin.firestore.FieldValue.serverTimestamp() });
    }
  } catch (e) {
    console.warn('[FAVOR] Personal best update failed:', e.message);
  }

  // Update community top 10 lowest hashes (all-time leaderboard)
  // Uses _uid internally for dedup but does NOT expose it in the public doc
  const lbRef = db.collection('satoshiFavor').doc('topHashes');
  try {
    const lbDoc = await lbRef.get();
    const lbData = lbDoc.exists ? lbDoc.data() : {};
    let entries = lbData.entries || [];
    
    const qualifies = entries.length < 10 || value < entries[entries.length - 1].value;
    
    if (qualifies) {
      entries = entries.filter(e => e._h !== uidHash(uid) || e.value < value);
      const userHasBetter = entries.some(e => e._h === uidHash(uid) && e.value <= value);
      
      if (!userHasBetter) {
        entries.push({ _h: uidHash(uid), username, value, timestamp: admin.firestore.FieldValue.serverTimestamp() });
      }
      entries.sort((a, b) => a.value - b.value);
      entries = entries.slice(0, 10);
      await lbRef.set({ entries });
    }
  } catch (e) {
    console.error('[FAVOR] Top hashes update failed:', e.message, e.stack);
  }

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

  const callerUid = context.auth ? context.auth.uid : null;
  snapshot.forEach((doc) => {
    const d = doc.data();
    hashes.push({
      id: doc.id,
      username: d.username,
      value: d.value,
      timestamp: d.timestamp || null,
      isWinner: d.isWinner || false,
      cycleId: d.cycleId || null,
      isMe: callerUid ? d.uid === callerUid : false,
    });
  });

  return {
    hashes,
    count: hashes.length,
    hasMore: hashes.length === limit,
  };
});

/**
 * syncCycleToTop10 (onCall) — admin only
 * Syncs all hashes from a specific cycle to the all-time top 10.
 * Can be used to backfill missing hashes.
 */
exports.syncCycleToTop10 = functions.https.onCall(async (data, context) => {
  // Admin check - only specific UIDs can run this
  const ADMIN_UIDS = ['Rv2KwSy4flQmYMiHobV1V03KJDX2', 'ZVlpC6mfs1W7GlKsY9TQN3Jr8Hd4']; // Add admin UIDs here
  if (!context.auth || !ADMIN_UIDS.includes(context.auth.uid)) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  const { cycleId } = data || {};
  if (!cycleId) {
    throw new functions.https.HttpsError('invalid-argument', 'cycleId required');
  }

  const stateRef = db.collection('satoshiFavor').doc('current');
  const hashesRef = stateRef.collection('hashes');
  const lbRef = db.collection('satoshiFavor').doc('topHashes');

  // Get all hashes for this cycle
  const snapshot = await hashesRef.where('cycleId', '==', cycleId).get();
  const hashes = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    hashes.push({ uid: d.uid, username: d.username, value: d.value });
  });

  console.log(`[FAVOR-SYNC] Found ${hashes.length} hashes for cycle ${cycleId}`);

  // Get current top 10
  const lbDoc = await lbRef.get();
  const lbData = lbDoc.exists ? lbDoc.data() : {};
  let entries = lbData.entries || [];

  // Process each hash
  let added = 0;
  let skipped = 0;
  for (const hash of hashes) {
    const { uid, username, value } = hash;
    
    // Check if qualifies
    if (entries.length >= 10 && value >= entries[entries.length - 1].value) {
      skipped++;
      continue;
    }
    
    // Filter out worse entries for this user (use hashed uid for dedup)
    entries = entries.filter(e => e._h !== uidHash(uid) || e.value < value);
    
    // Check if user has better entry
    const userHasBetter = entries.some(e => e._h === uidHash(uid) && e.value <= value);
    if (!userHasBetter) {
      entries.push({ _h: uidHash(uid), username, value, timestamp: admin.firestore.FieldValue.serverTimestamp() });
      added++;
    } else {
      skipped++;
    }
  }

  // Sort and trim
  entries.sort((a, b) => a.value - b.value);
  entries = entries.slice(0, 10);
  await lbRef.set({ entries });

  console.log(`[FAVOR-SYNC] Added ${added}, skipped ${skipped}. Total entries now: ${entries.length}`);

  return {
    success: true,
    cycleId,
    hashesProcessed: hashes.length,
    added,
    skipped,
    top10: entries.map(e => ({ username: e.username, value: e.value })),
  };
});
