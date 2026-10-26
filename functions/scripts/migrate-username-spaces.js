'use strict';

// Convert existing usernames that contain whitespace to underscores.
//   "chill guy2"  -> "chill_guy2"    "  Big   boss ross " -> "Big_boss_ross"
// A run of whitespace (any Unicode space, incl. NBSP / ideographic / zero-width)
// together with any underscores touching it becomes one "_". Leading and
// trailing whitespace is trimmed. On a case-insensitive collision with any
// other account's name or any live/held usernames/{lower} reservation, the
// smallest free number suffix is appended ("chill_guy2" -> "chill_guy22" ->
// "chill_guy23"...), shortening the base so the result stays <= MAX_LEN.
//
//   node functions/scripts/migrate-username-spaces.js            (dry run, default)
//   node functions/scripts/migrate-username-spaces.js --apply --plan FILE --sha256 HEX
//   ... --apply --plan FILE --sha256 HEX --notify   also writes one notification
//   ... --out DIR          where the full (uid-bearing) plan/backup is written (mode 600)
//
// The dry run writes plan-*.json (mode 600) plus a sha256 of {counts, profileOnly,
// plan}. --apply refuses to run without --plan FILE and without --sha256 HEX
// equal to that computed hash. It then checks every row again and refuses the
// whole run if any row fails. It renames only those rows, to exactly those
// target names. It never recomputes a suffix. A target that was taken since
// the review is skipped and reported. A user who already has a matching marker
// is left as-is. A live-copy patch that did not finish is retried only while
// their current username is still the planned name.
//
// Apply is transactional per user. A user whose current name is no longer the
// planned old name is skipped. The transaction re-checks the old name and the
// new reservation (exact username and username_lower).
//
// Never prints full uids, mail addresses, or other private fields. stdout
// carries counts and public usernames only; uids go to the --out files.
// Failures log an error code only.
//
// Uses Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS).

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const names = require('../src/usernamePolicy');

const PAGE = 400;
// \s in JS covers Unicode Zs, NBSP, U+FEFF, line terminators. Add zero-width
// and other format spaces that \s misses.
const WS_CLASS = '\\s\\u180E\\u200B\\u200C\\u200D\\u2060';
const HAS_WS = new RegExp('[' + WS_CLASS + ']');
const WS_RUN = new RegExp('[_' + WS_CLASS + ']*[' + WS_CLASS + '][_' + WS_CLASS + ']*', 'g');
const EDGE_WS = new RegExp('^[' + WS_CLASS + ']+|[' + WS_CLASS + ']+$', 'g');

function convert(name) {
    return String(name || '').replace(EDGE_WS, '').replace(WS_RUN, '_');
}

// The names the policy accepts after enforcement: no whitespace at all.
const FUTURE_RE = /^[A-Za-z0-9_\-.]+$/;

// Only for the few legacy names that also break the current charset or length
// rules (they predate them). Transliterate accents, map the Bitcoin sign to B,
// drop the other disallowed characters, then fit MAX_LEN: drop trailing words
// while at least 12 characters remain, otherwise cut hard.
function sanitize(converted) {
    let s = String(converted || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\u20BF/g, 'B').replace(/[^A-Za-z0-9_\-.]/g, '')
        .replace(/_+/g, '_').replace(/^[_.\-]+|[_.\-]+$/g, '');
    if (s.length <= names.MAX_LEN) return s;
    let parts = s.split('_');
    while (parts.length > 1 && parts.join('_').length > names.MAX_LEN) parts = parts.slice(0, -1);
    const dropped = parts.join('_');
    if (dropped.length <= names.MAX_LEN && dropped.length >= 12) return dropped;
    return s.slice(0, names.MAX_LEN).replace(/[_.\-]+$/, '');
}

function withSuffix(base, n) {
    const tail = String(n);
    return base.slice(0, Math.max(1, names.MAX_LEN - tail.length)).replace(/_+$/, '') + tail;
}

function short(uid) { return String(uid || '').slice(0, 6) + '…'; }

function argValue(flag) {
    const i = process.argv.indexOf(flag);
    return i !== -1 ? process.argv[i + 1] : null;
}

