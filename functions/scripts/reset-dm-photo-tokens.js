#!/usr/bin/env node
'use strict';
// One-off admin script: rotate Firebase Storage download tokens on existing
// DM photos (dm-images/...) and rewrite the matching Firestore imageUrl
// fields so old leaked links stop working and members still see their photos.
//
// Default mode is --dry-run (read-only). --apply writes only what is in the
// plan, and only after --plan-sha matches the plan file bytes. Live applies
// also require RESET_CONFIRM=dm-photo-tokens.
//
// Usage:
//   node functions/scripts/reset-dm-photo-tokens.js \
//     --project bitcoin-education-archive \
//     --plan /workspace/private/f2reset/plan.json
//   RESET_CONFIRM=dm-photo-tokens node functions/scripts/reset-dm-photo-tokens.js \
//     --project bitcoin-education-archive \
//     --plan /workspace/private/f2reset/plan.json \
//     --apply --plan-sha <sha256>
//   RESET_CONFIRM=dm-photo-tokens node functions/scripts/reset-dm-photo-tokens.js \
//     --rollback /workspace/private/f2reset/rollback-<run>.json
//   node functions/scripts/reset-dm-photo-tokens.js \
//     --shred-rollback /workspace/private/f2reset/rollback-<run>.json
//
// Never prints secrets, full uids, emails, or download tokens. The plan
// file, audit log, stdout, and test output store only token hashes and
// masked paths. The rollback file is the only place old tokens are
// written (mode 600, under /workspace/private/f2reset/). Those tokens
// are working bearer links to private photos. Keep a 7-day rollback
// window on the ship card, then shred the file with --shred-rollback
// (shred -u).
// Malformed conversations (id not the sorted participant pair, or not
// exactly 2 distinct participants) and their messages are left untouched.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const LIVE_PROJECT = 'bitcoin-education-archive';
const STAGING_PROJECT = 'bitcoin-quest-staging';
const CONFIRM_VALUE = 'dm-photo-tokens';
const PLAN_VERSION = 1;
const DEFAULT_CANONICAL_BUCKET = {
    'bitcoin-education-archive': 'bitcoin-education-archive.firebasestorage.app',
    'bitcoin-quest-staging': 'bitcoin-quest-staging.firebasestorage.app',
};
const F3_BUCKETS = new Set([
    'bitcoin-education-archive.firebasestorage.app',
    'bitcoin-quest-staging.firebasestorage.app',
]);
const DEFAULT_PLAN_DIR = '/workspace/private/f2reset';
const OBJECT_PREFIX = 'dm-images/';

function sha256Hex(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

function maskUid(uid) {
    const s = String(uid || '');
    let prefix = '';
    let rest = s;
    const scheme = s.match(/^(nostr:|ln:)/);
    if (scheme) {
        prefix = scheme[1];
        rest = s.slice(scheme[1].length);
    }
    if (!rest) return prefix + '…';
    if (rest.length <= 8) return prefix + rest.slice(0, 2) + '…' + rest.slice(-2);
    return prefix + rest.slice(0, 4) + '…' + rest.slice(-4);
}

function maskConvoId(convoId) {
    const s = String(convoId || '');
    const us = s.lastIndexOf('_');
    if (us > 0 && us < s.length - 1) {
        return maskUid(s.slice(0, us)) + '_' + maskUid(s.slice(us + 1));
    }
    if (s.length <= 8) return s.slice(0, 2) + '…' + s.slice(-2);
    return s.slice(0, 4) + '…' + s.slice(-4);
}

function maskObjectPath(objectPath) {
    const parts = String(objectPath || '').split('/').filter(Boolean);
    if (parts[0] !== 'dm-images' || parts.length < 3) return 'dm-images/…';
    const fileName = parts[parts.length - 1];
    const uploader = parts[1];
    if (parts.length === 3) return 'dm-images/' + maskUid(uploader) + '/' + fileName;
    return 'dm-images/' + maskUid(uploader) + '/' + maskConvoId(parts.slice(2, -1).join('/')) + '/' + fileName;
}

function maskDocPath(docPath) {
    const s = String(docPath || '');
    const m = s.match(/^dm_conversations\/([^/]+)(?:\/messages\/([^/]+))?$/);
    if (!m) return '…';
    const mid = m[2] ? '/messages/' + m[2] : '';
    return 'dm_conversations/' + maskConvoId(m[1]) + mid;
}

function sortKeys(value) {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === 'object') {
        const out = {};
        Object.keys(value).sort().forEach(function (k) { out[k] = sortKeys(value[k]); });
        return out;
    }
    return value;
}

function stableStringify(value) {
    return JSON.stringify(sortKeys(value), null, 2) + '\n';
}

