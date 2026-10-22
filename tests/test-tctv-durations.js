// Timechain TV: every video must carry a verified duration the schedule math can use.
// The EPG and the player both compute "now playing" as (unix seconds % station total),
// so one missing, string, NaN or zero duration shifts or breaks a whole station.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
