#!/usr/bin/env node
// users/{uid} writes recompute the referrer's referralMaxiCount.
// Crossing Maxi and a ban do not write the referral doc again.
const assert = require('assert');
const path = require('path');

const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const service = require(path.join(__dirname, '..', 'functions', 'src', 'referralService'));

function memoryDb(seed) {
    const docs = Object.assign({}, seed);
    function ref(docPath) {
        return {
            path: docPath,
            get: async function () {
                const data = docs[docPath];
                return {
                    exists: data != null,
                    id: docPath.split('/')[1],
                    data: function () { return data == null ? undefined : Object.assign({}, data); }
                };
            }
        };
    }
    function apply(docPath, patch) {
        docs[docPath] = Object.assign({}, docs[docPath] || {}, patch);
    }
    const db = {
        collection: function (name) {
            return {
                doc: function (id) { return ref(name + '/' + id); },
                where: function (field, op, value) {
                    assert.strictEqual(op, '==');
                    return {
                        get: async function () {
                            const found = [];
                            Object.keys(docs).forEach(function (key) {
                                if (key.indexOf(name + '/') !== 0 || docs[key] == null) return;
                                if (docs[key][field] !== value) return;
                                const id = key.split('/')[1];
                                found.push({
                                    id: id,
                                    data: function () { return Object.assign({}, docs[key]); }
                                });
                            });
                            return {
                                empty: found.length === 0,
                                docs: found,
                                forEach: function (fn) { found.forEach(fn); }
                            };
                        }
                    };
                }
            };
        },
        getAll: function () {
            return Promise.all(Array.prototype.slice.call(arguments).map(function (item) { return item.get(); }));
        },
        runTransaction: async function (fn) {
            const t = {
                get: function (item) { return item.get(); },
                update: function (item, patch) { apply(item.path, patch); }
            };
            await fn(t);
        }
    };
    db.read = function (docPath) { return docs[docPath]; };
    return db;
}

function useDb(db) {
    Object.defineProperty(admin, 'firestore', {
        configurable: true,
        writable: true,
        value: function () { return db; }
    });
}
let passed = 0;
let failed = 0;
function test(name, fn) {
    return Promise.resolve().then(fn).then(function () {
        console.log('✅ ' + name);
        passed++;
    }).catch(function (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    });
}

function creditedReferral(referrerUid) {
    return {
        status: 'paid',
        verified: true,
        ticketsAwarded: true,
        referrerUid: referrerUid,
        referredUid: 'referee'
    };
}

function userEvent(uid, before, after) {
    return {
        params: { uid: uid },
        data: {
            before: { exists: !!before, data: function () { return before || {}; } },
            after: after ? { exists: true, data: function () { return after; } } : { exists: false, data: function () { return {}; } }
        }
    };
}

async function main() {
    await test('crossing 2,140 recomputes the referrer from the user write', async function () {
        const db = memoryDb({
            'users/referee': { points: 2140, referralCode: 'CODECODE', referredBy: 'HOSTCODE' },
            'users/referrer': { points: 10, referralCode: 'HOSTCODE', referralMaxiCount: 0, referralCount: 1 },
            'referrals/referee': creditedReferral('referrer')
        });
        useDb(db);
        await service.onUserWritten(userEvent('referee', { points: 2139, referralCode: 'CODECODE' }, { points: 2140, referralCode: 'CODECODE' }));
        assert.strictEqual(db.read('users/referrer').referralMaxiCount, 1);
        assert.strictEqual(db.read('referrals/referee').status, 'paid');
    });

    await test('a ban drops the referrer count without rewriting the referral', async function () {
        const db = memoryDb({
            'users/referee': { points: 3000, referralCode: 'CODECODE', banned: true },
            'users/referrer': { points: 10, referralCode: 'HOSTCODE', referralMaxiCount: 1, referralCount: 1 },
            'referrals/referee': creditedReferral('referrer')
        });
        useDb(db);
        const before = { points: 3000, referralCode: 'CODECODE', banned: false };
        const after = { points: 3000, referralCode: 'CODECODE', banned: true };
        await service.onUserWritten(userEvent('referee', before, after));
        assert.strictEqual(db.read('users/referrer').referralMaxiCount, 0);
        assert.strictEqual(db.read('referrals/referee').status, 'paid');
        assert.strictEqual(db.read('referrals/referee').verified, true);
    });

    await test('sats-disabled and deletion recompute the same way', async function () {
        const disabled = memoryDb({
            'users/referee': { points: 3000, referralCode: 'CODECODE', satsDisabled: true },
            'users/referrer': { referralMaxiCount: 1, referralCount: 1 },
            'referrals/referee': creditedReferral('referrer')
        });
        useDb(disabled);
        await service.onUserWritten(userEvent(
            'referee',
            { points: 3000, referralCode: 'CODECODE', satsDisabled: false },
            { points: 3000, referralCode: 'CODECODE', satsDisabled: true }
        ));
        assert.strictEqual(disabled.read('users/referrer').referralMaxiCount, 0);

        const deleted = memoryDb({
            'users/referrer': { referralMaxiCount: 1, referralCount: 1 },
            'referrals/referee': creditedReferral('referrer')
        });
        useDb(deleted);
        await service.onUserWritten(userEvent('referee', { points: 3000, referralCode: 'CODECODE' }, null));
        assert.strictEqual(deleted.read('users/referrer').referralMaxiCount, 0);
    });

    await test('points that stay under Maxi do not write the referrer', async function () {
        const db = memoryDb({
            'users/referee': { points: 500, referralCode: 'CODECODE' },
            'users/referrer': { referralMaxiCount: 7, referralCount: 1 },
            'referrals/referee': creditedReferral('referrer')
        });
        useDb(db);
        await service.onUserWritten(userEvent(
            'referee',
            { points: 100, referralCode: 'CODECODE' },
            { points: 500, referralCode: 'CODECODE' }
        ));
        assert.strictEqual(db.read('users/referrer').referralMaxiCount, 7);
    });

    delete admin.firestore;
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
