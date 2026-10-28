// © 2024-2026 603BTC LLC. All rights reserved.
// shareable-certs.js — Public shareable certificate pages
// Generates unique URLs for Scholar/Protocol Expert/Trail certifications

(function() {
'use strict';

var CERT_SHARE_LINE = 'Learn Bitcoin and earn sats on Bitcoin Quest 👇';
var CERT_REF_RE = /^[A-Za-z0-9]{6,28}$/;

function certReferralCode() {
    try {
        if (typeof liveRefCode === 'function') {
            var live = String(liveRefCode() || '');
            if (CERT_REF_RE.test(live)) return live;
        }
    } catch (e) {}
    try {
        if (typeof getReferralCode === 'function') {
            var c = String(getReferralCode() || '');
            if (CERT_REF_RE.test(c)) return c;
        }
    } catch (e2) {}
    try {
        if (typeof currentUser !== 'undefined' && currentUser && CERT_REF_RE.test(String(currentUser.referralCode || ''))) {
            return String(currentUser.referralCode);
        }
    } catch (e3) {}
    return '';
}

function certShareUrl(certId, code) {
    var id = String(certId || '').replace(/[^A-Za-z0-9_-]/g, '');
    var c = arguments.length > 1 ? String(code || '') : certReferralCode();
    if (!CERT_REF_RE.test(c)) c = '';
    if (c && id) return 'https://bitcoineducation.quest/?ref=' + encodeURIComponent(c) + '#cert/' + id;
    if (id) return 'https://bitcoineducation.quest/#cert/' + id;
    return 'https://bitcoineducation.quest';
}

function certShareText(title, certId, code) {
    var url = arguments.length > 2 ? certShareUrl(certId, code) : certShareUrl(certId);
    return 'I just earned my ' + title + ' certification from @BTCedu_app! 🎓₿\n' + CERT_SHARE_LINE + '\n' + url;
}

// Generate a short unique cert ID
function generateCertId() {
    return 'CERT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
}

// Save cert via Cloud Function (Fix M-NEW-15)
async function saveCertToServer(type, name) {
    if (typeof firebase === 'undefined' || !firebase.functions) return null;
    try {
        var issueFn = firebase.functions().httpsCallable('issueCertificate');
        var result = await issueFn({ type: type, name: name });
        if (result.data && result.data.success) {
            return result.data;
        }
        return null;
    } catch(e) {
        console.error('[CERT] Issuance error:', e);
        if (typeof showToast === 'function') showToast('⚠️ ' + (e.message || 'Cert issuance failed'), 5000);
        return null;
    }
}

function showShareUI(certId, title, name) {
    if (!/^(?:CERT-)?[A-Za-z0-9-]{8,80}$/.test(String(certId || ''))) return;
    var url = certShareUrl(certId);
    var tweet = certShareText(title, certId);

    var overlay = document.createElement('div');
    overlay.id = 'certShareOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:500000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML =
        '<div style="background:var(--bg-side,#1a1a2e);border:1px solid var(--accent);border-radius:20px;padding:28px;max-width:420px;width:100%;text-align:center;animation:fadeSlideIn 0.3s;">' +
            '<div style="font-size:3rem;margin-bottom:12px;">🔗🎓</div>' +
            '<h3 style="color:var(--heading);font-size:1.1rem;margin:0 0 8px;">Share Your Certificate!</h3>' +
            '<p style="color:var(--text-muted);font-size:0.82rem;margin-bottom:16px;">Share this link on LinkedIn, X, Nostr, or your resume to prove your Bitcoin knowledge.</p>' +
            '<div style="padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;margin-bottom:12px;word-break:break-all;">' +
                '<div style="color:var(--accent);font-size:0.8rem;font-weight:700;font-family:monospace;">' + url + '</div>' +
            '</div>' +
            '<button onclick="navigator.clipboard.writeText(\'' + url + '\');this.textContent=\'✅ Copied!\';setTimeout(function(){document.getElementById(\'certShareOverlay\').remove()},1000)" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-weight:800;font-size:0.95rem;cursor:pointer;font-family:inherit;margin-bottom:8px;">📋 Copy Share Link</button>' +
            '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px;">' +
                '<a href="https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweet) + '" target="_blank" style="padding:8px 16px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.75rem;font-weight:700;text-decoration:none;cursor:pointer;">𝕏 Share</a>' +
                '<a href="https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url) + '" target="_blank" style="padding:8px 16px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.75rem;font-weight:700;text-decoration:none;cursor:pointer;">💼 LinkedIn</a>' +
            '</div>' +
            '<button onclick="document.getElementById(\'certShareOverlay\').remove()" style="width:100%;padding:8px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-faint);font-size:0.8rem;cursor:pointer;font-family:inherit;">Close</button>' +
        '</div>';

    document.body.appendChild(overlay);
}

// Public verification page: /#cert/CERT-XXXXX
// Plain POST. verifyCertificate does not require an App Check token, and
// httpsCallable waits on reCAPTCHA before it sends anything.
var CERT_VERIFY_URL = 'https://us-central1-bitcoin-education-archive.cloudfunctions.net/verifyCertificate';
var CERT_ID_RE = /^(?:CERT-)?[A-Za-z0-9-]{8,80}$/;
var CERT_TIMEOUT_MS = 10000;

function certEl(tag, css, text) {
    var node = document.createElement(tag);
    if (css) node.style.cssText = css;
    if (text != null) node.textContent = text;
    return node;
}

function certClear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
}

function certShowShell() {
    var home = document.getElementById('home');
    if (home) home.classList.add('hidden');
    var hero = document.getElementById('hero');
    if (hero) hero.style.display = 'none';
    var msgs = document.getElementById('msgs');
    if (msgs) msgs.style.display = 'none';
    var fc = document.getElementById('forumContainer');
    if (fc) fc.style.display = 'block';
    return fc;
}

function certMount(fc) {
    certClear(fc);
    var wrap = certEl('div', 'max-width:500px;margin:0 auto;padding:30px 16px 120px;text-align:center;');
    fc.appendChild(wrap);
    return wrap;
}

function certOpenQuest() {
    var home = document.getElementById('home');
    if (home) {
        home.classList.remove('hidden');
        home.style.visibility = '';
    }
    var fc = document.getElementById('forumContainer');
    if (fc) fc.style.display = 'none';
    window._certPainted = '';
    // goHome() exists only after the bundle has stored ?ref=. Before that,
    // keep the query string so captureReferralCode still sees it.
    if (typeof window.goHome === 'function') {
        try { window.goHome(); return; } catch (e) {}
    }
    try {
        history.pushState({ home: true }, '', window.location.pathname + window.location.search);
    } catch (e2) {}
}

function certActions(parent, certId, withRetry) {
    var row = certEl('div', 'display:flex;flex-direction:column;gap:8px;align-items:center;margin-top:16px;');
    if (withRetry) {
        var retry = certEl('button', 'width:100%;max-width:280px;padding:12px 22px;background:var(--accent,#f7931a);color:#fff;border:none;border-radius:12px;font-weight:800;cursor:pointer;font-family:inherit;font-size:0.95rem;', 'Retry');
        retry.type = 'button';
        retry.addEventListener('click', function () {
            window._certPainted = '';
            window.renderCertVerification(certId, true);
        });
        row.appendChild(retry);
    }
    var open = certEl('button', 'width:100%;max-width:280px;padding:12px 22px;background:transparent;color:var(--text,#e2e8f0);border:1px solid var(--border,#333);border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.95rem;', 'Open Bitcoin Quest');
    open.type = 'button';
    open.addEventListener('click', certOpenQuest);
    row.appendChild(open);
    parent.appendChild(row);
}

function certPlaceholder(fc) {
    var wrap = certMount(fc);
    wrap.appendChild(certEl('div', 'font-size:2rem;margin-bottom:12px;', '⏳'));
    wrap.appendChild(certEl('div', 'color:var(--text-muted,#94a3b8);font-size:0.95rem;', 'Verifying certificate…'));
}

function certNotFound(fc) {
    var wrap = certMount(fc);
    wrap.appendChild(certEl('div', 'font-size:3rem;margin-bottom:12px;', '❌'));
    wrap.appendChild(certEl('h2', 'color:var(--heading,#e2e8f0);margin:0 0 8px;font-size:1.3rem;', 'Certificate Not Found'));
    wrap.appendChild(certEl('p', 'color:var(--text-muted,#94a3b8);font-size:0.85rem;line-height:1.5;margin:0;', 'This certificate ID does not exist or has been revoked.'));
    certActions(wrap, '', false);
}

function certFailed(fc, certId, message) {
    var wrap = certMount(fc);
    wrap.appendChild(certEl('div', 'font-size:2rem;margin-bottom:12px;', '⚠️'));
    wrap.appendChild(certEl('h2', 'color:var(--heading,#e2e8f0);margin:0 0 8px;font-size:1.2rem;', 'Could not verify this certificate'));
    wrap.appendChild(certEl('p', 'color:var(--text-muted,#94a3b8);font-size:0.9rem;line-height:1.5;margin:0;', message));
    certActions(wrap, certId, true);
}

function certQuestTitle(quest) {
    quest = String(quest || '');
    if (quest === 'protocol-expert') return 'Bitcoin Protocol Expert';
    if (quest.indexOf('trail_') === 0) return 'Nacho Trail Complete';
    return 'Bitcoin Scholar';
}

function certValid(fc, certId, payload) {
    var quest = String(payload.quest || '');
    var title = certQuestTitle(quest);
    var technical = quest === 'protocol-expert';
    var emoji = technical ? '🛠️' : (quest.indexOf('trail_') === 0 ? '🏔️' : '🎓');
    var color = technical ? '#3b82f6' : '#f7931a';
    var wrap = certMount(fc);
    wrap.appendChild(certEl('div', 'display:inline-flex;align-items:center;gap:8px;padding:8px 20px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:20px;color:#22c55e;font-size:0.8rem;font-weight:700;margin-bottom:16px;', '✅ VERIFIED CERTIFICATE'));
    wrap.appendChild(certEl('div', 'font-size:4rem;margin:8px 0 12px;', emoji));
    wrap.appendChild(certEl('h2', 'color:var(--heading,#e2e8f0);font-size:1.4rem;font-weight:900;margin:0 0 4px;', title));
    wrap.appendChild(certEl('p', 'color:var(--text-muted,#94a3b8);font-size:0.85rem;margin:0 0 20px;', 'Bitcoin Education Archive Certification'));
    var card = certEl('div', 'background:var(--card-bg,#141425);border:2px solid ' + color + ';border-radius:20px;padding:24px;margin:0 auto 20px;text-align:center;max-width:440px;');
    card.appendChild(certEl('div', 'color:var(--text-faint,#64748b);font-size:0.7rem;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:8px;', 'AWARDED TO'));
    card.appendChild(certEl('div', 'color:var(--heading,#e2e8f0);font-size:1.5rem;font-weight:900;margin-bottom:16px;word-break:break-word;', String(payload.name || '')));
    var line = certEl('div', 'color:var(--text-muted,#94a3b8);font-size:0.85rem;line-height:1.6;margin-bottom:16px;');
    line.appendChild(document.createTextNode('has successfully passed the'));
    line.appendChild(certEl('br'));
    line.appendChild(certEl('strong', 'color:' + color + ';', title));
    line.appendChild(certEl('br'));
    line.appendChild(document.createTextNode('certification examination.'));
    card.appendChild(line);
    if (payload.score) card.appendChild(certEl('div', 'color:var(--text-faint,#64748b);font-size:0.78rem;margin-bottom:12px;', 'Score: ' + String(payload.score)));
    card.appendChild(certEl('div', 'color:var(--text-faint,#64748b);font-size:0.78rem;', 'Date: ' + String(payload.date || '')));
    var idRow = certEl('div', 'margin-top:12px;padding-top:12px;border-top:1px solid var(--border,#333);');
    idRow.appendChild(certEl('div', 'color:var(--text-faint,#64748b);font-size:0.65rem;font-family:monospace;word-break:break-all;', 'Certificate ID: ' + String(certId)));
    card.appendChild(idRow);
    wrap.appendChild(card);
    wrap.appendChild(certEl('p', 'color:var(--text-muted,#94a3b8);font-size:0.82rem;margin:0 0 16px;', 'Want to earn your own Bitcoin certification?'));
    var learn = certEl('button', 'width:100%;max-width:320px;padding:14px 28px;background:var(--accent,#f7931a);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.95rem;', 'Open Bitcoin Quest');
    learn.type = 'button';
    learn.addEventListener('click', certOpenQuest);
    wrap.appendChild(learn);
    window._certPainted = certId;
    try { fc.scrollTop = 0; } catch (e) {}
}

function certTimedOut(err) {
    if (!err) return false;
    if (err.name === 'AbortError' || err.name === 'TimeoutError') return true;
    var msg = String(err.message || '');
    return msg.indexOf('abort') !== -1 || msg.indexOf('Abort') !== -1 || msg.indexOf('timed out') !== -1;
}

function beginCertVerify(certId, force) {
    if (!force && window._certVerify && window._certVerifyId === certId) return window._certVerify;
    window._certVerifyId = certId;
    window._certVerifyGen = (window._certVerifyGen || 0) + 1;
    var gen = window._certVerifyGen;
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () {
        if (ctrl) ctrl.abort();
    }, CERT_TIMEOUT_MS);
    var promise = fetch(CERT_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { certId: certId } }),
        signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
        return res.json().then(function (body) {
            if (!res.ok || (body && body.error)) {
                var err = new Error((body && body.error && body.error.message) || 'Certificate check failed');
                err.status = res.status;
                throw err;
            }
            return (body && body.result) ? body.result : {};
        });
    });
    var settled = promise.then(function (result) {
        clearTimeout(timer);
        return result;
    }, function (err) {
        clearTimeout(timer);
        throw err;
    });
    settled._gen = gen;
    window._certVerify = settled;
    return settled;
}

