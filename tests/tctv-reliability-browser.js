'use strict';
const fs = require('fs'), http = require('http'), path = require('path');
// Optional headless check of Timechain TV playback (not in run-all; needs Playwright and Chrome).
//   node tests/tctv-reliability-browser.js [repoRoot] [fake|real]
// fake: swaps in a scripted YouTube API to test dead-video skips, the stall watchdog, tap to play,
//       debounced channel switches, keyboard and swipe, and leaving and coming back.
// real: real YouTube embeds, screenshots at 1280 and 390 into TCTV_SHOTS_DIR.
// Firebase network calls are blocked so nothing is written anywhere.
function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_CORE, 'playwright', 'playwright-core'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (err) { /* next */ } }
  throw new Error('Playwright is not installed (set PLAYWRIGHT_CORE to a playwright-core path)');
}
const { chromium } = loadPlaywright();
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const MODE = process.argv[3] || 'fake';
const OUT = process.env.TCTV_SHOTS_DIR || require('os').tmpdir();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/' || p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end('nf'); }
      rsp.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}
const FAKE_YT = `(function(){
var S={UNSTARTED:-1,ENDED:0,PLAYING:1,PAUSED:2,BUFFERING:3,CUED:5};
var yt=window.__yt=window.__yt||{};yt.loads=[];yt.created=0;yt.destroyed=0;yt.deadNext=yt.deadNext||0;yt.stallNext=0;yt.blockAutoplay=0;yt.errors=0;
function Player(el,opts){var self=this;yt.created++;var node=typeof el==='string'?document.getElementById(el):el;var f=document.createElement('iframe');f.id=node.id;f.src='about:blank';f.style.cssText='width:100%;height:100%;border:0;background:#123';node.parentNode.replaceChild(f,node);
 this._f=f;this._o=opts;this._s=-1;this._m=!!(opts.playerVars&&opts.playerVars.mute);this._v=null;
 setTimeout(function(){if(self._dead)return;self._ready=1;Object.assign(self,api);opts.events&&opts.events.onReady&&opts.events.onReady({target:self});},60);
 this._start(opts.videoId);}
Player.prototype._set=function(s){this._s=s;var ev=this._o.events;ev&&ev.onStateChange&&ev.onStateChange({target:this,data:s});f2(this);};
function f2(p){p._f&&(p._f.dataset.state=p._s,p._f.dataset.vid=p._v||'');}
Player.prototype._start=function(id){var self=this;self._v=id;self._s=-1;yt.loads.push(id);clearTimeout(self._t);
 if(yt.deadNext>0){yt.deadNext--;self._mode='dead';self._t=setTimeout(function(){yt.errors++;var ev=self._o.events;ev&&ev.onError&&ev.onError({target:self,data:150})},120);return}
 if(yt.stallNext>0){yt.stallNext--;self._mode='stall';self._t=setTimeout(function(){self._set(3)},120);return}
 if(yt.blockAutoplay){self._mode='block';self._t=setTimeout(function(){self._set(5)},120);return}
 self._mode='ok';self._t=setTimeout(function(){self._set(3);self._t=setTimeout(function(){self._set(1)},80)},80);};
var api={loadVideoById:function(id){this._start(id)},playVideo:function(){var s=this;if(s._mode!=='block')return;if(!yt.clicked)return;yt.blockAutoplay=0;s._mode='ok';clearTimeout(s._t);setTimeout(function(){s._set(1)},50)},pauseVideo:function(){this._set(2)},
 mute:function(){this._m=true},unMute:function(){this._m=false},isMuted:function(){return this._m},setVolume:function(){},getPlayerState:function(){return this._s},getCurrentTime:function(){return 0},getDuration:function(){return 100},seekTo:function(){},getIframe:function(){return this._f},
 destroy:function(){this._dead=1;clearTimeout(this._t);yt.destroyed++;var d=document.createElement('div');d.id=this._f.id;this._f.parentNode&&this._f.parentNode.replaceChild(d,this._f);this._f=null}};
document.addEventListener('click',function(){yt.clicked=1;setTimeout(function(){yt.clicked=0},1000)},true);window.YT={Player:Player,PlayerState:S};setTimeout(function(){window.onYouTubeIframeAPIReady&&window.onYouTubeIframeAPIReady()},10);})();`;
const BLOCK = [/firestore\.googleapis\.com/, /identitytoolkit\.googleapis\.com/, /securetoken\.googleapis\.com/, /firebaseinstallations\.googleapis\.com/, /cloudfunctions\.net/, /firebaselogging/, /google-analytics\.com/, /googletagmanager/, /fcmregistrations/, /firebaseappcheck/, /recaptcha/];
async function newPage(browser, base, width, mobile) {
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, isMobile: !!mobile, hasTouch: !!mobile, deviceScaleFactor: mobile ? 2 : 1, userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' : undefined });
  await ctx.route('**/*', route => { const u = route.request().url(); if (BLOCK.some(r => r.test(u))) return route.abort(); if (MODE === 'fake' && /youtube\.com\/iframe_api/.test(u)) return route.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_YT }); return route.continue(); });
  await ctx.addInitScript(() => { try { localStorage.setItem('tctv_seen_intro', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.__errors = errors;
  await page.goto(base + '/#timechain-tv', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#tctv-player', { timeout: 30000 });
  return page;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function main() {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
  const results = [];
  const ok = (name, cond, extra) => { results.push({ name, pass: !!cond, extra }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + JSON.stringify(extra) : '')); };
  try {
    if (MODE === 'real') {
      for (const [w, mob] of [[1280, false], [390, true]]) {
        const page = await newPage(browser, base, w, mob);
        await sleep(12000);
        const info = await page.evaluate(() => ({ st: window.tctvCurrentStation && window.tctvCurrentStation(), state: window._tctvYtPlayer && window._tctvYtPlayer.getPlayerState ? window._tctvYtPlayer.getPlayerState() : null, muted: window._tctvYtPlayer && window._tctvYtPlayer.isMuted ? window._tctvYtPlayer.isMuted() : null, hint: !!document.getElementById('tctv-unmute-hint'), tap: !!document.getElementById('tctv-tap-play'), stuck: !!document.getElementById('tctv-stuck'), now: (document.getElementById('tctv-now-playing') || {}).textContent }));
        console.log(w, JSON.stringify(info));
        await page.screenshot({ path: path.join(OUT, 'fixed-' + w + '-tctv.png') });
        if (!mob) { await page.keyboard.press(']'); await sleep(5000); await page.screenshot({ path: path.join(OUT, 'fixed-1280-after-key-switch.png') }); }
        else { await page.evaluate(() => window.tctvRemoteChannel(1)); await sleep(5000); await page.screenshot({ path: path.join(OUT, 'fixed-390-after-switch.png') }); }
        console.log('errors', w, JSON.stringify(page.__errors.filter(e => !/Failed to load resource|ERR_FAILED|net::/.test(e)).slice(0, 12)));
        await page.context().close();
      }
      return;
    }
    // ---- fake YouTube API flows ----
    let page = await newPage(browser, base, 1280, false);
    await page.evaluate(() => { window.__yt = window.__yt || {}; });
    await page.waitForFunction(() => window.__yt && window.__yt.loads && window.__yt.loads.length > 0, null, { timeout: 15000 });
    await page.waitForFunction(() => window._tctvYtPlayer && window._tctvYtPlayer.getPlayerState && window._tctvYtPlayer.getPlayerState() === 1, null, { timeout: 15000 });
    ok('first load autoplays (muted) and reaches PLAYING', true, await page.evaluate(() => ({ muted: window._tctvYtPlayer.isMuted(), hint: !!document.getElementById('tctv-unmute-hint') })));
    const hint = await page.evaluate(() => !!document.getElementById('tctv-unmute-hint'));
    ok('tap to unmute hint is shown', hint);
    // dead videos: next 2 loads fail
    let before = await page.evaluate(() => ({ loads: window.__yt.loads.length, st: window.tctvCurrentStation() }));
    await page.evaluate(() => { window.__yt.deadNext = 2; window.tctvRemoteChannel(1); });
    await page.waitForFunction(() => window._tctvYtPlayer.getPlayerState() === 1 && window.__yt.errors >= 2, null, { timeout: 8000 }).catch(() => {});
    let after = await page.evaluate(() => ({ loads: window.__yt.loads.slice(-3), errors: window.__yt.errors, state: window._tctvYtPlayer.getPlayerState(), bad: JSON.parse(localStorage.getItem('tctv_bad_ids') || '{}'), banner: !!document.getElementById('tctv-botwall-banner'), stuck: !!document.getElementById('tctv-stuck') }));
    ok('two dead videos in a row are skipped and the third plays', after.errors >= 2 && after.state === 1 && !after.banner && !after.stuck, after);
    ok('dead ids are remembered after a good play', Object.keys(after.bad).length >= 2, Object.keys(after.bad));
    // rapid switches
    before = await page.evaluate(() => ({ loads: window.__yt.loads.length, idx: window.tctvStationCatalog().findIndex(s => s.id === window.tctvCurrentStation()), n: window.tctvStationCatalog().length }));
    await page.evaluate(() => { for (let k = 0; k < 5; k++) window.tctvRemoteChannel(1); });
    const noiseCount = await page.evaluate(() => document.querySelectorAll('#tctvChNoise').length);
    await sleep(700);
    after = await page.evaluate(() => ({ loads: window.__yt.loads.length, st: window.tctvCurrentStation(), idx: window.tctvStationCatalog().findIndex(s => s.id === window.tctvCurrentStation()), ch: (document.getElementById('tctv-now-ch') || {}).textContent, created: window.__yt.created }));
    ok('5 rapid channel presses load exactly once', after.loads - before.loads === 1, { loads: after.loads - before.loads });
    ok('channel state lands 5 ahead and the label matches', after.idx === (before.idx + 5) % before.n && after.ch.indexOf('CH. ' + after.idx + ' ') === 0, after);
    ok('only one static overlay at a time', noiseCount <= 1, { noiseCount });
    // keyboard
    before = await page.evaluate(() => window.tctvStationCatalog().findIndex(s => s.id === window.tctvCurrentStation()));
    await page.mouse.click(5, 5).catch(() => {});
    await page.keyboard.press(']');
    await sleep(400);
    after = await page.evaluate(() => window.tctvStationCatalog().findIndex(s => s.id === window.tctvCurrentStation()));
    ok('] key goes to the next channel', after === (before + 1) % 22 || after === before + 1, { before, after });
    const row = await page.$('[data-station-id][tabindex="0"]');
    ok('channel rows are focusable buttons', !!row);
    if (row) { const id = await row.getAttribute('data-station-id'); await row.focus(); await page.keyboard.press('Enter'); await sleep(400); const st = await page.evaluate(() => window.tctvCurrentStation()); ok('Enter on a focused row tunes it', st === id, { id, st }); }
    // stall watchdog
    before = await page.evaluate(() => ({ loads: window.__yt.loads.length }));
    await page.evaluate(() => { window.__yt.stallNext = 1; window.tctvRemoteChannel(1); });
    await sleep(23500);
    after = await page.evaluate(() => ({ loads: window.__yt.loads.length, state: window._tctvYtPlayer.getPlayerState() }));
    ok('a stalled video is replaced after the 20s watchdog', after.loads - before.loads >= 2 && after.state === 1, { added: after.loads - before.loads, state: after.state });
    // blocked autoplay -> tap to play
    await page.evaluate(() => { window.__yt.blockAutoplay = 1; window.tctvRemoteChannel(1); });
    await sleep(9800);
    const tap = await page.evaluate(() => !!document.getElementById('tctv-tap-play'));
    ok('blocked autoplay shows Tap to play instead of skipping', tap);
    if (tap) { await page.click('#tctv-tap-play'); await sleep(400); const st = await page.evaluate(() => ({ s: window._tctvYtPlayer.getPlayerState(), tap: !!document.getElementById('tctv-tap-play') })); ok('Tap to play starts the video and hides the button', st.s === 1 && !st.tap, st); }
    await page.screenshot({ path: path.join(OUT, 'fake-1280-after-flows.png') });
    // leave and come back
    before = await page.evaluate(() => ({ destroyed: window.__yt.destroyed, created: window.__yt.created }));
    await page.evaluate(() => { window.cleanupTimechainTV(); });
    const mid = await page.evaluate(() => ({ destroyed: window.__yt.destroyed, player: window._tctvYtPlayer }));
    await page.evaluate(() => { window.renderTimechainTV(); });
    await page.waitForFunction(() => window._tctvYtPlayer && window._tctvYtPlayer.getPlayerState && window._tctvYtPlayer.getPlayerState() === 1, null, { timeout: 10000 }).catch(() => {});
    after = await page.evaluate(() => ({ created: window.__yt.created, state: window._tctvYtPlayer && window._tctvYtPlayer.getPlayerState && window._tctvYtPlayer.getPlayerState(), connected: !!(window._tctvYtPlayer && window._tctvYtPlayer.getIframe && window._tctvYtPlayer.getIframe() && window._tctvYtPlayer.getIframe().isConnected) }));
    ok('leaving TV destroys the player', mid.destroyed === before.destroyed + 1 && mid.player === null, mid);
    ok('coming back builds a fresh player that plays', after.created === before.created + 1 && after.state === 1 && after.connected, after);
    const errs = page.__errors.filter(e => !/Failed to load resource|ERR_FAILED|net::|firebase|Firestore|App Check|appCheck|recaptcha|^pageerror: cancelled$|Unhandled promise rejection: cancelled/i.test(e));
    ok('no console errors from TV', errs.length === 0, errs.slice(0, 8));
    await page.context().close();
    // mobile swipe
    page = await newPage(browser, base, 390, true);
    await page.waitForFunction(() => window._tctvYtPlayer && window._tctvYtPlayer.getPlayerState && window._tctvYtPlayer.getPlayerState() === 1, null, { timeout: 15000 });
    await page.waitForSelector('#tctv-swipe-overlay', { timeout: 5000 }).catch(() => {});
    before = await page.evaluate(() => window.tctvStationCatalog().findIndex(s => s.id === window.tctvCurrentStation()));
    await page.evaluate(() => {
      const el = document.getElementById('tctv-swipe-overlay'); const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y0 = r.top + r.height * 0.8, y1 = r.top + r.height * 0.2;
      const t = (y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      el.dispatchEvent(new TouchEvent('touchstart', { touches: [t(y0)], changedTouches: [t(y0)], bubbles: true }));
      el.dispatchEvent(new TouchEvent('touchmove', { touches: [t((y0 + y1) / 2)], changedTouches: [t((y0 + y1) / 2)], bubbles: true, cancelable: true }));
      el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(y1)], bubbles: true }));
    });
    await sleep(500);
    after = await page.evaluate(() => window.tctvStationCatalog().findIndex(s => s.id === window.tctvCurrentStation()));
    ok('390px swipe up changes channel', after === (before + 1) % 22, { before, after });
    await page.screenshot({ path: path.join(OUT, 'fake-390-after-swipe.png') });
    await page.context().close();
  } finally {
    await browser.close(); srv.close();
    if (MODE === 'fake') { fs.writeFileSync(path.join(OUT, 'e2e-' + path.basename(ROOT) + '.json'), JSON.stringify(results, null, 1)); const f = results.filter(r => !r.pass).length; console.log('\n' + (results.length - f) + ' passed, ' + f + ' failed'); }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
