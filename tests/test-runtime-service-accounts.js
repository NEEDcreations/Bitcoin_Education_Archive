// Per-function runtime service accounts: every function that binds a Secret
// Manager secret runs as its own account, no other function gets one, and the
// IAM plan grants each account exactly the secrets its function binds.
// Loads functions/index.js offline; no network, no IAM calls, fake env only.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const fnRoot = path.join(__dirname, '..', 'functions');
let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok  ' + name); }
    catch (e) { failed++; console.log('  FAIL ' + name + ': ' + e.message); }
}

process.env.GCLOUD_PROJECT = 'bitcoin-education-archive';
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'bitcoin-education-archive', storageBucket: 'bitcoin-education-archive.firebasestorage.app' });
const { RUNTIME_SERVICE_ACCOUNTS, runtimeSa } = require(path.join(fnRoot, 'src', 'runtimeServiceAccounts.js'));
const planMod = require(path.join(fnRoot, 'scripts', 'runtime-sa-plan.js'));
const endpoints = planMod.loadEndpoints();
const plan = planMod.buildPlan(endpoints);
const names = Object.keys(endpoints);
const secretBound = names.filter(function (n) { return endpoints[n].secrets.length > 0; }).sort();
const manifest = Object.keys(RUNTIME_SERVICE_ACCOUNTS).sort();
// Accounts for functions that bind no secret but still must not run on the
// default (Editor) accounts. Keep this list explicit and short.
const NO_SECRET_ACCOUNTS = ['dailyAuthExport'];
const secretManifest = manifest.filter(function (n) { return !RUNTIME_SERVICE_ACCOUNTS[n].noSecrets; });

test('manifest lists exactly the secret-bound exports (54) plus the no-secret allowlist', function () {
    assert.deepStrictEqual(secretManifest, secretBound);
    assert.strictEqual(secretManifest.length, 54);
    assert.deepStrictEqual(manifest.filter(function (n) { return RUNTIME_SERVICE_ACCOUNTS[n].noSecrets; }), NO_SECRET_ACCOUNTS);
});

test('every manifest function runs as its own account', function () {
    manifest.forEach(function (n) {
        assert.strictEqual(endpoints[n].serviceAccount, RUNTIME_SERVICE_ACCOUNTS[n].id + '@bitcoin-education-archive.iam.gserviceaccount.com', n);
    });
});

test('no-secret accounts really bind no secret', function () {
    NO_SECRET_ACCOUNTS.forEach(function (n) { assert.deepStrictEqual(endpoints[n].secrets, [], n); });
});

test('functions without secrets do not set a service account (except the allowlist)', function () {
    names.filter(function (n) { return endpoints[n].secrets.length === 0 && NO_SECRET_ACCOUNTS.indexOf(n) === -1; }).forEach(function (n) {
        assert.strictEqual(endpoints[n].serviceAccount, null, n);
    });
});

test('dailyAuthExport: custom reader role + objectCreator on the auth-backups bucket only', function () {
    const f = plan.functions.dailyAuthExport;
    assert.strictEqual(f.id, 'fn-daily-auth-export');
    assert.deepStrictEqual(f.projectRoles, ['projects/bitcoin-education-archive/roles/bqAuthBackupReader']);
    assert.deepStrictEqual(f.bucketRoles, [{ bucket: 'bitcoin-education-archive-auth-backups', role: 'roles/storage.objectCreator' }]);
    assert.deepStrictEqual(f.secrets, []);
    assert.strictEqual(f.gen, 2);
    assert.strictEqual(f.trigger, 'schedule');
    assert.strictEqual(f.selfInvoker, true);
    const { AUTH_BACKUP_READER_PERMISSIONS } = require(path.join(fnRoot, 'src', 'runtimeServiceAccounts.js'));
    assert.deepStrictEqual(AUTH_BACKUP_READER_PERMISSIONS.slice(), ['firebaseauth.configs.get', 'firebaseauth.configs.getHashConfig', 'firebaseauth.users.get']);
    const last = plan.batches[plan.batches.length - 1];
    assert.deepStrictEqual(last.fns, ['dailyAuthExport']);
    assert.strictEqual(last.standalone, true);
});

test('account ids are valid, unique, and fit the project quota', function () {
    const ids = manifest.map(function (n) { return RUNTIME_SERVICE_ACCOUNTS[n].id; });
    assert.strictEqual(new Set(ids).size, ids.length);
    ids.forEach(function (id) {
        assert.ok(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(id), id);
        assert.ok(id.indexOf('fn-') === 0, id);
    });
    assert.ok(ids.length + 6 <= 100, 'default quota is 100 service accounts per project');
});

