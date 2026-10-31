'use strict';

// Exact rank for one player on a public leaderboard.
//
// The XP search box used to call searchUsers, which read the top 500 users
// and then ran one count() per prefix hit outside that page. This module
// does not scan a board. It reads the named player's own score and counts
// players who sort ahead of them. Ties are more count() queries, not a
// page of tied docs. A lookup does not read the ghost list.
//
// Ghost mode is absent on most profiles, so a count() cannot filter
// ghostMode != true (that drops documents where the field is missing).
// Rank is count(ahead) minus count(ahead AND ghostMode == true). Banned
// players stay in the count. The order matches the snapshot builders:
// XP value, then username, then uid; quest passes, then pass rate, then
// who got there first; prediction accuracy, then correct, then volume,
// then who got there first; streak length, then who got there first.
//
// Indexes for these counts are in firestore.indexes.json. Deploy those
// before this function. A missing index returns failed-precondition.

const functionsV1 = require('firebase-functions/v1');
const admin = require('firebase-admin');
const questBoard = require('./questBoard');
const predictionStats = require('./predictionStats');
const streakBoard = require('./streakBoard');
const { offsetDateKey } = require('./offsetDay');

const RATE_MAX = 20;
const RATE_ANON_MAX = 5;
const RATE_WINDOW_MS = 60 * 1000;
const SUGGEST_LIMIT = 8;
const SUGGEST_FETCH = 12;

const BOARD_ALIAS = {
    xp: 'xp',
    quest: 'quest',
    predict: 'predict',
    price: 'predict',
    predictor: 'predict',
    prediction: 'predict',
    streak: 'streak',
    streaks: 'streak'
};

const PERIOD_ALIAS = {
    xp: { alltime: 'alltime', weekly: 'weekly', week: 'weekly', monthly: 'monthly', month: 'monthly' },
    quest: { alltime: 'alltime', week: 'week', weekly: 'week', month: 'month', monthly: 'month' },
    predict: { alltime: 'alltime', weekly: 'weekly', week: 'weekly', monthly: 'monthly', month: 'monthly' },
    streak: { alltime: 'alltime', current: 'current' }
};

const XP_FIELD = { alltime: 'points', weekly: 'weeklyXP', monthly: 'monthlyXP' };

// Composite indexes the count queries need. Single-field ranges are automatic.
const INDEX_SPECS = [
    ['public_profiles', ['ghostMode', 'points']],
    ['public_profiles', ['points', 'username_lower']],
    ['public_profiles', ['ghostMode', 'points', 'username_lower']],
    ['public_profiles', ['points', 'username_lower', '__name__']],
    ['public_profiles', ['ghostMode', 'points', 'username_lower', '__name__']],
    ['public_profiles', ['ghostMode', 'weeklyXP']],
    ['public_profiles', ['weeklyXP', 'username_lower']],
    ['public_profiles', ['ghostMode', 'weeklyXP', 'username_lower']],
    ['public_profiles', ['weeklyXP', 'username_lower', '__name__']],
    ['public_profiles', ['ghostMode', 'weeklyXP', 'username_lower', '__name__']],
    ['public_profiles', ['ghostMode', 'monthlyXP']],
    ['public_profiles', ['monthlyXP', 'username_lower']],
    ['public_profiles', ['ghostMode', 'monthlyXP', 'username_lower']],
    ['public_profiles', ['monthlyXP', 'username_lower', '__name__']],
    ['public_profiles', ['ghostMode', 'monthlyXP', 'username_lower', '__name__']]
];

function pushSpec(coll, fields) {
    if (fields.length > 1) INDEX_SPECS.push([coll, fields]);
    INDEX_SPECS.push([coll, ['ghostMode'].concat(fields)]);
}

