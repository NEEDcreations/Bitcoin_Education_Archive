// © 2024-2026 603BTC LLC. All rights reserved.
// Player card when a sitewide daily cap is hit. Copy must stay in sync with
// functions/src/sitewideCaps.js (CAP_CARD / CAP_HIT_MESSAGE).
(function (root) {
    'use strict';

    var CAP_CARD = {
        title: 'Busy right now',
        body: 'Rewards are busy right now. Please try again later.',
        secondary: 'You can still play and learn in the meantime.',
        button: 'Keep exploring',
        code: 'sitewide-cap'
    };

    // Lucide "clock" (circle + hands). Slate stroke, no fill, no orange.
    var LUCIDE_CLOCK = '<svg class="lucide-clock" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';

    function isSitewideCapError(err, data) {
        var src = data || {};
        if (src.capCard === true || src.code === CAP_CARD.code) return true;
        if (err && err.details && (err.details.code === CAP_CARD.code || err.details.capCard === true)) return true;
        var msg = '';
        if (src.error) msg = String(src.error);
        else if (err && err.message) msg = String(err.message);
        if (msg === CAP_CARD.body || msg === 'try again later') return true;
        if (err && err.code && String(err.code).indexOf('resource-exhausted') !== -1 && (msg === CAP_CARD.body || msg === 'try again later')) return true;
        return false;
    }

    function showSitewideCapCard() {
        var old = document.getElementById('sitewideCapCardOverlay');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var overlay = document.createElement('div');
        overlay.id = 'sitewideCapCardOverlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'sitewideCapCardTitle');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:100030;background:rgba(15,23,42,0.72);display:flex;align-items:center;justify-content:center;padding:20px;';
        var card = document.createElement('div');
        card.style.cssText = 'background:#1e293b;border:1px solid #334155;border-radius:20px;padding:28px 24px 22px;max-width:360px;width:100%;text-align:center;color:#e2e8f0;font-family:inherit;box-shadow:0 16px 40px rgba(15,23,42,0.45);';
        var iconWrap = document.createElement('div');
        iconWrap.style.cssText = 'width:48px;height:48px;border-radius:50%;background:#334155;color:#cbd5e1;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;';
        iconWrap.innerHTML = LUCIDE_CLOCK;
        var title = document.createElement('h2');
        title.id = 'sitewideCapCardTitle';
        title.textContent = CAP_CARD.title;
        title.style.cssText = 'margin:0 0 8px;font-size:1.25rem;font-weight:800;color:#f1f5f9;';
        var body = document.createElement('p');
        body.textContent = CAP_CARD.body;
        body.style.cssText = 'margin:0 0 8px;font-size:0.95rem;line-height:1.45;color:#e2e8f0;';
        var secondary = document.createElement('p');
        secondary.textContent = CAP_CARD.secondary;
        secondary.style.cssText = 'margin:0 0 20px;font-size:0.85rem;line-height:1.4;color:#94a3b8;';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = 'min-height:44px;width:100%;padding:10px 16px;background:#475569;color:#e2e8f0;border:1px solid #64748b;border-radius:12px;font-size:0.95rem;font-weight:800;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;gap:8px;';
        btn.innerHTML = LUCIDE_CLOCK + '<span></span>';
        btn.querySelector('span').textContent = CAP_CARD.button;
        function close() {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }
        btn.addEventListener('click', close);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        card.appendChild(iconWrap);
        card.appendChild(title);
        card.appendChild(body);
        card.appendChild(secondary);
        card.appendChild(btn);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        try { btn.focus(); } catch (e) {}
        return overlay;
    }

    root.SITEWIDE_CAP_CARD = CAP_CARD;
    root.isSitewideCapError = isSitewideCapError;
    root.showSitewideCapCard = showSitewideCapCard;
})(typeof window !== 'undefined' ? window : this);
