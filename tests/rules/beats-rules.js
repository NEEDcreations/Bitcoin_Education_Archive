#!/usr/bin/env node
// Beats Firestore rules that the plain Node suites cannot execute.
//
// Needs the Firestore emulator in firebase.json (127.0.0.1:8085).
//
//   cd tests/rules && npm install
//   cd ../.. && npx --yes firebase-tools emulators:exec --only firestore --project demo-beats \
//     "node tests/rules/beats-rules.js"
//
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteDoc } = require('firebase/firestore');

const root = path.join(__dirname, '..', '..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const emuParts = emu.split(':');
const host = emuParts[0];
const port = Number(emuParts[1] || 8085);

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-beats',
        firestore: { rules: rules, host: host, port: port },
    });

    async function expect(name, run, shouldAllow) {
        try {
            if (shouldAllow) await assertSucceeds(run());
            else await assertFails(run());
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✓');
        } catch (e) {
            failed++;
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✗ ' + (e.message || e));
        }
    }

    try {
        await env.clearFirestore();
        const password = { firebase: { sign_in_provider: 'password' } };
        const admin = env.authenticatedContext('admin1', { admin: true, firebase: { sign_in_provider: 'password' } }).firestore();
        const owner = env.authenticatedContext('owner1', password).firestore();

        await env.withSecurityRulesDisabled(async function (ctx) {
            const db = ctx.firestore();
            await setDoc(doc(db, 'beats_tracks', 'hidden-explicit'), {
                title: 'Digital Gold',
                artist: 'Clean',
                authorId: 'owner1',
                hidden: true,
                hiddenReason: 'explicit',
                plays: 0,
                likes: 0,
            });
            await setDoc(doc(db, 'beats_tracks', 'visible'), {
                title: 'Aces High',
                artist: 'Kevin MacLeod',
                authorId: 'owner1',
                plays: 0,
                likes: 0,
            });
        });

        await expect('admin cannot un-hide a moderated track', function () {
            return updateDoc(doc(admin, 'beats_tracks', 'hidden-explicit'), { hidden: false });
        }, false);
        await expect('admin can hide a visible track', function () {
            return updateDoc(doc(admin, 'beats_tracks', 'visible'), { hidden: true, hiddenReason: 'explicit' });
        }, true);
        await expect('owner cannot delete a hidden track', function () {
            return deleteDoc(doc(owner, 'beats_tracks', 'hidden-explicit'));
        }, false);
        await expect('admin can delete a hidden track', function () {
            return deleteDoc(doc(admin, 'beats_tracks', 'hidden-explicit'));
        }, true);
    } finally {
        await env.cleanup();
    }

    console.log(failed === 0 ? '\nALL BEATS RULES CHECKS PASSED' : '\n' + failed + ' BEATS RULES CHECKS FAILED');
    process.exit(failed === 0 ? 0 : 1);
})().catch(function (e) {
    console.error('ERR', e && e.stack ? e.stack : e);
    process.exit(1);
});
