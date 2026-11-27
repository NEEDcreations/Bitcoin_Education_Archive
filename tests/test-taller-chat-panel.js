#!/usr/bin/env node
// Desktop chat panel grows up to just below the homepage title, and the
// sticky pinned banner has no empty gap above it. Mobile height is unchanged.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

const src = read('global-chat.js');
const sw = read('sw.js');
const indexHtml = read('index.html');
const notFoundHtml = read('404.html');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e)); failed++; }
}

function injectedCss() {
    const m = src.match(/style\.textContent = (?:'[^']*'|\s*\+\s*)+/);
    assert.ok(m, 'injected stylesheet');
    // Pull the string-literal concatenation starting at style.textContent
    const start = src.indexOf('style.textContent = ');
    const end = src.indexOf('document.head.appendChild(style)', start);
    assert.ok(start > 0 && end > start);
    const expr = src.slice(start + 'style.textContent = '.length, end).replace(/;\s*$/, '');
    return vm.runInNewContext(expr, {});
}

test('service worker and script pins are v2731', function () {
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2731'"));
    assert.ok(indexHtml.includes('global-chat.js?v=20261126_v2731'));
    assert.ok(!indexHtml.includes('global-chat.js?v=20261119_v2682'));
    assert.strictEqual(indexHtml, notFoundHtml);
});

test('desktop CSS makes the panel taller and stops below the title', function () {
    const css = injectedCss();
    assert.ok(css.includes('@media(min-width:901px)'));
    assert.ok(css.includes('height:calc(100vh - var(--chat-title-bottom, 12px) - 8px)'));
    assert.ok(css.includes('max-height:none'));
    assert.ok(!/@media\(min-width:901px\)[^}]*max-height:700px/.test(css));
});

test('mobile still uses 92vh and is not capped by the desktop height rule', function () {
    assert.ok(src.includes("(_isMobChat ? '92vh' : '80vh')"));
    assert.ok(src.includes("(_isMobChat ? '100vh' : '700px')"));
    const css = injectedCss();
    // The new height/max-height rules live only inside the 901px media query.
    const desktop = css.match(/@media\(min-width:901px\)\{#chatOverlay\{[^}]+\}/)[0];
    assert.ok(desktop.includes('max-height:none'));
    const outside = css.replace(/@media\(min-width:901px\)\{#chatOverlay\{[^}]+\}\}/, '');
    assert.ok(!outside.includes('100vh - var(--chat-title-bottom'));
    assert.ok(!outside.includes('max-height:none'));
});

test('the pinned banner gap is closed with CSS, including on mobile', function () {
    const css = injectedCss();
    const rule = '#globalChatMessages:has(#chatPinnedBanner){padding-top:0';
    assert.ok(css.includes(rule));
    const mediaEnd = css.indexOf('}', css.indexOf('@media(min-width:901px)'));
    assert.ok(css.indexOf(rule) > mediaEnd, 'gap fix is not desktop-only');
});

function loadSync(opts) {
    opts = opts || {};
    const start = src.indexOf('function syncChatTitleClearance()');
    const end = src.indexOf('function bindChatTitleClearance()', start);
    assert.ok(start > 0 && end > start);
    const fnSrc = src.slice(start, end);
    const styles = {};
    const titleRects = opts.titleVisible ? [{ bottom: opts.titleBottom || 160 }] : [];
    const heroDisplay = opts.heroHidden ? 'none' : 'block';
    const title = opts.hasTitle === false ? null : {
        getClientRects: function () { return titleRects; },
        getBoundingClientRect: function () { return { bottom: opts.titleBottom || 160 }; }
    };
    const hero = opts.hasHero === false ? null : {};
    const documentObj = {
        documentElement: {
            style: { setProperty: function (k, v) { styles[k] = v; } }
        },
        querySelector: function (sel) { return sel === 'h1.home-title' ? title : null; },
        getElementById: function (id) { return id === 'homeHero' ? hero : null; }
    };
    const windowObj = { innerWidth: opts.width == null ? 1200 : opts.width };
    function getComputedStyle(el) {
        if (el === hero) return { display: heroDisplay, visibility: 'visible' };
        return { display: 'block', visibility: 'visible' };
    }
    windowObj.getComputedStyle = getComputedStyle;
    const context = {
        window: windowObj,
        document: documentObj,
        Math: Math,
        getComputedStyle: getComputedStyle
    };
    vm.runInNewContext(fnSrc + '\nsyncChatTitleClearance();', context);
    return styles;
}

test('a visible homepage title sets --chat-title-bottom to its bottom edge', function () {
    const styles = loadSync({ titleVisible: true, titleBottom: 172, width: 1400 });
    assert.strictEqual(styles['--chat-title-bottom'], '172px');
});

test('a hidden signed-in title falls back to a 12px top gap', function () {
    const styles = loadSync({ titleVisible: true, titleBottom: 172, heroHidden: true, width: 1400 });
    assert.strictEqual(styles['--chat-title-bottom'], '12px');
});

test('mobile widths do not change the title clearance variable for layout', function () {
    const styles = loadSync({ titleVisible: true, titleBottom: 172, width: 390 });
    assert.strictEqual(styles['--chat-title-bottom'], '12px');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
