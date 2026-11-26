// Chat hub routing (Nov 26, 2026):
// 1. A fresh /#dms load ran the route before auth restored the session, so the
//    DMs tab stayed empty. The tab now waits for the first signed-in auth state.
// 2. renderChatHub('announcements') fell through to the DMs tab. It now opens GGs.
// 3. The hub DMs tab opened the inbox popup and left the tab empty. The inbox now
//    renders inside the tab (window._renderInboxInto).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const messaging = fs.readFileSync(path.join(root, 'messaging.js'), 'utf8');
const chat = fs.readFileSync(path.join(root, 'global-chat.js'), 'utf8');
const bundle = fs.readFileSync(path.join(root, 'bundle.src.js'), 'utf8');
let passed = 0, failed = 0;
function test(n, f) { try { f(); console.log('✅ ' + n); passed++; } catch (e) { console.log('❌ ' + n + ': ' + e.message); failed++; } }

function fakeDom() {
    const els = {};
    function El(id) { return { id: id, innerHTML: '', isConnected: true, style: {}, classList: { add() {}, remove() {} }, remove() { this.isConnected = false; delete els[this.id]; }, appendChild() {}, addEventListener() {}, querySelectorAll() { return []; }, setAttribute() {} }; }
    const document = {
        getElementById(id) {
            if (els[id]) return els[id];
            for (const k in els) { if (els[k].isConnected && els[k].innerHTML.indexOf('id="' + id + '"') !== -1) { els[id] = El(id); return els[id]; } }
            return null;
        },
        createElement() { return El('tmp'); }, body: { appendChild() {} }, addEventListener() {}, querySelectorAll() { return []; }, hidden: false
    };
    return { els, El, document };
}

function convoSnap(myUid) {
    const docs = [1, 2].map(function (i) {
        const names = {}; names[myUid] = 'Me'; names['peer' + i] = 'Peer' + i;
        return { id: 'c' + i, data() { return { participants: [myUid, 'peer' + i], participantNames: names, lastMessage: 'hi ' + i, lastMessageTime: null, lastSenderUid: 'peer' + i }; } };
    });
    return { empty: false, size: docs.length, forEach(f) { docs.forEach(f); } };
}

