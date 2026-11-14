// Waitlist page script. Standalone: no Firebase, no app bundle.
// Modes: data-mode="preview" disables the form; data-mode="live" posts to /api/waitlist.
// After the Worker saves the address, this page reveals Substack's official embed
// so the visitor can subscribe with one more tap. The Worker does not forward to Substack.
(function () {
  var form = document.getElementById('waitlistForm');
  var card = document.getElementById('card');
  var msg = document.getElementById('wlMsg');
  var btn = document.getElementById('wlSubmit');
  var email = document.getElementById('wlEmail');
  var embed = document.getElementById('wlSubstackEmbed');
  if (!form) return;
  var MESSAGES = {
    ok: ["You're on the list.", 'ok'],
    retry: ["You're on our list. We'll finish setting up your email updates shortly.", 'ok'],
    err: ["That email doesn't look right. Please check it and try again.", 'err'],
    check: ['Please wait for the security check to finish, then tap the button again.', 'err'],
    again: ['Something went wrong. Please refresh the page and try again.', 'err'],
    slow: ['Too many tries. Please wait a minute and try again.', 'err'],
    down: ["Sign-up isn't available right now. Please try again later.", 'err']
  };
  function revealSubstack() {
    if (embed) embed.removeAttribute('hidden');
  }
  function show(key) {
    var m = MESSAGES[key]; if (!m) return;
    msg.textContent = m[0]; msg.className = 'msg ' + m[1];
    if (key === 'ok') revealSubstack();
  }
  var params = new URLSearchParams(location.search);
  var s = params.get('s');
  if (s) show(s);

  // Keep strictly validated ref/src from the landing URL across a reload.
  var REF_RE = /^[A-Za-z0-9]{4,16}$/;
  var SRC_RE = /^[a-z0-9-]{1,32}$/;
  function readTag(key, re) {
    var fromUrl = params.get(key);
    if (fromUrl && re.test(fromUrl)) {
      try { sessionStorage.setItem('wl_' + key, fromUrl); } catch (_) {}
      return fromUrl;
    }
    try {
      var stored = sessionStorage.getItem('wl_' + key);
      if (stored && re.test(stored)) return stored;
    } catch (_) {}
    return null;
  }
  var wlRef = readTag('ref', REF_RE);
  var wlSrc = readTag('src', SRC_RE);
  function applyTagFields() {
    [['ref', wlRef], ['src', wlSrc]].forEach(function (pair) {
      var key = pair[0], val = pair[1];
      var el = form.querySelector('input[name="' + key + '"]');
      if (!val) { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement('input');
        el.type = 'hidden';
        el.name = key;
        form.appendChild(el);
      }
      el.value = val;
    });
  }
  applyTagFields();

  if (form.getAttribute('data-mode') !== 'live') {
    if (card) card.setAttribute('data-mode', 'preview');
    email.disabled = true; btn.disabled = true;
    if (!s) show('down');
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    return;
  }
  var ts = document.createElement('script');
  ts.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  ts.async = true; ts.defer = true;
  document.head.appendChild(ts);

  // The Turnstile token. Read it from the widget API first, then the hidden field.
  // An empty token makes the Worker answer 403 {error:"challenge"} without checking it.
  function turnstileToken() {
    var t = '';
    try { if (window.turnstile && typeof window.turnstile.getResponse === 'function') t = window.turnstile.getResponse() || ''; } catch (_) {}
    if (!t) { var f = form.querySelector('[name="cf-turnstile-response"]'); if (f && f.value) t = f.value; }
    return t;
  }
  function resetTurnstile() { if (window.turnstile) try { window.turnstile.reset(); } catch (_) {} }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = (email.value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) { show('err'); email.focus(); return; }
    var token = turnstileToken();
    if (!token) { show('check'); return; }
    btn.disabled = true;
    var body = new URLSearchParams(new FormData(form));
    body.set('email', value);
    body.set('cf-turnstile-response', token);
    if (wlRef) body.set('ref', wlRef); else body.delete('ref');
    if (wlSrc) body.set('src', wlSrc); else body.delete('src');
    fetch('/api/waitlist', { method: 'POST', body: body, headers: { Accept: 'application/json' }, credentials: 'omit' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d || {} }; }); })
      .then(function (res) {
        var code = res.d.error;
        if (res.d.ok) { show('ok'); form.reset(); applyTagFields(); }
        else if (res.status === 429) show('slow');
        else if (code === 'email') show('err');
        else if (code === 'challenge') show('check');
        else if (res.status === 503 || res.status >= 500) show('down');
        else show('again');
      })
      .catch(function () { show('down'); })
      .then(function () { btn.disabled = false; resetTurnstile(); });
  });
})();
