'use strict';

// AES-256-GCM for the off-site R2 copy. The key is Secret Manager
// BACKUP_ENCRYPTION_KEY (32 bytes, base64 or 64-char hex). Never log it.
//
// Streaming layout, so a large export is not buffered:
//   magic "BQR2" | version 1 | 12-byte random IV | ciphertext | 16-byte tag
// The IV is chosen per object. The tag is the last 16 bytes of the object.
// R2 stores this sealed blob and nothing else.

const crypto = require('crypto');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');

const MAGIC = Buffer.from('BQR2');
const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = 4 + 1 + IV_LEN;

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

function headerMatches(buf) {
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
    return b.length >= 5 && b.subarray(0, 4).equals(MAGIC) && b[4] === VERSION;
}

class SealStream extends Transform {
    constructor(key) {
        super();
        this._iv = crypto.randomBytes(IV_LEN);
        this._cipher = crypto.createCipheriv('aes-256-gcm', key, this._iv);
        this._started = false;
    }

    _writeHeader() {
        if (this._started) return;
        this._started = true;
        this.push(Buffer.concat([MAGIC, Buffer.from([VERSION]), this._iv]));
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

function encryptStream(key) {
    return new SealStream(parseBackupKey(key));
}

function sealBuffer(plaintext, key) {
    const body = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext));
    const input = Readable.from([body]);
    const chunks = [];
    const sink = new Transform({
        transform(chunk, enc, cb) {
            chunks.push(Buffer.from(chunk));
            cb();
        },
    });
    return pipeline(input, encryptStream(key), sink).then(function () {
        return Buffer.concat(chunks);
    });
}

function openSealed(blob) {
    const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob || []);
    if (buf.length < HEADER_LEN + TAG_LEN) throw new Error('sealed object is too short');
    if (!headerMatches(buf)) throw new Error('sealed object has a bad header');
    return {
        iv: buf.subarray(5, 5 + IV_LEN),
        tag: buf.subarray(buf.length - TAG_LEN),
        data: buf.subarray(HEADER_LEN, buf.length - TAG_LEN),
    };
}

function decryptBuffer(blob, key) {
    const opened = openSealed(blob);
    const decipher = crypto.createDecipheriv('aes-256-gcm', parseBackupKey(key), opened.iv);
    decipher.setAuthTag(opened.tag);
    return Buffer.concat([decipher.update(opened.data), decipher.final()]);
}

module.exports = {
    MAGIC,
    VERSION,
    IV_LEN,
    TAG_LEN,
    HEADER_LEN,
    parseBackupKey,
    headerMatches,
    encryptStream,
    sealBuffer,
    openSealed,
    decryptBuffer,
};
