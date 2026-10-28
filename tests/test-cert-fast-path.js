#!/usr/bin/env node
// Certificate links verify with a plain fetch, render with textContent,
// time out after 10s, and do not drop a ?ref= that is still on the URL.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

const VERIFY_URL = 'https://us-central1-bitcoin-education-archive.cloudfunctions.net/verifyCertificate';
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

function makeEl(tag) {
    const el = {
        tag: tag || 'div',
        id: '',
        type: '',
        style: {},
        classList: {
            _s: {},
            add(c) { this._s[c] = true; },
            remove(c) { delete this._s[c]; },
            contains(c) { return !!this._s[c]; }
        },
        children: [],
        parentNode: null,
        _ownText: '',
        _listeners: {},
        scrollTop: 0,
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
        removeChild(child) {
            const i = this.children.indexOf(child);
            if (i >= 0) this.children.splice(i, 1);
            return child;
        },
        addEventListener(type, fn) {
            (this._listeners[type] = this._listeners[type] || []).push(fn);
        },
        click() {
            (this._listeners.click || []).forEach(function (fn) { fn(); });
        }
    };
    Object.defineProperty(el, 'firstChild', {
        get() { return this.children[0] || null; }
    });
    Object.defineProperty(el, 'textContent', {
        get() {
            return this._ownText + this.children.map(function (child) {
                return child.textContent || '';
            }).join('');
        },
        set(value) {
            this._ownText = String(value == null ? '' : value);
            this.children = [];
        }
    });
    Object.defineProperty(el, 'innerHTML', {
        get() { return ''; },
        set(value) { throw new Error('innerHTML used: ' + String(value).slice(0, 80)); }
    });
    return el;
}

