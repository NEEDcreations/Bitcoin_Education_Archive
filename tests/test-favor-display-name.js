// Favor snapshots store the public profile name, then the users-doc username.
// A name must match the username allowlist. The public topHashes doc has no uid.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    resolveSolverName,
    cleanSolverName,
    favorChatHandle,
    shapeTopHashEntry,
    SOLVER_NAME_RE,
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

test('a newline, a control character, or a too-long name is not stored', function () {
    assert.strictEqual(SOLVER_NAME_RE.source, '^[A-Za-z0-9_\\-.]{3,20}$');
    assert.strictEqual(cleanSolverName('Miner\nJoe'), '');
    assert.strictEqual(cleanSolverName('MinerJoe\n'), '');
    assert.strictEqual(cleanSolverName('Mine\u0001r'), '');
    assert.strictEqual(cleanSolverName('Miner\u007F'), '');
    assert.strictEqual(cleanSolverName('A'.repeat(21)), '');
    assert.strictEqual(cleanSolverName('ab'), '');
    assert.strictEqual(cleanSolverName('Miner Joe'), '');
    assert.strictEqual(resolveSolverName('Miner\nJoe', 'A'.repeat(21)), null);
    assert.strictEqual(favorChatHandle('Miner\nJoe', 50), 'a miner');
    assert.strictEqual(favorChatHandle('A'.repeat(21), 50), 'a miner');
    assert.strictEqual(favorChatHandle('\u0007Satoshi', 30), 'a miner');
    assert.strictEqual(cleanSolverName('SatoshiFan'), 'SatoshiFan');
    assert.strictEqual(cleanSolverName('deadbeef'), 'deadbeef');
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
    assert.strictEqual(favorChatHandle('0123456789abcdef', 30), '@0123456789abcdef');
    assert.strictEqual(favorChatHandle('a'.repeat(64), 30), 'a miner');
    assert.strictEqual(favorChatHandle(null, 50), 'a miner');
    assert.ok(favorChatHandle('NamedMiner').indexOf('Anonymous') === -1);
    assert.ok(favorChatHandle(null).indexOf('Anonymous') === -1);
});

test('a public topHashes entry drops uid and keeps a null name', function () {
    const named = shapeTopHashEntry({
        uid: 'user_1',
        uidHash: 'abcdef0123456789',
        username: 'SatoshiFan',
        value: 42,
        timestamp: 5,
        difficultyTarget: 20000,
    });
    assert.strictEqual(named.username, 'SatoshiFan');
    assert.strictEqual(named.value, 42);
    assert.strictEqual(named.difficultyTarget, 20000);
    assert.ok(!Object.prototype.hasOwnProperty.call(named, 'uid'));
    assert.ok(!Object.prototype.hasOwnProperty.call(named, 'uidHash'));
    assert.ok(!JSON.stringify(named).includes('user_1'));

    const blank = shapeTopHashEntry({
        uid: 'user_2',
        username: 'Anonymous',
        value: 99,
        timestamp: 6,
        difficultyTarget: 20000,
    });
    assert.ok(!Object.prototype.hasOwnProperty.call(blank, 'uid'));
    assert.strictEqual(blank.username, null);

    const tooLong = shapeTopHashEntry({
        uid: 'user_3',
        username: 'A'.repeat(21),
        value: 7,
    });
    assert.strictEqual(tooLong.username, null);
    assert.ok(!Object.prototype.hasOwnProperty.call(tooLong, 'uid'));
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
    assert.ok(hash.includes('rememberOwnTopHash(uid, value)'));
    assert.ok(favor.includes('topHashValues'));
    assert.ok(!/shapeTopHashEntry\(\{[^}]*\buid\b/.test(hash));
    assert.ok(hash.includes('favorChatHandle'));
    assert.ok(!hash.includes("|| 'Anonymous'"));
    assert.ok(!hash.includes("|| 'Anon'"));
    const syncStart = favor.indexOf('exports.syncCycleToTop10');
    const syncEnd = favor.indexOf('exports.backfillFactionTotals');
    const sync = favor.slice(syncStart, syncEnd);
    assert.ok(sync.includes('rememberOwnTopHash(owned[i].uid'));
    assert.ok(sync.includes("lbRef.set({ entries })"));
    assert.ok(sync.includes('shapeTopHashEntry'));
    assert.ok(!/shapeTopHashEntry\(\{[^}]*\buid\b/.test(sync));
    assert.ok(!sync.includes('uid: e.uid'));
    assert.ok(!sync.includes("|| 'Anon'"));
});

test('the public top hashes list matches own hash values and rules stay write-false', function () {
    const quests = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
    const renderStart = quests.indexOf('function _renderTopHashesHTML');
    const renderEnd = quests.indexOf('function _renderPBHTML');
    const render = quests.slice(renderStart, renderEnd);
    assert.ok(render.includes('_sfStoredNameMissing'));
    assert.ok(render.includes('_sfRowIsMine'));
    assert.ok(render.includes("'Anon'"));
    assert.ok(!render.includes('data-profile-uid'));
    assert.ok(!render.includes('e.uid'));
    const note = quests.slice(quests.indexOf('function _sfNoteOwnHashes'), quests.indexOf('function _renderTopHashesHTML'));
    assert.ok(note.includes('topHashValues'));
    const loadStart = quests.indexOf('window._sfTopHashEntries = doc.data().entries;');
    const load = quests.slice(loadStart, loadStart + 180);
    assert.ok(load.includes('_renderTopHashesHTML'));
    assert.ok(!load.includes('patchBlankProfileNames'));
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
