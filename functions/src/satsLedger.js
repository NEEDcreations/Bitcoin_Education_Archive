'use strict';

// App-wide monthly sats ledger with a HARD cap (Phil, Nov 14 2026: "I want to
// set a hard 100k monthly sats limit GOING Forward").
//
// One ledger for every sats payout the app makes. Each automated payout path
// reserves its amount here inside a Firestore transaction BEFORE any wallet
// call, and the reserve is refused when it would push the ET calendar month
// past MONTHLY_CAP_SATS (100,000). After the wallet call:
//   clear failure  -> release (the sats go back to the month)
//   unknown result -> held    (still counted; a person resolves it)
//   paid           -> paid    (counted; spend trued up when it differs)
// Payouts made outside the app (raffle, jackpot, big cipher tiers, faction
// pots paid by hand) are written with recordManual. They are never refused,
// because the sats already left, but they count toward the month.
//
// Lines inside the 100k total:
//   favor  45,000  enforced by favorBlockClaims.js as before (unchanged)
//   other  55,000  everything that is not Favor (faucet, cipher sats incl. the
//                  TCTV drip, cipher wins incl. faction pots, manual payouts).
//                  Enforced here behind sats_ledger_config/settings
//                  .otherLineEnabled, which defaults ON (only an explicit
//                  false turns it off). The 100k total is ALWAYS enforced.
//
// EXEMPT: the one-time Satoshi's Favor catch-up for epochs 1-8. Phil pays it
// as is ("Don't worry about the epoch payment catch up. I'll pay that as
// is."). It never reserves here, never counts toward the cap and is never
// blocked by it. It only gets an audit row with status 'exempt'.
//
// Month keys are America/New_York (yyyy-MM), so a month rolls over at
// midnight ET, not at 7 PM ET like a UTC key would.
//
// Collections (server only; the firestore.rules catch-all denies clients).
// Both are PERMANENT: rows only ever change status, nothing is deleted.
//   sats_ledger_months/{yyyy-MM}  { month, capSats, committedSats, bySource, alert80AtMs, ... }
//   sats_ledger_entries/{entryId} { source, amount, month, status, attempts, ... }
//   sats_ledger_config/settings   { otherLineEnabled } (optional)
// Alerts: admin_notifications/sats_cap_80_{yyyy-MM} (type 'sats_cap'), the
// same collection the kill switch and Favor claims alert into. No emails.
//
// Works with the Admin SDK and with the in-memory test Firestore: only
// t.get / t.set, plain numbers (no FieldValue), all reads before writes.

const MONTHLY_CAP_SATS = 100000;
const FAVOR_LINE_SATS = 45000; // informational: enforced in favorBlockClaims.js
const OTHER_LINE_SATS = 55000;
const ALERT_PCT = 80;
const TZ = 'America/New_York';
const MONTHS = 'sats_ledger_months';
const ENTRIES = 'sats_ledger_entries';
const CONFIG = 'sats_ledger_config';
const ALERTS = 'admin_notifications';
const PERMANENT_COLLECTIONS = Object.freeze([MONTHS, ENTRIES]);
const SOURCES = Object.freeze(['faucet', 'cipher_sats', 'cipher_win', 'favor', 'manual']);
const MANUAL_KINDS = Object.freeze(['raffle', 'jackpot', 'cipher_tier', 'faction_pot', 'cipher_win', 'admin_send', 'other']);
// Statuses that count toward the month.
const COUNTED = Object.freeze({ reserved: true, held: true, paid: true });
const FAVOR_CATCH_UP_EXEMPT = Object.freeze({ firstEpoch: 1, lastEpoch: 8 });
const MAX_MANUAL_SATS = 1000000;

const CAP_MESSAGE = 'This month\'s sats budget is used up. Your sats are safe; payouts are back on the 1st of next month (midnight ET).';

const _fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' });
function etMonthKey(ms) {
    const parts = _fmt.formatToParts(new Date(Number(ms)));
    let y = '';
    let m = '';
    parts.forEach(function (p) { if (p.type === 'year') y = p.value; if (p.type === 'month') m = p.value; });
    return y + '-' + m;
}

function int0(v) { const n = Math.floor(Number(v) || 0); return n > 0 ? n : 0; }
function safeKey(v) { return String(v == null ? '' : v).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 160); }
function entryId(source, key) { return safeKey(source) + '_' + safeKey(key); }
function alertThreshold(cap) { return Math.ceil(cap * ALERT_PCT / 100); }
function otherLineEnabled(cfg) { return !(cfg && cfg.otherLineEnabled === false); }
function otherUsed(monthDoc) {
    const m = monthDoc || {};
    return Math.max(0, int0(m.committedSats) - int0((m.bySource || {}).favor));
}

