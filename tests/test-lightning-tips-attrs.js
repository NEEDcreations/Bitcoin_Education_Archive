// Tip overlay result: the "DM to request invoice" button carries only an
// action name; the uid, name and amount come from memory and the uid is
// checked before use. Covers both the readable source and the shipped file.
const assert = require('assert');
const vm = require('vm');
const H = require('./helpers-markup.js');

const { test, run } = H.runner();
const SRC = H.read('lightning-tips.js.src');
const MIN = H.read('lightning-tips.js');

function loadHelpers() {
    const calls = [];
    const sandbox = {
        openDMConversation: function(uid, name, text) { calls.push(['dm', uid, name, text]); },
        go: function(where) { calls.push(['go', where]); },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext([
        H.sliceBetween(SRC, 'var TIP_ID_RE =', 'window._tipIdOk = tipIdOk;'),
        H.sliceFunction(SRC, 'function tipBindDm('),
    ].join('\n'), sandbox, { filename: 'lightning-tips.js.src' });
    return { win: sandbox, calls: calls };
}
function box() {
    const b = H.makeEl('tipResult');
    return b;
}
function clickDm(b) {
    const target = H.elFrom({ 'data-tip-action': 'dm' });
    target.closest = function(sel) { return sel === '[data-tip-action]' ? target : null; };
    (b.listeners.click || []).forEach(function(fn) { fn.call(b, { target: target }); });
}

test('the DM button routes with the in-memory uid, name and amount', function() {
    const t = loadHelpers();
    const b = box();
    t.win.tipBindDm(b, { recipientUid: 'userB2', recipientName: H.ODD_NAMES[0] }, '21');
    t.win.tipBindDm(b, { recipientUid: 'other', recipientName: 'x' }, '1');
    clickDm(b);
    assert.deepStrictEqual(t.calls, [['dm', 'userB2', H.ODD_NAMES[0], '\u26a1 Tip: 21 sats']]);
});

test('odd uids fall back to the DM list', function() {
    H.ODD_IDS.forEach(function(id) {
        const t = loadHelpers();
        const b = box();
        t.win.tipBindDm(b, { recipientUid: id, recipientName: 'Ada' }, 'x');
        clickDm(b);
        assert.deepStrictEqual(t.calls, [['go', 'dms']], id);
    });
});

test('source and shipped file keep names and uids out of the button', function() {
    [SRC, MIN].forEach(function(code) {
        assert.ok(!/openDMConversation\(\\?'[^)]*recipientUid/.test(code));
        assert.ok(!/openDMConversation\('"\+/.test(code));
        assert.ok(code.includes('data-tip-action'));
        assert.ok(code.includes('tipBindDm('));
    });
});

test('shipped file loads and exposes the id check', function() {
    const sandbox = {
        console: { log: function() {}, error: function() {}, warn: function() {} },
        document: { getElementById: function() { return null; }, addEventListener: function() {}, createElement: function() { return H.makeEl(''); }, body: { appendChild: function() {} } },
        localStorage: { getItem: function() { return null; }, setItem: function() {} },
        setTimeout: function() { return 0; },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(MIN, sandbox, { filename: 'lightning-tips.js' });
    assert.strictEqual(typeof sandbox.showTipOverlay, 'function');
    assert.strictEqual(sandbox._tipIdOk('userB2'), true);
    H.ODD_IDS.forEach(function(id) { assert.strictEqual(sandbox._tipIdOk(id), false, id); });
});

run();
