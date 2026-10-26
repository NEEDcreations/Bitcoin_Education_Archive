'use strict';

// Copy one night of backups to Cloudflare R2. Every object is sealed with
// r2BackupCrypto before it is uploaded. R2 never receives plaintext.
// Uploads objects are stored once, at uploads/<name>#<generation> (or md5
// when generation is missing). A small sealed manifest for the night lists
// them, including sha256 for objects streamed on that run. Dated Firestore,
// auth, and config objects record sha256 in date/manifest.json. Objects are
// not rewritten to attach a checksum. Dated keys still expire after 90 days.
// A failed run is recorded as job "r2" on backup_status/latest, which makes
// latest.ok false. That is the existing failure alert. No email or chat.

const crypto = require('crypto');
const health = require('./backupHealth');
const seal = require('./r2BackupCrypto');
const { PassThrough, Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');

const DELETE_AFTER_DAYS = 90;
const OBJECT_TIMEOUT_MS = 10 * 60 * 1000;
// 25 minutes. The function timeout is 1800 seconds. Each object waits at
// most the time left before this budget, so a late object cannot run past it.
const COPY_BUDGET_MS = 25 * 60 * 1000;
const PROJECT_ID = 'bitcoin-education-archive';
const FIRESTORE_BACKUP_BUCKET = 'bitcoin-education-archive-backups';
const AUTH_BACKUP_BUCKET = 'bitcoin-education-archive-auth-backups';
const UPLOADS_BACKUP_BUCKET = 'bitcoin-education-archive-uploads-backup';

function destKey(date, group, name) {
    return date + '/' + group + '/' + String(name || '').replace(/^\/+/, '');
}

function entryName(entry) {
    if (typeof entry === 'string') return entry;
    return entry && entry.name ? String(entry.name) : '';
}

function entryToken(entry) {
    if (!entry || typeof entry === 'string') return '0';
    if (entry.generation) return String(entry.generation);
    if (entry.md5) return String(entry.md5);
    if (entry.md5Hash) return String(entry.md5Hash);
    return '0';
}

function uploadsObjectKey(entry) {
    return 'uploads/' + entryName(entry) + '#' + entryToken(entry);
}

function baseName(name) {
    const parts = String(name || '').split('/');
    return parts[parts.length - 1];
}

function hasExportMetadata(names) {
    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        if (name.indexOf('overall_export_metadata') !== -1 || name.endsWith('.export_metadata')) return true;
    }
    return false;
}

function namesOf(list) {
    const out = [];
    const items = list || [];
    for (let i = 0; i < items.length; i++) {
        const name = entryName(items[i]);
        if (name) out.push(name);
    }
    return out;
}

