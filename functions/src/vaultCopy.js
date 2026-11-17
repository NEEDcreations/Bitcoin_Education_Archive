'use strict';

// Nightly vault copy (User Data item 1, Nov 17 2026).
//
// dailyFirestoreBackup writes a managed export to
//   gs://<project>-backups/<YYYY-MM-DD>/   (2:00 AM UTC, done in ~5 min)
// and that bucket's lifecycle deletes it after 90 days. This job copies each
// finished export, server side, into the 10-year retention bucket
//   gs://<project>-offline-vault/nightly/<YYYY-MM-DD>/
// so a stolen key that wipes the backups bucket can't take the history too.
//
// Safety properties (tests/test-vault-copy.js pins each one):
// - Never deletes, never overwrites: every copy and the manifest use
//   ifGenerationMatch: 0, and nothing here calls delete().
// - Copies only a FINISHED export (its .overall_export_metadata exists).
// - Idempotent: a day with a vault manifest is skipped; a half-done day
//   resumes and skips objects already in the vault.
// - Verifies object count and total bytes before writing the manifest, and
//   throws (fails the run, logged as an error for the alert) on any mismatch.
// - Catches up the previous day too, so one failed night self-heals.
// - Runs as its own service account (fn-vault-copy) that can only READ the
//   backups bucket and CREATE + READ in the vault bucket (no delete). No Firestore, no Auth,
//   no secrets. IAM grants are Phil-only steps (docs/BACKUP-HARDENING.md).

const VAULT_PREFIX = 'nightly/';
const MANIFEST_NAME = '_VAULT_MANIFEST.json';
const COPY_CONCURRENCY = 8;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function bucketsFor(projectId) {
    if (!projectId || !/^[a-z0-9-]+$/.test(projectId)) throw new Error('bad project id');
    return {
        source: process.env.BQ_BACKUP_BUCKET || (projectId + '-backups'),
        vault: process.env.BQ_VAULT_BUCKET || (projectId + '-offline-vault'),
    };
}

// UTC days to check, newest first: the export written today and yesterday's.
function daysToCopy(now) {
    const d = now instanceof Date ? now : new Date(now);
    const today = d.toISOString().slice(0, 10);
    const y = new Date(d.getTime() - 86400000).toISOString().slice(0, 10);
    return [today, y];
}

function destName(day, srcName) {
    if (!DAY_RE.test(day)) throw new Error('bad day ' + day);
    if (srcName.indexOf(day + '/') !== 0 || srcName.indexOf('..') !== -1) {
        throw new Error('object outside export prefix: ' + srcName);
    }
    return VAULT_PREFIX + srcName;
}

async function exists(file) {
    const r = await file.exists();
    return Array.isArray(r) ? r[0] : !!r;
}

async function copyDay(storage, buckets, day, log) {
    if (!DAY_RE.test(day)) throw new Error('bad day ' + day);
    const src = storage.bucket(buckets.source);
    const vault = storage.bucket(buckets.vault);
    const manifestFile = vault.file(VAULT_PREFIX + day + '/' + MANIFEST_NAME);
    if (await exists(manifestFile)) return { day: day, status: 'already_vaulted' };

    const metaName = day + '/' + day + '.overall_export_metadata';
    if (!(await exists(src.file(metaName)))) return { day: day, status: 'export_not_finished' };

    const [files] = await src.getFiles({ prefix: day + '/' });
    let copied = 0;
    let skipped = 0;
    let bytes = 0;
    for (let i = 0; i < files.length; i += COPY_CONCURRENCY) {
        const batch = files.slice(i, i + COPY_CONCURRENCY);
        await Promise.all(batch.map(async function (f) {
            const size = Number((f.metadata && f.metadata.size) || 0);
            bytes += size;
            const dest = vault.file(destName(day, f.name));
            if (await exists(dest)) { skipped++; return; }
            await f.copy(dest, { preconditionOpts: { ifGenerationMatch: 0 } });
            copied++;
        }));
    }

    // Verify: everything in the source prefix is now in the vault prefix.
    const [vaulted] = await vault.getFiles({ prefix: VAULT_PREFIX + day + '/' });
    const vaultObjs = vaulted.filter(function (f) { return !f.name.endsWith('/' + MANIFEST_NAME); });
    const vaultBytes = vaultObjs.reduce(function (s, f) { return s + Number((f.metadata && f.metadata.size) || 0); }, 0);
    if (vaultObjs.length !== files.length || vaultBytes !== bytes) {
        throw new Error('[VAULT] verify mismatch for ' + day + ': src ' + files.length + '/' + bytes
            + ' vault ' + vaultObjs.length + '/' + vaultBytes);
    }

    const manifest = {
        day: day,
        source: 'gs://' + buckets.source + '/' + day + '/',
        dest: 'gs://' + buckets.vault + '/' + VAULT_PREFIX + day + '/',
        objects: files.length,
        bytes: bytes,
        copied: copied,
        alreadyPresent: skipped,
        finishedAt: new Date().toISOString(),
    };
    await manifestFile.save(JSON.stringify(manifest, null, 2), {
        contentType: 'application/json',
        resumable: false,
        preconditionOpts: { ifGenerationMatch: 0 },
    });
    if (log) log('[VAULT] ' + day + ' vaulted: ' + files.length + ' objects, ' + bytes + ' bytes (' + copied + ' new)');
    return Object.assign({ status: 'vaulted' }, manifest);
}

async function runVaultCopy(opts) {
    const buckets = bucketsFor(opts.projectId);
    const days = daysToCopy(opts.now || new Date());
    const out = [];
    for (const day of days) out.push(await copyDay(opts.storage, buckets, day, opts.log));
    // Today's export must be vaulted by the time this runs (~1h after it
    // starts). Anything else fails the run so the error alert fires.
    if (out[0].status === 'export_not_finished') {
        throw new Error('[VAULT] export for ' + out[0].day + ' not finished; nothing vaulted');
    }
    return out;
}

module.exports = {
    VAULT_PREFIX: VAULT_PREFIX,
    MANIFEST_NAME: MANIFEST_NAME,
    bucketsFor: bucketsFor,
    daysToCopy: daysToCopy,
    destName: destName,
    copyDay: copyDay,
    runVaultCopy: runVaultCopy,
};
