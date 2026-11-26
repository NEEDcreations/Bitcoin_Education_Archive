#!/usr/bin/env node
'use strict';

// Clients cannot write the 18+ confirmation fields on a user doc.
//
//   npx --yes firebase-tools emulators:exec --only firestore --project demo-age-confirm \
//     "node tests/rules/age-confirm-rules.js"

const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc } = require('firebase/firestore');

const root = path.join(__dirname, '..', '..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const emuParts = emu.split(':');
const host = emuParts[0];
const port = Number(emuParts[1] || 8085);

const FIELDS = [
    'over18',
    'over18ConfirmedAt',
    'ageConfirmed18',
    'ageConfirmed18At',
    'ageConfirmBlocked',
];

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-age-confirm',
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
    const user = doc(alice, 'users/alice');

    await expect('create a plain profile', function () {
        return setDoc(user, { points: 0, displayName: 'Alice', ghostMode: false });
    }, true);

    for (let i = 0; i < FIELDS.length; i++) {
        const field = FIELDS[i];
        const createData = { points: 0, displayName: 'Bob' };
        createData[field] = field.indexOf('At') !== -1 ? '2026-11-25' : true;
        const bobId = 'bob' + i;
        const bob = env.authenticatedContext(bobId).firestore();
        await expect('create cannot set ' + field, function () {
            return setDoc(doc(bob, 'users/' + bobId), createData);
        }, false);
        const patch = {};
        patch[field] = field.indexOf('At') !== -1 ? '2026-11-26' : true;
        await expect('update cannot set ' + field, function () {
            return updateDoc(user, patch);
        }, false);
    }

    await expect('ghostMode update still succeeds', function () {
        return updateDoc(user, { ghostMode: true });
    }, true);

    await expect('client cannot create an age_confirm_throttle doc', function () {
        return setDoc(doc(alice, 'age_confirm_throttle/alice'), { lastAtMs: 1 });
    }, false);
    await expect('client cannot update an age_confirm_throttle doc', function () {
        return updateDoc(doc(alice, 'age_confirm_throttle/alice'), { lastAtMs: 2 });
    }, false);

    await env.cleanup();
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
