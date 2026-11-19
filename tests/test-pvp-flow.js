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
    assert.strictEqual(short.shout, null);

    const capped = flow.planPvpReward(Object.assign({}, base, { durationMs: 60000, pairMatchesToday: 3 }));
    assert.strictEqual(capped.reason, 'pair_cap');
    assert.strictEqual(capped.players[0].points, 0);
    assert.strictEqual(capped.players[1].points, 0);
    assert.strictEqual(capped.players[0].pvpWins, 0);
    assert.strictEqual(capped.players[0].pvpLosses, 0);
    assert.strictEqual(capped.players[1].pvpWins, 0);
    assert.strictEqual(capped.players[1].pvpLosses, 0);
    assert.strictEqual(capped.shout, null);

    const third = flow.planPvpReward(Object.assign({}, base, { durationMs: 60000, pairMatchesToday: 2 }));
    assert.strictEqual(third.reason, 'win');
    assert.strictEqual(third.players[0].points, 50);
    assert.strictEqual(third.players[1].points, 25);
    assert.ok(third.shout && third.shout.post === true);
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
    assert.strictEqual(young.shout, null);

    assert.ok(flow.pairDailyId('2026-11-18', 'b', 'a').indexOf('2026-11-18_a_b') === 0);
    assert.strictEqual(flow.farmDayKey(Date.parse('2026-06-01T04:30:00Z')), '2026-06-01');
    // 2026-11-18 is EST. End of day + 2 days = 2026-11-21 00:00 ET.
    assert.strictEqual(flow.pairDailyExpireAtMs('2026-11-18'), Date.parse('2026-11-21T00:00:00-05:00'));
    // DST fall-back weekend: 2026-10-31 is EDT, expire lands on EST midnight Nov 3.
    assert.strictEqual(flow.pairDailyExpireAtMs('2026-10-31'), Date.parse('2026-11-03T00:00:00-05:00'));
    assert.strictEqual(flow.pairDailyExpireAtMs(''), 0);
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
    assert.ok(finish.includes('skipUids.indexOf(rewardUids[ri])'), 'played family is not granted for capped, void, or disconnect uids');
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
    assert.strictEqual(flow.shouldIncrementPairDaily(plan, { guestMatch: true, player1: false, player2: true }), false);
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
    assert.deepStrictEqual(badges.skipUids, ['p1', 'p2']);

    const short = flow.planPvpReward({
        matchId: 'm-badge-short',
        status: 'finished',
        durationMs: 5000,
        player1: { uid: 'p1', name: 'Ada', score: 30, roundWins: 3 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    });
    const shortBadges = flow.planPvpBadgeGrants(['p1', 'p2'], stamp, short);
    assert.deepStrictEqual(shortBadges.skipUids, ['p1', 'p2']);
    assert.deepStrictEqual(shortBadges.winGrantUids, []);

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
    assert.deepStrictEqual(youngBadges.skipUids, ['p1']);
});