async function pageAll(db, col, fields) {
    const rows = []; let cursor = null;
    for (;;) {
        let q = db.collection(col).orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (fields) q = q.select.apply(q, fields);
        if (cursor) q = q.startAfter(cursor);
        const s = await q.get();
        if (s.empty) break;
        s.forEach(d => rows.push({ id: d.id, data: d.data() || {} }));
        cursor = s.docs[s.docs.length - 1];
        if (s.size < PAGE) break;
    }
    return rows;
}

function roleMayUseReserved(u) {
    if (!u) return false;
    if (u.isAdmin === true || u.admin === true) return true;
    const r = String(u.role || '');
    return r === 'admin' || r === 'moderator';
}

function noticeFor(next, opts) {
    const why = opts && opts.sanitized
        ? 'Usernames can no longer contain spaces or special characters, so yours is now @'
        : 'Usernames can no longer contain spaces, so yours is now @';
    return why + next +
        '. Want a different one? You get one free change in Settings → Advanced → Change Username.';
}

function canonicalPlan(counts, profileOnly, plan) {
    return JSON.stringify({ counts: counts, profileOnly: profileOnly, plan: plan });
}

function planSha256(counts, profileOnly, plan) {
    return crypto.createHash('sha256').update(canonicalPlan(counts, profileOnly, plan), 'utf8').digest('hex');
}

function planDocument(counts, profileOnly, plan) {
    return {
        sha256: planSha256(counts, profileOnly, plan),
        counts: counts,
        profileOnly: profileOnly,
        plan: plan,
    };
}

function planRowProblem(row, seen) {
    const oldName = row && row.old;
    const next = row && row.next;
    if (typeof oldName !== 'string' || !HAS_WS.test(oldName)) return 'old-space';
    if (typeof next !== 'string') return 'target';
    if (row.oldLower !== oldName.toLowerCase() || row.nextLower !== next.toLowerCase()) return 'lower';
    const verdict = names.assessUsername(next);
    if (!verdict.ok || verdict.username !== next) return 'target';
    if (seen.has(row.nextLower)) return 'duplicate';
    seen.add(row.nextLower);
    return '';
}

function validateApplyRows(plan) {
    const seen = new Set();
    for (let i = 0; i < plan.length; i++) {
        const problem = planRowProblem(plan[i], seen);
        if (problem) {
            const err = new Error('plan row failed ' + problem);
            err.code = 'invalid-plan';
            throw err;
        }
    }
}

function loadReviewedPlan(doc, expectedSha) {
    if (!doc || typeof doc.sha256 !== 'string' || !doc.counts || !Array.isArray(doc.plan)) {
        const err = new Error('plan file is incomplete');
        err.code = 'invalid-plan';
        throw err;
    }
    const got = planSha256(doc.counts, doc.profileOnly, doc.plan);
    if (got !== doc.sha256) {
        const err = new Error('plan hash mismatch');
        err.code = 'plan-hash';
        throw err;
    }
    if (typeof expectedSha === 'string') {
        const want = expectedSha.toLowerCase();
        if (want !== got) {
            const err = new Error('plan hash mismatch');
            err.code = 'plan-hash';
            throw err;
        }
    }
    if (doc.plan.some(function (row) { return row && row.invalid; })) {
        const err = new Error('invalid names in plan');
        err.code = 'invalid-plan';
        throw err;
    }
    validateApplyRows(doc.plan);
    return doc.plan;
}

function flagValue(argv, flag) {
    const i = (argv || []).indexOf(flag);
    if (i === -1) return '';
    const value = argv[i + 1];
    if (!value || String(value).charAt(0) === '-') return '';
    return String(value);
}

function assertApplyPlan(argv) {
    const list = argv || [];
    const apply = list.indexOf('--apply') !== -1;
    const file = flagValue(list, '--plan');
    const sha = flagValue(list, '--sha256');
    if (!apply) return { plan: file || null, sha256: sha ? sha.toLowerCase() : null };
    if (!file) {
        const err = new Error('--apply requires --plan FILE');
        err.code = 'plan-required';
        throw err;
    }
    if (!/^[0-9a-fA-F]{64}$/.test(sha)) {
        const err = new Error('--apply requires --sha256 HEX');
        err.code = 'sha-required';
        throw err;
    }
    return { plan: file, sha256: sha.toLowerCase() };
}

