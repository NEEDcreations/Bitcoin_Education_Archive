'use strict';

// One paid-once Orange Ticket payout for the weekly and monthly boards.
// XP, Quests, and Price Prediction all use this. A retry reads the marker
// and the per-winner doc and does not grant again.
//
// Prize table (every board):
//   weekly   top 10   25 OT    Monday 05:00 UTC
//   monthly  top 10  100 OT    1st 00:00 UTC
//                             (quest month is read at that clock; see below)
//
// Price Prediction previously paid top 5: 25 weekly and 50 monthly.
// A finished prediction_payouts doc, or any awardedUids, blocks a second pay.
//
// Ghost-mode players are left off the board, same as the public lists.
// Banned players stay in their display rank and get no prize. The next
// player does not move into that slot.

const ps = require('./predictionStats');
const questBoard = require('./questBoard');
const { rewardBlocked } = require('./cipherClaim');
const { offsetDateKey } = require('./offsetDay');
const rewardNotify = require('./rewardNotify');

const TOP = 10;
const TICKETS = { weekly: 25, monthly: 100 };

const PREDICTION_BEFORE = {
    weekly: { top: 5, tickets: 25, min: 5 },
    monthly: { top: 5, tickets: 50, min: 15 },
    alltime: { top: 0, tickets: 0, min: 10 }
};

function publicName(name) {
    const s = String(name || '').replace(/\s+/g, ' ').trim();
    if (!s || /^(anon|anonymous)$/i.test(s) || s.indexOf('@') !== -1) return 'Anon';
    return s.slice(0, 40);
}

function truncateUid(uid) {
    const s = String(uid || '');
    if (!s) return '';
    if (s.length <= 6) return s.slice(0, 2) + '…';
    return s.slice(0, 6) + '…';
}

function markerId(board, periodKey) {
    return String(board || '') + '_' + String(periodKey || '');
}

function legacyXpWeekKey(now) {
    const date = now instanceof Date ? now : new Date(now || Date.now());
    const year = date.getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 1));
    const weekNum = Math.ceil(((date - start) / 86400000 + start.getUTCDay() + 1) / 7);
    const prevWeek = weekNum - 1;
    return year + '-W' + String(prevWeek || 52).padStart(2, '0');
}

function closedQuestWeekKey(nowMs) {
    const now = Number(nowMs) || Date.now();
    const current = questBoard.weekKey(now);
    let t = now;
    for (let i = 0; i < 24 * 10; i++) {
        t -= 3600000;
        const key = questBoard.weekKey(t);
        if (key && key !== current) return key;
    }
    return '';
}

function closedQuestMonthKey(nowMs) {
    const now = Number(nowMs) || Date.now();
    const current = questBoard.monthKey(now);
    let t = now;
    for (let i = 0; i < 24 * 40; i++) {
        t -= 3600000;
        const key = questBoard.monthKey(t);
        if (key && key !== current) return key;
    }
    return '';
}

// Both jobs run at 05:00 UTC, which is at or after Eastern midnight.
// The week and the month to pay are the Eastern periods that just closed.
function questKeyForJob(period, nowMs) {
    const now = Number(nowMs) || Date.now();
    if (period === 'monthly') return closedQuestMonthKey(now);
    return closedQuestWeekKey(now);
}

function anchorForQuestKey(key, kind, nowMs) {
    const fn = kind === 'month' ? questBoard.monthKey : questBoard.weekKey;
    let t = Number(nowMs) || Date.now();
    if (fn(t) === key) return t;
    for (let i = 0; i < 24 * 45; i++) {
        t -= 3600000;
        if (fn(t) === key) return t;
    }
    return Number(nowMs) || Date.now();
}

function xpClosedWeek(now) {
    const end = ps.weekStartMs(now);
    const start = end - 7 * 86400000;
    const days = [];
    for (let i = 0; i < 7; i++) days.push(offsetDateKey(start + i * 86400000 + 6 * 3600000));
    return {
        periodKey: ps.previousWeekKey(end),
        start: start,
        end: end,
        days: days
    };
}

