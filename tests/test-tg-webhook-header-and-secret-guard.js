// setTelegramWebhook takes the admin token from the x-admin-token header only,
// and the functions predeploy guard refuses to deploy unless all 10 bound
// Secret Manager secrets exist. Fake values only; no network.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'functions');
let passed = 0;
let failed = 0;
// Sequential: tests set process.env.
let chain = Promise.resolve();
function test(name, fn) {
    chain = chain.then(function () { return Promise.resolve().then(fn); }).then(
        function () { passed++; console.log('  ok  ' + name); },
        function (e) { failed++; console.log('  FAIL ' + name + ': ' + e.message); }
    );
}

const TEN = ['ADMIN_TOKEN', 'BRIDGE_SECRET', 'CF_AI_TOKEN', 'STRAVA_CLIENT_SECRET', 'TG_BOT_TOKEN',
    'TURNSTILE_SECRET_KEY', 'X_ACCESS_SECRET', 'X_ACCESS_TOKEN', 'X_API_KEY', 'X_API_SECRET'];
const FAKE_ADMIN = 'fake-admin-token-for-test-0123456789';

function fakeRes() {
    const r = { code: 200, body: null };
    r.status = function (c) { r.code = c; return r; };
    r.json = function (b) { r.body = b; return r; };
    r.send = function (b) { r.body = b; return r; };
    return r;
}

let hook;
function loadHook() {
    if (hook) return hook;
    process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-test';
    const app = require(path.join(root, 'node_modules', 'firebase-admin', 'lib', 'app', 'index.js'));
    if (!app.getApps().length) app.initializeApp({ projectId: 'demo-test' });
    hook = require(path.join(root, 'src', 'handleTelegramReaction.js')).setTelegramWebhook;
    return hook;
}

test('source no longer reads req.query.token', function () {
    const src = fs.readFileSync(path.join(root, 'src', 'handleTelegramReaction.js'), 'utf8');
    assert.ok(!/req\.query\.token/.test(src));
    assert.ok(src.includes("req.headers['x-admin-token'] || ''"));
});

test('correct token in ?token= is refused with 400 and never compared', async function () {
    process.env.ADMIN_TOKEN = FAKE_ADMIN;
    delete process.env.TG_BOT_TOKEN;
    const res = fakeRes();
    await loadHook()({ headers: {}, query: { token: FAKE_ADMIN } }, res);
    assert.strictEqual(res.code, 400);
    assert.ok(!JSON.stringify(res.body).includes(FAKE_ADMIN));
});

test('?token= is refused even when the header is also correct', async function () {
    process.env.ADMIN_TOKEN = FAKE_ADMIN;
    const res = fakeRes();
    await loadHook()({ headers: { 'x-admin-token': FAKE_ADMIN }, query: { token: 'x' } }, res);
    assert.strictEqual(res.code, 400);
});

test('missing or wrong header is 403', async function () {
    process.env.ADMIN_TOKEN = FAKE_ADMIN;
    let res = fakeRes();
    await loadHook()({ headers: {}, query: {} }, res);
    assert.strictEqual(res.code, 403);
    res = fakeRes();
    await loadHook()({ headers: { 'x-admin-token': 'wrong' }, query: {} }, res);
    assert.strictEqual(res.code, 403);
});

test('correct header passes auth (stops at missing bot token, no network)', async function () {
    process.env.ADMIN_TOKEN = FAKE_ADMIN;
    delete process.env.TG_BOT_TOKEN;
    const res = fakeRes();
    await loadHook()({ headers: { 'x-admin-token': FAKE_ADMIN }, query: {} }, res);
    assert.strictEqual(res.code, 500);
    assert.strictEqual(res.body, 'TG_BOT_TOKEN not configured');
});

test('unset ADMIN_TOKEN fails closed with 403', async function () {
    delete process.env.ADMIN_TOKEN;
    const res = fakeRes();
    await loadHook()({ headers: { 'x-admin-token': '' }, query: {} }, res);
    assert.strictEqual(res.code, 403);
});

