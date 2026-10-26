#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');
const awardActions = require(path.join(__dirname, '..', 'functions/src/awardActions'));
const awardEvidence = require(path.join(__dirname, '..', 'functions/src/awardEvidence'));
const banks = require(path.join(__dirname, '..', 'functions/reward-banks.json'));

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok  ' + name); }
    catch (err) { failed++; console.log('  FAIL ' + name + ': ' + (err && err.stack ? err.stack : err)); }
}

function fresh() {
    return { users: { u: { points: 0, ban_reason: '' } }, claims: {}, counts: {}, daily: {} };
}
function grant(mem, data, proof, day) {
    return awardActions.applyAward(mem, 'u', data, { day: day || '2026-10-22', proof: proof, doubleXpActive: !!(proof && proof.doubleXpActive) });
}
function owned(extra) {
    return Object.assign({ docOwner: 'u', createdAt: Date.now() }, extra || {});
}
const quiz = banks.quests._general[0];

test('a quiz pays only when the server grades it, once per question', function () {
    const mem = fresh();
    const missing = grant(mem, { action: '🎮 Quiz correct!', pts: 10 });
    assert.strictEqual(missing.awarded, 0);
    const wrong = grant(mem, { action: '🎮 Quiz correct!', pts: 10, quizQuestion: quiz.q, quizChoice: 'not the answer' });
    assert.strictEqual(wrong.awarded, 0);
    const right = grant(mem, { action: '🎮 Quiz correct!', pts: 10, quizQuestion: quiz.q, quizChoice: quiz.a });
    assert.strictEqual(right.awarded, 10);
    const again = grant(mem, { action: '🎮 Quiz correct!', pts: 5, quizQuestion: quiz.q, quizChoice: quiz.a });
    assert.strictEqual(again.awarded, 0);
    assert.strictEqual(mem.users.u.unclaimableXp || 0, 0);
    assert.strictEqual(mem.daily.u.total, 10);
});

test('dead trivia, poll, and spin phrases pay nothing', function () {
    ['🧠 Trivia Quest correct!', '🧠 Trivia Quest attempt', '📊 Poll Quest vote', 'Daily Spin'].forEach(function (action) {
        const result = grant(fresh(), { action: action, pts: 200 });
        assert.strictEqual(result.awarded, 0, action);
        assert.strictEqual(result.success, false, action);
    });
});

test('channel and explore grants follow the server catalog', function () {
    const mem = fresh();
    const fake = grant(mem, { action: '📖 New channel explored', pts: 10, channelId: 'not_a_real_channel' });
    assert.strictEqual(fake.awarded, 0);
    const real = grant(mem, { action: '📖 New channel explored', pts: 10, channelId: 'analogies' });
    assert.strictEqual(real.awarded, 10);
    const replay = grant(mem, { action: '📖 New channel explored', pts: 10, channelId: 'analogies' });
    assert.strictEqual(replay.awarded, 0);
    const early = grant(mem, { action: 'Explorer bonus! 10 topics 🎉', pts: 50 });
    assert.strictEqual(early.awarded, 0);
    mem.users.u.visitedChannelsList = Array.from(awardEvidence.channels()).slice(0, 10);
    const ten = grant(mem, { action: 'Explorer bonus! 10 topics 🎉', pts: 50 });
    assert.strictEqual(ten.awarded, 50);
});

test('story completion pays only after every chapter claim exists', function () {
    const mem = fresh();
    for (let n = 1; n <= 7; n++) {
        const chapter = grant(mem, { action: '📖 Completed Chapter ' + n, pts: 50 });
        assert.strictEqual(chapter.awarded, 15, 'chapter ' + n);
    }
    const early = grant(fresh(), { action: "📖🎉 Completed Nacho's Story!", pts: 100 });
    assert.strictEqual(early.awarded, 0);
    const done = grant(mem, { action: "📖🎉 Completed Nacho's Story!", pts: 100 });
    assert.strictEqual(done.awarded, 100);
});

