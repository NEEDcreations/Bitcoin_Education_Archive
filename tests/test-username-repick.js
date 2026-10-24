// Username repick: setUsername clears the flag, and a shared name stays
// with the linked, higher-scoring, more recently active account.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { groupUsernames, summaryCounts } = require('../functions/scripts/backfill_usernames');
const { registerOnboarding } = require('../functions/src/onboardingApi');
const { resolveSolverName } = require('../functions/src/satoshiFavor');
const repick = require('../username-repick');
const secondFactor = require('../functions/src/secondFactor');

process.env.DELETE_RATE_IP_SECRET = 'username-repick-test-secret-value-32';

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        const pending = fn();
        if (pending && typeof pending.then === 'function') {
            return pending.then(function () {
                console.log('✅ ' + name);
                passed++;
            }).catch(function (e) {
                console.log('❌ ' + name + ': ' + e.message);
                failed++;
            });
        }
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
    return Promise.resolve();
}

const DELETE = { __op: 'delete' };

function applyPatch(prev, data, merge) {
    const next = merge ? Object.assign({}, prev || {}) : {};
    Object.keys(data || {}).forEach(function (key) {
        const value = data[key];
        if (value && value.__op === 'delete') delete next[key];
        else next[key] = value;
    });
    return next;
}

function memDb(initial) {
    const store = Object.assign({}, initial || {});
    function snap(docPath) {
        const data = store[docPath];
        return {
            exists: data !== undefined,
            id: docPath.split('/').pop(),
            data: function () { return data ? Object.assign({}, data) : undefined; },
        };
    }
    function docRef(docPath) {
        return {
            path: docPath,
            id: docPath.split('/').pop(),
            get: function () { return Promise.resolve(snap(docPath)); },
        };
    }
    function write(ref, data, mode) {
        const prev = store[ref.path];
        if (mode === 'update' && prev === undefined) {
            const err = new Error('not found');
            err.code = 'not-found';
            throw err;
        }
        const merge = mode === 'merge' || mode === 'update';
        store[ref.path] = applyPatch(prev, data, merge);
    }
    return {
        store: store,
        db: {
            collection: function (name) {
                return { doc: function (id) { return docRef(name + '/' + id); } };
            },
            runTransaction: async function (fn) {
                const tx = {
                    get: function (target) { return target.get(); },
                    set: function (ref, data, opts) { write(ref, data, opts && opts.merge ? 'merge' : 'set'); },
                    update: function (ref, data) { write(ref, data, 'update'); },
                };
                return fn(tx);
            },
        },
    };
}

function HttpsError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

const functionsV1 = {
    runWith: function () {
        return { https: { onCall: function (fn) { return fn; } } };
    },
    https: { HttpsError: HttpsError },
};

const admin = {
    firestore: {
        FieldValue: {
            delete: function () { return DELETE; },
            serverTimestamp: function () { return { __op: 'ts' }; },
        },
    },
};

function contextFor(uid) {
    return {
        auth: {
            uid: uid,
            token: { firebase: { sign_in_provider: 'google.com' } },
        },
        rawRequest: { headers: { 'x-forwarded-for': '203.0.113.9' } },
    };
}

secondFactor.stamp = function (data, context) { return context || {}; };
secondFactor.requireSecondFactor = async function () {};

function handler(mem) {
    const api = registerOnboarding({ db: mem.db, admin: admin, functionsV1: functionsV1 });
    return { setUsername: api.setUsername };
}

const queue = [];

