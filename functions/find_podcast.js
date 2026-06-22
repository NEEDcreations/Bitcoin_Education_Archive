const admin = require('firebase-admin');
const serviceAccount = require('/root/simple-archive/functions/service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
    // Search for tracks matching the podcast description
    const snap = await db.collection('beats_tracks')
        .where('genre', '==', 'Indie')
        .get();
    snap.forEach(doc => {
        const d = doc.data();
        const title = (d.title || '').toLowerCase();
        const artist = (d.artist || d.authorName || '').toLowerCase();
        if (title.includes('adam curry') || title.includes('podcast 2.0') || title.includes('ep01') || artist.includes('literal')) {
            console.log('FOUND:', doc.id, JSON.stringify({title: d.title, artist: d.artist||d.authorName, genre: d.genre}));
        }
    });
    // Also search by title containing common podcast words
    const snap2 = await db.collection('beats_tracks').get();
    snap2.forEach(doc => {
        const d = doc.data();
        const title = (d.title || '').toLowerCase();
        const artist = (d.artist || d.authorName || '').toLowerCase();
        if (title.includes('adam curry') || title.includes('podcast 2.0') || title.includes('literal listener') || artist.includes('literal listener')) {
            console.log('MATCH:', doc.id, JSON.stringify({title: d.title, artist: d.artist||d.authorName, genre: d.genre}));
        }
    });
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
