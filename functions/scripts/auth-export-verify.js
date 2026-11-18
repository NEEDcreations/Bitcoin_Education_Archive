#!/usr/bin/env node
'use strict';

// Verify (and optionally restore-test) a dailyAuthExport backup.
//
// Restore tests run from Phil's machine only, never the shared box.
// This script never sees a private key. Decrypt first with the official age
// CLI on Phil's own machine, and pipe the plaintext straight in:
//
//   age -d -i ~/bq-auth-backup.key 083000Z-ab12cd34ef56ab78.jsonl.age \
//     | node functions/scripts/auth-export-verify.js --manifest 083000Z-ab12cd34ef56ab78.manifest.json --expect 26615
//
// Object names are per-run (auth/<ET date>/<HHmmss>Z-<runId>.jsonl.age). To
// pick the latest complete backup from a folder of downloaded manifests:
//
//   node functions/scripts/auth-export-verify.js --latest-from ./auth/2026-11-18 --print-latest
//   age -d -i ~/bq-auth-backup.key <that-object> \
//     | node functions/scripts/auth-export-verify.js --latest-from ./auth/2026-11-18 --expect 26615
//
// Prefer a pipe. --file reads a plaintext export from disk (emails, phones,
// password hashes) and prints a strong warning; delete that file when done.
//
// Prints counts only: never emails, uids, hashes, salts, or the signer key.
//
// Restore test into STAGING (bitcoin-quest-staging) only:
//   ... | node functions/scripts/auth-export-verify.js --manifest m.json --import --project bitcoin-quest-staging
//        (dry run: builds every import record, writes nothing)
//   ... --import --project bitcoin-quest-staging --sample 100 --apply --delete-after
//        (imports 100 pseudonymized users: uid "rv-<n>", email
//         "rv-<n>@restore-test.invalid", real hash + salt kept so the SCRYPT
//         params are exercised; counts them back; deletes them)
//   ... --import --project bitcoin-quest-staging --all --apply --delete-after
//        (ALL real users into staging. Needs Phil's explicit OK first: it
//         copies real emails and hashes into staging. --all requires
//         --delete-after so those identities are not left in staging.)
// customClaims are omitted unless you pass --keep-claims (prints a warning).
// --import (dry run or --apply) requires provenance and fails closed:
//   --object-meta <json>  GCS object JSON with server-set timeCreated
//                         (not custom metadata). timeCreated must fall in
//                         the backup window (default 3:29–3:50 AM ET).
//   --audit-log <json>    Cloud Audit Logs export (Data Access,
//                         storage.objects.create) whose principalEmail is
//                         fn-daily-auth-export. Data-access logging must be
//                         on for the bucket. See AUTH-EXPORT-RESTORE.md.
// KMS-signed manifests are an optional later step, not required here.
// Any other --project is refused. A production restore is a disaster-only
// step that needs Phil and an edit to this guard.
//
// Credentials for --apply: Application Default Credentials for an account
// with Firebase Auth Admin on bitcoin-quest-staging (never the prod deploy key).

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const STAGING = 'bitcoin-quest-staging';
const HEADER_TYPE = 'bq-auth-export-v2';
const FILE_WARNING = 'WARNING: --file reads a plaintext Auth export from disk (emails, phone numbers, password hashes, and the hash config). Prefer piping: age -d -i <key> <file.jsonl.age> | node functions/scripts/auth-export-verify.js ...  Delete the plaintext file when you are done. Restore tests run from Phil\'s machine only, never the shared box.';
const ALL_REQUIRES_DELETE = '--all requires --delete-after so real emails and hashes are not left in staging. Restore tests run from Phil\'s machine only, never the shared box.';
const KEEP_CLAIMS_WARNING = 'WARNING: --keep-claims will import customClaims from the backup, including any admin claims. A planted backup could grant admin rights. Only use this after you have checked the object creator and you intend to restore claims.';

