// © 2024-2026 603BTC LLC. All rights reserved.
// =============================================
// ₿ Wallet Core — Cryptographic Engine
// Self-custody Bitcoin wallet: BIP39, BIP32/84, address derivation
// Keys NEVER leave the device. All crypto runs client-side.
// =============================================

(function() {
'use strict';

// ─── BIP39 WORDLIST (English, 2048 words) ────────────────
// Loaded dynamically to keep initial bundle small
var _bip39Words = null;
var _bip39Loading = null;

function loadWordlist() {
    if (_bip39Words) return Promise.resolve(_bip39Words);
    if (_bip39Loading) return _bip39Loading;
    _bip39Loading = fetch('https://raw.githubusercontent.com/bitcoin/bips/master/bip-0039/english.txt')
        .then(function(r) { return r.text(); })
        .then(function(text) {
            _bip39Words = text.trim().split('\n').map(function(w) { return w.trim(); });
            if (_bip39Words.length !== 2048) throw new Error('Invalid wordlist: ' + _bip39Words.length);
            return _bip39Words;
        });
    return _bip39Loading;
}

// ─── CRYPTOGRAPHIC PRIMITIVES ────────────────────────────

/**
 * Generate cryptographically secure random bytes
 * Uses Web Crypto API (CSPRNG)
 */
function getRandomBytes(length) {
    var arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    return arr;
}

/**
 * SHA-256 hash
 */
async function sha256(data) {
    var buffer = (data instanceof Uint8Array) ? data.buffer : data;
    var hash = await crypto.subtle.digest('SHA-256', buffer);
    return new Uint8Array(hash);
}

/**
 * HMAC-SHA512
 */
async function hmacSHA512(key, data) {
    var cryptoKey = await crypto.subtle.importKey(
        'raw', 
        (key instanceof Uint8Array) ? key : new TextEncoder().encode(key),
        { name: 'HMAC', hash: 'SHA-512' },
        false, ['sign']
    );
    var sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
    return new Uint8Array(sig);
}

/**
 * PBKDF2 key derivation
 */
async function pbkdf2(password, salt, iterations, keyLength) {
    var enc = new TextEncoder();
    var keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    var bits = await crypto.subtle.deriveBits({
        name: 'PBKDF2',
        salt: enc.encode(salt),
        iterations: iterations,
        hash: 'SHA-512'
    }, keyMaterial, keyLength * 8);
    return new Uint8Array(bits);
}

/**
 * RIPEMD-160 (pure JS implementation for browser compatibility)
 */
function ripemd160(data) {
    // Constants
    var zl = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13];
    var zr = [5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11];
    var sl = [11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6];
    var sr = [8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11];
    var hl = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
    var hr = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];

    function f(j, x, y, z) {
        if (j <= 15) return x ^ y ^ z;
        if (j <= 31) return (x & y) | ((~x) & z);
        if (j <= 47) return (x | (~y)) ^ z;
        if (j <= 63) return (x & z) | (y & (~z));
        return x ^ (y | (~z));
    }

    function rotl(x, n) { return ((x << n) | (x >>> (32 - n))) >>> 0; }

    // Pad message
    var msg = new Uint8Array(data);
    var bitLen = msg.length * 8;
    var padLen = 64 - ((msg.length + 9) % 64);
    if (padLen === 64) padLen = 0;
    var padded = new Uint8Array(msg.length + 1 + padLen + 8);
    padded.set(msg);
    padded[msg.length] = 0x80;
    // Little-endian bit length
    var dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 8, bitLen & 0xffffffff, true);
    dv.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000), true);

    var h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;

    for (var offset = 0; offset < padded.length; offset += 64) {
        var w = [];
        var blockView = new DataView(padded.buffer, offset, 64);
        for (var i = 0; i < 16; i++) w[i] = blockView.getUint32(i * 4, true);

        var al = h0, bl = h1, cl = h2, dl = h3, el = h4;
        var ar = h0, br = h1, cr = h2, dr = h3, er = h4;

        for (var j = 0; j < 80; j++) {
            var jj = Math.floor(j / 16);
            var tl = (al + f(j, bl, cl, dl) + w[zl[j]] + hl[jj]) >>> 0;
            tl = (rotl(tl, sl[j]) + el) >>> 0;
            al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = tl;

            var tr = (ar + f(79 - j, br, cr, dr) + w[zr[j]] + hr[jj]) >>> 0;
            tr = (rotl(tr, sr[j]) + er) >>> 0;
            ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = tr;
        }

        var t = (h1 + cl + dr) >>> 0;
        h1 = (h2 + dl + er) >>> 0;
        h2 = (h3 + el + ar) >>> 0;
        h3 = (h4 + al + br) >>> 0;
        h4 = (h0 + bl + cr) >>> 0;
        h0 = t;
    }

    var result = new Uint8Array(20);
    var rv = new DataView(result.buffer);
    rv.setUint32(0, h0, true);
    rv.setUint32(4, h1, true);
    rv.setUint32(8, h2, true);
    rv.setUint32(12, h3, true);
    rv.setUint32(16, h4, true);
    return result;
}

