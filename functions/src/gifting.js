'use strict';

// Gifts, keys, and locked ciphers.
// The client is hostile: rewards, limits, and RNG live here.
// Admin SDK writes bypass Firestore rules; rules still deny client writes.

const functionsV1 = require('firebase-functions/v1');
const admin = require('firebase-admin');
const crypto = require('crypto');
const dns = require('dns').promises;
const bolt11 = require('bolt11');
const { resolveLnurlInvoice } = require('./lnurlResolve');
const { NWCClient } = require('@getalby/sdk');
const { updatePeerLevelAfterGift } = require('./peerLevel');
const { rollCipherReward } = require('./cipherReward');
const { planCipherShare, senderFromKey, clonePrize } = require('./cipherShare');
const { rollGiftReward: rollGiftRewardImpl, rollGiftCount } = require('./giftRoll');
const { planDailyXp } = require('./dailyXp');
const { applyDailyXp } = require('./applyDailyXp');
const rewardNotify = require('./rewardNotify');
const doubleXp = require('./doubleXp');
const {
    assessCipherClaim,
    isSatsBanned,
    rewardBlocked,
    SATS_BANNED_ERROR,
    lookupRequestFromDecoded,
    shouldLookupPay,
    lookupSettlement,
    adminClaimFlag,
} = require('./cipherClaim');
const { planShoutout, applyShoutoutCap, shoutoutDocId } = require('./shoutout');
const { publishShoutoutOnce } = require('./shoutoutPublish');
const { mirrorShoutoutOnce } = require('./telegramBridge');

const db = admin.firestore();

function rewardStamp() {
    return admin.firestore.FieldValue.serverTimestamp();
}

const CIPHER_LABELS = ['3A', '7F', 'B2', 'D9', '1C', '8E', 'A4', 'F6'];
const CIPHER_OPENS_PER_DAY = 21;
const KEYS_PER_SEND = 3;
const WALLET_FLOOR_SATS = 5000; // matches FAUCET.WALLET_BALANCE_FLOOR_SATS
const KEY_SEND_XP = 25;
const NWC_URL = process.env.NWC_URL || '';

const GIFT_CLOSET_ITEMS = [
    { id: 'orange_scarf',    name: 'Bitcoin Scarf',    emoji: '🧣' },
    { id: 'sunglasses',      name: 'Cool Shades',      emoji: '🕶️' },
    { id: 'bowtie',          name: 'Fancy Bowtie',     emoji: '🎀' },
    { id: 'mining_helmet',   name: 'Mining Helmet',    emoji: '⛑️' },
    { id: 'lightning_chain', name: 'Lightning Chain',  emoji: '⚡' },
    { id: 'party_hat',       name: 'Party Hat',        emoji: '🎉' },
    { id: 'hodl_hoodie',     name: 'HODL Hoodie',      emoji: '🧥' },
    { id: 'laser_eyes',      name: 'Laser Eyes',       emoji: '🔴' },
    { id: 'wizard_hat',      name: 'Wizard Hat',       emoji: '🪄' },
    { id: 'crown',           name: 'Royal Crown',      emoji: '👑' },
    { id: 'steak',           name: 'Proof of Steak',   emoji: '🥩' },
    { id: 'diamond_hooves',  name: 'Diamond Hooves',   emoji: '💎' },
    { id: 'astronaut',       name: 'Moon Helmet',      emoji: '🪖' },
    { id: 'cape_permanent',  name: 'Hero Cape',        emoji: '🦸' },
];

function getOffsetDateKey() {
    const shifted = new Date(Date.now() - 5 * 3600 * 1000);
    return shifted.toISOString().split('T')[0];
}

function utcDateKey() {
    return new Date().toISOString().slice(0, 10);
}

function httpsError(code, message) {
    return new functionsV1.https.HttpsError(code, message);
}

function requireUser(context) {
    if (!context.auth) throw httpsError('unauthenticated', 'Must be signed in');
    if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw httpsError('unauthenticated', 'Must use a real account');
    }
    return context.auth.uid;
}

function safeName(name) {
    return String(name || 'a Bitcoiner').replace(/[\r\n<>]/g, ' ').trim().slice(0, 40) || 'a Bitcoiner';
}

function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise(function(_, reject) {
            setTimeout(function() { reject(new Error('[TIMEOUT] ' + label)); }, ms);
        }),
    ]);
}

function rollGiftReward() {
    return rollGiftRewardImpl({ labels: CIPHER_LABELS, closet: GIFT_CLOSET_ITEMS });
}

function publicReward(reward) {
    const out = { rewardType: reward.rewardType };
    if (reward.ticketCount != null) out.ticketCount = reward.ticketCount;
    if (reward.xpAmount != null) out.xpAmount = reward.xpAmount;
    if (reward.itemId) out.itemId = reward.itemId;
    if (reward.itemName) out.itemName = reward.itemName;
    if (reward.itemEmoji) out.itemEmoji = reward.itemEmoji;
    if (reward.closetDupe) out.closetDupe = true;
    if (Array.isArray(reward.keyLabels)) out.keyLabels = reward.keyLabels.slice();
    if (Array.isArray(reward.cipherLabels)) out.cipherLabels = reward.cipherLabels.slice();
    if (Array.isArray(reward.keyIds)) out.keyIds = reward.keyIds.slice();
    if (Array.isArray(reward.cipherIds)) out.cipherIds = reward.cipherIds.slice();
    if (reward.satsAmount) out.satsAmount = reward.satsAmount;
    if (reward.winId) out.winId = reward.winId;
    if (reward.satsStatus) out.satsStatus = reward.satsStatus;
    if (reward.shoutoutConverted) out.shoutoutConverted = true;
    if (reward.conversionMessage) out.conversionMessage = reward.conversionMessage;
    return out;
}

