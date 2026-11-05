// Timechain TV drip pot widget. Shows the shared pot, a live "N watching"
// line, a sats-drop animation scaled by viewers, and a burst every 1,000
// sats. Check-ins go to tctvDripCheckin once a minute only while the tab is
// visible and the video is playing. The server does all the math.
(function () {
    'use strict';
    var CHECK_MS = 60000;
    var timer = null, inflight = false, unsub = null, lastBursts = null, promptToken = '';
    var pot = null, dropTimer = null;

    function user() {
        try { var u = firebase.auth().currentUser; return u && !u.isAnonymous ? u : null; } catch (e) { return null; }
    }
    function onTv() { return window._tctvActive === true && !!document.getElementById('tctv-video-wrap'); }
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
        s.textContent = '#tctv-drip{position:relative;margin:12px auto 0;max-width:640px;padding:12px 14px;border-radius:12px;background:linear-gradient(135deg,#1a1205,#2a1a05);border:1px solid rgba(247,147,26,.45);color:#fff;overflow:hidden;font-family:inherit}' +
            '#tctv-drip .td-row{display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap}' +
            '#tctv-drip .td-title{font-weight:800;color:#f7931a;font-size:15px;display:flex;align-items:center;gap:6px}' +
            '#tctv-drip .td-info{background:none;border:1px solid rgba(255,255,255,.35);color:#fff;border-radius:50%;width:22px;height:22px;font-size:12px;cursor:pointer;min-width:22px;padding:0}' +
            '#tctv-drip .td-amt{font-weight:800;font-size:18px}' +
            '#tctv-drip .td-bar{height:10px;border-radius:6px;background:rgba(255,255,255,.12);margin:8px 0 6px;overflow:hidden}' +
            '#tctv-drip .td-fill{height:100%;background:linear-gradient(90deg,#f7931a,#ffcf6b);width:0;transition:width .8s ease}' +
            '#tctv-drip .td-live{font-size:13px;opacity:.9}#tctv-drip .td-live b{color:#4ade80}' +
            '#tctv-drip .td-tip{display:none;margin-top:8px;font-size:13px;line-height:1.45;background:rgba(0,0,0,.35);padding:8px 10px;border-radius:8px}' +
            '#tctv-drip.td-open .td-tip{display:block}' +
            '#tctv-drip .td-drop{position:absolute;top:-16px;font-size:14px;pointer-events:none;animation:tdDrop 1.6s linear forwards;will-change:transform}' +
            '@keyframes tdDrop{to{transform:translateY(120px);opacity:0}}' +
            '#tctv-drip .td-burst{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:22px;color:#ffcf6b;background:radial-gradient(circle,rgba(247,147,26,.55),transparent 70%);animation:tdBurst 1.8s ease-out forwards;pointer-events:none}' +
            '@keyframes tdBurst{0%{transform:scale(.4);opacity:0}25%{transform:scale(1.1);opacity:1}100%{transform:scale(1.4);opacity:0}}' +
            '#tctv-drip .td-prompt{margin-top:8px;display:flex;gap:8px;align-items:center;font-size:13px}' +
            '#tctv-drip .td-prompt[hidden]{display:none}' +
            '#tctv-drip .td-prompt button{background:#f7931a;color:#000;border:0;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;min-height:32px}' +
            '@media (prefers-reduced-motion:reduce){#tctv-drip .td-drop,#tctv-drip .td-burst{animation:none;display:none}}';
        document.head.appendChild(s);
    }

    function mount() {
        var wrap = document.getElementById('tctv-video-wrap');
        if (!wrap) return null;
        var el = document.getElementById('tctv-drip');
        if (el && el.isConnected) return el;
        css();
        el = document.createElement('div');
        el.id = 'tctv-drip';
        el.innerHTML = '<div class="td-row"><div class="td-title">⚡ Watch Party Pot <button class="td-info" type="button" aria-label="How the pot works" aria-expanded="false">?</button></div>' +
            '<div class="td-amt"><span class="td-sats">0</span> <span style="font-size:12px;opacity:.7">/ <span class="td-target">5,000</span> sats</span></div></div>' +
            '<div class="td-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"><div class="td-fill"></div></div>' +
            '<div class="td-live" aria-live="polite"></div>' +
            '<div class="td-tip">The pot fills a little every minute while people watch Timechain TV together. More viewers, faster fill. When it\u2019s full, the sats are shared with the viewers who helped fill it, based on how long each person watched. Your share shows up in your sats balance to claim. Keep the video playing and this tab open to take part.</div>' +
            '<div class="td-prompt" hidden><span>Still watching?</span><button type="button" class="td-yes">Yes, I\u2019m here</button></div>';
        wrap.parentNode.insertBefore(el, wrap.nextSibling);
        var info = el.querySelector('.td-info');
        info.addEventListener('click', function () {
            var open = el.classList.toggle('td-open');
            info.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        el.querySelector('.td-yes').addEventListener('click', function () { el.querySelector('.td-prompt').hidden = true; checkin(true); });
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
        el.appendChild(b); setTimeout(function () { b.remove(); }, 1900);
    }
    window._tctvDripBurst = burst;

    function drop() {
        var el = document.getElementById('tctv-drip');
        if (!el || document.visibilityState !== 'visible') return;
        if (el.querySelectorAll('.td-drop').length > 12) return;
        var d = document.createElement('span'); d.className = 'td-drop'; d.textContent = '\u26A1';
        d.style.left = (5 + Math.random() * 90) + '%';
        el.appendChild(d); setTimeout(function () { d.remove(); }, 1700);
    }
    function scheduleDrops(n) {
        if (dropTimer) { clearInterval(dropTimer); dropTimer = null; }
        if (!n || !pot || pot.status !== 'filling') return;
        // More viewers, more drops: 1 viewer ~ every 4s, 50 viewers ~ 4 per second.
        var every = Math.max(250, 4000 / Math.min(n, 50) * (n > 1 ? 1.25 : 1));
        dropTimer = setInterval(drop, every);
    }
    window._tctvDripPaint = function (p) { pot = p; paint(); };

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
                if (d.prompt && el) { promptToken = d.promptToken || ''; el.querySelector('.td-prompt').hidden = false; }
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
