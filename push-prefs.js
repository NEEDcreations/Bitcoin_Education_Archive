// Shared by Cloud Functions and the browser (push-prefs.js is a copy).
// Pure: no Firebase, no secrets. The client is hostile, so senders
// re-check these decisions and never trust a requested category.
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && typeof root === 'object') root.PushPrefs = api;
})(typeof window !== 'undefined' ? window : global, function () {
    var DAY_MS = 24 * 60 * 60 * 1000;
    var REASK_MS = 30 * DAY_MS;
    var RETURN_DAYS = 7;
    var MAX_ASKS = 3;
    var ORIGIN = 'https://bitcoineducation.quest';
    var CONTEXT_MOMENTS = ['win', 'gift', 'favor', 'pvp'];

    // rewards, peer/gift, and DMs default on. News and marketplace promos default off.
    var DEFAULTS = {
        rewards: true,
        gifts: true,
        favor: true,
        pvp: true,
        predictions: true,
        mentions: true,
        dms: true,
        plebtalk: false,
        reminders: true,
        news: false,
        referrals: true
    };

    var CATEGORIES = Object.keys(DEFAULTS);

    var RATE_LIMITS = {
        rewards: { windowMs: 60 * 60 * 1000, max: 8 },
        gifts: { windowMs: 60 * 60 * 1000, max: 20 },
        favor: { windowMs: 12 * 60 * 60 * 1000, max: 2 },
        pvp: { windowMs: 60 * 60 * 1000, max: 15 },
        predictions: { windowMs: 60 * 60 * 1000, max: 8 },
        mentions: { windowMs: 60 * 60 * 1000, max: 20 },
        dms: { windowMs: 60 * 60 * 1000, max: 30 },
        plebtalk: { windowMs: 60 * 60 * 1000, max: 15 },
        reminders: { windowMs: 20 * 60 * 60 * 1000, max: 3 },
        news: { windowMs: 6 * DAY_MS, max: 1 },
        referrals: { windowMs: DAY_MS, max: 5 },
        test: { windowMs: 60 * 60 * 1000, max: 3 }
    };

    function categoryAllowed(userData, category) {
        if (CATEGORIES.indexOf(category) === -1) return false;
        var prefs = userData && userData.notificationPrefs;
        if (prefs && typeof prefs === 'object') {
            if (prefs.master === false) return false;
            if (Object.prototype.hasOwnProperty.call(prefs, category)) {
                return prefs[category] === true;
            }
        }
        return DEFAULTS[category] === true;
    }

    function sanitizePushText(value, max) {
        var limit = max || 180;
        var s = String(value == null ? '' : value);
        s = s.replace(/[\u0000-\u001F\u007F]/g, ' ');
        s = s.replace(/[<>&]/g, function (ch) {
            if (ch === '<') return '&lt;';
            if (ch === '>') return '&gt;';
            return '&amp;';
        });
        s = s.replace(/\s+/g, ' ').trim();
        if (s.length > limit) s = s.slice(0, Math.max(0, limit - 1)) + '\u2026';
        return s;
    }

    function safePushUrl(url) {
        var fallback = ORIGIN + '/';
        try {
            var u = new URL(String(url || ''), ORIGIN);
            if (u.protocol !== 'https:') return fallback;
            if (u.hostname !== 'bitcoineducation.quest') return fallback;
            return u.href;
        } catch (e) {
            return fallback;
        }
    }

    function buildWebPushMessage(token, payload) {
        var src = payload || {};
        var title = sanitizePushText(src.title, 80) || 'Bitcoin Quest';
        var body = sanitizePushText(src.body, 180);
        var link = safePushUrl(src.url);
        var type = sanitizePushText(src.type, 32);
        return {
            token: String(token || ''),
            notification: { title: title, body: body },
            data: { title: title, body: body, url: link, type: type },
            webpush: {
                headers: { Urgency: 'high' },
                fcmOptions: { link: link },
                notification: {
                    title: title,
                    body: body,
                    icon: ORIGIN + '/icons/icon-192x192.png',
                    badge: ORIGIN + '/icons/icon-72x72.png'
                }
            }
        };
    }

    function num(value) {
        var n = typeof value === 'number' ? value : parseInt(value, 10);
        return isFinite(n) ? n : 0;
    }

    // When to show the soft pre-prompt. Never calls Notification.requestPermission.
    // count is how many times we have already shown it (0..3).
    function decidePrompt(input) {
        var src = input || {};
        var now = num(src.now);
        var permission = src.permission || 'default';
        var stored = src.prompt || {};
        var count = Math.max(0, num(stored.count));
        var lastAsked = num(stored.lastAsked);
        var stopped = stored.stopped === true || stored.dontAsk === true;
        var sessionCount = Math.max(1, num(src.sessionCount) || 1);
        var totalVisits = Math.max(0, num(src.totalVisits));
        var daysSince = num(src.daysSinceVisit);
        var context = src.context || null;
        var iosInstall = src.iosNeedsInstall === true;
        var firstEver = sessionCount < 2 && totalVisits < 2;

        if (permission === 'granted') return { show: false, reason: 'granted' };
        if (permission === 'denied') return { show: false, reason: 'denied' };
        if (permission === 'unsupported') return { show: false, reason: 'unsupported' };
        if (stopped) return { show: false, reason: 'stopped' };
        if (count >= MAX_ASKS) return { show: false, reason: 'max' };
        if (firstEver) return { show: false, reason: 'first-session' };
        if (src.busy === true) return { show: false, reason: 'busy' };
        if (src.popupTaken === true) return { show: false, reason: 'popup' };

        var kind = iosInstall ? 'install' : 'standard';
        if (count === 0) {
            var secondSession = sessionCount >= 2;
            var returning = daysSince >= RETURN_DAYS && (totalVisits >= 2 || sessionCount >= 2);
            if (secondSession || returning) {
                return {
                    show: true,
                    reason: secondSession ? 'second-session' : 'returning',
                    kind: kind,
                    askIndex: 1,
                    showDontAsk: false
                };
            }
            return { show: false, reason: 'wait' };
        }

        if (CONTEXT_MOMENTS.indexOf(context) === -1) {
            return { show: false, reason: 'needs-context' };
        }
        if (!lastAsked || (now - lastAsked) < REASK_MS) {
            return { show: false, reason: 'too-soon' };
        }
        return {
            show: true,
            reason: 'reask',
            kind: iosInstall ? 'install' : 'context',
            context: context,
            askIndex: count + 1,
            showDontAsk: true
        };
    }

    // Settings test button may target only the signed-in user.
    // An admin claim may target another uid. Everyone else is refused.
    function testPushTargetAllowed(callerUid, targetUid, isAdmin) {
        if (!callerUid || !targetUid) return false;
        if (callerUid === targetUid) return true;
        return isAdmin === true;
    }

    return {
        DAY_MS: DAY_MS,
        REASK_MS: REASK_MS,
        RETURN_DAYS: RETURN_DAYS,
        MAX_ASKS: MAX_ASKS,
        ORIGIN: ORIGIN,
        DEFAULTS: DEFAULTS,
        CATEGORIES: CATEGORIES,
        CONTEXT_MOMENTS: CONTEXT_MOMENTS,
        RATE_LIMITS: RATE_LIMITS,
        categoryAllowed: categoryAllowed,
        sanitizePushText: sanitizePushText,
        safePushUrl: safePushUrl,
        buildWebPushMessage: buildWebPushMessage,
        decidePrompt: decidePrompt,
        testPushTargetAllowed: testPushTargetAllowed
    };
});
