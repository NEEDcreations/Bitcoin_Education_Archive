// Newsletter CTA: shown-once, referral variant, and link tags.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

function boot(opts) {
    opts = opts || {};
    const store = Object.assign({}, opts.storage || {});
    const created = [];
    const bodyChildren = [];
    const fakeLocal = {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; }
    };
    const sandbox = {
        console: console,
        setTimeout: function (fn) { return 0; },
        clearTimeout: function () {},
        URLSearchParams: URLSearchParams,
        localStorage: fakeLocal,
        location: { href: opts.href || 'https://quest.test/', search: opts.search || '', hash: opts.hash || '' },
        document: {
            readyState: 'complete',
            body: {
                appendChild: function (el) { bodyChildren.push(el); return el; }
            },
            head: { appendChild: function (el) { return el; } },
            documentElement: { appendChild: function (el) { return el; } },
            getElementById: function (id) {
                if (id === 'bqNewsletterCtaStyle') return sandbox._style || null;
                if (id === 'bqNewsletterCta') return sandbox._card || null;
                if (opts.elements && opts.elements[id]) return opts.elements[id];
                return null;
            },
            createElement: function (tag) {
                const el = {
                    tagName: String(tag).toUpperCase(),
                    id: '',
                    textContent: '',
                    href: '',
                    target: '',
                    rel: '',
                    type: '',
                    style: {},
                    children: [],
                    listeners: {},
                    setAttribute: function (k, v) { this['attr_' + k] = v; },
                    addEventListener: function (type, fn) { this.listeners[type] = this.listeners[type] || []; this.listeners[type].push(fn); },
                    appendChild: function (c) { this.children.push(c); return c; }
                };
                created.push(el);
                return el;
            }
        },
        _pvpActive: !!opts.pvpActive
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.module = { exports: {} };
    vm.createContext(sandbox);
    vm.runInContext(read('newsletter-cta.js'), sandbox, { filename: 'newsletter-cta.js' });
    const api = sandbox.btcNewsletterCta;
    // Track style/card for getElementById after show
    const origShow = api.showPrompt;
    return {
        api: api,
        sandbox: sandbox,
        store: store,
        created: created,
        bodyChildren: bodyChildren
    };
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }
}

test('link tags for menu, post-quest, and site', function () {
    const env = boot();
    assert.strictEqual(env.api.subscribeUrl('menu'), 'https://603btc.substack.com/subscribe?utm_source=bq-app&utm_medium=menu');
    assert.strictEqual(env.api.subscribeUrl('post-quest'), 'https://603btc.substack.com/subscribe?utm_source=bq-app&utm_medium=post-quest');
    assert.strictEqual(env.api.subscribeUrl('site'), 'https://603btc.substack.com/subscribe?utm_source=bq-app&utm_medium=site');
    assert.strictEqual(env.api.menuHref(), 'https://603btc.substack.com/subscribe?utm_source=bq-app&utm_medium=menu');
    assert.strictEqual(env.api.siteHref(), 'https://603btc.substack.com/subscribe?utm_source=bq-app&utm_medium=site');
});

test('shown-once: flag blocks a second prompt', function () {
    const env = boot();
    env.api._setPending(true);
    assert.strictEqual(env.api.shouldShow({ checkBusy: false, pendingFirstQuest: true }), true);
    env.api.markSeen();
    assert.strictEqual(env.api.hasSeen(), true);
    assert.strictEqual(env.api.shouldShow({ checkBusy: false, pendingFirstQuest: true }), false);
});

test('shown-once: showing the card stores the localStorage flag', function () {
    const env = boot();
    env.api._setPending(true);
    assert.ok(env.api.showPrompt());
    assert.strictEqual(env.store.btc_newsletter_cta_seen, '1');
    assert.strictEqual(env.api.hasSeen(), true);
    assert.strictEqual(env.api._pending(), false);
    const second = boot({ storage: env.store });
    second.api._setPending(true);
    assert.strictEqual(second.api.shouldShow({ checkBusy: false }), false);
    assert.strictEqual(second.api.showPrompt(), false);
});

test('does not show unless this was the first finished quest', function () {
    const env = boot();
    assert.strictEqual(env.api.shouldShow({ checkBusy: false }), false);
    assert.strictEqual(env.api.showPrompt(), false);
    env.api.noteFirstQuestFinished();
    assert.strictEqual(env.api._pending(), true);
    assert.strictEqual(env.api.shouldShow({ checkBusy: false }), true);
});

test('already-seen players do not get the first-quest flag', function () {
    const env = boot({ storage: { btc_newsletter_cta_seen: '1' } });
    env.api.noteFirstQuestFinished();
    assert.strictEqual(env.api._pending(), false);
});

