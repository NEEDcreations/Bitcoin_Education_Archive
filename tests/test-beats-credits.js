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
    assert.ok(beats.includes("short === 'CC0' || short === 'Public Domain' || short === 'V4V'"));
    assert.ok(beats.includes('pending verification'));
    assert.ok(beats.includes('commentEventId'));
    assert.ok(beats.includes('href="/music-credits.html"'));
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
    assert.ok(terms.includes('NonCommercial and NoDerivatives'));
    assert.ok(terms.includes('/music-credits.html'));
    const creditsPage = read('music-credits.html');
    assert.ok(creditsPage.includes('1683 open-license tracks'));
    assert.ok(creditsPage.includes('Bitcoin is Hope'));
    assert.ok(creditsPage.includes('Kevin MacLeod'));
    assert.ok(creditsPage.includes('/terms.html#copyright-takedown'));
    assert.strictEqual(creditsPage.includes('<script'), false);
    assert.ok(terms.includes('If none has been resolved yet'));
    assert.ok(terms.includes('id="copyright-takedown"'));
    assert.ok(terms.includes('mailto:info.603btc@gmail.com'));
    assert.ok(terms.includes('48 hours'));
});

test('Beats links to music credits and the takedown process', function () {
    const beats = read('beats.js');
    assert.ok(beats.includes('href="/terms.html#open-music-credits"'));
    assert.ok(beats.includes('href="/terms.html#copyright-takedown"'));
    assert.ok(beats.includes('mailto:info.603btc@gmail.com'));
    assert.ok(beats.includes('href="/dmca.html"'));
    const header = beats.slice(beats.indexOf('id="beatsApp"'), beats.indexOf('beatsTabDiscover'));
    assert.ok(header.includes('#open-music-credits'));
    assert.ok(header.includes('#copyright-takedown'));
    assert.ok(header.includes('/music-credits.html'));
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
    assert.ok(html.indexOf('https://archive.org/details/TFR100-VA-TornFleshRecordsPresentsVestigialSickness') !== -1);
    const licenseAt = html.indexOf('CC BY-NC-ND 3.0');
    const sourceAt = html.indexOf('Internet Archive');
    assert.ok(html.indexOf('Vestigial') < html.indexOf('Torn Flesh Records'));
    assert.ok(html.indexOf('Torn Flesh Records') < licenseAt);
    assert.ok(licenseAt < sourceAt);
    assert.strictEqual(context._beatsShortCredit(track), 'CC BY-NC-ND · Internet Archive');
    const verbatim = context._beatsCreditHtml({
        title: 'Ignored',
        artist: 'Ignored',
        attribution: '"Aces High" Kevin MacLeod (incompetech.com) <b>exact</b>'
    });
    assert.ok(verbatim.indexOf('&lt;b&gt;exact&lt;/b&gt;') !== -1);
    assert.ok(verbatim.indexOf('<b>') === -1);
    assert.strictEqual(context._beatsShortCredit({
        attribution: '"Aces High" Kevin MacLeod (incompetech.com)',
        license: 'CC0 1.0'
    }), '"Aces High" Kevin MacLeod (incompetech.com)');
    assert.strictEqual(context._beatsShortCredit({ license: 'CC0 1.0', source: 'archive.org' }), '');
    assert.strictEqual(context._beatsShortCredit({
        title: 'Quiet', artist: 'Ada', source: 'archive.org', license: 'CC BY-NC 4.0'
    }), 'CC BY-NC · Internet Archive');
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
    assert.ok(rules.includes('function beatsModerationUpdate()'));
    assert.ok(rules.includes("hasAny(['coverUrl', 'coverArt'])"));
    assert.ok(rules.includes('existsAfter('));
    assert.ok(rules.includes('commentEventId'));
    assert.ok(rules.includes('function beatsCatalogLocked()'));
    ['hidden', 'hiddenReason', 'coverRemovedReason', 'needsReview', 'streamUrl', 'license', 'licenseUrl', 'attribution', 'v4vSplits'].forEach(function (field) {
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
        assert.ok(src.includes('https://assets.bitcoineducation.quest'));
        assert.ok(src.includes('https://*.tenor.com'));
        assert.ok(!src.includes("media-src 'self' blob: https:"));
    });
    assert.strictEqual((hosting.match(/media-src 'self' blob: data:/g) || []).length, 2);
});

test('patch notes and cache busters announce the catalog', function () {
    const notes = read('patch-notes.html');
    assert.ok(notes.includes('The open-music catalog import is ready and has not been applied yet.'));
    assert.ok(!notes.includes('1,600+ new free-to-use tracks'));
    assert.ok(notes.includes('October 22, 2026 · v2277'));
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(html.includes('beats.js?v=20261022_v2277'));
    assert.ok(!html.includes('beats.js?v=20261022_v2276'));
    assert.ok(read('sw.js').includes("const CACHE_NAME = 'btc-archive-v2277'"));
    assert.ok(!read('sw.js').includes('btc-archive-v2276'));
    assert.ok(!read('sw.js').includes('btc-archive-v2268'));
});

test('DJ and Nacho skip hidden tracks and prefer streamUrl', function () {
    const chat = read('global-chat.js');
    const fn = read('functions/index.js');
    const bridge = read('workers/chat-bridge/worker.js');
    assert.ok(chat.includes('function djPlayableUrl'));
    assert.ok(chat.includes('track.hidden === true'));
    assert.ok(chat.includes('trackAudioUrl: djPlayableUrl(track)'));
    assert.ok(fn.includes('track.hidden === true'));
    assert.ok(fn.includes('track.needsReview === true'));
    assert.ok(fn.includes('t.needsReview === true'));
    assert.ok(fn.includes('t.streamUrl'));
    assert.ok(bridge.includes('function beatsPlayableUrl'));
    assert.ok(bridge.includes('t.hidden === true'));
    assert.ok(bridge.includes('t.needsReview === true'));
    assert.ok(chat.includes('track.needsReview === true'));
    const privacy = read('privacy.html');
    assert.ok(privacy.includes('op3.dev'));
    assert.ok(privacy.includes('d12wklypp119aj.cloudfront.net'));
    assert.ok(privacy.includes('archive.org'));
    assert.ok(privacy.includes('incompetech.com'));
    assert.ok(privacy.includes('IP address'));
    assert.ok(bridge.includes('t.streamUrl'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
