#!/usr/bin/env node
'use strict';
// Nacho Mode moves the URL to /app/nacho (and go() to /app/<id>). Lazy and
// on-demand script srcs must be root-relative, or they load /app/<file>
// (live /app/meetup-box.js returned the 404 page). Found Nov 17, fixed Nov 19.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (n) => fs.readFileSync(path.join(root, n), 'utf8');
const html = read('index.html');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('\u2705 ' + name); passed++; }
    catch (e) { console.log('\u274c ' + name + ': ' + e.message); failed++; }
}

function listSrcs(startNeedle, endNeedle) {
    const i = html.indexOf(startNeedle);
    const j = html.indexOf(endNeedle, i);
    assert.ok(i > 0 && j > i, startNeedle);
    return (html.slice(i, j).match(/'[^'\s]+\.js\?v=[^']+'/g) || []).map((s) => s.slice(1, -1));
}

test('index.html and 404.html stay identical', () => {
    assert.strictEqual(html, read('404.html'));
});

test('every priority, lazy and hash-route script is root-relative and resolves outside /app/', () => {
    const lists = [
        listSrcs('var _priorityScripts = [', '];'),
        listSrcs('var _lazyScripts = [', '];'),
        listSrcs('var _hashScripts = {', '};'),
    ];
    assert.ok(lists[1].length >= 25, 'lazy list found');
    assert.ok(lists[1].indexOf('/meetup-box.js?v=20260401') !== -1);
    lists.forEach((l) => l.forEach((src) => {
        assert.strictEqual(src.charAt(0), '/', src);
        assert.notStrictEqual(src.charAt(1), '/', 'not protocol-relative: ' + src);
        const u = new URL(src, 'https://bitcoineducation.quest/app/nacho');
        assert.strictEqual(u.pathname.indexOf('/app/'), -1, src);
    }));
});

function hasScriptSandbox(tags) {
    const sb = {
        document: { querySelector: (sel) => {
            const m = /^script\[src="([^"]*)"\]$/.exec(sel);
            return m && tags.indexOf(m[1]) !== -1 ? {} : null;
        } },
    };
    sb.window = sb;
    vm.createContext(sb);
    const i = html.indexOf('window.bqHasScript = function');
    const j = html.indexOf('};', i) + 2;
    vm.runInContext(html.slice(i, j), sb);
    return sb;
}

test('bqHasScript matches the root-relative and the old relative form, and refuses odd input', () => {
    const sb = hasScriptSandbox(['/learning-quests.js?v=1', 'quests.js?v=2']);
    assert.strictEqual(sb.bqHasScript('/learning-quests.js?v=1'), true, 'static root tag');
    assert.strictEqual(sb.bqHasScript('learning-quests.js?v=1'), true);
    assert.strictEqual(sb.bqHasScript('/quests.js?v=2'), true, 'older relative tag still counts');
    assert.strictEqual(sb.bqHasScript('/quests.js?v=3'), false, 'other version');
    assert.strictEqual(sb.bqHasScript(''), false);
    assert.strictEqual(sb.bqHasScript('/x.js"]'), false);
    assert.ok(html.indexOf('window.bqHasScript = function') < html.indexOf('var _priorityScripts'), 'defined before the loaders');
    assert.ok(/function _injectScript\(src\) \{\s*if \(window\.bqHasScript\(src\)\) return;/.test(html));
    assert.ok(html.includes('return !window.bqHasScript(src);'));
});

test('on-demand loaders in app code use root-relative srcs and tolerant lookups', () => {
    const app = read('app.js');
    assert.ok(app.includes("s.src = '/nacho-qa.js?v=' + Date.now();"));
    assert.ok(app.includes("_popS.src = '/proof-of-play.js?v=20261031_v2447';"));
    assert.ok(app.includes("var _certSrc = '/shareable-certs.js?v=20261028_v2410';"));
    const mux = read('mobile-ux.js');
    assert.ok(mux.includes("window.SCHOLAR_SCRIPT = '/scholar.js?v=20261105_v2490';"));
    assert.ok(mux.includes("document.querySelector('script[src^=\"/scholar.js\"]')"));
    assert.ok(mux.includes("'/lightning.js?v=20261023_v2323'") && mux.includes("'/wallet-router.js?v=20261104_v2482'"));
    assert.ok(mux.includes("loadScriptOnce('/proof-of-play.js?v=20261031_v2447')"));
    assert.strictEqual((read('ranking.js').match(/s\.src = '\/notifications\.js\?v=20261105_v2497'/g) || []).length, 2);
    assert.ok(read('ranking.js').includes("_qs.src = '/quests.js'"));
    assert.ok(read('global-chat.js').includes("s.src = '/quests.js?v=20261106_v2509'"));
    assert.ok(read('learning-quests.js').includes("window.SCHOLAR_SCRIPT || '/scholar.js'"));
    assert.ok(read('pvp-lobby-alert.js').includes("var src = '/pvp.js?v=20261118_v2605';"));
    const q = read('quests.js');
    assert.ok(q.includes("'/data/trivia-bank.js?v=20261030_v2435'") && q.includes("'/data/poll-bank.js?v=20260528'"));
    // No same-origin relative script src literal is left in these files.
    ['app.js', 'mobile-ux.js', 'ranking.js', 'global-chat.js', 'learning-quests.js', 'pvp-lobby-alert.js', 'quests.js', 'admin-panel.js'].forEach((f) => {
        const bad = read(f).match(/\.src\s*=\s*'(?!\/|https:)[a-z0-9][^']*\.js/g);
        assert.strictEqual(bad, null, f + ': ' + bad);
    });
    assert.ok(read('bundle.src.js').includes("window.SCHOLAR_SCRIPT = '/scholar.js?v=20261105_v2490';"), 'bundle rebuilt');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
