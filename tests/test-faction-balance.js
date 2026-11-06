// Faction race balance: underdog boost, join bonus, per-member average.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const b = require('../functions/src/factionBalance');
const root = path.join(__dirname, '..');
let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}
const NOW = Date.UTC(2026, 10, 5);
const live = { cyber_hornets: 7259, honey_badgers: 5561, members_cyber_hornets: 60, members_honey_badgers: 40 };

test('trailing faction by 1,000+ gets 1.2x', () => {
    const r = b.racePoints(1, 'honey_badgers', live, { faction: 'honey_badgers' }, NOW);
    assert.strictEqual(r.points, 1.2); assert.ok(r.underdog);
});
test('leader gets no boost', () => {
    assert.strictEqual(b.racePoints(1, 'cyber_hornets', live, { faction: 'cyber_hornets' }, NOW).points, 1);
});
test('boost switches off when the gap is under 1,000', () => {
    const close = { cyber_hornets: 7000, honey_badgers: 6001 };
    assert.strictEqual(b.racePoints(1, 'honey_badgers', close, {}, NOW).points, 1);
});
test('join bonus stacks only inside its window and for the same faction', () => {
    const u = { faction: 'honey_badgers', factionBonusUntil: NOW + 1000 };
    assert.strictEqual(b.racePoints(1, 'honey_badgers', live, u, NOW).points, 1.5);
    assert.strictEqual(b.racePoints(1, 'honey_badgers', live, u, NOW + 2000).points, 1.2);
    assert.strictEqual(b.racePoints(1, 'cyber_hornets', live, u, NOW).points, 1);
});
test('no faction earns base points only', () => {
    assert.strictEqual(b.racePoints(3, null, live, {}, NOW).points, 3);
});
test('bad base is zero', () => {
    assert.strictEqual(b.racePoints(-5, 'honey_badgers', live, {}, NOW).points, 0);
    assert.strictEqual(b.racePoints('x', 'honey_badgers', live, {}, NOW).points, 0);
});
test('smaller faction uses members, then score', () => {
    assert.strictEqual(b.smallerFaction(live), 'honey_badgers');
    assert.strictEqual(b.smallerFaction({ cyber_hornets: 5, honey_badgers: 9 }), 'cyber_hornets');
    assert.strictEqual(b.smallerFaction({}), null);
});
test('per-member average', () => {
    assert.strictEqual(b.perMember(live, 'cyber_hornets'), 121);
    assert.strictEqual(b.perMember(live, 'honey_badgers'), 139);
    assert.strictEqual(b.perMember({}, 'honey_badgers'), 0);
});
test('rules block client writes to join time and bonus window', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    assert.ok(rules.includes("'factionJoinedAt', 'factionBonusUntil'"));
    assert.ok(/match \/satoshiFavor\/factionTotals \{\s*allow read: if true;\s*allow write: if false;/.test(rules));
});
test('every server Favor write uses race points', () => {
    ['satoshiFavor.js', 'awardBadge.js', 'collectionBonus.js'].forEach((f) => {
        const src = fs.readFileSync(path.join(root, 'functions/src', f), 'utf8');
        assert.ok(src.includes('racePoints('), f);
    });
});
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