[
    ['passes', 'attempts'],
    ['passes', 'passedAttempts', 'attempts'],
    ['passes', 'passedAttempts', 'attempts', 'reachedAt'],
    ['passes', 'passedAttempts', 'attempts', 'reachedAt', '__name__'],
    ['weekKey', 'weekPasses', 'weekAttempts'],
    ['weekKey', 'weekPasses', 'weekPassedAttempts', 'weekAttempts'],
    ['weekKey', 'weekPasses', 'weekPassedAttempts', 'weekAttempts', 'weekReachedAt'],
    ['weekKey', 'weekPasses', 'weekPassedAttempts', 'weekAttempts', 'weekReachedAt', '__name__'],
    ['monthKey', 'monthPasses', 'monthAttempts'],
    ['monthKey', 'monthPasses', 'monthPassedAttempts', 'monthAttempts'],
    ['monthKey', 'monthPasses', 'monthPassedAttempts', 'monthAttempts', 'monthReachedAt'],
    ['monthKey', 'monthPasses', 'monthPassedAttempts', 'monthAttempts', 'monthReachedAt', '__name__']
].forEach(function (fields) { pushSpec('quest_lb_stats', fields); });

[
    ['predAccuracy', 'predTotal'],
    ['predAccuracy', 'predCorrect', 'predTotal'],
    ['predAccuracy', 'predCorrect', 'predTotal', 'reachedAt'],
    ['predAccuracy', 'predCorrect', 'predTotal', 'reachedAt', '__name__'],
    ['weekKey', 'weekAccuracy', 'weekTotal'],
    ['weekKey', 'weekAccuracy', 'weekCorrect', 'weekTotal'],
    ['weekKey', 'weekAccuracy', 'weekCorrect', 'weekTotal', 'weekReachedAt'],
    ['weekKey', 'weekAccuracy', 'weekCorrect', 'weekTotal', 'weekReachedAt', '__name__'],
    ['monthKey', 'monthAccuracy', 'monthTotal'],
    ['monthKey', 'monthAccuracy', 'monthCorrect', 'monthTotal'],
    ['monthKey', 'monthAccuracy', 'monthCorrect', 'monthTotal', 'monthReachedAt'],
    ['monthKey', 'monthAccuracy', 'monthCorrect', 'monthTotal', 'monthReachedAt', '__name__']
].forEach(function (fields) { pushSpec('prediction_stats', fields); });

[
    ['bestStreak'],
    ['streak'],
    ['streak', 'bestStreak'],
    ['bestStreak', 'bestStreakAt', 'streak'],
    ['streak', 'bestStreak', 'bestStreakAt'],
    ['bestStreak', 'streak', 'username_lower'],
    ['bestStreak', 'bestStreakAt', 'streak', 'username_lower'],
    ['bestStreak', 'bestStreakAt', 'username_lower', 'streak', '__name__'],
    ['lastVisit', 'streak'],
    ['lastVisit', 'streak', 'streakFreezes'],
    ['lastVisit', 'streak', 'streakReachedAt'],
    ['lastVisit', 'streak', 'streakFreezes', 'streakReachedAt'],
    ['lastVisit', 'streak', 'streakReachedAt', 'username_lower'],
    ['lastVisit', 'streak', 'streakReachedAt', 'username_lower', '__name__'],
    ['lastVisit', 'streak', 'streakFreezes', 'streakReachedAt', 'username_lower']
].forEach(function (fields) { pushSpec('users', fields); });

function whole(value) {
    const n = Math.floor(Number(value) || 0);
    return n > 0 ? n : 0;
}

function fail(code, message) {
    const err = new Error(message);
    err.code = code;
    err.rankError = true;
    return err;
}

function canonBoard(value) {
    const key = String(value || '').trim().toLowerCase();
    return BOARD_ALIAS[key] || '';
}

function canonPeriod(board, value) {
    const table = PERIOD_ALIAS[board] || {};
    const key = String(value || 'alltime').trim().toLowerCase();
    return table[key] || '';
}

function cleanQuery(raw) {
    let text = String(raw == null ? '' : raw).replace(/^\s+|\s+$/g, '');
    if (text.charAt(0) === '@') text = text.slice(1).replace(/^\s+/, '');
    if (text.length > 40) text = text.slice(0, 40);
    return text;
}

function queryLower(raw) {
    return cleanQuery(raw).toLowerCase();
}

function looksPrivate(text) {
    return text.indexOf('@') !== -1 || text.indexOf(' ') !== -1 || /[<>]/.test(text);
}

function displayName(username) {
    return streakBoard.displayName(username);
}

