#!/usr/bin/env node
'use strict';

// Replace Telegram bot file URLs stored in Firestore.
//
// Dry-run is the default. It reads global_chat (the only collection the
// chat-bridge worker writes these URLs into) and prints counts and document
// ids. It does not write and it does not print URLs or bot tokens.
//
//   node scripts/scrub-telegram-urls.js
//   node scripts/scrub-telegram-urls.js --apply --backup-dir /workspace/private/telegram-scrub-backup-YYYYMMDD
//   node scripts/scrub-telegram-urls.js --ids-only
//
// --apply requires --backup-dir. The path must be absolute and private.
// Paths inside the repo, relative paths, /tmp, /dev/shm, world-writable
// locations (the path, its realpath, or any ancestor, including a
// symlink into one), /workspace outside /workspace/private,
// /workspace/private itself, reserved shared subdirectories, and
// home-dir shared folders are refused. The intended location is a new
// dedicated directory such as
// /workspace/private/telegram-scrub-backup-<date>/, created with mode
// 0700. The path must not already exist, so the tool can create it
// itself. A later retry may reuse that same directory only when it
// contains this tool's own marker file, is owned by the current user,
// is mode 0700, and is not a symlink. Earlier backup files in that
// directory are kept. Backup files are created with mode 0600 and the
// exclusive 'wx' flag so an existing file or symlink is never
// overwritten. The resolved backup path is printed at the start and
// end of every --apply run. After a partial failure, re-run with the
// same --backup-dir. The backup contains the original URLs. Keep it
// private and delete it after the bot tokens are rotated.
//
// --apply writes that backup of every affected document first, then
// downloads each file and stores a Firebase Storage download URL under
// chat-images/tg/<random>. When the file can no longer be fetched, the field
// is set to null and the document gets mediaRemoved: true.
// After a successful --apply, maintenance/telegram_file_url_scrub is marked
// applied. A later run, with or without --apply, does nothing.
//
// --apply is allowed only when the resolved projectId is
// bitcoin-education-archive and the resolved Storage bucket is
// bitcoin-education-archive.firebasestorage.app. GCLOUD_PROJECT or
// GOOGLE_CLOUD_PROJECT may retarget a dry-run or --ids-only scan, but
// those values cannot authorize --apply against any other project.
// FIREBASE_STORAGE_BUCKET may retarget a dry-run, but --apply is
// refused if it is set to any other bucket. The resolved projectId
// and bucket are printed at the start of every run.
//
// --ids-only scans telegram_mirror_queue and announcements and prints
// document ids and matched field names only. It never prints URLs and
// never writes.
//
// Credentials are Application Default Credentials. No key file is read.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const guard = require(path.join(__dirname, '..', 'functions', 'src', 'telegramFileGuard'));

const APPLY_PROJECT_ID = 'bitcoin-education-archive';
const APPLY_BUCKET = 'bitcoin-education-archive.firebasestorage.app';
const DEFAULT_BUCKET = APPLY_BUCKET;
const RESERVED_PRIVATE_SUBDIRS = [
    'redteam-audit',
];
const BACKUP_DIR_MARKER = '.bq-telegram-scrub-marker';
const BACKUP_DIR_MARKER_BODY = 'bq-telegram-scrub-backup-dir\n';
const PAGE = 300;
const MAX_BYTES = 20 * 1024 * 1024;
const REPO_ROOT = path.resolve(__dirname, '..');
const IDS_ONLY_COLLECTIONS = ['telegram_mirror_queue', 'announcements'];
const HOME_SHARED_DIRS = [
    'Desktop',
    'Documents',
    'Downloads',
    'Public',
    'Pictures',
    'Music',
    'Videos',
    'Templates',
    'Shared',
    'shared',
    'tmp',
    'Temp',
];

