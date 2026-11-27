#!/usr/bin/env node
'use strict';
// Claims age-gate hardening (Nov 27 2026). The 7-day account-age gate on
// sats claims starts at the later of Auth creationTime and the server-only
// users.realAccountAt, and never credits a deleted account's age.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.DELETION_HMAC_SECRET = 'unit-deletion-secret-0123456789';

const root = path.join(__dirname, '..');
const realAccountAge = require(path.join(root, 'functions', 'src', 'realAccountAge'));
const emailChange = require(path.join(root, 'functions', 'src', 'emailChange'));
const tomb = require(path.join(root, 'functions', 'src', 'accountTombstone'));
const { assessCipherClaim } = require(path.join(root, 'functions', 'src', 'cipherClaim'));
const backfill = require(path.join(root, 'functions', 'scripts', 'backfill-real-account-at'));

const DAY = 86400000;
const MIN = 60000;
const NOW = 1_800_000_000_000;

function createDb(initial) {
    const docs = new Map();
    Object.keys(initial || {}).forEach(function (k) { docs.set(k, Object.assign({}, initial[k])); });
    function ref(p) {
        return {
            path: p,
            id: p.split('/').pop(),
            get: async function () {
                if (!docs.has(p)) return { exists: false, id: this.id, data: function () { return undefined; } };
                return { exists: true, id: this.id, data: function () { return Object.assign({}, docs.get(p)); } };
            },
            set: async function (data, opts) {
                const prev = docs.get(p) || {};
                docs.set(p, opts && opts.merge ? Object.assign({}, prev, data) : Object.assign({}, data));
            },
            delete: async function () { docs.delete(p); },
        };
    }
    function query(coll, filters) {
        return {
            where: function (f, op, v) { return query(coll, filters.concat([{ f: f, v: v }])); },
            limit: function () { return this; },
            get: async function () {
                const out = [];
                docs.forEach(function (data, key) {
                    const parts = key.split('/');
                    if (parts.length !== 2 || parts[0] !== coll) return;
                    if (!filters.every(function (x) { return data[x.f] === x.v; })) return;
                    out.push({ id: parts[1], data: function () { return Object.assign({}, data); } });
                });
                return { empty: !out.length, size: out.length, docs: out, forEach: function (fn) { out.forEach(fn); } };
            },
        };
    }
    return {
        docs: docs,
        collection: function (name) {
            return {
                doc: function (id) { return ref(name + '/' + id); },
                where: function (f, op, v) { return query(name, [{ f: f, v: v }]); },
            };
        },
        getAll: async function () {
            const refs = Array.prototype.slice.call(arguments);
            const out = [];
            for (let i = 0; i < refs.length; i++) out.push(await refs[i].get());
            return out;
        },
    };
}

function authApiFor(users) {
    return {
        getUser: async function (uid) {
            if (!users[uid]) { const e = new Error('nf'); e.code = 'auth/user-not-found'; throw e; }
            return users[uid];
        },
        getUserByEmail: async function (email) {
            const hit = Object.keys(users).map(function (k) { return users[k]; }).find(function (u) { return u.email === email; });
            if (!hit) { const e = new Error('nf'); e.code = 'auth/user-not-found'; throw e; }
            return hit;
        },
        revokeRefreshTokens: async function () {},
        updateUser: async function () {},
    };
}

function authUser(uid, createdMs, extra) {
    return Object.assign({
        uid: uid,
        email: uid + '@example.com',
        emailVerified: true,
        providerData: [{ providerId: 'password', uid: uid + '@example.com' }],
        metadata: { creationTime: new Date(createdMs).toUTCString() },
    }, extra || {});
}

function gateFor(age) {
    return assessCipherClaim({ email: 'x@example.com', emailVerified: true, ageKnown: age.ageKnown, ageDays: age.ageDays, ageSource: age.ageSource });
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e && (e.stack || e.message))); failed++; }
}

