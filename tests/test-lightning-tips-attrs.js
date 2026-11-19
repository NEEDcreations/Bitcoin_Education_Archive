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

// ---- invoice copy screen ----
const GOOD_INV = 'lnbc210n1pjq0xyzpp5' + 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'.repeat(6);
const GOOD_INV_UPPER = 'LNTB1500N1' + 'QPZRY9X8GF2TVDW0S3JN54KHCE6MUA7L'.repeat(4);
const ODD_INVS = [
    "lnbc1x');MARKQ12();//",
    'lnbc1"><img src=x onerror=MARKQ13>',
    'lnbc1&#39;);MARKQ14();//',
    'lnbcb1qpzry9x8gf2tvdw0s3jn54khce6mua7lqq' + 'b',
    'xxbc1qpzry9x8gf2tvdw0s3jn54khce6mua7lqqqq',
    'lnbc1' + 'q'.repeat(2048),
    'lnbc1short',
    ' lnbc1qpzry9x8gf2tvdw0s3jn54khce6mua7lqqqq',
    'javascript:MARKQ15',
    'lnbc1qpzry9x8gf2tvdw0s3jn54khce6mua7l\nqqqq',
];

function loadFull(code, name) {
    const els = {};
    const clip = [];
    const toasts = [];
    const timers = [];
    const sandbox = {
        console: { log: function() {}, error: function() {}, warn: function() {} },
        document: {
            getElementById: function(id) { if (!els[id]) els[id] = H.makeEl(id); return els[id]; },
            addEventListener: function() {},
            createElement: function() { return H.makeEl(''); },
            body: { appendChild: function() {} },
        },
        navigator: { clipboard: { writeText: function(v) { clip.push(v); return { then: function(cb) { cb(); } }; } } },
        localStorage: { getItem: function() { return null; }, setItem: function() {} },
        setTimeout: function(fn) { timers.push(fn); return 0; },
        escapeHtml: function(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); },
        showToast: function(m) { toasts.push(m); },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: name });
    return { win: sandbox, els: els, clip: clip, toasts: toasts, timers: timers };
}
async function payWith(t, inv) {
    t.win._tipOpts = { bolt11: inv, fixedAmount: true, suggestedAmount: 21, label: 'Send Tip' };
    await t.win.executeTip();
}
function clickCopyBlock(res) {
    const target = H.elFrom({ 'data-tip-action': 'copy-inv' });
    target.closest = function(sel) { return sel === '[data-tip-action]' ? target : null; };
    (res.listeners.click || []).forEach(function(fn) { fn.call(res, { target: target }); });
}

[['source', SRC, 'lightning-tips.js.src'], ['shipped file', MIN, 'lightning-tips.js']].forEach(function(row) {
    test(row[0] + ': a valid invoice renders, copies and keeps out of handlers', async function() {
        for (const inv of [GOOD_INV, GOOD_INV_UPPER]) {
            const t = loadFull(row[1], row[2]);
            await payWith(t, inv);
            const html = t.els.tipResult.innerHTML;
            assert.ok(html.indexOf('data-tip-action="copy-inv"') !== -1, 'copy block rendered');
            H.handlerTexts(html).forEach(function(h) { assert.ok(h.indexOf(inv.slice(0, 12)) === -1, h); });
            clickCopyBlock(t.els.tipResult);
            t.timers.splice(0).forEach(function(fn) { fn(); });
            (t.els.tipCopyInvBtn.listeners.click || []).forEach(function(fn) { fn(); });
            assert.deepStrictEqual(t.clip, [inv, inv]);
        }
    });

    test(row[0] + ': odd invoices show an error and never reach copy', async function() {
        for (const inv of ODD_INVS) {
            const t = loadFull(row[1], row[2]);
            await payWith(t, inv);
            const html = t.els.tipResult.innerHTML;
            assert.ok(/could not be used/.test(html), JSON.stringify(inv).slice(0, 60));
            assert.strictEqual(html.indexOf('MARKQ'), -1);
            assert.deepStrictEqual(H.handlerTexts(html), []);
            clickCopyBlock(t.els.tipResult);
            t.timers.splice(0).forEach(function(fn) { fn(); });
            assert.deepStrictEqual(t.clip, []);
            assert.strictEqual(t.els.tipPayBtn.disabled, false);
        }
    });

    test(row[0] + ': the copy block re-checks the stored invoice', async function() {
        const t = loadFull(row[1], row[2]);
        await payWith(t, GOOD_INV);
        t.els.tipResult._tipInvoice = ODD_INVS[0];
        clickCopyBlock(t.els.tipResult);
        assert.deepStrictEqual(t.clip, []);
        assert.strictEqual(t.win._tipBolt11Ok(GOOD_INV), true);
        ODD_INVS.forEach(function(inv) { assert.strictEqual(t.win._tipBolt11Ok(inv), false, inv.slice(0, 40)); });
    });
});

test('no invoice text rides in handler strings in either file', function() {
    [SRC, MIN].forEach(function(code) {
        assert.ok(!/writeText\(\\?'[^)]*\+/.test(code));
        assert.ok(code.includes('data-tip-action="copy-inv"'));
    });
});

run();