function nameLower(data) {
    const stored = data && data.username_lower;
    if (stored) return String(stored).trim().toLowerCase();
    return displayName(data && data.username).toLowerCase();
}

function nextRate(prev, nowMs, max) {
    const now = Number(nowMs) || 0;
    const start = Number(prev && prev.windowStartMs) || 0;
    const count = Number(prev && prev.count) || 0;
    const limit = max > 0 ? max : RATE_MAX;
    if (!start || now - start >= RATE_WINDOW_MS) {
        return { allowed: true, count: 1, windowStartMs: now };
    }
    if (count >= limit) return { allowed: false, count: count, windowStartMs: start };
    return { allowed: true, count: count + 1, windowStartMs: start };
}

function anonymousCaller(context) {
    const token = context && context.auth && context.auth.token;
    const firebase = token && token.firebase;
    return !!(firebase && firebase.sign_in_provider === 'anonymous');
}

function publicResult(row) {
    const src = row || {};
    const out = {
        status: src.status || 'not_found',
        board: src.board || '',
        period: src.period || ''
    };
    if (src.status === 'ok' || src.status === 'unqualified') {
        out.username = displayName(src.username);
    }
    if (src.status === 'ok') {
        out.rank = whole(src.rank) || 1;
        out.score = whole(src.score);
        if (src.pct != null && src.pct !== '') out.pct = whole(src.pct);
    }
    if (src.status === 'unqualified' || src.status === 'not_found') {
        out.message = String(src.message || 'No player found');
    }
    if (src.status === 'unqualified') {
        out.have = whole(src.have);
        out.needed = whole(src.needed);
    }
    if (Array.isArray(src.suggestions) && src.suggestions.length) {
        out.suggestions = src.suggestions.slice(0, SUGGEST_LIMIT).map(function (item) {
            return { username: displayName(item && item.username) };
        }).filter(function (item) { return item.username && item.username !== 'Anon'; });
    }
    return out;
}

function whereAll(query, clauses, docId) {
    let next = query;
    (clauses || []).forEach(function (clause) {
        const field = clause[0] === '__name__' ? docId : clause[0];
        next = next.where(field, clause[1], clause[2]);
    });
    return next;
}

async function countOf(query) {
    const snap = await query.count().get();
    const data = snap && typeof snap.data === 'function' ? snap.data() : {};
    return Math.max(0, Number(data && data.count) || 0);
}

async function countVisible(collection, clauses, docId) {
    const all = await countOf(whereAll(collection, clauses, docId));
    const ghosts = await countOf(whereAll(collection, [['ghostMode', '==', true]].concat(clauses), docId));
    return Math.max(0, all - ghosts);
}

function indexProblem(err) {
    if (!err || err.rankError) return false;
    const code = err.code;
    if (code === 9 || code === 'failed-precondition') return true;
    const msg = String(err.message || '').toLowerCase();
    return msg.indexOf('index') !== -1 || msg.indexOf('requires an index') !== -1;
}

async function takeRate(db, uid, nowMs, max) {
    const ref = db.collection('rate_limits').doc('lb_rank_' + uid);
    const expireAt = new Date((Number(nowMs) || 0) + RATE_WINDOW_MS * 2);
    return db.runTransaction(async function (tx) {
        const snap = await tx.get(ref);
        const prev = snap && snap.exists ? (snap.data() || {}) : {};
        const decision = nextRate(prev, nowMs, max);
        if (!decision.allowed) return decision;
        tx.set(ref, {
            count: decision.count,
            windowStartMs: decision.windowStartMs,
            expireAt: expireAt
        });
        return decision;
    });
}