// The ONLY exemption. Explicit on purpose so nobody widens it by accident.
function isExempt(info) {
    const i = info || {};
    return i.source === 'favor' && i.catchUp === true && Number.isInteger(i.epoch) &&
        i.epoch >= FAVOR_CATCH_UP_EXEMPT.firstEpoch && i.epoch <= FAVOR_CATCH_UP_EXEMPT.lastEpoch;
}

// Pure: may `amount` from `source` be reserved against this month?
function planReserve(monthDoc, entry, amount, opts) {
    const o = opts || {};
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0 || amt !== Number(amount)) return { ok: false, code: 'bad_amount' };
    if (entry && entry.status === 'exempt') return { ok: false, code: 'exempt_entry' };
    if (entry && COUNTED[entry.status]) return { ok: true, already: true, code: 'already' };
    const used = int0(monthDoc && monthDoc.committedSats);
    if (used + amt > MONTHLY_CAP_SATS) return { ok: false, code: 'monthly_cap', used: used, cap: MONTHLY_CAP_SATS, remaining: Math.max(0, MONTHLY_CAP_SATS - used) };
    if (o.source && o.source !== 'favor' && otherLineEnabled(o.config)) {
        const other = otherUsed(monthDoc);
        if (other + amt > OTHER_LINE_SATS) return { ok: false, code: 'monthly_cap', line: 'other', used: other, cap: OTHER_LINE_SATS, remaining: Math.max(0, OTHER_LINE_SATS - other) };
    }
    return { ok: true, already: false, code: 'ok', used: used, after: used + amt, cap: MONTHLY_CAP_SATS };
}

