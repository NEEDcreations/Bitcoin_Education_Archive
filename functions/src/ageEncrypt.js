'use strict';

// age v1 encryption to X25519 recipients (https://age-encryption.org/v1),
// built on Node's own crypto: no new dependency. ENCRYPT ONLY. This file
// holds no private key and cannot decrypt. Phil decrypts on his own machine
// with the official `age -d -i <identity>` CLI.
//
// Format, per the spec:
//   age-encryption.org/v1
//   -> X25519 <b64(ephemeral share)>
//   <b64(ChaCha20-Poly1305(wrap key, file key))>
//   --- <b64(HMAC-SHA256(header key, header up to and including "---"))>
//   <16-byte nonce><STREAM: 64 KiB ChaCha20-Poly1305 chunks>
// b64 is standard base64 without padding. tests/test-auth-export.js checks
// that the official age CLI decrypts this output when it is installed.

const crypto = require('crypto');

const INTRO = 'age-encryption.org/v1';
const X25519_INFO = 'age-encryption.org/v1/X25519';
const CHUNK = 64 * 1024;
const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function b64(buf) {
    return Buffer.from(buf).toString('base64').replace(/=+$/, '');
}

function b64url(buf) {
    return Buffer.from(buf).toString('base64url');
}

function polymod(values) {
    const G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    let chk = 1;
    for (let i = 0; i < values.length; i++) {
        const top = chk >>> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ values[i];
        for (let j = 0; j < 5; j++) if ((top >>> j) & 1) chk ^= G[j];
    }
    return chk >>> 0;
}

function hrpExpand(hrp) {
    const out = [];
    for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5);
    out.push(0);
    for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31);
    return out;
}

function convertBits(data, from, to, pad) {
    let acc = 0;
    let bits = 0;
    const out = [];
    const maxv = (1 << to) - 1;
    for (let i = 0; i < data.length; i++) {
        acc = (acc << from) | data[i];
        bits += from;
        while (bits >= to) {
            bits -= to;
            out.push((acc >> bits) & maxv);
        }
    }
    if (pad) {
        if (bits > 0) out.push((acc << (to - bits)) & maxv);
    } else if (bits >= from || ((acc << (to - bits)) & maxv)) {
        throw new Error('bech32: bad padding');
    }
    return out;
}

// Returns { hrp, data: Buffer }. Rejects mixed case and bad checksums.
function bech32Decode(str) {
    const s = String(str || '').trim();
    if (s !== s.toLowerCase() && s !== s.toUpperCase()) throw new Error('bech32: mixed case');
    const lower = s.toLowerCase();
    const pos = lower.lastIndexOf('1');
    if (pos < 1 || pos + 7 > lower.length) throw new Error('bech32: bad separator');
    const hrp = lower.slice(0, pos);
    const words = [];
    for (let i = pos + 1; i < lower.length; i++) {
        const v = BECH32.indexOf(lower[i]);
        if (v === -1) throw new Error('bech32: bad character');
        words.push(v);
    }
    if (polymod(hrpExpand(hrp).concat(words)) !== 1) throw new Error('bech32: bad checksum');
    return { hrp: hrp, data: Buffer.from(convertBits(words.slice(0, -6), 5, 8, false)) };
}

function bech32Encode(hrp, data) {
    const words = convertBits(Array.from(data), 8, 5, true);
    const mod = polymod(hrpExpand(hrp).concat(words, [0, 0, 0, 0, 0, 0])) ^ 1;
    let out = hrp + '1';
    for (let i = 0; i < words.length; i++) out += BECH32[words[i]];
    for (let i = 0; i < 6; i++) out += BECH32[(mod >> (5 * (5 - i))) & 31];
    return out;
}

