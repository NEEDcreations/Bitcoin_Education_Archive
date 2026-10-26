// Favor snapshots store the public profile name, then the users-doc username.
// A missing name, the placeholder Anonymous, or a hash-like token is null.
// topHashes rows keep uid so a later fix can match the miner.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    resolveSolverName,
    cleanSolverName,
    isHashLikeName,
    favorChatHandle,
    shapeTopHashEntry,
} = require('../functions/src/satoshiFavor');

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

test('a blank or placeholder name is not stored', function () {
    assert.strictEqual(cleanSolverName(''), '');
    assert.strictEqual(cleanSolverName('   '), '');
    assert.strictEqual(cleanSolverName('Anonymous'), '');
    assert.strictEqual(cleanSolverName('anonymous'), '');
    assert.strictEqual(cleanSolverName('Anon'), '');
    assert.strictEqual(resolveSolverName('', ''), null);
    assert.strictEqual(resolveSolverName('Anonymous', 'Anon'), null);
    assert.strictEqual(resolveSolverName(null, undefined), null);
});

test('a hash-like token is not stored as a name', function () {
    const hex = '0123456789abcdef';
    const digest = 'a'.repeat(64);
    assert.strictEqual(isHashLikeName(hex), true);
    assert.strictEqual(isHashLikeName(digest), true);
    assert.strictEqual(isHashLikeName('QuestFan'), false);
    assert.strictEqual(isHashLikeName('deadbeef'), false);
    assert.strictEqual(cleanSolverName(hex), '');
    assert.strictEqual(resolveSolverName(hex, digest), null);
    assert.strictEqual(resolveSolverName(hex, 'SatoshiFan'), 'SatoshiFan');
    assert.strictEqual(resolveSolverName('QuestFan', hex), 'QuestFan');
});

test('the public profile name wins, then the users-doc username', function () {
    assert.strictEqual(resolveSolverName('QuestFan', 'Other'), 'Other');
    assert.strictEqual(resolveSolverName('QuestFan', ''), 'QuestFan');
    assert.strictEqual(resolveSolverName('QuestFan', 'Anonymous'), 'QuestFan');
    assert.strictEqual(resolveSolverName('', 'SatoshiFan'), 'SatoshiFan');
});

test('chat uses the resolved name or a neutral label', function () {
    assert.strictEqual(favorChatHandle('SatoshiFan', 50), '@SatoshiFan');
    assert.strictEqual(favorChatHandle('Anonymous', 50), 'a miner');
    assert.strictEqual(favorChatHandle('0123456789abcdef', 30), 'a miner');
    assert.strictEqual(favorChatHandle(null, 50), 'a miner');
    assert.ok(favorChatHandle('NamedMiner').indexOf('Anonymous') === -1);
    assert.ok(favorChatHandle(null).indexOf('Anonymous') === -1);
});

test('a topHashes entry keeps uid and a null name', function () {
    const named = shapeTopHashEntry({
        uid: 'user_1',
        username: 'SatoshiFan',
        value: 42,
        timestamp: 5,
        difficultyTarget: 20000,
    });
    assert.strictEqual(named.uid, 'user_1');
    assert.strictEqual(named.username, 'SatoshiFan');
    assert.strictEqual(named.value, 42);
    assert.strictEqual(named.difficultyTarget, 20000);

    const blank = shapeTopHashEntry({
        uid: 'user_2',
        username: 'Anonymous',
        value: 99,
        timestamp: 6,
        difficultyTarget: 20000,
    });
    assert.strictEqual(blank.uid, 'user_2');
    assert.strictEqual(blank.username, null);
    assert.ok(!Object.prototype.hasOwnProperty.call(shapeTopHashEntry({
        username: 'SatoshiFan',
        value: 1,
    }), 'uid'));

    const hashed = shapeTopHashEntry({
        uid: 'user_3',
        username: '0123456789abcdef',
        value: 7,
    });
    assert.strictEqual(hashed.uid, 'user_3');
    assert.strictEqual(hashed.username, null);
});

test('hashForFavor reads the public profile first and does not store a placeholder', function () {
    const favor = fs.readFileSync(path.join(root, 'functions/src/satoshiFavor.js'), 'utf8');
    const start = favor.indexOf('// Get username');
    const end = favor.indexOf('const rigNum');
    assert.ok(start > 0 && end > start);
    const block = favor.slice(start, end);
    assert.ok(block.includes('data.username from the client is ignored'));
    assert.ok(block.indexOf("collection('public_profiles')") < block.indexOf("collection('users')"));
    assert.ok(block.includes('resolveSolverName'));
    assert.ok(!block.includes("username = 'Anonymous'"));
    assert.ok(!block.includes('data.username ||'));
    assert.ok(!block.includes('displayName'));
    const hashStart = favor.indexOf('exports.hashForFavor');
    const hashEnd = favor.indexOf('exports.checkFavorState');
    const hash = favor.slice(hashStart, hashEnd);
    assert.ok(hash.includes('shapeTopHashEntry'));
    assert.ok(hash.includes('uid,'));
    assert.ok(hash.includes('favorChatHandle'));
    assert.ok(!hash.includes("|| 'Anonymous'"));
    assert.ok(!hash.includes("|| 'Anon'"));
    const syncStart = favor.indexOf('exports.syncCycleToTop10');
    const syncEnd = favor.indexOf('exports.backfillFactionTotals');
    const sync = favor.slice(syncStart, syncEnd);
    assert.ok(sync.includes('uid: hash.uid'));
    assert.ok(sync.includes('shapeTopHashEntry'));
    assert.ok(!sync.includes("|| 'Anon'"));
});

test('the top hashes list looks up a blank name by uid and rules stay write-false', function () {
    const quests = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
    const renderStart = quests.indexOf('function _renderTopHashesHTML');
    const renderEnd = quests.indexOf('function _renderPBHTML');
    const render = quests.slice(renderStart, renderEnd);
    assert.ok(render.includes('_sfStoredNameMissing'));
    assert.ok(render.includes('data-profile-uid'));
    assert.ok(render.includes('data-blank-name'));
    const loadStart = quests.indexOf("el.innerHTML = _renderTopHashesHTML(doc.data().entries);");
    const load = quests.slice(loadStart, loadStart + 220);
    assert.ok(load.includes('patchBlankProfileNames(el)'));
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const profiles = rules.slice(rules.indexOf('match /public_profiles/{uid}'), rules.indexOf('match /visits/{visitorId}'));
    assert.ok(profiles.includes('allow read: if request.auth != null;'));
    assert.ok(profiles.includes('allow write: if false;'));
    const live = fs.readFileSync(path.join(root, 'functions/src/favorLiveAnnounce.js'), 'utf8');
    assert.ok(live.includes('function shouldAnnounceLive'));
    const policy = fs.readFileSync(path.join(root, 'functions/src/usernamePolicy.js'), 'utf8');
    assert.ok(policy.includes('No whitespace of any kind'));
    assert.ok(policy.includes("error: 'spaces'"));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