// A transaction-scoped view of the ledger. Call the load* methods first
// (they read), then the mutations (memory only), then flush() (writes).
// Several operations on the same month in one transaction stay consistent.
function session(t, db, nowMs) {
    const now = Number(nowMs) || Date.now();
    const months = {};
    const entries = {};
    const dirtyMonths = {};
    const dirtyEntries = {};
    const alerts = [];
    let config;
    let flushed = false;

    async function loadConfig() {
        if (config === undefined) {
            const snap = await t.get(db.collection(CONFIG).doc('settings'));
            config = snap.exists ? (snap.data() || {}) : {};
        }
        return config;
    }
    async function loadMonth(key) {
        if (!key) return null;
        if (months[key] === undefined) {
            const snap = await t.get(db.collection(MONTHS).doc(key));
            months[key] = snap.exists ? (snap.data() || {}) : null;
        }
        return months[key];
    }
    async function loadEntry(id) {
        if (!id) return null;
        if (entries[id] === undefined) {
            const snap = await t.get(db.collection(ENTRIES).doc(id));
            entries[id] = snap.exists ? (snap.data() || {}) : null;
        }
        const e = entries[id];
        if (e && e.month) await loadMonth(e.month);
        return e;
    }
    // Reads everything a reserve needs: the entry, its month, this month, config.
    async function loadForReserve(id) {
        await loadEntry(id);
        await loadMonth(etMonthKey(now));
        await loadConfig();
        return entries[id];
    }
    function monthOf(key) {
        if (months[key] === undefined) throw new Error('satsLedger: month ' + key + ' not loaded');
        if (!months[key]) months[key] = { month: key, capSats: MONTHLY_CAP_SATS, committedSats: 0, bySource: {}, createdAtMs: now };
        return months[key];
    }
    function entryOf(id) {
        if (entries[id] === undefined) throw new Error('satsLedger: entry ' + id + ' not loaded');
        return entries[id];
    }
    function bump(key, source, delta) {
        const m = monthOf(key);
        m.committedSats = Math.max(0, int0(m.committedSats) + delta);
        const by = Object.assign({}, m.bySource || {});
        by[source] = Math.max(0, int0(by[source]) + delta);
        m.bySource = by;
        m.capSats = MONTHLY_CAP_SATS;
        m.otherLineSats = OTHER_LINE_SATS;
        m.updatedAtMs = now;
        dirtyMonths[key] = true;
        if (delta > 0 && m.committedSats >= alertThreshold(MONTHLY_CAP_SATS) && !m.alert80AtMs) {
            m.alert80AtMs = now;
            alerts.push({ month: key, committedSats: m.committedSats });
        }
    }
    function check(id, amount, source) {
        if (config === undefined) throw new Error('satsLedger: config not loaded');
        return planReserve(monthOf(etMonthKey(now)), entryOf(id), amount, { source: source, config: config });
    }
    function reserve(id, opts) {
        const o = opts || {};
        if (SOURCES.indexOf(o.source) === -1 || o.source === 'manual') return { ok: false, code: 'bad_source' };
        const key = etMonthKey(now);
        const plan = check(id, o.amount, o.source);
        if (!plan.ok || plan.already) return plan;
        const prev = entryOf(id);
        const amt = plan.after - plan.used;
        const row = Object.assign({}, prev || {}, o.meta || {}, {
            entryId: id, source: o.source, amount: amt, reservedSats: amt,
            month: key, status: 'reserved', reservedAtMs: now, updatedAtMs: now,
            attempts: int0(prev && prev.attempts) + 1,
        });
        if (!prev) row.createdAtMs = now;
        entries[id] = row;
        dirtyEntries[id] = true;
        bump(key, o.source, amt);
        return plan;
    }
    // Clear failure: give the sats back to the month they were reserved in.
    // A 'held' row is released only with allowHeld (a proven-failed lookup).
    function release(id, opts) {
        const o = opts || {};
        const e = entryOf(id);
        if (!e) return false;
        if (!(e.status === 'reserved' || (e.status === 'held' && o.allowHeld === true))) return false;
        bump(e.month, e.source, -int0(e.amount));
        Object.assign(e, { status: 'released', releasedAtMs: now, releaseReason: String(o.reason || '').slice(0, 80), updatedAtMs: now,
            releasedCount: int0(e.releasedCount) + 1 });
        dirtyEntries[id] = true;
        return true;
    }
    function held(id, opts) {
        const e = entryOf(id);
        if (!e || e.status !== 'reserved') return false;
        Object.assign(e, { status: 'held', heldAtMs: now, heldReason: String((opts && opts.reason) || 'unknown').slice(0, 80), updatedAtMs: now });
        dirtyEntries[id] = true;
        return true;
    }
    // Paid. spentSats (optional) trues the month up to what really left.
    function paid(id, opts) {
        const o = opts || {};
        const e = entryOf(id);
        if (!e || !(e.status === 'reserved' || e.status === 'held')) return false;
        if (o.spentSats != null) {
            const spent = int0(o.spentSats);
            const delta = spent - int0(e.amount);
            if (delta) bump(e.month, e.source, delta);
            e.amount = spent;
        }
        Object.assign(e, { status: 'paid', paidAtMs: now, updatedAtMs: now, paidVia: String(o.via || '').slice(0, 40) });
        dirtyEntries[id] = true;
        return true;
    }
    // Paid outside the app. Never refused; counts toward the month it was paid in.
    function recordManual(id, opts) {
        const o = opts || {};
        const prev = entryOf(id);
        if (prev) return { recorded: false, already: true, month: prev.month };
        const paidAtMs = Number(o.paidAtMs) || now;
        const key = etMonthKey(paidAtMs);
        if (months[key] === undefined) throw new Error('satsLedger: month ' + key + ' not loaded');
        const amt = int0(o.amount);
        const before = int0(monthOf(key).committedSats);
        const over = before + amt > MONTHLY_CAP_SATS;
        entries[id] = Object.assign({}, o.meta || {}, {
            entryId: id, source: 'manual', kind: String(o.kind || 'other'), amount: amt, month: key,
            status: 'paid', manual: true, paidAtMs: paidAtMs, createdAtMs: now, updatedAtMs: now, overCap: over,
        });
        dirtyEntries[id] = true;
        bump(key, 'manual', amt);
        return { recorded: true, month: key, committedSats: before + amt, overCap: over };
    }
    // Audit row for an exempt payout (Favor catch-up). Never counted.
    function recordExempt(id, opts) {
        const o = opts || {};
        if (entryOf(id)) return false;
        entries[id] = Object.assign({}, o.meta || {}, {
            entryId: id, source: String(o.source || 'favor'), amount: int0(o.amount), month: etMonthKey(now),
            status: 'exempt', exemptReason: String(o.reason || 'favor_catch_up_e1_8'), createdAtMs: now, updatedAtMs: now,
        });
        dirtyEntries[id] = true;
        return true;
    }
    function flush() {
        if (flushed) return;
        flushed = true;
        Object.keys(dirtyMonths).forEach(function (k) { t.set(db.collection(MONTHS).doc(k), months[k], { merge: true }); });
        Object.keys(dirtyEntries).forEach(function (id) { t.set(db.collection(ENTRIES).doc(id), entries[id], { merge: true }); });
        alerts.forEach(function (a) {
            t.set(db.collection(ALERTS).doc('sats_cap_80_' + a.month), {
                type: 'sats_cap', level: 'cap_80', month: a.month,
                committedSats: a.committedSats, capSats: MONTHLY_CAP_SATS, pct: ALERT_PCT,
                text: 'Sats ledger: ' + a.month + ' (ET) has passed ' + ALERT_PCT + '% of the ' + MONTHLY_CAP_SATS.toLocaleString('en-US') +
                    '-sat monthly cap (' + a.committedSats.toLocaleString('en-US') + ' committed). Payouts are refused once the cap is reached.',
                createdAtMs: now, createdAt: new Date(now), read: false,
            }, { merge: true });
        });
    }
    return {
        nowMs: now, monthKey: etMonthKey(now),
        loadConfig: loadConfig, loadMonth: loadMonth, loadEntry: loadEntry, loadForReserve: loadForReserve,
        check: check, reserve: reserve, release: release, held: held, paid: paid,
        recordManual: recordManual, recordExempt: recordExempt, flush: flush,
        entry: function (id) { return entries[id]; },
        month: function (key) { return months[key]; },
    };
}

