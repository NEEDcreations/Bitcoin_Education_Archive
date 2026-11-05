'use strict';

// Firebase side of the faction race end prizes. Pure logic lives in
// factionRacePrizes.js. Every write here is Admin SDK; rules deny clients.

const P = require('./factionRacePrizes');

const RESULTS = 'faction_race_results';
const PUBLIC_DOC = ['faction_race_public', 'current'];
const CONFIG_DOC = ['config', 'factionRace'];

function httpsError(functionsV1, code, msg) { return new functionsV1.https.HttpsError(code, msg); }

function requireAdmin(functionsV1, context) {
    if (!context || !context.auth) throw httpsError(functionsV1, 'unauthenticated', 'Must be signed in');
    if (!context.auth.token || context.auth.token.admin !== true) throw httpsError(functionsV1, 'permission-denied', 'Admin only');
}

async function readConfig(db) {
    const s = await db.collection(CONFIG_DOC[0]).doc(CONFIG_DOC[1]).get();
    return P.readConfig(s.exists ? s.data() : {});
}

async function getAllInChunks(db, refs) {
    const out = [];
    for (let i = 0; i < refs.length; i += 300) {
        const part = await db.getAll.apply(db, refs.slice(i, i + 300));
        out.push.apply(out, part);
    }
    return out;
}

// Read-only. Contribution = race points stamped with this faction on the
// contributor docs (factionPoints, falling back to pointsAdded).
async function loadContributors(db, admin, faction, nowMs) {
    const snap = await db.collection('satoshiFavor').doc('current').collection('contributors')
        .where('faction', '==', faction).get();
    const rows = [];
    snap.forEach(function (d) { rows.push(d.data() || {}); });
    const by = P.tallyContributions(rows, faction);
    const uids = Object.keys(by);
    if (!uids.length) return [];
    const users = await getAllInChunks(db, uids.map(function (u) { return db.collection('users').doc(u); }));
    const ledgers = await getAllInChunks(db, uids.map(function (u) { return db.collection('faucet_ledger').doc(u); }));
    const auth = {};
    for (let i = 0; i < uids.length; i += 100) {
        const res = await admin.auth().getUsers(uids.slice(i, i + 100).map(function (uid) { return { uid: uid }; }));
        res.users.forEach(function (r) {
            const created = new Date(r.metadata.creationTime).getTime();
            auth[r.uid] = { created: created, emailVerified: !!(r.email && r.emailVerified) };
        });
    }
    return uids.map(function (uid, i) {
        const user = users[i].exists ? (users[i].data() || {}) : null;
        const a = auth[uid];
        const ok = !!(a && Number.isFinite(a.created));
        return {
            uid: uid,
            contribution: by[uid],
            // The faction on the profile must still match (deleted or moved accounts drop out).
            user: user,
            factionMismatch: !!(user && user.faction !== faction),
            ledger: ledgers[i].exists ? (ledgers[i].data() || {}) : {},
            authKnown: ok,
            ageDays: ok ? Math.floor((nowMs - a.created) / 86400000) : 0,
            emailVerified: ok && a.emailVerified,
        };
    });
}

async function computeBreakdown(db, admin, raceId, winner, nowMs) {
    const cfg = await readConfig(db);
    const [w, l] = await Promise.all([
        loadContributors(db, admin, winner, nowMs),
        loadContributors(db, admin, P.other(winner), nowMs),
    ]);
    return P.buildBreakdown({ raceId: raceId, winner: winner, config: cfg, nowMs: nowMs, winnerContributors: w, loserContributors: l });
}

