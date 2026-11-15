#!/usr/bin/env node
// F2: rotate download tokens on existing DM photos and rewrite imageUrl.
// Boots throwaway Firestore (8195) + Storage (9195) emulators. Never talks
// to live or staging. Never prints download tokens, only hashes and masked
// paths. Run: node tests/test-reset-dm-photo-tokens.js
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const script = path.join(root, 'functions', 'scripts', 'reset-dm-photo-tokens.js');
const scratch = '/tmp/rufus-f2reset';
const PROJECT = 'demo-f2reset';
const CANONICAL_BUCKET = 'bitcoin-education-archive.firebasestorage.app';
const STORAGE_BUCKET = PROJECT + '.appspot.com';

// Build fixture tokens at runtime so the source and PR diff do not contain
// token-shaped literals. They still must never be printed.
function fixtureToken(ch) {
    const c = String(ch);
    return c.repeat(8) + '-' + c.repeat(4) + '-4' + c.repeat(3) + '-8' + c.repeat(3) + '-' + c.repeat(12);
}
const T = {
    alice: fixtureToken('a'),
    nostr: fixtureToken('b'),
    ln: fixtureToken('c'),
    orphan: fixtureToken('d'),
    dave: fixtureToken('e'),
    mallory: fixtureToken('f'),
    scoped: '1'.repeat(8) + '-' + '1'.repeat(4) + '-4111-8111-' + '1'.repeat(12),
};

const A = 'alice', B = 'bob', C = 'carol', D = 'dave', M = 'mallory';
const N = 'nostr:npub1f2test', P = 'partner0001';
const L = 'ln:f2tester', Q = 'zzzpartner';
const id = function (x, y) { return x < y ? x + '_' + y : y + '_' + x; };
const PATHS = {
    alice: 'dm-images/' + A + '/111_aaa.jpg',
    nostr: 'dm-images/' + N + '/222_bbb.jpg',
    ln: 'dm-images/' + L + '/333_ccc.jpg',
    orphan: 'dm-images/' + A + '/orphan_ddd.jpg',
    dave: 'dm-images/' + D + '/444_eee.jpg',
    mallory: 'dm-images/' + M + '/555_fff.jpg',
    scoped: 'dm-images/' + A + '/' + id(A, B) + '/666_ggg.jpg',
};


function allFixtureTokens() {
    return Object.keys(T).map(function (k) { return T[k]; });
}

function uuidRe() {
    return /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
}

function assertNoSecrets(text, label) {
    const s = String(text || '');
    allFixtureTokens().forEach(function (tok) {
        if (s.indexOf(tok) !== -1) throw new Error('token leaked in ' + label);
    });
    if (uuidRe().test(s)) throw new Error('token leaked in ' + label);
}

function cleanEnv(extra) {
    const env = Object.assign({}, process.env, extra || {});
    delete env.FIREBASE_SA_JSON;
    delete env.GOOGLE_APPLICATION_CREDENTIALS;
    delete env.RESET_CONFIRM;
    delete env.BQ_R2_BACKUP_READER_KEY;
    delete env.GCP_BACKUP_READER_KEY;
    return env;
}

function javaPath() {
    const bins = ['/tmp/jre/bin', '/home/box/jre/bin', '/home/box/jdk/jdk-21.0.13+9-jre/bin'].filter(function (d) {
        return fs.existsSync(path.join(d, 'java'));
    });
    return bins.concat([process.env.PATH || '']).join(path.delimiter);
}

