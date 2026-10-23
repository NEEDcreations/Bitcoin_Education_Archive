'use strict';

// Seed and key scan for topic posts. Mirrors workers/nacho-search/nacho-logic.mjs.
// Cloud Functions only deploy this directory, so the word list is copied here.

const BIP39_WORDS = require('./bip39-en.json');
const BIP39 = new Set(BIP39_WORDS);
const PREFIX4 = new Set();
BIP39_WORDS.forEach(function (word) {
    if (word.length >= 4) PREFIX4.add(word.slice(0, 4));
});
const GAP = new Set('a an the and or of to for in on is are was were be been being with from it its i me my we our you your he she his her they them their at by as if but so no not yes just into per also then than too very do did does am'.split(' '));
const ZW_RE = /[\u200B-\u200D\uFEFF\u2060\u00AD\u180E\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const HOMO = {
    '\u0430': 'a', '\u0435': 'e', '\u043e': 'o', '\u0440': 'p', '\u0441': 'c', '\u0443': 'y', '\u0445': 'x',
    '\u0456': 'i', '\u0455': 's', '\u0458': 'j', '\u04bb': 'h', '\u043a': 'k', '\u043c': 'm', '\u0442': 't',
    '\u043d': 'h', '\u0432': 'b', '\u0454': 'e', '\u0473': 'f', '\u0501': 'd',
    '\u03b1': 'a', '\u03b5': 'e', '\u03bf': 'o', '\u03c1': 'p', '\u03c4': 't', '\u03c5': 'u', '\u03bd': 'v',
    '\u03ba': 'k', '\u03b9': 'i', '\u03b7': 'n', '\u03c7': 'x', '\u03b3': 'y', '\u03b2': 'b', '\u03c9': 'w',
};
const KEY_LABEL_RE = /\b(private[_\s-]?key|secret[_\s-]?key|privkey|priv[_\s-]?key|pk|priv|wif|secret|key)\b/g;
const HANDOFF_VERB = 'send|share|give|dm|message|provide|import|enter|type|paste|upload|submit|tell';
const HANDOFF_NOUN = 'seed(?:\\s+phrase|\\s+words)?|mnemonic|recovery\\s+phrase|12\\s+words|24\\s+words|private\\s+key|keys|wif|xprv';
const HANDOFF_RE = new RegExp('\\b(?:' + HANDOFF_VERB + ')\\b([^.]{0,80})\\b(?:' + HANDOFF_NOUN + ')\\b', 'i');
const XPRV_RE = /\b[tuvxyz]prv[1-9A-HJ-NP-Za-km-z]{10,}\b/i;
const WIF_RE = /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/;
const MINIKEY_RE = /\bS[1-9A-HJ-NP-Za-km-z]{21}(?:[1-9A-HJ-NP-Za-km-z]{4}){0,2}\b/;
const TX_LABEL_RE = /\b(txid|tx id|transaction(?: id| hash)?|block ?hash|blockhash)\b/g;

function normalizeForScan(text) {
    let value = String(text || '');
    try { value = value.normalize('NFKC'); } catch (e) {}
    value = value.replace(ZW_RE, '').toLowerCase();
    let out = '';
    for (let i = 0; i < value.length; i++) {
        const ch = value.charAt(i);
        out += HOMO[ch] || ch;
    }
    return out;
}

function bip39Hit(token) {
    if (!token) return false;
    if (BIP39.has(token)) return true;
    return token.length === 4 && PREFIX4.has(token);
}

function hasSeedPhrase(text) {
    const words = normalizeForScan(text).split(/[^a-z0-9]+/).filter(Boolean);
    let run = 0;
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (bip39Hit(word)) {
            run += 1;
            if (run >= 12) return true;
        } else if (/^\d+$/.test(word) || GAP.has(word)) {
            continue;
        } else {
            run = 0;
        }
    }
    return false;
}

