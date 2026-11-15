#!/usr/bin/env node
// F-004: DM images are readable only by the people in that conversation.
// Runs throwaway Firestore (8193) + Storage (9193) emulators so the storage
// rules' firestore.get/exists calls hit real conversation docs.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..', '..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const javaBins = ['/tmp/jre/bin', '/home/box/jre/bin', '/home/box/jdk/jdk-21.0.13+9-jre/bin'].filter(function (d) {
        return fs.existsSync(path.join(d, 'java'));
    });
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--only', 'firestore,storage',
        '--project', 'demo-dm-privacy',
        '--config', path.join(root, 'firebase.dmprivacy.json'),
        'node tests/rules/dm-image-privacy-rules.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, {
            CI: 'true',
            FIRESTORE_EMULATOR_HOST: '127.0.0.1:8193',
            FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9193',
            PATH: javaBins.concat([process.env.PATH || '']).join(path.delimiter),
        }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc } = require('firebase/firestore');
const { ref, uploadBytes, getBytes, listAll, getMetadata, deleteObject } = require('firebase/storage');

const fsRules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const stRules = fs.readFileSync(path.join(root, 'storage.rules'), 'utf8');
const [fh, fp] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const [sh, sp] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9193').split(':');

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const pw = { firebase: { sign_in_provider: 'password' } };
// alice < bob < mallory, so sorted ids are predictable.
const A = 'alice', B = 'bob', M = 'mallory', C = 'carol';
const id = (x, y) => (x < y ? x + '_' + y : y + '_' + x);

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-dm-privacy',
        firestore: { rules: fsRules, host: fh, port: Number(fp) },
        storage: { rules: stRules, host: sh, port: Number(sp) },
    });
    async function expect(name, run, allow) {
        try {
            if (allow) await assertSucceeds(run()); else await assertFails(run());
            console.log((allow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✓');
        } catch (e) {
            failed++;
            console.log((allow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✗ ' + (e.message || e));
        }
    }
    // One context, Firestore and Storage instance per user (the SDK refuses to
    // re-apply emulator settings to an already-started instance).
    const cache = {};
    function ctxFor(u, tok) {
        if (!cache[u]) {
            const c = env.authenticatedContext(u, tok);
            cache[u] = { fs: c.firestore(), st: c.storage() };
        }
        return { firestore: () => cache[u].fs, storage: () => cache[u].st };
    }
    const as = (u) => ctxFor(u, pw);
    const anon = (u) => ctxFor(u, { firebase: { sign_in_provider: 'anonymous' } });
    const signedOut = (() => { const c = env.unauthenticatedContext(); const st = c.storage(); return { storage: () => st }; })();

    // Seed: alice<->bob conversation; alice has legacy and convo-scoped images.
    const AB = id(A, B);
    const SQ = id(A, 'dave');      // 'alice_dave', squatted by mallory
    const TRIO = id(C, M);         // 'carol_mallory', 3 participants
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'dm_conversations', AB), { participants: [A, B], participantNames: { [A]: 'alice', [B]: 'bob' }, lastMessage: 'hi' });
        const st = ctx.storage();
        await uploadBytes(ref(st, 'dm-images/' + A + '/1731630000000_abc123.png'), PNG, { contentType: 'image/png' });
        await uploadBytes(ref(st, 'dm-images/' + A + '/' + AB + '/1731630000001_def456.png'), PNG, { contentType: 'image/png' });
        // Pre-existing bad convo (made before this fix): mallory + alice under a forged id.
        await setDoc(doc(db, 'dm_conversations', 'forged_' + M), { participants: [M, A] });
        // F1: squatted sorted-pair id. Mallory made 'alice_dave' (a pair she is
        // not in) holding [mallory, alice] before the create-shape rule existed.
        await setDoc(doc(db, 'dm_conversations', SQ), { participants: [M, A] });
        await setDoc(doc(db, 'dm_conversations', SQ, 'messages', 'old1'), { senderUid: A, text: 'secret' });
        // F1: 3-person doc from before the fix.
        await setDoc(doc(db, 'dm_conversations', TRIO), { participants: [C, M, A] });
        await setDoc(doc(db, 'dm_conversations', TRIO, 'messages', 'old1'), { senderUid: A, text: 'secret' });
        await setDoc(doc(db, 'dm_conversations', AB, 'messages', 'm0'), { senderUid: A, text: 'hello' });
    });
    const legacy = 'dm-images/' + A + '/1731630000000_abc123.png';
    const scoped = 'dm-images/' + A + '/' + AB + '/1731630000001_def456.png';

    console.log('--- legacy path dm-images/{uploader}/{file} ---');
    await expect('uploader reads own legacy image', () => getBytes(ref(as(A).storage(), legacy)), true);
    await expect('uploader lists own legacy folder', () => listAll(ref(as(A).storage(), 'dm-images/' + A)), true);
    await expect('partner (bob) cannot read legacy image via SDK (uses download URL instead)', () => getBytes(ref(as(B).storage(), legacy)), false);
    await expect('attacker reads someone else\'s legacy image', () => getBytes(ref(as(M).storage(), legacy)), false);
    await expect('attacker getMetadata (download token) on legacy image', () => getMetadata(ref(as(M).storage(), legacy)), false);
    await expect('attacker lists victim folder', () => listAll(ref(as(M).storage(), 'dm-images/' + A)), false);
    await expect('signed-out read', () => getBytes(ref(signedOut.storage(), legacy)), false);
    await expect('uploader uploads png to own legacy folder (current client)', () => uploadBytes(ref(as(A).storage(), 'dm-images/' + A + '/1731630000002_ghi789.png'), PNG, { contentType: 'image/png' }), true);
    await expect('upload into someone else\'s folder', () => uploadBytes(ref(as(M).storage(), 'dm-images/' + A + '/x.png'), PNG, { contentType: 'image/png' }), false);
    await expect('upload non-image type', () => uploadBytes(ref(as(A).storage(), 'dm-images/' + A + '/x.svg'), PNG, { contentType: 'image/svg+xml' }), false);
    await expect('upload over 5 MB', () => uploadBytes(ref(as(A).storage(), 'dm-images/' + A + '/big.png'), new Uint8Array(5 * 1024 * 1024 + 1), { contentType: 'image/png' }), false);
    await expect('attacker deletes victim image', () => deleteObject(ref(as(M).storage(), legacy)), false);

    console.log('--- conversation path dm-images/{uploader}/{convoId}/{file} ---');
    await expect('participant (bob) reads image in his convo', () => getBytes(ref(as(B).storage(), scoped)), true);
    await expect('uploader reads own convo image', () => getBytes(ref(as(A).storage(), scoped)), true);
    await expect('attacker reads convo image', () => getBytes(ref(as(M).storage(), scoped)), false);
    await expect('attacker lists convo folder', () => listAll(ref(as(M).storage(), 'dm-images/' + A + '/' + AB)), false);
    await expect('participant (bob) uploads into his convo', () => uploadBytes(ref(as(B).storage(), 'dm-images/' + B + '/' + AB + '/1.png'), PNG, { contentType: 'image/png' }), true);
    await expect('attacker uploads into alice/bob convo under own uid', () => uploadBytes(ref(as(M).storage(), 'dm-images/' + M + '/' + AB + '/1.png'), PNG, { contentType: 'image/png' }), false);
    await expect('upload into a convo that does not exist', () => uploadBytes(ref(as(A).storage(), 'dm-images/' + A + '/' + id(A, C) + '/1.png'), PNG, { contentType: 'image/png' }), false);
    await expect('convo path rejects non-image type', () => uploadBytes(ref(as(B).storage(), 'dm-images/' + B + '/' + AB + '/1.html'), PNG, { contentType: 'text/html' }), false);
    await expect('pre-existing forged convo does not open alice\'s convo image', () => getBytes(ref(as(M).storage(), 'dm-images/' + A + '/forged_' + M + '/none.png')), false);

    console.log('--- attacker creates a convo with the victim to gain access ---');
    const MA = id(M, A);
    await expect('attacker creates a legit 2-person convo with alice (normal DM start)', () => setDoc(doc(as(M).firestore(), 'dm_conversations', MA), { participants: [M, A], participantNames: { [M]: 'm', [A]: 'a' }, lastMessage: 'hey' }), true);
    await expect('...and still cannot read alice\'s legacy image', () => getBytes(ref(as(M).storage(), legacy)), false);
    await expect('...and still cannot read alice\'s alice/bob image', () => getBytes(ref(as(M).storage(), scoped)), false);
    await expect('...and still cannot list alice\'s folder', () => listAll(ref(as(M).storage(), 'dm-images/' + A)), false);
    await expect('create convo under a forged id (not the sorted pair)', () => setDoc(doc(as(M).firestore(), 'dm_conversations', 'zzz_' + M), { participants: [M, A] }), false);
    await expect('create convo id for alice+bob while being neither', () => setDoc(doc(as(M).firestore(), 'dm_conversations', AB + 'x'), { participants: [A, B] }), false);
    await expect('create 3-person convo', () => setDoc(doc(as(M).firestore(), 'dm_conversations', id(M, C)), { participants: [M, C, A] }), false);
    await expect('create 1-person convo', () => setDoc(doc(as(M).firestore(), 'dm_conversations', M + '_' + M), { participants: [M] }), false);
    await expect('create convo with self twice', () => setDoc(doc(as(M).firestore(), 'dm_conversations', M + '_' + M), { participants: [M, M] }), false);
    await expect('create convo with participants as a map', () => setDoc(doc(as(M).firestore(), 'dm_conversations', id(M, C)), { participants: { a: M, b: C } }), false);
    await expect('anonymous creates convo', () => setDoc(doc(anon('anonx').firestore(), 'dm_conversations', id('anonx', A)), { participants: ['anonx', A] }), false);
    await expect('attacker adds self to alice/bob convo', () => updateDoc(doc(as(M).firestore(), 'dm_conversations', AB), { participants: [A, B, M] }), false);
    await expect('attacker set-merges into alice/bob convo (client fallback path)', () => setDoc(doc(as(M).firestore(), 'dm_conversations', AB), { participants: [M, A], lastMessage: 'x' }, { merge: true }), false);
    await expect('participant swaps partner', () => updateDoc(doc(as(A).firestore(), 'dm_conversations', AB), { participants: [A, M] }), false);
    await expect('attacker reads alice/bob convo doc', () => getDoc(doc(as(M).firestore(), 'dm_conversations', AB)), false);
    await expect('attacker reads alice/bob messages', () => getDoc(doc(as(M).firestore(), 'dm_conversations', AB, 'messages', 'm1')), false);

    console.log('--- normal DM flows keep working ---');
    await expect('carol starts a DM with bob (client create shape)', () => setDoc(doc(as(C).firestore(), 'dm_conversations', id(B, C)), { participants: [C, B], participantNames: { [C]: 'carol', [B]: 'bob' }, lastMessage: 'yo', lastSenderUid: C, ['unread_' + B]: 1 }), true);
    await expect('buddy-match create shape (isBuddyMatch, other order)', () => setDoc(doc(as(A).firestore(), 'dm_conversations', id(A, C)), { participants: [C, A], lastMessage: 'match', lastSenderUid: A, isBuddyMatch: true }), true);
    await expect('participant updates metadata', () => updateDoc(doc(as(B).firestore(), 'dm_conversations', AB), { lastMessage: 'sup', ['unread_' + A]: 1 }), true);
    await expect('participant reads convo', () => getDoc(doc(as(B).firestore(), 'dm_conversations', AB)), true);
    await expect('participant reads messages', () => getDoc(doc(as(A).firestore(), 'dm_conversations', AB, 'messages', 'm0')), true);
    await expect('participant sends text message', () => setDoc(doc(as(A).firestore(), 'dm_conversations', AB, 'messages', 't1'), { senderUid: A, text: 'hi bob' }), true);

    console.log('--- F1: squatted or 3-person conversation docs from before the fix ---');
    const msg = (u, cid, mid) => setDoc(doc(as(u).firestore(), 'dm_conversations', cid, 'messages', mid), { senderUid: u, text: 'hi' });
    await expect('mallory reads messages in squatted alice_dave [mallory, alice]', () => getDoc(doc(as(M).firestore(), 'dm_conversations', SQ, 'messages', 'old1')), false);
    await expect('mallory posts into squatted alice_dave', () => msg(M, SQ, 'x1'), false);
    await expect('alice posts into squatted alice_dave', () => msg(A, SQ, 'x2'), false);
    await expect('alice reads messages in squatted alice_dave', () => getDoc(doc(as(A).firestore(), 'dm_conversations', SQ, 'messages', 'old1')), false);
    await expect('alice updates lastMessage on squatted alice_dave', () => updateDoc(doc(as(A).firestore(), 'dm_conversations', SQ), { lastMessage: 'secret' }), false);
    await expect('mallory updates squatted alice_dave', () => updateDoc(doc(as(M).firestore(), 'dm_conversations', SQ), { lastMessage: 'x' }), false);
    await expect('member reads messages in 3-person doc', () => getDoc(doc(as(C).firestore(), 'dm_conversations', TRIO, 'messages', 'old1')), false);
    await expect('mallory reads messages in 3-person doc', () => getDoc(doc(as(M).firestore(), 'dm_conversations', TRIO, 'messages', 'old1')), false);
    await expect('mallory posts into 3-person doc', () => msg(M, TRIO, 'x3'), false);
    await expect('alice posts into 3-person doc', () => msg(A, TRIO, 'x4'), false);
    await expect('member updates 3-person doc', () => updateDoc(doc(as(C).firestore(), 'dm_conversations', TRIO), { lastMessage: 'x' }), false);

    console.log('--- F3: DM imageUrl must be our own Storage upload (or a Giphy/Tenor GIF) ---');
    const st = (bucket, owner, rest) => 'https://firebasestorage.googleapis.com/v0/b/' + bucket + '/o/dm-images%2F' + owner + '%2F' + (rest || '1731630000003_abc123.png') + '?alt=media&token=00000000-0000-0000-0000-000000000000';
    const LIVE = 'bitcoin-education-archive.firebasestorage.app', STG = 'bitcoin-quest-staging.firebasestorage.app';
    const img = (u, url, extra) => setDoc(doc(as(u).firestore(), 'dm_conversations', AB, 'messages', 'i' + Math.random().toString(36).slice(2)), Object.assign({ senderUid: u, text: '', imageUrl: url }, extra || {}));
    await expect('real live-bucket upload URL (what getDownloadURL writes)', () => img(B, st(LIVE, B)), true);
    await expect('real staging-bucket upload URL', () => img(B, st(STG, B)), true);
    await expect('per-conversation folder URL', () => img(B, st(LIVE, B, AB + '%2F1731630000004_abc123.jpg')), true);
    await expect('image with caption text', () => setDoc(doc(as(B).firestore(), 'dm_conversations', AB, 'messages', 'cap1'), { senderUid: B, text: 'look', imageUrl: st(LIVE, B) }), true);
    await expect('outside URL (tracking pixel)', () => img(B, 'https://evil.example/pixel.png?u=alice'), false);
    await expect('outside URL with isGif', () => img(B, 'https://evil.example/pixel.gif', { isGif: true }), false);
    await expect('Storage host but another project\'s bucket', () => img(B, st('evil-proj.appspot.com', B)), false);
    await expect('our bucket, someone else\'s folder', () => img(B, st(LIVE, A)), false);
    await expect('our bucket, not dm-images', () => img(B, 'https://firebasestorage.googleapis.com/v0/b/' + LIVE + '/o/profile-pics%2F' + B + '%2Fa.png?alt=media&token=abc'), false);
    await expect('host look-alike (firebasestorage.googleapis.com.evil.example)', () => img(B, 'https://firebasestorage.googleapis.com.evil.example/v0/b/' + LIVE + '/o/dm-images%2F' + B + '%2Fa.png?alt=media&token=abc'), false);
    await expect('extra query params appended', () => img(B, st(LIVE, B) + '&x=https://evil.example'), false);
    await expect('http:// (not https)', () => img(B, st(LIVE, B).replace('https:', 'http:')), false);
    await expect('imageUrl not a string', () => img(B, 42), false);
    await expect('empty text and empty imageUrl', () => img(B, ''), false);
    const NO = 'nostr:ab12cd34';
    await expect('nostr user starts a DM with bob', () => setDoc(doc(as(NO).firestore(), 'dm_conversations', id(B, NO)), { participants: [NO, B], lastMessage: 'gm' }), true);
    await expect('nostr user sends own upload (uid encoded nostr%3A...)', () => setDoc(doc(as(NO).firestore(), 'dm_conversations', id(B, NO), 'messages', 'n1'), { senderUid: NO, text: '', imageUrl: st(LIVE, 'nostr%3Aab12cd34') }), true);
    await expect('nostr user, raw unencoded uid in URL', () => setDoc(doc(as(NO).firestore(), 'dm_conversations', id(B, NO), 'messages', 'n2'), { senderUid: NO, text: '', imageUrl: st(LIVE, NO) }), false);
    await expect('Giphy GIF from the DM GIF picker (isGif)', () => img(B, 'https://media2.giphy.com/media/abc123XYZ/giphy.gif?cid=790b7611x&rid=giphy.gif&ct=g', { isGif: true }), true);
    await expect('Tenor GIF (isGif)', () => img(B, 'https://media.tenor.com/abcDEF/tenor.gif', { isGif: true }), true);
    await expect('Giphy URL without isGif', () => img(B, 'https://media2.giphy.com/media/abc/giphy.gif'), false);

    await env.cleanup();
    console.log(failed ? ('\n' + failed + ' FAILED') : '\nALL PASS');
    process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
