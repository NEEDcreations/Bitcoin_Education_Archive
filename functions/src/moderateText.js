'use strict';

// moderateContent keeps the short whole-word list. The Telegram mirror
// passes { strict: true } and uses the old bridgeToTelegram term list,
// matched the same way: a phrase or a term of 4+ characters matches
// inside a word, and a shorter term has to be a whole word.
// Political terms are the old bridge list, unchanged. Singular and plural
// democrat and republican stay blocked; democratic is an ordinary adjective.
// An allowlist is applied only before the in-word search. Each unbroken
// occurrence, counted before line-break joining, separator collapsing, and
// spaced-letter collapsing, masks one copy of that word. A standalone slur
// still matches as its own word.

const PROFANITY = [
    'fuck', 'shit', 'bitch', 'asshole', 'damn', 'cunt',
    'dick', 'cock', 'pussy', 'whore', 'slut', 'fag',
    'nigger', 'nigga', 'retard', 'kill yourself', 'kys',
];

// The live bridgeToTelegram list (gh-pages index.js). Do not add or
// drop political terms here. Phil may revisit them later.
const BRIDGE_TERMS = [
    'fuck', 'shit', 'bitch', 'dick', 'cock', 'pussy', 'cunt', 'nigger', 'nigga', 'fag', 'faggot', 'retard',
    'nazi', 'hitler', 'kkk', 'porn', 'hentai', 'rape', 'pedo', 'slut', 'whore', 'cum', 'dildo', 'tits', 'nude', 'naked',
    'suicide', 'terrorist', 'jihad', 'genocide', 'lynch', 'blowjob', 'handjob', 'threesome', 'gangbang', 'bondage',
    'deepthroat', 'masturbat', 'hooker', 'stripper', 'onlyfans', 'pornhub', 'xvideos', 'xnxx',
    'spic', 'wetback', 'chink', 'gook', 'kike', 'towelhead', 'raghead', 'beaner', 'coon', 'darkie',
    'maga', 'trump', 'biden', 'democrat', 'republican', 'antifa', 'qanon', 'white power', 'sieg heil',
    'kill yourself', 'kys', 'kill myself', 'self harm', 'death to', 'gas the',
    'motherfucker', 'fuckers', 'bullshit', 'gas the jews', 'asshole', 'damn',
];

// Whole words that contain a 4+ letter term but are ordinary English.
// Checked only before in-word matching. Exact standalone terms still hit.
const ALLOWLIST = [
    'magazine', 'suspicious', 'suspicion', 'spicy', 'spice', 'despicable',
    'conspicuous', 'auspicious', 'hospice', 'cocktail', 'cockpit', 'cocky',
    'peacock', 'hancock', 'hitchcock', 'dickens', 'dickinson', 'grape',
    'grapefruit', 'drape', 'scrape', 'skyscraper', 'parapet', 'trapeze',
    'therapeutic', 'trumpet', 'torpedo', 'raccoon', 'cocoon', 'tycoon',
    'democratic', 'grapevine', 'scunthorpe',
];

const ALLOW = {};
ALLOWLIST.forEach(function (word) { ALLOW[word] = true; });

const SCAM_PATTERNS = [
    /send me \d+(?:[.,]\d+)? btc(?:to)?\b/i,
    /double your bitcoin/i,
    /guaranteed.*return/i,
    /invest.*guaranteed/i,
    /free bitcoin.*send/i,
    // Same break class as chatTelegramMirror.flattenLines. "btcto" is "btc".
    /send\s+(?:me\s+)?(?:\d+(?:[.,]\d+)?\s*)?(?:sats|btc(?:to)?|bitcoin)\b[^.\r\n\u000B\u000C\u0085\u2028\u2029]{0,48}\bbc1/i,
];

const REASON_PROFANITY = 'Content contains inappropriate language';
const REASON_SCAM = 'Content contains potential scam patterns';

