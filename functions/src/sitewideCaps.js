'use strict';

// Sitewide daily caps (America/New_York calendar day).
//
// Two independent caps, both counted on the server inside the relevant
// transaction:
//   * Cipher unlocks (decryptCipher): every successful open, paid or free.
//     Default 30 per ET day.
//   * Faucet claims (claimSats): only claims that were actually paid.
//     Default 10 per ET day. Availability is paid + reserved + held, so a
//     claim whose payment comes back unknown keeps its slot until an admin
//     resolves it. A reserved slot holds a place until the pay settles,
//     fails, or is held. A stale-pending sweep (about 15 minutes) moves
//     the slot from reserved to held and marks the invoice reserveSwept,
//     so it keeps counting until it pays, fails, or an admin resolves it.
//     Held claims stay on their original ET day,
//     never auto-pay after midnight, and never consume the next day's
//     slots. Claims made after the cap is reached are refused, not held.
//
// Cap numbers live on config/sitewideCaps and are changed only by the
// adminSetSitewideCaps callable (Admin SDK). Clients cannot read or write
// that doc or the daily counters (Firestore catch-all deny). Every change
// is appended to sitewide_caps_audit, like the kill switch.
//
// When a cap is hit, players see the Busy-right-now card (CAP_CARD).
// CAP_HIT_MESSAGE is the card body, and the only server error string.

const DEFAULT_UNLOCK_CAP = 30;
const DEFAULT_FAUCET_CAP = 10;
const ALERT_RATIO = 0.8;
const CAP_CARD = Object.freeze({
    title: 'Busy right now',
    body: 'Rewards are busy right now. Please try again later.',
    secondary: 'You can still play and learn in the meantime.',
    button: 'Keep exploring',
    code: 'sitewide-cap',
});
const CAP_HIT_MESSAGE = CAP_CARD.body;
const SETTINGS_COLLECTION = 'config';
const SETTINGS_DOC_ID = 'sitewideCaps';
const AUDIT_COLLECTION = 'sitewide_caps_audit';
const DAILY_COLLECTION = 'sitewide_caps_daily';
const MIN_CAP = 1;
const MAX_CAP = 100000;
const RESERVE_STALE_MS = 15 * 60 * 1000;
const RESERVE_SWEEP_LOOKBACK_MS = 48 * 60 * 60 * 1000;

function etDayKey(ms) {
    const at = ms == null ? Date.now() : Number(ms);
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(Number.isFinite(at) ? at : Date.now()));
}

function nonNeg(value) {
    const n = Math.floor(Number(value) || 0);
    return n > 0 ? n : 0;
}

function normalizeCap(value, fallback) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < MIN_CAP || n > MAX_CAP) return fallback;
    return n;
}

// Deliberate: a missing config/sitewideCaps doc uses the 30/10 defaults.
// A read error is not handled here; callers let the transaction abort so
// the unlock or faucet reserve fails closed (no write).
function settingsFromDoc(data) {
    const src = data || {};
    return {
        unlockCap: src.unlockCap != null ? normalizeCap(src.unlockCap, DEFAULT_UNLOCK_CAP) : DEFAULT_UNLOCK_CAP,
        faucetCap: src.faucetCap != null ? normalizeCap(src.faucetCap, DEFAULT_FAUCET_CAP) : DEFAULT_FAUCET_CAP,
    };
}

function alertThreshold(cap) {
    const c = Math.max(MIN_CAP, Math.floor(Number(cap) || 0));
    return Math.max(1, Math.floor(c * ALERT_RATIO));
}

function crossedThreshold(before, after, threshold) {
    return before < threshold && after >= threshold;
}

function planUnlock(used, cap) {
    const n = nonNeg(used);
    const c = normalizeCap(cap, DEFAULT_UNLOCK_CAP);
    if (n >= c) {
        return { ok: false, code: 'cap', error: CAP_HIT_MESSAGE, used: n, cap: c, usedAfter: n };
    }
    const usedAfter = n + 1;
    return {
        ok: true,
        code: 'ok',
        error: CAP_HIT_MESSAGE,
        used: n,
        usedAfter: usedAfter,
        cap: c,
        crossed80: crossedThreshold(n, usedAfter, alertThreshold(c)),
        tripped: usedAfter >= c,
    };
}

