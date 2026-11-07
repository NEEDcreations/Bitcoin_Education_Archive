'use strict';
const { runtimeSa } = require('./src/runtimeServiceAccounts');
// Timechain TV drip pot. Check-ins, accrual, reserve, and distribution are
// all server-side. Clients can read the public pot doc and their own watch
// doc; Firestore rules deny every client write.

const functionsV1 = require('firebase-functions/v1');
const { onSchedule } = require('firebase-functions/v2/scheduler');
// Wallet balance reads use the NWC_URL secret, bound to tctvDripTick only.
const { nwcUrlSecret, nwcUrl } = require('./src/nwcSecret');
const admin = require('./src/firebaseAdmin.js');
const crypto = require('crypto');
const logic = require('./src/tctvDripLogic');
const tctvPresence = require('./tctv-presence-lib');
const { offsetDateKey } = require('./src/offsetDay');

const db = admin.firestore();
const POT_REF = () => db.collection('tctv_drip_pot').doc('current');
const CFG_REF = () => db.collection('tctv_drip_config').doc('settings');
const STAGING = process.env.GCLOUD_PROJECT === 'bitcoin-quest-staging';

function HttpsError(code, msg) { return new functionsV1.https.HttpsError(code, msg); }

async function loadConfig() {
    const snap = await CFG_REF().get();
    return { cfg: logic.readConfig(snap.exists ? snap.data() : null), raw: snap.exists ? (snap.data() || {}) : {} };
}

function watchId(potId, uid) { return String(potId) + '_' + String(uid); }

const tctvDripCheckin = functionsV1.runWith({ enforceAppCheck: true }).https.onCall(async (data, context) => {
    if (!context.auth) throw HttpsError('unauthenticated', 'Must be signed in');
    const provider = (context.auth.token && context.auth.token.firebase) ? context.auth.token.firebase.sign_in_provider : '';
    if (provider === 'anonymous') throw HttpsError('permission-denied', 'Sign in required');
    const uid = context.auth.uid;
    const body = data || {};
    if (!logic.validDeviceId(body.deviceId)) throw HttpsError('invalid-argument', 'Bad request');
    const deviceKey = crypto.createHash('sha256').update(String(body.deviceId)).digest('hex').slice(0, 32);
    const playing = body.playing === true && body.visible === true;
    const promptAnswer = typeof body.promptToken === 'string' ? body.promptToken.slice(0, 64) : '';

    const { cfg } = await loadConfig();
    if (!cfg.enabled) return { ok: false, reason: 'off' };
    const nowMs = Date.now();

    const potSnap = await POT_REF().get();
    const pot = potSnap.exists ? (potSnap.data() || {}) : {};
    // A full pot waiting for enough qualified viewers keeps counting watch time.
    if (!pot.potId || (pot.status !== 'filling' && pot.status !== 'full')) return { ok: false, reason: 'not-filling' };
    const wRef = db.collection('tctv_drip_watch').doc(watchId(pot.potId, uid));
    const devRef = db.collection('tctv_drip_devices').doc(deviceKey);
    const userRef = db.collection('users').doc(uid);
    const presRef = db.collection('tctv_presence').doc(uid);

    // Account age is checked once per pot and cached on the watch doc.
    const wPeek = await wRef.get();
    let ageOk = wPeek.exists ? wPeek.data().ageOk : undefined;
    if (ageOk === undefined) {
        try {
            const u = await admin.auth().getUser(uid);
            const created = new Date(u.metadata.creationTime).getTime();
            ageOk = Number.isFinite(created) && (nowMs - created) >= cfg.minAccountAgeDays * 86400000;
        } catch (e) { throw HttpsError('unavailable', 'Try again later'); }
    }

    return db.runTransaction(async (tx) => {
        const [wSnap, dSnap, uSnap, prSnap] = await Promise.all([tx.get(wRef), tx.get(devRef), tx.get(userRef), tx.get(presRef)]);
        if (!uSnap.exists) throw HttpsError('not-found', 'User not found');
        const user = uSnap.data() || {};
        if (logic.isAgentOrBlocked(user)) return { ok: false, reason: 'ineligible' };
        const prev = wSnap.exists ? (wSnap.data() || {}) : {};
        const pres = prSnap.exists ? prSnap.data() : null;
        const dev = dSnap.exists ? (dSnap.data() || {}) : {};
        const plan = logic.planCheckin(prev, {
            uid, nowMs, cfg, playing, promptAnswer,
            presenceFresh: !!pres && tctvPresence.isFreshPresence(pres, nowMs) && tctvPresence.isTctvStation(pres.station),
            deviceOwner: dev.uid || '', deviceLastMs: dev.lastMs || 0,
            newToken: crypto.randomBytes(12).toString('hex'),
        });
        if (plan.reject) return { ok: false, reason: plan.reason };
        const base = { uid, potId: pot.potId, ageOk: ageOk === true, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        if (plan.patch) {
            // Ineligible-by-age accounts still get a watch doc (for the UI) but never accrue seconds.
            const patch = Object.assign({}, plan.patch);
            if (ageOk !== true) delete patch.seconds;
            // Only crediting check-ins count toward the live viewer total.
            if (plan.credit > 0 && ageOk === true) patch.activeMs = nowMs;
            tx.set(wRef, Object.assign(base, patch), { merge: true });
            tx.set(devRef, { uid, lastMs: nowMs }, { merge: true });
        }
        const out = { ok: true, reason: plan.reason, credited: ageOk === true ? plan.credit : 0 };
        if (plan.prompt) { out.prompt = true; out.promptToken = plan.token; }
        return out;
    });
});

async function readWalletSats(raw) {
    if (STAGING) {
        // Staging has no wallet secret. A fake balance can be set in config for tests.
        return typeof raw.stagingWalletSats === 'number' ? raw.stagingWalletSats : -1;
    }
    const url = nwcUrl();
    if (!url) return -1;
    try {
        const { NWCClient } = require('@getalby/sdk');
        const nwc = new NWCClient({ nostrWalletConnectUrl: url });
        const res = await Promise.race([nwc.getBalance(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))]);
        try { nwc.close(); } catch (e) {}
        return Math.floor(res.balance / 1000);
    } catch (e) { return -1; }
}

