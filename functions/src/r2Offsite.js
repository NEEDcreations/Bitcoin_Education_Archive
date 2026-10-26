'use strict';

// Copy one night of backups to Cloudflare R2. Every object is sealed with
// r2BackupCrypto before it is uploaded. R2 never receives plaintext.
// A failed run is recorded as job "r2" on backup_status/latest, which makes
// latest.ok false. That is the existing failure alert. No email or chat.

const health = require('./backupHealth');
const seal = require('./r2BackupCrypto');
const { PassThrough } = require('stream');
const { pipeline } = require('stream/promises');

const DELETE_AFTER_DAYS = 90;
const PROJECT_ID = 'bitcoin-education-archive';
const FIRESTORE_BACKUP_BUCKET = 'bitcoin-education-archive-backups';
const AUTH_BACKUP_BUCKET = 'bitcoin-education-archive-auth-backups';
const UPLOADS_BACKUP_BUCKET = 'bitcoin-education-archive-uploads-backup';

function destKey(date, group, name) {
    return date + '/' + group + '/' + String(name || '').replace(/^\/+/, '');
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

function planNight(date, found) {
    const src = found || {};
    const uploads = [];
    const missing = [];
    const firestore = src.firestore || [];
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
    const authNames = src.auth || [];
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
    const configNames = src.config || [];
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
        for (let i = 0; i < ups.length; i++) {
            uploads.push({ group: 'uploads', name: ups[i], dest: destKey(date, 'uploads', ups[i]) });
        }
    }
    return { uploads: uploads, missing: missing, ok: missing.length === 0 };
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

function safeDetail(err) {
    let message = err && err.message ? err.message : 'r2 request failed';
    message = String(message).replace(/https?:\/\/\S+/gi, '[redacted-url]');
    return health.sanitizeAlertDetail(message) || 'r2 request failed';
}

async function copyPlanned(opts) {
    const planned = opts.planned || [];
    const encKey = opts.encKey;
    let objectCount = 0;
    let bytes = 0;
    const failedGroups = [];
    for (let i = 0; i < planned.length; i++) {
        const item = planned[i];
        try {
            const existing = await opts.headObject(item.dest);
            if (existing && existing.exists) {
                objectCount++;
                bytes += Number(existing.bytes) || 0;
                continue;
            }
            const source = await opts.openObject(item);
            const body = new PassThrough();
            const sealed = seal.encryptStream(encKey);
            const putPromise = opts.putObject(item.dest, body);
            try {
                await pipeline(source, sealed, body);
                const stored = await putPromise;
                objectCount++;
                bytes += Number(stored) || 0;
            } catch (err) {
                body.destroy();
                if (source && typeof source.destroy === 'function') source.destroy();
                await putPromise.catch(function () {});
                throw err;
            }
        } catch (err) {
            console.error('[r2-backup]', item.group, safeDetail(err));
            if (failedGroups.indexOf(item.group) === -1) failedGroups.push(item.group);
        }
    }
    return { objectCount: objectCount, bytes: bytes, failedGroups: failedGroups };
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
    const { S3Client, HeadObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
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
    return { client: client, bucket: bucket, HeadObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, Upload };
}

function notFound(err) {
    const status = err && err.$metadata && err.$metadata.httpStatusCode;
    const name = err && (err.name || err.Code);
    return status === 404 || name === 'NotFound' || name === 'NoSuchKey';
}

async function listGcs(token, bucket, prefix) {
    const fetch = require('node-fetch');
    const names = [];
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
            if (name && name.charAt(name.length - 1) !== '/') names.push(name);
        }
        if (!json.nextPageToken) return names;
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
    const copied = await copyPlanned({
        encKey: encKey,
        planned: plan.uploads,
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
        putObject: async function (key, body) {
            const upload = new made.Upload({
                client: made.client,
                params: {
                    Bucket: made.bucket,
                    Key: key,
                    Body: body,
                    ContentType: 'application/octet-stream',
                },
            });
            await upload.done();
            const head = await made.client.send(new made.HeadObjectCommand({ Bucket: made.bucket, Key: key }));
            return Number(head.ContentLength) || 0;
        },
    });
    const deleted = await deleteOldObjects(made, date);
    const summary = summarize(plan, copied);
    if (deleted.error) {
        summary.ok = false;
        summary.detail = (summary.detail ? summary.detail + '; ' : '') + 'could not delete objects older than 90 days';
    }
    console.log('[r2-backup]', date, summary.ok ? 'ok' : 'failed', 'objects', summary.objectCount, 'bytes', summary.bytes, 'deleted', deleted.count);
    return summary;
}

async function deleteOldObjects(made, today) {
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
        const old = keysOlderThan(keys, today, DELETE_AFTER_DAYS);
        for (let i = 0; i < old.length; i += 1000) {
            const batch = old.slice(i, i + 1000).map((key) => ({ Key: key }));
            if (!batch.length) continue;
            const out = await made.client.send(new made.DeleteObjectsCommand({
                Bucket: made.bucket,
                Delete: { Objects: batch },
            }));
            if (out.Errors && out.Errors.length) return { count: i, error: true };
        }
        return { count: old.length, error: false };
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
    PROJECT_ID,
    FIRESTORE_BACKUP_BUCKET,
    AUTH_BACKUP_BUCKET,
    UPLOADS_BACKUP_BUCKET,
    destKey,
    planNight,
    keysOlderThan,
    copyPlanned,
    summarize,
    copyToday,
    runNightlyR2Copy,
    r2Endpoint,
};
