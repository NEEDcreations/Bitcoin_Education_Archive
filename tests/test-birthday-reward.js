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

function baseInput(extra) {
    return Object.assign({
        birthday: { month: 11, day: 9, uid: 'alice', setAt: now - 86400000 },
        markerExists: false,
        userExists: true,
        user: { orangeTickets: 2 },
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
    birthday: { month: 11, day: 9, setAt: now - 1000 },
})).award, true, 'year is optional');

assert.strictEqual(birthday.decideBirthdayAward(baseInput({ markerExists: true })).reason, 'already-awarded');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({ userExists: false })).reason, 'missing-user');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({ user: { ban_reason: 'spam' } })).reason, 'banned');
assert.strictEqual(birthday.decideBirthdayAward(baseInput({ user: { banned: true } })).reason, 'banned');
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
    birthday: { month: 2, day: 29, setAt: now - 86400000 },
})).award, true, 'Feb 29 is paid on Feb 28 in a non-leap year');

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
            };
            const result = await fn(t);
            writes.forEach(function (write) {
                const kind = write[0];
                const docPath = write[1];
                const data = write[2];
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

function deps(notices) {
    return {
        increment: function (n) { return { __inc: n }; },
        serverTimestamp: function () { return now; },
        notify: function (writer, db, spec) {
            notices.push(spec);
            writer.set(db.collection('notifications').doc('rn_' + spec.uid + '_' + spec.onceKey), {
                tickets: spec.tickets,
                message: '+25 🎟️ from ' + spec.sourceLabel,
            });
        },
    };
}

(async function () {
    const notices = [];
    const db = memoryDb({
        'users/alice': { orangeTickets: 4 },
        'users/alice/birthday/profile': { month: 11, day: 9, uid: 'alice', setAt: now - 86400000 },
        'users/bob': { orangeTickets: 1, ban_reason: 'spam' },
        'users/bob/birthday/profile': { month: 11, day: 9, uid: 'bob', setAt: now - 86400000 },
        'users/cara': { orangeTickets: 0 },
        'users/cara/birthday/profile': {
            month: 11,
            day: 9,
            uid: 'cara',
            setAt: now - (400 * 86400000),
            revisedAt: now - (2 * 86400000),
        },
        'users/erin/birthday/extra': { month: 11, day: 9, uid: 'erin', setAt: now },
    });
    const first = await birthday.runBirthdayAwards(db, deps(notices), now);
    assert.strictEqual(first.awarded, 1);
    assert.strictEqual(first.nyDate, '2026-11-09');
    assert.strictEqual(db.docs.get('users/alice').orangeTickets, 29);
    assert.strictEqual(db.docs.get('users/alice/birthday_awards/2026').tickets, 25);
    assert.strictEqual(db.docs.get('users/bob').orangeTickets, 1);
    assert.strictEqual(db.docs.has('users/bob/birthday_awards/2026'), false);
    assert.strictEqual(db.docs.has('users/cara/birthday_awards/2026'), false);
    assert.strictEqual(notices.length, 1);
    assert.strictEqual(notices[0].tickets, 25);
    assert.strictEqual(notices[0].sourceLabel, 'your birthday');

    const second = await birthday.runBirthdayAwards(db, deps(notices), now);
    assert.strictEqual(second.awarded, 0);
    assert.strictEqual(db.docs.get('users/alice').orangeTickets, 29);
    assert.ok(second.skipped['already-awarded'] >= 1);

    const leapDb = memoryDb({
        'users/leap': { orangeTickets: 0 },
        'users/leap/birthday/profile': { month: 2, day: 29, uid: 'leap', setAt: Date.UTC(2020, 0, 1) },
    });
    const leapNow = Date.UTC(2026, 1, 28, 15, 0, 0);
    const leapRun = await birthday.runBirthdayAwards(leapDb, deps([]), leapNow);
    assert.strictEqual(birthday.nyDateParts(new Date(leapNow)).day, 28);
    assert.strictEqual(leapRun.awarded, 1);
    assert.strictEqual(leapDb.docs.get('users/leap').orangeTickets, 25);

    assert.ok(del.USER_SUBCOLLECTIONS.indexOf('birthday') !== -1);
    assert.ok(del.USER_SUBCOLLECTIONS.indexOf('birthday_awards') !== -1);
    assert.ok(del.CAP_SUBCOLLECTIONS.indexOf('birthday') === -1);
    assert.ok(del.RETAINED_COLLECTIONS.indexOf('birthday') === -1);

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
        return row.collectionGroup === 'birthday' && row.queryScope === 'COLLECTION_GROUP';
    });
    assert.strictEqual(birthdayIndexes.length, 1);
    assert.deepStrictEqual(birthdayIndexes[0].fields.map(function (field) { return field.fieldPath; }), ['month', 'day']);

    const rules = read('firestore.rules');
    assert.ok(rules.includes('match /birthday/{docId}'));
    assert.ok(rules.includes('match /birthday_awards/{yearId}'));
    assert.ok(rules.includes("docId == 'profile'"));

    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(html.includes('id="signupBirthdayMonth"'));
    assert.ok(html.includes('not shared'));
    assert.ok(html.includes('ranking.js?v=20261109_v2534'));
    assert.ok(read('sw.js').includes("const CACHE_NAME = 'btc-archive-v2534'"));

    const ranking = read('ranking.js');
    assert.ok(ranking.includes("collection('birthday').doc('profile')"));
    assert.ok(ranking.includes('not shared'));
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
