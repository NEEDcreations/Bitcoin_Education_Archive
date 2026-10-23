#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { planDailyXp, taperAward, splitDailyXp, DAILY_CAP, TAPER_FULL_UNTIL } = require('../functions/src/dailyXp');
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

test('taper boundaries 599 to 601 and 999 to 1001', function () {
    assert.strictEqual(DAILY_CAP, 1000);
    assert.strictEqual(TAPER_FULL_UNTIL, 600);
    assert.strictEqual(taperAward(2, 599).awarded, 1);
    assert.strictEqual(taperAward(2, 599).dailyXp, 600);
    assert.strictEqual(taperAward(3, 599).awarded, 2);
    assert.strictEqual(taperAward(3, 599).dailyXp, 601);
    assert.strictEqual(planDailyXp(600, 2).awarded, 1);
    assert.strictEqual(planDailyXp(600, 2).dailyXp, 601);
    assert.strictEqual(planDailyXp(600, 1).awarded, 0);
    assert.strictEqual(planDailyXp(601, 2).awarded, 1);
    assert.strictEqual(taperAward(2, 999).awarded, 1);
    assert.strictEqual(taperAward(2, 999).dailyXp, 1000);
    assert.strictEqual(taperAward(1, 999).awarded, 0);
    assert.strictEqual(taperAward(1, 999).dailyXp, 999);
    assert.strictEqual(planDailyXp(1000, 50).awarded, 0);
    assert.strictEqual(planDailyXp(1001, 50).awarded, 0);
    assert.strictEqual(planDailyXp(1001, 50).dailyXp, 1000);
    assert.strictEqual(splitDailyXp(0, 2100).awarded, 1000);
    assert.strictEqual(splitDailyXp(0, 2100).overflowAdded, 0);
});

test('say hi and a poll share one daily counter', function () {
    let used = 590;
    const hi = sayHi.planSayHiXp(used, 80, '2026-10-21', '2026-10-22');
    assert.strictEqual(hi.awarded, 30);
    assert.strictEqual(hi.overflowRedeemed, 0);
    assert.strictEqual(hi.tickets, 1);
    used += hi.awarded;
    const poll = splitDailyXp(used, 50);
    assert.strictEqual(poll.awarded, 25);
    assert.strictEqual(poll.overflowAdded, 0);
    assert.strictEqual(used + poll.awarded, 645);
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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
