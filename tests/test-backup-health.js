#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const health = require('../functions/src/backupHealth');
const crypto = require('../functions/src/authBackupCrypto');
const format = require('../functions/src/authBackupFormat');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

function healthyReport() {
    return {
        firestore: { succeeded: true, folderPresent: true, detail: 'ok' },
        auth: { present: true, countOk: true, detail: 'ok' },
        uploads: { ran: true, detail: 'ok' },
        config: { present: true, detail: 'ok' },
    };
}

test('a healthy report has no failures', function () {
    const verdict = health.evaluateBackupHealth(healthyReport());
    assert.strictEqual(verdict.ok, true);
    assert.deepStrictEqual(verdict.failures, []);
});

test('each failed check is named', function () {
    const report = healthyReport();
    report.firestore = { succeeded: false, folderPresent: false, detail: 'Firestore export folder is missing' };
    report.auth = { present: false, countOk: false, detail: 'auth export object is missing' };
    report.uploads = { ran: false, detail: 'uploads copy did not run' };
    report.config = { present: false, detail: 'config snapshot missing firestore-rules.json' };
    const verdict = health.evaluateBackupHealth(report);
    assert.strictEqual(verdict.ok, false);
    assert.deepStrictEqual(verdict.failures.map((f) => f.check), ['firestore', 'auth', 'uploads', 'config']);
});

test('firestore success needs a finished export and a folder', function () {
    assert.strictEqual(health.assessFirestore({
        operationDone: true,
        objectCount: 3,
    }).succeeded, true);
    const empty = health.assessFirestore({ operationDone: true, objectCount: 0 });
    assert.strictEqual(empty.succeeded, false);
    assert.strictEqual(empty.folderPresent, false);
    const running = health.assessFirestore({ operationDone: false, objectCount: 2 });
    assert.strictEqual(running.succeeded, false);
    assert.strictEqual(running.folderPresent, true);
    const marker = health.assessFirestore({ markerError: 'denied', objectCount: 0 });
    assert.strictEqual(marker.succeeded, false);
    const metadata = health.assessFirestore({ sawMetadata: true, objectCount: 4 });
    assert.strictEqual(metadata.succeeded, true);
    assert.strictEqual(metadata.folderPresent, true);
});

test('user count stays inside 10 percent of the previous export', function () {
    assert.strictEqual(health.compareUserCount(1100, 1000).ok, true);
    assert.strictEqual(health.compareUserCount(900, 1000).ok, true);
    assert.strictEqual(health.compareUserCount(1101, 1000).ok, false);
    assert.strictEqual(health.compareUserCount(899, 1000).ok, false);
    assert.strictEqual(health.compareUserCount(25000, null).ok, true);
    assert.strictEqual(health.compareUserCount(25000, 0).ok, true);
    assert.strictEqual(health.compareUserCount(0, 25000).ok, false);
    assert.strictEqual(health.compareUserCount(undefined, 10).ok, false);
    const auth = health.assessAuth({ present: true, bytes: 40, userCount: 1101, previousCount: 1000 });
    assert.strictEqual(auth.present, true);
    assert.strictEqual(auth.countOk, false);
    const missing = health.assessAuth({ present: false, bytes: 0, userCount: 10, previousCount: 10 });
    assert.strictEqual(missing.countOk, false);
});

test('uploads copy counts a started transfer and rejects a failed one', function () {
    assert.strictEqual(health.assessUploads({ started: true, operationStatus: 'SUCCESS' }).ran, true);
    assert.strictEqual(health.assessUploads({ started: true, operationStatus: 'IN_PROGRESS' }).ran, true);
    assert.strictEqual(health.assessUploads({ started: true, operationStatus: 'QUEUED' }).ran, true);
    assert.strictEqual(health.assessUploads({ started: true }).ran, true);
    assert.strictEqual(health.assessUploads({ fallbackComplete: true }).ran, true);
    assert.strictEqual(health.assessUploads({ started: true, operationStatus: 'FAILED' }).ran, false);
    assert.strictEqual(health.assessUploads({ operationError: 'boom' }).ran, false);
    assert.strictEqual(health.assessUploads({}).ran, false);
});

test('config snapshot requires every file', function () {
    const missing = health.missingConfigFiles(['firestore-rules.json', 'storage-rules.json']);
    assert.ok(missing.indexOf('firestore-indexes.json') !== -1);
    assert.ok(missing.indexOf('scheduler-jobs.json') !== -1);
    assert.strictEqual(health.assessConfig(health.CONFIG_OBJECT_NAMES).present, true);
    assert.strictEqual(health.assessConfig(['firestore-rules.json']).present, false);
});

