'use strict';

// Live comments and questions on educational topic channels.
// Clients may only read topic_discussions. Every write goes through these
// callables. No XP and no tickets are awarded for posting.
//
// Account deletion (PR #53, agent bc-6466c0e4): when a uid is deleted,
// delete or anonymize every topic_discussions/{channelId}/posts doc whose
// uid matches, plus topic_discussion_limits/{uid} and
// topic_discussion_private docs for those posts. Query the collection group
// "posts" where uid == deletedUid (index uid ASC, createdAt DESC). Do not
// full-scan. Nacho replies (uid nacho-bot) stay.

const { classifyChatText, maskChatProfanity } = require('./chatProfanity');
const { mirrorShoutoutOnce } = require('./telegramBridge');
const forumMirror = require('./topicForumMirror');

const TOPIC_CHANNELS = require('./topicChannels.json');
const TOPIC_GROUNDING = require('./topicGrounding.json');

const NACHO_AI_URL = 'https://jolly-surf-219enacho-search.needcreations.workers.dev/ai';
const RESET_HOUR_UTC = 5;
const MAX_CHARS = 500;
const MIN_CHARS = 2;
const RATE_MS = 30 * 1000;
const DAILY_MAX = 20;
const NACHO_PER_USER = 5;
const NACHO_GLOBAL = 60;
const ANNOUNCE_WINDOW_MS = 10 * 60 * 1000;
const ANNOUNCE_HOUR_MS = 60 * 60 * 1000;
const ANNOUNCE_PER_HOUR = 12;
const REPORTS_PER_DAY = 20;
const NACHO_UID = 'nacho-bot';
const UNSURE = "I'm not sure — I don't want to guess. The notes in this topic are the best source, and I'm not a financial advisor.";

const SHORTENER_RE = /\b(?:https?:\/\/)?(?:www\.)?(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|cutt\.ly|rb\.gy|tiny\.cc|buff\.ly|rebrand\.ly|shorturl\.at|v\.gd|clck\.ru)\b/i;
const INVITE_RE = /discord\.gg\/|discord(?:app)?\.com\/invite|chat\.whatsapp\.com|t\.me\/joinchat|t\.me\/\+|telegram\.me\/joinchat/i;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9][a-z0-9.-]*\.(?:com|org|net|io|gg|ly|me|co|xyz|info|dev|app|link)(?:\/\S*)?/gi;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const PHONE_RE = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;
const INJECTION_RE = /ignore\s+(all|previous|your)\s+instructions|system\s+prompt|jailbreak|pretend\s+to\s+be|act\s+as\s+/i;
const ADVICE_RE = /\b(you should (buy|sell|invest)|i recommend (buying|selling)|buy now|sell now|price target|guaranteed return|go all in)\b/i;

const TOPIC_LIMITS = {
    maxChars: MAX_CHARS,
    minChars: MIN_CHARS,
    rateMs: RATE_MS,
    dailyMax: DAILY_MAX,
    nachoPerUser: NACHO_PER_USER,
    nachoGlobal: NACHO_GLOBAL,
    announceWindowMs: ANNOUNCE_WINDOW_MS,
    announcePerHour: ANNOUNCE_PER_HOUR,
    reportsPerDay: REPORTS_PER_DAY,
};

function offsetDateKey(nowMs) {
    const shifted = new Date(Number(nowMs) - RESET_HOUR_UTC * 3600 * 1000);
    return shifted.toISOString().slice(0, 10);
}