// Exactly once: create-only result doc + public banner + Nacho post, one transaction.
async function decideRace(db, admin, nowMs) {
    const totalsRef = db.collection('satoshiFavor').doc('factionTotals');
    return db.runTransaction(async function (t) {
        const ts = await t.get(totalsRef);
        const totals = ts.exists ? (ts.data() || {}) : {};
        const winner = P.decideWinner(totals);
        if (!winner) return { decided: false, reason: 'not_yet' };
        const raceId = P.raceIdOf(totals);
        const resRef = db.collection(RESULTS).doc(raceId);
        const existing = await t.get(resRef);
        if (existing.exists) return { decided: false, reason: 'exists', raceId: raceId };
        const stamp = admin.firestore.FieldValue.serverTimestamp();
        const loser = P.other(winner);
        const finalTotals = { cyber_hornets: Number(totals.cyber_hornets) || 0, honey_badgers: Number(totals.honey_badgers) || 0 };
        const cfg = P.readConfig({});
        t.create(resRef, {
            raceId: raceId, winner: winner, loser: loser, finalTotals: finalTotals,
            decidedAt: stamp, decidedAtMs: nowMs,
            awardsDone: false, breakdownDone: false,
            payoutStatus: 'awaiting_admin_approval',
            headStart: { faction: loser, mult: cfg.headStartMult, points: cfg.headStartPoints },
        });
        // Next-race head start for the loser. Applies only once totals move to a
        // new raceId (see factionBalance.headStartActive).
        t.set(totalsRef, { headStart: { faction: loser, afterRaceId: raceId, mult: cfg.headStartMult, points: cfg.headStartPoints } }, { merge: true });
        t.set(db.collection(PUBLIC_DOC[0]).doc(PUBLIC_DOC[1]), {
            raceId: raceId, winner: winner, loser: loser, finalTotals: finalTotals, decidedAtMs: nowMs, active: true,
        });
        t.create(db.collection('global_chat').doc('faction_race_' + raceId), {
            uid: 'nacho-bot', name: '🦌 Nacho', text: P.announcementText(winner, finalTotals),
            isNachoAuto: false, ts: stamp, factionRaceWinner: winner,
        });
        return { decided: true, raceId: raceId, winner: winner };
    });
}

// Idempotent follow-up: badges/titles/flair, then the stored breakdown.
async function finishRace(db, admin, raceId, nowMs) {
    const resRef = db.collection(RESULTS).doc(raceId);
    const res = await resRef.get();
    if (!res.exists) return { ok: false, reason: 'no_result' };
    const r = res.data() || {};
    if (!r.awardsDone) {
        const FV = admin.firestore.FieldValue;
        for (const side of ['winner', 'loser']) {
            const faction = side === 'winner' ? r.winner : r.loser;
            const snap = await db.collection('satoshiFavor').doc('current').collection('contributors').where('faction', '==', faction).get();
            const uids = {};
            snap.forEach(function (d) { const u = (d.data() || {}).uid; if (u) uids[u] = true; });
            const list = Object.keys(uids);
            const flairStart = Number(r.decidedAtMs) || nowMs;
            for (let i = 0; i < list.length; i += 400) {
                const userSnaps = await getAllInChunks(db, list.slice(i, i + 400).map(function (u) { return db.collection('users').doc(u); }));
                const batch = db.batch();
                userSnaps.forEach(function (s) {
                    if (!s.exists || (s.data() || {}).faction !== faction) return;
                    batch.update(s.ref, P.grantPatch(side, faction, flairStart, FV));
                });
                await batch.commit();
            }
        }
        await resRef.update({ awardsDone: true });
    }
    if (!r.breakdownDone) {
        const bd = await computeBreakdown(db, admin, raceId, r.winner, Number(r.decidedAtMs) || nowMs);
        await resRef.collection('breakdown').doc('winners').set(bd.winners);
        await resRef.collection('breakdown').doc('losers').set(bd.losers);
        await resRef.update({ breakdownDone: true, config: bd.config });
    }
    return { ok: true };
}

async function onTotals(db, admin, after) {
    if (!P.decideWinner(after)) return null;
    const now = Date.now();
    const d = await decideRace(db, admin, now);
    const raceId = d.raceId || P.raceIdOf(after);
    await finishRace(db, admin, raceId, now);
    return d;
}

