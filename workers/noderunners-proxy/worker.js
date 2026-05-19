/**
 * Node Runners Proxy Worker
 * Transparent reverse proxy for noderunners.network with frame-buster stripped.
 * Same pattern as the Galaxy Mind proxy — simple, everything at the root.
 */

var ALLOWED_ORIGIN = 'https://bitcoineducation.quest';
var NR_ORIGIN = 'https://noderunners.network';

addEventListener('fetch', function(event) {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
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
  return proxyToNodeRunners(request, url);
}

async function proxyToNodeRunners(request, url) {
  var targetUrl = NR_ORIGIN + url.pathname + url.search;

  var fwdHeaders = new Headers();
  fwdHeaders.set('User-Agent', request.headers.get('User-Agent') || 'Mozilla/5.0');
  fwdHeaders.set('Accept', request.headers.get('Accept') || '*/*');
  fwdHeaders.set('Accept-Language', request.headers.get('Accept-Language') || 'en-US,en;q=0.9');
  fwdHeaders.set('Accept-Encoding', request.headers.get('Accept-Encoding') || '');
  fwdHeaders.set('Referer', NR_ORIGIN + '/');

  var cookie = request.headers.get('Cookie');
  if (cookie) fwdHeaders.set('Cookie', cookie);

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

  var contentType = newHeaders.get('Content-Type') || '';
  if (contentType.indexOf('text/html') !== -1) {
    var body = await upstreamResp.text();

    // Strip antiClickjack frame-buster script + hiding style
    body = body.replace(/<style\s+id\s*=\s*["']antiClickjack["'][^>]*>[\s\S]*?<\/style>/gi, '');
    body = body.replace(/<script[^>]*>[\s\S]*?top\.location\s*=\s*self\.location[\s\S]*?<\/script>/gi, '');

    // Kill target=_top/_parent so links stay in iframe
    body = body.replace(/ target\s*=\s*["']_top["']/gi, ' target="_self"');
    body = body.replace(/ target\s*=\s*["']_parent["']/gi, ' target="_self"');

    return new Response(body, {
      status: upstreamResp.status,
      headers: newHeaders,
    });
  }

  // Cache static assets
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico)(\?|$)/)) {
    newHeaders.set('Cache-Control', 'public, max-age=86400');
  }

  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: newHeaders,
  });
}
