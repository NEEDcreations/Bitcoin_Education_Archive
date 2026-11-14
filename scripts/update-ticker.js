#!/usr/bin/env node
// Refresh newsletter-data.json with the top 3 recent Bitcoin Signal headlines.
// Scheduled every 4 hours by .github/workflows/update-ticker.yml
// No API keys. Sources are public RSS / YouTube Atom feeds only.

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const MAX_AGE_DAYS = 14;
const RELAXED_AGE_DAYS = [21, 30];
const TOP_N = 3;
const PER_FEED_LIMIT = 40;
const REQUEST_TIMEOUT_MS = 15000;
const USER_AGENT = 'BitcoinQuestTicker/1.0 (+https://bitcoineducation.quest)';

// Alt/shitcoin terms that disqualify a headline even on Bitcoin-native sources.
const BAD_WORDS = /ethereum|eth\b|solana|cardano|altcoin|shitcoin|dogecoin|xrp\b|ripple|nft\b|defi\b|web3|meme.?coin|pepeto|pepe\b|doge\b|shib\b|avalanche|polkadot|chainlink|polygon\b|binance.?coin|\bbnb\b|litecoin|\bltc\b|tron\b|\bada\b/i;

// Required on general news / mixed podcasts so the ticker stays Bitcoin-only.
const MUST_HAVE_BTC = /bitcoin|\bbtc\b|satoshi|\bsats\b|halving|lightning.?network|hash.?rate|block.?height|\bminer|\bmining|nakamoto|secp256k1|utxo|coinjoin|bitcoiner|optech/i;

// Broader allow-list used only for Luke Mikic, matching the original ticker.
const LUKE_KEYWORDS = /bitcoin|\bbtc\b|satoshi|\bsats\b|halving|\bmining|lightning|hodl|hash.?rate|currency.?reset|money.?print|inflation|\bfed\b|dollar|\bfiat\b|macro|reserve|treasury|\bdebt\b|\bgold\b|\bsilver\b/i;

