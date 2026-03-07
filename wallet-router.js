// © 2024-2026 603BTC LLC. All rights reserved.
// =============================================
// ₿ Wallet Router — Unified Wallet Page
// Single "Wallet" route with On-Chain + Lightning tabs.
// Load LAST, after all other wallet scripts.
// =============================================

(function() {
'use strict';

var _walletTab = 'lightning'; // Default to lightning tab

var WALLET_ROUTES = {
    'wallet':    { render: 'renderWalletPage', title: 'Wallet', emoji: '₿' },
    'lightning': { render: 'renderWalletPage', title: 'Wallet', emoji: '₿', tab: 'lightning' },
};

// ─── Unified Wallet Page with Tabs ───────────────────────
window.renderWalletPage = function(tab) {
    if (tab) _walletTab = tab;
    var fc = document.getElementById('forumContainer');
    if (!fc) return;

    var h = '<div style="max-width:580px;margin:0 auto;padding:20px 16px 120px;">';

    // Header
    h += '<div style="text-align:center;margin-bottom:20px;animation:fadeSlideIn 0.4s ease-out;">' +
        '<div onclick="goHome()" style="cursor:pointer;display:inline-flex;align-items:center;gap:8px;margin-bottom:12px;color:var(--text-muted);font-size:0.8rem;">← Back to Archive</div>' +
        '<div style="font-size:2.5rem;margin-bottom:6px;">₿</div>' +
        '<h2 style="color:var(--heading);font-size:1.4rem;font-weight:900;margin:0 0 4px;">Bitcoin Wallet</h2>' +
        '<p style="color:var(--text-muted);font-size:0.82rem;margin:0;">Non-custodial · Your keys · Your coins</p>' +
    '</div>';

    // Tabs
    h += '<div style="display:flex;gap:4px;margin-bottom:18px;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:4px;">';
    var tabs = [
        { id: 'lightning', label: '⚡ Lightning', desc: 'Instant payments' },
        { id: 'onchain', label: '₿ On-Chain', desc: 'Self-custody' },
    ];
    tabs.forEach(function(t) {
        var active = _walletTab === t.id;
        h += '<button onclick="renderWalletPage(\'' + t.id + '\')" style="flex:1;padding:10px 8px;border-radius:11px;border:none;' +
            'background:' + (active ? 'var(--accent)' : 'none') + ';' +
            'color:' + (active ? '#fff' : 'var(--text-muted)') + ';' +
            'font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;touch-action:manipulation;">' +
            t.label + '</button>';
    });
    h += '</div>';

    // Tab content
    h += '<div id="walletTabContent">';
    if (_walletTab === 'lightning') {
        h += renderLightningTab();
    } else {
        h += renderOnChainTab();
    }
    h += '</div>';

    h += '</div>';
    fc.innerHTML = h;
};

// ─── Lightning Tab Content ───────────────────────────────
function renderLightningTab() {
    // Delegate to existing renderLightning but capture its content
    // We'll call the inner rendering functions directly
    if (typeof renderLightning !== 'function') return '<div style="color:var(--text-muted);text-align:center;padding:40px;">Lightning module not loaded</div>';
    
    // Render lightning into a temp container and extract the inner content
    var tempDiv = document.createElement('div');
    tempDiv.id = 'forumContainer';
    tempDiv.style.display = 'none';
    document.body.appendChild(tempDiv);
    renderLightning();
    var content = tempDiv.innerHTML;
    document.body.removeChild(tempDiv);
    
    // Strip the outer wrapper (header/back button) since we have our own
    // Find the content after the header section
    var match = content.match(/←.*?Back to Archive[\s\S]*?<\/div>\s*<\/div>/);
    if (match) {
        content = content.replace(match[0], '');
    }
    // Also remove duplicate ⚡ header and subtitle
    content = content.replace(/<div style="font-size:2\.5rem[^>]*>⚡<\/div>/, '');
    content = content.replace(/<h2[^>]*>Lightning Wallet<\/h2>/, '');
    content = content.replace(/<p[^>]*>Connect your own wallet[^<]*<\/p>/, '');
    // Remove the on-chain wallet button at the bottom (we have a tab for that)
    content = content.replace(/<button onclick="go\('wallet'\)"[^>]*>₿ On-Chain Self-Custody Wallet<\/button>/, '');
    
    return content;
}

// ─── On-Chain Tab Content ────────────────────────────────
function renderOnChainTab() {
    if (typeof renderWallet !== 'function') return '<div style="color:var(--text-muted);text-align:center;padding:40px;">Wallet module not loaded</div>';
    
    var tempDiv = document.createElement('div');
    tempDiv.id = 'forumContainer';
    tempDiv.style.display = 'none';
    document.body.appendChild(tempDiv);
    renderWallet();
    var content = tempDiv.innerHTML;
    document.body.removeChild(tempDiv);
    
    // Strip the outer wrapper header
    var match = content.match(/←.*?Back to Archive[\s\S]*?<\/div>\s*<\/div>/);
    if (match) {
        content = content.replace(match[0], '');
    }
    content = content.replace(/<div style="font-size:2\.5rem[^>]*>₿<\/div>/, '');
    content = content.replace(/<h2[^>]*>Self-Custody Wallet<\/h2>/, '');
    content = content.replace(/<p[^>]*>Your keys · Your coins · 100% client-side<\/p>/, '');
    // Remove the lightning button (we have a tab for that)
    content = content.replace(/<button onclick="go\('lightning'\)"[^>]*>⚡ Connect Lightning Wallet<\/button>/, '');
    
    return content;
}

// ─── Patch go() ──────────────────────────────────────────
var _origGo = window.go;

window.go = async function(id, btn, fromPopState) {
    var route = WALLET_ROUTES[id];
    if (!route) return _origGo.apply(this, arguments);

    // Set tab if specified
    if (route.tab) _walletTab = route.tab;
    if (id === 'wallet' && !route.tab) _walletTab = _walletTab || 'lightning';

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

    // Render unified page
    renderWalletPage();

    document.title = 'Wallet — Bitcoin Education Archive';

    if (typeof setFloatingElementsVisible === 'function') setFloatingElementsVisible(true);
    if (typeof nachoOnPage === 'function') nachoOnPage('wallet');
    if (typeof awardPoints === 'function') awardPoints(5, 'Visited Wallet');
};

// ─── Handle hash on page load ────────────────────────────
(function() {
    var hash = window.location.hash.slice(1);
    if (hash === 'wallet' || hash === 'lightning') {
        _walletTab = hash === 'lightning' ? 'lightning' : 'lightning';
        setTimeout(function() { go('wallet', null, true); }, 600);
    }
})();

// ─── Search entries ──────────────────────────────────────
if (typeof window._searchableApps === 'undefined') window._searchableApps = [];
window._searchableApps.push(
    { id: '_wallet', title: '₿ Bitcoin Wallet', desc: 'On-chain wallet, Lightning payments, tips, WebLN, NWC', keywords: 'wallet bitcoin self custody keys seed phrase address balance receive btc sats lightning webln alby nwc nostr wallet connect bolt11 invoice send receive instant payment', action: "go('wallet')" },
    { id: '_tips', title: '⚡ Lightning Tips', desc: 'Tip users, pay for listings, buy event tickets with sats', keywords: 'tip sats lightning pay zap send money reward tipping tips', action: "go('wallet')" }
);

// ─── Inject single nav button ────────────────────────────
function injectButtons() {
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
                    b.style.cssText = 'padding:15px;background:var(--card-bg);border:1px solid var(--border);border-radius:16px;color:var(--text);font-size:0.85rem;font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;transition:0.2s;';
                    b.innerHTML = '<span style="font-size:1.8rem;">₿</span><span>Wallet</span>';
                    b.onclick = function() { go('wallet'); if (typeof toggleAppsMenu === 'function') toggleAppsMenu(); };
                    mgrid.appendChild(b);
                }
            }
        };
    }
}

setTimeout(injectButtons, 1200);
document.addEventListener('DOMContentLoaded', function() { setTimeout(injectButtons, 800); });

console.log('[ROUTER] Unified wallet route registered');
})();