async function suggestNames(db, prefix, callerUid) {
    const lower = String(prefix || '');
    if (lower.length < 2 || !/^[a-z0-9_\-.]+$/.test(lower)) return [];
    const end = lower + '\uf8ff';
    const snap = await db.collection('public_profiles')
        .where('username_lower', '>=', lower)
        .where('username_lower', '<=', end)
        .limit(SUGGEST_FETCH)
        .get();
    const rows = [];
    const list = [];
    if (snap && snap.forEach) snap.forEach(function (doc) { list.push(doc); });
    list.forEach(function (doc) {
        const data = (doc.data && doc.data()) || {};
        if (data.ghostMode === true && doc.id !== callerUid) return;
        const name = displayName(data.username);
        if (!name || name === 'Anon') return;
        rows.push({ username: name, sort: nameLower(data) });
    });
    rows.sort(function (a, b) {
        if (a.sort === b.sort) return 0;
        return a.sort < b.sort ? -1 : 1;
    });
    const seen = {};
    const out = [];
    rows.forEach(function (row) {
        const key = row.sort;
        if (seen[key] || out.length >= SUGGEST_LIMIT) return;
        seen[key] = true;
        out.push({ username: row.username });
    });
    return out;
}

function notFound(board, period, typed, suggestions) {
    const safe = typed && !looksPrivate(typed) ? typed : '';
    return {
        status: 'not_found',
        board: board,
        period: period,
        message: safe ? ('No player named @' + safe) : 'No player found',
        suggestions: suggestions || []
    };
}

async function profileByUsername(db, lower) {
    const snap = await db.collection('public_profiles').where('username_lower', '==', lower).limit(2).get();
    const docs = [];
    if (snap && snap.forEach) snap.forEach(function (doc) { docs.push(doc); });
    if (docs.length === 1) return docs[0];
    if (docs.length > 1) return { ambiguous: true };
    if (!lower || lower.indexOf('/') !== -1) return null;
    const reserved = await db.collection('usernames').doc(lower).get();
    if (!reserved || !reserved.exists) return null;
    const uid = String((reserved.data() || {}).uid || '');
    if (!uid || uid.indexOf('/') !== -1) return null;
    const profile = await db.collection('public_profiles').doc(uid).get();
    if (!profile || !profile.exists) return null;
    const data = profile.data() || {};
    if (nameLower(data) !== lower) return null;
    return profile;
}

async function loadUser(db, uid) {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap || !snap.exists) return {};
    return snap.data() || {};
}

function playerFrom(uid, profile, user) {
    const pub = profile || {};
    const row = user || {};
    const username = pub.username || row.username || '';
    return {
        uid: uid,
        username: username,
        usernameLower: nameLower({ username: username, username_lower: pub.username_lower || row.username_lower }),
        ghost: pub.ghostMode === true || row.ghostMode === true,
        profile: pub,
        user: row
    };
}

async function resolvePlayer(db, data, callerUid) {
    if (data && data.me === true) {
        const profileSnap = await db.collection('public_profiles').doc(callerUid).get();
        const profile = profileSnap && profileSnap.exists ? (profileSnap.data() || {}) : {};
        const user = await loadUser(db, callerUid);
        if ((!profileSnap || !profileSnap.exists) && !Object.keys(user).length) return null;
        return playerFrom(callerUid, profile, user);
    }
    const typed = cleanQuery(data && data.username);
    const lower = typed.toLowerCase();
    if (!lower || looksPrivate(typed) || lower === 'anon' || lower === 'anonymous') return { missing: true, typed: typed };
    const found = await profileByUsername(db, lower);
    if (found && found.ambiguous) return { missing: true, typed: typed };
    if (!found) return { missing: true, typed: typed };
    const profile = found.data() || {};
    const user = await loadUser(db, found.id);
    return playerFrom(found.id, profile, user);
}

function xpQualified(player, field) {
    return whole(player.profile[field]) > 0;
}

async function rankXp(db, player, period, docId) {
    const field = XP_FIELD[period];
    const value = whole(player.profile[field]);
    if (value <= 0) {
        return { status: 'unqualified', username: player.username, score: 0, have: 0, needed: 1, message: '@' + displayName(player.username) + ' needs XP on this board' };
    }
    const coll = db.collection('public_profiles');
    const lower = player.usernameLower || '';
    const parts = await Promise.all([
        countVisible(coll, [[field, '>', value]], docId),
        lower ? countVisible(coll, [[field, '==', value], ['username_lower', '<', lower]], docId) : 0,
        lower ? countVisible(coll, [[field, '==', value], ['username_lower', '==', lower], ['__name__', '<', player.uid]], docId) : 0
    ]);
    return {
        status: 'ok',
        username: player.username,
        rank: 1 + parts[0] + parts[1] + parts[2],
        score: value
    };
}

