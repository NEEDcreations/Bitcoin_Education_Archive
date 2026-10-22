/**
 * Firestore orchestration for prediction scoring, the Top Predictors board,
 * and the weekly/monthly ticket payout. Ordering rules live in predictionStats.js.
 */
const ps = require('./predictionStats');

function createPredictionJobs(db, admin) {
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
        async function readChunked(refs) {
            const out = [];
            for (let i = 0; i < refs.length; i += 10) {
                const part = refs.slice(i, i + 10);
                const rows = await db.getAll.apply(db, part);
                rows.forEach(function(row) { out.push(row); });
            }
            return out;
        }
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
        if (!predTime) return null;
        return db.runTransaction(async function(tx) {
            const activeRef = doc.ref;
            const statsRef = db.collection('prediction_stats').doc(uid);
            const userRef = db.collection('users').doc(uid);
            const recordRef = db.collection('prediction_records').doc(uid + '_' + predTime);
            const activeSnap = await tx.get(activeRef);
            const statsSnap = await tx.get(statsRef);
            const userSnap = await tx.get(userRef);
            const recordSnap = await tx.get(recordRef);
            if (!activeSnap.exists) return null;
            const live = activeSnap.data() || {};
            const liveTime = ps.timeMs(live.time);
            if (!liveTime || now - liveTime < ps.WINDOW_MS) return null;
            if (recordSnap.exists) {
                tx.delete(activeRef);
                return { duplicate: true };
            }
            const decision = ps.resolutionDecision(live);
            if (decision.action === 'void') {
                const applied = ps.applyResolution(statsSnap.exists ? statsSnap.data() : null, live, 0, now);
                tx.set(statsRef, {
                    predLastResult: applied.stats.predLastResult,
                    predPending: applied.stats.predPending
                }, { merge: true });
                tx.delete(activeRef);
                return { void: true, reason: decision.reason };
            }
            const applied = ps.applyResolution(statsSnap.exists ? statsSnap.data() : null, {
                direction: live.direction,
                serverStartPrice: decision.startPrice,
                time: liveTime
            }, price, now);
            tx.set(statsRef, applied.stats);
            tx.set(recordRef, {
                uid: uid,
                direction: live.direction === 'down' ? 'down' : 'up',
                startPrice: decision.startPrice,
                resolvedPrice: Number(price),
                correct: applied.correct === true,
                outcome: applied.correct ? 'correct' : 'wrong',
                time: liveTime,
                resolvedAt: now
            });
            tx.delete(activeRef);
            if (applied.correct && userSnap.exists) {
                const inc = admin.firestore.FieldValue.increment;
                tx.update(userRef, {
                    points: inc(ps.CORRECT_XP),
                    weeklyXP: inc(ps.CORRECT_XP),
                    monthlyXP: inc(ps.CORRECT_XP)
                });
            }
            return { correct: applied.correct === true };
        });
    }

    async function resolveDue(getPrice) {
        const snap = await db.collection('active_predictions').where('resolved', '==', false).get();
        const now = Date.now();
        const due = [];
        snap.forEach(function(doc) {
            const pred = doc.data() || {};
            if (now - ps.timeMs(pred.time) >= ps.WINDOW_MS) due.push(doc);
        });
        if (!due.length) {
            if (!snap.empty) return { resolved: 0, waiting: snap.size };
            try { await refreshLeaderboard(new Date(now)); } catch (e) {
                console.error('[predict] leaderboard refresh failed:', e.message);
            }
            return { resolved: 0 };
        }
        let price = 0;
        try { price = Number(await getPrice()); } catch (e) { price = 0; }
        const voids = [];
        const scoreable = [];
        due.forEach(function(doc) {
            const decision = ps.resolutionDecision(doc.data() || {});
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
                else if (result && !result.duplicate) {
                    total++;
                    if (result.correct) correct++;
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
        await db.runTransaction(async function(tx) {
            const existing = await tx.get(winnerRef);
            const userSnap = await tx.get(userRef);
            const ledgerSnap = await tx.get(ledgerRef);
            if (existing.exists) return;
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
                return;
            }
            tx.set(winnerRef, {
                rank: winner.rank,
                tickets: winner.tickets,
                correct: winner.correct,
                total: winner.total,
                awardedAt: Date.now()
            });
            tx.update(userRef, {
                orangeTickets: admin.firestore.FieldValue.increment(winner.tickets),
                pendingLeaderboardReward: admin.firestore.FieldValue.arrayUnion({
                    tickets: winner.tickets,
                    reason: label,
                    awardedAt: Date.now()
                })
            });
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
        });
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
            time: ps.timeMs(data.time),
            void: true,
            voidReason: reason || 'no_server_price'
        }, 0, Date.now());
        await statsRef.set({
            predLastResult: next.stats.predLastResult,
            predPending: next.stats.predPending
        }, { merge: true });
    }

    async function syncPending(uid, data, getPrice) {
        if (!uid || !data) return { skipped: true };
        const activeRef = db.collection('active_predictions').doc(uid);
        if (data.void === true) {
            await writeVoidStats(uid, data, data.voidReason || 'void');
            return { void: true, reason: data.voidReason || 'void' };
        }
        let serverPrice = ps.serverStartPriceOf(data);
        if (serverPrice == null) {
            let fetched = 0;
            try {
                if (typeof getPrice === 'function') fetched = Number(await getPrice());
            } catch (e) {
                fetched = 0;
            }
            if (!(fetched > 0)) {
                await writeVoidStats(uid, data, 'no_server_price');
                try { await activeRef.delete(); } catch (e) { /* resolve will void it again */ }
                return { void: true, reason: 'no_server_price' };
            }
            await db.runTransaction(async function(tx) {
                const snap = await tx.get(activeRef);
                if (!snap.exists) return;
                const live = snap.data() || {};
                if (live.void === true || ps.serverStartPriceOf(live)) return;
                tx.set(activeRef, { serverStartPrice: fetched }, { merge: true });
            });
            return { priced: true, serverStartPrice: fetched };
        }
        const statsRef = db.collection('prediction_stats').doc(uid);
        const snap = await statsRef.get();
        const next = ps.setPending(snap.exists ? snap.data() : null, {
            direction: data.direction,
            serverStartPrice: serverPrice,
            time: ps.timeMs(data.time)
        });
        if (!next.predPending) return { pending: false };
        await statsRef.set({ predPending: next.predPending }, { merge: true });
        return { pending: true, serverStartPrice: serverPrice };
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