function parseArgs(argv) {
    const args = Array.isArray(argv) ? argv.slice() : [];
    const opts = {
        project: '',
        plan: '',
        planSha: '',
        apply: false,
        dryRun: true,
        rollback: '',
        shredRollback: '',
        rollbackDir: '',
        audit: '',
        bucket: '',
        canonicalBucket: '',
        help: false,
    };
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        const next = function (name) {
            const v = args[++i];
            if (v == null || String(v).startsWith('--')) throw new Error('missing value for ' + name);
            return v;
        };
        if (a === '--help' || a === '-h') opts.help = true;
        else if (a === '--project') opts.project = next(a);
        else if (a === '--plan') opts.plan = next(a);
        else if (a === '--plan-sha') opts.planSha = next(a);
        else if (a === '--apply') { opts.apply = true; opts.dryRun = false; }
        else if (a === '--dry-run') { opts.dryRun = true; opts.apply = false; }
        else if (a === '--rollback') opts.rollback = next(a);
        else if (a === '--shred-rollback') opts.shredRollback = next(a);
        else if (a === '--rollback-dir') opts.rollbackDir = next(a);
        else if (a === '--audit') opts.audit = next(a);
        else if (a === '--bucket') opts.bucket = next(a);
        else if (a === '--canonical-bucket') opts.canonicalBucket = next(a);
        else throw new Error('unknown argument: ' + a);
    }
    return opts;
}

function usage() {
    return [
        'Usage:',
        '  node functions/scripts/reset-dm-photo-tokens.js --project <id> [--plan <file>] [--dry-run]',
        '  node functions/scripts/reset-dm-photo-tokens.js --project <id> --plan <file> --apply --plan-sha <sha256>',
        '  node functions/scripts/reset-dm-photo-tokens.js --rollback <file>',
        '  node functions/scripts/reset-dm-photo-tokens.js --shred-rollback <file>',
        '',
        'Default is --dry-run (read-only). Live --apply needs RESET_CONFIRM=dm-photo-tokens.',
        'Rollback files hold bearer tokens; after the 7-day window, shred them with --shred-rollback.',
    ].join('\n');
}

function emulatorMode() {
    const fsHost = process.env.FIRESTORE_EMULATOR_HOST || '';
    const stHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '';
    if (fsHost || stHost) {
        if (!fsHost || !stHost) {
            throw new Error('both FIRESTORE_EMULATOR_HOST and FIREBASE_STORAGE_EMULATOR_HOST must be set together');
        }
        // The GCS client (used by firebase-admin) honors STORAGE_EMULATOR_HOST
        // with an http:// prefix. Without it, some metadata writes miss the emulator.
        if (!process.env.STORAGE_EMULATOR_HOST) {
            process.env.STORAGE_EMULATOR_HOST = stHost.indexOf('://') === -1 ? 'http://' + stHost : stHost;
        }
        return true;
    }
    return false;
}

function isLiveProject(project) {
    return project === LIVE_PROJECT;
}

function canonicalBucketFor(project, override) {
    if (override) return override;
    if (DEFAULT_CANONICAL_BUCKET[project]) return DEFAULT_CANONICAL_BUCKET[project];
    return project + '.firebasestorage.app';
}

function encodePath(objectPath) {
    return encodeURIComponent(objectPath).replace(/'/g, '%27');
}

function canonicalDownloadUrl(canonicalBucket, objectPath, token) {
    return 'https://firebasestorage.googleapis.com/v0/b/'
        + canonicalBucket
        + '/o/'
        + encodePath(objectPath)
        + '?alt=media&token='
        + token;
}

function emulatorDownloadUrl(objectPath, token) {
    const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    const bucket = emulatorBucketName();
    if (!host) return '';
    return 'http://' + host + '/v0/b/' + bucket + '/o/' + encodePath(objectPath) + '?alt=media&token=' + token;
}

function emulatorBucketName() {
    return process.env.F2RESET_STORAGE_BUCKET
        || (process.env.GCLOUD_PROJECT ? process.env.GCLOUD_PROJECT + '.appspot.com' : '');
}

// Accept the getDownloadURL shape, plus alt/token query order swaps, and the
// legacy .appspot.com bucket name. GIFs and other hosts are ignored.
function parseStorageUrl(url) {
    const s = String(url || '');
    const m = s.match(/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?]+)\?(.*)$/i);
    if (!m) return null;
    const bucket = decodeURIComponent(m[1]);
    let objectPath;
    try { objectPath = decodeURIComponent(m[2]); } catch (e) { return null; }
    if (objectPath.indexOf(OBJECT_PREFIX) !== 0) return null;
    const query = {};
    String(m[3] || '').split('&').forEach(function (part) {
        if (!part) return;
        const eq = part.indexOf('=');
        const k = eq === -1 ? part : decodeURIComponent(part.slice(0, eq));
        const v = eq === -1 ? '' : decodeURIComponent(part.slice(eq + 1));
        query[k] = v;
    });
    const token = String(query.token || '');
    if (!token) return null;
    return { bucket: bucket, objectPath: objectPath, token: token, alt: query.alt || '' };
}