test('runtimeSa resolves the project from env and never returns bare shorthand', function () {
    const saved = process.env.GCLOUD_PROJECT;
    try {
        process.env.GCLOUD_PROJECT = 'demo-staging';
        assert.strictEqual(runtimeSa('claimSats'), 'fn-claim-sats@demo-staging.iam.gserviceaccount.com');
        delete process.env.GCLOUD_PROJECT;
        assert.ok(/^fn-claim-sats@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(runtimeSa('claimSats')));
    } finally { process.env.GCLOUD_PROJECT = saved; }
});

test('runtimeSa throws for an unknown function (no silent default)', function () {
    assert.throws(function () { runtimeSa('notAFunction'); });
    assert.throws(function () { runtimeSa('constructor'); });
});

test('adminApproveFactionPayout: no account, no secrets, never in a batch', function () {
    assert.ok(!Object.prototype.hasOwnProperty.call(RUNTIME_SERVICE_ACCOUNTS, 'adminApproveFactionPayout'));
    if (endpoints.adminApproveFactionPayout) {
        assert.strictEqual(endpoints.adminApproveFactionPayout.serviceAccount, null);
        assert.strictEqual(endpoints.adminApproveFactionPayout.secrets.length, 0);
    }
    plan.batches.forEach(function (b) { assert.ok(b.fns.indexOf('adminApproveFactionPayout') === -1); });
});

test('batches cover each manifest function exactly once', function () {
    const all = [];
    plan.batches.forEach(function (b) { all.push.apply(all, b.fns); });
    assert.strictEqual(all.length, new Set(all).size);
    assert.deepStrictEqual(all.slice().sort(), manifest);
});

test('wallet functions deploy in the last secret-bound batch, canary first is read-only admin', function () {
    const secretBatches = plan.batches.filter(function (b) { return !b.standalone; });
    const last = secretBatches[secretBatches.length - 1].fns;
    ['claimSats', 'claimCipherSats', 'claimCipherWin', 'confirmTipSent', 'adminResolveCipherSatsClaim', 'tctvDripTick', 'getFaucetStats'].forEach(function (n) {
        assert.ok(last.indexOf(n) !== -1, n);
    });
    assert.ok(plan.batches[0].fns.indexOf('dailyActiveUsers') !== -1);
});

test('plan grants each account only its own secrets', function () {
    manifest.forEach(function (n) {
        assert.deepStrictEqual(plan.functions[n].secrets, endpoints[n].secrets, n);
    });
});

test('gcloud output: named deploy only, metadata-free, one secret grant per bound secret', function () {
    plan.batches.forEach(function (b, i) {
        const text = planMod.gcloudFor(plan, i);
        const deployLines = text.split('\n').filter(function (l) { return l.indexOf('firebase deploy') === 0; });
        assert.strictEqual(deployLines.length, 1);
        assert.ok(/--only functions:/.test(deployLines[0]));
        assert.ok(!/--only functions(\s|$)/.test(deployLines[0]));
        assert.ok(deployLines[0].indexOf('adminApproveFactionPayout') === -1);
        assert.ok(text.indexOf('versions/') === -1 && text.indexOf(':access') === -1);
        assert.ok(text.indexOf('roles/editor') === -1 && text.indexOf('roles/owner') === -1);
        b.fns.forEach(function (n) {
            const f = plan.functions[n];
            const grants = text.split('\n').filter(function (l) {
                return l.indexOf('gcloud secrets add-iam-policy-binding') === 0 && l.indexOf('serviceAccount:' + f.email + ' ') !== -1;
            });
            assert.strictEqual(grants.length, f.secrets.length, n);
        });
    });
});

test('gen2 event triggers get eventReceiver + own-service invoker; gen1 never does', function () {
    secretBound.forEach(function (n) {
        const f = plan.functions[n];
        if (f.gen === 1) {
            assert.strictEqual(f.selfInvoker, false, n);
            assert.ok(f.projectRoles.indexOf('roles/eventarc.eventReceiver') === -1, n);
        }
        if (f.gen === 2 && f.trigger === 'event') {
            assert.ok(f.selfInvoker, n);
            assert.ok(f.projectRoles.indexOf('roles/eventarc.eventReceiver') !== -1, n);
        }
        if (f.gen === 2 && f.trigger === 'schedule') assert.ok(f.selfInvoker, n);
    });
});

test('no source passes a default or literal service account', function () {
    const files = [];
    (function walk(d) {
        fs.readdirSync(d).forEach(function (f) {
            if (f === 'node_modules' || f === 'scripts' || f.startsWith('.')) return;
            const p = path.join(d, f);
            if (fs.statSync(p).isDirectory()) walk(p);
            else if (p.endsWith('.js')) files.push(p);
        });
    })(fnRoot);
    files.forEach(function (p) {
        const src = fs.readFileSync(p, 'utf8');
        const hits = src.match(/\bserviceAccount:\s+(?!runtimeSa\()[^,}\n]*/g) || [];
        assert.deepStrictEqual(hits, [], path.relative(fnRoot, p));
    });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
