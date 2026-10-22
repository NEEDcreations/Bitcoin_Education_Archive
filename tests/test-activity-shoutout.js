// Nacho activity shoutouts: forum posts and marketplace listings.
// No Firebase. Idempotency, rate limits, and title sanitizing.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    planActivityShoutout,
    sanitizeActivityTitle,
    applyActivityRate,
    ACTIVITY_AUTHOR_WINDOW_MS,
    ACTIVITY_GLOBAL_CAP,
} = require('../functions/src/shoutout');
const { publishShoutoutOnce } = require('../functions/src/shoutoutPublish');
const { announceActivity } = require('../functions/src/activityShoutout');

const root = path.join(__dirname, '..');
let passed = 0, failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}
function later(name, fn) {
    return fn().then(function() {
        console.log('✅ ' + name);
        passed++;
    }).catch(function(e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    });
}

const admin = {
    firestore: {
        FieldValue: {
            serverTimestamp: function() { return { _serverTimestamp: true }; },
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
                set: function(r, data) { staged.push({ path: r.path, data: data, merge: false }); },
                update: function(r, data) { staged.push({ path: r.path, data: data, merge: true, update: true }); },
            };
            const result = await fn(t);
            staged.forEach(function(w) {
                if (w.update && docs[w.path] == null) throw new Error('update missing ' + w.path);
                if (w.merge && docs[w.path]) docs[w.path] = Object.assign({}, docs[w.path], w.data);
                else docs[w.path] = w.data;
            });
            return result;
        },
    };
}

function user(extra) {
    return Object.assign({ username: 'phil', satsDisabled: false, banned: false }, extra || {});
}

function forumItem(extra) {
    return Object.assign({
        title: 'Why the halving matters',
        authorId: 'uid_phil',
        authorName: 'phil',
        body: 'hello',
    }, extra || {});
}

function listingItem(extra) {
    return Object.assign({
        title: 'Coldcard',
        sellerUid: 'uid_phil',
        sellerName: 'phil',
        priceSats: 1500,
        status: 'active',
        lightningAddress: 'phil@walletofsatoshi.com',
        description: 'email me at secret@example.com',
    }, extra || {});
}

test('a forum post plans one Nacho deep link and a stable doc id', function() {
    const plan = planActivityShoutout({
        kind: 'forum',
        id: 'post1',
        uid: 'uid_phil',
        item: forumItem(),
        user: user(),
    });
    assert.strictEqual(plan.post, true);
    assert.strictEqual(plan.docId, 'shoutout_forum_post1');
    assert.strictEqual(plan.authorUid, 'nacho-bot');
    assert.strictEqual(plan.authorName, 'Nacho 🦌');
    assert.strictEqual(plan.isNachoAuto, false);
    assert.strictEqual(plan.mentionUid, 'uid_phil');
    assert.strictEqual(plan.collection, 'global_chat');
    assert.strictEqual(plan.activityRef, 'forum:post1');
    assert.ok(plan.text.indexOf('📝 @phil just posted in PlebTalk: "Why the halving matters"') === 0);
    assert.ok(plan.text.indexOf('[Read it](#forum/post/post1)') !== -1);
    const again = planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil', item: forumItem(), user: user(),
    });
    assert.strictEqual(again.docId, plan.docId);
    assert.strictEqual(again.text, plan.text);
});

test('a listing includes a public price and a listing deep link', function() {
    const plan = planActivityShoutout({
        kind: 'marketplace',
        id: 'list1',
        uid: 'uid_phil',
        item: listingItem(),
        user: user(),
    });
    assert.strictEqual(plan.post, true);
    assert.strictEqual(plan.docId, 'shoutout_market_list1');
    assert.ok(plan.text.indexOf('🛒 @phil listed a new item in the Marketplace: "Coldcard" for 1,500 sats') === 0);
    assert.ok(plan.text.indexOf('[View it](#marketplace/listing/list1)') !== -1);
    assert.strictEqual(plan.text.indexOf('secret@example.com'), -1);
    assert.strictEqual(plan.text.indexOf('walletofsatoshi'), -1);
    assert.strictEqual(plan.text.indexOf('email me'), -1);
});

