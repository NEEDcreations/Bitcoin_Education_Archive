'use strict';

// Exact-action allowlist for awardPoints.
// Client phrases map to a fixed XP amount (or a closed set of amounts).
// Tickets are never granted here. Callers drop XP past the daily cap.

const DAILY_CAP = 1000;
const TRIVIA_QUIZ_CAP = 500;

const ALLOWED_ACTION_KEYS = {
    flex_action: true,
    combo_bonus: true,
    lq_lesson: true,
};

const FLEX_IDS = [
    'steak', 'sunlight', 'dca', 'custody', 'lift', 'meetup', 'lightning', 'read',
    'sleep', 'nokyc', 'node', 'cold', 'fast', 'walk', 'journal', 'meditate', 'teach',
    'water', 'gratitude', 'verify', 'focus', 'risk', 'pattern', 'findq', 'noleverage',
    'gunrange', 'sellchairs', 'starebtc', 'itoldyou', 'pumpndump',
];
const FLEX_ID_SET = new Set(FLEX_IDS);

// Legit client sends 5. Double XP sends 10. The old ceiling was 15; anything else is rejected.
const FLEX_AMOUNTS = { 5: 5, 10: 10 };

const COMBO_AMOUNTS = {
    combo_trio: { 50: 50, 100: 100 },
    combo_mega: { 100: 100, 200: 200 },
    combo_legend: { 250: 250, 500: 250 },
};

const NACHO_QUESTS = {
    pick_topic: { 25: 25, 50: 50 },
    send_chat: { 25: 25, 50: 50 },
    spin_wheel: { 25: 25, 50: 50 },
    find_nacho: { 25: 25, 50: 50 },
    first_quiz: { 50: 50, 100: 100 },
};

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
    });
}

