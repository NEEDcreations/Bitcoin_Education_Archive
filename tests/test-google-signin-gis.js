// Google sign-in stays on this page. The service worker must not intercept
// Firebase's reserved /__/ helpers if a return URL is still opened here.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

test('sw.js ignores /__/ paths and does not respondWith or cache them', function () {
    const sw = read('sw.js');
    const start = sw.indexOf('function bypassesAuthHelper');
    const end = sw.indexOf("self.addEventListener('fetch'");
    assert.ok(start > 0 && end > start);
    const context = {
        self: { location: { origin: 'https://bitcoineducation.quest' } },
        URL: URL
    };
    vm.createContext(context);
    vm.runInContext(sw.slice(start, end), context);
    const bypass = context.bypassesAuthHelper;
    assert.strictEqual(typeof bypass, 'function');
    assert.strictEqual(bypass('https://bitcoineducation.quest/__/auth/handler'), true);
    assert.strictEqual(bypass('https://bitcoineducation.quest/__/auth/handler?apiKey=1&state=abc'), true);
    assert.strictEqual(bypass('https://bitcoineducation.quest/__/auth/iframe'), true);
    assert.strictEqual(bypass('https://bitcoineducation.quest/__/firebase/init.json'), true);
    assert.strictEqual(bypass('https://bitcoineducation.quest/'), false);
    assert.strictEqual(bypass('https://bitcoineducation.quest/index.html'), false);
    assert.strictEqual(bypass('https://bitcoineducation.quest/sw.js'), false);
    assert.strictEqual(bypass('https://bitcoineducation.quest/foo/__/auth'), false);
    assert.strictEqual(bypass('https://accounts.google.com/gsi/client'), false);
    assert.strictEqual(bypass('not a url'), false);

    const fetchBody = sw.slice(end);
    const bypassAt = fetchBody.indexOf('bypassesAuthHelper(event.request.url)');
    const methodAt = fetchBody.indexOf("if (event.request.method !== 'GET')");
    const respondAt = fetchBody.indexOf('respondWith');
    const cacheAt = fetchBody.indexOf('caches.open');
    assert.ok(bypassAt > 0, 'fetch listener calls the bypass');
    assert.ok(bypassAt < methodAt, 'auth helpers return before other fetch handling');
    assert.ok(respondAt === -1 || bypassAt < respondAt, 'no respondWith before the bypass return');
    assert.ok(cacheAt === -1 || bypassAt < cacheAt, 'no cache use before the bypass return');
    assert.ok(fetchBody.slice(bypassAt, methodAt).includes('return'));
});

test('Google sign-in uses the rendered button and links a guest in place', function () {
    const src = read('ranking.js');
    const start = src.indexOf('// Google Sign-In');
    const end = src.indexOf('// Twitter/X Sign-In');
    assert.ok(start > 0 && end > start);
    const section = src.slice(start, end);
    assert.ok(section.includes('google.accounts.id.renderButton'));
    assert.ok(section.includes('GoogleAuthProvider.credential'));
    assert.ok(section.includes('linkWithCredential'));
    assert.ok(section.includes('signInWithCredential'));
    assert.ok(section.includes("auth/credential-already-in-use"));
    assert.ok(section.includes("auth/email-already-in-use"));
    assert.ok(section.includes('linkErr.credential'));
    assert.ok(section.includes('_handleSignInResultGlobal'));
    assert.ok(section.includes('surfaceMfaRequired'));
    assert.ok(section.includes("removeItem('btc_guest_link')"));
    assert.ok(section.includes('isAnonymous'));
    assert.ok(section.includes("ux_mode: 'popup'"));
    assert.ok(section.includes('signInWithProvider'));
    assert.ok(!section.includes('.prompt('));
    assert.ok(!section.includes('waited >= 3000'));
    assert.ok(!section.includes('isMobile'));
    assert.ok(!section.includes('login_uri'));
    assert.ok(!/console\.\w+\(/.test(section.replace("console.warn('[Auth] Google sign-in failed:', (e && e.code) || 'unknown');", '')));
    assert.ok(section.includes("var GOOGLE_CLIENT_ID = '1055248200518-jcn5efjp7vhk0vm8cbmj4mfsgc0edkga.apps.googleusercontent.com'"));
    const googleAt = src.indexOf('signInWithGoogle =');
    assert.ok(src.slice(googleAt, googleAt + 8000).includes('surfaceMfaRequired'));
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(html.includes('id="gsiButtonHost"'));
    assert.ok(html.includes('id="googleSignInFallback"'));
    assert.ok(html.includes('accounts.google.com/gsi/client'));
});

test('manifest scope stays ./ and CSP allows the GIS button', function () {
    const manifest = JSON.parse(read('manifest.json'));
    assert.strictEqual(manifest.scope, './');
    assert.strictEqual(manifest.start_url, './');
    assert.ok(!Object.prototype.hasOwnProperty.call(manifest, 'scope_extensions'));
    assert.ok(!Object.prototype.hasOwnProperty.call(manifest, 'handle_links'));
    const worker = read('workers/seo-router/worker.js');
    const hosting = read('firebase.json');
    ['https://accounts.google.com/gsi/client', 'https://accounts.google.com/gsi/', 'https://accounts.google.com/gsi/style'].forEach(function (src) {
        assert.ok(worker.includes(src), src);
        assert.ok(hosting.includes(src), 'firebase.json ' + src);
    });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
