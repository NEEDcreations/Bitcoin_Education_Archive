// Onboarding toasts: profile Saved confirmation and orange toasts that showed late.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

// Return the source of `function name(...) {...}` (or `async function`).
function fnSource(src, name) {
    const re = new RegExp('(async )?function ' + name + '\\s*\\(');
    const m = re.exec(src);
    assert.ok(m, name + ' not found');
    let i = src.indexOf('{', m.index);
    let depth = 0;
    let quote = null;
    for (; i < src.length; i++) {
        const c = src[i];
        if (quote) {
            if (c === '\\') { i++; continue; }
            if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
        if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return src.slice(m.index, i + 1); }
    }
    throw new Error('unbalanced ' + name);
}

let passed = 0;
let failed = 0;
const pending = [];
function test(name, fn) {
    pending.push(Promise.resolve().then(fn).then(function () {
        console.log('✅ ' + name); passed++;
    }).catch(function (e) {
        console.log('❌ ' + name + ': ' + e.message); failed++;
    }));
}

const ranking = read('ranking.js');

// Top-level function body up to its closing brace at column 0. Used for long
// functions whose regex literals confuse fnSource.
function topLevelSource(src, marker) {
    const start = src.indexOf(marker);
    assert.ok(start >= 0, marker + ' not found');
    const end = src.indexOf('\n}', start);
    assert.ok(end > start, marker + ' has no end');
    return src.slice(start, end + 2);
}

function constLine(name) {
    const m = new RegExp('var ' + name + ' = [^;]+;').exec(ranking);
    assert.ok(m, name + ' not found');
    return m[0];
}

// A tiny page: Terms modal, the shared #usernameModal, and a record of toasts.
function makeWorld() {
    const shown = [];
    const tos = { open: false };
    const modal = { open: false, view: 'signup' };
    function el(state) {
        return { classList: { contains: function (c) { return c === 'open' && state.open; } } };
    }
    const tosEl = el(tos);
    const modalEl = el(modal);
    modalEl.querySelector = function (sel) {
        // Settings replaces the sign-up form inside the same modal.
        if (modal.view === 'signup' && /#signupStartBtn|#usernameInput/.test(sel)) return {};
        return null;
    };
    const window = {};
    const ctx = {
        window: window,
        document: { getElementById: function (id) { return id === 'tosModal' ? tosEl : id === 'usernameModal' ? modalEl : null; } },
        Date: Date,
        setInterval: function () {},
    };
    vm.createContext(ctx);
    const code = [
        fnSource(ranking, 'tosBlocking'),
        fnSource(ranking, 'signupFormOpen'),
        fnSource(ranking, 'chromeBlocksToasts'),
        'var _toastQueue = [];',
        fnSource(ranking, 'showToast'),
        'function _showToastNow(msg, duration) { __shown.push(typeof msg === "object" ? msg.msg : msg); }',
        constLine('TOAST_QUEUE_TICK_MS'),
        constLine('TOAST_QUEUE_GAP_MS'),
        'var _toastQueueLastShow = 0;',
        fnSource(ranking, '_flushToastQueueTick'),
        'this.api = { showToast: showToast, tick: _flushToastQueueTick, chromeBlocksToasts: chromeBlocksToasts, queue: function () { return _toastQueue; }, tickMs: TOAST_QUEUE_TICK_MS };',
    ].join('\n');
    ctx.__shown = shown;
    vm.runInContext(code, ctx);
    return { api: ctx.api, shown: shown, tos: tos, modal: modal, window: window };
}

test('a toast fired while Settings is open shows right away', function () {
    const w = makeWorld();
    w.modal.open = true; w.modal.view = 'settings';
    assert.strictEqual(w.api.chromeBlocksToasts(), false);
    w.api.showToast('✅ Saved');
    assert.deepStrictEqual(w.shown, ['✅ Saved']);
    assert.strictEqual(w.api.queue().length, 0);
});

test('toasts still wait while the sign-up form or Terms is on screen', function () {
    const w = makeWorld();
    w.modal.open = true; w.modal.view = 'signup';
    w.api.showToast('one');
    assert.deepStrictEqual(w.shown, []);
    w.modal.open = false; w.tos.open = true;
    w.api.showToast('two');
    assert.deepStrictEqual(w.shown, []);
    assert.strictEqual(w.api.queue().length, 2);
});

test('queued toasts show as soon as the screen is free, then 1.2s apart', function () {
    const w = makeWorld();
    w.tos.open = true;
    ['a', 'b', 'c', 'd'].forEach(function (m) { w.api.showToast(m); });
    w.tos.open = false;
    const t0 = 1000000;
    const times = [];
    for (let t = t0 + w.api.tickMs; t <= t0 + 10000; t += w.api.tickMs) {
        const before = w.shown.length;
        w.api.tick(t);
        if (w.shown.length > before) times.push(t - t0);
    }
    assert.deepStrictEqual(w.shown, ['a', 'b', 'c', 'd']);
    assert.ok(w.api.tickMs <= 250, 'tick ' + w.api.tickMs);
    assert.ok(times[0] <= 250, 'first after ' + times[0] + 'ms');
    // The old 2s flush showed the fourth toast about 8s after Terms closed.
    assert.ok(times[3] <= 4000, 'fourth after ' + times[3] + 'ms');
    for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 1200);
});

