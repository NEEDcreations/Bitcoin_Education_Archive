#!/usr/bin/env node
// irl_events D1-D3 (Red Team 338-review):
//  D1 create: only the host attends, attendeesCount is the int 1, hostName is
//     short text, coverUrl is a safe https or base64 image URL; host updates
//     touch only the edit-form/RSVP fields, with an int count and a safe cover.
//  D2 RSVP join adds exactly the caller and keeps everyone else.
//  D3 a non-host can undo their own RSVP and remove nobody else.
// Starts the Firestore emulator when FIRESTORE_EMULATOR_HOST is not set.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..', '..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--only', 'firestore',
        '--project', 'demo-irl-events',
        'node tests/rules/irl-events-rules.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, addDoc, updateDoc, collection, serverTimestamp, arrayUnion, arrayRemove, increment } = require('firebase/firestore');

const rules = fs.readFileSync(process.env.IRL_RULES_FILE || path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const parts = emu.split(':');
const XSS = '<img src=x onerror=alert(1)>';
const EV = 'EventEventEventEvent';
const LEGACY = 'legacy_event-1';
const STORAGE_URL = 'https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/irl-events%2Fuser1%2F1731650000000_cover.png?alt=media&token=example';
// About 150 KB of base64, the size submitEvent allows for a data: cover.
const DATA_URL = 'data:image/jpeg;base64,' + Buffer.alloc(110000, 7).toString('base64');

(async function main() {
    let failed = 0, passed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-irl-events',
        firestore: { rules: rules, host: parts[0], port: Number(parts[1] || 8080) },
    });
    async function expect(name, run, shouldAllow) {
        try {
            if (shouldAllow) await assertSucceeds(run());
            else await assertFails(run());
            passed++;
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✓');
        } catch (e) {
            failed++;
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✗ ' + (e.message || e));
        }
    }
    async function seed() {
        await env.clearFirestore();
        await env.withSecurityRulesDisabled(async function (ctx) {
            const db = ctx.firestore();
            await setDoc(doc(db, 'irl_events', EV), { title: 'Seed meetup', date: '2030-01-01T00:00:00.000Z', location: 'Town', locationName: 'Town',
                hostId: 'user1', hostName: 'phil', attendeesCount: 1, attendees: ['user1', 'user3'], createdAt: 1 });
            await setDoc(doc(db, 'irl_events', LEGACY), { title: 'Old meetup', date: '2030-01-01T00:00:00.000Z', location: 'Town', hostId: 'user1', createdAt: 1 });
        });
    }
    try {
        const pw = { firebase: { sign_in_provider: 'password' } };
        const host = env.authenticatedContext('user1', pw).firestore();
        const guest = env.authenticatedContext('user2', pw).firestore();
        const attendee = env.authenticatedContext('user3', pw).firestore();
        const adminDb = env.authenticatedContext('admin1', Object.assign({ admin: true }, pw)).firestore();
        await seed();

        // The payload submitEvent builds (irl-sync.js), with and without the optional fields.
        const real = function (extra) {
            return Object.assign({ title: 'Bitcoin meetup', date: '2030-02-01T18:00:00.000Z', location: 'Pub', locationName: 'Pub', hostId: 'user1',
                hostName: 'phil', attendeesCount: 1, attendees: ['user1'], createdAt: serverTimestamp() }, extra || {});
        };
        const add = function (extra) { return function () { return addDoc(collection(host, 'irl_events'), real(extra)); }; };

        // D1 create: legit payloads.
        await expect('create: submitEvent payload', add(), true);
        await expect('create: default hostName "Anonymous Pleb"', add({ hostName: 'Anonymous Pleb' }), true);
        await expect('create: 50-char hostName', add({ hostName: 'n'.repeat(50) }), true);
        await expect('create: link, description and Storage cover URL', add({ link: 'https://meetup.example/x?a=1&b=2', description: 'come <b>by</b>', coverUrl: STORAGE_URL }), true);
        await expect('create: base64 jpeg data: cover (~150 KB)', add({ coverUrl: DATA_URL }), true);
        await expect('create: base64 png data: cover', add({ coverUrl: 'data:image/png;base64,iVBORw0KGgo=' }), true);
        await expect('create: base64 svg+xml data: cover', add({ coverUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }), true);

        // D1 create: Red Team's exploit payloads and neighbours.
        await expect('create: attendeesCount HTML string with attendees []', add({ attendeesCount: XSS, attendees: [] }), false);
        await expect('create: attendeesCount HTML string', add({ attendeesCount: XSS }), false);
        await expect('create: attendees [] with count 1', add({ attendees: [] }), false);
        await expect('create: attendees includes a second uid', add({ attendees: ['user1', 'user2'] }), false);
        await expect('create: attendees is someone else', add({ attendees: ['user2'] }), false);
        await expect('create: attendeesCount 5', add({ attendeesCount: 5 }), false);
        await expect('create: attendeesCount 1.5', add({ attendeesCount: 1.5 }), false);
        await expect('create: attendeesCount missing', function () { const d = real(); delete d.attendeesCount; return addDoc(collection(host, 'irl_events'), d); }, false);
        await expect('create: hostName HTML over 50 chars', add({ hostName: XSS + XSS }), false);
        await expect('create: hostName 51 chars', add({ hostName: 'n'.repeat(51) }), false);
        await expect('create: hostName a number', add({ hostName: 7 }), false);
        await expect('create: hostName missing', function () { const d = real(); delete d.hostName; return addDoc(collection(host, 'irl_events'), d); }, false);
        await expect('create: coverUrl javascript:', add({ coverUrl: 'javascript:alert(1)' }), false);
        await expect('create: coverUrl http://', add({ coverUrl: 'http://x/c.png' }), false);
        await expect("create: coverUrl breaks out of url('...')", add({ coverUrl: "https://x/a.png');background:url(javascript:alert(1)" }), false);
        await expect('create: coverUrl breaks out of the attribute', add({ coverUrl: 'https://x/a.png" onmouseover="alert(1)' }), false);
        await expect('create: coverUrl with markup', add({ coverUrl: 'https://x/' + XSS }), false);
        await expect('create: coverUrl data:text/html', add({ coverUrl: 'data:text/html;base64,PHNjcmlwdD4=' }), false);
        await expect('create: coverUrl non-base64 svg data:', add({ coverUrl: 'data:image/svg+xml,<svg onload=alert(1)>' }), false);
        await expect('create: coverUrl a number', add({ coverUrl: 1 }), false);
        await expect('create: emoji field', add({ emoji: XSS }), false);

        // D1 host update.
        const hostUpd = function (data, id) { return function () { return updateDoc(doc(host, 'irl_events', id || EV), data); }; };
        await expect('host: submitEditEvent payload', hostUpd({ title: 'Renamed meetup', date: '2030-03-01T18:00:00.000Z', location: 'Bar', locationName: 'Bar', link: null, description: null }), true);
        await expect('host: edit with https link and description', hostUpd({ title: 'Renamed meetup', link: 'https://x.example/y', description: 'd' }), true);
        await expect('host: edits a legacy-id event', hostUpd({ title: 'Renamed old meetup' }, LEGACY), true);
        await expect('host: sets a Storage cover', hostUpd({ coverUrl: STORAGE_URL }), true);
        await expect('host: sets attendeesCount to an int', hostUpd({ attendeesCount: 3 }), true);
        await expect('host: removes own RSVP', hostUpd({ attendees: arrayRemove('user1') }), true);
        await expect('host: RSVPs again', hostUpd({ attendees: arrayUnion('user1') }), true);
        await expect('host: adds emoji field', hostUpd({ emoji: XSS }), false);
        await expect('host: attendeesCount as HTML string', hostUpd({ attendeesCount: XSS }), false);
        await expect('host: attendeesCount as "1"', hostUpd({ attendeesCount: '1' }), false);
        await expect('host: coverUrl javascript:', hostUpd({ coverUrl: 'javascript:alert(1)' }), false);
        await expect("host: coverUrl breaks out of url('...')", hostUpd({ coverUrl: "https://x/a.png');x:url(javascript:alert(1)" }), false);
        await expect('host: changes hostName', hostUpd({ hostName: XSS }), false);
        await expect('host: changes hostId', hostUpd({ hostId: 'user2' }), false);
        await expect('host: changes createdAt', hostUpd({ createdAt: 2 }), false);
        await expect('host: attendees as a string', hostUpd({ attendees: XSS }), false);
        await expect('host: adds id field', hostUpd({ id: 'x' }), false);
        await expect('host: link javascript:', hostUpd({ link: 'javascript:alert(1)' }), false);
        await expect('admin: edits an event', function () { return updateDoc(doc(adminDb, 'irl_events', EV), { title: 'Admin renamed', description: null }); }, true);

        // D2 RSVP join (fresh seed: attendees [user1, user3]).
        await seed();
        const asGuest = function (data, id) { return function () { return updateDoc(doc(guest, 'irl_events', id || EV), data); }; };
        await expect('guest: drops an attendee and adds a fake uid', asGuest({ attendees: ['user1', 'user2', 'fakeuid'] }), false);
        await expect('guest: replaces an attendee with themselves', asGuest({ attendees: ['user1', 'user2'] }), false);
        await expect('guest: adds someone else', asGuest({ attendees: arrayUnion('user4') }), false);
        await expect('guest: adds themselves and someone else', asGuest({ attendees: arrayUnion('user2', 'user4') }), false);
        await expect('guest: RSVP plus attendeesCount bump', asGuest({ attendees: arrayUnion('user2'), attendeesCount: increment(1) }), false);
        await expect('guest: RSVP plus title change', asGuest({ attendees: arrayUnion('user2'), title: XSS }), false);
        await expect('guest: sets attendeesCount alone', asGuest({ attendeesCount: 99 }), false);
        await expect('guest: adds emoji', asGuest({ emoji: XSS }), false);
        await expect('guest: removes someone else', asGuest({ attendees: arrayRemove('user3') }), false);
        await expect('guest: RSVPs (arrayUnion self)', asGuest({ attendees: arrayUnion('user2') }), true);
        await expect('guest: RSVPs to a legacy event with no attendees', asGuest({ attendees: arrayUnion('user2') }, LEGACY), true);

        // D3 un-RSVP (now attendees [user1, user3, user2]).
        const asAtt = function (data) { return function () { return updateDoc(doc(attendee, 'irl_events', EV), data); }; };
        await expect('attendee: removes someone else', asAtt({ attendees: arrayRemove('user1') }), false);
        await expect('attendee: removes self and someone else', asAtt({ attendees: arrayRemove('user3', 'user2') }), false);
        await expect('attendee: leaves and adds a fake uid', asAtt({ attendees: ['user1', 'user2', 'fakeuid'] }), false);
        await expect('attendee: leaves and bumps attendeesCount', asAtt({ attendees: arrayRemove('user3'), attendeesCount: increment(-1) }), false);
        await expect('attendee: leaves and edits the title', asAtt({ attendees: arrayRemove('user3'), title: 'x' + XSS }), false);
        await expect('attendee: un-RSVPs (arrayRemove self)', asAtt({ attendees: arrayRemove('user3') }), true);
        await expect('attendee: no-op remove when not attending', asAtt({ attendees: arrayRemove('user3') }), false);
        await expect('attendee: RSVPs again', asAtt({ attendees: arrayUnion('user3') }), true);
        await expect('guest: un-RSVPs from the legacy event', asGuest({ attendees: arrayRemove('user2') }, LEGACY), true);
        await expect('host: deletes own event', function () {
            const { deleteDoc } = require('firebase/firestore'); return deleteDoc(doc(host, 'irl_events', LEGACY));
        }, true);
        await expect('guest: deletes an event', function () {
            const { deleteDoc } = require('firebase/firestore'); return deleteDoc(doc(guest, 'irl_events', EV));
        }, false);
    } finally {
        await env.cleanup();
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
