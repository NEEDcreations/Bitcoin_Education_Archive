'use strict';

// Pays 30 XP when an article document becomes published.
// This file is the only payer. awardActions.js must keep rejecting
// "📝 Article published", so an allowlist rewrite cannot pay it again.
// Premium does not multiply this grant. Double XP does not apply.
// The daily cap and taper still apply, through planDailyXp.

const { planDailyXp } = require('./dailyXp');
const { offsetDateKey } = require('./offsetDay');
const { moderateText } = require('./moderateText');
const { rewardBlocked } = require('./cipherClaim');

const PUBLISH_XP = 30;
const DAILY_ARTICLE_LIMIT = 2;
const MIN_BODY_CHARS = 300;
const MIN_WORDS = 50;
const MIN_DISTINCT = 8;
const MAX_BODY_CHARS = 50000;
const REVERSE_WINDOW_MS = 24 * 60 * 60 * 1000;
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const ARTICLE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function isTagStart(ch) {
    if (!ch) return false;
    const code = ch.charCodeAt(0);
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || ch === '/' || ch === '!';
}

function tagName(inside) {
    let i = inside.charCodeAt(0) === 47 ? 1 : 0;
    let name = '';
    while (i < inside.length && name.length < 12) {
        const code = inside.charCodeAt(i);
        const lower = code >= 65 && code <= 90 ? code + 32 : code;
        if ((lower >= 97 && lower <= 122) || (code >= 48 && code <= 57)) {
            name += String.fromCharCode(lower);
            i++;
        } else break;
    }
    return name;
}

function findCloseTag(src, from, name) {
    const needle = '</' + name;
    const n = src.length;
    const m = needle.length;
    for (let i = from; i + m <= n; i++) {
        let ok = true;
        for (let k = 0; k < m; k++) {
            let code = src.charCodeAt(i + k);
            if (code >= 65 && code <= 90) code += 32;
            if (code !== needle.charCodeAt(k)) { ok = false; break; }
        }
        if (!ok) continue;
        let j = i + m;
        const limit = Math.min(n, j + 20);
        while (j < limit && src[j] !== '>') j++;
        if (src[j] === '>') return j + 1;
        return -1;
    }
    return -1;
}

function skipLink(src, start) {
    const n = src.length;
    let i = start + 1;
    const textLimit = Math.min(n, start + 200);
    while (i < textLimit && src[i] !== ']') i++;
    if (i >= textLimit || src[i] !== ']') return -1;
    i++;
    if (src[i] !== '(') return -1;
    i++;
    const urlLimit = Math.min(n, i + 500);
    while (i < urlLimit && src[i] !== ')') i++;
    if (i >= urlLimit || src[i] !== ')') return -1;
    return i + 1;
}

function skipEntity(src, start) {
    const n = src.length;
    let i = start + 1;
    if (i >= n) return -1;
    if (src[i] === '#') {
        i++;
        const hex = src[i] === 'x' || src[i] === 'X';
        if (hex) i++;
        const begin = i;
        while (i < n && i - begin < 8) {
            const code = src.charCodeAt(i);
            const digit = code >= 48 && code <= 57;
            const alpha = hex && ((code >= 65 && code <= 70) || (code >= 97 && code <= 102));
            if (!digit && !alpha) break;
            i++;
        }
        if (i === begin || src[i] !== ';') return -1;
        return i + 1;
    }
    const begin = i;
    while (i < n && i - begin < 12) {
        const code = src.charCodeAt(i);
        if (!((code >= 65 && code <= 90) || (code >= 97 && code <= 122))) break;
        i++;
    }
    if (i === begin || src[i] !== ';') return -1;
    return i + 1;
}

function isInvisible(code) {
    return code === 0x00AD
        || code === 0x034F
        || code === 0x061C
        || code === 0x180E
        || (code >= 0x200B && code <= 0x200F)
        || (code >= 0x202A && code <= 0x202E)
        || (code >= 0x2060 && code <= 0x2064)
        || (code >= 0x2066 && code <= 0x206F)
        || code === 0xFEFF
        || (code >= 0xFE00 && code <= 0xFE0F);
}