function parseArgs(argv) {
    const args = {
        help: false,
        apply: false,
        idsOnly: false,
        backupDir: null,
    };
    const list = argv || [];
    for (let i = 0; i < list.length; i++) {
        const token = list[i];
        if (token === '--help' || token === '-h') {
            args.help = true;
        } else if (token === '--apply') {
            args.apply = true;
        } else if (token === '--ids-only') {
            args.idsOnly = true;
        } else if (token === '--backup-dir') {
            args.backupDir = i + 1 < list.length ? list[++i] : '';
        } else if (token.indexOf('--backup-dir=') === 0) {
            args.backupDir = token.slice('--backup-dir='.length);
        }
    }
    return args;
}

function say(log, line) {
    const out = guard.redactSecrets(line);
    if (guard.containsTelegramBotMaterial(out)) return;
    (log || console.log)(out);
}

function resolveProjectId(env) {
    const e = env || process.env;
    return e.GCLOUD_PROJECT || e.GOOGLE_CLOUD_PROJECT || APPLY_PROJECT_ID;
}

function resolveBucket(env) {
    const e = env || process.env;
    return e.FIREBASE_STORAGE_BUCKET || DEFAULT_BUCKET;
}

function printTarget(projectId, bucketName, log) {
    say(log, 'projectId=' + projectId);
    say(log, 'bucket=' + bucketName);
}

function printHelp() {
    console.log('Usage: node scripts/scrub-telegram-urls.js [--apply --backup-dir /absolute/path] [--ids-only]');
    console.log('Dry-run is the default. --apply rehosts media and then marks the scrub applied.');
    console.log('--apply requires --backup-dir pointing at a new dedicated absolute path');
    console.log('outside the repo (for example /workspace/private/telegram-scrub-backup-YYYYMMDD/).');
    console.log('The path must not already exist. After a partial failure, re-run with');
    console.log('the same --backup-dir.');
    console.log('Relative paths, the repo tree, /tmp, /dev/shm, world-writable paths,');
    console.log('/workspace outside /workspace/private, /workspace/private itself, reserved');
    console.log('shared subdirectories, and home-dir shared folders are refused.');
    console.log('--apply is allowed only when the resolved projectId is ' + APPLY_PROJECT_ID);
    console.log('and the resolved bucket is ' + APPLY_BUCKET + '.');
    console.log('--ids-only scans telegram_mirror_queue and announcements and prints');
    console.log('document ids and matched field names only.');
    console.log('Collections: ' + guard.SCRUB_COLLECTIONS.join(','));
}

function tryRealpath(p) {
    try { return fs.realpathSync(p); }
    catch (err) { return null; }
}

function isPathInside(parent, child) {
    if (!parent || !child) return false;
    const root = path.resolve(parent);
    const target = path.resolve(child);
    if (root === target) return true;
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    return target.startsWith(prefix);
}

function resolveExisting(input) {
    let cur = path.resolve(input);
    const missing = [];
    while (!fs.existsSync(cur) && cur !== path.dirname(cur)) {
        missing.unshift(path.basename(cur));
        cur = path.dirname(cur);
    }
    const existing = tryRealpath(cur) || cur;
    return missing.length ? path.resolve(existing, path.join.apply(path, missing)) : path.resolve(existing);
}

function repoRoot() {
    return tryRealpath(REPO_ROOT) || REPO_ROOT;
}

function sharedTmpRoots() {
    const roots = [];
    const candidates = ['/tmp', '/var/tmp', '/var/folders', '/dev/shm', '/run/shm', '/dev/mqueue'];
    const tmpDir = os.tmpdir();
    if (tmpDir) candidates.push(tmpDir);
    for (let i = 0; i < candidates.length; i++) {
        const raw = candidates[i];
        const real = tryRealpath(raw) || path.resolve(raw);
        if (roots.indexOf(real) === -1) roots.push(real);
    }
    return roots;
}

function homeDirs() {
    const homes = [];
    const seen = [];
    if (process.env.HOME) homes.push(process.env.HOME);
    try {
        const fromOs = os.homedir();
        if (fromOs) homes.push(fromOs);
    } catch (err) { /* ignore */ }
    for (let i = 0; i < homes.length; i++) {
        const home = tryRealpath(homes[i]) || path.resolve(homes[i]);
        if (seen.indexOf(home) === -1) seen.push(home);
    }
    return seen;
}

