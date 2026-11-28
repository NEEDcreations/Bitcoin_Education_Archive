#!/usr/bin/env node
// Beats Discover filters, display tags, upload dates, catalog cache, and App Profile fallback.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

const beats = read('beats.js');
const chat = read('global-chat.js');
const sw = read('sw.js');
const html = read('index.html');
const html404 = read('404.html');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        const r = fn();
        if (r && typeof r.then === 'function') {
            return r.then(function() { console.log('✅ ' + name); passed++; }).catch(function(e) {
                console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e)); failed++;
            });
        }
        console.log('✅ ' + name); passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e)); failed++;
    }
    return Promise.resolve();
}

function setup() {
    const documentEls = {};
    const local = {};
    const sandbox = {
        window: {},
        document: {
            getElementById: function(id) { return documentEls[id] || null; },
            querySelectorAll: function() { return []; },
            createElement: function() { return { style: {}, appendChild: function() {} }; },
            head: { appendChild: function() {} },
            body: { appendChild: function() {} }
        },
        localStorage: {
            getItem: function(k) { return Object.prototype.hasOwnProperty.call(local, k) ? local[k] : null; },
            setItem: function(k, v) { local[k] = String(v); },
            removeItem: function(k) { delete local[k]; }
        },
        escapeHtml: function(s) { return String(s).replace(/[&<>"']/g, function(c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); },
        sanitizeUrl: function(u) { return String(u || ''); },
        getLevel: function(pts) { return { emoji: '🎵', name: 'Learner', points: pts || 0 }; },
        beatsSlot: function(s) { return sandbox.escapeHtml(s); },
        console: { log: function() {}, warn: function() {}, error: function() {} },
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        Promise: Promise,
        Date: Date,
        Array: Array,
        Object: Object,
        String: String,
        Number: Number,
        Boolean: Boolean,
        Math: Math,
        JSON: JSON,
        isNaN: isNaN
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    const start = beats.indexOf('// ---- Track tags, dates, catalog cache (display only) ----');
    const end = beats.indexOf('// ---- Global Persistent Player', start);
    assert.ok(start > 0 && end > start, 'helper block bounds');
    vm.runInNewContext(beats.slice(start, end), sandbox);
    sandbox.__els = documentEls;
    sandbox.__local = local;
    return sandbox;
}

const queue = [];
queue.push(test('index.html and 404.html stay identical at v2744 pins', function() {
    assert.strictEqual(html, html404);
    assert.ok(html.includes('beats.js?v=20261128_v2744'));
    assert.ok(html.includes('global-chat.js?v=20261128_v2746'));
    assert.ok(!html.includes('beats.js?v=20261119_v2666'));
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2747'"));
    assert.ok(!sw.includes("const CACHE_NAME = 'btc-archive-v2690'"));
}));

queue.push(test('direct uploads get a BQ Artist tag', function() {
    const w = setup();
    const tags = w.beatsTrackTags({ copyrightConfirmed: true, authorName: 'alice', title: 'Song' });
    assert.strictEqual(tags.bqArtist, true);
    assert.strictEqual(tags.v4v, false);
    assert.strictEqual(tags.ai, false);
    assert.strictEqual(tags.verified, false);
    assert.ok(w.beatsTagsHtml(tags).indexOf('BQ Artist') !== -1);
}));

queue.push(test('V4V splits and import flags produce a V4V tag', function() {
    const w = setup();
    const fromSplits = w.beatsTrackTags({ v4vSplits: [{ split: 1 }], authorName: 'wav' });
    assert.strictEqual(fromSplits.v4v, true);
    const fromImport = w.beatsTrackTags({ imported: true, authorName: 'wav' });
    assert.strictEqual(fromImport.v4v, true);
    assert.ok(w.beatsTagsHtml(fromSplits).indexOf('V4V') !== -1);
}));

queue.push(test('NEEDcreations tracks are tagged AI unless Verified', function() {
    const w = setup();
    const ai = w.beatsTrackTags({ authorName: 'NEEDcreations' });
    assert.strictEqual(ai.ai, true);
    const alsoArtist = w.beatsTrackTags({ artist: 'needcreations' });
    assert.strictEqual(alsoArtist.ai, true);
    const verified = w.beatsTrackTags({ authorName: 'NEEDcreations', verified: true });
    assert.strictEqual(verified.verified, true);
    assert.strictEqual(verified.ai, false);
    assert.ok(w.beatsTagsHtml(ai).indexOf('>AI<') !== -1);
    assert.ok(w.beatsTagsHtml(verified).indexOf('Verified') !== -1);
    assert.ok(w.beatsTagsHtml(verified).indexOf('>AI<') === -1);
}));

queue.push(test('a username or title cannot self-set Verified', function() {
    const w = setup();
    const tags = w.beatsTrackTags({ authorName: 'Verified', artist: 'admin', title: 'I am verified', verified: 'yes', bqArtist: 'yes' });
    assert.strictEqual(tags.verified, false);
    assert.strictEqual(tags.bqArtist, false);
    assert.strictEqual(tags.ai, false);
}));

queue.push(test('aiDeclared is honored and upload tags never write verified', function() {
    const w = setup();
    const tags = w.beatsTrackTags({ aiDeclared: true, authorName: 'bob' });
    assert.strictEqual(tags.ai, true);
    assert.ok(beats.indexOf('_beatsApplyUploadTags(trackData)') !== -1);
    assert.ok(beats.indexOf('if (_beatsAiDeclaredChecked()) trackData.aiDeclared = true;') !== -1);
    assert.ok(!/_beatsApplyUploadTags[\s\S]{0,200}verified\s*=/.test(beats));
    assert.ok(beats.indexOf('id="beatsUpAiDeclared"') !== -1);
}));

queue.push(test('newest sort can show a short upload date', function() {
    const w = setup();
    const date = w.beatsUploadDateText(new Date('2026-11-26T12:00:00Z'));
    assert.ok(date);
    assert.ok(/2026/.test(date));
    const htmlMeta = w.beatsTrackMetaHtml({ createdAt: new Date('2026-11-26T12:00:00Z'), copyrightConfirmed: true }, { showDate: true });
    assert.ok(htmlMeta.indexOf('BQ Artist') !== -1);
    assert.ok(htmlMeta.indexOf('beats-upload-date') !== -1);
    const hidden = w.beatsTrackMetaHtml({ createdAt: new Date('2026-11-26T12:00:00Z') }, { showDate: false });
    assert.ok(hidden.indexOf('beats-upload-date') === -1);
}));

queue.push(test('source filters and Hide AI work on a catalog list', function() {
    const w = setup();
    const tracks = [
        { id: '1', copyrightConfirmed: true, authorName: 'alice' },
        { id: '2', v4vSplits: [{ split: 1 }], authorName: 'imported' },
        { id: '3', authorName: 'NEEDcreations' },
        { id: '4', aiDeclared: true, authorName: 'dave' }
    ];
    w._beatsSourceFilter = 'bq';
    w._beatsHideAI = false;
    assert.deepStrictEqual(w.beatsFilterTracks(tracks).map(function(t) { return t.id; }), ['1']);
    w._beatsSourceFilter = 'v4v';
    assert.deepStrictEqual(w.beatsFilterTracks(tracks).map(function(t) { return t.id; }), ['2']);
    w._beatsSourceFilter = 'ai';
    assert.deepStrictEqual(w.beatsFilterTracks(tracks).map(function(t) { return t.id; }), ['3', '4']);
    w._beatsSourceFilter = '';
    w._beatsHideAI = true;
    assert.deepStrictEqual(w.beatsFilterTracks(tracks).map(function(t) { return t.id; }), ['1', '2']);
}));

queue.push(test('App Profile uses already-fetched public profile data', function() {
    const w = setup();
    const body = { innerHTML: '' };
    w.beatsRenderAppProfileBody(body, { username: 'Chris', points: 2140, bio: 'hi <x>', photoURL: 'https://example.com/a.png' }, 'uid1');
    assert.ok(body.innerHTML.indexOf('Chris') !== -1);
    assert.ok(body.innerHTML.indexOf('2,140') !== -1 || body.innerHTML.indexOf('2140') !== -1);
    assert.ok(body.innerHTML.indexOf('hi &lt;x&gt;') !== -1);
    assert.ok(body.innerHTML.indexOf('Could not load app profile') === -1);
    assert.ok(body.innerHTML.indexOf("showUserProfile('uid1')") !== -1);
    const empty = { innerHTML: '' };
    w.beatsRenderAppProfileBody(empty, null, 'uid1');
    assert.ok(empty.innerHTML.indexOf('No app profile found') !== -1);
    // The artist page no longer does a second users read
    assert.ok(beats.indexOf('beatsRenderAppProfileBody(appBody, profileData, uid)') !== -1);
    const idx = beats.indexOf('beatsRenderAppProfileBody(appBody, profileData, uid)');
    const after = beats.slice(idx, idx + 400);
    assert.ok(after.indexOf("db.collection('users').doc(uid).get()") === -1);
}));

queue.push(test('catalog cache reuses a warm fetch', function() {
    const w = setup();
    let trackGets = 0;
    let artistGets = 0;
    function snap(rows) {
        return {
            forEach: function(fn) { rows.forEach(fn); }
        };
    }
    function doc(id, data) {
        return { id: id, data: function() { return data; }, exists: true };
    }
    w._beatsPushDocs = function(list, s) {
        if (!s || !s.forEach) return;
        s.forEach(function(d) { list.push(Object.assign({ id: d.id }, d.data())); });
    };
    w.db = {
        collection: function(name) {
            return {
                orderBy: function() {
                    return {
                        limit: function() {
                            return {
                                get: function() {
                                    if (name === 'beats_tracks') {
                                        trackGets++;
                                        return Promise.resolve(snap([doc('t1', { title: 'A', createdAt: 1 })]));
                                    }
                                    artistGets++;
                                    return Promise.resolve(snap([doc('a1', { name: 'Art' })]));
                                }
                            };
                        }
                    };
                }
            };
        }
    };
    return w.beatsGetCatalog().then(function(first) {
        assert.strictEqual(first.tracks.length, 1);
        assert.strictEqual(trackGets, 1);
        assert.strictEqual(artistGets, 1);
        return w.beatsGetCatalog();
    }).then(function(second) {
        assert.strictEqual(second.tracks[0].id, 't1');
        assert.strictEqual(trackGets, 1);
        assert.strictEqual(artistGets, 1);
        w.beatsInvalidateCatalog();
        return w.beatsGetCatalog();
    }).then(function() {
        assert.strictEqual(trackGets, 2);
        assert.strictEqual(artistGets, 2);
    });
}));

queue.push(test('Nacho Radio now-playing bar has a tags slot', function() {
    assert.ok(chat.indexOf('id="djNowPlayingTags"') !== -1);
    assert.ok(chat.indexOf('_djFillNowPlayingTags') !== -1);
    assert.ok(beats.indexOf('id="beatsNowTags"') !== -1);
    assert.ok(beats.indexOf("onclick=\"beatsSetSourceFilter('bq')\"") !== -1 || beats.indexOf("srcBtn('bq', 'BQ Artists')") !== -1);
    assert.ok(beats.indexOf('Hide AI songs') !== -1);
    assert.ok(beats.indexOf("showDate: window._beatsDiscoverSort === 'newest'") !== -1);
}));

Promise.all(queue).then(function() {
    console.log('---');
    console.log('Passed: ' + passed + '  Failed: ' + failed);
    process.exit(failed ? 1 : 0);
});