function arg(flag) {
    const i = process.argv.indexOf(flag);
    return i === -1 || i + 1 >= process.argv.length ? '' : process.argv[i + 1];
}
function has(flag) { return process.argv.indexOf(flag) !== -1; }

function readStdin() {
    return new Promise(function (resolve, reject) {
        const chunks = [];
        process.stdin.on('data', function (c) { chunks.push(c); });
        process.stdin.on('end', function () { resolve(Buffer.concat(chunks)); });
        process.stdin.on('error', reject);
    });
}

function parse(buf) {
    const lines = buf.toString('utf8').split('\n').filter(function (l) { return l.length; });
    if (!lines.length) throw new Error('empty input (did age -d fail?)');
    const header = JSON.parse(lines[0]);
    if (!header || header._bq !== HEADER_TYPE) throw new Error('not a ' + HEADER_TYPE + ' export');
    const users = [];
    for (let i = 1; i < lines.length; i++) users.push(JSON.parse(lines[i]));
    return { header: header, users: users, lines: lines.length };
}

function summarize(parsed) {
    const s = { users: parsed.users.length, lines: parsed.lines, passwordUsers: 0, withHash: 0, mfaUsers: 0, disabled: 0, uniqueUids: 0, missingUid: 0 };
    const seen = new Set();
    parsed.users.forEach(function (u) {
        if (!u.uid) s.missingUid++; else seen.add(u.uid);
        if ((u.providerData || []).some(function (p) { return p && p.providerId === 'password'; })) s.passwordUsers++;
        if (u.passwordHash) s.withHash++;
        if (u.multiFactor) s.mfaUsers++;
        if (u.disabled) s.disabled++;
    });
    s.uniqueUids = seen.size;
    const hc = parsed.header.hashConfig;
    s.hashConfig = !!(hc && hc.algorithm && hc.signerKey);
    s.algorithm = hc && hc.algorithm ? String(hc.algorithm) : 'none';
    return s;
}

function check(summary, manifest, plaintextSha256, expect) {
    const problems = [];
    if (manifest) {
        if (manifest.plaintextSha256 && manifest.plaintextSha256 !== plaintextSha256) problems.push('plaintext sha256 does not match manifest');
        if (manifest.userCount !== summary.users) problems.push('user count ' + summary.users + ' != manifest ' + manifest.userCount);
        if (manifest.withPasswordHash !== undefined && manifest.withPasswordHash !== summary.withHash) problems.push('hash count != manifest');
    }
    if (summary.lines !== summary.users + 1) problems.push('line count is not users + 1 header');
    if (summary.uniqueUids !== summary.users) problems.push('duplicate or missing uids: ' + (summary.users - summary.uniqueUids));
    if (!summary.hashConfig) problems.push('hash config missing from export');
    if (summary.passwordUsers > summary.withHash) problems.push('password users without hash: ' + (summary.passwordUsers - summary.withHash));
    if (expect) {
        const drift = Math.abs(summary.users - expect) / expect;
        if (drift > 0.01) problems.push('user count ' + summary.users + ' is more than 1% from expected ' + expect);
    }
    return problems;
}

function expectedBackupSa(projectId) {
    if (!projectId) return '';
    return 'fn-daily-auth-export@' + projectId + '.iam.gserviceaccount.com';
}

// Default nightly window for dailyAuthExport (schedule 30 3 * * *, America/New_York).
// Inclusive of both ends. Override with --window-start/--window-end/--window-zone.
const DEFAULT_SCHEDULE_WINDOW = Object.freeze({
    timeZone: 'America/New_York',
    start: '03:29',
    end: '03:50',
});

function parseHm(s) {
    const m = String(s || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]), min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
}

function minutesInZone(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone || DEFAULT_SCHEDULE_WINDOW.timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const get = function (t) { return Number((parts.find(function (p) { return p.type === t; }) || {}).value); };
    return get('hour') * 60 + get('minute');
}

function etDateFromInstant(date, timeZone) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone || DEFAULT_SCHEDULE_WINDOW.timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date);
}

