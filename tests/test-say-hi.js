#!/usr/bin/env node
// Daily Say hi: server decides the day, the message, and the reward.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const sayHi = require(path.join(root, 'functions/src/sayHi'));
const reg = require(path.join(root, 'features.registry.js'));

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) {
    queue.push(Promise.resolve().then(fn).then(function () {
        passed++;
        console.log('  ok  ' + name);
    }).catch(function (e) {
        failed++;
        console.log('  FAIL ' + name + ': ' + (e && e.stack ? e.stack : e));
    }));
}

function HttpsError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

function createWorld(seed) {
    const clock = { ms: Date.parse('2026-10-22T12:00:00Z') };
    const docs = Object.assign({}, seed || {});
    function apply(pathKey, data, merge) {
        const cur = merge ? Object.assign({}, docs[pathKey] || {}) : {};
        Object.keys(data || {}).forEach(function (k) {
            const v = data[k];
            if (v && v._inc != null) cur[k] = (Number(cur[k]) || 0) + v._inc;
            else cur[k] = v;
        });
        docs[pathKey] = cur;
    }
    function ref(pathKey) {
        return {
            path: pathKey,
            collection: function (name) { return col(pathKey + '/' + name); },
        };
    }
    function col(pathKey) {
        return { doc: function (id) { return ref(pathKey + '/' + id); } };
    }
    function snap(pathKey) {
        const data = docs[pathKey];
        return {
            exists: data != null,
            data: function () { return data ? Object.assign({}, data) : undefined; },
        };
    }
    const admin = {
        firestore: {
            FieldValue: {
                serverTimestamp: function () {
                    const ms = clock.ms;
                    return { _server: true, toMillis: function () { return ms; } };
                },
                increment: function (n) { return { _inc: n }; },
            },
        },
    };
    const db = {
        collection: function (name) { return col(name); },
        runTransaction: async function (fn) {
            const writes = [];
            const tx = {
                get: async function (r) { return snap(r.path); },
                set: function (r, data, opts) { writes.push({ path: r.path, data: data, merge: !!(opts && opts.merge) }); },
                update: function (r, data) { writes.push({ path: r.path, data: data, merge: true }); },
            };
            const result = await fn(tx);
            writes.forEach(function (w) { apply(w.path, w.data, w.merge); });
            return result;
        },
    };
    const handlers = sayHi.createSayHiHandlers({
        admin: admin,
        db: db,
        now: function () { return clock.ms; },
        HttpsError: HttpsError,
    });
    return { clock: clock, docs: docs, handlers: handlers };
}

function auth(uid) {
    return { auth: { uid: uid, token: { firebase: { sign_in_provider: 'password' } } } };
}

function baseClaim(over) {
    const now = Date.parse('2026-10-22T12:00:00Z');
    return Object.assign({
        authed: true,
        anonymous: false,
        rateLimited: false,
        userExists: true,
        user: {},
        ledger: {},
        claimExists: false,
        claimedDay: '',
        claimedMessageId: '',
        armedDay: '2026-10-22',
        armedAtMs: now - 5000,
        toastSeen: false,
        today: '2026-10-22',
        uid: 'user1',
        messageId: 'msg_hello1',
        message: { uid: 'user1', text: 'hi', isNachoAuto: false },
        messageMs: now - 1000,
        nowMs: now,
        dailyUsed: 0,
        pendingOverflow: 0,
        lastOverflowDate: '',
    }, over || {});
}

test('server date uses 5 AM UTC, never a client clock', function () {
    assert.strictEqual(sayHi.offsetDateKey(Date.parse('2026-10-22T04:30:00Z')), '2026-10-21');
    assert.strictEqual(sayHi.offsetDateKey(Date.parse('2026-10-22T05:30:00Z')), '2026-10-22');
});

