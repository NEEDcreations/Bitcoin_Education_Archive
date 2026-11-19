#!/usr/bin/env node
'use strict';
// Article list and article page (forum.js loadArticles / articleView): stored
// counters, levels, pin state and text fields render as plain values.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const forum = fs.readFileSync(path.join(root, process.env.ARTICLE_DISPLAY_FORUM || 'forum.js'), 'utf8');

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) { queue.push([name, fn]); }

function sliceFrom(src, header) {
    const start = src.indexOf(header);
    if (start < 0) return '';
    let depth = 0;
    for (let i = src.indexOf('{', start + header.length - 1); i < src.length; i++) {
        const c = src[i];
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1) + (src[i + 1] === ';' ? ';' : ''); }
    }
    throw new Error('unclosed ' + header);
}
function lines(prefix) { return forum.split('\n').filter(function (l) { return l.indexOf(prefix) === 0; }).join('\n'); }

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const HOSTILE = '<img src=x onerror=alert(1)>';
const HOSTILE_VALUES = [HOSTILE, '"><svg onload=alert(1)>', { toString: null }, ['<b>x</b>'], { a: '<i>' }, 'NaN', 'Infinity', -5, NaN, Infinity, true];

function load(opts) {
    opts = opts || {};
    const els = {};
    function el(id) { if (!els[id]) els[id] = { id: id, innerHTML: '', scrollTop: 0, style: {} }; return els[id]; }
    const levelCalls = [];
    const ctx = {
        console: { log: function () {}, warn: function () {}, error: function () {} },
        escapeHtml: escapeHtml,
        window: {},
        localStorage: { getItem: function () { return '1'; }, setItem: function () {} },
        setTimeout: function () { return 0; },
        document: { getElementById: el },
        auth: { currentUser: opts.uid ? { uid: opts.uid, isAnonymous: false } : null },
        forumSort: 'recent',
        LEVELS: [{ name: 'A', emoji: 'LV0', min: 0 }, { name: 'B', emoji: 'LV1', min: 10 }, { name: 'C', emoji: 'LVTOP', min: 1000 }],
        articleLoadReplies: function () {},
        tipButtonHtml: function () { return ''; },
    };
    ctx.window = ctx;
    ctx._isAdminClaim = !!opts.admin;
    ctx._factionNameStyle = function () { return ''; };
    ctx.getLevel = function (p) {
        levelCalls.push(p);
        let lv = ctx.LEVELS[0];
        ctx.LEVELS.forEach(function (l) { if (p >= l.min) lv = l; });
        return lv;
    };
    ctx.db = {
        collection: function () {
            return {
                where: function () { return this; }, orderBy: function () { return this; }, limit: function () { return this; },
                get: function () { return Promise.resolve({ forEach: function (cb) { (opts.docs || []).forEach(function (d) { cb({ id: d.id, data: function () { return d; } }); }); } }); },
                doc: function (id) { return { get: function () { const d = (opts.docs || []).find(function (x) { return x.id === id; }); return Promise.resolve({ exists: !!d, data: function () { return Object.assign({}, d); } }); } }; },
            };
        },
    };
    vm.createContext(ctx);
    const fEscLine = forum.split('\n').find(function (l) { return l.indexOf('function fEsc(') === 0; });
    const code = [
        fEscLine,
        lines('var MD_'), lines('var ARTICLE_ID_RE'), lines('var ARTICLE_UID_RE'),
        sliceFrom(forum, 'function isForumAdmin('),
        sliceFrom(forum, 'function forumCount('),
        lines('function forumText('),
        sliceFrom(forum, 'function forumLevel('),
        sliceFrom(forum, 'function articleAuthorIsAdmin('),
        lines('function articlePinShown('),
        sliceFrom(forum, 'function articleTipTotal('),
        lines('function articleImgUrl('),
        sliceFrom(forum, 'function mdUnescape('),
        sliceFrom(forum, 'function mdSafeUrl('),
        sliceFrom(forum, 'function forumRenderMentions('),
        sliceFrom(forum, 'function mdToHtml('),
        sliceFrom(forum, 'async function loadArticles('),
        sliceFrom(forum, 'window.articleView = async function('),
        'this.loadArticles = loadArticles;',
    ].join('\n');
    vm.runInContext(code, ctx, { filename: 'forum.js' });
    return { ctx: ctx, els: els, levelCalls: levelCalls };
}

function article(over) {
    return Object.assign({
        id: 'artA_1', title: 'A real article title', subtitle: 'Sub', body: 'Hello **world**', authorId: 'author1', authorName: 'Alice',
        status: 'published', upvotes: 3, replyCount: 2, tipTotal: 21, wordCount: 600, readTime: 3, authorPoints: 50, tags: ['btc'],
    }, over || {});
}

async function renderList(docs, opts) {
    const t = load(Object.assign({ docs: docs }, opts || {}));
    t.els.articlesList = { innerHTML: '' };
    t.ctx.document.getElementById = function (id) { if (id === 'articlesList') return t.els.articlesList; return null; };
    await t.ctx.loadArticles();
    return { html: t.els.articlesList.innerHTML, t: t };
}
async function renderView(doc, opts) {
    const t = load(Object.assign({ docs: [doc] }, opts || {}));
    const fc = { innerHTML: '' };
    t.ctx.document.getElementById = function (id) { if (id === 'forumContainer') return fc; if (id === 'main') return { scrollTop: 0 }; return null; };
    await t.ctx.articleView(doc.id);
    return { html: fc.innerHTML, t: t };
}

