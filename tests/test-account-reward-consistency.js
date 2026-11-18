#!/usr/bin/env node
'use strict';
// Server-side checks for account reward consistency (guest sessions,
// guest links, cosmetic badges). Runs the real callables against the
// Firestore and Auth emulators.
//   node tests/test-account-reward-consistency.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

function freePort(start) {
    const script = [
        "const net = require('net');",
        'const start = ' + start + ';',
        'function tryPort(p) {',
        '  if (p > start + 30) { console.log(String(start)); process.exit(0); }',
        '  const server = net.createServer();',
        "  server.once('error', function () { tryPort(p + 1); });",
        "  server.listen(p, '127.0.0.1', function () {",
        "    server.close(function () { console.log(String(p)); process.exit(0); });",
        '  });',
        '}',
        'tryPort(start);',
    ].join('\n');
    const out = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
    const port = parseInt(String(out.stdout || '').trim(), 10);
    return Number.isFinite(port) ? port : start;
}

function unit() {
    const gate = require(path.join(root, 'functions/src/guestGate'));
    assert.strictEqual(gate.tokenProvider({ auth: { token: { firebase: { sign_in_provider: 'anonymous' } } } }), 'anonymous');
    assert.strictEqual(gate.tokenProvider({ auth: { token: {} } }), '');
    assert.strictEqual(gate.hasRealProvider({ providerData: [] }), false);
    assert.strictEqual(gate.hasRealProvider({ providerData: [{ providerId: 'password' }] }), true);
    const { guestMovePatch } = require(path.join(root, 'functions/src/onboardingApi'));
    const cut = Date.UTC(2026, 10, 19, 4, 0, 0);
    assert.deepStrictEqual(guestMovePatch(300, 2, cut - 1, cut), { unclaimableXp: 0, leaderboardXp: 300, guestMovedXp: 300, guestMovedTickets: 2 });
    assert.deepStrictEqual(guestMovePatch(300, 2, cut, cut), { unclaimableXp: 300, leaderboardXp: 0, guestMovedXp: 300, guestMovedTickets: 2 });
    assert.deepStrictEqual(guestMovePatch(300, 2, null, cut), { unclaimableXp: 300, leaderboardXp: 0, guestMovedXp: 300, guestMovedTickets: 2 });
    assert.deepStrictEqual(guestMovePatch(-5, 'x', cut - 1, cut), { unclaimableXp: 0, leaderboardXp: 0, guestMovedXp: 0, guestMovedTickets: 0 });
    const onboarding = require(path.join(root, 'functions/src/onboardingApi'));
    const { GUEST_XP_CUTOFF_MS, setGuestXpCutoffMs, guestMovePatch: patch } = onboarding;
    assert.ok(Number.isFinite(GUEST_XP_CUTOFF_MS) && GUEST_XP_CUTOFF_MS > Date.UTC(2026, 10, 18));
    const injected = Date.UTC(2026, 10, 20, 0, 0, 0);
    setGuestXpCutoffMs(injected);
    try {
        assert.strictEqual(onboarding.resolveGuestXpCutoffMs(), injected);
        assert.deepStrictEqual(patch(300, 2, injected - 1), { unclaimableXp: 0, leaderboardXp: 300, guestMovedXp: 300, guestMovedTickets: 2 });
        assert.deepStrictEqual(patch(300, 2, injected), { unclaimableXp: 300, leaderboardXp: 0, guestMovedXp: 300, guestMovedTickets: 2 });
    } finally {
        setGuestXpCutoffMs(null);
    }
    assert.strictEqual(onboarding.resolveGuestXpCutoffMs(), GUEST_XP_CUTOFF_MS);
    const indexSrc = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    const spin = indexSrc.slice(indexSrc.indexOf('exports.dailySpin = '), indexSrc.indexOf('exports.pvpStoreAnswerKey'));
    assert.ok(spin.includes('guestGate.isGuestCaller'));
    assert.strictEqual(spin.includes("sign_in_provider === 'anonymous'"), false);
    const weekly = indexSrc.slice(indexSrc.indexOf('exports.incrementWeeklyChallenge'), indexSrc.indexOf('exports.spendTickets = '));
    assert.ok(weekly.includes('guestGate.isGuestCaller'));
    assert.strictEqual(weekly.includes("sign_in_provider === 'anonymous'"), false);
    const onboardSrc = fs.readFileSync(path.join(root, 'functions/src/onboardingApi.js'), 'utf8');
    const prep = onboardSrc.slice(onboardSrc.indexOf('async function prepareGuestLink'), onboardSrc.indexOf('async function linkGuestAccount'));
    const link = onboardSrc.slice(onboardSrc.indexOf('async function linkGuestAccount'), onboardSrc.indexOf('async function setUsername'));
    assert.ok(prep.includes('guestGate.isGuestCaller'));
    assert.ok(link.includes('guestGate.isGuestCaller'));
    assert.strictEqual(prep.includes('isAnon(context)'), false);
    assert.strictEqual(link.includes('isAnon(context)'), false);
    console.log('  ok  unit helpers');
}

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    unit();
    const fsPort = freePort(8185);
    const authPort = freePort(9199);
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
    cfg.emulators = cfg.emulators || {};
    cfg.emulators.firestore = Object.assign({}, cfg.emulators.firestore, { port: fsPort });
    cfg.emulators.auth = Object.assign({}, cfg.emulators.auth, { port: authPort });
    const cfgPath = path.join(root, '.firebase-reward-consistency-' + fsPort + '.json');
    fs.writeFileSync(cfgPath, JSON.stringify(cfg));
    let status = 1;
    try {
        const child = spawnSync('npx', [
            '--yes', 'firebase-tools',
            'emulators:exec',
            '--config', cfgPath,
            '--only', 'firestore,auth',
            '--project', 'demo-reward-consistency',
            'node tests/test-account-reward-consistency.js',
        ], { cwd: root, stdio: 'inherit', env: Object.assign({}, process.env, { CI: 'true' }) });
        status = child.status == null ? 1 : child.status;
    } finally {
        try { fs.unlinkSync(cfgPath); } catch (e) { /* ignore */ }
    }
    process.exit(status);
}

