// ============================================================
// Bitcoin Education Archive — Accessibility Patches
// [AUDIT FIX U1/U2/U3] Skip nav, ARIA labels, keyboard support
// Load AFTER DOM is ready
// ============================================================

(function() {
    'use strict';

    // ─── U1: Skip Navigation Link ────────────────────────────
    // Allows keyboard/screen reader users to skip the sidebar
    const skipNav = document.createElement('a');
    skipNav.href = '#main';
    skipNav.textContent = 'Skip to main content';
    skipNav.className = 'skip-nav';
    skipNav.style.cssText = 'position:fixed;top:-100px;left:16px;z-index:99999;' +
        'padding:12px 24px;background:var(--accent,#f97316);color:#fff;' +
        'border-radius:0 0 10px 10px;font-weight:700;font-size:0.9rem;' +
        'text-decoration:none;transition:top 0.2s;font-family:inherit;';
    
    skipNav.addEventListener('focus', function() {
        this.style.top = '0';
    });
    skipNav.addEventListener('blur', function() {
        this.style.top = '-100px';
    });
    skipNav.addEventListener('click', function(e) {
        e.preventDefault();
        const main = document.getElementById('main');
        if (main) {
            main.focus();
            main.scrollTo(0, 0);
        }
        this.style.top = '-100px';
    });
    
    document.body.insertBefore(skipNav, document.body.firstChild);

    // ─── U2: ARIA Labels for Icon-Only Buttons ───────────────
    const ariaLabels = {
        '#themeBtn': 'Toggle light and dark mode',
        '#audioBtn': 'Toggle sound effects',
        '#backToTop': 'Scroll to top',
        '#scrollToBottom': 'Scroll to bottom',
        '#desktopSearchBtn': 'Search the archive',
        '#mobileSearchBtn': 'Search the archive',
        '#lbFloatBtn': 'Open leaderboard',
        '#desktopDMBtn': 'Open direct messages',
    };

    Object.keys(ariaLabels).forEach(function(selector) {
        const el = document.querySelector(selector);
        if (el && !el.getAttribute('aria-label')) {
            el.setAttribute('aria-label', ariaLabels[selector]);
        }
    });

    // Add aria-labels to random buttons
    document.querySelectorAll('.random-btn').forEach(function(btn) {
        const title = btn.getAttribute('title');
        if (title && !btn.getAttribute('aria-label')) {
            btn.setAttribute('aria-label', title);
        }
    });

    // Add role="navigation" to sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.getAttribute('role')) {
        sidebar.setAttribute('role', 'navigation');
        sidebar.setAttribute('aria-label', 'Channel navigation');
    }

    // Add role="main" to main content
    const main = document.getElementById('main');
    if (main) {
        main.setAttribute('role', 'main');
        main.setAttribute('tabindex', '-1'); // Allow focus for skip-nav
    }

    // ─── U3: Keyboard Navigation for Channel List ────────────
    // Arrow keys navigate between channel buttons within a category
    const channelList = document.getElementById('channelList');
    if (channelList) {
        channelList.addEventListener('keydown', function(e) {
            const target = e.target;
            if (!target.classList.contains('ch-btn')) return;

            const group = target.closest('.cat-group');
            if (!group) return;

            const buttons = Array.from(group.querySelectorAll('.ch-btn'));
            const idx = buttons.indexOf(target);

            let nextBtn = null;

            switch (e.key) {
                case 'ArrowDown':
                case 'j':
                    e.preventDefault();
                    nextBtn = buttons[idx + 1] || buttons[0]; // Wrap around
                    break;
                case 'ArrowUp':
                case 'k':
                    e.preventDefault();
                    nextBtn = buttons[idx - 1] || buttons[buttons.length - 1];
                    break;
                case 'Home':
                    e.preventDefault();
                    nextBtn = buttons[0];
                    break;
                case 'End':
                    e.preventDefault();
                    nextBtn = buttons[buttons.length - 1];
                    break;
            }

            if (nextBtn) {
                nextBtn.focus();
            }
        });
    }

    // ─── Category toggle keyboard support ────────────────────
    document.querySelectorAll('.cat-toggle').forEach(function(toggle) {
        toggle.setAttribute('role', 'button');
        toggle.setAttribute('tabindex', '0');
        toggle.setAttribute('aria-expanded', toggle.getAttribute('data-expanded') || 'false');
        
        toggle.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
                // Update aria-expanded
                const expanded = this.getAttribute('data-expanded') === 'true';
                this.setAttribute('aria-expanded', String(expanded));
            }
        });
    });

    // ─── Focus visible styles ────────────────────────────────
    // Add visible focus indicators for keyboard users
    const focusStyle = document.createElement('style');
    focusStyle.textContent = [
        '.ch-btn:focus-visible, .random-btn:focus-visible, .theme-toggle:focus-visible,',
        '.share-btn:focus-visible, .quest-opt:focus-visible, button:focus-visible {',
        '  outline: 2px solid var(--accent, #f97316);',
        '  outline-offset: 2px;',
        '  box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.2);',
        '}',
        '.skip-nav:focus { top: 0 !important; }',
        '[role="button"]:focus-visible {',
        '  outline: 2px solid var(--accent, #f97316);',
        '  outline-offset: 2px;',
        '}',
    ].join('\n');
    document.head.appendChild(focusStyle);

    // ─── Announce route changes to screen readers ────────────
    let liveRegion = document.getElementById('sr-live');
    if (!liveRegion) {
        liveRegion = document.createElement('div');
        liveRegion.id = 'sr-live';
        liveRegion.setAttribute('role', 'status');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.style.cssText = 'position:absolute;width:1px;height:1px;' +
            'overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;';
        document.body.appendChild(liveRegion);
    }

    /**
     * Announce a message to screen readers.
     * @param {string} message - The message to announce
     */
    window.announceToSR = function(message) {
        if (liveRegion) {
            liveRegion.textContent = '';
            setTimeout(function() {
                liveRegion.textContent = message;
            }, 100);
        }
    };

    console.log('[AUDIT] Accessibility patches loaded');
})();
