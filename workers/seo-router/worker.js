/**
 * SEO Router + CSP Worker for Bitcoin Education Archive
 *
 * Routes:
 *   /channels/{id} → serves pre-rendered HTML for bots, SPA for humans
 *   /app/{page}    → serves pre-rendered HTML for bots, SPA for humans
 *   Everything else → passes through to origin (Cloudflare Pages)
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
 *
 * Mini-app share links (?card=<id>) get a static unfurl for known crawlers.
 * Humans still receive the Pages app. Known achievement ?a= wins when both
 * are present. Card HTML is private, no-store so a ref cannot be cached
 * under another visitor's URL.
 */

import { MINIAPP_CARDS, MINIAPP_CARD_VERSION } from './miniapp-cards.js';

// Bot user-agent patterns
const BOT_UA = /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebot|facebookexternalhit|twitterbot|linkedinbot|telegrambot|discordbot|whatsapp|ia_archiver|archive\.org_bot|applebot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|rogerbot|sogou|exabot|swiftbot/i;

const PRIMARY_ORIGIN = 'https://bitcoineducation.quest';
// Pages hosts the static site. The custom domain is this worker, so the
// channel index and pass-through fetches must not go back through PRIMARY_ORIGIN.
const PAGES_ORIGIN = 'https://bitcoin-quest.pages.dev';
const CHANNEL_INDEX_URL = PAGES_ORIGIN + '/channel_index.js';

function getOrigin(request) {
    return new URL(request.url).origin;
}

