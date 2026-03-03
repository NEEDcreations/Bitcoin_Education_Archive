// =============================================
// HTML INTEGRITY TESTS  
// Ensures critical elements and script references exist
// Run: node tests/test-html-integrity.js
// =============================================
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let passed = 0, failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (e) {
        console.log(`❌ ${name}: ${e.message}`);
        failed++;
    }
}

// Critical DOM elements
test('usernameModal exists', () => assert(html.includes('id="usernameModal"')));
test('username-box exists inside modal', () => assert(html.includes('class="username-box')));
test('hero section exists', () => assert(html.includes('id="hero"')));
test('sidebar exists', () => assert(html.includes('id="sidebar"')));
test('main content area exists', () => assert(html.includes('id="msgs"')));
test('leaderboard element exists', () => assert(html.includes('id="leaderboard"')));
test('forumContainer exists', () => assert(html.includes('id="forumContainer"')));
test('questModal exists', () => assert(html.includes('id="questModal"')));

// Critical script references
test('bundle.js referenced', () => assert(html.match(/src="bundle\.js\?v=[\w]+"/)));
// app.js is now in bundle.js
// nacho-qa.js is now in bundle.js
// nacho.js is now in bundle.js
// channel_index.js is now in bundle.js
// messaging.js is now in bundle.js
// forum.js is now in bundle.js
// marketplace.js is now in bundle.js
// engagement.js is now in bundle.js
// mobile-ux.js is now in bundle.js

// All scripts should be deferred (except inline)
test('all external scripts are deferred', () => {
    const scriptTags = html.match(/<script src="[^"]*"[^>]*>/g) || [];
    const nonDeferred = scriptTags.filter(s => !s.includes('defer') && !s.includes('gstatic'));
    assert(nonDeferred.length === 0, `Non-deferred scripts: ${nonDeferred.join(', ')}`);
});

// Firebase SDK loaded
test('Firebase app SDK loaded', () => assert(html.includes('firebase-app-compat.js')));
test('Firebase auth SDK loaded', () => assert(html.includes('firebase-auth-compat.js')));
test('Firebase firestore SDK loaded', () => assert(html.includes('firebase-firestore-compat.js')));

// 404.html matches index.html
test('404.html matches index.html', () => {
    const html404 = fs.readFileSync(path.join(__dirname, '..', '404.html'), 'utf8');
    assert(html === html404, '404.html differs from index.html');
});

// Service worker precaches critical files
test('SW precaches bundle.js', () => {
    const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
    assert(sw.includes('bundle.js'), 'bundle.js not in SW precache');
});
// ranking.js is now in bundle.js

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
