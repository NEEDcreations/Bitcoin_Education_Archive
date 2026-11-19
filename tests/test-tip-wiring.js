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
            buildTree(n, n._html);
        },
    });
    return n;
}
// Start and end tags build a nested tree; void elements never take children.
const TOKEN_RE = /<\/([a-zA-Z][a-zA-Z0-9]*)\s*>|<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s=>\/"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
const VOID = ['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'option'];
function buildTree(root, html) {
    let cur = root, m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(html))) {
        if (m[1]) {
            let up = cur;
            while (up && up !== root && up.tagName !== m[1].toUpperCase()) up = up.parentElement;
            if (up && up !== root) cur = up.parentElement;
            continue;
        }
        const t = H.readTags(m[0])[0];
        const c = makeNode(t.name);
        Object.keys(t.attrs).forEach(function(k) { c.setAttribute(k, t.attrs[k]); });
        cur.appendChild(c);
        if (VOID.indexOf(t.name) === -1 && !/\/>$/.test(m[0])) cur = c;
    }
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
    let code = H.sliceFunction(MK, 'function renderListingDetail(') + '\n' + H.sliceFunction(MK, 'function loadMarketListings(');
    const a = MK.indexOf(PAY_BLOCK_HEAD);
    if (a !== -1) code = MK.slice(a, MK.indexOf('function renderListingDetail(')) + code;
    return code;
}

const GOOD_INV = 'lnbc210n1pjq0xyzpp5' + 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'.repeat(6);
const LISTING = { title: 'Hardware wallet', sellerUid: 'sellerUid01', sellerName: 'Sam "the" Seller', priceSats: 21000, condition: 'new', category: 'other', description: 'x' };

