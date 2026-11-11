#!/usr/bin/env node
// Mini-app unfurls: static card images, bot metadata, human SPA, no ref leakage.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        const result = fn();
        if (result && typeof result.then === 'function') {
            return result.then(function () { console.log('✅ ' + name); passed++; }, function (e) {
                console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
                failed++;
            });
        }
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
    }
    return Promise.resolve();
}

const manifest = JSON.parse(read('og/miniapps/manifest.json'));
const api = require('../miniapp-share.js');
const share = require('../achievement-share.js');

function pngSize(file) {
    const buf = fs.readFileSync(file);
    assert.strictEqual(buf.slice(0, 8).toString('hex'), '89504e470d0a1a0a', file);
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

test('manifest, worker list, and share apps stay the same set', () => {
    const ids = manifest.cards.map(function (card) { return card.id; });
    assert.deepStrictEqual(ids, api.APPS.map(function (app) { return app.id; }));
    assert.strictEqual(manifest.version, '20261107a');
    assert.strictEqual(manifest.width, 1200);
    assert.strictEqual(manifest.height, 630);
    const worker = read('workers/seo-router/worker.js');
    const list = worker.match(/const MINIAPP_CARD_ID_LIST = '([^']+)'/);
    assert.ok(list, 'card id list');
    assert.deepStrictEqual(list[1].split(' '), ids);
    const cardsJs = read('workers/seo-router/miniapp-cards.js');
    ids.forEach(function (id) {
        assert.ok(cardsJs.includes('"' + id + '"'), id);
    });
    assert.ok(cardsJs.includes('"version": "20261107a"') || cardsJs.includes('MINIAPP_CARD_VERSION = "20261107a"'));
    manifest.cards.forEach(function (card) {
        const app = api.APPS.find(function (item) { return item.id === card.id; });
        assert.strictEqual(card.name, app.name, card.id);
        if (card.dynamic) {
            assert.notStrictEqual(card.sentence, app.sentence, card.id);
            assert.strictEqual(card.sentence.includes('channel 10'), false, card.id);
            assert.strictEqual(card.sentence.includes('Health, Fitness'), false, card.id);
            assert.strictEqual(card.sentence.includes('Orange Pill'), false, card.id);
            assert.strictEqual(card.sentence.includes('Pleb Band'), false, card.id);
            assert.strictEqual(card.sentence.includes('track123'), false, card.id);
        } else {
            assert.strictEqual(card.sentence, app.sentence, card.id);
            assert.strictEqual(card.hash, app.hash, card.id);
        }
        const file = path.join(root, 'og', 'miniapps', card.id + '.' + manifest.version + '.png');
        const size = pngSize(file);
        assert.strictEqual(size.w, 1200, card.id);
        assert.strictEqual(size.h, 630, card.id);
        assert.ok(worker.includes("'/og/miniapps/'"), card.id);
        assert.ok(worker.includes('MINIAPP_CARD_VERSION'), card.id);
    });
    assert.strictEqual(manifest.cards.find(function (c) { return c.id === 'tctv'; }).hash, 'timechain-tv');
    assert.strictEqual(manifest.cards.find(function (c) { return c.id === 'beats'; }).hash, 'bitcoin-beats');
    const bip = pngSize(path.join(root, 'og', 'achievements', 'bip_breakthrough.png'));
    assert.strictEqual(bip.w, 1200);
    assert.strictEqual(bip.h, 630);
    assert.ok(share.SHARE_TYPES.includes('bip_breakthrough'));
    assert.ok(worker.includes('bip_breakthrough:'));
});

const UAS = {
    x: 'Twitterbot/1.0',
    telegram: 'TelegramBot (like TwitterBot)',
    imessage: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0',
    applebot: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1)',
    browser: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    slack: 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'
};

class FakeRewriter {
    on() { return this; }
    transform(response) { return response; }
}

function installFakes() {
    globalThis.HTMLRewriter = FakeRewriter;
    const calls = [];
    globalThis.fetch = function (input) {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        calls.push(url);
        if (String(url).indexOf('channel_index.js') !== -1) {
            return Promise.resolve(new Response('var CHANNELS = {"mining":{"title":"Mining","desc":"How mining works","cat":"Basics"}};', {
                status: 200,
                headers: { 'content-type': 'application/javascript' }
            }));
        }
        return Promise.resolve(new Response('SPA_PASSTHROUGH', {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' }
        }));
    };
    return calls;
}

