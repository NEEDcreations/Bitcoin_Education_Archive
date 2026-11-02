'use strict';

// Daily "watch 10 minutes of Timechain TV" reward.
// The client is hostile. It cannot name the elapsed time, the day, or the
// prize. A heartbeat is accepted only when the server clock says so.
//
// Credit is min(60s, seconds since the last credited heartbeat), and only
// when that gap is at least 55 seconds and at most 3 minutes. The first
// heartbeat, and the first heartbeat after a longer gap, only starts the
// clock (credit 0). Nothing is backfilled. Two tabs share one uid ledger.
// The daily total stops at 600 seconds, so 10 minutes of credit takes at
// least 10 real minutes. The prize is once per uid per 5 AM UTC day.

const rewardNotify = require('./rewardNotify');
const { planXpGrant } = require('./grantXp');
const { offsetDateKey } = require('./offsetDay');
const ticketGrants = require('./ticketGrants');
const tctvPresence = require('../tctv-presence-lib');

const CREDIT_SECONDS = 60;
const MIN_GAP_MS = 55 * 1000;
// A gap longer than this does not count as continuous watching.
const CLOCK_GAP_MS = 3 * 60 * 1000;
const GOAL_SECONDS = 600;
const REWARD_XP = 100;
// Same once-per-offset-day ticket #64 grants for a paying watch block.
const REWARD_TICKETS = ticketGrants.get('tctv_watch_ticket').tickets;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 4;
const TOAST_TEXT = '📺 +100 XP and +1 🎟️ orange ticket for watching Timechain TV!';

function creditMillis(value) {
    if (value == null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value.toMillis === 'function') {
        const ms = value.toMillis();
        return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
    }
    if (typeof value === 'object' && typeof value._seconds === 'number') {
        const nanos = typeof value._nanoseconds === 'number' ? value._nanoseconds : 0;
        return value._seconds * 1000 + Math.floor(nanos / 1e6);
    }
    return null;
}

function clampSeconds(value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n <= 0) return 0;
    if (n > GOAL_SECONDS) return GOAL_SECONDS;
    return n;
}

function watchDayStamp(day) {
    return String(day || '').replace(/[^0-9]/g, '').slice(0, 8);
}

function noticeMessage(xp, tickets) {
    const t = tickets == null ? REWARD_TICKETS : tickets;
    if (xp === REWARD_XP && t === REWARD_TICKETS) return TOAST_TEXT;
    const ticketBit = t === 1 ? '+1 🎟️ orange ticket' : ('+' + t + ' 🎟️ orange tickets');
    return '📺 +' + xp + ' XP and ' + ticketBit + ' for watching Timechain TV!';
}

// Same id the reward-notice writer uses: one doc per uid per offset day.
function watchNoticeId(uid, day) {
    const cleanUid = rewardNotify.safeId(uid);
    const cleanDay = watchDayStamp(day);
    if (!cleanUid || cleanDay.length !== 8) return '';
    return 'rn_' + cleanUid + '_tctv_watch_' + cleanDay;
}

function buildWatchNotice(uid, day, xp, tickets) {
    const cleanDay = watchDayStamp(day);
    const id = watchNoticeId(uid, day);
    if (!id) return null;
    const awarded = xp == null ? REWARD_XP : Math.max(0, Math.round(Number(xp) || 0));
    const ticketCount = tickets == null
        ? (awarded > 0 ? REWARD_TICKETS : 0)
        : Math.max(0, Math.round(Number(tickets) || 0));
    if (awarded <= 0 && ticketCount <= 0) return null;
    const plans = rewardNotify.plan({
        uid: String(uid),
        xp: awarded,
        tickets: ticketCount,
        onceKey: 'tctv_watch_' + cleanDay,
        message: noticeMessage(awarded, ticketCount),
        icon: '📺',
        source: 'tctv_watch',
        targetType: 'tctv_watch',
        targetId: cleanDay,
        day: day,
    });
    const plan = plans && plans[0];
    if (!plan || plan.id !== id) return null;
    return plan;
}