// "age1..." -> 32-byte X25519 public key. Throws on anything else
// (including AGE-SECRET-KEY-1... identities, so a private key pasted by
// mistake is refused instead of used).
function parseRecipient(recipient) {
    const s = String(recipient || '').trim();
    if (!/^age1[02-9ac-hj-np-z]{58}$/.test(s)) throw new Error('not an age X25519 recipient (expected age1 + 58 chars)');
    const dec = bech32Decode(s);
    if (dec.hrp !== 'age' || dec.data.length !== 32) throw new Error('not an age X25519 recipient');
    return dec.data;
}

function publicKeyObject(raw) {
    return crypto.createPublicKey({ key: { kty: 'OKP', crv: 'X25519', x: b64url(raw) }, format: 'jwk' });
}

function hkdf(ikm, salt, info, len) {
    return Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from(info, 'utf8'), len));
}

function seal(key, nonce, plaintext) {
    const c = crypto.createCipheriv('chacha20-poly1305', key, nonce, { authTagLength: 16 });
    const body = Buffer.concat([c.update(plaintext), c.final()]);
    return Buffer.concat([body, c.getAuthTag()]);
}

function wrapLines(s) {
    // age wraps stanza bodies at 64 columns; the last line is always shorter
    // than 64 (an exact multiple ends with an empty line).
    const lines = [];
    for (let i = 0; i < s.length; i += 64) lines.push(s.slice(i, i + 64));
    if (s.length % 64 === 0) lines.push('');
    return lines.join('\n');
}

function x25519Stanza(fileKey, recipientRaw) {
    const eph = crypto.generateKeyPairSync('x25519');
    const share = Buffer.from(eph.publicKey.export({ format: 'jwk' }).x, 'base64url');
    const shared = crypto.diffieHellman({ privateKey: eph.privateKey, publicKey: publicKeyObject(recipientRaw) });
    if (shared.equals(Buffer.alloc(32))) throw new Error('age: low-order recipient key');
    const wrapKey = hkdf(shared, Buffer.concat([share, recipientRaw]), X25519_INFO, 32);
    const body = seal(wrapKey, Buffer.alloc(12), fileKey);
    return '-> X25519 ' + b64(share) + '\n' + wrapLines(b64(body)) + '\n';
}

function streamEncrypt(payloadKey, plaintext) {
    const parts = [];
    const n = plaintext.length === 0 ? 1 : Math.ceil(plaintext.length / CHUNK);
    for (let i = 0; i < n; i++) {
        const nonce = Buffer.alloc(12);
        nonce.writeUIntBE(i, 5, 6); // 11-byte big-endian counter; JS-safe up to 2^48 chunks
        if (i === n - 1) nonce[11] = 1;
        parts.push(seal(payloadKey, nonce, plaintext.subarray(i * CHUNK, (i + 1) * CHUNK)));
    }
    return Buffer.concat(parts);
}

// Encrypts `plaintext` (Buffer or string) to one or more age1 recipients.
// Returns the binary age file as a Buffer. The file key lives only in memory
// for the duration of this call.
function encrypt(plaintext, recipients) {
    const list = (Array.isArray(recipients) ? recipients : [recipients]).filter(Boolean);
    if (!list.length) throw new Error('age: no recipient');
    const raws = list.map(parseRecipient);
    const body = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), 'utf8');
    const fileKey = crypto.randomBytes(16);
    try {
        let header = INTRO + '\n';
        raws.forEach(function (r) { header += x25519Stanza(fileKey, r); });
        header += '---';
        const mac = crypto.createHmac('sha256', hkdf(fileKey, Buffer.alloc(0), 'header', 32)).update(header, 'utf8').digest();
        const nonce = crypto.randomBytes(16);
        const payloadKey = hkdf(fileKey, nonce, 'payload', 32);
        return Buffer.concat([Buffer.from(header + ' ' + b64(mac) + '\n', 'utf8'), nonce, streamEncrypt(payloadKey, body)]);
    } finally {
        fileKey.fill(0);
    }
}

module.exports = {
    encrypt: encrypt,
    parseRecipient: parseRecipient,
    bech32Decode: bech32Decode,
    bech32Encode: bech32Encode,
    CHUNK: CHUNK,
};
