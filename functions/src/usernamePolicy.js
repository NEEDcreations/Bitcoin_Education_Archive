'use strict';

// Username checks shared by setUsername. No Firebase. The client is not trusted.

const MIN_LEN = 3;
const MAX_LEN = 20;
// No whitespace of any kind (spaces break @mentions and Telegram tags).
const NAME_RE = /^[A-Za-z0-9_\-.]+$/;

const PROFANITY_LIST = [
    'fuck', 'shit', 'ass', 'bitch', 'dick', 'cock', 'pussy', 'cunt', 'damn', 'hell',
    'bastard', 'slut', 'whore', 'fag', 'faggot', 'nigger', 'nigga', 'retard', 'retarded', 'penis', 'vagina',
    'porn', 'sex', 'anal', 'cum', 'jizz', 'dildo', 'tits', 'boob', 'nude', 'naked',
    'hentai', 'milf', 'orgasm', 'erect', 'molest', 'rape', 'pedo', 'nazi', 'hitler',
    'kkk', 'jihad', 'terrorist', 'kill', 'murder', 'suicide', 'die', 'stfu', 'gtfo',
    'wank', 'twat', 'bollocks', 'arse', 'shag', 'piss', 'crap', 'douche', 'skank',
    'thot', 'incel', 'simp', 'onlyfans', 'xnxx', 'pornhub', 'xvideos',
    'blowjob', 'handjob', 'fingering', 'masturbat', 'threesome', 'gangbang', 'fetish', 'bondage', 'bdsm', 'kinky', 'horny', 'aroused', 'erection', 'erectile', 'climax', 'ejaculat', 'deepthroat', 'rimjob', 'creampie', 'cuckold', 'dominatrix', 'escort', 'prostitut', 'hooker', 'stripper', 'camgirl', 'sexting', 'nudes', 'twerk',
    'spic', 'wetback', 'chink', 'gook', 'kike', 'towelhead', 'raghead', 'beaner', 'coon', 'darkie', 'zipperhead', 'jap', 'paki', 'wop', 'dago',
    'maga', 'trump', 'biden', 'democrat', 'republican', 'antifa', 'qanon', 'wwg1wga', 'acab',
    'supremacy', 'genocide', 'lynch'
];

function containsProfanity(str) {
    const lower = String(str || '').toLowerCase()
        .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
        .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
        .replace(/\$/g, 's').replace(/@/g, 'a').replace(/!/g, 'i')
        .replace(/\*/g, '').replace(/_/g, '').replace(/-/g, '')
        .replace(/[^a-z\s]/g, ' ');
    const words = lower.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
        if (PROFANITY_LIST.indexOf(words[i]) !== -1) return true;
    }
    const compressed = lower.replace(/\s/g, '');
    for (let j = 0; j < PROFANITY_LIST.length; j++) {
        const bad = PROFANITY_LIST[j];
        if (bad.length >= 4 && compressed.indexOf(bad) !== -1) return true;
    }
    return false;
}

function hasHtml(raw) {
    return /[<>]/.test(raw) || /&(?:#x?[0-9a-f]+|[a-z]+);/i.test(raw) || /<\/?[a-z!]/i.test(raw);
}

// Exact impersonation names. "mod" is exact-only so "modern" stays available.
const RESERVED_EXACT = [
    'nacho', 'admin', 'moderator', 'mod', 'support', 'official',
    'satoshi', 'needcreations', 'bitcoinquest', 'system'
];
// Substrings that still impersonate even with a suffix (NachoBot, Admin_).
// "mod" stays exact-only so "modern" is allowed. Digits are stripped before this check.
const RESERVED_CONTAINS = [
    'nacho', 'admin', 'moderator', 'official', 'support', 'staff',
    'satoshi', 'needcreations', 'bitcoinquest', 'system'
];

const HOLD_MS = 30 * 24 * 60 * 60 * 1000;
const RENAME_MS = 24 * 60 * 60 * 1000;
const ANON_SQUAT_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeReserved(name) {
    return String(name || '').toLowerCase()
        .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
        .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
        .replace(/\$/g, 's').replace(/@/g, 'a').replace(/!/g, 'i')
        .replace(/[0-9]/g, '')
        .replace(/[\s._\-]/g, '');
}

function reservedName(name) {
    const n = normalizeReserved(name);
    if (!n) return false;
    if (RESERVED_EXACT.indexOf(n) !== -1) return true;
    for (let i = 0; i < RESERVED_CONTAINS.length; i++) {
        if (n.indexOf(RESERVED_CONTAINS[i]) !== -1) return true;
    }
    return false;
}

// doc fields are milliseconds. Owner can keep or reclaim. A released name stays
// with holdUid for 30 days. An anon reservation older than 30 days is free.
function reservationBlocks(doc, uid, nowMs) {
    if (!doc || !doc.uid) return false;
    const now = Number(nowMs);
    const clock = Number.isFinite(now) ? now : 0;
    if (doc.releasedAt != null && doc.releasedAt !== '') {
        const released = Number(doc.releasedAt);
        if (!Number.isFinite(released)) return true;
        if (clock - released >= HOLD_MS) return false;
        if (doc.holdUid === uid || doc.uid === uid) return false;
        return true;
    }
    if (doc.uid === uid) return false;
    if (doc.anon === true) {
        const at = Number(doc.at);
        if (Number.isFinite(at) && clock - at > ANON_SQUAT_MS) return false;
    }
    return true;
}

// ctx.taken: some other account already has this name.
// ctx.selfHasSame: this account already uses this exact name (idempotent save).
function assessUsername(name, ctx) {
    const raw = name == null ? '' : String(name);
    if (hasHtml(raw)) return { ok: false, error: 'html' };
    const trimmed = raw.trim();
    if (/[\s\u180E\u200B-\u200D\u2060\uFEFF]/.test(trimmed)) return { ok: false, error: 'spaces' };
    if (trimmed.length < MIN_LEN) return { ok: false, error: 'short' };
    if (trimmed.length > MAX_LEN) return { ok: false, error: 'long' };
    if (!NAME_RE.test(trimmed)) return { ok: false, error: 'charset' };
    if (containsProfanity(trimmed)) return { ok: false, error: 'profanity' };
    const info = ctx || {};
    if (reservedName(trimmed) && info.allowReserved !== true && info.selfHasSame !== true) {
        return { ok: false, error: 'reserved' };
    }
    if (info.renameTooSoon === true && info.selfHasSame !== true) {
        return { ok: false, error: 'rename_limit' };
    }
    if (info.taken === true && info.selfHasSame !== true) return { ok: false, error: 'taken' };
    return { ok: true, username: trimmed, username_lower: trimmed.toLowerCase() };
}

const USERNAME_MESSAGES = {
    html: 'Usernames cannot include HTML.',
    short: 'Username must be at least 3 characters.',
    long: 'Username must be 20 characters or less.',
    spaces: 'Usernames cannot contain spaces. Try an underscore instead, like chill_guy.',
    charset: 'Use letters, numbers, underscores, hyphens, or dots. No spaces.',
    profanity: 'That username is not allowed.',
    reserved: 'That name is reserved.',
    rename_limit: 'You can change your username once a day.',
    taken: 'That username is already taken.',
};

function usernameMessage(code) {
    return USERNAME_MESSAGES[code] || 'Could not save that username.';
}

module.exports = {
    assessUsername,
    containsProfanity,
    usernameMessage,
    normalizeReserved,
    reservedName,
    reservationBlocks,
    MIN_LEN,
    MAX_LEN,
    HOLD_MS,
    RENAME_MS,
    ANON_SQUAT_MS,
};
