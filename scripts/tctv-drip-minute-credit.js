#!/usr/bin/env node
'use strict';

// Adds missed pot-of-sats watch seconds for people the audit says are owed.
// Dry-run is the default: it only reads and prints the plan.
// Nothing is written unless --apply is passed. --apply adds seconds on the
// open pot's watch docs. It does not pay sats and does not touch balances.
// The pot's own share math uses these seconds when the pot fills.
//
// Do not run --apply until the read-only audit has been reviewed.
//
//   node scripts/tctv-drip-minute-credit.js
//   node scripts/tctv-drip-minute-credit.js --days 7
//   node scripts/tctv-drip-minute-credit.js --apply
//
// Credentials: Application Default Credentials. No service-account JSON.

const path = require('path');
const minutes = require('./tctv-view-minutes');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'bitcoin-education-archive';

function loadAdmin() {
    try {
        return require('firebase-admin');
    } catch (err) {
        try {
            return require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
        } catch (err2) {
            console.error('[tctv-credit] firebase-admin is not installed. From the repo root: cd functions && npm ci');
            process.exit(1);
        }
    }
}

function claimDays(snap) {
    const out = [];
    snap.docs.forEach(function (doc) {
        const data = doc.data() || {};
        if (data.action === 'tctv_watch_ticket' && typeof data.day === 'string') out.push({ day: data.day });
    });
    return out;
}

function planFrom(uid, drip, daily, claims, user, pot, today, windowStart, nowMs) {
    const stuck = minutes.promptStuckState(drip, nowMs);
    const verified = minutes.verifiedWatchSeconds({
        today: today,
        daily: daily || {},
        claims: claims,
        potCreatedMs: pot.createdMs,
        windowStart: windowStart,
    });
    return minutes.assessPotCredit({
        uid: uid,
        potSeconds: drip.seconds,
        verifiedSeconds: verified.verified,
        promptStuck: stuck.stuck,
        stuckCreditSeconds: stuck.stuckCreditSeconds,
        ageOk: drip.ageOk === true,
        blocked: minutes.userIsBlocked(user),
        alreadyApplied: drip.viewMinuteCreditApplied === true,
        potOpen: minutes.potIsOpen(pot.status),
        hasDripDoc: true,
        perAccountLimitSeconds: pot.perAccountLimitSeconds,
    });
}

async function loadContext(db, uid, pot, today, windowStart, nowMs) {
    const [userSnap, watchSnap, claimsSnap] = await Promise.all([
        db.collection('users').doc(uid).get(),
        db.collection('tctv_watch').doc(uid).get(),
        db.collection('users').doc(uid).collection('award_claims').where('action', '==', 'tctv_watch_ticket').limit(40).get(),
    ]);
    const user = userSnap.exists ? (userSnap.data() || {}) : {};
    const daily = watchSnap.exists ? (watchSnap.data() || {}) : {};
    return { user: user, daily: daily, claims: claimDays(claimsSnap), today: today, windowStart: windowStart, nowMs: nowMs, pot: pot };
}