function inScheduleWindow(iso, window) {
    window = window || DEFAULT_SCHEDULE_WINDOW;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return false;
    const start = parseHm(window.start), end = parseHm(window.end);
    if (start == null || end == null) return false;
    const mins = minutesInZone(new Date(t), window.timeZone);
    return mins >= start && mins <= end;
}

function readJsonFile(file) {
    const text = fs.readFileSync(file, 'utf8').trim();
    if (!text) return null;
    if (text[0] === '[') return JSON.parse(text);
    // JSONL: try first line; if the whole file is one object, parse it.
    if (text[0] === '{') {
        try { return JSON.parse(text); } catch (e) { /* JSONL */ }
        return text.split('\n').filter(function (l) { return l.trim(); }).map(function (l) { return JSON.parse(l); });
    }
    throw new Error('could not parse ' + file);
}

// Cloud Audit Logs export from `gcloud logging read --format=json` or a
// Logging API {entries: [...]} document. Creator comes only from
// protoPayload.authenticationInfo.principalEmail on storage.objects.create.
function parseAuditLog(input) {
    if (!input) return [];
    let rows = input;
    if (typeof input === 'string') rows = JSON.parse(input);
    if (rows && Array.isArray(rows.entries)) rows = rows.entries;
    if (!Array.isArray(rows)) rows = [rows];
    return rows.filter(Boolean);
}

function objectNameFromResource(resourceName) {
    const raw = String(resourceName || '');
    const marker = '/objects/';
    const i = raw.indexOf(marker);
    const obj = i === -1 ? raw : raw.slice(i + marker.length);
    try { return decodeURIComponent(obj); } catch (e) { return obj; }
}

function isObjectCreate(entry) {
    const method = entry && entry.protoPayload && entry.protoPayload.methodName
        || entry.methodName || '';
    return /(^|\.)storage\.objects\.create$/.test(method) || method === 'storage.objects.create';
}

function creatorFromAuditLog(input, objectName) {
    const entries = parseAuditLog(input);
    const hits = entries.filter(function (e) {
        if (!isObjectCreate(e)) return false;
        const payload = e.protoPayload || {};
        const name = objectNameFromResource(payload.resourceName || (e.resource && e.resource.name));
        if (objectName && name !== objectName && !name.endsWith('/' + objectName) && name.indexOf(objectName) === -1) return false;
        return !!(payload.authenticationInfo && payload.authenticationInfo.principalEmail);
    });
    if (!hits.length) return '';
    return hits[0].protoPayload.authenticationInfo.principalEmail;
}

function timeCreatedFromMeta(meta) {
    // Server-set GCS field only. Never custom metadata (metadata.creator/createdBy).
    if (!meta || typeof meta !== 'object') return '';
    return meta.timeCreated ? String(meta.timeCreated) : '';
}

// Provenance for a backup object. When required (any --import), missing or
// empty metadata, missing timeCreated, missing audit log, or missing
// principalEmail fail closed. Creator is taken from the audit log only.
function checkBackupProvenance(opts) {
    opts = opts || {};
    const required = opts.required === true;
    const problems = [];
    const meta = opts.meta;
    const hasMeta = !!(meta && typeof meta === 'object' && Object.keys(meta).length);
    const audit = opts.audit;
    const hasAudit = !(audit == null || (Array.isArray(audit) && !audit.length) || (typeof audit === 'object' && !Array.isArray(audit) && !Object.keys(audit).length && !audit.entries));
    if (required) {
        if (!hasMeta) problems.push('object metadata is missing or empty (pass --object-meta with GCS timeCreated)');
        if (!hasAudit) problems.push('audit log is missing or empty (pass --audit-log from Cloud Audit Logs data-access storage.objects.create)');
    } else if (!hasMeta && !hasAudit) {
        return problems;
    }
    const created = timeCreatedFromMeta(meta);
    if (hasMeta || required) {
        if (!created) problems.push('object metadata is missing timeCreated');
        else {
            const t = Date.parse(created);
            if (Number.isNaN(t)) problems.push('object timeCreated is not a valid timestamp');
            else if (t > Date.now() + 5 * 60 * 1000) problems.push('object timeCreated is in the future');
            else if (!inScheduleWindow(created, opts.window)) {
                problems.push('object timeCreated is outside the backup schedule window (' + (opts.window && opts.window.start || DEFAULT_SCHEDULE_WINDOW.start) + '–' + (opts.window && opts.window.end || DEFAULT_SCHEDULE_WINDOW.end) + ' ' + ((opts.window && opts.window.timeZone) || DEFAULT_SCHEDULE_WINDOW.timeZone) + ')');
            }
        }
    }
    if (hasAudit || required) {
        const creator = creatorFromAuditLog(audit, opts.objectName);
        const expected = opts.expectedSa || expectedBackupSa(opts.projectId);
        if (!creator) problems.push('audit log has no storage.objects.create principalEmail for this object');
        else if (expected && creator !== expected) problems.push('object creator is not the expected service account');
    }
    return problems;
}

