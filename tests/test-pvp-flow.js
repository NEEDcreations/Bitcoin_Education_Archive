#!/usr/bin/env node
// PvP lobby alerts, shout rate limits, and reward idempotency. No Firebase.
const assert = require('assert');
const flow = require('../functions/src/pvpFlow');
const awardActions = require('../functions/src/awardActions');
const { nyDateKey, offsetDateKey } = require('../functions/src/offsetDay');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
        passed++;
    } catch (e) {
        failed++;
        console.log('  FAIL ' + name + ': ' + e.message);
    }
}

const NOW = 1_700_000_000_000;

test('lobby alert shows once per entry and then cools down', function () {
    const first = flow.decideLobbyAlert({
        entryUid: 'waiter',
        entrySince: 10,
        myUid: 'me',
        seenKeys: {},
        lastAlertMs: 0,
        nowMs: NOW,
        muted: false,
        inPvp: false,
        busy: false,
    });
    assert.strictEqual(first.show, true);
    assert.strictEqual(first.seenKey, 'waiter:10');

    const again = flow.decideLobbyAlert({
        entryUid: 'waiter',
        entrySince: 10,
        myUid: 'me',
        seenKeys: { 'waiter:10': 1 },
        lastAlertMs: NOW,
        nowMs: NOW + 1000,
        muted: false,
        inPvp: false,
        busy: false,
    });
    assert.strictEqual(again.show, false);
    assert.strictEqual(again.reason, 'already_seen');

    const other = flow.decideLobbyAlert({
        entryUid: 'someone-else',
        entrySince: 11,
        myUid: 'me',
        seenKeys: { 'waiter:10': 1 },
        lastAlertMs: NOW,
        nowMs: NOW + 60 * 1000,
        muted: false,
        inPvp: false,
        busy: false,
    });
    assert.strictEqual(other.show, false);
    assert.strictEqual(other.reason, 'cooldown');

    const later = flow.decideLobbyAlert({
        entryUid: 'someone-else',
        entrySince: 11,
        myUid: 'me',
        seenKeys: {},
        lastAlertMs: NOW,
        nowMs: NOW + flow.ALERT_COOLDOWN_MS,
        muted: false,
        inPvp: false,
        busy: false,
    });
    assert.strictEqual(later.show, true);
});

test('lobby alert skips self, muted, in-pvp, and busy users', function () {
    const base = { entryUid: 'waiter', entrySince: 1, myUid: 'me', seenKeys: {}, lastAlertMs: 0, nowMs: NOW };
    assert.strictEqual(flow.decideLobbyAlert(Object.assign({}, base, { entryUid: 'me' })).reason, 'self');
    assert.strictEqual(flow.decideLobbyAlert(Object.assign({}, base, { muted: true })).reason, 'muted');
    assert.strictEqual(flow.decideLobbyAlert(Object.assign({}, base, { inPvp: true })).reason, 'in_pvp');
    assert.strictEqual(flow.decideLobbyAlert(Object.assign({}, base, { busy: true })).reason, 'busy');
});

test('push is opted-in only and stays within a few per week', function () {
    assert.strictEqual(flow.decidePvpPush({ uid: 'a', joinerUid: 'b', optedIn: false, nowMs: NOW }).reason, 'not_opted_in');
    assert.strictEqual(flow.decidePvpPush({ uid: 'b', joinerUid: 'b', optedIn: true, nowMs: NOW }).reason, 'self');
    assert.strictEqual(flow.decidePvpPush({ uid: 'a', joinerUid: 'b', optedIn: true, muted: true, nowMs: NOW }).reason, 'muted');
    const ok = flow.decidePvpPush({ uid: 'a', joinerUid: 'b', optedIn: true, lastPushMs: NOW - flow.PUSH_COOLDOWN_MS, nowMs: NOW });
    assert.strictEqual(ok.send, true);
    const soon = flow.decidePvpPush({ uid: 'a', joinerUid: 'b', optedIn: true, lastPushMs: NOW - 1000, nowMs: NOW });
    assert.strictEqual(soon.reason, 'rate_limited');
});