function errCode(e) {
    if (!e || e.code == null || e.code === '') return 'error';
    if (typeof e.code === 'number' && isFinite(e.code)) return String(e.code);
    if (typeof e.code !== 'string') return 'error';
    if (e.code.length > 64 || e.code.indexOf('/') !== -1) return 'error';
    return e.code;
}

function logCode(label, e) {
    console.error(label, errCode(e));
}

function planFromRows(users, profiles, reservations, done, nowMs) {
    users = users || [];
    profiles = profiles || [];
    reservations = reservations || [];
    const doneSet = new Set((done || []).map(d => d.id));
    const now = Number(nowMs) || Date.now();

    // Every lower name in use, and by which uids. Reservations (live or held)
    // also block, except when owned/held by the same uid.
    const owners = new Map();
    const claim = (lower, uid) => { if (!lower) return; if (!owners.has(lower)) owners.set(lower, new Set()); owners.get(lower).add(uid); };
    users.forEach(u => claim(String(u.data.username_lower || u.data.username || '').trim().toLowerCase(), u.id));
    profiles.forEach(p => claim(String(p.data.username_lower || p.data.username || '').trim().toLowerCase(), p.id));
    reservations.forEach(r => {
        const d = r.data;
        const view = { uid: d.uid || '', anon: d.anon === true, at: d.atMs, releasedAt: d.releasedAtMs, holdUid: d.holdUid || '' };
        // reservationBlocks(view, someoneElse) true => the name is not free for others.
        if (names.reservationBlocks(view, '__other__', now)) {
            claim(r.id, view.holdUid || view.uid || '__reserved__');
        }
    });
    const takenByOther = (lower, uid) => {
        const set = owners.get(lower);
        if (!set) return false;
        for (const o of set) if (o !== uid) return true;
        return false;
    };

    const profileByUid = new Map(profiles.map(p => [p.id, p.data]));
    const affected = [];
    const profileOnly = [];
    users.forEach(u => {
        const name = u.data.username;
        if (typeof name === 'string' && HAS_WS.test(name)) affected.push(u);
    });
    profiles.forEach(p => {
        const n = p.data.username;
        const u = users.find(x => x.id === p.id);
        if (typeof n === 'string' && HAS_WS.test(n) && !(u && typeof u.data.username === 'string' && HAS_WS.test(u.data.username))) profileOnly.push(p.id);
    });
    // Oldest-doc-first is not knowable from the select; sort by name then uid so
    // suffix assignment is deterministic across runs.
    affected.sort((a, b) => String(a.data.username).localeCompare(String(b.data.username)) || (a.id < b.id ? -1 : 1));

    const plan = [];
    const plannedLower = new Set();
    for (const u of affected) {
        const old = u.data.username;
        const oldLower = String(u.data.username_lower || old).toLowerCase();
        const row = { uid: u.id, old, oldLower, kind: 'rename', notes: [] };
        if (u.data.mergedInto) row.notes.push('merged guest doc (inert); renamed anyway so the old name is not left behind');
        if (doneSet.has(u.id)) row.notes.push('migration marker exists');
        if (u.data.usernameNeedsRepick === true) row.notes.push('already flagged for repick');
        let base = convert(old);
        const plain = names.assessUsername(base, { allowReserved: true });
        if (!plain.ok && (plain.error === 'charset' || plain.error === 'long' || plain.error === 'html')) {
            row.sanitized = plain.error;
            row.notes.push('legacy name breaks current ' + plain.error + ' rule; sanitized');
            base = sanitize(base);
        }
        let cand = base, n = 1, collided = false;
        const free = c => !takenByOther(c.toLowerCase(), u.id) && !plannedLower.has(c.toLowerCase());
        if (!free(cand)) {
            collided = true;
            do { n++; cand = withSuffix(base, n); } while (!free(cand) && n < 10000);
        }
        row.base = base;
        row.next = cand;
        row.nextLower = cand.toLowerCase();
        row.collided = collided;
        if (collided) {
            const who = Array.from(owners.get(base.toLowerCase()) || []).filter(o => o !== u.id);
            row.collidedWith = who;
            row.notes.push('collision on "' + base + '" -> suffix ' + n);
        }
        const verdict = names.assessUsername(cand, { allowReserved: roleMayUseReserved(u.data) });
        // assessUsername with the new no-whitespace NAME_RE (or the current one).
        if (!verdict.ok) { row.invalid = verdict.error; row.notes.push('fails current policy: ' + verdict.error); }
        if (!FUTURE_RE.test(cand)) { row.invalid = row.invalid || 'future_charset'; }
        if (verdict.ok && verdict.username !== cand) row.notes.push('policy would store "' + verdict.username + '"');
        const pub = profileByUid.get(u.id);
        if (pub && pub.username !== old) row.notes.push('public profile out of sync');
        plannedLower.add(row.nextLower);
        plan.push(row);
    }
    return { plan, counts: { users: users.length, profiles: profiles.length, reservations: reservations.length, affected: plan.length, profileOnly: profileOnly.length }, profileOnly };
}

