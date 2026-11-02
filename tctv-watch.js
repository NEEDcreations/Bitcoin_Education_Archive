// Daily challenge: watch 10 minutes of Timechain TV.
// The button opens Timechain TV. While the YouTube player reports PLAYING,
// the tab is visible, and a signed-in user is on TV, this sends
// tctvWatchHeartbeat about every 60 seconds. The first heartbeat while the
// server clock is not running is sent immediately so the clock can start.
// Viewer counts stay on the existing tctv_presence heartbeat inside
// timechain-tv.js. This file does not write presence, watch time, XP, or tickets.
//
// The minute label and the chip bar are display-only. They advance once a
// second from the last server total while the player is PLAYING, then snap
// back to that total after every heartbeat and every ledger read. Pending
// time stops at one credit (60s) and is dropped after the server's 3 minute
// clock window, so the label cannot get ahead of what a heartbeat can credit.
(function () {
    'use strict';

    var HEARTBEAT_MS = 60000;
    var CLOCK_WINDOW_MS = 3 * 60 * 1000;
    var PENDING_CAP_SECONDS = 60;
    var GOAL_SECONDS = 600;
    var KICK_GAP_MS = 20000;
    var TOAST_TEXT = '📺 +100 XP and +1 🎟️ orange ticket for watching Timechain TV!';
    var timer = null;
    var inflight = false;
    var confirmedSeconds = 0;
    var creditAnchorMs = null;
    var playedMs = 0;
    var playingMark = null;
    var kickAt = 0;
    var awardLabel = '';
    var seenDay = '';

    // confirmed + play time since anchor, capped at one server credit and
    // dropped when the anchor is missing or older than the clock window.
    function displayWatchSeconds(confirmed, anchorMs, played, nowMs, done) {
        if (done === true) return GOAL_SECONDS;
        var base = Math.floor(Number(confirmed));
        if (!isFinite(base) || base < 0) base = 0;
        if (base >= GOAL_SECONDS) return GOAL_SECONDS;
        var anchor = Number(anchorMs);
        var now = Number(nowMs);
        var elapsed = Number(played);
        if (!isFinite(anchor) || !isFinite(now) || !isFinite(elapsed)) return base;
        var wall = now - anchor;
        if (wall < 0 || wall > CLOCK_WINDOW_MS) return base;
        var pending = Math.min(PENDING_CAP_SECONDS, Math.floor(elapsed / 1000), Math.floor(wall / 1000));
        if (!isFinite(pending) || pending < 0) pending = 0;
        var total = base + pending;
        return total > GOAL_SECONDS ? GOAL_SECONDS : total;
    }
    window.displayWatchSeconds = displayWatchSeconds;

    function watchUser() {
        try {
            if (typeof firebase === 'undefined' || !firebase.auth) return null;
            var user = firebase.auth().currentUser;
            if (!user || user.isAnonymous) return null;
            return user;
        } catch (e) {
            return null;
        }
    }

    function todayKey() {
        try {
            if (typeof window.getDailyKey === 'function') return window.getDailyKey();
        } catch (e) {}
        return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }

    function playerState() {
        var player = window._tctvYtPlayer;
        if (!player || typeof player.getPlayerState !== 'function') return null;
        try { return player.getPlayerState(); } catch (e) { return null; }
    }

    function isPlaying() {
        var state = playerState();
        if (state == null) return false;
        var playing = (window.YT && window.YT.PlayerState) ? window.YT.PlayerState.PLAYING : 1;
        return state === playing;
    }

    function isBuffering() {
        var state = playerState();
        var buffering = (window.YT && window.YT.PlayerState) ? window.YT.PlayerState.BUFFERING : 3;
        return state === buffering;
    }

    function onTv() {
        return window._tctvActive === true && !!document.getElementById('tctv-video-container');
    }

    function clockFresh(now) {
        if (creditAnchorMs == null) return false;
        var wall = now - creditAnchorMs;
        return wall >= 0 && wall <= CLOCK_WINDOW_MS;
    }

    function canCount() {
        if (window._tctvWatchDoneToday) return false;
        if (document.visibilityState !== 'visible') return false;
        if (!onTv() || !isPlaying() || !watchUser()) return false;
        return clockFresh(Date.now());
    }

    function samplePlay() {
        var now = Date.now();
        if (canCount()) {
            if (playingMark == null) playingMark = now;
            return;
        }
        if (playingMark != null) {
            playedMs += Math.max(0, now - playingMark);
            playingMark = null;
        }
    }

    function playedNow(now) {
        var played = playedMs;
        if (playingMark != null) played += Math.max(0, now - playingMark);
        return played;
    }

    function readAnchor(data, now) {
        var ms = null;
        if (data && typeof data.lastCreditMs === 'number' && isFinite(data.lastCreditMs)) ms = data.lastCreditMs;
        else if (data && data.lastCreditAt && typeof data.lastCreditAt.toMillis === 'function') {
            try {
                var converted = data.lastCreditAt.toMillis();
                if (typeof converted === 'number' && isFinite(converted)) ms = converted;
            } catch (e) {}
        }
        if (ms == null) return null;
        if (ms > now + 5000) return null;
        if (now - ms > CLOCK_WINDOW_MS) return null;
        return ms;
    }

    function resync(seconds, done, anchorMs) {
        var next = Math.floor(Number(seconds));
        if (!isFinite(next) || next < 0) next = 0;
        if (next > GOAL_SECONDS) next = GOAL_SECONDS;
        var nextDone = done === true || next >= GOAL_SECONDS;
        if (nextDone) next = GOAL_SECONDS;
        var became = nextDone && window._tctvWatchDoneToday !== true;
        confirmedSeconds = next;
        window._tctvWatchDoneToday = nextDone;
        creditAnchorMs = nextDone ? null : (typeof anchorMs === 'number' ? anchorMs : null);
        playedMs = 0;
        playingMark = null;
        if (!nextDone && creditAnchorMs != null && canCount()) playingMark = Date.now();
        render();
        if (became && typeof window._paintTodayCard === 'function') {
            try { window._paintTodayCard(); } catch (e) {}
        }
    }

    function render() {
        var now = Date.now();
        var done = window._tctvWatchDoneToday === true;
        var seconds = displayWatchSeconds(confirmedSeconds, creditAnchorMs, playedNow(now), now, done);
        var mins = Math.min(10, Math.floor(seconds / 60));
        var subText = done ? 'Done ✓' : (mins + '/10 min');
        var btn = document.getElementById('tctvWatchBtn');
        var emoji = document.getElementById('tctvWatchEmoji');
        var label = document.getElementById('tctvWatchLabel');
        var sub = document.getElementById('tctvWatchSub');
        if (emoji) emoji.textContent = '📺';
        if (label) label.textContent = 'Watch TV';
        if (sub) sub.textContent = subText;
        if (btn) btn.setAttribute('aria-label', done ? 'Watch Timechain TV, completed' : ('Watch TV, ' + subText));
        placeChip(seconds, done, subText);
    }

    function placeChip(seconds, done, subText) {
        var host = document.getElementById('tctv-video-container');
        var existing = document.getElementById('tctvWatchChip');
        if (!host || !onTv() || !watchUser()) {
            if (existing) existing.remove();
            return;
        }
        if (!existing) {
            existing = document.createElement('div');
            existing.id = 'tctvWatchChip';
            existing.setAttribute('role', 'status');
            existing.innerHTML = '<span class="tctv-watch-chip-text"></span><span class="tctv-watch-chip-bar" aria-hidden="true"><span class="tctv-watch-chip-fill"></span></span>';
            host.appendChild(existing);
        }
        existing.className = done ? 'tctv-watch-chip is-done' : 'tctv-watch-chip';
        var text = existing.querySelector('.tctv-watch-chip-text');
        var fill = existing.querySelector('.tctv-watch-chip-fill');
        if (text) text.textContent = done ? 'Done ✓' : ('📺 ' + subText);
        if (fill) fill.style.width = Math.min(100, Math.round((seconds / GOAL_SECONDS) * 100)) + '%';
        existing.setAttribute('aria-label', done ? (awardLabel || 'Done for today') : ('Watch progress, ' + subText));
    }

    function applyResult(res) {
        var data = res && res.data ? res.data : (res || {});
        var seconds = typeof data.seconds === 'number' ? data.seconds : confirmedSeconds;
        var done = data.done === true;
        var moved = data.reason === 'clock' || data.reason === 'credited' || data.reason === 'award';
        var anchor = moved ? Date.now() : creditAnchorMs;
        if (data.reason === 'banned') {
            seconds = 0;
            done = false;
            anchor = null;
        }
        if (typeof data.toast === 'string' && data.toast) awardLabel = data.toast;
        resync(seconds, done, done ? null : anchor);
        if (data.showToast === true && typeof window.showToast === 'function') {
            window.showToast(data.toast || TOAST_TEXT);
        }
    }

    function sendHeartbeat() {
        if (inflight || window._tctvWatchDoneToday) return;
        if (document.visibilityState !== 'visible') return;
        if (!onTv() || !isPlaying() || !watchUser()) return;
        if (typeof firebase === 'undefined' || !firebase.functions) return;
        inflight = true;
        try {
            var call = firebase.functions().httpsCallable('tctvWatchHeartbeat');
            call({}).then(function (res) {
                applyResult(res);
            }).catch(function () {}).then(function () {
                inflight = false;
            });
        } catch (e) {
            inflight = false;
        }
    }

    function maybeKick() {
        if (inflight || window._tctvWatchDoneToday) return;
        if (clockFresh(Date.now())) return;
        var now = Date.now();
        if (kickAt && now - kickAt < KICK_GAP_MS) return;
        kickAt = now;
        sendHeartbeat();
    }

    function arm() {
        if (timer) return;
        timer = setInterval(sendHeartbeat, HEARTBEAT_MS);
    }

    function disarm() {
        if (!timer) return;
        clearInterval(timer);
        timer = null;
    }

    function monitor() {
        var day = todayKey();
        if (seenDay && day !== seenDay) refresh();
        seenDay = day;
        observeRow();
        samplePlay();
        if (window._tctvWatchDoneToday || document.visibilityState !== 'visible' || !watchUser() || !onTv()) {
            disarm();
            render();
            return;
        }
        if (isPlaying()) {
            arm();
            maybeKick();
        } else if (!isBuffering()) {
            disarm();
        }
        render();
    }

    function refresh() {
        var user = watchUser();
        if (!user || typeof firebase === 'undefined' || !firebase.firestore) {
            awardLabel = '';
            resync(0, false, null);
            return;
        }
        firebase.firestore().collection('tctv_watch').doc(user.uid).get().then(function (snap) {
            if (!snap.exists) {
                awardLabel = '';
                resync(0, false, null);
                return;
            }
            var data = snap.data() || {};
            var today = todayKey();
            var sameDay = data.day === today;
            var seconds = sameDay ? (Number(data.seconds) || 0) : 0;
            var done = data.awardedDay === today || (sameDay && seconds >= 600);
            resync(done ? 600 : seconds, done, done ? null : readAnchor(data, Date.now()));
        }).catch(function () {});
    }

    function observeRow() {
        var row = document.getElementById('em-quick-actions');
        if (!row || typeof IntersectionObserver !== 'function' || observeRow.armed) return;
        observeRow.armed = true;
        var obs = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) refresh();
            }
        });
        obs.observe(row);
    }

    function nudgePlay() {
        var tries = 0;
        var nudge = setInterval(function () {
            tries += 1;
            var player = window._tctvYtPlayer;
            if (player && typeof player.playVideo === 'function') {
                try { player.playVideo(); } catch (e) {}
                clearInterval(nudge);
                return;
            }
            if (tries > 24) clearInterval(nudge);
        }, 300);
    }

    function startTctvDailyWatch() {
        window._tctvWatchAutostart = true;
        if (!watchUser() && typeof window.showToast === 'function') {
            window.showToast('Sign in to earn XP and orange tickets for watching.');
        }
        if (typeof window.go === 'function') window.go('timechain-tv');
        else if (typeof location !== 'undefined') location.hash = '#timechain-tv';
        nudgePlay();
    }
    window.startTctvDailyWatch = startTctvDailyWatch;

    function boot() {
        var tries = 0;
        var wait = setInterval(function () {
            tries += 1;
            if (typeof firebase !== 'undefined' && firebase.auth) {
                clearInterval(wait);
                try {
                    firebase.auth().onAuthStateChanged(function () { refresh(); });
                } catch (e) {}
                refresh();
            } else if (tries > 40) {
                clearInterval(wait);
            }
        }, 250);
        observeRow();
        setInterval(monitor, 1000);
        document.addEventListener('visibilitychange', monitor);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
