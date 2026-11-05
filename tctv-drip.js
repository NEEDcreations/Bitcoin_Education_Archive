// Timechain TV pot of sats: a floating, draggable, minimizable pot overlay with
// sats always flowing in (faster with more viewers). Tap for the pot details; an ⓘ explains the check-in. A short burst every 1,000 sats. Check-ins go to tctvDripCheckin once a minute only while the tab is
// visible and the video is playing. The server does all the math.
(function () {
    'use strict';
    var CHECK_MS = 60000;
    var timer = null, inflight = false, unsub = null, lastBursts = null, promptToken = '';
    var pot = null, dropTimer = null;

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

    var POS_KEY = 'tctvPotPos', MIN_KEY = 'tctvPotMin';
    var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    function css() {
        if (document.getElementById('tctv-drip-css')) return;
        var s = document.createElement('style'); s.id = 'tctv-drip-css';
        // Floating overlay, outside the player's layout so the video stays centered. Draggable, minimizable,
        // and it remembers its spot on this device. Default spot is the bottom-left, clear of player controls.
        s.textContent = '#tctv-drip{position:fixed;right:16px;bottom:96px;z-index:200001;font-family:inherit;color:#fff;touch-action:none;user-select:none;-webkit-user-select:none;max-width:calc(100vw - 16px)}' +
            '#tctv-drip[hidden]{display:none}@media (max-width:700px){#tctv-drip{right:auto;left:12px;bottom:150px}}' +
            '#tctv-drip .td-card{position:relative;display:flex;align-items:center;gap:2px;padding:2px 2px 2px 4px;border-radius:999px;background:rgba(17,12,4,.88);border:1px solid rgba(247,147,26,.55);box-shadow:0 6px 18px rgba(0,0,0,.5);cursor:grab}' +
            '#tctv-drip.td-drag .td-card,#tctv-drip.td-drag .td-bubble{cursor:grabbing}' +
            '#tctv-drip .td-potwrap{position:relative;flex:none;width:44px;height:44px}' +
            '#tctv-drip .td-pot{width:44px;height:44px;border-radius:50%;display:block;object-fit:cover;pointer-events:none}' +
            '#tctv-drip .td-fx{position:absolute;left:0;right:0;top:-34px;bottom:14px;overflow:visible;pointer-events:none}' +
            '#tctv-drip .td-coin{position:absolute;top:0;width:11px;height:11px;margin-left:-5px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ffe08a,#f7931a 60%,#b85f00);color:#3a1d00;font-size:8px;line-height:11px;text-align:center;font-weight:900;box-shadow:0 0 6px rgba(247,147,26,.9);animation:tdFall var(--d,1.2s) cubic-bezier(.45,0,.9,.6) forwards;will-change:transform,opacity}' +
            '@keyframes tdFall{0%{transform:translate(var(--x0,0),0) scale(.7);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translate(0,34px) scale(.45);opacity:0}}' +
            '#tctv-drip .td-coin.td-soft{animation:tdSoft 2.4s ease-in-out forwards}' +
            '@keyframes tdSoft{0%{transform:translateY(18px);opacity:0}50%{opacity:.9}100%{transform:translateY(30px);opacity:0}}' +
            '#tctv-drip .td-pill{position:relative;display:inline-flex;align-items:center;min-height:44px;min-width:44px;padding:0 4px;background:none;border:0;cursor:pointer;font-family:inherit;color:#ffcf6b}' +
            '#tctv-drip .td-face{position:relative;display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden}' +
            '#tctv-drip .td-pill .td-n{color:#fff;font-weight:800}' +
            '#tctv-drip.td-ask .td-face{background:#f7931a;color:#000}#tctv-drip.td-ask .td-pill .td-n{color:#000}' +
            '#tctv-drip .td-min,#tctv-drip .td-pinfo{background:none;border:0;color:#fff;opacity:.75;font-size:15px;cursor:pointer;min-width:44px;min-height:44px;padding:0}' +
            '#tctv-drip .td-ptip,#tctv-drip .td-pop{display:none;position:absolute;left:0;bottom:calc(100% + 8px);box-sizing:border-box;width:min(300px,calc(100vw - 24px));font-size:12px;line-height:1.45;font-weight:400;background:#111;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:9px 11px;box-shadow:0 6px 18px rgba(0,0,0,.5);text-align:left;white-space:normal;color:#fff;cursor:auto}' +
            '#tctv-drip.td-below .td-ptip,#tctv-drip.td-below .td-pop{bottom:auto;top:calc(100% + 8px)}' +
            '#tctv-drip.td-right .td-ptip,#tctv-drip.td-right .td-pop{left:auto;right:0}' +
            '#tctv-drip.td-tipopen .td-ptip,#tctv-drip.td-open .td-pop{display:block}' +
            '@media (hover:hover){#tctv-drip .td-pinfo:hover~.td-ptip{display:block}}' +
            '#tctv-drip .td-bar{height:6px;border-radius:4px;background:rgba(255,255,255,.12);margin:6px 0;overflow:hidden}' +
            '#tctv-drip .td-fill{height:100%;background:linear-gradient(90deg,#f7931a,#ffcf6b);width:0;transition:width .8s ease}' +
            '#tctv-drip .td-live b{color:#4ade80}' +
            '#tctv-drip .td-bubble{display:none;position:relative;width:52px;height:52px;padding:0;border-radius:50%;border:2px solid #f7931a;background:#1a1205;box-shadow:0 6px 18px rgba(0,0,0,.5);cursor:grab;overflow:visible}' +
            '#tctv-drip .td-bubble .td-pot{width:48px;height:48px}' +
            '#tctv-drip.td-mini .td-card{display:none}#tctv-drip.td-mini .td-bubble{display:block}' +
            '#tctv-drip.td-mini.td-ask .td-bubble{animation:tdPulse 1.2s ease-in-out infinite}' +
            '@keyframes tdPulse{50%{box-shadow:0 0 0 6px rgba(247,147,26,.45)}}' +
            '#tctv-drip .td-burst{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;color:#000;background:#ffcf6b;border-radius:999px;animation:tdBurst 1.8s ease-out forwards;pointer-events:none}' +
            '@keyframes tdBurst{0%{opacity:0}20%{opacity:1}80%{opacity:1}100%{opacity:0}}' +
            '@media (prefers-reduced-motion:reduce){#tctv-drip .td-burst,#tctv-drip.td-mini.td-ask .td-bubble{animation:none}}';
        document.head.appendChild(s);
    }

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function clampPlace(el, x, y) {
        var w = el.offsetWidth || 60, h = el.offsetHeight || 52;
        x = Math.max(4, Math.min(x, window.innerWidth - w - 4));
        y = Math.max(4, Math.min(y, window.innerHeight - h - 4));
        el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px'; el.style.bottom = 'auto'; el.style.right = 'auto';
        el.classList.toggle('td-below', y < 180);
        el.classList.toggle('td-right', x > window.innerWidth / 2);
        return { x: x, y: y };
    }
    function restorePos(el) {
        var p = null; try { p = JSON.parse(lsGet(POS_KEY) || 'null'); } catch (e) {}
        if (p && isFinite(p.x) && isFinite(p.y)) clampPlace(el, p.x, p.y);
        else { el.style.left = ''; el.style.top = ''; el.style.bottom = ''; el.style.right = ''; el.classList.remove('td-below'); el.classList.toggle('td-right', window.innerWidth > 700); }
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
        var img = '<img class="td-pot" src="assets/pot-of-sats.webp" width="44" height="44" alt="" draggable="false">';
        el = document.createElement('div');
        el.id = 'tctv-drip';
        el.innerHTML = '<div class="td-card"><span class="td-potwrap">' + img + '<span class="td-fx" aria-hidden="true"></span></span>' +
            '<button type="button" class="td-pill" aria-expanded="false" aria-label="pot of sats details"><span class="td-face"><span class="td-lbl">pot of sats</span> <span class="td-n"><span class="td-sats">0</span>/<span class="td-target">5,000</span></span></span></button>' +
            '<button type="button" class="td-pinfo" aria-label="About this button" aria-expanded="false">\u24D8</button>' +
            '<button type="button" class="td-min" aria-label="Minimize pot of sats">\u2013</button>' +
            '<div class="td-ptip" role="tooltip">You can ignore this, but if you don\u2019t tap it, your watch time won\u2019t be added to the pot of sats.</div>' +
            '<div class="td-pop"><div class="td-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"><div class="td-fill"></div></div>' +
            '<div class="td-live" aria-live="polite"></div>' +
            '<div style="margin-top:6px;opacity:.85">The pot of sats fills a little every minute while people watch Timechain TV together. More viewers, faster fill. When it\u2019s full, the sats are shared with the viewers who helped fill it, based on how long each person watched. Your share shows up in your sats balance to claim. Keep the video playing and this tab open to take part. Drag this anywhere, or tap \u2013 to shrink it.</div></div></div>' +
            '<button type="button" class="td-bubble" aria-label="Open pot of sats">' + img.replace('width="44" height="44"', 'width="48" height="48"') + '<span class="td-fx" aria-hidden="true"></span></button>';
        document.body.appendChild(el);
        var pill = el.querySelector('.td-pill'), pinfo = el.querySelector('.td-pinfo');
        pill.addEventListener('click', function () {
            if (el.classList.contains('td-ask')) { hidePrompt(el); checkin(true); return; }
            el.classList.remove('td-tipopen'); pinfo.setAttribute('aria-expanded', 'false');
            var open = el.classList.toggle('td-open');
            pill.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        pinfo.addEventListener('click', function () {
            el.classList.remove('td-open'); pill.setAttribute('aria-expanded', 'false');
            var o = el.classList.toggle('td-tipopen');
            pinfo.setAttribute('aria-expanded', o ? 'true' : 'false');
        });
        el.querySelector('.td-min').addEventListener('click', function () { setMini(el, true); });
        el.querySelector('.td-bubble').addEventListener('click', function () {
            if (el.classList.contains('td-ask')) { hidePrompt(el); checkin(true); }
            setMini(el, false);
        });
        el.classList.toggle('td-mini', lsGet(MIN_KEY) === '1');
        draggable(el);
        restorePos(el);
        startFlow();
        return el;
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
        var line = pot.status === 'filling'
            ? '<b>' + esc(fmt(n)) + '</b> watching right now'
            : pot.waiting === true ? 'Pot is full! It\u2019s shared once enough viewers have watched long enough. Keep watching to take part.'
            : (pot.status === 'full' || pot.status === 'distributing' ? 'Pot is full! Sharing it with viewers\u2026' : 'Pot is full! Sharing will start soon.');
        el.querySelector('.td-live').innerHTML = line;
        if (lastBursts !== null && (pot.bursts || 0) > lastBursts) burst(Math.floor(sats / 1000) * 1000);
        lastBursts = pot.bursts || 0;
        scheduleDrops(n);
    }

    function burst(amount) {
        var el = document.getElementById('tctv-drip'); if (!el) return;
        var b = document.createElement('div'); b.className = 'td-burst';
        b.textContent = '\u26A1 ' + fmt(amount) + ' sats!';
        (el.querySelector('.td-face') || el).appendChild(b); setTimeout(function () { b.remove(); }, 1900);
    }
    window._tctvDripBurst = burst;

    // Sats always flow into the pot, even with one viewer. More viewers = more and faster coins (capped).
    var flowRaf = 0, flowLast = 0, flowAcc = 0, flowViewers = 1;
    function scheduleDrops(n) { flowViewers = Math.max(1, n || 0); }
    function spawnCoin(el) {
        var fx = el.querySelector(el.classList.contains('td-mini') ? '.td-bubble .td-fx' : '.td-card .td-fx');
        if (!fx || fx.childElementCount >= (REDUCED ? 3 : 24)) return;
        var c = document.createElement('span'); c.className = 'td-coin' + (REDUCED ? ' td-soft' : ''); c.textContent = '\u20BF';
        c.style.left = (35 + Math.random() * 30) + '%';
        if (!REDUCED) {
            c.style.setProperty('--x0', Math.round((Math.random() - 0.5) * 24) + 'px');
            c.style.setProperty('--d', Math.max(0.6, 1.4 - Math.min(flowViewers, 40) * 0.02).toFixed(2) + 's');
        }
        c.addEventListener('animationend', function () { c.remove(); });
        fx.appendChild(c);
    }
    function flowTick(t) {
        flowRaf = 0;
        var el = document.getElementById('tctv-drip');
        if (!el || el.hidden || document.visibilityState !== 'visible') return;
        var dt = flowLast ? Math.min(250, t - flowLast) : 0; flowLast = t;
        var rate = REDUCED ? 0.35 : Math.min(10, 1.2 + Math.sqrt(flowViewers) * 1.3); // coins per second
        flowAcc += dt / 1000 * rate;
        while (flowAcc >= 1) { flowAcc -= 1; spawnCoin(el); }
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
