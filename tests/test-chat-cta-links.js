// Official 603BTC Updates CTAs in Global Chat must be real buttons
// (safe DOM, allow-listed internal routes only). User-typed copies stay plain.
// Run: node tests/test-chat-cta-links.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function noop() {}
function makeEl(tag) {
    const el = {
        tagName: String(tag || 'div').toUpperCase(),
        style: {},
        children: [],
        attrs: {},
        listeners: {},
        className: '',
        type: '',
        textContent: '',
        dataset: {},
        setAttribute: function (k, v) { this.attrs[k] = String(v); },
        getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
        appendChild: function (c) { this.children.push(c); c.parentNode = this; return c; },
        removeChild: function (c) { this.children = this.children.filter(function (x) { return x !== c; }); },
        addEventListener: function (ev, fn) { this.listeners[ev] = fn; },
        querySelector: function (sel) {
            return this.querySelectorAll(sel)[0] || null;
        },
        querySelectorAll: function (sel) {
            const out = [];
            const walk = function (node) {
                (node.children || []).forEach(function (child) {
                    if (sel === '[data-msg-id]' && child.getAttribute && child.getAttribute('data-msg-id')) out.push(child);
                    else if (sel === '[data-official-body]' && child.attrs && Object.prototype.hasOwnProperty.call(child.attrs, 'data-official-body')) out.push(child);
                    else if (sel === '[data-official-cta-slot]' && child.attrs && Object.prototype.hasOwnProperty.call(child.attrs, 'data-official-cta-slot')) out.push(child);
                    walk(child);
                });
            };
            walk(nodeOrSelf(this, sel));
            return out;
        }
    };
    function nodeOrSelf(root, sel) {
        // Include the root when it itself matches, then walk children.
        if (sel === '[data-msg-id]' && root.getAttribute && root.getAttribute('data-msg-id')) {
            /* walk still starts at children; attachOfficialChatCtas queries the list root, not the msg node */
        }
        return root;
    }
    Object.defineProperty(el, 'firstChild', { get: function () { return this.children[0] || null; } });
    return el;
}

const context = vm.createContext({
    document: {
        addEventListener: noop, removeEventListener: noop,
        getElementById: function () { return null; },
        createElement: makeEl,
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; }
    },
    console: { log: noop, warn: noop, error: noop },
    setTimeout: function () { return 0; }, clearTimeout: noop,
    setInterval: function () { return 0; }, clearInterval: noop,
    navigator: { userAgent: '' },
    location: { hash: '', pathname: '/' },
    history: { pushState: noop, replaceState: noop },
    localStorage: { getItem: function () { return null; }, setItem: noop },
    fetch: function () { return Promise.resolve({ json: function () { return {}; } }); },
    addEventListener: noop, removeEventListener: noop,
    innerWidth: 1024, innerHeight: 800
});
context.window = context;
const src = fs.readFileSync(path.join(__dirname, '..', 'global-chat.js'), 'utf8');
for (let attempt = 0; attempt < 12; attempt++) {
    try { vm.runInContext(src, context, { filename: 'global-chat.js' }); break; }
    catch (err) {
        const missing = String(err && err.message || '').match(/^(\w+) is not defined$/);
        if (!missing || attempt === 11) throw err;
        context[missing[1]] = noop;
    }
}

assert.ok(typeof context.parseOfficialChatCta === 'function', 'parseOfficialChatCta not exported');
assert.ok(typeof context.isOfficialUpdatesSender === 'function', 'isOfficialUpdatesSender not exported');
assert.ok(typeof context.createOfficialChatCtaButton === 'function', 'createOfficialChatCtaButton not exported');
assert.ok(typeof context.attachOfficialChatCtas === 'function', 'attachOfficialChatCtas not exported');

const official = { uid: 'tg_broadcast', name: '📢 603BTC Updates' };
const forumText = '🗣️ New Forum Post\n\nDiscussion: Taproot\nby Alice: thoughts?\n\nOpen PlebTalk →';

