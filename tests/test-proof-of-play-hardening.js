// Proof of Play content fixes and embed hardening (SW v2624, pin 20261119_v2624b).
// Checks the card builder rejects non-https URLs, Sat Arcade iframe attributes
// are locked down with no src until Play, create-on-tap / destroy-on-close,
// and hard-coded embed + external allowlists.
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
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + ': ' + e.message); failed++; }
}

function walk(node, fn) {
    if (!node) return;
    fn(node);
    (node.childNodes || []).forEach(function (c) { walk(c, fn); });
}

function allIframes(rootNode) {
    var out = [];
    walk(rootNode, function (n) { if (n.tagName === 'IFRAME') out.push(n); });
    return out;
}

function findButtons(rootNode, text) {
    var out = [];
    walk(rootNode, function (n) {
        if (n.tagName === 'BUTTON' && n.textContent === text) out.push(n);
    });
    return out;
}

function makeDom() {
    var byId = {};
    var docListeners = {};
    var winListeners = {};

    function element(tag) {
        var node = {
            tagName: String(tag).toUpperCase(),
            attrs: {},
            listeners: {},
            childNodes: [],
            style: {},
            parentNode: null,
            disabled: false,
            className: '',
            _id: '',
            setAttribute: function (k, v) {
                var key = String(k).toLowerCase();
                this.attrs[key] = String(v);
                if (key === 'id') {
                    this._id = String(v);
                    byId[this._id] = this;
                }
            },
            getAttribute: function (k) {
                var key = String(k).toLowerCase();
                if (key === 'id' && this._id && !Object.prototype.hasOwnProperty.call(this.attrs, 'id')) {
                    return this._id;
                }
                return Object.prototype.hasOwnProperty.call(this.attrs, key) ? this.attrs[key] : null;
            },
            removeAttribute: function (k) { delete this.attrs[String(k).toLowerCase()]; },
            addEventListener: function (type, fn) {
                (this.listeners[type] || (this.listeners[type] = [])).push(fn);
            },
            removeEventListener: function (type, fn) {
                var list = this.listeners[type];
                if (!list) return;
                this.listeners[type] = list.filter(function (f) { return f !== fn; });
            },
            appendChild: function (child) {
                child.parentNode = this;
                this.childNodes.push(child);
                if (child._id) byId[child._id] = child;
                return child;
            },
            removeChild: function (child) {
                var list = this.childNodes;
                var i = list.indexOf(child);
                if (i >= 0) list.splice(i, 1);
                if (child) child.parentNode = null;
                return child;
            },
            remove: function () {
                if (this._id && byId[this._id] === this) delete byId[this._id];
                if (!this.parentNode) return;
                this.parentNode.removeChild(this);
            },
            querySelector: function (sel) {
                var all = this.querySelectorAll(sel);
                return all[0] || null;
            },
            querySelectorAll: function (sel) {
                var out = [];
                var want = String(sel || '');
                walk(this, function (n) {
                    if (n === node && want.charAt(0) !== '#') {
                        // skip self for tag searches from a container; still allow
                    }
                    if (want === 'iframe' && n.tagName === 'IFRAME' && n !== node) out.push(n);
                    else if (want.charAt(0) === '#' && n._id === want.slice(1)) out.push(n);
                    else if (want.charAt(0) === '.' && (n.className || '').split(/\s+/).indexOf(want.slice(1)) !== -1) out.push(n);
                });
                return out;
            },
            classList: {
                _owner: null,
                toggle: function (name, on) {
                    var el = this._owner;
                    var parts = (el.className || '').split(/\s+/).filter(Boolean);
                    var has = parts.indexOf(name) !== -1;
                    var should = (on === undefined) ? !has : !!on;
                    if (should && !has) parts.push(name);
                    if (!should && has) parts = parts.filter(function (p) { return p !== name; });
                    el.className = parts.join(' ');
                }
            },
            click: function () {
                var ev = { type: 'click', stopPropagation: function () {}, target: this };
                (this.listeners.click || []).forEach(function (fn) { fn(ev); });
            }
        };
        node.classList._owner = node;
        Object.defineProperty(node, 'id', {
            get: function () { return this._id || this.attrs.id || ''; },
            set: function (v) {
                this._id = String(v);
                this.attrs.id = this._id;
                byId[this._id] = this;
            }
        });
        Object.defineProperty(node, 'textContent', {
            get: function () { return this._text || ''; },
            set: function (v) {
                var self = this;
                (this.childNodes || []).slice().forEach(function (c) {
                    if (c && c.tagName === 'IFRAME') {
                        // textContent = '' must not be how we destroy embeds in prod;
                        // still drop children here as the DOM would.
                    }
                    if (c && c._id && byId[c._id] === c) delete byId[c._id];
                    if (c) c.parentNode = null;
                });
                this._text = String(v);
                this.childNodes = [];
            }
        });
        Object.defineProperty(node, 'src', {
            get: function () { return this.attrs.src || ''; },
            set: function (v) { this.attrs.src = String(v); }
        });
        Object.defineProperty(node, 'innerHTML', {
            get: function () { return this._html || ''; },
            set: function (html) {
                var self = this;
                (this.childNodes || []).slice().forEach(function (c) {
                    if (c && c._id && byId[c._id] === c) delete byId[c._id];
                    if (c) c.parentNode = null;
                });
                this.childNodes = [];
                this._html = String(html);
                var re = /<([a-zA-Z0-9]+)([^>]*)>/g;
                var m;
                while ((m = re.exec(html))) {
                    var tag = m[1];
                    var attrs = m[2] || '';
                    var idm = attrs.match(/\sid=["']([^"']+)["']/);
                    if (!idm) continue;
                    var el = element(tag);
                    el.id = idm[1];
                    self.appendChild(el);
                }
            }
        });
        return node;
    }

    var head = element('head');
    var body = element('body');
    var document = {
        head: head,
        body: body,
        documentElement: element('html'),
        createElement: element,
        createTextNode: function (t) {
            var n = element('#text');
            n.textContent = t;
            return n;
        },
        getElementById: function (id) {
            return byId[id] || null;
        },
        addEventListener: function (type, fn, opts) {
            (docListeners[type] || (docListeners[type] = [])).push({ fn: fn, opts: opts });
        },
        removeEventListener: function (type, fn) {
            var list = docListeners[type];
            if (!list) return;
            docListeners[type] = list.filter(function (x) { return x.fn !== fn; });
        },
        querySelector: function (sel) {
            if (sel && sel.charAt(0) === '#') return byId[sel.slice(1)] || null;
            var all = this.querySelectorAll(sel);
            return all[0] || null;
        },
        querySelectorAll: function (sel) {
            var out = [];
            walk(this.documentElement, function (n) {
                if (sel === 'iframe' && n.tagName === 'IFRAME') out.push(n);
            });
            walk(this.body, function (n) {
                if (sel === 'iframe' && n.tagName === 'IFRAME' && out.indexOf(n) === -1) out.push(n);
            });
            walk(this.head, function (n) {
                if (sel === 'iframe' && n.tagName === 'IFRAME' && out.indexOf(n) === -1) out.push(n);
            });
            return out;
        }
    };
    document.documentElement.appendChild(head);
    document.documentElement.appendChild(body);

    var opened = [];
    var location = { hash: '', pathname: '/', href: 'https://bitcoineducation.quest/' };
    var windowObj = {
        document: document,
        location: location,
        history: {
            pushState: function (state, title, url) {
                if (typeof url === 'string') {
                    if (url.charAt(0) === '#') location.hash = url;
                    else if (url === location.pathname || url === '/') location.hash = '';
                }
            }
        },
        localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
        addEventListener: function (type, fn, opts) {
            (winListeners[type] || (winListeners[type] = [])).push({ fn: fn, opts: opts });
        },
        removeEventListener: function (type, fn) {
            var list = winListeners[type];
            if (!list) return;
            winListeners[type] = list.filter(function (x) { return x.fn !== fn; });
        },
        open: function (url, target, features) {
            opened.push({ url: url, target: target, features: features });
            return { opener: windowObj };
        }
    };
    windowObj.window = windowObj;
    document.defaultView = windowObj;

    var pendingTimers = [];
    function fakeSetTimeout(fn, ms) {
        var id = pendingTimers.length + 1;
        pendingTimers.push({ id: id, fn: fn, ms: ms || 0 });
        return id;
    }
    function fakeClearTimeout(id) {
        pendingTimers = pendingTimers.filter(function (t) { return t.id !== id; });
    }
    function flushTimers() {
        var list = pendingTimers.slice();
        pendingTimers = [];
        list.forEach(function (t) { t.fn(); });
    }

    vm.runInNewContext(read('proof-of-play.js'), {
        window: windowObj,
        document: document,
        URL: URL,
        localStorage: windowObj.localStorage,
        history: windowObj.history,
        console: console,
        setTimeout: fakeSetTimeout,
        clearTimeout: fakeClearTimeout
    });

    function dispatch(target, type, event) {
        var bag = target === document ? docListeners : winListeners;
        var list = (bag[type] || []).slice();
        list.forEach(function (x) { x.fn(event); });
    }

    return {
        window: windowObj,
        document: document,
        opened: opened,
        flushTimers: flushTimers,
        dispatchDocument: function (type, event) { dispatch(document, type, event); },
        dispatchWindow: function (type, event) { dispatch(windowObj, type, event); },
        byId: byId
    };
}

