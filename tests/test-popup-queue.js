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
    assert.ok(/const CACHE_NAME = 'btc-archive-v\d+[a-z]?'/.test(read('sw.js')));
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


test('closed Terms .tos-box does not count as an open sheet', function () {
    const env = bootQueue();
    const bodyClasses = {};
    env.sandbox.document.body.classList.toggle = function (name, on) {
        if (on) bodyClasses[name] = true;
        else delete bodyClasses[name];
    };
    const tosBox = {
        nodeType: 1,
        id: '',
        className: 'tos-box',
        classList: { contains: function () { return false; } },
        hidden: false,
        style: { display: '', zIndex: '' },
        parentNode: {
            nodeType: 1,
            id: 'tosModal',
            classList: { contains: function (c) { return c === 'open' ? false : false; } },
            hidden: false,
            style: { display: 'none', zIndex: '' },
            getAttribute: function () { return null; },
            getClientRects: function () { return []; }
        },
        getAttribute: function (name) { return name === 'role' ? 'dialog' : null; },
        getClientRects: function () { return []; },
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; }
    };
    env.sandbox.getComputedStyle = function (el) {
        if (el === tosBox) return { display: 'flex', visibility: 'visible', zIndex: 'auto' };
        if (el && el.id === 'tosModal') return { display: 'none', visibility: 'visible', zIndex: 'auto' };
        return { display: 'block', visibility: 'visible', zIndex: 'auto' };
    };
    env.sandbox.document.querySelectorAll = function () { return [tosBox]; };
    env.sandbox.btcSheet.sync();
    assert.strictEqual(env.sandbox.btcSheet.top(), null);
    assert.ok(!bodyClasses['btc-sheet-open'], 'btc-sheet-open must stay off while Terms is closed');
});

test('open Terms counts the tosModal host, not the inner box', function () {
    const env = bootQueue();
    const tosModal = {
        nodeType: 1,
        id: 'tosModal',
        classList: { contains: function (c) { return c === 'open'; } },
        hidden: false,
        style: { display: '', zIndex: '5000000' },
        getAttribute: function () { return null; },
        getClientRects: function () { return [{ bottom: 1, height: 1, left: 0, right: 1, top: 0, width: 1, x: 0, y: 0 }]; },
        querySelector: function () { return tosBox; },
        querySelectorAll: function () { return []; }
    };
    const tosBox = {
        nodeType: 1,
        id: '',
        className: 'tos-box',
        classList: { contains: function () { return false; } },
        hidden: false,
        style: { display: '', zIndex: '' },
        parentNode: tosModal,
        getAttribute: function (name) { return name === 'role' ? 'dialog' : null; },
        getClientRects: function () { return [{ bottom: 1, height: 1, left: 0, right: 1, top: 0, width: 1, x: 0, y: 0 }]; },
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; }
    };
    env.sandbox.getComputedStyle = function (el) {
        if (el === tosBox) return { display: 'flex', visibility: 'visible', zIndex: 'auto' };
        if (el === tosModal) return { display: 'flex', visibility: 'visible', zIndex: '5000000' };
        return { display: 'block', visibility: 'visible', zIndex: 'auto' };
    };
    env.sandbox.document.querySelectorAll = function () { return [tosBox]; };
    env.sandbox.btcSheet.sync();
    assert.strictEqual(env.sandbox.btcSheet.top(), tosModal);
});

function fakeLayer(opts) {
    return {
        nodeType: 1,
        id: opts.id || '',
        className: '',
        classList: { contains: function () { return false; } },
        hidden: false,
        style: { display: '', zIndex: '' },
        parentNode: { id: '', classList: { contains: function () { return false; } } },
        getAttribute: function (name) {
            if (name === 'role') return 'dialog';
            if (name === 'data-btc-sheet') return opts.sheetAttr == null ? null : opts.sheetAttr;
            return null;
        },
        getClientRects: function () { return [{ width: opts.w, height: opts.h }]; },
        getBoundingClientRect: function () { return { width: opts.w, height: opts.h }; },
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; }
    };
}

function bootWithLayers(layers) {
    const env = bootQueue();
    const toggles = [];
    env.sandbox.document.body.classList.toggle = function (name, on) { toggles.push([name, !!on]); };
    env.sandbox.getComputedStyle = function () { return { display: 'flex', visibility: 'visible', zIndex: 'auto' }; };
    env.sandbox.document.querySelectorAll = function () { return layers; };
    env.sandbox.btcSheet.sync();
    const last = toggles.filter(function (t) { return t[0] === 'btc-sheet-open'; }).pop();
    return { env: env, sheetOpen: last ? last[1] : false };
}

test('an empty zero-size dialog does not hide Global Chat', function () {
    const r = bootWithLayers([fakeLayer({ w: 0, h: 0 })]);
    assert.strictEqual(r.sheetOpen, false);
    assert.strictEqual(r.env.sandbox.btcSheet.top(), null);
});

test('a painted dialog still counts as an open sheet', function () {
    const layer = fakeLayer({ w: 320, h: 400 });
    const r = bootWithLayers([layer]);
    assert.strictEqual(r.sheetOpen, true);
    assert.strictEqual(r.env.sandbox.btcSheet.top(), layer);
});

test('a non-blocking card marked data-btc-sheet="0" does not hide Global Chat', function () {
    const r = bootWithLayers([fakeLayer({ id: 'pvpLobbyAlert', w: 380, h: 140, sheetAttr: '0' })]);
    assert.strictEqual(r.sheetOpen, false);
    assert.strictEqual(r.env.sandbox.btcSheet.top(), null);
});

test('PvP lobby alert opts out of the sheet stack', function () {
    const src = read('pvp-lobby-alert.js');
    assert.ok(src.includes("root.setAttribute('data-btc-sheet', '0')"));
    // On desktop the card sits above the FAB row so it does not cover the chat button.
    assert.ok(src.includes('#pvpLobbyAlert{left:auto;right:24px;bottom:80px;width:380px;}'));
});

test('Global Chat button is only CSS-hidden while body.btc-sheet-open is set', function () {
    const src = read('popup-stack.js');
    assert.ok(src.includes("'body.btc-sheet-open #chatOverlayBtn,'"));
    assert.ok(!/[^.-]#chatOverlayBtn\s*\{[^}]*display:\s*none/.test(src));
});

if (failed) {
    console.log(failed + ' failed, ' + passed + ' passed');
    process.exit(1);
}
console.log(passed + ' passed');
