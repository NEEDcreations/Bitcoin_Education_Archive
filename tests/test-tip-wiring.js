// Tip button wiring: the marketplace Pay button on listing detail markup and
// the DJ bar tip control. Pay data comes from the loaded listing, never from
// markup, and the DJ bar hook attaches in either script load order.
const assert = require('assert');
const vm = require('vm');
const H = require('./helpers-markup.js');

const { test, run } = H.runner();
const MK = H.read('marketplace.js');
const TI_SRC = H.read('tips-integrations.js.src');
const TI_MIN = H.read('tips-integrations.js');
const GC = H.read('global-chat.js');
const BE = H.read('beats.js');
const quiet = { log: function() {}, warn: function() {}, error: function() {} };

function escapeHtml(s) {
    if (typeof s === 'number') s = String(s);
    else if (typeof s !== 'string') return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// A flat element tree: innerHTML turns each start tag into one child element.
function makeNode(tag) {
    const n = {
        tagName: String(tag || 'div').toUpperCase(), attrs: {}, children: [], parentElement: null,
        style: {}, listeners: {}, textContent: '', title: '', onclick: null, id: '',
        setAttribute: function(k, v) { n.attrs[k] = String(v); if (k === 'id') n.id = String(v); },
        getAttribute: function(k) { return Object.prototype.hasOwnProperty.call(n.attrs, k) ? n.attrs[k] : null; },
        hasAttribute: function(k) { return Object.prototype.hasOwnProperty.call(n.attrs, k); },
        removeAttribute: function(k) { delete n.attrs[k]; },
        addEventListener: function(t, fn) { (n.listeners[t] = n.listeners[t] || []).push(fn); },
        appendChild: function(c) { c.parentElement = n; n.children.push(c); return c; },
        insertBefore: function(c, ref) {
            c.parentElement = n;
            const i = n.children.indexOf(ref);
            if (i === -1) n.children.push(c); else n.children.splice(i, 0, c);
            return c;
        },
        remove: function() { if (n.parentElement) { const p = n.parentElement.children; const i = p.indexOf(n); if (i !== -1) p.splice(i, 1); n.parentElement = null; } },
        contains: function(el) { while (el) { if (el === n) return true; el = el.parentElement; } return false; },
        closest: function(sel) { let el = n; while (el) { if (matches(el, sel)) return el; el = el.parentElement; } return null; },
        querySelectorAll: function(sel) { const out = []; walk(n, function(el) { if (el !== n && matches(el, sel)) out.push(el); }); return out; },
        querySelector: function(sel) { return n.querySelectorAll(sel)[0] || null; },
    };
    Object.defineProperty(n, 'innerHTML', {
        get: function() { return n._html || ''; },
        set: function(html) {
            n._html = String(html);
            n.children.forEach(function(c) { c.parentElement = null; });
            n.children = [];
            H.readTags(n._html).forEach(function(t) {
                const c = makeNode(t.name);
                Object.keys(t.attrs).forEach(function(k) { c.setAttribute(k, t.attrs[k]); });
                n.appendChild(c);
            });
        },
    });
    return n;
}
function walk(n, fn) { fn(n); n.children.forEach(function(c) { walk(c, fn); }); }
// Supports tag, [attr], [attr="v"] and [attr*="v"], comma lists.
function matches(el, sel) {
    return sel.split(',').some(function(one) {
        const m = /^\s*([a-z]*)((?:\[[^\]]+\])*)\s*$/i.exec(one);
        if (!m) return false;
        if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
        const parts = m[2].match(/\[[^\]]+\]/g) || [];
        return parts.every(function(p) {
            const a = /^\[([a-z0-9_-]+)(?:(\*?=)"([^"]*)")?\]$/i.exec(p);
            if (!a) return false;
            const v = el.getAttribute(a[1]);
            if (v === null) return false;
            if (!a[2]) return true;
            return a[2] === '=' ? v === a[3] : v.indexOf(a[3]) !== -1;
        });
    });
}
function clickEl(el) {
    let stopped = false;
    const ev = { target: el, stopPropagation: function() { stopped = true; }, preventDefault: function() {} };
    let cur = el;
    while (cur && !stopped) {
        if (typeof cur.onclick === 'function') cur.onclick.call(cur, ev);
        if (stopped) break;
        (cur.listeners.click || []).forEach(function(fn) { fn.call(cur, ev); });
        cur = cur.parentElement;
    }
}