function playSatArcade(ctx) {
    var wrap = ctx.document.getElementById('popBody');
    assert.ok(wrap, 'popBody exists');
    ctx.window._renderSatArcadeTab(wrap);
    assert.strictEqual(allIframes(wrap).length, 0, 'no iframe until Play');
    var btns = findButtons(wrap, 'Play here');
    assert.strictEqual(btns.length, 1, 'Play here button present');
    btns[0].click();
    var frames = allIframes(wrap);
    assert.strictEqual(frames.length, 1, 'iframe created on Play');
    assert.strictEqual(frames[0].src, 'https://ck121212195.github.io/SAT-ARCADE/');
    return frames[0];
}

function openHubOnSatArcade(ctx) {
    ctx.window.enterProofOfPlay('sat_arcade');
    return playSatArcade(ctx);
}

test('SW is v2682 and proof-of-play.js is pinned at 20261119_v2682', () => {
    assert.ok(read('sw.js').includes("const CACHE_NAME = 'btc-archive-v2682'"));
    assert.ok(!read('sw.js').includes("const CACHE_NAME = 'btc-archive-v2630'"));
    assert.ok(read('app.js').includes('proof-of-play.js?v=20261119_v2682'));
    const html = read('index.html');
    assert.ok(html.includes('proof-of-play.js?v=20261119_v2682'));
    assert.strictEqual((html.match(/proof-of-play\.js\?v=20261119_v2682/g) || []).length, 2);
    assert.ok(!html.includes('proof-of-play.js?v=20261119_v2624"') && !html.includes("proof-of-play.js?v=20261119_v2624'"));
    assert.strictEqual(read('404.html'), html);
});

