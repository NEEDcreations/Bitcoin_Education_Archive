'use strict';

// One Telegram copy of each GGs (announcements) and global chat message.
// An onCreate trigger per collection claims telegram_mirror_claims/{collection}__{docId}
// before queueing. A retry sees the claim and does not enqueue again.
// The queue drains at about 20 Telegram sends per minute. A burst that fits
// in one message is sent together instead of being dropped. 429s stay queued
// and retry with backoff.
//
// The send uses the same bot token and chat id as workers/chat-bridge
// (TG_BOT_TOKEN, TG_CHAT_ID, falling back to the chat id in wrangler.toml).
// The token is never logged. Images are a public https link or "[image]";
// nothing is re-uploaded.

const { toTelegramText, redactForLog } = require('./telegramBridge');
const { moderationBlock } = require('./topicDiscussion');
const { moderateText } = require('./moderateText');

const QUEUE = 'telegram_mirror_queue';
const CLAIMS = 'telegram_mirror_claims';
const STATE = 'telegram_mirror_state';
const STATE_ID = 'group';

const DEFAULT_CHAT_ID = '-1003827558565';
const MAX_SENDS_PER_MINUTE = 20;
const WINDOW_MS = 60 * 1000;
const MAX_BATCH_CHARS = 3500;
// Each queued line is read and written twice in one transaction (queue row
// and source chat doc). Stay under Firestore's 500-op transaction cap.
const MAX_BATCH_ITEMS = 30;
const DUE_LIMIT = 30;
const SEND_TIMEOUT_MS = 10 * 1000;
// Longer than the send timeout so a slow call is aborted before the lease
// expires and a second worker sends the same batch.
const SENDING_LEASE_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;
// A wrong token or a missing chat is an outage, not a bad line. Hold those
// forever and cap the wait so a long outage does not spin the queue.
const CHAT_HOLD_MAX_MS = 5 * 60 * 1000;
const USER_GAP_MS = 3 * 1000;
const USER_MAX_PER_MINUTE = 10;
const RETAIN_MS = 7 * 24 * 60 * 60 * 1000;
const BODY_LIMIT = 1000;

const SOURCE_TAG = {
    global_chat: 'Global',
    announcements: 'GGs',
};

const PRIVATE_KIND = {
    dm: 1,
    admin: 1,
    ops: 1,
    internal: 1,
    alert: 1,
    admin_only: 1,
};

function claimId(collection, docId) {
    const col = String(collection || '').replace(/[^A-Za-z0-9_-]/g, '');
    const id = String(docId || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 180);
    if (!col || !id) return '';
    return col + '__' + id;
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function neutralizePings(value) {
    return String(value == null ? '' : value)
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/@(everyone|here|channel|all)\b/gi, '$1');
}

function stripContacts(value) {
    return String(value == null ? '' : value)
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ')
        .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, ' ')
        .replace(/\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4}\b/g, ' ');
}

function stripUid(value, uid) {
    const id = String(uid || '');
    if (id.length < 6 || id === 'nacho-bot' || id === 'system') return String(value == null ? '' : value);
    return String(value == null ? '' : value).split(id).join(' ');
}

