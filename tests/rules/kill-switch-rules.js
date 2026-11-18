#!/usr/bin/env node
// Offline mode must deny non-admin client writes (forum, chat, DMs,
// notifications, reports, marketplace, beats, profiles). Admins stay writable.
// Uses a throwaway Firestore emulator on 8191 so we don't touch port 8085.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..', '..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const cfg = path.join(root, 'firebase.killswitch.json');
    const javaBins = ['/tmp/jre/bin', '/home/box/jre/bin', '/home/box/jdk/jdk-21.0.13+9-jre/bin'].filter(function (d) {
        return fs.existsSync(path.join(d, 'java'));
    });
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--only', 'firestore',
        '--project', 'demo-kill-switch',
        '--config', cfg,
        'node tests/rules/kill-switch-rules.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, {
            CI: 'true',
            FIRESTORE_EMULATOR_HOST: '127.0.0.1:8191',
            PATH: javaBins.concat([process.env.PATH || '']).join(path.delimiter),
        }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8191';
const parts = emu.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-kill-switch',
        firestore: { rules: rules, host: parts[0], port: Number(parts[1] || 8191) },
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

    const password = { firebase: { sign_in_provider: 'password' } };
    const adaAuth = { ...password };
    const adminAuth = { ...password, admin: true };

    async function setFlag(enabled) {
        await env.withSecurityRulesDisabled(async function (ctx) {
            const db = ctx.firestore();
            await setDoc(doc(db, 'config', 'killSwitch'), {
                enabled: enabled,
                mode: 'offline',
                message: enabled ? 'Bitcoin Quest is temporarily offline for maintenance.' : null,
                autoReenableAt: null,
            });
            await setDoc(doc(db, 'config', 'killSwitchAdmin'), {
                reason: enabled ? 'security incident' : 'all clear',
                updatedBy: 'admin1',
                snapshot: { outputUri: 'gs://bitcoin-education-archive-backups/kill-switch/x' },
            });
            await setDoc(doc(db, 'users', 'ada'), {
                displayName: 'Ada',
                points: 0,
                streak: 0,
            }, { merge: true });
            await setDoc(doc(db, 'users', 'ada', 'notifications', 'n1'), {
                read: false,
                message: 'hello',
            });
        });
    }

    const beatsPayload = { reason: 'spam' };
    const reportPayload = { reporterUid: 'ada', target: 'x' };
    const forumPayload = {
        title: 'A valid forum title here',
        authorId: 'ada',
        authorName: 'Ada',
        createdAt: new Date(),
    };
    const replyPayload = {
        postId: 'p1',
        body: 'A reply body',
        authorId: 'ada',
        authorName: 'Ada',
        createdAt: new Date(),
    };

    try {
        await env.clearFirestore();
        await setFlag(true);

        const ada = env.authenticatedContext('ada', adaAuth).firestore();
        const admin = env.authenticatedContext('phil', adminAuth).firestore();
        const guest = env.unauthenticatedContext().firestore();

        await expect('public can read config/killSwitch while offline', function () {
            return getDoc(doc(guest, 'config', 'killSwitch'));
        }, true);
        await expect('signed-out cannot read config/killSwitchAdmin', function () {
            return getDoc(doc(guest, 'config', 'killSwitchAdmin'));
        }, false);
        await expect('non-admin cannot read config/killSwitchAdmin', function () {
            return getDoc(doc(ada, 'config', 'killSwitchAdmin'));
        }, false);
        await expect('admin can read config/killSwitchAdmin', function () {
            return getDoc(doc(admin, 'config', 'killSwitchAdmin'));
        }, true);
        await expect('nobody can write config/killSwitch from the client', function () {
            return setDoc(doc(ada, 'config', 'killSwitch'), { enabled: false });
        }, false);

        await expect('user cannot create beats_reports while offline', function () {
            return setDoc(doc(ada, 'beats_reports', 'r1'), beatsPayload);
        }, false);
        await expect('admin can create beats_reports while offline', function () {
            return setDoc(doc(admin, 'beats_reports', 'r-admin'), beatsPayload);
        }, true);
        await expect('user cannot create reports while offline', function () {
            return setDoc(doc(ada, 'reports', 'rep1'), reportPayload);
        }, false);
        await expect('admin can create reports while offline', function () {
            return setDoc(doc(admin, 'reports', 'rep-admin'), { reporterUid: 'phil', target: 'x' });
        }, true);
        await expect('user cannot create forum_posts while offline', function () {
            return setDoc(doc(ada, 'forum_posts', 'fp1'), forumPayload);
        }, false);
        await expect('admin can create forum_posts while offline', function () {
            return setDoc(doc(admin, 'forum_posts', 'fp-admin'), Object.assign({}, forumPayload, { authorId: 'phil', authorName: 'Phil' }));
        }, true);
        await expect('user cannot create forum_replies while offline', function () {
            return setDoc(doc(ada, 'forum_replies', 'fr1'), replyPayload);
        }, false);
        await expect('user cannot mark a notification read while offline', function () {
            return updateDoc(doc(ada, 'users', 'ada', 'notifications', 'n1'), { read: true });
        }, false);

        await setFlag(false);
        const ada2 = env.authenticatedContext('ada', adaAuth).firestore();
        await expect('user can create beats_reports when online', function () {
            return setDoc(doc(ada2, 'beats_reports', 'r2'), beatsPayload);
        }, true);
        await expect('user can create reports when online', function () {
            return setDoc(doc(ada2, 'reports', 'rep2'), reportPayload);
        }, true);
        await expect('user can create forum_posts when online', function () {
            return setDoc(doc(ada2, 'forum_posts', 'fp2'), forumPayload);
        }, true);
        await expect('user can create forum_replies when online', function () {
            return setDoc(doc(ada2, 'forum_replies', 'fr2'), replyPayload);
        }, true);
        await expect('user can mark a notification read when online', function () {
            return updateDoc(doc(ada2, 'users', 'ada', 'notifications', 'n1'), { read: true });
        }, true);
    } finally {
        await env.cleanup();
    }
    if (failed) {
        console.log('\n' + failed + ' kill-switch rules tests failed');
        process.exit(1);
    }
    console.log('\nAll kill-switch rules tests passed');
})().catch(function (e) {
    console.error(e);
    process.exit(1);
});