function homeSharedFolderRoots() {
    const roots = [];
    const homes = homeDirs();
    for (let i = 0; i < homes.length; i++) {
        for (let j = 0; j < HOME_SHARED_DIRS.length; j++) {
            const shared = path.join(homes[i], HOME_SHARED_DIRS[j]);
            const real = tryRealpath(shared) || path.resolve(shared);
            if (roots.indexOf(real) === -1) roots.push(real);
        }
    }
    return roots;
}

function isOtherWritableMode(mode) {
    return (mode & 0o002) !== 0;
}

function existsLstat(p) {
    try {
        return fs.lstatSync(p);
    } catch (err) {
        if (err && err.code === 'ENOENT') return null;
        throw err;
    }
}

function reservedPrivateRoots(workspacePrivate) {
    const roots = [];
    for (let i = 0; i < RESERVED_PRIVATE_SUBDIRS.length; i++) {
        const raw = path.join(workspacePrivate, RESERVED_PRIVATE_SUBDIRS[i]);
        const real = tryRealpath(raw) || path.resolve(raw);
        if (roots.indexOf(real) === -1) roots.push(real);
    }
    return roots;
}

function collectWritableCheckPaths(input) {
    const seen = Object.create(null);
    const paths = [];
    function add(p) {
        if (!p) return;
        const resolved = path.resolve(p);
        if (seen[resolved]) return;
        seen[resolved] = true;
        paths.push(resolved);
    }
    function addWalk(start) {
        let cur = path.resolve(start);
        for (;;) {
            add(cur);
            const lst = existsLstat(cur);
            if (lst) {
                const real = tryRealpath(cur);
                if (real && real !== cur && !seen[real]) addWalk(real);
            }
            const parent = path.dirname(cur);
            if (parent === cur) break;
            cur = parent;
        }
    }
    addWalk(input);
    addWalk(resolveExisting(input));
    return paths;
}

function isWorldWritableLocation(input) {
    if (!input) return false;
    const paths = collectWritableCheckPaths(input);
    for (let i = 0; i < paths.length; i++) {
        const cur = paths[i];
        const lst = existsLstat(cur);
        if (!lst) continue;
        if (isOtherWritableMode(lst.mode)) return true;
        if (lst.isSymbolicLink()) {
            try {
                const st = fs.statSync(cur);
                if (isOtherWritableMode(st.mode)) return true;
            } catch (err) { /* dangling symlink */ }
        }
    }
    return false;
}

function inspectBackupDir(resolved) {
    const lst = existsLstat(resolved);
    if (!lst) return 'missing';
    if (lst.isSymbolicLink()) return 'symlink';
    if (!lst.isDirectory()) return 'not-dir';
    const entries = fs.readdirSync(resolved);
    if (!entries.length) return 'empty';
    let hasMarker = false;
    for (let i = 0; i < entries.length; i++) {
        if (entries[i] === BACKUP_DIR_MARKER) {
            hasMarker = true;
            continue;
        }
        if (!/^backup-[A-Za-z0-9_+-]+\.json$/.test(entries[i])) return 'not-empty';
    }
    return hasMarker ? 'marked' : 'unmarked';
}

function throwBackupDir(message, code) {
    const err = new Error(message);
    err.code = code;
    throw err;
}

function backupDirOpenFlags() {
    let flags = fs.constants.O_RDONLY;
    if (fs.constants.O_DIRECTORY) flags |= fs.constants.O_DIRECTORY;
    if (fs.constants.O_NOFOLLOW) flags |= fs.constants.O_NOFOLLOW;
    return flags;
}

function openBackupDir(resolved) {
    return fs.openSync(resolved, backupDirOpenFlags());
}

function markerFilePath(dir) {
    return path.resolve(dir, BACKUP_DIR_MARKER);
}

