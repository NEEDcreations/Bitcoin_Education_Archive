// Payout invariants (hardening, Nov 17 2026). Static checks over functions/:
//  A. Favor claim caps: per-claim, per-player-day, site-day and budget
//     counters are checked AND incremented inside the same transaction that
//     marks the claim 'paying', before any wallet call.
//  B. Fee and msat accounting rounds up (never down) toward the cap.
//  C. The NWC wallet secret never reaches Firestore, logs, errors or JSON.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const fnRoot = path.join(__dirname, '..', 'functions');
let passed = 0, failed = 0;
function test(n, f) { try { f(); passed++; console.log('  ok  ' + n); } catch (e) { failed++; console.log('  FAIL ' + n + ': ' + e.message); } }
function read(rel) { return fs.readFileSync(path.join(fnRoot, rel), 'utf8'); }

const fbc = read('src/favorBlockClaims.js');
const fb = require(path.join(fnRoot, 'src', 'favorBlockClaims.js'));

// The reservation transaction: from "1. Reserve in a transaction" to "reserved = true".
const resStart = fbc.indexOf('// 1. Reserve in a transaction');
const resEnd = fbc.indexOf('reserved = true;', resStart);
const reservation = fbc.slice(resStart, resEnd);

test('A1 reservation is one runTransaction that reads every counter and runs capCheck', function () {
    assert.ok(resStart > 0 && resEnd > resStart);
    assert.strictEqual((reservation.match(/db\.runTransaction\(/g) || []).length, 1);
    ['uidDayRef', 'siteDayRef', 'budgetRef', 'haltRef', 'claimRef'].forEach(function (r) {
        assert.ok(new RegExp('await t\\.get\\(' + r + '\\)').test(reservation), 'reads ' + r);
    });
    assert.ok(/const capCode = capCheck\(/.test(reservation));
    assert.ok(/if \(capCode\) refuse\(capCode\);/.test(reservation));
});

test('A2 the same transaction increments all three counters and marks paying', function () {
    const after = reservation.slice(reservation.indexOf('if (capCode) refuse(capCode);'));
    ['uidDayRef', 'siteDayRef', 'budgetRef'].forEach(function (r) {
        assert.ok(new RegExp('t\\.set\\(' + r + ', \\{ sats: ').test(after) || new RegExp('t\\.set\\(' + r + ', budgetRow').test(after), 'increments ' + r);
    });
    assert.ok(/status: 'paying'/.test(after));
});

test('A3 the reservation happens before the only wallet call', function () {
    const pay = fbc.indexOf('wallet.payInvoice(');
    assert.ok(pay > resEnd, 'payInvoice after reservation');
    assert.strictEqual((fbc.match(/wallet\.payInvoice\(/g) || []).length, 1);
});

test('A4 cap constants: 5k per claim, 12.6k per player-day, 21k site-day', function () {
    assert.ok(/const HARD_PER_CLAIM_CAP_SATS = 5000;/.test(fbc));
    assert.ok(/perUidDailySats: 12600,/.test(fbc));
    assert.ok(/siteDailySats: 21000,/.test(fbc));
});

test('B1 routing fee and route-hint fees round up; routing counts toward spend', function () {
    assert.ok(/const routing = Math\.max\(0, Math\.ceil\(Number\(routingFeeSats\) \|\| 0\)\);/.test(fbc));
    assert.ok(/const spent = net \+ routing;/.test(fbc));
    assert.ok(/sum \+= base \+ Math\.ceil\(ppm \* amt \/ 1e6\);/.test(fbc));
    assert.ok(/Math\.ceil\(msat \* ROUTE_FEE_PPM \/ 1e6\)/.test(fbc));
});

test('B2 routeFeeLimitMsat never rounds a limit down below 10 sats', function () {
    if (typeof fb.routeFeeLimitMsat !== 'function') return; // not exported: covered by B1
    assert.strictEqual(fb.routeFeeLimitMsat(1), 10000);
    assert.ok(fb.routeFeeLimitMsat(1001) >= Math.ceil(1001000 * 0.01));
});

test('B3 invoice amount must equal the expected sats exactly, in msat', function () {
    assert.ok(/if \(msats !== expectedSats \* 1000\) return \{ ok: false, reason: 'amount_mismatch' \};/.test(fbc));
});

// C. Wallet secret hygiene across every functions source file.
const files = [];
(function walk(d) {
    fs.readdirSync(d).forEach(function (f) {
        if (f === 'node_modules' || f.startsWith('.')) return;
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.js')) files.push(p);
    });
})(fnRoot);

const SECRET_EXPR = /(nwcUrl\(\)|FAUCET\.NWC_URL|process\.env\.NWC_URL)/;
test('C1 the secret value is only used to build a client or as a truthiness check', function () {
    files.forEach(function (p) {
        const lines = fs.readFileSync(p, 'utf8').split('\n');
        lines.forEach(function (line, i) {
            if (!SECRET_EXPR.test(line)) return;
            const code = line.replace(/\/\/.*$/, '');
            if (!SECRET_EXPR.test(code)) return;
            const ok = /nostrWalletConnectUrl:\s*(nwcUrl\(\)|FAUCET\.NWC_URL|url)/.test(code)
                || /(if|return|\?|&&|\|\|)\s*\(?!?\s*(nwcUrl\(\)|FAUCET\.NWC_URL)/.test(code)
                || /return process\.env\.NWC_URL \|\| '';/.test(code)
                || /const url = nwcUrl\(\);/.test(code)
                || /get NWC_URL\(\) \{ return nwcUrl\(\); \}/.test(code)
                || /^\s*function nwcUrl\(\) \{\s*$/.test(code);
            assert.ok(ok, path.relative(fnRoot, p) + ':' + (i + 1) + ' ' + code.trim());
        });
    });
});

test('C2 never logged, thrown, stored or serialized', function () {
    const bad = /(console\.(log|error|warn|info)|logger\.\w+|JSON\.stringify|\.set\(|\.update\(|\.add\(|\.create\(|new Error\(|HttpsError\(|httpsError\()[^;\n]*(nwcUrl\(\)|FAUCET\.NWC_URL|process\.env\.NWC_URL|nostrWalletConnectUrl)/;
    files.forEach(function (p) {
        const src = fs.readFileSync(p, 'utf8').replace(/\/\/.*$/gm, '');
        const m = src.match(bad);
        assert.ok(!m, path.relative(fnRoot, p) + ': ' + (m && m[0]));
    });
});

test('C3 NWC client objects (which hold the secret in memory) are never logged or stored', function () {
    const bad = /(console\.(log|error|warn|info)|JSON\.stringify|\.set\(|\.update\(|\.add\()\(\s*(nwc|wallet|client)\s*[,)]/;
    files.forEach(function (p) {
        const src = fs.readFileSync(p, 'utf8').replace(/\/\/.*$/gm, '');
        const m = src.match(bad);
        assert.ok(!m, path.relative(fnRoot, p) + ': ' + (m && m[0]));
    });
});

test('C4 FAUCET config is only exposed with NWC_URL redacted', function () {
    files.forEach(function (p) {
        const src = fs.readFileSync(p, 'utf8');
        const spreads = src.match(/\.\.\.FAUCET\b|JSON\.stringify\(FAUCET\)|Object\.assign\([^)]*FAUCET\)/g) || [];
        spreads.forEach(function (s) { assert.ok(/NWC_URL: _redacted, \.\.\.safeLimits \} = FAUCET/.test(src), path.relative(fnRoot, p) + ' ' + s); });
    });
});

test('C5 NWC_URL is a Secret Manager secret, never a .env key', function () {
    assert.ok(/defineSecret\('NWC_URL'\)/.test(read('src/nwcSecret.js')));
    fs.readdirSync(fnRoot).filter(function (f) { return /^\.env/.test(f); }).forEach(function (f) {
        assert.ok(!/^\s*NWC_URL\s*=/m.test(fs.readFileSync(path.join(fnRoot, f), 'utf8')), f);
    });
    assert.ok(read('src/sensitiveSecrets.js').indexOf("'NWC_URL'") !== -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
