#!/usr/bin/env node
// Refresh newsletter-data.json with the top 3 recent Bitcoin Signal headlines.
// Shared parse/filter logic lives in workers/signal-ticker/ticker-core.js.
// On live, a Cloudflare Worker (workers/signal-ticker) will replace the
// GitHub Actions workflow once Phil ships it. This script stays for tests
// and local refreshes. No API keys. Sources are public RSS / YouTube Atom feeds only.

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const core = require('../workers/signal-ticker/ticker-core.js');

const USER_AGENT = core.USER_AGENT;
const REQUEST_TIMEOUT_MS = core.REQUEST_TIMEOUT_MS;

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

function defaultOutputPath() {
    return path.join(__dirname, '..', 'newsletter-data.json');
}

async function run(options) {
    options = options || {};
    const outPath = options.outPath || defaultOutputPath();
    const now = options.now || new Date();
    const gathered = await core.collectHeadlines(options.fetcher || fetchText);
    const top = core.selectWithRelax(gathered.headlines, now);
    if (!top.length) {
        console.log('[Ticker] No headlines found, keeping existing file');
        return { updated: false, news: [], reports: gathered.reports };
    }
    const output = core.toOutput(now.toISOString(), top);
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
    console.log('[Ticker] Updated ' + outPath + ':');
    top.forEach(function(h, i) {
        console.log('  SIGNAL #' + (i + 1) + ': ' + h.title + ' [' + h.source + ']');
    });
    return { updated: true, news: output.news, reports: gathered.reports };
}

module.exports = Object.assign({}, core, {
    fetchText: fetchText,
    run: run
});

if (require.main === module) {
    run().catch(function(e) {
        console.error('[Ticker] Fatal:', e);
        process.exit(1);
    });
}
