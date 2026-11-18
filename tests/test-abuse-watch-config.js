// Abuse-watch lists are read from server-only config at request time.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const { loadAbuseWatchConfig, normalize, DOC_PATH } = require('../functions/src/abuseWatchConfig');
let passed = 0, failed = 0;
const pending = [];
function test(name, fn) {
    pending.push(Promise.resolve().then(fn).then(
        function () { passed++; console.log('  ok  ' + name); },
        function (e) { failed++; console.log('  FAIL ' + name + ': ' + e.message); }));
}
function fakeDb(behavior) {
    return { collection: function (c) { return { doc: function (d) { return { get: async function () {
        assert.deepStrictEqual([c, d], DOC_PATH);
        if (behavior === 'throw') throw new Error('unavailable');
        if (behavior === null) return { exists: false, data: function () { return undefined; } };
        return { exists: true, data: function () { return behavior; } };
    } }; } }; } };
}
const quiet = console.warn; console.warn = function () {};

test('config doc lives in the admin-only private_banks collection', function () {
    assert.deepStrictEqual(DOC_PATH, ['private_banks', 'abuse_watch']);
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    assert.ok(/match \/private_banks\/\{docId\} \{\s*allow read, write: if false;/.test(rules));
});
test('missing doc gives empty lists', async function () {
    const c = await loadAbuseWatchConfig(fakeDb(null));
    assert.deepStrictEqual(c.watchlistUids, []);
    assert.deepStrictEqual(c.blacklistedLn, []);
    assert.deepStrictEqual(c.knownEmailPatterns, []);
});
test('read failure gives the same safe fallback', async function () {
    const c = await loadAbuseWatchConfig(fakeDb('throw'));
    assert.strictEqual(c.watchlistUids.length + c.blacklistedLn.length + c.knownEmailPatterns.length, 0);
});
test('valid doc is passed through', async function () {
    const c = await loadAbuseWatchConfig(fakeDb({
        watchlistUids: ['uidA', ' uidB ', '', 5],
        blacklistedLn: ['x@example.test'],
        knownEmailPatterns: [{ source: 'foo.*bar|bar.*foo', flags: 'i' }, { source: '(', flags: 'i' }, { flags: 'i' }],
    }));
    assert.deepStrictEqual(c.watchlistUids, ['uidA', 'uidB']);
    assert.deepStrictEqual(c.blacklistedLn, ['x@example.test']);
    assert.strictEqual(c.knownEmailPatterns.length, 1);
    assert.ok(c.knownEmailPatterns[0].test('FOOxBAR@example.test'));
    assert.ok(!c.knownEmailPatterns[0].test('someone@example.test'));
});
test('stateful regex flags are dropped so .test() stays repeatable', function () {
    const c = normalize({ knownEmailPatterns: [{ source: 'abc', flags: 'gi' }] });
    assert.strictEqual(c.knownEmailPatterns[0].flags, 'i');
    assert.ok(c.knownEmailPatterns[0].test('ABC') && c.knownEmailPatterns[0].test('ABC'));
});
test('functions/index.js has no hardcoded watch lists and uses the loader', function () {
    const src = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    assert.ok(!/const WATCHLIST_UIDS = \[/.test(src));
    assert.ok(!/const BLACKLISTED_LN = \[/.test(src));
    assert.ok(!/const KNOWN_PATTERNS = \[/.test(src));
    assert.ok(/require\('\.\/src\/abuseWatchConfig'\)/.test(src));
    const i = src.indexOf('exports.watchlistCheck');
    assert.ok(i > 0 && src.indexOf('loadAbuseWatchConfig(db)', i) - i < 400);
    const j = src.indexOf('exports.dailyActiveUsers');
    const k = src.indexOf('loadAbuseWatchConfig(db)', j);
    assert.ok(j > 0 && k > j && k < src.indexOf('exports.', j + 10));
});
test('forum post notifier recipient comes from config, not a literal address', function () {
    const src = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    const i = src.indexOf('exports.onForumPost');
    const seg = src.slice(i, src.indexOf('exports.', i + 10));
    assert.ok(i > 0 && /sendMail\(/.test(seg));
    assert.ok(!/\bto:\s*['"`][^'"`]*@/.test(seg), 'literal recipient address');
    assert.ok(/\bto:\s*functions\.config\(\)\.mail\.to\b/.test(seg));
});
test('server-only notes are not in the published tree', function () {
    for (const f of ['SECURITY-AUDIT-2026-03-24.md', 'SECURITY-AUDIT-INTERNAL-2026-04-10.md', 'functions/find_and_emails.js']) {
        assert.ok(!fs.existsSync(path.join(root, f)), f + ' should not exist');
    }
    assert.ok(fs.existsSync(path.join(root, 'SECURITY.md')));
});

Promise.all(pending).then(function () {
    console.warn = quiet;
    console.log(passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
});
