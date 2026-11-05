// Favorite mini apps (max 2). localStorage + users/{uid}.favoriteApps when signed in.
(function (root) {
    'use strict';
    if (!root || typeof root !== 'object') return;

    var STORAGE_KEY = 'btc_favorite_apps';
    var MAX = 2;
    var FALLBACK_IDS = ['nacho', 'pop', 'forum', 'market', 'irl', 'beats', 'tv', 'pow', 'wallet'];

    function allowedIds() {
        var apps = root.BQ_EXPLORE_APPS;
        if (apps && apps.length) {
            var out = [];
            for (var i = 0; i < apps.length; i++) {
                if (apps[i] && apps[i].id) out.push(String(apps[i].id));
            }
            if (out.length) return out;
        }
        return FALLBACK_IDS.slice();
    }

    function isAllowed(id) {
        return allowedIds().indexOf(String(id || '')) !== -1;
    }

    function normalizeList(raw) {
        var seen = {};
        var out = [];
        if (!Array.isArray(raw)) return out;
        for (var i = 0; i < raw.length && out.length < MAX; i++) {
            var id = String(raw[i] || '');
            if (!isAllowed(id) || seen[id]) continue;
            seen[id] = 1;
            out.push(id);
        }
        return out;
    }

    function readLocal() {
        try {
            return normalizeList(JSON.parse(root.localStorage.getItem(STORAGE_KEY) || '[]'));
        } catch (e) {
            return [];
        }
    }

    function writeLocal(list) {
        var clean = normalizeList(list);
        try { root.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean)); } catch (e) {}
        return clean;
    }

    function signedInUid() {
        try {
            if (typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
                return auth.currentUser.uid;
            }
        } catch (e) {}
        return '';
    }

    function writeRemote(list) {
        var uid = signedInUid();
        if (!uid) return;
        try {
            if (typeof db === 'undefined' || !db) return;
            db.collection('users').doc(uid).set({ favoriteApps: normalizeList(list) }, { merge: true }).catch(function () {});
        } catch (e) {}
    }

    function appById(id) {
        var apps = root.BQ_EXPLORE_APPS || [];
        for (var i = 0; i < apps.length; i++) {
            if (apps[i].id === id) return apps[i];
        }
        return null;
    }

    function toast(msg) {
        if (typeof root.showToast === 'function') root.showToast(msg, 3500);
    }

    function paintStars() {
        var favs = readLocal();
        var nodes = root.document ? root.document.querySelectorAll('[data-fav-star]') : [];
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            var id = el.getAttribute('data-fav-star') || '';
            var on = favs.indexOf(id) !== -1;
            el.textContent = on ? '★' : '☆';
            el.setAttribute('aria-pressed', on ? 'true' : 'false');
            el.setAttribute('aria-label', on ? 'Unfavorite' : 'Favorite');
            el.title = on ? 'Unfavorite' : 'Favorite (up to 2)';
            if (on) el.classList.add('is-fav');
            else el.classList.remove('is-fav');
        }
        renderHomeBar();
    }

    function getFavoriteApps() {
        return readLocal();
    }

    function isFavoriteApp(id) {
        return readLocal().indexOf(String(id || '')) !== -1;
    }

    function setFavoriteApps(list, opts) {
        var clean = writeLocal(list);
        if (!(opts && opts.skipRemote)) writeRemote(clean);
        paintStars();
        return clean;
    }

    function toggleFavoriteApp(id) {
        id = String(id || '');
        if (!isAllowed(id)) return { ok: false, reason: 'unknown' };
        var list = readLocal();
        var idx = list.indexOf(id);
        if (idx !== -1) {
            list.splice(idx, 1);
            setFavoriteApps(list);
            toast('Removed from favorites');
            return { ok: true, favorited: false, list: list };
        }
        if (list.length >= MAX) {
            toast('You can favorite up to 2 apps — unfavorite one first');
            return { ok: false, reason: 'limit', list: list };
        }
        list.push(id);
        setFavoriteApps(list);
        var app = appById(id);
        toast('Favorited' + (app && app.title ? ' ' + app.title : ''));
        return { ok: true, favorited: true, list: list };
    }

    function syncFavoriteAppsFromFirestore() {
        try {
            var uid = signedInUid();
            if (!uid || typeof db === 'undefined' || !db) return;
            db.collection('users').doc(uid).get().then(function (snap) {
                if (!snap || !snap.exists) return;
                var remote = snap.data() && snap.data().favoriteApps;
                if (!Array.isArray(remote)) return;
                var clean = normalizeList(remote);
                writeLocal(clean);
                paintStars();
            }).catch(function () {});
        } catch (e) {}
    }

    function makeStarButton(id, compact) {
        var btn = root.document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-fav-star', id);
        btn.className = 'bq-fav-star' + (compact ? ' bq-fav-star-compact' : '');
        var on = isFavoriteApp(id);
        btn.textContent = on ? '★' : '☆';
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.setAttribute('aria-label', on ? 'Unfavorite' : 'Favorite');
        btn.title = on ? 'Unfavorite' : 'Favorite (up to 2)';
        if (on) btn.classList.add('is-fav');
        if (compact) {
            btn.style.cssText = 'position:absolute;top:4px;right:4px;z-index:2;min-width:36px;min-height:36px;padding:0;border:none;background:rgba(0,0,0,0.35);border-radius:999px;color:#f7931a;font-size:1rem;line-height:1;cursor:pointer;font-family:inherit;touch-action:manipulation;';
        } else {
            btn.style.cssText = 'min-width:44px;min-height:44px;padding:0 10px;border:1px solid var(--border,#334155);background:var(--card-bg,#0f172a);border-radius:12px;color:#f7931a;font-size:1.15rem;line-height:1;cursor:pointer;font-family:inherit;touch-action:manipulation;';
        }
        btn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            toggleFavoriteApp(id);
        });
        return btn;
    }

    function decorateExploreTile(tile, id) {
        if (!tile || !id || !isAllowed(id)) return;
        if (tile.querySelector('[data-fav-star="' + id + '"]')) return;
        tile.style.position = tile.style.position || 'relative';
        tile.appendChild(makeStarButton(id, true));
    }

    function openFavorite(id) {
        var app = appById(id);
        if (!app) return;
        if (typeof root.runSurfaceAction === 'function') {
            root.runSurfaceAction(app);
            return;
        }
        // Fallbacks if explore helper is not ready yet.
        if (app.kind === 'go' && typeof root.go === 'function') root.go(app.arg);
        else if (app.kind === 'pop' && typeof root.enterProofOfPlay === 'function') root.enterProofOfPlay();
        else if (app.kind === 'fn' && typeof root[app.arg] === 'function') root[app.arg]();
    }

    function ensureStyles() {
        var doc = root.document;
        if (!doc || doc.getElementById('bqFavStyles')) return;
        var style = doc.createElement('style');
        style.id = 'bqFavStyles';
        style.textContent =
            '#bqFavoriteApps{display:none;width:100%;box-sizing:border-box;margin:0 0 10px;padding:0;}' +
            '#bqFavoriteApps.is-on{display:flex;gap:8px;flex-wrap:wrap;}' +
            '#bqFavoriteApps .bq-fav-home-btn{flex:1 1 140px;min-width:0;min-height:44px;padding:10px 12px;border-radius:12px;border:1px solid var(--border,#334155);background:var(--card-bg,#0f172a);color:var(--heading,#f8fafc);font:inherit;font-size:0.9rem;font-weight:800;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px;touch-action:manipulation;}' +
            '#bqFavoriteApps .bq-fav-home-btn span.emoji{font-size:1.15rem;line-height:1;}' +
            '#bqFavoriteApps .bq-fav-home-btn span.label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
            '.bq-fav-star.is-fav,.bq-fav-star-compact.is-fav{color:#f7931a;}' +
            '.bq-fav-inapp-bar{display:flex;justify-content:flex-end;align-items:center;gap:8px;padding:8px 12px 0;position:relative;z-index:5;}' +
            '@media(max-width:390px){#bqFavoriteApps .bq-fav-home-btn{flex:1 1 calc(50% - 4px);font-size:0.82rem;padding:10px 8px;}}' +
            '@media(max-width:320px){#bqFavoriteApps .bq-fav-home-btn{font-size:0.78rem;}}';
        (doc.head || doc.documentElement).appendChild(style);
    }

    function renderHomeBar() {
        var doc = root.document;
        if (!doc) return;
        ensureStyles();
        var home = doc.querySelector('#home .home-inner') || doc.getElementById('home');
        if (!home) return;
        var bar = doc.getElementById('bqFavoriteApps');
        if (!bar) {
            bar = doc.createElement('section');
            bar.id = 'bqFavoriteApps';
            bar.setAttribute('aria-label', 'Favorite apps');
            var mode = doc.getElementById('bqHomeModeBar');
            if (mode && mode.parentNode === home) home.insertBefore(bar, mode.nextSibling);
            else if (home.firstChild) home.insertBefore(bar, home.firstChild);
            else home.appendChild(bar);
        }
        var favs = readLocal();
        while (bar.firstChild) bar.removeChild(bar.firstChild);
        if (!favs.length) {
            bar.classList.remove('is-on');
            bar.style.display = 'none';
            return;
        }
        bar.classList.add('is-on');
        bar.style.display = 'flex';
        for (var i = 0; i < favs.length; i++) {
            (function (id) {
                var app = appById(id);
                if (!app) return;
                var btn = doc.createElement('button');
                btn.type = 'button';
                btn.className = 'bq-fav-home-btn';
                btn.setAttribute('data-fav-home', id);
                var emoji = doc.createElement('span');
                emoji.className = 'emoji';
                emoji.setAttribute('aria-hidden', 'true');
                emoji.textContent = app.emoji || '★';
                var label = doc.createElement('span');
                label.className = 'label';
                label.textContent = app.title || id;
                btn.appendChild(emoji);
                btn.appendChild(label);
                btn.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    openFavorite(id);
                });
                bar.appendChild(btn);
            })(favs[i]);
        }
    }

    function mountInApp(host, id) {
        var doc = root.document;
        if (!doc || !host || !isAllowed(id)) return;
        if (host.querySelector('[data-fav-inapp="' + id + '"], [data-fav-star="' + id + '"].bq-fav-star:not(.bq-fav-star-compact)')) return;
        var star = makeStarButton(id, false);
        star.setAttribute('data-fav-inapp', id);
        // Prefer sitting next to the Share button when that chrome exists.
        var share = host.querySelector('[data-mini-share="' + id + '"], [data-mini-share]');
        if (share && share.parentNode) {
            share.parentNode.insertBefore(star, share);
            return;
        }
        var bar = doc.createElement('div');
        bar.className = 'bq-fav-inapp-bar';
        bar.setAttribute('data-fav-inapp', id);
        bar.appendChild(star);
        if (host.firstChild) host.insertBefore(bar, host.firstChild);
        else host.appendChild(bar);
    }

    function pageAppId() {
        var hash = '';
        try { hash = String((root.location && root.location.hash) || '').replace(/^#/, ''); } catch (e) { hash = ''; }
        var page = root.currentPage || '';
        if (hash.indexOf('meetup-builder') === 0 || page === 'meetup-builder') return null;
        if (hash.indexOf('irl-sync') === 0 || page === 'irl-sync') return 'irl';
        if (hash.indexOf('forum') === 0 || page === 'forum') return 'forum';
        if (hash.indexOf('marketplace') === 0 || page === 'marketplace') return 'market';
        if (hash.indexOf('bitcoin-beats') === 0 || hash.indexOf('beats') === 0 || page === 'bitcoin-beats') return 'beats';
        if (hash.indexOf('timechain-tv') === 0 || page === 'timechain-tv') return 'tv';
        if (hash.indexOf('wallet') === 0 || hash === 'lightning' || page === 'wallet') return 'wallet';
        if (hash.indexOf('proof-of-walk') === 0 || page === 'proof-of-walk') return 'pow';
        return null;
    }

    function placeInAppStars() {
        var doc = root.document;
        if (!doc) return;
        mountInApp(doc.getElementById('nachoModeScreen'), 'nacho');
        var popHeader = doc.querySelector('#popOverlay .pop-header') || doc.getElementById('popOverlay');
        mountInApp(popHeader, 'pop');
        mountInApp(doc.getElementById('beatsApp'), 'beats');
        var tctv = doc.getElementById('tctv-np-bar') || doc.getElementById('tctvApp') || doc.querySelector('#timechainTvView, #tctvView');
        if (tctv) mountInApp(tctv, 'tv');
        var pow = doc.querySelector('.pow-header');
        if (pow && pow.parentNode) mountInApp(pow.parentNode, 'pow');
        var fc = doc.getElementById('forumContainer');
        var appId = pageAppId();
        if (fc && appId && (appId === 'forum' || appId === 'market' || appId === 'irl' || appId === 'beats' || appId === 'wallet' || appId === 'tv' || appId === 'pow')) {
            mountInApp(fc, appId);
        }
    }

    function decorateOpenExploreMenus() {
        var doc = root.document;
        if (!doc) return;
        var tiles = doc.querySelectorAll('#homeAppsMenu [data-app-id], #appsMenu [data-app-id]');
        for (var i = 0; i < tiles.length; i++) {
            decorateExploreTile(tiles[i], tiles[i].getAttribute('data-app-id'));
        }
    }

    function install() {
        ensureStyles();
        renderHomeBar();
        placeInAppStars();
        decorateOpenExploreMenus();
        var timer = 0;
        function schedule() {
            if (timer) return;
            timer = setTimeout(function () {
                timer = 0;
                try {
                    renderHomeBar();
                    placeInAppStars();
                    decorateOpenExploreMenus();
                } catch (e) {}
            }, 60);
        }
        if (typeof root.MutationObserver === 'function' && root.document && root.document.body) {
            var obs = new root.MutationObserver(function () { schedule(); });
            obs.observe(root.document.body, { childList: true, subtree: true });
        }
        root.addEventListener('hashchange', function () { schedule(); });
    }

    root.getFavoriteApps = getFavoriteApps;
    root.isFavoriteApp = isFavoriteApp;
    root.setFavoriteApps = setFavoriteApps;
    root.toggleFavoriteApp = toggleFavoriteApp;
    root.syncFavoriteAppsFromFirestore = syncFavoriteAppsFromFirestore;
    root.bqDecorateFavoriteTile = decorateExploreTile;
    root.bqRefreshFavoriteApps = paintStars;
    root.BQ_FAVORITE_APP_IDS = FALLBACK_IDS.slice();

    if (root.document) {
        if (root.document.readyState === 'loading') {
            root.document.addEventListener('DOMContentLoaded', install);
        } else {
            install();
        }
    }
})(typeof window !== 'undefined' ? window : this);
