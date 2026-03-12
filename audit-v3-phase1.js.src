// © 2024-2026 603BTC LLC. All rights reserved.
// ============================================================
// Bitcoin Education Archive — Audit v3 Phase 1
// Cherry-picked fixes from March 2026 audit.
// NO dependency on navigation event bus — uses direct patching.
//
// Includes:
//   1.5  Overlay mutual exclusivity + Escape handler
//   2.4  Username input validation
//   2.6  External link rel=noopener (dynamic)
//   3.4  SPA history / back button handling
//   3.6  Touch target enforcement (48px min)
//   3.7  Scroll position memory per channel
//   3.9  Theme transition polish
//   3.11 Modal focus trapping
//   3.13 Image shimmer placeholders
//   3.14 Orientation change handler
//
// Load AFTER all other scripts (last defer script).
// ============================================================

(function() {
'use strict';

var isMobile = window.innerWidth <= 900 || ('ontouchstart' in window);


// ─── [1.5] Overlay Mutual Exclusivity + Escape ──────────
// Global Escape key dismisses topmost overlay.
// Search and Nacho close each other.
(function fixOverlays() {
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;

        var overlays = [
            { id: 'searchOverlay', check: 'display', close: function(el) { el.style.display = 'none'; } },
            { id: 'nachoModeScreen', check: 'display', close: function(el) {
                if (typeof exitNachoMode === 'function') exitNachoMode();
                else el.style.display = 'none';
            }},
            { id: 'questModal', check: 'class', close: function(el) { el.classList.remove('open'); el.style.display = 'none'; } },
            { id: 'leaderboard', check: 'class', close: function(el) { el.classList.remove('open'); } },
            { id: 'tipOverlay', check: 'display', close: function(el) { el.remove(); } },
        ];

        for (var i = 0; i < overlays.length; i++) {
            var el = document.getElementById(overlays[i].id);
            if (!el) continue;
            var visible = overlays[i].check === 'class'
                ? el.classList.contains('open')
                : (el.style.display === 'flex' || el.style.display === 'block');
            if (visible) {
                overlays[i].close(el);
                e.preventDefault();
                return;
            }
        }

        // Also close any fixed-position tip/lightning overlays
        var fixedOverlays = document.querySelectorAll('div[style*="position:fixed"][style*="z-index:10001"], div[style*="position: fixed"][style*="z-index: 10001"]');
        if (fixedOverlays.length > 0) {
            fixedOverlays[fixedOverlays.length - 1].remove();
            e.preventDefault();
        }
    });
})();


// ─── [2.4] Username Input Validation ─────────────────────
(function validateUsername() {
    var USERNAME_REGEX = /^[a-zA-Z0-9_\-.\u00C0-\u024F]{3,20}$/;
    var RESERVED = ['admin', 'moderator', 'system', 'bitcoin', 'satoshi', 'nacho', '603btc', 'null', 'undefined'];

    window.validateUsername = function(name) {
        if (!name) return { valid: false, error: 'Username is required' };
        var t = name.trim();
        if (t.length < 3) return { valid: false, error: 'Must be at least 3 characters' };
        if (t.length > 20) return { valid: false, error: 'Must be 20 characters or fewer' };
        if (!USERNAME_REGEX.test(t)) return { valid: false, error: 'Letters, numbers, underscores, hyphens, periods only' };
        if (RESERVED.indexOf(t.toLowerCase()) !== -1) return { valid: false, error: 'This username is reserved' };
        if (t.replace(/[\s\u200B-\u200D\uFEFF]/g, '').length < 3) return { valid: false, error: 'Must contain at least 3 visible characters' };
        return { valid: true, name: t };
    };

    function patchSubmit() {
        var orig = window.submitUsername;
        if (typeof orig !== 'function' || orig._v3) return;

        window.submitUsername = function() {
            var input = document.getElementById('usernameInput');
            if (!input) return orig.apply(this, arguments);

            var result = window.validateUsername(input.value);
            if (!result.valid) {
                input.style.borderColor = '#ef4444';
                var err = input.parentElement.querySelector('.username-error');
                if (!err) {
                    err = document.createElement('div');
                    err.className = 'username-error';
                    err.style.cssText = 'color:#ef4444;font-size:0.8rem;margin:-8px 0 12px;text-align:center;';
                    input.parentElement.insertBefore(err, input.nextSibling);
                }
                err.textContent = result.error;
                return;
            }
            input.style.borderColor = '';
            var errEl = input.parentElement.querySelector('.username-error');
            if (errEl) errEl.remove();
            input.value = result.name;
            return orig.apply(this, arguments);
        };
        window.submitUsername._v3 = true;
    }

    // Real-time validation feedback on the input
    function addLiveValidation() {
        var input = document.getElementById('usernameInput');
        if (!input || input._v3Live) return;
        input._v3Live = true;
        input.addEventListener('input', function() {
            var val = this.value;
            if (!val.length) { this.style.borderColor = ''; return; }
            var r = window.validateUsername(val);
            this.style.borderColor = r.valid ? '#22c55e' : (val.length < 3 ? '' : '#ef4444');
        });
    }

    setTimeout(patchSubmit, 2000);
    setTimeout(patchSubmit, 5000);
    setTimeout(addLiveValidation, 3000);
})();


