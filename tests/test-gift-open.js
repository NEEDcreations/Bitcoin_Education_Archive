// Gift popup: a tap is never dropped, the prize paints when openGift
// returns, and the holdings refresh does not block the next button.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'gifting.js'), 'utf8');

function link(parent) {
    var nodes = parent.childNodes;
    parent.firstChild = nodes.length ? nodes[0] : null;
    parent.lastChild = nodes.length ? nodes[nodes.length - 1] : null;
    for (var i = 0; i < nodes.length; i++) {
        nodes[i].parentNode = parent;
        nodes[i].previousSibling = i > 0 ? nodes[i - 1] : null;
        nodes[i].nextSibling = i + 1 < nodes.length ? nodes[i + 1] : null;
    }
}

function createDocument() {
    function createText(value) {
        return { nodeType: 3, nodeValue: String(value), childNodes: [], textContent: String(value) };
    }
    function createElement(tag) {
        var el = {
            nodeType: 1,
            tagName: String(tag).toUpperCase(),
            id: '',
            className: '',
            disabled: false,
            onclick: null,
            attrs: {},
            childNodes: [],
            style: { setProperty: function(name, value) { this[name] = value; } },
            parentNode: null
        };
        el.style.setProperty = el.style.setProperty.bind(el.style);
        el.appendChild = function(child) {
            if (child.parentNode) child.parentNode.removeChild(child);
            el.childNodes.push(child);
            link(el);
            return child;
        };
        el.removeChild = function(child) {
            var index = el.childNodes.indexOf(child);
            if (index >= 0) el.childNodes.splice(index, 1);
            child.parentNode = null;
            link(el);
            return child;
        };
        el.remove = function() { if (el.parentNode) el.parentNode.removeChild(el); };
        el.setAttribute = function(name, value) { el.attrs[name] = String(value); };
        el.getAttribute = function(name) {
            return Object.prototype.hasOwnProperty.call(el.attrs, name) ? el.attrs[name] : null;
        };
        el.removeAttribute = function(name) { delete el.attrs[name]; };
        el.focus = function() { document.activeElement = el; };
        el.tabIndex = 0;
        Object.defineProperty(el, 'textContent', {
            get: function() {
                var out = '';
                el.childNodes.forEach(function(child) {
                    if (child.nodeType === 3) out += child.nodeValue || '';
                    else out += child.textContent || '';
                });
                return out;
            },
            set: function(value) {
                el.childNodes = [];
                if (value != null && String(value) !== '') el.childNodes.push(createText(String(value)));
                link(el);
            }
        });
        return el;
    }
    var document = {
        createElement: createElement,
        createTextNode: createText
    };
    var html = createElement('html');
    var head = createElement('head');
    var body = createElement('body');
    html.appendChild(head);
    html.appendChild(body);
    document.documentElement = html;
    document.head = head;
    document.body = body;
    document.activeElement = body;
    document._listeners = {};
    document.addEventListener = function(type, fn) {
        if (!document._listeners[type]) document._listeners[type] = [];
        document._listeners[type].push(fn);
    };
    document.removeEventListener = function(type, fn) {
        var list = document._listeners[type] || [];
        document._listeners[type] = list.filter(function(item) { return item !== fn; });
    };
    document.dispatchEvent = function(event) {
        var list = (document._listeners[event.type] || []).slice();
        list.forEach(function(fn) { fn(event); });
    };
    document.getElementById = function(id) {
        var found = null;
        function walk(node) {
            if (!node || found) return;
            if (node.id === id) { found = node; return; }
            (node.childNodes || []).forEach(walk);
        }
        walk(html);
        return found;
    };
    return document;
}

function rowOf(document, id) {
    return document.getElementById('giftRow_' + id);
}

function buttonIn(row) {
    if (!row) return null;
    var nodes = row.childNodes || [];
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].tagName === 'BUTTON') return nodes[i];
    }
    return null;
}

function findAttr(root, name, value) {
    var found = null;
    function walk(node) {
        if (!node || found) return;
        if (node.getAttribute && node.getAttribute(name) === value) { found = node; return; }
        (node.childNodes || []).forEach(walk);
    }
    walk(root);
    return found;
}

function findButtonText(root, text) {
    var found = null;
    function walk(node) {
        if (!node || found) return;
        if (node.tagName === 'BUTTON' && node.textContent === text) { found = node; return; }
        (node.childNodes || []).forEach(walk);
    }
    walk(root);
    return found;
}

