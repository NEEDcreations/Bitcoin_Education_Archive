'use strict';

// raid_history/{bossId} snapshots. Clients can read them and cannot write them.
// A survived card can be upgraded to defeated inside a transaction if the boss
// falls after the card was saved. The giveaway name is filled later from the
// monthly Orange Ticket draw. Recaps are template text. No model calls.

const SURVIVE_GRACE_MS = 10 * 60 * 1000;

const TZ = 'America/New_York';
const CDN = 'https://assets.bitcoineducation.quest/images/raid-bosses/';

const IMAGE_BY_NAME = {
    'Channel-Crawler': CDN + 'channel-crawler.png',
    'Quiz-Crusader': CDN + 'quiz-crusader.png',
    'TV-Titan': CDN + 'tv-titan.png',
    'Beats-Baron': CDN + 'beats-baron.png',
    'Flash-Flash': CDN + 'flash-flash.png',
    'XP-Hoarder': CDN + 'xp-hoarder.png',
    'Poll-Patroller': CDN + 'poll-patroller.png',
    'Chat-Charger': CDN + 'chat-charger.png',
    'Badge-Builder': CDN + 'badge-builder.png',
    'Streak-Sage': CDN + 'streak-sage.png',
    'Topic-Explorer': CDN + 'topic-explorer.png',
    'Lightning-Lancer': CDN + 'lightning-lancer.png',
    'Forum-Forge': CDN + 'forum-forge.png',
    'Trivia-Tactician': CDN + 'trivia-tactician.png',
    'Content-Conqueror': CDN + 'content-conqueror.png',
    'Favor-Fiend': CDN + 'favor-fiend.png',
    'Hello-Herald': CDN + 'hello-herald.png',
    'Trifecta-Titan': CDN + 'trifecta-titan.png',
    'Scholar-Slayer': CDN + 'scholar-slayer.png',
    'Watch-Warden': CDN + 'watch-warden.png',
    'Referral-Ranger': CDN + 'referral-ranger.png',
};

const GOAL_LINE = {
    pollVotes: function (n) { return 'Cast ' + n + ' poll votes in the Quest Hub'; },
    chatMessages: function (n) { return 'Send ' + n + ' real Global Chat messages'; },
    cipherPeerKey: function (n) { return 'Land ' + n + ' peer accepts or cipher opens'; },
    favorHashes: function (n) { return 'Hash ' + n + ' times for Satoshi\'s Favor'; },
    forumPosts: function (n) { return 'Publish ' + n + ' forum posts or articles'; },
    articlesPublished: function (n) { return 'Publish ' + n + ' articles'; },
    sayHi: function (n) { return 'Say hi ' + n + ' times in Global Chat'; },
    trifecta: function (n) { return 'Finish ' + n + ' daily trifectas in the Quest Hub'; },
    triviaCorrect: function (n) { return 'Answer ' + n + ' trivia questions in the Quest Hub'; },
    certPasses: function (n) { return 'Pass ' + n + ' Scholar or Protocol Expert exams'; },
    quizCompletions: function (n) { return 'Pass ' + n + ' quests in the Quest Hub'; },
    tctvWatchDays: function (n) { return 'Finish ' + n + ' Timechain TV watch days'; },
    referralsPaid: function (n) { return 'Bring ' + n + ' friends to Maxi'; },
    watchMinutes: function (n) { return 'Watch ' + n + ' minutes of Timechain TV'; },
    beatsMinutes: function (n) { return 'Listen to ' + n + ' minutes of Bitcoin Beats'; },
    flashcardCompletions: function (n) { return 'Finish ' + n + ' flashcard sets'; },
    totalXP: function (n) { return 'Earn ' + n + ' XP together'; },
    badgesEarned: function (n) { return 'Earn ' + n + ' badges'; },
    streakUsers: function (n) { return 'Hit ' + n + ' seven-day streaks'; },
    uniqueTopicsVisited: function (n) { return 'Visit ' + n + ' new topics'; },
    tipsSent: function (n) { return 'Send ' + n + ' Lightning tips'; },
    totalTopicReads: function (n) { return 'Read ' + n + ' topics'; },
    uniqueUsers5Topics: function (n) { return 'Log ' + n + ' days visiting 5 topics'; },
};

