// nightlyVaultCopy: copies a finished Firestore export into the 10-year
// vault bucket. Fake in-memory Storage only; no network, no GCP calls.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const fnRoot = path.join(__dirname, '..', 'functions');
const vc = require(path.join(fnRoot, 'src', 'vaultCopy.js'));
let passed = 0;
let failed = 0;
const pending = [];
function test(name, fn) {
    pending.push(Promise.resolve().then(fn).then(
        function () { passed++; console.log('  ok  ' + name); },
        function (e) { failed++; console.log('  FAIL ' + name + ': ' + e.message); }));
}

function fakeStorage(seed) {
    const buckets = {};
    const calls = { deletes: 0, copies: [], saves: [] };
    function b(name) {
        if (!buckets[name]) buckets[name] = {};
        const objs = buckets[name];
        function file(n) {
            return {
                name: n,
                get metadata() { return objs[n] ? { size: String(objs[n].size) } : {}; },
                exists: async function () { return [!!objs[n]]; },
                copy: async function (dest, opts) {
                    assert.ok(opts && opts.preconditionOpts && opts.preconditionOpts.ifGenerationMatch === 0, 'copy must use ifGenerationMatch 0');
                    if (dest._objs[dest.name]) throw new Error('412 precondition');
                    dest._objs[dest.name] = { size: objs[n].size };
                    calls.copies.push(n);
                },
                save: async function (body, opts) {
                    assert.ok(opts && opts.preconditionOpts && opts.preconditionOpts.ifGenerationMatch === 0, 'save must use ifGenerationMatch 0');
                    if (objs[n]) throw new Error('412 precondition');
                    objs[n] = { size: Buffer.byteLength(body), body: body };
                    calls.saves.push(n);
                },
                delete: async function () { calls.deletes++; throw new Error('delete must never be called'); },
                _objs: objs,
            };
        }
        return {
            file: file,
            getFiles: async function (q) {
                return [Object.keys(objs).filter(function (k) { return k.indexOf(q.prefix) === 0; }).sort().map(file)];
            },
            _objs: objs,
        };
    }
    Object.keys(seed || {}).forEach(function (bn) { Object.assign(b(bn)._objs, seed[bn]); });
    return { bucket: b, _calls: calls, _buckets: buckets };
}

function exportSeed(day, n) {
    const o = {};
    o[day + '/' + day + '.overall_export_metadata'] = { size: 120 };
    for (let i = 0; i < n; i++) o[day + '/all_namespaces/all_kinds/output-' + i] = { size: 1000 + i };
    o[day + '/all_namespaces/all_kinds/all_namespaces_all_kinds.export_metadata'] = { size: 50 };
    return o;
}

const P = 'bitcoin-education-archive';
const SRC = P + '-backups';
const VAULT = P + '-offline-vault';
const NOW = new Date('2026-11-18T03:00:00Z');

test('buckets default to <project>-backups and <project>-offline-vault', function () {
    delete process.env.BQ_BACKUP_BUCKET; delete process.env.BQ_VAULT_BUCKET;
    assert.deepStrictEqual(vc.bucketsFor(P), { source: SRC, vault: VAULT });
    assert.throws(function () { vc.bucketsFor('bad/../proj'); });
});

test('checks today and yesterday (UTC), newest first', function () {
    assert.deepStrictEqual(vc.daysToCopy(NOW), ['2026-11-18', '2026-11-17']);
});

test('destName keeps the export layout under nightly/ and refuses outside names', function () {
    assert.strictEqual(vc.destName('2026-11-18', '2026-11-18/a/b'), 'nightly/2026-11-18/a/b');
    assert.throws(function () { vc.destName('2026-11-18', '2026-11-17/a'); });
    assert.throws(function () { vc.destName('2026-11-18', '2026-11-18/../x'); });
    assert.throws(function () { vc.destName('../', '../x'); });
});

test('copies a finished export, verifies, writes a manifest, never deletes', async function () {
    const seed = {}; seed[SRC] = Object.assign(exportSeed('2026-11-18', 5), exportSeed('2026-11-17', 3));
    const st = fakeStorage(seed);
    const out = await vc.runVaultCopy({ storage: st, projectId: P, now: NOW });
    assert.strictEqual(out[0].status, 'vaulted');
    assert.strictEqual(out[0].objects, 7);
    assert.strictEqual(out[1].status, 'vaulted');
    assert.strictEqual(st._calls.deletes, 0);
    const v = st._buckets[VAULT];
    assert.ok(v['nightly/2026-11-18/_VAULT_MANIFEST.json']);
    assert.ok(v['nightly/2026-11-18/2026-11-18.overall_export_metadata']);
    const m = JSON.parse(v['nightly/2026-11-18/_VAULT_MANIFEST.json'].body);
    assert.strictEqual(m.bytes, 120 + 50 + 1000 + 1001 + 1002 + 1003 + 1004);
    // source untouched
    assert.strictEqual(Object.keys(st._buckets[SRC]).length, 7 + 5);
});