// Availability is paid + reserved + held so two in-flight pays cannot
// both take the last slot, and an unknown-status (held) claim keeps its
// slot until an admin resolves it. reserved and held are not paid counts.
function planFaucetReserve(paid, reserved, held, cap) {
    const p = nonNeg(paid);
    const r = nonNeg(reserved);
    const h = nonNeg(held);
    const c = normalizeCap(cap, DEFAULT_FAUCET_CAP);
    const used = p + r + h;
    if (used >= c) {
        return { ok: false, code: 'cap', error: CAP_HIT_MESSAGE, paid: p, reserved: r, held: h, cap: c };
    }
    return { ok: true, code: 'ok', error: CAP_HIT_MESSAGE, paid: p, reserved: r + 1, held: h, cap: c };
}

function planFaucetPaid(paid, reserved, cap) {
    const p = nonNeg(paid);
    const r = nonNeg(reserved);
    const c = normalizeCap(cap, DEFAULT_FAUCET_CAP);
    const paidAfter = p + 1;
    const reservedAfter = r > 0 ? r - 1 : 0;
    return {
        ok: true,
        paidAfter: paidAfter,
        reservedAfter: reservedAfter,
        cap: c,
        crossed80: crossedThreshold(p, paidAfter, alertThreshold(c)),
        tripped: paidAfter >= c,
    };
}

function planFaucetRelease(paid, reserved) {
    return { paid: nonNeg(paid), reserved: Math.max(0, nonNeg(reserved) - 1) };
}

function planFaucetHold(paid, reserved, held) {
    return {
        paid: nonNeg(paid),
        reserved: Math.max(0, nonNeg(reserved) - 1),
        held: nonNeg(held) + 1,
    };
}

// Sweep: move reserved -> held. Occupancy (paid+reserved+held) is unchanged.
function planStaleReserveToHeld(paid, reserved, held) {
    return {
        paid: nonNeg(paid),
        reserved: Math.max(0, nonNeg(reserved) - 1),
        held: nonNeg(held) + 1,
    };
}

// Later outcomes on a reserveSwept invoice adjust held, never reserved.
function planSweptPaid(paid, reserved, held, cap) {
    const p = nonNeg(paid);
    const r = nonNeg(reserved);
    const h = nonNeg(held);
    const c = normalizeCap(cap, DEFAULT_FAUCET_CAP);
    const paidAfter = p + 1;
    return {
        ok: true,
        paidAfter: paidAfter,
        reservedAfter: r,
        heldAfter: Math.max(0, h - 1),
        cap: c,
        crossed80: crossedThreshold(p, paidAfter, alertThreshold(c)),
        tripped: paidAfter >= c,
    };
}

function planSweptFailed(paid, reserved, held) {
    return {
        paid: nonNeg(paid),
        reserved: nonNeg(reserved),
        held: Math.max(0, nonNeg(held) - 1),
    };
}

function planSweptUnknown(paid, reserved, held) {
    return {
        paid: nonNeg(paid),
        reserved: nonNeg(reserved),
        held: nonNeg(held),
    };
}

function isReserveSwept(inv) {
    return !!(inv && (inv.reserveSwept || inv.reservedReleased));
}

// A held claim never pays on its own when the ET day rolls. An admin
// must release it. There is no auto-pay helper in this change; a later
// callable can add a proper admin release.
function planAutoPayHeld() {
    return { ok: false, reason: 'admin-required' };
}