function page(search, hash) {
    const ids = {
        home: makeEl('div'),
        hero: makeEl('div'),
        msgs: makeEl('div'),
        forumContainer: makeEl('div'),
        main: makeEl('div')
    };
    ids.home.id = 'home';
    const listeners = {};
    const pushes = [];
    const scripts = [];
    const docListeners = {};
    const sandbox = {
        console: console,
        setTimeout: function (fn, ms) { return setTimeout(fn, ms); },
        clearTimeout: function (id) { return clearTimeout(id); },
        AbortController: AbortController,
        Promise: Promise,
        JSON: JSON,
        Object: Object,
        String: String,
        Error: Error,
        URL: URL,
        fetch: function () { throw new Error('fetch not stubbed'); },
        history: {
            pushState: function (_s, _t, url) { pushes.push(String(url)); },
            replaceState: function (_s, _t, url) { pushes.push('replace:' + String(url)); }
        },
        location: {
            pathname: '/',
            search: search || '',
            hash: hash || '',
            href: 'https://bitcoineducation.quest/' + (search || '') + (hash || '')
        },
        document: {
            readyState: 'loading',
            head: makeEl('head'),
            body: makeEl('body'),
            getElementById: function (id) { return ids[id] || null; },
            querySelector: function () { return null; },
            createElement: function (tag) {
                const el = makeEl(tag);
                if (tag === 'script') scripts.push(el);
                return el;
            },
            createTextNode: function (text) {
                const el = makeEl('#text');
                el.textContent = String(text == null ? '' : text);
                return el;
            },
            addEventListener: function (type, fn) {
                (docListeners[type] = docListeners[type] || []).push(fn);
            }
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    return {
        sandbox: sandbox,
        ids: ids,
        pushes: pushes,
        scripts: scripts,
        listeners: listeners,
        dispatch: function (type) {
            (docListeners[type] || []).forEach(function (fn) { fn(); });
        },
        fc: ids.forumContainer
    };
}

function flush() {
    return new Promise(function (resolve) { setImmediate(resolve); });
}

function hashScript() {
    const html = read('index.html');
    const blocks = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
    const block = blocks.find(function (b) { return b.includes('var _hashScripts'); });
    assert.ok(block, 'hash script block');
    return block.replace(/^<script>/, '').replace(/<\/script>$/, '');
}

function buttons(root) {
    const found = [];
    (function walk(node) {
        if (!node) return;
        if (node.tag === 'button') found.push(node);
        (node.children || []).forEach(walk);
    })(root);
    return found;
}

test('sources post verifyCertificate and paint fields as text', () => {
    ['shareable-certs.js', 'app.js', 'index.html', '404.html'].forEach(function (name) {
        const src = read(name);
        assert.ok(src.includes(VERIFY_URL), name + ' missing verify url');
        assert.ok(src.includes('JSON.stringify({ data: { certId:'), name + ' missing data body');
        assert.ok(src.includes('.result'), name + ' missing result read');
        assert.strictEqual(src.includes("httpsCallable('verifyCertificate')"), false, name);
        assert.strictEqual(src.includes('httpsCallable("verifyCertificate")'), false, name);
        assert.ok(src.includes('textContent'), name);
        assert.ok(src.includes('Verifying certificate…'), name);
        assert.ok(src.includes('Open Bitcoin Quest'), name);
        assert.ok(src.includes('CERT_TIMEOUT_MS = 10000') || src.includes('CERT_TIMEOUT_MS = 10000;'), name);
    });
    assert.strictEqual(read('index.html'), read('404.html'));
    const app = read('app.js');
    assert.ok(app.includes('if (window._certPainted !== _certRaw) _paintBundleCert(_certRaw, false)'));
    assert.ok(app.includes("shareable-certs.js?v=20261028_v2410"));
    const early = hashScript();
    assert.ok(early.includes('DOMContentLoaded'));
    assert.ok(early.includes('firebase.firestore'));
    assert.strictEqual(early.includes("window._loadDeferred();") && early.indexOf('DOMContentLoaded') < early.lastIndexOf('_loadDeferred'), true);
    const sw = read('sw.js');
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2411'"));
    assert.ok(sw.includes('NETWORK_FIRST_TIMEOUT_MS = 3000'));
    assert.ok(sw.includes("url.searchParams.has('v')"));
    assert.ok(sw.includes('cache-first') || sw.includes('Serve them from the'));
    const worker = read('workers/seo-router/worker.js');
    assert.ok(worker.includes("script-src 'self' 'unsafe-inline'"));
    assert.ok(worker.includes('https://us-central1-bitcoin-education-archive.cloudfunctions.net'));
    assert.strictEqual(worker.includes('BTCeduArchive'), false);
    assert.strictEqual(read('shareable-certs.js').includes('@BTCeduArchive'), false);
    assert.ok(read('shareable-certs.js').includes('@BTCedu_app'));
    const tickets = read('tickets.js');
    assert.ok(tickets.includes("localStorage.setItem('btc_referral_code', ref)"));
    assert.ok(tickets.includes('window.location.pathname + window.location.hash'));
});

async function runBehavior() {
    const ctx = page('?ref=abc12345', '#cert/CERT-ABCD1234');
    const calls = [];
    let hang = null;
    ctx.sandbox.fetch = function (url, opts) {
        calls.push({ url: url, body: opts && opts.body, signal: opts && opts.signal });
        if (hang) return hang;
        return Promise.resolve({
            ok: true,
            json: function () {
                return Promise.resolve({
                    result: {
                        valid: true,
                        name: '<b>Ada</b>',
                        quest: 'protocol-expert',
                        score: '21 / 25',
                        date: 'October 1, 2026',
                        certId: 'CERT-ABCD1234'
                    }
                });
            }
        });
    };
    let deferred = 0;
    ctx.sandbox._loadDeferred = function () { deferred++; };
    ctx.sandbox.window._loadDeferred = ctx.sandbox._loadDeferred;
    vm.runInContext(hashScript(), ctx.sandbox);
    assert.strictEqual(deferred, 0, 'deferred scripts ran before firestore');
    assert.strictEqual(ctx.sandbox.location.search, '?ref=abc12345');
    assert.strictEqual(ctx.pushes.length, 0, 'early cert path changed the url');
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].url, VERIFY_URL);
    assert.deepStrictEqual(JSON.parse(calls[0].body), { data: { certId: 'CERT-ABCD1234' } });
    assert.ok(ctx.sandbox._certVerify && typeof ctx.sandbox._certVerify.then === 'function');
    assert.ok(ctx.fc.textContent.includes('Verifying certificate…'));
    ctx.dispatch('DOMContentLoaded');
    assert.strictEqual(deferred, 1, 'deferred scripts did not wait for DOMContentLoaded');
    await flush();
    await flush();
    assert.ok(ctx.fc.textContent.includes('VERIFIED CERTIFICATE'), ctx.fc.textContent);
    assert.ok(ctx.fc.textContent.includes('<b>Ada</b>'), 'name was not inserted as text');
    assert.ok(ctx.fc.textContent.includes('Bitcoin Protocol Expert'));
    assert.ok(ctx.fc.textContent.includes('Score: 21 / 25'));
    assert.ok(ctx.fc.textContent.includes('Date: October 1, 2026'));
    assert.ok(ctx.fc.textContent.includes('Certificate ID: CERT-ABCD1234'));
    assert.strictEqual(ctx.sandbox.location.search, '?ref=abc12345');
    const open = buttons(ctx.fc).filter(function (b) { return b.textContent === 'Open Bitcoin Quest'; });
    assert.strictEqual(open.length, 1);
    open[0].click();
    assert.ok(ctx.pushes.indexOf('/?ref=abc12345') !== -1, 'open quest dropped the referral: ' + ctx.pushes.join(','));

    const bad = page('', '#cert/../etc');
    let fetched = 0;
    bad.sandbox.fetch = function () { fetched++; return Promise.reject(new Error('should not fetch')); };
    vm.runInContext(hashScript(), bad.sandbox);
    assert.strictEqual(fetched, 0);
    assert.ok(bad.fc.textContent.includes('Certificate Not Found'));

    const slow = page('?ref=zzz99999', '#cert/CERT-TIMEOUT1');
    const timers = [];
    slow.sandbox.setTimeout = function (fn, ms) {
        timers.push({ fn: fn, ms: ms });
        return timers.length;
    };
    slow.sandbox.clearTimeout = function () {};
    slow.sandbox.fetch = function (_url, opts) {
        return new Promise(function (_resolve, reject) {
            if (opts && opts.signal) {
                opts.signal.addEventListener('abort', function () {
                    const err = new Error('The operation was aborted.');
                    err.name = 'AbortError';
                    reject(err);
                });
            }
        });
    };
    vm.runInContext(hashScript(), slow.sandbox);
    assert.ok(slow.fc.textContent.includes('Verifying certificate…'));
    const timer = timers.filter(function (t) { return t.ms === 10000; })[0];
    assert.ok(timer, 'missing 10s timeout');
    timer.fn();
    await flush();
    await flush();
    assert.ok(slow.fc.textContent.includes('Verification timed out'), slow.fc.textContent);
    assert.ok(slow.fc.textContent.includes('Retry'));
    assert.ok(slow.fc.textContent.includes('Open Bitcoin Quest'));
    assert.strictEqual(slow.sandbox.location.search, '?ref=zzz99999');

    const lib = page('', '');
    const libCalls = [];
    lib.sandbox.fetch = function (url, opts) {
        libCalls.push(JSON.parse(opts.body));
        return Promise.resolve({
            ok: true,
            json: function () {
                return Promise.resolve({ result: { valid: false } });
            }
        });
    };
    vm.runInContext(read('shareable-certs.js'), lib.sandbox);
    lib.sandbox.renderCertVerification('CERT-NOTREAL1');
    await flush();
    assert.deepStrictEqual(libCalls[0], { data: { certId: 'CERT-NOTREAL1' } });
    assert.ok(lib.fc.textContent.includes('Certificate Not Found'));
    assert.strictEqual(lib.sandbox.location.search, '');
}

runBehavior().then(function () {
    console.log('✅ fetch path renders text and times out with Retry');
    passed++;
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
}).catch(function (e) {
    console.log('❌ fetch path renders text and times out with Retry: ' + (e && e.stack || e));
    failed++;
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(1);
});
