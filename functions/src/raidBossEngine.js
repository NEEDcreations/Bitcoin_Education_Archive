'use strict';

// Monthly raid bosses. This module does not load firebase-admin.
// At spawn, goal = clamp(round(trailing 30-day count * 1.35), floor, ceiling).
// The static goal is the fallback when that count fails. Formula raid-goal-v1.
// scripts/raid-boss-activity.js is the read-only manual check. It does not write.
// HP stays 1000. damageScale uses thousandths so the goal-th hit crosses 1000
// and the hit before it stays under 1000.
//
// Count() cannot group by uid, and it cannot see text quality. The number is
// an upper bound: same collection and equality filters as the damage path,
// without the per-uid daily cap. The cap is documented on the boss doc.
//
// Not scheduled: TV-Titan (no watch-minute credit), Beats-Baron (uploads are
// not listening), Lightning-Lancer (confirmTipSent is not wired to raid),
// Ask Nacho (a ticket claim is not a verified conversation), GG reactions
// (no trusted counter), Flex (client mash), and article XP from unmerged #128.
// Published articles still count toward Forum-Forge after they survive 24 hours.

const { rewardBlocked } = require('./cipherClaim');
const { offsetDateKey } = require('./offsetDay');
const { activityRemovedState } = require('./shoutout');
const { forumActivityAwardable } = require('./topicForumMirror');
const quality = require('./raidPostQuality');
const history = require('./raidHistory');

const TZ = 'America/New_York';
const HP = 1000;
const GOAL_FACTOR = 1.35;
const GOAL_FORMULA = 'raid-goal-v1';
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const FORUM_DELAY_MS = 24 * 60 * 60 * 1000;
const ACCOUNT_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const SETTLED_AT = new Date('2099-01-01T00:00:00.000Z');
const GIVEAWAY_LINE = 'an extra Orange Ticket giveaway winner will be announced by the end of the week';
const REWARD_LINE = 'Rewards: Orange Tickets for damage, up to 10 a day, and Boss Slayer credit if we win. A win means ' + GIVEAWAY_LINE + '.';
const CDN = 'https://assets.bitcoineducation.quest/images/raid-bosses/';

const PUBLIC_TELEGRAM = {
    '-1003827558565': true,
    '-1003745860336': true,
};

const BOTS = {
    'nacho-bot': true,
    system: true,
    tg_broadcast: true,
    deleted: true,
    'badge-gg': true,
};

const SERVER_METRICS = {
    chatMessages: true,
    cipherPeerKey: true,
    favorHashes: true,
    forumPosts: true,
    articlesPublished: true,
    sayHi: true,
    trifecta: true,
    triviaCorrect: true,
    certPasses: true,
    quizCompletions: true,
    pollVotes: true,
    tctvWatchDays: true,
    referralsPaid: true,
};

const SKIP_COPY = {
    name: 1, description: 1, lore: 1, emoji: 1, metric: 1, image: 1, sources: 1,
    current: 1, defeated: 1, placeholder: 1, startTime: 1, endTime: 1, createdAt: 1,
    monthIndex: 1, monthKey: 1, winners: 1, participants: 1, uid: 1, email: 1,
    username: 1, text: 1, dailyCap: 1, serverOnly: 1, minVisibleChars: 1,
    copiedFieldNames: 1, copiedFrom: 1, kind: 1, players: 1, typical: 1, goal: 1,
    goalFloor: 1, goalCeiling: 1, goalCount: 1, goalSource: 1, goalFormula: 1,
    goalFactor: 1, goalWindowDays: 1, goalApproximate: 1, goalFallback: 1,
};

const CARRY_RE = /(scale|damage|reward|prize|ticket|xp|community|hp|sats|unit)/i;
const CARRY_EXACT = { target: 1, targetHP: 1, damageScale: 1, communityTarget: 1 };

function goalFromTypical(typical) {
    return Math.round(Number(typical) * GOAL_FACTOR);
}

function damageScaleForGoal(goal) {
    const g = Math.max(1, Math.floor(Number(goal) || 1));
    return Math.ceil(1000000 / g) / 1000;
}

function hitDamage(amount, scale) {
    const hits = Math.max(0, Math.round(Number(amount) || 0));
    const thousandths = Math.round(Number(scale) * 1000);
    if (!hits || !thousandths) return 0;
    return Math.round(hits * thousandths) / 1000;
}

function art(slug) {
    return CDN + slug + '.png';
}

function boss(entry) {
    const goal = entry.goal != null ? entry.goal : goalFromTypical(entry.typical);
    return {
        monthKey: entry.monthKey,
        name: entry.name,
        lore: entry.lore,
        description: entry.lore + ' ' + entry.detail,
        emoji: entry.emoji,
        image: entry.image || '',
        metric: entry.metric,
        sources: entry.sources || [entry.metric],
        typical: entry.typical,
        goal: goal,
        goalFloor: entry.goalFloor,
        goalCeiling: entry.goalCeiling,
        dailyCap: entry.dailyCap,
        minVisibleChars: entry.minVisibleChars || 0,
        players: entry.players,
        serverOnly: true,
    };
}

