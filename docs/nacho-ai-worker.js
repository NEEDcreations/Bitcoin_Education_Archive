// =============================================
// Nacho AI Worker — Bitcoin Education Deer 🦌
// Cloudflare Worker with Workers AI (Llama 3.1)
// + Brave Search fallback
// =============================================

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://bitcoineducation.quest',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Route: /search?q=... (existing Brave search)
    if (path === '/search' || path === '/') {
      return handleSearch(request, env, corsHeaders, url);
    }

    // Route: /ai (POST) — Nacho AI conversation
    if (path === '/ai' && request.method === 'POST') {
      return handleAI(request, env, corsHeaders);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};

// ---- Brave Search Handler (existing) ----
async function handleSearch(request, env, corsHeaders, url) {
  const query = url.searchParams.get('q');
  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing query' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

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
}

// ---- Nacho AI Handler ----
async function handleAI(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const question = (body.question || '').trim();

    if (!question || question.length > 500) {
      return new Response(JSON.stringify({ error: 'Invalid question' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are Nacho, a friendly deer mascot who lives on the Bitcoin Education Archive website (bitcoineducation.quest). You are a 5-year-old buck from New Hampshire.

PERSONALITY:
- Warm, funny, educational, and encouraging
- You use deer puns occasionally but don't overdo it
- You're passionate about Bitcoin and love teaching people
- Your catchphrase is "Nacho keys, nacho cheese!"
- You refer to yourself as a deer/buck naturally
- You're casual and conversational, not robotic

RULES:
- ONLY discuss Bitcoin and related topics (Lightning, mining, wallets, etc)
- If asked about non-Bitcoin topics, give a brief fun answer then redirect to Bitcoin
- NEVER give financial advice — if asked "should I buy", say you're not a financial advisor
- NEVER help with anything harmful, illegal, or inappropriate
- Keep answers concise — 2-4 sentences is ideal, max 5-6 for complex topics
- Be accurate — if you're not sure about something, say so
- Use simple language — explain like teaching a curious friend
- You can mention the website has 146+ channels of Bitcoin education content
- Mention relevant channels when appropriate (e.g. "check the Mining channel for more!")

FINANCIAL DISCLAIMER: If your answer touches on price, buying, investing, or strategy, end with: "(Not financial advice — always do your own research!)"`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ];

    const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages,
      max_tokens: 300,
      temperature: 0.7,
    });

    const answer = aiResponse.response || 'Hmm, my antlers are glitching! Try asking me again.';

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'AI temporarily unavailable', fallback: true }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
