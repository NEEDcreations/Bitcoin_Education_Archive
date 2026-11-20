// Daily Spin: a counted spin can be shown again after an interrupted session,
// without rolling or paying a second time.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const fn = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const bundle = fs.readFileSync(path.join(root, 'bundle.min.js'), 'utf8');
let passed = 0, failed = 0;
function test(name, f) { try { f(); passed++; console.log('✅ ' + name); } catch (e) { failed++; console.log('❌ ' + name + ': ' + e.message); } }

const start = fn.indexOf('exports.dailySpin = ');
const end = fn.indexOf('\nexports.', start + 10);
const spin = fn.slice(start, end);

test('dailySpin keeps the counted result for the day', () => {
    assert.ok(spin.includes("collection('spin_results').doc('latest')"));
    assert.ok(/tx\.set\(spinResultRef,\s*\{\s*day: today/.test(spin));
    assert.ok(spin.includes('if (!isBonusSpin) {'), 'bonus spins are not saved as the day result');
});
test('saved result is written in the same transaction as the grant', () => {
    const txStart = spin.indexOf('db.runTransaction(');
    const setAt = spin.indexOf('tx.set(spinResultRef');
    const txEnd = spin.indexOf('    });\n', setAt);
    assert.ok(txStart > 0 && setAt > txStart && txEnd > setAt);
});
test('a second call the same day replays instead of rolling', () => {
    const already = spin.indexOf("userData.lastSpinDate === today && !isBonusSpin");
    const roll = spin.indexOf('Math.random', already);
    const replay = spin.indexOf('savedSpinReplay(savedSpinDoc, userData)', already);
    assert.ok(already > 0 && replay > already && (roll < 0 || replay < roll));
    assert.ok(spin.includes("if (result && result.replay === true) {\n        return { success: true, replay: true, reward: result };"));
});
test('replay only matches today and the counted day on the profile', () => {
    assert.ok(spin.includes('saved.day !== today || !userData || userData.lastSpinDate !== today'));
});
test('replayOnly lookup never writes', () => {
    const a = spin.indexOf('if (replayOnly) {');
    const b = spin.indexOf('\n    }\n', a);
    const block = spin.slice(a, b);
    assert.ok(a > 0);
    assert.ok(!/\.set\(|\.update\(|runTransaction|increment/.test(block));
    assert.ok(block.includes("'not-found'"));
});
test('client replays without local side effects', () => {
    assert.ok(app.includes('isReplay'));
    assert.ok(app.includes('data-spin-replay'));
    assert.ok(app.includes('replayOnly: true') || app.includes('replayOnly:true'));
    assert.ok(app.includes('data-spin-exact'));
});
test('rebuilt bundle includes the replay client', () => {
    assert.ok(bundle.includes('replayOnly'));
    assert.ok(bundle.includes('data-spin-replay'));
});
console.log(passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
