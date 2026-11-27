// Key check: the "Checking the key..." wait is a short cap, reads run in
// parallel, and the modal stays open when more keys remain.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'gifting.js'), 'utf8');
const decryptStart = src.indexOf('async function _decryptCipherModal');
const decryptEnd = src.indexOf('window.showCipherClaim = function');
assert.ok(decryptStart > 0 && decryptEnd > decryptStart, 'decrypt markers');
const decrypt = src.slice(decryptStart, decryptEnd);
const findStart = src.indexOf('async function _findKeyForLabel');
const findEnd = src.indexOf('window.openCipherWithMatch = function');
const findKey = src.slice(findStart, findEnd);
assert.ok(findStart > 0 && findEnd > findStart, 'findKey markers');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

test('the checking-the-key animation is capped at 400ms', () => {
    assert.ok(src.indexOf('var KEY_CHECK_ANIM_MS = 400;') !== -1);
    assert.ok(src.indexOf('_playHex(hexEl, KEY_CHECK_ANIM_MS)') !== -1);
    assert.strictEqual(src.indexOf('_playHex(hexEl, 1200)'), -1);
    assert.ok(KEY_MS() >= 300 && KEY_MS() <= 500);
    function KEY_MS() {
        var m = src.match(/var KEY_CHECK_ANIM_MS = (\d+);/);
        return m ? Number(m[1]) : 0;
    }
});

test('key lookup and sats check run in parallel before decryptCipher', () => {
    assert.ok(findKey.indexOf('Promise.all([query(\'sent\'), query(\'inventory\')])') !== -1);
    assert.ok(findKey.indexOf("await query('sent')) || (await query('inventory')") === -1);
    assert.ok(decrypt.indexOf('Promise.all([') !== -1);
    assert.ok(decrypt.indexOf('_readSatsDisabled()') !== -1);
    assert.ok(decrypt.indexOf('_findKeyForLabel(cipherLabel)') !== -1);
    assert.ok(decrypt.indexOf("_callCF('decryptCipher', { cipherId: cipherId, keyId: key.id })") !== -1);
});

test('the modal stays open and offers Next key when more keys remain', () => {
    assert.ok(src.indexOf("Next key ('") !== -1 || src.indexOf('Next key (') !== -1);
    assert.ok(src.indexOf('_paintDecryptAdvance') !== -1);
    assert.ok(src.indexOf('reuseOverlay: true') !== -1);
    assert.ok(src.indexOf("_btn('Nice!')") !== -1);
    // Close / Nice is used after the last key, not after every key.
    assert.ok(src.indexOf('_keyCheckSession') !== -1);
    assert.ok(src.indexOf('remaining > 0') !== -1);
});

test('server-side decrypt is still required', () => {
    assert.ok(decrypt.indexOf("_callCF('decryptCipher'") !== -1);
    assert.ok(decrypt.indexOf('key.id') !== -1);
    assert.ok(decrypt.indexOf('cipherId: cipherId') !== -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