const ACTION_LINE = {
    pollVotes: function (n) { return 'cast ' + n + ' votes'; },
    chatMessages: function (n) { return 'sent ' + n + ' messages'; },
    cipherPeerKey: function (n) { return 'landed ' + n + ' peer hits'; },
    favorHashes: function (n) { return 'hashed ' + n + ' times'; },
    forumPosts: function (n) { return 'published ' + n + ' posts'; },
    articlesPublished: function (n) { return 'published ' + n + ' articles'; },
    sayHi: function (n) { return 'said hi ' + n + ' times'; },
    trifecta: function (n) { return 'finished ' + n + ' trifectas'; },
    triviaCorrect: function (n) { return 'answered ' + n + ' trivia questions'; },
    certPasses: function (n) { return 'passed ' + n + ' exams'; },
    quizCompletions: function (n) { return 'passed ' + n + ' quests'; },
    tctvWatchDays: function (n) { return 'finished ' + n + ' watch days'; },
    referralsPaid: function (n) { return 'brought ' + n + ' friends to Maxi'; },
    watchMinutes: function (n) { return 'watched ' + n + ' minutes'; },
    beatsMinutes: function (n) { return 'listened for ' + n + ' minutes'; },
    flashcardCompletions: function (n) { return 'finished ' + n + ' flashcard sets'; },
    totalXP: function (n) { return 'earned ' + n + ' XP'; },
    badgesEarned: function (n) { return 'earned ' + n + ' badges'; },
    streakUsers: function (n) { return 'hit ' + n + ' streaks'; },
    uniqueTopicsVisited: function (n) { return 'visited ' + n + ' new topics'; },
    tipsSent: function (n) { return 'sent ' + n + ' tips'; },
    totalTopicReads: function (n) { return 'read ' + n + ' topics'; },
    uniqueUsers5Topics: function (n) { return 'logged ' + n + ' five-topic days'; },
};

function timeMs(value) {
    if (!value) return 0;
    if (typeof value.toDate === 'function') {
        const d = value.toDate();
        return d && d.getTime ? d.getTime() : 0;
    }
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const n = Date.parse(value);
        return Number.isFinite(n) ? n : 0;
    }
    return 0;
}

function nowMsOf(now) {
    if (now instanceof Date) return now.getTime();
    const n = timeMs(now);
    return n || Date.now();
}