function tsToMs(value) {
    if (value == null) return 0;
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0;
    if (typeof value.toMillis === 'function') {
        const n = Number(value.toMillis());
        return Number.isFinite(n) && n > 0 ? n : 0;
    }
    if (typeof value.seconds === 'number') return value.seconds * 1000 > 0 ? value.seconds * 1000 : 0;
    if (typeof value._seconds === 'number') return value._seconds * 1000 > 0 ? value._seconds * 1000 : 0;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function sweepWindow(nowMs, staleMs, lookbackMs) {
    const now = nowMs == null ? Date.now() : Number(nowMs);
    const stale = staleMs == null ? RESERVE_STALE_MS : Number(staleMs);
    const lookback = lookbackMs == null ? RESERVE_SWEEP_LOOKBACK_MS : Number(lookbackMs);
    return { nowMs: now, fromMs: now - lookback, toMs: now - stale, staleMs: stale, lookbackMs: lookback };
}

function rowFromInvoice(id, data) {
    const src = data || {};
    return {
        id: id,
        status: src.status,
        reserveSwept: src.reserveSwept,
        reservedReleased: src.reservedReleased,
        ts: src.ts,
        tsMs: src.tsMs,
        etDay: src.etDay,
        winId: src.winId,
    };
}

// Move a stale pending reservation to held when the invoice is still
// pending, was not already swept, has an ET day, and is older than about
// 15 minutes but not older than 48 hours. Never pays and never changes
// user balances. Occupancy stays the same.
function planStaleReserveSweep(row, nowMs, staleMs, lookbackMs) {
    const src = row || {};
    if (src.winId || String(src.id || '').indexOf('cipher_') === 0) {
        return { release: false, reason: 'not-faucet' };
    }
    if (String(src.status || '') !== 'pending') {
        return { release: false, reason: 'not-pending' };
    }
    if (isReserveSwept(src)) {
        return { release: false, reason: 'already-swept' };
    }
    if (!String(src.etDay || '').trim()) {
        return { release: false, reason: 'no-etDay' };
    }
    const ts = tsToMs(src.tsMs != null ? src.tsMs : src.ts);
    const win = sweepWindow(nowMs, staleMs, lookbackMs);
    if (!ts || !Number.isFinite(win.nowMs) || ts > win.toMs) {
        return { release: false, reason: 'fresh' };
    }
    if (ts < win.fromMs) {
        return { release: false, reason: 'too-old' };
    }
    return { release: true, reason: 'stale-pending', etDay: String(src.etDay) };
}

async function listPendingInvoicesInWindow(db, win, opts) {
    const pageSize = (opts && opts.limit) ? Number(opts.limit) : 100;
    const maxPages = (opts && opts.maxPages) ? Number(opts.maxPages) : 20;
    const from = new Date(win.fromMs);
    const to = new Date(win.toMs);
    const out = [];
    let last = null;
    for (let page = 0; page < maxPages; page++) {
        let q = db.collection('faucet_invoices')
            .where('status', '==', 'pending')
            .where('ts', '>=', from)
            .where('ts', '<=', to)
            .orderBy('ts')
            .limit(pageSize);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        const docs = (snap && snap.docs) ? snap.docs : [];
        if (!docs.length) break;
        for (let i = 0; i < docs.length; i++) out.push(docs[i]);
        last = docs[docs.length - 1];
        if (docs.length < pageSize) break;
    }
    return out;
}

async function sweepStaleFaucetReserves(db, nowMs, opts) {
    const o = opts || {};
    const now = nowMs == null ? Date.now() : Number(nowMs);
    const win = sweepWindow(now, o.staleMs, o.lookbackMs);
    // Skip while the kill switch is on. The sweep only moves a reserved
    // slot to held and never pays, but we still pause it during an outage.
    const checkOffline = typeof o.isOffline === 'function'
        ? o.isOffline
        : async function () {
            const ks = require('./killSwitch');
            return ks.isOffline(db, function () { return now; });
        };
    if (await checkOffline()) {
        return { released: 0, ids: [], skipped: 'kill-switch' };
    }
    const docs = await listPendingInvoicesInWindow(db, win, o);
    const released = [];
    for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        const data = doc.data ? (doc.data() || {}) : {};
        const plan = planStaleReserveSweep(rowFromInvoice(doc.id, data), now, win.staleMs, win.lookbackMs);
        if (!plan.release) continue;
        const movedOk = await db.runTransaction(async function (t) {
            const invSnap = await t.get(doc.ref);
            const inv = invSnap.exists ? (invSnap.data() || {}) : {};
            const again = planStaleReserveSweep(rowFromInvoice(doc.id, inv), now, win.staleMs, win.lookbackMs);
            if (!again.release) return false;
            const day = String(inv.etDay || again.etDay || '');
            if (!day) return false;
            const dayRef = dailyRef(db, day);
            const daySnap = await t.get(dayRef);
            const capDay = dayFromSnap(daySnap);
            const moved = planStaleReserveToHeld(capDay.paid, capDay.reserved, capDay.held);
            t.set(dayRef, {
                paid: moved.paid,
                reserved: moved.reserved,
                held: moved.held,
                day: day,
            }, { merge: true });
            // Slot stays occupied as held. Do not change status, amounts, or balances.
            t.set(doc.ref, {
                reserveSwept: true,
                reserveSweptAtMs: now,
            }, { merge: true });
            return true;
        });
        if (movedOk) released.push(doc.id);
    }
    return { released: released.length, ids: released };
}

