// TCTV Presence Aggregation Function
// Deploy with: firebase deploy --only functions:aggregateTctvPresence

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = admin.firestore();

exports.aggregateTctvPresence = functions.pubsub.schedule('every 10 seconds').onRun(async (context) => {
    try {
        const now = Date.now();
        const staleThreshold = 65000; // 65 seconds
        
        // Get all presence docs (limit 10000 to avoid memory issues)
        const presenceSnap = await db.collection('tctv_presence').limit(10000).get();
        
        // Aggregate by station
        const counts = {};
        presenceSnap.forEach(doc => {
            const d = doc.data();
            if (!d.station) return;
            
            let docTime = 0;
            if (d.ts && d.ts.toMillis) docTime = d.ts.toMillis();
            else if (typeof d.tsClient === 'number') docTime = d.tsClient;
            
            if (!docTime) return;
            if (now - docTime > staleThreshold) return; // Stale
            
            counts[d.station] = (counts[d.station] || 0) + 1;
        });
        
        // Write aggregated counts
        const batch = db.batch();
        for (const [stationId, count] of Object.entries(counts)) {
            batch.set(db.collection('tctv_counts').doc(stationId), {
                count: count,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        
        // Delete counts for stations with 0 viewers
        const existingSnap = await db.collection('tctv_counts').get();
        existingSnap.forEach(doc => {
            if (!counts[doc.id]) {
                batch.delete(doc.ref);
            }
        });
        
        await batch.commit();
        
        console.log('[TCTV] Aggregated:', Object.keys(counts).length + ' stations,', Object.values(counts).reduce((a,b)=>a+b, 0), 'viewers');
        return null;
    } catch (e) {
        console.error('[TCTV] Aggregation error:', e.message);
        return null;
    }
});
