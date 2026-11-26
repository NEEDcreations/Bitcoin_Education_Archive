'use strict';
// Shared admin alerts for payout events. Writes the same
// `admin_notifications` collection Favor and the kill switch already use.
// Optional per-admin `notifications` rows match the kill-switch pattern.
// Deduped once per key per America/New_York calendar day. Never logs
// destinations, invoices, preimages, or wallet secrets.

const MONTHLY_BUDGET_SATS = 100000;
const BUDGET_WARN_SATS = 80000;
const BUDGET_CRIT_SATS = 95000;

const TYPES = Object.freeze({
    unmatched_payment: 'payout_unmatched',
    stuck_paying: 'payout_stuck_paying',
    budget_nearing: 'payout_budget_nearing',
    cap_hit: 'payout_cap_hit',
    address_change: 'payout_address_change',
});

function etDayKey(ms) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(ms));
}

function etMonthKey(ms) {
    return etDayKey(ms).slice(0, 7);
}

function maskUid(uid) {
    const s = String(uid || '');
    if (s.length <= 4) return '…';
    return s.slice(0, 2) + '…' + s.slice(-2);
}

function sanitizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function cursorId(key, nowMs) {
    return 'payout_alert_' + String(key).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120) + '_' + etDayKey(nowMs);
}

// Returns true if this is the first alert for (key, ET day) and the
// notification was written (or at least attempted after winning the cursor).
async function emit(deps, opts) {
    const db = deps.db;
    const admin = deps.admin;
    const o = opts || {};
    const nowMs = o.nowMs != null ? o.nowMs : (deps.nowMs ? deps.nowMs() : Date.now());
    const type = TYPES[o.kind] || o.type || 'payout_alert';
    const key = String(o.key || type).slice(0, 120);
    const text = sanitizeText(o.text);
    if (!text) return false;
    const FieldValue = admin && admin.firestore && admin.firestore.FieldValue;
    const stamp = FieldValue && FieldValue.serverTimestamp ? FieldValue.serverTimestamp() : nowMs;

    if (!o.everyTime) {
        const id = cursorId(key, nowMs);
        try {
            await db.collection('payout_alert_cursors').doc(id).create({
                atMs: nowMs, key: key, type: type,
            });
        } catch (e) {
            return false;
        }
    }

    try {
        await db.collection('admin_notifications').add({
            type: type,
            text: text,
            key: key,
            extra: o.extra && typeof o.extra === 'object' ? o.extra : null,
            createdAt: stamp,
            read: false,
        });
    } catch (e) {
        console.warn('[payoutAlerts] admin_notifications failed');
    }

    if (typeof deps.listAdminUids === 'function') {
        try {
            const admins = await deps.listAdminUids();
            for (let i = 0; i < (admins || []).length; i++) {
                try {
                    await db.collection('notifications').add({
                        recipientId: admins[i],
                        senderName: 'Bitcoin Quest',
                        type: 'security',
                        message: text,
                        read: false,
                        createdAt: stamp,
                    });
                } catch (err) { /* one admin must not block the rest */ }
            }
        } catch (e) { /* listing admins is best-effort */ }
    }
    return true;
}

function budgetBand(spentSats) {
    const n = Math.max(0, Math.floor(Number(spentSats) || 0));
    if (n >= MONTHLY_BUDGET_SATS) return 'cap';
    if (n >= BUDGET_CRIT_SATS) return 'critical';
    if (n >= BUDGET_WARN_SATS) return 'warn';
    return '';
}

function budgetAlertText(spentSats, monthKey) {
    const n = Math.max(0, Math.floor(Number(spentSats) || 0));
    const band = budgetBand(n);
    if (!band) return '';
    if (band === 'cap') {
        return 'Monthly sats budget reached: ' + n + ' of ' + MONTHLY_BUDGET_SATS + ' sats in ' + monthKey + '.';
    }
    if (band === 'critical') {
        return 'Monthly sats budget nearly used: ' + n + ' of ' + MONTHLY_BUDGET_SATS + ' sats in ' + monthKey + '.';
    }
    return 'Monthly sats budget is at ' + n + ' of ' + MONTHLY_BUDGET_SATS + ' sats in ' + monthKey + '.';
}

module.exports = {
    MONTHLY_BUDGET_SATS: MONTHLY_BUDGET_SATS,
    BUDGET_WARN_SATS: BUDGET_WARN_SATS,
    BUDGET_CRIT_SATS: BUDGET_CRIT_SATS,
    TYPES: TYPES,
    etDayKey: etDayKey,
    etMonthKey: etMonthKey,
    maskUid: maskUid,
    cursorId: cursorId,
    emit: emit,
    budgetBand: budgetBand,
    budgetAlertText: budgetAlertText,
};
