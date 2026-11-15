#!/usr/bin/env node
// N3/N4 C1: irl_events doc ids, emoji and coverUrl are attacker-chosen. The
// served irl-sync.js must render them inert in the public event grid and the
// detail sheet, handlers must get the raw id back from data-* attributes, and
// irl-sync.js must be the terser build of irl-sync.js.src.
// Loads utils.js and nacho-qa.js first, like the live page.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const root = process.env.BQ_ROOT || path.join(__dirname, '..');
const { JSDOM } = require(path.join(__dirname, 'rules', 'node_modules', 'jsdom'));

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push([name, fn]); }

const P1 = 'x"><img src=x id=pwn1 onerror=window.__pwn=1>';
const P2 = "a'),window.__pwn=2,('";
const SPOOF = 'z"><img src=x id=pwn3 onerror=window.__pwn=3>';
const GOOD = 'EvGoodEvGoodEvGood12';
const EMOJI = '<img src=x id=pwn4 onerror=window.__pwn=4>';
const COVER1 = "https://x.example/a.png) center;}</style><img src=x id=pwn5 onerror=window.__pwn=5>";
const COVER2 = 'https://x.example/a.png");background:url(javascript:alert(1));x:("';
const LINK = 'https://meetup.example/e?a=1&b=2';
const FUTURE = '2031-01-01T18:00:00.000Z';