let firebaseConfig = {};
try { firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG || '{}'); } catch (e) { firebaseConfig = {}; }
if (!firebaseConfig.projectId) firebaseConfig.projectId = process.env.GCLOUD_PROJECT || 'demo-reward-consistency';
process.env.FIREBASE_CONFIG = JSON.stringify(firebaseConfig);
process.env.GCLOUD_PROJECT = firebaseConfig.projectId;
process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
require('./totp-emulator-auth');
// Newer google-auth-library calls client.fetch. Point it at the emulator with
// the emulator's admin bearer. Nothing here contacts Google.
(function patchEmulatorAuth() {
    const { GoogleAuth } = require(require.resolve('google-auth-library', {
        paths: [path.join(root, 'functions', 'node_modules', 'google-gax')],
    }));
    const headers = { Authorization: 'Bearer owner' };
    GoogleAuth.prototype.getClient = async function () {
        return {
            universeDomain: 'googleapis.com',
            getRequestHeaders: async function () { return Object.assign({}, headers); },
            fetch: function (url, opts) {
                const o = Object.assign({}, opts || {});
                o.headers = Object.assign({}, o.headers || {}, headers);
                return fetch(url, o);
            },
        };
    };
    GoogleAuth.prototype.getUniverseDomain = async function () { return 'googleapis.com'; };
})();

const admin = require('../functions/node_modules/firebase-admin');
const fns = require('../functions/index.js');
const { awardBadge } = require('../functions/src/awardBadge');
const badgeRules = require('../functions/src/badgeRules');
const { registerOnboarding, setGuestXpCutoffMs } = require('../functions/src/onboardingApi');
const functionsV1 = require(require.resolve('firebase-functions/v1', { paths: [path.join(root, 'functions')] }));
const db = admin.firestore();

let passed = 0;
let failed = 0;
async function test(name, fn) {
    console.log('  .. ' + name);
    try {
        await fn();
        passed++;
        console.log('  ok  ' + name);
    } catch (err) {
        failed++;
        console.log('  FAIL ' + name + ': ' + (err && err.stack ? err.stack : err));
    }
}

function ctx(uid, provider) {
    return {
        auth: {
            uid: uid,
            token: { firebase: { sign_in_provider: provider }, auth_time: Math.floor(Date.now() / 1000) },
        },
        rawRequest: { headers: { 'x-forwarded-for': '203.0.113.7' } },
    };
}

