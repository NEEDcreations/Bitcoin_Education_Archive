#!/usr/bin/env node
'use strict';

// Replace Telegram bot file URLs stored in Firestore.
//
// Dry-run is the default. It reads global_chat (the only collection the
// chat-bridge worker writes these URLs into) and prints counts and document
// ids. It does not write and it does not print URLs or bot tokens.
//
//   node scripts/scrub-telegram-urls.js
//   node scripts/scrub-telegram-urls.js --apply
//
// --apply writes a local JSON backup of every affected document first, then
// downloads each file and stores a Firebase Storage download URL under
// chat-images/tg/<random>. When the file can no longer be fetched, the field
// is set to null and the document gets mediaRemoved: true.
// After a successful --apply, maintenance/telegram_file_url_scrub is marked
// applied. A later run, with or without --apply, does nothing.
//
// The backup file contains the original URLs. It is written under
// scripts/.telegram-url-scrub/ which is gitignored. Keep it private and
// delete it after the bot tokens are rotated.
//
// Credentials are Application Default Credentials. No key file is read.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const guard = require(path.join(__dirname, '..', 'functions', 'src', 'telegramFileGuard'));

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'bitcoin-education-archive';
const BUCKET_NAME = process.env.FIREBASE_STORAGE_BUCKET || 'bitcoin-education-archive.firebasestorage.app';
const PAGE = 300;
const MAX_BYTES = 20 * 1024 * 1024;
const BACKUP_DIR = path.join(__dirname, '.telegram-url-scrub');

function parseArgs(argv) {
    return {
        help: argv.indexOf('--help') !== -1 || argv.indexOf('-h') !== -1,
        apply: argv.indexOf('--apply') !== -1,
    };
}

function say(log, line) {
    const out = guard.redactSecrets(line);
    if (guard.containsTelegramBotMaterial(out)) return;
    (log || console.log)(out);
}

function toPlain(value) {
    if (value == null) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value.toDate === 'function') {
        try { return { _timestamp: value.toDate().toISOString() }; }
        catch (err) { return { _timestamp: null }; }
    }
    if (Array.isArray(value)) return value.map(toPlain);
    if (typeof value === 'object') {
        const out = {};
        Object.keys(value).forEach(function (key) { out[key] = toPlain(value[key]); });
        return out;
    }
    return null;
}

function changedPatch(before, after) {
    const patch = {};
    const keys = Object.create(null);
    Object.keys(before || {}).forEach(function (key) { keys[key] = true; });
    Object.keys(after || {}).forEach(function (key) { keys[key] = true; });
    Object.keys(keys).forEach(function (key) {
        if (JSON.stringify(toPlain(before[key])) !== JSON.stringify(toPlain(after[key]))) {
            patch[key] = after[key];
        }
    });
    return patch;
}

async function scrubDocument(data, rehost) {
    const leaks = guard.listTelegramBotMaterial(data);
    if (!leaks.length) return null;
    let next = data;
    let removed = 0;
    let rehosted = 0;
    const fields = [];
    for (let i = 0; i < leaks.length; i++) {
        const leak = leaks[i];
        fields.push(guard.fieldLabel(leak.path));
        let hosted = null;
        if (typeof leak.value === 'string' && leak.value.indexOf('http') === 0) {
            try { hosted = await rehost(leak.value); }
            catch (err) { hosted = null; }
        }
        if (hosted && !guard.containsTelegramBotMaterial(hosted)) {
            next = guard.setAt(next, leak.path, hosted);
            rehosted += 1;
        } else {
            next = guard.setAt(next, leak.path, null);
            removed += 1;
        }
    }
    if (removed) next = Object.assign({}, next, { mediaRemoved: true });
    guard.assertFirestoreSafe(next);
    return {
        next: next,
        patch: changedPatch(data, next),
        removed: removed,
        rehosted: rehosted,
        fields: fields,
    };
}

