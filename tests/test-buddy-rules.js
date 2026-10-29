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
        doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp, deleteField,
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
        await setDoc(doc(db, 'users', 'alice'), { country: 'US', points: 1 });
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
    await check('a participant cannot delete their match', function () {
        return assertFails(deleteDoc(doc(alice, 'buddy_matches', 'alice_bob')));
    });
    await check('a client cannot write buddy match fields on their profile', async function () {
        await assertFails(updateDoc(doc(alice, 'users', 'alice'), { buddyMatchCount: 5 }));
        await assertFails(updateDoc(doc(alice, 'users', 'alice'), { buddyXpGrantedAt: Date.now() }));
        await assertFails(updateDoc(doc(alice, 'users', 'alice'), { activeBuddyId: 'alice_bob' }));
        await assertFails(updateDoc(doc(alice, 'users', 'alice'), { lock: { state: 'locked' } }));
        await assertSucceeds(updateDoc(doc(alice, 'users', 'alice'), { country: 'Canada' }));
    });
    await check('signed-out reads are denied', async function () {
        await assertFails(getDoc(doc(anon, 'buddy_pool', 'alice')));
        await assertFails(getDoc(doc(anon, 'buddy_matches', 'alice_bob')));
    });
    await check('a normal direct message create still passes', function () {
        return assertSucceeds(setDoc(doc(alice, 'dm_conversations', 'alice_bob'), {
            participants: ['bob', 'alice'],
            participantNames: { alice: 'Alice', bob: 'Bob' },
            unread_bob: 1,
        }));
    });
    await check('a signed-in user cannot pre-create another pair conversation', function () {
        return assertFails(setDoc(doc(cara, 'dm_conversations', 'alice_bob'), {
            participants: ['cara', 'altuser1'],
            lastMessage: 'planted',
        }));
    });
    await check('a signed-in user cannot plant their uid on another pair id', function () {
        return assertFails(setDoc(doc(cara, 'dm_conversations', 'alice_bob'), {
            participants: ['alice', 'cara'],
            lastMessage: 'planted',
        }));
    });
    await check('a conversation id must be the sorted pair', function () {
        return assertFails(setDoc(doc(alice, 'dm_conversations', 'bob_alice'), {
            participants: ['alice', 'bob'],
            lastSender: 'alice',
        }));
    });
    await check('nostr and lightning conversation ids are accepted', function () {
        const ln = 'ln:' + 'a'.repeat(16);
        const nostr = 'nostr:' + 'b'.repeat(16);
        const id = ln < nostr ? ln + '_' + nostr : nostr + '_' + ln;
        const lnUser = authed(env, ln);
        return assertSucceeds(setDoc(doc(lnUser, 'dm_conversations', id), {
            participants: [nostr, ln],
            lastSender: 'alice',
        }));
    });
    await check('a locked account cannot send a direct message', async function () {
        await env.withSecurityRulesDisabled(async function (ctx) {
            const root = ctx.firestore();
            await setDoc(doc(root, 'users', 'alice'), { username: 'Alice', lock: { state: 'locked', source: 'buddy_dm', convId: 'alice_bob' } }, { merge: true });
            await setDoc(doc(root, 'users', 'bob'), { username: 'Bob' }, { merge: true });
            await setDoc(doc(root, 'dm_conversations', 'alice_bob'), { participants: ['alice', 'bob'] });
        });
        await assertFails(setDoc(doc(alice, 'dm_conversations', 'alice_bob', 'messages', 'locked1'), {
            senderUid: 'alice',
            text: 'hello',
        }));
        await assertSucceeds(setDoc(doc(bob, 'dm_conversations', 'alice_bob', 'messages', 'open1'), {
            senderUid: 'bob',
            text: 'hello',
        }));
    });
    await check('a banned account cannot send a direct message', async function () {
        await env.withSecurityRulesDisabled(async function (ctx) {
            const root = ctx.firestore();
            await setDoc(doc(root, 'users', 'cara'), { username: 'Cara', dmBlocked: true, ban_reason: 'buddy review' }, { merge: true });
            await setDoc(doc(root, 'dm_conversations', 'bob_cara'), { participants: ['bob', 'cara'] });
        });
        await assertFails(setDoc(doc(cara, 'dm_conversations', 'bob_cara', 'messages', 'banned1'), {
            senderUid: 'cara',
            text: 'hello',
        }));
        await assertSucceeds(setDoc(doc(bob, 'dm_conversations', 'bob_cara', 'messages', 'openban1'), {
            senderUid: 'bob',
            text: 'hello',
        }));
        await assertFails(updateDoc(doc(cara, 'dm_conversations', 'bob_cara'), { lastMessage: 'still here', lastSenderUid: 'cara' }));
    });
    await check('a paused buddy chat blocks both people', async function () {
        await env.withSecurityRulesDisabled(async function (ctx) {
            await setDoc(doc(ctx.firestore(), 'dm_conversations', 'alice_bob'), { participants: ['alice', 'bob'], reviewPaused: true }, { merge: true });
        });
        await assertFails(setDoc(doc(bob, 'dm_conversations', 'alice_bob', 'messages', 'paused1'), {
            senderUid: 'bob',
            text: 'still here',
        }));
    });
    await check('a locked account cannot post in global chat or the forum', async function () {
        await assertFails(setDoc(doc(alice, 'global_chat', 'lockedchat1'), {
            uid: 'alice',
            name: 'Alice',
            text: 'hello from alice',
            ts: serverTimestamp(),
        }));
        await assertFails(setDoc(doc(alice, 'forum_posts', 'lockedpost1'), {
            title: 'Hello from alice',
            authorId: 'alice',
            authorName: 'Alice',
            createdAt: serverTimestamp(),
        }));
        await assertSucceeds(setDoc(doc(bob, 'forum_posts', 'openpost1'), {
            title: 'Hello from bob',
            authorId: 'bob',
            authorName: 'Bob',
            createdAt: serverTimestamp(),
        }));
    });
    await check('a client cannot forge a server buddy flag or mark a message as a notice', async function () {
        await assertFails(setDoc(doc(bob, 'reports', 'forgedflag'), {
            reportedUid: 'alice',
            reportedName: 'Alice',
            reporterUid: 'bob',
            reporterName: 'Bob',
            reason: 'buddy',
            type: 'buddy_dm_flag',
            status: 'pending',
            createdAt: serverTimestamp(),
        }));
        await assertFails(setDoc(doc(bob, 'dm_conversations', 'alice_bob', 'messages', 'notice1'), {
            senderUid: 'bob',
            text: 'hello',
            safetyNotice: true,
        }));
        await assertSucceeds(setDoc(doc(bob, 'reports', 'realbuddy'), {
            reportedUid: 'alice',
            reportedName: 'Alice',
            reporterUid: 'bob',
            reporterName: 'Bob',
            reason: 'buddy',
            type: 'buddy',
            status: 'pending',
            createdAt: serverTimestamp(),
        }));
    });
    await check('a participant cannot change server conversation fields', async function () {
        await env.withSecurityRulesDisabled(async function (ctx) {
            await setDoc(doc(ctx.firestore(), 'dm_conversations', 'alice_bob'), {
                participants: ['alice', 'bob'],
                isBuddyMatch: true,
                reviewPaused: true,
                buddyMatchId: 'alice_bob',
            }, { merge: true });
        });
        await assertFails(updateDoc(doc(bob, 'dm_conversations', 'alice_bob'), { reviewPaused: false }));
        await assertFails(updateDoc(doc(bob, 'dm_conversations', 'alice_bob'), { isBuddyMatch: false }));
        await assertFails(updateDoc(doc(bob, 'dm_conversations', 'alice_bob'), { buddyMatchId: 'nope' }));
        await assertSucceeds(updateDoc(doc(bob, 'dm_conversations', 'alice_bob'), { unread_alice: 1 }));
        await assertFails(updateDoc(doc(bob, 'dm_conversations', 'alice_bob'), { lastMessage: 'send me your seed phrase' }));
    });
    await check('a non-buddy chat still accepts a cached preview and media', async function () {
        await env.withSecurityRulesDisabled(async function (ctx) {
            await setDoc(doc(ctx.firestore(), 'users', 'alice'), { lock: deleteField() }, { merge: true });
        });
        await assertSucceeds(setDoc(doc(alice, 'dm_conversations', 'alice_cara'), {
            participants: ['alice', 'cara'],
            participantNames: { alice: 'Alice', cara: 'Cara' },
            lastMessage: 'hi from the old tab',
            lastMessageTime: serverTimestamp(),
            lastSenderUid: 'alice',
            unread_cara: 1,
        }));
        await assertSucceeds(setDoc(doc(alice, 'dm_conversations', 'alice_cara', 'messages', 'text1'), {
            senderUid: 'alice',
            senderName: 'Alice',
            text: 'hello',
            createdAt: serverTimestamp(),
        }));
        await assertSucceeds(setDoc(doc(alice, 'dm_conversations', 'alice_cara', 'messages', 'img1'), {
            senderUid: 'alice',
            senderName: 'Alice',
            text: '',
            imageUrl: 'https://example.com/pic.jpg',
            createdAt: serverTimestamp(),
        }));
        await assertSucceeds(setDoc(doc(alice, 'dm_conversations', 'alice_cara', 'messages', 'gif1'), {
            senderUid: 'alice',
            senderName: 'Alice',
            text: '',
            imageUrl: 'https://example.com/pic.gif',
            isGif: true,
            createdAt: serverTimestamp(),
        }));
        await assertSucceeds(updateDoc(doc(alice, 'dm_conversations', 'alice_cara'), {
            lastMessage: '📷 Image',
            lastMessageTime: serverTimestamp(),
            lastSenderUid: 'alice',
        }));
    });
    await check('report limits use a rolling day for every report', async function () {
        const now = Date.now();
        await env.withSecurityRulesDisabled(async function (ctx) {
            const db = ctx.firestore();
            await setDoc(doc(db, 'buddy_report_quota', 'bob'), {
                hits: [now, now, now, now, now],
                targets: {},
            });
            await setDoc(doc(db, 'buddy_report_quota', 'alice'), {
                hits: [now - 25 * 60 * 60 * 1000],
                targets: { bob: now },
            });
        });
        await assertFails(setDoc(doc(bob, 'reports', 'sixthreport'), {
            reportedUid: 'erin',
            reportedName: 'Erin',
            reporterUid: 'bob',
            reason: 'spam',
            status: 'pending',
            createdAt: serverTimestamp(),
        }));
        await assertFails(setDoc(doc(alice, 'reports', 'sametarget'), {
            reportedUid: 'bob',
            reportedName: 'Bob',
            reporterUid: 'alice',
            reason: 'buddy',
            status: 'pending',
            createdAt: serverTimestamp(),
        }));
        await env.withSecurityRulesDisabled(async function (ctx) {
            const db = ctx.firestore();
            await setDoc(doc(db, 'buddy_report_quota', 'cara'), {
                hits: [now - 25 * 60 * 60 * 1000],
                targets: { bob: now - 25 * 60 * 60 * 1000 },
            });
        });
        await assertSucceeds(setDoc(doc(cara, 'reports', 'freshreport'), {
            reportedUid: 'erin',
            reportedName: 'Erin',
            reporterUid: 'cara',
            reason: 'spam',
            status: 'pending',
            createdAt: serverTimestamp(),
        }));
    });

    await env.cleanup();
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