function resolveCombo(comboTier, clientPts) {
    const amounts = COMBO_AMOUNTS[comboTier];
    if (!amounts) return unknown();
    const bases = { combo_trio: { 50: 50 }, combo_mega: { 100: 100 }, combo_legend: { 250: 250 } };
    const doubles = { combo_trio: { 100: 100 }, combo_mega: { 200: 200 }, combo_legend: { 500: 250 } };
    const choice = payChoice(clientPts, bases[comboTier], doubles[comboTier]);
    if (!choice) return unknown();
    return done({
        id: 'combo_bonus',
        xp: choice.xp,
        requiresDoubleXp: choice.requiresDoubleXp,
        dailyLimit: 3,
        dedupGroup: 'combo',
        target: comboTier,
        comboTier: comboTier,
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

    if (action === '🧠 Trivia Quest correct!') {
        return done({
            id: 'trivia_correct',
            xp: 50,
            dedupGroup: 'trivia',
            target: 'trivia',
            triviaQuiz: true,
        });
    }
    if (action === '🧠 Trivia Quest attempt') {
        return done({
            id: 'trivia_attempt',
            xp: 10,
            dedupGroup: 'trivia',
            target: 'trivia',
            triviaQuiz: true,
        });
    }
    if (action === '📊 Poll Quest vote') {
        return done({ id: 'poll_vote', xp: 50, dedupGroup: 'poll_vote', target: 'poll' });
    }

    if (action === '📝 Forum post') {
        return done({ id: 'forum_post', xp: 10, repeatable: true, dailyLimit: 100, cooldownMs: 60000 });
    }
    if (action === '💬 Forum reply') {
        return done({ id: 'forum_reply', xp: 5, repeatable: true, dailyLimit: 200, cooldownMs: 10000 });
    }
    if (action === '💬 Article comment') {
        return done({ id: 'article_comment', xp: 5, repeatable: true, dailyLimit: 200, cooldownMs: 10000 });
    }
    if (action === 'Feedback bonus') {
        return done({ id: 'feedback', xp: 5, repeatable: true, dailyLimit: 200 });
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
        return done({ id: 'prediction', xp: 5, repeatable: true, dailyLimit: 200 });
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

    if (action === 'Daily Spin') {
        const choice = payChoice(clientPts, { 25: 25, 50: 50, 100: 50 }, { 200: 50 });
        if (!choice) return unknown();
        return done({
            id: 'daily_spin',
            xp: choice.xp,
            requiresDoubleXp: choice.requiresDoubleXp,
            dedupGroup: 'daily_spin',
            target: 'spin',
        });
    }

    if (action === '💬 Global Chat') {
        return done({ id: 'chat_message', xp: 5, repeatable: true, dailyLimit: 200, cooldownMs: 3000 });
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
        if (clientPts <= 0 || clientPts > 2200) return unknown();
        return done({
            id: 'anon_merge',
            xp: Math.min(clientPts, 500),
            requiresDoubleXp: clientPts > 500,
            scope: 'once',
            dailyLimit: 1,
            target: 'merge',
        });
    }

    if (action === 'Listened to a full track on Bitcoin Beats 🎵') {
        return done({ id: 'beats_listen', xp: 10, repeatable: true, dailyLimit: 100 });
    }
    if (action === 'Uploaded a track to Bitcoin Beats! 🎵') {
        return done({ id: 'beats_upload', xp: 50, repeatable: true, dailyLimit: 20 });
    }
    if (action === 'Left a comment on Bitcoin Beats 💬') {
        return done({ id: 'beats_comment', xp: 10, repeatable: true, dailyLimit: 100, cooldownMs: 10000 });
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
            dedupGroup: 'beats_upload_batch',
        });
    }

    const quest = /^🦌 Nacho Quest: ([a-z0-9_]+)$/.exec(action);
    if (quest) {
        const amounts = NACHO_QUESTS[quest[1]];
        if (!amounts) return unknown();
        const base = {};
        const doubled = {};
        Object.keys(amounts).forEach(function(key) {
            const n = parseInt(key, 10);
            const half = n / 2;
            if (Object.prototype.hasOwnProperty.call(amounts, half)) doubled[n] = amounts[n];
            else base[n] = amounts[n];
        });
        const choice = payChoice(clientPts, base, doubled);
        if (!choice) return unknown();
        return done({
            id: 'nacho_quest',
            xp: choice.xp,
            requiresDoubleXp: choice.requiresDoubleXp,
            scope: 'once',
            dailyLimit: 5,
            dedupGroup: 'nacho_quest',
            target: quest[1],
        });
    }

    if (action === '🧠 PVP Practice') {
        return done({ id: 'pvp_practice', xp: 10, repeatable: true, dailyLimit: 100 });
    }
    if (action === '⚔️ PVP Draw') {
        return done({ id: 'pvp_draw', xp: 5, repeatable: true, dailyLimit: 200 });
    }
    if (action === '⚔️ PVP Victory!') {
        const choice = payChoice(clientPts, { 10: 10, 20: 20, 30: 30, 40: 40, 50: 50 }, { 60: 50, 80: 50, 100: 50 });
        if (!choice) return unknown();
        return done({
            id: 'pvp_victory',
            xp: choice.xp,
            requiresDoubleXp: choice.requiresDoubleXp,
            repeatable: true,
            dailyLimit: 20,
            dedupGroup: 'pvp_victory',
        });
    }
    if (action === '⚔️ PVP Victory (opponent forfeited)') {
        const choice = payChoice(clientPts, { 10: 10, 20: 20, 30: 30, 40: 40, 50: 50 }, { 60: 50, 80: 50, 100: 50 });
        if (!choice) return unknown();
        return done({
            id: 'pvp_forfeit',
            xp: choice.xp,
            requiresDoubleXp: choice.requiresDoubleXp,
            repeatable: true,
            dailyLimit: 20,
            dedupGroup: 'pvp_forfeit',
        });
    }
    if (action === '⚔️ PVP Win (unranked vs guest)') {
        const choice = payChoice(clientPts, { 5: 5, 10: 10, 15: 15, 20: 20, 25: 25 }, { 30: 30, 40: 40, 50: 50 });
        if (!choice) return unknown();
        return done({
            id: 'pvp_unranked',
            xp: choice.xp,
            requiresDoubleXp: choice.requiresDoubleXp,
            repeatable: true,
            dailyLimit: 20,
            dedupGroup: 'pvp_unranked',
        });
    }
    if (action === '⚔️ PVP Consolation') {
        const choice = payChoice(clientPts, { 5: 5, 10: 10, 15: 15, 20: 20, 25: 25 }, { 30: 25, 40: 25, 50: 25 });
        if (!choice) return unknown();
        return done({
            id: 'pvp_consolation',
            xp: choice.xp,
            requiresDoubleXp: choice.requiresDoubleXp,
            repeatable: true,
            dailyLimit: 40,
            dedupGroup: 'pvp_consolation',
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
    const comboTier = String(src.comboTier || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
    const clientPts = normalizePts(src.pts);

    if (actionKey === 'prediction_correct' || PREDICTION_RESULT.test(action)) {
        return { ok: false, error: 'Prediction results are scored on the server', awarded: 0, tickets: 0 };
    }
    // 100 XP and 1 orange ticket, once per offset day, from tctvWatchHeartbeat.
    if (action === 'tctv_watch_10m' || actionKey === 'tctv_watch_10m') {
        return { ok: false, error: 'Timechain TV watch rewards are granted by the server', awarded: 0, tickets: 0 };
    }
    if (actionKey && !ALLOWED_ACTION_KEYS[actionKey]) return unknown();

    if (actionKey === 'flex_action') return resolveFlex(flexActionId, clientPts);
    if (actionKey === 'combo_bonus') return resolveCombo(comboTier, clientPts);
    if (actionKey === 'lq_lesson') return resolveLesson(action);
    return resolvePhrase(action, { badgeId: badgeId, channelId: channelId, clientPts: clientPts });
}

function planGrant(opts) {
    const src = opts || {};
    const cap = src.dailyCap == null ? DAILY_CAP : src.dailyCap;
    const triviaCap = src.triviaCap == null ? TRIVIA_QUIZ_CAP : src.triviaCap;
    const used = Math.max(0, Number(src.dailyUsed) || 0);
    const triviaUsed = Math.max(0, Number(src.triviaQuizUsed) || 0);
    let room = Math.max(0, cap - used);
    if (src.triviaQuiz) room = Math.min(room, Math.max(0, triviaCap - triviaUsed));
    const want = Math.max(0, Number(src.xp) || 0);
    const awarded = Math.min(want, room);
    return {
        awarded: awarded,
        dropped: want - awarded,
        overflowAdded: 0,
        tickets: 0,
        capped: (used + awarded >= cap) || (!!src.triviaQuiz && triviaUsed + awarded >= triviaCap),
    };
}

function claimId(resolved, day, count) {
    const group = sanitizeId(resolved.dedupGroup || resolved.id, 40);
    const target = sanitizeId(resolved.target == null ? 'x' : resolved.target, 80);
    const dayKey = sanitizeId(day, 12);
    if (resolved.scope === 'once') return ('once_' + group + '_' + target).slice(0, 140);
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

    const daily = store.daily[uid] || { total: 0, triviaQuiz: 0 };
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
    const claimKey = uid + '/' + claimId(resolved, day, usedCount + 1);
    const badgeKey = uid + '/badge/' + String((data && data.badgeId) || '');
    if (resolved.badge) {
        if (store.claims[badgeKey]) {
            return { success: false, error: 'Badge already awarded', awarded: 0, tickets: 0, orangeTickets: orangeTickets };
        }
    } else if (store.claims[claimKey]) {
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

    const grant = planGrant({
        xp: xp,
        dailyUsed: daily.total || 0,
        triviaQuizUsed: daily.triviaQuiz || 0,
        triviaQuiz: resolved.triviaQuiz,
        dailyCap: opts && opts.dailyCap != null ? opts.dailyCap : DAILY_CAP,
        triviaCap: opts && opts.triviaCap != null ? opts.triviaCap : TRIVIA_QUIZ_CAP,
    });

    if (grant.awarded > 0) {
        user.points = (user.points || 0) + grant.awarded;
        daily.total = (daily.total || 0) + grant.awarded;
        if (resolved.triviaQuiz) daily.triviaQuiz = (daily.triviaQuiz || 0) + grant.awarded;
        store.daily[uid] = daily;
        store.counts[countKey] = usedCount + 1;
        if (!resolved.badge) store.claims[claimKey] = true;
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
        id: resolved.id,
        orangeTickets: user.orangeTickets || 0,
        banned: false,
    };
}

module.exports = {
    DAILY_CAP: DAILY_CAP,
    TRIVIA_QUIZ_CAP: TRIVIA_QUIZ_CAP,
    FLEX_IDS: FLEX_IDS,
    LQ_TITLES: LQ_TITLES,
    resolveAction: resolveAction,
    planGrant: planGrant,
    claimId: claimId,
    countDocId: countDocId,
    applyAward: applyAward,
};