test('dedupe sends one alert and blocks the rest of the day', function () {
    const failures = [{ check: 'firestore', detail: 'missing' }];
    const now = 1_000_000;
    let state = null;
    let first = health.reduceDedupe(state, { type: 'reserve', failures }, now);
    state = first.state;
    assert.strictEqual(first.decision.send, true);
    assert.strictEqual(first.decision.reason, 'reserved');
    const held = health.reduceDedupe(state, { type: 'reserve', failures }, now + 1000);
    assert.strictEqual(held.decision.send, false);
    assert.strictEqual(held.decision.reason, 'lease-held');
    state = health.reduceDedupe(state, { type: 'sent' }, now + 2000).state;
    const again = health.reduceDedupe(state, { type: 'reserve', failures }, now + health.ALERT_LEASE_MS + 10);
    assert.strictEqual(again.decision.send, false);
    assert.strictEqual(again.decision.reason, 'already-sent');
    assert.strictEqual(health.decideAlert([], state, now).reason, 'healthy');
});

test('a failed send releases the lease so the same day can retry', function () {
    const failures = [{ check: 'auth', detail: 'missing' }];
    const now = 5_000;
    let state = health.reduceDedupe(null, { type: 'reserve', failures }, now).state;
    state = health.reduceDedupe(state, { type: 'release' }, now + 50).state;
    const retry = health.reduceDedupe(state, { type: 'reserve', failures }, now + 60);
    assert.strictEqual(retry.decision.send, true);
    assert.strictEqual(state.sent, false);
});

test('alert text names the check and strips emails, IPs, and tokens', function () {
    const body = health.buildAlertBody({
        date: '2026-10-24',
        checkedAt: '2026-10-24T05:00:00.000Z',
        failures: [{
            check: 'auth',
            detail: 'failed for user@example.com from 203.0.113.10 and 2001:db8:85a3::8a2e:370:7334 Bearer abc.def-ghi',
        }],
    });
    assert.ok(body.indexOf('Backup date: 2026-10-24') !== -1);
    assert.ok(body.indexOf('Checked at: 2026-10-24T05:00:00.000Z') !== -1);
    assert.ok(body.indexOf('- auth:') !== -1);
    assert.strictEqual(body.indexOf('user@example.com'), -1);
    assert.strictEqual(body.indexOf('203.0.113.10'), -1);
    assert.strictEqual(body.indexOf('2001:db8'), -1);
    assert.strictEqual(body.indexOf('abc.def-ghi'), -1);
    assert.ok(body.indexOf('[redacted-email]') !== -1);
    assert.ok(body.indexOf('[redacted-ip]') !== -1);
    assert.strictEqual(body.indexOf(health.ALERT_EMAIL), -1);
});

test('scheduler snapshots drop header secrets and query strings', function () {
    const job = health.sanitizeSchedulerJob({
        name: 'projects/p/locations/us-central1/jobs/nightly',
        httpTarget: {
            uri: 'https://example.cloudfunctions.net/backupHealthCheck?token=secret',
            headers: { Authorization: 'Bearer abc', 'Content-Type': 'application/json' },
            oauthToken: { serviceAccountEmail: 'fn@project.iam.gserviceaccount.com', accessToken: 'nope' },
        },
    });
    assert.strictEqual(job.httpTarget.uri, 'https://example.cloudfunctions.net/backupHealthCheck');
    assert.strictEqual(job.httpTarget.headers.Authorization, undefined);
    assert.strictEqual(job.httpTarget.headers['Content-Type'], 'application/json');
    assert.strictEqual(job.httpTarget.oauthToken.accessToken, undefined);
    assert.strictEqual(job.httpTarget.oauthToken.serviceAccountEmail, 'fn@project.iam.gserviceaccount.com');
});

