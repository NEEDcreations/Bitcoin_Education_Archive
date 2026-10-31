'use strict';

// Server-only badge counter writes. Each function re-reads inside a
// transaction and then asks awardBadge, which is the only Favor path.

const progress = require('./badgeProgress');
const { applyDailyXp } = require('./applyDailyXp');
const { offsetDateKey } = require('./offsetDay');

function grantApi() {
    return require('./grantBadge');
}

function rulesApi() {
    return require('./badgeRules');
}

async function grantIds(db, adminSdk, uid, ids) {
    if (!uid || !ids || !ids.length) return [];
    const api = grantApi();
    const unique = [];
    ids.forEach(function (id) {
        if (id && unique.indexOf(id) === -1) unique.push(id);
    });
    const granted = await api.grantFamily(db, adminSdk, uid, unique);
    const sets = [];
    const table = rulesApi().SETS || {};
    Object.keys(table).forEach(function (setId) {
        const members = table[setId] || [];
        if (unique.some(function (id) { return members.indexOf(id) !== -1; })) sets.push(setId);
    });
    if (sets.length) await api.grantFamily(db, adminSdk, uid, sets);
    return granted;
}

function dailyTotal(grant, awarded) {
    if (grant && grant.dailyXp != null) return grant.dailyXp;
    return (Number(grant && grant.dailyUsed) || 0) + awarded;
}

function xpFields(adminSdk, awarded) {
    if (!(awarded > 0)) return {};
    return {
        points: adminSdk.firestore.FieldValue.increment(awarded),
        weeklyXP: adminSdk.firestore.FieldValue.increment(awarded),
        monthlyXP: adminSdk.firestore.FieldValue.increment(awarded),
    };
}

function xpLedgerRef(userRef, rawId) {
    const id = String(rawId || 'grant').replace(/[^\w.-]/g, '_').slice(0, 700);
    return userRef.collection('xp_ledger').doc(id);
}

function xpLedgerData(fields) {
    const src = fields || {};
    const awarded = Math.max(0, Math.floor(Number(src.awarded) || 0));
    return {
        source: src.source,
        amount: awarded,
        requested: Math.max(0, Math.floor(Number(src.requested) || 0)),
        awarded: awarded,
        base: src.base != null ? Math.max(0, Math.floor(Number(src.base) || 0)) : Math.max(0, Math.floor(Number(src.requested) || 0)),
        boosted: src.boosted != null ? Math.max(0, Math.floor(Number(src.boosted) || 0)) : awarded,
        doubled: src.doubled === true,
        day: src.day || '',
        createdAtMs: Number(src.nowMs) || Date.now(),
        uid: src.uid || '',
        keyId: src.keyId || '',
        pairId: src.pairId || '',
        openerUid: src.openerUid || '',
    };
}