test('message text must be a real hello', function () {
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ message: { uid: 'user1', text: '' } })).code, 'empty');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ message: { uid: 'user1', text: '   \n\t ' } })).code, 'empty');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ message: { uid: 'user1', text: 'a' } })).code, 'short');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ message: { uid: 'user1', text: '!!!' } })).code, 'short');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ message: { uid: 'user1', text: '[link removed]' } })).code, 'empty');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ message: { uid: 'user1', text: 'aaaaaaa' } })).code, 'short');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ message: { uid: 'user1', text: 'hi' } })).code, 'ok');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ message: { uid: 'user1', text: 'hi!' } })).code, 'ok');
    const gif = { uid: 'user1', text: 'https://example.com/a.gif', isGif: true };
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ message: gif })).code, 'empty');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ message: Object.assign({ caption: 'yo' }, gif) })).code, 'ok');
});

test('message must belong to this uid, after the button press, on the server day', function () {
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ message: { uid: 'other', text: 'hi' } })).code, 'not-owner');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ message: { uid: 'user1', text: 'hi', isNachoAuto: true } })).code, 'not-real');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ message: { uid: 'nacho-bot', text: 'hi' } })).code, 'not-owner');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ message: { uid: 'system', text: 'hi' } })).code, 'not-owner');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ message: { uid: 'user1', text: 'hi', source: 'telegram' } })).code, 'not-real');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ message: { uid: 'user1', text: 'hi', isSystemPost: true } })).code, 'not-real');
    const now = Date.parse('2026-10-22T12:00:00Z');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({
        armedAtMs: now - 1000,
        messageMs: now - 60000,
    })).code, 'before-press');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({
        messageMs: Date.parse('2026-10-21T12:00:00Z'),
    })).code, 'not-today');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ armedDay: '2026-10-21' })).code, 'no-arm');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ message: null })).code, 'no-message');
});

test('banned, linked, and already-claimed accounts do not get another grant', function () {
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ user: { satsDisabled: true } })).code, 'unavailable');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ user: { banned: true } })).code, 'unavailable');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ ledger: { banned: true } })).code, 'unavailable');
    assert.strictEqual(sayHi.assessSayHiArm({ authed: true, userExists: true, user: { satsDisabled: true }, today: '2026-10-22' }).code, 'unavailable');
    const again = sayHi.assessSayHiClaim(baseClaim({ claimExists: true, toastSeen: false }));
    assert.strictEqual(again.alreadyClaimed, true);
    assert.strictEqual(again.showToast, false);
    assert.strictEqual(again.ok, false);
    const first = sayHi.assessSayHiClaim(baseClaim({ toastSeen: false }));
    assert.strictEqual(first.showToast, true);
    assert.strictEqual(first.xp.awarded, 50);
    assert.strictEqual(first.xp.tickets, 1);
    const later = sayHi.assessSayHiClaim(baseClaim({ toastSeen: true }));
    assert.strictEqual(later.showToast, false);
    assert.strictEqual(later.ok, true);
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ claimedMessageId: 'msg_hello1' })).code, 'duplicate');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ authed: false })).code, 'signed-out');
    assert.strictEqual(sayHi.assessSayHiClaim(baseClaim({ anonymous: true })).code, 'signed-out');
});

test('daily cap still grants the ticket when XP overflows', function () {
    const full = sayHi.assessSayHiClaim(baseClaim({ dailyUsed: 1000 }));
    assert.strictEqual(full.xp.awarded, 0);
    assert.strictEqual(full.xp.tickets, 1);
    assert.strictEqual(full.ok, true);
    const partial = sayHi.planSayHiXp(980, 40, '2026-10-21', '2026-10-22');
    assert.strictEqual(partial.awarded, 12);
    assert.strictEqual(partial.overflowAdded, 0);
    assert.strictEqual(partial.overflowRedeemed, 0);
    assert.strictEqual(partial.tickets, 1);
});