// Same shape as planSayHiXp. Tickets are not capped by the daily XP ledger.
function planWatchXp(dailyUsed, pendingOverflow, lastOverflowDate, today, ctx) {
    void pendingOverflow;
    void lastOverflowDate;
    void today;
    const extra = ctx || {};
    const split = planXpGrant({
        base: REWARD_XP,
        user: extra.user,
        now: extra.now,
        dailyUsed: Number(dailyUsed) || 0,
    });
    return {
        awarded: split.awarded,
        base: split.base,
        boosted: split.boosted,
        doubled: split.doubled === true,
        until: split.until || 0,
        dailyXp: split.dailyXp,
        overflowAdded: 0,
        overflowRedeemed: 0,
        pendingOverflow: 0,
        touchOverflow: false,
        tickets: split.awarded > 0 ? REWARD_TICKETS : 0,
    };
}

// A presence doc counts only when its server timestamp is fresh and the
// station is one Timechain TV actually airs.
function presenceIsWatching(presence, nowMs) {
    if (!presence) return false;
    return tctvPresence.isFreshPresence(presence, nowMs)
        && tctvPresence.isTctvStation(presence.station);
}

function emptyView(day) {
    return {
        day: day || '',
        seconds: 0,
        minutes: 0,
        done: false,
        awarded: false,
        showToast: false,
        toastSeen: false,
        xp: 0,
        tickets: 0,
    };
}

// prev.presenceFresh must be true. The callable sets that from the existing
// tctv_presence doc (fresh server timestamp and a real station). A heartbeat
// with no fresh presence is not watch time.
// prev.banned cuts off credit and the prize.
function applyWatchHeartbeat(prev, nowMs) {
    const now = Math.floor(Number(nowMs));
    if (!Number.isFinite(now)) {
        return { ok: false, reason: 'bad-clock', write: false, notice: null, creditSeconds: 0, view: emptyView('') };
    }
    const src = prev || {};
    const day = offsetDateKey(now);
    const toastSeen = src.toastSeen === true;
    const storedDay = typeof src.day === 'string' ? src.day : '';
    let seconds = storedDay === day ? clampSeconds(src.seconds) : 0;
    const awardedDay = typeof src.awardedDay === 'string' ? src.awardedDay : '';
    const awardedToday = awardedDay === day;
    const last = creditMillis(src.lastCreditMs);

    function viewAt(nextSeconds, extra) {
        const done = extra && extra.done != null ? extra.done : (awardedToday || nextSeconds >= GOAL_SECONDS);
        const awarded = !!(extra && extra.awarded);
        return {
            day: day,
            seconds: nextSeconds,
            minutes: Math.min(10, Math.floor(nextSeconds / 60)),
            done: done,
            awarded: awarded,
            showToast: !!(extra && extra.showToast),
            toastSeen: extra && extra.toastSeen != null ? extra.toastSeen : toastSeen,
            xp: awarded ? REWARD_XP : 0,
            tickets: awarded ? REWARD_TICKETS : 0,
        };
    }

    if (src.banned === true) {
        return {
            ok: false,
            reason: 'banned',
            write: false,
            notice: null,
            creditSeconds: 0,
            view: emptyView(day),
        };
    }

    if (src.presenceFresh !== true) {
        return {
            ok: true,
            reason: 'not-watching',
            write: false,
            notice: null,
            creditSeconds: 0,
            view: viewAt(seconds),
        };
    }

    if (seconds >= GOAL_SECONDS && !awardedToday) {
        const showToast = !toastSeen;
        return {
            ok: true,
            reason: 'award',
            write: true,
            creditSeconds: 0,
            notice: buildWatchNotice(src.uid, day),
            state: {
                day: day,
                seconds: GOAL_SECONDS,
                lastCreditMs: last,
                awardedDay: day,
                toastSeen: true,
            },
            view: viewAt(GOAL_SECONDS, { done: true, awarded: true, showToast: showToast, toastSeen: true }),
        };
    }

    if (awardedToday || seconds >= GOAL_SECONDS) {
        return {
            ok: true,
            reason: 'done',
            write: false,
            notice: null,
            creditSeconds: 0,
            view: viewAt(Math.max(seconds, awardedToday ? GOAL_SECONDS : seconds), { done: true }),
        };
    }

    // No previous credit, or the viewer was gone for more than ~3 minutes:
    // start the clock and credit nothing. A new offset day already zeroed seconds.
    if (last == null || now - last > CLOCK_GAP_MS) {
        return {
            ok: true,
            reason: 'clock',
            write: true,
            creditSeconds: 0,
            notice: null,
            state: {
                day: day,
                seconds: seconds,
                lastCreditMs: now,
                awardedDay: awardedDay,
                toastSeen: toastSeen,
            },
            view: viewAt(seconds),
        };
    }

    if (now - last < MIN_GAP_MS) {
        return {
            ok: true,
            reason: 'too-fast',
            write: false,
            notice: null,
            creditSeconds: 0,
            view: viewAt(seconds),
        };
    }

    let credit = Math.min(CREDIT_SECONDS, Math.floor((now - last) / 1000));
    if (credit < 1) credit = 0;
    if (seconds + credit > GOAL_SECONDS) credit = GOAL_SECONDS - seconds;
    const nextSeconds = seconds + credit;
    const justAwarded = nextSeconds >= GOAL_SECONDS;
    const showToast = justAwarded && !toastSeen;
    return {
        ok: true,
        reason: 'credited',
        write: true,
        creditSeconds: credit,
        notice: justAwarded ? buildWatchNotice(src.uid, day) : null,
        state: {
            day: day,
            seconds: nextSeconds,
            lastCreditMs: now,
            awardedDay: justAwarded ? day : awardedDay,
            toastSeen: toastSeen || justAwarded,
        },
        view: viewAt(nextSeconds, {
            done: justAwarded,
            awarded: justAwarded,
            showToast: showToast,
            toastSeen: toastSeen || justAwarded,
        }),
    };
}

