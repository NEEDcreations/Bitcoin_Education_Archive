'use strict';

const crypto = require('crypto');
const BIP39_SET = require('./bip39Words');

// Buddy conversation checks. High-confidence requests lock the sender.
// A link on an unknown site, or a nudge toward Telegram, WhatsApp, or
// Signal, only files a report and a short note. Players never see this
// module's names.

const HIGH_REASONS = ['seed_request', 'address_send', 'admin_funds'];
const MEDIUM_REASONS = ['send_value', 'giveaway_invest', 'unknown_link', 'off_platform'];
const ADMIN_ACTIONS = ['unlock', 'keep_locked', 'ban', 'unlock_and_dismiss'];
const KNOWN_HOSTS = {
    'bitcoineducation.quest': true,
    'www.bitcoineducation.quest': true,
    'bitcoin.org': true,
    'www.bitcoin.org': true,
    'github.com': true,
    'www.github.com': true,
    'wikipedia.org': true,
    'en.wikipedia.org': true,
    'mempool.space': true,
    'lightning.engineering': true,
};

const WARNING_HIGH = 'Safety heads-up: never send bitcoin, sats, seed words or keys to anyone you meet here. This chat is paused while we review it.';
const WARNING_LOW = 'Safety heads-up: never send bitcoin, sats, seed words or keys to anyone you meet here.';

const CONFUSABLES = {
    '\u0455': 's', '\u0405': 's',
    '\u0435': 'e', '\u0415': 'e',
    '\u0430': 'a', '\u0410': 'a',
    '\u043e': 'o', '\u041e': 'o',
    '\u0440': 'p', '\u0420': 'p',
    '\u0441': 'c', '\u0421': 'c',
    '\u0456': 'i', '\u0406': 'i',
    '\u0443': 'y', '\u0423': 'y',
    '\u0445': 'x', '\u0425': 'x',
    '\u0458': 'j', '\u0408': 'j',
    '\u03b5': 'e', '\u0395': 'e',
    '\u03bf': 'o', '\u039f': 'o',
    '\u03b1': 'a', '\u0391': 'a',
    '\u03c1': 'p', '\u03a1': 'p',
    '\u03bd': 'v', '\u039d': 'v',
    '\u03ba': 'k', '\u039a': 'k',
    '\u03b9': 'i', '\u0399': 'i',
    '\u03b7': 'n', '\u0397': 'n',
    '\u03c5': 'u', '\u03a5': 'u',
    '\u03c7': 'x', '\u03a7': 'x',
    '\u03c4': 't', '\u03a4': 't',
    '\u03b2': 'b', '\u0392': 'b',
    '\u1d00': 'a', '\u0299': 'b', '\u1d04': 'c', '\u1d05': 'd',
    '\u1d07': 'e', '\ua730': 'f', '\u0262': 'g', '\u029c': 'h',
    '\u026a': 'i', '\u1d0a': 'j', '\u1d0b': 'k', '\u029f': 'l',
    '\u1d0d': 'm', '\u0274': 'n', '\u1d0f': 'o', '\u1d18': 'p',
    '\u0280': 'r', '\ua731': 's', '\u1d1b': 't', '\u1d1c': 'u',
    '\u1d20': 'v', '\u1d21': 'w', '\u028f': 'y', '\u1d22': 'z',
};
const PAIR_WINDOW_MS = 10 * 60 * 1000;
const REPORT_WINDOW_MS = 24 * 60 * 60 * 1000;
const REPORTS_PER_DAY = 5;
const SECRET_SOURCE = '(?:secret recovery phrase|seed phrase|seed words|recovery phrase|recovery words|recovery seed|recovery sheet|private keys|private key|priv keys|priv key|privkey|xprv|mnemonic|wallet words|backup words|wallet backup|24 word backup|12 word backup|12 words|24 words|24 word|12 word|the words|seeds|seed)';

function mapConfusables(text) {
    let out = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const code = ch.charCodeAt(0);
        if (code >= 0xFF01 && code <= 0xFF5E) {
            out += String.fromCharCode(code - 0xFEE0);
            continue;
        }
        out += CONFUSABLES[ch] || ch;
    }
    return out;
}

function leetChar(ch, prev, next) {
    const map = { '5': 's', '3': 'e', '0': 'o', '1': 'i', '4': 'a', '@': 'a', '$': 's' };
    if (!map[ch]) return ch;
    const neighbor = /[a-z@$]/.test(prev) || /[a-z@$]/.test(next);
    return neighbor ? map[ch] : ch;
}

function applyLeet(text) {
    let out = '';
    for (let i = 0; i < text.length; i++) {
        out += leetChar(text[i], i > 0 ? text[i - 1] : '', i + 1 < text.length ? text[i + 1] : '');
    }
    return out;
}

function collapseLetterRuns(text) {
    let s = text.replace(/(^|[^a-z0-9])([a-z](?:[^a-z0-9\s]+[a-z]){1,})(?![a-z0-9])/g, function (_m, pre, run) {
        return pre + run.replace(/[^a-z]/g, '');
    });
    s = s.replace(/(^|[^a-z0-9])([a-z](?:\s+[a-z]){2,})(?![a-z0-9])/g, function (_m, pre, run) {
        return pre + run.replace(/\s+/g, '');
    });
    return s;
}

function glueAddresses(text) {
    let cur = text;
    let prev = '';
    const piece = '[ac-hj-np-z02-9]';
    while (cur !== prev) {
        prev = cur;
        cur = cur.replace(new RegExp('(bc1' + piece + '{4,})\\s+(' + piece + '{4,})', 'g'), '$1$2');
        cur = cur.replace(/(lnbc[0-9a-z]{6,})\s+([0-9a-z]{4,})/g, '$1$2');
    }
    return cur;
}

function addressPattern() {
    return /\b(?:bc1[ac-hj-np-z02-9]{8,}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|lnbc[0-9a-z]{20,})\b/i;
}

function holdAddresses(text) {
    const found = [];
    const marks = ['holdza', 'holdzb', 'holdzc', 'holdzd', 'holdze', 'holdzf'];
    const stripped = glueAddresses(text).replace(addressPattern(), function (match) {
        const mark = marks[found.length] || ('holdz' + found.length);
        found.push({ mark: mark, value: match });
        return ' ' + mark + ' ';
    });
    return { text: stripped, found: found };
}

function restoreAddresses(text, found) {
    let out = text;
    found.forEach(function (item) {
        out = out.replace(item.mark, item.value);
    });
    return out;
}

