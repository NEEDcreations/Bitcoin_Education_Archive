'use strict';

// Daily-streak leaderboard. Pure ordering lives here so the visit writer,
// the scheduled refresh, and the backfill all share one definition.
//
// Grace matches recordDailyVisit:
//   last check-in today or yesterday → the stored streak is still alive
//   last check-in two days ago AND a streak freeze is saved → still alive
//   older than that → current streak is 0
// The day boundary is 5 AM UTC, the same offset as getOffsetDateKey().

const { offsetDateKey } = require('./offsetDay');

const BOARD_SIZE = 25;
const FETCH_LIMIT = 200;
const DEBOUNCE_MS = 60 * 1000;
const PIC_MAX = 8000;
const DOC_MAX = 800000;

function dayDiff(lastVisit, todayKey) {
    if (!lastVisit || !todayKey) return null;
    const last = Date.parse(String(lastVisit).slice(0, 10) + 'T00:00:00Z');
    const today = Date.parse(String(todayKey).slice(0, 10) + 'T00:00:00Z');
    if (!Number.isFinite(last) || !Number.isFinite(today)) return null;
    return Math.round((today - last) / 86400000);
}

function shiftDateKey(key, days) {
    const base = Date.parse(String(key).slice(0, 10) + 'T00:00:00Z');
    if (!Number.isFinite(base)) return '';
    return new Date(base + days * 86400000).toISOString().slice(0, 10);
}

function whole(value) {
    const n = Math.floor(Number(value) || 0);
    return n > 0 ? n : 0;
}

// What a check-in right now would do. alreadyVisited when lastVisit is today.
function nextVisitStreak(user, todayKey) {
    const lastVisit = user && user.lastVisit ? String(user.lastVisit) : '';
    const oldStreak = whole(user && user.streak);
    const freezes = whole(user && user.streakFreezes);
    if (lastVisit && todayKey && lastVisit === todayKey) {
        return { alreadyVisited: true, streak: oldStreak, usedFreeze: false, oldStreak: oldStreak };
    }
    const diff = dayDiff(lastVisit, todayKey);
    if (diff === 1) {
        return { alreadyVisited: false, streak: oldStreak + 1, usedFreeze: false, oldStreak: oldStreak };
    }
    if (diff === 2 && freezes > 0) {
        return { alreadyVisited: false, streak: oldStreak + 1, usedFreeze: true, oldStreak: oldStreak };
    }
    return { alreadyVisited: false, streak: 1, usedFreeze: false, oldStreak: oldStreak };
}

// Stored streak counts only inside the grace window above.
function currentStreak(user, todayKey) {
    const streak = whole(user && user.streak);
    if (streak <= 0) return 0;
    const lastVisit = user && user.lastVisit ? String(user.lastVisit) : '';
    if (!lastVisit || !todayKey) return 0;
    if (lastVisit === todayKey) return streak;
    const diff = dayDiff(lastVisit, todayKey);
    if (diff === 1) return streak;
    if (diff === 2 && whole(user && user.streakFreezes) > 0) return streak;
    return 0;
}

function allTimeStreak(user) {
    return Math.max(whole(user && user.bestStreak), whole(user && user.streak));
}

// max(best, current), with the same account-age cap recordDailyVisit already applies.
// bestStreakAt moves only when the best itself increases, so an older best keeps
// the earlier timestamp. streakReachedAt moves on every counted visit.
function applyStreakUpdate(user, newStreak, nowMs, accountAgeDays) {
    const now = Number(nowMs) || Date.now();
    let streak = whole(newStreak);
    const age = accountAgeDays == null ? null : Math.floor(Number(accountAgeDays));
    let prevBest = whole(user && user.bestStreak);
    if (age != null && age > 0) {
        if (streak > age) streak = age;
        if (prevBest > age) prevBest = age;
    }
    const best = Math.max(prevBest, streak);
    const storedBest = whole(user && user.bestStreak);
    const out = {
        streak: streak,
        bestStreak: best,
        streakReachedAt: now
    };
    if (best > storedBest) out.bestStreakAt = now;
    return out;
}

// One-off repair: raise a missing or low bestStreak to the stored streak.
// Does not invent a reached-at time. A timestamp that belonged to a shorter
// best is cleared (bestStreakAt: null) so it cannot win a tie it did not earn.
// Returns null when nothing should be written.
function backfillPatch(data) {
    const streak = whole(data && data.streak);
    const best = whole(data && data.bestStreak);
    if (!(streak > best)) return null;
    const patch = { bestStreak: streak };
    if (reachedMs(data && data.bestStreakAt) > 0) patch.bestStreakAt = null;
    return patch;
}

function displayName(username) {
    const name = String(username || '').replace(/\s+/g, ' ').trim();
    if (!name || /^(anon|anonymous)$/i.test(name)) return 'Anon';
    if (name.indexOf('@') !== -1) return 'Anon';
    return name.slice(0, 40);
}

