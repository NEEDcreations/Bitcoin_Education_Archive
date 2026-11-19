#!/usr/bin/env node
'use strict';
// Article markdown (forum.js mdToHtml): every generated tag keeps only its own
// attributes, URLs are http(s) or same-site paths, and normal markdown renders.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const forum = fs.readFileSync(path.join(root, process.env.ARTICLE_MD_FORUM || 'forum.js'), 'utf8');
const utils = fs.readFileSync(path.join(root, 'utils.js'), 'utf8');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function sliceFn(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start < 0) return '';
    let depth = 0;
    for (let i = src.indexOf('{', start); i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
    }
    throw new Error('unclosed ' + name);
}

// Same output as utils.js escapeHtml (encodes & < > " ').
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const ctx = { escapeHtml: escapeHtml, console: console };
vm.createContext(ctx);
const fEscFn = sliceFn(forum, 'fEsc');
assert.ok(fEscFn, 'fEsc');
vm.runInContext([
    sliceFn(utils, 'sanitizeUrl'),
    fEscFn,
    forum.split('\n').filter(function (l) { return l.indexOf('var MD_') === 0; }).join('\n'),
    sliceFn(forum, 'mdUnescape'),
    sliceFn(forum, 'mdSafeUrl'),
    sliceFn(forum, 'forumRenderMentions'),
    sliceFn(forum, 'mdToHtml'),
    'this.mdToHtml = mdToHtml;'
].join('\n'), ctx);
const md = ctx.mdToHtml;

