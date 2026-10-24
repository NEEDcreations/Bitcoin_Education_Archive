'use strict';

// Reserve usernames/{lower} for profiles that already have a username.
// Dry-run only. This deploy has no apply path.
//
// Do not re-apply this over the Oct 23 username restore without approval.
// usernames_meta/backfill { applied: true } was written before the front end ships.
// setUsername still requires that marker. This script must not write it again.
//
//   node functions/scripts/backfill_usernames.js
//
// Duplicate names stay with the account that has a non-anonymous provider
// (email, Google, or any other linked provider), then more points, then
// the most recent activity. Account age is only the last tiebreaker.
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
    // Dry-run only. --apply is refused so a deploy cannot write. Do not
    // re-apply this over the Oct 23 username restore without approval.
    if (process.argv.indexOf('--apply') !== -1) {
        console.error('apply is disabled. Do not re-apply this over the Oct 23 restore without approval.');
        process.exit(2);
    }
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const users = await pageCollection(db, 'users');
    const profiles = await pageCollection(db, 'public_profiles');
    const rows = users.concat(profiles);
    await attachAuthProviders(rows);
    const grouped = groupUsernames(rows);
    console.log(JSON.stringify(summaryCounts('dry-run', rows.length, grouped)));
    console.log('dry-run only. Do not re-apply this over the Oct 23 restore without approval.');
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
