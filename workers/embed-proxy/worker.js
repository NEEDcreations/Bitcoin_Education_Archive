/**
 * Embed Proxy Worker
 * Transparent reverse proxy for galaxymind.space with iframe headers stripped.
 * Also serves Stacker News GraphQL API for the native feed.
 *
 * Routing:
 *   /api/sn          → Stacker News GraphQL feed
 *   /api/sn/item     → Stacker News single item + comments
 *   /stacker-news    → Stacker News link-out page
 *   /*               → Everything else proxied to galaxymind.space
 */

var ALLOWED_ORIGIN = 'https://bitcoineducation.quest';
var GM_ORIGIN = 'https://galaxymind.space';

addEventListener('fetch', function(event) {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  var method = request.method;
  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST' && method !== 'OPTIONS') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Next-Url',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  var url = new URL(request.url);
  var pathname = url.pathname;

  // ---- Stacker News GraphQL feed API ----
  if (pathname === '/api/sn') {
    return handleSNFeed(url);
  }

  // ---- Stacker News search ----
  if (pathname === '/api/sn/search') {
    return handleSNSearch(url);
  }

  // ---- Stacker News single item + comments ----
  if (pathname === '/api/sn/item') {
    return handleSNItem(url);
  }

  // ---- Stacker News fallback page ----
  if (pathname === '/stacker-news') {
    return handleSNPage();
  }

  // ---- Everything else: proxy to Galaxy Mind ----
  return proxyToGalaxyMind(request, url);
}

// =============================================
// Galaxy Mind transparent proxy
// =============================================
async function proxyToGalaxyMind(request, url) {
  var targetUrl = GM_ORIGIN + url.pathname + url.search;

  // Build headers to forward (important for Next.js RSC, prefetch, etc.)
  var fwdHeaders = new Headers();
  fwdHeaders.set('User-Agent', request.headers.get('User-Agent') || 'Mozilla/5.0');
  fwdHeaders.set('Accept', request.headers.get('Accept') || '*/*');
  fwdHeaders.set('Accept-Language', request.headers.get('Accept-Language') || 'en-US,en;q=0.9');
  fwdHeaders.set('Accept-Encoding', request.headers.get('Accept-Encoding') || '');
  fwdHeaders.set('Referer', GM_ORIGIN + '/');

  // Forward Next.js-specific headers for client-side navigation
  var nextHeaders = ['RSC', 'Next-Router-State-Tree', 'Next-Router-Prefetch', 'Next-Router-Segment-Prefetch', 'Next-Url'];
  for (var i = 0; i < nextHeaders.length; i++) {
    var val = request.headers.get(nextHeaders[i]);
    if (val) fwdHeaders.set(nextHeaders[i], val);
  }

  var upstreamResp = await fetch(targetUrl, {
    method: request.method,
    headers: fwdHeaders,
    redirect: 'follow',
  });

  // Clone and clean response headers
  var newHeaders = new Headers(upstreamResp.headers);
  newHeaders.delete('X-Frame-Options');

  // Replace CSP: remove frame-ancestors restriction, keep rest loose
  newHeaders.delete('Content-Security-Policy');
  newHeaders.set('Content-Security-Policy', "frame-ancestors 'self' " + ALLOWED_ORIGIN);

  newHeaders.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);

  // For HTML responses, strip nonces (they won't match through proxy)
  var contentType = newHeaders.get('Content-Type') || '';
  if (contentType.indexOf('text/html') !== -1) {
    var body = await upstreamResp.text();

    // Strip nonce attributes (CSP nonces won't validate through proxy)
    body = body.replace(/ nonce="[^"]*"/g, '');

    // Remove integrity checks
    body = body.replace(/ integrity="[^"]*"/g, '');

    // Relax the inline CSP meta tag if present
    body = body.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');

    return new Response(body, {
      status: upstreamResp.status,
      headers: newHeaders,
    });
  }

  // For immutable hashed assets, cache aggressively
  if (url.pathname.indexOf('/_next/static/') !== -1) {
    newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: newHeaders,
  });
}

