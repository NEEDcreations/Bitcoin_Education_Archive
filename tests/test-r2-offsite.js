#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');
const { execFileSync } = require('child_process');
const health = require('../functions/src/backupHealth');
const status = require('../functions/src/backupStatus');
const seal = require('../functions/src/r2BackupCrypto');
const r2 = require('../functions/src/r2Offsite');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
    }
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

function key32() {
    return crypto.randomBytes(32);
}

function collect() {
    const chunks = [];
    const sink = new Transform({
        transform(chunk, enc, cb) {
            chunks.push(Buffer.from(chunk));
            cb();
        },
    });
    return { sink: sink, chunks: chunks };
}

function configNames(date) {
    return health.CONFIG_OBJECT_NAMES.map((name) => 'config/' + date + '/' + name);
}

function completeFound(date) {
    return {
        firestore: [
            date + '/all_namespaces/all_kinds/output-0',
            date + '/' + date + '.overall_export_metadata',
        ],
        auth: ['auth/' + date + '/users.jsonl.gz.enc', 'auth/' + date + '/manifest.json'],
        config: configNames(date),
        uploads: [{ name: 'beats/a.mp3', generation: '17', md5: 'abc', size: 5 }],
    };
}

function fakeDb() {
    const docs = {};
    function ref(docPath) {
        return { path: docPath };
    }
    return {
        docs: docs,
        db: {
            collection: function (name) {
                return { doc: function (id) { return ref(name + '/' + id); } };
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

function verifiedEvents(day, finishedAt) {
    return status.JOB_NAMES.map((job) => ({
        job: job,
        date: day,
        ok: true,
        startedAt: day + 'T02:00:00.000Z',
        finishedAt: finishedAt,
        verifiedAt: finishedAt,
        detail: job + ' ok',
    }));
}

function historyRows(docs) {
    return Object.keys(docs).filter((key) => key.indexOf('backup_history/') === 0).map((key) => docs[key]);
}


test('the night plan requires every backup and names ciphertext keys', function () {
    const date = '2026-10-24';
    const missing = r2.planNight(date, {
        firestore: [date + '/all_namespaces/all_kinds/output-0'],
        auth: ['auth/' + date + '/users.jsonl.gz.enc'],
        config: ['config/' + date + '/firestore-rules.json'],
        uploads: [],
    });
    assert.strictEqual(missing.ok, false);
    assert.ok(missing.missing.indexOf('firestore export metadata is missing') !== -1);
    assert.ok(missing.missing.indexOf('auth export is missing') !== -1);
    assert.ok(missing.missing.indexOf('config snapshot is missing') !== -1);
    assert.ok(missing.missing.indexOf('uploads backup is missing') !== -1);
    assert.strictEqual(missing.uploads.some((item) => item.group === 'firestore'), false);
    const plan = r2.planNight(date, completeFound(date));
    assert.strictEqual(plan.ok, true);
    assert.strictEqual(plan.missing.length, 0);
    const dests = plan.uploads.map((item) => item.dest);
    assert.ok(dests.indexOf(date + '/firestore/all_namespaces/all_kinds/output-0') !== -1);
    assert.ok(dests.indexOf(date + '/auth/users.jsonl.gz.enc') !== -1);
    assert.ok(dests.indexOf(date + '/auth/manifest.json') !== -1);
    assert.ok(dests.indexOf(date + '/config/firestore-rules.json') !== -1);
    assert.ok(dests.indexOf('uploads/beats/a.mp3#17') !== -1);
    assert.ok(dests.indexOf(date + '/uploads-manifest.json') !== -1);
    assert.strictEqual(dests.indexOf(date + '/uploads/beats/a.mp3'), -1);
    const manifest = plan.uploads.filter((item) => item.group === 'manifest')[0];
    const listed = JSON.parse(manifest.body.toString('utf8'));
    assert.strictEqual(listed.objects[0].dest, 'uploads/beats/a.mp3#17');
    assert.strictEqual(listed.objects[0].generation, '17');
    assert.strictEqual(listed.objects[0].bytes, 5);
    const changed = r2.planNight(date, {
        firestore: completeFound(date).firestore,
        auth: completeFound(date).auth,
        config: completeFound(date).config,
        uploads: [{ name: 'beats/a.mp3', generation: '18', md5: 'def', size: 9 }],
    });
    assert.ok(changed.uploads.some((item) => item.dest === 'uploads/beats/a.mp3#18'));
    assert.deepStrictEqual(
        r2.unreferencedUploads(['uploads/beats/a.mp3#17', 'uploads/beats/a.mp3#18', date + '/firestore/a'], ['uploads/beats/a.mp3#18']),
        ['uploads/beats/a.mp3#17']
    );
});

test('objects older than 90 days are deleted and a 90 day old key is kept', function () {
    const today = '2026-10-24';
    const cutoff = health.addUtcDays(today, -90);
    const older = health.addUtcDays(cutoff, -1);
    const old = r2.keysOlderThan([
        cutoff + '/firestore/a',
        older + '/auth/users.jsonl.gz.enc',
        today + '/config/firestore-rules.json',
        'uploads/beats/a.mp3#17',
        'notes.txt',
    ], today, 90);
    assert.deepStrictEqual(old, [older + '/auth/users.jsonl.gz.enc']);
    assert.strictEqual(r2.DELETE_AFTER_DAYS, 90);
});

test('the account id is checked without echoing a bad value', function () {
    assert.throws(() => r2.r2Endpoint('not an id'), (err) => {
        assert.strictEqual(err.message, 'R2 account id is not usable');
        assert.strictEqual(err.message.indexOf('not an id'), -1);
        return true;
    });
    assert.deepStrictEqual(r2.r2Endpoint('abc123'), {
        id: 'abc123',
        endpoint: 'https://abc123.r2.cloudflarestorage.com',
    });
});

test('nightlyR2Copy is scheduled with the five secrets and the copy account', function () {
    const index = fs.readFileSync(path.join(__dirname, '..', 'functions/index.js'), 'utf8');
    const start = index.indexOf('exports.nightlyR2Copy');
    const end = index.indexOf('exports.backupHealthCheck');
    assert.ok(start !== -1 && end > start);
    const block = index.slice(start, end);
    assert.ok(block.indexOf("backupSchedule('45 4 * * *'") !== -1);
    assert.ok(block.indexOf("serviceAccount: 'bq-r2-copy@bitcoin-education-archive.iam.gserviceaccount.com'") !== -1);
    assert.ok(block.indexOf('timeoutSeconds: 1800') !== -1);
    assert.ok(block.indexOf("memory: '1GiB'") !== -1);
    assert.ok(block.indexOf('r2AccountId') !== -1);
    assert.ok(block.indexOf('r2AccessKeyId') !== -1);
    assert.ok(block.indexOf('r2SecretAccessKey') !== -1);
    assert.ok(block.indexOf('r2Bucket') !== -1);
    assert.ok(block.indexOf('backupEncryptionKey') !== -1);
    assert.strictEqual(block.indexOf('authBackupKey'), -1);
    assert.strictEqual(block.indexOf('console.log'), -1);
    assert.strictEqual(block.indexOf('console.error'), -1);
    ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'BACKUP_ENCRYPTION_KEY'].forEach((name) => {
        assert.ok(index.indexOf("defineSecret('" + name + "')") !== -1, name);
    });
    const offsite = fs.readFileSync(path.join(__dirname, '..', 'functions/src/r2Offsite.js'), 'utf8');
    assert.ok(offsite.indexOf("throw new Error('r2 copy failed')") !== -1);
    assert.strictEqual(status.JOB_NAMES.join(','), 'firestore,auth,uploads,config');
});

test('the setup steps name the bucket, the lock, the token, and the secrets', function () {
    const script = path.join(__dirname, '..', 'scripts/backup_infra_setup.sh');
    const src = fs.readFileSync(script, 'utf8');
    const ownerStart = src.indexOf('run_owner() {');
    const applyStart = src.indexOf('run_apply() {');
    const afterApply = src.indexOf('\ngcloud config set project', applyStart);
    assert.ok(ownerStart !== -1 && applyStart > ownerStart && afterApply > applyStart);
    const owner = src.slice(ownerStart, applyStart);
    const apply = src.slice(applyStart, afterApply);
    assert.ok(owner.indexOf('R2_COPY_SA') !== -1);
    assert.ok(src.indexOf('bq-r2-copy@') !== -1);
    assert.ok(owner.indexOf('backupStatusWriter') !== -1);
    assert.ok(owner.indexOf('datastore.entities.get') !== -1);
    assert.ok(owner.indexOf('datastore.entities.list') !== -1);
    assert.ok(owner.indexOf('datastore.entities.create') !== -1);
    assert.ok(owner.indexOf('datastore.entities.update') !== -1);
    assert.strictEqual(owner.indexOf('datastore.entities.delete'), -1);
    assert.strictEqual(owner.indexOf('R2_ACCOUNT_ID'), -1);
    assert.strictEqual(owner.indexOf('BACKUP_ENCRYPTION_KEY'), -1);
    assert.ok(apply.indexOf('R2_COPY_SA') !== -1);
    assert.strictEqual(apply.indexOf('R2_SECRET_ACCESS_KEY'), -1);
    assert.strictEqual(apply.indexOf('BACKUP_ENCRYPTION_KEY'), -1);
    assert.ok(src.indexOf('Object Read & Write') !== -1);
    assert.ok(src.indexOf('Bucket lock rules') !== -1);
    assert.ok(src.indexOf('bq-backup-offsite') !== -1);
    assert.ok(src.indexOf('Prefix: 2') !== -1);
    assert.ok(src.indexOf('read -rsp') !== -1);
    assert.ok(src.indexOf('history -c') !== -1);
    assert.ok(src.indexOf('irreversible') !== -1);
    assert.ok(src.indexOf('in addition to roles/storage.objectAdmin') !== -1);
    assert.ok(src.indexOf('BACKUP_RESTORE.md') !== -1);
    assert.ok(src.indexOf('checkerVerdict') !== -1);
    assert.ok(src.indexOf('status is older than 26 hours') !== -1);
    assert.strictEqual(src.indexOf('GOVERNANCE'), -1);
    assert.strictEqual(src.indexOf('aws s3api'), -1);
    assert.ok(src.indexOf('functions:nightlyR2Copy') !== -1);
    assert.ok(src.indexOf('decrypt_r2_object.js') !== -1);
    const nightly = fs.readFileSync(path.join(__dirname, '..', 'functions/src/nightlyBackup.js'), 'utf8');
    assert.ok(nightly.indexOf('r2Required: true') !== -1);
    const out = execFileSync('bash', [script], { encoding: 'utf8' });
    assert.ok(out.indexOf('Object Read & Write') !== -1);
    assert.ok(out.indexOf('Bucket lock rules') !== -1);
    assert.ok(out.indexOf('30 days') !== -1);
    assert.ok(out.indexOf('bq-backup-offsite') !== -1);
    assert.ok(out.indexOf('read -rsp') !== -1);
    assert.strictEqual(out.indexOf('GOVERNANCE'), -1);
    assert.ok(out.indexOf('R2_ACCOUNT_ID') !== -1);
    assert.ok(out.indexOf('R2_ACCESS_KEY_ID') !== -1);
    assert.ok(out.indexOf('R2_SECRET_ACCESS_KEY') !== -1);
    assert.ok(out.indexOf('R2_BUCKET') !== -1);
    assert.ok(out.indexOf('BACKUP_ENCRYPTION_KEY') !== -1);
    assert.ok(out.indexOf('bq-r2-copy@') !== -1);
    assert.ok(out.indexOf('functions:nightlyR2Copy') !== -1);
    assert.strictEqual(out.indexOf('APPLY:'), -1);
    assert.strictEqual(out.indexOf('OWNER:'), -1);
});

(async function () {
    await testAsync('the seal round-trips, including empty and multi-chunk plaintext', async function () {
        const key = key32();
        const sentinel = Buffer.from('SENTINEL-plaintext-not-for-r2');
        const blob = await seal.sealBuffer(sentinel, key);
        assert.strictEqual(seal.headerMatches(blob), true);
        assert.strictEqual(blob.subarray(0, 4).toString('utf8'), 'BQR2');
        assert.strictEqual(blob[4], seal.VERSION);
        assert.strictEqual(blob.length > seal.HEADER_LEN + seal.TAG_LEN, true);
        assert.strictEqual(blob.includes(sentinel), false);
        assert.ok(blob.subarray(5, 5 + seal.KID_LEN).equals(seal.keyId(key)));
        assert.deepStrictEqual(seal.decryptBuffer(blob, key), sentinel);
        const second = await seal.sealBuffer(sentinel, key);
        const ivAt = 5 + seal.KID_LEN;
        assert.strictEqual(blob.subarray(ivAt, ivAt + seal.IV_LEN).equals(second.subarray(ivAt, ivAt + seal.IV_LEN)), false);
        assert.deepStrictEqual(seal.decryptBuffer(second, key), sentinel);
        const bound = await seal.sealBuffer(sentinel, key, 'uploads/a#1');
        assert.deepStrictEqual(seal.decryptBuffer(bound, [key32(), key], 'uploads/a#1'), sentinel);
        assert.throws(() => seal.decryptBuffer(bound, key, 'uploads/a#2'), /unable to authenticate|Unsupported state|auth/i);
        const iv = crypto.randomBytes(seal.IV_LEN);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const data = Buffer.concat([cipher.update(sentinel), cipher.final()]);
        const v1 = Buffer.concat([Buffer.from('BQR2'), Buffer.from([seal.VERSION_V1]), iv, data, cipher.getAuthTag()]);
        assert.deepStrictEqual(seal.decryptBuffer(v1, [key32(), key]), sentinel);
        const empty = await seal.sealBuffer(Buffer.alloc(0), key);
        assert.strictEqual(empty.length, seal.HEADER_LEN + seal.TAG_LEN);
        assert.strictEqual(seal.decryptBuffer(empty, key).length, 0);
        const parts = [Buffer.from('aaa'), Buffer.from('bbb-SENTINEL'), Buffer.from('ccc')];
        const bag = collect();
        await pipeline(Readable.from(parts), seal.encryptStream(key), bag.sink);
        const streamed = Buffer.concat(bag.chunks);
        assert.strictEqual(streamed.includes(Buffer.from('SENTINEL')), false);
        assert.deepStrictEqual(seal.decryptBuffer(streamed, key), Buffer.concat(parts));
    });

    await testAsync('a bad seal does not decrypt', async function () {
        const key = key32();
        const blob = await seal.sealBuffer(Buffer.from('payload'), key);
        const badHeader = Buffer.from(blob);
        badHeader[0] ^= 1;
        assert.throws(() => seal.decryptBuffer(badHeader, key), /bad header/);
        assert.throws(() => seal.decryptBuffer(blob.subarray(0, 8), key), /too short/);
        assert.throws(() => seal.decryptBuffer(blob, key32()), /unable to authenticate|Unsupported state|auth/i);
        const flipped = Buffer.from(blob);
        flipped[seal.HEADER_LEN] ^= 1;
        assert.throws(() => seal.decryptBuffer(flipped, key));
        const tag = Buffer.from(blob);
        tag[tag.length - 1] ^= 1;
        assert.throws(() => seal.decryptBuffer(tag, key));
        assert.strictEqual(seal.headerMatches(Buffer.from('BQR2\x01')), true);
        assert.strictEqual(seal.headerMatches(Buffer.from('BQR2\x02')), true);
        assert.strictEqual(seal.headerMatches(Buffer.from('BQAE\x01')), false);
    });

    await testAsync('uploads store only ciphertext and skip a key that already exists', async function () {
        const key = key32();
        const plain = Buffer.from('SENTINEL-plaintext-do-not-store');
        const stored = {};
        const opened = [];
        const result = await r2.copyPlanned({
            encKey: key,
            planned: [
                { group: 'config', name: 'config/d/firestore-rules.json', dest: 'd/config/firestore-rules.json' },
                { group: 'auth', name: 'auth/d/manifest.json', dest: 'd/auth/manifest.json' },
            ],
            headObject: async function (dest) {
                if (dest.indexOf('manifest') !== -1) return { exists: true, bytes: 40 };
                return { exists: false, bytes: 0 };
            },
            openObject: async function (item) {
                opened.push(item.dest);
                return Readable.from([plain]);
            },
            putObject: function (dest, body) {
                const chunks = [];
                body.on('data', (chunk) => chunks.push(chunk));
                return new Promise(function (resolve, reject) {
                    body.on('end', function () {
                        const buf = Buffer.concat(chunks);
                        stored[dest] = buf;
                        resolve(buf.length);
                    });
                    body.on('error', reject);
                });
            },
        });
        assert.deepStrictEqual(opened, ['d/config/firestore-rules.json']);
        assert.strictEqual(result.failedGroups.length, 0);
        assert.strictEqual(result.objectCount, 2);
        const sealed = stored['d/config/firestore-rules.json'];
        assert.ok(sealed);
        assert.strictEqual(sealed.includes(plain), false);
        assert.strictEqual(seal.headerMatches(sealed), true);
        assert.deepStrictEqual(seal.decryptBuffer(sealed, key, 'd/config/firestore-rules.json'), plain);
        assert.ok(sealed.subarray(5, 5 + seal.KID_LEN).equals(seal.keyId(key)));
        assert.strictEqual(result.bytes, sealed.length + 40);
    });

    await testAsync('a failed copy writes r2 status and throws the generic error', async function () {
        const logs = [];
        const orig = console.error;
        console.error = function () {
            logs.push(Array.prototype.join.call(arguments, ' '));
        };
        const secret = 'https://supersecret.example/path ' + 'A'.repeat(32);
        let written = null;
        try {
            await assert.rejects(r2.runNightlyR2Copy({
                date: '2026-10-24',
                copy: async function () { throw new Error(secret); },
                write: async function (event) { written = event; },
            }), /r2 copy failed/);
        } finally {
            console.error = orig;
        }
        assert.strictEqual(written.job, 'r2');
        assert.strictEqual(written.ok, false);
        assert.strictEqual(written.objectCount, 0);
        assert.strictEqual(written.bytes, 0);
        assert.strictEqual(written.detail, 'r2 copy failed');
        assert.strictEqual(written.date, '2026-10-24');
        const blob = logs.join('\n') + JSON.stringify(written);
        assert.strictEqual(blob.indexOf(secret), -1);
        assert.strictEqual(blob.indexOf('A'.repeat(32)), -1);
        let again = null;
        await assert.rejects(r2.runNightlyR2Copy({
            date: '2026-10-24',
            copy: async function () {
                return { ok: false, objectCount: 3, bytes: 99, detail: 'r2 copy failed: auth export is missing' };
            },
            write: async function (event) { again = event; },
        }), /r2 copy failed/);
        assert.strictEqual(again.ok, false);
        assert.strictEqual(again.objectCount, 3);
        assert.strictEqual(again.bytes, 99);
        assert.strictEqual(again.detail, 'r2 copy failed: auth export is missing');
        let okEvent = null;
        const done = await r2.runNightlyR2Copy({
            date: '2026-10-24',
            copy: async function () {
                return { ok: true, objectCount: 2, bytes: 10, detail: 'copied 2 objects, 10 bytes' };
            },
            write: async function (event) { okEvent = event; },
        });
        assert.strictEqual(done.ok, true);
        assert.strictEqual(okEvent.ok, true);
        assert.strictEqual(okEvent.objectCount, 2);
        assert.strictEqual(okEvent.bytes, 10);
    });

    await testAsync('an r2 failure keeps the day not-ok through the health rewrite', async function () {
        const day = '2026-10-24';
        const finishedAt = day + 'T05:00:00.000Z';
        const store = fakeDb();
        await status.writeBackupResults(store.db, adminStub, verifiedEvents(day, finishedAt), finishedAt);
        assert.strictEqual(store.docs['backup_status/latest'].ok, true);
        await status.writeBackupResult(store.db, adminStub, {
            job: 'r2',
            date: day,
            ok: false,
            startedAt: day + 'T04:45:00.000Z',
            finishedAt: day + 'T04:50:00.000Z',
            detail: 'r2 copy failed: auth export is missing',
            objectCount: 4,
            bytes: 80,
        }, finishedAt);
        let latest = store.docs['backup_status/latest'];
        assert.strictEqual(latest.ok, false);
        assert.strictEqual(latest.detail, 'failed: r2');
        assert.strictEqual(latest.verifiedAt, finishedAt);
        assert.strictEqual(latest.jobs.r2.ok, false);
        assert.strictEqual(latest.jobs.r2.objectCount, 4);
        assert.strictEqual(latest.jobs.r2.bytes, 80);
        status.JOB_NAMES.forEach((job) => {
            assert.deepStrictEqual(Object.keys(latest.jobs[job]).sort(), ['detail', 'finishedAt', 'ok', 'startedAt']);
            assert.strictEqual(latest.jobs[job].ok, true);
        });
        const r2row = historyRows(store.docs).filter((row) => row.job === 'r2');
        assert.strictEqual(r2row.length, 1);
        assert.strictEqual(r2row[0].objectCount, 4);
        assert.strictEqual(r2row[0].bytes, 80);
        historyRows(store.docs).filter((row) => row.job !== 'r2').forEach((row) => {
            assert.deepStrictEqual(Object.keys(row).sort(), ['date', 'detail', 'expireAt', 'finishedAt', 'job', 'ok', 'runId', 'startedAt']);
        });
        await status.writeBackupResults(store.db, adminStub, verifiedEvents(day, finishedAt), finishedAt);
        latest = store.docs['backup_status/latest'];
        assert.strictEqual(latest.ok, false);
        assert.strictEqual(latest.detail, 'failed: r2');
        assert.strictEqual(latest.jobs.r2.bytes, 80);
        const early = fakeDb();
        await status.writeBackupResult(early.db, adminStub, {
            job: 'r2',
            date: day,
            ok: false,
            startedAt: day + 'T04:45:00.000Z',
            finishedAt: day + 'T04:46:00.000Z',
            detail: 'r2 copy failed',
            objectCount: 0,
            bytes: 0,
        }, day + 'T04:46:00.000Z');
        await status.writeBackupResults(early.db, adminStub, verifiedEvents(day, finishedAt), finishedAt);
        assert.strictEqual(early.docs['backup_status/latest'].ok, false);
        assert.strictEqual(early.docs['backup_status/latest'].detail, 'failed: r2');
        assert.strictEqual(early.docs['backup_status/latest'].verifiedAt, finishedAt);
    });

    await testAsync('a successful r2 copy keeps a verified day ok', async function () {
        const day = '2026-10-24';
        const finishedAt = day + 'T05:00:00.000Z';
        const store = fakeDb();
        await status.writeBackupResults(store.db, adminStub, verifiedEvents(day, finishedAt), finishedAt);
        await status.writeBackupResults(store.db, adminStub, [{
            job: 'r2',
            date: day,
            ok: true,
            startedAt: day + 'T04:45:00.000Z',
            finishedAt: day + 'T04:50:00.000Z',
            detail: 'copied 9 objects, 100 bytes',
            objectCount: 9,
            bytes: 100,
        }], finishedAt);
        const latest = store.docs['backup_status/latest'];
        assert.strictEqual(latest.ok, true);
        assert.strictEqual(latest.detail, 'all checks passed');
        assert.strictEqual(latest.verifiedAt, finishedAt);
        assert.strictEqual(latest.jobs.r2.objectCount, 9);
        assert.strictEqual(latest.jobs.r2.bytes, 100);
        const required = fakeDb();
        await status.writeBackupResults(required.db, adminStub, verifiedEvents(day, finishedAt), finishedAt, { r2Required: true });
        assert.strictEqual(required.docs['backup_status/latest'].ok, false);
        assert.ok(required.docs['backup_status/latest'].detail.indexOf('r2') !== -1);
        const stale = fakeDb();
        await status.writeBackupResults(stale.db, adminStub, verifiedEvents(day, finishedAt), finishedAt);
        await status.writeBackupResults(stale.db, adminStub, [{
            job: 'r2',
            date: day,
            ok: true,
            startedAt: '2026-10-22T04:45:00.000Z',
            finishedAt: '2026-10-22T04:50:00.000Z',
            detail: 'copied',
            objectCount: 1,
            bytes: 2,
        }], finishedAt);
        await status.writeBackupResults(stale.db, adminStub, verifiedEvents(day, finishedAt), finishedAt, { r2Required: true });
        assert.strictEqual(stale.docs['backup_status/latest'].ok, false);
        assert.ok(stale.docs['backup_status/latest'].detail.indexOf('r2') !== -1);
        const fresh = { ok: true, updatedAt: finishedAt, detail: 'all checks passed' };
        assert.deepStrictEqual(status.checkerVerdict(fresh, finishedAt), { ok: true, detail: 'all checks passed' });
        assert.strictEqual(status.checkerVerdict(fresh, '2026-10-25T05:00:00.000Z').ok, true);
        assert.deepStrictEqual(
            status.checkerVerdict(fresh, '2026-10-25T08:00:00.000Z'),
            { ok: false, detail: 'status is older than 26 hours' }
        );
        assert.deepStrictEqual(status.checkerVerdict(null, finishedAt), { ok: false, detail: 'status is older than 26 hours' });
        assert.throws(() => status.nextLatest(null, { job: 'other', date: day, ok: true }, finishedAt), /unknown backup job/);
        await status.writeBackupResult(store.db, adminStub, {
            job: 'firestore',
            date: '2026-10-25',
            ok: false,
            startedAt: '2026-10-25T02:00:00.000Z',
            finishedAt: '2026-10-25T02:00:05.000Z',
            detail: 'Firestore export started',
        }, '2026-10-25T02:00:05.000Z');
        assert.deepStrictEqual(Object.keys(store.docs['backup_status/latest'].jobs), ['firestore']);
    });

    await testAsync('the decrypt script round-trips a sealed object', async function () {
        const key = key32();
        const plain = Buffer.from('round-trip plaintext for the restore script');
        const blob = await seal.sealBuffer(plain, key);
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-decrypt-'));
        const file = path.join(dir, 'object.bin');
        const out = path.join(dir, 'restored.bin');
        fs.writeFileSync(file, blob);
        const script = path.join(__dirname, '..', 'scripts/decrypt_r2_object.js');
        const src = fs.readFileSync(script, 'utf8');
        assert.ok(src.indexOf('process.env.BACKUP_ENCRYPTION_KEY') !== -1);
        assert.ok(!/process\.argv[\s\S]{0,80}BACKUP_ENCRYPTION_KEY/.test(src));
        const log = execFileSync('node', [script, '--file', file, '--out', out], {
            encoding: 'utf8',
            env: Object.assign({}, process.env, { BACKUP_ENCRYPTION_KEY: key.toString('base64') }),
        });
        assert.deepStrictEqual(fs.readFileSync(out), plain);
        assert.strictEqual(fs.statSync(out).mode & 0o777, 0o600);
        assert.strictEqual(log.indexOf(key.toString('base64')), -1);
        assert.strictEqual(log.indexOf(file), -1);
        const empty = await seal.sealBuffer(Buffer.alloc(0), key);
        const emptyFile = path.join(dir, 'empty.bin');
        const emptyOut = path.join(dir, 'empty.out');
        fs.writeFileSync(emptyFile, empty);
        execFileSync('node', [script, '--file', emptyFile, '--out', emptyOut], {
            encoding: 'utf8',
            env: Object.assign({}, process.env, { BACKUP_ENCRYPTION_KEY: key.toString('base64') }),
        });
        assert.strictEqual(fs.readFileSync(emptyOut).length, 0);
        const bound = await seal.sealBuffer(plain, key, 'uploads/photo.png#17');
        const boundFile = path.join(dir, 'bound.bin');
        const boundOut = path.join(dir, 'bound.out');
        fs.writeFileSync(boundFile, bound);
        const wrong = key32();
        execFileSync('node', [script, '--file', boundFile, '--out', boundOut, '--dest', 'uploads/photo.png#17'], {
            encoding: 'utf8',
            env: Object.assign({}, process.env, {
                BACKUP_ENCRYPTION_KEY: wrong.toString('base64'),
                BACKUP_ENCRYPTION_KEYS: key.toString('base64'),
            }),
        });
        assert.deepStrictEqual(fs.readFileSync(boundOut), plain);
        const tampered = Buffer.from(blob);
        tampered[tampered.length - 1] ^= 1;
        fs.writeFileSync(file, tampered);
        const badOut = path.join(dir, 'bad.bin');
        let rejected = false;
        try {
            execFileSync('node', [script, '--file', file, '--out', badOut], {
                encoding: 'utf8',
                env: Object.assign({}, process.env, { BACKUP_ENCRYPTION_KEY: key.toString('base64') }),
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        } catch (e) {
            rejected = e.status !== 0;
            const stderr = e.stderr ? e.stderr.toString() : '';
            assert.strictEqual(stderr.indexOf(key.toString('base64')), -1);
        }
        assert.strictEqual(rejected, true);
        assert.strictEqual(fs.existsSync(badOut), false);
        assert.strictEqual(fs.existsSync(badOut + '.tmp'), false);
        assert.deepStrictEqual(fs.readFileSync(out), plain);
        fs.rmSync(dir, { recursive: true, force: true });
    });

    await testAsync('a 403 before the upload reads does not hang or reject unhandled', async function () {
        const rejections = [];
        function onRejection(err) { rejections.push(err); }
        process.on('unhandledRejection', onRejection);
        const started = Date.now();
        try {
            const result = await r2.copyPlanned({
                encKey: key32(),
                objectTimeoutMs: 5000,
                planned: [{ group: 'uploads', name: 'a', dest: 'uploads/a#1' }],
                headObject: async function () { return { exists: false, bytes: 0 }; },
                openObject: async function () { return Readable.from([Buffer.from('hello')]); },
                putObject: function () { return Promise.reject(new Error('R2 403 AccessDenied')); },
            });
            await new Promise(function (resolve) { setTimeout(resolve, 30); });
            assert.ok(Date.now() - started < 1000);
            assert.deepStrictEqual(result.failedGroups, ['uploads']);
            assert.strictEqual(result.objectCount, 0);
            assert.strictEqual(rejections.length, 0);
            const timed = await r2.copyPlanned({
                encKey: key32(),
                objectTimeoutMs: 80,
                planned: [{ group: 'config', name: 'c', dest: 'd/config/c' }],
                headObject: async function () { return { exists: false, bytes: 0 }; },
                openObject: async function () { return Readable.from([Buffer.from('hello')]); },
                putObject: function () { return new Promise(function () {}); },
            });
            await new Promise(function (resolve) { setTimeout(resolve, 30); });
            assert.deepStrictEqual(timed.failedGroups, ['config']);
            assert.strictEqual(rejections.length, 0);
        } finally {
            process.off('unhandledRejection', onRejection);
        }
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})();