function emptyDay() {
    return { unlocks: 0, paid: 0, reserved: 0, held: 0 };
}

function rolloverState() {
    // A new ET day starts empty. Held rows stay on their original day
    // document and are not copied forward.
    return emptyDay();
}

function planSettingsChange(prev, next, actorUid, nowMs) {
    const before = settingsFromDoc(prev);
    const proposed = next || {};
    if (proposed.unlockCap == null && proposed.faucetCap == null) {
        return { ok: false, error: 'Provide unlockCap and/or faucetCap.' };
    }
    function parseOne(value, fallback, name) {
        if (value == null) return { ok: true, value: fallback };
        const n = Math.floor(Number(value));
        if (!Number.isFinite(n) || n < MIN_CAP || n > MAX_CAP) {
            return { ok: false, error: name + ' must be an integer from ' + MIN_CAP + ' to ' + MAX_CAP + '.' };
        }
        return { ok: true, value: n };
    }
    const unlock = parseOne(proposed.unlockCap, before.unlockCap, 'unlockCap');
    if (!unlock.ok) return unlock;
    const faucet = parseOne(proposed.faucetCap, before.faucetCap, 'faucetCap');
    if (!faucet.ok) return faucet;
    const after = { unlockCap: unlock.value, faucetCap: faucet.value };
    if (after.unlockCap === before.unlockCap && after.faucetCap === before.faucetCap) {
        return { ok: false, error: 'No change.' };
    }
    return {
        ok: true,
        before: before,
        after: after,
        audit: {
            actorUid: String(actorUid || ''),
            atMs: nowMs == null ? Date.now() : Number(nowMs),
            before: before,
            after: after,
        },
    };
}

function settingsRef(db) {
    return db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID);
}

function dailyRef(db, day) {
    return db.collection(DAILY_COLLECTION).doc(String(day || ''));
}

function dayFromSnap(snap) {
    const data = snap && snap.exists ? (snap.data() || {}) : {};
    return {
        unlocks: nonNeg(data.unlocks),
        paid: nonNeg(data.paid),
        reserved: nonNeg(data.reserved),
        held: nonNeg(data.held),
    };
}

function unlockAlert(plan, day) {
    if (!plan || !plan.ok) return null;
    if (plan.tripped) {
        return {
            type: 'sitewide_unlock_cap_trip',
            key: 'unlock-trip-' + day,
            text: 'Sitewide cipher unlock cap reached: ' + plan.usedAfter + ' of ' + plan.cap + ' on ' + day + ' ET.',
        };
    }
    if (plan.crossed80) {
        return {
            type: 'sitewide_unlock_cap_early',
            key: 'unlock-80-' + day,
            text: 'Sitewide cipher unlock cap at ' + plan.usedAfter + ' of ' + plan.cap + ' (~80%) on ' + day + ' ET.',
        };
    }
    return null;
}

function faucetAlert(plan, day) {
    if (!plan || !plan.ok) return null;
    if (plan.tripped) {
        return {
            type: 'sitewide_faucet_cap_trip',
            key: 'faucet-trip-' + day,
            text: 'Sitewide faucet cap reached: ' + plan.paidAfter + ' paid claims of ' + plan.cap + ' on ' + day + ' ET.',
        };
    }
    if (plan.crossed80) {
        return {
            type: 'sitewide_faucet_cap_early',
            key: 'faucet-80-' + day,
            text: 'Sitewide faucet cap at ' + plan.paidAfter + ' paid claims of ' + plan.cap + ' (~80%) on ' + day + ' ET.',
        };
    }
    return null;
}

function requireTokenAdmin(context, HttpsError) {
    const auth = context && context.auth;
    if (!auth || !auth.token || auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Admins only.');
    }
    return auth;
}

