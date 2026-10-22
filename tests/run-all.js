#!/usr/bin/env node
// =============================================
// MASTER TEST RUNNER
// Runs all test suites and reports results
// Run: node tests/run-all.js
// =============================================
const { execSync } = require('child_process');
const path = require('path');

const TESTS = [
    { name: 'Syntax Validation', file: 'test-syntax.js' },
    { name: 'HTML Integrity', file: 'test-html-integrity.js' },
    { name: 'Cache Busters', file: 'busters.js' },
    { name: 'Beats moderation', file: 'test-beats-moderation.js' },
    { name: 'Marketplace Client', file: 'test-marketplace.js' },
    { name: 'Marketplace Listing Count', file: 'test-market-listing-count.js' },
    { name: 'Variable Scope Safety', file: 'test-variable-scope.js' },
    { name: 'OnClick Function Existence', file: 'test-onclick-functions.js' },
    { name: 'Cipher Reward Odds', file: 'test-cipher-reward.js' },
    { name: 'Cipher Claim Safety', file: 'test-cipher-claim.js' },
    { name: 'Nacho Shoutout', file: 'test-shoutout.js' },
    { name: 'Activity Shoutouts', file: 'test-activity-shoutout.js' },
    { name: 'Telegram Shoutout Mirror', file: 'test-telegram-bridge.js' },
    { name: 'Faucet Guard', file: 'test-faucet-guard.js' },
    { name: 'Prediction Stats', file: 'test-prediction-stats.js' },
    { name: 'Timechain TV Presence', file: 'test-tctv-presence.js' },
    { name: 'Timechain TV Views', file: 'test-tctv-views.js' },
    { name: 'Hot Topics', file: 'test-hot-topics.js' },
    { name: 'Peer Request Speed', file: 'test-peer-request.js' },
    { name: 'Feature Registry + Nacho', file: 'test-feature-registry.js' },
    { name: 'Say hi reward', file: 'test-say-hi.js' },
    { name: 'Award allowlist attacks', file: 'test-award-attacks.js' },
    { name: 'Nacho Feb 26 facts', file: 'test-nacho-facts.js' },
    { name: 'Reward Notifications', file: 'test-reward-notify.js' },
    { name: 'Notification XSS', file: 'test-notif-xss.js' },
    { name: 'Reply Bonus', file: 'test-reply-bonus.js' },
    { name: 'Education cleanup', file: 'test-edu-cleanup.js' },
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
