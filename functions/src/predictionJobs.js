/**
 * Firestore orchestration for prediction scoring, the Top Predictors board,
 * and the weekly/monthly ticket payout. Ordering rules live in predictionStats.js.
 */
const ps = require('./predictionStats');
const rewardNotify = require('./rewardNotify');
const { planDailyXp } = require('./dailyXp');
const { offsetDateKey } = require('./offsetDay');
const { rewardBlocked } = require('./cipherClaim');

function createPredictionJobs(db, admin, hooks) {
    const pushHooks = hooks || {};
    async function readChunked(refs) {
        const out = [];
        for (let i = 0; i < refs.length; i += 10) {
            const part = refs.slice(i, i + 10);
            if (!part.length) continue;
            const rows = await db.getAll.apply(db, part);
            rows.forEach(function(row) { out.push(row); });
        }
        return out;
    }

    function statsQuery(period, key) {
        let q = db.collection('prediction_stats');
        if (period === 'weekly') {
            return q.where('weekKey', '==', key).where('qualifiesWeek', '==', true)
                .orderBy('weekAccuracy', 'desc')
                .orderBy('weekCorrect', 'desc')
                .orderBy('weekTotal', 'desc')
                .orderBy('weekReachedSort', 'asc')
                .limit(60);
        }
        if (period === 'monthly') {
            return q.where('monthKey', '==', key).where('qualifiesMonth', '==', true)
                .orderBy('monthAccuracy', 'desc')
                .orderBy('monthCorrect', 'desc')
                .orderBy('monthTotal', 'desc')
                .orderBy('monthReachedSort', 'asc')
                .limit(60);
        }
        return q.where('qualifiesAllTime', '==', true)
            .orderBy('predAccuracy', 'desc')
            .orderBy('predCorrect', 'desc')
            .orderBy('predTotal', 'desc')
            .orderBy('reachedSort', 'asc')
            .limit(60);
    }

    async function loadRows(period, key) {
        const snap = await statsQuery(period, key).get();
        if (snap.empty) return [];
        const userRefs = snap.docs.map(function(d) { return db.collection('users').doc(d.id); });
        const ledgerRefs = snap.docs.map(function(d) { return db.collection('faucet_ledger').doc(d.id); });
        const users = await readChunked(userRefs);
        const ledgers = await readChunked(ledgerRefs);
        const byId = {};
        const ledgerById = {};
        users.forEach(function(u) { byId[u.id] = u.exists ? (u.data() || {}) : {}; });
        ledgers.forEach(function(u) { ledgerById[u.id] = u.exists ? (u.data() || {}) : {}; });
        return snap.docs.map(function(d) {
            const view = ps.viewOf(d.data(), period);
            const user = byId[d.id] || {};
            const ledger = ledgerById[d.id] || {};
            let pic = typeof user.profilePic === 'string' ? user.profilePic : '';
            if (pic.length > 8000) pic = '';
            return {
                uid: d.id,
                username: user.username || 'Anon',
                profilePic: pic,
                correct: view.correct,
                total: view.total,
                accuracy: view.accuracy,
                reachedAt: view.reachedAt,
                satsDisabled: user.satsDisabled === true,
                ledgerBanned: ledger.banned === true
            };
        });
    }

    function packBoard(rows) {
        return rows.map(function(r) {
            return {
                rank: r.rank,
                uid: r.uid,
                username: String(r.username || 'Anon').slice(0, 40),
                profilePic: r.profilePic || '',
                pct: r.pct,
                correct: r.correct,
                total: r.total
            };
        });
    }

    async function refreshLeaderboard(now) {
        now = now || new Date();
        const week = ps.weekKey(now);
        const month = ps.monthKey(now);
        const loaded = await Promise.all([
            loadRows('alltime'),
            loadRows('weekly', week),
            loadRows('monthly', month)
        ]);
        const doc = {
            updatedAt: now.getTime(),
            weekKey: week,
            monthKey: month,
            alltime: packBoard(ps.selectBoard(loaded[0], 'alltime')),
            weekly: packBoard(ps.selectBoard(loaded[1], 'weekly')),
            monthly: packBoard(ps.selectBoard(loaded[2], 'monthly')),
            min: { weekly: ps.MIN.weekly, monthly: ps.MIN.monthly, alltime: ps.MIN.alltime },
            tickets: { weekly: ps.TICKETS.weekly, monthly: ps.TICKETS.monthly, top: ps.PAYOUT_SIZE }
        };
        if (JSON.stringify(doc).length > 800000) {
            ['alltime', 'weekly', 'monthly'].forEach(function(k) {
                doc[k].forEach(function(r) { r.profilePic = ''; });
            });
        }
        await db.collection('stats').doc('predictor_leaderboard').set(doc);
        return doc;
    }

    async function resolveOne(doc, price, now) {
        const pred = doc.data() || {};
        const uid = pred.uid || doc.id;
        const predTime = ps.timeMs(pred.time);
        if (!uid || !predTime) return null;
        return db.runTransaction(async function(tx) {
            const activeRef = doc.ref;
            const activeSnap = await tx.get(activeRef);
            if (!activeSnap.exists) return null;
            const live = activeSnap.data() || {};
            const liveUid = live.uid || uid;
            const liveTime = ps.timeMs(live.time);
            if (!liveTime || now - liveTime < ps.WINDOW_MS) return null;
            const statsRef = db.collection('prediction_stats').doc(liveUid);
            const userRef = db.collection('users').doc(liveUid);
            const recordRef = db.collection('prediction_records').doc(liveUid + '_' + liveTime);
            const serverRef = db.collection('prediction_server').doc(ps.serverDocId(liveUid, liveTime));
            const statsSnap = await tx.get(statsRef);
            const userSnap = await tx.get(userRef);
            const recordSnap = await tx.get(recordRef);
            const serverSnap = await tx.get(serverRef);
            if (recordSnap.exists) {
                tx.delete(activeRef);
                return { duplicate: true };
            }
            const dayKey = offsetDateKey(now);
            const dailyRef = userRef.collection('daily_points').doc(dayKey);
            const ledgerRef = db.collection('faucet_ledger').doc(liveUid);
            const dailySnap = await tx.get(dailyRef);
            const ledgerSnap = await tx.get(ledgerRef);
            const serverRecord = serverSnap.exists ? (serverSnap.data() || null) : null;
            const decision = ps.resolutionDecision(live, serverRecord);
            const prediction = { direction: live.direction, time: liveTime };
            if (decision.action === 'void') {
                const applied = ps.applyResolution(statsSnap.exists ? statsSnap.data() : null, prediction, 0, now, serverRecord);
                tx.set(statsRef, {
                    predLastResult: applied.stats.predLastResult,
                    predPending: applied.stats.predPending
                }, { merge: true });
                tx.delete(activeRef);
                return { void: true, reason: decision.reason };
            }
            if (!(Number(price) > 0)) return { needsPrice: true };
            const applied = ps.applyResolution(statsSnap.exists ? statsSnap.data() : null, prediction, price, now, serverRecord);
            tx.set(statsRef, applied.stats);
            tx.set(recordRef, {
                uid: liveUid,
                direction: live.direction === 'down' ? 'down' : 'up',
                startPrice: decision.startPrice,
                resolvedPrice: Number(price),
                correct: applied.correct === true,
                outcome: applied.correct ? 'correct' : 'wrong',
                time: liveTime,
                resolvedAt: now
            });
            tx.delete(activeRef);
            const pointsBefore = userSnap.exists ? (Number(userSnap.data().points) || 0) : 0;
            const user = userSnap.exists ? (userSnap.data() || {}) : {};
            const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : null;
            const dailyUsed = dailySnap.exists ? Number((dailySnap.data() || {}).total || 0) : 0;
            let xp = (applied.correct && userSnap.exists) ? ps.CORRECT_XP : 0;
            if (rewardBlocked(user, ledger)) xp = 0;
            else if (xp > 0) xp = planDailyXp(dailyUsed, xp).awarded;
            if (xp > 0) {
                const inc = admin.firestore.FieldValue.increment;
                tx.update(userRef, {
                    points: inc(xp),
                    weeklyXP: inc(xp),
                    monthlyXP: inc(xp)
                });
                tx.set(dailyRef, {
                    total: dailyUsed + xp,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            return {
                correct: applied.correct === true,
                uid: liveUid,
                direction: live.direction === 'down' ? 'down' : 'up',
                xp: xp,
                pointsBefore: pointsBefore
            };
        });
    }

    async function resolveDue(getPrice) {
        const snap = await db.collection('active_predictions').get();
        const now = Date.now();
        const due = [];
        let waiting = 0;
        snap.forEach(function(doc) {
            const pred = doc.data() || {};
            const t = ps.timeMs(pred.time);
            if (t && now - t >= ps.WINDOW_MS) due.push(doc);
            else if (t) waiting++;
        });
        if (!due.length) {
            if (waiting) return { resolved: 0, waiting: waiting };
            try { await refreshLeaderboard(new Date(now)); } catch (e) {
                console.error('[predict] leaderboard refresh failed:', e.message);
            }
            return { resolved: 0 };
        }
        let price = 0;
        try { price = Number(await getPrice()); } catch (e) { price = 0; }
        const serverRefs = due.map(function(doc) {
            const pred = doc.data() || {};
            const id = ps.serverDocId(pred.uid || doc.id, pred.time);
            return db.collection('prediction_server').doc(id || (pred.uid || doc.id));
        });
        const serverSnaps = await readChunked(serverRefs);
        const voids = [];
        const scoreable = [];
        due.forEach(function(doc, i) {
            const snapRow = serverSnaps[i];
            const serverRecord = snapRow && snapRow.exists ? (snapRow.data() || null) : null;
            const decision = ps.resolutionDecision(doc.data() || {}, serverRecord);
            if (decision.action === 'void') voids.push(doc);
            else scoreable.push(doc);
        });
        let voided = 0;
        let correct = 0;
        let total = 0;
        async function runPool(list, worker) {
            let cursor = 0;
            async function loop() {
                while (cursor < list.length) {
                    const doc = list[cursor++];
                    await worker(doc);
                }
            }
            const pool = Math.min(8, list.length);
            const runners = [];
            for (let i = 0; i < pool; i++) runners.push(loop());
            await Promise.all(runners);
        }
        await runPool(voids, async function(doc) {
            try {
                const result = await resolveOne(doc, 0, now);
                if (result && result.void) voided++;
            } catch (e) {
                console.error('[resolvePredictions] void', doc.id, e.message);
            }
        });
        if (!(price > 0)) {
            try { await refreshLeaderboard(new Date(now)); } catch (e) {
                console.error('[predict] leaderboard refresh failed:', e.message);
            }
            return { resolved: 0, voided: voided, error: scoreable.length ? 'no_price' : undefined };
        }
        await runPool(scoreable, async function(doc) {
            try {
                const result = await resolveOne(doc, price, now);
                if (result && result.void) voided++;
                else if (result && result.correct !== undefined && !result.duplicate) {
                    total++;
                    if (result.correct) correct++;
                    if (result.uid) {
                        const day = new Date(now).toISOString().slice(0, 10);
                        const went = result.direction === 'down' ? 'down' : 'up';
                        await rewardNotify.safeCommit(db, admin.firestore.FieldValue.serverTimestamp(), rewardNotify.plan({
                            uid: result.uid,
                            onceKey: 'predict_' + day + '_' + String(result.uid).slice(0, 12),
                            icon: '📊',
                            xp: result.xp || 0,
                            pointsBefore: result.pointsBefore || 0,
                            pointsDelta: result.xp || 0,
                            message: result.correct
                                ? ('📊 Your price prediction was correct. Bitcoin went ' + went + '.')
                                : ('📊 Your price prediction missed. Bitcoin did not go ' + went + '.'),
                        }));
                        if (pushHooks.sendPush) {
                            try {
                                await pushHooks.sendPush(result.uid, 'predictions', {
                                    title: result.correct ? 'Your prediction hit' : 'Prediction result',
                                    body: result.correct
                                        ? 'You called the move. XP is on your profile.'
                                        : 'That window closed. A new one will open.',
                                    url: 'https://bitcoineducation.quest/#questhub',
                                    type: 'predictions'
                                });
                            } catch (pushErr) {
                                console.warn('[predict] push failed', pushErr.message);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('[resolvePredictions]', doc.id, e.message);
            }
        });
        if (total > 0) {
            const inc = admin.firestore.FieldValue.increment;
            const globalUpdate = { total: inc(total) };
            if (correct > 0) globalUpdate.correct = inc(correct);
            await db.collection('stats').doc('predictions').set(globalUpdate, { merge: true });
        }
        try { await refreshLeaderboard(new Date(now)); } catch (e) {
            console.error('[predict] leaderboard refresh failed:', e.message);
        }
        return { resolved: total, correct: correct, voided: voided, price: price };
    }

    async function awardWinner(periodId, period, winner) {
        const winnerRef = db.collection('prediction_payouts').doc(periodId).collection('winners').doc(winner.uid);
        const notifRef = db.collection('notifications').doc('pred_' + periodId + '_' + winner.uid);
        const userRef = db.collection('users').doc(winner.uid);
        const ledgerRef = db.collection('faucet_ledger').doc(winner.uid);
        const label = (period === 'weekly' ? 'This Week' : 'This Month') + ' Top Predictors #' + winner.rank;
        const awardedNow = await db.runTransaction(async function(tx) {
            const existing = await tx.get(winnerRef);
            const userSnap = await tx.get(userRef);
            const ledgerSnap = await tx.get(ledgerRef);
            if (existing.exists) return false;
            const skip = ps.winnerSkipReason(
                userSnap.exists,
                userSnap.exists ? userSnap.data() : null,
                ledgerSnap.exists ? ledgerSnap.data() : null
            );
            if (skip) {
                tx.set(winnerRef, {
                    skipped: skip,
                    rank: winner.rank,
                    tickets: 0,
                    awardedAt: Date.now()
                });
                return false;
            }
            tx.set(winnerRef, {
                rank: winner.rank,
                tickets: winner.tickets,
                correct: winner.correct,
                total: winner.total,
                awardedAt: Date.now()
            });
            const badgeField = period === 'monthly' ? 'predTopMonths' : 'predTopWeeks';
            const ticketUpdate = {
                orangeTickets: admin.firestore.FieldValue.increment(winner.tickets),
                pendingLeaderboardReward: admin.firestore.FieldValue.arrayUnion({
                    tickets: winner.tickets,
                    reason: label,
                    awardedAt: Date.now()
                })
            };
            ticketUpdate[badgeField] = admin.firestore.FieldValue.increment(1);
            tx.update(userRef, ticketUpdate);
            tx.set(notifRef, {
                recipientId: winner.uid,
                senderId: 'system',
                senderName: 'Leaderboard',
                type: 'leaderboard_reward',
                message: '🏆 ' + label + ' — you earned ' + winner.tickets + ' 🎫 Orange Tickets! Check your wallet.',
                targetType: null,
                targetId: null,
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return true;
        });
        if (awardedNow) {
            try {
                const field = period === 'monthly' ? 'predTopMonths' : 'predTopWeeks';
                await require('./badgeCredit').grantIds(db, admin, winner.uid, require('./grantBadge').familyFor(field));
            } catch (badgeErr) {
                console.warn('[predict] badge', badgeErr.message);
            }
        }
        if (awardedNow && pushHooks.sendPush) {
            try {
                await pushHooks.sendPush(winner.uid, 'predictions', {
                    title: 'Predictor reward',
                    body: label + ' — ' + winner.tickets + ' Orange Tickets were added.',
                    url: 'https://bitcoineducation.quest/#questhub',
                    type: 'predictions'
                });
            } catch (pushErr) {
                console.warn('[predict] winner push failed', pushErr.message);
            }
        }
    }

    async function resetPeriod(period, endedKey, currentKey) {
        if (!endedKey || endedKey === currentKey) return 0;
        const field = period === 'weekly' ? 'weekKey' : 'monthKey';
        let updated = 0;
        while (true) {
            const snap = await db.collection('prediction_stats').where(field, '==', endedKey).limit(400).get();
            if (snap.empty) break;
            const batch = db.batch();
            snap.forEach(function(doc) {
                batch.set(doc.ref, ps.resetPeriodFields(doc.data(), period, currentKey), { merge: true });
            });
            await batch.commit();
            updated += snap.size;
            if (snap.size < 400) break;
        }
        return updated;
    }

    async function payout(period, now) {
        now = now || new Date();
        const endedKey = period === 'weekly' ? ps.previousWeekKey(now) : ps.previousMonthKey(now);
        const currentKey = period === 'weekly' ? ps.weekKey(now) : ps.monthKey(now);
        const ref = db.collection('prediction_payouts').doc(endedKey);
        let snap = await ref.get();
        let existing = snap.exists ? snap.data() : null;
        const rows = await loadRows(period, endedKey);
        let plan = ps.payoutPlan(existing, rows, period);
        if (plan.action === 'skip') return Object.assign({ periodId: endedKey }, plan);
        if (!existing) {
            try {
                await ref.create({
                    status: 'pending',
                    period: period,
                    periodId: endedKey,
                    awardedUids: [],
                    resetDone: false,
                    createdAt: Date.now()
                });
            } catch (e) {
                snap = await ref.get();
                existing = snap.exists ? snap.data() : null;
                plan = ps.payoutPlan(existing, rows, period);
                if (plan.action === 'skip') return Object.assign({ periodId: endedKey }, plan);
            }
        }
        const awarded = new Set((existing && existing.awardedUids) || []);
        for (let i = 0; i < plan.due.length; i++) {
            const winner = plan.due[i];
            await awardWinner(endedKey, period, winner);
            awarded.add(winner.uid);
            await ref.set({ awardedUids: Array.from(awarded), status: 'pending' }, { merge: true });
        }
        await ref.set({
            status: 'complete',
            period: period,
            periodId: endedKey,
            ticketsEach: ps.ticketsForPeriod(period),
            winnerUids: plan.winnerUids,
            completedAt: Date.now()
        }, { merge: true });
        let reset = 0;
        if (plan.needsReset) {
            reset = await resetPeriod(period, endedKey, currentKey);
            await ref.set({ resetDone: true }, { merge: true });
        }
        try { await refreshLeaderboard(now); } catch (e) {
            console.error('[predict] leaderboard refresh failed:', e.message);
        }
        return Object.assign({ periodId: endedKey, reset: reset }, plan);
    }

    async function writeVoidStats(uid, data, reason) {
        const statsRef = db.collection('prediction_stats').doc(uid);
        const snap = await statsRef.get();
        const next = ps.applyResolution(snap.exists ? snap.data() : null, {
            direction: data.direction,
            time: ps.timeMs(data.time)
        }, 0, Date.now(), { void: true, voidReason: reason || 'no_server_price' });
        await statsRef.set({
            predLastResult: next.stats.predLastResult,
            predPending: next.stats.predPending
        }, { merge: true });
    }

    async function syncPending(uid, data, getPrice) {
        if (!uid || !data) return { skipped: true };
        const activeRef = db.collection('active_predictions').doc(uid);
        const predTime = ps.timeMs(data.time);
        const direction = data.direction === 'down' ? 'down' : (data.direction === 'up' ? 'up' : '');
        if (!predTime || !direction) {
            await writeVoidStats(uid, data, 'invalid_prediction');
            try { await activeRef.delete(); } catch (e) { /* resolve will void it again */ }
            return { void: true, reason: 'invalid_prediction' };
        }
        let fetched = 0;
        try {
            if (typeof getPrice === 'function') fetched = Number(await getPrice());
        } catch (e) {
            fetched = 0;
        }
        if (!(fetched > 0)) {
            await writeVoidStats(uid, { direction: direction, time: predTime }, 'no_server_price');
            try { await activeRef.delete(); } catch (e) { /* resolve will void it again */ }
            return { void: true, reason: 'no_server_price' };
        }
        const setAt = Date.now();
        const serverRef = db.collection('prediction_server').doc(ps.serverDocId(uid, predTime));
        let wrote = false;
        await db.runTransaction(async function(tx) {
            const snap = await tx.get(activeRef);
            if (!snap.exists) return;
            const live = snap.data() || {};
            if (ps.timeMs(live.time) !== predTime) return;
            tx.set(serverRef, {
                uid: uid,
                time: predTime,
                serverStartPrice: fetched,
                serverPriceSetAt: setAt
            });
            wrote = true;
        });
        if (!wrote) return { skipped: true };
        const statsRef = db.collection('prediction_stats').doc(uid);
        const snap = await statsRef.get();
        const next = ps.setPending(snap.exists ? snap.data() : null, {
            direction: direction,
            time: predTime
        }, { serverStartPrice: fetched, serverPriceSetAt: setAt });
        if (!next.predPending) return { pending: false };
        await statsRef.set({ predPending: next.predPending }, { merge: true });
        try {
            await require('./comboActivity').noteComboZone(db, admin, uid, 'prediction', require('./offsetDay').offsetDateKey(Date.now()));
        } catch (comboErr) { /* zone note is not required for the prediction itself */ }
        return { pending: true, serverStartPrice: fetched, serverPriceSetAt: setAt };
    }

    return {
        loadRows: loadRows,
        refreshLeaderboard: refreshLeaderboard,
        resolveDue: resolveDue,
        payout: payout,
        syncPending: syncPending
    };
}

module.exports = { createPredictionJobs: createPredictionJobs };
