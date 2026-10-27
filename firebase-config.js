// Shared Firebase web config. auth-boot.js and ranking.js both read this.
// One literal so the two boot paths cannot drift.
var FIREBASE_CONFIG = {
    apiKey: "AIzaSyDLwucmRxjoJp2KMBTi2ujf0mlVkgLHyKk",
    authDomain: "bitcoineducation.quest", // Must match app origin — auth iframe proxied via seo-router worker (/__/auth/*) so Safari ITP allows postMessage
    projectId: "bitcoin-education-archive",
    storageBucket: "bitcoin-education-archive.firebasestorage.app",
    messagingSenderId: "1055248200518",
    appId: "1:1055248200518:web:6c6d64a5ee78e19bfbeb47"
};
if (typeof window !== "undefined") window.FIREBASE_CONFIG = FIREBASE_CONFIG;
