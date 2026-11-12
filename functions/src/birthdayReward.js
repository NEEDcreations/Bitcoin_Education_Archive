'use strict';

// Optional birthday reward. The date lives in users/{uid}/birthday_private/profile
// (owner create-once; admin read). The collection name is unique so a
// collection-group query cannot match another subcollection. This job never
// reads or writes public_profiles.
//
// Deploy name: awardBirthdayOrangeTix
// Schedule: 15 0 * * * America/New_York (12:15am Eastern, after the date rolls).
// Index: collection group birthday_private, month ASC, day ASC.
//
// One marker, users/{uid}/birthday_awards/{year}, blocks a second grant that year.
// A client cannot edit the birthday. If a later privileged write sets revisedAt
// after setAt, no grant is paid until 365 days after that edit.
// The date also has to sit on file for 30 days before the birthday it pays,
// and the account has to be 30 days old, signed in for real, and not blocked.

const referrals = require('./referrals');
const cipherClaim = require('./cipherClaim');
const accountTombstone = require('./accountTombstone');

const TICKETS = 25;
const COOLDOWN_MS = 365 * 24 * 60 * 60 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_ACCOUNT_AGE_MS = 30 * DAY_MS;
const MIN_ON_FILE_MS = 30 * DAY_MS;
const DAILY_GRANT_CAP = 200;
const BIRTHDAY_COLLECTION = 'birthday_private';
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
    if (!birthdayCol || birthdayCol.id !== BIRTHDAY_COLLECTION) return '';
    const userDoc = birthdayCol.parent;
    const usersCol = userDoc && userDoc.parent;
    if (!usersCol || usersCol.id !== 'users' || usersCol.parent) return '';
    const uid = String(userDoc.id || '');
    if (!uid || uid.indexOf('/') !== -1) return '';
    return uid;
}

function nyMidnightMs(ny) {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    });
    let ms = Date.UTC(ny.year, ny.month - 1, ny.day, 5, 0, 0);
    for (let i = 0; i < 6; i++) {
        const parts = fmt.formatToParts(new Date(ms));
        function num(type) {
            const part = parts.find(function (p) { return p.type === type; });
            return Number(part && part.value);
        }
        const dayDiff = Date.UTC(num('year'), num('month') - 1, num('day')) - Date.UTC(ny.year, ny.month - 1, ny.day);
        const off = dayDiff + num('hour') * 3600000 + num('minute') * 60000 + num('second') * 1000;
        if (off === 0) return ms;
        ms -= off;
    }
    return ms;
}

function providerList(src, user) {
    if (Array.isArray(src.providers)) return src.providers.map(String);
    if (Array.isArray(user.providers)) return user.providers.map(String);
    return [];
}

// Same guest rule as referralService.recordReferralArrival: a minted Lightning
// uid is a real account even with no provider rows. An Auth lookup that throws
// is not treated as a guest. Empty providerData is a guest only after Auth
// was actually read.
function isGuestAccount(src) {
    const user = src.user || {};
    const uid = String(src.pathUid || user.uid || '');
    if (referrals.needsMintedReferralCode(uid)) return false;
    if (src.authLookupFailed === true) return false;
    const providers = providerList(src, user);
    const signIn = String(src.signInProvider || '');
    if (src.authKnown !== true) {
        if (signIn === 'anonymous') return true;
        if (providers.length && providers.every(function (provider) { return provider === 'anonymous'; })) return true;
        return false;
    }
    return providers.length === 0 || providers.every(function (provider) { return provider === 'anonymous'; });
}

function legitimacyUser(src) {
    const user = src.user || {};
    const uid = String(src.pathUid || user.uid || '');
    let providers = providerList(src, user).filter(function (provider) {
        return provider && provider !== 'anonymous';
    });
    if (!providers.length && referrals.needsMintedReferralCode(uid)) providers = ['lightning'];
    return {
        providers: providers,
        emailVerified: src.emailVerified === true || user.emailVerified === true,
    };
}

function intsMatch(birthday, ny) {
    if (!birthday || !Number.isInteger(birthday.month) || !Number.isInteger(birthday.day)) return false;
    return queryDaysFor(ny).some(function (d) {
        return d.month === birthday.month && d.day === birthday.day;
    });
}