// Existing feeds plus verified Bitcoin-focused additions. `native` sources
// already publish only Bitcoin (or Bitcoin-adjacent technical) content, so a
// title does not need the word "Bitcoin". Mixed outlets still must.
const SOURCES = [
    // Existing
    { id: 'coindesk', name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', native: false },
    { id: 'bitcoin-magazine', name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/feed', native: true },
    { id: 'the-block', name: 'The Block', url: 'https://www.theblock.co/rss.xml', native: false },
    { id: 'cointelegraph', name: 'Cointelegraph', url: 'https://cointelegraph.com/rss/tag/bitcoin', native: false },
    { id: 'lukemikic', name: 'Luke Mikic', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCCiI5nrZ3uQ0PsmjbhsMLgw', native: false, keywords: LUKE_KEYWORDS },
    // Added: technical, education, podcasts
    { id: 'bitcoin-optech', name: 'Bitcoin Optech', url: 'https://bitcoinops.org/feed.xml', native: true },
    { id: 'bitcoin-core', name: 'Bitcoin Core', url: 'https://bitcoincore.org/en/rss.xml', native: true },
    { id: 'delving-bitcoin', name: 'Delving Bitcoin', url: 'https://delvingbitcoin.org/latest.rss', native: true },
    { id: 'casa', name: 'Casa', url: 'https://blog.casa.io/rss/', native: true },
    { id: 'btc-sessions', name: 'BTC Sessions', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UChzLnWVsl3puKQwc5PoO6Zg', native: true },
    { id: 'tftc', name: 'TFTC', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCtdbWsnfA08KhSUO4amVLaQ', native: false },
    { id: 'stephan-livera', name: 'Stephan Livera', url: 'https://anchor.fm/s/7d083a4/podcast/rss', native: false },
    { id: 'jameson-lopp', name: 'Jameson Lopp', url: 'https://blog.lopp.net/rss/', native: true },
    { id: 'brink', name: 'Brink', url: 'https://brink.dev/feed.xml', native: true },
    { id: 'natalie-brunell', name: 'Natalie Brunell', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCru3nlhzHrbgK21x0MdB_eg', native: false },
    { id: 'what-bitcoin-did', name: 'What Bitcoin Did', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCtvg5cXLY_tHDJeBoRySBtg', native: false },
    // Trusted Bitcoin source (Odell). Canonical RSS; item titles are digest
    // stamps, so stories are expanded from the body. Native: keep items even
    // when a title omits the word Bitcoin, but still drop altcoin titles.
    { id: 'citadel-wire', name: 'Citadel Wire', url: 'https://citadelwire.com/feed.xml', native: true, expand: 'citadelwire' }
];

function decodeEntities(str) {
    if (!str) return '';
    return String(str)
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeChar(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function safeChar(code) {
    if (!code || code < 32 && code !== 9 && code !== 10 && code !== 13) return '';
    try { return String.fromCodePoint(code); } catch (e) { return ''; }
}

function firstMatch(xml, patterns) {
    for (let i = 0; i < patterns.length; i++) {
        const m = xml.match(patterns[i]);
        if (m) return m[1];
    }
    return '';
}

function parseFeed(xml) {
    if (!xml || typeof xml !== 'string') return [];
    const chunks = xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/g) || [];
    return chunks.map(function(chunk) {
        const titleRaw = firstMatch(chunk, [
            /<title[^>]*>([\s\S]*?)<\/title>/i
        ]);
        const dateRaw = firstMatch(chunk, [
            /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i,
            /<published[^>]*>([\s\S]*?)<\/published>/i,
            /<updated[^>]*>([\s\S]*?)<\/updated>/i,
            /<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i
        ]);
        const linkRaw = firstMatch(chunk, [
            /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i,
            /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["'][^>]*\/?>/i,
            /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i,
            /<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i,
            /<guid[^>]*isPermaLink=["']true["'][^>]*>([\s\S]*?)<\/guid>/i,
            /<id[^>]*>([\s\S]*?)<\/id>/i
        ]);
        const title = decodeEntities(titleRaw);
        const link = decodeEntities(linkRaw).trim();
        const timestamp = dateRaw ? Date.parse(decodeEntities(dateRaw)) : NaN;
        return {
            title: title,
            link: link,
            timestamp: isFinite(timestamp) ? timestamp : 0
        };
    }).filter(function(item) { return item.title; });
}

function isBitcoinFocused(title, source) {
    if (!title) return false;
    if (BAD_WORDS.test(title)) return false;
    if (title.length < 15) return false;
    const keywords = (source && source.keywords) ? source.keywords : MUST_HAVE_BTC;
    if (source && source.native && !source.keywords) return true;
    return keywords.test(title);
}

function normalizeTitle(title) {
    return decodeEntities(title)
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function selectTop(headlines, now, opts) {
    opts = opts || {};
    const topN = opts.topN || TOP_N;
    const maxAgeDays = opts.maxAgeDays || MAX_AGE_DAYS;
    const nowMs = now instanceof Date ? now.getTime() : Number(now);
    const cutoff = nowMs - (maxAgeDays * 24 * 60 * 60 * 1000);
    const seenTitles = new Set();
    const seenLinks = new Set();
    const usedSources = new Set();
    const picked = [];

    const sorted = headlines.slice().sort(function(a, b) {
        return (b.timestamp || 0) - (a.timestamp || 0);
    });

    for (let i = 0; i < sorted.length && picked.length < topN; i++) {
        const h = sorted[i];
        if (!h || !h.title) continue;
        if ((h.timestamp || 0) < cutoff) continue;
        if (h.link && /news\.google\.com/i.test(h.link)) continue;
        const key = normalizeTitle(h.title);
        if (!key || seenTitles.has(key)) continue;
        const linkKey = (h.link || '').split('?')[0].replace(/\/+$/, '');
        if (linkKey && seenLinks.has(linkKey)) continue;
        if (h.source && usedSources.has(h.source)) continue;
        seenTitles.add(key);
        if (linkKey) seenLinks.add(linkKey);
        if (h.source) usedSources.add(h.source);
        picked.push(h);
    }
    return picked;
}

function selectWithRelax(headlines, now) {
    let picked = selectTop(headlines, now, { maxAgeDays: MAX_AGE_DAYS });
    if (picked.length >= TOP_N) return picked;
    for (let i = 0; i < RELAXED_AGE_DAYS.length && picked.length < TOP_N; i++) {
        picked = selectTop(headlines, now, { maxAgeDays: RELAXED_AGE_DAYS[i] });
    }
    return picked;
}

function formatDate(ts) {
    const d = new Date(ts || Date.now());
    if (!isFinite(d.getTime())) return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function toOutput(nowIso, top) {
    return {
        updated: nowIso,
        news: top.map(function(h) {
            return {
                date: formatDate(h.timestamp),
                title: h.title,
                snippet: h.snippet || '',
                link: h.link && /news\.google\.com/i.test(h.link) ? '' : (h.link || ''),
                source: h.source
            };
        })
    };
}

function fetchText(url, depth) {
    depth = depth || 0;
    if (depth > 5) return Promise.reject(new Error('too many redirects'));
    return new Promise(function(resolve, reject) {
        let parsed;
        try { parsed = new URL(url); } catch (e) { reject(e); return; }
        const mod = parsed.protocol === 'http:' ? http : https;
        const req = mod.request({
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            port: parsed.port || undefined,
            path: parsed.pathname + parsed.search,
            method: 'GET',
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
            },
            timeout: REQUEST_TIMEOUT_MS
        }, function(res) {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                const next = res.headers.location.startsWith('http')
                    ? res.headers.location
                    : new URL(res.headers.location, url).href;
                resolve(fetchText(next, depth + 1));
                return;
            }
            if (res.statusCode < 200 || res.statusCode >= 300) {
                res.resume();
                reject(new Error('HTTP ' + res.statusCode));
                return;
            }
            const chunks = [];
            res.on('data', function(c) { chunks.push(c); });
            res.on('end', function() { resolve(Buffer.concat(chunks).toString('utf8')); });
            res.on('error', reject);
        });
        req.on('error', reject);
        req.on('timeout', function() { req.destroy(); reject(new Error('timeout')); });
        req.end();
    });
}

const CITADEL_DIGEST_TITLE = /^(?:(?:\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC)|(?:(?:CODE|WEEKLY|DAILY|EDITOR|FORWARD) WIRE))\s*\|/i;

function feedBodyText(chunk) {
    const raw = firstMatch(chunk, [
        /<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i,
        /<description[^>]*>([\s\S]*?)<\/description>/i,
        /<content[^>]*>([\s\S]*?)<\/content>/i
    ]);
    if (!raw) return '';
    return String(raw)
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#x([0-9a-fA-F]+);/g, function(_, h) { return safeChar(parseInt(h, 16)); })
        .replace(/&#(\d+);/g, function(_, d) { return safeChar(parseInt(d, 10)); })
        .replace(/\r/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
}

function headlinesFromCitadelWireBody(body, feedTitle) {
    const numbered = [];
    const re = /^\s*\d+\.\s+(.+)$/gm;
    let m;
    while ((m = re.exec(body || ''))) {
        const title = m[1].replace(/\s+/g, ' ').trim();
        if (title) numbered.push(title);
    }
    if (numbered.length) return numbered;
    if (/^CODE WIRE\b/i.test(feedTitle || '') || /^CODE WIRE\b/im.test(body || '')) {
        const lines = String(body || '').split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^CODE WIRE\b/i.test(line)) continue;
            if (/^BITCOIN\s+\$/i.test(line)) continue;
            if (/^--/.test(line)) continue;
            if (/^https?:\/\//i.test(line)) continue;
            if (line.length >= 8) return [line];
        }
    }
    return [];
}

function expandCitadelWireStories(xml) {
    if (!xml || typeof xml !== 'string') return [];
    const chunks = xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/g) || [];
    const stories = [];
    for (let i = 0; i < chunks.length && i < PER_FEED_LIMIT; i++) {
        const parsed = parseFeed(chunks[i]);
        const base = parsed[0];
        if (!base) continue;
        const extracted = headlinesFromCitadelWireBody(feedBodyText(chunks[i]), base.title);
        const titles = extracted.length
            ? extracted
            : (CITADEL_DIGEST_TITLE.test(base.title) ? [] : [base.title]);
        for (let j = 0; j < titles.length; j++) {
            const title = decodeEntities(titles[j]);
            if (!title) continue;
            stories.push({
                title: title,
                link: base.link || '',
                timestamp: base.timestamp || 0
            });
        }
    }
    // Prefer Bitcoin-titled stories when any exist; otherwise keep all
    // (native source, so a title may omit the word Bitcoin).
    const bitcoin = stories.filter(function(s) { return MUST_HAVE_BTC.test(s.title); });
    return (bitcoin.length ? bitcoin : stories).slice(0, PER_FEED_LIMIT);
}

function itemsFromSource(source, xml) {
    const parsed = (source && source.expand === 'citadelwire')
        ? expandCitadelWireStories(xml)
        : parseFeed(xml).slice(0, PER_FEED_LIMIT);
    const out = [];
    for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (!isBitcoinFocused(item.title, source)) continue;
        if (item.link && /news\.google\.com/i.test(item.link)) continue;
        out.push({
            date: formatDate(item.timestamp),
            title: item.title,
            snippet: source.name,
            link: item.link || '',
            source: source.id,
            timestamp: item.timestamp || 0
        });
    }
    return out;
}

async function collectHeadlines(fetcher) {
    const fetchFn = fetcher || fetchText;
    const headlines = [];
    const reports = [];
    for (let i = 0; i < SOURCES.length; i++) {
        const source = SOURCES[i];
        try {
            const xml = await fetchFn(source.url);
            const items = itemsFromSource(source, xml);
            headlines.push.apply(headlines, items);
            reports.push({ id: source.id, ok: true, count: items.length });
            console.log('[Ticker] ' + source.name + ': ' + items.length + ' bitcoin-focused items');
        } catch (e) {
            reports.push({ id: source.id, ok: false, error: e.message });
            console.error('[Ticker] ' + source.name + ' failed: ' + e.message);
        }
    }
    return { headlines: headlines, reports: reports };
}

function defaultOutputPath() {
    return path.join(__dirname, '..', 'newsletter-data.json');
}

async function run(options) {
    options = options || {};
    const outPath = options.outPath || defaultOutputPath();
    const now = options.now || new Date();
    const gathered = await collectHeadlines(options.fetcher);
    const top = selectWithRelax(gathered.headlines, now);
    if (!top.length) {
        console.log('[Ticker] No headlines found, keeping existing file');
        return { updated: false, news: [], reports: gathered.reports };
    }
    const output = toOutput(now.toISOString(), top);
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
    console.log('[Ticker] Updated ' + outPath + ':');
    top.forEach(function(h, i) {
        console.log('  SIGNAL #' + (i + 1) + ': ' + h.title + ' [' + h.source + ']');
    });
    return { updated: true, news: output.news, reports: gathered.reports };
}

module.exports = {
    SOURCES: SOURCES,
    MAX_AGE_DAYS: MAX_AGE_DAYS,
    PER_FEED_LIMIT: PER_FEED_LIMIT,
    BAD_WORDS: BAD_WORDS,
    MUST_HAVE_BTC: MUST_HAVE_BTC,
    decodeEntities: decodeEntities,
    parseFeed: parseFeed,
    isBitcoinFocused: isBitcoinFocused,
    normalizeTitle: normalizeTitle,
    selectTop: selectTop,
    selectWithRelax: selectWithRelax,
    toOutput: toOutput,
    itemsFromSource: itemsFromSource,
    expandCitadelWireStories: expandCitadelWireStories,
    headlinesFromCitadelWireBody: headlinesFromCitadelWireBody,
    collectHeadlines: collectHeadlines,
    run: run
};

if (require.main === module) {
    run().catch(function(e) {
        console.error('[Ticker] Fatal:', e);
        process.exit(1);
    });
}
