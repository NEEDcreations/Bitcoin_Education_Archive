// DM window, unblock prompt and report dialog: controls carry action names
// only. Uids are checked before use and display names come from memory.
const assert = require('assert');
const vm = require('vm');
const H = require('./helpers-markup.js');

const { test, run } = H.runner();
const SRC = H.read('messaging.js');
const ALLOWED = ['style', 'class', 'id', 'title', 'type', 'accept', 'maxlength', 'placeholder', 'onclick', 'onmouseover', 'onmouseout'];

function load(opts) {
    opts = opts || {};
    const calls = [];
    const appended = [];
    const timers = [];
    function rec(name) { return function() { calls.push([name].concat([].slice.call(arguments).filter(function(a) { return typeof a !== 'object'; }))); }; }
    const document = {
        body: { appendChild: function(el) { appended.push(el); return el; } },
        getElementById: function() { return null; },
        createElement: function() {
            const holder = H.makeEl('');
            Object.defineProperty(holder, 'firstChild', { get: function() { const e = H.makeEl('child'); e.html = holder.innerHTML; return e; } });
            return holder;
        },
    };
    const sandbox = {
        document: document,
        console: { log: function() {}, error: function() {}, warn: function() {} },
        setTimeout: function(fn) { timers.push(fn); return 0; },
        auth: { currentUser: { uid: 'viewer1', isAnonymous: false } },
        db: { collection: function() { return { doc: function() { return { get: function() { return { then: function() { return { catch: function() {} }; } }; } }; } }; } },
        escapeHtml: function(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); },
        MSG_CONFIG: { maxMsgLength: 500, maxNewConvosPerDay: 10 },
        currentUser: { username: 'viewer' },
        _canAccountDM: function() { return { ok: true }; },
        isUserBlocked: function() { return !!opts.blocked; },
        _canStartNewConvo: function() { return true; },
        getConversationId: function(a, b) { return a < b ? a + '_' + b : b + '_' + a; },
        loadDMMessages: function() {},
        closeDM: rec('close'),
        showUserProfile: rec('profile'),
        showDMGifPicker: rec('gif'),
        showDMImagePreview: rec('image'),
        sendDM: rec('send'),
        unblockUser: rec('unblock'),
        submitReport: rec('submit'),
        showToast: function() {},
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    const code = [
        H.sliceBetween(SRC, 'var DM_ID_RE =', 'window._dmIdOk = dmIdOk;'),
        H.sliceFunction(SRC, 'function dmActionTarget('),
        H.sliceFunction(SRC, 'window.reportUser = function('),
        H.sliceFunction(SRC, 'window.openDM = function('),
        H.sliceFunction(SRC, 'function dmBindWindow('),
        H.sliceFunction(SRC, 'function showDMWindow('),
    ].join('\n');
    vm.runInContext(code, sandbox, { filename: 'messaging.js' });
    sandbox.sendDM = rec('send');
    return { win: sandbox, calls: calls, appended: appended, timers: timers };
}
function fire(el, type, attrs, extra) {
    const ev = Object.assign({ target: H.elFrom(attrs), stopPropagation: function() {} }, extra || {});
    (el.listeners[type] || []).forEach(function(fn) { fn.call(el, ev); });
}

test('DM window markup carries no uid, convo id or name in handlers', function() {
    H.ODD_NAMES.concat(['Ada']).forEach(function(name) {
        const t = load();
        t.win.openDM('userB2', name);
        const win = t.appended[0];
        assert.ok(win, 'window rendered');
        const html = win.html;
        H.handlerTexts(html).forEach(function(h) { assert.ok(!/userB2|viewer1|MARKQ|Ada|Bob/.test(h), h); });
        assert.deepStrictEqual(H.strayAttrs(html, ALLOWED), []);
    });
});

test('odd uids never open a DM window', function() {
    H.ODD_IDS.forEach(function(id) {
        const t = load();
        t.win.openDM(id, 'Ada');
        assert.strictEqual(t.appended.length, 0, id);
    });
});

test('DM controls route with the in-memory name', function() {
    const t = load();
    const name = H.ODD_NAMES[0];
    t.win.openDM('userB2', name);
    const win = t.appended[0];
    ['profile', 'report', 'gif', 'send'].forEach(function(a) { fire(win, 'click', { 'data-dm-action': a }); });
    fire(win, 'keydown', { 'data-dm-action': 'send-key' }, { key: 'Enter' });
    fire(win, 'keydown', { 'data-dm-action': 'send-key' }, { key: 'a' });
    fire(win, 'click', { 'data-dm-action': 'constructor' });
    const convo = 'userB2_viewer1';
    assert.deepStrictEqual(t.calls, [
        ['close'], ['profile', 'userB2'],
        ['gif', convo, 'userB2', name], ['send', convo, 'userB2', name], ['send', convo, 'userB2', name],
    ]);
    // the report button opens the reason dialog for this uid
    const dialog = t.appended[1];
    assert.ok(dialog && /data-reason="spam"/.test(dialog.html));
    H.handlerTexts(dialog.html).forEach(function(h) { assert.ok(!/userB2|MARKQ|Bob/.test(h), h); });
    fire(dialog, 'click', { 'data-dm-action': 'report-reason', 'data-reason': 'scam' });
    fire(dialog, 'click', { 'data-dm-action': 'report-reason', 'data-reason': 'toString' });
    assert.deepStrictEqual(t.calls.filter(function(c) { return c[0] === 'submit'; }), [['submit', 'userB2', name, 'scam']]);
});

test('report dialog refuses odd uids', function() {
    H.ODD_IDS.forEach(function(id) {
        const t = load();
        t.win.reportUser(id, 'Ada');
        assert.strictEqual(t.appended.length, 0, id);
    });
});

test('unblock prompt routes with the in-memory uid and name', function() {
    const t = load({ blocked: true });
    const name = H.ODD_NAMES[2];
    t.win.openDM('userC3', name);
    const prompt = t.appended[0];
    H.handlerTexts(prompt.innerHTML).forEach(function(h) { assert.ok(!/userC3|MARKQ/.test(h), h); });
    assert.deepStrictEqual(H.strayAttrs(prompt.innerHTML, ALLOWED), []);
    fire(prompt, 'click', { 'data-dm-action': 'unblock' });
    assert.deepStrictEqual(t.calls, [['unblock', 'userC3', name]]);
});

run();
