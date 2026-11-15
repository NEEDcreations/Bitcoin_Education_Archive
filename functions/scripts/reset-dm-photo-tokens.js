#!/usr/bin/env node
'use strict';
// One-off admin script: rotate Firebase Storage download tokens on existing
// DM photos (dm-images/...) and rewrite the matching Firestore imageUrl
// fields so old leaked links stop working and members still see their photos.
//
// Default mode is --dry-run (read-only). --apply writes only what is in the
// plan, and only after --plan-sha matches the plan file bytes exactly. Live
// applies also require RESET_CONFIRM=dm-photo-tokens.
//
// Usage (live; never run without Phil's OK on the card):
//   node functions/scripts/reset-dm-photo-tokens.js \
//     --project bitcoin-education-archive \
//     --bucket bitcoin-education-archive.firebasestorage.app
//   RESET_CONFIRM=dm-photo-tokens node functions/scripts/reset-dm-photo-tokens.js \
//     --project bitcoin-education-archive \
//     --bucket bitcoin-education-archive.firebasestorage.app \
//     --plan /workspace/private/f2reset/plan-bitcoin-education-archive.json \
//     --apply --plan-sha <sha256>
//   RESET_CONFIRM=dm-photo-tokens node functions/scripts/reset-dm-photo-tokens.js \
//     --rollback /workspace/private/f2reset/rollback/rollback-<project>-<sha16>.json
//   node functions/scripts/reset-dm-photo-tokens.js \
//     --shred-rollback /workspace/private/f2reset/rollback/rollback-<project>-<sha16>.json
//
// Never prints secrets, full uids, emails, or download tokens. The plan
// file, audit log, stdout, and test output store only token hashes and
// masked paths. The rollback file is the only place tokens are written:
// once per plan, mode 600, fsynced, under /workspace/private/f2reset/rollback
// (live) with a CACHEDIR.TAG so tag-aware backup tools skip it. Those tokens
// are working bearer links to private photos. Keep a 7-day rollback window
// (the apply prints the shred-after date), then shred with --shred-rollback.
//
// Objects referenced from malformed conversations (id not the sorted
// participant pair, or not exactly 2 distinct participants) are rotated too
// ("locked" objects). The malformed docs themselves are never written: their
// fields keep the old, now dead, URL, so no fresh bearer link ever lands in a
// squat-shaped doc. Well-formed messages pointing at the same object are
// rewritten as usual.
//
// Apply is resumable: the rollback file pins every new token before the first
// write. Re-running the same --apply --plan-sha after a crash finishes what is
// left. Objects or docs that disappeared since the dry run are skipped and
// counted. Tokenless objects are skipped (no token is ever minted).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const LIVE_PROJECT = 'bitcoin-education-archive';
const STAGING_PROJECT = 'bitcoin-quest-staging';
const CONFIRM_VALUE = 'dm-photo-tokens';
const PLAN_VERSION = 2;
const ROLLBACK_VERSION = 2;
const DEFAULT_CANONICAL_BUCKET = {
    'bitcoin-education-archive': 'bitcoin-education-archive.firebasestorage.app',
    'bitcoin-quest-staging': 'bitcoin-quest-staging.firebasestorage.app',
};
const F3_BUCKETS = new Set([
    'bitcoin-education-archive.firebasestorage.app',
    'bitcoin-quest-staging.firebasestorage.app',
]);
const DEFAULT_PLAN_DIR = '/workspace/private/f2reset';
const LIVE_ROLLBACK_DIR = '/workspace/private/f2reset/rollback';
const EMULATOR_SCRATCH_DIR = '/tmp/rufus-f2reset';
const SHRED_DAYS = 7;
const OBJECT_PREFIX = 'dm-images/';
// Token-shaped placeholder used only to check the rewritten URL shape in the
// dry run. Never a real token; never printed.
const F3_PROBE_TOKEN = '00000000-0000-4000-8000-000000000000';
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
        allowReupload: false,
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
        else if (a === '--allow-reupload') opts.allowReupload = true;
        else throw new Error('unknown argument: ' + a);
    }
    return opts;
}

function usage() {
    return [
        'Usage:',
        '  node functions/scripts/reset-dm-photo-tokens.js --project <id> [--bucket <bucket>] [--plan <file>] [--dry-run]',
        '  node functions/scripts/reset-dm-photo-tokens.js --project <id> --plan <file> --apply --plan-sha <sha256>',
        '  node functions/scripts/reset-dm-photo-tokens.js --rollback <file>',
        '  node functions/scripts/reset-dm-photo-tokens.js --shred-rollback <file>',
        '',
        'Default is --dry-run (read-only). Live --apply and --rollback need RESET_CONFIRM=dm-photo-tokens.',
        'Live rollback files live only under ' + LIVE_ROLLBACK_DIR + '.',
        'Rollback files hold bearer tokens; after the 7-day window, shred them with --shred-rollback.',
    ].join('\n');
}

function emulatorEnvVars(env) {
    const e = env || process.env;
    return Object.keys(e).filter(function (k) {
        return /_EMULATOR_HOST$/.test(k) && String(e[k] || '') !== '';
    }).sort();
}