function planNight(date, found) {
    const src = found || {};
    const uploads = [];
    const missing = [];
    const firestore = namesOf(src.firestore);
    if (!hasExportMetadata(firestore)) {
        missing.push('firestore export metadata is missing');
    } else {
        const prefix = date + '/';
        for (let i = 0; i < firestore.length; i++) {
            const name = firestore[i];
            const rel = name.indexOf(prefix) === 0 ? name.slice(prefix.length) : name;
            uploads.push({ group: 'firestore', name: name, dest: destKey(date, 'firestore', rel) });
        }
    }
    const authNeed = ['auth/' + date + '/users.jsonl.gz.enc', 'auth/' + date + '/manifest.json'];
    const authHave = {};
    const authNames = namesOf(src.auth);
    for (let i = 0; i < authNames.length; i++) authHave[authNames[i]] = true;
    if (authNeed.some((name) => !authHave[name])) {
        missing.push('auth export is missing');
    } else {
        for (let i = 0; i < authNeed.length; i++) {
            uploads.push({
                group: 'auth',
                name: authNeed[i],
                dest: destKey(date, 'auth', baseName(authNeed[i])),
            });
        }
    }
    const configNeed = health.CONFIG_OBJECT_NAMES.map((name) => 'config/' + date + '/' + name);
    const configHave = {};
    const configNames = namesOf(src.config);
    for (let i = 0; i < configNames.length; i++) configHave[configNames[i]] = true;
    if (configNeed.some((name) => !configHave[name])) {
        missing.push('config snapshot is missing');
    } else {
        for (let i = 0; i < configNeed.length; i++) {
            uploads.push({
                group: 'config',
                name: configNeed[i],
                dest: destKey(date, 'config', baseName(configNeed[i])),
            });
        }
    }
    const ups = src.uploads || [];
    if (!ups.length) {
        missing.push('uploads backup is missing');
    } else {
        const listed = [];
        for (let i = 0; i < ups.length; i++) {
            const entry = typeof ups[i] === 'string' ? { name: ups[i] } : ups[i];
            const item = {
                group: 'uploads',
                name: entryName(entry),
                generation: entry.generation ? String(entry.generation) : '',
                md5: entry.md5 || entry.md5Hash || '',
                bytes: Number(entry.size != null ? entry.size : entry.bytes) || 0,
                dest: uploadsObjectKey(entry),
            };
            uploads.push(item);
            listed.push({
                name: item.name,
                generation: item.generation,
                md5: item.md5,
                bytes: item.bytes,
                dest: item.dest,
            });
        }
        const manifest = Buffer.from(JSON.stringify({ date: date, objects: listed }));
        uploads.push({
            group: 'manifest',
            name: date + '/uploads-manifest.json',
            dest: date + '/uploads-manifest.json',
            body: manifest,
        });
    }
    return { uploads: uploads, missing: missing, ok: missing.length === 0 };
}

function stampManifests(date, planned, checksums) {
    const sums = checksums || {};
    const objects = [];
    const manifests = [];
    const list = planned || [];
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (item.group !== 'manifest') {
            objects.push(item);
            continue;
        }
        const parsed = JSON.parse(Buffer.from(item.body).toString('utf8'));
        const rows = parsed.objects || [];
        for (let j = 0; j < rows.length; j++) {
            const row = rows[j];
            if (!row || !row.dest) continue;
            if (sums[row.dest]) row.sha256 = sums[row.dest];
            else delete row.sha256;
        }
        manifests.push({
            group: 'manifest',
            name: item.name,
            dest: item.dest,
            body: Buffer.from(JSON.stringify(parsed)),
        });
    }
    const nightly = [];
    for (let i = 0; i < objects.length; i++) {
        const item = objects[i];
        if (item.group === 'uploads') continue;
        const row = { group: item.group, name: item.name, dest: item.dest };
        if (sums[item.dest]) row.sha256 = sums[item.dest];
        nightly.push(row);
    }
    manifests.push({
        group: 'manifest',
        name: date + '/manifest.json',
        dest: date + '/manifest.json',
        body: Buffer.from(JSON.stringify({ date: date, objects: nightly })),
    });
    return { objects: objects, manifests: manifests };
}

function keysOlderThan(keys, today, days) {
    const cutoff = health.addUtcDays(today, -(days || DELETE_AFTER_DAYS));
    const old = [];
    const list = keys || [];
    for (let i = 0; i < list.length; i++) {
        const key = String(list[i] || '');
        const match = /^(\d{4}-\d{2}-\d{2})\//.exec(key);
        if (match && match[1] < cutoff) old.push(key);
    }
    return old;
}

function unreferencedUploads(keys, referenced) {
    const keep = {};
    const refs = referenced || [];
    for (let i = 0; i < refs.length; i++) keep[refs[i]] = true;
    const drop = [];
    const list = keys || [];
    for (let i = 0; i < list.length; i++) {
        const key = String(list[i] || '');
        if (key.indexOf('uploads/') === 0 && !keep[key]) drop.push(key);
    }
    return drop;
}

function safeDetail(err) {
    let message = err && err.message ? err.message : 'r2 request failed';
    message = String(message).replace(/https?:\/\/\S+/gi, '[redacted-url]');
    return health.sanitizeAlertDetail(message) || 'r2 request failed';
}