test('chat, forum, and beats uploads need an owned document', function () {
    const mem = fresh();
    assert.strictEqual(grant(mem, { action: '💬 Global Chat', pts: 5 }).awarded, 0);
    assert.strictEqual(grant(mem, { action: '💬 Global Chat', pts: 5, messageId: 'm1' }, { docOwner: 'other' }).awarded, 0);
    assert.strictEqual(grant(mem, { action: '💬 Global Chat', pts: 5, messageId: 'm1' }, owned()).awarded, 5);
    assert.strictEqual(grant(mem, { action: '💬 Global Chat', pts: 5, messageId: 'm1' }, owned()).awarded, 0);
    assert.strictEqual(grant(mem, { action: '📝 Forum post', pts: 10, postId: 'p1' }, owned()).awarded, 10);
    assert.strictEqual(grant(mem, { action: 'Uploaded a track to Bitcoin Beats! 🎵', pts: 50 }).awarded, 0);
    const batch = grant(mem, { action: 'Uploaded 3 tracks to Bitcoin Beats!', pts: 75, trackIds: 'a,b,c' }, owned());
    assert.strictEqual(batch.awarded, 50);
    const reused = grant(fresh(), { action: 'Uploaded a track to Bitcoin Beats! 🎵', pts: 50, trackId: 'a' }, owned());
    assert.strictEqual(reused.awarded, 50);
    const again = grant(mem, { action: 'Uploaded a track to Bitcoin Beats! 🎵', pts: 50, trackId: 'a' }, owned());
    assert.strictEqual(again.awarded, 0);
});

test('a document pays once across accounts, and deleting it does not clear the claim', function () {
    const mem = fresh();
    const first = awardActions.applyAward(mem, 'u', { action: '📝 Forum post', pts: 10, postId: 'p9' }, {
        day: '2026-10-26',
        proof: owned(),
    });
    assert.strictEqual(first.awarded, 10);
    assert.strictEqual(mem.globalClaims['forum_posts__p9'], true);
    const stolen = awardActions.applyAward(mem, 'b', { action: '📝 Forum post', pts: 10, postId: 'p9' }, {
        day: '2026-10-26',
        proof: { docOwner: 'b', createdAt: Date.now() },
    });
    assert.strictEqual(stolen.awarded, 0);
    const stale = grant(fresh(), { action: '💬 Global Chat', pts: 5, messageId: 'old' }, {
        docOwner: 'u',
        createdAt: Date.now() - (25 * 60 * 60 * 1000),
    });
    assert.strictEqual(stale.awarded, 0);
    const ahead = grant(fresh(), { action: '💬 Global Chat', pts: 5, messageId: 'future' }, {
        docOwner: 'u',
        createdAt: Date.now() + (5 * 60 * 1000),
    });
    assert.strictEqual(ahead.awarded, 0);
});

test('quiz questions with more than one right answer accept each of them once', function () {
    const mem = fresh();
    const nodeA = 'Software that routes payments on the Lightning Network using payment channels';
    const nodeB = 'Software that opens channels, routes payments, and earns fees for providing liquidity';
    const joinA = "A privacy technique combining multiple users' transactions to break heuristics";
    const joinB = 'A privacy technique where multiple users combine transactions to obscure the sender/receiver trail';
    assert.strictEqual(grant(mem, { action: '🎮 Quiz correct!', pts: 5, quizQuestion: 'What is a Lightning node?', quizChoice: nodeA }).awarded, 5);
    assert.strictEqual(grant(mem, { action: '🎮 Quiz correct!', pts: 5, quizQuestion: 'What is a Lightning node?', quizChoice: nodeB }).awarded, 0);
    const other = fresh();
    assert.strictEqual(grant(other, { action: '🎮 Quiz correct!', pts: 5, quizQuestion: 'What is a Lightning node?', quizChoice: nodeB }).awarded, 5);
    assert.strictEqual(grant(other, { action: '🎮 Quiz correct!', pts: 5, quizQuestion: 'What is CoinJoin?', quizChoice: joinA }).awarded, 5);
    assert.strictEqual(grant(fresh(), { action: '🎮 Quiz correct!', pts: 5, quizQuestion: 'What is CoinJoin?', quizChoice: joinB }).awarded, 5);
    assert.strictEqual(grant(fresh(), { action: '🎮 Quiz correct!', pts: 5, quizQuestion: 'What is CoinJoin?', quizChoice: 'A mining pool' }).awarded, 0);
});

test('chat streak bonuses use the server streak', function () {
    const early = grant(fresh(), { action: '🔥 7-day chat streak!', pts: 25 });
    assert.strictEqual(early.awarded, 0);
    const met = grant(fresh(), { action: '🔥 7-day chat streak!', pts: 25 }, { chatStreak: 7 });
    assert.strictEqual(met.awarded, 25);
    const doubled = grant(fresh(), { action: '💎 30-day chat streak!', pts: 200 }, { chatStreak: 30, doubleXpActive: true });
    assert.strictEqual(doubled.awarded, 100);
});