function factory(deps) {
    const { functionsV1, admin, db, onDocumentWritten } = deps;

    const onFactionTotalsWritten = onDocumentWritten({ document: 'satoshiFavor/factionTotals', retry: true, maxInstances: 1 }, async function (event) {
        const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
        if (!after) return null;
        await onTotals(db, admin, after);
        return null;
    });

    // Admin: stored breakdown + payout status, or a live dry run when the race is still open.
    const adminFactionRaceBreakdown = functionsV1.https.onCall(async function (data, context) {
        requireAdmin(functionsV1, context);
        const totalsSnap = await db.collection('satoshiFavor').doc('factionTotals').get();
        const totals = totalsSnap.exists ? totalsSnap.data() : {};
        const raceId = P.raceIdOf(totals);
        const res = await db.collection(RESULTS).doc(raceId).get();
        if (res.exists && res.data().breakdownDone) {
            const r = res.data();
            const [w, l, pays] = await Promise.all([
                res.ref.collection('breakdown').doc('winners').get(),
                res.ref.collection('breakdown').doc('losers').get(),
                res.ref.collection('payouts').get(),
            ]);
            const status = {};
            pays.forEach(function (p) { status[p.id] = p.data(); });
            const ids = Object.keys(status);
            const wins = ids.length ? await getAllInChunks(db, ids.map(function (id) { return db.collection('cipher_wins').doc(id); })) : [];
            wins.forEach(function (s) { if (s.exists) status[s.id].claimStatus = (s.data() || {}).status || ''; });
            return { dryRun: false, raceId: raceId, winner: r.winner, loser: r.loser, payoutStatus: r.payoutStatus,
                winners: w.data(), losers: l.data(), payouts: status };
        }
        const leader = (Number(totals.cyber_hornets) || 0) >= (Number(totals.honey_badgers) || 0) ? 'cyber_hornets' : 'honey_badgers';
        const bd = await computeBreakdown(db, admin, raceId, leader, Date.now());
        return Object.assign({ dryRun: true, note: 'Race not decided. Preview assumes the current leader wins.' }, bd);
    });

    // Admin: one tap. Creates claimable cipher_wins rows (create-only ids) after
    // re-checking each recipient. Retry = call again; existing rows are skipped.
    const adminApproveFactionPayout = functionsV1.https.onCall(async function (data, context) {
        requireAdmin(functionsV1, context);
        const raceId = String((data && data.raceId) || '');
        if (!/^[A-Za-z0-9_-]{1,40}$/.test(raceId) || !data || data.confirm !== 'APPROVE ' + raceId) {
            throw httpsError(functionsV1, 'invalid-argument', 'Confirmation text does not match.');
        }
        const resRef = db.collection(RESULTS).doc(raceId);
        const res = await resRef.get();
        if (!res.exists || !res.data().breakdownDone) throw httpsError(functionsV1, 'failed-precondition', 'Race has no stored breakdown yet.');
        const r = res.data();
        const cfg = P.readConfig(r.config || {});
        const now = Date.now();
        const results = [];
        for (const side of ['winners', 'losers']) {
            const bd = (await resRef.collection('breakdown').doc(side).get()).data() || {};
            const list = bd.recipients || [];
            const fresh = await loadContributors(db, admin, side === 'winners' ? r.winner : r.loser, now);
            const byUid = {};
            fresh.forEach(function (c) { byUid[c.uid] = c; });
            for (const rec of list) {
                const id = P.winId(raceId, side, rec.uid);
                const payRef = resRef.collection('payouts').doc(id);
                const c = byUid[rec.uid];
                const reason = c ? P.exclusionReason(Object.assign({}, c, { contribution: rec.contribution }), cfg, now) : 'no longer a contributor';
                let out;
                if (reason) {
                    out = { ok: false, status: 'blocked', error: reason };
                } else if (!(rec.sats > 0)) {
                    out = { ok: false, status: 'skipped', error: 'zero sats' };
                } else {
                    try {
                        await db.collection('cipher_wins').doc(id).create({
                            uid: rec.uid, username: rec.username, amount: rec.sats, status: 'claimable',
                            source: 'faction_race', adminApproved: true, approvedBy: context.auth.uid,
                            raceId: raceId, side: side, cipherLabel: 'Faction race pot of sats',
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                        out = { ok: true, status: 'claimable' };
                    } catch (e) {
                        if (e && (e.code === 6 || /already exists/i.test(e.message || ''))) out = { ok: true, status: 'already_approved' };
                        else out = { ok: false, status: 'error', error: 'write failed' };
                    }
                }
                await payRef.set(Object.assign({ uidShort: rec.uidShort, username: rec.username, sats: rec.sats, side: side, at: now }, out));
                results.push(Object.assign({ id: id, uidShort: rec.uidShort, username: rec.username, sats: rec.sats, side: side }, out));
            }
        }
        const failed = results.filter(function (x) { return !x.ok; }).length;
        await resRef.update({ payoutStatus: failed ? 'approved_with_failures' : 'approved', approvedAt: now, approvedBy: context.auth.uid });
        return { raceId: raceId, results: results, failed: failed };
    });

    return { onFactionTotalsWritten, adminFactionRaceBreakdown, adminApproveFactionPayout };
}

module.exports = { factory, decideRace, finishRace, computeBreakdown, loadContributors, onTotals, RESULTS, PUBLIC_DOC, CONFIG_DOC };
