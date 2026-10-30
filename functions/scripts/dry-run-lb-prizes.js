#!/usr/bin/env node
'use strict';

// READ ONLY. For the most recent completed week and month of each board,
// prints who the shared prize helper would pay. It does not grant tickets
// or write marker docs.
//
//   node functions/scripts/dry-run-lb-prizes.js
//
// Auth: Application Default Credentials, or GOOGLE_APPLICATION_CREDENTIALS.
// Output uses truncated uids and public usernames. No emails, no raw IPs.
//
// Prize table the job would use:
//   XP week / month          top 10   25 / 100 OT
//   Quest week / month       top 10   25 / 100 OT   min 3 attempts
//   Prediction week / month  top 10   25 / 100 OT   min 5 / 15
// Prediction previously paid top 5 at 25 weekly and 50 monthly.
// A period that already has a winner history is labeled already-settled
// and is not a new grant.

const fs = require('fs');
const path = require('path');
const lb = require('../src/lbPrizes');
const ps = require('../src/predictionStats');
const { rewardBlocked } = require('../src/cipherClaim');

function assertReadOnlySource() {
    const src = fs.readFileSync(__filename, 'utf8');
    ['set', 'update', 'delete', 'commit', 'create', 'batch', 'add'].forEach(function (name) {
        const needle = '.' + name + '(';
        if (src.indexOf(needle) !== -1) throw new Error('dry-run must not write: ' + needle);
    });
}

function line(rank, row, tickets) {
    const who = lb.truncateUid(row.uid) + '  ' + lb.publicName(row.username);
    if (row.banned) return '  ' + rank + '  ' + who + '  skipped banned  0 OT';
    const score = row.score == null ? '' : '  score ' + row.score;
    return '  ' + rank + '  ' + who + '  ' + tickets + ' OT' + score;
}

function printBoard(title, rows, tickets, note) {
    console.log('');
    console.log(title);
    if (note) console.log('  ' + note);
    if (!rows.length) {
        console.log('  (nobody)');
        return;
    }
    rows.forEach(function (row, i) {
        console.log(line(row.rank || (i + 1), row, row.banned ? 0 : tickets));
    });
}

async function readAll(db, refs) {
    const out = [];
    for (let i = 0; i < refs.length; i += 10) {
        const part = refs.slice(i, i + 10);
        if (!part.length) continue;
        if (typeof db.getAll === 'function') {
            const rows = await db.getAll.apply(db, part);
            rows.forEach(function (row) { out.push(row); });
        } else {
            for (let j = 0; j < part.length; j++) out.push(await part[j].get());
        }
    }
    return out;
}

async function pageUsers(db, admin, onDoc) {
    let last = null;
    let scanned = 0;
    while (true) {
        let query = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(200);
        if (last) query = query.startAfter(last);
        const snap = await query.get();
        if (snap.empty) break;
        for (let i = 0; i < snap.docs.length; i++) {
            scanned++;
            await onDoc(snap.docs[i]);
        }
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < 200) break;
    }
    return scanned;
}

