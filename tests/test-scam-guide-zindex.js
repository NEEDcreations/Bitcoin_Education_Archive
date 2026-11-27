'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

const messaging = read('messaging.js');
const ranking = read('ranking.js');
const chat = read('global-chat.js');
const forum = read('forum.js');
const html = read('index.html');

assert.ok(messaging.includes('window.showFriendsInDistressWarning'), 'guide opener present');
assert.ok(messaging.includes("id=\"dmWindow\""), 'DM window present');
assert.ok(messaging.includes('showFriendsInDistressWarning()'), 'DM banner still opens the guide');
assert.ok(messaging.includes("_bqAboveModalsZ(2100010)"), 'guide uses the above-modals floor');
assert.ok(!/#distressWarning[\s\S]{0,200}z-index:10005/.test(messaging), 'old guide z-index is gone');
assert.ok(!/z-index:10005;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if\(event\.target===this\)this\.remove\(\)"/.test(messaging), 'old static 10005 style is gone');

// The friends-in-distress link currently lives only in the DM banner.
// Global chat and the forum have no such link, but the guide must still
// stack above those overlays if they are open when the DM link is tapped.
assert.ok(!chat.includes('showFriendsInDistressWarning'), 'Global chat has no distress link');
assert.ok(!forum.includes('showFriendsInDistressWarning'), 'forum has no distress link');

function extractFn(src, startMarker, endMarker) {
    const start = src.indexOf(startMarker);
    assert.ok(start >= 0, 'missing ' + startMarker);
    const end = src.indexOf(endMarker, start);
    assert.ok(end > start, 'missing end after ' + startMarker);
    return src.slice(start, end);
}

function createDocument() {
    function createElement(tag) {
        var el = {
            nodeType: 1, tagName: String(tag).toUpperCase(), id: '', className: '',
            style: {}, childNodes: [], parentNode: null, attrs: {}, innerHTML: '',
            classList: {
                _set: {},
                contains: function(c) { return !!this._set[c]; },
                add: function(c) { this._set[c] = true; },
                remove: function(c) { delete this._set[c]; }
            },
            setAttribute: function(n, v) { this.attrs[n] = String(v); },
            getAttribute: function(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n) ? this.attrs[n] : null; },
            querySelector: function() { return null; },
            remove: function() { if (this.parentNode) this.parentNode.removeChild(this); }
        };
        Object.defineProperty(el.style, 'cssText', {
            get: function() { return this._css || ''; },
            set: function(v) {
                this._css = String(v);
                var m = String(v).match(/z-index:\s*([^;]+)/i);
                if (m) this.zIndex = String(m[1]).trim();
            }
        });
        el.appendChild = function(c) {
            if (!c) return c;
            if (c.parentNode && c.parentNode !== el && c.parentNode.removeChild) c.parentNode.removeChild(c);
            el.childNodes.push(c);
            c.parentNode = el;
            el.firstChild = el.childNodes[0] || null;
            return c;
        };
        el.removeChild = function(c) {
            var i = el.childNodes.indexOf(c);
            if (i >= 0) el.childNodes.splice(i, 1);
            c.parentNode = null;
            el.firstChild = el.childNodes[0] || null;
            return c;
        };
        Object.defineProperty(el, 'innerHTML', {
            get: function() { return this._html || ''; },
            set: function(v) {
                this._html = String(v);
                this.childNodes = [];
                this.firstChild = null;
                var idm = String(v).match(/\sid="([^"]+)"/) || String(v).match(/id="([^"]+)"/);
                var zm = String(v).match(/z-index:\s*([^;]+)/i);
                if (idm) {
                    var child = createElement('div');
                    child.id = idm[1];
                    if (zm) child.style.cssText = 'z-index:' + String(zm[1]).trim();
                    this.appendChild(child);
                }
            }
        });
        return el;
    }
    var document = { createElement: createElement, body: null };
    document.body = createElement('body');
    document.documentElement = createElement('html');
    document.getElementById = function(id) {
        var found = null;
        function walk(n) {
            if (!n || found) return;
            if (n.id === id) { found = n; return; }
            (n.childNodes || []).forEach(walk);
        }
        walk(document.documentElement);
        walk(document.body);
        return found;
    };
    return document;
}

function addOverlay(document, id, z) {
    var el = document.createElement('div');
    el.id = id;
    el.style.cssText = 'position:fixed;inset:0;z-index:' + z;
    document.body.appendChild(el);
    return el;
}

function parseZ(el) {
    if (!el) return 0;
    if (el.style && el.style.zIndex) return parseInt(el.style.zIndex, 10) || 0;
    var css = (el.style && el.style.cssText) || '';
    var m = css.match(/z-index:\s*([^;]+)/i);
    return m ? (parseInt(m[1], 10) || 0) : 0;
}

function openGuide(withHelper) {
    const document = createDocument();
    const dm = addOverlay(document, 'dmWindow', 500000);
    const chatOverlay = addOverlay(document, 'chatOverlay', 250000);
    const topics = addOverlay(document, 'topicsBrowser', 2100000);
    const rules = document.createElement('div');
    rules.className = 'bq-rules-overlay';
    rules.style.cssText = 'position:fixed;inset:0;z-index:2100005';
    document.body.appendChild(rules);

    const sandbox = {
        window: {},
        document: document,
        Math: Math,
        Number: Number,
        parseInt: parseInt,
        getComputedStyle: undefined
    };
    sandbox.window = sandbox;
    sandbox.window.document = document;

    if (withHelper) {
        const helperSrc = extractFn(ranking, 'window._bqAboveModalsZ = function', '\nwindow.initSatsClaim = function');
        vm.runInNewContext(helperSrc, sandbox);
    }

    const fnSrc = extractFn(messaging, 'window.showFriendsInDistressWarning = function', '\n\n// Warn about external links');
    vm.runInNewContext(fnSrc + '\nwindow.showFriendsInDistressWarning();', sandbox);

    const guide = document.getElementById('distressWarning');
    assert.ok(guide, 'guide was appended to the document');
    assert.strictEqual(guide.parentNode, document.body, 'guide is a body sibling of the overlays, not inside them');
    const gz = parseZ(guide);
    assert.ok(gz > parseZ(dm), 'guide is above the DM window: ' + gz + ' vs ' + parseZ(dm));
    assert.ok(gz > parseZ(chatOverlay), 'guide is above Global chat: ' + gz + ' vs ' + parseZ(chatOverlay));
    assert.ok(gz > parseZ(topics), 'guide is above the forum: ' + gz + ' vs ' + parseZ(topics));
    assert.ok(gz > parseZ(rules), 'guide is above forum rules: ' + gz + ' vs ' + parseZ(rules));
    assert.ok(gz >= 2100010, 'guide meets the 2100010 floor, got ' + gz);

    // Closing the guide must not remove the layers underneath.
    guide.remove();
    assert.ok(!document.getElementById('distressWarning'), 'guide is gone after close');
    assert.ok(document.getElementById('dmWindow'), 'DM window stays open');
    assert.ok(document.getElementById('chatOverlay'), 'Global chat stays open');
    assert.ok(document.getElementById('topicsBrowser'), 'forum stays open');
    return gz;
}

const zWith = openGuide(true);
const zWithout = openGuide(false);
assert.ok(zWithout >= 2100010, 'fallback z is still above the three overlays');
assert.ok(zWith >= zWithout, 'helper does not drop below the fallback floor');

// Confirm the in-app overlay numbers this test assumes have not drifted down
// below the guide floor on the source files we did not change.
assert.ok(/id="dmWindow"[^>]*z-index:500000/.test(messaging), 'DM window still at 500000');
assert.ok(/id = 'chatOverlay'[\s\S]{0,400}z-index:250000/.test(chat), 'Global chat still at 250000');
assert.ok(/#topicsBrowser \{ position:fixed; inset:0; z-index:2100000;/.test(html) || /#topicsBrowser \{ position:fixed; inset:0; z-index:2100000;/.test(html.replace(/\s+/g, ' ')), 'forum overlay still at 2100000');
assert.ok(html.includes('#topicsBrowser { position:fixed; inset:0; z-index:2100000;'), 'forum overlay still at 2100000');
assert.ok(forum.includes('.bq-rules-overlay{position:fixed;inset:0;z-index:2100005;'), 'forum rules still at 2100005');

console.log('test-scam-guide-zindex: ok (helper z=' + zWith + ', fallback z=' + zWithout + ')');
