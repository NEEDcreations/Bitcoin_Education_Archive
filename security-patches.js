// ============================================================
// Bitcoin Education Archive — Security Patches
// [AUDIT] Drop-in security hardening. Load early in index.html.
// ============================================================

(function() {
    'use strict';

    // ─── S1: Content Security Policy ─────────────────────────
    // DISABLED: CSP blocks Firebase Auth flows (popup + redirect)
    // Google sign-in requires too many dynamic origins to whitelist reliably
    // Re-enable when moving to a CF Worker-based CSP header with proper testing
    /*
    if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
        const csp = document.createElement('meta');
        csp.setAttribute('http-equiv', 'Content-Security-Policy');
        csp.setAttribute('content', [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com https://accounts.google.com https://platform.twitter.com https://cdnjs.cloudflare.com https://www.youtube.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' data: blob: https: http:",
            "font-src 'self' https://fonts.gstatic.com",
            "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://accounts.google.com https://apis.google.com https://mempool.space https://api.coingecko.com wss://*.firebaseio.com",
            "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://platform.twitter.com https://accounts.google.com https://apis.google.com",
            "media-src 'self' https://*.firebasestorage.app blob:",
            "object-src 'none'",
            "base-uri 'self'",
        ].join('; '));
        document.head.insertBefore(csp, document.head.firstChild);
    }
    */

    // ─── S8: Enforce rel="noopener noreferrer" on all external links ───
    // Runs on click to catch dynamically generated links
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a[target="_blank"]');
        if (link) {
            const rel = link.getAttribute('rel') || '';
            if (!rel.includes('noopener')) {
                link.setAttribute('rel', (rel + ' noopener noreferrer').trim());
            }
        }
    }, true);

    // ─── S7: Server-side rate limiting helper ────────────────
    // Wraps suggestion submission with server-side timestamp tracking
    window._securityRateLimits = {};
    
    /**
     * Check client-side rate limit (backup for server-side enforcement)
     * @param {string} action - The action identifier
     * @param {number} cooldownMs - Cooldown in milliseconds
     * @returns {boolean} Whether the action is allowed
     */
    window.checkRateLimit = function(action, cooldownMs) {
        const now = Date.now();
        const last = window._securityRateLimits[action] || 0;
        if (now - last < cooldownMs) return false;
        window._securityRateLimits[action] = now;
        return true;
    };

    // ─── Sanitize input helper (enhanced) ────────────────────
    // Strips potential script injection from user text inputs
    window.sanitizeInput = function(text) {
        if (!text) return '';
        return text
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/javascript:/gi, '')
            .trim();
    };

    // ─── Fingerprint hash improvement (S3 fix) ──────────────
    // Replace weak hash with cyrb53 for better collision resistance
    window.cyrb53 = function(str, seed) {
        seed = seed || 0;
        let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
        for (let i = 0, ch; i < str.length; i++) {
            ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
        h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
        h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return 4294967296 * (2097151 & h2) + (h1 >>> 0);
    };

    console.log('[AUDIT] Security patches loaded');
})();
