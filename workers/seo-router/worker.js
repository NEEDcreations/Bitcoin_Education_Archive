/**
 * SEO Router + CSP Worker for Bitcoin Education Archive
 *
 * Routes:
 *   /channels/{id} → serves pre-rendered HTML for bots, SPA for humans
 *   /app/{page}    → serves pre-rendered HTML for bots, SPA for humans
 *   Everything else → passes through to origin (GitHub Pages)
 *
 * Security:
 *   - Generates a unique nonce per request
 *   - Injects nonce into every <script> tag via HTMLRewriter (streaming, zero buffering)
 *   - Sets Content-Security-Policy response header with nonce + full allowlist
 *   - Sets X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy
 *
 * CSP Phase 1: script-src includes 'unsafe-inline' (required while onclick= attrs remain in index.html)
 * CSP Phase 2: remove 'unsafe-inline' after onclick= → addEventListener migration is complete
 *
 * Domains: bitcoineducation.quest, btcedu.app, btcedu.quest
 */

// Bot user-agent patterns
const BOT_UA = /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebot|facebookexternalhit|twitterbot|linkedinbot|telegrambot|discordbot|whatsapp|ia_archiver|archive\.org_bot|applebot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|rogerbot|sogou|exabot|swiftbot/i;

const PRIMARY_ORIGIN = 'https://bitcoineducation.quest';
const CHANNEL_INDEX_URL = PRIMARY_ORIGIN + '/channel_index.js';

function getOrigin(request) {
    return new URL(request.url).origin;
}

let channelCache = null;
let channelCacheTs = 0;

async function getChannelIndex() {
    if (channelCache && Date.now() - channelCacheTs < 3600000) return channelCache;
    try {
        const res = await fetch(CHANNEL_INDEX_URL);
        const text = await res.text();
        const json = text.replace(/^var CHANNELS\s*=\s*/, '').replace(/;\s*$/, '');
        channelCache = JSON.parse(json);
        channelCacheTs = Date.now();
        return channelCache;
    } catch (e) {
        console.error('Failed to fetch channel index:', e);
        return null;
    }
}

function isBot(ua) {
    return BOT_UA.test(ua || '');
}

function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── CSP / Nonce ─────────────────────────────────────────────────────────────

function generateNonce() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // base64url — safe for CSP nonce values and HTML attributes
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Build the full Content-Security-Policy value for a given nonce.
 *
 * PHASE 1 (current): 'unsafe-inline' is present in script-src because
 *   index.html still has onclick= event-handler attributes. It is intentionally
 *   listed AFTER the nonce; in CSP Level 2+ browsers the nonce takes precedence
 *   and 'unsafe-inline' is downgraded — but we keep it for CSP Level 1 fallback
 *   and for the event-handler attributes that nonces cannot cover.
 *
 * PHASE 2 (after onclick= migration): Remove 'unsafe-inline' from script-src.
 *   All inline <script> blocks will be authenticated by nonce alone.
 */
function buildCSP(nonce) {
    return [
        "default-src 'self'",

        // PHASE 1: 'unsafe-inline' retained — bundle.js generates onclick= attrs dynamically
        // via innerHTML; removing unsafe-inline blocks all of them. Full Phase 2 requires
        // auditing every innerHTML string in bundle.js and converting to addEventListener.
        // Reverted from Phase 2 (ae9222d2) which broke all UI interactions.
        `script-src 'self' 'nonce-${nonce}' 'unsafe-inline'` +
            " https://www.gstatic.com" +
            " https://challenges.cloudflare.com" +
            " https://accounts.google.com" +
            " https://connect.facebook.net" +
            " https://platform.twitter.com" +
            " https://cdn.jsdelivr.net" +
            " https://cdnjs.cloudflare.com" +
            " https://translate.google.com" +
            " https://www.youtube.com",

        // connect-src: every outbound fetch / WebSocket the app makes
        "connect-src 'self'" +
            " https://*.googleapis.com" +           // Firestore, Auth, FCM, Storage
            " https://*.google.com" +               // Google Sign-In
            " https://*.firebaseapp.com" +           // Firebase hosting / Auth redirect
            " https://fcm.googleapis.com" +          // Push notifications
            " wss://*.firebaseio.com" +              // Realtime DB WebSocket
            " https://api.binance.com" +             // BTC price
            " https://api.coingecko.com" +
            " https://api.alternative.me" +          // Fear & Greed index
            " https://mempool.space" +               // Block explorer / REST
            " wss://mempool.space" +                 // Block-surf WebSocket
            " wss://ws.coincap.io" +                 // CoinCap price WebSocket
            " https://colintalkscrypto.com" +        // CBBI data
            " https://raw.githubusercontent.com" +   // Channel data files
            " https://*.needcreations.workers.dev" + // CF Workers (search, embed-proxy, pleb-sync)
            " https://api.qrserver.com" +            // QR code generation
            " https://us-central1-bitcoin-education-archive.cloudfunctions.net", // Cloud Functions

        "img-src 'self' data: blob: https:",         // Broad: GIF picker, user avatars, YouTube thumbs

        "media-src 'self' blob: https:",             // Audio (Beats), image uploads

        // frame-src: iframes the app legitimately embeds
        "frame-src" +
            " https://www.youtube.com" +
            " https://www.youtube-nocookie.com" +
            " https://challenges.cloudflare.com" +   // Turnstile
            " https://ck121212195.github.io" +       // SAT-ARCADE game
            " https://bitcoin-education-archive.firebaseapp.com" + // Firebase Auth iframe
            " https://accounts.google.com",          // Google Sign-In popup

        "font-src 'self' https://fonts.gstatic.com",

        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

        "object-src 'none'",    // No Flash/plugins
        "base-uri 'self'",      // No <base> tag hijacking
        "form-action 'self'",   // No phishing form submissions
        "worker-src 'self' blob:", // Service worker + audio blob workers
    ].join('; ');
}