function walkManifestFiles(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
        const pth = path.join(dir, ent.name);
        if (ent.isDirectory()) walkManifestFiles(pth, out);
        else if (ent.isFile() && /\.manifest\.json$/.test(ent.name)) out.push(pth);
    });
    return out;
}

function loadMetaSidecar(manifestPath) {
    const dir = path.dirname(manifestPath);
    const base = path.basename(manifestPath, '.manifest.json');
    const cands = [base + '.meta.json', base + '.jsonl.age.meta.json'];
    for (let i = 0; i < cands.length; i++) {
        const pth = path.join(dir, cands[i]);
        if (fs.existsSync(pth)) {
            const meta = JSON.parse(fs.readFileSync(pth, 'utf8'));
            return meta && typeof meta === 'object' ? meta : null;
        }
    }
    return null;
}

function loadManifestsFromDir(dir) {
    return walkManifestFiles(dir, []).map(function (pth) {
        const manifest = JSON.parse(fs.readFileSync(pth, 'utf8'));
        return { path: pth, manifest: manifest, meta: loadMetaSidecar(pth) };
    }).filter(function (row) {
        return row.manifest && row.manifest.format === HEADER_TYPE;
    });
}

function entryTimeCreated(row) {
    if (row && row.timeCreated) return row.timeCreated;
    if (row && row.meta) return timeCreatedFromMeta(row.meta);
    const man = row && (row.manifest || row);
    if (man && man.timeCreated) return String(man.timeCreated);
    return '';
}

// Rank complete backups by server timeCreated (not manifest finishedAt).
// Flags more than one complete run per ET day, any run outside the window,
// and any complete backup missing timeCreated.
function findLatestComplete(entries, opts) {
    opts = opts || {};
    const window = opts.window || DEFAULT_SCHEDULE_WINDOW;
    const flags = [];
    const complete = (entries || []).filter(function (row) {
        const man = row && (row.manifest || row);
        return man && man.complete === true && man.object;
    }).map(function (row) {
        const man = row.manifest || row;
        const wrapped = row.manifest ? row : { manifest: row, object: row.object };
        wrapped.timeCreated = entryTimeCreated(row);
        wrapped.object = man.object;
        return wrapped;
    });
    if (!complete.length) return null;

    const inWindow = [];
    complete.forEach(function (row) {
        if (!row.timeCreated) {
            flags.push('complete backup ' + row.object + ' is missing timeCreated');
            return;
        }
        if (!inScheduleWindow(row.timeCreated, window)) {
            flags.push('complete backup ' + row.object + ' is outside the backup schedule window');
            return;
        }
        inWindow.push(row);
    });

    const byDay = {};
    inWindow.forEach(function (row) {
        const day = etDateFromInstant(new Date(row.timeCreated), window.timeZone);
        byDay[day] = (byDay[day] || 0) + 1;
    });
    Object.keys(byDay).sort().forEach(function (day) {
        if (byDay[day] > 1) flags.push('more than one complete run on ' + day + ' (' + byDay[day] + ')');
    });

    inWindow.sort(function (a, b) {
        const ta = Date.parse(a.timeCreated) || 0;
        const tb = Date.parse(b.timeCreated) || 0;
        if (tb !== ta) return tb - ta;
        return String(b.object).localeCompare(String(a.object));
    });
    if (!inWindow.length) {
        return { manifest: null, object: null, timeCreated: '', flags: flags };
    }
    const top = inWindow[0];
    top.flags = flags;
    return top;
}

