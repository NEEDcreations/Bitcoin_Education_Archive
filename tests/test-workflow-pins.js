// Every `uses:` in .github/workflows is pinned to a full 40-char SHA, and no
// workflow grants write permissions at the workflow level.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', '.github', 'workflows');
let passed = 0, failed = 0;
function test(n, f) { try { f(); passed++; console.log('  ok  ' + n); } catch (e) { failed++; console.log('  FAIL ' + n + ': ' + e.message); } }
fs.readdirSync(dir).filter(function (f) { return /\.ya?ml$/.test(f); }).forEach(function (f) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    test(f + ': actions pinned to SHAs', function () {
        (src.match(/^\s*(?:-\s*)?uses:\s*(\S+)/gm) || []).forEach(function (line) {
            const ref = line.replace(/^\s*(?:-\s*)?uses:\s*/, '');
            if (ref.startsWith('./')) return;
            assert.ok(/@[0-9a-f]{40}$/.test(ref), ref);
        });
    });
    test(f + ': no write permissions at workflow level', function () {
        const top = src.split(/^jobs:/m)[0];
        assert.ok(!/^\s{2}[a-z-]+:\s*write/m.test(top.split(/^permissions:/m)[1] || ''), 'workflow-level write');
        assert.ok(!/pull_request_target/.test(src), 'pull_request_target');
    });
});
test('dependabot has a 7-day cooldown on every ecosystem', function () {
    const d = fs.readFileSync(path.join(__dirname, '..', '.github', 'dependabot.yml'), 'utf8');
    const n = (d.match(/package-ecosystem:/g) || []).length;
    assert.ok(n >= 2);
    assert.strictEqual((d.match(/default-days: 7/g) || []).length, n);
});
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
