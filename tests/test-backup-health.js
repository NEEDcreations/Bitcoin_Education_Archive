#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');
const health = require('../functions/src/backupHealth');
const status = require('../functions/src/backupStatus');
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
    const auth = health.assessAuth({
        present: true,
        bytes: 40,
        headerOk: true,
        manifestPresent: true,
        hashConfigIncluded: true,
        passwordUserCount: 5,
        passwordHashCount: 5,
        userCount: 1101,
        previousCount: 1000,
    });
    assert.strictEqual(auth.present, true);
    assert.strictEqual(auth.countOk, false);
    const missing = health.assessAuth({ present: false, bytes: 0, userCount: 10, previousCount: 10 });
    assert.strictEqual(missing.countOk, false);
    const noHeader = health.assessAuth({
        present: true, bytes: 40, headerOk: false, manifestPresent: true,
        hashConfigIncluded: true, passwordUserCount: 0, passwordHashCount: 0, userCount: 10,
    });
    assert.strictEqual(noHeader.countOk, false);
    assert.ok(noHeader.detail.indexOf('not encrypted') !== -1);
    const noConfig = health.assessAuth({
        present: true, bytes: 40, headerOk: true, manifestPresent: true,
        hashConfigIncluded: false, passwordUserCount: 0, passwordHashCount: 0, userCount: 10,
    });
    assert.strictEqual(noConfig.countOk, false);
    assert.ok(noConfig.detail.indexOf('hash config') !== -1);
    const noHashes = health.assessAuth({
        present: true, bytes: 40, headerOk: true, manifestPresent: true,
        hashConfigIncluded: true, passwordUserCount: 4, passwordHashCount: 0, userCount: 10,
    });
    assert.strictEqual(noHashes.countOk, false);
    assert.ok(noHashes.detail.indexOf('password hashes') !== -1);
    const anonymousOnly = health.assessAuth({
        present: true, bytes: 40, headerOk: true, manifestPresent: true,
        hashConfigIncluded: true, passwordUserCount: 0, passwordHashCount: 0,
        userCount: 10, previousCount: null,
    });
    assert.strictEqual(anonymousOnly.countOk, true);
});

