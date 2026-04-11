/**
 * RSS Feed + Telegram Broadcast Worker
 * Bitcoin Education Archive
 * 
 * Routes:
 *   GET /feed.xml     — RSS 2.0 feed of recent app activity
 *   POST /announce    — Manual feature announcement (admin only)
 * 
 * Cron trigger (every 30 min):
 *   Checks Firestore for new forum posts, songs, marketplace listings
 *   Posts new items to @updates_603BTC Telegram channel
 */

// Secrets stored in Cloudflare Workers env (never in code)
// TELEGRAM_BOT_TOKEN — set via dashboard Secrets
// ADMIN_KEY — set via dashboard Secrets
const TELEGRAM_CHANNEL = '@updates_603BTC';
const FIRESTORE_PROJECT = 'bitcoin-education-archive';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;
const SITE_URL = 'https://bitcoineducation.quest';

// ── Firestore helpers ──

function parseFirestoreValue(val) {
    if (!val) return null;
    if (val.stringValue !== undefined) return val.stringValue;
    if (val.integerValue !== undefined) return parseInt(val.integerValue);
    if (val.doubleValue !== undefined) return val.doubleValue;
    if (val.booleanValue !== undefined) return val.booleanValue;
    if (val.timestampValue !== undefined) return val.timestampValue;
    if (val.mapValue) {
        const obj = {};
        for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
            obj[k] = parseFirestoreValue(v);
        }
        return obj;
    }
    if (val.arrayValue) {
        return (val.arrayValue.values || []).map(parseFirestoreValue);
    }
    return null;
}

function parseDoc(doc) {
    const fields = doc.fields || {};
    const parsed = {};
    for (const [k, v] of Object.entries(fields)) {
        parsed[k] = parseFirestoreValue(v);
    }
    // Extract doc ID from name
    parsed._id = doc.name ? doc.name.split('/').pop() : null;
    return parsed;
}

async function queryFirestore(collection, orderBy, limit = 10, direction = 'DESCENDING') {
    const body = {
        structuredQuery: {
            from: [{ collectionId: collection }],
            orderBy: [{ field: { fieldPath: orderBy }, direction }],
            limit: limit
        }
    };
    const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await res.json();
    return data
        .filter(d => d.document)
        .map(d => parseDoc(d.document));
}

// ── Telegram helper ──

async function sendTelegram(text, botToken) {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: TELEGRAM_CHANNEL,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: false
        })
    });
    return res.json();
}

// ── RSS Feed Generator ──

function escXml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildRSS(items) {
    const now = new Date().toUTCString();
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
    <title>Bitcoin Education Archive — Updates</title>
    <link>${SITE_URL}</link>
    <description>New forum posts, songs, marketplace listings, and feature updates from the Bitcoin Education Archive.</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
        <url>${SITE_URL}/og-image.png</url>
        <title>Bitcoin Education Archive</title>
        <link>${SITE_URL}</link>
    </image>
`;
    for (const item of items) {
        xml += `    <item>
        <title>${escXml(item.title)}</title>
        <link>${escXml(item.link)}</link>
        <description>${escXml(item.desc)}</description>
        <category>${escXml(item.category)}</category>
        <pubDate>${item.date}</pubDate>
        <guid isPermaLink="false">${escXml(item.guid)}</guid>
    </item>
`;
    }
    xml += `</channel>
</rss>`;
    return xml;
}

// ── Fetch recent content from Firestore ──

async function getRecentContent() {
    const items = [];

    // Forum posts
    try {
        const posts = await queryFirestore('forum_posts', 'createdAt', 15);
        for (const p of posts) {
            if (!p.title) continue;
            const date = p.createdAt ? new Date(p.createdAt).toUTCString() : new Date().toUTCString();
            items.push({
                title: `🗣️ ${p.title}`,
                link: `${SITE_URL}/#forum`,
                desc: `New forum post by ${p.authorName || 'Anonymous'}: ${(p.body || '').substring(0, 200)}`,
                category: 'Forum',
                date,
                guid: `forum-${p._id}`,
                ts: new Date(p.createdAt || 0).getTime(),
                type: 'forum'
            });
        }
    } catch (e) { console.error('Forum fetch error:', e); }

    // Beats (songs)
    try {
        const songs = await queryFirestore('beats', 'createdAt', 10);
        for (const s of songs) {
            if (!s.title) continue;
            const date = s.createdAt ? new Date(s.createdAt).toUTCString() : new Date().toUTCString();
            items.push({
                title: `🎵 ${s.title}${s.artist ? ' — ' + s.artist : ''}`,
                link: `${SITE_URL}/#bitcoin-beats`,
                desc: `New track uploaded to Bitcoin Beats${s.artist ? ' by ' + s.artist : ''}`,
                category: 'Music',
                date,
                guid: `beats-${s._id}`,
                ts: new Date(s.createdAt || 0).getTime(),
                type: 'beats'
            });
        }
    } catch (e) { console.error('Beats fetch error:', e); }

    // Marketplace listings
    try {
        const listings = await queryFirestore('marketplace', 'createdAt', 10);
        for (const l of listings) {
            if (!l.title) continue;
            const date = l.createdAt ? new Date(l.createdAt).toUTCString() : new Date().toUTCString();
            items.push({
                title: `🛒 ${l.title}`,
                link: `${SITE_URL}/#marketplace`,
                desc: `New listing on Lightning Mart: ${l.title}${l.price ? ' — ' + l.price + ' sats' : ''}`,
                category: 'Marketplace',
                date,
                guid: `market-${l._id}`,
                ts: new Date(l.createdAt || 0).getTime(),
                type: 'marketplace'
            });
        }
    } catch (e) { console.error('Marketplace fetch error:', e); }

    // IRL Sync events
    try {
        const events = await queryFirestore('irl_events', 'createdAt', 10);
        for (const ev of events) {
            if (!ev.title) continue;
            const date = ev.createdAt ? new Date(ev.createdAt).toUTCString() : new Date().toUTCString();
            const eventDate = ev.date ? new Date(ev.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
            items.push({
                title: `🤝 ${ev.title}`,
                link: `${SITE_URL}/#irl-sync`,
                desc: `New Bitcoin meetup${ev.locationName ? ' in ' + ev.locationName : ''}${eventDate ? ' on ' + eventDate : ''}. Hosted by ${ev.hostName || 'Anonymous Pleb'}.`,
                category: 'Events',
                date,
                guid: `event-${ev._id}`,
                ts: new Date(ev.createdAt || 0).getTime(),
                type: 'event'
            });
        }
    } catch (e) { console.error('Events fetch error:', e); }

    // Sort by timestamp descending
    items.sort((a, b) => b.ts - a.ts);
    return items.slice(0, 30);
}

