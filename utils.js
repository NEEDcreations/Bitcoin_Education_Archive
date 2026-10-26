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
var DATA_CACHE_BUSTER = '20261022b';
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

// ============================================================
// Explicit popup stack. Popup-opening code calls window.bqModal.open.
// No page scan, no reparenting, no prototype patches, no MutationObserver.
// The popup's layer becomes the current top + 1 and is never lowered.
// Settings (#usernameModal, CSS 2100008) and Terms (#tosModal, CSS 2100010)
// stay at that floor or higher. Escape and Back close only popups that
// registered onClose, and that onClose settles the code waiting on them.
// ============================================================
(function() {
    if (typeof document === 'undefined' || (window.bqModal && window.bqModal.open)) return;

    var stack = [];
    var swallowPop = false;
    var FLOORS = { usernameModal: 2100008, tosModal: 2100010 };

    function shown(node) {
        if (!node || node.nodeType !== 1) return false;
        if (node.isConnected === false) return false;
        if (node.hidden || (node.hasAttribute && node.hasAttribute('hidden'))) return false;
        if (node.getAttribute && node.getAttribute('aria-hidden') === 'true') return false;
        var transform = (node.style && node.style.transform) || '';
        if (/translateY\(\s*100%/.test(transform)) return false;
        if (node.id === 'usernameModal' || node.id === 'tosModal' || node.id === 'questModal' || node.id === 'leaderboard') {
            return !!(node.classList && node.classList.contains('open'));
        }
        try {
            var cs = window.getComputedStyle ? window.getComputedStyle(node) : null;
            if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
        } catch (e) {}
        if (node.style && node.style.display === 'none') return false;
        return true;
    }

    function numericZ(node) {
        if (!node || node.nodeType !== 1) return 0;
        var best = 0;
        try {
            if (window.getComputedStyle) {
                var computed = parseInt(window.getComputedStyle(node).zIndex, 10);
                if (computed > best) best = computed;
            }
        } catch (e) {}
        if (node.style && node.style.zIndex) {
            var inline = parseInt(node.style.zIndex, 10);
            if (inline > best) best = inline;
        }
        var floor = FLOORS[node.id];
        if (floor && floor > best) best = floor;
        return best;
    }

    function findRec(el) {
        for (var i = 0; i < stack.length; i++) if (stack[i].el === el) return i;
        return -1;
    }

    function layer(excludeEl, skipTerms) {
        var top = 0;
        var ids = ['usernameModal', 'tosModal'];
        for (var i = 0; i < ids.length; i++) {
            if (skipTerms && ids[i] === 'tosModal') continue;
            var node = document.getElementById(ids[i]);
            if (!shown(node) || node === excludeEl) continue;
            var z = numericZ(node);
            if (z > top) top = z;
        }
        for (var j = 0; j < stack.length; j++) {
            var el = stack[j].el;
            if (!el || el === excludeEl || el.isConnected === false) continue;
            if (skipTerms && el.id === 'tosModal') continue;
            var sz = numericZ(el);
            if (sz > top) top = sz;
        }
        return top;
    }

    function writeZ(el, z) {
        if (!el) return;
        if (el.style && el.style.setProperty) el.style.setProperty('z-index', String(z), 'important');
        else if (el.style) el.style.zIndex = String(z);
    }

    function raise(el) {
        var own = numericZ(el);
        var terms = document.getElementById('tosModal');
        var termsOpen = !!(terms && el !== terms && shown(terms));
        var next = layer(el, termsOpen) + 1;
        var applied = own;
        if (own < next) {
            writeZ(el, next);
            applied = next;
        }
        if (termsOpen) {
            var termsZ = numericZ(terms);
            if (applied >= termsZ) writeZ(terms, applied + 1);
        }
        return applied;
    }

    function focusables(root) {
        if (!root || !root.querySelectorAll) return [];
        var nodes = root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        var out = [];
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (!n || n.disabled) continue;
            if (n.getAttribute && (n.getAttribute('aria-hidden') === 'true' || n.getAttribute('tabindex') === '-1')) continue;
            if (n.offsetParent === null && n !== document.activeElement) {
                try {
                    var cs = window.getComputedStyle ? window.getComputedStyle(n) : null;
                    if (cs && cs.position !== 'fixed' && cs.display === 'none') continue;
                } catch (e) {}
            }
            out.push(n);
        }
        return out;
    }

    function focusInside(el) {
        var items = focusables(el);
        var target = items.length ? items[0] : el;
        if (target === el && target.setAttribute && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        try { if (target && target.focus) target.focus(); } catch (e) {}
    }

    function restoreFocus(rec) {
        var target = rec && rec.prevFocus;
        if (!target || target.isConnected === false) {
            var under = null;
            for (var i = stack.length - 1; i >= 0; i--) {
                if (stack[i].el && stack[i].el.isConnected !== false) { under = stack[i].el; break; }
            }
            target = under;
        }
        if (target && target !== document.body && typeof target.focus === 'function') {
            try { target.focus(); } catch (e) {}
        }
    }

    function topRec() {
        for (var i = stack.length - 1; i >= 0; i--) {
            var rec = stack[i];
            if (!rec.el || rec.el.isConnected === false) {
                stack.splice(i, 1);
                continue;
            }
            if (!shown(rec.el)) continue;
            return rec;
        }
        return null;
    }

    function topPushed() {
        for (var i = stack.length - 1; i >= 0; i--) {
            if (stack[i].pushed && stack[i].el && stack[i].el.isConnected !== false) return stack[i];
        }
        return null;
    }

    function open(el, opts) {
        if (!el || el.nodeType !== 1) return 0;
        opts = opts || {};
        if (el.id === 'usernameModal' || el.id === 'tosModal') return numericZ(el);
        if (el.setAttribute) {
            if (!el.getAttribute('role')) el.setAttribute('role', 'dialog');
            el.setAttribute('aria-modal', 'true');
        }
        var z = raise(el);
        var idx = findRec(el);
        var prev = null;
        var active = document.activeElement;
        if (active && active !== document.body && active !== el && (!el.contains || !el.contains(active))) prev = active;
        if (idx >= 0) {
            var existing = stack[idx];
            if (opts.onClose) existing.onClose = opts.onClose;
            else if (opts.onClose === null) existing.onClose = null;
            if (prev) existing.prevFocus = prev;
            if (opts.trap != null) existing.trap = opts.trap !== false;
            stack.splice(idx, 1);
            stack.push(existing);
            if (existing.trap !== false) focusInside(el);
            return z;
        }
        var pushed = false;
        if (typeof opts.onClose === 'function') {
            try {
                history.pushState({ bqModal: true }, '', window.location.href);
                pushed = true;
            } catch (e) {}
        }
        stack.push({
            el: el,
            onClose: typeof opts.onClose === 'function' ? opts.onClose : null,
            pushed: pushed,
            prevFocus: prev,
            trap: opts.trap !== false
        });
        if (opts.trap !== false) focusInside(el);
        return z;
    }

    function release(el) {
        var idx = findRec(el);
        if (idx < 0) return;
        var rec = stack[idx];
        var wasTop = idx === stack.length - 1;
        stack.splice(idx, 1);
        if (rec.pushed) {
            rec.pushed = false;
            swallowPop = true;
            try { history.back(); } catch (e) { swallowPop = false; }
        }
        if (wasTop) restoreFocus(rec);
    }

    function close(el) {
        var idx = findRec(el);
        if (idx < 0) return false;
        var rec = stack[idx];
        if (typeof rec.onClose !== 'function') return false;
        var fn = rec.onClose;
        rec.onClose = null;
        try { fn(); } catch (e) {}
        if (findRec(el) >= 0) release(el);
        return true;
    }

    function topicsOpen() {
        var dlg = document.getElementById('topicsBrowser');
        return !!(dlg && dlg.hidden !== true && shown(dlg));
    }

    function mentionOwns(e) {
        var ac = document.getElementById('chatAutocomplete');
        if (!ac || !shown(ac)) return false;
        if (ac.style && ac.style.display === 'none') return false;
        var t = e && e.target;
        if (!t) return true;
        if (t === ac || (ac.contains && ac.contains(t))) return true;
        if (t.id === 'globalChatInput') return true;
        if (t.closest && t.closest('#chatAutocomplete')) return true;
        return false;
    }

    function nachoOwns() {
        var bubble = document.getElementById('nacho-bubble');
        if (!bubble) return false;
        if (bubble.getAttribute && bubble.getAttribute('data-trivia') === '1') return true;
        return !!(bubble.classList && bubble.classList.contains('show'));
    }

    function onEscape(e) {
        if (!e) return;
        var key = e.key;
        if (key !== 'Escape' && key !== 'Esc' && e.keyCode !== 27) return;
        var t = e.target;
        if (t && t.closest && t.closest('#topicsBrowser')) return;
        if (topicsOpen()) return;
        if (t && t.closest && (t.closest('#nacho-bubble') || t.closest('#nacho-container'))) return;
        if (nachoOwns()) return;
        if (mentionOwns(e)) return;
        var rec = topRec();
        if (!rec) return;
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        if (typeof rec.onClose === 'function') close(rec.el);
    }

    function onTab(e) {
        if (!e || e.key !== 'Tab') return;
        var t = e.target;
        if (t && t.closest && t.closest('#topicsBrowser')) return;
        if (topicsOpen()) return;
        var rec = topRec();
        if (!rec || rec.trap === false) return;
        var items = focusables(rec.el);
        if (!items.length) {
            if (e.preventDefault) e.preventDefault();
            focusInside(rec.el);
            return;
        }
        var first = items[0];
        var last = items[items.length - 1];
        var active = document.activeElement;
        var inside = rec.el.contains && rec.el.contains(active);
        if (e.shiftKey) {
            if (!inside || active === first) {
                if (e.preventDefault) e.preventDefault();
                try { last.focus(); } catch (err) {}
            }
        } else if (!inside || active === last) {
            if (e.preventDefault) e.preventDefault();
            try { first.focus(); } catch (err2) {}
        }
    }

    function onPop(e) {
        if (swallowPop) {
            swallowPop = false;
            if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
            return;
        }
        if (topicsOpen()) return;
        var rec = topPushed();
        if (!rec) return;
        rec.pushed = false;
        var el = rec.el;
        var fn = rec.onClose;
        rec.onClose = null;
        var idx = findRec(el);
        if (idx >= 0) {
            stack.splice(idx, 1);
            restoreFocus(rec);
        }
        try { if (typeof fn === 'function') fn(); } catch (err) {}
        if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
    }

    document.addEventListener('keydown', onEscape, true);
    document.addEventListener('keydown', onTab, true);
    window.addEventListener('popstate', onPop, true);

    window.bqModal = {
        open: open,
        close: close,
        release: release,
        layer: layer,
        top: function() {
            var rec = topRec();
            return rec ? rec.el : null;
        }
    };
})();
