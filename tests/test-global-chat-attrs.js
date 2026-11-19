// Global chat rows, the DM list and the DJ bar use data attributes and one
// delegated click listener per container. Ids outside the allowed pattern are
// skipped, names never ride in handler text, and valid ids still route.
const assert = require('assert');
const vm = require('vm');
const H = require('./helpers-markup.js');

const { test, run } = H.runner();
const SRC = H.read('global-chat.js');

const ALLOWED = ['style', 'class', 'id', 'title', 'src', 'loading', 'onclick', 'onerror', 'onmouseover', 'onmouseout',
    'onmouseenter', 'onmouseleave', 'ontouchstart', 'ontouchend', 'autoplay', 'loop', 'muted', 'playsinline', 'datetime'];

function load() {
    const els = {};
    const calls = [];
    function rec(name) { return function() { calls.push([name].concat([].slice.call(arguments).filter(function(a) { return typeof a !== 'object' || a === null || !a.getAttribute; }))); }; }
    const document = {
        getElementById: function(id) {
            if (id === 'chatPinnedBanner') return null;
            if (!els[id] && (id === 'globalChatMessages' || id === 'djNowPlaying' || id === 'overlayDMsBody')) els[id] = H.makeEl(id);
            return els[id] || null;
        },
        createElement: function() { return H.makeEl(''); },
    };
    const sandbox = {
        document: document,
        console: console,
        setTimeout: function(fn) { if (typeof fn === 'function') fn(); return 0; },
        auth: { currentUser: { uid: 'viewer1' } },
        CHAT_INITIAL_SHOW: 50,
        DJ_MAX_SONGS_WITH_QUEUE: 5,
        _djListening: false,
        _djQueuePosition: 0,
        _chatUsers: {},
        IMG_REGEX: /^https:\/\/x\.invalid\//,
        bqSkipAnnouncement: function() { return false; },
        timeAgo: function() { return 'now'; },
        formatChatText: function(s) { return s; },
        showUserProfile: rec('profile'),
        toggleReaction: rec('react'),
        showReactPicker: rec('pick'),
        editChatMsg: rec('edit'),
        pinChatMessage: rec('pin'),
        deleteChatMsg: rec('del'),
        showTipOverlay: function(o) { calls.push(['tip', o.recipientUid, o.recipientName]); },
        toggleChatOverlay: rec('overlay'),
        openDM: rec('dm'),
    };
    sandbox.window = sandbox;
    sandbox._isAdminClaim = true;
    sandbox._factionNameStyle = function() { return 'color:red'; };
    vm.createContext(sandbox);
    const code = [
        H.sliceFunction(SRC, 'function esc('),
        H.sliceBetween(SRC, 'var GC_ID_RE =', 'window._gcBindActions = gcBindActions;'),
        H.sliceFunction(SRC, 'function renderChatMessages('),
        H.sliceFunction(SRC, 'function showDJBar('),
    ].join('\n');
    vm.runInContext(code, sandbox, { filename: 'global-chat.js' });
    return { win: sandbox, els: els, calls: calls };
}

function msgs() {
    const list = [
        { _id: 'msgA_1', uid: 'user2', name: 'Bea', text: 'hello', reactions: { '👍': ['user3'] } },
        { _id: 'tdforum_coin_mixing_coinjoin_coin_control_utxo_AbCdEfGhIjKlMnOpQrSt', uid: 'nacho-bot', name: 'Nacho', text: 'mirror' },
        { _id: 'mine1', uid: 'viewer1', name: 'Me', text: "it's mine" },
    ];
    H.ODD_IDS.forEach(function(id, i) { list.push({ _id: id, uid: 'user' + (10 + i), name: 'Odd' + i, text: 'odd ' + i, reactions: { '🔥': ['user3'] } }); });
    H.ODD_NAMES.forEach(function(n, i) { list.push({ _id: 'named' + i, uid: 'user' + (30 + i), name: n, text: 'named ' + i }); });
    return list;
}

test('odd message ids never reach chat markup', function() {
    const t = load();
    t.win.renderChatMessages(msgs());
    const html = t.els.globalChatMessages.innerHTML;
    assert.ok(!/MARKQ[1-8](?!\d)/.test(html), 'odd id text reached the markup');
    assert.deepStrictEqual(H.strayAttrs(html, ALLOWED), []);
    const ids = H.readTags(html).map(function(x) { return x.attrs['data-msg-id']; }).filter(Boolean);
    ids.forEach(function(id) { assert.ok(H.ID_RE.test(id), id); });
    assert.ok(ids.indexOf('msgA_1') !== -1);
    assert.ok(ids.indexOf('tdforum_coin_mixing_coinjoin_coin_control_utxo_AbCdEfGhIjKlMnOpQrSt') !== -1);
});

test('chat handler text carries no ids or names', function() {
    const t = load();
    t.win.renderChatMessages(msgs());
    const html = t.els.globalChatMessages.innerHTML;
    H.handlerTexts(html).forEach(function(h) {
        assert.ok(!/MARKQ|msgA_1|named\d|Bea|toggleReaction|showTipOverlay|deleteChatMsg|pinChatMessage|editChatMsg|showUserProfile/.test(h), h);
    });
    assert.ok(html.indexOf('MARKQ9') !== -1 || html.indexOf('Bob') !== -1, 'names still display as text');
    assert.deepStrictEqual(H.strayAttrs(html, ALLOWED), []);
});

