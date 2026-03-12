// ============================================================
// Bitcoin Education Archive — UX Improvements
// [AUDIT FIX U4-U11] Title updates, search highlights, offline,
// toast queue, sidebar scroll restore, smooth transitions
// Load AFTER app.js
// ============================================================

(function() {
    'use strict';

    // ─── U7: Dynamic Page Title ──────────────────────────────
    // Update document.title when navigating to a channel
    const _originalTitle = document.title;
    
    window.updatePageTitle = function(channelTitle) {
        if (channelTitle) {
            // Strip emoji from title for cleaner tab display
            const clean = channelTitle.replace(/[\u{1F300}-\u{1FFFF}]/gu, '').trim();
            document.title = clean + ' — Bitcoin Education Archive';
        } else {
            document.title = _originalTitle;
        }
    };

    // ─── U6: Search Result Highlighting ──────────────────────
    // Wrap matched text in a highlight span
    window.highlightMatch = function(text, query) {
        if (!query || !text) return escapeHtml(text);
        const escaped = escapeHtml(text);
        const queryEscaped = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp('(' + queryEscaped + ')', 'gi');
        return escaped.replace(regex, 
            '<span style="background:rgba(249,115,22,0.25);color:var(--accent);' +
            'font-weight:700;padding:1px 2px;border-radius:3px;">$1</span>');
    };

    // ─── U4: Channel Loading Skeleton ────────────────────────
    // Show a skeleton placeholder while channel data loads
    window.showChannelSkeleton = function() {
        const msgs = document.getElementById('msgs');
        if (!msgs) return;
        
        let html = '<div style="padding:20px 0;animation:fadeSlideIn 0.3s ease-out;">';
        // Title skeleton
        html += '<div class="skeleton" style="height:28px;width:60%;margin-bottom:16px;"></div>';
        html += '<div class="skeleton" style="height:14px;width:40%;margin-bottom:24px;"></div>';
        // Message skeletons
        for (let i = 0; i < 5; i++) {
            html += '<div style="padding:16px 0;border-bottom:1px solid var(--msg-border);">';
            html += '<div class="skeleton" style="height:14px;width:' + (70 + Math.random() * 25) + '%;margin-bottom:8px;"></div>';
            html += '<div class="skeleton" style="height:14px;width:' + (50 + Math.random() * 40) + '%;margin-bottom:8px;"></div>';
            if (i % 2 === 0) {
                html += '<div class="skeleton" style="height:200px;width:100%;margin-top:12px;border-radius:12px;"></div>';
            }
            html += '</div>';
        }
        html += '</div>';
        msgs.innerHTML = html;
    };

    // ─── U5: Error State with Retry ──────────────────────────
    window.showChannelError = function(channelId, errorMsg) {
        const msgs = document.getElementById('msgs');
        if (!msgs) return;
        
        // Sanitize channelId to prevent XSS (allow only alphanumeric, hyphens, underscores)
        const safeId = (channelId || '').replace(/[^a-zA-Z0-9_-]/g, '');
        const safeMsg = typeof escapeHtml === 'function' ? escapeHtml(errorMsg || '') : (errorMsg || '').replace(/[<>&"']/g, '');
        
        msgs.innerHTML = '<div style="padding:60px 20px;text-align:center;animation:fadeSlideIn 0.3s ease-out;">' +
            '<div style="font-size:3rem;margin-bottom:16px;">😵</div>' +
            '<div style="color:var(--heading);font-size:1.2rem;font-weight:700;margin-bottom:8px;">Failed to Load Channel</div>' +
            '<div style="color:var(--text-muted);font-size:0.9rem;margin-bottom:24px;">' +
            (safeMsg || 'There was an error loading this channel. Please check your connection.') +
            '</div>' +
            '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">' +
            '<button onclick="go(\'' + safeId + '\')" style="padding:12px 24px;background:var(--accent);' +
            'color:#fff;border:none;border-radius:10px;font-size:0.95rem;font-weight:700;cursor:pointer;' +
            'font-family:inherit;">🔄 Retry</button>' +
            '<button onclick="goRandom()" style="padding:12px 24px;background:var(--card-bg);border:1px solid var(--border);' +
            'border-radius:10px;color:var(--text);font-size:0.95rem;font-weight:700;cursor:pointer;' +
            'font-family:inherit;">🎲 Try Another Channel</button>' +
            '</div>' +
            '</div>';
    };

    // ─── U10: Offline Detection Banner ───────────────────────
    let offlineBanner = null;
    
    function showOfflineBanner() {
        if (offlineBanner) return;
        offlineBanner = document.createElement('div');
        offlineBanner.id = 'offlineBanner';
        offlineBanner.style.cssText = 'position:fixed;top:32px;left:0;right:0;z-index:9998;' +
            'background:#ef4444;color:#fff;padding:8px 16px;text-align:center;' +
            'font-size:0.85rem;font-weight:600;font-family:inherit;' +
            'animation:fadeSlideIn 0.3s ease-out;';
        offlineBanner.textContent = '📡 You are offline. Some features may be unavailable.';
        document.body.appendChild(offlineBanner);
    }
    
    function hideOfflineBanner() {
        if (offlineBanner) {
            offlineBanner.remove();
            offlineBanner = null;
        }
    }
    
    window.addEventListener('offline', showOfflineBanner);
    window.addEventListener('online', function() {
        hideOfflineBanner();
        if (typeof showToast === 'function') showToast('📡 Back online!');
    });
    
    // Check on load
    if (!navigator.onLine) showOfflineBanner();

    // ─── U11: Toast Queue System ─────────────────────────────
    // Prevents toast overlap by queuing them
    const _toastQueue = [];
    let _toastActive = false;
    
    const _originalShowToast = window.showToast;
    
    window.showToast = function(message, duration) {
        duration = duration || 2500;
        
        if (_toastActive) {
            _toastQueue.push({ message: message, duration: duration });
            return;
        }
        
        _toastActive = true;
        
        // Use original showToast if it exists
        if (typeof _originalShowToast === 'function') {
            _originalShowToast(message, duration);
        } else {
            // Fallback toast implementation
            let toast = document.getElementById('btc-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'btc-toast';
                toast.style.cssText = 'position:fixed;top:44px;left:50%;transform:translateX(-50%) translateY(-20px);' +
                    'background:#f97316;color:#fff;padding:12px 20px;border-radius:10px;font-size:0.9rem;' +
                    'font-weight:700;z-index:300;opacity:0;transition:0.3s;pointer-events:none;' +
                    'box-shadow:0 8px 25px rgba(249,115,22,0.3);font-family:inherit;';
                document.body.appendChild(toast);
            }
            toast.textContent = message;
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        }
        
        setTimeout(function() {
            _toastActive = false;
            // Process next in queue
            if (_toastQueue.length > 0) {
                const next = _toastQueue.shift();
                setTimeout(function() {
                    window.showToast(next.message, next.duration);
                }, 300); // Brief gap between toasts
            }
        }, duration);
    };

    // ─── U9: Remember Sidebar Scroll Position ────────────────
    let _sidebarScrollTop = 0;
    
    // Save scroll position when sidebar closes
    const sidebar = document.getElementById('sidebar');
    const channels = document.querySelector('.channels');
    
    if (channels) {
        channels.addEventListener('scroll', function() {
            _sidebarScrollTop = this.scrollTop;
        });
    }
    
    // Restore on sidebar open
    const _originalToggleMenu = window.toggleMenu;
    if (typeof _originalToggleMenu === 'function') {
        window.toggleMenu = function() {
            _originalToggleMenu.apply(this, arguments);
            // After toggling, restore scroll if opening
            if (sidebar && sidebar.classList.contains('open') && channels) {
                channels.scrollTop = _sidebarScrollTop;
            }
        };
    }

    // ─── U8: Smooth Channel Transitions ──────────────────────
    // Add a brief fade-out before loading new content
    window.fadeOutContent = function(callback) {
        const main = document.getElementById('main');
        if (!main) { callback(); return; }
        
        main.style.transition = 'opacity 0.15s ease-out';
        main.style.opacity = '0.3';
        
        setTimeout(function() {
            callback();
            main.style.opacity = '1';
            setTimeout(function() {
                main.style.transition = '';
            }, 200);
        }, 150);
    };

    console.log('[AUDIT] UX improvements loaded');
})();
