'use strict';

// The server bad-word list from moderateContent. The callable and the
// Telegram mirror both use this so a client that skips the web filter
// still cannot forward profanity or a scam line.

const PROFANITY = [
    'fuck', 'shit', 'bitch', 'asshole', 'damn', 'cunt',
    'dick', 'cock', 'pussy', 'whore', 'slut', 'fag',
    'nigger', 'nigga', 'retard', 'kill yourself', 'kys',
];

const SCAM_PATTERNS = [
    /send me \d+ btc/i,
    /double your bitcoin/i,
    /guaranteed.*return/i,
    /invest.*guaranteed/i,
    /free bitcoin.*send/i,
    /send\s+(?:me\s+)?(?:\d+\s+)?(?:sats|btc|bitcoin)\b[^.\n]{0,48}\bbc1/i,
];

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

function moderateText(text) {
    const raw = String(text || '').trim();
    if (!raw) return { clean: true, reason: '' };
    const normalized = normalizeModerateText(raw);
    for (let i = 0; i < PROFANITY.length; i++) {
        const regex = new RegExp('\\b' + PROFANITY[i] + '\\b', 'i');
        if (regex.test(normalized)) {
            return { clean: false, reason: 'Content contains inappropriate language' };
        }
    }
    for (let i = 0; i < SCAM_PATTERNS.length; i++) {
        if (SCAM_PATTERNS[i].test(raw)) {
            return { clean: false, reason: 'Content contains potential scam patterns' };
        }
    }
    return { clean: true, reason: '' };
}

module.exports = {
    moderateText: moderateText,
    PROFANITY: PROFANITY,
    SCAM_PATTERNS: SCAM_PATTERNS,
};