function isF3CanonicalUrl(url, senderUid, canonicalBucket) {
    const parsed = parseStorageUrl(url);
    if (!parsed) return false;
    if (parsed.bucket !== canonicalBucket) return false;
    if (!F3_BUCKETS.has(parsed.bucket)) return false;
    if (parsed.alt !== 'media') return false;
    const encodedUid = encodeURIComponent(senderUid).replace(/'/g, '%27');
    const re = new RegExp(
        '^https://firebasestorage[.]googleapis[.]com/v0/b/'
        + escapeRe(canonicalBucket)
        + '/o/dm-images%2F'
        + escapeRe(encodedUid)
        + '%2F[A-Za-z0-9._%-]+[?]alt=media&token=[A-Za-z0-9-]+$'
    );
    return re.test(url);
}

function escapeRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokensFromMetadata(meta) {
    const raw = meta && meta.metadata && meta.metadata.firebaseStorageDownloadTokens;
    if (!raw) return [];
    return String(raw).split(',').map(function (t) { return t.trim(); }).filter(Boolean);
}

// Replace the object's download tokens so only `token` remains. The Storage
// emulator appends tokens on setMetadata, which would leave old bearer links
// working; if a write doesn't leave exactly one matching token, rewrite the
// object bytes with the new metadata. Used by apply and rollback.
async function setDownloadToken(file, token) {
    if (!token) throw new Error('missing download token');
    const [meta] = await file.getMetadata();
    const custom = Object.assign({}, (meta && meta.metadata) || {});
    custom.firebaseStorageDownloadTokens = token;
    await file.setMetadata({ metadata: custom });
    let [after] = await file.getMetadata();
    let got = tokensFromMetadata(after);
    if (got.length !== 1 || got[0] !== token) {
        const [buf] = await file.download();
        await file.save(buf, {
            resumable: false,
            metadata: {
                contentType: (meta && meta.contentType) || 'image/jpeg',
                metadata: custom,
            },
        });
        [after] = await file.getMetadata();
        got = tokensFromMetadata(after);
    }
    if (got.length !== 1 || got[0] !== token) {
        throw new Error('failed to replace the download token for ' + maskObjectPath(file.name));
    }
}

function uploaderFromPath(objectPath) {
    const parts = String(objectPath).split('/');
    return parts[0] === 'dm-images' && parts.length >= 3 ? parts[1] : '';
}

function dmConvoShape(convoId, data) {
    const participants = data && Array.isArray(data.participants) ? data.participants : null;
    if (!participants) return { ok: false, reason: 'missing_participants' };
    if (participants.length !== 2) return { ok: false, reason: 'participant_count' };
    const a = participants[0];
    const b = participants[1];
    if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) {
        return { ok: false, reason: 'participant_type' };
    }
    if (a === b) return { ok: false, reason: 'same_participant' };
    const expected = a < b ? a + '_' + b : b + '_' + a;
    if (String(convoId) !== expected) return { ok: false, reason: 'id_not_sorted_pair' };
    return { ok: true, reason: '' };
}

function walkStringFields(data, visit) {
    function walk(value, field) {
        if (typeof value === 'string') {
            visit(field, value);
            return;
        }
        if (!value || typeof value !== 'object') return;
        if (typeof value.toDate === 'function') return;
        if (Array.isArray(value)) {
            value.forEach(function (v, i) { walk(v, field + '[' + i + ']'); });
            return;
        }
        Object.keys(value).forEach(function (k) {
            walk(value[k], field ? field + '.' + k : k);
        });
    }
    walk(data, '');
}

function newToken() {
    return crypto.randomUUID();
}

function ensureDir(dir, mode) {
    fs.mkdirSync(dir, { recursive: true, mode: mode || 0o700 });
    try { fs.chmodSync(dir, mode || 0o700); } catch (e) { /* best effort */ }
}

function writePrivate(filePath, contents, mode) {
    ensureDir(path.dirname(filePath), 0o700);
    const tmp = filePath + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, contents, { mode: mode || 0o600, flag: 'w' });
    try { fs.chmodSync(tmp, mode || 0o600); } catch (e) { /* best effort */ }
    fs.renameSync(tmp, filePath);
    try { fs.chmodSync(filePath, mode || 0o600); } catch (e) { /* best effort */ }
}