// Greek, Cyrillic, and small-cap letters that look like Latin.
// Greek sigma folds to o (the round shape), final sigma to c.
const LOOKALIKE = {
    '\u0430': 'a', // Cyrillic a
    '\u0435': 'e', // Cyrillic e
    '\u043e': 'o', // Cyrillic o
    '\u0440': 'p', // Cyrillic er
    '\u0441': 'c', // Cyrillic es
    '\u0443': 'y', // Cyrillic u
    '\u0445': 'x', // Cyrillic ha
    '\u0456': 'i', // Cyrillic i
    '\u0455': 's', // Cyrillic dze
    '\u0501': 'd', // Cyrillic komi de
    '\u043a': 'k', // Cyrillic ka
    '\u04bb': 'h', // Cyrillic shha
    '\u043c': 'm', // Cyrillic em
    '\u0442': 't', // Cyrillic te
    '\u0432': 'b', // Cyrillic ve
    '\u043d': 'h', // Cyrillic en
    '\u0433': 'r', // Cyrillic ge
    '\u0458': 'j', // Cyrillic je
    '\u051b': 'q', // Cyrillic qa
    '\u051d': 'w', // Cyrillic we
    '\u0475': 'v', // Cyrillic izhitsa
    '\u04cf': 'l', // Cyrillic palochka
    '\u03b1': 'a', // Greek alpha
    '\u03b2': 'b', // Greek beta
    '\u03b5': 'e', // Greek epsilon
    '\u03b9': 'i', // Greek iota
    '\u03ba': 'k', // Greek kappa
    '\u03bd': 'v', // Greek nu
    '\u03bf': 'o', // Greek omicron
    '\u03c1': 'p', // Greek rho
    '\u03c4': 't', // Greek tau
    '\u03c5': 'u', // Greek upsilon
    '\u03c7': 'x', // Greek chi
    '\u03c2': 'c', // Greek final sigma
    '\u03c3': 'o', // Greek sigma
    '\u03b7': 'n', // Greek eta
    '\u03bc': 'u', // Greek mu
    '\u03c9': 'w', // Greek omega
    '\u0261': 'g', // Latin script g
    '\u0131': 'i', // dotless i
    '\u1d00': 'a', '\u0299': 'b', '\u1d04': 'c', '\u1d05': 'd', '\u1d07': 'e',
    '\ua730': 'f', '\u0262': 'g', '\u029c': 'h', '\u026a': 'i', '\u1d0a': 'j',
    '\u1d0b': 'k', '\u029f': 'l', '\u1d0d': 'm', '\u0274': 'n', '\u1d0f': 'o',
    '\u1d18': 'p', '\u0280': 'r', '\ua731': 's', '\u1d1b': 't', '\u1d1c': 'u',
    '\u1d20': 'v', '\u1d21': 'w', '\u028f': 'y', '\u1d22': 'z',
};

// Longer suffixes first so "spiced" is spice+d, not spic+ed.
const ALLOW_SUFFIXES = ['es', 'ed', 'er', 'ly', 's', 'd', 'r'];

function normalizeModerateText(text) {
    return String(text || '').toLowerCase()
        .replace(/[@4]/g, 'a')
        .replace(/[8]/g, 'b')
        .replace(/[3€]/g, 'e')
        .replace(/[1!|]/g, 'i')
        .replace(/[0]/g, 'o')
        .replace(/[$5]/g, 's')
        .replace(/[7+]/g, 't')
        .replace(/[*._\-]/g, '')
        .replace(/\s+/g, ' ');
}

// Loop until stable so a nested tag cannot survive one pass
// (<scr<script>ipt> → <script> → empty). CodeQL flags a single replace.
function stripTags(text) {
    let s = String(text || '');
    let prev;
    do {
        prev = s;
        s = s.replace(/<[^>]*>/g, '');
    } while (s !== prev);
    return s;
}

// Profile chips unwrap in one forward scan. The old span regex was
// nested and super-linear on a long "<span" with no closing bracket.
function unwrapProfileSpans(text) {
    const src = String(text || '');
    if (src.indexOf('<') === -1) return src;
    const lower = src.toLowerCase();
    let out = '';
    let i = 0;
    while (i < src.length) {
        const start = lower.indexOf('<span', i);
        if (start < 0) {
            out += src.slice(i);
            break;
        }
        const boundary = src.charAt(start + 5);
        if (boundary && !/[\s>/]/.test(boundary)) {
            out += src.slice(i, start + 5);
            i = start + 5;
            continue;
        }
        const gt = src.indexOf('>', start + 5);
        if (gt < 0) {
            out += src.slice(i);
            break;
        }
        if (!profileUidAttr(lower.slice(start, gt))) {
            out += src.slice(i, start + 5);
            i = start + 5;
            continue;
        }
        const close = lower.indexOf('</span>', gt + 1);
        if (close < 0) {
            out += src.slice(i);
            break;
        }
        out += src.slice(i, start);
        out += src.slice(gt + 1, close);
        i = close + 7;
    }
    return out;
}

