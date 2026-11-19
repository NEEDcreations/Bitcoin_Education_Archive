// Citadel shop (client only). Lazy-loaded with quests.js and drawn into the
// Quest Hub Citadel tab. Everyone can see it. Only Premium members can buy or
// build. The server is the authority for Premium, prices, the weekly OrangeTix
// cap, part ownership, account age and the referral-week flag; this file only
// shows what it is told and calls the callables listed in NOTES.md.
(function () {
    'use strict';
    if (window.CitadelShop) return;

    var CONFIG = {
        WEEKLY_CAP_OT: 120,
        BATTLE_LINE: 'Paying never changes who wins a battle.',
        FLAG_DOC: 'citadelShop', // config/citadelShop, public read
        // TODO(phil): progress label. 'stages' shows "7 / 15 stages" (spec
        // default); 'parts' shows complete part types, "3 / 5 parts".
        PROGRESS_LABEL_MODE: 'stages',
        // TODO(phil): parts after Premium lapses. 'keep_paused' keeps bought
        // stages on show with buying paused until renewal (spec recommends);
        // 'hide' hides bought stages while lapsed.
        LAPSED_PARTS_MODE: 'keep_paused',
        // TODO(phil): can OrangeTix earned before Jan 3, 2027 be spent on
        // parts? true matches the Rewards recommendation. Client copy only;
        // the server decides the spendable balance.
        PRE_JAN3_OT_SPENDABLE: true,
        // TODO(phil): minimum account age in days to buy parts. 7 matches the
        // spec question; 0 turns the client notice off. Server enforces.
        MIN_ACCOUNT_AGE_DAYS: 7,
        // TODO(phil): cosmetics tab here or Nook only. false keeps cosmetics in
        // the Nook and only mentions them in copy (spec default).
        COSMETICS_TAB: false
    };

    // Feature flags. Defaults are the live values. Staging can switch them on
    // in config/citadelShop; a read error keeps the defaults.
    var DEFAULT_FLAGS = { referralWeekPremiumBuy: false };
    var flags = { referralWeekPremiumBuy: false };

    // Draft catalog (Rewards draft, Nov 19, 2026). Server owns the real prices.
    var PARTS = [
        { id: 'walls',  name: 'Walls',            stages: 4, price: 75,  icon: 'brick' },
        { id: 'turret', name: 'Lightning Turret', stages: 2, price: 100, icon: 'zap' },
        { id: 'vault',  name: 'Vault',            stages: 2, price: 120, icon: 'vault' },
        { id: 'tower',  name: 'Node Tower',       stages: 3, price: 100, icon: 'radio' },
        { id: 'keep',   name: 'Keep',             stages: 4, price: 115, icon: 'castle' }
    ];
    var TOTAL_STAGES = 15;

    // The 5 lesson parts. Free and Premium players both earn and keep them.
    // Building with them is Premium-only. TODO(rufus): the lesson that grants
    // each part is not in the spec or repo yet (lesson: null).
    var LESSON_PARTS = [
        { id: 'lesson_walls',  part: 'walls',  name: 'Walls cornerstone',     lesson: null },
        { id: 'lesson_turret', part: 'turret', name: 'Turret coil',           lesson: null },
        { id: 'lesson_vault',  part: 'vault',  name: 'Vault lock',            lesson: null },
        { id: 'lesson_tower',  part: 'tower',  name: 'Node Tower antenna',    lesson: null },
        { id: 'lesson_keep',   part: 'keep',   name: 'Keep banner',           lesson: null }
    ];

    var CALLABLES = {
        status: 'getCitadelShopStatus',
        buy: 'buyCitadelStage',
        build: 'buildCitadelPart',
        grant: 'claimLessonParts'
    };

    var ICONS = {
        lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
        sparkles: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
        brick: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 9v6"/><path d="M3 15h18"/><path d="M3 9h18"/><path d="M9 3v6"/><path d="M15 15v6"/>',
        zap: '<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"/>',
        vault: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/><path d="m7.9 7.9 2.7 2.7"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/><path d="m13.4 10.6 2.7-2.7"/><circle cx="7.5" cy="16.5" r=".5" fill="currentColor"/><path d="m7.9 16.1 2.7-2.7"/><circle cx="16.5" cy="16.5" r=".5" fill="currentColor"/><path d="m13.4 13.4 2.7 2.7"/><circle cx="12" cy="12" r="2"/>',
        radio: '<path d="M16.247 7.761a6 6 0 0 1 0 8.478"/><path d="M19.075 4.933a10 10 0 0 1 0 14.134"/><path d="M4.925 19.067a10 10 0 0 1 0-14.134"/><path d="M7.753 16.239a6 6 0 0 1 0-8.478"/><circle cx="12" cy="12" r="2"/>',
        castle: '<path d="M10 5V3"/><path d="M14 5V3"/><path d="M15 21v-3a3 3 0 0 0-6 0v3"/><path d="M18 3v8"/><path d="M18 5H6"/><path d="M22 11H2"/><path d="M22 9v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9"/><path d="M6 3v8"/>',
        book: '<path d="M12 5v16"/><path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/>'
    };
    function icon(name, size) {
        return '<svg class="cs-icon" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
    }
    function n(v) { v = Number(v); return isFinite(v) && v > 0 ? Math.floor(v) : 0; }
    function fmt(v) { return n(v).toLocaleString('en-US'); }

    function toMs(t) {
        if (!t) return 0;
        if (typeof t.toMillis === 'function') return t.toMillis();
        if (typeof t.seconds === 'number') return t.seconds * 1000;
        var ms = typeof t === 'number' ? t : Date.parse(t);
        return isFinite(ms) ? ms : 0;
    }

    // Pure: user doc fields + flags -> what the screen shows. No DOM.
    function computeView(user, opt) {
        var u = user || {};
        var f = (opt && opt.flags) || flags;
        var now = (opt && opt.now) || Date.now();
        var c = u.citadel || {};
        var premium = !!(u.premium && u.premium.active === true);
        var lapsed = !premium && !!(u.premium && u.premium.lapsedAt);
        var signedIn = !!(opt && opt.signedIn !== undefined ? opt.signedIn : (u && Object.keys(u).length));
        var stagesIn = c.stages || {};
        var hideOwned = lapsed && CONFIG.LAPSED_PARTS_MODE === 'hide';
        var owned = {};
        var built = 0, partsDone = 0;
        PARTS.forEach(function (p) {
            var have = hideOwned ? 0 : Math.min(n(stagesIn[p.id]), p.stages);
            owned[p.id] = have;
            built += have;
            if (have >= p.stages) partsDone++;
        });
        var cap = n(c.weekCap) || CONFIG.WEEKLY_CAP_OT;
        var spent = Math.min(n(c.weekSpent), cap);
        var remaining = cap - spent;
        var balance = n(u.orangeTickets);
        var ageDays = toMs(u.created) ? (now - toMs(u.created)) / 86400000 : Infinity;
        var tooNew = CONFIG.MIN_ACCOUNT_AGE_DAYS > 0 && ageDays < CONFIG.MIN_ACCOUNT_AGE_DAYS;
        var lessonOwned = c.lessonParts || {};
        var lessonBuilt = c.lessonBuilt || {};

        var parts = PARTS.map(function (p) {
            var have = owned[p.id];
            var done = have >= p.stages;
            var action = 'locked';
            var reason = '';
            if (premium && !done) {
                if (tooNew) { action = 'disabled'; reason = 'account_age'; }
                else if (p.price > remaining) { action = 'disabled'; reason = 'weekly_cap'; }
                else if (p.price > balance) { action = 'disabled'; reason = 'balance'; }
                else action = 'buy';
            } else if (done) action = 'complete';
            return { id: p.id, name: p.name, icon: p.icon, price: p.price, stages: p.stages, have: have, done: done, action: action, reason: reason };
        });
        var lessons = LESSON_PARTS.map(function (lp) {
            var has = lessonOwned[lp.id] === true;
            var isBuilt = lessonBuilt[lp.id] === true;
            var action = !has ? 'not_earned' : (isBuilt ? 'built' : (premium ? 'build' : 'locked'));
            return { id: lp.id, name: lp.name, part: lp.part, owned: has, built: isBuilt, action: action };
        });
        return {
            premium: premium, lapsed: lapsed, signedIn: signedIn,
            showGetPremium: !premium,
            referralWeek: f.referralWeekPremiumBuy === true,
            built: built, partsDone: partsDone,
            progressLabel: CONFIG.PROGRESS_LABEL_MODE === 'parts'
                ? (partsDone + ' / ' + PARTS.length + ' parts')
                : (built + ' / ' + TOTAL_STAGES + ' stages'),
            pct: Math.round(built / TOTAL_STAGES * 100),
            cap: cap, spent: spent, remaining: remaining, atCap: remaining <= 0,
            balance: balance, tooNew: tooNew,
            parts: parts, lessons: lessons
        };
    }

    function partCard(p) {
        var sub = p.done ? (p.price * p.stages) + ' OrangeTix total \u00b7 complete'
            : p.price + ' OrangeTix \u00b7 stage ' + (p.have + 1) + ' of ' + p.stages + ' \u00b7 ' + (p.price * p.stages) + ' total';
        var btn;
        if (p.action === 'locked') {
            btn = '<button class="cs-btn cs-locked" type="button" disabled aria-disabled="true">' + icon('lock', 18) + ' Premium only</button>';
        } else if (p.action === 'complete') {
            btn = '<div class="cs-btn cs-owned">' + icon('check', 18) + ' Complete</div>';
        } else if (p.action === 'disabled') {
            var why = p.reason === 'weekly_cap' ? 'Weekly limit reached' : p.reason === 'account_age' ? 'Account too new' : 'Not enough OrangeTix';
            btn = '<button class="cs-btn cs-locked" type="button" disabled aria-disabled="true" data-reason="' + p.reason + '">' + why + '</button>';
        } else {
            btn = '<button class="cs-btn cs-buy" type="button" data-cs-buy="' + p.id + '" data-stage="' + (p.have + 1) + '">' + icon('ticket', 18) + ' Buy \u00b7 ' + p.price + ' OrangeTix</button>';
        }
        return '<article class="cs-card" data-part="' + p.id + '"><div class="cs-card-top"><div class="cs-part-icon">' + icon(p.icon, 22) + '</div>' +
            '<div><h3>' + p.name + '</h3><div class="cs-sub">' + sub + '</div></div></div>' + btn + '</article>';
    }

    function lessonRow(l) {
        var right;
        if (!l.owned) right = '<span class="cs-dim">Finish its lesson to earn it</span>';
        else if (l.action === 'built') right = '<div class="cs-btn cs-owned cs-small">' + icon('check', 16) + ' Built</div>';
        else if (l.action === 'build') right = '<button class="cs-btn cs-buy cs-small" type="button" data-cs-build="' + l.id + '">Build</button>';
        else right = '<button class="cs-btn cs-locked cs-small" type="button" disabled aria-disabled="true">' + icon('lock', 16) + ' Premium only</button>';
        return '<div class="cs-row" data-lesson="' + l.id + '"><div class="cs-part-icon cs-sm">' + icon('book', 18) + '</div>' +
            '<div class="cs-row-name">' + l.name + (l.owned ? '<span class="cs-tag" data-earned="1">Owned, earned from lessons</span>' : '') + '</div>' + right + '</div>';
    }

    function renderHtml(v) {
        var h = '<div class="bq-cshop">';
        h += '<section class="cs-panel" aria-label="Citadel progress"><div class="cs-prow"><div class="cs-plabel">' + v.progressLabel + '</div>' +
            '<div class="cs-meta">' + (v.premium
                ? fmt(v.balance) + ' OrangeTix, ' + v.spent + ' / ' + v.cap + ' used this week'
                : 'Premium unlocks buying') + '</div></div>' +
            '<div class="cs-track" role="progressbar" aria-valuemin="0" aria-valuemax="' + TOTAL_STAGES + '" aria-valuenow="' + v.built + '" aria-label="Citadel stages built"><div class="cs-fill" style="width:' + v.pct + '%"></div></div>';
        if (v.premium || v.built > 0) {
            h += '<div class="cs-breakdown">' + v.parts.map(function (p) { return '<div><b>' + p.name + '</b> ' + p.have + ' / ' + p.stages + '</div>'; }).join('') + '</div>' +
                '<p class="cs-note">A basic Citadel is 15 stages across five parts. Parts are paid with OrangeTix you\u2019ve earned. Paying never speeds up collecting parts.</p>';
        }
        if (v.premium) {
            h += '<p class="cs-note" data-cs-remaining="' + v.remaining + '">' + (v.atCap
                ? 'You\u2019ve used this week\u2019s ' + v.cap + ' OrangeTix for parts. Buying opens again next week.'
                : v.remaining + ' OrangeTix left for parts this week.') + '</p>';
            if (v.tooNew) h += '<p class="cs-note">Parts buying opens when your account is ' + CONFIG.MIN_ACCOUNT_AGE_DAYS + ' days old.</p>';
        }
        if (v.lapsed && CONFIG.LAPSED_PARTS_MODE === 'keep_paused') h += '<p class="cs-note">Your parts are kept. Buying and building pause until Premium is renewed.</p>';
        h += '</section>';

        if (v.showGetPremium) {
            h += '<section class="cs-panel cs-cta" id="csGetPremium"><div class="cs-kicker">Premium</div>' +
                '<p class="cs-copy">Unlock buying Citadel parts and cosmetics. Plans from $5 a month, $50 a year, or Founders\u2019 Lifetime for $150 (500 seats). Embers and Citadel cosmetics start January 3, 2027 at 12:00 AM ET. Your other Premium perks start when you buy.</p>' +
                (v.referralWeek ? '<p class="cs-copy" data-cs-referral="1">Referral week: Premium can be bought here this week.</p>' : '') +
                '<button class="cs-btn cs-primary" type="button" data-cs-premium="1">' + icon('sparkles', 18) + ' Get Premium</button></section>';
        }

        h += '<div class="cs-head"><h2>Lesson parts</h2><span class="cs-hint">Earned from lessons, kept for good</span></div>' +
            '<section class="cs-panel cs-list">' + v.lessons.map(lessonRow).join('') +
            (v.premium ? '' : '<p class="cs-note">Building with lesson parts needs Premium. <button class="cs-link" type="button" data-cs-premium="1">Get Premium</button></p>') + '</section>';

        h += '<div class="cs-head"><h2>Parts shop</h2><span class="cs-hint">Draft prices, OrangeTix</span></div>' +
            '<div class="cs-grid">' + v.parts.map(partCard).join('') + '</div>';

        h += '<div class="cs-head"><h2>Parts inventory</h2><span class="cs-hint">Your built stages</span></div><section class="cs-panel">';
        if (v.built === 0) {
            h += '<div class="cs-empty"><strong>No parts yet</strong>When you buy a stage with OrangeTix you\u2019ve earned, it will show up here.</div>';
        } else {
            h += '<div class="cs-list">' + v.parts.map(function (p) {
                return '<div class="cs-row"><div class="cs-part-icon cs-sm">' + icon(p.icon, 18) + '</div><div class="cs-row-name">' + p.name + '</div><div class="cs-count">' + p.have + ' / ' + p.stages + '</div></div>';
            }).join('') + '</div>';
        }
        h += '</section>';
        if (CONFIG.COSMETICS_TAB) h += '<div class="cs-head"><h2>Cosmetics</h2><span class="cs-hint">Looks only</span></div><section class="cs-panel"><div class="cs-empty">Coming soon.</div></section>';
        h += '<p class="cs-foot">Changing your Lightning address stays free and is not sold here. Citadel cosmetics are for looks only. There is no parts bonus for Premium.</p>' +
            '<p class="cs-foot" data-cs-battle="1">' + CONFIG.BATTLE_LINE + '</p></div>';
        return h;
    }

    var STYLE = [
        '.bq-cshop{--cs-surface:var(--bg-side,#0f172a);--cs-bg:var(--bg,#020617);--cs-dim:#94a3b8;--cs-accent:#F7931A;--cs-accent-fg:#1A1208;--cs-glow:rgba(247,147,26,0.30);--cs-ok:#22c55e;text-align:left;padding:4px 0 16px;}',
        '[data-theme="light"] .bq-cshop{--cs-surface:#ffffff;--cs-bg:#f8fafc;--cs-dim:#475569;--cs-glow:rgba(194,65,12,0.18);--cs-ok:#15803d;}',
        '.bq-cshop .cs-icon{display:inline-block;flex-shrink:0;vertical-align:middle;}',
        '.bq-cshop .cs-panel{background:var(--cs-surface);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:16px;}',
        '.bq-cshop .cs-prow{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:10px;flex-wrap:wrap;}',
        '.bq-cshop .cs-plabel{font-size:1rem;font-weight:800;color:var(--heading);}',
        '.bq-cshop .cs-meta,.bq-cshop .cs-hint,.bq-cshop .cs-dim{font-size:0.75rem;font-weight:700;color:var(--cs-dim);}',
        '.bq-cshop .cs-track{position:relative;height:12px;background:var(--cs-bg);border-radius:99px;overflow:hidden;}',
        '.bq-cshop .cs-fill{position:absolute;left:0;top:0;bottom:0;background:var(--cs-accent);border-radius:99px;}',
        '.bq-cshop .cs-breakdown{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin-top:12px;font-size:0.75rem;color:var(--text);}',
        '.bq-cshop .cs-breakdown b{color:var(--heading);}',
        '.bq-cshop .cs-note,.bq-cshop .cs-foot{margin:10px 0 0;font-size:0.75rem;line-height:1.45;color:var(--cs-dim);}',
        '.bq-cshop .cs-kicker{font-size:0.75rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--cs-dim);margin-bottom:6px;}',
        '.bq-cshop .cs-copy{font-size:0.875rem;line-height:1.45;color:var(--text);margin:0 0 12px;}',
        '.bq-cshop .cs-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:8px 0 10px;}',
        '.bq-cshop .cs-head h2{font-size:1.05rem;font-weight:800;color:var(--heading);margin:0;}',
        '.bq-cshop .cs-grid{display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:18px;}',
        '@media (min-width:901px){.bq-cshop .cs-grid{grid-template-columns:1fr 1fr;}.bq-cshop .cs-breakdown{grid-template-columns:repeat(3,1fr);}}',
        '.bq-cshop .cs-card{background:var(--cs-surface);border:1px solid var(--border);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:10px;}',
        '.bq-cshop .cs-card-top{display:flex;align-items:flex-start;gap:10px;}',
        '.bq-cshop .cs-card h3{font-size:1rem;font-weight:800;color:var(--heading);margin:0;}',
        '.bq-cshop .cs-sub{font-size:0.75rem;color:var(--cs-dim);margin-top:2px;}',
        '.bq-cshop .cs-part-icon{width:44px;height:44px;border-radius:12px;background:var(--cs-bg);border:1px solid var(--border);color:var(--cs-dim);display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
        '.bq-cshop .cs-part-icon.cs-sm{width:36px;height:36px;border-radius:10px;}',
        '.bq-cshop .cs-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:44px;padding:10px 14px;border-radius:12px;font:inherit;font-weight:800;font-size:0.875rem;box-sizing:border-box;}',
        '.bq-cshop .cs-btn.cs-small{width:auto;flex-shrink:0;}',
        '.bq-cshop .cs-locked{background:var(--cs-bg);color:var(--text);border:1px solid var(--border);cursor:not-allowed;}',
        '.bq-cshop .cs-locked .cs-icon{color:var(--cs-dim);}',
        '.bq-cshop .cs-buy,.bq-cshop .cs-primary{background:var(--cs-accent);color:var(--cs-accent-fg);border:none;cursor:pointer;box-shadow:0 4px 16px var(--cs-glow);}',
        '.bq-cshop .cs-primary{border-radius:14px;font-size:1rem;}',
        '.bq-cshop .cs-owned{background:transparent;color:var(--text);border:1px solid var(--border);}',
        '.bq-cshop .cs-owned .cs-icon{color:var(--cs-ok);}',
        '.bq-cshop .cs-list{display:flex;flex-direction:column;gap:8px;}',
        '.bq-cshop .cs-row{display:flex;align-items:center;gap:10px;min-height:44px;padding:8px 10px;background:var(--cs-bg);border:1px solid var(--border);border-radius:12px;}',
        '.bq-cshop .cs-row-name{flex:1;font-size:0.875rem;font-weight:800;color:var(--heading);}',
        '.bq-cshop .cs-tag{display:block;font-size:0.75rem;font-weight:700;color:var(--cs-dim);}',
        '.bq-cshop .cs-count{font-size:0.875rem;font-weight:800;color:var(--text);}',
        '.bq-cshop .cs-empty{text-align:center;padding:20px 12px;color:var(--cs-dim);font-size:0.875rem;line-height:1.5;}',
        '.bq-cshop .cs-empty strong{display:block;color:var(--heading);font-size:1rem;margin-bottom:6px;}',
        '.bq-cshop .cs-link{background:none;border:none;padding:0 2px;min-height:44px;color:var(--text);font:inherit;font-weight:800;text-decoration:underline;cursor:pointer;}'
    ].join('\n');

    function ensureStyle() {
        if (document.getElementById('bqCitadelShopStyle')) return;
        var s = document.createElement('style');
        s.id = 'bqCitadelShopStyle';
        s.textContent = STYLE;
        document.head.appendChild(s);
    }

    function user() { return (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null; }
    function toast(msg) { if (typeof showToast === 'function') showToast(msg); }
    function callable(name) {
        return (typeof firebase !== 'undefined' && firebase.functions) ? firebase.functions().httpsCallable(name) : null;
    }
    function reqId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }

    function applyStatus(d) {
        var u = user();
        if (!u || !d) return;
        u.citadel = u.citadel || {};
        if (d.stages) u.citadel.stages = d.stages;
        if (d.lessonParts) u.citadel.lessonParts = d.lessonParts;
        if (d.lessonBuilt) u.citadel.lessonBuilt = d.lessonBuilt;
        if (typeof d.weekSpent === 'number') u.citadel.weekSpent = d.weekSpent;
        if (typeof d.weekCap === 'number') u.citadel.weekCap = d.weekCap;
        if (typeof d.newTickets === 'number') u.orangeTickets = d.newTickets;
    }

    function openPremium() {
        var src = flags.referralWeekPremiumBuy === true ? 'referral_week' : 'citadel';
        if (typeof window.bqOpenPremium === 'function') { window.bqOpenPremium({ source: src }); return; }
        window.location.href = '/?premium=buy';
    }

    var _body = null;
    function draw() {
        if (!_body) return;
        _body.innerHTML = renderHtml(computeView(user() || {}, { signedIn: !!user() }));
    }

    function runAction(name, payload, btn) {
        var fn = callable(name);
        if (!fn) { toast('Shop unavailable, no connection'); return; }
        if (btn) btn.disabled = true;
        fn(payload).then(function (r) {
            var d = r && r.data;
            if (d && d.success) { applyStatus(d); if (typeof updateRankUI === 'function') updateRankUI(); }
            else toast((d && d.message) || 'Something went wrong');
            draw();
        }).catch(function (err) {
            toast((err && err.message) ? err.message : 'Something went wrong');
            if (btn) btn.disabled = false;
        });
    }

    function onClick(e) {
        var t = e.target && e.target.closest ? e.target.closest('[data-cs-premium],[data-cs-buy],[data-cs-build]') : null;
        if (!t || !_body || !_body.contains(t)) return;
        if (t.hasAttribute('data-cs-premium')) { openPremium(); return; }
        var u = user();
        if (!u || !(u.premium && u.premium.active === true)) { openPremium(); return; }
        if (t.hasAttribute('data-cs-buy')) {
            runAction(CALLABLES.buy, { partId: t.getAttribute('data-cs-buy'), stage: Number(t.getAttribute('data-stage')), requestId: reqId() }, t);
        } else if (t.hasAttribute('data-cs-build')) {
            runAction(CALLABLES.build, { lessonPartId: t.getAttribute('data-cs-build'), requestId: reqId() }, t);
        }
    }

    function loadFlags() {
        if (typeof firebase === 'undefined' || !firebase.firestore) return Promise.resolve(flags);
        return firebase.firestore().collection('config').doc(CONFIG.FLAG_DOC).get().then(function (snap) {
            var d = snap && snap.exists ? snap.data() : {};
            flags = { referralWeekPremiumBuy: d.referralWeekPremiumBuy === true };
            return flags;
        }).catch(function () { flags = { referralWeekPremiumBuy: DEFAULT_FLAGS.referralWeekPremiumBuy }; return flags; });
    }

    function refresh() {
        var u = user();
        var signedInReal = typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous;
        var grant = signedInReal ? callable(CALLABLES.grant) : null;
        var status = u ? callable(CALLABLES.status) : null;
        // Grant is idempotent server-side, so asking on every open is safe.
        var p = grant ? grant({}).then(function (r) { applyStatus(r && r.data); }).catch(function () {}) : Promise.resolve();
        return p.then(function () {
            return status ? status({}).then(function (r) { applyStatus(r && r.data); }).catch(function () {}) : null;
        }).then(draw);
    }

    function render(body) {
        if (!body) return;
        ensureStyle();
        _body = body;
        if (!body._csBound) { body.addEventListener('click', onClick); body._csBound = true; }
        draw();
        loadFlags().then(draw);
        refresh();
    }

    window.CitadelShop = {
        render: render,
        computeView: computeView,
        renderHtml: renderHtml,
        CONFIG: CONFIG,
        DEFAULT_FLAGS: DEFAULT_FLAGS,
        PARTS: PARTS,
        LESSON_PARTS: LESSON_PARTS,
        CALLABLES: CALLABLES,
        openPremium: openPremium
    };
})();