function hasTag(node, tag) {
    if (!node) return false;
    if (node.tagName === tag) return true;
    var kids = node.childNodes || [];
    for (var i = 0; i < kids.length; i++) {
        if (hasTag(kids[i], tag)) return true;
    }
    return false;
}

function unrefTimer(id) {
    if (id && typeof id.unref === 'function') id.unref();
    return id;
}

function boot() {
    var document = createDocument();
    var calls = [];
    var pending = {};
    var toasts = [];
    var refreshReleases = [];
    var refreshCalls = 0;
    var host = document.createElement('div');
    host.id = 'nookKeysCiphers';
    document.body.appendChild(host);
    var sandbox = {
        console: console,
        setTimeout: function(fn, ms) { return unrefTimer(setTimeout(fn, ms)); },
        clearTimeout: clearTimeout,
        setInterval: function(fn, ms) { return unrefTimer(setInterval(fn, ms)); },
        clearInterval: clearInterval,
        Promise: Promise,
        Date: Date,
        Math: Math,
        Number: Number,
        String: String,
        Object: Object,
        Array: Array,
        Error: Error,
        parseFloat: parseFloat,
        isFinite: isFinite,
        document: document,
        audioEnabled: false,
        auth: { currentUser: { uid: 'opener', isAnonymous: false } },
        showToast: function(msg) { toasts.push(String(msg)); }
    };
    sandbox.window = sandbox;
    sandbox.firebase = {
        functions: function() {
            return {
                httpsCallable: function(name) {
                    return function(data) {
                        var id = data && data.giftId;
                        calls.push(id);
                        return new Promise(function(resolve, reject) {
                            pending[id] = { resolve: resolve, reject: reject, name: name };
                        });
                    };
                }
            };
        }
    };
    vm.runInNewContext(src, sandbox, { filename: 'gifting.js' });
    sandbox.renderKeysAndCiphersPanel = function() {
        refreshCalls++;
        return new Promise(function(resolve) { refreshReleases.push(resolve); });
    };
    return {
        sandbox: sandbox,
        document: document,
        calls: calls,
        pending: pending,
        toasts: toasts,
        releaseRefresh: function() {
            var list = refreshReleases.splice(0, refreshReleases.length);
            list.forEach(function(fn) { fn(); });
            return list.length;
        },
        refreshPending: function() { return refreshReleases.length; },
        refreshCalls: function() { return refreshCalls; }
    };
}

function gifts(ids) {
    return ids.map(function(id) { return { id: id, rewardType: 'tickets' }; });
}

function reward(type, extra) {
    var rw = { rewardType: type };
    if (extra) Object.keys(extra).forEach(function(key) { rw[key] = extra[key]; });
    return { data: { reward: rw } };
}

async function flush() {
    for (var i = 0; i < 6; i++) await Promise.resolve();
    await new Promise(function(resolve) { setImmediate(resolve); });
}

async function test(name, fn) {
    try {
        await fn();
        console.log('✅ ' + name);
        return 0;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        return 1;
    }
}

