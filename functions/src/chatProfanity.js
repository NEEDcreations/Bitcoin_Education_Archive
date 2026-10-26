'use strict';

// Same word list and matcher as global-chat.js containsProfanity / isSpammy,
// plus the scam patterns from the moderateContent callable. Used to keep
// Nacho activity shoutouts from repeating a slur or spam title in chat.
// No Firebase.

const { scamHostAllowed } = require('./scamAllowHosts');

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

// Matched against normalizeScamText(), which has already folded confusables,
// leet, emoji, repeated letters, spacing, and "dot" / "[.]" / "(.)". No /g
// flag: lastIndex would skip later comments. Amounts stay numeric so "0.01"
// and "500" still match. \s* (not \s+) so letter-spaced words still join.
// "pay" must not match inside "payment". Bare "double your" is not a scam.
const SCAM_SUSPICIOUS_TLDS = 'xyz|top|gq|ml|tk|cf|ga|buzz|click|quest';
const SCAM_TLDS = 'com|net|org|io|co|app|gg|me|info|biz|site|online|live|link|space|' + SCAM_SUSPICIOUS_TLDS;
// No trailing or internal word boundaries: letter-spacing glues the whole
// sentence into one word until a digit. pay(?!ment) keeps "payment" out.
const SCAM_PATTERNS = [
    /send\s*me\s*\d+(?:[.,]\d+)?\s*btc/,
    /double\s*your\s*(?:btc|bitcoin|sats?|money|coins|crypto)/,
    /\d+\s*x\s*your\s*(?:btc|bitcoin|sats?|money|coins|crypto)/,
    /guaranteed[\s\S]{0,48}returns?/,
    /invest[\s\S]{0,40}guaranteed/,
    /free\s*bitcoin[\s\S]{0,40}send/,
    /(?:send|deposit|pay(?!ment)|transfer)[\s\S]{0,80}(?:sats?|btc|bitcoin)[\s\S]{0,80}(?:sync|verify|unlock|validate|wallet|seed|mnemonic)/,
    /(?:sync|verify|unlock|validate)[\s\S]{0,40}(?:your\s*)?(?:wallet|account|rewards?)[\s\S]{0,40}(?:sats?|btc|bitcoin|seed|mnemonic|pay(?!ment)|send|deposit)/,
    /(?:earn|win|claim|get)[\s\S]{0,48}\d[\d.,]*[\s\S]{0,24}sats?[\s\S]{0,48}(?:admin|moderator|mod|dm|message|seed|mnemonic|telegram)/,
    /(?:dm|message)\s*(?:the\s*)?(?:admin|moderator|mod|support)\s*(?:to\s*|for\s*)(?:your\s*)?(?:claim|reward|prize|verify|unlock|seed|mnemonic|sats?|btc|bitcoin|funds|giveaway|sync|validate|recover)/,
    /(?:dm|message)\s*(?:the\s*)?(?:admin|moderator|mod)\s*(?:your\s*)?(?:seed|recovery|mnemonic|12\s*words|twelve\s*words)/,
    /(?:admin|moderator|mod)\s*will\s*(?:dm|message)\s*(?:you|me)/,
    /telegram[\s\S]{0,48}(?:claim|reward|prize|seed|mnemonic|recover|verify|unlock|admin|funds|sats?|btc)/,
    /(?:claim|reward|prize|seed|mnemonic|recover|verify|unlock|funds)[\s\S]{0,48}telegram/,
    /contact[\s\S]{0,40}support[\s\S]{0,48}(?:telegram|whatsapp|discord|recover|funds|seed|mnemonic|sats?|btc)/,
    /recover\s*your\s*funds/,
    /(?:send|share|give|paste|dm|tell|provide|type)\s*(?:me\s*)?(?:your\s*)?(?:seed|recovery|mnemonic|12\s*words|twelve\s*words)/,
    /enter\s*(?:your\s*)?(?:seed|recovery|mnemonic)(?:\s*phrase)?[\s\S]{0,40}(?:website|site|link|telegram|form|here|below|admin|mod|me)/,
    /your\s*(?:seed|recovery|mnemonic)(?:\s*phrase)?[\s\S]{0,28}(?:verify|validate|unlock|admin|mod|dm)/,
    /(?:give\s*away|giveaway)[\s\S]{0,40}(?:sats?|btc|bitcoin|seed|wallet)/,
    /(?:sats?|btc|bitcoin)[\s\S]{0,40}(?:give\s*away|giveaway)/,
];