function stripInvisible(text) {
    const src = String(text || '');
    let out = '';
    for (let i = 0; i < src.length; i++) {
        if (!isInvisible(src.charCodeAt(i))) out += src[i];
    }
    return out;
}

// One forward pass. A '<' or '[' that is not a real tag or link is copied
// and the scan moves one character, so a megabyte of either stays linear.
function stripMarkup(text) {
    const src = String(text || '');
    const n = src.length;
    let out = '';
    let pendingSpace = false;
    function space() {
        if (out.length) pendingSpace = true;
    }
    function emit(ch) {
        if (pendingSpace) {
            out += ' ';
            pendingSpace = false;
        }
        out += ch;
    }
    let i = 0;
    while (i < n) {
        const c = src[i];
        if (c === '<') {
            if (!isTagStart(src[i + 1])) {
                emit('<');
                i++;
                continue;
            }
            let j = i + 1;
            const limit = Math.min(n, i + 201);
            while (j < limit && src[j] !== '>') j++;
            if (j >= n || src[j] !== '>') {
                emit('<');
                i++;
                continue;
            }
            const name = tagName(src.slice(i + 1, j));
            if (name === 'script' || name === 'style') {
                const end = findCloseTag(src, j + 1, name);
                // No closer: drop the rest. Searching again from the next
                // '<' would rescan the same tail for every repeated opener.
                i = end === -1 ? n : end;
            } else {
                i = j + 1;
            }
            space();
            continue;
        }
        if (c === '!' && src[i + 1] === '[') {
            const end = skipLink(src, i + 1);
            if (end === -1) { emit('!'); i++; continue; }
            space();
            i = end;
            continue;
        }
        if (c === '[') {
            if (src[i + 1] === '[') { emit('['); i++; continue; }
            const end = skipLink(src, i);
            if (end === -1) { emit('['); i++; continue; }
            space();
            i = end;
            continue;
        }
        if (c === '&') {
            const end = skipEntity(src, i);
            if (end === -1) { emit('&'); i++; continue; }
            space();
            i = end;
            continue;
        }
        const code = c.charCodeAt(0);
        if (code === 32 || code === 9 || code === 10 || code === 13 || code === 12) {
            space();
            i++;
            continue;
        }
        emit(c);
        i++;
    }
    return out.trim();
}

const LETTER_OR_NUMBER = /\p{L}|\p{N}/u;

function distinctLetters(text) {
    const seen = new Set();
    for (const ch of text) {
        if (!LETTER_OR_NUMBER.test(ch)) continue;
        seen.add(ch.toLowerCase());
        if (seen.size >= MIN_DISTINCT) return seen.size;
    }
    return seen.size;
}

function isPublished(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.deleted === true) return false;
    return data.status === 'published';
}

function becamePublished(before, after) {
    return isPublished(after) && !isPublished(before);
}

function assessQuality(article) {
    const raw = article && article.body != null ? String(article.body) : '';
    // Length is the first check. A huge body never reaches a scan, and the
    // caller still writes the marker so the article cannot be retried.
    if (raw.length > MAX_BODY_CHARS) return { ok: false, reason: 'too_long', body: '' };
    const body = stripMarkup(stripInvisible(raw));
    const words = body.split(/\s+/u).filter(Boolean);
    if (body.length < MIN_BODY_CHARS || words.length < MIN_WORDS || distinctLetters(body) < MIN_DISTINCT) {
        return { ok: false, reason: 'too_short', body: body };
    }
    const title = String((article && article.title) || '');
    const verdict = moderateText(title + '\n' + body);
    if (!verdict.clean) return { ok: false, reason: 'filtered', body: body };
    return { ok: true, body: body };
}