// Run unit tests and (on a cold start) the emulator-backed suite. Strip live
// credentials before any child is spawned.
if (!process.env.FIRESTORE_EMULATOR_HOST) {
    delete process.env.FIREBASE_SA_JSON;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.RESET_CONFIRM;
    runUnitTests();
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--only', 'firestore,storage',
        '--project', PROJECT,
        '--config', path.join(root, 'firebase.f2reset.json'),
        'node tests/test-reset-dm-photo-tokens.js',
    ], {
        cwd: root,
        encoding: 'utf8',
        env: cleanEnv({
            CI: 'true',
            FIRESTORE_EMULATOR_HOST: '127.0.0.1:8195',
            FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9195',
            GCLOUD_PROJECT: PROJECT,
            GOOGLE_CLOUD_PROJECT: PROJECT,
            F2RESET_STORAGE_BUCKET: STORAGE_BUCKET,
            PATH: javaPath(),
        }),
        timeout: 300000,
    });
    const out = (child.stdout || '') + (child.stderr || '');
    try { assertNoSecrets(out, 'emulator wrapper output'); } catch (e) {
        console.error('FAIL  ' + e.message);
        process.exit(1);
    }
    if (child.status !== 0) {
        // Print the child's output only after the secret scan passed.
        process.stdout.write(child.stdout || '');
        process.stderr.write(child.stderr || '');
        process.exit(child.status == null ? 1 : child.status);
    }
    process.stdout.write(child.stdout || '');
    process.exit(0);
}

module.paths.unshift(path.join(__dirname, 'rules', 'node_modules'));
const admin = require('../functions/src/firebaseAdmin');
const scriptMod = require('../functions/scripts/reset-dm-photo-tokens.js');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, collection, addDoc, serverTimestamp } = require('firebase/firestore');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const pw = { firebase: { sign_in_provider: 'password' } };

let failed = 0;
let passed = 0;
function ok(name) {
    passed += 1;
    console.log('PASS  ' + name);
}
function bad(name, err) {
    failed += 1;
    const msg = err && err.message ? String(err.message) : String(err || 'failed');
    console.log('FAIL  ' + name + '  ' + scriptMod.redactSecrets(msg));
}
async function expect(name, fn) {
    try {
        await fn();
        ok(name);
    } catch (e) {
        bad(name, e);
    }
}

function canonUrl(objectPath, token) {
    return scriptMod.canonicalDownloadUrl(CANONICAL_BUCKET, objectPath, token);
}

function emuUrl(objectPath, token) {
    return 'http://127.0.0.1:9195/v0/b/' + STORAGE_BUCKET + '/o/'
        + encodeURIComponent(objectPath) + '?alt=media&token=' + token;
}

async function httpStatus(url) {
    let lastErr;
    for (let i = 0; i < 5; i++) {
        try {
            const res = await fetch(url, { redirect: 'manual' });
            return res.status;
        } catch (e) {
            lastErr = e;
            await new Promise(function (r) { setTimeout(r, 200 * (i + 1)); });
        }
    }
    throw lastErr || new Error('fetch failed');
}

function runScript(args, extraEnv) {
    const env = cleanEnv({
        FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
        FIREBASE_STORAGE_EMULATOR_HOST: process.env.FIREBASE_STORAGE_EMULATOR_HOST,
        GCLOUD_PROJECT: PROJECT,
        GOOGLE_CLOUD_PROJECT: PROJECT,
        F2RESET_STORAGE_BUCKET: STORAGE_BUCKET,
    });
    if (extraEnv) {
        Object.keys(extraEnv).forEach(function (k) {
            if (extraEnv[k] === null) delete env[k];
            else env[k] = extraEnv[k];
        });
    }
    const r = spawnSync('node', [script].concat(args), {
        cwd: root,
        encoding: 'utf8',
        env: env,
        timeout: 120000,
    });
    const out = (r.stdout || '') + (r.stderr || '');
    assertNoSecrets(out, 'script output');
    return r;
}

function defaultArgs() {
    return [
        '--project', PROJECT,
        '--bucket', STORAGE_BUCKET,
        '--canonical-bucket', CANONICAL_BUCKET,
        '--plan', path.join(scratch, 'plan-' + PROJECT + '.json'),
        '--audit', path.join(scratch, 'audit-' + PROJECT + '.log'),
        '--rollback-dir', scratch,
    ];
}

