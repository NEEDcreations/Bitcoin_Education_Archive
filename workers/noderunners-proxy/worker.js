/**
 * Node Runners Proxy Worker
 * Transparent reverse proxy for noderunners.network with frame-buster stripped.
 * Same pattern as the Galaxy Mind proxy — simple, everything at the root.
 */

var ALLOWED_ORIGIN = 'https://bitcoineducation.quest';
var NR_ORIGIN = 'https://noderunners.network';

addEventListener('fetch', function(event) {
  event.respondWith(handleRequest(event.request, event));
});

async function handleRequest(request, event) {
  var method = request.method;
  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST' && method !== 'OPTIONS') {
    return new Response('Method Not Allowed', { status: 405 });
  }

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
  return proxyToNodeRunners(request, url, event);
}

async function proxyToNodeRunners(request, url, event) {
  var pathname = url.pathname;

  // Static assets (CSS/JS/images/fonts) — redirect to noderunners directly.
  // No frame-buster in static files, skip the proxy overhead entirely.
  if (pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot|ico|map)(\?|$)/)) {
    return Response.redirect(NR_ORIGIN + pathname + url.search, 302);
  }

  // HTML pages — fetch through proxy, strip frame-buster, cache at edge
  var cacheKey = new Request(url.toString(), request);
  var cache = caches.default;

  // Try edge cache first
  var cached = await cache.match(cacheKey);
  if (cached) return cached;

  var targetUrl = NR_ORIGIN + pathname + url.search;

  var fwdHeaders = new Headers();
  fwdHeaders.set('User-Agent', request.headers.get('User-Agent') || 'Mozilla/5.0');
  fwdHeaders.set('Accept', request.headers.get('Accept') || '*/*');
  fwdHeaders.set('Accept-Language', request.headers.get('Accept-Language') || 'en-US,en;q=0.9');
  fwdHeaders.set('Accept-Encoding', request.headers.get('Accept-Encoding') || '');
  fwdHeaders.set('Referer', NR_ORIGIN + '/');

  var upstreamResp = await fetch(targetUrl, {
    method: request.method,
    headers: fwdHeaders,
    redirect: 'follow',
  });

  var newHeaders = new Headers(upstreamResp.headers);
  newHeaders.delete('X-Frame-Options');
  newHeaders.delete('Content-Security-Policy');
  newHeaders.set('Content-Security-Policy', "frame-ancestors 'self' " + ALLOWED_ORIGIN);
  newHeaders.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  // Remove cache-busting headers from upstream so CF edge can cache
  newHeaders.delete('Pragma');
  newHeaders.delete('Expires');
  newHeaders.delete('Set-Cookie');

  var contentType = newHeaders.get('Content-Type') || '';
  if (contentType.indexOf('text/html') !== -1) {
    var body = await upstreamResp.text();

    // Strip antiClickjack hiding style
    body = body.replace(/<style\s+id\s*=\s*["']antiClickjack["'][^>]*>[\s\S]*?<\/style>/gi, '');

    // Strip the specific frame-buster script
    body = body.replace(/<script\s+type\s*=\s*["']text\/javascript["']\s*>[\s\S]{0,500}?top\.location\s*=\s*self\.location;[\s\S]{0,200}?<\/script>/gi, '');

    // Kill target=_top/_parent so links stay in iframe
    body = body.replace(/ target\s*=\s*["']_top["']/gi, ' target="_self"');
    body = body.replace(/ target\s*=\s*["']_parent["']/gi, ' target="_self"');

    // Cache HTML at CF edge for 5 minutes (their catalog won't change faster)
    newHeaders.delete('Cache-Control');
    newHeaders.set('Cache-Control', 'public, max-age=300, s-maxage=300');

    var resp = new Response(body, {
      status: upstreamResp.status,
      headers: newHeaders,
    });

    // Store in edge cache (non-blocking)
    event.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  }

  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: newHeaders,
  });
}