queue.push(test('setUsername clears usernameNeedsRepick on the user and the public profile', async function () {
    const mem = memDb({
        'usernames_meta/backfill': { applied: true },
        'users/user1': { usernameNeedsRepick: true, points: 12 },
        'public_profiles/user1': { usernameNeedsRepick: true, points: 12 },
    });
    const out = await handler(mem).setUsername({ name: 'QuestFan' }, contextFor('user1'));
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.username, 'QuestFan');
    const user = mem.store['users/user1'];
    const profile = mem.store['public_profiles/user1'];
    assert.strictEqual(user.username, 'QuestFan');
    assert.strictEqual(user.username_lower, 'questfan');
    assert.strictEqual(user.points, 12);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(user, 'usernameNeedsRepick'), false);
    assert.strictEqual(profile.username, 'QuestFan');
    assert.strictEqual(profile.username_lower, 'questfan');
    assert.strictEqual(profile.points, 12);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(profile, 'usernameNeedsRepick'), false);
    assert.strictEqual(mem.store['usernames/questfan'].uid, 'user1');
    const rates = Object.keys(mem.store).filter(function (key) { return key.indexOf('rate_limits/') === 0; });
    assert.ok(rates.length >= 2, 'uid and IP rate limits still run');
}));

queue.push(test('setUsername does not create a public profile just to clear the flag', async function () {
    const mem = memDb({
        'usernames_meta/backfill': { applied: true },
        'users/user2': { usernameNeedsRepick: true },
    });
    const out = await handler(mem).setUsername({ name: 'QuestFan' }, contextFor('user2'));
    assert.strictEqual(out.username, 'QuestFan');
    assert.strictEqual(mem.store['public_profiles/user2'], undefined);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(mem.store['users/user2'], 'usernameNeedsRepick'), false);
}));

queue.push(test('a taken name leaves the repick flag in place', async function () {
    const mem = memDb({
        'usernames_meta/backfill': { applied: true },
        'users/user1': { usernameNeedsRepick: true },
        'public_profiles/user1': { usernameNeedsRepick: true },
        'usernames/takenname': { uid: 'other', atMs: Date.now() },
    });
    let threw = null;
    try {
        await handler(mem).setUsername({ name: 'TakenName' }, contextFor('user1'));
    } catch (e) {
        threw = e;
    }
    assert.ok(threw);
    assert.ok(String(threw.message).indexOf('already taken') !== -1);
    assert.strictEqual(mem.store['users/user1'].usernameNeedsRepick, true);
    assert.strictEqual(mem.store['public_profiles/user1'].usernameNeedsRepick, true);
    assert.strictEqual(mem.store['users/user1'].username, undefined);
    const rates = Object.keys(mem.store).filter(function (key) { return key.indexOf('rate_limits/') === 0; });
    assert.ok(rates.length >= 1);
}));

queue.push(test('a missing backfill marker refuses the write and keeps the flag', async function () {
    const mem = memDb({
        'users/user1': { usernameNeedsRepick: true },
        'public_profiles/user1': { usernameNeedsRepick: true },
    });
    let threw = null;
    try {
        await handler(mem).setUsername({ name: 'QuestFan' }, contextFor('user1'));
    } catch (e) {
        threw = e;
    }
    assert.ok(threw);
    assert.ok(String(threw.message).indexOf('catching up') !== -1);
    assert.strictEqual(mem.store['users/user1'].usernameNeedsRepick, true);
    assert.strictEqual(mem.store['usernames/questfan'], undefined);
    const rates = Object.keys(mem.store).filter(function (key) { return key.indexOf('rate_limits/') === 0; });
    assert.ok(rates.length >= 1, 'the rate limit still runs before the marker read');
}));

queue.push(test('a linked account keeps a shared name ahead of an older guest', function () {
    const grouped = groupUsernames([
        { uid: 'guest', lower: 'alice', created: 100, isAnonymous: true, points: 1, col: 'users' },
        { uid: 'mail', lower: 'alice', created: 900, email: 'kept-out-of-logs@example.com', points: 1, col: 'users' },
    ]);
    assert.strictEqual(grouped.unique.get('alice'), 'mail');
    assert.strictEqual(grouped.repicks[0].uid, 'guest');
    const google = groupUsernames([
        { uid: 'oldGuest', lower: 'bob', created: 10, anon: true },
        { uid: 'google', lower: 'bob', created: 800, providers: ['google.com'] },
    ]);
    assert.strictEqual(google.unique.get('bob'), 'google');
}));