// Tokens are bearer links. Never write them to logs, stdout, the plan, or
// test output. Only hashes belong there. This is a last-resort scrubber.
function redactSecrets(text) {
    return String(text || '')
        .replace(/([?&]token=)[A-Za-z0-9-]+/gi, '$1[redacted]')
        .replace(/(firebaseStorageDownloadTokens["'\s:=]+)[A-Za-z0-9,-]+/gi, '$1[redacted]')
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[redacted-token]');
}

const ALLOWED_ROLLBACK_DIRS = [
    '/workspace/private/f2reset',
    '/tmp/rufus-f2reset',
];

function isInsideDir(filePath, dir) {
    const resolved = path.resolve(filePath);
    const root = path.resolve(dir);
    return resolved === root || resolved.startsWith(root + path.sep);
}

function assertRollbackFilePath(filePath, mustExist) {
    if (!filePath) throw new Error('missing rollback file path');
    const resolved = path.resolve(filePath);
    const base = path.basename(resolved);
    if (!/^rollback-[A-Za-z0-9._-]+\.json$/.test(base)) {
        throw new Error('refusing a file that is not a rollback json');
    }
    const allowed = ALLOWED_ROLLBACK_DIRS.some(function (dir) { return isInsideDir(resolved, dir); });
    if (!allowed) throw new Error('refusing a rollback path outside the allowed directories');
    if (mustExist) {
        if (!fs.existsSync(resolved)) throw new Error('rollback file not found');
        const real = fs.realpathSync(resolved);
        const realOk = ALLOWED_ROLLBACK_DIRS.some(function (dir) {
            const root = fs.existsSync(dir) ? fs.realpathSync(dir) : path.resolve(dir);
            return real === root || real.startsWith(root + path.sep);
        });
        if (!realOk) throw new Error('refusing a rollback path outside the allowed directories');
        return real;
    }
    return resolved;
}

// Irreversibly delete a rollback file after the 7-day window. Uses shred -u.
function shredRollbackFile(filePath) {
    const real = assertRollbackFilePath(filePath, true);
    const result = spawnSync('shred', ['-u', real], { encoding: 'utf8' });
    if (result.error && result.error.code === 'ENOENT') {
        throw new Error('shred is not available on this machine');
    }
    if (result.status !== 0) throw new Error('shred failed');
    if (fs.existsSync(real)) throw new Error('rollback file still exists after shred');
    return path.basename(real);
}

function appendAudit(auditPath, line) {
    if (!auditPath) return;
    ensureDir(path.dirname(auditPath), 0o700);
    const stamp = new Date().toISOString();
    fs.appendFileSync(auditPath, stamp + ' ' + redactSecrets(line) + '\n', { mode: 0o600 });
    try { fs.chmodSync(auditPath, 0o600); } catch (e) { /* best effort */ }
}

function checkPlanSha(fileBytes, expectedSha) {
    const got = sha256Hex(fileBytes);
    const want = String(expectedSha || '').trim().toLowerCase();
    if (!want) throw new Error('missing --plan-sha');
    if (!/^[0-9a-f]{64}$/.test(want)) throw new Error('invalid --plan-sha');
    if (got !== want) throw new Error('plan sha mismatch: got ' + got + ' expected ' + want);
    return got;
}

function initAdmin(project, bucketName) {
    const admin = require('../src/firebaseAdmin');
    if (admin.apps.length) return admin;
    const init = { projectId: project };
    const emu = emulatorMode();
    if (emu) {
        if (isLiveProject(project) || project === STAGING_PROJECT) {
            throw new Error('refusing to point the emulator at a real project id');
        }
        process.env.GCLOUD_PROJECT = project;
        process.env.GOOGLE_CLOUD_PROJECT = project;
        init.storageBucket = bucketName || (project + '.appspot.com');
    } else {
        if (process.env.FIREBASE_SA_JSON) {
            init.credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SA_JSON));
        }
        if (bucketName) init.storageBucket = bucketName;
        else init.storageBucket = project + '.appspot.com';
    }
    admin.initializeApp(init);
    return admin;
}

async function resolveBucket(admin, project, preferred) {
    const names = [];
    if (preferred) names.push(preferred);
    names.push(project + '.appspot.com');
    names.push(project + '.firebasestorage.app');
    const tried = [];
    let lastErr = null;
    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        if (tried.indexOf(name) !== -1) continue;
        tried.push(name);
        try {
            const bucket = admin.storage().bucket(name);
            const [exists] = await bucket.exists();
            if (exists) return { bucket: bucket, name: name };
            // Emulator may not report exists() until a file is written.
            if (emulatorMode()) return { bucket: bucket, name: name };
        } catch (e) {
            lastErr = e;
        }
    }
    const err = new Error('could not open a Storage bucket for this project');
    if (lastErr) err.cause = lastErr;
    throw err;
}

async function listDmObjects(bucket) {
    const [files] = await bucket.getFiles({ prefix: OBJECT_PREFIX, autoPaginate: true });
    const out = [];
    for (const file of files) {
        const objectPath = file.name;
        if (!objectPath || objectPath.endsWith('/')) continue;
        const parts = objectPath.split('/');
        if (parts[0] !== 'dm-images' || parts.length < 3) continue;
        const [meta] = await file.getMetadata();
        const tokens = tokensFromMetadata(meta);
        out.push({
            objectPath: objectPath,
            file: file,
            tokens: tokens,
            token: tokens[0] || '',
            contentType: (meta && meta.contentType) || '',
        });
    }
    out.sort(function (a, b) { return a.objectPath < b.objectPath ? -1 : a.objectPath > b.objectPath ? 1 : 0; });
    return out;
}

async function scanConversations(db) {
    const convos = await db.collection('dm_conversations').get();
    const wellFormed = [];
    const skipped = [];
    convos.forEach(function (doc) {
        const shape = dmConvoShape(doc.id, doc.data() || {});
        const entry = { id: doc.id, data: doc.data() || {}, shape: shape };
        if (shape.ok) wellFormed.push(entry);
        else skipped.push(entry);
    });
    return { wellFormed: wellFormed, skipped: skipped, total: convos.size };
}

function collectUrlHitsFromDoc(docPath, data) {
    const hits = [];
    walkStringFields(data, function (field, value) {
        const parsed = parseStorageUrl(value);
        if (!parsed) return;
        hits.push({
            docPath: docPath,
            field: field || 'imageUrl',
            url: value,
            parsed: parsed,
        });
    });
    return hits;
}

async function collectHits(db, convos, includeMessages) {
    const hits = [];
    for (const convo of convos) {
        const convoPath = 'dm_conversations/' + convo.id;
        hits.push.apply(hits, collectUrlHitsFromDoc(convoPath, convo.data));
        if (!includeMessages) continue;
        const msgs = await db.collection('dm_conversations').doc(convo.id).collection('messages').get();
        msgs.forEach(function (doc) {
            const docPath = convoPath + '/messages/' + doc.id;
            hits.push.apply(hits, collectUrlHitsFromDoc(docPath, doc.data() || {}));
        });
    }
    return hits;
}