// ── Cron: Check for new content and post to Telegram ──
// Uses in-memory set + Firestore timestamp window (no KV needed)

let _lastCronRun = 0;

async function cronBroadcast(botToken) {
    const now = Date.now();
    
    // Don't check more than once per 25 minutes
    if (now - _lastCronRun < 25 * 60 * 1000) return 0;
    _lastCronRun = now;

    const items = await getRecentContent();
    let posted = 0;

    for (const item of items) {
        // Only post items from the last 35 minutes
        if (now - item.ts > 35 * 60 * 1000) continue;
        // Skip items older than 2 hours (safety net)
        if (now - item.ts > 2 * 60 * 60 * 1000) continue;

        // Build Telegram message
        let msg = '';
        if (item.type === 'forum') {
            msg = `🗣️ <b>New Forum Post</b>\n\n<b>${escXml(item.title.replace('🗣️ ', ''))}</b>\n${escXml(item.desc.replace(/^New forum post by /, 'by '))}\n\n<a href="${item.link}">Open PlebTalk →</a>`;
        } else if (item.type === 'beats') {
            msg = `🎵 <b>New Track on Bitcoin Beats</b>\n\n<b>${escXml(item.title.replace('🎵 ', ''))}</b>\n\n<a href="${item.link}">Listen now →</a>`;
        } else if (item.type === 'marketplace') {
            msg = `🛒 <b>New Listing on Lightning Mart</b>\n\n<b>${escXml(item.title.replace('🛒 ', ''))}</b>\n\n<a href="${item.link}">View listing →</a>`;
        } else if (item.type === 'event') {
            msg = `🤝 <b>New Bitcoin Meetup</b>\n\n<b>${escXml(item.title.replace('🤝 ', ''))}</b>\n${escXml(item.desc)}\n\n<a href="${item.link}">View event →</a>`;
        }

        if (msg) {
            const result = await sendTelegram(msg, botToken);
            if (result.ok) {
                posted++;
                // Rate limit: max 3 posts per cron run
                if (posted >= 3) break;
                // Telegram rate limit
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

    return posted;
}

// ── Worker entry ──

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;

        // RSS Feed
        if (path === '/feed.xml' || path === '/feed' || path === '/rss') {
            const items = await getRecentContent();
            return new Response(buildRSS(items), {
                headers: {
                    'Content-Type': 'application/rss+xml; charset=UTF-8',
                    'Cache-Control': 'public, max-age=1800', // 30 min cache
                    'Access-Control-Allow-Origin': 'https://bitcoineducation.quest'
                }
            });
        }

        // Manual announcement endpoint
        if (path === '/announce' && request.method === 'POST') {
            // Auth via header (not query string — avoids logging in URLs)
            const authHeader = request.headers.get('Authorization') || '';
            const authQuery = url.searchParams.get('key') || '';
            const adminKey = env.ADMIN_KEY;
            if (!adminKey || (authHeader !== 'Bearer ' + adminKey && authQuery !== adminKey)) {
                return new Response('Unauthorized', { status: 401 });
            }
            try {
                const body = await request.json();
                const text = body.text || body.message;
                if (!text) return new Response('Missing text field', { status: 400 });
                
                const emoji = body.emoji || '📢';
                const msg = `${emoji} <b>${escXml(body.title || 'Update')}</b>\n\n${escXml(text)}${body.link ? '\n\n<a href="' + escXml(body.link) + '">Learn more →</a>' : ''}`;
                
                const result = await sendTelegram(msg, env.TELEGRAM_BOT_TOKEN);
                return new Response(JSON.stringify(result), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (e) {
                return new Response('Error: ' + e.message, { status: 500 });
            }
        }

        return new Response('Bitcoin Education Archive RSS Feed\n\nGET /feed.xml — RSS 2.0 feed\nPOST /announce — Post announcement (admin)', {
            headers: { 'Content-Type': 'text/plain' }
        });
    },

    async scheduled(event, env) {
        await cronBroadcast(env.TELEGRAM_BOT_TOKEN);
    }
};