// Greek, Cyrillic, and small-cap letters that look like Latin. A second
// pass treats a few of these as the letter a scam page would swap in
// (Cyrillic en as n, Cyrillic u as u) when the visual fold is different.
const SCAM_LOOKALIKE = {
    '\u0430': 'a', '\u0435': 'e', '\u043e': 'o', '\u0440': 'p', '\u0441': 'c',
    '\u0443': 'y', '\u0445': 'x', '\u0456': 'i', '\u0455': 's', '\u0501': 'd',
    '\u043a': 'k', '\u04bb': 'h', '\u043c': 'm', '\u0442': 't', '\u0432': 'b',
    '\u043d': 'h', '\u0433': 'r', '\u0458': 'j', '\u051b': 'q', '\u051d': 'w',
    '\u0475': 'v', '\u04cf': 'l', '\u0438': 'u', '\u0454': 'e', '\u0437': '3',
    '\u03b1': 'a', '\u03b2': 'b', '\u03b5': 'e', '\u03b9': 'i', '\u03ba': 'k',
    '\u03bd': 'v', '\u03bf': 'o', '\u03c1': 'p', '\u03c4': 't', '\u03c5': 'u',
    '\u03c7': 'x', '\u03c2': 'c', '\u03c3': 'o', '\u03b7': 'n', '\u03bc': 'u',
    '\u03c9': 'w', '\u0261': 'g', '\u0131': 'i',
    '\u1d00': 'a', '\u0299': 'b', '\u1d04': 'c', '\u1d05': 'd', '\u1d07': 'e',
    '\ua730': 'f', '\u0262': 'g', '\u029c': 'h', '\u026a': 'i', '\u1d0a': 'j',
    '\u1d0b': 'k', '\u029f': 'l', '\u1d0d': 'm', '\u0274': 'n', '\u1d0f': 'o',
    '\u1d18': 'p', '\u0280': 'r', '\ua731': 's', '\u1d1b': 't', '\u1d1c': 'u',
    '\u1d20': 'v', '\u1d21': 'w', '\u028f': 'y', '\u1d22': 'z',
};

const SCAM_SMALL = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
    fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
    nineteen: 19, twenty: 20,
};
const SCAM_SMALL_RE = 'zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty';

function foldScamLookalikes(text, alt) {
    return Array.from(String(text || '')).map(function(ch) {
        if (alt) {
            if (ch === '\u0443' || ch === '\u0423') return 'u';
            if (ch === '\u043d' || ch === '\u041d') return 'n';
            if (ch === '\u0433' || ch === '\u0413') return 'g';
            if (ch === '\u043f' || ch === '\u041f') return 'n';
        }
        return SCAM_LOOKALIKE[ch] || ch;
    }).join('');
}

// A standalone amount stays a number. A single digit inside a word still
// folds (s3nd, d0t, 4dmin) so the scam words match.
const LEET_DIGIT_WORDS = { sat: 1, sats: 1, to: 1, too: 1, tot: 1 };

function leetDigitWord(num) {
    if (!/^[0134578]{2,}$/.test(num)) return '';
    const word = num.replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/8/g, 'b');
    return LEET_DIGIT_WORDS[word] ? word : '';
}

function applyScamLeet(text) {
    const saved = [];
    let s = String(text || '').replace(/\b\d+(?:[.,]\d+)?\b/g, function(num) {
        if (leetDigitWord(num)) return num;
        saved.push(num);
        return '\uE000' + 'n'.repeat(saved.length) + '\uE001';
    });
    s = s
        .replace(/[@4]/g, 'a')
        .replace(/8/g, 'b')
        .replace(/[3\u20ac]/g, 'e')
        .replace(/[1!|]/g, 'i')
        .replace(/0/g, 'o')
        .replace(/[$5]/g, 's')
        .replace(/[7+]/g, 't');
    return s.replace(/\uE000n+\uE001/g, function(token) {
        return saved[token.length - 3];
    });
}