function hasValidMarker(dir) {
    const file = markerFilePath(dir);
    const lst = existsLstat(file);
    if (!lst || lst.isSymbolicLink() || !lst.isFile()) return false;
    if (typeof process.getuid === 'function' && lst.uid !== process.getuid()) return false;
    let body;
    try { body = fs.readFileSync(file, 'utf8'); }
    catch (err) { return false; }
    return body === BACKUP_DIR_MARKER_BODY;
}

function closeFd(fd) {
    if (fd == null) return;
    try { fs.closeSync(fd); } catch (err) { /* ignore */ }
}

function assertReusableBackupDir(resolved) {
    const lst = existsLstat(resolved);
    if (!lst) {
        throwBackupDir('backup-dir already exists; pass a new path, or reuse a directory this tool created', 'backup-dir-exists');
    }
    if (lst.isSymbolicLink()) {
        throwBackupDir('backup-dir must not be a symlink', 'backup-dir-symlink');
    }
    if (!lst.isDirectory()) {
        throwBackupDir('backup-dir must be a directory', 'backup-dir-not-dir');
    }
    if (typeof process.getuid === 'function' && lst.uid !== process.getuid()) {
        throwBackupDir('backup-dir must be owned by the current user', 'backup-dir-owner');
    }
    if ((lst.mode & 0o777) !== 0o700) {
        throwBackupDir('backup-dir must be mode 0700', 'backup-dir-mode');
    }
    let fd;
    try {
        fd = openBackupDir(resolved);
        const st = fs.fstatSync(fd);
        if (!st.isDirectory()) {
            throwBackupDir('backup-dir must be a directory', 'backup-dir-not-dir');
        }
        if (typeof process.getuid === 'function' && st.uid !== process.getuid()) {
            throwBackupDir('backup-dir must be owned by the current user', 'backup-dir-owner');
        }
        if ((st.mode & 0o777) !== 0o700) {
            throwBackupDir('backup-dir must be mode 0700', 'backup-dir-mode');
        }
    } catch (err) {
        if (err && err.code && String(err.code).indexOf('backup-dir-') === 0) throw err;
        if (err && (err.code === 'ELOOP' || err.code === 'ENOTDIR')) {
            throwBackupDir('backup-dir must not be a symlink', 'backup-dir-symlink');
        }
        throw err;
    } finally {
        closeFd(fd);
    }
    if (!hasValidMarker(resolved)) {
        throwBackupDir('backup-dir already exists; pass a new path, or reuse a directory this tool created', 'backup-dir-exists');
    }
}

function writeMarker(resolved) {
    const file = markerFilePath(resolved);
    try {
        fs.writeFileSync(file, BACKUP_DIR_MARKER_BODY, { flag: 'wx', mode: 0o600 });
    } catch (err) {
        if (err && err.code === 'EEXIST') {
            throwBackupDir('backup-dir already exists; pass a new path, or reuse a directory this tool created', 'backup-dir-exists');
        }
        throw err;
    }
    const lst = existsLstat(file);
    if (!lst || lst.isSymbolicLink() || !lst.isFile()) {
        throwBackupDir('backup-dir marker is not a regular file', 'backup-dir-exists');
    }
    fs.chmodSync(file, 0o600);
}

function ensureBackupDir(resolved) {
    const lst = existsLstat(resolved);
    if (lst) {
        assertReusableBackupDir(resolved);
        return { created: false, dir: resolved };
    }
    fs.mkdirSync(resolved, { recursive: false, mode: 0o700 });
    let fd;
    try {
        fd = openBackupDir(resolved);
        const st = fs.fstatSync(fd);
        if (!st.isDirectory()) {
            throwBackupDir('backup-dir must be a directory', 'backup-dir-not-dir');
        }
        if (typeof process.getuid === 'function' && st.uid !== process.getuid()) {
            throwBackupDir('backup-dir must be owned by the current user', 'backup-dir-owner');
        }
        fs.fchmodSync(fd, 0o700);
    } catch (err) {
        if (err && err.code && String(err.code).indexOf('backup-dir-') === 0) throw err;
        if (err && (err.code === 'ELOOP' || err.code === 'ENOTDIR')) {
            throwBackupDir('backup-dir must not be a symlink', 'backup-dir-symlink');
        }
        throw err;
    } finally {
        closeFd(fd);
    }
    const created = existsLstat(resolved);
    if (!created || created.isSymbolicLink() || !created.isDirectory()) {
        throwBackupDir('backup-dir must not be a symlink', 'backup-dir-symlink');
    }
    writeMarker(resolved);
    return { created: true, dir: resolved };
}