function formatCount(n) {
    const v = Math.round(Number(n) || 0);
    const sign = v < 0 ? '-' : '';
    const digits = String(Math.abs(v));
    return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function publicName(raw) {
    const name = String(raw || '').trim();
    if (!/^[A-Za-z0-9_.-]{1,40}$/.test(name)) return '';
    return name;
}

function safeBossId(raw) {
    const id = String(raw || '');
    if (!/^[A-Za-z0-9_-]{1,140}$/.test(id)) return '';
    return id;
}

function safeEmoji(raw) {
    const emoji = String(raw || '').trim();
    if (!emoji || emoji.length > 8 || /[<>&]/.test(emoji)) return '👾';
    return emoji;
}

function historyImage(data) {
    const raw = data && typeof data.image === 'string' ? data.image.trim() : '';
    if (/^https:\/\/[^\s"'<>]+$/i.test(raw) && raw.length <= 400) return raw;
    const named = data && IMAGE_BY_NAME[data.name];
    return named || '';
}

function goalCount(data) {
    const community = Number(data && data.communityTarget);
    if (community > 0) return Math.round(community);
    const goal = Number(data && data.goal);
    const target = Number(data && data.target);
    if (goal > 0 && goal !== target) return Math.round(goal);
    return 0;
}

function goalText(data) {
    const count = goalCount(data);
    const metric = data && data.metric;
    if (count > 0 && GOAL_LINE[metric]) return GOAL_LINE[metric](formatCount(count));
    if (count > 0) return 'Land ' + formatCount(count) + ' hits together';
    const desc = String((data && data.description) || '').replace(/\s+/g, ' ').trim();
    if (desc && desc.length <= 140 && desc.indexOf('@') === -1 && !/[<>]/.test(desc)) return desc;
    return 'Reach the community goal together';
}

function damagePct(current, target, defeated) {
    const t = Number(target) || 0;
    if (!(t > 0)) return 0;
    let pct = Math.round((Number(current) || 0) / t * 100);
    if (!Number.isFinite(pct) || pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    if (!defeated && pct >= 100) pct = 99;
    if (defeated && (Number(current) || 0) >= t) pct = 100;
    return pct;
}

function monthLabel(ms) {
    if (!ms) return '';
    const label = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ,
        month: 'long',
        year: 'numeric',
    }).format(new Date(ms));
    return label.replace(/\s+/g, ' ').trim();
}

function monthKeyFromMs(ms) {
    if (!ms) return '';
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
    }).formatToParts(new Date(ms));
    let year = '';
    let month = '';
    parts.forEach(function (part) {
        if (part.type === 'year') year = part.value;
        if (part.type === 'month') month = part.value;
    });
    if (!year || !month) return '';
    return year + '-' + month;
}

function fightOver(data, nowMs) {
    if (!data || data.placeholder === true) return false;
    if (data.defeated === true) return true;
    const end = timeMs(data.endTime);
    return end > 0 && nowMs >= end + SURVIVE_GRACE_MS;
}

function asRows(list) {
    if (!list) return [];
    if (Array.isArray(list)) return list.slice();
    const rows = [];
    const docs = list.docs || [];
    if (docs.length) {
        docs.forEach(function (doc) {
            rows.push(Object.assign({ id: doc.id }, typeof doc.data === 'function' ? (doc.data() || {}) : {}));
        });
        return rows;
    }
    if (typeof list.forEach === 'function') {
        list.forEach(function (doc) {
            rows.push(Object.assign({ id: doc.id }, typeof doc.data === 'function' ? (doc.data() || {}) : {}));
        });
    }
    return rows;
}

function raidersFrom(list) {
    const rows = [];
    asRows(list).forEach(function (row) {
        const damage = Math.round((Number(row.contributed != null ? row.contributed : row.damage) || 0) * 1000) / 1000;
        if (!(damage > 0)) return;
        const named = publicName(row.username) || 'Raider';
        rows.push({
            username: named,
            damage: damage,
            lastMs: timeMs(row.lastUpdate),
        });
    });
    rows.sort(function (a, b) {
        if (b.damage !== a.damage) return b.damage - a.damage;
        if (a.username < b.username) return -1;
        if (a.username > b.username) return 1;
        return 0;
    });
    return rows;
}

// The Orange Ticket winner is the monthly raffle draw in monthlyRaffleDraw:
// one person, weighted by raffle entries, stored as stats/raffle_{month}_snapshot.winner.
// That is not the two-person unweighted shuffle in raid_bosses/{id}/winners.
function prizeWinnerFromSnapshot(data) {
    const row = data || {};
    return publicName(row.winner);
}

function hitsLanded(data, pct) {
    const scale = Number(data && data.damageScale);
    const current = Number(data && data.current) || 0;
    if (scale > 0) {
        const hits = Math.round(current / scale);
        if (hits > 0) return hits;
    }
    const goal = goalCount(data);
    if (data && data.defeated && goal > 0) return goal;
    if (goal > 0 && pct > 0) return Math.max(1, Math.round(goal * pct / 100));
    return Math.max(0, Math.round(current));
}

function spanDays(startMs, endMs) {
    const ms = Math.max(0, (endMs || 0) - (startMs || 0));
    return Math.max(1, Math.round(ms / 86400000));
}

