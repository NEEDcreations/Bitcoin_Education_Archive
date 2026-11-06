#!/usr/bin/env node
// Firestore rules proof for the PvP review.
// Modules come from tests/rules (cd tests/rules && npm ci). Without that
// install, or without the firebase CLI, this prints "skipped (no emulator)"
// and exits 0 so a plain checkout can still run tests/run-all.js.
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
    if (!firebase) skip();
    const env = Object.assign({}, process.env);
    env.NODE_PATH = env.NODE_PATH ? rulesModules + path.delimiter + env.NODE_PATH : rulesModules;
    const result = spawnSync(firebase, [
        'emulators:exec', '--only', 'firestore', '--project', 'demo-pvp-rules',
        'node tests/test-pvp-rules.js',
    ], { cwd: root, stdio: 'inherit', env: env });
    process.exit(result.status == null ? 1 : result.status);
}

module.paths.unshift(rulesModules);

const {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
    doc, setDoc, updateDoc, serverTimestamp, deleteDoc,
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

function authed(env, uid, provider) {
    return env.authenticatedContext(uid, { firebase: { sign_in_provider: provider } }).firestore();
}

function lobby(name, pic) {
    return {
        uid: 'alice',
        name: name || 'Alice',
        profilePic: pic || '',
        status: 'waiting',
        createdAt: serverTimestamp(),
        lastSeen: Date.now(),
    };
}

async function seedMatch(env, id, status, extra) {
    await env.withSecurityRulesDisabled(async function (ctx) {
        const data = Object.assign({
            player1: { uid: 'alice', name: 'Alice', profilePic: '', score: 1, correct: 1, answers: [] },
            player2: { uid: 'bob', name: 'Bob', profilePic: '', score: 0, correct: 0, answers: [] },
            status: status || 'active',
            currentQ: 0,
            questionWinner: 'player1',
            questionStartedAt: new Date(),
        }, extra || {});
        await setDoc(doc(ctx.firestore(), 'pvp_matches', id), data);
    });
}

async function main() {
    const env = await initializeTestEnvironment({
        projectId: 'demo-pvp-rules',
        firestore: { rules: rules },
    });
    const alice = authed(env, 'alice', 'google.com');
    const anon = authed(env, 'anon', 'anonymous');

    await check('anonymous lobby create is denied', function () {
        return assertFails(setDoc(doc(anon, 'pvp_lobby', 'anon'), Object.assign(lobby(), { uid: 'anon' })));
    });
    await check('lobby extra field is denied', function () {
        const data = lobby();
        data.note = 'x'.repeat(100);
        return assertFails(setDoc(doc(alice, 'pvp_lobby', 'alice'), data));
    });
    await check('lobby markdown name is denied', function () {
        return assertFails(setDoc(doc(alice, 'pvp_lobby', 'alice'), lobby('[Ada](https://evil)')));
    });
    await check('lobby foreign avatar host is denied', function () {
        return assertFails(setDoc(doc(alice, 'pvp_lobby', 'alice'), lobby('Alice', 'https://evil.example/a.png')));
    });
    await check('lobby allowlisted create succeeds', function () {
        return assertSucceeds(setDoc(doc(alice, 'pvp_lobby', 'alice'), lobby('Alice', 'https://assets.bitcoineducation.quest/a.png')));
    });
    await check('heartbeat sooner than 4s is denied', async function () {
        await env.withSecurityRulesDisabled(async function (ctx) {
            await setDoc(doc(ctx.firestore(), 'pvp_lobby', 'alice'), {
                uid: 'alice', name: 'Alice', profilePic: '', status: 'waiting',
                createdAt: new Date(), lastSeen: Date.now(),
            });
        });
        await assertFails(updateDoc(doc(alice, 'pvp_lobby', 'alice'), { lastSeen: Date.now() + 1000 }));
    });
    await check('heartbeat after 4s succeeds', async function () {
        await env.withSecurityRulesDisabled(async function (ctx) {
            await setDoc(doc(ctx.firestore(), 'pvp_lobby', 'alice'), {
                uid: 'alice', name: 'Alice', profilePic: '', status: 'waiting',
                createdAt: new Date(), lastSeen: Date.now() - 5000,
            });
        });
        await assertSucceeds(updateDoc(doc(alice, 'pvp_lobby', 'alice'), { lastSeen: Date.now() }));
    });

    await seedMatch(env, 'swap');
    await check('client cannot rewrite player1', function () {
        return assertFails(updateDoc(doc(alice, 'pvp_matches', 'swap'), {
            player1: { uid: 'mallory', name: 'Alice', profilePic: 'https://evil.example/a.png', score: 1, correct: 1, answers: [] },
        }));
    });
    await check('client cannot rewrite player2', function () {
        return assertFails(updateDoc(doc(alice, 'pvp_matches', 'swap'), {
            player2: { uid: 'alice', name: '[Bob](x)', profilePic: '', score: 0, correct: 0, answers: [] },
        }));
    });

    await seedMatch(env, 'leave');
    await check('forfeit as self with manual_leave succeeds', function () {
        return assertSucceeds(updateDoc(doc(alice, 'pvp_matches', 'leave'), {
            status: 'forfeit', forfeitedBy: 'alice', forfeitReason: 'manual_leave',
        }));
    });
    await seedMatch(env, 'disc');
    await check('disconnect forfeit is denied', function () {
        return assertFails(updateDoc(doc(alice, 'pvp_matches', 'disc'), {
            status: 'forfeit', forfeitedBy: 'alice', forfeitReason: 'disconnect',
        }));
    });
    await seedMatch(env, 'other');
    await check('forfeit as the opponent is denied', function () {
        return assertFails(updateDoc(doc(alice, 'pvp_matches', 'other'), {
            status: 'forfeit', forfeitedBy: 'bob', forfeitReason: 'manual_leave',
        }));
    });
    await seedMatch(env, 'done', 'finished');
    await check('finished match rejects every client update', function () {
        return assertFails(updateDoc(doc(alice, 'pvp_matches', 'done'), { status: 'active' }));
    });
    await seedMatch(env, 'gone', 'forfeit', { forfeitedBy: 'bob', forfeitReason: 'manual_leave' });
    await check('forfeited match rejects every client update', function () {
        return assertFails(updateDoc(doc(alice, 'pvp_matches', 'gone'), { player1LastSeen: Date.now() }));
    });
    await seedMatch(env, 'win');
    await check('questionWinner can only be cleared to null', async function () {
        await assertFails(updateDoc(doc(alice, 'pvp_matches', 'win'), { questionWinner: 'reroll' }));
        await assertSucceeds(updateDoc(doc(alice, 'pvp_matches', 'win'), { questionWinner: null }));
    });
    await seedMatch(env, 'timer', 'active');
    await check('question timer cannot move during an active round', function () {
        return assertFails(updateDoc(doc(alice, 'pvp_matches', 'timer'), {
            questionStartedAt: serverTimestamp(),
        }));
    });
    await seedMatch(env, 'start', 'countdown');
    await check('question timer can be set when the round starts', function () {
        return assertSucceeds(updateDoc(doc(alice, 'pvp_matches', 'start'), {
            status: 'active',
            questionWinner: null,
            questionStartedAt: serverTimestamp(),
        }));
    });

    await deleteDoc(doc(alice, 'pvp_lobby', 'alice')).catch(function () {});
    await env.cleanup();
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
