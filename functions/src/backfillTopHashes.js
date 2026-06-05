const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = admin.firestore();

exports.backfillTopHashes = functions.https.onRequest(async (req, res) => {
  const secret = req.query.t;
  if (secret !== 'backfill-2026') {
    res.status(403).send('Forbidden');
    return;
  }

  try {
    // 1. Rebuild topHashes from all hashes in satoshiFavor/current/hashes
    const hashSnap = await db.collection('satoshiFavor').doc('current').collection('hashes').get();
    const allHashes = [];
    hashSnap.forEach(doc => {
      const d = doc.data();
      allHashes.push({
        uid: d.uid || '',
        username: d.username || 'Anon',
        value: typeof d.value === 'number' ? d.value : parseInt(d.value || '999999999'),
        timestamp: d.timestamp || null
      });
    });
    
    // Sort by value ascending (lowest first)
    allHashes.sort((a, b) => a.value - b.value);
    
    // Keep only the best (lowest) entry per user, then take top 10
    const seen = new Set();
    const top10 = [];
    for (const h of allHashes) {
      if (seen.has(h.uid)) continue;
      seen.add(h.uid);
      top10.push(h);
      if (top10.length >= 10) break;
    }
    
    await db.collection('satoshiFavor').doc('topHashes').set({ entries: top10 });
    
    res.json({
      success: true,
      totalHashes: allHashes.length,
      top10: top10.map(h => ({ username: h.username, value: h.value }))
    });
  } catch (err) {
    console.error('Backfill error:', err);
    res.status(500).json({ error: err.message });
  }
});