test('card builder rejects non-https URLs and does not open them', () => {
    const { window, opened } = makeDom();
    const reject = [
        'javascript:alert(1)',
        'data:text/html,hi',
        'http://timechainarcade.com/games/stackmachine',
        '//evil.example/games',
        'ftp://timechainarcade.com/games/stackmachine',
        '/games/stackmachine',
        '',
        'https://evil.com" onclick="alert(1)'
    ];
    reject.forEach(function (url) {
        assert.strictEqual(window._popSafeHttpsUrl(url), '', 'should reject ' + url);
        const card = window._popBuildArcadeCard({
            title: '<img src=x>',
            url: url,
            genre: 'Quiz',
            players: '1P',
            desc: 'desc',
            thumb: url
        });
        assert.ok(card, 'card still builds for ' + url);
        const title = card.childNodes[1] && card.childNodes[1].childNodes[0];
        assert.strictEqual(title.textContent, '<img src=x>', 'title is text, not HTML');
        const before = opened.length;
        card.click();
        assert.strictEqual(opened.length, before, 'click must not open ' + url);
        const imgs = [];
        walk(card, function (n) { if (n.tagName === 'IMG') imgs.push(n); });
        imgs.forEach(function (img) {
            assert.ok(!img.getAttribute('src'), 'rejected thumb is not used as src: ' + url);
        });
    });

    const okUrl = 'https://timechainarcade.com/games/stackmachine';
    assert.strictEqual(window._popSafeHttpsUrl(okUrl), okUrl);
    const ok = window._popBuildArcadeCard({
        title: 'Stack Machine',
        url: okUrl,
        genre: 'Educational',
        players: '1P',
        desc: 'Learn Script',
        thumb: 'https://timechainarcade.com/images/poster-amazing-stack-machine.jpg'
    });
    ok.click();
    assert.strictEqual(opened.length, 1);
    assert.strictEqual(opened[0].url, okUrl);
    assert.strictEqual(opened[0].target, '_blank');
    assert.ok(opened[0].features.indexOf('noopener') !== -1);
    assert.ok(opened[0].features.indexOf('noreferrer') !== -1);
});

