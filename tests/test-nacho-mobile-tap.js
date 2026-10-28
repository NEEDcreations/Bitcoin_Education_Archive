// Phone taps on Nacho. A real touch (page.tap, hasTouch) must open the
// action sheet. The story and closet buttons on the sprite stay inert.
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function loadPlaywright() {
    try { return require('playwright'); } catch (e) {}
    try { return require('playwright-core'); } catch (e2) {}
    var dest = '/tmp/nacho-pw';
    var bundled = path.join(dest, 'node_modules', 'playwright-core');
    if (fs.existsSync(bundled)) return require(bundled);
    var line = 'SKIP: Playwright is not installed, so the phone tap test did not run.';
    console.log(line);
    console.error(line);
    if (process.stdout.write) process.stdout.write(line + '\n');
    process.exit(0);
}

function chromePath() {
    const candidates = [process.env.CHROME_PATH, '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/local/bin/google-chrome'];
    for (var i = 0; i < candidates.length; i++) {
        if (candidates[i] && fs.existsSync(candidates[i])) return candidates[i];
    }
    throw new Error('Chrome is not installed');
}

function startServer() {
    const types = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.ico': 'image/x-icon'
    };
    return new Promise(function (resolve) {
        const server = http.createServer(function (req, res) {
            var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
            if (urlPath === '/') urlPath = '/index.html';
            var file = path.normalize(path.join(root, urlPath));
            if (file.indexOf(root) !== 0) {
                res.writeHead(403);
                res.end();
                return;
            }
            fs.readFile(file, function (err, data) {
                if (err) {
                    res.writeHead(404);
                    res.end('missing');
                    return;
                }
                res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
                res.end(data);
            });
        });
        server.listen(0, '127.0.0.1', function () { resolve(server); });
    });
}

