// The payout wallet (NWC_URL) must come from Secret Manager, bound only to the
// functions that pay or read the wallet. No .env, no module-load caching.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'functions');
let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok  ' + name); }
    catch (e) { failed++; console.log('  FAIL ' + name + ': ' + e.message); }
}
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function walk(dir, out) {
    for (const f of fs.readdirSync(dir)) {
        if (f === 'node_modules' || f.startsWith('.')) continue;
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p, out); else if (p.endsWith('.js')) out.push(p);
    }
    return out;
}
// Text from a declaration up to its handler, where runWith/onSchedule options live.
function head(src, marker) {
    const i = src.indexOf(marker);
    assert.ok(i >= 0, 'missing ' + marker);
    return src.slice(i, src.indexOf('async', i));
}

test('only src/nwcSecret.js reads process.env.NWC_URL', function () {
    const offenders = walk(root, []).filter(function (p) {
        return !p.endsWith(path.join('src', 'nwcSecret.js')) && /process\.env\.NWC_URL|process\.env\[['"]NWC_URL/.test(fs.readFileSync(p, 'utf8'));
    });
    assert.deepStrictEqual(offenders, []);
});

test('NWC_URL is a Secret Manager param', function () {
    assert.ok(read('src/nwcSecret.js').includes("defineSecret('NWC_URL')"));
});

test('no NWC value is cached at module load', function () {
    for (const rel of ['index.js', 'src/gifting.js', 'src/tipService.js', 'tctv-drip.js']) {
        assert.ok(!/const NWC_URL\s*=/.test(read(rel)), rel);
    }
    assert.ok(read('index.js').includes('get NWC_URL() { return nwcUrl(); }'));
});

test('every wallet function binds the secret', function () {
    const index = read('index.js'), gifting = read('src/gifting.js'), drip = read('tctv-drip.js');
    const bound = [
        [index, 'exports.claimSats = '],
        [index, 'exports.getFaucetStats = '],
        [index, 'exports.confirmTipSent = '],
        [gifting, 'const claimCipherWin = '],
        [gifting, 'const claimCipherSats = '],
        [gifting, 'const adminResolveCipherSatsClaim = '],
        [drip, 'const tctvDripTick = '],
    ];
    for (const [src, marker] of bound) assert.ok(head(src, marker).includes('nwcUrlSecret'), marker);
});

test('no other function binds the secret', function () {
    let n = 0;
    for (const p of walk(root, [])) {
        const m = fs.readFileSync(p, 'utf8').match(/secrets:\s*\[[^\]]*nwcUrlSecret/g);
        n += m ? m.length : 0;
    }
    assert.strictEqual(n, 7);
});

test('nwcUrl reads the bound value at call time', function () {
    const mod = require(path.join(root, 'src', 'nwcSecret.js'));
    const prev = process.env.NWC_URL;
    delete process.env.NWC_URL;
    assert.strictEqual(mod.nwcUrl(), '');
    process.env.NWC_URL = 'nostr+walletconnect://test';
    assert.strictEqual(mod.nwcUrl(), 'nostr+walletconnect://test');
    if (prev === undefined) delete process.env.NWC_URL; else process.env.NWC_URL = prev;
});

test('no tracked env file carries NWC_URL', function () {
    for (const f of fs.readdirSync(root)) {
        if (f.startsWith('.env')) assert.ok(!/^\s*NWC_URL\s*=/m.test(read(f)), f);
    }
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