let workerFetch = null;

function loadWorker() {
    installFakes();
    return import(pathToFileURL(path.join(root, 'workers', 'seo-router', 'worker.js')).href).then(function (mod) {
        workerFetch = mod.default.fetch;
    });
}

function hit(method, url, ua) {
    return workerFetch(new Request(url, { method: method, headers: { 'user-agent': ua || UAS.browser } }));
}

function meta(html, attr, key) {
    const re = new RegExp('<meta ' + attr + '="' + key + '" content="([^"]*)"', 'i');
    const m = re.exec(html);
    // The worker HTML-escapes attribute values (& < > " ' `); decode before comparing.
    return m ? decodeAttr(m[1]) : '';
}
function decodeAttr(v) {
    // Only the two entities the shared escaper added (' and `); &amp; etc. are compared as before.
    return v.replace(/&#39;/g, "'").replace(/&#96;/g, '`');
}

loadWorker().then(function () {
    return test('X, Telegram, and iMessage get the chat card; browsers do not', async function () {
        const calls = installFakes();
        const url = 'https://bitcoineducation.quest/?ref=abc12345&src=lobby&card=chat';
        for (const name of ['x', 'telegram', 'imessage', 'applebot']) {
            calls.length = 0;
            const res = await hit('GET', url, UAS[name]);
            const html = await res.text();
            assert.strictEqual(res.status, 200, name);
            assert.strictEqual(calls.length, 0, name + ' must not fetch');
            assert.strictEqual(res.headers.get('cache-control'), 'private, no-store', name);
            assert.strictEqual(res.headers.get('cdn-cache-control'), 'no-store', name);
            assert.ok((res.headers.get('vary') || '').indexOf('User-Agent') !== -1, name);
            const csp = res.headers.get('content-security-policy') || '';
            assert.ok(csp.includes("default-src 'self'"), name);
            assert.ok(csp.includes("script-src 'self' 'unsafe-inline'"), name);
            assert.strictEqual(csp.includes('nonce-'), false, name);
            assert.strictEqual(meta(html, 'property', 'og:title'), 'Global Chat — Bitcoin Quest', name);
            assert.strictEqual(meta(html, 'property', 'og:description'), "I'm hanging out in Global Chat on Bitcoin Quest! Check it out!", name);
            assert.strictEqual(meta(html, 'property', 'og:image'), 'https://bitcoineducation.quest/og/miniapps/chat.20261107a.png', name);
            assert.strictEqual(meta(html, 'property', 'og:image:width'), '1200', name);
            assert.strictEqual(meta(html, 'property', 'og:image:height'), '630', name);
            assert.strictEqual(meta(html, 'property', 'og:image:alt'), "I'm hanging out in Global Chat on Bitcoin Quest! Check it out!", name);
            assert.strictEqual(meta(html, 'name', 'twitter:card'), 'summary_large_image', name);
            assert.strictEqual(meta(html, 'name', 'twitter:title'), 'Global Chat — Bitcoin Quest', name);
            assert.strictEqual(meta(html, 'name', 'twitter:description'), "I'm hanging out in Global Chat on Bitcoin Quest! Check it out!", name);
            assert.strictEqual(meta(html, 'name', 'twitter:image'), 'https://bitcoineducation.quest/og/miniapps/chat.20261107a.png', name);
            assert.strictEqual(meta(html, 'property', 'og:url'), 'https://bitcoineducation.quest/?ref=abc12345&amp;src=lobby&amp;card=chat#chat', name);
            assert.ok(html.includes('rel="canonical" href="https://bitcoineducation.quest/?ref=abc12345&amp;src=lobby&amp;card=chat#chat"'), name);
            assert.ok(html.includes('content="0;url=https://bitcoineducation.quest/?ref=abc12345&amp;src=lobby&amp;card=chat#chat"'), name);
            assert.ok(html.includes('content="noindex, follow"'), name);
            assert.strictEqual(html.includes('<script'), false, name);
            assert.strictEqual(html.includes('abc12345<script'), false, name);
        }
        for (const name of ['browser', 'chrome', 'slack']) {
            calls.length = 0;
            const res = await hit('GET', url, UAS[name]);
            const html = await res.text();
            assert.strictEqual(html, 'SPA_PASSTHROUGH', name);
            assert.ok(calls.length >= 1, name);
            assert.ok(calls[0].indexOf('https://bitcoin-quest.pages.dev/?ref=abc12345&src=lobby&card=chat') === 0, calls[0]);
            assert.strictEqual(html.includes('/og/miniapps/'), false, name);
        }
    });
}).then(function () {
    return test('HEAD matches GET headers and does not require a body', async function () {
        installFakes();
        const head = await hit('HEAD', 'https://bitcoineducation.quest/?card=chat', UAS.x);
        const body = await head.text();
        assert.strictEqual(head.status, 200);
        assert.strictEqual(body, '');
        assert.ok((head.headers.get('content-type') || '').includes('text/html'));
        assert.strictEqual(head.headers.get('cache-control'), 'private, no-store');
        const get = await hit('GET', 'https://bitcoineducation.quest/index.html?card=nacho', UAS.telegram);
        const html = await get.text();
        assert.strictEqual(meta(html, 'property', 'og:image'), 'https://bitcoineducation.quest/og/miniapps/nacho.20261107a.png');
        assert.strictEqual(meta(html, 'property', 'og:url'), 'https://bitcoineducation.quest/?card=nacho#nacho');
    });
}).then(function () {
    return test('every card type unfurls, and tctv/beats stay generic', async function () {
        installFakes();
        for (const card of manifest.cards) {
            const res = await hit('GET', 'https://bitcoineducation.quest/?card=' + card.id, UAS.x);
            const html = await res.text();
            assert.strictEqual(meta(html, 'property', 'og:title'), card.title, card.id);
            assert.strictEqual(meta(html, 'property', 'og:description'), card.description, card.id);
            assert.strictEqual(meta(html, 'property', 'og:image'), 'https://bitcoineducation.quest/og/miniapps/' + card.id + '.20261107a.png', card.id);
            assert.strictEqual(meta(html, 'property', 'og:image:alt'), card.sentence, card.id);
            assert.ok(meta(html, 'property', 'og:url').endsWith('card=' + card.id + '#' + card.hash), card.id);
            const file = path.join(root, 'og', 'miniapps', card.id + '.20261107a.png');
            assert.ok(fs.existsSync(file), card.id);
        }
        const tctv = await (await hit('GET', 'https://bitcoineducation.quest/?card=tctv', UAS.imessage)).text();
        assert.strictEqual(tctv.includes('channel 10'), false);
        assert.strictEqual(tctv.includes('health-fitness'), false);
        assert.ok(meta(tctv, 'property', 'og:url').endsWith('card=tctv#timechain-tv'));
        const beats = await (await hit('GET', 'https://bitcoineducation.quest/?card=beats', UAS.x)).text();
        assert.strictEqual(beats.includes('Orange Pill'), false);
        assert.strictEqual(beats.includes('track123'), false);
        assert.ok(meta(beats, 'property', 'og:url').endsWith('card=beats#bitcoin-beats'));
    });
}).then(function () {
    return test('bad card values fall through and are not reflected', async function () {
        const calls = installFakes();
        const samples = [
            '?card=',
            '?card=CHAT',
            '?card=nope',
            '?card=chat<script>alert(1)</script>',
            '?card=' + 'a'.repeat(4000),
            '?card=../og-image.png',
            '?card=chat%00.png',
            '?card=%3Cimg%20src=x%20onerror=alert(1)%3E',
            '?card=constructor',
            '?card=__proto__'
        ];
        for (const search of samples) {
            calls.length = 0;
            const res = await hit('GET', 'https://bitcoineducation.quest/' + search, UAS.x);
            const html = await res.text();
            assert.strictEqual(html, 'SPA_PASSTHROUGH', search.slice(0, 40));
            assert.strictEqual(html.includes('alert(1)'), false, search.slice(0, 40));
            assert.strictEqual(html.includes('/og/miniapps/'), false, search.slice(0, 40));
            assert.ok(calls.length >= 1, search.slice(0, 24));
        }
        const mixed = await (await hit('GET', 'https://bitcoineducation.quest/?card=chat&title=%3Cscript%3Ealert(1)%3C/script%3E', UAS.x)).text();
        assert.strictEqual(mixed.includes('alert(1)'), false);
        assert.strictEqual(mixed.includes('<script'), false);
        assert.ok(mixed.includes('/og/miniapps/chat.20261107a.png'));
    });
}).then(function () {
    return test('achievement a= wins over card, including bip_breakthrough', async function () {
        installFakes();
        const both = await (await hit('GET', 'https://bitcoineducation.quest/?a=badge&card=chat&ref=abc12345', UAS.x)).text();
        assert.ok(both.includes('/og/achievements/badge.png'));
        assert.strictEqual(both.includes('/og/miniapps/'), false);
        assert.ok(both.includes('og:url" content="https://bitcoineducation.quest/?a=badge&ref=abc12345"') || both.includes('og:url" content="https://bitcoineducation.quest/?a=badge&amp;ref=abc12345"'));
        assert.ok(both.includes('content="0;url=https://bitcoineducation.quest/?a=badge"'));
        const unknownA = await (await hit('GET', 'https://bitcoineducation.quest/?a=nope&card=chat', UAS.telegram)).text();
        assert.ok(unknownA.includes('/og/miniapps/chat.20261107a.png'));
        assert.strictEqual(unknownA.includes('nope'), false);
        const bip = await (await hit('GET', 'https://bitcoineducation.quest/?a=bip_breakthrough', UAS.imessage)).text();
        assert.ok(bip.includes('/og/achievements/bip_breakthrough.png'));
        assert.strictEqual(meta(bip, 'property', 'og:title'), 'BIP Breakthrough');
        assert.strictEqual(meta(bip, 'property', 'og:image:width'), '1200');
        assert.strictEqual(meta(bip, 'property', 'og:image:height'), '630');
        const achHead = await hit('HEAD', 'https://bitcoineducation.quest/?a=streak', UAS.x);
        assert.strictEqual(achHead.status, 200);
        assert.strictEqual(await achHead.text(), '');
        assert.ok((achHead.headers.get('cache-control') || '').includes('public'));
        assert.ok((achHead.headers.get('vary') || '').includes('User-Agent'));
    });
}).then(function () {
    return test('refs stay isolated, and redirects keep ref, src, and card', async function () {
        installFakes();
        const one = await (await hit('GET', 'https://bitcoineducation.quest/?ref=abc12345&card=forum', UAS.x)).text();
        const two = await (await hit('GET', 'https://bitcoineducation.quest/?ref=zzzzzz99&card=forum', UAS.x)).text();
        assert.ok(one.includes('ref=abc12345'));
        assert.strictEqual(one.includes('zzzzzz99'), false);
        assert.ok(two.includes('ref=zzzzzz99'));
        assert.strictEqual(two.includes('abc12345'), false);
        const guest = await (await hit('GET', 'https://bitcoineducation.quest/?card=forum', UAS.x)).text();
        assert.strictEqual(guest.includes('?ref='), false);
        assert.strictEqual(guest.includes('&ref='), false);
        assert.strictEqual(guest.includes('&amp;ref='), false);
        const http = await hit('GET', 'http://bitcoineducation.quest/?ref=abc12345&src=lobby&card=chat', UAS.browser);
        assert.strictEqual(http.status, 301);
        assert.strictEqual(http.headers.get('location'), 'https://bitcoineducation.quest/?ref=abc12345&src=lobby&card=chat');
        const alias = await hit('GET', 'https://btcedu.app/chat?ref=abc12345&src=lobby&card=chat', UAS.browser);
        assert.strictEqual(alias.status, 302);
        assert.strictEqual(alias.headers.get('location'), 'https://bitcoineducation.quest/?ref=abc12345&src=lobby&card=chat#chat');
        const app = await hit('GET', 'https://bitcoineducation.quest/app/forum?ref=abc12345', UAS.x);
        const appHtml = await app.text();
        assert.ok(appHtml.includes('PlebTalk Forum'));
        assert.ok(appHtml.includes('/og-image.png?v=20261024b'));
        assert.strictEqual(appHtml.includes('/og/miniapps/'), false);
        const channel = await hit('GET', 'https://bitcoineducation.quest/channels/mining?ref=abc12345&src=news', UAS.browser);
        assert.strictEqual(channel.status, 302);
        assert.strictEqual(channel.headers.get('location'), 'https://bitcoineducation.quest/?ref=abc12345&src=news#mining');
        const badSrc = await hit('GET', 'https://bitcoineducation.quest/pvp?ref=abc12345&src=../x&card=not-a-card', UAS.browser);
        assert.strictEqual(badSrc.status, 302);
        assert.strictEqual(badSrc.headers.get('location'), 'https://bitcoineducation.quest/?ref=abc12345#pvp');
    });
}).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
}).catch(function (e) {
    console.log('❌ worker load: ' + (e && e.stack ? e.stack : e));
    process.exit(1);
});
