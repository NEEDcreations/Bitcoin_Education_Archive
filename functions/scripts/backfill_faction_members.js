#!/usr/bin/env node
'use strict';
// Counts players per faction and writes members_cyber_hornets and
// members_honey_badgers on the private doc satoshiFavor/factionMembers.
// Dry run by default: it prints counts only. --apply writes the two counters
// and updatedAt. It does not touch satoshiFavor/factionTotals, race scores,
// join times, or bonus windows. Existing players get no join bonus.
// Removing the old public fields is a separate one-time script:
//   node functions/scripts/seed_faction_members_private.js [--apply]
//   node functions/scripts/backfill_faction_members.js [--apply]
const admin = require('../src/firebaseAdmin.js');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

(async function main() {
    const counts = { cyber_hornets: 0, honey_badgers: 0 };
    for (const f of Object.keys(counts)) {
        const snap = await db.collection('users').where('faction', '==', f).count().get();
        counts[f] = snap.data().count;
    }
    const priv = await db.collection('satoshiFavor').doc('factionMembers').get();
    const cur = priv.exists ? (priv.data() || {}) : {};
    console.log('mode: ' + (APPLY ? 'APPLY' : 'dry run'));
    console.log('doc: satoshiFavor/factionMembers');
    console.log('members_cyber_hornets: ' + (priv.exists ? (cur.members_cyber_hornets || 0) : 'missing') + ' -> ' + counts.cyber_hornets);
    console.log('members_honey_badgers: ' + (priv.exists ? (cur.members_honey_badgers || 0) : 'missing') + ' -> ' + counts.honey_badgers);
    if (!APPLY) return;
    await db.collection('satoshiFavor').doc('factionMembers').set({
        members_cyber_hornets: counts.cyber_hornets,
        members_honey_badgers: counts.honey_badgers,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('written');
})().catch((e) => { console.error(e && e.message); process.exit(1); });
