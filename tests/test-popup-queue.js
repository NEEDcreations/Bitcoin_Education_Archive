// First-sign-in popups queue one at a time. Esc and Back close the top sheet.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

function bootQueue() {
    const listeners = {};
    const history = [];
    const sandbox = {
        console: console,
        setTimeout: function (fn) { return setTimeout(fn, 0); },
        clearTimeout: clearTimeout,
        WeakMap: WeakMap,
        MutationObserver: function () { this.observe = function () {}; },
        document: {
            readyState: 'complete',
            _btcSheetBound: false,
            addEventListener: function () {},
            getElementById: function () { return null; },
            querySelectorAll: function () { return []; },
            createElement: function () { return { id: '', textContent: '', appendChild: function () {} }; },
            head: { appendChild: function () {} },
            body: { classList: { toggle: function () {} } },
            documentElement: { classList: { toggle: function () {} } }
        },
        history: {
            pushState: function (state) { history.push(state); },
            back: function () { history.pop(); }
        },
        location: { href: 'https://quest.test/' },
        addEventListener: function (type, fn) {
            listeners[type] = listeners[type] || [];
            listeners[type].push(fn);
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(read('popup-stack.js'), sandbox, { filename: 'popup-stack.js' });
    return { sandbox: sandbox, history: history, listeners: listeners };
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }
}

test('queue waits for sign-in and shows gift, then terms, then pace', function () {
    const env = bootQueue();
    const q = env.sandbox.btcOnboardingQueue;
    const seen = [];
    q.ready('gift', function () { seen.push('gift'); });
    q.ready('terms', function () { seen.push('terms'); });
    q.ready('pace', function () { seen.push('pace'); });
    assert.deepStrictEqual(seen, []);
    q.onSignedIn();
    assert.deepStrictEqual(seen, ['gift']);
    q.done('gift');
    assert.deepStrictEqual(seen, ['gift', 'terms']);
    q.done('terms');
    assert.deepStrictEqual(seen, ['gift', 'terms', 'pace']);
});

test('a skipped gift does not block terms', function () {
    const env = bootQueue();
    const q = env.sandbox.btcOnboardingQueue;
    const seen = [];
    q.skip('gift');
    q.ready('terms', function () { seen.push('terms'); });
    q.onSignedIn();
    assert.deepStrictEqual(seen, ['terms']);
});

test('terms source keeps the checkbox and dismiss does not accept', function () {
    const ranking = read('ranking.js');
    const html = read('index.html');
    assert.ok(ranking.includes('if (!check || !check.checked) { _tosNeedsTick(); return; }'));
    assert.ok(ranking.includes('window._dismissTos = function'));
    const dismiss = ranking.slice(ranking.indexOf('window._dismissTos = function'), ranking.indexOf('window._acceptTos'));
    assert.ok(dismiss.includes('classList.remove(\'open\')'));
    assert.ok(!dismiss.includes('tosVersion'));
    assert.ok(!dismiss.includes('tosAcceptedAt'));
    assert.ok(html.includes('id="tosCloseBtn"'));
    assert.ok(html.includes('aria-label="Close"'));
    assert.ok(html.includes('window._dismissTos'));
    assert.strictEqual(html, read('404.html'));
});

test('onboarding does not open before sign-in and pace persists a default', function () {
    const src = read('onboarding.js.src');
    const boot = src.slice(src.indexOf('function boot()'), src.indexOf('if (document.readyState'));
    assert.ok(boot.includes('holdUntilSignedIn'));
    assert.ok(!boot.includes('showOnboardingIntro()'));
    assert.ok(src.includes('btcShowPaceStep'));
    assert.ok(src.includes("readPace() || 'beginner'"));
    assert.ok(src.includes('window.setExperienceMode(picked)'));
    assert.ok(src.includes("q.ready('gift'") === false);
    assert.ok(src.includes("q.ready('pace'"));
    assert.ok(src.includes("q.ready('quiz'"));
    assert.ok(src.includes("q.ready('quest'"));
    const registry = read('features.registry.js');
    assert.ok(registry.includes("options.preselect || 'beginner'"));
    assert.ok(registry.includes("aria-pressed"));
});

test('empty quest never submits and one-stop-shop has questions', function () {
    const quests = read('quests.js');
    assert.ok(quests.includes('"one-stop-shop"'));
    assert.ok(quests.includes('This quest has no questions yet.'));
    assert.ok(quests.includes('btcRevertEmptyTrailStop'));
    const guard = quests.slice(quests.indexOf('async function submitQuest'), quests.indexOf('const answers = window._questAnswers'));
    assert.ok(guard.includes('!currentQuest.questions.length'));
    assert.ok(read('modules.js').includes('window.btcRevertEmptyTrailStop'));
    const banks = JSON.parse(read('functions/reward-banks.json'));
    assert.ok(banks.quests['one-stop-shop'].length >= 5);
});

test('alerts badge is hidden when signed out', function () {
    const src = read('notifications.js');
    assert.ok(src.includes('function _alertUnreadCount'));
    const fn = src.slice(src.indexOf('function _alertUnreadCount'), src.indexOf('function _updatePointsBadge'));
    assert.ok(fn.includes('if (!_isSignedInAccount()) return 0;'));
    assert.ok(src.includes('window._notifCount = 0'));
});

test('signing shell copy and the boost badge keep a gap', function () {
    const html = read('index.html');
    assert.ok(html.includes('Signing you in…'));
    assert.ok(html.includes('btc_last_signed_in'));
    assert.ok(html.includes('html.btc-signing-in #homeGuestActions'));
    assert.ok(read('engagement.js').includes('margin-left:6px'));
    assert.ok(read('bundle.min.js').includes('margin-left:6px'));
    assert.ok(read('sw.js').includes("const CACHE_NAME = 'btc-archive-v2514'"));
});

test('sheet helper closes the top layer on Escape and Back', function () {
    const env = bootQueue();
    const closed = [];
    const layer = {
        id: 'tosModal',
        nodeType: 1,
        style: { zIndex: '20' },
        classList: { contains: function (name) { return name === 'open' && layer._open; }, remove: function () { layer._open = false; } },
        getAttribute: function (name) { return name === 'role' ? 'dialog' : null; },
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; },
        contains: function () { return false; },
        focus: function () {},
        _open: true
    };
    env.sandbox.document.querySelectorAll = function () { return layer._open ? [layer] : []; };
    env.sandbox.document.activeElement = { focus: function () {} };
    env.sandbox.btcSheet.setCloser(layer, function () { closed.push('tos'); layer._open = false; });
    env.sandbox.btcSheet.sync();
    assert.strictEqual(env.sandbox.btcSheet.top(), layer);
    env.sandbox.btcSheet.closeTop();
    assert.deepStrictEqual(closed, ['tos']);
    assert.strictEqual(env.sandbox.btcSheet.top(), null);
});

if (failed) {
    console.log(failed + ' failed, ' + passed + ' passed');
    process.exit(1);
}
console.log(passed + ' passed');
