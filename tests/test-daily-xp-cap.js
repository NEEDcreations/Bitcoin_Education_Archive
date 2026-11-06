#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { planDailyXp, taperAward, splitDailyXp, DAILY_CAP, TAPER_FULL_UNTIL, TAPER_HALF_UNTIL } = require('../functions/src/dailyXp');
const { offsetDateKey } = require('../functions/src/offsetDay');
const sayHi = require('../functions/src/sayHi');
const { isRewardBanned } = require('../functions/src/questReward');
const awardActions = require('../functions/src/awardActions');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (err) {
        console.log('❌ ' + name + ': ' + err.message);
        failed++;
    }
}

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
        if (ent.name === 'node_modules') return;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(full, out);
        else if (ent.name.endsWith('.js')) out.push(full);
    });
    return out;
}

test('taper boundaries floor per tier at 500, 900, and 1000', function () {
    assert.strictEqual(DAILY_CAP, 1000);
    assert.strictEqual(TAPER_FULL_UNTIL, 500);
    assert.strictEqual(TAPER_HALF_UNTIL, 900);
    // 499+10 straddles full and half: 1 full + floor(9/2) = 5. The odd raw is not carried.
    assert.strictEqual(taperAward(10, 499).awarded, 5);
    assert.strictEqual(taperAward(10, 499).dailyXp, 504);
    assert.strictEqual(planDailyXp(499, 10).dropped, 5);
    assert.strictEqual(planDailyXp(499, 2).awarded, 1);
    assert.strictEqual(planDailyXp(499, 2).dailyXp, 500);
    // 890+30 straddles half and quarter: 20 raw fill 10, floor(10/4) = 2.
    assert.strictEqual(planDailyXp(890, 30).awarded, 12);
    assert.strictEqual(planDailyXp(890, 30).dailyXp, 902);
    assert.strictEqual(planDailyXp(890, 30).dropped, 18);
    assert.strictEqual(planDailyXp(899, 3).awarded, 1);
    assert.strictEqual(planDailyXp(899, 3).dailyXp, 900);
    // 990+100 fills the last 10 at quarter rate (40 raw) and drops the rest.
    assert.strictEqual(planDailyXp(990, 100).awarded, 10);
    assert.strictEqual(planDailyXp(990, 100).dailyXp, 1000);
    assert.strictEqual(planDailyXp(990, 100).dropped, 90);
    assert.strictEqual(planDailyXp(990, 100).capped, true);
    // Exactly 500: the point that lands on 500 is still full. The next raw point is half.
    assert.strictEqual(planDailyXp(0, 500).awarded, 500);
    assert.strictEqual(planDailyXp(0, 500).dailyXp, 500);
    assert.strictEqual(planDailyXp(500, 1).awarded, 0);
    assert.strictEqual(planDailyXp(500, 1).dailyXp, 500);
    assert.strictEqual(planDailyXp(500, 2).awarded, 1);
    assert.strictEqual(planDailyXp(500, 2).dailyXp, 501);
    // Exactly 900: 800 raw from 500 fills the half tier. The next raw points are a quarter.
    assert.strictEqual(planDailyXp(500, 800).awarded, 400);
    assert.strictEqual(planDailyXp(500, 800).dailyXp, 900);
    assert.strictEqual(planDailyXp(900, 3).awarded, 0);
    assert.strictEqual(planDailyXp(900, 3).dailyXp, 900);
    assert.strictEqual(planDailyXp(900, 4).awarded, 1);
    assert.strictEqual(planDailyXp(900, 4).dailyXp, 901);
    // Exactly 1,000: 400 raw from 900 fills the quarter tier. Past that, nothing.
    assert.strictEqual(planDailyXp(900, 400).awarded, 100);
    assert.strictEqual(planDailyXp(900, 400).dailyXp, 1000);
    assert.strictEqual(planDailyXp(1000, 50).awarded, 0);
    assert.strictEqual(planDailyXp(1000, 50).dailyXp, 1000);
    assert.strictEqual(planDailyXp(1001, 50).awarded, 0);
    assert.strictEqual(planDailyXp(1001, 50).dailyXp, 1000);
    assert.strictEqual(splitDailyXp(0, 2100).awarded, 1000);
    assert.strictEqual(splitDailyXp(0, 2100).overflowAdded, 0);
});

test('raw XP from zero buys 500, 900, and 1,000 credit', function () {
    assert.strictEqual(planDailyXp(0, 500).awarded, 500);
    assert.strictEqual(planDailyXp(0, 1300).awarded, 900);
    assert.strictEqual(planDailyXp(0, 1300).dailyXp, 900);
    assert.strictEqual(planDailyXp(0, 1699).awarded, 999);
    assert.strictEqual(planDailyXp(0, 1699).dailyXp, 999);
    assert.strictEqual(planDailyXp(0, 1700).awarded, 1000);
    assert.strictEqual(planDailyXp(0, 1700).dailyXp, 1000);
    assert.strictEqual(planDailyXp(0, 1701).awarded, 1000);
    assert.strictEqual(planDailyXp(0, 1701).dropped, 701);
    assert.strictEqual(planDailyXp(0, 1701).overflowAdded, 0);
});