const SCHEDULE = [
    boss({
        monthKey: '2026-11',
        name: 'Chat-Charger',
        emoji: '💬',
        image: art('chat-charger'),
        metric: 'chatMessages',
        typical: 230,
        goal: 335,
        goalFloor: 250,
        goalCeiling: 500,
        dailyCap: 10,
        minVisibleChars: 8,
        lore: 'Chat-Charger feeds on the room\'s voice. Empty pings bounce off. Real sentences land.',
        detail: 'The server sets the goal from the last 30 days of chat. It will not sit under 250 or over 500. Each person can land 10 a day, and a message needs at least 8 characters. One person tops out at 300, so the ceiling cannot be soloed.',
        players: 'Post a Global Chat message of at least 8 visible characters. The server counts it. 10 a day each.',
    }),
    boss({
        monthKey: '2026-12',
        name: 'Cipher-Cracker',
        emoji: '🔐',
        image: '',
        metric: 'cipherPeerKey',
        typical: 40,
        goalFloor: 20,
        goalCeiling: 80,
        dailyCap: 2,
        lore: 'Cipher-Cracker hoards locked chests. Peer up, send a key to someone else, and open a chest that is not your own.',
        detail: 'Accepted peer requests and cipher shares you open for someone else count. A cipher you solve yourself, a raw key send, and a request between linked accounts do not. Two a day each.',
        players: 'Accept a real peer request, or open a cipher share someone else sent. Not your own cipher, not a linked account. 2 a day.',
    }),
    boss({
        monthKey: '2027-01',
        name: 'Favor-Fiend',
        emoji: '⛏️',
        metric: 'favorHashes',
        typical: 800,
        goalFloor: 600,
        goalCeiling: 2000,
        dailyCap: 15,
        lore: 'Favor-Fiend sits on the hash pile. Every real Satoshi\'s Favor hash chips the throne.',
        detail: 'Each hash the server writes counts. Banned accounts already cannot hash. 15 a day each, so one miner cannot finish the month alone.',
        players: 'Hash for Satoshi\'s Favor. Each server-written hash is one hit. 15 a day.',
    }),
    boss({
        monthKey: '2027-02',
        name: 'Forum-Forge',
        emoji: '🔨',
        image: art('forum-forge'),
        metric: 'forumPosts',
        sources: ['forumPosts', 'articlesPublished'],
        typical: 5,
        goal: 25,
        goalFloor: 25,
        goalCeiling: 80,
        dailyCap: 2,
        lore: 'Forum-Forge cools unless the forum and the article desk stay busy. A real post is a real swing.',
        detail: 'A forum post or a published article deals damage only after 24 hours if it is still visible. It has to be a substantial, original post. Two a day each.',
        players: 'Publish a substantial, original forum post or article. The server counts it after 24 hours if it is still up. 2 a day, posts and articles together.',
    }),
    boss({
        monthKey: '2027-03',
        name: 'Hello-Herald',
        emoji: '👋',
        metric: 'sayHi',
        typical: 120,
        goalFloor: 61,
        goalCeiling: 300,
        dailyCap: 1,
        lore: 'Hello-Herald only hears a Say hi that the server already paid. One hello a day, from a real message.',
        detail: 'The claim has to come back ok. An already-claimed hello does not hit again.',
        players: 'Say hi and get the server claim. One a day.',
    }),
    boss({
        monthKey: '2027-04',
        name: 'Trifecta-Titan',
        emoji: '🎯',
        metric: 'trifecta',
        typical: 40,
        goal: 61,
        goalFloor: 61,
        goalCeiling: 120,
        dailyCap: 1,
        lore: 'Trifecta-Titan falls only when trivia, a quest, and the daily poll all land on the same day.',
        detail: 'The server writes the trifecta credit once that day. One a day each.',
        players: 'Finish trivia, a quest, and the daily poll on the same day. One trifecta a day.',
    }),
    boss({
        monthKey: '2027-05',
        name: 'Trivia-Tactician',
        emoji: '🧠',
        image: art('trivia-tactician'),
        metric: 'triviaCorrect',
        typical: 130,
        goalFloor: 80,
        goalCeiling: 400,
        dailyCap: 1,
        lore: 'Trivia-Tactician blocks the door. One correct daily trivia answer, graded on the server, is a hit.',
        detail: 'A wrong answer, a repeat claim, or a banned account does not count.',
        players: 'Answer the daily trivia correctly. The server grades it. One a day.',
    }),
    boss({
        monthKey: '2027-06',
        name: 'Scholar-Slayer',
        emoji: '🎓',
        metric: 'certPasses',
        typical: 2,
        goal: 5,
        goalFloor: 5,
        goalCeiling: 16,
        dailyCap: 1,
        lore: 'Scholar-Slayer guards the exam hall. A passed Scholar or Protocol Expert certification is the only blade that bites.',
        detail: 'The server grades the exam. One account can pass at most two certifications, and two people can pass four, so the goal will not sit under 5. Three people who each pass one can finish it. A failed attempt, a ban, or an already-certified retake does not count.',
        players: 'Pass the Scholar or Protocol Expert exam on the server. Not a retake, not a banned pass. 1 a day.',
    }),
    boss({
        monthKey: '2027-07',
        name: 'Quiz-Crusader',
        emoji: '📜',
        image: art('quiz-crusader'),
        metric: 'quizCompletions',
        typical: 90,
        goalFloor: 100,
        goalCeiling: 250,
        dailyCap: 3,
        lore: 'Quiz-Crusader drills the lesson. A quest the server marks passed deals one hit.',
        detail: 'One hit per passed quest, not per question. Three a day each.',
        players: 'Pass a quest the server grades. One hit per passed quest, 3 a day.',
    }),
    boss({
        monthKey: '2027-08',
        name: 'Poll-Patroller',
        emoji: '🗳️',
        image: art('poll-patroller'),
        metric: 'pollVotes',
        typical: 140,
        goalFloor: 80,
        goalCeiling: 400,
        dailyCap: 1,
        lore: 'Poll-Patroller counts ballots, not refreshes. One server-recorded poll vote a day.',
        detail: 'A second vote the same day does not move the bar.',
        players: 'Vote in the daily poll. The server records the first vote. One a day.',
    }),
    boss({
        monthKey: '2027-09',
        name: 'Watch-Warden',
        emoji: '📺',
        metric: 'tctvWatchDays',
        typical: 100,
        goalFloor: 70,
        goalCeiling: 300,
        dailyCap: 1,
        lore: 'Watch-Warden replaced the old TV titan nobody could hit. Finish the daily Timechain TV watch and the warden feels it.',
        detail: 'The daily watch award is the hit. Raw minutes are not. One a day each.',
        players: 'Finish the daily Timechain TV watch so the server grants the watch day. One a day.',
    }),
    boss({
        monthKey: '2027-10',
        name: 'Referral-Ranger',
        emoji: '🧭',
        metric: 'referralsPaid',
        typical: 4,
        goal: 31,
        goalFloor: 31,
        goalCeiling: 60,
        dailyCap: 1,
        lore: 'Referral-Ranger counts a friend who actually reaches Maxi. Linked accounts and self-invites do not count.',
        detail: 'The referrer gets the hit only after the server pays the referral. One a day, about 30 in a month, so the goal will not sit under 31 and one person cannot finish it. Two people can. A floor that also stopped the second person would sit above the referrals this community actually pays.',
        players: 'A friend you invited reaches Maxi and the server pays the referral. Not you, not a linked account. 1 a day.',
    }),
].map(function (entry, index) {
    entry.index = index;
    return entry;
});

const BY_MONTH = {};
SCHEDULE.forEach(function (entry) { BY_MONTH[entry.monthKey] = entry; });

function zonedParts(date) {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const out = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
    fmt.formatToParts(date).forEach(function (part) {
        if (part.type === 'year' || part.type === 'month' || part.type === 'day' || part.type === 'hour' || part.type === 'minute' || part.type === 'second') {
            out[part.type] = Number(part.value);
        }
    });
    if (out.hour === 24) out.hour = 0;
    return out;
}

