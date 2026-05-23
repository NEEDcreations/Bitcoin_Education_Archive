const admin = require('firebase-admin');
const functions = require('firebase-functions');
exports.lookupYohan = functions.https.onRequest(async (req, res) => {
    try {
        const db = admin.firestore();
        const snap1 = await db.collection('users').where('email', '==', 'yohanreta9@gmail.com').get();
        const snap2 = await db.collection('users').where('displayName', '==', 'yohan9').get();
        let out = [];
        snap1.forEach(d => out.push({uid: d.id, ...d.data()}));
        snap2.forEach(d => { if (!out.find(x => x.uid === d.id)) out.push({uid: d.id, ...d.data()}); });
        res.json(out);
    } catch(e) { res.status(500).json({error: e.toString()}); }
});
