// Leaderboard prefix search, top-50 lazy expand, and the PvP record line.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

const ranking = read('ranking.js');
const start = ranking.indexOf('var LbPrefix = (function ()');
const end = ranking.indexOf('window.LbPrefix = LbPrefix;');
assert.ok(start > 0 && end > start);
const sandbox = { window: {} };
vm.runInNewContext(ranking.slice(start, end + 'window.LbPrefix = LbPrefix;'.length), sandbox);
const Lb = sandbox.window.LbPrefix;

assert.strictEqual(Lb.DEBOUNCE_MS, 150);
assert.strictEqual(Lb.VISIBLE, 10);
assert.strictEqual(Lb.CAP, 50);
assert.strictEqual(Lb.normalizePrefix('  @Chill_Guy2 '), 'chill_guy2');
assert.strictEqual(Lb.prefixOk('c'), true);
assert.strictEqual(Lb.prefixOk(''), false);
assert.strictEqual(Lb.prefixOk('a b'), false);
assert.strictEqual(Lb.prefixEnd('c'), 'c\uf8ff');

const docs = [
    { username: 'chill_guy2', username_lower: 'chill_guy2' },
    { username: 'Ada', username_lower: 'ada' },
    { username: 'Cipher', username_lower: 'cipher' },
    { username: 'secret@email.test', username_lower: 'secret@email.test', email: 'secret@email.test' },
    { username: 'Ghosty', username_lower: 'ghosty', ghostMode: true, uid: 'uid-secret' },
    { username: 'CountLord', username_lower: 'countlord', factionCount: 40 }
];
const hits = Lb.publicNames(docs, 'c', 8);
assert.strictEqual(Array.prototype.map.call(hits, function (row) { return row.username; }).join('|'), 'chill_guy2|Cipher|CountLord');
Array.prototype.forEach.call(hits, function (row) {
    assert.strictEqual(Object.keys(row).join(','), 'username');
});
assert.strictEqual(JSON.stringify(hits).indexOf('uid-secret'), -1);
assert.strictEqual(JSON.stringify(hits).indexOf('email'), -1);
assert.strictEqual(JSON.stringify(hits).indexOf('factionCount'), -1);
const narrowed = Lb.publicNames(docs, 'ch', 8);
assert.strictEqual(Array.prototype.map.call(narrowed, function (row) { return row.username; }).join('|'), 'chill_guy2');
assert.strictEqual(Lb.pvpRecordText(12, 3), '12W - 3L · 80%');
assert.strictEqual(Lb.pvpRecordText(0, 0), '0W - 0L · 0%');

assert.ok(ranking.includes("orderBy('username_lower')"));
assert.ok(ranking.includes('.startAt(q)'));
assert.ok(ranking.includes('.limit(LbPrefix.FETCH)'));
assert.ok(ranking.includes("select('username', 'username_lower', 'ghostMode')"));
assert.ok(ranking.includes('LbPrefix.DEBOUNCE_MS'));
assert.strictEqual(ranking.includes("httpsCallable('searchUsers')"), false);
const search = ranking.slice(ranking.indexOf('async function _lbNamePrefix'), ranking.indexOf('async function _lbNameRun'));
assert.strictEqual(search.includes("collection('users')"), false);
assert.ok(ranking.includes('shellOnly: true'));
assert.ok(ranking.indexOf('AS.openCanvasSheet(') < ranking.indexOf('await _lbShareLookup(board)'));
assert.ok(ranking.includes("LbPrefix.pvpRecordText(wins, losses)"));
assert.ok(ranking.includes("_rankLabel: '50+'"));
assert.ok(ranking.includes("data-lb-more"));

const indexes = JSON.parse(read('firestore.indexes.json'));
const pin = (indexes.fieldOverrides || []).find(function (item) {
    return item.collectionGroup === 'public_profiles' && item.fieldPath === 'username_lower';
});
assert.ok(pin, 'username_lower index override');
assert.ok(pin.indexes.some(function (idx) {
    return idx.order === 'ASCENDING' && idx.queryScope === 'COLLECTION';
}));

const boards = require('../functions/src/boardSnapshots');
assert.strictEqual(boards.BOARD_SIZE, 50);
assert.strictEqual(boards.FETCH_LIMIT, 50);
assert.strictEqual(require('../functions/src/questBoard').FETCH_LIMIT, 50);
assert.strictEqual(require('../functions/src/streakBoard').FETCH_LIMIT, 50);
assert.strictEqual(require('../functions/src/predictionStats').BOARD_SIZE, 50);

console.log('test-lb-fast: all passed');