function xpClosedMonth(now) {
    const date = now instanceof Date ? now : new Date(now || Date.now());
    const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1);
    const days = [];
    for (let t = start; t < end; t += 86400000) days.push(offsetDateKey(t + 6 * 3600000));
    return {
        periodKey: ps.previousMonthKey(new Date(end)),
        start: start,
        end: end,
        days: days
    };
}

function legacySettled(data) {
    if (!data) return false;
    if (data.status === 'complete') return true;
    if (Array.isArray(data.awardedUids) && data.awardedUids.length) return true;
    if (Array.isArray(data.winners) && data.winners.length) return true;
    if (Array.isArray(data.uids) && data.uids.length) return true;
    return false;
}

function prizeReason(board, periodKey, rank) {
    if (board === 'xp') {
        const kind = String(periodKey).indexOf('-M') === -1 ? 'Week' : 'Month';
        return kind + ' ' + periodKey + ' Top ' + rank + '!';
    }
    if (board === 'quest') return 'Quest ' + periodKey + ' Top ' + rank + '!';
    return 'Predictors ' + periodKey + ' Top ' + rank + '!';
}

// The lock stores this list. A retry pays these rows and no one else,
// so a partial run cannot grow past the original top 10.
function lockPlan(rows, tickets) {
    const amount = Math.max(0, Math.floor(Number(tickets) || 0));
    const plan = [];
    (rows || []).forEach(function (row, i) {
        if (!row || !row.uid || plan.length >= TOP) return;
        const banned = row.banned === true;
        const ghost = row.ghostMode === true;
        const skip = ghost ? 'ghost' : (banned ? 'banned' : (amount <= 0 ? 'no_prize' : ''));
        plan.push({
            uid: String(row.uid),
            username: publicName(row.username),
            rank: row.rank || (i + 1),
            tickets: skip ? 0 : amount,
            skipped: skip
        });
    });
    return plan;
}

// rows are already the displayed top, ghosts removed, banned still present.
function payableFromDisplayed(rows, tickets) {
    const amount = Math.max(0, Math.floor(Number(tickets) || 0));
    const paid = [];
    const skipped = [];
    (rows || []).forEach(function (row, i) {
        if (!row) return;
        const rank = row.rank || (i + 1);
        const entry = {
            uid: row.uid,
            username: publicName(row.username),
            rank: rank,
            tickets: amount,
            score: row.score != null ? row.score : (row.xp != null ? row.xp : row.passes)
        };
        if (!row.uid || row.banned === true || row.ghostMode === true || amount <= 0) {
            entry.tickets = 0;
            entry.skipped = row.ghostMode ? 'ghost' : (row.banned ? 'banned' : (amount <= 0 ? 'no_prize' : 'missing'));
            skipped.push(entry);
            return;
        }
        paid.push(entry);
    });
    return { paid: paid, skipped: skipped };
}

async function readAll(db, refs) {
    const out = [];
    if (!refs || !refs.length) return out;
    if (typeof db.getAll !== 'function') {
        for (let i = 0; i < refs.length; i++) out.push(await refs[i].get());
        return out;
    }
    for (let i = 0; i < refs.length; i += 10) {
        const part = refs.slice(i, i + 10);
        const rows = await db.getAll.apply(db, part);
        rows.forEach(function (row) { out.push(row); });
    }
    return out;
}

function indexSnaps(snaps) {
    const out = {};
    (snaps || []).forEach(function (snap) {
        if (!snap) return;
        out[snap.id] = snap.exists ? (snap.data() || {}) : {};
    });
    return out;
}

async function loadXpDisplay(db, field) {
    const snap = await db.collection('users').orderBy(field, 'desc').limit(150).get();
    const docs = [];
    snap.forEach(function (doc) {
        if ((Number((doc.data() || {})[field]) || 0) > 0) docs.push(doc);
    });
    const pubs = indexSnaps(await readAll(db, docs.map(function (doc) {
        return db.collection('public_profiles').doc(doc.id);
    })));
    const ledgers = indexSnaps(await readAll(db, docs.map(function (doc) {
        return db.collection('faucet_ledger').doc(doc.id);
    })));
    const shown = [];
    docs.forEach(function (doc) {
        const user = doc.data() || {};
        const pub = pubs[doc.id] || {};
        const ledger = ledgers[doc.id] || {};
        if (user.ghostMode === true || pub.ghostMode === true) return;
        const xp = Number(user[field]) || 0;
        if (xp <= 0) return;
        shown.push({
            uid: doc.id,
            username: publicName(user.username || pub.username),
            xp: xp,
            score: xp,
            banned: rewardBlocked(user, ledger)
        });
    });
    return shown.slice(0, TOP).map(function (row, i) {
        row.rank = i + 1;
        return row;
    });
}