async function seedUser(uid, data) {
    await db.collection('users').doc(uid).set(Object.assign({
        points: 0, weeklyXP: 0, monthlyXP: 0, orangeTickets: 0, ban_reason: '', banned: false,
        created: admin.firestore.Timestamp.now(),
    }, data || {}));
}
async function userRow(uid) {
    const snap = await db.collection('users').doc(uid).get();
    return snap.exists ? snap.data() : null;
}

// Emulator-only accounts. A random value each run.
function emuPw() { return require('crypto').randomBytes(12).toString('hex'); }

const WELCOME = { action: 'Welcome bonus!', pts: 5 };

async function main() {
    const auth = admin.auth();
    await auth.createUser({ uid: 'guestAwardUser01' });
    await auth.createUser({ uid: 'realAwardUser001', email: 'real1@example.com', password: emuPw(), emailVerified: true });
    await auth.createUser({ uid: 'staleTokenUser01', email: 'stale@example.com', password: emuPw() });
    await auth.createUser({ uid: 'ln:abcdef0123456789' });
    await auth.createUser({ uid: 'nostr:abcdef0123456789' });
    for (const uid of ['guestAwardUser01', 'realAwardUser001', 'staleTokenUser01', 'ln:abcdef0123456789', 'nostr:abcdef0123456789']) await seedUser(uid);

    await test('anonymous awardPoints is rejected and writes nothing', async function () {
        const res = await fns.awardPoints.run(WELCOME, ctx('guestAwardUser01', 'anonymous'));
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.guest, true);
        assert.strictEqual(res.awarded, 0);
        const row = await userRow('guestAwardUser01');
        assert.strictEqual(row.points, 0);
        assert.strictEqual(row.weeklyXP, 0);
        const claims = await db.collection('users').doc('guestAwardUser01').collection('award_claims').get();
        assert.strictEqual(claims.size, 0);
    });

    await test('anonymous badge via awardPoints is rejected', async function () {
        const res = await fns.awardPoints.run({ action: 'badge_earned', actionKey: 'badge_earned', badgeId: 'first_channel', pts: 10 }, ctx('guestAwardUser01', 'anonymous'));
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.awarded, 0);
        assert.strictEqual((await userRow('guestAwardUser01')).points, 0);
    });

    await test('anonymous recordBeatsPlay is rejected', async function () {
        const res = await fns.recordBeatsPlay.run({ trackId: 'track-guest-1' }, ctx('guestAwardUser01', 'anonymous'));
        assert.strictEqual(res.counted, false);
        assert.strictEqual(res.reason, 'guest');
    });

    await test('signed-in password user still earns from awardPoints', async function () {
        const res = await fns.awardPoints.run(WELCOME, ctx('realAwardUser001', 'password'));
        assert.strictEqual(res.success, true, JSON.stringify(res));
        assert.ok(res.awarded > 0, JSON.stringify(res));
        assert.ok((await userRow('realAwardUser001')).points > 0);
    });

    await test('anonymous token on an account that now has a real provider is not a guest', async function () {
        const res = await fns.awardPoints.run(WELCOME, ctx('staleTokenUser01', 'anonymous'));
        assert.strictEqual(res.success, true, JSON.stringify(res));
        assert.ok(res.awarded > 0);
    });

    await test('ln: and nostr: custom-token users still earn', async function () {
        for (const uid of ['ln:abcdef0123456789', 'nostr:abcdef0123456789']) {
            const res = await fns.awardPoints.run(WELCOME, ctx(uid, 'custom'));
            assert.strictEqual(res.success, true, uid + ' ' + JSON.stringify(res));
            assert.ok(res.awarded > 0, uid);
        }
    });

    await test('signed-in recordBeatsPlay is not refused as a guest', async function () {
        let res = null;
        try { res = await fns.recordBeatsPlay.run({ trackId: 'track-real-1' }, ctx('realAwardUser001', 'password')); }
        catch (e) { res = { thrown: e.code || e.message }; }
        assert.notStrictEqual(res && res.reason, 'guest', JSON.stringify(res));
        const res2 = await fns.recordBeatsPlay.run({ trackId: 'track-real-1' }, ctx('ln:abcdef0123456789', 'custom')).catch(function (e) { return { thrown: e.code }; });
        assert.notStrictEqual(res2 && res2.reason, 'guest');
    });

    await test('anon_merge is a no-op even with a valid merged guest', async function () {
        await auth.createUser({ uid: 'mergedGuest00001' });
        await seedUser('mergedGuest00001', { points: 400, mergedInto: 'realAwardUser001' });
        const before = await userRow('realAwardUser001');
        const res = await fns.awardPoints.run({ action: '🔗 Anonymous progress merged', pts: 400, anonUid: 'mergedGuest00001' }, ctx('realAwardUser001', 'password'));
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.awarded, 0);
        const after = await userRow('realAwardUser001');
        assert.strictEqual(after.points, before.points);
        assert.strictEqual(after.weeklyXP, before.weeklyXP);
        const merged = await db.collection('users').doc('realAwardUser001').collection('award_claims').where('action', '==', 'anon_merge').get();
        assert.strictEqual(merged.size, 0);
    });

    // cutoffMs: the guest was created before (past) or after (future) the cutoff.
    async function linkFlow(anonUid, destUid, destSeed, cutoffMs) {
        await auth.createUser({ uid: anonUid });
        await seedUser(anonUid, { points: 300, weeklyXP: 300, monthlyXP: 300, orangeTickets: 2 });
        if (destSeed) await seedUser(destUid, destSeed);
        const api = registerOnboarding({ db: db, admin: admin, functionsV1: functionsV1, guestXpCutoffMs: cutoffMs });
        const prep = await api.prepareGuestLink.run({}, ctx(anonUid, 'anonymous'));
        assert.strictEqual(prep.ok, true, JSON.stringify(prep));
        return api.linkGuestAccount.run({ anonUid: anonUid, nonce: prep.nonce }, ctx(destUid, 'password'));
    }
    const AFTER_GUEST = Date.now() - 60 * 60 * 1000; // guest created after this cutoff
    const BEFORE_GUEST = Date.now() + 60 * 60 * 1000; // guest created before this cutoff

    await test('production callable still links a guest', async function () {
        // Cutoff after now: this guest is pre-cutoff. Do not use the wall clock
        // against the placeholder constant.
        setGuestXpCutoffMs(Date.now() + 60 * 60 * 1000);
        try {
        await auth.createUser({ uid: 'linkDest00000000', email: 'dest0@example.com', password: emuPw(), emailVerified: true });
        await auth.createUser({ uid: 'linkGuest0000000' });
        await seedUser('linkGuest0000000', { points: 120, orangeTickets: 1 });
        const prep = await fns.prepareGuestLink.run({}, ctx('linkGuest0000000', 'anonymous'));
        const res = await fns.linkGuestAccount.run({ anonUid: 'linkGuest0000000', nonce: prep.nonce }, ctx('linkDest00000000', 'password'));
        assert.strictEqual(res.ok, true, JSON.stringify(res));
        const row = await userRow('linkDest00000000');
        assert.strictEqual(row.points, 120);
        assert.strictEqual(row.guestMovedXp, 120);
        // Inject a cutoff after "now" so this guest is treated as pre-cutoff.
        // The production callable reads the override at call time.
        assert.strictEqual(row.weeklyXP, 120);
        assert.strictEqual(row.unclaimableXp || 0, 0);
        } finally {
            setGuestXpCutoffMs(null);
        }
    });

    await test('guest from before the cutoff moves XP as claimable and leaderboard XP, as today', async function () {
        await auth.createUser({ uid: 'linkDest00000003', email: 'dest3@example.com', password: emuPw(), emailVerified: true });
        const res = await linkFlow('linkGuest0000003', 'linkDest00000003', { points: 100, weeklyXP: 40, monthlyXP: 60, unclaimableXp: 10 }, BEFORE_GUEST);
        assert.strictEqual(res.ok, true, JSON.stringify(res));
        const row = await userRow('linkDest00000003');
        assert.strictEqual(row.points, 400);
        assert.strictEqual(row.unclaimableXp, 10);
        assert.strictEqual(row.guestMovedXp, 300);
        assert.strictEqual(row.weeklyXP, 340);
        assert.strictEqual(row.monthlyXP, 360);
    });

    await test('linked guest XP after the cutoff is unclaimable and not leaderboard XP (existing account)', async function () {
        await auth.createUser({ uid: 'linkDest00000001', email: 'dest1@example.com', password: emuPw(), emailVerified: true });
        const res = await linkFlow('linkGuest0000001', 'linkDest00000001', { points: 100, weeklyXP: 40, monthlyXP: 60, unclaimableXp: 10, orangeTickets: 1 }, AFTER_GUEST);
        assert.strictEqual(res.ok, true, JSON.stringify(res));
        assert.strictEqual(res.points, 300);
        const row = await userRow('linkDest00000001');
        assert.strictEqual(row.points, 400);
        assert.strictEqual(row.unclaimableXp, 310);
        assert.strictEqual(row.guestMovedXp, 300);
        assert.strictEqual(row.guestMovedTickets, 2);
        assert.strictEqual(row.weeklyXP, 40);
        assert.strictEqual(row.monthlyXP, 60);
        assert.strictEqual(row.orangeTickets, 3);
        const claimable = row.points - (row.pointsClaimed || 0) - (row.pointsDonated || 0) - (row.pointsExchanged || 0) - row.unclaimableXp;
        assert.strictEqual(claimable, 90);
        const guest = await userRow('linkGuest0000001');
        assert.strictEqual(guest.mergedInto, 'linkDest00000001');
        assert.strictEqual(guest.points, 0);
    });

    await test('linked guest XP after the cutoff is unclaimable and not leaderboard XP (new account doc)', async function () {
        await auth.createUser({ uid: 'linkDest00000002', email: 'dest2@example.com', password: emuPw(), emailVerified: true });
        const res = await linkFlow('linkGuest0000002', 'linkDest00000002', null, AFTER_GUEST);
        assert.strictEqual(res.ok, true, JSON.stringify(res));
        const row = await userRow('linkDest00000002');
        assert.strictEqual(row.points, 300);
        assert.strictEqual(row.unclaimableXp, 300);
        assert.strictEqual(row.weeklyXP, 0);
        assert.strictEqual(row.monthlyXP, 0);
        assert.strictEqual(row.guestMovedTickets, 2);
    });

    await test('isGuestCaller treats a stale anonymous token as signed in and fails closed', async function () {
        const gate = require('../functions/src/guestGate');
        function adminOf(record, fail) {
            return {
                auth: function () {
                    return {
                        getUser: async function () {
                            if (fail) throw new Error('missing');
                            return record;
                        },
                    };
                },
            };
        }
        assert.strictEqual(await gate.isGuestCaller(adminOf({}), null), true);
        assert.strictEqual(await gate.isGuestCaller(adminOf({}), ctx('u1', 'password')), false);
        assert.strictEqual(await gate.isGuestCaller(adminOf({ providerData: [] }), ctx('u1', 'anonymous')), true);
        assert.strictEqual(await gate.isGuestCaller(adminOf({ providerData: [{ providerId: 'password' }] }), ctx('u1', 'anonymous')), false);
        assert.strictEqual(await gate.isGuestCaller(adminOf({}, true), ctx('u1', 'anonymous')), true);
        assert.strictEqual(await gate.isGuestCaller(adminOf({ providerData: [{ providerId: 'custom' }] }), ctx('ln:abc', 'custom')), false);
    });

    function errCode(err) {
        return String((err && (err.code || err.message)) || '');
    }
    async function caught(fn) {
        try { return { res: await fn() }; }
        catch (e) { return { code: errCode(e), message: String(e && e.message || e) }; }
    }

    await test('dailySpin and incrementWeeklyChallenge refuse a guest and accept a stale anonymous token', async function () {
        await auth.createUser({ uid: 'guestSpinUser0001' });
        await auth.createUser({ uid: 'staleSpinUser0001', email: 'stalespin@example.com', password: emuPw() });
        await seedUser('guestSpinUser0001');
        await seedUser('staleSpinUser0001');

        const guestSpin = await caught(function () { return fns.dailySpin.run({}, ctx('guestSpinUser0001', 'anonymous')); });
        assert.ok(String(guestSpin.code || '').indexOf('permission-denied') !== -1, JSON.stringify(guestSpin));
        assert.strictEqual((await userRow('guestSpinUser0001')).points, 0);
        const staleSpin = await caught(function () { return fns.dailySpin.run({}, ctx('staleSpinUser0001', 'anonymous')); });
        assert.strictEqual(String(staleSpin.code || '').indexOf('permission-denied'), -1, JSON.stringify(staleSpin));

        const guestWeek = await caught(function () { return fns.incrementWeeklyChallenge.run({ goalType: 'quiz' }, ctx('guestSpinUser0001', 'anonymous')); });
        assert.ok(String(guestWeek.code || '').indexOf('permission-denied') !== -1, JSON.stringify(guestWeek));
        const staleWeek = await caught(function () { return fns.incrementWeeklyChallenge.run({ goalType: 'quiz' }, ctx('staleSpinUser0001', 'anonymous')); });
        assert.strictEqual(String(staleWeek.code || '').indexOf('permission-denied'), -1, JSON.stringify(staleWeek));
        if (staleWeek.res) assert.notStrictEqual(staleWeek.res.reason, 'guest');
    });

    await test('prepareGuestLink and linkGuestAccount use the same guest check as awardPoints', async function () {
        await auth.createUser({ uid: 'guestPrepUser0001' });
        await auth.createUser({ uid: 'stalePrepUser0001', email: 'staleprep@example.com', password: emuPw() });
        await seedUser('guestPrepUser0001');
        await seedUser('stalePrepUser0001');

        const guestPrep = await fns.prepareGuestLink.run({}, ctx('guestPrepUser0001', 'anonymous'));
        assert.strictEqual(guestPrep.ok, true, JSON.stringify(guestPrep));

        const stalePrep = await caught(function () { return fns.prepareGuestLink.run({}, ctx('stalePrepUser0001', 'anonymous')); });
        assert.ok(String(stalePrep.code || '').indexOf('failed-precondition') !== -1, JSON.stringify(stalePrep));

        const signedPrep = await caught(function () { return fns.prepareGuestLink.run({}, ctx('realAwardUser001', 'password')); });
        assert.ok(String(signedPrep.code || '').indexOf('failed-precondition') !== -1, JSON.stringify(signedPrep));

        const guestLink = await caught(function () {
            return fns.linkGuestAccount.run({ anonUid: 'guestPrepUser0001', nonce: 'abcd123456' }, ctx('guestAwardUser01', 'anonymous'));
        });
        assert.ok(String(guestLink.code || '').indexOf('permission-denied') !== -1, JSON.stringify(guestLink));

        const staleLink = await caught(function () {
            return fns.linkGuestAccount.run({ anonUid: 'noSuchGuest01', nonce: 'abcd123456' }, ctx('stalePrepUser0001', 'anonymous'));
        });
        assert.strictEqual(String(staleLink.code || '').indexOf('permission-denied'), -1, JSON.stringify(staleLink));
        assert.strictEqual(staleLink.res && staleLink.res.ok, false);
        assert.strictEqual(staleLink.res && staleLink.res.error, 'bad_nonce');
    });

    await test('cosmetic badge with verified:true writes no Favor', async function () {
        const cosmetic = badgeRules.allIds().find(function (id) { return badgeRules.isCosmeticId(id); });
        assert.ok(cosmetic, 'a cosmetic badge exists');
        await seedUser('cosmeticUser0001');
        const res = await awardBadge(db, admin, 'cosmeticUser0001', cosmetic, { verified: true, day: '2026-11-18', source: 'test' });
        assert.strictEqual(res.favor, false, JSON.stringify(res));
        const contrib = await db.collection('satoshiFavor').doc('current').collection('contributors').doc('cosmeticUser0001_badge_' + cosmetic).get();
        assert.strictEqual(contrib.exists, false);
        const sf = await db.collection('satoshiFavor').doc('userSfPoints').collection('users').doc('cosmeticUser0001').get();
        assert.strictEqual(sf.exists, false);
        const row = await userRow('cosmeticUser0001');
        assert.ok((row.visibleBadges || []).indexOf(cosmetic) !== -1, 'badge still shows');
    });

    await test('non-cosmetic verified badge still writes Favor', async function () {
        const paying = badgeRules.allIds().find(function (id) { return !badgeRules.isCosmeticId(id) && badgeRules.xpOf(id) > 0 && badgeRules.sfEligible(id) !== false; });
        await seedUser('payingBadgeUser1');
        const res = await awardBadge(db, admin, 'payingBadgeUser1', paying, { verified: true, day: '2026-11-18', source: 'test' });
        assert.strictEqual(res.favor, true, paying + ' ' + JSON.stringify(res));
        const sf = await db.collection('satoshiFavor').doc('userSfPoints').collection('users').doc('payingBadgeUser1').get();
        assert.strictEqual(sf.exists, true);
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(function (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