test('a hidden price is left out of the Nacho post', function() {
    const plan = planActivityShoutout({
        kind: 'marketplace',
        id: 'list1',
        uid: 'uid_phil',
        item: listingItem({ priceHidden: true, priceSats: 99999 }),
        user: user(),
    });
    assert.strictEqual(plan.post, true);
    assert.strictEqual(plan.text.indexOf('99999'), -1);
    assert.strictEqual(plan.text.indexOf(' for '), -1);
    assert.ok(plan.text.indexOf('"Coldcard"') !== -1);
});

test('titles are stripped of html, markdown, links, and emails, then truncated', function() {
    const dirty = '<b>Hello</b> [click](https://evil.example/phish) phil@example.com ' + 'x'.repeat(80);
    const clean = sanitizeActivityTitle(dirty);
    assert.strictEqual(clean.indexOf('<'), -1);
    assert.strictEqual(clean.indexOf('http'), -1);
    assert.strictEqual(clean.indexOf('@'), -1);
    assert.strictEqual(clean.indexOf('evil.example'), -1);
    assert.ok(clean.indexOf('Hello') === 0);
    assert.ok(clean.indexOf('click') !== -1);
    assert.ok(clean.length <= 80);
    assert.ok(clean.endsWith('…'));
    const plan = planActivityShoutout({
        kind: 'forum',
        id: 'post1',
        uid: 'uid_phil',
        item: forumItem({ title: 'See phil@example.com\n<script>alert(1)</script>' }),
        user: user(),
    });
    assert.strictEqual(plan.post, true);
    assert.strictEqual(plan.text.indexOf('@example.com'), -1);
    assert.strictEqual(plan.text.indexOf('<'), -1);
    assert.strictEqual(plan.text.indexOf('\n'), -1);
    assert.ok(plan.text.indexOf('See') !== -1);
});

test('an email-shaped display name is not copied into chat', function() {
    const plan = planActivityShoutout({
        kind: 'forum',
        id: 'post1',
        uid: 'uid_phil',
        item: forumItem({ authorName: 'phil@example.com' }),
        user: user({ username: 'phil' }),
    });
    assert.strictEqual(plan.post, true);
    assert.ok(plan.text.indexOf('@phil just posted') !== -1);
    assert.strictEqual(plan.text.indexOf('example.com'), -1);
});

test('slurs, spam, and scam titles are not announced', function() {
    const slur = planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil',
        item: forumItem({ title: 'this is shit' }), user: user(),
    });
    assert.strictEqual(slur.post, false);
    assert.strictEqual(slur.reason, 'profanity');
    const spam = planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil',
        item: forumItem({ title: 'BUY BITCOIN NOW SEND FAST PLEASE' }), user: user(),
    });
    assert.strictEqual(spam.post, false);
    assert.strictEqual(spam.reason, 'spam');
    const scam = planActivityShoutout({
        kind: 'marketplace', id: 'list1', uid: 'uid_phil',
        item: listingItem({ title: 'Double your bitcoin today' }), user: user(),
    });
    assert.strictEqual(scam.post, false);
    assert.strictEqual(scam.reason, 'scam');
    const ok = planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil',
        item: forumItem({ title: 'Halving notes for 2028' }), user: user(),
    });
    assert.strictEqual(ok.post, true);
});