async function questPeriodDocs(db, field, orderField, key) {
    const snap = await db.collection('quest_lb_stats').where(field, '==', key).orderBy(orderField, 'desc').limit(200).get();
    const docs = [];
    snap.forEach(function (doc) { docs.push(doc); });
    return docs;
}

async function loadQuestDisplay(db, period, nowMs) {
    const weekly = period !== 'monthly';
    const now = Number(nowMs) || Date.now();
    const key = questKeyForJob(weekly ? 'weekly' : 'monthly', now);
    const viewPeriod = weekly ? 'week' : 'month';
    const openField = weekly ? 'weekKey' : 'monthKey';
    const openOrder = weekly ? 'weekPasses' : 'monthPasses';
    const prevField = weekly ? 'prevWeekKey' : 'prevMonthKey';
    const prevOrder = weekly ? 'prevWeekPasses' : 'prevMonthPasses';
    const parts = await Promise.all([
        questPeriodDocs(db, openField, openOrder, key),
        questPeriodDocs(db, prevField, prevOrder, key)
    ]);
    const byId = {};
    parts.forEach(function (docs) {
        docs.forEach(function (doc) { byId[doc.id] = doc; });
    });
    const docs = Object.keys(byId).map(function (id) { return byId[id]; });
    const users = indexSnaps(await readAll(db, docs.map(function (doc) {
        return db.collection('users').doc(doc.id);
    })));
    const pubs = indexSnaps(await readAll(db, docs.map(function (doc) {
        return db.collection('public_profiles').doc(doc.id);
    })));
    const ledgers = indexSnaps(await readAll(db, docs.map(function (doc) {
        return db.collection('faucet_ledger').doc(doc.id);
    })));
    const entries = docs.map(function (doc) {
        const view = questBoard.closedView(doc.data() || {}, viewPeriod, key);
        const user = users[doc.id] || {};
        const pub = pubs[doc.id] || {};
        const ledger = ledgers[doc.id] || {};
        return {
            uid: doc.id,
            username: user.username || pub.username,
            profilePic: user.profilePic || pub.profilePic || '',
            ghostMode: user.ghostMode === true || pub.ghostMode === true,
            banned: rewardBlocked(user, ledger),
            passes: view.passes,
            attempts: view.attempts,
            passedAttempts: view.passedAttempts,
            reachedAt: view.reachedAt
        };
    });
    const ranked = questBoard.rankForPrize(entries, viewPeriod).slice(0, TOP).map(function (row) {
        row.score = row.passes;
        return row;
    });
    return { key: key, rows: ranked };
}

async function zeroUserField(db, admin, field) {
    const BATCH = 400;
    let last = null;
    let scanned = 0;
    while (true) {
        let query = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(BATCH);
        if (last) query = query.startAfter(last);
        const snap = await query.get();
        if (snap.empty) break;
        last = snap.docs[snap.docs.length - 1];
        const batch = db.batch();
        let writes = 0;
        snap.forEach(function (doc) {
            if ((Number((doc.data() || {})[field]) || 0) > 0) {
                batch.update(doc.ref, field === 'weeklyXP' ? { weeklyXP: 0 } : { monthlyXP: 0 });
                writes++;
            }
        });
        if (writes) await batch.commit();
        scanned += snap.size;
        if (snap.size < BATCH) break;
    }
    return scanned;
}

