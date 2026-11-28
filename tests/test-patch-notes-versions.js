#!/usr/bin/env node
// Patch Notes page: current app version at the top, per-week versions only
// when recorded, and a Coming soon section fed by the upcoming list hook.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

const html = read('patch-notes.html');
const sw = read('sw.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e)); failed++; }
}

function cacheName() {
    const m = sw.match(/CACHE_NAME\s*=\s*'btc-archive-(v\d+)'/);
    assert.ok(m, 'sw.js CACHE_NAME');
    return m[1];
}

function pageScript() {
    const marker = html.indexOf('window._pnPatchNotes');
    assert.ok(marker > 0, 'page script hook');
    const start = html.lastIndexOf('<script>', marker);
    const end = html.indexOf('</script>', marker);
    assert.ok(start !== -1 && end > start);
    return html.slice(start + '<script>'.length, end);
}

function isEl(n) { return n && n.nodeType === 1; }

function createEl(tag, attrs) {
    const el = {
        nodeType: 1,
        tagName: String(tag).toUpperCase(),
        id: '',
        className: '',
        attrs: {},
        childNodes: [],
        parentNode: null,
        hidden: false,
        _text: '',
        get textContent() {
            if (this.childNodes.length) return this.childNodes.map(function (c) { return c.textContent; }).join('');
            return this._text;
        },
        set textContent(v) { this._text = String(v); this.childNodes = []; },
        get previousElementSibling() {
            if (!this.parentNode) return null;
            const kids = this.parentNode.childNodes.filter(isEl);
            const i = kids.indexOf(this);
            return i > 0 ? kids[i - 1] : null;
        },
        getAttribute: function (k) {
            return Object.prototype.hasOwnProperty.call(this.attrs, k) ? String(this.attrs[k]) : null;
        },
        setAttribute: function (k, v) {
            this.attrs[k] = String(v);
            if (k === 'id') this.id = String(v);
            if (k === 'class') this.className = String(v);
        },
        appendChild: function (c) {
            if (c.parentNode) c.parentNode.removeChild(c);
            c.parentNode = this;
            this.childNodes.push(c);
            return c;
        },
        insertBefore: function (c, ref) {
            if (c.parentNode) c.parentNode.removeChild(c);
            c.parentNode = this;
            const i = ref ? this.childNodes.indexOf(ref) : -1;
            if (i >= 0) this.childNodes.splice(i, 0, c);
            else this.childNodes.push(c);
            return c;
        },
        removeChild: function (c) {
            const i = this.childNodes.indexOf(c);
            if (i >= 0) { this.childNodes.splice(i, 1); c.parentNode = null; }
            return c;
        },
        after: function (node) {
            if (!this.parentNode) return;
            if (node.parentNode) node.parentNode.removeChild(node);
            node.parentNode = this.parentNode;
            const i = this.parentNode.childNodes.indexOf(this);
            this.parentNode.childNodes.splice(i + 1, 0, node);
        },
        querySelector: function (sel) { return findAll(this, sel)[0] || null; },
        querySelectorAll: function (sel) { return findAll(this, sel); }
    };
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
        if (k === 'hidden') el.hidden = !!attrs[k];
        else if (k === 'text') el._text = String(attrs[k]);
        else el.setAttribute(k === 'className' ? 'class' : k, attrs[k]);
        if (k === 'className') el.className = attrs[k];
        if (k === 'id') el.id = attrs[k];
    });
    return el;
}

