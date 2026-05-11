/**
 * Embed Proxy Worker
 * Reverse-proxies galaxymind.space/embed and strips iframe-blocking headers.
 * Only allows embedding from bitcoineducation.quest.
 */

var ALLOWED_ORIGIN = 'https://bitcoineducation.quest';
var TARGET = 'https://galaxymind.space/embed';

addEventListener('fetch', function(event) {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Only allow GET
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Fetch the upstream page
  var upstreamResp = await fetch(TARGET, {
    headers: {
      'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
      'Accept': request.headers.get('Accept') || 'text/html',
      'Accept-Language': request.headers.get('Accept-Language') || 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });

  // Clone headers, strip iframe blockers
  var newHeaders = new Headers(upstreamResp.headers);
  newHeaders.delete('X-Frame-Options');
  newHeaders.delete('Content-Security-Policy');

  // Set our own permissive frame-ancestors
  newHeaders.set('Content-Security-Policy', "frame-ancestors 'self' " + ALLOWED_ORIGIN);

  // CORS for the iframe context
  newHeaders.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);

  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: newHeaders,
  });
}
