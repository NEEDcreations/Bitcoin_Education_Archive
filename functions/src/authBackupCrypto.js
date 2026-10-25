'use strict';

// AES-256-GCM for the nightly Auth export. The key is Secret Manager
// AUTH_BACKUP_KEY (32 bytes, base64 or 64-char hex). Never commit a key.
//
// Phil generates it in Cloud Shell, never on the deploy box. The pipe does
// not print the key, so it is not a shell argument. Print it once, save that
// output offline, then clear the screen:
//   openssl rand -base64 32 | gcloud secrets versions add AUTH_BACKUP_KEY \
//     --project=bitcoin-education-archive --data-file=-
//   gcloud secrets versions access latest --secret=AUTH_BACKUP_KEY \
//     --project=bitcoin-education-archive
//   clear
//
// File layout: magic "BQAE" | version 1 | 12-byte IV | 16-byte tag | ciphertext.

const crypto = require('crypto');

const MAGIC = Buffer.from('BQAE');
const VERSION = 1;
const HEADER_LEN = 4 + 1 + 12 + 16;

function parseBackupKey(raw) {
    if (Buffer.isBuffer(raw)) {
        if (raw.length !== 32) throw new Error('AUTH_BACKUP_KEY must be 32 bytes');
        return raw;
    }
    let s = String(raw == null ? '' : raw).trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
    }
    s = s.replace(/\s+/g, '');
    if (!s) throw new Error('AUTH_BACKUP_KEY is empty');
    if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, 'hex');
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const buf = Buffer.from(b64, 'base64');
    if (buf.length !== 32) {
        throw new Error('AUTH_BACKUP_KEY must decode to 32 bytes (base64 or 64-char hex)');
    }
    return buf;
}

function headerMatches(buf) {
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
    return b.length >= 5 && b.subarray(0, 4).equals(MAGIC) && b[4] === VERSION;
}

function encryptAesGcm(plaintext, key) {
    const keyBuf = Buffer.isBuffer(key) && key.length === 32 ? key : parseBackupKey(key);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
    const body = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext);
    const enc = Buffer.concat([cipher.update(body), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([MAGIC, Buffer.from([VERSION]), iv, tag, enc]);
}

function decryptAesGcm(blob, key) {
    const keyBuf = Buffer.isBuffer(key) && key.length === 32 ? key : parseBackupKey(key);
    const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
    if (buf.length < HEADER_LEN + 1) throw new Error('encrypted auth export is too short');
    if (!buf.subarray(0, 4).equals(MAGIC)) throw new Error('encrypted auth export has a bad header');
    if (buf[4] !== VERSION) throw new Error('unsupported auth export version');
    const iv = buf.subarray(5, 17);
    const tag = buf.subarray(17, 33);
    const data = buf.subarray(33);
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
}

module.exports = {
    MAGIC,
    VERSION,
    HEADER_LEN,
    parseBackupKey,
    headerMatches,
    encryptAesGcm,
    decryptAesGcm,
};
