// Timechain TV catalog: station files, unique ids, dead ids, Shorts flag.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const lib = require('../functions/tctv-presence-lib');

const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

test('station shells match the allow-list and the video files', () => {
    const src = read('timechain-tv.js');
    const region = src.slice(0, src.indexOf('function u()'));
    const ids = [];
    const re = /\{id:"([^"]+)",name:"([^"]*)",emoji:"([^"]*)"/g;
    let match;
    while ((match = re.exec(region))) ids.push(match[1]);
    assert.deepStrictEqual(ids.slice().sort(), lib.TCTV_STATIONS.slice().sort());
    assert.strictEqual((region.match(/videos:\[\]/g) || []).length, ids.length);
    const seen = new Set();
    let total = 0;
    let shorts = 0;
    const dead = new Set(read('tools/tctv-import/dead-existing-ids.txt').split(/\s+/).filter(Boolean));
    ids.forEach(id => {
        const file = path.join(root, 'data', 'tctv', id + '.json');
        const videos = JSON.parse(fs.readFileSync(file, 'utf8'));
        assert.ok(Array.isArray(videos) && videos.length > 0, id);
        videos.forEach(v => {
            assert.strictEqual(typeof v.id, 'string');
            assert.ok(/^[A-Za-z0-9_-]{11}$/.test(v.id), v.id);
            assert.strictEqual(typeof v.title, 'string');
            assert.ok(v.duration > 0);
            assert.ok(!dead.has(v.id), v.id);
            assert.ok(!seen.has(v.id), 'duplicate ' + v.id);
            seen.add(v.id);
            if (v.short === true) shorts++;
            else assert.ok(v.short == null, v.id);
        });
        total += videos.length;
    });
    assert.strictEqual(total, 15672);
    assert.strictEqual(shorts, 2102);
    assert.ok(src.includes('function tctvFitShort'));
    assert.ok(src.includes('data/tctv/'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