test('anon merge pays the anonymous account points, once, and ignores the client amount', function () {
    const mem = fresh();
    const spoof = grant(mem, { action: '🔗 Anonymous progress merged', pts: 500, anonUid: 'anonaccount1' });
    assert.strictEqual(spoof.awarded, 0);
    const paid = grant(mem, { action: '🔗 Anonymous progress merged', pts: 900, anonUid: 'anonaccount1' }, {
        anon: { exists: true, anonymous: true, mergedInto: 'u', points: 80 },
    });
    assert.strictEqual(paid.awarded, 80);
    const cap = grant(fresh(), { action: '🔗 Anonymous progress merged', pts: 1, anonUid: 'anonaccount2' }, {
        anon: { exists: true, anonymous: true, mergedInto: 'u', points: 900 },
    });
    assert.strictEqual(cap.awarded, 500);
    const replay = grant(mem, { action: '🔗 Anonymous progress merged', pts: 500, anonUid: 'anonaccount1' }, {
        anon: { exists: true, anonymous: true, mergedInto: 'u', points: 80 },
    });
    assert.strictEqual(replay.awarded, 0);
    const other = grant(fresh(), { action: '🔗 Anonymous progress merged', pts: 80, anonUid: 'anonaccount3' }, {
        anon: { exists: true, anonymous: true, mergedInto: 'someone', points: 80 },
    });
    assert.strictEqual(other.awarded, 0);
});

test('unverified actions share a 100 XP pool and stay out of claimable sats', function () {
    const mem = fresh();
    for (let i = 0; i < 10; i++) {
        const listen = grant(mem, { action: 'Listened to a full track on Bitcoin Beats 🎵', pts: 10 });
        assert.strictEqual(listen.awarded, 10, 'listen ' + i);
    }
    const blocked = grant(mem, { action: 'Listened to a full track on Bitcoin Beats 🎵', pts: 10 });
    assert.strictEqual(blocked.awarded, 0);
    const flex = grant(mem, { action: 'flex', pts: 5, actionKey: 'flex_action', flexActionId: 'steak' });
    assert.strictEqual(flex.awarded, 0);
    assert.strictEqual(mem.users.u.points, 100);
    assert.strictEqual(mem.users.u.unclaimableXp, 100);
    assert.strictEqual(mem.daily.u.total, 100);
    assert.strictEqual(mem.daily.u.unverified, 100);
    assert.strictEqual(mem.users.u.weeklyXP, 100);
    assert.strictEqual(mem.users.u.monthlyXP, 100);
    assert.strictEqual(awardEvidence.claimablePoints(mem.users.u), 0);
    const nearCap = fresh();
    nearCap.daily.u = { total: 990, unverified: 0 };
    const tapered = grant(nearCap, { action: 'Listened to a full track on Bitcoin Beats 🎵', pts: 10 });
    assert.strictEqual(tapered.awarded, 2);
    assert.strictEqual(nearCap.daily.u.total, 992);
    assert.strictEqual(nearCap.users.u.unclaimableXp, 2);
    const claimable = fresh();
    grant(claimable, { action: '📖 Completed Chapter 2', pts: 15 });
    assert.strictEqual(awardEvidence.claimablePoints(claimable.users.u), 15);
});

test('a normal flex day still pays its catalog amounts inside the unverified pool', function () {
    const mem = fresh();
    ['steak', 'sunlight', 'dca', 'custody', 'lift'].forEach(function (id) {
        const row = grant(mem, { action: 'flex', pts: 5, actionKey: 'flex_action', flexActionId: id });
        assert.strictEqual(row.awarded, 5, id);
    });
    const day = grant(mem, { action: 'flex day', pts: 50, actionKey: 'flex_day_complete' });
    assert.strictEqual(day.awarded, 50);
    assert.strictEqual(mem.users.u.unclaimableXp, 75);
    assert.strictEqual(mem.daily.u.total, 75);
    assert.strictEqual(mem.users.u.weeklyXP, 75);
    assert.strictEqual(awardEvidence.claimablePoints(mem.users.u), 0);
});

test('visit, prediction, and welcome still pay their old amounts when the server record exists', function () {
    const visit = grant(fresh({ users: { u: { points: 0, ban_reason: '', lastVisit: '2026-10-22' } } }).users ? fresh() : fresh(), { action: '✅ Daily visit', pts: 5 });
    assert.strictEqual(visit.awarded, 0);
    const recorded = fresh();
    recorded.users.u.lastVisit = '2026-10-22';
    assert.strictEqual(grant(recorded, { action: '✅ Daily visit (3-day streak!)', pts: 105 }).awarded, 5);
    const predicted = grant(fresh(), { action: '📈 Price prediction made', pts: 5 }, { prediction: true });
    assert.strictEqual(predicted.awarded, 5);
    const bare = grant(fresh(), { action: '📈 Price prediction made', pts: 5 });
    assert.strictEqual(bare.awarded, 0);
    assert.strictEqual(grant(fresh(), { action: 'Welcome bonus!', pts: 5 }).awarded, 5);
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
