'use strict';

// Server-side Global Chat → Telegram post.
//
// workers/chat-bridge handleFirestoreWebhook accepts JSON
// { user, text, gifUrl, imageUrl, imageBase64, replyToName, replyToText, source, uid }.
// It skips source === 'telegram'. The group message is sent by the bot as
// "[🌐 <user>]\n<text>" (replies insert a quoted line under the name).
// uid is not rendered. Nacho shoutouts therefore send user "🦌 Nacho"
// so the Telegram line reads "[🌐 🦌 Nacho]".
//
// Do not log the secret, a URL query string, or a response body. Telegram
// errors and misconfigured URLs can echo tokens.

const { unwrapProfileSpans, moderateText } = require('./moderateText');

// Only an @ that starts a word. n@igger stays intact so a later strip cannot
// spell the slur into the public group. Shoutout payloads use this on the
// Telegram copy; the in-app string is left alone.
function stripLeadingMentions(value) {
    return String(value == null ? '' : value)
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/(^|[^\p{L}\p{N}_])[\uFF20@]+(?=[A-Za-z0-9_])/gu, '$1');
}

const DEFAULT_BRIDGE_URL = 'https://chat-bridge.needcreations.workers.dev/webhook/firestore';
const DEFAULT_TIMEOUT_MS = 5000;
// Normal chat posts can carry a photo. They keep a long timeout so moving
// them onto this helper does not fail uploads that used to wait on the
// function timeout. Shoutouts use DEFAULT_TIMEOUT_MS.
const WEB_BRIDGE_TIMEOUT_MS = 60000;
const NACHO_BRIDGE_USER = '🦌 Nacho';
const NACHO_BRIDGE_UID = 'nacho';