test('handlers refuse signed-out and anonymous callers', async function () {
    const world = createWorld();
    for (const call of [world.handlers.armSayHi, world.handlers.claimSayHi]) {
        await assert.rejects(function () { return call({}, {}); }, function (e) { return e.code === 'unauthenticated'; });
        await assert.rejects(function () {
            return call({}, { auth: { uid: 'user1', token: { firebase: { sign_in_provider: 'anonymous' } } } });
        }, function (e) { return e.code === 'unauthenticated'; });
    }
    assert.strictEqual(world.docs['users/user1'], undefined);
});

test('claim grants once per uid per server day and ignores client xp, text, and day', async function () {
    const now = Date.parse('2026-10-22T12:00:00Z');
    const world = createWorld({
        'users/user1': {
            points: 100,
            orangeTickets: 2,
            sayHiArmedDay: '2026-10-22',
            sayHiArmedAt: now - 5000,
        },
        'global_chat/msg_hello1': { uid: 'user1', text: 'hi', ts: now - 1000, isNachoAuto: false },
    });
    const hostile = {
        messageId: 'msg_hello1',
        text: 'not the stored message',
        xp: 9999,
        tickets: 40,
        day: '1999-01-01',
        showToast: true,
    };
    const first = await world.handlers.claimSayHi(hostile, auth('user1'));
    assert.strictEqual(first.success, true);
    assert.strictEqual(first.code, 'ok');
    assert.strictEqual(first.day, '2026-10-22');
    assert.strictEqual(first.xpAwarded, 50);
    assert.strictEqual(first.tickets, 1);
    assert.strictEqual(first.showToast, true);
    assert.strictEqual(world.docs['users/user1'].points, 150);
    assert.strictEqual(world.docs['users/user1'].orangeTickets, 3);
    assert.strictEqual(world.docs['users/user1'].sayHiToastSeen, true);
    assert.strictEqual(world.docs['users/user1'].sayHiClaimedDay, '2026-10-22');
    assert.ok(world.docs['users/user1/daily_action_counts/2026-10-22_say_hi']);
    assert.strictEqual(world.docs['users/user1/daily_points/2026-10-22'].total, 50);

    world.clock.ms = now + 4000;
    const second = await world.handlers.claimSayHi({ messageId: 'msg_hello1', xp: 9999, day: '1999-01-01' }, auth('user1'));
    assert.strictEqual(second.success, true);
    assert.strictEqual(second.alreadyClaimed, true);
    assert.strictEqual(second.showToast, false);
    assert.strictEqual(second.tickets, 0);
    assert.strictEqual(world.docs['users/user1'].points, 150);
    assert.strictEqual(world.docs['users/user1'].orangeTickets, 3);
});

test('a short stored message is not rewarded just because the client says so', async function () {
    const now = Date.parse('2026-10-22T12:00:00Z');
    const world = createWorld({
        'users/user1': { points: 10, orangeTickets: 0, sayHiArmedDay: '2026-10-22', sayHiArmedAt: now - 5000 },
        'global_chat/msg_short1': { uid: 'user1', text: '   x  ', ts: now - 1000 },
    });
    const res = await world.handlers.claimSayHi({ messageId: 'msg_short1', text: 'hello there', xp: 50, day: '2026-10-22' }, auth('user1'));
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'short');
    assert.strictEqual(world.docs['users/user1'].points, 10);
    assert.strictEqual(world.docs['users/user1/daily_action_counts/2026-10-22_say_hi'], undefined);
});

