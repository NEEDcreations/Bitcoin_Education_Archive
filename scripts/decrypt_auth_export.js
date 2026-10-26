#!/usr/bin/env node
'use strict';

// Decrypt a nightly Auth export to JSONL.
//
//   AUTH_BACKUP_KEY='base64-or-hex' node scripts/decrypt_auth_export.js \
//     --file users.jsonl.gz.enc --out users.jsonl
//
// The key is read from AUTH_BACKUP_KEY only. Do not pass it as an argument.
// Plaintext contains emails and password hashes. --out is required unless
// you pass --stdout on purpose. See scripts/backup_infra_setup.sh for how
// to create AUTH_BACKUP_KEY in Secret Manager.

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const crypto = require(path.join(__dirname, '../functions/src/authBackupCrypto'));

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
    if (process.env.AUTH_BACKUP_KEY) keys.push(process.env.AUTH_BACKUP_KEY);
    String(process.env.AUTH_BACKUP_KEYS || '').split(/[\n,]/).forEach(function (part) {
        const trimmed = part.trim();
        if (trimmed) keys.push(trimmed);
    });
    return keys;
}

function main() {
    const file = argValue('--file');
    const out = argValue('--out');
    const dest = argValue('--dest');
    const stdout = process.argv.indexOf('--stdout') !== -1;
    if (!file) fail('Usage: AUTH_BACKUP_KEY=... node scripts/decrypt_auth_export.js --file users.jsonl.gz.enc --out users.jsonl --dest auth/YYYY-MM-DD/users.jsonl.gz.enc');
    if (!out && !stdout) fail('Refusing to print plaintext. Pass --out <file> or --stdout.');
    const keys = keysFromEnv();
    if (!keys.length) {
        fail('Set AUTH_BACKUP_KEY in the environment. Do not pass the key as an argument.');
    }
    const enc = fs.readFileSync(file);
    const gz = crypto.decryptAesGcm(enc, keys, dest);
    const text = zlib.gunzipSync(gz);
    if (out) {
        fs.writeFileSync(out, text, { mode: 0o600 });
        console.error('Wrote ' + out + ' (' + text.length + ' bytes). The file contains emails and password hashes.');
        return;
    }
    console.error('Writing plaintext JSONL to stdout. It contains emails and password hashes.');
    process.stdout.write(text);
}

main();
