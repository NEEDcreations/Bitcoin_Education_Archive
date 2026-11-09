'use strict';
// Home-page admin shield and admin tools panel: gated only on the Firebase
// custom claim admin, lazy-loaded, and no admin emails left in client gates.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('\u2705 ' + name);
        passed++;
    } catch (e) {
        console.log('\u274c ' + name + ': ' + (e && e.stack || e));
        failed++;
    }
}

// ---- tiny DOM fake ------------------------------------------------------
function makeDoc() {
    const byId = new Map();
    const headKids = [];
    let scripts = [];
    function makeEl(tag) {
        const el = {
            tagName: String(tag || 'div').toUpperCase(),
            _id: '',
            className: '',
            style: {},
            attributes: {},
            children: [],
            parentNode: null,
            textContent: '',
            innerHTML: '',
            listeners: {},
            get id() { return this._id; },
            set id(v) { this._id = v; if (v) byId.set(v, this); },
            setAttribute(k, v) { this.attributes[k] = String(v); },
            getAttribute(k) { return this.attributes[k]; },
            addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
            click() { (this.listeners.click || []).forEach((fn) => fn({ target: this, preventDefault() {} })); },
            appendChild(c) { c.parentNode = this; this.children.push(c); if (c.tagName === 'SCRIPT') scripts.push(c); return c; },
            insertBefore(c, ref) {
                c.parentNode = this;
                const i = ref ? this.children.indexOf(ref) : -1;
                if (i >= 0) this.children.splice(i, 0, c); else this.children.push(c);
                return c;
            },
            removeChild(c) {
                const i = this.children.indexOf(c);
                if (i >= 0) this.children.splice(i, 1);
                c.parentNode = null;
                if (c._id && byId.get(c._id) === c) byId.delete(c._id);
            },
            get firstChild() { return this.children[0] || null; },
            querySelector(sel) {
                if (sel.charAt(0) !== '.') return null;
                const cls = sel.slice(1);
                const walk = (n) => {
                    for (const k of n.children) {
                        if ((' ' + k.className + ' ').indexOf(' ' + cls + ' ') >= 0) return k;
                        const f = walk(k); if (f) return f;
                    }
                    return null;
                };
                return walk(this);
            },
            focus() {}
        };
        return el;
    }
    const body = makeEl('body');
    const head = makeEl('head');
    head.appendChild = function (c) { c.parentNode = head; headKids.push(c); if (c.tagName === 'SCRIPT') scripts.push(c); return c; };
    const doc = {
        body, head,
        activeElement: null,
        getElementById(id) {
            const el = byId.get(id);
            if (!el) return null;
            // Only count nodes that are still attached somewhere.
            let n = el;
            while (n.parentNode) n = n.parentNode;
            return (n === body || n === head || n === doc._home || n === doc._inner) ? el : null;
        },
        createElement: makeEl,
        querySelector(sel) { return sel === '#home .home-inner' ? doc._inner : null; },
        addEventListener() {}, removeEventListener() {},
        scripts() { return scripts; }
    };
    const home = makeEl('div'); home.id = 'home';
    const inner = makeEl('div'); inner.className = 'home-inner';
    home.appendChild(inner);
    const strip = makeEl('div'); strip.id = 'homeWalletStrip';
    inner.appendChild(strip);
    body.appendChild(home);
    doc._home = home; doc._inner = inner;
    return doc;
}

function rankingChunk() {
    const src = read('ranking.js');
    const start = src.indexOf('function settleAdminClaim()');
    const endMark = 'window.syncHomeAdminBtn = syncHomeAdminBtn;';
    const end = src.indexOf(endMark) + endMark.length;
    assert.ok(start > 0 && end > start, 'admin block found');
    return src.slice(start, end);
}

function sandboxFor(doc, claimAdmin) {
    const user = {
        uid: 'u1', isAnonymous: false,
        getIdTokenResult() { return Promise.resolve({ claims: claimAdmin ? { admin: true } : {} }); }
    };
    const sb = {
        document: doc,
        auth: { currentUser: user },
        console, setTimeout, Date, Promise,
        showSettings() { sb._opened.push('settings'); },
        showSettingsPage(t) { sb._opened.push('page:' + t); },
        _opened: []
    };
    sb.window = sb;
    sb._isAdminClaim = false;
    vm.createContext(sb);
    return sb;
}

function flush() { return new Promise((r) => setImmediate(r)); }

test('index.html and 404.html stay identical', function () {
    assert.strictEqual(read('index.html'), read('404.html'));
});