// Strict alphanumeric referral code, read from the raw query.
// Achievement previews must not treat an unvalidated query as page content.
function validatedReferralRef(search) {
    const match = /(?:^|[?&])ref=([A-Za-z0-9]{6,28})(?:&|#|$)/.exec(String(search || ''));
    return match ? match[1] : '';
}

function urlWithRef(base, ref) {
    const b = String(base || '');
    if (!ref) return b;
    if (/(?:^|[?&])ref=/.test(b)) return b;
    const hashAt = b.indexOf('#');
    const hash = hashAt >= 0 ? b.slice(hashAt) : '';
    const core = hashAt >= 0 ? b.slice(0, hashAt) : b;
    return core + (core.indexOf('?') >= 0 ? '&' : '?') + 'ref=' + ref + hash;
}

// Same charset as miniapp-share.js srcQuery. Anything else is dropped.
function validatedSrc(search) {
    const match = /(?:^|[?&])src=([A-Za-z0-9_.-]{1,64})(?:&|#|$)/.exec(String(search || ''));
    return match ? match[1] : '';
}

// Kept next to the redirect helpers so the referral slice can run without
// the module binding. Tests require this list to match MINIAPP_CARDS.
const MINIAPP_CARD_ID_LIST = 'tctv beats nacho pop pvp arcade sat_arcade galaxy ryracer forum marketplace irl meetup ai metrics leaderboard quests favor trails learning chat lightning first';

// Allowlisted mini-app id. The raw value is never copied into HTML.
function validatedCardId(search) {
    const match = /(?:^|[?&])card=([a-z0-9_]{1,32})(?:&|#|$)/.exec(String(search || ''));
    if (!match) return '';
    const id = match[1];
    if ((' ' + MINIAPP_CARD_ID_LIST + ' ').indexOf(' ' + id + ' ') === -1) return '';
    return id;
}

// Plain http was fetched straight through. That subrequest throws and the
// worker answers 500 on every path. Send the browser to https and keep the
// path and query. The hash is not on the request.
function httpsRedirectTarget(requestUrl) {
    let url;
    try { url = new URL(requestUrl); } catch (e) { return ''; }
    if (url.protocol !== 'http:') return '';
    return 'https://' + url.host + url.pathname + url.search;
}

function spaRedirectTarget(page, search) {
    const ref = validatedReferralRef(search);
    const src = validatedSrc(search);
    const card = validatedCardId(search);
    const parts = [];
    if (ref) parts.push('ref=' + ref);
    if (src) parts.push('src=' + encodeURIComponent(src));
    if (card) parts.push('card=' + card);
    const query = parts.length ? ('?' + parts.join('&')) : '';
    return PRIMARY_ORIGIN + '/' + query + '#' + page;
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
    // Same set as BQSafe.esc (xss-safe.js): safe in text and in any quoted attribute.
    return String(s == null ? '' : s).replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[c]);
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

        // PHASE 1: nonce is NOT listed in script-src while onclick= attrs remain in the page.
        // Per CSP Level 2+ spec, when a nonce is present in script-src, browsers DROP
        // 'unsafe-inline' entirely — it is not a fallback. Including the nonce here while
        // onclick= handlers exist silently breaks all UI interactions.
        // The nonce is still injected into <script> tags by HTMLRewriter (ready for Phase 2)
        // but must not appear in the header until the onclick= → addEventListener migration
        // is complete across all inline HTML and bundle.js innerHTML strings.
        `script-src 'self' 'unsafe-inline'` +
            " https://www.gstatic.com" +
            " https://challenges.cloudflare.com" +
            " https://accounts.google.com" +
            " https://accounts.google.com/gsi/client" + // Google Identity Services button
            " https://apis.google.com" +           // Google Sign-In auth library (api.js)
            " https://auth.bitcoineducation.quest" + // Custom auth domain (Safari ITP fix)
            " https://connect.facebook.net" +
            " https://platform.twitter.com" +
            " https://cdn.jsdelivr.net" +
            " https://cdnjs.cloudflare.com" +
            " https://translate.google.com" +
            " https://www.google.com" +          // reCAPTCHA v3 (App Check token generation)
            " https://www.youtube.com",

        // connect-src: every outbound fetch / WebSocket the app makes
        "connect-src 'self'" +
            " https://www.gstatic.com" +              // Firebase source maps (firebase-*.js.map)
            " https://*.googleapis.com" +           // Firestore, Auth, FCM, Storage
            " https://*.firebasestorage.app" +        // Firebase Storage (new domain)
            " wss://*.googleapis.com" +            // Firestore real-time WebSocket (mobile)
            " https://*.google.com" +               // Google Sign-In
            " https://*.firebaseapp.com" +           // Firebase hosting / Auth redirect
            " https://auth.bitcoineducation.quest" +    // Custom auth domain (Safari ITP fix)
            " https://fcm.googleapis.com" +          // Push notifications
            " wss://*.firebaseio.com" +              // Realtime DB WebSocket
            " https://api.binance.com" +             // BTC price
            " https://api.coingecko.com" +
            " https://api.alternative.me" +          // Fear & Greed index
            " https://mempool.space" +               // Block explorer / REST
            " wss://mempool.space" +                 // Block-surf WebSocket
            " wss://ws-feed.exchange.coinbase.com" + // Coinbase Exchange price WebSocket
            " https://colintalkscrypto.com" +        // CBBI data
            " https://raw.githubusercontent.com" +   // Channel data files
            " https://*.needcreations.workers.dev" + // CF Workers (search, embed-proxy, pleb-sync)
            " https://us-central1-bitcoin-education-archive.cloudfunctions.net" +
            " https://ppq.ai" +                                          // PPQ AI Tools embed
            " https://*.ppq.ai",                                          // PPQ AI subdomains

        "img-src 'self' data: blob: https:",         // Broad: GIF picker, user avatars, YouTube thumbs

        "media-src 'self' blob: https:",             // Audio (Beats), image uploads

        // frame-src: iframes the app legitimately embeds
        // *** ADDING A NEW EMBED? ADD IT HERE TOO or the browser will block it. ***
        // Common sources of breakage: new sponsor/merchant tabs, new game embeds,
        // new third-party widgets. Rule: if it's an <iframe>, it goes in frame-src.
        "frame-src 'self'" +
            " https://www.youtube.com" +
            " https://www.youtube-nocookie.com" +
            " https://challenges.cloudflare.com" +   // Turnstile
            " https://ck121212195.github.io" +       // SAT-ARCADE game
            " https://bitcoin-education-archive.firebaseapp.com" + // Firebase Auth iframe
            " https://auth.bitcoineducation.quest" +             // Custom auth domain (Safari ITP fix)
            " https://accounts.google.com" +          // Google Sign-In popup
            " https://accounts.google.com/gsi/" +    // GIS button iframe
            " https://www.google.com" +          // reCAPTCHA v3 hidden iframe (App Check)
            " https://leo-mattes.com" +           // Pump It! game (Bitcoin Beats tab)
            " https://timechaincalendar.com" +      // Timechain Calendar iframe (dashboard)
            " https://ppq.ai" +                     // AI Tools panel
            " https://*.ppq.ai" +                   // PPQ subdomains
            " https://platform.twitter.com" +       // Embedded tweets
            " https://603btc.com" +                  // Pleb Shop merchant embed
            " https://*.needcreations.workers.dev" + // embed-proxy, noderunners-proxy CF workers
            " https://embed.wavlake.com" +           // Bitcoin Beats: Wavlake player
            " https://lnbeats.com" +                 // Bitcoin Beats: LNbeats player
            " https://player.twitch.tv" +            // Twitch stream embeds
            " https://www.twitch.tv" +               // Twitch (alternate embed origin)
            " https://plebeian.market" +             // Lightning Mart: Plebeian Market
            " https://proofofink.com" +              // Lightning Mart: Proof of Ink
            " https://scarce.city" +                 // Lightning Mart: Scarce City
            " https://shop.conduit.market",          // Lightning Mart: Conduit Market

        "font-src 'self' https://fonts.gstatic.com",

        // accounts.google.com is not a style-src host, so this path is the
        // smallest allow for the GIS button stylesheet. A host source would
        // make the path redundant.
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",

        "object-src 'none'",    // No Flash/plugins
        "base-uri 'self'",      // No <base> tag hijacking
        "form-action 'self'",   // No phishing form submissions
        "worker-src 'self' blob: https://auth.bitcoineducation.quest", // Service worker + audio blob workers
    ].join('; ');
}

/**
 * CSP PHASE 2 (REPORT-ONLY). Same allowlist as buildCSP, but script-src drops
 * 'unsafe-inline' in favour of the per-request nonce and inline event-handler
 * attributes are forbidden (script-src-attr 'none'). Sent as
 * Content-Security-Policy-Report-Only so nothing breaks; violations are POSTed
 * to /csp-report. Flip to enforcing once reports show no remaining inline
 * handlers (see the XSS app-wide report for the migration plan).
 */
function buildCSPReportOnly(nonce) {
    const parts = buildCSP(nonce).split('; ').map((d) => {
        if (d.startsWith('script-src ')) {
            return d.replace("'unsafe-inline'", `'nonce-${nonce}'`);
        }
        return d;
    });
    parts.push("script-src-attr 'none'");
    parts.push('report-uri /csp-report');
    return parts.join('; ');
}

/** Collect CSP violation reports (report-only phase). Logs a trimmed summary, never echoes input. */
async function handleCspReport(request) {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { 'Allow': 'POST' } });
    try {
        const len = Number(request.headers.get('content-length') || 0);
        if (len > 16384) return new Response(null, { status: 413 });
        const raw = (await request.text()).slice(0, 16384);
        const body = JSON.parse(raw || '{}');
        const r = body['csp-report'] || body;
        const pick = (v) => String(v == null ? '' : v).slice(0, 200);
        console.log('csp-report', JSON.stringify({
            directive: pick(r['violated-directive'] || r['effective-directive']),
            blocked: pick(r['blocked-uri']),
            source: pick(r['source-file']),
            line: Number(r['line-number']) || 0,
            sample: pick(r['script-sample']),
        }));
    } catch (_) { /* ignore malformed reports */ }
    return new Response(null, { status: 204 });
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
function applySecurityHeaders(response, nonce, ref) {
    const csp = buildCSP(nonce);

    // Inject nonce into every <script> element (inline blocks AND external src tags).
    // A validated ref is copied onto og:url so link previews keep it.
    const rewritten = new HTMLRewriter()
        .on('script', {
            element(el) {
                // Preserve any existing nonce (e.g. from origin), set ours if absent
                if (!el.getAttribute('nonce')) {
                    el.setAttribute('nonce', nonce);
                }
            }
        })
        .on('meta', {
            element(el) {
                if (!ref) return;
                if (String(el.getAttribute('property') || '') !== 'og:url') return;
                el.setAttribute('content', urlWithRef(el.getAttribute('content') || '', ref));
            }
        })
        .transform(response);

    const headers = new Headers(rewritten.headers);
    headers.set('Content-Security-Policy', csp);
    headers.set('Content-Security-Policy-Report-Only', buildCSPReportOnly(nonce));
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

function renderChannelPage(id, channel, origin, ref) {
    const title = escapeHtml((channel.title || id).replace(/^[^\w]*/, ''));
    const desc  = escapeHtml(channel.desc || 'Bitcoin education channel');
    const cat   = escapeHtml(channel.cat || '');
    const url   = origin + '/channels/' + id;
    const ogUrl = urlWithRef(url, ref);
    const ogImg = origin + '/og-image.png?v=20261024b';

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
    <meta property="og:url" content="${ogUrl}">
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

function renderAppPage(page, origin, ref) {
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
        'timechain-tv':   { title: 'Timechain TV — 24/7 Bitcoin Streaming', desc: '21 channels of 24/7 Bitcoin content. 1,400+ videos curated for maximum orange pill exposure. ⚡📺', image: '/tctv-preview.png' },
        'tv':             { title: 'Timechain TV — 24/7 Bitcoin Streaming', desc: '21 channels of 24/7 Bitcoin content.', image: '/tctv-preview.png' },
    };
    const info  = pages[page] || { title: page, desc: 'Bitcoin Education Archive' };
    const title = escapeHtml(info.title);
    const desc  = escapeHtml(info.desc);
    const url   = origin + '/app/' + page;
    const ogUrl = urlWithRef(url, ref);
    const ogImg = info.image ? (origin + info.image) : (origin + '/og-image.png?v=20261024b');

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
    <meta property="og:url" content="${ogUrl}">
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

// Static per-type achievement previews. A validated ref is copied onto og:url only.
const ACHIEVEMENT_OG = {
    sf_block: { title: "Satoshi's Favor block found", desc: "A Satoshi's Favor block was found on Bitcoin Quest." },
    badge: { title: 'Rare badge on Bitcoin Quest', desc: 'A rare badge was earned on Bitcoin Quest.' },
    cert_scholar: { title: 'Bitcoin Scholar', desc: 'A Bitcoin Scholar certification was earned on Bitcoin Quest.' },
    cert_protocol: { title: 'Protocol Expert', desc: 'A Protocol Expert certification was earned on Bitcoin Quest.' },
    rank: { title: 'Rank up on Bitcoin Quest', desc: 'A notable rank was reached on Bitcoin Quest.' },
    raid: { title: 'Raid boss defeated', desc: 'A raid boss was defeated on Bitcoin Quest.' },
    streak: { title: 'Streak on Bitcoin Quest', desc: 'A streak milestone on Bitcoin Quest.' },
    daily: { title: 'Daily quests done', desc: 'Daily quests were completed on Bitcoin Quest.' },
    xp: { title: 'Bitcoin Quest progress', desc: 'Progress on Bitcoin Quest.' },
    // Generic. The in-app card names a BIP number; this preview does not.
    bip_breakthrough: { title: 'BIP Breakthrough', desc: 'A BIP breakthrough on Bitcoin Quest.' },
};

function ogImageTags(img, alt) {
    const safeImg = escapeHtml(img);
    const safeAlt = escapeHtml(alt);
    return [
        `<meta property="og:image" content="${safeImg}">`,
        `<meta property="og:image:secure_url" content="${safeImg}">`,
        `<meta property="og:image:type" content="image/png">`,
        `<meta property="og:image:width" content="1200">`,
        `<meta property="og:image:height" content="630">`,
        `<meta property="og:image:alt" content="${safeAlt}">`,
        `<meta name="twitter:image" content="${safeImg}">`,
        `<meta name="twitter:image:alt" content="${safeAlt}">`,
    ].join('\n    ');
}

function renderAchievementPage(type, origin, ref) {
    const info = ACHIEVEMENT_OG[type];
    const title = escapeHtml(info.title);
    const desc = escapeHtml(info.desc);
    const url = origin + '/?a=' + encodeURIComponent(type);
    const ogUrl = urlWithRef(url, ref);
    const ogImg = origin + '/og/achievements/' + type + '.png';
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} — Bitcoin Quest</title>
    <meta name="description" content="${desc}">
    <meta name="robots" content="noindex, follow">
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${ogUrl}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    ${ogImageTags(ogImg, info.title)}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${desc}">
    <meta http-equiv="refresh" content="0;url=${url}">
</head>
<body>
    <h1>${title}</h1>
    <p>${desc}</p>
    <p><a href="${url}">Open Bitcoin Quest</a></p>
</body>
</html>`;
}

// Static per-type mini-app preview. og:url keeps card, a validated ref, and
// a validated src. The hash is the type's public landing, not a station,
// track, or anything taken from the query. Refresh keeps the same URL.
function renderMiniappPage(cardId, origin, ref, src) {
    const info = MINIAPP_CARDS[cardId];
    const title = escapeHtml(info.title);
    const desc = escapeHtml(info.description);
    const parts = [];
    if (ref) parts.push('ref=' + encodeURIComponent(ref));
    if (src) parts.push('src=' + encodeURIComponent(src));
    parts.push('card=' + cardId);
    const hash = info.hash ? ('#' + info.hash) : '';
    const pageUrl = origin + '/?' + parts.join('&') + hash;
    const safeUrl = escapeHtml(pageUrl);
    const ogImg = origin + '/og/miniapps/' + cardId + '.' + MINIAPP_CARD_VERSION + '.png';
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${desc}">
    <meta name="robots" content="noindex, follow">
    <link rel="canonical" href="${safeUrl}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${safeUrl}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    ${ogImageTags(ogImg, info.sentence || info.description)}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${desc}">
    <meta http-equiv="refresh" content="0;url=${safeUrl}">
</head>
<body>
    <h1>${title}</h1>
    <p>${desc}</p>
    <p><a href="${safeUrl}">Open Bitcoin Quest</a></p>
</body>
</html>`;
}

function botHtmlResponse(body, nonce, method, extraHeaders) {
    const headers = botPageHeaders(nonce, extraHeaders || {});
    if (method === 'HEAD') return new Response(null, { status: 200, headers });
    return new Response(body, { status: 200, headers });
}

// ─── Cloudflare Pages origin ─────────────────────────────────────────────────
// Isolated from referral handling. Matches live seo-router 591bd32b:
// strip GitHub-style .html paths, fetch Pages directly, follow same-origin
// .html redirects, and rewrite other Pages redirects back to this host.

function pagesPath(path) {
    if (path.endsWith('/index.html')) return path.slice(0, -10);
    if (path.endsWith('.html')) return path.slice(0, -5);
    return path;
}

async function fetchOrigin(request, url) {
    const target = PAGES_ORIGIN + pagesPath(url.pathname) + url.search;
    let resp = await fetch(new Request(target, request), { redirect: 'manual' });
    for (let i = 0; i < 3 && resp.status >= 300 && resp.status < 400; i++) {
        const loc = resp.headers.get('location');
        if (!loc) break;
        const next = new URL(loc, target);
        if (next.origin !== PAGES_ORIGIN) break;
        if (url.pathname.endsWith('.html')) {
            resp = await fetch(new Request(next.toString(), request), { redirect: 'manual' });
            continue;
        }
        const headers = new Headers(resp.headers);
        headers.set('location', url.origin + next.pathname + next.search + next.hash);
        headers.delete('x-robots-tag');
        return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
    }
    const headers = new Headers(resp.headers);
    headers.delete('x-robots-tag');
    return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default {
    async fetch(request) {
        const url    = new URL(request.url);
        const httpsTarget = httpsRedirectTarget(request.url);
        if (httpsTarget) return Response.redirect(httpsTarget, 301);
        const path   = url.pathname;
        const ua     = request.headers.get('user-agent') || '';
        const origin = getOrigin(request);
        const ref = validatedReferralRef(url.search);

        // Generate a fresh nonce for every request
        const nonce = generateNonce();

        // CSP Phase 2 report-only collector
        if (path === '/csp-report') return handleCspReport(request);

        // /channels/{id}
        const channelMatch = path.match(/^\/channels\/([a-zA-Z0-9_-]+)\/?$/);
        if (channelMatch) {
            const id = channelMatch[1];
            if (isBot(ua)) {
                const channels = await getChannelIndex();
                if (channels && channels[id]) {
                    return new Response(renderChannelPage(id, channels[id], origin, ref), {
                        headers: botPageHeaders(nonce),
                    });
                }
            }
            return Response.redirect(spaRedirectTarget(id, url.search), 302);
        }

        // /app/{page}
        const appMatch = path.match(/^\/app\/([a-zA-Z0-9_-]+)\/?$/);
        if (appMatch) {
            const page = appMatch[1];
            if (isBot(ua)) {
                return new Response(renderAppPage(page, origin, ref), {
                    headers: botPageHeaders(nonce),
                });
            }
            return Response.redirect(spaRedirectTarget(page, url.search), 302);
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
                return new Response(renderAppPage(aliasPage, origin, ref), {
                    headers: botPageHeaders(nonce),
                });
            }
            return Response.redirect(spaRedirectTarget(aliasPage, url.search), 302);
        }

        // Firebase proxy: /__/auth/* and /__/firebase/* → bitcoin-education-archive.firebaseapp.com
        // /__/firebase/pat is the App Check token endpoint — must be proxied same as auth
        if (path.startsWith('/__/firebase/')) {
            const targetUrl = 'https://bitcoin-education-archive.firebaseapp.com' + path + url.search;
            try {
                const proxyResp = await fetch(targetUrl, {
                    method: request.method,
                    headers: request.headers,
                    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
                    redirect: 'follow',
                });
                const headers = new Headers(proxyResp.headers);
                headers.set('Access-Control-Allow-Origin', origin);
                headers.set('Access-Control-Allow-Credentials', 'true');
                return new Response(proxyResp.body, { status: proxyResp.status, statusText: proxyResp.statusText, headers });
            } catch(e) {
                return new Response('Firebase proxy error', { status: 502 });
            }
        }

        // Firebase Auth proxy: /__/auth/* → bitcoin-education-archive.firebaseapp.com
        // authDomain is set to "bitcoineducation.quest" so Firebase's auth iframe and handler
        // stay same-origin with the app. Without this, iOS ITP and Android cookie partitioning
        // block the cross-origin postMessage from the auth iframe, killing session restore.
        if (path.startsWith('/__/auth/')) {
            const targetUrl = 'https://bitcoin-education-archive.firebaseapp.com' + path + url.search;
            try {
                const proxyResp = await fetch(targetUrl, {
                    method: request.method,
                    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
                    redirect: 'follow',
                });
                const headers = new Headers(proxyResp.headers);
                // Allow iframe embedding (needed for /__/auth/iframe silent restore)
                headers.delete('x-frame-options');
                // Strip Firebase's own CSP that could block our origin's postMessage
                headers.delete('content-security-policy');
                // Allow cross-origin for postMessage back to this origin
                headers.set('Access-Control-Allow-Origin', origin);
                headers.set('Access-Control-Allow-Credentials', 'true');
                return new Response(proxyResp.body, {
                    status: proxyResp.status,
                    statusText: proxyResp.statusText,
                    headers,
                });
            } catch(e) {
                return new Response('Auth proxy error', { status: 502 });
            }
        }

        // Bots requesting a known achievement or mini-app card get a static
        // preview. Humans fall through so the app can read ?ref=, ?src=, and
        // the hash. A known achievement wins when a and card are both set.
        // Card HTML is not cached: Vary is not treated as edge isolation, and
        // a ref-bearing body must not be stored under a ref-less key.
        if ((path === '/' || path === '/index.html') && (request.method === 'GET' || request.method === 'HEAD') && isBot(ua)) {
            const ach = url.searchParams.get('a');
            const achKnown = !!(ach && Object.prototype.hasOwnProperty.call(ACHIEVEMENT_OG, ach));
            const cardId = validatedCardId(url.search);
            const cardInfo = cardId && Object.prototype.hasOwnProperty.call(MINIAPP_CARDS, cardId) ? MINIAPP_CARDS[cardId] : null;
            if (achKnown) {
                return botHtmlResponse(renderAchievementPage(ach, origin, ref), nonce, request.method, { 'Vary': 'User-Agent' });
            }
            if (cardInfo) {
                return botHtmlResponse(renderMiniappPage(cardId, origin, ref, validatedSrc(url.search)), nonce, request.method, {
                    'Vary': 'User-Agent',
                    'Cache-Control': 'private, no-store',
                    'CDN-Cache-Control': 'no-store',
                });
            }
        }

        // Pass-through: fetch from Cloudflare Pages, inject security headers + nonce into HTML
        const resp = await fetchOrigin(request, url);
        const ct   = resp.headers.get('content-type') || '';
        if (ct.includes('text/html')) {
            return applySecurityHeaders(resp, nonce, ref);
        }
        return resp;
    },
};
