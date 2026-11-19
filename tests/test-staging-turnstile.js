// The live Premium page keeps the real Turnstile sitekey; only the staging build swaps in
// Cloudflare's always-pass TEST sitekey, and only for the Premium checkout widget.
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), assert = require('assert');
const root = path.join(__dirname, '..');
let passed = 0, failed = 0;
function test(n, f) { try { f(); passed++; console.log('✅ ' + n); } catch (e) { failed++; console.log('❌ ' + n + ': ' + e.message); } }
const LIVE = '0x4AAAAAAD-ivgpRkbXpgz86', TEST = '1x00000000000000000000AA';
test('repo premium.html (live build source) uses the real sitekey, never the test key', function () {
    const html = fs.readFileSync(path.join(root, 'premium.html'), 'utf8');
    assert.ok(html.includes('data-sitekey="' + LIVE + '" data-action="premium_checkout"'));
    for (const f of ['premium.html', 'index.html', '404.html', 'waitlist.html', 'ranking.js', 'premium.js', 'premium-buy.js'])
        assert.ok(!fs.readFileSync(path.join(root, f), 'utf8').includes(TEST), f + ' has the test sitekey');
});
test('staging build swaps only the Premium checkout widget to the test sitekey', function () {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'stg-ts-'));
    try {
        cp.execFileSync('bash', [path.join(root, 'scripts/build-staging.sh')], { cwd: root, env: Object.assign({}, process.env, { SRC: root, OUT: out, STAGING_APPCHECK_DEBUG_TOKEN: '' }), stdio: 'pipe' });
        const p = fs.readFileSync(path.join(out, 'premium.html'), 'utf8');
        assert.ok(p.includes('data-sitekey="' + TEST + '" data-action="premium_checkout"'));
        assert.ok(!p.includes(LIVE));
        assert.ok(fs.readFileSync(path.join(out, 'index.html'), 'utf8').includes(LIVE), 'other widgets keep the real key');
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
