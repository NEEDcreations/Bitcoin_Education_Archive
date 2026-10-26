'use strict';

// moderateContent keeps the short whole-word list. The Telegram mirror
// passes { strict: true } and uses the old bridgeToTelegram term list,
// matched the same way: a phrase or a term of 4+ characters matches
// inside a word, and a shorter term has to be a whole word.
// Political terms are the old bridge list, unchanged.

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

const SCAM_PATTERNS = [
    /send me \d+(?:[.,]\d+)? btc/i,
    /double your bitcoin/i,
    /guaranteed.*return/i,
    /invest.*guaranteed/i,
    /free bitcoin.*send/i,
    /send\s+(?:me\s+)?(?:\d+(?:[.,]\d+)?\s*)?(?:sats|btc|bitcoin)\b[^.\n]{0,48}\bbc1/i,
];

const REASON_PROFANITY = 'Content contains inappropriate language';
const REASON_SCAM = 'Content contains potential scam patterns';

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

// Same visible-text cleanup the mirror applies before Telegram sees a line:
// HTML tags, %%tokens%%, markdown links, and invisible characters.
function sanitizeOutgoing(text) {
    let out = String(text || '');
    out = out.replace(/<span\b[^>]*\bdata-profile-uid\s*=\s*["'][^"']*["'][^>]*>([\s\S]*?)<\/span>/gi, '$1');
    out = out.replace(/<[^>]*>/g, '');
    out = out.replace(/%%[A-Za-z0-9_]+%%/g, '');
    out = out.replace(/\[([^\]]+)\]\((?:https?:\/\/|mailto:|javascript:)[^)]*\)/gi, '$1');
    out = out.replace(/[\u200B-\u200D\uFEFF]/g, '');
    return out;
}

function applyLeet(text) {
    return String(text || '')
        .replace(/[@4]/g, 'a')
        .replace(/[8]/g, 'b')
        .replace(/[3€]/g, 'e')
        .replace(/[1!|]/g, 'i')
        .replace(/[0]/g, 'o')
        .replace(/[$5]/g, 's')
        .replace(/[7+]/g, 't');
}

// NFKC folds fullwidth. Format characters (soft hyphen, zero-width) are
// removed. Separators between letters collapse so fuck-off matches fuck.
function normalizeStrictText(text) {
    let s = String(text || '').normalize('NFKC');
    s = s.replace(/\p{Cf}/gu, '');
    s = applyLeet(s.toLowerCase());
    let prev = '';
    while (s !== prev) {
        prev = s;
        s = s.replace(/(\p{L})[-_.*]+(?=\p{L})/gu, '$1');
    }
    s = s.replace(/\s+/g, ' ').trim();
    return s;
}

function bridgeHit(normalized) {
    const text = String(normalized || '');
    if (!text) return false;
    const compact = text.replace(/\s+/g, '');
    const words = text.split(/\s+/).filter(Boolean);
    for (let i = 0; i < BRIDGE_TERMS.length; i++) {
        const bad = BRIDGE_TERMS[i];
        if (bad.indexOf(' ') !== -1) {
            if (text.indexOf(bad) !== -1) return true;
            if (compact.indexOf(bad.replace(/\s+/g, '')) !== -1) return true;
            continue;
        }
        for (let w = 0; w < words.length; w++) {
            if (words[w] === bad) return true;
        }
        if (bad.length >= 4 && text.indexOf(bad) !== -1) return true;
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
    if (bridgeHit(normalizeStrictText(sanitized))) return { clean: false, reason: REASON_PROFANITY };
    if (scamHit(sanitized)) return { clean: false, reason: REASON_SCAM };
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
    SCAM_PATTERNS: SCAM_PATTERNS,
    sanitizeOutgoing: sanitizeOutgoing,
    normalizeStrictText: normalizeStrictText,
};
