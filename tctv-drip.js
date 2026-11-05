// Timechain TV pot of sats: a small pill beside the player. Tap for the
// pot details; an ⓘ explains the check-in. A short burst every 1,000 sats. Check-ins go to tctvDripCheckin once a minute only while the tab is
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

    function css() {
        if (document.getElementById('tctv-drip-css')) return;
        var s = document.createElement('style'); s.id = 'tctv-drip-css';
        // Small pill under the player's left edge (the remote sits on the right), outside the video, so it
        // never covers the picture or the player controls.
        s.textContent = '#tctv-drip{flex:0 0 100%;display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-start;position:relative;max-width:1100px;margin:-2px auto 0;font-family:inherit;color:#fff}' +
            '#tctv-drip .td-pill{position:relative;display:inline-flex;align-items:center;min-height:44px;min-width:44px;padding:0;background:none;border:0;cursor:pointer;font-family:inherit}' +
            '#tctv-drip .td-face{position:relative;display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:999px;background:rgba(247,147,26,.12);border:1px solid rgba(247,147,26,.45);color:#ffcf6b;font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden}' +
            '#tctv-drip .td-pill .td-n{color:#fff;font-weight:800}' +
            '#tctv-drip.td-ask .td-face{background:#f7931a;color:#000;border-color:#f7931a}#tctv-drip.td-ask .td-pill .td-n{color:#000}' +
            '#tctv-drip .td-pinfo{background:none;border:0;color:#fff;opacity:.7;font-size:15px;cursor:pointer;min-width:44px;min-height:44px;padding:0}' +
            '#tctv-drip .td-ptip,#tctv-drip .td-pop{display:none;flex:0 0 100%;box-sizing:border-box;max-width:420px;margin:0 0 6px;font-size:12px;line-height:1.45;font-weight:400;background:#111;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:9px 11px;box-shadow:0 6px 18px rgba(0,0,0,.5);text-align:left;white-space:normal;color:#fff}' +
            '#tctv-drip.td-tipopen .td-ptip,#tctv-drip.td-open .td-pop{display:block}' +
            '@media (hover:hover){#tctv-drip .td-pinfo:hover~.td-ptip{display:block}}' +
            '#tctv-drip .td-bar{height:6px;border-radius:4px;background:rgba(255,255,255,.12);margin:6px 0;overflow:hidden}' +
            '#tctv-drip .td-fill{height:100%;background:linear-gradient(90deg,#f7931a,#ffcf6b);width:0;transition:width .8s ease}' +
            '#tctv-drip .td-live b{color:#4ade80}' +
            '#tctv-drip .td-burst{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;color:#000;background:#ffcf6b;border-radius:999px;animation:tdBurst 1.8s ease-out forwards;pointer-events:none}' +
            '@keyframes tdBurst{0%{opacity:0}20%{opacity:1}80%{opacity:1}100%{opacity:0}}' +
            '@media (prefers-reduced-motion:reduce){#tctv-drip .td-burst{animation:none;display:none}}';
        document.head.appendChild(s);
    }

    function mount() {
        var wrap = document.querySelector('.tctv-video-wrap');
        if (!wrap) return null;
        var el = document.getElementById('tctv-drip');
        if (el && el.isConnected) return el;
        css();
        el = document.createElement('div');
        el.id = 'tctv-drip';
        el.innerHTML = '<button type="button" class="td-pill" aria-expanded="false" aria-label="pot of sats details"><span class="td-face">\u26A1 <span class="td-lbl">pot of sats</span> <span class="td-n"><span class="td-sats">0</span>/<span class="td-target">5,000</span></span></span></button>' +
            '<button type="button" class="td-pinfo" aria-label="About this button" aria-expanded="false">\u24D8</button>' +
            '<div class="td-ptip" role="tooltip">You can ignore this, but if you don\u2019t tap it, your watch time won\u2019t be added to the pot of sats.</div>' +
            '<div class="td-pop"><div class="td-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"><div class="td-fill"></div></div>' +
            '<div class="td-live" aria-live="polite"></div>' +
            '<div style="margin-top:6px;opacity:.85">The pot of sats fills a little every minute while people watch Timechain TV together. More viewers, faster fill. When it\u2019s full, the sats are shared with the viewers who helped fill it, based on how long each person watched. Your share shows up in your sats balance to claim. Keep the video playing and this tab open to take part.</div></div>';
        wrap.parentNode.insertBefore(el, wrap.nextSibling);
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

    function scheduleDrops() {}
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
        lastBursts = null;
    }

    setInterval(function () {
        if (!onTv() || document.visibilityState !== 'visible') { stop(); return; }
        mount(); listen();
        if (!timer) timer = setInterval(checkin, CHECK_MS);
    }, 2000);
})();
