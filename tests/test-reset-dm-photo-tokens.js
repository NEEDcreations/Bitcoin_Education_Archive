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

const OUTSIDE_DIR = path.join(require('os').tmpdir(), 'f2reset-outside-' + process.pid);

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
    paren: fixtureToken('2'),
    multi1: fixtureToken('3'),
    multi2: fixtureToken('4'),
    cached: fixtureToken('5'),
    gone: fixtureToken('6'),
    intruder: fixtureToken('7'),
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
    paren: 'dm-images/' + A + '/777_photo (1).jpg',
    multi: 'dm-images/' + B + '/888_hhh.jpg',
    cached: 'dm-images/' + A + '/999_cache.jpg',
    tokenless: 'dm-images/' + A + '/000_none.jpg',
    gone: 'dm-images/' + C + '/vanish_iii.jpg',
};
// Raw ids that must never appear in script output (masked forms only).
const RAW_IDS = [id(A, B), id(N, P), id(L, Q), id(C, D), D + '_' + C, 'npub1f2test', 'f2tester', 'partner0001', 'zzzpartner', 'mallory'];

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

function assertNoRawIds(text, label) {
    const s = String(text || '');
    RAW_IDS.forEach(function (raw) {
        if (s.indexOf(raw) !== -1) throw new Error('raw uid/convo id leaked in ' + label);
    });
    if (/dm-images\/(alice|bob|carol|dave)\//.test(s)) throw new Error('raw object uid leaked in ' + label);
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

// An env with no emulator hosts and no way to find credentials, for checks
// that must be refused before any client is created. Even if a guard broke,
// nothing here could authenticate to a real project.
function noCredsLiveEnv(extra) {
    const env = cleanEnv({});
    Object.keys(env).forEach(function (k) { if (/_EMULATOR_HOST$/.test(k)) delete env[k]; });
    env.GOOGLE_APPLICATION_CREDENTIALS = '/nonexistent/f2reset-no-creds.json';
    env.CLOUDSDK_CONFIG = '/nonexistent/f2reset-no-gcloud';
    env.HOME = '/nonexistent/f2reset-no-home';
    env.GCE_METADATA_HOST = '127.0.0.1:9';
    env.METADATA_SERVER_DETECTION = 'none';
    Object.assign(env, extra || {});
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

// The URL a pre-#334 client would have stored (getDownloadURL encoding).
function clientUrl(objectPath, token) {
    return 'https://firebasestorage.googleapis.com/v0/b/' + CANONICAL_BUCKET + '/o/'
        + encodeURIComponent(objectPath) + '?alt=media&token=' + token;
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
    assertNoRawIds(out, 'script output');
    return r;
}

const planPath = path.join(scratch, 'plan-' + PROJECT + '.json');
const auditPath = path.join(scratch, 'audit-' + PROJECT + '.log');
const rollbackDir = path.join(scratch, 'rollback');

function defaultArgs(over) {
    const o = over || {};
    return [
        '--project', PROJECT,
        '--bucket', STORAGE_BUCKET,
        '--canonical-bucket', o.canonical || CANONICAL_BUCKET,
        '--plan', o.plan || planPath,
        '--audit', auditPath,
        '--rollback-dir', rollbackDir,
    ];
}

function rollbackFiles() {
    if (!fs.existsSync(rollbackDir)) return [];
    return fs.readdirSync(rollbackDir).filter(function (f) { return /^rollback-.*\.json$/.test(f); });
}

function rehashPlan(file, mutate) {
    const p = JSON.parse(fs.readFileSync(file, 'utf8'));
    mutate(p);
    fs.writeFileSync(file, scriptMod.stableStringify(p), { mode: 0o600 });
    return scriptMod.sha256Hex(fs.readFileSync(file));
}

async function putPhoto(bucket, objectPath, token, extra) {
    const file = bucket.file(objectPath);
    const meta = Object.assign({ contentType: 'image/jpeg' }, extra || {});
    if (token) meta.metadata = { firebaseStorageDownloadTokens: token };
    await file.save(PNG, { resumable: false, metadata: meta });
}

async function tokensOf(bucket, objectPath) {
    const [meta] = await bucket.file(objectPath).getMetadata();
    return scriptMod.tokensFromMetadata(meta);
}

async function addMsg(db, convoId, sender, url) {
    const ref = await db.collection('dm_conversations').doc(convoId).collection('messages').add({
        senderUid: sender,
        senderName: sender,
        text: '',
        imageUrl: url,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
}

async function msgUrl(db, convoId, msgId) {
    const snap = await db.collection('dm_conversations').doc(convoId).collection('messages').doc(msgId).get();
    return snap.exists ? snap.data().imageUrl : null;
}

async function seed(db, bucket) {
    await putPhoto(bucket, PATHS.alice, T.alice);
    await putPhoto(bucket, PATHS.nostr, T.nostr);
    await putPhoto(bucket, PATHS.ln, T.ln);
    await putPhoto(bucket, PATHS.orphan, T.orphan);
    await putPhoto(bucket, PATHS.dave, T.dave);
    await putPhoto(bucket, PATHS.mallory, T.mallory);
    await putPhoto(bucket, PATHS.scoped, T.scoped);
    await putPhoto(bucket, PATHS.paren, T.paren);
    await putPhoto(bucket, PATHS.multi, T.multi1 + ',' + T.multi2);
    await putPhoto(bucket, PATHS.cached, T.cached, { cacheControl: 'private, max-age=300', contentDisposition: 'inline' });
    await putPhoto(bucket, PATHS.tokenless, '');
    await putPhoto(bucket, PATHS.gone, T.gone);

    const ab = id(A, B);
    await db.collection('dm_conversations').doc(ab).set({ participants: [A, B], lastMessage: '📷 Image', lastSenderUid: A });
    const ids = {};
    ids.aliceMsg = await addMsg(db, ab, A, canonUrl(PATHS.alice, T.alice));
    ids.scopedMsg = await addMsg(db, ab, A, canonUrl(PATHS.scoped, T.scoped));
    const gif = await db.collection('dm_conversations').doc(ab).collection('messages').add({
        senderUid: A, senderName: 'Alice', text: '', isGif: true,
        imageUrl: 'https://media1.giphy.com/media/abc123/giphy.gif',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    ids.gifMsg = gif.id;
    // '(' and ' ' in the file name, stored the way getDownloadURL wrote it.
    ids.parenMsg = await addMsg(db, ab, A, clientUrl(PATHS.paren, T.paren));
    // One object, two tokens, one message per token (P7).
    ids.multiMsg1 = await addMsg(db, ab, B, canonUrl(PATHS.multi, T.multi1));
    ids.multiMsg2 = await addMsg(db, ab, B, canonUrl(PATHS.multi, T.multi2));
    // Leftover convo field holding the alice URL; lastMessage stays the preview.
    await db.collection('dm_conversations').doc(ab).update({ imageUrl: canonUrl(PATHS.alice, T.alice) });

    await db.collection('dm_conversations').doc(id(N, P)).set({ participants: [N, P], lastMessage: '📷 Image', lastSenderUid: N });
    ids.nostrMsg = await addMsg(db, id(N, P), N, canonUrl(PATHS.nostr, T.nostr));
    ids.nostrGoneMsg = await addMsg(db, id(N, P), N, canonUrl(PATHS.nostr, T.nostr));

    await db.collection('dm_conversations').doc(id(L, Q)).set({ participants: [L, Q], lastMessage: '📷 Image', lastSenderUid: L });
    ids.lnMsg = await addMsg(db, id(L, Q), L, canonUrl(PATHS.ln, T.ln));

    // Malformed: unsorted id (sorted pair would be carol_dave).
    await db.collection('dm_conversations').doc(D + '_' + C).set({ participants: [C, D], lastMessage: '📷 Image', lastSenderUid: D });
    ids.daveMsg = await addMsg(db, D + '_' + C, D, canonUrl(PATHS.dave, T.dave));
    // Well-formed convo whose message points at the same dave object (A1).
    await db.collection('dm_conversations').doc(id(C, D)).set({ participants: [C, D], lastMessage: '📷 Image', lastSenderUid: D });
    ids.daveWellMsg = await addMsg(db, id(C, D), D, canonUrl(PATHS.dave, T.dave));

    // Malformed: 3 participants.
    await db.collection('dm_conversations').doc('three-people').set({ participants: [A, B, M], lastMessage: '📷 Image', lastSenderUid: M });
    ids.malloryMsg = await addMsg(db, 'three-people', M, canonUrl(PATHS.mallory, T.mallory));
    return ids;
}

function throwsLike(fn, re, label) {
    let err = null;
    try { fn(); } catch (e) { err = e; }
    if (!err) throw new Error(label + ': did not throw');
    if (re && !re.test(String(err.message))) throw new Error(label + ': unexpected error ' + mod().redactSecrets(err.message));
}

function mod() { return require(script); }

function runUnitTests() {
    const m = mod();
    function unit(name, fn) {
        try { fn(); console.log('PASS  ' + name); }
        catch (e) {
            console.log('FAIL  ' + name + '  ' + m.redactSecrets(e.message || e));
            process.exit(1);
        }
    }
    unit('mask nostr and lightning uids', function () {
        const n = m.maskUid('nostr:npub1f2test');
        if (n.indexOf('nostr:') !== 0) throw new Error('missing nostr prefix');
        if (n.indexOf('npub1f2test') !== -1) throw new Error('uid not masked');
        const l = m.maskUid('ln:f2tester');
        if (l.indexOf('ln:') !== 0) throw new Error('missing ln prefix');
        if (l === 'ln:f2tester') throw new Error('ln uid not masked');
    });
    unit('F3 accepts %3A in nostr paths and the canonical bucket', function () {
        const url = m.canonicalDownloadUrl(CANONICAL_BUCKET, PATHS.nostr, T.nostr);
        if (!m.isF3CanonicalUrl(url, N, CANONICAL_BUCKET)) throw new Error('F3 rejected a nostr URL');
        const alice = m.canonicalDownloadUrl(CANONICAL_BUCKET, PATHS.alice, T.alice);
        if (!m.isF3CanonicalUrl(alice, A, CANONICAL_BUCKET)) throw new Error('F3 rejected an alice URL');
        const badUrl = alice.replace(CANONICAL_BUCKET, 'other.appspot.com');
        if (m.isF3CanonicalUrl(badUrl, A, CANONICAL_BUCKET)) throw new Error('F3 accepted a wrong bucket');
    });
    unit('A2: "(" file name encodes to %28/%29 and passes F3', function () {
        const url = m.canonicalDownloadUrl(CANONICAL_BUCKET, PATHS.paren, T.paren);
        if (url.indexOf('(') !== -1 || url.indexOf(')') !== -1) throw new Error('parens left raw');
        if (url.indexOf('%281%29') === -1) throw new Error('parens not percent-encoded');
        if (!m.isF3CanonicalUrl(url, A, CANONICAL_BUCKET)) throw new Error('F3 rejected the ( URL');
        if (!m.f3CheckObject(PATHS.paren, CANONICAL_BUCKET)) throw new Error('f3CheckObject rejected the ( object');
        const enc = m.encodePath("dm-images/a/x!'()*~.jpg");
        if (/[!'()*~]/.test(enc)) throw new Error('encodePath left a reserved char raw');
        const back = m.parseStorageUrl(url);
        if (!back || back.objectPath !== PATHS.paren) throw new Error('encoded URL does not decode to the object');
    });
    unit('A2: f3CheckObject fails an empty uploader and a non-F3 bucket', function () {
        if (m.f3CheckObject('dm-images//x.jpg', CANONICAL_BUCKET)) throw new Error('empty uploader passed F3');
        if (m.f3CheckObject(PATHS.alice, 'other-bucket.firebasestorage.app')) throw new Error('non-F3 bucket passed');
    });
    unit('dmConvoShape skips unsorted ids and 3-person docs', function () {
        const unsorted = m.dmConvoShape(D + '_' + C, { participants: [C, D] });
        if (unsorted.ok || unsorted.reason !== 'id_not_sorted_pair') throw new Error('unsorted not skipped');
        const three = m.dmConvoShape('three-people', { participants: [A, B, M] });
        if (three.ok || three.reason !== 'participant_count') throw new Error('3-person not skipped');
        if (!m.dmConvoShape(id(A, B), { participants: [A, B] }).ok) throw new Error('well-formed rejected');
    });
    unit('redactSecrets strips tokens and token query params', function () {
        const out = m.redactSecrets('see ?alt=media&token=' + T.alice + ' and ' + T.nostr);
        assertNoSecrets(out, 'redactSecrets output');
        if (out.indexOf('[redacted]') === -1 && out.indexOf('[redacted-token]') === -1) throw new Error('redaction missing markers');
    });
    unit('A5/R7: redactSecrets masks uids in raw Firestore and Storage error text', function () {
        const raw = '5 NOT_FOUND: No document to update: projects/demo/databases/(default)/documents/dm_conversations/'
            + 'alice1234567_bobby7890123/messages/m1; object dm-images/alice1234567/alice1234567_bobby7890123/x.jpg; '
            + 'url /o/dm-images%2Fnostr%3Anpub1longuid999%2F1.jpg?alt=media&token=' + T.alice;
        const out = m.redactSecrets(raw);
        ['alice1234567', 'bobby7890123', 'npub1longuid999'].forEach(function (u) {
            if (out.indexOf(u) !== -1) throw new Error('uid survived redaction');
        });
        assertNoSecrets(out, 'redacted error');
        if (out.indexOf('dm_conversations/') === -1) throw new Error('lost the collection name');
        if (m.redactSecrets(out) !== out) throw new Error('masking is not idempotent');
    });
    unit('A3: split env (only STORAGE_EMULATOR_HOST, or any lone *_EMULATOR_HOST) is refused', function () {
        throwsLike(function () { m.emulatorMode({ STORAGE_EMULATOR_HOST: 'http://127.0.0.1:9195' }); }, /split environment/, 'storage only');
        throwsLike(function () { m.emulatorMode({ FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }); }, /split environment/, 'auth only');
        throwsLike(function () { m.emulatorMode({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8195' }); }, /split environment/, 'firestore only');
        throwsLike(function () {
            m.emulatorMode({ FIRESTORE_EMULATOR_HOST: 'a:1', FIREBASE_STORAGE_EMULATOR_HOST: 'b:2', STORAGE_EMULATOR_HOST: 'http://c:3' });
        }, /does not match/, 'mismatched storage hosts');
        if (m.emulatorMode({ PATH: '/bin' }) !== false) throw new Error('clean env is not live mode');
        if (m.emulatorMode({ FIRESTORE_EMULATOR_HOST: 'a:1', FIREBASE_STORAGE_EMULATOR_HOST: 'b:2' }) !== true) throw new Error('emulator env not detected');
        throwsLike(function () {
            m.preflight({ project: 'bitcoin-education-archive' }, { STORAGE_EMULATOR_HOST: 'http://127.0.0.1:9195' });
        }, /split environment/, 'preflight live + storage emulator');
    });
    unit('A3: live defaults to the firebasestorage.app bucket and refuses any other', function () {
        if (m.defaultBucketFor('bitcoin-education-archive') !== 'bitcoin-education-archive.firebasestorage.app') throw new Error('wrong live default');
        if (/appspot/.test(m.defaultBucketFor('demo-x'))) throw new Error('appspot default');
        const pre = m.preflight({ project: 'bitcoin-education-archive' }, {});
        if (pre.emulator || pre.bucket !== 'bitcoin-education-archive.firebasestorage.app') throw new Error('live preflight bucket');
        throwsLike(function () { m.preflight({ project: 'bitcoin-education-archive', bucket: 'bitcoin-education-archive.appspot.com' }, {}); }, /refusing live bucket/, 'appspot');
        throwsLike(function () { m.preflight({ project: 'bitcoin-education-archive', canonicalBucket: 'x.firebasestorage.app' }, {}); }, /canonical/, 'canonical override');
        throwsLike(function () { m.preflight({ project: 'some-other-project' }, {}); }, /unknown project/, 'unknown project');
        throwsLike(function () {
            m.preflight({ project: 'bitcoin-education-archive' }, { FIRESTORE_EMULATOR_HOST: 'a:1', FIREBASE_STORAGE_EMULATOR_HOST: 'b:2' });
        }, /real project/, 'emulator + live id');
    });
    unit('A6: live rollback dir is forced to /workspace/private/f2reset/rollback', function () {
        const pre = m.preflight({ project: 'bitcoin-education-archive' }, {});
        if (pre.rollbackDir !== m.LIVE_ROLLBACK_DIR || m.LIVE_ROLLBACK_DIR.indexOf('/workspace/private/f2reset') !== 0) throw new Error('live rollback dir');
        throwsLike(function () { m.preflight({ project: 'bitcoin-education-archive', rollbackDir: '/tmp/x' }, {}); }, /--rollback-dir on live/, 'tmp dir');
        throwsLike(function () { m.preflight({ project: 'bitcoin-education-archive', rollbackDir: '/workspace/private/f2reset' }, {}); }, /--rollback-dir on live/, 'parent dir');
        const dirs = m.rollbackAllowedDirs({});
        if (dirs.length !== 1 || dirs[0] !== m.LIVE_ROLLBACK_DIR) throw new Error('live allowlist ' + dirs.join(','));
        throwsLike(function () { m.assertRollbackFilePath('/tmp/rufus-f2reset/rollback/rollback-x.json', false, dirs); }, /outside/, 'tmp on live');
        throwsLike(function () { m.assertRollbackFilePath('/tmp/x/rollback-x.json', false, dirs); }, /outside/, 'plan dir on live');
        m.assertRollbackFilePath(m.LIVE_ROLLBACK_DIR + '/rollback-x.json', false, dirs);
    });
    unit('shred path allowlist refuses files outside rollback dirs', function () {
        throwsLike(function () { m.assertRollbackFilePath('/tmp/not-allowed/rollback-x.json', false, [scratch]); }, /outside/, 'outside');
        throwsLike(function () { m.assertRollbackFilePath(path.join(scratch, 'plan-demo.json'), false, [scratch]); }, /not a rollback/, 'name');
    });
    unit('--shred-rollback securely deletes a rollback file', function () {
        fs.mkdirSync(scratch, { recursive: true, mode: 0o700 });
        const f = path.join(scratch, 'rollback-unit-shred.json');
        fs.writeFileSync(f, JSON.stringify({ oldToken: T.alice }), { mode: 0o600 });
        const name = m.shredRollbackFile(f, [scratch]);
        if (name !== 'rollback-unit-shred.json') throw new Error('unexpected name');
        if (fs.existsSync(f)) throw new Error('file still exists after shred');
    });
    unit('A6: rollback file is written once (O_EXCL) with mode 600', function () {
        fs.mkdirSync(scratch, { recursive: true, mode: 0o700 });
        const f = path.join(scratch, 'rollback-unit-once.json');
        m.writeOnceFsync(f, '{}\n');
        if ((fs.statSync(f).mode & 0o777) !== 0o600) throw new Error('mode');
        throwsLike(function () { m.writeOnceFsync(f, '{"x":1}\n'); }, /EEXIST/, 'second write');
        if (fs.readFileSync(f, 'utf8') !== '{}\n') throw new Error('file was rewritten');
        m.shredRollbackFile(f, [scratch]);
    });
    unit('A6: shred-after date is 7 days out', function () {
        const s = m.shredAfterDate('2026-11-15T05:00:00.000Z');
        if (s.dayEt !== '2026-11-22') throw new Error('got ' + s.dayEt);
    });
    unit('R13: --plan-sha must match exactly (no case folding or trimming)', function () {
        const bytes = Buffer.from('plan\n');
        const sha = m.sha256Hex(bytes);
        if (m.checkPlanSha(bytes, sha) !== sha) throw new Error('exact sha refused');
        throwsLike(function () { m.checkPlanSha(bytes, sha.toUpperCase()); }, /invalid --plan-sha/, 'upper');
        throwsLike(function () { m.checkPlanSha(bytes, ' ' + sha); }, /invalid --plan-sha/, 'space');
        throwsLike(function () { m.checkPlanSha(bytes, sha.slice(0, 12)); }, /invalid --plan-sha/, 'short');
        throwsLike(function () { m.checkPlanSha(bytes, 'a'.repeat(64)); }, /mismatch/, 'wrong');
    });
    unit('R14: ensureDir never chmods an existing dir', function () {
        const d = path.join(scratch, 'r14-existing');
        fs.mkdirSync(d, { recursive: true });
        fs.chmodSync(d, 0o755);
        m.ensureDir(d);
        if ((fs.statSync(d).mode & 0o777) !== 0o755) throw new Error('existing dir was chmodded');
        fs.rmdirSync(d);
    });
    unit('A4: plan hashes the full token list', function () {
        const two = m.tokenListSha([T.multi1, T.multi2]);
        if (two === m.tokenListSha([T.multi1])) throw new Error('second token ignored');
        if (two !== m.sha256Hex(T.multi1 + ',' + T.multi2)) throw new Error('list hash shape');
    });
    unit('live apply without RESET_CONFIRM is refused before any client init', function () {
        const plan = path.join(scratch, 'plan-refuse.json');
        fs.mkdirSync(scratch, { recursive: true, mode: 0o700 });
        fs.writeFileSync(plan, '{}\n', { mode: 0o600 });
        const r = spawnSync('node', [script,
            '--project', 'bitcoin-education-archive',
            '--plan', plan,
            '--apply',
            '--plan-sha', 'a'.repeat(64),
        ], { cwd: root, encoding: 'utf8', env: noCredsLiveEnv(), timeout: 15000 });
        const out = (r.stdout || '') + (r.stderr || '');
        assertNoSecrets(out, 'refuse-apply output');
        if (r.status === 0) throw new Error('live apply was not refused');
        if (!/RESET_CONFIRM=dm-photo-tokens/.test(out)) throw new Error('missing confirm error');
        fs.unlinkSync(plan);
    });
    unit('A3/R4: live run with only STORAGE_EMULATOR_HOST set is refused before any client init', function () {
        const r = spawnSync('node', [script, '--project', 'bitcoin-education-archive'], {
            cwd: root, encoding: 'utf8', timeout: 15000,
            env: noCredsLiveEnv({ STORAGE_EMULATOR_HOST: 'http://127.0.0.1:9' }),
        });
        const out = (r.stdout || '') + (r.stderr || '');
        if (r.status === 0) throw new Error('split env was not refused');
        if (!/split environment/.test(out)) throw new Error('missing split-env error');
        if (/mode dry-run/.test(out)) throw new Error('ran a dry run');
    });
}

(async function main() {
    delete process.env.FIREBASE_SA_JSON;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.RESET_CONFIRM;
    fs.rmSync(scratch, { recursive: true, force: true });
    fs.mkdirSync(scratch, { recursive: true, mode: 0o700 });

    if (!admin.apps.length) {
        admin.initializeApp({ projectId: PROJECT, storageBucket: STORAGE_BUCKET });
    }
    const db = admin.firestore();
    const bucket = admin.storage().bucket(STORAGE_BUCKET);
    const ids = await seed(db, bucket);
    const ab = id(A, B);

    await expect('seeded photos are reachable with their old tokens (both tokens of the 2-token object)', async function () {
        for (const [p, t] of [[PATHS.alice, T.alice], [PATHS.multi, T.multi1], [PATHS.multi, T.multi2], [PATHS.paren, T.paren], [PATHS.dave, T.dave]]) {
            const st = await httpStatus(emuUrl(p, t));
            if (st !== 200) throw new Error('expected 200 before apply, got ' + st);
        }
    });

    const dry = runScript(defaultArgs().concat(['--dry-run']));
    await expect('dry-run exits 0 and writes a plan', async function () {
        if (dry.status !== 0) throw new Error('dry-run failed: ' + scriptMod.redactSecrets((dry.stderr || '').trim()));
        if (!/^mode dry-run$/m.test(dry.stdout)) throw new Error('missing dry-run mode');
        if (rollbackFiles().length) throw new Error('dry run created a rollback file');
    });

    let plan, planSha;
    await expect('plan has hashes only, mode 600, bucket recorded, and the right counts', async function () {
        const mode = fs.statSync(planPath).mode & 0o777;
        if (mode !== 0o600) throw new Error('plan mode is ' + mode.toString(8));
        const bytes = fs.readFileSync(planPath);
        assertNoSecrets(bytes.toString('utf8'), 'plan file');
        assertNoRawIds(bytes.toString('utf8'), 'plan file');
        plan = JSON.parse(bytes.toString('utf8'));
        planSha = scriptMod.sha256Hex(bytes);
        const want = {
            storageObjects: 12, plannedObjects: 11, plannedMessages: 9, plannedConvoFields: 1,
            orphanObjects: 3, skippedConversations: 2, lockedObjects: 2, lockedFields: 2,
            tokenlessObjects: 1, unmatchedMessages: 0, f3Failures: 0,
        };
        Object.keys(want).forEach(function (k) {
            if (plan.counts[k] !== want[k]) throw new Error(k + ' expected ' + want[k] + ', got ' + plan.counts[k]);
        });
        if (plan.storageBucket !== STORAGE_BUCKET) throw new Error('plan storageBucket not recorded');
        if (plan.version !== 2) throw new Error('plan version');
        const reasons = (plan.skippedConversations || []).map(function (s) { return s.reason; }).sort();
        if (reasons.join(',') !== 'id_not_sorted_pair,participant_count') throw new Error('unexpected skip reasons ' + reasons.join(','));
        if (!/^f3-failures 0$/m.test(dry.stdout) || !/^locked-objects 2$/m.test(dry.stdout)) throw new Error('summary lines');
    });

    await expect('A4: plan records the full 2-token list for one object', async function () {
        const item = plan.items.find(function (it) { return it.objectPathSha256 === scriptMod.sha256Hex(PATHS.multi); });
        if (!item || item.oldTokenCount !== 2) throw new Error('2-token object not recorded with 2 tokens');
        if (item.oldTokensSha256 !== scriptMod.sha256Hex(T.multi1 + ',' + T.multi2)) throw new Error('hash is not over the full list');
        if (item.messageCount !== 2) throw new Error('both messages not planned');
    });

    await expect('A1: objects used by malformed convos are planned (locked) with the well-formed message too', async function () {
        const dave = plan.items.find(function (it) { return it.objectPathSha256 === scriptMod.sha256Hex(PATHS.dave); });
        const mallory = plan.items.find(function (it) { return it.objectPathSha256 === scriptMod.sha256Hex(PATHS.mallory); });
        if (!dave || dave.lockedFieldCount !== 1 || dave.messageCount !== 1) throw new Error('dave not planned with locked + well-formed fields');
        if (!mallory || mallory.lockedFieldCount !== 1 || mallory.messageCount !== 0) throw new Error('mallory not planned as locked');
    });

    await expect('R12: tokenless object is listed, not planned', async function () {
        if (plan.items.some(function (it) { return it.objectPathSha256 === scriptMod.sha256Hex(PATHS.tokenless); })) throw new Error('tokenless object planned');
        if (plan.tokenlessObjects.length !== 1) throw new Error('tokenless not listed');
    });

    await expect('A2: dry run flags F3 failures, and apply of that plan writes nothing', async function () {
        const badPlan = path.join(scratch, 'plan-f3fail.json');
        const args = defaultArgs({ plan: badPlan, canonical: 'other-bucket.firebasestorage.app' });
        const d = runScript(args.concat(['--dry-run']));
        if (d.status !== 0) throw new Error('f3 dry run failed');
        if (!/^f3-failures 11$/m.test(d.stdout)) throw new Error('dry run did not count F3 failures');
        const sha = scriptMod.sha256Hex(fs.readFileSync(badPlan));
        const r = runScript(args.concat(['--apply', '--plan-sha', sha]));
        if (r.status === 0 || !/F3 failures; nothing was written/.test(r.stderr)) throw new Error('apply of an F3-failing plan was not refused');
        // Tampered plan claiming 0 failures: apply re-checks every item before the first write.
        const sha2 = rehashPlan(badPlan, function (p) { p.counts.f3Failures = 0; p.f3FailedObjects = []; p.items.forEach(function (it) { it.f3Ok = true; }); });
        const r2 = runScript(args.concat(['--apply', '--plan-sha', sha2]));
        if (r2.status === 0 || !/would fail F3; nothing was written/.test(r2.stderr)) throw new Error('pre-validation did not stop apply');
        if (rollbackFiles().length) throw new Error('a rollback file was written');
        for (const [p, t] of [[PATHS.alice, T.alice], [PATHS.paren, T.paren], [PATHS.orphan, T.orphan]]) {
            if (await httpStatus(emuUrl(p, t)) !== 200) throw new Error('an object was rotated by a refused apply');
        }
        if (await msgUrl(db, ab, ids.aliceMsg) !== canonUrl(PATHS.alice, T.alice)) throw new Error('a message was rewritten');
        fs.unlinkSync(badPlan);
    });

    await expect('wrong or non-exact plan-sha refuses and writes nothing (R13)', async function () {
        for (const s of ['b'.repeat(64), planSha.toUpperCase()]) {
            const r = runScript(defaultArgs().concat(['--apply', '--plan-sha', s]));
            if (r.status === 0) throw new Error('bad sha was accepted');
            if (!/plan sha mismatch|invalid --plan-sha/.test(r.stderr)) throw new Error('missing sha error');
        }
        if (await httpStatus(emuUrl(PATHS.alice, T.alice)) !== 200) throw new Error('object was mutated after a refused apply');
        if (rollbackFiles().length) throw new Error('rollback written by a refused apply');
    });

    await expect('A3: apply refuses a plan whose storage bucket differs', async function () {
        const other = path.join(scratch, 'plan-bucket.json');
        fs.copyFileSync(planPath, other);
        const sha = rehashPlan(other, function (p) { p.storageBucket = 'demo-f2reset.firebasestorage.app'; });
        const r = runScript(defaultArgs({ plan: other }).concat(['--apply', '--plan-sha', sha]));
        if (r.status === 0 || !/plan storage bucket does not match/.test(r.stderr)) throw new Error('bucket mismatch not refused');
        if (rollbackFiles().length) throw new Error('rollback written');
        fs.unlinkSync(other);
    });

    await expect('A6: --rollback-dir outside the emulator scratch dir is refused', async function () {
        const args = defaultArgs();
        args[args.indexOf('--rollback-dir') + 1] = OUTSIDE_DIR;
        const r = runScript(args.concat(['--apply', '--plan-sha', planSha]));
        if (r.status === 0 || !/emulator rollback dir outside/.test(r.stderr)) throw new Error('outside rollback dir accepted');
        if (fs.existsSync(OUTSIDE_DIR)) throw new Error('outside dir was created');
    });

    // R13 drift: a message added after the dry run that points at a planned object.
    ids.driftMsg = await addMsg(db, id(L, Q), L, canonUrl(PATHS.ln, T.ln));

    // A5: crash right after the first field of the 2-message object is rewritten.
    const crashed = runScript(defaultArgs().concat(['--apply', '--plan-sha', planSha]), {
        F2RESET_TEST_CRASH_OBJECT_SHA: scriptMod.sha256Hex(PATHS.multi).slice(0, 16),
    });
    let rollbackPath = '';
    let rollbackStat = null;
    let rb = null;
    await expect('A5/P4: a crash mid-object leaves a pinned rollback and a half-rewritten object', async function () {
        if (crashed.status !== 70) throw new Error('expected the test crash exit, got ' + crashed.status);
        const files = rollbackFiles();
        if (files.length !== 1) throw new Error('expected exactly one rollback file, got ' + files.length);
        rollbackPath = path.join(rollbackDir, files[0]);
        if (files[0] !== 'rollback-' + PROJECT + '-' + planSha.slice(0, 16) + '.json') throw new Error('rollback name not bound to the plan sha');
        rollbackStat = fs.statSync(rollbackPath);
        if ((rollbackStat.mode & 0o777) !== 0o600) throw new Error('rollback mode');
        if (!fs.existsSync(path.join(rollbackDir, 'CACHEDIR.TAG'))) throw new Error('missing backup-exclusion tag');
        if (fs.readdirSync(rollbackDir).some(function (f) { return /tmp/.test(f); })) throw new Error('temp files left');
        rb = JSON.parse(fs.readFileSync(rollbackPath, 'utf8'));
        const multi = rb.items.find(function (it) { return it.objectPath === PATHS.multi; });
        if (!multi || multi.oldTokens.join(',') !== T.multi1 + ',' + T.multi2) throw new Error('rollback does not hold the full token list');
        const cur = await tokensOf(bucket, PATHS.multi);
        if (cur.length !== 1 || cur[0] !== multi.newToken) throw new Error('object was not rotated before the crash');
        const u1 = await msgUrl(db, ab, ids.multiMsg1);
        const u2 = await msgUrl(db, ab, ids.multiMsg2);
        const fresh = [u1, u2].filter(function (u) { return u.indexOf(multi.newToken) !== -1; }).length;
        if (fresh !== 1) throw new Error('expected exactly one of two fields rewritten, got ' + fresh);
    });

    // deleteAccount-style removals between the crash and the re-run.
    await bucket.file(PATHS.gone).delete();
    await db.collection('dm_conversations').doc(id(N, P)).collection('messages').doc(ids.nostrGoneMsg).delete();

    const resumed = runScript(defaultArgs().concat(['--apply', '--plan-sha', planSha]));
    await expect('A5: re-running the same apply resumes and finishes (no "refusing to guess")', async function () {
        if (resumed.status !== 0) throw new Error('resume failed: ' + scriptMod.redactSecrets((resumed.stderr || '').trim()));
        if (!/^mode apply-resume$/m.test(resumed.stdout)) throw new Error('not a resume');
        const multi = rb.items.find(function (it) { return it.objectPath === PATHS.multi; });
        if ((await msgUrl(db, ab, ids.multiMsg1)).indexOf(multi.newToken) === -1) throw new Error('multi msg 1 not finished');
        if ((await msgUrl(db, ab, ids.multiMsg2)).indexOf(multi.newToken) === -1) throw new Error('multi msg 2 not finished');
        const num = function (k) { const m = resumed.stdout.match(new RegExp('^' + k + ' (\\d+)$', 'm')); return m ? Number(m[1]) : -1; };
        if (num('rotated') + num('already-rotated') !== 10) throw new Error('rotated + already-rotated != 10');
        if (num('token-conflicts') !== 0) throw new Error('unexpected conflicts');
    });

    await expect('A5: a vanished object and a vanished message are skipped and counted, not aborted', async function () {
        if (!/^vanished-objects 1$/m.test(resumed.stdout)) throw new Error('vanished object not counted');
        if (!/^vanished-fields 1$/m.test(resumed.stdout)) throw new Error('vanished field not counted');
        if ((await msgUrl(db, id(N, P), ids.nostrMsg)).indexOf('token=' + T.nostr) !== -1) throw new Error('surviving nostr message not rewritten');
    });

    await expect('R13: a message added after the dry run is counted as drift and not rewritten', async function () {
        if (!/^drift-fields 1$/m.test(resumed.stdout)) throw new Error('drift not counted');
        if (await msgUrl(db, id(L, Q), ids.driftMsg) !== canonUrl(PATHS.ln, T.ln)) throw new Error('drift message was rewritten');
    });

    await expect('A6: rollback file was written once (same inode and mtime after resume) and shred-after is printed', async function () {
        const st = fs.statSync(rollbackPath);
        if (st.ino !== rollbackStat.ino || st.mtimeMs !== rollbackStat.mtimeMs || st.size !== rollbackStat.size) throw new Error('rollback file was rewritten');
        const m = resumed.stdout.match(/^shred-after (\d{4}-\d{2}-\d{2}) ET$/m);
        if (!m) throw new Error('missing shred-after line');
        if (m[1] !== scriptMod.shredAfterDate(rb.createdAt).dayEt) throw new Error('shred-after date');
        const days = (new Date(rb.shredAfter) - new Date(rb.createdAt)) / 86400000;
        if (days !== 7) throw new Error('shred window is ' + days + ' days');
        const lines = resumed.stdout.match(/^rollback (.+)$/m);
        if (!lines || lines[1].trim() !== rollbackPath) throw new Error('rollback path not reported');
    });

    await expect('audit log has no tokens and no raw uids', async function () {
        const text = fs.readFileSync(auditPath, 'utf8');
        assertNoSecrets(text, 'audit log');
        assertNoRawIds(text, 'audit log');
    });

    await expect('old alice URL is rejected and the new URL works', async function () {
        const oldStatus = await httpStatus(emuUrl(PATHS.alice, T.alice));
        if (oldStatus !== 403 && oldStatus !== 404) throw new Error('old token status ' + oldStatus);
        const item = rb.items.find(function (it) { return it.objectPath === PATHS.alice; });
        if (await httpStatus(emuUrl(PATHS.alice, item.newToken)) !== 200) throw new Error('new token failed');
        const url = await msgUrl(db, ab, ids.aliceMsg);
        if (!scriptMod.isF3CanonicalUrl(url, A, CANONICAL_BUCKET)) throw new Error('rewritten message fails F3');
        if (url.indexOf(item.newToken) === -1) throw new Error('message was not rewritten to the new token');
        const convo = await db.collection('dm_conversations').doc(ab).get();
        if (convo.data().lastMessage !== '📷 Image') throw new Error('lastMessage preview was changed');
        if (convo.data().imageUrl.indexOf(item.newToken) === -1) throw new Error('convo imageUrl was not rewritten');
    });

    await expect('nostr and lightning URLs keep %3A and pass F3', async function () {
        const nUrl = await msgUrl(db, id(N, P), ids.nostrMsg);
        const lUrl = await msgUrl(db, id(L, Q), ids.lnMsg);
        if (nUrl.indexOf('dm-images%2Fnostr%3Anpub1f2test%2F') === -1) throw new Error('nostr path encoding missing');
        if (lUrl.indexOf('dm-images%2Fln%3Af2tester%2F') === -1) throw new Error('ln path encoding missing');
        if (!scriptMod.isF3CanonicalUrl(nUrl, N, CANONICAL_BUCKET) || !scriptMod.isF3CanonicalUrl(lUrl, L, CANONICAL_BUCKET)) throw new Error('F3');
        if (await httpStatus(emuUrl(PATHS.nostr, T.nostr)) === 200 || await httpStatus(emuUrl(PATHS.ln, T.ln)) === 200) throw new Error('old nostr/ln token still works');
    });

    await expect('A1/P6: malformed-convo objects are rotated; their old links die; the well-formed message is rewritten', async function () {
        if (await httpStatus(emuUrl(PATHS.dave, T.dave)) === 200) throw new Error('P6: dave old link still 200');
        if (await httpStatus(emuUrl(PATHS.mallory, T.mallory)) === 200) throw new Error('P6: mallory old link still 200');
        const dave = rb.items.find(function (it) { return it.objectPath === PATHS.dave; });
        const wellUrl = await msgUrl(db, id(C, D), ids.daveWellMsg);
        if (wellUrl.indexOf(dave.newToken) === -1) throw new Error('well-formed dave message not rewritten');
        if (await httpStatus(emuUrl(PATHS.dave, dave.newToken)) !== 200) throw new Error('dave new token failed');
        // Malformed docs are never written: they keep the old, now dead, URL.
        if (await msgUrl(db, D + '_' + C, ids.daveMsg) !== canonUrl(PATHS.dave, T.dave)) throw new Error('malformed dave doc was written');
        if (await msgUrl(db, 'three-people', ids.malloryMsg) !== canonUrl(PATHS.mallory, T.mallory)) throw new Error('malformed mallory doc was written');
        if (dave.fields.some(function (f) { return f.docPath.indexOf(D + '_' + C) !== -1; })) throw new Error('malformed doc in the journal');
    });

    await expect('A2/P12: the "(" file name is rotated, rewritten with %28/%29, and passes F3', async function () {
        const it = rb.items.find(function (x) { return x.objectPath === PATHS.paren; });
        const url = await msgUrl(db, ab, ids.parenMsg);
        if (url.indexOf('%281%29') === -1 || url.indexOf(it.newToken) === -1) throw new Error('paren message not rewritten');
        if (!scriptMod.isF3CanonicalUrl(url, A, CANONICAL_BUCKET)) throw new Error('paren URL fails F3');
        if (await httpStatus(emuUrl(PATHS.paren, T.paren)) === 200) throw new Error('old paren token still works');
        const viaRewritten = url.replace('https://firebasestorage.googleapis.com/v0/b/' + CANONICAL_BUCKET, 'http://127.0.0.1:9195/v0/b/' + STORAGE_BUCKET);
        if (await httpStatus(viaRewritten) !== 200) throw new Error('the rewritten %28 URL does not resolve');
    });

    await expect('A4/P3: both tokens of the 2-token object are revoked and both messages use the new token', async function () {
        if (await httpStatus(emuUrl(PATHS.multi, T.multi1)) === 200) throw new Error('token 1 still works');
        if (await httpStatus(emuUrl(PATHS.multi, T.multi2)) === 200) throw new Error('token 2 still works');
    });

    await expect('R11: cacheControl and contentDisposition survive rotation', async function () {
        const [meta] = await bucket.file(PATHS.cached).getMetadata();
        if (meta.cacheControl !== 'private, max-age=300') throw new Error('cacheControl lost');
        if (meta.contentDisposition !== 'inline') throw new Error('contentDisposition lost');
        if (meta.contentType !== 'image/jpeg') throw new Error('contentType lost');
        if (await httpStatus(emuUrl(PATHS.cached, T.cached)) === 200) throw new Error('old cached token still works');
    });

    await expect('R12: no token is minted for a tokenless object', async function () {
        if ((await tokensOf(bucket, PATHS.tokenless)).length !== 0) throw new Error('a token was minted');
    });

    await expect('orphan was rotated and the GIF message was left alone', async function () {
        if (await httpStatus(emuUrl(PATHS.orphan, T.orphan)) === 200) throw new Error('orphan old token still works');
        if (await msgUrl(db, ab, ids.gifMsg) !== 'https://media1.giphy.com/media/abc123/giphy.gif') throw new Error('GIF message was touched');
    });

    await expect('rewritten messages (incl. the %28 one) pass #334 rules and strangers are refused', async function () {
        const fsRules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
        const stRules = fs.readFileSync(path.join(root, 'storage.rules'), 'utf8');
        const [fh, fp] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
        const [sh, sp] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':');
        const env = await initializeTestEnvironment({
            projectId: PROJECT,
            firestore: { rules: fsRules, host: fh, port: Number(fp) },
            storage: { rules: stRules, host: sh, port: Number(sp) },
        });
        try {
            const alice = env.authenticatedContext(A, pw).firestore();
            const bob = env.authenticatedContext(B, pw).firestore();
            const mallory = env.authenticatedContext(M, pw).firestore();
            await assertSucceeds(getDoc(doc(alice, 'dm_conversations', ab, 'messages', ids.aliceMsg)));
            await assertSucceeds(getDoc(doc(bob, 'dm_conversations', ab, 'messages', ids.aliceMsg)));
            await assertFails(getDoc(doc(mallory, 'dm_conversations', ab, 'messages', ids.aliceMsg)));
            for (const mid of [ids.aliceMsg, ids.parenMsg]) {
                await assertSucceeds(addDoc(collection(alice, 'dm_conversations', ab, 'messages'), {
                    senderUid: A, senderName: 'Alice', text: '', imageUrl: await msgUrl(db, ab, mid), createdAt: serverTimestamp(),
                }));
            }
            const nostrUser = env.authenticatedContext(N, pw).firestore();
            await assertSucceeds(addDoc(collection(nostrUser, 'dm_conversations', id(N, P), 'messages'), {
                senderUid: N, senderName: 'Nostr', text: '', imageUrl: await msgUrl(db, id(N, P), ids.nostrMsg), createdAt: serverTimestamp(),
            }));
        } finally {
            await env.cleanup();
        }
    });

    await expect('re-running apply changes nothing', async function () {
        const before = await msgUrl(db, ab, ids.aliceMsg);
        const r = runScript(defaultArgs().concat(['--apply', '--plan-sha', planSha]));
        if (r.status !== 0) throw new Error('second apply failed');
        if (!/^rotated 0$/m.test(r.stdout) || !/^rewritten 0$/m.test(r.stdout)) throw new Error('second apply was not a no-op');
        if (await msgUrl(db, ab, ids.aliceMsg) !== before) throw new Error('second apply rewrote a message');
        const st = fs.statSync(rollbackPath);
        if (st.ino !== rollbackStat.ino || st.mtimeMs !== rollbackStat.mtimeMs) throw new Error('rollback file rewritten');
    });

    await expect('A6/R14: a --plan under an existing dir does not chmod it; rollback still lands in the rollback dir', async function () {
        const parent = path.join(scratch, 'r14');
        fs.mkdirSync(parent, { recursive: true });
        fs.chmodSync(parent, 0o755);
        const p2 = path.join(parent, 'plan-elsewhere.json');
        const d = runScript(defaultArgs({ plan: p2 }).concat(['--dry-run']));
        if (d.status !== 0) throw new Error('dry run failed');
        if ((fs.statSync(parent).mode & 0o777) !== 0o755) throw new Error('parent dir was chmodded');
        if (fs.readdirSync(parent).some(function (f) { return /^rollback-/.test(f); })) throw new Error('rollback beside the plan');
        fs.rmSync(parent, { recursive: true, force: true });
    });

    // R15: someone else changes one object's token after apply.
    const cachedItem = rb.items.find(function (it) { return it.objectPath === PATHS.cached; });
    await putPhoto(bucket, PATHS.cached, T.intruder, { cacheControl: 'private, max-age=300', contentDisposition: 'inline' });
    // P8: a planned message is deleted before rollback.
    await db.collection('dm_conversations').doc(ab).collection('messages').doc(ids.scopedMsg).delete();

    await expect('A6: --rollback refuses a file outside the rollback dir', async function () {
        fs.mkdirSync(OUTSIDE_DIR, { recursive: true, mode: 0o700 });
        const outside = path.join(OUTSIDE_DIR, 'rollback-outside.json');
        fs.writeFileSync(outside, JSON.stringify({ version: 2, project: PROJECT, items: [] }), { mode: 0o600 });
        const r = runScript(['--rollback', outside]);
        fs.rmSync(OUTSIDE_DIR, { recursive: true, force: true });
        if (r.status === 0 || !/outside/.test(r.stderr)) throw new Error('outside rollback file was read');
    });

    const rolled = runScript(['--rollback', rollbackPath, '--audit', auditPath]);
    await expect('R15: rollback skips an object whose token changed since apply', async function () {
        if (rolled.status !== 3) throw new Error('expected exit 3 with a conflict, got ' + rolled.status + ' ' + scriptMod.redactSecrets(rolled.stderr || ''));
        if (!/^token-conflicts 1$/m.test(rolled.stdout)) throw new Error('conflict not counted');
        const cur = await tokensOf(bucket, PATHS.cached);
        if (cur.length !== 1 || cur[0] !== T.intruder) throw new Error('rollback overwrote a token it did not set');
        if (cur[0] === cachedItem.newToken) throw new Error('setup');
    });

    await expect('A5/P8: rollback skips a deleted message and prints no raw path', async function () {
        // 2 = this message plus the nostr message deleted before the resume.
        if (!/^vanished-fields 2$/m.test(rolled.stdout) || !/^vanished-objects 1$/m.test(rolled.stdout)) throw new Error('deleted message not counted: ' + rolled.stdout.split('\n').filter(function (l) { return /^(vanished|restored|already|token|changed)/.test(l); }).join(' | '));
        // runScript already asserted no raw uids/convo ids in the output.
    });

    await expect('rollback restores the old tokens and message URLs', async function () {
        if (await httpStatus(emuUrl(PATHS.alice, T.alice)) !== 200) throw new Error('old token not restored');
        if (await msgUrl(db, ab, ids.aliceMsg) !== canonUrl(PATHS.alice, T.alice)) throw new Error('message URL not restored');
        const item = rb.items.find(function (it) { return it.objectPath === PATHS.alice; });
        if (await httpStatus(emuUrl(PATHS.alice, item.newToken)) === 200) throw new Error('new token still works after rollback');
        if (await msgUrl(db, ab, ids.parenMsg) !== clientUrl(PATHS.paren, T.paren)) throw new Error('paren URL not restored verbatim');
        if (await httpStatus(emuUrl(PATHS.dave, T.dave)) !== 200) throw new Error('locked object not restored');
    });

    await expect('A4/P7: rollback restores the full 2-token list; both messages work again', async function () {
        const cur = await tokensOf(bucket, PATHS.multi);
        if (cur.join(',') !== T.multi1 + ',' + T.multi2) throw new Error('token list not restored verbatim (' + cur.length + ' tokens)');
        if (await httpStatus(emuUrl(PATHS.multi, T.multi1)) !== 200) throw new Error('P7: token 1 not 200');
        if (await httpStatus(emuUrl(PATHS.multi, T.multi2)) !== 200) throw new Error('P7: token 2 not 200');
        if (await msgUrl(db, ab, ids.multiMsg1) !== canonUrl(PATHS.multi, T.multi1)) throw new Error('msg 1 not restored');
        if (await msgUrl(db, ab, ids.multiMsg2) !== canonUrl(PATHS.multi, T.multi2)) throw new Error('msg 2 not restored');
    });

    await expect('--shred-rollback removes the rollback file', async function () {
        const r = runScript(['--shred-rollback', rollbackPath]);
        if (r.status !== 0) throw new Error('shred failed: ' + scriptMod.redactSecrets((r.stderr || '').trim()));
        if (!/mode shred-rollback/.test(r.stdout)) throw new Error('missing shred mode');
        if (fs.existsSync(rollbackPath)) throw new Error('rollback file still exists after shred');
    });

    fs.rmSync(scratch, { recursive: true, force: true });
    if (failed) {
        console.log('RESULT  ' + passed + ' passed, ' + failed + ' failed');
        process.exit(1);
    }
    console.log('RESULT  ' + passed + '/' + (passed + failed) + ' passed');
    process.exit(0);
})().catch(function (err) {
    const msg = err && err.message ? String(err.message) : String(err);
    console.error('FAIL  suite  ' + scriptMod.redactSecrets(msg));
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    process.exit(1);
});
