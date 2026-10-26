#!/usr/bin/env node
// =============================================
// MASTER TEST RUNNER
// Runs all test suites and reports results
// Run: node tests/run-all.js
// Installs tests/rules dependencies with npm ci first, so a fresh clone
// can run the Firestore rules suites without a separate install step.
// =============================================
const { execSync } = require('child_process');
const path = require('path');

const rulesDir = path.join(__dirname, 'rules');
console.log('Installing tests/rules dependencies (npm ci)…');
execSync('npm ci', { cwd: rulesDir, stdio: 'inherit' });

const TESTS = [
    { name: 'Syntax Validation', file: 'test-syntax.js' },
    { name: 'HTML Integrity', file: 'test-html-integrity.js' },
    { name: 'Cache Busters', file: 'busters.js' },
    { name: 'Google sign-in GIS', file: 'test-google-signin-gis.js' },
    { name: 'Beats moderation', file: 'test-beats-moderation.js' },
    { name: 'Marketplace Client', file: 'test-marketplace.js' },
    { name: 'Marketplace Listing Count', file: 'test-market-listing-count.js' },
    { name: 'Badge engine', file: 'test-badge-engine.js' },
    { name: 'SF live announce', file: 'test-sf-announce.js' },
    { name: 'New badge sources', file: 'test-new-badges.js' },
    { name: 'Badge search', file: 'test-badge-search.js' },
    { name: 'Variable Scope Safety', file: 'test-variable-scope.js' },
    { name: 'OnClick Function Existence', file: 'test-onclick-functions.js' },
    { name: 'Cipher Reward Odds', file: 'test-cipher-reward.js' },
    { name: 'Cipher Claim Safety', file: 'test-cipher-claim.js' },
    { name: 'Cipher share rewards', file: 'test-cipher-share.js' },
    { name: 'Nacho Shoutout', file: 'test-shoutout.js' },
    { name: 'Activity Shoutouts', file: 'test-activity-shoutout.js' },
    { name: 'Chat Mentions', file: 'test-chat-mentions.js' },
    { name: 'Telegram Shoutout Mirror', file: 'test-telegram-bridge.js' },
    { name: 'Chat Telegram mirror', file: 'test-chat-telegram-mirror.js' },
    { name: 'Faucet Guard', file: 'test-faucet-guard.js' },
    { name: 'Backup health', file: 'test-backup-health.js' },
    { name: 'R2 offsite copy', file: 'test-r2-offsite.js' },
    { name: 'Claimable sats cap', file: 'test-claimable-sats.js' },
    { name: 'Quiz And Trivia Rewards', file: 'test-quest-reward.js' },
    { name: 'Trivia tally transaction', file: 'test-answer-trivia.js' },
    { name: 'Community result totals', file: 'test-community-results.js' },
    { name: 'Prediction Stats', file: 'test-prediction-stats.js' },
    { name: 'Timechain TV Presence', file: 'test-tctv-presence.js' },
    { name: 'Timechain TV Leave', file: 'test-tctv-leave.js' },
    { name: 'Timechain TV Views', file: 'test-tctv-views.js' },
    { name: 'Timechain TV Daily Watch', file: 'test-tctv-watch.js' },
    { name: 'Hot Topics', file: 'test-hot-topics.js' },
    { name: 'Peer Request Speed', file: 'test-peer-request.js' },
    { name: 'Push Notifications', file: 'test-push.js' },
    { name: 'Push Opt-in Migration', file: 'test-push-optin-migration.js' },
    { name: 'Feature Registry + Nacho', file: 'test-feature-registry.js' },
    { name: 'Say hi reward', file: 'test-say-hi.js' },
    { name: 'Flex day goal', file: 'test-flex-day.js' },
    { name: 'LNURL resolve', file: 'test-lnurl-resolve.js' },
    { name: 'Lightning address reset', file: 'test-reset-lightning.js' },
    { name: 'Choose faction', file: 'test-choose-faction.js' },
    { name: 'User SF points', file: 'test-user-sf-points.js' },
    { name: 'Award allowlist attacks', file: 'test-award-attacks.js' },
    { name: 'Shared daily XP cap', file: 'test-daily-xp-cap.js' },
    { name: 'Proof of Walk daily cap', file: 'test-proof-of-walk.js' },
    { name: 'XP bank payout dry run', file: 'test-xp-bank-payout.js' },
    { name: 'Server ticket grants', file: 'test-ticket-grants.js' },
    { name: 'Account deletion', file: 'test-delete-account.js' },
    { name: 'Email change', file: 'test-email-change.js' },
    { name: 'Account rules', file: 'test-account-rules.js' },
    { name: 'PvP Flow', file: 'test-pvp-flow.js' },
    { name: 'PvP Rules', file: 'test-pvp-rules.js' },
    { name: 'Nacho Feb 26 facts', file: 'test-nacho-facts.js' },
    { name: 'Nacho live answers', file: 'nacho-quality.js' },
    { name: 'Chat scam regression', file: 'test-chat-scam-regression.js' },
    { name: 'KB question routing', file: 'test-kb-routing.js' },
    { name: 'Reward Notifications', file: 'test-reward-notify.js' },
    { name: 'Notification XSS', file: 'test-notif-xss.js' },
    { name: 'Reply Bonus', file: 'test-reply-bonus.js' },
    { name: 'Topic Discussions', file: 'test-topic-discussion.js' },
    { name: 'Topic Forum Mirror', file: 'test-topic-forum-mirror.js' },
    { name: 'Topic Conversation XP', file: 'test-topic-conversation-xp.js' },
    { name: 'Education cleanup', file: 'test-edu-cleanup.js' },
    { name: 'Quote of the Day', file: 'test-quotes.js' },
    { name: 'Referrals', file: 'test-referrals.js' },
    { name: 'Double XP', file: 'test-double-xp.js' },
    { name: 'Tip Confirmation', file: 'test-tip-confirm.js' },
    { name: 'Spin Reminder', file: 'test-spin-reminder.js' },
    { name: 'Onboarding Quest Grant', file: 'test-onboarding-quest.js' },
    { name: 'Username repick', file: 'test-username-repick.js' },
    { name: 'Username spaces', file: 'test-username-spaces.js' },
    { name: 'Email link and guest merge', file: 'test-email-link.js' },
    { name: 'Two-factor auth', file: 'test-totp.js' },
    { name: 'Remembered device retry', file: 'test-mfa-device.js' },
    { name: 'Two-factor emulator', file: 'test-totp-emulator.js' },
    { name: 'Badge rules attack', file: 'rules/badge-attack.js' },
    { name: 'SF chat rules', file: 'rules/sf-chat-rules.js' },
    { name: 'Username repick rules', file: 'rules/username-repick-rules.js' },
    { name: 'Forum mirror rules attack', file: 'rules/forum-mirror-attack.js' },
    { name: 'Backup status rules', file: 'rules/backup-status-rules.js' },
    { name: 'Scholar exam server proof', file: 'test-scholar-exam-emulator.js' },
];

let allPassed = true;

console.log('🧪 Bitcoin Education Archive — Test Suite\n');
console.log('='.repeat(50));

TESTS.forEach(t => {
    console.log(`\n📋 ${t.name}`);
    console.log('-'.repeat(40));
    try {
        const output = execSync(`node ${path.join(__dirname, t.file)}`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        console.log(output.trim());
    } catch (e) {
        allPassed = false;
        console.log(e.stdout ? e.stdout.trim() : '');
        if (e.stderr) console.log(e.stderr.trim());
    }
});

console.log('\n' + '='.repeat(50));
if (allPassed) {
    console.log('✅ ALL TEST SUITES PASSED');
} else {
    console.log('❌ SOME TESTS FAILED — FIX BEFORE PUSHING');
    process.exit(1);
}