function profileUidAttr(openLower) {
    const key = 'data-profile-uid';
    let from = 0;
    while (from < openLower.length) {
        const at = openLower.indexOf(key, from);
        if (at < 0) return false;
        const prev = at > 0 ? openLower.charAt(at - 1) : '';
        if (prev && /[a-z0-9_]/.test(prev)) {
            from = at + 1;
            continue;
        }
        let j = at + key.length;
        while (j < openLower.length && /\s/.test(openLower.charAt(j))) j++;
        if (openLower.charAt(j) !== '=') {
            from = at + 1;
            continue;
        }
        j++;
        while (j < openLower.length && /\s/.test(openLower.charAt(j))) j++;
        const quote = openLower.charAt(j);
        if (quote !== '"' && quote !== "'") {
            from = at + 1;
            continue;
        }
        return openLower.indexOf(quote, j + 1) !== -1;
    }
    return false;
}

// Same visible-text cleanup the mirror applies before Telegram sees a line:
// HTML tags, %%tokens%%, markdown links, and invisible characters.
// A short link spliced between letters is dropped so fu[x](url)ck matches
// the surrounding word. Any other link is its display text.
function sanitizeOutgoing(text) {
    let out = unwrapProfileSpans(text);
    out = stripTags(out);
    out = out.replace(/%%[A-Za-z0-9_]+%%/g, '');
    out = out.replace(/(\p{L})\[[^\]]{1,3}\]\((?:https?:\/\/|mailto:|javascript:)[^)]*\)(?=\p{L})/giu, '$1');
    out = out.replace(/\[([^\]]+)\]\((?:https?:\/\/|mailto:|javascript:)[^)]*\)/gi, '$1');
    out = out.replace(/[\u200B-\u200D\uFEFF]/g, '');
    return out;
}

// A run of 2+ digits is a number (a block height), not leet. A single
// digit inside a word still folds (p0rn, t1ts).
function applyLeet(text) {
    return String(text || '').replace(/\d+|[^0-9]+/g, function (chunk) {
        if (/^\d{2,}$/.test(chunk)) return chunk;
        return chunk
            .replace(/[@4]/g, 'a')
            .replace(/8/g, 'b')
            .replace(/[3€]/g, 'e')
            .replace(/[1!|]/g, 'i')
            .replace(/0/g, 'o')
            .replace(/[$5]/g, 's')
            .replace(/[7+]/g, 't');
    });
}

function foldLookalikes(text) {
    return Array.from(String(text || '')).map(function (ch) {
        return LOOKALIKE[ch] || ch;
    }).join('');
}

// Counts, not a set. One unbroken "spicy" covers one matched copy, so
// "spicy spic-y" still has a second "spicy" after the separator collapses.
function unbrokenWords(text) {
    const words = new Map();
    String(text || '').split(/[^\p{L}]+/u).forEach(function (word) {
        if (word) words.set(word, (words.get(word) || 0) + 1);
    });
    return words;
}

// Runs of 3+ identical letters, reduced to one and to two. "niggger"
// only matches once the run of g's is squeezed to two.
function squeezeVariants(text) {
    const t = String(text || '');
    const once = t.replace(/(\p{L})\1{2,}/gu, '$1');
    const twice = t.replace(/(\p{L})\1{2,}/gu, '$1$1');
    const out = [];
    [t, once, twice].forEach(function (variant) {
        if (out.indexOf(variant) === -1) out.push(variant);
    });
    return out;
}

