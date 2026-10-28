#!/usr/bin/env node
'use strict';

// Client writes to stats/global, stats/visits, stats/nacho-analytics,
// and poll_cumulative stay denied. Reads stay open.
// Starts the Firestore emulator when FIRESTORE_EMULATOR_HOST is not set.
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..', '..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--only', 'firestore',
        '--project', 'demo-stats',
        'node tests/rules/stats-counters.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, increment } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST;
const parts = emu.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-stats',
        firestore: { rules: rules, host: parts[0], port: Number(parts[1] || 8085) },
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

    try {
        await env.clearFirestore();
        const password = { firebase: { sign_in_provider: 'password' } };
        const user = env.authenticatedContext('user1', password).firestore();
        const anon = env.authenticatedContext('anon1', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
        const admin = env.authenticatedContext('admin1', { admin: true, firebase: { sign_in_provider: 'password' } }).firestore();
        await env.withSecurityRulesDisabled(async function (ctx) {
            const db = ctx.firestore();
            await setDoc(doc(db, 'stats', 'global'), { chatMessages: 3, userCount: 10, watchTimeMinutes: 4 });
            await setDoc(doc(db, 'stats', 'visits'), { total: 8 });
            await setDoc(doc(db, 'stats', 'nacho-analytics'), { totalQuestions: 2, upvotes: 1, downvotes: 0 });
            await setDoc(doc(db, 'poll_cumulative', 'poll_001'), { total: 4, option_0: 4, pollId: 'poll_001' });
        });

        await expect('read stats/global', function () { return getDoc(doc(user, 'stats', 'global')); }, true);
        await expect('read poll_cumulative', function () { return getDoc(doc(anon, 'poll_cumulative', 'poll_001')); }, true);
        await expect('loop stats/global +1', function () {
            return updateDoc(doc(user, 'stats', 'global'), { chatMessages: increment(1) });
        }, false);
        await expect('admin client stats/global', function () {
            return updateDoc(doc(admin, 'stats', 'global'), { userCount: increment(1) });
        }, false);
        await expect('create stats/global', function () {
            return setDoc(doc(user, 'stats', 'other'), { chatMessages: 1 });
        }, false);
        await expect('loop stats/visits +1', function () {
            return updateDoc(doc(user, 'stats', 'visits'), { total: increment(1) });
        }, false);
        await expect('anon create stats/visits', function () {
            return setDoc(doc(anon, 'stats', 'visits'), { total: 100 });
        }, false);
        await expect('set nacho-analytics total', function () {
            return setDoc(doc(user, 'stats', 'nacho-analytics'), { totalQuestions: 999999, upvotes: 1 }, { merge: true });
        }, false);
        await expect('create poll_cumulative', function () {
            return setDoc(doc(user, 'poll_cumulative', 'poll_new'), {
                total: 1, option_0: 1, pollId: 'poll_new', question: 'q',
            });
        }, false);
        await expect('update poll_cumulative +1', function () {
            return updateDoc(doc(user, 'poll_cumulative', 'poll_001'), { total: increment(1), option_1: increment(1) });
        }, false);
        await expect('write nacho rate doc', function () {
            return setDoc(doc(user, 'nacho_analytics_rate', 'user1'), { stamps: [1] });
        }, false);
    } finally {
        await env.cleanup();
    }
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
