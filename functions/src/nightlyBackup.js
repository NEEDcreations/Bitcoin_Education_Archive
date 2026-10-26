'use strict';

// Nightly backups for Bitcoin Quest. Scheduled from functions/index.js.
// No HTTPS handlers. Each job writes backup_status/latest and appends
// backup_history. Do not send these results by email, Telegram, or Discord.
// AUTH_BACKUP_KEY is read from the bound secret and is never logged.

const zlib = require('zlib');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const crypto = require('./authBackupCrypto');
const format = require('./authBackupFormat');
const health = require('./backupHealth');
const backupStatus = require('./backupStatus');

const PROJECT_ID = 'bitcoin-education-archive';
const FIRESTORE_BACKUP_BUCKET = 'bitcoin-education-archive-backups';
const AUTH_BACKUP_BUCKET = 'bitcoin-education-archive-auth-backups';
const UPLOADS_SOURCE_BUCKET = 'bitcoin-education-archive.firebasestorage.app';
const UPLOADS_BACKUP_BUCKET = 'bitcoin-education-archive-uploads-backup';
const UPLOADS_JOB_DESCRIPTION = 'bitcoin-quest-nightly-uploads';
const FALLBACK_BUDGET_MS = 8 * 60 * 1000;
const AUTH_PAGE_LIMIT = 100;

function utcDate() {
    return health.utcDateString(new Date());
}

async function accessToken() {
    const token = await admin.app().options.credential.getAccessToken();
    if (!token || !token.access_token) throw new Error('no access token');
    return token.access_token;
}

function shortError(err) {
    const message = err && err.message ? err.message : 'error';
    return health.sanitizeAlertDetail(message).slice(0, 240);
}

async function readResponse(res) {
    const text = await res.text();
    let json = null;
    if (text) {
        try { json = JSON.parse(text); } catch (e) { json = null; }
    }
    return { text, json };
}

function httpError(res, json, text) {
    const message = json && json.error && json.error.message
        ? json.error.message
        : ('HTTP ' + res.status + (text ? ' ' + text.slice(0, 160) : ''));
    const err = new Error(message);
    err.status = res.status;
    return err;
}

async function apiJson(url, options) {
    const opts = options || {};
    const headers = { Authorization: 'Bearer ' + opts.token };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
        method: opts.method || 'GET',
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const parsed = await readResponse(res);
    if (!res.ok) throw httpError(res, parsed.json, parsed.text);
    return parsed.json || {};
}

async function uploadBytes(token, bucket, name, buffer, contentType, metadata) {
    const type = contentType || 'application/octet-stream';
    const bucketPath = encodeURIComponent(bucket);
    const object = encodeURIComponent(name);
    const custom = metadata && Object.keys(metadata).length ? metadata : null;
    if (buffer.length <= 4 * 1024 * 1024 && !custom) {
        const url = 'https://storage.googleapis.com/upload/storage/v1/b/' + bucketPath
            + '/o?uploadType=media&name=' + object;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': type,
            },
            body: buffer,
        });
        if (!res.ok) {
            const parsed = await readResponse(res);
            throw httpError(res, parsed.json, parsed.text);
        }
        return;
    }
    const startUrl = 'https://storage.googleapis.com/upload/storage/v1/b/' + bucketPath
        + '/o?uploadType=resumable&name=' + object;
    const resource = { contentType: type };
    if (custom) resource.metadata = custom;
    const start = await fetch(startUrl, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': type,
            'X-Upload-Content-Length': String(buffer.length),
        },
        body: JSON.stringify(resource),
    });
    if (!start.ok) {
        const parsed = await readResponse(start);
        throw httpError(start, parsed.json, parsed.text);
    }
    const session = start.headers.get('location');
    if (!session) throw new Error('resumable upload missing location');
    const put = await fetch(session, {
        method: 'PUT',
        headers: {
            'Content-Type': type,
            'Content-Length': String(buffer.length),
        },
        body: buffer,
    });
    if (!put.ok) {
        const parsed = await readResponse(put);
        throw httpError(put, parsed.json, parsed.text);
    }
}

async function uploadJson(token, bucket, name, value) {
    await uploadBytes(token, bucket, name, Buffer.from(JSON.stringify(value)), 'application/json');
}

