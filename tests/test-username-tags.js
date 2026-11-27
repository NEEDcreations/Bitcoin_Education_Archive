#!/usr/bin/env node
// Clickable username tags: shared helper, GGs @handles, and escaped names.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

const utilsSrc = read('utils.js');
const chatSrc = read('global-chat.js');
const forumSrc = read('forum.js');
const sw = read('sw.js');
const html = read('index.html');
const html404 = read('404.html');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack.split('\n')[0] : e)); failed++; }
}

function domStub() {
    return {
        createElement: function(tag) {
            var text = '';
            var el = {
                tagName: String(tag).toUpperCase(),
                attrs: {},
                listeners: {},
                style: {},
                href: '',
                children: [],
                appendChild: function(n) {
                    this.children.push(n);
                    if (n && n.textContent != null) text += n.textContent;
                    return n;
                },
                setAttribute: function(k, v) { this.attrs[k] = v; },
                getAttribute: function(k) { return this.attrs[k]; },
                addEventListener: function(t, fn) {
                    if (!this.listeners[t]) this.listeners[t] = [];
                    this.listeners[t].push(fn);
                }
            };
            Object.defineProperty(el, 'textContent', {
                get: function() { return text; },
                set: function(v) { text = String(v); }
            });
            Object.defineProperty(el, 'innerHTML', {
                get: function() {
                    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                }
            });
            return el;
        },
        createTextNode: function(s) { return { nodeType: 3, textContent: String(s) }; }
    };
}

function loadUtils() {
    var start = utilsSrc.indexOf('function escapeHtml(str) {');
    var end = utilsSrc.indexOf('\n// ---- Safe URL', start);
    assert.ok(start >= 0 && end > start, 'utils helper block');
    var sandbox = { document: domStub(), console: { log: function() {}, warn: function() {}, error: function() {} } };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(utilsSrc.slice(start, end), sandbox, { filename: 'utils.js' });
    return sandbox;
}

function loadGg(utils) {
    var mentionStart = chatSrc.indexOf('var _MENTION_STOP');
    var mentionEnd = chatSrc.indexOf('function _mentionRecipientOk');
    var fnStart = chatSrc.indexOf('function ggAppendHandle');
    var fnEnd = chatSrc.indexOf('var _ggTipLeaveTimer');
    assert.ok(mentionStart >= 0 && mentionEnd > mentionStart, 'mention regex block');
    assert.ok(fnStart >= 0 && fnEnd > fnStart, 'ggAppendMentionText block');
    var sandbox = utils || loadUtils();
    if (!sandbox._chatUsers) sandbox._chatUsers = {};
    sandbox.window._chatUsers = sandbox._chatUsers;
    vm.runInContext(chatSrc.slice(mentionStart, mentionEnd), sandbox, { filename: 'mentions.js' });
    vm.runInContext(chatSrc.slice(fnStart, fnEnd), sandbox, { filename: 'gg-mentions.js' });
    return sandbox;
}

test('service worker cache is v2744 and html pins match', function() {
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2745'"));
    assert.ok(!sw.includes("const CACHE_NAME = 'btc-archive-v2690'"));
    assert.ok(html.includes('bundle.min.js?v=20261128_v2744'));
    assert.ok(html.includes('global-chat.js?v=20261128_v2744'));
    assert.strictEqual(html, html404);
});

test('usernameTagHtml escapes name and uid and opens via data-profile-uid', function() {
    var s = loadUtils();
    var htmlTag = s.usernameTagHtml('Bonzi', 'uidBonzi', { at: true });
    assert.ok(htmlTag.indexOf('data-profile-uid="uidBonzi"') !== -1);
    assert.ok(htmlTag.indexOf('>@Bonzi</a>') !== -1);
    assert.ok(htmlTag.indexOf('openUsernameTag') !== -1);
    assert.ok(htmlTag.indexOf('showUserProfile(\'uidBonzi\')') === -1);
});

test('usernameTagHtml never interpolates raw markup or quotes', function() {
    var s = loadUtils();
    var htmlTag = s.usernameTagHtml('<img src=x onerror=alert(1)>', 'abc"onclick="alert(1)', { at: true });
    assert.ok(htmlTag.indexOf('<img') === -1);
    assert.ok(htmlTag.indexOf('abc"onclick') === -1);
    assert.ok(htmlTag.indexOf('&lt;img') !== -1);
    // Invalid uid is rejected, so this is escaped text, not a tag.
    assert.ok(htmlTag.indexOf('data-profile-uid') === -1);
    assert.ok(htmlTag.indexOf('<a ') === -1);
});

