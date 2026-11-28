// Tip button data: every builder writes attribute-safe JSON, and the tip
// overlay rebuilds its options from known fields. Options read back from
// page markup carry plain data only. Covers readable sources and shipped files.
const assert = require('assert');
const vm = require('vm');
const H = require('./helpers-markup.js');

const { test, run } = H.runner();
const LT_SRC = H.read('lightning-tips.js.src');
const LT_MIN = H.read('lightning-tips.js');
const TI_SRC = H.read('tips-integrations.js.src');
const TI_MIN = H.read('tips-integrations.js');
const RANK = H.read('ranking.js');
const FORUM = H.read('forum.js');

const GOOD_INV = H.makeInvoice('lnbc210n');
const SHORT_INV = 'lnbc1' + 'qpzry9x8gf2tvdw0s3jn54khce6mua7l' + 'qqqq';
const EXTRA = '","bolt11":"' + SHORT_INV + '","fixedAmount":true,"z":"';
const NAMES = [
    'Ada&quot;","suggestedAmount":"<img src=x onerror=MARKT1()>","z":"',
    'Ada&quot;' + EXTRA,
    'Ada&amp;quot;' + EXTRA,
    'Ada&#34;' + EXTRA,
    'Ada"\'' + EXTRA,
    'Ada{"recipientUid":"x"}}{',
    'Ada</button><img src=x onerror=MARKT2()>',
    'Ada&#39;&lt;&gt;&amp;',
];
const ADDR_HEAD = 'tip&quot;,"fixedAmount":true,"y":"';
const ADDR = ADDR_HEAD + 'q'.repeat(82 - ADDR_HEAD.length - '@ln.example'.length) + '@ln.example';
const ALLOWED = ['recipientName', 'recipientUid', 'context', 'contextId', 'lightningAddress', 'suggestedAmount', 'label'];

