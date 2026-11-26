// Guest username signup starts questions-first. A username alone is not
// "already onboarded". Join dates format safely. Accounts created before
// the questions-first release stay onboarded.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

const store = {};
function resetStore() {
    Object.keys(store).forEach(function (k) { delete store[k]; });
}

function makeSandbox() {
    const localStorage = {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; }
    };
    const sandbox = {
        console: console,
        Date: Date,
        setTimeout: function (fn) { return 0; },
        clearTimeout: function () {},
        localStorage: localStorage,
        auth: { currentUser: null },
        currentUser: null,
        db: { collection: function () { return { doc: function () { return { set: function () { return Promise.resolve(); } }; } }; } },
        firebase: { functions: function () { return { httpsCallable: function () { return function () { return Promise.resolve({ data: { ok: true } }); }; } }; } },
        document: {
            readyState: 'loading',
            addEventListener: function () {},
            getElementById: function () { return null; },
            querySelector: function () { return null; },
            querySelectorAll: function () { return []; },
            createElement: function () { return { style: {}, appendChild: function () {}, setAttribute: function () {}, querySelector: function () { return null; } }; },
            head: { appendChild: function () {} },
            body: { appendChild: function () {}, classList: { contains: function () { return false; } } }
        },
        location: { hash: '' },
        addEventListener: function () {},
        TOS_CURRENT_VERSION: 4
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    return sandbox;
}

function loadOnboarding() {
    const sandbox = makeSandbox();
    vm.createContext(sandbox);
    vm.runInContext(read('onboarding.js.src'), sandbox);
    return sandbox;
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    resetStore();
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }
}

test('a username alone does not count as already onboarded', function () {
    const w = loadOnboarding();
    store.btc_username = 'freshguest';
    store.btc_profile_cache = JSON.stringify({ uid: 'abc', data: { username: 'freshguest' } });
    w.currentUser = { uid: 'abc', username: 'freshguest' };
    w.auth.currentUser = { uid: 'abc', isAnonymous: true, metadata: { creationTime: '2026-11-20T12:00:00.000Z' } };
    assert.strictEqual(w.bqAlreadyOnboarded(), false);
    assert.strictEqual(store.btc_intro_seen, undefined);
});

test('introSeen flags still skip onboarding', function () {
    const w = loadOnboarding();
    store.btc_intro_seen = '1';
    assert.strictEqual(w.bqAlreadyOnboarded(), true);
    resetStore();
    const w2 = loadOnboarding();
    store.btc_onboarding_done = 'true';
    assert.strictEqual(w2.bqAlreadyOnboarded(), true);
    resetStore();
    const w3 = loadOnboarding();
    w3.currentUser = { username: 'old', introSeen: true, created: Date.UTC(2026, 10, 20, 12, 0, 0) };
    w3.auth.currentUser = { uid: 'x', isAnonymous: false };
    assert.strictEqual(w3.bqAlreadyOnboarded(), true);
});

test('accounts created before the questions-first release are treated as onboarded', function () {
    const w = loadOnboarding();
    w.currentUser = { username: 'veteran', created: new Date('2026-11-14T00:36:15.000Z') };
    w.auth.currentUser = { uid: 'old', isAnonymous: true, metadata: { creationTime: '2026-11-14T00:36:15.000Z' } };
    assert.ok(w.bqJoinDateMs(w.currentUser.created) < w.BQ_QUESTIONS_FIRST_SHIP_MS);
    assert.strictEqual(w.bqAlreadyOnboarded(), true);
    assert.strictEqual(store.btc_intro_seen, '1');
});

test('accounts created after the questions-first release still see onboarding', function () {
    const w = loadOnboarding();
    w.currentUser = { username: 'newguest', created: new Date('2026-11-20T08:33:00.000Z') };
    w.auth.currentUser = { uid: 'new', isAnonymous: true, metadata: { creationTime: '2026-11-20T08:33:00.000Z' } };
    assert.ok(w.bqJoinDateMs(w.currentUser.created) >= w.BQ_QUESTIONS_FIRST_SHIP_MS);
    assert.strictEqual(w.bqAlreadyOnboarded(), false);
});

test('guest accounts with a username are eligible for onboarding only', function () {
    const w = loadOnboarding();
    w.auth.currentUser = { uid: 'g', isAnonymous: true };
    w.currentUser = { uid: 'g', username: 'qaobq' };
    assert.strictEqual(w.bqOnboardingEligible(), true);
    w.currentUser = { uid: 'g' };
    delete store.btc_username;
    assert.strictEqual(w.bqOnboardingEligible(), false);
    store.btc_username = 'qaobq';
    assert.strictEqual(w.bqOnboardingEligible(), true);
    w.auth.currentUser = null;
    assert.strictEqual(w.bqOnboardingEligible(), false);
    w.auth.currentUser = { uid: 'r', isAnonymous: false };
    w.currentUser = { uid: 'r' };
    assert.strictEqual(w.bqOnboardingEligible(), true);
});

