#!/usr/bin/env node
'use strict';
// Article submit (forum.js articleSubmit): author name, points, picture and
// cover URL are stored as a short string, a whole non-negative number, or an
// allowed URL. articleUpdate is checked for the same cover rule and for not
// rewriting author fields.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const forumFile = process.env.ARTICLE_SUBMIT_FORUM
    ? (path.isAbsolute(process.env.ARTICLE_SUBMIT_FORUM) ? process.env.ARTICLE_SUBMIT_FORUM : path.join(root, process.env.ARTICLE_SUBMIT_FORUM))
    : path.join(root, 'forum.js');
const forum = fs.readFileSync(forumFile, 'utf8');

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

const BODY = Array(500).fill('word').join(' ');
const HTTPS_PIC = 'https://example.com/pic.jpg';
const HTTPS_COVER = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/articles%2Fuid%2F1_cover?alt=media&token=abc';
const DATA_JPEG = 'data:image/jpeg;base64,QUJDRA==';
const DATA_PNG = 'data:image/png;base64,abc';
const DATA_WEBP = 'data:image/webp;base64,ab==';
const DATA_GIF = 'data:image/gif;base64,AAAA';
const DATA_LONG = 'data:image/jpeg;base64,' + 'A'.repeat(20000);
const HTTPS_LONG = 'https://' + 'a'.repeat(2041); // 8 + 2041 = 2049
const HTTPS_MAX = 'https://' + 'a'.repeat(2040); // 2048

