// Server-side marketplace listing counter.
// Run: node tests/test-market-listing-count.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { countMarketplaceListing } = require('../functions/src/marketListingCount');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
    const run = fn();
    const finish = function() {
        console.log('✅ ' + name);
        passed++;
    };
    const fail = function(e) {
        console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
        failed++;
    };
    if (run && typeof run.then === 'function') return run.then(finish, fail);
    try { finish(); } catch (e) { fail(e); }
    return Promise.resolve();
}

const admin = {
    firestore: {
        FieldValue: {
            serverTimestamp: function() { return { _serverTimestamp: true }; },
            increment: function(n) { return { _increment: n }; },
        },
    },
};

function memoryDb(seed) {
    const docs = Object.assign({}, seed || {});
    function ref(docPath) {
        return {
            path: docPath,
            get: async function() {
                const data = docs[docPath];
                return {
                    exists: data != null,
                    data: function() { return data ? Object.assign({}, data) : undefined; },
                };
            },
        };
    }
    return {
        docs: docs,
        collection: function(name) {
            return { doc: function(id) { return ref(name + '/' + id); } };
        },
        runTransaction: async function(fn) {
            const staged = [];
            const t = {
                get: function(r) { return r.get(); },
                set: function(r, data) { staged.push({ path: r.path, data: data }); },
                update: function(r, data) { staged.push({ path: r.path, data: data, update: true }); },
            };
            const result = await fn(t);
            staged.forEach(function(w) {
                if (w.update) {
                    if (docs[w.path] == null) throw new Error('update missing ' + w.path);
                    const next = Object.assign({}, docs[w.path]);
                    Object.keys(w.data).forEach(function(key) {
                        const value = w.data[key];
                        if (value && value._increment) next[key] = (next[key] || 0) + value._increment;
                        else next[key] = value;
                    });
                    docs[w.path] = next;
                } else {
                    docs[w.path] = w.data;
                }
            });
            return result;
        },
    };
}

function listing(extra) {
    return Object.assign({
        title: 'Coldcard',
        sellerUid: 'seller1',
        status: 'active',
    }, extra || {});
}

const queue = [];

queue.push(test('an active listing increments only its seller, once', async function() {
    const db = memoryDb({ 'users/seller1': { username: 'phil', marketListings: 2 } });
    const first = await countMarketplaceListing({
        db: db, admin: admin, listingId: 'AbC1234567890xyzABCD', data: listing(),
    });
    assert.strictEqual(first.counted, true);
    assert.strictEqual(db.docs['users/seller1'].marketListings, 3);
    assert.strictEqual(db.docs['market_listing_counts/AbC1234567890xyzABCD'].sellerUid, 'seller1');
    const second = await countMarketplaceListing({
        db: db, admin: admin, listingId: 'AbC1234567890xyzABCD', data: listing(),
    });
    assert.strictEqual(second.reason, 'already_counted');
    assert.strictEqual(db.docs['users/seller1'].marketListings, 3);
}));

queue.push(test('moderated, hidden, and non-active listings are not counted', async function() {
    const db = memoryDb({ 'users/seller1': { marketListings: 0 } });
    const cases = [
        listing({ moderated: true }),
        listing({ moderationHidden: true }),
        listing({ hidden: true }),
        listing({ status: 'deleted' }),
        listing({ status: 'sold' }),
        listing({ sellerUid: '' }),
        listing({ sellerUid: 'someone-else' }),
    ];
    for (let i = 0; i < cases.length; i++) {
        const result = await countMarketplaceListing({
            db: db, admin: admin, listingId: 'listing' + i, data: cases[i],
        });
        assert.strictEqual(result.counted, false, 'case ' + i);
    }
    assert.strictEqual(db.docs['users/seller1'].marketListings, 0);
    assert.strictEqual(db.docs['users/someone-else'], undefined);
}));

queue.push(test('a listing whose seller doc is missing is not counted', async function() {
    const db = memoryDb({});
    const result = await countMarketplaceListing({
        db: db, admin: admin, listingId: 'AbC1234567890xyzABCD', data: listing(),
    });
    assert.strictEqual(result.reason, 'no_user');
    assert.strictEqual(db.docs['market_listing_counts/AbC1234567890xyzABCD'], undefined);
}));

queue.push(test('the client no longer increments marketListings and the trigger is wired', function() {
    const market = fs.readFileSync(path.join(root, 'marketplace.js'), 'utf8');
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    assert.strictEqual(market.includes('marketListings: firebase.firestore.FieldValue.increment'), false);
    assert.ok(market.includes('function refreshMarketListingBadges(uid)'));
    assert.ok(index.includes('exports.onMarketplaceListingCount'));
    const profileKeys = rules.slice(rules.indexOf('function userProfileServerOnlyKeys()'), rules.indexOf('match /users/{userId}'));
    assert.ok(profileKeys.includes("'marketListings'"));
    assert.ok(profileKeys.includes("'marketMessages'"));
    assert.ok(rules.includes('match /market_listing_daily/{docId}'));
    assert.ok(rules.includes('match /market_listing_counts/{listingId}'));
    assert.ok(rules.includes('allow read, write: if false'));
}));

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