test('join dates format safely and never show Invalid Date', function () {
    const w = loadOnboarding();
    const fmt = w.bqFormatJoinDate;
    const ms = Date.UTC(2026, 10, 20, 8, 33, 0);
    assert.ok(fmt(new Date(ms)));
    assert.ok(!fmt(new Date(ms)).includes('Invalid'));
    assert.ok(fmt({ seconds: ms / 1000 }));
    assert.ok(fmt({ toDate: function () { return new Date(ms); } }));
    assert.ok(fmt('2026-11-20T08:33:00.000Z'));
    assert.strictEqual(fmt(undefined), '');
    assert.strictEqual(fmt(null), '');
    assert.strictEqual(fmt({}), '');
    assert.strictEqual(fmt({ _sentinel: 'serverTimestamp' }), '');
    assert.ok(w.bqJoinDateMs(ms) === ms);
    assert.ok(w.bqJoinDateMs(ms / 1000) === ms);
});

test('createUser starts the onboarding queue after a guest signup', function () {
    const src = read('ranking.js');
    const start = src.indexOf('async function createUser');
    const end = src.indexOf('async function awardVisitPoints');
    const fn = src.slice(start, end);
    assert.ok(fn.includes('btcOnboardingQueue.onSignedIn()'));
    assert.ok(fn.includes('btcBeginSignedInOnboarding'));
    assert.ok(fn.includes('bqJoinDateMs(currentUser.created)'));
    assert.ok(!/db\.collection\('users'\).*introSeen/.test(fn));
});

test('anonymous profile restore uses loadUser, not a local-only stub', function () {
    const src = read('ranking.js');
    assert.ok(src.includes('function hydrateAnonymousUser(uid)'));
    assert.ok(src.includes('hydrateAnonymousUser(user.uid)'));
    // Auth restore no longer drops a saved guest profile on the floor.
    const authChunk = src.slice(src.indexOf("console.log('[Auth] onAuthStateChanged:"), src.indexOf('function startAnonymousSession'));
    assert.ok(!/loadUserLocal\(user\.uid\)/.test(authChunk));
    assert.strictEqual((authChunk.match(/hydrateAnonymousUser\(user\.uid\)/g) || []).length, 3);
});

test('Member since uses the safe formatter', function () {
    const src = read('ranking.js');
    assert.ok(src.includes('bqFormatJoinDate(currentUser.created)'));
    assert.ok(!src.includes('new Date(currentUser.created).toLocaleDateString()'));
});

test('loadUser no longer treats a username as already onboarded', function () {
    const src = read('ranking.js');
    assert.ok(!src.includes('An existing user has a username in Firestore - they clearly already onboarded.'));
    assert.ok(src.includes('currentUser.introSeen'));
    assert.ok(src.includes('BQ_QUESTIONS_FIRST_SHIP_MS'));
});

test('service worker updates wait if signup or onboarding is open', function () {
    const html = read('index.html');
    const html404 = read('404.html');
    assert.ok(html.includes('function _onboardingChromeOpen()'));
    assert.ok(html.includes('_reloadWhenIdle'));
    assert.ok(html.includes("getElementById('btcIntroOverlay')"));
    assert.ok(html404.includes('_reloadWhenIdle'));
    assert.ok(/const CACHE_NAME = 'btc-archive-v\d+'/.test(read('sw.js')));
    assert.ok(html.includes('onboarding.js?v=20261119_v2683'));
    assert.ok(html.includes('ranking.js?v=20261126_v2702'));
});

test('intro overlay sits above the account sheet', function () {
    const src = read('onboarding.js.src');
    const min = read('onboarding.js');
    assert.ok(src.includes('z-index:2100012'));
    assert.ok(src.includes('closeAccountSheetForIntro'));
    assert.ok(src.includes('body:has(#btcIntroOverlay) #usernameModal{display:none !important;}'));
    assert.ok(min.includes('2100012'));
    assert.ok(min.includes('A free, gamified app for learning Bitcoin.'));
});

test('a guest signup can start the questions step immediately', function () {
    const src = read('popup-stack.js');
    const sandbox = {
        setTimeout: function () { return 0; }, clearTimeout: function () {}, WeakMap: WeakMap,
        MutationObserver: function () { this.observe = function () {}; },
        document: { readyState: 'complete', addEventListener: function () {}, getElementById: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return { appendChild: function () {} }; }, head: { appendChild: function () {} }, body: { classList: { toggle: function () {} } }, documentElement: { classList: { toggle: function () {} } } },
        history: { pushState: function () {}, back: function () {} }, location: { href: 'https://quest.test/' }, addEventListener: function () {}
    };
    sandbox.window = sandbox; sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    const q = sandbox.btcOnboardingQueue;
    const seen = [];
    q.skip('gift');
    q.skip('terms');
    q.ready('quiz', function () { seen.push('quiz'); });
    q.ready('pace', function () { seen.push('pace'); });
    q.onSignedIn();
    assert.deepStrictEqual(seen, ['quiz']);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
