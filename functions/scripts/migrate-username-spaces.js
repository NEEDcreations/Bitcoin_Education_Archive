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
//   node functions/scripts/migrate-username-spaces.js --apply    (needs Phil's OK)
//   ... --apply --notify   also writes one in-app notification per renamed user
//   ... --out DIR          where the full (uid-bearing) plan/backup is written (mode 600)
//
// Apply is transactional per user and idempotent: a user whose name no longer
// contains whitespace, or who already has username_migrations/{uid}, is skipped.
// The transaction re-checks the old name and the new reservation, so a rename by
// the user or a concurrent claim between plan and apply skips that user instead
// of overwriting anything. Re-run to pick up skips.
//
// Never prints full uids, mail addresses, or other private fields. stdout
// carries counts and public usernames only; uids go to the --out files.
//
// Uses Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS).

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

function noticeFor(next) {
    return 'Usernames can no longer contain spaces, so yours is now @' + next +
        '. Want a different one? You get one free change in Settings → Advanced → Change Username.';
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
        if (markSnap.exists) return 'already';
        if (!userSnap.exists) return 'gone';
        const cur = userSnap.data() || {};
        if (cur.username !== row.old) return 'changed';
        if (newSnap.exists) {
            const d = newSnap.data() || {};
            const view = { uid: d.uid || '', anon: d.anon === true, at: d.atMs, releasedAt: d.releasedAtMs, holdUid: d.holdUid || '' };
            if (names.reservationBlocks(view, row.uid, nowMs)) return 'conflict';
        }
        const clash = await tx.get(db.collection('users').where('username_lower', '==', row.nextLower).limit(2));
        if (clash.docs.some(d => d.id !== row.uid)) return 'conflict';
        tx.set(markRef, {
            uid: row.uid, from: row.old, fromLower: row.oldLower, to: row.next, toLower: row.nextLower,
            prevChangedAtMs: cur.usernameChangedAt && cur.usernameChangedAt.toMillis ? cur.usernameChangedAt.toMillis() : null,
            atMs: nowMs, at: FieldValue.serverTimestamp(),
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
                message: noticeFor(row.next),
                targetType: '', targetId: '', read: false, createdAt: FieldValue.serverTimestamp(),
            });
        }
        return 'ok';
    });
}

// Live (non-history) copies. Best effort, after the user's transaction.
async function patchLiveCopies(db, row) {
    const out = { listings: 0, dms: 0, sf: 0 };
    const listings = await db.collection('marketplace').where('sellerUid', '==', row.uid).get();
    for (const d of listings.docs) {
        const x = d.data() || {};
        if (x.status === 'active' && x.sellerName === row.old) { await d.ref.update({ sellerName: row.next }); out.listings++; }
    }
    const dms = await db.collection('dm_conversations').where('participants', 'array-contains', row.uid).get();
    for (const d of dms.docs) {
        const pn = (d.data() || {}).participantNames || {};
        if (pn[row.uid] === row.old) { await d.ref.update({ ['participantNames.' + row.uid]: row.next }); out.dms++; }
    }
    const sfRef = db.collection('satoshiFavor').doc('current');
    const sf = await sfRef.get();
    if (sf.exists && (sf.data() || {}).lowestHashThisWindowUid === row.uid && sf.data().lowestHashThisWindowUsername === row.old) {
        await sfRef.update({ lowestHashThisWindowUsername: row.next }); out.sf++;
    }
    const sess = await sfRef.collection('session_hashes').doc(row.uid).get();
    if (sess.exists && (sess.data() || {}).username === row.old) { await sess.ref.update({ username: row.next }); out.sf++; }
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

async function main() {
    const apply = process.argv.includes('--apply');
    const notify = process.argv.includes('--notify');
    const outDir = argValue('--out') || path.join(process.cwd(), 'username-spaces-private');
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const { plan, counts, profileOnly } = await buildPlan(db);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    writePrivate(outDir, 'plan-' + stamp + '.json', JSON.stringify({ counts, profileOnly, plan }, null, 2));
    const summary = {
        mode: apply ? 'apply' : 'dry-run', ...counts,
        collisions: plan.filter(r => r.collided).length,
        invalid: plan.filter(r => r.invalid).length,
        sanitized: plan.filter(r => r.sanitized).length,
    };
    console.log(JSON.stringify(summary));
    plan.forEach(r => console.log([short(r.uid), JSON.stringify(r.old), '->', JSON.stringify(r.next), r.collided ? 'COLLISION' : '', r.sanitized ? 'SANITIZED' : '', r.invalid ? 'INVALID:' + r.invalid : '', r.notes.join('; ')].filter(Boolean).join('  ')));
    if (!apply) return;
    if (summary.invalid) throw new Error('invalid names in plan; fix before --apply');
    // Backup of the old values, written before any write.
    const backup = [];
    for (const r of plan) {
        const u = await db.collection('users').doc(r.uid).get();
        const p = await db.collection('public_profiles').doc(r.uid).get();
        const ud = u.data() || {}, pd = p.data() || {};
        backup.push({ uid: r.uid, users: { username: ud.username, username_lower: ud.username_lower, usernameChangedAtMs: ud.usernameChangedAt && ud.usernameChangedAt.toMillis ? ud.usernameChangedAt.toMillis() : null, usernameNeedsRepick: ud.usernameNeedsRepick === true },
            public_profiles: p.exists ? { username: pd.username, username_lower: pd.username_lower } : null, plannedTo: r.next });
    }
    writePrivate(outDir, 'backup-' + stamp + '.json', JSON.stringify(backup, null, 2));
    const tally = { ok: 0, already: 0, changed: 0, conflict: 0, gone: 0, error: 0, listings: 0, dms: 0, sf: 0 };
    for (const r of plan) {
        let res;
        try { res = await applyOne(db, r, { notify }); } catch (e) { res = 'error'; console.error('fail', short(r.uid), e.code || e.message); }
        tally[res] = (tally[res] || 0) + 1;
        if (res === 'ok') {
            try { const c = await patchLiveCopies(db, r); tally.listings += c.listings; tally.dms += c.dms; tally.sf += c.sf; }
            catch (e) { console.error('live-copy fail', short(r.uid), e.code || e.message); }
        }
    }
    console.log(JSON.stringify({ applied: tally }));
}

module.exports = { convert, sanitize, withSuffix, HAS_WS, FUTURE_RE, planFromRows, applyOne, noticeFor, patchLiveCopies };

if (require.main === module) {
    main().then(() => process.exit(0)).catch(e => { console.error('fail', e.code || e.message); process.exit(1); });
}
