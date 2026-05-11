/**
 * Embed Proxy Worker
 * Reverse-proxies external sites and strips iframe-blocking headers.
 * Only allows embedding from bitcoineducation.quest.
 * 
 * Routes:
 *   /                → galaxymind.space/embed
 *   /stacker-news    → stacker.news
 */

var ALLOWED_ORIGIN = 'https://bitcoineducation.quest';

var ROUTES = {
  '/': 'https://galaxymind.space/embed',
  '/stacker-news': 'https://stacker.news',
};

addEventListener('fetch', function(event) {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  var url = new URL(request.url);
  var target = ROUTES[url.pathname];

  if (!target) {
    return new Response('Not Found', { status: 404 });
  }

  // Fetch the upstream page
  var upstreamResp = await fetch(target, {
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
