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
const POOL_SCAN = 40;
const NACHO_UID = 'nacho-bot';
const UID_RE = /^[A-Za-z0-9]{6,128}$/;

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
    let s = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
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
    if (row.user.activeBuddyId) return false;
    if (blockedEither(me.user, row.user, me.uid, row.uid)) return false;
    return true;
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
    if (rewardBlocked(user, input.ledger || null)) {
        return { error: buddyError('banned', "Buddy matching isn't available on this account.") };
    }
    const username = profileUsername(user);
    if (!username) return { error: buddyError('profile', 'Set a username before finding a Bitcoin Buddy.') };

    const rate = rateDecision(input.rate, now);
    if (!rate.ok) return { error: buddyError(rate.code, rate.message) };

    const me = { uid: uid, level: level, goal: goal, intro: intro, username: username, user: user };
    const active = input.activeMatch;
    if (active && active.exists && active.data && (active.data.user1 || {}).uid && (active.data.user2 || {}).uid) {
        const participants = [active.data.user1.uid, active.data.user2.uid];
        if (participants.indexOf(uid) !== -1 && active.data.ended !== true) {
            return {
                status: 'matched',
                created: false,
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
    const participants = Array.isArray(convo.participants) ? convo.participants.filter(Boolean) : [];
    if (participants.indexOf(sender) === -1) return { skip: 'not-participant', awards: [] };
    const text = typeof msg.text === 'string' ? msg.text.trim() : '';
    const image = typeof msg.imageUrl === 'string' && /^https:\/\//.test(msg.imageUrl);
    if (!text && !image) return { skip: 'empty', awards: [] };
    const match = input.match || {};
    const messageId = String(input.messageId || '');
    const seen = Object.assign({}, match.seenMessages || {});
    if (messageId && seen[messageId]) return { skip: 'seen', awards: [], spoke: match.spoke || {} };
    if (messageId) seen[messageId] = true;
    const spoke = Object.assign({}, match.spoke || {});
    spoke[sender] = true;
    const both = participants.length >= 2 && participants.every(function (id) { return spoke[id] === true; });
    const awards = [];
    if (both) {
        participants.forEach(function (id) {
            if (!id || id === NACHO_UID) return;
            if (match.xpPaid && match.xpPaid[id]) return;
            const person = (input.users && input.users[id]) || {};
            const at = Number(person.buddyXpGrantedAt) || 0;
            if (at && input.now - at < XP_WINDOW_MS) return;
            awards.push({ uid: id, amount: BUDDY_XP });
        });
    }
    return { skip: '', spoke: spoke, seen: seen, awards: awards };
}

function poolExpired(data, now) {
    const joined = Number(data && data.joinedAtMs) || timestampMs(data && data.joinedAt);
    if (!joined) return false;
    return now - joined >= POOL_TTL_MS;
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

async function readCandidates(tx, db, meUid) {
    const freshSnap = await tx.get(db.collection('buddy_pool').orderBy('joinedAtMs', 'asc').limit(POOL_SCAN));
    const legacySnap = await tx.get(db.collection('buddy_pool').orderBy('joinedAt', 'asc').limit(POOL_SCAN));
    const byId = {};
    docsOf(freshSnap).concat(docsOf(legacySnap)).forEach(function (doc) { byId[doc.id] = doc; });
    const docs = Object.keys(byId).map(function (id) { return byId[id]; });
    const rows = [];
    for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        const data = doc.data() || {};
        const uid = typeof data.uid === 'string' && data.uid ? data.uid : doc.id;
        if (!uid || uid === meUid) continue;
        const userSnap = await tx.get(db.collection('users').doc(uid));
        const user = userSnap && userSnap.exists ? (userSnap.data() || {}) : null;
        rows.push(candidateFrom(doc.id, data, user, { uid: meUid }, 0));
    }
    return rows;
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
    const activeId = user && typeof user.activeBuddyId === 'string' ? user.activeBuddyId : '';
    let activeMatch = null;
    if (activeId && UID_RE.test(activeId.split('_')[0] || 'x') && activeId.indexOf('_') !== -1) {
        const matchSnap = await tx.get(db.collection('buddy_matches').doc(activeId));
        if (matchSnap && matchSnap.exists) {
            activeMatch = { id: activeId, exists: true, data: matchSnap.data() || {} };
        }
    }
    const rawCandidates = await readCandidates(tx, db, uid);
    const candidates = rawCandidates.map(function (row) {
        const joined = row.joinedAtMs;
        return Object.assign({}, row, {
            joinedAtMs: joined,
            waitedMs: joined ? Math.max(0, now - joined) : 0,
            fresh: freshJoined(joined, now),
        });
    });
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
        candidates: candidates,
    });
    if (plan.error) throw plan.error;

    const ts = admin.firestore.FieldValue.serverTimestamp();
    tx.set(rateRef, plan.rateWrite || {
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
        const names = {};
        names[plan.storedMatch.user1.uid] = plan.storedMatch.user1.username;
        names[plan.storedMatch.user2.uid] = plan.storedMatch.user2.username;
        tx.set(convoRef, {
            participants: plan.storedMatch.participants,
            participantNames: names,
            isBuddyMatch: true,
            buddyMatchId: plan.matchId,
            createdAt: ts,
            lastMessage: plan.welcome.slice(0, 100),
            lastMessageTime: ts,
            lastSenderUid: NACHO_UID,
        });
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
    if (err.buddyCode === 'profile' || err.buddyCode === 'banned' || err.buddyCode === 'account' || err.buddyCode === 'none') {
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
        const level = data && data.level;
        const goal = data && data.goal;
        const invalid = validateRequest(level, goal);
        if (invalid) throw mapBuddyError(invalid, HttpsError);
        let plan;
        try {
            plan = await db.runTransaction(function (tx) {
                return requestInTransaction(tx, db, admin, {
                    uid: uid,
                    level: level,
                    goal: goal,
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
                const partner = ids.filter(function (id) { return id !== uid; })[0] || '';
                const ts = admin.firestore.FieldValue.serverTimestamp();
                tx.delete(matchRef);
                ids.forEach(function (personUid) {
                    const ref = db.collection('users').doc(personUid);
                    tx.set(ref, { activeBuddyId: admin.firestore.FieldValue.delete() }, { merge: true });
                });
                if (partner) {
                    tx.set(db.collection('notifications').doc('buddy_end_' + matchId + '_' + partner), Object.assign({},
                        notice(partner, 'Your Bitcoin Buddy ended the match.', null),
                        { createdAt: ts }
                    ));
                }
                return { matchId: matchId, partner: partner };
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

    async function sweepStaleBuddies() {
        const now = Date.now();
        const poolCutoff = now - POOL_TTL_MS;
        const matchCutoff = now - MATCH_QUIET_MS;
        let poolRemoved = 0;
        let matchesRemoved = 0;
        try {
            const poolSnap = await db.collection('buddy_pool').where('joinedAtMs', '<', poolCutoff).limit(200).get();
            const poolDocs = poolSnap.docs || [];
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
            const matchSnap = await db.collection('buddy_matches').where('matchedAtMs', '<', matchCutoff).limit(200).get();
            const docs = matchSnap.docs || [];
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
        console.log('[sweepStaleBuddies] pool=' + poolRemoved + ' matches=' + matchesRemoved);
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
        try {
            await db.runTransaction(async function (tx) {
                const convoRef = db.collection('dm_conversations').doc(convoId);
                const matchRef = db.collection('buddy_matches').doc(convoId);
                const convoSnap = await tx.get(convoRef);
                const matchSnap = await tx.get(matchRef);
                if (!convoSnap.exists || !matchSnap.exists) return;
                const convo = convoSnap.data() || {};
                const match = matchSnap.data() || {};
                const participants = Array.isArray(convo.participants) ? convo.participants : [];
                const userSnaps = {};
                const users = {};
                for (let i = 0; i < participants.length; i++) {
                    const person = participants[i];
                    if (!person || person === NACHO_UID) continue;
                    const ref = db.collection('users').doc(person);
                    const personSnap = await tx.get(ref);
                    userSnaps[person] = { ref: ref, snap: personSnap };
                    users[person] = personSnap.exists ? (personSnap.data() || {}) : {};
                }
                const now = Date.now();
                const decision = planBuddyXp({
                    convo: convo,
                    match: match,
                    message: message,
                    senderUid: sender,
                    messageId: messageId,
                    users: users,
                    now: now,
                });
                if (decision.skip === 'not-buddy' || decision.skip === 'bot' || decision.skip === 'empty' || decision.skip === 'not-participant' || decision.skip === 'seen') {
                    return;
                }
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
                tx.set(matchRef, {
                    spoke: decision.spoke || {},
                    seenMessages: decision.seen || {},
                    xpPaid: xpPaid,
                    humanMessages: Object.keys(decision.spoke || {}).length,
                }, { merge: true });
            });
        } catch (err) {
            console.warn('[onBuddyDmXp]', err && err.message ? err.message : err);
        }
        return null;
    }

    return {
        requestBuddyMatch: requestBuddyMatch,
        leaveBuddyPool: leaveBuddyPool,
        endBuddy: endBuddy,
        sweepStaleBuddies: sweepStaleBuddies,
        onBuddyDmXp: onBuddyDmXp,
    };
}

function bindBuddy(functionsV1, admin, db, hooks) {
    const handlers = createBuddyHandlers({
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
        sweepStaleBuddies: hooks.onSchedule({
            schedule: 'every 60 minutes',
            timeZone: 'UTC',
            timeoutSeconds: 300,
        }, async function () { return handlers.sweepStaleBuddies(); }),
        onBuddyDmXp: hooks.onDocumentCreated('dm_conversations/{cid}/messages/{mid}', async function (event) {
            return handlers.onBuddyDmXp(event);
        }),
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
    NACHO_UID: NACHO_UID,
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