queue.push(test('more points beat an older account when neither is linked', function () {
    const grouped = groupUsernames([
        { uid: 'old', lower: 'cara', created: 100, points: 1 },
        { uid: 'rich', lower: 'cara', created: 900, points: 50 },
    ]);
    assert.strictEqual(grouped.unique.get('cara'), 'rich');
    assert.strictEqual(grouped.repicks[0].uid, 'old');
}));

queue.push(test('newer activity wins when points tie, and age is only the last tiebreaker', function () {
    const active = groupUsernames([
        { uid: 'quiet', lower: 'dana', created: 100, points: 10, lastActive: 1000 },
        { uid: 'recent', lower: 'dana', created: 900, points: 10, lastSeen: 5000 },
    ]);
    assert.strictEqual(active.unique.get('dana'), 'recent');
    const aged = groupUsernames([
        { uid: 'newer', lower: 'erin', created: 500, points: 10, lastActive: 1000, email: 'a@example.com' },
        { uid: 'older', lower: 'erin', created: 100, points: 10, lastActive: 1000, providers: ['google.com'] },
    ]);
    assert.strictEqual(aged.unique.get('erin'), 'older');
    const tied = groupUsernames([
        { uid: 'b', lower: 'sam', created: 5, points: 3, lastActive: 9 },
        { uid: 'a', lower: 'sam', created: 5, points: 3, lastActive: 9 },
    ]);
    assert.strictEqual(tied.unique.get('sam'), 'a');
    const counts = summaryCounts('dry-run', 4, tied);
    assert.deepStrictEqual(Object.keys(counts).sort(), ['collisionGroups', 'distinctNames', 'mode', 'profilesSeen', 'repicks', 'unique']);
    assert.strictEqual(JSON.stringify(counts).indexOf('@'), -1);
    assert.strictEqual(JSON.stringify(counts).indexOf('example.com'), -1);
}));

queue.push(test('backfill scripts stay dry-run and print counts only', function () {
    const script = fs.readFileSync(path.join(root, 'functions/scripts/backfill_usernames.js'), 'utf8');
    const anon = fs.readFileSync(path.join(root, 'functions/scripts/backfill_usernames_anon.js'), 'utf8');
    assert.ok(script.includes("indexOf('--apply')"));
    assert.ok(script.includes('before the front end ships'));
    assert.ok(script.includes('applied: true'));
    assert.ok(script.includes('Do not re-apply this over the Oct 23'));
    assert.ok(script.includes('apply is disabled'));
    assert.ok(!script.includes('batch.commit'));
    assert.ok(!script.includes('collision uids='));
    assert.ok(script.includes('JSON.stringify(summaryCounts'));
    assert.ok(anon.includes("require('./backfill_usernames')"));
    assert.ok(!anon.includes('function compareHolders'));
    assert.ok(!anon.includes('function groupUsernames'));
    assert.ok(!anon.includes('collision uids='));
    assert.ok(!anon.includes('console.log') || anon.indexOf('email') === -1);
}));

queue.push(test('the repick prompt is required only after a real name was lost', function () {
    const guest = { isAnonymous: true };
    const person = { isAnonymous: false };
    assert.strictEqual(repick.usernameRepickNeeded({ usernameNeedsRepick: true }, guest), true);
    assert.strictEqual(repick.usernameRepickNeeded({ onboardingComplete: true }, guest), false);
    assert.strictEqual(repick.usernameRepickNeeded({ introSeen: true }, guest), false);
    assert.strictEqual(repick.usernameRepickNeeded({}, guest), false);
    assert.strictEqual(repick.usernameRepickNeeded({ onboardingComplete: true }, person), true);
    assert.strictEqual(repick.usernameRepickNeeded({ introSeen: true }, person), true);
    assert.strictEqual(repick.usernameRepickNeeded({}, person), false);
    assert.strictEqual(repick.usernameRepickNeeded({ username: 'QuestFan' }, person), false);
    assert.strictEqual(repick.usernameRepickNeeded({ username: 'QuestFan', usernameNeedsRepick: true }, person), true);
    assert.strictEqual(repick.usernameRepickNeeded({ usernameNeedsRepick: true, _isLocal: true }, person), false);
    assert.strictEqual(repick.usernameRepickNeeded({ usernameNeedsRepick: true }, null), false);
    assert.strictEqual(repick.leaderboardDisplayName('Alice', 'Bob'), 'Alice');
    assert.strictEqual(repick.leaderboardDisplayName('Anonymous', 'SatoshiFan'), 'SatoshiFan');
    assert.strictEqual(repick.leaderboardDisplayName('Anon', 'SatoshiFan'), 'SatoshiFan');
    assert.strictEqual(repick.leaderboardDisplayName('', ''), 'Anon');
    assert.strictEqual(repick.leaderboardDisplayName('  ', 'RealName'), 'RealName');
}));

