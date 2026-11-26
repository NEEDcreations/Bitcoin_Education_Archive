// Timechain TV share row and guest sign-up line.
// Sits below the player, never over the video. No ads copy.
(function () {
    'use strict';

    var SIGNUP_LINE = 'Watching free. Sign up free for quests, trivia and more.';
    var SHARE_LABEL = 'Share Timechain TV';
    var SHARE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-share-2" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="16" cy="19" r="3"></circle><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"></line><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"></line></svg>';

    function onTv() {
        return window._tctvActive === true && !!document.querySelector('.tctv-video-wrap');
    }

    function isGuest() {
        try {
            if (typeof firebase === 'undefined' || !firebase.auth) return true;
            var user = firebase.auth().currentUser;
            return !user || user.isAnonymous;
        } catch (e) {
            return true;
        }
    }

    function pageUrl() {
        try {
            var url = new URL(location.href);
            url.hash = '#timechain-tv';
            return url.toString();
        } catch (e) {
            return (location.origin || '') + '/#timechain-tv';
        }
    }

    function sharePage() {
        var url = pageUrl();
        var title = 'Timechain TV';
        if (navigator.share) {
            navigator.share({ title: title, url: url, text: title }).catch(function () {});
            return;
        }
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(url).then(function () {
                if (typeof window.showToast === 'function') window.showToast('Link copied');
            }).catch(function () {});
            return;
        }
        if (typeof window.showToast === 'function') window.showToast(url);
    }

    function paint() {
        var wrap = document.querySelector('.tctv-video-wrap');
        var existing = document.getElementById('tctv-chrome');
        if (!onTv() || !wrap) {
            if (existing) existing.remove();
            return;
        }
        if (!existing) {
            existing = document.createElement('div');
            existing.id = 'tctv-chrome';
            existing.className = 'tctv-chrome';
            var host = document.getElementById('tctv-video-container');
            if (host && host.parentNode === wrap) wrap.insertBefore(existing, host.nextSibling);
            else wrap.appendChild(existing);
        }
        var guest = isGuest();
        var html = '<button type="button" id="tctvShareBtn" class="tctv-share-btn" aria-label="' + SHARE_LABEL + '">' + SHARE_SVG + '<span>Share</span></button>';
        if (guest) {
            html += '<p id="tctvSignupLine" class="tctv-signup-line">' + SIGNUP_LINE + '</p>';
        }
        if (existing.getAttribute('data-guest') !== (guest ? '1' : '0') || !existing.firstChild) {
            existing.setAttribute('data-guest', guest ? '1' : '0');
            existing.innerHTML = html;
            var btn = existing.querySelector('#tctvShareBtn');
            if (btn) btn.onclick = sharePage;
            var line = existing.querySelector('#tctvSignupLine');
            if (line) {
                line.onclick = function () {
                    if (typeof window.showUsernamePrompt === 'function') window.showUsernamePrompt();
                };
            }
        }
    }

    function boot() {
        paint();
        setInterval(paint, 1000);
        document.addEventListener('visibilitychange', paint);
        try {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                firebase.auth().onAuthStateChanged(function () { paint(); });
            }
        } catch (e) {}
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
