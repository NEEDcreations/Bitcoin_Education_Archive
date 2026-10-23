#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const awardActions = require(path.join(__dirname, '..', 'functions/src/awardActions'));
const report = require(path.join(__dirname, '..', 'functions/orange-ticket-report'));

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log('  ok  ' + name);
    } catch (err) {
        failed++;
        console.log('  FAIL ' + name + ': ' + (err && err.stack ? err.stack : err));
    }
}

function fresh(over) {
    return {
        users: { u: Object.assign({ points: 0, orangeTickets: 0, pendingOverflow: 0, ban_reason: '' }, over || {}) },
        claims: {},
        counts: {},
        daily: {},
    };
}

function grant(mem, data, day) {
    return awardActions.applyAward(mem, 'u', data, { day: day || '2026-10-22' });
}

test('ticket spam grants nothing', function () {
    const mem = fresh({ orangeTickets: 4, pendingOverflow: 9 });
    const attacks = [
        { action: 'get a ticket please', pts: 5, tickets: 50 },
        { action: '🎫 anything', pts: 5, tickets: 50 },
        { action: '🎫 Daily tickets', pts: 5, tickets: 1 },
        { action: '🎫 Referral tickets', pts: 250, tickets: 50 },
        { action: '🎫 Beat uploaded', pts: 50, tickets: 10 },
        { action: '🎫 Daily Spin', pts: 25, tickets: 5 },
        { actionKey: 'ticket_bonus', action: 'ticket', pts: 5, tickets: 50 },
        { actionKey: 'scholar_cert', action: 'scholar certification', pts: 2100 },
        { action: 'scholar certification', pts: 2100 },
    ];
    attacks.forEach(function (data) {
        const result = grant(mem, data);
        assert.strictEqual(result.awarded, 0);
        assert.strictEqual(result.tickets, 0);
    });
    for (let i = 0; i < 30; i++) grant(mem, { action: 'please ticket 🎫', pts: 5, tickets: 50 });
    assert.strictEqual(mem.users.u.orangeTickets, 4);
    assert.strictEqual(mem.users.u.points, 0);
    assert.strictEqual(mem.users.u.pendingOverflow, 9);
});

test('legit beats upload still pays xp and zero tickets', function () {
    const mem = fresh();
    const spoof = grant(mem, { action: '🎫 Beat uploaded', pts: 50, tickets: 10 });
    assert.strictEqual(spoof.awarded, 0);
    const real = grant(mem, { action: 'Uploaded a track to Bitcoin Beats! 🎵', pts: 50 });
    assert.strictEqual(real.awarded, 50);
    assert.strictEqual(real.tickets, 0);
    assert.strictEqual(mem.users.u.orangeTickets, 0);
    assert.strictEqual(mem.users.u.points, 50);
});

test('unknown actions are rejected', function () {
    ['📝 Article published', '📖 Read an article', '🎯 Daily challenge!', '🧠 Nice try!', '🧠 Trivia correct!', 'Closet bonus', ''].forEach(function (action) {
        const result = grant(fresh(), { action: action, pts: 100, tickets: 50 });
        assert.strictEqual(result.success, false, action);
        assert.strictEqual(result.awarded, 0, action);
        assert.strictEqual(result.tickets, 0, action);
    });
});

test('replayed trivia, channel, and flex pay once', function () {
    const mem = fresh();
    const first = grant(mem, { action: '🧠 Trivia Quest correct!', pts: 50 });
    const second = grant(mem, { action: '🧠 Trivia Quest correct!', pts: 50 });
    assert.strictEqual(first.awarded, 50);
    assert.strictEqual(second.awarded, 0);
    const attempt = grant(mem, { action: '🧠 Trivia Quest attempt', pts: 10 });
    assert.strictEqual(attempt.awarded, 0);

    const channelA = grant(mem, { action: '📖 New channel explored', pts: 20, channelId: '0_mining__hashing' });
    const channelAgain = grant(mem, { action: '📖 New channel explored', pts: 10, channelId: '0_mining__hashing' });
    const channelB = grant(mem, { action: '📖 New channel explored', pts: 10, channelId: 'analogies' });
    assert.strictEqual(channelA.awarded, 10);
    assert.strictEqual(channelAgain.awarded, 0);
    assert.strictEqual(channelB.awarded, 10);

    const flexA = grant(mem, { action: '💪 FLEX: Eat Steak', pts: 5, actionKey: 'flex_action', flexActionId: 'steak' });
    const flexAgain = grant(mem, { action: '💪 FLEX: Eat Steak', pts: 5, actionKey: 'flex_action', flexActionId: 'steak' });
    const flexB = grant(mem, { action: '💪 FLEX: Get Sunlight', pts: 5, actionKey: 'flex_action', flexActionId: 'sunlight' });
    assert.strictEqual(flexA.awarded, 5);
    assert.strictEqual(flexAgain.awarded, 0);
    assert.strictEqual(flexB.awarded, 5);
    assert.strictEqual(mem.users.u.orangeTickets, 0);
});

