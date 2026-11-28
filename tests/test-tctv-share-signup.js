#!/usr/bin/env node
// TCTV "Share this channel" URL plus the signed-out signup line below the player.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

let passed = 0;
let failed = 0;
const pending = [];

function test(name, fn) {
    try {
        const result = fn();
        if (result && typeof result.then === 'function') {
            pending.push(result.then(function () {
                console.log('✅ ' + name);
                passed++;
            }).catch(function (e) {
                console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
                failed++;
            }));
            return;
        }
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
    }
}

const api = require('../miniapp-share.js');
const CODE = 'abc12345';
const COPY_TOAST = 'Link copied. It opens right on this channel.';
const FULL_LINE = 'Watching free. Sign up free for quests, trivia and more. No ads from us.';
const SHORT_LINE = 'Free to watch. No ads from us.';


const navDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
function setNavigator(value) {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, enumerable: true, writable: true, value: value });
}
function restoreNavigator() {
    if (navDesc) Object.defineProperty(globalThis, 'navigator', navDesc);
    else delete globalThis.navigator;
}

function shareUrlParts(url) {
    const u = String(url || '');
    const hashCut = u.indexOf('#');
    const hash = hashCut >= 0 ? u.slice(hashCut + 1) : '';
    const base = hashCut >= 0 ? u.slice(0, hashCut) : u;
    const qCut = base.indexOf('?');
    const query = {};
    if (qCut >= 0) {
        base.slice(qCut + 1).split('&').forEach(function (part) {
            const kv = part.split('=');
            query[decodeURIComponent(kv[0] || '')] = decodeURIComponent(kv.slice(1).join('='));
        });
    }
    return { base: qCut >= 0 ? base.slice(0, qCut) : base, query: query, hash: hash, url: u };
}

test('the share URL has the sharer channel, ref, and src=tctv', function () {
    const model = api.shareModel('tctv', { channel: 'history', code: CODE });
    const parts = shareUrlParts(model.url);
    assert.strictEqual(parts.base, 'https://bitcoineducation.quest/');
    assert.strictEqual(parts.query.ref, CODE);
    assert.strictEqual(parts.query.src, 'tctv');
    assert.strictEqual(parts.hash, 'timechain-tv/history');
    assert.strictEqual(model.hash, 'timechain-tv/history');
    const live = api.shareTctvChannel({ channel: 'health-fitness', code: CODE });
    const liveParts = shareUrlParts(live.url);
    assert.strictEqual(liveParts.query.ref, CODE);
    assert.strictEqual(liveParts.query.src, 'tctv');
    assert.strictEqual(liveParts.hash, 'timechain-tv/health-fitness');
});

test('a live TCTV share uses the station on screen and forces src=tctv', function () {
    const prevStation = global.tctvCurrentStation;
    const prevLive = global.liveRefCode;
    setNavigator({});
    global.tctvCurrentStation = function () { return 'mining'; };
    global.liveRefCode = function () { return CODE; };
    const model = api.shareTctvChannel();
    const parts = shareUrlParts(model.url);
    assert.strictEqual(parts.hash, 'timechain-tv/mining');
    assert.strictEqual(parts.query.ref, CODE);
    assert.strictEqual(parts.query.src, 'tctv');
    global.tctvCurrentStation = prevStation;
    global.liveRefCode = prevLive;
    restoreNavigator();
});

test('navigator.share is used when it is available', function () {
    const calls = [];
    setNavigator({
        share: function (payload) {
            calls.push(payload);
            return Promise.resolve();
        }
    });
    const model = api.shareModel('tctv', { channel: 'news', code: CODE });
    return api.shareNativeOrCopy(model).then(function (result) {
        assert.strictEqual(result.method, 'share');
        assert.strictEqual(calls.length, 1);
        assert.ok(String(calls[0].text).indexOf(model.url) !== -1);
        assert.strictEqual(shareUrlParts(model.url).query.src, 'tctv');
    }).finally(restoreNavigator);
});

test('clipboard copy plus the approved toast is used when share is missing', function () {
    const prevToast = global.showToast;
    const copied = [];
    const toasts = [];
    setNavigator({
        clipboard: {
            writeText: function (text) {
                copied.push(text);
                return Promise.resolve();
            }
        }
    });
    global.showToast = function (msg) { toasts.push(msg); };
    const model = api.shareModel('tctv', { channel: 'history', code: CODE });
    return api.shareNativeOrCopy(model).then(function (result) {
        assert.strictEqual(result.method, 'copy');
        assert.deepStrictEqual(copied, [model.url]);
        assert.deepStrictEqual(toasts, [COPY_TOAST]);
        assert.strictEqual(api.TCTV_COPY_TOAST, COPY_TOAST);
        assert.strictEqual(shareUrlParts(model.url).query.ref, CODE);
        assert.strictEqual(shareUrlParts(model.url).query.src, 'tctv');
        assert.strictEqual(shareUrlParts(model.url).hash, 'timechain-tv/history');
    }).finally(function () {
        restoreNavigator();
        if (prevToast) global.showToast = prevToast;
        else delete global.showToast;
    });
});

test('the Share button uses the approved label, aria-label, and tooltip', function () {
    const tv = read('timechain-tv.js');
    const i = tv.indexOf('id="tctvShareBtn"');
    assert.ok(i >= 0);
    const btn = tv.slice(tv.lastIndexOf('<button', i), tv.indexOf('</button>', i) + 9);
    assert.ok(btn.indexOf('>Share</button>') !== -1);
    assert.ok(btn.indexOf('aria-label="Share this channel"') !== -1);
    assert.ok(btn.indexOf('title="Send a link that opens Timechain TV on this channel."') !== -1);
    assert.ok(btn.indexOf('tctvShareChannel') !== -1);
});