async function alertAdmin(potId, reason) {
    await db.collection('admin_alerts').doc('tctv_drip_' + potId).set({
        kind: 'tctv_drip_hold', potId, reason,
        message: 'TCTV drip pot is full but payout is on hold (' + reason + '). Faucet claims keep paying. Top up the wallet or adjust tctv_drip_config.',
        at: admin.firestore.FieldValue.serverTimestamp(), resolved: false,
    }, { merge: true });
}

async function loadEntries(potId, cfg) {
    const snap = await db.collection('tctv_drip_watch').where('potId', '==', potId).get();
    const entries = [];
    const userSnaps = await Promise.all(snap.docs.map(d => db.collection('users').doc(d.data().uid).get()));
    snap.docs.forEach((d, i) => {
        const w = d.data() || {};
        const u = userSnaps[i];
        if (!u.exists || logic.isAgentOrBlocked(u.data()) || w.ageOk !== true) return;
        entries.push({ uid: w.uid, seconds: Math.min(Number(w.seconds) || 0, cfg.perAccountLimitSeconds) });
    });
    return entries;
}

// The share plan is frozen in tctv_drip_history before any credit, so a
// retried tick pays exactly the same shares. Ledger docs stay one per user per pot.
async function distribute(pot, cfg) {
    const potId = pot.potId;
    const histRef = db.collection('tctv_drip_history').doc(potId);
    let hist = (await histRef.get()).data() || null;
    if (!hist || !Array.isArray(hist.shares)) {
        const plan = logic.planShares(await loadEntries(potId, cfg), cfg);
        if (plan.wait) return plan;
        hist = await db.runTransaction(async (tx) => {
            const cur = await tx.get(histRef);
            if (cur.exists && Array.isArray((cur.data() || {}).shares)) return cur.data();
            const doc = { potId, paid: plan.paid, rollover: plan.rollover, winners: plan.shares.length, eligible: plan.eligible, cap: plan.cap,
                shares: plan.shares.map(x => ({ uid: x.uid, sats: x.sats, seconds: x.seconds })), at: admin.firestore.FieldValue.serverTimestamp() };
            tx.set(histRef, doc);
            return doc;
        });
    }
    for (const s of hist.shares) {
        const ledRef = db.collection('tctv_drip_payouts').doc(watchId(potId, s.uid));
        await db.runTransaction(async (tx) => {
            const led = await tx.get(ledRef);
            if (led.exists) return;
            tx.create(ledRef, { uid: s.uid, potId, sats: s.sats, seconds: s.seconds, status: 'credited', at: admin.firestore.FieldValue.serverTimestamp() });
            // Whole share goes to the balance. claimCipherSats pays it out over
            // as many claims/days as its limits need; nothing is dropped.
            tx.update(db.collection('users').doc(s.uid), {
                cipherSatsBalance: admin.firestore.FieldValue.increment(s.sats),
                tctvDripSatsEarned: admin.firestore.FieldValue.increment(s.sats),
            });
        });
    }
    return { wait: false, paid: hist.paid, rollover: hist.rollover, shares: hist.shares };
}


