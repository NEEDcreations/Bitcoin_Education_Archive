#!/usr/bin/env node
/**
 * Read-only impact of aligning referral badges to Maxi tiers.
 * Prints counts only. Does not write. There is no --apply.
 *
 *   node functions/scripts/backfill_referral_badges.js
 */
'use strict';

const path = require('path');
const tiers = require('../referral-tiers');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'bitcoin-education-archive';
const PAGE = 300;
const BADGE_IDS = ['referral_1', 'referral_5', 'referral_10', 'referral_25', 'referral_50', 'referral_100'];

function loadAdmin() {
    try {
        return require('firebase-admin');
    } catch (err) {
        return require(path.join(__dirname, '..', 'node_modules', 'firebase-admin'));
    }
}

function heldOf(data) {
    const held = {};
    ['visibleBadges', 'badges', 'hiddenBadges', 'earnedHidden'].forEach(function (key) {
        const value = data[key];
        if (!Array.isArray(value)) return;
        value.forEach(function (item) {
            const id = typeof item === 'string' ? item : (item && item.id);
            if (typeof id === 'string') held[id] = true;
        });
    });
    return held;
}

async function loadUsers(db, admin) {
    const users = [];
    let last = null;
    for (;;) {
        let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        snap.docs.forEach(function (doc) {
            const data = doc.data() || {};
            users.push({
                uid: doc.id,
                points: data.points || 0,
                banned: data.banned === true,
                satsDisabled: data.satsDisabled === true,
                deleted: data.deleted === true,
                ledgerBanned: data.ledgerBanned === true,
                referralCount: Number(data.referralCount) || 0,
                held: heldOf(data),
            });
        });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    return users;
}

async function loadReferrals(db, admin) {
    const out = [];
    let last = null;
    for (;;) {
        let q = db.collection('referrals').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        snap.docs.forEach(function (doc) {
            const data = doc.data() || {};
            out.push(Object.assign({ id: doc.id }, data));
        });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    return out;
}

async function loadBannedLedgers(db, admin) {
    const ledgers = {};
    let last = null;
    for (;;) {
        let q = db.collection('faucet_ledger').where('banned', '==', true).orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        snap.docs.forEach(function (doc) { ledgers[doc.id] = { banned: true }; });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    return ledgers;
}

function maxiCounts(users, referrals, ledgers) {
    const byUid = {};
    users.forEach(function (user) { if (user && user.uid) byUid[user.uid] = user; });
    const grouped = {};
    referrals.forEach(function (referral) {
        if (!referral) return;
        const referrerUid = String(referral.referrerUid || '');
        if (!referrerUid) return;
        if (!grouped[referrerUid]) grouped[referrerUid] = [];
        const referredUid = tiers.referredUidOf(referral);
        grouped[referrerUid].push({
            referral: referral,
            referee: referredUid && byUid[referredUid] ? byUid[referredUid] : null,
            ledger: referredUid && ledgers[referredUid] ? ledgers[referredUid] : null,
        });
    });
    const counts = {};
    Object.keys(grouped).forEach(function (id) {
        counts[id] = tiers.countCreditedMaxi(grouped[id]);
    });
    return counts;
}

function interesting(user, maxi) {
    if (maxi > 0 || user.referralCount > 0) return true;
    return BADGE_IDS.some(function (id) { return user.held[id] === true; });
}

async function main() {
    const admin = loadAdmin();
    if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
    const db = admin.firestore();
    const users = await loadUsers(db, admin);
    const referrals = await loadReferrals(db, admin);
    const ledgers = await loadBannedLedgers(db, admin);
    const counts = maxiCounts(users, referrals, ledgers);
    const rows = [];
    users.forEach(function (user) {
        const maxi = counts[user.uid] || 0;
        if (!interesting(user, maxi)) return;
        rows.push({ maxiCount: maxi, lifetimeCount: user.referralCount, held: user.held });
    });
    const impact = tiers.badgeImpact(rows);
    console.log('[referral-badges] mode=dry-run');
    console.log('[referral-badges] users=' + users.length);
    console.log('[referral-badges] considered=' + rows.length);
    console.log('[referral-badges] referralDocs=' + referrals.length);
    console.log('[referral-badges] retiredHeld=' + impact.retiredHeld);
    tiers.badgeIds().forEach(function (id) {
        console.log('[referral-badges] ' + id
            + ' gain=' + impact.gain[id]
            + ' loseIfRevoked=' + impact.loseIfRevoked[id]
            + ' already=' + impact.already[id]);
    });
}

main().catch(function (err) {
    console.error('[referral-badges]', err && err.message ? err.message : err);
    process.exit(1);
});
