'use strict';

// Pure decisions for the new badge counters and the per-action XP.
// Writers in the callables apply the result. Nothing here touches Firestore.

const { rewardBlocked } = require('./cipherClaim');
const { fraudFlags } = require('./referrals');
const { sharesCluster } = require('./tipBadge');

const MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const KEY_USE_XP = 10;
const KEY_USE_XP_CAP = 3;
const PEER_ACCEPT_XP = 10;
const PEER_ACCEPT_XP_CAP = 3;
const COMMENT_XP = 5;
const COMMENT_XP_CAP = 3;
const COMMENT_BADGE_CAP = 5;
const COMMENT_MIN_CHARS = 20;
const COMMENT_MATURE_MS = 24 * 60 * 60 * 1000;
const CIPHER_DAILY_CAP = 21;
const SAME_PERSON_FLAGS = {
    'self': true,
    'same-fingerprint': true,
    'same-ip': true,
    'same-email': true,
    'same-lightning': true,
};

function timestampMs(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value.toMillis === 'function') {
        const n = value.toMillis();
        return Number.isFinite(n) ? n : null;
    }
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    if (typeof value === 'string') {
        const t = Date.parse(value);
        return Number.isFinite(t) ? t : null;
    }
    return null;
}

function createdMs(user) {
    if (!user) return null;
    return timestampMs(user.created != null ? user.created : user.createdAt);
}

function accountOldEnough(user, nowMs) {
    const born = createdMs(user);
    if (born == null) return false;
    return (Number(nowMs) || 0) - born >= MIN_AGE_MS;
}

function isBanned(user, ledger) {
    return rewardBlocked(user || {}, ledger || {});
}

function samePerson(left, right) {
    if (!left || !right) return true;
    const a = left.uid || '';
    const b = right.uid || '';
    if (!a || !b || a === b) return true;
    const flags = fraudFlags(left, right, '');
    for (let i = 0; i < flags.length; i++) {
        if (SAME_PERSON_FLAGS[flags[i]]) return true;
    }
    return sharesCluster(left, right);
}

function arePeers(left, right) {
    const a = left && left.uid;
    const b = right && right.uid;
    if (!a || !b) return false;
    const peersA = Array.isArray(left.peers) ? left.peers : [];
    const peersB = Array.isArray(right.peers) ? right.peers : [];
    return peersA.indexOf(b) !== -1 || peersB.indexOf(a) !== -1;
}

function dayCount(user, dayField, countField, day) {
    if (!user || user[dayField] !== day) return 0;
    return Number(user[countField]) || 0;
}

function pairEligible(left, leftLedger, right, rightLedger, nowMs) {
    if (!left || !right) return false;
    if (samePerson(left, right)) return false;
    if (isBanned(left, leftLedger) || isBanned(right, rightLedger)) return false;
    if (!accountOldEnough(left, nowMs) || !accountOldEnough(right, nowMs)) return false;
    return true;
}

function emptyKeyPlan() {
    return {
        any: false,
        giftsSent: false,
        distinct: false,
        openerCipher: false,
        fullRing: false,
        senderXp: 0,
        reason: 'skip',
    };
}

// Peer key consumed inside decryptCipher.
// opener is the person using the key. sender is who sent it.
function planPeerKeyCredit(input) {
    const src = input || {};
    const opener = src.opener || null;
    const sender = src.sender || null;
    const out = emptyKeyPlan();
    if (!opener || !sender) return out;
    if (!src.peerKey) {
        out.reason = 'own-key';
        return out;
    }
    if (opener.uid && sender.uid && opener.uid === sender.uid) {
        out.reason = 'self';
        return out;
    }
    if (!arePeers(opener, sender)) {
        out.reason = 'not-peers';
        return out;
    }
    const linked = samePerson(opener, sender);
    const openerBanned = isBanned(opener, src.openerLedger);
    const senderBanned = isBanned(sender, src.senderLedger);
    const openerAged = accountOldEnough(opener, src.nowMs);
    if (src.opensToday >= CIPHER_DAILY_CAP && opener.cipherFullRing !== true) out.fullRing = true;

    if (linked || openerBanned || senderBanned || !openerAged) {
        out.reason = linked ? 'same-person' : (openerBanned || senderBanned ? 'banned' : 'young');
        out.any = out.fullRing;
        return out;
    }

    if (!src.pairCredited) out.giftsSent = true;
    if (!src.distinctCredited) out.distinct = true;
    if (!src.openerCountedSender) out.openerCipher = true;
    const used = dayCount(sender, 'keyGiftXpDay', 'keyGiftXpCount', src.day);
    if (!src.pairCredited && used < KEY_USE_XP_CAP) out.senderXp = KEY_USE_XP;
    out.any = out.giftsSent || out.distinct || out.openerCipher || out.senderXp > 0 || out.fullRing;
    out.reason = out.any ? 'credit' : 'already';
    return out;
}

