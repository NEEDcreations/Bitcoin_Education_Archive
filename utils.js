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
// Overlay stack
// One mechanism for every button-opened modal, sheet, toast, and dialog.
// window.nextOverlayZ(excludeEl) is 2 above the highest visible fixed layer
// (Settings #usernameModal is 2100008 in CSS). window.frontOverlay(el, opts)
// moves a trapped position:fixed layer to document.body and assigns that z-index
// with !important so a stylesheet !important cannot keep it behind Settings.
// Gift popups must call frontOverlay / nextOverlayZ. Do not keep a second scan
// such as _raiseGiftLayer, _numericZ, or _layerOpen.
// ============================================================
(function() {
    if (typeof document === 'undefined' || window.frontOverlay) return;

    var stack = [];
    var raising = false;
    var CHROME_IDS = {
        bottomNav: 1,
        chatOverlayBtn: 1,
        aiToolsBtn: 1,
        dashboardFloatBtn: 1,
        lbFloatBtn: 1,
        fabMinimizeBtn: 1,
        fabExpandBtn: 1,
        floatingRandomBtn: 1,
        userDisplay: 1,
        backToTop: 1,
        scrollToBottom: 1,
        guestPointsBanner: 1,
        bqSafeAreaProbe: 1,
        tctvNoise: 1,
        tctvOverlay: 1,
        'nacho-container': 1
    };
    var OVERLAY_RE = /modal|overlay|sheet|dialog|toast|lightbox|confirm|popup/i;
    var KNOWN_IDS = {
        usernameModal: 1,
        questModal: 1,
        leaderboard: 1,
        searchOverlay: 1,
        chatOverlay: 1,
        aiToolsPanel: 1,
        inviteCard: 1,
        tosModal: 1,
        spinModal: 1,
        questHubOverlay: 1,
        onboardingOverlay: 1
    };

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
        return best;
    }

    function isChrome(node) {
        if (!node || node.nodeType !== 1) return false;
        if (CHROME_IDS[node.id]) return true;
        if (node.classList && node.classList.contains('fab-btn')) return true;
        return false;
    }

    function looksLikeOverlay(node) {
        if (!node || node.nodeType !== 1 || isChrome(node)) return false;
        if (KNOWN_IDS[node.id]) return true;
        if (node.getAttribute && node.getAttribute('role') === 'dialog') return true;
        if (node.classList && (node.classList.contains('rank-toast') || node.classList.contains('badge-toast') || node.classList.contains('gifting-overlay') || node.classList.contains('invite-card'))) return true;
        var id = node.id || '';
        var cls = (node.className && typeof node.className === 'string') ? node.className : '';
        return OVERLAY_RE.test(id) || OVERLAY_RE.test(cls);
    }

    function isToast(node) {
        return !!(node && node.classList && (node.classList.contains('rank-toast') || node.classList.contains('badge-toast')));
    }

    function offscreenSheet(node) {
        var t = (node && node.style && node.style.transform) || '';
        return /translateY\(\s*100%/.test(t);
    }

    function isShown(node) {
        if (!node || node.nodeType !== 1 || !node.isConnected) return false;
        if (node.hasAttribute && node.hasAttribute('hidden')) return false;
        if (node.getAttribute && node.getAttribute('aria-hidden') === 'true') return false;
        if (offscreenSheet(node)) return false;
        var cs = null;
        try { cs = window.getComputedStyle ? window.getComputedStyle(node) : null; } catch (e) { cs = null; }
        if (cs) {
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        } else if (node.style && node.style.display === 'none') {
            return false;
        }
        return true;
    }

    function trapped(el) {
        var p = el.parentElement;
        while (p && p !== document.body && p !== document.documentElement) {
            var cs = null;
            try { cs = window.getComputedStyle ? window.getComputedStyle(p) : null; } catch (e) { cs = null; }
            if (cs) {
                if (cs.transform && cs.transform !== 'none') return true;
                if (cs.filter && cs.filter !== 'none') return true;
                if (cs.backdropFilter && cs.backdropFilter !== 'none') return true;
                if (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none') return true;
                var wc = cs.willChange || '';
                if (/transform|filter/.test(wc)) return true;
            }
            p = p.parentElement;
        }
        return false;
    }

    function positioned(node) {
        var pos = '';
        try {
            if (window.getComputedStyle) pos = window.getComputedStyle(node).position || '';
        } catch (e) {}
        if (!pos && node.style) pos = node.style.position || '';
        if (!pos && node.getAttribute) {
            var raw = node.getAttribute('style') || '';
            if (/position:\s*fixed/i.test(raw)) return true;
            if (/position:\s*absolute/i.test(raw)) return true;
            if (/position:\s*sticky/i.test(raw)) return true;
        }
        return pos === 'fixed' || pos === 'absolute' || pos === 'sticky';
    }

    function nextOverlayZ(excludeEl) {
        var top = 0;
        function consider(node) {
            if (!node || node.nodeType !== 1) return;
            if (node === excludeEl) return;
            if (excludeEl && excludeEl.contains && excludeEl.contains(node)) return;
            if (!node.isConnected || !isShown(node)) return;
            if (!positioned(node)) return;
            var z = numericZ(node);
            if (z > top) top = z;
        }
        var root = document.body || document.documentElement;
        if (root && root.getElementsByTagName) {
            var all = root.getElementsByTagName('*');
            for (var i = 0; i < all.length; i++) consider(all[i]);
        }
        return top + 2;
    }

    function findRec(el) {
        for (var i = 0; i < stack.length; i++) if (stack[i].el === el) return i;
        return -1;
    }

    function releaseOverlay(el) {
        var idx = findRec(el);
        if (idx < 0) return;
        var rec = stack[idx];
        stack.splice(idx, 1);
        var wasTop = idx === stack.length;
        if (wasTop && rec.restoreFocus !== false) {
            var target = rec.prevFocus;
            var under = stack.length ? stack[stack.length - 1].el : null;
            var targetOk = target && target.isConnected !== false && target !== document.body && target !== document.documentElement;
            if (!targetOk) target = under;
            if (target && target !== document.body && typeof target.focus === 'function') {
                if (target.setAttribute && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
                try { target.focus(); } catch (e) {}
            }
        }
    }

    function frontOverlay(el, opts) {
        if (!el || el.nodeType !== 1) return 0;
        opts = opts || {};
        if (raising) {
            var busy = parseInt(el.style && el.style.zIndex, 10);
            return isFinite(busy) ? busy : 0;
        }
        raising = true;
        try {
            if (!opts.keepParent && document.body) {
                var parent = el.parentNode;
                var needsMove = !parent || parent !== document.body || trapped(el);
                if (needsMove) document.body.appendChild(el);
            }
            var z = nextOverlayZ(el);
            if (el.style && el.style.setProperty) el.style.setProperty('z-index', String(z), 'important');
            else if (el.style) el.style.zIndex = String(z);
            if (el.setAttribute) el.setAttribute('data-front-overlay', '1');
            var idx = findRec(el);
            if (idx >= 0) {
                var existing = stack[idx];
                if (opts.onClose) existing.onClose = opts.onClose;
                if (opts.restoreFocus != null) existing.restoreFocus = opts.restoreFocus;
                if (opts.toast != null) existing.toast = opts.toast;
                stack.splice(idx, 1);
                stack.push(existing);
            } else {
                var prev = null;
                var active = document.activeElement;
                if (active && active !== el && (!el.contains || !el.contains(active))) prev = active;
                stack.push({
                    el: el,
                    onClose: opts.onClose || null,
                    restoreFocus: opts.restoreFocus !== false && !opts.toast && !isToast(el),
                    toast: opts.toast === true || isToast(el),
                    prevFocus: opts.prevFocus !== undefined ? opts.prevFocus : prev
                });
            }
            if (opts.focus === true) {
                var dialog = (el.querySelector && el.querySelector('[role="dialog"], .gifting-modal, .username-box')) || el;
                if (dialog && !dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
                if (dialog && typeof dialog.focus === 'function') {
                    try { dialog.focus(); } catch (e2) {}
                }
            }
            return z;
        } finally {
            raising = false;
        }
    }

    function closeById(rec) {
        var el = rec.el;
        var id = el.id;
        if (id === 'tosModal') return false;
        if (id === 'usernameModal' && typeof window.hideUsernamePrompt === 'function') {
            window.hideUsernamePrompt();
            return true;
        }
        if (id === 'questModal') {
            el.classList.remove('open');
            el.style.display = 'none';
            releaseOverlay(el);
            return true;
        }
        if (id === 'leaderboard') {
            el.classList.remove('open');
            el.classList.remove('minimized');
            var fab = document.getElementById('lbFloatBtn');
            if (fab) fab.style.display = 'flex';
            releaseOverlay(el);
            return true;
        }
        if (id === 'chatOverlay' && typeof window.toggleChatOverlay === 'function') {
            if (window._chatOverlayOpen) window.toggleChatOverlay();
            else releaseOverlay(el);
            return true;
        }
        if (id === 'aiToolsPanel' && typeof window.toggleAITools === 'function') {
            if (window._aiToolsOpen) window.toggleAITools();
            else releaseOverlay(el);
            return true;
        }
        if (id === 'searchOverlay') {
            el.style.display = 'none';
            if (el.removeAttribute) el.removeAttribute('data-open');
            releaseOverlay(el);
            return true;
        }
        if (id === 'inviteCard' && typeof window.minimizeInviteCard === 'function') {
            window.minimizeInviteCard();
            releaseOverlay(el);
            return true;
        }
        if (typeof el.remove === 'function') el.remove();
        else if (el.parentNode) el.parentNode.removeChild(el);
        return true;
    }

    function topDialog() {
        for (var i = stack.length - 1; i >= 0; i--) {
            var rec = stack[i];
            if (!rec.el || rec.el.isConnected === false) { stack.splice(i, 1); continue; }
            if (rec.toast || isToast(rec.el)) continue;
            if (!isShown(rec.el)) continue;
            return rec;
        }
        return null;
    }

    function closeTopOverlay() {
        var rec = topDialog();
        if (!rec) return false;
        if (rec.el.id === 'tosModal') return false;
        if (typeof rec.onClose === 'function') {
            var fn = rec.onClose;
            rec.onClose = null;
            fn();
            if (findRec(rec.el) >= 0 && rec.el.id !== 'usernameModal') releaseOverlay(rec.el);
            return true;
        }
        return closeById(rec);
    }

    function dropdownInside(topEl) {
        var ids = ['chatAutocomplete', 'countryDropdown', 'signupCountryDropdown'];
        for (var i = 0; i < ids.length; i++) {
            var el = document.getElementById(ids[i]);
            if (!el || !isShown(el)) continue;
            if (!topEl || (topEl.contains && topEl.contains(el))) return true;
        }
        return false;
    }

    function afterInsert(node) {
        if (raising || !node || node.nodeType !== 1) return;
        if (!looksLikeOverlay(node)) return;
        var parent = node.parentElement;
        if (parent && parent !== document.body && parent !== document.documentElement) {
            var fixed = false;
            try {
                fixed = window.getComputedStyle && window.getComputedStyle(node).position === 'fixed';
            } catch (e) {}
            if (!fixed && node.style && node.style.position === 'fixed') fixed = true;
            if (!fixed || !trapped(node)) return;
        }
        if (!isShown(node)) return;
        frontOverlay(node, { focus: false, toast: isToast(node), restoreFocus: !isToast(node) });
    }

    if (Node.prototype.appendChild && !Node.prototype.appendChild._overlayStack) {
        var origAppend = Node.prototype.appendChild;
        var append = function(child) {
            var result = origAppend.call(this, child);
            try { afterInsert(child); } catch (e) {}
            return result;
        };
        append._overlayStack = true;
        Node.prototype.appendChild = append;
    }
    if (Node.prototype.insertBefore && !Node.prototype.insertBefore._overlayStack) {
        var origInsert = Node.prototype.insertBefore;
        var insert = function(child) {
            var result = origInsert.apply(this, arguments);
            try { afterInsert(child); } catch (e) {}
            return result;
        };
        insert._overlayStack = true;
        Node.prototype.insertBefore = insert;
    }
    if (Element.prototype.remove && !Element.prototype.remove._overlayStack) {
        var origRemove = Element.prototype.remove;
        var remove = function() {
            var el = this;
            origRemove.call(el);
            try { releaseOverlay(el); } catch (e) {}
        };
        remove._overlayStack = true;
        Element.prototype.remove = remove;
    }
    if (Node.prototype.removeChild && !Node.prototype.removeChild._overlayStack) {
        var origRemoveChild = Node.prototype.removeChild;
        var removeChild = function(child) {
            var result = origRemoveChild.call(this, child);
            try { if (child && child.nodeType === 1) releaseOverlay(child); } catch (e) {}
            return result;
        };
        removeChild._overlayStack = true;
        Node.prototype.removeChild = removeChild;
    }

    function shouldAutoFront(el, attr) {
        if (!looksLikeOverlay(el) || !isShown(el)) return false;
        if (attr === 'class') return el.classList.contains('open') || el.classList.contains('show');
        if (attr === 'data-open') return el.getAttribute('data-open') === '1';
        if (attr === 'data-state') return el.getAttribute('data-state') === 'open';
        if (attr === 'hidden') return true;
        if (attr === 'style') {
            if (el.id === 'chatOverlay' || el.id === 'aiToolsPanel') return /translateY\(\s*0\s*\)/.test(el.style.transform || '');
            if (el.getAttribute('data-front-overlay') === '1') return false;
            if (el.style.display && el.style.display !== 'none') return true;
        }
        return false;
    }

    if (typeof MutationObserver === 'function' && document.documentElement) {
        var obs = new MutationObserver(function(muts) {
            if (raising) return;
            for (var i = 0; i < muts.length; i++) {
                var m = muts[i];
                if (m.type === 'childList') {
                    for (var j = 0; j < m.addedNodes.length; j++) {
                        try { afterInsert(m.addedNodes[j]); } catch (e) {}
                    }
                } else if (m.type === 'attributes' && m.target && shouldAutoFront(m.target, m.attributeName)) {
                    try { frontOverlay(m.target, { focus: false, toast: isToast(m.target), restoreFocus: !isToast(m.target) }); } catch (e2) {}
                }
            }
        });
        try {
            obs.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style', 'hidden', 'data-open', 'data-state']
            });
        } catch (e) {}
    }

    document.addEventListener('keydown', function(e) {
        if (!e) return;
        var key = e.key;
        if (key !== 'Escape' && key !== 'Esc' && e.keyCode !== 27) return;
        var rec = topDialog();
        if (!rec) return;
        if (dropdownInside(rec.el)) return;
        if (rec.el.id === 'tosModal') {
            if (e.preventDefault) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            return;
        }
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        closeTopOverlay();
    }, true);

    window.nextOverlayZ = nextOverlayZ;
    window.frontOverlay = frontOverlay;
    window.releaseOverlay = releaseOverlay;
    window.closeTopOverlay = closeTopOverlay;
})();
