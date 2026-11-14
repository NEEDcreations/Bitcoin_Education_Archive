// Waitlist page script. Standalone: no Firebase, no app bundle.
// Modes: data-mode="preview" disables the form; data-mode="live" posts to /api/waitlist.
(function () {
  var form = document.getElementById('waitlistForm');
  var card = document.getElementById('card');
  var msg = document.getElementById('wlMsg');
  var btn = document.getElementById('wlSubmit');
  var email = document.getElementById('wlEmail');
  if (!form) return;
  var MESSAGES = {
    ok: ["You're on the list. Check your inbox to confirm your email updates.", 'ok'],
    retry: ["You're on our list. We'll finish setting up your email updates shortly.", 'ok'],
    err: ["That email doesn't look right. Please check it and try again.", 'err'],
    slow: ['Too many tries. Please wait a minute and try again.', 'err'],
    down: ["Sign-up isn't available right now. Please try again later.", 'err']
  };
  function show(key) {
    var m = MESSAGES[key]; if (!m) return;
    msg.textContent = m[0]; msg.className = 'msg ' + m[1];
  }
  var s = new URLSearchParams(location.search).get('s');
  if (s) show(s);

  if (form.getAttribute('data-mode') !== 'live') {
    if (card) card.setAttribute('data-mode', 'preview');
    email.disabled = true; btn.disabled = true;
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    return;
  }
  var ts = document.createElement('script');
  ts.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  ts.async = true; ts.defer = true;
  document.head.appendChild(ts);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = (email.value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) { show('err'); email.focus(); return; }
    btn.disabled = true;
    var body = new URLSearchParams(new FormData(form));
    fetch('/api/waitlist', { method: 'POST', body: body, headers: { Accept: 'application/json' }, credentials: 'omit' })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        if (res.d && res.d.ok) { show(res.d.retry ? 'retry' : 'ok'); form.reset(); }
        else if (res.status === 429) show('slow');
        else if (res.status === 503) show('down');
        else show('err');
      })
      .catch(function () { show('down'); })
      .then(function () { btn.disabled = false; if (window.turnstile) try { window.turnstile.reset(); } catch (_) {} });
  });
})();
