#!/usr/bin/env node
'use strict';
// seo-router /premium: served from Pages as a standalone page (never an SPA
// alias), noindex + no-store until PREMIUM_PAGE_PUBLIC, not in the sitemap.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'workers', 'seo-router', 'worker.js'), 'utf8');
let passed = 0;
let failed = 0;
async function test(name, fn) {
    try { await fn(); passed++; console.log('✅ ' + name); }
    catch (e) { failed++; console.log('❌ ' + name + ': ' + e.message); }
}

class FakeRewriter { on() { return this; } transform(r) { return r; } }
const calls = [];
globalThis.HTMLRewriter = FakeRewriter;
globalThis.fetch = function (input) {
    calls.push(typeof input === 'string' ? input : input.url);
    return Promise.resolve(new Response('<html>premium</html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' } }));
};

(async function () {
    const mod = await import(pathToFileURL(path.join(root, 'workers', 'seo-router', 'worker.js')).href);
    const hit = function (u, ua) { return mod.default.fetch(new Request(u, { headers: { 'user-agent': ua || 'Mozilla/5.0 Chrome/120' } })); };
    await test('launch flag is off and /premium is not an SPA alias', function () {
        assert.ok(/const PREMIUM_PAGE_PUBLIC = false;/.test(src));
        const aliases = src.slice(src.indexOf('const cleanAliases = {'), src.indexOf('const aliasPage'));
        assert.strictEqual(aliases.indexOf('premium'), -1);
    });
    for (const p of ['/premium', '/premium/', '/premium.html']) {
        await test(p + ' passes to Pages with noindex + no-store', async function () {
            calls.length = 0;
            const res = await hit('https://bitcoineducation.quest' + p + '?src=yt-1217');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(await res.text(), '<html>premium</html>');
            assert.ok(calls[0].indexOf('https://bitcoin-quest.pages.dev/premium') === 0, calls[0]);
            assert.strictEqual(res.headers.get('x-robots-tag'), 'noindex, nofollow');
            assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
            assert.ok((res.headers.get('content-security-policy') || '').includes('https://challenges.cloudflare.com'));
        });
    }
    await test('bots get the same noindex page (no SPA redirect)', async function () {
        const res = await hit('https://bitcoineducation.quest/premium', 'Twitterbot/1.0');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers.get('x-robots-tag'), 'noindex, nofollow');
    });
    await test('other pages keep their normal headers', async function () {
        const res = await hit('https://bitcoineducation.quest/premium-other');
        assert.strictEqual(res.headers.get('x-robots-tag'), null);
    });
    await test('sitemap has no /premium', function () {
        assert.strictEqual(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8').indexOf('/premium'), -1);
    });
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