function timestampMs(ts) {
    if (!ts) return 0;
    if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
    if (typeof ts.toMillis === 'function') {
        const ms = ts.toMillis();
        return Number.isFinite(ms) ? ms : 0;
    }
    if (typeof ts === 'string') {
        const parsed = Date.parse(ts);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (typeof ts === 'object') {
        const seconds = ts._seconds != null ? ts._seconds : ts.seconds;
        if (typeof seconds === 'number') return seconds * 1000;
    }
    return 0;
}

function cleanId(value, max) {
    if (typeof value !== 'string') return '';
    if (!/^[A-Za-z0-9_-]+$/.test(value)) return '';
    if (value.length < 1 || value.length > (max || 128)) return '';
    return value;
}

function channelMeta(channelId, channels) {
    const map = channels || TOPIC_CHANNELS;
    if (!cleanId(channelId, 80)) return null;
    if (!Object.prototype.hasOwnProperty.call(map, channelId)) return null;
    const row = map[channelId];
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    return row;
}

function displayTitle(meta, channelId) {
    const plain = meta && meta.plain ? String(meta.plain) : String(channelId || 'this topic');
    const trimmed = plain.replace(/\s+/g, ' ').trim().slice(0, 80) || 'this topic';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function meaningfulLength(text) {
    const s = String(text || '').replace(/\[link removed\]/gi, ' ');
    let n = 0;
    for (let i = 0; i < s.length;) {
        const cp = s.codePointAt(i);
        i += cp > 0xffff ? 2 : 1;
        if (cp <= 32) continue;
        if (cp < 127 && !/[A-Za-z0-9]/.test(String.fromCharCode(cp))) continue;
        n += 1;
    }
    return n;
}

function inspectLinks(text) {
    const raw = String(text || '');
    if (SHORTENER_RE.test(raw)) return { ok: false, code: 'shortener', text: raw, flagged: true };
    if (INVITE_RE.test(raw)) return { ok: false, code: 'invite', text: raw, flagged: true };
    let flagged = false;
    const next = raw.replace(URL_RE, function() {
        flagged = true;
        return '[link removed]';
    });
    return { ok: true, code: '', text: next, flagged: flagged };
}

function preparePostText(raw) {
    let text = String(raw == null ? '' : raw).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\u00A0/g, ' ').trim();
    text = text.replace(/\n{4,}/g, '\n\n\n');
    if (!text) return { ok: false, code: 'empty' };
    if (text.length > MAX_CHARS) return { ok: false, code: 'length' };
    if (EMAIL_RE.test(text) || PHONE_RE.test(text)) return { ok: false, code: 'pii' };
    const kind = classifyChatText(text);
    if (kind === 'hate' || kind === 'scam' || kind === 'spam') return { ok: false, code: kind };
    if (kind === 'profanity') text = maskChatProfanity(text);
    const links = inspectLinks(text);
    if (!links.ok) return { ok: false, code: links.code };
    text = links.text.replace(/[ \t]{2,}/g, ' ').trim();
    if (meaningfulLength(text) < MIN_CHARS) return { ok: false, code: 'empty' };
    return { ok: true, text: text, linksRemoved: links.flagged === true };
}

function looksLikeQuestion(text) {
    const t = String(text || '').trim();
    if (t.length < 12 || t.indexOf('?') === -1) return false;
    const socialOnly = /^(how'?s|how is|how was|what'?s|hows)\s+(your|everyone'?s|the|ur)\s+(weekend|day|week|night|morning|evening|life|family|summer|holiday|trip|vacation)/i;
    if (socialOnly.test(t)) return false;
    const greetings = /^(how are you|how r u|how do you do|how you doing|what'?s up|wassup|you good)\b/i;
    if (greetings.test(t) && t.length < 40) return false;
    return /\b(what|why|how|when|where|who|which|can|could|should|would|is|are|does|do|will|explain|tell me|anyone know|what'?s|whats)\b/i.test(t);
}

function snippetOf(text) {
    let s = maskChatProfanity(String(text || ''));
    s = s.replace(/\[link removed\]/gi, '');
    s = s.replace(/[<>\[\]()"'`\\]/g, '');
    s = s.replace(/\s+/g, ' ').trim();
    if (s.length > 80) s = s.slice(0, 77).trim() + '…';
    return s || 'a new post';
}

function buildAnnouncement(input) {
    const src = input || {};
    const title = String(src.title || 'this topic').replace(/[<>\[\]"]/g, '').slice(0, 80);
    const channelId = cleanId(src.channelId, 80);
    const postId = cleanId(src.postId, 128);
    const label = src.isQuestion ? 'New question' : 'New comment';
    const link = forumMirror.announcementLinks(channelId, postId, src.forumPostId || '');
    let snip = snippetOf(src.text);
    let text = '🦌 ' + label + ' in ' + title + ': "' + snip + '" → ' + link;
    while (text.length > 300 && snip.length > 16) {
        snip = snip.slice(0, Math.max(12, snip.length - 8)).trim() + '…';
        text = '🦌 ' + label + ' in ' + title + ': "' + snip + '" → ' + link;
    }
    if (text.length > 300) text = ('🦌 ' + label + ' in ' + title + ' → ' + link).slice(0, 300);
    return text;
}

function moderationBlock(user, ledger, nowMs) {
    const u = user || {};
    const l = ledger || {};
    if (u.banned === true || u.withdrawals_disabled === true || u.satsDisabled === true) return 'banned';
    if (l.banned === true) return 'banned';
    if (u.muted === true || u.chatMuted === true) return 'muted';
    const until = timestampMs(u.mutedUntil || u.chatMutedUntil || u.muteUntil);
    if (until && until > Number(nowMs || 0)) return 'muted';
    return '';
}

function decideRate(limit, nowMs) {
    const src = limit || {};
    const last = Number(src.lastPostMs) || 0;
    if (last && (nowMs - last) < RATE_MS) return { ok: false, code: 'rate' };
    const day = offsetDateKey(nowMs);
    const count = src.dayKey === day ? (Number(src.dayCount) || 0) : 0;
    if (count >= DAILY_MAX) return { ok: false, code: 'daily' };
    return { ok: true, dayKey: day, dayCount: count + 1, lastPostMs: nowMs };
}

function decideNachoCap(userLimit, globalLimit, nowMs) {
    const day = offsetDateKey(nowMs);
    const u = userLimit || {};
    const g = globalLimit || {};
    const userCount = u.nachoDayKey === day ? (Number(u.nachoDayCount) || 0) : 0;
    const globalCount = g.dayKey === day ? (Number(g.dayCount) || 0) : 0;
    if (userCount >= NACHO_PER_USER || globalCount >= NACHO_GLOBAL) return { allow: false, reason: 'cap' };
    return {
        allow: true,
        user: { nachoDayKey: day, nachoDayCount: userCount + 1 },
        global: { dayKey: day, dayCount: globalCount + 1 },
    };
}

function decideAnnounce(topicMeta, hourDoc, nowMs) {
    const last = Number(topicMeta && topicMeta.lastAnnounceAtMs) || 0;
    if (last && (nowMs - last) < ANNOUNCE_WINDOW_MS) return { allow: false, reason: 'topic' };
    const hourKey = String(Math.floor(nowMs / ANNOUNCE_HOUR_MS));
    const h = hourDoc || {};
    const count = h.hourKey === hourKey ? (Number(h.count) || 0) : 0;
    if (count >= ANNOUNCE_PER_HOUR) return { allow: false, reason: 'hour' };
    return { allow: true, lastAnnounceAtMs: nowMs, hourKey: hourKey, count: count + 1 };
}

function topicStickyScrollDelta(elTop, containerTop, stickyCover) {
    const visibleTop = Math.max(Number(containerTop) || 0, Number(stickyCover) || 0);
    return (Number(elTop) || 0) - visibleTop - 8;
}

function sanitizeNachoAnswer(text) {
    let answer = String(text || '').replace(/<[^>]*>/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
    answer = answer.replace(/\n?Follow-up:\s*.+$/i, '').trim();
    if (!answer || answer.length < 8) return UNSURE;
    const lower = answer.toLowerCase();
    if (lower.includes('my instructions') || lower.includes('system prompt') || lower.includes('i am an ai language model')) return UNSURE;
    if (ADVICE_RE.test(answer)) return UNSURE;
    if (answer.length > 700) answer = answer.slice(0, 697).trim() + '…';
    return answer;
}

function stripForModel(text) {
    return String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function groundingFor(channelId, meta, grounding) {
    const map = grounding || TOPIC_GROUNDING;
    const notes = map && map[channelId] ? String(map[channelId]) : (meta && meta.desc ? String(meta.desc) : '');
    const title = displayTitle(meta, channelId);
    return ('You are answering inside the Bitcoin education topic "' + title + '". '
        + 'Use these notes from that topic. If they do not support a precise answer, say "I\'m not sure" and do not guess. '
        + 'Stay Bitcoin-accurate. Never give financial advice and never tell anyone to buy, sell, or hold. '
        + 'TOPIC NOTES: ' + notes).slice(0, 1500);
}

function cleanName(name) {
    return String(name || '').replace(/[\u0000-\u001F<>]/g, '').trim().slice(0, 40);
}

function callerFrom(context) {
    if (!context || !context.auth || !context.auth.uid) return { authed: false, uid: '', anonymous: false, admin: false };
    const token = context.auth.token || {};
    const provider = token.firebase && token.firebase.sign_in_provider;
    return {
        authed: true,
        uid: String(context.auth.uid),
        anonymous: provider === 'anonymous',
        admin: token.admin === true,
    };
}

function defaultFetch() {
    try { return require('node-fetch'); }
    catch (err) {
        if (typeof fetch === 'function') return fetch;
        throw err;
    }
}

async function defaultAskNacho(input) {
    const fetchImpl = defaultFetch();
    const res = await fetchImpl(NACHO_AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            question: String(input.question || '').slice(0, 500),
            kbContext: String(input.grounding || '').slice(0, 1500),
            mode: 'chat',
        }),
        timeout: 12000,
    });
    if (!res || !res.ok) throw new Error('ai');
    const json = await res.json();
    return { answer: json && json.answer ? String(json.answer) : '' };
}

function stamp(admin, nowMs) {
    if (admin && admin.firestore && admin.firestore.Timestamp && typeof admin.firestore.Timestamp.fromMillis === 'function') {
        return admin.firestore.Timestamp.fromMillis(nowMs);
    }
    return nowMs;
}

function createTopicDiscussion(deps) {
    const d = deps || {};
    const db = d.db;
    const admin = d.admin;
    const HttpsError = d.HttpsError;
    const channels = d.channels || TOPIC_CHANNELS;
    const grounding = d.grounding || TOPIC_GROUNDING;
    const nowFn = d.now || function() { return Date.now(); };
    const askNacho = d.askNacho || defaultAskNacho;
    const mirror = d.mirror || function(args) {
        return mirrorShoutoutOnce({ db: db, docId: args.docId, collection: 'global_chat', text: args.text });
    };

    function fail(code, message) {
        throw new HttpsError(code, message);
    }

    function requireUser(context) {
        const who = callerFrom(context);
        if (!who.authed) fail('unauthenticated', 'Sign in to join the discussion.');
        if (who.anonymous) fail('permission-denied', 'Create an account to post. You can still read.');
        if (!cleanId(who.uid, 128)) fail('permission-denied', 'Sign in to join the discussion.');
        return who;
    }

    async function postTopicComment(data, context) {
        const who = requireUser(context);
        const body = data || {};
        const channelId = cleanId(body.channelId, 80);
        const meta = channelMeta(channelId, channels);
        if (!meta) fail('invalid-argument', 'That topic is not open for discussion.');
        const prepared = preparePostText(body.text);
        if (!prepared.ok) {
            const messages = {
                empty: 'Write a comment first.',
                length: 'Keep it under 500 characters.',
                pii: 'Phone numbers and email addresses are not allowed.',
                hate: 'That comment is not allowed.',
                scam: 'That comment is not allowed.',
                spam: 'That comment looks like spam.',
                profanity: 'That comment is not allowed.',
                shortener: 'Shortened links are not allowed.',
                invite: 'Invite links are not allowed.',
            };
            fail('invalid-argument', messages[prepared.code] || 'That comment is not allowed.');
        }
        const parentId = body.parentId ? cleanId(body.parentId, 128) : '';
        if (body.parentId && !parentId) fail('invalid-argument', 'That reply could not be posted.');
        let anchorIndex = null;
        if (body.anchorIndex != null && body.anchorIndex !== '') {
            const n = Number(body.anchorIndex);
            if (!Number.isInteger(n) || n < 0 || n > 20000) fail('invalid-argument', 'That note could not be attached.');
            anchorIndex = n;
        }
        let anchorId = '';
        if (body.anchorId) {
            anchorId = cleanId(String(body.anchorId), 80);
            if (!anchorId) fail('invalid-argument', 'That note could not be attached.');
        }

        const nowMs = nowFn();
        const userRef = db.collection('users').doc(who.uid);
        const ledgerRef = db.collection('faucet_ledger').doc(who.uid);
        const limitRef = db.collection('topic_discussion_limits').doc(who.uid);
        const topicRef = db.collection('topic_discussions').doc(channelId);
        const posts = topicRef.collection('posts');
        const parentRef = parentId ? posts.doc(parentId) : null;
        const postRef = posts.doc();
        const nachoCapRef = db.collection('topic_discussion_caps').doc('nacho');
        const hourRef = db.collection('topic_discussion_caps').doc('announce');
        const isTop = !parentId;
        // Injection still gets an unsure reply inside writeNachoReply, and never
        // reaches the model. The cap is reserved here so parallel posts cannot slip past it.
        const question = isTop && looksLikeQuestion(prepared.text);
        const title = displayTitle(meta, channelId);
        const forumPostId = isTop ? forumMirror.forumPostIdFor(channelId, postRef.id) : '';
        const summary = isTop ? await forumMirror.summarizeOpener(askNacho, prepared.text, title) : '';

        const planned = await db.runTransaction(async function(tx) {
            const userSnap = await tx.get(userRef);
            const ledgerSnap = await tx.get(ledgerRef);
            const limitSnap = await tx.get(limitRef);
            const topicSnap = isTop ? await tx.get(topicRef) : null;
            const hourSnap = isTop ? await tx.get(hourRef) : null;
            const parentSnap = parentRef ? await tx.get(parentRef) : null;
            const user = userSnap.exists ? (userSnap.data() || {}) : null;
            if (!user) fail('failed-precondition', 'Set a username first.');
            const block = moderationBlock(user, ledgerSnap.exists ? ledgerSnap.data() : null, nowMs);
            if (block) fail('permission-denied', "You can't post in discussions right now.");
            const name = cleanName(user.username);
            if (name.length < 2) fail('failed-precondition', 'Set a username first.');
            const limit = limitSnap.exists ? (limitSnap.data() || {}) : {};
            const rate = decideRate(limit, nowMs);
            if (!rate.ok) {
                fail('resource-exhausted', rate.code === 'daily'
                    ? 'Daily discussion limit reached. Try again tomorrow.'
                    : 'Slow down — wait a moment before posting again.');
            }
            let parent = null;
            if (parentRef) {
                if (!parentSnap || !parentSnap.exists) fail('not-found', 'That comment is no longer there.');
                parent = parentSnap.data() || {};
                if (parent.deleted === true || parent.hidden === true) fail('not-found', 'That comment is no longer there.');
                if (parent.parentId) fail('invalid-argument', 'Reply to the original comment.');
                if (parent.channelId && parent.channelId !== channelId) fail('invalid-argument', 'That reply could not be posted.');
            }
            let queueNacho = false;
            let nachoUserPatch = null;
            let nachoGlobalPatch = null;
            if (question) {
                const nachoSnap = await tx.get(nachoCapRef);
                const cap = decideNachoCap(limit, nachoSnap.exists ? nachoSnap.data() : null, nowMs);
                if (cap.allow) {
                    queueNacho = true;
                    nachoUserPatch = cap.user;
                    nachoGlobalPatch = cap.global;
                }
            }
            let forumSlot = null;
            let openForum = false;
            if (isTop && forumPostId) {
                forumSlot = forumMirror.reserveForumSlot(limit, nowMs, offsetDateKey);
                // A full Pleb Talk day must not mint another forum thread. The
                // topic comment still posts under the topic cap. A forum pace
                // hit (30s) also skips the cross-post; the topic pace already
                // refused a second topic comment inside that window.
                openForum = forumSlot.ok === true;
            }
            let announce = null;
            if (isTop) {
                const decision = decideAnnounce(
                    topicSnap && topicSnap.exists ? topicSnap.data() : null,
                    hourSnap && hourSnap.exists ? hourSnap.data() : null,
                    nowMs
                );
                if (decision.allow) {
                    announce = {
                        text: buildAnnouncement({
                            title: title,
                            text: prepared.text,
                            channelId: channelId,
                            postId: postRef.id,
                            forumPostId: openForum ? forumPostId : '',
                            isQuestion: question,
                        }),
                        lastAnnounceAtMs: decision.lastAnnounceAtMs,
                        hourKey: decision.hourKey,
                        count: decision.count,
                        forumPostId: openForum ? forumPostId : '',
                    };
                }
            }
            const limitNext = {
                lastPostMs: rate.lastPostMs,
                dayKey: rate.dayKey,
                dayCount: rate.dayCount,
            };
            if (openForum && forumSlot) {
                limitNext.forumDayKey = forumSlot.forumDayKey;
                limitNext.forumDayCount = forumSlot.forumDayCount;
                limitNext.lastForumPostMs = forumSlot.lastForumPostMs;
            }
            if (nachoUserPatch) {
                limitNext.nachoDayKey = nachoUserPatch.nachoDayKey;
                limitNext.nachoDayCount = nachoUserPatch.nachoDayCount;
            }
            tx.set(limitRef, limitNext, { merge: true });
            if (nachoGlobalPatch) tx.set(nachoCapRef, nachoGlobalPatch, { merge: true });
            if (announce) {
                tx.set(topicRef, { lastAnnounceAtMs: announce.lastAnnounceAtMs }, { merge: true });
                tx.set(hourRef, { hourKey: announce.hourKey, count: announce.count }, { merge: true });
            }
            const post = {
                channelId: channelId,
                uid: who.uid,
                name: name,
                text: prepared.text,
                parentId: parentId || '',
                anchorIndex: anchorIndex,
                anchorId: anchorId || '',
                createdAt: stamp(admin, nowMs),
                createdAtMs: nowMs,
                hidden: false,
                deleted: false,
                isNacho: false,
                linksRemoved: prepared.linksRemoved === true,
                replyCount: 0,
                forumPostId: openForum ? forumPostId : '',
            };
            if (openForum) {
                const forumDoc = forumMirror.buildForumPostDoc({
                    channelId: channelId,
                    postId: postRef.id,
                    forumPostId: forumPostId,
                    title: title,
                    summary: summary,
                    text: prepared.text,
                    uid: who.uid,
                    name: name,
                    faction: user.faction || null,
                    points: user.points || 0,
                    admin: admin,
                    nowMs: nowMs,
                });
                if (!forumDoc) fail('internal', 'Could not open the forum thread.');
                tx.set(db.collection('forum_posts').doc(forumDoc.id), forumDoc.data);
                post.summary = summary;
            }
            tx.set(postRef, post);
            if (parentRef) {
                const replyCount = Number(parent.replyCount) || 0;
                tx.set(parentRef, { replyCount: replyCount + 1 }, { merge: true });
            }
            return {
                postId: postRef.id,
                name: name,
                text: prepared.text,
                queueNacho: queueNacho,
                announce: announce,
                parent: parent,
                parentId: parentId || '',
                forumPostId: (openForum ? forumPostId : '') || (parent && parent.forumPostId) || '',
                post: post,
            };
        });

        if (planned.announce) {
            const chatId = ('td_' + channelId + '_' + planned.postId).slice(0, 700);
            try {
                await db.collection('global_chat').doc(chatId).set({
                    uid: NACHO_UID,
                    name: '🦌 Nacho',
                    text: planned.announce.text,
                    isNachoAuto: false,
                    topicChannel: channelId,
                    topicPost: planned.postId,
                    forumPost: planned.announce.forumPostId || planned.forumPostId || '',
                    ts: stamp(admin, nowMs),
                });
                await mirror({ docId: chatId, text: planned.announce.text });
            } catch (err) {
                console.warn('[topicDiscussion] announcement failed');
            }
        }

        if (planned.parent && planned.parent.uid && planned.parent.uid !== who.uid && planned.parent.uid !== NACHO_UID) {
            await writeReplyNotice(db, admin, nowMs, {
                recipientId: planned.parent.uid,
                senderId: who.uid,
                senderName: planned.name,
                channelId: channelId,
                postId: planned.postId,
                title: displayTitle(meta, channelId),
                snippet: snippetOf(planned.text),
            });
        }

        if (planned.parentId) {
            try {
                await forumMirror.mirrorTopicPost({
                    db: db,
                    admin: admin,
                    channelId: channelId,
                    postId: planned.postId,
                    post: planned.post,
                    nowMs: nowMs,
                    faction: null,
                    points: 0,
                });
            } catch (err) {
                console.warn('[topicDiscussion] forum reply mirror failed');
            }
        }

        let nachoPosted = false;
        if (planned.queueNacho) {
            nachoPosted = await writeNachoReply({
                db: db,
                admin: admin,
                askNacho: askNacho,
                nowMs: nowFn(),
                channelId: channelId,
                meta: meta,
                grounding: grounding,
                parentId: planned.postId,
                parentUid: who.uid,
                question: planned.text,
                title: displayTitle(meta, channelId),
            });
        }

        return {
            postId: planned.postId,
            announced: !!(planned.announce),
            nacho: nachoPosted === true,
        };
    }

    async function reportTopicComment(data, context) {
        const who = requireUser(context);
        const body = data || {};
        const channelId = cleanId(body.channelId, 80);
        const postId = cleanId(body.postId, 128);
        if (!channelMeta(channelId, channels) || !postId) fail('invalid-argument', 'That comment could not be reported.');
        const nowMs = nowFn();
        const postRef = db.collection('topic_discussions').doc(channelId).collection('posts').doc(postId);
        const reportRef = postRef.collection('reports').doc(who.uid);
        const limitRef = db.collection('topic_discussion_limits').doc(who.uid);
        let reason = cleanName(body.reason || '').slice(0, 200);
        if (reason) reason = maskChatProfanity(reason);
        await db.runTransaction(async function(tx) {
            const postSnap = await tx.get(postRef);
            const reportSnap = await tx.get(reportRef);
            const limitSnap = await tx.get(limitRef);
            const userSnap = await tx.get(db.collection('users').doc(who.uid));
            const ledgerSnap = await tx.get(db.collection('faucet_ledger').doc(who.uid));
            if (!postSnap.exists) fail('not-found', 'That comment is no longer there.');
            const post = postSnap.data() || {};
            if (post.deleted === true) fail('not-found', 'That comment is no longer there.');
            if (post.uid === who.uid) fail('invalid-argument', 'You cannot report your own comment.');
            const block = moderationBlock(userSnap.exists ? userSnap.data() : null, ledgerSnap.exists ? ledgerSnap.data() : null, nowMs);
            if (block) fail('permission-denied', "You can't report right now.");
            if (reportSnap.exists) return;
            const limit = limitSnap.exists ? (limitSnap.data() || {}) : {};
            const day = offsetDateKey(nowMs);
            const used = limit.reportDayKey === day ? (Number(limit.reportDayCount) || 0) : 0;
            if (used >= REPORTS_PER_DAY) fail('resource-exhausted', 'Report limit reached for today.');
            tx.set(reportRef, { uid: who.uid, reason: reason, createdAtMs: nowMs });
            tx.set(postRef, { reportCount: (Number(post.reportCount) || 0) + 1 }, { merge: true });
            tx.set(limitRef, { reportDayKey: day, reportDayCount: used + 1 }, { merge: true });
        });
        return { ok: true };
    }

    async function moderateTopicPost(data, context) {
        const who = callerFrom(context);
        if (!who.authed) fail('unauthenticated', 'Sign in required.');
        if (!who.admin) fail('permission-denied', 'Moderators only.');
        const body = data || {};
        const channelId = cleanId(body.channelId, 80);
        const postId = cleanId(body.postId, 128);
        const action = body.action === 'hide' || body.action === 'unhide' || body.action === 'delete' ? body.action : '';
        if (!channelMeta(channelId, channels) || !postId || !action) fail('invalid-argument', 'That moderation action is not valid.');
        const postRef = db.collection('topic_discussions').doc(channelId).collection('posts').doc(postId);
        const privateRef = db.collection('topic_discussion_private').doc(channelId + '~' + postId);
        const changed = await db.runTransaction(async function(tx) {
            const postSnap = await tx.get(postRef);
            const privateSnap = await tx.get(privateRef);
            if (!postSnap.exists) fail('not-found', 'That comment is no longer there.');
            const post = postSnap.data() || {};
            let after;
            if (action === 'hide') {
                if (post.text) {
                    tx.set(privateRef, {
                        text: post.text,
                        channelId: channelId,
                        postId: postId,
                        uid: post.uid || '',
                        hiddenAtMs: nowFn(),
                    });
                }
                after = Object.assign({}, post, { hidden: true, text: '', deleted: false });
                tx.set(postRef, { hidden: true, text: '', deleted: false }, { merge: true });
            } else if (action === 'unhide') {
                const saved = privateSnap.exists ? (privateSnap.data() || {}) : {};
                after = Object.assign({}, post, { hidden: false, text: saved.text || post.text || '', deleted: false });
                tx.set(postRef, { hidden: false, text: saved.text || post.text || '' }, { merge: true });
                tx.delete(privateRef);
            } else {
                after = Object.assign({}, post, { deleted: true, hidden: false, text: '' });
                tx.set(postRef, { deleted: true, hidden: false, text: '' }, { merge: true });
                tx.delete(privateRef);
            }
            return { before: post, after: after };
        });
        try {
            await forumMirror.syncTopicToForum({
                db: db,
                admin: admin,
                channelId: channelId,
                postId: postId,
                before: changed.before,
                after: changed.after,
            });
        } catch (err) {
            console.warn('[topicDiscussion] forum moderation mirror failed');
        }
        return { ok: true };
    }

    async function deleteTopicComment(data, context) {
        const who = requireUser(context);
        const body = data || {};
        const channelId = cleanId(body.channelId, 80);
        const postId = cleanId(body.postId, 128);
        if (!channelMeta(channelId, channels) || !postId) fail('invalid-argument', 'That comment could not be deleted.');
        const postRef = db.collection('topic_discussions').doc(channelId).collection('posts').doc(postId);
        const privateRef = db.collection('topic_discussion_private').doc(channelId + '~' + postId);
        const changed = await db.runTransaction(async function(tx) {
            const postSnap = await tx.get(postRef);
            if (!postSnap.exists) fail('not-found', 'That comment is no longer there.');
            const post = postSnap.data() || {};
            if (post.uid !== who.uid || post.isNacho === true) fail('permission-denied', 'You can only delete your own comment.');
            tx.set(postRef, { deleted: true, text: '', hidden: false }, { merge: true });
            tx.delete(privateRef);
            return { before: post, after: Object.assign({}, post, { deleted: true, text: '', hidden: false }) };
        });
        try {
            await forumMirror.syncTopicToForum({
                db: db,
                admin: admin,
                channelId: channelId,
                postId: postId,
                before: changed.before,
                after: changed.after,
            });
        } catch (err) {
            console.warn('[topicDiscussion] forum delete mirror failed');
        }
        return { ok: true };
    }

    return {
        postTopicComment: postTopicComment,
        reportTopicComment: reportTopicComment,
        moderateTopicPost: moderateTopicPost,
        deleteTopicComment: deleteTopicComment,
    };
}

async function writeReplyNotice(db, admin, nowMs, info) {
    const recipientId = cleanId(info.recipientId, 128);
    const postId = cleanId(info.postId, 128);
    if (!recipientId || !postId) return;
    const noticeId = ('tdreply_' + postId).slice(0, 140);
    const title = String(info.title || 'a topic').slice(0, 40);
    const snippet = String(info.snippet || '').slice(0, 60);
    const message = ('💬 ' + String(info.senderName || 'Someone') + ' replied in ' + title + ': "' + snippet + '"').slice(0, 200);
    try {
        await db.collection('notifications').doc(noticeId).set({
            recipientId: recipientId,
            senderId: info.senderId || NACHO_UID,
            senderName: String(info.senderName || 'Nacho').slice(0, 40),
            type: 'reply',
            message: message,
            targetType: 'topic_post',
            targetId: postId,
            topicChannel: info.channelId,
            status: 'completed',
            read: false,
            createdAt: stamp(admin, nowMs),
        });
    } catch (err) {
        console.warn('[topicDiscussion] notice failed');
    }
}

async function writeNachoReply(opts) {
    const o = opts || {};
    let answer = UNSURE;
    try {
        if (INJECTION_RE.test(o.question || '')) {
            answer = UNSURE;
        } else {
            const result = await o.askNacho({
                question: stripForModel(o.question),
                grounding: groundingFor(o.channelId, o.meta, o.grounding),
                channelTitle: o.title,
            });
            answer = sanitizeNachoAnswer(result && result.answer);
        }
    } catch (err) {
        answer = UNSURE;
    }
    const replyRef = o.db.collection('topic_discussions').doc(o.channelId).collection('posts').doc();
    const parentRef = o.db.collection('topic_discussions').doc(o.channelId).collection('posts').doc(o.parentId);
    const nowMs = o.nowMs || Date.now();
    try {
        await o.db.runTransaction(async function(tx) {
            const parentSnap = await tx.get(parentRef);
            if (!parentSnap.exists) return;
            const parent = parentSnap.data() || {};
            if (parent.deleted === true) return;
            tx.set(replyRef, {
                channelId: o.channelId,
                uid: NACHO_UID,
                name: 'Nacho',
                text: answer,
                parentId: o.parentId,
                anchorIndex: null,
                anchorId: '',
                createdAt: stamp(o.admin, nowMs),
                createdAtMs: nowMs,
                hidden: false,
                deleted: false,
                isNacho: true,
                linksRemoved: false,
                replyCount: 0,
            });
            tx.set(parentRef, { replyCount: (Number(parent.replyCount) || 0) + 1 }, { merge: true });
        });
        try {
            await forumMirror.mirrorTopicPost({
                db: o.db,
                admin: o.admin,
                channelId: o.channelId,
                postId: replyRef.id,
                nowMs: nowMs,
                post: {
                    channelId: o.channelId,
                    uid: NACHO_UID,
                    name: 'Nacho',
                    text: answer,
                    parentId: o.parentId,
                    createdAtMs: nowMs,
                    deleted: false,
                    hidden: false,
                    isNacho: true,
                },
            });
        } catch (err) {
            console.warn('[topicDiscussion] nacho forum mirror failed');
        }
        await writeReplyNotice(o.db, o.admin, nowMs, {
            recipientId: o.parentUid,
            senderId: NACHO_UID,
            senderName: 'Nacho',
            channelId: o.channelId,
            postId: replyRef.id,
            title: o.title,
            snippet: snippetOf(answer),
        });
        return true;
    } catch (err) {
        console.warn('[topicDiscussion] nacho reply failed');
        return false;
    }
}

module.exports = {
    TOPIC_LIMITS: TOPIC_LIMITS,
    UNSURE: UNSURE,
    offsetDateKey: offsetDateKey,
    preparePostText: preparePostText,
    looksLikeQuestion: looksLikeQuestion,
    snippetOf: snippetOf,
    buildAnnouncement: buildAnnouncement,
    moderationBlock: moderationBlock,
    decideRate: decideRate,
    decideNachoCap: decideNachoCap,
    decideAnnounce: decideAnnounce,
    topicStickyScrollDelta: topicStickyScrollDelta,
    sanitizeNachoAnswer: sanitizeNachoAnswer,
    groundingFor: groundingFor,
    channelMeta: channelMeta,
    createTopicDiscussion: createTopicDiscussion,
};