function hashStream() {
    const hash = crypto.createHash('sha256');
    const hasher = new Transform({
        transform(chunk, enc, cb) {
            hash.update(chunk);
            cb(null, chunk);
        },
    });
    return { hasher: hasher, digest: function () { return hash.digest('hex'); } };
}

function mergeCopy(base, extra) {
    const failed = (base.failedGroups || []).slice();
    const more = extra && extra.failedGroups ? extra.failedGroups : [];
    for (let i = 0; i < more.length; i++) {
        if (failed.indexOf(more[i]) === -1) failed.push(more[i]);
    }
    return {
        objectCount: (base.objectCount || 0) + (extra && extra.objectCount ? extra.objectCount : 0),
        bytes: (base.bytes || 0) + (extra && extra.bytes ? extra.bytes : 0),
        failedGroups: failed,
        checksums: Object.assign({}, base.checksums, extra && extra.checksums),
    };
}

async function copyPlanned(opts) {
    const planned = opts.planned || [];
    const encKey = opts.encKey;
    const capMs = opts.objectTimeoutMs || OBJECT_TIMEOUT_MS;
    let objectCount = 0;
    let bytes = 0;
    const failedGroups = [];
    const checksums = {};
    for (let i = 0; i < planned.length; i++) {
        const item = planned[i];
        if (opts.deadlineMs && Date.now() >= opts.deadlineMs) {
            if (failedGroups.indexOf(item.group) === -1) failedGroups.push(item.group);
            continue;
        }
        try {
            const existing = await opts.headObject(item.dest);
            if (existing && existing.exists) {
                objectCount++;
                bytes += Number(existing.bytes) || 0;
                continue;
            }
            const source = item.body
                ? Readable.from([Buffer.isBuffer(item.body) ? item.body : Buffer.from(item.body)])
                : await opts.openObject(item);
            const body = new PassThrough();
            const hashed = hashStream();
            const sealed = seal.encryptStream(encKey, item.dest);
            // Keep an error listener so a rejected upload or a timeout cannot
            // surface as an unhandled 'error' event after the pipeline stops.
            body.on('error', function () {});
            sealed.on('error', function () {});
            if (source && typeof source.on === 'function') source.on('error', function () {});
            const kid = seal.keyIdHex(encKey);
            const putPromise = opts.putObject(item.dest, body, { kid: kid });
            putPromise.catch(function (err) {
                if (!body.destroyed) body.destroy(err);
                if (source && typeof source.destroy === 'function' && !source.destroyed) source.destroy(err);
            });
            let waitMs = capMs;
            if (opts.deadlineMs) {
                const remaining = opts.deadlineMs - Date.now();
                if (remaining <= 0) {
                    const err = new Error('r2 copy budget exhausted');
                    if (!body.destroyed) body.destroy(err);
                    if (source && typeof source.destroy === 'function' && !source.destroyed) source.destroy(err);
                    throw err;
                }
                waitMs = Math.min(capMs, remaining);
            }
            let timer;
            const timeout = new Promise(function (_, reject) {
                timer = setTimeout(function () {
                    const err = new Error('r2 upload timed out');
                    if (!body.destroyed) body.destroy(err);
                    if (source && typeof source.destroy === 'function' && !source.destroyed) source.destroy(err);
                    reject(err);
                }, waitMs);
            });
            const both = Promise.all([
                pipeline(source, hashed.hasher, sealed, body),
                putPromise,
            ]);
            both.catch(function () {});
            try {
                const stored = (await Promise.race([both, timeout]))[1];
                checksums[item.dest] = hashed.digest();
                objectCount++;
                bytes += Number(stored) || 0;
            } finally {
                clearTimeout(timer);
            }
        } catch (err) {
            console.error('[r2-backup]', item.group, safeDetail(err));
            if (failedGroups.indexOf(item.group) === -1) failedGroups.push(item.group);
        }
    }
    return { objectCount: objectCount, bytes: bytes, failedGroups: failedGroups, checksums: checksums };
}

