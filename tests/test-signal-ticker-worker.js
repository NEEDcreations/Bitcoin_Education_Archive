// Signal ticker Worker: KV serve, 24h stale origin fallback, refresh auth.
const assert = require('assert');

// Fixed clock so the 2026-11-14 fixtures stay fresh no matter when this runs,
// and no live network: any real fetch fails the test.
const RealDate = Date;
const FIXED_NOW = RealDate.parse('2026-11-14T22:30:00.000Z');
class FixedDate extends RealDate {
    constructor(...args) {
        if (args.length === 0) super(FIXED_NOW);
        else super(...args);
    }
    static now() { return FIXED_NOW; }
}
global.Date = FixedDate;
global.fetch = function() { return Promise.reject(new Error('live fetch is not allowed in this test')); };

const handlers = require('../workers/signal-ticker/handlers.js');
const ticker = require('../workers/signal-ticker/ticker-core.js');

let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) {
    try {
        const out = fn();
        if (out && typeof out.then === 'function') {
            queue.push(out.then(function() {
                console.log('✅ ' + name);
                passed++;
            }, function(e) {
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

function mockKV(initial) {
    const map = Object.assign({}, initial || {});
    return {
        _map: map,
        get: async function(key) {
            return map[key] ? map[key].value : null;
        },
        getWithMetadata: async function(key) {
            const row = map[key];
            return row ? { value: row.value, metadata: row.metadata || null } : { value: null, metadata: null };
        },
        put: async function(key, value, opts) {
            map[key] = { value: value, metadata: (opts && opts.metadata) || null };
        }
    };
}

const FRESH = {
    updated: '2026-11-14T22:00:00.000Z',
    news: [{
        date: 'Nov 14, 2026',
        title: 'Bitcoin ETFs lose $1 billion in a week',
        snippet: 'The Block',
        link: 'https://example.com/etf',
        source: 'the-block'
    }]
};
const ORIGIN = {
    updated: '2026-11-01T00:00:00.000Z',
    news: [{
        date: 'Nov 1, 2026',
        title: 'Origin static Bitcoin headline',
        snippet: 'CoinDesk',
        link: 'https://example.com/origin',
        source: 'coindesk'
    }]
};
const NOW = new Date('2026-11-14T22:30:00.000Z');

function originFetcher() {
    return Promise.resolve(JSON.stringify(ORIGIN));
}

test('GET newsletter-data.json serves a fresh KV payload with cache headers', async function() {
    const env = {
        TICKER: mockKV({
            'newsletter-data.json': { value: JSON.stringify(FRESH), metadata: { generatedAt: FRESH.updated } }
        }),
        ORIGIN_URL: 'https://example.com/newsletter-data.json',
        __fetcher: function() { throw new Error('origin should not be called'); }
    };
    const res = await handlers.handleFetch(new Request('https://ticker.test/newsletter-data.json'), env);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('x-ticker-source'), 'kv');
    assert.ok((res.headers.get('cache-control') || '').indexOf('max-age=300') !== -1);
    assert.strictEqual(res.headers.get('content-type').indexOf('application/json') !== -1, true);
    const body = await res.json();
    assert.strictEqual(body.updated, FRESH.updated);
    assert.strictEqual(body.news[0].title, FRESH.news[0].title);
    assert.deepStrictEqual(Object.keys(body.news[0]).sort(), ['date', 'link', 'snippet', 'source', 'title']);
});

test('GET / also serves the ticker JSON', async function() {
    const env = {
        TICKER: mockKV({
            'newsletter-data.json': { value: JSON.stringify(FRESH), metadata: { generatedAt: FRESH.updated } }
        }),
        __fetcher: function() { throw new Error('origin should not be called'); }
    };
    const res = await handlers.handleFetch(new Request('https://ticker.test/'), env);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.news.length, 1);
});

test('empty KV falls back to the static origin file', async function() {
    const env = {
        TICKER: mockKV(),
        ORIGIN_URL: 'https://example.com/newsletter-data.json',
        __fetcher: originFetcher
    };
    const res = await handlers.serveTicker(env, { now: NOW, fetcher: originFetcher });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('x-ticker-source'), 'origin-fallback');
    const body = await res.json();
    assert.strictEqual(body.news[0].title, 'Origin static Bitcoin headline');
});

test('KV older than 24 hours falls back to the static origin file', async function() {
    const stale = {
        updated: '2026-11-13T21:00:00.000Z', // 25.5 hours before NOW
        news: [{ date: 'Nov 13, 2026', title: 'Stale Bitcoin headline', snippet: 'Casa', link: 'https://example.com/stale', source: 'casa' }]
    };
    const env = {
        TICKER: mockKV({
            'newsletter-data.json': { value: JSON.stringify(stale), metadata: { generatedAt: stale.updated } }
        }),
        ORIGIN_URL: 'https://example.com/newsletter-data.json'
    };
    const res = await handlers.serveTicker(env, { now: NOW, fetcher: originFetcher });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('x-ticker-source'), 'origin-fallback');
    const body = await res.json();
    assert.strictEqual(body.news[0].source, 'coindesk');
});

test('stale KV is still served if the origin fallback fails', async function() {
    const stale = {
        updated: '2026-11-13T21:00:00.000Z',
        news: [{ date: 'Nov 13, 2026', title: 'Stale Bitcoin headline', snippet: 'Casa', link: 'https://example.com/stale', source: 'casa' }]
    };
    const env = {
        TICKER: mockKV({
            'newsletter-data.json': { value: JSON.stringify(stale), metadata: { generatedAt: stale.updated } }
        })
    };
    const res = await handlers.serveTicker(env, {
        now: NOW,
        fetcher: function() { return Promise.reject(new Error('origin down')); }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('x-ticker-source'), 'kv-stale');
    const body = await res.json();
    assert.strictEqual(body.news[0].source, 'casa');
});

test('refresh writes the same JSON shape the homepage already uses', async function() {
    const xml = '<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>' +
        '<item><title>Bitcoin testers ship a new release</title>' +
        '<link>https://example.com/core</link>' +
        '<pubDate>Fri, 14 Nov 2026 18:00:00 +0000</pubDate></item></channel></rss>';
    const env = { TICKER: mockKV() };
    const result = await handlers.refreshTicker(env, {
        now: NOW,
        fetcher: function(url) {
            if (url.indexOf('bitcoincore.org') !== -1) return Promise.resolve(xml);
            return Promise.reject(new Error('HTTP 404'));
        }
    });
    assert.strictEqual(result.updated, true);
    assert.strictEqual(result.news.length, 1);
    assert.deepStrictEqual(Object.keys(result.news[0]).sort(), ['date', 'link', 'snippet', 'source', 'title']);
    assert.strictEqual(result.news[0].source, 'bitcoin-core');
    const stored = JSON.parse(await env.TICKER.get('newsletter-data.json'));
    assert.strictEqual(stored.updated, NOW.toISOString());
    assert.strictEqual(stored.news[0].title, 'Bitcoin testers ship a new release');
});

test('refresh with no qualifying headlines leaves existing KV alone', async function() {
    const env = {
        TICKER: mockKV({
            'newsletter-data.json': { value: JSON.stringify(FRESH), metadata: { generatedAt: FRESH.updated } }
        })
    };
    const result = await handlers.refreshTicker(env, {
        now: NOW,
        fetcher: function() { return Promise.resolve('<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>'); }
    });
    assert.strictEqual(result.updated, false);
    const stored = JSON.parse(await env.TICKER.get('newsletter-data.json'));
    assert.strictEqual(stored.news[0].title, FRESH.news[0].title);
});

test('POST /__refresh is rejected without the cron secret', async function() {
    const env = { TICKER: mockKV(), CRON_SECRET: 's3cret' };
    const res = await handlers.handleFetch(new Request('https://ticker.test/__refresh', { method: 'POST' }), env);
    assert.strictEqual(res.status, 401);
});

test('POST /__refresh with the cron secret writes KV', async function() {
    const xml = '<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>' +
        '<item><title>Bitcoin testers ship a new release</title>' +
        '<link>https://example.com/core</link>' +
        '<pubDate>Fri, 14 Nov 2026 18:00:00 +0000</pubDate></item></channel></rss>';
    const env = {
        TICKER: mockKV(),
        CRON_SECRET: 's3cret',
        __fetcher: function(url) {
            if (url.indexOf('bitcoincore.org') !== -1) return Promise.resolve(xml);
            return Promise.reject(new Error('HTTP 404'));
        }
    };
    const res = await handlers.handleFetch(new Request('https://ticker.test/__refresh', {
        method: 'POST',
        headers: { 'x-cron-secret': 's3cret' }
    }), env);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.updated, true);
    assert.ok(await env.TICKER.get('newsletter-data.json'));
});

test('scheduled handler refreshes KV using the shared filters', async function() {
    const xml = '<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>' +
        '<item><title>Ethereum testers ship a new release</title>' +
        '<link>https://example.com/eth</link>' +
        '<pubDate>Fri, 14 Nov 2026 18:00:00 +0000</pubDate></item>' +
        '<item><title>Bitcoin testers ship a new release</title>' +
        '<link>https://example.com/btc</link>' +
        '<pubDate>Fri, 14 Nov 2026 17:00:00 +0000</pubDate></item></channel></rss>';
    const env = {
        TICKER: mockKV(),
        __fetcher: function(url) {
            if (url.indexOf('bitcoinmagazine.com') !== -1) return Promise.resolve(xml);
            return Promise.reject(new Error('HTTP 404'));
        }
    };
    const result = await handlers.handleScheduled({}, env, {});
    assert.strictEqual(result.updated, true);
    assert.strictEqual(result.news[0].source, 'bitcoin-magazine');
    assert.ok(!/ethereum/i.test(result.news[0].title));
});

test('shared core still lists Citadel Wire as a native expand source', function() {
    const src = ticker.SOURCES.find(function(s) { return s.id === 'citadel-wire'; });
    assert.ok(src);
    assert.strictEqual(src.native, true);
    assert.strictEqual(src.expand, 'citadelwire');
    assert.strictEqual(src.url, 'https://citadelwire.com/feed.xml');
});

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
});
