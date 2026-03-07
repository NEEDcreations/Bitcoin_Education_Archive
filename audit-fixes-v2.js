// ============================================================
// Bitcoin Education Archive — Audit Fixes v2
// B3: AudioContext singleton
// B4: Navigation race condition guard
// B5: Safe localStorage wrapper
// F4: Search debounce
// F8: System theme auto-detection
// F11: Reduced motion support
// Load AFTER bundle.js
// ============================================================

(function() {
'use strict';

// ─── [B3] AudioContext Singleton ──────────────────────────
var _sharedAudioCtx = null;

window.getSharedAudioContext = function() {
    if (_sharedAudioCtx && _sharedAudioCtx.state !== 'closed') {
        if (_sharedAudioCtx.state === 'suspended') {
            _sharedAudioCtx.resume().catch(function(){});
        }
        return _sharedAudioCtx;
    }
    try {
        _sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) { return null; }
    return _sharedAudioCtx;
};

// Patch playChannelSound to use shared context
var _origPlayChannelSound = window.playChannelSound;
if (typeof _origPlayChannelSound === 'function') {
    window.playChannelSound = function() {
        if (typeof window.canPlaySound === 'function' && !window.canPlaySound()) return;
        try {
            var ctx = window.getSharedAudioContext();
            if (!ctx) return;
            var vol = typeof window.audioVolume !== 'undefined' ? window.audioVolume : 0.5;
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.08 * vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);

            var osc2 = ctx.createOscillator();
            var gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 1318.5;
            osc2.type = 'sine';
            gain2.gain.setValueAtTime(0.05 * vol, ctx.currentTime + 0.05);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc2.start(ctx.currentTime + 0.05);
            osc2.stop(ctx.currentTime + 0.25);
        } catch(e) {}
    };
}

// ─── [B4] Navigation Race Condition Guard ────────────────
window._navGeneration = 0;

window.startNavigation = function() {
    window._navGeneration++;
    return window._navGeneration;
};

window.isNavigationCurrent = function(gen) {
    return gen === window._navGeneration;
};

// ─── [B5] Safe localStorage Wrapper ──────────────────────
window.safeSetItem = function(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch(e) {
        console.warn('[Storage] QuotaExceeded for key:', key);
        try {
            // Try to free space by trimming chat history
            var chat = JSON.parse(localStorage.getItem('btc_nacho_chat') || '[]');
            if (chat.length > 100) {
                chat = chat.slice(-100);
                localStorage.setItem('btc_nacho_chat', JSON.stringify(chat));
            }
            localStorage.setItem(key, value);
            return true;
        } catch(e2) {
            console.error('[Storage] Failed even after cleanup:', key);
            return false;
        }
    }
};

// ─── [F4] Search Debounce ────────────────────────────────
var _searchTimer = null;
window.debouncedSearch = function(query, delay) {
    delay = delay || 300;
    if (_searchTimer) clearTimeout(_searchTimer);
    _searchTimer = setTimeout(function() {
        if (typeof doSearch === 'function') doSearch(query);
    }, delay);
};

// Patch search inputs to use debounce
function patchSearchInputs() {
    var inputs = [
        document.getElementById('searchInput'),
        document.getElementById('searchOverlayInput')
    ];
    inputs.forEach(function(el) {
        if (!el) return;
        var origHandler = el.getAttribute('oninput');
        if (origHandler && origHandler.includes('doSearch')) {
            el.removeAttribute('oninput');
            el.addEventListener('input', function() {
                window.debouncedSearch(this.value, 250);
            });
        }
    });
}

setTimeout(patchSearchInputs, 1000);

// ─── [F8] System Theme Auto-Detection ───────────────────
(function() {
    var savedTheme = localStorage.getItem('theme');
    if (!savedTheme && window.matchMedia) {
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        // Site defaults to dark, so only change if user prefers light
        if (!prefersDark) {
            document.body.setAttribute('data-theme', 'light');
            var icon = document.getElementById('themeBtn');
            if (icon) icon.textContent = '☀️';
        }
    }
})();

// ─── [F11] Reduced Motion Support ────────────────────────
(function() {
    var style = document.createElement('style');
    style.textContent =
        '@media (prefers-reduced-motion: reduce) {' +
        '  *, *::before, *::after {' +
        '    animation-duration: 0.01ms !important;' +
        '    animation-iteration-count: 1 !important;' +
        '    transition-duration: 0.01ms !important;' +
        '    scroll-behavior: auto !important;' +
        '  }' +
        '  .skeleton { animation: none !important; }' +
        '}';
    document.head.appendChild(style);
})();

console.log('[AUDIT-V2] Performance + safety fixes loaded');
})();
