// Timechain TV: every video must carry a verified duration the schedule math can use.
// The EPG and the player both compute "now playing" as (unix seconds % station total),
// so one missing, string, NaN or zero duration shifts or breaks a whole station.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');
const guards = require('../tools/tctv-import/tctv_import_guards');

const dir = path.join(__dirname, '..', 'data', 'tctv');
const MAX = 12 * 60 * 60; // longest real entry today is under 12h
let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();

test('every station file has videos', () => {
    assert.ok(files.length >= 22, 'expected 22 station files, got ' + files.length);
});

test('every video has an integer duration in seconds, 1..12h', () => {
    const bad = [];
    files.forEach(f => {
        const list = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        assert.ok(Array.isArray(list) && list.length, f + ' is not a non-empty array');
        list.forEach((v, i) => {
            const d = v && v.duration;
            if (typeof d !== 'number' || !Number.isInteger(d) || d < 1 || d > MAX) {
                bad.push(f + '#' + i + ' ' + (v && v.id) + ' duration=' + JSON.stringify(d));
            }
        });
    });
    assert.strictEqual(bad.length, 0, bad.length + ' missing/invalid: ' + bad.slice(0, 10).join('; '));
});

test('schedule maps every second of the loop to exactly one video', () => {
    files.forEach(f => {
        const list = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const total = list.reduce((a, v) => a + v.duration, 0);
        assert.ok(Number.isFinite(total) && total > 0, f + ' station total is not a positive number');
        // same walk as timechain-tv.js n(): position = now % total
        [0, 1, total - 1, Math.floor(total / 2)].forEach(p => {
            let acc = 0, hit = -1;
            for (let k = 0; k < list.length; k++) { if (p < acc + list[k].duration) { hit = k; break; } acc += list[k].duration; }
            assert.ok(hit >= 0, f + ' position ' + p + ' maps to no video');
        });
    });
});

test('importer refuses age-restricted videos, profane or slur titles, and blocked ids', () => {
    assert.strictEqual(guards.ageRestricted({ ytAgeRestricted: true }), true);
    assert.strictEqual(guards.ageRestricted({ contentDetails: { contentRating: { ytRating: 'ytAgeRestricted' } } }), true);
    assert.strictEqual(guards.ageRestricted({ ytRating: 'ytAgeRestricted' }), true);
    assert.strictEqual(guards.ageRestricted({ duration: 90, title: 'What is Bitcoin?' }), false);
    assert.strictEqual(guards.titleBlocked('What is Bitcoin?'), false);
    assert.strictEqual(guards.titleBlocked('Why altcoins are shitcoins'), false);
    assert.strictEqual(guards.titleBlocked('Fuck around and find out'), true);
    assert.strictEqual(guards.titleBlocked('that slur nigger'), true);
    const apply = fs.readFileSync(path.join(__dirname, '..', 'tools', 'tctv-import', 'apply_tctv_import.js'), 'utf8');
    assert.ok(apply.includes('ytAgeRestricted'));
    assert.ok(apply.includes('titleBlocked'));
    const blocked = guards.loadBlockedIds(path.join(__dirname, '..', 'tools', 'tctv-import', 'blocked-ids.txt'));
    if (blocked.size) {
        const present = [];
        files.forEach(f => {
            JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).forEach(v => {
                if (blocked.has(v.id)) present.push(v.id);
            });
        });
        assert.deepStrictEqual(present, []);
    }
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tctv-guard-'));
    const stationDir = path.join(root, 'stations');
    fs.mkdirSync(stationDir);
    fs.writeFileSync(path.join(stationDir, 'memes-comedy.json'), JSON.stringify([{ id: 'abcdefghijk', title: 'Bitcoin meme', duration: 30 }]));
    const incoming = path.join(root, 'new.json');
    const meta = path.join(root, 'meta.json');
    const script = path.join(__dirname, '..', 'tools', 'tctv-import', 'apply_tctv_import.js');
    function run(video, metaRec) {
        fs.writeFileSync(incoming, JSON.stringify([{ id: 'memes-comedy', videos: [video] }]));
        fs.writeFileSync(meta, JSON.stringify([Object.assign({ id: video.id, station: 'memes-comedy', duration: video.duration }, metaRec)]));
        return spawnSync(process.execPath, [script, '--dir', stationDir, '--new', incoming, '--meta', meta], { encoding: 'utf8' });
    }
    const clean = run({ id: 'aaaaaaaaaaa', title: 'Bitcoin explained', duration: 40 }, {});
    assert.strictEqual(clean.status, 0, clean.stderr);
    const profane = run({ id: 'bbbbbbbbbbb', title: 'Fuck this fiat', duration: 40 }, {});
    assert.notStrictEqual(profane.status, 0);
    assert.ok((profane.stderr || '').includes('titleBlocked'));
    const aged = run({ id: 'ccccccccccc', title: 'Age gated', duration: 40 }, { ytAgeRestricted: true });
    assert.notStrictEqual(aged.status, 0);
    assert.ok((aged.stderr || '').includes('ytAgeRestricted'));
    const blockFile = path.join(root, 'blocked.txt');
    fs.writeFileSync(blockFile, 'ddddddddddd\n');
    fs.writeFileSync(incoming, JSON.stringify([{ id: 'memes-comedy', videos: [{ id: 'ddddddddddd', title: 'Blocked one', duration: 40 }] }]));
    fs.writeFileSync(meta, JSON.stringify([{ id: 'ddddddddddd', station: 'memes-comedy', duration: 40 }]));
    const blockedRun = spawnSync(process.execPath, [script, '--dir', stationDir, '--new', incoming, '--meta', meta, '--blocked', blockFile], { encoding: 'utf8' });
    assert.notStrictEqual(blockedRun.status, 0);
    assert.ok((blockedRun.stderr || '').includes('blocked id'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
