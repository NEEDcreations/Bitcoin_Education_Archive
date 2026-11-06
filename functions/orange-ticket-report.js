#!/usr/bin/env node
'use strict';

// READ ONLY. Prints users whose orangeTickets balance is above an upper bound
// of legitimate server grants. It does not modify balances. The owner decides
// what to do with the rows.
//
//   node functions/orange-ticket-report.js
//
// Upper bound (deliberately generous, so a row means the balance cannot be
// explained by the grants below):
//   - 50 per verified referrals doc where this uid is referrer or referred
//   - streak milestone tickets re-earned on every cycle:
//       floor(ageDays/7)*3 + floor(ageDays/30)*10 + floor(ageDays/100)*25
//       + floor(ageDays/365)*50
//     Missing created date uses 2000 days.
//   - If lastSpinDate is set: ageDays * 5 (max non-rare spin) + 1000
//     (one jackpot). A second jackpot, or jackpots on bonus spins, can flag
//     a legitimate account. Client-side ticket phrases are not counted.
//   - +1 per daily_action_counts doc ending _say_hi or _donate_ticket
//   - +count on docs ending _pts_to_tickets
//   - opened gifts: stored ticket count capped at 3, or 3 when the reward
//     type was not copied onto the gift doc
//   - +10 per locked cipher this uid opened (consolation max)
//   - prediction_payouts winner docs + leaderboard_winners ticketsPerWinner
//
// Output is aggregate only: uid, balance, estimatedLegitMax. No emails.

const fs = require('fs');

function assertReadOnlySource() {
    const src = fs.readFileSync(__filename, 'utf8');
    ['set', 'update', 'delete', 'commit', 'create', 'batch', 'add'].forEach(function (name) {
        const needle = '.' + name + '(';
        if (src.indexOf(needle) !== -1) {
            throw new Error('orange-ticket-report is read only and must not contain write calls');
        }
    });
}

function accountAgeDays(data, nowMs) {
    const created = data && (data.created || data.createdAt || data.joinDate);
    let ms = null;
    if (created && typeof created.toDate === 'function') ms = created.toDate().getTime();
    else if (typeof created === 'number') ms = created < 1e12 ? created * 1000 : created;
    else if (typeof created === 'string') ms = Date.parse(created);
    if (!ms || isNaN(ms)) return 2000;
    return Math.max(1, Math.floor((nowMs - ms) / 86400000) + 1);
}

function estimateLegitMax(input) {
    const src = input || {};
    const days = src.accountAgeDays == null ? 2000 : Math.max(0, src.accountAgeDays);
    let max = 0;
    max += Math.max(0, Number(src.referralTickets) || 0);
    max += Math.floor(days / 7) * 3;
    max += Math.floor(days / 30) * 10;
    max += Math.floor(days / 100) * 25;
    max += Math.floor(days / 365) * 50;
    if (src.everSpun) {
        max += days * 5;
        max += 1000;
    }
    max += Math.max(0, Number(src.sayHiDays) || 0);
    max += Math.max(0, Number(src.donateTickets) || 0);
    max += Math.max(0, Number(src.pointsToTickets) || 0);
    max += Math.max(0, Number(src.giftTickets) || 0);
    max += Math.max(0, Number(src.openedCiphers) || 0) * 10;
    max += Math.max(0, Number(src.predictionTickets) || 0);
    max += Math.max(0, Number(src.leaderboardTickets) || 0);
    return max;
}

function giftTicketBound(data) {
    const src = data || {};
    if (src.status !== 'opened') return 0;
    const reward = src.rewardData || src.reward || {};
    if (reward.rewardType === 'tickets' || reward.closetDupe) {
        const n = Number(reward.ticketCount) || 1;
        return Math.max(1, Math.min(3, n));
    }
    if (!reward.rewardType) return 3;
    return 0;
}

async function pageUsers(db, onDoc) {
    let last = null;
    for (;;) {
        let q = db.collection('users').orderBy('__name__').limit(300);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        for (const doc of snap.docs) await onDoc(doc);
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < 300) break;
    }
}

async function safeCount(run, warnings, label) {
    try {
        return await run();
    } catch (err) {
        warnings.push(label + ': ' + (err && err.message ? err.message : err));
        return null;
    }
}