function planPeerLevel(input) {
    const src = input || {};
    const level = Number(src.newLevel) || 1;
    const stored = Number(src.storedLevel) || 1;
    const out = {
        credit: false,
        senderBest: Number(src.senderBest) || 1,
        recipBest: Number(src.recipBest) || 1,
        crossedL3: false,
        reason: 'skip',
    };
    if (!src.eligible) {
        out.reason = 'ineligible';
        return out;
    }
    if (level > out.senderBest) out.senderBest = level;
    if (level > out.recipBest) out.recipBest = level;
    out.crossedL3 = stored < 3 && level >= 3;
    out.credit = out.senderBest > (Number(src.senderBest) || 0) || out.recipBest > (Number(src.recipBest) || 0) || out.crossedL3;
    out.reason = out.credit ? 'credit' : 'same-level';
    return out;
}

function planPeerAcceptXp(input) {
    const src = input || {};
    const out = { leftXp: 0, rightXp: 0, mark: false, reason: 'skip' };
    if (src.marker) {
        out.reason = 'already';
        return out;
    }
    out.mark = true;
    if (!src.eligible) {
        out.reason = 'ineligible';
        return out;
    }
    const day = src.day;
    const leftUsed = dayCount(src.left, 'peerXpDay', 'peerXpCount', day);
    const rightUsed = dayCount(src.right, 'peerXpDay', 'peerXpCount', day);
    if (!isBanned(src.left, src.leftLedger) && leftUsed < PEER_ACCEPT_XP_CAP) out.leftXp = PEER_ACCEPT_XP;
    if (!isBanned(src.right, src.rightLedger) && rightUsed < PEER_ACCEPT_XP_CAP) out.rightXp = PEER_ACCEPT_XP;
    out.reason = (out.leftXp || out.rightXp) ? 'credit' : 'capped';
    return out;
}

function planTopicCredit(input) {
    const src = input || {};
    const post = src.post || {};
    const out = {
        credit: false,
        xp: 0,
        channel: '',
        reason: 'skip',
        close: true,
    };
    if (isMirrorCopy(post)) {
        out.reason = 'mirror';
        return out;
    }
    if (!(post.createdAtMs > 0)) {
        out.reason = 'undated';
        return out;
    }
    const age = (Number(src.nowMs) || 0) - (Number(post.createdAtMs) || 0);
    if (age < COMMENT_MATURE_MS) {
        out.close = false;
        out.reason = 'young-post';
        return out;
    }
    if (post.badgeCounted) {
        out.reason = 'already';
        return out;
    }
    const text = String(post.text || '');
    if (post.hidden === true || post.deleted === true || text.trim().length < COMMENT_MIN_CHARS) {
        out.reason = 'hidden';
        return out;
    }
    if (post.isNacho === true || !post.uid) {
        out.reason = 'skip';
        return out;
    }
    const user = src.user || {};
    if (isBanned(user, src.ledger)) {
        out.reason = 'banned';
        return out;
    }
    const day = src.day || post.dayKey;
    const counted = dayCount(user, 'topicCountDay', 'topicCountToday', day);
    if (counted >= COMMENT_BADGE_CAP) {
        // At most 5 posts count on this offset day. The extras are not
        // counted, and the pending doc closes so it cannot fill a later run.
        out.reason = 'badge-cap';
        return out;
    }
    out.credit = true;
    out.channel = String(post.channelId || '');
    // Every topic post is a topic conversation. Reply XP is paid by
    // topicConversationXp (+5, source topic_conversation). This path only
    // counts the badge.
    out.xp = 0;
    out.reason = 'credit';
    return out;
}

function isMirrorCopy(post) {
    const row = post || {};
    if (row.noAward === true || row.mirrorOf) return true;
    if (row.mirrored === true || row.forumCopy === true || row.plebMirror === true) return true;
    const origin = String(row.origin || '');
    if (origin === 'topic' || origin === 'forum') return true;
    if (row.topicPost || row.topicChannel) return true;
    const source = String(row.source || '');
    if (source === 'pleb-talk' || source === 'pleb-talk-mirror') return true;
    return false;
}

function topicConversationMessage(post) {
    const row = post || {};
    if (isMirrorCopy(row)) return true;
    if (row.channelId || row.topicChannel || row.topicPost) return true;
    if (row.origin || row.noAward === true) return true;
    const source = String(row.source || '');
    if (source === 'topic-discussion' || source === 'pleb-talk' || source === 'pleb-talk-mirror') return true;
    const collection = String(row.collection || '');
    if (collection === 'topic_discussions' || collection === 'global_chat') return true;
    return false;
}

function planTopicRevoke(input) {
    const post = (input && input.post) || {};
    if (post.badgeCounted !== true) return { revoke: false, channel: '' };
    return { revoke: true, channel: String(post.channelId || ''), uid: post.uid || '' };
}

function planShopPurchase(input) {
    const src = input || {};
    const qty = Math.max(1, Number(src.quantity) || 1);
    const raffle = src.type === 'raffle';
    return {
        shopPurchases: 1,
        raffleTickets: raffle ? qty : 0,
    };
}

