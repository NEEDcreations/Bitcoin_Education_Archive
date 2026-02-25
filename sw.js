// Bitcoin Education Archive - Service Worker v6
const CACHE_NAME = 'btc-archive-v6';
const IMG_CACHE = 'btc-images-v1';
const MAX_IMG_CACHE = 200; // Max cached images
const OFFLINE_URL = '/';

// Core assets to pre-cache on install
const PRE_CACHE = [
  '/',
  '/index.html',
  '/ranking.js',
  '/features.js',
  '/quests.js',
  '/scholar.js',
  '/tickets.js',
  '/badges.js',
  '/channel_index.js',
  '/nacho.js',
  '/nacho-qa.js',
  '/nacho-engage.js',
  '/nacho-closet.js',
  '/nacho-live.js',
  '/mobile-ux.js',
  '/forum.js',
  '/nacho-deer.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/images/btc-grad-logo.jpg',
  '/donation-qr.jpg',
];

// Install: pre-cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRE_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== IMG_CACHE).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Trim image cache to MAX_IMG_CACHE
async function trimImageCache() {
  const cache = await caches.open(IMG_CACHE);
  const keys = await cache.keys();
  if (keys.length > MAX_IMG_CACHE) {
    // Delete oldest entries (first in = first out)
    for (let i = 0; i < keys.length - MAX_IMG_CACHE; i++) {
      await cache.delete(keys[i]);
    }
  }
}

// Fetch handler
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip cross-origin requests (Firebase, external APIs, CDNs)
  if (url.origin !== self.location.origin) return;

  // IMAGES: cache-first (images rarely change, saves bandwidth)
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
    event.respondWith(
      caches.open(IMG_CACHE).then(cache => {
        return cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) {
              cache.put(event.request, response.clone());
              trimImageCache();
            }
            return response;
          }).catch(() => cached);
        });
      })
    );
    return;
  }

  // JSON DATA: network-first (content updates)
  if (url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // JS/HTML/CSS: network-first (always get fresh code, cache as fallback)
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
