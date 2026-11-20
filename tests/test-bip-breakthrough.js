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

function weekKeys(fromKey, count) {
    const out = [];
    const t0 = Date.parse(fromKey + 'T12:00:00Z');
    for (let i = 0; i < count; i++) out.push(new Date(t0 + i * 7 * 86400000).toISOString().slice(0, 10));
    return out;
}

function testCycleCoversEveryBipBeforeRepeat() {
    const ids = bip.BIP_CATALOG.map((r) => r.id).sort();
    assert.deepStrictEqual(bip.CYCLE_ORDER.slice().sort(), ids, 'CYCLE_ORDER is every catalog BIP exactly once');
    const n = bip.CYCLE_ORDER.length;
    const keys = weekKeys(bip.CYCLE_ANCHOR_WEEK, n * 30);
    for (let c = 0; c < 30; c++) {
        const seen = new Set();
        for (let p = 0; p < n; p++) {
            const k = keys[c * n + p];
            const b = bip.bipForWeek(k);
            assert.ok(b && !seen.has(b.id), 'no repeat inside cycle ' + (c + 1) + ' at ' + k);
            seen.add(b.id);
            assert.deepStrictEqual(bip.cycleInfo(k), { cycle: c + 1, position: p + 1, length: n });
        }
        assert.strictEqual(seen.size, ids.length, 'cycle ' + (c + 1) + ' covers all');
    }
}

function testCycleResets() {
    const n = bip.CYCLE_ORDER.length;
    const keys = weekKeys(bip.CYCLE_ANCHOR_WEEK, n * 3 + 1);
    assert.strictEqual(bip.bipForWeek(keys[n]).id, bip.bipForWeek(keys[0]).id);
    assert.strictEqual(bip.cycleInfo(keys[n]).cycle, 2);
    assert.strictEqual(bip.cycleInfo(keys[n]).position, 1);
    assert.strictEqual(bip.bipForWeek(keys[n - 1]).id, bip.CYCLE_ORDER[n - 1]);
    assert.strictEqual(bip.cycleInfo('2027-01-25').position, n);
    assert.strictEqual(bip.cycleInfo('2027-02-01').cycle, 2);
}

function testPublishedWeeksUnchanged() {
    // Weeks players already saw (live page / server since launch).
    const expected = {
        '2026-11-02': 85, '2026-11-09': 360, '2026-11-16': 119,
        '2026-11-23': 347, '2026-11-30': 118, '2026-12-07': 324, '2026-12-14': 85, '2026-12-21': 86,
    };
    Object.keys(expected).forEach((k) => assert.strictEqual(bip.bipForWeek(k).number, expected[k], k));
    assert.strictEqual(bip.cycleInfo(bip.LAUNCH_WEEK), null);
    assert.strictEqual(bip.bipForWeek('2026-10-26'), null);
    assert.strictEqual(bip.bipForWeek(''), null);
    assert.strictEqual(bip.bipForWeek('nope'), null);
    // This week's streak plan still points at BIP 119 (Thu Nov 19, 2026 1pm ET).
    const plan = bip.planStreak({}, Date.parse('2026-11-19T18:00:00Z'));
    assert.strictEqual(plan.weekKey, '2026-11-16');
    assert.strictEqual(plan.bip.id, 'bip_119');
    assert.strictEqual(plan.update.bipBreakthroughBipId, 'bip_119');
}

function testDstWeeksStayAligned() {
    // Monday keys across the Mar/Nov 2027 clock changes still map 1 week = 1 step.
    ['2027-03-08', '2027-03-15', '2027-11-01', '2027-11-08'].forEach((k) => {
        const w = Math.round((Date.parse(k + 'T12:00:00Z') - Date.parse(bip.CYCLE_ANCHOR_WEEK + 'T12:00:00Z')) / (7 * 86400000));
        assert.strictEqual(bip.bipForWeek(k).id, bip.CYCLE_ORDER[w % bip.CYCLE_ORDER.length], k);
    });
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
    // Was > Date.now(), which broke once the fixed Nov 2026 test week aged out.
    assert.strictEqual(user.coreContributorUntil, Date.parse(start + 'T17:00:00Z') + 6 * 86400000 + bip.TITLE_DAYS_MS);

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
testCycleCoversEveryBipBeforeRepeat();
testCycleResets();
testPublishedWeeksUnchanged();
testDstWeeksStayAligned();
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