test('lobby shout is one post per user per 15 minutes', function () {
    const first = flow.shouldPostLobbyShout({ uid: 'uid_a', username: 'Nacho<script>', nowMs: NOW, lastPostMs: null, banned: false });
    assert.strictEqual(first.post, true);
    assert.strictEqual(first.isNachoAuto, false);
    assert.strictEqual(first.authorUid, 'nacho-bot');
    assert.ok(first.text.indexOf('@Nacho') === 0 || first.text.indexOf('@Nacho') > 0);
    assert.ok(first.text.indexOf('<') === -1);
    assert.ok(first.text.indexOf('[Tap to join](#pvp)') !== -1);
    assert.strictEqual(first.docId, flow.lobbyShoutDocId('uid_a', NOW));
    const again = flow.shouldPostLobbyShout({ uid: 'uid_a', username: 'Nacho', nowMs: NOW + 1000, lastPostMs: NOW, banned: false });
    assert.strictEqual(again.reason, 'rate_limited');
    const later = flow.shouldPostLobbyShout({ uid: 'uid_a', username: 'Nacho', nowMs: NOW + flow.LOBBY_SHOUT_MS, lastPostMs: NOW, banned: false });
    assert.strictEqual(later.post, true);
    assert.notStrictEqual(later.docId, first.docId);
    assert.strictEqual(flow.shouldPostLobbyShout({ uid: 'uid_a', username: 'Nacho', nowMs: NOW, banned: true }).reason, 'banned');
    assert.strictEqual(flow.shouldPostLobbyShout({ uid: 'uid_a', username: '', nowMs: NOW }).reason, 'no_username');
    assert.strictEqual(flow.shouldPostLobbyShout({ uid: 'uid_a', username: 'Nacho', nowMs: NOW, anonymous: true }).reason, 'anonymous');
    assert.strictEqual(flow.shouldPostLobbyShout({ uid: 'uid_a', username: 'Nacho', nowMs: NOW, globalCap: true }).reason, 'global_cap');
    const shouted = flow.lobbyShoutText('[Ada](http://x) @#*');
    assert.ok(shouted.indexOf('@Ada') !== -1);
    assert.ok(shouted.indexOf('[Ada]') === -1);
    assert.ok(shouted.indexOf('@#') === -1);
});

test('reward claim is idempotent and banned accounts get no points', function () {
    const match = {
        matchId: 'match_1',
        status: 'finished',
        alreadyGranted: false,
        player1: { uid: 'p1', name: 'Ada', score: 30, roundWins: 3, banned: false, anonymous: false },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1, banned: true, anonymous: false },
    };
    const plan = flow.planPvpReward(match);
    assert.strictEqual(plan.grant, true);
    assert.strictEqual(plan.claimId, 'match_1');
    assert.strictEqual(plan.players[0].points, flow.WIN_POINTS);
    assert.strictEqual(plan.players[0].pvpWins, 1);
    assert.strictEqual(plan.players[1].points, 0);
    assert.strictEqual(plan.players[1].blocked, true);
    assert.strictEqual(plan.players[1].pvpLosses, 1);
    assert.ok(plan.shout && plan.shout.docId === 'pvp_result_match_1');

    const second = flow.planPvpReward(Object.assign({}, match, { alreadyGranted: true }));
    assert.strictEqual(second.grant, false);
    assert.strictEqual(second.reason, 'already_granted');
    assert.strictEqual(second.players.length, 0);
    assert.strictEqual(flow.rewardClaimId('match_1'), plan.claimId);
});

test('a draw pays both sides once and a repeat claim does not', function () {
    const match = {
        matchId: 'draw_9',
        status: 'finished',
        player1: { uid: 'p1', name: 'Ada', score: 10, roundWins: 2, banned: false },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 2, banned: false },
    };
    const plan = flow.planPvpReward(match);
    assert.strictEqual(plan.reason, 'draw');
    assert.strictEqual(plan.players[0].points, flow.DRAW_POINTS);
    assert.strictEqual(plan.players[1].points, flow.DRAW_POINTS);
    assert.strictEqual(plan.players[0].pvpWins, 0);
    const replay = flow.planPvpReward(Object.assign({}, match, { alreadyGranted: true }));
    assert.strictEqual(replay.grant, false);
});

