'use strict';

// Reserve usernames/{lower} for profiles that already have a username.
// Dry-run by default. Pass --apply to write.
//
// DEPLOY: run this with --apply before the front end ships. setUsername
// refuses every new name until usernames_meta/backfill.applied is true.
//
//   node functions/scripts/backfill_usernames.js
//   node functions/scripts/backfill_usernames.js --apply
//
// Duplicate names stay with the account that has a non-anonymous provider
// (email, Google, or any other linked provider), then more points, then
// the most recent activity. Account age is only the last tiebreaker.
// The others are marked usernameNeedsRepick and their username fields are
// cleared so they pick again. --apply always writes the marker after those
// writes, even when duplicates were resolved.
//
// Prints counts only. Never prints names, emails, or other profile fields.
//
// Uses Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or
// `gcloud auth application-default login`). Does not take a key path on argv.

const admin = require('firebase-admin');

const PAGE = 400;

function lowerOf(data) {
    const raw = data && (data.username_lower || data.username);
    if (raw == null) return '';
    return String(raw).trim().toLowerCase();
}

function validDocId(id) {
    if (!id || id === '.' || id === '..') return false;
    if (id.indexOf('/') !== -1) return false;
    if (id.length > 700) return false;
    return true;
}

function createdMs(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value.toMillis === 'function') {
        const n = value.toMillis();
        return Number.isFinite(n) ? n : null;
    }
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    if (typeof value._seconds === 'number') return value._seconds * 1000;
    if (typeof value === 'string') {
        const t = Date.parse(value);
        return Number.isFinite(t) ? t : null;
    }
    return null;
}

function pointsOf(row) {
    const n = Number(row && row.points);
    return Number.isFinite(n) ? n : 0;
}

function activityOf(row) {
    if (!row) return null;
    let best = null;
    ['activity', 'activityMs', 'lastActive', 'lastSeen', 'lastLogin', 'lastVisit'].forEach(function (key) {
        const ms = createdMs(row[key]);
        if (ms != null && (best == null || ms > best)) best = ms;
    });
    return best;
}

// Email, Google, and any other non-anonymous provider beat a guest.
function rowLinked(row) {
    if (!row) return false;
    if (row.isAnonymous === true || row.anon === true) return false;
    if (row.linked === true) return true;
    const providers = row.providers;
    if (Array.isArray(providers)) {
        for (let i = 0; i < providers.length; i++) {
            const item = providers[i];
            const id = typeof item === 'string' ? item : (item && (item.providerId || item.id)) || '';
            if (id && id !== 'anonymous') return true;
        }
    }
    const provider = String(row.provider || row.signInProvider || '');
    if (provider && provider !== 'anonymous') return true;
    if (row.email && String(row.email).trim()) return true;
    return false;
}

// Linked provider, then more points, then newer activity, then older account.
function compareHolders(a, b) {
    if (!!a.linked !== !!b.linked) return a.linked ? -1 : 1;
    if (a.points !== b.points) return b.points - a.points;
    const aAct = a.activity == null ? Number.NEGATIVE_INFINITY : a.activity;
    const bAct = b.activity == null ? Number.NEGATIVE_INFINITY : b.activity;
    if (aAct !== bAct) return bAct - aAct;
    const ac = a.created == null ? Number.POSITIVE_INFINITY : a.created;
    const bc = b.created == null ? Number.POSITIVE_INFINITY : b.created;
    if (ac !== bc) return ac - bc;
    if (a.uid < b.uid) return -1;
    if (a.uid > b.uid) return 1;
    return 0;
}

// rows: [{uid, lower, created, points, activity, linked, email, providers, col}]
function groupUsernames(rows) {
    const buckets = new Map();
    (rows || []).forEach(function (row) {
        if (!row || !row.uid || !row.lower || !validDocId(row.lower)) return;
        if (!buckets.has(row.lower)) buckets.set(row.lower, new Map());
        const holders = buckets.get(row.lower);
        const prev = holders.get(row.uid) || {
            uid: row.uid,
            created: null,
            cols: {},
            points: 0,
            activity: null,
            linked: false,
        };
        const ms = createdMs(row.created != null ? row.created : row.createdAt);
        if (ms != null && (prev.created == null || ms < prev.created)) prev.created = ms;
        const act = activityOf(row);
        if (act != null && (prev.activity == null || act > prev.activity)) prev.activity = act;
        const pts = pointsOf(row);
        if (pts > prev.points) prev.points = pts;
        if (rowLinked(row)) prev.linked = true;
        if (row.col) prev.cols[row.col] = true;
        holders.set(row.uid, prev);
    });
    const unique = new Map();
    const collisions = [];
    const repicks = [];
    buckets.forEach(function (holders, lower) {
        const list = Array.from(holders.values());
        list.sort(compareHolders);
        unique.set(lower, list[0].uid);
        if (list.length > 1) {
            collisions.push(list.map(function (holder) { return holder.uid; }));
            for (let i = 1; i < list.length; i++) {
                repicks.push({ uid: list[i].uid, cols: list[i].cols });
            }
        }
    });
    return { unique: unique, collisions: collisions, repicks: repicks };
}