function redactForLog(value, secret) {
    let out = String(value == null ? '' : value);
    if (secret) out = out.split(String(secret)).join('[redacted]');
    out = out.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
    out = out.replace(/https?:\/\/[^\s'"]+/gi, '[url]');
    out = out.replace(/[?&][^\s'"]+/g, '');
    return out.slice(0, 200);
}

function safeLog(log, level, secret, message) {
    const logger = log || console;
    const fn = typeof logger[level] === 'function' ? logger[level] : logger.warn;
    if (typeof fn !== 'function') return;
    fn.call(logger, redactForLog(message, secret));
}

function defaultFetchImpl() {
    try {
        return require('node-fetch');
    } catch (err) {
        if (typeof fetch === 'function') return fetch;
        throw err;
    }
}

// Global Chat turns the first @name into a profile chip via mentionUid, and
// the composer also understands HTML chips, @[name](uid), and [label](#route).
// Telegram only needs the visible name.
function toTelegramText(text) {
    let out = unwrapProfileSpans(text);
    out = out.replace(/<[^>]*>/g, '');
    out = out.replace(/@\[([^\]]+)\]\([^)]*\)/g, '@$1');
    // Activity shoutouts deep-link in chat. Telegram needs a tappable URL.
    out = out.replace(/\[([^\]]+)\]\(#((?:forum\/post|marketplace\/listing)\/[A-Za-z0-9_-]+)\)/g, 'https://bitcoineducation.quest/#$2');
    out = out.replace(/\[([^\]]+)\]\(#topic\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)(?:\/(\d+)\/([a-z0-9]{8}))?\)/g, function(_match, _label, channel, post, index, hash) {
        let url = 'https://bitcoineducation.quest/#topic=' + channel + '&post=' + post;
        if (index && hash) url += '&i=' + index + '&h=' + hash;
        return url;
    });
    out = out.replace(/\[([^\]]+)\]\(#[^)]*\)/g, '$1');
    out = out.replace(/%%[A-Za-z0-9_]+%%/g, '');
    out = out.replace(/[ \t]{2,}/g, ' ');
    return out.trim();
}

function buildNachoBridgePayload(text) {
    return {
        user: NACHO_BRIDGE_USER,
        text: stripLeadingMentions(toTelegramText(text)),
        source: 'server',
        uid: NACHO_BRIDGE_UID,
    };
}

// Same fields bridgeToTelegram used to post. data.user is intentionally
// unread: the callable passes the username loaded from the caller's profile.
function buildWebBridgePayload(verifiedUsername, authUid, data) {
    const src = data || {};
    return {
        user: verifiedUsername || 'Anon',
        text: (src.text || '').substring(0, 500),
        gifUrl: src.gifUrl || '',
        imageUrl: src.imageUrl || '',
        imageBase64: src.imageBase64 || '',
        replyToName: (src.replyToName || '').substring(0, 50),
        replyToText: (src.replyToText || '').substring(0, 200),
        uid: authUid,
        source: 'web',
    };
}

function shouldMirrorShoutout(data) {
    if (!data) return false;
    if (data.telegramMsgId) return false;
    if (data.telegramMirrored === true) return false;
    return true;
}

// The worker returns { ok, result } where result is the Telegram API body
// { ok, result: { message_id, chat: { id } } }. Older callers also look for
// telegramMsgId and chatId on the top-level JSON.
function extractTelegramIds(json) {
    const body = json || {};
    if (body.telegramMsgId != null && body.telegramMsgId !== '' && body.chatId != null && body.chatId !== '') {
        return { telegramMsgId: String(body.telegramMsgId), chatId: String(body.chatId) };
    }
    const wrapped = body.result && body.result.result ? body.result.result : null;
    const direct = body.result && body.result.message_id != null ? body.result : null;
    const layer = wrapped && wrapped.message_id != null ? wrapped : direct;
    if (layer && layer.message_id != null && layer.chat && layer.chat.id != null) {
        return { telegramMsgId: String(layer.message_id), chatId: String(layer.chat.id) };
    }
    return { telegramMsgId: '', chatId: '' };
}

async function postToTelegramBridge(payload, options) {
    const opts = options || {};
    const env = opts.env || process.env;
    const url = opts.url || env.BRIDGE_URL || DEFAULT_BRIDGE_URL;
    const secret = opts.secret !== undefined ? opts.secret : env.BRIDGE_SECRET;
    const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
    const log = opts.log || console;
    const fetchImpl = opts.fetch || defaultFetchImpl();

    if (!secret) {
        safeLog(log, 'error', '', '[telegramBridge] BRIDGE_SECRET is not set');
        return { ok: false, error: 'not_configured' };
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timer = null;
    if (controller && timeoutMs > 0) {
        timer = setTimeout(function() { controller.abort(); }, timeoutMs);
    }

    try {
        const init = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + secret,
            },
            body: JSON.stringify(payload || {}),
        };
        if (controller && timeoutMs > 0) init.signal = controller.signal;
        if (timeoutMs > 0) init.timeout = timeoutMs;

        const resp = await fetchImpl(url, init);
        if (!resp || !resp.ok) {
            const status = resp && resp.status ? resp.status : 0;
            safeLog(log, 'warn', secret, '[telegramBridge] bridge HTTP ' + status);
            return { ok: false, status: status, error: 'http' };
        }
        let json;
        try {
            json = await resp.json();
        } catch (parseErr) {
            safeLog(log, 'warn', secret, '[telegramBridge] bridge response was not JSON, status=' + (resp.status || 0));
            return { ok: false, status: resp.status, error: 'bad_json' };
        }
        if (!json || json.ok === false) {
            safeLog(log, 'warn', secret, '[telegramBridge] bridge rejected the post');
            return { ok: false, error: 'rejected' };
        }
        const ids = extractTelegramIds(json);
        return {
            ok: true,
            telegramMsgId: ids.telegramMsgId || undefined,
            chatId: ids.chatId || undefined,
        };
    } catch (err) {
        const timedOut = !!(err && (err.name === 'AbortError' || err.name === 'TimeoutError' || err.type === 'request-timeout'));
        const detail = timedOut ? 'timeout' : ('request failed: ' + (err && err.message ? err.message : 'error'));
        safeLog(log, 'warn', secret, '[telegramBridge] ' + detail);
        return { ok: false, error: timedOut ? 'timeout' : 'request_failed' };
    } finally {
        if (timer) clearTimeout(timer);
    }
}

// One Telegram post per chat doc. A repeat call sees telegramMsgId or
// telegramMirrored and does not post again. A bridge failure is logged and
// returned; it is not thrown, so openGift still succeeds.
async function mirrorShoutoutOnce(options) {
    const opts = options || {};
    const docId = opts.docId || '';
    const collection = opts.collection || 'global_chat';
    const log = opts.log || console;
    const env = opts.env || process.env;
    const secret = opts.secret !== undefined ? opts.secret : env.BRIDGE_SECRET;

    const getDoc = opts.getDoc || async function(id) {
        if (!opts.db) return null;
        const snap = await opts.db.collection(collection).doc(id).get();
        if (!snap.exists) return null;
        return snap.data() || {};
    };
    const updateDoc = opts.updateDoc || async function(id, patch) {
        await opts.db.collection(collection).doc(id).update(patch);
    };
    const post = opts.post || function(body) {
        return postToTelegramBridge(body, {
            env: env,
            fetch: opts.fetch,
            timeoutMs: opts.timeoutMs,
            log: log,
            secret: opts.secret,
            url: opts.url,
        });
    };
    const dropTelegram = opts.deleteTelegram || function(args) {
        return deleteTelegramMessage({
            chatId: args.chatId,
            messageId: args.messageId,
            env: env,
            fetch: opts.fetch,
            token: opts.token,
        });
    };

    try {
        if (!docId) return { mirrored: false, reason: 'no_doc' };
        // onCreate mirrors every global_chat and announcements doc. Callers
        // that already have the chat doc defer so the shoutout is posted once.
        // Pass force only for a backfill of a doc that will not fire onCreate.
        if (opts.db && opts.force !== true) {
            return { mirrored: false, reason: 'server_mirror' };
        }
        const data = await getDoc(docId);
        if (!data) return { mirrored: false, reason: 'missing' };
        if (!shouldMirrorShoutout(data)) return { mirrored: false, reason: 'already_mirrored' };

        const outgoing = opts.text != null ? opts.text : (data.text || '');
        const payload = buildNachoBridgePayload(outgoing);
        const verdict = moderateText(outgoing, { strict: true });
        const sentVerdict = moderateText(payload.text, { strict: true });
        if (!verdict.clean || !sentVerdict.clean) {
            const reason = !verdict.clean ? verdict.reason : sentVerdict.reason;
            return { mirrored: false, reason: String(reason || '').indexOf('scam') !== -1 ? 'scam' : 'profanity' };
        }
        let result;
        try {
            result = await post(payload);
        } catch (err) {
            safeLog(log, 'warn', secret, '[telegramBridge] mirror failed: ' + (err && err.message ? err.message : 'error'));
            return { mirrored: false, reason: 'error' };
        }
        if (!result || result.ok === false || !result.telegramMsgId || !result.chatId) {
            safeLog(log, 'warn', secret, '[telegramBridge] mirror was not confirmed');
            return { mirrored: false, reason: result && result.error ? result.error : 'unconfirmed' };
        }
        // Retract can delete the chat doc while this post is in flight, before
        // telegramMsgId is linked. If the Nacho doc is gone, drop the copy we
        // just created instead of leaving an orphan on Telegram.
        const still = await getDoc(docId);
        if (!still || still.uid !== 'nacho-bot') {
            try {
                await dropTelegram({
                    chatId: result.chatId,
                    messageId: result.telegramMsgId,
                });
            } catch (dropErr) {
                safeLog(log, 'warn', secret, '[telegramBridge] telegram cleanup failed');
            }
            return { mirrored: false, reason: 'removed' };
        }
        await updateDoc(docId, {
            telegramMsgId: String(result.telegramMsgId),
            telegramChatId: String(result.chatId),
            telegramMirrored: true,
        });
        return {
            mirrored: true,
            telegramMsgId: String(result.telegramMsgId),
            chatId: String(result.chatId),
        };
    } catch (err) {
        safeLog(log, 'warn', secret, '[telegramBridge] mirror failed: ' + (err && err.message ? err.message : 'error'));
        return { mirrored: false, reason: 'error' };
    }
}

// Best-effort. A missing token or a bridge error still lets the chat doc be removed.
async function deleteTelegramMessage(opts) {
    const o = opts || {};
    const env = o.env || process.env;
    const token = o.token != null ? o.token : (env.TG_BOT_TOKEN || '');
    const chatId = o.chatId;
    const messageId = o.messageId;
    if (!token || chatId == null || chatId === '' || messageId == null || messageId === '') {
        return { deleted: false, reason: 'skipped' };
    }
    try {
        const fetchImpl = o.fetch || defaultFetchImpl();
        const res = await fetchImpl('https://api.telegram.org/bot' + token + '/deleteMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
        });
        return { deleted: !!(res && res.ok), reason: res && res.ok ? 'ok' : 'rejected' };
    } catch (err) {
        return { deleted: false, reason: 'error' };
    }
}

module.exports = {
    DEFAULT_BRIDGE_URL: DEFAULT_BRIDGE_URL,
    DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
    WEB_BRIDGE_TIMEOUT_MS: WEB_BRIDGE_TIMEOUT_MS,
    NACHO_BRIDGE_USER: NACHO_BRIDGE_USER,
    NACHO_BRIDGE_UID: NACHO_BRIDGE_UID,
    redactForLog: redactForLog,
    toTelegramText: toTelegramText,
    stripLeadingMentions: stripLeadingMentions,
    buildNachoBridgePayload: buildNachoBridgePayload,
    buildWebBridgePayload: buildWebBridgePayload,
    shouldMirrorShoutout: shouldMirrorShoutout,
    extractTelegramIds: extractTelegramIds,
    postToTelegramBridge: postToTelegramBridge,
    mirrorShoutoutOnce: mirrorShoutoutOnce,
    deleteTelegramMessage: deleteTelegramMessage,
};
