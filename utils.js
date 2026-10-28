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

// ---- Username tags -------------------------------------------------------
// One helper for every other player's name. The name is escaped. The uid
// must match a strict pattern before it can become a profile tag. A deleted
// or missing profile is plain text. Opening a tag never closes the screen
// underneath: the profile sits on top, and Back returns to that screen.
var USER_TAG_UID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
var USER_TAG_STYLE_RE = /^[a-zA-Z0-9#:%;,\.\s\-()+]*$/;

function userTagEscape(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function userTagUidOk(uid) {
    return typeof uid === 'string' && USER_TAG_UID_RE.test(uid);
}

function userTagIsDeletedName(name) {
    var t = String(name == null ? '' : name).trim().toLowerCase();
    return t === 'deleted' || t === 'deleted player' || t === '[deleted]' || t === 'deleted user';
}

function userTagSafeStyle(style) {
    style = String(style || '');
    if (!style || !USER_TAG_STYLE_RE.test(style)) return '';
    return style;
}

function userTagRemember(uid, name) {
    if (!userTagUidOk(uid)) return;
    var key = String(name == null ? '' : name).trim().toLowerCase();
    if (!key) return;
    window._userTagByName = window._userTagByName || {};
    window._userTagByName[key] = uid;
}

function userTagResolveUid(name) {
    var key = String(name == null ? '' : name).trim().toLowerCase();
    if (!key || !window._userTagByName) return '';
    var uid = window._userTagByName[key] || '';
    return userTagUidOk(uid) ? uid : '';
}

function noteDeletedProfile(uid) {
    if (!userTagUidOk(uid)) return;
    window._deletedProfiles = window._deletedProfiles || {};
    window._deletedProfiles[uid] = true;
}

function noteArtistProfile(uid, yes, artistDocId) {
    if (!userTagUidOk(uid)) return;
    window._artistByUid = window._artistByUid || {};
    if (window._artistByUid[uid] === true && !yes) return;
    window._artistByUid[uid] = !!yes;
    if (yes) {
        window._artistDocByUser = window._artistDocByUser || {};
        var docId = userTagUidOk(artistDocId) ? artistDocId : uid;
        window._artistDocByUser[uid] = docId;
    }
}

// Public artist link: beats_artists/{uid} for a real account
// (isFirebaseUser or source user_upload). Robbie P's artist doc id is his
// uid. One lookup per uid, then the cache. Rendering a name does not read.
function hasPublicArtistProfile(uid) {
    if (!userTagUidOk(uid)) return Promise.resolve(false);
    window._artistByUid = window._artistByUid || {};
    if (Object.prototype.hasOwnProperty.call(window._artistByUid, uid)) {
        return Promise.resolve(!!window._artistByUid[uid]);
    }
    if (typeof db === 'undefined' || !db || !db.collection) return Promise.resolve(false);
    window._artistLookup = window._artistLookup || {};
    if (window._artistLookup[uid]) return window._artistLookup[uid];
    window._artistLookup[uid] = db.collection('beats_artists').doc(uid).get().then(function(snap) {
        var data = snap && snap.exists ? (snap.data() || {}) : null;
        var yes = !!(data && (data.isFirebaseUser === true || data.source === 'user_upload'));
        noteArtistProfile(uid, yes, uid);
        if (yes && data.name) userTagRemember(uid, data.name);
        return !!window._artistByUid[uid];
    }).catch(function() {
        noteArtistProfile(uid, false, uid);
        return false;
    });
    return window._artistLookup[uid];
}

function decideProfileRoute(input) {
    input = input || {};
    var uid = typeof input.uid === 'string' ? input.uid : '';
    if (!userTagUidOk(uid)) return { action: 'ignore' };
    if (input.hasArtist) return { action: 'artist', uid: uid };
    if (input.profileExists === false) return { action: 'deleted-card', uid: uid };
    if (input.deleted) return { action: 'plain', text: 'Deleted player' };
    return { action: 'user', uid: uid };
}

function userTag(uid, name, opts) {
    opts = opts || {};
    var raw = name == null ? '' : String(name);
    var uidStr = typeof uid === 'string' ? uid : '';
    var deleted = opts.deleted === true || userTagIsDeletedName(raw) || !!(uidStr && window._deletedProfiles && window._deletedProfiles[uidStr]);
    if (deleted) return '<span class="user-tag user-tag-deleted">Deleted player</span>';
    var shown = raw.trim() || (opts.fallback ? String(opts.fallback) : 'Anon');
    var safe = userTagEscape(shown);
    if (!userTagUidOk(uidStr)) uidStr = userTagResolveUid(shown);
    if (!userTagUidOk(uidStr)) return '<span class="user-tag user-tag-plain">' + safe + '</span>';
    if (window._deletedProfiles && window._deletedProfiles[uidStr]) {
        return '<span class="user-tag user-tag-deleted">Deleted player</span>';
    }
    if (opts.selfHeader) return '<span class="user-tag user-tag-self">' + safe + '</span>';
    userTagRemember(uidStr, shown);
    var style = userTagSafeStyle(opts.style);
    if (!style) style = 'cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;';
    else {
        if (style.slice(-1) !== ';') style += ';';
        if (style.indexOf('cursor:') === -1) style += 'cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;';
    }
    var prefix = opts.prefix ? userTagEscape(opts.prefix) : '';
    var suffix = opts.suffix ? userTagEscape(opts.suffix) : '';
    var blank = opts.blank ? ' data-blank-name="1"' : '';
    var title = opts.title ? ' title="' + userTagEscape(opts.title) + '"' : '';
    return '<span class="user-tag" data-profile-uid="' + userTagEscape(uidStr) + '"' + blank + title + ' role="link" tabindex="0" style="' + style + '">' + prefix + safe + suffix + '</span>';
}

function _profilePush(type, uid, reset) {
    if (reset) window._profileViewStack = [];
    window._profileViewStack = window._profileViewStack || [];
    var artistId = (window._artistDocByUser && window._artistDocByUser[uid]) || uid;
    window._profileViewStack.push({ type: type, uid: uid, artistId: artistId });
}

if (typeof window === 'undefined') { window = {}; }
window.profileCloseAll = function() {
    window._profileViewStack = [];
    var artist = document.getElementById('beatsArtistOverlay');
    if (artist) artist.remove();
    var modal = document.getElementById('userProfileModal');
    if (modal) modal.remove();
};

window.profileBack = function() {
    var stack = window._profileViewStack || [];
    stack.pop();
    var top = stack[stack.length - 1];
    var userModal = document.getElementById('userProfileModal');
    if (!top) {
        window.profileCloseAll();
        return;
    }
    if (top.type === 'artist') {
        if (userModal) userModal.remove();
        if (!document.getElementById('beatsArtistOverlay') && typeof window.beatsShowArtistPage === 'function') {
            window.beatsShowArtistPage(top.artistId || top.uid, { fromTag: true, noPush: true, userUid: top.uid });
        }
        return;
    }
    var artist = document.getElementById('beatsArtistOverlay');
    if (artist) artist.remove();
    if (userModal) userModal.remove();
    if (typeof window.showUserProfile === 'function') window.showUserProfile(top.uid, { userOnly: true });
};

window.switchToUserProfile = function(uid) {
    if (!userTagUidOk(uid)) return;
    _profilePush('user', uid, false);
    if (window._deletedProfiles && window._deletedProfiles[uid]) {
        window._showDeletedProfile(uid);
        return;
    }
    if (typeof window.showUserProfile === 'function') window.showUserProfile(uid, { userOnly: true });
};

window.switchToArtistProfile = function(uid) {
    if (!userTagUidOk(uid)) return;
    var stack = window._profileViewStack || [];
    var under = stack.length >= 2 ? stack[stack.length - 2] : null;
    if (under && under.type === 'artist') {
        window.profileBack();
        return;
    }
    var modal = document.getElementById('userProfileModal');
    if (modal) modal.remove();
    if (stack.length && stack[stack.length - 1].type === 'user') stack.pop();
    _profilePush('artist', uid, false);
    var artistId = (window._artistDocByUser && window._artistDocByUser[uid]) || uid;
    if (typeof window.beatsShowArtistPage === 'function') {
        window.beatsShowArtistPage(artistId, { fromTag: true, noPush: true, userUid: uid });
    }
};

window._showDeletedProfile = function(uid) {
    if (typeof document === 'undefined') return;
    var old = document.getElementById('userProfileModal');
    if (old) old.remove();
    var modal = document.createElement('div');
    modal.id = 'userProfileModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:2200000;display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.addEventListener('click', function(e) { if (e.target === modal) window.profileCloseAll(); });
    var card = document.createElement('div');
    card.style.cssText = 'position:relative;background:var(--bg-side);border:1px solid var(--border);border-radius:20px;padding:28px 22px 22px;max-width:360px;width:100%;text-align:center;';
    card.addEventListener('click', function(e) { e.stopPropagation(); });
    var back = document.createElement('button');
    back.type = 'button';
    back.textContent = 'Back';
    back.style.cssText = 'position:absolute;top:12px;left:12px;background:none;border:1px solid var(--border);color:var(--text-muted);border-radius:8px;padding:6px 10px;cursor:pointer;font-family:inherit;font-weight:700;';
    back.addEventListener('click', function(e) { e.stopPropagation(); window.profileBack(); });
    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = '✕';
    close.style.cssText = 'position:absolute;top:12px;right:12px;background:none;border:1px solid var(--border);color:var(--text-muted);width:32px;height:32px;border-radius:8px;cursor:pointer;';
    close.addEventListener('click', function(e) { e.stopPropagation(); window.profileCloseAll(); });
    var label = document.createElement('div');
    label.textContent = 'Deleted player';
    label.style.cssText = 'color:var(--heading);font-weight:800;font-size:1.1rem;margin-top:28px;';
    var note = document.createElement('div');
    note.textContent = 'This profile is no longer available.';
    note.style.cssText = 'color:var(--text-muted);font-size:0.85rem;margin-top:8px;';
    card.appendChild(back);
    card.appendChild(close);
    card.appendChild(label);
    card.appendChild(note);
    modal.appendChild(card);
    document.body.appendChild(modal);
};

window.mountProfileChrome = function(root, uid, kind) {
    if (!root || !root.querySelector || root.querySelector('[data-profile-back]')) return;
    var card = root.firstElementChild || root;
    if (card && card.style && (!card.style.position || card.style.position === 'static')) card.style.position = 'relative';
    var back = document.createElement('button');
    back.type = 'button';
    back.setAttribute('data-profile-back', '1');
    back.textContent = 'Back';
    back.style.cssText = 'position:absolute;top:12px;left:12px;z-index:2;background:none;border:1px solid var(--border);color:var(--text-muted);border-radius:8px;padding:6px 10px;cursor:pointer;font-family:inherit;font-weight:700;font-size:0.8rem;';
    back.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        window.profileBack();
    });
    card.appendChild(back);
    if (kind === 'user' && userTagUidOk(uid) && window._artistByUid && window._artistByUid[uid] && !root.querySelector('[data-view-artist]')) {
        var artistBtn = document.createElement('button');
        artistBtn.type = 'button';
        artistBtn.setAttribute('data-view-artist', uid);
        artistBtn.textContent = 'View artist profile';
        artistBtn.style.cssText = 'display:block;width:100%;margin-top:10px;padding:12px;background:var(--card-bg);border:1px solid var(--border);color:var(--text);border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.85rem;';
        artistBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            window.switchToArtistProfile(uid);
        });
        card.appendChild(artistBtn);
    }
};