async function creditPeerKeyUse(db, adminSdk, args) {
    const src = args || {};
    const openerUid = String(src.openerUid || '');
    const senderUid = String(src.senderUid || '');
    const pairId = String(src.pairId || '');
    const nowMs = Number(src.nowMs) || Date.now();
    const day = src.day || offsetDateKey(nowMs);
    if (!openerUid || !senderUid || openerUid === senderUid) return progress.planPeerKeyCredit({});
    const openerRef = db.collection('users').doc(openerUid);
    const senderRef = db.collection('users').doc(senderUid);
    const openerLedgerRef = db.collection('faucet_ledger').doc(openerUid);
    const senderLedgerRef = db.collection('faucet_ledger').doc(senderUid);
    const keyId = String(src.keyId || '');
    const distinctRef = db.collection('key_gift_credits').doc(senderUid + '_' + openerUid);
    const dayRef = db.collection('peer_key_days').doc(openerUid + '_' + senderUid + '_' + day);
    const pairRef = pairId ? db.collection('key_send_pairs').doc(pairId) : null;
    const keyUseRef = keyId ? db.collection('key_use_credits').doc(keyId) : null;

    const applied = await db.runTransaction(async function (tx) {
        const openerSnap = await tx.get(openerRef);
        const senderSnap = await tx.get(senderRef);
        const openerLedgerSnap = await tx.get(openerLedgerRef);
        const senderLedgerSnap = await tx.get(senderLedgerRef);
        const distinctSnap = await tx.get(distinctRef);
        const daySnap = await tx.get(dayRef);
        const pairSnap = pairRef ? await tx.get(pairRef) : null;
        const keyUseSnap = keyUseRef ? await tx.get(keyUseRef) : null;
        if (!openerSnap.exists || !senderSnap.exists) return progress.planPeerKeyCredit({});
        const opener = Object.assign({ uid: openerUid }, openerSnap.data() || {});
        const sender = Object.assign({ uid: senderUid }, senderSnap.data() || {});
        const plan = progress.planPeerKeyCredit({
            opener: opener,
            sender: sender,
            openerLedger: openerLedgerSnap.exists ? openerLedgerSnap.data() : {},
            senderLedger: senderLedgerSnap.exists ? senderLedgerSnap.data() : {},
            peerKey: true,
            pairCredited: !!((pairSnap && pairSnap.exists && (pairSnap.data() || {}).credited === true) || (keyUseSnap && keyUseSnap.exists)),
            distinctCredited: !!(distinctSnap && distinctSnap.exists),
            openerCountedSender: !!(daySnap && daySnap.exists),
            opensToday: Number(src.opensToday) || 0,
            nowMs: nowMs,
            day: day,
        });
        let xpGrant = null;
        if (plan.senderXp > 0) {
            xpGrant = await applyDailyXp(senderUid, plan.senderXp, tx, { day: day, userRef: senderRef, user: sender, now: nowMs });
        }
        const openerUpdate = {};
        const senderUpdate = {};
        const stamp = adminSdk.firestore.FieldValue.serverTimestamp();
        if (plan.openerCipher) {
            openerUpdate.peerKeyCiphers = adminSdk.firestore.FieldValue.increment(1);
            tx.set(dayRef, { openerUid: openerUid, senderUid: senderUid, day: day, at: stamp });
        }
        if (plan.fullRing) openerUpdate.cipherFullRing = true;
        if (plan.distinct) {
            senderUpdate.keyPeersDistinct = adminSdk.firestore.FieldValue.increment(1);
            tx.set(distinctRef, { senderUid: senderUid, recipientUid: openerUid, at: stamp });
        }
        if (plan.giftsSent) {
            senderUpdate.giftsSent = adminSdk.firestore.FieldValue.increment(1);
            if (pairRef) tx.set(pairRef, { credited: true }, { merge: true });
            if (keyUseRef) tx.set(keyUseRef, { senderUid: senderUid, openerUid: openerUid, at: stamp });
        }
        const senderXp = xpGrant ? xpGrant.awarded : 0;
        if (senderXp > 0) {
            Object.assign(senderUpdate, xpFields(adminSdk, senderXp));
            if (xpGrant.dailyRef) {
                tx.set(xpGrant.dailyRef, {
                    total: dailyTotal(xpGrant, senderXp),
                    lastUpdated: stamp,
                }, { merge: true });
            }
        }
        if (plan.senderXp > 0) {
            const prev = sender.keyGiftXpDay === day ? (Number(sender.keyGiftXpCount) || 0) : 0;
            senderUpdate.keyGiftXpDay = day;
            senderUpdate.keyGiftXpCount = prev + 1;
            const ledgerId = keyId
                ? ('pk_' + keyId)
                : ('pk_' + senderUid + '_' + openerUid + '_' + (pairId || day));
            tx.set(xpLedgerRef(senderRef, ledgerId), xpLedgerData({
                source: 'peer_key_use',
                uid: senderUid,
                requested: plan.senderXp,
                awarded: senderXp,
                base: xpGrant ? xpGrant.base : plan.senderXp,
                boosted: xpGrant ? xpGrant.boosted : senderXp,
                doubled: !!(xpGrant && xpGrant.doubled),
                day: day,
                nowMs: nowMs,
                keyId: keyId,
                pairId: pairId,
                openerUid: openerUid,
            }));
        }
        if (Object.keys(openerUpdate).length) tx.update(openerRef, openerUpdate);
        if (Object.keys(senderUpdate).length) tx.update(senderRef, senderUpdate);
        plan.senderXpAwarded = senderXp;
        return plan;
    });

    if (applied.openerCipher) await grantIds(db, adminSdk, openerUid, grantApi().familyFor('peerKeyCiphers'));
    if (applied.fullRing) await grantIds(db, adminSdk, openerUid, ['cipher_full_ring']);
    const senderIds = [];
    if (applied.giftsSent) senderIds.push.apply(senderIds, grantApi().familyFor('giftsSent'));
    if (applied.distinct) senderIds.push.apply(senderIds, grantApi().familyFor('keyPeersDistinct'));
    if (senderIds.length) await grantIds(db, adminSdk, senderUid, senderIds);
    return applied;
}