function cleanupCommand(project, uidsFile) {
    return 'node functions/scripts/auth-export-verify.js --cleanup --project ' + project + ' --uids-file ' + uidsFile;
}

function writeUidsFile(uids) {
    const pth = path.join(os.tmpdir(), 'bq-auth-restore-uids-' + Date.now() + '-' + Math.random().toString(16).slice(2) + '.txt');
    fs.writeFileSync(pth, uids.join('\n') + '\n', { mode: 0o600 });
    return pth;
}

function printCleanup(log, project, uids, reason) {
    const file = writeUidsFile(uids);
    const cmd = cleanupCommand(project, file);
    log('Import stopped' + (reason ? ' (' + String(reason).slice(0, 200) + ')' : '') + '. Users may still be in ' + project + '. Cleanup with:');
    log(cmd);
    return cmd;
}

function toImportRecord(user, opts) {
    const rec = { uid: opts.uid || user.uid, disabled: user.disabled === true };
    const email = opts.email !== undefined ? opts.email : user.email;
    if (email) { rec.email = email; rec.emailVerified = user.emailVerified === true; }
    if (!opts.pseudonymize) {
        if (user.displayName) rec.displayName = user.displayName;
        if (user.photoURL) rec.photoURL = user.photoURL;
        if (user.phoneNumber) rec.phoneNumber = user.phoneNumber;
        if (opts.keepClaims && user.customClaims && typeof user.customClaims === 'object') rec.customClaims = user.customClaims;
        const providers = (user.providerData || []).filter(function (p) { return p && p.providerId && p.providerId !== 'password'; });
        if (providers.length) {
            rec.providerData = providers.map(function (p) {
                const row = { providerId: p.providerId, uid: p.uid || user.uid };
                if (p.displayName) row.displayName = p.displayName;
                if (p.email) row.email = p.email;
                if (p.photoURL) row.photoURL = p.photoURL;
                if (p.phoneNumber) row.phoneNumber = p.phoneNumber;
                return row;
            });
        }
        const factors = user.multiFactor && user.multiFactor.enrolledFactors || [];
        const phones = factors.filter(function (f) { return f.factorId === 'phone' && f.phoneNumber; });
        if (phones.length) {
            rec.multiFactor = { enrolledFactors: phones.map(function (f) {
                const row = { uid: f.uid, factorId: 'phone', phoneNumber: f.phoneNumber };
                if (f.displayName) row.displayName = f.displayName;
                if (f.enrollmentTime) row.enrollmentTime = f.enrollmentTime;
                return row;
            }) };
        }
    }
    if (user.metadata && (user.metadata.creationTime || user.metadata.lastSignInTime)) {
        rec.metadata = {};
        if (user.metadata.creationTime) rec.metadata.creationTime = user.metadata.creationTime;
        if (user.metadata.lastSignInTime) rec.metadata.lastSignInTime = user.metadata.lastSignInTime;
    }
    if (user.passwordHash) {
        rec.passwordHash = Buffer.from(user.passwordHash, 'base64');
        if (user.passwordSalt) rec.passwordSalt = Buffer.from(user.passwordSalt, 'base64');
    }
    return rec;
}

function hashOptions(hc) {
    if (!hc || String(hc.algorithm).toUpperCase() !== 'SCRYPT' || !hc.signerKey) return null;
    return { hash: {
        algorithm: 'SCRYPT',
        key: Buffer.from(hc.signerKey, 'base64'),
        saltSeparator: Buffer.from(hc.saltSeparator || '', 'base64'),
        rounds: Number(hc.rounds),
        memoryCost: Number(hc.memoryCost),
    } };
}

