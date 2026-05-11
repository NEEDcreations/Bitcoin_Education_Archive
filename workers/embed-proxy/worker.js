/**
 * Embed Proxy Worker
 * Reverse-proxies external sites, strips iframe-blocking headers,
 * and rewrites relative asset URLs to point back to the origin.
 * Only allows embedding from bitcoineducation.quest.
 *
 * Routes:
 *   /                → galaxymind.space (full site, HTML rewritten)
 *   /stacker-news    → stacker.news link-out page (fallback)
 *   /api/sn          → stacker.news GraphQL feed proxy (JSON)
 *   /api/sn/item     → stacker.news GraphQL single item + comments (JSON)
 *   /p/gm/*          → galaxymind.space/* (asset passthrough, cached)
 */

var ALLOWED_ORIGIN = 'https://bitcoineducation.quest';

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
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  var url = new URL(request.url);
  var pathname = url.pathname;

  // ---- Stacker News GraphQL feed API ----
  if (pathname === '/api/sn') {
    var sort = url.searchParams.get('sort') || 'top';
    var when = url.searchParams.get('when') || 'day';
    var limit = Math.min(parseInt(url.searchParams.get('limit') || '21'), 42);

    var query = '{ items(sort: "' + sort + '", when: "' + when + '", limit: ' + limit + ') { items { id title url sats boost ncomments createdAt user { name } } } }';

    var snResp = await fetch('https://stacker.news/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'BitcoinEducationArchive/1.0' },
      body: JSON.stringify({ query: query })
    });

    var snBody = await snResp.text();
    return new Response(snBody, {
      status: snResp.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Cache-Control': 'public, max-age=300',
      }
    });
  }

  // ---- Stacker News single item + comments ----
  if (pathname === '/api/sn/item') {
    var itemId = url.searchParams.get('id');
    if (!itemId || !/^\d+$/.test(itemId)) {
      return new Response('{"error":"Missing or invalid id"}', {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN }
      });
    }

    var itemQuery = '{ item(id: ' + itemId + ') { id title text url sats boost ncomments createdAt user { name } comments(sort: "top") { comments { id text sats createdAt user { name } ncomments comments(sort: "top") { comments { id text sats createdAt user { name } } } } } } }';

    var itemResp = await fetch('https://stacker.news/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'BitcoinEducationArchive/1.0' },
      body: JSON.stringify({ query: itemQuery })
    });

    var itemBody = await itemResp.text();
    return new Response(itemBody, {
      status: itemResp.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Cache-Control': 'public, max-age=120',
      }
    });
  }

  // ---- Asset passthrough for Galaxy Mind (aggressively cached) ----
  if (pathname.indexOf('/p/gm/') === 0) {
    var assetPath = pathname.slice(5);
    var assetUrl = 'https://galaxymind.space' + assetPath + url.search;
    var assetResp = await fetch(assetUrl, {
      method: method,
      headers: {
        'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
        'Accept': request.headers.get('Accept') || '*/*',
        'Accept-Encoding': request.headers.get('Accept-Encoding') || '',
        'Referer': 'https://galaxymind.space/',
      },
      redirect: 'follow',
    });
    var assetHeaders = new Headers(assetResp.headers);
    assetHeaders.delete('X-Frame-Options');
    assetHeaders.delete('Content-Security-Policy');
    assetHeaders.set('Access-Control-Allow-Origin', '*');

    // Cache immutable assets aggressively (Next.js hashed chunks)
    if (pathname.indexOf('/_next/static/') !== -1) {
      assetHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
    }

    return new Response(assetResp.body, {
      status: assetResp.status,
      headers: assetHeaders,
    });
  }

  // ---- Galaxy Mind embed - full HTML rewrite ----
  if (pathname === '/') {
    var upstreamResp = await fetch('https://galaxymind.space/', {
      method: method,
      headers: {
        'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
        'Accept': request.headers.get('Accept') || 'text/html',
        'Accept-Language': request.headers.get('Accept-Language') || 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    var newHeaders = new Headers(upstreamResp.headers);
    newHeaders.delete('X-Frame-Options');
    newHeaders.delete('Content-Security-Policy');
    newHeaders.set('Content-Security-Policy', "frame-ancestors 'self' " + ALLOWED_ORIGIN);
    newHeaders.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);

    var contentType = newHeaders.get('Content-Type') || '';
    if (contentType.indexOf('text/html') !== -1) {
      var body = await upstreamResp.text();

      // Rewrite absolute galaxy mind URLs
      body = body.split('https://galaxymind.space/').join('/p/gm/');
      body = body.split('https://galaxymind.space').join('/p/gm');

      // Rewrite root-relative URLs
      body = body.replace(/((?:href|src|action)=["'])\/(?!\/|p\/)/g, '$1/p/gm/');

      // Rewrite url() in inline styles
      body = body.replace(/url\(["']?\/(?!\/|p\/|data:)/g, 'url(/p/gm/');

      // Strip nonces and integrity (won't match through proxy)
      body = body.replace(/ nonce="[^"]*"/g, '');
      body = body.replace(/ integrity="[^"]*"/g, '');

      // Add preconnect hint to speed up asset loading
      body = body.replace('<head>', '<head><link rel="preconnect" href="https://embed-proxy.needcreations.workers.dev" crossorigin>');

      return new Response(body, {
        status: upstreamResp.status,
        headers: newHeaders,
      });
    }

    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      headers: newHeaders,
    });
  }

  // ---- Stacker News fallback link-out page ----
  if (pathname === '/stacker-news') {
    var snHeaders = new Headers();
    snHeaders.set('Content-Type', 'text/html; charset=utf-8');
    snHeaders.set('Content-Security-Policy', "frame-ancestors 'self' " + ALLOWED_ORIGIN);
    snHeaders.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);

    var snHtml = '<!DOCTYPE html>' +
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
      '<div class="icon">⚡</div>' +
      '<h1>Stacker News</h1>' +
      '<p>Bitcoin\'s community forum — earn sats for contributing posts, comments, and links. Stacker News can\'t be embedded due to their security settings, but you can visit directly:</p>' +
      '<a href="https://stacker.news" target="_blank" rel="noopener noreferrer">Open Stacker News ↗</a>' +
      '</div></body></html>';

    return new Response(snHtml, {
      status: 200,
      headers: snHeaders,
    });
  }

  return new Response('Not Found', { status: 404 });
}