async function creditPeerLevel(db, adminSdk, senderUid, recipientUid, levelResult, nowMs) {
    const result = levelResult || {};
    const level = result.newLevel && result.newLevel.level ? result.newLevel.level : 0;
    const stored = Number(result.storedLevel) || 1;
    if (!senderUid || !recipientUid || !level) return { credit: false };
    const now = Number(nowMs) || Date.now();
    const senderRef = db.collection('users').doc(senderUid);
    const recipRef = db.collection('users').doc(recipientUid);
    const applied = await db.runTransaction(async function (tx) {
        const senderSnap = await tx.get(senderRef);
        const recipSnap = await tx.get(recipRef);
        const senderLedger = await tx.get(db.collection('faucet_ledger').doc(senderUid));
        const recipLedger = await tx.get(db.collection('faucet_ledger').doc(recipientUid));
        if (!senderSnap.exists || !recipSnap.exists) return { credit: false };
        const sender = Object.assign({ uid: senderUid }, senderSnap.data() || {});
        const recip = Object.assign({ uid: recipientUid }, recipSnap.data() || {});
        const eligible = progress.pairEligible(
            sender,
            senderLedger.exists ? senderLedger.data() : {},
            recip,
            recipLedger.exists ? recipLedger.data() : {},
            now
        );
        const plan = progress.planPeerLevel({
            eligible: eligible,
            storedLevel: stored,
            newLevel: level,
            senderBest: Number(sender.peerBestLevel) || 0,
            recipBest: Number(recip.peerBestLevel) || 0,
        });
        if (!plan.credit) return plan;
        const senderUpdate = {};
        const recipUpdate = {};
        if (plan.senderBest > (Number(sender.peerBestLevel) || 0)) senderUpdate.peerBestLevel = plan.senderBest;
        if (plan.recipBest > (Number(recip.peerBestLevel) || 0)) recipUpdate.peerBestLevel = plan.recipBest;
        if (plan.crossedL3) {
            senderUpdate.peersAtL3 = adminSdk.firestore.FieldValue.increment(1);
            recipUpdate.peersAtL3 = adminSdk.firestore.FieldValue.increment(1);
        }
        if (Object.keys(senderUpdate).length) tx.update(senderRef, senderUpdate);
        if (Object.keys(recipUpdate).length) tx.update(recipRef, recipUpdate);
        return plan;
    });
    if (!applied.credit) return applied;
    const ids = grantApi().familyFor('peerBestLevel').concat(grantApi().familyFor('peersAtL3'));
    await grantIds(db, adminSdk, senderUid, ids);
    await grantIds(db, adminSdk, recipientUid, ids);
    return applied;
}

