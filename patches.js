!function(){"use strict";document.addEventListener("click",function(t){const e=t.target.closest('a[target="_blank"]');if(e){const t=e.getAttribute("rel")||"";t.includes("noopener")||e.setAttribute("rel",(t+" noopener noreferrer").trim())}},!0),window._securityRateLimits={},window.checkRateLimit=function(t,e){const i=Date.now();return!(i-(window._securityRateLimits[t]||0)<e)&&(window._securityRateLimits[t]=i,!0)},window.sanitizeInput=function(t){if(!t)return"";var e=document.createElement("div");e.textContent=t;var i=e.textContent;return(i=i.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,"")).trim()},window.isValidProfilePicUrl=function(t){return!!t&&("string"==typeof t&&(!!/^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(t)||(!!/^https:\/\/firebasestorage\.googleapis\.com\//.test(t)||!!/^https:\/\/.*\.firebasestorage\.app\//.test(t))))},window.cyrb53=function(t,e){let i=3735928559^(e=e||0),n=1103547991^e;for(let e,r=0;r<t.length;r++)e=t.charCodeAt(r),i=Math.imul(i^e,2654435761),n=Math.imul(n^e,1597334677);return i=Math.imul(i^i>>>16,2246822507),i^=Math.imul(n^n>>>13,3266489909),n=Math.imul(n^n>>>16,2246822507),n^=Math.imul(i^i>>>13,3266489909),4294967296*(2097151&n)+(i>>>0)},console.log("[AUDIT] Security patches loaded")}();!function(){"use strict";const n=[],e=[],o=[];window.addViewListener=function(e,o,t,i){e&&o&&t&&(e.addEventListener(o,t,i),n.push({target:e,event:o,handler:t,options:i}))},window.addViewInterval=function(n,o){const t=setInterval(n,o);return e.push(t),t},window.addViewTimeout=function(n,e){const t=setTimeout(n,e);return o.push(t),t},window.cleanupView=function(){let t=0;for(;n.length>0;){const e=n.pop();try{e.target.removeEventListener(e.event,e.handler,e.options),t++}catch(n){}}for(;e.length>0;)clearInterval(e.pop());for(;o.length>0;)clearTimeout(o.pop());window._nmDotsTimer&&(clearInterval(window._nmDotsTimer),window._nmDotsTimer=null),window.readTimer&&(clearInterval(window.readTimer),window.readTimer=null),t>0&&window.BTC_DEBUG&&console.log("[AUDIT] Cleaned up "+t+" listeners, "+e.length+" intervals")};window.go,window.goHome;let t=null,i=null;function w(){if("function"==typeof window.go&&window.go!==t){const n=window.go;t=function(){return window.cleanupView(),n.apply(this,arguments)},window.go=t}if("function"==typeof window.goHome&&window.goHome!==i){const n=window.goHome;i=function(){return window.cleanupView(),n.apply(this,arguments)},window.goHome=i}}setTimeout(w,100),document.addEventListener("DOMContentLoaded",function(){setTimeout(w,500)}),console.log("[AUDIT] Event cleanup system loaded")}();!function(){"use strict";function t(){var t=function(){if("function"==typeof getUserSimplificationLevel)return getUserSimplificationLevel();try{var t=JSON.parse(localStorage.getItem("btc_onboarding_profile"));return t?t.level:"beginner"}catch(t){return"beginner"}}();if("beginner"===t){["floatingRandomBtn","guestPointsBanner"].forEach(function(t){var e=document.getElementById(t);e&&(e.setAttribute("data-mobile-hidden","true"),e.style.display="none")});}else if("intermediate"===t){["floatingRandomBtn","guestPointsBanner"].forEach(function(t){var e=document.getElementById(t);e&&(e.setAttribute("data-mobile-hidden","true"),e.style.display="none")})}}function e(){if(!localStorage.getItem("btc_swipe_hint_shown")){localStorage.setItem("btc_swipe_hint_shown","true");var t=document.createElement("div");t.style.cssText="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:300;background:rgba(15,23,42,0.95);border:1px solid rgba(249,115,22,0.3);color:#fff;padding:12px 20px;border-radius:14px;font-size:0.85rem;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,0.4);display:flex;align-items:center;gap:10px;animation:fadeSlideIn 0.3s ease-out;backdrop-filter:blur(8px);max-width:90vw;font-family:inherit;",t.innerHTML='<span style="font-size:1.3rem;">👆</span><span>Swipe left/right to navigate topics</span>',document.body.appendChild(t),setTimeout(function(){t.style.transition="opacity 0.4s, transform 0.4s",t.style.opacity="0",t.style.transform="translateX(-50%) translateY(10px)",setTimeout(function(){t.remove()},400)},4e3)}}function n(){var n;(n=document.createElement("style")).id="mobileOptCSS",n.textContent="@media(max-width:900px) {  #bottomNav { padding-bottom: max(env(safe-area-inset-bottom, 10px), 10px) !important; }  #spinModal > div, #donateModal > div {    max-height: calc(100vh - 80px) !important;    overflow-y: auto !important;    -webkit-overflow-scrolling: touch;  }  .ch-btn { min-height: 44px; display: flex; align-items: center; }  .bnav-btn { min-height: 50px; }  input, textarea, select { font-size: 16px !important; }  #nachoModeScreen > div:last-child {    padding-bottom: max(env(safe-area-inset-bottom, 12px), 12px) !important;  }}",document.head.appendChild(n),setTimeout(function(){var n;t(),function(){if(!localStorage.getItem("btc_swipe_hint_shown")){var t=window.go;if("function"==typeof t){var n=!1;window.go=function(){var o=t.apply(this,arguments);return!n&&arguments[0]&&"undefined"!=typeof CHANNELS&&CHANNELS[arguments[0]]&&(n=!0,setTimeout(e,2e3)),o}}}}(),"function"==typeof(n=window.go)&&(window.go=function(){var t=n.apply(this,arguments);return setTimeout(function(){var t=[];try{t=JSON.parse(localStorage.getItem("btc_visited_channels")||"[]")}catch(t){}t.length>=5&&["mobileSearchBtn"].forEach(function(t){var e=document.getElementById(t);e&&e.getAttribute("data-mobile-hidden")&&(e.style.display="",e.removeAttribute("data-mobile-hidden"))}),t.length>=10&&document.querySelectorAll("[data-mobile-hidden]").forEach(function(t){t.style.display="",t.removeAttribute("data-mobile-hidden")})},1e3),t})},800)}window.innerWidth>900&&!("ontouchstart"in window)||("loading"===document.readyState?document.addEventListener("DOMContentLoaded",function(){setTimeout(n,600)}):setTimeout(n,600),console.log("[MOBILE] Mobile optimizations loaded"))}();!function(){"use strict";var e=null;window.getSharedAudioContext=function(){if(e&&"closed"!==e.state)return"suspended"===e.state&&e.resume().catch(function(){}),e;try{e=new(window.AudioContext||window.webkitAudioContext)}catch(e){return null}return e},"function"==typeof window.playChannelSound&&(window.playChannelSound=function(){if("function"!=typeof window.canPlaySound||window.canPlaySound())try{var e=window.getSharedAudioContext();if(!e)return;var t=void 0!==window.audioVolume?window.audioVolume:.5,n=e.createOscillator(),o=e.createGain();n.connect(o),o.connect(e.destination),n.frequency.value=880,n.type="sine",o.gain.setValueAtTime(.08*t,e.currentTime),o.gain.exponentialRampToValueAtTime(.001,e.currentTime+.15),n.start(e.currentTime),n.stop(e.currentTime+.15);var a=e.createOscillator(),i=e.createGain();a.connect(i),i.connect(e.destination),a.frequency.value=1318.5,a.type="sine",i.gain.setValueAtTime(.05*t,e.currentTime+.05),i.gain.exponentialRampToValueAtTime(.001,e.currentTime+.25),a.start(e.currentTime+.05),a.stop(e.currentTime+.25)}catch(e){}}),window._navGeneration=window._navGeneration||0,window.startNavigation=function(){return ++window._navGeneration,window._navGeneration},window.isNavigationCurrent=function(e){return e===window._navGeneration},window.safeSetItem=function(e,t){try{return localStorage.setItem(e,t),!0}catch(o){console.warn("[Storage] QuotaExceeded for key:",e);try{var n=JSON.parse(localStorage.getItem("btc_nacho_chat")||"[]");return n.length>100&&(n=n.slice(-100),localStorage.setItem("btc_nacho_chat",JSON.stringify(n))),localStorage.setItem(e,t),!0}catch(t){return console.error("[Storage] Failed even after cleanup:",e),!1}}};var t,n=null;window.debouncedSearch=function(e,t){t=t||300,n&&clearTimeout(n),n=setTimeout(function(){"function"==typeof doSearch&&doSearch(e)},t)},setTimeout(function(){[document.getElementById("searchInput"),document.getElementById("searchOverlayInput")].forEach(function(e){if(e){var t=e.getAttribute("oninput");t&&t.includes("doSearch")&&(e.removeAttribute("oninput"),e.addEventListener("input",function(){window.debouncedSearch(this.value,250)}))}})},1e3),function(){if(!localStorage.getItem("theme")&&window.matchMedia&&!window.matchMedia("(prefers-color-scheme: dark)").matches){document.body.setAttribute("data-theme","light");var e=document.getElementById("themeBtn");e&&(e.textContent="☀️")}}(),(t=document.createElement("style")).textContent="@media (prefers-reduced-motion: reduce) {  *, *::before, *::after {    animation-duration: 0.01ms !important;    animation-iteration-count: 1 !important;    transition-duration: 0.01ms !important;    scroll-behavior: auto !important;  }  .skeleton { animation: none !important; }}",document.head.appendChild(t),console.log("[AUDIT-V2] Performance + safety fixes loaded")}();(function() {
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
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
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
})();!function(){"use strict";window.createYouTubeFacade=function(e){const t=document.createElement("div");t.className="yt-embed yt-facade",t.style.cssText="position:relative;width:100%;max-width:560px;aspect-ratio:16/9;height:auto;overflow:hidden;border-radius:12px;margin:12px 0;cursor:pointer;background:#000;";const n=document.createElement("img");n.src="https://i.ytimg.com/vi/"+e+"/hqdefault.jpg",n.alt="Video thumbnail",n.loading="lazy",n.style.cssText="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;",t.appendChild(n);const o=document.createElement("div");return o.style.cssText="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:68px;height:48px;background:rgba(255,0,0,0.85);border-radius:12px;display:flex;align-items:center;justify-content:center;transition:0.2s;",o.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>',t.appendChild(o),t.addEventListener("mouseenter",function(){o.style.background="rgba(255,0,0,1)",o.style.transform="translate(-50%,-50%) scale(1.1)"}),t.addEventListener("mouseleave",function(){o.style.background="rgba(255,0,0,0.85)",o.style.transform="translate(-50%,-50%) scale(1)"}),t.addEventListener("click",function(){const n=document.createElement("iframe");n.src="https://www.youtube-nocookie.com/embed/"+e+"?autoplay=1",n.setAttribute("frameborder","0"),n.setAttribute("allowfullscreen",""),n.setAttribute("allow","autoplay; encrypted-media"),n.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;border-radius:12px;",t.innerHTML="",t.appendChild(n)},{once:!0}),t},window.prefetchAdjacentChannels=function(e){if("undefined"==typeof CHANNELS||!window._sidebarOrder)return;const t=window._sidebarOrder.length>0?window._sidebarOrder:Object.keys(CHANNELS),n=t.indexOf(e);if(-1===n)return;const o=[];n<t.length-1&&o.push(t[n+1]),n>0&&o.push(t[n-1]),o.forEach(function(e){if("undefined"!=typeof channelCache&&channelCache[e])return;const t=CHANNELS[e];if(!t||!t.file)return;const n=document.createElement("link");n.rel="prefetch",n.href=t.file,n.as="fetch",n.crossOrigin="anonymous",document.head.appendChild(n),setTimeout(function(){n.parentNode&&n.parentNode.removeChild(n)},3e4)})};const e={storage:!1,messaging:!1,functions:!1};if(window.loadFirebaseModule=function(t){if(e[t])return Promise.resolve();const n={storage:"https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js",messaging:"https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js",functions:"https://www.gstatic.com/firebasejs/9.23.0/firebase-functions-compat.js"};return n[t]?new Promise(function(o,i){const r=document.createElement("script");r.src=n[t],r.onload=function(){e[t]=!0,o()},r.onerror=i,document.head.appendChild(r)}):Promise.reject(new Error("Unknown module: "+t))},!window.BTC_DEBUG){const e=console.log;console.warn;console.log=function(){window.BTC_DEBUG&&e.apply(console,arguments)}}if(window.BTC_IMG_CACHE_LIMIT=800,"IntersectionObserver"in window){const e=new IntersectionObserver(function(t){t.forEach(function(t){if(t.isIntersecting){const n=t.target,o=n.getAttribute("data-yt-id");if(o&&!n.querySelector("iframe")){const e=window.createYouTubeFacade(o);n.innerHTML="",n.appendChild(e)}e.unobserve(n)}})},{rootMargin:"200px"});window.observeYouTubeEmbed=function(t){e.observe(t)}}console.log("[AUDIT] Performance patches loaded")}();!function(){"use strict";const t=document.createElement("a");t.href="#main",t.textContent="Skip to main content",t.className="skip-nav",t.style.cssText="position:fixed;top:-100px;left:16px;z-index:99999;padding:12px 24px;background:var(--accent,#f97316);color:#fff;border-radius:0 0 10px 10px;font-weight:700;font-size:0.9rem;text-decoration:none;transition:top 0.2s;font-family:inherit;",t.addEventListener("focus",function(){this.style.top="0"}),t.addEventListener("blur",function(){this.style.top="-100px"}),t.addEventListener("click",function(t){t.preventDefault();const e=document.getElementById("main");e&&(e.focus(),e.scrollTo(0,0)),this.style.top="-100px"}),document.body.insertBefore(t,document.body.firstChild);const e={"#themeBtn":"Toggle light and dark mode","#audioBtn":"Toggle sound effects","#backToTop":"Scroll to top","#scrollToBottom":"Scroll to bottom","#desktopSearchBtn":"Search the archive","#mobileSearchBtn":"Search the archive","#lbFloatBtn":"Open leaderboard","#desktopDMBtn":"Open direct messages"};Object.keys(e).forEach(function(t){const n=document.querySelector(t);n&&!n.getAttribute("aria-label")&&n.setAttribute("aria-label",e[t])}),document.querySelectorAll(".random-btn").forEach(function(t){const e=t.getAttribute("title");e&&!t.getAttribute("aria-label")&&t.setAttribute("aria-label",e)});const n=document.getElementById("sidebar");n&&!n.getAttribute("role")&&(n.setAttribute("role","navigation"),n.setAttribute("aria-label","Channel navigation"));const o=document.getElementById("main");o&&(o.setAttribute("role","main"),o.setAttribute("tabindex","-1"));const i=document.getElementById("channelList");i&&i.addEventListener("keydown",function(t){const e=t.target;if(!e.classList.contains("ch-btn"))return;const n=e.closest(".cat-group");if(!n)return;const o=Array.from(n.querySelectorAll(".ch-btn")),i=o.indexOf(e);let a=null;switch(t.key){case"ArrowDown":case"j":t.preventDefault(),a=o[i+1]||o[0];break;case"ArrowUp":case"k":t.preventDefault(),a=o[i-1]||o[o.length-1];break;case"Home":t.preventDefault(),a=o[0];break;case"End":t.preventDefault(),a=o[o.length-1]}a&&a.focus()}),document.querySelectorAll(".cat-toggle").forEach(function(t){t.setAttribute("role","button"),t.setAttribute("tabindex","0"),t.setAttribute("aria-expanded",t.getAttribute("data-expanded")||"false"),t.addEventListener("keydown",function(t){if("Enter"===t.key||" "===t.key){t.preventDefault(),this.click();const e="true"===this.getAttribute("data-expanded");this.setAttribute("aria-expanded",String(e))}})});const a=document.createElement("style");a.textContent=[".ch-btn:focus-visible, .random-btn:focus-visible, .theme-toggle:focus-visible,",".share-btn:focus-visible, .quest-opt:focus-visible, button:focus-visible {","  outline: 2px solid var(--accent, #f97316);","  outline-offset: 2px;","  box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.2);","}",".skip-nav:focus { top: 0 !important; }",'[role="button"]:focus-visible {',"  outline: 2px solid var(--accent, #f97316);","  outline-offset: 2px;","}"].join("\n"),document.head.appendChild(a);let s=document.getElementById("sr-live");s||(s=document.createElement("div"),s.id="sr-live",s.setAttribute("role","status"),s.setAttribute("aria-live","polite"),s.setAttribute("aria-atomic","true"),s.style.cssText="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;",document.body.appendChild(s)),window.announceToSR=function(t){s&&(s.textContent="",setTimeout(function(){s.textContent=t},100))},console.log("[AUDIT] Accessibility patches loaded")}();!function(){"use strict";var e,t;window.innerWidth<=900||window;document.addEventListener("keydown",function(e){if("Escape"===e.key){for(var t=[{id:"searchOverlay",check:"display",close:function(e){e.style.display="none"}},{id:"nachoModeScreen",check:"display",close:function(e){"function"==typeof exitNachoMode?exitNachoMode():e.style.display="none"}},{id:"questModal",check:"class",close:function(e){e.classList.remove("open"),e.style.display="none"}},{id:"leaderboard",check:"class",close:function(e){e.classList.remove("open")}},{id:"tipOverlay",check:"display",close:function(e){e.remove()}}],n=0;n<t.length;n++){var o=document.getElementById(t[n].id);if(o&&("class"===t[n].check?o.classList.contains("open"):"flex"===o.style.display||"block"===o.style.display))return t[n].close(o),void e.preventDefault()}var i=document.querySelectorAll('div[style*="position:fixed"][style*="z-index:10001"], div[style*="position: fixed"][style*="z-index: 10001"]');i.length>0&&(i[i.length-1].remove(),e.preventDefault())}}),function(){var e=/^[a-zA-Z0-9_\-.\u00C0-\u024F]{3,20}$/,t=["admin","moderator","system","bitcoin","satoshi","nacho","603btc","null","undefined"];function n(){var e=window.submitUsername;"function"!=typeof e||e._v3||(window.submitUsername=function(){var t=document.getElementById("usernameInput");if(!t)return e.apply(this,arguments);var n=window.validateUsername(t.value);if(!n.valid){t.style.borderColor="#ef4444";var o=t.parentElement.querySelector(".username-error");return o||((o=document.createElement("div")).className="username-error",o.style.cssText="color:#ef4444;font-size:0.8rem;margin:-8px 0 12px;text-align:center;",t.parentElement.insertBefore(o,t.nextSibling)),void(o.textContent=n.error)}t.style.borderColor="";var i=t.parentElement.querySelector(".username-error");return i&&i.remove(),t.value=n.name,e.apply(this,arguments)},window.submitUsername._v3=!0)}window.validateUsername=function(n){if(!n)return{valid:!1,error:"Username is required"};var o=n.trim();return o.length<3?{valid:!1,error:"Must be at least 3 characters"}:o.length>20?{valid:!1,error:"Must be 20 characters or fewer"}:e.test(o)?-1!==t.indexOf(o.toLowerCase())?{valid:!1,error:"This username is reserved"}:o.replace(/[\s\u200B-\u200D\uFEFF]/g,"").length<3?{valid:!1,error:"Must contain at least 3 visible characters"}:{valid:!0,name:o}:{valid:!1,error:"Letters, numbers, underscores, hyphens, periods only"}},setTimeout(n,2e3),setTimeout(n,5e3),setTimeout(function(){var e=document.getElementById("usernameInput");e&&!e._v3Live&&(e._v3Live=!0,e.addEventListener("input",function(){var e=this.value;if(e.length){var t=window.validateUsername(e);this.style.borderColor=t.valid?"#22c55e":e.length<3?"":"#ef4444"}else this.style.borderColor=""}))},3e3)}(),function(){function e(e){var t=e.getAttribute("rel")||"";t.includes("noopener")||e.setAttribute("rel",(t+" noopener noreferrer").trim())}setTimeout(function(){document.querySelectorAll('a[target="_blank"]').forEach(e)},1500),"undefined"!=typeof MutationObserver&&new MutationObserver(function(t){t.forEach(function(t){t.addedNodes.forEach(function(t){1===t.nodeType&&("A"===t.tagName&&"_blank"===t.getAttribute("target")&&e(t),t.querySelectorAll&&t.querySelectorAll('a[target="_blank"]').forEach(e))})})}).observe(document.body,{childList:!0,subtree:!0})}(),function(){var e=!0;function t(){var e=window.go;"function"!=typeof e||e._v3HistorySkip||(window.go=function(t,n){var o=e.call(this,t,n);try{if(!window._v3SkipPush){var i="#"+t;location.hash!==i&&history.pushState({channel:t},"",i)}}catch(e){}return o},window.go._v3HistorySkip=!0)}window.addEventListener("popstate",function(t){if(e)e=!1;else if(t.state&&t.state.channel){var n=window.go;if("function"==typeof n){var o=n;o._v3History,window._v3SkipPush=!0,n(t.state.channel),window._v3SkipPush=!1}}else location.hash&&"#"!==location.hash||"function"==typeof goHome&&goHome()}),setTimeout(t,3e3),setTimeout(t,6e3)}(),(e=document.createElement("style")).id="v3-touch-targets",e.textContent=["@media (max-width: 900px) {",'  .msg button[onclick*="toggleBookmark"] {',"    min-height: 44px !important;","    min-width: 44px !important;","    padding: 10px !important;","    font-size: 1rem !important;","  }","  .share-btn, .cat-toggle {","    min-height: 44px;","    padding: 10px 12px !important;","  }","  .mobile-close, .lb-close {","    min-width: 44px !important;","    min-height: 44px !important;","  }","  .bnav-btn {","    min-height: 48px !important;","    min-width: 48px;","    touch-action: manipulation;","    -webkit-tap-highlight-color: transparent;","  }","  #bottomNav {","    padding-bottom: max(env(safe-area-inset-bottom, 8px), 8px) !important;","  }","}"].join("\n"),document.head.appendChild(e),function(){var e={},t=null;function n(){var n=window.go;"function"!=typeof n||n._v3Scroll||(window.go=function(o,i){var a;(a=document.getElementById("main"))&&t&&(e[t]=a.scrollTop);var r=n.call(this,o,i);t=o;var s=e[o];return s&&s>0&&setTimeout(function(){var e=document.getElementById("main");e&&e.scrollTo({top:s,behavior:"smooth"})},300),r},window.go._v3Scroll=!0)}setTimeout(n,3e3),setTimeout(n,6e3),setTimeout(function(){t=window.currentChannelId||null},2e3)}(),function(){var e=document.createElement("style");function t(){var e=window.toggleTheme;"function"!=typeof e||e._v3||(window.toggleTheme=function(){document.body.classList.add("theme-transitioning"),e.apply(this,arguments),setTimeout(function(){document.body.classList.remove("theme-transitioning")},400)},window.toggleTheme._v3=!0)}e.id="v3-theme-transition",e.textContent=[".theme-transitioning, .theme-transitioning * {","  transition: background-color 0.3s ease, color 0.3s ease,","    border-color 0.3s ease, box-shadow 0.3s ease !important;","}",'[data-theme="light"] .username-box {',"  background: rgba(255,255,255,0.95) !important;","  border-color: var(--border) !important;","}",'[data-theme="light"] .username-box h2 { color: var(--heading) !important; }','[data-theme="light"] .username-box input {',"  background: var(--input-bg) !important;","  color: var(--text) !important;","}",'[data-theme="light"] .username-box p { color: var(--text-muted) !important; }','[data-theme="light"] #searchOverlay {',"  background: rgba(255,255,255,0.95) !important;","}"].join("\n"),document.head.appendChild(e),setTimeout(t,2e3),setTimeout(t,5e3)}(),t=[],window.trapFocus=function(e){if(e){var n=e.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])');if(n.length){var o=n[0],i=n[n.length-1];e.addEventListener("keydown",a),t.push({container:e,handler:a}),setTimeout(function(){o.focus()},100)}}function a(e){"Tab"===e.key&&(e.shiftKey?document.activeElement===o&&(e.preventDefault(),i.focus()):document.activeElement===i&&(e.preventDefault(),o.focus()))}},window.releaseFocus=function(e){for(var n=t.length-1;n>=0;n--)if(t[n].container===e){e.removeEventListener("keydown",t[n].handler),t.splice(n,1);break}},"undefined"!=typeof MutationObserver&&["usernameModal","questModal"].forEach(function(e){var t=document.getElementById(e);t&&new MutationObserver(function(){"block"===t.style.display||"flex"===t.style.display||t.classList.contains("open")?trapFocus(t):releaseFocus(t)}).observe(t,{attributes:!0,attributeFilter:["style","class"]})}),function(){var e=document.createElement("style");e.id="v3-img-shimmer",e.textContent=[".msg-img {","  aspect-ratio: auto;","  min-height: 80px;","  background: linear-gradient(135deg, var(--card-bg) 0%, var(--border) 50%, var(--card-bg) 100%);","  background-size: 200% 200%;","  animation: v3Shimmer 2s ease-in-out infinite;","  border-radius: 10px;","  contain: layout;","}",'.msg-img[data-loaded="true"] {',"  background: none !important;","  animation: v3FadeIn 0.3s ease-out;","}","@keyframes v3Shimmer {","  0% { background-position: 200% 0; }","  100% { background-position: -200% 0; }","}","@keyframes v3FadeIn {","  from { opacity: 0.7; }","  to { opacity: 1; }","}",".yt-embed {","  aspect-ratio: 16/9;","  width: 100%;","  max-width: 560px;","  height: auto;","  background: #000;","  border-radius: 12px;","  overflow: hidden;","  contain: layout;","}"].join("\n"),document.head.appendChild(e),document.addEventListener("load",function(e){e.target&&"IMG"===e.target.tagName&&e.target.classList.contains("msg-img")&&e.target.setAttribute("data-loaded","true")},!0)}(),function(){var e=null,t=window.innerWidth;function n(){e&&clearTimeout(e),e=setTimeout(function(){var e=document.getElementById("sidebar");e&&e.classList.contains("open")&&window.innerWidth<=900&&e.classList.remove("open")},300)}window.addEventListener("orientationchange",n),window.addEventListener("resize",function(){Math.abs(window.innerWidth-t)>100&&(t=window.innerWidth,n())})}(),console.log("[AUDIT-V3] Phase 1 patches loaded")}();