test('parseOfficialChatCta finds Open PlebTalk and maps only to #forum', function () {
    const parsed = context.parseOfficialChatCta(forumText);
    assert.ok(parsed);
    assert.strictEqual(parsed.route, 'forum');
    assert.strictEqual(parsed.label, 'Open PlebTalk →');
    assert.ok(parsed.body.indexOf('Discussion: Taproot') !== -1);
    assert.ok(parsed.body.indexOf('Open PlebTalk') === -1);
});

test('sibling CTAs map to their allow-listed routes', function () {
    const cases = [
        ['🎵 New Track on Bitcoin Beats\n\nOrange Song\n\nListen now →', 'bitcoin-beats', 'Listen now →'],
        ['🛒 New Listing on Lightning Mart\n\nSticker pack\n\nView listing →', 'marketplace', 'View listing →'],
        ['🤝 New Bitcoin Meetup\n\nPark meetup\n\nView event →', 'irl-sync', 'View event →']
    ];
    cases.forEach(function (row) {
        const parsed = context.parseOfficialChatCta(row[0]);
        assert.ok(parsed, row[0]);
        assert.strictEqual(parsed.route, row[1], row[0]);
        assert.strictEqual(parsed.label, row[2], row[0]);
        assert.ok(parsed.body.indexOf(row[2].replace(' →', '')) === -1, row[0]);
    });
});

test('ascii arrow, guillemet, and case variants still parse', function () {
    ['Open PlebTalk ->', 'open plebtalk →', 'Open PlebTalk »', 'Open PlebTalk'].forEach(function (s) {
        const parsed = context.parseOfficialChatCta('Hello\n\n' + s);
        assert.ok(parsed, s);
        assert.strictEqual(parsed.route, 'forum', s);
        assert.strictEqual(parsed.body, 'Hello');
    });
});

test('URLs in the message body are not used as the target', function () {
    const parsed = context.parseOfficialChatCta('Read https://evil.example/phish\n\nOpen PlebTalk →');
    assert.ok(parsed);
    assert.strictEqual(parsed.route, 'forum');
    assert.ok(parsed.body.indexOf('https://evil.example/phish') !== -1);
    assert.ok(!Object.prototype.hasOwnProperty.call(parsed, 'url'));
});

test('unrecognized trailing CTAs such as Learn more are ignored', function () {
    assert.strictEqual(context.parseOfficialChatCta('Feature update\n\nLearn more →'), null);
});

test('isOfficialUpdatesSender requires both the reserved uid and official name', function () {
    assert.strictEqual(context.isOfficialUpdatesSender({ uid: 'tg_broadcast', name: '📢 603BTC Updates' }), true);
    assert.strictEqual(context.isOfficialUpdatesSender({ uid: 'tg_broadcast', name: '603BTC Updates' }), true);
    assert.strictEqual(context.isOfficialUpdatesSender({ uid: 'tg_broadcast', name: 'Hacker' }), false);
    assert.strictEqual(context.isOfficialUpdatesSender({ uid: 'some-user', name: '📢 603BTC Updates' }), false);
    assert.strictEqual(context.isOfficialUpdatesSender({ uid: 'nacho-bot', name: '🦌 Nacho', text: 'Open PlebTalk →' }), false);
    assert.strictEqual(context.isOfficialUpdatesSender(null), false);
});

test('isAllowedOfficialChatRoute is a tight allow-list', function () {
    assert.strictEqual(context.isAllowedOfficialChatRoute('forum'), true);
    assert.strictEqual(context.isAllowedOfficialChatRoute('bitcoin-beats'), true);
    assert.strictEqual(context.isAllowedOfficialChatRoute('marketplace'), true);
    assert.strictEqual(context.isAllowedOfficialChatRoute('irl-sync'), true);
    assert.strictEqual(context.isAllowedOfficialChatRoute('https://evil.example'), false);
    assert.strictEqual(context.isAllowedOfficialChatRoute('javascript:alert(1)'), false);
    assert.strictEqual(context.isAllowedOfficialChatRoute('forum/post/abc'), false);
    assert.strictEqual(context.isAllowedOfficialChatRoute(''), false);
});

