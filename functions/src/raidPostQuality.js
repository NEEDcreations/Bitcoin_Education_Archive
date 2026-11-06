'use strict';

// Raid quality bar for forum posts and articles. Markup stripping and the
// Unicode letter-or-number distinct-character check are the same helpers as
// the article check (early exit at 8). This file does not grant XP and does
// not load firebase-admin.
//
// A post deals damage only when the visible text has about 300 characters,
// 40 words, and 25 distinct words, and at least 8 distinct letters or numbers.

const crypto = require('crypto');

const MIN_CHARS = 300;
const MIN_WORDS = 40;
const MIN_DISTINCT_WORDS = 25;
const MIN_DISTINCT = 8;
const DUP_JACCARD = 0.8;

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


function visibleText(raw) {
    return stripMarkup(stripInvisible(raw));
}

function wordsOf(visible) {
    return String(visible || '').split(/\s+/u).filter(Boolean);
}

function distinctWordCount(words) {
    const seen = new Set();
    for (let i = 0; i < words.length; i++) {
        const token = String(words[i] || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
        if (token) seen.add(token);
    }
    return seen.size;
}

function normalizeForDup(raw) {
    return visibleText(raw).toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function textHash(normalized) {
    return crypto.createHash('sha256').update(String(normalized || ''), 'utf8').digest('hex');
}

function shinglesOf(normalized) {
    const words = String(normalized || '').split(' ').filter(Boolean);
    const set = new Set();
    if (words.length < 3) {
        if (words.length) set.add(words.join(' '));
        return set;
    }
    for (let i = 0; i <= words.length - 3; i++) {
        set.add(words[i] + ' ' + words[i + 1] + ' ' + words[i + 2]);
    }
    return set;
}

function jaccard(left, right) {
    if (!left.size && !right.size) return 1;
    let inter = 0;
    left.forEach(function (item) { if (right.has(item)) inter += 1; });
    const union = left.size + right.size - inter;
    if (!union) return 1;
    return inter / union;
}

function isNearDuplicate(normalized, others) {
    const hash = textHash(normalized);
    const mine = shinglesOf(normalized);
    const list = others || [];
    for (let i = 0; i < list.length; i++) {
        const other = String(list[i] || '');
        if (!other) continue;
        if (textHash(other) === hash) return true;
        if (jaccard(mine, shinglesOf(other)) >= DUP_JACCARD) return true;
    }
    return false;
}

function assessRaidQuality(raw) {
    const body = visibleText(raw);
    const words = wordsOf(body);
    const distinctWords = distinctWordCount(words);
    const letters = distinctLetters(body);
    const ok = body.length >= MIN_CHARS && words.length >= MIN_WORDS && distinctWords >= MIN_DISTINCT_WORDS && letters >= MIN_DISTINCT;
    const normalized = normalizeForDup(raw);
    return {
        ok: ok,
        reason: ok ? '' : 'quality',
        chars: body.length,
        words: words.length,
        distinctWords: distinctWords,
        letters: letters,
        normalized: normalized,
        hash: textHash(normalized),
    };
}

module.exports = {
    MIN_CHARS: MIN_CHARS,
    MIN_WORDS: MIN_WORDS,
    MIN_DISTINCT_WORDS: MIN_DISTINCT_WORDS,
    MIN_DISTINCT: MIN_DISTINCT,
    DUP_JACCARD: DUP_JACCARD,
    stripInvisible: stripInvisible,
    stripMarkup: stripMarkup,
    distinctLetters: distinctLetters,
    visibleText: visibleText,
    normalizeForDup: normalizeForDup,
    textHash: textHash,
    shinglesOf: shinglesOf,
    isNearDuplicate: isNearDuplicate,
    assessRaidQuality: assessRaidQuality,
};
