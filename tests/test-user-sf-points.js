// All-time personal Satoshi's Favor total. The counter is server-written.
// Clients can read only their own doc, and not another user's contributor rows.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { contributionPoints, tallyUserSfPoints } = require('../functions/src/userSfPoints');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

test('a user total sums only that user\'s contributor docs', function () {
    assert.strictEqual(contributionPoints({ pointsAdded: 4 }), 4);
    assert.strictEqual(contributionPoints({ source: 'level_up_10' }), 10);
    assert.strictEqual(contributionPoints({ pointsAdded: -5, source: 'level_up' }), 1);
    assert.strictEqual(contributionPoints({}), 1);
    const tally = tallyUserSfPoints([
        { uid: 'ada', pointsAdded: 4 },
        { uid: 'ada', source: 'level_up_10' },
        { uid: 'ada', faction: 'honey_badgers', pointsAdded: 9 },
        { uid: 'bob', pointsAdded: 15 },
        { pointsAdded: 100 },
    ]);
    assert.strictEqual(tally.byUid.ada, 23);
    assert.strictEqual(tally.byUid.bob, 15);
    assert.strictEqual(tally.users, 2);
    assert.strictEqual(tally.docs, 4);
    assert.strictEqual(tally.points, 38);
});

test('contributeFavor increments the owner counter in the contributor transaction', function () {
    const src = fs.readFileSync(path.join(root, 'functions/src/satoshiFavor.js'), 'utf8');
    const start = src.indexOf('exports.contributeFavor');
    const end = src.indexOf('exports.hashForFavor');
    assert.ok(start > 0 && end > start);
    const body = src.slice(start, end);
    const created = body.indexOf('transaction.set(contributorRef');
    const counter = body.indexOf("doc('userSfPoints')");
    const increment = body.indexOf('FieldValue.increment(pointsToAdd)');
    const done = body.lastIndexOf('success: true');
    assert.ok(created > 0);
    assert.ok(counter > created);
    assert.ok(increment > created);
    assert.ok(done > increment);
    const txnEnd = body.indexOf('});', increment);
    assert.ok(txnEnd > increment);
});

test('rules hide other users\' contributions and reject client counter writes', function () {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const contrib = rules.slice(rules.indexOf('match /contributors/{docId}'));
    const contribBlock = contrib.slice(0, contrib.indexOf('match /hashes/{hashId}'));
    assert.ok(contribBlock.indexOf('resource.data.uid == request.auth.uid') > 0);
    assert.ok(contribBlock.indexOf('allow write: if false;') > 0);
    assert.ok(contribBlock.indexOf('allow read: if true') === -1);

    const counter = rules.slice(rules.indexOf('match /satoshiFavor/userSfPoints'));
    const counterBlock = counter.slice(0, counter.indexOf('match /satoshiFavor/factionSyncs'));
    assert.ok(counterBlock.indexOf('allow read, write: if false;') > 0);
    assert.ok(counterBlock.indexOf('request.auth.uid == uid') > 0);
    assert.ok(counterBlock.indexOf('allow write: if false;') > 0);

    const quests = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
    assert.ok(quests.indexOf("You've contributed ") > 0);
    assert.ok(quests.indexOf(' to Honey Badgers') > 0);
    assert.ok(quests.indexOf(' to Cyber Hornets') > 0);
    assert.ok(quests.indexOf(', unclaimed') > 0);
    assert.ok(quests.indexOf('(all time).') > 0);
    assert.ok(quests.indexOf('sfMyContributionText') > 0);
    assert.ok(quests.indexOf('userSfPoints') > 0);

    const script = fs.readFileSync(path.join(root, 'functions/scripts/backfill_user_sf_points.js'), 'utf8');
    assert.ok(script.indexOf("process.argv.indexOf('--apply')") > 0);
    assert.ok(script.indexOf('dry-run only') > 0);
    assert.ok(script.indexOf('if (require.main === module)') > 0);
    assert.ok(script.indexOf('tallyUserSfPoints') > 0);
    assert.ok(script.indexOf('FieldValue.increment') === -1);
    const notes = fs.readFileSync(path.join(root, 'patch-notes.html'), 'utf8');
    assert.ok(notes.indexOf('all-time Satoshi\'s Favor total') > 0);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