async function main() {
    var failed = 0;

    failed += await test('another gift stays tappable while one is opening', async function() {
        var env = boot();
        env.sandbox.showPostSpinGiftModal(gifts(['a', 'b', 'c']));
        env.sandbox.openSingleGift('a');
        env.sandbox.openSingleGift('b');
        assert.deepStrictEqual(env.calls, ['a', 'b']);
        assert.strictEqual(rowOf(env.document, 'a').getAttribute('data-gift-state'), 'opening');
        assert.strictEqual(rowOf(env.document, 'b').getAttribute('data-gift-state'), 'opening');
        assert.ok(buttonIn(rowOf(env.document, 'a')).textContent.indexOf('Opening…') !== -1);
        assert.ok(buttonIn(rowOf(env.document, 'b')).textContent.indexOf('Opening…') !== -1);
        assert.strictEqual(buttonIn(rowOf(env.document, 'a')).disabled, true);
        assert.strictEqual(buttonIn(rowOf(env.document, 'c')).disabled, false);
        assert.strictEqual(buttonIn(rowOf(env.document, 'c')).textContent, 'Open gift');
        env.pending.a.reject(new Error('stop'));
        env.pending.b.reject(new Error('stop'));
        await flush();
    });

    failed += await test('double-tapping the same gift does not send a second open', async function() {
        var env = boot();
        env.sandbox.showPostSpinGiftModal(gifts(['a']));
        var first = env.sandbox.openSingleGift('a');
        var second = env.sandbox.openSingleGift('a');
        assert.strictEqual(first, second);
        assert.deepStrictEqual(env.calls, ['a']);
        env.pending.a.resolve(reward('tickets', { ticketCount: 1 }));
        await first;
    });

    failed += await test('prize paints when openGift returns, before holdings refresh', async function() {
        var env = boot();
        env.sandbox.showPostSpinGiftModal(gifts(['a', 'b']));
        env.sandbox.openSingleGift('a');
        env.sandbox.openSingleGift('b');
        var nasty = '<img src=x onerror=alert(1)>';
        env.pending.a.resolve(reward('closet_item', { itemName: nasty, itemEmoji: '<script>' }));
        await flush();
        var row = rowOf(env.document, 'a');
        assert.strictEqual(row.getAttribute('data-gift-state'), 'opened');
        assert.ok(row.textContent.indexOf(nasty) !== -1);
        assert.ok(row.textContent.indexOf('<script>') !== -1);
        assert.strictEqual(hasTag(row, 'IMG'), false);
        assert.strictEqual(hasTag(row, 'SCRIPT'), false);
        assert.ok(row.textContent.indexOf('✓') !== -1);
        assert.strictEqual(env.refreshCalls() > 0, true);
        assert.strictEqual(env.refreshPending() > 0, true);
        assert.strictEqual(rowOf(env.document, 'b').getAttribute('data-gift-state'), 'opening');
        var follow = env.document.getElementById('giftFollowUp');
        assert.strictEqual(follow.textContent.indexOf('Send to a peer'), -1);
        env.pending.b.reject(new Error('stop'));
        await flush();
        env.releaseRefresh();
        await flush();
    });

    failed += await test('a failed open clears the row and Try again still works', async function() {
        var env = boot();
        env.sandbox.showPostSpinGiftModal(gifts(['a', 'b']));
        env.sandbox.openSingleGift('b');
        env.sandbox.openSingleGift('a');
        env.pending.a.reject(new Error('network'));
        await flush();
        var row = rowOf(env.document, 'a');
        assert.strictEqual(row.getAttribute('data-gift-state'), 'failed');
        assert.ok(row.textContent.indexOf('Could not open') !== -1);
        assert.strictEqual(row.textContent.indexOf('Opening…'), -1);
        var retry = buttonIn(row);
        assert.ok(retry);
        assert.strictEqual(retry.disabled, false);
        assert.strictEqual(retry.textContent, 'Try again');
        retry.onclick();
        assert.deepStrictEqual(env.calls, ['b', 'a', 'a']);
        assert.strictEqual(rowOf(env.document, 'a').getAttribute('data-gift-state'), 'opening');
        env.pending.a.resolve(reward('tickets', { ticketCount: 2 }));
        await flush();
        assert.strictEqual(rowOf(env.document, 'a').getAttribute('data-gift-state'), 'opened');
        assert.ok(rowOf(env.document, 'a').textContent.indexOf('+2 Orange Tickets') !== -1);
        assert.strictEqual(rowOf(env.document, 'b').getAttribute('data-gift-state'), 'opening');
        env.pending.b.reject(new Error('stop'));
        await flush();
        env.releaseRefresh();
        await flush();
    });

    failed += await test('open all paints each prize, caps at 3, and toasts before refresh', async function() {
        var env = boot();
        env.sandbox.showPostSpinGiftModal(gifts(['a', 'b', 'c', 'd']));
        var finished = false;
        var all = env.sandbox.openAllPostSpinGifts().then(function() { finished = true; });
        await flush();
        assert.deepStrictEqual(env.calls.slice().sort(), ['a', 'b', 'c']);
        assert.strictEqual(finished, false);
        assert.ok(buttonIn(rowOf(env.document, 'd')) == null || rowOf(env.document, 'd').getAttribute('data-gift-state') === 'opening');
        assert.strictEqual(rowOf(env.document, 'd').getAttribute('data-gift-state'), 'opening');
        assert.strictEqual(env.calls.indexOf('d'), -1);
        env.pending.a.resolve(reward('tickets', { ticketCount: 1 }));
        await flush();
        assert.strictEqual(rowOf(env.document, 'a').getAttribute('data-gift-state'), 'opened');
        assert.ok(rowOf(env.document, 'a').textContent.indexOf('+1 Orange Ticket') !== -1);
        assert.ok(env.calls.indexOf('d') !== -1);
        assert.strictEqual(finished, false);
        assert.strictEqual(env.toasts.filter(function(t) { return t.indexOf('Opened!') !== -1; }).length, 0);
        env.pending.b.resolve(reward('xp_bonus', { xpAmount: 50 }));
        env.pending.c.resolve(reward('keys', { keyLabels: ['3A'], keyIds: ['k1'] }));
        env.pending.d.resolve(reward('streak_shield'));
        var timeout = new Promise(function(_, reject) {
            setTimeout(function() { reject(new Error('open all waited on refresh')); }, 400);
        });
        await Promise.race([all, timeout]);
        assert.strictEqual(finished, true);
        assert.strictEqual(rowOf(env.document, 'b').getAttribute('data-gift-state'), 'opened');
        assert.strictEqual(rowOf(env.document, 'c').getAttribute('data-gift-state'), 'opened');
        assert.strictEqual(rowOf(env.document, 'd').getAttribute('data-gift-state'), 'opened');
        var summary = env.toasts.filter(function(t) { return t.indexOf('Opened!') !== -1; });
        assert.strictEqual(summary.length, 1);
        assert.ok(summary[0].indexOf('+1 tickets') !== -1);
        assert.ok(summary[0].indexOf('+50 XP') !== -1);
        assert.ok(summary[0].indexOf('1 key') !== -1);
        assert.strictEqual(env.refreshPending() > 0, true);
        var follow = env.document.getElementById('giftFollowUp');
        assert.strictEqual(follow.textContent.indexOf('Send to a peer'), -1);
        env.releaseRefresh();
        await flush();
        env.releaseRefresh();
        await flush();
        assert.ok(env.document.getElementById('giftFollowUp').textContent.indexOf('Send to a peer') !== -1);
        assert.strictEqual(env.document.getElementById('openAllGiftsBtn').textContent, 'All opened');
    });

    failed += await test('a gift already opened in another tab is not a retry', async function() {
        var env = boot();
        env.sandbox.showPostSpinGiftModal(gifts(['a', 'b']));
        env.sandbox.openSingleGift('a');
        var err = new Error('Gift already opened');
        err.code = 'already-exists';
        env.pending.a.reject(err);
        await flush();
        var row = rowOf(env.document, 'a');
        assert.strictEqual(row.getAttribute('data-gift-state'), 'already');
        assert.ok(row.textContent.indexOf('Already opened') !== -1);
        assert.strictEqual(row.textContent.indexOf('Try again') !== -1, false);
        assert.strictEqual(row.textContent.indexOf('Could not open') !== -1, false);
        assert.strictEqual(buttonIn(row), null);
        var live = findAttr(row, 'aria-live', 'polite');
        assert.ok(live);
        assert.ok(live.textContent.indexOf('Already opened') !== -1);
        assert.strictEqual(env.sandbox._postSpinGifts.some(function(g) { return g.id === 'a'; }), false);
        assert.strictEqual(env.sandbox._postSpinGifts.some(function(g) { return g.id === 'b'; }), true);
        assert.strictEqual(env.document.getElementById('openAllGiftsBtn').textContent, 'Open all');
        env.sandbox.openSingleGift('b');
        env.pending.b.reject(new Error('Gift already opened'));
        await flush();
        assert.strictEqual(rowOf(env.document, 'b').textContent.indexOf('Already opened') !== -1, true);
        assert.strictEqual(buttonIn(rowOf(env.document, 'b')), null);
        assert.strictEqual(env.sandbox._postSpinGifts.length, 0);
        assert.strictEqual(env.document.getElementById('openAllGiftsBtn').textContent, 'All opened');
        assert.strictEqual(env.document.getElementById('openAllGiftsBtn').disabled, true);
    });

    failed += await test('open all flips to All opened when the last gift opens alone', async function() {
        var env = boot();
        env.sandbox.showPostSpinGiftModal(gifts(['a', 'b']));
        var allBtn = env.document.getElementById('openAllGiftsBtn');
        assert.strictEqual(allBtn.textContent, 'Open all');
        env.sandbox.openSingleGift('a');
        env.pending.a.resolve(reward('tickets', { ticketCount: 1 }));
        await flush();
        assert.strictEqual(allBtn.textContent, 'Open all');
        assert.strictEqual(allBtn.disabled, false);
        assert.strictEqual(env.refreshPending() > 0, true);
        env.sandbox.openSingleGift('b');
        env.pending.b.resolve(reward('xp_bonus', { xpAmount: 10 }));
        await flush();
        assert.strictEqual(rowOf(env.document, 'b').getAttribute('data-gift-state'), 'opened');
        assert.strictEqual(allBtn.textContent, 'All opened');
        assert.strictEqual(allBtn.disabled, true);
        assert.strictEqual(env.refreshPending() > 0, true);
        env.releaseRefresh();
        await flush();
    });

    failed += await test('the popup is a dialog and returns focus when it closes', async function() {
        var env = boot();
        var outside = env.document.createElement('button');
        outside.textContent = 'Behind';
        env.document.body.appendChild(outside);
        outside.focus();
        assert.strictEqual(env.document.activeElement, outside);
        env.sandbox.showPostSpinGiftModal(gifts(['a']), { pending: true });
        var dialog = findAttr(env.document.body, 'role', 'dialog');
        assert.ok(dialog);
        assert.strictEqual(dialog.getAttribute('aria-modal'), 'true');
        assert.strictEqual(dialog.getAttribute('aria-labelledby'), 'postSpinGiftTitle');
        assert.strictEqual(env.document.getElementById('postSpinGiftTitle').textContent.indexOf('gift') !== -1, true);
        assert.strictEqual(env.document.activeElement, dialog);
        env.sandbox.openSingleGift('a');
        env.pending.a.resolve(reward('tickets', { ticketCount: 4 }));
        await flush();
        var prize = findAttr(rowOf(env.document, 'a'), 'aria-live', 'polite');
        assert.ok(prize);
        assert.strictEqual(prize.getAttribute('aria-atomic'), 'true');
        assert.ok(prize.textContent.indexOf('+4 Orange Tickets') !== -1);
        env.document.dispatchEvent({ type: 'keydown', key: 'Escape' });
        assert.strictEqual(env.document.getElementById('postSpinGiftOverlay'), null);
        assert.strictEqual(env.document.activeElement, outside);
        assert.strictEqual(env.sandbox._suppressPendingGifts, true);
        env.sandbox._suppressPendingGifts = false;
        outside.focus();
        env.sandbox.showPostSpinGiftModal(gifts(['c']));
        findButtonText(env.document.body, 'Close').onclick();
        assert.strictEqual(env.document.getElementById('postSpinGiftOverlay'), null);
        assert.strictEqual(env.document.activeElement, outside);
        env.releaseRefresh();
        await flush();
    });

    failed += await test('the gift popup stacks above the screen that opened it', function() {
        var env = boot();
        var opener = env.document.createElement('div');
        opener.id = 'usernameModal';
        opener.className = 'open';
        opener.style.zIndex = '2100008';
        var trigger = env.document.createElement('button');
        trigger.textContent = 'Open them';
        opener.appendChild(trigger);
        env.document.body.appendChild(opener);
        trigger.focus();
        env.sandbox.showPostSpinGiftModal(gifts(['a']));
        var overlay = env.document.getElementById('postSpinGiftOverlay');
        assert.ok(parseInt(overlay.style.zIndex, 10) > 2100008);
        var dialog = findAttr(overlay, 'role', 'dialog');
        assert.strictEqual(env.document.activeElement, dialog);
    });

    failed += await test('modal background is solid and the open animation is capped', function() {
        var env = boot();
        env.sandbox.showPostSpinGiftModal(gifts(['a']));
        var css = env.document.getElementById('giftingCSS').textContent;
        assert.ok(css.indexOf('.gifting-modal{background:#0f172a') !== -1);
        assert.ok(css.indexOf('[data-theme="light"] .gifting-modal{background:#ffffff') !== -1);
        assert.ok(css.indexOf('.oled-theme .gifting-modal') !== -1);
        assert.strictEqual(css.indexOf('.gifting-modal{background:var(--card-bg'), -1);
        assert.ok(css.indexOf('min-height:44px') !== -1);
        var btn = buttonIn(rowOf(env.document, 'a'));
        assert.ok(btn.style.cssText.indexOf('min-height:44px') !== -1);
        assert.ok(src.indexOf('var GIFT_OPEN_ANIM_MS = 450;') !== -1);
        assert.strictEqual(/if\s*\(\s*_openAllBusy\s*\|\|\s*Object\.keys\(\s*_giftsOpening\s*\)\.length\s*\)\s*return/.test(src), false);
        var openFn = src.slice(src.indexOf('async function _runGiftOpen'), src.indexOf('window.showPostSpinGiftModal = function'));
        assert.ok(openFn.indexOf('_markGiftRow(giftId, rw, false)') !== -1);
        assert.strictEqual(openFn.indexOf('await anim'), -1);
        assert.strictEqual(openFn.indexOf('await _refreshHoldingsViews'), -1);
        assert.ok(openFn.indexOf('_refreshHoldingsInBackground()') !== -1);
        assert.ok(src.indexOf('label.textContent = failed') !== -1);
    });

    if (failed) process.exit(1);
}

main().catch(function(err) {
    console.error(err);
    process.exit(1);
});
