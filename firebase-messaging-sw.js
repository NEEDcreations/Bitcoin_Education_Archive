importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCkUGX2KWaVGmSQXpYJhWDxF_BSiHRX6SM",
    authDomain: "btc-archive-test.firebaseapp.com",
    projectId: "btc-archive-test",
    storageBucket: "btc-archive-test.firebasestorage.app",
    messagingSenderId: "60810625669",
    appId: "1:60810625669:web:ea4dacd55333e41429dfec",
    measurementId: "G-7C2FKDJ8E4"
});

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
