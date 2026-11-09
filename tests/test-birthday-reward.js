'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const birthday = require(path.join(__dirname, '..', 'functions', 'src', 'birthdayReward'));
const del = require(path.join(__dirname, '..', 'functions', 'src', 'deleteAccount'));

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

const nyBirthday = { year: 2026, month: 11, day: 9 };
const now = Date.UTC(2026, 10, 9, 15, 0, 0);

const aged = now - (40 * 86400000);

function baseInput(extra) {
    return Object.assign({
        birthday: { month: 11, day: 9, uid: 'alice', setAt: aged },
        markerExists: false,
        userExists: true,
        user: { orangeTickets: 2, emailVerified: true },
        providers: ['password'],
        emailVerified: true,
        authKnown: true,
        authCreatedMs: aged,
        identityReady: true,
        identityAwarded: false,
        dailyGrants: 0,
        nowMs: now,
        ny: nyBirthday,
        pathUid: 'alice',
        docId: 'profile',
    }, extra || {});
}

assert.deepStrictEqual(
    birthday.nyDateParts(new Date(Date.UTC(2026, 10, 9, 5, 30))),
    { year: 2026, month: 11, day: 9 }
);
assert.deepStrictEqual(
    birthday.nyDateParts(new Date(Date.UTC(2026, 10, 9, 4, 30))),
    { year: 2026, month: 11, day: 8 }
);
assert.deepStrictEqual(
    birthday.nyDateParts(new Date(Date.UTC(2026, 6, 4, 4, 30))),
    { year: 2026, month: 7, day: 4 }
);
assert.strictEqual(birthday.isLeapYear(2024), true);
assert.strictEqual(birthday.isLeapYear(1900), false);
assert.strictEqual(birthday.isLeapYear(2000), true);
assert.strictEqual(birthday.isLeapYear(2026), false);
assert.deepStrictEqual(birthday.queryDaysFor({ year: 2026, month: 2, day: 28 }), [
    { month: 2, day: 28 },
    { month: 2, day: 29 },
]);
assert.deepStrictEqual(birthday.queryDaysFor({ year: 2028, month: 2, day: 28 }), [
    { month: 2, day: 28 },
]);
assert.deepStrictEqual(birthday.queryDaysFor({ year: 2028, month: 2, day: 29 }), [
    { month: 2, day: 29 },
]);

const awarded = birthday.decideBirthdayAward(baseInput());
assert.strictEqual(awarded.award, true);
assert.strictEqual(awarded.tickets, 25);

assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    birthday: { month: 11, day: 9, setAt: aged },
})).award, true, 'year is optional');

assert.strictEqual(birthday.decideBirthdayAward(baseInput({ markerExists: true })).reason, 'already-awarded');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({ userExists: false })).reason, 'missing-user');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({ user: { ban_reason: 'spam' } })).reason, 'blocked');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({ user: { banned: true } })).reason, 'blocked');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({ docId: 'other' })).reason, 'not-profile');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    birthday: { month: 1, day: 1, setAt: now },
})).reason, 'bad-date');

const recentEdit = birthday.decideBirthdayAward(baseInput({
    birthday: {
        month: 11,
        day: 9,
        uid: 'alice',
        setAt: now - (400 * 86400000),
        revisedAt: now - (10 * 86400000),
    },
}));
assert.strictEqual(recentEdit.reason, 'revision-cooldown');

const oldEdit = birthday.decideBirthdayAward(baseInput({
    birthday: {
        month: 11,
        day: 9,
        uid: 'alice',
        setAt: now - (800 * 86400000),
        revisedAt: now - (366 * 86400000),
    },
}));
assert.strictEqual(oldEdit.award, true, 'an edit older than 365 days can be paid');

assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    birthday: { month: 11, day: 9, setAt: now + (10 * 60 * 1000) },
})).reason, 'future-setAt');

assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    ny: { year: 2026, month: 2, day: 28 },
    birthday: { month: 2, day: 29, uid: 'alice', setAt: Date.UTC(2025, 0, 1) },
    authCreatedMs: Date.UTC(2025, 0, 1),
})).award, true, 'Feb 29 is paid on Feb 28 in a non-leap year');

assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    authKnown: false,
    providers: [],
    signInProvider: 'anonymous',
})).reason, 'guest', 'anonymous sign-in is not paid');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    providers: ['anonymous'],
    emailVerified: false,
    user: {},
})).reason, 'guest', 'anonymous provider is not paid');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    providers: ['google.com'],
    emailVerified: false,
    user: { emailVerified: false },
})).reason, 'unverified', 'email sign-in needs a verified email');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    pathUid: 'ln:abc',
    providers: [],
    emailVerified: false,
    user: {},
    birthday: { month: 11, day: 9, uid: 'ln:abc', setAt: aged },
})).award, true, 'Lightning sign-in is a real account without an email');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    providers: ['twitter.com'],
    emailVerified: false,
    user: {},
})).award, true, 'a non-email provider passes the referral sign-in gate');

assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    authCreatedMs: now - (10 * 86400000),
})).reason, 'account-too-new');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    authCreatedMs: now - (30 * 86400000) - 1000,
})).award, true, '30 days old is enough');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    authCreatedMs: 0,
    tombstone: { ageDays: 40 },
})).award, true, 'tombstone age survives a new signup');

const birthdayStart = birthday.nyMidnightMs(nyBirthday);
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    birthday: { month: 11, day: 9, uid: 'alice', setAt: birthdayStart - (10 * 86400000) },
})).reason, 'on-file-too-short');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    ny: { year: 2027, month: 11, day: 9 },
    nowMs: Date.UTC(2027, 10, 9, 15, 0, 0),
    authCreatedMs: Date.UTC(2026, 0, 1),
    birthday: { month: 11, day: 9, uid: 'alice', setAt: birthdayStart - (10 * 86400000) },
})).award, true, 'a late set waits until the next birthday');

assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    user: { satsDisabled: true },
})).reason, 'blocked');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    ledger: { banned: true },
})).reason, 'blocked');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    tombstone: { banned: true },
})).reason, 'blocked');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    tombstone: { ledgerBanned: true },
})).reason, 'blocked');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    user: { withdrawalsDisabled: true },
})).reason, 'blocked');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    user: { flagged: true },
})).reason, 'blocked');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    authKnown: true,
    providers: [],
    emailVerified: false,
    user: {},
})).reason, 'guest', 'Auth with no providers is a guest');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    authLookupFailed: true,
    authKnown: false,
    providers: [],
    emailVerified: true,
    user: {},
})).award, true, 'a failed Auth lookup is not treated as a guest');

assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    dailyGrants: 200,
})).reason, 'daily-cap');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    dailyGrants: 200,
})).alert, true);
assert.strictEqual(birthday.decideBirthdayAward(baseInput({
    dailyGrants: 199,
})).award, true);

function memoryDb(seed) {
    const docs = new Map(Object.entries(seed || {}));
    function collectionRef(collPath) {
        const parts = collPath ? collPath.split('/') : [];
        return {
            id: parts[parts.length - 1] || '',
            path: collPath,
            parent: parts.length > 1 ? docRef(parts.slice(0, -1).join('/')) : null,
            doc: function (id) { return docRef(collPath + '/' + id); },
        };
    }
    function docRef(docPath) {
        const parts = docPath.split('/');
        return {
            id: parts[parts.length - 1],
            path: docPath,
            parent: collectionRef(parts.slice(0, -1).join('/')),
            collection: function (name) { return collectionRef(docPath + '/' + name); },
            set: async function (data) { docs.set(docPath, data); },
        };
    }
    return {
        docs: docs,
        collection: function (name) { return collectionRef(name); },
        collectionGroup: function (name) {
            return {
                where: function () { return this; },
                startAfter: function () { return this; },
                limit: function () { return this; },
                get: async function () {
                    const found = [];
                    docs.forEach(function (data, docPath) {
                        const parts = docPath.split('/');
                        if (parts.length === 4 && parts[2] === name) {
                            found.push({
                                id: parts[3],
                                ref: docRef(docPath),
                                data: function () { return data; },
                            });
                        }
                    });
                    return { docs: found, empty: found.length === 0, size: found.length };
                },
            };
        },
        runTransaction: async function (fn) {
            const writes = [];
            const t = {
                get: async function (ref) {
                    return {
                        exists: docs.has(ref.path),
                        data: function () { return Object.assign({}, docs.get(ref.path)); },
                    };
                },
                set: function (ref, data) { writes.push(['set', ref.path, data]); },
                update: function (ref, data) { writes.push(['update', ref.path, data]); },
                delete: function (ref) { writes.push(['delete', ref.path]); },
            };
            const result = await fn(t);
            writes.forEach(function (write) {
                const kind = write[0];
                const docPath = write[1];
                const data = write[2];
                if (kind === 'delete') docs.delete(docPath);
                if (kind === 'set') docs.set(docPath, data);
                if (kind === 'update') {
                    const next = Object.assign({}, docs.get(docPath) || {});
                    Object.keys(data).forEach(function (key) {
                        const value = data[key];
                        if (value && value.__inc) next[key] = (Number(next[key]) || 0) + value.__inc;
                        else next[key] = value;
                    });
                    docs.set(docPath, next);
                }
            });
            return result;
        },
    };
}

process.env.DELETION_HMAC_SECRET = process.env.DELETION_HMAC_SECRET || 'unit-deletion-secret-0123456789';