function clauseBefore(lower, idx) {
    const before = lower.slice(0, idx);
    const cut = Math.max(
        before.lastIndexOf(','),
        before.lastIndexOf('.'),
        before.lastIndexOf('\n'),
        before.lastIndexOf(';'),
        before.lastIndexOf('!'),
        before.lastIndexOf('?')
    );
    return before.slice(cut + 1);
}

function clauseNegated(clause) {
    const cleaned = String(clause || '')
        .replace(/\b(?:isn'?t|is not|not)\s+a\s+scam\b/g, ' ')
        .replace(/\bnever\s+(?:miss|forget|ignore|skip)\b/g, ' ');
    return /\b(not|no|never|without|avoid)\b/.test(cleaned) || /n't/.test(cleaned);
}

function normalizeForPhrases(text) {
    const folded = normalizeForScan(text).replace(/[013457]/g, function (ch, index, source) {
        const prev = source.charAt(index - 1);
        const next = source.charAt(index + 1);
        if (/[0-9]/.test(prev) || /[0-9]/.test(next)) return ch;
        if (!/[a-z]/.test(prev) && !/[a-z]/.test(next)) return ch;
        return ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't' })[ch];
    });
    return folded.replace(/\bur\b/g, 'your');
}

function bareMatch(lower, re) {
    const flags = re.flags.indexOf('g') === -1 ? re.flags + 'g' : re.flags;
    const scan = new RegExp(re.source, flags);
    let match;
    while ((match = scan.exec(lower))) {
        if (!clauseNegated(clauseBefore(lower, match.index))) return true;
        if (match.index === scan.lastIndex) scan.lastIndex += 1;
    }
    return false;
}

function nearest(re, text) {
    const flags = re.flags.indexOf('g') === -1 ? re.flags + 'g' : re.flags;
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
    const raw = String(text || '');
    if (hasSeedPhrase(raw)) return true;
    if (WIF_RE.test(raw)) return true;
    if (XPRV_RE.test(raw)) return true;
    if (MINIKEY_RE.test(raw)) return true;
    if (hasHexSecret(raw)) return true;
    return false;
}

function handsOverSecrets(text) {
    const lower = normalizeForPhrases(text);
    const scan = new RegExp(HANDOFF_RE.source, 'g');
    let match;
    while ((match = scan.exec(lower))) {
        const between = match[1] || '';
        if (/\b(how|why|what|where|when|which|about|whether)\b/.test(between)) continue;
        if (clauseNegated(between) || clauseNegated(clauseBefore(lower, match.index))) {
            if (match.index === scan.lastIndex) scan.lastIndex += 1;
            continue;
        }
        return true;
    }
    return false;
}

function scammy(text) {
    const lower = normalizeForPhrases(text);
    if (handsOverSecrets(text)) return true;
    if (bareMatch(lower, /\bdouble your\b/)) return true;
    if (bareMatch(lower, /\brisk[-\s]?free profit\b/)) return true;
    if (bareMatch(lower, /\bguarant(?:e|eed|ees|ee)\b[^.]{0,40}\b(?:returns?|profits?|\d+\s*x)\b/)) return true;
    if (bareMatch(lower, /get rich quick/)) return true;
    if (bareMatch(lower, /\bsend\b[^.]{0,48}\b\d+(?:\.\d+)?\b[^.]{0,48}\bget\b[^.]{0,32}\b\d+(?:\.\d+)?\b/)) return true;
    if (bareMatch(lower, /\bsend\b[^.]{0,60}\b(?:btc|bitcoin|\d+(?:\.\d+)?)\b[^.]{0,60}\b(?:get|receive)\b[^.]{0,40}\b(?:\d+(?:\.\d+)?|double|back|2x)\b/)) return true;
    return false;
}

function containsSecret(text) {
    return scammy(text) || containsKeyMaterial(text);
}

function solicitsSecrets(question) {
    return containsKeyMaterial(question);
}

module.exports = {
    hasSeedPhrase: hasSeedPhrase,
    containsSecret: containsSecret,
    solicitsSecrets: solicitsSecrets,
};
