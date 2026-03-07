// ============================================================
// Bitcoin Education Archive — Performance Patches
// [AUDIT FIX P1-P8] Lazy loading, YouTube facades, prefetching
// Load AFTER app.js
// ============================================================

(function() {
    'use strict';

    // ─── P4: YouTube Lite Embed (Facade Pattern) ─────────────
    // Replaces heavy iframe embeds with a lightweight thumbnail + play button.
    // Only loads the full iframe when the user clicks play.
    window.createYouTubeFacade = function(videoId) {
        const container = document.createElement('div');
        container.className = 'yt-embed yt-facade';
        container.style.cssText = 'position:relative;width:100%;max-width:560px;aspect-ratio:16/9;' +
            'height:auto;overflow:hidden;border-radius:12px;margin:12px 0;cursor:pointer;' +
            'background:#000;';
        
        // Thumbnail
        const thumb = document.createElement('img');
        thumb.src = 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg';
        thumb.alt = 'Video thumbnail';
        thumb.loading = 'lazy';
        thumb.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;';
        container.appendChild(thumb);
        
        // Play button overlay
        const playBtn = document.createElement('div');
        playBtn.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
            'width:68px;height:48px;background:rgba(255,0,0,0.85);border-radius:12px;' +
            'display:flex;align-items:center;justify-content:center;transition:0.2s;';
        playBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="white">' +
            '<path d="M8 5v14l11-7z"/></svg>';
        container.appendChild(playBtn);
        
        container.addEventListener('mouseenter', function() {
            playBtn.style.background = 'rgba(255,0,0,1)';
            playBtn.style.transform = 'translate(-50%,-50%) scale(1.1)';
        });
        container.addEventListener('mouseleave', function() {
            playBtn.style.background = 'rgba(255,0,0,0.85)';
            playBtn.style.transform = 'translate(-50%,-50%) scale(1)';
        });
        
        // Click to load real iframe
        container.addEventListener('click', function() {
            const iframe = document.createElement('iframe');
            iframe.src = 'https://www.youtube-nocookie.com/embed/' + videoId + '?autoplay=1';
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allowfullscreen', '');
            iframe.setAttribute('allow', 'autoplay; encrypted-media');
            iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border-radius:12px;';
            container.innerHTML = '';
            container.appendChild(iframe);
        }, { once: true });
        
        return container;
    };

    // ─── P3: Channel Prefetching ─────────────────────────────
    // Prefetch the next and previous channels while user reads current one
    window.prefetchAdjacentChannels = function(currentId) {
        if (typeof CHANNELS === 'undefined' || !window._sidebarOrder) return;
        
        const keys = window._sidebarOrder.length > 0 ? window._sidebarOrder : Object.keys(CHANNELS);
        const idx = keys.indexOf(currentId);
        if (idx === -1) return;
        
        const toPrefetch = [];
        if (idx < keys.length - 1) toPrefetch.push(keys[idx + 1]);
        if (idx > 0) toPrefetch.push(keys[idx - 1]);
        
        toPrefetch.forEach(function(id) {
            if (typeof channelCache !== 'undefined' && channelCache[id]) return; // Already cached
            const meta = CHANNELS[id];
            if (!meta || !meta.file) return;
            
            // Use link preload for low-priority prefetch
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = meta.file;
            link.as = 'fetch';
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
            
            // Clean up after 30 seconds
            setTimeout(function() {
                if (link.parentNode) link.parentNode.removeChild(link);
            }, 30000);
        });
    };

    // ─── P5: Lazy Firebase SDK Loading ───────────────────────
    // Load non-essential Firebase modules only when needed
    const _lazyFirebaseModules = {
        storage: false,
        messaging: false,
        functions: false,
    };
    
    window.loadFirebaseModule = function(module) {
        if (_lazyFirebaseModules[module]) return Promise.resolve();
        
        const urls = {
            storage: 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js',
            messaging: 'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js',
            functions: 'https://www.gstatic.com/firebasejs/9.23.0/firebase-functions-compat.js',
        };
        
        if (!urls[module]) return Promise.reject(new Error('Unknown module: ' + module));
        
        return new Promise(function(resolve, reject) {
            const script = document.createElement('script');
            script.src = urls[module];
            script.onload = function() {
                _lazyFirebaseModules[module] = true;
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // ─── P6: Debug-only console.log wrapper ──────────────────
    if (!window.BTC_DEBUG) {
        // In production, suppress verbose logging
        const _originalLog = console.log;
        const _originalWarn = console.warn;
        
        // Keep error logging always
        // Suppress log/warn unless BTC_DEBUG is set
        console.log = function() {
            if (window.BTC_DEBUG) _originalLog.apply(console, arguments);
        };
        // Keep warnings visible as they may indicate real issues
        // console.warn is left as-is
    }

    // ─── P7: Enhanced Image Cache Config for SW ──────────────
    // This value is read by the service worker registration
    window.BTC_IMG_CACHE_LIMIT = 800;

    // ─── Intersection Observer for Lazy YouTube ──────────────
    // Convert existing YouTube iframes to facades when they scroll into view
    if ('IntersectionObserver' in window) {
        const ytObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    const container = entry.target;
                    const videoId = container.getAttribute('data-yt-id');
                    if (videoId && !container.querySelector('iframe')) {
                        const facade = window.createYouTubeFacade(videoId);
                        container.innerHTML = '';
                        container.appendChild(facade);
                    }
                    ytObserver.unobserve(container);
                }
            });
        }, { rootMargin: '200px' });
        
        window.observeYouTubeEmbed = function(container) {
            ytObserver.observe(container);
        };
    }

    console.log('[AUDIT] Performance patches loaded');
})();
