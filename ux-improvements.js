(function() {
    'use strict';
    const _originalTitle = document.title;
    window.updatePageTitle = function(channelTitle) {
        if (channelTitle) {
            const clean = channelTitle.replace(/[\u{1F300}-\u{1FFFF}]/gu, '').trim();
            document.title = clean + ' — Bitcoin Education Archive';
        } else {
            document.title = _originalTitle;
        }
    };
    window.highlightMatch = function(text, query) {
        if (!query || !text) return escapeHtml(text);
        const escaped = escapeHtml(text);
        const queryEscaped = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp('(' + queryEscaped + ')', 'gi');
        return escaped.replace(regex, 
            '<span style="background:rgba(249,115,22,0.25);color:var(--accent);' +
            'font-weight:700;padding:1px 2px;border-radius:3px;">$1</span>');
    };
    window.showChannelSkeleton = function() {
        const msgs = document.getElementById('msgs');
        if (!msgs) return;
        let html = '<div style="padding:20px 0;animation:fadeSlideIn 0.3s ease-out;">';
        html += '<div class="skeleton" style="height:28px;width:60%;margin-bottom:16px;"></div>';
        html += '<div class="skeleton" style="height:14px;width:40%;margin-bottom:24px;"></div>';
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
    window.showChannelError = function(channelId, errorMsg) {
        const msgs = document.getElementById('msgs');
        if (!msgs) return;
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
    if (!navigator.onLine) showOfflineBanner();
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
        if (typeof _originalShowToast === 'function') {
            _originalShowToast(message, duration);
        } else {
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
            if (_toastQueue.length > 0) {
                const next = _toastQueue.shift();
                setTimeout(function() {
                    window.showToast(next.message, next.duration);
                }, 300); 
            }
        }, duration);
    };
    let _sidebarScrollTop = 0;
    const sidebar = document.getElementById('sidebar');
    const channels = document.querySelector('.channels');
    if (channels) {
        channels.addEventListener('scroll', function() {
            _sidebarScrollTop = this.scrollTop;
        });
    }
    const _originalToggleMenu = window.toggleMenu;
    if (typeof _originalToggleMenu === 'function') {
        window.toggleMenu = function() {
            _originalToggleMenu.apply(this, arguments);
            if (sidebar && sidebar.classList.contains('open') && channels) {
                channels.scrollTop = _sidebarScrollTop;
            }
        };
    }
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
    (function() {
        function _installSearchClear() {
            var overlay = document.getElementById('searchOverlay');
            if (!overlay) { setTimeout(_installSearchClear, 500); return; }
            var inp = document.getElementById('searchOverlayInput');
            if (!inp) return;
            if (document.getElementById('searchClearBtn')) return;
            var wrapper = inp.parentNode;
            var origStyle = getComputedStyle(inp);
            if (wrapper.style.position !== 'relative' && getComputedStyle(wrapper).position !== 'relative') {
                wrapper.style.position = 'relative';
            }
            var btn = document.createElement('button');
            btn.id = 'searchClearBtn';
            btn.innerHTML = '✕';
            btn.setAttribute('aria-label', 'Clear search');
            btn.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);' +
                'background:none;border:none;color:var(--text-muted);font-size:1.1rem;cursor:pointer;' +
                'padding:4px 6px;display:none;z-index:5;line-height:1;touch-action:manipulation;' +
                '-webkit-tap-highlight-color:transparent;';
            inp.parentNode.style.position = 'relative';
            inp.parentNode.style.display = 'block';
            inp.parentNode.appendChild(btn);
            inp.style.paddingRight = '36px';
            function syncBtn() {
                btn.style.display = inp.value.length > 0 ? 'flex' : 'none';
            }
            inp.addEventListener('input', syncBtn);
            inp.addEventListener('focus', syncBtn);
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                inp.value = '';
                if (typeof doSearch === 'function') doSearch('');
                inp.focus();
                syncBtn();
            });
            setInterval(syncBtn, 500);
        }
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(_installSearchClear, 300);
        });
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(_installSearchClear, 300);
        }
    })();
    (function() {
        var _origShowToastNow = null;
        function _patchToastTapDismiss() {
            if (typeof window._showToastNow === 'function' && !window._showToastTapPatched) {
                window._showToastTapPatched = true;
                var _orig = window._showToastNow;
                window._showToastNow = function(msg, duration) {
                    _orig(msg, duration);
                    requestAnimationFrame(function() {
                        var toasts = document.querySelectorAll('.rank-toast');
                        var t = toasts[toasts.length - 1];
                        if (t && !t._tapPatched) {
                            t._tapPatched = true;
                            t.style.cursor = 'pointer';
                            t.addEventListener('click', function() {
                                t.classList.remove('show');
                                setTimeout(function() { if (t.parentNode) t.remove(); }, 400);
                            });
                        }
                    });
                };
                return true;
            }
            return false;
        }
        var _tapPatchInterval = setInterval(function() {
            if (_patchToastTapDismiss()) clearInterval(_tapPatchInterval);
        }, 200);
        setTimeout(function() { clearInterval(_tapPatchInterval); }, 10000);
    })();
    (function() {
        var _style = document.createElement('style');
        _style.textContent = '.msg-img[data-broken]{display:inline-block;width:100%;min-height:60px;max-height:140px;background:var(--card-bg,#1e293b);border:1px dashed var(--border,#333);border-radius:8px;opacity:0.4;}';
        document.head.appendChild(_style);
        function _handleBrokenImage(img) {
            if (img._brokenHandled) return;
            img._brokenHandled = true;
            img.dataset.broken = '1';
            img.alt = '';
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP
        }
        document.addEventListener('error', function(e) {
            var el = e.target;
            if (el && el.tagName === 'IMG' && el.classList.contains('msg-img')) {
                _handleBrokenImage(el);
            }
        }, true);
        document.addEventListener('DOMContentLoaded', function() {
            document.querySelectorAll('img.msg-img').forEach(function(img) {
                if (!img.complete || img.naturalWidth === 0) {
                    img.addEventListener('error', function() { _handleBrokenImage(img); });
                }
            });
        });
    })();
    (function() {
        function _patchMobileBarTargets() {
            var bar = document.querySelector('.mobile-bar');
            if (!bar) return;
            bar.querySelectorAll('button').forEach(function(btn) {
                var r = btn.getBoundingClientRect();
                if (r.width && r.width <= 42) {
                    btn.style.minWidth = '44px';
                    btn.style.minHeight = '44px';
                }
            });
        }
        if (document.readyState === 'complete') { _patchMobileBarTargets(); }
        else { window.addEventListener('load', _patchMobileBarTargets); }
    })();
    (function() {
        var stored = localStorage.getItem('theme');
        if (!stored && window.matchMedia) {
            if (window.matchMedia('(prefers-color-scheme: light)').matches) {
                document.body.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
                var btn = document.getElementById('mobileThemeBtn') || document.getElementById('themeBtn');
                if (btn) btn.textContent = '☀️';
            }
        }
    })();
    console.log('[AUDIT] UX improvements loaded');
})();