window.openTaggedProfile = function(uid, opts) {
    opts = opts || {};
    uid = typeof uid === 'string' ? uid : '';
    if (!userTagUidOk(uid)) return;
    if (uid === 'nacho' || uid === 'nacho-bot') {
        _profilePush('user', 'nacho-bot', !opts.keepStack);
        if (typeof window.showUserProfile === 'function') window.showUserProfile('nacho-bot', { userOnly: true });
        return;
    }
    var knownDeleted = !!(window._deletedProfiles && window._deletedProfiles[uid]);
    var knownArtist = !!(window._artistByUid && window._artistByUid[uid]);
    function go(route) {
        if (route.action === 'artist') {
            var openArtist = function() {
                if (typeof window.beatsShowArtistPage !== 'function') {
                    _profilePush('user', uid, !opts.keepStack);
                    if (typeof window.showUserProfile === 'function') window.showUserProfile(uid, { userOnly: true });
                    return;
                }
                _profilePush('artist', uid, !opts.keepStack);
                var artistId = (window._artistDocByUser && window._artistDocByUser[uid]) || uid;
                window.beatsShowArtistPage(artistId, { fromTag: true, noPush: true, userUid: uid });
            };
            if (typeof window.beatsShowArtistPage === 'function' || typeof setInterval === 'undefined') {
                openArtist();
                return;
            }
            var waits = 0;
            var timer = setInterval(function() {
                waits += 1;
                if (typeof window.beatsShowArtistPage === 'function' || waits > 30) {
                    clearInterval(timer);
                    openArtist();
                }
            }, 100);
            return;
        }
        if (route.action === 'plain' || route.action === 'deleted-card') {
            _profilePush('user', uid, !opts.keepStack);
            noteDeletedProfile(uid);
            window._showDeletedProfile(uid);
            return;
        }
        _profilePush('user', uid, !opts.keepStack);
        if (typeof window.showUserProfile === 'function') window.showUserProfile(uid, { userOnly: true });
    }
    if (knownArtist) {
        go(decideProfileRoute({ uid: uid, hasArtist: true, deleted: knownDeleted, profileExists: !knownDeleted }));
        return;
    }
    if (knownDeleted) {
        go(decideProfileRoute({ uid: uid, hasArtist: false, deleted: true, profileExists: false }));
        return;
    }
    hasPublicArtistProfile(uid).then(function(yes) {
        go(decideProfileRoute({ uid: uid, hasArtist: !!yes, deleted: !!(window._deletedProfiles && window._deletedProfiles[uid]), profileExists: true }));
    });
};