/** Static headers applied to every HTML response (no nonce dependence) */
const STATIC_HEADERS = {
    'X-Content-Type-Options':  'nosniff',
    'X-Frame-Options':         'SAMEORIGIN',
    'Referrer-Policy':         'strict-origin-when-cross-origin',
    'Permissions-Policy':      'camera=(), microphone=(), geolocation=(), payment=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

/**
 * Apply security headers to an HTML response.
 * Uses Cloudflare HTMLRewriter to inject a nonce attribute into every <script>
 * tag in the response body — streaming, no buffering.
 */
function applySecurityHeaders(response, nonce) {
    const csp = buildCSP(nonce);

    // Inject nonce into every <script> element (inline blocks AND external src tags)
    const rewritten = new HTMLRewriter()
        .on('script', {
            element(el) {
                // Preserve any existing nonce (e.g. from origin), set ours if absent
                if (!el.getAttribute('nonce')) {
                    el.setAttribute('nonce', nonce);
                }
            }
        })
        .transform(response);

    const headers = new Headers(rewritten.headers);
    headers.set('Content-Security-Policy', csp);
    for (const [k, v] of Object.entries(STATIC_HEADERS)) {
        headers.set(k, v);
    }
    // Remove X-XSS-Protection (deprecated, can cause issues in modern browsers)
    headers.delete('X-XSS-Protection');

    return new Response(rewritten.body, {
        status: rewritten.status,
        statusText: rewritten.statusText,
        headers,
    });
}

/** Build security headers object for bot-rendered pages (static HTML, no body transform needed) */
function botPageHeaders(nonce, extraHeaders = {}) {
    return {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=86400',
        'Content-Security-Policy': buildCSP(nonce),
        ...STATIC_HEADERS,
        ...extraHeaders,
    };
}

// ─── Page Renderers ───────────────────────────────────────────────────────────

function renderChannelPage(id, channel, origin) {
    const title = escapeHtml((channel.title || id).replace(/^[^\w]*/, ''));
    const desc  = escapeHtml(channel.desc || 'Bitcoin education channel');
    const cat   = escapeHtml(channel.cat || '');
    const url   = origin + '/channels/' + id;
    const ogImg = origin + '/og-image.png';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} — Bitcoin Education Archive</title>
    <meta name="description" content="${desc}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${title} — Bitcoin Education Archive">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${ogImg}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title} — Bitcoin Education Archive">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${ogImg}">
    <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Article","name":"${title}","description":"${desc}","url":"${url}","publisher":{"@type":"Organization","name":"603BTC LLC","url":"https://603btc.com"},"isPartOf":{"@type":"WebSite","name":"Bitcoin Education Archive","url":"${origin}"}}
    </script>
    <meta http-equiv="refresh" content="0;url=${origin}/#${id}">
</head>
<body>
    <h1>${title}</h1>
    <p>Category: ${cat}</p>
    <p>${desc}</p>
    <p><a href="${origin}/#${id}">Open in Bitcoin Education Archive →</a></p>
    <p><a href="${origin}">← Back to all channels</a></p>
