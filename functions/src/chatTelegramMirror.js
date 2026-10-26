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
const SENDING_LEASE_MS = 60 * 1000;

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

function visibleBody(data, note) {
    const src = data || {};
    let text = src.caption && (src.isGif === true || src.imageUrl || src.gifUrl)
        ? toTelegramText(src.caption)
        : toTelegramText(src.text || '');
    text = neutralizePings(stripContacts(stripUid(stripUid(text, src.uid), src.mentionUid)));
    text = text.replace(/\[([^\]]+)\]\((?:https?:\/\/|mailto:|javascript:)[^)]*\)/gi, '$1');
    text = text.replace(/[`]/g, '');
    if (note && note !== '[image]' && collapseSpace(text) === note) text = '';
    if (note === '[image]' && /^https?:\/\//i.test(collapseSpace(text))) text = '';
    if (note === '[image]' && text.length > 80 && text.indexOf(' ') === -1) text = '';
    text = collapseSpace(text).slice(0, 1000);
    const extra = note ? String(note) : '';
    return collapseSpace([text, extra].filter(Boolean).join(' '));
}

function mirrorName(data) {
    const src = data || {};
    if (src.uid === 'nacho-bot') return '🦌 Nacho';
    let name = stripContacts(neutralizePings(toTelegramText(src.name || src.username || '')));
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

function messageSkipReason(data) {
    const src = data || {};
    const source = String(src.source || src.bridgedFrom || '').toLowerCase();
    if (source === 'telegram' || src.fromTelegram === true) return 'telegram';
    if (src.deleted === true || src.uid === 'deleted') return 'deleted';
    if (src.hidden === true) return 'hidden';
    if (src.flagged === true || src.moderated === true || src.spam === true) return 'moderated';
    if (src.moderationRejected === true || src.filterRejected === true || src.rejected === true) return 'moderated';
    if (src.shadowbanned === true || src.shadowBan === true || src.isShadowbanned === true || src.shadowBanned === true) return 'shadowbanned';
    if (isPrivate(src)) return 'private';
    return '';
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
    const messageReason = messageSkipReason(data);
    if (messageReason) return { forward: false, reason: messageReason };
    const userReason = userSkipReason(opts.user, opts.nowMs || Date.now());
    if (userReason) return { forward: false, reason: userReason };
    const note = attachmentNote(data);
    const body = visibleBody(data, note);
    if (!body) return { forward: false, reason: 'empty' };
    const name = mirrorName(data);
    const line = '[' + SOURCE_TAG[collection] + '] ' + name + ': ' + body;
    return { forward: true, reason: '', line: escapeHtml(line), name: name };
}

function clipLine(line) {
    const text = String(line || '');
    if (text.length <= MAX_BATCH_CHARS) return text;
    let cut = text.slice(0, MAX_BATCH_CHARS - 1);
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
    let resp;
    try {
        resp = await fetchImpl('https://api.telegram.org/bot' + token + '/sendMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: String(chatId),
                text: text,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            }),
        });
    } catch (err) {
        return { ok: false, error: 'request_failed', retry: true };
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
        const retry = status === 0 || status >= 500;
        return { ok: false, error: 'http', status: status, retry: retry };
    }
    const messageId = json.result && json.result.message_id;
    const resultChat = json.result && json.result.chat && json.result.chat.id;
    return {
        ok: true,
        telegramMsgId: messageId != null ? String(messageId) : '',
        chatId: resultChat != null ? String(resultChat) : String(chatId),
    };
}

function queuePayload(collection, docId, line, nowMs) {
    return {
        status: 'pending',
        collection: collection,
        docId: String(docId),
        line: line,
        createdAtMs: nowMs,
        attempts: 0,
        nextAttemptAt: nowMs,
    };
}

async function enqueueChatMirror(db, collection, docId, data, user, nowMs) {
    const at = Number(nowMs) || Date.now();
    const id = claimId(collection, docId);
    if (!id) return { queued: false, reason: 'id' };
    const decision = decideMirror({ collection: collection, data: data, user: user, nowMs: at });
    const claimRef = db.collection(CLAIMS).doc(id);
    const queueRef = db.collection(QUEUE).doc(id);
    return db.runTransaction(async function (tx) {
        const claimSnap = await tx.get(claimRef);
        if (claimSnap && claimSnap.exists) return { queued: false, reason: 'claimed' };
        if (!decision.forward) {
            tx.set(claimRef, { status: 'skipped', reason: decision.reason, at: at });
            return { queued: false, reason: decision.reason };
        }
        tx.set(claimRef, { status: 'queued', at: at });
        tx.set(queueRef, queuePayload(collection, docId, decision.line, at));
        return { queued: true, id: id };
    });
}

async function loadMirrorUser(db, data) {
    const uid = data && data.uid ? String(data.uid) : '';
    if (!uid || uid === 'nacho-bot' || uid === 'system' || uid === 'deleted') return null;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return null;
    const snap = await db.collection('users').doc(uid).get();
    if (!snap || !snap.exists) return null;
    return snap.data() || {};
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

async function readQueue(db, status) {
    let query = db.collection(QUEUE).where('status', '==', status);
    if (typeof query.limit === 'function') query = query.limit(40);
    const snap = await query.get();
    return rowsOf(snap).map(function (row) {
        return Object.assign({ id: row.id }, row.data);
    });
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

async function claimSending(db, plan, nowMs) {
    const refs = plan.items.map(function (item) { return db.collection(QUEUE).doc(item.id); });
    await db.runTransaction(async function (tx) {
        const snaps = [];
        for (let i = 0; i < refs.length; i++) snaps.push(await tx.get(refs[i]));
        for (let i = 0; i < snaps.length; i++) {
            const data = snaps[i] && snaps[i].exists ? (snaps[i].data() || {}) : null;
            if (!data || !itemDue(Object.assign({ id: plan.ids[i] }, data), nowMs)) {
                throw new Error('conflict');
            }
        }
        for (let i = 0; i < refs.length; i++) {
            const patch = { status: 'sending', sendingAt: nowMs };
            if (typeof tx.update === 'function') tx.update(refs[i], patch);
            else tx.set(refs[i], mergePatch(snaps[i].data() || {}, patch));
        }
    });
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
        const reason = messageSkipReason(snap.data() || {});
        if (reason) drop.push(item);
        else keep.push(item);
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

async function stampSent(db, items, result, nowMs) {
    const patches = items.map(function (item) {
        return {
            ref: db.collection(QUEUE).doc(item.id),
            patch: {
                status: 'sent',
                sentAtMs: nowMs,
                telegramMsgId: result.telegramMsgId || '',
                telegramChatId: result.chatId || '',
            },
        };
    });
    items.forEach(function (item) {
        if (!SOURCE_TAG[item.collection]) return;
        patches.push({
            ref: db.collection(item.collection).doc(item.docId),
            patch: {
                telegramMirrored: true,
                telegramMsgId: result.telegramMsgId || '',
                telegramChatId: result.chatId || '',
            },
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
        const sentAtMs = recentSends(prev.sentAtMs, nowMs);
        sentAtMs.push(nowMs);
        const nextState = { sentAtMs: sentAtMs.slice(-MAX_SENDS_PER_MINUTE) };
        if (typeof tx.set === 'function') tx.set(stateRef, nextState);
    });
}

async function holdForRetry(db, items, result, nowMs) {
    const attempt = items.reduce(function (max, item) {
        return Math.max(max, Number(item.attempts) || 0);
    }, 0) + 1;
    const wait = backoffMs(attempt, result && result.retryAfter);
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
    const pending = await readQueue(db, 'pending');
    const sending = await readQueue(db, 'sending');
    const state = await readState(db);
    const plan = planBatch(pending.concat(sending), state.sentAtMs, nowMs);
    if (!plan.items.length) return { sent: 0, waitUntil: plan.waitUntil || 0 };
    try {
        await claimSending(db, plan, nowMs);
    } catch (err) {
        return { sent: 0, reason: 'conflict' };
    }
    const live = await dropBlocked(db, plan, nowMs);
    if (!live.items.length) return { sent: 0, reason: 'blocked' };
    const result = await sendTelegramText(live.text, options);
    const secret = options && options.token != null ? options.token : (options && options.env && options.env.TG_BOT_TOKEN);
    safeMirrorLog(options && options.log, secret, 'mirror ' + (result.ok ? 'sent' : (result.error || 'retry')));
    if (result.ok) {
        await stampSent(db, live.items, result, nowMs);
        return { sent: 1, telegramMsgId: result.telegramMsgId, count: live.items.length };
    }
    if (result.retry !== false) {
        const wait = await holdForRetry(db, live.items, result, nowMs);
        return { sent: 0, reason: result.error || 'retry', waitUntil: nowMs + wait };
    }
    await holdForRetry(db, live.items, result, nowMs);
    return { sent: 0, reason: result.error || 'retry' };
}

async function flushTelegramMirror(db, nowMs, options) {
    const at = Number(nowMs) || Date.now();
    let sent = 0;
    let last = null;
    for (let n = 0; n < MAX_SENDS_PER_MINUTE; n++) {
        last = await sendOneBatch(db, at + n, options);
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
        const flushed = await flushTelegramMirror(db, at, options);
        return Object.assign({}, queued, { sent: flushed.sent });
    } catch (err) {
        return Object.assign({}, queued, { sent: 0, reason: 'flush_failed' });
    }
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
    enqueueChatMirror: enqueueChatMirror,
    flushTelegramMirror: flushTelegramMirror,
    handleChatMirror: handleChatMirror,
    sendTelegramText: sendTelegramText,
    safeMirrorLog: safeMirrorLog,
};