function latestLastUpdateMs(participants) {
    let best = 0;
    asRows(participants).forEach(function (row) {
        const ms = timeMs(row.lastUpdate);
        if (ms > best) best = ms;
    });
    return best;
}

// A defeat with no defeatedAt uses the latest hit. If nobody has a hit time,
// cap at the scheduled end. Never stamp the card with a bare "now".
function resolveEndedAtMs(data, participants, nowMs) {
    const src = data || {};
    const startMs = timeMs(src.startTime);
    const scheduledEnd = timeMs(src.endTime);
    const now = Number(nowMs) || 0;
    if (src.defeated === true) {
        const defeatedAt = timeMs(src.defeatedAt);
        if (defeatedAt) return defeatedAt;
        const last = latestLastUpdateMs(participants);
        if (last) return last;
        if (scheduledEnd && now) return Math.min(scheduledEnd, now);
        if (scheduledEnd) return scheduledEnd;
        return startMs || 0;
    }
    if (scheduledEnd) return scheduledEnd;
    return startMs || 0;
}

function isUnspawnedBoss(data) {
    if (!data) return false;
    if (data.placeholder === true) return true;
    return String(data.name || '').trim().toLowerCase() === 'no boss spawned';
}

function finisherName(raiders, defeated) {
    if (!defeated || !raiders.length) return '';
    let timed = null;
    raiders.forEach(function (row) {
        if (!(row.lastMs > 0)) return;
        if (!timed || row.lastMs > timed.lastMs || (row.lastMs === timed.lastMs && row.damage > timed.damage)) timed = row;
    });
    return (timed || raiders[0]).username;
}