test('say hi and a poll share one daily counter', function () {
    let used = 490;
    const hi = sayHi.planSayHiXp(used, 80, '2026-10-21', '2026-10-22');
    assert.strictEqual(hi.awarded, 30);
    assert.strictEqual(hi.overflowRedeemed, 0);
    assert.strictEqual(hi.tickets, 1);
    used += hi.awarded;
    const poll = splitDailyXp(used, 50);
    assert.strictEqual(poll.awarded, 25);
    assert.strictEqual(poll.overflowAdded, 0);
    assert.strictEqual(used + poll.awarded, 545);
});

test('no pendingOverflow writes in function sources', function () {
    const files = walk(path.join(root, 'functions'), []);
    const bad = [];
    files.forEach(function (file) {
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        lines.forEach(function (line, i) {
            const code = line.replace(/\/\/.*$/, '');
            if (/\.pendingOverflow\s*=/.test(code)) bad.push(file + ':' + (i + 1));
            if (/pendingOverflow\s*:\s*(admin\.)?firestore\.FieldValue/.test(code)) bad.push(file + ':' + (i + 1));
            if (/pendingOverflow\s*:\s*FieldValue\./.test(code)) bad.push(file + ':' + (i + 1));
        });
    });
    assert.deepStrictEqual(bad, []);
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    ['lastQuizDate', 'quizStreak', 'quizAnswered', 'quizCorrect', 'xpBankPayoutApplied', 'xpBankPayoutAmount', 'xpBankPayoutBank', 'xpBankPayoutAt'].forEach(function (field) {
        assert.ok(rules.includes("'" + field + "'"), field);
    });
});

test('the shared counter rolls over at 5 AM UTC', function () {
    const before = Date.parse('2026-10-23T04:59:59.000Z');
    const after = Date.parse('2026-10-23T05:00:00.000Z');
    assert.strictEqual(offsetDateKey(before), '2026-10-22');
    assert.strictEqual(offsetDateKey(after), '2026-10-23');
    assert.notStrictEqual(offsetDateKey(before), offsetDateKey(after));
    assert.strictEqual(planDailyXp(1000, 50).awarded, 0);
    assert.strictEqual(sayHi.planSayHiXp(0, 0, offsetDateKey(before), offsetDateKey(after)).awarded, 50);
    assert.strictEqual(planDailyXp(499, 2).dailyXp, 500);
    assert.strictEqual(planDailyXp(0, 2).awarded, 2);
});

test('every XP path calls planDailyXp and the old per-source caps are gone', function () {
    const callers = [
        'functions/index.js',
        'functions/src/awardActions.js',
        'functions/src/questReward.js',
        'functions/src/sayHi.js',
        'functions/src/gifting.js',
        'functions/src/tctvWatch.js',
        'functions/src/onboardingQuest.js',
        'functions/src/pollVote.js',
        'functions/src/dailyFive.js',
        'functions/src/predictionJobs.js',
        'functions/src/peerLevel.js',
        'functions/src/replyBonus.js',
    ];
    callers.forEach(function (rel) {
        const src = fs.readFileSync(path.join(root, rel), 'utf8');
        assert.ok(src.includes('planXpGrant') || src.includes('planDailyXp') || src.includes('applyDailyXp('), rel);
    });
    ['functions/src/gifting.js', 'functions/src/tipService.js', 'functions/src/replyBonus.js', 'functions/src/awardBadge.js'].forEach(function (rel) {
        const src = fs.readFileSync(path.join(root, rel), 'utf8');
        assert.ok(src.includes('applyDailyXp('), rel);
        assert.strictEqual(src.includes('pendingOverflow'), false, rel);
    });
    const hook = fs.readFileSync(path.join(root, 'functions', 'src', 'applyDailyXp.js'), 'utf8');
    assert.ok(hook.includes('planDailyXp'));
    assert.ok(hook.includes('async function applyDailyXp(uid, amount, tx, opts)'));
    assert.ok(hook.includes('options.bypass === true'));
    const gone = ['SAY_HI_DAILY_CAP', 'POLL_CAP', 'WATCH_DAILY_CAP', 'BADGE_DAILY_CAP', 'TRIVIA_QUIZ_CAP', 'DAILY_QUIZ_XP_CAP'];
    const files = walk(path.join(root, 'functions'), []);
    const hits = [];
    files.forEach(function (file) {
        const src = fs.readFileSync(file, 'utf8');
        gone.forEach(function (name) {
            if (src.includes(name)) hits.push(path.relative(root, file) + ' ' + name);
        });
    });
    assert.deepStrictEqual(hits, []);
    const api = fs.readFileSync(path.join(root, 'functions', 'src', 'onboardingApi.js'), 'utf8');
    assert.strictEqual(api.includes('planDailyXp'), false);
    assert.ok(api.includes('Guest points were already earned'));
    ['scripts/xp-bank-payout.js', 'scripts/backfill-badge-favor.js', 'functions/backfill-prediction-stats.js', 'functions/backfill_referrals.js', 'functions/scripts/backfill_user_sf_points.js'].forEach(function (rel) {
        const src = fs.readFileSync(path.join(root, rel), 'utf8');
        assert.strictEqual(src.includes('planDailyXp'), false, rel);
    });
});

