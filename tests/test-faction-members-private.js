// Faction member counts are server-only. Race scores stay public.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const b = require('../functions/src/factionBalance');
const { planSeed } = require('../functions/scripts/seed_faction_members_private');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }
let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

const live = {
    cyber_hornets: 7259, honey_badgers: 5561, unaffiliated: 12,
    members_cyber_hornets: 60, members_honey_badgers: 40,
};

test('public totals omit member counts and averages', () => {
    const pub = b.publicFactionTotals(live);
    assert.deepStrictEqual(Object.keys(pub).sort(), ['cyber_hornets', 'honey_badgers', 'unaffiliated', 'underdog']);
    assert.strictEqual(pub.cyber_hornets, 7259);
    assert.strictEqual(pub.honey_badgers, 5561);
    assert.strictEqual(pub.unaffiliated, 12);
    assert.strictEqual(pub.underdog, 'honey_badgers');
    assert.strictEqual(pub.members_cyber_hornets, undefined);
    assert.strictEqual(pub.avg_cyber_hornets, undefined);
    assert.deepStrictEqual(b.publicFactionTotals(null), {
        cyber_hornets: 0, honey_badgers: 0, unaffiliated: 0, underdog: null,
    });
});

test('smaller side uses the private doc, then a seed, then the score', () => {
    const reply = b.smallerFactionReply(
        { members_cyber_hornets: 100, members_honey_badgers: 3 },
        true,
        { cyber_hornets: 1, honey_badgers: 9000, members_cyber_hornets: 1, members_honey_badgers: 80 }
    );
    assert.deepStrictEqual(reply, { smaller: 'honey_badgers' });
    assert.deepStrictEqual(Object.keys(reply), ['smaller']);
    assert.strictEqual(JSON.stringify(reply), '{"smaller":"honey_badgers"}');

    assert.deepStrictEqual(b.smallerFactionReply(null, false, {
        cyber_hornets: 9, honey_badgers: 9, members_cyber_hornets: 2, members_honey_badgers: 8,
    }), { smaller: 'cyber_hornets' });
    assert.deepStrictEqual(b.smallerFactionReply(null, false, {
        cyber_hornets: 5, honey_badgers: 9,
    }), { smaller: 'cyber_hornets' });
    assert.deepStrictEqual(b.smallerFactionReply(
        { members_cyber_hornets: 4, members_honey_badgers: 4 },
        true,
        { cyber_hornets: 10, honey_badgers: 10 }
    ), { smaller: null });
});

test('rules hide factionMembers and leave race scores readable', () => {
    const rules = read('firestore.rules');
    assert.ok(/match \/satoshiFavor\/factionTotals \{\s*allow read: if true;\s*allow write: if false;/.test(rules));
    assert.ok(/match \/satoshiFavor\/factionMembers \{\s*allow read, write: if false;/.test(rules));
});

test('getFactionTotals and getSmallerFaction stay free of counts', () => {
    const favor = read('functions/src/satoshiFavor.js');
    const index = read('functions/index.js');
    const totalsAt = favor.indexOf('exports.getFactionTotals');
    const smallerAt = favor.indexOf('exports.getSmallerFaction');
    const endAt = favor.indexOf('exports.SPAM_HASHER_PER_MINUTE');
    assert.ok(totalsAt > 0 && smallerAt > totalsAt && endAt > smallerAt);
    const totalsFn = favor.slice(totalsAt, smallerAt);
    const smallerFn = favor.slice(smallerAt, endAt);
    assert.ok(totalsFn.includes('publicFactionTotals'));
    assert.ok(!totalsFn.includes('perMember'));
    assert.ok(!totalsFn.includes('members_'));
    assert.ok(!totalsFn.includes('avg_'));
    assert.ok(smallerFn.includes("doc('factionMembers')"));
    assert.ok(smallerFn.includes('smallerFactionReply'));
    assert.ok(!smallerFn.includes('members_'));
    assert.ok(!smallerFn.includes('avg_'));
    assert.ok(index.includes('exports.getSmallerFaction = getSmallerFaction'));
});

test('the scoreboard and the join hint do not read member counts', () => {
    const quests = read('quests.js');
    const ranking = read('ranking.js');
    assert.ok(!quests.includes('per member'));
    assert.ok(!quests.includes('Pound for pound'));
    assert.ok(!quests.includes('sfAvgHornets'));
    assert.ok(!quests.includes('sfAvgBadgers'));
    assert.ok(!quests.includes("data['members_"));
    assert.ok(quests.includes('sfScoreHornets'));
    assert.ok(quests.includes('sfScoreBadgers'));
    assert.ok(quests.includes('Underdog boost 1.2'));
    assert.ok(quests.includes('trails by 1,000 or more'));
    assert.ok(!ranking.includes('members_'));
    assert.ok(!ranking.includes('_factionSmaller'));
    assert.ok(ranking.includes("httpsCallable('getSmallerFaction')"));
    assert.ok(!ranking.includes("doc('factionTotals').get()"));
});

test('backfill writes the private doc and the seed script is dry-run first', () => {
    const backfill = read('functions/scripts/backfill_faction_members.js');
    assert.ok(backfill.includes("doc('factionMembers')"));
    assert.ok(!backfill.includes("doc('factionTotals')"));
    assert.ok(backfill.includes("process.argv.includes('--apply')"));
    assert.ok(backfill.indexOf('if (!APPLY) return;') < backfill.indexOf("doc('factionMembers').set"));
    assert.ok(backfill.includes('firebaseAdmin.js'));

    const seed = read('functions/scripts/seed_faction_members_private.js');
    assert.ok(seed.includes("process.argv.includes('--apply')"));
    assert.ok(seed.indexOf('if (!APPLY) return;') < seed.indexOf("doc('factionMembers').set"));
    assert.ok(seed.indexOf("doc('factionMembers').set") < seed.indexOf("doc('factionTotals').update"));
    assert.ok(seed.includes('FieldValue.delete'));

    const missing = planSeed({
        cyber_hornets: 10, honey_badgers: 4,
        members_cyber_hornets: 60, members_honey_badgers: 40,
    }, false, null);
    assert.strictEqual(missing.seed, true);
    assert.deepStrictEqual(missing.seedDoc, { members_cyber_hornets: 60, members_honey_badgers: 40 });
    assert.deepStrictEqual(missing.deleteFields, ['members_cyber_hornets', 'members_honey_badgers']);

    const present = planSeed({
        cyber_hornets: 10, members_cyber_hornets: 1, members_honey_badgers: 1,
    }, true, { members_cyber_hornets: 8, members_honey_badgers: 3 });
    assert.strictEqual(present.seed, false);
    assert.strictEqual(present.seedDoc, null);
    assert.strictEqual(present.privateCounts.members_cyber_hornets, 8);
    assert.strictEqual(present.privateCounts.members_honey_badgers, 3);
    assert.deepStrictEqual(present.deleteFields, ['members_cyber_hornets', 'members_honey_badgers']);

    const clean = planSeed({ cyber_hornets: 10, honey_badgers: 4 }, false, null);
    assert.deepStrictEqual(clean.seedDoc, { members_cyber_hornets: 0, members_honey_badgers: 0 });
    assert.deepStrictEqual(clean.deleteFields, []);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