function templateIndex(bossId) {
    let h = 2166136261;
    const id = String(bossId || '');
    for (let i = 0; i < id.length; i++) {
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % RECAPS.length;
}

function recapStats(name, raiders, metric, hits, startMs, endMs, pct, defeated) {
    const players = raiders.length;
    const days = spanDays(startMs, endMs);
    return {
        name: name,
        players: String(players),
        playerWord: players === 1 ? 'raider' : 'raiders',
        action: (ACTION_LINE[metric] || function (n) { return 'landed ' + n + ' hits'; })(formatCount(hits)),
        days: days + (days === 1 ? ' day' : ' days'),
        finisher: finisherName(raiders, defeated) || 'someone',
        pct: String(pct),
    };
}

const RECAPS = [
    function (s, won) {
        if (won) {
            return 'The ' + s.name + ' never saw it coming: ' + s.players + ' ' + s.playerWord + ' ' + s.action + ' in ' + s.days + ', and ' + s.finisher + ' landed the final blow. The community prize is won.';
        }
        return s.name + ' limped to the bell and stayed on its feet. ' + s.players + ' ' + s.playerWord + ' ' + s.action + ' in ' + s.days + ' and only dealt ' + s.pct + '% damage. The community prize stays locked.';
    },
    function (s, won) {
        if (won) {
            return s.name + ' put up a fight and then folded. ' + s.players + ' ' + s.playerWord + ' ' + s.action + ' across ' + s.days + '. ' + s.finisher + ' struck the last hit, and the community prize is won.';
        }
        return s.name + ' survived the month with a smirk. ' + s.players + ' ' + s.playerWord + ' ' + s.action + ' in ' + s.days + '. They dealt ' + s.pct + '% damage, so the prize stays put.';
    },
    function (s, won) {
        if (won) {
            return 'What a raid. ' + s.players + ' ' + s.playerWord + ' ' + s.action + ' in ' + s.days + ' and dropped ' + s.name + '. ' + s.finisher + ' landed the final blow, and the community prize is won.';
        }
        return s.name + ' walked off still standing. The raid lasted ' + s.days + ', and ' + s.players + ' ' + s.playerWord + ' ' + s.action + '. Damage stopped at ' + s.pct + '%, so no community prize.';
    },
    function (s, won) {
        if (won) {
            return s.name + ' is down for the count. In ' + s.days + ', ' + s.players + ' ' + s.playerWord + ' ' + s.action + '. ' + s.finisher + ' got the last hit and the community prize is won.';
        }
        return 'Close, but ' + s.name + ' is still grinning. ' + s.players + ' ' + s.playerWord + ' ' + s.action + ' over ' + s.days + '. The bar ended at ' + s.pct + '% and the prize was not won.';
    },
    function (s, won) {
        if (won) {
            return 'The room showed up: ' + s.players + ' ' + s.playerWord + ' ' + s.action + ' in ' + s.days + ', and ' + s.name + ' fell when ' + s.finisher + ' landed the final blow. The community prize is won.';
        }
        return s.name + ' ducked the knockout. ' + s.players + ' ' + s.playerWord + ' spent ' + s.days + ' and ' + s.action + '. They reached ' + s.pct + '% damage, and the prize was not won.';
    },
    function (s, won) {
        if (won) {
            return s.name + ' ran out of hit points. ' + s.players + ' ' + s.playerWord + ' ' + s.action + ' in ' + s.days + '. ' + s.finisher + ' landed the final blow, so the community prize is won.';
        }
        return 'The clock beat the raid. ' + s.name + ' is still up after ' + s.days + '. ' + s.players + ' ' + s.playerWord + ' ' + s.action + ' and dealt ' + s.pct + '% damage, so the prize stays locked.';
    },
    function (s, won) {
        if (won) {
            return 'Down goes ' + s.name + '. ' + s.players + ' ' + s.playerWord + ' ' + s.action + ' across ' + s.days + ', and ' + s.finisher + ' landed the final blow. The community prize is won.';
        }
        return s.name + ' took the hits and stayed upright. Across ' + s.days + ', ' + s.players + ' ' + s.playerWord + ' ' + s.action + '. Final damage was ' + s.pct + '%, and the prize was not won.';
    },
    function (s, won) {
        if (won) {
            return s.name + ' has fallen. ' + s.players + ' ' + s.playerWord + ' ' + s.action + ' in ' + s.days + '. ' + s.finisher + ' landed the final blow and the community prize is won.';
        }
        return s.name + ' outlasted the raid. ' + s.players + ' ' + s.playerWord + ' ' + s.action + ' in ' + s.days + ' and dealt ' + s.pct + '% damage. The community prize was not won.';
    },
];

function buildRecap(bossId, stats, defeated) {
    const pick = RECAPS[templateIndex(bossId)] || RECAPS[0];
    return pick(stats, defeated === true);
}

function buildHistoryDoc(bossId, data, participants, winners, nowMs, prizeWinnerName) {
    const src = data || {};
    const defeated = src.defeated === true;
    const startMs = timeMs(src.startTime);
    const scheduledEnd = timeMs(src.endTime);
    const current = Math.round((Number(src.current) || 0) * 1000) / 1000;
    const target = Number(src.target) || Number(src.targetHP) || 0;
    const pct = damagePct(current, target, defeated);
    const hpPct = target > 0 ? Math.max(0, 100 - pct) : 0;
    const endedAt = resolveEndedAtMs(src, participants, nowMs);
    const raiders = raidersFrom(participants);
    const name = publicName(src.name) || 'Raid Boss';
    const metric = String(src.metric || '');
    const hits = hitsLanded(src, pct);
    const stats = recapStats(name, raiders, metric, hits, startMs, endedAt, pct, defeated);
    const top = raiders.slice(0, 3).map(function (row) {
        return { username: row.username, damage: row.damage };
    });
    const monthMs = startMs || endedAt;
    return {
        bossId: safeBossId(bossId),
        name: name,
        image: historyImage(src),
        emoji: safeEmoji(src.emoji),
        monthLabel: monthLabel(monthMs),
        monthKey: (typeof src.monthKey === 'string' && /^\d{4}-\d{2}$/.test(src.monthKey)) ? src.monthKey : monthKeyFromMs(monthMs),
        goalText: goalText(src),
        goal: goalCount(src),
        metric: metric.slice(0, 40),
        result: defeated ? 'defeated' : 'survived',
        damagePct: pct,
        current: current,
        target: target,
        hpPct: hpPct,
        startMs: startMs,
        endMs: scheduledEnd,
        endedAtMs: endedAt,
        playerCount: raiders.length,
        topDealers: top,
        prizeWon: defeated,
        prizeWinner: defeated ? publicName(prizeWinnerName) : '',
        recap: buildRecap(bossId, stats, defeated),
    };
}

function stripSecrets(payload) {
    const out = {};
    Object.keys(payload || {}).forEach(function (key) {
        if (/uid|email/i.test(key)) return;
        const val = payload[key];
        if (Array.isArray(val)) {
            out[key] = val.map(function (row) {
                if (!row || typeof row !== 'object') return row;
                const copy = {};
                Object.keys(row).forEach(function (inner) {
                    if (/uid|email/i.test(inner)) return;
                    copy[inner] = row[inner];
                });
                return copy;
            });
            return;
        }
        out[key] = val;
    });
    return out;
}

async function commitIfAbsent(db, ref, payload) {
    let wrote = false;
    await db.runTransaction(async function (tx) {
        const snap = await tx.get(ref);
        if (snap.exists) return;
        tx.set(ref, payload);
        wrote = true;
    });
    return wrote;
}

function monthKeyForBoss(data) {
    const key = data && data.monthKey;
    if (typeof key === 'string' && /^\d{4}-\d{2}$/.test(key)) return key;
    return monthKeyFromMs(timeMs(data && data.startTime));
}

async function readPrizeWinner(db, bossId) {
    const id = safeBossId(bossId);
    if (!db || !id) return '';
    let monthKey = '';
    try {
        const boss = await db.collection('raid_bosses').doc(id).get();
        if (boss.exists) monthKey = monthKeyForBoss(boss.data() || {});
    } catch (e) { monthKey = ''; }
    if (!monthKey) {
        try {
            const hist = await db.collection('raid_history').doc(id).get();
            if (hist.exists) monthKey = monthKeyForBoss(hist.data() || {});
        } catch (e) { monthKey = ''; }
    }
    if (!/^\d{4}-\d{2}$/.test(monthKey)) return '';
    let snap;
    try { snap = await db.collection('stats').doc('raffle_' + monthKey + '_snapshot').get(); }
    catch (e) { return ''; }
    if (!snap || !snap.exists) return '';
    return prizeWinnerFromSnapshot(typeof snap.data === 'function' ? snap.data() : {});
}

async function upgradeSurvivedHistory(db, bossRef, id, participants, nowMs, prizeName) {
    const histRef = db.collection('raid_history').doc(id);
    let upgraded = false;
    await db.runTransaction(async function (tx) {
        const hist = await tx.get(histRef);
        const boss = await tx.get(bossRef);
        if (!hist.exists || !boss.exists) return;
        const prev = hist.data() || {};
        const fresh = boss.data() || {};
        if (prev.result !== 'survived' || fresh.defeated !== true) return;
        const next = stripSecrets(buildHistoryDoc(id, fresh, participants, [], nowMs, prizeName));
        tx.update(histRef, {
            result: 'defeated',
            prizeWon: true,
            prizeWinner: next.prizeWinner || publicName(prev.prizeWinner) || '',
            current: next.current,
            target: next.target,
            damagePct: next.damagePct,
            hpPct: next.hpPct,
            endedAtMs: next.endedAtMs,
            playerCount: next.playerCount,
            topDealers: next.topDealers,
            recap: next.recap,
        });
        upgraded = true;
    });
    return { wrote: false, upgraded: upgraded, id: id };
}

async function recordBossHistory(db, admin, bossRef, bossId, opts) {
    const id = safeBossId(bossId || (bossRef && bossRef.id));
    if (!db || !id || !bossRef) return { wrote: false, reason: 'missing' };
    const bossSnap = await bossRef.get();
    if (!bossSnap.exists) return { wrote: false, reason: 'missing' };
    const data = bossSnap.data() || {};
    const nowMs = nowMsOf(opts && opts.now);
    if (isUnspawnedBoss(data)) return { wrote: false, reason: 'placeholder' };
    if (data.defeated !== true) {
        const end = timeMs(data.endTime);
        if (!(end > 0 && nowMs >= end + SURVIVE_GRACE_MS)) {
            if (end > 0 && nowMs >= end) return { wrote: false, reason: 'grace' };
            return { wrote: false, reason: 'active' };
        }
    }
    const histRef = db.collection('raid_history').doc(id);
    const existing = await histRef.get();
    const participants = await bossRef.collection('participants').get();
    const prizeName = data.defeated === true ? await readPrizeWinner(db, id) : '';
    if (existing.exists) {
        const prev = existing.data() || {};
        if (prev.result === 'survived' && data.defeated === true) {
            return upgradeSurvivedHistory(db, bossRef, id, participants, nowMs, prizeName);
        }
        return { wrote: false, reason: 'exists' };
    }
    const payload = stripSecrets(buildHistoryDoc(id, data, participants, [], nowMs, prizeName));
    if (admin && admin.firestore && admin.firestore.FieldValue) {
        payload.writtenAt = admin.firestore.FieldValue.serverTimestamp();
    }
    const wrote = await commitIfAbsent(db, histRef, payload);
    return { wrote: wrote, id: id };
}

async function syncPrizeWinner(db, admin, bossId) {
    const id = safeBossId(bossId);
    if (!db || !id) return { updated: false, reason: 'missing' };
    const name = await readPrizeWinner(db, id);
    if (!name) return { updated: false, reason: 'none' };
    const ref = db.collection('raid_history').doc(id);
    let updated = false;
    await db.runTransaction(async function (tx) {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const data = snap.data() || {};
        if (data.result !== 'defeated' && data.prizeWon !== true) return;
        if (data.prizeWinner) return;
        tx.update(ref, { prizeWinner: name });
        updated = true;
    });
    return { updated: updated, id: id };
}

async function closeEndedBosses(db, admin, now) {
    if (!db) return { wrote: 0 };
    const nowMs = nowMsOf(now);
    const snap = await db.collection('raid_bosses').get();
    const docs = [];
    if (snap && typeof snap.forEach === 'function') snap.forEach(function (doc) { docs.push(doc); });
    let wrote = 0;
    for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        const data = typeof doc.data === 'function' ? (doc.data() || {}) : {};
        if (isUnspawnedBoss(data) || !fightOver(data, nowMs)) continue;
        const ref = db.collection('raid_bosses').doc(doc.id);
        try {
            const result = await recordBossHistory(db, admin, ref, doc.id, { now: new Date(nowMs) });
            if (result && result.wrote) wrote += 1;
        } catch (e) { /* next sweep retries */ }
        try { await syncPrizeWinner(db, admin, doc.id); }
        catch (e) { /* next sweep retries */ }
    }
    return { wrote: wrote };
}

