#!/usr/bin/env node
// N3/N4: Firestore doc ids and uids are attacker-chosen strings. Global chat,
// the forum, article comments and profile links must render them inert, and
// handlers must get the exact raw value back from data-* attributes.
// Loads utils.js AND nacho-qa.js (which redefines the global escapeHtml and
// sanitizeUrl) before the renderers, like the live page does after ~1-3 s,
// and checks normal links with & are not double-escaped.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = process.env.BQ_ROOT || path.join(__dirname, '..');
const { JSDOM } = require(path.join(__dirname, 'rules', 'node_modules', 'jsdom'));

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push([name, fn]); }

const P1 = 'x"><img src=x id=pwn1 onerror=window.__pwn=1>';
const P2 = "a'),window.__pwn=2,('";
const P3 = "q`'\"<b id=pwn3>&amp;";
const LN = 'ln:02' + 'ab'.repeat(32) + '"><img src=x id=pwn4 onerror=window.__pwn=4>';
const STORAGE = 'https://firebasestorage.googleapis.com/v0/b/demo.firebasestorage.app/o/chat%2Fa.png?alt=media&token=abc-123';
const LINK = 'https://example.com/path?a=1&b=2';

function fakeDb(docsByCollection) {
    function snapOf(list) {
        const docs = list.map(function (d) { return { id: d.id, data: function () { return d.data; }, exists: true }; });
        return { empty: docs.length === 0, size: docs.length, docs: docs, forEach: function (f) { docs.forEach(f); } };
    }
    function query(col) {
        const q = {
            where: function () { return q; }, orderBy: function () { return q; }, limit: function () { return q; },
            startAfter: function () { return q; },
            get: function () { return Promise.resolve(snapOf(docsByCollection[col] || [])); },
            onSnapshot: function () { return function () {}; },
            doc: function (id) {
                return {
                    get: function () { const d = (docsByCollection[col] || []).find(function (x) { return x.id === id; }); return Promise.resolve({ exists: !!d, id: id, data: function () { return d && d.data; } }); },
                    update: function () { return Promise.resolve(); }, set: function () { return Promise.resolve(); },
                    delete: function () { return Promise.resolve(); }, collection: function () { return query('sub'); },
                    onSnapshot: function () { return function () {}; },
                };
            },
            add: function () { return Promise.resolve({ id: 'AAAAAAAAAAAAAAAAAAAA' }); },
        };
        return q;
    }
    return { collection: query, batch: function () { return { delete: function () {}, update: function () {}, set: function () {}, commit: function () { return Promise.resolve(); } }; } };
}

