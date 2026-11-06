// © 2024-2026 603BTC LLC. All rights reserved.
// Shared Bitcoin Beats profanity mask.
// Browser: classic script sets window.beatsCensor.
// Cloud Functions: require('../beats-censor.js').
// Chat-bridge worker: default-import this CommonJS module.
// Display only. Stored titles, search text, and edit fields stay raw.
(function (root) {
    var WORDS = [
        'motherfuckers', 'motherfucker', 'motherfucking', 'motherfuckin', 'motherfuck',
        'bullshitting', 'bullshitters', 'bullshitter', 'bullshit',
        'fuckers', 'fucker', 'fucking', 'fuckin', 'fucked', 'fucks', 'fuck',
        'shitters', 'shitter', 'shitting', 'shitty', 'shits', 'shit', 'shite',
        'niggers', 'nigger', 'niggas', 'nigga',
        'faggots', 'faggot', 'fags', 'fag',
        'retards', 'retard',
        'trannies', 'tranny',
        'wetbacks', 'wetback',
        'kikes', 'kike',
        'spics', 'spic',
        'chinks', 'chink',
        'cunts', 'cunt',
        'bitches', 'bitching', 'bitch',
        'whores', 'whore',
        'twats', 'twat'
    ];
    var BEATS_CENSOR_RE = new RegExp('\\b(?:' + WORDS.join('|') + ')\\b', 'gi');

    function beatsMaskToken(word) {
        var chars = String(word).split('');
        if (chars.length <= 1) return word;
        if (chars.length === 2) return chars[0] + '*';
        var mid = '';
        for (var i = 0; i < chars.length - 2; i++) mid += '*';
        return chars[0] + mid + chars[chars.length - 1];
    }

    // always=true ignores the local "show uncensored" switch. Shared text
    // (Global Chat and DJ announcements) must pass true. There is no window
    // on the server or the worker, so those calls stay masked either way.
    function beatsCensor(str, always) {
        if (str == null) return '';
        str = String(str);
        if (!always && typeof window !== 'undefined' && window._beatsShowUncensored === true) return str;
        return str.replace(BEATS_CENSOR_RE, function (match) {
            return beatsMaskToken(match);
        });
    }

    if (typeof module === 'object' && module && module.exports) {
        module.exports = { beatsCensor: beatsCensor };
    }
    if (root) root.beatsCensor = beatsCensor;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