test('client pvp awardPoints reasons are rejected', function () {
    assert.strictEqual(flow.isClientPvpReward('pvp_victory', ''), true);
    assert.strictEqual(flow.isClientPvpReward('', '⚔️ PVP Victory!'), true);
    assert.strictEqual(flow.isClientPvpReward('', '⚔️ PVP Practice'), true);
    assert.strictEqual(flow.isClientPvpReward('', '⚔️ PVP Consolation'), true);
    assert.strictEqual(flow.isClientPvpReward('pvp_win_ticket', 'ticket'), true);
    assert.strictEqual(flow.isClientPvpReward('daily_visit', 'free pvp xp'), true);
    assert.strictEqual(flow.isClientPvpReward('daily_visit', 'daily visit'), false);
    assert.strictEqual(flow.isClientPvpReward('', '🏅 Badge: pvp_first'), false);
});

test('grading ignores a client correct flag and uses the key', function () {
    const round = flow.gradeRound(2, 0, 2, '2026-01-01T00:00:02.000Z', '2026-01-01T00:00:01.000Z');
    assert.strictEqual(round.outcome, 'player1');
    const both = flow.gradeRound(1, 1, 1, '2026-01-01T00:00:05.000Z', '2026-01-01T00:00:01.000Z');
    assert.strictEqual(both.outcome, 'player2');
    const reroll = flow.gradeRound(0, 3, 1);
    assert.strictEqual(reroll.outcome, 'reroll');
    assert.strictEqual(flow.matchShouldFinish(3, 0), true);
    assert.strictEqual(flow.matchShouldFinish(2, 2), false);
});

test('shuffle hides the submitted correct index', function () {
    let n = 0;
    const shuffled = flow.shuffleQuestion({
        q: 'What is the cap?',
        options: ['1', '21 million', 'infinite'],
        correct: 1,
    }, function () {
        n += 1;
        return 0;
    });
    assert.strictEqual(shuffled.options.indexOf('21 million'), shuffled.correct);
    assert.ok(shuffled.correct !== 1 || shuffled.options[1] === '21 million');
});

test('stale lobby rows drop out of the live summary', function () {
    const fresh = flow.mergeLobbyEntry({}, 'u1', { status: 'waiting', uid: 'u1', name: 'Ada', lastSeen: NOW }, NOW);
    assert.strictEqual(fresh.u1.name, 'Ada');
    const gone = flow.mergeLobbyEntry(fresh, 'u1', { status: 'matched', uid: 'u1', name: 'Ada', lastSeen: NOW }, NOW);
    assert.strictEqual(gone.u1, undefined);
    const stale = flow.mergeLobbyEntry({}, 'u2', { status: 'waiting', uid: 'u2', name: 'Bob', lastSeen: NOW - flow.LOBBY_STALE_MS - 1 }, NOW);
    assert.strictEqual(Object.keys(stale).length, 0);
});

test('names lose markdown, heartbeats skip a fresh summary, cleanup keeps trusted rows', function () {
    assert.strictEqual(flow.safeDisplayName('[Ada](http://evil) @#*'), 'Ada http://evil');
    assert.strictEqual(flow.shouldSkipLobbySummary(
        { status: 'waiting', uid: 'u', name: 'x', lastSeen: NOW },
        { status: 'waiting', uid: 'u', name: 'x', lastSeen: NOW + 5000 },
        { name: 'Ada', lastSeen: NOW },
        NOW + 5000
    ), true);
    assert.strictEqual(flow.shouldSkipLobbySummary(
        { status: 'waiting', uid: 'u', name: 'x', lastSeen: NOW },
        { status: 'waiting', uid: 'u', name: 'y', lastSeen: NOW + 5000 },
        { name: 'Ada', lastSeen: NOW },
        NOW + 5000
    ), false);
    const room = flow.lobbyGlobalRoom({ windowStart: NOW, shoutCount: 4, pushCount: 1 }, NOW + 1000);
    assert.strictEqual(room.shout, false);
    assert.strictEqual(room.push, false);
    const fresh = flow.lobbyGlobalRoom({ windowStart: NOW - flow.LOBBY_SHOUT_MS, shoutCount: 4, pushCount: 1 }, NOW);
    assert.strictEqual(fresh.shout, true);
    const kept = flow.trustedLobbyKeep({ uid: 'u', name: 'Ada', since: NOW, lastSeen: NOW }, { status: 'waiting', name: '[hack](x)', lastSeen: NOW }, NOW, false, 'u');
    assert.strictEqual(kept.name, 'Ada');
    assert.strictEqual(flow.trustedLobbyKeep({ name: 'Ada' }, { status: 'waiting', lastSeen: NOW }, NOW, true, 'u'), null);
    assert.strictEqual(flow.trustedLobbyKeep(null, { status: 'waiting', name: 'Client', lastSeen: NOW }, NOW, false, 'u'), null);
});

