'use strict';

// Exact-action allowlist for awardPoints.
// Client phrases map to a fixed XP amount (or a closed set of amounts).
// Tickets are never granted here. Every action shares the 500 / 900 / 1,000 taper.

const { planDailyXp, DAILY_CAP, TAPER_FULL_UNTIL, TAPER_HALF_UNTIL } = require('./dailyXp');
const awardEvidence = require('./awardEvidence');

const ALLOWED_ACTION_KEYS = {
    flex_action: true,
    flex_day_complete: true,
    lq_lesson: true,
};

// A Flex day is done at 5 completions. Fewer actions in the catalog means
// the goal is the catalog size, so a short list can still be finished.
const FLEX_DAY_GOAL = 5;

const FLEX_IDS = [
    'steak', 'sunlight', 'dca', 'custody', 'lift', 'meetup', 'lightning', 'read',
    'sleep', 'nokyc', 'node', 'cold', 'fast', 'walk', 'journal', 'meditate', 'teach',
    'water', 'gratitude', 'verify', 'focus', 'risk', 'pattern', 'findq', 'noleverage',
    'gunrange', 'sellchairs', 'starebtc', 'itoldyou', 'pumpndump',
];
const FLEX_ID_SET = new Set(FLEX_IDS);

// Legit client sends 5. Double XP sends 10. The old ceiling was 15; anything else is rejected.
const FLEX_AMOUNTS = { 5: 5, 10: 10 };

const LQ_TITLES = new Set([
    'What is Bitcoin?',
    'Mining & Proof of Work',
    'Nodes & Decentralization',
    'Self-Custody & Your Keys',
    'The Lightning Network',
    "Bitcoin's Fixed Supply",
    'Why Bitcoin, Not Crypto',
    'Privacy & Sovereignty',
]);

const PREDICTION_RESULT = /prediction_correct|correct prediction|correct price prediction/i;

function sanitizeId(value, max) {
    return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, max || 60);
}

function normalizePts(value) {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 0) return -1;
    return n;
}

function unknown() {
    return { ok: false, error: 'Unknown action', awarded: 0, tickets: 0 };
}

function done(fields) {
    const id = fields.id;
    return Object.assign({
        ok: true,
        tickets: 0,
        scope: 'day',
        repeatable: false,
        dailyLimit: 1,
        cooldownMs: 0,
        triviaQuiz: false,
        badge: false,
        requiresDoubleXp: false,
        target: 'x',
        dedupGroup: id,
    }, fields);
}

function payMapped(clientPts, amounts) {
    if (clientPts < 0 || !Object.prototype.hasOwnProperty.call(amounts, clientPts)) return null;
    return amounts[clientPts];
}

// baseMap is payable with no buff. doubleMap is the doubled client amount and
// is payable only while the server Double XP timer is still running.
function payChoice(clientPts, baseMap, doubleMap) {
    if (clientPts < 0) return null;
    if (baseMap && Object.prototype.hasOwnProperty.call(baseMap, clientPts)) {
        return { xp: baseMap[clientPts], requiresDoubleXp: false };
    }
    if (doubleMap && Object.prototype.hasOwnProperty.call(doubleMap, clientPts)) {
        return { xp: doubleMap[clientPts], requiresDoubleXp: true };
    }
    return null;
}

function flexDayGoal(total) {
    const n = total == null ? FLEX_IDS.length : total;
    const size = Math.max(0, parseInt(n, 10) || 0);
    return Math.min(FLEX_DAY_GOAL, size);
}

function flexDayStatus(count, total) {
    const goal = flexDayGoal(total);
    const n = Math.max(0, parseInt(count, 10) || 0);
    return { goal: goal, count: n, complete: goal > 0 && n >= goal };
}

