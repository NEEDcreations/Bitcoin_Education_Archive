#!/usr/bin/env node
'use strict';

// Restore Firebase Auth users from an encrypted nightly export.
// Dry-run by default. Nothing is written unless --apply is passed.
//
//   AUTH_BACKUP_KEY='...' node scripts/restore_auth_export.js --file users.jsonl.gz.enc
//   AUTH_BACKUP_KEY='...' node scripts/restore_auth_export.js --file users.jsonl.gz.enc --apply
//   AUTH_BACKUP_KEY='...' node scripts/restore_auth_export.js --file users.jsonl.gz.enc --apply --project bitcoin-education-archive
//
// The key comes from the environment, never from argv. --apply is the only
// switch that contacts Auth. Password hashes are imported when the encrypted
// header includes the project's SCRYPT parameters. MFA enrollments are counted
// and not recreated. This script does not print emails, hashes, or the signer key.
//
// scripts/backup_infra_setup.sh creates an empty AUTH_BACKUP_KEY secret.
// Phil adds the key version in Cloud Shell and keeps an offline copy.
// Do not commit the key.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require(path.join(__dirname, '../functions/src/authBackupCrypto'));
const format = require(path.join(__dirname, '../functions/src/authBackupFormat'));
const health = require(path.join(__dirname, '../functions/src/backupHealth'));

function argValue(flag) {
    const i = process.argv.indexOf(flag);
    if (i === -1 || i + 1 >= process.argv.length) return '';
    return process.argv[i + 1];
}

function fail(message) {
    console.error(message);
    process.exit(1);
}

function loadAdmin() {
    try {
        return require('firebase-admin');
    } catch (e) {
        return require(path.join(__dirname, '../functions/node_modules/firebase-admin'));
    }
}

function truncateUid(uid) {
    const s = String(uid || '');
    if (!s) return '';
    if (s.length <= 6) return s.slice(0, 2) + '…';
    return s.slice(0, 4) + '…' + s.slice(-2);
}

function summarize(parsed) {
    let anonymous = 0;
    let hashes = 0;
    let mfa = 0;
    const users = parsed.users || [];
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        if (user.passwordHash) hashes++;
        if (user.multiFactor && user.multiFactor.enrolledFactors && user.multiFactor.enrolledFactors.length) mfa++;
        if (format.isAnonymousRecord(user)) anonymous++;
    }
    const hc = parsed.header && parsed.header.hashConfig;
    return {
        users: users.length,
        anonymous,
        hashes,
        mfa,
        hashConfig: !!(hc && hc.algorithm && hc.signerKey),
        algorithm: hc && hc.algorithm ? String(hc.algorithm) : 'none',
        sampleUids: users.slice(0, 5).map((user) => truncateUid(user.uid)).filter(Boolean),
    };
}

function printSummary(summary, mode, projectId) {
    console.log(mode);
    console.log('Project: ' + projectId);
    console.log('Users: ' + summary.users);
    console.log('Anonymous: ' + summary.anonymous);
    console.log('With password hash: ' + summary.hashes);
    console.log('Hash config inside export: ' + (summary.hashConfig ? 'yes' : 'no'));
    console.log('Hash algorithm: ' + summary.algorithm);
    console.log('MFA enrollments (not restored by importUsers): ' + summary.mfa);
    console.log('Sample uids: ' + (summary.sampleUids.join(', ') || '(none)'));
}

