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
    'peacock', 'hancock', 'hitchcock', 'dickens', 'dickinson', 'dickson',
    'grape', 'grapefruit', 'drape', 'scrape', 'skyscraper', 'parapet', 'trapeze',
    'therapeutic', 'trumpet', 'torpedo', 'raccoon', 'cocoon', 'tycoon',
    'democratic', 'grapevine', 'scunthorpe', 'pedometer', 'shitake',
    'magali', 'cockrell', 'shitij',
];

const ALLOW = {};
ALLOWLIST.forEach(function (word) { ALLOW[word] = true; });

// Surnames that contain a term. They are spared only when the whole input
// is a display name, or when that token is the display name on an outgoing
// line. A message body that uses the same spelling still matches.
const NAME_ALLOW = { raper: true };

// Joined fragments are checked against this set only. A hit has to be the
// whole joined word, or the start of it when the first piece is a prefix
// of that word. A slur buried in the middle (grapeand, menudelete) is not.
const SLUR_EXACT = Object.create(null);
const COMPACT_PHRASE = Object.create(null);
const SLUR_WORDS = [];
BRIDGE_TERMS.forEach(function (term) {
    const compact = term.replace(/\s+/g, '');
    SLUR_EXACT[compact] = true;
    if (term.indexOf(' ') !== -1) COMPACT_PHRASE[compact] = true;
    if (term.indexOf(' ') === -1) SLUR_WORDS.push(term);
});

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
    '\u0446': 'u', // Cyrillic tse, the u shape
    '\u0192': 'f', // Latin f with hook
    '\u057d': 'u', // Armenian seh
    '\u04c0': 'i', // palochka. JS lowercases this to U+04CF before the map runs, so the i reading is a second fold.
    '\u03b3': 'y', // Greek gamma
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

// A one-letter fragment always joins (f,uck, n@igger). A two-letter
// fragment joins only when the other side is also short (fu,ck, sh,it),
// so taco,on and menu,delete stay two words.
function joinShortFragment(left, right) {
    const a = String(left || '').length;
    const b = String(right || '').length;
    const short = a < b ? a : b;
    const long = a > b ? a : b;
    if (short === 1) return true;
    return short === 2 && long <= 3;
}

// Mid-word @ is hiding letters, not the leet letter "a". A short fragment
// is glued back (n@igger). A long pair stays split so drama@gain is not "maga".
function unfoldMidWordAt(text) {
    return String(text || '').replace(/(^|[^\p{L}])(\p{L}+)[\uFF20@]+(\p{L}+)/gu, function (_m, lead, left, right) {
        if (joinShortFragment(left, right)) return lead + left + right;
        return lead + left + ' ' + right;
    });
}

// Exact copy of gh-pages collapseSeparators, used by the legacy form only,
// so the legacy form is byte-for-byte live and the PR can never be weaker.
function collapseSeparatorsLive(text) {
    let s = String(text || '');
    let prev = '';
    while (s !== prev) {
        prev = s;
        s = s.replace(/(\p{L})[-_.\u00B7\u2022\u2027\u2010-\u2015\u2212\u2219\u22C5\u30FB\uFF65]+(?=\p{L})/gu, '$1');
    }
    return s;
}

// En and em dashes stay in place here. The legacy form still collapses
// them, matching live. A real split slur is caught later as its own word.
function collapseSeparators(text) {
    let s = String(text || '');
    let prev = '';
    while (s !== prev) {
        prev = s;
        s = s.replace(/(\p{L})[-_.\u00B7\u2022\u2027\u2010-\u2012\u2015\u2212\u2219\u22C5\u30FB\uFF65]+(?=\p{L})/gu, '$1');
        s = s.replace(/(^|[^\p{L}])(\p{L}+)[,:;]+(\p{L}+)(?!\p{L})/gu, function (whole, lead, left, right) {
            if (joinShortFragment(left, right)) return lead + left + right;
            return whole;
        });
    }
    return s;
}

