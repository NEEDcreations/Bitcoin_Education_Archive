#!/usr/bin/env node
// Start hashing button on Nacho Satoshi's Favor chat announcements.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'global-chat.js'), 'utf8');

function load() {
    const start = src.indexOf('function isNachoFavorAnnouncement(m) {');
    const end = src.indexOf('function attachOfficialChatCtas(root, msgs) {');
    if (start < 0 || end < 0 || end <= start) throw new Error('could not slice favor hashing helpers');
    const calls = [];
    function El(tag) {
        this.tagName = String(tag || 'div').toUpperCase();
        this.children = [];
        this.attributes = {};
        this.listeners = {};
        this.style = { cssText: '' };
        this.textContent = '';
        this.className = '';
        this.type = '';
        this.firstElementChild = null;
        this.parent = null;
    }
    El.prototype.setAttribute = function (k, v) { this.attributes[k] = String(v); };
    El.prototype.getAttribute = function (k) { return this.attributes[k] || null; };
    El.prototype.appendChild = function (child) {
        this.children.push(child);
        child.parent = this;
        if (!this.firstElementChild) this.firstElementChild = child;
        return child;
    };
    El.prototype.querySelector = function (sel) {
        if (sel === '.favor-start-hashing-cta') {
            for (var i = 0; i < this.children.length; i++) {
                if (this.children[i].className === 'favor-start-hashing-cta') return this.children[i];
                var hit = this.children[i].querySelector && this.children[i].querySelector(sel);
                if (hit) return hit;
            }
            return null;
        }
        return null;
    };
    El.prototype.querySelectorAll = function (sel) {
        var out = [];
        function walk(n) {
            if (sel === '[data-msg-id]' && n.attributes && n.attributes['data-msg-id']) out.push(n);
            (n.children || []).forEach(walk);
        }
        walk(this);
        return out;
    };
    El.prototype.addEventListener = function (type, fn) {
        this.listeners[type] = fn;
    };
    const sandbox = {
        window: {},
        document: {
            createElement: function (tag) { return new El(tag); }
        },
        setTimeout: function (fn) { fn(); }
    };
    sandbox.window = sandbox;
    sandbox.window.openSatoshiFavorMiner = function () { calls.push('miner'); };
    sandbox.window.showQuestHub = function () { calls.push('hub'); };
    vm.createContext(sandbox);
    vm.runInContext(src.slice(start, end), sandbox);
    sandbox._calls = calls;
    sandbox.El = El;
    return sandbox;
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e && e.message)); failed++; }
}

const ending = "\u23F3 Satoshi's Favor ends soon. Hash now!";
const live = "\u26A1 Satoshi's Favor is LIVE! 21 points from 3 players. Window open for 21 min.";

test('Nacho ending and live announcements qualify, user text does not', function () {
    const ctx = load();
    assert.strictEqual(ctx.isNachoFavorAnnouncement({ uid: 'nacho-bot', text: ending }), true);
    assert.strictEqual(ctx.isNachoFavorAnnouncement({ uid: 'nacho-bot', text: live }), true);
    assert.strictEqual(ctx.isNachoFavorAnnouncement({ uid: 'nacho-bot', caption: ending }), true);
    assert.strictEqual(ctx.isNachoFavorAnnouncement({ uid: 'someone', text: ending }), false);
    assert.strictEqual(ctx.isNachoFavorAnnouncement({ uid: 'nacho-bot', text: 'Just chatting about mining' }), false);
});

test('Start hashing opens the hashing screen, not a URL from the message', function () {
    const ctx = load();
    const btn = ctx.createStartHashingButton();
    assert.strictEqual(btn.textContent, 'Start hashing');
    assert.strictEqual(btn.className, 'favor-start-hashing-cta');
    btn.listeners.click({ preventDefault: function () {}, stopPropagation: function () {} });
    assert.deepStrictEqual(ctx._calls, ['miner']);
});

test('attachFavorHashCtas adds one button on Nacho Favor announcements only', function () {
    const ctx = load();
    const root = new ctx.El('div');
    function msg(id) {
        const node = new ctx.El('div');
        node.setAttribute('data-msg-id', id);
        const bubble = new ctx.El('div');
        node.appendChild(bubble);
        root.appendChild(node);
        return node;
    }
    msg('e1');
    msg('u1');
    ctx.attachFavorHashCtas(root, [
        { _id: 'e1', uid: 'nacho-bot', text: ending },
        { _id: 'u1', uid: 'alice', text: ending }
    ]);
    const n1 = root.children[0];
    const n2 = root.children[1];
    assert.strictEqual(n1.querySelector('.favor-start-hashing-cta') != null, true);
    assert.strictEqual(n2.querySelector('.favor-start-hashing-cta') != null, false);
    const before = n1.children[0].children.length;
    ctx.attachFavorHashCtas(root, [
        { _id: 'e1', uid: 'nacho-bot', text: ending }
    ]);
    assert.strictEqual(n1.children[0].children.length, before, 'does not duplicate the button');
});

test('the button is not built from message text as a route or URL', function () {
    const gc = fs.readFileSync(path.join(__dirname, '..', 'global-chat.js'), 'utf8');
    const start = gc.indexOf('function createStartHashingButton() {');
    const end = gc.indexOf('function attachFavorHashCtas(', start);
    const fn = gc.slice(start, end);
    assert.ok(fn.indexOf('Start hashing') !== -1);
    assert.ok(fn.indexOf('openFavorHashingScreen') !== -1);
    assert.ok(fn.indexOf('m.text') === -1);
    assert.ok(fn.indexOf('href') === -1);
});

console.log('Passed ' + passed + ', failed ' + failed);
process.exit(failed ? 1 : 0);
