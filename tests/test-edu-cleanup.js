// Education topic cleanup: no email-like strings in channel data,
// gambling destinations removed, prediction markets kept with an 18+ field,
// and strong language masked by the shared display-time helper.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

test('no email-like strings in data/*.json', () => {
    const dir = path.join(root, 'data');
    const hits = [];
    fs.readdirSync(dir).filter(function (f) { return f.endsWith('.json'); }).forEach(function (f) {
        const text = fs.readFileSync(path.join(dir, f), 'utf8');
        const found = text.match(new RegExp(emailRe.source, 'g'));
        if (found) hits.push(f + ' (' + found.length + ')');
    });
    assert.deepStrictEqual(hits, []);
});

test('censorText masks strong words and leaves links working', () => {
    const src = read('utils.js');
    const start = src.indexOf('var DATA_CACHE_BUSTER');
    assert.ok(start > 0, 'helper missing');
    const sandbox = {};
    vm.runInNewContext(src.slice(start), sandbox);
    assert.strictEqual(sandbox.DATA_CACHE_BUSTER, '20261027b');
    assert.strictEqual(sandbox.withDataCacheBuster('data/R_games.json'), 'data/R_games.json?v=20261027b');
    assert.strictEqual(sandbox.censorText('Fuck you and stack sats'), 'F**k you and stack sats');
    assert.strictEqual(sandbox.censorText('Buy the fucking dip'), 'Buy the f*****g dip');
    assert.strictEqual(sandbox.censorText('bitchute.com stays'), 'bitchute.com stays');
    assert.strictEqual(sandbox.censorText('see https://fuckingshitcoins.com/ now'), 'see https://fuckingshitcoins.com/ now');
    assert.strictEqual(sandbox.censorUrlLabel('https://fuckthebears.org'), 'https://f**kthebears.org');
    assert.strictEqual(sandbox.censorUrlLabel('https://fuckingshitcoins.com/'), 'https://f*****gshitcoins.com/');
});

test('casino and gambling destinations are gone; prediction markets kept', () => {
    const blob = fs.readdirSync(path.join(root, 'data'))
        .filter(function (f) { return f.endsWith('.json'); })
        .map(function (f) { return fs.readFileSync(path.join(root, 'data', f), 'utf8'); })
        .join('\n');
    ['freebitco.in', 'lightning-poker.com', 'lightning-roulette.com', 'lnflip.com', 't.me/plebnetpoker', 'weed4bitcoin.com'].forEach(function (host) {
        assert.strictEqual(blob.includes(host), false, host + ' still present');
    });
    const referral = JSON.parse(read('data/H_referral-links.json'));
    const info = JSON.parse(read('data/R_informational-sites.json'));
    const swag = JSON.parse(read('data/R_swag-merch.json'));
    function withNote(msgs, needle) {
        return msgs.filter(function (m) {
            return ((m.text || '') + ' ' + (m.link || '')).toLowerCase().includes(needle);
        });
    }
    [withNote(referral.msgs, 'predyx'), withNote(info.msgs, 'predyx'), withNote(swag.msgs, 'predyx'), withNote(swag.msgs, 'bitcoinprediction')].forEach(function (rows) {
        assert.ok(rows.length >= 1);
        rows.forEach(function (m) { assert.strictEqual(m.ageNote, '18+'); });
    });
});

test('removed-items manifest has ids and reasons only', () => {
    const manifest = JSON.parse(read('docs/removed-items.json'));
    assert.ok(manifest.removed.length >= 20);
    const dumped = JSON.stringify(manifest);
    assert.strictEqual(emailRe.test(dumped), false);
    manifest.removed.forEach(function (item) {
        assert.ok(item.id && item.reason);
        assert.strictEqual(Object.prototype.hasOwnProperty.call(item, 'text'), false);
        assert.strictEqual(Object.prototype.hasOwnProperty.call(item, 'excerpt'), false);
    });
    const ids = manifest.removed.map(function (item) { return item.id; });
    ['curriculum#11', 'referral-links#11', 'games#6', 'games#8', 'games#44', 'games#50', 'games#12', 'games#13', 'memes-funny#510'].forEach(function (id) {
        assert.ok(ids.includes(id), 'missing ' + id);
    });
});

test('renderer uses the shared helper and the 18+ field', () => {
    const app = read('app.js');
    assert.ok(app.includes('censorText'));
    assert.ok(app.includes('ageNoteBadge'));
    assert.ok(app.includes('updatedNoteBadge'));
    assert.ok(app.includes('withDataCacheBuster'));
    const notes = read('patch-notes.html');
    assert.ok(notes.includes('Cleaned up the education topics: removed off-topic and unsafe posts.'));
    assert.ok(notes.indexOf('Updated education topics with current facts and fixed broken links and images.') < notes.indexOf('Cleaned up the education topics: removed off-topic and unsafe posts.'));
});

test('corrected facts carry an Updated Oct 2026 field and a source', () => {
    const mining = JSON.parse(read('data/E_mining.json'));
    assert.strictEqual(mining.msgs[0].updatedNote, 'Updated Oct 2026');
    assert.ok(mining.msgs[0].source.startsWith('https://'));
    assert.ok(mining.msgs[0].text.includes('3.125'));
    assert.ok(!mining.msgs[0].text.toLowerCase().includes('under construction'));
    const secure = JSON.parse(read('data/D_secure.json'));
    assert.ok(secure.msgs[4].text.includes('3.125'));
    assert.ok(!secure.msgs[4].text.includes('6.25'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