function questView(stats, period, nowMs) {
    return questBoard.viewFromStats(stats || {}, period, nowMs);
}

function questAhead(view, playerView) {
    if (whole(view.attempts) < playerView.min) return false;
    if (whole(view.passes) > playerView.passes) return true;
    return false;
}

function rateDelta(a, b) {
    const aa = whole(a.attempts);
    const ba = whole(b.attempts);
    if (aa <= 0 && ba <= 0) return 0;
    if (aa <= 0) return 1;
    if (ba <= 0) return -1;
    const left = whole(a.passedAttempts) * ba;
    const right = whole(b.passedAttempts) * aa;
    if (left === right) return 0;
    return right > left ? 1 : -1;
}

function compareQuest(a, b) {
    const ap = whole(a.passes);
    const bp = whole(b.passes);
    if (bp !== ap) return bp - ap;
    const rate = rateDelta(a, b);
    if (rate !== 0) return rate;
    const ar = whole(a.reachedAt) || Number.MAX_SAFE_INTEGER;
    const br = whole(b.reachedAt) || Number.MAX_SAFE_INTEGER;
    if (ar !== br) return ar - br;
    const an = displayName(a.username).toLowerCase();
    const bn = displayName(b.username).toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    return String(a.uid || '').localeCompare(String(b.uid || ''));
}

async function sumVisible(collection, groups, docId) {
    const lists = (groups || []).filter(function (clauses) { return clauses && clauses.length; });
    const parts = await Promise.all(lists.map(function (clauses) {
        return countVisible(collection, clauses, docId);
    }));
    let total = 0;
    parts.forEach(function (n) { total += n; });
    return total;
}

function questFields(period, nowMs) {
    if (period === 'week') {
        return {
            key: ['weekKey', '==', questBoard.weekKey(nowMs)],
            passes: 'weekPasses',
            passed: 'weekPassedAttempts',
            attempts: 'weekAttempts',
            reached: 'weekReachedAt'
        };
    }
    if (period === 'month') {
        return {
            key: ['monthKey', '==', questBoard.monthKey(nowMs)],
            passes: 'monthPasses',
            passed: 'monthPassedAttempts',
            attempts: 'monthAttempts',
            reached: 'monthReachedAt'
        };
    }
    return { key: null, passes: 'passes', passed: 'passedAttempts', attempts: 'attempts', reached: 'reachedAt' };
}

function keyed(fields, clauses) {
    return fields.key ? [fields.key].concat(clauses) : clauses;
}

// Same passes, then a better pass rate, then an earlier reachedAt, then uid.
// A better rate is a count: the same number of successful attempts in fewer
// tries, or more successful attempts without more tries. Ghosts are removed
// with a second count on ghostMode, not by reading their docs.
function questTieGroups(fields, view, min, uid) {
    const passes = whole(view.passes);
    const passed = whole(view.passedAttempts);
    const attempts = whole(view.attempts);
    const reached = whole(view.reachedAt);
    const groups = [
        keyed(fields, [[fields.passes, '>', passes], [fields.attempts, '>=', min]])
    ];
    if (attempts > min) {
        groups.push(keyed(fields, [
            [fields.passes, '==', passes],
            [fields.passed, '==', passed],
            [fields.attempts, '>=', min],
            [fields.attempts, '<', attempts]
        ]));
    }
    groups.push(keyed(fields, [
        [fields.passes, '==', passes],
        [fields.passed, '>', passed],
        [fields.attempts, '>=', min],
        [fields.attempts, '<=', attempts]
    ]));
    const sameRate = [
        [fields.passes, '==', passes],
        [fields.passed, '==', passed],
        [fields.attempts, '==', attempts]
    ];
    if (reached > 0) {
        groups.push(keyed(fields, sameRate.concat([[fields.reached, '>', 0], [fields.reached, '<', reached]])));
        groups.push(keyed(fields, sameRate.concat([[fields.reached, '==', reached], ['__name__', '<', uid]])));
    } else {
        groups.push(keyed(fields, sameRate.concat([[fields.reached, '>', 0]])));
    }
    return groups;
}

