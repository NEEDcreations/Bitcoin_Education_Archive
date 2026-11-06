'use strict';

// Extra sats-claim requirements for accounts created at or after
// CLAIM_REQS_START. Older Auth accounts are exempt. The clock is the
// Auth user record's metadata.creationTime. Profile fields the client
// can influence are ignored.
//
// Stamps live on users/{uid}.claimReq and are written only by Cloud
// Functions. chatAt plus chatMsgId: a global chat message the server
// filter accepted. Claim time re-reads that message. tctvAt: the watch
// meter has recorded one watch-credit block. That block is
// tctvWatch.CREDIT_SECONDS, because the first heartbeat only starts the
// clock and the next one is the first credit. (A referral-visit step was
// dropped on Nov 4; only chat and TCTV are required.)

const { classifyChatText } = require('./chatProfanity');
const tctvWatch = require('./tctvWatch');
const {
    meaningfulLength,
    extractSayHiText,
    withoutRemovedLinks,
    isSpamRepeat,
} = require('./sayHi');

// Cutoff: only accounts created at or after this instant need the extra
// steps. Phil's call (Nov 4): existing accounts are never affected, so the
// cutoff is the moment #126 ships. SHIP STEP: replace the placeholder with
// the deploy time (UTC ISO, e.g. `date -u +%Y-%m-%dT%H:%M:%S.000Z`) in the
// same commit that is merged and deployed. Until then it stays far in the
// future, which exempts every account (no requirements apply).
const CLAIM_REQS_START_UNSET_ISO = '9999-12-31T23:59:59.000Z';
const CLAIM_REQS_START_ISO = '2026-11-05T03:52:31.000Z';
const CLAIM_REQS_START = Date.parse(CLAIM_REQS_START_ISO);
const MIN_CHAT_CHARS = 3;
const MIN_TCTV_SECONDS = tctvWatch.CREDIT_SECONDS;
const CHAT_MSG_CAP = 5;

const ITEM_LABEL = {
    chat: 'send 1 chat message',
    tctv: 'watch Timechain TV for ' + MIN_TCTV_SECONDS + ' seconds',
};

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const PHONE_RE = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;

function stampMillis(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    }
    if (typeof value.toMillis === 'function') {
        const ms = value.toMillis();
        return Number.isFinite(ms) && ms > 0 ? ms : 0;
    }
    if (typeof value === 'object') {
        const seconds = value._seconds != null ? value._seconds : value.seconds;
        if (typeof seconds === 'number' && seconds > 0) {
            const nanos = value._nanoseconds || value.nanoseconds || 0;
            return seconds * 1000 + Math.floor(Number(nanos) / 1e6);
        }
    }
    return 0;
}

function isExempt(createdMs) {
    const n = Number(createdMs);
    if (!Number.isFinite(n) || n <= 0) return false;
    return n < CLAIM_REQS_START;
}

function claimReqOf(user) {
    const req = user && user.claimReq;
    return req && typeof req === 'object' ? req : {};
}

function missingItems(user, createdMs) {
    if (isExempt(createdMs)) return [];
    const req = claimReqOf(user);
    const missing = [];
    if (!stampMillis(req.chatAt)) missing.push('chat');
    if (!stampMillis(req.tctvAt)) missing.push('tctv');
    return missing;
}

function missingError(missing) {
    const labels = [];
    (missing || []).forEach(function (key) {
        if (ITEM_LABEL[key]) labels.push(ITEM_LABEL[key]);
    });
    if (!labels.length) return 'Finish the claim requirements first.';
    return 'Finish these before claiming: ' + labels.join('; ') + '.';
}

function isBotUid(uid) {
    const id = String(uid || '');
    if (!id) return true;
    if (id === 'nacho' || id === 'nacho-bot' || id === 'nacho-dj' || id === 'system' || id === 'telegram' || id === 'bot') {
        return true;
    }
    if (id.indexOf('tg_') === 0) return true;
    return false;
}