test('auth export round-trips and keeps hashes only when present', function () {
    const anon = format.serializeAuthUser({
        uid: 'anon1',
        emailVerified: false,
        disabled: false,
        metadata: { creationTime: '2026-01-01T00:00:00.000Z', lastSignInTime: null },
        providerData: [],
    });
    assert.strictEqual(anon.passwordHash, undefined);
    assert.strictEqual(format.isAnonymousRecord(anon), true);
    const password = format.serializeAuthUser({
        toJSON: function () {
            return {
                uid: 'user1',
                email: 'person@example.com',
                emailVerified: true,
                providerData: [{ uid: 'person@example.com', providerId: 'password', email: 'person@example.com' }],
                customClaims: { admin: false },
                passwordHash: 'aGFzaA==',
                passwordSalt: 'c2FsdA==',
                metadata: { creationTime: '2026-01-02T00:00:00.000Z', lastSignInTime: '2026-02-02T00:00:00.000Z' },
            };
        },
    });
    assert.strictEqual(password.passwordHash, 'aGFzaA==');
    assert.strictEqual(password.passwordSalt, 'c2FsdA==');
    assert.strictEqual(password.providerData[0].providerId, 'password');
    assert.deepStrictEqual(password.customClaims, { admin: false });
    const header = {
        exportedAt: '2026-10-24T02:30:00.000Z',
        projectId: 'bitcoin-education-archive',
        userCount: 2,
        hashConfig: format.pickHashConfig({
            signIn: { hashConfig: { algorithm: 'SCRYPT', signerKey: 'c2lnbmVy', saltSeparator: 'cw==', rounds: 8, memoryCost: 14 } },
        }),
    };
    assert.ok(header.hashConfig.signerKey);
    assert.strictEqual(format.pickHashConfig({ signIn: { hashConfig: { algorithm: 'SCRYPT' } } }), null);
    const key = crypto.parseBackupKey(Buffer.from('0123456789abcdef0123456789abcdef').toString('base64'));
    const enc = crypto.encryptAesGcm(zlib.gzipSync(Buffer.from(format.buildJsonl(header, [anon, password]))), key);
    const parsed = format.parseJsonl(zlib.gunzipSync(crypto.decryptAesGcm(enc, key)).toString('utf8'));
    assert.strictEqual(parsed.users.length, 2);
    assert.strictEqual(parsed.users[1].email, 'person@example.com');
    assert.strictEqual(parsed.header.hashConfig.algorithm, 'SCRYPT');
    const hex = key.toString('hex');
    assert.strictEqual(crypto.parseBackupKey(hex).equals(key), true);
    assert.throws(() => crypto.parseBackupKey('too-short'), /32 bytes/);
    assert.throws(() => crypto.decryptAesGcm(enc, Buffer.alloc(32, 7)), /bad header|unable to authenticate|Unsupported state|auth/i);
    const tampered = Buffer.from(enc);
    tampered[tampered.length - 1] ^= 1;
    assert.throws(() => crypto.decryptAesGcm(tampered, key));
});

test('backup modules do not call chat bridges', function () {
    const files = [
        'functions/src/nightlyBackup.js',
        'functions/src/backupHealth.js',
        'functions/src/authBackupCrypto.js',
        'functions/src/authBackupFormat.js',
        'scripts/restore_auth_export.js',
        'scripts/decrypt_auth_export.js',
    ];
    files.forEach((rel) => {
        const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
        assert.ok(!/api\.telegram\.org/i.test(src), rel);
        assert.ok(!/discord(?:app)?\.com/i.test(src), rel);
        assert.ok(!/telegramBridge/.test(src), rel);
    });
    const index = fs.readFileSync(path.join(__dirname, '..', 'functions/index.js'), 'utf8');
    assert.ok(index.indexOf("onSchedule('0 2 * * *'") !== -1);
    assert.ok(index.indexOf('exportDocuments') !== -1);
    assert.ok(index.indexOf("backupSchedule('30 2 * * *'") !== -1);
    assert.ok(index.indexOf("backupSchedule('0 3 * * *'") !== -1);
    assert.ok(index.indexOf("backupSchedule('30 3 * * *'") !== -1);
    assert.ok(index.indexOf("backupSchedule('0 5 * * *'") !== -1);
    assert.ok(index.indexOf('exports.nightlyAuthExport') !== -1);
    assert.ok(index.indexOf('exports.nightlyUploadsCopy') !== -1);
    assert.ok(index.indexOf('exports.nightlyConfigSnapshot') !== -1);
    assert.ok(index.indexOf('exports.backupHealthCheck') !== -1);
    assert.ok(index.indexOf("invoker: 'private'") !== -1);
    assert.strictEqual(health.ALERT_EMAIL, 'info.603btc@gmail.com');
    const marker = index.indexOf('recordFirestoreExportAttempt');
    const thrown = index.indexOf('throw new Error(result.error.message);', marker);
    assert.ok(marker !== -1 && thrown > marker);
    assert.ok(index.indexOf('Could not record export failure') !== -1);
});

test('restore stays a dry run unless --apply is an explicit flag', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts/restore_auth_export.js'), 'utf8');
    assert.ok(src.indexOf("process.argv.indexOf('--apply')") !== -1);
    assert.ok(src.indexOf('DRY RUN') !== -1);
    assert.ok(src.indexOf('AUTH_BACKUP_KEY') !== -1);
    assert.ok(!/process\.argv.*AUTH_BACKUP_KEY/.test(src));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