/**
 * Hash160 = RIPEMD160(SHA256(data))
 */
async function hash160(data) {
    var s = await sha256(data);
    return ripemd160(s);
}

// ─── BECH32 ENCODING ─────────────────────────────────────

var BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Polymod(values) {
    var GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    var chk = 1;
    for (var i = 0; i < values.length; i++) {
        var b = chk >> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ values[i];
        for (var j = 0; j < 5; j++) {
            if ((b >> j) & 1) chk ^= GEN[j];
        }
    }
    return chk;
}

function bech32HrpExpand(hrp) {
    var ret = [];
    for (var i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
    ret.push(0);
    for (var i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
    return ret;
}

function bech32CreateChecksum(hrp, data) {
    var values = bech32HrpExpand(hrp).concat(data).concat([0,0,0,0,0,0]);
    var polymod = bech32Polymod(values) ^ 1;
    var ret = [];
    for (var i = 0; i < 6; i++) ret.push((polymod >> (5 * (5 - i))) & 31);
    return ret;
}

function bech32Encode(hrp, data) {
    var combined = data.concat(bech32CreateChecksum(hrp, data));
    var ret = hrp + '1';
    for (var i = 0; i < combined.length; i++) ret += BECH32_CHARSET[combined[i]];
    return ret;
}

function convertBits(data, fromBits, toBits, pad) {
    var acc = 0, bits = 0, ret = [], maxv = (1 << toBits) - 1;
    for (var i = 0; i < data.length; i++) {
        acc = (acc << fromBits) | data[i];
        bits += fromBits;
        while (bits >= toBits) {
            bits -= toBits;
            ret.push((acc >> bits) & maxv);
        }
    }
    if (pad) {
        if (bits > 0) ret.push((acc << (toBits - bits)) & maxv);
    }
    return ret;
}

/**
 * Encode a witness program as a bech32 address
 * @param {string} hrp - 'bc' for mainnet, 'tb' for testnet
 * @param {number} witnessVersion - 0 for P2WPKH
 * @param {Uint8Array} witnessProgram - The hash160 of the pubkey
 */
function segwitEncode(hrp, witnessVersion, witnessProgram) {
    var enc = convertBits(Array.from(witnessProgram), 8, 5, true);
    enc.unshift(witnessVersion);
    return bech32Encode(hrp, enc);
}

// ─── BIP39: MNEMONIC GENERATION ──────────────────────────

/**
 * Generate a BIP39 mnemonic (12 or 24 words)
 * @param {number} strength - 128 for 12 words, 256 for 24 words
 * @returns {Promise<string>} Space-separated mnemonic words
 */
async function generateMnemonic(strength) {
    strength = strength || 128; // Default 12 words
    var words = await loadWordlist();
    var entropy = getRandomBytes(strength / 8);
    var hash = await sha256(entropy);
    
    // Convert entropy + checksum to bit string
    var bits = '';
    for (var i = 0; i < entropy.length; i++) {
        bits += entropy[i].toString(2).padStart(8, '0');
    }
    // Checksum: first (strength/32) bits of SHA256(entropy)
    var checksumBits = strength / 32;
    for (var i = 0; i < checksumBits; i++) {
        bits += ((hash[Math.floor(i / 8)] >> (7 - (i % 8))) & 1).toString();
    }
    
    // Split into 11-bit groups → word indices
    var mnemonic = [];
    for (var i = 0; i < bits.length; i += 11) {
        var idx = parseInt(bits.substr(i, 11), 2);
        mnemonic.push(words[idx]);
    }
    
    return mnemonic.join(' ');
}

/**
 * Validate a BIP39 mnemonic
 */
async function validateMnemonic(mnemonic) {
    var words = await loadWordlist();
    var parts = mnemonic.trim().toLowerCase().split(/\s+/);
    
    if (parts.length !== 12 && parts.length !== 24) return false;
    
    // Check all words exist in wordlist
    for (var i = 0; i < parts.length; i++) {
        if (words.indexOf(parts[i]) === -1) return false;
    }
    
    // Verify checksum
    var bits = '';
    for (var i = 0; i < parts.length; i++) {
        var idx = words.indexOf(parts[i]);
        bits += idx.toString(2).padStart(11, '0');
    }
    
    var checksumLen = parts.length === 12 ? 4 : 8;
    var entropyBits = bits.substr(0, bits.length - checksumLen);
    var checksumBits = bits.substr(bits.length - checksumLen);
    
    var entropy = new Uint8Array(entropyBits.length / 8);
    for (var i = 0; i < entropy.length; i++) {
        entropy[i] = parseInt(entropyBits.substr(i * 8, 8), 2);
    }
    
    var hash = await sha256(entropy);
    var expectedChecksum = '';
    for (var i = 0; i < checksumLen; i++) {
        expectedChecksum += ((hash[Math.floor(i / 8)] >> (7 - (i % 8))) & 1).toString();
    }
    
    return checksumBits === expectedChecksum;
}

/**
 * BIP39: Mnemonic → Seed (512-bit)
 */
async function mnemonicToSeed(mnemonic, passphrase) {
    passphrase = passphrase || '';
    return pbkdf2(mnemonic.normalize('NFKD'), 'mnemonic' + passphrase.normalize('NFKD'), 2048, 64);
}

// ─── BIP32: HD KEY DERIVATION ────────────────────────────

// Simplified secp256k1 operations using Web Crypto
// For production, use a proven library. This is educational/demo.

// secp256k1 curve order
var SECP256K1_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
var SECP256K1_P = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
var SECP256K1_Gx = BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798');
var SECP256K1_Gy = BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8');

function mod(a, m) { return ((a % m) + m) % m; }
function modInverse(a, m) {
    a = mod(a, m);
    var g = m, x = 0n, y = 1n;
    while (a > 0n) {
        var q = g / a;
        var t = g - q * a; g = a; a = t;
        t = x - q * y; x = y; y = t;
    }
    return mod(x, m);
}

function pointAdd(p1, p2) {
    if (!p1) return p2;
    if (!p2) return p1;
    if (p1[0] === p2[0] && p1[1] === p2[1]) {
        // Point doubling
        var s = mod((3n * p1[0] * p1[0]) * modInverse(2n * p1[1], SECP256K1_P), SECP256K1_P);
        var x = mod(s * s - 2n * p1[0], SECP256K1_P);
        var y = mod(s * (p1[0] - x) - p1[1], SECP256K1_P);
        return [x, y];
    }
    var s = mod((p2[1] - p1[1]) * modInverse(p2[0] - p1[0], SECP256K1_P), SECP256K1_P);
    var x = mod(s * s - p1[0] - p2[0], SECP256K1_P);
    var y = mod(s * (p1[0] - x) - p1[1], SECP256K1_P);
    return [x, y];
}

function pointMultiply(k, point) {
    var result = null;
    var addend = point;
    while (k > 0n) {
        if (k & 1n) result = pointAdd(result, addend);
        addend = pointAdd(addend, addend);
        k >>= 1n;
    }
    return result;
}

function privateKeyToPublicKey(privKey) {
    var k = BigInt('0x' + bytesToHex(privKey));
    var point = pointMultiply(k, [SECP256K1_Gx, SECP256K1_Gy]);
    // Compressed public key (02/03 prefix + x coordinate)
    var prefix = point[1] % 2n === 0n ? '02' : '03';
    var x = point[0].toString(16).padStart(64, '0');
    return hexToBytes(prefix + x);
}

// ─── UTILITY FUNCTIONS ───────────────────────────────────

function bytesToHex(bytes) {
    return Array.from(bytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function hexToBytes(hex) {
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

function concatBytes() {
    var total = 0;
    for (var i = 0; i < arguments.length; i++) total += arguments[i].length;
    var result = new Uint8Array(total);
    var offset = 0;
    for (var i = 0; i < arguments.length; i++) {
        result.set(arguments[i], offset);
        offset += arguments[i].length;
    }
    return result;
}

// ─── BIP32 HD KEY DERIVATION ─────────────────────────────

/**
 * Derive master key from BIP39 seed
 */
async function masterKeyFromSeed(seed) {
    var I = await hmacSHA512(new TextEncoder().encode('Bitcoin seed'), seed);
    return {
        key: I.slice(0, 32),
        chainCode: I.slice(32)
    };
}

/**
 * Derive child key (BIP32)
 * @param {Object} parentKey - {key, chainCode}
 * @param {number} index - Child index (add 0x80000000 for hardened)
 */
async function deriveChild(parentKey, index) {
    var data;
    var isHardened = index >= 0x80000000;
    
    if (isHardened) {
        data = concatBytes(new Uint8Array([0]), parentKey.key, new Uint8Array([(index >> 24) & 0xff, (index >> 16) & 0xff, (index >> 8) & 0xff, index & 0xff]));
    } else {
        var pubKey = privateKeyToPublicKey(parentKey.key);
        data = concatBytes(pubKey, new Uint8Array([(index >> 24) & 0xff, (index >> 16) & 0xff, (index >> 8) & 0xff, index & 0xff]));
    }
    
    var I = await hmacSHA512(parentKey.chainCode, data);
    var childKey = new Uint8Array(32);
    
    // child key = (parent key + IL) mod n
    var parentInt = BigInt('0x' + bytesToHex(parentKey.key));
    var ilInt = BigInt('0x' + bytesToHex(I.slice(0, 32)));
    var childInt = (parentInt + ilInt) % SECP256K1_N;
    var childHex = childInt.toString(16).padStart(64, '0');
    childKey = hexToBytes(childHex);
    
    return {
        key: childKey,
        chainCode: I.slice(32)
    };
}

/**
 * Derive BIP84 path: m/84'/0'/0'/change/index
 * @param {Uint8Array} seed - BIP39 seed
 * @param {number} accountIndex - Account index (usually 0)
 * @param {number} change - 0 for receive, 1 for change
 * @param {number} addressIndex - Address index
 */
async function deriveBIP84Key(seed, accountIndex, change, addressIndex) {
    var master = await masterKeyFromSeed(seed);
    var purpose = await deriveChild(master, 84 + 0x80000000);       // 84' (BIP84)
    var coinType = await deriveChild(purpose, 0 + 0x80000000);       // 0' (Bitcoin)
    var account = await deriveChild(coinType, accountIndex + 0x80000000); // 0' (first account)
    var changeKey = await deriveChild(account, change);               // 0 or 1
    var child = await deriveChild(changeKey, addressIndex);           // address index
    return child;
}

/**
 * Generate a native SegWit (bech32) address from a public key
 */
async function pubkeyToSegwitAddress(pubkey, network) {
    var h = await hash160(pubkey);
    var hrp = (network === 'testnet') ? 'tb' : 'bc';
    return segwitEncode(hrp, 0, h);
}

// ─── ENCRYPTION: PROTECT SEED IN STORAGE ─────────────────

/**
 * Encrypt seed phrase with password using AES-256-GCM
 */
async function encryptSeed(seedPhrase, password) {
    var enc = new TextEncoder();
    var salt = getRandomBytes(16);
    var iv = getRandomBytes(12);
    
    var keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    var aesKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false, ['encrypt']
    );
    
    var encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, aesKey, enc.encode(seedPhrase));
    
    return {
        salt: bytesToHex(salt),
        iv: bytesToHex(iv),
        data: bytesToHex(new Uint8Array(encrypted)),
        version: 1
    };
}

/**
 * Decrypt seed phrase from encrypted storage
 */
async function decryptSeed(encryptedObj, password) {
    var enc = new TextEncoder();
    var salt = hexToBytes(encryptedObj.salt);
    var iv = hexToBytes(encryptedObj.iv);
    var data = hexToBytes(encryptedObj.data);
    
    var keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    var aesKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false, ['decrypt']
    );
    
    try {
        var decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, aesKey, data);
        return new TextDecoder().decode(decrypted);
    } catch(e) {
        throw new Error('Wrong password or corrupted data');
    }
}

// ─── QR CODE GENERATION (Minimal) ────────────────────────

/**
 * Generate a QR code SVG for an address
 * Uses a simple QR encoding (delegates to external lib if available)
 */
function generateAddressQR(address, size) {
    size = size || 200;
    // Use a data URI approach with a QR API fallback
    return '<img src="https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + 
           '&data=bitcoin:' + encodeURIComponent(address) + 
           '&bgcolor=020617&color=f97316" alt="QR Code" style="border-radius:12px;border:2px solid var(--border);" width="' + size + '" height="' + size + '">';
}

// ─── PUBLIC API ──────────────────────────────────────────

window.WalletCore = {
    generateMnemonic: generateMnemonic,
    validateMnemonic: validateMnemonic,
    mnemonicToSeed: mnemonicToSeed,
    deriveBIP84Key: deriveBIP84Key,
    privateKeyToPublicKey: privateKeyToPublicKey,
    pubkeyToSegwitAddress: pubkeyToSegwitAddress,
    encryptSeed: encryptSeed,
    decryptSeed: decryptSeed,
    generateAddressQR: generateAddressQR,
    sha256: sha256,
    bytesToHex: bytesToHex,
    hexToBytes: hexToBytes,
    loadWordlist: loadWordlist,
    
    // Derive a set of addresses from a seed
    deriveAddresses: async function(seed, count, network) {
        count = count || 5;
        network = network || 'mainnet';
        var addresses = [];
        for (var i = 0; i < count; i++) {
            var child = await deriveBIP84Key(seed, 0, 0, i);
            var pubkey = privateKeyToPublicKey(child.key);
            var address = await pubkeyToSegwitAddress(pubkey, network);
            addresses.push({
                index: i,
                path: "m/84'/0'/0'/0/" + i,
                address: address,
                pubkey: bytesToHex(pubkey),
            });
        }
        return addresses;
    },
    
    // Full wallet creation flow
    createWallet: async function(password, wordCount) {
        var strength = (wordCount === 24) ? 256 : 128;
        var mnemonic = await generateMnemonic(strength);
        var encrypted = await encryptSeed(mnemonic, password);
        var seed = await mnemonicToSeed(mnemonic);
        var addresses = await window.WalletCore.deriveAddresses(seed, 3);
        
        return {
            mnemonic: mnemonic,
            encrypted: encrypted,
            addresses: addresses,
            createdAt: Date.now()
        };
    },
    
    // Restore wallet from mnemonic
    restoreWallet: async function(mnemonic, password) {
        var valid = await validateMnemonic(mnemonic);
        if (!valid) throw new Error('Invalid mnemonic phrase');
        
        var encrypted = await encryptSeed(mnemonic, password);
        var seed = await mnemonicToSeed(mnemonic);
        var addresses = await window.WalletCore.deriveAddresses(seed, 3);
        
        return {
            mnemonic: mnemonic,
            encrypted: encrypted,
            addresses: addresses,
            restoredAt: Date.now()
        };
    }
};

console.log('[WALLET] Core cryptographic engine loaded');
})();
