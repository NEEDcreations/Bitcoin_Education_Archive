// Username tags: escape the name, reject a bad uid, and show a deleted
// profile as plain text. Artist routing is a pure decision so it can be
// tested without Firestore.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
    }
}

function loadTags() {
    const sandbox = {
        console: console,
        setInterval: function() { return 0; },
        clearInterval: function() {},
        document: {
            addEventListener: function() {},
            createElement: function() {
                return { style: {}, appendChild: function() {}, innerHTML: '' };
            },
            createTextNode: function(text) { return { textContent: text }; }
        },
        module: { exports: {} }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'utils.js'), 'utf8'), sandbox, { filename: 'utils.js' });
    return sandbox;
}

const api = loadTags();

test('userTag escapes a name and rejects a uid that could break out of HTML', function() {
    const html = api.userTag('abc"><img', '<script>alert(1)</script>');
    assert.ok(html.indexOf('<script>') === -1, html);
    assert.ok(html.indexOf('data-profile-uid') === -1, html);
    assert.ok(html.indexOf('&lt;script&gt;') !== -1, html);
    assert.ok(html.indexOf('user-tag-plain') !== -1, html);
});

test('a valid uid is a profile tag and the name stays escaped', function() {
    const html = api.userTag('robbieP123', 'ROBBIE <P>');
    assert.ok(html.indexOf('data-profile-uid="robbieP123"') !== -1, html);
    assert.ok(html.indexOf('ROBBIE &lt;P&gt;') !== -1, html);
    assert.ok(html.indexOf('<P>') === -1, html);
});

test('deleted and missing profiles are plain text', function() {
    const flagged = api.userTag('userOne', 'Ada', { deleted: true });
    assert.strictEqual(flagged, '<span class="user-tag user-tag-deleted">Deleted player</span>');
    assert.ok(flagged.indexOf('data-profile-uid') === -1);
    const labeled = api.userTag('userOne', 'Deleted player');
    assert.ok(labeled.indexOf('data-profile-uid') === -1, labeled);
    api.noteDeletedProfile('goneUser1');
    const cached = api.userTag('goneUser1', 'Still Here');
    assert.ok(cached.indexOf('Deleted player') !== -1, cached);
    assert.ok(cached.indexOf('data-profile-uid') === -1, cached);
});

test('a name resolves only from the cache, with no lookup of its own', function() {
    assert.strictEqual(api.userTagResolveUid('ROBBIE P'), '');
    const plain = api.userTag('', 'ROBBIE P');
    assert.ok(plain.indexOf('data-profile-uid') === -1, plain);
    api.userTagRemember('zqxWexampleUID123456789012', 'ROBBIE P');
    const tagged = api.userTag('', 'ROBBIE P');
    assert.ok(tagged.indexOf('data-profile-uid="zqxWexampleUID123456789012"') !== -1, tagged);
});

test('artist routing: present, absent, and an artist whose user was deleted', function() {
    const artist = api.decideProfileRoute({ uid: 'artistUser1', hasArtist: true, profileExists: true });
    assert.strictEqual(artist.action, 'artist');
    const person = api.decideProfileRoute({ uid: 'plainUser1', hasArtist: false, profileExists: true });
    assert.strictEqual(person.action, 'user');
    const orphan = api.decideProfileRoute({ uid: 'artistGone1', hasArtist: true, profileExists: false, deleted: true });
    assert.strictEqual(orphan.action, 'artist');
    const switched = api.decideProfileRoute({ uid: 'artistGone1', hasArtist: false, profileExists: false, deleted: true });
    assert.strictEqual(switched.action, 'deleted-card');
    const junk = api.decideProfileRoute({ uid: 'bad uid', hasArtist: true });
    assert.strictEqual(junk.action, 'ignore');
});