async function rankQuest(db, player, period, nowMs, docId) {
    const min = questBoard.MIN[period] || questBoard.MIN.alltime;
    const statsSnap = await db.collection('quest_lb_stats').doc(player.uid).get();
    const stats = statsSnap && statsSnap.exists ? (statsSnap.data() || {}) : {};
    const view = questView(stats, period, nowMs);
    const shown = displayName(player.username);
    if (whole(view.attempts) < min) {
        return {
            status: 'unqualified',
            username: player.username,
            have: whole(view.attempts),
            needed: min,
            message: '@' + shown + ' needs ' + min + ' attempts'
        };
    }
    if (whole(view.passes) < 1) {
        return {
            status: 'unqualified',
            username: player.username,
            have: whole(view.attempts),
            needed: min,
            message: '@' + shown + ' needs a passed quest'
        };
    }
    const fields = questFields(period, nowMs);
    const ahead = await sumVisible(db.collection('quest_lb_stats'), questTieGroups(fields, view, min, player.uid), docId);
    return {
        status: 'ok',
        username: player.username,
        rank: 1 + ahead,
        score: whole(view.passes),
        pct: questBoard.displayPct(view.passedAttempts, view.attempts)
    };
}

function predictFields(period) {
    if (period === 'weekly') {
        return { keyName: 'weekKey', keyOf: predictionStats.weekKey, accuracy: 'weekAccuracy', correct: 'weekCorrect', total: 'weekTotal', reached: 'weekReachedAt' };
    }
    if (period === 'monthly') {
        return { keyName: 'monthKey', keyOf: predictionStats.monthKey, accuracy: 'monthAccuracy', correct: 'monthCorrect', total: 'monthTotal', reached: 'monthReachedAt' };
    }
    return { keyName: '', keyOf: null, accuracy: 'predAccuracy', correct: 'predCorrect', total: 'predTotal', reached: 'reachedAt' };
}

function predictKeyed(fields, clauses, nowMs) {
    if (!fields.keyName) return clauses;
    return [[fields.keyName, '==', fields.keyOf(nowMs)]].concat(clauses);
}

function predictTieGroups(fields, view, min, uid, nowMs) {
    const accuracy = Number(view.accuracy) || 0;
    const correct = whole(view.correct);
    const total = whole(view.total);
    const reached = whole(view.reachedAt);
    const groups = [
        predictKeyed(fields, [[fields.accuracy, '>', accuracy], [fields.total, '>=', min]], nowMs),
        predictKeyed(fields, [[fields.accuracy, '==', accuracy], [fields.correct, '>', correct], [fields.total, '>=', min]], nowMs),
        predictKeyed(fields, [[fields.accuracy, '==', accuracy], [fields.correct, '==', correct], [fields.total, '>', total]], nowMs)
    ];
    const same = [
        [fields.accuracy, '==', accuracy],
        [fields.correct, '==', correct],
        [fields.total, '==', total]
    ];
    if (reached > 0) {
        groups.push(predictKeyed(fields, same.concat([[fields.reached, '>', 0], [fields.reached, '<', reached]]), nowMs));
        groups.push(predictKeyed(fields, same.concat([[fields.reached, '==', reached], ['__name__', '<', uid]]), nowMs));
    } else {
        groups.push(predictKeyed(fields, same.concat([[fields.reached, '>', 0]]), nowMs));
    }
    return groups;
}

function predictView(stats, period, nowMs) {
    const src = stats || {};
    if (period === 'weekly' && src.weekKey !== predictionStats.weekKey(nowMs)) {
        return { correct: 0, total: 0, accuracy: 0, reachedAt: null };
    }
    if (period === 'monthly' && src.monthKey !== predictionStats.monthKey(nowMs)) {
        return { correct: 0, total: 0, accuracy: 0, reachedAt: null };
    }
    return predictionStats.viewOf(src, period);
}