test('uploads copy is ok only after SUCCESS or a finished fallback', function () {
    assert.strictEqual(health.assessUploads({ operationStatus: 'SUCCESS' }).ran, true);
    assert.strictEqual(health.assessUploads({ fallbackComplete: true }).ran, true);
    const running = health.assessUploads({ operationStatus: 'IN_PROGRESS' });
    assert.strictEqual(running.ran, false);
    assert.ok(running.detail.indexOf('still running') !== -1);
    assert.strictEqual(health.assessUploads({ operationStatus: 'QUEUED' }).ran, false);
    assert.strictEqual(health.assessUploads({ started: true }).ran, false);
    assert.strictEqual(health.assessUploads({ started: true, unreadable: true }).ran, false);
    assert.strictEqual(health.assessUploads({ statusMissing: true }).ran, false);
    assert.strictEqual(health.assessUploads({ operationStatus: 'FAILED' }).ran, false);
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

test('status details strip emails, IPs, tokens, and long ids', function () {
    const detail = health.sanitizeAlertDetail(
        'failed for user@example.com from 203.0.113.10 and 2001:db8:85a3::8a2e:370:7334 Bearer abc.def-ghi uid abcdefghij1234567890'
    );
    assert.strictEqual(detail.indexOf('user@example.com'), -1);
    assert.strictEqual(detail.indexOf('203.0.113.10'), -1);
    assert.strictEqual(detail.indexOf('2001:db8'), -1);
    assert.strictEqual(detail.indexOf('abc.def-ghi'), -1);
    assert.strictEqual(detail.indexOf('abcdefghij1234567890'), -1);
    assert.ok(detail.indexOf('[redacted-email]') !== -1);
    assert.ok(detail.indexOf('[redacted-ip]') !== -1);
    assert.ok(detail.indexOf('[redacted-id]') !== -1);
    assert.ok(detail.length <= 160);
});

test('function snapshots keep env keys and secret names, not values', function () {
    const clean = health.sanitizeCloudFunction({
        name: 'projects/p/locations/us-central1/functions/nightlyAuthExport',
        state: 'ACTIVE',
        buildConfig: { runtime: 'nodejs22', entryPoint: 'nightlyAuthExport' },
        serviceConfig: {
            availableMemory: '1Gi',
            environmentVariables: { AUTH_BACKUP_KEY: 'super-secret-value', PLAIN: 'nope' },
            secretEnvironmentVariables: [{ key: 'AUTH_BACKUP_KEY', secret: 'AUTH_BACKUP_KEY', version: '1' }],
        },
    });
    assert.deepStrictEqual(clean.envKeys, ['AUTH_BACKUP_KEY', 'PLAIN']);
    assert.deepStrictEqual(clean.secretNames, ['AUTH_BACKUP_KEY']);
    const blob = JSON.stringify(clean);
    assert.strictEqual(blob.indexOf('super-secret-value'), -1);
    assert.strictEqual(blob.indexOf('nope'), -1);
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

test('backup modules do not call chat bridges or send mail', function () {
    const files = [
        'functions/src/nightlyBackup.js',
        'functions/src/backupHealth.js',
        'functions/src/backupStatus.js',
        'functions/src/authBackupCrypto.js',
        'functions/src/authBackupFormat.js',
        'scripts/restore_auth_export.js',
        'scripts/decrypt_auth_export.js',
        'scripts/backup_infra_setup.sh',
    ];
    const nightlySrc = fs.readFileSync(path.join(__dirname, '..', 'functions/src/nightlyBackup.js'), 'utf8');
    const rewrite = nightlySrc.slice(nightlySrc.indexOf('async function rewriteObject'), nightlySrc.indexOf('async function incrementalFallback'));
    assert.strictEqual(rewrite.indexOf('let first'), -1);
    assert.ok(rewrite.indexOf('const body = { metadata: { sourceGeneration:') !== -1);
    files.forEach((rel) => {
        const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
        assert.ok(!/api\.telegram\.org/i.test(src), rel);
        assert.ok(!/discord(?:app)?\.com/i.test(src), rel);
        assert.ok(!/telegramBridge/.test(src), rel);
        assert.ok(!/nodemailer/.test(src), rel);
        assert.ok(!/ALERT_SMTP/.test(src), rel);
        assert.ok(!/smtp\.gmail/.test(src), rel);
        assert.ok(!/backup_alerts/.test(src), rel);
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
    assert.strictEqual(index.indexOf("invoker: 'private'"), -1);
    assert.ok(index.indexOf("serviceAccount: 'bq-auth-backup@bitcoin-education-archive.iam.gserviceaccount.com'") !== -1);
    const sched = index.slice(index.indexOf('function backupSchedule'), index.indexOf('exports.nightlyAuthExport'));
    assert.strictEqual(sched.indexOf('invoker'), -1);
    assert.ok(index.indexOf("secrets: [authBackupKey]") !== -1);
    assert.strictEqual(index.indexOf('ALERT_SMTP'), -1);
    assert.strictEqual(index.indexOf('alertSmtp'), -1);
    assert.strictEqual(index.indexOf('info.603btc@gmail.com'), -1);
    const healthAt = index.indexOf('exports.backupHealthCheck');
    const healthBlock = index.slice(healthAt, index.indexOf('exports.nachoRadioTick'));
    assert.ok(healthBlock.indexOf('checkBackupHealth()') !== -1);
    assert.strictEqual(healthBlock.indexOf('secrets'), -1);
    const marker = index.indexOf('recordFirestoreExportAttempt');
    const thrown = index.indexOf('throw new Error(result.error.message);', marker);
    assert.ok(marker !== -1 && thrown > marker);
    assert.ok(index.indexOf('Could not record export failure') !== -1);
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    assert.strictEqual((rules.match(/match \/\{document=\*\*\}/g) || []).length, 1);
    assert.ok(rules.indexOf('match /backup_status/{docId}') !== -1);
    assert.ok(rules.indexOf('match /backup_history/{docId}') !== -1);
    assert.strictEqual(rules.indexOf('backup_alerts'), -1);
    const statusRule = rules.slice(rules.indexOf('match /backup_status/{docId}'), rules.indexOf('match /backup_history/{docId}'));
    const historyRule = rules.slice(rules.indexOf('match /backup_history/{docId}'), rules.indexOf('match /{document=**}'));
    assert.ok(/allow read, write: if false;/.test(statusRule));
    assert.ok(/allow read, write: if false;/.test(historyRule));
});

test('restore stays a dry run unless --apply is an explicit flag', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts/restore_auth_export.js'), 'utf8');
    assert.ok(src.indexOf("process.argv.indexOf('--apply')") !== -1);
    assert.ok(src.indexOf('DRY RUN') !== -1);
    assert.ok(src.indexOf('AUTH_BACKUP_KEY') !== -1);
    assert.ok(!/process\.argv.*AUTH_BACKUP_KEY/.test(src));
    assert.ok(src.indexOf('function truncateUid') !== -1);
    const key = crypto.parseBackupKey(Buffer.from('0123456789abcdef0123456789abcdef').toString('base64'));
    const uid = 'abcdefghijklmnopqrstuvwxyz12';
    const header = {
        exportedAt: '2026-10-24T02:30:00.000Z',
        projectId: 'bitcoin-education-archive',
        userCount: 1,
        hashConfig: null,
    };
    const user = format.serializeAuthUser({ uid: uid, email: 'person@example.com', providerData: [] });
    const enc = crypto.encryptAesGcm(zlib.gzipSync(Buffer.from(format.buildJsonl(header, [user]))), key);
    const file = path.join('/tmp', 'auth-restore-sample.jsonl.gz.enc');
    fs.writeFileSync(file, enc);
    try {
        const out = execFileSync('node', [path.join(__dirname, '..', 'scripts/restore_auth_export.js'), '--file', file], {
            encoding: 'utf8',
            env: Object.assign({}, process.env, { AUTH_BACKUP_KEY: key.toString('base64') }),
        });
        assert.strictEqual(out.indexOf(uid), -1);
        assert.ok(out.indexOf('abcd…12') !== -1);
        assert.ok(out.indexOf('DRY RUN') !== -1);
    } finally {
        fs.unlinkSync(file);
    }
});

test('infra setup prints the plan unless --apply is passed', function () {
    const script = path.join(__dirname, '..', 'scripts/backup_infra_setup.sh');
    const src = fs.readFileSync(script, 'utf8');
    assert.ok(src.indexOf('--apply') !== -1);
    assert.ok(src.indexOf('--owner-apply') !== -1);
    assert.ok(src.indexOf('--soft-delete-duration=0') !== -1);
    assert.ok(src.indexOf('projectEditor:') !== -1);
    assert.ok(src.indexOf('projectOwner:') !== -1);
    assert.ok(src.indexOf('projectViewer:') !== -1);
    assert.ok(src.indexOf('Cloud Shell') !== -1);
    assert.ok(src.indexOf('secrets versions access latest') !== -1);
    assert.ok(src.indexOf('cannot download auth backups') !== -1);
    assert.strictEqual(src.indexOf('already covers Phil'), -1);
    assert.ok(src.indexOf('expireAt') !== -1);
    assert.ok(src.indexOf('backup_history') !== -1);
    assert.ok(src.indexOf('AUTH_BACKUP_KEY') !== -1);
    assert.ok(src.indexOf('cloudfunctions.googleapis.com') !== -1);
    assert.ok(src.indexOf('storagetransfer.googleapis.com') !== -1);
    assert.ok(src.indexOf('firebaseauth.configs.getHashConfig') !== -1);
    assert.ok(src.indexOf('bq-auth-backup@') !== -1);
    assert.ok(src.indexOf('roles/storage.objectCreator') !== -1);
    assert.ok(src.indexOf('daysSinceNoncurrentTime": 1') !== -1);
    assert.strictEqual(src.indexOf('roles/cloudfunctions.viewer'), -1);
    assert.strictEqual(src.indexOf('roles/datastore.importExportAdmin'), -1);
    assert.strictEqual(src.indexOf('roles/datastore.viewer'), -1);
    assert.strictEqual(src.indexOf('roles/datastore.user'), -1);
    assert.strictEqual(src.indexOf('roles/firebaserules.viewer'), -1);
    assert.strictEqual(src.indexOf('roles/cloudscheduler.viewer'), -1);
    assert.strictEqual(src.indexOf('roles/storagetransfer.user'), -1);
    assert.strictEqual(src.indexOf('gcf-admin-robot'), -1);
    assert.strictEqual(src.indexOf('functions:secrets:set'), -1);
    assert.strictEqual(src.indexOf('ALERT_SMTP'), -1);
    assert.strictEqual(src.indexOf('firebaseauth.admin'), -1);
    assert.strictEqual(src.indexOf('firebaseauth.viewer'), -1);
    assert.strictEqual(src.indexOf('roles/storage.objectUser'), -1);
    assert.strictEqual(src.indexOf('"roles/storage.admin"'), -1);
    const out = execFileSync('bash', [script], { encoding: 'utf8' });
    assert.ok(out.indexOf('WOULD') !== -1);
    assert.ok(out.indexOf('Dry run only') !== -1);
    assert.ok(out.indexOf('Cloud Shell') !== -1);
    assert.ok(out.indexOf('secrets versions access latest') !== -1);
    assert.ok(out.indexOf('\n  clear\n') !== -1);
    assert.strictEqual(out.indexOf('APPLY:'), -1);
    assert.strictEqual(out.indexOf('OWNER:'), -1);
    assert.strictEqual(out.indexOf('ALERT_SMTP'), -1);
    let rejected = false;
    try {
        execFileSync('bash', [script, '--apply-not-really'], { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
        rejected = e.status === 2;
    }
    assert.strictEqual(rejected, true);
});

test('auth export skips its own status write and the key comment stays off the Firebase CLI', function () {
    const nightly = fs.readFileSync(path.join(__dirname, '..', 'functions/src/nightlyBackup.js'), 'utf8');
    const start = nightly.indexOf('async function exportAuthUsers');
    const end = nightly.indexOf('async function runAuthExport');
    assert.ok(start !== -1 && end > start);
    const fn = nightly.slice(start, end);
    assert.strictEqual(fn.indexOf('recordJob'), -1);
    assert.strictEqual(fn.indexOf('writeBackupResult'), -1);
    assert.ok(nightly.indexOf('writeBackupResults') !== -1);
    const cryptoSrc = fs.readFileSync(path.join(__dirname, '..', 'functions/src/authBackupCrypto.js'), 'utf8');
    assert.strictEqual(cryptoSrc.indexOf('functions:secrets:set'), -1);
    assert.ok(cryptoSrc.indexOf('Cloud Shell') !== -1);
    const restore = fs.readFileSync(path.join(__dirname, '..', 'scripts/restore_auth_export.js'), 'utf8');
    assert.strictEqual(restore.indexOf('Create AUTH_BACKUP_KEY with scripts/backup_infra_setup.sh'), -1);
    assert.ok(restore.indexOf('empty AUTH_BACKUP_KEY secret') !== -1);
    assert.ok(restore.indexOf('secrets versions access latest') !== -1);
    assert.ok(restore.indexOf('roles/storage.objectViewer') !== -1);
});

test('a permission error is not treated as a missing bucket binding', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts/backup_infra_setup.sh'), 'utf8');
    const start = src.indexOf('binding_is_missing() {');
    const end = src.indexOf('\nremove_bucket_binding()', start);
    assert.ok(start !== -1 && end > start);
    const fn = src.slice(start, end);
    const success = fn.slice(fn.lastIndexOf('printf'));
    assert.strictEqual(success.indexOf('does not have'), -1);
    function missing(message) {
        const script = fn + '\nif binding_is_missing ' + JSON.stringify(message) + '; then exit 0; else exit 3; fi\n';
        try {
            execFileSync('bash', ['-c', script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
            return true;
        } catch (e) {
            assert.strictEqual(e.status, 3);
            return false;
        }
    }
    assert.strictEqual(missing('Policy binding was not found'), true);
    assert.strictEqual(missing('ERROR: does not have storage.buckets.setIamPolicy access'), false);
    assert.strictEqual(missing('403 PERMISSION_DENIED: The specified object was not found'), false);
});

test('auth bucket policy check rejects project editors and extra function roles', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts/backup_infra_setup.sh'), 'utf8');
    const marker = "<<'AUTH_POLICY_PY'";
    const start = src.indexOf(marker);
    const end = src.indexOf('\nAUTH_POLICY_PY\n', start);
    assert.ok(start !== -1 && end > start);
    const py = src.slice(start + marker.length + 1, end);
    const sa = '123-compute@developer.gserviceaccount.com';
    function run(policy) {
        try {
            execFileSync('python3', ['-c', py], {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
                env: Object.assign({}, process.env, {
                    POLICY_JSON: JSON.stringify(policy),
                    ASSERT_PROJECT: 'bitcoin-education-archive',
                    ASSERT_FUNCTIONS_SA: sa,
                }),
            });
            return 0;
        } catch (e) {
            return e.status;
        }
    }
    const member = 'serviceAccount:' + sa;
    const read = [
        { role: 'roles/storage.objectViewer', members: [member] },
        { role: 'roles/storage.legacyBucketReader', members: [member] },
    ];
    assert.strictEqual(run({ bindings: read }), 0);
    assert.strictEqual(run({ bindings: read.concat([{ role: 'roles/storage.legacyBucketOwner', members: ['projectEditor:bitcoin-education-archive'] }]) }), 1);
    assert.strictEqual(run({ bindings: read.concat([{ role: 'roles/storage.legacyBucketOwner', members: ['projectOwner:bitcoin-education-archive'] }]) }), 1);
    assert.strictEqual(run({ bindings: read.concat([{ role: 'roles/storage.legacyBucketReader', members: ['projectViewer:bitcoin-education-archive'] }]) }), 1);
    assert.strictEqual(run({ bindings: read.concat([{ role: 'roles/storage.objectAdmin', members: [member] }]) }), 1);
    assert.strictEqual(run({ bindings: [read[0]] }), 1);
});

function fakeDb() {
    const docs = {};
    function ref(docPath) {
        return { path: docPath };
    }
    return {
        docs: docs,
        db: {
            collection: function (name) {
                return {
                    doc: function (id) { return ref(name + '/' + id); },
                };
            },
            runTransaction: async function (fn) {
                const tx = {
                    get: async function (target) {
                        const data = docs[target.path];
                        return {
                            exists: !!data,
                            data: function () { return data ? JSON.parse(JSON.stringify(data)) : undefined; },
                        };
                    },
                    set: function (target, value) {
                        docs[target.path] = JSON.parse(JSON.stringify(value));
                    },
                };
                await fn(tx);
            },
        },
    };
}

const adminStub = {
    firestore: {
        Timestamp: {
            fromDate: function (d) {
                return { seconds: Math.floor(d.getTime() / 1000), toDate: function () { return d; } };
            },
        },
    },
};

function historyRows(docs) {
    return Object.keys(docs).filter((key) => key.indexOf('backup_history/') === 0).map((key) => docs[key]);
}

async function testAsync(name, fn) {
    try {
        await fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
    }
}

(async function () {
    await testAsync('a successful run writes latest ok and four history rows', async function () {
        const finishedAt = '2026-10-24T05:00:00.000Z';
        const store = fakeDb();
        const events = status.JOB_NAMES.map((job) => ({
            job: job,
            date: '2026-10-24',
            ok: true,
            startedAt: '2026-10-24T02:00:00.000Z',
            finishedAt: finishedAt,
            verifiedAt: finishedAt,
            detail: job + ' ok',
        }));
        const ids = await status.writeBackupResults(store.db, adminStub, events, finishedAt);
        assert.strictEqual(ids.length, 4);
        const latest = store.docs['backup_status/latest'];
        assert.deepStrictEqual(Object.keys(latest).sort(), ['date', 'detail', 'jobs', 'ok', 'updatedAt', 'verifiedAt']);
        assert.strictEqual(latest.verifiedAt, finishedAt);
        assert.strictEqual(latest.ok, true);
        assert.strictEqual(latest.date, '2026-10-24');
        assert.strictEqual(latest.updatedAt, finishedAt);
        assert.strictEqual(latest.detail, 'all checks passed');
        status.JOB_NAMES.forEach((job) => {
            assert.deepStrictEqual(Object.keys(latest.jobs[job]).sort(), ['detail', 'finishedAt', 'ok', 'startedAt']);
            assert.strictEqual(latest.jobs[job].ok, true);
            assert.strictEqual(latest.jobs[job].startedAt, '2026-10-24T02:00:00.000Z');
            assert.strictEqual(latest.jobs[job].finishedAt, finishedAt);
            assert.strictEqual(latest.jobs[job].detail, job + ' ok');
        });
        const rows = historyRows(store.docs);
        assert.strictEqual(rows.length, 4);
        const expectExpire = Math.floor(Date.parse(finishedAt) / 1000) + (90 * 24 * 60 * 60);
        rows.forEach((row) => {
            assert.deepStrictEqual(Object.keys(row).sort(), ['date', 'detail', 'expireAt', 'finishedAt', 'job', 'ok', 'runId', 'startedAt']);
            assert.strictEqual(row.ok, true);
            assert.strictEqual(row.date, '2026-10-24');
            assert.strictEqual(row.expireAt.seconds, expectExpire);
        });
    });

    await testAsync('a failed run still writes history and redacts the detail', async function () {
        const store = fakeDb();
        const dirty = 'failed for phil@example.com from 203.0.113.9 uid abcdefghij1234567890 and 2001:db8::1 Bearer abc.def';
        const runId = await status.writeBackupResult(store.db, adminStub, {
            job: 'auth',
            date: '2026-10-24',
            ok: false,
            startedAt: '2026-10-24T02:30:00.000Z',
            finishedAt: '2026-10-24T02:31:00.000Z',
            detail: dirty,
        });
        assert.ok(runId.indexOf('auth-') === 0);
        const latest = store.docs['backup_status/latest'];
        assert.strictEqual(latest.ok, false);
        assert.strictEqual(latest.detail, 'failed: firestore, auth, uploads, config');
        assert.strictEqual(latest.jobs.auth.ok, false);
        assert.strictEqual(latest.jobs.auth.detail.indexOf('phil@example.com'), -1);
        assert.strictEqual(latest.jobs.auth.detail.indexOf('203.0.113.9'), -1);
        assert.strictEqual(latest.jobs.auth.detail.indexOf('2001:db8'), -1);
        assert.strictEqual(latest.jobs.auth.detail.indexOf('abcdefghij1234567890'), -1);
        assert.ok(latest.jobs.auth.detail.indexOf('[redacted-email]') !== -1);
        const rows = historyRows(store.docs);
        assert.strictEqual(rows.length, 1);
        assert.strictEqual(rows[0].ok, false);
        assert.strictEqual(rows[0].runId, runId);
        assert.strictEqual(rows[0].detail.indexOf('phil@example.com'), -1);
        assert.ok(rows[0].expireAt.seconds > Math.floor(Date.parse('2026-10-24T02:31:00.000Z') / 1000));
        const blob = JSON.stringify(store.docs);
        assert.strictEqual(blob.indexOf('phil@example.com'), -1);
        assert.strictEqual(blob.indexOf('203.0.113.9'), -1);
        assert.strictEqual(blob.indexOf('abcdefghij1234567890'), -1);
    });

    await testAsync('a new UTC date drops the previous day jobs', async function () {
        const store = fakeDb();
        await status.writeBackupResults(store.db, adminStub, status.JOB_NAMES.map((job) => ({
            job: job,
            date: '2026-10-24',
            ok: true,
            startedAt: '2026-10-24T02:00:00.000Z',
            finishedAt: '2026-10-24T05:00:00.000Z',
            detail: 'ok',
        })));
        await status.writeBackupResult(store.db, adminStub, {
            job: 'firestore',
            date: '2026-10-25',
            ok: false,
            startedAt: '2026-10-25T02:00:00.000Z',
            finishedAt: '2026-10-25T02:00:05.000Z',
            detail: 'Firestore export started',
        });
        const latest = store.docs['backup_status/latest'];
        assert.strictEqual(latest.date, '2026-10-25');
        assert.strictEqual(latest.ok, false);
        assert.deepStrictEqual(Object.keys(latest.jobs), ['firestore']);
        assert.strictEqual(historyRows(store.docs).length, 5);
    });

    await testAsync('overall ok requires today, a post-05:00 verification, and four jobs', async function () {
        const day = '2026-10-24';
        const finishedAt = day + 'T05:00:00.000Z';
        function jobs(verifiedAt) {
            return status.JOB_NAMES.map((job) => ({
                job: job,
                date: day,
                ok: true,
                startedAt: day + 'T02:00:00.000Z',
                finishedAt: finishedAt,
                verifiedAt: verifiedAt,
                detail: 'ok',
            }));
        }
        const early = fakeDb();
        await status.writeBackupResults(early.db, adminStub, jobs(null), day + 'T04:59:00.000Z');
        assert.strictEqual(early.docs['backup_status/latest'].ok, false);
        assert.strictEqual(early.docs['backup_status/latest'].verifiedAt, null);
        assert.strictEqual(early.docs['backup_status/latest'].detail, 'not verified after 05:00 UTC');
        const verified = fakeDb();
        await status.writeBackupResults(verified.db, adminStub, jobs(finishedAt), finishedAt);
        assert.strictEqual(verified.docs['backup_status/latest'].ok, true);
        assert.strictEqual(verified.docs['backup_status/latest'].verifiedAt, finishedAt);
        const stale = fakeDb();
        await status.writeBackupResults(stale.db, adminStub, jobs(finishedAt), '2026-10-25T06:00:00.000Z');
        assert.strictEqual(stale.docs['backup_status/latest'].ok, false);
        assert.strictEqual(stale.docs['backup_status/latest'].detail, 'status is not for today');
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})();