async function xpFromDays(db, admin, days) {
    const totals = [];
    const scanned = await pageUsers(db, admin, async function (doc) {
        const user = doc.data() || {};
        if (!((Number(user.points) || 0) > 0 || (Number(user.weeklyXP) || 0) > 0 || (Number(user.monthlyXP) || 0) > 0)) return;
        const refs = days.map(function (day) { return doc.ref.collection('daily_points').doc(day); });
        const snaps = await readAll(db, refs);
        let xp = 0;
        snaps.forEach(function (snap) {
            if (snap && snap.exists) xp += Number((snap.data() || {}).total) || 0;
        });
        if (xp <= 0) return;
        totals.push({
            uid: doc.id,
            username: user.username,
            xp: xp,
            score: xp,
            ghostMode: user.ghostMode === true,
            banned: rewardBlocked(user, null),
            user: user
        });
    });
    totals.sort(function (a, b) { return b.xp - a.xp; });
    const top = totals.filter(function (row) { return row.ghostMode !== true; }).slice(0, 40);
    const ledgers = {};
    const pubs = {};
    const ledgerSnaps = await readAll(db, top.map(function (row) { return db.collection('faucet_ledger').doc(row.uid); }));
    const pubSnaps = await readAll(db, top.map(function (row) { return db.collection('public_profiles').doc(row.uid); }));
    ledgerSnaps.forEach(function (snap) { ledgers[snap.id] = snap.exists ? (snap.data() || {}) : {}; });
    pubSnaps.forEach(function (snap) { pubs[snap.id] = snap.exists ? (snap.data() || {}) : {}; });
    const shown = [];
    top.forEach(function (row) {
        const pub = pubs[row.uid] || {};
        if (row.ghostMode || pub.ghostMode === true) return;
        shown.push({
            uid: row.uid,
            username: row.username || pub.username,
            score: row.xp,
            banned: rewardBlocked(row.user, ledgers[row.uid] || {})
        });
    });
    return {
        scanned: scanned,
        rows: shown.slice(0, lb.TOP).map(function (row, i) {
            row.rank = i + 1;
            return row;
        })
    };
}

async function predictionFromRecords(db, start, end, period) {
    let snap;
    try {
        snap = await db.collection('prediction_records').where('resolvedAt', '>=', start).where('resolvedAt', '<', end).get();
    } catch (err) {
        return { error: err && err.message ? err.message : String(err), rows: [] };
    }
    const byUid = {};
    snap.forEach(function (doc) {
        const rec = doc.data() || {};
        const when = ps.timeMs(rec.resolvedAt);
        if (!(when >= start && when < end)) return;
        const uid = rec.uid || '';
        if (!uid) return;
        const row = byUid[uid] || { uid: uid, correct: 0, total: 0, reachedAt: 0 };
        row.total += 1;
        if (rec.correct === true || rec.outcome === 'correct') row.correct += 1;
        if (when >= row.reachedAt) row.reachedAt = when;
        byUid[uid] = row;
    });
    const list = Object.keys(byUid).map(function (uid) {
        const row = byUid[uid];
        row.accuracy = ps.accuracyOf(row.correct, row.total);
        row.username = 'Anon';
        return row;
    });
    const ids = list.filter(function (row) { return row.total >= ps.minimumFor(period); }).map(function (row) { return row.uid; });
    const users = {};
    const ledgers = {};
    const pubs = {};
    const userSnaps = await readAll(db, ids.map(function (uid) { return db.collection('users').doc(uid); }));
    const ledgerSnaps = await readAll(db, ids.map(function (uid) { return db.collection('faucet_ledger').doc(uid); }));
    const pubSnaps = await readAll(db, ids.map(function (uid) { return db.collection('public_profiles').doc(uid); }));
    userSnaps.forEach(function (s) { users[s.id] = s.exists ? (s.data() || {}) : {}; });
    ledgerSnaps.forEach(function (s) { ledgers[s.id] = s.exists ? (s.data() || {}) : {}; });
    pubSnaps.forEach(function (s) { pubs[s.id] = s.exists ? (s.data() || {}) : {}; });
    list.forEach(function (row) {
        const user = users[row.uid] || {};
        const pub = pubs[row.uid] || {};
        const ledger = ledgers[row.uid] || {};
        row.username = user.username || pub.username || 'Anon';
        row.ghostMode = user.ghostMode === true || pub.ghostMode === true;
        row.banned = rewardBlocked(user, ledger);
        row.ban_reason = user.ban_reason || '';
        row.satsDisabled = user.satsDisabled === true;
        row.ledgerBanned = ledger.banned === true;
    });
    const rows = ps.selectBoard(list, period).slice(0, lb.TOP).map(function (row) {
        return {
            uid: row.uid,
            username: row.username,
            rank: row.rank,
            score: (row.correct || 0) + '/' + (row.total || 0),
            banned: row.banned === true
        };
    });
    return { rows: rows, count: snap.size };
}