function pickUsers(users, sample, all) {
    if (all) return users.slice();
    // About half password users, so the sample exercises the hash import.
    const pw = users.filter(function (u) { return u.passwordHash; });
    const rest = users.filter(function (u) { return !u.passwordHash; });
    const half = Math.ceil(sample / 2);
    const a = pw.slice(0, half);
    const b = rest.slice(0, sample - a.length);
    return a.concat(b, pw.slice(half, half + (sample - a.length - b.length)));
}

function buildRecords(parsed, mode) {
    const chosen = pickUsers(parsed.users, mode.sample, mode.all);
    return chosen.map(function (u, i) {
        if (!mode.all) return toImportRecord(u, { pseudonymize: true, uid: 'rv-' + i, email: 'rv-' + i + '@restore-test.invalid' });
        return toImportRecord(u, { keepClaims: !!mode.keepClaims });
    });
}

function loadModule(sub) {
    try { return require('firebase-admin/' + sub); }
    catch (e) { return require(path.join(__dirname, '..', 'node_modules', 'firebase-admin', 'lib', sub, 'index.js')); }
}

async function deleteUids(auth, uids) {
    let deleted = 0;
    for (let i = 0; i < uids.length; i += 1000) {
        const res = await auth.deleteUsers(uids.slice(i, i + 1000));
        deleted += res.successCount || 0;
    }
    return deleted;
}

async function applyImport(project, records, options, deleteAfter, log, deps) {
    deps = deps || {};
    const uids = records.map(function (r) { return r.uid; });
    let appMod = null, app = null, auth = deps.auth || null;
    if (!auth) {
        appMod = loadModule('app');
        app = appMod.initializeApp({ projectId: project, credential: appMod.applicationDefault() }, 'restore-verify');
        auth = loadModule('auth').getAuth(app);
    }
    let ok = 0, failed = 0, found = 0, deleted = 0;
    let caught = null, cleanupPrinted = false;
    try {
        for (let i = 0; i < records.length; i += 1000) {
            const res = await auth.importUsers(records.slice(i, i + 1000), options || undefined);
            ok += res.successCount || 0;
            failed += res.failureCount || 0;
            (res.errors || []).forEach(function (e) { log('import error at index ' + (i + e.index) + ': ' + (e.error && e.error.code || 'failed')); });
        }
        for (let i = 0; i < uids.length; i += 100) {
            const got = await auth.getUsers(uids.slice(i, i + 100).map(function (u) { return { uid: u }; }));
            found += got.users.length;
        }
    } catch (err) {
        caught = err;
    } finally {
        if (deleteAfter && uids.length) {
            try {
                deleted = await deleteUids(auth, uids);
            } catch (delErr) {
                printCleanup(log, project, uids, 'delete-after failed: ' + (delErr && delErr.message));
                cleanupPrinted = true;
                if (!caught) caught = delErr;
            }
        }
        if (app && appMod) {
            try { await appMod.deleteApp(app); } catch (e) { /* ignore */ }
        }
        if (deps.deleteApp) {
            try { await deps.deleteApp(); } catch (e) { /* ignore */ }
        }
    }
    if (caught) {
        if (!cleanupPrinted && !(deleteAfter && deleted)) {
            printCleanup(log, project, uids, caught && caught.message);
        } else if (deleteAfter && deleted && !cleanupPrinted) {
            log('Import failed after writing users; --delete-after cleaned up ' + deleted + ' uids.');
        }
        throw caught;
    }
    return { imported: ok, failed: failed, foundAfterImport: found, deleted: deleted };
}

async function resolveWindow() {
    const window = {
        timeZone: arg('--window-zone') || DEFAULT_SCHEDULE_WINDOW.timeZone,
        start: arg('--window-start') || DEFAULT_SCHEDULE_WINDOW.start,
        end: arg('--window-end') || DEFAULT_SCHEDULE_WINDOW.end,
    };
    if (parseHm(window.start) == null || parseHm(window.end) == null) {
        console.error('Invalid --window-start or --window-end (use HH:MM)');
        process.exit(2);
    }
    return window;
}