function foldScamNumberWords(text) {
    let s = String(text || '');
    const point = new RegExp('\\b(' + SCAM_SMALL_RE + ')\\s+point\\s+((?:' + SCAM_SMALL_RE + ')(?:\\s+(?:' + SCAM_SMALL_RE + '))*)\\b', 'g');
    s = s.replace(point, function(_m, whole, frac) {
        const digits = frac.split(/\s+/).map(function(word) { return String(SCAM_SMALL[word]); }).join('');
        return String(SCAM_SMALL[whole]) + '.' + digits;
    });
    s = s.replace(new RegExp('\\b(' + SCAM_SMALL_RE + ')\\s+thousand\\b', 'g'), function(_m, word) {
        return String(SCAM_SMALL[word] * 1000);
    });
    s = s.replace(new RegExp('\\b(' + SCAM_SMALL_RE + ')\\s+hundred\\b', 'g'), function(_m, word) {
        return String(SCAM_SMALL[word] * 100);
    });
    s = s.replace(new RegExp('\\b(' + SCAM_SMALL_RE + '|hundred|thousand)\\s+(?=sats?\\b|btc\\b|bitcoin\\b)', 'g'), function(match) {
        const word = match.trim();
        if (word === 'hundred') return '100 ';
        if (word === 'thousand') return '1000 ';
        return String(SCAM_SMALL[word]) + ' ';
    });
    return s;
}

// "s e n d" and "b i t - q u e s t d o t x y z" become "send" and "bitquest.xyz".
// The run has to start on its own, so the last letter of "trades" does not
// glue onto the word "a". Three single letters spelling dot become a period.
function joinScamSingles(text) {
    return String(text || '').replace(/(^|[^\p{L}\p{N}])((?:[a-z][^\p{L}\p{N}]+){2,}[a-z])(?=$|[^\p{L}\p{N}])/giu, function(_full, lead, run) {
        const chars = [];
        for (let i = 0; i < run.length; i++) {
            const ch = run.charAt(i);
            if (/[a-z]/i.test(ch)) chars.push(ch.toLowerCase());
        }
        let out = '';
        for (let i = 0; i < chars.length; i++) {
            if (chars[i] === 'd' && chars[i + 1] === 'o' && chars[i + 2] === 't') {
                out += '.';
                i += 2;
            } else {
                out += chars[i];
            }
        }
        return lead + out;
    });
}

