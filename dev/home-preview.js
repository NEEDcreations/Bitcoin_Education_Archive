// Dev-only localhost preview. Not loaded by index.html or 404.html,
// not precached, and not part of the bundle. On localhost, set
// window._homePreviewUser to a fake profile, then load this file after
// ranking.js. Production code has no fake-user path.
(function () {
    function homePreviewAllowed() {
        try {
            var host = String(location.hostname || '');
            return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
        } catch (e) { return false; }
    }

    function homePreviewUser() {
        if (!homePreviewAllowed()) return null;
        return window._homePreviewUser || null;
    }

    function _invitePreviewOn() {
        return !!homePreviewUser();
    }

    window.homePreviewAllowed = homePreviewAllowed;
    window.homePreviewUser = homePreviewUser;

    if (typeof homeSignedInNow === 'function') {
        var signedNow = homeSignedInNow;
        homeSignedInNow = function () {
            if (homePreviewUser()) return true;
            return signedNow();
        };
    }

    if (typeof satsHomeSnapshot === 'function') {
        var origSnap = satsHomeSnapshot;
        satsHomeSnapshot = function (user) {
            var previewUser = homePreviewUser();
            var preview = !!(previewUser && user === previewUser);
            var snap = origSnap(preview ? user : user);
            if (!preview) return snap;
            var u = user || {};
            var channels = 0;
            if (Array.isArray(u.visitedChannelsList)) channels = u.visitedChannelsList.length;
            else if (Array.isArray(u.readChannels)) channels = u.readChannels.length;
            else if (u.readChannels && typeof u.readChannels === 'object') channels = Object.keys(u.readChannels).length;
            if (Number(u.channelsRead) > channels) channels = Number(u.channelsRead);
            var emailOk = !!(u.email && u.emailVerified);
            var ageDays = Number(u.accountAgeDays) || 0;
            var checks = [true, emailOk, ageDays >= 7, channels >= 10, snap.claimable >= 100];
            var met = 0;
            var i;
            for (i = 0; i < checks.length; i++) if (checks[i]) met++;
            snap.canClaim = met === checks.length && !snap.onCooldown && !!snap.address;
            snap.checksMet = met;
            snap.checksTotal = checks.length;
            return snap;
        };
        window.satsHomeSnapshot = satsHomeSnapshot;
    }

    if (typeof window.refreshHomeStrip === 'function') {
        var prevRefresh = window.refreshHomeStrip;
        window.refreshHomeStrip = function () {
            var previewUser = homePreviewUser();
            if (!previewUser) return prevRefresh.apply(this, arguments);
            var saved = null;
            var hadUser = false;
            try {
                saved = currentUser;
                hadUser = true;
                currentUser = previewUser;
            } catch (e) {}
            var stats = (typeof getReferralStats === 'function') ? getReferralStats : null;
            if (stats) {
                getReferralStats = function () { return Promise.resolve(null); };
            }
            try {
                return prevRefresh.apply(this, arguments);
            } finally {
                if (hadUser) {
                    try { currentUser = saved; } catch (e2) {}
                }
                if (stats) getReferralStats = stats;
            }
        };
    }

    if (typeof updateAuthButton === 'function') {
        var prevAuth = updateAuthButton;
        updateAuthButton = function () {
            if (!homePreviewUser()) return prevAuth.apply(this, arguments);
            document.documentElement.classList.add('home-signed-in');
            if (document.body) document.body.classList.add('home-signed-in');
            var btn = document.getElementById('authBtn');
            if (btn) btn.style.display = 'none';
            if (typeof window.refreshHomeStrip === 'function') window.refreshHomeStrip();
        };
    }

    if (typeof openHomeWithdraw === 'function') {
        var prevWithdraw = openHomeWithdraw;
        openHomeWithdraw = function () {
            var previewUser = homePreviewUser();
            if (!previewUser) return prevWithdraw.apply(this, arguments);
            var saved = null;
            var hadUser = false;
            try {
                saved = currentUser;
                hadUser = true;
                currentUser = previewUser;
            } catch (e) {}
            try {
                return prevWithdraw.apply(this, arguments);
            } finally {
                if (hadUser) {
                    try { currentUser = saved; } catch (e2) {}
                }
            }
        };
    }

    if (typeof _inviteSignedIn === 'function') {
        var prevInviteSigned = _inviteSignedIn;
        _inviteSignedIn = function () {
            if (_invitePreviewOn()) return true;
            return prevInviteSigned();
        };
    }

    if (typeof _inviteUid === 'function') {
        var prevInviteUid = _inviteUid;
        _inviteUid = function () {
            if (_invitePreviewOn()) return 'preview';
            return prevInviteUid();
        };
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (homePreviewUser() && typeof window.refreshHomeStrip === 'function') window.refreshHomeStrip();
    });
})();
