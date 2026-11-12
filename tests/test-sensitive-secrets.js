// Sensitive names are Secret Manager params, read at call time, and bound
// only on the functions that use them. Fake values only.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..', 'functions');
const names = [
    'ADMIN_TOKEN',
    'BRIDGE_SECRET',
    'CF_AI_TOKEN',
    'CF_API_TOKEN',
    'NWC_URL',
    'STRAVA_CLIENT_SECRET',
    'TG_BOT_TOKEN',
    'TURNSTILE_SECRET_KEY',
    'X_ACCESS_SECRET',
    'X_ACCESS_TOKEN',
    'X_API_KEY',
    'X_API_SECRET',
];
let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok  ' + name); }
    catch (e) { failed++; console.log('  FAIL ' + name + ': ' + e.message); }
}
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function walk(dir, out) {
    for (const f of fs.readdirSync(dir)) {
        if (f === 'node_modules' || f.startsWith('.')) continue;
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p, out);
        else if (p.endsWith('.js')) out.push(p);
    }
    return out;
}
function secretLines(src) {
    return src.split('\n').filter(function (line) { return line.indexOf('secrets:') !== -1; });
}

test('used names are defineSecret params and CF_API_TOKEN is not', function () {
    const src = read('src/sensitiveSecrets.js');
    names.forEach(function (name) {
        if (name === 'CF_API_TOKEN' || name === 'NWC_URL') {
            assert.ok(!src.includes("defineSecret('" + name + "')"), name);
        } else {
            assert.ok(src.includes("defineSecret('" + name + "')"), name);
        }
    });
    assert.ok(read('src/nwcSecret.js').includes("defineSecret('NWC_URL')"));
    const mod = require(path.join(root, 'src', 'sensitiveSecrets.js'));
    assert.strictEqual(mod.adminTokenSecret.name, 'ADMIN_TOKEN');
    assert.strictEqual(mod.bridgeSecretParam.name, 'BRIDGE_SECRET');
    assert.strictEqual(mod.hotTopicSecrets.length, 5);
    assert.strictEqual(mod.xPostSecrets.length, 4);
    assert.deepStrictEqual(mod.PLAIN_ENV_NAMES, names);
});

test('getters read process.env at call time and do not cache', function () {
    const mod = require(path.join(root, 'src', 'sensitiveSecrets.js'));
    const prev = {};
    names.forEach(function (name) { prev[name] = process.env[name]; delete process.env[name]; });
    assert.strictEqual(mod.adminToken(), '');
    assert.strictEqual(mod.bridgeSecret(), '');
    assert.strictEqual(mod.cfAiToken(), '');
    assert.strictEqual(mod.stravaClientSecret(), '');
    assert.strictEqual(mod.tgBotToken(), '');
    assert.strictEqual(mod.turnstileSecretKey(), '');
    assert.strictEqual(mod.xApiKey(), '');
    assert.strictEqual(mod.xApiSecret(), '');
    assert.strictEqual(mod.xAccessToken(), '');
    assert.strictEqual(mod.xAccessSecret(), '');
    process.env.ADMIN_TOKEN = 'fake-admin';
    process.env.TG_BOT_TOKEN = 'fake-bot';
    process.env.X_API_KEY = 'fake-x';
    assert.strictEqual(mod.adminToken(), 'fake-admin');
    assert.strictEqual(mod.tgBotToken(), 'fake-bot');
    assert.strictEqual(mod.xApiKey(), 'fake-x');
    process.env.ADMIN_TOKEN = 'fake-admin-2';
    assert.strictEqual(mod.adminToken(), 'fake-admin-2');
    names.forEach(function (name) {
        if (prev[name] === undefined) delete process.env[name];
        else process.env[name] = prev[name];
    });
});

test('plain process.env.NAME reads stay in the secret modules', function () {
    const allowed = new Set([
        path.join(root, 'src', 'sensitiveSecrets.js'),
        path.join(root, 'src', 'nwcSecret.js'),
    ]);
    const re = new RegExp('process\\.env\\.(?:' + names.join('|') + ')\\b|process\\.env\\[[\'"](?:' + names.join('|') + ')[\'"]\\]');
    const offenders = walk(root, []).filter(function (p) {
        if (allowed.has(p)) return false;
        return re.test(fs.readFileSync(p, 'utf8'));
    });
    assert.deepStrictEqual(offenders, []);
});

test('no sensitive value is captured at module load', function () {
    const re = new RegExp('(?:const|let|var)\\s+[A-Za-z0-9_]+\\s*=\\s*process\\.env\\.(?:' + names.join('|') + ')\\b');
    const offenders = walk(root, []).filter(function (p) {
        return re.test(fs.readFileSync(p, 'utf8'));
    });
    assert.deepStrictEqual(offenders, []);
    const hook = read('src/handleTelegramReaction.js');
    assert.ok(hook.indexOf('function webhookSecret()') !== -1);
    assert.ok(!/const TG_BOT_TOKEN\s*=/.test(hook));
    assert.ok(!/const ADMIN_TOKEN\s*=/.test(hook));
    assert.ok(!/const TG_WEBHOOK_SECRET\s*=/.test(hook));
});

