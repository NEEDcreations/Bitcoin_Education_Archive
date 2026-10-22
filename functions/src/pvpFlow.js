'use strict';

// Pure PvP decisions: lobby shouts, alert cooldown, push cap, grading, rewards.
// No Firebase. index.js and pvpResolve.js apply these inside transactions.

const LOBBY_SHOUT_MS = 15 * 60 * 1000;
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;
const PUSH_COOLDOWN_MS = 60 * 60 * 1000;
const LOBBY_STALE_MS = 45 * 1000;
const WIN_POINTS = 50;
const DRAW_POINTS = 5;
const CONSOLATION_POINTS = 25;

function safeDisplayName(name) {
    const cleaned = String(name || '')
        .replace(/[\r\n<>]/g, ' ')
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
    if (src.banned === true) return { post: false, reason: 'banned' };
    const now = Number(src.nowMs) || 0;
    const last = src.lastPostMs;
    if (typeof last === 'number' && isFinite(last) && (now - last) < LOBBY_SHOUT_MS) {
        return { post: false, reason: 'rate_limited' };
    }
    const docId = lobbyShoutDocId(uid, now);
    if (!docId) return { post: false, reason: 'no_uid' };
    return {
        post: true,
        reason: 'ok',
        docId: docId,
        text: lobbyShoutText(src.name),
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
    if (typeof src.lastPushMs === 'number' && isFinite(src.lastPushMs) && (now - src.lastPushMs) < PUSH_COOLDOWN_MS) {
        return { send: false, reason: 'rate_limited' };
    }
    return { send: true, reason: 'ok' };
}

function isClientPvpReward(actionKey, action) {
    const key = String(actionKey || '');
    if (key === 'pvp_victory' || key === 'pvp_practice' || key === 'pvp_draw'
        || key === 'pvp_consolation' || key === 'pvp_win_ticket') return true;
    const text = String(action || '').toLowerCase();
    if (!text) return false;
    return text.indexOf('pvp victory') !== -1
        || text.indexOf('pvp win') !== -1
        || text.indexOf('pvp practice') !== -1
        || text.indexOf('pvp draw') !== -1
        || text.indexOf('pvp consolation') !== -1
        || text.indexOf('pvp loss') !== -1;
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
        points = (Number(p.score) || 0) > 0 ? CONSOLATION_POINTS : 0;
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
        reason: draw ? 'draw' : 'win',
        claimId: claimId,
        players: players,
        shout: shout,
        voided: false,
    };
}

module.exports = {
    LOBBY_SHOUT_MS: LOBBY_SHOUT_MS,
    ALERT_COOLDOWN_MS: ALERT_COOLDOWN_MS,
    PUSH_COOLDOWN_MS: PUSH_COOLDOWN_MS,
    LOBBY_STALE_MS: LOBBY_STALE_MS,
    WIN_POINTS: WIN_POINTS,
    DRAW_POINTS: DRAW_POINTS,
    CONSOLATION_POINTS: CONSOLATION_POINTS,
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
};
