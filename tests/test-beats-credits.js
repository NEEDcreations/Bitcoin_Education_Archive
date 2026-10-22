#!/usr/bin/env node
// Source checks for Bitcoin Beats credits, hidden tracks, stream URLs, and CSP.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

test('player credits escape text and allowlist https links', function () {
    const beats = read('beats.js');
    assert.ok(beats.includes('function _beatsCreditHtml'));
    assert.ok(beats.includes('function _beatsShortCredit'));
    assert.ok(beats.includes("id=\"beatsCreditLine\"") || beats.includes("id='beatsCreditLine'") || beats.includes('id="beatsCreditLine"') || beats.includes("beatsCreditLine"));
    assert.ok(beats.includes('creditEl.textContent'));
    assert.ok(beats.includes('creativecommons.org'));
    assert.ok(beats.includes('incompetech.com'));
    assert.ok(beats.includes("short !== 'CC BY' && short !== 'CC BY-SA'"));
    assert.ok(beats.includes("'by-nc-nd': 'CC BY-NC-ND'"));
    assert.ok(beats.includes('function _beatsDeedUrl'));
    assert.ok(beats.includes('/terms.html#open-music-credits'));
    const src = beats.slice(beats.indexOf('function _beatsAudioSrc'), beats.indexOf('function _beatsAudioSrc') + 400);
    assert.ok(src.indexOf('streamUrl') < src.indexOf('audioUrl'));
    assert.ok(beats.includes('data.hidden === true'));
});

test('terms credit Kevin MacLeod and the open licenses', function () {
    const terms = read('terms.html');
    assert.ok(terms.includes('id="open-music-credits"'));
    assert.ok(terms.includes('Kevin MacLeod (incompetech.com)'));
    assert.ok(terms.includes('Licensed under Creative Commons: By Attribution 4.0 License'));
    assert.ok(terms.includes('http://creativecommons.org/licenses/by/4.0/'));
    assert.ok(terms.includes('https://creativecommons.org/licenses/by/4.0/'));
    assert.ok(terms.includes('https://zine.wavlake.com/open-music/'));
    assert.ok(terms.includes('https://archive.org/'));
    assert.ok(terms.includes('including NonCommercial licenses'));
});

test('archive.org tracks get a credit line from the stored license', function () {
    const vm = require('vm');
    const context = {
        console: console,
        navigator: {},
        setTimeout: function () {},
        setInterval: function () {},
        clearInterval: function () {},
        localStorage: { getItem: function () { return null; }, setItem: function () {} },
        location: { hash: '' }
    };
    context.escapeHtml = function (str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };
    context.window = context;
    context.document = {
        getElementById: function () { return null; },
        addEventListener: function () {},
        createTextNode: function (text) { return { textContent: String(text) }; },
        createElement: function () {
            const node = { style: {}, child: '' };
            node.appendChild = function (kid) { node.child = kid.textContent || ''; };
            Object.defineProperty(node, 'innerHTML', {
                get: function () { return node.child; },
                set: function (value) { node.child = value; }
            });
            return node;
        }
    };
    context.window.addEventListener = function () {};
    vm.createContext(context);
    vm.runInContext(read('beats.js'), context, { filename: 'beats.js' });
    const track = {
        title: 'Vestigial',
        artist: 'Torn Flesh Records',
        source: 'archive.org',
        sourceUrl: 'https://archive.org/details/TFR100-VA-TornFleshRecordsPresentsVestigialSickness',
        archiveLicense: 'http://creativecommons.org/licenses/by-nc-nd/3.0/'
    };
    const html = context._beatsCreditHtml(track);
    assert.ok(html.indexOf('id="beatsCreditLine"') !== -1);
    assert.ok(html.indexOf('CC BY-NC-ND 3.0') !== -1);
    assert.ok(html.indexOf('https://creativecommons.org/licenses/by-nc-nd/3.0/') !== -1);
    assert.ok(html.indexOf('Internet Archive') !== -1);
    assert.strictEqual(context._beatsShortCredit(track), '');
    const by = context._beatsShortCredit({
        title: 'Aces High', artist: 'Kevin MacLeod', source: 'incompetech', license: 'CC BY 4.0'
    });
    assert.strictEqual(by, 'CC BY · incompetech');
    const upload = context._beatsCreditHtml({ title: 'My Upload', artist: 'Phil' });
    assert.ok(upload.indexOf('My Upload') !== -1);
    assert.ok(upload.indexOf('Phil') !== -1);
});

test('clients cannot write catalog credit or hide fields', function () {
    const rules = read('firestore.rules');
    assert.ok(rules.includes('function beatsCatalogUntouched()'));
    assert.ok(rules.includes('function beatsCatalogLocked()'));
    ['hidden', 'hiddenReason', 'needsReview', 'streamUrl', 'license', 'licenseUrl', 'attribution', 'v4vSplits'].forEach(function (field) {
        assert.ok(rules.includes("'" + field + "'"), field);
    });
});

test('CSP media-src allows the stream hosts and not every https origin', function () {
    const hosting = read('firebase.json');
    const worker = read('workers/seo-router/worker.js');
    [hosting, worker].forEach(function (src) {
        assert.ok(src.includes('https://op3.dev'));
        assert.ok(src.includes('https://d12wklypp119aj.cloudfront.net'));
        assert.ok(src.includes('https://incompetech.com'));
        assert.ok(src.includes('https://archive.org'));
        assert.ok(!src.includes("media-src 'self' blob: https:"));
    });
    assert.strictEqual((hosting.match(/media-src 'self' blob: data:/g) || []).length, 2);
});

test('patch notes and cache busters announce the catalog', function () {
    const notes = read('patch-notes.html');
    assert.ok(notes.includes('Bitcoin Beats adds 1,600+ new free-to-use tracks, with proper credit for every artist.'));
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(html.includes('beats.js?v=20261022_v2276'));
    assert.ok(read('sw.js').includes("const CACHE_NAME = 'btc-archive-v2276'"));
});

test('DJ and Nacho skip hidden tracks and prefer streamUrl', function () {
    const chat = read('global-chat.js');
    const fn = read('functions/index.js');
    const bridge = read('workers/chat-bridge/worker.js');
    assert.ok(chat.includes('function djPlayableUrl'));
    assert.ok(chat.includes('track.hidden === true'));
    assert.ok(chat.includes('trackAudioUrl: djPlayableUrl(track)'));
    assert.ok(fn.includes('track.hidden === true'));
    assert.ok(fn.includes('t.streamUrl'));
    assert.ok(bridge.includes('function beatsPlayableUrl'));
    assert.ok(bridge.includes('t.hidden === true'));
    assert.ok(bridge.includes('t.streamUrl'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