// =============================================
// Stacker News API
// =============================================
async function handleSNFeed(url) {
  var sort = url.searchParams.get('sort') || 'top';
  var when = url.searchParams.get('when') || 'day';
  var limit = Math.min(parseInt(url.searchParams.get('limit') || '21'), 42);
  var sub = url.searchParams.get('sub') || '';

  var subArg = sub ? ', sub: "' + sub.replace(/[^a-zA-Z0-9_-]/g, '') + '"' : '';
  var query = '{ items(sort: "' + sort + '", when: "' + when + '", limit: ' + limit + subArg + ') { items { id title url sats boost ncomments createdAt user { name } sub { name } } } }';

  var resp = await fetch('https://stacker.news/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'BitcoinEducationArchive/1.0' },
    body: JSON.stringify({ query: query })
  });

  return new Response(await resp.text(), {
    status: resp.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Cache-Control': 'public, max-age=300',
    }
  });
}

async function handleSNItem(url) {
  var itemId = url.searchParams.get('id');
  if (!itemId || !/^\d+$/.test(itemId)) {
    return new Response('{"error":"Missing or invalid id"}', {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN }
    });
  }

  var query = '{ item(id: ' + itemId + ') { id title text url sats boost ncomments createdAt user { name } comments(sort: "top") { comments { id text sats createdAt user { name } ncomments comments(sort: "top") { comments { id text sats createdAt user { name } } } } } } }';

  var resp = await fetch('https://stacker.news/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'BitcoinEducationArchive/1.0' },
    body: JSON.stringify({ query: query })
  });

  return new Response(await resp.text(), {
    status: resp.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Cache-Control': 'public, max-age=120',
    }
  });
}

async function handleSNSearch(url) {
  var q = url.searchParams.get('q') || '';
  if (!q || q.length < 2) {
    return new Response('{"error":"Query too short"}', {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN }
    });
  }

  var query = '{ search(q: ' + JSON.stringify(q) + ') { items { id title url sats boost ncomments createdAt user { name } sub { name } } } }';

  var resp = await fetch('https://stacker.news/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'BitcoinEducationArchive/1.0' },
    body: JSON.stringify({ query: query })
  });

  return new Response(await resp.text(), {
    status: resp.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Cache-Control': 'public, max-age=120',
    }
  });
}

function handleSNPage() {
  var h = new Headers();
  h.set('Content-Type', 'text/html; charset=utf-8');
  h.set('Content-Security-Policy', "frame-ancestors 'self' " + ALLOWED_ORIGIN);
  h.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);

  var html = '<!DOCTYPE html>' +
    '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Stacker News</title>' +
    '<style>' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'body{background:#0f0f0f;color:#e0e0e0;font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px;text-align:center}' +
    '.container{max-width:480px}' +
    'h1{font-size:1.5rem;margin-bottom:12px;color:#f7931a}' +
    'p{font-size:0.95rem;line-height:1.5;color:#aaa;margin-bottom:20px}' +
    'a{display:inline-block;padding:14px 32px;background:#f7931a;color:#000;text-decoration:none;border-radius:12px;font-weight:700;font-size:1rem;transition:0.2s}' +
    'a:hover{background:#ff9f33;transform:scale(1.02)}' +
    '.icon{font-size:3rem;margin-bottom:16px}' +
    '</style></head><body>' +
    '<div class="container">' +
    '<div class="icon">\u26a1</div>' +
    '<h1>Stacker News</h1>' +
    "<p>Bitcoin's community forum \u2014 earn sats for contributing posts, comments, and links. Stacker News can't be embedded due to their security settings, but you can visit directly:</p>" +
    '<a href="https://stacker.news" target="_blank" rel="noopener noreferrer">Open Stacker News \u2197</a>' +
    '</div></body></html>';

  return new Response(html, { status: 200, headers: h });
}
