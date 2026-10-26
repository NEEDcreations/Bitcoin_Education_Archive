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
// clock and the next one is the first credit. referralAt: the referral
// link was opened from a different device and a different network than
// the ones already known for that player. IPv6 networks are the /64.
// When the player has both an IPv4 and an IPv6 baseline, either one is
// the same household.

const { classifyChatText } = require('./chatProfanity');
const tctvWatch = require('./tctvWatch');
const {
    meaningfulLength,
    extractSayHiText,
    withoutRemovedLinks,
    isSpamRepeat,
} = require('./sayHi');

const CLAIM_REQS_START_ISO = '2026-10-26T21:00:00.000Z';
const CLAIM_REQS_START = Date.parse(CLAIM_REQS_START_ISO);
const MIN_CHAT_CHARS = 3;
const MIN_TCTV_SECONDS = tctvWatch.CREDIT_SECONDS;
const VISIT_GAP_MS = 2000;
const VISIT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const VISIT_HOUR_MS = 60 * 60 * 1000;
const VISIT_IP_MAX = 20;
const VISIT_CODE_MAX = 40;
const KNOWN_CAP = 20;
const CHAT_MSG_CAP = 5;

const ITEM_LABEL = {
    chat: 'send 1 chat message',
    tctv: 'watch Timechain TV for ' + MIN_TCTV_SECONDS + ' seconds',
    referral: 'get one visit on your referral link from another device and network',
};

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const PHONE_RE = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;
const HMAC_RE = /^[a-f0-9]{64}$/;

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
    if (!stampMillis(req.referralAt)) missing.push('referral');
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

function normalizeHmacList(list) {
    const out = [];
    const raw = Array.isArray(list) ? list : [];
    raw.forEach(function (item) {
        const value = String(item || '').trim().toLowerCase();
        if (!HMAC_RE.test(value)) return;
        if (out.indexOf(value) === -1) out.push(value);
    });
    return out;
}

function nextKnownHmacs(existing, extra) {
    const list = normalizeHmacList(existing);
    normalizeHmacList(extra == null ? [] : [extra]).forEach(function (item) {
        if (list.indexOf(item) === -1) list.push(item);
    });
    if (list.length > KNOWN_CAP) return list.slice(list.length - KNOWN_CAP);
    return list;
}

function collectOwnerHmacs(user, extras) {
    const src = extras || {};
    const req = claimReqOf(user);
    return {
        deviceHmacs: nextKnownHmacs(normalizeHmacList(req.deviceHmacs).concat(normalizeHmacList(src.deviceHmacs)), null).slice(0, KNOWN_CAP),
        ipHmacs: nextKnownHmacs(
            normalizeHmacList(req.ipHmacs)
                .concat(normalizeHmacList(req.v4Hmacs))
                .concat(normalizeHmacList(req.v6Hmacs))
                .concat(normalizeHmacList(src.ipHmacs))
                .concat(normalizeHmacList(user && user.ipHashes))
                .concat(normalizeHmacList(user && user.ipHash ? [user.ipHash] : [])),
            null
        ).slice(0, KNOWN_CAP),
    };
}

// Keeps the IPv4 and IPv6 network HMACs the owner has already shown.
// A later visit is the same household when it matches either family.
function rememberFamilyHmacs(existing, records) {
    const src = existing && typeof existing === 'object' ? existing : {};
    const v4 = normalizeHmacList(src.v4Hmacs || src.v4);
    const v6 = normalizeHmacList(src.v6Hmacs || src.v6);
    (Array.isArray(records) ? records : []).forEach(function (rec) {
        const hmac = String(rec && rec.hmac || '').trim().toLowerCase();
        if (!HMAC_RE.test(hmac)) return;
        const list = rec.version === 6 ? v6 : (rec.version === 4 ? v4 : null);
        if (!list || list.indexOf(hmac) !== -1) return;
        list.push(hmac);
    });
    const v4capped = v4.slice(-KNOWN_CAP);
    const v6capped = v6.slice(-KNOWN_CAP);
    return {
        v4: v4capped,
        v6: v6capped,
        ipHmacs: nextKnownHmacs(v4capped.concat(v6capped), null),
    };
}

// count is true only when the visit device and the visit IP are both
// outside the player's known sets, and both sets already have a baseline.
// The IP set is every stored network, so an IPv4 baseline and an IPv6
// baseline both count as this household. The player's own signed-in call
// never counts. It only records the device and network HMACs.
function assessReferralVisit(input) {
    const src = input || {};
    const visitDevice = String(src.visitDeviceHmac || '').trim().toLowerCase();
    const visitIp = String(src.visitIpHmac || '').trim().toLowerCase();
    if (!HMAC_RE.test(visitDevice) || !HMAC_RE.test(visitIp)) {
        return { count: false, remember: false, reason: 'missing' };
    }
    const devices = normalizeHmacList(src.ownerDeviceHmacs);
    const ips = normalizeHmacList(src.ownerIpHmacs);
    if (src.callerIsOwner === true) {
        return { count: false, remember: true, reason: 'owner' };
    }
    const sameDevice = devices.indexOf(visitDevice) !== -1;
    const sameIp = ips.indexOf(visitIp) !== -1;
    if (sameDevice || sameIp) {
        let reason = 'same-ip';
        if (sameDevice && sameIp) reason = 'same-device-ip';
        else if (sameDevice) reason = 'same-device';
        return { count: false, remember: false, reason: reason };
    }
    if (!devices.length || !ips.length) {
        return { count: false, remember: false, reason: 'no-baseline' };
    }
    return { count: true, remember: false, reason: 'counted' };
}

function visitRateDecision(prev, nowMs, maxPerHour) {
    const src = prev || {};
    const now = Math.floor(Number(nowMs) || 0);
    const last = Number(src.lastMs) || 0;
    const windowStart = Number(src.windowStart) || 0;
    const count = Number(src.count) || 0;
    const max = Math.floor(Number(maxPerHour) || VISIT_IP_MAX);
    if (!now) return { ok: false, reason: 'rate' };
    if (last && now >= last && now - last < VISIT_GAP_MS) return { ok: false, reason: 'rate' };
    const same = windowStart && now >= windowStart && now - windowStart < VISIT_HOUR_MS;
    if (same && count >= max) return { ok: false, reason: 'rate-hour' };
    return {
        ok: true,
        lastMs: now,
        windowStart: same ? windowStart : now,
        count: same ? count + 1 : 1,
    };
}

module.exports = {
    CLAIM_REQS_START_ISO: CLAIM_REQS_START_ISO,
    CLAIM_REQS_START: CLAIM_REQS_START,
    MIN_CHAT_CHARS: MIN_CHAT_CHARS,
    MIN_TCTV_SECONDS: MIN_TCTV_SECONDS,
    VISIT_TTL_MS: VISIT_TTL_MS,
    VISIT_GAP_MS: VISIT_GAP_MS,
    VISIT_HOUR_MS: VISIT_HOUR_MS,
    VISIT_IP_MAX: VISIT_IP_MAX,
    VISIT_CODE_MAX: VISIT_CODE_MAX,
    KNOWN_CAP: KNOWN_CAP,
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
    normalizeHmacList: normalizeHmacList,
    nextKnownHmacs: nextKnownHmacs,
    collectOwnerHmacs: collectOwnerHmacs,
    rememberFamilyHmacs: rememberFamilyHmacs,
    assessReferralVisit: assessReferralVisit,
    visitRateDecision: visitRateDecision,
};
