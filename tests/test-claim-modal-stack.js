'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ranking = fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8');

assert.ok(ranking.includes('window._bqAboveModalsZ'), 'helper present');
assert.ok(ranking.includes('satsClaimOverlay'), 'claim overlay id');
assert.ok(!/satsClaimOverlay[\s\S]{0,400}z-index:500001/.test(ranking), 'old claim z gone');
assert.ok(ranking.includes("_bqAboveModalsZ(2100010)"), 'claim uses above-settings floor');
assert.ok(ranking.includes("_bqAboveModalsZ(2100020)"), 'fee confirm above claim floor');
assert.ok(ranking.includes("overlay.id = 'lnAddrModal'"), 'ln modal still present');
assert.ok(ranking.includes('N/A · account before Nov 5'), 'grandfather N/A copy');

function createDocument() {
    function createElement(tag) {
        var el = {
            nodeType: 1, tagName: String(tag).toUpperCase(), id: '', className: '',
            style: {}, childNodes: [], parentNode: null, attrs: {},
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
        el.appendChild = function(c) { el.childNodes.push(c); c.parentNode = el; return c; };
        el.removeChild = function(c) {
            var i = el.childNodes.indexOf(c);
            if (i >= 0) el.childNodes.splice(i, 1);
            c.parentNode = null;
            return c;
        };
        return el;
    }
    var document = { createElement: createElement, body: null, _listeners: {} };
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
    document.addEventListener = function(type, fn, cap) {
        var k = type + ':' + !!cap;
        (document._listeners[k] = document._listeners[k] || []).push(fn);
    };
    document.removeEventListener = function(type, fn, cap) {
        var k = type + ':' + !!cap;
        document._listeners[k] = (document._listeners[k] || []).filter(function(f) { return f !== fn; });
    };
    return document;
}

// Extract only the helper by evaling a tiny slice
const start = ranking.indexOf('window._bqAboveModalsZ = function');
const end = ranking.indexOf('window.initSatsClaim = function');
assert.ok(start > 0 && end > start);
const helperSrc = ranking.slice(start, end);
const document = createDocument();
const sandbox = { window: {}, document: document, Math: Math, Number: Number, parseInt: parseInt, getComputedStyle: undefined };
sandbox.window = sandbox;
vm.runInNewContext(helperSrc + '\nthis.fn = window._bqAboveModalsZ;', sandbox);
const settings = document.createElement('div');
settings.id = 'usernameModal';
settings.classList.add('open');
settings.style.cssText = 'z-index:2100008';
document.body.appendChild(settings);
const z = sandbox.fn(0);
assert.ok(z > 2100008, 'helper clears settings z, got ' + z);

console.log('test-claim-modal-stack: ok');