async function boot(page) {
    await page.addInitScript(function () {
        localStorage.setItem('btc_intro_seen', '1');
        localStorage.setItem('btc_onboarding_quest_done', '1');
        localStorage.setItem('btc_onboarding_done', '1');
        localStorage.setItem('btc_nacho_onboarding', '9');
        localStorage.removeItem('btc_nacho_position');
        localStorage.removeItem('btc_nacho_hidden');
        localStorage.removeItem('btc_nacho_ask_hint');
    });
    await page.goto(page._homeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#nacho-avatar', { timeout: 15000 });
    // The long-press handler is attached a second after load and cancels clicks.
    await page.waitForTimeout(1500);
    await page.waitForSelector('#nachoAskHint', { state: 'visible', timeout: 5000 });
}

(async function () {
    const { chromium } = loadPlaywright();
    const server = await startServer();
    const port = server.address().port;
    const browser = await chromium.launch({
        executablePath: chromePath(),
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true
    });
    const page = await context.newPage();
    page._homeUrl = 'http://127.0.0.1:' + port + '/';
    try {
        const views = [
            { w: 320, h: 568, touch: true },
            { w: 360, h: 640, touch: true },
            { w: 390, h: 844, touch: true },
            { w: 1280, h: 800, touch: false }
        ];
        for (const view of views) {
            const hintContext = await browser.newContext({
                viewport: { width: view.w, height: view.h },
                hasTouch: view.touch,
                isMobile: view.touch
            });
            const hintPage = await hintContext.newPage();
            hintPage._homeUrl = page._homeUrl;
            await boot(hintPage);
            const hits = await hintPage.evaluate(function () {
                var hintEl = document.getElementById('nachoAskHint');
                var hint = hintEl.getBoundingClientRect();
                var place = hintEl.getAttribute('data-place') || '';
                var sel = 'button, a, input, textarea, select, [role="button"], [role="link"], [onclick], img, svg, video, .today-tile, .today-more-item, .home-subtitle, .home-title, .home-logos, .mobile-bar, #todayFavorStrip, #dailyXpMeter, #todayCard, #homeHero, #bottomNav, #featuredOnSection, #introVideoSection, #questGuideBanner';
                var nodes = document.querySelectorAll(sel);
                var bad = [];
                function hidden(el) {
                    var node = el;
                    while (node && node !== document.documentElement) {
                        if (node.hidden) return true;
                        var cs = getComputedStyle(node);
                        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return true;
                        node = node.parentElement;
                    }
                    return false;
                }
                for (var i = 0; i < nodes.length; i++) {
                    var el = nodes[i];
                    if (el === hintEl || (el.closest && el.closest('#nachoAskHint'))) continue;
                    if (place === 'deer' && (el.id === 'nacho-avatar' || (el.closest && el.closest('#nacho-avatar')))) continue;
                    if (hidden(el)) continue;
                    var b = el.getBoundingClientRect();
                    if (b.width < 2 || b.height < 2) continue;
                    if (b.bottom <= 0 || b.right <= 0 || b.top >= window.innerHeight || b.left >= window.innerWidth) continue;
                    var overlaps = !(hint.right <= b.left || hint.left >= b.right || hint.bottom <= b.top || hint.top >= b.bottom);
                    if (!overlaps) continue;
                    var name = el.id || el.getAttribute('aria-label') || (el.className && String(el.className).split(' ')[0]) || el.tagName;
                    bad.push(name + (place ? ' [' + place + ']' : ''));
                }
                var avatar = document.getElementById('nacho-avatar');
                var ar = avatar ? avatar.getBoundingClientRect() : null;
                var outsideDeer = place === 'deer' && ar && (hint.left < ar.left - 1 || hint.right > ar.right + 1 || hint.top < ar.top - 1 || hint.bottom > ar.bottom + 1);
                return { place: place, text: hintEl.textContent, bad: bad, top: Math.round(hint.top), bottom: Math.round(hint.bottom), outsideDeer: !!outsideDeer };
            });
            assert.ok(hits.place === 'float' || hits.place === 'deer', view.w + 'x' + view.h + ' missing hint place');
            if (hits.place === 'deer') {
                assert.strictEqual(hits.text, 'Tap me');
                assert.strictEqual(hits.outsideDeer, false, view.w + 'x' + view.h + ' Tap me spills off the deer');
            }
            assert.deepStrictEqual(hits.bad, [], view.w + 'x' + view.h + ' hint covers ' + hits.bad.join(', ') + ' at y ' + hits.top + '-' + hits.bottom);
            await hintContext.close();
        }
        await boot(page);
        await page.tap('#nachoAskHint');
        await page.waitForFunction(function () {
            var bubble = document.getElementById('nacho-bubble');
            return bubble && bubble.classList.contains('show');
        }, { timeout: 8000 });

        await page.tap('#nacho-avatar');
        await page.waitForSelector('#nachoActionSheet', { state: 'visible', timeout: 3000 });
        const afterDeer = await page.evaluate(function () {
            var bubble = document.getElementById('nacho-bubble');
            var sheet = document.getElementById('nachoActionSheet');
            return {
                sheetOpen: sheet && !sheet.hidden,
                bubbleOpen: !!(bubble && bubble.classList.contains('show')),
                story: !!document.getElementById('nachoStoryOverlay'),
                closet: !!document.getElementById('nachoSheetCloset')
            };
        });
        assert.strictEqual(afterDeer.sheetOpen, true);
        assert.strictEqual(afterDeer.bubbleOpen, false, 'one tap should close the greeting and open the sheet');
        assert.strictEqual(afterDeer.story, false, 'a tap on the deer must not open the story');
        assert.strictEqual(afterDeer.closet, true);

        await page.tap('#nachoSheetClose');
        await page.waitForFunction(function () { return document.getElementById('nachoActionSheet').hidden; });

        await page.tap('#nacho-avatar', { position: { x: 40, y: 40 } });
        await page.waitForSelector('#nachoActionSheet', { state: 'visible' });
        const corner = await page.evaluate(function () {
            return { story: !!document.getElementById('nachoStoryOverlay') };
        });
        assert.strictEqual(corner.story, false, 'the old story spot on the deer must not open the story');
        await page.tap('#nachoSheetClose');
        await page.waitForFunction(function () { return document.getElementById('nachoActionSheet').hidden; });

        await page.tap('#nacho-avatar');
        await page.waitForSelector('#nachoActionSheet', { state: 'visible' });
        await page.tap('#nachoSheetStory');
        await page.waitForSelector('#nachoStoryOverlay', { timeout: 3000 });
        await page.evaluate(function () { document.getElementById('nachoStoryOverlay').remove(); });

        await page.tap('#nacho-avatar');
        await page.tap('#nachoSheetCloset');
        await page.waitForFunction(function () {
            var modal = document.getElementById('usernameModal');
            return window._expanded_closet === true || (modal && modal.classList.contains('open'));
        }, { timeout: 3000 });
        await page.evaluate(function () {
            var modal = document.getElementById('usernameModal');
            if (modal) modal.classList.remove('open');
        });

        const hit = await page.evaluate(function () {
            var btn = document.getElementById('nachoHideBtn');
            var r = btn.getBoundingClientRect();
            var el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return {
                id: el && el.id,
                w: Math.round(r.width),
                h: Math.round(r.height),
                cls: el && el.className ? String(el.className).slice(0, 60) : ''
            };
        });
        assert.strictEqual(hit.id, 'nachoHideBtn', 'minimize tap landed on ' + hit.id + ' ' + hit.cls);
        assert.ok(hit.w >= 44 && hit.h >= 44);
        await page.tap('#nachoHideBtn');
        await page.waitForFunction(function () {
            var box = document.getElementById('nacho-container');
            var pill = document.getElementById('nacho-toggle');
            return box && box.classList.contains('hidden') && pill && getComputedStyle(pill).display !== 'none';
        }, { timeout: 3000 });
        const cert = await context.newPage();
        await cert.addInitScript(function () {
            localStorage.removeItem('btc_nacho_onboarding');
            localStorage.removeItem('btc_nacho_ask_hint');
        });
        await cert.goto(page._homeUrl + '#cert/demo', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await cert.waitForSelector('#nacho-avatar', { state: 'attached', timeout: 15000 });
        await cert.waitForTimeout(2600);
        const quiet = await cert.evaluate(function () {
            var bubble = document.getElementById('nacho-bubble');
            var hint = document.getElementById('nachoAskHint');
            return {
                bubbleOpen: !!(bubble && bubble.classList.contains('show')),
                text: bubble ? bubble.textContent : '',
                hintHidden: !hint || hint.hidden,
                hintKey: localStorage.getItem('btc_nacho_ask_hint'),
                tour: localStorage.getItem('btc_nacho_onboarding')
            };
        });
        assert.strictEqual(quiet.bubbleOpen, false, 'welcome covered the certificate: ' + quiet.text);
        assert.ok(!/Daily Spin/.test(quiet.text || ''));
        assert.strictEqual(quiet.hintHidden, true);
        assert.notStrictEqual(quiet.hintKey, '1');
        assert.notStrictEqual(quiet.tour, '2');
        console.log('✅ phone tap opens the Nacho sheet, story, closet, and minimize');
    } finally {
        await browser.close();
        server.close();
    }
})().catch(function (err) {
    console.error('❌ ' + (err && err.stack ? err.stack : err));
    process.exit(1);
});