// A chat message counts only when this server filter accepts it. Deleted,
// bot, spam, scam, hate, profanity, contact info, and tiny texts do not.
function chatQualifies(msg) {
    if (!msg || typeof msg !== 'object') return false;
    if (msg.deleted === true || msg.removed === true || msg.status === 'deleted') return false;
    if (msg.status === 'hidden' || msg.status === 'moderated' || msg.status === 'removed') return false;
    if (msg.deletedAt != null && msg.deletedAt !== '') return false;
    if (msg.hidden === true || msg.moderated === true || msg.flagged === true || msg.spam === true) return false;
    if (msg.moderationRejected === true || msg.filterRejected === true || msg.rejected === true) return false;
    if (msg.shadowbanned === true || msg.shadowBan === true || msg.isShadowbanned === true || msg.shadowBanned === true) return false;
    if (msg.uid === 'deleted') return false;
    if (msg.isNachoAuto === true || msg.isSystemPost === true || msg.source === 'telegram') return false;
    if (isBotUid(msg.uid)) return false;
    const text = withoutRemovedLinks(extractSayHiText(msg));
    if (!text || !/\S/.test(text)) return false;
    if (isSpamRepeat(text)) return false;
    const kind = classifyChatText(text);
    if (kind === 'hate' || kind === 'scam' || kind === 'spam' || kind === 'profanity') return false;
    if (EMAIL_RE.test(text) || PHONE_RE.test(text)) return false;
    if (meaningfulLength(text) < MIN_CHAT_CHARS) return false;
    return true;
}

function normalizeChatMsgId(id) {
    const text = String(id || '').trim();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(text)) return '';
    return text;
}

function chatMsgIdsOf(req) {
    const src = req && typeof req === 'object' ? req : {};
    const ids = [];
    function push(id) {
        const clean = normalizeChatMsgId(id);
        if (!clean || ids.indexOf(clean) !== -1) return;
        ids.push(clean);
    }
    if (Array.isArray(src.chatMsgIds)) src.chatMsgIds.forEach(push);
    push(src.chatMsgId);
    if (ids.length > CHAT_MSG_CAP) return ids.slice(ids.length - CHAT_MSG_CAP);
    return ids;
}

function nextChatMsgIds(req, msgId) {
    const clean = normalizeChatMsgId(msgId);
    const ids = chatMsgIdsOf(req).filter(function (id) { return id !== clean; });
    if (clean) ids.push(clean);
    if (ids.length > CHAT_MSG_CAP) return ids.slice(ids.length - CHAT_MSG_CAP);
    return ids;
}

// A stored id counts only when that global_chat doc is still there, its uid
// is the claimant, and the same filter still accepts it. A deleted, hidden,
// or moderated message does not. A stamp with no surviving id does not.
function chatRequirementMet(user, rows) {
    const ids = chatMsgIdsOf(claimReqOf(user));
    if (!ids.length || !user || !user.uid) return false;
    const list = Array.isArray(rows) ? rows : [];
    return ids.some(function (id) {
        const row = list.filter(function (item) { return item && item.id === id; })[0];
        if (!row || row.exists !== true || !row.data) return false;
        if (row.data.uid !== user.uid) return false;
        return chatQualifies(row.data);
    });
}

function tctvQualifies(seconds) {
    const n = Math.floor(Number(seconds));
    return Number.isFinite(n) && n >= MIN_TCTV_SECONDS;
}

module.exports = {
    CLAIM_REQS_START_ISO: CLAIM_REQS_START_ISO,
    CLAIM_REQS_START: CLAIM_REQS_START,
    CLAIM_REQS_START_UNSET_ISO: CLAIM_REQS_START_UNSET_ISO,
    MIN_CHAT_CHARS: MIN_CHAT_CHARS,
    MIN_TCTV_SECONDS: MIN_TCTV_SECONDS,
    CHAT_MSG_CAP: CHAT_MSG_CAP,
    ITEM_LABEL: ITEM_LABEL,
    stampMillis: stampMillis,
    isExempt: isExempt,
    missingItems: missingItems,
    missingError: missingError,
    chatQualifies: chatQualifies,
    normalizeChatMsgId: normalizeChatMsgId,
    chatMsgIdsOf: chatMsgIdsOf,
    nextChatMsgIds: nextChatMsgIds,
    chatRequirementMet: chatRequirementMet,
    tctvQualifies: tctvQualifies,
};
