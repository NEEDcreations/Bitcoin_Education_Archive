#!/usr/bin/env node
'use strict';

// Rekey faucet IP docs from raw addresses to HMACs.
// Dry-run is the default. Pass --apply to write.
// Do not run this against production until Phil has reviewed a dry-run.
// The script prints counts only. It does not print IPs, HMAC secrets, or emails.

const path = require('path');
const Module = require('module');
Module.globalPaths.unshift(path.join(__dirname, '..', 'functions', 'node_modules'));

const ipHmac = require('../functions/src/ipHmac');
const ipReputation = require('../functions/src/ipReputation');

function secretFromEnv() {
    return process.env.REFERRAL_IP_HMAC_SECRET || '';
}

function parseArgs(argv) {
    return { apply: argv.indexOf('--apply') !== -1 };
}

async function rekeyCollection(db, name, kind, secret, apply) {
    const snap = await db.collection(name).get();
    const counts = { seen: snap.size, rekey: 0, skip: 0, unparsed: 0, deleted: 0 };
    for (let i = 0; i < snap.docs.length; i++) {
        const doc = snap.docs[i];
        const plan = ipReputation.planDocRekey(doc.id, kind, secret);
        if (plan.action !== 'rekey') {
            if (plan.reason === 'unparsed') counts.unparsed++;
            else counts.skip++;
            continue;
        }
        counts.rekey++;
        if (!apply) continue;
        const dest = db.collection(name).doc(plan.to);
        const sourceData = doc.data();
        let removed = false;
        await db.runTransaction(async function(t) {
            const existing = await t.get(dest);
            const merged = ipReputation.mergeSlot(existing.exists ? existing.data() : null, sourceData);
            if (!ipReputation.slotCovers(merged, sourceData)) return;
            t.set(dest, merged);
            if (typeof t.delete === 'function') t.delete(doc.ref);
            removed = true;
        });
        if (!removed) continue;
        counts.deleted++;
    }
    return counts;
}

async function rekeySignals(db, secret, apply) {
    const snap = await db.collection('faucet_uid_signals').get();
    const counts = { seen: snap.size, update: 0, skip: 0 };
    for (let i = 0; i < snap.docs.length; i++) {
        const doc = snap.docs[i];
        const plan = ipReputation.planSignalFields(doc.data(), secret);
        const changed = Object.keys(plan.changes).length > 0 || plan.drop.length > 0;
        if (!changed) {
            counts.skip++;
            continue;
        }
        counts.update++;
        if (!apply) continue;
        const update = Object.assign({}, plan.changes);
        plan.drop.forEach(function(field) {
            update[field] = db._deleteField ? db._deleteField() : null;
        });
        if (db._deleteField) {
            await doc.ref.set(update, { merge: true });
        } else {
            const admin = require('firebase-admin');
            plan.drop.forEach(function(field) {
                update[field] = admin.firestore.FieldValue.delete();
            });
            await doc.ref.update(update);
        }
    }
    return counts;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const secret = secretFromEnv();
    if (secret.length < ipHmac.MIN_SECRET) {
        console.error('[migrate] set REFERRAL_IP_HMAC_SECRET (16+ characters). Nothing was read.');
        process.exit(1);
    }
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const mode = args.apply ? 'apply' : 'dry-run';
    console.log('[migrate] mode=' + mode);
    const ipCounts = await rekeyCollection(db, 'faucet_ip_log', 'ip', secret, args.apply);
    const rangeCounts = await rekeyCollection(db, 'faucet_subnet_log', 'range', secret, args.apply);
    const signalCounts = await rekeySignals(db, secret, args.apply);
    console.log('[migrate] faucet_ip_log seen=' + ipCounts.seen + ' rekey=' + ipCounts.rekey + ' skip=' + ipCounts.skip + ' unparsed=' + ipCounts.unparsed + ' deleted=' + ipCounts.deleted);
    console.log('[migrate] faucet_subnet_log seen=' + rangeCounts.seen + ' rekey=' + rangeCounts.rekey + ' skip=' + rangeCounts.skip + ' unparsed=' + rangeCounts.unparsed + ' deleted=' + rangeCounts.deleted);
    console.log('[migrate] faucet_uid_signals seen=' + signalCounts.seen + ' update=' + signalCounts.update + ' skip=' + signalCounts.skip);
    if (!args.apply) console.log('[migrate] dry-run only. Re-run with --apply after review. Raw IP docs are deleted only after the HMAC copy is verified.');
    if (!args.apply) return;
    const unparsed = ipCounts.unparsed + rangeCounts.unparsed;
    const leftover = (ipCounts.rekey - ipCounts.deleted) + (rangeCounts.rekey - rangeCounts.deleted);
    if (unparsed > 0 || leftover > 0) process.exit(1);
}

if (require.main === module) {
    main().catch(function(err) {
        console.error('[migrate] failed');
        process.exit(1);
    });
}

module.exports = {
    parseArgs: parseArgs,
    rekeyCollection: rekeyCollection,
    rekeySignals: rekeySignals,
};
