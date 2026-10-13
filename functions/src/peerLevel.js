/**
 * peerLevel.js — Peer Friendship Level tracking
 *
 * Called internally after a gift is opened (exchange is complete).
 * Updates the peerRelationships doc and both users' denormalized peerData maps,
 * and awards XP to BOTH peers on level-up — all server-side, never client-controlled.
 *
 * Levels:
 *   1 = Unconfirmed    (0 gifts)
 *   2 = Confirmed      (1 gift)     → 3,000 XP each
 *   3 = Channel Partner(21 gifts)   → 21,000 XP each
 *   4 = Routing Node   (144 gifts)  → 50,000 XP each
 *   5 = Wumbo          (210 gifts)  → 100,000 XP each
 *
 * DO NOT call admin.initializeApp() here — it is called in index.js.
 */

const admin = require('firebase-admin');

const db = admin.firestore();

const PEER_LEVELS = [
  { level: 1, name: 'Unconfirmed',     emoji: '⬜', giftsRequired: 0,   xp: 0      },
  { level: 2, name: 'Confirmed',       emoji: '🟨', giftsRequired: 1,   xp: 3000   },
  { level: 3, name: 'Channel Partner', emoji: '⚡', giftsRequired: 21,  xp: 21000  },
  { level: 4, name: 'Routing Node',    emoji: '🔗', giftsRequired: 144, xp: 50000  },
  { level: 5, name: 'Wumbo',           emoji: '🟠', giftsRequired: 210, xp: 100000 },
];

/** Returns the highest level the given gift count qualifies for. */
function getLevelForCount(count) {
  let result = PEER_LEVELS[0];
  for (const tier of PEER_LEVELS) {
    if (count >= tier.giftsRequired) result = tier;
  }
  return result;
}

/**
 * updatePeerLevelAfterGift
 *
 * Call this after openGift's transaction commits successfully.
 *   senderUid    = who sent the gift
 *   recipientUid = who opened it (exchange now complete)
 *
 * Security properties:
 *   - All writes inside a Firestore transaction (atomic, no race conditions)
 *   - XP incremented server-side only — client can never trigger this path
 *   - pairId is always sorted so there is exactly one canonical doc per pair
 *   - Level-up XP is awarded only when newLevel > storedLevel (idempotent)
 *   - Both user docs validated to exist before any writes
 *
 * Returns { giftsExchanged, newLevel, leveledUp, xpAwarded }
 */
async function updatePeerLevelAfterGift(senderUid, recipientUid) {
  // Canonical pair ID — always sort so uid_a < uid_b
  const [uidA, uidB] = [senderUid, recipientUid].sort();
  const pairId    = `${uidA}_${uidB}`;
  const pairRef   = db.collection('peerRelationships').doc(pairId);
  const senderRef = db.collection('users').doc(senderUid);
  const recipRef  = db.collection('users').doc(recipientUid);

  const txResult = await db.runTransaction(async (t) => {
    const [pairDoc, senderDoc, recipDoc] = await Promise.all([
      t.get(pairRef),
      t.get(senderRef),
      t.get(recipRef),
    ]);

    // Both users must still exist
    if (!senderDoc.exists) throw new Error(`[peerLevel] sender ${senderUid} not found`);
    if (!recipDoc.exists)  throw new Error(`[peerLevel] recipient ${recipientUid} not found`);

    const storedLevel    = pairDoc.exists ? (pairDoc.data().level || 1) : 1;
    const prevGifts      = pairDoc.exists ? (pairDoc.data().giftsExchanged || 0) : 0;
    const giftsExchanged = prevGifts + 1;
    const newLevel       = getLevelForCount(giftsExchanged);
    const didLevelUp     = newLevel.level > storedLevel;
    const now            = admin.firestore.FieldValue.serverTimestamp();

    // ── peerRelationships doc ──────────────────────────────────────────────
    const pairWrite = {
      uid1:           uidA,
      uid2:           uidB,
      giftsExchanged: giftsExchanged,
      level:          newLevel.level,
      levelName:      newLevel.name,
      lastGiftAt:     now,
      lastGiftBy:     recipientUid, // opener = exchange complete
    };
    if (!pairDoc.exists)  pairWrite.createdAt     = now;
    if (didLevelUp)       pairWrite.levelUpdatedAt = now;

    t.set(pairRef, pairWrite, { merge: true });

    // ── Denormalized peerData on both user docs (dot notation) ─────────────
    // These let the client show badges without a second collection read.
    const senderPeerUpdate = {
      [`peerData.${recipientUid}.level`]:         newLevel.level,
      [`peerData.${recipientUid}.levelName`]:      newLevel.name,
      [`peerData.${recipientUid}.giftsExchanged`]: giftsExchanged,
    };
    const recipPeerUpdate = {
      [`peerData.${senderUid}.level`]:         newLevel.level,
      [`peerData.${senderUid}.levelName`]:      newLevel.name,
      [`peerData.${senderUid}.giftsExchanged`]: giftsExchanged,
    };

    // ── XP award on level-up — server-side increment only ─────────────────
    // Both peers earn XP. Applied inside the transaction so it's atomic
    // with the level write — no partial states, no double-awards.
    if (didLevelUp && newLevel.xp > 0) {
      const xpFields = {
        points:    admin.firestore.FieldValue.increment(newLevel.xp),
        weeklyXP:  admin.firestore.FieldValue.increment(newLevel.xp),
        monthlyXP: admin.firestore.FieldValue.increment(newLevel.xp),
      };
      Object.assign(senderPeerUpdate, xpFields);
      Object.assign(recipPeerUpdate,  xpFields);
    }

    t.update(senderRef, senderPeerUpdate);
    t.update(recipRef,  recipPeerUpdate);

    return { giftsExchanged, newLevel, didLevelUp, xpAwarded: didLevelUp ? newLevel.xp : 0 };
  });

  // ── Level-up notifications (outside transaction — non-critical) ──────────
  if (txResult.didLevelUp) {
    const { newLevel } = txResult;
    const levelLabel   = `${newLevel.emoji} ${newLevel.name}`;
    const notifBase    = {
      type:       'peer_level_up',
      targetType: 'peer_level_up',
      levelNum:   newLevel.level,
      levelName:  newLevel.name,
      read:       false,
      createdAt:  admin.firestore.FieldValue.serverTimestamp(),
    };
    try {
      await Promise.all([
        db.collection('notifications').add({
          ...notifBase,
          recipientId: senderUid,
          peerId:      recipientUid,
          message:     `Your friendship with this peer reached ${levelLabel}! ⚡ +${newLevel.xp.toLocaleString()} XP`,
        }),
        db.collection('notifications').add({
          ...notifBase,
          recipientId: recipientUid,
          peerId:      senderUid,
          message:     `Your friendship with this peer reached ${levelLabel}! ⚡ +${newLevel.xp.toLocaleString()} XP`,
        }),
      ]);
    } catch (e) {
      console.warn('[peerLevel] notification failed:', e.message);
    }

    console.log(
      `[peerLevel] Level-up! pair=${uidA}_${uidB} → ${newLevel.name} ` +
      `(${txResult.giftsExchanged} gifts, +${newLevel.xp} XP each)`
    );
  }

  return txResult;
}

module.exports = { PEER_LEVELS, getLevelForCount, updatePeerLevelAfterGift };
