#!/usr/bin/env node
// LNURL-auth callback: the wallet's linking key must be a compressed hex
// pubkey, checked before anything else, so no uid can carry extra text.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const { normalizeLnAuthKey } = require(path.join(root, 'functions/src/lnAuthKey'));

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok  ' + name); }
    catch (e) { failed++; console.log('  FAIL ' + name + ': ' + (e && e.message || e)); }
}

const VALID = '02' + 'ab'.repeat(32);
test('compressed 02/03 keys pass and are lowercased', function () {
    assert.strictEqual(normalizeLnAuthKey(VALID), VALID);
    assert.strictEqual(normalizeLnAuthKey('03' + 'CD'.repeat(32)), '03' + 'cd'.repeat(32));
});
test('valid key followed by markup is refused', function () {
    assert.strictEqual(normalizeLnAuthKey(VALID + '"><img src=x onerror=alert(1)>'), null);
    assert.strictEqual(normalizeLnAuthKey(VALID + "'"), null);
    assert.strictEqual(normalizeLnAuthKey(VALID + '\n'), null);
    assert.strictEqual(normalizeLnAuthKey(VALID + ' '), null);
});
test('wrong length, prefix, type or characters are refused', function () {
    [undefined, null, '', 42, ['02'], { k: 1 }, VALID.slice(0, 65), VALID + '00',
        '04' + 'ab'.repeat(32), '04' + 'ab'.repeat(64), '01' + 'ab'.repeat(32),
        '02' + 'zz'.repeat(32), ' ' + VALID, '0x' + 'ab'.repeat(32)].forEach(function (k) {
        assert.strictEqual(normalizeLnAuthKey(k), null, JSON.stringify(k));
    });
});

// Real signature check: the old code verified with Buffer.from(key,'hex'),
// which drops everything after the first non-hex char, so a payload key
// still verified. The helper must refuse it before verification.
let secp = null;
try { secp = require(path.join(root, 'functions/node_modules/@noble/secp256k1')); } catch (e) { /* optional */ }
if (secp) {
    if (!secp.utils.sha256Sync) secp.utils.sha256Sync = (...m) => { const h = crypto.createHash('sha256'); m.forEach(x => h.update(x)); return Uint8Array.from(h.digest()); };
    if (!secp.utils.hmacSha256Sync) secp.utils.hmacSha256Sync = (k, ...m) => { const h = crypto.createHmac('sha256', k); m.forEach(x => h.update(x)); return Uint8Array.from(h.digest()); };
    const priv = crypto.randomBytes(32);
    const pub = Buffer.from(secp.getPublicKey(priv, true)).toString('hex');
    const k1 = crypto.randomBytes(32);
    const sig = secp.signSync(k1, priv);
    const payload = pub + '"><img src=x onerror=alert(1)>';
    test('payload key still verifies with the old hex parse (the bug)', function () {
        assert.strictEqual(secp.verify(sig, k1, Buffer.from(payload, 'hex')), true);
    });
    test('helper refuses that same payload key and accepts the real one', function () {
        assert.strictEqual(normalizeLnAuthKey(payload), null);
        assert.strictEqual(normalizeLnAuthKey(pub), pub);
        assert.strictEqual(normalizeLnAuthKey(pub.toUpperCase()), pub);
        assert.strictEqual(secp.verify(sig, k1, Buffer.from(normalizeLnAuthKey(pub), 'hex')), true);
    });
} else {
    console.log('  skip secp256k1 checks (functions/node_modules not installed)');
}

test('lnAuthCallback checks the key before any Firestore read or verify', function () {
    const src = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    const start = src.indexOf('exports.lnAuthCallback');
    assert.ok(start > 0);
    const body = src.slice(start, src.indexOf('exports.lnAuthVerify', start));
    const check = body.indexOf("normalizeLnAuthKey(req.query.key)");
    assert.ok(check > 0, 'normalizeLnAuthKey call missing');
    ['db.collection', 'Buffer.from(key', 'lnUid', 'createUser'].forEach(function (s) {
        const at = body.indexOf(s);
        assert.ok(at > check, s + ' must come after the key check');
    });
    assert.ok(!/req\.query\.key[^)]/.test(body.replace("normalizeLnAuthKey(req.query.key)", '').replace('if (!req.query.key)', '')),
        'raw req.query.key used elsewhere');
    assert.ok(!/const \{[^}]*\bkey\b[^}]*\} = req\.query/.test(body), 'key must not be destructured raw from req.query');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
