#!/usr/bin/env node
// PvP lobby alerts, shout rate limits, and reward idempotency. No Firebase.
const assert = require('assert');
const flow = require('../functions/src/pvpFlow');

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

test('push is opted-in only and capped at one hour', function () {
    assert.strictEqual(flow.decidePvpPush({ uid: 'a', joinerUid: 'b', optedIn: false, nowMs: NOW }).reason, 'not_opted_in');
    assert.strictEqual(flow.decidePvpPush({ uid: 'b', joinerUid: 'b', optedIn: true, nowMs: NOW }).reason, 'self');
    assert.strictEqual(flow.decidePvpPush({ uid: 'a', joinerUid: 'b', optedIn: true, muted: true, nowMs: NOW }).reason, 'muted');
    const ok = flow.decidePvpPush({ uid: 'a', joinerUid: 'b', optedIn: true, lastPushMs: NOW - flow.PUSH_COOLDOWN_MS, nowMs: NOW });
    assert.strictEqual(ok.send, true);
    const soon = flow.decidePvpPush({ uid: 'a', joinerUid: 'b', optedIn: true, lastPushMs: NOW - 1000, nowMs: NOW });
    assert.strictEqual(soon.reason, 'rate_limited');
});

test('lobby shout is one post per user per 15 minutes', function () {
    const first = flow.shouldPostLobbyShout({ uid: 'uid_a', name: 'Nacho<script>', nowMs: NOW, lastPostMs: null, banned: false });
    assert.strictEqual(first.post, true);
    assert.strictEqual(first.isNachoAuto, false);
    assert.strictEqual(first.authorUid, 'nacho-bot');
    assert.ok(first.text.indexOf('@Nacho') === 0 || first.text.indexOf('@Nacho') > 0);
    assert.ok(first.text.indexOf('<') === -1);
    assert.ok(first.text.indexOf('[Tap to join](#pvp)') !== -1);
    assert.strictEqual(first.docId, flow.lobbyShoutDocId('uid_a', NOW));
    const again = flow.shouldPostLobbyShout({ uid: 'uid_a', name: 'Nacho', nowMs: NOW + 1000, lastPostMs: NOW, banned: false });
    assert.strictEqual(again.reason, 'rate_limited');
    const later = flow.shouldPostLobbyShout({ uid: 'uid_a', name: 'Nacho', nowMs: NOW + flow.LOBBY_SHOUT_MS, lastPostMs: NOW, banned: false });
    assert.strictEqual(later.post, true);
    assert.notStrictEqual(later.docId, first.docId);
    assert.strictEqual(flow.shouldPostLobbyShout({ uid: 'uid_a', name: 'Nacho', nowMs: NOW, banned: true }).reason, 'banned');
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
    assert.strictEqual(flow.isClientPvpReward('daily_visit', 'daily visit'), false);
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

console.log(failed ? ('\n' + failed + ' failed') : ('\n' + passed + ' passed'));
if (failed) process.exit(1);
