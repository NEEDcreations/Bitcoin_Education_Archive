// Mini-app share cards. One referral link, deep link in the hash, no rewards.
(function (root, factory) {
    var api = factory(root || {});
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root && typeof root === 'object') {
        root.MiniAppShare = api;
        root.miniAppShare = function (appId, ctx) { return api.open(appId, ctx); };
        root.miniAppConsumeHash = function (hash) { return api.consumeHash(hash); };
    }
    if (root && root.document) {
        var boot = function () { api.install(root); };
        if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
        else boot();
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
    'use strict';

    var SITE = 'https://bitcoineducation.quest';
    var REF_RE = /^[A-Za-z0-9]{6,28}$/;
    var TRACK_RE = /^[A-Za-z0-9_-]{1,128}$/;
    var POP_TABS = { arcade: 1, sat_arcade: 1, galaxy: 1, ryracer: 1, pvp: 1 };
    var BEGINNER_HIDE = {
        beats: 1, pop: 1, pvp: 1, arcade: 1, sat_arcade: 1, galaxy: 1, ryracer: 1,
        forum: 1, marketplace: 1, irl: 1, meetup: 1, walk: 1
    };
    // DMs stay private. A share from the DM tab still opens public Global Chat.
    var FALLBACK_STATIONS = [
        { n: 0, id: 'pleb-underground', name: 'Pleb Underground Unlimited' },
        { n: 1, id: 'ai-nostr', name: 'AI, Nostr & Decentralized Web' },
        { n: 2, id: 'art-philosophy', name: 'Art & Philosophy' },
        { n: 3, id: 'orange-pill', name: 'Beginners 101, Orange-Pill & Self-Custody' },
        { n: 4, id: 'conferences-events', name: 'Conferences & Events' },
        { n: 5, id: 'culture-travel', name: 'Culture, Travel & Adoption' },
        { n: 6, id: 'dev-privacy-nodes', name: 'Dev, Privacy, Nodes & FLOSS' },
        { n: 7, id: 'economics-money', name: 'Economics & Money' },
        { n: 8, id: 'freedom-sovereignty', name: 'Freedom, Sovereignty & Homesteading' },
        { n: 9, id: 'health-fitness', name: 'Health, Fitness & Mindfulness' },
        { n: 10, id: 'history', name: 'History & Documentaries' },
        { n: 11, id: 'kids-family', name: 'Kids & Family' },
        { n: 12, id: 'lightning', name: 'Lightning, Ecash & Other L2s' },
        { n: 13, id: 'memes-comedy', name: 'Memes & Comedy' },
        { n: 14, id: 'mining', name: 'Mining & Power Projection' },
        { n: 15, id: 'music', name: 'Music & Entertainment' },
        { n: 16, id: 'news', name: 'News & Current Events' },
        { n: 17, id: 'podcasts-debates', name: 'Podcasts, Debates & Spaces' },
        { n: 18, id: 'politics-regulation', name: 'Politics & Regulation' },
        { n: 19, id: 'saylor', name: 'Saylor Series & Corporations' },
        { n: 20, id: 'future-predictions', name: 'Trading & Predictions' },
        { n: 21, id: 'tutorials', name: 'Tutorials, Builders & DIY' }
    ];

    var APPS = [
        { id: 'tctv', name: 'Timechain TV', hash: 'timechain-tv/9', ctx: { channel: '9' }, sentence: "I'm watching channel 9, Health, Fitness & Mindfulness on Timechain TV! Check it out!" },
        { id: 'beats', name: 'Bitcoin Beats', hash: 'beats/track123', ctx: { title: 'Orange Pill', artist: 'Pleb Band', trackId: 'track123' }, sentence: "I'm listening to Orange Pill by Pleb Band on Bitcoin Beats! Check it out!" },
        { id: 'nacho', name: 'Nacho Mode', hash: 'nacho', ctx: {}, sentence: "I'm asking Nacho about Bitcoin on Bitcoin Quest! Check it out!" },
        { id: 'pop', name: 'Proof of Play', hash: 'proof-of-play', ctx: {}, sentence: "I'm in the Proof of Play hub on Bitcoin Quest! Check it out!" },
        { id: 'pvp', name: 'PVP', hash: 'pvp', ctx: {}, sentence: "I'm in a Bitcoin trivia battle on Bitcoin Quest! Check it out!" },
        { id: 'arcade', name: 'Timechain Arcade', hash: 'proof-of-play/arcade', ctx: {}, sentence: "I'm browsing Timechain Arcade games on Bitcoin Quest! Check it out!" },
        { id: 'sat_arcade', name: 'Sat Arcade', hash: 'proof-of-play/sat_arcade', ctx: {}, sentence: "I'm browsing Sat Arcade games on Bitcoin Quest! Check it out!" },
        { id: 'galaxy', name: 'Galaxy Mind', hash: 'proof-of-play/galaxy', ctx: {}, sentence: "I'm browsing Galaxy Mind games on Bitcoin Quest! Check it out!" },
        { id: 'ryracer', name: 'RyRacer', hash: 'proof-of-play/ryracer', ctx: {}, sentence: "I'm at the RyRacer lineup on Bitcoin Quest! Check it out!" },
        { id: 'forum', name: 'Pleb Talk', hash: 'forum', ctx: {}, sentence: "I'm reading Pleb Talk on Bitcoin Quest! Check it out!" },
        { id: 'marketplace', name: 'Lightning Mart', hash: 'marketplace', ctx: {}, sentence: "I'm browsing Lightning Mart on Bitcoin Quest! Check it out!" },
        { id: 'irl', name: 'IRL Sync', hash: 'irl-sync', ctx: {}, sentence: "I'm looking for a Bitcoin meetup on IRL Sync! Check it out!" },
        { id: 'meetup', name: 'Meetup Builder', hash: 'meetup-builder', ctx: {}, sentence: "I'm planning a Bitcoin meetup on IRL Sync! Check it out!" },
        { id: 'walk', name: 'Proof of Walk', hash: 'proof-of-walk', ctx: {}, sentence: "I'm stacking steps with Proof of Walk on Bitcoin Quest! Check it out!" },
        { id: 'ai', name: 'AI Tools', hash: 'ai-tools', ctx: {}, sentence: "I'm using the Bitcoin AI tools on Bitcoin Quest! Check it out!" },
        { id: 'metrics', name: 'Metrics', hash: 'metrics', ctx: {}, sentence: "I'm checking live Bitcoin metrics on Bitcoin Quest! Check it out!" },
        { id: 'leaderboard', name: 'Leaderboard', hash: 'leaderboard', ctx: {}, sentence: "I'm looking at the Bitcoin Quest leaderboard! Check it out!" },
        { id: 'quests', name: 'Quest Hub', hash: 'quests', ctx: {}, sentence: "I'm working through Bitcoin quests on Bitcoin Quest! Check it out!" },
        { id: 'favor', name: "Satoshi's Favor", hash: 'favor', ctx: {}, sentence: "I'm mining in Satoshi's Favor on Bitcoin Quest! Check it out!" },
        { id: 'trails', name: 'Trails', hash: 'trails', ctx: {}, sentence: "I'm walking a Bitcoin learning trail on Bitcoin Quest! Check it out!" },
        { id: 'learning', name: 'Learning Quests', hash: 'learning-quests', ctx: {}, sentence: "I'm on a Bitcoin learning quest on Bitcoin Quest! Check it out!" },
        { id: 'chat', name: 'Global Chat', hash: 'chat', ctx: {}, sentence: "I'm hanging out in Global Chat on Bitcoin Quest! Check it out!" },
        { id: 'lightning', name: 'Lightning', hash: 'lightning', ctx: {}, sentence: "I'm learning Lightning on Bitcoin Quest! Check it out!" },
        { id: 'first', name: 'First Purchase', hash: 'first-purchase', ctx: {}, sentence: "I'm learning how to buy Bitcoin on Bitcoin Quest! Check it out!" }
    ];

    function specById(id) {
        for (var i = 0; i < APPS.length; i++) if (APPS[i].id === id) return APPS[i];
        return null;
    }

    function stations() {
        if (root && typeof root.tctvStationCatalog === 'function') {
            try {
                var live = root.tctvStationCatalog();
                if (live && live.length) return live;
            } catch (e) {}
        }
        return FALLBACK_STATIONS;
    }

    function plainLine(s) {
        return String(s == null ? '' : s)
            .replace(/[\u0000-\u001f\u007f]/g, '')
            .replace(/<[^>]*>/g, '')
            .replace(/[<>"`]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function capField(raw) {
        var s = String(raw == null ? '' : raw);
        var strip = (root && typeof root.stripShareLinks === 'function') ? root.stripShareLinks : null;
        if (strip) s = strip(s);
        s = plainLine(s);
        if (s.length > 80) s = s.slice(0, 79) + '\u2026';
        return s;
    }

    function normalizeMode(mode) {
        var m = String(mode || '').toLowerCase();
        if (m === 'guided') return 'beginner';
        if (m === 'balanced' || m === 'quieter') return 'intermediate';
        if (m === 'everything' || m === 'maximalist') return 'advanced';
        if (m === 'lite' || m === 'beginner' || m === 'intermediate' || m === 'advanced') return m;
        return 'advanced';
    }

    function readMode() {
        var raw = '';
        try { raw = root.localStorage ? (root.localStorage.getItem('btc_experience_mode') || '') : ''; } catch (e) { raw = ''; }
        return normalizeMode(raw);
    }

    function buttonVisible(appId, mode) {
        var m = normalizeMode(mode == null ? readMode() : mode);
        if (m === 'beginner' && BEGINNER_HIDE[appId]) return false;
        return !!specById(appId);
    }

    function shareGrantsReward() { return false; }

    function resolveTctv(raw, list) {
        list = list && list.length ? list : stations();
        var text = String(raw == null ? '' : raw).replace(/^#/, '');
        if (text.indexOf('timechain-tv/') === 0) text = text.slice('timechain-tv/'.length);
        else if (text.indexOf('tv/') === 0) text = text.slice('tv/'.length);
        text = text.split('/')[0];
        if (!text || text === 'timechain-tv' || text === 'tv') return { ok: false, absent: true, station: null };
        var hit = null;
        if (/^\d{1,2}$/.test(text)) {
            var n = Number(text);
            for (var i = 0; i < list.length; i++) if (list[i].n === n) hit = list[i];
        } else if (/^[a-z0-9-]{1,40}$/.test(text)) {
            for (var j = 0; j < list.length; j++) if (list[j].id === text) hit = list[j];
        }
        var fallback = !hit;
        if (!hit) hit = list[0];
        return {
            ok: true,
            absent: false,
            fallback: fallback,
            station: { n: hit.n, id: hit.id, name: hit.name }
        };
    }

    function resolveBeats(trackId, knownIds) {
        var id = String(trackId == null ? '' : trackId);
        if (!TRACK_RE.test(id)) return { ok: false, trackId: '' };
        if (knownIds && typeof knownIds.indexOf === 'function' && knownIds.indexOf(id) === -1) return { ok: false, trackId: '' };
        return { ok: true, trackId: id };
    }

    function resolvePopTab(raw) {
        var text = String(raw == null ? '' : raw).replace(/^#/, '');
        if (text.indexOf('proof-of-play/') === 0) text = text.slice('proof-of-play/'.length);
        text = text.split('/')[0];
        if (POP_TABS[text]) return text;
        return 'arcade';
    }

    function liveCode() {
        try {
            if (root && typeof root.liveRefCode === 'function') {
                var code = String(root.liveRefCode() || '');
                if (REF_RE.test(code)) return code;
            }
        } catch (e) {}
        return '';
    }

    function buildUrl(hashPath, code) {
        var path = String(hashPath || '').replace(/^#/, '').replace(/^\/+/, '');
        if (!path || path.indexOf('http') === 0 || path.indexOf('//') === 0) path = 'bitcoin-beats';
        var base = SITE + '/#' + path;
        if (code == null) {
            if (root && typeof root.shareDeepUrl === 'function') return root.shareDeepUrl(base);
            code = liveCode();
        }
        var c = String(code || '');
        if (!REF_RE.test(c)) return base;
        return SITE + '/?ref=' + encodeURIComponent(c) + '#' + path;
    }

    function shareModel(appId, ctx) {
        ctx = ctx || {};
        var spec = specById(appId);
        if (!spec) return null;
        if (appId === 'pop' && ctx.tab && ctx.tab !== 'hub' && specById(ctx.tab)) return shareModel(ctx.tab, ctx);
        if (appId === 'quests' && ctx.tab === 'favor') return shareModel('favor', ctx);
        var sentence = spec.sentence;
        var hash = spec.hash;
        var name = spec.name;
        if (appId === 'tctv') {
            var channel = ctx.channel != null ? ctx.channel : '9';
            var resolved = resolveTctv(channel, stations());
            var st = resolved.station || stations()[0];
            sentence = "I'm watching channel " + st.n + ', ' + plainLine(st.name) + ' on Timechain TV! Check it out!';
            hash = 'timechain-tv/' + st.n;
            name = 'Timechain TV';
        } else if (appId === 'beats') {
            var beat = resolveBeats(ctx.trackId, ctx.knownIds);
            var title = capField(ctx.title);
            var artist = capField(ctx.artist) || 'Unknown';
            if (!beat.ok || !title) {
                sentence = "I'm listening on Bitcoin Beats! Check it out!";
                hash = beat.ok ? ('beats/' + beat.trackId) : 'bitcoin-beats';
                if (!title) hash = beat.ok && ctx.trackId ? hash : 'bitcoin-beats';
                if (!beat.ok) hash = 'bitcoin-beats';
            } else {
                sentence = "I'm listening to " + title + ' by ' + artist + ' on Bitcoin Beats! Check it out!';
                hash = 'beats/' + beat.trackId;
            }
            name = 'Bitcoin Beats';
        }
        var url = buildUrl(hash, ctx.code);
        return { id: appId, name: name, sentence: sentence, hash: hash, url: url };
    }

    function postText(model) {
        model = model || {};
        return String(model.sentence || '') + '\n' + String(model.url || '');
    }

    function splitLanding(href) {
        var u = String(href || '');
        var hash = '';
        var cut = u.indexOf('#');
        if (cut >= 0) { hash = u.slice(cut + 1); u = u.slice(0, cut); }
        var ref = '';
        var q = u.indexOf('?');
        if (q >= 0) {
            u.slice(q + 1).split('&').forEach(function (part) {
                var kv = part.split('=');
                if (kv[0] === 'ref') ref = decodeURIComponent(kv.slice(1).join('='));
            });
        }
        return { ref: ref, hash: hash };
    }

    function liveCtx(appId) {
        var ctx = {};
        if (appId === 'tctv') {
            var id = root._currentStation || '';
            try { if (!id && root.localStorage) id = root.localStorage.getItem('tctv_lastStation') || ''; } catch (e) {}
            ctx.channel = id || '0';
        } else if (appId === 'beats') {
            var np = root._beatsNowPlaying || {};
            ctx.title = np.title || '';
            ctx.artist = np.artist || '';
            ctx.trackId = np.trackId || '';
        } else if (appId === 'pop') {
            ctx.tab = root._popShareTab || 'hub';
        } else if (appId === 'quests') {
            ctx.tab = root._questHubTab || '';
        }
        return ctx;
    }

    function applyTctv(station) {
        if (!station) return;
        try { if (root.localStorage) root.localStorage.setItem('tctv_lastStation', station.id); } catch (e) {}
        if (typeof root.tctvApplyDeepChannel === 'function') {
            root.tctvApplyDeepChannel(station.id);
            return;
        }
        root._tctvDeepChannel = station.id;
        var doc = root.document;
        if (doc && doc.getElementById('tctv-player') && typeof root.switchStation === 'function') root.switchStation(station.id);
    }

    function consumeHash(raw) {
        var hash = String(raw == null ? '' : raw).replace(/^#/, '');
        if (!hash) return false;
        var head = hash.split('/')[0];
        if ((head === 'timechain-tv' || head === 'tv') && hash.indexOf('/') > 0) {
            var resolved = resolveTctv(hash, stations());
            if (!resolved.station) return false;
            applyTctv(resolved.station);
            if (typeof root.go !== 'function') return false;
            root.go('timechain-tv');
            return true;
        }
        if (head === 'proof-of-play' && hash.indexOf('/') > 0) {
            var tab = resolvePopTab(hash);
            root._popShareTab = tab;
            if (typeof root.enterProofOfPlay !== 'function') return false;
            if (root._popActive && typeof root._popSwitchTab === 'function') root._popSwitchTab(tab);
            else root.enterProofOfPlay(tab);
            return true;
        }
        if (head === 'beats' && hash.indexOf('beats/playlist/') !== 0 && hash.indexOf('/') > 0) {
            var trackId = hash.slice('beats/'.length).split('/')[0];
            if (resolveBeats(trackId).ok) return false;
            root._beatsDeepLink = null;
            if (typeof root.go !== 'function') return false;
            root.go('bitcoin-beats');
            return true;
        }
        if (hash === 'ai-tools') {
            if (typeof root.toggleAITools !== 'function') return false;
            if (!root._aiToolsOpen) root.toggleAITools();
            try { root.history.replaceState({ channel: 'ai-tools' }, '', '#ai-tools'); } catch (e) {}
            return true;
        }
        if (hash === 'leaderboard') {
            if (typeof root.toggleLeaderboard !== 'function') return false;
            var lb = root.document && root.document.getElementById('leaderboard');
            if (!lb || !lb.classList.contains('open')) root.toggleLeaderboard();
            try { root.history.replaceState({ channel: 'leaderboard' }, '', '#leaderboard'); } catch (e2) {}
            return true;
        }
        if (hash === 'proof-of-walk') {
            if (typeof root.showProofOfWalk !== 'function') return false;
            root.showProofOfWalk();
            return true;
        }
        return false;
    }

    function open(appId, ctx) {
        var merged = liveCtx(appId);
        ctx = ctx || {};
        Object.keys(ctx).forEach(function (key) { merged[key] = ctx[key]; });
        if (merged.code == null) merged.code = null;
        var model = shareModel(appId, merged);
        if (!model) return null;
        var sheet = root.AchievementShare;
        if (sheet && typeof sheet.openLinkSheet === 'function') {
            sheet.openLinkSheet({ sentence: model.sentence, name: model.name, url: model.url });
        }
        return model;
    }

    function makeButton(appId) {
        var doc = root.document;
        var btn = doc.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-mini-share', appId);
        btn.textContent = 'Share';
        btn.setAttribute('aria-label', 'Share');
        btn.style.cssText = 'min-width:44px;min-height:44px;padding:8px 12px;border-radius:10px;border:1px solid rgba(247,147,26,0.55);background:#1a120b;color:#fff;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;';
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            open(appId);
        });
        return btn;
    }

    function clearHidden(appId, host) {
        if (!host) return;
        var nodes = host.querySelectorAll('[data-mini-share="' + appId + '"]');
        for (var i = 0; i < nodes.length; i++) nodes[i].remove();
    }

    function mount(host, appId) {
        if (!host) return;
        if (!buttonVisible(appId)) { clearHidden(appId, host); return; }
        if (host.querySelector('[data-mini-share="' + appId + '"]')) return;
        host.appendChild(makeButton(appId));
    }

    function pageApp() {
        var hash = '';
        try { hash = String((root.location && root.location.hash) || '').replace(/^#/, ''); } catch (e) { hash = ''; }
        var page = root.currentPage || '';
        var doc = root.document;
        if (doc && doc.getElementById('beatsApp')) return null;
        if (hash.indexOf('meetup-builder') === 0 || page === 'meetup-builder') return 'meetup';
        if (hash.indexOf('irl-sync') === 0 || page === 'irl-sync') return 'irl';
        if (hash.indexOf('forum') === 0 || page === 'forum') return 'forum';
        if (hash.indexOf('marketplace') === 0 || page === 'marketplace') return 'marketplace';
        if (hash.indexOf('proof-of-walk') === 0 || page === 'proof-of-walk') return 'walk';
        if (hash.indexOf('trails') === 0 || page === 'trails') return 'trails';
        if (hash.indexOf('learning-quests') === 0 || page === 'learning-quests') return 'learning';
        if (hash.indexOf('lightning') === 0 || page === 'lightning') return 'lightning';
        if (hash.indexOf('first-purchase') === 0 || hash === 'buy' || page === 'first-purchase') return 'first';
        if (hash.indexOf('chat') === 0 || page === 'chat' || hash.indexOf('dms') === 0 || page === 'dms') return 'chat';
        return null;
    }

    function place() {
        var doc = root.document;
        if (!doc) return;
        mount(doc.getElementById('tctv-np-bar'), 'tctv');
        mount(doc.getElementById('beatsApp'), 'beats');
        mount(doc.querySelector('#popOverlay .pop-header'), 'pop');
        mount(doc.getElementById('pvpOverlay'), 'pvp');
        mount(doc.getElementById('nachoModeScreen'), 'nacho');
        mount(doc.getElementById('questHubOverlay'), 'quests');
        mount(doc.getElementById('aiToolsPanel'), 'ai');
        mount(doc.getElementById('leaderboard'), 'leaderboard');
        mount(doc.getElementById('btcDashCard'), 'metrics');
        var chatHeader = doc.querySelector('#chatOverlay > div');
        mount(chatHeader || doc.getElementById('chatOverlay'), 'chat');
        mount(doc.getElementById('lqHub'), 'learning');
        var fc = doc.getElementById('forumContainer');
        var appId = pageApp();
        if (fc && appId) {
            var bar = fc.querySelector('[data-mini-share-bar="' + appId + '"]');
            if (!buttonVisible(appId)) {
                if (bar) bar.remove();
            } else if (!bar) {
                bar = doc.createElement('div');
                bar.setAttribute('data-mini-share-bar', appId);
                bar.style.cssText = 'display:flex;justify-content:flex-end;padding:10px 16px 0;';
                bar.appendChild(makeButton(appId));
                fc.insertBefore(bar, fc.firstChild);
            }
        }
    }

    function maybePreview() {
        var loc = root.location;
        if (!loc) return;
        var host = String(loc.hostname || '');
        if (host !== 'localhost' && host !== '127.0.0.1') return;
        if (String(loc.search || '').indexOf('miniSharePreview=1') === -1) return;
        var doc = root.document;
        if (!doc || !doc.body || doc.getElementById('miniSharePreview')) return;
        var wrap = doc.createElement('div');
        wrap.id = 'miniSharePreview';
        wrap.style.cssText = 'position:relative;z-index:30;background:#0b0b0d;color:#fff;padding:16px;display:flex;flex-direction:column;gap:12px;';
        var h = doc.createElement('h1');
        h.textContent = 'Mini app share preview';
        h.style.cssText = 'font-size:1.1rem;margin:0;';
        wrap.appendChild(h);
        APPS.forEach(function (app) {
            var row = doc.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px;border:1px solid rgba(247,147,26,0.35);border-radius:12px;';
            var label = doc.createElement('div');
            label.textContent = app.name;
            label.style.cssText = 'font-weight:700;';
            row.appendChild(label);
            row.appendChild(makeButton(app.id));
            var opener = row.querySelector('[data-mini-share]');
            if (opener) {
                opener.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var ctx = {};
                    Object.keys(app.ctx || {}).forEach(function (key) { ctx[key] = app.ctx[key]; });
                    ctx.code = 'abc12345';
                    open(app.id, ctx);
                }, true);
            }
            wrap.appendChild(row);
        });
        doc.body.insertBefore(wrap, doc.body.firstChild);
    }

    function install(win) {
        if (win) root = win;
        if (!root.document || install.done) return;
        install.done = true;
        place();
        maybePreview();
        var timer = 0;
        function schedule() {
            if (timer) return;
            timer = setTimeout(function () { timer = 0; try { place(); } catch (e) {} }, 50);
        }
        if (typeof root.MutationObserver === 'function' && root.document.body) {
            var observer = new root.MutationObserver(function () { schedule(); });
            observer.observe(root.document.body, { childList: true, subtree: true });
        }
    }

    return {
        APPS: APPS,
        FALLBACK_STATIONS: FALLBACK_STATIONS,
        stations: stations,
        plainLine: plainLine,
        capField: capField,
        normalizeMode: normalizeMode,
        buttonVisible: buttonVisible,
        shareGrantsReward: shareGrantsReward,
        resolveTctv: resolveTctv,
        resolveBeats: resolveBeats,
        resolvePopTab: resolvePopTab,
        buildUrl: buildUrl,
        shareModel: shareModel,
        postText: postText,
        splitLanding: splitLanding,
        consumeHash: consumeHash,
        open: open,
        place: place,
        install: install
    };
});
