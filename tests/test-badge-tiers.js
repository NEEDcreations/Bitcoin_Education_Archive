// 5-tier badge standard (team plan, Rewards Nov 1 2026; Phil Nov 2: tiers
// only for incremental-progress badges). First active family: Timechain TV
// lifetime watch time, counted by the server heartbeat only.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const tiers = require('../functions/src/badgeTiers');
const rules = require('../functions/src/badgeRules');
const watch = require('../functions/src/tctvWatch');
const grant = require('../functions/src/grantBadge');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log('✅ ' + name); passed++; } catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; } }
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const T0 = Date.UTC(2026, 10, 2, 15, 0, 0);

test('five Bitcoin-themed tiers, bronze..diamond', () => {
    assert.deepStrictEqual(tiers.TIERS.map((t) => t.metal), ['bronze', 'silver', 'gold', 'platinum', 'diamond']);
});
test('only Platinum and Diamond pay orange tickets', () => {
    assert.strictEqual(tiers.TIER_TICKETS[1] + tiers.TIER_TICKETS[2] + tiers.TIER_TICKETS[3], 0);
    assert.ok(tiers.TIER_TICKETS[4] > 0 && tiers.TIER_TICKETS[5] > tiers.TIER_TICKETS[4]);
});
test('TCTV watch thresholds match the plan (10 min, 5 h, 100 h, 500 h, 2,100 h)', () => {
    assert.deepStrictEqual(tiers.ACTIVE.tctv_watch.tiers.map((r) => r[0]), [10, 300, 6000, 30000, 126000]);
    assert.strictEqual(tiers.tierInfo('tctv_watch_t5').gte, 126000 * 60);
});
test('thresholds strictly increase in every planned family', () => {
    Object.keys(tiers.PLANNED).forEach((f) => {
        const nums = tiers.PLANNED[f].filter((x) => typeof x === 'number');
        for (let i = 1; i < nums.length; i++) assert.ok(nums[i] > nums[i - 1], f);
        assert.strictEqual(tiers.PLANNED[f].length, 5, f);
    });
});
test('checklist families are exempt and never active', () => {
    tiers.EXEMPT.forEach((f) => { assert.ok(!tiers.ACTIVE[f] && !tiers.PLANNED[f]); });
});
test('tier badges are paying server counter rules on a server-only field', () => {
    tiers.allIds().forEach((id) => {
        const r = rules.ruleFor(id);
        assert.ok(r && !r.cosmetic, id + ' pays');
        assert.deepStrictEqual(r.source, { type: 'counter', field: 'tctvLifetimeSeconds', gte: tiers.tierInfo(id).gte });
        assert.ok(r.xp > 0 && r.xp <= rules.XP_CAP, id + ' xp within cap');
    });
    assert.strictEqual(rules.ruleFor('tctv_watch_t4').tickets, tiers.TIER_TICKETS[4]);
    assert.strictEqual(rules.ruleFor('tctv_watch_t1').tickets, 0);
});
test('old device-local TCTV minute badges stay cosmetic', () => {
    assert.ok(rules.ruleFor('tctv_satellite').cosmetic);
    assert.ok(rules.ruleFor('tctv_tuned_in').cosmetic);
});
test('criteria come only from the user doc counter', () => {
    const r = rules.ruleFor('tctv_watch_t2');
    assert.ok(!rules.meets(r, { tctvLifetimeSeconds: 300 * 60 - 1 }, {}));
    assert.ok(rules.meets(r, { tctvLifetimeSeconds: 300 * 60 }, {}));
    assert.ok(!rules.meets(r, { tctvWatchSeconds: 1e9, tctvWatchDays: 9999 }, {}), 'legacy fields ignored');
});
test('grantFamily maps the counter to the five ids, then the tier collections', () => {
    assert.deepStrictEqual(grant.familyFor('tctvLifetimeSeconds'), tiers.allIds().concat(Object.keys(tiers.COLLECTIONS)));
});
test('rules: client cannot write tctvLifetimeSeconds; tctv_watch is server-only', () => {
    const r = read('firestore.rules');
    assert.ok(/userProfileServerOnlyKeys\(\) \{[\s\S]*'tctvLifetimeSeconds'/.test(r));
    assert.ok(/match \/tctv_watch\/\{uid\} \{[\s\S]*?allow create, update, delete: if false;/.test(r));
});
test('catalog lists the five tiers with capped display XP', () => {
    const c = require('../functions/src/badges.catalog.json').badges;
    tiers.allIds().forEach((id) => { assert.ok(c[id] && c[id].xp <= 5000 && c[id].category === 'Prime Time', id); });
    assert.ok(read('badges.catalog.js').includes('"tctv_watch_t5"'));
});

// Lifetime clock
function run(steps) { let st = {}; const out = []; for (const [dt, fresh] of steps) { const r = watch.applyLifetimeCredit(Object.assign({}, st, { presenceFresh: fresh !== false }), T0 + dt); if (r.state) st = r.state; out.push(r); } return { st, out }; }
test('first heartbeat only starts the clock', () => {
    const r = watch.applyLifetimeCredit({ presenceFresh: true }, T0);
    assert.strictEqual(r.credit, 0); assert.strictEqual(r.reason, 'clock');
});
test('60 s credit per real minute, nothing faster', () => {
    const { out } = run([[0], [60000], [61000], [120000]]);
    assert.deepStrictEqual(out.map((o) => o.credit), [0, 60, 0, 60]);
    assert.strictEqual(out[2].reason, 'too-fast');
});
test('no presence, no credit; banned never credits', () => {
    assert.strictEqual(watch.applyLifetimeCredit({ presenceFresh: false, lifeLastMs: T0 - 60000, lifeDay: '2026-11-02' }, T0).credit, 0);
    assert.strictEqual(watch.applyLifetimeCredit({ presenceFresh: true, banned: true, lifeLastMs: T0 - 60000, lifeDay: '2026-11-02' }, T0).credit, 0);
});
test('gap over 3 minutes restarts the clock, nothing backfilled', () => {
    const r = watch.applyLifetimeCredit({ presenceFresh: true, lifeLastMs: T0 - 10 * 60000, lifeDay: '2026-11-02', lifeDaySeconds: 0 }, T0);
    assert.strictEqual(r.credit, 0); assert.strictEqual(r.reason, 'clock');
});
test('future lastMs (clock skew) restarts rather than credits', () => {
    const r = watch.applyLifetimeCredit({ presenceFresh: true, lifeLastMs: T0 + 3600000, lifeDay: '2026-11-02' }, T0);
    assert.strictEqual(r.credit, 0);
});
test('3 hours a day cap, then capped=true', () => {
    const cap = watch.LIFE_DAY_CAP_SECONDS;
    const r = watch.applyLifetimeCredit({ presenceFresh: true, lifeLastMs: T0 - 60000, lifeDay: '2026-11-02', lifeDaySeconds: cap - 30 }, T0);
    assert.strictEqual(r.credit, 30); assert.strictEqual(r.capped, true);
    const r2 = watch.applyLifetimeCredit({ presenceFresh: true, lifeLastMs: T0 - 60000, lifeDay: '2026-11-02', lifeDaySeconds: cap }, T0);
    assert.strictEqual(r2.credit, 0); assert.strictEqual(r2.reason, 'day-cap');
});
test('a new offset day resets the daily cap', () => {
    const r = watch.applyLifetimeCredit({ presenceFresh: true, lifeLastMs: T0 - 60000, lifeDay: '2026-11-01', lifeDaySeconds: 99999 }, T0);
    assert.strictEqual(r.credit, 60); assert.strictEqual(r.state.lifeDaySeconds, 60);
});
test('a full simulated day never exceeds 3 h and tier V needs 700 days', () => {
    let st = {}; const perDay = {};
    for (let m = 0; m < 48 * 60; m++) { const r = watch.applyLifetimeCredit(Object.assign({}, st, { presenceFresh: true }), T0 + m * 60000); if (r.state) st = r.state; perDay[st.lifeDay] = (perDay[st.lifeDay] || 0) + r.credit; }
    Object.keys(perDay).forEach((d) => assert.ok(perDay[d] <= 3 * 3600, d + ' ' + perDay[d]));
    assert.ok(tiers.tierInfo('tctv_watch_t5').gte / (3 * 3600) >= 700);
});
test('callable: tierCrossed only on a real crossing', () => {
    const src = read('functions/tctv-watch-callable.js');
    assert.ok(src.includes('watch.applyLifetimeCredit('));
    assert.ok(src.includes("tctvLifetimeSeconds: admin.firestore.FieldValue.increment(life.credit)"));
    assert.ok(!/data\.(seconds|minutes|credit|life)/.test(src), 'client body never read');
});
test('client keeps heartbeating after the daily goal until the server caps', () => {
    const src = read('tctv-watch.js');
    assert.ok(src.includes('function heartbeatsDone()'));
    assert.ok(src.includes('lifeCapped = data.lifeCapped'));
    assert.ok(!/function sendHeartbeat\(\) \{\s*if \(inflight \|\| window\._tctvWatchDoneToday\)/.test(src));
});
test('tier XP rises by tier and tier V <= 5,000 in every family (Phil, Nov 2)', () => {
    assert.deepStrictEqual(tiers.ACTIVE.tctv_watch.tiers.map((r) => r[1]), [10, 150, 1000, 2500, 5000]);
    const fams = Object.assign({ tctv_watch: tiers.ACTIVE.tctv_watch.tiers.map((r) => r[1]) }, tiers.PLANNED_XP);
    Object.keys(tiers.PLANNED).forEach((f) => assert.ok(tiers.PLANNED_XP[f], f + ' has XP'));
    Object.keys(fams).forEach((f) => {
        const x = fams[f];
        assert.strictEqual(x.length, 5, f);
        for (let i = 1; i < 5; i++) assert.ok(x[i] > x[i - 1], f + ' rises');
        assert.ok(x[4] <= tiers.TIER_XP_MAX && x[0] >= 10, f + ' bounds');
    });
});

test('tier names are Bronze/Silver/Gold/Platinum/Diamond', () => {
    assert.deepStrictEqual(tiers.TIERS.map((t) => t.name), ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond']);
});
test('orange tickets: Platinum 5, Diamond 21, others 0', () => {
    assert.deepStrictEqual(tiers.TIER_TICKETS, { 1: 0, 2: 0, 3: 0, 4: 5, 5: 21 });
});
const gf = require('../functions/scripts/backfill_tier_grandfather');
test('grandfather: counter tiers only up to the current tier', () => {
    const ids = gf.qualifyingTiers({ tctvLifetimeSeconds: 300 * 60 }).map((t) => t.id);
    assert.deepStrictEqual(ids, ['tctv_watch_t1', 'tctv_watch_t2']);
    assert.deepStrictEqual(gf.qualifyingTiers({}), []);
    assert.deepStrictEqual(gf.qualifyingTiers({ tctvLifetimeSeconds: 599 }), []);
});
test('grandfather: old badge ownership counts', () => {
    const q = gf.qualifyingTiers({ badges: ['tctv_binge_watcher'] });
    assert.deepStrictEqual(q.map((t) => t.id + ':' + t.reason), ['tctv_watch_t2:legacy_badge']);
    const p = gf.qualifyingTiers({ visibleBadges: [{ id: 'tctv_watch_t4' }] });
    assert.deepStrictEqual(p.map((t) => t.id + ':' + t.reason), ['tctv_watch_t4:profile']);
});
test('grandfather record pays nothing and is flagged', () => {
    const fake = { firestore: { FieldValue: { serverTimestamp: () => 'ts' } } };
    const r = gf.grandfatherRecord(fake, 'tctv_watch_t5', 'counter', '2026-11-02');
    assert.strictEqual(r.xp, 0); assert.strictEqual(r.tickets, 0); assert.strictEqual(r.grandfathered, true);
    assert.strictEqual(r.badge, 'tctv_watch_t5');
});
test('grandfather defaults to dry run; apply needs both flags', () => {
    assert.strictEqual(gf.parseArgs([]).apply, false);
    assert.strictEqual(gf.parseArgs(['--apply']).apply, false);
    assert.strictEqual(gf.parseArgs(['--confirm=GRANDFATHER']).apply, false);
    assert.strictEqual(gf.parseArgs(['--apply', '--confirm=GRANDFATHER']).apply, true);
    assert.strictEqual(gf.shortUid('abcdefghijkl'), 'abcdef…');
});
test('grandfather writes the badge_awards doc with create(), never set()', () => {
    const src = read('functions/scripts/backfill_tier_grandfather.js');
    assert.ok(src.includes("collection('badge_awards').doc(t.id)"));
    assert.ok(src.includes('ref.create(') && !/ref\.set\(/.test(src));
    assert.ok(!/email/i.test(src.replace(/no emails/g, '')));
});
test('awardBadge refuses to pay when an award doc already exists', () => {
    const src = read('functions/src/awardBadge.js');
    assert.ok(/if \(awardSnap\.exists\) \{\s*return \{ granted: false, success: false, reason: 'already', awarded: 0, xp: 0/.test(src));
});

test('tier collections cover every ACTIVE family at Platinum / Diamond', () => {
    assert.deepStrictEqual(tiers.collectionMembers('tier_all_platinum'), Object.keys(tiers.ACTIVE).map((f) => f + '_t4'));
    assert.deepStrictEqual(tiers.collectionMembers('tier_all_diamond'), Object.keys(tiers.ACTIVE).map((f) => f + '_t5'));
    ['tier_all_platinum', 'tier_all_diamond'].forEach((id) => {
        const r = rules.ruleFor(id);
        assert.ok(r && !r.cosmetic && r.source.type === 'tierSet', id);
        assert.ok(r.xp > 0 && r.xp <= tiers.TIER_XP_MAX, id + ' xp');
        assert.ok(!tiers.isTierId(id));
    });
    assert.ok(grant.familyFor('tctvLifetimeSeconds').indexOf('tier_all_diamond') > grant.familyFor('tctvLifetimeSeconds').indexOf('tctv_watch_t5'));
});
console.log(`\nbadge tiers: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