async function listCollection(db, name, documentIdField) {
    const rows = [];
    let last = null;
    for (;;) {
        let query = db.collection(name).orderBy(documentIdField).limit(PAGE);
        if (last) query = query.startAfter(last);
        const snap = await query.get();
        if (!snap || snap.empty) break;
        const docs = snap.docs || [];
        docs.forEach(function (doc) {
            rows.push({ id: doc.id, data: doc.data() || {} });
        });
        last = docs[docs.length - 1];
        if (docs.length < PAGE) break;
    }
    return rows;
}

function writeBackup(dir, docs, nowIso) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const stamp = String(nowIso || new Date().toISOString()).replace(/[:.]/g, '-');
    const file = path.join(dir, 'backup-' + stamp + '.json');
    const body = JSON.stringify({
        createdAt: nowIso || new Date().toISOString(),
        collections: guard.SCRUB_COLLECTIONS.slice(),
        docs: docs.map(function (row) {
            return {
                collection: row.collection,
                id: row.id,
                data: toPlain(row.data),
            };
        }),
    });
    fs.writeFileSync(file, body, { mode: 0o600 });
    return file;
}

async function runScrub(options) {
    const opts = options || {};
    const log = opts.log || console.log;
    const apply = opts.apply === true;
    const db = opts.db;
    const marker = opts.marker || guard.SCRUB_MARKER;
    const collections = (opts.collections || guard.SCRUB_COLLECTIONS).slice();
    const markerRef = db.collection(marker.collection).doc(marker.id);
    const markerSnap = await markerRef.get();
    const markerData = markerSnap && markerSnap.exists && markerSnap.data ? (markerSnap.data() || {}) : null;
    if (markerData && markerData.applied === true) {
        say(log, 'already-applied collection=' + marker.collection + ' id=' + marker.id);
        return { alreadyApplied: true, affected: 0, rehosted: 0, removed: 0, wrote: false };
    }

    const affected = [];
    for (let i = 0; i < collections.length; i++) {
        const name = collections[i];
        const rows = await opts.listDocs(name);
        for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            if (!guard.findTelegramBotMaterial(row.data)) continue;
            affected.push({ collection: name, id: row.id, data: row.data });
        }
    }

    say(log, 'mode=' + (apply ? 'apply' : 'dry-run'));
    say(log, 'affected=' + affected.length);
    for (let i = 0; i < affected.length; i++) {
        const row = affected[i];
        const fields = guard.listTelegramBotMaterial(row.data).map(function (leak) {
            return guard.fieldLabel(leak.path);
        });
        say(log, 'doc=' + row.collection + '/' + row.id + ' fields=' + fields.join(','));
    }
    if (!apply) {
        say(log, 'dry-run only. pass --apply to rewrite these documents.');
        return { alreadyApplied: false, affected: affected.length, rehosted: 0, removed: 0, wrote: false };
    }

    const backupFile = writeBackup(opts.backupDir || BACKUP_DIR, affected, opts.nowIso || new Date().toISOString());
    say(log, 'backup-written bytes=' + fs.statSync(backupFile).size);

    let rehosted = 0;
    let removed = 0;
    for (let i = 0; i < affected.length; i++) {
        const row = affected[i];
        const result = await scrubDocument(row.data, opts.rehost);
        if (!result) continue;
        guard.assertFirestoreSafe(result.patch);
        await opts.updateDoc(row.collection, row.id, result.patch);
        rehosted += result.rehosted;
        removed += result.removed;
        const action = result.removed ? 'removed' : 'rehosted';
        say(log, 'updated=' + row.collection + '/' + row.id + ' action=' + action);
    }

    const markerBody = {
        applied: true,
        appliedAt: opts.nowIso || new Date().toISOString(),
        collections: collections,
        affected: affected.length,
        rehosted: rehosted,
        removed: removed,
    };
    guard.assertFirestoreSafe(markerBody);
    await markerRef.set(markerBody);
    say(log, 'applied affected=' + affected.length + ' rehosted=' + rehosted + ' removed=' + removed);
    return {
        alreadyApplied: false,
        affected: affected.length,
        rehosted: rehosted,
        removed: removed,
        wrote: true,
        backupFile: backupFile,
    };
}