function summarize(plan, copied) {
    const parts = (plan.missing || []).slice();
    const failed = copied && copied.failedGroups ? copied.failedGroups : [];
    for (let i = 0; i < failed.length; i++) {
        if (parts.indexOf(failed[i]) === -1) parts.push(failed[i] + ' upload failed');
    }
    const count = copied ? copied.objectCount : 0;
    const bytes = copied ? copied.bytes : 0;
    if (parts.length) {
        return {
            ok: false,
            objectCount: count,
            bytes: bytes,
            detail: 'r2 copy failed: ' + parts.join('; '),
        };
    }
    return {
        ok: true,
        objectCount: count,
        bytes: bytes,
        detail: 'copied ' + count + ' objects, ' + bytes + ' bytes',
    };
}

function requireLabel(value, label) {
    const text = String(value == null ? '' : value).trim();
    if (!text) throw new Error(label + ' is missing');
    return text;
}

function r2Endpoint(accountId) {
    const id = requireLabel(accountId, 'R2 account id');
    if (!/^[A-Za-z0-9]{1,64}$/.test(id)) throw new Error('R2 account id is not usable');
    return { id: id, endpoint: 'https://' + id + '.r2.cloudflarestorage.com' };
}

function makeClient(opts) {
    const { S3Client, HeadObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
    const { Upload } = require('@aws-sdk/lib-storage');
    const account = r2Endpoint(opts.accountId);
    const accessKeyId = requireLabel(opts.accessKeyId, 'R2 access key');
    const secretAccessKey = requireLabel(opts.secretAccessKey, 'R2 secret key');
    const bucket = requireLabel(opts.bucket, 'R2 bucket');
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('R2 bucket name is not usable');
    const client = new S3Client({
        region: 'auto',
        endpoint: account.endpoint,
        credentials: { accessKeyId: accessKeyId, secretAccessKey: secretAccessKey },
        logger: { trace: function () {}, debug: function () {}, info: function () {}, warn: function () {}, error: function () {} },
    });
    return {
        client: client,
        bucket: bucket,
        HeadObjectCommand: HeadObjectCommand,
        PutObjectCommand: PutObjectCommand,
        ListObjectsV2Command: ListObjectsV2Command,
        DeleteObjectsCommand: DeleteObjectsCommand,
        GetObjectCommand: GetObjectCommand,
        Upload: Upload,
    };
}

function notFound(err) {
    const status = err && err.$metadata && err.$metadata.httpStatusCode;
    const name = err && (err.name || err.Code);
    return status === 404 || name === 'NotFound' || name === 'NoSuchKey';
}

async function listGcs(token, bucket, prefix) {
    const fetch = require('node-fetch');
    const objects = [];
    let pageToken = '';
    for (let page = 0; page < 500; page++) {
        const url = new URL('https://storage.googleapis.com/storage/v1/b/' + encodeURIComponent(bucket) + '/o');
        url.searchParams.set('maxResults', '1000');
        if (prefix) url.searchParams.set('prefix', prefix);
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const res = await fetch(url.toString(), { headers: { Authorization: 'Bearer ' + token } });
        if (!res.ok) throw new Error('could not list backup objects');
        const json = await res.json();
        const items = json.items || [];
        for (let i = 0; i < items.length; i++) {
            const name = items[i].name || '';
            if (!name || name.charAt(name.length - 1) === '/') continue;
            objects.push({
                name: name,
                generation: items[i].generation ? String(items[i].generation) : '',
                md5: items[i].md5Hash || '',
                size: Number(items[i].size) || 0,
            });
        }
        if (!json.nextPageToken) return objects;
        pageToken = json.nextPageToken;
    }
    throw new Error('backup object list was truncated');
}

async function openGcs(token, bucket, name) {
    const fetch = require('node-fetch');
    const url = 'https://storage.googleapis.com/storage/v1/b/' + encodeURIComponent(bucket)
        + '/o/' + encodeURIComponent(name) + '?alt=media';
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) throw new Error('could not read backup object');
    return res.body;
}