test('message before the button press, wrong owner, and bans write nothing', async function () {
    const now = Date.parse('2026-10-22T12:00:00Z');
    const early = createWorld({
        'users/user1': { points: 10, sayHiArmedDay: '2026-10-22', sayHiArmedAt: now - 1000 },
        'global_chat/msg_early1': { uid: 'user1', text: 'hello', ts: now - 60000 },
    });
    const before = await early.handlers.claimSayHi({ messageId: 'msg_early1' }, auth('user1'));
    assert.strictEqual(before.code, 'before-press');
    assert.strictEqual(early.docs['users/user1'].points, 10);

    const other = createWorld({
        'users/user1': { points: 10, sayHiArmedDay: '2026-10-22', sayHiArmedAt: now - 5000 },
        'global_chat/msg_other1': { uid: 'someone', text: 'hello', ts: now - 1000 },
    });
    const stolen = await other.handlers.claimSayHi({ messageId: 'msg_other1' }, auth('user1'));
    assert.strictEqual(stolen.code, 'not-owner');
    assert.strictEqual(other.docs['users/user1'].points, 10);

    for (const user of [{ satsDisabled: true }, { banned: true }]) {
        const world = createWorld({
            'users/user1': Object.assign({ points: 10, sayHiArmedDay: '2026-10-22', sayHiArmedAt: now - 5000 }, user),
            'faucet_ledger/user1': {},
            'global_chat/msg_hello1': { uid: 'user1', text: 'hello', ts: now - 1000 },
        });
        const res = await world.handlers.claimSayHi({ messageId: 'msg_hello1' }, auth('user1'));
        assert.strictEqual(res.code, 'unavailable');
        assert.strictEqual(world.docs['users/user1'].points, 10);
        assert.strictEqual(world.docs['users/user1/daily_action_counts/2026-10-22_say_hi'], undefined);
    }
    const linked = createWorld({
        'users/user1': { points: 10, sayHiArmedDay: '2026-10-22', sayHiArmedAt: now - 5000 },
        'faucet_ledger/user1': { banned: true },
        'global_chat/msg_hello1': { uid: 'user1', text: 'hello', ts: now - 1000 },
    });
    const banned = await linked.handlers.claimSayHi({ messageId: 'msg_hello1' }, auth('user1'));
    assert.strictEqual(banned.code, 'unavailable');
    assert.strictEqual(linked.docs['users/user1'].points, 10);
});

test('arm records a server timestamp once and the callable is rate limited', async function () {
    const world = createWorld({ 'users/user1': { points: 10 } });
    const first = await world.handlers.armSayHi({ day: '1999-01-01' }, auth('user1'));
    assert.strictEqual(first.success, true);
    assert.strictEqual(first.code, 'armed');
    assert.strictEqual(first.day, '2026-10-22');
    assert.strictEqual(first.showToast, false);
    const stamped = world.docs['users/user1'].sayHiArmedAt.toMillis();
    world.clock.ms += 1000;
    const limited = await world.handlers.armSayHi({}, auth('user1'));
    assert.strictEqual(limited.code, 'rate');
    assert.strictEqual(world.docs['users/user1'].sayHiArmedAt.toMillis(), stamped);
    world.clock.ms += 4000;
    const again = await world.handlers.armSayHi({}, auth('user1'));
    assert.strictEqual(again.code, 'armed');
    assert.strictEqual(world.docs['users/user1'].sayHiArmedAt.toMillis(), stamped);
    assert.strictEqual(world.docs['users/user1'].points, 10);
});

test('arming does not block the claim that follows it', async function () {
    const now = Date.parse('2026-10-22T12:00:00Z');
    const world = createWorld({ 'users/user1': { points: 5, orangeTickets: 0 } });
    const armed = await world.handlers.armSayHi({}, auth('user1'));
    assert.strictEqual(armed.code, 'armed');
    world.docs['global_chat/msg_quick01'] = { uid: 'user1', text: 'hi', ts: world.clock.ms, isNachoAuto: false };
    world.clock.ms += 500;
    const claimed = await world.handlers.claimSayHi({ messageId: 'msg_quick01', day: '1999-01-01', xp: 1 }, auth('user1'));
    assert.strictEqual(claimed.code, 'ok');
    assert.strictEqual(claimed.day, '2026-10-22');
    assert.strictEqual(world.docs['users/user1'].points, 55);
    assert.strictEqual(world.docs['users/user1'].orangeTickets, 1);
});

