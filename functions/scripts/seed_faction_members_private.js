#!/usr/bin/env node
'use strict';
// One-time move of faction member counts off the public race doc.
// When satoshiFavor/factionMembers is missing, copy members_* from
// satoshiFavor/factionTotals onto that private doc. Then delete
// members_cyber_hornets and members_honey_badgers from factionTotals.
// An existing private doc is left alone so a later join is not overwritten
// by the old public counters. Race scores are not changed.
// Dry run by default. --apply writes. Do not run this from CI.
//
//   node functions/scripts/seed_faction_members_private.js
//   node functions/scripts/seed_faction_members_private.js --apply

const MEMBER_FIELDS = ['members_cyber_hornets', 'members_honey_badgers'];

function countOrZero(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
}

function planSeed(totals, privateExists, privateData) {
    const t = totals || {};
    const pub = {};
    let hasPublic = false;
    MEMBER_FIELDS.forEach(function (field) {
        if (t[field] !== undefined && t[field] !== null) hasPublic = true;
        pub[field] = countOrZero(t[field]);
    });
    const seed = !privateExists;
    return {
        seed: seed,
        seedDoc: seed ? {
            members_cyber_hornets: pub.members_cyber_hornets,
            members_honey_badgers: pub.members_honey_badgers,
        } : null,
        deleteFields: hasPublic ? MEMBER_FIELDS.slice() : [],
        privateExists: !!privateExists,
        publicCounts: pub,
        privateCounts: privateExists ? {
            members_cyber_hornets: countOrZero(privateData && privateData.members_cyber_hornets),
            members_honey_badgers: countOrZero(privateData && privateData.members_honey_badgers),
        } : null,
    };
}

async function main() {
    const admin = require('../src/firebaseAdmin.js');
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const APPLY = process.argv.includes('--apply');
    const totalsSnap = await db.collection('satoshiFavor').doc('factionTotals').get();
    const privateSnap = await db.collection('satoshiFavor').doc('factionMembers').get();
    const totals = totalsSnap.exists ? (totalsSnap.data() || {}) : {};
    const plan = planSeed(totals, privateSnap.exists, privateSnap.exists ? (privateSnap.data() || {}) : null);
    console.log('mode: ' + (APPLY ? 'APPLY' : 'dry run'));
    if (plan.seed) {
        console.log('seed satoshiFavor/factionMembers from factionTotals: ' +
            plan.seedDoc.members_cyber_hornets + ' cyber_hornets, ' +
            plan.seedDoc.members_honey_badgers + ' honey_badgers');
    } else {
        console.log('private doc exists; leave its counts (' +
            plan.privateCounts.members_cyber_hornets + ' cyber_hornets, ' +
            plan.privateCounts.members_honey_badgers + ' honey_badgers)');
    }
    console.log('delete from factionTotals: ' + (plan.deleteFields.length ? plan.deleteFields.join(', ') : '(none)'));
    if (!APPLY) return;
    if (plan.seed) {
        await db.collection('satoshiFavor').doc('factionMembers').set({
            members_cyber_hornets: plan.seedDoc.members_cyber_hornets,
            members_honey_badgers: plan.seedDoc.members_honey_badgers,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    if (plan.deleteFields.length && totalsSnap.exists) {
        const del = {};
        plan.deleteFields.forEach(function (field) {
            del[field] = admin.firestore.FieldValue.delete();
        });
        await db.collection('satoshiFavor').doc('factionTotals').update(del);
    }
    console.log('written');
}

if (require.main === module) {
    main().catch(function (e) {
        console.error(e && e.message);
        process.exit(1);
    });
}

module.exports = { planSeed: planSeed, MEMBER_FIELDS: MEMBER_FIELDS };
