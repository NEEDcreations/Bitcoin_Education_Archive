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

    // Server fields copied off the user doc the app already loads.
    // lastQuizDate / lastTriviaDate / lastPollDate / chatPostedDay use the
    // offset day. lastSpinDate is the UTC day dailySpin writes.
    var serverProfile = null;

    function player() {
        return (typeof currentUser !== 'undefined' && currentUser) || window.currentUser;
    }

    function applyServerProfile(data) {
        serverProfile = data || {};
        var user = player();
        if (!user) return;
        var keys = ['lastQuizDate', 'lastTriviaDate', 'lastPollDate', 'lastSpinDate', 'sayHiClaimedDay', 'chatPostedDay'];
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (Object.prototype.hasOwnProperty.call(serverProfile, key)) user[key] = serverProfile[key];
        }
    }

    function serverField(name) {
        var user = player();
        if (user && user[name] != null && user[name] !== '') return user[name];
        if (serverProfile && serverProfile[name] != null && serverProfile[name] !== '') return serverProfile[name];
        return '';
    }

    function quizDone() {
        return String(serverField('lastQuizDate')) === todayKey();
    }

    function triviaDone() {
        return String(serverField('lastTriviaDate')) === todayKey();
    }

    function pollDone() {
        return String(serverField('lastPollDate')) === todayKey();
    }

    function spinDone() {
        var utc = new Date().toISOString().split('T')[0];
        var offset = todayKey();
        var server = String(serverField('lastSpinDate') || '');
        return server === utc || server === offset;
    }

    function watchDone() {
        return window._tctvWatchDoneToday === true;
    }

    function sayHiDone() {
        var day = todayKey();
        if (String(serverField('sayHiClaimedDay')) === day) return true;
        if (String(serverField('chatPostedDay')) === day) return true;
        return window._todayChatPostedDay === day;
    }

    window._noteTodayChatPosted = function () {
        var day = todayKey();
        window._todayChatPostedDay = day;
        var user = player();
        if (user) user.chatPostedDay = day;
        if (!serverProfile) serverProfile = {};
        serverProfile.chatPostedDay = day;
        if (window._paintTodayCard) window._paintTodayCard({ tilesOnly: true });
    };

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
        if (btn) btn.setAttribute('aria-label', done ? ('Flex, ' + shown + ' of ' + goal + ', completed') : ('Flex, ' + shown + ' of ' + goal));
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
        if (btn) {
            var triLabel = 'Daily Trifecta, ' + doneCount + ' of 3';
            if (doneCount === 3) triLabel += ', completed';
            btn.setAttribute('aria-label', triLabel + '. Opens Quiz, Trivia, and Poll.');
        }
        mark(btn, doneCount === 3);
    }

    function paintFavor() {
        var strip = document.getElementById('todayFavorStrip');
        var title = document.getElementById('todayFavorTitle');
        var earn = document.getElementById('todayEarnFavor');
        var pointsEl = document.getElementById('todayFavorPoints');
        var cd = document.getElementById('todayFavorCountdown');
        if (!title || !cd) return;
        var info = window._todayFavorInfo;
        // info.active is isFavorEffectivelyActive(): the countdown is running.
        var active = !!(info && info.active);
        if (strip) strip.classList.toggle('is-favor-active', active);
        if (earn) earn.classList.toggle('is-favor-active', active);
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

    function predictPending(stats) {
        if (!stats || !stats.predPending || !stats.predPending.time) return false;
        var last = stats.predLastResult;
        var pendingTime = Number(stats.predPending.time);
        if (last && Number(last.time) === pendingTime) return false;
        return true;
    }

    function predictDone() {
        // predPending is the server copy. _todayPredictConfirmed is the
        // active_predictions doc after the write is no longer pending.
        if (window._todayPredictConfirmed === true) return true;
        return predictPending(window._todayPredStats);
    }

    function setSub(id, text) {
        var el = document.getElementById(id);
        if (!el) return;
        el.textContent = text;
    }

    function paintTiles() {
        var q = quizDone();
        var t = triviaDone();
        var p = pollDone();
        var tri = (q ? 1 : 0) + (t ? 1 : 0) + (p ? 1 : 0);
        paintRing(tri);
        mark(document.getElementById('todayQuizBtn'), q);
        mark(document.getElementById('todayTriviaBtn'), t);
        mark(document.getElementById('todayPollBtn'), p);
        var spun = spinDone();
        var spinBtn = document.getElementById('nqSpinBtn');
        mark(spinBtn, spun);
        if (spinBtn) spinBtn.setAttribute('aria-label', spun ? 'Daily Spin, completed' : 'Daily Spin');
        setSub('nqSpinSub', spun ? 'Done' : '');
        var watched = watchDone();
        var watchBtn = document.getElementById('tctvWatchBtn');
        mark(watchBtn, watched);
        if (watchBtn && watched) watchBtn.setAttribute('aria-label', 'Watch Timechain TV, completed');
        var predicted = predictDone();
        var predictBtn = document.getElementById('todayPredictBtn');
        if (!predictBtn) {
            var predictLabel = document.getElementById('predAccuracyLabel');
            predictBtn = predictLabel && predictLabel.closest ? predictLabel.closest('button') : null;
        }
        mark(predictBtn, predicted);
        if (predictBtn) predictBtn.setAttribute('aria-label', predicted ? 'Predict Price, completed' : 'Predict Price');
        if (predicted) setSub('predAccuracyLabel', 'Done');
        else {
            var predSub = document.getElementById('predAccuracyLabel');
            if (predSub && predSub.textContent === 'Done') predSub.textContent = '';
        }
        var saidHi = sayHiDone();
        var sayHiBtn = document.getElementById('sayHiBtn');
        mark(sayHiBtn, saidHi);
        var sayHiLabel = document.getElementById('sayHiBtnLabel');
        if (sayHiLabel) sayHiLabel.textContent = 'Say hi!';
        setSub('sayHiBtnSub', saidHi ? 'Done' : 'to the community');
        if (sayHiBtn) sayHiBtn.setAttribute('aria-label', saidHi ? 'Say hi, completed' : 'Say hi!');
        var flex = paintFlex();
        var done = (tri === 3 ? 1 : 0) + (spun ? 1 : 0) + (watched ? 1 : 0) + (predicted ? 1 : 0) + (saidHi ? 1 : 0) + (flex ? 1 : 0);
        var counter = document.getElementById('todayDoneCount');
        if (counter) counter.textContent = done + '/6 done today';
    }

    window._paintTodayCard = function (opts) {
        paintTiles();
        if (opts && opts.tilesOnly) return;

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

    var userWatchId = '';
    var userUnsub = null;
    var predWatchId = '';
    var predUnsub = null;

    function stopWatch(unsub) {
        if (typeof unsub === 'function') {
            try { unsub(); } catch (e) {}
        }
        return null;
    }

    // One user-doc listener covers quiz, trivia, poll, spin, and Say hi.
    // The home page already reads this doc in loadUser.
    function watchUserDoc() {
        if (window._todayStubUser) return;
        var uid = flexUid();
        var canRead = uid && typeof db !== 'undefined' && db && typeof firebase !== 'undefined' && firebase.firestore;
        if (!canRead) {
            userUnsub = stopWatch(userUnsub);
            userWatchId = '';
            if (serverProfile) {
                serverProfile = null;
                window._todayChatPostedDay = '';
                if (window._paintTodayCard) window._paintTodayCard({ tilesOnly: true });
            }
            return;
        }
        if (userWatchId === uid && userUnsub) return;
        userUnsub = stopWatch(userUnsub);
        userWatchId = uid;
        try {
            userUnsub = db.collection('users').doc(uid).onSnapshot(function (snap) {
                applyServerProfile((snap && snap.exists && snap.data()) || {});
                if (window._paintTodayCard) window._paintTodayCard({ tilesOnly: true });
            }, function () {});
        } catch (e) {
            userWatchId = '';
        }
    }

    // prediction_stats is the doc updatePredictionLabel already reads.
    function watchPredict() {
        if (window._todayStubUser) return;
        var uid = flexUid();
        var canRead = uid && typeof db !== 'undefined' && db && typeof firebase !== 'undefined' && firebase.firestore;
        if (!canRead) {
            predUnsub = stopWatch(predUnsub);
            predWatchId = '';
            if (window._todayPredStats || window._todayPredictConfirmed) {
                window._todayPredStats = null;
                window._todayPredictConfirmed = false;
                if (window._paintTodayCard) window._paintTodayCard({ tilesOnly: true });
            }
            return;
        }
        if (predWatchId === uid && predUnsub) return;
        predUnsub = stopWatch(predUnsub);
        predWatchId = uid;
        try {
            predUnsub = db.collection('prediction_stats').doc(uid).onSnapshot(function (snap) {
                window._todayPredStats = (snap && snap.exists && snap.data()) || {};
                if (window._paintTodayCard) window._paintTodayCard({ tilesOnly: true });
            }, function () {});
        } catch (e2) {
            predWatchId = '';
        }
    }

    function hookPredict() {
        if (typeof window._loadMyPredictionStats === 'function' && !window._loadMyPredictionStats._todayTiles) {
            var load = window._loadMyPredictionStats;
            var wrapped = function (cb, force) {
                return load(function (stats) {
                    if (stats) window._todayPredStats = stats;
                    if (typeof cb === 'function') cb(stats);
                    if (window._paintTodayCard) window._paintTodayCard({ tilesOnly: true });
                }, force);
            };
            wrapped._todayTiles = true;
            window._loadMyPredictionStats = wrapped;
        }
    }

    function predictionConfirmed(snap) {
        if (!snap || !snap.exists) return false;
        if (snap.metadata && snap.metadata.hasPendingWrites === true) return false;
        var data = {};
        try { data = snap.data() || {}; } catch (e) { data = {}; }
        if (data.resolved === true) return false;
        return data.direction === 'up' || data.direction === 'down';
    }

    // The price label already reads prediction_stats. This doc is the save
    // itself: Done only after that write is no longer pending.
    var activeWatchId = '';
    var activeUnsub = null;
    function watchActivePrediction() {
        if (window._todayStubUser) return;
        var uid = flexUid();
        var canRead = uid && typeof db !== 'undefined' && db && typeof firebase !== 'undefined' && firebase.firestore;
        if (!canRead) {
            activeUnsub = stopWatch(activeUnsub);
            activeWatchId = '';
            if (window._todayPredictConfirmed) {
                window._todayPredictConfirmed = false;
                if (window._paintTodayCard) window._paintTodayCard({ tilesOnly: true });
            }
            return;
        }
        if (activeWatchId === uid && activeUnsub) return;
        activeUnsub = stopWatch(activeUnsub);
        activeWatchId = uid;
        try {
            activeUnsub = db.collection('active_predictions').doc(uid).onSnapshot(function (snap) {
                window._todayPredictConfirmed = predictionConfirmed(snap);
                if (window._paintTodayCard) window._paintTodayCard({ tilesOnly: true });
            }, function () {
                window._todayPredictConfirmed = false;
                if (window._paintTodayCard) window._paintTodayCard({ tilesOnly: true });
            });
        } catch (e3) {
            activeWatchId = '';
        }
    }

    function boot() {
        applyMoreState();
        hookPredict();
        window._paintTodayCard();
        watchFlexCount();
        watchUserDoc();
        watchPredict();
        watchActivePrediction();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    setInterval(function () {
        watchFlexCount();
        watchUserDoc();
        watchPredict();
        watchActivePrediction();
        hookPredict();
        if (window._paintTodayCard) window._paintTodayCard();
    }, 20000);
    window.addEventListener('focus', function () {
        watchFlexCount();
        watchUserDoc();
        watchPredict();
        watchActivePrediction();
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
