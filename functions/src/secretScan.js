'use strict';

// Seed and key scan for topic posts. Mirrors workers/nacho-search/secret-detect.mjs.
// Cloud Functions only deploy this directory, so the word list is copied here.

const BIP39_WORDS = require('./bip39-en.json');

const BIP39 = new Set(BIP39_WORDS);
const WORD_INDEX = new Map();
const PREFIX_UNIQUE = new Map();
const PREFIX_COUNT = new Map();
BIP39_WORDS.forEach(function (word, index) {
    WORD_INDEX.set(word, index);
    if (word.length < 4) return;
    const prefix = word.slice(0, 4);
    PREFIX_COUNT.set(prefix, (PREFIX_COUNT.get(prefix) || 0) + 1);
});
BIP39_WORDS.forEach(function (word) {
    if (word.length < 4) return;
    const prefix = word.slice(0, 4);
    if (PREFIX_COUNT.get(prefix) === 1) PREFIX_UNIQUE.set(prefix, word);
});
const GAP = new Set("a an the and or of to for in on is are was were be been being with from it its i me my we our you your he she his her they them their at by as if but so no not yes just into per also then than too very do did does am".split(" "));
const FUNC_BREAK = new Set("the a an or when about your".split(" "));
const ZW_RE = /[\u200B-\u200D\uFEFF\u2060\u00AD\u180E\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const HOMO = {
    "\u0430": "a", "\u0435": "e", "\u043e": "o", "\u0440": "p", "\u0441": "c", "\u0443": "y", "\u0445": "x",
    "\u0456": "i", "\u0455": "s", "\u0458": "j", "\u04bb": "h", "\u043a": "k", "\u043c": "m", "\u0442": "t",
    "\u043d": "h", "\u0432": "b", "\u0454": "e", "\u0473": "f", "\u0501": "d",
    "\u03b1": "a", "\u03b5": "e", "\u03bf": "o", "\u03c1": "p", "\u03c4": "t", "\u03c5": "u", "\u03bd": "v",
    "\u03ba": "k", "\u03b9": "i", "\u03b7": "n", "\u03c7": "x", "\u03b3": "y", "\u03b2": "b", "\u03c9": "w"
};
const KEY_LABEL_RE = /\b(private[_\s-]?key|secret[_\s-]?key|privkey|priv[_\s-]?key|pk|priv|wif|secret|key)\b/g;
const HANDOFF_VERB = "send|share|give|dm|message|provide|import|enter|type|paste|upload|submit|tell|reply";
const HANDOFF_NOUN = "seed(?:\\s+phrase|\\s+words)?|mnemonic|recovery\\s+phrase|12\\s+words|24\\s+words|private\\s+key|wif|xprv";
const HANDOFF_RE = new RegExp("\\b(?:" + HANDOFF_VERB + ")\\b([^.;!?:\\n]{0,80})\\b(?:" + HANDOFF_NOUN + ")\\b", "i");
const XPRV_RE = /\b[tuvxyz]prv[1-9A-HJ-NP-Za-km-z]{10,}\b/i;
const WIF_RE = /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/;
const MINIKEY_RE = /\bS[1-9A-HJ-NP-Za-km-z]{21}(?:[1-9A-HJ-NP-Za-km-z]{4}){0,2}\b/;
const TX_LABEL_RE = /\b(txid|tx id|transaction(?: id| hash)?|block ?hash|blockhash)\b/g;
const PARTY_RE = /\b(?:me|us|support|admin|administrator)\b|\bthis address\b|@[a-z0-9_]{2,}|\ba link\b|\bhere\b|\bthis (?:app|site|chat|form|page|bot)\b|https?:\/\/|www\./i;
const WALLET_RESTORE_RE = /\b(?:wallet|device)\b/i;
const RESTORE_VERB_RE = /\b(?:enter|type|import|paste)\b/i;
const ALLOW_HOST_RE = /^(?:[a-z0-9-]+\.)*(?:bitcoineducation\.quest|bitcoin\.org|mempool\.space|github\.com|bitcoin\.it|learnmeabitcoin\.com|findahelpline\.com|stackexchange\.com)$/i;
const SHA_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

const HIDDEN_SECRET = "[hidden: looked like a seed phrase or private key]";

function normalizeForScan(text) {
    let value = String(text || "");
    try { value = value.normalize("NFKC"); } catch (e) {}
    value = value.replace(ZW_RE, "").toLowerCase();
    let out = "";
    for (let i = 0; i < value.length; i++) {
        const ch = value.charAt(i);
        out += HOMO[ch] || ch;
    }
    return out;
}

function rotr(x, n) {
    return (x >>> n) | (x << (32 - n));
}

function sha256(bytes) {
    const bitLen = bytes.length * 8;
    const withOne = bytes.length + 1 + 8;
    const padLen = withOne + ((64 - (withOne % 64)) % 64);
    const data = new Uint8Array(padLen);
    data.set(bytes);
    data[bytes.length] = 0x80;
    const view = new DataView(data.buffer);
    view.setUint32(padLen - 4, bitLen >>> 0, false);
    const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const w = new Uint32Array(64);
    for (let off = 0; off < padLen; off += 64) {
        for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + (i * 4), false);
        for (let i = 16; i < 64; i++) {
            const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
        }
        let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
        for (let i = 0; i < 64; i++) {
            const s1b = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const ch = (e & f) ^ ((~e) & g);
            const t1 = (hh + s1b + ch + SHA_K[i] + w[i]) >>> 0;
            const s0b = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (s0b + maj) >>> 0;
            hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        h[0] = (h[0] + a) >>> 0;
        h[1] = (h[1] + b) >>> 0;
        h[2] = (h[2] + c) >>> 0;
        h[3] = (h[3] + d) >>> 0;
        h[4] = (h[4] + e) >>> 0;
        h[5] = (h[5] + f) >>> 0;
        h[6] = (h[6] + g) >>> 0;
        h[7] = (h[7] + hh) >>> 0;
    }
    const out = new Uint8Array(32);
    const ov = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i], false);
    return out;
}

