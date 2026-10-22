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
};
