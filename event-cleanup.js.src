// ============================================================
// Bitcoin Education Archive — Event Listener Cleanup System
// [AUDIT FIX B1/B2] Prevents memory leaks from orphaned listeners
// Load AFTER utils.js, BEFORE app.js
// ============================================================

(function() {
    'use strict';

    // Track all listeners added per "view" (channel, home, forum, etc.)
    const _viewListeners = [];
    const _viewIntervals = [];
    const _viewTimeouts = [];

    /**
     * Add an event listener that will be automatically cleaned up on navigation.
     * Use this instead of element.addEventListener() for view-specific listeners.
     * 
     * @param {EventTarget} target - The element or window
     * @param {string} event - Event name (e.g., 'scroll', 'resize')
     * @param {Function} handler - Event handler function
     * @param {Object} [options] - addEventListener options
     */
    window.addViewListener = function(target, event, handler, options) {
        if (!target || !event || !handler) return;
        target.addEventListener(event, handler, options);
        _viewListeners.push({ target, event, handler, options });
    };

    /**
     * Set an interval that will be automatically cleared on navigation.
     * Use this instead of setInterval() for view-specific timers.
     * 
     * @param {Function} fn - Interval callback
     * @param {number} ms - Interval in milliseconds
     * @returns {number} Interval ID
     */
    window.addViewInterval = function(fn, ms) {
        const id = setInterval(fn, ms);
        _viewIntervals.push(id);
        return id;
    };

    /**
     * Set a timeout that will be automatically cleared on navigation.
     * Use this instead of setTimeout() for view-specific timers.
     * 
     * @param {Function} fn - Timeout callback
     * @param {number} ms - Delay in milliseconds
     * @returns {number} Timeout ID
     */
    window.addViewTimeout = function(fn, ms) {
        const id = setTimeout(fn, ms);
        _viewTimeouts.push(id);
        return id;
    };

    /**
     * Clean up all view-specific listeners, intervals, and timeouts.
     * Call this at the START of every navigation function (go(), goHome(), etc.)
     */
    window.cleanupView = function() {
        // Remove all tracked event listeners
        let removed = 0;
        while (_viewListeners.length > 0) {
            const entry = _viewListeners.pop();
            try {
                entry.target.removeEventListener(entry.event, entry.handler, entry.options);
                removed++;
            } catch(e) { /* target may have been removed from DOM */ }
        }

        // Clear all tracked intervals
        while (_viewIntervals.length > 0) {
            clearInterval(_viewIntervals.pop());
        }

        // Clear all tracked timeouts
        while (_viewTimeouts.length > 0) {
            clearTimeout(_viewTimeouts.pop());
        }

        // Clear Nacho mode typing dots timer if active
        if (window._nmDotsTimer) {
            clearInterval(window._nmDotsTimer);
            window._nmDotsTimer = null;
        }

        // Clear any active read timer
        if (window.readTimer) {
            clearInterval(window.readTimer);
            window.readTimer = null;
        }

        if (removed > 0) {
            // Only log in debug mode
            if (window.BTC_DEBUG) {
                console.log('[AUDIT] Cleaned up ' + removed + ' listeners, ' + 
                    _viewIntervals.length + ' intervals');
            }
        }
    };

    // ─── Patch existing navigation functions ─────────────────
    // Wrap go() and goHome() to call cleanupView() first
    const _originalGo = window.go;
    const _originalGoHome = window.goHome;

    // These will be applied after app.js loads via a MutationObserver or timeout
    let _patchedGo = null;
    let _patchedGoHome = null;

    function patchNavigation() {
        if (typeof window.go === 'function' && window.go !== _patchedGo) {
            const originalGo = window.go;
            _patchedGo = function() {
                window.cleanupView();
                return originalGo.apply(this, arguments);
            };
            window.go = _patchedGo;
        }

        if (typeof window.goHome === 'function' && window.goHome !== _patchedGoHome) {
            const originalGoHome = window.goHome;
            _patchedGoHome = function() {
                window.cleanupView();
                return originalGoHome.apply(this, arguments);
            };
            window.goHome = _patchedGoHome;
        }
    }

    // Attempt to patch after a short delay (after app.js loads)
    setTimeout(patchNavigation, 100);
    // Also try after DOMContentLoaded
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(patchNavigation, 500);
    });

    console.log('[AUDIT] Event cleanup system loaded');
})();