async function putPhoto(bucket, objectPath, token) {
    const file = bucket.file(objectPath);
    await file.save(PNG, {
        resumable: false,
        metadata: {
            contentType: 'image/jpeg',
            metadata: { firebaseStorageDownloadTokens: token },
        },
    });
}

async function seed(db, bucket) {
    await putPhoto(bucket, PATHS.alice, T.alice);
    await putPhoto(bucket, PATHS.nostr, T.nostr);
    await putPhoto(bucket, PATHS.ln, T.ln);
    await putPhoto(bucket, PATHS.orphan, T.orphan);
    await putPhoto(bucket, PATHS.dave, T.dave);
    await putPhoto(bucket, PATHS.mallory, T.mallory);
    await putPhoto(bucket, PATHS.scoped, T.scoped);

    await db.collection('dm_conversations').doc(id(A, B)).set({
        participants: [A, B],
        lastMessage: '📷 Image',
        lastSenderUid: A,
    });
    const aliceMsg = await db.collection('dm_conversations').doc(id(A, B)).collection('messages').add({
        senderUid: A,
        senderName: 'Alice',
        text: '',
        imageUrl: canonUrl(PATHS.alice, T.alice),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const scopedMsg = await db.collection('dm_conversations').doc(id(A, B)).collection('messages').add({
        senderUid: A,
        senderName: 'Alice',
        text: '',
        imageUrl: canonUrl(PATHS.scoped, T.scoped),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const gifMsg = await db.collection('dm_conversations').doc(id(A, B)).collection('messages').add({
        senderUid: A,
        senderName: 'Alice',
        text: '',
        imageUrl: 'https://media1.giphy.com/media/abc123/giphy.gif',
        isGif: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Leftover convo field holding the same URL as the alice photo, to prove
    // we rewrite non-message fields too. lastMessage stays the text preview.
    await db.collection('dm_conversations').doc(id(A, B)).update({
        imageUrl: canonUrl(PATHS.alice, T.alice),
    });

    await db.collection('dm_conversations').doc(id(N, P)).set({
        participants: [N, P],
        lastMessage: '📷 Image',
        lastSenderUid: N,
    });
    const nostrMsg = await db.collection('dm_conversations').doc(id(N, P)).collection('messages').add({
        senderUid: N,
        senderName: 'Nostr',
        text: '',
        imageUrl: canonUrl(PATHS.nostr, T.nostr),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection('dm_conversations').doc(id(L, Q)).set({
        participants: [L, Q],
        lastMessage: '📷 Image',
        lastSenderUid: L,
    });
    const lnMsg = await db.collection('dm_conversations').doc(id(L, Q)).collection('messages').add({
        senderUid: L,
        senderName: 'Lightning',
        text: '',
        imageUrl: canonUrl(PATHS.ln, T.ln),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Malformed: unsorted id (sorted pair would be carol_dave).
    await db.collection('dm_conversations').doc(D + '_' + C).set({
        participants: [C, D],
        lastMessage: '📷 Image',
        lastSenderUid: D,
    });
    const daveMsg = await db.collection('dm_conversations').doc(D + '_' + C).collection('messages').add({
        senderUid: D,
        senderName: 'Dave',
        text: '',
        imageUrl: canonUrl(PATHS.dave, T.dave),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Malformed: 3 participants.
    await db.collection('dm_conversations').doc('three-people').set({
        participants: [A, B, M],
        lastMessage: '📷 Image',
        lastSenderUid: M,
    });
    const malloryMsg = await db.collection('dm_conversations').doc('three-people').collection('messages').add({
        senderUid: M,
        senderName: 'Mallory',
        text: '',
        imageUrl: canonUrl(PATHS.mallory, T.mallory),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
        aliceMsg: aliceMsg.id,
        scopedMsg: scopedMsg.id,
        gifMsg: gifMsg.id,
        nostrMsg: nostrMsg.id,
        lnMsg: lnMsg.id,
        daveMsg: daveMsg.id,
        malloryMsg: malloryMsg.id,
    };
}

function runUnitTests() {
    const mod = require(script);
    function unit(name, fn) {
        try { fn(); console.log('PASS  ' + name); }
        catch (e) {
            console.log('FAIL  ' + name + '  ' + mod.redactSecrets(e.message || e));
            process.exit(1);
        }
    }
    unit('mask nostr and lightning uids', function () {
        const n = mod.maskUid('nostr:npub1f2test');
        if (n.indexOf('nostr:') !== 0) throw new Error('missing nostr prefix');
        if (n.indexOf('npub1f2test') !== -1) throw new Error('uid not masked');
        const l = mod.maskUid('ln:f2tester');
        if (l.indexOf('ln:') !== 0) throw new Error('missing ln prefix');
        if (l === 'ln:f2tester') throw new Error('ln uid not masked');
    });
    unit('F3 accepts %3A in nostr paths and the canonical bucket', function () {
        const url = mod.canonicalDownloadUrl(CANONICAL_BUCKET, PATHS.nostr, T.nostr);
        if (!mod.isF3CanonicalUrl(url, N, CANONICAL_BUCKET)) throw new Error('F3 rejected a nostr URL');
        const alice = mod.canonicalDownloadUrl(CANONICAL_BUCKET, PATHS.alice, T.alice);
        if (!mod.isF3CanonicalUrl(alice, A, CANONICAL_BUCKET)) throw new Error('F3 rejected an alice URL');
        const bad = alice.replace(CANONICAL_BUCKET, 'other.appspot.com');
        if (mod.isF3CanonicalUrl(bad, A, CANONICAL_BUCKET)) throw new Error('F3 accepted a wrong bucket');
    });
    unit('dmConvoShape skips unsorted ids and 3-person docs', function () {
        const unsorted = mod.dmConvoShape(D + '_' + C, { participants: [C, D] });
        if (unsorted.ok || unsorted.reason !== 'id_not_sorted_pair') throw new Error('unsorted not skipped');
        const three = mod.dmConvoShape('three-people', { participants: [A, B, M] });
        if (three.ok || three.reason !== 'participant_count') throw new Error('3-person not skipped');
        const okShape = mod.dmConvoShape(id(A, B), { participants: [A, B] });
        if (!okShape.ok) throw new Error('well-formed rejected');
    });
    unit('redactSecrets strips tokens and token query params', function () {
        const raw = 'see ?alt=media&token=' + T.alice + ' and ' + T.nostr;
        const out = mod.redactSecrets(raw);
        assertNoSecrets(out, 'redactSecrets output');
        if (out.indexOf('[redacted]') === -1 && out.indexOf('[redacted-token]') === -1) {
            throw new Error('redaction missing markers');
        }
    });
    unit('shred path allowlist refuses files outside rollback dirs', function () {
        let threw = false;
        try { mod.assertRollbackFilePath('/tmp/not-allowed/rollback-x.json', false); }
        catch (e) { threw = true; }
        if (!threw) throw new Error('allowed a path outside the rollback dirs');
        threw = false;
        try { mod.assertRollbackFilePath(path.join(scratch, 'plan-demo.json'), false); }
        catch (e) { threw = true; }
        if (!threw) throw new Error('allowed a non-rollback filename');
    });
    unit('--shred-rollback securely deletes a rollback file', function () {
        fs.mkdirSync(scratch, { recursive: true, mode: 0o700 });
        const f = path.join(scratch, 'rollback-unit-shred.json');
        fs.writeFileSync(f, JSON.stringify({ oldToken: T.alice }), { mode: 0o600 });
        const name = mod.shredRollbackFile(f);
        if (name !== 'rollback-unit-shred.json') throw new Error('unexpected name');
        if (fs.existsSync(f)) throw new Error('file still exists after shred');
    });
    unit('live apply without RESET_CONFIRM is refused before any client init', function () {
        const plan = path.join(scratch, 'plan-refuse.json');
        fs.mkdirSync(scratch, { recursive: true, mode: 0o700 });
        fs.writeFileSync(plan, '{}\n', { mode: 0o600 });
        const env = cleanEnv({});
        delete env.FIRESTORE_EMULATOR_HOST;
        delete env.FIREBASE_STORAGE_EMULATOR_HOST;
        delete env.RESET_CONFIRM;
        delete env.FIREBASE_SA_JSON;
        const r = spawnSync('node', [script,
            '--project', 'bitcoin-education-archive',
            '--plan', plan,
            '--apply',
            '--plan-sha', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        ], { cwd: root, encoding: 'utf8', env: env, timeout: 15000 });
        const out = (r.stdout || '') + (r.stderr || '');
        assertNoSecrets(out, 'refuse-apply output');
        if (r.status === 0) throw new Error('live apply was not refused');
        if (!/RESET_CONFIRM=dm-photo-tokens/.test(out)) throw new Error('missing confirm error');
    });
}

(async function main() {
    delete process.env.FIREBASE_SA_JSON;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.RESET_CONFIRM;
    fs.mkdirSync(scratch, { recursive: true, mode: 0o700 });

    if (!admin.apps.length) {
        admin.initializeApp({ projectId: PROJECT, storageBucket: STORAGE_BUCKET });
    }
    const db = admin.firestore();
    const bucket = admin.storage().bucket(STORAGE_BUCKET);

    const ids = await seed(db, bucket);

    // Old tokenized emulator URLs should work before the reset.
    await expect('seeded alice photo is reachable with the old token', async function () {
        const status = await httpStatus(emuUrl(PATHS.alice, T.alice));
        if (status !== 200) throw new Error('expected 200 before apply, got ' + status);
    });

    const dry = runScript(defaultArgs().concat(['--dry-run']));
    await expect('dry-run exits 0 and writes a plan', async function () {
        if (dry.status !== 0) throw new Error('dry-run failed: ' + (dry.stderr || '').trim());
        if (!/mode dry-run/.test(dry.stdout)) throw new Error('missing dry-run mode');
    });

    const planPath = path.join(scratch, 'plan-' + PROJECT + '.json');
    const auditPath = path.join(scratch, 'audit-' + PROJECT + '.log');
    let plan, planSha;
    await expect('plan has hashes only, mode 600, and the right counts', async function () {
        if (!fs.existsSync(planPath)) throw new Error('plan missing');
        const mode = fs.statSync(planPath).mode & 0o777;
        if (mode !== 0o600) throw new Error('plan mode is ' + mode.toString(8));
        const bytes = fs.readFileSync(planPath);
        assertNoSecrets(bytes.toString('utf8'), 'plan file');
        plan = JSON.parse(bytes.toString('utf8'));
        planSha = scriptMod.sha256Hex(bytes);
        if (plan.counts.skippedConversations !== 2) throw new Error('expected 2 skipped convos, got ' + plan.counts.skippedConversations);
        if (plan.counts.skippedObjects !== 2) throw new Error('expected 2 skipped objects, got ' + plan.counts.skippedObjects);
        if (plan.counts.plannedMessages !== 4) throw new Error('expected 4 planned messages, got ' + plan.counts.plannedMessages);
        if (plan.counts.plannedConvoFields !== 1) throw new Error('expected 1 convo field, got ' + plan.counts.plannedConvoFields);
        if (plan.counts.orphanObjects !== 1) throw new Error('expected 1 orphan, got ' + plan.counts.orphanObjects);
        if (plan.counts.plannedObjects !== 5) throw new Error('expected 5 planned objects, got ' + plan.counts.plannedObjects);
        const reasons = (plan.skippedConversations || []).map(function (s) { return s.reason; }).sort();
        if (reasons.join(',') !== 'id_not_sorted_pair,participant_count') {
            throw new Error('unexpected skip reasons ' + reasons.join(','));
        }
        (plan.items || []).forEach(function (it) {
            if (it.oldTokenSha256 && it.oldTokenSha256.length !== 64) throw new Error('token hash missing');
            if (it.objectPathMasked.indexOf('alice') !== -1 || it.objectPathMasked.indexOf(N) !== -1) {
                throw new Error('object path not masked');
            }
        });
    });

    await expect('wrong plan-sha refuses and writes nothing', async function () {
        const before = await httpStatus(emuUrl(PATHS.alice, T.alice));
        const r = runScript(defaultArgs().concat([
            '--apply', '--plan-sha', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        ]));
        if (r.status === 0) throw new Error('wrong sha was accepted');
        if (!/plan sha mismatch/.test((r.stdout || '') + (r.stderr || ''))) throw new Error('missing sha error');
        const after = await httpStatus(emuUrl(PATHS.alice, T.alice));
        if (before !== 200 || after !== 200) throw new Error('object was mutated after a refused apply');
        const snap = await db.collection('dm_conversations').doc(id(A, B)).collection('messages').doc(ids.aliceMsg).get();
        if (snap.data().imageUrl !== canonUrl(PATHS.alice, T.alice)) throw new Error('message was mutated after a refused apply');
    });

    const applied = runScript(defaultArgs().concat(['--apply', '--plan-sha', planSha]));
    let rollbackPath = '';
    await expect('apply exits 0, rotates, and reports the rollback path', async function () {
        if (applied.status !== 0) throw new Error('apply failed: ' + (applied.stderr || '').trim());
        if (!/mode apply/.test(applied.stdout)) throw new Error('missing apply mode');
        if (!/rotated 5/.test(applied.stdout)) throw new Error('expected 5 rotations');
        const m = applied.stdout.match(/^rollback (.+)$/m);
        if (!m) throw new Error('missing rollback path');
        rollbackPath = m[1].trim();
        if (!fs.existsSync(rollbackPath)) throw new Error('rollback file missing');
        const mode = fs.statSync(rollbackPath).mode & 0o777;
        if (mode !== 0o600) throw new Error('rollback mode is ' + mode.toString(8));
        const rb = JSON.parse(fs.readFileSync(rollbackPath, 'utf8'));
        if (!rb.items || rb.items.length !== 5) throw new Error('rollback item count');
        const olds = rb.items.map(function (it) { return it.oldToken; });
        if (olds.indexOf(T.alice) === -1) throw new Error('rollback missing an old token');
        if (rb.planSha256 !== planSha) throw new Error('rollback plan sha mismatch');
    });

    await expect('audit log has no tokens', async function () {
        if (!fs.existsSync(auditPath)) throw new Error('audit missing');
        assertNoSecrets(fs.readFileSync(auditPath, 'utf8'), 'audit log');
    });

    await expect('old alice URL is rejected and the new URL works', async function () {
        const oldStatus = await httpStatus(emuUrl(PATHS.alice, T.alice));
        if (oldStatus === 200) throw new Error('old token still works');
        if (oldStatus !== 403 && oldStatus !== 404) throw new Error('old token status ' + oldStatus);
        const rb = JSON.parse(fs.readFileSync(rollbackPath, 'utf8'));
        const item = rb.items.find(function (it) { return it.objectPath === PATHS.alice; });
        const newStatus = await httpStatus(emuUrl(PATHS.alice, item.newToken));
        if (newStatus !== 200) throw new Error('new token status ' + newStatus);
        const msg = await db.collection('dm_conversations').doc(id(A, B)).collection('messages').doc(ids.aliceMsg).get();
        const url = msg.data().imageUrl;
        assertNoSecrets(scriptMod.redactSecrets(url), 'rewritten url after redact');
        if (!scriptMod.isF3CanonicalUrl(url, A, CANONICAL_BUCKET)) throw new Error('rewritten message fails F3');
        if (url.indexOf(item.newToken) === -1) throw new Error('message was not rewritten to the new token');
        const convo = await db.collection('dm_conversations').doc(id(A, B)).get();
        if (convo.data().lastMessage !== '📷 Image') throw new Error('lastMessage preview was changed');
        if (convo.data().imageUrl.indexOf(item.newToken) === -1) throw new Error('convo imageUrl was not rewritten');
    });

    await expect('nostr and lightning URLs keep %3A and pass F3', async function () {
        const rb = JSON.parse(fs.readFileSync(rollbackPath, 'utf8'));
        const nostrItem = rb.items.find(function (it) { return it.objectPath === PATHS.nostr; });
        const lnItem = rb.items.find(function (it) { return it.objectPath === PATHS.ln; });
        const nostrMsg = await db.collection('dm_conversations').doc(id(N, P)).collection('messages').doc(ids.nostrMsg).get();
        const lnMsg = await db.collection('dm_conversations').doc(id(L, Q)).collection('messages').doc(ids.lnMsg).get();
        const nUrl = nostrMsg.data().imageUrl;
        const lUrl = lnMsg.data().imageUrl;
        if (nUrl.indexOf('dm-images%2Fnostr%3Anpub1f2test%2F') === -1) throw new Error('nostr path encoding missing');
        if (lUrl.indexOf('dm-images%2Fln%3Af2tester%2F') === -1) throw new Error('ln path encoding missing');
        if (!scriptMod.isF3CanonicalUrl(nUrl, N, CANONICAL_BUCKET)) throw new Error('nostr URL fails F3');
        if (!scriptMod.isF3CanonicalUrl(lUrl, L, CANONICAL_BUCKET)) throw new Error('ln URL fails F3');
        const nOld = await httpStatus(emuUrl(PATHS.nostr, T.nostr));
        const lOld = await httpStatus(emuUrl(PATHS.ln, T.ln));
        if (nOld === 200 || lOld === 200) throw new Error('old nostr/ln token still works');
        if (await httpStatus(emuUrl(PATHS.nostr, nostrItem.newToken)) !== 200) throw new Error('new nostr token failed');
        if (await httpStatus(emuUrl(PATHS.ln, lnItem.newToken)) !== 200) throw new Error('new ln token failed');
    });

    await expect('orphan was rotated and GIF / malformed messages were left alone', async function () {
        const orphanOld = await httpStatus(emuUrl(PATHS.orphan, T.orphan));
        if (orphanOld === 200) throw new Error('orphan old token still works');
        if (await httpStatus(emuUrl(PATHS.dave, T.dave)) !== 200) throw new Error('malformed dave object was rotated');
        if (await httpStatus(emuUrl(PATHS.mallory, T.mallory)) !== 200) throw new Error('malformed mallory object was rotated');
        const daveMsg = await db.collection('dm_conversations').doc(D + '_' + C).collection('messages').doc(ids.daveMsg).get();
        const malloryMsg = await db.collection('dm_conversations').doc('three-people').collection('messages').doc(ids.malloryMsg).get();
        const gifMsg = await db.collection('dm_conversations').doc(id(A, B)).collection('messages').doc(ids.gifMsg).get();
        if (daveMsg.data().imageUrl !== canonUrl(PATHS.dave, T.dave)) throw new Error('dave message was touched');
        if (malloryMsg.data().imageUrl !== canonUrl(PATHS.mallory, T.mallory)) throw new Error('mallory message was touched');
        if (gifMsg.data().imageUrl !== 'https://media1.giphy.com/media/abc123/giphy.gif') throw new Error('GIF message was touched');
    });

    await expect('rewritten message passes #334 rules and strangers are refused', async function () {
        const fsRules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
        const stRules = fs.readFileSync(path.join(root, 'storage.rules'), 'utf8');
        const [fh, fp] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
        const [sh, sp] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':');
        const env = await initializeTestEnvironment({
            projectId: PROJECT,
            firestore: { rules: fsRules, host: fh, port: Number(fp) },
            storage: { rules: stRules, host: sh, port: Number(sp) },
        });
        const alice = env.authenticatedContext(A, pw).firestore();
        const bob = env.authenticatedContext(B, pw).firestore();
        const mallory = env.authenticatedContext(M, pw).firestore();
        const msgRef = doc(alice, 'dm_conversations', id(A, B), 'messages', ids.aliceMsg);
        await assertSucceeds(getDoc(msgRef));
        await assertSucceeds(getDoc(doc(bob, 'dm_conversations', id(A, B), 'messages', ids.aliceMsg)));
        await assertFails(getDoc(doc(mallory, 'dm_conversations', id(A, B), 'messages', ids.aliceMsg)));
        const rewritten = (await db.collection('dm_conversations').doc(id(A, B)).collection('messages').doc(ids.aliceMsg).get()).data().imageUrl;
        await assertSucceeds(addDoc(collection(alice, 'dm_conversations', id(A, B), 'messages'), {
            senderUid: A,
            senderName: 'Alice',
            text: '',
            imageUrl: rewritten,
            createdAt: serverTimestamp(),
        }));
        const nostrUser = env.authenticatedContext(N, pw).firestore();
        const nostrRewritten = (await db.collection('dm_conversations').doc(id(N, P)).collection('messages').doc(ids.nostrMsg).get()).data().imageUrl;
        await assertSucceeds(addDoc(collection(nostrUser, 'dm_conversations', id(N, P), 'messages'), {
            senderUid: N,
            senderName: 'Nostr',
            text: '',
            imageUrl: nostrRewritten,
            createdAt: serverTimestamp(),
        }));
        await env.cleanup();
    });

    await expect('re-running apply changes nothing', async function () {
        const beforeMsg = (await db.collection('dm_conversations').doc(id(A, B)).collection('messages').doc(ids.aliceMsg).get()).data().imageUrl;
        const r = runScript(defaultArgs().concat(['--apply', '--plan-sha', planSha]));
        if (r.status !== 0) throw new Error('second apply failed');
        if (!/skipped-already 5/.test(r.stdout) && !/rotated 0/.test(r.stdout)) {
            throw new Error('second apply was not a no-op');
        }
        const afterMsg = (await db.collection('dm_conversations').doc(id(A, B)).collection('messages').doc(ids.aliceMsg).get()).data().imageUrl;
        if (afterMsg !== beforeMsg) throw new Error('second apply rewrote a message');
    });

    await expect('rollback restores the old tokens and message URLs', async function () {
        const r = runScript(['--rollback', rollbackPath, '--audit', auditPath]);
        if (r.status !== 0) throw new Error('rollback failed: ' + (r.stderr || '').trim());
        if (await httpStatus(emuUrl(PATHS.alice, T.alice)) !== 200) throw new Error('old token not restored');
        const msg = await db.collection('dm_conversations').doc(id(A, B)).collection('messages').doc(ids.aliceMsg).get();
        if (msg.data().imageUrl !== canonUrl(PATHS.alice, T.alice)) throw new Error('message URL not restored');
        const rb = JSON.parse(fs.readFileSync(rollbackPath, 'utf8'));
        const item = rb.items.find(function (it) { return it.objectPath === PATHS.alice; });
        const newStatus = await httpStatus(emuUrl(PATHS.alice, item.newToken));
        if (newStatus === 200) throw new Error('new token still works after rollback');
    });

    await expect('--shred-rollback removes the rollback file', async function () {
        if (!fs.existsSync(rollbackPath)) throw new Error('rollback missing before shred');
        const r = runScript(['--shred-rollback', rollbackPath]);
        if (r.status !== 0) throw new Error('shred failed: ' + (r.stderr || '').trim());
        if (!/mode shred-rollback/.test(r.stdout)) throw new Error('missing shred mode');
        if (fs.existsSync(rollbackPath)) throw new Error('rollback file still exists after shred');
    });

    if (failed) {
        console.log('RESULT  ' + passed + ' passed, ' + failed + ' failed');
        process.exit(1);
    }
    console.log('RESULT  ' + passed + '/' + (passed + failed) + ' passed');
    process.exit(0);
})().catch(function (err) {
    const msg = err && err.message ? String(err.message) : String(err);
    console.error('FAIL  suite  ' + scriptMod.redactSecrets(msg));
    process.exit(1);
});