function stripScamInnerPunct(text) {
    return String(text || '').split(/(\s+)/).map(function(tok) {
        if (!tok || /^\s+$/.test(tok) || tok === '.') return tok;
        if (/^\d+(?:[.,]\d+)?$/.test(tok)) return tok;
        if (/^(?:[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\.)+[a-z]{2,24}$/.test(tok)) return tok;
        return tok.replace(/[.\-_*'"`,;:!?]+/g, '');
    }).join('');
}

function normalizeScamText(text, alt) {
    let s = String(text || '').normalize('NFKC').normalize('NFKD');
    s = s.replace(/[\p{M}\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu, '');
    s = s.normalize('NFC');
    s = s.replace(/\p{Cf}/gu, '');
    s = s.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
    // NFKC already folds fullwidth ． (U+FF0E). Ideographic 。 and halfwidth ｡
    // (U+FF61 folds to 。) stay, so map them here. Emoji inside a word
    // ("Se🚀nd") is removed rather than turned into a space.
    s = s.replace(/[\u3002\uFF61\u2024\u2027\u2219\u22C5\u30FB\uFF0E\u00B7]/g, '.');
    s = s.replace(/[\p{Extended_Pictographic}\p{So}\u{1F3FB}-\u{1F3FF}\u200D]/gu, '');
    s = s.replace(/\u20BF/g, ' btc ');
    s = s.replace(/\btg\s*:/gi, ' telegram ');
    s = foldScamLookalikes(s.toLowerCase(), alt);
    let dotMarks = '';
    do {
        dotMarks = s;
        s = s.replace(/\(\s*\.\s*\)|\[\s*\.\s*\]|\{\s*\.\s*\}/g, '.');
    } while (s !== dotMarks);
    s = applyScamLeet(s);
    s = s.replace(/[\r\n]+/g, ' ');
    s = joinScamSingles(s);
    s = stripScamInnerPunct(s);
    s = s.replace(/\bd0t\b/g, 'dot');
    s = s.replace(/\bdot\b/g, '.');
    s = foldScamNumberWords(s);
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/\s*\.\s*/g, '.');
    return s;
}

// A run of 3+ of the same letter ("Seeend", "depooosit") is tried as one
// letter and as two. "seed" and "message" only double a letter, so they stay.
function scamSqueezeForms(text) {
    const norm = String(text || '');
    const once = norm.replace(/(\p{L})\1{2,}/gu, '$1');
    if (once === norm) return [norm];
    const twice = norm.replace(/(\p{L})\1{2,}/gu, '$1$1');
    return twice === once ? [norm, once] : [norm, once, twice];
}

const SUSPICIOUS_TLDS = { xyz: 1, top: 1, gq: 1, ml: 1, tk: 1, cf: 1, ga: 1, buzz: 1, click: 1, quest: 1 };

function hadObfuscatedDot(text) {
    const raw = String(text || '');
    if (/\(\s*\.\s*\)|\[\s*\.\s*\]|\{\s*\.\s*\}/.test(raw)) return true;
    if (/\bd0t\b/i.test(raw) || /\bdot\b/i.test(raw)) return true;
    if (/[a-z0-9]\s+\.\s+[a-z0-9]/i.test(raw)) return true;
    if (/[\u200B\u2060\u00AD]/.test(raw) && /\./.test(raw)) return true;
    if (/[\u3002\uFF0E\uFF61]/.test(raw)) return true;
    return false;
}

// A normal "X dot com" is a scam only next to an offer, a payment, a seed,
// or a claim. A suspicious TLD (.top, .xyz, …) still stands on its own.
const DOMAIN_OFFER_RE = /\b(?:send|deposit|pay(?!ment)|transfer|claim|unlock|verify|validate|sync|seed|recovery|mnemonic|giveaway|double|dm|earn|win|reward|funds)\b/;

function unknownScamDomain(original, norm) {
    const obfuscated = hadObfuscatedDot(original);
    const offer = DOMAIN_OFFER_RE.test(norm);
    const re = new RegExp('\\b(?:[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\\.)+(?:' + SCAM_TLDS + ')\\b', 'g');
    const found = String(norm || '').match(re);
    if (!found) return false;
    for (let i = 0; i < found.length; i++) {
        if (scamHostAllowed(found[i])) continue;
        const tld = found[i].slice(found[i].lastIndexOf('.') + 1);
        if (SUSPICIOUS_TLDS[tld]) return true;
        const openPlatform = found[i] === 'forms.gle' || found[i].slice(-10) === '.forms.gle'
            || found[i].slice(-11) === '.medium.com' || found[i].slice(-11) === '.google.com';
        if (openPlatform && offer) return true;
        if (obfuscated && offer) return true;
    }
    return false;
}

// Longer phrases first so "do not need to share" is not cut at "do not".
const SCAM_NEGATION_RE = /\b(?:do not need to|don't need to|dont need to|no need to|never need to|do not|don't|dont|cannot|can not|can't|cant|never|avoid|beware(?:\s+of)?|not)\s+(?:sharing|sending|giving|entering|pasting|telling|typing|providing|depositing|paying|transferring|doubling|share|send|give|enter|paste|tell|type|provide|deposit|pay|transfer|double|dm|message|contact)\b[^.,!?]{0,80}/g;
// Explaining a scam is not the same as pitching one. A direct "send me" /
// "DM me" still matches. "scammed" is not in this list: the regression
// sentence about guaranteed returns stays a hit.
const SCAM_WARNING_RE = /\b(?:red flags?|beware|watch out|stay away|do not exist|does not exist|don't exist|dont exist|is a scam|it's a scam|its a scam|scammers?)\b/;
const SCAM_DIRECT_PITCH_RE = /\b(?:send\s*me|dm\s*me|message\s*me)\b|\b(?:deposit|pay(?!ment)|transfer)\s*\d/;

function guardScamText(norm) {
    return String(norm || '').replace(SCAM_NEGATION_RE, ' ');
}

function scamHit(text) {
    const base = [normalizeScamText(text, false)];
    const alt = normalizeScamText(text, true);
    if (alt !== base[0]) base.push(alt);
    const forms = [];
    for (let i = 0; i < base.length; i++) scamSqueezeForms(base[i]).forEach(function(form) {
        if (forms.indexOf(form) === -1) forms.push(form);
    });
    for (let f = 0; f < forms.length; f++) {
        const norm = forms[f];
        if (!norm) continue;
        const guarded = guardScamText(norm);
        if (SCAM_WARNING_RE.test(norm) && !SCAM_DIRECT_PITCH_RE.test(guarded)) continue;
        if (unknownScamDomain(text, guarded)) return true;
        for (let i = 0; i < SCAM_PATTERNS.length; i++) {
            if (SCAM_PATTERNS[i].test(guarded)) return true;
        }
    }
    return false;
}

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
    if (scamHit(raw)) return 'scam';
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
    if (scamHit(raw)) return 'scam';
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
    normalizeScamText: normalizeScamText,
};
