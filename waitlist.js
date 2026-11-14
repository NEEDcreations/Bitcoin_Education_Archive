// Waitlist page script. Standalone: no Firebase, no app bundle.
// Modes: data-mode="preview" disables the form; data-mode="live" posts to /api/waitlist.
// After the Worker saves the address, this page subscribes the visitor on Substack
// from their own browser (hidden form POST to the public no-JS endpoint). The
// Worker does not forward to Substack.
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
    if (!s) show('down');
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    return;
  }
  var ts = document.createElement('script');
  ts.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  ts.async = true; ts.defer = true;
  document.head.appendChild(ts);

  // Substack's own subscribe page posts to /api/v1/free?nojs=true. A hidden iframe
  // keeps the visitor on this page. We cannot read the cross-origin response.
  function subscribeOnSubstack(address) {
    var iframe = document.getElementById('wlSubstackFrame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'wlSubstackFrame';
      iframe.name = 'wlSubstackFrame';
      iframe.title = 'Substack signup';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);border:0';
      document.body.appendChild(iframe);
    }
    var f = document.createElement('form');
    f.action = 'https://603btc.substack.com/api/v1/free?nojs=true';
    f.method = 'POST';
    f.target = 'wlSubstackFrame';
    f.acceptCharset = 'UTF-8';
    f.style.display = 'none';
    function hidden(name, value) {
      var i = document.createElement('input');
      i.type = 'hidden';
      i.name = name;
      i.value = value;
      f.appendChild(i);
    }
    hidden('email', address);
    hidden('first_url', 'https://bitcoineducation.quest/waitlist');
    hidden('first_referrer', '');
    hidden('current_url', 'https://bitcoineducation.quest/waitlist');
    hidden('current_referrer', '');
    hidden('source', 'subscribe_page');
    hidden('referring_pub_id', '');
    hidden('additional_referring_pub_ids', '');
    document.body.appendChild(f);
    f.submit();
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 0);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = (email.value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) { show('err'); email.focus(); return; }
    btn.disabled = true;
    var body = new URLSearchParams(new FormData(form));
    fetch('/api/waitlist', { method: 'POST', body: body, headers: { Accept: 'application/json' }, credentials: 'omit' })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        if (res.d && res.d.ok) { subscribeOnSubstack(value); show('ok'); form.reset(); }
        else if (res.status === 429) show('slow');
        else if (res.status === 503) show('down');
        else show('err');
      })
      .catch(function () { show('down'); })
      .then(function () { btn.disabled = false; if (window.turnstile) try { window.turnstile.reset(); } catch (_) {} });
  });
})();
