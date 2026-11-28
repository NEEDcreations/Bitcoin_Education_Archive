// Buddy match card: buddy fields display as text, and the message and
// reroll buttons route through one listener using values held in memory.
const assert = require('assert');
const vm = require('vm');
const H = require('./helpers-markup.js');

const { test, run } = H.runner();
const SRC = H.read('bitcoin-buddy.js');
const ALLOWED = ['style', 'class', 'id', 'title', 'onclick', 'onmouseover', 'onmouseout'];

function load() {
    const appended = [];
    const calls = [];
    const sandbox = {
        console: { log: function() {}, error: function() {}, warn: function() {} },
        document: {
            createElement: function() { return H.makeEl(''); },
            getElementById: function() { return null; },
            body: { appendChild: function(el) { appended.push(el); return el; } },
        },
        escapeHtml: function(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); },
        openDM: function(uid, name) { calls.push(['dm', uid, name]); },
        _rerollBuddy: function(id) { calls.push(['reroll', id]); },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    const code = [
        H.sliceBetween(SRC, 'var BUDDY_ID_RE =', 'window._buddyIdOk = buddyIdOk;'),
        H.sliceFunction(SRC, 'function _buddyEsc('),
        H.sliceFunction(SRC, 'function _showExistingMatch('),
    ].join('\n');
    vm.runInContext(code, sandbox, { filename: 'bitcoin-buddy.js' });
    return { win: sandbox, appended: appended, calls: calls };
}
function matchDoc(id, buddy) {
    return { id: id, data: function() { return { user1: { uid: 'viewer1', goal: 'learn' }, user2: buddy }; } };
}

test('buddy fields render as text and stay out of handlers', function() {
    H.ODD_NAMES.forEach(function(name) {
        const t = load();
        t.win._showExistingMatch(matchDoc('userB2_viewer1', { uid: 'userB2', username: name, intro: H.ODD_NAMES[1], level: H.ODD_NAMES[1], goal: 'teach' }), 'viewer1');
        const html = t.appended[0].innerHTML;
        assert.ok(!/<img/i.test(html), 'markup from buddy fields');
        assert.deepStrictEqual(H.strayAttrs(html, ALLOWED), []);
        H.handlerTexts(html).forEach(function(h) { assert.ok(!/userB2|MARKQ|Bob/.test(h), h); });
    });
});

test('message and reroll route with in-memory values', function() {
    const t = load();
    const name = H.ODD_NAMES[0];
    t.win._showExistingMatch(matchDoc('userB2_viewer1', { uid: 'userB2', username: name }), 'viewer1');
    const ov = t.appended[0];
    H.click(ov, { 'data-buddy-action': 'message' });
    H.click(ov, { 'data-buddy-action': 'reroll' });
    H.click(ov, { 'data-buddy-action': 'constructor' });
    assert.deepStrictEqual(t.calls, [['dm', 'userB2', name], ['reroll', 'userB2_viewer1']]);
});

test('odd buddy uids and match ids do not reach a handler', function() {
    H.ODD_IDS.forEach(function(id) {
        const t = load();
        t.win._showExistingMatch(matchDoc(id, { uid: id, username: 'Ada' }), 'viewer1');
        const ov = t.appended[0];
        assert.deepStrictEqual(H.strayAttrs(ov.innerHTML, ALLOWED), []);
        H.click(ov, { 'data-buddy-action': 'message' });
        H.click(ov, { 'data-buddy-action': 'reroll' });
        assert.deepStrictEqual(t.calls, [], id);
    });
});

run();
