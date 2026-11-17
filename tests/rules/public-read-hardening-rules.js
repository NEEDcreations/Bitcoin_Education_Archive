// Emulator check (needs Java + firebase emulators). Run by QA:
//   cd tests/rules && npx firebase emulators:exec --only firestore "node public-read-hardening-rules.js"
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
(async function () {
    const env = await initializeTestEnvironment({
        projectId: 'demo-public-read',
        firestore: { rules: fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8') },
    });
    await env.withSecurityRulesDisabled(async function (ctx) {
        await ctx.firestore().doc('visits/alice').set({ lastVisit: '2026-11-17', fp: 'alice' });
        await ctx.firestore().doc('stats/visits').set({ total: 10 });
    });
    const anonOut = env.unauthenticatedContext().firestore();
    const bob = env.authenticatedContext('bob').firestore();
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(anonOut.collection('visits').get());
    await assertFails(anonOut.doc('visits/alice').get());
    await assertFails(bob.collection('visits').get());
    await assertFails(bob.doc('visits/alice').get());
    await assertSucceeds(alice.doc('visits/alice').get());
    await assertFails(alice.collection('visits').get());
    await assertSucceeds(anonOut.doc('stats/visits').get());
    await env.withSecurityRulesDisabled(async function (ctx) {
        await ctx.firestore().doc('presence/alice').set({ uid: 'alice', name: 'a', lastSeen: new Date() });
        await ctx.firestore().doc('timechain_viewers/s1').set({ n: 1 });
    });
    const anonSess = env.authenticatedContext('anon1', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
    await assertFails(anonOut.collection('presence').get());
    await assertSucceeds(anonSess.collection('presence').get());
    await assertFails(bob.doc('timechain_viewers/s1').get());
    await env.cleanup();
    console.log('public-read-hardening-rules: 10/10 ok');
})().catch(function (e) { console.error(e); process.exit(1); });