test('valid chat ids route through the listener', function() {
    const t = load();
    t.win.renderChatMessages(msgs());
    const c = t.els.globalChatMessages;
    const tags = H.readTags(c.innerHTML);
    function pick(act, id) { return tags.find(function(x) { return x.attrs['data-gc-action'] === act && x.attrs['data-id'] === id; }); }
    ['react', 'react-pick', 'tip', 'profile'].forEach(function(a) {
        const tag = a === 'profile' ? pick(a, 'user2') : pick(a, 'msgA_1');
        assert.ok(tag, a);
        H.click(c, tag.attrs);
    });
    ['edit', 'pin', 'del'].forEach(function(a) { H.click(c, pick(a, 'mine1').attrs); });
    H.click(c, pick('del', 'msgA_1').attrs);
    H.click(c, pick('tip', 'named0').attrs);
    assert.deepStrictEqual(t.calls, [
        ['react', 'msgA_1', '👍'], ['pick', 'msgA_1'], ['tip', 'user2', 'Bea'], ['profile', 'user2'],
        ['edit', 'mine1', "it's mine"], ['pin', 'mine1'], ['del', 'mine1'], ['del', 'msgA_1'],
        ['tip', 'user30', H.ODD_NAMES[0]],
    ]);
});

test('forged action attributes do not reach a handler', function() {
    const t = load();
    t.win.renderChatMessages(msgs());
    const c = t.els.globalChatMessages;
    H.ODD_IDS.forEach(function(id) {
        ['react', 'del', 'pin', 'edit', 'tip', 'profile', 'dm'].forEach(function(a) { H.click(c, { 'data-gc-action': a, 'data-id': id, 'data-emoji': '👍' }); });
    });
    H.click(c, { 'data-gc-action': 'constructor', 'data-id': 'msgA_1' });
    H.click(c, { 'data-gc-action': '__proto__', 'data-id': 'msgA_1' });
    H.click(c, { 'data-gc-action': 'react', 'data-id': 'msgA_1', 'data-emoji': '"><b>' });
    assert.deepStrictEqual(t.calls, []);
    assert.strictEqual(t.win._gcIdOk('a'.repeat(128)), true);
    assert.strictEqual(t.win._gcIdOk('a'.repeat(129)), false);
});

test('DM list opens by uid and looks the name up', function() {
    const t = load();
    const body = t.win.document.getElementById('overlayDMsBody');
    t.win._gcBindActions(body);
    vm.runInContext("_gcDmNames['userZ9'] = " + JSON.stringify(H.ODD_NAMES[0]) + ';', t.win);
    H.click(body, { 'data-gc-action': 'dm', 'data-id': 'userZ9' });
    H.click(body, { 'data-gc-action': 'dm', 'data-id': H.ODD_IDS[0] });
    assert.deepStrictEqual(t.calls, [['overlay'], ['dm', 'userZ9', H.ODD_NAMES[0]]]);
    const dmRows = SRC.match(/data-gc-action="dm" data-id="' \+ esc\(String\(otherUid\)\) \+ '"/g) || [];
    assert.strictEqual(dmRows.length, 2);
    assert.ok(!/openDM\(\\'' \+ otherUid/.test(SRC));
});

test('DJ bar uses data attributes for the DJ and artist', function() {
    const t = load();
    t.win.showDJBar({ djUid: 'dj1', djName: 'Dee', artistUid: H.ODD_IDS[1], trackArtist: H.ODD_NAMES[1], trackTitle: 't' });
    let html = t.els.djNowPlaying.innerHTML;
    assert.strictEqual(html.indexOf('MARKQ2'), -1);
    assert.ok(!H.readTags(html).some(function(x) { return x.name === 'img' && /MARKQ/.test(x.attrs.src || ''); }));
    assert.deepStrictEqual(H.strayAttrs(html, ALLOWED), []);
    assert.ok(!H.readTags(html).some(function(x) { return x.attrs['data-id'] && !H.ID_RE.test(x.attrs['data-id']); }));
    t.win.showDJBar({ djUid: 'dj1', djName: 'Dee', artistUid: 'artist_1', trackArtist: 'Art', trackTitle: 't' });
    html = t.els.djNowPlaying.innerHTML;
    H.handlerTexts(html).forEach(function(h) { assert.ok(!/artist_1|dj1|showUserProfile/.test(h), h); });
    H.readTags(html).filter(function(x) { return x.attrs['data-gc-action'] === 'profile'; }).forEach(function(x) { H.click(t.els.djNowPlaying, x.attrs); });
    assert.deepStrictEqual(t.calls, [['profile', 'dj1'], ['profile', 'artist_1'], ['profile', 'artist_1']]);
});

test('react picker buttons carry only the emoji', function() {
    const picker = H.sliceFunction(SRC, 'function _reactEmojiBtn(');
    assert.ok(picker.includes('data-react-emoji="'));
    assert.ok(!picker.includes('msgId'));
    assert.ok(!picker.includes('onclick='));
});

run();