async function runCleanup(log) {
    const project = arg('--project');
    if (project !== STAGING) { console.error('Refusing --cleanup in "' + project + '". Staging only: --project ' + STAGING); process.exit(2); }
    const file = arg('--uids-file');
    if (!file) { console.error('--cleanup requires --uids-file'); process.exit(2); }
    const uids = fs.readFileSync(file, 'utf8').split(/\s+/).filter(Boolean);
    const appMod = loadModule('app');
    const app = appMod.initializeApp({ projectId: project, credential: appMod.applicationDefault() }, 'restore-cleanup');
    const auth = loadModule('auth').getAuth(app);
    try {
        const deleted = await deleteUids(auth, uids);
        log('Deleted ' + deleted + ' of ' + uids.length + ' uids from ' + project);
        if (deleted !== uids.length) process.exit(1);
    } finally {
        await appMod.deleteApp(app);
    }
}

async function main() {
    const log = function (m) { console.log(m); };
    if (has('--cleanup')) { await runCleanup(log); return; }
    if (arg('--file')) console.error(FILE_WARNING);

    const window = await resolveWindow();
    let manifest = null;
    let latestFlags = [];
    const latestFrom = arg('--latest-from');
    if (latestFrom) {
        const found = findLatestComplete(loadManifestsFromDir(latestFrom), { window: window });
        if (!found || !found.manifest) {
            (found && found.flags || []).forEach(function (f) { log('FLAG: ' + f); });
            console.error('No complete in-window backup with timeCreated found in ' + latestFrom);
            process.exit(1);
        }
        manifest = found.manifest;
        latestFlags = found.flags || [];
        latestFlags.forEach(function (f) { log('FLAG: ' + f); });
        log('Latest complete backup: ' + manifest.object + ' timeCreated ' + (found.timeCreated || 'unknown') + ' date ' + (manifest.date || 'unknown'));
    }
    if (arg('--manifest')) {
        if (manifest) { console.error('Use only one of --manifest and --latest-from'); process.exit(2); }
        manifest = JSON.parse(fs.readFileSync(arg('--manifest'), 'utf8'));
    }

    const hasFile = !!arg('--file');
    const findOnly = !!latestFrom && (has('--print-latest') || (!hasFile && process.stdin.isTTY && !has('--import') && !arg('--expect') && !arg('--object-meta') && !arg('--audit-log')));
    if (findOnly) return;

    const input = hasFile ? fs.readFileSync(arg('--file')) : await readStdin();
    const expect = Number(arg('--expect')) || 0;
    const sha = crypto.createHash('sha256').update(input).digest('hex');
    const parsed = parse(input);
    input.fill(0);
    const s = summarize(parsed);
    log('Users: ' + s.users + ' (lines ' + s.lines + ', unique uids ' + s.uniqueUids + ')');
    log('Password users: ' + s.passwordUsers + ', with hash: ' + s.withHash + ', MFA users: ' + s.mfaUsers + ', disabled: ' + s.disabled);
    log('Hash config in export: ' + (s.hashConfig ? 'yes' : 'no') + ' (' + s.algorithm + ')');
    log('Plaintext sha256 matches manifest: ' + (manifest ? String(manifest.plaintextSha256 === sha) : 'n/a (no --manifest)'));
    const problems = check(s, manifest, sha, expect);

    const wantProvenance = has('--import') || arg('--object-meta') || arg('--audit-log');
    if (wantProvenance) {
        let meta = null, audit = null;
        if (arg('--object-meta')) {
            const raw = fs.readFileSync(arg('--object-meta'), 'utf8').trim();
            meta = raw ? JSON.parse(raw) : null;
        }
        if (arg('--audit-log')) {
            const raw = fs.readFileSync(arg('--audit-log'), 'utf8').trim();
            audit = raw ? readJsonFile(arg('--audit-log')) : null;
        }
        const expectedSa = arg('--expected-sa') || expectedBackupSa((manifest && manifest.projectId) || (parsed.header && parsed.header.projectId));
        const prov = checkBackupProvenance({
            required: has('--import'),
            meta: meta,
            audit: audit,
            objectName: manifest && manifest.object,
            expectedSa: expectedSa,
            projectId: manifest && manifest.projectId,
            window: window,
        });
        prov.forEach(function (p) { problems.push(p); });
    }
    latestFlags.forEach(function (f) {
        if (has('--import')) problems.push(f);
    });
    problems.forEach(function (p) { log('PROBLEM: ' + p); });
    log(problems.length ? 'VERIFY: FAIL' : 'VERIFY: PASS');
    if (!has('--import')) process.exit(problems.length ? 1 : 0);

    const project = arg('--project');
    if (project !== STAGING) { console.error('Refusing --import into "' + project + '". Staging only: --project ' + STAGING); process.exit(2); }
    if (has('--all') && !has('--delete-after')) { console.error(ALL_REQUIRES_DELETE); process.exit(2); }
    if (problems.length) { console.error('Refusing to import a backup that failed verification or provenance.'); process.exit(1); }
    if (has('--keep-claims')) log(KEEP_CLAIMS_WARNING);
    const mode = { all: has('--all'), sample: Number(arg('--sample')) || 100, keepClaims: has('--keep-claims') };
    const records = buildRecords(parsed, mode);
    const options = hashOptions(parsed.header.hashConfig);
    const withClaims = records.filter(function (r) { return r.customClaims; }).length;
    log('Import plan: ' + records.length + ' users into ' + project + (mode.all ? ' (ALL, real identities)' : ' (pseudonymized sample)')
        + ', with hash: ' + records.filter(function (r) { return r.passwordHash; }).length
        + ', with claims: ' + withClaims
        + ', SCRYPT params: ' + (options ? 'yes' : 'no'));
    if (!has('--apply')) { log('DRY RUN: nothing written. Add --apply to import.'); return; }
    const r = await applyImport(project, records, options, has('--delete-after'), log);
    log('Imported: ' + r.imported + ', failed: ' + r.failed + ', found after import: ' + r.foundAfterImport + ', deleted after: ' + r.deleted);
    log(r.failed === 0 && r.foundAfterImport === records.length ? 'RESTORE TEST: PASS' : 'RESTORE TEST: FAIL');
    if (r.failed || r.foundAfterImport !== records.length) process.exit(1);
}