queue.push(test('the client prompt cannot be skipped and calls setUsername', function () {
    const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    const start = ranking.indexOf('function showUsernameRepickPrompt');
    const end = ranking.indexOf('function maybeShowUsernameRepick');
    const body = ranking.slice(start, end);
    assert.ok(start > 0 && end > start);
    assert.ok(body.includes('Your username needs updating. Please pick a new one'));
    assert.ok(body.includes('>Sign out</button>'));
    assert.ok(body.includes('id="usernameRepickSignOut"'));
    assert.ok(!body.includes('Skip for now'));
    assert.ok(ranking.includes('Too many username attempts. Try again in an hour, or sign out.'));
    assert.ok(ranking.includes('Two-factor sign-in is required before this name can be saved.'));
    assert.ok(ranking.includes('usernameRepickFailure(e)'));
    assert.ok(ranking.includes('_pubNamePending'));
    assert.ok(body.includes("e.key === 'Escape'"));
    assert.ok(body.includes('preventDefault'));
    assert.ok(ranking.includes('applyServerUsername(name)'));
    assert.ok(ranking.includes('maybeShowUsernameRepick();\n        updateAuthButton();'));
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.ok(html.indexOf('username-repick.js?v=20261024_v2352') < html.indexOf('ranking.js?v=20261024_v2352'));
    const favor = fs.readFileSync(path.join(root, 'satoshi-favor.js'), 'utf8');
    const quests = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
    assert.ok(favor.includes('patchBlankProfileNames'));
    assert.ok(favor.includes('data-blank-name'));
    assert.ok(quests.includes('patchBlankProfileNames'));
    assert.ok(ranking.includes('patchBlankProfileNames(root)'));
}));

queue.push(test('Satoshi\'s Favor fills a blank solver name from the public profile', function () {
    assert.strictEqual(resolveSolverName('Anonymous', 'SatoshiFan'), 'SatoshiFan');
    assert.strictEqual(resolveSolverName('Anon', 'SatoshiFan'), 'SatoshiFan');
    assert.strictEqual(resolveSolverName('', ''), 'Anonymous');
    assert.strictEqual(resolveSolverName('QuestFan', 'Other'), 'QuestFan');
    const favor = fs.readFileSync(path.join(root, 'functions/src/satoshiFavor.js'), 'utf8');
    const start = favor.indexOf('// Get username');
    const end = favor.indexOf('const rigNum');
    const block = favor.slice(start, end);
    assert.ok(block.includes('data.username from the client is ignored'));
    assert.ok(!block.includes('data.username ||'));
    assert.ok(!block.includes('displayName'));
    assert.ok(block.includes("collection('public_profiles')"));
    assert.ok(block.includes('resolveSolverName'));
    const api = fs.readFileSync(path.join(root, 'functions/src/onboardingApi.js'), 'utf8');
    const setAt = api.indexOf('async function setUsername');
    const setEnd = api.indexOf('return { ok: true, username: saved.username', setAt);
    const setBody = api.slice(setAt, setEnd);
    assert.strictEqual((setBody.match(/usernameNeedsRepick: admin\.firestore\.FieldValue\.delete\(\)/g) || []).length, 2);
    assert.ok(setBody.includes("collection('public_profiles')"));
}));

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