async function downloadRange(token, bucket, name, start, end) {
    const url = 'https://storage.googleapis.com/storage/v1/b/' + encodeURIComponent(bucket)
        + '/o/' + encodeURIComponent(name) + '?alt=media';
    const want = end - start + 1;
    const res = await fetch(url, {
        headers: {
            Authorization: 'Bearer ' + token,
            Range: 'bytes=' + start + '-' + end,
        },
    });
    if (res.status !== 206 && res.status !== 200) {
        const parsed = await readResponse(res);
        throw httpError(res, parsed.json, parsed.text);
    }
    const lenHeader = res.headers.get('content-length');
    if (res.status === 200 && lenHeader && Number(lenHeader) > want) {
        if (res.body && typeof res.body.destroy === 'function') res.body.destroy();
        throw new Error('object range was not honored');
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.subarray(0, want);
}

async function downloadJson(token, bucket, name) {
    const url = 'https://storage.googleapis.com/storage/v1/b/' + encodeURIComponent(bucket)
        + '/o/' + encodeURIComponent(name) + '?alt=media';
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (res.status === 404) {
        const err = new Error('not found');
        err.status = 404;
        throw err;
    }
    const parsed = await readResponse(res);
    if (!res.ok) throw httpError(res, parsed.json, parsed.text);
    if (!parsed.json) throw new Error('backup object was not json');
    return parsed.json;
}

async function objectMeta(token, bucket, name) {
    const url = 'https://storage.googleapis.com/storage/v1/b/' + encodeURIComponent(bucket)
        + '/o/' + encodeURIComponent(name);
    return apiJson(url, { token });
}

async function listObjects(token, bucket, prefix, pageToken) {
    const url = new URL('https://storage.googleapis.com/storage/v1/b/' + encodeURIComponent(bucket) + '/o');
    url.searchParams.set('maxResults', '1000');
    if (prefix) url.searchParams.set('prefix', prefix);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    return apiJson(url.toString(), { token });
}

async function listPaged(firstUrl, token, field) {
    const out = [];
    let url = firstUrl;
    for (let guard = 0; url && guard < 40; guard++) {
        const json = await apiJson(url, { token });
        const batch = json[field] || [];
        for (let i = 0; i < batch.length; i++) out.push(batch[i]);
        if (!json.nextPageToken) break;
        const next = new URL(firstUrl);
        next.searchParams.set('pageToken', json.nextPageToken);
        url = next.toString();
    }
    return out;
}

async function fetchHashConfig(token) {
    const json = await apiJson(
        'https://identitytoolkit.googleapis.com/admin/v2/projects/' + PROJECT_ID + '/config',
        { token }
    );
    return format.pickHashConfig(json);
}

async function recordJob(event) {
    try {
        await backupStatus.writeBackupResult(admin.firestore(), admin, event);
        return true;
    } catch (e) {
        console.error('[backup-status] write failed', event && event.job, shortError(e));
        return false;
    }
}

function classifyExportOperation(op) {
    if (!op || op.done !== true) {
        return { done: false, ok: false, detail: 'Firestore export was still running' };
    }
    if (op.error) {
        return { done: true, ok: false, detail: 'Firestore export operation failed' };
    }
    return { done: true, ok: true, detail: 'Firestore export operation finished' };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function confirmExportFinished(deps) {
    const waitMs = Number.isFinite(deps.waitMs) ? deps.waitMs : (25 * 60 * 1000);
    const pollMs = Number.isFinite(deps.pollMs) ? deps.pollMs : 15000;
    const deadline = Date.now() + waitMs;
    let last = { done: false, ok: false, detail: 'Firestore export was still running' };
    for (;;) {
        last = classifyExportOperation(await deps.getOperation());
        if (last.done) break;
        if (Date.now() >= deadline) break;
        await sleep(pollMs);
    }
    if (last.ok !== true) return last;
    const folder = await deps.scanFolder();
    if (!folder || folder.metadata !== true || !(folder.count > 0)) {
        return { done: true, ok: false, detail: 'Firestore export finished without metadata' };
    }
    return { done: true, ok: true, detail: 'Firestore export finished and the folder is present' };
}

async function exportFirestore() {
    const startedAt = new Date().toISOString();
    const date = utcDate();
    const outputUriPrefix = 'gs://' + FIRESTORE_BACKUP_BUCKET + '/' + date;
    let recorded = false;
    try {
        const token = await accessToken();
        const op = await apiJson(
            'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default):exportDocuments',
            { token: token, method: 'POST', body: { outputUriPrefix: outputUriPrefix } }
        );
        if (!op.name) throw new Error('export request failed');
        await recordFirestoreExportAttempt({
            token: token,
            date: date,
            outputUriPrefix: outputUriPrefix,
            operation: op.name,
        });
        recorded = true;
        const verdict = await confirmExportFinished({
            getOperation: function () {
                return apiJson('https://firestore.googleapis.com/v1/' + op.name, { token: token });
            },
            scanFolder: function () {
                return scanExportFolder(token, date);
            },
        });
        const wrote = await recordJob({
            job: 'firestore',
            date: date,
            ok: verdict.ok === true,
            startedAt: startedAt,
            finishedAt: new Date().toISOString(),
            detail: verdict.detail,
        });
        if (!wrote) throw new Error('backup status write failed');
        if (verdict.ok !== true) throw new Error('firestore export did not finish');
        console.log('[BACKUP] export finished', date);
    } catch (e) {
        console.error('[BACKUP] export failed', shortError(e));
        if (!recorded) {
            try {
                await recordFirestoreExportAttempt({
                    date: date,
                    outputUriPrefix: outputUriPrefix,
                    error: 'export request failed',
                });
            } catch (markerErr) {
                console.error('[BACKUP] Could not record export failure', shortError(markerErr));
            }
        }
        if (e && e.message === 'backup status write failed') throw e;
        throw new Error('firestore export did not finish');
    }
}

async function recordFirestoreExportAttempt(input) {
    const src = input || {};
    const token = src.token || await accessToken();
    const now = new Date().toISOString();
    const failed = !!src.error;
    const body = {
        date: src.date,
        outputUriPrefix: src.outputUriPrefix,
        operation: src.operation || null,
        error: failed ? 'export request failed' : null,
        recordedAt: now,
    };
    await uploadJson(token, FIRESTORE_BACKUP_BUCKET, 'status/firestore-' + src.date + '.json', body);
    await recordJob({
        job: 'firestore',
        date: src.date,
        ok: false,
        startedAt: now,
        finishedAt: now,
        detail: failed ? 'Firestore export request failed' : 'Firestore export started',
    });
}

// nightlyAuthExport runs as bq-auth-backup, which has no Datastore access.
// It does not write backup_status. The 05:00 health check records all four jobs.
async function exportAuthUsers(input) {
    try {
        await runAuthExport(input, utcDate());
    } catch (e) {
        console.error('[auth-backup] failed', shortError(e));
        throw e;
    }
}

async function runAuthExport(input, date) {
    const key = crypto.parseBackupKey(input && input.key);
    const token = await accessToken();
    let hashConfig = null;
    try {
        hashConfig = await fetchHashConfig(token);
    } catch (e) {
        console.error('[auth-backup] hash config unavailable', e.status || '', shortError(e));
    }
    const users = [];
    let pageToken;
    let pages = 0;
    let anonymous = 0;
    let passwordHashes = 0;
    let passwordUsers = 0;
    do {
        pages++;
        if (pages > AUTH_PAGE_LIMIT) throw new Error('auth export exceeded ' + AUTH_PAGE_LIMIT + ' pages');
        const page = await admin.auth().listUsers(1000, pageToken);
        const listed = page.users || [];
        for (let i = 0; i < listed.length; i++) {
            const rec = format.serializeAuthUser(listed[i]);
            if (rec.passwordHash) passwordHashes++;
            if (format.isPasswordUser(rec)) passwordUsers++;
            if (format.isAnonymousRecord(rec)) anonymous++;
            users.push(rec);
        }
        pageToken = page.pageToken;
    } while (pageToken);

    const exportedAt = new Date().toISOString();
    const jsonl = format.buildJsonl({
        exportedAt,
        projectId: PROJECT_ID,
        userCount: users.length,
        hashConfig,
    }, users);
    const gz = zlib.gzipSync(Buffer.from(jsonl));
    const objectName = 'auth/' + date + '/users.jsonl.gz.enc';
    const enc = crypto.encryptAesGcm(gz, key, objectName);
    // objectCreator cannot overwrite. A second run the same day gets 403 and fails closed.
    // kid and sha256 are set on create. objectCreator cannot update metadata later.
    await uploadBytes(token, AUTH_BACKUP_BUCKET, objectName, enc, 'application/octet-stream', {
        kid: crypto.keyIdHex(key),
        sha256: crypto.plaintextSha256(gz),
    });
    const manifest = {
        date,
        userCount: users.length,
        anonymousCount: anonymous,
        passwordUserCount: passwordUsers,
        passwordHashCount: passwordHashes,
        hashConfigIncluded: !!hashConfig,
        alg: 'AES-256-GCM',
        bytes: enc.length,
        createdAt: exportedAt,
    };
    await uploadJson(token, AUTH_BACKUP_BUCKET, 'auth/' + date + '/manifest.json', manifest);
    console.log('[auth-backup] wrote', objectName, 'users', users.length, 'anonymous', anonymous, 'passwordUsers', passwordUsers, 'passwordHashes', passwordHashes);
    return users.length;
}

function shapeRules(release, ruleset) {
    const files = (ruleset.source && ruleset.source.files) || [];
    return {
        release: release.name,
        ruleset: release.rulesetName,
        createTime: release.createTime || null,
        updateTime: release.updateTime || null,
        files: files.map((file) => ({ name: file.name, content: file.content || '' })),
    };
}

async function listCloudFunctions(token) {
    const urls = [
        'https://cloudfunctions.googleapis.com/v2/projects/' + PROJECT_ID + '/locations/-/functions?pageSize=100',
        'https://cloudfunctions.googleapis.com/v1/projects/' + PROJECT_ID + '/locations/us-central1/functions?pageSize=100',
    ];
    const out = [];
    for (let i = 0; i < urls.length; i++) {
        try {
            const field = urls[i].indexOf('/v2/') !== -1 ? 'functions' : 'functions';
            const batch = await listPaged(urls[i], token, field);
            for (let j = 0; j < batch.length; j++) out.push(health.sanitizeCloudFunction(batch[j]));
        } catch (e) {
            console.error('[config-backup] function list', e.status || '', shortError(e));
            if (i === urls.length - 1 && !out.length) throw e;
        }
    }
    return out;
}

async function snapshotConfig() {
    const startedAt = new Date().toISOString();
    const date = utcDate();
    try {
        await runConfigSnapshot(date);
        await recordJob({
            job: 'config',
            date: date,
            ok: true,
            startedAt: startedAt,
            finishedAt: new Date().toISOString(),
            detail: 'config snapshot written',
        });
    } catch (e) {
        console.error('[config-backup] failed', shortError(e));
        await recordJob({
            job: 'config',
            date: date,
            ok: false,
            startedAt: startedAt,
            finishedAt: new Date().toISOString(),
            detail: 'config snapshot failed',
        });
        throw e;
    }
}

async function runConfigSnapshot(date) {
    const token = await accessToken();
    const releases = await listPaged(
        'https://firebaserules.googleapis.com/v1/projects/' + PROJECT_ID + '/releases?pageSize=100',
        token,
        'releases'
    );
    const firestoreRelease = releases.find((rel) => rel.name && rel.name.endsWith('/releases/cloud.firestore'));
    const storageRelease = releases.find((rel) => rel.name && rel.name.endsWith('/releases/firebase.storage'));
    if (!firestoreRelease) throw new Error('Firestore rules release cloud.firestore was not found');
    if (!storageRelease) throw new Error('Storage rules release firebase.storage was not found');
    const firestoreRuleset = await apiJson('https://firebaserules.googleapis.com/v1/' + firestoreRelease.rulesetName, { token });
    const storageRuleset = await apiJson('https://firebaserules.googleapis.com/v1/' + storageRelease.rulesetName, { token });
    const db = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/collectionGroups/-/';
    const indexes = await listPaged(db + 'indexes?pageSize=300', token, 'indexes');
    const fields = await listPaged(db + 'fields?pageSize=300&filter=' + encodeURIComponent('ttl'), token, 'fields');
    const jobs = await listSchedulerJobs(token);
    const functions = await listCloudFunctions(token);
    const prefix = 'config/' + date + '/';
    await uploadJson(token, FIRESTORE_BACKUP_BUCKET, prefix + 'firestore-rules.json', shapeRules(firestoreRelease, firestoreRuleset));
    await uploadJson(token, FIRESTORE_BACKUP_BUCKET, prefix + 'storage-rules.json', shapeRules(storageRelease, storageRuleset));
    await uploadJson(token, FIRESTORE_BACKUP_BUCKET, prefix + 'firestore-indexes.json', { indexes });
    await uploadJson(token, FIRESTORE_BACKUP_BUCKET, prefix + 'firestore-ttl.json', { fields });
    await uploadJson(token, FIRESTORE_BACKUP_BUCKET, prefix + 'scheduler-jobs.json', {
        jobs: jobs.map(health.sanitizeSchedulerJob),
    });
    await uploadJson(token, FIRESTORE_BACKUP_BUCKET, prefix + 'cloud-functions.json', { functions: functions });
    console.log('[config-backup] wrote', prefix, 'indexes', indexes.length, 'ttl', fields.length, 'jobs', jobs.length, 'functions', functions.length);
}

async function listSchedulerJobs(token) {
    let locations = ['us-central1'];
    try {
        const listed = await apiJson(
            'https://cloudscheduler.googleapis.com/v1/projects/' + PROJECT_ID + '/locations',
            { token }
        );
        const ids = (listed.locations || []).map((loc) => loc.locationId).filter(Boolean);
        if (ids.length) locations = ids;
    } catch (e) {
        console.error('[config-backup] scheduler locations', e.status || '', shortError(e));
    }
    const jobs = [];
    for (let i = 0; i < locations.length; i++) {
        try {
            const batch = await listPaged(
                'https://cloudscheduler.googleapis.com/v1/projects/' + PROJECT_ID
                    + '/locations/' + locations[i] + '/jobs?pageSize=500',
                token,
                'jobs'
            );
            for (let j = 0; j < batch.length; j++) jobs.push(batch[j]);
        } catch (e) {
            console.error('[config-backup] scheduler', locations[i], e.status || '', shortError(e));
        }
    }
    if (!jobs.length) throw new Error('Cloud Scheduler returned no jobs');
    return jobs;
}

async function sinkVersioningEnabled(token) {
    const meta = await apiJson(
        'https://storage.googleapis.com/storage/v1/b/' + encodeURIComponent(UPLOADS_BACKUP_BUCKET),
        { token }
    );
    return !!(meta.versioning && meta.versioning.enabled);
}

async function ensureTransferJob(token) {
    const versioned = await sinkVersioningEnabled(token);
    const filter = encodeURIComponent(JSON.stringify({ projectId: PROJECT_ID }));
    const listed = await apiJson(
        'https://storagetransfer.googleapis.com/v1/transferJobs?filter=' + filter + '&pageSize=256',
        { token }
    );
    const jobs = listed.transferJobs || [];
    const existing = jobs.find((job) => {
        const spec = job.transferSpec || {};
        const source = spec.gcsDataSource && spec.gcsDataSource.bucketName;
        const sink = spec.gcsDataSink && spec.gcsDataSink.bucketName;
        return job.description === UPLOADS_JOB_DESCRIPTION
            && source === UPLOADS_SOURCE_BUCKET
            && sink === UPLOADS_BACKUP_BUCKET;
    });
    if (existing) return existing;
    // Propagate deletes only when the sink keeps noncurrent versions. Otherwise
    // a bad run could remove the only copy of an object.
    return apiJson('https://storagetransfer.googleapis.com/v1/transferJobs', {
        token,
        method: 'POST',
        body: {
            description: UPLOADS_JOB_DESCRIPTION,
            status: 'ENABLED',
            projectId: PROJECT_ID,
            transferSpec: {
                gcsDataSource: { bucketName: UPLOADS_SOURCE_BUCKET },
                gcsDataSink: { bucketName: UPLOADS_BACKUP_BUCKET },
                transferOptions: {
                    overwriteWhen: 'DIFFERENT',
                    deleteObjectsUniqueInSink: versioned,
                    deleteObjectsFromSourceAfterTransfer: false,
                },
            },
        },
    });
}

async function copyUploads() {
    const startedAt = new Date().toISOString();
    const date = utcDate();
    try {
        const result = await runUploadsCopy(date);
        await recordJob({
            job: 'uploads',
            date: date,
            ok: result.ok === true,
            startedAt: startedAt,
            finishedAt: new Date().toISOString(),
            detail: result.detail,
        });
        if (!result.settled) throw new Error('uploads backup did not finish');
    } catch (e) {
        if (e && e.message === 'uploads backup did not finish') throw e;
        console.error('[uploads-backup] failed', shortError(e));
        await recordJob({
            job: 'uploads',
            date: date,
            ok: false,
            startedAt: startedAt,
            finishedAt: new Date().toISOString(),
            detail: 'uploads copy failed',
        });
        throw e;
    }
}

async function runUploadsCopy(date) {
    const token = await accessToken();
    let job = null;
    let op = null;
    try {
        job = await ensureTransferJob(token);
        op = await apiJson(
            'https://storagetransfer.googleapis.com/v1/' + job.name + ':run',
            { token, method: 'POST', body: { projectId: PROJECT_ID } }
        );
    } catch (e) {
        console.error('[uploads-backup] storage transfer unavailable', e.status || '', shortError(e));
        const fallback = await incrementalFallback(token, date);
        await uploadJson(token, UPLOADS_BACKUP_BUCKET, 'status/' + date + '.json', {
            date,
            started: true,
            mode: 'incremental-fallback',
            operation: null,
            error: fallback.complete ? null : 'incremental copy did not finish',
            fallbackComplete: fallback.complete,
            copied: fallback.copied,
            examined: fallback.examined,
            startedAt: new Date().toISOString(),
        });
        if (!fallback.complete) return { ok: false, settled: false, detail: 'uploads copy did not finish' };
        return { ok: true, settled: true, detail: 'uploads incremental copy finished' };
    }
    await uploadJson(token, UPLOADS_BACKUP_BUCKET, 'status/' + date + '.json', {
        date,
        started: true,
        mode: 'storage-transfer-service',
        job: job.name,
        operation: op.name || null,
        error: null,
        fallbackComplete: false,
        startedAt: new Date().toISOString(),
    });
    console.log('[uploads-backup] started', job.name, op.name || '');
    return { ok: false, settled: true, detail: 'uploads transfer started' };
}

async function destNeedsCopy(token, src) {
    let dest;
    try {
        dest = await objectMeta(token, UPLOADS_BACKUP_BUCKET, src.name);
    } catch (e) {
        if (e.status === 404) return true;
        throw e;
    }
    if (src.md5Hash && dest.md5Hash && src.md5Hash === dest.md5Hash) return false;
    if (!src.md5Hash) {
        const stored = dest.metadata && dest.metadata.sourceGeneration;
        return String(stored || '') !== String(src.generation || '');
    }
    return true;
}

async function rewriteObject(token, src) {
    const url = 'https://storage.googleapis.com/storage/v1/b/' + encodeURIComponent(UPLOADS_SOURCE_BUCKET)
        + '/o/' + encodeURIComponent(src.name)
        + '/rewriteTo/b/' + encodeURIComponent(UPLOADS_BACKUP_BUCKET)
        + '/o/' + encodeURIComponent(src.name);
    let rewriteToken = '';
    const body = { metadata: { sourceGeneration: String(src.generation || '') } };
    for (let guard = 0; guard < 20; guard++) {
        const target = rewriteToken ? url + '?rewriteToken=' + encodeURIComponent(rewriteToken) : url;
        const res = await apiJson(target, { token, method: 'POST', body });
        if (res.done || !res.rewriteToken) return;
        rewriteToken = res.rewriteToken;
    }
    throw new Error('rewrite did not finish');
}

async function incrementalFallback(token, date) {
    const deadline = Date.now() + FALLBACK_BUDGET_MS;
    let checkpoint = null;
    try {
        checkpoint = await downloadJson(token, UPLOADS_BACKUP_BUCKET, 'status/fallback-checkpoint.json');
    } catch (e) {
        if (e.status !== 404) throw e;
    }
    if (checkpoint && checkpoint.done && checkpoint.date === date) {
        return { complete: true, copied: checkpoint.copied || 0, examined: checkpoint.examined || 0 };
    }
    let pageToken = checkpoint && !checkpoint.done ? (checkpoint.pageToken || '') : '';
    let copied = checkpoint && !checkpoint.done ? (checkpoint.copied || 0) : 0;
    let examined = checkpoint && !checkpoint.done ? (checkpoint.examined || 0) : 0;
    let complete = false;
    while (Date.now() < deadline) {
        const page = await listObjects(token, UPLOADS_SOURCE_BUCKET, '', pageToken || undefined);
        const items = page.items || [];
        let interrupted = false;
        for (let i = 0; i < items.length; i++) {
            if (Date.now() >= deadline) {
                interrupted = true;
                break;
            }
            const item = items[i];
            if (!item.name || item.name.charAt(item.name.length - 1) === '/') continue;
            examined++;
            if (await destNeedsCopy(token, item)) {
                await rewriteObject(token, item);
                copied++;
            }
        }
        if (interrupted) break;
        if (!page.nextPageToken) {
            complete = true;
            pageToken = '';
            break;
        }
        pageToken = page.nextPageToken;
    }
    await uploadJson(token, UPLOADS_BACKUP_BUCKET, 'status/fallback-checkpoint.json', {
        date,
        pageToken: pageToken || '',
        copied,
        examined,
        done: complete,
        updatedAt: new Date().toISOString(),
    });
    return { complete, copied, examined };
}

async function scanExportFolder(token, date) {
    let pageToken = '';
    let count = 0;
    let metadata = false;
    for (let pages = 0; pages < 4; pages++) {
        const page = await listObjects(token, FIRESTORE_BACKUP_BUCKET, date + '/', pageToken || undefined);
        const items = page.items || [];
        count += items.length;
        for (let i = 0; i < items.length; i++) {
            const name = items[i].name || '';
            if (name.indexOf('overall_export_metadata') !== -1 || name.endsWith('.export_metadata')) metadata = true;
        }
        if (metadata || !page.nextPageToken || count >= 2000) break;
        pageToken = page.nextPageToken;
    }
    return { count, metadata };
}

async function gatherFirestore(token, date) {
    let marker = null;
    try {
        marker = await downloadJson(token, FIRESTORE_BACKUP_BUCKET, 'status/firestore-' + date + '.json');
    } catch (e) {
        if (e.status !== 404) throw e;
    }
    let operationDone = null;
    let operationError = null;
    if (marker && marker.operation && !marker.error) {
        try {
            const op = await apiJson('https://firestore.googleapis.com/v1/' + marker.operation, { token });
            operationDone = op.done === true;
            if (op.error) operationError = op.error.message || 'export operation failed';
        } catch (e) {
            operationError = 'could not read export operation';
        }
    }
    const folder = await scanExportFolder(token, date);
    return health.assessFirestore({
        markerError: marker && marker.error ? marker.error : null,
        operationDone,
        operationError,
        objectCount: folder.count,
        sawMetadata: folder.metadata,
    });
}

async function previousAuthCount(token, date) {
    for (let i = 1; i <= 14; i++) {
        const day = health.addUtcDays(date, -i);
        try {
            const manifest = await downloadJson(token, AUTH_BACKUP_BUCKET, 'auth/' + day + '/manifest.json');
            if (manifest && typeof manifest.userCount === 'number') return manifest.userCount;
        } catch (e) {
            if (e.status !== 404) throw e;
        }
    }
    return null;
}

async function gatherAuth(token, date) {
    let meta = null;
    try {
        meta = await objectMeta(token, AUTH_BACKUP_BUCKET, 'auth/' + date + '/users.jsonl.gz.enc');
    } catch (e) {
        if (e.status !== 404) throw e;
    }
    let manifest = null;
    try {
        manifest = await downloadJson(token, AUTH_BACKUP_BUCKET, 'auth/' + date + '/manifest.json');
    } catch (e) {
        if (e.status !== 404) throw e;
    }
    let headerOk = false;
    if (meta) {
        try {
            const head = await downloadRange(token, AUTH_BACKUP_BUCKET, 'auth/' + date + '/users.jsonl.gz.enc', 0, 4);
            headerOk = crypto.headerMatches(head);
        } catch (e) {
            console.error('[backup-health] auth header', e.status || '', shortError(e));
            headerOk = false;
        }
    }
    const previous = await previousAuthCount(token, date);
    return health.assessAuth({
        present: !!meta,
        bytes: meta ? Number(meta.size) : 0,
        headerOk: headerOk,
        manifestPresent: !!manifest,
        hashConfigIncluded: !!(manifest && manifest.hashConfigIncluded === true),
        passwordUserCount: manifest && typeof manifest.passwordUserCount === 'number' ? manifest.passwordUserCount : undefined,
        passwordHashCount: manifest && typeof manifest.passwordHashCount === 'number' ? manifest.passwordHashCount : undefined,
        userCount: manifest ? manifest.userCount : undefined,
        previousCount: previous,
    });
}

async function gatherUploads(token, date) {
    let status = null;
    try {
        status = await downloadJson(token, UPLOADS_BACKUP_BUCKET, 'status/' + date + '.json');
    } catch (e) {
        if (e.status !== 404) {
            console.error('[backup-health] uploads status', e.status || '', shortError(e));
            return health.assessUploads({ unreadable: true, detail: 'uploads copy status could not be read' });
        }
    }
    if (!status) {
        return health.assessUploads({ statusMissing: true, detail: 'uploads copy status was not recorded' });
    }
    if (status.fallbackComplete === true && !status.error) {
        return health.assessUploads({ fallbackComplete: true });
    }
    if (status.error) {
        return health.assessUploads({ operationError: true, detail: 'uploads copy failed' });
    }
    if (!status.operation) {
        return health.assessUploads({ statusMissing: true, detail: 'uploads copy operation was not recorded' });
    }
    let operationStatus = '';
    let operationError = null;
    try {
        const op = await apiJson('https://storagetransfer.googleapis.com/v1/' + status.operation, { token });
        operationStatus = (op.metadata && op.metadata.status) || '';
        if (op.error) operationError = 'failed';
        if (op.done && !operationStatus && !op.error) operationStatus = 'SUCCESS';
        if (!operationStatus && !operationError) {
            return health.assessUploads({ unreadable: true, detail: 'uploads copy status could not be read' });
        }
    } catch (e) {
        console.error('[backup-health] transfer operation', e.status || '', shortError(e));
        return health.assessUploads({ unreadable: true, detail: 'uploads copy status could not be read' });
    }
    return health.assessUploads({
        operationStatus,
        operationError,
        fallbackComplete: false,
    });
}

async function gatherConfig(token, date) {
    const page = await listObjects(token, FIRESTORE_BACKUP_BUCKET, 'config/' + date + '/');
    const names = (page.items || []).map((item) => {
        const parts = String(item.name || '').split('/');
        return parts[parts.length - 1];
    });
    return health.assessConfig(names);
}

async function guard(name, fn) {
    try {
        return await fn();
    } catch (e) {
        console.error('[backup-health]', name, e.status || '', shortError(e));
        const detail = name + ' check could not be read: ' + shortError(e);
        if (name === 'firestore') return { succeeded: false, folderPresent: false, detail };
        if (name === 'auth') return { present: false, countOk: false, detail };
        if (name === 'uploads') return { ran: false, detail };
        return { present: false, detail };
    }
}

function verifiedJob(name, report) {
    if (name === 'firestore') {
        return {
            ok: report.succeeded === true && report.folderPresent === true,
            detail: report.detail || 'Firestore export did not succeed',
        };
    }
    if (name === 'auth') {
        return {
            ok: report.present === true && report.countOk === true,
            detail: report.detail || 'Auth export failed the health check',
        };
    }
    if (name === 'uploads') {
        return {
            ok: report.ran === true,
            detail: report.detail || 'Uploads copy did not run',
        };
    }
    return {
        ok: report.present === true,
        detail: report.detail || 'Config snapshot is missing',
    };
}

async function checkBackupHealth() {
    const date = utcDate();
    let report;
    try {
        const token = await accessToken();
        report = {
            firestore: await guard('firestore', () => gatherFirestore(token, date)),
            auth: await guard('auth', () => gatherAuth(token, date)),
            uploads: await guard('uploads', () => gatherUploads(token, date)),
            config: await guard('config', () => gatherConfig(token, date)),
        };
    } catch (e) {
        console.error('[backup-health] could not start', shortError(e));
        const detail = 'backup health check could not start';
        report = {
            firestore: { succeeded: false, folderPresent: false, detail },
            auth: { present: false, countOk: false, detail },
            uploads: { ran: false, detail },
            config: { present: false, detail },
        };
    }
    const verdict = health.evaluateBackupHealth(report);
    const finishedAt = new Date().toISOString();
    const stamp = finishedAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const names = backupStatus.JOB_NAMES;
    const events = [];
    for (let i = 0; i < names.length; i++) {
        const job = names[i];
        const verified = verifiedJob(job, report[job] || {});
        events.push({
            job: job,
            date: date,
            ok: verified.ok,
            finishedAt: finishedAt,
            verifiedAt: finishedAt,
            detail: verified.detail,
            runId: 'verify-' + job + '-' + stamp,
        });
    }
    try {
        await backupStatus.writeBackupResults(admin.firestore(), admin, events, finishedAt, { r2Required: true });
    } catch (e) {
        console.error('[backup-status] health write failed', shortError(e));
        throw new Error('backup status write failed');
    }
    const failed = verdict.failures.map((failure) => failure.check).join(', ');
    console.log('[backup-health]', date, verdict.ok ? 'ok' : ('failed: ' + failed));
    return verdict;
}

module.exports = {
    PROJECT_ID,
    FIRESTORE_BACKUP_BUCKET,
    AUTH_BACKUP_BUCKET,
    UPLOADS_SOURCE_BUCKET,
    UPLOADS_BACKUP_BUCKET,
    recordFirestoreExportAttempt,
    classifyExportOperation,
    confirmExportFinished,
    exportFirestore,
    exportAuthUsers,
    copyUploads,
    snapshotConfig,
    checkBackupHealth,
};