async function rankPredict(db, player, period, nowMs, docId) {
    const min = predictionStats.minimumFor(period);
    const statsSnap = await db.collection('prediction_stats').doc(player.uid).get();
    const stats = statsSnap && statsSnap.exists ? (statsSnap.data() || {}) : {};
    const view = predictView(stats, period, nowMs);
    const shown = displayName(player.username);
    if (whole(view.total) < min) {
        const noun = min === 1 ? 'prediction' : 'predictions';
        return {
            status: 'unqualified',
            username: player.username,
            have: whole(view.total),
            needed: min,
            message: '@' + shown + ' needs ' + min + ' ' + noun
        };
    }
    const fields = predictFields(period);
    const ahead = await sumVisible(db.collection('prediction_stats'), predictTieGroups(fields, view, min, player.uid, nowMs), docId);
    return {
        status: 'ok',
        username: player.username,
        rank: 1 + ahead,
        score: predictionStats.displayPct(view.correct, view.total),
        pct: predictionStats.displayPct(view.correct, view.total)
    };
}

function reachedMs(value) {
    const n = Number(value) || 0;
    return n > 0 ? n : 0;
}

function streakTimeGroups(prefix, timeField, time, lower, uid, tail) {
    const rest = tail || [];
    const groups = [];
    if (time > 0) {
        groups.push(prefix.concat(rest).concat([[timeField, '>', 0], [timeField, '<', time]]));
        if (lower && !rest.length) {
            groups.push(prefix.concat([[timeField, '==', time], ['username_lower', '<', lower]]));
            groups.push(prefix.concat([[timeField, '==', time], ['username_lower', '==', lower], ['__name__', '<', uid]]));
        }
    } else if (lower && !rest.length) {
        groups.push(prefix.concat([['username_lower', '<', lower]]));
        groups.push(prefix.concat([['username_lower', '==', lower], ['__name__', '<', uid]]));
    }
    return groups;
}

async function rankStreak(db, player, period, nowMs, docId) {
    const user = player.user || {};
    const today = offsetDateKey(nowMs);
    const shown = displayName(player.username || user.username);
    const coll = db.collection('users');
    const lower = player.usernameLower || nameLower(user);
    if (period === 'current') {
        const value = streakBoard.currentStreak(user, today);
        if (value <= 0) {
            return { status: 'unqualified', username: player.username, have: 0, needed: 1, message: '@' + shown + ' has no current streak' };
        }
        const yesterday = streakBoard.shiftDateKey(today, -1);
        const twoAgo = streakBoard.shiftDateKey(today, -2);
        const alive = [
            { visit: today, tail: [] },
            { visit: yesterday, tail: [] },
            { visit: twoAgo, tail: [['streakFreezes', '>', 0]] }
        ];
        const groups = [];
        const reached = reachedMs(user.streakReachedAt);
        alive.forEach(function (bucket) {
            const visit = [['lastVisit', '==', bucket.visit]];
            groups.push(visit.concat([['streak', '>', value]]).concat(bucket.tail));
            streakTimeGroups(visit.concat([['streak', '==', value]]), 'streakReachedAt', reached, lower, player.uid, bucket.tail).forEach(function (clauses) {
                groups.push(clauses);
            });
        });
        const ahead = await sumVisible(coll, groups, docId);
        return { status: 'ok', username: player.username, rank: 1 + ahead, score: value };
    }
    const value = streakBoard.allTimeStreak(user);
    if (value <= 0) {
        return { status: 'unqualified', username: player.username, have: 0, needed: 1, message: '@' + shown + ' has no streak yet' };
    }
    const time = reachedMs(user.bestStreakAt);
    const groups = [
        [['bestStreak', '>', value]],
        [['streak', '>', value]],
        [['streak', '>', value], ['bestStreak', '>', value]]
    ];
    // The third count is the overlap of the first two, subtracted below.
    const overlap = groups.pop();
    if (time > 0) {
        groups.push([
            ['bestStreak', '==', value],
            ['bestStreakAt', '>', 0],
            ['bestStreakAt', '<', time],
            ['streak', '<=', value]
        ]);
        groups.push([
            ['streak', '==', value],
            ['bestStreak', '<', value],
            ['bestStreakAt', '>', 0],
            ['bestStreakAt', '<', time]
        ]);
        if (lower) {
            groups.push([
                ['bestStreak', '==', value],
                ['bestStreakAt', '==', time],
                ['streak', '<=', value],
                ['username_lower', '<', lower]
            ]);
            groups.push([
                ['bestStreak', '==', value],
                ['bestStreakAt', '==', time],
                ['username_lower', '==', lower],
                ['streak', '<=', value],
                ['__name__', '<', player.uid]
            ]);
        }
    } else if (lower) {
        groups.push([
            ['bestStreak', '==', value],
            ['streak', '<=', value],
            ['username_lower', '<', lower]
        ]);
    }
    const parts = await Promise.all([
        sumVisible(coll, groups, docId),
        countVisible(coll, overlap, docId)
    ]);
    return { status: 'ok', username: player.username, rank: 1 + Math.max(0, parts[0] - parts[1]), score: value };
}

