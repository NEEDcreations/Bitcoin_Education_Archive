// Bitcoin Quest Premium page script. Standalone: no Firebase, no app bundle.
// Posts the chosen plan, email, Turnstile token and ?src= tag to the
// premiumPublicCheckout function, then sends the buyer to Stripe Checkout.
// The server sets every price. This page never offers the existing-player
// discount (in-app only, verified accounts only).
(function () {
  var LIVE_HOSTS = ['bitcoineducation.quest', 'www.bitcoineducation.quest'];
  var ENDPOINTS = {
    live: 'https://us-central1-bitcoin-education-archive.cloudfunctions.net/premiumPublicCheckout',
    staging: 'https://us-central1-bitcoin-quest-staging.cloudfunctions.net/premiumPublicCheckout'
  };
  // Flip to true only once bitcoin checkout is open (shows the 10% line).
  var SHOW_BTC_LINE = false;
  // Live launch gate. While false, the live host shows "opens soon" and never
  // loads Turnstile or posts a checkout. Staging and previews always work.
  // Flip only after Phil OKs the public /premium launch.
  var PAGE_OPEN_ON_LIVE = false;

  var form = document.getElementById('premiumForm');
  var msg = document.getElementById('pmMsg');
  var btn = document.getElementById('pmSubmit');
  var email = document.getElementById('pmEmail');
  var agree = document.getElementById('pmAgree');
  if (!form) return;
  var isLive = LIVE_HOSTS.indexOf(location.hostname) !== -1;
  if (isLive && !PAGE_OPEN_ON_LIVE) {
    var co = document.getElementById('pmCheckout'); if (co) co.hidden = true;
    var cl = document.getElementById('pmClosed'); if (cl) cl.hidden = false;
    if (btn) btn.disabled = true;
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    return;
  }

  function endpoint() { return LIVE_HOSTS.indexOf(location.hostname) !== -1 ? ENDPOINTS.live : ENDPOINTS.staging; }
  function cleanSrc(v) { v = String(v || '').toLowerCase().trim(); return /^[a-z0-9][a-z0-9_-]{0,39}$/.test(v) ? v : ''; }
  var params = new URLSearchParams(location.search);
  var src = cleanSrc(params.get('src'));

  var MESSAGES = {
    success: ["You're in. Check your email for your receipt, then sign in to Bitcoin Quest with the same email.", 'ok'],
    cancel: ['Checkout was cancelled. You have not been charged.', 'err'],
    bad_email: ["That email doesn't look right. Please check it and try again.", 'err'],
    turnstile: ['Please wait for the security check to finish, then tap the button again.', 'err'],
    checkout_closed: ['Checkout opens soon. Please check back.', 'err'],
    terms_required: ['Please tick the box to confirm that all sales are final.', 'err'],
    kill_switch: ['Bitcoin Quest is offline for maintenance, so checkout is paused. Please try again later.', 'err'],
    founders_sold_out: ["Founders' Lifetime is sold out or all remaining seats are in checkout. Try again in about 30 minutes.", 'err'],
    hold_exists: ["You already have a Founders' checkout open. Finish it, or try again in about 30 minutes.", 'err'],
    already_lifetime: ["This email already has Founders' Lifetime.", 'ok'],
    rate_limited: ['Too many tries. Please wait a while and try again.', 'err'],
    rate_limited_global: ['Checkout is busy right now. Please try again in an hour.', 'err'],
    founders_sign_in: ["Founders' Lifetime is sold in the app. Sign in to Bitcoin Quest to buy it.", 'err'],
    founders_busy: ["All open Founders' seats are in checkout right now. Try again in about 30 minutes.", 'err'],
    hold_exists_ip: ["A Founders' checkout is already open from this network. Finish it, or try again in about 30 minutes.", 'err'],
    down: ["Checkout isn't available right now. Please try again later.", 'err']
  };
  function show(key) {
    var m = MESSAGES[key] || MESSAGES.down;
    msg.textContent = m[0]; msg.className = 'msg ' + m[1];
  }
  var back = params.get('premium');
  if (back === 'success' || back === 'cancel') show(back);
  if (SHOW_BTC_LINE) { var n = document.getElementById('btcNote'); if (n) n.hidden = false; }

  var ts = document.createElement('script');
  ts.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  ts.async = true; ts.defer = true;
  document.head.appendChild(ts);
  function turnstileToken() {
    var t = '';
    try { if (window.turnstile && typeof window.turnstile.getResponse === 'function') t = window.turnstile.getResponse() || ''; } catch (_) {}
    if (!t) { var f = form.querySelector('[name="cf-turnstile-response"]'); if (f && f.value) t = f.value; }
    return t;
  }
  function resetTurnstile() { if (window.turnstile) try { window.turnstile.reset(); } catch (_) {} }

  // Founders' seats are sold only to signed-in accounts: send buyers to the
  // app sign-in (same site), carrying the src tag. No POST, no email here.
  function foundersSignIn() {
    location.assign('/?premium=founders' + (src ? '&src=' + encodeURIComponent(src) : ''));
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var chosen = form.querySelector('input[name="plan"]:checked');
    if (chosen && chosen.value === 'founders') { foundersSignIn(); return; }
    if (!agree || agree.checked !== true) { show('terms_required'); return; }
    var value = (email.value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) { show('bad_email'); email.focus(); return; }
    var token = turnstileToken();
    if (!token) { show('turnstile'); return; }
    var picked = form.querySelector('input[name="plan"]:checked');
    var body = { plan: picked ? picked.value : 'monthly', rail: 'card', email: value, turnstileToken: token, acceptNoRefunds: true };
    if (src) body.src = src;
    btn.disabled = true; msg.textContent = ''; msg.className = 'msg';
    fetch(endpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'omit'
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (out) {
        if (out && out.ok && typeof out.url === 'string' && /^https:\/\/checkout\.stripe\.com\//.test(out.url)) {
          location.assign(out.url);
          return;
        }
        if (out && out.reason === 'founders_sign_in') { foundersSignIn(); return; }
        show(out && out.reason); btn.disabled = false; resetTurnstile();
      })
      .catch(function () { show('down'); btn.disabled = false; resetTurnstile(); });
  });
})();