function parseSelector(sel) {
    const m = String(sel).match(/^([a-z0-9-]+)?(?:#([a-zA-Z0-9_-]+))?(?:\.([a-zA-Z0-9_-]+))?(?:\[([a-zA-Z0-9_-]+)\])?$/);
    assert.ok(m, 'unsupported selector ' + sel);
    return { tag: (m[1] || '').toUpperCase(), id: m[2] || '', cls: m[3] || '', attr: m[4] || '' };
}

function matches(el, spec) {
    if (!isEl(el)) return false;
    if (spec.tag && el.tagName !== spec.tag) return false;
    if (spec.id && el.id !== spec.id) return false;
    if (spec.cls) {
        const classes = String(el.className || '').split(/\s+/);
        if (classes.indexOf(spec.cls) < 0) return false;
    }
    if (spec.attr && !Object.prototype.hasOwnProperty.call(el.attrs, spec.attr)) return false;
    return true;
}

function findAll(root, sel) {
    const spec = parseSelector(sel);
    const out = [];
    function walk(node) {
        node.childNodes.forEach(function (c) {
            if (matches(c, spec)) out.push(c);
            if (c.childNodes) walk(c);
        });
    }
    walk(root);
    return out;
}

function byId(root, id) {
    if (root.id === id) return root;
    const kids = root.childNodes || [];
    for (let i = 0; i < kids.length; i++) {
        const hit = byId(kids[i], id);
        if (hit) return hit;
    }
    return null;
}

function loadPage(opts) {
    opts = opts || {};
    const doc = createEl('document');
    const hero = createEl('p', { id: 'pnAppVersion', className: 'hero-version', 'data-sw-cache': opts.cache || 'v2730' });
    const num = createEl('span', { id: 'pnAppVersionNum', text: opts.cache || 'v2730' });
    hero.appendChild(num);

    const list = createEl('script', { id: 'pnUpcomingList', type: 'application/json', text: JSON.stringify(opts.upcoming || []) });

    const box = createEl('section', { id: 'comingSoonPatch', className: 'patch coming-soon' });
    box.hidden = true;
    const body = createEl('div', { id: 'comingSoonBody', className: 'patch-body' });
    box.appendChild(body);

    const latest = createEl('details', { id: 'week-latest', className: 'patch' });
    const latestHead = createEl('div');
    latestHead.appendChild(createEl('div', { className: 'patch-date', text: 'November 20, 2026' }));
    latest.appendChild(latestHead);
    if (opts.latestVersion) latest.setAttribute('data-version', opts.latestVersion);

    const prev = createEl('details', { id: 'week-prev', className: 'patch' });
    const prevHead = createEl('div');
    prevHead.appendChild(createEl('div', { className: 'patch-date', text: 'November 19, 2026' }));
    prev.appendChild(prevHead);
    if (opts.prevVersion) prev.setAttribute('data-version', opts.prevVersion);

    // Optionally put Coming soon in the wrong place so the script has to move it.
    if (opts.misplaced) {
        doc.appendChild(box);
        doc.appendChild(latest);
        doc.appendChild(list);
        doc.appendChild(prev);
    } else {
        doc.appendChild(hero);
        doc.appendChild(latest);
        doc.appendChild(list);
        doc.appendChild(box);
        doc.appendChild(prev);
    }
    if (opts.misplaced) doc.appendChild(hero);

    const ids = {
        pnAppVersion: hero,
        pnAppVersionNum: num,
        pnUpcomingList: list,
        comingSoonPatch: box,
        comingSoonBody: body
    };

    let fetched = false;
    const windowObj = { PN_UPCOMING: opts.windowUpcoming };
    const documentObj = {
        getElementById: function (id) { return ids[id] || byId(doc, id); },
        querySelector: function (sel) { return doc.querySelector(sel); },
        querySelectorAll: function (sel) { return doc.querySelectorAll(sel); },
        createElement: function (tag) { return createEl(tag); }
    };
    const context = {
        window: windowObj,
        document: documentObj,
        fetch: opts.swText ? function () {
            fetched = true;
            return Promise.resolve({ ok: true, text: function () { return Promise.resolve(opts.swText); } });
        } : undefined
    };
    windowObj._pnPatchNotes = undefined;
    vm.runInNewContext(pageScript(), context);
    return { doc: doc, latest: latest, prev: prev, box: box, body: body, hero: hero, num: num, list: list, window: windowObj, fetched: function () { return fetched; }, context: context };
}

const current = cacheName();

test('the hero shows the current CACHE_NAME at the top of Patch Notes', function () {
    assert.strictEqual(current, 'v2748');
    assert.ok(html.includes('id="pnAppVersion"'));
    assert.ok(html.includes('id="pnAppVersionNum"'));
    assert.ok(html.includes('data-sw-cache="' + current + '"'));
    assert.ok(html.includes('App version <span id="pnAppVersionNum">' + current + '</span>'));
    const heroAt = html.indexOf('id="pnAppVersion"');
    const firstWeek = html.indexOf('id="week-2026-11-28"');
    const h1 = html.indexOf('<h1>Patch Notes</h1>');
    assert.ok(heroAt > h1 && heroAt < firstWeek, 'version sits in the hero, above the weeks');
    assert.ok(html.includes("/CACHE_NAME\\s*=\\s*'btc-archive-(v\\d+)'/"));
    assert.ok(html.includes("fetch('/sw.js'"));
});

test('past weeks have no invented version numbers', function () {
    const weeks = html.match(/<details class="patch"[^>]*>/g) || [];
    assert.strictEqual(weeks.length, 19);
    weeks.forEach(function (tag) {
        assert.ok(!/\sdata-version="v\d+"/.test(tag), 'recorded version should be absent until known: ' + tag);
    });
    assert.strictEqual((html.match(/class="patch-version"/g) || []).length, 0);
    assert.strictEqual((html.match(/<h2 class="patch-title"/g) || []).length, 19);
});

test('Coming soon sits under Latest, starts empty, and has a data hook', function () {
    const latestEnd = html.indexOf('</details>', html.indexOf('id="week-2026-11-28"'));
    const hookAt = html.indexOf('id="pnUpcomingList"');
    const soonAt = html.indexOf('id="comingSoonPatch"');
    const nextWeek = html.indexOf('id="week-2026-11-20"');
    assert.ok(latestEnd > 0 && hookAt > latestEnd && soonAt > hookAt && soonAt < nextWeek);
    const hook = html.match(/<script type="application\/json" id="pnUpcomingList">([\s\S]*?)<\/script>/);
    assert.ok(hook);
    assert.deepStrictEqual(JSON.parse(hook[1]), []);
    assert.ok(/id="comingSoonPatch"[^>]*hidden/.test(html) || html.includes('id="comingSoonPatch" hidden'));
    assert.ok(html.includes('class="coming-soon-title">Coming soon</h2>'));
    assert.strictEqual((html.match(/<h2 class="patch-title"/g) || []).length, 19);
    assert.ok(!html.includes('Latest:'));
});

test('a recorded week version is shown, and a week without one stays blank', function () {
    const page = loadPage({ prevVersion: 'v2682', cache: 'v2730' });
    const api = page.window._pnPatchNotes;
    assert.ok(api);
    api.applyEntryVersions();
    const shown = page.prev.querySelector('.patch-version');
    assert.ok(shown, 'version slot was added');
    assert.strictEqual(shown.textContent, 'v2682');
    assert.strictEqual(shown.hidden, false);
    assert.strictEqual(page.latest.querySelector('.patch-version'), null);
});

test('an empty or invalid data-version is not shown', function () {
    const page = loadPage({ prevVersion: 'unknown', latestVersion: ' ' });
    page.window._pnPatchNotes.applyEntryVersions();
    assert.strictEqual(page.prev.querySelector('.patch-version'), null);
    assert.strictEqual(page.latest.querySelector('.patch-version'), null);
});

test('the current version on the hero updates from CACHE_NAME', function () {
    const page = loadPage({ cache: 'v2730' });
    page.window._pnPatchNotes.applyCurrentVersion('v2735');
    assert.strictEqual(page.num.textContent, 'v2735');
    assert.strictEqual(page.hero.getAttribute('data-sw-cache'), 'v2735');
    assert.strictEqual(page.hero.hidden, false);
    page.window._pnPatchNotes.applyCurrentVersion('nope');
    assert.strictEqual(page.num.textContent, 'v2735');
});

test('Coming soon stays hidden when the upcoming list is empty', function () {
    const page = loadPage({ upcoming: [] });
    assert.strictEqual(page.box.hidden, true);
    assert.strictEqual(page.body.childNodes.length, 0);
    var upcoming = page.window._pnPatchNotes.readUpcoming();
    assert.ok(Array.isArray(upcoming) && upcoming.length === 0);
});

test('Coming soon lists upcoming items and moves under the Latest entry', function () {
    const page = loadPage({
        upcoming: ['First item', { text: 'Second item' }, '  ', { text: '' }],
        misplaced: true
    });
    assert.strictEqual(page.box.hidden, false);
    assert.strictEqual(page.box.previousElementSibling, page.latest);
    const texts = page.body.querySelectorAll('.item-text');
    assert.strictEqual(texts.length, 2);
    assert.strictEqual(texts[0].textContent, 'First item');
    assert.strictEqual(texts[1].textContent, 'Second item');
});

test('window.PN_UPCOMING can fill the hook', function () {
    const page = loadPage({ upcoming: [], windowUpcoming: ['From the window hook'] });
    assert.strictEqual(page.box.hidden, false);
    assert.strictEqual(page.body.querySelector('.item-text').textContent, 'From the window hook');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