if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('pointerdown', function(e) {
        var el = e.target && e.target.closest && e.target.closest('[data-profile-uid]');
        if (!el) return;
        var active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
            e.preventDefault();
        }
    }, true);
    document.addEventListener('click', function(e) {
        var el = e.target && e.target.closest && e.target.closest('[data-profile-uid]');
        if (!el) return;
        var uid = el.getAttribute('data-profile-uid') || '';
        if (!userTagUidOk(uid)) return;
        e.preventDefault();
        e.stopPropagation();
        window.openTaggedProfile(uid);
    }, true);
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var el = e.target && e.target.closest && e.target.closest('[data-profile-uid]');
        if (!el || document.activeElement !== el) return;
        var uid = el.getAttribute('data-profile-uid') || '';
        if (!userTagUidOk(uid)) return;
        e.preventDefault();
        e.stopPropagation();
        window.openTaggedProfile(uid);
    }, true);
}

window.userTag = userTag;
window.userTagUidOk = userTagUidOk;
window.userTagEscape = userTagEscape;
window.userTagRemember = userTagRemember;
window.userTagResolveUid = userTagResolveUid;
window.userTagIsDeletedName = userTagIsDeletedName;
window.noteDeletedProfile = noteDeletedProfile;
window.noteArtistProfile = noteArtistProfile;
window.hasPublicArtistProfile = hasPublicArtistProfile;
window.decideProfileRoute = decideProfileRoute;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        userTag: userTag,
        userTagUidOk: userTagUidOk,
        userTagEscape: userTagEscape,
        userTagRemember: userTagRemember,
        userTagResolveUid: userTagResolveUid,
        userTagIsDeletedName: userTagIsDeletedName,
        noteDeletedProfile: noteDeletedProfile,
        noteArtistProfile: noteArtistProfile,
        decideProfileRoute: decideProfileRoute
    };
}
