#!/usr/bin/env node
'use strict';
// Titles & Flair + collections rebalance migration.
// Default is a DRY RUN: reads only and prints counts. --apply writes, and only
// with CONFIRM_PROJECT set to the project id it is pointed at.
//
// What apply does per user:
//  - grandfatheredTitles: titles the profile lists today that the server rules
//    do not re-derive (kept so nobody loses a title).
//  - grandfatheredFlair: the current chatFlairEmoji when the server rules do
//    not re-derive it.
//  - earnedTitles / earnedFlair recomputed by titleFlair.earnedFor.
//  - grants collection bonuses newly complete under the new layout
//    (collectionBonus.grantCollectionBonus, no chat congrats).
//
// Usage: FIREBASE_SA_JSON=... node functions/scripts/migrate_titles_collections.js [--apply]

const admin = require('firebase-admin');
const collectionBonus = require('../src/collectionBonus');
const titleFlair = require('../src/titleFlair');

const APPLY = process.argv.indexOf('--apply') >= 0;
const sa = JSON.parse(process.env.FIREBASE_SA_JSON || '{}');
if (!sa.project_id) { console.error('FIREBASE_SA_JSON missing'); process.exit(1); }
if (APPLY && process.env.CONFIRM_PROJECT !== sa.project_id) {
    console.error('Refusing to write: set CONFIRM_PROJECT to the target project id.');
    process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

function inc(map, key) { map[key] = (map[key] || 0) + 1; }

(async function main() {
    const now = Date.now();
    const catalog = titleFlair.titleCatalog();
    const flairAll = titleFlair.flairCatalog();
    const cols = collectionBonus.collections();
    const c = {
        users: 0, activeTitle: 0, activeTitleVerified: 0, activeTitleGrandfathered: 0, activeTitleUnknownId: 0,
        earnedTitlesHolders: 0, earnedTitleEntries: 0, earnedTitleVerified: 0, earnedTitleGrandfathered: 0, earnedTitleUnknownId: 0,
        flairSet: 0, flairVerified: 0, flairGrandfathered: 0, flairNotInCatalog: 0,
        chatFlairOwners: 0, chatFlairOwnersMissingEmoji: 0,
        usersGainingTitles: 0, newCollectionBonuses: 0, usersWithNewBonus: 0, metaCompletedNow: 0,
        writesPlanned: 0, writesDone: 0,
    };
    const newByCol = {};
    const metaId = 'col_proof_of_everything';
    let cursor = null;
    for (;;) {
        let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(300);
        if (cursor) q = q.startAfter(cursor);
        const snap = await q.get();
        if (snap.empty) break;
        await Promise.all(snap.docs.map(async function (d) {
            const u = d.data() || {};
            c.users++;
            const aw = await d.ref.collection('badge_awards').get();
            const rows = {};
            aw.forEach(function (x) { rows[x.id] = x.data() || {}; });
            const held = collectionBonus.collectionHeldIds(u, rows);
            // Collections newly complete under the new layout (core first, then meta).
            const newly = [];
            cols.filter(function (col) { return col.kind !== 'meta'; }).forEach(function (col) {
                if (held.has(col.bonusId)) return;
                const req = collectionBonus.requiredMembers(col);
                if (req.length && req.every(function (id) { return held.has(id); })) { newly.push(col.id); held.add(col.bonusId); }
            });
            const meta = collectionBonus.collectionById(metaId);
            if (meta && !held.has(meta.bonusId) && meta.badgeIds.every(function (id) { return held.has(id); })) {
                newly.push(metaId); held.add(meta.bonusId); c.metaCompletedNow++;
            }
            if (newly.length) { c.usersWithNewBonus++; c.newCollectionBonuses += newly.length; newly.forEach(function (id) { inc(newByCol, id); }); }

            const earned = titleFlair.earnedFor(Object.assign({}, u, { grandfatheredTitles: [], grandfatheredFlair: [] }), held, now);
            const keepTitles = [];
            const listed = Array.isArray(u.earnedTitles) ? u.earnedTitles.filter(function (x) { return typeof x === 'string'; }) : [];
            if (listed.length) c.earnedTitlesHolders++;
            listed.forEach(function (tid) {
                c.earnedTitleEntries++;
                if (!catalog[tid]) { c.earnedTitleUnknownId++; return; }
                if (earned.titles.indexOf(tid) >= 0) c.earnedTitleVerified++;
                else { c.earnedTitleGrandfathered++; keepTitles.push(tid); }
            });
            const active = typeof u.activeTitle === 'string' && u.activeTitle ? u.activeTitle : '';
            if (active) {
                c.activeTitle++;
                if (!catalog[active]) c.activeTitleUnknownId++;
                else if (earned.titles.indexOf(active) >= 0) c.activeTitleVerified++;
                else { c.activeTitleGrandfathered++; if (keepTitles.indexOf(active) < 0) keepTitles.push(active); }
            }
            const keepFlair = [];
            const flair = typeof u.chatFlairEmoji === 'string' ? u.chatFlairEmoji.trim() : '';
            if (flair) {
                c.flairSet++;
                if (!flairAll.has(flair)) c.flairNotInCatalog++;
                else if (earned.flair.indexOf(flair) >= 0) c.flairVerified++;
                else { c.flairGrandfathered++; keepFlair.push(flair); }
            }
            const owned = Array.isArray(u.ownedCosmetics) && u.ownedCosmetics.indexOf('chat_flair') >= 0;
            if (owned) { c.chatFlairOwners++; if (!flair) c.chatFlairOwnersMissingEmoji++; }
            const gained = earned.titles.filter(function (t) { return listed.indexOf(t) < 0; });
            if (gained.length) c.usersGainingTitles++;

            const needsWrite = keepTitles.length || keepFlair.length || gained.length || newly.length;
            if (!needsWrite) return;
            c.writesPlanned++;
            if (!APPLY) return;
            for (let i = 0; i < newly.length; i++) {
                await collectionBonus.grantCollectionBonus(db, admin, d.id, newly[i], { postChat: false });
            }
            const patch = {};
            if (keepTitles.length) patch.grandfatheredTitles = keepTitles;
            if (keepFlair.length) patch.grandfatheredFlair = keepFlair;
            if (Object.keys(patch).length) await d.ref.set(patch, { merge: true });
            await titleFlair.handle(db, admin, d.id, { action: 'list' }, now);
            c.writesDone++;
        }));
        cursor = snap.docs[snap.docs.length - 1];
    }
    console.log(APPLY ? 'APPLY' : 'DRY RUN (no writes)');
    console.log(JSON.stringify(c, null, 1));
    console.log('new collection bonuses by collection: ' + JSON.stringify(newByCol));
    process.exit(0);
})().catch(function (e) { console.error(e && e.message); process.exit(1); });