test('the button is claim-gated: none for non-admins, shown for admins, removed on loss', function () {
    const doc = makeDoc();
    const sb = sandboxFor(doc, false);
    vm.runInContext(rankingChunk(), sb, { filename: 'ranking-admin.js' });
    sb._isAdminClaim = false;
    sb.syncHomeAdminBtn();
    assert.strictEqual(doc.getElementById('homeAdminBtn'), null);

    sb._isAdminClaim = 'true'; // truthy but not the boolean claim
    sb.syncHomeAdminBtn();
    assert.strictEqual(doc.getElementById('homeAdminBtn'), null);

    sb._isAdminClaim = true;
    sb.syncHomeAdminBtn();
    const btn = doc.getElementById('homeAdminBtn');
    assert.ok(btn, 'admin sees the button');
    assert.strictEqual(btn.getAttribute('data-on'), '1');
    assert.strictEqual(btn.getAttribute('aria-label'), 'Admin tools');
    // In normal flow, above the wallet strip (never absolute over the pot/FABs).
    assert.strictEqual(doc._inner.children[0], btn);

    sb._isAdminClaim = false;
    sb.syncHomeAdminBtn();
    assert.strictEqual(doc.getElementById('homeAdminBtn'), null);
});

test('button CSS is big, in flow, and themed for light mode', function () {
    const src = rankingChunk();
    assert.ok(/#homeAdminBtn\{[^}]*width:100%/.test(src));
    assert.ok(/#homeAdminBtn\{[^}]*min-height:58px/.test(src));
    assert.ok(!/#homeAdminBtn\{[^}]*position:(absolute|fixed)/.test(src));
    assert.ok(src.includes('[data-theme="light"] #homeAdminBtn'));
});

test('admin button and panel code never gate on email', function () {
    const chunk = rankingChunk();
    const panel = read('admin-panel.js');
    [chunk, panel].forEach(function (s) {
        assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(s), 'no email literal');
        assert.ok(!/\.email\b/.test(s), 'no email reads');
    });
    assert.ok(chunk.includes('tokenResult.claims.admin === true'));
});

test('the auth listener drops the claim on sign-out or account switch, then re-reads it', function () {
    const src = read('ranking.js');
    const i = src.indexOf('auth.onAuthStateChanged(user => {');
    const chunk = src.slice(i, i + 1600);
    assert.ok(chunk.includes('window._isAdminClaim = false;'));
    assert.ok(chunk.includes('syncHomeAdminBtn()'));
    assert.ok(chunk.includes('settleAdminClaim()'));
    assert.ok(src.includes('if (!auth || auth.currentUser !== user) return;'), 'stale token answers are dropped');
});


console.log('');
(async function () {
    // async tests
    async function atest(name, fn) {
        try { await fn(); console.log('\u2705 ' + name); passed++; }
        catch (e) { console.log('\u274c ' + name + ': ' + (e && e.stack || e)); failed++; }
    }

    await atest('a non-admin tap loads nothing and opens nothing', async function () {
        const doc = makeDoc();
        const sb = sandboxFor(doc, false);
        vm.runInContext(rankingChunk(), sb);
        sb._isAdminClaim = true; // stale local flag; the token says no
        sb.syncHomeAdminBtn();
        sb.openHomeAdminTools();
        await flush();
        assert.strictEqual(sb._isAdminClaim, false);
        assert.strictEqual(doc.getElementById('homeAdminBtn'), null);
        assert.strictEqual(doc.scripts().length, 0, 'admin-panel.js not requested');
        assert.deepStrictEqual(sb._opened, []);
    });

    await atest('an admin tap lazy-loads admin-panel.js and opens the panel with tips', async function () {
        const doc = makeDoc();
        const sb = sandboxFor(doc, true);
        vm.runInContext(rankingChunk(), sb);
        sb._isAdminClaim = true;
        sb.syncHomeAdminBtn();
        doc.getElementById('homeAdminBtn').click();
        await flush();
        const s = doc.scripts().find((x) => /admin-panel\.js\?v=20261109_v2542$/.test(x.src));
        assert.ok(s, 'panel script requested');
        vm.runInContext(read('admin-panel.js'), sb, { filename: 'admin-panel.js' });
        s.onload();
        const panel = doc.getElementById('bqAdminPanel');
        assert.ok(panel, 'panel open');
        const tools = [];
        sb.bqAdminPanelTools.forEach((g) => g.tools.forEach((t) => tools.push(t)));
        assert.ok(tools.length >= 8);
        tools.forEach(function (t) {
            assert.ok(t.tip && t.tip.length >= 20 && t.tip.length <= 90, 'one-line tip for ' + t.id);
            assert.ok(t.how && t.how.length >= 20, 'how tip for ' + t.id);
            assert.strictEqual(typeof t.open, 'function');
        });
        ['cipherWins', 'factionPrize', 'faucetAbuse', 'factionBackfill', 'chat', 'forum', 'market', 'beats', 'topics']
            .forEach((id) => assert.ok(tools.some((t) => t.id === id), 'tile ' + id));
        // Tapping a Settings tile closes the panel and opens the existing admin mount.
        const sheet = panel.children[0];
        const firstRow = sheet.children.find((c) => c.className === 'bap-row');
        firstRow.children[0].click();
        assert.strictEqual(doc.getElementById('bqAdminPanel'), null);
        assert.ok(sb._opened.includes('settings'));
    });

    await atest('the panel refuses to open without the claim and closes when it is lost', async function () {
        const doc = makeDoc();
        const sb = sandboxFor(doc, true);
        vm.runInContext(rankingChunk(), sb);
        vm.runInContext(read('admin-panel.js'), sb);
        sb._isAdminClaim = false;
        sb.bqOpenAdminPanel();
        assert.strictEqual(doc.getElementById('bqAdminPanel'), null);
        sb._isAdminClaim = true;
        sb.bqOpenAdminPanel();
        assert.ok(doc.getElementById('bqAdminPanel'));
        sb._isAdminClaim = false;
        sb.syncHomeAdminBtn();
        assert.strictEqual(doc.getElementById('bqAdminPanel'), null);
    });

    await atest('admin-panel.js is not in the bundle, index.html, or the SW precache', async function () {
        assert.ok(!read('bundle.src.js').includes('bqOpenAdminPanel'));
        assert.ok(!read('index.html').includes('admin-panel.js'));
        assert.ok(!read('sw.js').includes('admin-panel.js'));
    });

    await atest('client admin helpers use the claim, not hardcoded emails', async function () {
        const market = read('marketplace.js');
        const forum = read('forum.js');
        const ux = read('ux-patches.js');
        const beats = read('beats.js');
        const quests = read('quests.js');
        assert.ok(market.includes('window._isAdminClaim === true'));
        assert.ok(forum.includes('window._isAdminClaim === true'));
        assert.ok(ux.includes('window._isAdminClaim === true'));
        assert.ok(quests.includes("var isAdmin = window._isAdminClaim === true;"));
        assert.ok(beats.split('\n').filter((l) => /_isAdminClaim === true/.test(l)).length >= 3);
    });

    await atest('no admin account email appears in any gate in client code', async function () {
        const skip = /^(functions|tests|node_modules|data|\.git)(\/|$)/;
        const files = [];
        (function walk(dir) {
            fs.readdirSync(path.join(root, dir), { withFileTypes: true }).forEach(function (d) {
                const rel = dir ? dir + '/' + d.name : d.name;
                if (skip.test(rel)) return;
                if (d.isDirectory()) walk(rel);
                else if (/\.(js|html)$/.test(d.name)) files.push(rel);
            });
        })('');
        assert.ok(files.length > 50);
        const personal = /needcreations@gmail|najemchris8@/i;
        // The public support address may appear in contact text, never in a check.
        const gate = /(email|_e)\s*(===|==|!==)\s*['"][^'"]*@|['"][^'"]*@[^'"]*['"]\s*(===|==)|\[[^\]]*@gmail\.com[^\]]*\]\s*\.(indexOf|includes)/i;
        files.forEach(function (f) {
            const src = read(f);
            assert.ok(!personal.test(src), 'personal admin email in ' + f);
            assert.ok(!gate.test(src), 'email gate in ' + f);
        });
    });

    await atest('server admin gates use context.auth.token.admin', async function () {
        const favor = read('functions/src/satoshiFavor.js');
        const onboarding = read('functions/src/onboardingApi.js');
        const start = favor.indexOf('exports.backfillFactionTotals');
        const chunk = favor.slice(start, start + 900);
        assert.ok(chunk.includes('context.auth.token.admin !== true'));
        assert.ok(!/ADMIN_EMAILS/.test(chunk));
        assert.ok(onboarding.includes('function roleMayUseReserved(context)'));
        assert.ok(onboarding.includes('context.auth.token.admin === true'));
        assert.ok(!onboarding.includes('roleMayUseReserved(current)'));
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
