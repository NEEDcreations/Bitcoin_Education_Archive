// Request and cron handlers for the Signal ticker Worker.
// Shared with tests. No wrangler or Cloudflare globals required at load time.

'use strict';

const ticker = require('./ticker-core.js');

const KV_KEY = 'newsletter-data.json';
const STALE_MS = 24 * 60 * 60 * 1000;
const JSON_TYPE = 'application/json; charset=utf-8';
const CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=1800';

function jsonResponse(body, status, extraHeaders) {
    const headers = {
        'content-type': JSON_TYPE,
        'cache-control': CACHE_CONTROL,
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, OPTIONS',
        'x-content-type-options': 'nosniff'
    };
    if (extraHeaders) {
        Object.keys(extraHeaders).forEach(function(k) { headers[k] = extraHeaders[k]; });
    }
    if (typeof body !== 'string') body = JSON.stringify(body);
    return new Response(body, { status: status || 200, headers: headers });
}

function safeEqual(a, b) {
    const enc = new TextEncoder();
    const aa = enc.encode(String(a || ''));
    const bb = enc.encode(String(b || ''));
    if (aa.length !== bb.length) return false;
    let out = 0;
    for (let i = 0; i < aa.length; i++) out |= aa[i] ^ bb[i];
    return out === 0;
}

function isTickerPath(pathname) {
    return pathname === '/'
        || pathname === '/newsletter-data.json'
        || pathname.endsWith('/newsletter-data.json');
}

function isRefreshPath(pathname) {
    return pathname === '/__refresh' || pathname === '/__scheduled';
}

function workerFetcher(url) {
    const ctrl = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
        ? AbortSignal.timeout(ticker.REQUEST_TIMEOUT_MS)
        : undefined;
    return fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
            'User-Agent': ticker.USER_AGENT,
            'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
        },
        signal: ctrl
    }).then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
    });
}

async function refreshTicker(env, options) {
    options = options || {};
    const now = options.now || new Date();
    const fetchFn = options.fetcher || workerFetcher;
    const kv = env && env.TICKER;
    if (!kv) throw new Error('TICKER KV binding missing');
    const gathered = await ticker.collectHeadlines(fetchFn);
    const top = ticker.selectWithRelax(gathered.headlines, now);
    if (!top.length) {
        return { updated: false, news: [], reports: gathered.reports };
    }
    const output = ticker.toOutput(now.toISOString(), top);
    await kv.put(KV_KEY, JSON.stringify(output), {
        metadata: { generatedAt: now.toISOString() }
    });
    return { updated: true, news: output.news, reports: gathered.reports };
}

function parseUpdatedMs(value, metadata) {
    if (value) {
        try {
            const parsed = JSON.parse(value);
            if (parsed && parsed.updated) {
                const ms = Date.parse(parsed.updated);
                if (isFinite(ms)) return ms;
            }
        } catch (e) { /* ignore bad JSON */ }
    }
    if (metadata && metadata.generatedAt) {
        const ms = Date.parse(metadata.generatedAt);
        if (isFinite(ms)) return ms;
    }
    return 0;
}

async function fetchOrigin(env, fetcher) {
    const origin = (env && env.ORIGIN_URL) || 'https://bitcoineducation.quest/newsletter-data.json';
    const fetchFn = fetcher || workerFetcher;
    const text = await fetchFn(origin);
    JSON.parse(text); // throw if not JSON
    return text;
}

async function serveTicker(env, options) {
    options = options || {};
    const nowMs = (options.now || new Date()).getTime();
    const kv = env && env.TICKER;
    let stored = { value: null, metadata: null };
    if (kv && kv.getWithMetadata) {
        stored = (await kv.getWithMetadata(KV_KEY)) || stored;
    } else if (kv && kv.get) {
        const value = await kv.get(KV_KEY);
        stored = { value: value, metadata: null };
    }
    const updatedMs = parseUpdatedMs(stored.value, stored.metadata);
    const fresh = stored.value && updatedMs && (nowMs - updatedMs) <= STALE_MS;
    if (fresh) {
        return jsonResponse(stored.value, 200, { 'x-ticker-source': 'kv' });
    }
    try {
        const originText = await fetchOrigin(env, options.fetcher);
        return jsonResponse(originText, 200, { 'x-ticker-source': 'origin-fallback' });
    } catch (e) {
        if (stored.value) {
            return jsonResponse(stored.value, 200, { 'x-ticker-source': 'kv-stale' });
        }
        return jsonResponse({ error: 'ticker unavailable' }, 503, {
            'cache-control': 'no-store',
            'x-ticker-source': 'none'
        });
    }
}

async function handleFetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS' && (isTickerPath(url.pathname) || isRefreshPath(url.pathname))) {
        return new Response(null, {
            status: 204,
            headers: {
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'GET, POST, OPTIONS',
                'access-control-allow-headers': 'x-cron-secret, content-type',
                'access-control-max-age': '86400'
            }
        });
    }
    if (isTickerPath(url.pathname) && request.method === 'GET') {
        return serveTicker(env, { fetcher: env && env.__fetcher });
    }
    if (isRefreshPath(url.pathname) && (request.method === 'POST' || request.method === 'GET')) {
        const provided = request.headers.get('x-cron-secret') || url.searchParams.get('secret') || '';
        const expected = (env && env.CRON_SECRET) || '';
        if (!expected || !safeEqual(provided, expected)) {
            return new Response('unauthorized', { status: 401, headers: { 'cache-control': 'no-store' } });
        }
        const result = await refreshTicker(env, { fetcher: env && env.__fetcher });
        return jsonResponse(result, 200, { 'cache-control': 'no-store', 'x-ticker-source': 'refresh' });
    }
    return new Response('not found', { status: 404, headers: { 'cache-control': 'no-store' } });
}

async function handleScheduled(event, env, ctx) {
    const result = await refreshTicker(env, { fetcher: env && env.__fetcher });
    return result;
}

module.exports = {
    KV_KEY: KV_KEY,
    STALE_MS: STALE_MS,
    CACHE_CONTROL: CACHE_CONTROL,
    jsonResponse: jsonResponse,
    safeEqual: safeEqual,
    workerFetcher: workerFetcher,
    refreshTicker: refreshTicker,
    serveTicker: serveTicker,
    handleFetch: handleFetch,
    handleScheduled: handleScheduled
};
