'use strict';

// One global-chat post when an active Satoshi's Favor window is inside its
// last 10 minutes. The marker doc and the chat doc are created in the same
// transaction, so a retry or an overlapping run posts once. A window that
// has already closed, or that has no time left, is skipped and does not
// write the marker. The text names no uid, email, or IP.

const { millisOf } = require('./favorPool');
const { cycleKey } = require('./favorLiveAnnounce');

const ENDING_PREFIX = 'sf_ending_';
const HEADS_UP_MS = 10 * 60 * 1000;
const MARKER_COLLECTION = 'sf_ending_announcements';

function effectiveEndMs(state) {
    const endBase = millisOf(state && state.favorEndBase);
    if (!endBase) return 0;
    const bonus = Number(state && state.bonusMinutes);
    const bonusMin = Number.isFinite(bonus) && bonus > 0 ? bonus : 0;
    return endBase + bonusMin * 60 * 1000;
}

function remainingMs(state, nowMs) {
    const end = effectiveEndMs(state);
    if (!end) return 0;
    return end - nowMs;
}

function endingDecision(state, nowMs) {
    if (!state || state.favorActive !== true) return { post: false, reason: 'inactive' };
    const key = cycleKey(state && state.currentCycleId);
    if (!key) return { post: false, reason: 'cycle' };
    const rem = remainingMs(state, nowMs);
    if (rem <= 0) return { post: false, reason: 'no_time' };
    if (rem > HEADS_UP_MS) return { post: false, reason: 'not_yet' };
    return {
        post: true,
        reason: 'ok',
        cycleId: key,
        minutes: Math.ceil(rem / 60000),
    };
}

function formatEndingAnnouncement(minutes) {
    const n = Math.max(1, Math.floor(Number(minutes) || 1));
    return "⚡ Satoshi's Favor is LIVE! " + n + " min left.";
}

async function announceFavorEnding(db, adminSdk, nowMs) {
    const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    const stateRef = db.collection('satoshiFavor').doc('current');
    const peekedSnap = await stateRef.get();
    const peeked = peekedSnap && peekedSnap.exists ? (peekedSnap.data() || {}) : null;
    const decision = endingDecision(peeked, now);
    if (!decision.post) return { posted: false, reason: decision.reason };
    const key = decision.cycleId;
    const dedupRef = db.collection(MARKER_COLLECTION).doc(key);
    const chatId = ENDING_PREFIX + key;
    const chatRef = db.collection('global_chat').doc(chatId);
    return db.runTransaction(async function (t) {
        const stateSnap = await t.get(stateRef);
        const markerSnap = await t.get(dedupRef);
        const state = stateSnap && stateSnap.exists ? (stateSnap.data() || {}) : null;
        const fresh = endingDecision(state, now);
        if (!fresh.post || fresh.cycleId !== key) {
            return { posted: false, reason: fresh.post ? 'cycle' : fresh.reason, cycleId: key };
        }
        if (markerSnap && markerSnap.exists) {
            return { posted: false, reason: 'exists', cycleId: key };
        }
        const text = formatEndingAnnouncement(fresh.minutes);
        const stamp = adminSdk.firestore.FieldValue.serverTimestamp();
        t.set(dedupRef, {
            cycleId: key,
            postedAt: stamp,
            chatId: chatId,
        });
        t.set(chatRef, {
            uid: 'nacho-bot',
            name: '🦌 Nacho',
            text: text,
            isNachoAuto: false,
            ts: stamp,
            cycleId: key,
        });
        return { posted: true, cycleId: key, text: text };
    });
}

module.exports = {
    ENDING_PREFIX: ENDING_PREFIX,
    HEADS_UP_MS: HEADS_UP_MS,
    MARKER_COLLECTION: MARKER_COLLECTION,
    effectiveEndMs: effectiveEndMs,
    remainingMs: remainingMs,
    endingDecision: endingDecision,
    formatEndingAnnouncement: formatEndingAnnouncement,
    announceFavorEnding: announceFavorEnding,
};
