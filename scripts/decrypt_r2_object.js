#!/usr/bin/env node
'use strict';

// Decrypt one object written by nightlyR2Copy.
//
//   BACKUP_ENCRYPTION_KEY='...' node scripts/decrypt_r2_object.js \
//     --file object.bin --out restored.bin
//
// The key is read from the environment, never from argv. The file is the
// sealed R2 object (magic BQR2, a per-object IV, ciphertext, then the tag).
// Download the ciphertext with the bucket-scoped R2 token first. Do not
// print the key, and do not decrypt by logging it on the deploy box.

const fs = require('fs');
const path = require('path');
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

function decryptFile(file, key, outPath) {
    const stat = fs.statSync(file);
    if (stat.size < seal.HEADER_LEN + seal.TAG_LEN) fail('Sealed object is too short.');
    const header = Buffer.alloc(seal.HEADER_LEN);
    const tag = Buffer.alloc(seal.TAG_LEN);
    const fd = fs.openSync(file, 'r');
    try {
        fs.readSync(fd, header, 0, seal.HEADER_LEN, 0);
        fs.readSync(fd, tag, 0, seal.TAG_LEN, stat.size - seal.TAG_LEN);
    } finally {
        fs.closeSync(fd);
    }
    if (!seal.headerMatches(header)) fail('Sealed object has a bad header.');
    const iv = header.subarray(5, 5 + seal.IV_LEN);
    const decipher = crypto.createDecipheriv('aes-256-gcm', seal.parseBackupKey(key), iv);
    decipher.setAuthTag(tag);
    const cipherBytes = stat.size - seal.HEADER_LEN - seal.TAG_LEN;
    if (cipherBytes === 0) {
        fs.writeFileSync(outPath, decipher.final());
        return;
    }
    const input = fs.createReadStream(file, {
        start: seal.HEADER_LEN,
        end: stat.size - seal.TAG_LEN - 1,
    });
    const output = fs.createWriteStream(outPath);
    input.pipe(decipher).pipe(output);
    return new Promise(function (resolve, reject) {
        output.on('finish', resolve);
        output.on('error', reject);
        input.on('error', reject);
        decipher.on('error', reject);
    });
}

async function main() {
    const file = argValue('--file');
    const out = argValue('--out');
    if (!file || !out) {
        fail('Usage: BACKUP_ENCRYPTION_KEY=... node scripts/decrypt_r2_object.js --file object.bin --out restored.bin');
    }
    if (!process.env.BACKUP_ENCRYPTION_KEY) {
        fail('Set BACKUP_ENCRYPTION_KEY in the environment. Do not pass the key as an argument.');
    }
    await decryptFile(file, process.env.BACKUP_ENCRYPTION_KEY, out);
    console.log('Decrypted', path.basename(file), 'to', path.basename(out));
}

main().catch(function (err) {
    fail(err && err.message ? err.message : 'decrypt failed');
});