async function main() {
    assertReadOnlySource();
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp({ projectId: 'bitcoin-education-archive' });
    const db = admin.firestore();
    const nowMs = Date.now();
    const warnings = [];

    const predictionByUid = {};
    const predictionSnap = await safeCount(function () {
        return db.collectionGroup('winners').get();
    }, warnings, 'prediction winners');
    if (predictionSnap) {
        predictionSnap.forEach(function (doc) {
            const path = doc.ref.path || '';
            if (path.indexOf('prediction_payouts/') !== 0) return;
            const data = doc.data() || {};
            if (data.skipped) return;
            const uid = doc.id;
            predictionByUid[uid] = (predictionByUid[uid] || 0) + (Number(data.tickets) || 0);
        });
    }

    const leaderboardByUid = {};
    const boardSnap = await safeCount(function () {
        return db.collection('leaderboard_winners').get();
    }, warnings, 'leaderboard winners');
    if (boardSnap) {
        boardSnap.forEach(function (doc) {
            const data = doc.data() || {};
            const each = Number(data.ticketsPerWinner) || 0;
            (data.winners || []).forEach(function (winner) {
                if (!winner || !winner.uid) return;
                leaderboardByUid[winner.uid] = (leaderboardByUid[winner.uid] || 0) + each;
            });
        });
    }

    let scanned = 0;
    let flagged = 0;
    await pageUsers(db, async function (doc) {
        scanned++;
        const data = doc.data() || {};
        const balance = Number(data.orangeTickets) || 0;
        if (balance <= 0) return;
        const uid = doc.id;

        let referralTickets = 0;
        const referralGrants = await safeCount(async function () {
            const asReferrer = await db.collection('referrals').where('referrerUid', '==', uid).where('ticketsAwarded', '==', true).get();
            const asReferred = await db.collection('referrals').where('referredUid', '==', uid).where('ticketsAwarded', '==', true).get();
            return asReferrer.size + asReferred.size;
        }, warnings, 'referrals ' + uid);
        if (referralGrants == null) {
            referralTickets = (Number(data.referralTicketsEarned) || 0) + (data.referralVerified ? 50 : 0);
        } else {
            referralTickets = referralGrants * 50;
        }

        let sayHiDays = 0;
        let donateTickets = 0;
        let pointsToTickets = 0;
        const counts = await safeCount(function () {
            return db.collection('users').doc(uid).collection('daily_action_counts').get();
        }, warnings, 'daily counts ' + uid);
        if (counts) {
            counts.forEach(function (row) {
                const id = row.id || '';
                if (id.endsWith('_say_hi')) sayHiDays += 1;
                else if (id.endsWith('_donate_ticket')) donateTickets += 1;
                else if (id.endsWith('_pts_to_tickets')) pointsToTickets += Number(row.data().count) || 0;
            });
        }

        let giftTickets = 0;
        const gifts = await safeCount(function () {
            return db.collection('gifts').where('ownerId', '==', uid).get();
        }, warnings, 'gifts ' + uid);
        if (gifts) gifts.forEach(function (row) { giftTickets += giftTicketBound(row.data()); });

        let openedCiphers = 0;
        const ciphers = await safeCount(function () {
            return db.collection('locked_ciphers').where('openedBy', '==', uid).get();
        }, warnings, 'ciphers ' + uid);
        if (ciphers) openedCiphers = ciphers.size;

        const estimatedLegitMax = estimateLegitMax({
            accountAgeDays: accountAgeDays(data, nowMs),
            everSpun: !!data.lastSpinDate,
            referralTickets: referralTickets,
            sayHiDays: sayHiDays,
            donateTickets: donateTickets,
            pointsToTickets: pointsToTickets,
            giftTickets: giftTickets,
            openedCiphers: openedCiphers,
            predictionTickets: predictionByUid[uid] || 0,
            leaderboardTickets: leaderboardByUid[uid] || 0,
        });
        if (balance > estimatedLegitMax) {
            flagged++;
            console.log(JSON.stringify({ uid: uid, balance: balance, estimatedLegitMax: estimatedLegitMax }));
        }
    });

    console.log(JSON.stringify({
        scanned: scanned,
        flagged: flagged,
        warnings: warnings.length,
    }));
    if (warnings.length) {
        console.error('warnings ' + warnings.length);
        warnings.slice(0, 20).forEach(function (line) { console.error(line); });
    }
}

module.exports = {
    estimateLegitMax: estimateLegitMax,
    giftTicketBound: giftTicketBound,
    accountAgeDays: accountAgeDays,
};

if (require.main === module) {
    main().catch(function (err) {
        console.error(err && err.stack ? err.stack : err);
        process.exit(1);
    });
}
