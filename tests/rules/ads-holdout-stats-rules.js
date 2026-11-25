#!/usr/bin/env node
'use strict';

// ads_holdout_stats day window and increment rules.
//
//   npx --yes firebase-tools emulators:exec --only firestore --project demo-ads-holdout \
//     "node tests/rules/ads-holdout-stats-rules.js"

const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, increment } = require('firebase/firestore');

const root = path.join(__dirname, '..', '..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const emuParts = emu.split(':');
const host = emuParts[0];
const port = Number(emuParts[1] || 8085);

function utcYmd(d) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

function utcShift(days) {
    return utcYmd(new Date(Date.now() + days * 86400000));
}

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-ads-holdout',
        firestore: { rules: rules, host: host, port: port },
    });

    async function expect(name, run, shouldAllow) {
        try {
            if (shouldAllow) await assertSucceeds(run());
            else await assertFails(run());
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✓');
        } catch (err) {
            failed++;
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✗ ' + (err && err.message));
        }
    }

    const alice = env.authenticatedContext('alice').firestore();
    const today = utcShift(0);
    const yday = utcShift(-1);
    const two = utcShift(-2);
    const three = utcShift(-3);
    const future = utcShift(1);

    await expect('signed-in user can create today adsDau = 1', function () {
        return setDoc(doc(alice, 'ads_holdout_stats/' + today), { adsDau: 1 });
    }, true);

    await expect('signed-in user can increment today adsDau by 1', function () {
        return updateDoc(doc(alice, 'ads_holdout_stats/' + today), { adsDau: increment(1) });
    }, true);

    await expect('signed-in user can create yesterday holdoutReturned = 1', function () {
        return setDoc(doc(alice, 'ads_holdout_stats/' + yday), { holdoutReturned: 1 });
    }, true);

    await expect('signed-in user can create two-days-ago holdoutDau = 1 (ET window)', function () {
        return setDoc(doc(alice, 'ads_holdout_stats/' + two), { holdoutDau: 1 });
    }, true);

    await expect('create is denied three days ago', function () {
        return setDoc(doc(alice, 'ads_holdout_stats/' + three), { adsDau: 1 });
    }, false);

    await expect('create is denied for a future day', function () {
        return setDoc(doc(alice, 'ads_holdout_stats/' + future), { adsDau: 1 });
    }, false);

    await expect('create is denied with two fields', function () {
        return setDoc(doc(alice, 'ads_holdout_stats/' + today + '-dup'), { adsDau: 1, holdoutDau: 1 });
    }, false);

    const anon = env.unauthenticatedContext().firestore();
    await expect('unsigned user cannot create today', function () {
        return setDoc(doc(anon, 'ads_holdout_stats/' + today), { adsDau: 1 });
    }, false);

    await expect('signed-in user can read today aggregates', function () {
        return getDoc(doc(alice, 'ads_holdout_stats/' + today));
    }, true);

    await env.cleanup();
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
