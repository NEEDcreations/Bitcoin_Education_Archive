// Homepage Today card. Paint-only: reads existing local state and opens
// the same screens the Quest Hub used to. No rewards, grants, or caps.
(function () {
    'use strict';

    var MORE_KEY = 'btc_today_more_open';
    var FLEX_IDS = ['steak','sunlight','dca','custody','lift','meetup','lightning','read','sleep','nokyc','node','cold','fast','walk','journal','meditate','teach','water','gratitude','verify','focus','risk','pattern','findq','noleverage','gunrange','sellchairs','starebtc','itoldyou','pumpndump'];

    function todayKey() {
        try {
            if (typeof window.getDailyKey === 'function') return window.getDailyKey();
        } catch (e) {}
        return new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
    }

    function safeJSON(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    }

    function signedIn() {
        if (window._todayStubUser) return true;
        try {
            if (typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) return true;
        } catch (e) {}
        return false;
    }

    function promptSignIn() {
        if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
        else if (typeof showSignInPrompt === 'function') showSignInPrompt();
    }

    function quizDone() {
        var key = todayKey();
        var quest = safeJSON('btc_quest_daily', {});
        if (quest && quest.date === key && quest.count >= 1) return true;
        var activities = safeJSON('btc_daily_activities', {});
        return !!(activities && activities.date === key && activities.quiz);
    }

    function triviaDone() {
        var key = todayKey();
        var state = safeJSON('btc_trivia_state', {});
        if (state && state.date === key) return true;
        var activities = safeJSON('btc_daily_activities', {});
        return !!(activities && activities.date === key && activities.trivia);
    }

    function pollDone() {
        var key = todayKey();
        var state = safeJSON('btc_poll_state', {});
        if (state && state.date === key && typeof state.chosen === 'number' && state.chosen >= 0) return true;
        var activities = safeJSON('btc_daily_activities', {});
        return !!(activities && activities.date === key && activities.poll);
    }

    function spinDone() {
        var utc = new Date().toISOString().split('T')[0];
        var offset = todayKey();
        var last = '';
        try { last = localStorage.getItem('btc_last_spin_date') || ''; } catch (e) {}
        if (last === utc || last === offset) return true;
        var server = (window.currentUser && window.currentUser.lastSpinDate) ? String(window.currentUser.lastSpinDate) : '';
        return server === utc || server === offset;
    }

    function watchDone() {
        return window._tctvWatchDoneToday === true;
    }

    function predictDone() {
        var saved = safeJSON('btc_price_prediction', null);
        if (!saved || !saved.time) return false;
        if (saved.resolved || saved.serverScored) return false;
        return true;
    }

    function sayHiDone() {
        var user = window.currentUser;
        return !!(user && user.sayHiClaimedDay === todayKey());
    }

    function mark(el, done) {
        if (!el) return;
        el.classList.toggle('is-done', !!done);
        el.setAttribute('aria-pressed', done ? 'true' : 'false');
    }

    function setDot(id, on) {
        var el = document.getElementById(id);
        if (!el) return;
        el.hidden = !on;
    }

    function raidLive() {
        if (typeof window._raidActiveEndMs === 'number' && window._raidActiveEndMs > Date.now()) return true;
        var card = document.getElementById('raidBossHomeCard');
        return !!(card && /CURRENT RAID BOSS/.test(card.textContent || ''));
    }

    function flexDone() {
        var utc = new Date().toISOString().slice(0, 10);
        var state = safeJSON('btc_flex_state', {});
        for (var i = 0; i < FLEX_IDS.length; i++) {
            var row = state && state[FLEX_IDS[i]];
            if (!row || row.lastDate !== utc) return false;
        }
        return true;
    }

    function storyNeedsAttention() {
        var days = safeJSON('btc_nacho_story_days', []);
        if (!Array.isArray(days)) days = [];
        var today = new Date().toISOString().split('T')[0];
        var dismissed = false;
        try { dismissed = localStorage.getItem('btc_nacho_story_notif_dismissed') === today; } catch (e) {}
        if (dismissed) return false;
        if (!days.length) return true;
        return days.indexOf(today) === -1 && days.length < 7;
    }

    function paintRing(doneCount) {
        var count = document.getElementById('todayTrifectaCount');
        var ring = document.querySelector('#todayTrifectaBtn .today-ring-val');
        var btn = document.getElementById('todayTrifectaBtn');
        if (count) count.textContent = doneCount + '/3';
        if (ring) {
            var p = Math.max(0, Math.min(3, doneCount)) / 3;
            ring.style.strokeDasharray = (p * 94.248).toFixed(3) + ' 94.248';
        }
        if (btn) btn.setAttribute('aria-label', 'Daily Trifecta, ' + doneCount + ' of 3 done. Opens Quiz, Trivia, and Poll.');
        mark(btn, doneCount === 3);
    }

    function paintFavor() {
        var pointsEl = document.getElementById('todayFavorPoints');
        var cd = document.getElementById('todayFavorCountdown');
        if (!pointsEl || !cd) return;
        if (!signedIn()) {
            pointsEl.textContent = 'Earn Favor daily, payouts every epoch';
            cd.hidden = true;
            cd.textContent = '';
            delete cd.dataset.live;
            return;
        }
        var info = window._todayFavorInfo;
        if (!info) {
            pointsEl.textContent = 'Favor points';
            cd.hidden = !cd.dataset.live;
            return;
        }
        pointsEl.textContent = info.points + ' Favor points';
        cd.hidden = false;
        if (info.active) {
            cd.dataset.live = '1';
            return;
        }
        delete cd.dataset.live;
        var remain = Math.max(0, (info.target || 21) - info.points);
        cd.textContent = remain ? (remain + ' to next payout') : 'Payout ready';
    }

    window._paintTodayFavor = function (info) {
        info = info || {};
        window._todayFavorInfo = {
            points: typeof info.points === 'number' ? info.points : 0,
            active: !!info.active,
            target: info.target || 21
        };
        paintFavor();
    };

    function applyMoreState() {
        var open = false;
        try { open = localStorage.getItem(MORE_KEY) === '1'; } catch (e) {}
        var panel = document.getElementById('todayMorePanel');
        var btn = document.getElementById('todayMoreToggle');
        var chev = document.getElementById('todayMoreChevron');
        if (panel) panel.hidden = !open;
        if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (chev) chev.textContent = open ? '\u25B2' : '\u25BC';
    }

    window._paintTodayCard = function () {
        var q = quizDone();
        var t = triviaDone();
        var p = pollDone();
        var tri = (q ? 1 : 0) + (t ? 1 : 0) + (p ? 1 : 0);
        paintRing(tri);
        mark(document.getElementById('todayQuizBtn'), q);
        mark(document.getElementById('todayTriviaBtn'), t);
        mark(document.getElementById('todayPollBtn'), p);
        mark(document.getElementById('nqSpinBtn'), spinDone());
        mark(document.getElementById('tctvWatchBtn'), watchDone());
        var predictLabel = document.getElementById('predAccuracyLabel');
        mark(predictLabel && predictLabel.closest ? predictLabel.closest('button') : null, predictDone());
        mark(document.getElementById('sayHiBtn'), sayHiDone());
        var flex = flexDone();
        mark(document.getElementById('todayFlexBtn'), flex);
        var done = (tri === 3 ? 1 : 0) + (spinDone() ? 1 : 0) + (watchDone() ? 1 : 0) + (predictDone() ? 1 : 0) + (sayHiDone() ? 1 : 0) + (flex ? 1 : 0);
        var counter = document.getElementById('todayDoneCount');
        if (counter) counter.textContent = done + '/6 done today';

        var live = raidLive();
        var raidCadence = document.getElementById('todayCadenceRaid');
        if (raidCadence) raidCadence.textContent = live ? 'Event live' : 'Monthly';
        setDot('todayDotRaid', live);
        setDot('todayDotStory', storyNeedsAttention());
        setDot('todayMoreDot', live || storyNeedsAttention());
        paintFavor();
    };

    window.toggleTodayTrifecta = function () {
        var panel = document.getElementById('todayTrifectaChooser');
        var btn = document.getElementById('todayTrifectaBtn');
        if (!panel) return;
        panel.hidden = !panel.hidden;
        if (btn) btn.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
    };

    window.toggleTodayMore = function () {
        var open = false;
        try { open = localStorage.getItem(MORE_KEY) === '1'; } catch (e) {}
        try { localStorage.setItem(MORE_KEY, open ? '0' : '1'); } catch (e2) {}
        applyMoreState();
    };

    window.openTodayQuest = function (tab, sub) {
        if (tab === 'story') {
            if (typeof showNachoStory === 'function') showNachoStory();
            return;
        }
        if (sub) window._nookSubTab = sub;
        if (typeof window.showQuestHub === 'function') {
            window.showQuestHub(tab);
            return;
        }
        window._pendingQuestTab = tab;
        if (window._loadDeferred) window._loadDeferred();
    };

    window.todayEarnFavor = function () {
        if (!signedIn()) {
            promptSignIn();
            return;
        }
        window.openTodayQuest('favor');
    };

    window._focusTodayCard = function () {
        var home = document.getElementById('home');
        if (home && home.classList.contains('hidden') && typeof goHome === 'function') {
            try { goHome(true); } catch (e) {}
        }
        setTimeout(function () {
            var card = document.getElementById('todayCard');
            if (!card) return;
            card.classList.add('today-highlight');
            card.setAttribute('tabindex', '-1');
            try { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
            catch (e2) { try { card.scrollIntoView(); } catch (e3) {} }
            try { card.focus({ preventScroll: true }); }
            catch (e4) { try { card.focus(); } catch (e5) {} }
            setTimeout(function () { card.classList.remove('today-highlight'); }, 1600);
        }, 60);
    };

    function boot() {
        applyMoreState();
        window._paintTodayCard();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    setInterval(function () { if (window._paintTodayCard) window._paintTodayCard(); }, 20000);
    window.addEventListener('focus', function () { if (window._paintTodayCard) window._paintTodayCard(); });
    window.addEventListener('storage', function () { if (window._paintTodayCard) window._paintTodayCard(); });

    if (!(typeof window.showQuestHub === 'function' && window.showQuestHub._todayReal)) {
        if (typeof window.showQuestHub !== 'function') {
            window.showQuestHub = function (tab) {
                if (typeof tab === 'string' && tab) window._pendingQuestTab = tab;
                if (window._loadDeferred) window._loadDeferred();
                if (typeof tab !== 'string' && window._focusTodayCard) window._focusTodayCard();
            };
        }
    }
})();