</body>
</html>`;
}

function renderAppPage(page, origin) {
    const pages = {
        'forum':          { title: 'PlebTalk Forum', desc: 'Discuss Bitcoin with the community. Post, reply, upvote, and earn points.' },
        'marketplace':    { title: 'Lightning Mart', desc: 'Buy and sell with Bitcoin Lightning. Community marketplace for Bitcoiners.' },
        'bitcoin-beats':  { title: 'Bitcoin Beats', desc: 'Listen to Bitcoin-themed music, upload tracks, and DJ for the community.' },
        'irl-sync':       { title: 'IRL Sync', desc: 'Find and organize Bitcoin meetups near you. Connect with Bitcoiners in real life.' },
        'chat':           { title: 'Global Chat', desc: 'Real-time chat with Bitcoiners. Send messages, GIFs, and listen to community radio.' },
        'pvp':            { title: 'PVP Bitcoin Trivia', desc: '1v1 Bitcoin trivia battles. Test your knowledge against other Bitcoiners.' },
        'trails':         { title: "Nacho's Trails", desc: 'Guided Bitcoin learning modules. Beginner to advanced with exams and certificates.' },
        'nacho':          { title: 'Nacho Mode', desc: 'AI-powered Bitcoin tutor. Ask any question and get instant, accurate answers.' },
        'bitcoin-dashboard': { title: 'Bitcoin Dashboard', desc: 'Live Bitcoin price, block height, mempool, hashrate, fees, and network stats.' },
        'lightning':      { title: 'Lightning Wallet', desc: 'Connect your Lightning wallet for instant Bitcoin payments and tips.' },
        'first-purchase': { title: 'How to Buy Bitcoin', desc: 'Step-by-step guide to buying your first Bitcoin safely and securely.' },
        'dms':            { title: 'Direct Messages', desc: 'Private messaging between Bitcoiners on the Bitcoin Education Archive.' },
        'timechain-tv':   { title: 'Timechain TV — 24/7 Bitcoin Streaming', desc: '21 channels of 24/7 Bitcoin content. 1,400+ videos curated for maximum orange pill exposure. ⚡📺', image: '/images/tctv-preview.png' },
        'tv':             { title: 'Timechain TV — 24/7 Bitcoin Streaming', desc: '21 channels of 24/7 Bitcoin content.', image: '/images/tctv-preview.png' },
    };
    const info  = pages[page] || { title: page, desc: 'Bitcoin Education Archive' };
    const title = escapeHtml(info.title);
    const desc  = escapeHtml(info.desc);
    const url   = origin + '/app/' + page;
    const ogImg = info.image ? (origin + info.image) : (origin + '/og-image.png');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} — Bitcoin Education Archive</title>
    <meta name="description" content="${desc}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${title} — Bitcoin Education Archive">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${ogImg}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title} — Bitcoin Education Archive">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${ogImg}">
    <meta http-equiv="refresh" content="0;url=${origin}/#${page}">
</head>
<body>
    <h1>${title}</h1>
    <p>${desc}</p>
    <p><a href="${origin}/#${page}">Open ${title} →</a></p>
    <p><a href="${origin}">← Back to Bitcoin Education Archive</a></p>
</body>
</html>`;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default {
    async fetch(request) {
        const url    = new URL(request.url);
        const path   = url.pathname;
        const ua     = request.headers.get('user-agent') || '';
        const origin = getOrigin(request);

        // Generate a fresh nonce for every request
        const nonce = generateNonce();

        // /channels/{id}
        const channelMatch = path.match(/^\/channels\/([a-zA-Z0-9_-]+)\/?$/);
        if (channelMatch) {
            const id = channelMatch[1];
            if (isBot(ua)) {
                const channels = await getChannelIndex();
                if (channels && channels[id]) {
                    return new Response(renderChannelPage(id, channels[id], origin), {
                        headers: botPageHeaders(nonce),
                    });
                }
            }
            return Response.redirect(PRIMARY_ORIGIN + '/#' + id, 302);
        }

        // /app/{page}
        const appMatch = path.match(/^\/app\/([a-zA-Z0-9_-]+)\/?$/);
        if (appMatch) {
            const page = appMatch[1];
            if (isBot(ua)) {
                return new Response(renderAppPage(page, origin), {
                    headers: botPageHeaders(nonce),
                });
            }
            return Response.redirect(PRIMARY_ORIGIN + '/#' + page, 302);
        }

        // Clean URL aliases
        const cleanAliases = {
            '/timechain-tv': 'timechain-tv', '/tv': 'tv',
            '/forum': 'forum', '/marketplace': 'marketplace',
            '/bitcoin-beats': 'bitcoin-beats', '/beats': 'bitcoin-beats',
            '/irl-sync': 'irl-sync', '/meet': 'irl-sync',
            '/chat': 'chat', '/pvp': 'pvp',
        };
        const aliasPage = cleanAliases[path];
        if (aliasPage) {
            if (isBot(ua)) {
                return new Response(renderAppPage(aliasPage, origin), {
                    headers: botPageHeaders(nonce),
                });
            }
            return Response.redirect(PRIMARY_ORIGIN + '/#' + aliasPage, 302);
        }

        // Pass-through: fetch from origin, inject security headers + nonce into HTML
        const resp = await fetch(request);
        const ct   = resp.headers.get('content-type') || '';
        if (ct.includes('text/html')) {
            return applySecurityHeaders(resp, nonce);
        }
        return resp;
    },
};
