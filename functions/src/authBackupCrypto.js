'use strict';

// AES-256-GCM for the nightly Auth export. The key is Secret Manager
// AUTH_BACKUP_KEY (32 bytes, base64 or 64-char hex). Never commit a key.
// Phil generates it in Cloud Shell from the one paste block printed by
// scripts/backup_infra_setup.sh. The key is created inside Secret Manager
// and shown once for offline storage. Never log it.
//
// Version 2 layout:
//   magic "BQAE" | version 2 | 8-byte key id | 12-byte IV | 16-byte tag | ciphertext
// The key id is the first 8 bytes of SHA-256("bqae-kid" || key). The GCM
// additional data is the header followed by the destination object name.
// Version 1 (no key id, tag before ciphertext, no additional data) still
// decrypts. Decrypt accepts one key or a list and picks the key by id.

const crypto = require('crypto');

const MAGIC = Buffer.from('BQAE');
const VERSION = 2;
const VERSION_V1 = 1;
const IV_LEN = 12;
const TAG_LEN = 16;
const KID_LEN = 8;
const KID_LABEL = Buffer.from('bqae-kid');
const HEADER_LEN_V1 = 4 + 1 + IV_LEN + TAG_LEN;
const HEADER_LEN = 4 + 1 + KID_LEN + IV_LEN + TAG_LEN;

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

function asKeys(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    if (!list.length) throw new Error('AUTH_BACKUP_KEY is empty');
    return list.map(parseBackupKey);
}

function keyId(key) {
    return crypto.createHash('sha256').update(KID_LABEL).update(parseBackupKey(key)).digest().subarray(0, KID_LEN);
}

function keyIdHex(key) {
    return keyId(key).toString('hex');
}

function plaintextSha256(buf) {
    const body = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
    return crypto.createHash('sha256').update(body).digest('hex');
}

function headerMatches(buf) {
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
    if (b.length < 5 || !b.subarray(0, 4).equals(MAGIC)) return false;
    return b[4] === VERSION || b[4] === VERSION_V1;
}

function additionalData(header, destKey) {
    return Buffer.concat([header, Buffer.from(String(destKey || ''), 'utf8')]);
}

function encryptAesGcm(plaintext, key, destKey) {
    const keyBuf = parseBackupKey(key);
    const iv = crypto.randomBytes(IV_LEN);
    const kid = keyId(keyBuf);
    const header = Buffer.concat([MAGIC, Buffer.from([VERSION]), kid, iv]);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
    cipher.setAAD(additionalData(header, destKey));
    const body = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext);
    const enc = Buffer.concat([cipher.update(body), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([header, tag, enc]);
}

function openAuth(buf) {
    if (buf.length < 5 || !buf.subarray(0, 4).equals(MAGIC)) {
        throw new Error('encrypted auth export has a bad header');
    }
    const version = buf[4];
    if (version === VERSION_V1) {
        if (buf.length < HEADER_LEN_V1 + 1) throw new Error('encrypted auth export is too short');
        return {
            version: version,
            header: buf.subarray(0, 5 + IV_LEN),
            kid: null,
            iv: buf.subarray(5, 5 + IV_LEN),
            tag: buf.subarray(5 + IV_LEN, 5 + IV_LEN + TAG_LEN),
            data: buf.subarray(HEADER_LEN_V1),
        };
    }
    if (version !== VERSION) throw new Error('unsupported auth export version');
    if (buf.length < HEADER_LEN + 1) throw new Error('encrypted auth export is too short');
    const header = buf.subarray(0, 4 + 1 + KID_LEN + IV_LEN);
    return {
        version: version,
        header: header,
        kid: buf.subarray(5, 5 + KID_LEN),
        iv: buf.subarray(5 + KID_LEN, 5 + KID_LEN + IV_LEN),
        tag: buf.subarray(header.length, header.length + TAG_LEN),
        data: buf.subarray(HEADER_LEN),
    };
}

function keysForKid(keys, kid) {
    if (!kid) return keys;
    const matched = [];
    for (let i = 0; i < keys.length; i++) {
        if (keyId(keys[i]).equals(kid)) matched.push(keys[i]);
    }
    return matched.length ? matched : keys;
}

function decryptAesGcm(blob, keys, destKey) {
    const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
    const opened = openAuth(buf);
    const parsed = asKeys(keys);
    const order = opened.version === VERSION ? keysForKid(parsed, opened.kid) : parsed;
    let last = null;
    for (let i = 0; i < order.length; i++) {
        try {
            const decipher = crypto.createDecipheriv('aes-256-gcm', order[i], opened.iv);
            if (opened.version === VERSION) decipher.setAAD(additionalData(opened.header, destKey));
            decipher.setAuthTag(opened.tag);
            return Buffer.concat([decipher.update(opened.data), decipher.final()]);
        } catch (err) {
            last = err;
        }
    }
    throw last || new Error('unable to authenticate data');
}

module.exports = {
    MAGIC,
    VERSION,
    VERSION_V1,
    HEADER_LEN,
    HEADER_LEN_V1,
    KID_LEN,
    parseBackupKey,
    keyId,
    keyIdHex,
    plaintextSha256,
    headerMatches,
    encryptAesGcm,
    decryptAesGcm,
};