test('Nacho busy still holds the queue', function () {
    const w = makeWorld();
    w.window._nachoBusy = true;
    w.api.showToast('x');
    assert.strictEqual(w.api.tick(Date.now()), false);
    assert.deepStrictEqual(w.shown, []);
    w.window._nachoBusy = false;
    assert.strictEqual(w.api.tick(Date.now()), true);
    assert.deepStrictEqual(w.shown, ['x']);
});

test('the old 2s flush interval is gone', function () {
    assert.ok(!/setInterval\(function\(\) \{\s*if \(!window\._nachoBusy && !chromeBlocksToasts\(\) && _toastQueue\.length > 0\)[\s\S]{0,120}\}, 2000\);/.test(ranking));
    assert.ok(/setInterval\(function\(\) \{ _flushToastQueueTick\(\); \}, TOAST_QUEUE_TICK_MS\);/.test(ranking));
});

test('CSS only hides toasts behind the sign-up form, not Settings', function () {
    ['index.html', '404.html'].forEach(function (f) {
        const html = read(f);
        assert.ok(!html.includes('body:has(#usernameModal.open) .rank-toast'), f + ' still hides toasts over Settings');
        assert.ok(html.includes('body:has(#usernameModal.open #signupStartBtn) .rank-toast'), f);
        assert.ok(html.includes('body:has(#usernameModal.open #usernameInput) .rank-toast'), f);
    });
    assert.strictEqual(read('index.html'), read('404.html'));
});

test('Settings markup never contains the sign-up form ids', function () {
    const settings = topLevelSource(ranking, 'function showSettingsPage(tab)');
    assert.ok(settings.includes("classList.add('open')"));
    // Only the static sign-up form in index.html carries these ids.
    ['ranking.js', 'app.js', 'onboarding.js'].forEach(function (f) {
        const src = read(f);
        assert.ok(!/id=\\?["']signupStartBtn/.test(src), f);
        assert.ok(!/id=\\?["']usernameInput/.test(src), f);
    });
    assert.ok(read('index.html').includes('id="signupStartBtn"'));
    assert.ok(read('index.html').includes('id="usernameInput"'));
});

test('a successful profile save shows a Saved toast', function () {
    const save = topLevelSource(ranking, 'async function saveProfile(');
    const write = save.indexOf("db.collection('users').doc(uid).update(updateData)");
    const toast = save.indexOf("showToast('✅ Saved')");
    const fail = save.indexOf('catch(e)');
    assert.ok(write > 0 && toast > write && toast < fail, 'Saved toast follows the write, before the error path');
    assert.ok(save.includes('✅ Saved</span>'));
});

test('patches.js toast wrapper waits a short beat, not the full display time', function () {
    const patches = read('patches.js');
    const m = /const _toastHoldMs = function\(duration\) \{[\s\S]*?\n    \};/.exec(patches);
    assert.ok(m, '_toastHoldMs not found');
    assert.ok(patches.includes('}, _toastHoldMs(duration));'));
    const withOrig = vm.runInNewContext('var _originalShowToast = function () {};' + m[0] + ' _toastHoldMs', {});
    const without = vm.runInNewContext('var _originalShowToast;' + m[0] + ' _toastHoldMs', {});
    assert.ok(withOrig(2500) <= 900);
    assert.strictEqual(withOrig(500), 500);
    assert.strictEqual(without(2500), 2500);
});

Promise.all(pending).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
});