test('the signup line sits outside the player box in normal flow', function () {
    const tv = read('timechain-tv.js');
    const signupAt = tv.indexOf('id="tctv-signup-line"');
    const npAt = tv.indexOf('id="tctv-np-bar"');
    const rowOpen = tv.indexOf('id="tctv-video-row"');
    const rowClose = tv.indexOf('s+="</div>",s+=\'<div id="tctv-signup-line"');
    const vcAt = tv.indexOf('id="tctv-video-container"');
    assert.ok(signupAt > 0);
    assert.ok(rowClose > rowOpen);
    assert.ok(signupAt > rowClose);
    assert.ok(signupAt < npAt);
    const vcStart = tv.lastIndexOf("s+='", vcAt);
    const vcEnd = tv.indexOf("',", vcAt);
    const vcHtml = tv.slice(vcStart, vcEnd);
    assert.ok(vcHtml.indexOf('id="tctv-video-container"') !== -1);
    assert.strictEqual(vcHtml.indexOf('tctv-signup-line'), -1);
    const signupStart = tv.lastIndexOf("s+='", signupAt);
    const signupEnd = tv.indexOf("',s+='<div id=\"tctv-np-bar\"", signupAt);
    const signupHtml = tv.slice(signupStart, signupEnd);
    assert.ok(signupHtml.indexOf('position:static') !== -1);
    assert.ok(signupHtml.indexOf('flex:0 0 auto') !== -1);
    assert.strictEqual(/position\s*:\s*absolute/.test(signupHtml), false);
    assert.strictEqual(/position\s*:\s*fixed/.test(signupHtml), false);
    assert.ok(tv.indexOf('position:static!important') !== -1);
    assert.ok(tv.indexOf('hidden style="flex:0 0 auto;position:static') !== -1);
});

test('the signup line uses the approved copy and never says ad-free', function () {
    const tv = read('timechain-tv.js');
    const signupAt = tv.indexOf('id="tctv-signup-line"');
    const signupEnd = tv.indexOf("',s+='<div id=\"tctv-np-bar\"", signupAt);
    const signupHtml = tv.slice(signupAt, signupEnd);
    assert.ok(signupHtml.indexOf(FULL_LINE.replace('Sign up free', '')) !== -1 || signupHtml.indexOf('Watching free.') !== -1);
    assert.ok(signupHtml.indexOf('Watching free.') !== -1);
    assert.ok(signupHtml.indexOf('Sign up free') !== -1);
    assert.ok(signupHtml.indexOf('for quests, trivia and more. No ads from us.') !== -1);
    assert.ok(signupHtml.indexOf(SHORT_LINE) !== -1);
    assert.ok(signupHtml.indexOf('No ads from us.') !== -1);
    assert.strictEqual(/ad-free/i.test(signupHtml), false);
    assert.strictEqual(/ad-free/i.test(tv.slice(tv.lastIndexOf('(function(){'))) , false);
    assert.strictEqual(COPY_TOAST.indexOf('ad-free'), -1);
    assert.strictEqual(/ad-free/i.test(read('miniapp-share.js').slice(read('miniapp-share.js').indexOf('TCTV_COPY_TOAST'))), false);
});

test('the signup line shows only when signed out', function () {
    const tv = read('timechain-tv.js');
    const start = tv.lastIndexOf('(function(){');
    assert.ok(start > 0);
    const el = {
        attrs: { hidden: '' },
        setAttribute: function (k, v) { this.attrs[k] = v; },
        removeAttribute: function (k) { delete this.attrs[k]; },
        hasAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); },
        addEventListener: function () {}
    };
    const styleEl = { id: '', textContent: '' };
    const ids = {
        'tctv-signup-line': el,
        'tctv-signup-btn': { addEventListener: function () {}, _tctvBound: 0 },
        'tctv-signup-short': { addEventListener: function () {}, _tctvBound: 0 }
    };
    const sandbox = {
        window: null,
        firebase: null,
        document: {
            readyState: 'complete',
            head: { appendChild: function () {} },
            documentElement: { appendChild: function () {} },
            getElementById: function (id) {
                if (id === 'tctv-signup-css') return styleEl.id ? styleEl : null;
                return ids[id] || null;
            },
            createElement: function () { return styleEl; },
            addEventListener: function () {}
        }
    };
    sandbox.window = sandbox;
    sandbox.firebase = {
        auth: function () {
            return {
                currentUser: sandbox._user,
                onAuthStateChanged: function () {}
            };
        }
    };
    vm.runInNewContext(tv.slice(start), sandbox);
    assert.strictEqual(typeof sandbox.tctvSyncSignupLine, 'function');
    sandbox._user = null;
    sandbox.tctvSyncSignupLine();
    assert.strictEqual(el.hasAttribute('hidden'), false, 'guest should see the line');
    sandbox._user = { uid: 'u1', isAnonymous: false };
    sandbox.tctvSyncSignupLine();
    assert.strictEqual(el.hasAttribute('hidden'), true, 'signed-in should hide the line');
    sandbox._user = { uid: 'g1', isAnonymous: true };
    sandbox.tctvSyncSignupLine();
    assert.strictEqual(el.hasAttribute('hidden'), false, 'anonymous should see the line');
});

test('pages pin the new helpers and keep index identical to 404', function () {
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(html.includes('miniapp-share.js?v=20261128_v2744'));
    assert.ok(html.includes('timechain-tv.js?v=20261128_v2745'));
    assert.ok(read('sw.js').includes("const CACHE_NAME = 'btc-archive-v2746'"));
});

Promise.all(pending).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
});
