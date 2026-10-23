// Bitcoin Education Archive - Service Worker
// One controlling worker. firebase-messaging-sw.js is not registered:
// a second worker on scope "/" replaces this cache worker (or the reverse),
// and iOS only delivers Web Push to the installed PWA's controlling worker.
self.addEventListener('notificationclick', function (event) {
  event.stopImmediatePropagation();
  event.notification.close();
  var target = pushTargetUrl(event.notification);
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    var i;
    for (i = 0; i < list.length; i++) {
      var client = list[i];
      if (!client.url || client.url.indexOf(self.location.origin) !== 0) continue;
      if (typeof client.navigate === 'function') {
        return client.navigate(target).then(function (next) {
          return (next || client).focus();
        }).catch(function () {
          client.postMessage({ type: 'PUSH_NAV', url: target });
          return client.focus();
        });
      }
      client.postMessage({ type: 'PUSH_NAV', url: target });
      return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(target);
  }));
});

function pushTargetUrl(notification) {
  var data = (notification && notification.data) || {};
  var raw = data.url || '';
  if (!raw && data.FCM_MSG) {
    var msg = data.FCM_MSG;
    raw = (msg.data && msg.data.url) || (msg.fcmOptions && msg.fcmOptions.link) || '';
  }
  try {
    var u = new URL(raw || '/', self.location.origin);
    if (u.origin === self.location.origin) return u.href;
    if (u.protocol === 'https:' && u.hostname === 'bitcoineducation.quest') return u.href;
  } catch (e) { /* fall through */ }
  return self.location.origin + '/';
}

try {
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey: 'AIzaSyDLwucmRxjoJp2KMBTi2ujf0mlVkgLHyKk',
  authDomain: 'bitcoin-education-archive.firebaseapp.com',
  projectId: 'bitcoin-education-archive',
  storageBucket: 'bitcoin-education-archive.firebasestorage.app',
  messagingSenderId: '1055248200518',
  appId: '1:1055248200518:web:6c6d64a5ee78e19bfbeb47'
});
firebase.messaging().onBackgroundMessage(function (payload) {
  // A notification payload is displayed by FCM. Showing it again doubles the alert.
  if (payload && payload.notification) return;
  var data = (payload && payload.data) || {};
  var title = data.title || 'Bitcoin Quest';
  return self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: { url: data.url || (self.location.origin + '/') }
  });
});
} catch (e) { /* FCM scripts are optional; cache and click handling still run */ }

// [AUDIT FIX P7/B10] Expanded pre-cache and larger image cache
const CACHE_NAME = 'btc-archive-v2347';
const IMG_CACHE = 'btc-images-v2';
const MAX_IMG_CACHE = 800; // [AUDIT FIX P7] Increased from 200

// [AUDIT FIX B10] Pre-cache critical files including key JS modules
// PRE_CACHE is shell + icons only. bundle.min.js is NOT precached.
// Keeping SW install fast — bundle loads network-first and caches on first fetch.
const PRE_CACHE = [
  './',
  './index.html',
  './nacho-deer.svg',
  './manifest.json',
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

// Firebase reserved helpers (/__/auth/handler, /__/firebase/*) must not be
// intercepted. Android can open an in-scope return URL in the installed app;
// a respondWith here would cache or stall that handler. The manifest scope
// stays "./" because path exclusion is not a safe manifest feature.
function bypassesAuthHelper(requestUrl) {
  try {
    var url = new URL(requestUrl);
    return url.origin === self.location.origin && url.pathname.indexOf('/__/') === 0;
  } catch (err) {
    return false;
  }
}

self.addEventListener('fetch', event => {
  if (bypassesAuthHelper(event.request.url)) return;
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