function normalizeRiskText(text) {
    let s = String(text || '');
    if (typeof s.normalize === 'function') s = s.normalize('NFKC');
    s = s.replace(/[\u00AD\u200B-\u200F\u2060\uFEFF]/g, '');
    s = mapConfusables(s).toLowerCase();
    s = s.replace(/_/g, ' ');
    const held = holdAddresses(s);
    s = held.text;
    s = s.replace(/(\d)\.(\d)/g, '$1\u0001$2');
    s = s.replace(/\bwhat['’]s\b/g, 'what is');
    s = s.replace(/\bi['’]m\b/g, 'i am');
    s = s.replace(/\bi['’]d\b/g, 'i would');
    s = s.replace(/\bi['’]ll\b/g, 'i will');
    s = s.replace(/\bdon['’]t\b/g, 'dont');
    s = s.replace(/\byou['’]ll\b/g, 'you will');
    s = s.replace(/\bit['’]s\b/g, 'it is');
    s = s.replace(/\b(\d+)k\b/g, '$1 k');
    s = applyLeet(s);
    s = s.replace(/->|=>/g, ' to ');
    s = s.replace(/["'“”‘’`«»()[\]{}<>]/g, ' ');
    s = collapseLetterRuns(s);
    s = s.replace(/[\/\\|*^~=_+#]+/g, ' ');
    s = s.replace(/\bwhats\b/g, 'what is');
    s = s.replace(/\bur\b/g, 'your');
    s = s.replace(/\bu\b/g, 'you');
    s = s.replace(/\bwrds\b/g, 'words');
    s = s.replace(/\bprivkeys\b/g, 'private keys');
    s = s.replace(/\bprivkey\b/g, 'private key');
    s = s.replace(/\bprivatekeys\b/g, 'private keys');
    s = s.replace(/\bprivat(?:e)?\s*keys\b/g, 'private keys');
    s = s.replace(/\bprivat(?:e)?\s*key\b/g, 'private key');
    s = s.replace(/\bprivte key\b/g, 'private key');
    s = s.replace(/\bprivatekey\b/g, 'private key');
    s = s.replace(/\bpharse\b/g, 'phrase');
    s = s.replace(/\brecovry\b/g, 'recovery');
    s = s.replace(/\btwelve\b/g, '12');
    s = s.replace(/\btwenty[\s-]*four\b/g, '24');
    s = s.replace(/\bsendme\b/g, 'send me');
    s = s.replace(/\bgiveme\b/g, 'give me');
    s = s.replace(/\bgimme\b/g, 'give me');
    s = s.replace(/\btellme\b/g, 'tell me');
    s = s.replace(/\bdmme\b/g, 'dm me');
    s = s.replace(/\bshowme\b/g, 'show me');
    s = s.replace(/\breadme\b/g, 'read me');
    s = s.replace(/\bpls\b/g, 'please');
    s = s.replace(/\bseedphrase\b/g, 'seed phrase');
    s = s.replace(/\bse\s+nd\b/g, 'send');
    s = s.replace(/\bs\s+end\b/g, 'send');
    s = s.replace(/\u0001/g, '.');
    s = s.replace(/\s+/g, ' ').trim();
    s = restoreAddresses(s, held.found);
    return s;
}

function clausesOf(text) {
    const protectedText = String(text || '').replace(/(\d)dot(\d)/g, '$1.$2');
    const marked = protectedText
        .replace(/(\d)\.(\d)/g, '$1dot$2')
        .replace(/\b([a-z0-9-]+)\.(com|net|org|io)\b/g, '$1 hostdot $2');
    return marked.split(/[,.!?;]+/).map(function (part) {
        return part.replace(/ hostdot /g, '.').replace(/(\d)dot(\d)/g, '$1.$2').trim();
    }).filter(Boolean);
}

function secretPattern() {
    return SECRET_SOURCE;
}

function secretRe() {
    return new RegExp('\\b' + SECRET_SOURCE + '\\b', 'i');
}

function hasSecret(text) {
    return secretRe().test(text);
}

function isDeviceOrStorage(clause) {
    if (/\b(?:send|give|show|dm|read|paste)\s+me\b/.test(clause)) return false;
    if (/\b(?:to me|with me|let me see)\b/.test(clause)) return false;
    return /\b(?:on the device|into the (?:coldcard|trezor|ledger)|coldcard|trezor|ledger|hardware wallet|own wallet|storage method|storage like|\bstorage\b|backup plan|paper or steel)\b/.test(clause);
}

function verbSpans(clause) {
    const re = /\b(?:send|sending|give|show|share|tell|paste|pay|dm|read|post|write|type|enter|need|zap|transfer|deposit|withdraw|drop|reply|have|put|ask)\b/gi;
    const spans = [];
    let match;
    while ((match = re.exec(clause))) {
        spans.push({ word: match[0].toLowerCase(), index: match.index });
    }
    return spans;
}

function negatedVerbIndexes(clause) {
    const negRe = /\b(?:don't|dont|do not|never)\b/gi;
    const verbs = verbSpans(clause);
    const negated = {};
    const filler = /^(?:you|your|me|it|the|a|an|to|just|ever|please)$/;
    let match;
    while ((match = negRe.exec(clause))) {
        const after = match.index + match[0].length;
        const next = verbs.filter(function (verb) { return verb.index >= after; })[0];
        if (!next) continue;
        const gap = clause.slice(after, next.index).trim();
        const words = gap ? gap.split(/\s+/) : [];
        if (!words.every(function (word) { return filler.test(word); })) continue;
        negated[next.index] = true;
        if (next.word !== 'ask') continue;
        const later = verbs.filter(function (verb) { return verb.index > next.index; })[0];
        if (!later) continue;
        const afterAsk = clause.slice(next.index + next.word.length, later.index).trim();
        const askGap = afterAsk ? afterAsk.split(/\s+/) : [];
        if (askGap.every(function (word) { return /^(?:you|your|me|it|the|a|an|to|just|for)$/.test(word); })) {
            negated[later.index] = true;
        }
    }
    return negated;
}

function verbIsNegated(clause, word) {
    const negated = negatedVerbIndexes(clause);
    const verbs = verbSpans(clause);
    for (let i = 0; i < verbs.length; i++) {
        if (verbs[i].word === word && !negated[verbs[i].index]) return false;
        if (verbs[i].word === word && negated[verbs[i].index]) {
            const later = verbs.slice(i + 1).some(function (verb) { return verb.word === word && !negated[verb.index]; });
            if (!later) return true;
        }
    }
    return false;
}

function liveVerb(clause, words) {
    const negated = negatedVerbIndexes(clause);
    const verbs = verbSpans(clause);
    return verbs.some(function (verb) {
        return words.indexOf(verb.word) !== -1 && !negated[verb.index];
    });
}

function hypotheticalQuote(clause) {
    const head = clause.split(':')[0];
    if (/:\s*\S/.test(clause) && /\b(?:they|someone|anyone|people|scammers?|fake)\b/.test(head)) return true;
    if (!/\b(?:scammers?|someone|anyone|they|people|fake)\b/.test(clause)) return false;
    const intro = clause.match(/\b(?:(?:will|might|may|would|could)\s+(?:say|ask|tell|write|dm)|says|said|asks|asked|ask|tells|tell|say|writes|write)\b([\s\S]*)$/);
    if (!intro) return false;
    const after = intro[1] || '';
    const requestAt = after.search(/\b(?:send|give|share|show|tell|type|paste|enter|drop|post|dm)\b/);
    if (requestAt < 0) return false;
    const gap = wordsBetween(after.slice(0, requestAt));
    return gap.every(function (word) { return /^(?:you|to|that|please)$/.test(word); });
}

function scammerFundsWarning(clause) {
    if (!/\b(?:scammers?|someone|anyone|they|people|fake)\b/.test(clause)) return false;
    const quoteAt = clause.search(/\b(?:say|says|said|ask|asks|asked|tell|tells|told|write|writes|wrote)\b/);
    const payAt = clause.search(/\b(?:send|pay|zap|transfer|deposit)\b/);
    if (quoteAt < 0 || payAt < 0 || payAt < quoteAt) return false;
    return /\b(?:frozen|suspended|flagged|sats|satoshis|btc|bitcoin)\b/.test(clause);
}

function shieldedFromSender(clause) {
    if (/\b(?:send|give|show|tell|read|dm|paste)\s+me\b/.test(clause)) return false;
    if (/\b(?:to me|with me|let me see)\b/.test(clause)) return false;
    return /\b(?:with no one|with nobody|to nobody|to no one|nobody|no one)\b/.test(clause);
}

function wordsBetween(text) {
    const trimmed = String(text || '').trim();
    return trimmed ? trimmed.split(/\s+/) : [];
}

function yourOwnsAt(clause, yourIndex) {
    if (yourIndex < 0) return false;
    const rest = clause.slice(yourIndex);
    const secret = rest.match(new RegExp('^(?:your|ur)\\b([\\s\\S]{0,40}?)\\b(' + SECRET_SOURCE + ')\\b', 'i'));
    if (!secret) return false;
    const words = wordsBetween(secret[1]);
    if (words.length > 2) return false;
    if (words.some(function (word) { return !/^(?:full|whole|entire|all|complete|the|\d+)$/.test(word); })) return false;
    const before = clause.slice(Math.max(0, yourIndex - 6), yourIndex);
    if (/\bnot\s*$/.test(before)) return false;
    return true;
}

function readerOwnsSecret(clause) {
    const re = /\b(?:your|ur)\b/gi;
    let match;
    while ((match = re.exec(clause))) {
        if (yourOwnsAt(clause, match.index)) return true;
    }
    return false;
}

function storageQuestion(clause) {
    return /\bwhat\s+(?:is|are)\b/.test(clause)
        && /\b(?:backup plan|storage method|storage like|paper or steel)\b/.test(clause);
}

function partialSecretAsk(clause) {
    if (!readerOwnsSecret(clause) || questionAboutUse(clause) || storageQuestion(clause)) return false;
    if (!/\b(?:first\s+(?:\d+\s+)?words?|\d+(?:st|nd|rd|th)\s+word|word\s+number\s+\d+)\b/.test(clause)) return false;
    if (/\b(?:what\s+(?:is|are)|(?:i|we)\s+need|please|just)\b/.test(clause)) return true;
    return liveVerb(clause, ['send', 'give', 'show', 'tell', 'dm', 'paste', 'drop', 'share', 'read']);
}

const HANDOFF_VERBS = ['send', 'give', 'show', 'tell', 'share', 'paste', 'post', 'type', 'drop', 'dm', 'read', 'put', 'write', 'enter', 'reply'];

function handoffAllows(clause) {
    const any = verbSpans(clause).some(function (verb) { return HANDOFF_VERBS.indexOf(verb.word) !== -1; });
    return !any || liveVerb(clause, HANDOFF_VERBS);
}

function senderPointed(clause) {
    if (/\b(?:to me|with me|in here|in the chat|in chat|this chat)\b/.test(clause)) return true;
    if (/\b(?:send|give|show|tell|read|dm|paste|drop|type|enter|write|post|share)\s+me\b/.test(clause)) return true;
    return /\bhere\b/.test(clause) && /\b(?:type|paste|enter|write|post|drop|send)\b/.test(clause);
}

function outsideSite(clause) {
    return /https?:\/\/(?!(?:www\.)?(?:bitcoineducation\.quest|bitcoin\.org|github\.com|wikipedia\.org|en\.wikipedia\.org|mempool\.space|lightning\.engineering)\b)/i.test(clause)
        || /\b(?!bitcoin\.org)[a-z0-9-]+\.(?:com|net|org|io)\b/.test(clause);
}

function questionAboutUse(clause) {
    return new RegExp('\\b(?:your|ur)\\s+(?:' + SECRET_SOURCE + ')\\s+(?:is\\s+used|is\\s+made|made\\s+of|for)\\b', 'i').test(clause);
}

function verbReachesYourSecret(clause) {
    const storeVerb = { write: true, post: true, read: true, drop: true, enter: true, type: true, share: true, put: true };
    const re = new RegExp('\\b(send|give|show|tell|read|dm|paste|drop|post|write|type|enter|reply|share|have|put)\\b([\\s\\S]{0,48}?)\\b(?:your|ur)\\b', 'ig');
    let match;
    while ((match = re.exec(clause))) {
        const verb = match[1].toLowerCase();
        const between = wordsBetween(match[2]);
        if (between.length > 6) continue;
        if (between.some(function (word) {
            return /^(?:about|how|why|where|family|tips|guide|link|example|help|questions|sec|pic|notes|screen|attention)$/.test(word);
        })) continue;
        const yourIndex = match.index + match[1].length + match[2].length;
        if (!yourOwnsAt(clause, yourIndex)) continue;
        if (!liveVerb(clause, [verb])) continue;
        if (/\b(?:will\s+never|never)\s+ask\b(?:\s+\w+){0,3}\s+/.test(clause) && new RegExp('\\b(?:will\\s+never|never)\\s+ask\\b[\\s\\S]{0,24}\\b' + verb + '\\b').test(clause)) continue;
        if (verb === 'have' && !/\b(?:can|could|may)\s+i\s+have\s+(?:your|ur)\s+/.test(clause)) continue;
        if (storeVerb[verb] && !senderPointed(clause) && !/\b(?:can|could)\s+you\b/.test(clause) && !outsideSite(clause)) continue;
        if (questionAboutUse(clause) && !/\b(?:send|give|show|dm|paste)\s+me\b/.test(clause)) continue;
        return true;
    }
    return false;
}

function namedSecret(clause) {
    if (readerOwnsSecret(clause)) return true;
    if (/\b(?:the|your|ur)\s+words\b/.test(clause)) return true;
    return new RegExp('\\b(?:the|your|ur)\\s+(?:' + SECRET_SOURCE + ')\\b', 'i').test(clause);
}

function ownedYourAfter(clause, pattern) {
    const re = new RegExp(pattern, 'ig');
    let match;
    while ((match = re.exec(clause))) {
        const yourWord = match[match.length - 1];
        const yourIndex = match.index + match[0].length - yourWord.length;
        const between = match.length >= 3 ? wordsBetween(match[1]) : [];
        if (between.length > 6) continue;
        if (between.some(function (word) { return /^(?:help|about|how|why|where)$/.test(word); })) continue;
        if (yourOwnsAt(clause, yourIndex)) return true;
    }
    return false;
}

function directedSecret(clause) {
    if (!clause || !hasSecret(clause) || isDeviceOrStorage(clause) || shieldedFromSender(clause) || hypotheticalQuote(clause)) return false;
    if (/\b(?:when|once)\b[\s\S]{0,40}\b(?:your|ur)\b/.test(clause)) {
        const direct = /\b(?:send|give|show|tell|read|dm|paste|drop|share)\s+me\s+(?:\w+\s+){0,3}(?:your|ur|the)\b/.test(clause)
            || /\bwhat\s+(?:is|are)\s+(?:\w+\s+){0,6}(?:your|ur)\b/.test(clause)
            || /\b(?:i|we)\s+need\s+(?:\w+\s+){0,6}(?:your|ur)\b/.test(clause);
        if (!direct) return false;
    }
    const owns = readerOwnsSecret(clause);
    if (ownedYourAfter(clause, '\\b(?:i|we)\\s+want\\s+(your|ur)\\b')) return true;
    if (owns && verbReachesYourSecret(clause)) return true;
    if (owns && /\b(?:send|give|show|read|dm|paste|drop)\s+me\b/.test(clause) && liveVerb(clause, ['send', 'give', 'show', 'read', 'dm', 'paste', 'drop']) && !questionAboutUse(clause)) return true;
    if (liveVerb(clause, ['send', 'give', 'show', 'read', 'dm', 'paste', 'drop']) && /\b(?:send|give|show|read|dm|paste|drop)\s+me\s+the\s+words\b/.test(clause)) return true;
    if (liveVerb(clause, ['send', 'give', 'show', 'read', 'dm', 'paste', 'drop']) && /\b(?:send|give|show|read|dm|paste|drop)\s+me\s+the\b/i.test(clause)) {
        const afterThe = clause.replace(/^[\s\S]*?\b(?:send|give|show|read|dm|paste|drop)\s+me\s+the\s+/i, '');
        const secretHit = afterThe.match(new RegExp('^' + SECRET_SOURCE + '\\b', 'i'));
        const rest = secretHit ? afterThe.slice(secretHit[0].length).trim() : afterThe;
        if (secretHit && !/^(?:screen|example|guide|link|format|best)\b/i.test(rest)) return true;
    }
    if (!storageQuestion(clause) && !questionAboutUse(clause) && ownedYourAfter(clause, '\\bwhat\\s+(?:is|are)\\b([\\s\\S]{0,48}?)\\b(your|ur)\\b')) return true;
    if (ownedYourAfter(clause, '\\bi\\s+(?:would\\s+)?like\\b([\\s\\S]{0,40}?)\\b(your|ur)\\b')) return true;
    if (liveVerb(clause, ['need']) && ownedYourAfter(clause, '\\b(?:i|we)\\s+need\\b([\\s\\S]{0,48}?)\\b(your|ur)\\b')) return true;
    if (/\bi need it\b/.test(clause) && owns && liveVerb(clause, ['need'])) return true;
    if (ownedYourAfter(clause, '\\b(?:can|could|may)\\s+i\\s+have\\s+(your|ur)\\b')) return true;
    if (/\blet me see\b/.test(clause) && owns) return true;
    if (/\btyping\s+(?:your|ur)\b/.test(clause) && owns) return true;
    if (partialSecretAsk(clause)) return true;
    if (owns && /\b(?:to me|with me|in here|this chat)\b/.test(clause) && handoffAllows(clause) && !questionAboutUse(clause) && !/\b(?:explain|teach|describe)\b/.test(clause)) return true;
    if (new RegExp('^\\s*(?:please\\s+' + SECRET_SOURCE + '|' + SECRET_SOURCE + '\\s+please)\\s*$', 'i').test(clause)) return true;
    if (new RegExp('\\b' + SECRET_SOURCE + '\\s+to\\s+me\\b', 'i').test(clause) && handoffAllows(clause) && !/\b(?:explain|teach|describe|about)\b/.test(clause)) return true;
    if (new RegExp('\\b(?:the|your|ur)\\s+' + SECRET_SOURCE + '\\s+with\\s+me\\b', 'i').test(clause) && handoffAllows(clause)) return true;
    if (new RegExp('\\b' + SECRET_SOURCE + '\\s+(?:and\\s+)?send\\s+(?:it|them)\\b', 'i').test(clause) && liveVerb(clause, ['send'])) return true;
    if (/\b(?:type|paste|enter|write|post|drop|put)\b/.test(clause) && /\b(?:here|in the chat|in chat|this chat)\b/.test(clause) && namedSecret(clause) && liveVerb(clause, ['type', 'paste', 'enter', 'write', 'post', 'drop', 'put'])) return true;
    return false;
}

function impersonates(clause) {
    return /\b(?:i am|i'm|this is)\s+(?:an |a |the )?(?:admin|support|moderator|mod)\b/.test(clause)
        || /\bi am a\b[\s\S]{0,40}\b(?:moderator|admin|support)\b/.test(clause)
        || /\bfrom support\b/.test(clause)
        || /\bbitcoin quest (?:support|admin|moderator|team)\b/.test(clause)
        || /\b(?:support|admin|moderator|mod|team|official|staff)\s+here\b/.test(clause)
        || /\bofficial support\b/.test(clause)
        || /\bbq team\b/.test(clause)
        || /\b(?:dev|staff)\s+at\s+bitcoin quest\b/.test(clause)
        || /\bi am with the bq team\b/.test(clause)
        || /\bbitcoin quest staff\b/.test(clause);
}

function accountFrozen(clause) {
    return /\b(?:frozen|suspended|flagged)\b/.test(clause) && /\b(?:account|wallet|rewards|badge)\b/.test(clause);
}

function sendsValue(clause) {
    if (!liveVerb(clause, ['send', 'sending', 'pay', 'zap', 'transfer', 'deposit', 'give'])) return false;
    const toMe = /\b(?:to me|send me|pay me|zap me|give me)\b/.test(clause);
    const amount = /\b(?:\d[\d.]*\s*k?\s*(?:sats|satoshis|btc|bitcoin)|sats|satoshis|btc|bitcoin)\b/.test(clause);
    return (toMe || addressPattern().test(clause)) && (amount || addressPattern().test(clause) || toMe);
}

function paysAmount(clause) {
    return liveVerb(clause, ['send', 'sending', 'pay', 'zap', 'transfer', 'deposit'])
        && /\b\d/.test(clause)
        && /\b(?:sats|satoshis|btc|bitcoin)\b/.test(clause);
}

function classifyText(raw) {
    const normalized = normalizeRiskText(raw);
    const clauses = clausesOf(normalized);
    const lockReasons = [];
    const mediumReasons = [];
    function add(list, reason) {
        if (list.indexOf(reason) === -1) list.push(reason);
    }
    clauses.forEach(function (clause, index) {
        const reported = hypotheticalQuote(clause);
        const scamFunds = scammerFundsWarning(clause);
        if (!reported && directedSecret(clause)) add(lockReasons, 'seed_request');
        if (!reported && liveVerb(clause, ['pay', 'send', 'zap', 'transfer', 'deposit', 'withdraw']) && addressPattern().test(clause)) add(lockReasons, 'address_send');
        if (!reported && !scamFunds && paysAmount(clause) && /\b(?:to me|pay me|send me)\b/.test(clause)) add(lockReasons, 'admin_funds');
        if (!reported && index > 0 && /\bsend (?:it|them|this|that)(?: to me| here)?\b/.test(clause) && !verbIsNegated(clause, 'send')) {
            const prior = clauses[index - 1].trim();
            const priorIsSecret = readerOwnsSecret(prior)
                || new RegExp('^(?:your\\s+|the\\s+)?' + SECRET_SOURCE + '$', 'i').test(prior)
                || new RegExp('\\b(?:your|ur)\\s+(?:' + SECRET_SOURCE + ')\\b', 'i').test(prior);
            if (priorIsSecret && !hypotheticalQuote(prior)) add(lockReasons, 'seed_request');
        }
    });
    const adminAt = [];
    const payAt = [];
    const frozenAt = [];
    clauses.forEach(function (clause, index) {
        if (hypotheticalQuote(clause) || scammerFundsWarning(clause)) return;
        if (impersonates(clause)) adminAt.push(index);
        if (accountFrozen(clause)) frozenAt.push(index);
        if (sendsValue(clause) || paysAmount(clause) || (/\bverify\b/.test(clause) && (sendsValue(clause) || paysAmount(clause)))) payAt.push(index);
    });
    function near(left, right) {
        return left.some(function (a) {
            return right.some(function (b) { return Math.abs(a - b) <= 2; });
        });
    }
    if (near(adminAt, payAt) || near(frozenAt, payAt)) add(lockReasons, 'admin_funds');
    clauses.forEach(function (clause) {
        if (isDeviceOrStorage(clause)) return;
        if (/\b(?:send|transfer)\b/.test(clause) && /\b(?:sats|satoshis|btc|bitcoin)\b/.test(clause) && !addressPattern().test(clause)) {
            add(mediumReasons, 'send_value');
        }
    });
    if (/\b(?:double your (?:btc|bitcoin|sats)|guaranteed (?:profit|returns?)|investment opportunity)\b/.test(normalized)
        || (/\bgiveaway\b/.test(normalized) && /\b(?:send|claim)\b/.test(normalized) && /\b(?:btc|bitcoin|sats)\b/.test(normalized))) {
        add(mediumReasons, 'giveaway_invest');
    }
    if (addressPattern().test(normalized)) add(mediumReasons, 'bare_address');
    const urls = String(raw || '').match(/https?:\/\/[^\s)]+/gi) || [];
    for (let i = 0; i < urls.length; i++) {
        if (!knownHost(urls[i])) add(mediumReasons, 'unknown_link');
    }
    if (/\b(?:telegram|whatsapp|signal)\b/.test(normalized) && /\b(?:move|continue|message me|chat on|add me|talk on|switch to)\b/.test(normalized)) {
        add(mediumReasons, 'off_platform');
    }
    const secretClauses = clauses.filter(hasSecret);
    const secretIsStored = secretClauses.length > 0 && secretClauses.every(isDeviceOrStorage);
    if (hasSecret(normalized) && !secretIsStored) add(mediumReasons, 'secret_mention');
    if (lockReasons.length) {
        return {
            severity: 'high',
            reasons: lockReasons.concat(mediumReasons.filter(function (reason) { return lockReasons.indexOf(reason) === -1; })),
            lock: true,
        };
    }
    if (mediumReasons.length) return { severity: 'medium', reasons: mediumReasons, lock: false };
    return { severity: 'none', reasons: [], lock: false };
}

function hostOf(url) {
    const match = String(url || '').match(/^https?:\/\/([^/?#]+)/i);
    if (!match) return '';
    return match[1].toLowerCase().replace(/:\d+$/, '').replace(/^www\./, function (prefix) {
        return prefix;
    });
}

function knownHost(url) {
    const host = hostOf(url).replace(/^www\./, '');
    if (!host) return false;
    if (KNOWN_HOSTS[host] || KNOWN_HOSTS['www.' + host]) return true;
    return false;
}

function detectBuddyRisk(text, context) {
    const ctx = context || {};
    const now = Number(ctx.now) || 0;
    const previousAt = Number(ctx.previousAt) || 0;
    const unlockedAt = Number(ctx.unlockedAt) || 0;
    const previous = typeof ctx.previousText === 'string' ? ctx.previousText : '';
    const fresh = previous && previousAt && now && now >= previousAt
        && (now - previousAt) <= PAIR_WINDOW_MS
        && (!unlockedAt || previousAt > unlockedAt);
    if (!fresh) return classifyText(text);
    return classifyText(previous + ' ' + String(text || ''));
}

function timeMillis(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value === 'object' && typeof value.seconds === 'number') return value.seconds * 1000;
    return Number(value) || 0;
}

function tailIsStale(row, now, unlockedAt) {
    const at = Number(row && row.at) || 0;
    if (!row || !at) return true;
    if (unlockedAt && at <= Number(unlockedAt)) return true;
    const expire = timeMillis(row.expireAt);
    if (expire && expire <= now) return true;
    return now - at > PAIR_WINDOW_MS;
}

function planTailRead(row, now, unlockedAt) {
    if (!row || typeof row.text !== 'string' || tailIsStale(row, now, unlockedAt)) return '';
    return row.text;
}

function containsRawSecret(text) {
    const raw = String(text || '');
    if (/\b[xtyz]prv[1-9A-HJ-NP-Za-km-z]{20,}/i.test(raw)) return true;
    if (/\b[5KL][1-9A-HJ-NP-Za-km-z]{50,}\b/.test(raw)) return true;
    if (/\b[1-9A-HJ-NP-Za-km-z]{40,}\b/.test(raw)) return true;
    if (/\b[0-9a-fA-F]{32,}\b/.test(raw)) return true;
    const words = raw.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    let run = 0;
    for (let i = 0; i < words.length; i++) {
        if (BIP39_SET.has(words[i])) {
            run++;
            if (run >= 4) return true;
        } else run = 0;
    }
    return false;
}

const TAIL_ALLOW = {
    i: true, we: true, me: true, my: true, your: true, ur: true, the: true, a: true, an: true,
    to: true, with: true, it: true, them: true, this: true, that: true, of: true, first: true,
    send: true, give: true, show: true, tell: true, need: true, want: true, have: true, share: true,
    read: true, dm: true, paste: true, type: true, enter: true, write: true, post: true, drop: true,
    reply: true, put: true, here: true, please: true, can: true, could: true, may: true, you: true,
    what: true, is: true, are: true, whats: true, word: true, words: true, number: true,
    seed: true, phrase: true, phrases: true, private: true, key: true, keys: true, recovery: true,
    mnemonic: true, backup: true, wallet: true, xprv: true, sheet: true,
    sats: true, btc: true, bitcoin: true, pay: true, zap: true, frozen: true, account: true,
    support: true, admin: true, verify: true, unlock: true, team: true, staff: true, now: true
};

function allowlistTail(text) {
    const normalized = normalizeRiskText(text);
    const keepMoney = /\b(?:sats|satoshis|btc|bitcoin)\b/.test(normalized);
    return normalized.split(/[^a-z0-9]+/).filter(function (token) {
        if (TAIL_ALLOW[token]) return true;
        if (!/^\d+k?$/.test(token)) return false;
        const digits = token.replace(/k$/, '');
        if (keepMoney) return true;
        return digits === '12' || digits === '24' || digits.length <= 2;
    }).join(' ');
}

function planTailWrite(text, now) {
    const raw = String(text || '');
    if (!raw.trim()) return null;
    const compact = raw.replace(/\s+/g, '');
    if (containsRawSecret(raw) || containsRawSecret(compact)) {
        const kept = allowlistTail(raw);
        if (!kept || containsRawSecret(kept)) return null;
        if (!/\b(?:send|give|show|tell|need|want|share|paste|drop|type|dm|what|pay|zap|support|admin|frozen)\b/.test(kept)) return null;
        return { text: kept, at: now, expireAt: now + PAIR_WINDOW_MS };
    }
    const kept = allowlistTail(raw);
    if (!kept || containsRawSecret(kept)) return null;
    return { text: kept, at: now, expireAt: now + PAIR_WINDOW_MS };
}

function tailDocId(convoId, sender) {
    return crypto.createHash('sha256').update(String(convoId) + '\n' + String(sender)).digest('hex').slice(0, 40);
}

async function cleanupExpiredTails(db, adminSdk, nowMs) {
    const cutoff = adminSdk.firestore.Timestamp.fromMillis(nowMs || Date.now());
    let removed = 0;
    for (let batchNo = 0; batchNo < 10; batchNo++) {
        const snap = await db.collection('buddy_dm_tails').where('expireAt', '<', cutoff).limit(100).get();
        if (!snap.size) break;
        const batch = db.batch();
        snap.docs.forEach(function (doc) { batch.delete(doc.ref); });
        await batch.commit();
        removed += snap.size;
        if (snap.size < 100) break;
    }
    return removed;
}

function shouldCountReport(report) {
    const row = report || {};
    if (!row.reporterUid || row.reporterUid === 'system') return false;
    if (row.type === 'buddy_dm_lock' || row.type === 'buddy_dm_flag') return false;
    if (row.quotaAt) return false;
    return true;
}

function planReportQuota(data, reportedUid, now) {
    const src = data || {};
    const at = Number(now) || 0;
    const hits = (Array.isArray(src.hits) ? src.hits : []).map(Number).filter(function (stamp) {
        return stamp && at - stamp < REPORT_WINDOW_MS && at >= stamp;
    });
    const targets = {};
    const rawTargets = src.targets && typeof src.targets === 'object' ? src.targets : {};
    Object.keys(rawTargets).forEach(function (uid) {
        const stamp = Number(rawTargets[uid]) || 0;
        if (stamp && at - stamp < REPORT_WINDOW_MS && at >= stamp) targets[uid] = stamp;
    });
    const last = Number(targets[reportedUid]) || 0;
    if ((last && at - last < REPORT_WINDOW_MS) || hits.length >= REPORTS_PER_DAY) {
        return { allow: false, hits: hits, targets: targets, now: at };
    }
    hits.push(at);
    targets[reportedUid] = at;
    return { allow: true, hits: hits, targets: targets, now: at };
}

function snippetOf(text) {
    const raw = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
    return raw.length > 200 ? raw.slice(0, 200) : raw;
}

function shortUid(uid) {
    const s = String(uid || '');
    return s.length <= 6 ? s : s.slice(0, 6);
}

function hourBucket(now) {
    return Math.floor((Number(now) || 0) / 3600000);
}

function flagDocId(convoId, reason, now) {
    const id = String(convoId || '').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 180);
    return 'buddydm_' + id + '_' + reason + '_' + hourBucket(now);
}

function warningCopy(severity) {
    return severity === 'high' ? WARNING_HIGH : WARNING_LOW;
}

function warningDocId() {
    return 'safety-review';
}

// Same collection and base fields as the report button in messaging.js,
// plus the fields the email routine needs in order to show admin options.
function buildBuddyReport(input) {
    const src = input || {};
    const reasons = Array.isArray(src.reasons) ? src.reasons.slice() : [];
    const severity = src.severity === 'high' ? 'high' : 'medium';
    const reportedShort = shortUid(src.reportedUid);
    const otherShort = shortUid(src.otherUid);
    return {
        reportedUid: reportedShort,
        reportedName: String(src.reportedName || '').slice(0, 80),
        reporterUid: 'system',
        reporterName: 'Bitcoin Quest',
        reason: reasons.join(', ').slice(0, 180) || severity,
        createdAt: src.createdAt || null,
        status: 'pending',
        type: severity === 'high' ? 'buddy_dm_lock' : 'buddy_dm_flag',
        severity: severity,
        reasons: reasons,
        reportedUidShort: reportedShort,
        otherUidShort: otherShort,
        snippet: snippetOf(src.snippet),
        lockApplied: severity === 'high',
        actions: ADMIN_ACTIONS.slice(),
    };
}

function randomDocId(prefix) {
    return prefix + crypto.randomBytes(9).toString('hex');
}

function publicLock(at) {
    return { state: 'locked', at: at || 0, source: 'buddy_dm' };
}

function accountLocked(user) {
    const lock = user && user.lock;
    return !!(lock && lock.state === 'locked');
}

function alreadyLockedFor(user) {
    return accountLocked(user);
}

function flagCountsForLock(row, convoId, reported, unlockedAt) {
    if (!row || row.source !== 'server' || row.severity !== 'high') return false;
    if (row.convoId !== convoId || row.reportedUid !== reported) return false;
    if (row.status === 'resolved' || row.status === 'dismissed') return false;
    if (Array.isArray(row.reasons) && row.reasons.length === 1 && row.reasons[0] === 'user_report') return false;
    const at = Number(row.createdAtMs) || 0;
    if (unlockedAt && (!at || at <= Number(unlockedAt))) return false;
    return true;
}

function planAdminResolve(action) {
    if (ADMIN_ACTIONS.indexOf(action) === -1) return { error: 'action' };
    if (action === 'unlock') {
        return { clearLock: true, resumeChat: true, ban: false, reportStatus: 'unlocked' };
    }
    if (action === 'keep_locked') {
        return { clearLock: false, resumeChat: false, ban: false, reportStatus: 'kept' };
    }
    if (action === 'ban') {
        return { clearLock: false, resumeChat: false, ban: true, reportStatus: 'banned' };
    }
    return { clearLock: true, resumeChat: true, ban: false, reportStatus: 'dismissed' };
}

function planUserReportLock(report, flags, convo) {
    if (!isBuddyUserReport(report)) return { lock: false };
    const reporter = String((report && report.reporterUid) || '');
    const reported = String((report && report.reportedUid) || '');
    if (!reporter || !reported || reporter === reported) return { lock: false };
    const participants = convo && Array.isArray(convo.participants) ? convo.participants : [];
    if (participants.indexOf(reporter) === -1 || participants.indexOf(reported) === -1) return { lock: false };
    const convoId = convo && convo.id ? String(convo.id) : '';
    const unlockedAt = convo && convo.unlockedAt;
    const high = (flags || []).some(function (row) {
        return flagCountsForLock(row, convoId, reported, unlockedAt);
    });
    if (!high) return { lock: false };
    return { lock: true, convoId: convoId, sender: reported };
}

function isBuddyUserReport(data) {
    const row = data || {};
    if (row.type === 'buddy_dm_lock' || row.type === 'buddy_dm_flag') return false;
    return row.type === 'buddy' || row.reason === 'buddy';
}

const UID_RE = /^[A-Za-z0-9_:-]{1,128}$/;

function senderGoalOf(match, sender) {
    const data = match || {};
    if (data.user1 && data.user1.uid === sender) return data.user1.goal || '';
    if (data.user2 && data.user2.uid === sender) return data.user2.goal || '';
    return '';
}

function otherOf(match, sender) {
    const data = match || {};
    const ids = [data.user1 && data.user1.uid, data.user2 && data.user2.uid].filter(Boolean);
    return ids.filter(function (id) { return id !== sender; })[0] || '';
}

function createSafetyHandlers(deps) {
    const admin = deps.admin;
    const db = deps.db;
    const HttpsError = deps.HttpsError;

    async function stageReview(tx, spec) {
        const sender = spec.sender;
        const convoId = spec.convoId;
        const userRef = db.collection('users').doc(sender);
        const convoRef = db.collection('dm_conversations').doc(convoId);
        const userSnap = await tx.get(userRef);
        const warnRef = convoRef.collection('messages').doc('safety-review');
        const warnSnap = await tx.get(warnRef);
        const user = userSnap.exists ? (userSnap.data() || {}) : {};
        const lockMetaRef = db.collection('buddy_locks').doc(sender);
        const lockMetaSnap = await tx.get(lockMetaRef);
        const existingFlags = await tx.get(db.collection('buddy_flags').where('convoId', '==', convoId).limit(40));
        const existing = [];
        existingFlags.forEach(function (doc) { existing.push(doc.data() || {}); });
        const flags = [];
        const reasons = spec.reasons || [];
        const hourAgo = (spec.now || 0) - 3600000;
        for (let i = 0; i < reasons.length; i++) {
            const reason = reasons[i];
            const recent = existing.some(function (row) {
                return row && Array.isArray(row.reasons) && row.reasons.indexOf(reason) !== -1
                    && Number(row.createdAtMs) >= hourAgo
                    && row.status !== 'resolved' && row.status !== 'dismissed';
            });
            if (recent) continue;
            const id = randomDocId('bf');
            flags.push({
                reason: reason,
                id: id,
                ref: db.collection('reports').doc(id),
                flagRef: db.collection('buddy_flags').doc(id),
            });
        }
        const high = spec.severity === 'high';
        const ts = admin.firestore.FieldValue.serverTimestamp();
        const reportIds = flags.map(function (item) { return item.id; });
        if (spec.clientReportId && reportIds.indexOf(spec.clientReportId) === -1) reportIds.push(spec.clientReportId);
        if (high && userSnap.exists && !alreadyLockedFor(user)) {
            tx.set(userRef, { lock: publicLock(spec.now) }, { merge: true });
            tx.set(lockMetaRef, {
                state: 'locked',
                reason: reasons.join(', ').slice(0, 180),
                at: spec.now,
                convId: convoId,
                reportIds: reportIds,
                clientReportId: spec.clientReportId || '',
                unlockedAt: lockMetaSnap.exists ? (lockMetaSnap.data() || {}).unlockedAt || 0 : 0,
            }, { merge: true });
            tx.set(convoRef, { reviewPaused: true }, { merge: true });
        }
        const warnText = warningCopy(spec.severity);
        if (!warnSnap.exists) {
            tx.set(warnRef, {
                senderUid: 'nacho-bot',
                senderName: 'Nacho',
                text: warnText,
                createdAt: ts,
                isNachoAuto: true,
                safetyNotice: true,
            });
            if (spec.other) {
                tx.set(db.collection('notifications').doc(randomDocId('bn')), {
                    recipientId: spec.other,
                    senderId: 'system',
                    senderName: 'Bitcoin Quest',
                    type: 'buddy',
                    message: warnText.slice(0, 180),
                    targetType: 'buddy',
                    targetId: null,
                    read: false,
                    createdAt: ts,
                });
            }
        } else if (high && (warnSnap.data() || {}).text !== WARNING_HIGH) {
            tx.set(warnRef, { text: WARNING_HIGH }, { merge: true });
        }
        flags.forEach(function (item) {
            tx.set(item.flagRef, {
                reportedUid: sender,
                otherUid: spec.other || '',
                convoId: convoId,
                severity: spec.severity,
                reasons: [item.reason],
                snippet: snippetOf(spec.snippet),
                source: 'server',
                reportId: item.id,
                status: 'open',
                createdAtMs: spec.now || 0,
                createdAt: ts,
            });
            const report = buildBuddyReport({
                reportedUid: sender,
                reportedName: spec.reportedName || '',
                reasons: [item.reason],
                severity: spec.severity,
                otherUid: spec.other,
                snippet: spec.snippet,
            });
            report.createdAt = ts;
            tx.set(item.ref, report);
        });
        return { locked: high && userSnap.exists && !alreadyLockedFor(user, convoId), warned: !warnSnap.exists };
    }

    async function onBuddyDmSafety(event) {
        const snap = event && event.data;
        if (!snap) return null;
        const message = snap.data() || {};
        const messageId = event.params && event.params.mid;
        const convoId = event.params && event.params.cid;
        const sender = String(message.senderUid || '');
        if (!convoId || !sender) return null;
        const text = typeof message.text === 'string' ? message.text : '';
        const convoRef = db.collection('dm_conversations').doc(convoId);
        let convo = null;
        try {
            const convoSnap = await convoRef.get();
            if (!convoSnap.exists) return null;
            convo = convoSnap.data() || {};
        } catch (err) {
            console.warn('[onBuddyDmSafety] read', err && err.message ? err.message : err);
            return null;
        }
        const preview = message.safetyNotice === true
            ? warningCopy('high').slice(0, 100)
            : (text || (message.imageUrl ? 'Image' : ''));
        if (preview) {
            try {
                await convoRef.set({
                    lastMessage: preview.slice(0, 100),
                    lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
                    lastSenderUid: sender,
                }, { merge: true });
            } catch (err) {
                console.warn('[onBuddyDmSafety] preview', err && err.message ? err.message : err);
            }
        }
        if (sender === 'nacho-bot' || sender === 'system' || message.isNachoAuto === true || message.safetyNotice === true) return null;
        if (!text.trim()) return null;
        if (convo.isBuddyMatch !== true) return null;
        let match = {};
        let previousText = '';
        let previousAt = 0;
        let unlockedAt = 0;
        const now = Date.now();
        try {
            const matchSnap = await db.collection('buddy_matches').doc(convoId).get();
            if (matchSnap.exists) match = matchSnap.data() || {};
        } catch (err) {
            console.warn('[onBuddyDmSafety] match', err && err.message ? err.message : err);
        }
        try {
            const lockSnap = await db.collection('buddy_locks').doc(sender).get();
            if (lockSnap.exists) unlockedAt = Number((lockSnap.data() || {}).unlockedAt) || 0;
        } catch (err) {
            console.warn('[onBuddyDmSafety] lock', err && err.message ? err.message : err);
        }
        const tailRef = db.collection('buddy_dm_tails').doc(tailDocId(convoId, sender));
        try {
            const tailSnap = await tailRef.get();
            const row = tailSnap.exists ? (tailSnap.data() || {}) : null;
            previousText = planTailRead(row, now, unlockedAt);
            previousAt = previousText ? Number(row.at) || 0 : 0;
            if (tailSnap.exists && !previousText) await tailRef.delete();
        } catch (err) {
            console.warn('[onBuddyDmSafety] tail', err && err.message ? err.message : err);
        }
        const detection = detectBuddyRisk(text, {
            previousText: previousText,
            previousAt: previousAt,
            now: now,
            unlockedAt: unlockedAt,
        });
        try {
            const kept = planTailWrite(text, now);
            if (!kept) {
                await tailRef.delete();
            } else {
                await tailRef.set({
                    text: kept.text,
                    at: kept.at,
                    expireAt: admin.firestore.Timestamp.fromMillis(kept.expireAt),
                });
            }
        } catch (err) {
            console.warn('[onBuddyDmSafety] tail write', err && err.message ? err.message : err);
        }
        if (detection.severity === 'none') return null;
        const other = otherOf(match, sender);
        try {
            await db.runTransaction(function (tx) {
                return stageReview(tx, {
                    sender: sender,
                    other: other,
                    convoId: convoId,
                    severity: detection.severity,
                    reasons: detection.reasons,
                    now: now,
                    snippet: previousAt && (now - previousAt) <= PAIR_WINDOW_MS && previousText ? (previousText + ' ' + text) : text,
                    messageId: messageId,
                    reportedName: message.senderName || '',
                });
            });
        } catch (err) {
            console.warn('[onBuddyDmSafety]', err && err.message ? err.message : err);
        }
        return null;
    }

    async function acceptReportQuota(reportRef, report) {
        const reporter = String(report.reporterUid || '');
        const reported = String(report.reportedUid || '');
        if (!UID_RE.test(reporter) || !UID_RE.test(reported) || reporter === reported) {
            return { allow: false };
        }
        const quotaRef = db.collection('buddy_report_quota').doc(reporter);
        return db.runTransaction(async function (tx) {
            const reportSnap = await tx.get(reportRef);
            const quotaSnap = await tx.get(quotaRef);
            if (!reportSnap.exists) return { allow: false };
            const current = reportSnap.data() || {};
            if (current.quotaAt) return { allow: true };
            const plan = planReportQuota(quotaSnap.exists ? quotaSnap.data() : {}, reported, Date.now());
            if (!plan.allow) {
                tx.delete(reportRef);
                return { allow: false };
            }
            tx.set(quotaRef, { hits: plan.hits, targets: plan.targets });
            tx.set(reportRef, { quotaAt: plan.now }, { merge: true });
            return { allow: true };
        });
    }

    async function onBuddyReport(event) {
        const snap = event && event.data;
        if (!snap) return null;
        const report = snap.data() || {};
        if (shouldCountReport(report)) {
            try {
                const gate = await acceptReportQuota(snap.ref, report);
                if (!gate.allow) return null;
            } catch (err) {
                console.warn('[onBuddyReport] quota', err && err.message ? err.message : err);
                return null;
            }
        }
        if (!isBuddyUserReport(report)) return null;
        const reporter = String(report.reporterUid || '');
        const reported = String(report.reportedUid || '');
        if (!UID_RE.test(reported) || !UID_RE.test(reporter) || reporter === reported) return null;
        const convoId = reporter < reported ? reporter + '_' + reported : reported + '_' + reporter;
        let decision = { lock: false };
        try {
            const convoSnap = await db.collection('dm_conversations').doc(convoId).get();
            if (!convoSnap.exists) return null;
            const participants = (convoSnap.data() || {}).participants || [];
            const found = await db.collection('buddy_flags').where('convoId', '==', convoId).limit(40).get();
            const flags = (found.docs || []).map(function (doc) { return doc.data() || {}; });
            const lockSnap = await db.collection('buddy_locks').doc(reported).get();
            const unlockedAt = lockSnap.exists ? Number((lockSnap.data() || {}).unlockedAt) || 0 : 0;
            decision = planUserReportLock(report, flags, { id: convoId, participants: participants, unlockedAt: unlockedAt });
        } catch (err) {
            console.warn('[onBuddyReport] query', err && err.message ? err.message : err);
            return null;
        }
        if (!decision.lock) return null;
        try {
            await db.runTransaction(function (tx) {
                return stageReview(tx, {
                    sender: reported,
                    other: reporter,
                    convoId: decision.convoId,
                    severity: 'high',
                    reasons: [],
                    now: Date.now(),
                    snippet: '',
                    clientReportId: snap.id || '',
                    reportedName: report.reportedName || '',
                });
            });
        } catch (err) {
            console.warn('[onBuddyReport]', err && err.message ? err.message : err);
        }
        return null;
    }

    async function adminResolveLock(data, context) {
        if (!context || !context.auth || !context.auth.uid) {
            throw new HttpsError('unauthenticated', 'Sign in required.');
        }
        if (!context.auth.token || context.auth.token.admin !== true) {
            throw new HttpsError('permission-denied', 'Admin only.');
        }
        const uid = String((data && data.uid) || '');
        if (!UID_RE.test(uid)) throw new HttpsError('invalid-argument', 'That account id is not valid.');
        const plan = planAdminResolve(data && data.action);
        if (plan.error) throw new HttpsError('invalid-argument', 'Choose unlock, keep locked, ban, or unlock and dismiss.');
        const userRef = db.collection('users').doc(uid);
        const logRef = db.collection('buddy_lock_actions').doc();
        await db.runTransaction(async function (tx) {
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists) {
                throw new HttpsError('not-found', 'That account was not found.');
            }
            const metaRef = db.collection('buddy_locks').doc(uid);
            const metaSnap = await tx.get(metaRef);
            const meta = metaSnap.exists ? (metaSnap.data() || {}) : {};
            const convId = typeof meta.convId === 'string' ? meta.convId : '';
            const reportIds = []
                .concat(Array.isArray(meta.reportIds) ? meta.reportIds : [])
                .concat(meta.clientReportId ? [meta.clientReportId] : []);
            const reportSnaps = [];
            const flagSnaps = [];
            for (let i = 0; i < reportIds.length && i < 20; i++) {
                const id = reportIds[i];
                if (typeof id !== 'string' || !id || id.indexOf('/') !== -1) continue;
                reportSnaps.push(await tx.get(db.collection('reports').doc(id)));
                flagSnaps.push(await tx.get(db.collection('buddy_flags').doc(id)));
            }
            let convoFlags = [];
            const tailSnaps = [];
            if (convId && convId.indexOf('/') === -1) {
                const found = await tx.get(db.collection('buddy_flags').where('convoId', '==', convId).limit(40));
                found.forEach(function (doc) { convoFlags.push(doc); });
                if (plan.clearLock) {
                    const convoSnap = await tx.get(db.collection('dm_conversations').doc(convId));
                    const people = convoSnap.exists && Array.isArray((convoSnap.data() || {}).participants)
                        ? convoSnap.data().participants
                        : [uid];
                    for (let p = 0; p < people.length && p < 4; p++) {
                        tailSnaps.push(await tx.get(db.collection('buddy_dm_tails').doc(tailDocId(convId, people[p]))));
                    }
                }
            }
            const ts = admin.firestore.FieldValue.serverTimestamp();
            const now = Date.now();
            const flagStatus = plan.reportStatus === 'dismissed' ? 'dismissed' : 'resolved';
            if (plan.clearLock) {
                tx.set(userRef, { lock: admin.firestore.FieldValue.delete() }, { merge: true });
                tailSnaps.forEach(function (snap) {
                    if (snap && snap.exists) tx.delete(snap.ref);
                });
            }
            if (plan.resumeChat && convId && convId.indexOf('/') === -1) {
                tx.set(db.collection('dm_conversations').doc(convId), { reviewPaused: false }, { merge: true });
            }
            if (plan.ban) {
                const reason = String(meta.reason || 'buddy review').slice(0, 200);
                tx.set(userRef, {
                    withdrawals_disabled: true,
                    satsDisabled: true,
                    flagged: true,
                    ban_reason: reason,
                }, { merge: true });
                tx.set(db.collection('faucet_ledger').doc(uid), {
                    banned: true,
                    ban_reason: reason,
                    bannedAt: ts,
                }, { merge: true });
            }
            reportSnaps.forEach(function (snap) {
                if (!snap.exists) return;
                tx.set(snap.ref, { status: plan.reportStatus }, { merge: true });
            });
            flagSnaps.forEach(function (snap) {
                if (!snap.exists) return;
                tx.set(snap.ref, { status: flagStatus }, { merge: true });
            });
            convoFlags.forEach(function (doc) {
                const row = doc.data() || {};
                if (row.reportedUid !== uid) return;
                tx.set(doc.ref, { status: flagStatus }, { merge: true });
            });
            if (metaSnap.exists) {
                tx.set(metaRef, {
                    state: plan.clearLock ? 'unlocked' : meta.state || 'locked',
                    unlockedAt: plan.clearLock ? now : (meta.unlockedAt || 0),
                    status: flagStatus,
                }, { merge: true });
            }
            tx.set(logRef, {
                uid: uid,
                action: data.action,
                adminUid: context.auth.uid,
                convId: convId,
                reportStatus: plan.reportStatus,
                at: ts,
            });
        });
        return { ok: true, action: data.action, uid: uid };
    }

    return {
        onBuddyDmSafety: onBuddyDmSafety,
        onBuddyReport: onBuddyReport,
        adminResolveLock: adminResolveLock,
    };
}

module.exports = {
    HIGH_REASONS: HIGH_REASONS,
    MEDIUM_REASONS: MEDIUM_REASONS,
    ADMIN_ACTIONS: ADMIN_ACTIONS,
    WARNING_HIGH: WARNING_HIGH,
    WARNING_LOW: WARNING_LOW,
    detectBuddyRisk: detectBuddyRisk,
    snippetOf: snippetOf,
    shortUid: shortUid,
    hourBucket: hourBucket,
    flagDocId: flagDocId,
    warningCopy: warningCopy,
    warningDocId: warningDocId,
    buildBuddyReport: buildBuddyReport,
    publicLock: publicLock,
    randomDocId: randomDocId,
    flagCountsForLock: flagCountsForLock,
    accountLocked: accountLocked,
    alreadyLockedFor: alreadyLockedFor,
    planAdminResolve: planAdminResolve,
    isBuddyUserReport: isBuddyUserReport,
    planUserReportLock: planUserReportLock,
    planReportQuota: planReportQuota,
    shouldCountReport: shouldCountReport,
    planTailRead: planTailRead,
    planTailWrite: planTailWrite,
    tailIsStale: tailIsStale,
    tailDocId: tailDocId,
    cleanupExpiredTails: cleanupExpiredTails,
    containsRawSecret: containsRawSecret,
    normalizeRiskText: normalizeRiskText,
    knownHost: knownHost,
    createSafetyHandlers: createSafetyHandlers,
    senderGoalOf: senderGoalOf,
};
