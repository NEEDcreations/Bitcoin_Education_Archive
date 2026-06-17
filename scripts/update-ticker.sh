#!/bin/bash
# Scrapes Google News RSS (Bitcoin) + Luke Mikic YouTube RSS for fresh ticker headlines
# Updates newsletter-data.json with top 3 recent Bitcoin-only signals
# Run via cron every 4 hours

cd /root/simple-archive || exit 1

node << 'EOF'
const https = require('https');
const http = require('http');
const fs = require('fs');

function fetch(url) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' }, timeout: 15000 }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetch(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
    });
}

// Follow redirects to get the real destination URL (HEAD-only, no body)
function resolveRedirect(url, depth) {
    if (!url || depth > 5) return Promise.resolve(url);
    return new Promise((resolve) => {
        try {
            const mod = url.startsWith('https') ? https : http;
            const req = mod.request(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' }, timeout: 8000 }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
                    resolve(resolveRedirect(next, depth + 1));
                } else {
                    resolve(url);
                }
            });
            req.on('error', () => resolve(url));
            req.on('timeout', () => { req.destroy(); resolve(url); });
            req.end();
        } catch(e) { resolve(url); }
    });
}

async function main() {
    const headlines = [];
    const badWords = /ethereum|eth\b|solana|cardano|altcoin|shitcoin|dogecoin|xrp|ripple|nft\b|defi\b|web3|meme.?coin|pepeto|pepe\b|doge\b|shib/i;
    const mustHaveBtc = /bitcoin|btc|\bbtc\b|satoshi|sats\b|halving|lightning.?network|hash.?rate|block.?height|miner|mining|nakamoto/i;

    // Source 1: Direct Bitcoin publication RSS feeds (real article URLs, no redirects)
    const directFeeds = [
        { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk' },
        { url: 'https://bitcoinmagazine.com/feed', name: 'Bitcoin Magazine' },
        { url: 'https://www.theblock.co/rss.xml', name: 'The Block' },
        { url: 'https://cointelegraph.com/rss/tag/bitcoin', name: 'Cointelegraph' },
    ];
    for (const feed of directFeeds) {
        try {
            const xml = await fetch(feed.url);
            const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
            for (const item of items.slice(0, 8)) {
                const titleMatch = item.match(/<title>([^<]+|<!\[CDATA\[[^\]]+\]\]>)<\/title>/);
                const dateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/);
                // Prefer <link> before <guid> — for most feeds <link> is the real URL
                const linkMatch = item.match(/<link>(?:<!\[CDATA\[)?([^<\]]+)(?:\]\]>)?<\/link>/) ||
                                  item.match(/<guid[^>]*isPermaLink=["']true["'][^>]*>([^<]+)<\/guid>/);
                if (!titleMatch || !linkMatch) continue;
                let title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
                const link = linkMatch[1].trim();
                // Skip Google News redirect links that slipped through
                if (link.includes('news.google.com')) continue;
                if (badWords.test(title)) continue;
                if (!mustHaveBtc.test(title)) continue;
                if (title.length < 20) continue;
                const pubDate = dateMatch ? new Date(dateMatch[1]) : new Date();
                headlines.push({
                    date: pubDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    title: title,
                    snippet: feed.name,
                    link: link,
                    source: feed.name.toLowerCase().replace(/ /g,'-'),
                    timestamp: pubDate.getTime()
                });
            }
            console.log('[Ticker] Got ' + headlines.length + ' headlines so far after ' + feed.name);
        } catch(e) {
            console.error('[Ticker] ' + feed.name + ' RSS failed:', e.message);
        }
        if (headlines.length >= 6) break; // enough sources, stop fetching
    }

    // Source 2: Luke Mikic YouTube RSS — Bitcoin/macro content only
    try {
        const xml = await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=UCCiI5nrZ3uQ0PsmjbhsMLgw');
        const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
        const lukeKeywords = /bitcoin|btc|satoshi|sats|halving|mining|lightning|hodl|hash.?rate|currency.?reset|money.?print|inflation|fed\b|dollar|fiat|macro|reserve|treasury|debt|gold|silver/i;
        let lukeCount = 0;
        for (const entry of entries.slice(0, 10)) {
            const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
            const dateMatch = entry.match(/<published>([^<]+)<\/published>/);
            const linkMatch = entry.match(/<link[^>]*href="([^"]+)"/);
            if (!titleMatch) continue;
            const title = titleMatch[1].replace(/⚠️/g, '').trim();
            if (badWords.test(title)) continue;
            if (!lukeKeywords.test(title)) continue;
            if (title.length < 15) continue;
            const pubDate = dateMatch ? new Date(dateMatch[1]) : new Date();
            headlines.push({
                date: pubDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                title: title,
                snippet: 'Luke Mikic',
                link: linkMatch ? linkMatch[1] : 'https://youtube.com/@LukeMikic21',
                source: 'lukemikic',
                timestamp: pubDate.getTime()
            });
            lukeCount++;
            if (lukeCount >= 3) break;
        }
        console.log('[Ticker] Got ' + lukeCount + ' from Luke Mikic');
    } catch(e) {
        console.error('[Ticker] Luke Mikic RSS failed:', e.message);
    }

    if (headlines.length === 0) {
        console.log('[Ticker] No headlines found, keeping existing file');
        return;
    }

    // Sort by timestamp (most recent first) and take top 3
    headlines.sort((a, b) => b.timestamp - a.timestamp);
    const top3 = headlines.slice(0, 3);

    // Sanity check: drop any Google News redirect links that slipped through
    for (let i = 0; i < top3.length; i++) {
        if (top3[i].link && top3[i].link.includes('news.google.com')) {
            top3[i].link = ''; // blank it; card will render without link
        }
    }

    const output = {
        updated: new Date().toISOString(),
        news: top3.map(h => ({
            date: h.date,
            title: h.title,
            snippet: h.snippet || '',
            link: h.link,
            source: h.source
        }))
    };

    fs.writeFileSync('newsletter-data.json', JSON.stringify(output, null, 2) + '\n');
    console.log('[Ticker] Updated newsletter-data.json:');
    top3.forEach((h, i) => console.log('  SIGNAL #' + (i+1) + ': ' + h.title + ' [' + h.source + ']'));
}

main().catch(e => console.error('[Ticker] Fatal:', e));
EOF