function summaryCounts(mode, profilesSeen, grouped) {
    return {
        mode: mode,
        profilesSeen: profilesSeen,
        distinctNames: grouped.unique.size,
        unique: grouped.unique.size,
        collisionGroups: grouped.collisions.length,
        repicks: grouped.repicks.length,
    };
}

async function pageCollection(db, name) {
    const rows = [];
    let cursor = null;
    for (;;) {
        let q = db.collection(name).orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE)
            .select(
                'username', 'username_lower', 'created', 'createdAt',
                'points', 'lastActive', 'lastSeen', 'lastLogin', 'lastVisit',
                'email', 'providers', 'provider', 'signInProvider', 'isAnonymous', 'anon'
            );
        if (cursor) q = q.startAfter(cursor);
        const snap = await q.get();
        if (snap.empty) break;
        snap.forEach(function (doc) {
            const data = doc.data() || {};
            const lower = lowerOf(data);
            if (!lower) return;
            rows.push({
                uid: doc.id,
                lower: lower,
                created: data.created != null ? data.created : data.createdAt,
                points: data.points,
                lastActive: data.lastActive,
                lastSeen: data.lastSeen,
                lastLogin: data.lastLogin,
                lastVisit: data.lastVisit,
                email: data.email,
                providers: data.providers,
                provider: data.provider,
                signInProvider: data.signInProvider,
                isAnonymous: data.isAnonymous,
                anon: data.anon,
                col: name,
            });
        });
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    return rows;
}

async function attachAuthProviders(rows) {
    const byLower = new Map();
    rows.forEach(function (row) {
        if (!byLower.has(row.lower)) byLower.set(row.lower, new Set());
        byLower.get(row.lower).add(row.uid);
    });
    const pending = [];
    const seen = {};
    byLower.forEach(function (uids) {
        if (uids.size < 2) return;
        uids.forEach(function (uid) {
            if (seen[uid]) return;
            seen[uid] = true;
            const already = rows.some(function (row) { return row.uid === uid && rowLinked(row); });
            if (!already) pending.push(uid);
        });
    });
    for (let i = 0; i < pending.length; i++) {
        const uid = pending[i];
        try {
            const rec = await admin.auth().getUser(uid);
            const ids = [];
            ((rec && rec.providerData) || []).forEach(function (provider) {
                if (provider && provider.providerId && provider.providerId !== 'anonymous') ids.push(provider.providerId);
            });
            if (!ids.length) continue;
            rows.forEach(function (row) {
                if (row.uid !== uid) return;
                row.linked = true;
                row.providers = ids;
            });
        } catch (e) {
            // No credentials, or this uid is not in Auth. Profile fields still apply.
        }
    }
}

async function main() {
    const apply = process.argv.indexOf('--apply') !== -1;
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const users = await pageCollection(db, 'users');
    const profiles = await pageCollection(db, 'public_profiles');
    const rows = users.concat(profiles);
    await attachAuthProviders(rows);
    const grouped = groupUsernames(rows);
    console.log(JSON.stringify(summaryCounts(apply ? 'apply' : 'dry-run', rows.length, grouped)));
    if (!apply) {
        console.log('dry-run only. Re-run with --apply before the front end ships.');
        return;
    }
    const pairs = Array.from(grouped.unique.entries());
    let written = 0;
    let batch = db.batch();
    let pending = 0;
    async function flush() {
        if (!pending) return;
        await batch.commit();
        batch = db.batch();
        pending = 0;
    }
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        batch.set(db.collection('usernames').doc(pair[0]), {
            uid: pair[1],
            at: admin.firestore.FieldValue.serverTimestamp(),
            atMs: Date.now(),
            anon: false,
            backfill: true,
        });
        pending++;
        written++;
        if (pending >= 400) await flush();
    }
    for (let r = 0; r < grouped.repicks.length; r++) {
        const repick = grouped.repicks[r];
        const cols = Object.keys(repick.cols || {});
        const targets = cols.length ? cols : ['users'];
        for (let c = 0; c < targets.length; c++) {
            batch.set(db.collection(targets[c]).doc(repick.uid), {
                usernameNeedsRepick: true,
                username: admin.firestore.FieldValue.delete(),
                username_lower: admin.firestore.FieldValue.delete(),
            }, { merge: true });
            pending++;
            if (pending >= 400) await flush();
        }
    }
    await flush();
    await db.collection('usernames_meta').doc('backfill').set({
        applied: true,
        at: admin.firestore.FieldValue.serverTimestamp(),
        unique: grouped.unique.size,
        repicks: grouped.repicks.length,
    });
    console.log(JSON.stringify({ wrote: written, repicks: grouped.repicks.length, marker: true }));
}

module.exports = {
    groupUsernames: groupUsernames,
    lowerOf: lowerOf,
    validDocId: validDocId,
    createdMs: createdMs,
    rowLinked: rowLinked,
    compareHolders: compareHolders,
    summaryCounts: summaryCounts,
    main: main,
};

if (require.main === module) {
    main().then(function () { process.exit(0); }).catch(function () {
        console.error('backfill failed');
        process.exit(1);
    });
}