test('a win ticket is once per win and daily-capped, and XP writes weekly fields', function () {
    const awardActions = require('../functions/src/awardActions');
    assert.strictEqual(flow.planWinTicket({ outcome: 'win', blocked: false, ticketClaimedToday: false }).tickets, 1);
    assert.strictEqual(flow.planWinTicket({ outcome: 'win', blocked: false, ticketClaimedToday: true }).reason, 'daily_cap');
    assert.strictEqual(flow.planWinTicket({ outcome: 'win', blocked: true }).tickets, 0);
    assert.strictEqual(flow.planWinTicket({ outcome: 'loss' }).tickets, 0);
    const grant = awardActions.planGrant({ xp: 50, dailyUsed: 990, dailyCap: awardActions.DAILY_CAP });
    const write = flow.planXpWrite(grant.awarded);
    assert.strictEqual(write.points, grant.awarded);
    assert.strictEqual(write.weeklyXP, grant.awarded);
    assert.strictEqual(write.monthlyXP, grant.awarded);
    assert.strictEqual(write.overflowAdded, 0);
    assert.strictEqual(flow.playerKeyForUid({ player1: 'a', player2: 'b' }, 'b'), 'player2');
    assert.strictEqual(flow.playerKeyForUid({ player1: 'a', player2: 'b' }, 'c'), '');
    assert.strictEqual(flow.pvpPicAllowed('https://evil.example/a.png'), '');
    assert.ok(flow.pvpPicAllowed('https://assets.bitcoineducation.quest/a.png'));
    const week = [];
    for (let i = 0; i < 3; i++) week.push(NOW - flow.PUSH_WEEK_MS + (i + 1) * flow.PUSH_GAP_MS);
    assert.strictEqual(flow.decidePvpPush({ uid: 'a', joinerUid: 'b', optedIn: true, pushTimes: week, nowMs: NOW }).reason, 'rate_limited');
    assert.deepStrictEqual(flow.pushShardOrder(3).slice(0, 3), [3, 4, 5]);
});