function zonedTimeToUtc(year, month, day, hour, minute, second) {
    let utc = Date.UTC(year, month - 1, day, hour, minute || 0, second || 0);
    for (let i = 0; i < 4; i++) {
        const wall = zonedParts(new Date(utc));
        const want = Date.UTC(year, month - 1, day, hour, minute || 0, second || 0);
        const got = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
        const diff = want - got;
        if (diff === 0) return new Date(utc);
        utc += diff;
    }
    return new Date(utc);
}

function monthKeyFromDate(date) {
    const p = zonedParts(date instanceof Date ? date : new Date(date));
    return p.year + '-' + String(p.month).padStart(2, '0');
}

function previousMonthKey(key) {
    const parts = String(key || '').split('-');
    let year = Number(parts[0]);
    let month = Number(parts[1]) - 1;
    if (month < 1) {
        month = 12;
        year -= 1;
    }
    return year + '-' + String(month).padStart(2, '0');
}

function nextMonthStart(year, month) {
    let y = year;
    let m = month + 1;
    if (m > 12) {
        m = 1;
        y += 1;
    }
    return zonedTimeToUtc(y, m, 1, 13, 0, 0);
}

function inSpawnWindow(date) {
    const p = zonedParts(date instanceof Date ? date : new Date(date));
    if (p.day === 1 && p.hour >= 13) return true;
    if (p.day === 2) return true;
    return false;
}

function bossForMonth(monthKey) {
    return BY_MONTH[monthKey] || null;
}

function isServerOnlyMetric(metric) {
    return !!SERVER_METRICS[String(metric || '')];
}

function visibleLength(text) {
    return String(text || '').replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '').replace(/\s/g, '').length;
}

function timeMs(value) {
    if (!value) return 0;
    if (typeof value.toDate === 'function') {
        const d = value.toDate();
        return d && d.getTime ? d.getTime() : 0;
    }
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    return 0;
}

function coversTime(data, now) {
    const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
    return timeMs(data && data.startTime) <= nowMs && timeMs(data && data.endTime) > nowMs;
}

function metricMatches(data, metric) {
    if (!data || !metric) return false;
    if (data.metric === metric) return true;
    return Array.isArray(data.sources) && data.sources.indexOf(metric) !== -1;
}

