// LinkedIn sign-in (Identity Platform OIDC provider oidc.linkedin): static wiring + tombstone coverage.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log('✅ ' + name); passed++; } catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; } }
const ranking = read('ranking.js');
test('provider factory uses oidc.linkedin with openid profile email', () => {
    const fn = ranking.slice(ranking.indexOf('function newLinkedInProvider'), ranking.indexOf('function newLinkedInProvider') + 400);
    assert.ok(fn.includes("new firebase.auth.OAuthProvider('oidc.linkedin')"));
    ['openid', 'profile', 'email'].forEach((s) => assert.ok(fn.includes("addScope('" + s + "')"), s));
});
test('signInWithLinkedIn uses the shared provider path (rate limit, IAB, link/conflict handling)', () => {
    const fn = ranking.slice(ranking.indexOf('window.signInWithLinkedIn'), ranking.indexOf('window.signInWithLinkedIn') + 800);
    assert.ok(fn.includes('signInWithProvider(newLinkedInProvider())'));
});
test('reauth, providerForId and labels know LinkedIn', () => {
    assert.ok(ranking.includes("if (pid === 'oidc.linkedin') return newLinkedInProvider();"));
    assert.ok(ranking.includes("id=\"reauthLinkedIn\""));
    assert.ok(ranking.includes("ids.indexOf('oidc.linkedin') !== -1;\n    return oauth"));
});
test('index.html and 404.html both have the button', () => {
    ['index.html', '404.html'].forEach((f) => assert.strictEqual((read(f).match(/onclick="signInWithLinkedIn\(\)"/g) || []).length, 1, f));
    assert.ok(fs.existsSync(path.join(root, 'auth-icons/linkedin.svg')));
});
test('deleted/banned LinkedIn identities are tombstoned server-side', () => {
    process.env.TOMBSTONE_TEST = '1';
    const src = read('functions/src/accountTombstone.js');
    assert.ok(src.includes("id === 'oidc.linkedin') out.push('linkedin:' + puid)"));
});
test('mobile/touch uses redirect + extended login', () => {
    assert.ok(ranking.includes("enable_extended_login: 'true'"));
    assert.ok(ranking.includes('isStandalone || isSafariBrowser || isIOS || isTouchAuthDevice()'));
    assert.ok(/signInWithFacebook[\s\S]{0,300}isTouchAuthDevice\(\)/.test(ranking));
});
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
