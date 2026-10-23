'use strict';

// Server-side Satoshi's Favor window posts.
// One window-id doc (satoshiFavorAnnouncements/{cycleId}) claims each post
// and the push. A retry sees the flag or the chat doc and does not post again.
// No reward logic lives here. Display names only; emails and uids never
// go into the chat text.

const OPEN_FLAG = 'openPosted';
const REMINDER_FLAG = 'reminderPosted';
const RECAP_FLAG = 'recapPosted';
const PUSH_FLAG = 'pushSent';
const REMINDER_MS = 5 * 60 * 1000;
const MIN_WINDOW_FOR_REMINDER_MS = 15 * 60 * 1000;
const PRESENCE_MS = 90 * 1000;
const PRESENCE_CAP = 300;

function toMillis(value) {
    if (value == null) return 0;
    if (typeof value === 'number' && isFinite(value)) return value;
    if (value instanceof Date) {
        const ms = value.getTime();
        return isFinite(ms) ? ms : 0;
    }
    if (typeof value.toMillis === 'function') {
        const ms = value.toMillis();
        return typeof ms === 'number' && isFinite(ms) ? ms : 0;
    }
    const seconds = typeof value.seconds === 'number' ? value.seconds
        : (typeof value._seconds === 'number' ? value._seconds : null);
    if (seconds == null) return 0;
    const nanos = typeof value.nanoseconds === 'number' ? value.nanoseconds
        : (typeof value._nanoseconds === 'number' ? value._nanoseconds : 0);
    return seconds * 1000 + Math.floor(nanos / 1e6);
}

function favorWindowId(state) {
    const raw = state && state.currentCycleId != null ? String(state.currentCycleId) : '';
    return raw.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
}

function effectiveEndMs(state) {
    const endBase = toMillis(state && state.favorEndBase);
    const bonusMs = ((state && state.bonusMinutes) || 0) * 60 * 1000;
    return endBase + bonusMs;
}

function windowDurationMs(state) {
    const start = toMillis(state && state.favorStart);
    const end = effectiveEndMs(state);
    if (!start || !end || end <= start) return 0;
    return end - start;
}

function remainingMinutes(state, nowMs) {
    const rem = effectiveEndMs(state) - nowMs;
    return Math.max(1, Math.ceil(rem / 60000));
}

function openText(minutes) {
    const m = Math.max(1, Math.floor(Number(minutes) || 1));
    return "⛏️ Satoshi's Favor is OPEN! Hash now for a shot at sats. Ends in " + m + " min → [Hash now](#favor)";
}

function reminderText(minutes) {
    const m = Math.max(1, Math.floor(Number(minutes) || 1));
    return "⛏️ Satoshi's Favor is still open. About " + m + " min left. Hash now for a shot at sats → [Hash now](#favor)";
}

function looksLikeEmail(value) {
    const s = String(value || '');
    if (s.indexOf('@') !== -1) return true;
    return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(s);
}