const guard = require(path.join(root, 'scripts', 'require-secrets-exist.js'));
const { REQUIRED_SECRET_NAMES } = require(path.join(root, 'src', 'sensitiveSecrets.js'));

function fakeFetch(states) {
    const calls = [];
    const fn = async function (url, opts) {
        calls.push({ url: url, auth: opts && opts.headers && opts.headers.authorization });
        const name = decodeURIComponent(url.split('/secrets/')[1].split('/')[0]);
        if (!(name in states)) return { status: 404, json: async function () { return {}; } };
        return { status: 200, json: async function () { return { state: states[name] }; } };
    };
    fn.calls = calls;
    return fn;
}
function allEnabled() { const s = {}; TEN.forEach(function (n) { s[n] = 'ENABLED'; }); return s; }

test('required list is exactly the 10 bound secrets (no CF_API_TOKEN, no NWC_URL)', function () {
    assert.deepStrictEqual(REQUIRED_SECRET_NAMES, TEN);
});

test('all 10 enabled -> ok, metadata URLs only (never :access)', async function () {
    const f = fakeFetch(allEnabled());
    const r = await guard.checkSecrets({ project: 'demo-test', fetch: f, getToken: async function () { return 'tok'; } });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(f.calls.length, 10);
    f.calls.forEach(function (c) {
        assert.ok(/\/versions\/latest$/.test(c.url), c.url);
        assert.ok(!c.url.includes(':access'));
        assert.strictEqual(c.auth, 'Bearer tok');
    });
});

test('one missing and one disabled -> blocked, names listed', async function () {
    const s = allEnabled();
    delete s.X_API_SECRET;
    s.TG_BOT_TOKEN = 'DISABLED';
    const r = await guard.checkSecrets({ project: 'demo-test', fetch: fakeFetch(s), getToken: async function () { return 'tok'; } });
    assert.strictEqual(r.ok, false);
    assert.deepStrictEqual(r.missing.map(function (m) { return m.name; }).sort(), ['TG_BOT_TOKEN', 'X_API_SECRET']);
    assert.ok(r.missing.some(function (m) { return m.why === 'http 404'; }));
});

test('no credentials or no project fails closed', async function () {
    let r = await guard.checkSecrets({ project: 'demo-test', fetch: fakeFetch(allEnabled()), getToken: async function () { throw new Error('no adc'); } });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.missing.length, 10);
    r = await guard.checkSecrets({ project: '', fetch: fakeFetch(allEnabled()), getToken: async function () { return 'tok'; } });
    assert.strictEqual(r.ok, false);
});

test('network error on a secret blocks deploy', async function () {
    const r = await guard.checkSecrets({ project: 'demo-test', getToken: async function () { return 'tok'; },
        fetch: async function () { throw new Error('ECONNRESET'); } });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.missing.length, 10);
});

test('project id: --project, then GCLOUD_PROJECT, then .firebaserc default', function () {
    assert.strictEqual(guard.projectId(['--project', 'p1'], { GCLOUD_PROJECT: 'p2' }), 'p1');
    assert.strictEqual(guard.projectId([], { GCLOUD_PROJECT: 'p2' }), 'p2');
    assert.strictEqual(guard.projectId([], {}), 'bitcoin-education-archive');
});

test('firebase.json runs both guards as functions predeploy', function () {
    const fj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'));
    const pre = [].concat(fj.functions).map(function (f) { return (f.predeploy || []).join('\n'); }).join('\n');
    assert.ok(pre.includes('reject-plain-sensitive-env.js'));
    assert.ok(pre.includes('require-secrets-exist.js'));
});

test('guard source never asks for a secret value', function () {
    const src = fs.readFileSync(path.join(root, 'scripts', 'require-secrets-exist.js'), 'utf8');
    assert.ok(!src.includes(':access'));
    assert.ok(!/payload/.test(src));
});

chain.then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
});