function buildPlan(opts) {
    const items = opts.items;
    const skippedConversations = opts.skippedConversations.map(function (c) {
        return { idMasked: maskConvoId(c.id), reason: c.shape.reason };
    }).sort(function (a, b) {
        return a.idMasked < b.idMasked ? -1 : a.idMasked > b.idMasked ? 1 : a.reason < b.reason ? -1 : 0;
    });
    const planItems = items.map(function (it) {
        const messages = (it.messages || []).map(function (h) {
            return {
                field: h.field,
                pathMasked: maskDocPath(h.docPath),
                pathSha256: sha256Hex(h.docPath),
            };
        }).sort(function (a, b) { return a.pathSha256 < b.pathSha256 ? -1 : a.pathSha256 > b.pathSha256 ? 1 : a.field < b.field ? -1 : 0; });
        const convoFields = (it.convoFields || []).map(function (h) {
            return {
                field: h.field,
                pathMasked: maskDocPath(h.docPath),
                pathSha256: sha256Hex(h.docPath),
            };
        }).sort(function (a, b) { return a.pathSha256 < b.pathSha256 ? -1 : a.pathSha256 > b.pathSha256 ? 1 : a.field < b.field ? -1 : 0; });
        return {
            objectPathMasked: maskObjectPath(it.objectPath),
            objectPathSha256: sha256Hex(it.objectPath),
            oldTokenSha256: it.token ? sha256Hex(it.token) : '',
            legacyTokenCount: it.tokens.length,
            messageCount: messages.length,
            convoFieldCount: convoFields.length,
            messages: messages,
            convoFields: convoFields,
        };
    }).sort(function (a, b) { return a.objectPathSha256 < b.objectPathSha256 ? -1 : 1; });

    const skippedObjects = (opts.skippedObjects || []).map(function (it) {
        return {
            objectPathMasked: maskObjectPath(it.objectPath),
            objectPathSha256: sha256Hex(it.objectPath),
            reason: it.reason,
            skippedMessageCount: it.skippedMessageCount || 0,
        };
    }).sort(function (a, b) { return a.objectPathSha256 < b.objectPathSha256 ? -1 : 1; });

    const unmatchedMessages = (opts.unmatchedMessages || []).map(function (h) {
        return {
            pathMasked: maskDocPath(h.docPath),
            pathSha256: sha256Hex(h.docPath),
            field: h.field,
            reason: h.reason,
        };
    }).sort(function (a, b) { return a.pathSha256 < b.pathSha256 ? -1 : 1; });

    let plannedMessages = 0;
    let plannedConvoFields = 0;
    planItems.forEach(function (it) {
        plannedMessages += it.messageCount;
        plannedConvoFields += it.convoFieldCount;
    });

    return {
        version: PLAN_VERSION,
        project: opts.project,
        storageBucket: opts.storageBucket,
        canonicalBucket: opts.canonicalBucket,
        counts: {
            storageObjects: opts.storageObjectCount,
            conversations: opts.conversationCount,
            plannedObjects: planItems.length,
            plannedMessages: plannedMessages,
            plannedConvoFields: plannedConvoFields,
            orphanObjects: planItems.filter(function (it) { return it.messageCount === 0 && it.convoFieldCount === 0; }).length,
            skippedConversations: skippedConversations.length,
            skippedObjects: skippedObjects.length,
            unmatchedMessages: unmatchedMessages.length,
        },
        skippedConversations: skippedConversations,
        skippedObjects: skippedObjects,
        unmatchedMessages: unmatchedMessages,
        items: planItems,
    };
}

function indexByPathSha(scan) {
    const objects = new Map();
    scan.objects.forEach(function (o) { objects.set(sha256Hex(o.objectPath), o); });
    const hits = new Map();
    function add(h) {
        const key = sha256Hex(h.docPath) + '\0' + h.field;
        hits.set(key, h);
    }
    (scan.wellHits || []).forEach(add);
    return { objects: objects, hits: hits };
}

