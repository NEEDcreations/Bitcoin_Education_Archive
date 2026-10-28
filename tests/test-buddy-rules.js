#!/usr/bin/env node
// Firestore rules for buddy_pool and buddy_matches.
// Skips with exit 0 when the rules emulator tooling is not installed.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const rulesDir = path.join(__dirname, 'rules');
const rulesModules = path.join(rulesDir, 'node_modules');

function skip() {
    console.log('skipped (no emulator)');
    process.exit(0);
}

function hasModule(name) {
    try {
        require.resolve(name, { paths: [rulesDir] });
        return true;
    } catch (e) {
        return false;
    }
}

function firebaseCli() {
    const candidates = [];
    if (process.env.FIREBASE_BIN) candidates.push(process.env.FIREBASE_BIN);
    candidates.push(path.join(rulesModules, '.bin', 'firebase'));
    for (let i = 0; i < candidates.length; i++) {
        if (candidates[i] && fs.existsSync(candidates[i])) return candidates[i];
    }
    const found = spawnSync('sh', ['-c', 'command -v firebase'], { encoding: 'utf8' });
    const bin = (found.stdout || '').trim();
    if (found.status === 0 && bin && fs.existsSync(bin)) return bin;
    return '';
}

if (!hasModule('@firebase/rules-unit-testing') || !hasModule('firebase/firestore')) skip();

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const firebase = firebaseCli();
    const env = Object.assign({}, process.env, { CI: 'true' });
    env.NODE_PATH = env.NODE_PATH ? rulesModules + path.delimiter + env.NODE_PATH : rulesModules;
    const portScript = "const net=require('net');function tryPort(p){if(p>8099){console.log('8085');process.exit(0)}const s=net.createServer();s.once('error',function(){tryPort(p+1)});s.listen(p,'127.0.0.1',function(){s.close(function(){console.log(String(p));process.exit(0)})})}tryPort(8085);";
    const portOut = spawnSync(process.execPath, ['-e', portScript], { encoding: 'utf8' });
    const port = parseInt(String(portOut.stdout || '').trim(), 10) || 8085;
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
    cfg.emulators = cfg.emulators || {};
    cfg.emulators.firestore = Object.assign({}, cfg.emulators.firestore, { host: '127.0.0.1', port: port });
    cfg.firestore = Object.assign({}, cfg.firestore, { rules: path.join(root, 'firestore.rules') });
    const cfgPath = path.join('/tmp', 'firebase-buddy-' + port + '.json');
    fs.writeFileSync(cfgPath, JSON.stringify(cfg));
    const args = [
        'emulators:exec',
        '--config', cfgPath,
        '--only', 'firestore',
        '--project', 'demo-buddy-rules',
        'node tests/test-buddy-rules.js',
    ];
    const result = firebase
        ? spawnSync(firebase, args, { cwd: root, stdio: 'inherit', env: env })
        : spawnSync('npx', ['--yes', 'firebase-tools'].concat(args), { cwd: root, stdio: 'inherit', env: env });
    process.exit(result.status == null ? 1 : result.status);
}

module.paths.unshift(rulesModules);

const {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
    doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs,
} = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
let failed = 0;
let passed = 0;

function check(name, fn) {
    return Promise.resolve().then(fn).then(function () {
        passed++;
        console.log('  ok  ' + name);
    }, function (err) {
        failed++;
        console.log('  FAIL ' + name + ': ' + (err && err.message ? err.message : err));
    });
}

function authed(env, uid) {
    return env.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } }).firestore();
}

async function seed(env) {
    await env.withSecurityRulesDisabled(async function (ctx) {
        const db = ctx.firestore();
        await setDoc(doc(db, 'buddy_pool', 'alice'), {
            uid: 'alice',
            username: 'Alice',
            level: 'beginner',
            goal: 'learn',
            intro: 'hello',
            joinedAtMs: Date.now(),
        });
        await setDoc(doc(db, 'buddy_pool', 'bob'), {
            uid: 'bob',
            username: 'Bob',
            level: 'intermediate',
            goal: 'teach',
            intro: 'hi',
            joinedAtMs: Date.now(),
        });
        await setDoc(doc(db, 'buddy_matches', 'alice_bob'), {
            user1: { uid: 'alice', username: 'Alice', level: 'beginner', goal: 'learn', intro: '' },
            user2: { uid: 'bob', username: 'Bob', level: 'intermediate', goal: 'teach', intro: '' },
            participants: ['alice', 'bob'],
            matchedAtMs: Date.now(),
        });
    });
}

async function main() {
    const env = await initializeTestEnvironment({
        projectId: 'demo-buddy-rules',
        firestore: { rules: rules },
    });
    await seed(env);
    const alice = authed(env, 'alice');
    const bob = authed(env, 'bob');
    const cara = authed(env, 'cara');
    const anon = env.unauthenticatedContext().firestore();

    await check('owner can read only their pool doc', function () {
        return assertSucceeds(getDoc(doc(alice, 'buddy_pool', 'alice')));
    });
    await check('owner cannot read another pool doc', function () {
        return assertFails(getDoc(doc(alice, 'buddy_pool', 'bob')));
    });
    await check('listing the buddy pool is denied', function () {
        return assertFails(getDocs(collection(alice, 'buddy_pool')));
    });
    await check('a client cannot create a pool entry', function () {
        return assertFails(setDoc(doc(alice, 'buddy_pool', 'alice'), {
            uid: 'alice',
            username: '<b>Alice</b>',
            level: 'beginner',
            goal: 'learn',
        }));
    });
    await check('a client cannot update a pool entry', function () {
        return assertFails(updateDoc(doc(alice, 'buddy_pool', 'alice'), { intro: '<img src=x>' }));
    });
    await check('owner can delete their pool doc', async function () {
        await assertSucceeds(deleteDoc(doc(bob, 'buddy_pool', 'bob')));
    });
    await check('owner cannot delete a partner pool doc', function () {
        return assertFails(deleteDoc(doc(alice, 'buddy_pool', 'cara')));
    });
    await check('a stranger cannot delete a pool doc', function () {
        return assertFails(deleteDoc(doc(cara, 'buddy_pool', 'alice')));
    });
    await check('a participant can read the match', function () {
        return assertSucceeds(getDoc(doc(alice, 'buddy_matches', 'alice_bob')));
    });
    await check('a stranger cannot read the match', function () {
        return assertFails(getDoc(doc(cara, 'buddy_matches', 'alice_bob')));
    });
    await check('a client cannot create a match', function () {
        return assertFails(setDoc(doc(alice, 'buddy_matches', 'alice_cara'), {
            user1: { uid: 'alice', username: '<img src=x onerror=alert(1)>', level: 'beginner', goal: 'learn', intro: '<b>x</b>' },
            user2: { uid: 'cara', username: 'Cara', level: 'advanced', goal: 'teach', intro: '' },
        }));
    });
    await check('a client cannot edit a match', function () {
        return assertFails(updateDoc(doc(alice, 'buddy_matches', 'alice_bob'), {
            'user2.username': '<script>alert(1)</script>',
        }));
    });
    await check('a stranger cannot delete a match', function () {
        return assertFails(deleteDoc(doc(cara, 'buddy_matches', 'alice_bob')));
    });
    await check('a participant can delete their match', function () {
        return assertSucceeds(deleteDoc(doc(alice, 'buddy_matches', 'alice_bob')));
    });
    await check('signed-out reads are denied', async function () {
        await assertFails(getDoc(doc(anon, 'buddy_pool', 'alice')));
        await assertFails(getDoc(doc(anon, 'buddy_matches', 'alice_bob')));
    });

    await env.cleanup();
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