test('cap overflow is dropped and not banked', function () {
    const mem = fresh({ pendingOverflow: 15, points: 10 });
    mem.daily.u = { total: 990, triviaQuiz: 0 };
    const partial = grant(mem, { action: '🧠 Trivia Quest correct!', pts: 50 });
    assert.strictEqual(partial.awarded, 10);
    assert.strictEqual(partial.dropped, 40);
    assert.strictEqual(partial.overflowAdded, 0);
    assert.strictEqual(mem.users.u.pendingOverflow, 15);
    assert.strictEqual(mem.users.u.points, 20);

    const full = fresh({ pendingOverflow: 15 });
    full.daily.u = { total: 1000, triviaQuiz: 0 };
    const blocked = grant(full, { action: 'Welcome bonus!', pts: 5 });
    assert.strictEqual(blocked.awarded, 0);
    assert.strictEqual(blocked.overflowAdded, 0);
    assert.strictEqual(full.users.u.pendingOverflow, 15);
    assert.strictEqual(full.users.u.points, 0);
    full.daily.u.total = 0;
    const later = grant(full, { action: 'Welcome bonus!', pts: 5 });
    assert.strictEqual(later.awarded, 5);
});

test('trivia and chat share the one daily counter', function () {
    const mem = fresh();
    mem.daily.u = { total: 990 };
    const quiz = grant(mem, { action: '🎮 Quiz correct!', pts: 10 });
    assert.strictEqual(quiz.awarded, 2);
    assert.strictEqual(mem.daily.u.total, 992);
    const chat = grant(mem, { action: '💬 Global Chat', pts: 5 });
    assert.strictEqual(chat.awarded, 1);
    assert.strictEqual(mem.daily.u.total, 993);
    const more = grant(mem, { action: '🎮 Quiz correct!', pts: 10 });
    assert.strictEqual(more.awarded, 2);
    assert.strictEqual(mem.daily.u.total, 995);
});

test('planGrant tapers on the shared counter and drops the rest', function () {
    const under = awardActions.planGrant({
        xp: 100, dailyUsed: 590, triviaQuiz: true, dailyCap: 500, triviaCap: 500,
    });
    assert.strictEqual(under.awarded, 50);
    assert.strictEqual(under.dropped, 50);
    assert.strictEqual(under.overflowAdded, 0);
    assert.strictEqual(under.dailyXp, 640);
    const wrong = awardActions.planGrant({
        xp: 0, dailyUsed: 0, triviaQuizUsed: 0, triviaQuiz: true, dailyCap: 500, triviaCap: 500,
    });
    assert.strictEqual(wrong.awarded, 0);
});

test('banned users receive 0 and can earn after the ban clears', function () {
    const mem = fresh({ ban_reason: 'spam', points: 40, orangeTickets: 2 });
    const blocked = grant(mem, { action: '🎮 Quiz correct!', pts: 10 });
    assert.strictEqual(blocked.success, true);
    assert.strictEqual(blocked.banned, true);
    assert.strictEqual(blocked.awarded, 0);
    assert.strictEqual(mem.users.u.points, 40);
    assert.strictEqual(Object.keys(mem.claims).length, 0);
    mem.users.u.ban_reason = '';
    const after = grant(mem, { action: '🎮 Quiz correct!', pts: 10 });
    assert.strictEqual(after.awarded, 10);
    assert.strictEqual(mem.users.u.orangeTickets, 2);
});