test('resolveUsernameUid uses the chat name cache and skips a new lookup uid', function() {
    var s = loadUtils();
    s._chatUsers = { u1: 'Bonzi' };
    s.window._chatUsers = s._chatUsers;
    assert.strictEqual(s.resolveUsernameUid('Bonzi', ''), 'u1');
    assert.strictEqual(s.resolveUsernameUid('Nobody', ''), '');
    assert.strictEqual(s.resolveUsernameUid('Bonzi', 'known-uid'), 'known-uid');
    assert.strictEqual(s.usernameTagHtml('Nobody', '', { at: true }), '@Nobody');
});

test('GGs @Bonzi is a tag when mentionUid is on the message', function() {
    var s = loadGg();
    var parent = s.document.createElement('div');
    s.ggAppendMentionText(parent, '🏅 @Bonzi earned 21 Days (+1 SF point)', 'uidBonzi');
    var tags = parent.children.filter(function(c) { return c.tagName === 'A'; });
    assert.strictEqual(tags.length, 1);
    assert.strictEqual(tags[0].textContent, '@Bonzi');
    assert.strictEqual(tags[0].attrs['data-profile-uid'], 'uidBonzi');
    var texts = parent.children.filter(function(c) { return c.nodeType === 3; }).map(function(c) { return c.textContent; }).join('');
    assert.ok(texts.indexOf('earned 21 Days') !== -1);
});

test('GGs @Bonzi is a tag when the name is already in the chat cache', function() {
    var s = loadGg();
    s._chatUsers = { uidBonzi: 'Bonzi' };
    s.window._chatUsers = s._chatUsers;
    var parent = s.document.createElement('div');
    s.ggAppendMentionText(parent, '🏅 @Bonzi earned 21 Days (+1 SF point)', '');
    var tags = parent.children.filter(function(c) { return c.tagName === 'A'; });
    assert.strictEqual(tags.length, 1);
    assert.strictEqual(tags[0].attrs['data-profile-uid'], 'uidBonzi');
});

test('GGs @Bonzi stays plain text when the uid is unknown', function() {
    var s = loadGg();
    var parent = s.document.createElement('div');
    s.ggAppendMentionText(parent, '🏅 @Bonzi earned 21 Days (+1 SF point)', '');
    var tags = parent.children.filter(function(c) { return c.tagName === 'A'; });
    assert.strictEqual(tags.length, 0);
    var texts = parent.children.map(function(c) { return c.textContent; }).join('');
    assert.ok(texts.indexOf('@Bonzi') !== -1);
});

test('GGs mention path does not add a per-message Firestore query', function() {
    var start = chatSrc.indexOf('function ggAppendHandle');
    var end = chatSrc.indexOf('var _ggTipLeaveTimer');
    var block = chatSrc.slice(start, end);
    assert.ok(block.indexOf('ggAppendMentionText') !== -1);
    assert.ok(block.indexOf('collection(') === -1);
    assert.ok(block.indexOf('public_profiles') === -1);
    assert.ok(block.indexOf('.get()') === -1);
    assert.ok(block.indexOf('lookupUserByName') === -1);
});

test('forum article list and view reuse usernameTagHtml', function() {
    assert.ok(forumSrc.indexOf('usernameTagHtml(a.authorName || \'Anon\', a.authorId, { at: false })') !== -1);
    var first = forumSrc.indexOf('usernameTagHtml(a.authorName || \'Anon\', a.authorId, { at: false })');
    var second = forumSrc.indexOf('usernameTagHtml(a.authorName || \'Anon\', a.authorId, { at: false })', first + 1);
    assert.ok(second > first, 'list and view both use the helper');
});

test('global chat author names and reply names use the shared helper', function() {
    assert.ok(chatSrc.indexOf("usernameTagHtml(m.name || 'Anon', nameUid, { at: false })") !== -1);
    assert.ok(chatSrc.indexOf('usernameTagHtml(m.replyToName') !== -1);
    assert.ok(chatSrc.indexOf('data-profile-uid') !== -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