async function readBody(body) {
    if (!body) return Buffer.alloc(0);
    if (Buffer.isBuffer(body)) return body;
    const chunks = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
}

async function copyToday(opts) {
    const date = opts.date;
    const encKey = seal.parseBackupKey(opts.key);
    const token = opts.token || await accessToken();
    const found = {
        firestore: await listGcs(token, FIRESTORE_BACKUP_BUCKET, date + '/'),
        auth: await listGcs(token, AUTH_BACKUP_BUCKET, 'auth/' + date + '/'),
        config: await listGcs(token, FIRESTORE_BACKUP_BUCKET, 'config/' + date + '/'),
        uploads: await listGcs(token, UPLOADS_BACKUP_BUCKET, ''),
    };
    const plan = planNight(date, found);
    const made = makeClient(opts);
    const bucketFor = {
        firestore: FIRESTORE_BACKUP_BUCKET,
        auth: AUTH_BACKUP_BUCKET,
        config: FIRESTORE_BACKUP_BUCKET,
        uploads: UPLOADS_BACKUP_BUCKET,
    };
    const deadlineMs = opts.deadlineMs || (Date.now() + COPY_BUDGET_MS);
    const copyOpts = {
        encKey: encKey,
        deadlineMs: deadlineMs,
        objectTimeoutMs: opts.objectTimeoutMs,
        headObject: async function (key) {
            try {
                const head = await made.client.send(new made.HeadObjectCommand({ Bucket: made.bucket, Key: key }));
                return { exists: true, bytes: Number(head.ContentLength) || 0 };
            } catch (err) {
                if (notFound(err)) return { exists: false, bytes: 0 };
                throw err;
            }
        },
        openObject: function (item) {
            return openGcs(token, bucketFor[item.group], item.name);
        },
        putObject: async function (key, body, meta) {
            const upload = new made.Upload({
                client: made.client,
                params: {
                    Bucket: made.bucket,
                    Key: key,
                    Body: body,
                    ContentType: 'application/octet-stream',
                    Metadata: { kid: meta && meta.kid ? meta.kid : '' },
                },
            });
            await upload.done();
            const head = await made.client.send(new made.HeadObjectCommand({ Bucket: made.bucket, Key: key }));
            return Number(head.ContentLength) || 0;
        },
    };
    const split = stampManifests(date, plan.uploads, {});
    const copiedObjects = await copyPlanned(Object.assign({}, copyOpts, { planned: split.objects }));
    const stamped = stampManifests(date, plan.uploads, copiedObjects.checksums);
    const copiedManifests = await copyPlanned(Object.assign({}, copyOpts, { planned: stamped.manifests }));
    const copied = mergeCopy(copiedObjects, copiedManifests);
    const deleted = await deleteOldObjects(made, date, encKey, {
        skipUploads: (copied.failedGroups || []).indexOf('manifest') !== -1,
    });
    const summary = summarize(plan, copied);
    if (deleted.error) {
        summary.ok = false;
        summary.detail = (summary.detail ? summary.detail + '; ' : '') + 'could not delete objects older than 90 days';
    }
    console.log('[r2-backup]', date, summary.ok ? 'ok' : 'failed', 'objects', summary.objectCount, 'bytes', summary.bytes, 'deleted', deleted.count);
    return summary;
}

async function deleteBatches(made, keys) {
    for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000).map((key) => ({ Key: key }));
        if (!batch.length) continue;
        const out = await made.client.send(new made.DeleteObjectsCommand({
            Bucket: made.bucket,
            Delete: { Objects: batch },
        }));
        if (out.Errors && out.Errors.length) return true;
    }
    return false;
}

