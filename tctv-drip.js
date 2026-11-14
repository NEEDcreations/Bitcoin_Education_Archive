// Timechain TV pot of sats: a floating, draggable, resizable, minimizable pot overlay with
// sats always flowing in (faster with more viewers). Tap for the pot details; an ⓘ explains the check-in. A short burst every 1,000 sats. Check-ins go to tctvDripCheckin once a minute only while the tab is
// visible and the video is playing. The server does all the math.
(function () {
    'use strict';
    var CHECK_MS = 60000;
    var timer = null, inflight = false, unsub = null, watchUnsub = null, lastBursts = null, promptToken = '';
    var pot = null, dropTimer = null, myShare = null, sharePotId = '';

    function user() {
        try { var u = firebase.auth().currentUser; return u && !u.isAnonymous ? u : null; } catch (e) { return null; }
    }
    function onTv() { return window._tctvActive === true && !!document.querySelector('.tctv-video-wrap'); }
    function playing() {
        var p = window._tctvYtPlayer;
        if (!p || typeof p.getPlayerState !== 'function') return false;
        try { return p.getPlayerState() === ((window.YT && window.YT.PlayerState) ? window.YT.PlayerState.PLAYING : 1); } catch (e) { return false; }
    }
    function deviceId() {
        var k = 'tctvDripDevice', id = '';
        try { id = localStorage.getItem(k) || ''; } catch (e) {}
        if (!/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
            var a = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(a);
            id = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
            try { localStorage.setItem(k, id); } catch (e) {}
        }
        return id;
    }
    function fmt(n) { return Math.floor(n || 0).toLocaleString(); }
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

    var POS_KEY = 'tctvPotPos', MIN_KEY = 'tctvPotMin', SIZE_KEY = 'tctvPotSize';
    var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    function css() {
        if (document.getElementById('tctv-drip-css')) return;
        var s = document.createElement('style'); s.id = 'tctv-drip-css';
        // Floating overlay, outside the player's layout so the video stays centered. Draggable, resizable,
        // minimizable, and it remembers size, minimized state, and spot on this device.
        // Default is upper-right on desktop (below the bell and title bar, left of the collapsed remote)
        // and upper-center on phones (below the mobile bar, title row, and channel remote).
        s.textContent = '#tctv-drip{position:fixed;top:calc(84px + env(safe-area-inset-top, 0px));right:max(76px, env(safe-area-inset-right, 0px));left:auto;bottom:auto;z-index:200001;font-family:inherit;color:#fff;touch-action:none;user-select:none;-webkit-user-select:none;max-width:calc(100vw - 16px);--pot:136px;--coin:26px;--fall:100px}' +
            '#tctv-drip[data-size="2"]{--pot:92px;--coin:20px;--fall:72px}' +
            '#tctv-drip[data-size="1"]{--pot:60px;--coin:16px;--fall:50px}' +
            '#tctv-drip.td-mini{--coin:14px;--fall:36px}' +
            '#tctv-drip[hidden]{display:none}' +
            'body.ticker-visible #tctv-drip{top:calc(116px + env(safe-area-inset-top, 0px))}' +
            '@media (max-width:700px){#tctv-drip{top:calc(178px + env(safe-area-inset-top, 0px));left:8px;right:8px;width:fit-content;margin-left:auto;margin-right:auto}body.ticker-visible #tctv-drip{top:calc(210px + env(safe-area-inset-top, 0px))}}' +
            '@media (max-width:420px){#tctv-drip{--pot:88px;--coin:20px;--fall:60px}#tctv-drip[data-size="2"]{--pot:68px;--coin:16px;--fall:48px}#tctv-drip[data-size="1"]{--pot:52px;--coin:14px;--fall:36px}#tctv-drip[data-size="3"] .td-card{padding:4px}#tctv-drip[data-size="3"] .td-face{font-size:13px}}' +
            '@media (max-width:360px){#tctv-drip{--pot:76px;--coin:18px;--fall:52px}#tctv-drip[data-size="3"] .td-card{padding:6px}}' +
            '#tctv-drip .td-card{position:relative;display:flex;flex-wrap:nowrap;align-items:center;gap:8px;padding:8px;border-radius:28px;background:rgba(17,12,4,.92);border:1px solid rgba(247,147,26,.7);box-shadow:0 10px 28px rgba(0,0,0,.5);cursor:grab;max-width:min(420px,calc(100vw - 16px));box-sizing:border-box}' +
            '#tctv-drip[data-size="3"] .td-card{padding:10px;border-width:2px;box-shadow:0 0 0 3px rgba(247,147,26,.35),0 16px 42px rgba(247,147,26,.45),0 10px 24px rgba(0,0,0,.5)}' +
            '#tctv-drip.td-hello[data-size="3"]:not(.td-mini) .td-card{animation:tdGlow 1.5s ease-in-out 3}' +
            '@keyframes tdGlow{0%,100%{box-shadow:0 0 0 3px rgba(247,147,26,.35),0 12px 32px rgba(247,147,26,.35)}50%{box-shadow:0 0 0 10px rgba(247,147,26,.2),0 0 36px 8px rgba(255,207,107,.7)}}' +
            '#tctv-drip.td-drag .td-card,#tctv-drip.td-drag .td-bubble{cursor:grabbing}' +
            '#tctv-drip .td-potwrap{position:relative;flex:none;width:var(--pot);height:var(--pot);border-radius:22%;overflow:hidden}' +
            '#tctv-drip .td-pot{width:100%;height:100%;border-radius:22%;display:block;object-fit:cover;pointer-events:none}' +
            '#tctv-drip[data-size="3"] .td-pot{box-shadow:0 0 22px rgba(247,147,26,.75)}' +
            '#tctv-drip .td-fx{position:absolute;left:0;right:0;top:0;height:100%;overflow:hidden;pointer-events:none}' +
            '#tctv-drip .td-coin{position:absolute;top:0;width:var(--coin);height:var(--coin);margin-left:calc(var(--coin) / -2);border-radius:50%;background:radial-gradient(circle at 35% 35%,#ffe7a3,#f7931a 58%,#b85f00);color:#3a1d00;font-size:calc(var(--coin) * .62);line-height:var(--coin);text-align:center;font-weight:900;box-shadow:0 0 8px rgba(247,147,26,.95);animation:tdFall var(--d,1.15s) cubic-bezier(.33,.05,.45,1) forwards;will-change:transform,opacity}' +
            '@keyframes tdFall{0%{transform:translate3d(var(--x0,0px),0px,0) scale(.55) rotate(0deg);opacity:0}12%{opacity:1}62%{transform:translate3d(var(--x1,0px),calc(var(--fall) * .7),0) scale(1) rotate(140deg);opacity:1}76%{transform:translate3d(var(--x1,0px),calc(var(--fall) * .55),0) scale(1.12) rotate(175deg);opacity:1}100%{transform:translate3d(0px,calc(var(--fall) * .88),0) scale(.42) rotate(210deg);opacity:0}}' +
            '#tctv-drip .td-coin.td-soft{animation:tdSoft 2.4s ease-in-out forwards}' +
            '@keyframes tdSoft{0%{transform:translate3d(0,8px,0);opacity:0}40%{opacity:.9}100%{transform:translate3d(0,var(--fall),0);opacity:0}}' +
            '#tctv-drip .td-spark{position:absolute;top:0;width:5px;height:5px;margin-left:-2px;border-radius:50%;background:#fff8d6;box-shadow:0 0 6px 2px rgba(255,207,107,.9);animation:tdSpark .8s ease-out forwards;pointer-events:none;will-change:transform,opacity}' +
            '@keyframes tdSpark{0%{transform:translate3d(0,calc(var(--fall) * .72),0) scale(.3);opacity:0}30%{opacity:1}100%{transform:translate3d(var(--sx,8px),calc(var(--fall) * .4),0) scale(1.7);opacity:0}}' +
            '#tctv-drip .td-coin.td-spray{animation:tdSpray .95s ease-out forwards;width:calc(var(--coin) * .75);height:calc(var(--coin) * .75);font-size:calc(var(--coin) * .48);line-height:calc(var(--coin) * .75)}' +
            '@keyframes tdSpray{0%{transform:translate3d(-50%,8px,0) scale(.4);opacity:0}18%{opacity:1}100%{transform:translate3d(var(--sx,0px),var(--sy,20px),0) scale(1);opacity:0}}' +
            '#tctv-drip .td-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;align-items:stretch}' +
            '#tctv-drip .td-share{display:block;margin:0 10px 2px;color:#ffcf6b;font-size:13px;font-weight:800;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
            '#tctv-drip[data-size="3"] .td-share{font-size:14px;margin:1px 12px 2px}' +
            '#tctv-drip[data-size="1"] .td-share{font-size:11px;margin:0 6px 1px}' +
            '@media (max-width:420px){#tctv-drip .td-share{font-size:12px}}' +
            '#tctv-drip .td-share.td-share-hint{font-weight:700;opacity:.92}' +
            '#tctv-drip.td-mini .td-bubble-share{color:#fff;font-weight:800;font-size:12px;margin-left:2px}' +
            '#tctv-drip .td-pill{position:relative;display:inline-flex;align-items:center;min-height:44px;min-width:44px;padding:0 4px;background:none;border:0;cursor:pointer;font-family:inherit;color:#ffcf6b;text-align:left}' +
            '#tctv-drip .td-face{position:relative;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:15px;font-weight:800;white-space:nowrap;overflow:visible}' +
            '#tctv-drip[data-size="3"] .td-face{font-size:18px;padding:6px 12px}' +
            '#tctv-drip[data-size="1"] .td-face{font-size:13px}' +
            '@media (max-width:420px){#tctv-drip .td-face{font-size:13px}#tctv-drip .td-lbl,#tctv-drip .td-n{overflow:hidden;text-overflow:ellipsis}}' +
            '#tctv-drip .td-pill .td-n{color:#fff;font-weight:800}' +
            '#tctv-drip.td-ask .td-face{background:#f7931a;color:#000}#tctv-drip.td-ask .td-pill .td-n{color:#000}' +
            '#tctv-drip .td-tools{display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center}' +
            '#tctv-drip .td-pinfo{background:none;border:0;color:#fff;opacity:.9;font-size:16px;cursor:pointer;min-width:44px;min-height:44px;padding:0}' +
            '#tctv-drip .td-smaller{background:none;border:0;color:#ffcf6b;font-size:13px;font-weight:800;font-family:inherit;cursor:pointer;min-width:44px;min-height:44px;padding:0 8px}' +
            '#tctv-drip .td-larger{background:none;border:0;color:#ffcf6b;font-size:13px;font-weight:800;font-family:inherit;cursor:pointer;min-width:44px;min-height:44px;padding:0 8px}' +
            '#tctv-drip .td-min{background:none;border:0;color:#fff;opacity:.9;font-size:22px;font-weight:800;font-family:inherit;line-height:1;cursor:pointer;min-width:44px;min-height:44px;padding:0}' +
            '#tctv-drip [hidden]{display:none !important}' +
            '#tctv-drip button:focus-visible{outline:2px solid #ffcf6b;outline-offset:2px}' +
            '#tctv-drip .td-ptip,#tctv-drip .td-pop{display:none;position:absolute;left:0;bottom:calc(100% + 8px);box-sizing:border-box;width:min(300px,calc(100vw - 24px));font-size:12px;line-height:1.45;font-weight:400;background:#111;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:9px 11px;box-shadow:0 6px 18px rgba(0,0,0,.5);text-align:left;white-space:normal;color:#fff;cursor:auto;z-index:2}' +
            '#tctv-drip.td-below .td-ptip,#tctv-drip.td-below .td-pop{bottom:auto;top:calc(100% + 8px)}' +
            '#tctv-drip.td-right .td-ptip,#tctv-drip.td-right .td-pop{left:auto;right:0}' +
            '#tctv-drip.td-tipopen .td-ptip,#tctv-drip.td-open .td-pop{display:block}' +
            '@media (hover:hover){#tctv-drip:has(.td-pinfo:hover) .td-ptip{display:block}}' +
            '#tctv-drip .td-bar{height:6px;border-radius:4px;background:rgba(255,255,255,.12);margin:6px 0;overflow:hidden}' +
            '#tctv-drip .td-fill{height:100%;background:linear-gradient(90deg,#f7931a,#ffcf6b);width:0;transition:width .8s ease}' +
            '#tctv-drip .td-live b{color:#4ade80}' +
            '#tctv-drip .td-bubble{display:none;position:relative;align-items:center;gap:6px;min-width:44px;min-height:44px;height:48px;padding:4px 12px 4px 4px;border-radius:999px;border:2px solid #f7931a;background:#1a1205;box-shadow:0 6px 18px rgba(0,0,0,.5);cursor:grab;color:#ffcf6b;font-weight:800;font-family:inherit;font-size:13px}' +
            '#tctv-drip .td-bubble .td-pot{width:40px;height:40px;border-radius:50%;box-shadow:none}' +
            '#tctv-drip .td-bubble .td-fx{top:4px;height:40px;left:4px;right:auto;width:40px;border-radius:50%}' +
            '#tctv-drip.td-mini .td-card{display:none}#tctv-drip.td-mini .td-bubble{display:flex}' +
            '#tctv-drip.td-mini.td-ask .td-bubble{animation:tdPulse 1.2s ease-in-out infinite}' +
            '@keyframes tdPulse{50%{box-shadow:0 0 0 8px rgba(247,147,26,.45),0 0 18px rgba(255,207,107,.8)}}' +
            '#tctv-drip .td-ring{position:absolute;inset:2px;border-radius:inherit;border:3px solid rgba(255,207,107,.95);pointer-events:none;animation:tdRing .8s ease-out forwards}' +
            '@keyframes tdRing{to{transform:scale(1.28);opacity:0}}' +
            '#tctv-drip .td-claim{position:absolute;left:calc(8px + var(--pot) / 2);top:calc(8px + var(--pot) / 2);z-index:3;transform:translate(-50%,-50%);background:#ffcf6b;color:#1a1205;font-weight:900;font-size:14px;line-height:1.2;padding:6px 10px;border-radius:999px;white-space:nowrap;pointer-events:none;box-shadow:0 8px 20px rgba(247,147,26,.45);animation:tdClaim 1.35s ease-out forwards}' +
            '#tctv-drip .td-claim.td-burst{font-size:16px;padding:8px 12px}' +
            '@keyframes tdClaim{0%{opacity:0;transform:translate(-50%,-50%) scale(.75)}16%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}70%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}' +
            '@media (prefers-reduced-motion:reduce){#tctv-drip .td-claim,#tctv-drip .td-ring,#tctv-drip .td-burst,#tctv-drip.td-hello .td-card,#tctv-drip.td-mini.td-ask .td-bubble,#tctv-drip .td-spark{animation:none}#tctv-drip .td-claim{opacity:1}#tctv-drip .td-ring,#tctv-drip .td-spark{display:none}}';
        document.head.appendChild(s);
    }

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function readSize() {
        var n = parseInt(lsGet(SIZE_KEY), 10);
        return n === 1 || n === 2 || n === 3 ? n : 3;
    }
    function clampPlace(el, x, y) {
        var w = el.offsetWidth || 60, h = el.offsetHeight || 52;
        x = Math.max(4, Math.min(x, window.innerWidth - w - 4));
        y = Math.max(4, Math.min(y, window.innerHeight - h - 4));
        el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px';
        el.style.bottom = 'auto'; el.style.right = 'auto';
        el.style.marginLeft = '0'; el.style.marginRight = '0'; el.style.width = 'auto';
        el.classList.toggle('td-below', y < 200);
        el.classList.toggle('td-right', x + w > window.innerWidth * 0.62);
        return { x: x, y: y };
    }
    function restorePos(el) {
        var p = null; try { p = JSON.parse(lsGet(POS_KEY) || 'null'); } catch (e) {}
        if (p && isFinite(p.x) && isFinite(p.y)) clampPlace(el, p.x, p.y);
        else {
            el.style.left = ''; el.style.top = ''; el.style.bottom = ''; el.style.right = '';
            el.style.marginLeft = ''; el.style.marginRight = ''; el.style.width = '';
            el.classList.add('td-below');
            el.classList.toggle('td-right', window.innerWidth > 700);
        }
    }
    function applySize(el, n, persist) {
        if (n !== 1 && n !== 2 && n !== 3) n = 3;
        el.setAttribute('data-size', String(n));
        if (persist) lsSet(SIZE_KEY, String(n));
        var smaller = el.querySelector('.td-smaller');
        var larger = el.querySelector('.td-larger');
        if (smaller) smaller.hidden = n === 1;
        if (larger) larger.hidden = n === 3;
        if (el.style.top) { var r = el.getBoundingClientRect(); clampPlace(el, r.left, r.top); }
    }
    function setMini(el, on) {
        el.classList.toggle('td-mini', on); el.classList.remove('td-open', 'td-tipopen');
        lsSet(MIN_KEY, on ? '1' : '0');
        if (el.style.top) { var r = el.getBoundingClientRect(); clampPlace(el, r.left, r.top); }
    }
    // Pointer drag (mouse + touch). A move under 6px is a tap, so buttons still work.
    function draggable(el) {
        var st = null;
        el.addEventListener('pointerdown', function (e) {
            if (e.button !== undefined && e.button !== 0) return;
            if (e.target.closest('.td-ptip,.td-pop')) return;
            var r = el.getBoundingClientRect();
            st = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
        });
        window.addEventListener('pointermove', function (e) {
            if (!st || e.pointerId !== st.id) return;
            var dx = e.clientX - st.sx, dy = e.clientY - st.sy;
            if (!st.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
            if (!st.moved) { st.moved = true; el.classList.add('td-drag'); }
            clampPlace(el, st.ox + dx, st.oy + dy); e.preventDefault();
        });
        function end(e) {
            if (!st || e.pointerId !== st.id) return;
            if (st.moved) {
                var r = el.getBoundingClientRect(); lsSet(POS_KEY, JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) }));
                el._tdSkipClick = true; setTimeout(function () { el._tdSkipClick = false; }, 0);
            }
            el.classList.remove('td-drag'); st = null;
        }
        window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
        el.addEventListener('click', function (e) { if (el._tdSkipClick) { e.stopPropagation(); e.preventDefault(); } }, true);
        window.addEventListener('resize', function () { if (el.style.top) { var r = el.getBoundingClientRect(); clampPlace(el, r.left, r.top); } });
    }

    function mount() {
        if (!document.querySelector('.tctv-video-wrap')) return null;
        var el = document.getElementById('tctv-drip');
        if (el && el.isConnected) { el.hidden = false; return el; }
        css();
        var img = '<img class="td-pot" src="assets/pot-of-sats.webp" width="136" height="136" alt="" draggable="false">';
        el = document.createElement('div');
        el.id = 'tctv-drip';
        el.innerHTML = '<div class="td-card"><span class="td-potwrap">' + img + '<span class="td-fx" aria-hidden="true"></span></span>' +
            '<div class="td-main"><button type="button" class="td-pill" aria-expanded="false" aria-label="pot of sats details"><span class="td-face"><span class="td-lbl">pot of sats</span> <span class="td-n"><span class="td-sats">0</span>/<span class="td-target">5,000</span></span></span></button>' +
            '<div class="td-share" aria-live="polite"></div>' +
            '<div class="td-tools">' +
            '<button type="button" class="td-pinfo" aria-label="About this button" aria-expanded="false">\u24D8</button>' +
            '<button type="button" class="td-smaller" aria-label="Shrink pot of sats">Shrink</button>' +
            '<button type="button" class="td-larger" aria-label="Enlarge pot of sats">Grow</button>' +
            '<button type="button" class="td-min" aria-label="Minimize pot of sats">\u2013</button>' +
            '</div></div>' +
            '<div class="td-ptip" role="tooltip">You can ignore this, but if you don\u2019t tap it, your watch time won\u2019t be added to the pot of sats.</div>' +
            '<div class="td-pop"><div class="td-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"><div class="td-fill"></div></div>' +
            '<div class="td-live" aria-live="polite"></div>' +
            '<div style="margin-top:6px;opacity:.85">The pot of sats fills a little every minute while people watch Timechain TV together. More viewers, faster fill. When it\u2019s full, the sats are shared with the viewers who helped fill it, based on how long each person watched. Your Share updates live on this pot while you watch. When the pot is full, that share is added to your sats balance to claim. Keep the video playing and this tab open to take part. Drag this anywhere. Tap Shrink or Grow to resize it, or tap \u2013 to minimize it to a small pill. The size and minimized choice stay on this device.</div></div></div>' +
            '<button type="button" class="td-bubble" aria-label="Restore pot of sats">' + img.replace('width="136" height="136"', 'width="40" height="40"') + '<span class="td-bubble-lbl">sats</span><span class="td-bubble-share" hidden></span><span class="td-fx" aria-hidden="true"></span></button>';
        applySize(el, readSize(), false);
        var miniOn = lsGet(MIN_KEY) === '1';
        el.classList.toggle('td-mini', miniOn);
        if (!REDUCED && !miniOn && readSize() === 3) {
            el.classList.add('td-hello');
            setTimeout(function () { el.classList.remove('td-hello'); }, 4600);
        }
        document.body.appendChild(el);
        var pill = el.querySelector('.td-pill'), pinfo = el.querySelector('.td-pinfo');
        pill.addEventListener('click', function () {
            if (el.classList.contains('td-ask')) { hidePrompt(el); celebrate(el, 'Counted!'); checkin(true); return; }
            el.classList.remove('td-tipopen'); pinfo.setAttribute('aria-expanded', 'false');
            var open = el.classList.toggle('td-open');
            pill.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        pinfo.addEventListener('click', function () {
            el.classList.remove('td-open'); pill.setAttribute('aria-expanded', 'false');
            var o = el.classList.toggle('td-tipopen');
            pinfo.setAttribute('aria-expanded', o ? 'true' : 'false');
        });
        el.querySelector('.td-smaller').addEventListener('click', function () {
            applySize(el, Math.max(1, (parseInt(el.getAttribute('data-size'), 10) || 3) - 1), true);
        });
        el.querySelector('.td-larger').addEventListener('click', function () {
            applySize(el, Math.min(3, (parseInt(el.getAttribute('data-size'), 10) || 1) + 1), true);
        });
        el.querySelector('.td-min').addEventListener('click', function () { setMini(el, true); });
        el.querySelector('.td-bubble').addEventListener('click', function () {
            if (el.classList.contains('td-ask')) { hidePrompt(el); celebrate(el, 'Counted!'); checkin(true); }
            setMini(el, false);
        });
        draggable(el);
        restorePos(el);
        startFlow();
        return el;
    }


    function shareLine() {
        var u = user();
        if (!u) return { text: 'Sign in to see your share', hint: true, bubble: '' };
        if (!myShare || myShare.ready !== true) return { text: 'Your Share: \u2026', hint: false, bubble: '\u2026' };
        var n = Math.max(0, Math.floor(myShare.sats || 0));
        var text = 'Your Share: ' + fmt(n) + ' sats';
        if (myShare.waiting && n > 0) text += ' (waiting)';
        return { text: text, hint: false, bubble: fmt(n) };
    }
    function paintShare(el) {
        if (!el) return;
        var s = shareLine();
        var line = el.querySelector('.td-share');
        if (line) {
            line.textContent = s.text;
            line.classList.toggle('td-share-hint', !!s.hint);
        }
        var bub = el.querySelector('.td-bubble-share');
        if (bub) {
            if (s.hint || !s.bubble) { bub.hidden = true; bub.textContent = ''; }
            else { bub.hidden = false; bub.textContent = s.bubble; }
        }
    }
    function stopWatch() {
        if (watchUnsub) { watchUnsub(); watchUnsub = null; }
        sharePotId = '';
        myShare = null;
    }
    function listenWatch() {
        var u = user();
        var potId = pot && pot.potId ? String(pot.potId) : '';
        if (!u || !potId || typeof firebase === 'undefined' || !firebase.firestore) {
            if (!u) { myShare = null; sharePotId = ''; }
            if (watchUnsub && (!u || !potId)) stopWatch();
            return;
        }
        if (watchUnsub && sharePotId === potId) return;
        stopWatch();
        sharePotId = potId;
        myShare = { ready: false, sats: 0, waiting: false };
        var id = potId + '_' + u.uid;
        watchUnsub = firebase.firestore().collection('tctv_drip_watch').doc(id).onSnapshot(function (snap) {
            if (!snap.exists) { myShare = { ready: true, sats: 0, waiting: false }; }
            else {
                var d = snap.data() || {};
                myShare = {
                    ready: typeof d.projectedShareSats === 'number',
                    sats: Math.max(0, Math.floor(Number(d.projectedShareSats) || 0)),
                    waiting: d.projectedShareWaiting === true
                };
                // Doc exists but tick has not projected yet: keep "…" until the field appears.
                if (typeof d.projectedShareSats !== 'number') myShare.ready = false;
            }
            var el = document.getElementById('tctv-drip'); if (el) paintShare(el);
        }, function () {});
    }

    function paint() {
        var el = mount(); if (!el || !pot) return;
        var target = pot.target || 5000, sats = pot.sats || 0;
        el.querySelector('.td-sats').textContent = fmt(sats);
        el.querySelector('.td-target').textContent = fmt(target);
        var pct = Math.max(0, Math.min(100, sats / target * 100));
        el.querySelector('.td-fill').style.width = pct.toFixed(2) + '%';
        el.querySelector('.td-bar').setAttribute('aria-valuenow', String(Math.round(pct)));
        var n = pot.liveViewers || 0;
        var rate = Number(pot.ratePerMin);
        var line = pot.status === 'filling'
            ? (Number.isFinite(rate)
                ? '~' + esc(fmt(rate)) + ' sats/min \u00b7 <b>' + esc(fmt(n)) + '</b> watching'
                : '<b>' + esc(fmt(n)) + '</b> watching right now')
            : pot.waiting === true ? 'Pot is full! It\u2019s shared once enough viewers have watched long enough. Keep watching to take part.'
            : (pot.status === 'full' || pot.status === 'distributing' ? 'Pot is full! Sharing it with viewers\u2026' : 'Pot is full! Sharing will start soon.');
        el.querySelector('.td-live').innerHTML = line;
        if (lastBursts !== null && (pot.bursts || 0) > lastBursts) burst(Math.floor(sats / 1000) * 1000);
        lastBursts = pot.bursts || 0;
        scheduleDrops(n);
        listenWatch();
        paintShare(el);
    }

    function celebrate(el, text) {
        var host = el.classList.contains('td-mini') ? el.querySelector('.td-bubble') : el.querySelector('.td-card');
        var fx = el.querySelector(el.classList.contains('td-mini') ? '.td-bubble .td-fx' : '.td-card .td-fx');
        if (!host) return;
        var old = el.querySelectorAll('.td-claim,.td-ring');
        for (var i = 0; i < old.length; i++) old[i].remove();
        var ring = document.createElement('span');
        ring.className = 'td-ring';
        ring.setAttribute('aria-hidden', 'true');
        (fx || host).appendChild(ring);
        var tag = document.createElement('span');
        tag.className = 'td-claim' + (text.indexOf('sats') !== -1 ? ' td-burst' : '');
        tag.textContent = text;
        host.appendChild(tag);
        setTimeout(function () { ring.remove(); tag.remove(); }, REDUCED ? 1600 : 1400);
        if (REDUCED || !fx) return;
        for (var k = 0; k < 7; k++) {
            var c = document.createElement('span');
            c.className = 'td-coin td-spray';
            c.textContent = '\u20BF';
            c.setAttribute('aria-hidden', 'true');
            c.style.left = '50%';
            var ang = (25 + k * 20) * Math.PI / 180;
            var dist = 18 + (k % 3) * 8;
            c.style.setProperty('--sx', Math.round(Math.cos(ang) * dist) + 'px');
            c.style.setProperty('--sy', Math.round(Math.sin(ang) * dist) + 'px');
            c.addEventListener('animationend', function () { this.remove(); });
            fx.appendChild(c);
        }
    }
    function burst(amount) {
        var el = document.getElementById('tctv-drip'); if (!el) return;
        celebrate(el, '\u26A1 ' + fmt(amount) + ' sats!');
    }
    window._tctvDripBurst = burst;

    // Sats always flow into the pot, even with one viewer. More viewers = more and faster coins (capped).
    var flowRaf = 0, flowLast = 0, flowAcc = 0, flowViewers = 1;
    function scheduleDrops(n) { flowViewers = Math.max(1, n || 0); }
    function coinBudget(el) {
        if (REDUCED) return 4;
        var cores = navigator.hardwareConcurrency || 8;
        var narrow = window.innerWidth <= 360;
        var cap = (cores <= 4 || narrow) ? 12 : 18;
        if (el && el.classList.contains('td-mini')) cap = Math.min(cap, 8);
        return cap;
    }
    function spawnCoin(el) {
        var fx = el.querySelector(el.classList.contains('td-mini') ? '.td-bubble .td-fx' : '.td-card .td-fx');
        if (!fx || fx.childElementCount >= coinBudget(el)) return;
        var c = document.createElement('span');
        c.className = 'td-coin' + (REDUCED ? ' td-soft' : '');
        c.textContent = '\u20BF';
        c.setAttribute('aria-hidden', 'true');
        c.style.left = (22 + Math.random() * 56) + '%';
        if (!REDUCED) {
            c.style.setProperty('--x0', Math.round((Math.random() - 0.5) * 48) + 'px');
            c.style.setProperty('--x1', Math.round((Math.random() - 0.5) * 22) + 'px');
            c.style.setProperty('--d', Math.max(0.85, 1.45 - Math.min(flowViewers, 40) * 0.012).toFixed(2) + 's');
        }
        c.addEventListener('animationend', function () { c.remove(); });
        fx.appendChild(c);
        var narrow = window.innerWidth <= 360 || (navigator.hardwareConcurrency || 8) <= 4;
        if (!REDUCED && fx.childElementCount < coinBudget(el) && Math.random() < (narrow ? 0.28 : 0.55)) {
            var sp = document.createElement('span');
            sp.className = 'td-spark';
            sp.setAttribute('aria-hidden', 'true');
            sp.style.left = c.style.left;
            sp.style.setProperty('--sx', Math.round((Math.random() - 0.5) * 28) + 'px');
            sp.addEventListener('animationend', function () { sp.remove(); });
            fx.appendChild(sp);
        }
    }
    function flowTick(t) {
        flowRaf = 0;
        var el = document.getElementById('tctv-drip');
        if (!el || el.hidden || document.visibilityState !== 'visible') return;
        var dt = flowLast ? Math.min(250, t - flowLast) : 0; flowLast = t;
        var mini = el.classList.contains('td-mini');
        var rate = REDUCED ? 0.4 : Math.min(mini ? 3.2 : 6.5, (mini ? 1.5 : 2.8) + Math.sqrt(flowViewers) * (mini ? 0.35 : 0.8));
        flowAcc += dt / 1000 * rate;
        var guard = 0;
        while (flowAcc >= 1 && guard < 3) { flowAcc -= 1; guard += 1; spawnCoin(el); }
        flowRaf = requestAnimationFrame(flowTick);
    }
    function startFlow() { if (!flowRaf) { flowLast = 0; flowRaf = requestAnimationFrame(flowTick); } }
    function stopFlow() { if (flowRaf) cancelAnimationFrame(flowRaf); flowRaf = 0; }
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && document.getElementById('tctv-drip')) startFlow(); else stopFlow(); });
    window._tctvDripPaint = function (p) { pot = p; paint(); };

    // The pill itself becomes the "Still watching?" button for the 2-minute
    // answer window; ignoring it only means that watch time isn't credited.
    var promptHide = null;
    function hidePrompt(el) {
        el.classList.remove('td-ask');
        var l = el.querySelector('.td-lbl'); if (l) l.textContent = 'pot of sats';
        el.querySelector('.td-pill').setAttribute('aria-label', 'pot of sats details');
        if (promptHide) { clearTimeout(promptHide); promptHide = null; }
    }
    function showPrompt(el) {
        if (el.classList.contains('td-ask')) return;
        el.classList.remove('td-open');
        el.classList.add('td-ask');
        el.querySelector('.td-lbl').textContent = 'Still watching? Tap';
        el.querySelector('.td-pill').setAttribute('aria-label', 'Still watching? Tap to add your watch time to the pot of sats');
        if (promptHide) clearTimeout(promptHide);
        promptHide = setTimeout(function () { hidePrompt(el); }, 120000);
    }
    window._tctvDripShowPrompt = function () { var el = document.getElementById('tctv-drip'); if (el) showPrompt(el); };

    function checkin(answer) {
        if (inflight || !user() || !onTv()) return;
        var vis = document.visibilityState === 'visible', play = playing();
        if (!vis || !play) return;
        inflight = true;
        try {
            firebase.functions().httpsCallable('tctvDripCheckin')({
                deviceId: deviceId(), visible: vis, playing: play,
                promptToken: answer ? promptToken : ''
            }).then(function (res) {
                var d = (res && res.data) || {};
                var el = document.getElementById('tctv-drip');
                if (d.prompt && el) { promptToken = d.promptToken || ''; showPrompt(el); }
            }).catch(function () {}).then(function () { inflight = false; });
        } catch (e) { inflight = false; }
    }

    function listen() {
        if (unsub || typeof firebase === 'undefined' || !firebase.firestore) return;
        unsub = firebase.firestore().collection('tctv_drip_pot').doc('current').onSnapshot(function (s) {
            pot = s.exists ? s.data() : null; paint();
        }, function () {});
    }
    function stop() {
        if (unsub) { unsub(); unsub = null; }
        stopWatch();
        if (dropTimer) { clearInterval(dropTimer); dropTimer = null; }
        if (timer) { clearInterval(timer); timer = null; }
        stopFlow();
        var el = document.getElementById('tctv-drip'); if (el && !onTv()) el.hidden = true;
        lastBursts = null;
    }

    setInterval(function () {
        if (!onTv() || document.visibilityState !== 'visible') { stop(); return; }
        mount(); listen(); startFlow();
        if (!timer) timer = setInterval(checkin, CHECK_MS);
    }, 2000);
})();