function load(opts) {
    opts = opts || {};
    const added = [];
    const updates = [];
    const els = {
        articleStatus: { innerHTML: '' },
        articleTitle: { value: 'A valid article title here' },
        articleSubtitle: { value: 'Sub' },
        articleBody: { value: BODY },
        articleTerms: { checked: true },
        articleCover: { files: opts.coverReturn ? [{ size: 100 }] : [] },
    };
    const tagBtn = { style: { color: 'var(--accent)' }, getAttribute: function () { return 'Bitcoin Basics'; } };
    const ctx = {
        console: { log: function () {}, warn: function () {}, error: function () {} },
        window: {},
        localStorage: { getItem: function () { return '0'; }, setItem: function () {}, removeItem: function () {} },
        document: {
            getElementById: function (id) { return els[id] || null; },
            querySelectorAll: function () { return [tagBtn]; },
        },
        auth: { currentUser: { uid: 'author1', isAnonymous: false } },
        currentUser: Object.assign({ username: 'Alice', points: 12, profilePic: '' }, opts.user || {}),
        isCleanText: function () { return true; },
        awardTickets: function () {},
        showToast: function () {},
        renderForum: function () {},
        articleView: function () {},
        forumTab: 'articles',
        firebase: {
            firestore: { FieldValue: { serverTimestamp: function () { return 'TS'; } } },
            storage: function () {
                return {
                    ref: function () {
                        return {
                            put: function () {
                                return Promise.resolve({
                                    ref: { getDownloadURL: function () { return Promise.resolve(opts.coverReturn); } },
                                });
                            },
                        };
                    },
                };
            },
        },
        db: {
            collection: function () {
                return {
                    add: function (data) { added.push(data); return Promise.resolve({ id: 'new1' }); },
                    doc: function () {
                        return { update: function (data) { updates.push(data); return Promise.resolve(); } };
                    },
                };
            },
        },
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    const code = [
        sliceFrom(forum, 'function articleAuthorPic('),
        sliceFrom(forum, 'function articleAuthorPoints('),
        sliceFrom(forum, 'function articleAuthorName('),
        sliceFrom(forum, 'function articleCoverUrl('),
        sliceFrom(forum, 'window.articleSubmit = async function('),
        sliceFrom(forum, 'window.articleUpdate = async function('),
    ].join('\n');
    assert.ok(code.indexOf('window.articleSubmit') !== -1, 'articleSubmit present');
    vm.runInContext(code, ctx, { filename: 'forum.js' });
    return { ctx: ctx, added: added, updates: updates, els: els };
}

async function submit(opts) {
    const t = load(opts);
    t.ctx._articleSubmitting = false;
    await t.ctx.articleSubmit();
    return t;
}

async function update(opts) {
    const t = load(opts);
    t.ctx._articleEditId = 'artA_1';
    await t.ctx.articleUpdate();
    return t;
}

test('authorPic keeps an empty string, an https URL, and an allowed data image', async function () {
    const empty = await submit({ user: { profilePic: '' } });
    assert.strictEqual(empty.added.length, 1);
    assert.strictEqual(empty.added[0].authorPic, '');
    const https = await submit({ user: { profilePic: HTTPS_PIC } });
    assert.strictEqual(https.added[0].authorPic, HTTPS_PIC);
    const atMax = await submit({ user: { profilePic: HTTPS_MAX } });
    assert.strictEqual(atMax.added[0].authorPic, HTTPS_MAX);
    const jpeg = await submit({ user: { profilePic: DATA_JPEG } });
    assert.strictEqual(jpeg.added[0].authorPic, DATA_JPEG);
    const png = await submit({ user: { profilePic: DATA_PNG } });
    assert.strictEqual(png.added[0].authorPic, DATA_PNG);
    const webp = await submit({ user: { profilePic: DATA_WEBP } });
    assert.strictEqual(webp.added[0].authorPic, DATA_WEBP);
});

test('authorPic is blank for a gif, an http URL, or a value that is too long', async function () {
    const cases = [
        DATA_GIF,
        'http://example.com/pic.jpg',
        DATA_LONG,
        HTTPS_LONG,
        { toString: 'x' },
        ['https://example.com/pic.jpg'],
        null,
    ];
    for (let i = 0; i < cases.length; i++) {
        const r = await submit({ user: { profilePic: cases[i] } });
        assert.strictEqual(r.added.length, 1, 'case ' + i);
        assert.strictEqual(r.added[0].authorPic, '', 'pic should be blank for case ' + i);
    }
});

test('authorPoints is a whole non-negative number', async function () {
    const rows = [
        [12, 12],
        [12.7, 12],
        [-5, 0],
        [NaN, 0],
        ['20', 20],
        ['8.9', 8],
        [0, 0],
        [undefined, 0],
    ];
    for (const [pts, want] of rows) {
        const r = await submit({ user: { points: pts } });
        assert.strictEqual(r.added.length, 1, String(pts));
        assert.strictEqual(r.added[0].authorPoints, want, 'points ' + String(pts));
    }
});

test('authorName is a string of at most 40 characters', async function () {
    const ok = await submit({ user: { username: 'Alice' } });
    assert.strictEqual(ok.added[0].authorName, 'Alice');
    const long = 'N'.repeat(41);
    const sliced = await submit({ user: { username: long } });
    assert.strictEqual(sliced.added[0].authorName, 'N'.repeat(40));
    const missing = await submit({ user: { username: '' } });
    assert.strictEqual(missing.added[0].authorName, 'Anon');
    const odd = [{ x: 1 }, ['Alice'], 12, null, undefined];
    for (const name of odd) {
        const r = await submit({ user: { username: name } });
        assert.strictEqual(r.added[0].authorName, 'Anon', String(name));
    }
});

test('coverUrl is kept only when it is an https URL', async function () {
    const ok = await submit({ coverReturn: HTTPS_COVER });
    assert.strictEqual(ok.added[0].coverUrl, HTTPS_COVER);
    const http = await submit({ coverReturn: 'http://example.com/cover.jpg' });
    assert.strictEqual(http.added[0].coverUrl, undefined);
    const data = await submit({ coverReturn: DATA_JPEG });
    assert.strictEqual(data.added[0].coverUrl, undefined);
    const none = await submit({});
    assert.strictEqual(none.added[0].coverUrl, undefined);
});

test('articleUpdate does not write author fields and only keeps an https cover', async function () {
    const http = await update({ coverReturn: 'http://example.com/cover.jpg', user: { username: 'Z', points: -1, profilePic: DATA_GIF } });
    assert.strictEqual(http.updates.length, 1);
    const u = http.updates[0];
    assert.ok(!('authorName' in u) && !('authorPoints' in u) && !('authorPic' in u));
    assert.ok(!('coverUrl' in u));
    const ok = await update({ coverReturn: HTTPS_COVER });
    assert.strictEqual(ok.updates[0].coverUrl, HTTPS_COVER);
    const data = await update({ coverReturn: DATA_JPEG });
    assert.ok(!('coverUrl' in data.updates[0]));
});

(async function () {
    for (const [name, fn] of queue) {
        try { await fn(); console.log('✅ ' + name); passed++; }
        catch (e) { console.log('❌ ' + name + ': ' + (e && e.message)); failed++; }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