function percentReached(current, target, defeated) {
    const t = Number(target) || 0;
    if (!(t > 0)) return 0;
    let pct = Math.round((Number(current) || 0) / t * 100);
    if (!Number.isFinite(pct) || pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    if (!defeated && pct >= 100) pct = 99;
    return pct;
}

function formatHp(n) {
    const rounded = Math.round(Number(n) * 1000) / 1000;
    if (Math.abs(rounded - Math.round(rounded)) < 0.0005) return String(Math.round(rounded));
    return String(rounded);
}

function finalText(bossDoc) {
    const data = bossDoc || {};
    const name = data.name || 'the raid boss';
    if (data.defeated) {
        return '⚔️ Raid report: we took it down. ' + name + ' fell, and an extra Orange Ticket giveaway winner will be announced by the end of the week.';
    }
    const pct = percentReached(data.current, data.target, false);
    return '⚔️ Raid report: ' + name + ' is still standing at ' + pct + '% of the goal. We got partway there. Next month we finish the job.';
}

function weeklyText(bossDoc) {
    const data = bossDoc || {};
    const name = data.name || 'the raid boss';
    if (data.defeated) {
        return '⚔️ Weekly raid: we took down ' + name + '. The victory stands. Rewards: Orange Tickets for the damage already dealt, up to 10 a day, and Boss Slayer credit for everyone who helped. An extra Orange Ticket giveaway winner will be announced by the end of the week. Open Quest Hub, then Raid.';
    }
    const target = Number(data.target) || HP;
    const current = Number(data.current) || 0;
    const left = Math.max(0, Math.round((target - current) * 1000) / 1000);
    const pct = percentReached(current, target, false);
    return '⚔️ Weekly raid: ' + name + ' has ' + formatHp(left) + ' of ' + formatHp(target) + ' HP left (' + pct + '% damage dealt). ' + REWARD_LINE + ' Open Quest Hub, then Raid.';
}

function isoWeekKey(date) {
    const p = zonedParts(date instanceof Date ? date : new Date(date));
    const utc = new Date(Date.UTC(p.year, p.month - 1, p.day));
    const dayNum = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
    const isoYear = utc.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return isoYear + '-W' + String(week).padStart(2, '0');
}

function safeId(raw) {
    return String(raw || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 140);
}

function carryFields(prev) {
    const fields = {};
    const names = [];
    if (!prev || typeof prev !== 'object') return { fields: fields, names: names };
    Object.keys(prev).forEach(function (key) {
        if (SKIP_COPY[key]) return;
        if (/email|uid|username/i.test(key)) return;
        const val = prev[key];
        if (val && typeof val.toDate === 'function') return;
        if (val && typeof val === 'object') return;
        if (!CARRY_EXACT[key] && !CARRY_RE.test(key)) return;
        fields[key] = val;
        names.push(key);
    });
    names.sort();
    return { fields: fields, names: names };
}

function nachoMessage(admin, text) {
    return {
        uid: 'nacho-bot',
        name: '🦌 Nacho',
        text: text,
        isNachoAuto: false,
        ts: admin.firestore.FieldValue.serverTimestamp(),
    };
}

function clampGoal(count, spec) {
    const floor = Math.floor(Number(spec.goalFloor));
    const ceiling = Math.floor(Number(spec.goalCeiling));
    let goal = Math.round(Number(count) * GOAL_FACTOR);
    if (!Number.isFinite(goal)) goal = floor;
    if (goal < floor) goal = floor;
    if (goal > ceiling) goal = ceiling;
    return goal;
}

function goalRecord(spec, count, source, approximate) {
    const fallback = spec.goal;
    const counted = source === 'count' && Number.isFinite(Number(count));
    const goal = counted ? clampGoal(count, spec) : fallback;
    return {
        goal: goal,
        goalCount: counted ? Math.round(Number(count)) : null,
        goalSource: counted ? 'count' : 'fallback',
        goalFormula: GOAL_FORMULA,
        goalFloor: spec.goalFloor,
        goalCeiling: spec.goalCeiling,
        goalFactor: GOAL_FACTOR,
        goalWindowDays: 30,
        goalApproximate: String(approximate || '').slice(0, 280),
        goalFallback: fallback,
        damageScale: damageScaleForGoal(goal),
    };
}

function spawnSummary(spec, key, record) {
    const how = record.goalSource === 'count'
        ? 'count ' + record.goalCount + ' × 1.35'
        : 'fallback, count unavailable';
    return 'Raid boss spawned for ' + key + ': ' + spec.name + '. Goal ' + record.goal
        + ' (' + how + ', clamped ' + spec.goalFloor + '-' + spec.goalCeiling + '). Formula ' + GOAL_FORMULA + '.';
}

async function readCount(query) {
    const snap = await query.count().get();
    const data = snap && typeof snap.data === 'function' ? snap.data() : snap;
    const n = Number(data && data.count);
    if (!Number.isFinite(n) || n < 0) throw new Error('count');
    return n;
}

async function countBossEvents(db, admin, spec, now) {
    const when = now instanceof Date ? now : new Date(now);
    const cutoff = admin.firestore.Timestamp.fromDate(new Date(when.getTime() - WINDOW_MS));
    const metric = spec.metric;
    if (metric === 'chatMessages') {
        const n = await readCount(db.collection('global_chat').where('ts', '>=', cutoff));
        return { count: n, approximate: 'global_chat ts>=30d upper bound; short messages and bots included; per-uid cap of 10 not applied' };
    }
    if (metric === 'cipherPeerKey') {
        const peers = await readCount(db.collection('peer_requests').where('status', '==', 'accepted').where('acceptedAt', '>=', cutoff));
        const shares = await readCount(db.collection('cipher_shares').where('paid', '==', true).where('createdAt', '>=', cutoff));
        return { count: peers + shares, approximate: 'accepted peer requests plus paid cipher shares in 30d; self-dealing and the cap of 2 not applied' };
    }
    if (metric === 'favorHashes') {
        const n = await readCount(db.collection('satoshiFavor').doc('current').collection('hashes').where('timestamp', '>=', cutoff));
        return { count: n, approximate: 'favor hashes in 30d; per-uid cap of 15 not applied' };
    }
    if (metric === 'forumPosts') {
        const posts = await readCount(db.collection('forum_posts').where('createdAt', '>=', cutoff));
        const articles = await readCount(db.collection('articles').where('createdAt', '>=', cutoff));
        return { count: posts + articles, approximate: 'forum posts plus articles created in 30d; quality, duplicates, account age, and the 24h wait are not in the count; cap of 2 not applied' };
    }
    if (metric === 'sayHi') {
        return { failed: true, approximate: 'Say hi claims share daily_action_counts and count() cannot take a 30-day slice of only those docs, so the static goal is used' };
    }
    if (metric === 'trifecta') {
        const n = await readCount(db.collection('satoshiFavor').doc('current').collection('contributors').where('source', '==', 'daily_all_three').where('timestamp', '>=', cutoff));
        return { count: n, approximate: 'daily trifecta credits in 30d; cap of 1 not applied' };
    }
    if (metric === 'triviaCorrect') {
        const n = await readCount(db.collectionGroup('daily_action_counts').where('correct', '==', true).where('at', '>=', cutoff));
        return { count: n, approximate: 'correct trivia claims in 30d; bans and the cap of 1 not applied' };
    }
    if (metric === 'certPasses') {
        const n = await readCount(db.collection('scholar_exam_keys').where('passed', '==', true).where('gradedAt', '>=', cutoff));
        return { count: n, approximate: 'passed exams in 30d; retakes and bans not applied' };
    }
    if (metric === 'quizCompletions') {
        const n = await readCount(db.collectionGroup('quest_passes').where('at', '>=', cutoff));
        return { count: n, approximate: 'passed quests in 30d; cap of 3 not applied' };
    }
    if (metric === 'pollVotes') {
        const n = await readCount(db.collectionGroup('votes').where('at', '>=', cutoff));
        return { count: n, approximate: 'poll votes in 30d; cap of 1 not applied' };
    }
    if (metric === 'tctvWatchDays') {
        const n = await readCount(db.collectionGroup('award_claims').where('action', '==', 'tctv_watch_ticket').where('at', '>=', cutoff));
        return { count: n, approximate: 'Timechain TV watch days in 30d; cap of 1 not applied' };
    }
    if (metric === 'referralsPaid') {
        const n = await readCount(db.collection('referrals').where('paidAt', '>=', cutoff));
        return { count: n, approximate: 'paid referrals in 30d; linked accounts and the cap of 1 not applied' };
    }
    return { failed: true, approximate: 'no count for this boss; static goal used' };
}

async function calibrateGoal(db, admin, spec, now) {
    try {
        const found = await countBossEvents(db, admin, spec, now);
        if (!found || found.failed || found.count == null) {
            return goalRecord(spec, null, 'fallback', found && found.approximate);
        }
        return goalRecord(spec, found.count, 'count', found.approximate);
    } catch (e) {
        console.warn('[RAID SPAWN] goal count fallback');
        return goalRecord(spec, null, 'fallback', 'count failed; static goal used. Per-uid daily caps are not inside count().');
    }
}

function bossPayload(spec, key, start, end, admin, copiedNames, copiedFrom, record) {
    const goal = record.goal;
    return {
        name: spec.name,
        description: spec.description,
        lore: spec.lore,
        emoji: spec.emoji,
        image: spec.image || '',
        metric: spec.metric,
        sources: spec.sources.slice(),
        target: HP,
        communityTarget: goal,
        damageScale: record.damageScale,
        dailyCap: spec.dailyCap,
        minVisibleChars: spec.minVisibleChars || 0,
        serverOnly: true,
        current: 0,
        defeated: false,
        placeholder: false,
        startTime: admin.firestore.Timestamp.fromDate(start),
        endTime: admin.firestore.Timestamp.fromDate(end),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        monthKey: key,
        monthIndex: spec.index,
        copiedFieldNames: copiedNames.slice(),
        copiedFrom: copiedFrom || '',
    };
}

async function findPreviousBoss(db, admin, monthKey, monthStart) {
    const prevKey = previousMonthKey(monthKey);
    let best = null;
    function consider(id, data) {
        if (!data || data.placeholder || id === monthKey) return;
        const startMs = timeMs(data.startTime);
        if (startMs && startMs >= monthStart.getTime()) return;
        const bestMs = best ? timeMs(best.data.startTime) : -1;
        if (!best || startMs >= bestMs) best = { id: id, data: data };
    }
    try {
        const direct = await db.collection('raid_bosses').doc(prevKey).get();
        if (direct.exists) consider(direct.id, direct.data() || {});
    } catch (e) { /* direct lookup is optional */ }
    try {
        const ts = admin.firestore.Timestamp.fromDate(monthStart);
        const snap = await db.collection('raid_bosses').where('startTime', '<', ts).orderBy('startTime', 'desc').limit(5).get();
        snap.forEach(function (doc) { consider(doc.id, doc.data() || {}); });
    } catch (e) {
        console.warn('[RAID SPAWN] previous boss lookup', e && e.message);
    }
    return best;
}

async function postFinal(db, admin, prev) {
    if (!prev || !prev.data) return { skipped: 'no-previous' };
    const markerKey = safeId(prev.id);
    if (!markerKey) return { skipped: 'no-previous' };
    const chatRef = db.collection('global_chat').doc('raid-final-' + markerKey);
    const markerRef = db.collection('raid_boss_posts').doc('final-' + markerKey);
    const text = finalText(prev.data);
    let wrote = false;
    await db.runTransaction(async function (tx) {
        const marker = await tx.get(markerRef);
        const chat = await tx.get(chatRef);
        if (marker.exists || chat.exists) return;
        tx.set(chatRef, nachoMessage(admin, text));
        tx.set(markerRef, {
            kind: 'final',
            monthKey: markerKey,
            at: admin.firestore.FieldValue.serverTimestamp(),
        });
        wrote = true;
    });
    return { wrote: wrote, id: chatRef.id };
}

async function runScheduledSpawn(db, admin, now) {
    const when = now instanceof Date ? now : new Date(now || Date.now());
    if (!inSpawnWindow(when)) return { ok: true, skipped: 'out-of-window' };
    const key = monthKeyFromDate(when);
    const spec = bossForMonth(key);
    if (!spec) return { ok: true, skipped: 'unscheduled', monthKey: key };
    const ref = db.collection('raid_bosses').doc(key);
    const existing = await ref.get();
    if (existing.exists) return { ok: true, skipped: 'exists', id: key };
    const parts = key.split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const start = zonedTimeToUtc(year, month, 1, 13, 0, 0);
    const end = nextMonthStart(year, month);
    const record = await calibrateGoal(db, admin, spec, when);
    const prev = await findPreviousBoss(db, admin, key, start);
    await postFinal(db, admin, prev);
    const carried = carryFields(prev && prev.data);
    console.log('[RAID SPAWN] copied fields: ' + (carried.names.length ? carried.names.join(', ') : '(none)'));
    const payload = Object.assign({}, carried.fields, bossPayload(spec, key, start, end, admin, carried.names, prev && prev.id, record));
    const created = await db.runTransaction(async function (tx) {
        const fresh = await tx.get(ref);
        if (fresh.exists) return false;
        tx.set(ref, payload);
        return true;
    });
    if (created === true) {
        try {
            await db.collection('raid_boss_meta').doc(key).set({
                goal: record.goal,
                goalCount: record.goalCount,
                goalSource: record.goalSource,
                goalFormula: record.goalFormula,
                goalFloor: record.goalFloor,
                goalCeiling: record.goalCeiling,
                goalFactor: record.goalFactor,
                goalWindowDays: record.goalWindowDays,
                goalApproximate: record.goalApproximate,
                goalFallback: record.goalFallback,
                at: admin.firestore.FieldValue.serverTimestamp(),
            });
        } catch (e) {
            console.warn('[RAID SPAWN] goal meta skipped');
        }
    }
    const summary = spawnSummary(spec, key, record);
    return {
        ok: true,
        created: created === true,
        id: key,
        goal: record.goal,
        goalCount: record.goalCount,
        goalSource: record.goalSource,
        summary: summary,
    };
}

async function defaultTelegramSend(chatId, text, token) {
    if (PUBLIC_TELEGRAM[String(chatId)] || !token || !chatId) return false;
    const res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text }),
    });
    return !!(res && res.ok);
}