test('replies, hidden listings, and banned accounts are skipped', function() {
    assert.strictEqual(planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil',
        item: forumItem({ parentId: 'parent' }), user: user(),
    }).reason, 'reply');
    assert.strictEqual(planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil',
        item: forumItem({ type: 'comment' }), user: user(),
    }).reason, 'reply');
    assert.strictEqual(planActivityShoutout({
        kind: 'marketplace', id: 'list1', uid: 'uid_phil',
        item: listingItem({ status: 'deleted' }), user: user(),
    }).reason, 'deleted');
    assert.strictEqual(planActivityShoutout({
        kind: 'marketplace', id: 'list1', uid: 'uid_phil',
        item: listingItem({ hidden: true }), user: user(),
    }).reason, 'hidden');
    assert.strictEqual(planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil', item: forumItem(),
        user: user({ banned: true }),
    }).reason, 'banned');
    assert.strictEqual(planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil', item: forumItem(),
        user: user({ satsDisabled: true }),
    }).reason, 'sats_disabled');
    assert.strictEqual(planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil', item: forumItem(),
        user: user(), ledger: { banned: true },
    }).reason, 'banned');
    assert.strictEqual(planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil', item: forumItem(),
        user: user(), addressLock: { banned: true },
    }).reason, 'linked');
});

test('author rate limit is 30 minutes per kind and the global cap is 10 an hour', function() {
    const now = 1_700_000_000_000;
    const blocked = applyActivityRate({
        nowMs: now,
        author: { lastAtMs: now - ACTIVITY_AUTHOR_WINDOW_MS + 1 },
        global: { stamps: [] },
    });
    assert.strictEqual(blocked.allow, false);
    assert.strictEqual(blocked.reason, 'author_rate');
    const open = applyActivityRate({
        nowMs: now,
        author: { lastAtMs: now - ACTIVITY_AUTHOR_WINDOW_MS },
        global: { stamps: [] },
    });
    assert.strictEqual(open.allow, true);
    const stamps = [];
    for (let i = 0; i < ACTIVITY_GLOBAL_CAP; i++) stamps.push(now - 1000);
    const full = applyActivityRate({ nowMs: now, author: {}, global: { stamps: stamps } });
    assert.strictEqual(full.allow, false);
    assert.strictEqual(full.reason, 'global_cap');
    const aged = applyActivityRate({
        nowMs: now,
        author: {},
        global: { stamps: [now - (60 * 60 * 1000) - 1] },
    });
    assert.strictEqual(aged.allow, true);
    assert.strictEqual(aged.global.stamps.length, 1);
});

const queue = [];

queue.push(later('a gift shoutout still posts once through the shared writer', async function() {
    const db = memoryDb({ 'gifts/gift_abc': { shoutoutPosted: false } });
    const plan = {
        collection: 'global_chat',
        docId: 'shoutout_gift_abc',
        authorUid: 'nacho-bot',
        authorName: 'Nacho 🦌',
        text: '🎉 Shoutout to @phil!',
        isNachoAuto: false,
        mentionUid: 'uid_phil',
    };
    const first = await publishShoutoutOnce({ db: db, admin: admin, markerRef: db.collection('gifts').doc('gift_abc'), plan: plan });
    assert.strictEqual(first.wrote, true);
    assert.strictEqual(db.docs['global_chat/shoutout_gift_abc'].uid, 'nacho-bot');
    assert.strictEqual(db.docs['global_chat/shoutout_gift_abc'].isNachoAuto, false);
    assert.strictEqual(db.docs['gifts/gift_abc'].shoutoutPosted, true);
    const second = await publishShoutoutOnce({
        db: db, admin: admin, markerRef: db.collection('gifts').doc('gift_abc'),
        plan: Object.assign({}, plan, { text: 'different' }),
    });
    assert.strictEqual(second.wrote, false);
    assert.strictEqual(second.reason, 'already_posted');
    assert.strictEqual(db.docs['global_chat/shoutout_gift_abc'].text, '🎉 Shoutout to @phil!');
}));

function seedActivity(db, kind, id, item) {
    const col = kind === 'marketplace' ? 'marketplace' : 'forum_posts';
    db.docs[col + '/' + id] = item;
    db.docs['users/uid_phil'] = user();
}

