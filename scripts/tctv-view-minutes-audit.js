#!/usr/bin/env node
'use strict';

// READ ONLY. Compares recent Timechain TV watch minutes with the pot of sats
// ledger and lists accounts that may be owed pot seconds.
//
// It never writes. --apply is refused. To add the owed seconds, review this
// report, then run scripts/tctv-drip-minute-credit.js (dry-run unless --apply).
//
//   node scripts/tctv-view-minutes-audit.js
//   node scripts/tctv-view-minutes-audit.js --days 7
//
// Credentials: Application Default Credentials. No service-account JSON.

const path = require('path');
const minutes = require('./tctv-view-minutes');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'bitcoin-education-archive';
const PAGE_SIZE = 300;

function loadAdmin() {
    try {
        return require('firebase-admin');
    } catch (err) {
        try {
            return require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
        } catch (err2) {
            console.error('[tctv-minutes] firebase-admin is not installed. From the repo root: cd functions && npm ci');
            process.exit(1);
        }
    }
}

function claimDays(snap) {
    const out = [];
    if (!snap || !snap.docs) return out;
    snap.docs.forEach(function (doc) {
        const data = doc.data() || {};
        if (data.action !== 'tctv_watch_ticket') return;
        if (typeof data.day === 'string') out.push({ day: data.day });
    });
    return out;
}

function rowFor(uid, drip, daily, claims, user, pot, today, windowStart, nowMs) {
    const stuck = minutes.promptStuckState(drip, nowMs);
    const verified = minutes.verifiedWatchSeconds({
        today: today,
        daily: daily || {},
        claims: claims,
        potCreatedMs: pot && pot.createdMs,
        windowStart: windowStart,
    });
    const plan = minutes.assessPotCredit({
        uid: uid,
        potSeconds: drip ? drip.seconds : 0,
        verifiedSeconds: verified.verified,
        promptStuck: stuck.stuck,
        stuckCreditSeconds: stuck.stuckCreditSeconds,
        ageOk: drip ? drip.ageOk === true : false,
        blocked: minutes.userIsBlocked(user),
        potOpen: minutes.potIsOpen(pot && pot.status),
        hasDripDoc: !!drip,
        perAccountLimitSeconds: pot && pot.perAccountLimitSeconds,
    });
    return {
        uid: plan.uid,
        reason: plan.reason,
        accurate: plan.accurate,
        potSeconds: plan.potSeconds,
        verifiedSeconds: plan.verifiedSeconds,
        todayVerified: verified.todayVerified,
        claimDays: verified.claimDays,
        gapMinutes: plan.gapMinutes,
        owedMinutes: plan.owedMinutes,
        promptStuck: plan.promptStuck,
        willCredit: plan.willCredit,
    };
}

async function main() {
    if (minutes.auditRejectsApply(process.argv)) {
        console.error('[tctv-minutes] this script is read-only. It does not accept --apply.');
        console.error('[tctv-minutes] review the report, then run scripts/tctv-drip-minute-credit.js (add --apply only to write).');
        process.exit(2);
    }
    const days = minutes.daysArg(process.argv);
    const admin = loadAdmin();
    if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
    const db = admin.firestore();
    const nowMs = Date.now();
    const today = minutes.dayKeyFromMs(nowMs);
    const windowStart = minutes.windowStartDay(today, days);
    const potSnap = await db.collection('tctv_drip_pot').doc('current').get();
    const pot = potSnap.exists ? (potSnap.data() || {}) : {};
    let perAccount = 0;
    try {
        const cfgSnap = await db.collection('tctv_drip_config').doc('settings').get();
        const raw = cfgSnap.exists ? (cfgSnap.data() || {}) : {};
        if (Number(raw.perAccountLimitSeconds) > 0) perAccount = Math.floor(Number(raw.perAccountLimitSeconds));
    } catch (err) { /* default in the planner */ }
    pot.perAccountLimitSeconds = perAccount;

    console.log('[tctv-minutes] project=' + PROJECT_ID + ' mode=read-only days=' + days + ' window=' + windowStart + '..' + today);
    console.log('[tctv-minutes] no Firestore writes');

    const dripByUid = new Map();
    if (pot.potId) {
        // Equality on potId only, same query the minute tick already uses.
        const snap = await db.collection('tctv_drip_watch').where('potId', '==', pot.potId).get();
        snap.docs.forEach(function (doc) {
            const data = doc.data() || {};
            if (data.uid) dripByUid.set(String(data.uid), data);
        });
    }

    const seen = new Set();
    let scanned = 0;
    let inaccurate = 0;
    let owedUsers = 0;
    let owedMinutes = 0;
    let lastWatch = null;
    while (scanned < 500000) {
        let q = db.collection('tctv_watch').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
        if (lastWatch) q = q.startAfter(lastWatch);
        const snap = await q.get();
        if (snap.empty) break;
        lastWatch = snap.docs[snap.docs.length - 1];
        for (let i = 0; i < snap.docs.length; i++) {
            const doc = snap.docs[i];
            const daily = doc.data() || {};
            const uid = doc.id;
            const drip = dripByUid.get(uid) || null;
            const activeToday = daily.day === today || daily.lifeDay === today || daily.awardedDay === today;
            if (!drip && !activeToday) continue;
            seen.add(uid);
            scanned++;
            const userSnap = await db.collection('users').doc(uid).get();
            const user = userSnap.exists ? (userSnap.data() || {}) : {};
            const claimsSnap = await db.collection('users').doc(uid).collection('award_claims').where('action', '==', 'tctv_watch_ticket').limit(40).get();
            const plan = rowFor(uid, drip, daily, claimDays(claimsSnap), user, pot, today, windowStart, nowMs);
            if (!plan.accurate) inaccurate++;
            if (plan.willCredit) { owedUsers++; owedMinutes += plan.owedMinutes; }
            if (!plan.accurate || plan.promptStuck) console.log(JSON.stringify(plan));
        }
        if (snap.size < PAGE_SIZE) break;
    }

    // Pot watchers with no daily ledger doc still need a row.
    const dripIds = Array.from(dripByUid.keys());
    for (let i = 0; i < dripIds.length; i++) {
        const uid = dripIds[i];
        if (seen.has(uid)) continue;
        scanned++;
        const userSnap = await db.collection('users').doc(uid).get();
        const user = userSnap.exists ? (userSnap.data() || {}) : {};
        const claimsSnap = await db.collection('users').doc(uid).collection('award_claims').where('action', '==', 'tctv_watch_ticket').limit(40).get();
        const plan = rowFor(uid, dripByUid.get(uid), {}, claimDays(claimsSnap), user, pot, today, windowStart, nowMs);
        if (!plan.accurate) inaccurate++;
        if (plan.willCredit) { owedUsers++; owedMinutes += plan.owedMinutes; }
        if (!plan.accurate || plan.promptStuck) console.log(JSON.stringify(plan));
    }

    console.log(JSON.stringify({
        mode: 'read-only',
        potId: pot.potId || '',
        potStatus: pot.status || '',
        days: days,
        windowStart: windowStart,
        today: today,
        scanned: scanned,
        inaccurate: inaccurate,
        owedUsers: owedUsers,
        owedMinutes: owedMinutes,
    }));
}

if (require.main === module) {
    main().catch(function (err) {
        console.error('[tctv-minutes] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}
