'use strict';

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
        .replace(/[\r\n<>\[\]()@#*`_~|\\]/g, ' ')
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
                players: [
                    { uid: p1.uid, points: 0, pvpWins: 0, pvpLosses: 0, outcome: 'void', blocked: false },
                    { uid: p2.uid, points: 0, pvpWins: 0, pvpLosses: 0, outcome: 'void', blocked: false },
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
    if (typeof src.durationMs === 'number' && src.durationMs < (src.minDurationMs || MIN_MATCH_MS)) {
        players.forEach(function (p) { p.points = 0; });
        xpReason = 'too_short';
    } else if (typeof src.pairMatchesToday === 'number' && src.pairMatchesToday >= (src.pairXpCap || PAIR_XP_CAP)) {
        players.forEach(function (p) { p.points = 0; });
        xpReason = 'pair_cap';
    } else {
        const minAge = src.minAccountAgeMs || MIN_ACCOUNT_AGE_MS;
        const ages = src.accountAgeMs || {};
        ['player1', 'player2'].forEach(function (key, i) {
            if (typeof ages[key] === 'number' && ages[key] < minAge) {
                players[i].points = 0;
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
    return {
        grant: true,
        reason: xpReason,
        claimId: claimId,
        players: players,
        shout: shout,
        voided: false,
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
    pairDailyId: pairDailyId,
    playerKeyForUid: playerKeyForUid,
    pushShardOrder: pushShardOrder,
    pvpPicAllowed: pvpPicAllowed,
};