function marketEnv(tiCode, viewerUid) {
    const fc = makeNode('div'); fc.id = 'forumContainer';
    const grid = makeNode('div'); grid.id = 'marketListings';
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
        satsToUSD: function() { return ''; },
        getTimeAgo: function() { return 'now'; },
        showTipOverlay: function(o) { tipCalls.push(o); },
        showUserProfile: function(u) { profileCalls.push(u); },
        setTimeout: function(fn, ms) { if (ms === 2000) sandbox.__inject = fn; return 0; }, clearTimeout: function() {},
        MutationObserver: function() { this.observe = function() {}; },
        document: {
            readyState: 'complete',
            getElementById: function(id) { return id === 'forumContainer' ? fc : (id === 'marketListings' ? grid : null); },
            createElement: function(t) { return makeNode(t); },
            addEventListener: function() {}, querySelector: function() { return null; }, querySelectorAll: function() { return []; },
        },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(marketCode(), sandbox);
    vm.runInContext(tiCode, sandbox);
    return {
        fc: fc, grid: grid, tipCalls: tipCalls, profileCalls: profileCalls, sandbox: sandbox,
        render: async function(listing) {
            const data = Object.assign({}, LISTING, listing || {});
            sandbox.db = {
                collection: function() { return { doc: function(id) { return {
                    get: function() { return Promise.resolve({ exists: true, id: id, data: function() { return data; } }); },
                    update: function() { return Promise.resolve(); },
                }; } }; },
            };
            fc.innerHTML = '';
            sandbox.renderListingDetail(fc, data.id || 'listingA1');
            await new Promise(function(r) { setImmediate(r); });
        },
        renderGrid: async function(rows) {
            const list = rows.map(function(r) { return Object.assign({}, LISTING, r); });
            sandbox.db = {
                collection: function() {
                    const q = { where: function() { return q; }, orderBy: function() { return q; }, limit: function() { return q; },
                        get: function() { return Promise.resolve({ forEach: function(cb) { list.forEach(function(l) { cb({ id: l.id, data: function() { const c = Object.assign({}, l); delete c.id; return c; } }); }); } }); } };
                    return q;
                },
            };
            fc.innerHTML = '';
            fc.appendChild(grid);
            sandbox.loadMarketListings('all', '', 'newest', 'all');
            for (let i = 0; i < 5; i++) await new Promise(function(r) { setImmediate(r); });
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

function hints(grid) { return grid.querySelectorAll('[data-market-tip]'); }
function cardFor(grid, id) { return grid.querySelectorAll('div[data-mkt-action="open"]').filter(function(c) { return c.getAttribute('data-listing-id') === id; })[0]; }

[['src', TI_SRC], ['min', TI_MIN]].forEach(function(v) {
    const label = v[0], code = v[1];

    test('listing grid ' + label + ': hint shows on data-mkt-action cards from loaded listing data', async () => {
        const env = marketEnv(code, 'buyer01');
        await env.renderGrid([{ id: 'gridA1' }, { id: 'gridB2', priceSats: 500 }]);
        assert.strictEqual(env.grid.querySelectorAll('div[data-mkt-action="open"]').length, 2, 'cards rendered');
        env.sandbox.__inject();
        assert.strictEqual(hints(env.grid).length, 2);
        assert.ok(cardFor(env.grid, 'gridA1').querySelector('[data-market-tip]'));
        hints(env.grid).forEach(function(h) {
            assert.strictEqual(h.textContent, '⚡ Tap to pay with Lightning');
            assert.strictEqual(h.getAttribute('data-tip-action'), null);
        });
    });

    test('listing grid ' + label + ': markup amounts and ids do not create hints', async () => {
        const env = marketEnv(code, 'buyer01');
        await env.renderGrid([{ id: 'gridA1', priceSats: 0 }, { id: 'gridB2', priceSats: 20000000 }, { id: 'gridC3' }]);
        const c = cardFor(env.grid, 'gridC3');
        c.setAttribute('data-listing-id', 'notLoaded9');
        c.setAttribute('data-price-sats', '21000');
        c.setAttribute('data-tip-action', JSON.stringify({ suggestedAmount: 21000, fixedAmount: true, bolt11: GOOD_INV }));
        cardFor(env.grid, 'gridA1').setAttribute('data-price-sats', '21000');
        env.sandbox.__inject();
        assert.strictEqual(hints(env.grid).length, 0);
    });

    test('listing grid ' + label + ': no duplicate hints and none on own listings', async () => {
        const env = marketEnv(code, 'buyer01');
        await env.renderGrid([{ id: 'gridA1' }, { id: 'gridMine', sellerUid: 'buyer01' }]);
        env.sandbox.__inject(); env.sandbox.__inject(); env.sandbox.__inject();
        assert.strictEqual(hints(env.grid).length, 1);
        assert.ok(!cardFor(env.grid, 'gridMine').querySelector('[data-market-tip]'));
        await env.renderGrid([{ id: 'gridA1' }]);
        env.sandbox.__inject(); env.sandbox.__inject();
        assert.strictEqual(hints(env.grid).length, 1);
    });
});

// ---------- IRL ticket button ----------
const IRL = H.read('irl-sync.js');
const IRL_ROWS = {
    evtA_1: { title: 'Meetup A', date: '2099-01-01T18:00:00Z', locationName: 'Here', hostId: 'hostA', hostName: 'Hana', attendees: [] },
    evtB_2: { title: 'Meetup B', date: '2099-01-02T18:00:00Z', locationName: 'There', hostId: 'hostB', hostName: 'Bo', attendees: [] },
    evtMine: { title: 'Mine', date: '2099-01-03T18:00:00Z', locationName: 'Home', hostId: 'viewer01', hostName: 'Me', attendees: [] },
};
function irlEnv(tiCode) {
    const fc = makeNode('div'); fc.id = 'forumContainer';
    const tipCalls = [], irlCalls = [];
    const rows = JSON.parse(JSON.stringify(IRL_ROWS));
    function docSnap(id) { return { id: id, exists: !!rows[id], data: function() { return Object.assign({}, rows[id]); } }; }
    const db = { collection: function() {
        const q = { where: function() { return q; }, orderBy: function() { return q; }, limit: function() { return q; },
            get: async function() { const docs = Object.keys(rows).map(docSnap); return { empty: !docs.length, docs: docs, forEach: function(cb) { docs.forEach(cb); } }; },
            doc: function(id) { return { get: async function() { return docSnap(id); }, update: async function() {} }; } };
        return q;
    } };
    const authObj = { currentUser: { uid: 'viewer01', isAnonymous: false } };
    const sandbox = {
        console: quiet, auth: authObj, escapeHtml: escapeHtml, addEventListener: function() {},
        localStorage: { getItem: function() { return null; }, setItem: function() {} },
        firebase: { firestore: Object.assign(function() { return db; }, { FieldValue: { arrayUnion: function() {}, arrayRemove: function() {}, serverTimestamp: function() {} } }), auth: function() { return authObj; } },
        showTipOverlay: function(o) { tipCalls.push(o); },
        setTimeout: function(fn, ms) { if (ms === 2000) sandbox.__inject = fn; return 0; }, clearTimeout: function() {},
        MutationObserver: function() { this.observe = function() {}; },
        showToast: function() {}, confirm: function() { return false; },
        document: {
            readyState: 'complete',
            getElementById: function(id) { let hit = id === 'forumContainer' ? fc : null; if (!hit) walk(fc, function(el) { if (!hit && el.id === id) hit = el; }); return hit; },
            createElement: function(t) { return makeNode(t); },
            addEventListener: function() {}, querySelector: function() { return null; }, querySelectorAll: function() { return []; },
            body: { appendChild: function(el) { return el; }, insertAdjacentHTML: function() {}, style: {} },
        },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(IRL, sandbox);
    vm.runInContext(tiCode, sandbox);
    ['viewEvent', 'toggleRSVP'].forEach(function(n) { sandbox[n] = function(id) { irlCalls.push([n, id]); }; });
    return {
        fc: fc, tipCalls: tipCalls, irlCalls: irlCalls, sandbox: sandbox, rows: rows,
        render: async function() { sandbox.renderIRLSync(); for (let i = 0; i < 20; i++) await new Promise(function(r) { setImmediate(r); }); },
    };
}
function rsvpFor(fc, id) { return fc.querySelectorAll('button[data-irl-action="rsvp"]').filter(function(b) { return b.getAttribute('data-id') === id; })[0]; }
function ticketsFor(fc, id) { const b = rsvpFor(fc, id); return b && b.parentElement ? b.parentElement.querySelectorAll('[data-irl-tip]') : []; }

[['src', TI_SRC], ['min', TI_MIN]].forEach(function(v) {
    const label = v[0], code = v[1];

    test('irl ' + label + ': ticket button pays the host from the loaded event', async () => {
        const env = irlEnv(code);
        await env.render();
        assert.ok(rsvpFor(env.fc, 'evtA_1'), 'rsvp button rendered');
        env.sandbox.__inject();
        assert.strictEqual(ticketsFor(env.fc, 'evtA_1').length, 1);
        assert.strictEqual(ticketsFor(env.fc, 'evtB_2').length, 1);
        const t = ticketsFor(env.fc, 'evtA_1')[0];
        assert.strictEqual(t.getAttribute('data-tip-action'), null);
        clickEl(t);
        assert.strictEqual(env.tipCalls.length, 1);
        const o = env.tipCalls[0];
        assert.strictEqual(o.recipientUid, 'hostA');
        assert.strictEqual(o.recipientName, 'Event: Meetup A');
        assert.strictEqual(o.contextId, 'evtA_1');
        assert.ok(!('bolt11' in o) && !o.fixedAmount && !o.suggestedAmount);
        assert.deepStrictEqual(env.irlCalls, [], 'card view not opened');
    });

    test('irl ' + label + ': injected markup payee and amount are ignored', async () => {
        const env = irlEnv(code);
        await env.render();
        const b = rsvpFor(env.fc, 'evtA_1');
        b.setAttribute('data-host-id', 'evilUid');
        b.setAttribute('data-amount', '1');
        b.setAttribute('data-tip-action', JSON.stringify({ recipientUid: 'evilUid', suggestedAmount: 1, fixedAmount: true, bolt11: GOOD_INV }));
        b.setAttribute('onclick', "toggleRSVP('evtA_1')");
        const c = rsvpFor(env.fc, 'evtB_2');
        c.setAttribute('data-id', 'evtNotLoaded');
        env.sandbox.__inject();
        clickEl(ticketsFor(env.fc, 'evtA_1')[0]);
        const o = env.tipCalls[0];
        assert.strictEqual(o.recipientUid, 'hostA');
        assert.ok(!('bolt11' in o) && !o.fixedAmount && !o.suggestedAmount);
        assert.strictEqual(ticketsFor(env.fc, 'evtNotLoaded').length, 0);
    });

    test('irl ' + label + ': no duplicates and no ticket on the viewer\'s own event', async () => {
        const env = irlEnv(code);
        await env.render();
        env.sandbox.__inject(); env.sandbox.__inject(); env.sandbox.__inject();
        assert.strictEqual(ticketsFor(env.fc, 'evtA_1').length, 1);
        assert.strictEqual(ticketsFor(env.fc, 'evtMine').length, 0);
        await env.render();
        env.sandbox.__inject(); env.sandbox.__inject();
        assert.strictEqual(env.fc.querySelectorAll('[data-irl-tip]').length, 2);
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
    return BE.slice(BE.indexOf('var BEATS_ID_RE'), BE.indexOf('window._beatsIdOk')) + '\n' + BE.slice(a, b);
}
// The live DJ doc names a different artist than the track doc does.
const DJ = { active: true, djUid: 'djUid01', djName: 'Deejay', trackId: 'track01', trackTitle: 'Song', trackArtist: 'Spoofed Name', artistUid: 'spoofUid99', trackAudioUrl: '' };
const TRACKS = {
    track01: { authorId: 'realArtist01', authorName: 'Real Artist', title: 'Real Song' },
    trackNoAuthor: { authorName: 'Nobody', title: 'x' },
    trackMine: { authorId: 'viewer01', authorName: 'Me', title: 'Mine' },
};

function djEnv(opts) {
    opts = opts || {};
    const panel = makeNode('div');
    const msgs = makeNode('div'); msgs.id = 'globalChatMessages';
    panel.appendChild(msgs);
    const tipCalls = [], profileCalls = [], reads = [];
    const sandbox = {
        console: quiet, auth: { currentUser: { uid: 'viewer01' } }, Map: Map, Promise: Promise,
        showUserProfile: function(u) { profileCalls.push(u); },
        setTimeout: function(fn) { fn(); return 0; },
        db: { collection: function(col) { return { doc: function(id) { return { get: function() {
            reads.push(col + '/' + id);
            if (opts.unreadable) return Promise.reject(new Error('denied'));
            return Promise.resolve({ exists: Object.prototype.hasOwnProperty.call(TRACKS, id), data: function() { return Object.assign({}, TRACKS[id]); } });
        } }; } }; } },
        document: {
            getElementById: function(id) {
                let hit = null;
                walk(panel, function(el) { if (!hit && el.id === id) hit = el; });
                return hit;
            },
            createElement: function(t) { return makeNode(t); },
        },
    };
    if (opts.tips !== false) sandbox.showTipOverlay = function(o) { tipCalls.push(o); };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    return {
        sandbox: sandbox, tipCalls: tipCalls, profileCalls: profileCalls, reads: reads,
        loadGc: function() { vm.runInContext(gcCode(), sandbox); },
        loadBeats: function() { vm.runInContext(beatsCode(), sandbox); },
        show: function(d) { sandbox.__showDJBar(Object.assign({}, DJ, d || {})); },
        tipBtn: function() {
            const bar = sandbox.document.getElementById('djNowPlaying');
            assert.ok(bar, 'bar rendered');
            const btn = bar.querySelectorAll('button').filter(function(c) { return /Tip Artist/.test(c.textContent) || c.hasAttribute('data-dj-tip') || /spoofUid99/.test(c.getAttribute('data-id') || ''); })[0];
            assert.ok(btn, 'artist tip control rendered');
            return btn;
        },
    };
}
async function settle() { for (let i = 0; i < 10; i++) await new Promise(function(r) { setImmediate(r); }); }
async function expectTip(env) {
    clickEl(env.tipBtn());
    await settle();
    assert.strictEqual(env.profileCalls.length, 0, 'profile not opened');
    assert.strictEqual(env.tipCalls.length, 1, 'tip overlay opened once');
    assert.strictEqual(env.tipCalls[0].recipientUid, 'realArtist01', 'payee from the track doc');
    assert.strictEqual(env.tipCalls[0].recipientName, 'Real Artist', 'name from the track doc');
    assert.strictEqual(env.tipCalls[0].label, 'Tip Artist');
    assert.ok(JSON.stringify(env.tipCalls[0]).indexOf('spoof') === -1 && JSON.stringify(env.tipCalls[0]).indexOf('Spoofed') === -1);
}
async function expectNoTip(env) {
    clickEl(env.tipBtn());
    await settle();
    assert.strictEqual(env.tipCalls.length, 0, 'no tip overlay');
    assert.strictEqual(env.profileCalls.length, 0, 'no profile fallback');
}

test('dj bar: global chat before beats, payee and name come from the track doc', async () => {
    const env = djEnv();
    env.loadGc(); env.loadBeats();
    env.show();
    await expectTip(env);
    assert.deepStrictEqual(env.reads.filter(function(r) { return r === 'beats_tracks/track01'; }).length, 1);
});

test('dj bar: beats before global chat, payee from the track doc', async () => {
    const env = djEnv();
    env.loadBeats(); env.loadGc();
    env.show();
    await expectTip(env);
});

test('dj bar: a bar already on screen is patched when beats loads late', async () => {
    const env = djEnv();
    env.loadGc();
    env.show();
    env.loadBeats();
    await expectTip(env);
});

test('dj bar: hook is idempotent, re-renders keep one handler and one read per track', async () => {
    const env = djEnv();
    env.loadGc(); env.loadBeats(); env.loadBeats();
    assert.strictEqual(typeof env.sandbox.bqDJBarTipHook, 'function');
    assert.strictEqual(env.sandbox.bqDJBarTipHook(function() { throw new Error('second hook'); }), false);
    env.show(); env.show(); env.show();
    await expectTip(env);
    assert.strictEqual(env.reads.length, 1);
    assert.strictEqual(typeof env.sandbox.showDJBar, 'undefined', 'render function stays private');
});

test('dj bar: missing track, unreadable track or no author gives no overlay', async () => {
    let env = djEnv();
    env.loadGc(); env.loadBeats();
    env.show({ trackId: 'trackGone' });
    await settle();
    assert.strictEqual(env.tipBtn().style.display, 'none', 'hidden for a missing track');
    await expectNoTip(env);

    env = djEnv({ unreadable: true });
    env.loadGc(); env.loadBeats();
    env.show();
    await expectNoTip(env);

    env = djEnv();
    env.loadGc(); env.loadBeats();
    env.show({ trackId: 'trackNoAuthor' });
    await settle();
    assert.strictEqual(env.tipBtn().style.display, 'none');
    await expectNoTip(env);
});

test('dj bar: a bad track id is refused before any read', async () => {
    const env = djEnv();
    env.loadBeats();
    const hook = env.sandbox._bqDJBarTipPending;
    assert.strictEqual(typeof hook, 'function', 'hook waiting for global chat');
    for (const bad of ['../users/x', 'a b', 'x'.repeat(129), '', 42, null]) {
        const bar = makeNode('div');
        bar.innerHTML = '<button data-dj-tip="1">Tip Artist</button>';
        hook(bar, Object.assign({}, DJ, { trackId: bad }));
        const btn = bar.querySelector('[data-dj-tip]');
        clickEl(btn);
        await settle();
        assert.strictEqual(btn.style.display, 'none', String(bad));
    }
    assert.deepStrictEqual(env.reads, []);
    assert.strictEqual(env.tipCalls.length, 0);
});

test('dj bar: the viewer\'s own track offers no tip', async () => {
    const env = djEnv();
    env.loadGc(); env.loadBeats();
    env.show({ trackId: 'trackMine' });
    await settle();
    assert.strictEqual(env.tipBtn().style.display, 'none');
    await expectNoTip(env);
});

test('dj bar: without the tips script nothing opens', async () => {
    const env = djEnv({ tips: false });
    env.loadGc(); env.loadBeats();
    env.show();
    await expectNoTip(env);
});

run();
