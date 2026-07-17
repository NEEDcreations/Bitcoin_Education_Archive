// Bitcoin Education Archive - Service Worker v15
// [AUDIT FIX P7/B10] Expanded pre-cache and larger image cache
const CACHE_NAME = 'btc-archive-v1815';
const IMG_CACHE = 'btc-images-v2';
const MAX_IMG_CACHE = 800; // [AUDIT FIX P7] Increased from 200

// [AUDIT FIX B10] Pre-cache critical files including key JS modules
const PRE_CACHE = [
  './',
  './index.html',
  './bundle.js',
  './patches.js',
  './nacho-deer.svg',
  './nacho-fly.svg',
  './manifest.json',
  './donation-qr.jpg',
  './og-image.png',
  './favicon.ico',
];

// Allow pages to explicitly trigger skipWaiting so the new SW takes over
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', event => {
  // skipWaiting immediately so the new SW is ready to serve when the page reloads.
  // The update banner triggers a hard navigation (location.href = '/') rather than
  // relying on the controllerchange/reload dance, which caused partial page loads.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRE_CACHE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME && k !== IMG_CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Strip query params for cache matching (handles ?v= versioning)
  const cacheKey = url.pathname;

  // Image caching with LRU-style eviction
  if (/\.(jpg|jpeg|png|gif|webp|svg|ico)(\?|$)/i.test(url.pathname)) {
    event.respondWith(
      caches.open(IMG_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) {
              const clone = response.clone();
              // Evict old entries if at limit
              cache.keys().then(keys => {
                if (keys.length >= MAX_IMG_CACHE) {
                  // Remove oldest 10% of entries
                  const toRemove = Math.floor(MAX_IMG_CACHE * 0.1);
                  for (let i = 0; i < toRemove && i < keys.length; i++) {
                    cache.delete(keys[i]);
                  }
                }
              });
              cache.put(event.request, clone);
            }
            return response;
          }).catch(() => cached || new Response('', { status: 404 }));
        })
      )
    );
    return;
  }

  // JSON data files: network-first with cache fallback (includes offline channel cache)
  if (/\.json(\?|$)/i.test(url.pathname) && (url.pathname.includes('data/') || url.pathname.includes('channels/'))) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() =>
        caches.match(event.request).then(cached => cached || new Response('{}', {
          headers: { 'Content-Type': 'application/json' }
        }))
      )
    );
    return;
  }

  // HTML/JS/CSS: network-first with cache fallback.
  // Use cache:'no-cache' so fetch() bypasses the browser HTTP cache and
  // always validates with the server. This ensures ?v= cache-busters work
  // even when the service worker intercepts the request. (Fix: 2026-04-27)
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' }).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() =>
      caches.open(CACHE_NAME).then(cache => cache.match(event.request))
    )
  );
});

// Handle push notifications
self.addEventListener('push', event => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.notification?.body || 'New update from Bitcoin Education Archive',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
      actions: [{ action: 'open', title: 'Open' }]
    };
    
    event.waitUntil(
      self.registration.showNotification(
        data.notification?.title || 'Bitcoin Education Archive',
        options
      )
    );
  } catch(e) {
    // Ignore malformed push data
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://bitcoineducation.quest';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
