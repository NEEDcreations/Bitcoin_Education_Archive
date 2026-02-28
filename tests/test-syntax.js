// =============================================
// SYNTAX VALIDATION TESTS
// Ensures all JS files parse without errors
// Run: node tests/test-syntax.js
// =============================================
const fs = require('fs');
const path = require('path');

const JS_FILES = [
    'ranking.js', 'app.js', 'nacho-qa.js', 'nacho.js', 'nacho-engage.js',
    'nacho-closet.js', 'nacho-live.js', 'mobile-ux.js', 'forum.js',
    'marketplace.js', 'messaging.js', 'engagement.js', 'badges.js',
    'tickets.js', 'features.js', 'quests.js', 'scholar.js', 'sw.js',
    'channels.js'
];

let passed = 0, failed = 0;

JS_FILES.forEach(file => {
    const filepath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filepath)) {
        console.log(`⚠️  SKIP: ${file} (not found)`);
        return;
    }
    try {
        new Function(fs.readFileSync(filepath, 'utf8'));
        console.log(`✅ ${file}`);
        passed++;
    } catch (e) {
        console.log(`❌ ${file}: ${e.message}`);
        failed++;
    }
});

// Validate inline scripts in index.html
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
scripts.forEach((s, i) => {
    const code = s.replace(/<\/?script>/g, '');
    if (!code.trim()) return;
    try {
        new Function(code);
        console.log(`✅ index.html inline script #${i}`);
        passed++;
    } catch (e) {
        console.log(`❌ index.html inline script #${i}: ${e.message}`);
        failed++;
    }
});

// Validate JSON files
['firestore.indexes.json', 'manifest.json'].forEach(file => {
    const filepath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filepath)) return;
    try {
        JSON.parse(fs.readFileSync(filepath, 'utf8'));
        console.log(`✅ ${file}`);
        passed++;
    } catch (e) {
        console.log(`❌ ${file}: ${e.message}`);
        failed++;
    }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
