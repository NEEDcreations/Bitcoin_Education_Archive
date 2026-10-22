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
    { name: 'Variable Scope Safety', file: 'test-variable-scope.js' },
    { name: 'OnClick Function Existence', file: 'test-onclick-functions.js' },
    { name: 'Cipher Reward Odds', file: 'test-cipher-reward.js' },
    { name: 'Cipher Claim Safety', file: 'test-cipher-claim.js' },
    { name: 'Nacho Shoutout', file: 'test-shoutout.js' },
    { name: 'Faucet Guard', file: 'test-faucet-guard.js' },
    { name: 'Timechain TV Presence', file: 'test-tctv-presence.js' },
    { name: 'Timechain TV Views', file: 'test-tctv-views.js' },
    { name: 'Hot Topics', file: 'test-hot-topics.js' },
    { name: 'Peer Request Speed', file: 'test-peer-request.js' },
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