function escapeHtml(s) {
    if (typeof s === 'number') s = String(s);
    else if (typeof s !== 'string') return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const quiet = { log: function() {}, warn: function() {}, error: function() {} };

// Raw attribute text must only hold the five entities the decoder knows.
function tipAttr(html) {
    const m = String(html).match(/data-tip-action="([^"]*)"/);
    if (!m) throw new Error('missing data-tip-action in ' + String(html).slice(0, 120));
    assert.ok(!/&(?!(?:amp|quot|#39|lt|gt);)/.test(m[1]), 'loose ampersand in ' + m[1].slice(0, 80));
    assert.ok(!/[<>'"]/.test(m[1]));
    const tag = H.readTags(html).filter(function(t) { return t.attrs['data-tip-action'] !== undefined; })[0];
    assert.ok(tag, 'tag readable');
    assert.strictEqual(tag.attrs['data-tip-action'], m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
    return tag;
}
function checkData(raw, name, addr) {
    const o = JSON.parse(raw);
    Object.keys(o).forEach(function(k) { assert.ok(ALLOWED.indexOf(k) !== -1, 'unexpected key ' + k); });
    assert.strictEqual(o.recipientName, name);
    if (addr !== undefined) assert.strictEqual(o.lightningAddress, addr);
    assert.ok(o.suggestedAmount === undefined || o.suggestedAmount === null);
    return o;
}

function loadTips(code, name, extra) {
    const els = {};
    const body = H.makeEl('body');
    const docListeners = {};
    const sent = [];
    const sandbox = {
        console: quiet,
        document: {
            body: body,
            getElementById: function(id) {
                if (els[id]) return els[id];
                for (let i = 0; i < body.children.length; i++) if (body.children[i].id === id) return body.children[i];
                if (id === 'tipResult' || id === 'tipPayBtn' || id === 'tipAmount' || id === 'tipUsdDisplay') { els[id] = H.makeEl(id); return els[id]; }
                return null;
            },
            addEventListener: function(type, fn) { (docListeners[type] = docListeners[type] || []).push(fn); },
            createElement: function() { return H.makeEl(''); },
        },
        localStorage: { getItem: function(k) { return k === 'btc_ln_state' ? JSON.stringify({ method: 'webln' }) : null; }, setItem: function() {} },
        setTimeout: function() { return 0; },
        escapeHtml: escapeHtml,
        lnSendPaymentDirect: function(inv) { sent.push(inv); return Promise.resolve(); },
        webln: { enable: function() { return Promise.resolve(); } },
        fetch: function() { return Promise.reject(new Error('offline')); },
        showToast: function() {},
    };
    Object.assign(sandbox, extra || {});
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: name });
    return { win: sandbox, body: body, docListeners: docListeners, sent: sent, els: els };
}
function overlayHtml(t) {
    const ov = t.body.children.filter(function(c) { return c.id === 'tipOverlay'; }).pop();
    return ov ? String(ov.innerHTML) : '';
}
function clickMarkup(t, tag) {
    const el = H.elFrom(tag.attrs);
    t.win._tipFromEl(el);
}

const LT = [['source', LT_SRC, 'lightning-tips.js.src'], ['shipped file', LT_MIN, 'lightning-tips.js']];
const TI = [['source', TI_SRC, 'tips-integrations.js.src'], ['shipped file', TI_MIN, 'tips-integrations.js']];

// ---- builder 1: tipButtonHtml ----
LT.forEach(function(row) {
    test(row[0] + ': tipButtonHtml data round-trips odd names and addresses', function() {
        assert.strictEqual(ADDR.length, 82);
        NAMES.concat([ADDR]).forEach(function(name) {
            assert.ok(name.length <= 128);
            const t = loadTips(row[1], row[2]);
            const html = t.win.tipButtonHtml({ recipientName: name, recipientUid: 'author1', context: 'article', contextId: 'a1', lightningAddress: ADDR, label: '\u26a1 Tip Author', size: 'md' });
            const tag = tipAttr(html);
            checkData(tag.attrs['data-tip-action'], name, ADDR);
            assert.deepStrictEqual(H.strayAttrs(html, ['onclick', 'style', 'onmouseover', 'onmouseout']), []);
            H.handlerTexts(html).forEach(function(h) { assert.strictEqual(h.indexOf('MARKT'), -1, h); assert.strictEqual(h.indexOf('lnbc'), -1, h); });
            clickMarkup(t, tag);
            const o = t.win._tipOpts;
            assert.strictEqual(o.recipientName, name);
            assert.strictEqual(o.bolt11, undefined);
            assert.strictEqual(o.fixedAmount, false);
            assert.strictEqual(o.suggestedAmount, null);
            assert.strictEqual(overlayHtml(t).indexOf('<img'), -1);
        });
    });

    test(row[0] + ': tipButtonHtml keeps an amount as a number and the label as text', function() {
        const t = loadTips(row[1], row[2]);
        const html = t.win.tipButtonHtml({ recipientName: 'Ada', amount: 500, label: '<b>x</b>' });
        const tag = tipAttr(html);
        const o = JSON.parse(tag.attrs['data-tip-action']);
        assert.strictEqual(o.suggestedAmount, 500);
        assert.strictEqual(o.fixedAmount, undefined);
        assert.strictEqual(html.indexOf('<b>'), -1);
        const odd = loadTips(row[1], row[2]).win.tipButtonHtml({ recipientName: 'Ada', amount: '<img src=x>' });
        assert.strictEqual(JSON.parse(tipAttr(odd).attrs['data-tip-action']).suggestedAmount, null);
    });
});

// ---- builder 2: tips-integrations forum buttons (forum author name path) ----
function loadForumInject(code, name, authorText) {
    const inserted = [];
    const timers = [];
    const profileLink = { textContent: authorText, getAttribute: function(k) { return k === 'data-id' ? 'author1' : null; } };
    const card = { querySelector: function(sel) { return sel === '[data-forum-action="profile"]' ? profileLink : null; } };
    const parent = { querySelector: function() { return null; }, insertBefore: function(el) { inserted.push(el); return el; } };
    const vote = {
        nextElementSibling: null, nextSibling: null, parentElement: parent,
        getAttribute: function(k) { return k === 'data-id' ? 'post1' : k === 'data-forum-action' ? 'vote-post' : null; },
        hasAttribute: function() { return false; },
        closest: function(sel) { return sel === '[data-forum-card]' ? card : null; },
    };
    const fc = { querySelectorAll: function(sel) { return String(sel).indexOf('vote-post') !== -1 ? [vote] : []; } };
    const sandbox = {
        console: quiet,
        document: {
            readyState: 'complete',
            addEventListener: function() {},
            getElementById: function(id) { return id === 'forumContainer' ? fc : null; },
            createElement: function() { return H.makeEl(''); },
        },
        setTimeout: function(fn) { timers.push(fn); return 0; },
        clearTimeout: function() {},
        MutationObserver: function() { this.observe = function() {}; },
        escapeHtml: escapeHtml,
        showTipOverlay: function() {},
    };
    sandbox.window = sandbox;
    sandbox.addEventListener = function() {};
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: name });
    timers.splice(0).forEach(function(fn) { try { fn(); } catch (e) {} });
    return inserted;
}
TI.forEach(function(row) {
    test(row[0] + ': forum tip button data round-trips odd author names', function() {
        NAMES.forEach(function(name) {
            const inserted = loadForumInject(row[1], row[2], name);
            assert.strictEqual(inserted.length, 1, 'one button');
            const html = String(inserted[0].innerHTML);
            const tag = tipAttr(html);
            checkData(tag.attrs['data-tip-action'], name);
            assert.deepStrictEqual(H.strayAttrs(html, ['style', 'onmouseover', 'onmouseout']), []);
            assert.strictEqual(H.leftoverMarkup(html).indexOf('<img'), -1);
            const t = loadTips(LT_SRC, 'lightning-tips.js.src');
            clickMarkup(t, tag);
            assert.strictEqual(t.win._tipOpts.recipientName, name);
            assert.strictEqual(t.win._tipOpts.bolt11, undefined);
        });
    });
});

// ---- article view: real tip button in the article page ----
function loadArticle(authorName, tipButtonHtml) {
    const els = {};
    function makeEl(id) {
        return { id: id || '', innerHTML: '', style: {}, listeners: {}, addEventListener: function() {}, appendChild: function() {}, querySelector: function() { return null; } };
    }
    const document = {
        readyState: 'complete',
        head: { appendChild: function() {} },
        body: { appendChild: function() {} },
        createElement: function() { return makeEl(''); },
        createTextNode: function(s) { return { textContent: String(s) }; },
        addEventListener: function() {},
        getElementById: function(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; },
        querySelector: function() { return null; },
    };
    const doc = { title: 'Hello', body: 'Hi', authorId: 'author1', authorName: authorName, authorPoints: 0, wordCount: 200 };
    const sandbox = {
        document: document,
        console: quiet,
        sessionStorage: { getItem: function() { return null; }, setItem: function() {} },
        localStorage: { getItem: function() { return null; }, setItem: function() {} },
        history: { pushState: function() {} },
        setTimeout: function() { return 0; },
        clearTimeout: function() {},
        MutationObserver: function() { this.observe = function() {}; this.disconnect = function() {}; },
        auth: { currentUser: { uid: 'viewer1', isAnonymous: false } },
        timeAgo: function() { return 'now'; },
        getLevel: function() { return { emoji: '*' }; },
        mdToHtml: function() { return ''; },
        escapeHtml: escapeHtml,
        firebase: { firestore: { FieldValue: {} } },
        db: { collection: function() { return { doc: function() { return { get: async function() { return { exists: true, data: function() { return doc; } }; } }; } }; } },
        tipButtonHtml: tipButtonHtml,
    };
    sandbox.window = sandbox;
    sandbox._isAdminClaim = false;
    sandbox._factionNameStyle = function() { return ''; };
    vm.createContext(sandbox);
    vm.runInContext(FORUM, sandbox, { filename: 'forum.js' });
    return { sandbox: sandbox, els: els };
}
test('article view tip button data round-trips odd author names', async function() {
    for (const name of NAMES) {
        const tips = loadTips(LT_MIN, 'lightning-tips.js');
        const a = loadArticle(name, tips.win.tipButtonHtml);
        await a.sandbox.articleView('article1');
        const html = Object.keys(a.els).map(function(k) { return String(a.els[k].innerHTML); }).filter(function(h) { return h.indexOf('data-tip-action') !== -1; })[0];
        assert.ok(html, 'article rendered a tip button');
        const btn = H.readTags(html).filter(function(tg) { return tg.attrs['data-tip-action'] !== undefined; })[0];
        checkData(btn.attrs['data-tip-action'], name);
        clickMarkup(tips, btn);
        assert.strictEqual(tips.win._tipOpts.recipientName, name);
        assert.strictEqual(tips.win._tipOpts.bolt11, undefined);
        assert.strictEqual(tips.win._tipOpts.fixedAmount, false);
    }
});

// ---- builders 3 and 4: leaderboard and PvP rows ----
function lbSandbox() {
    return {
        auth: { currentUser: { uid: 'me1' } },
        currentUser: { points: 0, pvpWins: 0, pvpLosses: 0, username: 'me' },
        getLevel: function() { return { emoji: '*' }; },
        _lbBadgeEmoji: function(e) { return e || '*'; },
        LbPrefix: { pvpRecordText: function(w, l) { return w + 'W-' + l + 'L'; } },
        _lbSplitRows: function(rows, render) { let html = ''; (rows || []).forEach(function(r, i) { html += render(r, i); }); return { html: html, rest: '', total: (rows || []).length }; },
        escapeHtml: escapeHtml,
        console: quiet,
    };
}
function lbRow(username, addr) {
    const sandbox = lbSandbox();
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(H.sliceFunction(RANK, 'function _lbXpRowHtml(') + '\nthis._lbXpRowHtml = _lbXpRowHtml;\n', sandbox, { filename: 'ranking.js' });
    return sandbox._lbXpRowHtml({ id: 'u1', username: username, points: 10, lightningAddress: addr }, 'alltime', 0);
}
function pvpRow(username, addr) {
    const sandbox = lbSandbox();
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    var sorts = RANK.slice(RANK.indexOf('/* LB_SORTS_START */'), RANK.indexOf('/* LB_SORTS_END */') + '/* LB_SORTS_END */'.length);
    vm.runInContext(sorts + H.sliceFunction(RANK, 'function _renderPvpSnapshot(') + '\nthis._renderPvpSnapshot = _renderPvpSnapshot;\n', sandbox, { filename: 'ranking.js' });
    const c = { innerHTML: '' };
    sandbox._renderPvpSnapshot(c, { rows: [{ uid: 'u1', username: username, rank: 1, wins: 2, losses: 1, lightningAddress: addr }] });
    return c.innerHTML;
}
[['leaderboard', lbRow], ['PvP', pvpRow]].forEach(function(row) {
    test(row[0] + ' tip data round-trips odd names and addresses', function() {
        NAMES.concat([ADDR]).forEach(function(name) {
            const html = row[1](name, ADDR);
            const tag = tipAttr(html);
            const o = checkData(tag.attrs['data-tip-action'], name, ADDR);
            assert.strictEqual(o.label, 'Tip ' + name);
            H.handlerTexts(html).forEach(function(h) { assert.strictEqual(h.indexOf('MARKT'), -1, h); assert.strictEqual(h.indexOf('lnbc'), -1, h); });
            assert.ok(/_tipFromEl\(this\)/.test(tag.attrs.onclick || ''), 'tip click reads markup through the shared reader');
            LT.forEach(function(lt) {
                const t = loadTips(lt[1], lt[2]);
                clickMarkup(t, tag);
                assert.strictEqual(t.win._tipOpts.recipientName, name);
                assert.strictEqual(t.win._tipOpts.lightningAddress, ADDR);
                assert.strictEqual(t.win._tipOpts.bolt11, undefined);
                assert.strictEqual(t.win._tipOpts.fixedAmount, false);
            });
        });
    });
    test(row[0] + ' tip data drops a non-text address', function() {
        const o = JSON.parse(tipAttr(row[1]('Ada', { x: 1 })).attrs['data-tip-action']);
        assert.strictEqual(o.lightningAddress, '');
    });
});

// ---- overlay option handling ----
LT.forEach(function(row) {
    test(row[0] + ': options from markup never carry an invoice or a fixed amount', async function() {
        const raw = JSON.stringify({ recipientName: 'Ada', bolt11: GOOD_INV, fixedAmount: true, suggestedAmount: 21, onSuccess: 'x' });
        const t = loadTips(row[1], row[2]);
        clickMarkup(t, { attrs: { 'data-tip-action': raw } });
        assert.strictEqual(t.win._tipOpts.bolt11, undefined);
        assert.strictEqual(t.win._tipOpts.fixedAmount, false);
        assert.strictEqual(t.win._tipOpts.onSuccess, undefined);
        t.win.document.getElementById('tipAmount').value = '21';
        await t.win.executeTip();
        assert.deepStrictEqual(t.sent, []);
        // the page-wide click reader follows the same rule
        const d = loadTips(row[1], row[2]);
        const el = H.elFrom({ 'data-tip-action': raw });
        (d.docListeners.click || []).forEach(function(fn) { fn({ target: el, stopPropagation: function() {} }); });
        assert.ok(d.win._tipOpts, 'overlay opened');
        assert.strictEqual(d.win._tipOpts.bolt11, undefined);
        assert.strictEqual(d.win._tipOpts.fixedAmount, false);
        d.win.document.getElementById('tipAmount').value = '21';
        await d.win.executeTip();
        assert.deepStrictEqual(d.sent, []);
    });

    test(row[0] + ': odd markup is ignored', function() {
        ['dm', 'copy-inv', '[1,2]', 'null', '{bad', '"x"', '{"recipientName":{"a":1}}'].forEach(function(raw) {
            const t = loadTips(row[1], row[2]);
            assert.doesNotThrow(function() { clickMarkup(t, { attrs: { 'data-tip-action': raw } }); });
            assert.strictEqual(t.win._tipOpts, undefined, raw);
        });
    });

    test(row[0] + ': the overlay amount is a safe whole number within the max', function() {
        [['<img src=x onerror=MARKT3()>', null], [1e9, null], [-5, null], [1.5, null], [NaN, null], [Infinity, null], ['500', null], [{ toString: function() { return '<b>'; } }, null], [500, 500], [10000000, 10000000]].forEach(function(pair) {
            [true, false].forEach(function(fixed) {
                const t = loadTips(row[1], row[2]);
                t.win.showTipOverlay({ recipientName: 'Ada', suggestedAmount: pair[0], fixedAmount: fixed });
                const html = overlayHtml(t);
                assert.strictEqual(t.win._tipOpts.suggestedAmount, pair[1], String(pair[0]));
                assert.strictEqual(t.win._tipOpts.fixedAmount, !!(fixed && pair[1]));
                assert.strictEqual(html.indexOf('MARKT'), -1);
                assert.strictEqual(html.indexOf('<b>'), -1);
                assert.strictEqual(H.leftoverMarkup(html).indexOf('<img'), -1);
            });
        });
    });

    test(row[0] + ': overlay text fields are text and length-capped', function() {
        const t = loadTips(row[1], row[2]);
        t.win.showTipOverlay({ recipientName: 'A'.repeat(500), recipientUid: { a: 1 }, label: ['x'], context: 7, lightningAddress: 'b'.repeat(1000), extra: 'drop' });
        const o = t.win._tipOpts;
        assert.strictEqual(o.recipientName.length, 128);
        assert.strictEqual(o.recipientUid, '');
        assert.strictEqual(o.label, '');
        assert.strictEqual(o.context, '');
        assert.strictEqual(o.lightningAddress.length, 320);
        assert.strictEqual(o.extra, undefined);
    });

    test(row[0] + ': in-page callers keep a valid invoice and fixed price', async function() {
        const t = loadTips(row[1], row[2]);
        const done = [];
        t.win.showTipOverlay({ recipientName: 'Shop', bolt11: GOOD_INV, fixedAmount: true, suggestedAmount: 21, onSuccess: function() { done.push(1); } });
        assert.strictEqual(t.win._tipOpts.bolt11, GOOD_INV);
        assert.strictEqual(t.win._tipOpts.fixedAmount, true);
        assert.strictEqual(typeof t.win._tipOpts.onSuccess, 'function');
        await t.win.executeTip();
        assert.deepStrictEqual(t.sent, []);
        await t.win.executeTip();
        assert.deepStrictEqual(t.sent, [GOOD_INV]);
    });
});

// ---- global chat tip action ----
function loadChatTip() {
    const calls = [];
    const sandbox = { console: quiet, document: { getElementById: function() { return null; } }, showTipOverlay: function(o) { calls.push(o); } };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    const GC = H.read('global-chat.js');
    vm.runInContext(H.sliceBetween(GC, 'var GC_ID_RE =', 'window._gcBindActions = gcBindActions;'), sandbox, { filename: 'global-chat.js' });
    return { win: sandbox, calls: calls };
}
test('global chat tip passes only a text name and a text uid', function() {
    const odd = { toString: function() { return 'Ada&quot;,"x":"'; } };
    [odd, ['Ada'], 7, null, undefined, { first: 'Ada' }].forEach(function(name, i) {
        const t = loadChatTip();
        t.win._gcMsgById.m1 = { uid: 'u1', name: name };
        vm.runInContext('GC_ACTIONS.tip(null, "m1")', t.win);
        assert.strictEqual(t.calls.length, 1, 'case ' + i);
        assert.strictEqual(t.calls[0].recipientName, 'Anon', 'case ' + i);
        assert.strictEqual(t.calls[0].recipientUid, 'u1');
    });
    const ok = loadChatTip();
    ok.win._gcMsgById.m1 = { uid: 'u1', name: 'Ada' };
    vm.runInContext('GC_ACTIONS.tip(null, "m1")', ok.win);
    assert.strictEqual(ok.calls[0].recipientName, 'Ada');
    [['u1'], { toString: function() { return 'u1'; } }, 5].forEach(function(uid) {
        const t = loadChatTip();
        t.win._gcMsgById.m1 = { uid: uid, name: 'Ada' };
        vm.runInContext('GC_ACTIONS.tip(null, "m1")', t.win);
        assert.strictEqual(t.calls.length, 0);
    });
});

run();
