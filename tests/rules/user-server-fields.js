#!/usr/bin/env node
'use strict';

// Server-only user fields for quiz progress and the one-time XP bank payout.
//
//   npx --yes firebase-tools emulators:exec --only firestore --project demo-user-fields \
//     "node tests/rules/user-server-fields.js"

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
    'lastQuizDate', 'quizStreak', 'quizAnswered', 'quizCorrect',
    'xpBankPayoutApplied', 'xpBankPayoutAmount', 'xpBankPayoutBank', 'xpBankPayoutAt',
];

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-user-fields',
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
        createData[field] = field === 'lastQuizDate' ? '2026-10-22' : 1;
        await expect('create cannot set ' + field, function () {
            return setDoc(doc(alice, 'users/bob' + i), createData);
        }, false);
        const patch = {};
        patch[field] = field === 'lastQuizDate' ? '2026-10-23' : 2;
        await expect('update cannot set ' + field, function () {
            return updateDoc(user, patch);
        }, false);
    }

    await expect('ghostMode update still succeeds', function () {
        return updateDoc(user, { ghostMode: true });
    }, true);

    await env.cleanup();
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
