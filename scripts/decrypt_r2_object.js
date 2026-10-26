#!/usr/bin/env node
'use strict';

// Decrypt one object written by nightlyR2Copy.
//
//   BACKUP_ENCRYPTION_KEY='...' node scripts/decrypt_r2_object.js \
//     --file object.bin --out restored.bin --dest 'uploads/photo.png#123'
//
// The key is read from the environment, never from argv. Extra keys, comma
// or newline separated, may be set in BACKUP_ENCRYPTION_KEYS. The file is
// the sealed R2 object. Version 2 binds the header and the R2 object key, so
// --dest must be that key. Version 1 objects have no key id and no binding.
// Plaintext is written to a mode 0600 temporary file and renamed only after
// the authentication tag verifies. A bad tag deletes the temporary file.
// Download the ciphertext with the bucket-scoped R2 token first. Do not
// print the key.

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const crypto = require('crypto');
const seal = require(path.join(__dirname, '../functions/src/r2BackupCrypto'));

function argValue(flag) {
    const i = process.argv.indexOf(flag);
    if (i === -1 || i + 1 >= process.argv.length) return '';
    return process.argv[i + 1];
}

function fail(message) {
    console.error(message);
    process.exit(1);
}

function keysFromEnv() {
    const keys = [];
    if (process.env.BACKUP_ENCRYPTION_KEY) keys.push(process.env.BACKUP_ENCRYPTION_KEY);
    String(process.env.BACKUP_ENCRYPTION_KEYS || '').split(/[\n,]/).forEach(function (part) {
        const trimmed = part.trim();
        if (trimmed) keys.push(trimmed);
    });
    return keys;
}

function readHeader(file) {
    const stat = fs.statSync(file);
    if (stat.size < 5) fail('Sealed object is too short.');
    const probe = Buffer.alloc(5);
    const fd = fs.openSync(file, 'r');
    try {
        fs.readSync(fd, probe, 0, 5, 0);
        if (!seal.headerMatches(probe)) fail('Sealed object has a bad header.');
        const headerLen = probe[4] === seal.VERSION ? seal.HEADER_LEN : seal.HEADER_LEN_V1;
        if (stat.size < headerLen + seal.TAG_LEN) fail('Sealed object is too short.');
        const header = Buffer.alloc(headerLen);
        const tag = Buffer.alloc(seal.TAG_LEN);
        fs.readSync(fd, header, 0, headerLen, 0);
        fs.readSync(fd, tag, 0, seal.TAG_LEN, stat.size - seal.TAG_LEN);
        return { stat: stat, header: header, tag: tag, headerLen: headerLen };
    } finally {
        fs.closeSync(fd);
    }
}

function unlinkQuiet(file) {
    try { fs.unlinkSync(file); } catch (e) { /* already gone */ }
}

async function decryptWithKey(file, opened, key, dest, outPath) {
    const tmp = outPath + '.tmp';
    unlinkQuiet(tmp);
    const parsed = seal.parseBackupKey(key);
    const ivStart = opened.header[4] === seal.VERSION ? 5 + seal.KID_LEN : 5;
    const iv = opened.header.subarray(ivStart, ivStart + seal.IV_LEN);
    const decipher = crypto.createDecipheriv('aes-256-gcm', parsed, iv);
    if (opened.header[4] === seal.VERSION) {
        decipher.setAAD(seal.additionalData(opened.header, dest));
    }
    decipher.setAuthTag(opened.tag);
    const cipherBytes = opened.stat.size - opened.headerLen - seal.TAG_LEN;
    const input = cipherBytes === 0
        ? Readable.from([])
        : fs.createReadStream(file, { start: opened.headerLen, end: opened.stat.size - seal.TAG_LEN - 1 });
    const fd = fs.openSync(tmp, 'w', 0o600);
    fs.fchmodSync(fd, 0o600);
    const output = fs.createWriteStream(null, { fd: fd });
    try {
        await pipeline(input, decipher, output);
        fs.chmodSync(tmp, 0o600);
        fs.renameSync(tmp, outPath);
        fs.chmodSync(outPath, 0o600);
    } catch (err) {
        output.destroy();
        unlinkQuiet(tmp);
        throw err;
    }
}

async function decryptFile(file, keys, dest, outPath) {
    const opened = readHeader(file);
    const parsed = keys.map(seal.parseBackupKey);
    let order = parsed;
    if (opened.header[4] === seal.VERSION) {
        const kid = opened.header.subarray(5, 5 + seal.KID_LEN);
        const matched = parsed.filter(function (key) { return seal.keyId(key).equals(kid); });
        if (matched.length) order = matched;
    }
    let last = null;
    for (let i = 0; i < order.length; i++) {
        try {
            await decryptWithKey(file, opened, order[i], dest, outPath);
            return;
        } catch (err) {
            last = err;
            unlinkQuiet(outPath + '.tmp');
        }
    }
    throw last || new Error('unable to authenticate data');
}

async function main() {
    const file = argValue('--file');
    const out = argValue('--out');
    const dest = argValue('--dest');
    if (!file || !out) {
        fail('Usage: BACKUP_ENCRYPTION_KEY=... node scripts/decrypt_r2_object.js --file object.bin --out restored.bin --dest <r2-object-key>');
    }
    const keys = keysFromEnv();
    if (!keys.length) {
        fail('Set BACKUP_ENCRYPTION_KEY in the environment. Do not pass the key as an argument.');
    }
    await decryptFile(file, keys, dest, out);
    console.log('Decrypted', path.basename(file), 'to', path.basename(out));
}

main().catch(function (err) {
    fail(err && err.message ? err.message : 'decrypt failed');
});
