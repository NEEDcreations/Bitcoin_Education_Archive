// Bitcoin Education Archive - Service Worker v14
const CACHE_NAME = 'btc-archive-v67';
const IMG_CACHE = 'btc-images-v1';
const MAX_IMG_CACHE = 200; 

// Core assets to pre-cache on install
// Use relative paths for better portability
const PRE_CACHE = [
  './',
  './index.html',
  './bundle.js',
  './nacho-deer.svg',
  './manifest.json'
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

  // For PWA reliability, we should treat requests with query params (versioning) 
  // as the same as the base file in the cache if possible.
  
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response.ok) {
          const cacheCopy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cacheCopy));
        }
        return response;
      }).catch(() => cached);
      
      // If it's an image, return cached version immediately (cache-first)
      if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
        return cached || networkFetch;
      }
      
      // For everything else, go to network first but fallback to cache
      return networkFetch || cached;
    })
  );
});
