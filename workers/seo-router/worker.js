/**
 * SEO Router Worker for Bitcoin Education Archive
 * 
 * Routes:
 *   /channels/{id} → serves pre-rendered HTML for bots, SPA for humans
 *   /app/{page}    → serves pre-rendered HTML for bots, SPA for humans
 *   Everything else → passes through to origin (GitHub Pages)
 * 
 * Domains: bitcoineducation.quest, btcedu.app, btcedu.quest
 */

// Bot user-agent patterns
const BOT_UA = /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebot|facebookexternalhit|twitterbot|linkedinbot|telegrambot|discordbot|whatsapp|ia_archiver|archive\.org_bot|applebot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|rogerbot|sogou|exabot|swiftbot/i;

// Channel data URL base
const ORIGIN = 'https://bitcoineducation.quest';
const CHANNEL_INDEX_URL = ORIGIN + '/channel_index.js';

// Cache channel index for 1 hour
let channelCache = null;
let channelCacheTs = 0;

async function getChannelIndex() {
    if (channelCache && Date.now() - channelCacheTs < 3600000) return channelCache;
    try {
        const res = await fetch(CHANNEL_INDEX_URL);
        const text = await res.text();
        // Parse: var CHANNELS = {...};
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

// Generate pre-rendered HTML for a channel
function renderChannelPage(id, channel) {
    const title = escapeHtml((channel.title || id).replace(/^[^\w]*/, ''));
    const desc = escapeHtml(channel.desc || 'Bitcoin education channel');
    const cat = escapeHtml(channel.cat || '');
    const url = ORIGIN + '/channels/' + id;
    const ogImage = ORIGIN + '/og-image.png';

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
    <meta property="og:image" content="${ogImage}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title} — Bitcoin Education Archive">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${ogImage}">
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Article",
        "name": "${title}",
        "description": "${desc}",
        "url": "${url}",
        "publisher": {"@type": "Organization", "name": "603BTC LLC", "url": "https://603btc.com"},
        "isPartOf": {"@type": "WebSite", "name": "Bitcoin Education Archive", "url": "${ORIGIN}"}
    }
    </script>
    <meta http-equiv="refresh" content="0;url=${ORIGIN}/#${id}">
</head>
<body>
    <h1>${title}</h1>
    <p>Category: ${cat}</p>
    <p>${desc}</p>
    <p><a href="${ORIGIN}/#${id}">Open in Bitcoin Education Archive →</a></p>
    <p><a href="${ORIGIN}">← Back to all channels</a></p>
    <p>Bitcoin Education Archive — 146 channels of free, curated Bitcoin education.</p>
</body>
</html>`;
}

// Generate pre-rendered HTML for an app page
function renderAppPage(page) {
    const pages = {
        'forum': { title: 'PlebTalk Forum', desc: 'Discuss Bitcoin with the community. Post, reply, upvote, and earn points.' },
        'marketplace': { title: 'Lightning Mart', desc: 'Buy and sell with Bitcoin Lightning. Community marketplace for Bitcoiners.' },
        'bitcoin-beats': { title: 'Bitcoin Beats', desc: 'Listen to Bitcoin-themed music, upload tracks, and DJ for the community.' },
        'irl-sync': { title: 'IRL Sync', desc: 'Find and organize Bitcoin meetups near you. Connect with Bitcoiners in real life.' },
        'chat': { title: 'Global Chat', desc: 'Real-time chat with Bitcoiners. Send messages, GIFs, and listen to community radio.' },
        'pvp': { title: 'PVP Bitcoin Trivia', desc: '1v1 Bitcoin trivia battles. Test your knowledge against other Bitcoiners.' },
        'trails': { title: "Nacho's Trails", desc: 'Guided Bitcoin learning modules. Beginner to advanced with exams and certificates.' },
        'nacho': { title: 'Nacho Mode', desc: 'AI-powered Bitcoin tutor. Ask any question and get instant, accurate answers.' },
        'bitcoin-dashboard': { title: 'Bitcoin Dashboard', desc: 'Live Bitcoin price, block height, mempool, hashrate, fees, and network stats.' },
        'lightning': { title: 'Lightning Wallet', desc: 'Connect your Lightning wallet for instant Bitcoin payments and tips.' },
        'first-purchase': { title: 'How to Buy Bitcoin', desc: 'Step-by-step guide to buying your first Bitcoin safely and securely.' },
        'dms': { title: 'Direct Messages', desc: 'Private messaging between Bitcoiners on the Bitcoin Education Archive.' }
    };
    const info = pages[page] || { title: page, desc: 'Bitcoin Education Archive' };
    const title = escapeHtml(info.title);
    const desc = escapeHtml(info.desc);
    const url = ORIGIN + '/app/' + page;
    const ogImage = ORIGIN + '/og-image.png';

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
    <meta property="og:image" content="${ogImage}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title} — Bitcoin Education Archive">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${ogImage}">
    <meta http-equiv="refresh" content="0;url=${ORIGIN}/#${page}">
</head>
<body>
    <h1>${title}</h1>
    <p>${desc}</p>
    <p><a href="${ORIGIN}/#${page}">Open ${title} →</a></p>
    <p><a href="${ORIGIN}">← Back to Bitcoin Education Archive</a></p>
</body>
</html>`;
}

export default {
    async fetch(request) {
        const url = new URL(request.url);
        const path = url.pathname;
        const ua = request.headers.get('user-agent') || '';

        // /channels/{id}
        const channelMatch = path.match(/^\/channels\/([a-zA-Z0-9_-]+)\/?$/);
        if (channelMatch) {
            const id = channelMatch[1];

            // For bots: serve pre-rendered HTML
            if (isBot(ua)) {
                const channels = await getChannelIndex();
                if (channels && channels[id]) {
                    return new Response(renderChannelPage(id, channels[id]), {
                        headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=86400' }
                    });
                }
            }

            // For humans: redirect to SPA with hash route
            return Response.redirect(ORIGIN + '/#' + id, 302);
        }

        // /app/{page}
        const appMatch = path.match(/^\/app\/([a-zA-Z0-9_-]+)\/?$/);
        if (appMatch) {
            const page = appMatch[1];

            if (isBot(ua)) {
                return new Response(renderAppPage(page), {
                    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=86400' }
                });
            }

            return Response.redirect(ORIGIN + '/#' + page, 302);
        }

        // Everything else: pass through to origin
        return fetch(request);
    }
};