// ─── [2.6] External Link Hardening (Dynamic) ────────────
// MutationObserver adds rel=noopener to dynamically created links.
(function hardenLinks() {
    function fix(link) {
        var rel = link.getAttribute('rel') || '';
        if (!rel.includes('noopener')) {
            link.setAttribute('rel', (rel + ' noopener noreferrer').trim());
        }
    }

    // Fix existing links
    setTimeout(function() {
        document.querySelectorAll('a[target="_blank"]').forEach(fix);
    }, 1500);

    // Watch for new links
    if (typeof MutationObserver !== 'undefined') {
        new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                m.addedNodes.forEach(function(node) {
                    if (node.nodeType !== 1) return;
                    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') fix(node);
                    if (node.querySelectorAll) {
                        node.querySelectorAll('a[target="_blank"]').forEach(fix);
                    }
                });
            });
        }).observe(document.body, { childList: true, subtree: true });
    }
})();


// ─── [3.4] SPA History / Back Button ─────────────────────
// Push history state on channel navigation. Back button returns
// to previous channel instead of exiting the app.
(function spaHistory() {
    var initialPop = true;

    // Wrap go() to push state
    function patchGo() {
        var origGo = window.go;
        if (typeof origGo !== 'function' || origGo._v3History) return;

        window.go = function(id, btn) {
            var result = origGo.call(this, id, btn);
            try {
                var url = '#' + id;
                if (location.hash !== url) {
                    history.pushState({ channel: id }, '', url);
                }
            } catch(e) {}
            return result;
        };
        window.go._v3History = true;
    }

    // Handle back button
    window.addEventListener('popstate', function(e) {
        if (initialPop) { initialPop = false; return; }
        if (e.state && e.state.channel) {
            // Navigate without pushing another history entry
            var origGo = window.go;
            if (typeof origGo === 'function') {
                // Temporarily unwrap to avoid double-push
                var realGo = origGo;
                while (realGo._v3History && realGo !== realGo) {
                    // Can't unwrap, just skip the push
                    break;
                }
                // Set flag to skip push on this call
                window._v3SkipPush = true;
                origGo(e.state.channel);
                window._v3SkipPush = false;
            }
        } else if (!location.hash || location.hash === '#') {
            if (typeof goHome === 'function') goHome();
        }
    });

    // Re-patch go() to respect the skip flag
    function patchGoWithSkip() {
        var origGo = window.go;
        if (typeof origGo !== 'function' || origGo._v3HistorySkip) return;

        window.go = function(id, btn) {
            var result = origGo.call(this, id, btn);
            try {
                if (!window._v3SkipPush) {
                    var url = '#' + id;
                    if (location.hash !== url) {
                        history.pushState({ channel: id }, '', url);
                    }
                }
            } catch(e) {}
            return result;
        };
        window.go._v3HistorySkip = true;
    }

    setTimeout(patchGoWithSkip, 3000);
    setTimeout(patchGoWithSkip, 6000);
})();