async function buildPlan(db) {
    const userFields = ['username', 'username_lower', 'usernameNeedsRepick', 'mergedInto', 'isAdmin', 'admin', 'role', 'usernameChangedAt'];
    const users = await pageAll(db, 'users', userFields);
    const profiles = await pageAll(db, 'public_profiles', ['username', 'username_lower']);
    const reservations = await pageAll(db, 'usernames', null);
    const done = await pageAll(db, 'username_migrations', null).catch(() => []);
    return planFromRows(users, profiles, reservations, done, Date.now());
}

async function applyOne(db, row, opts) {
    const FieldValue = admin.firestore.FieldValue;
    const userRef = db.collection('users').doc(row.uid);
    const pubRef = db.collection('public_profiles').doc(row.uid);
    const newRef = db.collection('usernames').doc(row.nextLower);
    const oldRef = row.oldLower && row.oldLower.indexOf('/') === -1 ? db.collection('usernames').doc(row.oldLower) : null;
    const markRef = db.collection('username_migrations').doc(row.uid);
    const nowMs = Date.now();
    return db.runTransaction(async tx => {
        const [userSnap, pubSnap, newSnap, oldSnap, markSnap] = await Promise.all([
            tx.get(userRef), tx.get(pubRef), tx.get(newRef), oldRef ? tx.get(oldRef) : Promise.resolve(null), tx.get(markRef),
        ]);
        if (markSnap.exists) {
            const prev = markSnap.data() || {};
            if (prev.to === row.next && prev.toLower === row.nextLower) return 'already';
            return 'marker';
        }
        if (!userSnap.exists) return 'gone';
        const cur = userSnap.data() || {};
        if (cur.username !== row.old) return 'changed';
        if (newSnap.exists) {
            const d = newSnap.data() || {};
            const view = { uid: d.uid || '', anon: d.anon === true, at: d.atMs, releasedAt: d.releasedAtMs, holdUid: d.holdUid || '' };
            if (names.reservationBlocks(view, row.uid, nowMs)) return 'conflict';
        }
        const clashLower = await tx.get(db.collection('users').where('username_lower', '==', row.nextLower).limit(2));
        if (clashLower.docs.some(d => d.id !== row.uid)) return 'conflict';
        const clashExact = await tx.get(db.collection('users').where('username', '==', row.next).limit(2));
        if (clashExact.docs.some(d => d.id !== row.uid)) return 'conflict';
        tx.set(markRef, {
            uid: row.uid, from: row.old, fromLower: row.oldLower, to: row.next, toLower: row.nextLower,
            prevChangedAtMs: cur.usernameChangedAt && cur.usernameChangedAt.toMillis ? cur.usernameChangedAt.toMillis() : null,
            atMs: nowMs, at: FieldValue.serverTimestamp(),
            patches: { listings: 'pending', dms: 'pending', sf: 'pending' },
        });
        tx.set(newRef, { uid: row.uid, at: FieldValue.serverTimestamp(), atMs: nowMs, anon: false, migratedFrom: row.oldLower });
        if (oldSnap && oldSnap.exists && (oldSnap.data() || {}).uid === row.uid) {
            // Same shape setUsername writes on a rename. Whitespace names can no
            // longer be claimed once enforcement ships, so the hold is moot.
            tx.set(oldRef, { uid: row.uid, releasedAtMs: nowMs, holdUid: row.uid, anon: false }, { merge: true });
        }
        tx.update(userRef, {
            username: row.next,
            username_lower: row.nextLower,
            usernameNeedsRepick: FieldValue.delete(),
            usernameFreeRename: true,
            usernameMigratedFrom: row.old,
            usernameMigratedAt: FieldValue.serverTimestamp(),
            // A migration is not the user's rename. Clear the cooldown stamp.
            usernameChangedAt: FieldValue.delete(),
        });
        if (pubSnap.exists) tx.update(pubRef, {
            username: row.next,
            username_lower: row.nextLower,
            // Server-written. Old chat mentions of the spaced name still resolve.
            usernameMigratedFrom: row.old,
        });
        if (opts.notify) {
            tx.set(db.collection('notifications').doc('uname_mig_' + row.uid), {
                recipientId: row.uid, senderId: 'system', type: 'username_changed', icon: '✏️',
                message: noticeFor(row.next, { sanitized: !!row.sanitized }),
                targetType: '', targetId: '', read: false, createdAt: FieldValue.serverTimestamp(),
            });
        }
        return 'ok';
    });
}