test('the visible name spots use the shared tag and do not read per name', function() {
    const beats = fs.readFileSync(path.join(root, 'beats.js'), 'utf8');
    const utils = fs.readFileSync(path.join(root, 'utils.js'), 'utf8');
    assert.ok(beats.includes('function beatsUserTag('));
    assert.ok(beats.includes("viewUser.textContent = 'View user profile'"));
    assert.ok(beats.includes('isFirebaseUser === true || ad.source === \'user_upload\''));
    assert.ok(utils.includes("db.collection('beats_artists').doc(uid).get()"));
    const lookup = utils.slice(utils.indexOf('function hasPublicArtistProfile'), utils.indexOf('function decideProfileRoute'));
    assert.strictEqual((lookup.match(/\.get\(/g) || []).length, 1);
    assert.ok(!lookup.includes("collection('users')"));
    ['ranking.js', 'global-chat.js', 'forum.js', 'quests.js', 'marketplace.js', 'notifications.js', 'satoshi-favor.js', 'messaging.js'].forEach(function(file) {
        assert.ok(fs.readFileSync(path.join(root, file), 'utf8').includes('userTag('), file);
    });
});

test('new raw username HTML is limited to the known leftovers', function() {
    const skip = { tests: 1, functions: 1, workers: 1, node_modules: 1, data: 1, dev: 1, docs: 1, tools: 1 };
    const hits = [];
    function walk(dir) {
        fs.readdirSync(dir, { withFileTypes: true }).forEach(function(entry) {
            if (skip[entry.name] || entry.name.indexOf('.') === 0) return;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) { walk(full); return; }
            if (!entry.name.endsWith('.js')) return;
            if (entry.name === 'bundle.js' || entry.name === 'bundle.min.js' || entry.name === 'bundle.src.js') return;
            const lines = fs.readFileSync(full, 'utf8').split('\n');
            lines.forEach(function(line, i) {
                if (!/(username|authorName|sellerName|senderName|fromUsername)/.test(line)) return;
                if (line.indexOf('userTag(') !== -1 || line.indexOf('beatsUserTag(') !== -1) return;
                if (!/escapeHtml\(|fEsc\(|\besc\(/.test(line)) return;
                if (!/innerHTML|html \+=|html \+|return ['"`]|\$\{/.test(line) && line.indexOf('+') === -1) return;
                hits.push(path.relative(root, full) + ':' + (i + 1));
            });
        });
    }
    walk(root);
    // Leftovers recorded in AUDIT.md. A new escaped-name HTML line fails this test.
    const allow = {
        'beats.js:2477': 1,
        'beats.js:3188': 1,
        'beats.js:3189': 1,
        'beats.js:3538': 1,
        'beats.js:3539': 1,
        'forum.js:572': 1,
        'forum.js:1161': 1,
        'forum.js:1794': 1,
        'forum.js:2319': 1,
        'global-chat.js:2960': 1,
        'global-chat.js:2994': 1,
        'global-chat.js:2996': 1,
        'lightning-tips.js:1': 1,
        'marketplace.js:695': 1,
        'marketplace.js:707': 1,
        'marketplace.js:709': 1,
        'marketplace.js:1027': 1,
        'meetup-builder.js:181': 1,
        'meetup-builder.js:221': 1,
        'messaging.js:310': 1,
        'messaging.js:312': 1,
        'messaging.js:313': 1,
        'messaging.js:314': 1,
        'messaging.js:315': 1,
        'messaging.js:316': 1,
        'messaging.js:654': 1,
        'messaging.js:655': 1,
        'messaging.js:729': 1,
        'messaging.js:730': 1,
        'messaging.js:724': 1,
        'messaging.js:725': 1,
        'messaging.js:740': 1,
        'messaging.js:741': 1,
        'messaging.js:742': 1,
        'messaging.js:743': 1,
        'quests.js:3208': 1,
        'quests.js:3299': 1,
        'quests.js:4437': 1,
        'quests.js:4438': 1,
        'quests.js:4439': 1,
        'quests.js:4440': 1,
        'ranking.js:4879': 1,
        'ranking.js:5124': 1,
        'ranking.js:5840': 1,
        'ranking.js:6182': 1,
        'ranking.js:10163': 1
    };
    const fresh = hits.filter(function(hit) { return !allow[hit]; });
    assert.deepStrictEqual(fresh, [], fresh.join('\n'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
