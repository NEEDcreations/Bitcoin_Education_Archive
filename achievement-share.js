// Achievement share cards. Sharing grants nothing: no XP, no sats, no tickets.
// Popups and the daily toast come only from a server profile diff.
// The streak button reads currentUser.streak, the server-maintained value.
(function (root, factory) {
    var api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root && typeof root === 'object') root.AchievementShare = api;
    if (root && root.document) {
        var boot = function () { api.install(root); };
        if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
        else boot();
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
    'use strict';

    var SITE = 'https://bitcoineducation.quest';
    // Painted on the card image. The post text uses SHARE_LINE so the image stays the same.
    var CTA = 'Learn Bitcoin and earn sats at bitcoineducation.quest';
    var SHARE_LINE = 'Learn Bitcoin and earn sats on Bitcoin Quest 👇';
    var REF_RE = /^[A-Za-z0-9]{6,28}$/;
    var SHARE_TYPES = ['sf_block', 'badge', 'cert_scholar', 'cert_protocol', 'rank', 'raid', 'streak', 'daily', 'xp'];
    var LONG_STREAKS = [30, 60, 100, 200, 365];
    var NOTABLE_RANKS = [
        { min: 2140, name: 'Maxi', slug: 'maxi' },
        { min: 6102, name: 'Maxi II', slug: 'maxi_ii' },
        { min: 8888, name: 'Maxi III', slug: 'maxi_iii' },
        { min: 10000, name: 'Papa John', slug: 'papa_john' },
        { min: 18333, name: 'Full Node', slug: 'full_node' },
        { min: 50000, name: 'Whale', slug: 'whale' },
        { min: 100000, name: 'Sovereign', slug: 'sovereign' },
        { min: 133337, name: 'Cypherpunk', slug: 'cypherpunk' },
        { min: 210000, name: 'Satoshi', slug: 'satoshi' }
    ];
    // Badge registry rarity (badges.js _getBadgeRarity) plus Unclaimed (holder count 0).
    // Share-worthy: Unclaimed, Legendary, Epic, Rare. Common is not.
    // When distribution is missing, catalog xp >= 500 is the fallback (badge-xp tiers 4 and 5).
    var RARITY_THRESHOLDS = {
        legendary: 'pct < 1',
        epic: 'pct < 5',
        rare: 'pct <= 25',
        common: 'else',
        unclaimed: 'holders === 0',
        xpFallback: 500,
        shareWorthy: ['Unclaimed', 'Legendary', 'Epic', 'Rare']
    };
    var STREAK_PLACES = ['dailyXpMeter', 'mobileUserInfo', 'Current Streak'];
    var LS_SHOWN = 'btc_share_cards_shown';
    var LS_TOGGLE = 'btc_share_cards';
    var LS_QUEUE = 'btc_share_cards_queue';
    var SHOWN_RE = /^[a-z0-9_:,]{0,1500}$/;
    // Above #usernameModal (2100008), #questModal (400000), cert share (100020), exam guard (99998).
    var Z_SHEET = 2200000;
    // Above the home streak chip (300). Below quest overlays (~9500) and settings.
    var Z_TOAST = 400;

    var host = (typeof window !== 'undefined') ? window : {};
    var state = emptyState();
    var prevProfile = null;
    var seeded = false;
    var watchUid = '';
    var previewing = false;
    var previewUser = null;
    var unsubProfile = null;
    var toastTimer = 0;
    var sheetReturn = null;

    function emptyState() {
        return { shown: {}, popupDay: '', dailyToastDay: '', queue: [] };
    }

    function cloneState(s) {
        s = s || emptyState();
        return {
            shown: Object.assign({}, s.shown || {}),
            popupDay: s.popupDay || '',
            dailyToastDay: s.dailyToastDay || '',
            queue: (s.queue || []).map(function (ev) { return Object.assign({}, ev); })
        };
    }

    function num(v) {
        var n = Number(v);
        return isFinite(n) ? n : 0;
    }

    function slug(s) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '').slice(0, 48);
    }

    function shownKey(id) {
        return String(id || '').toLowerCase().replace(/[^a-z0-9_:]/g, '');
    }

    function dayKey(iso) {
        return String(iso || '').replace(/-/g, '');
    }

    function isoDay(key) {
        return /^\d{8}$/.test(key) ? key.slice(0, 4) + '-' + key.slice(4, 6) + '-' + key.slice(6, 8) : key;
    }

    function questDay(now) {
        var d = new Date(now == null ? Date.now() : now);
        try {
            return new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/New_York',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(d);
        } catch (e) {
            return d.toISOString().slice(0, 10);
        }
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
        try { raw = host.localStorage ? (host.localStorage.getItem('btc_experience_mode') || '') : ''; } catch (e) { raw = ''; }
        return normalizeMode(raw);
    }

    function modeAllows(key, mode) {
        var m = normalizeMode(mode == null ? readMode() : mode);
        if (key === 'achievementShare') return m !== 'lite';
        if (key === 'achievementShareInline') return true;
        if (key === 'streakShare') return true;
        return true;
    }

    function toggleOn() {
        try {
            if (!host.localStorage) return true;
            return host.localStorage.getItem(LS_TOGGLE) !== '0';
        } catch (e) { return true; }
    }

    function escapeCardText(s) {
        return String(s == null ? '' : s)
            .replace(/[\u0000-\u001f\u007f]/g, '')
            .replace(/<[^>]*>/g, '')
            .replace(/[<>&"`]/g, '')
            .slice(0, 90);
    }

    function displayName(user) {
        var n = String((user && (user.username || user.displayName)) || '');
        var uid = user && user.uid ? String(user.uid) : '';
        if (!n || n.indexOf('@') >= 0 || (uid && n === uid) || /^[A-Za-z0-9]{20,}$/.test(n)) n = 'Bitcoiner';
        n = escapeCardText(n);
        return n || 'Bitcoiner';
    }

    function buildShareUrl(code, type) {
        var t = SHARE_TYPES.indexOf(type) >= 0 ? type : 'xp';
        var c = String(code || '');
        if (REF_RE.test(c)) return SITE + '/?ref=' + encodeURIComponent(c) + '&a=' + encodeURIComponent(t);
        return SITE;
    }

    function rarityLabel(pct) {
        var n = Number(pct);
        if (!isFinite(n)) return 'Common';
        if (n < 1) return 'Legendary';
        if (n < 5) return 'Epic';
        if (n <= 25) return 'Rare';
        return 'Common';
    }

    function badgeWorthy(id, distribution, catalog) {
        var meta = (catalog && catalog[id]) || {};
        var name = meta.name || id;
        var xp = num(meta.xp);
        var counts = distribution && distribution.counts;
        var total = distribution ? num(distribution.totalUsers) : 0;
        if (counts && total > 0 && Object.prototype.hasOwnProperty.call(counts, id)) {
            var count = num(counts[id]);
            if (count === 0) return { ok: true, rarity: 'Unclaimed', name: name, pct: 0 };
            var pct = (count / total) * 100;
            var rarity = rarityLabel(pct);
            return { ok: rarity !== 'Common', rarity: rarity, name: name, pct: pct };
        }
        if (xp >= RARITY_THRESHOLDS.xpFallback) {
            return { ok: true, rarity: xp >= 2000 ? 'Legendary' : 'Rare', name: name, fallback: true };
        }
        return { ok: false, rarity: 'Common', name: name };
    }

    function badgeIds(user) {
        var out = [];
        ['badges', 'visibleBadges', 'hiddenBadges'].forEach(function (key) {
            var v = user && user[key];
            if (Array.isArray(v)) {
                v.forEach(function (id) {
                    if (id && out.indexOf(String(id)) < 0) out.push(String(id));
                });
            } else if (v && typeof v === 'object') {
                Object.keys(v).forEach(function (id) {
                    if (v[id] && out.indexOf(id) < 0) out.push(id);
                });
            }
        });
        return out;
    }

    function rankForPoints(points) {
        var best = null;
        NOTABLE_RANKS.forEach(function (rank) {
            if (points >= rank.min) best = rank;
        });
        return best;
    }

    function clientClaimEvents() { return []; }

    function diffServerProfile(prev, next, opts) {
        if (!prev || !next) return [];
        opts = opts || {};
        var events = [];
        var prevSf = num(prev.sfBlocksFound);
        var nextSf = num(next.sfBlocksFound);
        if (nextSf > prevSf || (!prev.sfBlockSolver && next.sfBlockSolver)) {
            var count = nextSf > prevSf ? nextSf : Math.max(1, nextSf);
            events.push({
                type: 'sf_block',
                id: 'sf_block:' + count,
                kind: 'popup',
                title: "Satoshi's Favor block found",
                count: count
            });
        }
        var prevBadges = badgeIds(prev);
        badgeIds(next).forEach(function (id) {
            if (prevBadges.indexOf(id) >= 0) return;
            var worthy = badgeWorthy(id, opts.distribution, opts.catalog);
            if (!worthy.ok) return;
            events.push({
                type: 'badge',
                id: 'badge:' + slug(id),
                kind: 'popup',
                title: worthy.name,
                rarity: worthy.rarity,
                badgeId: id
            });
        });
        if (!prev.certPassed_prop && next.certPassed_prop) {
            events.push({ type: 'cert_scholar', id: 'cert_scholar', kind: 'popup', title: 'Bitcoin Scholar', manualLite: true });
        }
        if (!prev.certPassed_tech && next.certPassed_tech) {
            events.push({ type: 'cert_protocol', id: 'cert_protocol', kind: 'popup', title: 'Protocol Expert', manualLite: true });
        }
        var prevRank = rankForPoints(num(prev.points));
        var nextRank = rankForPoints(num(next.points));
        if (nextRank && (!prevRank || nextRank.min > prevRank.min)) {
            events.push({ type: 'rank', id: 'rank:' + nextRank.slug, kind: 'popup', title: nextRank.name, rank: nextRank.name });
        }
        var prevRaid = num(prev.raidBossesDefeated);
        var nextRaid = num(next.raidBossesDefeated);
        var damage = num(next.raidDamageAllTime) + num(next.raidDamageThisMonth);
        if (nextRaid > prevRaid && damage > 0) {
            events.push({ type: 'raid', id: 'raid:' + nextRaid, kind: 'popup', title: 'Raid boss defeated' });
        }
        var prevStreak = num(prev.streak);
        var nextStreak = num(next.streak);
        if (nextStreak > prevStreak && LONG_STREAKS.indexOf(nextStreak) >= 0) {
            events.push({
                type: 'streak',
                id: 'streak:' + nextStreak,
                kind: 'popup',
                title: '🔥 ' + nextStreak + '-day streak on Bitcoin Quest',
                days: nextStreak
            });
        }
        if (num(next.trifectaDays) > num(prev.trifectaDays)) {
            var day = opts.today || questDay(opts.now);
            events.push({
                type: 'daily',
                id: 'daily:' + day,
                kind: 'toast',
                title: 'Daily quests done 🔥 day ' + nextStreak + ' streak',
                days: nextStreak
            });
        }
        return events;
    }

    function enqueue(s, event) {
        var q = s.queue || (s.queue = []);
        var dup = q.some(function (ev) { return ev && ev.id === event.id; });
        if (!dup) q.push(Object.assign({}, event));
        return s;
    }

    function decideShare(event, rawState, opts) {
        opts = opts || {};
        var s = cloneState(rawState);
        if (!event || !event.type) return { action: 'skip', state: s, reason: 'no-event' };
        var mode = normalizeMode(opts.mode || 'advanced');
        var manual = !!(event.manual || event.kind === 'manual');
        var today = opts.today || '';
        var allowsPopup = opts.allowsPopup != null ? !!opts.allowsPopup : mode !== 'lite';
        var allowsInline = opts.allowsInline != null ? !!opts.allowsInline : true;

        var key = shownKey(event.id);
        if (manual) {
            if (event.type === 'badge' && mode === 'lite') return { action: 'skip', state: s, reason: 'lite-badge' };
            if (opts.exam || opts.quest) return { action: 'later', state: s, reason: 'after-exam' };
            return { action: 'sheet', state: s, reason: 'manual' };
        }

        if (opts.toggleOn === false) return { action: 'skip', state: s, reason: 'toggle' };

        if (event.kind === 'toast' || event.type === 'daily') {
            if (!allowsInline) return { action: 'skip', state: s, reason: 'inline-off' };
            if ((key && key.indexOf('daily:') !== 0 && s.shown[key]) || (today && s.dailyToastDay === today)) {
                return { action: 'skip', state: s, reason: 'daily-once' };
            }
            if (opts.busy || opts.exam || opts.quest || opts.sheet) return { action: 'queue', state: enqueue(s, event), reason: 'busy' };
            s.dailyToastDay = today;
            return { action: 'toast', state: s, reason: 'daily' };
        }

        if (!allowsPopup || mode === 'lite') return { action: 'skip', state: s, reason: 'lite' };
        if (key && s.shown[key]) return { action: 'skip', state: s, reason: 'shown' };
        if (opts.busy || opts.exam || opts.quest) return { action: 'queue', state: enqueue(s, event), reason: 'busy' };
        if (today && s.popupDay === today) return { action: 'queue', state: enqueue(s, event), reason: 'cap' };
        if (key) s.shown[key] = 1;
        s.popupDay = today;
        return { action: 'popup', state: s, reason: 'popup' };
    }

    function cardModel(event, user) {
        event = event || {};
        var type = SHARE_TYPES.indexOf(event.type) >= 0 ? event.type : 'xp';
        var days = event.days != null ? num(event.days) : num(user && user.streak);
        var title = event.title || 'Bitcoin Quest';
        if (type === 'streak') title = '🔥 ' + days + '-day streak on Bitcoin Quest';
        if (type === 'daily') title = 'Daily quests done 🔥 day ' + days + ' streak';
        var code = '';
        if (user && user.referralCode && REF_RE.test(String(user.referralCode))) code = String(user.referralCode);
        else if (event.code && REF_RE.test(String(event.code))) code = String(event.code);
        return {
            type: type,
            title: escapeCardText(title),
            name: displayName(user),
            cta: CTA,
            url: buildShareUrl(code, type),
            days: days
        };
    }

    function shareText(model) {
        if (model && model.linkShare) return String(model.sentence || model.title || '') + '\n' + String(model.url || '');
        return model.title + '\n' + SHARE_LINE + '\n' + model.url;
    }

    function nativeSharePayload(model) {
        return { title: model.title, text: shareText(model) };
    }

    function xIntent(model) {
        return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText(model));
    }

    function telegramShare(model) {
        if (model && model.linkShare) {
            return { url: model.url, text: String(model.sentence || model.title || '') };
        }
        return {
            url: model.url,
            text: model.title + '\n' + SHARE_LINE
        };
    }

    function shareResult() {
        return { xp: 0, sats: 0, tickets: 0 };
    }

    function shareGrantsReward() { return false; }

    function compactShown(s) {
        var heads = [];
        if (s.popupDay && /^\d{4}-\d{2}-\d{2}$/.test(s.popupDay)) heads.push('popup:' + dayKey(s.popupDay));
        if (s.dailyToastDay && /^\d{4}-\d{2}-\d{2}$/.test(s.dailyToastDay)) heads.push('toast:' + dayKey(s.dailyToastDay));
        var ids = [];
        Object.keys(s.shown || {}).forEach(function (id) {
            var clean = shownKey(id);
            if (!clean || clean.indexOf('daily:') === 0) return;
            ids.push(clean);
        });
        while (ids.length && heads.concat(ids).join(',').length > 1500) ids.shift();
        var text = heads.concat(ids).join(',');
        if (text.length > 1500) text = text.slice(Math.max(0, text.length - 1500)).replace(/^[^,]*,/, '');
        if (!SHOWN_RE.test(text)) text = text.replace(/[^a-z0-9_:,]/g, '').slice(-1500);
        return text;
    }

    function mergeShown(text, s) {
        String(text || '').split(',').forEach(function (part) {
            if (!part) return;
            if (part.indexOf('popup:') === 0) s.popupDay = isoDay(part.slice(6));
            else if (part.indexOf('toast:') === 0) rememberToastDay(s, isoDay(part.slice(6)));
            else if (part.indexOf('daily:') === 0) rememberToastDay(s, isoDay(part.slice(6)));
            else s.shown[part] = 1;
        });
        return s;
    }

    function getAuth() {
        try {
            if (typeof auth !== 'undefined' && auth) return auth;
        } catch (e0) {}
        if (host && host.auth) return host.auth;
        try {
            var fb = (typeof firebase !== 'undefined' && firebase) || (host && host.firebase);
            if (fb && typeof fb.auth === 'function') return fb.auth();
        } catch (e1) {}
        return null;
    }

    function getDb() {
        try {
            if (typeof db !== 'undefined' && db) return db;
        } catch (e0) {}
        if (host && host.db) return host.db;
        try {
            var fb = (typeof firebase !== 'undefined' && firebase) || (host && host.firebase);
            if (fb && typeof fb.firestore === 'function') return fb.firestore();
        } catch (e1) {}
        return null;
    }

    function getCurrentUser() {
        try {
            if (typeof currentUser !== 'undefined' && currentUser) return currentUser;
        } catch (e0) {}
        if (host && host.currentUser) return host.currentUser;
        if (previewing && previewUser) return previewUser;
        return null;
    }

    function serverStreak(user) {
        var u = user || getCurrentUser() || null;
        var n = Number(u && u.streak);
        if (!isFinite(n) || n < 0) n = 0;
        return Math.floor(n);
    }

    function signedIn() {
        if (previewing) return true;
        if (host._isLocal) return false;
        var liveAuth = getAuth();
        if (!liveAuth || !liveAuth.currentUser || liveAuth.currentUser.isAnonymous) return false;
        var u = getCurrentUser();
        if (!u || u._isLocal) return false;
        return true;
    }

    function currentCode() {
        var u = getCurrentUser() || {};
        if (u.referralCode && REF_RE.test(String(u.referralCode))) return String(u.referralCode);
        if (typeof host.getReferralCode === 'function') {
            try {
                var c = String(host.getReferralCode() || '');
                if (REF_RE.test(c) && c.indexOf('@') < 0) return c;
            } catch (e) {}
        }
        return '';
    }

    function liveCatalog() {
        var catalog = {};
        var lists = [];
        if (host.BADGE_CATALOG) lists.push(host.BADGE_CATALOG);
        if (host.BADGE_DEFS) lists.push(host.BADGE_DEFS);
        lists.forEach(function (list) {
            if (Array.isArray(list)) {
                list.forEach(function (b) {
                    if (b && b.id) catalog[b.id] = { name: b.name || b.id, xp: num(b.xp) };
                });
            } else if (list && typeof list === 'object') {
                Object.keys(list).forEach(function (id) {
                    var b = list[id] || {};
                    catalog[id] = { name: b.name || id, xp: num(b.xp) };
                });
            }
        });
        return catalog;
    }

    function liveDistribution() {
        if (host._badgeDist && host._badgeDist.counts) return host._badgeDist;
        try {
            var raw = host.localStorage && host.localStorage.getItem('btc_badge_dist_cache');
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (parsed && parsed.counts && parsed.totalUsers) return parsed;
        } catch (e) {}
        return null;
    }

    function drawCard(canvas, model, size) {
        if (!canvas || !canvas.getContext) return canvas;
        var square = size === 'square';
        var w = square ? 1080 : 1200;
        var h = square ? 1080 : 630;
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        var bg = ctx.createLinearGradient(0, 0, w, h);
        bg.addColorStop(0, '#140d06');
        bg.addColorStop(0.55, '#1c1208');
        bg.addColorStop(1, '#3a220c');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#f7931a';
        ctx.fillRect(0, 0, w, 18);
        ctx.fillRect(0, h - 18, w, 18);
        ctx.fillStyle = '#111113';
        ctx.fillRect(48, 48, w - 96, h - 96);
        ctx.fillStyle = '#f7931a';
        ctx.beginPath();
        ctx.arc(square ? 160 : 140, square ? 190 : 150, square ? 54 : 42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111113';
        ctx.font = 'bold ' + (square ? 64 : 48) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('B', square ? 160 : 140, square ? 212 : 166);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold ' + (square ? 54 : 40) + 'px sans-serif';
        ctx.fillText('Bitcoin Quest', square ? 240 : 210, square ? 205 : 162);
        ctx.fillStyle = '#f7931a';
        ctx.font = 'bold ' + (square ? 64 : 48) + 'px sans-serif';
        wrapFill(ctx, model.title || '', square ? 120 : 96, square ? 360 : 280, w - (square ? 240 : 180), square ? 76 : 58);
        ctx.fillStyle = '#e5e7eb';
        ctx.font = (square ? 36 : 28) + 'px sans-serif';
        ctx.fillText(model.name || 'Bitcoiner', square ? 120 : 96, h - (square ? 220 : 150));
        ctx.fillStyle = '#9ca3af';
        ctx.font = (square ? 28 : 22) + 'px sans-serif';
        wrapFill(ctx, model.cta || CTA, square ? 120 : 96, h - (square ? 150 : 96), w - (square ? 240 : 180), square ? 36 : 28);
        return canvas;
    }

    function wrapFill(ctx, text, x, y, max, line) {
        var words = String(text || '').split(/\s+/);
        var lineText = '';
        var yy = y;
        for (var i = 0; i < words.length; i++) {
            var next = lineText ? (lineText + ' ' + words[i]) : words[i];
            if (ctx.measureText(next).width > max && lineText) {
                ctx.fillText(lineText, x, yy);
                lineText = words[i];
                yy += line;
            } else {
                lineText = next;
            }
        }
        if (lineText) ctx.fillText(lineText, x, yy);
    }

    function doc() { return host.document; }

    var BUSY_IDS = [
        'badgeCelebration', 'sfWinnerOverlay', 'levelUpModal', 'satsCelebration',
        'certShareOverlay', 'btcIntroOverlay', 'totpSignInOverlay', 'mfaSignInOverlay',
        'lnAuthModal', 'nachoStoryOverlay', 'satoshiFavorMinerOverlay'
    ];

    function computedStyle(el) {
        if (!el) return {};
        if (host.getComputedStyle) {
            try { return host.getComputedStyle(el) || el.style || {}; } catch (e) {}
        }
        return el.style || {};
    }

    function viewLength(view, key, hostKey) {
        if (view && typeof view[key] === 'number') return view[key];
        if (typeof host[hostKey] === 'number') return host[hostKey];
        return NaN;
    }

    function isShown(el, view) {
        if (!el) return false;
        if (el.classList && el.classList.contains('hidden')) return false;
        var cs = computedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        if (el.getBoundingClientRect) {
            var rect = el.getBoundingClientRect();
            if (rect && rect.width === 0 && rect.height === 0) return false;
            var height = viewLength(view, 'innerHeight', 'innerHeight');
            var width = viewLength(view, 'innerWidth', 'innerWidth');
            if (rect && isFinite(height) && isFinite(width) && (rect.bottom <= 1 || rect.top >= height - 1 || rect.right <= 1 || rect.left >= width - 1)) return false;
        }
        if (cs.opacity === 0 || cs.opacity === '0') return false;
        return true;
    }

    function isOwnChrome(el) {
        return !!(el && (el.id === 'bqShareSheet' || el.id === 'bqDailyShareToast' || el.id === 'bqShareLater'));
    }

    function isLargeFixedOverlay(el, view) {
        if (!el || isOwnChrome(el)) return false;
        var cs = computedStyle(el);
        if (cs.position !== 'fixed') return false;
        var z = parseInt(cs.zIndex, 10);
        if (!(z >= 1000)) return false;
        var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 1000, height: 1000 };
        if (!rect || rect.width < 200 || rect.height < 200) return false;
        return isShown(el, view);
    }

    function shareSheetOpen(view) {
        var d = doc();
        var el = d && d.getElementById && d.getElementById('bqShareSheet');
        return isShown(el, view || host);
    }

    function rememberToastDay(s, day) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) return;
        if (!s.dailyToastDay || day > s.dailyToastDay) s.dailyToastDay = day;
    }

    function detectBusy(d, env) {
        var out = { busy: false, exam: false, quest: false, modal: false };
        if (!d) return out;
        env = env || {};
        function mark(kind) {
            out.busy = true;
            if (kind === 'exam') out.exam = true;
            else if (kind === 'quest') out.quest = true;
            else out.modal = true;
        }
        if (env._scholarExamActive || env._examActive) mark('exam');
        var quest = d.getElementById && d.getElementById('questModal');
        if (quest && quest.classList && quest.classList.contains('open') && isShown(quest, env)) mark('quest');
        if (env._giftOpening || env._pvpActive || env._nachoMode || env._nachoBusy) mark('modal');
        var userModal = d.getElementById && d.getElementById('usernameModal');
        if (userModal && userModal.classList && userModal.classList.contains('open')) mark('modal');
        var tos = d.getElementById && d.getElementById('tosModal');
        if ((tos && tos.classList && tos.classList.contains('open')) || (d.querySelector && d.querySelector('.lq-overlay'))) mark('modal');
        BUSY_IDS.forEach(function (id) {
            var el = d.getElementById && d.getElementById(id);
            if (isShown(el, env)) mark('modal');
        });
        var nacho = d.getElementById && d.getElementById('nacho-container');
        if (nacho && isShown(nacho, env) && nacho.querySelector && nacho.querySelector('#nachoInput, [data-interactive="true"]')) mark('modal');
        if (d.querySelectorAll) {
            var dialogs = d.querySelectorAll('[role="dialog"], [aria-modal="true"]');
            for (var i = 0; i < dialogs.length; i++) {
                if (!isOwnChrome(dialogs[i]) && isShown(dialogs[i], env)) mark('modal');
            }
            var nodes = d.querySelectorAll('*');
            for (var n = 0; n < nodes.length; n++) {
                if (isLargeFixedOverlay(nodes[n], env)) { mark('modal'); break; }
            }
        }
        return out;
    }

    function busyState() {
        return detectBusy(doc(), host);
    }

    function decideContext(extra) {
        var b = busyState();
        var mode = readMode();
        return Object.assign({
            mode: mode,
            toggleOn: toggleOn(),
            busy: b.busy,
            exam: b.exam,
            quest: b.quest,
            sheet: shareSheetOpen(),
            today: questDay(),
            allowsPopup: modeAllows('achievementShare', mode),
            allowsInline: modeAllows('achievementShareInline', mode)
        }, extra || {});
    }

    function persist(s, remote) {
        var compact = compactShown(s);
        try { if (host.localStorage) host.localStorage.setItem(LS_SHOWN, compact); } catch (e) {}
        try {
            if (host.sessionStorage) host.sessionStorage.setItem(LS_QUEUE, JSON.stringify(s.queue || []));
        } catch (e2) {}
        if (!remote || previewing) return;
        var liveAuth = getAuth();
        var liveDb = getDb();
        var uid = liveAuth && liveAuth.currentUser && liveAuth.currentUser.uid;
        if (!liveDb || !uid || !liveAuth.currentUser || liveAuth.currentUser.isAnonymous) return;
        try {
            liveDb.collection('users').doc(uid).update({ shareCardsShown: compact }).catch(function () {});
        } catch (e3) {}
    }

    function loadState() {
        var s = emptyState();
        try {
            if (host.localStorage) mergeShown(host.localStorage.getItem(LS_SHOWN) || '', s);
        } catch (e) {}
        try {
            if (host.sessionStorage) {
                var q = JSON.parse(host.sessionStorage.getItem(LS_QUEUE) || '[]');
                if (Array.isArray(q)) s.queue = q.filter(function (ev) { return ev && ev.id && ev.type; });
            }
        } catch (e2) {}
        return s;
    }

    function showLater() {
        var d = doc();
        if (!d || !d.body) return;
        var old = d.getElementById('bqShareLater');
        if (old) old.remove();
        var note = d.createElement('div');
        note.id = 'bqShareLater';
        note.setAttribute('role', 'status');
        note.textContent = 'after your exam';
        note.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(var(--above-fab, 88px));z-index:' + Z_TOAST + ';max-width:420px;margin:0 auto;background:#14120f;color:#fff;border:1px solid rgba(247,147,26,0.55);border-radius:14px;padding:12px 16px;text-align:center;font-weight:800;';
        d.body.appendChild(note);
        setTimeout(function () { if (note.parentNode) note.remove(); }, 2500);
    }

    function applyDecision(decision, event) {
        if (decision.action === 'later') {
            showLater();
            return;
        }
        state = decision.state;
        if (decision.action === 'popup' || decision.action === 'sheet') openSheet(event);
        else if (decision.action === 'toast') showToast(event);
        if (decision.action === 'popup' || decision.action === 'toast' || decision.action === 'queue') {
            persist(state, decision.action === 'popup' || decision.action === 'toast');
        }
    }

    function pickQueued(rawState, opts) {
        var s = cloneState(rawState);
        opts = opts || {};
        if (opts.exam || opts.quest || opts.modal) return { action: 'wait', state: s, event: null };
        var queue = s.queue || [];
        for (var i = 0; i < queue.length; i++) {
            var event = queue[i];
            var rest = cloneState(s);
            rest.queue = queue.slice(0, i).concat(queue.slice(i + 1));
            var decision = decideShare(event, rest, opts);
            if (decision.action === 'queue') continue;
            return { action: decision.action, event: event, state: decision.state, reason: decision.reason };
        }
        return { action: 'wait', state: s, event: null };
    }

    function consider(event) {
        var decision = decideShare(event, state, decideContext());
        applyDecision(decision, event);
    }

    function flush() {
        if (!state.queue || !state.queue.length) return;
        var b = busyState();
        if (b.exam || b.quest || b.modal) {
            var toast = doc() && doc().getElementById('bqDailyShareToast');
            if (toast) toast.remove();
            return;
        }
        var picked = pickQueued(state, decideContext());
        if (!picked.event || picked.action === 'wait' || picked.action === 'queue') return;
        applyDecision(picked, picked.event);
    }

    function openManual(event) {
        event = Object.assign({ manual: true, kind: 'manual' }, event || {});
        var user = getCurrentUser() || {};
        if (event.type === 'streak') {
            event.days = serverStreak(user);
            event.title = '🔥 ' + event.days + '-day streak on Bitcoin Quest';
            event.id = event.id || 'streak:now';
        }
        event.code = currentCode();
        var decision = decideShare(event, state, decideContext());
        applyDecision(decision, event);
    }

    function streakButton() {
        var b = doc().createElement('button');
        b.type = 'button';
        b.className = 'bq-streak-share';
        b.setAttribute('data-streak-share', '1');
        b.setAttribute('aria-label', 'Share your streak');
        b.title = 'Share your streak';
        b.textContent = '↗';
        b.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            openManual({ type: 'streak' });
        });
        return b;
    }

    function ensureButton(container) {
        if (!container || container.querySelector('[data-streak-share]')) return;
        container.appendChild(streakButton());
    }

    function placeStreakButtons() {
        var d = doc();
        if (!d || !signedIn()) return;
        var days = serverStreak();
        var meter = d.getElementById('dailyXpMeter');
        if (meter) {
            var row = d.getElementById('bqDailyStreak');
            if (!row) {
                row = d.createElement('div');
                row.id = 'bqDailyStreak';
                row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;';
                var label = d.createElement('span');
                label.id = 'bqDailyStreakText';
                label.style.cssText = 'color:#f97316;font-weight:700;font-size:0.85rem;';
                row.appendChild(label);
                meter.appendChild(row);
            }
            var text = d.getElementById('bqDailyStreakText');
            if (text) text.textContent = '🔥 ' + days + '-day streak';
            ensureButton(row);
        }
        var info = d.getElementById('mobileUserInfo');
        if (info && info.parentNode) {
            var holder = d.getElementById('bqMobileStreak');
            if (!holder) {
                holder = d.createElement('span');
                holder.id = 'bqMobileStreak';
                holder.style.cssText = 'display:inline-flex;align-items:center;gap:4px;flex-shrink:0;';
                var chip = d.createElement('span');
                chip.setAttribute('data-streak-count', '1');
                chip.style.cssText = 'color:#f97316;font-weight:700;font-size:0.75rem;';
                holder.appendChild(chip);
                info.parentNode.insertBefore(holder, info.nextSibling);
            }
            var count = holder.querySelector('[data-streak-count]');
            if (count) count.textContent = '🔥' + days;
            ensureButton(holder);
        }
        injectSettings();
    }

    function injectSettings() {
        var d = doc();
        var modal = d && d.getElementById('usernameModal');
        if (!modal) return;
        if (!d.getElementById('bqShareCardsToggle')) {
            var buttons = modal.querySelectorAll('button');
            for (var i = 0; i < buttons.length; i++) {
                if ((buttons[i].textContent || '').indexOf('Advanced Prefs') >= 0) {
                    buttons[i].parentNode.insertBefore(toggleCard(), buttons[i]);
                    break;
                }
            }
        }
        if (signedIn()) {
            var rows = modal.querySelectorAll('div');
            for (var r = 0; r < rows.length; r++) {
                var row = rows[r];
                if (row.querySelector('[data-streak-share]')) continue;
                if (row.children.length === 2 && (row.textContent || '').indexOf('Current Streak') >= 0 && row.textContent.length < 90) {
                    row.style.alignItems = 'center';
                    ensureButton(row);
                    break;
                }
            }
            if (!d.getElementById('bqXpShare') && (modal.textContent || '').indexOf('Your Stats') >= 0) {
                var leaves = modal.querySelectorAll('div');
                for (var x = 0; x < leaves.length; x++) {
                    var leaf = leaves[x];
                    if (leaf.children.length === 0 && /XP$/.test((leaf.textContent || '').trim()) && leaf.textContent.length < 28 && leaf.parentNode) {
                        leaf.parentNode.appendChild(xpShareButton());
                        break;
                    }
                }
            }
            injectCertShares(modal);
        }
        if (readMode() === 'lite') {
            modal.querySelectorAll('[data-badge-share]').forEach(function (n) { n.remove(); });
        }
    }

    function toggleCard() {
        var d = doc();
        var wrap = d.createElement('div');
        wrap.id = 'bqShareCardsRow';
        wrap.style.cssText = 'background:var(--card-bg,#111);border:1px solid var(--border,#333);border-radius:12px;padding:16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;';
        var label = d.createElement('label');
        label.htmlFor = 'bqShareCardsToggle';
        label.textContent = 'Show share cards for achievements';
        label.style.cssText = 'color:var(--text,#fff);font-size:0.85rem;flex:1;';
        var input = d.createElement('input');
        input.type = 'checkbox';
        input.id = 'bqShareCardsToggle';
        input.checked = toggleOn();
        input.style.cssText = 'width:44px;height:44px;min-width:44px;min-height:44px;';
        input.addEventListener('change', function () {
            try { host.localStorage.setItem(LS_TOGGLE, input.checked ? '1' : '0'); } catch (e) {}
        });
        wrap.appendChild(label);
        wrap.appendChild(input);
        return wrap;
    }

    function xpShareButton() {
        var b = doc().createElement('button');
        b.type = 'button';
        b.id = 'bqXpShare';
        b.textContent = 'Share';
        b.setAttribute('aria-label', 'Share your progress');
        b.style.cssText = 'min-width:44px;min-height:44px;margin-top:8px;padding:8px 14px;border-radius:10px;border:1px solid #f7931a;background:transparent;color:#f7931a;font-weight:700;cursor:pointer;';
        b.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var u = getCurrentUser() || {};
            openManual({ type: 'xp', id: 'xp:summary', title: (u.points || 0) + ' XP on Bitcoin Quest', manual: true });
        });
        return b;
    }

    function injectCertShares(modal) {
        var u = getCurrentUser() || {};
        var buttons = modal.querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) {
            var oc = buttons[i].getAttribute('onclick') || '';
            if (oc.indexOf("'properties'") >= 0 && u.certPassed_prop && !doc().getElementById('bqCertShareScholar')) {
                buttons[i].parentNode.insertBefore(certButton('bqCertShareScholar', 'cert_scholar', 'Share your Scholar certificate', 'Bitcoin Scholar'), buttons[i].nextSibling);
            }
            if (oc.indexOf("'technical'") >= 0 && u.certPassed_tech && !doc().getElementById('bqCertShareProtocol')) {
                buttons[i].parentNode.insertBefore(certButton('bqCertShareProtocol', 'cert_protocol', 'Share your Protocol Expert certificate', 'Protocol Expert'), buttons[i].nextSibling);
            }
        }
    }

    function certButton(id, type, aria, title) {
        var b = doc().createElement('button');
        b.type = 'button';
        b.id = id;
        b.textContent = 'Share';
        b.setAttribute('aria-label', aria);
        b.style.cssText = 'min-width:44px;min-height:44px;margin-top:8px;padding:8px 14px;border-radius:10px;border:1px solid #f7931a;background:transparent;color:#f7931a;font-weight:700;cursor:pointer;';
        b.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            openManual({ type: type, id: type, title: title, manual: true });
        });
        return b;
    }

    function decorateBadges() {
        var d = doc();
        if (!d) return;
        if (readMode() === 'lite') {
            d.querySelectorAll('[data-badge-share]').forEach(function (n) { n.remove(); });
            return;
        }
        var cel = d.getElementById('badgeCelebration');
        if (cel && !cel.querySelector('[data-badge-share]')) {
            var title = '';
            var named = cel.querySelector('strong, b, h2, h3');
            title = (named && named.textContent) || 'Badge';
            cel.appendChild(badgeShareButton(title));
        }
        d.querySelectorAll('.bdr-row[data-earned="1"]').forEach(function (row) {
            if (row.querySelector('[data-badge-share]')) return;
            var titleEl = row.querySelector('.bdr-badge-title');
            row.appendChild(badgeShareButton(titleEl ? titleEl.textContent : 'Badge'));
        });
    }

    function badgeShareButton(name) {
        var b = doc().createElement('button');
        b.type = 'button';
        b.textContent = 'Share';
        b.setAttribute('data-badge-share', '1');
        b.setAttribute('aria-label', 'Share');
        b.style.cssText = 'min-width:44px;min-height:44px;margin-left:8px;padding:8px 12px;border-radius:10px;border:1px solid #f7931a;background:transparent;color:#f7931a;font-weight:700;cursor:pointer;';
        b.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            openManual({ type: 'badge', id: 'badge:' + slug(name), title: name, manual: true });
        });
        return b;
    }

    function actionButton(label, aria, onClick) {
        var b = doc().createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.setAttribute('aria-label', aria || label);
        b.style.cssText = 'min-width:44px;min-height:44px;padding:10px 12px;border-radius:10px;border:1px solid rgba(247,147,26,0.5);background:#1a120b;color:#fff;font-weight:700;cursor:pointer;font-family:inherit;';
        b.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            onClick(b);
        });
        return b;
    }

    function openLinkSheet(opts) {
        opts = opts || {};
        var sentence = String(opts.sentence || '');
        paintSheet({
            type: 'miniapp',
            linkShare: true,
            title: sentence,
            sentence: sentence,
            name: String(opts.name || 'Bitcoin Quest'),
            cta: 'Check it out!',
            url: String(opts.url || '')
        });
    }

    function openSheet(event) {
        var d = doc();
        if (!d || !d.body) return;
        event = event || {};
        var user = Object.assign({}, getCurrentUser() || {});
        if (!user.referralCode) user.referralCode = event.code || currentCode();
        if (event.type === 'streak') event.days = event.days != null ? event.days : serverStreak(user);
        paintSheet(cardModel(event, user));
    }

    function paintSheet(model) {
        var d = doc();
        if (!d || !d.body) return;
        var existing = d.getElementById('bqShareSheet');
        if (existing) existing.remove();
        sheetReturn = d.activeElement;
        var overlay = d.createElement('div');
        overlay.id = 'bqShareSheet';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'bqShareSheetTitle');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:' + Z_SHEET + ';background:rgba(0,0,0,0.72);display:flex;align-items:flex-end;justify-content:center;padding:12px;';
        var panel = d.createElement('div');
        panel.style.cssText = 'width:min(560px,100%);max-height:calc(100vh - 24px);overflow:auto;background:#14120f;color:#fff;border:1px solid rgba(247,147,26,0.45);border-radius:16px;padding:16px;box-sizing:border-box;';
        var head = d.createElement('div');
        head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';
        var h = d.createElement('h2');
        h.id = 'bqShareSheetTitle';
        h.textContent = model.title;
        h.style.cssText = 'font-size:1.05rem;margin:0;line-height:1.3;';
        var close = actionButton('✕', 'Close', function () { closeSheet(); });
        close.style.minWidth = '44px';
        close.style.minHeight = '44px';
        head.appendChild(h);
        head.appendChild(close);
        panel.appendChild(head);
        var name = d.createElement('p');
        name.textContent = model.name;
        name.style.cssText = 'margin:8px 0;color:#e5e7eb;';
        panel.appendChild(name);
        var land = d.createElement('canvas');
        land.setAttribute('data-bq-card', 'landscape');
        land.style.cssText = 'width:100%;height:auto;border-radius:12px;background:#111;';
        drawCard(land, model, 'landscape');
        panel.appendChild(land);
        var squareLabel = d.createElement('p');
        squareLabel.textContent = 'Square';
        squareLabel.style.cssText = 'margin:12px 0 6px;color:#9ca3af;font-size:0.8rem;';
        panel.appendChild(squareLabel);
        var square = d.createElement('canvas');
        square.setAttribute('data-bq-card', 'square');
        square.style.cssText = 'width:min(100%,360px);height:auto;border-radius:12px;background:#111;';
        drawCard(square, model, 'square');
        panel.appendChild(square);
        var link = d.createElement('p');
        link.textContent = model.url;
        link.style.cssText = 'word-break:break-all;font-size:0.8rem;color:#f7931a;margin:12px 0;';
        panel.appendChild(link);
        if (model.linkShare) {
            var post = d.createElement('p');
            post.id = 'bqSharePostText';
            post.textContent = shareText(model);
            post.style.cssText = 'white-space:pre-wrap;word-break:break-word;font-size:0.95rem;line-height:1.45;margin:0 0 12px;';
            panel.appendChild(post);
        }
        var actions = d.createElement('div');
        actions.className = 'bq-share-actions';
        actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';
        if (host.navigator && host.navigator.share) {
            actions.appendChild(actionButton('Share', 'Share', function () { nativeShare(model, land); }));
        }
        actions.appendChild(actionButton('X', 'Share on X', function () {
            host.open(xIntent(model), '_blank', 'noopener,noreferrer');
        }));
        actions.appendChild(actionButton('Telegram', 'Share on Telegram', function () {
            var tg = telegramShare(model);
            host.open('https://t.me/share/url?url=' + encodeURIComponent(tg.url) + '&text=' + encodeURIComponent(tg.text), '_blank', 'noopener,noreferrer');
        }));
        actions.appendChild(actionButton('Facebook', 'Share on Facebook', function () {
            host.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(model.url), '_blank', 'noopener,noreferrer');
        }));
        actions.appendChild(actionButton('Reddit', 'Share on Reddit', function () {
            host.open('https://www.reddit.com/submit?url=' + encodeURIComponent(model.url) + '&title=' + encodeURIComponent(model.title), '_blank', 'noopener,noreferrer');
        }));
        actions.appendChild(actionButton('Nostr', 'Copy Nostr text', function (btn) {
            copyText(shareText(model)).then(function () { btn.textContent = 'Copied'; });
        }));
        actions.appendChild(actionButton('Copy link', 'Copy link', function (btn) {
            copyText(model.url).then(function () { btn.textContent = 'Copied'; });
        }));
        actions.appendChild(actionButton('Download', 'Download image', function () { downloadCanvas(land, 'bitcoin-quest-' + model.type + '.png'); }));
        actions.appendChild(actionButton('Download square', 'Download square image', function () { downloadCanvas(square, 'bitcoin-quest-' + model.type + '-square.png'); }));
        panel.appendChild(actions);
        overlay.appendChild(panel);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) closeSheet(); });
        overlay.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
            if (e.key !== 'Tab') return;
            var nodes = overlay.querySelectorAll('button, a, input');
            if (!nodes.length) return;
            var first = nodes[0];
            var last = nodes[nodes.length - 1];
            if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
        });
        d.body.appendChild(overlay);
        close.focus();
    }

    function closeSheet() {
        var d = doc();
        var el = d && d.getElementById('bqShareSheet');
        if (el) el.remove();
        if (sheetReturn && sheetReturn.focus) {
            try { sheetReturn.focus(); } catch (e) {}
        }
        sheetReturn = null;
        flush();
    }

    function showToast(event) {
        var d = doc();
        if (!d || !d.body) return;
        var old = d.getElementById('bqDailyShareToast');
        if (old) old.remove();
        var user = Object.assign({}, getCurrentUser() || {});
        if (!user.referralCode) user.referralCode = currentCode();
        var model = cardModel(event, user);
        var toast = d.createElement('div');
        toast.id = 'bqDailyShareToast';
        toast.setAttribute('role', 'status');
        toast.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(var(--above-fab, 88px));z-index:' + Z_TOAST + ';max-width:420px;margin:0 auto;background:#14120f;color:#fff;border:1px solid rgba(247,147,26,0.55);border-radius:14px;padding:12px;box-shadow:0 8px 24px rgba(0,0,0,0.35);display:flex;align-items:center;gap:8px;';
        var copy = d.createElement('div');
        copy.style.cssText = 'flex:1;min-width:0;';
        var title = d.createElement('div');
        title.textContent = model.title;
        title.style.cssText = 'font-weight:800;font-size:0.92rem;';
        var sub = d.createElement('div');
        sub.textContent = model.url;
        sub.style.cssText = 'font-size:0.72rem;color:#f7931a;word-break:break-all;margin-top:4px;';
        copy.appendChild(title);
        copy.appendChild(sub);
        toast.appendChild(copy);
        toast.appendChild(actionButton('Share', 'Share daily quests', function () {
            if (toastTimer) clearTimeout(toastTimer);
            toast.remove();
            openSheet(event);
        }));
        toast.appendChild(actionButton('✕', 'Close', function () { toast.remove(); }));
        d.body.appendChild(toast);
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { if (toast.parentNode) toast.remove(); }, 8000);
    }

    function nativeShare(model, canvas) {
        var nav = host.navigator;
        if (!nav || !nav.share) return;
        var payload = nativeSharePayload(model);
        function go(extra) {
            nav.share(Object.assign({}, payload, extra || {})).catch(function () {});
        }
        if (!canvas || !canvas.toBlob || !nav.canShare) { go(); return; }
        canvas.toBlob(function (blob) {
            if (!blob) { go(); return; }
            try {
                var file = new File([blob], 'bitcoin-quest.png', { type: 'image/png' });
                if (nav.canShare({ files: [file] })) go({ files: [file] });
                else go();
            } catch (e) { go(); }
        }, 'image/png');
    }

    function copyText(text) {
        var nav = host.navigator;
        if (nav && nav.clipboard && nav.clipboard.writeText) return nav.clipboard.writeText(text);
        return Promise.resolve();
    }

    function downloadCanvas(canvas, name) {
        if (!canvas || !canvas.toDataURL) return;
        var a = doc().createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = name;
        a.rel = 'noopener';
        doc().body.appendChild(a);
        a.click();
        a.remove();
    }

    function injectCss() {
        var d = doc();
        if (!d || d.getElementById('bqShareCss')) return;
        var style = d.createElement('style');
        style.id = 'bqShareCss';
        style.textContent = '.bq-streak-share,.mobile-bar .bq-streak-share{min-width:44px;min-height:44px;width:44px;height:44px;padding:0;border-radius:10px;border:1px solid #7c2d12;background:#1c0f07;color:#fff7ed;font-size:18px;font-weight:800;line-height:1;cursor:pointer;flex:0 0 44px;display:inline-flex;align-items:center;justify-content:center;font-family:inherit;box-sizing:border-box;}#bqShareSheet button{min-width:44px;min-height:44px;}@media (max-width:360px){#bqShareSheet .bq-share-actions{gap:6px;}}';
        (d.head || d.documentElement).appendChild(style);
    }

    function wrap(name, after) {
        var fn = host[name];
        if (typeof fn !== 'function' || fn._bqShare) return;
        var wrapped = function () {
            var result = fn.apply(this, arguments);
            try { after(); } catch (e) {}
            return result;
        };
        wrapped._bqShare = true;
        try { host[name] = wrapped; } catch (e2) {}
    }

    function hookFns() {
        wrap('updateRankUI', placeStreakButtons);
        wrap('_paintDailyXpMeter', placeStreakButtons);
        wrap('showSettingsPage', injectSettings);
        wrap('showBadgeToast', decorateBadges);
    }

    function onProfile(data) {
        data = data || {};
        if (!seeded) {
            seeded = true;
            prevProfile = data;
            mergeShown(data.shareCardsShown || '', state);
            placeStreakButtons();
            return;
        }
        var events = diffServerProfile(prevProfile, data, {
            distribution: liveDistribution(),
            catalog: liveCatalog(),
            today: questDay(),
            now: Date.now()
        });
        prevProfile = data;
        mergeShown(data.shareCardsShown || '', state);
        events.forEach(consider);
        placeStreakButtons();
    }

    function stopProfileWatch() {
        if (typeof unsubProfile === 'function') {
            try { unsubProfile(); } catch (e) {}
        }
        unsubProfile = null;
    }

    function startWatch() {
        if (previewing) return false;
        var liveAuth = getAuth();
        var liveDb = getDb();
        if (!liveAuth || !liveDb || typeof liveAuth.onAuthStateChanged !== 'function') return false;
        if (startWatch.armed) return true;
        startWatch.armed = true;
        liveAuth.onAuthStateChanged(function (user) {
            if (!user || user.isAnonymous) {
                stopProfileWatch();
                watchUid = '';
                seeded = false;
                prevProfile = null;
                return;
            }
            if (watchUid === user.uid && unsubProfile) return;
            stopProfileWatch();
            watchUid = user.uid;
            seeded = false;
            prevProfile = null;
            try {
                unsubProfile = liveDb.collection('users').doc(user.uid).onSnapshot(function (snap) {
                    onProfile((snap && snap.data && snap.data()) || {});
                }, function () {});
            } catch (e) {}
        });
        return true;
    }

    function maybePreview() {
        var loc = host.location;
        if (!loc) return;
        var hostName = loc.hostname;
        if (hostName !== 'localhost' && hostName !== '127.0.0.1') return;
        var params;
        try { params = new URLSearchParams(loc.search || ''); } catch (e) { return; }
        var mode = params.get('bqSharePreview');
        if (!mode) return;
        previewing = true;
        previewUser = previewUser || {
            username: 'Bitcoiner',
            streak: 30,
            points: 2500,
            referralCode: 'bqshare1',
            certPassed_prop: true,
            certPassed_tech: true
        };
        if (previewUser.streak == null) previewUser.streak = 30;
        placeStreakButtons();
        var days = serverStreak();
        if (mode === 'toast') {
            showToast({ type: 'daily', id: 'daily:preview', kind: 'toast', days: days, title: 'Daily quests done 🔥 day ' + days + ' streak', code: 'bqshare1' });
            return;
        }
        if (mode === 'streak') {
            var meter = doc().getElementById('dailyXpMeter');
            if (meter && meter.scrollIntoView) meter.scrollIntoView({ block: 'center' });
            return;
        }
        if (mode === 'card') {
            showCardStage(days);
            return;
        }
        openSheet({
            type: 'rank',
            id: 'rank:maxi',
            title: 'Maxi',
            days: days,
            manual: true,
            code: 'bqshare1'
        });
    }

    function showCardStage(days) {
        var d = doc();
        var model = cardModel({
            type: 'streak',
            days: days,
            title: '🔥 ' + days + '-day streak on Bitcoin Quest',
            code: 'bqshare1'
        }, getCurrentUser());
        var stage = d.createElement('div');
        stage.id = 'bqCardStage';
        stage.style.cssText = 'position:relative;z-index:30;background:#0b0b0d;color:#fff;padding:16px;display:flex;flex-direction:column;gap:16px;';
        ['landscape', 'square'].forEach(function (size) {
            var cap = d.createElement('div');
            cap.textContent = size === 'square' ? 'Square' : 'Landscape';
            cap.style.cssText = 'font-weight:700;color:#f7931a;';
            var canvas = d.createElement('canvas');
            canvas.setAttribute('data-bq-card', size);
            canvas.style.cssText = size === 'square' ? 'width:min(100%,540px);height:auto;border-radius:12px;' : 'width:min(100%,720px);height:auto;border-radius:12px;';
            drawCard(canvas, model, size);
            stage.appendChild(cap);
            stage.appendChild(canvas);
        });
        d.body.insertBefore(stage, d.body.firstChild);
    }

    function install(win) {
        host = win || host;
        if (!doc() || install.done) return;
        install.done = true;
        state = loadState();
        injectCss();
        hookFns();
        placeStreakButtons();
        maybePreview();
        var scanTimer = 0;
        function scheduleScan() {
            if (scanTimer) return;
            scanTimer = setTimeout(function () {
                scanTimer = 0;
                try {
                    placeStreakButtons();
                    decorateBadges();
                    flush();
                } catch (e) {}
            }, 50);
        }
        if (typeof host.MutationObserver === 'function' && doc() && doc().body) {
            var observer = new host.MutationObserver(function () { scheduleScan(); });
            observer.observe(doc().body, { childList: true, subtree: true });
        }
        setInterval(function () {
            hookFns();
            startWatch();
            flush();
        }, 5000);
        startWatch();
    }

    return {
        SHARE_TYPES: SHARE_TYPES,
        LONG_STREAKS: LONG_STREAKS,
        NOTABLE_RANKS: NOTABLE_RANKS,
        RARITY_THRESHOLDS: RARITY_THRESHOLDS,
        STREAK_PLACES: STREAK_PLACES,
        CTA: CTA,
        SHARE_LINE: SHARE_LINE,
        Z_SHEET: Z_SHEET,
        Z_TOAST: Z_TOAST,
        emptyState: emptyState,
        cloneState: cloneState,
        questDay: questDay,
        normalizeMode: normalizeMode,
        modeAllows: modeAllows,
        escapeCardText: escapeCardText,
        displayName: displayName,
        buildShareUrl: buildShareUrl,
        rarityLabel: rarityLabel,
        badgeWorthy: badgeWorthy,
        diffServerProfile: diffServerProfile,
        decideShare: decideShare,
        cardModel: cardModel,
        shareText: shareText,
        nativeSharePayload: nativeSharePayload,
        xIntent: xIntent,
        telegramShare: telegramShare,
        shareResult: shareResult,
        shareGrantsReward: shareGrantsReward,
        clientClaimEvents: clientClaimEvents,
        compactShown: compactShown,
        mergeShown: mergeShown,
        getAuth: getAuth,
        getDb: getDb,
        getCurrentUser: getCurrentUser,
        detectBusy: detectBusy,
        pickQueued: pickQueued,
        bindHost: function (win) { host = win || {}; },
        resetState: function () { state = emptyState(); },
        acceptEvents: function (events) { (events || []).forEach(consider); },
        currentState: function () { return cloneState(state); },
        closeSheet: closeSheet,
        openLinkSheet: openLinkSheet,
        serverStreak: serverStreak,
        drawCard: drawCard,
        install: install
    };
});