function safePic(pic) {
    if (typeof pic !== 'string' || !pic || pic.length > PIC_MAX) return '';
    if (/^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i.test(pic)) return pic;
    if (/^https:\/\/[^\s"'<>]+$/i.test(pic) && pic.length < 500) return pic;
    return '';
}

function reachedMs(value) {
    const n = Number(value) || 0;
    return n > 0 ? n : 0;
}

function compareBoard(a, b, valueKey, reachedKey) {
    const av = Number(a[valueKey]) || 0;
    const bv = Number(b[valueKey]) || 0;
    if (bv !== av) return bv - av;
    const ar = reachedMs(a[reachedKey]);
    const br = reachedMs(b[reachedKey]);
    if (ar > 0 && br > 0 && ar !== br) return ar - br;
    const an = displayName(a.username).toLowerCase();
    const bn = displayName(b.username).toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    return String(a.uid || '').localeCompare(String(b.uid || ''));
}

function publicEntry(row, rank, streak) {
    return {
        rank: rank,
        username: displayName(row.username),
        profilePic: safePic(row.profilePic),
        streak: streak
    };
}

function selectBoard(rows, mode) {
    const valueKey = mode === 'current' ? 'current' : 'best';
    const reachedKey = mode === 'current' ? 'streakReachedAt' : 'bestStreakAt';
    const qualified = (rows || []).filter(function (r) {
        if (!r || r.ghostMode === true) return false;
        return (Number(r[valueKey]) || 0) > 0;
    });
    qualified.sort(function (a, b) { return compareBoard(a, b, valueKey, reachedKey); });
    return qualified.slice(0, BOARD_SIZE).map(function (r, i) {
        return publicEntry(r, i + 1, Number(r[valueKey]) || 0);
    });
}

function rowFromUser(id, data, todayKey) {
    const user = data || {};
    return {
        uid: id,
        username: user.username,
        profilePic: user.profilePic,
        ghostMode: user.ghostMode === true,
        best: allTimeStreak(user),
        bestStreakAt: reachedMs(user.bestStreakAt),
        current: currentStreak(user, todayKey),
        streakReachedAt: reachedMs(user.streakReachedAt)
    };
}

function buildBoards(users, nowMs) {
    const now = Number(nowMs) || Date.now();
    const today = offsetDateKey(now);
    const rows = (users || []).map(function (u) {
        return rowFromUser(u.id || u.uid, u.data || u, today);
    });
    return packDoc({
        updatedAt: now,
        dayKey: today,
        alltime: selectBoard(rows, 'alltime'),
        current: selectBoard(rows, 'current')
    });
}

function packDoc(doc) {
    const copy = {
        updatedAt: doc.updatedAt,
        dayKey: doc.dayKey,
        alltime: (doc.alltime || []).map(function (r) { return publicEntry(r, r.rank, r.streak); }),
        current: (doc.current || []).map(function (r) { return publicEntry(r, r.rank, r.streak); })
    };
    if (JSON.stringify(copy).length > DOC_MAX) {
        copy.alltime.forEach(function (r) { r.profilePic = ''; });
        copy.current.forEach(function (r) { r.profilePic = ''; });
    }
    return copy;
}

async function readQuery(query) {
    const snap = await query.get();
    const rows = [];
    snap.forEach(function (doc) {
        rows.push({ id: doc.id, data: doc.data() || {} });
    });
    return rows;
}

async function refresh(db, nowMs, opts) {
    const now = Number(nowMs) || Date.now();
    const ref = db.collection('stats').doc('streak_leaderboard');
    if (opts && opts.force === false) {
        const existing = await ref.get();
        const prev = existing.exists ? (Number((existing.data() || {}).updatedAt) || 0) : 0;
        if (prev && now - prev < DEBOUNCE_MS) return { skipped: true, updatedAt: prev };
    }
    const today = offsetDateKey(now);
    const cutoff = shiftDateKey(today, -2);
    const users = db.collection('users');
    const parts = await Promise.all([
        readQuery(users.where('bestStreak', '>', 0).orderBy('bestStreak', 'desc').limit(FETCH_LIMIT)),
        readQuery(users.where('streak', '>', 0).orderBy('streak', 'desc').limit(FETCH_LIMIT)),
        readQuery(users.where('streak', '>', 0).where('lastVisit', '>=', cutoff).orderBy('streak', 'desc').orderBy('lastVisit', 'desc').limit(FETCH_LIMIT))
    ]);
    const byId = {};
    parts.forEach(function (rows) {
        rows.forEach(function (row) { byId[row.id] = row; });
    });
    const doc = buildBoards(Object.keys(byId).map(function (id) { return byId[id]; }), now);
    await ref.set(doc);
    return doc;
}

module.exports = {
    BOARD_SIZE: BOARD_SIZE,
    FETCH_LIMIT: FETCH_LIMIT,
    DEBOUNCE_MS: DEBOUNCE_MS,
    dayDiff: dayDiff,
    shiftDateKey: shiftDateKey,
    nextVisitStreak: nextVisitStreak,
    currentStreak: currentStreak,
    allTimeStreak: allTimeStreak,
    applyStreakUpdate: applyStreakUpdate,
    backfillPatch: backfillPatch,
    displayName: displayName,
    safePic: safePic,
    selectBoard: selectBoard,
    buildBoards: buildBoards,
    packDoc: packDoc,
    refresh: refresh
};