async function discover(admin, project, storageBucketName, canonicalBucket) {
    const db = admin.firestore();
    const resolved = await resolveBucket(admin, project, storageBucketName);
    const objects = await listDmObjects(resolved.bucket);
    const convos = await scanConversations(db);
    const wellHits = await collectHits(db, convos.wellFormed, true);
    const skippedHits = await collectHits(db, convos.skipped, true);

    const objectByPath = new Map();
    objects.forEach(function (o) { objectByPath.set(o.objectPath, o); });

    const skippedObjectPaths = new Set();
    skippedHits.forEach(function (h) {
        if (h.parsed && h.parsed.objectPath) skippedObjectPaths.add(h.parsed.objectPath);
    });

    const wellByObject = new Map();
    const unmatched = [];
    wellHits.forEach(function (h) {
        const obj = objectByPath.get(h.parsed.objectPath);
        if (!obj) {
            unmatched.push({ docPath: h.docPath, field: h.field, reason: 'missing_object' });
            return;
        }
        if (!wellByObject.has(obj.objectPath)) wellByObject.set(obj.objectPath, { messages: [], convoFields: [] });
        const group = wellByObject.get(obj.objectPath);
        if (h.docPath.indexOf('/messages/') !== -1) group.messages.push(h);
        else group.convoFields.push(h);
    });

    const items = [];
    const skippedObjects = [];
    objects.forEach(function (o) {
        if (skippedObjectPaths.has(o.objectPath)) {
            const count = skippedHits.filter(function (h) { return h.parsed.objectPath === o.objectPath; }).length;
            skippedObjects.push({
                objectPath: o.objectPath,
                reason: 'referenced_by_skipped_conversation',
                skippedMessageCount: count,
            });
            return;
        }
        const group = wellByObject.get(o.objectPath) || { messages: [], convoFields: [] };
        items.push({
            objectPath: o.objectPath,
            token: o.token,
            tokens: o.tokens,
            messages: group.messages,
            convoFields: group.convoFields,
        });
    });

    wellHits.forEach(function (h) {
        if (skippedObjectPaths.has(h.parsed.objectPath)) {
            unmatched.push({ docPath: h.docPath, field: h.field, reason: 'object_held_for_skipped_conversation' });
        }
    });

    return {
        bucket: resolved.bucket,
        storageBucket: resolved.name,
        canonicalBucket: canonicalBucket,
        objects: objects,
        convos: convos,
        wellHits: wellHits,
        skippedHits: skippedHits,
        items: items,
        skippedObjects: skippedObjects,
        unmatchedMessages: unmatched,
        plan: buildPlan({
            project: project,
            storageBucket: resolved.name,
            canonicalBucket: canonicalBucket,
            items: items,
            skippedConversations: convos.skipped,
            skippedObjects: skippedObjects,
            unmatchedMessages: unmatched,
            storageObjectCount: objects.length,
            conversationCount: convos.total,
        }),
    };
}

function printSummary(plan, planSha, mode) {
    const c = plan.counts;
    console.log('mode ' + mode);
    console.log('project ' + plan.project);
    console.log('storage-bucket ' + plan.storageBucket);
    console.log('canonical-bucket ' + plan.canonicalBucket);
    console.log('plan-sha ' + planSha);
    console.log('objects ' + c.storageObjects);
    console.log('planned-objects ' + c.plannedObjects);
    console.log('planned-messages ' + c.plannedMessages);
    console.log('planned-convo-fields ' + c.plannedConvoFields);
    console.log('orphan-objects ' + c.orphanObjects);
    console.log('conversations ' + c.conversations);
    console.log('skipped-conversations ' + c.skippedConversations);
    (plan.skippedConversations || []).forEach(function (s) {
        console.log('skipped-convo ' + s.idMasked + ' ' + s.reason);
    });
    console.log('skipped-objects ' + c.skippedObjects);
    (plan.skippedObjects || []).forEach(function (s) {
        console.log('skipped-object ' + s.objectPathMasked + ' ' + s.reason + ' msgs=' + s.skippedMessageCount);
    });
    console.log('unmatched-messages ' + c.unmatchedMessages);
}