// n,i,g,g,e,r is one run of single letters. Pairwise joins stop at nigg,er.
function collapseSingleLetterRuns(text) {
    return String(text || '').replace(/(^|[^\p{L}])\p{L}(?:[,:;.\-_*~|/+\\@\uFF20\u2010-\u2015\u2212]+\p{L}){2,}(?!\p{L})/gu, function (whole, lead) {
        return lead + whole.slice(String(lead || '').length).replace(/[^\p{L}]/gu, '');
    });
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
function foldBase(text) {
    let s = String(text || '').normalize('NFKC').normalize('NFKD');
    s = s.replace(/[\p{M}\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu, '');
    s = s.normalize('NFC');
    s = s.replace(/\p{Cf}/gu, '');
    s = s.replace(/[\u115F\u1160\u3164\uFFA0\u2800]/g, '');
    s = s.replace(/(\p{L})[\p{Extended_Pictographic}\p{So}\u{1F3FB}-\u{1F3FF}\u200D\uFE0F]+(?=\p{L})/gu, '$1');
    return foldLookalikes(s.toLowerCase());
}

// Live lowercases U+04C0 to U+04CF and reads that as l. The second fold
// reads the same character as i, so both shapes still match.
function foldedBases(text) {
    const primary = foldBase(text);
    if (String(text || '').indexOf('\u04C0') === -1) return [primary];
    const alt = foldBase(String(text).replace(/\u04C0/g, 'i'));
    if (alt === primary) return [primary];
    return [primary, alt];
}

// pr: mid-word @ joins a short disguise and splits a long pair.
// legacy: live's path, so @ stays and leet reads it as "a".
// at: a run of @ or ＠ is one "a", so @@ still reads as a single letter.
function prepareFromBase(base, mode) {
    let s = String(base || '');
    if (mode === 'at') s = s.replace(/[\uFF20@]+/g, 'a');
    if (mode === 'pr') s = unfoldMidWordAt(s);
    s = applyLeet(s);
    const unbroken = unbrokenWords(s);
    s = joinShortLineBreaks(s);
    if (mode === 'legacy') {
        s = collapseSeparatorsLive(s);
    } else {
        s = collapseSingleLetterRuns(s);
        s = collapseSeparators(s);
    }
    s = foldPh(s);
    s = collapseSpacedLetters(s);
    s = s.replace(/\s+/g, ' ').trim();
    return { text: s, unbroken: unbroken };
}

function prepareStrict(text) {
    return prepareFromBase(foldBase(text), 'pr');
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

function allowlistedSpelling(word, nameTokens) {
    const w = String(word || '');
    if (!w) return false;
    if (nameTokens && NAME_ALLOW[w] && (nameTokens === true || nameTokens.has(w))) return true;
    if (ALLOW[w]) return true;
    for (let i = 0; i < ALLOW_SUFFIXES.length; i++) {
        const suffix = ALLOW_SUFFIXES[i];
        if (w.length <= suffix.length + 2) continue;
        if (w.slice(-suffix.length) !== suffix) continue;
        if (ALLOW[w.slice(0, -suffix.length)]) return true;
    }
    return false;
}

// A fragment that is itself a term still counts when the pieces would
// spell an allowlisted word (g-rape, maga-zine). The whole allowlisted
// word does not.
// Exactly one doubled letter, and no triple. "fuuck" → "fuck".
// Empty when the word is not that shape.
function singleDoubleReduced(word) {
    const w = String(word || '');
    if (!w || /(\p{L})\1{2}/u.test(w)) return '';
    const doubles = w.match(/(\p{L})\1/gu);
    if (!doubles || doubles.length !== 1) return '';
    return w.replace(/(\p{L})\1/u, '$1');
}

function fragmentIsSlur(word, nameTokens) {
    const w = String(word || '');
    if (!w) return false;
    if (SLUR_EXACT[w]) return true;
    if (allowlistedSpelling(w, nameTokens)) return false;
    const reduced = singleDoubleReduced(w);
    if (reduced && allowlistedSpelling(reduced, nameTokens)) return false;
    for (let i = 0; i < SLUR_WORDS.length; i++) {
        const bad = SLUR_WORDS[i];
        if (bad.length >= 4 && w.indexOf(bad) !== -1) return true;
    }
    return false;
}

function joinedFragmentSlur(joined, first, nameTokens) {
    if (!joined || allowlistedSpelling(joined, nameTokens)) return false;
    if (SLUR_EXACT[joined]) return true;
    const head = String(first || '');
    for (let i = 0; i < SLUR_WORDS.length; i++) {
        const bad = SLUR_WORDS[i];
        if (bad.length < 3 || joined.length <= bad.length) continue;
        if (joined.indexOf(bad) !== 0) continue;
        if (head.length < bad.length && bad.indexOf(head) === 0) return true;
    }
    return false;
}

// A single symbol, a doubled separator or double space, or one emoji with
// spaces around it. Checked before leet, so "|" and "+" stay separators.
function slurGap(gap) {
    if (gap.length === 1 && !/[\p{L}\p{N}]/u.test(gap)) return true;
    if (/^(.)\1+$/u.test(gap) && gap.length >= 2 && !/[\p{L}\p{N}]/u.test(gap)) return true;
    if (/^\s+\p{Extended_Pictographic}\p{M}*\s+$/u.test(gap)) return true;
    return false;
}

function fragmentSlur(text, nameTokens) {
    const src = String(text || '');
    const runs = [];
    const re = /\p{L}+/gu;
    let match;
    while ((match = re.exec(src))) {
        runs.push({ start: match.index, end: match.index + match[0].length, word: match[0] });
    }
    for (let i = 0; i < runs.length; i++) {
        if (fragmentIsSlur(runs[i].word, nameTokens)) return true;
        for (let n = 2; n <= 3; n++) {
            const last = i + n - 1;
            if (last >= runs.length) break;
            let joined = runs[i].word;
            let ok = true;
            for (let k = 1; k < n; k++) {
                const gap = src.slice(runs[i + k - 1].end, runs[i + k].start);
                if (!slurGap(gap)) {
                    ok = false;
                    break;
                }
                joined += runs[i + k].word;
            }
            if (ok && joinedFragmentSlur(joined, runs[i].word, nameTokens)) return true;
        }
    }
    return atSeparatedSlur(src, runs, nameTokens);
}

// @ or ＠ between the letters of one token. Exact slur or compact phrase
// only, unless every piece is a single letter (then the slur list applies).
function atSeparatedSlur(src, runs, nameTokens) {
    let i = 0;
    while (i < runs.length) {
        let j = i;
        while (j + 1 < runs.length) {
            const gap = src.slice(runs[j].end, runs[j + 1].start);
            if (!/^[\uFF20@]+$/u.test(gap)) break;
            j++;
        }
        if (j > i) {
            let joined = '';
            let singles = true;
            for (let k = i; k <= j; k++) {
                joined += runs[k].word;
                if (runs[k].word.length !== 1) singles = false;
            }
            if (SLUR_EXACT[joined] || COMPACT_PHRASE[joined]) return true;
            if (singles && j - i >= 2 && fragmentIsSlur(joined, nameTokens)) return true;
        }
        i = j + 1;
    }
    return false;
}

// One doubled letter, and no other. "fuuck" becomes "fuck". Three of a
// kind stay with squeezeVariants. The reduced word has to be the term
// itself, so an allowlisted spelling is not opened up.
function dropSingleDouble(text) {
    return String(text || '').replace(/\p{L}+/gu, function (word) {
        return singleDoubleReduced(word) || word;
    });
}

// A doubled letter inside an allowlisted spelling (pedomeeter, graape)
// is masked before the in-word search. The reduced word is still checked
// as an exact term, so fuuck still matches.
function maskDoubledAllowlist(text, nameTokens) {
    return String(text || '').replace(/\p{L}+/gu, function (word) {
        const reduced = singleDoubleReduced(word);
        if (reduced && allowlistedSpelling(reduced, nameTokens)) return ' '.repeat(word.length);
        return word;
    });
}

function exactTermHit(text) {
    const raw = String(text || '');
    if (!raw) return false;
    const words = raw.split(/\s+/).filter(Boolean);
    for (let i = 0; i < BRIDGE_TERMS.length; i++) {
        const bad = BRIDGE_TERMS[i];
        if (bad.indexOf(' ') !== -1) {
            if (raw.indexOf(bad) !== -1) return true;
            continue;
        }
        for (let w = 0; w < words.length; w++) {
            if (words[w] === bad) return true;
        }
    }
    return false;
}

function allowlistedWord(word, unbroken, nameTokens) {
    const w = String(word || '');
    if (!w || !unbroken || !(unbroken.get(w) > 0)) return false;
    if (nameTokens && NAME_ALLOW[w] && (nameTokens === true || nameTokens.has(w))) return true;
    if (ALLOW[w]) return true;
    for (let i = 0; i < ALLOW_SUFFIXES.length; i++) {
        const suffix = ALLOW_SUFFIXES[i];
        if (w.length <= suffix.length + 2) continue;
        if (w.slice(-suffix.length) !== suffix) continue;
        if (ALLOW[w.slice(0, -suffix.length)]) return true;
    }
    return false;
}

function maskAllowlist(text, unbroken, nameTokens) {
    const left = new Map(unbroken || []);
    return String(text || '').replace(/\p{L}+/gu, function (word) {
        if (!allowlistedWord(word, left, nameTokens)) return word;
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

function bridgeHit(normalized, unbroken, nameTokens) {
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
    const masked = maskAllowlist(text, unbroken, nameTokens);
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

// A question about a bc1 or bc1q address, with no amount, is not a payment ask.
function plainBc1Question(text) {
    const raw = String(text || '');
    if (!/\bbc1q?\b/i.test(raw)) return false;
    const question = /\?/.test(raw) || /^\s*(how|what|why|when|where|who|which|can|could|do|does|did|is|are|should|would|explain)\b/i.test(raw);
    if (!question) return false;
    if (/\b\d+(?:[.,]\d+)?\s*(?:sats|btc(?:to)?|bitcoin)\b/i.test(raw)) return false;
    if (/\bsend\s+(?:me\s+)?\d/i.test(raw)) return false;
    return true;
}

function scamHit(text) {
    const raw = String(text || '');
    const skipBc1 = plainBc1Question(raw);
    for (let i = 0; i < SCAM_PATTERNS.length; i++) {
        if (skipBc1 && SCAM_PATTERNS[i].source.indexOf('bc1') !== -1) continue;
        if (SCAM_PATTERNS[i].test(raw)) return true;
    }
    return false;
}

function formHits(prepared, nameTokens) {
    const variants = squeezeVariants(prepared.text);
    for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        if (exactTermHit(dropSingleDouble(variant))) return true;
        if (bridgeHit(maskDoubledAllowlist(variant, nameTokens), prepared.unbroken, nameTokens)) return true;
    }
    return false;
}

function nameTokenSet(displayName) {
    if (displayName === true) return true;
    if (!displayName) return null;
    const tokens = foldBase(String(displayName)).split(/[^\p{L}]+/u).filter(Boolean);
    return new Set(tokens);
}

function moderateStrict(raw, displayName) {
    const sanitized = sanitizeOutgoing(raw).trim();
    if (!sanitized) return { clean: true, reason: '' };
    const nameTokens = nameTokenSet(displayName);
    const bases = foldedBases(sanitized);
    const modes = ['pr', 'legacy', 'at'];
    for (let b = 0; b < bases.length; b++) {
        const base = bases[b];
        if (fragmentSlur(base, nameTokens)) return { clean: false, reason: REASON_PROFANITY };
        for (let i = 0; i < modes.length; i++) {
            if (formHits(prepareFromBase(base, modes[i]), nameTokens)) return { clean: false, reason: REASON_PROFANITY };
        }
    }
    if (scamHit(sanitized) || scamHit(scamFold(sanitized))) return { clean: false, reason: REASON_SCAM };
    return { clean: true, reason: '' };
}

function moderateText(text, options) {
    const raw = String(text || '').trim();
    if (!raw) return { clean: true, reason: '' };
    if (options && options.strict) return moderateStrict(raw, options.displayName);
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