function repairHistoryFields(bossId, bossData, participants, existing, nowMs, prizeWinnerName) {
    if (isUnspawnedBoss(bossData) || isUnspawnedBoss(existing)) return null;
    if (!bossData) return null;
    const next = buildHistoryDoc(bossId, bossData, participants, [], nowMs, prizeWinnerName);
    const patch = {};
    if (Number(existing && existing.endedAtMs) !== Number(next.endedAtMs)) patch.endedAtMs = next.endedAtMs;
    if (String((existing && existing.recap) || '') !== next.recap) patch.recap = next.recap;
    return Object.keys(patch).length ? patch : null;
}

async function repairRaidHistory(db, admin, now, opts) {
    const apply = !!(opts && opts.apply);
    const nowMs = nowMsOf(now);
    const snap = await db.collection('raid_history').get();
    const docs = [];
    if (snap && typeof snap.forEach === 'function') snap.forEach(function (doc) { docs.push(doc); });
    let wouldRepair = 0;
    let repaired = 0;
    const changes = [];
    for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        const saved = typeof doc.data === 'function' ? (doc.data() || {}) : {};
        if (isUnspawnedBoss(saved)) continue;
        let boss = null;
        try {
            const bossSnap = await db.collection('raid_bosses').doc(doc.id).get();
            if (bossSnap.exists) boss = bossSnap.data() || {};
        } catch (e) { boss = null; }
        if (!boss || isUnspawnedBoss(boss)) continue;
        let participants = [];
        try { participants = await db.collection('raid_bosses').doc(doc.id).collection('participants').get(); }
        catch (e) { participants = []; }
        const patch = repairHistoryFields(doc.id, boss, participants, saved, nowMs, saved.prizeWinner || '');
        if (!patch) continue;
        wouldRepair += 1;
        changes.push({ id: doc.id, endedAtMs: patch.endedAtMs, recap: patch.recap });
        if (!apply) continue;
        await db.collection('raid_history').doc(doc.id).update(patch);
        repaired += 1;
    }
    return { wouldRepair: wouldRepair, repaired: repaired, changes: changes };
}