function decideBirthdayAward(input) {
    const src = input || {};
    const ny = src.ny;
    const birthday = src.birthday;
    const none = function (reason, extra) {
        return Object.assign({ award: false, reason: reason, tickets: 0 }, extra || {});
    };
    if (!ny || !Number.isInteger(ny.year)) return none('bad-date');
    if (src.docId && src.docId !== 'profile') return none('not-profile');
    if (!birthday) return none('missing-birthday');
    if (!intsMatch(birthday, ny)) return none('bad-date');
    if (src.pathUid && birthday.uid && birthday.uid !== src.pathUid) return none('uid-mismatch');
    const setAt = toMillis(birthday.setAt);
    if (!setAt) return none('missing-setAt');
    if (setAt > src.nowMs + FUTURE_SKEW_MS) return none('future-setAt');
    if (revisionBlocks(birthday, src.nowMs)) return none('revision-cooldown');
    if (isGuestAccount(src)) return none('guest');
    if (!referrals.emailOk(legitimacyUser(src))) return none('unverified');
    const tomb = src.tombstone || null;
    const authCreated = toMillis(src.authCreatedMs);
    if (!authCreated && !(tomb && Number(tomb.ageDays) > 0)) return none('age-unknown');
    const authAgeDays = authCreated ? Math.floor((src.nowMs - authCreated) / DAY_MS) : 0;
    const ageDays = accountTombstone.effectiveAgeDays(authAgeDays, tomb);
    if (ageDays < 30) return none('account-too-new');
    if (setAt > nyMidnightMs(ny) - MIN_ON_FILE_MS) return none('on-file-too-short');
    if (src.tombstoneUnknown === true) return none('tombstone-unknown');
    if (!src.identityReady) return none('no-identity');
    if (src.identityAwarded) return none('already-awarded');
    const user = Object.assign({}, src.user || {});
    const ledger = Object.assign({}, src.ledger || {});
    if (tomb && tomb.banned) user.banned = true;
    if (tomb && tomb.flagged) user.flagged = true;
    if (tomb && (tomb.satsDisabled || tomb.ledgerBanned)) user.satsDisabled = true;
    if (tomb && tomb.ledgerBanned) ledger.banned = true;
    if (user.withdrawalsDisabled) return none('blocked');
    if (user.flagged === true) return none('blocked');
    if (cipherClaim.rewardBlocked(user, ledger)) return none('blocked');
    const cap = src.dailyCap == null ? DAILY_GRANT_CAP : Number(src.dailyCap);
    const used = Number(src.dailyGrants) || 0;
    if (used >= cap) return none('daily-cap', { alert: true });
    if (!src.userExists) return none('missing-user');
    if (src.markerExists) return none('already-awarded');
    return { award: true, reason: 'award', tickets: TICKETS, queued: true };
}

function markerBody(year) {
    return { year: Number(year) };
}

function markerDocId(material, year) {
    const signal = String(material || '');
    if (!signal) return '';
    return accountTombstone.hmacHex('birthday-award\0' + signal + '\0' + String(year));
}

function previousNyDate(ny) {
    return nyDateParts(new Date(nyMidnightMs(ny) - 60 * 60 * 1000));
}

function identityMaterialsFor(uid, authUser, facts) {
    const spec = accountTombstone.identityFrom({
        uid: uid,
        authUser: authUser || null,
        email: facts && facts.email,
        emailVerified: !!(facts && facts.emailVerified),
        providers: (authUser && authUser.providerData) || [],
    });
    return accountTombstone.identityMaterials(spec);
}

function bump(summary, reason) {
    summary.skipped[reason] = (summary.skipped[reason] || 0) + 1;
}