test('embed iframe attributes are locked down and src waits for Play', () => {
    const { window } = makeDom();
    assert.strictEqual(window._popCreateEmbedIframe('http://ck121212195.github.io/SAT-ARCADE/'), null);
    assert.strictEqual(window._popCreateEmbedIframe('javascript:alert(1)'), null);

    const url = 'https://ck121212195.github.io/SAT-ARCADE/';
    const iframe = window._popCreateEmbedIframe(url);
    assert.ok(iframe);
    assert.strictEqual(iframe.getAttribute('sandbox'), 'allow-scripts allow-same-origin');
    assert.ok(iframe.getAttribute('sandbox').indexOf('allow-top-navigation') === -1);
    assert.strictEqual(iframe.getAttribute('allow'), 'fullscreen');
    assert.ok(iframe.getAttribute('allow').indexOf('payment') === -1);
    assert.ok(iframe.getAttribute('allow').indexOf('autoplay') === -1);
    assert.strictEqual(iframe.getAttribute('referrerpolicy'), 'no-referrer');
    assert.ok(!iframe.getAttribute('src'), 'src is not set until Play');
    assert.strictEqual(iframe.getAttribute('data-pop-embed-src'), url);

    assert.strictEqual(window._popStartEmbed(iframe), true);
    assert.strictEqual(iframe.src, url);
});

