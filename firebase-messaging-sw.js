// Kept so an old registration still opens the right screen.
// The page unregisters this worker. Push is handled by sw.js at scope "/",
// because a second worker on the same scope replaces the cache worker,
// and iOS delivers Web Push only to the installed PWA's controlling worker.
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
    apiKey: "AIzaSyDLwucmRxjoJp2KMBTi2ujf0mlVkgLHyKk",
    authDomain: "bitcoin-education-archive.firebaseapp.com",
    projectId: "bitcoin-education-archive",
    storageBucket: "bitcoin-education-archive.firebasestorage.app",
    messagingSenderId: "1055248200518",
    appId: "1:1055248200518:web:6c6d64a5ee78e19bfbeb47"
});

firebase.messaging().onBackgroundMessage(function (payload) {
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
} catch (e) { /* FCM scripts are optional; click handling still runs */ }
