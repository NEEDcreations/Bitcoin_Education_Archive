// © 2024-2026 603BTC LLC. All rights reserved.
// =============================================
// ₿ Wallet Router — Integration Patch
// Adds wallet + lightning routes to go()
// Adds nav buttons to home page & apps menu
// Load LAST, after all other wallet scripts.
// =============================================

(function() {
'use strict';

var WALLET_ROUTES = {
    'wallet':    { render: 'renderWallet',    title: 'Self-Custody Wallet',  emoji: '₿' },
    'lightning': { render: 'renderLightning', title: 'Lightning Wallet',     emoji: '⚡' },
};

// ─── Patch go() ──────────────────────────────────────────
var _origGo = window.go;

window.go = async function(id, btn, fromPopState) {
    var route = WALLET_ROUTES[id];
    if (!route) return _origGo.apply(this, arguments);

    // Standard app-route setup (identical to forum/marketplace pattern)
    if (window._nachoMode && typeof exitNachoMode === 'function') exitNachoMode(true);
    document.getElementById('home').classList.add('hidden');
    document.getElementById('hero').innerHTML = '';
    document.getElementById('msgs').innerHTML = '';
    document.getElementById('msgs').style.display = 'none';
    document.getElementById('hero').style.display = 'none';
    var fc = document.getElementById('forumContainer');
    if (fc) fc.style.display = 'block';
    if (!fromPopState) history.pushState({ channel: id }, '', '#' + id);
    if (typeof isMobile === 'function' && isMobile()) {
        document.getElementById('sidebar').classList.remove('open');
    }

    // Render
    if (typeof window[route.render] === 'function') window[route.render]();

    // Update title
    document.title = route.title + ' — Bitcoin Education Archive';

    // Floating UI
    if (typeof setFloatingElementsVisible === 'function') setFloatingElementsVisible(true);
    if (typeof nachoOnPage === 'function') nachoOnPage(id);

    // Points for visiting
    if (typeof awardPoints === 'function') awardPoints(5, 'Visited ' + route.title);
};

// ─── Handle hash on page load ────────────────────────────
(function() {
    var hash = window.location.hash.slice(1);
    if (WALLET_ROUTES[hash]) {
        setTimeout(function() { go(hash, null, true); }, 600);
    }
})();

// ─── Add search entries ──────────────────────────────────
// These get picked up by the existing search system
if (typeof window._searchableApps === 'undefined') window._searchableApps = [];
window._searchableApps.push(
    { id: '_wallet', title: '₿ Self-Custody Wallet', desc: 'Generate Bitcoin wallet, view balance, receive BTC', keywords: 'wallet bitcoin self custody keys seed phrase address balance receive btc sats mnemonic bip39', action: "go('wallet')" },
    { id: '_lightning', title: '⚡ Lightning Wallet', desc: 'Connect your Lightning wallet — WebLN, Alby, NWC', keywords: 'lightning wallet webln alby nwc nostr wallet connect bolt11 invoice send receive instant payment sats', action: "go('lightning')" }
);

// ─── Inject nav buttons into home page apps grid ─────────
function injectButtons() {
    // Desktop apps grid
    var homeApps = document.getElementById('homeAppsMenu');
    if (homeApps) {
        var grids = homeApps.querySelectorAll('div[style*="grid-template"]');
        var grid = grids.length > 0 ? grids[grids.length - 1] : null;
        if (grid && !grid.querySelector('[data-wallet-nav]')) {
            var btnStyle = 'padding:12px 5px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.8rem;font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;';
            var walletBtn = document.createElement('button');
            walletBtn.setAttribute('data-wallet-nav', '1');
            walletBtn.style.cssText = btnStyle;
            walletBtn.innerHTML = '₿ Wallet';
            walletBtn.onclick = function() { go('wallet'); };
            grid.appendChild(walletBtn);

            var lnBtn = document.createElement('button');
            lnBtn.setAttribute('data-wallet-nav', '1');
            lnBtn.style.cssText = btnStyle;
            lnBtn.innerHTML = '⚡ Lightning';
            lnBtn.onclick = function() { go('lightning'); };
            grid.appendChild(lnBtn);
        }
    }

    // Mobile apps menu (created dynamically by toggleAppsMenu)
    var origApps = window.toggleAppsMenu;
    if (origApps && !window._walletPatchedAppsMenu) {
        window._walletPatchedAppsMenu = true;
        window.toggleAppsMenu = function(e) {
            origApps(e);
            var menu = document.getElementById('appsMenu');
            if (menu && !menu.querySelector('[data-wallet-nav]')) {
                var mgrid = menu.querySelector('div[style*="grid"]');
                if (mgrid) {
                    var mStyle = 'padding:15px;background:var(--card-bg);border:1px solid var(--border);border-radius:16px;color:var(--text);font-size:0.85rem;font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;transition:0.2s;';
                    ['wallet', 'lightning'].forEach(function(id) {
                        var r = WALLET_ROUTES[id];
                        var b = document.createElement('button');
                        b.setAttribute('data-wallet-nav', '1');
                        b.style.cssText = mStyle;
                        b.innerHTML = '<span style="font-size:1.8rem;">' + r.emoji + '</span><span>' + r.title.replace(' Wallet', '') + '</span>';
                        b.onclick = function() { go(id); if (typeof toggleAppsMenu === 'function') toggleAppsMenu(); };
                        mgrid.appendChild(b);
                    });
                }
            }
        };
    }
}

// Run injection when DOM is ready
setTimeout(injectButtons, 1200);
document.addEventListener('DOMContentLoaded', function() { setTimeout(injectButtons, 800); });

console.log('[ROUTER] Wallet + Lightning routes registered');
})();
