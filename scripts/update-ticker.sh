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

async function main() {
    const headlines = [];
    const badWords = /ethereum|eth\b|solana|cardano|altcoin|shitcoin|dogecoin|xrp|ripple|nft\b|defi\b|web3|meme.?coin|pepeto|pepe\b|doge\b|shib/i;
    const mustHaveBtc = /bitcoin|btc|\bbtc\b|satoshi|sats\b|halving|lightning.?network|hash.?rate|block.?height|miner|mining|nakamoto/i;

    // Source 1: Google News RSS — Bitcoin headlines
    try {
        const xml = await fetch('https://news.google.com/rss/search?q=bitcoin&hl=en-US&gl=US&ceid=US:en');
        const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
        for (const item of items.slice(0, 15)) {
            const titleMatch = item.match(/<title>([^<]+)<\/title>/);
            const dateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/);
            const linkMatch = item.match(/<link>([^<]+)<\/link>/);
            if (!titleMatch) continue;
            let title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
            // Extract source from " - Source Name" at end
            const sourceParts = title.match(/^(.+?)\s*-\s*([^-]+)$/);
            if (sourceParts) title = sourceParts[1].trim();
            // Filter: must be Bitcoin-related, no altcoins
            if (badWords.test(title)) continue;
            if (!mustHaveBtc.test(title)) continue;
            // Skip very short titles
            if (title.length < 20) continue;
            const pubDate = dateMatch ? new Date(dateMatch[1]) : new Date();
            headlines.push({
                date: pubDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                title: title,
                snippet: sourceParts ? sourceParts[2].trim() : '',
                link: linkMatch ? linkMatch[1] : '',
                source: 'googlenews',
                timestamp: pubDate.getTime()
            });
        }
        console.log('[Ticker] Got ' + headlines.length + ' Bitcoin headlines from Google News');
    } catch(e) {
        console.error('[Ticker] Google News failed:', e.message);
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
