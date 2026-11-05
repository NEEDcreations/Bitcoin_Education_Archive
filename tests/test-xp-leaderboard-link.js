// Home XP line ("name · rank · N XP") is a button that opens the leaderboard.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'auth-display.js'), 'utf8');
let failed = 0;
function test(n, f) { try { f(); console.log('✅ ' + n); } catch (e) { console.log('❌ ' + n + ': ' + e.message); failed++; } }
test('XP line is a real button with an aria-label', () => {
    assert.ok(src.includes("doc.createElement('button')"));
    assert.ok(src.includes("btn.type = 'button'"));
    assert.ok(src.includes("setAttribute('aria-label', 'Open leaderboard')"));
});
test('opens via the existing toggleLeaderboard path and never closes it', () => {
    assert.ok(src.includes('w.toggleLeaderboard()'));
    assert.ok(/if \(showing\) return;/.test(src));
});
test('index.html and 404.html style a 44px target', () => {
    ['index.html', '404.html'].forEach(f => {
        const h = fs.readFileSync(path.join(root, f), 'utf8');
        assert.ok(h.includes('#homeSignedInChip .bq-xp-lb-btn {'));
        assert.ok(/bq-xp-lb-btn \{[^}]*min-height:44px/.test(h));
    });
});
if (failed) process.exit(1);