function makeWindow(docs, opts) {
    opts = opts || {};
    const dom = new JSDOM('<!doctype html><html><body><div id="globalChatMessages"></div><div id="forumReplies"></div><div id="articleReplies"></div><div id="forumPosts"></div><div id="beatsTrackList"></div></body></html>',
        { url: 'https://bitcoineducation.quest/', runScripts: 'dangerously', pretendToBeVisual: true });
    const w = dom.window;
    const errors = [];
    w.addEventListener('error', function (e) { errors.push(String(e.message || e.error)); });
    w.firebase = {
        firestore: Object.assign(function () { return w.db; }, { FieldValue: { serverTimestamp: function () { return 0; }, increment: function () { return 0; }, arrayUnion: function () { return 0; }, arrayRemove: function () { return 0; }, delete: function () { return 0; } }, Timestamp: { now: function () { return { toMillis: function () { return Date.now(); } }; } } }),
        auth: function () { return w.auth; },
    };
    w.db = fakeDb(docs || {});
    w.auth = { currentUser: { uid: 'viewer', isAnonymous: false }, onAuthStateChanged: function () {} };
    w.currentUser = { uid: 'viewer', username: 'viewer', points: 0 };
    w._isAdminClaim = true;
    w.__pwn = 0;
    // global-chat.js and forum.js are IIFEs. For the test only, hand the
    // internal renderers out just before each IIFE closes.
    const EXPORTS = {
        'global-chat.js': { close: /^\}\(\);$/m, names: ['renderChatMessages'] },
        'forum.js': { close: /^\}\)\(\);\s*$/m, names: ['forumLoadReplies', 'articleLoadReplies', 'forumRenderPosts'] },
    };
    function load(file) {
        let src = fs.readFileSync(path.join(root, file), 'utf8');
        const ex = EXPORTS[file];
        if (ex) {
            const m = ex.close.exec(src);
            assert.ok(m, file + ': IIFE end not found');
            const hook = ex.names.map(function (n) { return 'window.__t.' + n + ' = ' + n + ';'; }).join('\n') + '\n';
            src = src.slice(0, m.index) + hook + src.slice(m.index);
        }
        try { w.eval(src + '\n//# sourceURL=' + file); } catch (e) { errors.push(file + ': ' + e.message); }
    }
    w.__t = {};
    load('utils.js');
    load('nacho-qa.js');      // the lazy global escapeHtml/sanitizeUrl override
    load('global-chat.js');
    load('forum.js');
    if (opts.beats) load('beats.js');
    w.__real = { showReactPicker: w.showReactPicker, beatsShowTrackDetail: w.beatsShowTrackDetail, beatsLoadTracks: w.beatsLoadTracks };
    // spies for the click handlers
    w.__calls = [];
    ['deleteChatMsg', 'pinChatMessage', 'editChatMsg', 'toggleReaction', 'showReactPicker', 'showUserProfile',
        'showTipOverlay', 'forumViewPost', 'forumVotePost', 'forumDeletePost', 'forumVoteReply', 'forumDeleteReply',
        'forumReplyToReply', 'articleReplyToComment', 'articleView', '_toggleAnnouncementReaction', '_showAnnReactPicker', '_toggleGgParty',
        'beatsShowComments', 'beatsToggleLike', 'beatsAddToPlaylistPicker', 'beatsTrackMenu', 'beatsTipCurrentArtistById', 'beatsShareTrack',
        'beatsShowArtistPage', 'beatsPlayTrack', 'beatsShowTrackDetail'].forEach(function (n) {
        w[n] = function () { w.__calls.push([n].concat(Array.prototype.slice.call(arguments))); };
    });
    return { w: w, errors: errors };
}

function noInjection(w, where) {
    ['pwn1', 'pwn3', 'pwn4'].forEach(function (id) {
        assert.strictEqual(w.document.getElementById(id), null, where + ': injected element #' + id);
    });
    assert.strictEqual(w.document.querySelectorAll('img[src="x"]').length, 0, where + ': injected img');
    assert.strictEqual(w.__pwn, 0, where + ': handler code ran');
}
function clickAll(w, root, sel) {
    w.__calls.length = 0;
    root.querySelectorAll(sel).forEach(function (el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); });
    return w.__calls.slice();
}

