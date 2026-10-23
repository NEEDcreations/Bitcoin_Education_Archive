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
const KEY_LABEL_RE = /\b(private key|secret key|privkey|priv key|secret|key:)/g;
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

function hasLabeledHexKey(text) {
    const lower = normalizeForScan(text);
    const hex = /\b[a-f0-9]{64}\b/g;
    let match;
    while ((match = hex.exec(lower))) {
        const before = lower.slice(Math.max(0, match.index - 80), match.index);
        const after = lower.slice(match.index + match[0].length, match.index + match[0].length + 48);
        const keyAt = nearest(KEY_LABEL_RE, before);
        const txAt = nearest(TX_LABEL_RE, before);
        if (keyAt >= 0 && keyAt > txAt) return true;
        const keyAfter = /\b(private key|secret key|privkey|priv key)\b/.test(after);
        const txAfter = nearest(TX_LABEL_RE, before + ' ' + after);
        if (keyAfter && txAfter < 0) return true;
    }
    return false;
}

function containsSecret(text) {
    const raw = String(text || '');
    if (hasSeedPhrase(raw)) return true;
    if (/\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/.test(raw)) return true;
    if (/\b[xtyz]prv[1-9A-HJ-NP-Za-km-z]{10,}\b/i.test(raw)) return true;
    if (hasLabeledHexKey(raw)) return true;
    return false;
}

function solicitsSecrets(question) {
    const q = String(question || '');
    if (containsSecret(q)) return true;
    if (/\b(?:send|enter|share)\b[^.]{0,48}\byour\s+(?:seed(?:\s+phrase|\s+words)?|private key|secret key)\b/i.test(q)) return true;
    if (/\b(?:show me|give me|reveal|dump|paste|tell me)\b[^.]{0,48}\b(?:my |your )?(?:private key|secret key|seed phrase|seed words|seed|xprv|wif)\b/i.test(q)) return true;
    if (/\b(?:what(?:'s| is)|where(?:'s| is))\s+my\s+(?:private key|secret key|seed phrase|seed words|seed|xprv)\b/i.test(q)) return true;
    return false;
}

module.exports = {
    hasSeedPhrase: hasSeedPhrase,
    containsSecret: containsSecret,
    solicitsSecrets: solicitsSecrets,
};