// 4 calls per 60 seconds per uid. The credit gap is the real limit; this
// only stops a tight loop from invoking the function. Count is per uid.
// 'done' and 'too-fast' still consult this, and a reject throws, but those
// two reasons do not persist the incremented count.
function nextWatchRate(prev, nowMs) {
    const now = Math.floor(Number(nowMs));
    const src = prev || {};
    const start = creditMillis(src.windowStartMs);
    if (start != null && now - start < RATE_WINDOW_MS) {
        const count = (Math.floor(Number(src.count)) || 0) + 1;
        if (count > RATE_MAX) return { ok: false, count: count, windowStartMs: start };
        return { ok: true, count: count, windowStartMs: start };
    }
    return { ok: true, count: 1, windowStartMs: now };
}

// The card title stays "Watch TV". Progress lives in the subtitle.
function watchButtonText(seconds, done) {
    if (done) return { emoji: '📺', label: 'Watch TV', sub: 'Done ✓' };
    const s = clampSeconds(seconds);
    return { emoji: '📺', label: 'Watch TV', sub: Math.min(10, Math.floor(s / 60)) + '/10 min' };
}

module.exports = {
    CREDIT_SECONDS: CREDIT_SECONDS,
    MIN_GAP_MS: MIN_GAP_MS,
    CLOCK_GAP_MS: CLOCK_GAP_MS,
    GOAL_SECONDS: GOAL_SECONDS,
    REWARD_XP: REWARD_XP,
    REWARD_TICKETS: REWARD_TICKETS,
    RATE_WINDOW_MS: RATE_WINDOW_MS,
    RATE_MAX: RATE_MAX,
    TOAST_TEXT: TOAST_TEXT,
    offsetDateKey: offsetDateKey,
    creditMillis: creditMillis,
    watchNoticeId: watchNoticeId,
    buildWatchNotice: buildWatchNotice,
    planWatchXp: planWatchXp,
    presenceIsWatching: presenceIsWatching,
    applyWatchHeartbeat: applyWatchHeartbeat,
    nextWatchRate: nextWatchRate,
    watchButtonText: watchButtonText,
};
