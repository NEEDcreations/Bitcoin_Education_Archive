const admin = require('firebase-admin');
const sa = require('/root/simple-archive/functions/service-account.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
    // Find Nostr users missing 'created' field
    const snap = await db.collection('users').where('nostr', '!=', '').get();
    console.log('Nostr users total:', snap.size);
    
    let fixed = 0;
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();
    
    snap.forEach(doc => {
        const d = doc.data();
        if (!d.created && !d.createdAt) {
            console.log('  Missing created:', d.username || doc.id, '- points:', d.points || 0);
            // Use lastLogin if available as a proxy, otherwise now
            const ts = d.lastLogin || now;
            batch.update(doc.ref, { created: ts });
            fixed++;
        }
    });
    
    if (fixed > 0) {
        await batch.commit();
        console.log('Backfilled', fixed, 'users');
    } else {
        console.log('No users needed backfill');
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
