'use strict';

// AES-256-GCM for the off-site R2 copy. The key is Secret Manager
// BACKUP_ENCRYPTION_KEY (32 bytes, base64 or 64-char hex). Never log it.
//
// Version 2 layout:
//   magic "BQR2" | version 2 | 8-byte key id | 12-byte random IV | ciphertext | 16-byte tag
// The key id is the first 8 bytes of SHA-256("bqr2-kid" || key). The same id is
// stored as R2 object metadata x-amz-meta-kid. The GCM additional data is the
// header bytes followed by the destination object key, so a blob cannot be
// decrypted under a different name or a different key.
// Version 1 (magic, version 1, IV, ciphertext, tag, no key id, no additional
// data) still decrypts. Decrypt accepts one key or a list and picks the key
// whose id matches. R2 stores this sealed blob and nothing else.

const crypto = require('crypto');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');

const MAGIC = Buffer.from('BQR2');
const VERSION = 2;
const VERSION_V1 = 1;
const IV_LEN = 12;
const TAG_LEN = 16;
const KID_LEN = 8;
const KID_LABEL = Buffer.from('bqr2-kid');
const HEADER_LEN_V1 = 4 + 1 + IV_LEN;
const HEADER_LEN = 4 + 1 + KID_LEN + IV_LEN;

function parseBackupKey(raw) {
    if (Buffer.isBuffer(raw)) {
        if (raw.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY must be 32 bytes');
        return raw;
    }
    let s = String(raw == null ? '' : raw).trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
    }
    s = s.replace(/\s+/g, '');
    if (!s) throw new Error('BACKUP_ENCRYPTION_KEY is empty');
    if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, 'hex');
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const buf = Buffer.from(b64, 'base64');
    if (buf.length !== 32) {
        throw new Error('BACKUP_ENCRYPTION_KEY must decode to 32 bytes (base64 or 64-char hex)');
    }
    return buf;
}

function asKeys(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    if (!list.length) throw new Error('BACKUP_ENCRYPTION_KEY is empty');
    return list.map(parseBackupKey);
}

function keyId(key) {
    return crypto.createHash('sha256').update(KID_LABEL).update(parseBackupKey(key)).digest().subarray(0, KID_LEN);
}

function keyIdHex(key) {
    return keyId(key).toString('hex');
}

function headerMatches(buf) {
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
    if (b.length < 5 || !b.subarray(0, 4).equals(MAGIC)) return false;
    return b[4] === VERSION || b[4] === VERSION_V1;
}

function additionalData(header, destKey) {
    return Buffer.concat([header, Buffer.from(String(destKey || ''), 'utf8')]);
}

class SealStream extends Transform {
    constructor(key, destKey) {
        super();
        this._iv = crypto.randomBytes(IV_LEN);
        this._header = Buffer.concat([
            MAGIC,
            Buffer.from([VERSION]),
            keyId(key),
            this._iv,
        ]);
        this._cipher = crypto.createCipheriv('aes-256-gcm', parseBackupKey(key), this._iv);
        this._cipher.setAAD(additionalData(this._header, destKey));
        this._started = false;
    }

    _writeHeader() {
        if (this._started) return;
        this._started = true;
        this.push(this._header);
    }

    _transform(chunk, enc, cb) {
        try {
            this._writeHeader();
            const out = this._cipher.update(chunk);
            if (out.length) this.push(out);
            cb();
        } catch (e) {
            cb(e);
        }
    }

    _flush(cb) {
        try {
            this._writeHeader();
            const final = this._cipher.final();
            if (final.length) this.push(final);
            this.push(this._cipher.getAuthTag());
            cb();
        } catch (e) {
            cb(e);
        }
    }
}

function encryptStream(key, destKey) {
    return new SealStream(key, destKey);
}

function sealBuffer(plaintext, key, destKey) {
    const body = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext));
    const input = Readable.from([body]);
    const chunks = [];
    const sink = new Transform({
        transform(chunk, enc, cb) {
            chunks.push(Buffer.from(chunk));
            cb();
        },
    });
    return pipeline(input, encryptStream(key, destKey), sink).then(function () {
        return Buffer.concat(chunks);
    });
}

function openSealed(blob) {
    const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob || []);
    if (buf.length < 5 || !buf.subarray(0, 4).equals(MAGIC)) throw new Error('sealed object has a bad header');
    const version = buf[4];
    let headerLen;
    let kid = null;
    let iv;
    if (version === VERSION_V1) {
        headerLen = HEADER_LEN_V1;
        iv = buf.subarray(5, 5 + IV_LEN);
    } else if (version === VERSION) {
        headerLen = HEADER_LEN;
        kid = buf.subarray(5, 5 + KID_LEN);
        iv = buf.subarray(5 + KID_LEN, 5 + KID_LEN + IV_LEN);
    } else {
        throw new Error('sealed object has a bad header');
    }
    if (buf.length < headerLen + TAG_LEN) throw new Error('sealed object is too short');
    return {
        version: version,
        header: buf.subarray(0, headerLen),
        kid: kid,
        iv: iv,
        tag: buf.subarray(buf.length - TAG_LEN),
        data: buf.subarray(headerLen, buf.length - TAG_LEN),
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

function decryptOpened(opened, key, destKey) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, opened.iv);
    if (opened.version === VERSION) decipher.setAAD(additionalData(opened.header, destKey));
    decipher.setAuthTag(opened.tag);
    return Buffer.concat([decipher.update(opened.data), decipher.final()]);
}

function decryptBuffer(blob, keys, destKey) {
    const opened = openSealed(blob);
    const parsed = asKeys(keys);
    const order = opened.version === VERSION ? keysForKid(parsed, opened.kid) : parsed;
    let last = null;
    for (let i = 0; i < order.length; i++) {
        try {
            return decryptOpened(opened, order[i], destKey);
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
    IV_LEN,
    TAG_LEN,
    KID_LEN,
    HEADER_LEN,
    HEADER_LEN_V1,
    parseBackupKey,
    keyId,
    keyIdHex,
    headerMatches,
    additionalData,
    encryptStream,
    sealBuffer,
    openSealed,
    decryptBuffer,
};