async function creditPeerAcceptXp(db, adminSdk, leftUid, rightUid, nowMs) {
    const now = Number(nowMs) || Date.now();
    const day = offsetDateKey(now);
    const pairId = progress.sortedPairId(leftUid, rightUid);
    const markerRef = db.collection('peer_xp_credits').doc(pairId);
    const leftRef = db.collection('users').doc(leftUid);
    const rightRef = db.collection('users').doc(rightUid);
    const applied = await db.runTransaction(async function (tx) {
        const markerSnap = await tx.get(markerRef);
        const leftSnap = await tx.get(leftRef);
        const rightSnap = await tx.get(rightRef);
        const leftLedger = await tx.get(db.collection('faucet_ledger').doc(leftUid));
        const rightLedger = await tx.get(db.collection('faucet_ledger').doc(rightUid));
        if (!leftSnap.exists || !rightSnap.exists) return { leftXp: 0, rightXp: 0, mark: false };
        const left = Object.assign({ uid: leftUid }, leftSnap.data() || {});
        const right = Object.assign({ uid: rightUid }, rightSnap.data() || {});
        const plan = progress.planPeerAcceptXp({
            marker: markerSnap.exists,
            eligible: progress.pairEligible(
                left,
                leftLedger.exists ? leftLedger.data() : {},
                right,
                rightLedger.exists ? rightLedger.data() : {},
                now
            ),
            left: left,
            right: right,
            leftLedger: leftLedger.exists ? leftLedger.data() : {},
            rightLedger: rightLedger.exists ? rightLedger.data() : {},
            day: day,
        });
        if (!plan.mark) return plan;
        let leftGrant = null;
        let rightGrant = null;
        if (plan.leftXp > 0) leftGrant = await applyDailyXp(leftUid, plan.leftXp, tx, { day: day, userRef: leftRef, user: left, now: now });
        if (plan.rightXp > 0) rightGrant = await applyDailyXp(rightUid, plan.rightXp, tx, { day: day, userRef: rightRef, user: right, now: now });
        const leftAwarded = leftGrant ? leftGrant.awarded : 0;
        const rightAwarded = rightGrant ? rightGrant.awarded : 0;
        const stamp = adminSdk.firestore.FieldValue.serverTimestamp();
        if (leftAwarded > 0 && leftGrant.dailyRef) {
            tx.set(leftGrant.dailyRef, { total: dailyTotal(leftGrant, leftAwarded), lastUpdated: stamp }, { merge: true });
        }
        if (rightAwarded > 0 && rightGrant.dailyRef) {
            tx.set(rightGrant.dailyRef, { total: dailyTotal(rightGrant, rightAwarded), lastUpdated: stamp }, { merge: true });
        }
        const leftUpdate = xpFields(adminSdk, leftAwarded);
        const rightUpdate = xpFields(adminSdk, rightAwarded);
        if (plan.leftXp > 0) {
            const prev = left.peerXpDay === day ? (Number(left.peerXpCount) || 0) : 0;
            leftUpdate.peerXpDay = day;
            leftUpdate.peerXpCount = prev + 1;
        }
        if (plan.rightXp > 0) {
            const prev = right.peerXpDay === day ? (Number(right.peerXpCount) || 0) : 0;
            rightUpdate.peerXpDay = day;
            rightUpdate.peerXpCount = prev + 1;
        }
        if (plan.leftXp > 0) {
            tx.set(xpLedgerRef(leftRef, 'pa_' + pairId + '_' + leftUid), xpLedgerData({
                source: 'peer_accept',
                uid: leftUid,
                requested: plan.leftXp,
                awarded: leftAwarded,
                base: leftGrant ? leftGrant.base : plan.leftXp,
                boosted: leftGrant ? leftGrant.boosted : leftAwarded,
                doubled: !!(leftGrant && leftGrant.doubled),
                day: day,
                nowMs: now,
                pairId: pairId,
            }));
        }
        if (plan.rightXp > 0) {
            tx.set(xpLedgerRef(rightRef, 'pa_' + pairId + '_' + rightUid), xpLedgerData({
                source: 'peer_accept',
                uid: rightUid,
                requested: plan.rightXp,
                awarded: rightAwarded,
                base: rightGrant ? rightGrant.base : plan.rightXp,
                boosted: rightGrant ? rightGrant.boosted : rightAwarded,
                doubled: !!(rightGrant && rightGrant.doubled),
                day: day,
                nowMs: now,
                pairId: pairId,
            }));
        }
        if (Object.keys(leftUpdate).length) tx.update(leftRef, leftUpdate);
        if (Object.keys(rightUpdate).length) tx.update(rightRef, rightUpdate);
        tx.set(markerRef, {
            uid1: leftUid < rightUid ? leftUid : rightUid,
            uid2: leftUid < rightUid ? rightUid : leftUid,
            leftXp: leftAwarded,
            rightXp: rightAwarded,
            day: day,
            at: adminSdk.firestore.FieldValue.serverTimestamp(),
        });
        plan.leftAwarded = leftAwarded;
        plan.rightAwarded = rightAwarded;
        return plan;
    });
    return applied;
}

async function creditCipherPaid(db, adminSdk, uid, amount, winRef) {
    if (!uid || !winRef) return { credit: false };
    const userRef = db.collection('users').doc(uid);
    const applied = await db.runTransaction(async function (tx) {
        const winSnap = await tx.get(winRef);
        const userSnap = await tx.get(userRef);
        const win = winSnap.exists ? (winSnap.data() || {}) : {};
        const user = userSnap.exists ? (userSnap.data() || {}) : {};
        if (win.status !== 'paid') return { credit: false, reason: 'unpaid' };
        const plan = progress.planCipherPaid({
            alreadyCredited: win.badgeCredited === true,
            biggest: user.cipherBiggestWin,
            amount: amount || win.amount,
        });
        if (!plan.credit || !userSnap.exists) return plan;
        tx.update(userRef, {
            cipherSatsPaid: adminSdk.firestore.FieldValue.increment(1),
            cipherBiggestWin: plan.biggest,
        });
        tx.update(winRef, { badgeCredited: true });
        return plan;
    });
    if (applied.credit) {
        await grantIds(db, adminSdk, uid, grantApi().familyFor('cipherSatsPaid').concat(grantApi().familyFor('cipherBiggestWin')));
    }
    return applied;
}