function resolveWord(token) {
    if (BIP39.has(token)) return token;
    if (token.length === 4 && PREFIX_UNIQUE.has(token)) return PREFIX_UNIQUE.get(token);
    return "";
}

function checksumOk(words) {
    const n = words.length;
    if (n !== 12 && n !== 15 && n !== 18 && n !== 21 && n !== 24) return false;
    const bits = [];
    for (let i = 0; i < n; i++) {
        const idx = WORD_INDEX.get(words[i]);
        if (idx == null) return false;
        for (let b = 10; b >= 0; b--) bits.push((idx >> b) & 1);
    }
    const csLen = n / 3;
    const entLen = bits.length - csLen;
    const entropy = new Uint8Array(entLen / 8);
    for (let i = 0; i < entLen; i++) {
        if (bits[i]) entropy[i >> 3] |= 1 << (7 - (i & 7));
    }
    const hash = sha256(entropy);
    let got = 0;
    let expect = 0;
    for (let i = 0; i < csLen; i++) got = (got << 1) | bits[entLen + i];
    for (let i = 0; i < csLen; i++) expect = (expect << 1) | ((hash[i >> 3] >> (7 - (i & 7))) & 1);
    return got === expect;
}

function windowChecksum(run) {
    const sizes = [12, 15, 18, 21, 24];
    for (let s = 0; s < sizes.length; s++) {
        const size = sizes[s];
        if (run.length < size) continue;
        for (let i = 0; i <= run.length - size; i++) {
            if (checksumOk(run.slice(i, i + size))) return true;
        }
    }
    return false;
}

function editDistance(a, b) {
    const gap = a.length - b.length;
    if (gap > 2 || gap < -2) return 3;
    const prev = new Uint8Array(b.length + 1);
    const next = new Uint8Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
        next[0] = i;
        let best = next[0];
        for (let j = 1; j <= b.length; j++) {
            const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
            const del = prev[j] + 1;
            const ins = next[j - 1] + 1;
            const sub = prev[j - 1] + cost;
            const val = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
            next[j] = val;
            if (val < best) best = val;
        }
        if (best > 2) return 3;
        prev.set(next);
    }
    return prev[b.length];
}