async function lookup(db, data, callerUid, board, period, nowMs, docId) {
    const player = await resolvePlayer(db, data, callerUid);
    const typed = cleanQuery(data && (data.me === true ? '' : data.username));
    if (!player || player.missing) {
        const suggestions = await suggestNames(db, queryLower(typed), callerUid);
        return notFound(board, period, typed, suggestions);
    }
    if (player.ghost && player.uid !== callerUid) {
        const suggestions = await suggestNames(db, player.usernameLower, callerUid);
        return notFound(board, period, displayName(player.username), suggestions);
    }
    let ranked;
    if (board === 'xp') ranked = await rankXp(db, player, period, docId);
    else if (board === 'quest') ranked = await rankQuest(db, player, period, nowMs, docId);
    else if (board === 'predict') ranked = await rankPredict(db, player, period, nowMs, docId);
    else ranked = await rankStreak(db, player, period, nowMs, docId);
    ranked.board = board;
    ranked.period = period;
    return ranked;
}

async function handleLeaderboardRank(db, adminSdk, data, context, nowMs) {
    if (!context || !context.auth || !context.auth.uid) {
        throw fail('unauthenticated', 'Sign in to search the leaderboard.');
    }
    const board = canonBoard(data && data.board);
    const period = board && canonPeriod(board, data && data.period);
    if (!board || !period) throw fail('invalid-argument', 'Unknown board or period.');
    const caller = context.auth.uid;
    const rate = await takeRate(db, caller, nowMs, anonymousCaller(context) ? RATE_ANON_MAX : RATE_MAX);
    if (!rate.allowed) throw fail('resource-exhausted', 'Too many lookups. Try again in a minute.');
    const docId = adminSdk.firestore.FieldPath.documentId();
    try {
        const row = await lookup(db, data || {}, caller, board, period, nowMs, docId);
        return publicResult(row);
    } catch (err) {
        if (err && err.rankError) throw err;
        if (indexProblem(err)) {
            throw fail('failed-precondition', 'Leaderboard rank indexes are still building.');
        }
        console.warn('[leaderboardRank]', err && err.message ? err.message : err);
        throw fail('internal', 'Rank lookup failed.');
    }
}

const leaderboardRank = functionsV1.runWith({ enforceAppCheck: true, timeoutSeconds: 30, memory: '256MB' }).https.onCall(async function (data, context) {
    try {
        return await handleLeaderboardRank(admin.firestore(), admin, data, context, Date.now());
    } catch (err) {
        if (err && err.rankError) {
            throw new functionsV1.https.HttpsError(err.code || 'internal', err.message || 'Rank lookup failed.');
        }
        if (err instanceof functionsV1.https.HttpsError) throw err;
        console.warn('[leaderboardRank]', err && err.message ? err.message : err);
        throw new functionsV1.https.HttpsError('internal', 'Rank lookup failed.');
    }
});

module.exports = {
    RATE_MAX: RATE_MAX,
    RATE_ANON_MAX: RATE_ANON_MAX,
    SUGGEST_LIMIT: SUGGEST_LIMIT,
    INDEX_SPECS: INDEX_SPECS,
    canonBoard: canonBoard,
    canonPeriod: canonPeriod,
    cleanQuery: cleanQuery,
    nextRate: nextRate,
    publicResult: publicResult,
    compareQuest: compareQuest,
    handleLeaderboardRank: handleLeaderboardRank,
    leaderboardRank: leaderboardRank
};