function makeWindow(events) {
    const dom = new JSDOM('<!doctype html><html><body><div id="forumContainer"></div></body></html>',
        { url: 'https://bitcoineducation.quest/', runScripts: 'dangerously', pretendToBeVisual: true });
    const w = dom.window;
    const errors = [];
    w.addEventListener('error', function (e) { errors.push(String(e.message || e.error)); });
    const updates = [];
    function snapOf(list) {
        const docs = list.map(function (d) { return { id: d.id, exists: true, data: function () { return d.data; } }; });
        return { empty: docs.length === 0, size: docs.length, docs: docs, forEach: function (f) { docs.forEach(f); } };
    }
    const col = {
        where: function () { return col; }, orderBy: function () { return col; }, limit: function () { return col; },
        get: function () { return Promise.resolve(snapOf(events)); },
        add: function () { return Promise.resolve({ id: 'AAAAAAAAAAAAAAAAAAAA' }); },
        doc: function (id) {
            return {
                get: function () { const d = events.find(function (x) { return x.id === id; }); return Promise.resolve({ exists: !!d, id: id, data: function () { return d && d.data; } }); },
                update: function (u) { updates.push([id, u]); return Promise.resolve(); },
                delete: function () { return Promise.resolve(); },
            };
        },
    };
    const db = { collection: function () { return col; } };
    const auth = { currentUser: { uid: 'host1', isAnonymous: false, displayName: 'phil' }, onAuthStateChanged: function () {} };
    w.firebase = {
        firestore: Object.assign(function () { return db; }, { FieldValue: { serverTimestamp: function () { return 0; }, arrayUnion: function (x) { return ['+', x]; }, arrayRemove: function (x) { return ['-', x]; } } }),
        auth: function () { return auth; },
    };
    w.localStorage.setItem('btc_irl_rules_accepted', '1');
    w.__pwn = 0;
    function load(file) {
        try { w.eval(fs.readFileSync(path.join(root, file), 'utf8') + '\n//# sourceURL=' + file); } catch (e) { errors.push(file + ': ' + e.message); }
    }
    load('utils.js');
    load('nacho-qa.js');
    load('irl-sync.js');
    w.__real = { viewEvent: w.viewEvent, toggleRSVP: w.toggleRSVP, editEvent: w.editEvent };
    w.__calls = [];
    ['viewEvent', 'toggleRSVP', 'editEvent', 'deleteEvent', 'submitEditEvent', 'showToast'].forEach(function (n) {
        w[n] = function () { w.__calls.push([n].concat(Array.prototype.slice.call(arguments))); };
    });
    return { w: w, errors: errors, updates: updates };
}
function noInjection(w, where) {
    ['pwn1', 'pwn3', 'pwn4', 'pwn5'].forEach(function (id) {
        assert.strictEqual(w.document.getElementById(id), null, where + ': injected element #' + id);
    });
    assert.strictEqual(w.document.querySelectorAll('img[src="x"]').length, 0, where + ': injected img');
    assert.strictEqual(w.__pwn, 0, where + ': handler code ran');
    w.document.querySelectorAll('[style]').forEach(function (el) {
        const st = el.getAttribute('style');
        assert.ok(!/url\(\s*['"]?\s*javascript:/i.test(st), where + ': javascript: url in a style');
        // every url( is one quoted url('...') with nothing inside able to close it early
        assert.ok(st.replace(/url\('[^'"()\s<>\\]*'\)/g, '').indexOf('url(') === -1, where + ': unsafe url() in a style: ' + st.slice(0, 200));
    });
}
async function settle(w, sel) {
    for (let i = 0; i < 50 && !w.document.querySelector(sel); i++) await new Promise(function (r) { setTimeout(r, 10); });
}
function events() {
    return [
        { id: P1, data: { title: 'Payload id', date: FUTURE, locationName: 'Pub', hostId: 'host1', hostName: 'phil', attendees: ['u9'], emoji: EMOJI } },
        { id: GOOD, data: { id: SPOOF, title: 'Spoofed id field', date: FUTURE, locationName: 'Bar', hostId: 'u2', attendees: [], attendeesCount: '<b id=pwn4>', coverUrl: COVER1, link: LINK } },
        { id: P2, data: { title: 'Cover two', date: FUTURE, locationName: 'Hall', hostId: 'u3', attendees: [], coverUrl: COVER2 } },
        { id: 'EvOkEvOkEvOkEvOkEvOk', data: { title: 'Normal', date: FUTURE, locationName: 'Cafe', hostId: 'u4', attendees: [], emoji: '⚡', coverUrl: 'https://cdn.example/c.png?x=1&y=2' } },
    ];
}

test('irl-sync.js is the terser build of irl-sync.js.src', function () {
    let built;
    try {
        built = execFileSync('terser', [path.join(root, 'irl-sync.js.src'), '--compress', 'passes=2', '--mangle'], { encoding: 'utf8' });
    } catch (e) {
        if (e.code === 'ENOENT') { console.log('    (terser not installed: sync check skipped)'); return; }
        throw e;
    }
    assert.strictEqual(built.trim(), fs.readFileSync(path.join(root, 'irl-sync.js'), 'utf8').trim(), 'irl-sync.js is stale: rebuild from irl-sync.js.src');
});

test('event grid: payload ids, emoji, counts and covers render inert; handlers get raw ids', async function () {
    const { w, errors } = makeWindow(events());
    w.renderIRLSync();
    await settle(w, '.event-card');
    const grid = w.document.getElementById('eventGrid');
    assert.ok(grid && grid.querySelectorAll('.event-card').length === 4, 'grid not rendered: ' + errors.join(' | '));
    noInjection(w, 'grid');
    const ids = Array.prototype.map.call(grid.querySelectorAll('.event-card'), function (c) { return c.getAttribute('data-irl-id'); });
    assert.deepStrictEqual(ids, [P1, GOOD, P2, 'EvOkEvOkEvOkEvOkEvOk'], 'a stored id field must not replace the doc id');
    assert.strictEqual(grid.querySelectorAll('[id^="rsvp-"]').length, 0, 'ids no longer built from doc ids');
    w.__calls.length = 0;
    grid.querySelectorAll('[onclick]').forEach(function (el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: false })); });
    noInjection(w, 'grid after clicks');
    const views = w.__calls.filter(function (c) { return c[0] === 'viewEvent'; }).map(function (c) { return c[1]; });
    const rsvps = w.__calls.filter(function (c) { return c[0] === 'toggleRSVP'; }).map(function (c) { return c[1]; });
    assert.deepStrictEqual(views, [P1, GOOD, P2, 'EvOkEvOkEvOkEvOkEvOk']);
    assert.deepStrictEqual(rsvps, [P1, GOOD, P2, 'EvOkEvOkEvOkEvOkEvOk']);
    assert.ok(!w.__calls.some(function (c) { return c.indexOf(SPOOF) !== -1; }), 'spoofed id reached a handler');
    const cards = grid.querySelectorAll('.event-card');
    // emoji payload falls back to the default; a real emoji still shows
    assert.ok(cards[0].textContent.indexOf('🧡') !== -1);
    assert.ok(cards[0].textContent.indexOf('<img') === -1);
    // bad covers fall back to the gradient, a normal https cover keeps its & query intact
    // a cover that tries to break out of url() is percent-encoded and stays one url('...')
    assert.ok(/^height:160px;background:url\('https:\/\/x\.example\/a\.png%22%29;background:url%28javascript:alert%281%29%29;x:%28%22'\) center\/cover no-repeat;$/.test(cards[2].children[0].getAttribute('style')), cards[2].children[0].getAttribute('style'));
    assert.ok(/linear-gradient/.test(cards[0].children[0].getAttribute('style')), 'no cover: gradient');
    const okStyle = cards[3].children[0].getAttribute('style');
    assert.ok(okStyle.indexOf("url('https://cdn.example/c.png?x=1&y=2')") !== -1, okStyle);
    assert.ok(/attending/.test(cards[1].textContent) && cards[1].textContent.indexOf('<b') === -1);
});

test('real toggleRSVP finds the count and button for a payload id', async function () {
    const { w, updates } = makeWindow(events());
    w.renderIRLSync();
    await settle(w, '.event-card');
    await w.__real.toggleRSVP(P1);
    noInjection(w, 'rsvp');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(updates)), [[P1, { attendees: ['+', 'host1'] }]]);
    const card = w.document.querySelector('.event-card');
    assert.ok(/2 attending/.test(card.textContent), card.textContent);
    assert.ok(/I'm Going/.test(card.querySelector('[data-rsvp-btn]').textContent));
});

test('detail sheet and edit form: payload id, cover and fields inert; buttons pass the raw id', async function () {
    const { w, errors } = makeWindow(events());
    for (const id of [P1, GOOD, P2]) {
        const old = w.document.getElementById('eventDetailOverlay'); if (old) old.remove();
        await w.__real.viewEvent(id);
        const o = w.document.getElementById('eventDetailOverlay');
        assert.ok(o, 'detail not opened for ' + id + ': ' + errors.join(' | '));
        noInjection(w, 'detail ' + id);
        const n = o.querySelectorAll('[onclick]').length;
        const got = [];
        for (let i = 0; i < n; i++) {
            const prev = w.document.getElementById('eventDetailOverlay'); if (prev) prev.remove();
            await w.__real.viewEvent(id);
            w.__calls.length = 0;
            w.document.getElementById('eventDetailOverlay').querySelectorAll('[onclick]')[i].dispatchEvent(new w.MouseEvent('click', { bubbles: false }));
            got.push.apply(got, w.__calls);
        }
        noInjection(w, 'detail clicks ' + id);
        assert.ok(got.some(function (c) { return c[0] === 'toggleRSVP' && c[1] === id; }), JSON.stringify(got));
        if (id === P1) {
            assert.ok(got.some(function (c) { return c[0] === 'editEvent' && c[1] === P1; }));
            assert.ok(got.some(function (c) { return c[0] === 'deleteEvent' && c[1] === P1; }));
        }
        assert.ok(!got.some(function (c) { return c.indexOf(SPOOF) !== -1; }));
    }
    // the event link keeps its & (escaped once, not twice)
    const prev = w.document.getElementById('eventDetailOverlay'); if (prev) prev.remove();
    await w.__real.viewEvent(GOOD);
    const a = w.document.querySelector('#eventDetailOverlay a[href]');
    assert.ok(a && a.getAttribute('href') === LINK, a && a.getAttribute('href'));
    // edit form for the host
    await w.__real.editEvent(P1);
    const e = w.document.getElementById('editEventOverlay');
    assert.ok(e, 'edit form not opened');
    noInjection(w, 'edit form');
    w.__calls.length = 0;
    e.querySelector('#editEvBtn').dispatchEvent(new w.MouseEvent('click', { bubbles: false }));
    assert.deepStrictEqual(Array.from(w.__calls[0] || []), ['submitEditEvent', P1]);
});

test('cover URL helper: https only, re-serialized and percent-encoded; strict data:image', function () {
    const { w } = makeWindow([]);
    const c = w.__irlHelpers.coverCss;
    assert.strictEqual(c('javascript:alert(1)', true), '');
    assert.strictEqual(c('http://x.example/a.png', true), '');
    assert.strictEqual(c('data:text/html;base64,PHNjcmlwdD4=', true), '');
    assert.strictEqual(c('data:image/png;base64,AAAA', false), '');
    assert.strictEqual(c('data:image/png;base64,AAAA', true), "url('data:image/png;base64,AAAA')");
    assert.strictEqual(c('data:image/png;base64,AA")x', true), '');
    const out = c(COVER2, false);
    assert.ok(/^url\('https:\/\/x\.example\/[^'"()\s<>]*'\)$/.test(out), out);
    assert.strictEqual(w.__irlHelpers.emoji('⚡'), '⚡');
    assert.strictEqual(w.__irlHelpers.emoji('🧑‍💻'), '🧑‍💻');
    assert.strictEqual(w.__irlHelpers.emoji(EMOJI), '🧡');
    assert.strictEqual(w.__irlHelpers.emoji('abc'), '🧡');
});

(async function () {
    for (const [name, fn] of queue) {
        try { await fn(); passed++; console.log('  ok  ' + name); }
        catch (e) { failed++; console.log('  FAIL ' + name + ': ' + (e && e.message || e)); }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
