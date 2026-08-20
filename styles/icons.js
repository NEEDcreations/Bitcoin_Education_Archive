// ============================================================
// Icon system — replaces emoji in the product surface.
//
// Emoji were the app's entire icon vocabulary: 255 in index.html alone, an
// emoji baked into 128 of the 145 channel titles, and the mobile nav rendered
// as 🏠🧭🎓🔔⚙️ at 1.3rem. Full-colour vendor glyphs at UI sizes are the
// single strongest "generated" signal, and they render differently on every
// platform.
//
// These are 24×24 stroke paths on a 1.5px grid, inheriting currentColor via
// the .icon class in styles/primitives.css. Emoji are kept where they are
// genuinely content: Nacho's dialogue, user reactions, forum posts.
//
// Usage:  icon('home')            -> 20px
//         icon('bell', 16)        -> 16px
//         icon('trophy', 24, 'ch-ico')
// ============================================================

var ICON_PATHS = {
    // navigation
    'home':        '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-6h5v6"/>',
    'compass':     '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5.5-5 2 2-5.5z"/>',
    'book':        '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v18H5.5A1.5 1.5 0 0 1 4 19.5z"/><path d="M8 3v18"/>',
    'bell':        '<path d="M18 10a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M10.5 20a2 2 0 0 0 3 0"/>',
    'settings':    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M2 12h3m14 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    'search':      '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>',
    // features
    'chat':        '<path d="M20 12a7.5 7.5 0 0 1-7.5 7.5H8L4 22v-4.3A7.5 7.5 0 0 1 12.5 4.5 7.5 7.5 0 0 1 20 12z"/>',
    'robot':       '<rect x="4" y="8" width="16" height="12" rx="2.5"/><path d="M12 4v4"/><circle cx="9" cy="14" r="1.2"/><circle cx="15" cy="14" r="1.2"/>',
    'chart':       '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 20v-6m4 6V9m4 11v-8"/>',
    'trophy':      '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5.5H5.5V8a2.5 2.5 0 0 0 2.5 2.5M16 5.5h2.5V8A2.5 2.5 0 0 1 16 10.5"/><path d="M12 13v3.5"/><path d="M8.5 20h7"/><path d="M10 20v-1.5h4V20"/>',
    'tv':          '<rect x="3" y="7" width="18" height="12.5" rx="2"/><path d="m8 3.5 4 3.5 4-3.5"/>',
    'lightning':   '<path d="M13.5 3 7 13h4l-.5 8 6.5-10h-4z"/>',
    'quest':       '<path d="M12 3 4 7v6c0 4.5 3.4 7.2 8 8 4.6-.8 8-3.5 8-8V7z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    'wallet':      '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10.5h18"/><circle cx="16.5" cy="14.5" r="1.2"/>',
    'users':       '<circle cx="9" cy="8.5" r="3.5"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6"/><path d="M17.5 14.8c2.1.6 3.5 2.3 3.5 4.7"/>',
    'dice':        '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="12" cy="12" r="1.2"/>',
    'lock':        '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    // content / topics
    'file':        '<path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M13.5 3v5.5H19"/>',
    'coin':        '<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5h4a2 2 0 0 1 0 4h-4h4.3a2 2 0 0 1 0 4H9.5"/><path d="M11 7v10"/>',
    'pickaxe':     '<path d="M4 20 14 10"/><path d="M9.5 5.5c3-2 7-1.5 9 1.5-2.5-.5-4 0-5.5 1.5S11 12.5 11.5 15c-3-2-3.5-6-2-9.5z"/>',
    'globe':       '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.4 3.8 5.4 3.8 9S14.5 18.6 12 21c-2.5-2.4-3.8-5.4-3.8-9S9.5 5.4 12 3z"/>',
    'shield':      '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/>',
    'seed':        '<path d="M12 21v-7"/><path d="M12 14c0-4 2.5-7 7-7 0 4.5-2.5 7-7 7z"/><path d="M12 16c0-3.3-2-5.8-5.5-5.8 0 3.7 2 5.8 5.5 5.8z"/>',
    'scroll':      '<path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6"/><path d="M6 4a2 2 0 0 0 0 4h2V4z"/><path d="M9.5 9.5h6m-6 4h6"/>',
    'link':        '<path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5"/><path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5"/>',
    'share':       '<path d="M4 12v7a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-7"/><path d="M12 15V3.5"/><path d="m8 7.5 4-4 4 4"/>',
    'star':        '<path d="m12 3.8 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 10l5.9-.8z"/>',
    'image':       '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m3.5 17.5 5-4.5 4 3.5 3-2.5 5 4"/>',
    'flame':       '<path d="M12 21c3.6 0 6-2.3 6-5.5 0-4.5-4.5-6-4.5-11C10 6 8 8.5 8 11c0-1-1-2-1-2-.7 1.2-1 2.7-1 4.5C6 18.7 8.4 21 12 21z"/>',
    // controls
    'check':       '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    'x':           '<path d="M6 6l12 12M18 6 6 18"/>',
    'chevron-down':'<path d="m6 9.5 6 6 6-6"/>',
    'chevron-right':'<path d="m9.5 6 6 6-6 6"/>',
    'arrow-up':    '<path d="M12 20V4"/><path d="m5.5 10.5 6.5-6.5 6.5 6.5"/>',
    'arrow-left':  '<path d="M20 12H4"/><path d="m10.5 5.5-6.5 6.5 6.5 6.5"/>',
    'arrow-right': '<path d="M4 12h16"/><path d="m13.5 5.5 6.5 6.5-6.5 6.5"/>',
    'plus':        '<path d="M12 5v14M5 12h14"/>',
    'minus':       '<path d="M5 12h14"/>',
    'external':    '<path d="M14 4h6v6"/><path d="M20 4l-8.5 8.5"/><path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    // chrome
    'sun':         '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2m0 15v2M3.9 3.9l1.5 1.5m13.2 13.2 1.5 1.5M2.5 12h2m15 0h2M3.9 20.1l1.5-1.5M18.6 5.4l1.5-1.5"/>',
    'moon':        '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    'volume':      '<path d="M4 9.5h3L11.5 6v12L7 14.5H4z"/><path d="M15 9.5a3.5 3.5 0 0 1 0 5"/><path d="M17.5 7a7 7 0 0 1 0 10"/>',
    'volume-off':  '<path d="M4 9.5h3L11.5 6v12L7 14.5H4z"/><path d="m15.5 10 4 4m0-4-4 4"/>',
    'pin':         '<path d="M12 21v-6"/><path d="M8.5 3h7l-1 5 2.5 3.5H6L8.5 8z"/>',
    'menu':        '<path d="M4 7h16M4 12h16M4 17h16"/>',
    'dot':         '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>'
};