test('banned users get no XP', function () {
    assert.strictEqual(isRewardBanned({ ban_reason: 'spam' }, null), true);
    assert.strictEqual(isRewardBanned({ banned: true }, null), true);
    assert.strictEqual(sayHi.isSayHiBlocked({ ban_reason: 'farm' }, {}), true);
    const mem = {
        users: { u: { points: 40, orangeTickets: 1, ban_reason: 'spam' } },
        daily: { u: { total: 0 } },
    };
    const blocked = awardActions.applyAward(mem, 'u', { action: '💬 Global Chat', pts: 5 });
    assert.strictEqual(blocked.awarded, 0);
    assert.strictEqual(blocked.banned, true);
    assert.strictEqual(mem.users.u.points, 40);
    assert.strictEqual(Object.keys(mem.claims || {}).length, 0);
});

function fakeDaily(total) {
    const dailyRef = { id: 'day' };
    return {
        dailyRef: dailyRef,
        userRef: { collection: function () { return { doc: function () { return dailyRef; } }; } },
        tx: { get: function () { return Promise.resolve({ exists: true, data: function () { return { total: total }; } }); } },
    };
}

async function checkApplyDailyXp() {
    const { applyDailyXp, taperDailyXp } = require('../functions/src/applyDailyXp');
    assert.strictEqual(taperDailyXp(10, 499).awarded, 5);
    assert.strictEqual(taperDailyXp(10, 499).dailyXp, 504);
    assert.strictEqual(taperDailyXp(30, 890).awarded, 12);
    assert.strictEqual(taperDailyXp(30, 890).dailyXp, 902);
    assert.strictEqual(taperDailyXp(100, 990).awarded, 10);
    assert.strictEqual(taperDailyXp(100, 990).dailyXp, 1000);
    assert.strictEqual(taperDailyXp(1, 500).awarded, 0);
    assert.strictEqual(taperDailyXp(2, 500).awarded, 1);
    assert.strictEqual(taperDailyXp(2, 500).dailyXp, 501);
    assert.strictEqual(taperDailyXp(3, 900).awarded, 0);
    assert.strictEqual(taperDailyXp(4, 900).awarded, 1);
    assert.strictEqual(taperDailyXp(4, 900).dailyXp, 901);
    assert.strictEqual(taperDailyXp(50, 1000).awarded, 0);
    assert.strictEqual(taperDailyXp(50, 1001).dailyXp, 1000);
    const bypass = await applyDailyXp('u', 2000, null, { bypass: true });
    assert.strictEqual(bypass.awarded, 2000);
    assert.strictEqual(bypass.overflowAdded, 0);
    assert.strictEqual(bypass.dailyRef, null);
    assert.strictEqual(bypass.bypass, true);
    let threw = false;
    try { await applyDailyXp('u', 10, null, { day: '2026-10-23' }); }
    catch (err) { threw = err && err.message.indexOf('applyDailyXp needs') === 0; }
    assert.strictEqual(threw, true);
    const mid = fakeDaily(499);
    const grant = await applyDailyXp('u', 10, mid.tx, { day: '2026-10-23', userRef: mid.userRef });
    assert.strictEqual(grant.awarded, 5);
    assert.strictEqual(grant.dailyXp, 504);
    assert.strictEqual(grant.overflowAdded, 0);
    assert.strictEqual(grant.dropped, 5);
    assert.strictEqual(grant.dailyRef, mid.dailyRef);
    const top = fakeDaily(990);
    const edge = await applyDailyXp('u', 100, top.tx, { day: '2026-10-23', userRef: top.userRef });
    assert.strictEqual(edge.awarded, 10);
    assert.strictEqual(edge.dailyXp, 1000);
    const over = fakeDaily(1000);
    const none = await applyDailyXp('u', 50, over.tx, { day: '2026-10-23', userRef: over.userRef });
    assert.strictEqual(none.awarded, 0);
    assert.strictEqual(none.overflowAdded, 0);
}

checkApplyDailyXp().then(function () {
    console.log('✅ applyDailyXp hook matches the 500/900/1000 taper and drops overflow');
    passed++;
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
}).catch(function (err) {
    console.log('❌ applyDailyXp hook: ' + err.message);
    failed++;
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(1);
});