// Live (non-history) copies. Each category is isolated so one failure does not
// skip the others. only limits a retry to categories that are not already ok.
async function patchLiveCopies(db, row, only) {
    const want = only || { listings: true, dms: true, sf: true };
    const out = { listings: 0, dms: 0, sf: 0, status: {} };
    if (want.listings) {
        try {
            const listings = await db.collection('marketplace').where('sellerUid', '==', row.uid).get();
            for (const d of listings.docs) {
                const x = d.data() || {};
                if (x.status === 'active' && x.sellerName === row.old) { await d.ref.update({ sellerName: row.next }); out.listings++; }
            }
            out.status.listings = 'ok';
        } catch (e) {
            out.status.listings = 'error';
            logCode('live-copy listings ' + short(row.uid), e);
        }
    }
    if (want.dms) {
        try {
            const dms = await db.collection('dm_conversations').where('participants', 'array-contains', row.uid).get();
            for (const d of dms.docs) {
                const pn = (d.data() || {}).participantNames || {};
                if (pn[row.uid] === row.old) { await d.ref.update({ ['participantNames.' + row.uid]: row.next }); out.dms++; }
            }
            out.status.dms = 'ok';
        } catch (e) {
            out.status.dms = 'error';
            logCode('live-copy dms ' + short(row.uid), e);
        }
    }
    if (want.sf) {
        try {
            const sfRef = db.collection('satoshiFavor').doc('current');
            const sf = await sfRef.get();
            if (sf.exists && (sf.data() || {}).lowestHashThisWindowUid === row.uid && sf.data().lowestHashThisWindowUsername === row.old) {
                await sfRef.update({ lowestHashThisWindowUsername: row.next }); out.sf++;
            }
            const sess = await sfRef.collection('session_hashes').doc(row.uid).get();
            if (sess.exists && (sess.data() || {}).username === row.old) { await sess.ref.update({ username: row.next }); out.sf++; }
            out.status.sf = 'ok';
        } catch (e) {
            out.status.sf = 'error';
            logCode('live-copy sf ' + short(row.uid), e);
        }
    }
    return out;
}

const PATCH_KEYS = ['listings', 'dms', 'sf'];

async function resumePatches(db, row) {
    const userSnap = await db.collection('users').doc(row.uid).get();
    const currentName = userSnap.exists ? (userSnap.data() || {}).username : '';
    // A later rename means the failed live copies are no longer this plan's job.
    if (currentName !== row.next) {
        return { listings: 0, dms: 0, sf: 0, status: {}, skipped: true };
    }
    const markRef = db.collection('username_migrations').doc(row.uid);
    const mark = await markRef.get();
    const prev = (mark.exists && (mark.data() || {}).patches) || {};
    const only = {};
    PATCH_KEYS.forEach(function (key) {
        if (prev[key] !== 'ok') only[key] = true;
    });
    const out = await patchLiveCopies(db, row, only);
    const patches = {};
    PATCH_KEYS.forEach(function (key) {
        patches[key] = out.status[key] || prev[key] || 'pending';
    });
    try {
        await markRef.update({ patches: patches });
    } catch (e) {
        logCode('patch-status ' + short(row.uid), e);
    }
    return out;
}

function writePrivate(dir, file, body) {
    const old = process.umask(0o077);
    try {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        const p = path.join(dir, file);
        fs.writeFileSync(p, body, { mode: 0o600 });
        fs.chmodSync(p, 0o600);
        return p;
    } finally { process.umask(old); }
}

