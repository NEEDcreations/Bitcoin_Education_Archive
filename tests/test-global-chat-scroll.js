// Global chat: keep history and scroll position when a live snapshot
// or lazy-load arrives while the user is reading older messages.
// (Nov 14, 2026)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'global-chat.js'), 'utf8');
const start = src.indexOf('// ---- Chat scroll helpers (keep history + don\'t yank the viewport) ----');
const end = src.indexOf('// ---- Chat scroll helpers end ----');
assert.ok(start >= 0 && end > start, 'scroll helpers are present in global-chat.js');

const sandbox = {
    CHAT_INITIAL_SHOW: 20,
    window: {},
    document: {
        getElementById: function() { return null; }
    }
};
vm.createContext(sandbox);
vm.runInContext(
    'var CHAT_INITIAL_SHOW = 20;\n' +
    src.slice(start, end) +
    '\nthis.api = window._chatScroll;',
    sandbox
);
const api = sandbox.api;
assert.ok(api, 'helpers exported on window._chatScroll');

let passed = 0, failed = 0;
function test(n, f) {
    try { f(); console.log('✅ ' + n); passed++; }
    catch (e) { console.log('❌ ' + n + ': ' + e.message); failed++; }
}

function msg(id, ts) { return { _id: String(id), ts: ts, text: 'm' + id }; }

test('stick when already near the bottom (within 80px)', () => {
    assert.strictEqual(api.STICK_PX, 80);
    assert.strictEqual(api.shouldStickToBottom(0, {}), true);
    assert.strictEqual(api.shouldStickToBottom(80, {}), true);
    assert.strictEqual(api.shouldStickToBottom(81, {}), false);
    assert.strictEqual(api.shouldStickToBottom(150, {}), false);
});

test('stick after the user just sent, even if scrolled up', () => {
    assert.strictEqual(api.shouldStickToBottom(2000, { justSent: true }), true);
    assert.strictEqual(api.shouldStickToBottom(2000, { justSent: false }), false);
});

test('stick on first paint before the user has scrolled', () => {
    assert.strictEqual(api.shouldStickToBottom(999, { firstPaint: true }), true);
    assert.strictEqual(api.shouldStickToBottom(999, { firstPaint: false }), false);
});

test('restore from bottom keeps the same offset after a prepend', () => {
    // Visible mid-list: height 2000, top 800, client 400 → fromBottom 800
    const el = { scrollHeight: 2000, scrollTop: 800, clientHeight: 400 };
    const fromBottom = api.distanceFromBottom(el);
    assert.strictEqual(fromBottom, 800);
    // 20 older messages add 600px at the top
    el.scrollHeight = 2600;
    el.scrollTop = 0; // what innerHTML does
    api.restoreFromBottom(el, fromBottom);
    assert.strictEqual(el.scrollTop, 1400);
    assert.strictEqual(api.distanceFromBottom(el), 800);
});

test('restore after prepend is equivalent to from-bottom restore at the top', () => {
    const el = { scrollHeight: 2600, scrollTop: 0, clientHeight: 400 };
    api.restoreAfterPrepend(el, 2000, 80);
    assert.strictEqual(el.scrollTop, 680);
});

test('live snapshot merge keeps loaded earlier messages', () => {
    // User loaded 61-100, then message 101 arrives. Live window is 82-101.
    const existing = [];
    for (let i = 61; i <= 100; i++) existing.push(msg(i, i * 1000));
    const incoming = [];
    for (let i = 82; i <= 101; i++) incoming.push(msg(i, i * 1000));
    const merged = api.mergeLiveSnapshot(existing, incoming);
    assert.strictEqual(merged[0]._id, '61');
    assert.strictEqual(merged[merged.length - 1]._id, '101');
    assert.strictEqual(merged.length, 41);
});

test('live snapshot does not grow the unexpanded 20-message window into a leak', () => {
    const existing = [];
    for (let i = 81; i <= 100; i++) existing.push(msg(i, i * 1000));
    const incoming = [];
    for (let i = 82; i <= 101; i++) incoming.push(msg(i, i * 1000));
    const merged = api.mergeLiveSnapshot(existing, incoming);
    assert.strictEqual(api.adjustShowCount(20, 20, merged.length), 20);
    const capped = api.capUnexpanded(merged, 20);
    assert.strictEqual(capped.length, 20);
    assert.strictEqual(capped[0]._id, '82');
    assert.strictEqual(capped[capped.length - 1]._id, '101');
});

test('capUnexpanded leaves expanded history alone', () => {
    const merged = [];
    for (let i = 61; i <= 101; i++) merged.push(msg(i, i * 1000));
    const kept = api.capUnexpanded(merged, 41);
    assert.strictEqual(kept.length, 41);
    assert.strictEqual(kept[0]._id, '61');
});

test('expanded history grows showCount so older messages stay on screen', () => {
    assert.strictEqual(api.adjustShowCount(40, 40, 41), 41);
    assert.strictEqual(api.adjustShowCount(40, 40, 40), 40);
});

test('a hard-delete in the live window is dropped, older history is kept', () => {
    const existing = [msg(1, 1000), msg(2, 2000), msg(3, 3000), msg(4, 4000)];
    const incoming = [msg(2, 2000), msg(4, 4000)]; // 3 deleted; 1 is older than window
    const merged = api.mergeLiveSnapshot(existing, incoming);
    assert.strictEqual(merged.map((m) => m._id).join(','), '1,2,4');
});

test('new-at-end count is the tail after the previous last id', () => {
    const vis = [msg(1, 1), msg(2, 2), msg(3, 3), msg(4, 4)];
    assert.strictEqual(api.countNewAtEnd('2', vis), 2);
    assert.strictEqual(api.countNewAtEnd('4', vis), 0);
    assert.strictEqual(api.countNewAtEnd('missing', vis), 0);
});

test('snapshot handlers merge instead of replacing _chatAllMsgs', () => {
    const listener = src.slice(src.indexOf('function startChatListener'), src.indexOf('function renderChatMessages'));
    const mergeCalls = listener.split('chatMergeLiveSnapshot').length - 1;
    assert.ok(mergeCalls >= 2, 'both snapshot handlers merge the live window');
    assert.ok(!/renderChatMessages\(msgs\);/.test(listener), 'raw snapshot msgs are not rendered as a replacement');
});

test('rebuild restores from-bottom and does not schedule a delayed jump', () => {
    const render = src.slice(src.indexOf('function renderChatMessages'), src.indexOf('window.loadEarlierMessages'));
    assert.ok(render.includes('chatRestoreScrollFromBottom(el, fromBottom)'));
    assert.ok(render.includes('el._applyingScroll = true'));
    assert.ok(!/setTimeout\(function\(\) \{ el\.scrollTop = el\.scrollHeight; \}/.test(render));
    assert.ok(render.includes('showChatNewMsgPill'));
    assert.ok(render.includes('bindChatMediaScroll'));
});

test('load earlier relies on from-bottom restore, not a delayed scrollTop', () => {
    const load = src.slice(src.indexOf('window.loadEarlierMessages'), src.indexOf('window.openRaidHub'));
    assert.ok(!/scrollHeight - oldHeight/.test(load));
    assert.ok(!/setTimeout\(function\(\) \{\s*el\.scrollTop/.test(load));
});

test('new-messages pill is in both chat shells', () => {
    assert.strictEqual((src.split('id="chatNewMsgPill"').length - 1) >= 2, true);
    assert.ok(src.includes('New messages ↓'));
    assert.ok(src.includes('window._jumpToLatestChatMsgs'));
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