test('each reader binds only the secrets it uses', function () {
    const index = read('index.js');
    const lines = walk(root, []).reduce(function (all, file) {
        return all.concat(secretLines(fs.readFileSync(file, 'utf8')));
    }, []);
    function count(needle) {
        return lines.filter(function (line) { return line.indexOf(needle) !== -1; }).length;
    }
    assert.strictEqual(count('adminTokenSecret'), 13);
    assert.strictEqual(count('turnstileSecret'), 3);
    assert.ok(read('src/gifting.js').includes("secrets: [deletionHmacSecret, nwcUrlSecret, require('./sensitiveSecrets').turnstileSecret, require('./payoutGuardSecret').payoutGuardSecret]"));
    // #286: the anti-drain HMAC key binds on exactly the three payout callables.
    assert.strictEqual(count('payoutGuardSecret'), 3);
    assert.strictEqual(count('stravaClientSecretParam'), 2);
    assert.strictEqual(count('hotTopicSecrets'), 3);
    assert.strictEqual(count('xPostSecrets'), 1);
    // adminSetKillSwitch and killSwitchAutoReturnTick also bind the Telegram
    // bot token (admin / Phil alerts), so 16 functions are bound, not 14.
    assert.strictEqual(count('tgBotTokenSecret'), 16);
    assert.strictEqual(count('bridgeSecretParam'), 0);
    assert.strictEqual(count('CF_API_TOKEN'), 0);
    // +1 in #286: payoutFloatWatch (10-minute wallet drain check) reads the balance.
    assert.strictEqual(count('nwcUrlSecret'), 8);
    assert.ok(index.includes("secrets: [deletionHmacSecret, nwcUrlSecret, turnstileSecret, require('./src/payoutGuardSecret').payoutGuardSecret]"));
    assert.ok(index.includes('secrets: [adminTokenSecret].concat(hotTopicSecrets)'));
    assert.ok(read('src/handleTelegramReaction.js').includes("secrets: ['TG_WEBHOOK_SECRET']"));
    assert.ok(read('src/handleTelegramReaction.js').includes("secrets: ['TG_WEBHOOK_SECRET', tgBotTokenSecret, adminTokenSecret]"));
    const forumCredit = read('src/scheduleRaidBoss.js');
    const creditAt = forumCredit.indexOf('exports.scheduleRaidForumCredit');
    assert.ok(creditAt !== -1);
    assert.ok(forumCredit.slice(creditAt).indexOf('tgBotTokenSecret') === -1);
});

test('held payout and non-readers do not gain these secrets', function () {
    const jobs = read('src/factionRaceJobs.js');
    const payout = jobs.slice(jobs.indexOf('const adminApproveFactionPayout'));
    assert.ok(payout.indexOf('secrets') === -1);
    assert.ok(payout.indexOf('runWith') === -1);
    const index = read('index.js');
    const bridge = index.slice(index.indexOf('exports.bridgeToTelegram'), index.indexOf('exports.claimSats'));
    assert.ok(bridge.indexOf('secrets') === -1);
    assert.ok(bridge.indexOf('BRIDGE_SECRET') === -1);
    const recount = index.slice(index.indexOf('exports.recountCountryStats'), index.indexOf('exports.refreshBadgeDistribution'));
    assert.ok(recount.indexOf('adminTokenSecret') === -1);
    assert.ok(recount.indexOf('secrets:') === -1);
    const initAuth = index.slice(index.indexOf('exports.stravaInitAuth'), index.indexOf('exports.stravaAuth'));
    assert.ok(initAuth.indexOf('stravaClientSecretParam') === -1);
    const mirror = read('src/telegramBridge.js');
    const fn = mirror.slice(mirror.indexOf('async function mirrorShoutoutOnce'), mirror.indexOf('async function deleteTelegramMessage'));
    const deferAt = fn.indexOf("reason: 'server_mirror'");
    const readAt = fn.indexOf('env.BRIDGE_SECRET');
    assert.ok(deferAt !== -1 && readAt !== -1 && deferAt < readAt);
});

test('no tracked env file carries a sensitive name', function () {
    const re = new RegExp('^\\s*(?:export\\s+)?(?:' + names.join('|') + ')\\s*=', 'm');
    function checkDir(dir) {
        fs.readdirSync(dir).forEach(function (name) {
            if (name === '.env' || name.startsWith('.env.')) {
                assert.ok(!re.test(fs.readFileSync(path.join(dir, name), 'utf8')), name);
            }
        });
    }
    checkDir(root);
    checkDir(path.join(root, '..'));
});

test('plain-env guard names keys and does not echo values', function () {
    const script = path.join(root, 'scripts', 'reject-plain-sensitive-env.js');
    const src = fs.readFileSync(script, 'utf8');
    assert.ok(src.indexOf('console.log(line') === -1);
    assert.ok(src.indexOf('console.error(line') === -1);
    const firebase = fs.readFileSync(path.join(root, '..', 'firebase.json'), 'utf8');
    assert.ok(firebase.indexOf('reject-plain-sensitive-env.js') !== -1);
    const out = execFileSync(process.execPath, [script], { encoding: 'utf8' });
    assert.strictEqual(out.trim(), 'plain sensitive env: none');
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