// ─── [3.6] Touch Target Enforcement ─────────────────────
(function touchTargets() {
    var style = document.createElement('style');
    style.id = 'v3-touch-targets';
    style.textContent = [
        '@media (max-width: 900px) {',
        '  .msg button[onclick*="toggleBookmark"] {',
        '    min-height: 44px !important;',
        '    min-width: 44px !important;',
        '    padding: 10px !important;',
        '    font-size: 1rem !important;',
        '  }',
        '  .share-btn, .cat-toggle {',
        '    min-height: 44px;',
        '    padding: 10px 12px !important;',
        '  }',
        '  .mobile-close, .lb-close {',
        '    min-width: 44px !important;',
        '    min-height: 44px !important;',
        '  }',
        '  .bnav-btn {',
        '    min-height: 48px !important;',
        '    min-width: 48px;',
        '    touch-action: manipulation;',
        '    -webkit-tap-highlight-color: transparent;',
        '  }',
        '  #bottomNav {',
        '    padding-bottom: max(env(safe-area-inset-bottom, 8px), 8px) !important;',
        '  }',
        '}',
    ].join('\n');
    document.head.appendChild(style);
})();


// ─── [3.7] Scroll Position Memory ───────────────────────
// Remember scroll position when leaving a channel, restore on return.
(function scrollMemory() {
    var positions = {};
    var lastChannel = null;

    // Save position before navigating
    function saveScroll() {
        var main = document.getElementById('main');
        if (main && lastChannel) {
            positions[lastChannel] = main.scrollTop;
        }
    }

    // Wrap go() to track channel changes
    function patchGo() {
        var origGo = window.go;
        if (typeof origGo !== 'function' || origGo._v3Scroll) return;

        window.go = function(id, btn) {
            saveScroll();
            var result = origGo.call(this, id, btn);
            lastChannel = id;

            // Restore position if we've been here before
            var saved = positions[id];
            if (saved && saved > 0) {
                setTimeout(function() {
                    var main = document.getElementById('main');
                    if (main) main.scrollTo({ top: saved, behavior: 'smooth' });
                }, 300);
            }
            return result;
        };
        window.go._v3Scroll = true;
    }

    setTimeout(patchGo, 3000);
    setTimeout(patchGo, 6000);

    // Track initial channel
    setTimeout(function() {
        lastChannel = window.currentChannelId || null;
    }, 2000);
})();


// ─── [3.9] Theme Transition Polish ──────────────────────
(function themePolish() {
    var style = document.createElement('style');
    style.id = 'v3-theme-transition';
    style.textContent = [
        '.theme-transitioning, .theme-transitioning * {',
        '  transition: background-color 0.3s ease, color 0.3s ease,',
        '    border-color 0.3s ease, box-shadow 0.3s ease !important;',
        '}',
        '[data-theme="light"] .username-box {',
        '  background: rgba(255,255,255,0.95) !important;',
        '  border-color: var(--border) !important;',
        '}',
        '[data-theme="light"] .username-box h2 { color: var(--heading) !important; }',
        '[data-theme="light"] .username-box input {',
        '  background: var(--input-bg) !important;',
        '  color: var(--text) !important;',
        '}',
        '[data-theme="light"] .username-box p { color: var(--text-muted) !important; }',
        '[data-theme="light"] #searchOverlay {',
        '  background: rgba(255,255,255,0.95) !important;',
        '}',
    ].join('\n');
    document.head.appendChild(style);

    // Patch toggleTheme for smooth transitions
    function patchToggle() {
        var orig = window.toggleTheme;
        if (typeof orig !== 'function' || orig._v3) return;
        window.toggleTheme = function() {
            document.body.classList.add('theme-transitioning');
            orig.apply(this, arguments);
            setTimeout(function() {
                document.body.classList.remove('theme-transitioning');
            }, 400);
        };
        window.toggleTheme._v3 = true;
    }

    setTimeout(patchToggle, 2000);
    setTimeout(patchToggle, 5000);
})();


