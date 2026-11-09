'use strict';

// Optional birthday reward. The date lives in users/{uid}/birthday/profile
// (owner create-once; admin read). This job never reads or writes public_profiles.
//
// Deploy name: awardBirthdayOrangeTix
// Schedule: 15 0 * * * America/New_York (12:15am Eastern, after the date rolls).
// Index: collection group birthday, month ASC, day ASC.
//
// One marker, users/{uid}/birthday_awards/{year}, blocks a second grant that year.
// A client cannot edit the birthday. If a later privileged write sets revisedAt
// after setAt, no grant is paid until 365 days after that edit.

const TICKETS = 25;
const COOLDOWN_MS = 365 * 24 * 60 * 60 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;
const PAGE = 300;

function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function nyDateParts(date) {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const parts = fmt.formatToParts(date instanceof Date ? date : new Date(date));
    function num(type) {
        const part = parts.find(function (p) { return p.type === type; });
        return Number(part && part.value);
    }
    return { year: num('year'), month: num('month'), day: num('day') };
}

function nyStamp(ny) {
    function pad(n) { return String(n).padStart(2, '0'); }
    return ny.year + '-' + pad(ny.month) + '-' + pad(ny.day);
}

// Feb 29 birthdays are paid on Feb 28 when that year is not a leap year.
function queryDaysFor(ny) {
    const days = [{ month: ny.month, day: ny.day }];
    if (ny.month === 2 && ny.day === 28 && !isLeapYear(ny.year)) {
        days.push({ month: 2, day: 29 });
    }
    return days;
}

function toMillis(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value.toMillis === 'function') {
        const ms = value.toMillis();
        return Number.isFinite(ms) ? ms : 0;
    }
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    if (typeof value._seconds === 'number') return value._seconds * 1000;
    return 0;
}

function revisionBlocks(birthday, nowMs) {
    if (!birthday || birthday.revisedAt == null) return false;
    const revised = toMillis(birthday.revisedAt);
    if (!revised) return true;
    const setAt = toMillis(birthday.setAt);
    if (setAt && revised <= setAt + 1000) return false;
    return (nowMs - revised) < COOLDOWN_MS;
}

function uidFromBirthdayRef(ref) {
    const birthdayCol = ref && ref.parent;
    const userDoc = birthdayCol && birthdayCol.parent;
    const usersCol = userDoc && userDoc.parent;
    if (!usersCol || usersCol.id !== 'users') return '';
    const uid = String(userDoc.id || '');
    if (!uid || uid.indexOf('/') !== -1) return '';
    return uid;
}

function intsMatch(birthday, ny) {
    if (!birthday || !Number.isInteger(birthday.month) || !Number.isInteger(birthday.day)) return false;
    return queryDaysFor(ny).some(function (d) {
        return d.month === birthday.month && d.day === birthday.day;
    });
}

function yearOk(birthday, ny) {
    if (!birthday || birthday.year == null || birthday.year === '') return true;
    if (!Number.isInteger(birthday.year)) return false;
    return birthday.year >= 1900 && birthday.year <= ny.year + 1;
}

function decideBirthdayAward(input) {
    const src = input || {};
    const ny = src.ny;
    const birthday = src.birthday;
    if (!ny || !Number.isInteger(ny.year)) return { award: false, reason: 'bad-date', tickets: 0 };
    if (src.docId && src.docId !== 'profile') return { award: false, reason: 'not-profile', tickets: 0 };
    if (!birthday) return { award: false, reason: 'missing-birthday', tickets: 0 };
    if (!intsMatch(birthday, ny) || !yearOk(birthday, ny)) return { award: false, reason: 'bad-date', tickets: 0 };
    if (src.pathUid && birthday.uid && birthday.uid !== src.pathUid) {
        return { award: false, reason: 'uid-mismatch', tickets: 0 };
    }
    const setAt = toMillis(birthday.setAt);
    if (!setAt) return { award: false, reason: 'missing-setAt', tickets: 0 };
    if (setAt > src.nowMs + FUTURE_SKEW_MS) return { award: false, reason: 'future-setAt', tickets: 0 };
    if (revisionBlocks(birthday, src.nowMs)) return { award: false, reason: 'revision-cooldown', tickets: 0 };
    if (!src.userExists) return { award: false, reason: 'missing-user', tickets: 0 };
    const user = src.user || {};
    if (user.ban_reason || user.banned === true) return { award: false, reason: 'banned', tickets: 0 };
    if (src.markerExists) return { award: false, reason: 'already-awarded', tickets: 0 };
    return { award: true, reason: 'award', tickets: TICKETS };
}