function defaultStepUp(name) {
    return async function (data, context) {
        const sf = require('./secondFactor');
        return sf.requireAdminStepUp(sf.stamp(data, context), name);
    };
}

function makeAdminGetSitewideCaps(deps) {
    const functionsV1 = deps.functionsV1;
    const HttpsError = functionsV1.https.HttpsError;
    const stepUp = deps.stepUp || defaultStepUp('adminGetSitewideCaps');
    return functionsV1.runWith(deps.runWith || {}).https.onCall(async function (data, context) {
        requireTokenAdmin(context, HttpsError);
        await stepUp(data, context);
        const snap = await deps.db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID).get();
        return { ok: true, settings: settingsFromDoc(snap.exists ? snap.data() : null) };
    });
}

function makeAdminSetSitewideCaps(deps) {
    const functionsV1 = deps.functionsV1;
    const admin = deps.admin;
    const db = deps.db;
    const HttpsError = functionsV1.https.HttpsError;
    const stepUp = deps.stepUp || defaultStepUp('adminSetSitewideCaps');
    return functionsV1.runWith(deps.runWith || {}).https.onCall(async function (data, context) {
        const auth = requireTokenAdmin(context, HttpsError);
        const stamped = await stepUp(data, context);
        const uid = (stamped && stamped.uid) || auth.uid || '';
        const nowMs = Date.now();
        const result = await db.runTransaction(async function (t) {
            const ref = settingsRef(db);
            const snap = await t.get(ref);
            const plan = planSettingsChange(snap.exists ? snap.data() : null, data, uid, nowMs);
            if (!plan.ok) {
                const err = new functionsV1.https.HttpsError('invalid-argument', plan.error);
                throw err;
            }
            t.set(ref, {
                unlockCap: plan.after.unlockCap,
                faucetCap: plan.after.faucetCap,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: uid,
            }, { merge: true });
            t.set(db.collection(AUDIT_COLLECTION).doc(), {
                actorUid: uid,
                atMs: nowMs,
                before: plan.before,
                after: plan.after,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return plan;
        });
        return { ok: true, settings: result.after };
    });
}

module.exports = {
    DEFAULT_UNLOCK_CAP: DEFAULT_UNLOCK_CAP,
    DEFAULT_FAUCET_CAP: DEFAULT_FAUCET_CAP,
    ALERT_RATIO: ALERT_RATIO,
    RESERVE_STALE_MS: RESERVE_STALE_MS,
    RESERVE_SWEEP_LOOKBACK_MS: RESERVE_SWEEP_LOOKBACK_MS,
    sweepWindow: sweepWindow,
    CAP_CARD: CAP_CARD,
    CAP_HIT_MESSAGE: CAP_HIT_MESSAGE,
    SETTINGS_COLLECTION: SETTINGS_COLLECTION,
    SETTINGS_DOC_ID: SETTINGS_DOC_ID,
    AUDIT_COLLECTION: AUDIT_COLLECTION,
    DAILY_COLLECTION: DAILY_COLLECTION,
    etDayKey: etDayKey,
    settingsFromDoc: settingsFromDoc,
    alertThreshold: alertThreshold,
    planUnlock: planUnlock,
    planFaucetReserve: planFaucetReserve,
    planFaucetPaid: planFaucetPaid,
    planFaucetRelease: planFaucetRelease,
    planFaucetHold: planFaucetHold,
    planStaleReserveToHeld: planStaleReserveToHeld,
    planSweptPaid: planSweptPaid,
    planSweptFailed: planSweptFailed,
    planSweptUnknown: planSweptUnknown,
    isReserveSwept: isReserveSwept,
    planAutoPayHeld: planAutoPayHeld,
    planStaleReserveSweep: planStaleReserveSweep,
    sweepStaleFaucetReserves: sweepStaleFaucetReserves,
    requireTokenAdmin: requireTokenAdmin,
    emptyDay: emptyDay,
    rolloverState: rolloverState,
    planSettingsChange: planSettingsChange,
    settingsRef: settingsRef,
    dailyRef: dailyRef,
    dayFromSnap: dayFromSnap,
    unlockAlert: unlockAlert,
    faucetAlert: faucetAlert,
    makeAdminGetSitewideCaps: makeAdminGetSitewideCaps,
    makeAdminSetSitewideCaps: makeAdminSetSitewideCaps,
};