function stripScheme(host) {
    return String(host || '').replace(/^[a-z]+:\/\//i, '').replace(/\/+$/, '');
}

// Emulator mode needs both FIRESTORE_EMULATOR_HOST and
// FIREBASE_STORAGE_EMULATOR_HOST. Any other *_EMULATOR_HOST on its own
// (STORAGE_EMULATOR_HOST in particular, which the GCS client honors) would
// split a run between live and the emulator, so it is refused outright.
function emulatorMode(env) {
    const e = env || process.env;
    const set = emulatorEnvVars(e);
    if (!set.length) return false;
    const fsHost = e.FIRESTORE_EMULATOR_HOST || '';
    const stHost = e.FIREBASE_STORAGE_EMULATOR_HOST || '';
    if (!fsHost || !stHost) {
        throw new Error('refusing a split environment: ' + set.join(',')
            + ' is set without both FIRESTORE_EMULATOR_HOST and FIREBASE_STORAGE_EMULATOR_HOST;'
            + ' live mode needs every *_EMULATOR_HOST unset');
    }
    if (e.STORAGE_EMULATOR_HOST) {
        if (stripScheme(e.STORAGE_EMULATOR_HOST) !== stripScheme(stHost)) {
            throw new Error('refusing a split environment: STORAGE_EMULATOR_HOST does not match FIREBASE_STORAGE_EMULATOR_HOST');
        }
    } else if (e === process.env) {
        // The GCS client (used by firebase-admin) honors STORAGE_EMULATOR_HOST
        // with an http:// prefix. Without it, some metadata writes miss the emulator.
        process.env.STORAGE_EMULATOR_HOST = 'http://' + stripScheme(stHost);
    }
    return true;
}

function isLiveProject(project) {
    return project === LIVE_PROJECT;
}

function isRealProject(project) {
    return project === LIVE_PROJECT || project === STAGING_PROJECT;
}

function canonicalBucketFor(project, override) {
    if (override) return override;
    if (DEFAULT_CANONICAL_BUCKET[project]) return DEFAULT_CANONICAL_BUCKET[project];
    return project + '.firebasestorage.app';
}

// The Storage bucket to scan. Never guesses .appspot.com: with no --bucket it
// is the project's canonical firebasestorage.app bucket.
function defaultBucketFor(project) {
    return canonicalBucketFor(project, '');
}

function rollbackAllowedDirs(env) {
    return emulatorMode(env) ? [EMULATOR_SCRATCH_DIR] : [LIVE_ROLLBACK_DIR];
}

// Checks that run before any client is created. Pure: reads only opts and env.
function preflight(opts, env) {
    const e = env || process.env;
    const emu = emulatorMode(e);
    const project = opts.project;
    if (emu) {
        if (isRealProject(project)) throw new Error('refusing to point the emulator at a real project id');
    } else if (!isRealProject(project)) {
        throw new Error('refusing an unknown project outside the emulator');
    }
    const canonicalBucket = canonicalBucketFor(project, opts.canonicalBucket);
    const bucket = opts.bucket || defaultBucketFor(project);
    if (!emu && isLiveProject(project)) {
        const want = DEFAULT_CANONICAL_BUCKET[LIVE_PROJECT];
        if (bucket !== want) throw new Error('refusing live bucket ' + bucket + '; live must use ' + want);
        if (canonicalBucket !== want) throw new Error('refusing live canonical bucket ' + canonicalBucket + '; live must use ' + want);
    }
    let rollbackDir;
    if (emu) {
        rollbackDir = path.resolve(opts.rollbackDir || path.join(EMULATOR_SCRATCH_DIR, 'rollback'));
        if (!isInsideDir(rollbackDir, EMULATOR_SCRATCH_DIR)) {
            throw new Error('refusing an emulator rollback dir outside ' + EMULATOR_SCRATCH_DIR);
        }
    } else {
        rollbackDir = LIVE_ROLLBACK_DIR;
        if (opts.rollbackDir && path.resolve(opts.rollbackDir) !== LIVE_ROLLBACK_DIR) {
            throw new Error('refusing --rollback-dir on live; rollback files live only in ' + LIVE_ROLLBACK_DIR);
        }
    }
    if (opts.apply) {
        if (!opts.plan) throw new Error('--apply requires --plan');
        checkPlanShaFormat(opts.planSha);
    }
    return { emulator: emu, project: project, bucket: bucket, canonicalBucket: canonicalBucket, rollbackDir: rollbackDir };
}

// Strict path encoding so every rewritten URL matches the #334 F3 pattern
// ([A-Za-z0-9._%-] after the uid). encodeURIComponent leaves !'()*~ alone;
// Storage decodes %28 etc. back to the same object name.
function encodePath(objectPath) {
    return encodeURIComponent(objectPath).replace(/[!'()*~]/g, function (c) {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    });
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
    let bucket;
    let objectPath;
    try {
        bucket = decodeURIComponent(m[1]);
        objectPath = decodeURIComponent(m[2]);
    } catch (e) { return null; }
    if (objectPath.indexOf(OBJECT_PREFIX) !== 0) return null;
    const query = {};
    try {
        String(m[3] || '').split('&').forEach(function (part) {
            if (!part) return;
            const eq = part.indexOf('=');
            const k = eq === -1 ? part : decodeURIComponent(part.slice(0, eq));
            const v = eq === -1 ? '' : decodeURIComponent(part.slice(eq + 1));
            query[k] = v;
        });
    } catch (e) { return null; }
    const token = String(query.token || '');
    if (!token) return null;
    return { bucket: bucket, objectPath: objectPath, token: token, alt: query.alt || '' };
}

function isF3CanonicalUrl(url, senderUid, canonicalBucket) {
    if (!senderUid) return false;
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

// Would the rewritten URL for this object pass F3? Used by the dry run (with a
// placeholder token) and again by apply (with the real new token) before the
// first write.
function f3CheckObject(objectPath, canonicalBucket, token) {
    const sender = uploaderFromPath(objectPath);
    if (!sender) return false;
    return isF3CanonicalUrl(canonicalDownloadUrl(canonicalBucket, objectPath, token || F3_PROBE_TOKEN), sender, canonicalBucket);
}

function escapeRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokensFromMetadata(meta) {
    const raw = meta && meta.metadata && meta.metadata.firebaseStorageDownloadTokens;
    if (!raw) return [];
    return String(raw).split(',').map(function (t) { return t.trim(); }).filter(Boolean);
}

function tokenListSha(tokens) {
    return tokens && tokens.length ? sha256Hex(tokens.join(',')) : '';
}

function sameList(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

function sameSet(a, b) {
    const sa = a.slice().sort();
    const sb = b.slice().sort();
    return sameList(sa, sb);
}

// Every token in `cur` is one of `known`, and `cur` includes `must`.
function subsetWith(cur, known, must) {
    if (cur.indexOf(must) === -1) return false;
    return cur.every(function (t) { return known.indexOf(t) !== -1; });
}

async function getMetadataOrNull(file) {
    try {
        const [meta] = await file.getMetadata();
        return meta;
    } catch (e) {
        if (e && (e.code === 404 || e.code === '404' || /No such object|Not Found/i.test(String(e.message || '')))) return null;
        throw e;
    }
}

// Set the object's download token list to exactly `tokens` (in order). An
// empty list removes the token key. The Storage emulator appends tokens on
// setMetadata; if a write doesn't leave exactly the wanted list, the object
// bytes are re-uploaded with the same content and HTTP metadata (R11). On
// live GCS setMetadata replaces the key, so the re-upload is refused there
// unless --allow-reupload is given.
async function setDownloadTokens(file, tokens, ctx) {
    const c = ctx || {};
    if (!Array.isArray(tokens)) throw new Error('token list required');
    const [meta] = await file.getMetadata();
    const custom = Object.assign({}, (meta && meta.metadata) || {});
    custom.firebaseStorageDownloadTokens = tokens.length ? tokens.join(',') : null;
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: custom.firebaseStorageDownloadTokens } });
    let [after] = await file.getMetadata();
    let got = tokensFromMetadata(after);
    if (!sameList(got, tokens)) {
        if (!c.emulator && !c.allowReupload) {
            throw new Error('setMetadata did not replace the token list for ' + maskObjectPath(file.name)
                + '; refusing a re-upload on live without --allow-reupload');
        }
        const [buf] = await file.download({ decompress: false });
        const saveCustom = Object.assign({}, custom);
        if (!tokens.length) delete saveCustom.firebaseStorageDownloadTokens;
        const httpMeta = { metadata: saveCustom };
        ['contentType', 'cacheControl', 'contentDisposition', 'contentEncoding', 'contentLanguage'].forEach(function (k) {
            if (meta && meta[k]) httpMeta[k] = meta[k];
        });
        if (!httpMeta.contentType) httpMeta.contentType = 'image/jpeg';
        await file.save(buf, { resumable: false, metadata: httpMeta });
        if (c.counters) c.counters.reuploads = (c.counters.reuploads || 0) + 1;
        [after] = await file.getMetadata();
        got = tokensFromMetadata(after);
    }
    if (!sameList(got, tokens)) {
        throw new Error('failed to set the download token list for ' + maskObjectPath(file.name));
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

// visit(displayName, value, segments). segments is the Firestore field path
// as an array, or null when the value sits inside an array (not updatable
// with a field path).
function walkStringFields(data, visit) {
    function walk(value, field, segs) {
        if (typeof value === 'string') {
            visit(field, value, segs);
            return;
        }
        if (!value || typeof value !== 'object') return;
        if (typeof value.toDate === 'function') return;
        if (Array.isArray(value)) {
            value.forEach(function (v, i) { walk(v, field + '[' + i + ']', null); });
            return;
        }
        Object.keys(value).forEach(function (k) {
            walk(value[k], field ? field + '.' + k : k, segs ? segs.concat([k]) : null);
        });
    }
    walk(data, '', []);
}

function newToken() {
    return crypto.randomUUID();
}

// Create a private dir if missing. Never chmods a dir that already exists
// (R14: a --plan under /workspace/private must not chmod /workspace/private).
function ensureDir(dir) {
    if (fs.existsSync(dir)) return;
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(dir, 0o700); } catch (e) { /* best effort */ }
}

function fsyncDir(dir) {
    let fd;
    try {
        fd = fs.openSync(dir, 'r');
        fs.fsyncSync(fd);
    } catch (e) { /* best effort on filesystems without dir fsync */ }
    finally { if (fd != null) try { fs.closeSync(fd); } catch (e) { /* ignore */ } }
}

// For the plan file (hashes and masked paths only, no tokens).
function writePrivate(filePath, contents, mode) {
    ensureDir(path.dirname(filePath));
    const tmp = filePath + '.tmp-' + process.pid;
    const fd = fs.openSync(tmp, 'w', mode || 0o600);
    try {
        fs.writeSync(fd, contents);
        fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
    try { fs.chmodSync(tmp, mode || 0o600); } catch (e) { /* best effort */ }
    fs.renameSync(tmp, filePath);
    fsyncDir(path.dirname(filePath));
}

// Write a token-bearing file exactly once: exclusive create, mode 600, fsync
// the file and its dir. No temp copies, no rewrites (R9).
function writeOnceFsync(filePath, contents) {
    const fd = fs.openSync(filePath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    try {
        fs.writeSync(fd, contents);
        fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
    try { fs.chmodSync(filePath, 0o600); } catch (e) { /* best effort */ }
    fsyncDir(path.dirname(filePath));
}

const CACHEDIR_TAG = 'Signature: 8a477f597d28d172789f06886806bc55\n'
    + '# Rollback files here hold DM photo bearer tokens (reset-dm-photo-tokens.js).\n'
    + '# Backup tools that honor CACHEDIR.TAG (restic/borg/tar --exclude-caches) skip this dir.\n';

function ensureRollbackDir(dir) {
    ensureDir(dir);
    const tag = path.join(dir, 'CACHEDIR.TAG');
    if (!fs.existsSync(tag)) fs.writeFileSync(tag, CACHEDIR_TAG, { mode: 0o600 });
}

// Tokens are bearer links and uids are private. Never write either to logs,
// stdout, the plan, or test output. Only hashes and masked paths belong
// there. This is a last-resort scrubber for error text (R7).
function redactSecrets(text) {
    return String(text || '')
        .replace(/([?&]token=)[A-Za-z0-9-]+/gi, '$1[redacted]')
        .replace(/(firebaseStorageDownloadTokens["'\s:=]+)[A-Za-z0-9,-]+/gi, '$1[redacted]')
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[redacted-token]')
        .replace(/dm_conversations(\/|%2F)([^/\s"'`,;)%]+)/gi, function (m, sep, id) {
            return 'dm_conversations/' + maskConvoId(id);
        })
        .replace(/dm-images(?:\/|%2F)[^\s"'`,;)?]+/gi, function (m) {
            let decoded = m;
            try { decoded = decodeURIComponent(m); } catch (e) { /* keep raw */ }
            return maskObjectPath(decoded);
        });
}

function isInsideDir(filePath, dir) {
    const resolved = path.resolve(filePath);
    const root = path.resolve(dir);
    return resolved === root || resolved.startsWith(root + path.sep);
}

// Rollback files are read, written and shredded only inside the allowed dir:
// /workspace/private/f2reset/rollback on live, /tmp/rufus-f2reset in the
// emulator. Symlinks are resolved before the check.
function assertRollbackFilePath(filePath, mustExist, dirs) {
    const allowedDirs = dirs || rollbackAllowedDirs();
    if (!filePath) throw new Error('missing rollback file path');
    const resolved = path.resolve(filePath);
    const base = path.basename(resolved);
    if (!/^rollback-[A-Za-z0-9._-]+\.json$/.test(base)) {
        throw new Error('refusing a file that is not a rollback json');
    }
    const allowed = allowedDirs.some(function (dir) { return isInsideDir(resolved, dir); });
    if (!allowed) throw new Error('refusing a rollback path outside ' + allowedDirs.join(', '));
    if (mustExist) {
        if (!fs.existsSync(resolved)) throw new Error('rollback file not found');
        const real = fs.realpathSync(resolved);
        const realOk = allowedDirs.some(function (dir) {
            const root = fs.existsSync(dir) ? fs.realpathSync(dir) : path.resolve(dir);
            return real === root || real.startsWith(root + path.sep);
        });
        if (!realOk) throw new Error('refusing a rollback path outside ' + allowedDirs.join(', '));
        return real;
    }
    return resolved;
}

// Irreversibly delete a rollback file after the 7-day window. Uses shred -u.
function shredRollbackFile(filePath, dirs) {
    const real = assertRollbackFilePath(filePath, true, dirs);
    const result = spawnSync('shred', ['-u', '-z', real], { encoding: 'utf8' });
    if (result.error && result.error.code === 'ENOENT') {
        throw new Error('shred is not available on this machine');
    }
    if (result.status !== 0) throw new Error('shred failed');
    if (fs.existsSync(real)) throw new Error('rollback file still exists after shred');
    fsyncDir(path.dirname(real));
    return path.basename(real);
}

function appendAudit(auditPath, line) {
    if (!auditPath) return;
    ensureDir(path.dirname(auditPath));
    const stamp = new Date().toISOString();
    fs.appendFileSync(auditPath, stamp + ' ' + redactSecrets(line) + '\n', { mode: 0o600 });
}

function checkPlanShaFormat(sha) {
    const want = String(sha == null ? '' : sha);
    if (!want) throw new Error('missing --plan-sha');
    if (!/^[0-9a-f]{64}$/.test(want)) throw new Error('invalid --plan-sha: give the exact 64-char lowercase sha256 from the card');
    return want;
}

// R13: exact match only. No trimming or case folding.
function checkPlanSha(fileBytes, expectedSha) {
    const want = checkPlanShaFormat(expectedSha);
    const got = sha256Hex(fileBytes);
    if (got !== want) throw new Error('plan sha mismatch: got ' + got + ' expected ' + want);
    return got;
}

function initAdmin(project, bucketName) {
    const admin = require('../src/firebaseAdmin');
    if (admin.apps.length) return admin;
    const init = { projectId: project, storageBucket: bucketName || defaultBucketFor(project) };
    if (emulatorMode()) {
        if (isRealProject(project)) throw new Error('refusing to point the emulator at a real project id');
        process.env.GCLOUD_PROJECT = project;
        process.env.GOOGLE_CLOUD_PROJECT = project;
    } else if (process.env.FIREBASE_SA_JSON) {
        init.credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SA_JSON));
    }
    admin.initializeApp(init);
    return admin;
}

// Opens exactly the named bucket. No fallback to other bucket names (R3).
async function openBucket(admin, name) {
    const bucket = admin.storage().bucket(name);
    if (emulatorMode()) return { bucket: bucket, name: name };
    const [exists] = await bucket.exists();
    if (!exists) throw new Error('Storage bucket not found: ' + name);
    return { bucket: bucket, name: name };
}

async function listDmObjects(bucket) {
    const [files] = await bucket.getFiles({ prefix: OBJECT_PREFIX, autoPaginate: true });
    const out = [];
    for (const file of files) {
        const objectPath = file.name;
        if (!objectPath || objectPath.endsWith('/')) continue;
        const parts = objectPath.split('/');
        if (parts[0] !== 'dm-images' || parts.length < 3) continue;
        const meta = await getMetadataOrNull(file);
        if (!meta) continue;
        out.push({
            objectPath: objectPath,
            file: file,
            tokens: tokensFromMetadata(meta),
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
    walkStringFields(data, function (field, value, segs) {
        const parsed = parseStorageUrl(value);
        if (!parsed) return;
        hits.push({
            docPath: docPath,
            field: field || 'imageUrl',
            segments: segs && segs.length ? segs : null,
            url: value,
            parsed: parsed,
        });
    });
    return hits;
}

async function collectHits(db, convos) {
    const hits = [];
    for (const convo of convos) {
        const convoPath = 'dm_conversations/' + convo.id;
        hits.push.apply(hits, collectUrlHitsFromDoc(convoPath, convo.data));
        const msgs = await db.collection('dm_conversations').doc(convo.id).collection('messages').get();
        msgs.forEach(function (doc) {
            const docPath = convoPath + '/messages/' + doc.id;
            hits.push.apply(hits, collectUrlHitsFromDoc(docPath, doc.data() || {}));
        });
    }
    return hits;
}

function hitKey(docPath, field) {
    return sha256Hex(docPath) + '\0' + field;
}

function fieldSpec(h) {
    return { field: h.field, pathMasked: maskDocPath(h.docPath), pathSha256: sha256Hex(h.docPath) };
}

function sortSpecs(list) {
    return list.sort(function (a, b) {
        return a.pathSha256 < b.pathSha256 ? -1 : a.pathSha256 > b.pathSha256 ? 1 : a.field < b.field ? -1 : a.field > b.field ? 1 : 0;
    });
}

function buildPlan(opts) {
    const skippedConversations = opts.skippedConversations.map(function (c) {
        return { idMasked: maskConvoId(c.id), reason: c.shape.reason };
    }).sort(function (a, b) {
        return a.idMasked < b.idMasked ? -1 : a.idMasked > b.idMasked ? 1 : a.reason < b.reason ? -1 : 0;
    });
    const planItems = opts.items.map(function (it) {
        const messages = sortSpecs((it.messages || []).map(fieldSpec));
        const convoFields = sortSpecs((it.convoFields || []).map(fieldSpec));
        const lockedFields = sortSpecs((it.lockedFields || []).map(fieldSpec));
        return {
            objectPathMasked: maskObjectPath(it.objectPath),
            objectPathSha256: sha256Hex(it.objectPath),
            oldTokensSha256: tokenListSha(it.tokens),
            oldTokenCount: it.tokens.length,
            f3Ok: it.f3Ok,
            messageCount: messages.length,
            convoFieldCount: convoFields.length,
            lockedFieldCount: lockedFields.length,
            messages: messages,
            convoFields: convoFields,
            lockedFields: lockedFields,
        };
    }).sort(function (a, b) { return a.objectPathSha256 < b.objectPathSha256 ? -1 : 1; });

    const maskedObjects = function (list) {
        return (list || []).map(function (o) {
            return { objectPathMasked: maskObjectPath(o.objectPath), objectPathSha256: sha256Hex(o.objectPath) };
        }).sort(function (a, b) { return a.objectPathSha256 < b.objectPathSha256 ? -1 : 1; });
    };

    const unmatchedMessages = (opts.unmatchedMessages || []).map(function (h) {
        return { pathMasked: maskDocPath(h.docPath), pathSha256: sha256Hex(h.docPath), field: h.field, reason: h.reason };
    }).sort(function (a, b) { return a.pathSha256 < b.pathSha256 ? -1 : a.pathSha256 > b.pathSha256 ? 1 : a.field < b.field ? -1 : 1; });

    let plannedMessages = 0;
    let plannedConvoFields = 0;
    let lockedFields = 0;
    planItems.forEach(function (it) {
        plannedMessages += it.messageCount;
        plannedConvoFields += it.convoFieldCount;
        lockedFields += it.lockedFieldCount;
    });
    const f3Failed = planItems.filter(function (it) { return !it.f3Ok; }).map(function (it) {
        return { objectPathMasked: it.objectPathMasked, objectPathSha256: it.objectPathSha256 };
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
            orphanObjects: planItems.filter(function (it) {
                return it.messageCount === 0 && it.convoFieldCount === 0 && it.lockedFieldCount === 0;
            }).length,
            skippedConversations: skippedConversations.length,
            lockedObjects: planItems.filter(function (it) { return it.lockedFieldCount > 0; }).length,
            lockedFields: lockedFields,
            tokenlessObjects: (opts.tokenlessObjects || []).length,
            unmatchedMessages: unmatchedMessages.length,
            f3Failures: f3Failed.length,
        },
        skippedConversations: skippedConversations,
        tokenlessObjects: maskedObjects(opts.tokenlessObjects),
        f3FailedObjects: f3Failed,
        unmatchedMessages: unmatchedMessages,
        items: planItems,
    };
}

async function discover(admin, project, storageBucketName, canonicalBucket) {
    const db = admin.firestore();
    const opened = await openBucket(admin, storageBucketName);
    const objects = await listDmObjects(opened.bucket);
    const convos = await scanConversations(db);
    const wellHits = await collectHits(db, convos.wellFormed);
    const lockedHits = await collectHits(db, convos.skipped);

    const objectByPath = new Map();
    objects.forEach(function (o) { objectByPath.set(o.objectPath, o); });

    const groups = new Map();
    const group = function (objectPath) {
        if (!groups.has(objectPath)) groups.set(objectPath, { messages: [], convoFields: [], lockedFields: [] });
        return groups.get(objectPath);
    };
    const unmatched = [];
    wellHits.forEach(function (h) {
        const obj = objectByPath.get(h.parsed.objectPath);
        if (!obj) { unmatched.push({ docPath: h.docPath, field: h.field, reason: 'missing_object' }); return; }
        if (!obj.tokens.length) { unmatched.push({ docPath: h.docPath, field: h.field, reason: 'tokenless_object' }); return; }
        if (!h.segments) {
            // Rotating still revokes the old link; the array value just isn't rewritten.
            unmatched.push({ docPath: h.docPath, field: h.field, reason: 'array_field_not_rewritten' });
            return;
        }
        const g = group(obj.objectPath);
        if (h.docPath.indexOf('/messages/') !== -1) g.messages.push(h);
        else g.convoFields.push(h);
    });
    lockedHits.forEach(function (h) {
        const obj = objectByPath.get(h.parsed.objectPath);
        if (!obj || !obj.tokens.length) return;
        group(obj.objectPath).lockedFields.push(h);
    });

    const items = [];
    const tokenless = [];
    objects.forEach(function (o) {
        if (!o.tokens.length) { tokenless.push(o); return; }
        const g = groups.get(o.objectPath) || { messages: [], convoFields: [], lockedFields: [] };
        items.push({
            objectPath: o.objectPath,
            tokens: o.tokens,
            f3Ok: f3CheckObject(o.objectPath, canonicalBucket),
            messages: g.messages,
            convoFields: g.convoFields,
            lockedFields: g.lockedFields,
        });
    });

    return {
        bucket: opened.bucket,
        storageBucket: opened.name,
        canonicalBucket: canonicalBucket,
        objects: objects,
        convos: convos,
        wellHits: wellHits,
        lockedHits: lockedHits,
        plan: buildPlan({
            project: project,
            storageBucket: opened.name,
            canonicalBucket: canonicalBucket,
            items: items,
            skippedConversations: convos.skipped,
            tokenlessObjects: tokenless,
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
    console.log('locked-objects ' + c.lockedObjects);
    console.log('locked-fields ' + c.lockedFields);
    console.log('tokenless-objects ' + c.tokenlessObjects);
    console.log('unmatched-messages ' + c.unmatchedMessages);
    console.log('f3-failures ' + c.f3Failures);
    (plan.f3FailedObjects || []).forEach(function (s) {
        console.log('f3-fail ' + s.objectPathMasked);
    });
}

function shredAfterDate(createdIso) {
    const d = new Date(new Date(createdIso).getTime() + SHRED_DAYS * 24 * 3600 * 1000);
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    return { iso: d.toISOString(), dayEt: day };
}

function rollbackFileName(project, planSha) {
    return 'rollback-' + project + '-' + planSha.slice(0, 16) + '.json';
}

// Build the full apply journal (old token lists, new tokens, every field's old
// and new URL) and validate all of it before anything is written (A2).
function prepareApply(plan, discovery, counters) {
    const byPathSha = new Map();
    discovery.objects.forEach(function (o) { byPathSha.set(sha256Hex(o.objectPath), o); });
    const hits = new Map();
    discovery.wellHits.forEach(function (h) { hits.set(hitKey(h.docPath, h.field), h); });

    const items = [];
    const f3Fails = [];
    for (const item of plan.items || []) {
        const obj = byPathSha.get(item.objectPathSha256);
        if (!obj) {
            counters.vanishedObjects += 1;
            continue;
        }
        if (tokenListSha(obj.tokens) !== item.oldTokensSha256) {
            // Someone changed the token list after the dry run. Don't guess.
            counters.tokenConflicts += 1;
            continue;
        }
        const token = newToken();
        if (!f3CheckObject(obj.objectPath, plan.canonicalBucket, token)) {
            f3Fails.push(item.objectPathMasked);
            continue;
        }
        const fields = [];
        [].concat(item.messages || [], item.convoFields || []).forEach(function (spec) {
            const h = hits.get(spec.pathSha256 + '\0' + spec.field);
            if (!h || h.parsed.objectPath !== obj.objectPath || !h.segments) {
                counters.vanishedFields += 1;
                return;
            }
            fields.push({
                docPath: h.docPath,
                field: h.field,
                segments: h.segments,
                oldUrl: h.url,
                newUrl: canonicalDownloadUrl(plan.canonicalBucket, obj.objectPath, token),
            });
        });
        items.push({ objectPath: obj.objectPath, oldTokens: obj.tokens.slice(), newToken: token, fields: fields });
    }
    if (f3Fails.length) {
        throw new Error(f3Fails.length + ' planned object(s) would fail F3; nothing was written');
    }
    return items;
}

// R13: fields added after the dry run that point at a planned object. They
// are not in the plan, so they keep the revoked token. Counted, not written.
function countDrift(plan, discovery) {
    const plannedObjects = new Set();
    const plannedKeys = new Set();
    (plan.items || []).forEach(function (item) {
        plannedObjects.add(item.objectPathSha256);
        [].concat(item.messages || [], item.convoFields || [], item.lockedFields || []).forEach(function (s) {
            plannedKeys.add(s.pathSha256 + '\0' + s.field);
        });
    });
    let n = 0;
    [].concat(discovery.wellHits || [], discovery.lockedHits || []).forEach(function (h) {
        if (plannedObjects.has(sha256Hex(h.parsed.objectPath)) && !plannedKeys.has(hitKey(h.docPath, h.field))) n += 1;
    });
    return n;
}

function crashHook(objectPath, emulator) {
    const want = process.env.F2RESET_TEST_CRASH_OBJECT_SHA;
    if (!emulator || !want) return;
    if (sha256Hex(objectPath).indexOf(want) === 0) process.exit(70);
}

async function readField(db, docPath, segments) {
    const admin = require('../src/firebaseAdmin');
    const snap = await db.doc(docPath).get();
    if (!snap.exists) return { exists: false };
    return { exists: true, value: snap.get(new admin.firestore.FieldPath(...segments)) };
}

async function writeField(db, docPath, segments, value) {
    const admin = require('../src/firebaseAdmin');
    try {
        await db.doc(docPath).update(new admin.firestore.FieldPath(...segments), value);
        return true;
    } catch (e) {
        if (e && (e.code === 5 || /NOT_FOUND|No document to update/i.test(String(e.message || '')))) return false;
        throw e;
    }
}

// Idempotent: each object and field moves old -> new only from a known state.
async function executeJournal(admin, bucket, journal, opts, ctx, counters) {
    const db = admin.firestore();
    for (const item of journal.items) {
        const file = bucket.file(item.objectPath);
        const masked = maskObjectPath(item.objectPath);
        const meta = await getMetadataOrNull(file);
        if (!meta) {
            counters.vanishedObjects += 1;
            appendAudit(opts.audit, 'vanished-object ' + masked);
            continue;
        }
        const cur = tokensFromMetadata(meta);
        if (sameList(cur, [item.newToken])) {
            counters.alreadyRotated += 1;
        } else if (sameSet(cur, item.oldTokens) || subsetWith(cur, item.oldTokens.concat([item.newToken]), item.newToken)) {
            await setDownloadTokens(file, [item.newToken], ctx);
            counters.rotated += 1;
            appendAudit(opts.audit, 'rotated ' + masked);
        } else {
            counters.tokenConflicts += 1;
            appendAudit(opts.audit, 'token-conflict ' + masked);
            continue;
        }
        let n = 0;
        for (const f of item.fields) {
            const cur2 = await readField(db, f.docPath, f.segments);
            if (!cur2.exists) { counters.vanishedFields += 1; continue; }
            if (cur2.value === f.newUrl) { counters.fieldsAlready += 1; continue; }
            if (cur2.value !== f.oldUrl) { counters.changedFields += 1; continue; }
            const ok = await writeField(db, f.docPath, f.segments, f.newUrl);
            if (!ok) { counters.vanishedFields += 1; continue; }
            counters.rewritten += 1;
            appendAudit(opts.audit, 'rewrote ' + maskDocPath(f.docPath) + ' ' + f.field);
            n += 1;
            if (n === 1 && item.fields.length > 1) crashHook(item.objectPath, ctx.emulator);
        }
    }
}

function newCounters() {
    return {
        rotated: 0, alreadyRotated: 0, rewritten: 0, fieldsAlready: 0,
        vanishedObjects: 0, vanishedFields: 0, tokenConflicts: 0, driftFields: 0, changedFields: 0, reuploads: 0,
        restoredTokens: 0, alreadyRestored: 0, restoredFields: 0,
    };
}

function loadRollback(filePath, dirs) {
    const real = assertRollbackFilePath(filePath, true, dirs);
    const data = JSON.parse(fs.readFileSync(real, 'utf8'));
    if (data.version !== ROLLBACK_VERSION) throw new Error('unsupported rollback version');
    if (!Array.isArray(data.items)) throw new Error('rollback file has no items');
    return { real: real, data: data };
}

async function runRollback(opts) {
    const dirs = rollbackAllowedDirs();
    const loaded = loadRollback(opts.rollback, dirs);
    const data = loaded.data;
    const project = data.project;
    if (!project) throw new Error('rollback file missing project');
    if (opts.project && opts.project !== project) throw new Error('rollback project does not match --project');
    const pre = preflight({ project: project, bucket: opts.bucket || data.storageBucket, canonicalBucket: data.canonicalBucket }, process.env);
    if (pre.bucket !== data.storageBucket) throw new Error('rollback bucket does not match the file');
    assertWriteAllowed(project, 'rollback');
    if (!opts.audit) opts.audit = path.join(path.dirname(path.dirname(loaded.real)), 'audit-rollback.log');
    const admin = initAdmin(project, pre.bucket);
    const opened = await openBucket(admin, pre.bucket);
    const db = admin.firestore();
    const counters = newCounters();
    const ctx = { emulator: pre.emulator, allowReupload: opts.allowReupload, counters: counters };
    appendAudit(opts.audit, 'rollback-start ' + path.basename(loaded.real));
    for (const item of data.items) {
        if (!item.objectPath || !Array.isArray(item.oldTokens) || !item.newToken) throw new Error('malformed rollback item');
        const file = opened.bucket.file(item.objectPath);
        const masked = maskObjectPath(item.objectPath);
        const meta = await getMetadataOrNull(file);
        if (!meta) { counters.vanishedObjects += 1; continue; }
        const cur = tokensFromMetadata(meta);
        if (sameList(cur, item.oldTokens)) {
            counters.alreadyRestored += 1;
        } else if (sameList(cur, [item.newToken]) || subsetWith(cur, item.oldTokens.concat([item.newToken]), item.newToken)) {
            // R15: only overwrite a token list this tool set.
            await setDownloadTokens(file, item.oldTokens, ctx);
            counters.restoredTokens += 1;
            appendAudit(opts.audit, 'rollback-token ' + masked);
        } else {
            counters.tokenConflicts += 1;
            appendAudit(opts.audit, 'rollback-token-conflict ' + masked);
            continue;
        }
        for (const f of item.fields || []) {
            const cur2 = await readField(db, f.docPath, f.segments);
            if (!cur2.exists) { counters.vanishedFields += 1; continue; }
            if (cur2.value === f.oldUrl) { counters.fieldsAlready += 1; continue; }
            if (cur2.value !== f.newUrl) { counters.changedFields += 1; continue; }
            const ok = await writeField(db, f.docPath, f.segments, f.oldUrl);
            if (!ok) { counters.vanishedFields += 1; continue; }
            counters.restoredFields += 1;
            appendAudit(opts.audit, 'rollback-field ' + maskDocPath(f.docPath) + ' ' + f.field);
        }
    }
    appendAudit(opts.audit, 'rollback-done tokens=' + counters.restoredTokens + ' fields=' + counters.restoredFields
        + ' conflicts=' + counters.tokenConflicts + ' vanished-objects=' + counters.vanishedObjects
        + ' vanished-fields=' + counters.vanishedFields);
    console.log('mode rollback');
    console.log('restored-tokens ' + counters.restoredTokens);
    console.log('already-restored ' + counters.alreadyRestored);
    console.log('restored-fields ' + counters.restoredFields);
    console.log('token-conflicts ' + counters.tokenConflicts);
    console.log('vanished-objects ' + counters.vanishedObjects);
    console.log('vanished-fields ' + counters.vanishedFields);
    console.log('changed-fields ' + counters.changedFields);
    console.log('reuploads ' + counters.reuploads);
    return counters.tokenConflicts ? 3 : 0;
}

function assertWriteAllowed(project, action) {
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

function defaultPaths(opts, project, emulator) {
    const dir = emulator ? EMULATOR_SCRATCH_DIR : DEFAULT_PLAN_DIR;
    const plan = opts.plan || path.join(dir, 'plan-' + project + '.json');
    const audit = opts.audit || path.join(path.dirname(plan), 'audit-' + project + '.log');
    return { plan: plan, audit: audit };
}

async function runApply(opts, pre) {
    assertWriteAllowed(opts.project, 'apply');
    const fileBytes = fs.readFileSync(opts.plan);
    const planSha = checkPlanSha(fileBytes, opts.planSha);
    const planned = JSON.parse(fileBytes.toString('utf8'));
    if (planned.version !== PLAN_VERSION) throw new Error('unsupported plan version; run a fresh dry run');
    if (planned.project !== opts.project) throw new Error('plan project does not match --project');
    if (planned.canonicalBucket !== pre.canonicalBucket) throw new Error('plan canonical bucket does not match');
    if (planned.storageBucket !== pre.bucket) throw new Error('plan storage bucket does not match --bucket');
    if (!planned.counts || planned.counts.f3Failures !== 0) {
        throw new Error('plan has F3 failures; nothing was written');
    }

    const rollbackPath = path.join(pre.rollbackDir, rollbackFileName(opts.project, planSha));
    assertRollbackFilePath(rollbackPath, false);
    const admin = initAdmin(opts.project, pre.bucket);
    const counters = newCounters();
    const ctx = { emulator: pre.emulator, allowReupload: opts.allowReupload, counters: counters };
    let journal;
    let resumed = false;
    const discovery = await discover(admin, opts.project, pre.bucket, pre.canonicalBucket);
    if (discovery.storageBucket !== planned.storageBucket) throw new Error('plan storage bucket does not match');
    const bucket = discovery.bucket;
    counters.driftFields += countDrift(planned, discovery);
    if (fs.existsSync(rollbackPath)) {
        // Resume (A5): the rollback file already pins every new token.
        const loaded = loadRollback(rollbackPath);
        journal = loaded.data;
        if (journal.planSha256 !== planSha || journal.project !== opts.project || journal.storageBucket !== pre.bucket) {
            throw new Error('existing rollback file does not match this plan');
        }
        resumed = true;
        appendAudit(opts.audit, 'apply-resume sha=' + planSha + ' items=' + journal.items.length);
    } else {
        const items = prepareApply(planned, discovery, counters);
        const created = new Date().toISOString();
        const shred = shredAfterDate(created);
        journal = {
            version: ROLLBACK_VERSION,
            project: opts.project,
            planSha256: planSha,
            storageBucket: pre.bucket,
            canonicalBucket: pre.canonicalBucket,
            createdAt: created,
            shredAfter: shred.iso,
            items: items,
        };
        ensureRollbackDir(pre.rollbackDir);
        writeOnceFsync(rollbackPath, stableStringify(journal));
        appendAudit(opts.audit, 'apply-start sha=' + planSha + ' items=' + items.length
            + ' rollback=' + path.basename(rollbackPath));
    }

    await executeJournal(admin, bucket, journal, opts, ctx, counters);
    const shred = shredAfterDate(journal.createdAt);
    appendAudit(opts.audit, 'apply-done rotated=' + counters.rotated
        + ' already-rotated=' + counters.alreadyRotated
        + ' rewritten=' + counters.rewritten
        + ' fields-already=' + counters.fieldsAlready
        + ' vanished-objects=' + counters.vanishedObjects
        + ' vanished-fields=' + counters.vanishedFields
        + ' token-conflicts=' + counters.tokenConflicts
        + ' drift-fields=' + counters.driftFields
        + ' changed-fields=' + counters.changedFields
        + ' reuploads=' + counters.reuploads);
    printSummary(planned, planSha, resumed ? 'apply-resume' : 'apply');
    console.log('rotated ' + counters.rotated);
    console.log('already-rotated ' + counters.alreadyRotated);
    console.log('rewritten ' + counters.rewritten);
    console.log('fields-already ' + counters.fieldsAlready);
    console.log('vanished-objects ' + counters.vanishedObjects);
    console.log('vanished-fields ' + counters.vanishedFields);
    console.log('token-conflicts ' + counters.tokenConflicts);
    console.log('drift-fields ' + counters.driftFields);
    console.log('changed-fields ' + counters.changedFields);
    console.log('reuploads ' + counters.reuploads);
    console.log('rollback ' + rollbackPath);
    console.log('shred-after ' + shred.dayEt + ' ET');
    console.log('audit ' + opts.audit);
    return counters.tokenConflicts ? 3 : 0;
}

async function main(argv) {
    const opts = parseArgs(argv || process.argv.slice(2));
    if (opts.help) {
        console.log(usage());
        return 0;
    }
    // Refuse a split live/emulator environment before anything else.
    emulatorMode();
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
        if (opts.apply || opts.planSha) throw new Error('--rollback cannot be combined with --apply');
        return runRollback(opts);
    }
    if (!opts.project) throw new Error('missing --project\n' + usage());
    if (opts.apply && !opts.plan) throw new Error('--apply requires --plan');
    if (opts.apply && !opts.planSha) throw new Error('--apply requires --plan-sha');
    if (opts.apply) assertWriteAllowed(opts.project, 'apply');
    const pre = preflight(opts, process.env);
    if (!pre.emulator && opts.project === STAGING_PROJECT) {
        console.log('note staging has no Storage bucket; a live dry-run should use ' + LIVE_PROJECT);
    }
    const paths = defaultPaths(opts, opts.project, pre.emulator);
    opts.plan = paths.plan;
    opts.audit = paths.audit;

    if (opts.apply) return runApply(opts, pre);

    const admin = initAdmin(opts.project, pre.bucket);
    const discovery = await discover(admin, opts.project, pre.bucket, pre.canonicalBucket);
    const planText = stableStringify(discovery.plan);
    writePrivate(opts.plan, planText, 0o600);
    const planSha = sha256Hex(fs.readFileSync(opts.plan));
    appendAudit(opts.audit, 'dry-run sha=' + planSha
        + ' objects=' + discovery.plan.counts.plannedObjects
        + ' messages=' + discovery.plan.counts.plannedMessages
        + ' skipped-convos=' + discovery.plan.counts.skippedConversations
        + ' locked-objects=' + discovery.plan.counts.lockedObjects
        + ' f3-failures=' + discovery.plan.counts.f3Failures);
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
    encodePath,
    isF3CanonicalUrl,
    f3CheckObject,
    dmConvoShape,
    buildPlan,
    tokensFromMetadata,
    tokenListSha,
    setDownloadTokens,
    emulatorDownloadUrl,
    emulatorMode,
    emulatorEnvVars,
    preflight,
    defaultBucketFor,
    rollbackAllowedDirs,
    redactSecrets,
    assertRollbackFilePath,
    shredRollbackFile,
    shredAfterDate,
    checkPlanSha,
    ensureDir,
    writeOnceFsync,
    LIVE_ROLLBACK_DIR,
    EMULATOR_SCRATCH_DIR,
    main,
};