// One full day per offset day. flexFullDays is the number of days that
// reached the goal. The caller writes it only when incremented is true.
function nextFlexFullDays(user, day, count, total) {
    const status = flexDayStatus(count, total);
    const prev = Math.max(0, parseInt(user && user.flexFullDays, 10) || 0);
    const already = !!(user && user.flexFullDay === day);
    if (status.complete && !already) {
        return {
            flexFullDays: prev + 1,
            flexFullDay: day,
            incremented: true,
            complete: true,
            count: status.count,
            goal: status.goal,
        };
    }
    return {
        flexFullDays: prev,
        flexFullDay: (user && user.flexFullDay) || '',
        incremented: false,
        complete: status.complete,
        count: status.count,
        goal: status.goal,
    };
}

// null when the badge is not a flex-all day badge. Otherwise whether
// flexFullDays already covers that many full days.
function flexAllBadgeMet(badgeId, flexFullDays) {
    const match = /^flex_all_(\d+)$/.exec(String(badgeId || ''));
    if (!match) return null;
    const need = parseInt(match[1], 10);
    return (parseInt(flexFullDays, 10) || 0) >= need;
}

function resolveFlex(flexActionId, clientPts) {
    if (!flexActionId || !FLEX_ID_SET.has(flexActionId)) return unknown();
    const choice = payChoice(clientPts, { 5: 5 }, { 10: 10 });
    if (!choice) return unknown();
    return done({
        id: 'flex_action',
        xp: choice.xp,
        requiresDoubleXp: choice.requiresDoubleXp,
        dailyLimit: FLEX_IDS.length,
        dedupGroup: 'flex',
        target: flexActionId,
        flexId: flexActionId,
        unverified: true,
    });
}

function resolveFlexDay(clientPts) {
    if (clientPts !== 50) return unknown();
    return done({
        id: 'flex_day_complete',
        xp: 50,
        dailyLimit: 1,
        dedupGroup: 'flex_day',
        target: 'day',
        unverified: true,
    });
}

function resolveLesson(action) {
    const match = /^📖 Learning Quest: (.+) lesson$/.exec(action);
    if (!match || !LQ_TITLES.has(match[1])) return unknown();
    return done({
        id: 'lq_lesson',
        xp: 50,
        scope: 'once',
        dailyLimit: LQ_TITLES.size,
        dedupGroup: 'lq_lesson',
        target: sanitizeId(match[1], 40),
    });
}

