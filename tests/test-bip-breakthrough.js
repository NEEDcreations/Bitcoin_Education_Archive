#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const bip = require('../functions/src/bipBreakthrough');

function msOnNyDay(ymd, hourEt) {
    // Approximate: construct as UTC then adjust — for tests we only need stable keys.
    // Use noon ET ≈ 17:00 UTC in November (EST).
    const [y, m, d] = ymd.split('-').map(Number);
    const utc = Date.UTC(y, m - 1, d, 17, 0, 0);
    return utc;
}

function testCatalog() {
    const list = bip.catalog();
    assert.ok(list.length >= 10);
    const nums = list.map((x) => x.number);
    assert.ok(nums.includes(360));
    assert.ok(nums.includes(119));
    assert.ok(nums.includes(347));
    assert.ok(nums.includes(443));
    list.forEach((row) => {
        assert.ok(row.id && row.title && row.plain && row.short);
        assert.strictEqual(row.id, 'bip_' + row.number);
    });
}

function testSameBipPerWeek() {
    const a = bip.bipForWeek('2026-11-03');
    const b = bip.bipForWeek('2026-11-03');
    assert.deepStrictEqual(a, b);
    const c = bip.bipForWeek('2026-11-10');
    // Different week may or may not differ; just ensure valid.
    assert.ok(c && c.id);
}

function testNyDateKey() {
    const key = bip.nyDateKey(Date.parse('2026-11-05T18:00:00Z')); // 1pm ET
    assert.strictEqual(key, '2026-11-05');
}

function testStreakAndClaim() {
    const week = bip.weekKeyAt(Date.parse('2026-11-05T18:00:00Z')); // Thu
    assert.ok(week);

    // Simulate Mon..Sun spins within one week.
    // Find Monday of that week from weekKey YYYY-MM-DD
    const start = week; // already Monday date
    let user = {};
    let last = null;
    for (let i = 0; i < 7; i++) {
        const dayMs = Date.parse(start + 'T17:00:00Z') + i * 86400000;
        const plan = bip.planStreak(user, dayMs);
        assert.ok(plan.update);
        assert.strictEqual(plan.alreadyToday, false);
        user = Object.assign({}, user, plan.update);
        if (plan.completes) {
            Object.assign(user, bip.claimFields(plan.bip, dayMs, {
                arrayUnion: function (v) { return ['__union__', v]; }
            }));
            last = plan;
        }
    }
    assert.ok(last, 'day 7 should complete');
    assert.strictEqual(last.streak, 7);
    assert.ok(last.bip && last.bip.number);
    assert.strictEqual(user.bipBreakthroughClaimedWeek, week);
    assert.ok(user.coreContributorUntil > Date.now() - 1000);

    // Idempotent: another spin same day does not re-complete
    const again = bip.planStreak(user, Date.parse(start + 'T17:00:00Z') + 6 * 86400000);
    assert.strictEqual(again.alreadyToday, true);
    assert.strictEqual(again.completes, false);

    // New week resets streak
    const nextWeekMs = Date.parse(start + 'T17:00:00Z') + 8 * 86400000;
    const reset = bip.planStreak(user, nextWeekMs);
    assert.strictEqual(reset.streak, 1);
    assert.strictEqual(reset.completes, false);
}

function testMissedDayBreaks() {
    const week = bip.weekKeyAt(Date.parse('2026-11-03T17:00:00Z'));
    let user = {};
    // Mon
    let plan = bip.planStreak(user, Date.parse(week + 'T17:00:00Z'));
    user = Object.assign({}, user, plan.update);
    // Wed (skip Tue)
    plan = bip.planStreak(user, Date.parse(week + 'T17:00:00Z') + 2 * 86400000);
    assert.strictEqual(plan.streak, 1);
}

function testIndexWiresBreakthrough() {
    const fs = require('fs');
    const src = fs.readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8');
    const spin = src.slice(src.indexOf('exports.dailySpin'), src.indexOf('exports.pvpStoreAnswerKey'));
    assert.ok(spin.includes('bipBreakthrough.planStreak'));
    assert.ok(spin.includes('forcedTopTier'));
    assert.ok(spin.includes('claimFields'));
    assert.ok(spin.includes("source: 'bip_breakthrough'"));
}

testCatalog();
testSameBipPerWeek();
testNyDateKey();
testStreakAndClaim();
testMissedDayBreaks();
testIndexWiresBreakthrough();
testRulesAndChat();
console.log('test-bip-breakthrough: ok');

function testRulesAndChat() {
    const fs = require('fs');
    const rules = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
    const keys = rules.slice(rules.indexOf('function userProfileServerOnlyKeys()'), rules.indexOf('match /users/{userId}'));
    ['bipBreakthroughLastDay','bipBreakthroughStreak','bipBadges','coreContributorUntil','coreContributorTitle'].forEach(function (k) {
        assert.ok(keys.includes("'" + k + "'"), 'server-only missing ' + k);
    });
    assert.ok(rules.includes("'hasCoreContributor'"), 'chat allowlist hasCoreContributor');
    assert.ok(rules.includes('coreContributorUntil > request.time.toMillis()'), 'chat verifies until');
    const badges = fs.readFileSync(path.join(__dirname, '../badges.js'), 'utf8');
    assert.ok(badges.includes("id: 'bip_360'") && badges.includes('P2MR'));
    assert.ok(badges.includes("id: 'core_contributor'") && badges.includes('requiredBadge: null'));
}

