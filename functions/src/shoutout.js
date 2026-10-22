'use strict';

// Nacho shoutout chat post. No Firebase, so tests can decide the post
// without a project. The live chat hides isNachoAuto:true, so a prize
// announcement has to be a normal Nacho message with mentionUid set.
// That is what turns @username into a profile tag.

function safeName(name) {
    return String(name || 'a Bitcoiner').replace(/[\r\n<>]/g, ' ').trim().slice(0, 40) || 'a Bitcoiner';
}

function shoutoutDocId(prizeId) {
    const clean = String(prizeId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
    if (!clean) return '';
    return 'shoutout_' + clean;
}

function shoutoutText(username) {
    const name = safeName(username);
    return '🎉 Shoutout to @' + name + '! They just unlocked a rare Nacho Shoutout. Go send @' + name + ' a peer request! 🤝';
}

// One Nacho shoutout per user per rolling 7 days. openGift applies this
// when the gift is opened, including gifts whose reward was rolled earlier.
const SHOUTOUT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const SHOUTOUT_CONVERSION_XP = 100;
const SHOUTOUT_CONVERTED_MESSAGE = "You already got a Nacho shoutout this week, so here's +100 XP!";

function shoutoutAtMillis(value) {
    if (value == null) return null;
    if (typeof value === 'number' && isFinite(value)) return value;
    if (value instanceof Date) {
        const ms = value.getTime();
        return isFinite(ms) ? ms : null;
    }
    if (typeof value.toMillis === 'function') {
        const ms = value.toMillis();
        return typeof ms === 'number' && isFinite(ms) ? ms : null;
    }
    const seconds = typeof value.seconds === 'number' ? value.seconds
        : (typeof value._seconds === 'number' ? value._seconds : null);
    if (seconds == null) return null;
    const nanos = typeof value.nanoseconds === 'number' ? value.nanoseconds
        : (typeof value._nanoseconds === 'number' ? value._nanoseconds : 0);
    return seconds * 1000 + Math.floor(nanos / 1e6);
}

function applyShoutoutCap(input) {
    const src = input || {};
    const reward = src.reward || {};
    if (reward.rewardType !== 'nacho_shoutout') {
        return { reward: reward, awarded: false, converted: false, reason: 'not_shoutout' };
    }
    const last = shoutoutAtMillis(src.lastShoutoutAt);
    const now = typeof src.nowMs === 'number' ? src.nowMs : Date.now();
    if (last != null && (now - last) < SHOUTOUT_WINDOW_MS) {
        return {
            reward: {
                rewardType: 'xp_bonus',
                xpAmount: SHOUTOUT_CONVERSION_XP,
                shoutoutConverted: true,
                conversionMessage: SHOUTOUT_CONVERTED_MESSAGE,
            },
            awarded: false,
            converted: true,
            reason: 'weekly_cap',
        };
    }
    return { reward: reward, awarded: true, converted: false, reason: 'award' };
}

function planShoutout(input) {
    const src = input || {};
    if (src.rewardType !== 'nacho_shoutout') return { post: false, reason: 'not_shoutout' };
    if (src.alreadyPosted === true) return { post: false, reason: 'already_posted' };
    if (src.banned === true) return { post: false, reason: 'banned' };
    const docId = shoutoutDocId(src.prizeId);
    if (!docId) return { post: false, reason: 'no_prize' };
    const uid = String(src.uid || '');
    if (!uid) return { post: false, reason: 'no_uid' };
    return {
        post: true,
        reason: 'ok',
        text: shoutoutText(src.username),
        mentionUid: uid,
        docId: docId,
        authorUid: 'nacho-bot',
        authorName: 'Nacho 🦌',
        collection: 'global_chat',
        // false so the global chat listener (isNachoAuto == false) shows it.
        isNachoAuto: false,
    };
}

module.exports = {
    planShoutout: planShoutout,
    shoutoutText: shoutoutText,
    shoutoutDocId: shoutoutDocId,
    safeName: safeName,
    applyShoutoutCap: applyShoutoutCap,
    shoutoutAtMillis: shoutoutAtMillis,
    SHOUTOUT_WINDOW_MS: SHOUTOUT_WINDOW_MS,
    SHOUTOUT_CONVERSION_XP: SHOUTOUT_CONVERSION_XP,
    SHOUTOUT_CONVERTED_MESSAGE: SHOUTOUT_CONVERTED_MESSAGE,
};