// Write each watcher's live projected share onto their own watch doc only.
// Same math as payout, but still projects while waiting on more eligible
// watchers. Never touches balances, history, or the public pot doc.
async function refreshProjections(potId, cfg) {
    if (!potId) return;
    const entries = await loadEntries(potId, cfg);
    const plan = logic.projectShares(entries, cfg);
    const byUid = new Map(plan.shares.map(s => [s.uid, s.sats]));
    const snap = await db.collection('tctv_drip_watch').where('potId', '==', potId).get();
    if (snap.empty) return;
    const nowMs = Date.now();
    let batch = db.batch();
    let n = 0;
    const commit = async () => { if (n) { await batch.commit(); batch = db.batch(); n = 0; } };
    for (const doc of snap.docs) {
        const w = doc.data() || {};
        const uid = String(w.uid || '');
        // Age-ok non-blocked watchers get their projected sats (0 if still under
        // the 30-minute qualify bar). Everyone else gets 0 so the UI never keeps
        // a stale number from an earlier pot state.
        const sats = (uid && w.ageOk === true && byUid.has(uid)) ? (byUid.get(uid) || 0) : 0;
        const prev = Number(w.projectedShareSats);
        const prevWait = w.projectedShareWaiting === true;
        if (prev === sats && prevWait === plan.waiting && Number(w.projectedSharePot) === Number(cfg.targetSats)) continue;
        batch.set(doc.ref, {
            projectedShareSats: sats,
            projectedShareWaiting: plan.waiting === true,
            projectedSharePot: Math.floor(cfg.targetSats),
            projectedShareAtMs: nowMs,
        }, { merge: true });
        n++;
        if (n >= 400) await commit();
    }
    await commit();
}