// fu\nck joins. hello\nworld stays two words. Leftover breaks become spaces
// so "f \n u \n c \n k" is the same shape as "f u c k".
// The break set matches chatTelegramMirror.flattenLines:
// [\r\n\u000B\u000C\u0085\u2028\u2029]
function joinShortLineBreaks(text) {
    let s = String(text || '').replace(/[^\S\r\n\u000B\u000C\u0085\u2028\u2029]*[\r\n\u000B\u000C\u0085\u2028\u2029]+[^\S\r\n\u000B\u000C\u0085\u2028\u2029]*/g, '\n');
    let prev = '';
    while (s !== prev) {
        prev = s;
        s = s.replace(/(^|[^\p{L}\n])(\p{L}+)\n(\p{L}+)(?!\p{L})/gu, function (_m, lead, left, right) {
            if (left.length <= 2 || right.length <= 2) return lead + left + right;
            return lead + left + ' ' + right;
        });
    }
    return s.replace(/\n/g, ' ');
}

function collapseSeparators(text) {
    let s = String(text || '');
    // An em or en dash between ordinary words is a separator. Joining
    // grape–and or drama—game would invent "rape" and "maga". A short
    // side is still obfuscation: f–uck and f—uck collapse below.
    s = s.replace(/(\p{L}{3,})[\u2012\u2013\u2014\u2015]+(?=\p{L}{3,})/gu, '$1 ');
    let prev = '';
    while (s !== prev) {
        prev = s;
        s = s.replace(/(\p{L})[-_.,:;\u00B7\u2022\u2027\u2010-\u2015\u2212\u2219\u22C5\u30FB\uFF65]+(?=\p{L})/gu, '$1');
    }
    return s;
}

// "phuck" and "ph uck" fold toward "fuck". "phone" becomes "fone".
// "graphic" does not start with ph, so it is left alone.
function foldPh(text) {
    return String(text || '')
        .replace(/\bph\s+/g, 'f')
        .replace(/\bph/g, 'f');
}

// Three or more single letters split by spaces or punctuation: "f u c k".
function collapseSpacedLetters(text) {
    return String(text || '').replace(/(^|[^\p{L}])(\p{L}(?:[^\p{L}\p{N}*]+)\p{L}(?:[^\p{L}\p{N}*]+\p{L})+)/gu, function (full, lead, run) {
        return lead + run.replace(/[^\p{L}]/gu, '');
    });
}