module.exports = {
    pickUsers: pickUsers,
    parse: parse,
    summarize: summarize,
    check: check,
    toImportRecord: toImportRecord,
    buildRecords: buildRecords,
    hashOptions: hashOptions,
    findLatestComplete: findLatestComplete,
    loadManifestsFromDir: loadManifestsFromDir,
    checkBackupProvenance: checkBackupProvenance,
    expectedBackupSa: expectedBackupSa,
    inScheduleWindow: inScheduleWindow,
    DEFAULT_SCHEDULE_WINDOW: DEFAULT_SCHEDULE_WINDOW,
    creatorFromAuditLog: creatorFromAuditLog,
    parseAuditLog: parseAuditLog,
    timeCreatedFromMeta: timeCreatedFromMeta,
    cleanupCommand: cleanupCommand,
    printCleanup: printCleanup,
    applyImport: applyImport,
    FILE_WARNING: FILE_WARNING,
    ALL_REQUIRES_DELETE: ALL_REQUIRES_DELETE,
    STAGING: STAGING,
};

if (require.main === module) {
    main().catch(function (err) {
        console.error(String(err && err.message || 'failed').replace(/[^\s@]+@[^\s@]+/g, '<email>').replace(/\+?\d[\d\s().-]{6,18}\d/g, '<phone>').slice(0, 300));
        process.exit(1);
    });
}