function resolvePhrase(action, ctx) {
    const clientPts = ctx.clientPts;
    const badgeId = ctx.badgeId;
    const channelId = ctx.channelId;

    // Onboarding quest XP is claimOnboardingQuestStep only. awardPoints must
    // not pay a client-supplied quest phrase.
    if (/nacho quest|onboarding quest/i.test(action)) return unknown();

    if (action === 'badge_earned' || /^(?:Badge|🎖️ Badge|🏅 Badge): \S/.test(action)) {
        if (action.indexOf('Hidden Badge:') === 0) return unknown();
        return done({
            id: 'badge_earned',
            xp: 0,
            scope: 'day',
            dailyLimit: 10,
            dedupGroup: 'badge_earned',
            target: badgeId || 'badge',
            badge: true,
        });
    }

    if (action === '🎮 Quiz correct!') {
        const choice = payChoice(clientPts, { 5: 5, 10: 10 }, { 20: 10 });
        if (!choice) return unknown();
        return done({
            id: 'quiz_correct',
            xp: choice.xp,
            requiresDoubleXp: choice.requiresDoubleXp,
            repeatable: true,
            dailyLimit: 100,
            triviaQuiz: true,
            dedupGroup: 'quiz_correct',
        });
    }

    if (action === '📝 Forum post') {
        return done({ id: 'forum_post', xp: 10, dailyLimit: 100, cooldownMs: 60000 });
    }
    if (action === '💬 Forum reply') {
        return done({ id: 'forum_reply', xp: 5, dailyLimit: 200, cooldownMs: 10000 });
    }
    if (action === '💬 Article comment') {
        return done({ id: 'article_comment', xp: 5, dailyLimit: 200, cooldownMs: 10000 });
    }
    if (action === 'Feedback bonus') {
        return done({ id: 'feedback', xp: 5, dailyLimit: 200 });
    }

    const chapter = /^📖 Completed Chapter ([1-7])$/.exec(action);
    if (chapter) {
        return done({
            id: 'story_chapter',
            xp: 15,
            scope: 'once',
            dailyLimit: 7,
            dedupGroup: 'story_chapter',
            target: chapter[1],
        });
    }
    if (action === "📖🎉 Completed Nacho's Story!") {
        return done({ id: 'story_complete', xp: 100, scope: 'once', dailyLimit: 1, target: 'story' });
    }

    if (action === '📈 Price prediction made') {
        return done({ id: 'prediction', xp: 5, dailyLimit: 1, target: 'prediction' });
    }

    const explore = {
        '🗺️ 25% Explored': ['explore_25', 50, '25'],
        '🗺️ 50% Explored': ['explore_50', 100, '50'],
        '🗺️ 75% Explored': ['explore_75', 200, '75'],
        '🗺️ 100% Explored': ['explore_100', 500, '100'],
    };
    if (explore[action]) {
        const row = explore[action];
        return done({
            id: row[0],
            xp: row[1],
            scope: 'once',
            dailyLimit: 4,
            dedupGroup: 'explore',
            target: row[2],
        });
    }

    if (action === '💬 Global Chat') {
        return done({ id: 'chat_message', xp: 5, dailyLimit: 200, cooldownMs: 3000 });
    }

    const streaks = {
        '🔥 3-day chat streak!': ['chat_streak_3', { 10: 10 }, { 20: 20 }, '3'],
        '🔥 7-day chat streak!': ['chat_streak_7', { 25: 25 }, { 50: 50 }, '7'],
        '💎 30-day chat streak!': ['chat_streak_30', { 100: 100 }, { 200: 100 }, '30'],
    };
    if (streaks[action]) {
        const row = streaks[action];
        const choice = payChoice(clientPts, row[1], row[2]);
        if (!choice) return unknown();
        return done({
            id: row[0],
            xp: choice.xp,
            requiresDoubleXp: choice.requiresDoubleXp,
            scope: 'once',
            dailyLimit: 3,
            dedupGroup: 'chat_streak',
            target: row[3],
        });
    }

    if (action === 'Welcome bonus!') {
        return done({ id: 'welcome_bonus', xp: 5, scope: 'once', dailyLimit: 1, target: 'welcome' });
    }
    if (/^✅ Daily visit(?: \(\d+-day streak!\))?$/.test(action)) {
        return done({ id: 'daily_visit', xp: 5, dedupGroup: 'daily_visit', target: 'visit' });
    }
    if (action === '📖 New channel explored') {
        const target = sanitizeId(channelId, 80);
        if (!target) return unknown();
        return done({
            id: 'channel_read',
            xp: 10,
            scope: 'once',
            dailyLimit: 400,
            dedupGroup: 'channel_read',
            target: target,
        });
    }
    if (action === 'Explorer bonus! 10 topics 🎉') {
        return done({ id: 'explore_10', xp: 50, scope: 'once', dailyLimit: 1, target: '10' });
    }
    if (action === '🔗 Anonymous progress merged') {
        return done({
            id: 'anon_merge',
            xp: 0,
            scope: 'once',
            dailyLimit: 1,
            target: 'merge',
        });
    }

    if (action === 'Listened to a full track on Bitcoin Beats 🎵') {
        return done({ id: 'beats_listen', xp: 10, repeatable: true, dailyLimit: 100, unverified: true });
    }
    if (action === 'Uploaded a track to Bitcoin Beats! 🎵') {
        return done({ id: 'beats_upload', xp: 50, dailyLimit: 20 });
    }
    if (action === 'Left a comment on Bitcoin Beats 💬') {
        return done({ id: 'beats_comment', xp: 10, dailyLimit: 100, cooldownMs: 10000 });
    }
    const batch = /^Uploaded (\d+) tracks? to Bitcoin Beats!$/.exec(action);
    if (batch) {
        const n = parseInt(batch[1], 10);
        if (n < 1 || n > 88) return unknown();
        const raw = 25 * n;
        const doubled = raw * 2;
        let xp = null;
        let doubledSend = false;
        if (clientPts === raw) xp = Math.min(raw, 50);
        else if (clientPts === doubled) {
            xp = Math.min(doubled, 50);
            doubledSend = true;
        }
        if (xp == null) return unknown();
        return done({
            id: 'beats_upload_batch',
            xp: xp,
            requiresDoubleXp: doubledSend,
            repeatable: true,
            dailyLimit: 20,
            dedupGroup: 'beats_upload',
        });
    }


    return unknown();
}

