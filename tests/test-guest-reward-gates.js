#!/usr/bin/env node
'use strict';
// Guest reward checks on the server. An anonymous caller earns nothing from the
// reward callables and cannot link Strava. A logged-in caller (any real
// provider, including a linked anonymous account) is unaffected.
// Runs offline. The app-wide kill switch wrapper is left out here (it has its
// own suite) so the guest check is reached without a Firestore read.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-btc';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'demo-btc';
if (!process.env.FIREBASE_CONFIG) {
    process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo-btc', storageBucket: 'demo-btc.appspot.com' });
}
if (!process.env.DELETION_HMAC_SECRET) process.env.DELETION_HMAC_SECRET = 'unit-deletion-secret-0123456789';
// Point Firestore at a closed local port so no call can reach a real project.
if (!process.env.FIRESTORE_EMULATOR_HOST) process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:9';

// Handlers that got past the guest check keep talking to the closed port after
// the test moved on. Those late errors are expected here.
process.on('unhandledRejection', function () {});

const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

let passed = 0;
let failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('\u2705 ' + name); passed++; }
    catch (e) { console.log('\u274c ' + name + '\n   ' + (e && e.stack ? e.stack : e)); failed++; }
}
function settle(promise, ms) {
    return Promise.race([
        Promise.resolve(promise).then(function (v) { return { ok: true, value: v }; }, function (e) { return { err: e }; }),
        new Promise(function (r) { setTimeout(function () { r({ pending: true }); }, ms); }),
    ]);
}
function ctx(uid, provider) {
    return { auth: { uid: uid, token: { firebase: { sign_in_provider: provider } } }, rawRequest: { ip: '127.0.0.1', headers: {} } };
}
const ANON = ctx('anonUid0000000000000000001', 'anonymous');
const REAL = ['password', 'google.com', 'twitter.com'];

(async function main() {
    let fns = null;
    await test('functions/index.js loads offline', function () {
        const ks = require(path.join(root, 'functions', 'src', 'killSwitch.js'));
        ks.gateExports = function () {};
        fns = require(path.join(root, 'functions', 'index.js'));
        ['awardPoints', 'recordBeatsPlay', 'syncStravaWalks'].forEach(function (n) { assert.strictEqual(typeof fns[n].run, 'function', n); });
    });
    if (!fns) { console.log('\n0 passed, 1 failed'); process.exit(1); }

    await test('awardPoints: anonymous caller earns nothing', async function () {
        const r = await settle(fns.awardPoints.run({ action: 'quest_perfect', questId: 'q1' }, ANON), 500);
        assert.ok(r.ok, 'expected a quick zero result, got ' + JSON.stringify(r));
        assert.strictEqual(r.value.guest, true);
        assert.strictEqual(r.value.awarded, 0);
        assert.strictEqual(r.value.success, false);
    });

    await test('guest checks run before any read or write in the handler', function () {
        const src = read('functions/index.js');
        function head(name) { const i = src.indexOf('exports.' + name + ' ='); return src.slice(i, i + 900); }
        const ap = head('awardPoints');
        assert.ok(ap.indexOf('isGuestContext') < ap.indexOf('requireSecondFactor'));
        const bp = head('recordBeatsPlay');
        assert.ok(bp.indexOf('isGuestContext') < bp.indexOf('recordPlay'));
        const sw = head('syncStravaWalks');
        assert.ok(sw.indexOf('isGuestContext') < sw.indexOf('stravaRef'));
    });

    await test('awardPoints: no auth is still refused as before', async function () {
        const r = await settle(fns.awardPoints.run({ action: 'quest_perfect' }, {}), 500);
        assert.ok(!(r.ok && r.value && r.value.awarded > 0), 'no award without auth');
    });

    for (const p of REAL) {
        await test('awardPoints: logged-in (' + p + ') caller gets past the guest check', async function () {
            const r = await settle(fns.awardPoints.run({ action: 'quest_perfect', questId: 'q1' }, ctx('realUid000000000000000001', p)), 300);
            if (r.ok) assert.notStrictEqual(r.value && r.value.guest, true);
            if (r.err) assert.ok(!/Log in to earn/.test(String(r.err.message)));
        });
    }

    await test('recordBeatsPlay: anonymous play is not counted', async function () {
        const r = await settle(fns.recordBeatsPlay.run({ trackId: 't1', ms: 60000 }, ANON), 500);
        assert.ok(r.ok, JSON.stringify(r));
        assert.deepStrictEqual(r.value, { counted: false, reason: 'guest' });
    });

    for (const p of REAL) {
        await test('recordBeatsPlay: logged-in (' + p + ') caller gets past the guest check', async function () {
            const r = await settle(fns.recordBeatsPlay.run({ trackId: 't1', ms: 60000 }, ctx('realUid000000000000000001', p)), 300);
            if (r.ok) assert.notStrictEqual(r.value && r.value.reason, 'guest');
        });
    }

    await test('syncStravaWalks: anonymous caller is refused', async function () {
        const r = await settle(fns.syncStravaWalks.run({}, ANON), 500);
        assert.ok(r.err, JSON.stringify(r));
        assert.strictEqual(r.err.code, 'permission-denied');
    });

    await test('syncStravaWalks: logged-in caller gets past the guest check', async function () {
        const r = await settle(fns.syncStravaWalks.run({}, ctx('realUid000000000000000001', 'password')), 300);
        if (r.err) assert.ok(!/Log in to sync Strava/.test(String(r.err.message)));
    });

    await test('guest progress never carries over as XP (anon merge is off)', function () {
        const ev = read('functions/src/awardEvidence.js');
        assert.ok(/const GUEST_MERGE_PAYS = false;/.test(ev));
        assert.ok(/GUEST_MERGE_PAYS !== true\) return fail\('Guest progress does not carry over'\)/.test(ev));
    });

    await test('TCTV drip and watch time refuse anonymous callers (guests do not count)', function () {
        assert.ok(/sign_in_provider[\s\S]{0,120}'anonymous'[\s\S]{0,40}permission-denied/.test(read('functions/tctv-drip.js')));
        assert.ok(/anonymous/.test(read('functions/tctv-watch-callable.js')));
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
