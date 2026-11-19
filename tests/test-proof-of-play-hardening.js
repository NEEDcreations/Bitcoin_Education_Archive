// Proof of Play content fixes and embed hardening (SW v2624).
// Checks the card builder rejects non-https URLs and that Sat Arcade
// iframe attributes are locked down, with no src until Play.
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

function makeDom() {
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
            setAttribute: function (k, v) { this.attrs[String(k).toLowerCase()] = String(v); },
            getAttribute: function (k) {
                var key = String(k).toLowerCase();
                return Object.prototype.hasOwnProperty.call(this.attrs, key) ? this.attrs[key] : null;
            },
            removeAttribute: function (k) { delete this.attrs[String(k).toLowerCase()]; },
            addEventListener: function (type, fn) {
                (this.listeners[type] || (this.listeners[type] = [])).push(fn);
            },
            appendChild: function (child) {
                child.parentNode = this;
                this.childNodes.push(child);
                return child;
            },
            remove: function () {
                if (!this.parentNode) return;
                var list = this.parentNode.childNodes;
                var i = list.indexOf(this);
                if (i >= 0) list.splice(i, 1);
                this.parentNode = null;
            },
            click: function () {
                var ev = { type: 'click', stopPropagation: function () {}, target: this };
                (this.listeners.click || []).forEach(function (fn) { fn(ev); });
            }
        };
        Object.defineProperty(node, 'textContent', {
            get: function () { return this._text || ''; },
            set: function (v) { this._text = String(v); this.childNodes = []; }
        });
        Object.defineProperty(node, 'src', {
            get: function () { return this.attrs.src || ''; },
            set: function (v) { this.attrs.src = String(v); }
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
        getElementById: function () { return null; },
        addEventListener: function () {},
        querySelector: function () { return null; }
    };

    var opened = [];
    var windowObj = {
        document: document,
        location: { hash: '', pathname: '/', href: 'https://bitcoineducation.quest/' },
        history: { pushState: function () {} },
        localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
        addEventListener: function () {},
        open: function (url, target, features) {
            opened.push({ url: url, target: target, features: features });
            return { opener: windowObj };
        }
    };
    windowObj.window = windowObj;
    document.defaultView = windowObj;

    vm.runInNewContext(read('proof-of-play.js'), {
        window: windowObj,
        document: document,
        URL: URL,
        localStorage: windowObj.localStorage,
        history: windowObj.history,
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout
    });

    return { window: windowObj, document: document, opened: opened };
}

test('SW is v2624 and proof-of-play.js is pinned at 20261119_v2624', () => {
    assert.ok(read('sw.js').includes("const CACHE_NAME = 'btc-archive-v2624'"));
    assert.ok(read('app.js').includes('proof-of-play.js?v=20261119_v2624'));
    const html = read('index.html');
    assert.ok(html.includes('proof-of-play.js?v=20261119_v2624'));
    assert.strictEqual((html.match(/proof-of-play\.js\?v=20261119_v2624/g) || []).length, 2);
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
        (function walk(n) {
            if (n.tagName === 'IMG') imgs.push(n);
            (n.childNodes || []).forEach(walk);
        })(card);
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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
