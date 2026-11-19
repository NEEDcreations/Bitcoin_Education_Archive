// Bitcoin Beats track and comment buttons: ids ride in escaped data
// attributes and one capture listener routes clicks. Ids outside the allowed
// pattern never reach a handler, and valid ids still route.
const assert = require('assert');
const vm = require('vm');
const H = require('./helpers-markup.js');

const { test, run } = H.runner();
const SRC = H.read('beats.js');
const ALLOWED = ['style', 'class', 'id', 'title', 'src', 'alt', 'loading', 'onclick', 'onerror', 'onmouseover', 'onmouseout', 'type', 'draggable'];

function load() {
    const els = {};
    const calls = [];
    const docListeners = [];
    function rec(name) { return function() { calls.push([name].concat([].slice.call(arguments).filter(function(a) { return typeof a !== 'object'; }))); }; }
    const sandbox = {
        console: { log: function() {}, error: function() {}, warn: function() {} },
        document: {
            addEventListener: function(type, fn, capture) { docListeners.push([type, fn, capture]); },
            getElementById: function(id) { if (!els[id] && id === 'beatsTrackList') els[id] = H.makeEl(id); return els[id] || null; },
        },
        setTimeout: function(fn) { fn(); return 0; },
        db: {},
        auth: { currentUser: { uid: 'viewer1', isAnonymous: false } },
        escapeHtml: function(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); },
        safeJSON: function(k, d) { return d; },
        beatsSlot: function(s) { return String(s).replace(/[<>"'&]/g, ''); },
        beatsFillText: function() {},
        beatsFormatTime: function() { return '0:00'; },
        _formatPlays: function(n) { return String(n || 0); },
        _safeCover: function() { return ''; },
        _beatsIsHidden: function() { return false; },
        _beatsShowUnavailableNote: function() {},
        beatsShowComments: rec('comments'),
        beatsToggleLike: rec('like'),
        beatsAddToPlaylistPicker: rec('playlist'),
        beatsTrackMenu: rec('menu'),
        beatsTipCurrentArtistById: rec('tip'),
        beatsShareTrack: rec('share'),
        beatsDeleteTrack: rec('deleteTrack'),
        beatsReportTrack: rec('report'),
        beatsDeleteComment: rec('deleteComment'),
        beatsQuickCreateAndAdd: rec('quick'),
        beatsExecuteV4VTip: rec('v4v'),
        beatsLoadTracks: rec('reload'),
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    const code = [
        H.sliceBetween(SRC, 'var BEATS_ID_RE =', "    document.addEventListener('click', beatsOnAction, true);\n}"),
        H.sliceFunction(SRC, 'window.beatsLoadTracks = function('),
    ].join('\n');
    vm.runInContext(code, sandbox, { filename: 'beats.js' });
    sandbox._beatsCollectVisible = function() {
        return { then: function(cb) { cb({ tracks: sandbox._tracks }); return { catch: function() {} }; } };
    };
    return { win: sandbox, els: els, calls: calls, docListeners: docListeners };
}

function tracks() {
    const list = [{ id: 'trackA_1', authorId: 'artist1', title: 'Song', artist: 'Art', plays: 2, likes: 1 }];
    H.ODD_IDS.forEach(function(id, i) { list.push({ id: id, authorId: 'artist' + i, title: 'Odd' + i, artist: H.ODD_NAMES[i % 3], plays: 0 }); });
    return list;
}
function fire(t, attrs) {
    let stopped = false;
    const ev = { target: H.elFrom(attrs), stopPropagation: function() { stopped = true; } };
    t.win._beatsOnAction(ev);
    return stopped;
}

test('one capture listener is registered for track buttons', function() {
    const t = load();
    assert.strictEqual(t.docListeners.length, 1);
    assert.deepStrictEqual([t.docListeners[0][0], t.docListeners[0][2]], ['click', true]);
});

test('track rows keep odd ids inside escaped attributes', function() {
    const t = load();
    t.win._tracks = tracks();
    t.win.beatsLoadTracks('all');
    const html = t.els.beatsTrackList.innerHTML;
    assert.ok(html.indexOf('data-beats-action="like"') !== -1);
    assert.deepStrictEqual(H.strayAttrs(html, ALLOWED), []);
    H.handlerTexts(html).forEach(function(h) { assert.ok(!/MARKQ|trackA_1|artist1/.test(h), h); });
    const ids = H.readTags(html).map(function(x) { return x.attrs['data-id']; }).filter(Boolean);
    assert.ok(ids.indexOf('trackA_1') !== -1);
});

test('valid track ids route and odd ones stop at the check', function() {
    const t = load();
    t.win._tracks = tracks();
    t.win.beatsLoadTracks('all');
    const tags = H.readTags(t.els.beatsTrackList.innerHTML);
    tags.filter(function(x) { return x.attrs['data-beats-action']; }).forEach(function(x) { fire(t, x.attrs); });
    const valid = t.calls.filter(function(c) { return c[1] === 'trackA_1' || c[2] === 'trackA_1'; });
    assert.ok(valid.length >= 4, JSON.stringify(t.calls));
    t.calls.forEach(function(c) { c.slice(1).forEach(function(v) { assert.ok(typeof v !== 'string' || H.ID_RE.test(v), v); }); });
    assert.deepStrictEqual(t.calls.find(function(c) { return c[0] === 'menu'; }), ['menu', 'trackA_1', 0]);
});

test('every action rejects odd ids and still stops row clicks', function() {
    const t = load();
    const acts = ['artist', 'artist-detail', 'comments', 'comments-detail', 'like', 'like-detail', 'playlist-pick', 'playlist-pick-menu', 'menu', 'tip', 'tip-detail',
        'share', 'delete-track', 'report-track', 'delete-comment', 'quick-playlist', 'v4v-tip'];
    acts.forEach(function(a) {
        H.ODD_IDS.forEach(function(id) { fire(t, { 'data-beats-action': a, 'data-id': id, 'data-idx': '0' }); });
    });
    fire(t, { 'data-beats-action': 'tip', 'data-id': 'trackA_1', 'data-author': H.ODD_IDS[2] });
    fire(t, { 'data-beats-action': 'delete-comment', 'data-id': 'trackA_1', 'data-comment': H.ODD_IDS[1] });
    fire(t, { 'data-beats-action': 'constructor', 'data-id': 'trackA_1' });
    assert.deepStrictEqual(t.calls, []);
    assert.strictEqual(fire(t, { 'data-beats-action': 'like', 'data-id': H.ODD_IDS[0] }), true);
});

test('valid ids reach each action with the right arguments', function() {
    const t = load();
    t.win.beatsLoadTracks = function() { t.calls.push(['reload']); };
    fire(t, { 'data-beats-action': 'tip-detail', 'data-id': 'trackA_1', 'data-author': 'artist1' });
    fire(t, { 'data-beats-action': 'delete-comment', 'data-id': 'trackA_1', 'data-comment': 'comment_9' });
    fire(t, { 'data-beats-action': 'v4v-tip', 'data-id': 'tdforum_coin_mixing_coinjoin_coin_control_utxo_AbCdEfGhIjKlMnOpQrSt' });
    fire(t, { 'data-beats-action': 'like-detail', 'data-id': 'trackA_1' });
    assert.deepStrictEqual(t.calls, [
        ['tip', 'artist1', 'trackA_1'],
        ['deleteComment', 'trackA_1', 'comment_9'],
        ['v4v', 'tdforum_coin_mixing_coinjoin_coin_control_utxo_AbCdEfGhIjKlMnOpQrSt'],
        ['like', 'trackA_1'],
        ['reload'],
    ]);
});

test('track and comment ids no longer ride in handler text', function() {
    assert.ok(!/on[a-z]+="[^"]*\\'' \+ (t|track)\.id \+ '\\'/.test(SRC.replace(/beatsEditTrack\(\\'' \+ t\.id/g, '')));
    assert.ok(!/beatsDeleteComment\(\\'' \+/.test(SRC));
    assert.ok(!/beatsExecuteV4VTip\(\\'' \+/.test(SRC));
});

run();