function authRecord(uid, extra) {
    const row = extra || {};
    return {
        email: row.email || (uid + '@example.com'),
        emailVerified: row.emailVerified !== false,
        providerData: row.providerData || [{ providerId: 'password', uid: uid }],
        metadata: { creationTime: new Date(row.createdMs || aged).toISOString() },
    };
}

function deps(notices, authByUid) {
    return {
        increment: function (n) { return { __inc: n }; },
        serverTimestamp: function () { return now; },
        randomDelayMs: function () { return 0; },
        getAuthUser: async function (uid) {
            if (authByUid && Object.prototype.hasOwnProperty.call(authByUid, uid)) return authByUid[uid];
            return authRecord(uid);
        },
        notify: function (writer, db, spec) {
            notices.push(spec);
            writer.set(db.collection('notifications').doc('rn_' + spec.uid + '_' + spec.onceKey), {
                tickets: spec.tickets,
                message: '+25 🎟️ from ' + spec.sourceLabel,
            });
        },
    };
}

function eligibleUser(extra) {
    return Object.assign({
        orangeTickets: 0,
        emailVerified: true,
        providers: ['password'],
        created: aged,
    }, extra || {});
}

(async function () {
    const notices = [];
    const db = memoryDb({
        'users/alice': eligibleUser({ orangeTickets: 4 }),
        'users/alice/birthday_private/profile': { month: 11, day: 9, uid: 'alice', setAt: aged },
        'users/bob': eligibleUser({ orangeTickets: 1, ban_reason: 'spam' }),
        'users/bob/birthday_private/profile': { month: 11, day: 9, uid: 'bob', setAt: aged },
        'users/cara': eligibleUser(),
        'users/cara/birthday_private/profile': {
            month: 11,
            day: 9,
            uid: 'cara',
            setAt: now - (400 * 86400000),
            revisedAt: now - (2 * 86400000),
        },
        'users/guest': eligibleUser({ anonymous: true, providers: ['anonymous'], emailVerified: false }),
        'users/guest/birthday_private/profile': { month: 11, day: 9, uid: 'guest', setAt: aged },
        'users/erin/birthday_private/extra': { month: 11, day: 9, uid: 'erin', setAt: aged },
        'clubs/x/birthday_private/profile': { month: 11, day: 9, uid: 'x', setAt: aged },
        'users/oldname/birthday/profile': { month: 11, day: 9, uid: 'oldname', setAt: aged },
    });
    const first = await birthday.runBirthdayAwards(db, deps(notices, {
        guest: authRecord('guest', {
            emailVerified: false,
            providerData: [{ providerId: 'anonymous', uid: 'guest' }],
        }),
    }), now);
    const markerId = birthday.markerDocId('email:alice@example.com', 2026);
    const marker = db.docs.get('birthday_award_markers/' + markerId);
    assert.ok(marker, 'award marker was written');
    assert.deepStrictEqual(Object.keys(marker).sort(), ['year']);
    assert.strictEqual(marker.year, 2026);
    assert.strictEqual(marker.uid, undefined);
    assert.strictEqual(marker.birthday, undefined);
    assert.strictEqual(marker.month, undefined);
    assert.strictEqual(marker.day, undefined);
    assert.strictEqual(marker.name, undefined);
    assert.strictEqual(first.awarded, 1);
    assert.strictEqual(first.nyDate, '2026-11-09');
    assert.strictEqual(db.docs.get('users/alice').orangeTickets, 29);
    assert.strictEqual(db.docs.has('users/alice/birthday_grant_pending/2026'), false);
    assert.strictEqual(db.docs.get('users/bob').orangeTickets, 1);
    assert.strictEqual(db.docs.has('users/bob/birthday_award_markers'), false);
    assert.ok(first.skipped.guest >= 1);
    assert.ok(first.skipped['wrong-path'] >= 1);
    assert.ok(first.skipped['not-profile'] >= 1);
    assert.strictEqual(notices.length, 1);
    assert.strictEqual(notices[0].tickets, 25);
    assert.strictEqual(notices[0].sourceLabel, 'your birthday');

    const second = await birthday.runBirthdayAwards(db, deps(notices, {
        guest: authRecord('guest', {
            emailVerified: false,
            providerData: [{ providerId: 'anonymous', uid: 'guest' }],
        }),
    }), now);
    assert.strictEqual(second.awarded, 0);
    assert.strictEqual(db.docs.get('users/alice').orangeTickets, 29);
    assert.ok(second.skipped['already-awarded'] >= 1);

    const capDb = memoryDb({
        'users/one': eligibleUser({ orangeTickets: 1 }),
        'users/one/birthday_private/profile': { month: 11, day: 9, uid: 'one', setAt: aged },
        'users/two': eligibleUser({ orangeTickets: 1 }),
        'users/two/birthday_private/profile': { month: 11, day: 9, uid: 'two', setAt: aged },
    });
    const capDeps = deps([]);
    capDeps.dailyCap = 1;
    const capped = await birthday.runBirthdayAwards(capDb, capDeps, now);
    assert.strictEqual(capped.awarded, 1);
    assert.ok(capped.skipped['daily-cap'] >= 1);
    assert.strictEqual(capped.alerted, true);
    const alert = capDb.docs.get('admin_audit_log/birthday_cap_2026-11-09');
    assert.strictEqual(alert.action, 'birthday_grant_cap');
    assert.strictEqual(alert.cap, 1);
    const paid = (capDb.docs.get('users/one').orangeTickets === 26 ? 1 : 0)
        + (capDb.docs.get('users/two').orangeTickets === 26 ? 1 : 0);
    assert.strictEqual(paid, 1);

    const leapDb = memoryDb({
        'users/leap': eligibleUser(),
        'users/leap/birthday_private/profile': { month: 2, day: 29, uid: 'leap', setAt: Date.UTC(2020, 0, 1) },
    });
    const leapNow = Date.UTC(2026, 1, 28, 15, 0, 0);
    const leapRun = await birthday.runBirthdayAwards(leapDb, deps([], {
        leap: authRecord('leap', { createdMs: Date.UTC(2020, 0, 1), email: 'leap@example.com' }),
    }), leapNow);
    assert.strictEqual(birthday.nyDateParts(new Date(leapNow)).day, 28);
    assert.strictEqual(leapRun.awarded, 1);
    assert.strictEqual(leapDb.docs.get('users/leap').orangeTickets, 25);

    assert.ok(del.USER_SUBCOLLECTIONS.indexOf('birthday_private') !== -1);
    assert.ok(del.USER_SUBCOLLECTIONS.indexOf('birthday_awards') !== -1);
    assert.ok(del.CAP_SUBCOLLECTIONS.indexOf('birthday_private') === -1);
    assert.ok(del.RETAINED_COLLECTIONS.indexOf('birthday_private') === -1);

    const indexSrc = read('functions/index.js');
    const fieldsAt = indexSrc.indexOf('const PUBLIC_PROFILE_FIELDS = [');
    const fieldsEnd = indexSrc.indexOf('];', fieldsAt);
    const fields = indexSrc.slice(fieldsAt, fieldsEnd);
    const quoted = fields.match(/'([^']+)'/g) || [];
    assert.ok(fieldsAt > 0);
    assert.ok(quoted.indexOf("'birthday'") === -1);
    assert.ok(quoted.indexOf("'birthMonth'") === -1);
    assert.ok(quoted.indexOf("'birthDay'") === -1);
    assert.ok(indexSrc.includes('exports.awardBirthdayOrangeTix'));
    assert.ok(indexSrc.includes("schedule: '15 0 * * *'"));
    assert.ok(indexSrc.includes("timeZone: 'America/New_York'"));

    const indexes = JSON.parse(read('firestore.indexes.json'));
    const birthdayIndexes = indexes.indexes.filter(function (row) {
        return row.collectionGroup === 'birthday_private' && row.queryScope === 'COLLECTION_GROUP';
    });
    assert.strictEqual(birthdayIndexes.length, 1);
    assert.deepStrictEqual(birthdayIndexes[0].fields.map(function (field) { return field.fieldPath; }), ['month', 'day']);

    const rules = read('firestore.rules');
    assert.ok(rules.includes('match /birthday_private/{docId}'));
    assert.ok(rules.includes("sign_in_provider', '') != 'anonymous'"));
    assert.ok(rules.includes('match /birthday_awards/{yearId}'));
    assert.ok(rules.includes("docId == 'profile'"));

    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(html.includes('id="signupBirthdayMonth"'));
    assert.ok(html.includes('not shared'));
    assert.ok(html.includes('ranking.js?v=20261109_v2534'));
    assert.ok(read('sw.js').includes("const CACHE_NAME = 'btc-archive-v2534'"));

    const ranking = read('ranking.js');
    assert.ok(ranking.includes("collection('birthday_private').doc('profile')"));
    assert.ok(ranking.includes('not shared'));
    assert.ok(ranking.includes('on file for 30 days'));
    assert.ok(html.includes('on file for 30 days'));
    assert.ok(!html.includes('signupBirthdayYear'));
    assert.ok(ranking.includes('saveBirthdayFromSettings'));
    const saveAt = ranking.indexOf('async function saveProfile()');
    const saveEnd = ranking.indexOf('// Clear all user-specific localStorage', saveAt);
    const saveBody = ranking.slice(saveAt, saveEnd);
    assert.ok(saveBody.indexOf('birthday') === -1);

    const privacy = read('privacy.html');
    assert.ok(privacy.includes('Birthday (optional, not shared)'));
    assert.ok(privacy.includes('not on your public profile'));

    console.log('birthday reward tests passed');
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