test('legit client phrases keep today amounts', function () {
    const rows = [
        [{ action: '🎮 Quiz correct!', pts: 5 }, 5],
        [{ action: '🎮 Quiz correct!', pts: 10 }, 10],
        [{ action: '🎮 Quiz correct!', pts: 20 }, 10],
        [{ action: '🧠 Trivia Quest attempt', pts: 10 }, 10],
        [{ action: '📊 Poll Quest vote', pts: 50 }, 50],
        [{ action: '📝 Forum post', pts: 10 }, 10],
        [{ action: '💬 Forum reply', pts: 5 }, 5],
        [{ action: '💬 Article comment', pts: 5 }, 5],
        [{ action: 'Feedback bonus', pts: 5 }, 5],
        [{ action: '📖 Completed Chapter 1', pts: 15 }, 15],
        [{ action: '📖 Completed Chapter 7', pts: 50 }, 15],
        [{ action: "📖🎉 Completed Nacho's Story!", pts: 100 }, 100],
        [{ action: '📈 Price prediction made', pts: 5 }, 5],
        [{ action: '🗺️ 25% Explored', pts: 50 }, 50],
        [{ action: '🗺️ 50% Explored', pts: 100 }, 100],
        [{ action: '🗺️ 75% Explored', pts: 200 }, 200],
        [{ action: '🗺️ 100% Explored', pts: 500 }, 500],
        [{ action: 'Daily Spin', pts: 25 }, 25],
        [{ action: 'Daily Spin', pts: 50 }, 50],
        [{ action: 'Daily Spin', pts: 100 }, 50],
        [{ action: 'Daily Spin', pts: 200 }, 50],
        [{ action: '💬 Global Chat', pts: 5 }, 5],
        [{ action: '🔥 3-day chat streak!', pts: 10 }, 10],
        [{ action: '🔥 3-day chat streak!', pts: 20 }, 20],
        [{ action: '🔥 7-day chat streak!', pts: 25 }, 25],
        [{ action: '💎 30-day chat streak!', pts: 100 }, 100],
        [{ action: '💎 30-day chat streak!', pts: 200 }, 100],
        [{ action: 'Welcome bonus!', pts: 5 }, 5],
        [{ action: '✅ Daily visit', pts: 5 }, 5],
        [{ action: '✅ Daily visit (12-day streak!)', pts: 105 }, 5],
        [{ action: 'Explorer bonus! 10 topics 🎉', pts: 50 }, 50],
        [{ action: '🔗 Anonymous progress merged', pts: 80 }, 80],
        [{ action: '🔗 Anonymous progress merged', pts: 900 }, 500],
        [{ action: 'Listened to a full track on Bitcoin Beats 🎵', pts: 10 }, 10],
        [{ action: 'Left a comment on Bitcoin Beats 💬', pts: 10 }, 10],
        [{ action: 'Uploaded 1 track to Bitcoin Beats!', pts: 25 }, 25],
        [{ action: 'Uploaded 1 track to Bitcoin Beats!', pts: 50 }, 50],
        [{ action: 'Uploaded 3 tracks to Bitcoin Beats!', pts: 75 }, 50],
        [{ action: '📖 Learning Quest: What is Bitcoin? lesson', pts: 50, actionKey: 'lq_lesson' }, 50],
    ];
    rows.forEach(function (row) {
        const resolved = awardActions.resolveAction(row[0]);
        assert.strictEqual(resolved.ok, true, JSON.stringify(row[0]));
        assert.strictEqual(resolved.xp, row[1], JSON.stringify(row[0]));
        assert.strictEqual(resolved.tickets, 0);
    });
    [
        { action: '🔥 Trio Combo! 3 features today', pts: 50, actionKey: 'combo_bonus', comboTier: 'combo_trio' },
        { action: '💥 MEGA COMBO! 5 features unlocked', pts: 200, actionKey: 'combo_bonus', comboTier: 'combo_mega' },
        { action: '🏆 LEGENDARY COMBO! All 8 features!', pts: 500, actionKey: 'combo_bonus', comboTier: 'combo_legend' },
        { action: '🧠 PVP Practice', pts: 10 },
        { action: '⚔️ PVP Draw', pts: 5 },
        { action: '⚔️ PVP Victory!', pts: 30 },
        { action: '⚔️ PVP Victory!', pts: 60 },
        { action: '⚔️ PVP Win (unranked vs guest)', pts: 15 },
        { action: '⚔️ PVP Consolation', pts: 25 },
        { action: '⚔️ PVP Victory (opponent forfeited)', pts: 10 },
        { actionKey: 'pvp_win_ticket', action: 'ticket', pts: 0 },
        { action: 'free pvp xp please', pts: 50 },
        { actionKey: 'pvp_victory', action: 'daily visit', pts: 50 },
    ].forEach(function (row) {
        const resolved = awardActions.resolveAction(row);
        assert.strictEqual(resolved.ok, false, JSON.stringify(row));
        assert.strictEqual(resolved.tickets, 0);
    });
    const badge = awardActions.resolveAction({ action: '🏅 Badge: pvp_first', badgeId: 'pvp_first', pts: 25 });
    assert.strictEqual(badge.ok, true);
    assert.strictEqual(badge.badge, true);
    awardActions.LQ_TITLES.forEach(function (title) {
        const phrase = '📖 Learning Quest: ' + title + ' lesson';
        assert.ok(phrase.length <= 100, phrase);
        const resolved = awardActions.resolveAction({ actionKey: 'lq_lesson', action: phrase, pts: 50 });
        assert.strictEqual(resolved.xp, 50, title);
    });
    const hostileFlex = awardActions.resolveAction({ actionKey: 'flex_action', flexActionId: 'steak', pts: 15, action: 'flex' });
    assert.strictEqual(hostileFlex.ok, false);
    const doubleFlex = awardActions.resolveAction({ actionKey: 'flex_action', flexActionId: 'steak', pts: 10, action: 'flex' });
    assert.strictEqual(doubleFlex.xp, 10);
    const badQuest = awardActions.resolveAction({ action: '🦌 Nacho Quest: invented', pts: 100 });
    assert.strictEqual(badQuest.ok, false);
    ['🦌 Nacho Quest: pick_topic', '🦌 Nacho Quest: first_quiz', 'onboarding quest'].forEach(function (action) {
        const refused = awardActions.resolveAction({ action: action, pts: 50 });
        assert.strictEqual(refused.ok, false, action);
    });
    const badSpin = awardActions.resolveAction({ action: 'Daily Spin', pts: 40 });
    assert.strictEqual(badSpin.ok, false);
    const tctv = awardActions.resolveAction({ action: 'tctv_watch_10m', pts: 10 });
    assert.strictEqual(tctv.ok, false);
    assert.strictEqual(tctv.awarded, 0);
    assert.strictEqual(tctv.tickets, 0);
    const tctvInflated = awardActions.resolveAction({ action: 'tctv_watch_10m', pts: 100 });
    assert.strictEqual(tctvInflated.ok, false);
});