async function applyOne(db, admin, ref, pot, today, windowStart) {
    const FieldValue = admin.firestore.FieldValue;
    return db.runTransaction(async function (tx) {
        const snap = await tx.get(ref);
        if (!snap.exists) return { uid: ref.id, reason: 'missing', willCredit: false, owedMinutes: 0 };
        const drip = snap.data() || {};
        if (drip.viewMinuteCreditApplied === true) {
            return { uid: String(drip.uid || ref.id), reason: 'already-applied', willCredit: false, owedMinutes: 0, owedSeconds: 0 };
        }
        const uid = String(drip.uid || '');
        const userSnap = await tx.get(db.collection('users').doc(uid));
        const watchSnap = await tx.get(db.collection('tctv_watch').doc(uid));
        const claimsSnap = await tx.get(db.collection('users').doc(uid).collection('award_claims').where('action', '==', 'tctv_watch_ticket').limit(40));
        const nowMs = Date.now();
        const plan = planFrom(
            uid,
            drip,
            watchSnap.exists ? (watchSnap.data() || {}) : {},
            claimDays(claimsSnap),
            userSnap.exists ? (userSnap.data() || {}) : {},
            pot,
            today,
            windowStart,
            nowMs
        );
        if (!plan.willCredit) return plan;
        const patch = minutes.creditPatch(plan.owedSeconds, nowMs);
        tx.set(ref, {
            seconds: (Math.floor(Number(drip.seconds) || 0) + patch.secondsDelta),
            promptToken: patch.promptToken,
            promptDueMs: patch.promptDueMs,
            viewMinuteCreditSeconds: FieldValue.increment(patch.secondsDelta),
            viewMinuteCreditReason: patch.viewMinuteCreditReason,
            viewMinuteCreditApplied: true,
            viewMinuteCreditAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return plan;
    });
}

async function main() {
    const mode = minutes.creditMode(process.argv);
    const apply = mode === 'apply';
    const days = minutes.daysArg(process.argv);
    const admin = loadAdmin();
    if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
    const db = admin.firestore();
    const nowMs = Date.now();
    const today = minutes.dayKeyFromMs(nowMs);
    const windowStart = minutes.windowStartDay(today, days);
    const potSnap = await db.collection('tctv_drip_pot').doc('current').get();
    const pot = potSnap.exists ? (potSnap.data() || {}) : {};
    try {
        const cfgSnap = await db.collection('tctv_drip_config').doc('settings').get();
        const raw = cfgSnap.exists ? (cfgSnap.data() || {}) : {};
        if (Number(raw.perAccountLimitSeconds) > 0) pot.perAccountLimitSeconds = Math.floor(Number(raw.perAccountLimitSeconds));
    } catch (err) { /* planner default */ }

    console.log('[tctv-credit] project=' + PROJECT_ID + ' mode=' + mode + ' pot=' + (pot.potId || '') + ' status=' + (pot.status || ''));
    if (!apply) console.log('[tctv-credit] dry-run: no Firestore writes');
    if (!minutes.potIsOpen(pot.status)) {
        console.log('[tctv-credit] pot is not open. Nothing to credit.');
        console.log(JSON.stringify({ mode: mode, scanned: 0, creditedUsers: 0, owedMinutes: 0 }));
        return;
    }

    let scanned = 0;
    const plans = [];
    const refs = [];
    const snap = await db.collection('tctv_drip_watch').where('potId', '==', pot.potId).get();
    for (let i = 0; i < snap.docs.length && scanned < 200000; i++) {
        const doc = snap.docs[i];
        const drip = doc.data() || {};
        const uid = String(drip.uid || '');
        if (!uid) continue;
        scanned++;
        const ctx = await loadContext(db, uid, pot, today, windowStart, nowMs);
        const plan = planFrom(uid, drip, ctx.daily, ctx.claims, ctx.user, pot, today, windowStart, nowMs);
        plan.user = Object.assign({}, ctx.user, { uid: uid });
        plans.push(plan);
        refs.push(doc.ref);
    }
    const chosen = minutes.selectCreditRows(plans);
    for (let i = 0; i < chosen.length; i++) {
        let plan = chosen[i];
        if (apply && plan.willCredit) plan = await applyOne(db, admin, refs[i], pot, today, windowStart);
        if (!plan.willCredit && plan.reason === 'ok') continue;
        if (plan.reason === 'ok') continue;
        console.log(JSON.stringify({
            uid: plan.uid,
            reason: plan.reason,
            owedMinutes: plan.owedMinutes || 0,
            owedSeconds: plan.owedSeconds || 0,
            potSeconds: plan.potSeconds || 0,
            verifiedSeconds: plan.verifiedSeconds || 0,
            willCredit: plan.willCredit === true,
            mode: mode,
        }));
        chosen[i] = plan;
    }
    const report = minutes.creditReport(chosen);
    console.log(JSON.stringify({
        mode: mode,
        scanned: scanned,
        totalSeconds: report.totalSeconds,
        top10: report.top10,
    }));
}

if (require.main === module) {
    main().catch(function (err) {
        console.error('[tctv-credit] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}
