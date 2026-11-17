// visits/{uid} must be owner-only; only stats/visits (the total) is public.
// Static checks on firestore.rules + app.js. The emulator case lives in
// tests/rules/public-read-hardening-rules.js (needs Java; run by QA on staging day).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let passed = 0, failed = 0;
function test(n, f) { try { f(); passed++; console.log('  ok  ' + n); } catch (e) { failed++; console.log('  FAIL ' + n + ': ' + e.message); } }

const block = rules.slice(rules.indexOf('match /visits/{visitorId}'), rules.indexOf('match /stats/{statId}'));
test('visits has no public or signed-in-wide read', function () {
    assert.ok(block.length > 0);
    assert.ok(!/allow read:/.test(block), 'no blanket read');
    assert.ok(/allow get: if request\.auth != null && request\.auth\.uid == visitorId;/.test(block));
    assert.ok(/allow list: if false;/.test(block));
});
test('writes are still owner-only and field-allowlisted', function () {
    assert.strictEqual((block.match(/request\.auth\.uid == visitorId/g) || []).length, 3);
    assert.strictEqual((block.match(/hasOnly\(\['lastVisit', 'fp'\]\)/g) || []).length, 2);
});
test('stats/visits (the public total) stays readable', function () {
    const stats = rules.slice(rules.indexOf('match /stats/{statId}'));
    assert.ok(/allow read: if !statId\.matches\('lb_\.\*'\) \|\| request\.auth != null;/.test(stats));
});
test('app.js only reads its own visits doc, never lists the collection', function () {
    const reads = app.match(/collection\('visits'\)[^;\n]*/g) || [];
    assert.ok(reads.length >= 1);
    reads.forEach(function (r) { assert.ok(/\.doc\(visitorId\)/.test(r), r); });
    assert.ok(/var visitorId = authUser\.uid;/.test(app));
});
test('presence needs a session; timechain_viewers is closed', function () {
    const pres = rules.slice(rules.indexOf('match /presence/{userId}'), rules.indexOf('match /presence/{userId}') + 400);
    assert.ok(/allow read: if request\.auth != null;/.test(pres));
    assert.ok(!/allow read: if true;/.test(pres));
    const tv = rules.slice(rules.indexOf('match /timechain_viewers/{stationId}'), rules.indexOf('match /timechain_viewers/{stationId}') + 300);
    assert.ok(/allow read: if false;/.test(tv));
    const clientRefs = ['app.js', 'global-chat.js', 'timechain-tv.js', 'timechain-tv-new.js', 'tctv-watch.js']
        .map(function (f) { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch (e) { return ''; } }).join('\n');
    assert.ok(!/collection\(['"]timechain_viewers['"]\)/.test(clientRefs));
});
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
