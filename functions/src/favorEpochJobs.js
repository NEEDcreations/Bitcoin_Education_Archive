'use strict';

// Firebase side of Satoshi's Favor epoch / window sats payouts.
// Pure math lives in favorEpochPrizes.js. Every write is Admin SDK.

const P = require('./favorEpochPrizes');

const RESULTS = 'sf_payout_results';
const CONFIG_DOC = ['config', 'satoshiFavorPayouts'];
const SITE_DAILY = 'sf_payout_site_daily';
const LOCKS = 'sf_payout_locks';

function httpsError(functionsV1, code, msg) {
    return new functionsV1.https.HttpsError(code, msg);
}

function requireAdmin(functionsV1, context) {
    if (!context || !context.auth) throw httpsError(functionsV1, 'unauthenticated', 'Must be signed in');
    if (!context.auth.token || context.auth.token.admin !== true) {
        throw httpsError(functionsV1, 'permission-denied', 'Admin only');
    }
}

function requireUser(functionsV1, context) {
    if (!context || !context.auth || !context.auth.uid) {
        throw httpsError(functionsV1, 'unauthenticated', 'Must be signed in');
    }
    if (context.auth.token && context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
        throw httpsError(functionsV1, 'permission-denied', 'Account required.');
    }
    return context.auth.uid;
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

function lnFromUser(user) {
    const u = user || {};
    return P.normalizeLn(u.lightningAddress || u.lightning || u.lnAddress || '');
}

async function loadPlayer(db, admin, uid, nowMs, lnAtClose) {
    const [userSnap, ledgerSnap] = await Promise.all([
        db.collection('users').doc(uid).get(),
        db.collection('faucet_ledger').doc(uid).get(),
    ]);
    const user = userSnap.exists ? (userSnap.data() || {}) : null;
    let authKnown = false;
    let ageDays = 0;
    let createdMs = 0;
    let emailVerified = false;
    try {
        const auth = await admin.auth().getUser(uid);
        const created = new Date(auth.metadata.creationTime).getTime();
        if (Number.isFinite(created)) {
            authKnown = true;
            createdMs = created;
            ageDays = Math.floor((nowMs - created) / 86400000);
        }
        emailVerified = !!(auth.email && auth.emailVerified);
    } catch (e) { /* leave unknown */ }
    const currentLn = lnFromUser(user);
    // Explicit close snapshot (including '') wins — never silently upgrade to current.
    const closedLn = (lnAtClose !== undefined && lnAtClose !== null)
        ? P.normalizeLn(lnAtClose)
        : P.normalizeLn(currentLn);
    // Address is locked after first set; a one-time server reset is the only change.
    // Treat a current address that differs from the close snapshot as changed.
    const addressChangedAfterClose = !!(closedLn && currentLn && closedLn !== currentLn);
    // Cooldown: ln_resets doc with recent usedAt, or ln_reset_used freshly set.
    let addressInCooldown = false;
    try {
        const resetSnap = await db.collection('ln_resets').doc(uid).get();
        if (resetSnap.exists) {
            const d = resetSnap.data() || {};
            const usedAt = d.usedAt && typeof d.usedAt.toMillis === 'function' ? d.usedAt.toMillis() : Number(d.usedAtMs) || 0;
            // 7-day cooldown after a reset before the new address can receive Favor sats.
            if (usedAt && nowMs - usedAt < 7 * 86400000) addressInCooldown = true;
        }
    } catch (e) { /* ignore */ }
    return {
        uid: uid,
        user: user,
        ledger: ledgerSnap.exists ? (ledgerSnap.data() || {}) : {},
        authKnown: authKnown,
        ageDays: ageDays,
        createdMs: createdMs,
        emailVerified: emailVerified,
        lightningAddressAtClose: closedLn,
        addressChangedAfterClose: addressChangedAfterClose,
        addressInCooldown: addressInCooldown,
    };
}

async function loadPlayersForUids(db, admin, uids, nowMs, lnByUid) {
    const out = [];
    for (let i = 0; i < uids.length; i++) {
        const uid = uids[i];
        out.push(await loadPlayer(db, admin, uid, nowMs, lnByUid && lnByUid[uid]));
    }
    return out;
}

// Create-only result + breakdown after an epoch closes. Safe to call twice.
async function finalizeEpoch(db, admin, opts) {
    const epochNum = Math.floor(Number(opts && opts.epochNumber) || 0);
    const epochId = P.epochIdOf(epochNum);
    if (!epochId) return { wrote: false, reason: 'bad_id' };
    const blocks = Array.isArray(opts.blocks) ? opts.blocks : [];
    const nowMs = Number(opts.nowMs) || Date.now();
    const resRef = db.collection(RESULTS).doc(epochId);
    const existing = await resRef.get();
    if (existing.exists) return { wrote: false, reason: 'exists', epochId: epochId };

    const uids = [];
    const seen = {};
    const lnByUid = {};
    blocks.forEach(function (b) {
        if (!b || !b.uid || seen[b.uid]) return;
        seen[b.uid] = true;
        uids.push(String(b.uid));
    });
    // Snapshot each winner's current LN address at close (before any later reset).
    const userSnaps = uids.length ? await getAllInChunks(db, uids.map(function (u) { return db.collection('users').doc(u); })) : [];
    uids.forEach(function (uid, i) {
        lnByUid[uid] = lnFromUser(userSnaps[i] && userSnaps[i].exists ? userSnaps[i].data() : null);
    });
    const players = await loadPlayersForUids(db, admin, uids, nowMs, lnByUid);
    const cfg = await readConfig(db);
    const blocksForBd = blocks.map(function (b) {
        const foundAt = b && b.foundAt;
        let foundAtMs = nowMs;
        if (foundAt && typeof foundAt.toMillis === 'function') foundAtMs = foundAt.toMillis();
        else if (foundAt && typeof foundAt.seconds === 'number') foundAtMs = foundAt.seconds * 1000;
        else if (Number.isFinite(Number(b && b.foundAtMs))) foundAtMs = Number(b.foundAtMs);
        return Object.assign({}, b, { foundAtMs: foundAtMs });
    });
    const bd = P.buildEpochBreakdown({
        epochNumber: epochNum,
        blocks: blocksForBd,
        players: players,
        config: cfg,
        nowMs: nowMs,
    });

    const stamp = admin.firestore.FieldValue.serverTimestamp();
    try {
        await resRef.create({
            kind: 'epoch',
            epochId: epochId,
            epochNumber: epochNum,
            pot: bd.pot,
            satsTotal: bd.satsTotal,
            config: cfg,
            payoutStatus: 'awaiting_admin_approval',
            breakdownDone: true,
            createdAt: stamp,
            createdAtMs: nowMs,
            blockCount: blocks.length,
            // Frozen at close. Rebuild must reuse this map — never re-read users.
            lightningAddressesAtClose: lnByUid,
        });
    } catch (e) {
        if (e && (e.code === 6 || /already exists/i.test(e.message || ''))) {
            return { wrote: false, reason: 'exists', epochId: epochId };
        }
        throw e;
    }
    await resRef.collection('breakdown').doc('recipients').set({
        recipients: bd.recipients,
        excluded: bd.excluded,
        pot: bd.pot,
        satsTotal: bd.satsTotal,
        balanced: bd.balanced,
        contributionTotal: bd.contributionTotal,
        perBlockSats: bd.perBlockSats,
        notifyShare: bd.notifyShare,
        lightningClusters: bd.lightningClusters || [],
        unallocated: bd.unallocated,
        at: nowMs,
    });
    await resRef.set({
        perBlockSats: bd.perBlockSats || 0,
        notifyShare: bd.notifyShare || 0,
        satsTotal: bd.satsTotal,
        breakdownFailed: false,
    }, { merge: true });
    return { wrote: true, epochId: epochId, recipients: bd.recipients.length, excluded: bd.excluded.length, notifyShare: bd.notifyShare };
}

// Create-only result after a Favor window expires. Pot defaults to 0 (no payout).
async function finalizeWindow(db, admin, opts) {
    const cycleId = String((opts && opts.cycleId) || '');
    const windowId = P.windowIdOf(cycleId);
    if (!windowId) return { wrote: false, reason: 'bad_id' };
    const nowMs = Number(opts.nowMs) || Date.now();
    const resRef = db.collection(RESULTS).doc(windowId);
    const existing = await resRef.get();
    if (existing.exists) return { wrote: false, reason: 'exists', windowId: windowId };

    const cfg = await readConfig(db);
    const winnerUid = opts.winnerUid ? String(opts.winnerUid) : '';
    let player = null;
    if (winnerUid && cfg.windowWinnerSats > 0) {
        const userSnap = await db.collection('users').doc(winnerUid).get();
        const ln = lnFromUser(userSnap.exists ? userSnap.data() : null);
        player = await loadPlayer(db, admin, winnerUid, nowMs, ln);
    }
    const bd = P.buildWindowBreakdown({
        cycleId: cycleId,
        winnerUid: winnerUid,
        winnerUsername: opts.winnerUsername || '',
        player: player,
        config: cfg,
        nowMs: nowMs,
    });
    const lnAtClose = {};
    if (winnerUid && player) lnAtClose[winnerUid] = player.lightningAddressAtClose || '';
    if (!(bd.pot > 0)) {
        // Still record a zero-pot marker so retries stay quiet.
        try {
            await resRef.create({
                kind: 'window',
                windowId: windowId,
                cycleId: cycleId,
                pot: 0,
                satsTotal: 0,
                payoutStatus: 'no_pot',
                breakdownDone: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAtMs: nowMs,
                lightningAddressesAtClose: lnAtClose,
            });
        } catch (e) {
            if (e && (e.code === 6 || /already exists/i.test(e.message || ''))) {
                return { wrote: false, reason: 'exists', windowId: windowId };
            }
            throw e;
        }
        return { wrote: true, windowId: windowId, recipients: 0, noPot: true };
    }
    const stamp = admin.firestore.FieldValue.serverTimestamp();
    try {
        await resRef.create({
            kind: 'window',
            windowId: windowId,
            cycleId: cycleId,
            pot: bd.pot,
            satsTotal: bd.satsTotal,
            config: cfg,
            payoutStatus: 'awaiting_admin_approval',
            breakdownDone: true,
            createdAt: stamp,
            createdAtMs: nowMs,
            winnerUidShort: winnerUid ? P.truncateUid(winnerUid) : '',
            lightningAddressesAtClose: lnAtClose,
        });
    } catch (e) {
        if (e && (e.code === 6 || /already exists/i.test(e.message || ''))) {
            return { wrote: false, reason: 'exists', windowId: windowId };
        }
        throw e;
    }
    await resRef.collection('breakdown').doc('recipients').set({
        recipients: bd.recipients,
        excluded: bd.excluded,
        pot: bd.pot,
        satsTotal: bd.satsTotal,
        balanced: bd.balanced,
        contributionTotal: bd.contributionTotal,
        at: nowMs,
    });
    return { wrote: true, windowId: windowId, recipients: bd.recipients.length, excluded: bd.excluded.length };
}


// Admin/create-only rebuild when a close wrote the result shell but no recipients doc.
async function rebuildFavorBreakdown(db, admin, resultId, opts) {
    const id = String(resultId || '');
    if (!/^epoch_\d{1,9}$/.test(id) && !/^window_[A-Za-z0-9_-]{1,60}$/.test(id)) {
        return { rebuilt: false, reason: 'bad_id' };
    }
    const resRef = db.collection(RESULTS).doc(id);
    const res = await resRef.get();
    if (!res.exists) return { rebuilt: false, reason: 'missing' };
    const r = res.data() || {};
    const bdSnap = await resRef.collection('breakdown').doc('recipients').get();
    const force = !!(opts && opts.force);
    if (bdSnap.exists && !r.breakdownFailed && !force) return { rebuilt: false, reason: 'ok' };

    const nowMs = Number((opts && opts.nowMs) || Date.now());
    if (r.kind === 'window' || id.indexOf('window_') === 0) {
        const out = await finalizeWindow(db, admin, {
            cycleId: r.cycleId || id.replace(/^window_/, ''),
            winnerUid: r.winnerUid || '',
            winnerUsername: r.winnerUsername || '',
            nowMs: nowMs,
        });
        // finalizeWindow is create-only on the result; for rebuild, rewrite breakdown only.
        if (out && out.reason === 'exists') {
            const cfg = await readConfig(db);
            // Minimal: mark failed cleared if pot is 0
            await resRef.set({ breakdownFailed: false, rebuiltAtMs: nowMs }, { merge: true });
            return { rebuilt: true, reason: 'window_marked', windowId: id };
        }
        return Object.assign({ rebuilt: !!out.wrote }, out);
    }

    // Epoch: need blocks from sfPoolHistory
    const epochNum = Math.floor(Number(r.epochNumber) || Number(String(id).replace('epoch_', '')) || 0);
    const hist = await db.collection('sfPoolHistory').where('epochNumber', '==', epochNum).limit(1).get();
    if (hist.empty) return { rebuilt: false, reason: 'no_history' };
    const blocks = (hist.docs[0].data() || {}).blocks || [];
    const uids = [];
    const seen = {};
    const lnByUid = {};
    blocks.forEach(function (b) {
        if (!b || !b.uid || seen[b.uid]) return;
        seen[b.uid] = true;
        uids.push(String(b.uid));
    });
    // Reuse close-time addresses saved on first finalize. Never re-read current LN.
    // Missing uid → '' → manual review / excluded (no address at close).
    const savedLn = r.lightningAddressesAtClose || {};
    uids.forEach(function (uid) {
        lnByUid[uid] = P.closeLightningFromSaved(savedLn, uid);
    });
    const players = await loadPlayersForUids(db, admin, uids, nowMs, lnByUid);
    const cfg = await readConfig(db);
    const blocksForBd = blocks.map(function (b) {
        const foundAt = b && b.foundAt;
        let foundAtMs = nowMs;
        if (foundAt && typeof foundAt.toMillis === 'function') foundAtMs = foundAt.toMillis();
        else if (foundAt && typeof foundAt.seconds === 'number') foundAtMs = foundAt.seconds * 1000;
        return Object.assign({}, b, { foundAtMs: foundAtMs });
    });
    const bd = P.buildEpochBreakdown({
        epochNumber: epochNum,
        blocks: blocksForBd,
        players: players,
        config: cfg,
        nowMs: nowMs,
    });
    await resRef.collection('breakdown').doc('recipients').set({
        recipients: bd.recipients,
        excluded: bd.excluded,
        pot: bd.pot,
        satsTotal: bd.satsTotal,
        balanced: bd.balanced,
        contributionTotal: bd.contributionTotal,
        perBlockSats: bd.perBlockSats,
        notifyShare: bd.notifyShare,
        lightningClusters: bd.lightningClusters || [],
        unallocated: bd.unallocated,
        at: nowMs,
        rebuilt: true,
    });
    await resRef.set({
        breakdownDone: true,
        breakdownFailed: false,
        perBlockSats: bd.perBlockSats || 0,
        notifyShare: bd.notifyShare || 0,
        satsTotal: bd.satsTotal,
        rebuiltAtMs: nowMs,
        payoutStatus: r.payoutStatus || 'awaiting_admin_approval',
    }, { merge: true });
    return { rebuilt: true, epochId: id, recipients: bd.recipients.length, excluded: bd.excluded.length };
}

async function retryFailedFavorBreakdowns(db, admin, nowMs) {
    const snap = await db.collection(RESULTS).where('breakdownFailed', '==', true).limit(10).get();
    const out = [];
    for (let i = 0; i < snap.docs.length; i++) {
        out.push(await rebuildFavorBreakdown(db, admin, snap.docs[i].id, { nowMs: nowMs }));
    }
    return { tried: out.length, results: out };
}

function factory(functionsV1, deps) {
    const db = deps.db;
    const admin = deps.admin;

    const adminFavorPayoutBreakdown = functionsV1.https.onCall(async function (data, context) {
        requireAdmin(functionsV1, context);
        const resultId = String((data && data.resultId) || (data && data.epochId) || '');
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(resultId)) {
            // List recent awaiting / failed results for the admin panel.
            const snap = await db.collection(RESULTS).orderBy('createdAtMs', 'desc').limit(25).get();
            const items = [];
            snap.forEach(function (d) {
                const r = d.data() || {};
                items.push({
                    resultId: d.id,
                    kind: r.kind || '',
                    epochNumber: r.epochNumber || null,
                    pot: r.pot || 0,
                    satsTotal: r.satsTotal || 0,
                    payoutStatus: r.payoutStatus || '',
                    createdAtMs: r.createdAtMs || 0,
                });
            });
            return { list: items };
        }
        const res = await db.collection(RESULTS).doc(resultId).get();
        if (!res.exists) throw httpsError(functionsV1, 'not-found', 'No payout result for that id.');
        const r = res.data() || {};
        const bd = await res.ref.collection('breakdown').doc('recipients').get();
        const pays = await res.ref.collection('payouts').get();
        const status = {};
        pays.forEach(function (p) { status[p.id] = p.data(); });
        const ids = Object.keys(status);
        const wins = ids.length ? await getAllInChunks(db, ids.map(function (id) { return db.collection('cipher_wins').doc(id); })) : [];
        wins.forEach(function (s) {
            if (s.exists) status[s.id].claimStatus = (s.data() || {}).status || '';
        });
        const breakdown = bd.exists ? bd.data() : { recipients: [], excluded: [], lightningClusters: [] };
        return {
            resultId: resultId,
            kind: r.kind,
            epochNumber: r.epochNumber || null,
            windowId: r.windowId || null,
            pot: r.pot,
            satsTotal: r.satsTotal,
            perBlockSats: r.perBlockSats || breakdown.perBlockSats || 0,
            payoutStatus: r.payoutStatus,
            breakdown: breakdown,
            payouts: status,
        };
    });

    // Admin: typed APPROVE <resultId>. Creates claimable / manual cipher_wins (create-only).
    const adminApproveFavorPayout = functionsV1.https.onCall(async function (data, context) {
        requireAdmin(functionsV1, context);
        const resultId = String((data && data.resultId) || (data && data.epochId) || '');
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(resultId) || !data || data.confirm !== P.confirmText(resultId)) {
            throw httpsError(functionsV1, 'invalid-argument', 'Confirmation text does not match.');
        }
        const resRef = db.collection(RESULTS).doc(resultId);
        const res = await resRef.get();
        if (!res.exists || !res.data().breakdownDone) {
            throw httpsError(functionsV1, 'failed-precondition', 'No stored breakdown yet.');
        }
        const r = res.data() || {};
        if (r.payoutStatus === 'no_pot') {
            throw httpsError(functionsV1, 'failed-precondition', 'This result has no pot.');
        }
        const cfg = P.readConfig(r.config || {});
        const now = Date.now();
        const bd = (await resRef.collection('breakdown').doc('recipients').get()).data() || {};
        const list = bd.recipients || [];
        const results = [];

        for (let i = 0; i < list.length; i++) {
            const rec = list[i];
            const id = P.winId(resultId, rec.uid);
            const payRef = resRef.collection('payouts').doc(id);
            const player = await loadPlayer(db, admin, rec.uid, now, rec.lightningAddressAtClose);
            const reason = P.exclusionReason({
                user: player.user,
                ledger: player.ledger,
                authKnown: player.authKnown,
                ageDays: player.ageDays,
                emailVerified: player.emailVerified,
                lightningAddressAtClose: rec.lightningAddressAtClose || player.lightningAddressAtClose,
                addressChangedAfterClose: player.addressChangedAfterClose,
                addressInCooldown: player.addressInCooldown,
            }, cfg, now);
            let out;
            if (reason) {
                out = { ok: false, status: 'blocked', error: reason };
            } else if (!(rec.sats > 0)) {
                out = { ok: false, status: 'skipped', error: 'zero sats' };
            } else {
                const mode = P.payoutStatusForAmount(rec.sats, cfg);
                const status = mode === 'manual' ? 'pending' : 'claimable';
                try {
                    await db.collection('cipher_wins').doc(id).create({
                        uid: rec.uid,
                        username: rec.username,
                        amount: rec.sats,
                        status: status,
                        source: r.kind === 'window' ? 'sf_window' : 'sf_epoch',
                        adminApproved: true,
                        approvedBy: context.auth.uid,
                        resultId: resultId,
                        epochId: resultId,
                        lockedLightningAddress: rec.lightningAddressAtClose || '',
                        cipherLabel: r.kind === 'window' ? "Satoshi's Favor window pot" : "Satoshi's Favor epoch pot",
                        why: rec.why || '',
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    out = { ok: true, status: status };
                } catch (e) {
                    if (e && (e.code === 6 || /already exists/i.test(e.message || ''))) {
                        out = { ok: true, status: 'already_approved' };
                    } else {
                        out = { ok: false, status: 'error', error: 'write failed' };
                    }
                }
            }
            await payRef.set(Object.assign({
                uidShort: rec.uidShort,
                username: rec.username,
                sats: rec.sats,
                why: rec.why || '',
                at: now,
            }, out), { merge: true });
            results.push(Object.assign({ id: id, uidShort: rec.uidShort, username: rec.username, sats: rec.sats }, out));
        }
        const failed = results.filter(function (x) { return !x.ok; }).length;
        await resRef.update({
            payoutStatus: failed ? 'approved_with_failures' : 'approved',
            approvedAt: now,
            approvedBy: context.auth.uid,
        });
        return { resultId: resultId, results: results, failed: failed };
    });


    // Player: claim status for Favor epochs (and windows). Used by Epoch History UI.
    const myFavorEpochClaims = functionsV1.https.onCall(async function (data, context) {
        const uid = requireUser(functionsV1, context);
        try {
            // {} or epochNumbers:[] → empty list (never 500). Client always sends explicit nums.
            const nums = P.parseFavorEpochNumbers(data);
            if (!nums.length) {
                return { claims: [] };
            }
            const out = [];
            for (let i = 0; i < nums.length; i++) {
                const epochNumber = nums[i];
                const epochId = P.epochIdOf(epochNumber);
                const resRef = db.collection(RESULTS).doc(epochId);
                const res = await resRef.get();
                if (!res.exists) {
                    out.push({ epochId: epochId, epochNumber: epochNumber, status: 'waiting_approval', winId: '', amount: 0, why: '' });
                    continue;
                }
                const r = res.data() || {};
                const payoutStatus = String(r.payoutStatus || '');
                const winDocId = P.winId(epochId, uid);
                const winSnap = await db.collection('cipher_wins').doc(winDocId).get();
                if (winSnap.exists) {
                    // Only the caller's own win row is returned as claimable/claimed.
                    out.push(P.claimRowForCaller({
                        epochId: epochId,
                        epochNumber: epochNumber,
                        uid: uid,
                        win: winSnap.data() || {},
                        winDocId: winDocId,
                    }));
                    continue;
                }
                if (payoutStatus === 'awaiting_admin_approval' || !payoutStatus) {
                    out.push({ epochId: epochId, epochNumber: epochNumber, status: 'waiting_approval', winId: '', amount: 0, why: '' });
                    continue;
                }
                const bd = await resRef.collection('breakdown').doc('recipients').get();
                const dataBd = bd.exists ? (bd.data() || {}) : {};
                const rec = (dataBd.recipients || []).find(function (x) { return x && x.uid === uid; });
                const excl = (dataBd.excluded || []).find(function (x) { return x && x.uid === uid; });
                if (rec) {
                    out.push({
                        epochId: epochId,
                        epochNumber: epochNumber,
                        status: 'waiting_approval',
                        winId: '',
                        amount: Math.floor(Number(rec.sats) || 0),
                        why: String(rec.why || ''),
                    });
                } else if (excl) {
                    out.push({
                        epochId: epochId,
                        epochNumber: epochNumber,
                        status: 'excluded',
                        winId: '',
                        amount: 0,
                        why: String(excl.reason || ''),
                    });
                } else {
                    out.push({ epochId: epochId, epochNumber: epochNumber, status: 'none', winId: '', amount: 0, why: '' });
                }
            }
            return { claims: out };
        } catch (e) {
            console.error('[myFavorEpochClaims]', e && e.message);
            throw httpsError(functionsV1, 'internal', 'Could not load Favor claims. Try again.');
        }
    });

    const adminRebuildFavorBreakdown = functionsV1.https.onCall(async function (data, context) {
        requireAdmin(functionsV1, context);
        const resultId = String((data && data.resultId) || '');
        const out = await rebuildFavorBreakdown(db, admin, resultId, { force: !!(data && data.force), nowMs: Date.now() });
        if (!out.rebuilt && out.reason === 'bad_id') throw httpsError(functionsV1, 'invalid-argument', 'Bad result id.');
        if (!out.rebuilt && out.reason === 'missing') throw httpsError(functionsV1, 'not-found', 'No result.');
        return out;
    });

    return {
        adminFavorPayoutBreakdown: adminFavorPayoutBreakdown,
        adminApproveFavorPayout: adminApproveFavorPayout,
        adminRebuildFavorBreakdown: adminRebuildFavorBreakdown,
        myFavorEpochClaims: myFavorEpochClaims,
    };
}

module.exports = {
    factory, finalizeEpoch, finalizeWindow, rebuildFavorBreakdown, retryFailedFavorBreakdowns,
    loadPlayer, readConfig, RESULTS, CONFIG_DOC, SITE_DAILY, LOCKS,
};
