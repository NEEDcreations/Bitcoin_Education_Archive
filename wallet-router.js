// © 2024-2026 603BTC LLC. All rights reserved.
// =============================================
// ⚡ Wallet Router — Lightning Only
// Single route for Lightning wallet page.
// Load LAST, after lightning.js + lightning-tips.js.
// =============================================

(function() {
'use strict';

var WALLET_ROUTES = {
    'wallet':    { render: 'renderLightning', title: 'Lightning Wallet', emoji: '⚡' },
    'lightning': { render: 'renderLightning', title: 'Lightning Wallet', emoji: '⚡' },
};

// ─── Patch go() ──────────────────────────────────────────
var _origGo = window.go;

window.go = async function(id, btn, fromPopState) {
    var route = WALLET_ROUTES[id];
    if (!route) return _origGo.apply(this, arguments);

    // Standard app-route setup
    if (window._nachoMode && typeof exitNachoMode === 'function') exitNachoMode(true);
    document.getElementById('home').classList.add('hidden');
    document.getElementById('hero').innerHTML = '';
    document.getElementById('msgs').innerHTML = '';
    document.getElementById('msgs').style.display = 'none';
    document.getElementById('hero').style.display = 'none';
    var fc = document.getElementById('forumContainer');
    if (fc) fc.style.display = 'block';
    if (!fromPopState) history.pushState({ channel: 'wallet' }, '', '#wallet');
    if (typeof isMobile === 'function' && isMobile()) {
        document.getElementById('sidebar').classList.remove('open');
    }

    // Render
    if (typeof window[route.render] === 'function') window[route.render]();

    document.title = 'Lightning Wallet — Bitcoin Education Archive';

    if (typeof setFloatingElementsVisible === 'function') setFloatingElementsVisible(true);
    if (typeof nachoOnPage === 'function') nachoOnPage('wallet');
    if (typeof awardPoints === 'function') awardPoints(5, 'Visited Lightning Wallet');
};

// ─── Handle hash on page load ────────────────────────────
(function() {
    var hash = window.location.hash.slice(1);
    if (hash === 'wallet' || hash === 'lightning') {
        setTimeout(function() { go('wallet', null, true); }, 600);
    }
})();

// ─── Search entries ──────────────────────────────────────
if (typeof window._searchableApps === 'undefined') window._searchableApps = [];
window._searchableApps.push(
    { id: '_wallet', title: '⚡ Lightning Wallet', desc: 'Connect your Lightning wallet, send & receive sats, tips', keywords: 'wallet bitcoin lightning webln alby nwc nostr wallet connect bolt11 invoice send receive instant payment sats tip', action: "go('wallet')" },
    { id: '_tips', title: '⚡ Lightning Tips', desc: 'Tip users, pay for listings, buy event tickets with sats', keywords: 'tip sats lightning pay zap send money reward tipping tips', action: "go('wallet')" }
);

// ─── Inject nav button (single, full-width, orange) ──────
function injectButtons() {
    var homeApps = document.getElementById('homeAppsMenu');
    if (homeApps) {
        var grids = homeApps.querySelectorAll('div[style*="grid-template"]');
        var grid = grids.length > 0 ? grids[grids.length - 1] : null;
        if (grid && !grid.querySelector('[data-wallet-nav]')) {
            var walletBtn = document.createElement('button');
            walletBtn.setAttribute('data-wallet-nav', '1');
            walletBtn.style.cssText = 'padding:12px 5px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.85rem;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;grid-column:1/-1;touch-action:manipulation;';
            walletBtn.innerHTML = '⚡ Wallet';
            walletBtn.onclick = function() { go('wallet'); };
            grid.appendChild(walletBtn);
        }
    }

    var origApps = window.toggleAppsMenu;
    if (origApps && !window._walletPatchedAppsMenu) {
        window._walletPatchedAppsMenu = true;
        window.toggleAppsMenu = function(e) {
            origApps(e);
            var menu = document.getElementById('appsMenu');
            if (menu && !menu.querySelector('[data-wallet-nav]')) {
                var mgrid = menu.querySelector('div[style*="grid"]');
                if (mgrid) {
                    var b = document.createElement('button');
                    b.setAttribute('data-wallet-nav', '1');
                    b.style.cssText = 'padding:15px;background:var(--accent);color:#fff;border:none;border-radius:16px;font-size:0.85rem;font-weight:800;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;grid-column:1/-1;touch-action:manipulation;';
                    b.innerHTML = '<span style="font-size:1.8rem;">⚡</span><span>Wallet</span>';
                    b.onclick = function() { go('wallet'); if (typeof toggleAppsMenu === 'function') toggleAppsMenu(); };
                    mgrid.appendChild(b);
                }
            }
        };
    }
}

setTimeout(injectButtons, 1200);
document.addEventListener('DOMContentLoaded', function() { setTimeout(injectButtons, 800); });

console.log('[ROUTER] Lightning wallet route registered');
})();