test('reusing yesterday\'s message id does not count as today', async function () {
    const now = Date.parse('2026-10-22T12:00:00Z');
    const world = createWorld({
        'users/user1': {
            points: 40,
            sayHiClaimedMessageId: 'msg_hello1',
            sayHiClaimedDay: '2026-10-21',
            sayHiArmedDay: '2026-10-22',
            sayHiArmedAt: now - 5000,
            sayHiToastSeen: true,
        },
        'global_chat/msg_hello1': { uid: 'user1', text: 'hello again', ts: now - 1000 },
    });
    const res = await world.handlers.claimSayHi({ messageId: 'msg_hello1' }, auth('user1'));
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'duplicate');
    assert.strictEqual(world.docs['users/user1'].points, 40);
});

test('rules and callable source keep the reward on the server', function () {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const users = rules.slice(rules.indexOf('match /users/{userId} {'), rules.indexOf('match /users/{userId}/daily_points'));
    ['points', 'orangeTickets', 'sayHiArmedDay', 'sayHiArmedAt', 'sayHiClaimedDay', 'sayHiClaimedMessageId', 'sayHiToastSeen'].forEach(function (field) {
        assert.ok(users.includes("'" + field + "'"), 'denylist missing ' + field);
    });
    assert.ok(users.includes('request.auth.uid == userId'));
    const createBlock = users.slice(users.indexOf('allow create:'), users.indexOf('allow update:'));
    assert.ok(!createBlock.includes('sayHi'));
    const actions = rules.slice(rules.indexOf('match /users/{userId}/daily_action_counts/{docId}'), rules.indexOf('match /users/{userId}/badge_awards'));
    assert.ok(actions.includes('request.auth.uid == userId'));
    assert.ok(actions.includes('allow write: if false'));
    const rates = rules.slice(rules.indexOf('match /rate_limits/{docId}'), rules.indexOf('match /{document=**}'));
    assert.ok(rates.includes('allow read, write: if false'));

    const src = fs.readFileSync(path.join(root, 'functions/src/sayHi.js'), 'utf8');
    const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    assert.ok(src.includes('enforceAppCheck: true'));
    assert.ok(src.includes('runTransaction'));
    assert.ok(src.includes('offsetDateKey'));
    assert.ok(!src.includes('data.day') && !src.includes('data.xp') && !src.includes('data.text'));
    assert.ok(index.includes('exports.armSayHi'));
    assert.ok(index.includes('exports.claimSayHi'));
    assert.ok(index.includes('bindSayHi'));
    const claimSats = index.slice(index.indexOf('exports.claimSats'), index.indexOf('exports.claimSats') + 400);
    assert.ok(claimSats.includes('enforceAppCheck: true'));
});

