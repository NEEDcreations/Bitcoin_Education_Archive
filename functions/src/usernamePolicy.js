'use strict';

// Username checks shared by setUsername. No Firebase. The client is not trusted.

const MIN_LEN = 3;
const MAX_LEN = 20;
const NAME_RE = /^[A-Za-z0-9 _\-.]+$/;

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

// ctx.taken: some other account already has this name.
// ctx.selfHasSame: this account already uses this exact name (idempotent save).
function assessUsername(name, ctx) {
    const raw = name == null ? '' : String(name);
    if (hasHtml(raw)) return { ok: false, error: 'html' };
    const trimmed = raw.trim();
    if (trimmed.length < MIN_LEN) return { ok: false, error: 'short' };
    if (trimmed.length > MAX_LEN) return { ok: false, error: 'long' };
    if (!NAME_RE.test(trimmed)) return { ok: false, error: 'charset' };
    if (containsProfanity(trimmed)) return { ok: false, error: 'profanity' };
    const info = ctx || {};
    if (info.taken === true && info.selfHasSame !== true) return { ok: false, error: 'taken' };
    return { ok: true, username: trimmed, username_lower: trimmed.toLowerCase() };
}

const USERNAME_MESSAGES = {
    html: 'Usernames cannot include HTML.',
    short: 'Username must be at least 3 characters.',
    long: 'Username must be 20 characters or less.',
    charset: 'Use letters, numbers, spaces, underscores, hyphens, or dots.',
    profanity: 'That username is not allowed.',
    taken: 'That username is already taken.',
};

function usernameMessage(code) {
    return USERNAME_MESSAGES[code] || 'Could not save that username.';
}

module.exports = {
    assessUsername,
    containsProfanity,
    usernameMessage,
    MIN_LEN,
    MAX_LEN,
};
