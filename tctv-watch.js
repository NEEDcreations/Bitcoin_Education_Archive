// Daily challenge: watch 10 minutes of Timechain TV.
// The button opens Timechain TV. While the YouTube player reports PLAYING,
// the tab is visible, and a signed-in user is on TV, this sends
// tctvWatchHeartbeat about every 60 seconds.
// Viewer counts stay on the existing tctv_presence heartbeat inside
// timechain-tv.js. This file does not write presence, watch time, XP, or tickets.
(function () {
    'use strict';

    var HEARTBEAT_MS = 60000;
    var TOAST_TEXT = '📺 +100 XP and +1 🎟️ orange ticket for watching Timechain TV!';
    var timer = null;
    var inflight = false;
    var secondsToday = 0;
    var seenDay = '';

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

    function paint(view) {
        var seconds = view && typeof view.seconds === 'number' ? view.seconds : 0;
        var done = !!(view && view.done);
        secondsToday = done ? 600 : Math.max(0, seconds);
        window._tctvWatchDoneToday = done;
        var btn = document.getElementById('tctvWatchBtn');
        var emoji = document.getElementById('tctvWatchEmoji');
        var label = document.getElementById('tctvWatchLabel');
        var sub = document.getElementById('tctvWatchSub');
        var mins = Math.min(10, Math.floor((done ? 600 : Math.max(0, seconds)) / 60));
        var subText = done ? 'Done ✓' : (mins + '/10 min');
        if (emoji) emoji.textContent = '📺';
        if (label) label.textContent = 'Watch TV';
        if (sub) sub.textContent = subText;
        if (btn) btn.setAttribute('aria-label', done ? 'Watch Timechain TV, done for today' : ('Watch TV, ' + subText));
        placeChip();
    }

    function placeChip() {
        var host = document.getElementById('tctv-video-container');
        var existing = document.getElementById('tctvWatchChip');
        if (!host || !onTv() || window._tctvWatchDoneToday || !watchUser()) {
            if (existing) existing.remove();
            return;
        }
        if (!existing) {
            existing = document.createElement('div');
            existing.id = 'tctvWatchChip';
            existing.className = 'tctv-watch-chip';
            existing.setAttribute('role', 'status');
            existing.innerHTML = '<span class="tctv-watch-chip-text"></span><span class="tctv-watch-chip-bar" aria-hidden="true"><span class="tctv-watch-chip-fill"></span></span>';
            host.appendChild(existing);
        }
        var mins = Math.min(10, Math.floor(secondsToday / 60));
        var text = existing.querySelector('.tctv-watch-chip-text');
        var fill = existing.querySelector('.tctv-watch-chip-fill');
        if (text) text.textContent = '📺 ' + mins + '/10 min';
        if (fill) fill.style.width = Math.min(100, Math.round((secondsToday / 600) * 100)) + '%';
    }

    function applyResult(res) {
        var data = res && res.data ? res.data : (res || {});
        paint({
            seconds: typeof data.seconds === 'number' ? data.seconds : secondsToday,
            done: data.done === true
        });
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
        if (window._tctvWatchDoneToday || document.visibilityState !== 'visible' || !watchUser() || !onTv()) {
            disarm();
            placeChip();
            return;
        }
        if (isPlaying()) arm();
        else if (!isBuffering()) disarm();
        placeChip();
    }

    function refresh() {
        var user = watchUser();
        if (!user || typeof firebase === 'undefined' || !firebase.firestore) {
            paint({ seconds: 0, done: false });
            return;
        }
        firebase.firestore().collection('tctv_watch').doc(user.uid).get().then(function (snap) {
            if (!snap.exists) {
                paint({ seconds: 0, done: false });
                return;
            }
            var data = snap.data() || {};
            var today = todayKey();
            var sameDay = data.day === today;
            var seconds = sameDay ? (Number(data.seconds) || 0) : 0;
            var done = data.awardedDay === today || (sameDay && seconds >= 600);
            paint({ seconds: done ? 600 : seconds, done: done });
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
