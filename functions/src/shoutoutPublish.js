'use strict';

// One writer for Nacho messages in global_chat.
// Gift shoutouts and activity shoutouts both come through here, then
// mirrorShoutoutOnce stamps telegramMsgId for reaction sync.
// A gift uses the prize doc as the idempotency marker. An activity shoutout
// uses shoutout_claims/{docId}, which clients cannot write, so a retry or a
// pre-created chat id still posts exactly once.

const { applyActivityRate, activityItemSkip, activityRemovedState } = require('./shoutout');

function sourceRemovalReason(kind, data) {
    if (!data) return 'deleted';
    const skip = activityItemSkip(kind, data);
    if (skip === 'deleted' || skip === 'hidden') return skip;
    return 'deleted';
}

function nachoChatMessage(plan, serverTimestamp) {
    const msg = {
        uid: plan.authorUid,
        name: plan.authorName,
        text: plan.text,
        isNachoAuto: plan.isNachoAuto,
        mentionUid: plan.mentionUid,
        ts: serverTimestamp(),
    };
    if (plan.activityRef) {
        msg.activityRef = plan.activityRef;
        msg.activityKind = plan.activityKind || '';
    }
    return msg;
}

function mentionNotification(plan, serverTimestamp) {
    const preview = String(plan.text || '').slice(0, 50);
    return {
        recipientId: plan.mentionUid,
        senderId: 'nacho-bot',
        senderName: 'Nacho 🦌',
        type: 'chat_mention',
        message: '💬 @Nacho mentioned you in Global Chat: "' + preview + '"',
        targetType: 'chat',
        targetId: plan.docId,
        read: false,
        createdAt: serverTimestamp(),
    };
}

async function publishShoutoutOnce(opts) {
    const o = opts || {};
    const db = o.db;
    const admin = o.admin;
    const plan = o.plan || {};
    const markerRef = o.markerRef || null;
    const claimRef = o.claimRef || null;
    const authorLimitRef = o.authorLimitRef || null;
    const hourLimitRef = o.hourLimitRef || null;
    const globalLimitRef = o.globalLimitRef || null;
    const sourceRef = o.sourceRef || null;
    const nowMs = typeof o.nowMs === 'number' ? o.nowMs : Date.now();
    if (!db || !admin || !plan.docId || !plan.collection) return { wrote: false, reason: 'bad_plan' };
    if (plan.activityRef && (!claimRef || !authorLimitRef || !hourLimitRef || !globalLimitRef)) {
        return { wrote: false, reason: 'no_limit' };
    }
    const serverTimestamp = function() { return admin.firestore.FieldValue.serverTimestamp(); };
    const chatRef = db.collection(plan.collection).doc(plan.docId);
    const notifRef = db.collection('notifications').doc(plan.docId);

    return db.runTransaction(async function(t) {
        const chatSnap = await t.get(chatRef);
        const markerSnap = markerRef ? await t.get(markerRef) : null;
        const claimSnap = claimRef ? await t.get(claimRef) : null;
        const authorSnap = authorLimitRef ? await t.get(authorLimitRef) : null;
        const hourSnap = hourLimitRef ? await t.get(hourLimitRef) : null;
        const globalSnap = globalLimitRef ? await t.get(globalLimitRef) : null;
        const sourceSnap = sourceRef ? await t.get(sourceRef) : null;
        const chat = chatSnap.exists ? (chatSnap.data() || {}) : null;

        if (!plan.activityRef) {
            const posted = !!(markerSnap && markerSnap.exists && markerSnap.data().shoutoutPosted === true);
            if (posted || chatSnap.exists) {
                if (!posted && markerSnap && markerSnap.exists) t.update(markerRef, { shoutoutPosted: true });
                return { wrote: false, reason: 'already_posted' };
            }
            t.update(markerRef, {
                shoutoutPosted: true,
                shoutoutAt: serverTimestamp(),
            });
        } else {
            if (claimSnap && claimSnap.exists) {
                const claim = claimSnap.data() || {};
                return {
                    wrote: false,
                    reason: claim.status === 'posted' ? 'already_posted' : 'skipped',
                    skip: claim.reason || '',
                };
            }
            // The grace-window read can be stale. This read is in the same
            // transaction as the chat write, so a delete or hide that landed
            // in between does not still produce a shoutout.
            if (sourceRef) {
                const sourceData = sourceSnap && sourceSnap.exists ? (sourceSnap.data() || {}) : null;
                if (!sourceData || activityRemovedState(sourceData)) {
                    const reason = sourceRemovalReason(plan.activityKind, sourceData);
                    t.set(claimRef, {
                        status: 'skipped',
                        reason: reason,
                        activityRef: plan.activityRef,
                        authorUid: plan.mentionUid || '',
                        atMs: nowMs,
                    });
                    return { wrote: false, reason: reason };
                }
            }
            if (chat && chat.uid === 'nacho-bot' && chat.activityRef === plan.activityRef) {
                t.set(claimRef, {
                    status: 'posted',
                    reason: 'already',
                    activityRef: plan.activityRef,
                    authorUid: plan.mentionUid || '',
                    atMs: nowMs,
                });
                return { wrote: false, reason: 'already_posted' };
            }
            const decision = applyActivityRate({
                author: authorSnap && authorSnap.exists ? authorSnap.data() : null,
                hour: hourSnap && hourSnap.exists ? hourSnap.data() : null,
                global: globalSnap && globalSnap.exists ? globalSnap.data() : null,
                nowMs: nowMs,
            });
            if (!decision.allow) {
                t.set(claimRef, {
                    status: 'skipped',
                    reason: decision.reason,
                    activityRef: plan.activityRef,
                    authorUid: plan.mentionUid || '',
                    atMs: nowMs,
                });
                return { wrote: false, reason: decision.reason };
            }
            t.set(authorLimitRef, decision.author);
            t.set(hourLimitRef, decision.hour);
            t.set(globalLimitRef, decision.global);
            t.set(claimRef, {
                status: 'posted',
                reason: 'ok',
                activityRef: plan.activityRef,
                authorUid: plan.mentionUid || '',
                atMs: nowMs,
            });
        }

        t.set(chatRef, nachoChatMessage(plan, serverTimestamp));
        t.set(notifRef, mentionNotification(plan, serverTimestamp));
        return { wrote: true, reason: 'ok' };
    });
}

module.exports = {
    publishShoutoutOnce: publishShoutoutOnce,
    nachoChatMessage: nachoChatMessage,
};