test('createOfficialChatCtaButton uses textContent and a 44px tap target', function () {
    const btn = context.createOfficialChatCtaButton('Open PlebTalk →', 'forum');
    assert.ok(btn);
    assert.strictEqual(btn.tagName, 'BUTTON');
    assert.strictEqual(btn.type, 'button');
    assert.strictEqual(btn.textContent, 'Open PlebTalk →');
    assert.ok(/min-height:\s*44px/.test(btn.style.cssText));
    assert.strictEqual(btn.getAttribute('data-official-cta-route'), 'forum');
    assert.ok(typeof btn.listeners.click === 'function');
    assert.strictEqual(context.createOfficialChatCtaButton('Open PlebTalk →', 'https://evil.example'), null);
});

test('button click navigates via the allow-listed route, never a URL from text', function () {
    const calls = [];
    context.window._annNavToHash = function (hash) { calls.push(hash); };
    const btn = context.createOfficialChatCtaButton('Open PlebTalk →', 'forum');
    btn.listeners.click({ preventDefault: noop, stopPropagation: noop });
    assert.deepStrictEqual(calls, ['forum']);
});

test('attachOfficialChatCtas fills official bodies with textContent and a button', function () {
    const root = makeEl('div');
    const msg = makeEl('div');
    msg.setAttribute('data-msg-id', 'm1');
    const body = makeEl('div');
    body.setAttribute('data-official-body', '');
    const slot = makeEl('div');
    slot.setAttribute('data-official-cta-slot', '');
    msg.appendChild(body);
    msg.appendChild(slot);
    root.appendChild(msg);

    context.attachOfficialChatCtas(root, [{
        _id: 'm1',
        uid: official.uid,
        name: official.name,
        text: forumText
    }]);
    assert.strictEqual(body.textContent.indexOf('Discussion: Taproot') !== -1, true);
    assert.strictEqual(body.textContent.indexOf('Open PlebTalk') === -1, true);
    assert.strictEqual(slot.children.length, 1);
    assert.strictEqual(slot.children[0].tagName, 'BUTTON');
    assert.strictEqual(slot.children[0].textContent, 'Open PlebTalk →');
    assert.strictEqual(slot.children[0].getAttribute('data-official-cta-route'), 'forum');
});

test('user-typed Open PlebTalk does not get a button', function () {
    const root = makeEl('div');
    const msg = makeEl('div');
    msg.setAttribute('data-msg-id', 'u1');
    const body = makeEl('div');
    body.setAttribute('data-official-body', '');
    const slot = makeEl('div');
    slot.setAttribute('data-official-cta-slot', '');
    msg.appendChild(body);
    msg.appendChild(slot);
    root.appendChild(msg);

    context.attachOfficialChatCtas(root, [{
        _id: 'u1',
        uid: 'user123',
        name: 'Alice',
        text: 'Hey everyone Open PlebTalk →'
    }]);
    assert.strictEqual(body.textContent, '');
    assert.strictEqual(slot.children.length, 0);
});

test('spoofed official name with a normal uid gets no button', function () {
    const root = makeEl('div');
    const msg = makeEl('div');
    msg.setAttribute('data-msg-id', 's1');
    const body = makeEl('div');
    body.setAttribute('data-official-body', '');
    const slot = makeEl('div');
    slot.setAttribute('data-official-cta-slot', '');
    msg.appendChild(body);
    msg.appendChild(slot);
    root.appendChild(msg);

    context.attachOfficialChatCtas(root, [{
        _id: 's1',
        uid: 'user123',
        name: '📢 603BTC Updates',
        text: forumText
    }]);
    assert.strictEqual(slot.children.length, 0);
});

test('existing stored official messages without markdown still become clickable', function () {
    // This is the live shape: plain text, no URL, no [label](#forum).
    const parsed = context.parseOfficialChatCta('New Forum Post Discussion: Taproot\nOpen PlebTalk →');
    assert.ok(parsed);
    assert.strictEqual(parsed.route, 'forum');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
