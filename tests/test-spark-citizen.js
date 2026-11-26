// Spark Citizen 5-tier badges: server-clock teaser credit, once per offset day.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const tiers = require('../functions/src/badgeTiers');
const spark = require('../functions/src/sparkCitizen');
const grant = require('../functions/src/grantBadge');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log('✅ ' + name); passed++; } catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; } }
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const T0 = Date.UTC(2026, 10, 28, 15, 0, 0); // mid-day, same offset day

test('Spark Citizen is a 5-tier ACTIVE family on a server-only field', () => {
    const fam = tiers.ACTIVE.spark_citizen;
    assert.strictEqual(fam.field, 'sparkCitizenCount');
    assert.strictEqual(fam.label, 'Spark Citizen');
    assert.strictEqual(fam.category, 'Citadel Spark');
    assert.deepStrictEqual(fam.tiers.map((r) => r[0]), [1, 3, 7, 14, 28]);
    assert.deepStrictEqual(fam.tiers.map((r) => r[1]), [10, 30, 100, 250, 500]);
    assert.deepStrictEqual(tiers.familyIds('spark_citizen'), [
        'spark_citizen_t1', 'spark_citizen_t2', 'spark_citizen_t3', 'spark_citizen_t4', 'spark_citizen_t5',
    ]);
    assert.strictEqual(tiers.tierInfo('spark_citizen_t1').gte, 1);
    assert.strictEqual(tiers.tierInfo('spark_citizen_t5').gte, 28);
    assert.strictEqual(tiers.tierInfo('spark_citizen_t4').tickets, 5);
    assert.strictEqual(tiers.tierInfo('spark_citizen_t5').tickets, 21);
    assert.strictEqual(tiers.tierInfo('spark_citizen_t1').tickets, 0);
});

test('every ACTIVE family has exactly five rising tiers', () => {
    Object.keys(tiers.ACTIVE).forEach((f) => {
        const rows = tiers.ACTIVE[f].tiers;
        assert.strictEqual(rows.length, 5, f);
        for (let i = 1; i < 5; i++) {
            assert.ok(rows[i][0] > rows[i - 1][0], f + ' threshold');
            assert.ok(rows[i][1] > rows[i - 1][1], f + ' xp');
        }
    });
});

test('All Platinum / All Diamond now include Spark Citizen', () => {
    assert.ok(tiers.collectionMembers('tier_all_platinum').indexOf('spark_citizen_t4') !== -1);
    assert.ok(tiers.collectionMembers('tier_all_diamond').indexOf('spark_citizen_t5') !== -1);
    assert.ok(tiers.collectionMembers('tier_all_platinum').indexOf('tctv_watch_t4') !== -1);
});

test('progress uses the day count, not a time unit', () => {
    assert.deepStrictEqual(tiers.progress('spark_citizen', { sparkCitizenCount: 0 }).tier, 0);
    assert.strictEqual(tiers.progress('spark_citizen', { sparkCitizenCount: 1 }).tier, 1);
    assert.strictEqual(tiers.progress('spark_citizen', { sparkCitizenCount: 6 }).tier, 2);
    assert.strictEqual(tiers.progress('spark_citizen', { sparkCitizenCount: 28 }).tier, 5);
    assert.strictEqual(tiers.progress('spark_citizen', { sparkCitizenCount: 28 }).maxed, true);
});

test('start only arms the clock; complete before 17s is too-fast and pays 0', () => {
    const started = spark.applyStart({}, T0);
    assert.strictEqual(started.reason, 'started');
    assert.strictEqual(started.credit, 0);
    assert.strictEqual(started.state.startAtMs, T0);
    const early = spark.applyComplete(started.state, T0 + spark.TEASER_MIN_MS - 1);
    assert.strictEqual(early.reason, 'too-fast');
    assert.strictEqual(early.credit, 0);
    assert.strictEqual(early.state.startAtMs, T0);
});

test('a complete at 17s credits 1 and clears the start', () => {
    const started = spark.applyStart({}, T0);
    const done = spark.applyComplete(started.state, T0 + spark.TEASER_MIN_MS);
    assert.strictEqual(done.reason, 'ok');
    assert.strictEqual(done.credit, 1);
    assert.strictEqual(done.state.startAtMs, null);
    assert.ok(done.state.creditDay);
});

test('a second complete the same offset day is day-capped', () => {
    const first = spark.applyComplete({ startAtMs: T0, creditDay: '' }, T0 + 18000);
    assert.strictEqual(first.credit, 1);
    const started = spark.applyStart(first.state, T0 + 60000);
    const again = spark.applyComplete(started.state, T0 + 60000 + 18000);
    assert.strictEqual(again.reason, 'day-cap');
    assert.strictEqual(again.credit, 0);
});

test('a complete with no start, a stale start, and a banned user all pay 0', () => {
    assert.strictEqual(spark.applyComplete({}, T0).reason, 'no-start');
    assert.strictEqual(spark.applyComplete({ startAtMs: T0 }, T0 + spark.TEASER_MAX_MS + 1).reason, 'clock');
    assert.strictEqual(spark.applyComplete({ startAtMs: T0, banned: true }, T0 + 18000).reason, 'banned');
    assert.strictEqual(spark.applyStart({ banned: true }, T0).reason, 'banned');
});

test('a new offset day can credit again', () => {
    const day = spark.offsetDateKey(T0);
    const nextMs = T0 + 24 * 60 * 60 * 1000;
    assert.notStrictEqual(spark.offsetDateKey(nextMs), day);
    const done = spark.applyComplete({ startAtMs: nextMs, creditDay: day }, nextMs + 18000);
    assert.strictEqual(done.credit, 1);
    assert.strictEqual(done.state.creditDay, spark.offsetDateKey(nextMs));
});