async function payWinners(db, admin, opts) {
    const src = opts || {};
    const board = src.board;
    const periodKey = src.periodKey;
    const tickets = Math.max(0, Math.floor(Number(src.tickets) || 0));
    const freshPlan = lockPlan(src.rows || [], tickets);
    const plan = payableFromDisplayed(freshPlan, tickets);
    const markerRef = db.collection('lb_prize_markers').doc(markerId(board, periodKey));
    const legacyRefs = src.legacyRefs || [];
    const inc = admin.firestore.FieldValue.increment;
    const claimed = await db.runTransaction(async function (tx) {
        const markerSnap = await tx.get(markerRef);
        const legacySnaps = [];
        for (let i = 0; i < legacyRefs.length; i++) {
            const ref = db.collection(legacyRefs[i].collection).doc(legacyRefs[i].id);
            legacySnaps.push(await tx.get(ref));
        }
        const markerData = markerSnap.exists ? (markerSnap.data() || {}) : null;
        if (markerData && markerData.status === 'complete') {
            return { action: 'skip', reason: 'marker', plan: markerData.plan || [] };
        }
        for (let i = 0; i < legacySnaps.length; i++) {
            if (legacySnaps[i].exists && legacySettled(legacySnaps[i].data() || {})) {
                tx.set(markerRef, {
                    board: board,
                    periodKey: periodKey,
                    status: 'complete',
                    reason: 'legacy',
                    tickets: tickets,
                    plan: (markerData && markerData.plan) || freshPlan,
                    paidUids: (markerData && markerData.paidUids) || [],
                    completedAt: Date.now()
                }, { merge: true });
                return { action: 'skip', reason: 'legacy', plan: (markerData && markerData.plan) || freshPlan };
            }
        }
        if (markerData && Array.isArray(markerData.plan)) {
            const resumePay = markerData.plan.some(function (row) { return row && row.tickets > 0; });
            return { action: resumePay ? 'pay' : 'skip', reason: 'resume', plan: markerData.plan };
        }
        tx.set(markerRef, {
            board: board,
            periodKey: periodKey,
            status: 'pending',
            tickets: tickets,
            plan: freshPlan,
            paidUids: [],
            createdAt: Date.now()
        }, { merge: true });
        return { action: tickets > 0 ? 'pay' : 'skip', reason: tickets > 0 ? '' : 'no_prize', plan: freshPlan };
    });

    if (claimed.action !== 'pay') {
        if (claimed.reason === 'no_prize' || claimed.reason === 'resume') {
            await markerRef.set({
                board: board,
                periodKey: periodKey,
                status: 'complete',
                reason: 'no_prize',
                tickets: 0,
                paidUids: [],
                completedAt: Date.now()
            }, { merge: true });
        }
        return {
            action: claimed.action,
            reason: claimed.reason,
            periodKey: periodKey,
            paid: [],
            skipped: plan.skipped,
            paidCount: 0,
            skippedCount: plan.skipped.length
        };
    }

    const locked = Array.isArray(claimed.plan) ? claimed.plan : freshPlan;
    const payable = locked.filter(function (row) {
        return row && row.uid && !row.skipped && row.tickets > 0;
    });
    const paid = [];
    const skipped = locked.filter(function (row) { return row && row.skipped; });
    for (let i = 0; i < payable.length; i++) {
        const winner = payable[i];
        const winnerRef = board === 'prediction'
            ? db.collection('prediction_payouts').doc(periodKey).collection('winners').doc(winner.uid)
            : markerRef.collection('winners').doc(winner.uid);
        const userRef = db.collection('users').doc(winner.uid);
        const ledgerRef = db.collection('faucet_ledger').doc(winner.uid);
        const reason = prizeReason(board, periodKey, winner.rank);
        let granted = false;
        try {
            granted = await db.runTransaction(async function (tx) {
                const existing = await tx.get(winnerRef);
                const userSnap = await tx.get(userRef);
                const ledgerSnap = await tx.get(ledgerRef);
                if (existing.exists) return false;
                const user = userSnap.exists ? (userSnap.data() || {}) : null;
                const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : null;
                if (!userSnap.exists || !user) {
                    tx.set(winnerRef, { skipped: 'missing_user', rank: winner.rank, tickets: 0, awardedAt: Date.now() });
                    return false;
                }
                if (user.ghostMode === true || rewardBlocked(user, ledger)) {
                    tx.set(winnerRef, {
                        skipped: user.ghostMode === true ? 'ghost' : 'banned',
                        rank: winner.rank,
                        tickets: 0,
                        awardedAt: Date.now()
                    });
                    return false;
                }
                const update = {
                    orangeTickets: inc(winner.tickets),
                    pendingLeaderboardReward: admin.firestore.FieldValue.arrayUnion({
                        tickets: winner.tickets,
                        reason: reason,
                        awardedAt: Date.now()
                    })
                };
                if (src.badgeField) update[src.badgeField] = inc(1);
                tx.set(winnerRef, {
                    rank: winner.rank,
                    tickets: winner.tickets,
                    username: winner.username,
                    awardedAt: Date.now()
                });
                tx.update(userRef, update);
                rewardNotify.apply(tx, db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
                    uid: winner.uid,
                    tickets: winner.tickets,
                    sourceLabel: reason,
                    icon: '🏆',
                    type: 'leaderboard_reward',
                    onceKey: board + '_' + periodKey + '_' + winner.uid
                }));
                return true;
            });
        } catch (err) {
            console.warn('[lb prize] grant failed', truncateUid(winner.uid), err && err.message ? err.message : err);
            throw err;
        }
        if (!granted) {
            skipped.push({ uid: winner.uid, username: winner.username, rank: winner.rank, tickets: 0, skipped: 'already' });
            continue;
        }
        paid.push(winner);
        if (src.badgeField) {
            try {
                await require('./badgeCredit').grantIds(db, admin, winner.uid, require('./grantBadge').familyFor(src.badgeField));
            } catch (badgeErr) {
                console.warn('[lb prize] badge', badgeErr && badgeErr.message ? badgeErr.message : badgeErr);
            }
        }
        if (typeof src.sendPush === 'function') {
            try {
                await src.sendPush(winner.uid, 'rewards', {
                    title: 'You won a reward',
                    body: reason + ' — ' + winner.tickets + ' Orange Tickets were added.',
                    url: 'https://bitcoineducation.quest/#questhub'
                });
            } catch (pushErr) {
                console.warn('[lb prize] push failed', pushErr && pushErr.message ? pushErr.message : pushErr);
            }
        }
    }

    await markerRef.set({
        status: 'complete',
        board: board,
        periodKey: periodKey,
        tickets: tickets,
        paidUids: paid.map(function (row) { return row.uid; }),
        paidCount: paid.length,
        completedAt: Date.now()
    }, { merge: true });

    return {
        action: 'pay',
        reason: '',
        periodKey: periodKey,
        paid: paid,
        skipped: skipped,
        paidCount: paid.length,
        skippedCount: skipped.length
    };
}

