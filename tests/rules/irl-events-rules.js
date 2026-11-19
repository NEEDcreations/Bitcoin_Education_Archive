#!/usr/bin/env node
// IRL event update rules: the host field on irl_events.
//
// Needs the Firestore emulator (FIRESTORE_EMULATOR_HOST, default 127.0.0.1:8085).
//
//   cd tests/rules && npm install
//   cd ../.. && npx --yes firebase-tools emulators:exec --only firestore --project demo-irl-events \
//     "node tests/rules/irl-events-rules.js"
//
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, arrayUnion, deleteField } = require('firebase/firestore');

const root = path.join(__dirname, '..', '..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const emuParts = emu.split(':');
const host = emuParts[0];
const port = Number(emuParts[1] || 8085);

const EVENT = {
    title: 'Bitcoin Meetup',
    hostId: 'host1',
    hostName: 'Hana',
    date: '2099-01-01T18:00:00.000Z',
    location: 'Main St',
    locationName: 'Main St',
    link: null,
    description: 'Monthly meetup',
    attendees: ['host1'],
};

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-irl-events',
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
        const hostDb = env.authenticatedContext('host1', password).firestore();
        const other = env.authenticatedContext('other2', password).firestore();
        const admin = env.authenticatedContext('admin1', { admin: true, firebase: { sign_in_provider: 'password' } }).firestore();

        const ids = ['Eedit', 'Erewrite', 'Ersvp', 'Eadmin', 'EadminFull', 'EhostMove', 'EhostDrop', 'EhostRewriteMove',
            'EhostRewriteDrop', 'EotherSet', 'EotherRsvpSet', 'EotherEdit', 'EnoHost', 'EnoHostAdd'];
        await env.withSecurityRulesDisabled(async function (ctx) {
            const adminDb = ctx.firestore();
            for (const id of ids) {
                const data = Object.assign({}, EVENT);
                if (id === 'EnoHost' || id === 'EnoHostAdd') delete data.hostId;
                await setDoc(doc(adminDb, 'irl_events', id), data);
            }
        });

        // Allowed
        await expect('host edits the title', function () {
            return updateDoc(doc(hostDb, 'irl_events', 'Eedit'), { title: 'Bitcoin Meetup v2', description: 'new' });
        }, true);
        await expect('host full rewrite that keeps the host', function () {
            return setDoc(doc(hostDb, 'irl_events', 'Erewrite'), Object.assign({}, EVENT, { title: 'Rewritten', link: 'https://example.com/e' }));
        }, true);
        await expect('another user RSVPs', function () {
            return updateDoc(doc(other, 'irl_events', 'Ersvp'), { attendees: arrayUnion('other2') });
        }, true);
        await expect('admin reassigns the host', function () {
            return updateDoc(doc(admin, 'irl_events', 'Eadmin'), { hostId: 'other2' });
        }, true);
        await expect('admin full rewrite with a new host', function () {
            return setDoc(doc(admin, 'irl_events', 'EadminFull'), Object.assign({}, EVENT, { hostId: 'other2', hostName: 'Oz' }));
        }, true);

        // Denied
        await expect('host reassigns hostId', function () {
            return updateDoc(doc(hostDb, 'irl_events', 'EhostMove'), { hostId: 'other2' });
        }, false);
        await expect('host deletes hostId', function () {
            return updateDoc(doc(hostDb, 'irl_events', 'EhostDrop'), { hostId: deleteField() });
        }, false);
        await expect('host full rewrite with a new host', function () {
            return setDoc(doc(hostDb, 'irl_events', 'EhostRewriteMove'), Object.assign({}, EVENT, { hostId: 'other2' }));
        }, false);
        await expect('host full rewrite without hostId', function () {
            const data = Object.assign({}, EVENT); delete data.hostId;
            return setDoc(doc(hostDb, 'irl_events', 'EhostRewriteDrop'), data);
        }, false);
        await expect('non-host sets hostId to self', function () {
            return updateDoc(doc(other, 'irl_events', 'EotherSet'), { hostId: 'other2' });
        }, false);
        await expect('non-host RSVP that also sets hostId', function () {
            return updateDoc(doc(other, 'irl_events', 'EotherRsvpSet'), { attendees: arrayUnion('other2'), hostId: 'other2' });
        }, false);
        await expect('non-host edits the title', function () {
            return updateDoc(doc(other, 'irl_events', 'EotherEdit'), { title: 'Taken over' });
        }, false);
        await expect('non-host adds hostId to an event with none', function () {
            return updateDoc(doc(other, 'irl_events', 'EnoHostAdd'), { hostId: 'other2' });
        }, false);
        await expect('RSVP still works on an event with no hostId', function () {
            return updateDoc(doc(other, 'irl_events', 'EnoHost'), { attendees: arrayUnion('other2') });
        }, true);
    } finally {
        await env.cleanup();
    }

    console.log(failed === 0 ? '\nALL IRL EVENT RULES CHECKS PASSED' : '\n' + failed + ' IRL EVENT RULES CHECKS FAILED');
    process.exit(failed === 0 ? 0 : 1);
})().catch(function (e) {
    console.error('ERR', e && e.stack ? e.stack : e);
    process.exit(1);
});