// ---------- Marketplace ----------
const PAY_BLOCK_HEAD = '// Pay data for the open listing';
function marketCode() {
    let code = H.sliceFunction(MK, 'function renderListingDetail(');
    const a = MK.indexOf(PAY_BLOCK_HEAD);
    if (a !== -1) code = MK.slice(a, MK.indexOf('function renderListingDetail(')) + code;
    return code;
}

const GOOD_INV = 'lnbc210n1pjq0xyzpp5' + 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'.repeat(6);
const LISTING = { title: 'Hardware wallet', sellerUid: 'sellerUid01', sellerName: 'Sam "the" Seller', priceSats: 21000, condition: 'new', category: 'other', description: 'x' };

function marketEnv(tiCode, viewerUid) {
    const fc = makeNode('div'); fc.id = 'forumContainer';
    const tipCalls = [];
    const profileCalls = [];
    const sandbox = {
        console: quiet, escapeHtml: escapeHtml, addEventListener: function() {},
        localStorage: { getItem: function() { return null; }, setItem: function() {} },
        auth: { currentUser: viewerUid ? { uid: viewerUid } : null },
        firebase: { firestore: { FieldValue: { increment: function() { return 0; } } } },
        CONDITIONS: [], MARKETPLACE_CATEGORIES: [],
        safeJSON: function(k, d) { return d; },
        isMarketAdmin: function() { return false; },
        getTimeAgo: function() { return 'now'; },
        showTipOverlay: function(o) { tipCalls.push(o); },
        showUserProfile: function(u) { profileCalls.push(u); },
        setTimeout: function(fn, ms) { if (ms === 2000) sandbox.__inject = fn; return 0; }, clearTimeout: function() {},
        MutationObserver: function() { this.observe = function() {}; },
        document: {
            readyState: 'complete',
            getElementById: function(id) { return id === 'forumContainer' ? fc : null; },
            createElement: function(t) { return makeNode(t); },
            addEventListener: function() {}, querySelector: function() { return null; }, querySelectorAll: function() { return []; },
        },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(marketCode(), sandbox);
    vm.runInContext(tiCode, sandbox);
    return {
        fc: fc, tipCalls: tipCalls, profileCalls: profileCalls, sandbox: sandbox,
        render: async function(listing) {
            const data = Object.assign({}, LISTING, listing || {});
            sandbox.db = {
                collection: function() { return { doc: function(id) { return {
                    get: function() { return Promise.resolve({ exists: true, id: id, data: function() { return data; } }); },
                    update: function() { return Promise.resolve(); },
                }; } }; },
            };
            sandbox.renderListingDetail(fc, data.id || 'listingA1');
            await new Promise(function(r) { setImmediate(r); });
        },
    };
}

function payButtons(fc) { return fc.querySelectorAll('[data-mkt-pay]').concat(fc.querySelectorAll('button[data-tip-action]').filter(function(b) { return /Pay/.test(b.textContent); })); }

[['src', TI_SRC, false], ['min', TI_MIN, true]].forEach(function(v) {
    const label = v[0], code = v[1];

    test('marketplace ' + label + ': Pay button appears on data-mkt-action listing markup', async () => {
        const env = marketEnv(code, 'buyer01');
        await env.render({ id: 'listingA1' });
        assert.ok(env.fc.querySelector('button[data-mkt-action="contact"]'), 'contact button rendered');
        env.sandbox.__inject();
        const pays = payButtons(env.fc);
        assert.strictEqual(pays.length, 1, 'one pay button');
        assert.strictEqual(pays[0].textContent, '⚡ Pay 21K sats');
        clickEl(pays[0]);
        assert.strictEqual(env.tipCalls.length, 1);
        const o = env.tipCalls[0];
        assert.strictEqual(o.recipientUid, 'sellerUid01');
        assert.strictEqual(o.recipientName, 'Sam "the" Seller');
        assert.strictEqual(o.suggestedAmount, 21000);
        assert.strictEqual(o.fixedAmount, true);
        assert.strictEqual(o.contextId, 'listingA1');
        assert.ok(!('bolt11' in o));
        assert.strictEqual(env.profileCalls.length, 0);
    });

    test('marketplace ' + label + ': amount and invoice attributes in markup are ignored', async () => {
        const env = marketEnv(code, 'buyer01');
        await env.render({ id: 'listingA1' });
        const btn = env.fc.querySelector('button[data-mkt-action="contact"]');
        btn.setAttribute('data-tip-action', JSON.stringify({ suggestedAmount: 1, fixedAmount: true, bolt11: GOOD_INV, recipientUid: 'evilUid' }));
        btn.setAttribute('data-amount', '1');
        btn.setAttribute('data-price-sats', '1');
        btn.setAttribute('data-bolt11', GOOD_INV);
        btn.setAttribute('data-seller-uid', 'evilUid');
        btn.setAttribute('data-seller-name', 'Evil');
        btn.setAttribute('onclick', "contactSeller('listingA1','Evil')");
        env.sandbox.__inject();
        const pays = payButtons(env.fc);
        assert.strictEqual(pays.length, 1);
        assert.strictEqual(pays[0].getAttribute('data-tip-action'), null, 'no options in markup');
        clickEl(pays[0]);
        const o = env.tipCalls[0];
        assert.strictEqual(o.recipientUid, 'sellerUid01');
        assert.strictEqual(o.suggestedAmount, 21000);
        assert.ok(!('bolt11' in o));
    });

    test('marketplace ' + label + ': a markup listing id that is not the loaded listing gets no button', async () => {
        const env = marketEnv(code, 'buyer01');
        await env.render({ id: 'listingA1' });
        env.fc.querySelector('button[data-mkt-action="contact"]').setAttribute('data-listing-id', 'listingB2');
        env.sandbox.__inject();
        assert.strictEqual(payButtons(env.fc).length, 0);
    });

    test('marketplace ' + label + ': price must be a safe positive integer within the max', async () => {
        const bad = [0, -5, 1.5, '21000', 10000001, Number.MAX_SAFE_INTEGER + 2, NaN, Infinity];
        for (const p of bad) {
            const env = marketEnv(code, 'buyer01');
            await env.render({ id: 'listingA1', priceSats: p });
            env.sandbox.__inject();
            const pays = payButtons(env.fc);
            assert.strictEqual(pays.length, 1, 'button for ' + String(p));
            assert.strictEqual(pays[0].textContent, '⚡ Pay with Lightning', String(p));
            clickEl(pays[0]);
            assert.strictEqual(env.tipCalls[0].suggestedAmount, null, String(p));
            assert.strictEqual(env.tipCalls[0].fixedAmount, false, String(p));
        }
        const env = marketEnv(code, 'buyer01');
        await env.render({ id: 'listingA1', priceSats: 10000000 });
        env.sandbox.__inject();
        clickEl(payButtons(env.fc)[0]);
        assert.strictEqual(env.tipCalls[0].suggestedAmount, 10000000);
        assert.strictEqual(env.tipCalls[0].fixedAmount, true);
    });

    test('marketplace ' + label + ': no duplicate Pay button on re-run or re-render', async () => {
        const env = marketEnv(code, 'buyer01');
        await env.render({ id: 'listingA1' });
        env.sandbox.__inject(); env.sandbox.__inject(); env.sandbox.__inject();
        assert.strictEqual(payButtons(env.fc).length, 1);
        await env.render({ id: 'listingA1' });
        env.sandbox.__inject(); env.sandbox.__inject();
        assert.strictEqual(payButtons(env.fc).length, 1);
    });

    test('marketplace ' + label + ': the seller sees no Pay button on their own listing', async () => {
        const env = marketEnv(code, 'sellerUid01');
        await env.render({ id: 'listingA1' });
        env.sandbox.__inject();
        assert.strictEqual(payButtons(env.fc).length, 0);
    });
});

// ---------- DJ bar ----------
const HOOK_HEAD = '// One tip hook for the DJ bar.';
const HOOK_TAIL = 'window._bqDJBarTipPending = null;\n}\n';
function gcCode() {
    let code = 'var _djListening = false; var _djQueuePosition = -1; var DJ_MAX_SONGS_WITH_QUEUE = 5;\n' +
        GC.slice(GC.indexOf('function esc(s)'), GC.indexOf('\n', GC.indexOf('function esc(s)'))) + '\n' +
        GC.slice(GC.indexOf('var GC_ID_RE'), GC.indexOf('\n', GC.indexOf('var GC_ID_RE'))) + '\n' +
        GC.slice(GC.indexOf('function gcIdOk('), GC.indexOf('window._gcBindActions')) + '\n' +
        H.sliceFunction(GC, 'function showDJBar(') + '\n' +
        H.sliceFunction(GC, 'function hideDJBar(') + '\n';
    const a = GC.indexOf(HOOK_HEAD);
    if (a !== -1) code += GC.slice(a, GC.indexOf(HOOK_TAIL, a) + HOOK_TAIL.length);
    return '(function(){' + code + '\nwindow.__showDJBar = showDJBar; window.__hideDJBar = hideDJBar;})();';
}
function beatsCode() {
    const a = BE.indexOf('// FEATURE 6:');
    const b = BE.indexOf('// FEATURE 7:');
    assert.ok(a !== -1 && b > a);
    return BE.slice(a, b);
}
const DJ = { active: true, djUid: 'djUid01', djName: 'Deejay', trackTitle: 'Song', trackArtist: 'Arty', artistUid: 'artistUid01', trackAudioUrl: '' };

function djEnv(withTips) {
    const panel = makeNode('div');
    const msgs = makeNode('div'); msgs.id = 'globalChatMessages';
    panel.appendChild(msgs);
    const tipCalls = [], profileCalls = [];
    const sandbox = {
        console: quiet, auth: { currentUser: { uid: 'viewer01' } },
        showUserProfile: function(u) { profileCalls.push(u); },
        setTimeout: function(fn) { fn(); return 0; },
        document: {
            getElementById: function(id) {
                let hit = null;
                walk(panel, function(el) { if (!hit && el.id === id) hit = el; });
                return hit;
            },
            createElement: function(t) { return makeNode(t); },
        },
    };
    if (withTips !== false) sandbox.showTipOverlay = function(o) { tipCalls.push(o); };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    return {
        sandbox: sandbox, tipCalls: tipCalls, profileCalls: profileCalls,
        loadGc: function() { vm.runInContext(gcCode(), sandbox); },
        loadBeats: function() { vm.runInContext(beatsCode(), sandbox); },
        show: function(d) { sandbox.__showDJBar(Object.assign({}, DJ, d || {})); },
        tipBtn: function() {
            const bar = sandbox.document.getElementById('djNowPlaying');
            assert.ok(bar, 'bar rendered');
            const btn = bar.children.filter(function(c) { return c.tagName === 'BUTTON' && /artistUid01/.test(c.getAttribute('data-id') || ''); })[0];
            assert.ok(btn, 'artist tip control rendered');
            return btn;
        },
    };
}
function expectTip(env) {
    clickEl(env.tipBtn());
    assert.strictEqual(env.profileCalls.length, 0, 'profile not opened');
    assert.strictEqual(env.tipCalls.length, 1, 'tip overlay opened once');
    assert.strictEqual(env.tipCalls[0].recipientUid, 'artistUid01');
    assert.strictEqual(env.tipCalls[0].recipientName, 'Arty');
    assert.strictEqual(env.tipCalls[0].label, 'Tip Artist');
}

test('dj bar: hook attaches when global chat loads before beats', () => {
    const env = djEnv();
    env.loadGc(); env.loadBeats();
    env.show();
    expectTip(env);
});

test('dj bar: hook attaches when beats loads before global chat', () => {
    const env = djEnv();
    env.loadBeats(); env.loadGc();
    env.show();
    expectTip(env);
});

test('dj bar: a bar already on screen is patched when beats loads late', () => {
    const env = djEnv();
    env.loadGc();
    env.show();
    env.loadBeats();
    expectTip(env);
});

test('dj bar: hook is idempotent and re-renders keep one handler', () => {
    const env = djEnv();
    env.loadGc(); env.loadBeats(); env.loadBeats();
    assert.strictEqual(typeof env.sandbox.bqDJBarTipHook, 'function');
    assert.strictEqual(env.sandbox.bqDJBarTipHook(function() { throw new Error('second hook'); }), false);
    env.show(); env.show(); env.show();
    expectTip(env);
    assert.strictEqual(typeof env.sandbox.showDJBar, 'undefined', 'render function stays private');
});

test('dj bar: without the tips script the control still opens the profile', () => {
    const env = djEnv(false);
    env.loadGc(); env.loadBeats();
    env.show();
    clickEl(env.tipBtn());
    assert.deepStrictEqual(env.profileCalls, ['artistUid01']);
});

run();