function bump(summary, reason) {
    summary.skipped[reason] = (summary.skipped[reason] || 0) + 1;
}

async function loadBirthdayDocs(db, month, day) {
    const rows = [];
    let cursor = null;
    while (rows.length < 20000) {
        let query = db.collectionGroup('birthday').where('month', '==', month).where('day', '==', day);
        if (cursor && typeof query.startAfter === 'function') query = query.startAfter(cursor);
        if (typeof query.limit === 'function') query = query.limit(PAGE);
        const snap = await query.get();
        const docs = (snap && snap.docs) || [];
        if (!docs.length) break;
        docs.forEach(function (doc) { rows.push(doc); });
        if (docs.length < PAGE) break;
        cursor = docs[docs.length - 1];
    }
    return rows;
}

async function awardOne(db, deps, uid, ny, nowMs) {
    const userRef = db.collection('users').doc(uid);
    const markerRef = userRef.collection('birthday_awards').doc(String(ny.year));
    const birthdayRef = userRef.collection('birthday').doc('profile');
    return db.runTransaction(async function (t) {
        const marker = await t.get(markerRef);
        const user = await t.get(userRef);
        const birthdaySnap = await t.get(birthdayRef);
        const birthday = birthdaySnap && birthdaySnap.exists ? (birthdaySnap.data() || {}) : null;
        const decision = decideBirthdayAward({
            birthday: birthday,
            markerExists: !!(marker && marker.exists),
            userExists: !!(user && user.exists),
            user: user && user.exists ? (user.data() || {}) : null,
            nowMs: nowMs,
            ny: ny,
            pathUid: uid,
            docId: 'profile',
        });
        if (!decision.award) return decision;
        const stamp = deps.serverTimestamp ? deps.serverTimestamp() : nowMs;
        t.set(markerRef, {
            uid: uid,
            year: ny.year,
            month: birthday.month,
            day: birthday.day,
            tickets: TICKETS,
            nyDate: nyStamp(ny),
            source: 'birthday',
            awardedAt: stamp,
        });
        const ticketPatch = {};
        ticketPatch.orangeTickets = deps.increment(TICKETS);
        t.update(userRef, ticketPatch);
        if (deps.notify) {
            try {
                deps.notify(t, db, {
                    uid: uid,
                    tickets: TICKETS,
                    onceKey: 'birthday_' + ny.year,
                    day: nyStamp(ny),
                    sourceLabel: 'your birthday',
                    icon: '🎂',
                });
            } catch (notifyErr) {
                console.warn('[birthday] notify skipped');
            }
        }
        return decision;
    });
}

async function runBirthdayAwards(db, deps, nowMs) {
    const now = nowMs == null ? Date.now() : nowMs;
    const ny = nyDateParts(new Date(now));
    const summary = { nyDate: nyStamp(ny), scanned: 0, awarded: 0, skipped: {}, errors: 0 };
    const seen = new Set();
    const days = queryDaysFor(ny);
    for (let i = 0; i < days.length; i++) {
        const docs = await loadBirthdayDocs(db, days[i].month, days[i].day);
        for (let d = 0; d < docs.length; d++) {
            const doc = docs[d];
            const uid = uidFromBirthdayRef(doc && doc.ref);
            if (!uid || seen.has(uid)) continue;
            if (uid === 'unknown' || uid === 'nacho-bot' || uid === 'system') {
                bump(summary, 'system');
                continue;
            }
            if (!doc.id || doc.id !== 'profile') {
                bump(summary, 'not-profile');
                continue;
            }
            seen.add(uid);
            summary.scanned++;
            try {
                const result = await awardOne(db, deps || {}, uid, ny, now);
                if (result && result.award) summary.awarded++;
                else bump(summary, (result && result.reason) || 'skip');
            } catch (err) {
                summary.errors++;
                console.warn('[birthday] award failed');
            }
        }
    }
    return summary;
}

module.exports = {
    TICKETS: TICKETS,
    COOLDOWN_MS: COOLDOWN_MS,
    isLeapYear: isLeapYear,
    nyDateParts: nyDateParts,
    nyStamp: nyStamp,
    queryDaysFor: queryDaysFor,
    toMillis: toMillis,
    revisionBlocks: revisionBlocks,
    uidFromBirthdayRef: uidFromBirthdayRef,
    decideBirthdayAward: decideBirthdayAward,
    runBirthdayAwards: runBirthdayAwards,
};
