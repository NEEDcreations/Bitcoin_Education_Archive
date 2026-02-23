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
