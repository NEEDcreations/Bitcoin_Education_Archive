#!/usr/bin/env node
'use strict';

// Server admin gates must read the Firebase custom claim
// (context.auth.token.admin === true). No hardcoded uid or email lists, and no
// rules-only syntax such as token.get(), which throws a TypeError in Node.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-btc';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'demo-btc';
if (!process.env.FIREBASE_CONFIG) {
    process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo-btc', storageBucket: 'demo-btc.appspot.com' });
}
if (!process.env.DELETION_HMAC_SECRET) process.env.DELETION_HMAC_SECRET = 'unit-deletion-secret-0123456789';
// Point Firestore at a closed local port so an admin call can never reach a real project.
if (!process.env.FIRESTORE_EMULATOR_HOST) process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:9';

const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

let passed = 0;
let failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('\u2705 ' + name); passed++; }
    catch (e) { console.log('\u274c ' + name + '\n   ' + (e && e.stack ? e.stack : e)); failed++; }
}

const GATED = ['backfillPublicProfiles', 'backfillLightningAddress', 'syncCycleToTop10', 'backfillFactionTotals'];

function chunkFor(src, name) {
    const start = src.indexOf('exports.' + name + ' =');
    assert.ok(start >= 0, name + ' not found');
    return src.slice(start, start + 700);
}

// Settles with the first outcome, or 'pending' if the handler is still working
// (it got past the gate and is waiting on Firestore).
function settle(promise, ms) {
    return Promise.race([
        Promise.resolve(promise).then(function () { return { ok: true }; }, function (e) { return { err: e }; }),
        new Promise(function (r) { setTimeout(function () { r({ pending: true }); }, ms); }),
    ]);
}

(async function main() {
    const indexSrc = read('functions/index.js');
    const favorSrc = read('functions/src/satoshiFavor.js');

    await test('no server code uses rules-only token.get()', function () {
        assert.ok(!/token\.get\(/.test(indexSrc));
        assert.ok(!/token\.get\(/.test(favorSrc));
    });

    await test('syncCycleToTop10 has no hardcoded admin uid list', function () {
        const chunk = chunkFor(favorSrc, 'syncCycleToTop10');
        assert.ok(!/ADMIN_UIDS/.test(chunk));
        assert.ok(!/'[A-Za-z0-9]{28}'/.test(chunk), 'no uid literals');
        assert.ok(chunk.includes('context.auth.token.admin !== true'));
    });

    await test('backfill gates read the claim', function () {
        assert.ok(chunkFor(indexSrc, 'backfillPublicProfiles').includes('context.auth.token.admin !== true'));
        assert.ok(chunkFor(indexSrc, 'backfillLightningAddress').includes('context.auth.token.admin !== true'));
        assert.ok(chunkFor(favorSrc, 'backfillFactionTotals').includes('context.auth.token.admin !== true'));
    });

    let fns = null;
    await test('functions/index.js loads offline', function () {
        fns = require(path.join(root, 'functions', 'index.js'));
        GATED.forEach(function (n) { assert.strictEqual(typeof fns[n].run, 'function', n); });
    });
    if (!fns) {
        console.log('\n' + passed + ' passed, ' + failed + ' failed');
        process.exit(1);
    }

    for (const name of GATED) {
        await test(name + ' refuses a signed-in non-admin with permission-denied', async function () {
            const r = await settle(fns[name].run({}, { auth: { uid: 'playerA1', token: { email: 'p@example.com' } } }), 500);
            assert.ok(r.err, 'expected a refusal');
            assert.strictEqual(r.err.code, 'permission-denied', String(r.err && r.err.message));
        });
        await test(name + ' refuses a forged admin:"true" string', async function () {
            const r = await settle(fns[name].run({}, { auth: { uid: 'playerA1', token: { admin: 'true' } } }), 500);
            assert.ok(r.err);
            assert.strictEqual(r.err.code, 'permission-denied');
        });
        await test(name + ' lets a real admin past the gate (no TypeError)', async function () {
            const r = await settle(fns[name].run({ cycleId: 'unit-cycle' }, { auth: { uid: 'adminA1', token: { admin: true } } }), 300);
            if (r.err) {
                assert.ok(!(r.err instanceof TypeError), 'TypeError: ' + r.err.message);
                assert.notStrictEqual(r.err.code, 'permission-denied');
            }
        });
    }

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
