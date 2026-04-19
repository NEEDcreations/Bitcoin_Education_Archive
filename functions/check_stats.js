const admin = require('firebase-admin');
try {
    admin.initializeApp({ projectId: 'bitcoin-education-archive' });
    const db = admin.firestore();
    Promise.all([
        db.collection('tctv_stats').doc('views').get(),
        db.collection('tctv_stats').doc('peak').get()
    ]).then(([v, p]) => {
        console.log('views exists:', v.exists, 'data:', v.exists ? v.data() : null);
        console.log('peak exists:', p.exists, 'data:', p.exists ? p.data() : null);
        process.exit(0);
    }).catch(e => { console.error('query error:', e.message); process.exit(1); });
} catch(e) { console.error('init error:', e.message); }
