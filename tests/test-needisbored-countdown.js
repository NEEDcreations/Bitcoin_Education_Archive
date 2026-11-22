#!/usr/bin/env node
'use strict';
// /needisbored countdown, share-link timestamp, and OG worker.
// The static page and workers/needisbored-og both turn a timestamp into a
// clock and a 10-minute block estimate. Share links freeze Date.now() in
// ?t=, and the worker reprints that instant into Open Graph tags and og.png.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const pagePath = path.join(root, 'needisbored.html');
const slashPath = path.join(root, 'needisbored', 'index.html');
const pageHtml = fs.readFileSync(pagePath, 'utf8');
const slashHtml = fs.readFileSync(slashPath, 'utf8');

let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) {
    try {
        const out = fn();
        if (out && typeof out.then === 'function') {
            queue.push(out.then(function () {
                console.log('✅ ' + name);
                passed++;
            }, function (e) {
                console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
                failed++;
            }));
            return;
        }
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

function lastScript(html) {
    const start = html.lastIndexOf('<script>');
    const end = html.lastIndexOf('</script>');
    assert.ok(start !== -1 && end > start);
    return html.slice(start + '<script>'.length, end);
}

function pngInfo(bytes) {
    const buf = Buffer.from(bytes);
    assert.strictEqual(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.strictEqual(buf.subarray(12, 16).toString('ascii'), 'IHDR');
    return {
        width: buf.readUInt32BE(16),
        height: buf.readUInt32BE(20),
        depth: buf[24],
        color: buf[25]
    };
}

function pageClock(nowMs) {
    const els = {};
    function node() {
        return {
            textContent: '',
            hidden: false,
            setAttribute() { this.hidden = true; },
            removeAttribute() { this.hidden = false; },
            addEventListener() {}
        };
    }
    ['live', 'done', 'blocks', 'd', 'h', 'm', 's', 'share'].forEach(function (id) {
        els[id] = node();
    });
    const RealDate = Date;
    function FakeDate() {
        const args = [RealDate];
        for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
        return new (RealDate.bind.apply(RealDate, args))();
    }
    FakeDate.now = function () { return nowMs; };
    FakeDate.parse = RealDate.parse;
    FakeDate.UTC = RealDate.UTC;
    vm.runInNewContext(lastScript(pageHtml), {
        document: { getElementById: function (id) { return els[id]; } },
        Date: FakeDate,
        setInterval: function () {},
        setTimeout: function () {},
        navigator: {},
        window: {}
    });
    return els;
}

(async function () {
    const lib = await import('../workers/needisbored-og/src/lib.js');
    const worker = await import('../workers/needisbored-og/src/index.js');
    const TARGET = lib.TARGET;
    const HOUR = 3600000;

    test('page copies and the worker share one reset instant', function () {
        assert.strictEqual(pageHtml, slashHtml);
        assert.strictEqual(TARGET, Date.parse('2026-11-25T19:39:00Z'));
        assert.strictEqual(pageHtml.match(/Date\.parse\('2026-11-25T19:39:00Z'\)/g).length, 1);
        assert.ok(pageHtml.includes("https://bitcoineducation.quest/needisbored?t=' + Date.now()"));
        assert.strictEqual(lib.CANON, 'https://bitcoineducation.quest/needisbored');
    });

    test('parseT reads millisecond share stamps and second stamps, and drops junk', function () {
        const ms = TARGET - HOUR;
        const asMs = lib.parseT(new URLSearchParams('t=' + ms));
        assert.deepStrictEqual(
            { at: asMs.at, hasT: asMs.hasT, token: asMs.token },
            { at: ms, hasT: true, token: String(ms) }
        );

        const seconds = Math.floor(ms / 1000);
        const asSec = lib.parseT(new URLSearchParams('t=' + seconds));
        assert.strictEqual(asSec.hasT, true);
        assert.strictEqual(asSec.at, seconds * 1000);
        assert.strictEqual(asSec.token, String(seconds));

        const before = Date.now();
        ['', 't=', 't=0', 't=-5', 't=nope', 't=NaN', 't=Infinity'].forEach(function (q) {
            const parsed = lib.parseT(new URLSearchParams(q));
            assert.strictEqual(parsed.hasT, false, q);
            assert.strictEqual(parsed.token, '', q);
            assert.ok(parsed.at >= before && parsed.at <= Date.now(), q);
        });
    });

    test('block estimate rounds up a partial 10-minute block and stops at zero', function () {
        function at(sec) { return lib.remaining(TARGET - sec * 1000); }
        assert.deepStrictEqual(
            [at(1).blocks, at(599).blocks, at(600).blocks, at(601).blocks],
            [1, 1, 1, 2]
        );
        const hour = at(3600);
        assert.strictEqual(hour.done, false);
        assert.strictEqual(hour.blocks, 6);
        assert.strictEqual(hour.days, 0);
        assert.strictEqual(hour.hours, 1);
        assert.strictEqual(hour.minutes, 0);
        assert.strictEqual(hour.seconds, 0);

        const span = 2 * 86400 + 3 * 3600 + 4 * 60 + 5;
        const long = at(span);
        assert.deepStrictEqual(
            [long.days, long.hours, long.minutes, long.seconds, long.blocks, long.done],
            [2, 3, 4, 5, Math.ceil(span / 600), false]
        );
        assert.strictEqual(lib.formatTitle(long), '02d 03h 04m 05s · ≈ ' + long.blocks + ' blocks');

        [0, -1, -86400].forEach(function (sec) {
            const r = at(sec);
            assert.strictEqual(r.done, true);
            assert.strictEqual(r.blocks, 0);
            assert.strictEqual(r.ms, 0);
            assert.strictEqual(lib.formatTitle(r), 'Usage reset! 🎉');
        });
    });

    test('the static clock matches the worker for the same instant', function () {
        [1, 600, 601, 3600, 2 * 86400 + 3 * 3600 + 4 * 60 + 5].forEach(function (sec) {
            const now = TARGET - sec * 1000;
            const r = lib.remaining(now);
            const els = pageClock(now);
            const pad = function (n) { return n < 10 ? '0' + n : String(n); };
            assert.strictEqual(els.d.textContent, pad(r.days), String(sec));
            assert.strictEqual(els.h.textContent, pad(r.hours), String(sec));
            assert.strictEqual(els.m.textContent, pad(r.minutes), String(sec));
            assert.strictEqual(els.s.textContent, pad(r.seconds), String(sec));
            assert.strictEqual(els.blocks.textContent, '≈ ' + r.blocks + ' blocks', String(sec));
            assert.strictEqual(els.live.hidden, false);
        });
        const done = pageClock(TARGET);
        assert.strictEqual(done.live.hidden, true);
        assert.strictEqual(done.done.hidden, false);
        assert.strictEqual(lib.remaining(TARGET).done, true);
        assert.strictEqual(lib.remaining(TARGET + HOUR).done, true);
    });

    test('Open Graph injection escapes a hostile t token inside meta content', function () {
        const hostile = '1"><script>alert(1)</script>&x=2';
        const out = lib.injectOg(pageHtml, { at: TARGET - 1000, hasT: true, token: hostile });
        const url = out.match(/<meta\s+property="og:url"\s+content="([^"]*)"/);
        const image = out.match(/<meta\s+property="og:image"\s+content="([^"]*)"/);
        assert.ok(url && image);
        const escaped = '1&quot;>&lt;script>alert(1)&lt;/script>&amp;x=2';
        assert.strictEqual(url[1], lib.CANON + '?t=' + escaped);
        assert.strictEqual(image[1], lib.CANON + '/og.png?t=' + escaped);
        assert.ok(out.includes('<meta property="og:title" content="00d 00h 00m 01s · ≈ 1 blocks"'));
        assert.ok(!out.includes('<script>alert(1)</script>'));

        const live = lib.injectOg(pageHtml, { at: TARGET - HOUR, hasT: false, token: '' });
        const liveUrl = live.match(/<meta\s+property="og:url"\s+content="([^"]*)"/);
        const liveImage = live.match(/<meta\s+property="og:image"\s+content="([^"]*)"/);
        assert.strictEqual(liveUrl[1], lib.CANON);
        assert.strictEqual(liveImage[1], lib.CANON + '/og.png');
        assert.ok(live.includes('00d 01h 00m 00s · ≈ 6 blocks'));
    });

    test('worker serves a frozen share preview and refuses a missing page', async function () {
        const prev = global.fetch;
        const fetched = [];
        global.fetch = async function (url) {
            fetched.push(String(url));
            return new Response(pageHtml, { status: 200, headers: { 'content-type': 'text/html' } });
        };
        try {
            const stamp = String(TARGET - HOUR);
            const res = await worker.default.fetch(new Request('https://bitcoineducation.quest/needisbored?t=' + stamp));
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
            assert.strictEqual(res.headers.get('x-robots-tag'), 'noindex, nofollow');
            assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
            const body = await res.text();
            assert.ok(body.includes('00d 01h 00m 00s · ≈ 6 blocks'));
            assert.ok(body.includes(lib.CANON + '?t=' + stamp));
            assert.ok(body.includes(lib.CANON + '/og.png?t=' + stamp));
            assert.deepStrictEqual(fetched, ['https://bitcoin-quest.pages.dev/needisbored.html']);

            fetched.length = 0;
            const slash = await worker.default.fetch(new Request('https://bitcoineducation.quest/needisbored/'));
            assert.strictEqual(slash.status, 200);
            assert.deepStrictEqual(fetched, ['https://bitcoin-quest.pages.dev/needisbored/index.html']);

            const head = await worker.default.fetch(new Request('https://bitcoineducation.quest/needisbored?t=' + stamp, { method: 'HEAD' }));
            assert.strictEqual(head.status, 200);
            assert.strictEqual(await head.text(), '');

            global.fetch = async function () { return new Response('missing', { status: 404 }); };
            const down = await worker.default.fetch(new Request('https://bitcoineducation.quest/needisbored.html'));
            assert.strictEqual(down.status, 503);

            global.fetch = async function () { throw new Error('pages down'); };
            const thrown = await worker.default.fetch(new Request('https://bitcoineducation.quest/needisbored/index.html'));
            assert.strictEqual(thrown.status, 503);

            const missing = await worker.default.fetch(new Request('https://bitcoineducation.quest/elsewhere'));
            assert.strictEqual(missing.status, 404);
            assert.strictEqual(await missing.text(), 'Not found');
        } finally {
            global.fetch = prev;
        }
    });
    // Finish the page-fetch case before the og.png case replaces global fetch.
    await Promise.all(queue.splice(0, queue.length));

    test('og.png is a 1200x630 PNG, cached forever only for a frozen t', async function () {
        const prev = global.fetch;
        let calls = 0;
        global.fetch = async function () { calls++; throw new Error('og.png must not fetch the page'); };
        try {
            const frozen = await worker.default.fetch(new Request('https://bitcoineducation.quest/needisbored/og.png?t=' + (TARGET - HOUR)));
            assert.strictEqual(frozen.status, 200);
            assert.strictEqual(frozen.headers.get('content-type'), 'image/png');
            assert.strictEqual(frozen.headers.get('cache-control'), 'public, max-age=31536000, immutable');
            const info = pngInfo(new Uint8Array(await frozen.arrayBuffer()));
            assert.deepStrictEqual(info, { width: 1200, height: 630, depth: 8, color: 2 });

            const head = await worker.default.fetch(new Request('https://bitcoineducation.quest/needisbored/og?t=' + (TARGET - 1000), { method: 'HEAD' }));
            assert.strictEqual(head.status, 200);
            assert.strictEqual(head.headers.get('cache-control'), 'public, max-age=31536000, immutable');
            assert.strictEqual(await head.text(), '');

            const live = await worker.default.fetch(new Request('https://bitcoineducation.quest/needisbored/og.png'));
            assert.strictEqual(live.headers.get('cache-control'), 'public, max-age=60, must-revalidate');
            const livePng = new Uint8Array(await live.arrayBuffer());
            assert.strictEqual(livePng[0], 137);
            assert.strictEqual(calls, 0);

            const countdown = await lib.renderOg(TARGET - HOUR);
            const done = await lib.renderOg(TARGET + 1000);
            assert.notStrictEqual(Buffer.from(countdown).toString('hex'), Buffer.from(done).toString('hex'));
            assert.strictEqual(pngInfo(done).width, 1200);
        } finally {
            global.fetch = prev;
        }
    });
    await Promise.all(queue);
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
})().catch(function (e) {
    console.error(e);
    process.exit(1);
});
