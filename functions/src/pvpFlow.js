'use strict';

const reservedNames = require('./reservedNames');

// Pure PvP decisions: lobby shouts, alert cooldown, push cap, grading, rewards.
// No Firebase. index.js and pvpResolve.js apply these inside transactions.

const LOBBY_SHOUT_MS = 15 * 60 * 1000;
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;
const PUSH_GAP_MS = 24 * 60 * 60 * 1000;
const PUSH_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PUSH_MAX_PER_WEEK = 3;
const PUSH_COOLDOWN_MS = PUSH_GAP_MS;
const LOBBY_STALE_MS = 45 * 1000;
const LOBBY_GLOBAL_WINDOW_MS = 15 * 60 * 1000;
const LOBBY_GLOBAL_SHOUT_CAP = 4;
const LOBBY_GLOBAL_PUSH_CAP = 1;
const SUMMARY_HEARTBEAT_MS = 20 * 1000;
const WIN_POINTS = 50;
const DRAW_POINTS = 5;
const CONSOLATION_POINTS = 25;
const PAIR_XP_CAP = 3;
const MIN_MATCH_MS = 30 * 1000;
const MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function safeDisplayName(name) {
    const cleaned = String(name || '')
        .replace(/[\r\n<>\[\]()@#*`_~|\\"']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 30);
    return cleaned || 'a Bitcoiner';
}

function lobbyShoutText(name) {
    // "just" terminates the chat @mention so the rest of the sentence stays text.
    return '⚔️ @' + safeDisplayName(name) + ' just started looking for a PvP opponent! [Tap to join](#pvp)';
}

function resultShoutText(info) {
    const src = info || {};
    const winner = safeDisplayName(src.winnerName);
    const loser = safeDisplayName(src.loserName);
    if (src.draw) {
        return '🤝 @' + winner + ' just drew a PvP match with ' + loser + '! [Tap to join](#pvp)';
    }
    const ws = Number(src.winnerScore) || 0;
    const ls = Number(src.loserScore) || 0;
    return '🏆 @' + winner + ' just won a PvP match against ' + loser + ' (' + ws + '–' + ls + ')! [Tap to join](#pvp)';
}

function lobbyShoutDocId(uid, nowMs) {
    const clean = String(uid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
    if (!clean) return '';
    const bucket = Math.floor((Number(nowMs) || 0) / LOBBY_SHOUT_MS);
    return 'pvp_lobby_' + clean + '_' + bucket;
}

function resultShoutDocId(matchId) {
    const clean = String(matchId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
    if (!clean) return '';
    return 'pvp_result_' + clean;
}

function rewardClaimId(matchId) {
    const clean = String(matchId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
    if (!clean) return '';
    return clean;
}

function shouldPostLobbyShout(input) {
    const src = input || {};
    const uid = String(src.uid || '');
    if (!uid) return { post: false, reason: 'no_uid' };
    if (src.anonymous === true) return { post: false, reason: 'anonymous' };
    if (src.banned === true) return { post: false, reason: 'banned' };
    const username = String(src.username || '').trim();
    if (!username) return { post: false, reason: 'no_username' };
    if (src.globalCap === true) return { post: false, reason: 'global_cap' };
    const now = Number(src.nowMs) || 0;
    const last = src.lastPostMs;
    if (typeof last === 'number' && isFinite(last) && (now - last) < LOBBY_SHOUT_MS) {
        return { post: false, reason: 'rate_limited' };
    }
    const docId = lobbyShoutDocId(uid, now);
    if (!docId) return { post: false, reason: 'no_uid' };
    const shown = safeDisplayName(username);
    if (!shown || shown === 'a Bitcoiner') return { post: false, reason: 'no_username' };
    return {
        post: true,
        reason: 'ok',
        docId: docId,
        text: lobbyShoutText(shown),
        mentionUid: uid,
        authorUid: 'nacho-bot',
        authorName: '🦌 Nacho',
        collection: 'global_chat',
        isNachoAuto: false,
    };
}

function lastSeenMs(value) {
    if (value == null) return 0;
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value.toMillis === 'function') {
        const ms = value.toMillis();
        return typeof ms === 'number' && isFinite(ms) ? ms : 0;
    }
    if (value instanceof Date) {
        const ms = value.getTime();
        return isFinite(ms) ? ms : 0;
    }
    const seconds = typeof value.seconds === 'number' ? value.seconds
        : (typeof value._seconds === 'number' ? value._seconds : null);
    if (seconds == null) return 0;
    return seconds * 1000;
}

// Finish time is the match's finishedAt, or the snapshot updateTime from the
// status write that ended it. Never Date.now() at settle, or a delayed retry
// can let a match under 30 seconds pay.
function matchFinishMs(after, updateTimeMs) {
    const fromField = lastSeenMs(after && after.finishedAt);
    if (fromField) return fromField;
    if (typeof updateTimeMs === 'number' && isFinite(updateTimeMs) && updateTimeMs > 0) return updateTimeMs;
    const fromUpdate = lastSeenMs(updateTimeMs);
    if (fromUpdate) return fromUpdate;
    return 0;
}

// null means the duration could not be measured and the planner must fail closed.
function matchDurationMs(createdMs, finishMs) {
    const created = typeof createdMs === 'number' && createdMs > 0 ? createdMs : 0;
    const finish = typeof finishMs === 'number' && finishMs > 0 ? finishMs : 0;
    if (!created || !finish) return null;
    return Math.max(0, finish - created);
}


function mergeLobbyEntry(entries, docId, data, nowMs) {
    const out = {};
    const src = entries || {};
    Object.keys(src).forEach(function (k) { out[k] = src[k]; });
    const now = Number(nowMs) || 0;
    const id = String(docId || '');
    if (id) {
        const waiting = !!(data && data.status === 'waiting');
        const seen = lastSeenMs(data && data.lastSeen);
        if (waiting && seen && (now - seen) < LOBBY_STALE_MS && (now - seen) >= -5000) {
            out[id] = {
                uid: String((data && data.uid) || id),
                name: safeDisplayName(data && data.name),
                since: lastSeenMs(data && data.since) || lastSeenMs(data && data.createdAt) || seen,
                lastSeen: seen,
            };
        } else {
            delete out[id];
        }
    }
    Object.keys(out).forEach(function (k) {
        const row = out[k];
        if (!row || !row.lastSeen || (now - row.lastSeen) >= LOBBY_STALE_MS) delete out[k];
    });
    return out;
}

function decideLobbyAlert(input) {
    const src = input || {};
    if (src.muted === true) return { show: false, reason: 'muted' };
    if (src.inPvp === true) return { show: false, reason: 'in_pvp' };
    if (src.busy === true) return { show: false, reason: 'busy' };
    const entryUid = String(src.entryUid || '');
    if (!entryUid || entryUid === String(src.myUid || '')) return { show: false, reason: 'self' };
    const key = entryUid + ':' + String(src.entrySince || 0);
    const seen = src.seenKeys || {};
    if (seen[key]) return { show: false, reason: 'already_seen' };
    const cd = typeof src.cooldownMs === 'number' ? src.cooldownMs : ALERT_COOLDOWN_MS;
    const now = Number(src.nowMs) || 0;
    if (typeof src.lastAlertMs === 'number' && isFinite(src.lastAlertMs) && (now - src.lastAlertMs) < cd) {
        return { show: false, reason: 'cooldown' };
    }
    return { show: true, reason: 'ok', seenKey: key };
}

function decidePvpPush(input) {
    const src = input || {};
    if (src.optedIn !== true) return { send: false, reason: 'not_opted_in' };
    if (src.muted === true) return { send: false, reason: 'muted' };
    const uid = String(src.uid || '');
    if (!uid || uid === String(src.joinerUid || '')) return { send: false, reason: 'self' };
    const now = Number(src.nowMs) || 0;
    const times = Array.isArray(src.pushTimes)
        ? src.pushTimes.map(Number).filter(function (t) { return isFinite(t) && (now - t) >= 0 && (now - t) < PUSH_WEEK_MS; })
        : [];
    let last = null;
    if (typeof src.lastPushMs === 'number' && isFinite(src.lastPushMs)) last = src.lastPushMs;
    times.forEach(function (t) { if (last == null || t > last) last = t; });
    if (last != null && (now - last) < PUSH_GAP_MS) return { send: false, reason: 'rate_limited' };
    if (times.length >= PUSH_MAX_PER_WEEK) return { send: false, reason: 'rate_limited' };
    return { send: true, reason: 'ok' };
}

function isBadgeClaim(action) {
    const text = String(action || '').trim();
    if (/^badge_earned$/i.test(text)) return true;
    return /^(?:Badge|🎖️ Badge|🏅 Badge):\s+\S/.test(text);
}

function isClientPvpReward(actionKey, action) {
    if (isBadgeClaim(action)) return false;
    if (/pvp/i.test(String(actionKey || ''))) return true;
    if (/pvp/i.test(String(action || ''))) return true;
    return false;
}

function pickBothCorrectWinner(p1AnsweredAt, p2AnsweredAt) {
    const a = Date.parse(p1AnsweredAt || '') || 0;
    const b = Date.parse(p2AnsweredAt || '') || 0;
    if (a && b && a !== b) return a < b ? 'player1' : 'player2';
    return 'player1';
}

function gradeRound(p1Selected, p2Selected, correctIdx, p1At, p2At) {
    const p1 = p1Selected === correctIdx;
    const p2 = p2Selected === correctIdx;
    if (p1 && p2) {
        return { outcome: pickBothCorrectWinner(p1At, p2At), p1correct: true, p2correct: true };
    }
    if (p1 && !p2) return { outcome: 'player1', p1correct: true, p2correct: false };
    if (p2 && !p1) return { outcome: 'player2', p1correct: false, p2correct: true };
    return { outcome: 'reroll', p1correct: false, p2correct: false };
}

function countWins(answers) {
    return (answers || []).filter(function (a) { return a && a.won; }).length;
}

function streakPts(answers, winIdx) {
    let streak = 1;
    for (let i = winIdx - 1; i >= 0; i--) {
        if (answers[i] && answers[i].won) streak++;
        else break;
    }
    return 10 + (streak > 1 ? 5 * (streak - 1) : 0);
}

function matchShouldFinish(p1Wins, p2Wins) {
    const a = p1Wins || 0;
    const b = p2Wins || 0;
    return (a + b) >= 5 || a >= 3 || b >= 3;
}

function shuffleQuestion(q, rng) {
    const random = typeof rng === 'function' ? rng : Math.random;
    const src = q || {};
    const options = Array.isArray(src.options) ? src.options.slice() : [];
    const correctText = options[src.correct];
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const tmp = options[i];
        options[i] = options[j];
        options[j] = tmp;
    }
    return {
        q: String(src.q || '').slice(0, 300),
        options: options.map(function (opt) { return String(opt == null ? '' : opt).slice(0, 200); }),
        correct: options.indexOf(correctText),
    };
}


function farmDayKey(nowMs) {
    const when = new Date(Number(nowMs) || Date.now());
    if (Number.isNaN(when.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(when);
    const get = function (type) {
        for (let i = 0; i < parts.length; i++) {
            if (parts[i].type === type) return parts[i].value;
        }
        return '';
    };
    const y = get('year'), m = get('month'), d = get('day');
    return y && m && d ? y + '-' + m + '-' + d : '';
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

// Midnight at the start of an ET calendar day (YYYY-MM-DD). Returns 0 if the
// day string is not a real ET date.
function etStartOfDayMs(day) {
    const parts = String(day || '').split('-');
    if (parts.length !== 3) return 0;
    const y = Number(parts[0]), m = Number(parts[1]), d = Number(parts[2]);
    if (!y || !m || !d) return 0;
    const ymd = y + '-' + pad2(m) + '-' + pad2(d);
    const candidates = [
        Date.parse(ymd + 'T00:00:00-04:00'),
        Date.parse(ymd + 'T00:00:00-05:00'),
    ];
    for (let i = 0; i < candidates.length; i++) {
        const ms = candidates[i];
        if (!Number.isFinite(ms)) continue;
        if (farmDayKey(ms) === ymd && farmDayKey(ms - 1) !== ymd) return ms;
    }
    return 0;
}

// expireAt for pvp_pair_daily: end of the ET day plus 2 days (start of day+3).
// The Timestamp is written on the doc so a TTL policy can use it later; this
// code does not create the policy (needs Phil).
function pairDailyExpireAtMs(day) {
    const start = etStartOfDayMs(day);
    if (!start) return 0;
    const later = start + (3 * 24 * 60 * 60 * 1000) + (12 * 60 * 60 * 1000);
    return etStartOfDayMs(farmDayKey(later));
}

function pairDailyId(day, uidA, uidB) {
    const a = String(uidA || '');
    const b = String(uidB || '');
    if (!day || !a || !b || a === b) return '';
    const ids = [a, b].sort();
    return day + '_' + ids[0] + '_' + ids[1];
}

function sideReward(key, player, winner, draw) {
    const p = player || {};
    const blocked = p.banned === true || p.anonymous === true;
    let points = 0;
    let pvpWins = 0;
    let pvpLosses = 0;
    let outcome = 'none';
    if (draw) {
        outcome = 'draw';
        points = DRAW_POINTS;
    } else if (winner === key) {
        outcome = 'win';
        points = WIN_POINTS;
        pvpWins = 1;
    } else if (winner) {
        outcome = 'loss';
        const wonRound = p.roundWins != null
            ? (Number(p.roundWins) || 0) > 0
            : (Number(p.score) || 0) > 0;
        points = wonRound ? CONSOLATION_POINTS : 0;
        pvpLosses = 1;
    }
    if (blocked) {
        points = 0;
        if (p.anonymous === true) {
            pvpWins = 0;
            pvpLosses = 0;
        }
    }
    return {
        uid: p.uid,
        points: points,
        pvpWins: pvpWins,
        pvpLosses: pvpLosses,
        outcome: outcome,
        blocked: blocked,
    };
}


function guestMatchBlocksRewards(p1, p2) {
    return (p1 && p1.anonymous === true) || (p2 && p2.anonymous === true);
}

function zeroGuestMatchRewards(players) {
    return (players || []).map(function (p) {
        return Object.assign({}, p, {
            points: 0,
            pvpWins: 0,
            pvpLosses: 0,
            blocked: true,
        });
    });
}

function planPvpReward(input) {
    const src = input || {};
    const empty = { grant: false, reason: 'not_finished', players: [], shout: null, voided: false };
    if (src.alreadyGranted === true) {
        return { grant: false, reason: 'already_granted', players: [], shout: null, voided: false };
    }
    const claimId = rewardClaimId(src.matchId);
    if (!claimId) return { grant: false, reason: 'no_match', players: [], shout: null, voided: false };
    const status = src.status;
    if (status !== 'finished' && status !== 'forfeit') return empty;
    const p1 = src.player1 || {};
    const p2 = src.player2 || {};
    if (!p1.uid || !p2.uid || p1.uid === p2.uid) {
        return { grant: false, reason: 'bad_players', players: [], shout: null, voided: false };
    }
    if (guestMatchBlocksRewards(p1, p2)) {
        return {
            grant: false,
            reason: 'guest_match',
            claimId: claimId,
            players: zeroGuestMatchRewards([
                { uid: p1.uid, points: 0, pvpWins: 0, pvpLosses: 0, outcome: 'none', blocked: true },
                { uid: p2.uid, points: 0, pvpWins: 0, pvpLosses: 0, outcome: 'none', blocked: true },
            ]),
            shout: null,
            voided: false,
            guestMatch: true,
        };
    }

    let winner = null;
    let draw = false;
    if (status === 'forfeit') {
        if (src.forfeitReason !== 'manual_leave') {
            return { grant: false, reason: 'disconnect', players: [], shout: null, voided: true };
        }
        const other = src.forfeitedBy === p1.uid ? 'player2' : (src.forfeitedBy === p2.uid ? 'player1' : '');
        if (!other) return { grant: false, reason: 'bad_forfeit', players: [], shout: null, voided: false };
        const ahead = other === 'player1' ? (p1.roundWins || 0) : (p2.roundWins || 0);
        const behind = other === 'player1' ? (p2.roundWins || 0) : (p1.roundWins || 0);
        if (ahead > behind) winner = other;
        else {
            return {
                grant: true,
                reason: 'forfeit_void',
                claimId: claimId,
                // K14: the player who left a tied match is marked leaver, so
                // settle resets their win streak. The other player keeps theirs.
                players: [
                    { uid: p1.uid, points: 0, pvpWins: 0, pvpLosses: 0, outcome: 'void', blocked: false, leaver: src.forfeitedBy === p1.uid },
                    { uid: p2.uid, points: 0, pvpWins: 0, pvpLosses: 0, outcome: 'void', blocked: false, leaver: src.forfeitedBy === p2.uid },
                ],
                shout: null,
                voided: true,
            };
        }
    } else {
        const w1 = p1.roundWins || 0;
        const w2 = p2.roundWins || 0;
        if (w1 > w2) winner = 'player1';
        else if (w2 > w1) winner = 'player2';
        else draw = true;
    }

    const players = [sideReward('player1', p1, winner, draw), sideReward('player2', p2, winner, draw)];
    let xpReason = draw ? 'draw' : 'win';
    function clearCappedStats(p) {
        p.points = 0;
        p.pvpWins = 0;
        p.pvpLosses = 0;
        p.statsCapped = true;
    }
    // null duration (could not measure finish time) fails closed, same as too short.
    // undefined duration is left alone so unit tests that omit it still pay.
    if (src.durationMs === null || (typeof src.durationMs === 'number' && src.durationMs < (src.minDurationMs || MIN_MATCH_MS))) {
        players.forEach(clearCappedStats);
        xpReason = 'too_short';
    } else if (typeof src.pairMatchesToday === 'number' && src.pairMatchesToday >= (src.pairXpCap || PAIR_XP_CAP)) {
        players.forEach(clearCappedStats);
        xpReason = 'pair_cap';
    } else {
        const minAge = src.minAccountAgeMs || MIN_ACCOUNT_AGE_MS;
        const ages = src.accountAgeMs || {};
        ['player1', 'player2'].forEach(function (key, i) {
            // A present but missing/non-numeric age fails closed.
            if (!Object.prototype.hasOwnProperty.call(ages, key)) return;
            if (typeof ages[key] !== 'number' || ages[key] < minAge) {
                clearCappedStats(players[i]);
                if (xpReason === 'draw' || xpReason === 'win') xpReason = 'young_account';
            }
        });
    }
    let shout = null;
    if (winner) {
        const w = winner === 'player1' ? p1 : p2;
        const l = winner === 'player1' ? p2 : p1;
        shout = {
            post: true,
            text: resultShoutText({
                winnerName: w.name,
                loserName: l.name,
                winnerScore: w.score || 0,
                loserScore: l.score || 0,
                draw: false,
            }),
            mentionUid: w.uid,
            docId: resultShoutDocId(src.matchId),
        };
    } else if (draw) {
        shout = {
            post: true,
            text: resultShoutText({ winnerName: p1.name, loserName: p2.name, draw: true }),
            mentionUid: p1.uid,
            docId: resultShoutDocId(src.matchId),
        };
    }
    // Capped and too-short matches must not post a lobby result shout.
    if (players.some(function (p) { return p && p.statsCapped === true; })) shout = null;
    return {
        grant: true,
        reason: xpReason,
        claimId: claimId,
        players: players,
        shout: shout,
        voided: false,
        guestMatch: false,
    };
}

function shouldSkipLobbySummary(before, after, summaryRow, nowMs) {
    if (!before || !after) return false;
    if (before.status !== 'waiting' || after.status !== 'waiting') return false;
    const fields = ['uid', 'name', 'profilePic', 'status'];
    for (let i = 0; i < fields.length; i++) {
        if (String(before[fields[i]] || '') !== String(after[fields[i]] || '')) return false;
    }
    if (!(lastSeenMs(after.lastSeen) > lastSeenMs(before.lastSeen))) return false;
    if (!summaryRow || !summaryRow.name) return false;
    const seen = lastSeenMs(summaryRow.lastSeen);
    const now = Number(nowMs) || 0;
    return seen > 0 && (now - seen) >= 0 && (now - seen) < SUMMARY_HEARTBEAT_MS;
}

function lobbyGlobalRoom(state, nowMs) {
    const now = Number(nowMs) || 0;
    const src = state || {};
    let windowStart = Number(src.windowStart) || 0;
    let shoutCount = Number(src.shoutCount) || 0;
    let pushCount = Number(src.pushCount) || 0;
    if (!windowStart || (now - windowStart) >= LOBBY_GLOBAL_WINDOW_MS) {
        windowStart = now;
        shoutCount = 0;
        pushCount = 0;
    }
    return {
        shout: shoutCount < LOBBY_GLOBAL_SHOUT_CAP,
        push: pushCount < LOBBY_GLOBAL_PUSH_CAP,
        windowStart: windowStart,
        shoutCount: shoutCount,
        pushCount: pushCount,
    };
}

function trustedLobbyKeep(summaryRow, lobby, nowMs, banned, docId) {
    if (banned) return null;
    if (!summaryRow || !summaryRow.name) return null;
    if (!lobby || lobby.status !== 'waiting') return null;
    const seen = lastSeenMs(lobby.lastSeen);
    const now = Number(nowMs) || 0;
    if (!seen || (now - seen) >= LOBBY_STALE_MS || (now - seen) < -5000) return null;
    return {
        uid: String(summaryRow.uid || docId || ''),
        name: String(summaryRow.name),
        since: lastSeenMs(summaryRow.since) || seen,
        lastSeen: seen,
    };
}

function planWinTicket(player) {
    const p = player || {};
    if (p.outcome !== 'win' || p.blocked) return { tickets: 0, reason: 'no_ticket' };
    if (p.ticketClaimedToday === true) return { tickets: 0, reason: 'daily_cap' };
    return { tickets: 1, reason: 'ok' };
}

function planXpWrite(awarded) {
    const n = Math.max(0, Number(awarded) || 0);
    return { points: n, weeklyXP: n, monthlyXP: n, overflowAdded: 0, write: n > 0 };
}

function playerKeyForUid(playerUids, uid) {
    const ids = playerUids || {};
    if (!uid) return '';
    if (ids.player1 === uid) return 'player1';
    if (ids.player2 === uid) return 'player2';
    return '';
}

function pushShardOrder(start) {
    const s = Math.abs(Math.floor(Number(start) || 0)) % 10;
    const out = [];
    for (let i = 0; i < 10; i++) out.push((s + i) % 10);
    return out;
}

function pvpPicAllowed(url) {
    const s = String(url || '');
    if (!s || s.length > 400) return '';
    if (/^https:\/\/firebasestorage\.googleapis\.com\//.test(s)) return s;
    if (/^https:\/\/[a-z0-9-]+\.firebasestorage\.app\//.test(s)) return s;
    if (/^https:\/\/assets\.bitcoineducation\.quest\//.test(s)) return s;
    if (/^https:\/\/lh3\.googleusercontent\.com\//.test(s)) return s;
    return '';
}


// leaver is true only for the player who manually left a tied match
// (forfeit_void). Leaving resets their streak like a loss, so walking out of a
// tied match cannot protect a streak. A normal draw or the other side of a
// void keeps the streak.
function planStreakUpdate(currentStreak, currentBest, outcome, leaver) {
    const streak = Math.max(0, Math.floor(Number(currentStreak) || 0));
    const best = Math.max(0, Math.floor(Number(currentBest) || 0));
    if (leaver === true) {
        return { pvpWinStreak: 0, pvpBestStreak: best };
    }
    if (outcome === 'win') {
        const next = streak + 1;
        return { pvpWinStreak: next, pvpBestStreak: Math.max(best, next) };
    }
    if (outcome === 'loss') {
        return { pvpWinStreak: 0, pvpBestStreak: best };
    }
    return { pvpWinStreak: streak, pvpBestStreak: best };
}

function skippedRerollQuestion(before, after) {
    if (!before || !after) return false;
    if (before.questionWinner !== 'reroll') return false;
    return Number(after.currentQ) !== Number(before.currentQ);
}

function planRateWindow(existing, nowMs, maxCount, windowMs) {
    const now = Number(nowMs) || 0;
    const max = Math.max(1, Math.floor(Number(maxCount) || 0));
    const window = Math.max(1, Math.floor(Number(windowMs) || 0));
    if (!existing || !existing.windowStartMs || (now - existing.windowStartMs) >= window) {
        return { ok: true, windowStartMs: now, count: 1, reset: true };
    }
    const count = Math.floor(Number(existing.count) || 0);
    if (count >= max) return { ok: false, windowStartMs: existing.windowStartMs, count: count, reset: false };
    return { ok: true, windowStartMs: existing.windowStartMs, count: count + 1, reset: false };
}

// ---- Guest battle names ----
// Guests pick their own battle name. Staff and brand names are refused, after
// folding case, accents, look-alike letters and digit swaps. foldName and the
// staff exact list live in reservedNames.js, shared with usernamePolicy.
const foldName = reservedNames.foldName;
// Refused anywhere in the name. rufus and 603btc stay on this substring list
// (existing guest-name policy); username picks treat those two as whole names.
const RESERVED_ANYWHERE = ['needcreations', 'bitcoinquest', 'bitcoineducation', 'rufus', 'nacho',
    'admin', 'moderator', 'staff', 'support', 'official', 'system', 'satoshisfavor', '603btc'];
// Refused as the whole name (after a real/the/official prefix or suffix).
// The shared staff list (phil, rufus, bq, 603btc) is included here.
const RESERVED_WHOLE = ['mod', 'mods', 'team', 'dev', 'owner', 'founder', 'bot'].concat(reservedNames.STAFF_RESERVED_EXACT);
const RESERVED_ANYWHERE_F = RESERVED_ANYWHERE.map(foldName);
const RESERVED_WHOLE_F = RESERVED_WHOLE.map(foldName);
const AFFIX_F = ['real', 'the', 'its', 'iam', 'official', 'team', 'hq', 'bot', 'here'].map(foldName);
function isReservedBattleName(name) {
    const f = foldName(name);
    if (!f) return false;
    for (let i = 0; i < RESERVED_ANYWHERE_F.length; i++) if (f.indexOf(RESERVED_ANYWHERE_F[i]) >= 0) return true;
    let core = f;
    let changed = true;
    while (changed) {
        changed = false;
        for (let i = 0; i < AFFIX_F.length; i++) {
            const a = AFFIX_F[i];
            if (core.length > a.length && core.indexOf(a) === 0) { core = core.slice(a.length); changed = true; }
            if (core.length > a.length && core.slice(-a.length) === a) { core = core.slice(0, -a.length); changed = true; }
        }
    }
    return RESERVED_WHOLE_F.indexOf(core) >= 0 || RESERVED_WHOLE_F.indexOf(f) >= 0;
}
const GUEST_FALLBACK_NAME = 'Guest Bitcoiner';
// The name a guest (or any lobby/client-supplied name) shows in a match.
function guestBattleName(raw) {
    const s = safeDisplayName(raw);
    if (s === 'a Bitcoiner') return GUEST_FALLBACK_NAME;
    return isReservedBattleName(s) ? GUEST_FALLBACK_NAME : s;
}

// ---- Guest stamp ----
// Whether each player was a guest is decided once, when the match is created,
// and stored on the server-only answer-key doc (and mirrored on the match doc
// for the UI). Settle, badges and the played count read only this stamp, so a
// guest who links a sign-in method after the match cannot turn it into a paid
// signed-in match.
const GUEST_STAMP_VERSION = 1;
function planGuestStamp(p1Guest, p2Guest) {
    const a = p1Guest !== false;
    const b = p2Guest !== false;
    return { version: GUEST_STAMP_VERSION, player1: a, player2: b, guestMatch: a || b };
}
// Reads the stamp. A missing or malformed stamp fails closed: guest match.
function readGuestStamp(keyData) {
    const st = keyData && keyData.guestStamp;
    if (!st || st.version !== GUEST_STAMP_VERSION || typeof st.player1 !== 'boolean' || typeof st.player2 !== 'boolean') {
        return { version: 0, player1: true, player2: true, guestMatch: true, missing: true };
    }
    return { version: st.version, player1: st.player1, player2: st.player2, guestMatch: st.player1 || st.player2, missing: false };
}

// ---- One live match per pair (M5) ----
// A waiting player can delete and re-create their lobby doc while a match is
// still running, so "lobby status is waiting" alone does not prove the pair is
// free. pvpCreateMatch keeps one lock doc per unordered pair, pointing at the
// pair's latest match, and refuses a new match while that match is still live.
// The doc id is a hash of the sorted uids, so the lock holds no raw uid.
const PVP_LIVE_STATUSES = ['countdown', 'active', 'question_result'];
// A match stuck in a live status (housekeeping missed it) stops blocking the
// pair after this long. A full 5-question match takes about 3 minutes.
const PVP_PAIR_LOCK_MS = 30 * 60 * 1000;
function pvpPairLockId(uidA, uidB) {
    const pair = [String(uidA || ''), String(uidB || '')].sort();
    return 'pair_' + require('crypto').createHash('sha256').update(pair[0] + '\n' + pair[1]).digest('hex').slice(0, 40);
}
// match is the pair's latest match doc data (or null). Returns true when a new
// match for the same two players must be refused.
function pairMatchStillLive(match, nowMs, createdAtMs) {
    if (!match || PVP_LIVE_STATUSES.indexOf(match.status) === -1) return false;
    const created = typeof createdAtMs === 'number' && createdAtMs > 0 ? createdAtMs : lastSeenMs(match.createdAt);
    if (!created) return true;
    return (nowMs - created) < PVP_PAIR_LOCK_MS;
}

// ---- Match create caps ----
// Per-uid hourly caps, plus caps that a fresh anonymous uid cannot reset:
// one global anonymous-create bucket per hour and one per network (keyed hash).
// The caller (player2) is always charged. A waiting signed-in player1 is
// charged only for a signed-in match.
const PVP_ANON_GLOBAL_PER_HOUR = 300;
const PVP_ANON_NETWORK_PER_HOUR = 30;
function planMatchCharges(input) {
    const src = input || {};
    const p1Guest = src.p1Guest !== false;
    const p2Guest = src.p2Guest !== false;
    const guestMatch = p1Guest || p2Guest;
    const out = [];
    if (guestMatch) {
        if (p1Guest) out.push({ who: 'player1', bucket: 'match_hour', max: 20 });
        // player2 is always the caller. A logged-in caller who starts a guest
        // match spends their own hourly cap too, so one account cannot use
        // fresh anonymous lobbies to drain the shared guest bucket for free.
        // A logged-in player1 (waiting in the lobby) is not charged, so guests
        // cannot burn a waiting player's cap by joining them.
        out.push({ who: 'player2', bucket: 'match_hour', max: p2Guest ? 20 : 60 });
        out.push({ who: 'global', bucket: 'anon_global', max: PVP_ANON_GLOBAL_PER_HOUR });
        // The network bucket applies to every guest match, whoever the caller is.
        if (src.hasNetwork) out.push({ who: 'network', bucket: 'anon_net', max: PVP_ANON_NETWORK_PER_HOUR });
    } else {
        out.push({ who: 'player1', bucket: 'match_hour', max: 60 });
        out.push({ who: 'player2', bucket: 'match_hour', max: 60 });
    }
    return out;
}

// ---- Answer caps ----
// Every player has a per-uid burst cap (same 30/minute as before). Guests also
// get a per-network (IP hash, when the request has an IP) burst and hourly cap,
// so a new anonymous uid cannot reset the answer limit.
const PVP_ANSWER_PER_MIN = 30;
const PVP_ANON_ANSWER_NETWORK_PER_MIN = 40;
const PVP_ANON_ANSWER_NETWORK_PER_HOUR = 150;
function planAnswerCharges(input) {
    const src = input || {};
    const out = [{ who: 'player', bucket: 'answer', max: PVP_ANSWER_PER_MIN, windowMs: 60000 }];
    if (src.guest && src.hasNetwork) {
        out.push({ who: 'network', bucket: 'anon_ans_min', max: PVP_ANON_ANSWER_NETWORK_PER_MIN, windowMs: 60000 });
        out.push({ who: 'network', bucket: 'anon_ans_hour', max: PVP_ANON_ANSWER_NETWORK_PER_HOUR, windowMs: 60 * 60 * 1000 });
    }
    return out;
}

// Settle plan from the match, its answer-key doc and live ban flags. Guest
// status comes only from the create-time stamp on the key doc; whatever the
// live flags say about anonymous is ignored.
function settleRewardPlan(input) {
    const src = input || {};
    const after = src.after || {};
    const keyData = src.keyData || {};
    const ids = keyData.playerUids || {};
    const f1 = src.flags1 || {};
    const f2 = src.flags2 || {};
    const stamp = readGuestStamp(keyData);
    const p1 = after.player1 || {};
    const p2 = after.player2 || {};
    const plan = planPvpReward({
        matchId: src.matchId,
        status: after.status,
        alreadyGranted: false,
        forfeitedBy: after.forfeitedBy || '',
        forfeitReason: after.forfeitReason || '',
        durationMs: src.durationMs,
        pairMatchesToday: src.pairMatchesToday,
        accountAgeMs: src.accountAgeMs,
        minDurationMs: src.minDurationMs,
        pairXpCap: src.pairXpCap,
        minAccountAgeMs: src.minAccountAgeMs,
        player1: {
            uid: ids.player1, name: keyData.player1Name || '', score: p1.score || 0,
            roundWins: countWins(p1.answers), banned: f1.banned === true, anonymous: stamp.player1,
        },
        player2: {
            uid: ids.player2, name: keyData.player2Name || '', score: p2.score || 0,
            roundWins: countWins(p2.answers), banned: f2.banned === true, anonymous: stamp.player2,
        },
    });
    if (stamp.guestMatch && plan.grant) {
        // Belt and braces: a stamped guest match never grants.
        return { stamp: stamp, plan: Object.assign({}, plan, { grant: false, reason: 'guest_match', guestMatch: true, players: zeroGuestMatchRewards(plan.players) }) };
    }
    return { stamp: stamp, plan: plan };
}

// ---- Post-settle badge families ----
// Server-counted PvP badge families granted after a match settles. A guest
// match (or a missing stamp, which reads as a guest match) grants none.
const PVP_BADGE_FIELDS = ['pvpWins', 'pvpPlayed', 'pvpBestStreak'];
function planPvpBadgeGrants(sideUids, stamp, plan) {
    const uids = (sideUids || []).filter(function (u) { return typeof u === 'string' && u; });
    const guest = !stamp || stamp.guestMatch !== false;
    if (guest) return { rewardUids: [], skipUids: uids, winGrantUids: [], fields: [] };
    const reason = plan && plan.reason;
    // forfeit_void (tied manual_leave) and disconnect return from planPvpReward
    // before the duration and pair-cap checks, so those players are not marked
    // statsCapped. Still skip both sides: an instant tied forfeit or a
    // disconnect must not bump pvpPlayed or grant pvp_played_* badges.
    if (reason === 'forfeit_void' || reason === 'disconnect') {
        return { rewardUids: uids, skipUids: uids.slice(), winGrantUids: [], fields: PVP_BADGE_FIELDS.slice() };
    }
    const capped = {};
    (plan && plan.players || []).forEach(function (p) {
        if (p && p.uid && p.statsCapped === true) capped[p.uid] = true;
    });
    const winGrantUids = uids.filter(function (u) { return !capped[u]; });
    const skipUids = uids.filter(function (u) { return !!capped[u]; });
    return { rewardUids: uids, skipUids: skipUids, winGrantUids: winGrantUids, fields: PVP_BADGE_FIELDS.slice() };
}

// ---- Lobby summary work cap ----
// Lobby create and delete events each cost an Auth lookup and a transaction on
// the one pvp_lobby_live/current doc. Past this many per uid per minute the
// trigger skips the work (heartbeats are not counted).
const PVP_LOBBY_EVENTS_PER_MIN = 6;
const PVP_LOBBY_EVENTS_WINDOW_MS = 60000;
function isLobbyStructuralEvent(before, after) {
    if (!before || !after) return !!(before || after);
    return String(before.status || '') !== String(after.status || '');
}
function planLobbyEventWindow(rateDoc, nowMs) {
    const d = rateDoc || {};
    const existing = d.lobbyWindowStartMs ? { windowStartMs: d.lobbyWindowStartMs, count: d.lobbyCount } : null;
    const planned = planRateWindow(existing, nowMs, PVP_LOBBY_EVENTS_PER_MIN, PVP_LOBBY_EVENTS_WINDOW_MS);
    return { ok: planned.ok, write: { lobbyWindowStartMs: planned.windowStartMs, lobbyCount: planned.count } };
}

module.exports = {
    LOBBY_SHOUT_MS: LOBBY_SHOUT_MS,
    ALERT_COOLDOWN_MS: ALERT_COOLDOWN_MS,
    PUSH_COOLDOWN_MS: PUSH_COOLDOWN_MS,
    PUSH_GAP_MS: PUSH_GAP_MS,
    PUSH_WEEK_MS: PUSH_WEEK_MS,
    PUSH_MAX_PER_WEEK: PUSH_MAX_PER_WEEK,
    LOBBY_GLOBAL_SHOUT_CAP: LOBBY_GLOBAL_SHOUT_CAP,
    LOBBY_GLOBAL_PUSH_CAP: LOBBY_GLOBAL_PUSH_CAP,
    LOBBY_STALE_MS: LOBBY_STALE_MS,
    WIN_POINTS: WIN_POINTS,
    DRAW_POINTS: DRAW_POINTS,
    CONSOLATION_POINTS: CONSOLATION_POINTS,
    PAIR_XP_CAP: PAIR_XP_CAP,
    MIN_MATCH_MS: MIN_MATCH_MS,
    MIN_ACCOUNT_AGE_MS: MIN_ACCOUNT_AGE_MS,
    safeDisplayName: safeDisplayName,
    lobbyShoutText: lobbyShoutText,
    resultShoutText: resultShoutText,
    lobbyShoutDocId: lobbyShoutDocId,
    resultShoutDocId: resultShoutDocId,
    rewardClaimId: rewardClaimId,
    shouldPostLobbyShout: shouldPostLobbyShout,
    lastSeenMs: lastSeenMs,
    matchFinishMs: matchFinishMs,
    matchDurationMs: matchDurationMs,
    mergeLobbyEntry: mergeLobbyEntry,
    decideLobbyAlert: decideLobbyAlert,
    decidePvpPush: decidePvpPush,
    isClientPvpReward: isClientPvpReward,
    gradeRound: gradeRound,
    countWins: countWins,
    streakPts: streakPts,
    matchShouldFinish: matchShouldFinish,
    shuffleQuestion: shuffleQuestion,
    planPvpReward: planPvpReward,
    shouldSkipLobbySummary: shouldSkipLobbySummary,
    lobbyGlobalRoom: lobbyGlobalRoom,
    trustedLobbyKeep: trustedLobbyKeep,
    planWinTicket: planWinTicket,
    planXpWrite: planXpWrite,
    farmDayKey: farmDayKey,
    pairDailyExpireAtMs: pairDailyExpireAtMs,
    pairDailyId: pairDailyId,
    playerKeyForUid: playerKeyForUid,
    pushShardOrder: pushShardOrder,
    pvpPicAllowed: pvpPicAllowed,
    planStreakUpdate: planStreakUpdate,
    skippedRerollQuestion: skippedRerollQuestion,
    planRateWindow: planRateWindow,
    guestMatchBlocksRewards: guestMatchBlocksRewards,
    zeroGuestMatchRewards: zeroGuestMatchRewards,
    foldName: foldName,
    isReservedBattleName: isReservedBattleName,
    guestBattleName: guestBattleName,
    GUEST_FALLBACK_NAME: GUEST_FALLBACK_NAME,
    planGuestStamp: planGuestStamp,
    readGuestStamp: readGuestStamp,
    GUEST_STAMP_VERSION: GUEST_STAMP_VERSION,
    planMatchCharges: planMatchCharges,
    PVP_BADGE_FIELDS: PVP_BADGE_FIELDS,
    planPvpBadgeGrants: planPvpBadgeGrants,
    PVP_LOBBY_EVENTS_PER_MIN: PVP_LOBBY_EVENTS_PER_MIN,
    PVP_LOBBY_EVENTS_WINDOW_MS: PVP_LOBBY_EVENTS_WINDOW_MS,
    isLobbyStructuralEvent: isLobbyStructuralEvent,
    planLobbyEventWindow: planLobbyEventWindow,
    settleRewardPlan: settleRewardPlan,
    PVP_ANON_GLOBAL_PER_HOUR: PVP_ANON_GLOBAL_PER_HOUR,
    PVP_ANON_NETWORK_PER_HOUR: PVP_ANON_NETWORK_PER_HOUR,
    planAnswerCharges: planAnswerCharges,
    PVP_ANSWER_PER_MIN: PVP_ANSWER_PER_MIN,
    PVP_ANON_ANSWER_NETWORK_PER_MIN: PVP_ANON_ANSWER_NETWORK_PER_MIN,
    PVP_ANON_ANSWER_NETWORK_PER_HOUR: PVP_ANON_ANSWER_NETWORK_PER_HOUR,
    PVP_LIVE_STATUSES: PVP_LIVE_STATUSES,
    PVP_PAIR_LOCK_MS: PVP_PAIR_LOCK_MS,
    pvpPairLockId: pvpPairLockId,
    pairMatchStillLive: pairMatchStillLive,
    PVP_CREATE_BURST: 10,
    PVP_CREATE_BURST_MS: 60000,
    PVP_ANON_MATCH_PER_HOUR: 20,
    PVP_SIGNED_MATCH_PER_HOUR: 60,
    PVP_MATCH_HOUR_MS: 60 * 60 * 1000,
};
