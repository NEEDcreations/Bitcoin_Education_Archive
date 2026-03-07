// © 2024-2026 603BTC LLC. All rights reserved.
// =============================================
// ⚡ Lightning Address Prompt
// Nudges new & returning users to set up a
// Lightning Address so they can receive tips.
// Dismissible — once dismissed, never shows again.
// Load AFTER ranking.js (needs currentUser).
// =============================================

(function() {
'use strict';

var DISMISS_KEY = 'btc_ln_prompt_dismissed';
var CHECK_DELAY = 4000; // Wait for auth + user data to load

function isDismissed() {
    return localStorage.getItem(DISMISS_KEY) === '1';
}

function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    var el = document.getElementById('lnAddressPrompt');
    if (el) {
        el.style.transition = 'opacity 0.3s, transform 0.3s';
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(function() { el.remove(); }, 300);
    }
}

function hasLightningAddress() {
    if (typeof currentUser === 'undefined' || !currentUser) return false;
    var ln = currentUser.lightning || '';
    return ln.includes('@');
}

function isSignedInUser() {
    return typeof auth !== 'undefined' && auth.currentUser && !auth.currentUser.isAnonymous;
}

function showPrompt() {
    if (document.getElementById('lnAddressPrompt')) return;

    var banner = document.createElement('div');
    banner.id = 'lnAddressPrompt';
    banner.style.cssText = 'position:fixed;bottom:72px;left:12px;right:12px;z-index:9997;' +
        'max-width:420px;margin:0 auto;' +
        'background:linear-gradient(135deg,rgba(234,179,8,0.12),rgba(249,115,22,0.08));' +
        'border:1px solid rgba(234,179,8,0.35);' +
        'border-radius:18px;padding:16px 18px;' +
        'box-shadow:0 8px 32px rgba(0,0,0,0.4);' +
        'animation:fadeSlideIn 0.4s ease-out;' +
        'font-family:inherit;';

    banner.innerHTML =
        '<div style="display:flex;align-items:flex-start;gap:12px;">' +
            '<div style="font-size:1.6rem;flex-shrink:0;margin-top:2px;">⚡</div>' +
            '<div style="flex:1;min-width:0;">' +
                '<div style="color:var(--heading);font-size:0.92rem;font-weight:800;margin-bottom:3px;">Set Up Your Lightning Address</div>' +
                '<div style="color:var(--text-muted);font-size:0.78rem;line-height:1.5;margin-bottom:10px;">Add a Lightning Address to your profile so other users can tip you sats! It only takes a few seconds.</div>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                    '<button onclick="document.getElementById(\'lnAddressPrompt\').remove();showSettingsPage(\'account\');setTimeout(function(){var el=document.getElementById(\'profile_lightning\');if(el){el.scrollIntoView({behavior:\'smooth\',block:\'center\'});el.style.border=\'2px solid #eab308\';el.style.boxShadow=\'0 0 12px rgba(234,179,8,0.4)\';el.focus();setTimeout(function(){el.style.border=\'\';el.style.boxShadow=\'\';},3000);}},600)" style="padding:8px 16px;background:#eab308;color:#000;border:none;border-radius:10px;font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;">⚡ Set Up Now</button>' +
                    '<button onclick="dismissLnPrompt()" style="padding:8px 16px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.82rem;cursor:pointer;font-family:inherit;">Not now</button>' +
                '</div>' +
            '</div>' +
            '<button onclick="dismissLnPrompt()" style="background:none;border:none;color:var(--text-faint);font-size:1rem;cursor:pointer;padding:0;line-height:1;flex-shrink:0;" title="Dismiss">✕</button>' +
        '</div>';

    document.body.appendChild(banner);

    // Auto-dismiss after 30 seconds
    setTimeout(function() {
        var el = document.getElementById('lnAddressPrompt');
        if (el) {
            el.style.transition = 'opacity 0.5s';
            el.style.opacity = '0';
            setTimeout(function() { if (el.parentNode) el.remove(); }, 500);
        }
    }, 30000);
}

window.dismissLnPrompt = function() {
    dismiss();
};

// ─── Check on load ───────────────────────────────────────
function checkAndPrompt() {
    // Don't show if already dismissed
    if (isDismissed()) return;
    // Don't show for anonymous users
    if (!isSignedInUser()) return;
    // Don't show if they already have a Lightning Address
    if (hasLightningAddress()) return;
    // Don't show if the settings panel is already open
    if (document.querySelector('#usernameModal:not(.hidden)')) return;

    showPrompt();
}

// Run after user data has loaded
setTimeout(checkAndPrompt, CHECK_DELAY);

// Also check when user signs in (auth state changes)
var _lnPromptChecked = false;
var _origUpdateAuthButton = window.updateAuthButton;
if (typeof _origUpdateAuthButton === 'function') {
    window.updateAuthButton = function() {
        _origUpdateAuthButton.apply(this, arguments);
        if (!_lnPromptChecked) {
            _lnPromptChecked = true;
            setTimeout(checkAndPrompt, 2000);
        }
    };
}

console.log('[LN-PROMPT] Lightning address prompt loaded');
})();