function loadMessaging(auth) {
    const dom = fakeDom();
    const queries = [];
    const d = { get: () => Promise.resolve({ exists: false, data: () => ({}) }), set: () => Promise.resolve(), update: () => Promise.resolve(), onSnapshot: () => function () {}, collection: () => q };
    const q = { doc() { return d; }, add: () => Promise.resolve(), onSnapshot: () => function () {}, where() { return q; }, orderBy() { return q; }, limit() { return q; }, get() { queries.push(1); return Promise.resolve(convoSnap(auth.currentUser ? auth.currentUser.uid : 'me')); } };
    const ctx = { console: { log() {}, error() {}, warn() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, document: dom.document, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, navigator: {}, location: { hash: '' }, addEventListener() {}, removeEventListener() {},
        escapeHtml: s => String(s), timeAgo: () => '1m', auth: auth, db: { collection() { return q; } } };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(messaging, ctx);
    return { ctx, dom, queries };
}
const tick = () => new Promise(r => setTimeout(r, 0));
const pending = [];

test('the hub DMs tab renders the inbox inside the tab, not as a popup', () => {
    const auth = { currentUser: { uid: 'me', isAnonymous: false }, onAuthStateChanged() { throw new Error('not needed'); } };
    const m = loadMessaging(auth);
    assert.strictEqual(typeof m.ctx._renderInboxInto, 'function');
    const box = m.dom.El('dmTabContainer'); m.dom.els.dmTabContainer = box;
    m.ctx._renderInboxInto(box);
    assert.ok(box.innerHTML.indexOf('id="dmTabInboxList"') !== -1);
    assert.strictEqual(m.dom.document.getElementById('dmInbox'), null, 'no popup');
    pending.push(tick().then(tick).then(() => {
        const list = m.dom.els.dmTabInboxList;
        assert.ok(list && /data-uid="peer1"/.test(list.innerHTML) && /data-uid="peer2"/.test(list.innerHTML), 'rows rendered in the tab');
        assert.ok(list.innerHTML.indexOf("var _ib=document.getElementById('dmInbox');if(_ib)_ib.remove();openDM(") !== -1, 'row tap works without the popup');
    }));
});

test('a fresh /#dms load waits for auth to restore the session', () => {
    let cb = null, unsubbed = false;
    const auth = { currentUser: null, onAuthStateChanged(f) { cb = f; return function () { unsubbed = true; }; } };
    const m = loadMessaging(auth);
    const box = m.dom.El('dmTabContainer'); m.dom.els.dmTabContainer = box;
    m.ctx._renderInboxInto(box);
    assert.ok(/Loading/.test(box.innerHTML));
    assert.strictEqual(m.queries.length, 0, 'no query before auth');
    assert.strictEqual(typeof cb, 'function');
    auth.currentUser = { uid: 'me', isAnonymous: false };
    cb(auth.currentUser);
    assert.ok(unsubbed, 'listener removed once signed in');
    assert.ok(box.innerHTML.indexOf('id="dmTabInboxList"') !== -1);
    assert.strictEqual(m.queries.length, 1);
});

test('a guest sees a sign-in line in the tab', () => {
    let cb = null;
    const auth = { currentUser: null, onAuthStateChanged(f) { cb = f; return function () {}; } };
    const m = loadMessaging(auth);
    const box = m.dom.El('dmTabContainer');
    m.ctx._renderInboxInto(box);
    cb({ uid: 'anon', isAnonymous: true });
    assert.ok(/Sign in to see messages/.test(box.innerHTML));
    assert.strictEqual(m.queries.length, 0);
});

test('the inbox popup still loads through the shared list loader', () => {
    assert.ok(messaging.includes("    _loadInboxList('dmInboxList', myUid);\n};"));
    assert.ok(/function _loadInboxList\(listId, myUid\) \{/.test(messaging));
    assert.ok(!/getElementById\('dmInboxList'\)/.test(messaging.slice(messaging.indexOf('function _loadInboxList'))), 'loader uses listId');
});

test("renderChatHub('announcements') opens GGs, not DMs", () => {
    const start = chat.indexOf('window.renderChatHub = function(initialTab) {');
    const end = chat.indexOf('\n};\n', start);
    assert.ok(start !== -1 && end > start);
    const calls = [];
    const el = () => ({ classList: { add() {} }, style: {}, innerHTML: '' });
    const els = { forumContainer: el(), home: el(), hero: el(), msgs: el() };
    const ctx = { document: { getElementById: id => els[id] || null }, history: { pushState() {} }, bqChatFeature: () => true,
        renderGlobalChat: () => calls.push('global'), renderAnnouncementsTab: () => calls.push('announcements'), renderDMsTab: () => calls.push('dms'), _chatTab: 'global' };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(chat.slice(start, end + 3), ctx);
    ['announcements', 'dms', 'global', undefined].forEach(t => ctx.window.renderChatHub(t));
    assert.deepStrictEqual(calls, ['announcements', 'dms', 'global', 'global']);
});

test('the bundle carries the messaging change', () => {
    assert.ok(bundle.includes('window._renderInboxInto = function(container) {'));
    assert.ok(bundle.includes("function _loadInboxList(listId, myUid) {"));
});

if (!pending.length) pending.push(Promise.reject(new Error('tab test did not reach the query')));
Promise.all(pending).then(() => { passed++; console.log('✅ tab rows render after the query resolves'); }, e => { failed++; console.log('❌ tab rows render after the query resolves: ' + e.message); })
    .then(() => { console.log(passed + ' passed, ' + failed + ' failed'); process.exit(failed ? 1 : 0); });