test('referral variant uses ref-dispatch tag and friend copy', function () {
    const env = boot({ storage: { btc_referral_code: 'abc123xy' } });
    assert.strictEqual(env.api.arrivedWithRef(), true);
    assert.strictEqual(env.api.promptMedium(), 'ref-dispatch');
    assert.strictEqual(env.api.promptCopy(), "Get the weekly 603BTC Newsletter so you don't fall behind your friend.");
    env.api._setPending(true);
    assert.ok(env.api.showPrompt());
    const link = env.created.filter(function (el) { return el.id === 'bqNewsletterCtaLink'; })[0];
    const title = env.created.filter(function (el) { return el.id === 'bqNewsletterCtaTitle'; })[0];
    assert.ok(link, 'missing link');
    assert.strictEqual(link.href, 'https://603btc.substack.com/subscribe?utm_source=bq-app&utm_medium=ref-dispatch');
    assert.strictEqual(link.target, '_blank');
    assert.strictEqual(link.rel, 'noopener noreferrer');
    assert.strictEqual(title.textContent, "Get the weekly 603BTC Newsletter so you don't fall behind your friend.");
    assert.strictEqual(link.textContent, 'Get the weekly 603BTC Newsletter');
});

test('ref query param also selects the referral variant', function () {
    const env = boot({ search: '?ref=friend01' });
    assert.strictEqual(env.api.arrivedWithRef(), true);
    assert.strictEqual(env.api.promptMedium(), 'ref-dispatch');
});

test('default post-quest copy and tag when not referred', function () {
    const env = boot();
    assert.strictEqual(env.api.arrivedWithRef(), false);
    assert.strictEqual(env.api.promptMedium(), 'post-quest');
    assert.strictEqual(env.api.promptCopy(), 'Get the weekly 603BTC Newsletter');
    env.api._setPending(true);
    assert.ok(env.api.showPrompt());
    const link = env.created.filter(function (el) { return el.id === 'bqNewsletterCtaLink'; })[0];
    assert.strictEqual(link.href, 'https://603btc.substack.com/subscribe?utm_source=bq-app&utm_medium=post-quest');
    assert.strictEqual(link.rel, 'noopener noreferrer');
});

test('does not show during PvP or when another modal is open', function () {
    const pvp = boot({ pvpActive: true });
    pvp.api._setPending(true);
    assert.strictEqual(pvp.api.isBusy(), true);
    assert.strictEqual(pvp.api.shouldShow({ checkBusy: true }), false);
    assert.strictEqual(pvp.api.showPrompt(), false);
    assert.strictEqual(pvp.api.hasSeen(), false);
    assert.strictEqual(pvp.api._pending(), true);

    const questOpen = {
        classList: { contains: function (c) { return c === 'open'; } }
    };
    const modal = boot({ elements: { questModal: questOpen } });
    modal.api._setPending(true);
    assert.strictEqual(modal.api.isBusy(), true);
    assert.strictEqual(modal.api.showPrompt(), false);
    assert.strictEqual(modal.api.hasSeen(), false);
});

test('close button is 44px and dismiss marks the flag', function () {
    const env = boot();
    env.api._setPending(true);
    assert.ok(env.api.showPrompt());
    const close = env.created.filter(function (el) { return el.id === 'bqNewsletterCtaClose'; })[0];
    const style = env.created.filter(function (el) { return el.id === 'bqNewsletterCtaStyle'; })[0];
    assert.ok(close);
    assert.ok(style);
    assert.ok(style.textContent.indexOf('width:44px') !== -1);
    assert.ok(style.textContent.indexOf('min-height:44px') !== -1);
    assert.ok(style.textContent.indexOf('max-width:351px') !== -1);
    close.listeners.click[0]({ preventDefault: function () {} });
    assert.strictEqual(env.api.hasSeen(), true);
});

test('card is built with textContent, not innerHTML from data', function () {
    const src = read('newsletter-cta.js');
    assert.ok(src.indexOf('innerHTML') === -1, 'newsletter-cta.js must not use innerHTML');
    const env = boot({ storage: { btc_referral_code: '<img src=x onerror=alert(1)>' } });
    env.api._setPending(true);
    assert.ok(env.api.showPrompt());
    const title = env.created.filter(function (el) { return el.id === 'bqNewsletterCtaTitle'; })[0];
    assert.strictEqual(typeof title.textContent, 'string');
    assert.ok(!Object.prototype.hasOwnProperty.call(title, 'innerHTML') || !title.innerHTML);
});

test('wired into quest close, settings, footer, sidebar, and SW v2629', function () {
    const quests = read('quests.js');
    assert.ok(quests.indexOf('noteFirstQuestFinished') !== -1);
    assert.ok(quests.indexOf('tryShowAfterQuest') !== -1);
    const ranking = read('ranking.js');
    assert.ok(ranking.indexOf('settingsNewsletterCta') !== -1);
    assert.ok(ranking.indexOf('Get the weekly 603BTC Newsletter') !== -1);
    assert.ok(ranking.indexOf('utm_medium=menu') !== -1);
    const html = read('index.html');
    assert.ok(html.indexOf('newsletter-cta.js?v=20261119_v2629') !== -1);
    assert.ok(html.indexOf('id="siteNewsletterCta"') !== -1);
    assert.ok(html.indexOf('utm_medium=site') !== -1);
    assert.ok(html.indexOf('id="sidebarNewsletterCta"') !== -1);
    assert.ok(html.indexOf('ranking.js?v=20261119_v2629') !== -1);
    assert.ok(html.indexOf("quests.js?v=20261119_v2629") !== -1);
    const sw = read('sw.js');
    assert.ok(sw.indexOf("btc-archive-v2629") !== -1);
    assert.strictEqual(read('index.html'), read('404.html'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