function sanitizeBackupStamp(nowIso) {
    const raw = String(nowIso == null || String(nowIso).trim() === '' ? new Date().toISOString() : nowIso);
    const stamp = raw.replace(/[:.]/g, '-').replace(/[^A-Za-z0-9_+-]/g, '-');
    if (!stamp || /^-+$/.test(stamp) || stamp.indexOf('..') !== -1) {
        const err = new Error('backup timestamp is not a safe filename');
        err.code = 'backup-stamp';
        throw err;
    }
    return stamp;
}

function uniqueBackupFile(dir, stamp) {
    const names = ['backup-' + stamp + '.json'];
    for (let n = 2; n <= 1000; n++) names.push('backup-' + stamp + '-' + n + '.json');
    const root = path.resolve(dir);
    for (let i = 0; i < names.length; i++) {
        if (names[i].indexOf('/') !== -1 || names[i].indexOf('\\') !== -1) {
            const err = new Error('backup file would leave the backup directory');
            err.code = 'backup-stamp';
            throw err;
        }
        const file = path.resolve(root, names[i]);
        if (path.dirname(file) !== root || !isPathInside(root, file) || file === root) {
            const err = new Error('backup file would leave the backup directory');
            err.code = 'backup-stamp';
            throw err;
        }
        if (!existsLstat(file)) return file;
    }
    const err = new Error('refusing to overwrite an existing backup file');
    err.code = 'backup-exists';
    throw err;
}

