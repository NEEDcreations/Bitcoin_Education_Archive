#!/usr/bin/env node
// LNURL-auth: the callback must refuse a linking key, k1 or sig that is not
// pure hex of the right shape before anything else, so no uid can carry extra
// text. Key FORMAT and CASE are unchanged on purpose (02/03 and 04 keys both
// still log in, to the same uid as before), so no existing account is orphaned.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const L = require(path.join(root, 'functions/src/lnAuthKey'));

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok  ' + name); }
    catch (e) { failed++; console.log('  FAIL ' + name + ': ' + (e && e.message || e)); }
}
// Same uid rule as lnAuthCallback.
function uidFor(key) {
    return ('ln:' + key).length <= 128 ? 'ln:' + key : 'ln:' + crypto.createHash('sha256').update(key).digest('hex');
}

const VALID = '02' + 'ab'.repeat(32);
const UNCOMP = '04' + 'cd'.repeat(64);
test('compressed and uncompressed hex keys pass unchanged (no lowercasing)', function () {
    assert.strictEqual(L.checkLnAuthKey(VALID), VALID);
    assert.strictEqual(L.checkLnAuthKey('03' + 'CD'.repeat(32)), '03' + 'CD'.repeat(32));
    assert.strictEqual(L.checkLnAuthKey(UNCOMP), UNCOMP);
    assert.strictEqual(L.checkLnAuthKey(UNCOMP.toUpperCase()), UNCOMP.toUpperCase());
});
test('existing uid shapes are preserved and accepted', function () {
    assert.strictEqual(uidFor(VALID).length, 69);
    assert.strictEqual(uidFor(UNCOMP).length, 67);
    [uidFor(VALID), uidFor('03' + 'CD'.repeat(32)), uidFor(UNCOMP), uidFor(UNCOMP.toUpperCase())].forEach(function (u) {
        assert.ok(L.isLnUid(u), u);
    });
});
test('valid key followed by markup is refused', function () {
    [VALID, UNCOMP].forEach(function (k) {
        assert.strictEqual(L.checkLnAuthKey(k + '"><img src=x onerror=alert(1)>'), null);
        assert.strictEqual(L.checkLnAuthKey(k + "'"), null);
        assert.strictEqual(L.checkLnAuthKey(k + '\n'), null);
        assert.strictEqual(L.checkLnAuthKey(k + ' '), null);
        assert.strictEqual(L.checkLnAuthKey(k + 'a'), null, 'odd trailing nibble');
    });
});
test('wrong length, prefix, type or characters are refused', function () {
    [undefined, null, '', 42, ['02'], { k: 1 }, VALID.slice(0, 65), VALID + '00',
        '04' + 'ab'.repeat(32), '04' + 'ab'.repeat(63), '01' + 'ab'.repeat(32), '05' + 'ab'.repeat(64),
        '02' + 'zz'.repeat(32), ' ' + VALID, '0x' + 'ab'.repeat(32)].forEach(function (k) {
        assert.strictEqual(L.checkLnAuthKey(k), null, JSON.stringify(k));
    });
});
test('k1 and sig: type and hex checks', function () {
    const k1 = crypto.randomBytes(32).toString('hex');
    assert.ok(L.isLnAuthK1(k1));
    [undefined, '', [k1], k1 + 'a', k1.slice(0, 63), k1.slice(0, 62) + 'zz', k1 + '"', 'x'.repeat(64)].forEach(function (v) {
        assert.ok(!L.isLnAuthK1(v), JSON.stringify(v));
    });
    const der = '3044' + '0220' + 'ab'.repeat(32) + '0220' + 'cd'.repeat(32);
    assert.ok(L.isLnAuthSig(der));
    assert.ok(L.isLnAuthSig(der.toUpperCase()));
    [undefined, '', [der], der + 'a', der + '"><b>', 'zz' + der, '30', 'ab'.repeat(74)].forEach(function (v) {
        assert.ok(!L.isLnAuthSig(v), JSON.stringify(v));
    });
});
test('uid shape check refuses anything the callback could not build', function () {
    ['ln:' + VALID + '"><img>', 'ln:' + VALID + 'a', 'ln:' + 'AB'.repeat(32), 'ln:' + UNCOMP, 'nostr:' + VALID, uidFor(VALID) + ' ', '', null, 7].forEach(function (u) {
        assert.ok(!L.isLnUid(u), JSON.stringify(u));
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
    const pubU = Buffer.from(secp.getPublicKey(priv, false)).toString('hex');
    const k1 = crypto.randomBytes(32);
    const sig = secp.signSync(k1, priv);
    const payload = pub + '"><img src=x onerror=alert(1)>';
    test('payload key still verifies with the old hex parse (the bug)', function () {
        assert.strictEqual(secp.verify(sig, k1, Buffer.from(payload, 'hex')), true);
    });
    test('helper refuses that payload key; real compressed, uncompressed and upper-case keys still verify', function () {
        assert.strictEqual(L.checkLnAuthKey(payload), null);
        [pub, pub.toUpperCase(), pubU, pubU.toUpperCase()].forEach(function (k) {
            assert.strictEqual(L.checkLnAuthKey(k), k);
            assert.strictEqual(secp.verify(sig, k1, Buffer.from(L.checkLnAuthKey(k), 'hex')), true, k.slice(0, 4));
            assert.ok(L.isLnUid(uidFor(k)));
        });
        assert.ok(L.isLnAuthSig(Buffer.from(sig).toString('hex')));
    });
} else {
    console.log('  skip secp256k1 checks (functions/node_modules not installed)');
}

test('lnAuthCallback checks key, k1 and sig before any Firestore read or verify', function () {
    const src = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    const start = src.indexOf('exports.lnAuthCallback');
    assert.ok(start > 0);
    const body = src.slice(start, src.indexOf('exports.lnAuthVerify', start));
    const checks = ['checkLnAuthKey(req.query.key)', 'isLnAuthK1(req.query.k1)', 'isLnAuthSig(req.query.sig)'].map(function (c) {
        const at = body.indexOf(c); assert.ok(at > 0, c + ' missing'); return at;
    });
    const last = Math.max.apply(null, checks);
    ['db.collection', 'Buffer.from(key', 'Buffer.from(k1', 'Buffer.from(sig', 'createUser'].forEach(function (s) {
        const at = body.indexOf(s);
        assert.ok(at > last, s + ' must come after the input checks');
    });
    assert.ok(body.indexOf('isLnUid(lnUid)') > body.indexOf('const lnUid') && body.indexOf('isLnUid(lnUid)') < body.indexOf('getUser(lnUid)'), 'uid shape check before user lookup');
    assert.ok(!/const \{[^}]*\bkey\b[^}]*\} = req\.query/.test(body), 'key must not be destructured raw from req.query');
    assert.ok(body.indexOf('toLowerCase') === -1, 'the key is not lowercased (would orphan upper-case uids)');
});
test('lnAuthVerify checks k1 and the uid shape before minting', function () {
    const src = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    const start = src.indexOf('exports.lnAuthVerify');
    const body = src.slice(start, src.indexOf('function parseDERSignature', start));
    assert.ok(body.indexOf('isLnAuthK1(k1)') > 0 && body.indexOf('isLnAuthK1(k1)') < body.indexOf('db.collection'));
    assert.ok(body.indexOf('isLnUid(uid)') > 0 && body.indexOf('isLnUid(uid)') < body.indexOf('admin.auth().createCustomToken'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