/**
 * Render an icon as an inline SVG string.
 * @param {string} name  key in ICON_PATHS
 * @param {number} [size=20]  16, 20 or 24
 * @param {string} [cls='']   extra class names
 * @returns {string} SVG markup, or '' for an unknown name
 */
function icon(name, size, cls) {
    var p = ICON_PATHS[name];
    if (!p) { return ''; }
    var s = size || 20;
    var sizeCls = s === 16 ? ' icon-16' : (s === 24 ? ' icon-24' : '');
    return '<svg class="icon' + sizeCls + (cls ? ' ' + cls : '') +
        '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + p + '</svg>';
}

// Emoji at the head of a string — channel titles carry one in the data.
// Written with explicit escapes (surrogate pairs rather than the /u flag) so
// the pattern survives concatenation into bundle.js and minification.
var _LEADING_EMOJI = new RegExp(
    '^(?:' +
        '[\\uD83C-\\uD83E][\\uDC00-\\uDFFF]' +   // astral emoji (most of them)
        '|[\\u2190-\\u21FF]' +                    // arrows
        '|[\\u2300-\\u27BF]' +                    // misc technical, dingbats
        '|[\\u2B00-\\u2BFF]' +                    // misc symbols and arrows
        '|[\\u00A9\\u00AE\\u2122]' +              // (c) (r) (tm)
        '|[\\uFE00-\\uFE0F\\u200D\\u20E3]' +      // variation selectors, ZWJ, keycap
    ')+\\s*'
);

/**
 * Strip a leading emoji (and any following space) from a label.
 * @param {string} s
 * @returns {string}
 */
function stripLeadingEmoji(s) {
    if (typeof s !== 'string') { return s; }
    return s.replace(_LEADING_EMOJI, '');
}

/** Extract the leading emoji, or '' if there is none. */
function leadingEmoji(s) {
    if (typeof s !== 'string') { return ''; }
    var m = s.match(_LEADING_EMOJI);
    return m ? m[0].trim() : '';
}