async function settledNote(db, collection, id) {
    const snap = await db.collection(collection).doc(id).get();
    if (!snap.exists) return '';
    if (lb.legacySettled(snap.data() || {})) return 'history doc exists — already settled, not a new grant';
    return 'history doc exists but is not marked settled';
}

async function main() {
    assertReadOnlySource();
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.applicationDefault() });
    const db = admin.firestore();
    const now = new Date();
    const week = lb.xpClosedWeek(now);
    const month = lb.xpClosedMonth(now);
    const weekJob = new Date(week.end);
    const monthJob = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    console.log('Orange Ticket board prizes — dry run');
    console.log('Would pay top ' + lb.TOP + ': week ' + lb.TICKETS.weekly + ' OT, month ' + lb.TICKETS.monthly + ' OT.');
    console.log('Prediction previously paid top ' + lb.PREDICTION_BEFORE.weekly.top + ' at ' + lb.PREDICTION_BEFORE.weekly.tickets + ' weekly and top ' + lb.PREDICTION_BEFORE.monthly.top + ' at ' + lb.PREDICTION_BEFORE.monthly.tickets + ' monthly.');

    const xpWeek = await xpFromDays(db, admin, week.days);
    const xpWeekNote = await settledNote(db, 'leaderboard_winners', week.periodKey);
    printBoard(
        'XP week ' + week.periodKey + '  (' + week.days[0] + ' .. ' + week.days[week.days.length - 1] + ', scanned ' + xpWeek.scanned + ' users)',
        xpWeek.rows,
        lb.TICKETS.weekly,
        xpWeekNote || 'reconstructed from daily_points for the closed ISO week'
    );

    const oldWeek = lb.legacyXpWeekKey(weekJob);
    if (oldWeek !== week.periodKey) {
        const oldNote = await settledNote(db, 'leaderboard_winners', oldWeek);
        if (oldNote) console.log('  legacy week key ' + oldWeek + ': ' + oldNote);
    }

    const xpMonth = await xpFromDays(db, admin, month.days);
    const xpMonthNote = await settledNote(db, 'leaderboard_winners', month.periodKey);
    printBoard(
        'XP month ' + month.periodKey + '  (offset days, 5h skew vs 00:00 UTC)',
        xpMonth.rows,
        lb.TICKETS.monthly,
        xpMonthNote || 'reconstructed from daily_points'
    );

    const questWeek = await lb.loadQuestDisplay(db, 'weekly', weekJob.getTime());
    printBoard(
        'Quest week ' + questWeek.key,
        questWeek.rows,
        lb.TICKETS.weekly,
        'same rank as the server board, fresh from quest_lb_stats. A quest after the week rolled drops that player off this key.'
    );
    const questMonth = await lb.loadQuestDisplay(db, 'monthly', monthJob.getTime());
    printBoard(
        'Quest month ' + questMonth.key + '  (job clock ' + monthJob.toISOString() + ')',
        questMonth.rows,
        lb.TICKETS.monthly,
        'Eastern month that the 1st 00:00 UTC job pays. Players who already rolled to the next month are not in this key.'
    );

    const predWeek = await predictionFromRecords(db, week.start, week.end, 'weekly');
    const predWeekNote = await settledNote(db, 'prediction_payouts', week.periodKey);
    printBoard(
        'Prediction week ' + week.periodKey,
        predWeek.rows,
        lb.TICKETS.weekly,
        predWeek.error ? ('record query failed: ' + predWeek.error) : (predWeekNote || ('from ' + (predWeek.count || 0) + ' prediction_records'))
    );
    const predMonth = await predictionFromRecords(db, month.start, month.end, 'monthly');
    const predMonthNote = await settledNote(db, 'prediction_payouts', month.periodKey);
    printBoard(
        'Prediction month ' + month.periodKey,
        predMonth.rows,
        lb.TICKETS.monthly,
        predMonth.error ? ('record query failed: ' + predMonth.error) : (predMonthNote || ('from ' + (predMonth.count || 0) + ' prediction_records'))
    );
}

if (require.main === module) {
    main().catch(function (err) {
        console.error(err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = { assertReadOnlySource: assertReadOnlySource };
