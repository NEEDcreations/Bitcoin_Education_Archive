// =============================================
// NACHO KB TESTS
// Ensures the knowledge base answers correctly
// Run: node tests/test-nacho-kb.js
// =============================================
const fs = require('fs');
const path = require('path');

// Set up browser globals
global.window = global;
global.window._nachoNfaExplained = false;
global.window._nachoEli5 = false;
global.localStorage = { getItem: () => null, setItem: () => {} };
global.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} };
global.currentUser = { username: 'Test' };
global.QUEST_QUESTIONS = [];
global.navigator = { userAgent: '' };

let code = fs.readFileSync(path.join(__dirname, '..', 'nacho-qa.js'), 'utf8');
code = code.replace(/document\.addEventListener\(['"]DOMContentLoaded['"]/g, '//');
try { eval(code); } catch (e) { /* ignore browser API errors */ }

let passed = 0, failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
    } catch (e) {
        console.log(`❌ ${name}: ${e.message}`);
        failed++;
    }
}

// Count KB entries
const kbCount = (code.match(/keys:\s*\[/g) || []).length;
test(`KB has 150+ entries (found ${kbCount})`, () => { if (kbCount < 150) throw new Error(`Only ${kbCount}`); });

// ===== BEGINNER QUESTIONS =====
const beginnerQs = [
    'What is Bitcoin?', 'How does Bitcoin work?', 'Why is Bitcoin important?',
    'How do I buy Bitcoin?', 'What is a wallet?', 'What is a seed phrase?',
    'Is Bitcoin a scam?', 'Is Bitcoin a Ponzi scheme?', 'Is Bitcoin a bubble?',
    'Can Bitcoin be hacked?', 'Is Bitcoin volatile?', 'Is it too late?',
    'What is a satoshi?', 'What is DCA?', 'What is the halving?',
    'What is the Lightning Network?', 'Who created Bitcoin?', 'What is a blockchain?',
    'Where can I spend Bitcoin?', 'Is Bitcoin used by criminals?',
    'Does Bitcoin waste energy?', 'Can Bitcoin be banned?',
    'What about Ethereum?', 'What about Dogecoin?', 'Which crypto should I buy?',
];
beginnerQs.forEach(q => {
    test(`Beginner: "${q}"`, () => {
        const r = window.findAnswer(q);
        if (!r) throw new Error('No KB match');
    });
});

// ===== ADVANCED / MAXI QUESTIONS =====
const advancedQs = [
    'What is a UTXO?', 'What is the mempool?', 'What is a nonce?',
    'What is SHA-256?', 'What is Taproot?', 'What is the genesis block?',
    'What is the Byzantine Generals Problem?', 'What is the double spend problem?',
    'What is hash rate?', 'What is Nostr?', 'What is the difficulty adjustment?',
    'What is a soft fork vs hard fork?', 'What are ordinals?',
    'What is the Lindy Effect?', 'What is ecash?', 'What are Fedimints?',
];
advancedQs.forEach(q => {
    test(`Advanced: "${q}"`, () => {
        const r = window.findAnswer(q);
        if (!r) throw new Error('No KB match');
    });
});

// ===== OFF-TOPIC REJECTION =====
const offTopicQs = [
    'How do I cook pasta?', 'Tell me about dogs', 'What is the best pizza topping?',
    'How do airplanes fly?', 'How do I lose weight?', 'lol', 'ok', 'bruh',
];
offTopicQs.forEach(q => {
    test(`Off-topic rejected: "${q}"`, () => {
        const r = window.findAnswer(q);
        if (r) throw new Error(`False KB match: ${r.keys.slice(0, 2).join(', ')}`);
    });
});

// ===== CURRENT EVENT DETECTION =====
test('"eventually" does not trigger current event', () => {
    // "eventually" contains "event" — should NOT be detected
    const r = window.findAnswer('Why do all altcoins eventually fail against Bitcoin?');
    if (!r) throw new Error('Should match KB but was rejected as current event');
});

test('"Can Bitcoin be banned?" not current event', () => {
    const r = window.findAnswer('Can Bitcoin be banned?');
    if (!r) throw new Error('Should match KB');
});

// ===== MINING DESCRIPTION CHECK =====
test('Mining answer does NOT say "solving complex math"', () => {
    const r = window.findAnswer('What is Bitcoin mining?');
    if (!r) throw new Error('No mining answer');
    if (/solving.*complex.*math|solving.*puzzle/i.test(r.answer)) {
        throw new Error('Mining described as solving puzzles — WRONG');
    }
});

// ===== NFA DISCLAIMER =====
test('Financial answers contain NFA', () => {
    const r = window.findAnswer('Is Bitcoin volatile?');
    if (!r) throw new Error('No answer');
    if (!/not financial advice|DYOR|past performance/i.test(r.answer)) {
        throw new Error('Missing NFA disclaimer');
    }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
