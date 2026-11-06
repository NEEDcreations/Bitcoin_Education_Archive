'use strict';
// Headless shots of a GGs badge post with the 🎉 count, before and after a tap.
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = '/opt/cursor/artifacts';

function loadPlaywright() {
    try { return require('playwright'); } catch (err) { /* next */ }
    try { return require('playwright-core'); } catch (err2) { /* next */ }
    const bundled = '/tmp/nacho-pw/node_modules/playwright-core';
    if (fs.existsSync(bundled)) return require(bundled);
    throw new Error('Playwright is not installed');
}

function chromePath() {
    const candidates = [process.env.CHROME_PATH, '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/local/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
    for (let i = 0; i < candidates.length; i++) {
        if (candidates[i] && fs.existsSync(candidates[i])) return candidates[i];
    }
    return '';
}

function startServer() {
    const types = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.css': 'text/css',
        '.png': 'image/png',
        '.ico': 'image/x-icon',
    };
    return new Promise(function (resolve) {
        const server = http.createServer(function (req, res) {
            const url = new URL(req.url, 'http://127.0.0.1');
            if (url.pathname === '/shot.html') {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(page());
                return;
            }
            const file = path.join(root, decodeURIComponent(url.pathname));
            if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                res.writeHead(404);
                res.end('missing');
                return;
            }
            res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(res);
        });
        server.listen(0, '127.0.0.1', function () { resolve(server); });
    });
}

function page() {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>GGs celebration</title><style>' +
        ':root{--bg:#020617;--border:#1e293b;--text:#e2e8f0;--text-muted:#64748b;--text-faint:#475569;--accent:#f97316;--card-bg:rgba(255,255,255,0.03);}' +
        'html,body{margin:0;background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;}' +
        '#wrap{max-width:440px;margin:0 auto;padding:16px 12px 28px;}' +
        'h1{font-size:0.95rem;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #f97316;}' +
        '</style></head><body><div id="wrap"><h1>🎉 GGs</h1><div id="feed"></div></div>' +
        '<script>window.__calls=[];window.firebase={functions:function(){return{httpsCallable:function(name){return function(payload){window.__calls.push({name:name,payload:payload});return Promise.resolve({data:{reacted:true,count:4}});};}};},firestore:{FieldValue:{delete:function(){},serverTimestamp:function(){}}},appCheck:function(){return{getToken:function(){return Promise.resolve({token:"ok"});}};}};' +
        'window.auth={currentUser:{uid:"player1",isAnonymous:false},onAuthStateChanged:function(cb){if(typeof cb==="function")setTimeout(function(){cb(window.auth.currentUser);},0);return function(){};}};window.currentUser={username:"Pat",banned:false};' +
        'window.db={collection:function(){return{doc:function(){return{collection:function(){return{doc:function(){return{get:function(){return Promise.resolve({exists:false});}};}};}};}};}};' +
        '</script><script src="/badges.catalog.js"></script><script src="/global-chat.js"></script>' +
        '<script>var node=window._renderAnnouncementItem({id:"badgegg_pat_1",data:function(){return {uid:"nacho-bot",name:"Nacho",text:"🏅 @Pat just earned the 🏕️ Pathfinder badge! 🎉",isNachoAuto:true,postedByUid:"badge-gg",ggKind:"badge",badgeIds:["explorer_50"],mentionUid:"pat",partyCount:3};}},"panel");document.getElementById("feed").appendChild(node);</script></body></html>';
}

async function shot(browser, url, width, height, file, after) {
    const page = await browser.newPage({ viewport: { width: width, height: height } });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('[data-gg-party-btn]');
    if (after) {
        await page.click('[data-gg-party-btn]');
        await page.waitForFunction(function () {
            const el = document.querySelector('[data-gg-party-count]');
            const btn = document.querySelector('[data-gg-party-btn]');
            return el && el.textContent === '4' && btn && btn.getAttribute('aria-pressed') === 'true';
        });
    } else {
        await page.waitForFunction(function () {
            const el = document.querySelector('[data-gg-party-count]');
            return el && el.textContent === '3';
        });
    }
    await page.locator('#wrap').screenshot({ path: file });
    await page.close();
}

async function main() {
    fs.mkdirSync(outDir, { recursive: true });
    const server = await startServer();
    const port = server.address().port;
    const url = 'http://127.0.0.1:' + port + '/shot.html';
    const playwright = loadPlaywright();
    const launch = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
    const chrome = chromePath();
    if (chrome) launch.executablePath = chrome;
    const browser = await playwright.chromium.launch(launch);
    const jobs = [
        [375, 812, 'gg-party-375-before.png', false],
        [375, 812, 'gg-party-375-after.png', true],
        [320, 700, 'gg-party-320-before.png', false],
        [320, 700, 'gg-party-320-after.png', true],
        [1280, 800, 'gg-party-desktop-before.png', false],
        [1280, 800, 'gg-party-desktop-after.png', true],
    ];
    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        await shot(browser, url, job[0], job[1], path.join(outDir, job[2]), job[3]);
        console.log('saved ' + job[2]);
    }
    await browser.close();
    server.close();
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
