// © 2024-2026 603BTC LLC. All rights reserved.
// shareable-certs.js — Public shareable certificate pages
// Generates unique URLs for Scholar/Protocol Expert/Trail certifications

(function() {
'use strict';

// Generate a short unique cert ID
function generateCertId() {
    return 'CERT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
}

// Save cert to Firestore and return the ID
async function saveCertToFirestore(certData) {
    var db = typeof firebase !== 'undefined' ? firebase.firestore() : null;
    if (!db) return null;
    try {
        var id = certData.id || generateCertId();
        await db.collection('certs').doc(id).set({
            id: id,
            name: certData.name,
            type: certData.type, // 'scholar', 'technical', 'trail_meadow', 'trail_mountain', 'trail_summit'
            title: certData.title,
            date: certData.date,
            score: certData.score || null,
            uid: certData.uid || null,
            username: certData.username || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return id;
    } catch(e) {
        console.error('[CERT] Save error:', e);
        return null;
    }
}

// Wrap existing downloadCertificate to also generate shareable link
var _origDownloadCert = window.downloadCertificate;
if (_origDownloadCert) {
    window.downloadCertificate = async function(type) {
        // Call original to download the PNG
        _origDownloadCert(type);

        // Also save to Firestore for sharing
        var certType = type || 'properties';
        var title = certType === 'technical' ? 'Bitcoin Protocol Expert' : 'Bitcoin Scholar';
        var name = (document.getElementById('certName') ? document.getElementById('certName').value.trim() : '') || 'Bitcoiner';
        var auth = typeof firebase !== 'undefined' ? firebase.auth() : null;

        var certId = generateCertId();
        var saved = await saveCertToFirestore({
            id: certId,
            name: name,
            type: certType === 'technical' ? 'technical' : 'scholar',
            title: title,
            date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            uid: auth && auth.currentUser ? auth.currentUser.uid : null,
            username: (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : null
        });

        if (saved) {
            // Show share UI after a brief delay
            setTimeout(function() { showShareUI(certId, title, name); }, 1500);
        }
    };
}

function showShareUI(certId, title, name) {
    var url = 'https://bitcoineducation.quest/#cert/' + certId;

    var overlay = document.createElement('div');
    overlay.id = 'certShareOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100020;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
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
                '<a href="https://twitter.com/intent/tweet?text=' + encodeURIComponent('I just earned my ' + title + ' certification from @BTCeduArchive! 🎓₿ Verify: ' + url) + '" target="_blank" style="padding:8px 16px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.75rem;font-weight:700;text-decoration:none;cursor:pointer;">𝕏 Share</a>' +
                '<a href="https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url) + '" target="_blank" style="padding:8px 16px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.75rem;font-weight:700;text-decoration:none;cursor:pointer;">💼 LinkedIn</a>' +
            '</div>' +
            '<button onclick="document.getElementById(\'certShareOverlay\').remove()" style="width:100%;padding:8px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-faint);font-size:0.8rem;cursor:pointer;font-family:inherit;">Close</button>' +
        '</div>';

    document.body.appendChild(overlay);
}

// Public verification page: /#cert/CERT-XXXXX
window.renderCertVerification = async function(certId) {
    var fc = document.getElementById('forumContainer');
    if (!fc) return;

    fc.innerHTML = '<div style="max-width:500px;margin:0 auto;padding:40px 16px;text-align:center;">' +
        '<div style="font-size:2rem;margin-bottom:12px;">⏳</div>' +
        '<div style="color:var(--text-muted);">Verifying certificate...</div></div>';
    fc.style.display = 'block';

    var db = typeof firebase !== 'undefined' ? firebase.firestore() : null;
    if (!db) {
        fc.innerHTML = '<div style="max-width:500px;margin:0 auto;padding:40px 16px;text-align:center;"><div style="font-size:2rem;margin-bottom:12px;">⚠️</div><div style="color:var(--text-muted);">Could not connect. Try refreshing.</div></div>';
        return;
    }

    try {
        var doc = await db.collection('certs').doc(certId).get();
        if (!doc.exists) {
            fc.innerHTML = '<div style="max-width:500px;margin:0 auto;padding:40px 16px;text-align:center;">' +
                '<div style="font-size:3rem;margin-bottom:12px;">❌</div>' +
                '<h2 style="color:var(--heading);margin:0 0 8px;">Certificate Not Found</h2>' +
                '<p style="color:var(--text-muted);font-size:0.85rem;">This certificate ID does not exist or has been revoked.</p>' +
                '<button onclick="goHome()" style="margin-top:16px;padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;">Go to Archive</button></div>';
            return;
        }

        var d = doc.data();
        var esc = typeof escapeHtml === 'function' ? escapeHtml : function(s) { return s; };
        var typeEmoji = d.type === 'technical' ? '🛠️' : d.type === 'scholar' ? '🎓' : '🏔️';
        var typeColor = d.type === 'technical' ? '#3b82f6' : '#f7931a';

        var html = '<div style="max-width:500px;margin:0 auto;padding:30px 16px 120px;">';

        // Verified badge
        html += '<div style="text-align:center;margin-bottom:24px;animation:fadeSlideIn 0.4s;">' +
            '<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 20px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:20px;color:#22c55e;font-size:0.8rem;font-weight:700;margin-bottom:16px;">✅ VERIFIED CERTIFICATE</div>' +
            '<div style="font-size:4rem;margin-bottom:12px;">' + typeEmoji + '</div>' +
            '<h2 style="color:var(--heading);font-size:1.4rem;font-weight:900;margin:0 0 4px;">' + esc(d.title) + '</h2>' +
            '<p style="color:var(--text-muted);font-size:0.85rem;margin:0;">Bitcoin Education Archive Certification</p>' +
        '</div>';

        // Certificate card
        html += '<div style="background:var(--card-bg);border:2px solid ' + typeColor + ';border-radius:20px;padding:24px;margin-bottom:20px;text-align:center;">' +
            '<div style="color:var(--text-faint);font-size:0.7rem;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:8px;">AWARDED TO</div>' +
            '<div style="color:var(--heading);font-size:1.5rem;font-weight:900;margin-bottom:16px;">' + esc(d.name) + '</div>' +
            '<div style="color:var(--text-muted);font-size:0.85rem;line-height:1.6;margin-bottom:16px;">has successfully passed the<br><strong style="color:' + typeColor + ';">' + esc(d.title) + '</strong><br>certification examination.</div>' +
            (d.score ? '<div style="color:var(--text-faint);font-size:0.78rem;margin-bottom:12px;">Score: ' + esc(d.score) + '</div>' : '') +
            '<div style="color:var(--text-faint);font-size:0.78rem;">Date: ' + esc(d.date) + '</div>' +
            '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">' +
                '<div style="color:var(--text-faint);font-size:0.65rem;font-family:monospace;">Certificate ID: ' + esc(certId) + '</div>' +
            '</div>' +
        '</div>';

        // CTA
        html += '<div style="text-align:center;">' +
            '<p style="color:var(--text-muted);font-size:0.82rem;margin-bottom:16px;">Want to earn your own Bitcoin certification?</p>' +
            '<button onclick="goHome()" style="padding:14px 28px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.95rem;">🦌 Start Learning at Bitcoin Education Archive</button>' +
        '</div>';

        html += '</div>';
        fc.innerHTML = html;
        fc.scrollTop = 0;

    } catch(e) {
        fc.innerHTML = '<div style="max-width:500px;margin:0 auto;padding:40px 16px;text-align:center;"><div style="font-size:2rem;margin-bottom:12px;">⚠️</div><div style="color:var(--text-muted);">Error loading certificate. Try refreshing.</div></div>';
    }
};

// Route handler: go('cert/XXXXX')
var _realGoCert = window.go;
if (_realGoCert) {
    window.go = async function(id) {
        if (typeof id === 'string' && id.indexOf('cert/') === 0) {
            var certId = id.replace('cert/', '');
            if (window._nachoMode && typeof exitNachoMode === 'function') exitNachoMode(true);
            document.getElementById('home').classList.add('hidden');
            document.getElementById('hero').innerHTML = '';
            document.getElementById('hero').style.display = 'none';
            document.getElementById('msgs').innerHTML = '';
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
    var auth = typeof firebase !== 'undefined' ? firebase.auth() : null;
    var certId = generateCertId();
    var saved = await saveCertToFirestore({
        id: certId,
        name: name || 'Bitcoiner',
        type: type,
        title: title,
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        uid: auth && auth.currentUser ? auth.currentUser.uid : null,
        username: (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : null
    });
    if (saved) showShareUI(certId, title, name);
    return certId;
};

console.log('[CERTS] Shareable certificates loaded');
})();
