import { parseT, injectOg, renderOg, remaining, CANON } from './lib.js';

const PAGE_PATHS = new Set(['/needisbored', '/needisbored/', '/needisbored.html', '/needisbored/index.html']);
const PAGES = 'https://bitcoin-quest.pages.dev';

function htmlHeaders(extra) {
  const h = {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'public, max-age=0, must-revalidate',
    'x-robots-tag': 'noindex, nofollow',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-content-type-options': 'nosniff',
  };
  return { ...h, ...extra };
}

async function loadPageHtml(request, url) {
  const assetPath = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')
    ? '/needisbored/index.html'
    : '/needisbored.html';
  try {
    const resp = await fetch(PAGES + assetPath, { cf: { cacheTtl: 60 } });
    if (resp.ok) return await resp.text();
  } catch (err) {}
  return null;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const parsed = parseT(url.searchParams);

    if (path === '/needisbored/og.png' || path === '/needisbored/og') {
      const png = await renderOg(parsed.at);
      const headers = {
        'content-type': 'image/png',
        'x-robots-tag': 'noindex, nofollow',
        'cache-control': parsed.hasT
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=60, must-revalidate',
      };
      if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
      return new Response(png, { status: 200, headers });
    }

    if (PAGE_PATHS.has(path)) {
      let html = await loadPageHtml(request, url);
      if (!html) {
        // Should only happen if Pages has not been published yet.
        return new Response('needisbored page is not published yet', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
      html = injectOg(html, parsed);
      const headers = htmlHeaders();
      if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
      return new Response(html, { status: 200, headers });
    }

    return new Response('Not found', { status: 404 });
  }
};
