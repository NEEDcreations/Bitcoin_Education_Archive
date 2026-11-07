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
// Chat moderation binds no secret. Each function still has its own account.
const CHAT_MOD_FNS = ['onDmMessageEdited', 'onGlobalChatEdited', 'onGlobalChatHardDeleted', 'purgeChatModerationLog'];

test('manifest lists the secret-bound exports plus chat moderation (58)', function () {
    assert.deepStrictEqual(manifest, secretBound.concat(CHAT_MOD_FNS).sort());
    assert.strictEqual(secretBound.length, 54);
    assert.strictEqual(manifest.length, 58);
});

test('every secret-bound function runs as its own account', function () {
    secretBound.forEach(function (n) {
        assert.strictEqual(endpoints[n].serviceAccount, RUNTIME_SERVICE_ACCOUNTS[n].id + '@bitcoin-education-archive.iam.gserviceaccount.com', n);
    });
});

test('functions without secrets do not set a service account', function () {
    const chatMod = {};
    CHAT_MOD_FNS.forEach(function (n) { chatMod[n] = true; });
    names.filter(function (n) { return endpoints[n].secrets.length === 0 && !chatMod[n]; }).forEach(function (n) {
        assert.strictEqual(endpoints[n].serviceAccount, null, n);
    });
});

test('chat moderation functions each have a least-privilege account and no secrets', function () {
    CHAT_MOD_FNS.forEach(function (n) {
        const f = plan.functions[n];
        assert.ok(f, n);
        assert.deepStrictEqual(f.secrets, [], n);
        assert.ok(f.projectRoles.indexOf('roles/datastore.user') !== -1, n);
        assert.ok(f.projectRoles.indexOf('roles/editor') === -1, n);
        if (n === 'onGlobalChatEdited' || n === 'onDmMessageEdited') {
            assert.strictEqual(f.bucketRoles.length, 1, n);
            assert.strictEqual(f.bucketRoles[0].role, 'roles/storage.objectAdmin', n);
            assert.strictEqual(f.bucketRoles[0].bucket, 'bitcoin-education-archive.firebasestorage.app', n);
        } else {
            assert.strictEqual(f.bucketRoles.length, 0, n);
        }
        assert.strictEqual(endpoints[n].serviceAccount, RUNTIME_SERVICE_ACCOUNTS[n].id + '@bitcoin-education-archive.iam.gserviceaccount.com', n);
        if (n === 'purgeChatModerationLog') {
            assert.strictEqual(f.trigger, 'schedule');
            assert.strictEqual(f.selfInvoker, true);
            assert.ok(f.projectRoles.indexOf('roles/eventarc.eventReceiver') === -1, n);
        } else {
            assert.strictEqual(f.trigger, 'event');
            assert.strictEqual(f.gen, 2);
            assert.strictEqual(f.selfInvoker, true);
            assert.ok(f.projectRoles.indexOf('roles/eventarc.eventReceiver') !== -1, n);
        }
    });
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

test('batches cover each secret-bound function exactly once', function () {
    const all = [];
    plan.batches.forEach(function (b) { all.push.apply(all, b.fns); });
    assert.strictEqual(all.length, new Set(all).size);
    assert.deepStrictEqual(all.slice().sort(), secretBound.concat(CHAT_MOD_FNS).sort());
    const modBatch = plan.batches.filter(function (b) { return b.fns.indexOf('onGlobalChatEdited') !== -1; })[0];
    assert.deepStrictEqual(modBatch.fns.slice().sort(), CHAT_MOD_FNS.slice().sort());
});

test('wallet functions stay batch 7, chat moderation is the batch after them', function () {
    assert.strictEqual(plan.batches.length, 8);
    const wallet = plan.batches[6].fns;
    ['claimSats', 'claimCipherSats', 'claimCipherWin', 'confirmTipSent', 'adminResolveCipherSatsClaim', 'tctvDripTick', 'getFaucetStats'].forEach(function (n) {
        assert.ok(wallet.indexOf(n) !== -1, n);
    });
    assert.ok(plan.batches[0].fns.indexOf('dailyActiveUsers') !== -1);
    assert.deepStrictEqual(plan.batches[7].fns.slice().sort(), CHAT_MOD_FNS.slice().sort());
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
