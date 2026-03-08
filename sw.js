// Bitcoin Education Archive - Service Worker v15
// [AUDIT FIX P7/B10] Expanded pre-cache and larger image cache
const CACHE_NAME = 'btc-archive-v25';
const IMG_CACHE = 'btc-images-v2';
const MAX_IMG_CACHE = 800; // [AUDIT FIX P7] Increased from 200

// [AUDIT FIX B10] Pre-cache critical files including key JS modules
const PRE_CACHE = [
  './',
  './index.html',
  './bundle.js',
  './nacho-deer.svg',
  './manifest.json',
  './donation-qr.jpg',
  './og-image.png',
  './favicon.ico',
];

self.addEventListener('install', event => {
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

  // JSON data files: network-first with cache fallback
  if (/\.json(\?|$)/i.test(url.pathname) && url.pathname.includes('data/')) {
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

  // HTML/JS/CSS: stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(response => {
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => null);

        return cached || fetchPromise;
      })
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