function nearMiss(token) {
    if (!token || token.length < 3 || token.length > 10) return false;
    if (GAP.has(token) || FUNC_BREAK.has(token) || BIP39.has(token)) return false;
    for (let i = 0; i < BIP39_WORDS.length; i++) {
        const word = BIP39_WORDS[i];
        if (Math.abs(word.length - token.length) > 2) continue;
        if (editDistance(token, word) <= 2) return true;
    }
    return false;
}

function hasSeedPhrase(text) {
    const norm = normalizeForScan(text);
    const segments = norm.replace(/(^|[^a-z0-9])(\d+)\.(?=\s|$)/g, "$1$2 ").split(/[.!?;]+/);
    for (let s = 0; s < segments.length; s++) {
        const tokens = segments[s].split(/[^a-z0-9]+/).filter(Boolean);
        const run = [];
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (/^\d+$/.test(token)) continue;
            // A unique 4-letter prefix (than → thank) counts even when the prefix is a gap word.
            const resolved = resolveWord(token);
            if (resolved) {
                run.push(resolved);
                if (run.length > 64) run.shift();
                if (windowChecksum(run)) return true;
                continue;
            }
            if (GAP.has(token) && !BIP39.has(token)) continue;
            run.length = 0;
        }
    }
    const dense = norm.split(/[.!?;,]+/);
    for (let s = 0; s < dense.length; s++) {
        const tokens = dense[s].split(/[^a-z0-9]+/).filter(Boolean);
        let exact = 0;
        let typos = 0;
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (/^\d+$/.test(token) || FUNC_BREAK.has(token) || (GAP.has(token) && !BIP39.has(token))) {
                exact = 0;
                typos = 0;
                continue;
            }
            if (BIP39.has(token)) {
                exact += 1;
            } else if (typos < 2 && nearMiss(token)) {
                typos += 1;
            } else {
                exact = 0;
                typos = 0;
                continue;
            }
            if (exact >= 11 && typos >= 1 && typos <= 2) return true;
        }
    }
    return false;
}

function nearest(re, text) {
    const flags = re.flags.indexOf("g") === -1 ? re.flags + "g" : re.flags;
    const scan = new RegExp(re.source, flags);
    let at = -1;
    let match;
    while ((match = scan.exec(text))) {
        at = match.index;
        if (match.index === scan.lastIndex) scan.lastIndex += 1;
    }
    return at;
}

function hasHexSecret(text) {
    const lower = normalizeForScan(text);
    if (/\b0x[a-f0-9]{64}\b/.test(lower)) return true;
    const hex = /\b[a-f0-9]{64}\b/g;
    let match;
    while ((match = hex.exec(lower))) {
        const before = lower.slice(Math.max(0, match.index - 80), match.index);
        const keyAt = nearest(KEY_LABEL_RE, before);
        const txAt = nearest(TX_LABEL_RE, before);
        if (txAt >= 0 && (keyAt < 0 || txAt > keyAt)) continue;
        return true;
    }
    return false;
}

function containsKeyMaterial(text) {
    const raw = String(text || "");
    if (hasSeedPhrase(raw)) return true;
    if (WIF_RE.test(raw)) return true;
    if (XPRV_RE.test(raw)) return true;
    if (MINIKEY_RE.test(raw)) return true;
    if (hasHexSecret(raw)) return true;
    return false;
}

function redactSecretText(text) {
    const raw = String(text || "");
    if (!containsKeyMaterial(raw)) return raw;
    return HIDDEN_SECRET;
}