async function sendPhilDm(text, opts) {
    const o = opts || {};
    const fromOpt = o.chatId != null && String(o.chatId) !== '';
    const chatId = String(fromOpt ? o.chatId : (process.env.PHIL_TELEGRAM_CHAT_ID || ''));
    if (!chatId) {
        console.warn('[RAID SPAWN] PHIL_TELEGRAM_CHAT_ID is missing');
        return false;
    }
    if (PUBLIC_TELEGRAM[chatId]) {
        console.warn('[RAID SPAWN] Phil DM skipped');
        return false;
    }
    const token = String(o.token || process.env.TG_BOT_TOKEN || '');
    if (!token) {
        console.warn('[RAID SPAWN] TG_BOT_TOKEN is missing');
        return false;
    }
    const send = o.send || defaultTelegramSend;
    try {
        return !!(await send(chatId, text, token));
    } catch (e) {
        console.warn('[RAID SPAWN] Phil DM skipped');
        return false;
    }
}

function spawnFailureMessage(monthKey) {
    return 'Raid boss spawn failed for ' + monthKey + '. The month boss was not created. Check the scheduleRaidBoss logs.';
}

async function alertSpawnFailure(db, admin, monthKey, err, opts) {
    const key = safeId(monthKey) || 'unknown';
    const markerRef = db.collection('raid_boss_alerts').doc(key);
    const snap = await markerRef.get();
    const prev = snap.exists ? (snap.data() || {}) : null;
    if (prev && prev.notified && prev.dmSent) return { skipped: true, dmSent: true };
    const message = spawnFailureMessage(key);
    if (!prev || !prev.notified) {
        await db.collection('admin_notifications').add({
            type: 'raid_spawn_failure',
            monthKey: key,
            text: message,
            at: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    let dmSent = !!(prev && prev.dmSent);
    if (!dmSent) dmSent = await sendPhilDm(message, opts);
    await markerRef.set({
        notified: true,
        dmSent: dmSent === true,
        monthKey: key,
        at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { dmSent: dmSent === true, notified: true };
}

async function spawnOrAlert(db, admin, now, opts) {
    const when = now instanceof Date ? now : new Date(now || Date.now());
    try { await history.closeEndedBosses(db, admin, when); }
    catch (e) { console.warn('[RAID] history', e && e.message); }
    try {
        const result = await runScheduledSpawn(db, admin, when);
        if (result && result.created && result.summary) {
            try { await sendPhilDm(result.summary, opts); }
            catch (dmErr) { console.warn('[RAID SPAWN] Phil DM skipped'); }
        }
        return result;
    } catch (e) {
        console.error('[RAID SPAWN]', e && e.message);
        try { await alertSpawnFailure(db, admin, monthKeyFromDate(when), e, opts); }
        catch (e2) { console.error('[RAID SPAWN] alert', e2 && e2.message); }
        throw e;
    }
}

async function readBoss(db, id) {
    const ref = db.collection('raid_bosses').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return null;
    return { ref: ref, id: snap.id || id, data: snap.data() || {} };
}

async function resolveBoss(db, now, allowDefeated) {
    const key = monthKeyFromDate(now);
    const keys = [key, previousMonthKey(key)];
    for (let i = 0; i < keys.length; i++) {
        const found = await readBoss(db, keys[i]);
        if (!found) continue;
        if (found.data.placeholder) continue;
        if (!allowDefeated && found.data.defeated) continue;
        if (!coversTime(found.data, now)) continue;
        return found;
    }
    return resolveCoveringBoss(db, now, allowDefeated);
}

async function resolveCoveringBoss(db, now, allowDefeated) {
    let snap;
    try {
        snap = await db.collection('raid_bosses').orderBy('startTime', 'desc').limit(5).get();
    } catch (e) {
        return null;
    }
    let best = null;
    snap.forEach(function (doc) {
        if (best) return;
        const data = doc.data() || {};
        if (data.placeholder) return;
        if (!allowDefeated && data.defeated) return;
        if (!coversTime(data, now)) return;
        best = {
            ref: doc.ref || db.collection('raid_bosses').doc(doc.id),
            id: doc.id,
            data: data,
        };
    });
    return best;
}

async function postWeekly(db, admin, now) {
    const when = now instanceof Date ? now : new Date(now || Date.now());
    const bossDoc = await resolveBoss(db, when, true);
    if (!bossDoc) return { skipped: 'no-boss' };
    const week = isoWeekKey(when);
    const chatRef = db.collection('global_chat').doc('raid-weekly-' + week);
    const markerRef = db.collection('raid_boss_posts').doc('weekly-' + week);
    const text = weeklyText(bossDoc.data);
    let wrote = false;
    await db.runTransaction(async function (tx) {
        const marker = await tx.get(markerRef);
        const chat = await tx.get(chatRef);
        if (marker.exists || chat.exists) return;
        tx.set(chatRef, nachoMessage(admin, text));
        tx.set(markerRef, {
            kind: 'weekly',
            week: week,
            at: admin.firestore.FieldValue.serverTimestamp(),
        });
        wrote = true;
    });
    return { wrote: wrote, id: chatRef.id, defeated: bossDoc.data.defeated === true };
}

function uidOk(uid) {
    return typeof uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(uid);
}

function dailyCapFor(data) {
    const onDoc = Math.floor(Number(data && data.dailyCap));
    if (onDoc > 0) return onDoc;
    const name = data && data.name;
    const metric = data && data.metric;
    let match = null;
    for (let i = 0; i < SCHEDULE.length; i++) {
        const entry = SCHEDULE[i];
        if (name && entry.name === name) {
            match = entry;
            break;
        }
        if (!match && metric && (entry.metric === metric || (entry.sources && entry.sources.indexOf(metric) !== -1))) {
            match = entry;
        }
    }
    const fromDef = match ? Math.floor(Number(match.dailyCap)) : 0;
    return fromDef > 0 ? fromDef : 1;
}

async function maybeGrantTickets(uid, damage, grantTickets) {
    if (grantTickets === null || !(damage > 0)) return;
    if (typeof grantTickets === 'function') {
        await grantTickets(uid, damage);
        return;
    }
    const { grantServerTickets } = require('./grantServerTickets');
    await grantServerTickets(uid, 'raid_damage_ticket', { damage: damage });
}

function pickWinners(list, rng) {
    const shuffled = list.slice();
    const random = typeof rng === 'function' ? rng : Math.random;
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const tmp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = tmp;
    }
    return shuffled.slice(0, Math.min(2, shuffled.length));
}

async function creditDefeatBadges(db, admin, bossId, participants, winnerUids) {
    const { grantFamily, familyFor } = require('./grantBadge');
    const winners = {};
    (winnerUids || []).forEach(function (id) { winners[id] = true; });
    for (let i = 0; i < participants.length; i++) {
        const participantUid = participants[i] && participants[i].uid;
        if (!participantUid) continue;
        const userRef = db.collection('users').doc(participantUid);
        const creditRef = userRef.collection('raid_credits').doc(bossId);
        let outcome = { credited: false, won: false };
        try {
            outcome = await db.runTransaction(async function (tx) {
                const credit = await tx.get(creditRef);
                const user = await tx.get(userRef);
                if (credit.exists || !user.exists) return { credited: false, won: false };
                const won = !!winners[participantUid];
                const update = { raidBossesDefeated: admin.firestore.FieldValue.increment(1) };
                if (won) update.raidWins = admin.firestore.FieldValue.increment(1);
                tx.set(creditRef, {
                    bossId: bossId,
                    winner: won,
                    at: admin.firestore.FieldValue.serverTimestamp(),
                });
                tx.update(userRef, update);
                return { credited: true, won: won };
            });
        } catch (e) {
            console.warn('[RAID] defeat credit', e && e.message);
            continue;
        }
        if (!outcome || !outcome.credited) continue;
        try {
            const ids = familyFor('raidBossesDefeated').slice();
            if (outcome.won) ids.push.apply(ids, familyFor('raidWins'));
            await grantFamily(db, admin, participantUid, ids);
        } catch (e) {
            console.warn('[RAID] defeat badges', e && e.message);
        }
    }
}

async function maybeDefeat(db, admin, bossRef, bossId, opts) {
    const parts = await bossRef.collection('participants').get();
    let total = 0;
    const list = [];
    parts.forEach(function (doc) {
        const data = doc.data() || {};
        total += Number(data.contributed) || 0;
        list.push({ uid: doc.id, username: data.username || 'Anonymous' });
    });
    total = Math.round(total * 1000) / 1000;
    let defeated = false;
    await db.runTransaction(async function (tx) {
        const fresh = await tx.get(bossRef);
        if (!fresh.exists) return;
        const data = fresh.data() || {};
        if (data.defeated) return;
        const target = Number(data.target) || HP;
        const freshCurrent = Number(data.current) || 0;
        const next = Math.max(freshCurrent, total);
        if (total < target && freshCurrent < target) {
            if (next > freshCurrent) tx.update(bossRef, { current: next });
            return;
        }
        defeated = true;
        tx.update(bossRef, {
            current: next,
            defeated: true,
            defeatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    if (!defeated) return { defeated: false, current: total };
    const winners = pickWinners(list, opts && opts.rng);
    for (let i = 0; i < winners.length; i++) {
        await bossRef.collection('winners').doc(winners[i].uid).set({
            uid: winners[i].uid,
            username: winners[i].username || 'Anonymous',
            drawnAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    console.log('[RAID] defeated, winners recorded: ' + winners.length);
    if (!opts || opts.badges !== false) {
        try {
            await creditDefeatBadges(db, admin, bossId, list, winners.map(function (w) { return w.uid; }));
        } catch (e) {
            console.warn('[RAID] defeat credit', e && e.message);
        }
    }
    try {
        await history.recordBossHistory(db, admin, bossRef, bossId, { now: opts && opts.now });
        await history.syncPrizeWinner(db, admin, bossId);
    } catch (e) {
        console.warn('[RAID] history', e && e.message);
    }
    return { defeated: true, current: total, winners: winners.length };
}

async function creditTrusted(db, admin, opts) {
    const o = opts || {};
    if (!db || !admin) return { status: 'missing' };
    const metric = String(o.metric || '');
    const uid = o.uid;
    if (!uidOk(uid) || BOTS[uid] || o.isNachoAuto === true) return { status: 'bot' };
    if (o.otherUid && o.otherUid === uid) return { status: 'self' };
    const dedupe = safeId(o.dedupeKey);
    if (!dedupe) return { status: 'key' };
    const take = Math.round(Number(o.amount == null ? 1 : o.amount));
    if (!(take > 0)) return { status: 'amount' };
    const when = o.now instanceof Date ? o.now : new Date(o.now || Date.now());
    const bossDoc = await resolveBoss(db, when, false);
    if (!bossDoc) return { status: 'no-boss' };
    if (!metricMatches(bossDoc.data, metric)) return { status: 'metric' };
    if (o.text != null && Number(bossDoc.data.minVisibleChars) > 0 && visibleLength(o.text) < Number(bossDoc.data.minVisibleChars)) {
        return { status: 'short' };
    }
    const eventRef = db.collection('raid_damage_events').doc(bossDoc.id + '_' + uid + '_' + dedupe);
    const day = offsetDateKey(when.getTime());
    const capMetric = bossDoc.data.metric || metric;
    const capRef = db.collection('raid_daily_caps').doc(uid + '_' + day + '_' + capMetric);
    const userRef = db.collection('users').doc(uid);
    const ledgerRef = db.collection('faucet_ledger').doc(uid);
    const partRef = bossDoc.ref.collection('participants').doc(uid);
    const capMax = dailyCapFor(bossDoc.data);
    const scale = typeof bossDoc.data.damageScale === 'number' ? bossDoc.data.damageScale : 1;
    const stamp = admin.firestore.FieldValue.serverTimestamp();
    const outcome = await db.runTransaction(async function (tx) {
        const event = await tx.get(eventRef);
        if (event.exists) return { status: 'dup' };
        const user = await tx.get(userRef);
        const ledger = await tx.get(ledgerRef);
        if (!user.exists) return { status: 'no-user' };
        if (rewardBlocked(user.data() || {}, ledger.exists ? (ledger.data() || {}) : {})) return { status: 'banned' };
        const cap = await tx.get(capRef);
        const used = cap.exists ? Number((cap.data() || {}).count) || 0 : 0;
        if (!capMax || used >= capMax || used + take > capMax) return { status: 'cap' };
        const part = await tx.get(partRef);
        const prev = part.exists ? Number((part.data() || {}).contributed) || 0 : 0;
        const dmg = hitDamage(take, scale);
        const userData = user.data() || {};
        const username = String(userData.username || userData.displayName || 'Anonymous').slice(0, 40);
        tx.set(eventRef, { bossId: bossDoc.id, uid: uid, metric: metric, amount: take, at: stamp });
        tx.set(capRef, { count: used + take, metric: capMetric, day: day }, { merge: true });
        tx.set(partRef, {
            uid: uid,
            username: username,
            contributed: Math.round((prev + dmg) * 1000) / 1000,
            lastUpdate: stamp,
        }, { merge: true });
        tx.update(bossDoc.ref, { current: admin.firestore.FieldValue.increment(dmg) });
        return { status: 'ok', damage: dmg };
    });
    if (!outcome || outcome.status !== 'ok') return outcome || { status: 'skip' };
    try { await maybeGrantTickets(uid, outcome.damage, o.grantTickets); }
    catch (e) { console.warn('[RAID] tickets', e && e.message); }
    let defeat = { defeated: false };
    try { defeat = await maybeDefeat(db, admin, bossDoc.ref, bossDoc.id, o); }
    catch (e) { console.warn('[RAID] defeat', e && e.message); }
    return { status: 'ok', damage: outcome.damage, defeated: defeat.defeated === true };
}

async function noteTrusted(db, admin, opts) {
    try {
        return await creditTrusted(db, admin, opts || {});
    } catch (e) {
        console.warn('[RAID] credit skipped', e && e.message);
        return { status: 'error' };
    }
}

function bornMs(user) {
    if (!user) return 0;
    const raw = user.created != null ? user.created : user.createdAt;
    if (raw && typeof raw.seconds === 'number') return raw.seconds * 1000;
    return timeMs(raw);
}

function postPlain(kind, data) {
    const src = data || {};
    if (kind === 'article') return [src.title, src.subtitle, src.body].filter(Boolean).join('\n');
    return [src.title, src.body].filter(Boolean).join('\n');
}

function sourceLive(kind, snap) {
    if (!snap || !snap.exists) return false;
    const data = snap.data() || {};
    if (activityRemovedState(data)) return false;
    if (kind === 'article' && data.status !== 'published') return false;
    return true;
}

async function authorGate(db, uid, nowMs) {
    if (!uidOk(uid) || BOTS[uid]) return 'bot';
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) return 'guest';
    const user = userSnap.data() || {};
    if (user.anonymous === true) return 'guest';
    let ledger = {};
    try {
        const ledgerSnap = await db.collection('faucet_ledger').doc(uid).get();
        ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
    } catch (e) {
        return 'banned';
    }
    if (rewardBlocked(user, ledger)) return 'banned';
    const born = bornMs(user);
    if (!born || nowMs - born < ACCOUNT_AGE_MS) return 'young';
    return '';
}

async function recentNormalized(db, admin, uid, kind, sourceId, now) {
    const cutoffMs = now.getTime() - WINDOW_MS;
    const texts = [];
    async function pull(collectionName, sameKind) {
        const snap = await db.collection(collectionName).where('authorId', '==', uid).limit(200).get();
        snap.forEach(function (doc) {
            if (sameKind && doc.id === sourceId) return;
            const data = doc.data() || {};
            if (activityRemovedState(data)) return;
            const at = timeMs(data.createdAt);
            if (at && at < cutoffMs) return;
            texts.push(quality.normalizeForDup(postPlain(collectionName === 'articles' ? 'article' : 'forum', data)));
        });
    }
    await pull('forum_posts', kind === 'forum');
    await pull('articles', kind === 'article');
    return texts;
}

function pendingId(kind, sourceId) {
    return safeId(kind + '-' + sourceId);
}

async function queueForumDamage(db, admin, opts) {
    const o = opts || {};
    const kind = o.kind === 'article' ? 'article' : 'forum';
    const sourceId = String(o.sourceId || '');
    const uid = o.uid;
    const now = o.now instanceof Date ? o.now : new Date(o.now || Date.now());
    const data = o.data || {};
    if (!pendingId(kind, sourceId)) return { queued: false, reason: 'missing' };
    if (kind === 'forum' && !forumActivityAwardable(data)) return { queued: false, reason: 'mirror' };
    if (activityRemovedState(data)) return { queued: false, reason: 'hidden' };
    if (kind === 'article' && data.status !== 'published') return { queued: false, reason: 'hidden' };
    const gate = await authorGate(db, uid, now.getTime());
    if (gate) return { queued: false, reason: gate };
    const verdict = quality.assessRaidQuality(postPlain(kind, data));
    if (!verdict.ok) return { queued: false, reason: 'quality' };
    let prior = [];
    try {
        prior = await recentNormalized(db, admin, uid, kind, sourceId, now);
    } catch (e) {
        console.warn('[RAID FORUM] duplicate check skipped');
        return { queued: false, reason: 'duplicate' };
    }
    if (quality.isNearDuplicate(verdict.normalized, prior)) return { queued: false, reason: 'duplicate' };
    const metric = kind === 'article' ? 'articlesPublished' : 'forumPosts';
    const bossDoc = await resolveBoss(db, now, false);
    if (!bossDoc || !metricMatches(bossDoc.data, metric)) return { queued: false, reason: 'metric' };
    const ref = db.collection('raid_forum_pending').doc(pendingId(kind, sourceId));
    const existing = await ref.get();
    if (existing.exists) return { queued: false, reason: 'queued' };
    const ready = new Date(now.getTime() + FORUM_DELAY_MS);
    await ref.set({
        status: 'pending',
        kind: kind,
        sourceId: sourceId,
        uid: uid,
        metric: metric,
        hash: verdict.hash,
        readyAt: admin.firestore.Timestamp.fromDate(ready),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { queued: true, id: ref.id };
}

async function settlePending(ref, admin, status) {
    await ref.set({
        status: status,
        readyAt: admin.firestore.Timestamp.fromDate(SETTLED_AT),
        settledAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}

async function sweepForumDamage(db, admin, now) {
    const when = now instanceof Date ? now : new Date(now || Date.now());
    const ts = admin.firestore.Timestamp.fromDate(when);
    let snap;
    try {
        snap = await db.collection('raid_forum_pending').where('readyAt', '<=', ts).orderBy('readyAt').limit(40).get();
    } catch (e) {
        console.warn('[RAID FORUM] sweep skipped');
        return { checked: 0, credited: 0, skipped: 0 };
    }
    let credited = 0;
    let skipped = 0;
    const docs = [];
    snap.forEach(function (doc) { docs.push(doc); });
    for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        const pending = doc.data() || {};
        if (pending.status && pending.status !== 'pending') continue;
        const kind = pending.kind === 'article' ? 'article' : 'forum';
        const sourceId = String(pending.sourceId || '');
        const uid = pending.uid;
        const pendingRef = doc.ref || db.collection('raid_forum_pending').doc(doc.id);
        const collectionName = kind === 'article' ? 'articles' : 'forum_posts';
        let live = false;
        let data = {};
        try {
            const source = await db.collection(collectionName).doc(sourceId).get();
            live = sourceLive(kind, source);
            data = source.exists ? (source.data() || {}) : {};
        } catch (e) {
            live = false;
        }
        if (!live) {
            skipped += 1;
            try { await settlePending(pendingRef, admin, 'skipped'); } catch (e) { /* next sweep retries */ }
            continue;
        }
        const gate = await authorGate(db, uid, when.getTime());
        const verdict = quality.assessRaidQuality(postPlain(kind, data));
        if (gate || !verdict.ok) {
            skipped += 1;
            try { await settlePending(pendingRef, admin, 'skipped'); } catch (e) { /* next sweep retries */ }
            continue;
        }
        const result = await noteTrusted(db, admin, {
            metric: pending.metric,
            uid: uid,
            dedupeKey: kind + '-' + uid + '-' + sourceId,
            amount: 1,
            now: when,
        });
        if (!result || result.status === 'error') continue;
        if (result.status === 'ok' || result.status === 'dup') {
            if (result.status === 'ok') credited += 1;
            try { await settlePending(pendingRef, admin, 'credited'); } catch (e) { /* dedupe stops a second hit */ }
            continue;
        }
        skipped += 1;
        try { await settlePending(pendingRef, admin, 'skipped'); } catch (e) { /* next sweep retries */ }
    }
    try { await history.closeEndedBosses(db, admin, now); }
    catch (e) { console.warn('[RAID] history', e && e.message); }
    return { checked: docs.length, credited: credited, skipped: skipped };
}

module.exports = {
    TZ: TZ,
    HP: HP,
    GOAL_FACTOR: GOAL_FACTOR,
    GOAL_FORMULA: GOAL_FORMULA,
    GIVEAWAY_LINE: GIVEAWAY_LINE,
    REWARD_LINE: REWARD_LINE,
    SCHEDULE: SCHEDULE,
    PUBLIC_TELEGRAM: PUBLIC_TELEGRAM,
    goalFromTypical: goalFromTypical,
    clampGoal: clampGoal,
    goalRecord: goalRecord,
    spawnSummary: spawnSummary,
    calibrateGoal: calibrateGoal,
    damageScaleForGoal: damageScaleForGoal,
    hitDamage: hitDamage,
    zonedParts: zonedParts,
    zonedTimeToUtc: zonedTimeToUtc,
    monthKeyFromDate: monthKeyFromDate,
    previousMonthKey: previousMonthKey,
    inSpawnWindow: inSpawnWindow,
    bossForMonth: bossForMonth,
    isServerOnlyMetric: isServerOnlyMetric,
    visibleLength: visibleLength,
    finalText: finalText,
    weeklyText: weeklyText,
    isoWeekKey: isoWeekKey,
    carryFields: carryFields,
    runScheduledSpawn: runScheduledSpawn,
    spawnOrAlert: spawnOrAlert,
    alertSpawnFailure: alertSpawnFailure,
    spawnFailureMessage: spawnFailureMessage,
    postWeekly: postWeekly,
    dailyCapFor: dailyCapFor,
    creditTrusted: creditTrusted,
    noteTrusted: noteTrusted,
    queueForumDamage: queueForumDamage,
    sweepForumDamage: sweepForumDamage,
    sendPhilDm: sendPhilDm,
    recordBossHistory: history.recordBossHistory,
    syncPrizeWinner: history.syncPrizeWinner,
    closeEndedBosses: history.closeEndedBosses,
    backfillRaidHistory: history.backfillRaidHistory,
    buildHistoryDoc: history.buildHistoryDoc,
};