function collapseSpace(value) {
    return String(value == null ? '' : value).replace(/[ \t]{2,}/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

function isPublicHttps(raw) {
    const url = String(raw || '').trim();
    if (!/^https:\/\/[^\s<>"']+$/i.test(url)) return false;
    if (url.length > 300) return false;
    if (/api\.telegram\.org/i.test(url)) return false;
    if (/\/bot\d+:/i.test(url)) return false;
    if (/[?&](token|sig|signature|x-goog|auth)=/i.test(url)) return false;
    try {
        const host = new URL(url).hostname;
        if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return false;
    } catch (err) {
        return false;
    }
    return true;
}

function attachmentNote(data) {
    const src = data || {};
    const has = !!(src.imageUrl || src.gifUrl || src.imageBase64 || src.attachmentUrl || src.stickerUrl || src.isGif === true);
    if (!has) return '';
    const candidates = [src.imageUrl, src.gifUrl, src.attachmentUrl];
    if (src.isGif === true && /^https:\/\//i.test(String(src.text || ''))) candidates.unshift(src.text);
    for (let i = 0; i < candidates.length; i++) {
        if (isPublicHttps(candidates[i])) return String(candidates[i]).trim();
    }
    return '[image]';
}

// RLO and the other bidi controls would show \u202Ekcuf as the reversed word.
function stripBidi(text) {
    return String(text || '').replace(/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');
}

// Invisible characters can split an email, IP or uid so the contact and uid
// passes miss it. Drop them first, then run those passes.
function stripInvisible(text) {
    return stripBidi(text).replace(/[\u00AD\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200D\u2060-\u2064\u3164\uFEFF\uFFA0]|[\u{E0000}-\u{E0FFF}]/gu, '');
}

// One chat message is one Telegram line. A line break inside a message would
// start a new line that looks like another sender, such as [GGs] 🦌 Nacho.
function flattenLines(text) {
    return String(text || '').replace(/[\r\n\u000B\u000C\u0085\u2028\u2029]+/g, ' ');
}

function visibleBody(data, note) {
    const src = data || {};
    let text = src.caption && (src.isGif === true || src.imageUrl || src.gifUrl)
        ? toTelegramText(src.caption)
        : toTelegramText(src.text || '');
    text = stripInvisible(text);
    text = neutralizePings(stripContacts(stripUid(stripUid(text, src.uid), src.mentionUid)));
    // A short label spliced into a word is not part of the word: fu[x](url)ck
    // is the same word as the letters around it. Other links keep their label.
    text = text.replace(/(\p{L})\[[^\]]{1,3}\]\((?:https?:\/\/|mailto:|javascript:)[^)]*\)(?=\p{L})/giu, '$1');
    text = text.replace(/\[([^\]]+)\]\((?:https?:\/\/|mailto:|javascript:)[^)]*\)/gi, '$1');
    text = text.replace(/[`]/g, '');
    text = stripBidi(text);
    if (note && note !== '[image]' && collapseSpace(text) === note) text = '';
    if (note === '[image]' && /^https?:\/\//i.test(collapseSpace(text))) text = '';
    if (note === '[image]' && text.length > 80 && text.indexOf(' ') === -1) text = '';
    text = clipUnits(collapseSpace(text), BODY_LIMIT);
    const extra = note ? String(note) : '';
    return clipUnits(collapseSpace([text, extra].filter(Boolean).join(' ')), BODY_LIMIT);
}

function graphemeParts(text) {
    const s = String(text || '');
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
        const parts = [];
        const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        const iter = seg.segment(s);
        for (const part of iter) parts.push(part.segment);
        return parts;
    }
    return Array.from(s);
}

function dropDanglingSurrogate(text) {
    const s = String(text || '');
    if (!s) return '';
    const last = s.charCodeAt(s.length - 1);
    if (last >= 0xD800 && last <= 0xDBFF) return s.slice(0, -1);
    return s;
}

// Keep whole graphemes. A cut never ends on a high surrogate or half an emoji.
function clipUnits(text, maxUnits) {
    const s = String(text || '');
    const max = Number(maxUnits) || 0;
    if (max <= 0) return '';
    if (s.length <= max) return dropDanglingSurrogate(s);
    const parts = graphemeParts(s);
    let out = '';
    for (let i = 0; i < parts.length; i++) {
        if (out.length + parts[i].length > max) break;
        out += parts[i];
    }
    return dropDanglingSurrogate(out);
}

function mirrorName(data) {
    const src = data || {};
    if (src.uid === 'nacho-bot') return '🦌 Nacho';
    let name = stripContacts(neutralizePings(flattenLines(stripInvisible(toTelegramText(src.name || src.username || '')))));
    name = name.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!name || (src.uid && name === String(src.uid))) return 'Someone';
    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(name)) return 'Someone';
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(name)) return 'Someone';
    return name;
}

function isPrivate(data) {
    const src = data || {};
    if (src.adminOnly === true || src.opsOnly === true || src.internal === true || src.isInternal === true) return true;
    if (src.alert === true || src.isAlert === true || src.dm === true || src.isDm === true) return true;
    const kind = String(src.channel || src.kind || src.audience || src.visibility || '').toLowerCase();
    if (PRIVATE_KIND[kind]) return true;
    const type = String(src.type || '').toLowerCase();
    if (PRIVATE_KIND[type]) return true;
    return false;
}

function isFavorMirrorPost(data) {
    const text = String((data && data.text) || '');
    if (text.indexOf('⛏️ BLOCK FOUND!') === 0) return true;
    if (/^⛏️ EPOCH #\d+ COMPLETE!/.test(text)) return true;
    return false;
}

function isNachoTwin(collection, data) {
    if (collection !== 'announcements') return false;
    const src = data || {};
    if (src.uid !== 'nacho-bot') return false;
    return isFavorMirrorPost(src);
}

// In-app Favor lines keep @Name. Telegram treats that as an account link,
// so the mirror copy of these posts drops only that leading @.
function dropFavorNameAt(text) {
    return String(text || '').replace(/(^|\s)@([A-Za-z0-9_\-.]{3,20})(?![A-Za-z0-9_\-.])/g, '$1$2');
}

function removedForTelegram(data) {
    const src = data || {};
    if (src.deleted === true || src.uid === 'deleted') return true;
    if (src.hidden === true) return true;
    if (src.flagged === true || src.moderated === true || src.spam === true) return true;
    if (src.moderationRejected === true || src.filterRejected === true || src.rejected === true) return true;
    return false;
}

function messageSkipReason(data, collection) {
    const src = data || {};
    const source = String(src.source || src.bridgedFrom || '').toLowerCase();
    if (source === 'telegram' || src.fromTelegram === true) return 'telegram';
    if (src.telegramMirrored === true || src.telegramMsgId) return 'already_mirrored';
    if (isNachoTwin(collection, src)) return 'duplicate';
    if (src.deleted === true || src.uid === 'deleted') return 'deleted';
    if (src.hidden === true) return 'hidden';
    if (src.flagged === true || src.moderated === true || src.spam === true) return 'moderated';
    if (src.moderationRejected === true || src.filterRejected === true || src.rejected === true) return 'moderated';
    if (src.shadowbanned === true || src.shadowBan === true || src.isShadowbanned === true || src.shadowBanned === true) return 'shadowbanned';
    if (isPrivate(src)) return 'private';
    return '';
}

function contentSkipReason(body) {
    const result = moderateText(body, { strict: true });
    if (result.clean) return '';
    if (result.reason === 'Content contains potential scam patterns') return 'scam';
    return 'profanity';
}

// The name Telegram would show. A username that fails the same strict
// filter is replaced. Nacho's own label is not a player username.
function publicMirrorName(data) {
    const name = mirrorName(data);
    if (!name || name === '🦌 Nacho' || name === 'Someone' || name === 'A player') return name;
    const hit = moderateText(name, { strict: true });
    if (!hit.clean) return 'A player';
    return name;
}

function rateLimitedUid(uid) {
    const id = String(uid || '');
    if (!id || id === 'nacho-bot' || id === 'system' || id === 'deleted') return false;
    return true;
}

function rateDocId(uid) {
    return 'rate_' + String(uid || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
}

function rateDecision(recentAtMs, nowMs) {
    const now = Number(nowMs) || 0;
    const recent = (recentAtMs || []).map(Number).filter(function (ts) {
        return Number.isFinite(ts) && now - ts < WINDOW_MS && now - ts >= 0;
    });
    const last = recent.reduce(function (max, ts) { return Math.max(max, ts); }, 0);
    if (last && now - last < USER_GAP_MS) return { ok: false, recent: recent };
    if (recent.length >= USER_MAX_PER_MINUTE) return { ok: false, recent: recent };
    recent.push(now);
    return { ok: true, recent: recent };
}

function retentionFields(nowMs) {
    const at = Number(nowMs) || Date.now();
    return {
        expireAtMs: at + RETAIN_MS,
        expireAt: new Date(at + RETAIN_MS),
    };
}

function userSkipReason(user, nowMs) {
    const u = user || null;
    if (!u) return '';
    if (u.flagged === true || u.moderated === true || u.spam === true || u.moderationRejected === true) return 'moderated';
    if (u.shadowbanned === true || u.shadowBan === true || u.isShadowbanned === true || u.shadowBanned === true) return 'shadowbanned';
    if (u.blocked === true || u.isBlocked === true || u.chatBlocked === true) return 'blocked';
    const block = moderationBlock(u, u.ledger || null, nowMs);
    if (block) return block;
    return '';
}

function decideMirror(input) {
    const opts = input || {};
    const collection = String(opts.collection || '');
    const data = opts.data || null;
    if (!data || typeof data !== 'object') return { forward: false, reason: 'empty' };
    if (!SOURCE_TAG[collection]) return { forward: false, reason: 'collection' };
    const messageReason = messageSkipReason(data, collection);
    if (messageReason) return { forward: false, reason: messageReason };
    const userReason = userSkipReason(opts.user, opts.nowMs || Date.now());
    if (userReason) return { forward: false, reason: userReason };
    const note = attachmentNote(data);
    const body = visibleBody(data, note);
    if (!body) return { forward: false, reason: 'empty' };
    // Filtered with its line breaks (fu\nck is one word) and without them
    // (send 0.01 btc\nto bc1q is one phrase), then sent as one line.
    const flatBody = collapseSpace(flattenLines(body));
    const contentReason = contentSkipReason(body) || contentSkipReason(flatBody);
    if (contentReason) return { forward: false, reason: contentReason };
    const name = publicMirrorName(data);
    const flat = isFavorMirrorPost(data) ? dropFavorNameAt(flatBody) : flatBody;
    const line = '[' + SOURCE_TAG[collection] + '] ' + name + ': ' + flat;
    return { forward: true, reason: '', line: escapeHtml(line), name: name };
}

function clipLine(line) {
    const text = String(line || '');
    if (text.length <= MAX_BATCH_CHARS) return dropDanglingSurrogate(text);
    let cut = clipUnits(text, MAX_BATCH_CHARS - 1);
    const amp = cut.lastIndexOf('&');
    if (amp > cut.length - 10) cut = cut.slice(0, amp);
    return cut + '…';
}

function recentSends(sentAtMs, nowMs) {
    const now = Number(nowMs) || 0;
    return (sentAtMs || []).filter(function (ts) { return now - Number(ts) < WINDOW_MS; });
}

function itemDue(item, nowMs) {
    const row = item || {};
    const at = Number(row.nextAttemptAt) || 0;
    if (row.status === 'pending') return at <= nowMs;
    if (row.status === 'sending') return (Number(row.sendingAt) || 0) < nowMs - SENDING_LEASE_MS;
    return false;
}

function planBatch(items, sentAtMs, nowMs) {
    const now = Number(nowMs) || 0;
    const recent = recentSends(sentAtMs, now);
    const due = (items || []).filter(function (item) { return itemDue(item, now); });
    due.sort(function (a, b) { return (Number(a.createdAtMs) || 0) - (Number(b.createdAtMs) || 0); });
    if (recent.length >= MAX_SENDS_PER_MINUTE) {
        const oldest = recent.reduce(function (min, ts) { return Math.min(min, Number(ts)); }, now);
        return { items: [], ids: [], text: '', waitUntil: oldest + WINDOW_MS, recent: recent };
    }
    const picked = [];
    let len = 0;
    for (let i = 0; i < due.length; i++) {
        const line = clipLine(due[i].line);
        if (!line) continue;
        const add = line.length + (picked.length ? 1 : 0);
        if (picked.length && (len + add > MAX_BATCH_CHARS || picked.length >= MAX_BATCH_ITEMS)) break;
        picked.push(Object.assign({}, due[i], { line: line }));
        len += add;
    }
    return {
        items: picked,
        ids: picked.map(function (item) { return item.id; }),
        text: picked.map(function (item) { return item.line; }).join('\n'),
        waitUntil: picked.length ? 0 : 0,
        recent: recent,
    };
}

function backoffMs(attempt, retryAfterSec) {
    const fromHeader = Math.max(0, Number(retryAfterSec) || 0) * 1000;
    const exp = Math.min(WINDOW_MS, 1000 * Math.pow(2, Math.min(Number(attempt) || 0, 6)));
    return Math.max(fromHeader, exp, 1000);
}

function chatHoldMs(attempt) {
    const exp = 1000 * Math.pow(2, Math.min(Number(attempt) || 0, 9));
    return Math.min(CHAT_HOLD_MAX_MS, Math.max(exp, 1000));
}

function logChatHold(status) {
    const code = Number(status) || 0;
    console.error('[TG MIRROR] hold ' + code);
}

function defaultFetchImpl() {
    try {
        return require('node-fetch');
    } catch (err) {
        if (typeof fetch === 'function') return fetch;
        throw err;
    }
}

async function sendTelegramText(text, options) {
    const opts = options || {};
    const env = opts.env || process.env;
    const token = opts.token != null ? opts.token : (env.TG_BOT_TOKEN || '');
    const chatId = opts.chatId || env.TG_CHAT_ID || DEFAULT_CHAT_ID;
    if (!token) return { ok: false, error: 'not_configured', retry: true };
    if (!text) return { ok: false, error: 'empty', retry: false };
    const fetchImpl = opts.fetch || defaultFetchImpl();
    const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : SEND_TIMEOUT_MS;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timer = null;
    let resp;
    try {
        if (controller) timer = setTimeout(function () { controller.abort(); }, timeoutMs);
        const init = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: String(chatId),
                text: text,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            }),
        };
        if (controller) init.signal = controller.signal;
        resp = await fetchImpl('https://api.telegram.org/bot' + token + '/sendMessage', init);
    } catch (err) {
        const aborted = !!(err && (err.name === 'AbortError' || /abort/i.test(String(err && err.message || ''))));
        return { ok: false, error: aborted ? 'timeout' : 'request_failed', retry: true };
    } finally {
        if (timer) clearTimeout(timer);
    }
    let json = null;
    try {
        json = resp && resp.json ? await resp.json() : null;
    } catch (parseErr) {
        json = null;
    }
    const status = resp && resp.status ? resp.status : 0;
    if (status === 429 || (json && json.error_code === 429)) {
        const retryAfter = json && json.parameters ? json.parameters.retry_after : 0;
        return { ok: false, error: 'rate_limit', status: 429, retryAfter: Number(retryAfter) || 0, retry: true };
    }
    if (!resp || !resp.ok || !json || json.ok === false) {
        const description = json && json.description ? String(json.description).slice(0, 180) : '';
        const chatLevel = status === 401 || status === 403 || (status === 400 && /chat not found/i.test(description));
        const retry = chatLevel || status === 0 || status >= 500;
        return { ok: false, error: 'http', status: status, description: description, chatLevel: chatLevel, retry: retry };
    }
    const messageId = json.result && json.result.message_id;
    const resultChat = json.result && json.result.chat && json.result.chat.id;
    return {
        ok: true,
        telegramMsgId: messageId != null ? String(messageId) : '',
        chatId: resultChat != null ? String(resultChat) : String(chatId),
    };
}

function queuePayload(collection, docId, line, nowMs, uid) {
    return Object.assign({
        status: 'pending',
        collection: collection,
        docId: String(docId),
        uid: uid || '',
        line: line,
        createdAtMs: nowMs,
        attempts: 0,
        nextAttemptAt: nowMs,
    }, retentionFields(nowMs));
}

async function enqueueChatMirror(db, collection, docId, data, user, nowMs) {
    const at = Number(nowMs) || Date.now();
    const id = claimId(collection, docId);
    if (!id) return { queued: false, reason: 'id' };
    const decision = decideMirror({ collection: collection, data: data, user: user, nowMs: at });
    const claimRef = db.collection(CLAIMS).doc(id);
    const queueRef = db.collection(QUEUE).doc(id);
    const uid = data && data.uid ? String(data.uid) : '';
    const rateRef = rateLimitedUid(uid) ? db.collection(STATE).doc(rateDocId(uid)) : null;
    return db.runTransaction(async function (tx) {
        const claimSnap = await tx.get(claimRef);
        if (claimSnap && claimSnap.exists) return { queued: false, reason: 'claimed' };
        const rateSnap = rateRef ? await tx.get(rateRef) : null;
        let rate = null;
        if (rateRef) {
            const prev = rateSnap && rateSnap.exists ? (rateSnap.data() || {}) : {};
            rate = rateDecision(prev.recentAtMs, at);
        }
        if (!decision.forward || (rate && !rate.ok)) {
            const reason = !decision.forward ? decision.reason : 'rate';
            tx.set(claimRef, Object.assign({
                status: 'skipped', reason: reason, at: at, uid: uid,
            }, retentionFields(at)));
            return { queued: false, reason: reason };
        }
        if (rateRef && rate && rate.ok) {
            tx.set(rateRef, Object.assign({
                uid: uid,
                recentAtMs: rate.recent,
            }, retentionFields(at)));
        }
        tx.set(claimRef, Object.assign({ status: 'queued', at: at, uid: uid }, retentionFields(at)));
        tx.set(queueRef, queuePayload(collection, docId, decision.line, at, uid));
        return { queued: true, id: id };
    });
}

async function loadMirrorUser(db, data) {
    const uid = data && data.uid ? String(data.uid) : '';
    if (!uid || uid === 'nacho-bot' || uid === 'system' || uid === 'deleted') return null;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return null;
    const snap = await db.collection('users').doc(uid).get();
    const user = snap && snap.exists ? (snap.data() || {}) : null;
    let ledger = null;
    try {
        const ledgerSnap = await db.collection('faucet_ledger').doc(uid).get();
        if (ledgerSnap && ledgerSnap.exists) ledger = ledgerSnap.data() || {};
    } catch (err) {
        ledger = null;
    }
    if (!user && !ledger) return null;
    return Object.assign({}, user || {}, { ledger: ledger });
}

function rowsOf(snap) {
    const out = [];
    if (!snap) return out;
    if (typeof snap.forEach === 'function') {
        snap.forEach(function (doc) {
            out.push({ id: doc.id, data: doc.data() || {} });
        });
        return out;
    }
    (snap.docs || []).forEach(function (doc) {
        out.push({ id: doc.id, data: doc.data() || {} });
    });
    return out;
}

function queryRows(snap) {
    return rowsOf(snap).map(function (row) {
        return Object.assign({ id: row.id }, row.data);
    });
}

// One indexed page of due pending rows. The cron also recovers a small
// page of expired sending leases. Inline creates do not scan the queue twice.
async function readDue(db, nowMs) {
    let query = db.collection(QUEUE).where('status', '==', 'pending');
    if (typeof query.where === 'function') query = query.where('nextAttemptAt', '<=', nowMs);
    if (typeof query.orderBy === 'function') query = query.orderBy('nextAttemptAt', 'asc');
    if (typeof query.limit === 'function') query = query.limit(DUE_LIMIT);
    const snap = await query.get();
    return queryRows(snap);
}

async function readExpiredSending(db, nowMs) {
    const cutoff = nowMs - SENDING_LEASE_MS;
    let query = db.collection(QUEUE).where('status', '==', 'sending');
    if (typeof query.where === 'function') query = query.where('sendingAt', '<', cutoff);
    if (typeof query.orderBy === 'function') query = query.orderBy('sendingAt', 'asc');
    if (typeof query.limit === 'function') query = query.limit(10);
    const snap = await query.get();
    return queryRows(snap).filter(function (item) { return itemDue(item, nowMs); });
}

async function readState(db) {
    const snap = await db.collection(STATE).doc(STATE_ID).get();
    if (!snap || !snap.exists) return { sentAtMs: [] };
    const data = snap.data() || {};
    return { sentAtMs: Array.isArray(data.sentAtMs) ? data.sentAtMs.slice() : [] };
}

function mergePatch(existing, patch) {
    return Object.assign({}, existing || {}, patch || {});
}

async function patchDocs(db, patches) {
    if (!patches.length) return;
    await db.runTransaction(async function (tx) {
        const snaps = [];
        for (let i = 0; i < patches.length; i++) {
            snaps.push(await tx.get(patches[i].ref));
        }
        for (let i = 0; i < patches.length; i++) {
            const snap = snaps[i];
            if (!snap || !snap.exists) continue;
            const next = mergePatch(snap.data() || {}, patches[i].patch);
            if (typeof tx.update === 'function') tx.update(patches[i].ref, patches[i].patch);
            else tx.set(patches[i].ref, next);
        }
    });
}

function leaseStamp(options) {
    const opts = options || {};
    if (typeof opts.clock === 'function') {
        const n = Number(opts.clock());
        if (Number.isFinite(n)) return n;
    }
    return Date.now();
}

function groupWait(recent, nowMs) {
    const oldest = recent.reduce(function (min, ts) { return Math.min(min, Number(ts)); }, nowMs);
    return oldest + WINDOW_MS;
}

async function reserveSendSlot(db, nowMs) {
    const stateRef = db.collection(STATE).doc(STATE_ID);
    let outcome = { ok: true, waitUntil: 0 };
    await db.runTransaction(async function (tx) {
        outcome = { ok: true, waitUntil: 0 };
        const stateSnap = await tx.get(stateRef);
        const prev = stateSnap && stateSnap.exists ? (stateSnap.data() || {}) : {};
        const recent = recentSends(prev.sentAtMs, nowMs);
        if (recent.length >= MAX_SENDS_PER_MINUTE) {
            outcome = { ok: false, waitUntil: groupWait(recent, nowMs) };
            return;
        }
        recent.push(nowMs);
        tx.set(stateRef, Object.assign({
            sentAtMs: recent.slice(-MAX_SENDS_PER_MINUTE),
        }, retentionFields(nowMs)));
    });
    return outcome;
}

async function releaseSendSlot(db, nowMs) {
    const stateRef = db.collection(STATE).doc(STATE_ID);
    await db.runTransaction(async function (tx) {
        const stateSnap = await tx.get(stateRef);
        const prev = stateSnap && stateSnap.exists ? (stateSnap.data() || {}) : {};
        const sent = Array.isArray(prev.sentAtMs) ? prev.sentAtMs.slice() : [];
        const idx = sent.lastIndexOf(nowMs);
        if (idx !== -1) sent.splice(idx, 1);
        const nextState = Object.assign({
            sentAtMs: sent.slice(-MAX_SENDS_PER_MINUTE),
        }, retentionFields(nowMs));
        if (typeof tx.set === 'function') tx.set(stateRef, nextState);
    });
}

async function touchLease(db, items, stamp) {
    if (!items || !items.length) return;
    await patchDocs(db, items.map(function (item) {
        return {
            ref: db.collection(QUEUE).doc(item.id),
            patch: { status: 'sending', sendingAt: stamp },
        };
    }));
}

async function claimSending(db, plan, nowMs) {
    const refs = plan.items.map(function (item) { return db.collection(QUEUE).doc(item.id); });
    const stateRef = db.collection(STATE).doc(STATE_ID);
    let outcome = { ok: true, waitUntil: 0 };
    await db.runTransaction(async function (tx) {
        outcome = { ok: true, waitUntil: 0 };
        const snaps = [];
        for (let i = 0; i < refs.length; i++) snaps.push(await tx.get(refs[i]));
        const stateSnap = await tx.get(stateRef);
        for (let i = 0; i < snaps.length; i++) {
            const data = snaps[i] && snaps[i].exists ? (snaps[i].data() || {}) : null;
            if (!data || !itemDue(Object.assign({ id: plan.ids[i] }, data), nowMs)) {
                throw new Error('conflict');
            }
        }
        const prev = stateSnap && stateSnap.exists ? (stateSnap.data() || {}) : {};
        const recent = recentSends(prev.sentAtMs, nowMs);
        if (recent.length >= MAX_SENDS_PER_MINUTE) {
            outcome = { ok: false, waitUntil: groupWait(recent, nowMs) };
            return;
        }
        recent.push(nowMs);
        tx.set(stateRef, Object.assign({
            sentAtMs: recent.slice(-MAX_SENDS_PER_MINUTE),
        }, retentionFields(nowMs)));
        for (let i = 0; i < refs.length; i++) {
            const patch = { status: 'sending', sendingAt: nowMs };
            if (typeof tx.update === 'function') tx.update(refs[i], patch);
            else tx.set(refs[i], mergePatch(snaps[i].data() || {}, patch));
        }
    });
    return outcome;
}

async function dropBlocked(db, plan, nowMs) {
    const keep = [];
    const drop = [];
    for (let i = 0; i < plan.items.length; i++) {
        const item = plan.items[i];
        if (!SOURCE_TAG[item.collection]) {
            drop.push(item);
            continue;
        }
        const snap = await db.collection(item.collection).doc(item.docId).get();
        if (!snap || !snap.exists) {
            drop.push(item);
            continue;
        }
        const data = snap.data() || {};
        const user = await loadMirrorUser(db, data);
        const decision = decideMirror({
            collection: item.collection,
            data: data,
            user: user,
            nowMs: nowMs,
        });
        if (!decision.forward) drop.push(item);
        else keep.push(Object.assign({}, item, { line: clipLine(decision.line) }));
    }
    if (drop.length) {
        await patchDocs(db, drop.map(function (item) {
            return {
                ref: db.collection(QUEUE).doc(item.id),
                patch: { status: 'skipped', reason: 'blocked', nextAttemptAt: nowMs },
            };
        }));
    }
    return {
        items: keep,
        ids: keep.map(function (item) { return item.id; }),
        text: keep.map(function (item) { return item.line; }).join('\n'),
    };
}

function isChatLevel(result) {
    if (!result) return false;
    const status = Number(result.status) || 0;
    if (status === 401 || status === 403) return true;
    if (status === 400 && /chat not found/i.test(String(result.description || ''))) return true;
    return false;
}

function isPermanentHttp(result) {
    if (isChatLevel(result)) return false;
    const status = Number(result && result.status) || 0;
    return status >= 400 && status < 500 && status !== 429;
}

function attemptCount(item) {
    return (Number(item && item.attempts) || 0) + 1;
}

function shouldFailItem(item, result) {
    if (isChatLevel(result)) return false;
    if (isPermanentHttp(result)) return true;
    return attemptCount(item) >= MAX_ATTEMPTS;
}

async function stampSent(db, items, result, nowMs) {
    const single = items.length === 1;
    const patches = items.map(function (item) {
        const patch = {
            status: 'sent',
            sentAtMs: nowMs,
        };
        if (single) {
            patch.telegramMsgId = result.telegramMsgId || '';
            patch.telegramChatId = result.chatId || '';
        } else {
            patch.telegramBatched = true;
        }
        return { ref: db.collection(QUEUE).doc(item.id), patch: patch };
    });
    items.forEach(function (item) {
        if (!SOURCE_TAG[item.collection]) return;
        const patch = { telegramMirrored: true };
        if (single) {
            patch.telegramMsgId = result.telegramMsgId || '';
            patch.telegramChatId = result.chatId || '';
        } else {
            patch.telegramBatched = true;
        }
        patches.push({
            ref: db.collection(item.collection).doc(item.docId),
            patch: patch,
        });
    });
    const stateRef = db.collection(STATE).doc(STATE_ID);
    await db.runTransaction(async function (tx) {
        const snaps = [];
        for (let i = 0; i < patches.length; i++) snaps.push(await tx.get(patches[i].ref));
        const stateSnap = await tx.get(stateRef);
        for (let i = 0; i < patches.length; i++) {
            if (!snaps[i] || !snaps[i].exists) continue;
            if (typeof tx.update === 'function') tx.update(patches[i].ref, patches[i].patch);
            else tx.set(patches[i].ref, mergePatch(snaps[i].data() || {}, patches[i].patch));
        }
        const prev = stateSnap && stateSnap.exists ? (stateSnap.data() || {}) : {};
        // The slot was reserved in claimSending. Refresh the TTL only.
        const sentAtMs = recentSends(prev.sentAtMs, nowMs);
        const nextState = Object.assign({
            sentAtMs: sentAtMs.slice(-MAX_SENDS_PER_MINUTE),
        }, retentionFields(nowMs));
        if (typeof tx.set === 'function') tx.set(stateRef, nextState);
    });
}

async function markFailed(db, items, result, nowMs) {
    const error = String((result && (result.error || result.status)) || 'failed').slice(0, 180);
    await patchDocs(db, items.map(function (item) {
        return {
            ref: db.collection(QUEUE).doc(item.id),
            patch: {
                status: 'failed',
                attempts: attemptCount(item),
                lastError: error,
                failedAtMs: nowMs,
                nextAttemptAt: nowMs,
            },
        };
    }));
}

async function settleItems(db, items, result, nowMs) {
    const failing = [];
    const waiting = [];
    items.forEach(function (item) {
        if (shouldFailItem(item, result)) failing.push(item);
        else waiting.push(item);
    });
    if (failing.length) await markFailed(db, failing, result, nowMs);
    let wait = 0;
    if (waiting.length) wait = await holdForRetry(db, waiting, result, nowMs);
    return { failed: failing.length, wait: wait };
}

async function holdForRetry(db, items, result, nowMs) {
    const attempt = items.reduce(function (max, item) {
        return Math.max(max, Number(item.attempts) || 0);
    }, 0) + 1;
    const wait = isChatLevel(result) ? chatHoldMs(attempt) : backoffMs(attempt, result && result.retryAfter);
    await patchDocs(db, items.map(function (item) {
        return {
            ref: db.collection(QUEUE).doc(item.id),
            patch: {
                status: 'pending',
                attempts: (Number(item.attempts) || 0) + 1,
                nextAttemptAt: nowMs + wait,
            },
        };
    }));
    return wait;
}

async function sendOneBatch(db, nowMs, options) {
    const opts = options || {};
    const pending = await readDue(db, nowMs);
    const sending = opts.recover ? await readExpiredSending(db, nowMs) : [];
    const state = await readState(db);
    const plan = planBatch(pending.concat(sending), state.sentAtMs, nowMs);
    if (!plan.items.length) return { sent: 0, waitUntil: plan.waitUntil || 0 };
    let claimed;
    try {
        claimed = await claimSending(db, plan, nowMs);
    } catch (err) {
        return { sent: 0, reason: 'conflict' };
    }
    if (!claimed || claimed.ok === false) {
        return { sent: 0, waitUntil: claimed && claimed.waitUntil ? claimed.waitUntil : 0 };
    }
    const live = await dropBlocked(db, plan, nowMs);
    if (!live.items.length) {
        await releaseSendSlot(db, nowMs);
        return { sent: 0, reason: 'blocked' };
    }
    const secret = opts.token != null ? opts.token : (opts.env && opts.env.TG_BOT_TOKEN);
    const result = await sendTelegramText(live.text, opts);
    const label = result.ok ? 'sent' : (isChatLevel(result) ? ('hold ' + result.status) : (result.error || 'retry'));
    safeMirrorLog(opts.log, secret, 'mirror ' + label);
    if (isChatLevel(result)) logChatHold(result.status);
    if (result.ok) {
        await stampSent(db, live.items, result, nowMs);
        return { sent: 1, telegramMsgId: result.telegramMsgId, count: live.items.length };
    }
    if (isChatLevel(result)) {
        const held = await settleItems(db, live.items, result, nowMs);
        return { sent: 0, reason: 'hold', waitUntil: held.wait ? nowMs + held.wait : 0 };
    }
    if (live.items.length > 1 && isPermanentHttp(result)) {
        let sent = 0;
        for (let i = 0; i < live.items.length; i++) {
            const rest = live.items.slice(i);
            await touchLease(db, rest, leaseStamp(opts));
            if (i > 0) {
                const slot = await reserveSendSlot(db, nowMs);
                if (!slot.ok) {
                    const waitMs = Math.max(0, (slot.waitUntil || nowMs) - nowMs);
                    await holdForRetry(db, rest, { retryAfter: Math.ceil(waitMs / 1000) }, nowMs);
                    return { sent: sent, isolated: true, reason: 'group_rate', waitUntil: slot.waitUntil || 0 };
                }
            }
            const item = rest[0];
            const one = await sendTelegramText(item.line, opts);
            if (one.ok) {
                safeMirrorLog(opts.log, secret, 'mirror line sent');
                await stampSent(db, [item], one, nowMs);
                sent += 1;
                continue;
            }
            if (isChatLevel(one) || Number(one.status) === 429) {
                safeMirrorLog(opts.log, secret, 'mirror hold ' + (Number(one.status) || 0));
                if (isChatLevel(one)) logChatHold(one.status);
                const held = await settleItems(db, rest, one, nowMs);
                return {
                    sent: sent,
                    isolated: true,
                    reason: 'hold',
                    waitUntil: held.wait ? nowMs + held.wait : 0,
                };
            }
            safeMirrorLog(opts.log, secret, 'mirror line ' + (one.error || 'retry'));
            await settleItems(db, [item], one, nowMs);
        }
        return { sent: sent, isolated: true, count: live.items.length };
    }
    const settled = await settleItems(db, live.items, result, nowMs);
    return {
        sent: 0,
        reason: settled.failed && !settled.wait ? 'failed' : (result.error || 'retry'),
        waitUntil: settled.wait ? nowMs + settled.wait : 0,
    };
}

async function flushTelegramMirror(db, nowMs, options) {
    const at = Number(nowMs) || Date.now();
    let sent = 0;
    let last = null;
    for (let n = 0; n < MAX_SENDS_PER_MINUTE; n++) {
        last = await sendOneBatch(db, at + n, Object.assign({}, options, { recover: true }));
        if (!last || !last.sent) break;
        sent += last.sent;
    }
    return { sent: sent, reason: last && last.reason ? last.reason : '', waitUntil: last && last.waitUntil ? last.waitUntil : 0 };
}

async function handleChatMirror(db, collection, docId, data, nowMs, options) {
    const at = Number(nowMs) || Date.now();
    const user = await loadMirrorUser(db, data);
    const queued = await enqueueChatMirror(db, collection, docId, data, user, at);
    if (!queued.queued) return queued;
    try {
        const flushed = await sendOneBatch(db, at, options);
        return Object.assign({}, queued, { sent: flushed.sent || 0 });
    } catch (err) {
        return Object.assign({}, queued, { sent: 0, reason: 'flush_failed' });
    }
}

async function deleteTelegramMessage(chatId, messageId, options) {
    const opts = options || {};
    const env = opts.env || process.env;
    const token = opts.token != null ? opts.token : (env.TG_BOT_TOKEN || '');
    const chat = chatId || opts.chatId || env.TG_CHAT_ID || DEFAULT_CHAT_ID;
    if (!token || !messageId) return { ok: false, error: 'not_configured' };
    const fetchImpl = opts.fetch || defaultFetchImpl();
    const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : SEND_TIMEOUT_MS;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timer = null;
    try {
        if (controller) timer = setTimeout(function () { controller.abort(); }, timeoutMs);
        const init = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: String(chat), message_id: Number(messageId) || messageId }),
        };
        if (controller) init.signal = controller.signal;
        const resp = await fetchImpl('https://api.telegram.org/bot' + token + '/deleteMessage', init);
        const json = resp && resp.json ? await resp.json() : null;
        if (resp && resp.ok && json && json.ok !== false) return { ok: true };
        return { ok: false, error: 'http', status: resp && resp.status };
    } catch (err) {
        return { ok: false, error: 'request_failed' };
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function retractMirroredChat(db, before, after, options) {
    const prev = before || null;
    if (!prev || prev.telegramBatched === true || !prev.telegramMsgId) return { deleted: false, reason: 'no_id' };
    if (after && !removedForTelegram(after)) return { deleted: false, reason: 'visible' };
    const result = await deleteTelegramMessage(prev.telegramChatId, prev.telegramMsgId, options);
    return { deleted: !!result.ok, reason: result.ok ? '' : (result.error || 'http') };
}

function safeMirrorLog(log, secret, message) {
    if (!log || typeof log !== 'function') return;
    log(redactForLog(message, secret));
}

module.exports = {
    QUEUE: QUEUE,
    CLAIMS: CLAIMS,
    STATE: STATE,
    DEFAULT_CHAT_ID: DEFAULT_CHAT_ID,
    MAX_SENDS_PER_MINUTE: MAX_SENDS_PER_MINUTE,
    WINDOW_MS: WINDOW_MS,
    MAX_BATCH_CHARS: MAX_BATCH_CHARS,
    MAX_BATCH_ITEMS: MAX_BATCH_ITEMS,
    claimId: claimId,
    escapeHtml: escapeHtml,
    decideMirror: decideMirror,
    planBatch: planBatch,
    backoffMs: backoffMs,
    chatHoldMs: chatHoldMs,
    CHAT_HOLD_MAX_MS: CHAT_HOLD_MAX_MS,
    enqueueChatMirror: enqueueChatMirror,
    flushTelegramMirror: flushTelegramMirror,
    handleChatMirror: handleChatMirror,
    sendTelegramText: sendTelegramText,
    safeMirrorLog: safeMirrorLog,
    clipLine: clipLine,
    clipUnits: clipUnits,
    SEND_TIMEOUT_MS: SEND_TIMEOUT_MS,
    SENDING_LEASE_MS: SENDING_LEASE_MS,
    MAX_ATTEMPTS: MAX_ATTEMPTS,
    USER_GAP_MS: USER_GAP_MS,
    USER_MAX_PER_MINUTE: USER_MAX_PER_MINUTE,
    RETAIN_MS: RETAIN_MS,
    DUE_LIMIT: DUE_LIMIT,
    rateDocId: rateDocId,
    retractMirroredChat: retractMirroredChat,
};