test('client names a message id and does not render user text or hold a secret', function () {
    const gc = fs.readFileSync(path.join(root, 'global-chat.js'), 'utf8');
    const section = gc.slice(gc.indexOf('// SAY-HI START'), gc.indexOf('// SAY-HI END'));
    assert.ok(section.length > 200);
    assert.strictEqual(section.includes('innerHTML'), false);
    assert.ok(section.includes('textContent'));
    assert.ok(section.includes('getToken(false)'));
    assert.ok(section.includes('window._sayHiArmPromise'));
    assert.ok(section.includes('window._sayHiArmPromise || Promise.resolve()'));
    assert.ok(section.includes("claimSayHi"));
    const armRateAt = section.indexOf("data.code === 'rate'");
    const armRate = section.slice(armRateAt, section.indexOf('return data;', armRateAt));
    assert.ok(armRate.indexOf('Slow down') === -1, 'arm rate stays silent');
    assert.ok(section.includes('messageId: messageId'));
    assert.ok(!section.includes('awardPoints'));
    assert.ok(!section.includes(".collection('users')"));
    assert.ok(!/api[_-]?key|private_key|BEGIN PRIVATE|nsec1|nwc:|\bsecret\b/i.test(section));
    assert.ok(gc.includes('window.openSayHi = function'));
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.strictEqual(html, fs.readFileSync(path.join(root, '404.html'), 'utf8'));
    assert.ok(html.includes('id="sayHiBtn"'));
    assert.ok(html.includes('openSayHi()'));
    assert.ok(html.includes('#em-quick-actions { display:grid; gap:8px; grid-template-columns: repeat(6, minmax(0, 1fr)); }'));
    assert.ok(html.includes('@media (max-width: 480px)') && html.includes('#em-quick-actions { grid-template-columns: repeat(3, minmax(0, 1fr)); }'));
    assert.ok(html.includes("const CACHE_NAME = 'btc-archive-v2301'") === false);
    assert.ok(html.includes("const CACHE_NAME = 'btc-archive-v2295'") === false);
    assert.ok(html.includes("const CACHE_NAME = 'btc-archive-v2293'") === false);
    assert.ok(html.includes("const CACHE_NAME = 'btc-archive-v2272'") === false);
    assert.ok(html.includes("const CACHE_NAME = 'btc-archive-v2271'") === false);
    assert.ok(html.includes("const CACHE_NAME = 'btc-archive-v2268'") === false);
    assert.ok(html.includes("const CACHE_NAME = 'btc-archive-v2266'") === false);
    assert.ok(html.includes("const CACHE_NAME = 'btc-archive-v2265'") === false);
    assert.ok(html.includes("const CACHE_NAME = 'btc-archive-v2279'") === false);
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2399'"));
    assert.ok(!sw.includes('btc-archive-v2391'));
    assert.ok(!sw.includes('btc-archive-v2386'));
    assert.ok(!sw.includes('btc-archive-v2410'));
    assert.ok(!sw.includes('btc-archive-v2385'));
    assert.ok(!sw.includes('btc-archive-v2425'));
    assert.ok(!sw.includes('btc-archive-v2384'));
    assert.ok(!sw.includes('btc-archive-v2412'));
    assert.ok(!sw.includes('btc-archive-v2383'));
    assert.ok(!sw.includes('btc-archive-v2420'));
    assert.ok(!sw.includes('btc-archive-v2382'));
    assert.ok(!sw.includes('btc-archive-v2381'));
    assert.ok(!sw.includes('btc-archive-v2380'));
    assert.ok(!sw.includes('btc-archive-v2407'));
    assert.ok(!sw.includes('btc-archive-v2379'));
    assert.ok(!sw.includes('btc-archive-v2378'));
    assert.ok(!sw.includes('btc-archive-v2394'));
    assert.ok(!sw.includes('btc-archive-v2378'));
    assert.ok(!sw.includes('btc-archive-v2377'));
    assert.ok(!sw.includes('btc-archive-v2376'));
    assert.ok(!sw.includes('btc-archive-v2375'));
    assert.ok(!sw.includes('btc-archive-v2374'));
    assert.ok(!sw.includes('btc-archive-v2370'));
    assert.ok(!sw.includes('btc-archive-v2373'));
    assert.ok(!sw.includes('btc-archive-v2372'));
    assert.ok(!sw.includes('btc-archive-v2371'));
    assert.ok(!sw.includes('btc-archive-v2370'));
    assert.ok(!sw.includes('btc-archive-v2369'));
    assert.ok(!sw.includes('btc-archive-v2368'));
    assert.ok(!sw.includes('btc-archive-v2367'));
    assert.ok(!sw.includes('btc-archive-v2366'));
    assert.ok(!sw.includes('btc-archive-v2365'));
    assert.ok(!sw.includes('btc-archive-v2364'));
    assert.ok(!sw.includes('btc-archive-v2372'));
    assert.ok(!sw.includes('btc-archive-v2368'));
    assert.ok(!sw.includes('btc-archive-v2362'));
    assert.ok(!sw.includes('btc-archive-v2361'));
    assert.ok(!sw.includes('btc-archive-v2360'));
    assert.ok(!sw.includes('btc-archive-v2359'));
    assert.ok(!sw.includes('btc-archive-v2358'));
    assert.ok(!sw.includes('btc-archive-v2357'));
    assert.ok(!sw.includes('btc-archive-v2356'));
    assert.ok(!sw.includes('btc-archive-v2355'));
    assert.ok(!sw.includes('btc-archive-v2354'));
    assert.ok(!sw.includes('btc-archive-v2353'));
    assert.ok(!sw.includes('btc-archive-v2352'));
    assert.ok(!sw.includes('btc-archive-v2351'));
    assert.ok(!sw.includes('btc-archive-v2350'));
    assert.ok(!sw.includes('btc-archive-v2349'));
    assert.ok(!sw.includes('btc-archive-v2348'));
    assert.ok(!sw.includes('btc-archive-v2347'));
    assert.ok(!sw.includes('btc-archive-v2346'));
    assert.ok(!sw.includes('btc-archive-v2345'));
    assert.ok(!sw.includes('btc-archive-v2344'));
    assert.ok(!sw.includes('btc-archive-v2343'));
    assert.ok(!sw.includes('btc-archive-v2342'));
    assert.ok(!sw.includes('btc-archive-v2340'));
    assert.ok(!sw.includes('btc-archive-v2341'));
    assert.ok(!sw.includes('btc-archive-v2339'));
    assert.ok(!sw.includes('btc-archive-v2338'));
    assert.ok(!sw.includes('btc-archive-v2334'));
    assert.ok(sw.includes('btc-archive-v2333') === false);
    assert.ok(sw.includes('btc-archive-v2332') === false);
    assert.ok(!sw.includes('btc-archive-v2331'));
    assert.ok(!sw.includes('btc-archive-v2330'));
    assert.ok(sw.includes('btc-archive-v2329') === false);
    assert.ok(sw.includes('btc-archive-v2327') === false);
    assert.ok(sw.includes('btc-archive-v2326') === false);
    assert.ok(sw.includes('btc-archive-v2325') === false);
    assert.ok(sw.includes('btc-archive-v2324') === false);
    assert.ok(sw.includes('btc-archive-v2322') === false);
    assert.ok(sw.includes('btc-archive-v2323') === false);
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2295'") === false);
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2293'") === false);
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2286'") === false);
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2279'") === false);
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2272'") === false);
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2271'") === false);
    assert.ok(sw.includes('nacho-fly.svg') === false);
    assert.ok(sw.includes('nacho-deer.svg'));
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2271'") === false);
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2268'") === false);
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2266'") === false);
    assert.ok(html.includes('ranking.js?v=20261027_v2394'));
    assert.ok(!html.includes('ranking.js?v=20261026_v2378'));
    assert.ok(!html.includes('ranking.js?v=20261026_v2400'));
    assert.ok(!html.includes('ranking.js?v=20261026_v2377'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2358'));
    assert.ok(!html.includes('ranking.js?v=20261026_v2367'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2361'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2357'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2356'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2355'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2354'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2352'));
    assert.ok(!html.includes('ranking.js?v=20261024_repickc'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2350'));
    assert.ok(!html.includes('ranking.js?v=20261024_repickb'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2351'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2349'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2342'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2341'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2334'));
    assert.ok(html.includes('ranking.js?v=20261023_v2333') === false);
    assert.ok(html.includes('id="sayHiBtnLabel">Say hi!</span>'));
    assert.ok(html.includes('Said hi') === false);
});

test('Nacho and search can open Say hi', function () {
    assert.strictEqual(reg.resolveNachoFeature('say hi to the community').featureId, 'say-hi');
    assert.strictEqual(reg.resolveNachoFeature('say hello').featureId, 'say-hi');
    assert.strictEqual(reg.resolveNachoFeature('what is the community challenge').featureId, 'community');
    const top = reg.searchFeatures('say hi').slice(0, 3).map(function (row) { return row.feature.id; });
    assert.strictEqual(top[0], 'say-hi');
    const feature = reg.BY_ID['say-hi'];
    assert.ok(feature.open.toString().includes('openSayHi'));
    assert.strictEqual(reg.featureByHash('app/say-hi').id, 'say-hi');
});

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
