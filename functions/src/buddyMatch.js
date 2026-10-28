'use strict';

// Find a Bitcoin Buddy. The client is hostile: it cannot choose a partner,
// a username, a reward, or the welcome text. requestBuddyMatch does the
// match inside one transaction. leaveBuddyPool and endBuddy are the only
// other client entry points. sweepStaleBuddies expires the pool and quiet
// matches. onBuddyDmXp pays +20 XP through applyDailyXp once both people
// have written in that buddy conversation, at most once per user per 30 days.

const { applyDailyXp } = require('./applyDailyXp');
const { offsetDateKey } = require('./offsetDay');
const { rewardBlocked } = require('./cipherClaim');
const { grantFamily } = require('./grantBadge');
const { accountLocked, createSafetyHandlers } = require('./buddySafety');

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const GOALS = ['learn', 'teach'];
const LEVEL_RANK = { beginner: 0, intermediate: 1, advanced: 2 };
const POOL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MATCH_QUIET_MS = 30 * 24 * 60 * 60 * 1000;
const LEVEL_FALLBACK_MS = 24 * 60 * 60 * 1000;
const XP_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const BUDDY_XP = 20;
const RATE_MS = 12000;
const RATE_DAILY_MAX = 20;
const REMATCH_MS = 24 * 60 * 60 * 1000;
const POOL_PAGE = 40;
const POOL_PAGES = 6;
const SEEN_CAP = 20;
const NACHO_UID = 'nacho-bot';
// Same shape as deleteAccount: nostr:<pubkey> and ln:<key> contain a colon.
const UID_RE = /^[A-Za-z0-9_:-]{1,128}$/;

const ICEBREAKERS = [
    'What first got you interested in Bitcoin?',
    'What is the most surprising thing you have learned about Bitcoin?',
    'Which Bitcoin topic do you want to talk about first?',
    'Have you ever explained Bitcoin to someone new? How did it go?',
    'What would you like a teacher to clarify for you?'
];

function buddyError(code, message) {
    const err = new Error(message);
    err.buddyCode = code;
    return err;
}

function plainText(raw, max) {
    const cap = max || 200;
    if (typeof raw !== 'string') return '';
    // Bound the work before tag and entity cleanup. A huge intro must not
    // be scanned in full.
    let s = raw.length > cap ? raw.slice(0, cap) : raw;
    s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
    for (let pass = 0; pass < 3; pass++) {
        const next = s
            .replace(/<[^>]*>/g, ' ')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&amp;/gi, '&')
            .replace(/&#x([0-9a-f]+);/gi, function (_, hex) {
                const c = parseInt(hex, 16);
                if (!Number.isFinite(c) || c < 32 || c === 127) return ' ';
                return String.fromCodePoint(c);
            })
            .replace(/&#(\d+);/g, function (_, num) {
                const c = Number(num);
                if (!Number.isFinite(c) || c < 32 || c === 127) return ' ';
                try { return String.fromCodePoint(c); } catch (e) { return ' '; }
            });
        s = next;
    }
    s = s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (s.length > cap) s = s.slice(0, cap).trim();
    return s;
}