function printRows(plan) {
    plan.forEach(r => console.log([short(r.uid), JSON.stringify(r.old), '->', JSON.stringify(r.next), r.collided ? 'COLLISION' : '', r.sanitized ? 'SANITIZED' : '', r.invalid ? 'INVALID:' + r.invalid : '', (r.notes || []).join('; ')].filter(Boolean).join('  ')));
}

async function main() {
    const apply = process.argv.includes('--apply');
    const notify = process.argv.includes('--notify');
    const args = assertApplyPlan(process.argv);
    const planPath = args.plan;
    const outDir = argValue('--out') || path.join(process.cwd(), 'username-spaces-private');
    if (apply) {
        // Hash and row checks happen before any Firestore connection or write.
        const reviewedDoc = JSON.parse(fs.readFileSync(planPath, 'utf8'));
        const reviewed = loadReviewedPlan(reviewedDoc, args.sha256);
        if (!admin.apps.length) admin.initializeApp();
        const db = admin.firestore();
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const summary = {
            mode: 'apply',
            rows: reviewed.length,
            sanitized: reviewed.filter(r => r.sanitized).length,
        };
        console.log(JSON.stringify(summary));
        printRows(reviewed);
        await applyReviewed(db, reviewed, { notify: notify, outDir: outDir, stamp: stamp });
        return;
    }
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const { plan, counts, profileOnly } = await buildPlan(db);
    const doc = planDocument(counts, profileOnly, plan);
    writePrivate(outDir, 'plan-' + stamp + '.json', JSON.stringify(doc, null, 2));
    const summary = {
        mode: 'dry-run', ...counts,
        collisions: plan.filter(r => r.collided).length,
        invalid: plan.filter(r => r.invalid).length,
        sanitized: plan.filter(r => r.sanitized).length,
        sha256: doc.sha256,
    };
    console.log(JSON.stringify(summary));
    printRows(plan);
}

async function applyReviewed(db, reviewed, opts) {
    const outDir = opts.outDir;
    const stamp = opts.stamp;
    const notify = opts.notify;
    // Backup of the old values, written before any write. Names stay the reviewed ones.
    const backup = [];
    for (const r of reviewed) {
        const u = await db.collection('users').doc(r.uid).get();
        const p = await db.collection('public_profiles').doc(r.uid).get();
        const ud = u.data() || {}, pd = p.data() || {};
        backup.push({ uid: r.uid, users: { username: ud.username, username_lower: ud.username_lower, usernameChangedAtMs: ud.usernameChangedAt && ud.usernameChangedAt.toMillis ? ud.usernameChangedAt.toMillis() : null, usernameNeedsRepick: ud.usernameNeedsRepick === true },
            public_profiles: p.exists ? { username: pd.username, username_lower: pd.username_lower } : null, plannedTo: r.next });
    }
    writePrivate(outDir, 'backup-' + stamp + '.json', JSON.stringify(backup, null, 2));
    const tally = { ok: 0, already: 0, changed: 0, conflict: 0, marker: 0, gone: 0, error: 0, listings: 0, dms: 0, sf: 0 };
    for (const r of reviewed) {
        let res;
        try { res = await applyOne(db, r, { notify }); } catch (e) { res = 'error'; logCode('fail ' + short(r.uid), e); }
        tally[res] = (tally[res] || 0) + 1;
        if (res === 'conflict' || res === 'marker') {
            console.log([res, short(r.uid), JSON.stringify(r.old), '->', JSON.stringify(r.next), 'skipped'].join('  '));
        }
        if (res === 'ok' || res === 'already') {
            try {
                const c = await resumePatches(db, r);
                tally.listings += c.listings; tally.dms += c.dms; tally.sf += c.sf;
            } catch (e) { logCode('live-copy fail ' + short(r.uid), e); }
        }
    }
    console.log(JSON.stringify({ applied: tally }));
}

module.exports = {
    convert, sanitize, withSuffix, HAS_WS, FUTURE_RE, planFromRows, applyOne, noticeFor, patchLiveCopies,
    planSha256, planDocument, loadReviewedPlan, assertApplyPlan, resumePatches,
};

if (require.main === module) {
    main().then(() => process.exit(0)).catch(e => { console.error('fail', errCode(e)); process.exit(1); });
}