// ─── [3.11] Modal Focus Trapping ────────────────────────
(function focusTrap() {
    var FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';
    var trapStack = [];

    window.trapFocus = function(container) {
        if (!container) return;
        var focusable = container.querySelectorAll(FOCUSABLE);
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];

        function handleTab(e) {
            if (e.key !== 'Tab') return;
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        }

        container.addEventListener('keydown', handleTab);
        trapStack.push({ container: container, handler: handleTab });
        setTimeout(function() { first.focus(); }, 100);
    };

    window.releaseFocus = function(container) {
        for (var i = trapStack.length - 1; i >= 0; i--) {
            if (trapStack[i].container === container) {
                container.removeEventListener('keydown', trapStack[i].handler);
                trapStack.splice(i, 1);
                break;
            }
        }
    };

    // Auto-trap on known modals
    if (typeof MutationObserver !== 'undefined') {
        ['usernameModal', 'questModal'].forEach(function(id) {
            var modal = document.getElementById(id);
            if (!modal) return;
            new MutationObserver(function() {
                var open = modal.style.display === 'block' || modal.style.display === 'flex' || modal.classList.contains('open');
                if (open) trapFocus(modal);
                else releaseFocus(modal);
            }).observe(modal, { attributes: true, attributeFilter: ['style', 'class'] });
        });
    }
})();


// ─── [3.13] Image Shimmer Placeholders ──────────────────
(function imageShimmer() {
    var style = document.createElement('style');
    style.id = 'v3-img-shimmer';
    style.textContent = [
        '.msg-img {',
        '  aspect-ratio: auto;',
        '  min-height: 80px;',
        '  background: linear-gradient(135deg, var(--card-bg) 0%, var(--border) 50%, var(--card-bg) 100%);',
        '  background-size: 200% 200%;',
        '  animation: v3Shimmer 2s ease-in-out infinite;',
        '  border-radius: 10px;',
        '  contain: layout;',
        '}',
        '.msg-img[data-loaded="true"] {',
        '  background: none !important;',
        '  animation: v3FadeIn 0.3s ease-out;',
        '}',
        '@keyframes v3Shimmer {',
        '  0% { background-position: 200% 0; }',
        '  100% { background-position: -200% 0; }',
        '}',
        '@keyframes v3FadeIn {',
        '  from { opacity: 0.7; }',
        '  to { opacity: 1; }',
        '}',
        '.yt-embed {',
        '  aspect-ratio: 16/9;',
        '  width: 100%;',
        '  max-width: 560px;',
        '  height: auto;',
        '  background: #000;',
        '  border-radius: 12px;',
        '  overflow: hidden;',
        '  contain: layout;',
        '}',
    ].join('\n');
    document.head.appendChild(style);

    // Mark images as loaded to stop shimmer
    document.addEventListener('load', function(e) {
        if (e.target && e.target.tagName === 'IMG' && e.target.classList.contains('msg-img')) {
            e.target.setAttribute('data-loaded', 'true');
        }
    }, true);
})();


// ─── [3.14] Orientation Change Handler ──────────────────
(function orientationHandler() {
    var timer = null;
    var lastWidth = window.innerWidth;

    function handleChange() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function() {
            // Close sidebar on portrait mobile
            var sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('open') && window.innerWidth <= 900) {
                sidebar.classList.remove('open');
            }
        }, 300);
    }

    window.addEventListener('orientationchange', handleChange);
    window.addEventListener('resize', function() {
        if (Math.abs(window.innerWidth - lastWidth) > 100) {
            lastWidth = window.innerWidth;
            handleChange();
        }
    });
})();


console.log('[AUDIT-V3] Phase 1 patches loaded');
})();