function assertBackupDir(input) {
    if (input == null || String(input).trim() === '') {
        const err = new Error('--apply requires --backup-dir');
        err.code = 'backup-dir-required';
        throw err;
    }
    const raw = String(input).trim();
    if (!path.isAbsolute(raw)) {
        const err = new Error('backup-dir must be an absolute path');
        err.code = 'backup-dir-relative';
        throw err;
    }
    const rawResolved = path.resolve(raw);
    const self = existsLstat(rawResolved);
    if (self && self.isSymbolicLink()) {
        throwBackupDir('backup-dir must not be a symlink', 'backup-dir-symlink');
    }
    const resolved = resolveExisting(raw);
    if (isPathInside(repoRoot(), resolved)) {
        const err = new Error('backup-dir must not be inside the repository');
        err.code = 'backup-dir-repo';
        throw err;
    }
    const tmpRoots = sharedTmpRoots();
    for (let i = 0; i < tmpRoots.length; i++) {
        if (isPathInside(tmpRoots[i], resolved)) {
            const err = new Error('backup-dir must not be a shared location');
            err.code = 'backup-dir-shared';
            throw err;
        }
    }
    const workspace = tryRealpath('/workspace') || path.resolve('/workspace');
    const workspacePrivate = tryRealpath('/workspace/private') || path.resolve('/workspace/private');
    if (isPathInside(workspace, resolved) && !isPathInside(workspacePrivate, resolved)) {
        const err = new Error('backup-dir under /workspace must be inside /workspace/private');
        err.code = 'backup-dir-workspace';
        throw err;
    }
    const homes = homeDirs();
    for (let i = 0; i < homes.length; i++) {
        if (resolved === homes[i]) {
            const err = new Error('backup-dir must not be a home-dir shared folder');
            err.code = 'backup-dir-home';
            throw err;
        }
    }
    const sharedHomes = homeSharedFolderRoots();
    for (let i = 0; i < sharedHomes.length; i++) {
        if (isPathInside(sharedHomes[i], resolved)) {
            const err = new Error('backup-dir must not be a home-dir shared folder');
            err.code = 'backup-dir-home';
            throw err;
        }
    }
    if (isWorldWritableLocation(raw) || isWorldWritableLocation(resolved)) {
        const err = new Error('backup-dir must not be world-writable');
        err.code = 'backup-dir-writable';
        throw err;
    }
    if (resolved === workspacePrivate) {
        const err = new Error('backup-dir must be a new dedicated directory, not /workspace/private itself');
        err.code = 'backup-dir-dedicated';
        throw err;
    }
    const reserved = reservedPrivateRoots(workspacePrivate);
    for (let i = 0; i < reserved.length; i++) {
        if (isPathInside(reserved[i], resolved)) {
            const err = new Error('backup-dir must not be a reserved shared directory');
            err.code = 'backup-dir-dedicated';
            throw err;
        }
    }
    const state = inspectBackupDir(resolved);
    if (state === 'not-dir') {
        throwBackupDir('backup-dir must be a directory', 'backup-dir-not-dir');
    }
    if (state === 'symlink') {
        throwBackupDir('backup-dir must not be a symlink', 'backup-dir-symlink');
    }
    if (state === 'not-empty') {
        throwBackupDir('backup-dir must be a new empty dedicated directory', 'backup-dir-not-empty');
    }
    if (state === 'empty' || state === 'unmarked') {
        throwBackupDir('backup-dir already exists; pass a new path, or reuse a directory this tool created', 'backup-dir-exists');
    }
    if (state === 'marked') {
        assertReusableBackupDir(resolved);
    }
    const parent = path.dirname(resolved);
    if (state === 'missing' && !fs.existsSync(parent)) {
        throwBackupDir('backup-dir parent must already exist', 'backup-dir-parent');
    }
    return resolved;
}

function assertApplyAllowed(options) {
    const opts = options || {};
    if (opts.apply !== true) return;
    if (opts.idsOnly === true) {
        const err = new Error('refusing --apply with --ids-only');
        err.code = 'apply-ids-only';
        throw err;
    }
    if (opts.projectId !== APPLY_PROJECT_ID) {
        const err = new Error('refusing --apply: projectId must be ' + APPLY_PROJECT_ID);
        err.code = 'apply-project';
        throw err;
    }
    const env = opts.env || process.env;
    if (env.FIREBASE_STORAGE_BUCKET && env.FIREBASE_STORAGE_BUCKET !== APPLY_BUCKET) {
        const err = new Error('refusing --apply: bucket must be ' + APPLY_BUCKET);
        err.code = 'apply-bucket';
        throw err;
    }
    const bucketName = opts.bucketName != null ? opts.bucketName : resolveBucket(env);
    if (bucketName !== APPLY_BUCKET) {
        const err = new Error('refusing --apply: bucket must be ' + APPLY_BUCKET);
        err.code = 'apply-bucket';
        throw err;
    }
    return assertBackupDir(opts.backupDir);
}

function prepareRun(argv, env, log) {
    const args = parseArgs(argv);
    if (args.help) return { help: true };
    const projectId = resolveProjectId(env);
    const bucketName = resolveBucket(env);
    printTarget(projectId, bucketName, log);
    const backupDir = assertApplyAllowed({
        apply: args.apply,
        idsOnly: args.idsOnly,
        projectId: projectId,
        bucketName: bucketName,
        env: env,
        backupDir: args.backupDir,
    });
    if (args.apply && backupDir) say(log, 'backup-dir=' + path.resolve(backupDir));
    return {
        help: false,
        apply: args.apply,
        idsOnly: args.idsOnly,
        projectId: projectId,
        bucketName: bucketName,
        backupDir: backupDir || null,
    };
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
    const resolved = assertBackupDir(dir);
    ensureBackupDir(resolved);
    const stamp = sanitizeBackupStamp(nowIso);
    const file = uniqueBackupFile(resolved, stamp);
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
    try {
        fs.writeFileSync(file, body, { flag: 'wx', mode: 0o600 });
    } catch (err) {
        if (err && err.code === 'EEXIST') {
            const exists = new Error('refusing to overwrite an existing backup file');
            exists.code = 'backup-exists';
            throw exists;
        }
        throw err;
    }
    fs.chmodSync(file, 0o600);
    return file;
}

