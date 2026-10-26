// Usernames cannot contain whitespace. The server rejects it, one migration
// grant skips the daily rename wait, and a stale cached name retries once.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const { assessUsername, usernameMessage } = require('../functions/src/usernamePolicy');
const { registerOnboarding } = require('../functions/src/onboardingApi');
const migrate = require('../functions/scripts/migrate-username-spaces');
const secondFactor = require('../functions/src/secondFactor');

process.env.DELETE_RATE_IP_SECRET = 'username-spaces-test-secret-value-32';

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
                console.log('❌ ' + name + ': ' + (e && e.stack || e));
                failed++;
            });
        }
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack || e));
        failed++;
    }
    return Promise.resolve();
}

const DELETE = { __op: 'delete' };

function isDeleteSentinel(value) {
    if (!value || typeof value !== 'object') return false;
    if (value.__op === 'delete') return true;
    if (value._methodName === 'FieldValue.delete') return true;
    const name = value.constructor && value.constructor.name;
    return name === 'DeleteTransform' || name === 'FieldValueDelete';
}

function applyPatch(prev, data, merge) {
    const next = merge ? Object.assign({}, prev || {}) : {};
    Object.keys(data || {}).forEach(function (key) {
        const value = data[key];
        if (isDeleteSentinel(value)) {
            delete next[key];
            return;
        }
        if (value && value.__op === 'inc') {
            next[key] = (Number(next[key]) || 0) + value.n;
            return;
        }
        next[key] = value;
    });
    return next;
}

