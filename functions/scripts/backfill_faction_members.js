#!/usr/bin/env node
'use strict';
// Counts players per faction and writes members_cyber_hornets and
// members_honey_badgers on satoshiFavor/factionTotals. Dry run by default:
// it prints counts only. --apply writes the two counters and nothing else.
// Scores, join times and bonus windows are not touched. Existing players get
// no join bonus.
//   node functions/scripts/backfill_faction_members.js [--apply]
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

(async function main() {
    const counts = { cyber_hornets: 0, honey_badgers: 0 };
    for (const f of Object.keys(counts)) {
        const snap = await db.collection('users').where('faction', '==', f).count().get();
        counts[f] = snap.data().count;
    }
    const totals = (await db.collection('satoshiFavor').doc('factionTotals').get()).data() || {};
    console.log('mode: ' + (APPLY ? 'APPLY' : 'dry run'));
    console.log('members_cyber_hornets: ' + (totals.members_cyber_hornets || 0) + ' -> ' + counts.cyber_hornets);
    console.log('members_honey_badgers: ' + (totals.members_honey_badgers || 0) + ' -> ' + counts.honey_badgers);
    if (!APPLY) return;
    await db.collection('satoshiFavor').doc('factionTotals').set({
        members_cyber_hornets: counts.cyber_hornets,
        members_honey_badgers: counts.honey_badgers,
    }, { merge: true });
    console.log('written');
})().catch((e) => { console.error(e && e.message); process.exit(1); });
