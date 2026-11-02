// ============================================================
// Bitcoin Education Archive — Shared Utilities
// [AUDIT FIX] Extracted from duplicate definitions across files.
// Load BEFORE all other local scripts in index.html.
// ============================================================

/**
 * Safe cover image URL helper
 * Returns provided URL or a placeholder if missing/invalid
 * @param {string} url - image URL
 * @returns {string} - sanitized or fallback URL
 */
// Safe SVG placeholder (music note icon)
var _SAFE_COVER_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWUxYTJlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZpbGw9IiNmNzkzMWEiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7wnY61PC90ZXh0Pjwvc3ZnPg==';

function _safeCover(url) {
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return _SAFE_COVER_PLACEHOLDER;
    }
    var trimmed = url.trim();
    var lower = trimmed.toLowerCase();

    // [SECURITY FIX] Block javascript:, data:text/html:, vbscript:, blob: URIs
    if (/^(javascript|data:text\/html|vbscript|blob):/i.test(lower)) {
        console.warn('[XSS BLOCKED] Malicious image URL scheme rejected:', trimmed.substring(0, 50));
        return _SAFE_COVER_PLACEHOLDER;
    }

    // [SECURITY FIX] Only allow https:// or data:image/ URLs
    if (!/^(https:\/\/|data:image\/)/i.test(trimmed)) {
        console.warn('[XSS BLOCKED] Invalid URL scheme (must be https:// or data:image/):', trimmed.substring(0, 50));
        return _SAFE_COVER_PLACEHOLDER;
    }

    // [SECURITY FIX] Strip characters that could break out of HTML attributes
    var sanitized = trimmed.replace(/["'<>\\]/g, '');

    return sanitized;
}

// ---- Safe JSON parse from localStorage ----
// [AUDIT FIX #16] Prevents uncaught exceptions from corrupted localStorage
function safeJSON(key, fallback) {
    try {
        var raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('safeJSON: corrupted data for key "' + key + '", resetting.', e);
        try { localStorage.removeItem(key); } catch (e2) {}
        return fallback;
    }
}

// ---- HTML Escape ----
// Prevents XSS in user-generated content rendered as innerHTML
function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    // div.innerHTML encodes <, >, & but NOT " or ' — both can break out of
    // HTML attribute contexts (e.g. src="...", onerror="..."). Encode them
    // explicitly so escapeHtml is safe in element-text AND attribute contexts.
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---- Safe URL (blocks javascript:, data:, vbscript:, blob: URIs) ----
function sanitizeUrl(url) {
    if (!url) return '';
    url = url.trim();
    // Allow data:image/ URLs (base64 profile pictures stored by the app)
    if (/^data:image\//i.test(url)) return url;
    // Block all other data:, javascript:, vbscript:, blob: URLs
    if (/^(javascript|data|vbscript|blob):/i.test(url)) return '';
    return url;
}

// ---- Time Ago ----
// Converts a Firestore timestamp or Date to human-readable relative time
function timeAgo(ts) {
    if (!ts) return '';
    var date;
    if (ts.toDate) {
        date = ts.toDate();
    } else if (ts instanceof Date) {
        date = ts;
    } else {
        date = new Date(ts);
    }
    var diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return date.toLocaleDateString();
}

// ---- Page Visibility: pause/resume intervals when tab is hidden ----
// Prevents wasted CPU and API calls in background tabs
(function() {
    var _registeredIntervals = [];
    var _pausedIntervals = [];

    window.registerInterval = function(fn, ms, name) {
        var id = setInterval(fn, ms);
        _registeredIntervals.push({ id: id, fn: fn, ms: ms, name: name || 'unnamed' });
        return id;
    };

    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // Tab hidden — pause all registered intervals
            _registeredIntervals.forEach(function(entry) {
                clearInterval(entry.id);
            });
            _pausedIntervals = _registeredIntervals.slice();
            _registeredIntervals = [];
        } else {
            // Tab visible — resume all paused intervals
            _pausedIntervals.forEach(function(entry) {
                entry.fn(); // Run immediately on resume
                entry.id = setInterval(entry.fn, entry.ms);
                _registeredIntervals.push(entry);
            });
            _pausedIntervals = [];
        }
    });
})();

// ============================================================
// 🟠 Premium Tier System
// ============================================================

/** Check if current user has active premium */
function isPremium() {
    return typeof currentUser !== 'undefined' && currentUser && currentUser.premium && currentUser.premium.active === true;
}

// Server faucet cap (functions/index.js FAUCET.MAX_LIFETIME_PER_USER_SATS).
// Exposed on window so ranking.js still sees it after the bundle is minified.
var SAT_LIFETIME_CAP = 15000;
window.SAT_LIFETIME_CAP = SAT_LIFETIME_CAP;

/** Lifetime sat cap. The server faucet is a flat 15,000 for every account. */
function getSatCap() {
    return SAT_LIFETIME_CAP;
}
window.getSatCap = getSatCap;