function memDb(initial) {
    const store = Object.assign({}, initial || {});
    function snap(docPath, ref) {
        const data = store[docPath];
        return {
            exists: data !== undefined,
            id: docPath.split('/').pop(),
            ref: ref,
            data: function () { return data ? Object.assign({}, data) : undefined; },
        };
    }
    function emptyList() {
        return Promise.resolve({ empty: true, docs: [], forEach: function () {}, size: 0 });
    }
    function docRef(docPath) {
        const ref = {
            path: docPath,
            id: docPath.split('/').pop(),
            get: function () { return Promise.resolve(snap(docPath, ref)); },
            update: function (data) {
                write(ref, data, 'update');
                return Promise.resolve();
            },
            collection: function () {
                return {
                    doc: function (id) { return docRef(docPath + '/sub/' + id); },
                    limit: function () { return { get: emptyList }; },
                    where: function () { return { limit: function () { return { get: emptyList }; } }; },
                };
            },
        };
        return ref;
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
    function query(col, field, value) {
        const q = {
            limit: function () { return q; },
            get: function () {
                const docs = [];
                Object.keys(store).forEach(function (docPath) {
                    const prefix = col + '/';
                    if (docPath.indexOf(prefix) !== 0) return;
                    const rest = docPath.slice(prefix.length);
                    if (rest.indexOf('/') !== -1) return;
                    const data = store[docPath] || {};
                    if (data[field] === value) {
                        docs.push({
                            id: rest,
                            data: function () { return Object.assign({}, data); },
                            ref: {
                                update: function (patch) {
                                    store[docPath] = applyPatch(store[docPath], patch, true);
                                    return Promise.resolve();
                                },
                            },
                        });
                    }
                });
                return Promise.resolve({ docs: docs, empty: docs.length === 0, size: docs.length });
            },
        };
        return q;
    }
    return {
        store: store,
        db: {
            collection: function (name) {
                return {
                    doc: function (id) { return docRef(name + '/' + id); },
                    where: function (field, op, value) { return query(name, field, value); },
                };
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
            increment: function (n) { return { __op: 'inc', n: n }; },
        },
    },
    auth: function () {
        return { getUser: async function () { return { providerData: [] }; } };
    },
};

function contextFor(uid) {
    return {
        auth: {
            uid: uid,
            token: { firebase: { sign_in_provider: 'google.com' } },
        },
        rawRequest: { headers: { 'x-forwarded-for': '203.0.113.50' } },
    };
}

secondFactor.stamp = function (data, context) { return context || {}; };
secondFactor.requireSecondFactor = async function () {};

function handler(mem) {
    return registerOnboarding({ db: mem.db, admin: admin, functionsV1: functionsV1 });
}

const WS = ['chill guy', 'chill\u00A0guy', 'chill\u200Bguy', 'chill\u200Cguy', 'chill\u200Dguy', 'chill\u2060guy', 'chill\uFEFFguy', 'a\u180Eb'];

const APPROVED = [
    ['➡️ ESCAPE INFLATION 4/24 7pm West Newton Cinema', 'ESCAPE_INFLATION_424'],
    ['Ahmed “ahmedibnhack” Ogundare', 'Ahmed_ahmedibnhack'],
    ['Anita Sarawagi***', 'Anita_Sarawagi'],
    ['Armin ₿osto', 'Armin_Bosto'],
    ['Bangkit r Saputra9958', 'Bangkit_r_Saputra995'],
    ['Ĵ.Ř Records', 'J.R_Records'],
    ['Project Daily Report Tracker', 'Project_Daily_Report'],
    ['Rounak “Ron” Mohanty', 'Rounak_Ron_Mohanty'],
    ['The Imperfect Perfectionista', 'The_Imperfect'],
    ['Tiến Bùi (Mr)', 'Tien_Bui_Mr'],
    ['Timothy "TimTayshun" Curry', 'Timothy_TimTayshun'],
];

function plannedName(old) {
    let base = migrate.convert(old);
    const plain = assessUsername(base, { allowReserved: true });
    if (!plain.ok && (plain.error === 'charset' || plain.error === 'long' || plain.error === 'html')) {
        base = migrate.sanitize(base);
    }
    return base;
}

const queue = [];

queue.push(test('whitespace, NBSP, and zero-width names are rejected with the space message', function () {
    WS.forEach(function (name) {
        const out = assessUsername(name, {});
        assert.strictEqual(out.ok, false, name);
        assert.strictEqual(out.error, 'spaces', JSON.stringify(name));
    });
    assert.strictEqual(usernameMessage('spaces'), 'Usernames cannot contain spaces. Try an underscore instead, like chill_guy.');
    assert.strictEqual(assessUsername('chill_guy', {}).ok, true);
    assert.strictEqual(assessUsername('chill-guy.2', {}).username, 'chill-guy.2');
    assert.strictEqual(assessUsername('ab', {}).error, 'short');
    assert.strictEqual(assessUsername('nope!', {}).error, 'charset');
    assert.ok(usernameMessage('charset').indexOf('spaces,') === -1);
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const shape = rules.slice(rules.indexOf('function profileShapeOk()'), rules.indexOf('function profileUpdateBlocked()') > rules.indexOf('function profileShapeOk()') ? rules.length : rules.indexOf('match /public_profiles/'));
    assert.ok(shape.includes("matches('^[a-zA-Z0-9_\\\\-\\\\.]+$')"));
    assert.ok(shape.indexOf('\\s') === -1);
    ['usernameFreeRename', 'usernameMigratedFrom', 'usernameMigratedAt'].forEach(function (field) {
        assert.ok(rules.includes("'" + field + "'"), field);
    });
}));

queue.push(test('setUsername rejects whitespace before it writes, including invisible characters', async function () {
    const mem = memDb({ 'usernames_meta/backfill': { applied: true }, 'users/user1': { points: 3 } });
    for (let i = 0; i < WS.length; i++) {
        let err = null;
        try {
            await handler(mem).setUsername({ name: WS[i] }, contextFor('user1'));
        } catch (e) { err = e; }
        assert.ok(err, WS[i]);
        assert.strictEqual(err.message, 'Usernames cannot contain spaces. Try an underscore instead, like chill_guy.');
    }
    assert.strictEqual(mem.store['users/user1'].username, undefined);
    assert.strictEqual(mem.store['usernames/chill_guy'], undefined);
}));

queue.push(test('a free-rename flag skips the daily wait once and is then cleared', async function () {
    const recent = Date.now() - 60 * 1000;
    const mem = memDb({
        'usernames_meta/backfill': { applied: true },
        'users/user1': {
            username: 'old_name',
            username_lower: 'old_name',
            usernameChangedAt: recent,
            usernameFreeRename: true,
            usernameMigratedFrom: 'spaced name',
            usernameMigratedAt: recent,
            points: 9,
        },
        'usernames/old_name': { uid: 'user1', atMs: recent },
        'public_profiles/user1': { username: 'old_name', points: 9, usernameMigratedFrom: 'spaced name' },
    });
    const out = await handler(mem).setUsername({ name: 'new_name' }, contextFor('user1'));
    assert.strictEqual(out.username, 'new_name');
    const user = mem.store['users/user1'];
    assert.strictEqual(user.username, 'new_name');
    assert.strictEqual(user.username_lower, 'new_name');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(user, 'usernameFreeRename'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(user, 'usernameMigratedFrom'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(user, 'usernameMigratedAt'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(mem.store['public_profiles/user1'], 'usernameMigratedFrom'), false);
    assert.strictEqual(user.points, 9);
    assert.ok(user.usernameChangedAt);
    assert.strictEqual(mem.store['usernames/new_name'].uid, 'user1');
    assert.strictEqual(mem.store['usernames/old_name'].holdUid, 'user1');
    assert.ok(mem.store['usernames/old_name'].releasedAtMs);

    const again = memDb({
        'usernames_meta/backfill': { applied: true },
        'users/user1': {
            username: 'old_name',
            username_lower: 'old_name',
            usernameChangedAt: recent,
            points: 9,
        },
        'usernames/old_name': { uid: 'user1', atMs: recent },
    });
    let blocked = null;
    try {
        await handler(again).setUsername({ name: 'new_name' }, contextFor('user1'));
    } catch (e) { blocked = e; }
    assert.ok(blocked);
    assert.strictEqual(blocked.message, 'You can change your username once a day.');
    assert.strictEqual(again.store['users/user1'].username, 'old_name');

    const same = memDb({
        'usernames_meta/backfill': { applied: true },
        'users/user1': {
            username: 'old_name',
            username_lower: 'old_name',
            usernameChangedAt: recent,
            usernameFreeRename: true,
            usernameMigratedFrom: 'spaced name',
            usernameMigratedAt: recent,
        },
        'usernames/old_name': { uid: 'user1', atMs: recent },
        'public_profiles/user1': { username: 'old_name', usernameMigratedFrom: 'spaced name' },
    });
    const kept = await handler(same).setUsername({ name: 'old_name' }, contextFor('user1'));
    assert.strictEqual(kept.already, true);
    assert.strictEqual(same.store['users/user1'].usernameFreeRename, true);
    assert.strictEqual(same.store['users/user1'].usernameMigratedFrom, 'spaced name');
    assert.strictEqual(same.store['users/user1'].usernameMigratedAt, recent);
    assert.strictEqual(same.store['public_profiles/user1'].usernameMigratedFrom, 'spaced name');

    const later = memDb({
        'usernames_meta/backfill': { applied: true },
        'users/user1': {
            username: 'old_name',
            username_lower: 'old_name',
            usernameChangedAt: Date.now() - 48 * 60 * 60 * 1000,
            usernameMigratedFrom: 'spaced name',
            usernameMigratedAt: recent,
            points: 9,
        },
        'usernames/old_name': { uid: 'user1', atMs: recent },
        'public_profiles/user1': { username: 'old_name', usernameMigratedFrom: 'spaced name', points: 9 },
    });
    const renamed = await handler(later).setUsername({ name: 'fresh_name' }, contextFor('user1'));
    assert.strictEqual(renamed.username, 'fresh_name');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(later.store['users/user1'], 'usernameMigratedFrom'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(later.store['users/user1'], 'usernameMigratedAt'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(later.store['public_profiles/user1'], 'usernameMigratedFrom'), false);
}));

queue.push(test('guest linking keeps a valid name and drops one with whitespace', async function () {
    const now = Date.now();
    const nonce = '0123456789abcdef';
    function guest(name) {
        return memDb({
            'users/guestuser01': {
                username: name,
                username_lower: String(name).toLowerCase(),
                guestLinkNonce: nonce,
                guestLinkNonceAt: now - 1000,
                created: now - 1000,
                points: 4,
            },
            'users/destuser001': { points: 1 },
            ['usernames/' + String(name).toLowerCase()]: { uid: 'guestuser01', atMs: now - 1000 },
        });
    }
    const spaced = guest('chill guy');
    const dropped = await handler(spaced).linkGuestAccount({ anonUid: 'guestuser01', nonce: nonce }, contextFor('destuser001'));
    assert.strictEqual(dropped.ok, true);
    assert.strictEqual(spaced.store['users/destuser001'].username, undefined);
    assert.strictEqual(spaced.store['usernames/chill guy'].uid, 'guestuser01');

    const hidden = guest('ok\u200Bname');
    const hiddenOut = await handler(hidden).linkGuestAccount({ anonUid: 'guestuser01', nonce: nonce }, contextFor('destuser001'));
    assert.strictEqual(hiddenOut.ok, true);
    assert.strictEqual(hidden.store['users/destuser001'].username, undefined);

    const clean = guest('chill_guy');
    const moved = await handler(clean).linkGuestAccount({ anonUid: 'guestuser01', nonce: nonce }, contextFor('destuser001'));
    assert.strictEqual(moved.ok, true);
    assert.strictEqual(clean.store['users/destuser001'].username, 'chill_guy');
    assert.strictEqual(clean.store['users/destuser001'].username_lower, 'chill_guy');
    assert.strictEqual(clean.store['usernames/chill_guy'].uid, 'destuser001');
}));

queue.push(test('Phil\'s 11 shortened names and plain underscore conversions stay exact', function () {
    assert.strictEqual(APPROVED.length, 11);
    APPROVED.forEach(function (pair) {
        assert.strictEqual(plannedName(pair[0]), pair[1], pair[0]);
        const verdict = assessUsername(pair[1], { allowReserved: true });
        assert.strictEqual(verdict.ok, true, pair[1] + ' ' + verdict.error);
        assert.ok(pair[1].length <= 20 && pair[1].length >= 3, pair[1]);
    });
    assert.strictEqual(migrate.convert('chill guy2'), 'chill_guy2');
    assert.strictEqual(migrate.convert('  Big   boss ross '), 'Big_boss_ross');
    assert.strictEqual(migrate.convert('a\u00A0b\u200Bc'), 'a_b_c');
    assert.strictEqual(migrate.withSuffix('chill_guy', 2), 'chill_guy2');
    assert.ok(migrate.withSuffix('a'.repeat(20), 23).length <= 20);
}));

queue.push(test('migration suffix, and skips for already migrated, renamed, or taken names', async function () {
    const now = Date.now();
    const rows = migrate.planFromRows([
        { id: 'usera00001', data: { username: 'chill guy', username_lower: 'chill guy' } },
        { id: 'userb00001', data: { username: 'chill guy', username_lower: 'chill guy' } },
        { id: 'userc00001', data: { username: 'clean_name', username_lower: 'clean_name' } },
    ], [], [], [], now);
    assert.strictEqual(rows.counts.affected, 2);
    const byId = {};
    rows.plan.forEach(function (row) { byId[row.uid] = row; });
    assert.strictEqual(byId.usera00001.next, 'chill_guy');
    assert.strictEqual(byId.userb00001.next, 'chill_guy2');
    assert.strictEqual(byId.userb00001.collided, true);

    const held = migrate.planFromRows([
        { id: 'usera00001', data: { username: 'chill guy', username_lower: 'chill guy' } },
    ], [], [
        { id: 'chill_guy', data: { uid: 'someoneelse', atMs: now, anon: false } },
    ], [], now);
    assert.strictEqual(held.plan[0].next, 'chill_guy2');
    assert.strictEqual(held.plan[0].collided, true);

    const row = { uid: 'usera00001', old: 'chill guy', oldLower: 'chill guy', next: 'chill_guy', nextLower: 'chill_guy' };
    function baseStore() {
        return {
            'users/usera00001': { username: 'chill guy', username_lower: 'chill guy', usernameChangedAt: 10, usernameNeedsRepick: true },
            'public_profiles/usera00001': { username: 'chill guy', username_lower: 'chill guy', points: 4 },
            'usernames/chill guy': { uid: 'usera00001', atMs: 10 },
        };
    }
    const ok = memDb(baseStore());
    assert.strictEqual(await migrate.applyOne(ok.db, row, { notify: true }), 'ok');
    assert.strictEqual(ok.store['users/usera00001'].username, 'chill_guy');
    assert.strictEqual(ok.store['users/usera00001'].usernameFreeRename, true);
    assert.strictEqual(ok.store['users/usera00001'].usernameMigratedFrom, 'chill guy');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(ok.store['users/usera00001'], 'usernameChangedAt'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(ok.store['users/usera00001'], 'usernameNeedsRepick'), false);
    assert.strictEqual(ok.store['public_profiles/usera00001'].username, 'chill_guy');
    assert.strictEqual(ok.store['public_profiles/usera00001'].usernameMigratedFrom, 'chill guy');
    assert.strictEqual(ok.store['public_profiles/usera00001'].points, 4);
    assert.strictEqual(ok.store['usernames/chill_guy'].uid, 'usera00001');
    assert.strictEqual(ok.store['usernames/chill guy'].holdUid, 'usera00001');
    assert.ok(ok.store['usernames/chill guy'].releasedAtMs);
    const note = ok.store['notifications/uname_mig_usera00001'];
    assert.strictEqual(note.message, migrate.noticeFor('chill_guy'));
    assert.strictEqual(note.type, 'username_changed');
    assert.strictEqual(note.recipientId, 'usera00001');
    assert.strictEqual(await migrate.applyOne(ok.db, row, { notify: true }), 'already');
    assert.strictEqual(ok.store['users/usera00001'].username, 'chill_guy');

    const marked = memDb(baseStore());
    marked.store['username_migrations/usera00001'] = { to: 'other_name', toLower: 'other_name' };
    assert.strictEqual(await migrate.applyOne(marked.db, row, {}), 'marker');
    assert.strictEqual(marked.store['users/usera00001'].username, 'chill guy');

    const renamed = memDb(baseStore());
    renamed.store['users/usera00001'].username = 'picked_already';
    assert.strictEqual(await migrate.applyOne(renamed.db, row, {}), 'changed');
    assert.strictEqual(renamed.store['users/usera00001'].username, 'picked_already');
    assert.strictEqual(renamed.store['usernames/chill_guy'], undefined);

    const taken = memDb(baseStore());
    taken.store['users/other000001'] = { username: 'chill_guy', username_lower: 'chill_guy' };
    assert.strictEqual(await migrate.applyOne(taken.db, row, {}), 'conflict');
    assert.strictEqual(taken.store['users/usera00001'].username, 'chill guy');

    const exact = memDb(baseStore());
    exact.store['users/other000001'] = { username: 'chill_guy' };
    assert.strictEqual(await migrate.applyOne(exact.db, row, {}), 'conflict');
    assert.strictEqual(exact.store['users/usera00001'].username, 'chill guy');
    assert.strictEqual(exact.store['username_migrations/usera00001'], undefined);

    const reserved = memDb(baseStore());
    reserved.store['usernames/chill_guy'] = { uid: 'other000001', atMs: now, anon: false };
    assert.strictEqual(await migrate.applyOne(reserved.db, row, {}), 'conflict');

    const quiet = memDb(baseStore());
    assert.strictEqual(await migrate.applyOne(quiet.db, row, {}), 'ok');
    assert.strictEqual(quiet.store['notifications/uname_mig_usera00001'], undefined);

    const cleaned = memDb(baseStore());
    const cleanedRow = Object.assign({}, row, { sanitized: 'charset' });
    assert.strictEqual(await migrate.applyOne(cleaned.db, cleanedRow, { notify: true }), 'ok');
    assert.strictEqual(
        cleaned.store['notifications/uname_mig_usera00001'].message,
        migrate.noticeFor('chill_guy', { sanitized: true })
    );

    const live = memDb({
        'marketplace/active1': { sellerUid: 'usera00001', sellerName: 'chill guy', status: 'active' },
        'marketplace/sold1': { sellerUid: 'usera00001', sellerName: 'chill guy', status: 'sold' },
        'marketplace/other1': { sellerUid: 'other000001', sellerName: 'chill guy', status: 'active' },
        'dm_conversations/dm1': { participants: ['usera00001', 'other000001'], participantNames: { usera00001: 'chill guy', other000001: 'other' } },
        'satoshiFavor/current': { lowestHashThisWindowUid: 'usera00001', lowestHashThisWindowUsername: 'chill guy' },
        'satoshiFavor/current/sub/usera00001': { username: 'chill guy' },
        'global_chat/oldmsg': { name: 'chill guy', uid: 'usera00001' },
    });
    // session_hashes is a subcollection. Point the fake doc at the path the script uses.
    live.store['satoshiFavor/current'] = live.store['satoshiFavor/current'];
    const script = fs.readFileSync(path.join(root, 'functions/scripts/migrate-username-spaces.js'), 'utf8');
    assert.ok(script.includes("collection('marketplace')"));
    assert.ok(script.includes("collection('dm_conversations')"));
    assert.ok(script.includes("collection('satoshiFavor')"));
    assert.ok(script.indexOf("collection('global_chat')") === -1);
    assert.ok(script.indexOf('forum_posts') === -1);
    assert.ok(script.includes('function short(uid)'));
    assert.ok(script.includes('short(r.uid)'));
    assert.ok(script.indexOf('email') === -1);
    assert.strictEqual(script.indexOf('e.message'), -1);
    assert.ok(script.includes('--plan'));
    assert.ok(script.includes('--sha256'));
    assert.ok(script.includes("where('username', '==', row.next)"));
    const copies = await migrate.patchLiveCopies(live.db, row);
    assert.strictEqual(copies.listings, 1);
    assert.strictEqual(live.store['marketplace/active1'].sellerName, 'chill_guy');
    assert.strictEqual(live.store['marketplace/sold1'].sellerName, 'chill guy');
    assert.strictEqual(live.store['marketplace/other1'].sellerName, 'chill guy');
    assert.strictEqual(live.store['global_chat/oldmsg'].name, 'chill guy');

    live.store['marketplace/active1'].sellerName = 'chill guy';
    live.store['users/usera00001'] = { username: 'chill_guy' };
    live.store['username_migrations/usera00001'] = {
        to: 'chill_guy', toLower: 'chill_guy',
        patches: { listings: 'error', dms: 'ok', sf: 'ok' },
    };
    const retried = await migrate.resumePatches(live.db, row);
    assert.strictEqual(retried.listings, 1);
    assert.strictEqual(retried.status.dms, undefined);
    assert.strictEqual(live.store['marketplace/active1'].sellerName, 'chill_guy');
    assert.strictEqual(live.store['username_migrations/usera00001'].patches.listings, 'ok');
    assert.strictEqual(live.store['username_migrations/usera00001'].patches.sf, 'ok');
    live.store['marketplace/active1'].sellerName = 'chill guy';
    const skipped = await migrate.resumePatches(live.db, row);
    assert.strictEqual(skipped.listings, 0);
    assert.strictEqual(live.store['marketplace/active1'].sellerName, 'chill guy');
    live.store['users/usera00001'].username = 'picked_later';
    live.store['username_migrations/usera00001'].patches.listings = 'error';
    const renamedAway = await migrate.resumePatches(live.db, row);
    assert.strictEqual(renamedAway.skipped, true);
    assert.strictEqual(renamedAway.listings, 0);
    assert.strictEqual(live.store['marketplace/active1'].sellerName, 'chill guy');
    assert.strictEqual(live.store['username_migrations/usera00001'].patches.listings, 'error');

    const built = migrate.planFromRows([
        { id: 'usera00001', data: { username: 'chill guy', username_lower: 'chill guy' } },
        { id: 'userb00001', data: { username: 'chill guy', username_lower: 'chill guy' } },
    ], [], [], [], now);
    const doc = migrate.planDocument(built.counts, built.profileOnly, built.plan);
    const loaded = migrate.loadReviewedPlan(JSON.parse(JSON.stringify(doc)), doc.sha256);
    assert.strictEqual(loaded[0].next, 'chill_guy');
    assert.strictEqual(loaded[1].next, 'chill_guy2');
    const tampered = JSON.parse(JSON.stringify(doc));
    tampered.plan[1].next = 'chill_guy9';
    let hashErr = null;
    try { migrate.loadReviewedPlan(tampered, doc.sha256); } catch (e) { hashErr = e; }
    assert.ok(hashErr);
    assert.strictEqual(hashErr.code, 'plan-hash');
    assert.strictEqual(loaded[1].next, 'chill_guy2');
    let flagMiss = null;
    try { migrate.loadReviewedPlan(JSON.parse(JSON.stringify(doc)), 'ab'.repeat(32)); } catch (e) { flagMiss = e; }
    assert.ok(flagMiss);
    assert.strictEqual(flagMiss.code, 'plan-hash');
    const upper = migrate.loadReviewedPlan(JSON.parse(JSON.stringify(doc)), doc.sha256.toUpperCase());
    assert.strictEqual(upper[0].next, 'chill_guy');
    function refuse(mutate) {
        const bad = JSON.parse(JSON.stringify(doc));
        mutate(bad);
        bad.sha256 = migrate.planSha256(bad.counts, bad.profileOnly, bad.plan);
        let err = null;
        try { migrate.loadReviewedPlan(bad, bad.sha256); } catch (e) { err = e; }
        assert.strictEqual(err && err.code, 'invalid-plan');
    }
    refuse(function (bad) { bad.plan[0].next = 'ab'; bad.plan[0].nextLower = 'ab'; });
    refuse(function (bad) { bad.plan[0].nextLower = 'CHILL_GUY'; });
    refuse(function (bad) { bad.plan[0].oldLower = 'other'; });
    refuse(function (bad) { bad.plan[0].old = 'chill_guy'; bad.plan[0].oldLower = 'chill_guy'; });
    refuse(function (bad) { bad.plan[1].next = 'chill_guy'; bad.plan[1].nextLower = 'chill_guy'; });
    let missing = null;
    try { migrate.assertApplyPlan(['node', 'migrate-username-spaces.js', '--apply']); } catch (e) { missing = e; }
    assert.ok(missing);
    assert.strictEqual(missing.code, 'plan-required');
    let noSha = null;
    try { migrate.assertApplyPlan(['node', 'migrate-username-spaces.js', '--apply', '--plan', 'reviewed.json']); } catch (e) { noSha = e; }
    assert.ok(noSha);
    assert.strictEqual(noSha.code, 'sha-required');
    let badSha = null;
    try { migrate.assertApplyPlan(['node', 'migrate-username-spaces.js', '--apply', '--plan', 'reviewed.json', '--sha256', 'not-a-hash']); } catch (e) { badSha = e; }
    assert.ok(badSha);
    assert.strictEqual(badSha.code, 'sha-required');
    const args = migrate.assertApplyPlan(['node', 'migrate-username-spaces.js', '--apply', '--plan', 'reviewed.json', '--sha256', doc.sha256.toUpperCase()]);
    assert.strictEqual(args.plan, 'reviewed.json');
    assert.strictEqual(args.sha256, doc.sha256);
    assert.strictEqual(migrate.noticeFor('Ahmed_ahmedibnhack', { sanitized: true }),
        'Usernames can no longer contain spaces or special characters, so yours is now @Ahmed_ahmedibnhack. Want a different one? You get one free change in Settings → Advanced → Change Username.');
}));

queue.push(test('a stale cached username retries a chat send and a listing once, with no error the first time', function () {
    const chat = fs.readFileSync(path.join(root, 'global-chat.js'), 'utf8');
    const market = fs.readFileSync(path.join(root, 'marketplace.js'), 'utf8');
    const start = '/* stale-username-retry */';
    const end = '/* /stale-username-retry */';
    const chatBlock = chat.slice(chat.indexOf(start), chat.indexOf(end) + end.length);
    const marketBlock = market.slice(market.indexOf(start), market.indexOf(end) + end.length);
    assert.strictEqual(chatBlock, marketBlock);
    assert.ok(chat.indexOf('function _mentionWordRe') > 0);
    assert.ok(chat.includes("'@([\\\\p{L}\\\\p{N}_\\\\-\\\\u2026.]+)'"));
    const mention = new RegExp('@([\\p{L}\\p{N}_\\-\\u2026.]+)', 'gu');
    const tokens = [];
    let hit;
    const sample = 'hey @chill_guy2 meet @chill guy2';
    while ((hit = mention.exec(sample))) tokens.push(hit[1]);
    assert.deepStrictEqual(tokens, ['chill_guy2', 'chill']);
    assert.ok(chat.includes("where('usernameMigratedFrom', '==', username)"));
    const sendAt = chat.indexOf('sendWithFreshUsername(function(name) {');
    const mentionAt = chat.indexOf('var _mentionTargets = _chatMentionTargets(text);');
    assert.ok(mentionAt > 0 && sendAt > mentionAt, 'text send retries after the mention matcher');
    assert.ok(chat.includes('function _longestKnownUsername'));
    assert.strictEqual(chat.indexOf('/@([a-zA-Z0-9_-]+)/'), -1);

    const storage = {
        btc_profile_cache: JSON.stringify({ data: { username: 'chill guy', points: 4 } }),
    };
    const gets = [];
    let serverName = 'chill_guy2';
    const ctx = {
        Promise: Promise,
        console: console,
        currentUser: { username: 'chill guy' },
        localStorage: {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
            setItem: function (k, v) { storage[k] = String(v); },
        },
        auth: { currentUser: { uid: 'usera00001' } },
        db: {
            collection: function () {
                return {
                    doc: function () {
                        return {
                            get: function (opts) {
                                gets.push(opts && opts.source);
                                return Promise.resolve({
                                    exists: true,
                                    data: function () { return { username: serverName }; },
                                });
                            },
                        };
                    },
                };
            },
        },
    };
    vm.createContext(ctx);
    vm.runInContext(chatBlock + '\nthis.sendWithFreshUsername = sendWithFreshUsername;', ctx);

    function run(writes) {
        const calls = [];
        let fails = 0;
        let oks = 0;
        return ctx.sendWithFreshUsername(function (name) {
            calls.push(name);
            const result = writes[calls.length - 1];
            if (result && result.reject) return Promise.reject(result.reject);
            return Promise.resolve({ id: 'm1' });
        }, 'chill guy', function () { oks++; }, function () { fails++; }).then(function () {
            return { calls: calls, fails: fails, oks: oks, ok: true };
        }, function () {
            return { calls: calls, fails: fails, oks: oks, ok: false };
        });
    }
    const denied = { code: 'permission-denied' };
    return run([{}]).then(function (first) {
        assert.deepStrictEqual(first.calls, ['chill guy']);
        assert.strictEqual(first.fails, 0);
        assert.strictEqual(first.oks, 1);
        assert.strictEqual(gets.length, 0);
        return run([{ reject: denied }, {}]);
    }).then(function (retried) {
        assert.deepStrictEqual(retried.calls, ['chill guy', 'chill_guy2']);
        assert.strictEqual(retried.fails, 0, 'first denial is not shown');
        assert.strictEqual(retried.oks, 1);
        assert.strictEqual(ctx.currentUser.username, 'chill_guy2');
        assert.strictEqual(storage.btc_username, 'chill_guy2');
        const cached = JSON.parse(storage.btc_profile_cache);
        assert.strictEqual(cached.data.username, 'chill_guy2');
        serverName = 'chill guy';
        return run([{ reject: denied }]);
    }).then(function (same) {
        assert.deepStrictEqual(same.calls, ['chill guy']);
        assert.strictEqual(same.fails, 1);
        assert.strictEqual(same.ok, false);
        serverName = 'fresh_name';
        return run([{ reject: { code: 'unavailable' } }]);
    }).then(function (other) {
        assert.deepStrictEqual(other.calls, ['chill guy']);
        assert.strictEqual(other.fails, 1);
        return run([{ reject: denied }, { reject: denied }]);
    }).then(function (twice) {
        assert.deepStrictEqual(twice.calls, ['chill guy', 'fresh_name']);
        assert.strictEqual(twice.fails, 1);
        assert.ok(market.includes('sendWithFreshUsername(function(name) {'));
        assert.ok(market.includes(".add(listing)"));
    });
}));

queue.push(test('the three username screens block spaces and the public pages dropped them', function () {
    const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    const repick = ranking.slice(ranking.indexOf('window.submitUsernameRepick'), ranking.indexOf('window.patchBlankProfileNames'));
    const create = ranking.slice(ranking.indexOf('async function createUser'), ranking.indexOf('async function awardVisitPoints'));
    const submit = ranking.slice(ranking.indexOf('window.submitUsername = async function'), ranking.indexOf('if (typeof changeUsername'));
    const change = ranking.slice(ranking.indexOf('window.changeUsername = async function'), ranking.indexOf('window.togglePushNotifications'));
    [repick, create, submit, change].forEach(function (body, i) {
        assert.ok(body.includes('Usernames cannot contain spaces') || body.includes('No spaces, please'), 'screen ' + i);
        assert.ok(body.includes('.replace('), 'suggestion ' + i);
        assert.ok(body.indexOf('numbers, spaces, underscores') === -1, 'old copy ' + i);
    });
    assert.ok(ranking.includes('usernameFreeRename === true'));
    assert.ok(ranking.includes('currentUser.usernameFreeRename = false'));
    const terms = fs.readFileSync(path.join(root, 'terms.html'), 'utf8');
    assert.ok(terms.includes('periods (no spaces)'));
    assert.ok(terms.indexOf('numbers, spaces, underscores') === -1);
    const privacy = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');
    assert.ok(privacy.includes('no spaces'));
    assert.ok(privacy.includes('usernameMigratedFrom'));
    assert.ok(privacy.includes('username_migrations'));
    assert.ok(privacy.includes('usernameFreeRename'));
    assert.ok(privacy.includes('until the account is deleted'));
    const notes = fs.readFileSync(path.join(root, 'patch-notes.html'), 'utf8');
    assert.strictEqual((notes.match(/Latest:/g) || []).length, 1);
    const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    assert.ok(index.includes("'usernameMigratedFrom'"));
}));

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