queue.push(later('the same post is announced once, even when the trigger runs again', async function() {
    const db = memoryDb();
    seedActivity(db, 'forum', 'post1', forumItem());
    const mirrors = [];
    const opts = {
        kind: 'forum', id: 'post1', db: db, admin: admin, graceMs: 0, nowMs: 5000,
        mirror: async function(args) { mirrors.push(args.docId); },
    };
    const first = await announceActivity(opts);
    assert.strictEqual(first.posted, true);
    assert.strictEqual(first.docId, 'shoutout_forum_post1');
    assert.strictEqual(db.docs['global_chat/shoutout_forum_post1'].uid, 'nacho-bot');
    assert.strictEqual(db.docs['global_chat/shoutout_forum_post1'].activityRef, 'forum:post1');
    assert.strictEqual(db.docs['shoutout_claims/shoutout_forum_post1'].status, 'posted');
    const second = await announceActivity(opts);
    assert.strictEqual(second.posted, false);
    assert.strictEqual(second.reason, 'already_posted');
    assert.strictEqual(db.docs['shoutout_limits/global'].stamps.length, 1);
    assert.deepStrictEqual(mirrors, ['shoutout_forum_post1', 'shoutout_forum_post1']);
}));

queue.push(later('a pre-created chat doc cannot suppress or forge the Nacho post', async function() {
    const db = memoryDb();
    seedActivity(db, 'forum', 'post1', forumItem());
    db.docs['global_chat/shoutout_forum_post1'] = { uid: 'uid_phil', text: 'fake nacho', name: 'Nacho 🦌' };
    const result = await announceActivity({
        kind: 'forum', id: 'post1', db: db, admin: admin, graceMs: 0, nowMs: 5000,
        mirror: async function() {},
    });
    assert.strictEqual(result.posted, true);
    assert.strictEqual(db.docs['global_chat/shoutout_forum_post1'].uid, 'nacho-bot');
    assert.ok(db.docs['global_chat/shoutout_forum_post1'].text.indexOf('[Read it](#forum/post/post1)') !== -1);
}));

queue.push(later('author and global caps skip without a second chat message', async function() {
    const now = 1_700_000_000_000;
    const db = memoryDb();
    seedActivity(db, 'forum', 'post1', forumItem());
    seedActivity(db, 'forum', 'post2', forumItem({ title: 'Second thought' }));
    const first = await announceActivity({
        kind: 'forum', id: 'post1', db: db, admin: admin, graceMs: 0, nowMs: now, mirror: async function() {},
    });
    assert.strictEqual(first.posted, true);
    const second = await announceActivity({
        kind: 'forum', id: 'post2', db: db, admin: admin, graceMs: 0, nowMs: now + 1000, mirror: async function() {},
    });
    assert.strictEqual(second.posted, false);
    assert.strictEqual(second.reason, 'author_rate');
    assert.strictEqual(db.docs['global_chat/shoutout_forum_post2'], undefined);
    assert.strictEqual(db.docs['shoutout_claims/shoutout_forum_post2'].status, 'skipped');
    assert.strictEqual(db.docs['shoutout_limits/global'].stamps.length, 1);
    const retry = await announceActivity({
        kind: 'forum', id: 'post2', db: db, admin: admin, graceMs: 0, nowMs: now + ACTIVITY_AUTHOR_WINDOW_MS + 5000,
        mirror: async function() {},
    });
    assert.strictEqual(retry.posted, false);
    assert.strictEqual(retry.reason, 'skipped');
    assert.strictEqual(db.docs['shoutout_limits/global'].stamps.length, 1);

    const market = await announceActivity({
        kind: 'marketplace', id: 'list1', db: db, admin: admin, graceMs: 0, nowMs: now + 2000,
        mirror: async function() {},
    });
    db.docs['marketplace/list1'] = listingItem();
    const marketPosted = await announceActivity({
        kind: 'marketplace', id: 'list1', db: db, admin: admin, graceMs: 0, nowMs: now + 2000,
        mirror: async function() {},
    });
    assert.strictEqual(market.posted, false);
    assert.strictEqual(marketPosted.posted, true);
    assert.strictEqual(db.docs['shoutout_limits/global'].stamps.length, 2);
    assert.ok(db.docs['global_chat/shoutout_market_list1'].text.indexOf('1,500 sats') !== -1);
}));

