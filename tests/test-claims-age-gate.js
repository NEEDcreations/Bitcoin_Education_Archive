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
const ageGateHeld = require(path.join(root, 'functions', 'src', 'ageGateHeld'));
const seedHeld = require(path.join(root, 'scripts', 'seed-age-gate-held'));
const releaseHeld = require(path.join(root, 'scripts', 'release-age-gate-held'));
const uidList = require(path.join(root, 'scripts', 'age-gate-uid-list'));

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

const CUTOFF = realAccountAge.REAL_ACCOUNT_CUTOFF_MS;

function emptyHeld() {
    return { ok: true, uids: new Set(), groups: {} };
}

function heldOf() {
    const uids = Array.prototype.slice.call(arguments);
    return { ok: true, uids: new Set(uids), groups: { test: uids.slice() } };
}

function withHeld(initial, held) {
    const docs = Object.assign({}, initial || {});
    if (!Object.prototype.hasOwnProperty.call(docs, 'config/ageGateHeld')) {
        if (Array.isArray(held)) docs['config/ageGateHeld'] = { uids: held };
        else if (held && Array.isArray(held.uids) && held.groups) docs['config/ageGateHeld'] = held;
        else if (held && Array.isArray(held.uids)) docs['config/ageGateHeld'] = { uids: held.uids };
        else if (held && held.groups) docs['config/ageGateHeld'] = { groups: held.groups };
        else if (held && typeof held === 'object') docs['config/ageGateHeld'] = { groups: held };
        else docs['config/ageGateHeld'] = { uids: [], groups: {} };
    }
    ageGateHeld.resetCache();
    return createDb(docs);
}

function guestAuth(uid, createdMs, extra) {
    return authUser(uid, createdMs, Object.assign({
        email: String(uid).replace(/[^a-z0-9]/gi, 'x') + '@example.com',
        emailVerified: true,
        providerData: [],
    }, extra || {}));
}

const savedEnv = {
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
    FIREBASE_CONFIG: process.env.FIREBASE_CONFIG,
    AGE_GATE_CUTOFF_MS: process.env.AGE_GATE_CUTOFF_MS,
    AGE_GATE_HELD_EXTRA: process.env.AGE_GATE_HELD_EXTRA,
};

function setProject(id) {
    if (id) process.env.GCLOUD_PROJECT = id;
    else delete process.env.GCLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.FIREBASE_CONFIG;
    ageGateHeld.resetCache();
}

function restoreEnv() {
    Object.keys(savedEnv).forEach(function (k) {
        if (savedEnv[k] == null) delete process.env[k];
        else process.env[k] = savedEnv[k];
    });
    ageGateHeld.resetCache();
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e && (e.stack || e.message))); failed++; }
}