test('content fixes: stackmachine, images, BC Grand Prix, no sats claims or launch rewards', () => {
    const src = read('proof-of-play.js');
    assert.ok(src.includes("url: 'https://timechainarcade.com/games/stackmachine'"));
    assert.ok(!src.includes("url: 'https://timechainarcade.com/games/stack-machine'"));
    assert.ok(src.includes("https://timechainarcade.com/images/poster-to-the-moon.jpg"));
    assert.ok(!src.includes("images/games/tothemoon-intro.jpg"));
    assert.ok(src.includes("https://ryracer.com/metaimage-hero.webp"));
    assert.ok(!src.includes('metaimage.png'));
    assert.ok(src.includes("title: 'BC Grand Prix'"));
    assert.ok(!src.includes("title: 'BC Racers'"));
    assert.ok(src.includes("url: 'https://timechainarcade.com/games/bcracers'"));
    assert.ok(!src.includes('WEEKLY SATS POT'));
    assert.ok(!src.includes('SATS PER RACE'));
    assert.ok(!src.includes('earns sats'));
    assert.ok(!src.includes('bank the sats'));
    assert.ok(!src.includes('awardPoints'));
    assert.ok(!src.includes('popGameOverlay'));
    assert.ok(!/allow=["'][^"']*payment/.test(src));
    assert.ok(!/allow=["'][^"']*autoplay/.test(src));
    assert.ok(!src.includes('ZBD'));
    assert.ok(!src.includes('THNDR'));
    assert.ok(!src.includes('FreeBTC'));
    assert.ok(!src.includes('Clixel'));
    assert.ok(!src.includes('Bitcoin Arena'));
});

test('Sat Arcade iframe is created only when Play is tapped', () => {
    const ctx = makeDom();
    ctx.window.enterProofOfPlay('sat_arcade');
    const wrap = ctx.document.getElementById('popBody');
    assert.ok(wrap);
    assert.strictEqual(allIframes(wrap).length, 0, 'tab render does not create an iframe');
    assert.strictEqual(allIframes(ctx.document.body).length, 0, 'no iframe hidden in the hub');
    const iframe = playSatArcade(ctx);
    assert.strictEqual(iframe.getAttribute('sandbox'), 'allow-scripts allow-same-origin');
    assert.strictEqual(iframe.getAttribute('allow'), 'fullscreen');
    assert.strictEqual(iframe.getAttribute('referrerpolicy'), 'no-referrer');
    assert.ok(iframe.parentNode, 'iframe is in the DOM after Play');
});

test('destroy-on-close blanks src and removes the iframe on every close path', () => {
    function assertDestroyed(ctx, iframe, label) {
        assert.strictEqual(iframe.src, 'about:blank', label + ': src blanked first');
        assert.strictEqual(iframe.parentNode, null, label + ': iframe removed from the DOM');
        const overlay = ctx.document.getElementById('popOverlay');
        const body = ctx.document.getElementById('popBody');
        const leftover = allIframes(ctx.document.body).concat(body ? allIframes(body) : []).concat(overlay ? allIframes(overlay) : []);
        assert.strictEqual(leftover.length, 0, label + ': no iframe left in the hub');
    }

    // Close button / exitProofOfPlay
    var ctx = makeDom();
    var iframe = openHubOnSatArcade(ctx);
    ctx.window.exitProofOfPlay();
    assertDestroyed(ctx, iframe, 'close button / exit');
    assert.strictEqual(ctx.document.getElementById('popOverlay'), null, 'overlay removed on exit');

    // Escape
    ctx = makeDom();
    iframe = openHubOnSatArcade(ctx);
    ctx.dispatchDocument('keydown', { key: 'Escape', preventDefault: function () {} });
    assertDestroyed(ctx, iframe, 'Escape');

    // Back / popstate
    ctx = makeDom();
    iframe = openHubOnSatArcade(ctx);
    ctx.dispatchWindow('popstate', { type: 'popstate' });
    assertDestroyed(ctx, iframe, 'back / popstate');

    // Route change (hash leaves the hub)
    ctx = makeDom();
    iframe = openHubOnSatArcade(ctx);
    ctx.window.location.hash = '#forum';
    ctx.dispatchWindow('hashchange', { type: 'hashchange' });
    assertDestroyed(ctx, iframe, 'route change');

    // Leaving the hub for PvP
    ctx = makeDom();
    iframe = openHubOnSatArcade(ctx);
    ctx.window._popEnterPVP();
    assertDestroyed(ctx, iframe, 'leave hub for PvP');

    // Tab switch leaves the Sat Arcade view immediately (not after 150ms)
    ctx = makeDom();
    iframe = openHubOnSatArcade(ctx);
    ctx.window._popSwitchTab('arcade');
    assert.strictEqual(iframe.src, 'about:blank', 'tab switch: src blanked immediately');
    assert.strictEqual(iframe.parentNode, null, 'tab switch: iframe removed immediately');
    var body = ctx.document.getElementById('popBody');
    assert.strictEqual(allIframes(body).length, 0, 'tab switch: no hidden iframe before re-render');
    ctx.flushTimers();
    assert.strictEqual(allIframes(body).length, 0, 'tab switch: still no iframe after arcade re-render');
});

test('embed and outside-link allowlists reject anything else', () => {
    const ctx = makeDom();
    const window = ctx.window;
    const prefix = 'https://ck121212195.github.io/SAT-ARCADE/';

    assert.strictEqual(window._popAllowedEmbedUrl(prefix), prefix);
    assert.strictEqual(window._popAllowedEmbedUrl(prefix + 'index.html'), prefix + 'index.html');
    const rejectEmbed = [
        'https://ck121212195.github.io/OTHER/',
        'https://ck121212195.github.io/SAT-ARCADE',
        'https://ck121212195.github.io/SAT-ARCADE-evil/',
        'https://evil.github.io/SAT-ARCADE/',
        'https://ck121212195.github.io.evil.com/SAT-ARCADE/',
        'https://example.com/SAT-ARCADE/',
        'http://ck121212195.github.io/SAT-ARCADE/',
        'https://ck121212195.github.io/SAT-ARCADE/../',
        'javascript:alert(1)'
    ];
    rejectEmbed.forEach(function (url) {
        assert.strictEqual(window._popAllowedEmbedUrl(url), '', 'embed reject ' + url);
        assert.strictEqual(window._popCreateEmbedIframe(url), null, 'create reject ' + url);
    });

    // Tampered data-pop-embed-src must not start
    const good = window._popCreateEmbedIframe(prefix);
    good.setAttribute('data-pop-embed-src', 'https://evil.example/game');
    assert.strictEqual(window._popStartEmbed(good), false);
    assert.ok(!good.src, 'tampered src is not applied');

    // Outside links: exact host, https only
    assert.strictEqual(window._popAllowedExternalUrl('https://timechainarcade.com/games/stackmachine'), 'https://timechainarcade.com/games/stackmachine');
    assert.strictEqual(window._popAllowedExternalUrl('https://galaxymind.space/arcade'), 'https://galaxymind.space/arcade');
    assert.strictEqual(window._popAllowedExternalUrl('https://ryracer.com/'), 'https://ryracer.com/');
    assert.strictEqual(window._popAllowedExternalUrl(prefix), prefix, 'Full Tab may open the embed origin');

    const rejectExt = [
        'https://www.timechainarcade.com/games/stackmachine',
        'https://evil.timechainarcade.com/games/stackmachine',
        'http://timechainarcade.com/games/stackmachine',
        'https://twitter.com/TimechainArcade',
        'https://evil.com/',
        'https://galaxymind.space.evil.com/',
        'https://ryracer.com.evil.com/',
        'javascript:alert(1)'
    ];
    const before = ctx.opened.length;
    rejectExt.forEach(function (url) {
        assert.strictEqual(window._popAllowedExternalUrl(url), '', 'external reject ' + url);
        assert.strictEqual(window._popOpenOutside(url), null, 'open reject ' + url);
        const a = window._popExternalAnchor(url, 'x');
        assert.ok(!a.getAttribute('href'), 'anchor not rendered for ' + url);
        const card = window._popBuildArcadeCard({ title: 'x', url: url, thumb: url, genre: 'g', players: '1P', desc: 'd' });
        const cardBefore = ctx.opened.length;
        card.click();
        assert.strictEqual(ctx.opened.length, cardBefore, 'card does not open ' + url);
        walk(card, function (n) {
            if (n.tagName === 'IMG') assert.ok(!n.getAttribute('src'), 'thumb not rendered for ' + url);
        });
    });
    assert.strictEqual(ctx.opened.length, before, 'no rejected URL was opened');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
