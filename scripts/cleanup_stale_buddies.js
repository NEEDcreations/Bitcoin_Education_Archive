#!/usr/bin/env node
'use strict';

// List stale April 2026 Bitcoin Buddy matches and empty buddy conversations.
//
// Dry-run is the default. It only reads. It prints match ids, conversation
// ids, and participant uids. It does not print usernames, intros, or message
// text. Nothing is deleted unless --apply is passed.
//
//   node scripts/cleanup_stale_buddies.js
//   node scripts/cleanup_stale_buddies.js --apply
//
// Auth is Application Default Credentials. No key file is read from the repo.

const APRIL_START = Date.parse('2026-04-01T00:00:00.000Z');
const APRIL_END = Date.parse('2026-05-01T00:00:00.000Z');
const NACHO_UID = 'nacho-bot';
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'bitcoin-education-archive';

function timestampMs(value) {
    if (value == null) return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value.toMillis === 'function') {
        const ms = value.toMillis();
        return Number.isFinite(ms) ? ms : 0;
    }
    if (typeof value === 'object') {
        const seconds = value._seconds != null ? value._seconds : value.seconds;
        if (typeof seconds === 'number') return seconds * 1000;
    }
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}

function matchTime(data) {
    const row = data || {};
    return Number(row.matchedAtMs) || timestampMs(row.matchedAt);
}

function isApril2026Match(data) {
    return aprilWindow(matchTime(data));
}

function aprilWindow(ms) {
    return ms >= APRIL_START && ms < APRIL_END;
}

function shortUid(uid) {
    const s = String(uid || '');
    return s.length <= 6 ? s : s.slice(0, 6);
}

function participantIds(data) {
    const row = data || {};
    const fromSides = [row.user1 && row.user1.uid, row.user2 && row.user2.uid].filter(Boolean);
    if (fromSides.length) return fromSides;
    return Array.isArray(row.participants) ? row.participants.filter(Boolean) : [];
}

function emptyBuddyMessages(messages) {
    return !(messages || []).some(function (msg) {
        if (!msg) return false;
        const sender = String(msg.senderUid || '');
        if (!sender || sender === NACHO_UID || msg.isNachoAuto === true) return false;
        return true;
    });
}

function isEmptyBuddyConversation(convo, messages) {
    if (!convo || convo.isBuddyMatch !== true) return false;
    return emptyBuddyMessages(messages);
}

function planCleanup(matches, conversations) {
    const april = [];
    (matches || []).forEach(function (row) {
        if (!isApril2026Match(row.data)) return;
        april.push({
            kind: 'buddy_match',
            id: row.id,
            matchedAtMs: matchTime(row.data),
            uids: participantIds(row.data).map(shortUid),
        });
    });
    april.sort(function (a, b) { return a.matchedAtMs - b.matchedAtMs || (a.id < b.id ? -1 : 1); });
    const empty = [];
    (conversations || []).forEach(function (row) {
        if (!isEmptyBuddyConversation(row.data, row.messages)) return;
        empty.push({
            kind: 'buddy_conversation',
            id: row.id,
            uids: (Array.isArray(row.data.participants) ? row.data.participants.filter(Boolean) : []).map(shortUid),
        });
    });
    empty.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    return { matches: april, conversations: empty };
}

async function messageSummaries(db, convoId) {
    const snap = await db.collection('dm_conversations').doc(convoId).collection('messages').limit(50).get();
    return (snap.docs || []).map(function (doc) {
        const data = doc.data() || {};
        return { senderUid: data.senderUid || '', isNachoAuto: data.isNachoAuto === true };
    });
}

async function listAprilMatches(db, admin) {
    const start = admin.firestore.Timestamp.fromMillis(APRIL_START);
    const end = admin.firestore.Timestamp.fromMillis(APRIL_END);
    const rows = [];
    const seen = {};
    const timed = await db.collection('buddy_matches')
        .where('matchedAt', '>=', start)
        .where('matchedAt', '<', end)
        .limit(500)
        .get();
    (timed.docs || []).forEach(function (doc) {
        seen[doc.id] = true;
        rows.push({ id: doc.id, data: doc.data() || {}, ref: doc.ref });
    });
    const numbered = await db.collection('buddy_matches')
        .where('matchedAtMs', '>=', APRIL_START)
        .where('matchedAtMs', '<', APRIL_END)
        .limit(500)
        .get();
    (numbered.docs || []).forEach(function (doc) {
        if (seen[doc.id]) return;
        seen[doc.id] = true;
        rows.push({ id: doc.id, data: doc.data() || {}, ref: doc.ref });
    });
    return rows;
}

async function listEmptyConversations(db) {
    const rows = [];
    const snap = await db.collection('dm_conversations').where('isBuddyMatch', '==', true).limit(500).get();
    const docs = snap.docs || [];
    for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        const data = doc.data() || {};
        const messages = await messageSummaries(db, doc.id);
        if (!isEmptyBuddyConversation(data, messages)) continue;
        rows.push({ id: doc.id, data: data, messages: messages, ref: doc.ref });
    }
    return rows;
}

async function applyDeletes(rows) {
    for (let i = 0; i < rows.length; i++) {
        if (rows[i].ref) await rows[i].ref.delete();
    }
}

async function main() {
    const apply = process.argv.indexOf('--apply') !== -1;
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
    const db = admin.firestore();
    console.log('[buddy-cleanup] project=' + PROJECT_ID + ' mode=' + (apply ? 'apply' : 'dry-run'));
    if (!apply) console.log('[buddy-cleanup] dry-run: no Firestore writes');
    const matches = await listAprilMatches(db, admin);
    const conversations = await listEmptyConversations(db);
    const plan = planCleanup(matches, conversations);
    plan.matches.forEach(function (row) {
        console.log(JSON.stringify(row));
    });
    plan.conversations.forEach(function (row) {
        console.log(JSON.stringify(row));
    });
    console.log(JSON.stringify({
        mode: apply ? 'apply' : 'dry-run',
        aprilMatches: plan.matches.length,
        emptyConversations: plan.conversations.length,
    }));
    if (!apply) return;
    const matchById = {};
    matches.forEach(function (row) { matchById[row.id] = row; });
    const convoById = {};
    conversations.forEach(function (row) { convoById[row.id] = row; });
    await applyDeletes(plan.matches.map(function (row) { return matchById[row.id]; }).filter(Boolean));
    await applyDeletes(plan.conversations.map(function (row) { return convoById[row.id]; }).filter(Boolean));
    console.log('[buddy-cleanup] apply finished');
}

module.exports = {
    APRIL_START: APRIL_START,
    APRIL_END: APRIL_END,
    timestampMs: timestampMs,
    isApril2026Match: isApril2026Match,
    emptyBuddyMessages: emptyBuddyMessages,
    isEmptyBuddyConversation: isEmptyBuddyConversation,
    planCleanup: planCleanup,
    participantIds: participantIds,
    shortUid: shortUid,
};

if (require.main === module) {
    main().catch(function (err) {
        console.error('[buddy-cleanup] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}
