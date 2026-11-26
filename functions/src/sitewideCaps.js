'use strict';

// Sitewide daily caps (America/New_York calendar day).
//
// Two independent caps, both counted on the server inside the relevant
// transaction:
//   * Cipher unlocks (decryptCipher): every successful open, paid or free.
//     Default 30 per ET day.
//   * Faucet claims (claimSats): only claims that were actually paid.
//     Default 10 per ET day. A reserved slot holds a place until the pay
//     settles, fails, or is held. Held claims stay on their original ET
//     day, never auto-pay after midnight, and never consume the next day's
//     slots. Releasing a held claim requires an admin.
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

// Availability uses paid + reserved so two in-flight pays cannot both
// take the last slot. reserved is not a paid count.
function planFaucetReserve(paid, reserved, cap) {
    const p = nonNeg(paid);
    const r = nonNeg(reserved);
    const c = normalizeCap(cap, DEFAULT_FAUCET_CAP);
    const used = p + r;
    if (used >= c) {
        return { ok: false, code: 'cap', error: CAP_HIT_MESSAGE, paid: p, reserved: r, cap: c };
    }
    return { ok: true, code: 'ok', error: CAP_HIT_MESSAGE, paid: p, reserved: r + 1, cap: c };
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

// A held claim never pays on its own when the ET day rolls. An admin
// must release it. The payout is attributed to the original claim day
// and never takes a slot on the current day if that day is different.
function planAutoPayHeld() {
    return { ok: false, reason: 'admin-required' };
}

function planAdminPayHeld(claimDay, paymentDay, paid, held, cap) {
    const day = String(claimDay || '');
    const nowDay = String(paymentDay || '');
    if (!day) return { ok: false, reason: 'no-claim-day' };
    const p = nonNeg(paid);
    const h = nonNeg(held);
    const c = normalizeCap(cap, DEFAULT_FAUCET_CAP);
    const paidAfter = p + 1;
    return {
        ok: true,
        applyDay: day,
        skipCurrentDay: nowDay !== day,
        paidAfter: paidAfter,
        heldAfter: Math.max(0, h - 1),
        cap: c,
        crossed80: crossedThreshold(p, paidAfter, alertThreshold(c)),
        tripped: paidAfter >= c,
    };
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

function makeAdminGetSitewideCaps(deps) {
    const functionsV1 = deps.functionsV1;
    const sf = require('./secondFactor');
    return functionsV1.runWith(deps.runWith || {}).https.onCall(async function (data, context) {
        await sf.requireAdminStepUp(sf.stamp(data, context), 'adminGetSitewideCaps');
        const snap = await deps.db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID).get();
        return { ok: true, settings: settingsFromDoc(snap.exists ? snap.data() : null) };
    });
}

function makeAdminSetSitewideCaps(deps) {
    const functionsV1 = deps.functionsV1;
    const admin = deps.admin;
    const db = deps.db;
    const sf = require('./secondFactor');
    return functionsV1.runWith(deps.runWith || {}).https.onCall(async function (data, context) {
        const stamped = await sf.requireAdminStepUp(sf.stamp(data, context), 'adminSetSitewideCaps');
        const uid = (stamped && stamped.uid) || (context.auth && context.auth.uid) || '';
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
    planAutoPayHeld: planAutoPayHeld,
    planAdminPayHeld: planAdminPayHeld,
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