async function backfillRaidHistory(db, admin, now, opts) {
    const apply = !!(opts && opts.apply);
    const nowMs = nowMsOf(now);
    const snap = await db.collection('raid_bosses').get();
    const docs = [];
    if (snap && typeof snap.forEach === 'function') snap.forEach(function (doc) { docs.push(doc); });
    let wouldCreate = 0;
    let created = 0;
    let wouldFillWinners = 0;
    let filledWinners = 0;
    for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        const data = typeof doc.data === 'function' ? (doc.data() || {}) : {};
        if (isUnspawnedBoss(data) || !fightOver(data, nowMs)) continue;
        const hist = await db.collection('raid_history').doc(doc.id).get();
        const winner = data.defeated === true ? await readPrizeWinner(db, doc.id) : '';
        if (!hist.exists) {
            wouldCreate += 1;
            if (!apply) continue;
            const result = await recordBossHistory(db, admin, db.collection('raid_bosses').doc(doc.id), doc.id, { now: new Date(nowMs) });
            if (result && result.wrote) created += 1;
            continue;
        }
        const saved = hist.data() || {};
        if (data.defeated === true && winner && !saved.prizeWinner) {
            wouldFillWinners += 1;
            if (!apply) continue;
            const sync = await syncPrizeWinner(db, admin, doc.id);
            if (sync && sync.updated) filledWinners += 1;
        }
    }
    return {
        wouldCreate: wouldCreate,
        created: created,
        wouldFillWinners: wouldFillWinners,
        filledWinners: filledWinners,
    };
}

module.exports = {
    TZ: TZ,
    IMAGE_BY_NAME: IMAGE_BY_NAME,
    timeMs: timeMs,
    publicName: publicName,
    fightOver: fightOver,
    monthLabel: monthLabel,
    goalText: goalText,
    templateIndex: templateIndex,
    buildHistoryDoc: buildHistoryDoc,
    buildRecap: buildRecap,
    resolveEndedAtMs: resolveEndedAtMs,
    repairHistoryFields: repairHistoryFields,
    isUnspawnedBoss: isUnspawnedBoss,
    SURVIVE_GRACE_MS: SURVIVE_GRACE_MS,
    prizeWinnerFromSnapshot: prizeWinnerFromSnapshot,
    recordBossHistory: recordBossHistory,
    syncPrizeWinner: syncPrizeWinner,
    closeEndedBosses: closeEndedBosses,
    backfillRaidHistory: backfillRaidHistory,
    repairRaidHistory: repairRaidHistory,
    safeBossId: safeBossId,
};
