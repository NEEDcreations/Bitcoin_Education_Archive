#!/usr/bin/env node
// Client profile writes are an allowlist. Reward fields and unknown fields are denied.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..', '..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--only', 'firestore',
        '--project', 'demo-profile-allow',
        'node tests/rules/profile-allowlist.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteField } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const listed = rules.match(/function profileClientFields\(\) \{\s*return \[([\s\S]*?)\];/);
if (!listed) {
    console.error('profileClientFields() missing');
    process.exit(1);
}
const fields = listed[1].split(',').map(function (part) {
    const match = part.match(/'([^']+)'/);
    return match ? match[1] : '';
}).filter(Boolean);

const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const parts = emu.split(':');

function valueFor(field) {
    if (field === 'country') return 'Japan';
    if (field === 'displayBadge' || field === 'equippedBadge') return 'first_channel';
    if (field === 'inviteCard') return 'open';
    if (field === 'beatsShowUncensored' || field === 'ghostMode' || field === 'isOnline' || field === 'newsletterOptIn' || field === 'nachoStoryComplete') return true;
    if (field === 'spinCount' || field === 'questsCompletedToday' || field === 'nachoStoryProgress' || field === 'nachoInteractions' || field === 'nachoQuestions' || field === 'sfWindowStreak') return 1;
    if (field === 'notificationPrefs') return { master: true, rewards: false };
    if (field === 'notifPrompt') return { count: 1, lastAsked: 1, stopped: false, dontAsk: false };
    if (field === 'lqProgress') return { whitepaper: { passed: true, bestScore: 4 } };
    if (field === 'trailProgress') return { meadow: ['whitepaper'] };
    if (field === 'trailsPassed' || field === 'earnedTitles') return ['hodler'];
    if (field === 'nachoStoryDays') return ['2026-10-22'];
    if (field === 'blockedUsers') return ['abc'];
    if (field === 'favorites' || field === 'bookmarks' || field === 'marketSaved' || field === 'completedQuests') return ['analogies'];
    if (field === 'artistProfile') return { stageName: 'Nacho' };
    if (field === 'explorationMilestone_25' || field === 'explorationMilestone_50' || field === 'explorationMilestone_75' || field === 'explorationMilestone_100') return true;
    return 'note';
}

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-profile-allow',
        firestore: { rules: rules, host: parts[0], port: Number(parts[1] || 8080) },
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
        await env.withSecurityRulesDisabled(async function (ctx) {
            await setDoc(doc(ctx.firestore(), 'users', 'user1'), {
                username: 'phil',
                points: 10,
                pendingLeaderboardReward: { xp: 5 },
            });
            await setDoc(doc(ctx.firestore(), 'users', 'user2'), { username: 'ada', points: 0 });
        });
        const ref = doc(user, 'users', 'user1');
        const fresh = doc(env.authenticatedContext('user2', password).firestore(), 'users', 'user2');
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            if (field === 'pendingLeaderboardReward') {
                await expect('delete ' + field, function () {
                    const patch = {};
                    patch[field] = deleteField();
                    return updateDoc(ref, patch);
                }, true);
                continue;
            }
            if (field === 'lightning' || field === 'lightningAddress' || field === 'lnAddress') continue;
            const patch = {};
            patch[field] = valueFor(field);
            await expect('write ' + field, function () { return updateDoc(ref, patch); }, true);
        }
        await expect('first lightning address', function () {
            return updateDoc(fresh, {
                lightning: 'ada@walletofsatoshi.com',
                lightningAddress: 'ada@walletofsatoshi.com',
                lnAddress: 'ada@walletofsatoshi.com',
            });
        }, true);
        const denied = ['points', 'orangeTickets', 'tickets', 'favor', 'badges', 'scholarPoints', 'pointsClaimed', 'visibleBadges', 'weeklyXP', 'unclaimableXp', 'brandNewReward'];
        for (let d = 0; d < denied.length; d++) {
            const field = denied[d];
            const patch = {};
            patch[field] = field === 'badges' || field === 'visibleBadges' ? ['forged'] : 999;
            await expect('deny ' + field, function () { return updateDoc(ref, patch); }, false);
        }
    } finally {
        await env.cleanup();
    }
    if (!fields.length) {
        failed++;
        console.log('allowlist was empty');
    }
    console.log(fields.length + ' allowlisted fields checked');
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (e) {
    console.error(e);
    process.exit(1);
});