test('rate limiter allows 8 calls in a minute and then refuses', () => {
    let st = {};
    for (let i = 0; i < spark.RATE_MAX; i++) {
        const r = spark.nextRate(st, T0 + i * 100);
        assert.ok(r.ok, 'call ' + i);
        st = r;
    }
    assert.strictEqual(spark.nextRate(st, T0 + 1000).ok, false);
    assert.strictEqual(spark.nextRate(st, T0 + spark.RATE_WINDOW_MS).ok, true);
});

test('callable ignores every client field except phase', () => {
    const src = read('functions/spark-citizen-callable.js');
    assert.ok(src.includes('enforceAppCheck: true'));
    assert.ok(src.includes("phase !== 'start' && phase !== 'complete'"));
    assert.ok(src.includes('spark.applyStart(') && src.includes('spark.applyComplete('));
    assert.ok(src.includes("sparkCitizenCount: admin.firestore.FieldValue.increment(decision.credit)"));
    assert.ok(src.includes("grant.familyFor('sparkCitizenCount')"));
    assert.ok(!/data\.(seconds|minutes|credit|count|day)/.test(src), 'client body never read');
    assert.ok(src.includes("provider === 'anonymous'"));
    assert.ok(src.includes('spark.launchOpen(nowMs)'));
    assert.ok(src.includes("failed-precondition"));
    assert.ok(src.includes('spark.needsGrant(before, awardedIds)'));
    assert.ok(src.includes('spark.rateExpireAt(rate.windowStartMs)'));
    assert.ok(src.includes('expireAt: admin.firestore.Timestamp.fromMillis(expireAtMs)'));
});

test('launch gate is closed before Sat Nov 28, 2026, 12:00 AM ET except on staging', () => {
    const at = Date.UTC(2026, 10, 28, 5, 0, 0);
    assert.strictEqual(spark.LAUNCH_AT, at);
    assert.strictEqual(spark.STAGING_PROJECT, 'bitcoin-quest-staging');
    assert.strictEqual(spark.launchOpen(at - 1, 'bitcoin-education-archive'), false);
    assert.strictEqual(spark.launchOpen(at, 'bitcoin-education-archive'), true);
    assert.strictEqual(spark.launchOpen(at + 1, 'bitcoin-education-archive'), true);
    assert.strictEqual(spark.launchOpen(at - 1, 'bitcoin-quest-staging'), true);
    assert.strictEqual(spark.launchOpen(at, 'bitcoin-quest-staging'), true);
    assert.strictEqual(spark.launchOpen(at - 1, ''), false);
});

test('needsGrant is true only when the highest awarded tier is behind the count', () => {
    assert.strictEqual(spark.needsGrant(0, []), false);
    assert.strictEqual(spark.needsGrant(1, []), true);
    assert.strictEqual(spark.needsGrant(1, ['spark_citizen_t1']), false);
    assert.strictEqual(spark.needsGrant(3, ['spark_citizen_t1']), true);
    assert.strictEqual(spark.needsGrant(7, ['spark_citizen_t1', 'spark_citizen_t2', 'spark_citizen_t3']), false);
    assert.strictEqual(spark.needsGrant(14, ['spark_citizen_t1', 'spark_citizen_t2', 'spark_citizen_t3']), true);
    assert.strictEqual(spark.needsGrant(28, [
        'spark_citizen_t1', 'spark_citizen_t2', 'spark_citizen_t3', 'spark_citizen_t4', 'spark_citizen_t5',
    ]), false);
});

test('rate-limit docs expire one day after the window start', () => {
    assert.strictEqual(spark.RATE_TTL_MS, 24 * 60 * 60 * 1000);
    assert.strictEqual(spark.rateExpireAt(T0), T0 + spark.RATE_TTL_MS);
    assert.strictEqual(spark.rateExpireAt(null), null);
});

test('deleteAccount removes the spark ledger and rate-limit doc', () => {
    const src = read('functions/src/deleteAccount.js');
    assert.ok(src.includes("deleteExactIfPresent(db, batcher, 'spark_citizen', uid)"));
    assert.ok(src.includes("deleteExactIfPresent(db, batcher, 'rate_limits', 'sparkcitizen_' + uid)"));
});

test('in-app player sends start on play and complete on ended; the public Waitlist page does not', () => {
    const js = read('citadel-spark.js');
    assert.ok(js.includes("httpsCallable('sparkCitizenTeaser')"));
    assert.ok(js.includes("creditTeaser('start')"));
    assert.ok(js.includes("creditTeaser('complete')"));
    assert.ok(js.includes('user.isAnonymous'));
    assert.ok(!read('waitlist.js').includes('sparkCitizenTeaser'), 'public waitlist stays Firebase-free');
});

test('catalog names, descriptions, and grant mapping', () => {
    const c = require('../functions/src/badges.catalog.json').badges;
    assert.strictEqual(c.spark_citizen_t1.name, 'Spark Citizen · Bronze');
    assert.strictEqual(c.spark_citizen_t5.name, 'Spark Citizen · Diamond');
    assert.ok(c.spark_citizen_t1.desc.indexOf('1 day') !== -1);
    assert.ok(c.spark_citizen_t5.desc.indexOf('28 days') !== -1);
    assert.ok(c.spark_citizen_t5.desc.indexOf('+21 orange tickets') !== -1);
    assert.strictEqual(c.spark_citizen_t1.category, 'Citadel Spark');
    assert.ok(grant.familyFor('sparkCitizenCount').indexOf('spark_citizen_t1') === 0);
});

console.log(`\nspark citizen: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