test('second run is a no-op (already_vaulted), no new copies', async function () {
    const seed = {}; seed[SRC] = Object.assign(exportSeed('2026-11-18', 2), exportSeed('2026-11-17', 2));
    const st = fakeStorage(seed);
    await vc.runVaultCopy({ storage: st, projectId: P, now: NOW });
    const n = st._calls.copies.length;
    const out = await vc.runVaultCopy({ storage: st, projectId: P, now: NOW });
    assert.deepStrictEqual(out.map(function (r) { return r.status; }), ['already_vaulted', 'already_vaulted']);
    assert.strictEqual(st._calls.copies.length, n);
});

test('a half-finished day resumes and skips objects already vaulted', async function () {
    const seed = {}; seed[SRC] = exportSeed('2026-11-18', 4);
    seed[VAULT] = { 'nightly/2026-11-18/all_namespaces/all_kinds/output-0': { size: 1000 } };
    const st = fakeStorage(seed);
    const r = await vc.copyDay(st, { source: SRC, vault: VAULT }, '2026-11-18');
    assert.strictEqual(r.status, 'vaulted');
    assert.strictEqual(r.copied, 5);
    assert.strictEqual(r.alreadyPresent, 1);
});

test('an unfinished export (no overall_export_metadata) is not copied, and fails the run for today', async function () {
    const seed = {}; seed[SRC] = exportSeed('2026-11-18', 2);
    delete seed[SRC]['2026-11-18/2026-11-18.overall_export_metadata'];
    const st = fakeStorage(seed);
    await assert.rejects(vc.runVaultCopy({ storage: st, projectId: P, now: NOW }), /not finished/);
    assert.strictEqual(st._calls.copies.length, 0);
});

test('a size mismatch fails the run and writes no manifest', async function () {
    const seed = {}; seed[SRC] = exportSeed('2026-11-18', 2);
    seed[VAULT] = { 'nightly/2026-11-18/all_namespaces/all_kinds/output-1': { size: 7 } }; // tampered/short copy
    const st = fakeStorage(seed);
    await assert.rejects(vc.copyDay(st, { source: SRC, vault: VAULT }, '2026-11-18'), /verify mismatch/);
    assert.ok(!st._buckets[VAULT]['nightly/2026-11-18/_VAULT_MANIFEST.json']);
});

test('source has no delete, overwrite, Firestore or Auth calls', function () {
    const src = fs.readFileSync(path.join(fnRoot, 'src', 'vaultCopy.js'), 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/\.delete\(|deleteFiles|\.firestore\(|\.auth\(|importDocuments/.test(src));
    assert.strictEqual((src.match(/ifGenerationMatch: 0/g) || []).length, 2);
});

test('index.js wires nightlyVaultCopy to fn-vault-copy with bucket-only grants', function () {
    const idx = fs.readFileSync(path.join(fnRoot, 'index.js'), 'utf8');
    assert.ok(/exports\.nightlyVaultCopy = onSchedule\(\{[\s\S]{0,300}serviceAccount: backupSa\('nightlyVaultCopy'\)/.test(idx));
    process.env.GCLOUD_PROJECT = P;
    const sa = require(path.join(fnRoot, 'src', 'runtimeServiceAccounts.js'));
    assert.strictEqual(sa.backupSa('nightlyVaultCopy'), 'fn-vault-copy@' + P + '.iam.gserviceaccount.com');
    const roles = sa.BACKUP_SERVICE_ACCOUNTS.nightlyVaultCopy.grants.map(function (g) { return g.bucket + ' ' + g.role; });
    assert.deepStrictEqual(roles, ['-backups roles/storage.objectViewer', '-offline-vault roles/storage.objectCreator', '-offline-vault roles/storage.objectViewer']);
    assert.ok(!JSON.stringify(sa.BACKUP_SERVICE_ACCOUNTS).includes('objectAdmin'));
    assert.throws(function () { sa.backupSa('claimSats'); });
});

Promise.all(pending).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
});