const CLAUSE_MARKS = [",", ".", "\n", ";", "!", "?", ":"];
const NOT_A_SCAM_RE = /\b(?:isn'?t|is not|not)\s+a\s+scam\b/g;
const HOLLOW_RE = /\b(?:never\s+(?:miss|forget|ignore|skip|fear|seen|mind)|(?:don'?t|do not)\s+(?:miss|worry|sleep|forget|fear|panic)|(?:don'?t|do not)\s+be\s+(?:scared|afraid))\b/g;
const WARN_RE = /\b(?:never|anyone who asks|red flag|don'?t|do not|a scammer will|scammers?|scammed|fake|scam|fraud|beware|trick|warning)\b/;
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/;
const SEND_TO_RE = /\bsend\b[^.]{0,40}\bto\b/;
const WORDS_HANDOFF_RE = /\b(?:send|share|give|dm|message|provide|paste|reply)\b[^.;!?:\n]{0,40}\bwords\b/gi;

function flattenUrls(lower) {
    return String(lower || "").replace(/\b(?:https?:\/\/|www\.)\S+/g, " https://link ");
}

function clauseBefore(lower, idx) {
    const before = lower.slice(0, idx);
    let cut = -1;
    for (let i = 0; i < CLAUSE_MARKS.length; i++) cut = Math.max(cut, before.lastIndexOf(CLAUSE_MARKS[i]));
    return before.slice(cut + 1);
}

function clauseEnd(lower, idx) {
    let end = lower.length;
    for (let i = 0; i < CLAUSE_MARKS.length; i++) {
        const at = lower.indexOf(CLAUSE_MARKS[i], idx);
        if (at >= 0 && at < end) end = at;
    }
    return end;
}

function normalizeForPhrases(text) {
    const folded = normalizeForScan(text).replace(/[013457]/g, function (ch, index, source) {
        const prev = source.charAt(index - 1);
        const next = source.charAt(index + 1);
        if (/[0-9]/.test(prev) || /[0-9]/.test(next)) return ch;
        if (!/[a-z]/.test(prev) && !/[a-z]/.test(next)) return ch;
        return ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t" })[ch];
    });
    return folded.replace(/\bur\b/g, "your");
}

function scrubCues(clause) {
    return String(clause || "").replace(NOT_A_SCAM_RE, " ").replace(HOLLOW_RE, " ");
}

function warningContext(text) {
    return WARN_RE.test(scrubCues(normalizeForPhrases(text)));
}

function ownWalletEntry(text) {
    const lower = normalizeForPhrases(text);
    if (!RESTORE_VERB_RE.test(lower) || !WALLET_RESTORE_RE.test(lower)) return false;
    if (PARTY_RE.test(lower)) return false;
    return true;
}

function clauseNegated(clause) {
    const cleaned = scrubCues(clause);
    return /\b(not|no|never|without|avoid)\b/.test(cleaned) || /n't/.test(cleaned);
}

function warningInClause(clause) {
    return WARN_RE.test(scrubCues(clause));
}

function contactInSpan(span) {
    const text = String(span || "");
    return PARTY_RE.test(text) || PHONE_RE.test(text) || SEND_TO_RE.test(text);
}

function recipientSpan(lower, idx) {
    return lower.slice(idx, clauseEnd(lower, idx));
}

function quoteSpans(lower) {
    const spans = [];
    const re = /(?:^|[^a-z0-9])(['"“”])([^'"“”]{1,300})\1/g;
    let match;
    while ((match = re.exec(lower))) {
        const q = match[0].indexOf(match[1]);
        const start = match.index + q;
        spans.push([start, start + match[2].length + 2]);
        if (match.index === re.lastIndex) re.lastIndex += 1;
    }
    return spans;
}

function insideQuotes(lower, idx) {
    const spans = quoteSpans(lower);
    for (let i = 0; i < spans.length; i++) {
        if (idx >= spans[i][0] && idx < spans[i][1]) return true;
    }
    return false;
}

function outsideQuotes(lower) {
    let out = lower;
    const spans = quoteSpans(lower);
    for (let i = spans.length - 1; i >= 0; i--) out = out.slice(0, spans[i][0]) + " " + out.slice(spans[i][1]);
    return out;
}

function sentenceAround(lower, idx) {
    const before = lower.slice(0, idx);
    let start = 0;
    for (let i = 0; i < before.length; i++) {
        const ch = before.charAt(i);
        if (ch === "." || ch === "!" || ch === "?" || ch === "\n") start = i + 1;
    }
    let end = lower.length;
    for (let i = idx; i < lower.length; i++) {
        const ch = lower.charAt(i);
        if (ch === "." || ch === "!" || ch === "?" || ch === "\n") { end = i; break; }
    }
    return lower.slice(start, end);
}

// A warning exempts only the clause that contains it, and never a clause that names a recipient.
function exemptMatch(lower, idx) {
    const span = recipientSpan(lower, idx);
    if (contactInSpan(span)) return false;
    const around = clauseBefore(lower, idx) + " " + span;
    if (warningInClause(around) || clauseNegated(around)) return true;
    if (insideQuotes(lower, idx) && warningInClause(outsideQuotes(lower))) return true;
    const sentence = sentenceAround(lower, idx);
    if (/\bif\b/.test(sentence) && /\b(?:close|ignore|leave|stop|report|walk away)\b/.test(sentence)) return true;
    return false;
}

function handsOverSecrets(text) {
    if (ownWalletEntry(text)) return false;
    const lower = flattenUrls(normalizeForPhrases(text));
    const scan = new RegExp(HANDOFF_RE.source, "g");
    let match;
    while ((match = scan.exec(lower))) {
        const between = match[1] || "";
        if (/\b(how|why|what|where|when|which|about|whether)\b/.test(between)) continue;
        if (exemptMatch(lower, match.index)) {
            if (match.index === scan.lastIndex) scan.lastIndex += 1;
            continue;
        }
        if (/\breply\b/.test(match[0]) && !/\bwith\b/.test(between) && !PARTY_RE.test(lower)) continue;
        return true;
    }
    const words = new RegExp(WORDS_HANDOFF_RE.source, "gi");
    while ((match = words.exec(lower))) {
        if (!exemptMatch(lower, match.index) && contactInSpan(recipientSpan(lower, match.index))) return true;
        if (match.index === words.lastIndex) words.lastIndex += 1;
    }
    return false;
}

function bareMatch(lower, re) {
    const flags = re.flags.indexOf("g") === -1 ? re.flags + "g" : re.flags;
    const scan = new RegExp(re.source, flags);
    let match;
    while ((match = scan.exec(lower))) {
        if (!exemptMatch(lower, match.index)) return true;
        if (match.index === scan.lastIndex) scan.lastIndex += 1;
    }
    return false;
}

function promiseScam(text) {
    const lower = flattenUrls(normalizeForPhrases(text));
    if (bareMatch(lower, /\bdouble your\b/)) return true;
    if (bareMatch(lower, /\brisk[-\s]?free profit\b/)) return true;
    if (bareMatch(lower, /\bguarant(?:e|eed|ees|ee)\b[^.]{0,40}\b(?:returns?|profits?|\d+\s*x)\b/)) return true;
    if (bareMatch(lower, /get rich quick/)) return true;
    if (bareMatch(lower, /\bsend\b[^.]{0,48}\b\d+(?:\.\d+)?\b[^.]{0,48}\bget\b[^.]{0,32}\b\d+(?:\.\d+)?\b/)) return true;
    if (bareMatch(lower, /\bsend\b[^.]{0,60}\b(?:btc|bitcoin|\d+(?:\.\d+)?)\b[^.]{0,60}\b(?:get|receive)\b[^.]{0,40}\b(?:\d+(?:\.\d+)?|double|back|2x)\b/)) return true;
    return false;
}

function scammy(text) {
    if (handsOverSecrets(text)) return true;
    return promiseScam(text);
}

function hasBadLink(text) {
    const re = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
    let match;
    while ((match = re.exec(String(text || "")))) {
        let host = match[0].replace(/^https?:\/\//i, "").replace(/^www\./i, "");
        host = host.split(/[/?#]/)[0].replace(/\.+$/, "").toLowerCase();
        if (!ALLOW_HOST_RE.test(host)) return true;
    }
    return false;
}

function unsafeOutput(text) {
    if (containsKeyMaterial(text)) return true;
    if (handsOverSecrets(text)) return true;
    if (hasBadLink(text)) return true;
    return promiseScam(text);
}

function namesRecipient(text) {
    const lower = normalizeForPhrases(text);
    return PARTY_RE.test(lower) || PHONE_RE.test(lower) || SEND_TO_RE.test(lower);
}

function userPostUnsafe(text) {
    if (containsKeyMaterial(text)) return true;
    if (handsOverSecrets(text)) return true;
    const raw = String(text || "").trim();
    if (/\?\s*$/.test(raw) && !namesRecipient(raw)) return false;
    return promiseScam(text);
}

module.exports = {
    hasSeedPhrase: hasSeedPhrase,
    containsSecret: userPostUnsafe,
    solicitsSecrets: containsKeyMaterial,
};