// NFKC, then NFKD, strip marks and variation selectors, then NFC.
// Format characters (soft hyphen, zero-width) are removed after that.
// Blank fillers and emoji between letters are removed before the
// unbroken-word snapshot, which is taken after leet and before any join.
function prepareStrict(text) {
    let s = String(text || '').normalize('NFKC').normalize('NFKD');
    s = s.replace(/[\p{M}\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu, '');
    s = s.normalize('NFC');
    s = s.replace(/\p{Cf}/gu, '');
    s = s.replace(/[\u115F\u1160\u3164\uFFA0\u2800]/g, '');
    s = s.replace(/(\p{L})[\p{Extended_Pictographic}\p{So}\u{1F3FB}-\u{1F3FF}\u200D\uFE0F]+(?=\p{L})/gu, '$1');
    s = foldLookalikes(s.toLowerCase());
    s = applyLeet(s);
    const unbroken = unbrokenWords(s);
    s = joinShortLineBreaks(s);
    s = collapseSeparators(s);
    s = foldPh(s);
    s = collapseSpacedLetters(s);
    s = s.replace(/\s+/g, ' ').trim();
    return { text: s, unbroken: unbroken };
}

function normalizeStrictText(text) {
    return prepareStrict(text).text;
}

// Same fold as profanity, without leet, so "0.01" and "bc1" survive.
function scamFold(text) {
    let s = String(text || '').normalize('NFKC').normalize('NFKD');
    s = s.replace(/[\p{M}\p{Cf}\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu, '');
    s = s.normalize('NFC');
    return foldLookalikes(s.toLowerCase());
}

function allowlistedWord(word, unbroken) {
    const w = String(word || '');
    if (!w || !unbroken || !(unbroken.get(w) > 0)) return false;
    if (ALLOW[w]) return true;
    for (let i = 0; i < ALLOW_SUFFIXES.length; i++) {
        const suffix = ALLOW_SUFFIXES[i];
        if (w.length <= suffix.length + 2) continue;
        if (w.slice(-suffix.length) !== suffix) continue;
        if (ALLOW[w.slice(0, -suffix.length)]) return true;
    }
    return false;
}

function maskAllowlist(text, unbroken) {
    const left = new Map(unbroken || []);
    return String(text || '').replace(/\p{L}+/gu, function (word) {
        if (!allowlistedWord(word, left)) return word;
        left.set(word, left.get(word) - 1);
        return ' '.repeat(word.length);
    });
}

// "*" stands in for one character ("f*ck", "sh*t", "f**k"). At least two
// real letters must agree, and the window must start and end on a letter,
// so markdown emphasis ("*trap*") does not match.
function starWindow(text, term) {
    const src = String(text || '');
    if (src.indexOf('*') === -1) return false;
    const n = term.length;
    if (n < 2 || src.length < n) return false;
    for (let i = 0; i + n <= src.length; i++) {
        let literals = 0;
        let ok = true;
        for (let j = 0; j < n; j++) {
            const ch = src.charAt(i + j);
            if (ch === '*') continue;
            literals += 1;
            if (ch !== term.charAt(j)) {
                ok = false;
                break;
            }
        }
        if (ok && literals >= 2 && src.charAt(i) !== '*' && src.charAt(i + n - 1) !== '*') return true;
    }
    return false;
}

function bridgeHit(normalized, unbroken) {
    const text = String(normalized || '');
    if (!text) return false;
    const words = text.split(/\s+/).filter(Boolean);
    for (let i = 0; i < BRIDGE_TERMS.length; i++) {
        const bad = BRIDGE_TERMS[i];
        if (bad.indexOf(' ') !== -1) {
            if (text.indexOf(bad) !== -1) return true;
            continue;
        }
        for (let w = 0; w < words.length; w++) {
            if (words[w] === bad) return true;
        }
    }
    const masked = maskAllowlist(text, unbroken);
    const bare = masked.replace(/\*/g, '');
    const starred = masked.replace(/\s*\*\s*/g, '*');
    const compact = bare.replace(/\s+/g, '');
    for (let i = 0; i < BRIDGE_TERMS.length; i++) {
        const bad = BRIDGE_TERMS[i];
        if (bad.indexOf(' ') !== -1) {
            if (compact.indexOf(bad.replace(/\s+/g, '')) !== -1) return true;
            continue;
        }
        if (bad.length >= 4 && bare.indexOf(bad) !== -1) return true;
        if (starWindow(starred, bad)) return true;
    }
    return false;
}

function scamHit(text) {
    const raw = String(text || '');
    for (let i = 0; i < SCAM_PATTERNS.length; i++) {
        if (SCAM_PATTERNS[i].test(raw)) return true;
    }
    return false;
}

function moderateStrict(raw) {
    const sanitized = sanitizeOutgoing(raw).trim();
    if (!sanitized) return { clean: true, reason: '' };
    const prepared = prepareStrict(sanitized);
    const variants = squeezeVariants(prepared.text);
    for (let i = 0; i < variants.length; i++) {
        if (bridgeHit(variants[i], prepared.unbroken)) return { clean: false, reason: REASON_PROFANITY };
    }
    if (scamHit(sanitized) || scamHit(scamFold(sanitized))) return { clean: false, reason: REASON_SCAM };
    return { clean: true, reason: '' };
}

function moderateText(text, options) {
    const raw = String(text || '').trim();
    if (!raw) return { clean: true, reason: '' };
    if (options && options.strict) return moderateStrict(raw);
    const normalized = normalizeModerateText(raw);
    for (let i = 0; i < PROFANITY.length; i++) {
        const regex = new RegExp('\\b' + PROFANITY[i] + '\\b', 'i');
        if (regex.test(normalized)) return { clean: false, reason: REASON_PROFANITY };
    }
    if (scamHit(raw)) return { clean: false, reason: REASON_SCAM };
    return { clean: true, reason: '' };
}

module.exports = {
    moderateText: moderateText,
    PROFANITY: PROFANITY,
    BRIDGE_TERMS: BRIDGE_TERMS,
    ALLOWLIST: ALLOWLIST,
    SCAM_PATTERNS: SCAM_PATTERNS,
    sanitizeOutgoing: sanitizeOutgoing,
    unwrapProfileSpans: unwrapProfileSpans,
    normalizeStrictText: normalizeStrictText,
};
