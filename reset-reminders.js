// Shared by Cloud Functions and the browser (reset-reminders.js is a copy).
// Pure: no Firebase, no secrets. The scheduler re-checks these decisions.
// Every reset starts off. A missing or non-true optedIn flag sends nothing.
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && typeof root === 'object') root.ResetReminders = api;
})(typeof window !== 'undefined' ? window : global, function () {
    var HOUR = 60 * 60 * 1000;
    var LEAD_MS = HOUR;
    var DAY = 24 * HOUR;
    var QUIET_START = 22;
    var QUIET_END = 8;
    var ORIGIN = 'https://bitcoineducation.quest';

    // Clock resets a player can be reminded about, one hour before they happen.
    // hour/minute are the reset itself. tz UTC is a fixed UTC clock.
    // tz America/New_York stays on that Eastern clock through daylight saving.
    var CATALOG = [
        { id: 'daily-spin', group: 'daily', title: 'Daily spin', body: 'Your free spin refreshes in about an hour.', url: ORIGIN + '/#questhub', when: { tz: 'UTC', hour: 5, minute: 0 } },
        { id: 'daily-trivia', group: 'daily', title: 'Daily trivia', body: 'A new trivia question unlocks in about an hour.', url: ORIGIN + '/#questhub', when: { tz: 'UTC', hour: 5, minute: 0 } },
        { id: 'daily-quests', group: 'daily', title: 'Daily quests', body: 'Today\'s quiz and quest day reset in about an hour.', url: ORIGIN + '/#questhub', when: { tz: 'UTC', hour: 5, minute: 0 } },
        { id: 'daily-gifts', group: 'daily', title: 'Daily gifts', body: 'Today\'s gift drop refreshes in about an hour.', url: ORIGIN + '/#questhub', when: { tz: 'UTC', hour: 5, minute: 0 } },
        { id: 'daily-streak', group: 'daily', title: 'Daily streak', body: 'The streak day rolls over in about an hour. Open Bitcoin Quest to keep it.', url: ORIGIN + '/', when: { tz: 'UTC', hour: 5, minute: 0 } },
        { id: 'daily-poll', group: 'daily', title: 'Daily poll', body: 'A new daily poll arrives in about an hour.', url: ORIGIN + '/#questhub', when: { tz: 'UTC', hour: 5, minute: 0 } },
        { id: 'daily-flex', group: 'daily', title: 'Flex actions', body: 'Flex actions reset in about an hour.', url: ORIGIN + '/#questhub', when: { tz: 'UTC', hour: 5, minute: 0 } },
        { id: 'daily-tctv', group: 'daily', title: 'Timechain TV day', body: 'The Timechain TV watch reward and sats-pot daily cap reset in about an hour.', url: ORIGIN + '/#timechain-tv', when: { tz: 'UTC', hour: 5, minute: 0 } },
        { id: 'daily-keys', group: 'daily', title: 'Peer key send', body: 'The UTC day for sending keys to the same peer rolls over in about an hour.', url: ORIGIN + '/#questhub', when: { tz: 'UTC', hour: 0, minute: 0 } },
        { id: 'daily-ciphers', group: 'daily', title: 'Cipher opens', body: 'The 21 cipher opens for this UTC day refresh in about an hour.', url: ORIGIN + '/#questhub', when: { tz: 'UTC', hour: 0, minute: 0 } },
        // TODO(sats-caps): no shared cash-out config yet. This 200 is faucetGuard.MAX_DAILY_PER_USER_SATS.
        // PR #273 will set a max of 1,000 sats per cash-out and 2,000 per day across the faucet and cipher rails.
        // When those live in one constant, read it here and in resets.html. Do not hardcode the new numbers before that.
        { id: 'daily-sats-cap', group: 'daily', title: 'Daily sats cap', body: 'The UTC-day faucet cap (200 sats) resets in about an hour.', url: ORIGIN + '/#settings', when: { tz: 'UTC', hour: 0, minute: 0 } },
        { id: 'scholar-exam', group: 'daily', title: 'Scholar exam', body: 'Your scholar exam try resets at midnight UTC, about an hour from now.', url: ORIGIN + '/#questhub', when: { tz: 'UTC', hour: 0, minute: 0 } },
        { id: 'weekly-xp', group: 'weekly', title: 'Weekly leaderboard', body: 'The weekly XP leaderboard closes in about an hour.', url: ORIGIN + '/#leaderboard', when: { tz: 'UTC', hour: 5, minute: 0, dow: 1 } },
        { id: 'weekly-quests', group: 'weekly', title: 'Weekly quest board', body: 'The weekly quest leaderboard closes in about an hour.', url: ORIGIN + '/#leaderboard', when: { tz: 'UTC', hour: 5, minute: 0, dow: 1 } },
        { id: 'weekly-predictions', group: 'weekly', title: 'Weekly predictions', body: 'Weekly prediction prizes are paid in about an hour.', url: ORIGIN + '/#questhub', when: { tz: 'UTC', hour: 5, minute: 0, dow: 1 } },
        { id: 'monthly-xp', group: 'monthly', title: 'Monthly leaderboard', body: 'The monthly XP leaderboard closes in about an hour.', url: ORIGIN + '/#leaderboard', when: { tz: 'UTC', hour: 0, minute: 0, dom: 1 } },
        { id: 'monthly-quests', group: 'monthly', title: 'Monthly quest board', body: 'The monthly quest leaderboard closes in about an hour.', url: ORIGIN + '/#leaderboard', when: { tz: 'UTC', hour: 5, minute: 0, dom: 1 } },
        { id: 'monthly-predictions', group: 'monthly', title: 'Monthly predictions', body: 'Monthly prediction prizes are paid in about an hour.', url: ORIGIN + '/#questhub', when: { tz: 'UTC', hour: 0, minute: 0, dom: 1 } },
        { id: 'monthly-raffle', group: 'monthly', title: 'Monthly raffle', body: 'The Orange Ticket raffle is drawn in about an hour.', url: ORIGIN + '/#questhub', when: { tz: 'UTC', hour: 18, minute: 0, dom: 1 } },
        { id: 'raid-boss', group: 'monthly', title: 'New raid boss', body: 'A new raid boss arrives in about an hour.', url: ORIGIN + '/#questhub', when: { tz: 'America/New_York', hour: 13, minute: 0, dom: 1 } },
        { id: 'faucet-ready', group: 'other', title: 'Sats withdrawal', body: 'Your 24-hour withdrawal cooldown ends in about an hour.', url: ORIGIN + '/#settings', rolling: 'faucet' }
    ];

    var BY_ID = {};
    CATALOG.forEach(function (item) { BY_ID[item.id] = item; });

    function num(value) {
        var n = typeof value === 'number' ? value : parseInt(value, 10);
        return isFinite(n) ? n : NaN;
    }

    function clampHour(value, fallback) {
        if (value === 0) return 0;
        var n = num(value);
        if (!isFinite(n)) return fallback;
        n = Math.floor(n);
        if (n < 0 || n > 23) return fallback;
        return n;
    }

    function safeZone(tz) {
        var s = String(tz || '').trim();
        if (!/^[A-Za-z0-9_+\-/]{1,64}$/.test(s)) return 'UTC';
        try {
            Intl.DateTimeFormat('en-US', { timeZone: s }).format(new Date());
            return s;
        } catch (e) {
            return 'UTC';
        }
    }

    function partsInZone(ms, timeZone) {
        var fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: timeZone || 'UTC',
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            weekday: 'short'
        });
        var map = {};
        fmt.formatToParts(new Date(ms)).forEach(function (part) {
            if (part.type !== 'literal') map[part.type] = part.value;
        });
        var weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        return {
            y: Number(map.year),
            m: Number(map.month),
            d: Number(map.day),
            hour: Number(map.hour) % 24,
            minute: Number(map.minute),
            dow: weekdays[map.weekday]
        };
    }

    function zonedTimeToUtc(y, m, d, hour, minute, timeZone) {
        var utcGuess = Date.UTC(y, m - 1, d, hour, minute, 0);
        var shown = partsInZone(utcGuess, timeZone);
        var asUtc = Date.UTC(shown.y, shown.m - 1, shown.d, shown.hour, shown.minute, 0);
        return utcGuess - (asUtc - utcGuess);
    }

    function addCivilDay(y, m, d) {
        var next = new Date(Date.UTC(y, m - 1, d + 1));
        return { y: next.getUTCFullYear(), m: next.getUTCMonth() + 1, d: next.getUTCDate() };
    }

    function nextReset(when, nowMs) {
        if (!when) return 0;
        var zone = when.tz || 'UTC';
        var start = partsInZone(nowMs - DAY, zone);
        var y = start.y;
        var m = start.m;
        var d = start.d;
        var i;
        for (i = 0; i < 45; i++) {
            var t = zonedTimeToUtc(y, m, d, when.hour, when.minute || 0, zone);
            var shown = partsInZone(t, zone);
            var wallOk = shown.y === y && shown.m === m && shown.d === d && shown.hour === when.hour;
            if (wallOk && t > nowMs) {
                if (when.dow != null && shown.dow !== when.dow) {
                    var skip = addCivilDay(y, m, d);
                    y = skip.y; m = skip.m; d = skip.d;
                    continue;
                }
                if (when.dom != null && d !== when.dom) {
                    var skipDom = addCivilDay(y, m, d);
                    y = skipDom.y; m = skipDom.m; d = skipDom.d;
                    continue;
                }
                return t;
            }
            var step = addCivilDay(y, m, d);
            y = step.y; m = step.m; d = step.d;
        }
        return 0;
    }

    function sanitize(raw) {
        var src = raw && typeof raw === 'object' ? raw : {};
        var incoming = src.items && typeof src.items === 'object' ? src.items : {};
        var items = {};
        CATALOG.forEach(function (item) {
            if (incoming[item.id] === true) items[item.id] = true;
            else if (incoming[item.id] === false) items[item.id] = false;
        });
        return {
            optedIn: src.optedIn === true,
            quietStart: clampHour(src.quietStart, QUIET_START),
            quietEnd: clampHour(src.quietEnd, QUIET_END),
            timeZone: safeZone(src.timeZone),
            items: items
        };
    }

    function anyOn(items) {
        var id;
        for (id in items) {
            if (Object.prototype.hasOwnProperty.call(items, id) && items[id] === true) return true;
        }
        return false;
    }

    function inQuietHours(nowMs, prefs) {
        var start = prefs.quietStart;
        var end = prefs.quietEnd;
        if (start === end) return false;
        var hour = partsInZone(nowMs, prefs.timeZone).hour;
        if (start < end) return hour >= start && hour < end;
        return hour >= start || hour < end;
    }

    function millisOf(value) {
        if (!value) return 0;
        if (typeof value === 'number' && isFinite(value)) return value;
        if (typeof value.toMillis === 'function') return value.toMillis();
        if (typeof value.seconds === 'number') return value.seconds * 1000;
        if (typeof value._seconds === 'number') return value._seconds * 1000;
        return 0;
    }

    function hitFor(item, resetAt) {
        return {
            id: item.id,
            group: item.group,
            title: item.title,
            body: item.body,
            url: item.url,
            resetAt: resetAt,
            occurrenceKey: item.id + '_' + resetAt
        };
    }

    // The instant quiet hours end after `ms`. If `ms` is already outside quiet
    // hours, `ms` itself. 0 when a quiet-hours end cannot be found.
    function nextQuietEnd(ms, prefs) {
        if (!inQuietHours(ms, prefs)) return ms;
        var local = partsInZone(ms, prefs.timeZone);
        var y = local.y;
        var m = local.m;
        var d = local.d;
        var i;
        for (i = 0; i < 3; i++) {
            var t = zonedTimeToUtc(y, m, d, prefs.quietEnd, 0, prefs.timeZone);
            var shown = partsInZone(t, prefs.timeZone);
            if (shown.hour === prefs.quietEnd && t > ms && !inQuietHours(t, prefs)) return t;
            var step = addCivilDay(y, m, d);
            y = step.y;
            m = step.m;
            d = step.d;
        }
        return 0;
    }

    function previousReset(when, nowMs) {
        var cursor = nextReset(when, nowMs - 45 * DAY);
        var prev = 0;
        var guard = 0;
        while (cursor && cursor <= nowMs && guard < 60) {
            prev = cursor;
            cursor = nextReset(when, cursor);
            guard++;
        }
        return prev;
    }

    function followingReset(item, resetAt) {
        if (!item || item.rolling === 'faucet') return resetAt + DAY;
        return nextReset(item.when, resetAt) || (resetAt + 40 * DAY);
    }

    // Send in the hour before the reset. If that hour sits inside quiet hours
    // (the 05:00 UTC game day does, for US Eastern, US Central, and London),
    // hold the same reset and send it when quiet hours end. Still one claim
    // per reset: the occurrence key is the reset instant, not the send instant.
    function considerReset(item, resetAt, nowMs, prefs) {
        if (!resetAt) return null;
        var planned = resetAt - LEAD_MS;
        var releaseAt = nextQuietEnd(planned, prefs);
        if (!releaseAt) return null;
        var deadline = releaseAt < resetAt ? resetAt : followingReset(item, resetAt);
        if (nowMs < releaseAt || nowMs >= deadline) return null;
        var hit = hitFor(item, resetAt);
        hit.deferred = releaseAt >= resetAt;
        if (hit.deferred) hit.body = 'Quiet hours are over. ' + item.title + ' has reset.';
        return hit;
    }

    // Nothing is due unless optedIn is exactly true and that reset's switch is true.
    function dueForUser(nowMs, user) {
        var data = user || {};
        var prefs = sanitize(data.resetReminders);
        if (prefs.optedIn !== true) return [];
        if (inQuietHours(nowMs, prefs)) return [];
        var out = [];
        CATALOG.forEach(function (item) {
            if (prefs.items[item.id] !== true) return;
            if (item.rolling === 'faucet') {
                var last = millisOf(data.lastSatsClaim);
                if (!last) return;
                var faucetHit = considerReset(item, last + DAY, nowMs, prefs);
                if (faucetHit) out.push(faucetHit);
                return;
            }
            var upcoming = nextReset(item.when, nowMs);
            var previous = previousReset(item.when, nowMs);
            var seen = {};
            [previous, upcoming].forEach(function (resetAt) {
                if (!resetAt || seen[resetAt]) return;
                seen[resetAt] = true;
                var hit = considerReset(item, resetAt, nowMs, prefs);
                if (hit) out.push(hit);
            });
        });
        return out;
    }

    function claimDocId(uid, occurrenceKey) {
        var u = String(uid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
        var k = String(occurrenceKey || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 96);
        if (!u || !k) return '';
        return ('rr_' + u + '_' + k).slice(0, 700);
    }

    function planSends(rows, nowMs, already) {
        var seen = already || {};
        var out = [];
        (rows || []).forEach(function (row) {
            if (!row || !row.uid) return;
            if (row.banned === true) return;
            if (row.anonymous === true || row.isAnonymous === true) return;
            dueForUser(nowMs, row).forEach(function (hit) {
                var id = claimDocId(row.uid, hit.occurrenceKey);
                if (!id || seen[id]) return;
                out.push({ uid: row.uid, id: id, hit: hit });
            });
        });
        return out;
    }

    return {
        HOUR: HOUR,
        LEAD_MS: LEAD_MS,
        DAY: DAY,
        QUIET_START: QUIET_START,
        QUIET_END: QUIET_END,
        CATALOG: CATALOG,
        BY_ID: BY_ID,
        sanitize: sanitize,
        anyOn: anyOn,
        inQuietHours: inQuietHours,
        nextReset: nextReset,
        nextQuietEnd: nextQuietEnd,
        dueForUser: dueForUser,
        claimDocId: claimDocId,
        planSends: planSends,
        millisOf: millisOf
    };
});
