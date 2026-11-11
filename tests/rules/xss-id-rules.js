#!/usr/bin/env node
// XSS hardening rules: client-chosen doc ids and display text.
// Needs the Firestore emulator (FIRESTORE_EMULATOR_HOST, default 127.0.0.1:8085).
//   npx --yes firebase-tools emulators:exec --only firestore --project demo-xss "node tests/rules/xss-id-rules.js"
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, addDoc, collection, serverTimestamp } = require('firebase/firestore');

const root = path.join(__dirname, '..', '..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085').split(':');
const BAD_IDS = ["x');alert(1);", 'x"><img src=x onerror=alert(1)>', 'a b'];

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({ projectId: 'demo-xss', firestore: { rules, host: emu[0], port: Number(emu[1] || 8085) } });
    async function expect(name, run, allow) {
        try {
            if (allow) await assertSucceeds(run()); else await assertFails(run());
            console.log((allow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✓');
        } catch (e) { failed++; console.log((allow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✗ ' + (e.message || e)); }
    }
    try {
        await env.clearFirestore();
        const pw = { firebase: { sign_in_provider: 'password' } };
        const alice = env.authenticatedContext('alice1', pw).firestore();
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await setDoc(doc(db, 'users', 'alice1'), { username: 'alice' });
            await setDoc(doc(db, 'users', 'bob2'), { username: 'bob' });
            await setDoc(doc(db, 'dm_conversations', 'alice1_bob2'), { participants: ['alice1', 'bob2'] });
        });

        // reports
        const report = (o) => Object.assign({ reporterUid: 'alice1', reportedUid: 'bob2', reason: 'spam', reportedName: 'bob', reporterName: 'alice', status: 'pending', createdAt: serverTimestamp() }, o || {});
        await expect('report via add()', () => addDoc(collection(alice, 'reports'), report()), true);
        for (const id of BAD_IDS) await expect('report with markup doc id ' + JSON.stringify(id), () => setDoc(doc(alice, 'reports', id), report()), false);
        await expect('report reason with <img onerror>', () => addDoc(collection(alice, 'reports'), report({ reason: '<img src=x onerror=alert(93)>' })), false);
        await expect('report reportedName with <b>', () => addDoc(collection(alice, 'reports'), report({ reportedName: '<b>victim</b>' })), false);

        // DM messages (subdoc)
        const msg = (o) => Object.assign({ senderUid: 'alice1', senderName: 'alice', text: 'hi', createdAt: serverTimestamp() }, o || {});
        const msgs = collection(alice, 'dm_conversations', 'alice1_bob2', 'messages');
        await expect('DM message via add()', () => addDoc(msgs, msg()), true);
        for (const id of BAD_IDS) await expect('DM message with markup doc id ' + JSON.stringify(id), () => setDoc(doc(msgs, id), msg()), false);
        await expect('DM senderName with <svg onload>', () => addDoc(msgs, msg({ senderName: '<svg onload=alert()>' })), false);
        await expect('DM isNachoAuto from client', () => addDoc(msgs, msg({ isNachoAuto: true })), false);

        // notifications
        const notif = (o) => Object.assign({ recipientId: 'bob2', senderId: 'alice1', senderName: 'alice', type: 'dm', message: '💬 New message from @alice', targetType: 'dm', targetId: 'alice1_bob2', read: false, createdAt: serverTimestamp() }, o || {});
        await expect('notification via add()', () => addDoc(collection(alice, 'notifications'), notif()), true);
        await expect('notification senderName markup', () => addDoc(collection(alice, 'notifications'), notif({ senderName: '<svg onload=alert()>' })), false);
        await expect('notification message markup', () => addDoc(collection(alice, 'notifications'), notif({ message: '💬 from @<svg onload=alert()>' })), false);
        await expect('notification look-alike system sender', () => addDoc(collection(alice, 'notifications'), notif({ senderName: 'Bitcoin Quest Team' })), false);
        await expect('notification type security from client', () => addDoc(collection(alice, 'notifications'), notif({ type: 'security' })), false);
        await expect('notification type system from client', () => addDoc(collection(alice, 'notifications'), notif({ type: 'system' })), false);

        // admin-only collections
        await expect('client write admin_notifications', () => addDoc(collection(alice, 'admin_notifications'), { body: 'x' }), false);
        await expect('client write shoutout_claims', () => setDoc(doc(alice, 'shoutout_claims', 'shoutout_forum_x1'), { status: 'posted' }), false);
        await expect('client write timechain_viewers', () => setDoc(doc(alice, 'timechain_viewers', 'main'), { count: 1 }), false);

        // playlists
        await expect('playlist via add()', () => addDoc(collection(alice, 'users', 'alice1', 'playlists'), { name: 'Chill' }), true);
        for (const id of BAD_IDS) await expect('playlist markup doc id ' + JSON.stringify(id), () => setDoc(doc(alice, 'users', 'alice1', 'playlists', id), { name: 'Chill' }), false);
        await expect('playlist name markup', () => addDoc(collection(alice, 'users', 'alice1', 'playlists'), { name: '<img src=x onerror=1>' }), false);

        // forum posts (from #295) keep the id guard
        for (const id of BAD_IDS) await expect('forum post markup doc id ' + JSON.stringify(id), () => setDoc(doc(alice, 'forum_posts', id), { title: 't', body: 'b', authorUid: 'alice1' }), false);
    } finally {
        await env.cleanup();
    }
    console.log(failed === 0 ? '\nALL XSS RULES CHECKS PASSED' : '\n' + failed + ' XSS RULES CHECKS FAILED');
    process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('ERR', e && e.stack ? e.stack : e); process.exit(1); });
