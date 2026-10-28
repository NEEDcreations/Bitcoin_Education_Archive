'use strict';

// One global-chat post when an active Satoshi's Favor window is inside its
// last 10 minutes. The chat doc id is random. The marker stores that id, and
// a later run reads the marker before opening a transaction, so a retry
// reuses it and does not lock the Favor state doc. The marker and the chat
// doc are created in the same transaction. A window that has already closed,
// or that has no time left, is skipped and does not write the marker.
// The text names no uid, email, or IP, and it does not state a minute count.

const { millisOf } = require('./favorPool');
const { cycleKey } = require('./favorLiveAnnounce');

const HEADS_UP_MS = 10 * 60 * 1000;
const MARKER_COLLECTION = 'sf_ending_announcements';
const ENDING_TEXT = "⏳ Satoshi's Favor ends soon. Hash now!";

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
    return { post: true, reason: 'ok', cycleId: key };
}

function formatEndingAnnouncement() {
    return ENDING_TEXT;
}

function newChatId() {
    return require('crypto').randomBytes(16).toString('hex');
}

function markerChatId(snap) {
    if (!snap || !snap.exists) return '';
    const data = snap.data() || {};
    const id = String(data.chatId || '');
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) return '';
    return id;
}

async function announceFavorEnding(db, adminSdk, nowMs) {
    const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    const stateRef = db.collection('satoshiFavor').doc('current');
    const peekedSnap = await stateRef.get();
    const peeked = peekedSnap && peekedSnap.exists ? (peekedSnap.data() || {}) : null;
    const decision = endingDecision(peeked, now);
    if (!decision.post) return { posted: false, reason: decision.reason };
    const key = decision.cycleId;
    const markerRef = db.collection(MARKER_COLLECTION).doc(key);
    // Plain read. After the post exists, later minutes must not open a
    // transaction that locks satoshiFavor/current.
    const markerSnap = await markerRef.get();
    if (markerSnap && markerSnap.exists) {
        return { posted: false, reason: 'exists', cycleId: key, chatId: markerChatId(markerSnap) };
    }
    return db.runTransaction(async function (t) {
        const stateSnap = await t.get(stateRef);
        const freshMarker = await t.get(markerRef);
        const state = stateSnap && stateSnap.exists ? (stateSnap.data() || {}) : null;
        const fresh = endingDecision(state, now);
        if (!fresh.post || fresh.cycleId !== key) {
            return { posted: false, reason: fresh.post ? 'cycle' : fresh.reason, cycleId: key };
        }
        if (freshMarker && freshMarker.exists) {
            return { posted: false, reason: 'exists', cycleId: key, chatId: markerChatId(freshMarker) };
        }
        const chatId = newChatId();
        const chatRef = db.collection('global_chat').doc(chatId);
        const stamp = adminSdk.firestore.FieldValue.serverTimestamp();
        t.set(markerRef, {
            cycleId: key,
            postedAt: stamp,
            chatId: chatId,
        });
        t.set(chatRef, {
            uid: 'nacho-bot',
            name: '🦌 Nacho',
            text: ENDING_TEXT,
            isNachoAuto: false,
            ts: stamp,
            cycleId: key,
        });
        return { posted: true, cycleId: key, text: ENDING_TEXT, chatId: chatId };
    });
}

module.exports = {
    HEADS_UP_MS: HEADS_UP_MS,
    MARKER_COLLECTION: MARKER_COLLECTION,
    ENDING_TEXT: ENDING_TEXT,
    effectiveEndMs: effectiveEndMs,
    remainingMs: remainingMs,
    endingDecision: endingDecision,
    formatEndingAnnouncement: formatEndingAnnouncement,
    newChatId: newChatId,
    announceFavorEnding: announceFavorEnding,
};