// Claimable sats from server-maintained counters only.
// floor(max(0, points - pointsClaimed - pointsDonated - pointsExchanged) / 10),
// then limited by satsWithdrawn against the lifetime cap.
function claimableSats(user, cap) {
    var u = user || {};
    var points = Number(u.points) || 0;
    var claimed = Number(u.pointsClaimed) || 0;
    var donated = Number(u.pointsDonated) || 0;
    var exchanged = Number(u.pointsExchanged) || 0;
    var withdrawn = Number(u.satsWithdrawn) || 0;
    if (withdrawn < 0) withdrawn = 0;
    var balance = Math.floor(Math.max(0, points - claimed - donated - exchanged) / 10);
    var limit = (typeof cap === 'number' && isFinite(cap)) ? cap : SAT_LIFETIME_CAP;
    if (cap == null && typeof getSatCap === 'function') limit = getSatCap();
    var lifetimeLeft = Math.max(0, limit - withdrawn);
    return {
        balance: balance,
        lifetimeLeft: lifetimeLeft,
        claimable: Math.min(balance, lifetimeLeft),
        cap: limit,
        withdrawn: withdrawn
    };
}
window.claimableSats = claimableSats;

/** Premium tier constants */
// ---- Faction Username Styling ----
// Returns inline CSS string for faction-colored usernames.
// Cyber Hornets: yellow text, black outline
// Honey Badgers: black text, white outline
// Usage: style="' + window._factionNameStyle(faction) + '"
window._factionNameStyle = function(faction) {
    if (faction === 'cyber_hornets') {
        return 'color:#f7e400;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;font-weight:700;';
    }
    if (faction === 'honey_badgers') {
        return 'color:#1a1a1a;text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff;font-weight:700;';
    }
    return '';
};

var PREMIUM_CONFIG = {
    FREE_SAT_CAP: 15000,
    PREMIUM_SAT_CAP: 21000,
    FREE_SPINS: 1,
    PREMIUM_SPINS: 3,
    MONTHLY_PRICE_USD: 4.99,
    YEARLY_PRICE_USD: 42,
    LIFETIME_SATS: 210000,
    TIER_NAME: 'Bitcoin Maxi'
};

// ---- Education topic cache buster ----
// Appended to channel JSON fetches so a data edit is not stuck in the SW cache.
var DATA_CACHE_BUSTER = '20261027b';
function withDataCacheBuster(url) {
    if (!url || typeof url !== 'string') return url;
    if (/[?&]v=/.test(url)) return url;
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + DATA_CACHE_BUSTER;
}

// ---- Display-time strong-language mask ----
// Shared helper in the same role as a Beats beatsCensor: captions stay intact
// in the data files, and the reader sees the first and last letter (F**k).
// URLs are left untouched here so links keep working; censorUrlLabel masks
// the visible label only.
function maskStrongWord(word) {
    if (!word) return word;
    if (word.length <= 2) return word.charAt(0) + '*';
    var stars = '';
    for (var i = 0; i < word.length - 2; i++) stars += '*';
    return word.charAt(0) + stars + word.charAt(word.length - 1);
}
function censorUrlLabel(url) {
    if (!url) return url;
    return String(url).replace(/motherfuck(?:ing|ed|ers|er|s)?|fuck(?:ing|ed|ers|er|s)?/gi, function(w) {
        return maskStrongWord(w);
    });
}
function censorText(text) {
    if (!text || typeof text !== 'string') return text || '';
    var urls = [];
    var protectedText = text.replace(/https?:\/\/[^\s<>"']+/gi, function(u) {
        urls.push(u);
        return '\u0000URL' + (urls.length - 1) + '\u0000';
    });
    protectedText = protectedText.replace(/\b(?:motherfuck(?:ing|ed|ers|er|s)?|fuck(?:ing|ed|ers|er|s)?)\b/gi, function(w) {
        return maskStrongWord(w);
    });
    return protectedText.replace(/\u0000URL(\d+)\u0000/g, function(_, i) {
        return urls[Number(i)];
    });
}

// Startup logs stay quiet on the live site. localhost, a dev.* host,
// localStorage btc_debug=1, or ?btc_debug=1 turns them back on.
(function() {
    if (typeof window === 'undefined') return;
    var _log = (typeof console !== 'undefined' && console.log) ? console.log.bind(console) : function() {};
    window.btcDebugEnabled = function() {
        try {
            if (window.BTC_DEBUG) return true;
            var host = String((window.location && window.location.hostname) || '').toLowerCase();
            if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.indexOf('dev.') === 0) return true;
            if (window.localStorage && window.localStorage.getItem('btc_debug') === '1') return true;
            var search = String((window.location && window.location.search) || '');
            if (/(?:^|[?&])btc_debug=1(?:&|$)/.test(search)) return true;
        } catch (e) {}
        return false;
    };
    window.btcDebugLog = function() {
        if (!window.btcDebugEnabled()) return;
        try { _log.apply(console, arguments); } catch (e) {}
    };
})();