test('an instant tied forfeit does not count as played', function () {
    const stamp = { guestMatch: false, player1: false, player2: false };
    const voided = flow.planPvpReward({
        matchId: 'm-void',
        status: 'forfeit',
        forfeitReason: 'manual_leave',
        forfeitedBy: 'p1',
        durationMs: 1000,
        pairMatchesToday: 0,
        player1: { uid: 'p1', name: 'Ada', score: 10, roundWins: 1 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    });
    assert.strictEqual(voided.reason, 'forfeit_void');
    const badges = flow.planPvpBadgeGrants(['p1', 'p2'], stamp, voided);
    assert.deepStrictEqual(badges.skipUids, ['p1', 'p2']);
    assert.deepStrictEqual(badges.winGrantUids, []);
});

test('a disconnect does not count as played', function () {
    const stamp = { guestMatch: false, player1: false, player2: false };
    const disc = flow.planPvpReward({
        matchId: 'm-disc',
        status: 'forfeit',
        forfeitReason: 'disconnect',
        forfeitedBy: 'p1',
        durationMs: 60000,
        pairMatchesToday: 0,
        player1: { uid: 'p1', name: 'Ada', score: 20, roundWins: 2 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    });
    assert.strictEqual(disc.reason, 'disconnect');
    assert.strictEqual(disc.grant, false);
    assert.strictEqual(disc.voided, true);
    assert.strictEqual(disc.players.length, 0, 'a disconnect stays void: no win or loss');
    const badges = flow.planPvpBadgeGrants(['p1', 'p2'], stamp, disc);
    assert.deepStrictEqual(badges.skipUids, ['p1', 'p2']);
    assert.deepStrictEqual(badges.winGrantUids, []);
    assert.strictEqual(flow.shouldIncrementPairDaily(disc, stamp), true, 'a disconnect still counts toward the pair cap');
});

test('repeated disconnects between the same pair reach the pair cap', function () {
    const stamp = { guestMatch: false, player1: false, player2: false };
    const discInput = {
        matchId: 'm-disc-cap',
        status: 'forfeit',
        forfeitReason: 'disconnect',
        forfeitedBy: 'p1',
        durationMs: 60000,
        player1: { uid: 'p1', name: 'Ada', score: 20, roundWins: 2 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    };
    let pairMatchesToday = 0;
    for (let i = 0; i < flow.PAIR_XP_CAP; i++) {
        const disc = flow.planPvpReward(Object.assign({}, discInput, {
            matchId: 'm-disc-cap-' + i,
            pairMatchesToday: pairMatchesToday,
        }));
        assert.strictEqual(disc.reason, 'disconnect');
        assert.strictEqual(disc.grant, false);
        assert.strictEqual(disc.voided, true);
        assert.strictEqual(flow.shouldIncrementPairDaily(disc, stamp), true);
        const badges = flow.planPvpBadgeGrants(['p1', 'p2'], stamp, disc);
        assert.deepStrictEqual(badges.skipUids, ['p1', 'p2']);
        assert.deepStrictEqual(badges.winGrantUids, []);
        pairMatchesToday += 1;
    }
    assert.strictEqual(pairMatchesToday, flow.PAIR_XP_CAP);

    const nextWin = flow.planPvpReward({
        matchId: 'm-after-disconnects',
        status: 'finished',
        durationMs: 60000,
        pairMatchesToday: pairMatchesToday,
        player1: { uid: 'p1', name: 'Ada', score: 30, roundWins: 3 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    });
    assert.strictEqual(nextWin.reason, 'pair_cap');
    assert.strictEqual(nextWin.players[0].points, 0);
    assert.strictEqual(nextWin.players[0].pvpWins, 0);
    assert.strictEqual(nextWin.players[1].points, 0);
    const nextBadges = flow.planPvpBadgeGrants(['p1', 'p2'], stamp, nextWin);
    assert.deepStrictEqual(nextBadges.skipUids, ['p1', 'p2']);
    assert.deepStrictEqual(nextBadges.winGrantUids, []);
    assert.strictEqual(flow.shouldIncrementPairDaily(nextWin, stamp), true);

    // A tied forfeit still does not increment the cap.
    const tied = flow.planPvpReward({
        matchId: 'm-tied-after',
        status: 'forfeit',
        forfeitReason: 'manual_leave',
        forfeitedBy: 'p1',
        durationMs: 1000,
        pairMatchesToday: 0,
        player1: { uid: 'p1', name: 'Ada', score: 10, roundWins: 1 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    });
    assert.strictEqual(tied.reason, 'forfeit_void');
    assert.strictEqual(flow.shouldIncrementPairDaily(tied, stamp), false);
    assert.strictEqual(flow.shouldIncrementPairDaily(tied, { guestMatch: true }), false);
});

test('a normal 30s+ finished match still counts as played', function () {
    const stamp = { guestMatch: false, player1: false, player2: false };
    const ok = flow.planPvpReward({
        matchId: 'm-ok',
        status: 'finished',
        durationMs: 30000,
        pairMatchesToday: 0,
        player1: { uid: 'p1', name: 'Ada', score: 30, roundWins: 3 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    });
    assert.strictEqual(ok.reason, 'win');
    const badges = flow.planPvpBadgeGrants(['p1', 'p2'], stamp, ok);
    assert.deepStrictEqual(badges.rewardUids, ['p1', 'p2']);
    assert.deepStrictEqual(badges.skipUids, []);
    assert.deepStrictEqual(badges.winGrantUids, ['p1', 'p2']);
});

test('a null plan, unexpected reason, or failed settle does not count as played', function () {
    const stamp = { guestMatch: false, player1: false, player2: false };

    const noPlan = flow.planPvpBadgeGrants(['p1', 'p2'], stamp, null);
    assert.deepStrictEqual(noPlan.skipUids, ['p1', 'p2']);
    assert.deepStrictEqual(noPlan.winGrantUids, []);
    assert.deepStrictEqual(noPlan.rewardUids, ['p1', 'p2']);

    const unexpected = flow.planPvpBadgeGrants(['p1', 'p2'], stamp, {
        reason: 'mystery',
        grant: true,
        players: [{ uid: 'p1' }, { uid: 'p2' }],
    });
    assert.deepStrictEqual(unexpected.skipUids, ['p1', 'p2']);
    assert.deepStrictEqual(unexpected.winGrantUids, []);

    const noMatch = flow.planPvpReward({
        status: 'finished',
        player1: { uid: 'p1', name: 'Ada', score: 30, roundWins: 3 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    });
    assert.strictEqual(noMatch.reason, 'no_match');
    const noMatchBadges = flow.planPvpBadgeGrants(['p1', 'p2'], stamp, noMatch);
    assert.deepStrictEqual(noMatchBadges.skipUids, ['p1', 'p2']);
    assert.deepStrictEqual(noMatchBadges.winGrantUids, []);

    const badPlayers = flow.planPvpReward({
        matchId: 'm-bad-players',
        status: 'finished',
        player1: { uid: 'p1', name: 'Ada', score: 30, roundWins: 3 },
        player2: { uid: 'p1', name: 'Bob', score: 10, roundWins: 1 },
    });
    assert.strictEqual(badPlayers.reason, 'bad_players');
    const badPlayersBadges = flow.planPvpBadgeGrants(['p1', 'p2'], stamp, badPlayers);
    assert.deepStrictEqual(badPlayersBadges.skipUids, ['p1', 'p2']);
    assert.deepStrictEqual(badPlayersBadges.winGrantUids, []);

    const already = flow.planPvpReward({
        matchId: 'm-already',
        status: 'finished',
        alreadyGranted: true,
        player1: { uid: 'p1', name: 'Ada', score: 30, roundWins: 3 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    });
    assert.strictEqual(already.reason, 'already_granted');
    const alreadyBadges = flow.planPvpBadgeGrants(['p1', 'p2'], stamp, already);
    assert.deepStrictEqual(alreadyBadges.skipUids, ['p1', 'p2']);
    assert.deepStrictEqual(alreadyBadges.winGrantUids, []);

    const badForfeit = flow.planPvpReward({
        matchId: 'm-bad-forfeit',
        status: 'forfeit',
        forfeitReason: 'manual_leave',
        forfeitedBy: 'someone-else',
        player1: { uid: 'p1', name: 'Ada', score: 20, roundWins: 2 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    });
    assert.strictEqual(badForfeit.reason, 'bad_forfeit');
    const badForfeitBadges = flow.planPvpBadgeGrants(['p1', 'p2'], stamp, badForfeit);
    assert.deepStrictEqual(badForfeitBadges.skipUids, ['p1', 'p2']);
    assert.deepStrictEqual(badForfeitBadges.winGrantUids, []);
});

test('onPvpMatchFinished treats a thrown or null settle as a null plan', function () {
    const src = fs.readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8');
    const fin = src.slice(src.indexOf('exports.onPvpMatchFinished'), src.indexOf('exports.onUserDocCreated'));
    assert.ok(fin.indexOf('let settled = null;') !== -1, 'settled starts null so a thrown settle cannot leave a stale plan');
    const tryAt = fin.indexOf('settled = await settlePvpMatch');
    const catchAt = fin.indexOf("} catch (e) { console.error('[onPvpMatchFinished] settle failed:'");
    const badgeAt = fin.indexOf('planPvpBadgeGrants(sideUids, stamp, settled && settled.plan)');
    assert.ok(tryAt !== -1 && catchAt !== -1 && badgeAt !== -1, 'settle is tried, caught, then planned');
    assert.ok(tryAt < catchAt && catchAt < badgeAt, 'a thrown settle leaves settled null before the badge plan');
    // An existing pvp_rewards doc returns { plan: null } from settlePvpMatch.
    const start = src.indexOf('async function settlePvpMatch');
    const settle = src.slice(start, start + 12000);
    assert.ok(settle.indexOf('if (existing.exists) return false;') !== -1, 'an existing reward doc does not mint a second grant');
    assert.ok(/return \{ plan: plan, stamp: stamp \};/.test(settle), 'settle returns the plan, which stays null when the reward doc already exists');
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
    assert.ok(settle.indexOf('pairDailyExpireAtMs') !== -1, 'pair daily docs get an expireAt');
    assert.ok(settle.indexOf('shouldIncrementPairDaily') !== -1, 'settle uses shouldIncrementPairDaily for the pair cap');
    assert.ok(settle.indexOf('!plan.voided') === -1, 'a voided disconnect no longer skips the pair-cap write');
    const earlyAt = settle.indexOf("if (!plan.grant)");
    const earlyEnd = settle.indexOf('return false;', earlyAt);
    const early = earlyAt !== -1 && earlyEnd !== -1 ? settle.slice(earlyAt, earlyEnd) : '';
    assert.ok(early.indexOf('shouldIncrementPairDaily') !== -1 && early.indexOf('writePairDaily') !== -1, 'a no-grant disconnect still writes pvp_pair_daily');
    const lockAt = early.indexOf('tx.set(rewardRef');
    const pairAt = early.indexOf('writePairDaily');
    assert.ok(lockAt !== -1 && pairAt !== -1 && lockAt < pairAt, 'the pvp_rewards lock is written before the pair-cap increment');
    assert.ok(early.indexOf('applied: []') !== -1 && early.indexOf('reason: plan.reason') !== -1, 'the no-grant lock is an empty applied row with the plan reason');
    assert.ok(settle.indexOf('if (existing.exists) return false;') !== -1, 'an existing reward lock makes a retry a no-op');
    assert.ok(settle.indexOf('ttls update') === -1 && src.indexOf('enable-ttl') === -1, 'this PR does not create a TTL policy');
});

test('settling the same disconnect twice increments the pair cap only once', function () {
    const stamp = { guestMatch: false, player1: false, player2: false };
    const disc = flow.planPvpReward({
        matchId: 'm-disc-retry',
        status: 'forfeit',
        forfeitReason: 'disconnect',
        forfeitedBy: 'p1',
        durationMs: 60000,
        pairMatchesToday: 0,
        player1: { uid: 'p1', name: 'Ada', score: 20, roundWins: 2 },
        player2: { uid: 'p2', name: 'Bob', score: 10, roundWins: 1 },
    });
    assert.strictEqual(disc.reason, 'disconnect');
    assert.strictEqual(disc.grant, false);
    assert.strictEqual(flow.shouldIncrementPairDaily(disc, stamp), true);

    // Same protocol as settlePvpMatch: the pvp_rewards doc is the lock.
    // A retried or concurrent delivery that already sees the lock must not
    // increment pvp_pair_daily again.
    const claimId = flow.rewardClaimId('m-disc-retry');
    const docs = {};
    function settleDisconnectOnce() {
        const lockPath = 'pvp_rewards/' + claimId;
        if (docs[lockPath]) return { incremented: false, count: docs['pvp_pair_daily/pair'].count };
        if (!flow.shouldIncrementPairDaily(disc, stamp)) return { incremented: false, count: 0 };
        docs[lockPath] = { matchId: 'm-disc-retry', reason: disc.reason, applied: [] };
        const prev = docs['pvp_pair_daily/pair'] ? docs['pvp_pair_daily/pair'].count : 0;
        docs['pvp_pair_daily/pair'] = { count: prev + 1 };
        return { incremented: true, count: docs['pvp_pair_daily/pair'].count };
    }
    const first = settleDisconnectOnce();
    assert.strictEqual(first.incremented, true);
    assert.strictEqual(first.count, 1);
    const second = settleDisconnectOnce();
    assert.strictEqual(second.incremented, false);
    assert.strictEqual(second.count, 1);
    assert.strictEqual(docs['pvp_rewards/' + claimId].reason, 'disconnect');
    assert.deepStrictEqual(docs['pvp_rewards/' + claimId].applied, []);
});

console.log(failed ? ('\n' + failed + ' failed') : ('\n' + passed + ' passed'));
if (failed) process.exit(1);
