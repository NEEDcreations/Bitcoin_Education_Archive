importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

importScripts('/firebase-config.js');
firebase.initializeApp(FIREBASE_CONFIG);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
    const title = payload.notification?.title || 'Bitcoin Education Archive';
    const options = {
        body: payload.notification?.body || '',
        icon: 'https://bitcoineducation.quest/images/resources/graphics_0000_signal-2021-08-09-021521-1.jpg',
        badge: 'https://bitcoineducation.quest/images/resources/graphics_0000_signal-2021-08-09-021521-1.jpg',
        data: { url: payload.data?.url || 'https://bitcoineducation.quest' }
    };
    return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const url = event.notification.data?.url || 'https://bitcoineducation.quest';
    event.waitUntil(clients.openWindow(url));
});