async function writeXpHistory(db, admin, periodKey, result) {
    if (!result || !result.paid || !result.paid.length) return;
    const ref = db.collection('leaderboard_winners').doc(periodKey);
    const existing = await ref.get();
    if (existing.exists) return;
    await ref.set({
        period: periodKey,
        label: periodKey.indexOf('-M') === -1 ? ('Week ' + periodKey) : ('Month ' + periodKey),
        winners: result.paid.map(function (row) {
            return { uid: row.uid, username: row.username, rank: row.rank, tickets: row.tickets };
        }),
        uids: result.paid.map(function (row) { return row.uid; }),
        ticketsPerWinner: TICKETS[periodKey.indexOf('-M') === -1 ? 'weekly' : 'monthly'],
        settledAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

async function settleXp(db, admin, opts) {
    const src = opts || {};
    const now = src.now || new Date();
    const period = src.period === 'monthly' ? 'monthly' : 'weekly';
    const periodKey = period === 'weekly' ? ps.previousWeekKey(now) : ps.previousMonthKey(now);
    const field = period === 'weekly' ? 'weeklyXP' : 'monthlyXP';
    const tickets = Math.max(0, Math.floor(Number(src.tickets) || 0));
    const rows = tickets > 0 ? await loadXpDisplay(db, field) : [];
    const legacyRefs = [{ collection: 'leaderboard_winners', id: periodKey }];
    if (period === 'weekly') {
        const oldKey = legacyXpWeekKey(now);
        if (oldKey && oldKey !== periodKey) legacyRefs.push({ collection: 'leaderboard_winners', id: oldKey });
    }
    const result = await payWinners(db, admin, {
        board: 'xp',
        period: period,
        periodKey: periodKey,
        tickets: tickets,
        rows: rows,
        sendPush: src.sendPush,
        legacyRefs: legacyRefs
    });
    if (result.action === 'pay') await writeXpHistory(db, admin, periodKey, result);
    const reset = await zeroUserField(db, admin, field);
    return {
        periodKey: periodKey,
        action: result.action,
        reason: result.reason || '',
        paid: result.paidCount,
        skipped: result.skippedCount,
        reset: reset
    };
}

async function settleQuest(db, admin, opts) {
    const src = opts || {};
    const now = src.now || new Date();
    const period = src.period === 'monthly' ? 'monthly' : 'weekly';
    const loaded = await loadQuestDisplay(db, period, now.getTime ? now.getTime() : now);
    const tickets = TICKETS[period];
    const result = await payWinners(db, admin, {
        board: 'quest',
        period: period,
        periodKey: loaded.key,
        tickets: tickets,
        rows: loaded.rows,
        sendPush: src.sendPush
    });
    return {
        periodKey: loaded.key,
        action: result.action,
        reason: result.reason || '',
        paid: result.paidCount,
        skipped: result.skippedCount
    };
}

async function settlePrediction(db, admin, jobs, opts) {
    const src = opts || {};
    const now = src.now || new Date();
    const period = src.period === 'monthly' ? 'monthly' : 'weekly';
    const periodKey = period === 'weekly' ? ps.previousWeekKey(now) : ps.previousMonthKey(now);
    const tickets = TICKETS[period];
    const loaded = await jobs.loadRows(period, periodKey);
    const rows = ps.selectBoard(loaded, period).slice(0, TOP).map(function (row) {
        return {
            uid: row.uid,
            username: row.username,
            rank: row.rank,
            banned: row.banned === true,
            score: row.pct,
            correct: row.correct,
            total: row.total
        };
    });
    const result = await payWinners(db, admin, {
        board: 'prediction',
        period: period,
        periodKey: periodKey,
        tickets: tickets,
        rows: rows,
        sendPush: src.sendPush,
        badgeField: period === 'monthly' ? 'predTopMonths' : 'predTopWeeks',
        legacyRefs: [{ collection: 'prediction_payouts', id: periodKey }]
    });
    let reset = 0;
    if (jobs && typeof jobs.resetClosed === 'function') {
        const closed = await jobs.resetClosed(period, now);
        reset = closed && closed.reset ? closed.reset : 0;
    }
    const patch = { resetDone: true, status: 'complete', period: period, periodId: periodKey };
    if (result.action === 'pay') {
        patch.ticketsEach = tickets;
        patch.winnerUids = (result.paid || []).map(function (row) { return row.uid; });
        patch.completedAt = Date.now();
    }
    await db.collection('prediction_payouts').doc(periodKey).set(patch, { merge: true });
    return {
        periodKey: periodKey,
        action: result.action,
        reason: result.reason || '',
        paid: result.paidCount,
        skipped: result.skippedCount,
        reset: reset
    };
}

module.exports = {
    TOP: TOP,
    TICKETS: TICKETS,
    PREDICTION_BEFORE: PREDICTION_BEFORE,
    publicName: publicName,
    truncateUid: truncateUid,
    markerId: markerId,
    legacyXpWeekKey: legacyXpWeekKey,
    closedQuestWeekKey: closedQuestWeekKey,
    closedQuestMonthKey: closedQuestMonthKey,
    questKeyForJob: questKeyForJob,
    anchorForQuestKey: anchorForQuestKey,
    xpClosedWeek: xpClosedWeek,
    xpClosedMonth: xpClosedMonth,
    legacySettled: legacySettled,
    prizeReason: prizeReason,
    payableFromDisplayed: payableFromDisplayed,
    loadXpDisplay: loadXpDisplay,
    loadQuestDisplay: loadQuestDisplay,
    payWinners: payWinners,
    settleXp: settleXp,
    settleQuest: settleQuest,
    settlePrediction: settlePrediction
};
