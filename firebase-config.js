// =============================================
// Bitcoin Education Archive - Firebase Config
// =============================================

const USE_STAGING = false; // Change this to true to switch to Staging

const PROD_CONFIG = {
    apiKey: "AIzaSyDLwucmRxjoJp2KMBTi2ujf0mlVkgLHyKk",
    authDomain: "bitcoin-education-archive.firebaseapp.com",
    projectId: "bitcoin-education-archive",
    storageBucket: "bitcoin-education-archive.firebasestorage.app",
    messagingSenderId: "1055248200518",
    appId: "1:1055248200518:web:71e847c5d796739bc3ee26"
};

const STAGING_CONFIG = {
    apiKey: "AIzaSyCkUGX2KWaVGmSQXpYJhWDxF_BSiHRX6SM",
    authDomain: "btc-archive-test.firebaseapp.com",
    projectId: "btc-archive-test",
    storageBucket: "btc-archive-test.firebasestorage.app",
    messagingSenderId: "60810625669",
    appId: "1:60810625669:web:ea4dacd55333e41429dfec",
    measurementId: "G-7C2FKDJ8E4"
};

const FIREBASE_CONFIG = USE_STAGING ? STAGING_CONFIG : PROD_CONFIG;
