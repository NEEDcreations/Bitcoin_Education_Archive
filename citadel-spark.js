// Citadel Spark launch pieces in the app (RLDA-38).
// Everything here is behind one time gate: nothing changes until
// Saturday, Nov 28, 2026, 12:00 AM ET (05:00 UTC). Before that the Citadel tab
// and the More quests row look exactly as they do today, so this file can be
// deployed early and flips on its own at the launch time.
//
// After launch:
// - The Citadel tab label reads LAUNCHING JANUARY 3, 2027 (was Coming Soon).
// - The tab shows the teaser (no autoplay, sound on when the player taps play,
//   a large centered play button), the three Waitlist images, and the Waitlist
//   email signup. The signup posts to the same /api/waitlist Worker as the
//   public page, with the same Turnstile check, consent and honeypot fields,
//   tagged src=app-citadels.
// - The Citadel row in More quests gets a purple/blue Citadel Spark glow.
//
// QA preview before launch: on staging or localhost only, add ?cs_preview=1
// to the URL (remembered for the tab session). Production ignores it.
(function () {
    'use strict';

    var LAUNCH_AT = Date.UTC(2026, 10, 28, 5, 0, 0); // Sat Nov 28, 2026, 12:00 AM ET
    var WAITLIST_SRC = 'app-citadels';
    var TURNSTILE_SITEKEY = '0x4AAAAAAD-ivgpRkbXpgz86';
    var TEASER_SRC = '/images/waitlist/citadel-spark-teaser.mp4';
    var TEASER_POSTER = '/images/waitlist/citadel-spark-teaser.jpg';
    var IMAGES = [
        ['/images/waitlist/citadel-demo-1-overview.jpg', 'A Citadel overview'],
        ['/images/waitlist/citadel-demo-2-raid.jpg', 'A Citadel raid'],
        ['/images/waitlist/citadel-demo-3-nook-shop.jpg', 'The Nook shop']
    ];
    var LABEL = 'LAUNCHING JANUARY 3, 2027';
    var MESSAGES = {
        ok: ["You're on the list.", 'ok'],
        err: ["That email doesn't look right. Please check it and try again.", 'err'],
        check: ['Please wait for the security check to finish, then tap the button again.', 'err'],
        again: ['Something went wrong. Please try again in a moment.', 'err'],
        slow: ['Too many tries. Please wait a minute and try again.', 'err'],
        down: ["Sign-up isn't available right now. Please try again later.", 'err']
    };
    var PREVIEW_HOSTS = /^(localhost|127\.0\.0\.1|dev\.bitcoineducation\.quest|[a-z0-9-]+\.bq-staging\.pages\.dev|bitcoin-quest-staging\.(web\.app|firebaseapp\.com))$/;

    function previewAllowed(loc, store) {
        loc = loc || (typeof location !== 'undefined' ? location : null);
        if (!loc || !PREVIEW_HOSTS.test(String(loc.hostname || ''))) return false;
        var q = '';
        try { q = new URLSearchParams(loc.search || '').get('cs_preview'); } catch (_) {}
        store = store || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
        try {
            if (q === '1' && store) store.setItem('cs_preview', '1');
            if (q === '0' && store) store.removeItem('cs_preview');
        } catch (_) {}
        if (q === '0') return false;
        if (q === '1') return true;
        try { return !!(store && store.getItem('cs_preview') === '1'); } catch (_) { return false; }
    }

    function isLive(now) {
        var t = typeof now === 'number' ? now : Date.now();
        return t >= LAUNCH_AT || previewAllowed();
    }

    // ── Styles (injected once) ──
    function injectStyles() {
        if (document.getElementById('citadelSparkStyles')) return;
        var css =
            '.cs-glow{position:relative;border-color:#a855f7 !important;box-shadow:0 0 0 2px rgba(168,85,247,.85),0 0 14px 3px rgba(59,130,246,.55);animation:csGlow 2.6s ease-in-out infinite}' +
            '@keyframes csGlow{0%,100%{box-shadow:0 0 0 2px rgba(168,85,247,.85),0 0 12px 2px rgba(59,130,246,.45)}50%{box-shadow:0 0 0 2px rgba(59,130,246,.9),0 0 18px 4px rgba(168,85,247,.6)}}' +
            '@media (prefers-reduced-motion:reduce){.cs-glow{animation:none}}' +
            '.cs-wrap{text-align:center;padding:24px 12px}' +
            '.cs-card{display:inline-block;background:linear-gradient(135deg,#a855f722,#3b82f622);border:1px solid #a855f777;border-radius:16px;padding:22px 22px;max-width:420px;width:100%;box-sizing:border-box}' +
            '.cs-label{font-size:.72rem;font-weight:900;letter-spacing:2px;color:#c084fc;text-transform:uppercase;margin-bottom:10px}' +
            '.cs-title{font-size:1.15rem;font-weight:800;color:var(--heading);line-height:1.4;margin-bottom:12px}' +
            '.cs-desc{font-size:.85rem;color:var(--text-muted);line-height:1.5}' +
            '.cs-player{position:relative;max-width:300px;margin:20px auto 0;border-radius:12px;overflow:hidden;border:1px solid #2c3246;background:#000;aspect-ratio:9/16}' +
            '.cs-player video{position:relative;z-index:0;display:block;width:100%;height:100%;object-fit:contain;background:#000}' +
            // Until it plays, the video never takes the tap, so the button always gets it (QA mobile 390px).
            '.cs-player:not(.cs-on) video{pointer-events:none}' +
            '.cs-play{position:absolute;z-index:2;top:50%;left:50%;transform:translate(-50%,-50%);width:88px;height:88px;border-radius:50%;border:2px solid #fff;background:rgba(124,58,237,.78);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 0 24px rgba(59,130,246,.6)}' +
            // Keep the centering translate under the global mobile button:active scale(0.96) !important (index.html ~1130).
            '.cs-play:active{transform:translate(-50%,-50%) scale(.96)!important}' +
            '.cs-play:focus-visible{outline:3px solid #f7931a;outline-offset:3px}' +
            '.cs-play svg{width:38px;height:38px;margin-left:6px;fill:currentColor}' +
            '.cs-play[hidden]{display:none}' +
            '.cs-gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:640px;margin:18px auto 0}' +
            '.cs-gallery img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:10px;border:1px solid #2c3246;background:#12151d}' +
            '@media (max-width:640px){.cs-gallery{grid-template-columns:1fr}}' +
            '.cs-signup{max-width:420px;margin:20px auto 0;text-align:center}' +
            '.cs-signup h3{font-size:1rem;color:var(--heading);margin:0 0 10px}' +
            '.cs-signup form{display:flex;flex-direction:column;gap:10px}' +
            '.cs-signup input[type=email]{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1px solid #2c3246;background:#0b0d12;color:#fff;font-size:1rem}' +
            '.cs-signup button[type=submit]{padding:12px 16px;border:0;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;font-weight:700;font-size:1rem;cursor:pointer;min-height:44px}' +
            '.cs-signup button:disabled,.cs-signup input:disabled{opacity:.55;cursor:not-allowed}' +
            '.cs-hp{position:absolute;left:-9999px}' +
            '.cs-free{color:var(--text-muted);font-size:.8rem;margin:2px 0 0}' +
            '.cs-privacy{color:var(--text-muted);font-size:.74rem;line-height:1.5;margin-top:10px}' +
            '.cs-privacy a{color:#c084fc}' +
            '.cs-msg{margin-top:10px;font-size:.9rem;min-height:1.2em}' +
            '.cs-msg.ok{color:#4ade80}.cs-msg.err{color:#f87171}';
        var st = document.createElement('style');
        st.id = 'citadelSparkStyles';
        st.textContent = css;
        document.head.appendChild(st);
    }

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    // ── Teaser player: no autoplay, big centered play, sound on when played ──
    function buildPlayer() {
        var wrap = el('div', 'cs-player');
        var v = document.createElement('video');
        v.setAttribute('playsinline', '');
        v.setAttribute('preload', 'metadata');
        v.setAttribute('poster', TEASER_POSTER);
        v.setAttribute('aria-label', 'Citadel Spark teaser');
        v.setAttribute('width', '720');
        v.setAttribute('height', '1280');
        v.src = TEASER_SRC;
        v.muted = false;
        var btn = el('button', 'cs-play');
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Play the Citadel Spark teaser with sound');
        btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
        btn.addEventListener('click', function () {
            v.muted = false;
            try { v.volume = 1; } catch (_) {}
            v.controls = true;
            btn.hidden = true;
            wrap.classList.add('cs-on');
            var p = v.play();
            if (p && typeof p.catch === 'function') p.catch(function () { btn.hidden = false; wrap.classList.remove('cs-on'); });
        });
        v.addEventListener('ended', function () { btn.hidden = false; wrap.classList.remove('cs-on'); });
        wrap.appendChild(v);
        wrap.appendChild(btn);
        return wrap;
    }

    function buildGallery() {
        var g = el('div', 'cs-gallery');
        IMAGES.forEach(function (img) {
            var i = document.createElement('img');
            i.src = img[0]; i.alt = img[1];
            i.width = 1000; i.height = 563;
            i.loading = 'lazy'; i.decoding = 'async';
            g.appendChild(i);
        });
        return g;
    }

    // ── Waitlist signup: same Worker and rules as /waitlist ──
    var _turnstileLoading = null;
    function loadTurnstile() {
        if (window.turnstile) return Promise.resolve(window.turnstile);
        if (_turnstileLoading) return _turnstileLoading;
        _turnstileLoading = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            s.async = true;
            s.onload = function () { resolve(window.turnstile); };
            s.onerror = function () { _turnstileLoading = null; reject(new Error('turnstile')); };
            document.head.appendChild(s);
        });
        return _turnstileLoading;
    }

    function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

    function buildSignup() {
        var box = el('section', 'cs-signup');
        box.setAttribute('aria-label', 'Citadel Spark waitlist');
        box.appendChild(el('h3', null, 'Want a heads-up when the gates open?'));
        var form = document.createElement('form');
        form.setAttribute('novalidate', '');
        var label = el('label', 'cs-hp', 'Email address');
        label.setAttribute('for', 'csWlEmail');
        var email = document.createElement('input');
        email.id = 'csWlEmail'; email.type = 'email'; email.name = 'email';
        email.autocomplete = 'email'; email.inputMode = 'email'; email.maxLength = 254;
        email.placeholder = 'you@example.com'; email.required = true;
        var hp = el('div', 'cs-hp');
        hp.setAttribute('aria-hidden', 'true');
        var hpIn = document.createElement('input');
        hpIn.name = 'website'; hpIn.tabIndex = -1; hpIn.autocomplete = 'off';
        hp.appendChild(hpIn);
        var ts = el('div');
        ts.id = 'csWlTurnstile';
        var btn = el('button', null, 'Get email updates');
        btn.type = 'submit';
        form.appendChild(label);
        form.appendChild(email);
        form.appendChild(hp);
        form.appendChild(ts);
        form.appendChild(btn);
        form.appendChild(el('p', 'cs-free', 'Free. Unsubscribe anytime.'));
        var msg = el('p', 'cs-msg');
        msg.setAttribute('role', 'status');
        msg.setAttribute('aria-live', 'polite');
        var privacy = el('p', 'cs-privacy', "We'll use your email only to tell you when Citadel Spark launches and for occasional updates. Stored by us; unsubscribe anytime. ");
        var pl = el('a', null, 'Privacy Policy');
        pl.href = '/privacy.html';
        privacy.appendChild(pl);
        box.appendChild(form);
        box.appendChild(msg);
        box.appendChild(privacy);

        var widgetId = null;
        function show(key) {
            var m = MESSAGES[key]; if (!m) return;
            msg.textContent = m[0];
            msg.className = 'cs-msg ' + m[1];
        }
        loadTurnstile().then(function (t) {
            if (!t || !document.body.contains(ts)) return;
            try { widgetId = t.render(ts, { sitekey: TURNSTILE_SITEKEY, theme: 'dark', size: 'flexible' }); } catch (_) {}
        }).catch(function () {});
        function token() {
            try { if (window.turnstile && widgetId != null) return window.turnstile.getResponse(widgetId) || ''; } catch (_) {}
            return '';
        }
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var value = (email.value || '').trim();
            if (!validEmail(value)) { show('err'); email.focus(); return; }
            var tok = token();
            if (!tok) { show('check'); return; }
            btn.disabled = true;
            var body = new URLSearchParams();
            body.set('email', value);
            body.set('consent', 'on');
            body.set('website', hpIn.value || '');
            body.set('cf-turnstile-response', tok);
            body.set('src', WAITLIST_SRC);
            fetch('/api/waitlist', { method: 'POST', body: body, headers: { Accept: 'application/json' }, credentials: 'omit' })
                .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d || {} }; }); })
                .then(function (res) {
                    var code = res.d.error;
                    if (res.d.ok) {
                        show('ok'); form.reset();
                        try { localStorage.setItem('cs_waitlist_joined', '1'); } catch (_) {}
                        try { document.dispatchEvent(new CustomEvent('citadelspark:waitlist-joined')); } catch (_) {}
                    }
                    else if (res.status === 429) show('slow');
                    else if (code === 'email') show('err');
                    else if (code === 'challenge') show('check');
                    else if (res.status >= 500) show('down');
                    else show('again');
                })
                .catch(function () { show('down'); })
                .then(function () {
                    btn.disabled = false;
                    try { if (window.turnstile && widgetId != null) window.turnstile.reset(widgetId); } catch (_) {}
                });
        });
        return box;
    }

    // Called by quests.js _renderCitadelTab. Returns true when it rendered.
    function renderTab(body, now) {
        if (!body || !isLive(now)) return false;
        injectStyles();
        body.textContent = '';
        var wrap = el('div', 'cs-wrap');
        wrap.appendChild(el('div', null, '🏰')).style.cssText = 'font-size:3rem;margin-bottom:12px;';
        var card = el('div', 'cs-card');
        card.appendChild(el('div', 'cs-label', LABEL));
        card.appendChild(el('div', 'cs-title', 'USE XP TO CONSTRUCT YOUR OWN CITADEL!'));
        card.appendChild(el('div', 'cs-desc', 'Spend your hard-earned XP to build, upgrade, and defend your own citadel. Stack XP now and be ready when the gates open.'));
        wrap.appendChild(card);
        wrap.appendChild(buildPlayer());
        wrap.appendChild(buildGallery());
        wrap.appendChild(buildSignup());
        body.appendChild(wrap);
        return true;
    }

    function applyGlow(now) {
        if (!isLive(now)) return false;
        var row = document.getElementById('todayCitadelBtn');
        if (!row) return false;
        injectStyles();
        row.classList.add('cs-glow');
        return true;
    }

    function init() {
        if (applyGlow()) return;
        var wait = LAUNCH_AT - Date.now();
        if (wait > 0 && wait < 2147483647) setTimeout(applyGlow, wait + 1000);
    }

    window.CitadelSpark = {
        LAUNCH_AT: LAUNCH_AT,
        LABEL: LABEL,
        WAITLIST_SRC: WAITLIST_SRC,
        isLive: isLive,
        previewAllowed: previewAllowed,
        renderTab: renderTab,
        applyGlow: applyGlow
    };

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
        else init();
    }
})();