(async function () {
    setProject('');
    try {
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
        const db = withHeld(seed);
        const r = await emailChange.beginPayout(db, authApiFor({ fresh1: a }), 'fresh1', a, NOW, {}, true);
        assert.strictEqual(r.ok, true);
        assert.ok(r.tomb && r.tomb.summary.ageDays >= 400, 'tombstone still read (bans/caps)');
        assert.deepStrictEqual(r.age, { ageKnown: true, ageDays: 1, ageSource: 'created' });
        assert.strictEqual(gateFor(r.age).ok, false);
    });

    await test('post-cutoff pre-aged guest: 7-day-old account whose first verified email lands now is refused', async function () {
        const a = authUser('guest1', NOW - 7 * DAY - 3600000);
        const db = withHeld({ 'users/guest1': { points: 50 } });
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

    await test('post-cutoff pre-aged guest linking Google (first provider) is stamped now', async function () {
        const a = authUser('guest2', NOW - 30 * DAY, {
            email: 'g2@gmail.com',
            providerData: [{ providerId: 'google.com', uid: 'google-sub-2' }],
        });
        const db = withHeld({ 'users/guest2': {} });
        const r = await emailChange.beginPayout(db, authApiFor({ guest2: a }), 'guest2', a, NOW, {}, true);
        assert.strictEqual(db.docs.get('users/guest2').realAccountAt, NOW);
        assert.strictEqual(gateFor(r.age).ok, false);
    });

    await test('post-cutoff Lightning/Nostr account that adds its first email after 7 days waits 7 days from the email', async function () {
        const a = authUser('ln:abc', NOW - 20 * DAY, { providerData: [] });
        const db = withHeld({
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
        const db = withHeld({});
        await emailChange.reconcileEmail(db, authApiFor({ new1: a }), 'new1', a, NOW, {}, true);
        assert.strictEqual(db.docs.get('users/new1').realAccountAt, created);
        const later = await emailChange.beginPayout(db, authApiFor({ new1: a }), 'new1', a, created + 7 * DAY, {}, true);
        assert.strictEqual(gateFor(later.age).ok, true);
    });

    await test('existing synced player without realAccountAt keeps creationTime (no lockout, no stamp)', async function () {
        const a = authUser('old1', NOW - 200 * DAY);
        const db = withHeld({ 'users/old1': { emailHash: tomb.emailHmac(a.email), email: a.email, points: 9000, satsWithdrawn: 300 } });
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
        const db = withHeld({ 'users/chg1': { emailHash: tomb.emailHmac('chg1@example.com'), realAccountAt: NOW - 30 * DAY } });
        await emailChange.reconcileEmail(db, authApiFor({ chg1: a }), 'chg1', a, NOW, {}, true);
        const u = db.docs.get('users/chg1');
        assert.strictEqual(u.realAccountAt, NOW - 30 * DAY);
        assert.ok(u.satsHold > NOW, 'change still holds sats 72h');
    });

    await test('never-synced profile is not eligible until reconcile stamps it; unknown creation is refused', async function () {
        // NOW-10d is after the cutoff, so unsynced still waits for a stamp.
        assert.deepStrictEqual(realAccountAge.ageFrom(authUser('x', NOW - 10 * DAY), {}, NOW), { ageKnown: true, ageDays: 0, ageSource: 'linked' });
        assert.strictEqual(realAccountAge.ageFrom({ metadata: {} }, { emailHash: 'h' }, NOW).ageKnown, false);
        assert.strictEqual(gateFor(realAccountAge.ageFrom({ metadata: {} }, { emailHash: 'h' }, NOW)).ok, false);
    });

    await test('backfill plan: pre-cutoff non-held accounts get creationTime; held and post-cutoff are skipped', async function () {
        const created = CUTOFF - 100 * DAY;
        const noneHeld = emptyHeld();
        const real = authUser('b1', created);
        assert.deepStrictEqual(backfill.planFor(real, {}, noneHeld), { action: 'set', realAccountAt: created });
        assert.deepStrictEqual(backfill.planFor(real, { emailHash: 'h' }, noneHeld), { action: 'set', realAccountAt: created }, 'already-synced pre-cutoff still set');
        assert.strictEqual(backfill.planFor(real, { realAccountAt: 5 }, noneHeld).reason, 'already_set');
        assert.strictEqual(backfill.planFor(real, null, noneHeld).reason, 'no_profile');
        const guest = { uid: 'anon', providerData: [], metadata: { creationTime: new Date(created).toUTCString() } };
        assert.deepStrictEqual(backfill.planFor(guest, {}, noneHeld), { action: 'set', realAccountAt: created }, 'pre-cutoff guest is set');
        const post = authUser('newp', CUTOFF + 2 * DAY);
        assert.strictEqual(backfill.planFor(post, {}, noneHeld).reason, 'post_cutoff');
        const unknown = { uid: 'n', providerData: [], metadata: {} };
        assert.strictEqual(backfill.planFor(unknown, {}, noneHeld).reason, 'no_creation_time');
        const heldUser = authUser('held-test-aaa', created);
        const skip = backfill.planFor(heldUser, {}, heldOf('held-test-aaa'));
        assert.strictEqual(skip.reason, 'held');
        assert.strictEqual(skip.group, 'test');
        assert.strictEqual(backfill.planFor(real, {}, { ok: false, reason: 'missing' }).reason, 'held_list_unavailable');
        assert.deepStrictEqual(backfill.parseArgs(['--apply']), { apply: false, applyRequested: true, confirm: false, project: '' });
        assert.strictEqual(backfill.parseArgs(['--project=bitcoin-quest-staging']).project, 'bitcoin-quest-staging');
        assert.strictEqual(backfill.parseArgs(['--project=../x']).project, '');
    });

    await test('backfill script refuses to run without --project (no default to live)', async function () {
        const src = fs.readFileSync(path.join(root, 'functions', 'scripts', 'backfill-real-account-at.js'), 'utf8');
        assert.ok(!src.includes("'bitcoin-education-archive'"), 'no hard-coded live project');
        assert.ok(src.includes('counts.held'), 'dry run counts per held group');
        assert.ok(!src.includes('sample'), 'dry run is counts only');
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
        assert.deepStrictEqual(await backfill.applyOne(fresh, a, emptyHeld()), { written: true });
        assert.strictEqual(fresh.store.doc.realAccountAt, created);
        assert.strictEqual(fresh.store.doc.points, 5);
        const already = txDb({ realAccountAt: NOW });
        assert.deepStrictEqual(await backfill.applyOne(already, a, emptyHeld()), { written: false, reason: 'already_set' });
        assert.strictEqual(already.store.doc.realAccountAt, NOW, 'never overwritten');
        const synced = txDb({ emailHash: 'h' });
        assert.deepStrictEqual(await backfill.applyOne(synced, a, emptyHeld()), { written: true }, 'pre-cutoff synced is written');
        assert.strictEqual(synced.store.doc.realAccountAt, created);
        assert.strictEqual(synced.store.doc.emailHash, 'h');
    });


    await test('old-guest: pre-cutoff guest first email is credited from creationTime and may claim after 7 days', async function () {
        const created = CUTOFF - 7 * DAY;
        const a = guestAuth('guestOld', created);
        const db = withHeld({ 'users/guestOld': { points: 50 } });
        const r = await emailChange.beginPayout(db, authApiFor({ guestOld: a }), 'guestOld', a, NOW, {}, true);
        assert.strictEqual(r.ok, true);
        assert.strictEqual(db.docs.get('users/guestOld').realAccountAt, created);
        assert.deepStrictEqual(r.age, { ageKnown: true, ageDays: Math.floor((NOW - created) / DAY), ageSource: 'created' });
        assert.strictEqual(gateFor(r.age).ok, true);
        const later = await emailChange.beginPayout(db, authApiFor({ guestOld: a }), 'guestOld', a, NOW + DAY, {}, true);
        assert.strictEqual(db.docs.get('users/guestOld').realAccountAt, created, 'never re-stamped');
        assert.strictEqual(gateFor(later.age).ok, true);
    });

    await test('old-LN: pre-cutoff Lightning account first email is credited from creationTime', async function () {
        const created = CUTOFF - 20 * DAY;
        const a = guestAuth('ln:oldabc', created);
        const db = withHeld({
            'users/ln:oldabc': {},
            ['email_link_claims/' + tomb.emailHmac(a.email)]: { uid: 'ln:oldabc', expireAt: NOW + 3600000 },
        });
        const r = await emailChange.beginPayout(db, authApiFor({ 'ln:oldabc': a }), 'ln:oldabc', a, NOW, {}, true);
        assert.strictEqual(r.ok, true);
        assert.strictEqual(db.docs.get('users/ln:oldabc').realAccountAt, created);
        assert.strictEqual(r.age.ageSource, 'created');
        assert.strictEqual(r.age.ageDays, Math.floor((NOW - created) / DAY));
        assert.strictEqual(gateFor(r.age).ok, true);
    });

    await test('old-email: pre-cutoff synced account uses creationTime and backfill will set the field; later change does not re-stamp', async function () {
        const created = CUTOFF - 200 * DAY;
        const a = authUser('oldEmail', created);
        const profile = { emailHash: tomb.emailHmac(a.email), email: a.email, points: 9000 };
        const age = realAccountAge.ageFrom(a, profile, NOW);
        assert.deepStrictEqual(age, { ageKnown: true, ageDays: Math.floor((NOW - created) / DAY), ageSource: 'created' });
        assert.strictEqual(gateFor(age).ok, true);
        assert.deepStrictEqual(backfill.planFor(a, profile, emptyHeld()), { action: 'set', realAccountAt: created });
        const db = withHeld({ 'users/oldEmail': Object.assign({ realAccountAt: created }, profile) });
        const changed = authUser('oldEmail', created, { email: 'new-oldemail@example.com' });
        await emailChange.reconcileEmail(db, authApiFor({ oldEmail: changed }), 'oldEmail', changed, NOW, {}, true);
        const u = db.docs.get('users/oldEmail');
        assert.strictEqual(u.realAccountAt, created, 'never re-stamped');
        assert.ok(u.satsHold > NOW, 'change still holds sats 72h');
    });

    await test('held-skip: listed uid stays unset in backfill, stamps now on first identity, and has no legacySynced fallback', async function () {
        const created = CUTOFF - 100 * DAY;
        const uid = 'held-test-aaa';
        const a = authUser(uid, created);
        const held = heldOf(uid);
        const plan = backfill.planFor(a, { emailHash: 'h' }, held);
        assert.strictEqual(plan.action, 'skip');
        assert.strictEqual(plan.reason, 'held');
        const unsyncedAge = realAccountAge.ageFrom(a, { emailHash: 'h' }, NOW, held);
        assert.deepStrictEqual(unsyncedAge, { ageKnown: true, ageDays: 0, ageSource: 'linked' }, 'no creationTime fallback');
        assert.strictEqual(gateFor(unsyncedAge).ok, false);
        const db = withHeld({ ['users/' + uid]: {} }, [uid]);
        const r = await emailChange.beginPayout(db, authApiFor({ [uid]: a }), uid, a, NOW, {}, true);
        assert.strictEqual(db.docs.get('users/' + uid).realAccountAt, NOW);
        assert.deepStrictEqual(r.age, { ageKnown: true, ageDays: 0, ageSource: 'linked' });
        assert.strictEqual(gateFor(r.age).ok, false);
        const again = await emailChange.beginPayout(db, authApiFor({ [uid]: a }), uid, a, NOW + 7 * DAY, {}, true);
        assert.strictEqual(db.docs.get('users/' + uid).realAccountAt, NOW, 'never re-stamped');
        assert.strictEqual(gateFor(again.age).ok, true);
    });

    await test('held-skip: a second listed uid (watch-group stand-in) is skipped too', async function () {
        const created = CUTOFF - 50 * DAY;
        const uid = 'held-test-watch';
        const a = authUser(uid, created);
        const held = heldOf(uid);
        const plan = backfill.planFor(a, {}, held);
        assert.strictEqual(plan.reason, 'held');
        assert.strictEqual(realAccountAge.stampFor({}, a, NOW, held), NOW);
        assert.deepStrictEqual(realAccountAge.ageFrom(a, { emailHash: 'h' }, NOW, held), { ageKnown: true, ageDays: 0, ageSource: 'linked' });
    });

    await test('held guest that links email or a provider stays held (same uid)', async function () {
        const created = CUTOFF - 40 * DAY;
        const uid = 'held-guest-1';
        const a = guestAuth(uid, created);
        const db = withHeld({ ['users/' + uid]: { points: 10 } }, [uid]);
        const r = await emailChange.beginPayout(db, authApiFor({ [uid]: a }), uid, a, NOW, {}, true);
        assert.strictEqual(r.ok, true);
        assert.strictEqual(db.docs.get('users/' + uid).realAccountAt, NOW);
        assert.strictEqual(r.age.ageSource, 'linked');
        assert.strictEqual(gateFor(r.age).ok, false);
        // Same uid with a provider added later stays held: no creationTime fallback,
        // and the existing stamp is not rewritten.
        const linked = guestAuth(uid, created, {
            providerData: [{ providerId: 'google.com', uid: 'google-sub-held' }],
        });
        const held = heldOf(uid);
        const profile = db.docs.get('users/' + uid);
        assert.strictEqual(realAccountAge.stampFor(profile, linked, NOW + DAY, held), null);
        const age = realAccountAge.ageFrom(linked, profile, NOW + DAY, held);
        assert.strictEqual(age.ageSource, 'linked');
        assert.strictEqual(gateFor(age).ok, false);
        assert.strictEqual(backfill.planFor(linked, profile, held).reason, 'held');
    });

    await test('released held account still stamps now, with no creationTime fallback', async function () {
        const created = CUTOFF - 80 * DAY;
        const uid = 'held-released-1';
        const a = authUser(uid, created);
        const profile = { emailHash: tomb.emailHmac(a.email), email: a.email };
        const held = heldOf(uid);
        assert.strictEqual(realAccountAge.stampFor(profile, a, NOW, held), NOW);
        assert.deepStrictEqual(realAccountAge.ageFrom(a, profile, NOW, held), { ageKnown: true, ageDays: 0, ageSource: 'linked' });
        assert.strictEqual(backfill.planFor(a, profile, held).reason, 'held');
    });

    await test('post-cutoff-new: under 24h stamps creationTime; over 24h stamps now', async function () {
        const freshCreated = CUTOFF + 2 * 3600000;
        const freshNow = freshCreated + 3 * 3600000;
        const fresh = authUser('postFresh', freshCreated);
        const db = withHeld({});
        await emailChange.reconcileEmail(db, authApiFor({ postFresh: fresh }), 'postFresh', fresh, freshNow, {}, true);
        assert.strictEqual(db.docs.get('users/postFresh').realAccountAt, freshCreated);
        const later = await emailChange.beginPayout(db, authApiFor({ postFresh: fresh }), 'postFresh', fresh, freshCreated + 7 * DAY, {}, true);
        assert.strictEqual(gateFor(later.age).ok, true);

        const oldCreated = CUTOFF + 2 * DAY;
        const oldNow = oldCreated + 2 * DAY;
        const aged = guestAuth('postAged', oldCreated);
        const db2 = withHeld({ 'users/postAged': { points: 1 } });
        const r = await emailChange.beginPayout(db2, authApiFor({ postAged: aged }), 'postAged', aged, oldNow, {}, true);
        assert.strictEqual(db2.docs.get('users/postAged').realAccountAt, oldNow);
        assert.deepStrictEqual(r.age, { ageKnown: true, ageDays: 0, ageSource: 'linked' });
        assert.strictEqual(gateFor(r.age).ok, false);
        assert.strictEqual(backfill.planFor(aged, { points: 1 }, emptyHeld()).reason, 'post_cutoff');
    });


    await test('fail-closed: a missing config/ageGateHeld doc refuses claims with unavailable', async function () {
        ageGateHeld.resetCache();
        const a = authUser('open1', CUTOFF - 20 * DAY);
        const db = createDb({ 'users/open1': { emailHash: tomb.emailHmac(a.email), email: a.email } });
        const r = await emailChange.beginPayout(db, authApiFor({ open1: a }), 'open1', a, NOW, {}, true);
        assert.strictEqual(r.ok, false);
        assert.strictEqual(r.unavailable, true);
        assert.strictEqual(r.reason, 'missing');
        assert.ok(r.error);
    });

    await test('fail-closed: an unreadable config/ageGateHeld doc refuses claims with unavailable', async function () {
        ageGateHeld.resetCache();
        const a = authUser('open2', CUTOFF - 20 * DAY);
        const db = createDb({
            'users/open2': { emailHash: tomb.emailHmac(a.email), email: a.email },
            'config/ageGateHeld': { uids: 'not-an-array' },
        });
        const r = await emailChange.beginPayout(db, authApiFor({ open2: a }), 'open2', a, NOW, {}, true);
        assert.strictEqual(r.ok, false);
        assert.strictEqual(r.unavailable, true);
        assert.strictEqual(r.reason, 'unreadable');
    });

    await test('fail-closed: a thrown read of config/ageGateHeld is unreadable, not an empty list', async function () {
        ageGateHeld.resetCache();
        const db = {
            collection: function () {
                return {
                    doc: function () {
                        return { get: async function () { throw new Error('unavailable'); } };
                    },
                };
            },
        };
        const held = await ageGateHeld.loadHeld(db);
        assert.strictEqual(held.ok, false);
        assert.strictEqual(held.reason, 'unreadable');
        assert.ok(!held.uids, 'must not look like an empty successful list');
    });

    await test('staging overrides are honored only on bitcoin-quest-staging and ignored on live', async function () {
        try {
            const qaCutoff = CUTOFF + 10 * DAY;
            const extra = 'qaTestPrefix';
            process.env.AGE_GATE_CUTOFF_MS = String(qaCutoff);
            process.env.AGE_GATE_HELD_EXTRA = extra;

            setProject(ageGateHeld.LIVE_PROJECT);
            assert.strictEqual(ageGateHeld.cutoffMs(), CUTOFF);
            assert.strictEqual(ageGateHeld.isHeldUid(extra + 'FakeUid', emptyHeld()), false);

            setProject(ageGateHeld.STAGING_PROJECT);
            assert.strictEqual(ageGateHeld.cutoffMs(), qaCutoff);
            assert.strictEqual(ageGateHeld.isHeldUid(extra + 'FakeUid', emptyHeld()), true, 'extra prefix is added on staging');
            assert.strictEqual(ageGateHeld.isHeldUid('held-test-aaa', heldOf('held-test-aaa')), true, 'existing list is not removed');
            const createdBeforeOverride = CUTOFF + 5 * DAY;
            assert.strictEqual(realAccountAge.isPreCutoff(createdBeforeOverride), true, 'staging cutoff moves the pre-cutoff line');
        } finally {
            delete process.env.AGE_GATE_CUTOFF_MS;
            delete process.env.AGE_GATE_HELD_EXTRA;
            setProject('');
            restoreEnv();
        }
    });

    await test('seed-age-gate-held: private file path, counts only, confirm required, no default project', async function () {
        const src = fs.readFileSync(path.join(root, 'scripts', 'seed-age-gate-held.js'), 'utf8');
        assert.ok(!src.includes("'bitcoin-education-archive'"), 'no hard-coded live project');
        assert.ok(src.includes('--confirm=AGEGATEHELD'));
        assert.ok(src.includes('--expect-count='));
        assert.ok(!/console\.log\([^)]*uid/i.test(src), 'no uid logging');
        const emptyApply = seedHeld.parseArgs(['--apply']);
        assert.strictEqual(emptyApply.apply, false);
        assert.strictEqual(emptyApply.applyRequested, true);
        assert.strictEqual(emptyApply.confirm, false);
        assert.strictEqual(emptyApply.project, '');
        assert.strictEqual(emptyApply.file, '');
        assert.strictEqual(emptyApply.expectCount.present, false);
        assert.strictEqual(emptyApply.staging, false);
        const staged = seedHeld.parseArgs(['--project=bitcoin-quest-staging', '--file=/tmp/x.json']);
        assert.strictEqual(staged.project, 'bitcoin-quest-staging');
        assert.strictEqual(staged.staging, true);
        const tmp = path.join('/tmp', 'minirufus-l1b-seed-fake.json');
        fs.writeFileSync(tmp, JSON.stringify(['fake-uid-one', 'fake-uid-two', 'fake-uid-three']));
        const parsed = seedHeld.parseListFile(tmp);
        assert.strictEqual(parsed.ok, true);
        assert.deepStrictEqual(seedHeld.countsOf(parsed.uids), { total: 3 });
        fs.unlinkSync(tmp);
        const r = require('child_process').spawnSync(process.execPath, [path.join(root, 'scripts', 'seed-age-gate-held.js')], { encoding: 'utf8' });
        assert.strictEqual(r.status, 2);
        assert.ok(/--project/.test(r.stderr));
        const r2 = require('child_process').spawnSync(process.execPath, [path.join(root, 'scripts', 'seed-age-gate-held.js'), '--project=bitcoin-quest-staging', '--file=/tmp/missing-held.json', '--apply'], { encoding: 'utf8' });
        assert.strictEqual(r2.status, 2);
    });

    await test('seed apply path initializes without admin.apps and writes only with confirm', async function () {
        let inited = 0;
        let written = null;
        const fakeAdmin = {
            getApps: function () { return this._apps || []; },
            initializeApp: function (opts) {
                inited += 1;
                this.options = opts;
                this._apps = [{ options: opts }];
            },
            firestore: function () {
                return {
                    collection: function (name) {
                        return {
                            doc: function (id) {
                                return {
                                    set: async function (doc) {
                                        written = { collection: name, id: id, doc: doc };
                                    },
                                };
                            },
                        };
                    },
                };
            },
        };
        const tmp = path.join('/tmp', 'minirufus-l1b-seed-apply-fake.json');
        fs.writeFileSync(tmp, JSON.stringify(['fake-uid-apply-1']));
        try {
            const dry = await seedHeld.main([
                '--project=bitcoin-quest-staging',
                '--file=' + tmp,
            ], { admin: fakeAdmin });
            assert.strictEqual(dry.apply, false);
            assert.strictEqual(dry.staging, true);
            assert.strictEqual(dry.counts.total, 1);
            assert.strictEqual(inited, 0, 'dry run does not initialize');
            assert.strictEqual(written, null, 'dry run does not write');

            const db = seedHeld.ensureFirestore(fakeAdmin, 'bitcoin-quest-staging');
            assert.strictEqual(inited, 1, 'missing admin.apps does not throw');
            assert.ok(db);

            const applied = await seedHeld.main([
                '--project=bitcoin-quest-staging',
                '--file=' + tmp,
                '--apply',
                '--confirm=AGEGATEHELD',
                '--expect-count=1',
            ], { admin: fakeAdmin });
            assert.strictEqual(applied.apply, true);
            assert.strictEqual(applied.written, true);
            assert.strictEqual(written.collection, 'config');
            assert.strictEqual(written.id, 'ageGateHeld');
            assert.ok(written.doc && Array.isArray(written.doc.uids));
            assert.strictEqual(written.doc.uids[0], 'fake-uid-apply-1');
            assert.ok(inited >= 1);

            const like14 = {
                initializeApp: function () { like14.inited = true; },
                firestore: function () { return { ok: true }; },
            };
            assert.doesNotThrow(function () {
                seedHeld.ensureFirestore(like14, 'bitcoin-quest-staging');
            }, 'firebase-admin 14 apps-undefined shape must not throw');
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    function writeTmpJson(name, value) {
        const tmp = path.join('/tmp', name);
        fs.writeFileSync(tmp, typeof value === 'string' ? value : JSON.stringify(value));
        return tmp;
    }

    function seedFakeAdmin() {
        const state = { inited: 0, written: null };
        const fake = {
            getApps: function () { return this._apps || []; },
            initializeApp: function (opts) {
                state.inited += 1;
                this.options = opts;
                this._apps = [{ options: opts }];
            },
            firestore: function () {
                return {
                    collection: function (name) {
                        return {
                            doc: function (id) {
                                return {
                                    set: async function (doc) {
                                        state.written = { collection: name, id: id, doc: doc };
                                    },
                                };
                            },
                        };
                    },
                };
            },
        };
        return { admin: fake, state: state };
    }

    const SERVER_NOW = { sentinel: 'serverTimestamp' };

    function releaseFakeAdmin(initial) {
        const docs = new Map();
        Object.keys(initial || {}).forEach(function (k) { docs.set(k, Object.assign({}, initial[k])); });
        let inited = 0;
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
            };
        }
        function firestore() {
            return {
                collection: function (name) {
                    return { doc: function (id) { return ref(name + '/' + id); } };
                },
                runTransaction: async function (fn) {
                    const pending = [];
                    const tx = {
                        get: async function (r) { return r.get(); },
                        set: function (r, data, opts) { pending.push(function () { return r.set(data, opts); }); },
                    };
                    await fn(tx);
                    for (let i = 0; i < pending.length; i++) await pending[i]();
                },
            };
        }
        firestore.FieldValue = { serverTimestamp: function () { return SERVER_NOW; } };
        const admin = {
            getApps: function () { return this._apps || []; },
            initializeApp: function (opts) {
                inited += 1;
                this.options = opts;
                this._apps = [{ options: opts }];
            },
            firestore: firestore,
        };
        return { admin: admin, docs: docs, initedOf: function () { return inited; } };
    }

    await test('uid list shape: only a JSON array of distinct uid strings is accepted', async function () {
        function parse(value) {
            const tmp = writeTmpJson('minirufus-agegate-shape.json', value);
            try { return uidList.parseUidArrayFile(tmp); }
            finally { fs.unlinkSync(tmp); }
        }
        assert.strictEqual(parse({ groups: { test: ['fake-uid-one'] } }).reason, 'not_uid_array');
        assert.strictEqual(parse({ uids: ['fake-uid-one'] }).reason, 'not_uid_array');
        assert.strictEqual(uidList.parseUidArrayText('not-json').reason, 'invalid_json');
        assert.strictEqual(uidList.parseUidArrayText('').reason, 'empty_file');
        assert.strictEqual(parse([]).reason, 'empty_list');
        assert.strictEqual(parse(['fake-uid-one', '']).reason, 'invalid_uid');
        assert.strictEqual(parse(['fake-uid-one', '  fake-uid-two']).reason, 'invalid_uid');
        assert.strictEqual(parse(['fake-uid-one', 1]).reason, 'invalid_uid');
        assert.strictEqual(parse(['fake-uid-one', null]).reason, 'invalid_uid');
        assert.strictEqual(parse(['fake-uid-one', 'fake-uid-one']).reason, 'duplicate_uids');
        const ok = parse(['fake-uid-one', 'fake-uid-two']);
        assert.strictEqual(ok.ok, true);
        assert.strictEqual(ok.total, 2);
        assert.deepStrictEqual(ok.doc, { uids: ['fake-uid-one', 'fake-uid-two'] });
    });

    await test('seed and release refuse a count mismatch and write nothing', async function () {
        const tmp = writeTmpJson('minirufus-agegate-count.json', ['fake-uid-one', 'fake-uid-two']);
        const seed = seedFakeAdmin();
        const rel = releaseFakeAdmin({ 'config/ageGateHeld': { uids: ['fake-uid-one', 'fake-uid-two'] } });
        try {
            await assert.rejects(function () {
                return seedHeld.main([
                    '--project=bitcoin-quest-staging',
                    '--file=' + tmp,
                    '--apply',
                    '--confirm=AGEGATEHELD',
                    '--expect-count=1',
                ], { admin: seed.admin });
            }, function (e) { return /expect-count does not match/.test(e.message) && e.exitCode === 2; });
            assert.strictEqual(seed.state.written, null);
            assert.strictEqual(seed.state.inited, 0);

            await assert.rejects(function () {
                return seedHeld.main([
                    '--project=bitcoin-quest-staging',
                    '--file=' + tmp,
                    '--apply',
                    '--confirm=AGEGATEHELD',
                ], { admin: seed.admin });
            }, function (e) { return /expect-count/.test(e.message) && e.exitCode === 2; });
            assert.strictEqual(seed.state.written, null);

            await assert.rejects(function () {
                return releaseHeld.main([
                    '--project=bitcoin-quest-staging',
                    '--file=' + tmp,
                    '--apply',
                    '--confirm=AGEGATERELEASE',
                    '--expect-count=9',
                ], { admin: rel.admin });
            }, function (e) { return /expect-count does not match/.test(e.message) && e.exitCode === 2; });
            assert.strictEqual(rel.initedOf(), 0);
            assert.deepStrictEqual(rel.docs.get('config/ageGateHeld').uids, ['fake-uid-one', 'fake-uid-two']);
            assert.strictEqual(rel.docs.has('users/fake-uid-one'), false);
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    await test('release dry run writes nothing; apply removes from held and stamps realAccountAt', async function () {
        const tmp = writeTmpJson('minirufus-agegate-release-apply.json', ['fake-uid-rel-1', 'fake-uid-rel-2']);
        const prior = Date.parse('2026-01-01T00:00:00.000Z');
        const rel = releaseFakeAdmin({
            'config/ageGateHeld': { uids: ['fake-uid-rel-1', 'fake-uid-rel-2', 'fake-uid-keep'], groups: { test: ['fake-uid-rel-1'] } },
            'users/fake-uid-rel-1': { emailHash: 'h', realAccountAt: prior },
        });
        try {
            const dry = await releaseHeld.main([
                '--project=bitcoin-quest-staging',
                '--file=' + tmp,
            ], { admin: rel.admin });
            assert.strictEqual(dry.apply, false);
            assert.strictEqual(dry.staging, true);
            assert.strictEqual(dry.counts.total, 2);
            assert.strictEqual(dry.counts.held, 2);
            assert.strictEqual(dry.counts.not_held, 0);
            assert.ok(rel.initedOf() >= 1, 'dry run reads the held doc');
            assert.strictEqual(rel.docs.get('users/fake-uid-rel-1').realAccountAt, prior, 'dry run does not stamp');
            assert.deepStrictEqual(rel.docs.get('config/ageGateHeld').uids, ['fake-uid-rel-1', 'fake-uid-rel-2', 'fake-uid-keep']);

            const applied = await releaseHeld.main([
                '--project=bitcoin-quest-staging',
                '--file=' + tmp,
                '--apply',
                '--confirm=AGEGATERELEASE',
                '--expect-count=2',
            ], { admin: rel.admin });
            assert.strictEqual(applied.apply, true);
            assert.strictEqual(applied.written, true);
            assert.strictEqual(applied.counts.removed, 2);
            assert.strictEqual(applied.counts.stamped, 2);
            assert.strictEqual(applied.counts.not_held, 0);
            assert.strictEqual(applied.counts.held, 2);
            assert.deepStrictEqual(rel.docs.get('config/ageGateHeld').uids, ['fake-uid-keep']);
            assert.deepStrictEqual(rel.docs.get('config/ageGateHeld').groups.test, []);
            assert.strictEqual(rel.docs.get('users/fake-uid-rel-1').realAccountAt, SERVER_NOW);
            assert.strictEqual(rel.docs.get('users/fake-uid-rel-1').emailHash, 'h');
            assert.strictEqual(rel.docs.get('users/fake-uid-rel-2').realAccountAt, SERVER_NOW);
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    await test('release skips uids that are not in the held doc and reports not_held', async function () {
        const tmp = writeTmpJson('minirufus-agegate-nothold.json', ['fake-uid-held-1', 'fake-uid-skip-1', 'fake-uid-held-2']);
        const prior = Date.parse('2026-02-01T00:00:00.000Z');
        const rel = releaseFakeAdmin({
            'config/ageGateHeld': { uids: ['fake-uid-held-1', 'fake-uid-held-2', 'fake-uid-keep'] },
            'users/fake-uid-held-1': { emailHash: 'h', realAccountAt: prior },
            'users/fake-uid-skip-1': { emailHash: 's', realAccountAt: prior },
        });
        try {
            const dry = await releaseHeld.main([
                '--project=bitcoin-quest-staging',
                '--file=' + tmp,
            ], { admin: rel.admin });
            assert.strictEqual(dry.apply, false);
            assert.strictEqual(dry.counts.total, 3);
            assert.strictEqual(dry.counts.held, 2);
            assert.strictEqual(dry.counts.not_held, 1);
            assert.strictEqual(rel.docs.get('users/fake-uid-held-1').realAccountAt, prior);
            assert.strictEqual(rel.docs.get('users/fake-uid-skip-1').realAccountAt, prior);
            assert.deepStrictEqual(rel.docs.get('config/ageGateHeld').uids, ['fake-uid-held-1', 'fake-uid-held-2', 'fake-uid-keep']);

            const applied = await releaseHeld.main([
                '--project=bitcoin-quest-staging',
                '--file=' + tmp,
                '--apply',
                '--confirm=AGEGATERELEASE',
                '--expect-count=3',
            ], { admin: rel.admin });
            assert.strictEqual(applied.apply, true);
            assert.strictEqual(applied.written, true);
            assert.strictEqual(applied.counts.total, 3);
            assert.strictEqual(applied.counts.removed, 2);
            assert.strictEqual(applied.counts.stamped, 2);
            assert.strictEqual(applied.counts.held, 2);
            assert.strictEqual(applied.counts.not_held, 1);
            assert.deepStrictEqual(rel.docs.get('config/ageGateHeld').uids, ['fake-uid-keep']);
            assert.strictEqual(rel.docs.get('users/fake-uid-held-1').realAccountAt, SERVER_NOW);
            assert.strictEqual(rel.docs.get('users/fake-uid-held-1').emailHash, 'h');
            assert.strictEqual(rel.docs.get('users/fake-uid-held-2').realAccountAt, SERVER_NOW);
            assert.strictEqual(rel.docs.get('users/fake-uid-skip-1').realAccountAt, prior, 'not_held uid is not stamped');
            assert.strictEqual(rel.docs.get('users/fake-uid-skip-1').emailHash, 's');
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    await test('release dry run fails closed if the held doc is missing or unreadable', async function () {
        const tmp = writeTmpJson('minirufus-agegate-missing-held.json', ['fake-uid-held-1']);
        const missing = releaseFakeAdmin({});
        const unread = releaseFakeAdmin({ 'config/ageGateHeld': { uids: 'not-an-array' } });
        try {
            await assert.rejects(function () {
                return releaseHeld.main([
                    '--project=bitcoin-quest-staging',
                    '--file=' + tmp,
                ], { admin: missing.admin });
            }, function (e) { return /held doc is missing/.test(e.message) && e.exitCode === 1; });
            assert.strictEqual(missing.docs.has('users/fake-uid-held-1'), false);

            await assert.rejects(function () {
                return releaseHeld.main([
                    '--project=bitcoin-quest-staging',
                    '--file=' + tmp,
                ], { admin: unread.admin });
            }, function (e) { return /held doc is unreadable/.test(e.message) && e.exitCode === 1; });
            assert.strictEqual(unread.docs.has('users/fake-uid-held-1'), false);
        } finally {
            fs.unlinkSync(tmp);
        }
    });

    await test('release and seed gates, and staging comes from --project only', async function () {
        const srcRel = fs.readFileSync(path.join(root, 'scripts', 'release-age-gate-held.js'), 'utf8');
        const srcSeed = fs.readFileSync(path.join(root, 'scripts', 'seed-age-gate-held.js'), 'utf8');
        const srcList = fs.readFileSync(path.join(root, 'scripts', 'age-gate-uid-list.js'), 'utf8');
        assert.ok(srcRel.includes('--confirm=AGEGATERELEASE'));
        assert.ok(srcSeed.includes('--confirm=AGEGATEHELD'));
        assert.ok(!srcRel.includes("'bitcoin-education-archive'"), 'no hard-coded live project');
        assert.ok(!/console\.log\([^)]*uid/i.test(srcRel), 'no uid logging');
        assert.ok(!srcList.includes('GCLOUD_PROJECT'));
        assert.ok(!srcList.includes('GOOGLE_CLOUD_PROJECT'));
        assert.ok(!srcList.includes('FIREBASE_CONFIG'));
        assert.ok(!srcRel.includes('process.env'));
        assert.ok(!srcSeed.includes('process.env'));

        const tmp = writeTmpJson('minirufus-agegate-gate.json', ['fake-uid-gate-1']);
        const seed = seedFakeAdmin();
        const rel = releaseFakeAdmin({ 'config/ageGateHeld': { uids: ['fake-uid-gate-1'] } });
        const prevGcloud = process.env.GCLOUD_PROJECT;
        const prevGoogle = process.env.GOOGLE_CLOUD_PROJECT;
        process.env.GCLOUD_PROJECT = 'bitcoin-quest-staging';
        process.env.GOOGLE_CLOUD_PROJECT = 'bitcoin-quest-staging';
        try {
            const liveDry = await releaseHeld.main([
                '--project=not-a-staging-proj',
                '--file=' + tmp,
            ], { admin: rel.admin });
            assert.strictEqual(liveDry.staging, false, 'env staging must not win over --project');
            assert.strictEqual(liveDry.apply, false);
            assert.strictEqual(liveDry.counts.not_held, 0);
            assert.strictEqual(rel.docs.get('users/fake-uid-gate-1'), undefined, 'dry run does not stamp');
            assert.deepStrictEqual(rel.docs.get('config/ageGateHeld').uids, ['fake-uid-gate-1']);

            const staged = releaseHeld.parseArgs(['--project=bitcoin-quest-staging', '--file=' + tmp]);
            assert.strictEqual(staged.staging, true);
            assert.strictEqual(uidList.isStagingProject('bitcoin-quest-staging'), true);
            assert.strictEqual(uidList.isStagingProject('not-a-staging-proj'), false);

            await assert.rejects(function () {
                return releaseHeld.main([
                    '--project=not-a-staging-proj',
                    '--file=' + tmp,
                    '--apply',
                ], { admin: rel.admin });
            }, function (e) { return /AGEGATERELEASE/.test(e.message) && e.exitCode === 2; });
            assert.strictEqual(rel.docs.get('users/fake-uid-gate-1'), undefined);

            await assert.rejects(function () {
                return seedHeld.main([
                    '--project=not-a-staging-proj',
                    '--file=' + tmp,
                    '--apply',
                    '--expect-count=1',
                ], { admin: seed.admin });
            }, function (e) { return /AGEGATEHELD/.test(e.message) && e.exitCode === 2; });
            assert.strictEqual(seed.state.written, null);

            const r = require('child_process').spawnSync(process.execPath, [
                path.join(root, 'scripts', 'release-age-gate-held.js'),
                '--project=bitcoin-quest-staging',
                '--file=' + tmp,
                '--apply',
            ], { encoding: 'utf8' });
            assert.strictEqual(r.status, 2);
            assert.ok(/AGEGATERELEASE/.test(r.stderr));
        } finally {
            if (prevGcloud === undefined) delete process.env.GCLOUD_PROJECT;
            else process.env.GCLOUD_PROJECT = prevGcloud;
            if (prevGoogle === undefined) delete process.env.GOOGLE_CLOUD_PROJECT;
            else process.env.GOOGLE_CLOUD_PROJECT = prevGoogle;
            fs.unlinkSync(tmp);
        }
    });


    await test('rules sha256 is unchanged at 998d7570', async function () {
        const crypto = require('crypto');
        const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'firestore.rules'))).digest('hex');
        assert.strictEqual(sha, '998d757031fa9215f28e586bca2f31ada99b162e845788a3370cae88c9675fb8');
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

    } finally {
        restoreEnv();
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