function profileUsername(user) {
    const name = plainText(user && user.username, 40).replace(/["'`\\<>]/g, '').trim();
    if (name.length < 2) return '';
    return name;
}

function levelLabel(level) {
    if (!LEVELS.includes(level)) return 'Beginner';
    return level.charAt(0).toUpperCase() + level.slice(1);
}

function adjacentLevel(a, b) {
    if (!Object.prototype.hasOwnProperty.call(LEVEL_RANK, a)) return false;
    if (!Object.prototype.hasOwnProperty.call(LEVEL_RANK, b)) return false;
    return Math.abs(LEVEL_RANK[a] - LEVEL_RANK[b]) <= 1;
}

function matchIdFor(uidA, uidB) {
    return uidA < uidB ? uidA + '_' + uidB : uidB + '_' + uidA;
}

function blockedEither(left, right, leftUid, rightUid) {
    const a = left && Array.isArray(left.blockedUsers) ? left.blockedUsers : [];
    const b = right && Array.isArray(right.blockedUsers) ? right.blockedUsers : [];
    return a.indexOf(rightUid) !== -1 || b.indexOf(leftUid) !== -1;
}

function timestampMs(value) {
    if (value == null) return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value.toMillis === 'function') {
        const ms = value.toMillis();
        return Number.isFinite(ms) ? ms : 0;
    }
    if (typeof value === 'object') {
        const seconds = value._seconds != null ? value._seconds : value.seconds;
        if (typeof seconds === 'number') return seconds * 1000;
    }
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}

function freshJoined(ms, now) {
    return ms > 0 && now - ms < POOL_TTL_MS;
}

function rateDecision(rate, now) {
    const src = rate || {};
    const last = Number(src.lastMs) || 0;
    const day = offsetDateKey(now);
    const count = src.day === day ? (Number(src.count) || 0) : 0;
    if (last && now - last < RATE_MS) {
        return { ok: false, code: 'rate', message: 'Please wait a few seconds before trying again.', day: day, count: count, lastMs: last };
    }
    if (count >= RATE_DAILY_MAX) {
        return { ok: false, code: 'rate-day', message: 'You have tried Find a Bitcoin Buddy too many times today. Try again tomorrow.', day: day, count: count, lastMs: last };
    }
    return { ok: true, day: day, count: count + 1, lastMs: now };
}

function candidateFrom(docId, data, user, me, now) {
    const row = data || {};
    const uid = typeof row.uid === 'string' && row.uid ? row.uid : docId;
    const joined = Number(row.joinedAtMs) || timestampMs(row.joinedAt);
    return {
        id: docId,
        uid: uid,
        level: row.level,
        goal: row.goal,
        intro: plainText(row.intro, 200),
        username: profileUsername(user) || plainText(row.username, 40),
        joinedAtMs: joined,
        waitedMs: joined ? Math.max(0, now - joined) : 0,
        fresh: freshJoined(joined, now),
        user: user || null,
    };
}

function usableCandidate(row, me) {
    if (!row || !row.uid || row.uid === me.uid) return false;
    if (!UID_RE.test(row.uid)) return false;
    if (!row.fresh) return false;
    if (!GOALS.includes(row.goal) || row.goal === me.goal) return false;
    if (!LEVELS.includes(row.level)) return false;
    if (!row.username) return false;
    if (!row.user) return false;
    if (rewardBlocked(row.user, null)) return false;
    if (accountLocked(row.user) || accountLocked(me.user)) return false;
    if (row.user.activeBuddyId && row.matchStillThere !== false) return false;
    if (blockedEither(me.user, row.user, me.uid, row.uid)) return false;
    if (hasEndedPair(me.user, row.uid) || hasEndedPair(row.user, me.uid)) return false;
    return true;
}

function hasEndedPair(user, uid) {
    const list = user && Array.isArray(user.endedBuddyUids) ? user.endedBuddyUids : [];
    return list.indexOf(uid) !== -1;
}

function clampBuddyChoice(level, goal) {
    const lv = typeof level === 'string' ? level.trim().toLowerCase() : '';
    const gl = typeof goal === 'string' ? goal.trim().toLowerCase() : '';
    const levelOut = LEVELS.includes(lv) ? lv : 'beginner';
    let goalOut = gl;
    if (goalOut === 'mentor') goalOut = 'learn';
    if (goalOut === 'teacher') goalOut = 'teach';
    if (!GOALS.includes(goalOut)) {
        return { level: levelOut, goal: '', error: buddyError('goal', 'Choose Learn or Teach.') };
    }
    return { level: levelOut, goal: goalOut, error: null };
}

// Oldest complementary buddy. Same or adjacent level wins. A candidate who
// has already waited 24 hours can match any level.
function pickPartner(candidates, me) {
    const usable = (candidates || []).filter(function (row) { return usableCandidate(row, me); });
    usable.sort(function (a, b) { return a.joinedAtMs - b.joinedAtMs; });
    const near = usable.filter(function (row) { return adjacentLevel(me.level, row.level); });
    if (near.length) return near[0];
    const aged = usable.filter(function (row) { return row.waitedMs >= LEVEL_FALLBACK_MS; });
    return aged[0] || null;
}

// Learn pairs with teach only. Each person is used once. Stale rows are
// listed for expiry and are not paired. A past ended buddy is skipped.
function planPoolMatches(rows) {
    const list = [];
    const expired = [];
    (rows || []).forEach(function (row) {
        if (!row || !row.uid) return;
        if (!row.fresh) {
            expired.push(row.uid);
            return;
        }
        if (row.banned || row.locked) return;
        list.push(row);
    });
    const used = {};
    const pairs = [];
    const learners = list.filter(function (row) { return row.goal === 'learn'; })
        .sort(function (a, b) { return (a.joinedAtMs || 0) - (b.joinedAtMs || 0); });
    learners.forEach(function (learner) {
        if (used[learner.uid]) return;
        const teachers = list.filter(function (row) {
            if (row.goal !== 'teach' || used[row.uid] || row.uid === learner.uid) return false;
            if (hasEndedPair(learner.user, row.uid) || hasEndedPair(row.user, learner.uid)) return false;
            if (blockedEither(learner.user, row.user, learner.uid, row.uid)) return false;
            return true;
        });
        const partner = pickPartner(teachers, {
            uid: learner.uid,
            level: learner.level,
            goal: learner.goal,
            user: learner.user,
        });
        if (!partner) return;
        used[learner.uid] = true;
        used[partner.uid] = true;
        pairs.push({ a: learner.uid, b: partner.uid, aId: learner.id || learner.uid, bId: partner.id || partner.uid });
    });
    return { pairs: pairs, expired: expired };
}

function planFindNewBuddy(input) {
    const now = Number(input && input.now) || 0;
    const last = Number(input && input.rematchAt) || 0;
    if (last && now - last < REMATCH_MS) {
        return { error: buddyError('rematch', 'You can find a new buddy again tomorrow.') };
    }
    const choice = clampBuddyChoice(input && input.level, input && input.goal);
    if (choice.error) return { error: choice.error };
    if (!input || !input.matchId) {
        return { error: buddyError('none', "You don't have a Bitcoin Buddy to end.") };
    }
    return { level: choice.level, goal: choice.goal, matchId: input.matchId, rematchAt: now };
}

function icebreakerFor(id) {
    let n = 0;
    const s = String(id || '');
    for (let i = 0; i < s.length; i++) n = (n + s.charCodeAt(i)) % ICEBREAKERS.length;
    return ICEBREAKERS[n];
}

function side(uid, username, level, goal, intro) {
    return {
        uid: uid,
        username: username,
        level: level,
        goal: goal,
        intro: plainText(intro, 200),
    };
}

function welcomeText(user1, user2) {
    const learner = user1.goal === 'learn' ? user1 : user2;
    const teacher = user1.goal === 'teach' ? user1 : user2;
    const lines = [
        "It's a match. Welcome to your Bitcoin Buddy conversation.",
        '',
        'Teacher: @' + teacher.username,
        'Learner: @' + learner.username + ' (' + levelLabel(learner.level) + ')',
    ];
    if (learner.intro) lines.push('', learner.username + ' wants to learn about: ' + learner.intro);
    if (teacher.intro) lines.push(teacher.username + ' says: ' + teacher.intro);
    lines.push('', 'A place to start: ' + icebreakerFor(matchIdFor(user1.uid, user2.uid)));
    lines.push('', "I'm Nacho. Be kind, and keep your keys and seed words to yourself.");
    return lines.join('\n');
}

function notice(uid, message, targetId) {
    return {
        recipientId: uid,
        senderId: 'system',
        senderName: 'Bitcoin Quest',
        type: 'buddy',
        message: plainText(message, 180),
        targetType: 'buddy',
        targetId: targetId && targetId.length <= 64 ? targetId : null,
        read: false,
    };
}

function publicSide(sideRow) {
    return {
        uid: sideRow.uid,
        username: sideRow.username,
        level: sideRow.level,
        goal: sideRow.goal,
        intro: sideRow.intro || '',
    };
}

function publicMatch(id, data, uid, matchedAtMs) {
    const user1 = data.user1 || {};
    const user2 = data.user2 || {};
    const me = user1.uid === uid ? user1 : user2;
    const buddy = user1.uid === uid ? user2 : user1;
    return {
        id: id,
        matchedAtMs: matchedAtMs || timestampMs(data.matchedAtMs) || timestampMs(data.matchedAt),
        me: publicSide(me),
        buddy: publicSide(buddy),
    };
}

function validateRequest(level, goal) {
    if (!LEVELS.includes(level)) {
        return buddyError('level', 'Pick Beginner, Intermediate, or Advanced.');
    }
    if (!GOALS.includes(goal)) {
        return buddyError('goal', 'Choose Learn or Teach.');
    }
    return null;
}

function buildMatchPlan(input) {
    const now = input.now;
    const uid = input.uid;
    const level = input.level;
    const goal = input.goal;
    const intro = plainText(input.intro, 200);
    const invalid = validateRequest(level, goal);
    if (invalid) return { error: invalid };
    if (!UID_RE.test(uid)) return { error: buddyError('account', 'This account cannot use Find a Bitcoin Buddy.') };
    const user = input.user;
    if (!user) return { error: buddyError('profile', 'Set a username before finding a Bitcoin Buddy.') };
    if (accountLocked(user)) {
        return { error: buddyError('locked', 'Your account is under review.') };
    }
    if (rewardBlocked(user, input.ledger || null)) {
        return { error: buddyError('banned', "Buddy matching isn't available on this account.") };
    }
    const username = profileUsername(user);
    if (!username) return { error: buddyError('profile', 'Set a username before finding a Bitcoin Buddy.') };

    const rate = input.skipRate
        ? { ok: true, day: offsetDateKey(now), count: Number(input.rate && input.rate.count) || 0, lastMs: Number(input.rate && input.rate.lastMs) || 0 }
        : rateDecision(input.rate, now);
    if (!rate.ok) return { error: buddyError(rate.code, rate.message) };

    const me = { uid: uid, level: level, goal: goal, intro: intro, username: username, user: user };
    const active = input.activeMatch;
    if (active && active.exists && active.data && (active.data.user1 || {}).uid && (active.data.user2 || {}).uid) {
        const participants = [active.data.user1.uid, active.data.user2.uid];
        if (participants.indexOf(uid) !== -1 && active.data.ended !== true) {
            return {
        status: 'matched',
        created: false,
        clearStaleActive: false,
        matchId: active.id,
                match: publicMatch(active.id, active.data, uid, timestampMs(active.data.matchedAtMs)),
                rate: rate,
            };
        }
    }

    const partner = pickPartner(input.candidates || [], me);
    const rateWrite = { lastMs: rate.lastMs, day: rate.day, count: rate.count, uid: uid };

    if (!partner) {
        const existingMs = input.ownPool && freshJoined(Number(input.ownPool.joinedAtMs) || timestampMs(input.ownPool.joinedAt), now)
            ? (Number(input.ownPool.joinedAtMs) || timestampMs(input.ownPool.joinedAt))
            : now;
        return {
            status: 'waiting',
            created: false,
            clearStaleActive: !!input.staleActiveId,
            rate: rate,
            rateWrite: rateWrite,
            pool: {
                uid: uid,
                username: username,
                level: level,
                goal: goal,
                intro: intro,
                joinedAtMs: existingMs,
                expiresAtMs: existingMs + POOL_TTL_MS,
            },
        };
    }

    const id = matchIdFor(uid, partner.uid);
    const leftUid = uid < partner.uid ? uid : partner.uid;
    const left = leftUid === uid ? me : partner;
    const right = leftUid === uid ? partner : me;
    const user1 = side(left.uid, left.username, left.level, left.goal, left.intro);
    const user2 = side(right.uid, right.username, right.level, right.goal, right.intro);
    const welcome = welcomeText(user1, user2);
    const match = {
        user1: user1,
        user2: user2,
        participants: [user1.uid, user2.uid],
        matchedAtMs: now,
        status: 'active',
        spoke: {},
        humanMessages: 0,
        convoId: id,
    };
    return {
        status: 'matched',
        created: true,
        clearStaleActive: !!input.staleActiveId,
        matchId: id,
        match: publicMatch(id, match, uid, now),
        storedMatch: match,
        welcome: welcome,
        partnerUid: partner.uid,
        partnerPoolId: partner.id,
        rate: rate,
        rateWrite: rateWrite,
        notices: [
            notice(uid, 'You have a Bitcoin Buddy. Open Find a Bitcoin Buddy to say hello.', id),
            notice(partner.uid, 'You have a Bitcoin Buddy. Open Find a Bitcoin Buddy to say hello.', id),
        ],
    };
}

function hasHumanMessage(match) {
    const spoke = match && match.spoke;
    if (!spoke || typeof spoke !== 'object') return (Number(match && match.humanMessages) || 0) > 0;
    return Object.keys(spoke).some(function (key) {
        return key && key !== NACHO_UID && spoke[key];
    }) || (Number(match.humanMessages) || 0) > 0;
}

function planBuddyXp(input) {
    const msg = input.message || {};
    const sender = String(input.senderUid || '');
    const convo = input.convo || null;
    if (!convo || convo.isBuddyMatch !== true) return { skip: 'not-buddy', awards: [] };
    if (!sender || sender === NACHO_UID || msg.isNachoAuto === true || msg.senderUid === NACHO_UID) {
        return { skip: 'bot', awards: [] };
    }
    const participants = matchPair(input.match);
    const convoId = String(input.convoId || '');
    if (!participants || convoId !== matchIdFor(participants[0], participants[1])) {
        return { skip: 'convo-id', awards: [] };
    }
    if (participants.indexOf(sender) === -1) return { skip: 'not-participant', awards: [] };
    const match = input.match || {};
    if (input.priorLedger === true || match.pairXpClosed === true) {
        return { skip: 'pair-paid', awards: [] };
    }
    const senderUser = (input.users && input.users[sender]) || {};
    if (accountLocked(senderUser)) return { skip: 'locked', awards: [] };
    if (rewardBlocked(senderUser, (input.ledgers && input.ledgers[sender]) || null)) {
        return { skip: 'banned', awards: [] };
    }
    const text = typeof msg.text === 'string' ? msg.text.trim() : '';
    const image = typeof msg.imageUrl === 'string' && /^https:\/\//.test(msg.imageUrl);
    if (!text && !image) return { skip: 'empty', awards: [] };
    const messageId = String(input.messageId || '');
    const recent = recentMessageIds(match);
    if (messageId && recent.indexOf(messageId) !== -1) {
        return { skip: 'seen', awards: [], spoke: match.spoke || {}, recentIds: recent.slice(-SEEN_CAP) };
    }
    if (messageId) recent.push(messageId);
    const spoke = Object.assign({}, match.spoke || {});
    spoke[sender] = true;
    const both = participants.length >= 2 && participants.every(function (id) { return spoke[id] === true; });
    const awards = [];
    if (both) {
        participants.forEach(function (id) {
            if (!id || id === NACHO_UID) return;
            if (match.xpPaid && match.xpPaid[id]) return;
            const person = (input.users && input.users[id]) || {};
            if (rewardBlocked(person, (input.ledgers && input.ledgers[id]) || null)) return;
            const at = Number(person.buddyXpGrantedAt) || 0;
            if (at && input.now - at < XP_WINDOW_MS) return;
            awards.push({ uid: id, amount: BUDDY_XP });
        });
    }
    return { skip: '', spoke: spoke, recentIds: recent.slice(-SEEN_CAP), awards: awards };
}

function recentMessageIds(match) {
    const src = match || {};
    let list = [];
    if (Array.isArray(src.recentMessageIds)) {
        list = src.recentMessageIds.filter(function (id) { return typeof id === 'string' && id; });
    } else if (src.seenMessages && typeof src.seenMessages === 'object') {
        list = Object.keys(src.seenMessages);
    }
    if (list.length > SEEN_CAP) list = list.slice(-SEEN_CAP);
    return list;
}

function poolExpired(data, now) {
    const row = data || {};
    const hasMs = row.joinedAtMs != null && row.joinedAtMs !== '';
    const hasTs = row.joinedAt != null && row.joinedAt !== '';
    if (!hasMs && !hasTs) return true;
    const joined = Number(row.joinedAtMs) || timestampMs(row.joinedAt);
    if (!joined) return true;
    return now - joined >= POOL_TTL_MS;
}

function pointerIsDangling(activeId, matchExists) {
    return typeof activeId === 'string' && activeId.length > 0 && matchExists === false;
}

function pairList(list) {
    if (!Array.isArray(list) || list.length !== 2) return null;
    const copy = [String(list[0] || ''), String(list[1] || '')];
    if (!copy[0] || !copy[1] || copy[0] === copy[1]) return null;
    copy.sort();
    return copy;
}

function samePair(left, right) {
    const a = pairList(left);
    const b = pairList(right);
    if (!a || !b) return false;
    return a[0] === b[0] && a[1] === b[1];
}

function matchPair(match) {
    const src = match || {};
    if (src.user1 && src.user2 && src.user1.uid && src.user2.uid) {
        return pairList([src.user1.uid, src.user2.uid]);
    }
    return pairList(src.participants);
}

// Small merge only when the existing conversation is already this exact pair.
// Anything else is replaced so a pre-created doc cannot keep a third person.
function convoPatch(existingData, full) {
    const pair = full && full.participants;
    if (existingData && samePair(existingData.participants, pair)) {
        return {
            overwrite: false,
            data: { isBuddyMatch: true, buddyMatchId: full.buddyMatchId },
        };
    }
    return { overwrite: true, data: full };
}

function outsiderSender(sender, pair) {
    if (sender === NACHO_UID) return false;
    const list = pairList(pair);
    if (!list || !sender) return true;
    return list.indexOf(String(sender)) === -1;
}

function matchExpired(data, now) {
    if (!data || data.ended === true) return false;
    const at = Number(data.matchedAtMs) || timestampMs(data.matchedAt);
    if (!at || now - at < MATCH_QUIET_MS) return false;
    return !hasHumanMessage(data);
}

function aprilWindow(ms) {
    return ms >= Date.parse('2026-04-01T00:00:00Z') && ms < Date.parse('2026-05-01T00:00:00Z');
}

function emptyBuddyMessages(messages) {
    const list = messages || [];
    return !list.some(function (msg) {
        if (!msg) return false;
        const sender = String(msg.senderUid || '');
        if (!sender || sender === NACHO_UID || msg.isNachoAuto === true) return false;
        return true;
    });
}

function docsOf(snap) {
    const docs = [];
    if (!snap) return docs;
    if (typeof snap.forEach === 'function') snap.forEach(function (doc) { docs.push(doc); });
    else if (snap.docs) docs.push.apply(docs, snap.docs);
    return docs;
}

function cheapPoolRow(doc, meUid, now) {
    const data = doc.data() || {};
    const uid = typeof data.uid === 'string' && data.uid ? data.uid : doc.id;
    if (!uid || uid === meUid || !UID_RE.test(uid)) return null;
    if (!GOALS.includes(data.goal)) return null;
    const row = candidateFrom(doc.id, data, null, { uid: meUid }, now);
    if (!row.fresh || !LEVELS.includes(row.level)) return null;
    return row;
}

async function attachUser(tx, db, row, now) {
    const userSnap = await tx.get(db.collection('users').doc(row.uid));
    const user = userSnap && userSnap.exists ? (userSnap.data() || {}) : null;
    const activeId = user && typeof user.activeBuddyId === 'string' ? user.activeBuddyId : '';
    let matchStillThere = false;
    if (activeId && activeId.indexOf('/') === -1 && activeId.length <= 700) {
        const matchSnap = await tx.get(db.collection('buddy_matches').doc(activeId));
        matchStillThere = !!(matchSnap && matchSnap.exists);
    }
    const joined = row.joinedAtMs;
    return {
        row: Object.assign({}, row, {
            user: user,
            matchStillThere: activeId ? matchStillThere : false,
            waitedMs: joined ? Math.max(0, now - joined) : 0,
            fresh: freshJoined(joined, now),
        }),
        clearUid: pointerIsDangling(activeId, matchStillThere) ? row.uid : '',
    };
}

async function scanPoolQuery(tx, db, queryForPage, me, now, state) {
    let last = null;
    for (let page = 0; page < POOL_PAGES && !state.near; page++) {
        let query = queryForPage();
        if (last) query = query.startAfter(last);
        const snap = await tx.get(query.limit(POOL_PAGE));
        const docs = docsOf(snap);
        if (!docs.length) break;
        last = docs[docs.length - 1];
        for (let i = 0; i < docs.length; i++) {
            const cheap = cheapPoolRow(docs[i], me.uid, now);
            if (!cheap || cheap.goal === me.goal) continue;
            if (state.seen[cheap.id]) continue;
            state.seen[cheap.id] = true;
            const attached = await attachUser(tx, db, cheap, now);
            if (attached.clearUid) state.clears.push(attached.clearUid);
            const row = attached.row;
            if (!usableCandidate(row, me)) continue;
            if (adjacentLevel(me.level, row.level)) {
                state.near = row;
                return;
            }
            if (!state.aged && row.waitedMs >= LEVEL_FALLBACK_MS) state.aged = row;
        }
        if (docs.length < POOL_PAGE) break;
    }
}

async function readCandidates(tx, db, me, now) {
    const state = { near: null, aged: null, clears: [], seen: {} };
    await scanPoolQuery(tx, db, function () {
        return db.collection('buddy_pool').orderBy('joinedAtMs', 'asc');
    }, me, now, state);
    if (!state.near) {
        await scanPoolQuery(tx, db, function () {
            return db.collection('buddy_pool').orderBy('joinedAt', 'asc');
        }, me, now, state);
    }
    const rows = [];
    if (state.near) rows.push(state.near);
    else if (state.aged) rows.push(state.aged);
    return { rows: rows, clears: state.clears };
}

function stageEndMatch(tx, db, admin, matchId, match, uid, ts) {
    const ids = [match.user1 && match.user1.uid, match.user2 && match.user2.uid].filter(Boolean);
    const partner = ids.filter(function (id) { return id !== uid; })[0] || '';
    tx.set(db.collection('buddy_matches').doc(matchId), {
        ended: true,
        endedAt: ts,
        endedBy: uid,
        status: 'ended',
    }, { merge: true });
    ids.forEach(function (personUid) {
        const other = ids.filter(function (id) { return id !== personUid; })[0] || '';
        const patch = { activeBuddyId: admin.firestore.FieldValue.delete() };
        if (other) patch.endedBuddyUids = admin.firestore.FieldValue.arrayUnion(other);
        if (personUid === uid) patch.buddyRematchAt = Date.now();
        tx.set(db.collection('users').doc(personUid), patch, { merge: true });
    });
    if (partner) {
        tx.set(db.collection('notifications').doc('buddy_end_' + matchId + '_' + partner), Object.assign({},
            notice(partner, 'Your Bitcoin Buddy match has ended.', null),
            { createdAt: ts }
        ));
    }
    return { partner: partner, ids: ids };
}

async function requestInTransaction(tx, db, admin, input) {
    const uid = input.uid;
    const now = input.now;
    const userRef = db.collection('users').doc(uid);
    const rateRef = db.collection('buddy_rate').doc(uid);
    const poolRef = db.collection('buddy_pool').doc(uid);
    const userSnap = await tx.get(userRef);
    const rateSnap = await tx.get(rateRef);
    const poolSnap = await tx.get(poolRef);
    const ledgerSnap = await tx.get(db.collection('faucet_ledger').doc(uid));
    const user = userSnap && userSnap.exists ? (userSnap.data() || {}) : null;
    if (input.skipRate && !(poolSnap && poolSnap.exists)) {
        return { status: 'left', created: false };
    }
    if (!input.skipRate && !input.replaceMatch) {
        const rematchAt = Number(user && user.buddyRematchAt) || 0;
        if (rematchAt && now - rematchAt < REMATCH_MS) {
            throw buddyError('rematch', 'You can find a new buddy again tomorrow.');
        }
    }
    const activeId = user && typeof user.activeBuddyId === 'string' ? user.activeBuddyId : '';
    let activeMatch = null;
    let endActive = null;
    let staleActiveId = '';
    if (activeId && activeId.indexOf('/') === -1 && activeId.length <= 700) {
        const matchSnap = await tx.get(db.collection('buddy_matches').doc(activeId));
        if (matchSnap && matchSnap.exists) {
            activeMatch = { id: activeId, exists: true, data: matchSnap.data() || {} };
        } else {
            staleActiveId = activeId;
        }
    }
    let skipRate = input.skipRate === true;
    if (input.replaceMatch) {
        const gate = planFindNewBuddy({
            now: now,
            rematchAt: user && user.buddyRematchAt,
            level: input.level,
            goal: input.goal,
            matchId: activeMatch && activeMatch.data && activeMatch.data.ended !== true ? activeMatch.id : '',
        });
        if (gate.error) throw gate.error;
        endActive = activeMatch;
        activeMatch = null;
        skipRate = true;
    }
    const found = await readCandidates(tx, db, { uid: uid, level: input.level, goal: input.goal }, now);
    const plan = buildMatchPlan({
        uid: uid,
        level: input.level,
        goal: input.goal,
        intro: input.intro,
        now: now,
        user: user,
        ledger: ledgerSnap && ledgerSnap.exists ? (ledgerSnap.data() || {}) : null,
        rate: rateSnap && rateSnap.exists ? (rateSnap.data() || {}) : null,
        ownPool: poolSnap && poolSnap.exists ? (poolSnap.data() || {}) : null,
        activeMatch: activeMatch,
        staleActiveId: staleActiveId,
        candidates: found.rows,
        skipRate: skipRate,
    });
    if (plan.error) throw plan.error;

    let convoWrite = null;
    const outsiderRefs = [];
    if (plan.status === 'matched' && plan.created) {
        const convoRef = db.collection('dm_conversations').doc(plan.matchId);
        const convoSnap = await tx.get(convoRef);
        const names = {};
        names[plan.storedMatch.user1.uid] = plan.storedMatch.user1.username;
        names[plan.storedMatch.user2.uid] = plan.storedMatch.user2.username;
        convoWrite = convoPatch(convoSnap && convoSnap.exists ? (convoSnap.data() || {}) : null, {
            participants: plan.storedMatch.participants,
            participantNames: names,
            isBuddyMatch: true,
            buddyMatchId: plan.matchId,
            createdAt: true,
            lastMessage: plan.welcome.slice(0, 100),
            lastMessageTime: true,
            lastSenderUid: NACHO_UID,
        });
        if (convoWrite.overwrite && convoSnap && convoSnap.exists) {
            const msgSnap = await tx.get(convoRef.collection('messages').limit(100));
            docsOf(msgSnap).forEach(function (doc) {
                const senderUid = (doc.data() || {}).senderUid;
                if (outsiderSender(senderUid, plan.storedMatch.participants)) outsiderRefs.push(doc.ref);
            });
        }
    }

    const ts = admin.firestore.FieldValue.serverTimestamp();
    if (endActive && endActive.data) {
        stageEndMatch(tx, db, admin, endActive.id, endActive.data, uid, ts);
    }
    if (input.replaceMatch) {
        tx.set(userRef, { buddyRematchAt: now }, { merge: true });
    }
    if (!skipRate) tx.set(rateRef, plan.rateWrite || {
        lastMs: plan.rate.lastMs,
        day: plan.rate.day,
        count: plan.rate.count,
        uid: uid,
    }, { merge: true });

    if (plan.status === 'matched' && plan.created) {
        const matchRef = db.collection('buddy_matches').doc(plan.matchId);
        const convoRef = db.collection('dm_conversations').doc(plan.matchId);
        tx.delete(poolRef);
        if (plan.partnerPoolId) tx.delete(db.collection('buddy_pool').doc(plan.partnerPoolId));
        tx.set(matchRef, Object.assign({}, plan.storedMatch, { matchedAt: ts }));
        const written = Object.assign({}, convoWrite.data);
        if (written.createdAt === true) written.createdAt = ts;
        if (written.lastMessageTime === true) written.lastMessageTime = ts;
        if (convoWrite.overwrite) tx.set(convoRef, written);
        else tx.set(convoRef, written, { merge: true });
        outsiderRefs.forEach(function (ref) { tx.delete(ref); });
        tx.set(convoRef.collection('messages').doc('welcome'), {
            senderUid: NACHO_UID,
            senderName: 'Nacho',
            text: plan.welcome,
            createdAt: ts,
            isNachoAuto: true,
        });
        plan.notices.forEach(function (note, index) {
            const who = plan.storedMatch.participants[index] || note.recipientId;
            tx.set(db.collection('notifications').doc('buddy_match_' + plan.matchId + '_' + who), Object.assign({}, note, { createdAt: ts }));
        });
        plan.storedMatch.participants.forEach(function (personUid) {
            tx.set(db.collection('users').doc(personUid), {
                activeBuddyId: plan.matchId,
                buddyMatchCount: admin.firestore.FieldValue.increment(1),
            }, { merge: true });
        });
    } else if (plan.status === 'waiting') {
        tx.set(poolRef, Object.assign({}, plan.pool, { joinedAt: ts }));
    }
    if (plan.clearStaleActive && !(plan.status === 'matched' && plan.created)) {
        tx.set(userRef, { activeBuddyId: admin.firestore.FieldValue.delete() }, { merge: true });
    }
    const keep = plan.storedMatch ? plan.storedMatch.participants : [uid];
    (found.clears || []).forEach(function (personUid) {
        if (!personUid || keep.indexOf(personUid) !== -1) return;
        tx.set(db.collection('users').doc(personUid), {
            activeBuddyId: admin.firestore.FieldValue.delete(),
        }, { merge: true });
    });
    return plan;
}

function mapBuddyError(err, HttpsError) {
    if (!err) return new HttpsError('internal', 'Buddy matching is unavailable right now. Try again shortly.');
    if (err.buddyCode === 'rate' || err.buddyCode === 'rate-day') {
        return new HttpsError('resource-exhausted', err.message);
    }
    if (err.buddyCode === 'level' || err.buddyCode === 'goal') {
        return new HttpsError('invalid-argument', err.message);
    }
    if (err.buddyCode === 'profile' || err.buddyCode === 'banned' || err.buddyCode === 'account' || err.buddyCode === 'none' || err.buddyCode === 'locked' || err.buddyCode === 'rematch') {
        return new HttpsError('failed-precondition', err.message);
    }
    if (err.code && typeof err.code === 'string' && err.message && err.httpErrorCode) return err;
    return new HttpsError('internal', 'Buddy matching is unavailable right now. Try again shortly.');
}

function requireUser(context, HttpsError) {
    if (!context || !context.auth || !context.auth.uid) {
        throw new HttpsError('unauthenticated', 'Sign in to find a Bitcoin Buddy.');
    }
    const provider = context.auth.token && context.auth.token.firebase
        ? context.auth.token.firebase.sign_in_provider
        : '';
    if (provider === 'anonymous') {
        throw new HttpsError('failed-precondition', 'Create an account before finding a Bitcoin Buddy.');
    }
    if (!UID_RE.test(context.auth.uid)) {
        throw new HttpsError('failed-precondition', 'This account cannot use Find a Bitcoin Buddy.');
    }
    return context.auth.uid;
}

function createBuddyHandlers(deps) {
    const admin = deps.admin;
    const db = deps.db;
    const HttpsError = deps.HttpsError;

    async function requestBuddyMatch(data, context) {
        const uid = requireUser(context, HttpsError);
        const choice = clampBuddyChoice(data && data.level, data && data.goal);
        if (choice.error) throw mapBuddyError(choice.error, HttpsError);
        let plan;
        try {
            plan = await db.runTransaction(function (tx) {
                return requestInTransaction(tx, db, admin, {
                    uid: uid,
                    level: choice.level,
                    goal: choice.goal,
                    intro: data && data.intro,
                    now: Date.now(),
                });
            });
        } catch (err) {
            if (err && err.buddyCode) throw mapBuddyError(err, HttpsError);
            console.warn('[requestBuddyMatch]', err && err.message ? err.message : err);
            throw new HttpsError('unavailable', "Couldn't reach buddy matching. Try again shortly.");
        }
        if (plan.created && plan.storedMatch) {
            const people = plan.storedMatch.participants || [];
            for (let i = 0; i < people.length; i++) {
                try { await grantFamily(db, admin, people[i], ['dm_buddy']); }
                catch (grantErr) { console.warn('[requestBuddyMatch] badge', grantErr && grantErr.message); }
            }
        }
        if (plan.status === 'waiting') {
            return {
                status: 'waiting',
                pool: plan.pool,
            };
        }
        return {
            status: 'matched',
            created: plan.created === true,
            match: plan.match,
        };
    }

    async function leaveBuddyPool(data, context) {
        const uid = requireUser(context, HttpsError);
        try {
            const ref = db.collection('buddy_pool').doc(uid);
            const snap = await ref.get();
            if (!snap.exists) return { status: 'left', removed: false };
            const dataRow = snap.data() || {};
            if (dataRow.uid && dataRow.uid !== uid) {
                throw new HttpsError('permission-denied', 'That pool entry is not yours.');
            }
            await ref.delete();
            return { status: 'left', removed: true };
        } catch (err) {
            if (err && err.httpErrorCode) throw err;
            throw new HttpsError('unavailable', "Couldn't leave the buddy pool. Try again shortly.");
        }
    }

    async function endBuddy(data, context) {
        const uid = requireUser(context, HttpsError);
        const requested = data && typeof data.matchId === 'string' ? data.matchId : '';
        try {
            const result = await db.runTransaction(async function (tx) {
                const userRef = db.collection('users').doc(uid);
                const userSnap = await tx.get(userRef);
                const user = userSnap && userSnap.exists ? (userSnap.data() || {}) : {};
                const matchId = requested || (typeof user.activeBuddyId === 'string' ? user.activeBuddyId : '');
                if (!matchId || matchId.indexOf(uid) === -1) {
                    throw buddyError('none', "You don't have a Bitcoin Buddy to end.");
                }
                const matchRef = db.collection('buddy_matches').doc(matchId);
                const matchSnap = await tx.get(matchRef);
                if (!matchSnap.exists) {
                    tx.set(userRef, { activeBuddyId: admin.firestore.FieldValue.delete() }, { merge: true });
                    return { missing: true };
                }
                const match = matchSnap.data() || {};
                const ids = [match.user1 && match.user1.uid, match.user2 && match.user2.uid].filter(Boolean);
                if (ids.indexOf(uid) === -1) throw buddyError('none', "You don't have a Bitcoin Buddy to end.");
                if (match.ended === true) {
                    tx.set(userRef, { activeBuddyId: admin.firestore.FieldValue.delete() }, { merge: true });
                    return { matchId: matchId, already: true };
                }
                const ts = admin.firestore.FieldValue.serverTimestamp();
                const ended = stageEndMatch(tx, db, admin, matchId, match, uid, ts);
                return { matchId: matchId, partner: ended.partner };
            });
            if (result && result.missing) {
                throw new HttpsError('failed-precondition', 'That buddy match is already over.');
            }
            return { status: 'ended', matchId: result.matchId };
        } catch (err) {
            if (err && err.buddyCode) throw mapBuddyError(err, HttpsError);
            if (err && err.httpErrorCode) throw err;
            throw new HttpsError('unavailable', "Couldn't end that buddy match. Try again shortly.");
        }
    }

    async function pageDocs(collectionName) {
        const out = [];
        let last = null;
        for (let page = 0; page < 8; page++) {
            let query = db.collection(collectionName).orderBy(admin.firestore.FieldPath.documentId()).limit(200);
            if (last) query = query.startAfter(last);
            const snap = await query.get();
            const docs = snap.docs || [];
            if (!docs.length) break;
            out.push.apply(out, docs);
            last = docs[docs.length - 1];
            if (docs.length < 200) break;
        }
        return out;
    }

    async function sweepStaleBuddies() {
        const now = Date.now();
        let poolRemoved = 0;
        let matchesRemoved = 0;
        let pointersCleared = 0;
        try {
            const poolDocs = await pageDocs('buddy_pool');
            for (let i = 0; i < poolDocs.length; i++) {
                const doc = poolDocs[i];
                const row = doc.data() || {};
                if (!poolExpired(row, now)) continue;
                const who = row.uid || doc.id;
                await doc.ref.delete();
                poolRemoved++;
                if (UID_RE.test(who)) {
                    await db.collection('notifications').doc('buddy_expire_pool_' + who).set(Object.assign({},
                        notice(who, 'Your Find a Bitcoin Buddy request expired after 7 days. You can start a new one.', null),
                        { createdAt: admin.firestore.FieldValue.serverTimestamp() }
                    ));
                }
            }
        } catch (err) {
            console.warn('[sweepStaleBuddies] pool', err && err.message);
        }
        try {
            const docs = await pageDocs('buddy_matches');
            for (let i = 0; i < docs.length; i++) {
                const doc = docs[i];
                const row = doc.data() || {};
                if (!matchExpired(row, now)) continue;
                const ids = [row.user1 && row.user1.uid, row.user2 && row.user2.uid].filter(Boolean);
                await doc.ref.delete();
                matchesRemoved++;
                for (let p = 0; p < ids.length; p++) {
                    const person = ids[p];
                    if (!UID_RE.test(person)) continue;
                    const userRef = db.collection('users').doc(person);
                    const userSnap = await userRef.get();
                    if (userSnap.exists && userSnap.get('activeBuddyId') === doc.id) {
                        await userRef.set({ activeBuddyId: admin.firestore.FieldValue.delete() }, { merge: true });
                    }
                    await db.collection('notifications').doc('buddy_expire_match_' + doc.id + '_' + person).set(Object.assign({},
                        notice(person, 'Your Bitcoin Buddy match ended after 30 days with no messages.', null),
                        { createdAt: admin.firestore.FieldValue.serverTimestamp() }
                    ));
                }
            }
        } catch (err) {
            console.warn('[sweepStaleBuddies] matches', err && err.message);
        }
        try {
            let last = null;
            for (let page = 0; page < 5; page++) {
                let query = db.collection('users').where('activeBuddyId', '>', '').orderBy('activeBuddyId').limit(100);
                if (last) query = query.startAfter(last);
                const snap = await query.get();
                const docs = snap.docs || [];
                if (!docs.length) break;
                last = docs[docs.length - 1];
                for (let i = 0; i < docs.length; i++) {
                    const activeId = docs[i].get('activeBuddyId');
                    if (!pointerIsDangling(activeId, false)) continue;
                    if (typeof activeId !== 'string' || activeId.indexOf('/') !== -1) continue;
                    const matchSnap = await db.collection('buddy_matches').doc(activeId).get();
                    if (matchSnap.exists) continue;
                    await docs[i].ref.set({ activeBuddyId: admin.firestore.FieldValue.delete() }, { merge: true });
                    pointersCleared++;
                }
                if (docs.length < 100) break;
            }
        } catch (err) {
            console.warn('[sweepStaleBuddies] pointers', err && err.message);
        }
        console.log('[sweepStaleBuddies] pool=' + poolRemoved + ' matches=' + matchesRemoved + ' pointers=' + pointersCleared);
        return null;
    }

    async function onBuddyDmXp(event) {
        const snap = event && event.data;
        if (!snap) return null;
        const message = snap.data() || {};
        const messageId = event.params && event.params.mid;
        const convoId = event.params && event.params.cid;
        const sender = String(message.senderUid || '');
        if (!convoId || !messageId) return null;
        if (!sender || sender === NACHO_UID || message.isNachoAuto === true) return null;
        const convoRef = db.collection('dm_conversations').doc(convoId);
        let convoPreview = null;
        try {
            const previewSnap = await convoRef.get();
            if (!previewSnap.exists) return null;
            convoPreview = previewSnap.data() || {};
        } catch (err) {
            console.warn('[onBuddyDmXp] read', err && err.message ? err.message : err);
            return null;
        }
        if (convoPreview.isBuddyMatch !== true) return null;
        try {
            await db.runTransaction(async function (tx) {
                const matchRef = db.collection('buddy_matches').doc(convoId);
                const convoSnap = await tx.get(convoRef);
                const matchSnap = await tx.get(matchRef);
                if (!convoSnap.exists || !matchSnap.exists) return;
                const convo = convoSnap.data() || {};
                if (convo.isBuddyMatch !== true) return;
                const match = matchSnap.data() || {};
                const participants = matchPair(match);
                if (!participants || convoId !== matchIdFor(participants[0], participants[1])) return;
                if (participants.indexOf(sender) === -1) return;
                const userSnaps = {};
                const users = {};
                const ledgers = {};
                for (let i = 0; i < participants.length; i++) {
                    const person = participants[i];
                    const ref = db.collection('users').doc(person);
                    const personSnap = await tx.get(ref);
                    const ledgerSnap = await tx.get(db.collection('faucet_ledger').doc(person));
                    userSnaps[person] = { ref: ref, snap: personSnap };
                    users[person] = personSnap.exists ? (personSnap.data() || {}) : {};
                    ledgers[person] = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
                }
                const now = Date.now();
                const pairXpRef = db.collection('buddy_pair_xp').doc(convoId);
                const pairXpSnap = await tx.get(pairXpRef);
                const decision = planBuddyXp({
                    convo: convo,
                    convoId: convoId,
                    match: match,
                    message: message,
                    senderUid: sender,
                    messageId: messageId,
                    users: users,
                    ledgers: ledgers,
                    now: now,
                    priorLedger: pairXpSnap.exists,
                });
                if (decision.skip) return;
                const xpPaid = Object.assign({}, match.xpPaid || {});
                const day = offsetDateKey(now);
                const ready = [];
                for (let i = 0; i < decision.awards.length; i++) {
                    const award = decision.awards[i];
                    const holder = userSnaps[award.uid];
                    if (!holder || !holder.snap.exists) continue;
                    const ledgerRef = holder.ref.collection('xp_ledger').doc('buddy_xp_' + convoId);
                    const ledgerSnap = await tx.get(ledgerRef);
                    if (ledgerSnap.exists) {
                        xpPaid[award.uid] = true;
                        continue;
                    }
                    const grant = await applyDailyXp(award.uid, award.amount, tx, { day: day, userRef: holder.ref });
                    ready.push({ award: award, holder: holder, ledgerRef: ledgerRef, grant: grant });
                }
                const ts = admin.firestore.FieldValue.serverTimestamp();
                ready.forEach(function (item) {
                    if (!item.grant.awarded) return;
                    xpPaid[item.award.uid] = true;
                    tx.set(item.holder.ref, {
                        points: admin.firestore.FieldValue.increment(item.grant.awarded),
                        weeklyXP: admin.firestore.FieldValue.increment(item.grant.awarded),
                        monthlyXP: admin.firestore.FieldValue.increment(item.grant.awarded),
                        buddyXpGrantedAt: now,
                    }, { merge: true });
                    tx.set(item.grant.dailyRef, { total: item.grant.dailyXp, lastUpdated: ts }, { merge: true });
                    tx.set(item.ledgerRef, {
                        source: 'buddy_xp',
                        amount: item.grant.awarded,
                        uid: item.award.uid,
                        matchId: convoId,
                        day: day,
                    });
                    tx.set(db.collection('notifications').doc('buddy_xp_' + convoId + '_' + item.award.uid), {
                        recipientId: item.award.uid,
                        senderId: 'system',
                        senderName: 'Bitcoin Quest',
                        type: 'reward',
                        message: '+' + item.grant.awarded + ' XP for writing to your Bitcoin Buddy',
                        targetType: 'buddy',
                        targetId: convoId.length <= 64 ? convoId : null,
                        read: false,
                        source: 'buddy_xp',
                        xp: item.grant.awarded,
                        createdAt: ts,
                    });
                });
                const pairClosed = participants.every(function (id) { return xpPaid[id]; });
                if (pairClosed) tx.set(pairXpRef, { convoId: convoId, closed: true }, { merge: true });
                tx.set(matchRef, {
                    spoke: decision.spoke || {},
                    recentMessageIds: decision.recentIds || [],
                    seenMessages: admin.firestore.FieldValue.delete(),
                    xpPaid: xpPaid,
                    pairXpClosed: pairClosed || match.pairXpClosed === true,
                    humanMessages: Object.keys(decision.spoke || {}).length,
                }, { merge: true });
            });
        } catch (err) {
            console.warn('[onBuddyDmXp]', err && err.message ? err.message : err);
        }
        return null;
    }

    async function findNewBuddy(data, context) {
        const uid = requireUser(context, HttpsError);
        const choice = clampBuddyChoice(data && data.level, data && data.goal);
        if (choice.error) throw mapBuddyError(choice.error, HttpsError);
        let plan;
        try {
            plan = await db.runTransaction(function (tx) {
                return requestInTransaction(tx, db, admin, {
                    uid: uid,
                    level: choice.level,
                    goal: choice.goal,
                    intro: data && data.intro,
                    now: Date.now(),
                    replaceMatch: true,
                });
            });
        } catch (err) {
            if (err && err.buddyCode) throw mapBuddyError(err, HttpsError);
            console.warn('[findNewBuddy]', err && err.message ? err.message : err);
            throw new HttpsError('unavailable', "Couldn't look for a new buddy. Try again shortly.");
        }
        if (plan.created && plan.storedMatch) {
            const people = plan.storedMatch.participants || [];
            for (let i = 0; i < people.length; i++) {
                try { await grantFamily(db, admin, people[i], ['dm_buddy']); }
                catch (grantErr) { console.warn('[findNewBuddy] badge', grantErr && grantErr.message); }
            }
        }
        if (plan.status === 'waiting') return { status: 'waiting', ended: true, pool: plan.pool };
        return { status: 'matched', ended: true, created: plan.created === true, match: plan.match };
    }

    async function matchBuddyPool() {
        const now = Date.now();
        let expired = 0;
        let matched = 0;
        let poolDocs = [];
        try {
            poolDocs = await pageDocs('buddy_pool');
        } catch (err) {
            console.warn('[matchBuddyPool] read', err && err.message ? err.message : err);
            return null;
        }
        const rows = [];
        for (let i = 0; i < poolDocs.length; i++) {
            const doc = poolDocs[i];
            const data = doc.data() || {};
            const uid = typeof data.uid === 'string' && data.uid ? data.uid : doc.id;
            if (!UID_RE.test(uid)) continue;
            let user = null;
            let ledger = null;
            try {
                const userSnap = await db.collection('users').doc(uid).get();
                user = userSnap.exists ? (userSnap.data() || {}) : null;
                const ledgerSnap = await db.collection('faucet_ledger').doc(uid).get();
                ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : null;
            } catch (err) {
                console.warn('[matchBuddyPool] user', err && err.message ? err.message : err);
            }
            const joined = Number(data.joinedAtMs) || timestampMs(data.joinedAt);
            rows.push({
                id: doc.id,
                uid: uid,
                level: data.level,
                goal: data.goal,
                intro: plainText(data.intro, 200),
                username: profileUsername(user) || plainText(data.username, 40),
                joinedAtMs: joined,
                waitedMs: joined ? Math.max(0, now - joined) : 0,
                fresh: !poolExpired(data, now),
                user: user,
                banned: rewardBlocked(user, ledger) || !user,
                locked: accountLocked(user),
            });
        }
        const plan = planPoolMatches(rows);
        for (let i = 0; i < plan.expired.length; i++) {
            const who = plan.expired[i];
            try {
                const ref = db.collection('buddy_pool').doc(who);
                const snap = await ref.get();
                if (!snap.exists || !poolExpired(snap.data() || {}, Date.now())) continue;
                await ref.delete();
                expired++;
                if (UID_RE.test(who)) {
                    await db.collection('notifications').doc('buddy_expire_pool_' + who).set(Object.assign({},
                        notice(who, 'Your Find a Bitcoin Buddy request expired after 7 days. You can start a new one.', null),
                        { createdAt: admin.firestore.FieldValue.serverTimestamp() }
                    ));
                }
            } catch (err) {
                console.warn('[matchBuddyPool] expire', err && err.message ? err.message : err);
            }
        }
        const byUid = {};
        rows.forEach(function (row) { byUid[row.uid] = row; });
        for (let i = 0; i < plan.pairs.length; i++) {
            const row = byUid[plan.pairs[i].a];
            if (!row) continue;
            try {
                const result = await db.runTransaction(function (tx) {
                    return requestInTransaction(tx, db, admin, {
                        uid: row.uid,
                        level: row.level,
                        goal: row.goal,
                        intro: row.intro,
                        now: Date.now(),
                        skipRate: true,
                    });
                });
                if (result && result.created) {
                    matched++;
                    const people = result.storedMatch && result.storedMatch.participants || [];
                    for (let p = 0; p < people.length; p++) {
                        try { await grantFamily(db, admin, people[p], ['dm_buddy']); }
                        catch (grantErr) { console.warn('[matchBuddyPool] badge', grantErr && grantErr.message); }
                    }
                }
            } catch (err) {
                console.warn('[matchBuddyPool] pair', err && err.message ? err.message : err);
            }
        }
        console.log('[matchBuddyPool] expired=' + expired + ' matched=' + matched);
        return null;
    }

    return {
        requestBuddyMatch: requestBuddyMatch,
        leaveBuddyPool: leaveBuddyPool,
        endBuddy: endBuddy,
        findNewBuddy: findNewBuddy,
        sweepStaleBuddies: sweepStaleBuddies,
        matchBuddyPool: matchBuddyPool,
        onBuddyDmXp: onBuddyDmXp,
    };
}

function bindBuddy(functionsV1, admin, db, hooks) {
    const handlers = createBuddyHandlers({
        admin: admin,
        db: db,
        HttpsError: functionsV1.https.HttpsError,
    });
    const safety = createSafetyHandlers({
        admin: admin,
        db: db,
        HttpsError: functionsV1.https.HttpsError,
    });
    const opts = { enforceAppCheck: true };
    const onCall = functionsV1.runWith(opts).https.onCall;
    return {
        requestBuddyMatch: onCall(handlers.requestBuddyMatch),
        leaveBuddyPool: onCall(handlers.leaveBuddyPool),
        endBuddy: onCall(handlers.endBuddy),
        findNewBuddy: onCall(handlers.findNewBuddy),
        sweepStaleBuddies: hooks.onSchedule({
            schedule: 'every 60 minutes',
            timeZone: 'UTC',
            timeoutSeconds: 300,
        }, async function () { return handlers.sweepStaleBuddies(); }),
        matchBuddyPool: hooks.onSchedule({
            schedule: 'every 15 minutes',
            timeZone: 'UTC',
            timeoutSeconds: 120,
        }, async function () { return handlers.matchBuddyPool(); }),
        onBuddyDmXp: hooks.onDocumentCreated('dm_conversations/{cid}/messages/{mid}', async function (event) {
            return handlers.onBuddyDmXp(event);
        }),
        onBuddyDmSafety: hooks.onDocumentCreated('dm_conversations/{cid}/messages/{mid}', async function (event) {
            return safety.onBuddyDmSafety(event);
        }),
        onBuddyReport: hooks.onDocumentCreated('reports/{reportId}', async function (event) {
            return safety.onBuddyReport(event);
        }),
        adminResolveLock: onCall(safety.adminResolveLock),
    };
}

module.exports = {
    LEVELS: LEVELS,
    GOALS: GOALS,
    POOL_TTL_MS: POOL_TTL_MS,
    MATCH_QUIET_MS: MATCH_QUIET_MS,
    LEVEL_FALLBACK_MS: LEVEL_FALLBACK_MS,
    XP_WINDOW_MS: XP_WINDOW_MS,
    BUDDY_XP: BUDDY_XP,
    RATE_MS: RATE_MS,
    UID_RE: UID_RE,
    NACHO_UID: NACHO_UID,
    SEEN_CAP: SEEN_CAP,
    poolExpired: poolExpired,
    pointerIsDangling: pointerIsDangling,
    convoPatch: convoPatch,
    samePair: samePair,
    matchPair: matchPair,
    outsiderSender: outsiderSender,
    recentMessageIds: recentMessageIds,
    plainText: plainText,
    profileUsername: profileUsername,
    adjacentLevel: adjacentLevel,
    matchIdFor: matchIdFor,
    blockedEither: blockedEither,
    pickPartner: pickPartner,
    welcomeText: welcomeText,
    rateDecision: rateDecision,
    buildMatchPlan: buildMatchPlan,
    planBuddyXp: planBuddyXp,
    clampBuddyChoice: clampBuddyChoice,
    planPoolMatches: planPoolMatches,
    planFindNewBuddy: planFindNewBuddy,
    hasEndedPair: hasEndedPair,
    REMATCH_MS: REMATCH_MS,
    hasHumanMessage: hasHumanMessage,
    poolExpired: poolExpired,
    matchExpired: matchExpired,
    aprilWindow: aprilWindow,
    emptyBuddyMessages: emptyBuddyMessages,
    candidateFrom: candidateFrom,
    timestampMs: timestampMs,
    createBuddyHandlers: createBuddyHandlers,
    bindBuddy: bindBuddy,
};
