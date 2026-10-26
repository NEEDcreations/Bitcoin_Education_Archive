// Homepage Today card. Paint-only: reads existing local state and opens
// the same screens the Quest Hub used to. The XP meter shows the server total.
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
        var user = (typeof currentUser !== 'undefined' && currentUser) || window.currentUser;
        var server = (user && user.lastSpinDate) ? String(user.lastSpinDate) : '';
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
        var user = (typeof currentUser !== 'undefined' && currentUser) || window.currentUser;
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

    function flexGoal() {
        return Math.min(5, FLEX_IDS.length);
    }

    function flexCount() {
        var n = window._todayFlexCount;
        if (typeof n !== 'number' || !isFinite(n) || n < 0) return 0;
        return Math.floor(n);
    }

    // Count comes from users/{uid}/daily_action_counts/{offsetDay}_flex.
    function paintFlex() {
        var goal = flexGoal();
        var count = flexCount();
        var shown = Math.min(count, goal);
        var done = goal > 0 && count >= goal;
        var btn = document.getElementById('todayFlexBtn');
        var label = document.getElementById('todayFlexLabel');
        var sub = document.getElementById('todayFlexSub');
        if (label) label.textContent = 'Flex';
        if (sub) sub.textContent = shown + '/' + goal;
        if (btn) btn.setAttribute('aria-label', 'Flex, ' + shown + ' of ' + goal);
        mark(btn, done);
        return done;
    }

    var flexWatchId = '';
    var flexUnsub = null;

    function flexUid() {
        try {
            if (typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
                return auth.currentUser.uid;
            }
        } catch (e) {}
        return '';
    }

    function watchFlexCount() {
        if (window._todayStubUser) return;
        var uid = flexUid();
        var canRead = uid && typeof db !== 'undefined' && db && typeof firebase !== 'undefined' && firebase.firestore;
        if (!canRead) {
            if (flexUnsub) {
                try { flexUnsub(); } catch (e) {}
                flexUnsub = null;
            }
            flexWatchId = '';
            if (window._todayFlexCount !== 0) {
                window._todayFlexCount = 0;
                if (window._paintTodayCard) window._paintTodayCard();
            }
            return;
        }
        var id = uid + '/' + todayKey();
        if (flexWatchId === id && flexUnsub) return;
        if (flexUnsub) {
            try { flexUnsub(); } catch (e2) {}
            flexUnsub = null;
        }
        flexWatchId = id;
        var day = todayKey();
        try {
            flexUnsub = db.collection('users').doc(uid).collection('daily_action_counts').doc(day + '_flex').onSnapshot(function (snap) {
                var n = 0;
                if (snap && snap.exists) {
                    var data = snap.data() || {};
                    n = parseInt(data.count, 10);
                    if (isNaN(n) || n < 0) n = 0;
                }
                window._todayFlexCount = n;
                if (window._paintTodayCard) window._paintTodayCard();
            }, function () {
                window._todayFlexCount = 0;
                if (window._paintTodayCard) window._paintTodayCard();
            });
        } catch (e3) {
            flexWatchId = '';
        }
    }

    window._noteTodayFlexCount = function (n) {
        var count = parseInt(n, 10);
        if (isNaN(count) || count < 0) count = 0;
        window._todayFlexCount = count;
        if (window._paintTodayCard) window._paintTodayCard();
    };

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
        var strip = document.getElementById('todayFavorStrip');
        var title = document.getElementById('todayFavorTitle');
        var pointsEl = document.getElementById('todayFavorPoints');
        var cd = document.getElementById('todayFavorCountdown');
        if (!title || !cd) return;
        var info = window._todayFavorInfo;
        // info.active is isFavorEffectivelyActive(): the countdown is running.
        var active = !!(info && info.active);
        if (strip) strip.classList.toggle('is-favor-active', active);
        if (pointsEl) pointsEl.textContent = '';
        if (active) {
            title.textContent = "Satoshi's Favor is LIVE";
            cd.hidden = false;
            cd.dataset.live = '1';
            return;
        }
        delete cd.dataset.live;
        cd.hidden = true;
        cd.textContent = '';
        if (info && signedIn()) title.textContent = "Satoshi's Favor · " + info.points + ' points';
        else title.textContent = "Satoshi's Favor";
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

    var RATE_GUIDE = 'Full rate to 500 XP, half rate to 900, quarter rate to 1,000 cap';

    function meterNumber(snap) {
        var raw = snap.dailyXp != null ? snap.dailyXp : snap.dailyQuizXp;
        var n = Math.round(Number(raw) || 0);
        if (!isFinite(n) || n < 0) n = 0;
        if (n > 1000) n = 1000;
        return n;
    }

    function describeMeter(line) {
        var meter = document.getElementById('dailyXpMeter');
        if (!meter) return;
        var label = line + '. ' + RATE_GUIDE;
        meter.setAttribute('aria-label', label);
        meter.setAttribute('title', label);
        var track = meter.querySelector('.daily-xp-track');
        if (track) track.setAttribute('title', label);
    }

    window._paintDailyXpMeter = function (snap) {
        var text = document.getElementById('dailyXpMeterText');
        var fill = document.getElementById('dailyXpMeterFill');
        if (!text || !fill) return;
        var signed = snap && snap.signedIn !== false && (snap.signedIn === true || signedIn());
        if (!signed) {
            var signedOut = "Sign in to see today's XP";
            text.textContent = signedOut;
            fill.style.width = '0%';
            describeMeter(signedOut);
            return;
        }
        var used = meterNumber(snap || {});
        var line = used.toLocaleString() + '/1000 XP today';
        text.textContent = line;
        fill.style.width = (used / 10) + '%';
        describeMeter(line);
    };

    function loadDailyXpMeter() {
        if (!signedIn()) {
            window._paintDailyXpMeter({ signedIn: false });
            return;
        }
        if (window._serverDailyXp) {
            window._paintDailyXpMeter(Object.assign({ signedIn: true }, window._serverDailyXp));
        } else {
            window._paintDailyXpMeter({ signedIn: true, dailyXp: 0 });
        }
        try {
            if (typeof firebase === 'undefined' || !firebase.functions) return;
            var callable = firebase.functions().httpsCallable('triviaXpStatus');
            callable({}).then(function (res) {
                var data = (res && res.data) || {};
                window._serverDailyXp = data;
                window._paintDailyXpMeter(Object.assign({ signedIn: true }, data));
            }).catch(function () {});
        } catch (e) {}
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
        var sayHiLabel = document.getElementById('sayHiBtnLabel');
        var sayHiSub = document.getElementById('sayHiBtnSub');
        if (sayHiLabel) sayHiLabel.textContent = 'Say hi!';
        if (sayHiSub) sayHiSub.textContent = 'to the community';
        var flex = paintFlex();
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
        loadDailyXpMeter();
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
        watchFlexCount();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    setInterval(function () {
        watchFlexCount();
        if (window._paintTodayCard) window._paintTodayCard();
    }, 20000);
    window.addEventListener('focus', function () {
        watchFlexCount();
        if (window._paintTodayCard) window._paintTodayCard();
    });
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