queue.push(later('a deleted or banned post is not announced', async function() {
    const db = memoryDb();
    const gone = await announceActivity({
        kind: 'forum', id: 'missing', db: db, admin: admin, graceMs: 0, mirror: async function() {},
    });
    assert.strictEqual(gone.posted, false);
    assert.strictEqual(gone.reason, 'deleted');
    assert.strictEqual(db.docs['global_chat/shoutout_forum_missing'], undefined);
    seedActivity(db, 'forum', 'post1', forumItem());
    db.docs['users/uid_phil'] = user({ satsDisabled: true });
    const banned = await announceActivity({
        kind: 'forum', id: 'post1', db: db, admin: admin, graceMs: 0, mirror: async function() {},
    });
    assert.strictEqual(banned.posted, false);
    assert.strictEqual(banned.reason, 'sats_disabled');
    assert.strictEqual(db.docs['global_chat/shoutout_forum_post1'], undefined);
}));

queue.push(later('the global cap stops the eleventh shoutout in an hour', async function() {
    const now = 1_700_000_000_000;
    const db = memoryDb({
        'shoutout_limits/global': { stamps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function(n) { return now - n; }) },
    });
    seedActivity(db, 'forum', 'post1', forumItem());
    const result = await announceActivity({
        kind: 'forum', id: 'post1', db: db, admin: admin, graceMs: 0, nowMs: now, mirror: async function() {},
    });
    assert.strictEqual(result.posted, false);
    assert.strictEqual(result.reason, 'global_cap');
    assert.strictEqual(db.docs['global_chat/shoutout_forum_post1'], undefined);
    assert.strictEqual(db.docs['shoutout_limits/global'].stamps.length, 10);
}));

test('triggers reuse the shoutout writer and clients cannot post as Nacho', function() {
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    assert.ok(index.indexOf('exports.onForumShoutout') !== -1);
    assert.ok(index.indexOf('exports.onMarketplaceShoutout') !== -1);
    assert.ok(index.indexOf("announceActivity({") !== -1);
    const activity = fs.readFileSync(path.join(root, 'functions', 'src', 'activityShoutout.js'), 'utf8');
    assert.ok(activity.indexOf('publishShoutoutOnce') !== -1);
    assert.ok(activity.indexOf('mirrorShoutoutOnce') !== -1);
    assert.strictEqual(activity.indexOf(".collection('global_chat').add"), -1);
    const forum = fs.readFileSync(path.join(root, 'forum.js'), 'utf8');
    assert.strictEqual(forum.indexOf('nachoGlobalAnnounce'), -1);
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    assert.ok(rules.indexOf('match /shoutout_claims/{claimId}') !== -1);
    assert.ok(rules.indexOf('match /shoutout_limits/{limitId}') !== -1);
    const claims = rules.slice(rules.indexOf('match /shoutout_claims/'), rules.indexOf('match /shoutout_limits/'));
    assert.ok(claims.indexOf('allow read, write: if false') !== -1);
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    assert.ok(app.indexOf('window.bqOpenForumPost') !== -1);
    assert.ok(app.indexOf('window.bqOpenMarketListing') !== -1);
    assert.ok(app.indexOf("hash.indexOf('forum/post/') === 0") !== -1);
    assert.ok(app.indexOf("hash.indexOf('marketplace/listing/') === 0") !== -1);
    const chat = fs.readFileSync(path.join(root, 'global-chat.js'), 'utf8');
    assert.ok(chat.indexOf('forum/post/') !== -1);
    assert.ok(chat.indexOf('marketplace/listing/') !== -1);
    assert.ok(chat.indexOf('window.formatChatText = formatChatText') !== -1);
});

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
