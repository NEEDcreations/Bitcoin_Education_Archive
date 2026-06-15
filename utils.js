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

/** Get sat redemption cap based on tier */
function getSatCap() {
    return isPremium() ? 21000 : 10000;
}

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
    FREE_SAT_CAP: 10000,
    PREMIUM_SAT_CAP: 21000,
    FREE_SPINS: 1,
    PREMIUM_SPINS: 3,
    MONTHLY_PRICE_USD: 4.99,
    YEARLY_PRICE_USD: 42,
    LIFETIME_SATS: 210000,
    TIER_NAME: 'Bitcoin Maxi'
};