// Runs fn(session) in its own transaction and flushes.
async function withLedger(db, nowMs, fn) {
    let out;
    await db.runTransaction(async function (t) {
        const L = session(t, db, nowMs);
        out = await fn(L, t);
        L.flush();
    });
    return out;
}

// Standalone after-the-wallet helpers (their own small transaction). Each is
// idempotent. A failure here only ever leaves sats COUNTED, never uncounted.
async function release(db, id, opts) {
    return withLedger(db, opts && opts.nowMs, async function (L) { await L.loadEntry(id); return L.release(id, opts); });
}
async function markHeld(db, id, opts) {
    return withLedger(db, opts && opts.nowMs, async function (L) { await L.loadEntry(id); return L.held(id, opts); });
}
async function markPaid(db, id, opts) {
    return withLedger(db, opts && opts.nowMs, async function (L) { await L.loadEntry(id); return L.paid(id, opts); });
}
async function reserve(db, id, opts) {
    return withLedger(db, opts && opts.nowMs, async function (L) { await L.loadForReserve(id); return L.reserve(id, opts); });
}
async function recordManual(db, id, opts) {
    const o = opts || {};
    return withLedger(db, o.nowMs, async function (L) {
        await L.loadEntry(id);
        await L.loadMonth(etMonthKey(Number(o.paidAtMs) || L.nowMs));
        return L.recordManual(id, o);
    });
}
async function recordExempt(db, id, opts) {
    return withLedger(db, opts && opts.nowMs, async function (L) { await L.loadEntry(id); return L.recordExempt(id, opts); });
}
async function safe(label, p) {
    try { return await p; } catch (e) { console.error('[satsLedger] ' + label + ' failed (sats stay counted):', e && e.message); return null; }
}

// Pure validation for the admin "record manual payout" callable.
function parseManualPayout(data, nowMs) {
    const d = data || {};
    const amount = Number(d.amount);
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_MANUAL_SATS) return { ok: false, error: 'Amount must be a whole number of sats from 1 to 1,000,000.' };
    const kind = String(d.kind || '');
    if (MANUAL_KINDS.indexOf(kind) === -1) return { ok: false, error: 'Kind must be one of: ' + MANUAL_KINDS.join(', ') + '.' };
    const ref = String(d.ref || '').trim();
    if (!ref || ref.length > 120 || !/^[A-Za-z0-9_.:-]+$/.test(ref)) return { ok: false, error: 'A reference id (letters, digits, _ . : -) is required so the same payout is never recorded twice.' };
    const paidAtMs = d.paidAtMs == null ? Number(nowMs) : Number(d.paidAtMs);
    if (!Number.isFinite(paidAtMs) || paidAtMs <= 0 || paidAtMs > Number(nowMs) + 5 * 60 * 1000 || paidAtMs < Number(nowMs) - 366 * 86400000) {
        return { ok: false, error: 'paidAtMs must be within the last year and not in the future.' };
    }
    return { ok: true, id: entryId('manual_' + kind, ref), amount: amount, kind: kind, ref: ref, paidAtMs: Math.floor(paidAtMs), note: String(d.note || '').slice(0, 300) };
}

module.exports = {
    MONTHLY_CAP_SATS, FAVOR_LINE_SATS, OTHER_LINE_SATS, ALERT_PCT, TZ, MONTHS, ENTRIES, CONFIG, ALERTS, PERMANENT_COLLECTIONS,
    SOURCES, MANUAL_KINDS, COUNTED, FAVOR_CATCH_UP_EXEMPT, CAP_MESSAGE, MAX_MANUAL_SATS,
    etMonthKey, entryId, isExempt, planReserve, otherLineEnabled, otherUsed, alertThreshold, session, withLedger,
    release, markHeld, markPaid, reserve, recordManual, recordExempt, safe, parseManualPayout,
};