function resolveAction(input) {
    const src = input || {};
    const actionKey = String(src.actionKey || '').slice(0, 50);
    const action = String(src.action || src.reason || '').trim().slice(0, 100);
    const badgeId = String(src.badgeId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
    const channelId = String(src.channelId || '').slice(0, 100);
    const flexActionId = String(src.flexActionId || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
    const clientPts = normalizePts(src.pts);

    if (actionKey === 'prediction_correct' || PREDICTION_RESULT.test(action)) {
        return { ok: false, error: 'Prediction results are scored on the server', awarded: 0, tickets: 0 };
    }
    // 100 XP and 1 orange ticket, once per offset day, from tctvWatchHeartbeat.
    if (action === 'tctv_watch_10m' || actionKey === 'tctv_watch_10m') {
        return { ok: false, error: 'Timechain TV watch rewards are granted by the server', awarded: 0, tickets: 0 };
    }
    // Match XP and the win ticket are settled in settlePvpMatch. A renamed
    // reason still matches. Badge claims (badgeId pvp_first and similar) stay.
    const badgeClaim = /^badge_earned$/i.test(action) || /^(?:Badge|🎖️ Badge|🏅 Badge):\s+\S/.test(action);
    if (!badgeClaim && (/pvp/i.test(actionKey) || /pvp/i.test(action))) {
        return { ok: false, error: 'PvP rewards are granted by the server', awarded: 0, tickets: 0 };
    }
    // Combo XP and badges are granted from server-recorded daily zones.
    if (actionKey === 'combo_bonus') return unknown();
    if (actionKey && !ALLOWED_ACTION_KEYS[actionKey]) return unknown();

    if (actionKey === 'flex_action') return resolveFlex(flexActionId, clientPts);
    if (actionKey === 'flex_day_complete') return resolveFlexDay(clientPts);
    if (actionKey === 'lq_lesson') return resolveLesson(action);
    return resolvePhrase(action, { badgeId: badgeId, channelId: channelId, clientPts: clientPts });
}

function planGrant(opts) {
    const src = opts || {};
    const used = Math.max(0, Number(src.dailyUsed) || 0);
    const want = Math.max(0, Number(src.xp) || 0);
    const plan = planDailyXp(used, want);
    return {
        awarded: plan.awarded,
        dropped: want - plan.awarded,
        overflowAdded: 0,
        tickets: 0,
        capped: plan.capped,
        pastCap: plan.pastCap,
        dailyXp: plan.dailyXp,
        dailyCap: DAILY_CAP,
        fullUntil: TAPER_FULL_UNTIL,
        halfUntil: TAPER_HALF_UNTIL,
    };
}

function claimId(resolved, day, count) {
    const group = sanitizeId(resolved.dedupGroup || resolved.id, 40);
    const target = sanitizeId(resolved.target == null ? 'x' : resolved.target, 80);
    const dayKey = sanitizeId(day, 12);
    if (resolved.onceId || resolved.scope === 'once') return ('once_' + group + '_' + target).slice(0, 140);
    if (resolved.repeatable) return (dayKey + '_' + group + '_' + String(count || 0)).slice(0, 140);
    return (dayKey + '_' + group + '_' + target).slice(0, 140);
}

function countDocId(resolved, day) {
    const group = sanitizeId(resolved.dedupGroup || resolved.id, 40);
    if (resolved.scope === 'once') return 'once_' + group;
    return sanitizeId(day, 12) + '_' + group;
}

function applyAward(mem, uid, data, opts) {
    const store = mem || {};
    store.users = store.users || {};
    store.claims = store.claims || {};
    store.counts = store.counts || {};
    store.daily = store.daily || {};
    const user = store.users[uid] || { points: 0, orangeTickets: 0, pendingOverflow: 0, ban_reason: '' };
    store.users[uid] = user;
    const day = (opts && opts.day) || '2026-10-22';
    const pendingOverflow = user.pendingOverflow || 0;
    const orangeTickets = user.orangeTickets || 0;

    const resolved = resolveAction(data || {});
    if (!resolved.ok) {
        return {
            success: false,
            error: resolved.error || 'Unknown action',
            awarded: 0,
            tickets: 0,
            overflowAdded: 0,
            pendingOverflow: pendingOverflow,
            orangeTickets: orangeTickets,
        };
    }
    if (resolved.requiresDoubleXp && !(opts && opts.doubleXpActive)) {
        return {
            success: false,
            error: 'Double XP is not active',
            awarded: 0,
            tickets: 0,
            overflowAdded: 0,
            pendingOverflow: pendingOverflow,
            orangeTickets: orangeTickets,
        };
    }
    if (user.ban_reason) {
        return {
            success: true,
            awarded: 0,
            tickets: 0,
            banned: true,
            overflowAdded: 0,
            pendingOverflow: pendingOverflow,
            orangeTickets: orangeTickets,
        };
    }

    let xp = resolved.xp;
    if (resolved.badge) {
        const catalog = (opts && opts.badgeCatalog) || {};
        const badgeId = String((data && data.badgeId) || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
        if (!badgeId || !Object.prototype.hasOwnProperty.call(catalog, badgeId)) {
            return { success: false, error: 'Unknown badge', awarded: 0, tickets: 0, orangeTickets: orangeTickets };
        }
        xp = catalog[badgeId];
    }
    const pre = awardEvidence.precheck(resolved, data || {});
    if (!pre.ok) {
        return {
            success: false,
            error: pre.error || 'Evidence required',
            awarded: 0,
            tickets: 0,
            overflowAdded: 0,
            pendingOverflow: pendingOverflow,
            orangeTickets: orangeTickets,
        };
    }
    if (pre.target) resolved.target = pre.target;
    if (pre.onceId) resolved.onceId = true;
    if (!resolved.badge && pre.xp != null) xp = pre.xp;

    const daily = store.daily[uid] || { total: 0 };
    const countKey = uid + '/' + countDocId(resolved, day);
    const usedCount = store.counts[countKey] || 0;
    if (usedCount >= resolved.dailyLimit) {
        return {
            success: false,
            error: 'Daily limit reached',
            awarded: 0,
            tickets: 0,
            dailyActionCapped: true,
            overflowAdded: 0,
            pendingOverflow: pendingOverflow,
            orangeTickets: orangeTickets,
        };
    }
    const confirmed = awardEvidence.confirm(resolved, data || {}, {
        uid: uid,
        day: day,
        user: user,
        proof: opts && opts.proof,
        claims: store.claims,
        claimPrefix: uid + '/',
    });
    if (!confirmed.ok) {
        return {
            success: false,
            error: confirmed.error || 'Evidence required',
            awarded: 0,
            tickets: 0,
            overflowAdded: 0,
            pendingOverflow: pendingOverflow,
            orangeTickets: orangeTickets,
        };
    }
    if (!resolved.badge && confirmed.xp != null) xp = confirmed.xp;
    const claimTargets = confirmed.claimTargets && confirmed.claimTargets.length
        ? confirmed.claimTargets
        : [resolved.target];
    const claimKeys = [];
    for (let ci = 0; ci < claimTargets.length; ci++) {
        const marked = Object.assign({}, resolved, { target: claimTargets[ci] });
        claimKeys.push(uid + '/' + claimId(marked, day, usedCount + 1));
    }
    const claimKey = claimKeys[0];
    const badgeKey = uid + '/badge/' + String((data && data.badgeId) || '');
    if (resolved.badge) {
        if (store.claims[badgeKey]) {
            return { success: false, error: 'Badge already awarded', awarded: 0, tickets: 0, orangeTickets: orangeTickets };
        }
    } else if (claimKeys.some(function (key) { return store.claims[key]; })) {
        return {
            success: false,
            error: 'Already claimed',
            awarded: 0,
            tickets: 0,
            dailyActionCapped: true,
            overflowAdded: 0,
            pendingOverflow: pendingOverflow,
            orangeTickets: orangeTickets,
        };
    }

    const unverified = !!(confirmed.unverified || resolved.unverified);
    let grant;
    if (unverified) {
        const usedU = daily.unverified || 0;
        const room = Math.max(0, awardEvidence.UNVERIFIED_DAILY_CAP - usedU);
        const awardedU = Math.min(xp, room);
        grant = {
            awarded: awardedU,
            dropped: xp - awardedU,
            capped: awardedU < xp,
            pastCap: usedU >= awardEvidence.UNVERIFIED_DAILY_CAP,
            dailyXp: daily.total || 0,
            dailyCap: DAILY_CAP,
            fullUntil: TAPER_FULL_UNTIL,
            halfUntil: TAPER_HALF_UNTIL,
        };
        if (awardedU > 0) {
            user.points = (user.points || 0) + awardedU;
            user.unclaimableXp = (user.unclaimableXp || 0) + awardedU;
            daily.unverified = usedU + awardedU;
            store.daily[uid] = daily;
        }
        claimKeys.forEach(function (key) { store.claims[key] = true; });
        store.counts[countKey] = usedCount + 1;
    } else {
        grant = planGrant({
            xp: xp,
            dailyUsed: daily.total || 0,
        });
    }

    if (!unverified && grant.awarded > 0) {
        user.points = (user.points || 0) + grant.awarded;
        daily.total = (daily.total || 0) + grant.awarded;
        store.daily[uid] = daily;
        store.counts[countKey] = usedCount + 1;
        if (!resolved.badge) claimKeys.forEach(function (key) { store.claims[key] = true; });
    }
    if (!unverified && resolved.id === 'anon_merge') {
        claimKeys.forEach(function (key) { store.claims[key] = true; });
        store.counts[countKey] = usedCount + 1;
    }
    // A badge earned at the daily cap is still saved. The XP stays dropped.
    if (resolved.badge && grant.awarded === 0) {
        store.claims[badgeKey] = true;
        store.counts[countKey] = usedCount + 1;
    } else if (resolved.badge && grant.awarded > 0) {
        store.claims[badgeKey] = true;
    }

    return {
        success: true,
        awarded: grant.awarded,
        dropped: grant.dropped,
        badgeSaved: !!resolved.badge,
        tickets: 0,
        overflowAdded: 0,
        overflowRedeemed: 0,
        pendingOverflow: user.pendingOverflow || 0,
        capped: grant.capped,
        pastCap: grant.pastCap,
        dailyXp: grant.dailyXp,
        dailyCap: grant.dailyCap,
        fullUntil: grant.fullUntil,
        halfUntil: grant.halfUntil,
        id: resolved.id,
        orangeTickets: user.orangeTickets || 0,
        banned: false,
    };
}

module.exports = {
    DAILY_CAP: DAILY_CAP,
    FLEX_IDS: FLEX_IDS,
    FLEX_DAY_GOAL: FLEX_DAY_GOAL,
    LQ_TITLES: LQ_TITLES,
    flexDayGoal: flexDayGoal,
    flexDayStatus: flexDayStatus,
    nextFlexFullDays: nextFlexFullDays,
    flexAllBadgeMet: flexAllBadgeMet,
    resolveAction: resolveAction,
    planGrant: planGrant,
    claimId: claimId,
    countDocId: countDocId,
    applyAward: applyAward,
};