test('nacho-qa.js really overrides the global escapeHtml (the double-escape trap)', function () {
    const { w } = makeWindow();
    assert.ok(/&#039;/.test(w.escapeHtml("'")), 'nacho-qa escapeHtml should be the active global');
    assert.strictEqual(w.sanitizeUrl(LINK), LINK.replace(/&/g, '&amp;'), 'nacho-qa sanitizeUrl already escapes');
});

test('global chat: payload message ids and uids render inert, handlers get the raw id', function () {
    const { w, errors } = makeWindow();
    const msgs = [
        { _id: P1, uid: LN, name: 'mallory', text: 'hi ' + LINK, ts: Date.now(), reactions: { '🔥': ['viewer'] } },
        { _id: P2, uid: 'viewer', name: 'viewer', text: "own \\' text", ts: Date.now() },
        { _id: P3, uid: 'u3', name: 'carol', text: 'photo', imageUrl: STORAGE, ts: Date.now() },
    ];
    w.__t.renderChatMessages(msgs);
    const el = w.document.getElementById('globalChatMessages');
    assert.ok(el.innerHTML.length > 100, 'nothing rendered: ' + errors.join(' | '));
    noInjection(w, 'chat');
    const rows = el.querySelectorAll('[data-msg-id]');
    assert.deepStrictEqual(Array.prototype.map.call(rows, function (r) { return r.getAttribute('data-msg-id'); }), [P1, P2, P3]);
    const calls = clickAll(w, el, '[onclick]');
    noInjection(w, 'chat after clicks');
    function got(name) { return calls.filter(function (c) { return c[0] === name; }); }
    assert.deepStrictEqual(got('deleteChatMsg').map(function (c) { return c[1]; }), [P1, P2, P3]);
    // pin is not offered on photo messages
    assert.deepStrictEqual(got('pinChatMessage').map(function (c) { return c[1]; }), [P1, P2]);
    assert.deepStrictEqual(got('editChatMsg'), [['editChatMsg', P2, "own \\' text"]]);
    assert.deepStrictEqual(got('toggleReaction'), [['toggleReaction', P1, '🔥']]);
    assert.ok(got('showReactPicker').some(function (c) { return c[1] === P1; }));
    assert.ok(got('showUserProfile').some(function (c) { return c[1] === LN; }), 'profile click must pass the raw uid');
    // normal links and Storage photos keep their & intact
    const img = el.querySelector('img[src^="https://firebasestorage"]');
    assert.ok(img, 'storage image missing');
    assert.strictEqual(img.getAttribute('src'), STORAGE);
    const a = Array.prototype.find.call(el.querySelectorAll('a[href]'), function (x) { return x.getAttribute('href').indexOf('example.com') !== -1; });
    assert.ok(a, 'chat link missing');
    assert.strictEqual(a.getAttribute('href'), LINK);
});

test('global chat react picker passes the raw message id', function () {
    const { w } = makeWindow();
    const btn = w.document.createElement('button'); w.document.body.appendChild(btn);
    w.__real.showReactPicker(P1, btn);
    const picker = w.document.getElementById('reactPicker');
    assert.ok(picker, 'picker not opened');
    noInjection(w, 'picker');
    // the picker fills its grid when a tab is chosen
    picker.querySelector('#reactEmojiTab_0').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    const first = picker.querySelector('#reactEmojiGrid button');
    assert.ok(first, 'no emoji buttons');
    w.__calls.length = 0;
    first.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    const t = w.__calls.filter(function (c) { return c[0] === 'toggleReaction'; });
    assert.strictEqual(t.length, 1);
    assert.strictEqual(t[0][1], P1);
});

test('forum replies: payload ids inert, a stored id field cannot override doc.id, & links intact', async function () {
    const { w } = makeWindow({ forum_replies: [
        { id: P1, data: { postId: 'post1', body: 'see ' + LINK, authorId: LN, authorName: 'm', createdAt: null } },
        { id: 'BBBBBBBBBBBBBBBBBBBB', data: { id: P2, postId: 'post1', body: 'spoof', authorId: 'viewer', authorName: 'v', createdAt: null } },
    ] });
    await w.__t.forumLoadReplies('post1');
    const c = w.document.getElementById('forumReplies');
    assert.ok(c.innerHTML.indexOf('spoof') !== -1, 'replies not rendered: ' + c.innerHTML.slice(0, 200));
    noInjection(w, 'forum replies');
    const ids = Array.prototype.map.call(c.querySelectorAll('[data-reply-id]'), function (b) { return b.getAttribute('data-reply-id'); });
    assert.deepStrictEqual(ids, [P1, 'BBBBBBBBBBBBBBBBBBBB'], 'stored id field must not replace the doc id');
    const calls = clickAll(w, c, '[onclick]');
    noInjection(w, 'forum replies after clicks');
    assert.ok(calls.some(function (x) { return x[0] === 'forumReplyToReply' && x[1] === P1; }));
    assert.ok(calls.some(function (x) { return x[0] === 'forumDeleteReply' && x[1] === P1 && x[2] === 'post1'; }));
    assert.ok(calls.some(function (x) { return x[0] === 'forumVoteReply' && x[1] === 'BBBBBBBBBBBBBBBBBBBB'; }));
    assert.ok(calls.some(function (x) { return x[0] === 'showUserProfile' && x[1] === LN; }));
    assert.ok(!calls.some(function (x) { return x.indexOf(P2) !== -1; }), 'spoofed id reached a handler');
    const a = Array.prototype.find.call(c.querySelectorAll('a[href]'), function (x) { return x.getAttribute('href').indexOf('example.com') !== -1; });
    assert.ok(a, 'reply link missing');
    assert.strictEqual(a.getAttribute('href'), LINK);
});

test('article comments: payload ids inert and handlers get raw ids', async function () {
    const { w } = makeWindow({ article_replies: [
        { id: P1, data: { articleId: 'art1', body: 'nice', authorId: LN, authorName: 'm', createdAt: null } },
        { id: 'CCCCCCCCCCCCCCCCCCCC', data: { id: P3, articleId: 'art1', body: 'two', authorId: 'viewer', authorName: 'v', createdAt: null } },
    ] });
    await w.__t.articleLoadReplies('art1');
    const c = w.document.getElementById('articleReplies');
    assert.ok(c.innerHTML.indexOf('nice') !== -1, 'comments not rendered');
    noInjection(w, 'article comments');
    const ids = Array.prototype.map.call(c.querySelectorAll('[data-rid]'), function (b) { return b.getAttribute('data-rid'); });
    assert.deepStrictEqual(ids, [P1, 'CCCCCCCCCCCCCCCCCCCC']);
    const calls = clickAll(w, c, '[onclick]');
    noInjection(w, 'article comments after clicks');
    assert.ok(calls.some(function (x) { return x[0] === 'articleReplyToComment' && x[1] === P1; }));
    assert.ok(calls.some(function (x) { return x[0] === 'showUserProfile' && x[1] === LN; }));
    assert.ok(!calls.some(function (x) { return x.indexOf(P3) !== -1; }), 'spoofed id reached a handler');
});

test('forum post list: payload post ids and author uids inert', function () {
    const { w } = makeWindow();
    const c = w.document.getElementById('forumPosts');
    w.__t.forumRenderPosts([{ id: P2, title: 'Hello there', body: 'b', authorId: LN, authorName: 'm', createdAt: null, upvotes: 0, voters: [] }], c);
    noInjection(w, 'forum list');
    const calls = clickAll(w, c, '[onclick]');
    noInjection(w, 'forum list after clicks');
    assert.ok(calls.some(function (x) { return x[0] === 'forumViewPost' && x[1] === P2; }), JSON.stringify(calls));
    assert.ok(calls.some(function (x) { return x[0] === 'forumVotePost' && x[1] === P2; }));
    assert.ok(calls.some(function (x) { return x[0] === 'showUserProfile' && x[1] === LN; }));
});

test('beats tracks: payload track ids inert, a stored id field cannot override doc.id', async function () {
    const T = 'TTTTTTTTTTTTTTTTTTTT';
    const { w, errors } = makeWindow({ beats_tracks: [
        { id: P1, data: { title: 'Payload id', artist: 'm', authorId: LN, authorName: 'm', duration: 60, audioUrl: 'https://x/a.mp3', createdAt: null } },
        { id: T, data: { id: P2, title: 'Spoofed stored id', artist: 'v', authorId: 'viewer', authorName: 'v', duration: 60, audioUrl: 'https://x/b.mp3', createdAt: null } },
    ] }, { beats: true });
    assert.strictEqual(typeof w.__real.beatsLoadTracks, 'function', 'beats.js did not load: ' + errors.join(' | '));
    w.__real.beatsLoadTracks('all');
    for (let i = 0; i < 20 && w.document.getElementById('beatsTrackList').innerHTML.indexOf('beats-action-btn') === -1; i++) await new Promise(function (r) { setTimeout(r, 10); });
    const c = w.document.getElementById('beatsTrackList');
    assert.ok(c.innerHTML.indexOf('beats-action-btn') !== -1, 'tracks not rendered: ' + c.innerHTML.slice(0, 200) + ' ' + errors.join(' | '));
    noInjection(w, 'beats list');
    assert.deepStrictEqual(Array.from(w._beatsQueue, function (t) { return t.id; }), [P1, T], 'stored id field must not replace the doc id');
    const calls = clickAll(w, c, '[onclick]');
    noInjection(w, 'beats list after clicks');
    ['beatsShowComments', 'beatsToggleLike', 'beatsAddToPlaylistPicker', 'beatsTrackMenu'].forEach(function (n) {
        assert.ok(calls.some(function (x) { return x[0] === n && x[1] === P1; }), n + ' did not get the raw payload id: ' + JSON.stringify(calls));
        assert.ok(calls.some(function (x) { return x[0] === n && x[1] === T; }), n + ' did not get the real doc id');
    });
    assert.ok(calls.some(function (x) { return x[0] === 'beatsShowArtistPage' && x[1] === LN; }), 'artist click must pass the raw uid');
    assert.ok(!calls.some(function (x) { return x.indexOf(P2) !== -1; }), 'spoofed id reached a handler');
    // the track detail sheet
    w.__real.beatsShowTrackDetail(0);
    const o = w.document.getElementById('beatsDetailOverlay');
    assert.ok(o, 'detail sheet not opened: ' + errors.join(' | '));
    noInjection(w, 'beats detail');
    // most detail buttons close the sheet, so reopen it before each click
    const n = o.querySelectorAll('[onclick]').length;
    const dcalls = [];
    for (let i = 0; i < n; i++) {
        const old = w.document.getElementById('beatsDetailOverlay'); if (old) old.remove();
        w.__real.beatsShowTrackDetail(0);
        const el = w.document.getElementById('beatsDetailOverlay').querySelectorAll('[onclick]')[i];
        w.__calls.length = 0;
        el.dispatchEvent(new w.MouseEvent('click', { bubbles: false }));
        dcalls.push.apply(dcalls, w.__calls);
    }
    noInjection(w, 'beats detail after clicks');
    assert.ok(dcalls.some(function (x) { return x[0] === 'beatsToggleLike' && x[1] === P1; }), JSON.stringify(dcalls));
    assert.ok(dcalls.some(function (x) { return x[0] === 'beatsShowComments' && x[1] === P1; }));
});

test('no renderer splices a doc id or uid into an inline JS string', function () {
    const checks = {
        'global-chat.js': [/showUserProfile\(\\'' ?\+/, /(deleteChatMsg|pinChatMessage|editChatMsg|toggleReaction|showReactPicker)\(\\'' ?\+/, /data-msg-id="' \+ m\._id/],
        'forum.js': [/showUserProfile\(\\'' ?\+/, /(forumViewPost|forumVotePost|forumDeletePost|forumVoteReply|forumDeleteReply|articleView|articleVote|articleDelete|articleEdit)\(\\'' ?\+/, /data-(reply-id|rid)="' \+ r\.id/, /\{ id: doc\.id, \.\.\.doc\.data\(\) \}/],
        'quests.js': [/showUserProfile\(\\'' ?\+/], 'ranking.js': [/showUserProfile\(\\'' ?\+/],
        'beats.js': [/showUserProfile\(\\'' ?\+/, /\(\\'' ?\+ ?(t|track)\.(id|authorId) ?\+/, /Object\.assign\(\{ id: doc\.id \}/, /\{ ?id: ?doc\.id, ?\.\.\./], 'satoshi-favor.js': [/showUserProfile\(\\'' ?\+/],
    };
    Object.keys(checks).forEach(function (f) {
        const src = fs.readFileSync(path.join(root, f), 'utf8');
        checks[f].forEach(function (re) { assert.ok(!re.test(src), f + ' still matches ' + re); });
    });
    const bundle = fs.readFileSync(path.join(root, 'bundle.src.js'), 'utf8');
    assert.ok(bundle.indexOf(fs.readFileSync(path.join(root, 'forum.js'), 'utf8')) !== -1, 'bundle.src.js is stale: rebuild with build.sh');
});

(async function () {
    for (const [name, fn] of queue) {
        try { await fn(); passed++; console.log('  ok  ' + name); }
        catch (e) { failed++; console.log('  FAIL ' + name + ': ' + (e && e.message || e)); }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