async function runTick() {
    const { cfg, raw } = await loadConfig();
    const nowMs = Date.now();
    const potRef = POT_REF();
    let pot = (await potRef.get()).data() || null;
    if (!pot || !pot.potId) {
        pot = { potId: 'pot1', status: 'filling', sats: 0, viewers: 0, target: cfg.targetSats, bursts: 0, createdMs: nowMs };
        await potRef.set(pot);
    }
    if (!cfg.enabled) return;

    if (pot.status === 'filling') {
        const active = await db.collection('tctv_drip_watch')
            .where('potId', '==', pot.potId).where('activeMs', '>=', nowMs - logic.ACTIVE_WINDOW_MS).count().get();
        const n = active.data().count || 0;
        const acc = logic.planAccrual(pot, n, cfg, offsetDateKey(nowMs));
        const patch = { sats: acc.sats, viewers: acc.viewers, liveViewers: n, ratePerMin: acc.ratePerMin, dayKey: acc.dayKey, dayAccrued: acc.dayAccrued, target: cfg.targetSats, lastTickMs: nowMs };
        if (acc.burst) { patch.bursts = (pot.bursts || 0) + 1; patch.lastBurstMs = nowMs; }
        if (acc.full) patch.status = 'full';
        await potRef.set(patch, { merge: true });
        Object.assign(pot, patch);
        try { await refreshProjections(pot.potId, cfg); } catch (e) { console.error('[tctvDrip] project', e && e.message); }
    }

    if (pot.status === 'full' || pot.status === 'held') {
        // Watcher minimum first. Not a wallet hold: no admin alert, the pot just
        // stays full (check-ins keep counting) and every tick retries.
        const pre = logic.planShares(await loadEntries(pot.potId, cfg), cfg);
        if (pre.wait) {
            if (pot.status !== 'full' || pot.waiting !== true) {
                await potRef.set({ status: 'full', waiting: true }, { merge: true });
            }
            try { await refreshProjections(pot.potId, cfg); } catch (e) { console.error('[tctvDrip] project', e && e.message); }
            return;
        }
        if (pot.waiting) await potRef.set({ waiting: admin.firestore.FieldValue.delete() }, { merge: true });
        const resRef = db.collection('tctv_drip_config').doc('reserve');
        const reserved = ((await resRef.get()).data() || {}).reservedSats || 0;
        const wallet = await readWalletSats(raw);
        const r = logic.planReserve(wallet, reserved, cfg);
        if (!r.ok) {
            // The reason stays private (reserve doc + admin alert), never on the public pot doc.
            const prevReason = ((await resRef.get()).data() || {}).holdReason || '';
            if (pot.status !== 'held' || prevReason !== r.reason) {
                await potRef.set({ status: 'held', heldMs: nowMs }, { merge: true });
                await resRef.set({ holdReason: r.reason, holdPotId: pot.potId }, { merge: true });
                await alertAdmin(pot.potId, r.reason);
            }
            try { await refreshProjections(pot.potId, cfg); } catch (e) { console.error('[tctvDrip] project', e && e.message); }
            return;
        }
        // Reserve the pot and flip to distributing atomically, so an
        // overlapping tick cannot reserve twice.
        const flipped = await db.runTransaction(async (tx) => {
            const cur = (await tx.get(potRef)).data() || {};
            if (cur.potId !== pot.potId || (cur.status !== 'full' && cur.status !== 'held')) return false;
            tx.set(resRef, { reservedSats: admin.firestore.FieldValue.increment(cfg.targetSats), holdReason: '' }, { merge: true });
            tx.set(potRef, { status: 'distributing', reservedMs: nowMs, holdReason: admin.firestore.FieldValue.delete() }, { merge: true });
            return true;
        });
        if (!flipped) return;
        // Resolve a wallet-hold alert only if one was raised; never create one here.
        await db.collection('admin_alerts').doc('tctv_drip_' + pot.potId).update({ resolved: true }).catch(() => {});
        pot.status = 'distributing';
    }

    if (pot.status === 'distributing') {
        const plan = await distribute(pot, cfg);
        if (plan.wait) {
            // Someone dropped out (ban/agent flag) after the reserve: release it and wait.
            const released = await db.runTransaction(async (tx) => {
                const cur = (await tx.get(potRef)).data() || {};
                if (cur.potId !== pot.potId || cur.status !== 'distributing') return false;
                tx.set(db.collection('tctv_drip_config').doc('reserve'), { reservedSats: admin.firestore.FieldValue.increment(-cfg.targetSats) }, { merge: true });
                tx.set(potRef, { status: 'full', waiting: true }, { merge: true });
                return true;
            });
            if (released) console.log('[tctvDrip] ' + pot.potId + ' waiting for watchers');
            return;
        }
        // The reserve becomes user balances that claimCipherSats pays from the faucet wallet.
        await db.collection('tctv_drip_config').doc('reserve').set({ reservedSats: admin.firestore.FieldValue.increment(-cfg.targetSats) }, { merge: true });
        const nextNum = (parseInt(String(pot.potId).replace(/\D/g, ''), 10) || 1) + 1;
        await potRef.set({
            potId: 'pot' + nextNum, status: 'filling', sats: Math.min(plan.rollover, cfg.targetSats - 1), viewers: 0, bursts: 0,
            target: cfg.targetSats, createdMs: nowMs, lastPaidPot: pot.potId, lastPaidWinners: plan.shares.length,
            dayKey: pot.dayKey || '', dayAccrued: pot.dayAccrued || 0,
        });
        console.log('[tctvDrip] distributed ' + pot.potId + ' paid=' + plan.paid + ' winners=' + plan.shares.length);
    }
}

const tctvDripTick = onSchedule({ schedule: 'every 1 minutes', timeZone: 'UTC', retryCount: 0, secrets: [nwcUrlSecret], serviceAccount: runtimeSa('tctvDripTick') }, async () => {
    try { await runTick(); } catch (e) { console.error('[tctvDrip] tick', e && e.message); }
});

module.exports = { tctvDripCheckin, tctvDripTick, _runTick: runTick };