async function applyPlan(admin, opts, plan, planSha, discovery) {
    const db = admin.firestore();
    const byPath = new Map();
    discovery.objects.forEach(function (o) { byPath.set(sha256Hex(o.objectPath), o); });
    const wellHits = discovery.wellHits || [];
    const hitsByKey = new Map();
    wellHits.forEach(function (h) {
        hitsByKey.set(sha256Hex(h.docPath) + '\0' + h.field, h);
    });

    if (!opts.rollbackPath) throw new Error('missing rollback path');
    const rollbackItems = [];
    const results = { rotated: 0, rewritten: 0, skippedAlready: 0, finishedPartial: 0 };
    writeRollback(opts.rollbackPath, plan.project, planSha, rollbackItems, plan.storageBucket);

    for (const item of plan.items) {
        const obj = byPath.get(item.objectPathSha256);
        if (!obj) throw new Error('planned object not found (sha ' + item.objectPathSha256.slice(0, 12) + '…)');
        if (!obj.token && !obj.tokens.length) {
            // Object has no token yet: still rotate, but only if the plan said so.
            if (item.oldTokenSha256) throw new Error('planned object has no token (sha ' + item.objectPathSha256.slice(0, 12) + '…)');
        }
        const currentToken = obj.token || '';
        const currentHash = currentToken ? sha256Hex(currentToken) : '';
        const fieldSpecs = [].concat(item.messages || [], item.convoFields || []);
        const fieldStates = fieldSpecs.map(function (spec) {
            const hit = hitsByKey.get(spec.pathSha256 + '\0' + spec.field);
            return { spec: spec, hit: hit };
        });

        const allFieldsHave = function (pred) {
            if (!fieldStates.length) return true;
            return fieldStates.every(function (st) { return st.hit && pred(st.hit); });
        };

        let action = 'rotate';
        if (currentHash && currentHash === item.oldTokenSha256) {
            action = 'rotate';
        } else if (currentHash && currentHash !== item.oldTokenSha256) {
            const already = allFieldsHave(function (h) { return sha256Hex(h.parsed.token) === currentHash; });
            const stillOld = allFieldsHave(function (h) { return sha256Hex(h.parsed.token) === item.oldTokenSha256; });
            if (already) action = 'skip';
            else if (stillOld) action = 'finish-partial';
            else throw new Error('token mismatch for ' + item.objectPathMasked + '; refusing to guess');
        } else if (!currentHash && item.oldTokenSha256) {
            throw new Error('planned object lost its token (' + item.objectPathMasked + ')');
        }

        if (action === 'skip') {
            results.skippedAlready += 1;
            appendAudit(opts.audit, 'skip-already ' + item.objectPathMasked);
            continue;
        }

        const tokenToWrite = action === 'finish-partial' ? currentToken : newToken();
        const oldTokenForRollback = action === 'finish-partial' ? null : (currentToken || (item.oldTokenSha256 ? 'unknown' : ''));
        if (action === 'rotate' && item.oldTokenSha256 && currentHash !== item.oldTokenSha256) {
            throw new Error('refusing to rotate; token hash changed for ' + item.objectPathMasked);
        }

        const fields = [];
        for (const st of fieldStates) {
            if (!st.hit) throw new Error('planned field not found for ' + st.spec.pathMasked);
            const sender = uploaderFromPath(obj.objectPath);
            const newUrl = canonicalDownloadUrl(plan.canonicalBucket, obj.objectPath, tokenToWrite);
            if (sender && !isF3CanonicalUrl(newUrl, sender, plan.canonicalBucket)) {
                throw new Error('rewritten URL would not satisfy F3 for ' + item.objectPathMasked);
            }
            fields.push({
                docPath: st.hit.docPath,
                field: st.hit.field,
                oldUrl: st.hit.url,
                newUrl: newUrl,
            });
        }

        rollbackItems.push({
            objectPath: obj.objectPath,
            oldToken: action === 'rotate' ? currentToken : null,
            newToken: tokenToWrite,
            alreadyRotated: action === 'finish-partial',
            fields: fields,
        });
        // Persist the old token before any mutation so a crash is still reversible.
        writeRollback(opts.rollbackPath, plan.project, planSha, rollbackItems, plan.storageBucket);

        if (action === 'rotate') {
            await setDownloadToken(obj.file, tokenToWrite);
            results.rotated += 1;
            appendAudit(opts.audit, 'rotated ' + item.objectPathMasked);
            obj.token = tokenToWrite;
            obj.tokens = [tokenToWrite];
        } else {
            results.finishedPartial += 1;
            appendAudit(opts.audit, 'finish-partial ' + item.objectPathMasked);
        }

        for (const f of fields) {
            const ref = db.doc(f.docPath);
            await ref.update({ [f.field]: f.newUrl });
            results.rewritten += 1;
            appendAudit(opts.audit, 'rewrote ' + maskDocPath(f.docPath) + ' ' + f.field);
        }
    }

    return { results: results, rollbackItems: rollbackItems, planSha: planSha };
}

function writeRollback(rollbackPath, project, planSha, rollbackItems, storageBucket) {
    if (!rollbackPath) throw new Error('missing rollback path');
    const body = stableStringify({
        version: PLAN_VERSION,
        project: project,
        planSha256: planSha,
        storageBucket: storageBucket || '',
        items: rollbackItems,
    });
    writePrivate(rollbackPath, body, 0o600);
}

async function runRollback(opts) {
    const raw = fs.readFileSync(opts.rollback);
    const data = JSON.parse(raw.toString('utf8'));
    if (data.version !== PLAN_VERSION) throw new Error('unsupported rollback version');
    const project = data.project || opts.project;
    if (!project) throw new Error('rollback file missing project');
    assertWriteAllowed(project, opts, 'rollback');
    const admin = initAdmin(project, opts.bucket);
    const resolved = await resolveBucket(admin, project, opts.bucket || data.storageBucket);
    const db = admin.firestore();
    let restoredTokens = 0;
    let restoredFields = 0;
    for (const item of data.items || []) {
        if (!item.objectPath) throw new Error('rollback item missing object path');
        if (item.oldToken) {
            const file = resolved.bucket.file(item.objectPath);
            await setDownloadToken(file, item.oldToken);
            restoredTokens += 1;
            appendAudit(opts.audit, 'rollback-token ' + maskObjectPath(item.objectPath));
        }
        for (const f of item.fields || []) {
            if (!f.docPath || !f.field || !f.oldUrl) continue;
            await db.doc(f.docPath).update({ [f.field]: f.oldUrl });
            restoredFields += 1;
            appendAudit(opts.audit, 'rollback-field ' + maskDocPath(f.docPath) + ' ' + f.field);
        }
    }
    console.log('mode rollback');
    console.log('restored-tokens ' + restoredTokens);
    console.log('restored-fields ' + restoredFields);
}

function assertWriteAllowed(project, opts, action) {
    if (emulatorMode()) return;
    if (project === STAGING_PROJECT) {
        throw new Error('refusing ' + action + ' on staging: this project has no Storage bucket');
    }
    if (isLiveProject(project)) {
        if (process.env.RESET_CONFIRM !== CONFIRM_VALUE) {
            throw new Error('live ' + action + ' requires RESET_CONFIRM=' + CONFIRM_VALUE);
        }
        return;
    }
    throw new Error('refusing ' + action + ' on unknown project');
}

