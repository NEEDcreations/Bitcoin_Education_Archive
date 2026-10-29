/**
 * peerLevel.js — Peer Friendship Level tracking
 *
 * Called internally after a gift is opened (exchange is complete).
 * Updates the peerRelationships doc and both users' denormalized peerData maps,
 * and awards XP to BOTH peers on level-up — all server-side, never client-controlled.
 *
 * Levels:
 *   1 = Unconfirmed       (0 gifts)
 *   2 = Opening Channel   (1 gift)    → 3,000 XP each
 *   3 = Routing Nodes     (21 gifts)  → 21,000 XP each
 *   4 = Adjusted Fees     (44 gifts)  → 44,000 XP each
 *   5 = Balanced Liquidity(144 gifts) → 50,000 XP each
 *   6 = Wumbo Channel     (210 gifts) → 100,000 XP each
 *
 * DO NOT call admin.initializeApp() here — it is called in index.js.
 */

const admin = require('firebase-admin');
const rewardNotify = require('./rewardNotify');
const { planXpGrant, ledgerData: xpLedgerData, ledgerRefFor } = require('./grantXp');
const { offsetDateKey } = require('./offsetDay');
const { rewardBlocked } = require('./cipherClaim');

const db = admin.firestore();

const PEER_LEVELS = [
  { level: 1, name: 'Unconfirmed',        emoji: '⬜', giftsRequired: 0,   xp: 0      },
  { level: 2, name: 'Opening Channel',    emoji: '🟨', giftsRequired: 1,   xp: 3000   },
  { level: 3, name: 'Routing Nodes',      emoji: '⚡', giftsRequired: 21,  xp: 21000  },
  { level: 4, name: 'Adjusted Fees',      emoji: '⚙️', giftsRequired: 44,  xp: 44000  },
  { level: 5, name: 'Balanced Liquidity', emoji: '🔗', giftsRequired: 144, xp: 50000  },
  { level: 6, name: 'Wumbo Channel',      emoji: '🟠', giftsRequired: 210, xp: 100000 },
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
    const dayKey = offsetDateKey(Date.now());
    const senderDailyRef = senderRef.collection('daily_points').doc(dayKey);
    const recipDailyRef = recipRef.collection('daily_points').doc(dayKey);
    const senderLedgerRef = db.collection('faucet_ledger').doc(senderUid);
    const recipLedgerRef = db.collection('faucet_ledger').doc(recipientUid);
    const [pairDoc, senderDoc, recipDoc, senderDaily, recipDaily, senderLedger, recipLedger] = await Promise.all([
      t.get(pairRef),
      t.get(senderRef),
      t.get(recipRef),
      t.get(senderDailyRef),
      t.get(recipDailyRef),
      t.get(senderLedgerRef),
      t.get(recipLedgerRef),
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

    // Level-up XP shares the 500 / 900 / 1,000 daily counter.
    // The base is doubled once while Double XP is open, then tapered.
    const rawXp = (didLevelUp && newLevel.xp > 0) ? newLevel.xp : 0;
    function taperedXp(raw, userDoc, dailyDoc, ledgerDoc) {
      const empty = { awarded: 0, base: raw, boosted: 0, doubled: false, dailyXp: null, until: 0, capExempt: false };
      if (!(raw > 0)) return empty;
      const user = userDoc.data() || {};
      const ledger = ledgerDoc.exists ? (ledgerDoc.data() || {}) : null;
      if (rewardBlocked(user, ledger)) return empty;
      const used = dailyDoc.exists ? Number((dailyDoc.data() || {}).total || 0) : 0;
      return planXpGrant({ base: raw, user: user, now: Date.now(), dailyUsed: used });
    }
    const senderPlan = taperedXp(rawXp, senderDoc, senderDaily, senderLedger);
    const recipPlan = taperedXp(rawXp, recipDoc, recipDaily, recipLedger);
    const senderXp = senderPlan.awarded;
    const recipXp = recipPlan.awarded;
    function xpFields(amount) {
      return {
        points:    admin.firestore.FieldValue.increment(amount),
        weeklyXP:  admin.firestore.FieldValue.increment(amount),
        monthlyXP: admin.firestore.FieldValue.increment(amount),
      };
    }
    if (senderXp > 0) {
      Object.assign(senderPeerUpdate, xpFields(senderXp));
      t.set(senderDailyRef, { total: senderPlan.dailyXp, lastUpdated: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      t.set(ledgerRefFor(senderRef, 'peer_' + pairId + '_' + newLevel.level), xpLedgerData(senderPlan, {
        source: 'peer_level',
        day: dayKey,
        uid: senderUid,
      }));
    }
    if (recipXp > 0) {
      Object.assign(recipPeerUpdate, xpFields(recipXp));
      t.set(recipDailyRef, { total: recipPlan.dailyXp, lastUpdated: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      t.set(ledgerRefFor(recipRef, 'peer_' + pairId + '_' + newLevel.level), xpLedgerData(recipPlan, {
        source: 'peer_level',
        day: dayKey,
        uid: recipientUid,
      }));
    }

    t.update(senderRef, senderPeerUpdate);
    t.update(recipRef,  recipPeerUpdate);

    return {
      giftsExchanged,
      storedLevel,
      newLevel,
      didLevelUp,
      xpAwarded: senderXp,
      senderXp,
      recipXp,
      senderPoints: senderDoc.data().points || 0,
      recipPoints: recipDoc.data().points || 0,
    };
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
          message:     `Your friendship with this peer reached ${levelLabel}! ⚡ +${(txResult.senderXp || 0).toLocaleString()} XP`,
        }),
        db.collection('notifications').add({
          ...notifBase,
          recipientId: recipientUid,
          peerId:      senderUid,
          message:     `Your friendship with this peer reached ${levelLabel}! ⚡ +${(txResult.recipXp || 0).toLocaleString()} XP`,
        }),
      ]);
    } catch (e) {
      console.warn('[peerLevel] notification failed:', e.message);
    }
    const notices = [];
    if (txResult.senderXp > 0) {
      notices.push.apply(notices, rewardNotify.plan({
        uid: senderUid,
        pointsBefore: txResult.senderPoints,
        pointsDelta: txResult.senderXp,
      }));
    }
    if (txResult.recipXp > 0) {
      notices.push.apply(notices, rewardNotify.plan({
        uid: recipientUid,
        pointsBefore: txResult.recipPoints,
        pointsDelta: txResult.recipXp,
      }));
    }
    if (notices.length) {
      await rewardNotify.safeCommit(db, admin.firestore.FieldValue.serverTimestamp(), notices);
    }
    try {
      const { sendUserPush } = require('./push');
      const levelBody = 'Your peer friendship reached ' + newLevel.name + '.';
      await Promise.all([
        sendUserPush(senderUid, 'gifts', {
          title: 'Friendship level up',
          body: levelBody,
          url: 'https://bitcoineducation.quest/#questhub'
        }),
        sendUserPush(recipientUid, 'gifts', {
          title: 'Friendship level up',
          body: levelBody,
          url: 'https://bitcoineducation.quest/#questhub'
        })
      ]);
    } catch (e) {
      console.warn('[peerLevel] push failed:', e.message);
    }

    console.log(
      `[peerLevel] Level-up! pair=${uidA}_${uidB} → ${newLevel.name} ` +
      `(${txResult.giftsExchanged} gifts, sender +${txResult.senderXp || 0} XP, peer +${txResult.recipXp || 0} XP)`
    );
  }

  return txResult;
}

module.exports = { PEER_LEVELS, getLevelForCount, updatePeerLevelAfterGift };
