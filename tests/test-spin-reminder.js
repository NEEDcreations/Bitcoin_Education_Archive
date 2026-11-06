// The wheel reminder starts when this page first sees a signed-in user.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const match = src.match(/function _spinReminderDelay\(signedInAt, now\) \{[\s\S]*?\n    \}/);
if (!match) {
    console.log('❌ _spinReminderDelay was not found in app.js');
    process.exit(1);
}
const delay = new Function(match[0] + '\nreturn _spinReminderDelay;')();

test('the minute starts at sign-in, not before', () => {
    assert.strictEqual(delay(null, 1_000_000), null);
    assert.strictEqual(delay(undefined, 1_000_000), null);
    const t0 = 1_700_000_000_000;
    assert.strictEqual(delay(t0, t0), 60000);
    assert.strictEqual(delay(t0, t0 + 60000), 0);
    assert.strictEqual(delay(t0, t0 + 90000), 0);
});

test('the scheduler watches sign-in and does not use the page-open clock', () => {
    const start = src.indexOf('function _scheduleSpinReminder()');
    const end = src.indexOf('})();', start);
    const body = src.slice(start, end);
    assert.ok(body.indexOf('_spinSignedInAt') !== -1);
    assert.strictEqual(body.indexOf('_sessionStart'), -1);
    assert.strictEqual(body.indexOf('n > 600'), -1);
    assert.ok(src.indexOf('auth.onAuthStateChanged') !== -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