function defaultPaths(opts, project) {
    const dir = opts.rollbackDir || (emulatorMode() ? path.join('/tmp/rufus-f2reset') : DEFAULT_PLAN_DIR);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const plan = opts.plan || path.join(dir, 'plan-' + project + '.json');
    const audit = opts.audit || path.join(path.dirname(plan), 'audit-' + project + '.log');
    const rollback = path.join(opts.rollbackDir || path.dirname(plan), 'rollback-' + project + '-' + stamp + '.json');
    return { dir: dir, plan: plan, audit: audit, rollback: rollback };
}

async function main(argv) {
    const opts = parseArgs(argv || process.argv.slice(2));
    if (opts.help) {
        console.log(usage());
        return 0;
    }
    if (opts.shredRollback) {
        if (opts.apply || opts.rollback || opts.planSha) {
            throw new Error('--shred-rollback cannot be combined with --apply or --rollback');
        }
        const name = shredRollbackFile(opts.shredRollback);
        console.log('mode shred-rollback');
        console.log('shredded ' + name);
        return 0;
    }
    if (opts.rollback) {
        if (!opts.audit) {
            opts.audit = path.join(path.dirname(opts.rollback), 'audit-rollback.log');
        }
        await runRollback(opts);
        return 0;
    }
    if (!opts.project) throw new Error('missing --project\n' + usage());
    if (opts.apply && !opts.plan) throw new Error('--apply requires --plan');
    if (opts.apply && !opts.planSha) throw new Error('--apply requires --plan-sha');
    if (opts.apply) assertWriteAllowed(opts.project, opts, 'apply');
    if (!emulatorMode() && isLiveProject(opts.project) && opts.apply === false) {
        // dry-run on live is allowed
    }
    if (!emulatorMode() && opts.project === STAGING_PROJECT) {
        console.log('note staging has no Storage bucket; a live dry-run should use ' + LIVE_PROJECT);
    }

    const paths = defaultPaths(opts, opts.project);
    opts.plan = paths.plan;
    opts.audit = paths.audit;
    const canonicalBucket = canonicalBucketFor(opts.project, opts.canonicalBucket);
    const admin = initAdmin(opts.project, opts.bucket);
    const discovery = await discover(admin, opts.project, opts.bucket, canonicalBucket);
    const planText = stableStringify(discovery.plan);

    if (opts.apply) {
        const fileBytes = fs.readFileSync(opts.plan);
        const planSha = checkPlanSha(fileBytes, opts.planSha);
        const planned = JSON.parse(fileBytes.toString('utf8'));
        if (planned.version !== PLAN_VERSION) throw new Error('unsupported plan version');
        if (planned.project !== opts.project) throw new Error('plan project does not match --project');
        if (planned.canonicalBucket !== canonicalBucket) throw new Error('plan canonical bucket does not match');
        appendAudit(opts.audit, 'apply-start sha=' + planSha + ' items=' + (planned.items || []).length);
        opts.rollbackPath = paths.rollback;
        const applied = await applyPlan(admin, opts, planned, planSha, discovery);
        appendAudit(opts.audit, 'apply-done rotated=' + applied.results.rotated
            + ' rewritten=' + applied.results.rewritten
            + ' skipped-already=' + applied.results.skippedAlready
            + ' finish-partial=' + applied.results.finishedPartial
            + ' rollback=' + path.basename(paths.rollback));
        printSummary(planned, planSha, 'apply');
        console.log('rotated ' + applied.results.rotated);
        console.log('rewritten ' + applied.results.rewritten);
        console.log('skipped-already ' + applied.results.skippedAlready);
        console.log('finish-partial ' + applied.results.finishedPartial);
        console.log('rollback ' + paths.rollback);
        console.log('audit ' + opts.audit);
        return 0;
    }

    writePrivate(opts.plan, planText, 0o600);
    const planSha = sha256Hex(fs.readFileSync(opts.plan));
    appendAudit(opts.audit, 'dry-run sha=' + planSha
        + ' objects=' + discovery.plan.counts.plannedObjects
        + ' messages=' + discovery.plan.counts.plannedMessages
        + ' skipped-convos=' + discovery.plan.counts.skippedConversations);
    printSummary(discovery.plan, planSha, 'dry-run');
    console.log('plan ' + opts.plan);
    console.log('audit ' + opts.audit);
    return 0;
}

if (require.main === module) {
    main().then(function (code) {
        process.exit(code || 0);
    }).catch(function (err) {
        const msg = (err && err.message) ? String(err.message) : 'reset-dm-photo-tokens failed';
        console.error(redactSecrets(msg));
        process.exit(1);
    });
}

module.exports = {
    parseArgs,
    sha256Hex,
    maskUid,
    maskConvoId,
    maskObjectPath,
    maskDocPath,
    stableStringify,
    parseStorageUrl,
    canonicalDownloadUrl,
    isF3CanonicalUrl,
    dmConvoShape,
    buildPlan,
    tokensFromMetadata,
    setDownloadToken,
    emulatorDownloadUrl,
    redactSecrets,
    assertRollbackFilePath,
    shredRollbackFile,
    writeRollback,
    main,
};