function extensionForUpload(url, mime) {
    const fromUrl = guard.extensionFromTelegramFileUrl(url);
    if (fromUrl !== 'bin') return fromUrl;
    const type = String(mime || '').toLowerCase();
    if (type.indexOf('png') !== -1) return 'png';
    if (type.indexOf('webp') !== -1) return 'webp';
    if (type.indexOf('gif') !== -1) return 'gif';
    if (type.indexOf('mp4') !== -1) return 'mp4';
    if (type.indexOf('jpeg') !== -1 || type.indexOf('jpg') !== -1) return 'jpg';
    return 'bin';
}

function makeStorageRehost(bucket, fetchImpl) {
    return async function rehost(url) {
        let resp;
        try {
            resp = await fetchImpl(url);
        } catch (err) {
            return null;
        }
        if (!resp || !resp.ok) return null;
        const headerLen = Number(resp.headers && resp.headers.get && resp.headers.get('content-length')) || 0;
        if (headerLen > MAX_BYTES) return null;
        const buf = Buffer.from(await resp.arrayBuffer());
        if (!buf.length || buf.length > MAX_BYTES) return null;
        const mimeHeader = resp.headers && resp.headers.get ? (resp.headers.get('content-type') || '') : '';
        const mime = mimeHeader.split(';')[0].trim();
        const ext = extensionForUpload(url, mime);
        const objectPath = guard.objectPathFromBytes(crypto.randomBytes(16), ext);
        const downloadToken = guard.hexOf(crypto.randomBytes(16));
        await bucket.file(objectPath).save(buf, {
            resumable: false,
            metadata: {
                contentType: mime || guard.mimeForExtension(ext),
                metadata: { firebaseStorageDownloadTokens: downloadToken },
            },
        });
        return guard.storageDownloadUrl(bucket.name, objectPath, downloadToken);
    };
}

function loadAdmin() {
    try { return require('firebase-admin'); }
    catch (err) { return require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin')); }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log('Usage: node scripts/scrub-telegram-urls.js [--apply]');
        console.log('Dry-run is the default. --apply rehosts media and then marks the scrub applied.');
        console.log('Collections: ' + guard.SCRUB_COLLECTIONS.join(','));
        return;
    }
    const admin = loadAdmin();
    if (!admin.apps.length) {
        admin.initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET_NAME });
    }
    const db = admin.firestore();
    const documentIdField = admin.firestore.FieldPath.documentId();
    const fetchImpl = typeof fetch === 'function' ? fetch : require('node-fetch');
    const summary = await runScrub({
        apply: args.apply,
        db: db,
        nowIso: new Date().toISOString(),
        listDocs: function (name) { return listCollection(db, name, documentIdField); },
        updateDoc: function (name, id, patch) {
            return db.collection(name).doc(id).update(patch);
        },
        rehost: makeStorageRehost(admin.storage().bucket(BUCKET_NAME), fetchImpl),
    });
    if (!summary.wrote && !summary.alreadyApplied) {
        say(console.log, 'no writes');
    }
}

module.exports = {
    SCRUB_COLLECTIONS: guard.SCRUB_COLLECTIONS,
    SCRUB_MARKER: guard.SCRUB_MARKER,
    toPlain: toPlain,
    changedPatch: changedPatch,
    scrubDocument: scrubDocument,
    runScrub: runScrub,
    writeBackup: writeBackup,
    extensionForUpload: extensionForUpload,
};

if (require.main === module) {
    main().catch(function (err) {
        const message = guard.redactSecrets(err && err.message ? err.message : err);
        if (!guard.containsTelegramBotMaterial(message)) console.error('scrub failed: ' + message);
        else console.error('scrub failed');
        process.exit(1);
    });
}
