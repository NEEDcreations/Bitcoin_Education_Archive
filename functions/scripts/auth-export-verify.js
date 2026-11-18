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
// When GCS object metadata is available, pass --object-meta <json> so the
// script can check creation time and creator against fn-daily-auth-export.
// Any other --project is refused. A production restore is a disaster-only
// step that needs Phil and an edit to this guard.
//
// Credentials for --apply: Application Default Credentials for an account
// with Firebase Auth Admin on bitcoin-quest-staging (never the prod deploy key).

const crypto = require('crypto');
const fs = require('fs');
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

// When GCS object metadata is available, confirm the object was created by
// the backup service account and that its creation time matches the manifest.
function checkBackupProvenance(meta, opts) {
    const problems = [];
    if (!meta || typeof meta !== 'object') return problems;
    opts = opts || {};
    const created = meta.timeCreated || meta.created || meta.creationTime || null;
    const creator = meta.creator || meta.serviceAccountEmail || (meta.metadata && (meta.metadata.creator || meta.metadata.createdBy)) || null;
    const expected = opts.expectedSa || expectedBackupSa(opts.projectId);
    if (expected && creator && String(creator) !== expected) {
        problems.push('object creator is not the expected service account');
    }
    if (created) {
        const t = Date.parse(created);
        if (Number.isNaN(t)) {
            problems.push('object creation time is not a valid timestamp');
        } else {
            if (t > Date.now() + 5 * 60 * 1000) problems.push('object creation time is in the future');
            const ref = Date.parse(opts.finishedAt || opts.startedAt || 0);
            if (ref && Math.abs(t - ref) > 6 * 60 * 60 * 1000) {
                problems.push('object creation time does not match the manifest timestamp');
            }
        }
    }
    return problems;
}

function walkManifestFiles(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walkManifestFiles(p, out);
        else if (ent.isFile() && /\.manifest\.json$/.test(ent.name)) out.push(p);
    });
    return out;
}

function loadManifestsFromDir(dir) {
    return walkManifestFiles(dir, []).map(function (p) {
        const manifest = JSON.parse(fs.readFileSync(p, 'utf8'));
        return { path: p, manifest: manifest };
    }).filter(function (row) {
        return row.manifest && row.manifest.format === HEADER_TYPE;
    });
}

// Pick the complete manifest with the latest finishedAt (then startedAt, then object name).
function findLatestComplete(entries) {
    const complete = (entries || []).filter(function (row) {
        const man = row && (row.manifest || row);
        return man && man.complete === true && man.object;
    });
    if (!complete.length) return null;
    complete.sort(function (a, b) {
        const ma = a.manifest || a;
        const mb = b.manifest || b;
        const ta = Date.parse(ma.finishedAt || ma.startedAt || 0) || 0;
        const tb = Date.parse(mb.finishedAt || mb.startedAt || 0) || 0;
        if (tb !== ta) return tb - ta;
        return String(mb.object).localeCompare(String(ma.object));
    });
    const top = complete[0];
    return top.manifest ? top : { manifest: top, object: top.object };
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

async function applyImport(project, records, options, deleteAfter, log) {
    const appMod = loadModule('app');
    const app = appMod.initializeApp({ projectId: project, credential: appMod.applicationDefault() }, 'restore-verify');
    const auth = loadModule('auth').getAuth(app);
    let ok = 0, failed = 0;
    for (let i = 0; i < records.length; i += 1000) {
        const res = await auth.importUsers(records.slice(i, i + 1000), options || undefined);
        ok += res.successCount || 0;
        failed += res.failureCount || 0;
        (res.errors || []).forEach(function (e) { log('import error at index ' + (i + e.index) + ': ' + (e.error && e.error.code || 'failed')); });
    }
    let found = 0;
    const uids = records.map(function (r) { return r.uid; });
    for (let i = 0; i < uids.length; i += 100) {
        const got = await auth.getUsers(uids.slice(i, i + 100).map(function (u) { return { uid: u }; }));
        found += got.users.length;
    }
    let deleted = 0;
    if (deleteAfter) {
        for (let i = 0; i < uids.length; i += 1000) {
            const res = await auth.deleteUsers(uids.slice(i, i + 1000));
            deleted += res.successCount || 0;
        }
    }
    await appMod.deleteApp(app);
    return { imported: ok, failed: failed, foundAfterImport: found, deleted: deleted };
}

async function main() {
    const log = function (m) { console.log(m); };
    if (arg('--file')) console.error(FILE_WARNING);

    let manifest = null;
    const latestFrom = arg('--latest-from');
    if (latestFrom) {
        const found = findLatestComplete(loadManifestsFromDir(latestFrom));
        if (!found) {
            console.error('No complete manifest found in ' + latestFrom);
            process.exit(1);
        }
        manifest = found.manifest;
        log('Latest complete backup: ' + manifest.object + ' finishedAt ' + (manifest.finishedAt || 'unknown') + ' date ' + (manifest.date || 'unknown'));
    }
    if (arg('--manifest')) {
        if (manifest) { console.error('Use only one of --manifest and --latest-from'); process.exit(2); }
        manifest = JSON.parse(fs.readFileSync(arg('--manifest'), 'utf8'));
    }

    const hasFile = !!arg('--file');
    const findOnly = !!latestFrom && (has('--print-latest') || (!hasFile && process.stdin.isTTY && !has('--import') && !arg('--expect') && !arg('--object-meta')));
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
    if (arg('--object-meta')) {
        const meta = JSON.parse(fs.readFileSync(arg('--object-meta'), 'utf8'));
        const expectedSa = arg('--expected-sa') || expectedBackupSa((manifest && manifest.projectId) || (parsed.header && parsed.header.projectId));
        const prov = checkBackupProvenance(meta, {
            expectedSa: expectedSa,
            projectId: manifest && manifest.projectId,
            startedAt: manifest && manifest.startedAt,
            finishedAt: manifest && manifest.finishedAt,
        });
        prov.forEach(function (p) { problems.push(p); });
    }
    problems.forEach(function (p) { log('PROBLEM: ' + p); });
    log(problems.length ? 'VERIFY: FAIL' : 'VERIFY: PASS');
    if (!has('--import')) process.exit(problems.length ? 1 : 0);

    const project = arg('--project');
    if (project !== STAGING) { console.error('Refusing --import into "' + project + '". Staging only: --project ' + STAGING); process.exit(2); }
    if (problems.length) { console.error('Refusing to import a backup that failed verification.'); process.exit(1); }
    if (has('--all') && !has('--delete-after')) { console.error(ALL_REQUIRES_DELETE); process.exit(2); }
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
    FILE_WARNING: FILE_WARNING,
    ALL_REQUIRES_DELETE: ALL_REQUIRES_DELETE,
    STAGING: STAGING,
};

if (require.main === module) {
    main().catch(function (err) {
        console.error(String(err && err.message || 'failed').replace(/[^\s@]+@[^\s@]+/g, '<email>').replace(/\+\d{7,15}/g, '<phone>').slice(0, 300));
        process.exit(1);
    });
}