window.renderCertVerification = function (certId, force) {
    var fc = certShowShell();
    if (!fc) return;
    var id = String(certId || '').split(/[?#]/)[0];
    if (!CERT_ID_RE.test(id)) {
        certNotFound(fc);
        return;
    }
    if (!force && window._certPainted === id) {
        fc.style.display = 'block';
        return;
    }
    if (!force && window._certVerifyId === id) {
        var already = fc.textContent || '';
        if (already.indexOf('Verifying certificate') !== -1 || already.indexOf('VERIFIED CERTIFICATE') !== -1 || already.indexOf('Could not verify') !== -1 || already.indexOf('Certificate Not Found') !== -1) {
            fc.style.display = 'block';
            return;
        }
    }
    window._certPainted = '';
    certPlaceholder(fc);
    var promise = beginCertVerify(id, !!force);
    var gen = promise._gen;
    promise.then(function (payload) {
        if (window._certVerifyGen !== gen) return;
        if (!payload || payload.valid !== true) {
            certNotFound(fc);
            return;
        }
        certValid(fc, id, payload);
    }, function (err) {
        if (window._certVerifyGen !== gen) return;
        certFailed(fc, id, certTimedOut(err)
            ? 'Verification timed out. The certificate check took longer than 10 seconds.'
            : 'Something went wrong verifying this certificate. Check your connection and try again.');
    });
};

// Route handler: go('cert/XXXXX')
var _realGoCert = window.go;
if (_realGoCert) {
    window.go = async function(id) {
        if (typeof id === 'string' && id.indexOf('cert/') === 0) {
            var certId = id.replace('cert/', '');
            if (window._nachoMode && typeof exitNachoMode === 'function') exitNachoMode(true);
            document.getElementById('home').classList.add('hidden');
            document.getElementById('hero').textContent = '';
            document.getElementById('hero').style.display = 'none';
            document.getElementById('msgs').textContent = '';
            document.getElementById('msgs').style.display = 'none';
            var fc = document.getElementById('forumContainer');
            if (fc) fc.style.display = 'block';
            history.pushState({ channel: id }, '', '#' + id);
            if (typeof isMobile === 'function' && isMobile()) document.getElementById('sidebar').classList.remove('open');
            renderCertVerification(certId);
            document.getElementById('main').scrollTop = 0;
            return;
        }
        return _realGoCert.apply(this, arguments);
    };
}

// Expose for trail certs too
window.generateShareableCert = async function(type, title, name) {
    var result = await saveCertToServer(type, name);
    if (result && result.certId) {
        showShareUI(result.certId, result.title, result.name);
        return result.certId;
    }
    return null;
};

window.certShareUrl = certShareUrl;
window.certShareText = certShareText;
window.showCertShare = showShareUI;
if (window._pendingCertShare && window._pendingCertShare.certId) {
    var _pendingShare = window._pendingCertShare;
    window._pendingCertShare = null;
    showShareUI(_pendingShare.certId, _pendingShare.title, _pendingShare.name);
}
console.log('[CERTS] Shareable certificates loaded');
})();
