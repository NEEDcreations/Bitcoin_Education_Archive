'use strict';

// Same word list and matcher as global-chat.js containsProfanity / isSpammy,
// plus the scam patterns from the moderateContent callable. Used to keep
// Nacho activity shoutouts from repeating a slur or spam title in chat.
// No Firebase.

const BAD_WORDS = [
    'fuck','shit','bitch','dick','cock','pussy','cunt','ass','bastard','slut','whore','penis','vagina','anal','cum','jizz','dildo','tits','boob','nude','naked','milf','orgasm','molest','wank','twat','piss','skank','thot','stfu','gtfo','incel',
    'blowjob','handjob','fingering','masturbat','threesome','gangbang','fetish','bondage','bdsm','kinky','horny','aroused','erection','erectile','climax','ejaculat','deepthroat','rimjob','creampie','cuckold','dominatrix','escort','prostitut','hooker','stripper','camgirl','sexting','nudes','send nudes','dick pic','twerk',
    'nigger','nigga','fag','faggot','retard','retarded','nazi','hitler','kkk','spic','wetback','chink','gook','kike','towelhead','raghead','beaner','cracker','honky','coon','darkie','zipperhead','gringo','jap','paki','wop','dago',
    'kill yourself','kys','rape','pedo','suicide','terrorist','jihad','murder','genocide','lynch','ethnic cleansing','gas the','death to',
    'cut myself','cutting myself','slit my wrist','hang myself','end my life','want to die','wanna die','kill myself','self harm','self-harm','overdose on','jump off',
    'white power','white supremacy','heil','sieg heil','race war','great replacement','final solution','go back to your country','build the wall','deport them','they will not replace',
    'islamophob','christophob','antisemit','anti semit','zionist pig','crusade against','infidel','kafir','heathen scum','god hates',
    'maga','trump','biden','democrat','republican','liberal','conservative','left wing','right wing','antifa','proud boys','qanon','wwg1wga','lets go brandon','fjb','fjb',
    'all cops','acab','defund','illegal alien','anchor baby',
    'onlyfans','xnxx','pornhub','xvideos','porn','hentai',
];

const HATE_PHRASES = [
    'kill yourself','white power','white supremacy','sieg heil','race war','great replacement','final solution','go back to your country','build the wall','death to','gas the','ethnic cleansing','god hates','they will not replace','lets go brandon',
    'i will kill','i will hurt','i will find you','i know where you live','watch your back','you are dead','gonna beat','gonna hurt','gonna kill','come find you','track you down','dox you','swat you',
    'kill myself','cut myself','cutting myself','slit my wrist','hang myself','end my life','want to die','wanna die','self harm','overdose on','jump off a',
    'send nudes','dick pic','show me your','want to fuck','wanna fuck','lets fuck','have sex with','suck my','sit on my','bend over','get on your knees','sexually','sexual favor',
];

const SCAM_PATTERNS = [
    /send me \d+ btc/i,
    /double your bitcoin/i,
    /guaranteed.*return/i,
    /invest.*guaranteed/i,
    /free bitcoin.*send/i,
];

function normalizeChatText(text) {
    return String(text || '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .toLowerCase()
        .replace(/[0-9@$!*_\-]/g, function(c) {
            return { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i', '*': '' }[c] || c;
        });
}

function containsProfanity(text) {
    const lower = normalizeChatText(text);
    for (let p = 0; p < HATE_PHRASES.length; p++) {
        if (lower.includes(HATE_PHRASES[p])) return true;
    }
    const words = lower.split(/\s+/);
    for (let i = 0; i < BAD_WORDS.length; i++) {
        for (let w = 0; w < words.length; w++) {
            if (words[w] === BAD_WORDS[i]) return true;
        }
        if (BAD_WORDS[i].length >= 4 && lower.includes(BAD_WORDS[i])) return true;
    }
    return false;
}

function isSpammy(text) {
    const raw = String(text || '').replace(/[\u200B-\u200D\uFEFF]/g, '');
    if (raw.length > 0 && raw === raw.toUpperCase() && raw.length > 20) return true;
    if ((raw.match(/https?:\/\//g) || []).length > 2) return true;
    if (/(.)\1{6,}/.test(raw)) return true;
    return false;
}

function chatTextBlocked(text) {
    const raw = String(text || '');
    if (!raw.trim()) return '';
    if (containsProfanity(raw)) return 'profanity';
    if (isSpammy(raw)) return 'spam';
    for (let i = 0; i < SCAM_PATTERNS.length; i++) {
        if (SCAM_PATTERNS[i].test(raw)) return 'scam';
    }
    return '';
}

function hateHit(text) {
    const lower = normalizeChatText(text);
    for (let i = 0; i < HATE_PHRASES.length; i++) {
        if (lower.includes(HATE_PHRASES[i])) return true;
    }
    return false;
}

// Priority: hate and scam are refused. Spam is refused. Ordinary profanity is masked.
function classifyChatText(text) {
    const raw = String(text || '');
    if (!raw.trim()) return '';
    if (hateHit(raw)) return 'hate';
    for (let i = 0; i < SCAM_PATTERNS.length; i++) {
        if (SCAM_PATTERNS[i].test(raw)) return 'scam';
    }
    if (isSpammy(raw)) return 'spam';
    if (containsProfanity(raw)) return 'profanity';
    return '';
}

function tokenHitsProfanity(token) {
    const norm = normalizeChatText(token);
    if (!norm) return false;
    const parts = norm.split(/\s+/);
    for (let i = 0; i < BAD_WORDS.length; i++) {
        const bad = BAD_WORDS[i];
        if (bad.indexOf(' ') !== -1) {
            if (norm.includes(bad)) return true;
            continue;
        }
        for (let p = 0; p < parts.length; p++) {
            if (parts[p] === bad) return true;
        }
        if (bad.length >= 4 && norm.includes(bad)) return true;
    }
    return false;
}

function maskChatProfanity(text) {
    const raw = String(text || '');
    if (!raw) return '';
    return raw.split(/(\s+)/).map(function(part) {
        if (!part || /^\s+$/.test(part)) return part;
        if (!tokenHitsProfanity(part)) return part;
        const first = part.charAt(0);
        return first + '*'.repeat(Math.max(2, part.length - 1));
    }).join('');
}

module.exports = {
    containsProfanity: containsProfanity,
    isSpammy: isSpammy,
    chatTextBlocked: chatTextBlocked,
    classifyChatText: classifyChatText,
    maskChatProfanity: maskChatProfanity,
};