async function deleteOldObjects(made, today, encKey, flags) {
    const skipUploads = flags && flags.skipUploads;
    let token;
    const keys = [];
    try {
        do {
            const page = await made.client.send(new made.ListObjectsV2Command({
                Bucket: made.bucket,
                ContinuationToken: token,
            }));
            const contents = page.Contents || [];
            for (let i = 0; i < contents.length; i++) {
                if (contents[i].Key) keys.push(contents[i].Key);
            }
            token = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (token);
        const dated = keysOlderThan(keys, today, DELETE_AFTER_DAYS);
        let uploadsDrop = [];
        if (!skipUploads) {
            const cutoff = health.addUtcDays(today, -DELETE_AFTER_DAYS);
            const recent = [];
            for (let i = 0; i < keys.length; i++) {
                const match = /^(\d{4}-\d{2}-\d{2})\/uploads-manifest\.json$/.exec(keys[i]);
                if (match && match[1] >= cutoff) recent.push(keys[i]);
            }
            if (!recent.length) {
                console.error('[r2-backup] manifest missing; skipping uploads cleanup');
            } else {
                let manifestProblem = false;
                const referenced = [];
                for (let i = 0; i < recent.length; i++) {
                    const key = recent[i];
                    try {
                        const obj = await made.client.send(new made.GetObjectCommand({ Bucket: made.bucket, Key: key }));
                        const plain = seal.decryptBuffer(await readBody(obj.Body), encKey, key);
                        const parsed = JSON.parse(plain.toString('utf8'));
                        const objects = parsed.objects || [];
                        for (let j = 0; j < objects.length; j++) {
                            if (objects[j] && objects[j].dest) referenced.push(objects[j].dest);
                        }
                    } catch (err) {
                        console.error('[r2-backup] manifest unreadable; skipping uploads cleanup', safeDetail(err));
                        manifestProblem = true;
                        break;
                    }
                }
                if (!manifestProblem) uploadsDrop = unreferencedUploads(keys, referenced);
            }
        }
        const drop = dated.concat(uploadsDrop);
        const batchError = await deleteBatches(made, drop);
        return { count: batchError ? 0 : drop.length, error: !!batchError };
    } catch (err) {
        console.error('[r2-backup] delete', safeDetail(err));
        return { count: 0, error: true };
    }
}

async function accessToken() {
    const admin = require('firebase-admin');
    const token = await admin.app().options.credential.getAccessToken();
    if (!token || !token.access_token) throw new Error('no access token');
    return token.access_token;
}

async function runNightlyR2Copy(deps) {
    const startedAt = new Date().toISOString();
    let result;
    try {
        result = await deps.copy();
    } catch (err) {
        console.error('[r2-backup] failed', safeDetail(err));
        result = { ok: false, objectCount: 0, bytes: 0, detail: 'r2 copy failed', date: deps.date };
    }
    const finishedAt = new Date().toISOString();
    await deps.write({
        job: 'r2',
        date: result.date || deps.date,
        ok: result.ok === true,
        startedAt: startedAt,
        finishedAt: finishedAt,
        detail: result.detail || (result.ok === true ? 'r2 copy finished' : 'r2 copy failed'),
        objectCount: Number.isFinite(result.objectCount) ? result.objectCount : 0,
        bytes: Number.isFinite(result.bytes) ? result.bytes : 0,
    });
    if (result.ok !== true) throw new Error('r2 copy failed');
    return result;
}

module.exports = {
    DELETE_AFTER_DAYS,
    OBJECT_TIMEOUT_MS,
    PROJECT_ID,
    FIRESTORE_BACKUP_BUCKET,
    AUTH_BACKUP_BUCKET,
    UPLOADS_BACKUP_BUCKET,
    destKey,
    uploadsObjectKey,
    planNight,
    stampManifests,
    keysOlderThan,
    unreferencedUploads,
    copyPlanned,
    summarize,
    deleteOldObjects,
    copyToday,
    runNightlyR2Copy,
    r2Endpoint,
};