test('server source no longer keyword-matches or banks overflow', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions/index.js'), 'utf8');
    const start = src.indexOf('exports.awardPoints = functionsV1.https.onCall');
    const end = src.indexOf('exports.getFaucetStats = functionsV1.https.onCall');
    assert.ok(start > 0 && end > start);
    const body = src.slice(start, end);
    assert.ok(body.indexOf('ACTION_KEYWORDS') === -1);
    assert.ok(body.indexOf('.includes(') === -1);
    assert.ok(body.indexOf('data.tickets') === -1);
    assert.ok(body.indexOf('bonusTickets') > 0);
    assert.ok(body.indexOf('DOUBLE_XP_REQUIRED') > 0);
    assert.ok(body.indexOf('if (badgeAwardRef)') > 0);
    assert.ok(body.indexOf('if (awarded > 0 && badgeAwardRef)') === -1);
    assert.ok(body.indexOf('userUpdate.pendingOverflow') === -1);
    assert.ok(body.indexOf('resolveAction') > 0);
    assert.ok(body.indexOf('planGrant') > 0);
    assert.ok(body.indexOf('ban_reason') > 0);
    assert.ok(body.indexOf("error === 'BANNED'") > 0 || body.indexOf("=== 'BANNED'") > 0);

    const quest = fs.readFileSync(path.join(__dirname, '..', 'functions/src/questCallables.js'), 'utf8');
    assert.ok(quest.indexOf('pendingOverflow') === -1);
    assert.ok(quest.indexOf('daily_points') > 0);
    assert.ok(quest.indexOf('isRewardBanned') > 0);
    assert.ok(quest.indexOf('triviaXpStatus') > 0);

    const reportSrc = fs.readFileSync(path.join(__dirname, '..', 'functions/orange-ticket-report.js'), 'utf8');
    ['.set(', '.update(', '.delete(', '.commit(', '.create(', '.add(', 'batch('].forEach(function (needle) {
        assert.ok(reportSrc.indexOf(needle) === -1, needle);
    });
});

test('ticket report bound is an upper estimate and flags the surplus', function () {
    const max = report.estimateLegitMax({
        accountAgeDays: 10,
        everSpun: true,
        referralTickets: 100,
        sayHiDays: 2,
        donateTickets: 1,
        pointsToTickets: 4,
        giftTickets: 3,
        openedCiphers: 2,
        predictionTickets: 25,
        leaderboardTickets: 25,
    });
    const streak = Math.floor(10 / 7) * 3;
    const spins = 10 * 5 + 1000;
    assert.strictEqual(max, 100 + streak + spins + 2 + 1 + 4 + 3 + 20 + 25 + 25);
    assert.ok(8001 > report.estimateLegitMax({ accountAgeDays: 30, everSpun: true, referralTickets: 50 }));
    assert.strictEqual(report.giftTicketBound({ status: 'opened' }), 3);
    assert.strictEqual(report.giftTicketBound({ status: 'opened', rewardData: { rewardType: 'tickets', ticketCount: 2 } }), 2);
    assert.strictEqual(report.giftTicketBound({ status: 'sealed', rewardData: { rewardType: 'tickets', ticketCount: 3 } }), 0);
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