test('short matches and a fourth same-pair match pay no XP', function () {
    const base = {
        matchId: 'm2',
        status: 'finished',
        player1: { uid: 'p1', name: 'Ada', score: 30, roundWins: 3 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    };
    const short = flow.planPvpReward(Object.assign({}, base, { durationMs: 5000 }));
    assert.strictEqual(short.grant, true);
    assert.strictEqual(short.reason, 'too_short');
    assert.strictEqual(short.players[0].points, 0);
    assert.strictEqual(short.players[1].points, 0);
    assert.strictEqual(short.players[0].pvpWins, 0);
    assert.strictEqual(short.players[0].pvpLosses, 0);
    assert.strictEqual(short.players[1].pvpWins, 0);
    assert.strictEqual(short.players[1].pvpLosses, 0);
    assert.strictEqual(short.players[0].statsCapped, true);

    const capped = flow.planPvpReward(Object.assign({}, base, { durationMs: 60000, pairMatchesToday: 3 }));
    assert.strictEqual(capped.reason, 'pair_cap');
    assert.strictEqual(capped.players[0].points, 0);
    assert.strictEqual(capped.players[1].points, 0);
    assert.strictEqual(capped.players[0].pvpWins, 0);
    assert.strictEqual(capped.players[0].pvpLosses, 0);
    assert.strictEqual(capped.players[1].pvpWins, 0);
    assert.strictEqual(capped.players[1].pvpLosses, 0);

    const third = flow.planPvpReward(Object.assign({}, base, { durationMs: 60000, pairMatchesToday: 2 }));
    assert.strictEqual(third.reason, 'win');
    assert.strictEqual(third.players[0].points, 50);
    assert.strictEqual(third.players[1].points, 25);
});

test('consolation needs a won round, and young accounts earn no PvP XP', function () {
    const noRound = flow.planPvpReward({
        matchId: 'm3',
        status: 'finished',
        durationMs: 60000,
        pairMatchesToday: 0,
        player1: { uid: 'p1', name: 'Ada', score: 20, roundWins: 3 },
        player2: { uid: 'p2', name: 'Bob', score: 0, roundWins: 0 },
    });
    assert.strictEqual(noRound.players[0].points, 50);
    assert.strictEqual(noRound.players[1].points, 0);

    const young = flow.planPvpReward({
        matchId: 'm4',
        status: 'finished',
        durationMs: 60000,
        pairMatchesToday: 0,
        accountAgeMs: { player1: 2 * 24 * 3600 * 1000, player2: 30 * 24 * 3600 * 1000 },
        player1: { uid: 'p1', name: 'Ada', score: 20, roundWins: 3 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    });
    assert.strictEqual(young.reason, 'young_account');
    assert.strictEqual(young.players[0].points, 0);
    assert.strictEqual(young.players[0].pvpWins, 0);
    assert.strictEqual(young.players[0].statsCapped, true);
    assert.strictEqual(young.players[1].points, 25);
    assert.strictEqual(young.players[1].pvpLosses, 1);
    assert.ok(!young.players[1].statsCapped);

    assert.ok(flow.pairDailyId('2026-11-18', 'b', 'a').indexOf('2026-11-18_a_b') === 0);
    assert.strictEqual(flow.farmDayKey(Date.parse('2026-06-01T04:30:00Z')), '2026-06-01');
});

test('pvp win badges need server-counted wins', function () {
    assert.deepStrictEqual(awardActions.pvpBadgeNeed('pvp_first'), { field: 'pvpWins', need: 1 });
    assert.deepStrictEqual(awardActions.pvpBadgeNeed('pvp_25'), { field: 'pvpWins', need: 25 });
    assert.deepStrictEqual(awardActions.pvpBadgeNeed('pvp_played_10'), { field: 'pvpPlayed', need: 10 });
    assert.deepStrictEqual(awardActions.pvpBadgeNeed('pvp_win_streak_3'), { field: 'pvpBestStreak', need: 3 });
    assert.deepStrictEqual(awardActions.pvpBadgeNeed('pvp_win_streak_5'), { field: 'pvpBestStreak', need: 5 });
    assert.strictEqual(awardActions.pvpBadgeAllowed('pvp_win_streak_3', { pvpBestStreak: 2, pvpWins: 10 }), false);
    assert.strictEqual(awardActions.pvpBadgeAllowed('pvp_win_streak_3', { pvpBestStreak: 3 }), true);
    assert.strictEqual(awardActions.pvpBadgeAllowed('pvp_first', { pvpWins: 0 }), false);
    assert.strictEqual(awardActions.pvpBadgeAllowed('pvp_first', { pvpWins: 1 }), true);
    assert.strictEqual(awardActions.pvpBadgeAllowed('pvp_5', { pvpWins: 4 }), false);
    assert.strictEqual(awardActions.pvpBadgeAllowed('pvp_5', { pvpWins: 5 }), true);
    assert.strictEqual(awardActions.pvpBadgeAllowed('pvp_played_1', { pvpPlayed: 0, pvpWins: 5 }), false);
    assert.strictEqual(awardActions.pvpBadgeAllowed('explorer_10', { pvpWins: 0 }), true);
});

test('awardBadge checks pvp badge counters and finished path grants played badges', function () {
    const awardBadge = fs.readFileSync(path.join(__dirname, '../functions/src/awardBadge.js'), 'utf8');
    assert.ok(awardBadge.includes('pvpBadgeAllowed'), 'awardBadge must check pvp badge counters');
    const src = fs.readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8');
    const finish = src.slice(src.indexOf('exports.onPvpMatchFinished'), src.indexOf('exports.onUserDocCreated'));
    assert.ok(finish.includes("familyFor('pvpPlayed')"), 'finished matches must grant played badges');
    assert.ok(finish.includes('skipUids'), 'played grants must skip anonymous and guest-match uids');
    assert.ok(!src.includes('pvp badge rejected'), 'awardPoints must not log pvp badge rejections with a uid');
});


test('win streak increments on a win and resets on a loss', function () {
    assert.deepStrictEqual(flow.planStreakUpdate(2, 2, 'win'), { pvpWinStreak: 3, pvpBestStreak: 3 });
    assert.deepStrictEqual(flow.planStreakUpdate(4, 4, 'win'), { pvpWinStreak: 5, pvpBestStreak: 5 });
    assert.deepStrictEqual(flow.planStreakUpdate(3, 5, 'loss'), { pvpWinStreak: 0, pvpBestStreak: 5 });
    assert.deepStrictEqual(flow.planStreakUpdate(2, 4, 'draw'), { pvpWinStreak: 2, pvpBestStreak: 4 });
    assert.deepStrictEqual(flow.planStreakUpdate(2, 4, 'void'), { pvpWinStreak: 2, pvpBestStreak: 4 });
});

test('a guest match pays no XP, wins, or tickets to either side', function () {
    const match = {
        matchId: 'm-guest',
        status: 'finished',
        player1: { uid: 'signed', name: 'Ada', score: 30, roundWins: 3, anonymous: false },
        player2: { uid: 'anon', name: 'Guest', score: 10, roundWins: 1, anonymous: true },
    };
    const plan = flow.planPvpReward(match);
    assert.strictEqual(plan.grant, false);
    assert.strictEqual(plan.guestMatch, true);
    assert.strictEqual(plan.reason, 'guest_match');
    assert.strictEqual(plan.shout, null);
    plan.players.forEach(function (p) {
        assert.strictEqual(p.points, 0);
        assert.strictEqual(p.pvpWins, 0);
        assert.strictEqual(p.pvpLosses, 0);
        assert.strictEqual(p.blocked, true);
        assert.strictEqual(flow.planWinTicket(p).tickets, 0);
    });
    const settle = fs.readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8');
    const settleAt = settle.indexOf('async function settlePvpMatch');
    const settleFn = settle.slice(settleAt, settleAt + 12000);
    assert.ok(settleFn.indexOf("plan.reason === 'guest_match'") !== -1);
    const grantAt = settleFn.indexOf('if (!plan.grant)');
    const guestReturn = settleFn.slice(grantAt, grantAt + 600);
    assert.ok(grantAt !== -1 && grantAt > settleFn.indexOf('db.runTransaction'), 'guest no-grant path is inside the transaction');
    assert.ok(guestReturn.indexOf("pvp_rewards") === -1);
    assert.ok(guestReturn.indexOf('rewardsGranted: true') !== -1);
    const signedOnly = flow.planPvpReward({
        matchId: 'm-live',
        status: 'finished',
        player1: { uid: 'a', name: 'Ada', score: 30, roundWins: 3, anonymous: false },
        player2: { uid: 'b', name: 'Bob', score: 10, roundWins: 1, anonymous: false },
    });
    assert.strictEqual(signedOnly.guestMatch, false);
    assert.strictEqual(signedOnly.players[0].points, 50);
    assert.strictEqual(signedOnly.players[0].pvpWins, 1);
});

test('anonymous finish still plans no rewards', function () {
    const plan = flow.planPvpReward({
        matchId: 'm-anon',
        status: 'finished',
        player1: { uid: 'a1', name: 'A', score: 30, roundWins: 3, anonymous: true },
        player2: { uid: 'a2', name: 'B', score: 10, roundWins: 1, anonymous: true },
    });
    assert.strictEqual(plan.guestMatch, true);
    assert.strictEqual(plan.players[0].points, 0);
    assert.strictEqual(plan.players[1].points, 0);
});

test('rate window caps requests and resets after the window', function () {
    const first = flow.planRateWindow(null, 1000, 20, 3600000);
    assert.strictEqual(first.ok, true);
    assert.strictEqual(first.count, 1);
    let state = { windowStartMs: 1000, count: 19 };
    const last = flow.planRateWindow(state, 2000, 20, 3600000);
    assert.strictEqual(last.ok, true);
    assert.strictEqual(last.count, 20);
    const blocked = flow.planRateWindow({ windowStartMs: 1000, count: 20 }, 2000, 20, 3600000);
    assert.strictEqual(blocked.ok, false);
    const reset = flow.planRateWindow({ windowStartMs: 1000, count: 20 }, 1000 + 3600000, 20, 3600000);
    assert.strictEqual(reset.ok, true);
    assert.strictEqual(reset.count, 1);
    assert.strictEqual(flow.PVP_ANON_MATCH_PER_HOUR, 20);
    assert.strictEqual(flow.PVP_SIGNED_MATCH_PER_HOUR, 60);
    assert.strictEqual(flow.PVP_CREATE_BURST, 10);
});

test('a currentQ skip after a reroll is ignored', function () {
    assert.strictEqual(flow.skippedRerollQuestion(
        { questionWinner: 'reroll', currentQ: 1, status: 'question_result' },
        { questionWinner: 'reroll', currentQ: 2, status: 'active' }
    ), true);
    assert.strictEqual(flow.skippedRerollQuestion(
        { questionWinner: 'player1', currentQ: 1, status: 'question_result' },
        { questionWinner: null, currentQ: 2, status: 'active' }
    ), false);
    assert.strictEqual(flow.skippedRerollQuestion(
        { questionWinner: 'reroll', currentQ: 1, status: 'question_result' },
        { questionWinner: null, currentQ: 1, status: 'active' }
    ), false);
});


test('pvp client source has guest copy, clears roundExplain, and drops unused resolveRound', function () {
    const src = fs.readFileSync(path.join(__dirname, '../pvp.js.src'), 'utf8');
    assert.ok(src.indexOf('Playing as a guest. Log in to earn XP, badges, OrangeTix and sats, and to chat.') !== -1);
    assert.ok(src.indexOf('+\' + n + \' XP if logged in') !== -1 || src.indexOf('XP if logged in') !== -1);
    assert.ok(src.indexOf("roundExplain: ''") !== -1);
    assert.ok(src.indexOf('function resolveRound') === -1);
    assert.ok(src.indexOf('function formatQuestionForFirestore') === -1);
    assert.ok(src.indexOf("localStorage.setItem('btc_username', name)") !== -1);
    assert.ok(src.indexOf('Set username in Firestore') === -1);
    assert.ok(src.indexOf('pvpWins: 0') === -1);
    assert.ok(src.indexOf("pts: 1000") !== -1);
    const badges = fs.readFileSync(path.join(__dirname, '../badges.js'), 'utf8');
    assert.ok(badges.indexOf('pvpBestStreak') !== -1);
    assert.ok(badges.indexOf("btc_pvp_win_streak") === -1);
});

test('practice day key is midnight America/New_York, not 5 AM UTC', function () {
    assert.strictEqual(nyDateKey(Date.parse('2026-03-08T04:30:00Z')), '2026-03-07');
    assert.strictEqual(nyDateKey(Date.parse('2026-03-08T05:00:00Z')), '2026-03-08');
    assert.strictEqual(nyDateKey(Date.parse('2026-03-08T06:30:00Z')), '2026-03-08');
    // During Eastern Daylight Time, midnight ET and the 5 AM UTC reward day diverge.
    assert.strictEqual(nyDateKey(Date.parse('2026-06-01T04:30:00Z')), '2026-06-01');
    assert.strictEqual(offsetDateKey(Date.parse('2026-06-01T04:30:00Z')), '2026-05-31');
});

test('a missing finish time fails closed, and duration uses finish minus created', function () {
    assert.strictEqual(flow.matchFinishMs({ finishedAt: 1700000030000 }, 99), 1700000030000);
    assert.strictEqual(flow.matchFinishMs({}, 1700000030000), 1700000030000);
    assert.strictEqual(flow.matchFinishMs({}, { toMillis: function () { return 1700000030000; } }), 1700000030000);
    assert.strictEqual(flow.matchDurationMs(1700000000000, 1700000040000), 40000);
    assert.strictEqual(flow.matchDurationMs(1700000000000, 0), null);
    assert.strictEqual(flow.matchDurationMs(0, 1700000040000), null);

    const unknown = flow.planPvpReward({
        matchId: 'm-dur',
        status: 'finished',
        durationMs: null,
        player1: { uid: 'p1', name: 'Ada', score: 30, roundWins: 3 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    });
    assert.strictEqual(unknown.reason, 'too_short');
    assert.strictEqual(unknown.players[0].points, 0);
    assert.strictEqual(unknown.players[0].pvpWins, 0);

    const byFinish = flow.planPvpReward({
        matchId: 'm-delay',
        status: 'finished',
        durationMs: flow.matchDurationMs(1700000000000, 1700000005000),
        player1: { uid: 'p1', name: 'Ada', score: 30, roundWins: 3 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    });
    assert.strictEqual(byFinish.reason, 'too_short');
    assert.strictEqual(byFinish.players[0].pvpWins, 0);
});

test('a missing creationTime fails the young-account cap closed', function () {
    const missing = flow.planPvpReward({
        matchId: 'm-age',
        status: 'finished',
        durationMs: 60000,
        pairMatchesToday: 0,
        accountAgeMs: { player1: null, player2: 30 * 24 * 3600 * 1000 },
        player1: { uid: 'p1', name: 'Ada', score: 20, roundWins: 3 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    });
    assert.strictEqual(missing.reason, 'young_account');
    assert.strictEqual(missing.players[0].points, 0);
    assert.strictEqual(missing.players[0].pvpWins, 0);
    assert.strictEqual(missing.players[0].statsCapped, true);
    assert.strictEqual(missing.players[1].points, 25);
});

test('farm caps skip win-badge grants for the capped player', function () {
    const stamp = { guestMatch: false, player1: false, player2: false };
    const capped = flow.planPvpReward({
        matchId: 'm-badge',
        status: 'finished',
        durationMs: 60000,
        pairMatchesToday: 3,
        player1: { uid: 'p1', name: 'Ada', score: 30, roundWins: 3 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    });
    const badges = flow.planPvpBadgeGrants(['p1', 'p2'], stamp, capped);
    assert.deepStrictEqual(badges.rewardUids, ['p1', 'p2']);
    assert.deepStrictEqual(badges.winGrantUids, []);

    const young = flow.planPvpReward({
        matchId: 'm-badge2',
        status: 'finished',
        durationMs: 60000,
        accountAgeMs: { player1: 1000, player2: 30 * 24 * 3600 * 1000 },
        player1: { uid: 'p1', name: 'Ada', score: 30, roundWins: 3 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    });
    const youngBadges = flow.planPvpBadgeGrants(['p1', 'p2'], stamp, young);
    assert.deepStrictEqual(youngBadges.winGrantUids, ['p2']);
});

test('settle reads the pair count inside the transaction and uses finish time', function () {
    const src = fs.readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8');
    const start = src.indexOf('async function settlePvpMatch');
    const settle = src.slice(start, start + 12000);
    const txAt = settle.indexOf('db.runTransaction');
    const pairRead = settle.indexOf('await tx.get(pairRef)');
    assert.ok(txAt !== -1 && pairRead !== -1 && pairRead > txAt, 'pair count is read inside the settle transaction');
    assert.ok(settle.indexOf('pairRef.get()') === -1, 'pair count is not read outside the transaction');
    assert.ok(settle.indexOf('matchDurationMs') !== -1, 'duration uses matchDurationMs(created, finish)');
    assert.ok(settle.indexOf('nowMs - created') === -1, 'duration is not Date.now() at settle minus createdAt');
    assert.ok(settle.indexOf('return 0;') !== -1, 'missing creationTime fails closed with age 0');
    const fin = src.slice(src.indexOf('exports.onPvpMatchFinished'), src.indexOf('exports.onUserDocCreated'));
    assert.ok(fin.indexOf('matchFinishMs') !== -1, 'finish time is taken from the match, not settle clock');
    assert.ok(fin.indexOf("familyFor('pvpWins')") !== -1);
    assert.ok(fin.indexOf('winGrantUids') !== -1, 'capped players are skipped for pvpWins grants');
    const rules = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
    assert.ok(/match \/pvp_pair_locks\/\{docId\} \{\s*allow read, write: if false;\s*\}/.test(rules));
    assert.ok(/match \/pvp_pair_daily\/\{docId\} \{\s*allow read, write: if false;\s*\}/.test(rules));
});

console.log(failed ? ('\n' + failed + ' failed') : ('\n' + passed + ' passed'));
if (failed) process.exit(1);