function planQuestDay(input) {
    const src = input || {};
    if (!src.day) return { increment: false };
    if (src.lastQuestDate === src.day) return { increment: false };
    return { increment: true, day: src.day };
}

function planCipherPaid(input) {
    const src = input || {};
    const amount = Math.max(0, Math.floor(Number(src.amount) || 0));
    if (src.alreadyCredited || amount <= 0) return { credit: false, biggest: Number(src.biggest) || 0 };
    return {
        credit: true,
        biggest: Math.max(Number(src.biggest) || 0, amount),
    };
}

function planRaffleWinner(input) {
    const user = (input && input.user) || {};
    if (isBanned(user, input && input.ledger)) return { skip: true };
    if (user.withdrawalsDisabled === true || user.withdrawals_disabled === true) return { skip: true };
    return { skip: false };
}

function sortedPairId(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    return left < right ? left + '_' + right : right + '_' + left;
}

function uidList(value) {
    if (!Array.isArray(value)) return [];
    const out = [];
    for (let i = 0; i < value.length; i++) {
        const id = String(value[i] || '').trim();
        if (id && id.length <= 128 && out.indexOf(id) === -1) out.push(id);
    }
    return out;
}

// Provenance written by sendKeys. The request body is not an input.
// A key leaving inventory records the earner as origin and is the only
// handoff that pays send XP. A received key may go back once, to the peer
// who sent it, and that return never pays send XP or peer level.
function planKeySend(key, senderUid, recipientUid) {
    const row = key || {};
    const sender = String(senderUid || '').trim();
    const recipient = String(recipientUid || '').trim();
    const inventory = row.status === 'inventory';
    const held = row.status === 'sent';
    const previous = String(row.sentBy || row.sender || '').trim();
    const origin = String(row.originUid || (inventory ? sender : (previous || sender)) || '').trim();
    const prior = uidList(row.priorSenders);
    if (sender && prior.indexOf(sender) === -1) prior.push(sender);
    const alreadyReturned = held && (row.sendBackUsed === true || row.skipPeerLevel === true);
    const backToPrevious = held && !alreadyReturned && !!previous && recipient === previous;
    const backToOrigin = !!origin && recipient === origin && recipient !== sender;
    const backToPriorHolder = prior.indexOf(recipient) !== -1 && recipient !== sender;
    const skipPeerLevel = row.skipPeerLevel === true || backToPrevious || backToOrigin || backToPriorHolder;
    return {
        inventory: inventory,
        held: held,
        previousSender: previous,
        originUid: origin,
        priorSenders: prior.slice(0, 8),
        skipPeerLevel: skipPeerLevel,
        alreadyReturned: alreadyReturned,
        sendBack: backToPrevious,
        paysSendXp: inventory === true,
    };
}

// True only for a peer key whose open is the first real handoff.
// A return to the earner, or to anyone who already sent this key, is false.
function keyOpenCountsForPeerLevel(key, openerUid) {
    const row = key || {};
    const opener = String(openerUid || '').trim();
    if (!opener || row.status !== 'sent') return false;
    if (row.skipPeerLevel === true) return false;
    const sentBy = String(row.sentBy || '').trim();
    if (!sentBy || sentBy === opener) return false;
    const origin = String(row.originUid || '').trim();
    if (origin && origin === opener) return false;
    if (uidList(row.priorSenders).indexOf(opener) !== -1) return false;
    return true;
}

module.exports = {
    MIN_AGE_MS: MIN_AGE_MS,
    KEY_USE_XP: KEY_USE_XP,
    KEY_USE_XP_CAP: KEY_USE_XP_CAP,
    PEER_ACCEPT_XP: PEER_ACCEPT_XP,
    PEER_ACCEPT_XP_CAP: PEER_ACCEPT_XP_CAP,
    COMMENT_XP: COMMENT_XP,
    COMMENT_XP_CAP: COMMENT_XP_CAP,
    COMMENT_BADGE_CAP: COMMENT_BADGE_CAP,
    COMMENT_MIN_CHARS: COMMENT_MIN_CHARS,
    COMMENT_MATURE_MS: COMMENT_MATURE_MS,
    CIPHER_DAILY_CAP: CIPHER_DAILY_CAP,
    timestampMs: timestampMs,
    createdMs: createdMs,
    accountOldEnough: accountOldEnough,
    isBanned: isBanned,
    samePerson: samePerson,
    arePeers: arePeers,
    pairEligible: pairEligible,
    planPeerKeyCredit: planPeerKeyCredit,
    planPeerLevel: planPeerLevel,
    planPeerAcceptXp: planPeerAcceptXp,
    isMirrorCopy: isMirrorCopy,
    topicConversationMessage: topicConversationMessage,
    planTopicCredit: planTopicCredit,
    planTopicRevoke: planTopicRevoke,
    planShopPurchase: planShopPurchase,
    planQuestDay: planQuestDay,
    planCipherPaid: planCipherPaid,
    planRaffleWinner: planRaffleWinner,
    sortedPairId: sortedPairId,
    planKeySend: planKeySend,
    keyOpenCountsForPeerLevel: keyOpenCountsForPeerLevel,
};