async function loadBirthdayDocs(db, month, day) {
    const rows = [];
    let cursor = null;
    while (rows.length < 20000) {
        let query = db.collectionGroup(BIRTHDAY_COLLECTION).where('month', '==', month).where('day', '==', day);
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

function authFacts(authUser, lookupFailed) {
    const facts = {
        providers: [],
        emailVerified: false,
        email: '',
        signInProvider: '',
        authCreatedMs: 0,
        authKnown: false,
        authLookupFailed: lookupFailed === true,
    };
    if (!authUser) return facts;
    facts.authKnown = true;
    const rows = Array.isArray(authUser.providerData) ? authUser.providerData : [];
    facts.providers = rows.map(function (row) {
        return row && row.providerId ? String(row.providerId) : '';
    }).filter(Boolean);
    facts.emailVerified = authUser.emailVerified === true;
    facts.email = authUser.email ? String(authUser.email) : '';
    if (facts.providers.length === 1) facts.signInProvider = facts.providers[0];
    const created = Date.parse((authUser.metadata || {}).creationTime || '');
    if (created) facts.authCreatedMs = created;
    return facts;
}

async function awardOne(db, deps, uid, ny, nowMs, pre) {
    const prior = pre || {};
    const facts = authFacts(prior.authUser || null, prior.authLookupFailed === true);
    const materials = identityMaterialsFor(uid, prior.authUser || null, facts);
    const markerIds = materials.map(function (material) {
        return markerDocId(material, ny.year);
    }).filter(Boolean);
    const userRef = db.collection('users').doc(uid);
    const birthdayRef = userRef.collection(BIRTHDAY_COLLECTION).doc('profile');
    const pendingRef = userRef.collection('birthday_grant_pending').doc(String(ny.year));
    const ledgerRef = db.collection('faucet_ledger').doc(uid);
    const capRef = db.collection('birthday_grant_caps').doc(nyStamp(ny));
    const markerRefs = markerIds.map(function (id) {
        return db.collection('birthday_award_markers').doc(id);
    });
    return db.runTransaction(async function (t) {
        const userSnap = await t.get(userRef);
        const birthdaySnap = await t.get(birthdayRef);
        const ledgerSnap = await t.get(ledgerRef);
        const capSnap = await t.get(capRef);
        const pendingSnap = await t.get(pendingRef);
        const markerSnaps = [];
        for (let i = 0; i < markerRefs.length; i++) markerSnaps.push(await t.get(markerRefs[i]));
        const user = userSnap && userSnap.exists ? (userSnap.data() || {}) : null;
        const birthday = birthdaySnap && birthdaySnap.exists ? (birthdaySnap.data() || {}) : null;
        const used = capSnap && capSnap.exists ? (Number((capSnap.data() || {}).count) || 0) : 0;
        const decision = decideBirthdayAward({
            birthday: birthday,
            markerExists: !!(pendingSnap && pendingSnap.exists),
            identityReady: markerIds.length > 0 && markerIds.length === materials.length,
            identityAwarded: markerSnaps.some(function (snap) { return snap && snap.exists; }),
            userExists: !!(userSnap && userSnap.exists),
            user: user,
            ledger: ledgerSnap && ledgerSnap.exists ? (ledgerSnap.data() || {}) : null,
            tombstone: prior.tombstone || null,
            tombstoneUnknown: prior.tombstoneUnknown === true,
            providers: facts.providers,
            emailVerified: facts.emailVerified,
            signInProvider: facts.signInProvider,
            authKnown: facts.authKnown,
            authLookupFailed: facts.authLookupFailed,
            authCreatedMs: facts.authCreatedMs,
            dailyGrants: used,
            dailyCap: deps.dailyCap,
            nowMs: nowMs,
            ny: ny,
            pathUid: uid,
            docId: 'profile',
        });
        if (!decision.award) return decision;
        const delay = deps.randomDelayMs ? Number(deps.randomDelayMs()) : 0;
        const applyAt = nowMs + (Number.isFinite(delay) && delay > 0 ? delay : 0);
        const stamp = deps.serverTimestamp ? deps.serverTimestamp() : nowMs;
        t.set(capRef, { count: used + 1, day: nyStamp(ny), updatedAt: stamp }, { merge: true });
        markerRefs.forEach(function (ref) {
            t.set(ref, markerBody(ny.year));
        });
        t.set(pendingRef, { applyAt: applyAt, year: ny.year, tickets: TICKETS });
        return decision;
    });
}

async function scanOneDate(db, deps, ny, now, summary, seen) {
    const hooks = deps || {};
    if (hooks.failScan === nyStamp(ny)) throw new Error('scan failed');
    const days = queryDaysFor(ny);
    for (let i = 0; i < days.length; i++) {
        const docs = await loadBirthdayDocs(db, days[i].month, days[i].day);
        for (let d = 0; d < docs.length; d++) {
            const doc = docs[d];
            const uid = uidFromBirthdayRef(doc && doc.ref);
            if (!uid) {
                bump(summary, 'wrong-path');
                continue;
            }
            if (seen.has(uid)) continue;
            if (uid === 'unknown' || uid === 'nacho-bot' || uid === 'system') {
                bump(summary, 'system');
                continue;
            }
            if (!doc.id || doc.id !== 'profile') {
                bump(summary, 'not-profile');
                continue;
            }
            summary.scanned++;
            let authUser = null;
            let authLookupFailed = false;
            if (hooks.getAuthUser) {
                try { authUser = await hooks.getAuthUser(uid); }
                catch (e) { authLookupFailed = true; }
            }
            let tombstone = null;
            let tombstoneUnknown = false;
            if (hooks.tombstoneSummary) {
                const looked = await hooks.tombstoneSummary(uid, authUser);
                if (looked && looked.lookupFailed) tombstoneUnknown = true;
                else tombstone = looked;
            }
            const result = await awardOne(db, hooks, uid, ny, now, {
                authUser: authUser,
                authLookupFailed: authLookupFailed,
                tombstone: tombstone,
                tombstoneUnknown: tombstoneUnknown,
            });
            if (result && result.award) {
                seen.add(uid);
                summary.queued = (summary.queued || 0) + 1;
            } else {
                bump(summary, (result && result.reason) || 'skip');
                if (result && result.alert && !summary.alerted) {
                    summary.alerted = true;
                    const stamp = hooks.serverTimestamp ? hooks.serverTimestamp() : now;
                    await db.collection('admin_audit_log').doc('birthday_cap_' + nyStamp(ny)).set({
                        action: 'birthday_grant_cap',
                        day: nyStamp(ny),
                        cap: hooks.dailyCap == null ? DAILY_GRANT_CAP : hooks.dailyCap,
                        at: stamp,
                    }, { merge: true });
                }
            }
        }
    }
}

async function applyDueGrants(db, deps, nowMs) {
    const hooks = deps || {};
    const now = nowMs == null ? Date.now() : nowMs;
    let query = db.collectionGroup('birthday_grant_pending');
    if (query.where) query = query.where('applyAt', '<=', now);
    if (query.limit) query = query.limit(300);
    const snap = await query.get();
    const docs = (snap && snap.docs) || [];
    let applied = 0;
    for (let i = 0; i < docs.length; i++) {
        const pending = docs[i];
        const data = pending.data ? (pending.data() || {}) : {};
        if (Number(data.applyAt) > now) continue;
        const pendingParent = pending.ref && pending.ref.parent;
        const userDoc = pendingParent && pendingParent.parent;
        const payUid = userDoc && userDoc.id;
        if (!payUid || (userDoc.parent && userDoc.parent.id !== 'users')) continue;
        const userRef = db.collection('users').doc(payUid);
        try {
            const paid = await db.runTransaction(async function (t) {
                const userSnap = await t.get(userRef);
                const pendingSnap = await t.get(pending.ref);
                if (!pendingSnap || !pendingSnap.exists) return false;
                const row = pendingSnap.data() || {};
                if (Number(row.applyAt) > now) return false;
                if (!userSnap || !userSnap.exists) {
                    if (t.delete) t.delete(pending.ref);
                    return false;
                }
                const tickets = Number(row.tickets) || TICKETS;
                const patch = {};
                patch.orangeTickets = hooks.increment(tickets);
                t.update(userRef, patch);
                if (t.delete) t.delete(pending.ref);
                if (hooks.notify) {
                    try {
                        hooks.notify(t, db, {
                            uid: payUid,
                            tickets: tickets,
                            onceKey: 'birthday_' + row.year,
                            day: nyStamp(nyDateParts(new Date(now))),
                            sourceLabel: 'your birthday',
                            icon: '🎂',
                        });
                    } catch (e) { /* notice is not the grant */ }
                }
                return true;
            });
            if (paid) applied++;
        } catch (err) {
            console.warn('[birthday] apply failed');
        }
    }
    return applied;
}

async function runBirthdayAwards(db, deps, nowMs) {
    const now = nowMs == null ? Date.now() : nowMs;
    const ny = nyDateParts(new Date(now));
    const summary = { nyDate: nyStamp(ny), scanned: 0, awarded: 0, queued: 0, skipped: {}, errors: 0, dayErrors: [] };
    const seen = new Set();
    const dates = [previousNyDate(ny), ny];
    for (let i = 0; i < dates.length; i++) {
        try {
            await scanOneDate(db, deps, dates[i], now, summary, seen);
        } catch (err) {
            summary.errors++;
            summary.dayErrors.push(nyStamp(dates[i]));
            console.warn('[birthday] day scan failed');
        }
    }
    try {
        summary.awarded = await applyDueGrants(db, deps || {}, now);
    } catch (err) {
        summary.errors++;
        console.warn('[birthday] apply failed');
    }
    return summary;
}

module.exports = {
    TICKETS: TICKETS,
    COOLDOWN_MS: COOLDOWN_MS,
    MIN_ACCOUNT_AGE_MS: MIN_ACCOUNT_AGE_MS,
    MIN_ON_FILE_MS: MIN_ON_FILE_MS,
    DAILY_GRANT_CAP: DAILY_GRANT_CAP,
    BIRTHDAY_COLLECTION: BIRTHDAY_COLLECTION,
    isLeapYear: isLeapYear,
    nyDateParts: nyDateParts,
    nyStamp: nyStamp,
    nyMidnightMs: nyMidnightMs,
    queryDaysFor: queryDaysFor,
    toMillis: toMillis,
    revisionBlocks: revisionBlocks,
    uidFromBirthdayRef: uidFromBirthdayRef,
    isGuestAccount: isGuestAccount,
    markerBody: markerBody,
    markerDocId: markerDocId,
    previousNyDate: previousNyDate,
    decideBirthdayAward: decideBirthdayAward,
    applyDueGrants: applyDueGrants,
    runBirthdayAwards: runBirthdayAwards,
};