async function creditOneTopic(db, adminSdk, pendingRef, nowMs) {
    const now = Number(nowMs) || Date.now();
    const day = offsetDateKey(now);
    const applied = await db.runTransaction(async function (tx) {
        const pendingSnap = await tx.get(pendingRef);
        if (!pendingSnap.exists) return { credit: false, close: true, reason: 'missing' };
        const pending = pendingSnap.data() || {};
        if (pending.open !== true) return { credit: false, close: true, reason: 'closed' };
        const postRef = db.collection('topic_discussions').doc(pending.channelId).collection('posts').doc(pending.postId);
        const postSnap = await tx.get(postRef);
        const post = postSnap.exists ? Object.assign({}, pending, postSnap.data() || {}) : Object.assign({}, pending, { deleted: true });
        const uid = post.uid || pending.uid;
        const userRef = uid ? db.collection('users').doc(uid) : null;
        const userSnap = userRef ? await tx.get(userRef) : null;
        const ledgerSnap = uid ? await tx.get(db.collection('faucet_ledger').doc(uid)) : null;
        const plan = progress.planTopicCredit({
            post: post,
            user: userSnap && userSnap.exists ? userSnap.data() : {},
            ledger: ledgerSnap && ledgerSnap.exists ? ledgerSnap.data() : {},
            nowMs: now,
            day: day,
        });
        if (!plan.close) return plan;
        if (!plan.credit || !userRef || !userSnap || !userSnap.exists) {
            tx.delete(pendingRef);
            return plan;
        }
        const user = userSnap.data() || {};
        const counted = user.topicCountDay === day ? (Number(user.topicCountToday) || 0) : 0;
        const update = {
            topicComments: adminSdk.firestore.FieldValue.increment(1),
            topicCountDay: day,
            topicCountToday: counted + 1,
        };
        if (plan.channel) {
            update.topicChannelsCommented = adminSdk.firestore.FieldValue.arrayUnion(plan.channel);
            const counts = Object.assign({}, user.topicChannelCounts || {});
            counts[plan.channel] = (Number(counts[plan.channel]) || 0) + 1;
            update.topicChannelCounts = counts;
        }
        tx.update(userRef, update);
        tx.set(postRef, { badgeCounted: true }, { merge: true });
        tx.delete(pendingRef);
        plan.uid = uid;
        plan.xpAwarded = 0;
        return plan;
    });
    if (applied.credit && applied.uid) {
        await grantIds(db, adminSdk, applied.uid, grantApi().familyFor('topicComments').concat(['topic_channels_10']));
    }
    return applied;
}

async function creditMatureTopicComments(db, adminSdk, nowMs, limit) {
    const now = Number(nowMs) || Date.now();
    const matureBefore = now - progress.COMMENT_MATURE_MS;
    const cap = Math.max(1, Math.min(Number(limit) || 200, 400));
    const snap = await db.collection('topic_comment_pending')
        .where('open', '==', true)
        .where('createdAtMs', '<=', matureBefore)
        .orderBy('createdAtMs', 'asc')
        .limit(cap)
        .get();
    let credited = 0;
    const docs = snap.docs || [];
    for (let i = 0; i < docs.length; i++) {
        try {
            const result = await creditOneTopic(db, adminSdk, docs[i].ref, now);
            if (result && result.credit) credited += 1;
        } catch (e) {
            console.warn('[creditMatureTopicComments]', docs[i].id, e && e.message);
        }
    }
    return { scanned: docs.length, credited: credited };
}

async function revokeTopicCredit(db, adminSdk, post) {
    const plan = progress.planTopicRevoke({ post: post });
    if (!plan.revoke || !plan.uid) return plan;
    const userRef = db.collection('users').doc(plan.uid);
    await db.runTransaction(async function (tx) {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) return;
        const user = userSnap.data() || {};
        const next = Math.max(0, (Number(user.topicComments) || 0) - 1);
        const update = { topicComments: next };
        if (plan.channel) {
            const counts = Object.assign({}, user.topicChannelCounts || {});
            const left = Math.max(0, (Number(counts[plan.channel]) || 0) - 1);
            counts[plan.channel] = left;
            update.topicChannelCounts = counts;
            if (left === 0) {
                update.topicChannelsCommented = adminSdk.firestore.FieldValue.arrayRemove(plan.channel);
            }
        }
        tx.update(userRef, update);
    });
    return plan;
}

module.exports = {
    grantIds: grantIds,
    creditPeerKeyUse: creditPeerKeyUse,
    creditPeerLevel: creditPeerLevel,
    creditPeerAcceptXp: creditPeerAcceptXp,
    creditCipherPaid: creditCipherPaid,
    creditOneTopic: creditOneTopic,
    creditMatureTopicComments: creditMatureTopicComments,
    revokeTopicCredit: revokeTopicCredit,
};
