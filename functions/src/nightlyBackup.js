'use strict';

// Nightly backups for Bitcoin Quest. Scheduled from functions/index.js.
// No HTTPS handlers. Failure mail goes only to backupHealth.ALERT_EMAIL
// through nodemailer. Do not send these alerts to Telegram, Discord, or any
// other chat. The Telegram group is public.

const zlib = require('zlib');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const crypto = require('./authBackupCrypto');
const format = require('./authBackupFormat');
const health = require('./backupHealth');

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

async function uploadBytes(token, bucket, name, buffer, contentType) {
    const type = contentType || 'application/octet-stream';
    const bucketPath = encodeURIComponent(bucket);
    const object = encodeURIComponent(name);
    if (buffer.length <= 4 * 1024 * 1024) {
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
    const start = await fetch(startUrl, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': type,
            'X-Upload-Content-Length': String(buffer.length),
        },
        body: JSON.stringify({ contentType: type }),
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

async function recordFirestoreExportAttempt(input) {
    const src = input || {};
    const token = src.token || await accessToken();
    const body = {
        date: src.date,
        outputUriPrefix: src.outputUriPrefix,
        operation: src.operation || null,
        error: src.error ? String(src.error).slice(0, 300) : null,
        recordedAt: new Date().toISOString(),
    };
    await uploadJson(token, FIRESTORE_BACKUP_BUCKET, 'status/firestore-' + src.date + '.json', body);
}

async function exportAuthUsers(input) {
    const key = crypto.parseBackupKey(input && input.key);
    const date = utcDate();
    const token = await accessToken();
    let hashConfig = null;
    try {
        hashConfig = await fetchHashConfig(token);
    } catch (e) {
        console.error('[auth-backup] hash config unavailable', e.status || '', e.message);
    }
    const users = [];
    let pageToken;
    let pages = 0;
    let anonymous = 0;
    let passwordHashes = 0;
    do {
        pages++;
        if (pages > AUTH_PAGE_LIMIT) throw new Error('auth export exceeded ' + AUTH_PAGE_LIMIT + ' pages');
        const page = await admin.auth().listUsers(1000, pageToken);
        const listed = page.users || [];
        for (let i = 0; i < listed.length; i++) {
            const rec = format.serializeAuthUser(listed[i]);
            if (rec.passwordHash) passwordHashes++;
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
    const enc = crypto.encryptAesGcm(gz, key);
    const objectName = 'auth/' + date + '/users.jsonl.gz.enc';
    await uploadBytes(token, AUTH_BACKUP_BUCKET, objectName, enc, 'application/octet-stream');
    const manifest = {
        date,
        userCount: users.length,
        anonymousCount: anonymous,
        passwordHashCount: passwordHashes,
        hashConfigIncluded: !!hashConfig,
        alg: 'AES-256-GCM',
        bytes: enc.length,
        createdAt: exportedAt,
    };
    await uploadJson(token, AUTH_BACKUP_BUCKET, 'auth/' + date + '/manifest.json', manifest);
    console.log('[auth-backup] wrote', objectName, 'users', users.length, 'anonymous', anonymous, 'passwordHashes', passwordHashes);
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

async function snapshotConfig() {
    const date = utcDate();
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
    const prefix = 'config/' + date + '/';
    await uploadJson(token, FIRESTORE_BACKUP_BUCKET, prefix + 'firestore-rules.json', shapeRules(firestoreRelease, firestoreRuleset));
    await uploadJson(token, FIRESTORE_BACKUP_BUCKET, prefix + 'storage-rules.json', shapeRules(storageRelease, storageRuleset));
    await uploadJson(token, FIRESTORE_BACKUP_BUCKET, prefix + 'firestore-indexes.json', { indexes });
    await uploadJson(token, FIRESTORE_BACKUP_BUCKET, prefix + 'firestore-ttl.json', { fields });
    await uploadJson(token, FIRESTORE_BACKUP_BUCKET, prefix + 'scheduler-jobs.json', {
        jobs: jobs.map(health.sanitizeSchedulerJob),
    });
    console.log('[config-backup] wrote', prefix, 'indexes', indexes.length, 'ttl', fields.length, 'jobs', jobs.length);
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
        console.error('[config-backup] scheduler locations', e.status || '', e.message);
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
            console.error('[config-backup] scheduler', locations[i], e.status || '', e.message);
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
    const date = utcDate();
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
        console.error('[uploads-backup] storage transfer unavailable', e.status || '', e.message);
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
        if (!fallback.complete) throw new Error('uploads backup did not finish');
        return;
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
    let first = true;
    for (let guard = 0; guard < 20; guard++) {
        const target = rewriteToken ? url + '?rewriteToken=' + encodeURIComponent(rewriteToken) : url;
        const body = first
            ? { metadata: { sourceGeneration: String(src.generation || '') } }
            : {};
        first = false;
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
    const previous = await previousAuthCount(token, date);
    return health.assessAuth({
        present: !!meta,
        bytes: meta ? Number(meta.size) : 0,
        userCount: manifest ? manifest.userCount : undefined,
        previousCount: previous,
    });
}

async function gatherUploads(token, date) {
    let status = null;
    try {
        status = await downloadJson(token, UPLOADS_BACKUP_BUCKET, 'status/' + date + '.json');
    } catch (e) {
        if (e.status !== 404) throw e;
    }
    let operationStatus = '';
    let operationError = null;
    if (status && status.operation) {
        try {
            const op = await apiJson('https://storagetransfer.googleapis.com/v1/' + status.operation, { token });
            operationStatus = (op.metadata && op.metadata.status) || '';
            if (op.error) operationError = 'failed';
            if (op.done && !operationStatus && !op.error) operationStatus = 'SUCCESS';
        } catch (e) {
            console.error('[backup-health] transfer operation', e.status || '', e.message);
        }
    }
    return health.assessUploads({
        started: !!(status && status.started && !status.error),
        operationStatus,
        operationError: (status && status.error) || operationError,
        fallbackComplete: !!(status && status.fallbackComplete),
        detail: status && status.error ? 'uploads copy failed' : '',
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
        console.error('[backup-health]', name, e.status || '', e.message);
        const detail = name + ' check could not be read: ' + shortError(e);
        if (name === 'firestore') return { succeeded: false, folderPresent: false, detail };
        if (name === 'auth') return { present: false, countOk: false, detail };
        if (name === 'uploads') return { ran: false, detail };
        return { present: false, detail };
    }
}

function alertsCollection() {
    return admin.firestore().collection('backup_alerts');
}

async function reserveAlert(date, nowMs, failures) {
    const ref = alertsCollection().doc(date);
    return admin.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const reduced = health.reduceDedupe(snap.exists ? snap.data() : null, {
            type: 'reserve',
            failures,
        }, nowMs);
        if (!reduced.decision.send) return { reserved: false, reason: reduced.decision.reason };
        tx.set(ref, {
            date,
            sent: false,
            leaseUntil: reduced.state.leaseUntil,
            checks: failures.map((failure) => failure.check),
        });
        return { reserved: true, reason: 'reserved' };
    });
}

async function markAlertSent(date, nowMs, failures) {
    const reduced = health.reduceDedupe(null, { type: 'sent' }, nowMs);
    await alertsCollection().doc(date).set({
        date,
        sent: true,
        leaseUntil: reduced.state.leaseUntil,
        sentAt: new Date(nowMs).toISOString(),
        checks: failures.map((failure) => failure.check),
    }, { merge: true });
}

async function releaseAlert(date) {
    const reduced = health.reduceDedupe(null, { type: 'release' }, Date.now());
    await alertsCollection().doc(date).set({
        sent: false,
        leaseUntil: reduced.state.leaseUntil,
    }, { merge: true });
}

function legacyMail() {
    // firebase-functions v7 throws from functions.config(). Keep the try so a
    // runtime that still has the old mail.user / mail.pass values can send.
    try {
        const functions = require('firebase-functions');
        const cfg = functions.config && functions.config();
        const mail = cfg && cfg.mail;
        if (mail && mail.user && mail.pass) {
            return { user: String(mail.user), pass: String(mail.pass) };
        }
    } catch (e) {
        return null;
    }
    return null;
}

function cleanCred(value) {
    return String(value == null ? '' : value).replace(/[\r\n]/g, '').trim();
}

async function sendAlertMail(input) {
    let user = cleanCred(input.smtpUser);
    let pass = cleanCred(input.smtpPass);
    let source = 'secret-manager';
    if (!user || !pass) {
        const legacy = legacyMail();
        if (legacy) {
            user = cleanCred(legacy.user);
            pass = cleanCred(legacy.pass);
            source = 'functions.config().mail';
        }
    }
    if (!user || !pass) {
        throw new Error('Backup alert email is not configured. Set Secret Manager ALERT_SMTP_USER and ALERT_SMTP_PASS.');
    }
    const nodemailer = require('nodemailer');
    const host = process.env.ALERT_SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.ALERT_SMTP_PORT || 465);
    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
    await transporter.sendMail({
        from: 'Bitcoin Quest Backups <' + user + '>',
        to: health.ALERT_EMAIL,
        subject: 'Bitcoin Quest backup failed (' + input.date + ')',
        text: input.text,
    });
    console.log('[backup-health] alert emailed via', source);
}

async function checkBackupHealth(input) {
    const opts = input || {};
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
        const detail = 'backup health check could not start: ' + shortError(e);
        report = {
            firestore: { succeeded: false, folderPresent: false, detail },
            auth: { present: false, countOk: false, detail },
            uploads: { ran: false, detail },
            config: { present: false, detail },
        };
    }
    const verdict = health.evaluateBackupHealth(report);
    console.log('[backup-health]', date, verdict.ok ? 'ok' : verdict.failures.map((f) => f.check).join(','));
    if (verdict.ok) return verdict;
    const nowMs = Date.now();
    const reserved = await reserveAlert(date, nowMs, verdict.failures);
    if (!reserved.reserved) {
        console.log('[backup-health] alert suppressed', reserved.reason);
        return verdict;
    }
    const text = health.buildAlertBody({
        date,
        failures: verdict.failures,
        checkedAt: new Date(nowMs).toISOString(),
    });
    try {
        await sendAlertMail({
            smtpUser: opts.smtpUser,
            smtpPass: opts.smtpPass,
            date,
            text,
        });
        await markAlertSent(date, nowMs, verdict.failures);
    } catch (e) {
        try { await releaseAlert(date); } catch (releaseErr) {
            console.error('[backup-health] could not release alert lease', releaseErr.message);
        }
        console.error('[backup-health] alert email failed');
        throw e;
    }
    return verdict;
}

module.exports = {
    PROJECT_ID,
    FIRESTORE_BACKUP_BUCKET,
    AUTH_BACKUP_BUCKET,
    UPLOADS_SOURCE_BUCKET,
    UPLOADS_BACKUP_BUCKET,
    recordFirestoreExportAttempt,
    exportAuthUsers,
    copyUploads,
    snapshotConfig,
    checkBackupHealth,
};