async function postNacho(text, mentionUid) {
    // isNachoAuto must be false. The global chat listener only shows
    // isNachoAuto == false, so a true flag writes a message nobody sees.
    // mentionUid is what turns the first @username into a profile tag.
    const msg = {
        uid: 'nacho-bot',
        name: 'Nacho 🦌',
        text: text,
        isNachoAuto: false,
        ts: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (mentionUid) msg.mentionUid = mentionUid;
    await db.collection('global_chat').add(msg);
}

// One chat message per prize. publishShoutoutOnce writes the chat doc and
// returns whether this call actually posted it. The mention push runs only
// then, so a retry does not notify twice. PlebTalk and Marketplace shoutouts
// go through announceActivity and do not push.
async function publishShoutout(markerRef, plan) {
    const published = await publishShoutoutOnce({
        db: db,
        admin: admin,
        markerRef: markerRef,
        plan: plan,
    });
    if (published && published.wrote && plan.mentionUid && !plan.activityRef) {
        try {
            const { sendUserPush } = require('./push');
            await sendUserPush(plan.mentionUid, 'mentions', {
                title: 'Nacho mentioned you',
                body: 'Your shoutout is in global chat.',
                url: 'https://bitcoineducation.quest/#chat'
            });
        } catch (e) { console.warn('[shoutout] push failed:', e.message); }
    }
    return published;
}

async function maybeAnnounceShoutout(opts) {
    const userRef = db.collection('users').doc(opts.uid);
    const ledgerRef = db.collection('faucet_ledger').doc(opts.uid);
    const [uSnap, lSnap, mSnap] = await Promise.all([
        userRef.get(),
        ledgerRef.get(),
        opts.markerRef.get(),
    ]);
    const user = uSnap.exists ? uSnap.data() : {};
    const ledger = lSnap.exists ? lSnap.data() : null;
    const marker = mSnap.exists ? mSnap.data() : {};
    const plan = planShoutout({
        rewardType: 'nacho_shoutout',
        banned: isSatsBanned(user, ledger),
        alreadyPosted: marker.shoutoutPosted === true,
        username: user.username,
        uid: opts.uid,
        prizeId: opts.prizeId,
    });
    if (!plan.post) {
        if (plan.reason === 'banned' && marker.shoutoutPosted !== true) {
            await opts.markerRef.set({ shoutoutSkipped: 'banned' }, { merge: true }).catch(function() {});
        } else if (plan.reason === 'already_posted') {
            // openGift retries this function after the chat doc exists. Mirror
            // is skipped when telegramMsgId or telegramMirrored is already set.
            await mirrorShoutoutQuiet(shoutoutDocId(opts.prizeId), 'global_chat');
        }
        return plan;
    }
    await publishShoutout(opts.markerRef, plan);
    await mirrorShoutoutQuiet(plan.docId, plan.collection, plan.text);
    return plan;
}

// Best-effort. mirrorShoutoutOnce already swallows bridge errors; this guard
// keeps a surprise throw from failing the gift open or posting twice on retry.
async function mirrorShoutoutQuiet(docId, collection, text) {
    try {
        await mirrorShoutoutOnce({
            db: db,
            docId: docId,
            collection: collection || 'global_chat',
            text: text,
        });
    } catch (err) {
        console.warn('[shoutout] telegram mirror failed');
    }
}

function nachoSatsText(username, amount) {
    return '🔓⚡ @' + safeName(username) + ' just won ' + Number(amount).toLocaleString('en-US') +
        ' sats from a locked cipher! Send peer requests and spin the daily wheel to get locked ciphers of your own. 🔑🎡';
}

// ─── Award daily gifts (transactional, no inventory cap) ─────────────────────

const awardDailyGifts = functionsV1.https.onCall(async (data, context) => {
    const uid = requireUser(context);
    const today = getOffsetDateKey();
    const userRef = db.collection('users').doc(uid);

    const result = await db.runTransaction(async (t) => {
        const userDoc = await t.get(userRef);
        if (!userDoc.exists) throw httpsError('not-found', 'User not found');
        if (userDoc.data().lastGiftSpinDate === today) return { alreadyAwarded: true };

        const giftsToAdd = rollGiftCount();
        const gifts = [];

        for (let i = 0; i < giftsToAdd; i++) {
            const reward = rollGiftReward();
            const giftRef = db.collection('gifts').doc();
            const secretRef = db.collection('gift_secrets').doc(giftRef.id);
            t.set(giftRef, {
                ownerId: uid,
                status: 'unopened',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdDateKey: today,
                rewardType: reward.rewardType,
            });
            t.set(secretRef, Object.assign({}, reward, {
                ownerId: uid,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }));
            gifts.push({ id: giftRef.id, rewardType: reward.rewardType });
        }

        t.update(userRef, { lastGiftSpinDate: today });
        if (giftsToAdd > 0) {
            try {
                rewardNotify.apply(t, db, rewardStamp(), rewardNotify.plan({
                    uid: uid,
                    onceKey: 'gifts_' + today,
                    type: 'gift_received',
                    icon: '🎁',
                    targetType: 'gift',
                    targetId: gifts[0] ? gifts[0].id : null,
                    message: '🎁 You received ' + giftsToAdd + ' gift' + (giftsToAdd === 1 ? '' : 's') + '. Open them to see what is inside.',
                }));
            } catch (notifyErr) {
                console.warn('[awardDailyGifts] reward notify skipped:', notifyErr && notifyErr.message);
            }
        }
        return { success: true, giftsAdded: giftsToAdd, gifts: gifts };
    });

    return result;
});

// ─── Open a gift (new unopened, or legacy inventory / sent) ──────────────────

const OPEN_STATUSES = { unopened: true, inventory: true, sent: true };

const openGift = functionsV1.https.onCall(async (data, context) => {
    const secondFactor = require('./secondFactor');
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    const uid = requireUser(context);
    const giftId = (data.giftId || '').toString().trim();
    if (!giftId || giftId.length > 128) throw httpsError('invalid-argument', 'Invalid giftId');

    const giftRef = db.collection('gifts').doc(giftId);
    const secretRef = db.collection('gift_secrets').doc(giftId);
    const userRef = db.collection('users').doc(uid);
    let rewardResult = null;
    let peerSender = null;
    let giftPointsBefore = 0;
    let shoutoutWon = false;

    await db.runTransaction(async (t) => {
        const giftDay = getOffsetDateKey();
        const dailyRef = userRef.collection('daily_points').doc(giftDay);
        const ledgerRef = db.collection('faucet_ledger').doc(uid);
        const giftDoc = await t.get(giftRef);
        const secretDoc = await t.get(secretRef);
        const userDoc = await t.get(userRef);
        const dailyDoc = await t.get(dailyRef);
        const ledgerDoc = await t.get(ledgerRef);

        if (!giftDoc.exists) throw httpsError('not-found', 'Gift not found');
        if (!userDoc.exists) throw httpsError('not-found', 'User not found');

        const gift = giftDoc.data();
        const user = userDoc.data();
        if (gift.ownerId !== uid) throw httpsError('permission-denied', 'Not your gift');
        if (gift.status === 'opened') throw httpsError('already-exists', 'Gift already opened');
        if (!OPEN_STATUSES[gift.status]) throw httpsError('failed-precondition', 'Gift not ready to open');
        if (gift.status === 'sent' && gift.sentTo && gift.sentTo !== uid) {
            throw httpsError('permission-denied', 'Gift not addressed to you');
        }

        let reward = null;
        if (secretDoc.exists && secretDoc.data().rewardType) reward = secretDoc.data();
        else if (gift.rewardData && gift.rewardData.rewardType) reward = gift.rewardData;
        else {
            console.warn('[openGift] missing secret, rolling fresh reward for ' + giftId);
            reward = rollGiftReward();
        }

        const userUpdate = {};
        const now = admin.firestore.FieldValue.serverTimestamp();
        const keyIds = [];
        const cipherIds = [];

        // The reward was rolled when the gift was created. Apply the weekly
        // cap here, on the stored reward, so older 5% shoutouts convert too.
        // lastShoutoutAt is written in this same transaction; a concurrent
        // open retries, sees the stamp, and converts instead of posting.
        if (reward && reward.rewardType === 'nacho_shoutout') {
            const cap = applyShoutoutCap({
                reward: reward,
                lastShoutoutAt: user.lastShoutoutAt,
                nowMs: Date.now(),
            });
            reward = cap.reward;
            if (cap.awarded) {
                userUpdate.lastShoutoutAt = now;
                userUpdate.giftShoutoutWon = true;
                shoutoutWon = true;
            }
        }
        userUpdate.giftsOpened = admin.firestore.FieldValue.increment(1);

        if (reward.rewardType === 'tickets') {
            userUpdate.orangeTickets = admin.firestore.FieldValue.increment(reward.ticketCount || 1);
        } else if (reward.rewardType === 'xp_bonus') {
            const ledger = ledgerDoc.exists ? (ledgerDoc.data() || {}) : null;
            let xp = reward.xpAmount || 50;
            if (rewardBlocked(user, ledger)) xp = 0;
            else {
                const used = dailyDoc.exists ? (Number(dailyDoc.data().total) || 0) : 0;
                xp = planDailyXp(used, xp).awarded;
                if (xp > 0) {
                    t.set(dailyRef, {
                        total: used + xp,
                        lastUpdated: now,
                    }, { merge: true });
                }
            }
            reward = Object.assign({}, reward, { xpAmount: xp });
            if (xp > 0) {
                userUpdate.points = admin.firestore.FieldValue.increment(xp);
                userUpdate.weeklyXP = admin.firestore.FieldValue.increment(xp);
                userUpdate.monthlyXP = admin.firestore.FieldValue.increment(xp);
            }
        } else if (reward.rewardType === 'streak_shield') {
            userUpdate.streakFreezes = admin.firestore.FieldValue.increment(1);
        } else if (reward.rewardType === 'closet_item') {
            const existing = user.spinClosetItems || [];
            if (reward.itemId && existing.indexOf(reward.itemId) === -1) {
                userUpdate.spinClosetItems = admin.firestore.FieldValue.arrayUnion(reward.itemId);
            } else {
                reward = Object.assign({}, reward, { rewardType: 'tickets', ticketCount: 1, closetDupe: true });
                userUpdate.orangeTickets = admin.firestore.FieldValue.increment(1);
            }
        } else if (reward.rewardType === 'keys' && Array.isArray(reward.keyLabels)) {
            reward.keyLabels.forEach(function(label) {
                if (CIPHER_LABELS.indexOf(label) === -1) return;
                const keyRef = db.collection('keys').doc();
                keyIds.push(keyRef.id);
                // A key the user earns has no sender. sendKeys writes that field.
                t.set(keyRef, {
                    ownerId: uid,
                    label: label,
                    status: 'inventory',
                    createdAt: now,
                    sentTo: null,
                    sentBy: null,
                    sentByName: null,
                    sentAt: null,
                    consumedAt: null,
                });
            });
            reward = Object.assign({}, reward, { keyIds: keyIds });
        } else if (reward.rewardType === 'locked_ciphers' && Array.isArray(reward.cipherLabels)) {
            reward.cipherLabels.forEach(function(label) {
                if (CIPHER_LABELS.indexOf(label) === -1) return;
                const cRef = db.collection('locked_ciphers').doc();
                cipherIds.push(cRef.id);
                t.set(cRef, {
                    ownerId: uid,
                    label: label,
                    status: 'inventory',
                    createdAt: now,
                    openedAt: null,
                });
            });
            reward = Object.assign({}, reward, { cipherIds: cipherIds });
        }

        t.update(giftRef, {
            status: 'opened',
            openedAt: now,
            openedBy: uid,
            rewardData: admin.firestore.FieldValue.delete(),
        });
        if (secretDoc.exists) t.delete(secretRef);
        if (Object.keys(userUpdate).length) t.update(userRef, userUpdate);

        if (gift.status === 'sent' && gift.sentBy && gift.sentBy !== uid) {
            peerSender = gift.sentBy;
            t.delete(db.collection('gift_pending_pairs').doc(gift.sentBy + '_' + uid));
        }

        rewardResult = reward;
        giftPointsBefore = user.points || 0;
    });

    if (peerSender) {
        try {
            const level = await updatePeerLevelAfterGift(peerSender, uid);
            await require('./badgeCredit').creditPeerLevel(db, admin, peerSender, uid, level);
        } catch (e) { console.warn('[openGift] peerLevel failed:', e.message); }
    }
    try {
        const ids = require('./grantBadge').familyFor('giftsOpened');
        if (shoutoutWon) ids.push('gift_lucky_shoutout');
        await require('./badgeCredit').grantIds(db, admin, uid, ids);
    } catch (e) { console.warn('[openGift] badges', e.message); }

    if (rewardResult) {
        const spec = { uid: uid, sourceLabel: 'opening a gift', icon: '🎁', pointsBefore: giftPointsBefore, pointsDelta: 0 };
        if (rewardResult.rewardType === 'tickets') {
            spec.tickets = rewardResult.ticketCount || 1;
            if (rewardResult.closetDupe) spec.sourceLabel = 'opening a gift (closet item already owned)';
        } else if (rewardResult.rewardType === 'xp_bonus') {
            spec.xp = rewardResult.xpAmount || 50;
            spec.pointsDelta = spec.xp;
        } else if (rewardResult.rewardType === 'streak_shield') {
            spec.freezes = 1;
            spec.icon = '🧊';
        } else if (rewardResult.rewardType === 'closet_item') {
            spec.gains = ['👔 a closet item'];
            spec.icon = '👔';
        } else if (rewardResult.rewardType === 'keys') {
            const labels = (rewardResult.keyLabels || []).filter(Boolean).join(', ');
            spec.message = '🔑 You received ' + (labels || 'a key') + ' from opening a gift';
            spec.icon = '🔑';
        } else if (rewardResult.rewardType === 'locked_ciphers') {
            const labels = (rewardResult.cipherLabels || []).filter(Boolean).join(', ');
            spec.message = '🔒 You received locked cipher ' + (labels || '') + ' from opening a gift';
            spec.icon = '🔒';
        } else if (rewardResult.rewardType === 'nacho_shoutout') {
            spec.message = '🎁 Nacho shoutout from opening a gift';
        }
        if (spec.tickets || spec.xp || spec.freezes || spec.gains || spec.message) {
            await rewardNotify.safeCommit(db, rewardStamp(), rewardNotify.plan(spec));
        }
    }

    if (rewardResult && rewardResult.rewardType === 'nacho_shoutout') {
        var shoutErr = null;
        for (var attempt = 0; attempt < 3; attempt++) {
            try {
                await maybeAnnounceShoutout({ uid: uid, prizeId: 'gift_' + giftId, markerRef: giftRef });
                shoutErr = null;
                break;
            } catch (e) { shoutErr = e; }
        }
        if (shoutErr) console.warn('[openGift] nacho shoutout failed:', shoutErr.message);
    }

    return { success: true, reward: publicReward(rewardResult || { rewardType: 'tickets', ticketCount: 1 }) };
});

// ─── Send keys (no client bypass; 1 send of up to 3 per recipient per UTC day)

const sendKeys = functionsV1.https.onCall(async (data, context) => {
    const secondFactor = require('./secondFactor');
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    const uid = requireUser(context);
    const recipientUid = (data.recipientUid || '').toString().trim();
    const keyIds = Array.isArray(data.keyIds) ? data.keyIds.map(function(k) { return String(k).trim(); }).filter(Boolean) : [];
    const todayUtc = utcDateKey();
    const todayOffset = getOffsetDateKey();

    if (!recipientUid || recipientUid.length > 128) throw httpsError('invalid-argument', 'Invalid recipient');
    if (uid === recipientUid) throw httpsError('invalid-argument', 'Cannot send keys to yourself');
    if (keyIds.length < 1 || keyIds.length > KEYS_PER_SEND) throw httpsError('invalid-argument', 'Send 1 to 3 keys');
    if (new Set(keyIds).size !== keyIds.length) throw httpsError('invalid-argument', 'Duplicate key');

    const pairIds = Array.from(new Set([
        uid + '_' + recipientUid + '_' + todayUtc,
        uid + '_' + recipientUid + '_' + todayOffset,
    ]));
    const pairRefs = pairIds.map(function(id) { return db.collection('key_send_pairs').doc(id); });
    const canonicalRef = pairRefs[0];
    const senderRef = db.collection('users').doc(uid);
    const recipRef = db.collection('users').doc(recipientUid);
    // Same ban doc openGift reads. There is no sats_ledger collection.
    const ledgerRef = db.collection('faucet_ledger').doc(uid);
    const keyRefs = keyIds.map(function(id) { return db.collection('keys').doc(id); });

    let senderName = 'Someone';
    let xpAwarded = 0;
    let sentLabels = [];
    let senderPointsBefore = 0;

    await db.runTransaction(async (t) => {
        const docs = await Promise.all([
            t.get(senderRef),
            t.get(recipRef),
            t.get(ledgerRef),
        ].concat(pairRefs.map(function(r) { return t.get(r); }), keyRefs.map(function(r) { return t.get(r); })));

        const senderDoc = docs[0];
        const recipDoc = docs[1];
        const ledgerDoc = docs[2];
        const pairDocs = docs.slice(3, 3 + pairRefs.length);
        const keyDocs = docs.slice(3 + pairRefs.length);

        if (!senderDoc.exists) throw httpsError('not-found', 'Sender not found');
        if (!recipDoc.exists) throw httpsError('not-found', 'Recipient not found');

        const sender = senderDoc.data();
        const ledger = ledgerDoc.exists ? (ledgerDoc.data() || {}) : null;
        if (rewardBlocked(sender, ledger)) {
            throw httpsError('permission-denied', 'Key sends are disabled on this account.');
        }
        senderName = safeName(sender.username || 'Someone');
        senderPointsBefore = sender.points || 0;
        sentLabels = [];
        const peers = sender.peers || [];
        if (peers.indexOf(recipientUid) === -1) throw httpsError('failed-precondition', 'You must be peers to send keys');

        pairDocs.forEach(function(pairDoc) {
            if (pairDoc.exists) {
                throw httpsError('failed-precondition', 'Already sent keys to this peer today. Come back tomorrow!');
            }
        });

        keyDocs.forEach(function(keyDoc) {
            if (!keyDoc.exists) throw httpsError('not-found', 'One or more keys not found');
            const key = keyDoc.data();
            if (key.ownerId !== uid) throw httpsError('permission-denied', 'Not your key');
            if (key.status !== 'inventory') throw httpsError('failed-precondition', 'Key already sent or used');
            if (CIPHER_LABELS.indexOf(key.label) === -1) throw httpsError('invalid-argument', 'Invalid key label');
            sentLabels.push(key.label);
        });

        const keyXp = doubleXp.boostPoints(KEY_SEND_XP, sender, Date.now()).points;
        const xpGrant = await applyDailyXp(uid, keyXp, t, { day: todayOffset, userRef: senderRef });
        xpAwarded = xpGrant.awarded;

        const now = admin.firestore.FieldValue.serverTimestamp();
        for (let i = 0; i < keyDocs.length; i++) {
            t.update(keyRefs[i], {
                status: 'sent',
                sentTo: recipientUid,
                sentBy: uid,
                sentByName: senderName,
                sentAt: now,
                ownerId: recipientUid,
                sendPairId: canonicalRef.id,
                // Server-only provenance. Clients cannot write keys, and this
                // call ignores any sender the client put on the request.
                sender: uid,
            });
        }

        t.set(canonicalRef, {
            senderUid: uid,
            recipientUid: recipientUid,
            keyIds: keyIds,
            keyCount: keyIds.length,
            date: todayUtc,
            createdAt: now,
        });

        const prevDate = sender.keysSentDate || '';
        const already = prevDate === todayUtc && Array.isArray(sender.keysSentTo) ? sender.keysSentTo.slice() : [];
        if (already.indexOf(recipientUid) === -1) already.push(recipientUid);
        const senderUpdate = {
            keysSentDate: todayUtc,
            keysSentTo: already,
        };
        if (xpGrant.awarded > 0) {
            senderUpdate.points = admin.firestore.FieldValue.increment(xpGrant.awarded);
            senderUpdate.weeklyXP = admin.firestore.FieldValue.increment(xpGrant.awarded);
            senderUpdate.monthlyXP = admin.firestore.FieldValue.increment(xpGrant.awarded);
            t.set(xpGrant.dailyRef, {
                total: xpGrant.dailyXp,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        t.update(senderRef, senderUpdate);
    });

    try {
        try {
            const { sendUserPush } = require('./push');
            await sendUserPush(recipientUid, 'gifts', {
                title: 'Keys received',
                body: senderName + ' sent you ' + keyIds.length + ' key' + (keyIds.length > 1 ? 's' : '') + '.',
                url: 'https://bitcoineducation.quest/#questhub'
            });
        } catch (pushErr) { console.warn('[sendKeys] push failed:', pushErr.message); }
        const labelText = sentLabels.filter(Boolean).join(', ');
        const keyWord = sentLabels.length === 1 ? 'an ' + (labelText || 'key') : (labelText || (keyIds.length + ' keys'));
        await rewardNotify.safeCommit(db, rewardStamp(), rewardNotify.plan({
            uid: recipientUid,
            type: 'keys_received',
            icon: '🔑',
            targetType: 'keys',
            message: '🔑 You received ' + keyWord + ' from @' + senderName,
            onceKey: 'keys_' + uid + '_' + todayUtc,
        }).concat(xpAwarded > 0 ? rewardNotify.plan({
            uid: uid,
            xp: xpAwarded,
            sourceLabel: 'sending keys',
            icon: '🔑',
            pointsBefore: senderPointsBefore,
            pointsDelta: xpAwarded,
            onceKey: 'keysend_' + recipientUid + '_' + todayUtc,
        }) : []));
    } catch (e) { console.warn('[sendKeys] notification failed:', e.message); }

    return { success: true, keysSent: keyIds.length, xpAwarded: xpAwarded };
});

// ─── Open a cipher with a matching key (own or peer-sent) ────────────────────

const decryptCipher = functionsV1.https.onCall(async (data, context) => {
    const secondFactor = require('./secondFactor');
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    const uid = requireUser(context);
    const cipherId = (data.cipherId || '').toString().trim();
    const keyId = (data.keyId || '').toString().trim();
    const today = utcDateKey();
    if (!cipherId || cipherId.length > 128) throw httpsError('invalid-argument', 'Invalid cipher');
    if (!keyId || keyId.length > 128) throw httpsError('invalid-argument', 'Invalid key');

    const cipherRef = db.collection('locked_ciphers').doc(cipherId);
    const keyRef = db.collection('keys').doc(keyId);
    const userRef = db.collection('users').doc(uid);
    const ledgerRef = db.collection('faucet_ledger').doc(uid);
    const reward = rollCipherReward();
    if (reward.rewardType === 'sats' && [100, 500, 1000, 5000, 10000, 50000, 100000].indexOf(reward.satsAmount) === -1) {
        throw httpsError('internal', 'Bad reward roll');
    }
    // One roll. The opener's daily XP taper must not change the prize the sender is offered.
    const sharedPrize = clonePrize(reward);

    let applied = null;
    let cipherPointsBefore = 0;

    await db.runTransaction(async (t) => {
        const cipherDay = getOffsetDateKey();
        const dailyRef = userRef.collection('daily_points').doc(cipherDay);
        const cipherDoc = await t.get(cipherRef);
        const keyDoc = await t.get(keyRef);
        const userDoc = await t.get(userRef);
        const ledgerDoc = await t.get(ledgerRef);
        const dailyDoc = await t.get(dailyRef);
        if (!cipherDoc.exists) throw httpsError('not-found', 'Cipher not found');
        if (!keyDoc.exists) throw httpsError('not-found', 'Key not found');
        if (!userDoc.exists) throw httpsError('not-found', 'User not found');

        const cipher = cipherDoc.data();
        const key = keyDoc.data();
        const user = userDoc.data();
        if (isSatsBanned(user, ledgerDoc.exists ? ledgerDoc.data() : null)) {
            throw httpsError('failed-precondition', SATS_BANNED_ERROR);
        }

        if (cipher.ownerId !== uid) throw httpsError('permission-denied', 'Not your cipher');
        if (cipher.status === 'opened') throw httpsError('already-exists', 'Cipher already opened');
        if (cipher.status !== 'inventory') throw httpsError('failed-precondition', 'Cipher not available');

        if (key.ownerId !== uid) throw httpsError('permission-denied', 'Not your key');
        const ownKey = key.status === 'inventory';
        const peerKey = key.status === 'sent';
        if (!ownKey && !peerKey) throw httpsError('failed-precondition', 'Key already used');
        if (key.label !== cipher.label) {
            throw httpsError('failed-precondition', 'LABEL_MISMATCH:' + key.label + ':' + cipher.label);
        }

        const decDate = user.ciphersDecryptedDate || '';
        const decToday = decDate === today ? (user.ciphersDecryptedToday || 0) : 0;
        if (decToday >= CIPHER_OPENS_PER_DAY) {
            throw httpsError('resource-exhausted', 'Daily cipher limit reached (21 per day). Come back tomorrow!');
        }

        const userUpdate = {
            ciphersDecryptedToday: decToday + 1,
            ciphersDecryptedDate: today,
            ciphersSolved: admin.firestore.FieldValue.increment(1),
        };
        if (decToday + 1 >= CIPHER_OPENS_PER_DAY) userUpdate.cipherFullRing = true;
        const now = admin.firestore.FieldValue.serverTimestamp();
        let winId = null;
        let satsStatus = null;
        let openerDailyTotal = null;
        const ledger = ledgerDoc.exists ? (ledgerDoc.data() || {}) : null;

        // Decide the opener's prize before any write so the sender reads
        // still happen first. The roll above is the only roll.
        if (reward.rewardType === 'sats') {
            satsStatus = reward.satsAmount >= 1000 ? 'pending' : 'claimable'; // under 1,000 auto-pay; 1,000+ manual
            winId = db.collection('cipher_wins').doc().id;
        } else {
            let xp = reward.xpAmount || 50;
            if (rewardBlocked(user, ledger)) xp = 0;
            else {
                const used = dailyDoc.exists ? (Number(dailyDoc.data().total) || 0) : 0;
                const tapered = planDailyXp(used, xp);
                xp = tapered.awarded;
                if (xp > 0) openerDailyTotal = tapered.dailyXp;
            }
            reward.xpAmount = xp;
            if (xp > 0) {
                userUpdate.points = admin.firestore.FieldValue.increment(xp);
                userUpdate.weeklyXP = admin.firestore.FieldValue.increment(xp);
                userUpdate.monthlyXP = admin.firestore.FieldValue.increment(xp);
            }
            if ((reward.ticketCount || 0) > 0 && !rewardBlocked(user, ledger)) {
                userUpdate.orangeTickets = admin.firestore.FieldValue.increment(reward.ticketCount);
            }
        }

        // Sender reads stay before every write in this transaction.
        let sharePlan = null;
        let senderRef = null;
        let senderDailyRef = null;
        let shareSenderName = 'a Bitcoiner';
        const shareSender = senderFromKey(key);
        const shareRef = db.collection('cipher_shares').doc(cipherId);
        if (shareSender) {
            senderRef = db.collection('users').doc(shareSender);
            const senderLedgerRef = db.collection('faucet_ledger').doc(shareSender);
            senderDailyRef = senderRef.collection('daily_points').doc(cipherDay);
            const shareSnap = await t.get(shareRef);
            const senderSnap = await t.get(senderRef);
            shareSenderName = safeName(senderSnap.exists ? (senderSnap.data() || {}).username : '');
            const senderLedgerSnap = await t.get(senderLedgerRef);
            const senderDailySnap = await t.get(senderDailyRef);
            sharePlan = planCipherShare({
                cipherId: cipherId,
                cipherLabel: cipher.label,
                openerUid: uid,
                openerUsername: safeName(user.username),
                opener: Object.assign({ uid: uid }, user),
                openerLedger: ledger,
                sender: senderSnap.exists ? senderSnap.data() : null,
                senderLedger: senderLedgerSnap.exists ? senderLedgerSnap.data() : null,
                key: key,
                reward: sharedPrize,
                marker: shareSnap.exists ? (shareSnap.data() || null) : null,
                nowMs: Date.now(),
                today: today,
                senderDailyXpUsed: senderDailySnap.exists ? (Number((senderDailySnap.data() || {}).total) || 0) : 0,
            });
            if (!sharePlan.pay) {
                console.warn('[decryptCipher] cipher share skipped ' + sharePlan.reason + ' cipher=' + cipherId);
            }
        }

        if (reward.rewardType === 'sats') {
            t.set(db.collection('cipher_wins').doc(winId), {
                uid: uid,
                username: safeName(user.username),
                amount: reward.satsAmount,
                cipherId: cipherId,
                cipherLabel: cipher.label,
                keyId: keyId,
                keySentBy: peerKey ? (key.sentBy || null) : null,
                keySentByName: peerKey ? (key.sentByName || null) : null,
                keyOrigin: peerKey ? 'peer' : 'own',
                roll: reward.roll,
                status: satsStatus,
                announced: false,
                createdAt: now,
                paidAt: null,
                paidBy: null,
            });
        } else if (openerDailyTotal != null) {
            t.set(dailyRef, {
                total: openerDailyTotal,
                lastUpdated: now,
            }, { merge: true });
        }

        if (sharePlan && sharePlan.pay && senderRef) {
            const credit = sharePlan.credit;
            const senderUpdate = {
                ciphersDecryptedToday: credit.opensToday,
                ciphersDecryptedDate: today,
            };
            if (credit.fullRing) senderUpdate.cipherFullRing = true;
            if (credit.xp > 0) {
                senderUpdate.points = admin.firestore.FieldValue.increment(credit.xp);
                senderUpdate.weeklyXP = admin.firestore.FieldValue.increment(credit.xp);
                senderUpdate.monthlyXP = admin.firestore.FieldValue.increment(credit.xp);
                t.set(senderDailyRef, {
                    total: credit.dailyXp,
                    lastUpdated: now,
                }, { merge: true });
            }
            if (credit.tickets > 0) {
                senderUpdate.orangeTickets = admin.firestore.FieldValue.increment(credit.tickets);
            }
            t.update(senderRef, senderUpdate);
            if (credit.sats > 0) {
                const shareWinRef = db.collection('cipher_wins').doc();
                t.set(shareWinRef, {
                    uid: shareSender,
                    username: shareSenderName,
                    amount: credit.sats,
                    cipherId: cipherId,
                    cipherLabel: cipher.label,
                    keyId: keyId,
                    keySentBy: shareSender,
                    keySentByName: null,
                    keyOrigin: 'share',
                    openerUid: uid,
                    shareId: cipherId,
                    roll: reward.roll,
                    status: credit.satsStatus,
                    announced: false,
                    createdAt: now,
                    paidAt: null,
                    paidBy: null,
                });
            }
            t.set(shareRef, {
                paid: true,
                senderUid: shareSender,
                openerUid: uid,
                cipherId: cipherId,
                cipherLabel: cipher.label || '',
                prizeRewardType: sharePlan.prize.rewardType,
                prizeXp: sharePlan.prize.xpAmount,
                prizeTickets: sharePlan.prize.ticketCount,
                prizeSats: sharePlan.prize.satsAmount,
                xp: credit.xp,
                tickets: credit.tickets,
                sats: credit.sats,
                roll: reward.roll,
                revealed: false,
                createdAt: now,
            });
            if (sharePlan.notice && sharePlan.noticeId) {
                t.set(db.collection('notifications').doc(sharePlan.noticeId), Object.assign({}, sharePlan.notice, {
                    createdAt: now,
                }));
            }
        }

        t.update(cipherRef, { status: 'opened', openedAt: now, openedBy: uid });
        t.update(keyRef, { status: 'consumed', consumedAt: now });
        t.update(userRef, userUpdate);

        cipherPointsBefore = user.points || 0;
        applied = {
            reward: Object.assign({}, reward, { winId: winId, satsStatus: satsStatus }),
            keySentBy: peerKey ? (key.sentBy || null) : null,
            sendPairId: peerKey ? (key.sendPairId || '') : '',
            opensToday: decToday + 1,
            fullRing: decToday + 1 >= CIPHER_OPENS_PER_DAY,
            username: safeName(user.username),
            share: sharePlan && sharePlan.pay ? {
                senderUid: shareSender,
                fullRing: sharePlan.credit.fullRing,
            } : null,
        };
    });

    if (applied && applied.keySentBy && applied.keySentBy !== uid) {
        try {
            await require('./badgeCredit').creditPeerKeyUse(db, admin, {
                openerUid: uid,
                senderUid: applied.keySentBy,
                pairId: applied.sendPairId,
                keyId: keyId,
                opensToday: applied.opensToday,
            });
        } catch (e) { console.warn('[decryptCipher] peer key credit', e.message); }
        try {
            const level = await updatePeerLevelAfterGift(applied.keySentBy, uid);
            await require('./badgeCredit').creditPeerLevel(db, admin, applied.keySentBy, uid, level);
        } catch (e) { console.warn('[decryptCipher] peerLevel failed:', e.message); }
    }

    if (applied && applied.reward) {
        const r = applied.reward;
        const spec = {
            uid: uid,
            sourceLabel: 'opening a cipher',
            icon: '🔓',
            pointsBefore: cipherPointsBefore,
            pointsDelta: 0,
        };
        if (r.rewardType === 'sats') {
            spec.icon = '⚡';
            spec.message = '+' + Number(r.satsAmount || 0).toLocaleString('en-US') + ' sats from a cipher (' + (r.satsStatus === 'claimable' ? 'ready to claim' : 'pending review') + ')';
        } else if (r.rewardType === 'nacho_shoutout') {
            spec.message = '🎁 Nacho shoutout from opening a cipher';
            spec.icon = '🎁';
        } else {
            spec.xp = r.xpAmount || 50;
            spec.pointsDelta = spec.xp;
            spec.tickets = r.ticketCount || 0;
        }
        await rewardNotify.safeCommit(db, rewardStamp(), rewardNotify.plan(spec));
        // Cipher odds do not roll a shoutout today (sats, or XP and tickets).
        // If a cipher prize is ever a shoutout, it posts the same way a gift does.
        if (r.rewardType === 'nacho_shoutout') {
            try {
                await maybeAnnounceShoutout({ uid: uid, prizeId: 'cipher_' + cipherId, markerRef: cipherRef });
            } catch (e) { console.warn('[decryptCipher] nacho shoutout failed:', e.message); }
        }
    }

    try {
        const { grantFamily, familyFor } = require('./grantBadge');
        await grantFamily(db, admin, uid, familyFor('ciphersSolved'));
        if (applied && applied.fullRing) await grantFamily(db, admin, uid, ['cipher_full_ring']);
        if (applied && applied.share && applied.share.fullRing && applied.share.senderUid) {
            await grantFamily(db, admin, applied.share.senderUid, ['cipher_full_ring']);
        }
    } catch (cipherBadgeErr) {
        console.warn('[decryptCipher] badges', cipherBadgeErr && cipherBadgeErr.message);
    }
    const pub = publicReward(applied.reward);
    pub.opensToday = applied.opensToday;
    pub.opensMax = CIPHER_OPENS_PER_DAY;
    return { success: true, reward: pub };
});

// ─── Lightning prize payment (NWC, same wallet as claimSats) ─────────────────

function _isPrivateHost(host) {
    const h = String(host || '').split(':')[0].toLowerCase();
    return (
        !h || h.length < 3 || h.indexOf('.') === -1 ||
        h === 'localhost' ||
        /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) ||
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(h) || /^169\.254\./.test(h) ||
        /^::1$/.test(h) || /^fd[0-9a-f]{2}:/i.test(h) || /^\d+\.\d+\.\d+\.\d+$/.test(h)
    );
}

async function _assertPublicHost(hostname) {
    const host = String(hostname || '').split(':')[0].toLowerCase();
    if (_isPrivateHost(host)) throw new Error('Invalid Lightning Address domain.');
    let addresses = [];
    try { addresses = await dns.resolve4(host); } catch (e) { throw new Error('DNS resolution failed'); }
    try { addresses = addresses.concat(await dns.resolve6(host)); } catch (_) { /* no AAAA */ }
    addresses.forEach(function(addr) {
        const a = String(addr).toLowerCase();
        if (
            a === '127.0.0.1' || a === '::1' ||
            /^127\./.test(a) || /^10\./.test(a) || /^192\.168\./.test(a) ||
            /^172\.(1[6-9]|2[0-9]|3[01])\./.test(a) || /^169\.254\./.test(a) ||
            /^fd[0-9a-f]{2}:/i.test(a) || /^fe80:/i.test(a) || /^0\./.test(a)
        ) throw new Error('Lightning Address domain is not allowed.');
    });
}

async function _resolvePrizeInvoice(invoice, lightningAddress, amount) {
    let bolt = (invoice || '').trim();
    const lnAddr = (lightningAddress || '').trim();
    if (lnAddr && !bolt) {
        if (lnAddr.indexOf('@') === -1 || lnAddr.length < 5 || lnAddr.length > 320) {
            throw new Error('Invalid Lightning Address.');
        }
        const parts = lnAddr.split('@');
        const domain = (parts[1] || '').split(':')[0];
        try {
            const resolved = await resolveLnurlInvoice({ address: lnAddr, msats: amount * 1000, bolt11: bolt11 });
            bolt = resolved.pr;
        } catch (e) {
            console.error('[GIFT] Lightning Address resolution failed domain=' + domain);
            const clear = e && (e.code === 'lnurl_error' || e.code === 'below_min' || e.code === 'above_max' || e.code === 'amount_mismatch' || e.code === 'wrong_network');
            throw new Error(clear && e.message ? e.message : 'Could not look up that Lightning Address.');
        }
    }
    if (!bolt || bolt.toLowerCase().indexOf('lnbc') !== 0 || bolt.length < 50 || bolt.length > 2000) {
        throw new Error('Paste a Lightning invoice that starts with lnbc, or a Lightning Address.');
    }
    let decoded;
    try { decoded = bolt11.decode(bolt); } catch (_) { throw new Error('That invoice could not be read.'); }
    const decodedAmt = Math.floor((decoded.millisatoshis || 0) / 1000);
    if (decodedAmt !== amount) throw new Error('Invoice must be for exactly ' + amount + ' sats.');
    if (decoded.timeExpireDate && decoded.timeExpireDate < Math.floor(Date.now() / 1000)) {
        throw new Error('That invoice has expired. Make a new one.');
    }
    return bolt;
}

const claimCipherWin = functionsV1.runWith({ timeoutSeconds: 180 }).https.onCall(async (data, context) => {
    const secondFactor = require('./secondFactor');
    await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
    const uid = requireUser(context);
    const winId = (data.winId || '').toString().trim();
    if (!winId || winId.length > 128) throw httpsError('invalid-argument', 'Invalid win');
    if (!NWC_URL) throw httpsError('failed-precondition', 'Prize wallet is not configured yet. Phil can pay this from the admin list.');

    const winRef = db.collection('cipher_wins').doc(winId);
    const userRef = db.collection('users').doc(uid);
    const ledgerRef = db.collection('faucet_ledger').doc(uid);
    let amount = 0;
    let username = 'a Bitcoiner';

    // Auth lookup stays outside the transaction (retries would repeat it).
    // The decision itself runs inside the transaction, with the user and ledger docs.
    let ageDays = 0;
    let ageKnown = false;
    try {
        const userRecord = await admin.auth().getUser(uid);
        const created = new Date(userRecord.metadata.creationTime).getTime();
        if (Number.isFinite(created)) {
            ageDays = Math.floor((Date.now() - created) / 86400000);
            ageKnown = true;
        }
    } catch (e) {
        console.error('[claimCipherWin] Could not verify account age:', e.message);
    }

    await db.runTransaction(async (t) => {
        const winDoc = await t.get(winRef);
        const userDoc = await t.get(userRef);
        const ledgerDoc = await t.get(ledgerRef);
        if (!winDoc.exists) throw httpsError('not-found', 'Win not found');
        const win = winDoc.data();
        if (win.uid !== uid) throw httpsError('permission-denied', 'Not your prize');
        if (win.status === 'paid') throw httpsError('already-exists', 'Already paid');
        if (win.status === 'paying') throw httpsError('failed-precondition', 'A payment is already in progress. Wait a minute and try again.');
        if (win.status === 'unknown') throw httpsError('failed-precondition', 'This payment needs Phil to confirm it before it can be claimed again.');
        if (win.status !== 'claimable') throw httpsError('failed-precondition', 'This prize is waiting for Phil to pay it.');
        if (win.amount >= 1000 || (win.amount !== 100 && win.amount !== 500)) {
            throw httpsError('failed-precondition', 'This prize is paid manually.');
        }
        const gate = assessCipherClaim({
            email: context.auth.token.email || '',
            emailVerified: context.auth.token.email_verified === true,
            ageKnown: ageKnown,
            ageDays: ageDays,
            satsDisabled: userDoc.exists && userDoc.data().satsDisabled === true,
            ledgerBanned: ledgerDoc.exists && ledgerDoc.data().banned === true,
        });
        if (!gate.ok) throw httpsError('failed-precondition', gate.error);
        amount = win.amount;
        username = win.username || username;
        t.update(winRef, {
            status: 'paying',
            payingAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    let invoice;
    try {
        invoice = await _resolvePrizeInvoice(data.invoice, data.lightningAddress, amount);
    } catch (e) {
        await winRef.update({ status: 'claimable', payingAt: admin.firestore.FieldValue.delete() }).catch(function() {});
        return { success: false, error: e.message || 'Could not pay that invoice.' };
    }

    const invoiceHash = crypto.createHash('sha256').update(invoice).digest('hex').slice(0, 32);
    const invoiceRef = db.collection('faucet_invoices').doc('cipher_' + invoiceHash);
    try {
        await db.runTransaction(async (t) => {
            const existing = await t.get(invoiceRef);
            if (existing.exists) throw new Error('That invoice was already used. Make a new one.');
            t.set(invoiceRef, { uid: uid, winId: winId, amount: amount, status: 'pending', ts: admin.firestore.FieldValue.serverTimestamp() });
        });
    } catch (e) {
        await winRef.update({ status: 'claimable', payingAt: admin.firestore.FieldValue.delete() }).catch(function() {});
        return { success: false, error: e.message || 'Could not reserve that invoice.' };
    }

    async function releaseUnpaid() {
        await winRef.update({ status: 'claimable', payingAt: admin.firestore.FieldValue.delete() }).catch(function() {});
        await invoiceRef.delete().catch(function() {});
    }

    async function holdUnknown(paymentHash) {
        await winRef.update({
            status: 'unknown',
            needsReview: true,
            invoiceHash: invoiceHash,
            paymentHash: paymentHash || '',
            payingAt: admin.firestore.FieldValue.delete(),
        });
        await invoiceRef.set({
            uid: uid,
            winId: winId,
            amount: amount,
            status: 'unknown',
            ts: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }

    async function markPaid(preimage) {
        // Payment already left the wallet. Never flip the win back to claimable after this.
        try {
            await winRef.update({
                status: 'paid',
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
                paidBy: 'faucet',
                preimage: preimage || '',
                invoiceHash: invoiceHash,
                announced: false,
                payingAt: admin.firestore.FieldValue.delete(),
            });
            await invoiceRef.set({ uid: uid, winId: winId, amount: amount, status: 'used', ts: admin.firestore.FieldValue.serverTimestamp() });
        } catch (e) {
            console.error('[claimCipherWin] paid but record update failed:', e.message);
            await rewardNotify.safeCommit(db, rewardStamp(), rewardNotify.plan({
                uid: uid,
                sats: amount,
                sourceLabel: 'a cipher win',
                icon: '⚡',
            }));
            return { success: true, amount: amount, warning: 'Paid, but the receipt did not save. Phil can confirm it in the admin list.' };
        }
        await rewardNotify.safeCommit(db, rewardStamp(), rewardNotify.plan({
            uid: uid,
            sats: amount,
            sourceLabel: 'a cipher win',
            icon: '⚡',
        }));
        try {
            await require('./badgeCredit').creditCipherPaid(db, admin, uid, amount, winRef);
        } catch (e) { console.warn('[claimCipherWin] badge', e.message); }

        try {
            await postNacho(nachoSatsText(username, amount), uid);
            await winRef.update({ announced: true });
        } catch (e) { console.warn('[claimCipherWin] nacho failed:', e.message); }

        return { success: true, amount: amount };
    }

    const nwc = new NWCClient({ nostrWalletConnectUrl: NWC_URL });
    let phase = 'balance';
    let payResult = null;
    let payError = null;
    try {
        const balanceResult = await withTimeout(nwc.getBalance(), 20000, 'getBalance');
        const walletSats = Math.floor((balanceResult.balance || 0) / 1000);
        if (walletSats < WALLET_FLOOR_SATS) throw new Error('WALLET_LOW');
        phase = 'pay';
        payResult = await withTimeout(nwc.payInvoice({ invoice: invoice }), 30000, 'payInvoice');
        if (!payResult || !payResult.preimage) throw new Error('NO_PREIMAGE');
    } catch (e) {
        payError = e;
    }

    if (payResult && payResult.preimage) return markPaid(payResult.preimage);

    // Balance-check failures never reached the wallet. Explicit refusals
    // (PAYMENT_FAILED, INSUFFICIENT_BALANCE, QUOTA_EXCEEDED, RATE_LIMITED)
    // prove nothing was sent. Anything else is looked up below.
    if (!shouldLookupPay({ phase: phase, error: payError, payResult: payResult })) {
        console.error('[claimCipherWin] pay refused before send:', payError && payError.message);
        await releaseUnpaid();
        if (payError && payError.message === 'WALLET_LOW') {
            return { success: false, error: 'The prize wallet is being refilled. Try again later, or Phil can mark it paid.' };
        }
        const timedOut = payError && payError.message && payError.message.indexOf('[TIMEOUT]') === 0;
        return { success: false, error: timedOut ? 'The wallet did not answer in time. Your prize is still waiting — try again.' : 'Payment failed. Your prize is still waiting.' };
    }

    // Timeout or no receipt: the payment may still have settled. Confirm before unlocking the prize.
    let lookupReq = null;
    try { lookupReq = lookupRequestFromDecoded(bolt11.decode(invoice)); }
    catch (e) { lookupReq = null; }

    const holdMessage = 'The payment is not confirmed yet. This prize is on hold so it cannot be paid twice. Phil will confirm it.';
    if (!lookupReq) {
        console.error('[claimCipherWin] ambiguous pay but the invoice has no payment hash');
        try { await holdUnknown(''); }
        catch (e) { console.error('[claimCipherWin] could not hold win:', e.message); }
        return { success: false, error: holdMessage };
    }

    console.error('[claimCipherWin] pay not confirmed (' + (payError && payError.message) + '). Looking up ' + lookupReq.payment_hash);
    const settlement = await lookupSettlement({
        lookup: function() {
            return withTimeout(nwc.lookupInvoice(lookupReq), 10000, 'lookupInvoice');
        },
        sleep: function(ms) {
            return new Promise(function(resolve) { setTimeout(resolve, ms); });
        },
    });

    if (settlement.action === 'paid') return markPaid(settlement.preimage || '');
    if (settlement.action === 'release') {
        await releaseUnpaid();
        return { success: false, error: 'Payment failed. Your prize is still waiting.' };
    }

    try { await holdUnknown(lookupReq.payment_hash); }
    catch (e) { console.error('[claimCipherWin] could not hold win:', e.message); }
    return { success: false, error: holdMessage };
});

function winForUser(id, data) {
    return {
        id: id,
        amount: data.amount || 0,
        status: data.status || 'pending',
        cipherLabel: data.cipherLabel || '',
        keySentByName: data.keySentByName || '',
        createdAt: data.createdAt && data.createdAt.toMillis ? data.createdAt.toMillis() : null,
    };
}

const listMyCipherWins = functionsV1.https.onCall(async (data, context) => {
    const uid = requireUser(context);
    const snap = await db.collection('cipher_wins').where('uid', '==', uid).orderBy('createdAt', 'desc').limit(30).get();
    return { wins: snap.docs.map(function(d) { return winForUser(d.id, d.data()); }) };
});

function requireAdmin(context) {
    requireUser(context);
    if (!context.auth.token || context.auth.token.admin !== true) {
        throw httpsError('permission-denied', 'Admin only');
    }
}

async function readAllDocs(refs) {
    const snaps = [];
    for (let i = 0; i < refs.length; i += 50) {
        const chunk = refs.slice(i, i + 50);
        const part = await db.getAll.apply(db, chunk);
        snaps.push.apply(snaps, part);
    }
    return snaps;
}

const adminListCipherWins = functionsV1.https.onCall(async (data, context) => {
    requireAdmin(context);
    const snap = await db.collection('cipher_wins').orderBy('createdAt', 'desc').limit(100).get();
    const wins = snap.docs.map(function(d) {
        const w = d.data();
        return {
            id: d.id,
            uid: w.uid,
            username: w.username || '',
            amount: w.amount || 0,
            status: w.status || '',
            cipherId: w.cipherId || '',
            cipherLabel: w.cipherLabel || '',
            keyId: w.keyId || '',
            keySentBy: w.keySentBy || '',
            keySentByName: w.keySentByName || '',
            keyOrigin: w.keyOrigin || '',
            roll: w.roll,
            announced: w.announced === true,
            invoiceHash: w.invoiceHash || '',
            paymentHash: w.paymentHash || '',
            createdAt: w.createdAt && w.createdAt.toMillis ? w.createdAt.toMillis() : null,
            paidAt: w.paidAt && w.paidAt.toMillis ? w.paidAt.toMillis() : null,
        };
    });

    const seen = {};
    const uids = [];
    wins.forEach(function(w) {
        if (w.uid && !seen[w.uid]) {
            seen[w.uid] = true;
            uids.push(w.uid);
        }
    });
    const userSnaps = uids.length ? await readAllDocs(uids.map(function(id) { return db.collection('users').doc(id); })) : [];
    const ledgerSnaps = uids.length ? await readAllDocs(uids.map(function(id) { return db.collection('faucet_ledger').doc(id); })) : [];
    const users = {};
    const ledgers = {};
    userSnaps.forEach(function(s) { users[s.id] = s.exists ? s.data() : null; });
    ledgerSnaps.forEach(function(s) { ledgers[s.id] = s.exists ? s.data() : null; });
    wins.forEach(function(w) {
        const flags = adminClaimFlag(w, users[w.uid], ledgers[w.uid]);
        w.claimBlocked = flags.claimBlocked;
        w.claimBlockReason = flags.claimBlockReason;
        w.flagForAdmin = flags.flagForAdmin;
    });
    return { wins: wins };
});

const adminMarkCipherWinPaid = functionsV1.https.onCall(async (data, context) => {
    requireAdmin(context);
    const winId = (data.winId || '').toString().trim();
    if (!winId || winId.length > 128) throw httpsError('invalid-argument', 'Invalid win');
    const winRef = db.collection('cipher_wins').doc(winId);
    let username = 'a Bitcoiner';
    let winnerUid = '';
    let amount = 0;
    let shouldAnnounce = false;
    let newlyPaid = false;

    await db.runTransaction(async (t) => {
        const winDoc = await t.get(winRef);
        if (!winDoc.exists) throw httpsError('not-found', 'Win not found');
        const win = winDoc.data();
        username = win.username || username;
        winnerUid = win.uid || '';
        amount = win.amount || 0;
        if (win.status === 'paid' && win.announced === true) {
            throw httpsError('already-exists', 'Already marked paid');
        }
        if (win.status === 'paid' && win.announced !== true) {
            shouldAnnounce = true;
            t.update(winRef, { announced: true });
            return;
        }
        if (win.status !== 'pending' && win.status !== 'claimable' && win.status !== 'paying' && win.status !== 'unknown') {
            throw httpsError('failed-precondition', 'This win cannot be marked paid');
        }
        shouldAnnounce = true;
        newlyPaid = true;
        t.update(winRef, {
            status: 'paid',
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            paidBy: context.auth.uid,
            announced: true,
            payingAt: admin.firestore.FieldValue.delete(),
        });
    });

    if (newlyPaid && winnerUid) {
        try { await require('./badgeCredit').creditCipherPaid(db, admin, winnerUid, amount, winRef); }
        catch (e) { console.warn('[adminMarkCipherWinPaid] badge', e.message); }
    }
    if (shouldAnnounce) {
        try { await postNacho(nachoSatsText(username, amount), winnerUid); }
        catch (e) {
            console.warn('[adminMarkCipherWinPaid] nacho failed:', e.message);
            await winRef.update({ announced: false }).catch(function() {});
            return { success: true, announced: false };
        }
    }
    return { success: true, announced: true };
});

// The sender marks a cipher-share reveal as seen. The flag is server-written,
// so the popup shows at most once per share. This does not pay anything.
const ackCipherShare = functionsV1.https.onCall(async (data, context) => {
    const uid = requireUser(context);
    const shareId = (data.shareId || '').toString().trim();
    if (!shareId || shareId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(shareId)) {
        throw httpsError('invalid-argument', 'Invalid share');
    }
    const shareRef = db.collection('cipher_shares').doc(shareId);
    const noteRef = db.collection('notifications').doc('cshare_' + shareId);
    await db.runTransaction(async (t) => {
        const shareSnap = await t.get(shareRef);
        const noteSnap = await t.get(noteRef);
        if (!shareSnap.exists) throw httpsError('not-found', 'Share not found');
        const row = shareSnap.data() || {};
        if (row.senderUid !== uid) throw httpsError('permission-denied', 'Not your share');
        if (row.revealed === true) return;
        const stamp = admin.firestore.FieldValue.serverTimestamp();
        t.set(shareRef, { revealed: true, revealedAt: stamp }, { merge: true });
        if (noteSnap.exists && (noteSnap.data() || {}).recipientId === uid) {
            t.set(noteRef, { revealed: true }, { merge: true });
        }
    });
    return { ok: true };
});

module.exports = {
    awardDailyGifts: awardDailyGifts,
    openGift: openGift,
    sendKeys: sendKeys,
    decryptCipher: decryptCipher,
    ackCipherShare: ackCipherShare,
    claimCipherWin: claimCipherWin,
    listMyCipherWins: listMyCipherWins,
    adminListCipherWins: adminListCipherWins,
    adminMarkCipherWinPaid: adminMarkCipherWinPaid,
};
