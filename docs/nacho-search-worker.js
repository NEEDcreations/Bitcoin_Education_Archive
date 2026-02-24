// =============================================
// Nacho Search Proxy — Cloudflare Worker
// Deploy this to Cloudflare Workers (free tier)
// Then set the worker URL in localStorage:
//   localStorage.setItem('btc_nacho_search_proxy', 'https://your-worker.workers.dev')
// =============================================
//
// SETUP:
// 1. Go to https://dash.cloudflare.com → Workers & Pages → Create Worker
// 2. Paste this code
// 3. Set environment variable: BRAVE_API_KEY = your Brave Search API key
//    (Get a free key at https://api.search.brave.com/register)
// 4. Deploy
// 5. Set the worker URL in your site config
//
// The worker accepts: GET /?q=bitcoin+mining
// Returns: { results: [{ title, snippet, url }] }

export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://bitcoineducation.quest',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    if (!query) {
      return new Response(JSON.stringify({ error: 'Missing query parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit: 10 requests per minute per IP
    // (In production, use Cloudflare's rate limiting rules)

    try {
      const braveUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3&safesearch=strict`;
      const response = await fetch(braveUrl, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': env.BRAVE_API_KEY,
        },
      });

      const data = await response.json();
      const results = (data.web?.results || []).slice(0, 3).map(r => ({
        title: r.title || '',
        snippet: r.description || '',
        url: r.url || '',
      }));

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Search failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