function toImportRecord(user, keepHash) {
    const rec = { uid: user.uid, disabled: user.disabled === true };
    if (user.email) {
        rec.email = user.email;
        rec.emailVerified = user.emailVerified === true;
    }
    if (user.displayName) rec.displayName = user.displayName;
    if (user.photoURL) rec.photoURL = user.photoURL;
    if (user.phoneNumber) rec.phoneNumber = user.phoneNumber;
    if (user.customClaims && typeof user.customClaims === 'object') rec.customClaims = user.customClaims;
    if (user.providerData && user.providerData.length) {
        rec.providerData = user.providerData.filter((p) => p && p.providerId).map((p) => {
            const row = { providerId: p.providerId, uid: p.uid || user.uid };
            if (p.displayName) row.displayName = p.displayName;
            if (p.email) row.email = p.email;
            if (p.photoURL) row.photoURL = p.photoURL;
            if (p.phoneNumber) row.phoneNumber = p.phoneNumber;
            return row;
        });
    }
    if (user.metadata && (user.metadata.creationTime || user.metadata.lastSignInTime)) {
        rec.metadata = {};
        if (user.metadata.creationTime) rec.metadata.creationTime = user.metadata.creationTime;
        if (user.metadata.lastSignInTime) rec.metadata.lastSignInTime = user.metadata.lastSignInTime;
    }
    if (keepHash && user.passwordHash) {
        rec.passwordHash = Buffer.from(user.passwordHash, 'base64');
        if (user.passwordSalt) rec.passwordSalt = Buffer.from(user.passwordSalt, 'base64');
    }
    return rec;
}

function hashOptions(hashConfig) {
    if (!hashConfig || String(hashConfig.algorithm).toUpperCase() !== 'SCRYPT' || !hashConfig.signerKey) {
        return null;
    }
    return {
        hash: {
            algorithm: 'SCRYPT',
            key: Buffer.from(hashConfig.signerKey, 'base64'),
            saltSeparator: Buffer.from(hashConfig.saltSeparator || '', 'base64'),
            rounds: Number(hashConfig.rounds),
            memoryCost: Number(hashConfig.memoryCost),
        },
    };
}

async function applyImport(projectId, parsed) {
    const admin = loadAdmin();
    if (!admin.apps.length) admin.initializeApp({ projectId });
    const options = hashOptions(parsed.header && parsed.header.hashConfig);
    const keepHash = !!options;
    if (!keepHash) {
        console.log('Password hashes will not be imported (SCRYPT parameters are not in this file).');
    }
    let success = 0;
    let failed = 0;
    const users = parsed.users || [];
    for (let offset = 0; offset < users.length; offset += 1000) {
        const batch = users.slice(offset, offset + 1000).map((user) => toImportRecord(user, keepHash));
        const result = await admin.auth().importUsers(batch, options || undefined);
        success += result.successCount || 0;
        failed += result.failureCount || 0;
        const errors = result.errors || [];
        for (let i = 0; i < errors.length; i++) {
            const err = errors[i];
            const index = typeof err.index === 'number' ? err.index + offset : offset;
            console.error('Import error at index ' + index + ': ' + health.sanitizeAlertDetail(err.error && err.error.message ? err.error.message : 'failed'));
        }
    }
    console.log('Imported ' + success + ' users. Failures: ' + failed + '.');
    if (failed) process.exit(1);
}

async function main() {
    const file = argValue('--file');
    const projectId = argValue('--project') || 'bitcoin-education-archive';
    const apply = process.argv.indexOf('--apply') !== -1;
    if (!file) fail('Pass --file path/to/users.jsonl.gz.enc. Add --apply only when you intend to write Auth users.');
    if (!process.env.AUTH_BACKUP_KEY) {
        fail('Set AUTH_BACKUP_KEY in the environment. Do not pass the key as an argument.');
    }
    const enc = fs.readFileSync(file);
    const text = zlib.gunzipSync(crypto.decryptAesGcm(enc, process.env.AUTH_BACKUP_KEY)).toString('utf8');
    const parsed = format.parseJsonl(text);
    const summary = summarize(parsed);
    if (!apply) {
        printSummary(summary, 'DRY RUN — no Auth users will be written.', projectId);
        console.log('Re-run with --apply to import into ' + projectId + '.');
        return;
    }
    printSummary(summary, 'APPLY — importing Auth users.', projectId);
    await applyImport(projectId, parsed);
}

main().catch((err) => {
    console.error(health.sanitizeAlertDetail(err && err.message ? err.message : 'restore failed'));
    process.exit(1);
});
