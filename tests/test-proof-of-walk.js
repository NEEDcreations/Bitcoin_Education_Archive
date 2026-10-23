#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const walk = require('../functions/src/proofOfWalk');
const { planDailyXp } = require('../functions/src/dailyXp');

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

function km(id, date, meters, type) {
    return { id: id, type: type || 'Walk', start_date_local: date + 'T08:00:00', distance: meters };
}

test('one day pays 50 XP per km up to 42 km', function () {
    const one = walk.planWalkSync({
        activities: [km('a', '2026-10-20', 10000)],
        already: {},
        dailyData: { date: '', distance: 0 },
    });
    assert.strictEqual(one.rawPoints, 500);
    assert.strictEqual(one.synced, 1);
    const capped = walk.planWalkSync({
        activities: [km('b', '2026-10-20', 50000)],
        already: {},
        dailyData: { date: '2026-10-20', distance: 40 },
    });
    assert.strictEqual(capped.rawPoints, 100);
    assert.strictEqual(capped.dailyData.distance, 42);
    const full = walk.planWalkSync({
        activities: [km('c', '2026-10-20', 1000)],
        already: {},
        dailyData: { date: '2026-10-20', distance: 42 },
    });
    assert.strictEqual(full.rawPoints, 0);
    assert.strictEqual(full.rows[0].points, 0);
});

test('several past dates sum, then today\'s taper drops the rest', function () {
    const plan = walk.planWalkSync({
        activities: [
            km('d1', '2026-10-18', 42000),
            km('d2', '2026-10-19', 42000, 'Run'),
            km('d3', '2026-10-20', 42000, 'Hike'),
            { id: 'bike', type: 'Ride', start_date_local: '2026-10-20T09:00:00', distance: 20000 },
            km('old', '2026-10-17', 10000),
        ],
        already: { old: true },
        dailyData: { date: '2026-10-17', distance: 5, note: 'keep' },
    });
    assert.strictEqual(plan.synced, 3);
    assert.strictEqual(plan.rawPoints, 42 * 50 * 3);
    assert.strictEqual(plan.rows.some(function (row) { return row.id === 'bike' || row.id === 'old'; }), false);
    const fromZero = planDailyXp(0, plan.rawPoints);
    assert.strictEqual(fromZero.awarded, 1000);
    assert.strictEqual(fromZero.overflowAdded, 0);
    assert.strictEqual(fromZero.dropped, plan.rawPoints - 1000);
    const half = planDailyXp(800, 500);
    assert.strictEqual(half.awarded, 200);
    assert.strictEqual(half.dailyXp, 1000);
    assert.strictEqual(planDailyXp(1000, plan.rawPoints).awarded, 0);
    const blocked = planDailyXp(0, 0);
    assert.strictEqual(blocked.awarded, 0);
});

test('syncStravaWalks tapers today, checks a ban, and updates weekly and monthly', function () {
    const index = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const start = index.indexOf('exports.syncStravaWalks');
    const end = index.indexOf('exports.adminLookupUser');
    assert.ok(start > 0 && end > start);
    const body = index.slice(start, end);
    const readAt = body.indexOf('applyDailyXp(');
    const writeAt = body.indexOf('transaction.set(');
    assert.ok(readAt > 0 && writeAt > readAt);
    assert.ok(body.includes('rewardBlocked'));
    assert.ok(body.includes('getOffsetDateKey()'));
    assert.ok(body.includes('planWalkSync'));
    assert.ok(body.includes('weeklyXP'));
    assert.ok(body.includes('monthlyXP'));
    assert.ok(body.includes('if (blocked || plan.synced === 0) return;'));
    assert.strictEqual(body.includes('pendingOverflow'), false);
    assert.strictEqual(body.includes('currentPoints + totalPoints'), false);
    assert.strictEqual(body.includes('points: currentPoints'), false);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