(async function () {
    await test('boundary: 6d23h59m is refused, 7d00h passes (mocked creationTime)', async function () {
        const synced = { emailHash: 'h' };
        const young = realAccountAge.ageFrom(authUser('a', NOW - (7 * DAY - MIN)), synced, NOW);
        assert.deepStrictEqual(young, { ageKnown: true, ageDays: 6, ageSource: 'created' });
        assert.strictEqual(gateFor(young).ok, false);
        const old = realAccountAge.ageFrom(authUser('a', NOW - 7 * DAY), synced, NOW);
        assert.deepStrictEqual(old, { ageKnown: true, ageDays: 7, ageSource: 'created' });
        assert.strictEqual(gateFor(old).ok, true);
    });

    await test('boundary also holds from realAccountAt (6d23h59m refused, 7d passes)', async function () {
        const a = authUser('a', NOW - 90 * DAY);
        assert.strictEqual(gateFor(realAccountAge.ageFrom(a, { emailHash: 'h', realAccountAt: NOW - (7 * DAY - MIN) }, NOW)).ok, false);
        assert.strictEqual(gateFor(realAccountAge.ageFrom(a, { emailHash: 'h', realAccountAt: NOW - 7 * DAY }, NOW)).ok, true);
    });

    await test('client-written profile fields (ageDays, created, accountAgeDays, uid) are ignored', async function () {
        const forged = {
            emailHash: 'h', ageDays: 999, accountAgeDays: 999, created: NOW - 999 * DAY,
            createdAt: NOW - 999 * DAY, uid: 'someone-old', realAccountAtClient: NOW - 999 * DAY,
        };
        const age = realAccountAge.ageFrom(authUser('a', NOW - 2 * DAY), forged, NOW);
        assert.deepStrictEqual(age, { ageKnown: true, ageDays: 2, ageSource: 'created' });
        assert.strictEqual(gateFor(age).ok, false);
        // An earlier realAccountAt can never make an account older than Auth says.
        const early = realAccountAge.ageFrom(authUser('a', NOW - 2 * DAY), { realAccountAt: NOW - 400 * DAY }, NOW);
        assert.strictEqual(early.ageDays, 2);
    });

    await test('payout paths read age only from beginPayout (Auth + server profile), not request data', async function () {
        const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
        const claim = index.slice(index.indexOf('exports.claimSats = '), index.indexOf('const configDoc = await db.collection(\'faucet_config\')', index.indexOf('exports.claimSats = ')));
        assert.ok(claim.includes('payoutGate.age'), 'claimSats uses payoutGate.age');
        assert.ok(!/\bdata\.(ageDays|created(?!At)|uid|accountAge)/.test(claim), 'claimSats never reads age from data');
        const gifting = fs.readFileSync(path.join(root, 'functions', 'src', 'gifting.js'), 'utf8');
        const win = gifting.slice(gifting.indexOf('const claimCipherWin'), gifting.indexOf('const listMyCipherWins'));
        assert.ok(win.includes('payoutGate.age'));
        assert.ok(!/\bdata\.(ageDays|created(?!At)|uid|accountAge)/.test(win));
        const sats = gifting.slice(gifting.indexOf('const claimCipherSats'), gifting.indexOf('const day = utcDateKey()', gifting.indexOf('const claimCipherSats')));
        assert.ok(sats.includes('payoutGate.age'));
        assert.ok(!/\bdata\.(ageDays|created(?!At)|uid|accountAge)/.test(sats));
        const favor = fs.readFileSync(path.join(root, 'functions', 'src', 'favorBlockClaimsFns.js'), 'utf8');
        const gate = favor.slice(favor.indexOf('async function accountGate'), favor.indexOf('function service()'));
        assert.ok(gate.includes('gate.age'));
    });

    await test('tombstone age is no longer credited by any payout path', async function () {
        const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
        const gifting = fs.readFileSync(path.join(root, 'functions', 'src', 'gifting.js'), 'utf8');
        const favor = fs.readFileSync(path.join(root, 'functions', 'src', 'favorBlockClaimsFns.js'), 'utf8');
        [index, gifting, favor].forEach(function (src) { assert.ok(!src.includes('effectiveAgeDays('), 'no effectiveAgeDays credit'); });
    });

    await test('tombstone: a deleted 400-day account does not age a 1-day account (beginPayout)', async function () {
        const a = authUser('fresh1', NOW - 1 * DAY);
        const ids = tomb.hashIdsFor(tomb.identityFrom({ uid: 'fresh1', authUser: a }));
        assert.ok(ids.length > 0);
        const seed = { 'users/fresh1': { emailHash: tomb.emailHmac(a.email), email: a.email } };
        ids.forEach(function (id) { seed['deleted_accounts/' + id] = { ageDays: 400, deletions: 1 }; });
        const db = createDb(seed);
        const r = await emailChange.beginPayout(db, authApiFor({ fresh1: a }), 'fresh1', a, NOW, {}, true);
        assert.strictEqual(r.ok, true);
        assert.ok(r.tomb && r.tomb.summary.ageDays >= 400, 'tombstone still read (bans/caps)');
        assert.deepStrictEqual(r.age, { ageKnown: true, ageDays: 1, ageSource: 'created' });
        assert.strictEqual(gateFor(r.age).ok, false);
    });

    await test('pre-aged guest: 7-day-old account whose first verified email lands now is refused', async function () {
        const a = authUser('guest1', NOW - 7 * DAY - 3600000);
        const db = createDb({ 'users/guest1': { points: 50 } });
        const r = await emailChange.beginPayout(db, authApiFor({ guest1: a }), 'guest1', a, NOW, {}, true);
        assert.strictEqual(r.ok, true);
        assert.strictEqual(db.docs.get('users/guest1').realAccountAt, NOW, 'stamped at first real identity');
        assert.deepStrictEqual(r.age, { ageKnown: true, ageDays: 0, ageSource: 'linked' });
        assert.strictEqual(gateFor(r.age).ok, false);
        assert.strictEqual(gateFor(r.age).error, 'Sats claims open 7 days after you linked your email or sign-in. It has been 0 days.');
        // 6d23h59m later still refused, 7 days later it passes.
        const r2 = await emailChange.beginPayout(db, authApiFor({ guest1: a }), 'guest1', a, NOW + 7 * DAY - MIN, {}, true);
        assert.strictEqual(gateFor(r2.age).ok, false);
        const r3 = await emailChange.beginPayout(db, authApiFor({ guest1: a }), 'guest1', a, NOW + 7 * DAY, {}, true);
        assert.strictEqual(gateFor(r3.age).ok, true);
        assert.strictEqual(db.docs.get('users/guest1').realAccountAt, NOW, 'never re-stamped');
    });

    await test('pre-aged guest linking Google (first provider) is stamped too', async function () {
        const a = authUser('guest2', NOW - 30 * DAY, {
            email: 'g2@gmail.com',
            providerData: [{ providerId: 'google.com', uid: 'google-sub-2' }],
        });
        const db = createDb({ 'users/guest2': {} });
        const r = await emailChange.beginPayout(db, authApiFor({ guest2: a }), 'guest2', a, NOW, {}, true);
        assert.strictEqual(db.docs.get('users/guest2').realAccountAt, NOW);
        assert.strictEqual(gateFor(r.age).ok, false);
    });

    await test('Lightning/Nostr account that adds its first email after 7 days waits 7 days from the email', async function () {
        const a = authUser('ln:abc', NOW - 20 * DAY, { providerData: [] });
        const db = createDb({
            'users/ln:abc': {},
            ['email_link_claims/' + tomb.emailHmac(a.email)]: { uid: 'ln:abc', expireAt: NOW + 3600000 },
        });
        const r = await emailChange.beginPayout(db, authApiFor({ 'ln:abc': a }), 'ln:abc', a, NOW, {}, true);
        assert.strictEqual(r.ok, true);
        assert.strictEqual(db.docs.get('users/ln:abc').realAccountAt, NOW);
        assert.strictEqual(gateFor(r.age).ok, false);
    });

    await test('normal new signup is not delayed: realAccountAt = creationTime', async function () {
        const created = NOW - 2 * 3600000;
        const a = authUser('new1', created);
        const db = createDb({});
        await emailChange.reconcileEmail(db, authApiFor({ new1: a }), 'new1', a, NOW, {}, true);
        assert.strictEqual(db.docs.get('users/new1').realAccountAt, created);
        const later = await emailChange.beginPayout(db, authApiFor({ new1: a }), 'new1', a, created + 7 * DAY, {}, true);
        assert.strictEqual(gateFor(later.age).ok, true);
    });

    await test('existing synced player without realAccountAt keeps creationTime (no lockout, no stamp)', async function () {
        const a = authUser('old1', NOW - 200 * DAY);
        const db = createDb({ 'users/old1': { emailHash: tomb.emailHmac(a.email), email: a.email, points: 9000, satsWithdrawn: 300 } });
        const r = await emailChange.beginPayout(db, authApiFor({ old1: a }), 'old1', a, NOW, {}, true);
        assert.strictEqual(r.ok, true);
        assert.deepStrictEqual(r.age, { ageKnown: true, ageDays: 200, ageSource: 'created' });
        assert.strictEqual(gateFor(r.age).ok, true);
        const after = db.docs.get('users/old1');
        assert.strictEqual(after.realAccountAt, undefined);
        assert.strictEqual(after.points, 9000, 'XP untouched');
        assert.strictEqual(after.satsWithdrawn, 300, 'sats untouched');
    });

    await test('an email change on a stamped account keeps the original realAccountAt', async function () {
        const a = authUser('chg1', NOW - 40 * DAY, { email: 'new-chg1@example.com' });
        const db = createDb({ 'users/chg1': { emailHash: tomb.emailHmac('chg1@example.com'), realAccountAt: NOW - 30 * DAY } });
        await emailChange.reconcileEmail(db, authApiFor({ chg1: a }), 'chg1', a, NOW, {}, true);
        const u = db.docs.get('users/chg1');
        assert.strictEqual(u.realAccountAt, NOW - 30 * DAY);
        assert.ok(u.satsHold > NOW, 'change still holds sats 72h');
    });

    await test('never-synced profile is not eligible until reconcile stamps it; unknown creation is refused', async function () {
        assert.deepStrictEqual(realAccountAge.ageFrom(authUser('x', NOW - 50 * DAY), {}, NOW), { ageKnown: true, ageDays: 0, ageSource: 'linked' });
        assert.strictEqual(realAccountAge.ageFrom({ metadata: {} }, { emailHash: 'h' }, NOW).ageKnown, false);
        assert.strictEqual(gateFor(realAccountAge.ageFrom({ metadata: {} }, { emailHash: 'h' }, NOW)).ok, false);
    });

    await test('backfill plan: only unsynced real accounts get realAccountAt = creationTime', async function () {
        const created = NOW - 100 * DAY;
        const real = authUser('b1', created);
        assert.deepStrictEqual(backfill.planFor(real, {}), { action: 'set', realAccountAt: created });
        assert.strictEqual(backfill.planFor(real, { emailHash: 'h' }).reason, 'synced_uses_creation');
        assert.strictEqual(backfill.planFor(real, { realAccountAt: 5 }).reason, 'already_set');
        assert.strictEqual(backfill.planFor(real, null).reason, 'no_profile');
        assert.strictEqual(backfill.planFor({ uid: 'anon', providerData: [], metadata: { creationTime: new Date(created).toUTCString() } }, {}).reason, 'no_real_identity');
        assert.deepStrictEqual(backfill.parseArgs(['--apply']), { apply: false, applyRequested: true, confirm: false, project: '' });
        assert.strictEqual(backfill.parseArgs(['--project=bitcoin-quest-staging']).project, 'bitcoin-quest-staging');
        assert.strictEqual(backfill.parseArgs(['--project=../x']).project, '');
    });

    await test('backfill script refuses to run without --project (no default to live)', async function () {
        const src = fs.readFileSync(path.join(root, 'functions', 'scripts', 'backfill-real-account-at.js'), 'utf8');
        assert.ok(!src.includes("'bitcoin-education-archive'"), 'no hard-coded live project');
        const r = require('child_process').spawnSync(process.execPath, [path.join(root, 'functions', 'scripts', 'backfill-real-account-at.js')], { encoding: 'utf8' });
        assert.strictEqual(r.status, 2);
        assert.ok(/--project/.test(r.stderr));
    });

    await test('backfill applyOne: transactional re-read skips a profile that got realAccountAt or synced meanwhile', async function () {
        function txDb(doc) {
            const store = { doc: doc };
            const ref = { get: async function () { return { exists: !!store.doc, data: function () { return Object.assign({}, store.doc); } }; } };
            return {
                store: store,
                collection: function () { return { doc: function () { return ref; } }; },
                runTransaction: async function (fn) {
                    return fn({ get: function (r) { return r.get(); }, update: function (r, d) { store.doc = Object.assign({}, store.doc, d); } });
                },
            };
        }
        const created = NOW - 100 * DAY;
        const a = authUser('b2', created);
        const fresh = txDb({ points: 5 });
        assert.deepStrictEqual(await backfill.applyOne(fresh, a), { written: true });
        assert.strictEqual(fresh.store.doc.realAccountAt, created);
        assert.strictEqual(fresh.store.doc.points, 5);
        const already = txDb({ realAccountAt: NOW });
        assert.deepStrictEqual(await backfill.applyOne(already, a), { written: false, reason: 'already_set' });
        assert.strictEqual(already.store.doc.realAccountAt, NOW, 'never overwritten');
        const synced = txDb({ emailHash: 'h' });
        assert.deepStrictEqual(await backfill.applyOne(synced, a), { written: false, reason: 'synced_uses_creation' });
        assert.strictEqual(synced.store.doc.realAccountAt, undefined);
    });

    await test('refusal text: linked accounts are told the 7 days count from the link; others keep the old text', async function () {
        assert.strictEqual(realAccountAge.tooYoungMessage(7, 3, 'linked'), 'Sats claims open 7 days after you linked your email or sign-in. It has been 3 days.');
        assert.strictEqual(realAccountAge.tooYoungMessage(7, 3, 'created'), 'Account must be at least 7 days old. Yours is 3 days.');
        assert.strictEqual(assessCipherClaim({ email: 'x@e.com', emailVerified: true, ageKnown: true, ageDays: 2 }).error, 'Account must be at least 7 days old. Yours is 2 days.');
        const fresh = realAccountAge.ageFrom(authUser('n', NOW - 3 * DAY), { emailHash: 'h', realAccountAt: NOW - 3 * DAY }, NOW);
        assert.strictEqual(fresh.ageSource, 'created', 'a normal signup stamped at creation is not "linked"');
        const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
        assert.ok(index.includes('tooYoungMessage(FAUCET.MIN_ACCOUNT_AGE_DAYS, ageDays, ageGate.ageSource)'));
    });

    await test('dead effectiveAgeDays helper is removed', async function () {
        assert.strictEqual(tomb.effectiveAgeDays, undefined);
    });

    await test('rules: realAccountAt is a server-only profile key', async function () {
        const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
        const keysFn = rules.slice(rules.indexOf('function userProfileServerOnlyKeys()'), rules.indexOf('match /users/{userId}'));
        assert.ok(keysFn.includes("'realAccountAt'"));
        const createRule = rules.slice(rules.indexOf('allow create: if request.auth != null'), rules.indexOf('allow update: if request.auth != null'));
        assert.ok(!createRule.includes("'realAccountAt'"), 'not on the create allowlist');
    });

    await test('claimCipherWin enforces App Check and the client waits for a token', async function () {
        const gifting = fs.readFileSync(path.join(root, 'functions', 'src', 'gifting.js'), 'utf8');
        const head = gifting.slice(gifting.indexOf('const claimCipherWin'), gifting.indexOf('.https.onCall', gifting.indexOf('const claimCipherWin')));
        assert.ok(head.includes('enforceAppCheck: true'));
        const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
        const list = ranking.slice(ranking.indexOf('var APP_CHECK_CALLABLES'), ranking.indexOf('};', ranking.indexOf('var APP_CHECK_CALLABLES')));
        assert.ok(list.includes('claimCipherWin: 1'));
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
