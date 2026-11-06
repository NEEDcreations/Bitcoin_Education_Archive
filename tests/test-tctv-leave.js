// Leaving Timechain TV must run cleanupTimechainTV.
// That drops body.tctv-active (the mobile top bar stays hidden while it is set)
// and lets Nacho leave the TV corner.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const nacho = fs.readFileSync(path.join(root, 'nacho.js'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (err) {
        console.log('❌ ' + name + ': ' + err.message);
        failed++;
    }
}

function extractFunction(src, signature) {
    const start = src.indexOf(signature);
    assert.ok(start !== -1, 'missing ' + signature);
    const brace = src.indexOf('{', start);
    let depth = 0;
    for (let i = brace; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') {
            depth--;
            if (depth === 0) return src.slice(start, i + 1);
        }
    }
    throw new Error('unclosed ' + signature);
}

function fakeBody(on) {
    const classes = new Set(on ? ['tctv-active'] : []);
    return {
        classList: {
            contains: function (name) { return classes.has(name); },
            remove: function (name) { classes.delete(name); },
            add: function (name) { classes.add(name); }
        },
        has: function (name) { return classes.has(name); }
    };
}

function runLeave(nextId, opts) {
    const body = fakeBody(opts.active);
    const mbar = { style: { display: opts.barDisplay || 'none' } };
    const calls = { cleanup: 0, restore: 0, avatar: 0 };
    const sandbox = {
        console: console,
        document: {
            body: body,
            querySelector: function (sel) { return sel === '.mobile-bar' ? mbar : null; }
        },
        window: {}
    };
    sandbox.window.cleanupTimechainTV = function () {
        calls.cleanup++;
        if (opts.cleanupThrows) throw new Error('cleanup blew up');
        if (opts.cleanupRemovesClass) body.classList.remove('tctv-active');
        sandbox.window._tctvActive = false;
    };
    sandbox.window._nachoRestorePosition = function () { calls.restore++; };
    sandbox.window.updateNachoAvatarForPage = function () { calls.avatar++; };
    sandbox.window._tctvActive = !!opts.flag;
    sandbox.window.currentPage = opts.currentPage || 'timechain-tv';
    vm.createContext(sandbox);
    const src = extractFunction(app, 'window.leaveTimechainTV = function(nextId)');
    vm.runInContext(src + '\nwindow.leaveTimechainTV(' + JSON.stringify(nextId) + ');', sandbox);
    return { calls: calls, body: body, mbar: mbar, page: sandbox.window.currentPage, activeFlag: sandbox.window._tctvActive };
}

test('go, goHome, and back all call leaveTimechainTV', () => {
    const leaveAt = app.indexOf('window.leaveTimechainTV = function(nextId)');
    const goHomeAt = app.indexOf('window.goHome = function goHome');
    const goAt = app.indexOf('window.go = async function go');
    const popAt = app.indexOf("window.addEventListener('popstate'");
    assert.ok(leaveAt !== -1 && leaveAt < goHomeAt);
    assert.ok(app.indexOf("window.leaveTimechainTV('home')", goHomeAt) !== -1);
    const questAt = app.indexOf("id === 'questhub'", goAt);
    const leaveCall = app.indexOf('leaveTimechainTV(id)', goAt);
    assert.ok(questAt !== -1 && leaveCall !== -1 && questAt < leaveCall);
    assert.ok(app.indexOf('leaveTimechainTV(_popPage)', popAt) !== -1);
    assert.ok(app.includes('window.cleanupTimechainTV'));
});

test('leaving TV runs cleanup and restores Nacho and the top bar', () => {
    const result = runLeave('home', { active: true, cleanupRemovesClass: true, barDisplay: 'none' });
    assert.strictEqual(result.calls.cleanup, 1);
    assert.strictEqual(result.calls.restore, 1);
    assert.strictEqual(result.calls.avatar, 1);
    assert.strictEqual(result.body.has('tctv-active'), false);
    assert.strictEqual(result.activeFlag, false);
    assert.strictEqual(result.page, 'home');
    assert.strictEqual(result.mbar.style.display, '');
});

test('a page switch to Beats also runs cleanup', () => {
    const result = runLeave('bitcoin-beats', { active: true, flag: true, cleanupRemovesClass: true });
    assert.strictEqual(result.calls.cleanup, 1);
    assert.strictEqual(result.page, 'bitcoin-beats');
    assert.strictEqual(result.body.has('tctv-active'), false);
});

test('staying on Timechain TV does not run cleanup', () => {
    const result = runLeave('timechain-tv', { active: true });
    assert.strictEqual(result.calls.cleanup, 0);
    assert.strictEqual(result.calls.restore, 0);
    assert.strictEqual(result.body.has('tctv-active'), true);
});

test('a page that was never TV does not run cleanup', () => {
    const result = runLeave('forum', { active: false, currentPage: 'home' });
    assert.strictEqual(result.calls.cleanup, 0);
    assert.strictEqual(result.page, 'home');
});

test('a thrown cleanup still drops the TV class and restores Nacho', () => {
    const result = runLeave('home', { active: true, cleanupThrows: true });
    assert.strictEqual(result.calls.cleanup, 1);
    assert.strictEqual(result.body.has('tctv-active'), false);
    assert.strictEqual(result.activeFlag, false);
    assert.strictEqual(result.calls.restore, 1);
    assert.strictEqual(result.mbar.style.display, '');
});

test('Nacho ignores a stale tctv-active class once the page has changed', () => {
    const src = extractFunction(nacho, 'function onTv()');
    function check(page, path, hash, klass) {
        const sandbox = {
            window: { currentPage: page, location: { pathname: path, hash: hash } },
            document: { body: fakeBody(klass) }
        };
        vm.createContext(sandbox);
        return vm.runInContext(src + '\nonTv()', sandbox);
    }
    assert.strictEqual(check('home', '/timechain-tv', '#timechain-tv', true), false);
    assert.strictEqual(check('bitcoin-beats', '/', '#bitcoin-beats', true), false);
    assert.strictEqual(check('timechain-tv', '/', '#timechain-tv', false), true);
    assert.strictEqual(check('', '/timechain-tv', '', true), true);
    assert.strictEqual(check('', '/', '', false), false);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