// Raw start tags other than the ones the renderer itself writes.
function injected(html) {
    const out = [];
    const re = /<([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
    let m;
    while ((m = re.exec(html))) {
        const name = m[1].toLowerCase();
        if (['div', 'span', 'h1', 'h3', 'button', 'strong', 'p', 'img', 'a', 'textarea', 'br', 'em', 'code'].indexOf(name) === -1) out.push(m[0]);
        if (/\son(?!click=|mouseover=|mouseout=)[a-z]+=/i.test(m[2])) out.push(m[0]);
        if (name === 'img' && !/^\s+src="(https:\/\/|data:image\/)/.test(m[2])) out.push(m[0]);
    }
    return out;
}

['upvotes', 'tipTotal', 'wordCount', 'readTime', 'authorPoints', 'replyCount'].forEach(function (field) {
    test('list shows plain values for odd ' + field, async function () {
        const docs = HOSTILE_VALUES.map(function (v, i) { const o = {}; o[field] = v; return article(Object.assign({ id: 'art_' + i }, o)); });
        const r = await renderList(docs);
        assert.ok(r.html.indexOf('A real article title') !== -1, 'list rendered');
        assert.deepStrictEqual(injected(r.html), []);
        assert.ok(r.html.indexOf('onerror') === -1 && r.html.indexOf('onload') === -1);
        if (field === 'upvotes') assert.strictEqual((r.html.match(/👍 0</g) || []).length, HOSTILE_VALUES.length);
    });
    test('article page shows plain values for odd ' + field, async function () {
        for (const v of HOSTILE_VALUES) {
            const o = {}; o[field] = v;
            const r = await renderView(article(o), { uid: 'viewer9' });
            assert.ok(r.html.indexOf('A real article title') !== -1, 'view rendered for ' + String(v && v.toString ? v : typeof v));
            assert.deepStrictEqual(injected(r.html), []);
            assert.ok(r.html.indexOf('onerror') === -1 && r.html.indexOf('onload') === -1);
        }
    });
});

test('counters render as whole numbers and tips only when a positive number', async function () {
    const r = await renderList([article({ upvotes: '7', tipTotal: '50', wordCount: 'x' }), article({ id: 'artB', upvotes: 4.9, tipTotal: 0 }), article({ id: 'artC', tipTotal: 33 })]);
    assert.ok(r.html.indexOf('👍 7<') !== -1);
    assert.ok(r.html.indexOf('👍 4<') !== -1);
    assert.strictEqual((r.html.match(/⚡ /g) || []).length, 1);
    assert.ok(r.html.indexOf('⚡ 33 sats') !== -1);
    const v = await renderView(article({ wordCount: HOSTILE }));
    assert.ok(v.html.indexOf(' 0 words') !== -1);
});

test('author level comes from a clamped whole number', async function () {
    const r = await renderList([article({ authorPoints: 1e15 }), article({ id: 'b', authorPoints: '<b>' }), article({ id: 'c', authorPoints: -3 }), article({ id: 'd', authorPoints: 12.7 })]);
    r.t.levelCalls.forEach(function (p) { assert.ok(Number.isInteger(p) && p >= 0 && p <= 1000, String(p)); });
    assert.deepStrictEqual(r.t.levelCalls, [1000, 0, 0, 12]);
});

test('the pin badge needs a real boolean and an admin author', async function () {
    const fakes = [true, 'true', 1, { x: 1 }, ['y']];
    const list = await renderList(fakes.map(function (p, i) { return article({ id: 'p' + i, pinned: p }); }), { uid: 'viewer9' });
    assert.strictEqual(list.html.indexOf('PINNED'), -1);
    const asAuthorNotAdmin = await renderList([article({ pinned: true, authorId: 'viewer9' })], { uid: 'viewer9' });
    assert.strictEqual(asAuthorNotAdmin.html.indexOf('PINNED'), -1);
    const otherAdminViewer = await renderList([article({ pinned: true, authorId: 'author1' })], { uid: 'admin1', admin: true });
    assert.strictEqual(otherAdminViewer.html.indexOf('PINNED'), -1);
    const adminAuthor = await renderList([article({ pinned: true, authorId: 'admin1' }), article({ id: 'q', pinned: 'true', authorId: 'admin1' })], { uid: 'admin1', admin: true });
    assert.strictEqual((adminAuthor.html.match(/PINNED/g) || []).length, 1);
});

test('text fields, tags, cover and author picture stay inside text or a checked URL', async function () {
    const r = await renderList([article({ title: HOSTILE, subtitle: { a: HOSTILE }, authorName: [HOSTILE], tags: HOSTILE, coverUrl: 'https://x.example/a.png) ;background:url(javascript:x' }),
        article({ id: 'b', tags: [HOSTILE, { t: HOSTILE }], coverUrl: 'javascript:alert(1)' })]);
    assert.deepStrictEqual(injected(r.html), []);
    assert.ok(r.html.indexOf('url(javascript') === -1 && r.html.indexOf('javascript:') === -1);
    const v = await renderView(article({ title: HOSTILE, authorPic: 'javascript:alert(1)', coverUrl: '" onerror="x()', authorId: "a');alert(1);//" }));
    assert.deepStrictEqual(injected(v.html), []);
    assert.ok(v.html.indexOf('alert(1);//') === -1);
});

test('odd article ids are skipped in the list and refused on the page', async function () {
    const r = await renderList([article({ id: "x');alert(1);//" }), article({ id: 'okId_2', title: 'Second real title here' })]);
    assert.ok(r.html.indexOf('alert(1)') === -1);
    assert.ok(r.html.indexOf('Second real title here') !== -1);
    const v = await renderView(article({ id: "y');alert(1);//" }));
    assert.ok(v.html.indexOf('alert(1)') === -1);
});

(async function () {
    for (const [name, fn] of queue) {
        try { await fn(); console.log('✅ ' + name); passed++; }
        catch (e) { console.log('❌ ' + name + ': ' + (e && e.message)); failed++; }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