// Public chat display name. Drops emails, markup, and links.
function safeDisplayName(name) {
    const raw = String(name || '');
    if (!raw || looksLikeEmail(raw)) return '';
    let s = raw.replace(/[\r\n<>"'`]/g, ' ');
    s = s.replace(/[\[\]\(\)]/g, ' ');
    s = s.replace(/https?:\/\/\S+/gi, '');
    s = s.replace(/[@]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim().slice(0, 32);
    if (!s || looksLikeEmail(s)) return '';
    return s;
}

function winnerNames(winners) {
    const list = Array.isArray(winners) ? winners : [];
    const names = [];
    const seen = {};
    for (let i = 0; i < list.length; i++) {
        const row = list[i] || {};
        const raw = row.username != null ? row.username : row.name;
        if (looksLikeEmail(raw)) continue;
        const name = safeDisplayName(raw);
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen[key]) continue;
        seen[key] = true;
        names.push(name);
        if (names.length >= 8) break;
    }
    return names;
}

function recapText(input) {
    const src = input || {};
    const hashers = Math.max(0, Math.floor(Number(src.hashers) || 0));
    const names = winnerNames(src.winners);
    const blockCount = Math.max(names.length, Math.max(0, Math.floor(Number(src.winnerCount) || 0)));
    const shown = names.length;
    let msg = "⏱️ Satoshi's Favor closed. " + hashers + (hashers === 1 ? ' pleb hashed.' : ' plebs hashed.');
    if (blockCount <= 0) {
        msg += ' No blocks this window. Keep earning points for the next one. 🦌';
        return msg;
    }
    msg += ' ' + blockCount + (blockCount === 1 ? ' block solved' : ' blocks solved');
    if (shown === 1) msg += ' — congrats @' + names[0] + '!';
    else if (shown > 1) msg += ' — congrats @' + names.join(', @') + '!';
    else msg += '.';
    msg += ' 🦌';
    return msg;
}

function planOpen(state, marker, nowMs) {
    if (!state || state.favorActive !== true) return { post: false, reason: 'inactive' };
    const id = favorWindowId(state);
    if (!id) return { post: false, reason: 'no_window' };
    if (marker && marker[OPEN_FLAG] === true) return { post: false, reason: 'already_posted' };
    const end = effectiveEndMs(state);
    if (!end || end <= nowMs) return { post: false, reason: 'expired' };
    return {
        post: true,
        reason: 'ok',
        kind: 'open',
        windowId: id,
        flag: OPEN_FLAG,
        text: openText(remainingMinutes(state, nowMs)),
    };
}

function planReminder(state, marker, nowMs, extra) {
    const opts = extra || {};
    if (opts.openJustPosted) return { post: false, reason: 'open_just_posted' };
    if (!state || state.favorActive !== true) return { post: false, reason: 'inactive' };
    const id = favorWindowId(state);
    if (!id) return { post: false, reason: 'no_window' };
    if (marker && marker[REMINDER_FLAG] === true) return { post: false, reason: 'already_posted' };
    if (windowDurationMs(state) < MIN_WINDOW_FOR_REMINDER_MS) return { post: false, reason: 'window_too_short' };
    const remaining = effectiveEndMs(state) - nowMs;
    if (remaining <= 0) return { post: false, reason: 'expired' };
    if (remaining > REMINDER_MS) return { post: false, reason: 'not_yet' };
    return {
        post: true,
        reason: 'ok',
        kind: 'reminder',
        windowId: id,
        flag: REMINDER_FLAG,
        text: reminderText(remainingMinutes(state, nowMs)),
    };
}

function planRecap(state, marker) {
    const id = favorWindowId(state);
    if (!id) return { post: false, reason: 'no_window' };
    if (marker && marker[RECAP_FLAG] === true) return { post: false, reason: 'already_posted' };
    const winners = state && state.winnersThisWindow;
    const names = winnerNames(winners);
    const winnerCount = Array.isArray(winners) ? winners.length : names.length;
    return {
        post: true,
        reason: 'ok',
        kind: 'recap',
        windowId: id,
        flag: RECAP_FLAG,
        text: recapText({
            hashers: state && state.uniqueHashers,
            winners: winners,
            winnerCount: winnerCount,
        }),
    };
}

function planPush(state, marker, nowMs) {
    if (!state || state.favorActive !== true) return { send: false, reason: 'inactive' };
    const id = favorWindowId(state);
    if (!id) return { send: false, reason: 'no_window' };
    const end = effectiveEndMs(state);
    if (!end || end <= nowMs) return { send: false, reason: 'expired' };
    if (marker && marker[PUSH_FLAG] === true) return { send: false, reason: 'already_sent' };
    return { send: true, reason: 'ok', windowId: id, flag: PUSH_FLAG };
}

function claimFlag(marker, flag) {
    if (marker && marker[flag] === true) return { write: false, reason: 'already_posted', markerPatch: null };
    const patch = {};
    patch[flag] = true;
    return { write: true, reason: 'ok', markerPatch: patch };
}

// The marker flag is the only lock. A global_chat doc id is public because
// currentCycleId is public, so an existing chat doc must never suppress a post.
function claimFavorPost(marker, plan) {
    const flag = plan && plan.flag;
    if (!flag) return { write: false, reason: 'no_flag', markerPatch: null };
    const decision = claimFlag(marker, flag);
    if (decision.write && plan.windowId) decision.markerPatch.windowId = plan.windowId;
    return decision;
}

function chatIdField(flag) {
    if (flag === OPEN_FLAG) return 'openChatId';
    if (flag === REMINDER_FLAG) return 'reminderChatId';
    if (flag === RECAP_FLAG) return 'recapChatId';
    return 'chatId';
}

function newChatId(options) {
    if (options && typeof options.newChatId === 'function') return String(options.newChatId());
    return require('crypto').randomBytes(16).toString('hex');
}

function snapshotWindow(state) {
    const src = state || {};
    const winners = Array.isArray(src.winnersThisWindow) ? src.winnersThisWindow.map(function(row) {
        return { username: row && (row.username || row.name) ? String(row.username || row.name) : '' };
    }) : [];
    return {
        favorActive: src.favorActive === true,
        currentCycleId: src.currentCycleId || null,
        favorStart: src.favorStart || null,
        favorEndBase: src.favorEndBase || null,
        bonusMinutes: src.bonusMinutes || 0,
        totalHashes: src.totalHashes || 0,
        uniqueHashers: src.uniqueHashers || 0,
        winnersThisWindow: winners,
    };
}

// Opt-in only. A recipient needs a registered device, notificationPrefs.master
// set true, and notificationPrefs.favor set true. Unset is off. Banned accounts
// are skipped, including a ban_reason.
// Delivery goes through sendUserPush, which owns device docs, rate limits, and
// stale-device cleanup. This module never reads profile token fields.
const FAVOR_PUSH_URL = 'https://bitcoineducation.quest/#favor';
const UID_RE = /^[A-Za-z0-9_-]{4,128}$/;

function selectPushRecipients(rows) {
    const out = [];
    const seenUid = {};
    const list = Array.isArray(rows) ? rows : [];
    for (let i = 0; i < list.length; i++) {
        const row = list[i] || {};
        const uid = String(row.uid || '');
        if (!UID_RE.test(uid) || seenUid[uid]) continue;
        if (row.hasDevice !== true || row.favor !== true || row.master !== true) continue;
        if (row.satsDisabled === true || row.banned === true || row.ledgerBanned === true) continue;
        if (row.banReason) continue;
        if (row.anonymous === true) continue;
        seenUid[uid] = true;
        out.push({ uid: uid });
    }
    return out;
}

function favorPushPayload() {
    return {
        title: "⛏️ Satoshi's Favor is open",
        body: 'Hash now for a shot at sats. The mining window is live.',
        url: FAVOR_PUSH_URL,
    };
}

function fieldValueOf(options) {
    if (options && options.FieldValue) return options.FieldValue;
    return { serverTimestamp: function() { return new Date(); } };
}

async function readMarker(db, windowId) {
    const snap = await db.collection('satoshiFavorAnnouncements').doc(windowId).get();
    if (!snap || !snap.exists) return null;
    return snap.data() || {};
}

async function publishOnce(db, plan, options) {
    const opts = options || {};
    if (!plan || !plan.post) return { posted: false, reason: plan && plan.reason ? plan.reason : 'no_plan' };
    const FieldValue = fieldValueOf(opts);
    const markerRef = db.collection('satoshiFavorAnnouncements').doc(plan.windowId);
    const idField = chatIdField(plan.flag);
    const claimedId = await db.runTransaction(async function(t) {
        const markerSnap = await t.get(markerRef);
        const marker = markerSnap && markerSnap.exists ? (markerSnap.data() || {}) : null;
        const decision = claimFavorPost(marker, plan);
        if (!decision.write) return '';
        const chatId = newChatId(opts);
        const chatRef = db.collection('global_chat').doc(chatId);
        const patch = Object.assign({}, decision.markerPatch);
        patch[plan.flag + 'At'] = FieldValue.serverTimestamp();
        patch[idField] = chatId;
        t.set(markerRef, patch, { merge: true });
        t.set(chatRef, {
            uid: 'nacho-bot',
            name: 'Nacho 🦌',
            text: plan.text,
            isNachoAuto: false,
            ts: FieldValue.serverTimestamp(),
        });
        return chatId;
    });
    if (!claimedId) return { posted: false, reason: 'already_posted' };
    let mirrored = false;
    if (typeof opts.mirror === 'function') {
        try {
            const result = await opts.mirror({
                db: db,
                docId: claimedId,
                collection: 'global_chat',
                text: plan.text,
            });
            mirrored = !!(result && result.mirrored);
        } catch (err) {
            mirrored = false;
        }
    }
    return { posted: true, mirrored: mirrored, docId: claimedId, kind: plan.kind };
}

function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}

function deviceOwnerUid(doc) {
    const devices = doc && doc.ref && doc.ref.parent;
    const userDoc = devices && devices.parent;
    const root = userDoc && userDoc.parent;
    if (!root || root.id !== 'push_tokens' || !userDoc.id) return '';
    return userDoc.id;
}

// Devices live at push_tokens/{uid}/devices/{id}. The parent doc and the
// profile are not token stores.
async function loadFavorOptInRecipients(db) {
    const snap = await db.collectionGroup('devices').get();
    const uids = [];
    const seen = {};
    if (snap && typeof snap.forEach === 'function') {
        snap.forEach(function(doc) {
            const data = doc.data ? (doc.data() || {}) : {};
            if (typeof data.token !== 'string' || !data.token) return;
            const uid = deviceOwnerUid(doc);
            if (!uid || seen[uid]) return;
            seen[uid] = true;
            uids.push(uid);
        });
    }
    const rows = [];
    const groups = chunk(uids, 100);
    for (let g = 0; g < groups.length; g++) {
        const group = groups[g];
        const userRefs = group.map(function(uid) { return db.collection('users').doc(uid); });
        const ledgerRefs = group.map(function(uid) { return db.collection('faucet_ledger').doc(uid); });
        let userSnaps = [];
        let ledgerSnaps = [];
        if (typeof db.getAll === 'function') {
            userSnaps = await db.getAll.apply(db, userRefs);
            ledgerSnaps = await db.getAll.apply(db, ledgerRefs);
        } else {
            userSnaps = await Promise.all(userRefs.map(function(ref) { return ref.get(); }));
            ledgerSnaps = await Promise.all(ledgerRefs.map(function(ref) { return ref.get(); }));
        }
        for (let i = 0; i < group.length; i++) {
            const data = userSnaps[i] && userSnaps[i].exists ? (userSnaps[i].data() || {}) : {};
            const ledger = ledgerSnaps[i] && ledgerSnaps[i].exists ? (ledgerSnaps[i].data() || {}) : {};
            const prefs = data.notificationPrefs && typeof data.notificationPrefs === 'object'
                ? data.notificationPrefs : {};
            rows.push({
                uid: group[i],
                favor: prefs.favor === true,
                master: prefs.master === true,
                hasDevice: true,
                satsDisabled: data.satsDisabled === true,
                banned: data.banned === true,
                banReason: !!data.ban_reason,
                anonymous: data.anonymous === true,
                ledgerBanned: ledger.banned === true,
            });
        }
    }
    return rows;
}

function defaultSendUserPush(uid, category, payload) {
    return require('./push').sendUserPush(uid, category, payload);
}

async function sendPushOnce(db, state, options) {
    const opts = options || {};
    const now = typeof opts.nowMs === 'number' ? opts.nowMs : Date.now();
    const id = favorWindowId(state);
    if (!id) return { sent: 0, reason: 'no_window' };
    // A marker the cron already read means we skip the transaction after the
    // one push has gone out. The transaction is still the lock the first time.
    if (opts.marker && opts.marker[PUSH_FLAG] === true) return { sent: 0, reason: 'already_sent' };
    if (!opts.marker) {
        const existing = await readMarker(db, id);
        if (existing && existing[PUSH_FLAG] === true) return { sent: 0, reason: 'already_sent' };
    }
    const fresh = planPush(state, opts.marker || null, now);
    if (!fresh.send) return { sent: 0, reason: fresh.reason };
    const FieldValue = fieldValueOf(opts);
    const markerRef = db.collection('satoshiFavorAnnouncements').doc(id);
    const claimed = await db.runTransaction(async function(t) {
        const snap = await t.get(markerRef);
        const marker = snap && snap.exists ? (snap.data() || {}) : null;
        const decision = claimFlag(marker, PUSH_FLAG);
        if (!decision.write) return false;
        const patch = Object.assign({ windowId: id }, decision.markerPatch);
        patch.pushSentAt = FieldValue.serverTimestamp();
        t.set(markerRef, patch, { merge: true });
        return true;
    });
    if (!claimed) return { sent: 0, reason: 'already_sent' };
    const rows = typeof opts.loadRecipients === 'function' ? await opts.loadRecipients() : await loadFavorOptInRecipients(db);
    const recipients = selectPushRecipients(rows);
    const send = typeof opts.sendUserPush === 'function' ? opts.sendUserPush : defaultSendUserPush;
    if (!recipients.length) return { sent: 0, recipients: 0, reason: 'nobody' };
    const payload = favorPushPayload();
    let sent = 0;
    for (let i = 0; i < recipients.length; i++) {
        try {
            const result = await send(recipients[i].uid, 'favor', payload);
            if (result && typeof result.sent === 'number') sent += result.sent;
        } catch (err) {
            console.warn('[FAVOR] push failed');
        }
    }
    return { sent: sent, recipients: recipients.length };
}

async function ensureLive(db, state, options) {
    const opts = options || {};
    const now = typeof opts.nowMs === 'number' ? opts.nowMs : Date.now();
    const id = favorWindowId(state);
    if (!id || !state || state.favorActive !== true) return { ok: false, reason: 'inactive' };
    if (effectiveEndMs(state) <= now) return { ok: false, reason: 'expired' };
    const marker = await readMarker(db, id);
    const openPlan = planOpen(state, marker, now);
    let openJustPosted = false;
    if (openPlan.post) {
        const posted = await publishOnce(db, openPlan, opts);
        openJustPosted = posted.posted === true;
    }
    const marker2 = openJustPosted ? await readMarker(db, id) : marker;
    const reminder = planReminder(state, marker2, now, { openJustPosted: openJustPosted });
    if (reminder.post) await publishOnce(db, reminder, opts);
    // contributeFavor posts the open line and leaves the push to the cron.
    if (opts.push !== false) {
        const markerForPush = (openJustPosted || reminder.post) ? await readMarker(db, id) : marker2;
        await sendPushOnce(db, state, Object.assign({}, opts, { marker: markerForPush }));
    }
    return { ok: true, windowId: id, opened: openJustPosted };
}

async function announceClosed(db, state, options) {
    const opts = options || {};
    const id = favorWindowId(state);
    if (!id) return { posted: false, reason: 'no_window' };
    const marker = await readMarker(db, id);
    const plan = planRecap(state, marker);
    if (!plan.post) return { posted: false, reason: plan.reason || 'already_posted' };
    return publishOnce(db, plan, opts);
}

// session_hashes rows already carry cycleId and lastHash. A row counts while
// its last hash is inside the 90s window. The cron writes the number once.
function countLiveHashers(docs, cycleId, nowMs) {
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    const cutoff = now - PRESENCE_MS;
    const ceiling = now + 15000;
    let n = 0;
    const list = Array.isArray(docs) ? docs : [];
    for (let i = 0; i < list.length; i++) {
        const row = list[i] || {};
        if (row.cycleId !== cycleId) continue;
        const ts = toMillis(row.lastHash);
        if (ts >= cutoff && ts <= ceiling) n++;
    }
    return n;
}

async function refreshHashingNow(db, state, options) {
    const opts = options || {};
    const now = typeof opts.nowMs === 'number' ? opts.nowMs : Date.now();
    const id = favorWindowId(state);
    if (!id || !state || state.favorActive !== true) return { updated: false, reason: 'inactive' };
    if (effectiveEndMs(state) <= now) return { updated: false, reason: 'expired' };
    let docs = [];
    if (typeof opts.loadSessions === 'function') {
        docs = await opts.loadSessions();
    } else {
        const since = opts.since != null ? opts.since : new Date(now - PRESENCE_MS);
        const snap = await db.collection('satoshiFavor').doc('current').collection('session_hashes')
            .where('cycleId', '==', state.currentCycleId)
            .where('lastHash', '>=', since)
            .get();
        if (snap && typeof snap.forEach === 'function') {
            snap.forEach(function(doc) { docs.push(doc.data ? (doc.data() || {}) : {}); });
        }
    }
    const count = countLiveHashers(docs, state.currentCycleId, now);
    if (Number(state.hashingNow) === count) return { updated: false, hashingNow: count, reason: 'unchanged' };
    await db.collection('satoshiFavor').doc('current').set({ hashingNow: count }, { merge: true });
    return { updated: true, hashingNow: count };
}

module.exports = {
    OPEN_FLAG: OPEN_FLAG,
    REMINDER_FLAG: REMINDER_FLAG,
    RECAP_FLAG: RECAP_FLAG,
    PUSH_FLAG: PUSH_FLAG,
    REMINDER_MS: REMINDER_MS,
    MIN_WINDOW_FOR_REMINDER_MS: MIN_WINDOW_FOR_REMINDER_MS,
    PRESENCE_MS: PRESENCE_MS,
    PRESENCE_CAP: PRESENCE_CAP,
    toMillis: toMillis,
    favorWindowId: favorWindowId,
    effectiveEndMs: effectiveEndMs,
    openText: openText,
    reminderText: reminderText,
    recapText: recapText,
    safeDisplayName: safeDisplayName,
    looksLikeEmail: looksLikeEmail,
    planOpen: planOpen,
    planReminder: planReminder,
    planRecap: planRecap,
    planPush: planPush,
    claimFlag: claimFlag,
    claimFavorPost: claimFavorPost,
    chatIdField: chatIdField,
    snapshotWindow: snapshotWindow,
    selectPushRecipients: selectPushRecipients,
    favorPushPayload: favorPushPayload,
    publishOnce: publishOnce,
    ensureLive: ensureLive,
    announceClosed: announceClosed,
    sendPushOnce: sendPushOnce,
    countLiveHashers: countLiveHashers,
    refreshHashingNow: refreshHashingNow,
};
