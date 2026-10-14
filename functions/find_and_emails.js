const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'bitcoin-education-archive' });
const db = admin.firestore();

async function run() {
  // ---- 1. Full sweep for smoke weed comment ----
  const allCols = await db.listCollections();

  for (const col of allCols) {
    let last = null;
    while (true) {
      let q = col.orderBy('__name__').limit(500);
      if (last) q = q.startAfter(last);
      const snap = await q.get().catch(() => null);
      if (!snap || snap.empty) break;
      snap.forEach(doc => {
        const raw = JSON.stringify(doc.data()).toLowerCase();
        if (raw.includes('smoke weed') || raw.includes('weed everyday')) {
          console.log('FOUND col=' + col.id + ' id=' + doc.id);
          console.log(JSON.stringify(doc.data()).substring(0, 500));
        }
      });
      last = snap.docs[snap.docs.length - 1];
      if (snap.size < 500) break;
    }
  }
  console.log('COMMENT SEARCH DONE');

  // ---- 2. Email export to file ----
  const emails = [];
  let last = null;
  while (true) {
    let q = db.collection('users').orderBy('__name__').limit(500);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    snap.forEach(doc => {
      const e = (doc.data().email || '').trim().toLowerCase();
      if (e && e.includes('@') && !e.includes('privaterelay') && !e.includes('anonymous')) emails.push(e);
    });
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 500) break;
  }
  const unique = [...new Set(emails)].sort();
  require('fs').writeFileSync('/tmp/user_emails_bcc.txt', unique.join(', '));
  console.log('EMAILS:', unique.length, '-> /tmp/user_emails_bcc.txt');
}

run().catch(e => { console.error(e.message); process.exit(1); });
