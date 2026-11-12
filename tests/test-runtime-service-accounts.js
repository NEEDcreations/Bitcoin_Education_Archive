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

test('manifest lists exactly the secret-bound exports (58)', function () {
    assert.deepStrictEqual(manifest, secretBound);
    assert.strictEqual(manifest.length, 58);
    assert.strictEqual(secretBound.length, 58);
});

test('every secret-bound function runs as its own account', function () {
    secretBound.forEach(function (n) {
        assert.strictEqual(endpoints[n].serviceAccount, RUNTIME_SERVICE_ACCOUNTS[n].id + '@bitcoin-education-archive.iam.gserviceaccount.com', n);
    });
});

test('functions without secrets do not set a service account', function () {
    names.filter(function (n) { return endpoints[n].secrets.length === 0; }).forEach(function (n) {
        assert.strictEqual(endpoints[n].serviceAccount, null, n);
    });
});

test('account ids are valid, unique, and fit the project quota', function () {
    const ids = manifest.map(function (n) { return RUNTIME_SERVICE_ACCOUNTS[n].id; });
    // adminSetKillSwitch and killSwitchAutoReturnTick intentionally share one account.
    const unique = Array.from(new Set(ids));
    assert.strictEqual(ids.filter(function (id) { return id === 'fn-admin-kill-switch'; }).length, 2);
    assert.strictEqual(unique.length, ids.length - 1);
    unique.forEach(function (id) {
        assert.ok(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(id), id);
        assert.ok(id.indexOf('fn-') === 0, id);
    });
    assert.ok(unique.length + 6 <= 100, 'default quota is 100 service accounts per project');
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

test('batches cover each secret-bound function exactly once', function () {
    const all = [];
    plan.batches.forEach(function (b) { all.push.apply(all, b.fns); });
    assert.strictEqual(all.length, new Set(all).size);
    assert.deepStrictEqual(all.slice().sort(), secretBound);
});

test('wallet functions deploy in the last batch, canary first is read-only admin', function () {
    const last = plan.batches[plan.batches.length - 1].fns;
    ['claimSats', 'claimCipherSats', 'claimCipherWin', 'confirmTipSent', 'adminResolveCipherSatsClaim', 'tctvDripTick', 'getFaucetStats'].forEach(function (n) {
        assert.ok(last.indexOf(n) !== -1, n);
    });
    assert.ok(plan.batches[0].fns.indexOf('dailyActiveUsers') !== -1);
});

test('plan grants each account only its own secrets', function () {
    secretBound.forEach(function (n) {
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
            // Shared runtime SAs emit one grant per unique secret on that
            // account, not per function in the batch.
            const union = new Set();
            b.fns.forEach(function (other) {
                if (plan.functions[other].email === f.email) {
                    plan.functions[other].secrets.forEach(function (s) { union.add(s); });
                }
            });
            assert.strictEqual(grants.length, union.size, n);
        });
    });
});

test('gcloud --condition is double-quoted and the plan is valid bash (K1-L1)', function () {
    const { execFileSync } = require('child_process');
    const os = require('os');
    let sawCondition = 0;
    for (let i = 0; i < plan.batches.length; i++) {
        const text = planMod.gcloudFor(plan, i);
        const tmp = path.join(os.tmpdir(), 'runtime-sa-plan-batch-' + i + '.sh');
        fs.writeFileSync(tmp, text);
        try {
            execFileSync('bash', ['-n', tmp], { encoding: 'utf8' });
        } finally {
            try { fs.unlinkSync(tmp); } catch (e) { /* ignore */ }
        }
        text.split('\n').forEach(function (l) {
            if (l.indexOf('--condition=') === -1 || l.indexOf('--condition=None') !== -1) return;
            assert.ok(/--condition="/.test(l), 'outer quotes must be double: ' + l);
            assert.ok(!/--condition='/.test(l), 'single-quoted --condition breaks CEL: ' + l);
            sawCondition++;
        });
    }
    assert.ok(sawCondition > 0, 'expected at least one prefixed bucket condition');
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

test('kill-switch SA gets auth viewer for listUsers, not auth admin', function () {
    ['adminSetKillSwitch', 'killSwitchAutoReturnTick'].forEach(function (n) {
        const extras = RUNTIME_SERVICE_ACCOUNTS[n].extra;
        assert.ok(extras.indexOf('authViewer') !== -1, n);
        assert.ok(extras.indexOf('auth') === -1, n);
        const roles = plan.functions[n].projectRoles;
        assert.ok(roles.indexOf('roles/firebaseauth.viewer') !== -1, n);
        assert.ok(roles.indexOf('roles/firebaseauth.admin') === -1, n);
    });
});

test('runtime-sa-plan refuses BQ_BACKUP_BUCKET when the project is live', function () {
    assert.throws(function () {
        planMod.assertLiveBackupBucketUnset('bitcoin-education-archive', 'bitcoin-quest-staging-backups-use1');
    }, /BQ_BACKUP_BUCKET/);
    assert.doesNotThrow(function () {
        planMod.assertLiveBackupBucketUnset('bitcoin-education-archive', '');
        planMod.assertLiveBackupBucketUnset('bitcoin-education-archive', undefined);
        planMod.assertLiveBackupBucketUnset('bitcoin-quest-staging', 'bitcoin-quest-staging-backups-use1');
    });
    assert.strictEqual(planMod.projectIdFrom(['--project', 'bitcoin-quest-staging'], {}), 'bitcoin-quest-staging');
    assert.strictEqual(planMod.projectIdFrom(['--project=bitcoin-education-archive'], { GCLOUD_PROJECT: 'bitcoin-quest-staging' }), 'bitcoin-education-archive');
    assert.strictEqual(planMod.projectIdFrom([], { GCLOUD_PROJECT: 'bitcoin-quest-staging' }), 'bitcoin-quest-staging');
    assert.strictEqual(planMod.projectIdFrom([], {}), 'bitcoin-education-archive');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
