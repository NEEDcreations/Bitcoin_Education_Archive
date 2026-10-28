'use strict';

// Display-only day stamp for the Today "Say hi" tile.
// The Say hi reward stays on claimSayHi. A real Global Chat post does not
// grant that reward. It only records the offset day on the user doc so the
// home tile can show completed after a reload. Clients cannot write the field.

const ticketGrants = require('./ticketGrants');

function chatPostText(msg) {
    if (!msg || typeof msg !== 'object') return '';
    const text = String(msg.text || '').replace(/\s+/g, ' ').trim();
    const caption = String(msg.caption || '').replace(/\s+/g, ' ').trim();
    if (msg.isGif === true && !text) return caption;
    return text || caption;
}

function qualifiesChatPost(msg) {
    if (!msg || typeof msg !== 'object') return false;
    const uid = msg.uid;
    if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return false;
    if (uid === 'nacho' || uid === 'nacho-bot' || uid === 'nacho-dj' || uid === 'system' || uid === 'telegram' || uid === 'bot') return false;
    if (uid.indexOf('tg_') === 0) return false;
    if (msg.isNachoAuto === true || msg.isSystemPost === true) return false;
    if (msg.source === 'telegram' || msg.fromTelegram === true || msg.bridgedFrom === 'telegram') return false;
    return chatPostText(msg).length > 0;
}

function shouldStampChatPostedDay(msg, existingDay, today) {
    if (!qualifiesChatPost(msg)) return false;
    if (!today) return false;
    return String(existingDay || '') !== String(today);
}

async function stampChatPostedDay(db, msg, nowMs) {
    if (!qualifiesChatPost(msg)) return { stamped: false, reason: 'skip' };
    const today = ticketGrants.offsetDay(nowMs);
    const ref = db.collection('users').doc(msg.uid);
    return db.runTransaction(async function (tx) {
        const snap = await tx.get(ref);
        if (!snap.exists) return { stamped: false, reason: 'no-user' };
        const data = snap.data() || {};
        if (!shouldStampChatPostedDay(msg, data.chatPostedDay || '', today)) {
            return { stamped: false, reason: 'same-day', day: today };
        }
        tx.update(ref, { chatPostedDay: today });
        return { stamped: true, day: today };
    });
}

module.exports = {
    chatPostText: chatPostText,
    qualifiesChatPost: qualifiesChatPost,
    shouldStampChatPostedDay: shouldStampChatPostedDay,
    stampChatPostedDay: stampChatPostedDay,
};