function decode(v) {
    return v.replace(/&#x([0-9a-f]+);?/gi, function (m, h) { return String.fromCharCode(parseInt(h, 16)); })
        .replace(/&#(\d+);?/g, function (m, d) { return String.fromCharCode(Number(d)); })
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&colon;/gi, ':').replace(/&tab;/gi, '\t').replace(/&newline;/gi, '\n').replace(/&amp;/g, '&');
}

// Small HTML start-tag tokenizer that follows the browser rules for quotes.
function tags(html) {
    const out = [];
    let i = 0;
    while (i < html.length) {
        if (html[i] !== '<' || !/[A-Za-z]/.test(html[i + 1] || '')) { i++; continue; }
        let j = i + 1;
        let name = '';
        while (j < html.length && /[^\s\/>]/.test(html[j])) name += html[j++];
        const attrs = [];
        while (j < html.length && html[j] !== '>') {
            if (/[\s\/]/.test(html[j])) { j++; continue; }
            let an = '';
            while (j < html.length && /[^\s\/>=]/.test(html[j])) an += html[j++];
            if (!an) { an = html[j++]; }
            while (/\s/.test(html[j] || '')) j++;
            let val = '';
            if (html[j] === '=') {
                j++;
                while (/\s/.test(html[j] || '')) j++;
                const q = html[j];
                if (q === '"' || q === "'") {
                    const end = html.indexOf(q, j + 1);
                    val = html.slice(j + 1, end < 0 ? html.length : end);
                    j = end < 0 ? html.length : end + 1;
                } else {
                    while (j < html.length && /[^\s>]/.test(html[j])) val += html[j++];
                }
            }
            attrs.push({ name: an.toLowerCase(), value: decode(val) });
        }
        out.push({ name: name.toLowerCase(), attrs: attrs });
        i = j + 1;
    }
    return out;
}

const ALLOWED = {
    img: ['src', 'alt', 'style'],
    a: ['href', 'target', 'rel', 'style'],
    p: ['style'], h1: ['style'], h2: ['style'], h3: ['style'], strong: ['style'], em: [], code: ['style'],
    blockquote: ['style'], li: ['style'], hr: ['style'], br: [],
    span: ['class', 'onclick'],
};
const MENTION_ONCLICK = /^forumMentionClick\('[A-Za-z0-9_.\-]{2,20}'\)$/;

function assertClean(input) {
    const html = md(input);
    tags(html).forEach(function (t) {
        assert.ok(Object.prototype.hasOwnProperty.call(ALLOWED, t.name), 'unexpected tag <' + t.name + '> for ' + JSON.stringify(input) + ' => ' + html);
        const seen = {};
        t.attrs.forEach(function (a) {
            assert.ok(ALLOWED[t.name].indexOf(a.name) !== -1, 'unexpected attribute ' + a.name + ' on <' + t.name + '> for ' + JSON.stringify(input) + ' => ' + html);
            assert.ok(!seen[a.name], 'duplicate attribute ' + a.name);
            seen[a.name] = true;
            if (a.name === 'onclick') {
                assert.strictEqual(t.attrs.find(function (x) { return x.name === 'class'; }).value, 'forum-mention');
                assert.ok(MENTION_ONCLICK.test(a.value), a.value);
            }
            if (a.name === 'href' || a.name === 'src') {
                const v = a.value.replace(/[\u0000-\u0020]/g, '');
                assert.ok(/^https?:\/\/[^\/\\]/i.test(v) || /^\/(?![\/\\])/.test(v)
                    || (t.name === 'img' && DATA_IMG.test(a.value)) || (t.name === 'a' && MAILTO.test(a.value)), 'url not allowed: ' + a.value + ' for ' + JSON.stringify(input));
            }
            if (a.name === 'style') assert.ok(!/url\(|expression|javascript/i.test(a.value), 'style: ' + a.value);
        });
    });
    return html;
}

const DATA_IMG = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+\/]+=*$/;
const MAILTO = /^mailto:[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const SCHEMES = ['javascript:x()', 'JaVaScRiPt:x()', ' javascript:x()', 'java\tscript:x()', 'vbscript:x', 'VBScript:x',
    'data:text/html,<b>x</b>', 'DATA:text/html;base64,PGI+', 'data:image/svg+xml,<svg onload=x()>',
    '&#106;avascript:x()', '&#x6A;avascript:x()', 'javascript&colon;x()', 'jav&#x09;ascript:x()', '//evil.example/x', '\\\\evil/x', 'blob:https://x/y'];

test('a link nested inside an image URL adds no attributes to the image', function () {
    [
        '![a](https://x.example/[b](https://y.example k=v))',
        '![a](https://x.example/[b](https://y.example onerror=x()))',
        '![a](https://x.example/[b](https://y.example" onerror="x()))',
        '![a](https://x.example/[b](https://y.example/ data-forum-action=delete-post data-id=p1))',
        '![a](https://x.example/[b](https://y.example/ style=position:fixed))',
        '![a](https://x.example/[b](https://y.example/ onload=x() autofocus onfocus=x()))',
        '![a](https://x.example/[b](https://y.example/\tonerror=x()))',
    ].forEach(assertClean);
});

test('an image nested inside a link still renders as a linked image', function () {
    const html = assertClean('[![logo](https://img.example/a.png)](https://site.example/page)');
    const t = tags(html);
    const a = t.find(function (x) { return x.name === 'a'; });
    const img = t.find(function (x) { return x.name === 'img'; });
    assert.ok(a && img, html);
    assert.strictEqual(a.attrs.find(function (x) { return x.name === 'href'; }).value, 'https://site.example/page');
    assert.strictEqual(img.attrs.find(function (x) { return x.name === 'src'; }).value, 'https://img.example/a.png');
    ['[![a](https://x.example/i.png onerror=x())](https://y.example)', '[x](https://y.example/![a](https://z.example onerror=x()))',
        '[![a](https://x.example/[b](https://y.example onerror=x()))](https://z.example)'].forEach(assertClean);
});

test('quotes in URLs, alt text and link text stay inside their attribute or text', function () {
    [
        '![a" onerror="x()](https://x.example/i.png)',
        "![a' onerror='x()](https://x.example/i.png)",
        '![a](https://x.example/i.png" onerror="x())',
        "![a](https://x.example/i.png' onerror='x())",
        '[t" onmouseover="x()](https://x.example)',
        '[t](https://x.example/" onmouseover="x())',
        '[t](https://x.example/"onmouseover="x())',
        'https://x.example/"onmouseover="x()',
        "https://x.example/'onmouseover='x()",
    ].forEach(assertClean);
    const html = md('![a" b](https://x.example/i.png)');
    const img = tags(html).find(function (x) { return x.name === 'img'; });
    assert.strictEqual(img.attrs.find(function (x) { return x.name === 'alt'; }).value, 'a" b');
});

test('image alt with url and quotes stays inert', function () {
    [
        '![x http://a.b/" onerror="alert(1) y](https://example.com/i.png)',
        '![x https://a.b/" onerror="x() y](https://example.com/i.png)',
        '![http://a.b/" onerror="x()](https://example.com/i.png)',
        "![x http://a.b/' onerror='x() y](https://example.com/i.png)",
        '![x http://a.b/" onclick="x() y](https://example.com/i.png)',
    ].forEach(function (input) {
        const html = assertClean(input);
        const imgs = tags(html).filter(function (x) { return x.name === 'img'; });
        assert.strictEqual(imgs.length, 1, html);
        const img = imgs[0];
        assert.strictEqual(img.attrs.find(function (x) { return x.name === 'src'; }).value, 'https://example.com/i.png');
        const alt = img.attrs.find(function (x) { return x.name === 'alt'; });
        assert.ok(alt, html);
        assert.ok(/https?:\/\/a\.b\//.test(alt.value), alt.value);
        assert.ok(/["']/.test(alt.value), alt.value);
        img.attrs.forEach(function (a) {
            assert.ok(!/^on/i.test(a.name), a.name);
            assert.ok(['src', 'alt', 'style'].indexOf(a.name) !== -1, a.name);
        });
    });
});

test('event attributes never appear, whatever the nesting', function () {
    ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'ONERROR', 'OnLoad', 'onanimationstart', 'onpointerenter'].forEach(function (ev) {
        assertClean('![a](https://x.example/[b](https://y.example ' + ev + '=x()))');
        assertClean('[![a](https://x.example/[b](https://y.example ' + ev + '=x()))](https://z.example)');
        assertClean('`![a](https://x.example/[b](https://y.example ' + ev + '=x()))`');
        assertClean('**![a](https://x.example/[b](https://y.example ' + ev + '=x()))**');
    });
});

test('script, data and other schemes are dropped in images, links and nesting, in any case', function () {
    SCHEMES.forEach(function (u) {
        assertClean('![a](' + u + ')');
        assertClean('[t](' + u + ')');
        assertClean('[![a](' + u + ')](' + u + ')');
        assertClean('![a](https://x.example/[b](' + u + '))');
        assertClean('[t](https://x.example/[b](' + u + '))');
    });
});

test('backticks and emphasis around links and URLs cannot reach into a tag', function () {
    [
        '`[t](https://x.example/`onmouseover=x()`)`',
        '[t](https://x.example/a*b*c)',
        '[t](https://x.example/a**b**c)',
        'https://x.example/a*b*c',
        'https://x.example/a`b`c',
        'https://x.example/a---b',
        '![a*b*](https://x.example/i.png)',
        '[**t**](https://x.example)',
        '`https://x.example/a`',
        '![a](https://x.example/`b`)',
    ].forEach(assertClean);
});

test('normal markdown renders as before', function () {
    let html = md('Read [the docs](https://bitcoin.org/en/) now.');
    assert.ok(html.includes('<a href="https://bitcoin.org/en/" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;font-weight:600;">the docs</a>'), html);
    html = md('![chart](https://firebasestorage.googleapis.com/v0/b/app/o/a.png)');
    assert.ok(html.includes('<img src="https://firebasestorage.googleapis.com/v0/b/app/o/a.png" alt="chart" style="max-width:100%;border-radius:12px;margin:16px 0;display:block;">'), html);
    html = md('See https://mempool.space/tx/abc for details');
    assert.ok(html.includes('<a href="https://mempool.space/tx/abc" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;">https://mempool.space/tx/abc</a>'), html);
    html = md('# Title\n\n**bold** and *em* and `code`\n\n- one\n- two\n\n---');
    assert.ok(html.includes('<h1 style="color:var(--heading);font-size:1.4rem;font-weight:900;margin:28px 0 12px;">Title</h1>'));
    assert.ok(html.includes('<strong style="color:var(--heading);">bold</strong>'));
    assert.ok(html.includes('<em>em</em>'));
    assert.ok(html.includes('<code style="background:var(--card-bg);padding:2px 6px;border-radius:4px;font-size:0.9em;">code</code>'));
    assert.ok(html.includes('<li style="margin:4px 0 4px 20px;">one</li>'));
    assert.ok(html.includes('<hr '));
    assert.ok(md('hi @satoshi').includes('class="forum-mention"'));
    assert.strictEqual(md(''), '');
    html = md('[home](/learn/basics)');
    assert.ok(html.includes('<a href="/learn/basics"'), html);
    assertClean('Text with <b>tags</b> & "quotes" and \'single\'');
    assert.ok(md('<script>x()</script>').includes('&lt;script&gt;'));
});

test('a URL with a query string is escaped once', function () {
    const html = md('[q](https://x.example/?a=1&b=2)');
    assert.ok(html.includes('href="https://x.example/?a=1&amp;b=2"'), html);
    const img = tags(md('![q](https://x.example/i.png?a=1&b=2)')).find(function (x) { return x.name === 'img'; });
    assert.strictEqual(img.attrs.find(function (x) { return x.name === 'src'; }).value, 'https://x.example/i.png?a=1&b=2');
});

test('inline base64 pictures and plain mailto links render', function () {
    ['png', 'jpeg', 'gif', 'webp'].forEach(function (type) {
        const url = 'data:image/' + type + ';base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/eL9qWQAAAABJRU5ErkJggg==';
        const html = assertClean('![pic](' + url + ')');
        const img = tags(html).find(function (x) { return x.name === 'img'; });
        assert.ok(img, type);
        assert.strictEqual(img.attrs.find(function (x) { return x.name === 'src'; }).value, url);
    });
    const html = assertClean('[mail me](mailto:satoshi.n+btc@example.org)');
    const a = tags(html).find(function (x) { return x.name === 'a'; });
    assert.ok(a);
    assert.strictEqual(a.attrs.find(function (x) { return x.name === 'href'; }).value, 'mailto:satoshi.n+btc@example.org');
});

test('other data types and mailto with extra content are refused', function () {
    [
        '![x](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)',
        '![x](data:text/html;base64,PGI+eDwvYj4=)',
        '![x](data:image/png;base64,AAAA\"onerror=\"x())',
        '![x](data:image/png,raw)',
        '![x](DATA:image/png;base64,AAAA)',
        '[x](data:image/png;base64,AAAA)',
        '[x](mailto:a@b.co?subject=hi)',
        '[x](mailto:a@b.co,c@d.co)',
        '[x](mailto:a@b.co&body=x)',
        '[x](mailto:a@b.co%0Ax)',
        '[x](mailto:javascript:x@b.co)',
        '![x](mailto:a@b.co)',
    ].forEach(function (input) {
        const html = assertClean(input);
        tags(html).forEach(function (t) {
            if (t.name !== 'img' && t.name !== 'a') return;
            assert.fail('unexpected ' + t.name + ' for ' + input + ': ' + html);
        });
    });
});

test('image alt and link text with a bare URL carrying a handler stay inert', function () {
    [
        '![https://x.example/onerror=alert(1)// ](https://nope.invalid/a.png)',
        '![x https://x.example/onerror=alert(1)//](https://nope.invalid/a.png)',
        '[![https://x.example/onerror=alert(1)//](https://nope.invalid/a.png)](https://ok.example/)',
        '**![https://x.example/onerror=alert(1)//](https://nope.invalid/a.png)**',
        '> ![https://x.example/onerror=alert(1)//](https://nope.invalid/a.png)',
        '![a](https://nope.invalid/a.png "https://x.example/onerror=alert(1)//")',
        '[https://x.example/onmouseover=alert(1)// ](https://ok.example/)',
        '[x https://a.b/" onmouseover="x() y](https://ok.example/)',
    ].forEach(function (input) {
        const html = assertClean(input);
        tags(html).forEach(function (t) {
            t.attrs.forEach(function (a) { assert.ok(!/^on/i.test(a.name), input + ' => ' + a.name); });
            if (t.name === 'img') t.attrs.forEach(function (a) { assert.ok(['src', 'alt', 'style'].indexOf(a.name) !== -1, input + ' => img ' + a.name); });
        });
    });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