function markerPayload(fields) {
    return {
        uid: fields.uid,
        awarded: fields.awarded,
        nominal: PUBLISH_XP,
        dropped: fields.dropped,
        atMs: fields.nowMs,
        day: fields.day,
        reason: fields.reason,
        reversed: false,
    };
}

async function grantArticlePublish(opts) {
    const o = opts || {};
    const db = o.db;
    const adminSdk = o.admin;
    const articleId = String(o.articleId || '');
    const uid = String(o.uid || '');
    const nowMs = Number.isFinite(Number(o.nowMs)) ? Number(o.nowMs) : Date.now();
    if (!db || !adminSdk) return { paid: false, awarded: 0, reason: 'missing' };
    if (!ARTICLE_ID_RE.test(articleId)) return { paid: false, awarded: 0, reason: 'bad_id' };
    if (!UID_RE.test(uid)) return { paid: false, awarded: 0, reason: 'wrong_author' };

    const articleRef = db.collection('articles').doc(articleId);
    const markerRef = db.collection('article_xp').doc(articleId);
    const userRef = db.collection('users').doc(uid);
    const ledgerRef = db.collection('faucet_ledger').doc(uid);
    const day = offsetDateKey(nowMs);
    const dailyRef = userRef.collection('daily_points').doc(day);
    const countRef = userRef.collection('article_publish_days').doc(day);

    return db.runTransaction(async function (tx) {
        const articleSnap = await tx.get(articleRef);
        const markerSnap = await tx.get(markerRef);
        const userSnap = await tx.get(userRef);
        const ledgerSnap = await tx.get(ledgerRef);
        const dailySnap = await tx.get(dailyRef);
        const countSnap = await tx.get(countRef);

        if (markerSnap.exists) {
            const prev = markerSnap.data() || {};
            return { paid: false, awarded: 0, reason: 'already', uid: prev.uid || uid, day: prev.day || day };
        }
        if (!articleSnap.exists) return { paid: false, awarded: 0, reason: 'missing' };
        const article = articleSnap.data() || {};
        if (article.authorId !== uid) return { paid: false, awarded: 0, reason: 'wrong_author' };
        if (!isPublished(article)) {
            const reason = article.status === 'draft' || article.status == null || article.status === ''
                ? 'draft'
                : 'not_published';
            return { paid: false, awarded: 0, reason: reason };
        }

        const quality = assessQuality(article);
        const user = userSnap.exists ? (userSnap.data() || {}) : null;
        const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : null;
        const count = countSnap.exists ? Number((countSnap.data() || {}).count || 0) : 0;
        const dailyUsed = dailySnap.exists ? Number((dailySnap.data() || {}).total || 0) : 0;

        let reason = 'paid';
        let awarded = 0;
        let dropped = 0;
        let consume = false;

        if (!quality.ok) {
            reason = quality.reason;
        } else if (!userSnap.exists) {
            return { paid: false, awarded: 0, reason: 'no_user', retry: true };
        } else if (rewardBlocked(user, ledger)) {
            reason = 'banned';
        } else if (count >= DAILY_ARTICLE_LIMIT) {
            reason = 'daily_limit';
        } else {
            const plan = planDailyXp(dailyUsed, PUBLISH_XP);
            awarded = plan.awarded;
            dropped = plan.dropped;
            if (awarded > 0) {
                reason = 'paid';
                consume = true;
            } else {
                reason = 'cap';
            }
        }

        tx.set(markerRef, markerPayload({
            uid: uid,
            awarded: awarded,
            dropped: dropped,
            nowMs: nowMs,
            day: day,
            reason: reason,
        }));
        if (awarded > 0) {
            tx.update(userRef, {
                points: adminSdk.firestore.FieldValue.increment(awarded),
                weeklyXP: adminSdk.firestore.FieldValue.increment(awarded),
                monthlyXP: adminSdk.firestore.FieldValue.increment(awarded),
            });
            tx.set(dailyRef, {
                total: dailyUsed + awarded,
                lastUpdated: adminSdk.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        if (consume) {
            tx.set(countRef, { count: count + 1, day: day, uid: uid }, { merge: true });
        }
        return {
            paid: awarded > 0,
            awarded: awarded,
            dropped: dropped,
            reason: reason,
            uid: uid,
            day: day,
        };
    });
}

async function reverseArticlePublish(opts) {
    const o = opts || {};
    const db = o.db;
    const articleId = String(o.articleId || '');
    const nowMs = Number.isFinite(Number(o.nowMs)) ? Number(o.nowMs) : Date.now();
    if (!db) return { reversed: false, reason: 'missing' };
    if (!ARTICLE_ID_RE.test(articleId)) return { reversed: false, reason: 'bad_id' };

    const markerRef = db.collection('article_xp').doc(articleId);
    return db.runTransaction(async function (tx) {
        const markerSnap = await tx.get(markerRef);
        if (!markerSnap.exists) return { reversed: false, reason: 'no_marker' };
        const marker = markerSnap.data() || {};
        if (marker.reversed === true) return { reversed: false, reason: 'already_reversed' };
        const awarded = Math.max(0, Math.floor(Number(marker.awarded) || 0));
        if (awarded <= 0) return { reversed: false, reason: 'unpaid' };
        const atMs = Number(marker.atMs) || 0;
        if (!atMs || nowMs - atMs > REVERSE_WINDOW_MS) {
            return { reversed: false, reason: 'window' };
        }
        const uid = String(marker.uid || '');
        if (!UID_RE.test(uid)) return { reversed: false, reason: 'wrong_author' };

        const userRef = db.collection('users').doc(uid);
        const day = String(marker.day || '');
        const dailyRef = userRef.collection('daily_points').doc(day);
        const countRef = userRef.collection('article_publish_days').doc(day);
        const userSnap = await tx.get(userRef);
        const dailySnap = await tx.get(dailyRef);
        const countSnap = await tx.get(countRef);

        if (userSnap.exists) {
            const user = userSnap.data() || {};
            tx.update(userRef, {
                points: Math.max(0, (Number(user.points) || 0) - awarded),
                weeklyXP: Math.max(0, (Number(user.weeklyXP) || 0) - awarded),
                monthlyXP: Math.max(0, (Number(user.monthlyXP) || 0) - awarded),
            });
        }
        if (dailySnap.exists) {
            const total = Number((dailySnap.data() || {}).total || 0);
            tx.set(dailyRef, { total: Math.max(0, total - awarded) }, { merge: true });
        }
        if (countSnap.exists) {
            const count = Number((countSnap.data() || {}).count || 0);
            tx.set(countRef, { count: Math.max(0, count - 1) }, { merge: true });
        }
        tx.set(markerRef, {
            reversed: true,
            reversedAtMs: nowMs,
        }, { merge: true });
        return { reversed: true, awarded: awarded, uid: uid };
    });
}

async function handleArticlePublishWrite(opts) {
    const o = opts || {};
    const before = o.before || null;
    const after = o.after || null;
    if (!after) return reverseArticlePublish(o);
    if (!becamePublished(before, after)) return { paid: false, awarded: 0, reason: 'not_publish' };
    return grantArticlePublish(Object.assign({}, o, { uid: after.authorId }));
}

module.exports = {
    PUBLISH_XP: PUBLISH_XP,
    DAILY_ARTICLE_LIMIT: DAILY_ARTICLE_LIMIT,
    MIN_BODY_CHARS: MIN_BODY_CHARS,
    MIN_WORDS: MIN_WORDS,
    MIN_DISTINCT: MIN_DISTINCT,
    MAX_BODY_CHARS: MAX_BODY_CHARS,
    REVERSE_WINDOW_MS: REVERSE_WINDOW_MS,
    stripMarkup: stripMarkup,
    isPublished: isPublished,
    becamePublished: becamePublished,
    grantArticlePublish: grantArticlePublish,
    reverseArticlePublish: reverseArticlePublish,
    handleArticlePublishWrite: handleArticlePublishWrite,
};
