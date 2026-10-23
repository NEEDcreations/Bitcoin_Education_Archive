'use strict';

// Nacho shoutout chat post. No Firebase, so tests can decide the post
// without a project. The live chat hides isNachoAuto:true, so a prize
// announcement has to be a normal Nacho message with mentionUid set.
// That is what turns @username into a profile tag.
//
// Activity shoutouts (new PlebTalk posts and Marketplace listings) use the
// same chat shape: uid nacho-bot, isNachoAuto false, deterministic doc id.
// publishShoutoutOnce writes them. This file only decides the post.

const { chatTextBlocked } = require('./chatProfanity');

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
    // One @ only. mentionUid turns that first @name into the profile tag.
    // A second @name is plain text, so a multi-word name is not split.
    return '🎉 Shoutout to @' + name + '! They just unlocked a rare Nacho Shoutout. Go send ' + name + ' a peer request! 🤝';
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

// One Nacho post per author per 30 minutes for each kind, at most two an hour
// across forum and marketplace together, and about 10 an hour for everyone.
// A profile younger than a day is skipped when users/{uid}.created is set.
const ACTIVITY_AUTHOR_WINDOW_MS = 30 * 60 * 1000;
const ACTIVITY_AUTHOR_HOUR_MS = 60 * 60 * 1000;
const ACTIVITY_AUTHOR_HOUR_CAP = 2;
const ACTIVITY_GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const ACTIVITY_GLOBAL_CAP = 10;
const ACTIVITY_TITLE_MAX = 80;
const ACTIVITY_MIN_AGE_MS = 24 * 60 * 60 * 1000;

function cleanActivityId(id) {
    const raw = String(id || '');
    return /^[A-Za-z0-9_-]{1,120}$/.test(raw) ? raw : '';
}

