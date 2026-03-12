// ============================================================
// Bitcoin Education Archive — Mobile Optimizations
// Cherry-picked from audit: floating button cleanup, swipe hint,
// modal fixes, iOS zoom prevention, touch targets.
// Load AFTER onboarding.js
// ============================================================

(function() {
'use strict';

// Only run on mobile/touch devices
if (window.innerWidth > 900 && !('ontouchstart' in window)) return;

function getLevel() {
    if (typeof getUserSimplificationLevel === 'function') return getUserSimplificationLevel();
    try {
        var p = JSON.parse(localStorage.getItem('btc_onboarding_profile'));
        return p ? p.level : 'beginner';
    } catch(e) { return 'beginner'; }
}

// ─── 1. Floating Button Cleanup ──────────────────────────
// 7 floating elements compete on a 375px screen.
// Beginners: hide all except backToTop + bottomNav.
// Intermediate: hide random + guest banner, reposition others.

function cleanupFloatingButtons() {
    var level = getLevel();

    if (level === 'beginner') {
        ['lbFloatBtn', 'floatingRandomBtn', 'mobileSearchBtn', 'desktopDMBtn',
         'scrollToBottom', 'guestPointsBanner'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) {
                el.setAttribute('data-mobile-hidden', 'true');
                el.style.display = 'none';
            }
        });

        var btt = document.getElementById('backToTop');
        if (btt) {
            btt.style.width = '32px';
            btt.style.height = '32px';
            btt.style.fontSize = '0.9rem';
            btt.style.bottom = '70px';
            btt.style.right = '10px';
        }
    }

    else if (level === 'intermediate') {
        ['floatingRandomBtn', 'guestPointsBanner', 'desktopDMBtn'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) {
                el.setAttribute('data-mobile-hidden', 'true');
                el.style.display = 'none';
            }
        });

        var lbBtn = document.getElementById('lbFloatBtn');
        if (lbBtn) {
            lbBtn.style.bottom = '70px';
            lbBtn.style.right = '10px';
            lbBtn.style.padding = '8px 12px';
            lbBtn.style.fontSize = '0.8rem';
        }
    }
}

// ─── 2. Swipe Navigation Hint ────────────────────────────
// One-time tooltip on first channel visit.

function addSwipeFeedback() {
    if (localStorage.getItem('btc_swipe_hint_shown')) return;

    var _origGoSwipe = window.go;
    if (typeof _origGoSwipe !== 'function') return;

    var _patched = false;
    window.go = function() {
        var result = _origGoSwipe.apply(this, arguments);
        if (!_patched && arguments[0] && typeof CHANNELS !== 'undefined' && CHANNELS[arguments[0]]) {
            _patched = true;
            setTimeout(showSwipeHint, 2000);
        }
        return result;
    };
}

function showSwipeHint() {
    if (localStorage.getItem('btc_swipe_hint_shown')) return;
    localStorage.setItem('btc_swipe_hint_shown', 'true');

    var hint = document.createElement('div');
    hint.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:300;' +
        'background:rgba(15,23,42,0.95);border:1px solid rgba(249,115,22,0.3);color:#fff;' +
        'padding:12px 20px;border-radius:14px;font-size:0.85rem;font-weight:600;' +
        'box-shadow:0 8px 30px rgba(0,0,0,0.4);display:flex;align-items:center;gap:10px;' +
        'animation:fadeSlideIn 0.3s ease-out;backdrop-filter:blur(8px);max-width:90vw;font-family:inherit;';
    hint.innerHTML = '<span style="font-size:1.3rem;">👆</span>' +
        '<span>Swipe left/right to navigate channels</span>';
    document.body.appendChild(hint);

    setTimeout(function() {
        hint.style.transition = 'opacity 0.4s, transform 0.4s';
        hint.style.opacity = '0';
        hint.style.transform = 'translateX(-50%) translateY(10px)';
        setTimeout(function() { hint.remove(); }, 400);
    }, 4000);
}

// ─── 3. Mobile CSS Fixes ─────────────────────────────────
// Safe areas, touch targets, modal overflow, iOS zoom.

function addMobileCSSFixes() {
    var style = document.createElement('style');
    style.id = 'mobileOptCSS';
    style.textContent =
        '@media(max-width:900px) {' +
        // Safe area padding for bottom nav
        '  #bottomNav { padding-bottom: max(env(safe-area-inset-bottom, 10px), 10px) !important; }' +
        // Modals don't get hidden behind bottom nav
        '  #spinModal > div, #donateModal > div {' +
        '    max-height: calc(100vh - 80px) !important;' +
        '    overflow-y: auto !important;' +
        '    -webkit-overflow-scrolling: touch;' +
        '  }' +
        // Better touch targets (44px minimum per Apple HIG)
        '  .ch-btn { min-height: 44px; display: flex; align-items: center; }' +
        '  .bnav-btn { min-height: 50px; }' +
        // Prevent iOS zoom on input focus
        '  input, textarea, select { font-size: 16px !important; }' +
        // Nacho Mode input: safe area
        '  #nachoModeScreen > div:last-child {' +
        '    padding-bottom: max(env(safe-area-inset-bottom, 12px), 12px) !important;' +
        '  }' +
        '}';
    document.head.appendChild(style);
}

// ─── 4. Progressive Reveal on Navigation ─────────────────
// Restore hidden elements as users explore more channels.

function setupProgressiveReveal() {
    var _origGoReveal = window.go;
    if (typeof _origGoReveal !== 'function') return;

    window.go = function() {
        var result = _origGoReveal.apply(this, arguments);
        setTimeout(function() {
            var visited = [];
            try { visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]'); } catch(e) {}

            if (visited.length >= 5) {
                ['lbFloatBtn', 'mobileSearchBtn'].forEach(function(id) {
                    var el = document.getElementById(id);
                    if (el && el.getAttribute('data-mobile-hidden')) {
                        el.style.display = '';
                        el.removeAttribute('data-mobile-hidden');
                    }
                });
            }
            if (visited.length >= 10) {
                document.querySelectorAll('[data-mobile-hidden]').forEach(function(el) {
                    el.style.display = '';
                    el.removeAttribute('data-mobile-hidden');
                });
            }
        }, 1000);
        return result;
    };
}

// ─── INIT ────────────────────────────────────────────────
function init() {
    addMobileCSSFixes();
    setTimeout(function() {
        cleanupFloatingButtons();
        addSwipeFeedback();
        setupProgressiveReveal();
    }, 800);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 600); });
} else {
    setTimeout(init, 600);
}

console.log('[MOBILE] Mobile optimizations loaded');
})();