async function runIdsOnlyScan(options) {
    const opts = options || {};
    const log = opts.log || console.log;
    const collections = (opts.collections || IDS_ONLY_COLLECTIONS).slice();
    const matches = [];
    for (let i = 0; i < collections.length; i++) {
        const name = collections[i];
        const rows = await opts.listDocs(name);
        for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            const leaks = guard.listTelegramBotMaterial(row.data);
            if (!leaks.length) continue;
            const fields = leaks.map(function (leak) {
                return guard.fieldLabel(leak.path);
            });
            matches.push({ collection: name, id: row.id, fields: fields });
            say(log, 'doc=' + name + '/' + row.id + ' fields=' + fields.join(','));
        }
    }
    say(log, 'ids-only matches=' + matches.length);
    return { matches: matches, affected: matches.length, wrote: false };
}

async function runScrub(options) {
    const opts = options || {};
    const log = opts.log || console.log;
    const apply = opts.apply === true;
    const db = opts.db;
    const marker = opts.marker || guard.SCRUB_MARKER;
    const collections = (opts.collections || guard.SCRUB_COLLECTIONS).slice();
    let backupDir = null;
    if (apply) {
        backupDir = assertApplyAllowed({
            apply: true,
            projectId: opts.projectId || APPLY_PROJECT_ID,
            bucketName: opts.bucketName != null ? opts.bucketName : resolveBucket(opts.env),
            env: opts.env,
            backupDir: opts.backupDir,
        });
        say(log, 'backup-dir=' + path.resolve(backupDir));
    }
    const markerRef = db.collection(marker.collection).doc(marker.id);
    const markerSnap = await markerRef.get();
    const markerData = markerSnap && markerSnap.exists && markerSnap.data ? (markerSnap.data() || {}) : null;
    if (markerData && markerData.applied === true) {
        say(log, 'already-applied collection=' + marker.collection + ' id=' + marker.id);
        if (apply && backupDir) say(log, 'backup-dir=' + path.resolve(backupDir));
        return { alreadyApplied: true, affected: 0, rehosted: 0, removed: 0, wrote: false };
    }

    const affected = [];
    let alreadyScrubbed = 0;
    for (let i = 0; i < collections.length; i++) {
        const name = collections[i];
        const rows = await opts.listDocs(name);
        for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            if (row.data && row.data.mediaRemoved === true) alreadyScrubbed += 1;
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

    const resolvedDir = path.resolve(backupDir);
    const existedBefore = !!existsLstat(resolvedDir);
    if (!existedBefore) {
        say(log, 'new backup-dir ' + resolvedDir + '. after a partial failure, re-run with this same --backup-dir.');
        if (alreadyScrubbed > 0) {
            say(log, 'WARNING: some documents already have mediaRemoved set. If this is a retry after a partial failure, re-run with the SAME --backup-dir from the first run. A new directory only backs up remaining documents.');
        }
    }

    try {
        const backupFile = writeBackup(backupDir, affected, opts.nowIso || new Date().toISOString());
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
        say(log, 'backup-dir=' + resolvedDir);
        return {
            alreadyApplied: false,
            affected: affected.length,
            rehosted: rehosted,
            removed: removed,
            wrote: true,
            backupFile: backupFile,
        };
    } catch (err) {
        say(log, 'backup-dir=' + resolvedDir);
        say(log, 'partial failure. re-run with the SAME --backup-dir ' + resolvedDir);
        throw err;
    }
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

function requireAdmin(subpath) {
    try { return require(subpath); }
    catch (err) {
        return require(path.join(__dirname, '..', 'functions', 'node_modules', subpath));
    }
}

// firebase-admin v14 dropped the namespaced compat surface from
// require('firebase-admin'). Use the modular entry points.
function loadModular() {
    const app = requireAdmin('firebase-admin/app');
    const firestore = requireAdmin('firebase-admin/firestore');
    const storage = requireAdmin('firebase-admin/storage');
    return {
        initializeApp: app.initializeApp,
        getApps: app.getApps,
        applicationDefault: app.applicationDefault,
        getFirestore: firestore.getFirestore,
        FieldPath: firestore.FieldPath,
        getStorage: storage.getStorage,
    };
}

function initClients(mods, opts) {
    const api = mods || loadModular();
    const projectId = (opts && opts.projectId) || resolveProjectId();
    const bucketName = (opts && opts.bucketName) || resolveBucket();
    if (!api.getApps().length) {
        const init = { projectId: projectId, storageBucket: bucketName };
        if (typeof api.applicationDefault === 'function') {
            init.credential = api.applicationDefault();
        }
        api.initializeApp(init);
    }
    return {
        db: api.getFirestore(),
        fieldPath: api.FieldPath.documentId(),
        bucket: function () { return api.getStorage().bucket(bucketName); },
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }
    const prepared = prepareRun(process.argv.slice(2), process.env, console.log);
    const clients = initClients(null, {
        projectId: prepared.projectId,
        bucketName: prepared.bucketName,
    });
    const db = clients.db;
    const documentIdField = clients.fieldPath;
    const fetchImpl = typeof fetch === 'function' ? fetch : require('node-fetch');
    if (prepared.idsOnly) {
        const scan = await runIdsOnlyScan({
            listDocs: function (name) { return listCollection(db, name, documentIdField); },
        });
        if (!scan.affected) say(console.log, 'no matches');
        return;
    }
    const summary = await runScrub({
        apply: prepared.apply,
        projectId: prepared.projectId,
        bucketName: prepared.bucketName,
        backupDir: prepared.backupDir,
        db: db,
        nowIso: new Date().toISOString(),
        listDocs: function (name) { return listCollection(db, name, documentIdField); },
        updateDoc: function (name, id, patch) {
            return db.collection(name).doc(id).update(patch);
        },
        rehost: prepared.apply
            ? makeStorageRehost(clients.bucket(), fetchImpl)
            : async function () { return null; },
    });
    if (!summary.wrote && !summary.alreadyApplied) {
        say(console.log, 'no writes');
    }
}

module.exports = {
    SCRUB_COLLECTIONS: guard.SCRUB_COLLECTIONS,
    SCRUB_MARKER: guard.SCRUB_MARKER,
    APPLY_PROJECT_ID: APPLY_PROJECT_ID,
    APPLY_BUCKET: APPLY_BUCKET,
    IDS_ONLY_COLLECTIONS: IDS_ONLY_COLLECTIONS,
    toPlain: toPlain,
    changedPatch: changedPatch,
    scrubDocument: scrubDocument,
    runScrub: runScrub,
    runIdsOnlyScan: runIdsOnlyScan,
    writeBackup: writeBackup,
    extensionForUpload: extensionForUpload,
    loadModular: loadModular,
    initClients: initClients,
    parseArgs: parseArgs,
    resolveProjectId: resolveProjectId,
    resolveBucket: resolveBucket,
    printTarget: printTarget,
    assertBackupDir: assertBackupDir,
    assertApplyAllowed: assertApplyAllowed,
    prepareRun: prepareRun,
    BACKUP_DIR_MARKER: BACKUP_DIR_MARKER,
};

if (require.main === module) {
    main().catch(function (err) {
        const message = guard.redactSecrets(err && err.message ? err.message : err);
        if (!guard.containsTelegramBotMaterial(message)) console.error('scrub failed: ' + message);
        else console.error('scrub failed');
        process.exit(1);
    });
}