// Display name comes only from users/{uid}.username. Strip the characters that
// would let a profile name become a second @ or a markdown link in Nacho's post.
function sanitizeActivityName(raw) {
    let s = String(raw == null ? '' : raw);
    s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
    s = s.replace(/https?:\/\/\S+/gi, ' ');
    s = s.replace(/\bwww\.\S+/gi, ' ');
    s = s.replace(/[\[\]()#*_~`@]/g, '');
    s = s.replace(/[\r\n<>]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim().slice(0, 40);
    return s;
}

function sanitizeActivityTitle(raw) {
    let s = String(raw == null ? '' : raw);
    s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
    s = s.replace(/<[^>]*>/g, ' ');
    s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, ' $1 ');
    s = s.replace(/https?:\/\/\S+/gi, ' ');
    s = s.replace(/\bwww\.\S+/gi, ' ');
    s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ');
    s = s.replace(/[`*_~#<>\[\]\(\)\{\}]/g, ' ');
    s = s.replace(/@/g, '');
    s = s.replace(/[\r\n\t]+/g, ' ');
    s = s.replace(/["“”]/g, "'");
    s = s.replace(/\s+/g, ' ').trim();
    if (!s) return '';
    if (s.length > ACTIVITY_TITLE_MAX) s = s.slice(0, ACTIVITY_TITLE_MAX - 1).trimEnd() + '…';
    return s;
}

function formatPublicPrice(item) {
    const src = item || {};
    if (src.priceHidden === true || src.hidePrice === true || src.showPrice === false) return '';
    const raw = src.priceSats != null ? src.priceSats : src.price;
    const n = Number(raw);
    if (!isFinite(n) || n <= 0 || n > 100000000000) return '';
    return Math.round(n).toLocaleString('en-US') + ' sats';
}

// Shared by the posting skip and the later removal. A sale (status sold)
// stays up. Moderated, banned, and hidden posts match the posting check
// so a post moderated after the shoutout still loses it.
function activityRemovedState(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.deletedAt != null && data.deletedAt !== '') return true;
    if (data.deleted === true || data.removed === true || data.hidden === true) return true;
    if (data.moderated === true || data.moderationHidden === true) return true;
    const status = String(data.status || '').toLowerCase();
    return status === 'deleted' || status === 'removed' || status === 'hidden'
        || status === 'moderated' || status === 'banned';
}

function activityItemSkip(kind, data) {
    if (!data || typeof data !== 'object') return 'missing';
    if (data.deleted === true || data.removed === true) return 'deleted';
    if (data.hidden === true || data.moderated === true || data.moderationHidden === true) return 'hidden';
    const status = String(data.status || '').toLowerCase();
    if (status === 'deleted' || status === 'removed') return 'deleted';
    if (status === 'hidden' || status === 'moderated' || status === 'banned') return 'hidden';
    if (kind === 'marketplace') {
        if ((status || 'active') !== 'active') return 'hidden';
    }
    if (kind === 'forum') {
        if (data.parentId || data.parentPostId || data.replyTo || data.replyToId || data.threadId || data.isReply === true) return 'reply';
        const type = String(data.type || '').toLowerCase();
        if (type === 'reply' || type === 'comment') return 'reply';
    }
    return '';
}

function activityAccountSkip(user, ledger, addressLock, nowMs) {
    const u = user || {};
    if (u.isAnonymous === true) return 'anonymous';
    if (u.banned === true || u.withdrawals_disabled === true) return 'banned';
    if (u.satsDisabled === true) return 'sats_disabled';
    if (ledger && ledger.banned === true) return 'banned';
    if (u.linkedBanned === true) return 'linked';
    if (addressLock && addressLock.banned === true) return 'linked';
    const created = shoutoutAtMillis(u.created != null ? u.created : u.createdAt);
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    if (created != null && (now - created) < ACTIVITY_MIN_AGE_MS) return 'too_new';
    return '';
}

function activityLimitDocId(kind, uid) {
    const clean = String(uid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
    if (!clean) return '';
    return (kind === 'marketplace' ? 'market_' : 'forum_') + clean;
}

function activityHourDocId(uid) {
    const clean = String(uid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
    if (!clean) return '';
    return 'hour_' + clean;
}

function activityIds(kind, id) {
    const clean = cleanActivityId(id);
    if ((kind !== 'forum' && kind !== 'marketplace') || !clean) return null;
    const docId = shoutoutDocId((kind === 'marketplace' ? 'market_' : 'forum_') + clean);
    if (!docId) return null;
    return {
        id: clean,
        docId: docId,
        activityRef: (kind === 'marketplace' ? 'market:' : 'forum:') + clean,
    };
}

function freshStamps(prev, nowMs, windowMs) {
    const stamps = [];
    const arr = Array.isArray(prev) ? prev : [];
    for (let i = 0; i < arr.length; i++) {
        const ts = Number(arr[i]);
        if (isFinite(ts) && (nowMs - ts) < windowMs) stamps.push(ts);
    }
    return stamps;
}

function applyActivityRate(input) {
    const src = input || {};
    const nowMs = typeof src.nowMs === 'number' ? src.nowMs : Date.now();
    const author = src.author || {};
    const last = typeof author.lastAtMs === 'number' && isFinite(author.lastAtMs) ? author.lastAtMs : null;
    if (last != null && (nowMs - last) < ACTIVITY_AUTHOR_WINDOW_MS) {
        return { allow: false, reason: 'author_rate' };
    }
    const hourStamps = freshStamps(src.hour && src.hour.stamps, nowMs, ACTIVITY_AUTHOR_HOUR_MS);
    if (hourStamps.length >= ACTIVITY_AUTHOR_HOUR_CAP) {
        return { allow: false, reason: 'author_hour' };
    }
    const stamps = freshStamps(src.global && src.global.stamps, nowMs, ACTIVITY_GLOBAL_WINDOW_MS);
    if (stamps.length >= ACTIVITY_GLOBAL_CAP) return { allow: false, reason: 'global_cap' };
    hourStamps.push(nowMs);
    stamps.push(nowMs);
    return {
        allow: true,
        reason: 'ok',
        author: { lastAtMs: nowMs },
        hour: { stamps: hourStamps },
        global: { stamps: stamps },
    };
}

function planActivityShoutout(input) {
    const src = input || {};
    const kind = src.kind === 'marketplace' ? 'marketplace' : (src.kind === 'forum' ? 'forum' : '');
    if (!kind) return { post: false, reason: 'bad_kind' };
    const id = cleanActivityId(src.id);
    if (!id) return { post: false, reason: 'bad_id' };
    const uid = String(src.uid || '');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return { post: false, reason: 'no_uid' };
    if (!src.item || typeof src.item !== 'object') return { post: false, reason: 'missing' };
    const itemReason = activityItemSkip(kind, src.item);
    if (itemReason) return { post: false, reason: itemReason };
    if (!src.user || typeof src.user !== 'object') return { post: false, reason: 'no_user' };
    const rawName = src.user.username;
    if (rawName == null || !String(rawName).trim()) return { post: false, reason: 'no_user' };
    const nowMs = typeof src.nowMs === 'number' ? src.nowMs : Date.now();
    const accountReason = activityAccountSkip(src.user, src.ledger, src.addressLock, nowMs);
    if (accountReason) return { post: false, reason: accountReason };
    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(String(rawName))) {
        return { post: false, reason: 'email' };
    }
    const nameBlocked = chatTextBlocked(String(rawName));
    if (nameBlocked) return { post: false, reason: nameBlocked };
    const name = sanitizeActivityName(rawName);
    if (!name) return { post: false, reason: 'no_user' };
    if (chatTextBlocked(name)) return { post: false, reason: 'profanity' };
    const rawTitle = src.item.title;
    const blocked = chatTextBlocked(String(rawTitle || ''));
    if (blocked) return { post: false, reason: blocked };
    let title = sanitizeActivityTitle(rawTitle);
    if (title && chatTextBlocked(title)) return { post: false, reason: 'profanity' };
    if (!title) title = kind === 'marketplace' ? 'a new item' : 'a new post';
    const ids = activityIds(kind, id);
    if (!ids) return { post: false, reason: 'bad_id' };
    const docId = ids.docId;
    const activityRef = ids.activityRef;
    let text;
    if (kind === 'forum') {
        text = '📝 @' + name + ' just posted in PlebTalk: "' + title + '" → [Read it](#forum/post/' + id + ')';
    } else {
        const price = formatPublicPrice(src.item);
        const priceBit = price ? ' for ' + price : '';
        text = '🛒 @' + name + ' listed a new item in the Marketplace: "' + title + '"' + priceBit + ' → [View it](#marketplace/listing/' + id + ')';
    }
    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text.replace('@', ''))) {
        return { post: false, reason: 'email' };
    }
    return {
        post: true,
        reason: 'ok',
        text: text,
        mentionUid: uid,
        docId: docId,
        authorUid: 'nacho-bot',
        authorName: 'Nacho 🦌',
        collection: 'global_chat',
        isNachoAuto: false,
        activityRef: activityRef,
        activityKind: kind,
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
    ACTIVITY_AUTHOR_WINDOW_MS: ACTIVITY_AUTHOR_WINDOW_MS,
    ACTIVITY_AUTHOR_HOUR_MS: ACTIVITY_AUTHOR_HOUR_MS,
    ACTIVITY_AUTHOR_HOUR_CAP: ACTIVITY_AUTHOR_HOUR_CAP,
    ACTIVITY_GLOBAL_WINDOW_MS: ACTIVITY_GLOBAL_WINDOW_MS,
    ACTIVITY_GLOBAL_CAP: ACTIVITY_GLOBAL_CAP,
    ACTIVITY_TITLE_MAX: ACTIVITY_TITLE_MAX,
    ACTIVITY_MIN_AGE_MS: ACTIVITY_MIN_AGE_MS,
    cleanActivityId: cleanActivityId,
    sanitizeActivityTitle: sanitizeActivityTitle,
    sanitizeActivityName: sanitizeActivityName,
    formatPublicPrice: formatPublicPrice,
    activityRemovedState: activityRemovedState,
    activityItemSkip: activityItemSkip,
    activityAccountSkip: activityAccountSkip,
    activityLimitDocId: activityLimitDocId,
    activityHourDocId: activityHourDocId,
    activityIds: activityIds,
    applyActivityRate: applyActivityRate,
    planActivityShoutout: planActivityShoutout,
};
