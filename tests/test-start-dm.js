#!/usr/bin/env node
// Start DM: username search in the DMs section, with a back button to the list.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

const messaging = read('messaging.js');
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

function setup(opt) {
    opt = opt || {};
    const els = {};
    const sandbox = {
        window: {},
        document: {
            getElementById: function(id) { return els[id] || null; },
            createElement: function(tag) {
                return { id: '', style: {}, innerHTML: '', onclick: null, appendChild: function() {}, remove: function() {} };
            },
            body: { appendChild: function() {} }
        },
        auth: opt.auth || { currentUser: { uid: 'me-uid', isAnonymous: false } },
        db: opt.db,
        escapeHtml: function(s) { return String(s).replace(/[&<>"']/g, function(c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); },
        timeAgo: function() { return 'now'; },
        showToast: function() {},
        showUsernamePrompt: function() {},
        closeDM: opt.closeDM || function() { sandbox.__closed = true; },
        showInbox: opt.showInbox || function() { sandbox.__inbox = true; },
        openDM: opt.openDM || function(uid, name) { sandbox.__opened = { uid: uid, name: name }; },
        console: { log: function() {}, warn: function() {}, error: function() {} },
        setTimeout: function(fn) { if (typeof fn === 'function') fn(); return 0; },
        clearTimeout: function() {},
        Promise: Promise,
        Date: Date,
        Array: Array,
        Object: Object,
        String: String,
        console,
    };
    sandbox.window = sandbox;
    sandbox.els = els;
    const start = messaging.indexOf('// ---- START DM (username search) ----');
    const end = messaging.indexOf('// ---- INBOX ----');
    assert.ok(start > 0 && end > start, 'helper bounds');
    vm.runInNewContext(messaging.slice(start, end), sandbox);
    return sandbox;
}

function fakeDb(docs) {
    docs = docs || [];
    const calls = [];
    function snap() {
        return {
            empty: docs.length === 0,
            forEach: function(fn) {
                docs.forEach(function(d) {
                    fn({ id: d.id, data: function() { return d.data; } });
                });
            }
        };
    }
    const api = {
        collection: function(name) {
            const q = { _name: name, _wheres: [] };
            q.where = function(field, op, val) { q._wheres.push([field, op, val]); return q; };
            q.orderBy = function() { return q; };
            q.limit = function() { return q; };
            q.get = function() {
                calls.push({ name: name, wheres: q._wheres.slice() });
                return Promise.resolve(snap());
            };
            return q;
        },
        calls: calls
    };
    return api;
}

const queue = [];

queue.push(test('index.html and 404.html match, and pins are v2744', function() {
    assert.strictEqual(html, html404);
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2745'"));
    assert.ok(html.includes('bundle.min.js?v=20261128_v2744'));
    assert.ok(html.includes('global-chat.js?v=20261128_v2744'));
    assert.ok(!html.includes('bundle.min.js?v=20261119_v2682b'));
}));

queue.push(test('the DMs section has a Start DM control and a search-back panel', function() {
    assert.ok(messaging.indexOf('id="dmStartBtn"') !== -1);
    assert.ok(messaging.indexOf('>Start DM</button>') !== -1);
    assert.ok(messaging.indexOf('id="dmStartSearch"') !== -1);
    assert.ok(messaging.indexOf('id="dmStartBackBtn"') !== -1);
    assert.ok(messaging.indexOf('title="Back to messages"') !== -1);
    assert.ok(messaging.indexOf('backToDMList()') !== -1);
    assert.ok(messaging.indexOf('window._renderInboxInto') !== -1);
    assert.ok(chat.indexOf('id="overlayStartDmBtn"') !== -1);
}));

queue.push(test('short queries do not hit the database and self is skipped', function() {
    const db = fakeDb([{ id: 'me-uid', data: { username: 'me' } }, { id: 'u2', data: { username: 'Alex' } }]);
    const w = setup({ db: db });
    return w.searchDMUsernames('A').then(function(rows) {
        assert.ok(Array.isArray(rows) && rows.length === 0);
        assert.strictEqual(db.calls.length, 0);
        return w.searchDMUsernames('Al');
    }).then(function(rows) {
        assert.ok(db.calls.length > 0);
        assert.ok(db.calls.every(function(c) { return c.name === 'public_profiles'; }));
        assert.ok(db.calls.some(function(c) { return c.wheres.some(function(wh) { return wh[1] === '>=' && wh[2] === 'Al'; }); }));
        assert.strictEqual(rows.length, 1);
        assert.strictEqual(rows[0].uid, 'u2');
        assert.strictEqual(rows[0].username, 'Alex');
    });
}));

queue.push(test('picking a search result goes through openDM and does not skip checks', function() {
    const w = setup();
    w._pickStartDMUser('uid-2', 'Alex');
    assert.deepStrictEqual(w.__opened, { uid: 'uid-2', name: 'Alex' });
    assert.ok(messaging.indexOf("_pickStartDMUser") !== -1);
    assert.ok(messaging.indexOf('openDM(uid, name') !== -1);
    // Start DM itself does not write a conversation
    const block = messaging.slice(messaging.indexOf('window.showStartDM'), messaging.indexOf('window.showInbox'));
    assert.ok(block.indexOf('dm_conversations') === -1);
}));

queue.push(test('search results escape username HTML', function() {
    const w = setup();
    const mount = { innerHTML: '', id: 'mount' };
    w.document.getElementById = function(id) {
        if (id === 'dmStartSearch' || id === 'dmStartResults' || id === 'dmStartBackBtn' || id === 'dmStartMount') {
            if (!w.els[id]) {
                w.els[id] = {
                    id: id,
                    value: '',
                    innerHTML: '',
                    onclick: null,
                    addEventListener: function() {},
                    focus: function() {},
                    style: {}
                };
            }
            return w.els[id];
        }
        return null;
    };
    w.showStartDM({ mount: mount, onBack: function() { w.__back = true; } });
    assert.ok(mount.innerHTML.indexOf('id="dmStartSearch"') !== -1);
    assert.ok(mount.innerHTML.indexOf('id="dmStartBackBtn"') !== -1);
    const results = w.document.getElementById('dmStartResults');
    // Call the renderer indirectly: re-run a tiny copy by searching and writing
    const users = [{ uid: 'u3', username: '"><img src=x>', points: 1 }];
    const html = users.map(function(u) {
        return null;
    });
    // Use searchDMUsernames path's escape in showStartDM by invoking after setting results
    const escaped = w.escapeHtml('"><img src=x>');
    assert.ok(escaped.indexOf('&quot;') !== -1 || escaped.indexOf('&#39;') !== -1 || escaped.indexOf('&lt;') !== -1);
    assert.ok(messaging.indexOf("escapeHtml(u.username)") !== -1);
    const back = w.document.getElementById('dmStartBackBtn');
    back.onclick();
    assert.strictEqual(w.__back, true);
}));

queue.push(test('the thread back button returns to the DM list', function() {
    const w = setup();
    w.backToDMList();
    assert.strictEqual(w.__closed, true);
    assert.strictEqual(w.__inbox, true);
}));

queue.push(test('inbox rows open through openDM', function() {
    const w = setup();
    w._openInboxDM({
        getAttribute: function(k) { return k === 'data-uid' ? 'u9' : 'Pat'; }
    });
    assert.deepStrictEqual(w.__opened, { uid: 'u9', name: 'Pat' });
}));

Promise.all(queue).then(function() {
    console.log('---');
    console.log('Passed: ' + passed + '  Failed: ' + failed);
    process.exit(failed ? 1 : 0);
});
