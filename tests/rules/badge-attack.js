#!/usr/bin/env node
// Badge economy fields stay server-only.
// Starts the Firestore emulator when FIRESTORE_EMULATOR_HOST is not set.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..', '..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--only', 'firestore',
        '--project', 'demo-badges',
        'node tests/rules/badge-attack.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteDoc, deleteField, increment, getDoc } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const parts = emu.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-badges',
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
        await env.withSecurityRulesDisabled(async function (ctx) {
            await setDoc(doc(ctx.firestore(), 'users', 'user1'), {
                username: 'phil',
                points: 10,
                visibleBadges: ['peer_1'],
                pendingLeaderboardReward: { xp: 5 },
                certPassed_prop: true,
                certPassed_tech: true,
                certPassedAt_prop: '2026-10-01',
                certPassedAt_tech: '2026-10-01',
                lastExamAttempt_prop: '2026-10-22',
                lastExamAttempt_tech: '2026-10-22',
                examSlotId_prop: 'ex_seedprop',
                examSlotId_tech: 'ex_seedtech',
                certId_prop: 'CERT-SEEDPROP',
                certId_tech: 'CERT-SEEDTECH',
                scholar_exam_passed: true,
                scholar_tech_passed: true,
                scholar_tech_score: 25,
            });
        });
        const ref = doc(user, 'users', 'user1');
        await expect('profile bio is writable', function () {
            return updateDoc(ref, { bio: 'stacking sats' });
        }, true);
        await expect('learning quest progress', function () {
            return updateDoc(ref, { lqProgress: { whitepaper: { passed: true, bestScore: 4 } } });
        }, true);
        await expect('trail progress', function () {
            return updateDoc(ref, { trailProgress: { meadow: ['whitepaper'] }, trailsPassed: ['meadow'] });
        }, true);
        await expect('earned titles', function () {
            return updateDoc(ref, { earnedTitles: ['hodler'], activeTitle: 'hodler' });
        }, true);
        await expect('Nacho story', function () {
            return updateDoc(ref, { nachoStoryProgress: 2, nachoStoryDate: '2026-10-22', nachoStoryDays: ['2026-10-21', '2026-10-22'] });
        }, true);
        await expect('spin count', function () { return updateDoc(ref, { spinCount: 3 }); }, true);
        await expect('completed quests', function () {
            return updateDoc(ref, { completedQuests: ['quest_whitepaper'], questsCompletedToday: 1 });
        }, true);
        try {
            await updateDoc(ref, { referredBy: 'phil' });
            failed++;
            console.log('DENY   referred-by  ✗ allowed');
        } catch (referredErr) {
            const referredMsg = String((referredErr && referredErr.message) || referredErr);
            if (/maximum of 1000|Unable to evaluate/i.test(referredMsg)) {
                failed++;
                console.log('DENY   referred-by  ✗ ' + referredMsg);
            } else {
                console.log('DENY   referred-by  ✓');
            }
        }
        await expect('notification prefs', function () {
            return updateDoc(ref, { notificationPrefs: { master: true, rewards: false } });
        }, true);
        await expect('uncensored Beats setting', function () {
            return updateDoc(ref, { beatsShowUncensored: true });
        }, true);
        await expect('onboarding quest flag', function () {
            return updateDoc(ref, { nachoQuestDone: true });
        }, false);
        await expect('intro seen', function () { return updateDoc(ref, { introSeen: true }); }, false);
        await expect('merged anon flag', function () { return updateDoc(ref, { mergedAnon: true }); }, false);
        await expect('authenticator flag', function () { return updateDoc(ref, { totpEnabled: false }); }, false);
        await expect('ATTACK hiddenBadges', function () {
            return updateDoc(ref, { hiddenBadges: ['night_owl'] });
        }, false);
        await expect('ATTACK points', function () { return updateDoc(ref, { points: increment(1000) }); }, false);
        await expect('ATTACK visibleBadges', function () { return updateDoc(ref, { visibleBadges: ['satoshis_cipher'] }); }, false);
        await expect('ATTACK marketListings', function () { return updateDoc(ref, { marketListings: increment(1) }); }, false);
        await expect('ATTACK dailyTripleCount', function () { return updateDoc(ref, { dailyTripleCount: increment(1) }); }, false);
        await expect('ATTACK badgeCounters', function () { return updateDoc(ref, { badgeCounters: { forged: 1 } }); }, false);
        await expect('ATTACK lastTriviaDate', function () { return updateDoc(ref, { lastTriviaDate: '2026-10-22' }); }, false);
        await expect('ATTACK lastPollDate', function () { return updateDoc(ref, { lastPollDate: '2026-10-22' }); }, false);
        await expect('ATTACK lastQuestDate', function () { return updateDoc(ref, { lastQuestDate: '2026-10-22', questsCompletedToday: 2 }); }, false);
        await expect('ATTACK triviaStreak', function () { return updateDoc(ref, { triviaStreak: 30 }); }, false);
        await expect('ATTACK sayHiArmedDay', function () { return updateDoc(ref, { sayHiArmedDay: '2026-10-22' }); }, false);
        await expect('ATTACK replyBonusCount', function () { return updateDoc(ref, { replyBonusCount: 10 }); }, false);
        await expect('ATTACK giftsOpened', function () { return updateDoc(ref, { giftsOpened: increment(1) }); }, false);
        await expect('ATTACK shopPurchases', function () { return updateDoc(ref, { shopPurchases: increment(1) }); }, false);
        await expect('ATTACK raffleTicketsBought', function () { return updateDoc(ref, { raffleTicketsBought: increment(1) }); }, false);
        await expect('ATTACK topic_comment_pending', function () {
            return setDoc(doc(user, 'topic_comment_pending', 'forged'), { open: true });
        }, false);
        await expect('ATTACK peer_xp_credits', function () {
            return setDoc(doc(user, 'peer_xp_credits', 'a_b'), { leftXp: 10 });
        }, false);
        const examFields = [
            'certPassed_prop', 'certPassed_tech', 'certPassedAt_prop', 'certPassedAt_tech',
            'lastExamAttempt_prop', 'lastExamAttempt_tech',
            'examSlotId_prop', 'examSlotId_tech', 'certId_prop', 'certId_tech',
            'scholar_exam_passed', 'scholar_tech_passed', 'scholar_tech_score',
        ];
        for (let i = 0; i < examFields.length; i++) {
            const field = examFields[i];
            const attack = {};
            attack[field] = field === 'scholar_tech_score' ? 21 : (field.indexOf('At_') !== -1 || field.indexOf('Attempt_') !== -1 ? '2026-10-23' : false);
            await expect('ATTACK set ' + field, function () { return updateDoc(ref, attack); }, false);
            const clear = {};
            clear[field] = deleteField();
            await expect('ATTACK clear ' + field, function () { return updateDoc(ref, clear); }, false);
        }
        await expect('delete a pending leaderboard reward', function () {
            return updateDoc(ref, { pendingLeaderboardReward: deleteField() });
        }, true);
        await expect('ATTACK set a pending leaderboard reward', function () {
            return updateDoc(ref, { pendingLeaderboardReward: { xp: 999 } });
        }, false);
        await expect('ATTACK poll_votes create', function () {
            return setDoc(doc(user, 'poll_votes', 'poll_001_2026-10-22'), {
                pollId: 'poll_001_2026-10-22', question: 'q', options: ['a', 'b', 'c', 'd'],
                votes: [1, 0, 0, 0], voters: ['user1'],
            });
        }, false);
        await expect('ATTACK poll_cumulative create', function () {
            return setDoc(doc(user, 'poll_cumulative', 'poll_open'), {
                total: 1, option_0: 1, option_1: 0, option_2: 0, option_3: 0,
                pollId: 'poll_open', question: 'q',
            });
        }, false);
        await expect('ATTACK poll_cumulative inflated create', function () {
            return setDoc(doc(user, 'poll_cumulative', 'poll_inflate'), {
                total: 9999, option_0: 9999, option_1: 0, option_2: 0, option_3: 0,
                pollId: 'poll_inflate', question: 'q',
            });
        }, false);
        await env.withSecurityRulesDisabled(async function (ctx) {
            await setDoc(doc(ctx.firestore(), 'poll_cumulative', 'poll_live'), {
                total: 4, option_0: 1, option_1: 1, option_2: 1, option_3: 1,
                pollId: 'poll_live', question: 'q',
            });
        });
        await expect('read poll_cumulative', function () {
            return getDoc(doc(user, 'poll_cumulative', 'poll_live'));
        }, true);
        await expect('ATTACK poll_cumulative update', function () {
            return updateDoc(doc(user, 'poll_cumulative', 'poll_live'), { total: 5, option_0: 2 });
        }, false);
        await expect('ATTACK poll_cumulative delete', function () {
            return deleteDoc(doc(user, 'poll_cumulative', 'poll_live'));
        }, false);
        await expect('ATTACK market_listing_daily', function () {
            return setDoc(doc(user, 'market_listing_daily', 'user1_2026-10-22'), { n: 0 });
        }, false);
        await expect('ATTACK polls vote doc', function () {
            return setDoc(doc(user, 'polls', '2026-10-22', 'votes', 'user1'), { chosenIdx: 0 });
        }, false);
        await expect('ATTACK trusted device write', function () {
            return setDoc(doc(user, 'trusted_devices', 'dev1'), { uid: 'user1', tokenHash: 'forged' });
        }, false);
        await expect('ATTACK trusted device read', function () {
            return getDoc(doc(user, 'trusted_devices', 'dev1'));
        }, false);
        await expect('ATTACK fresh proof write', function () {
            return setDoc(doc(user, 'totp_fresh_proofs', 'user1_deleteAccount'), { proofId: 'cd'.repeat(16) });
        }, false);
        await expect('ATTACK fresh proof read', function () {
            return getDoc(doc(user, 'totp_fresh_proofs', 'user1_deleteAccount'));
        }, false);
    } finally {
        await env.cleanup();
    }
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (e) {
    console.error(e);
    process.exit(1);
});
