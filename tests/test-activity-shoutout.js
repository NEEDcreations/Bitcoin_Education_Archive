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
    ACTIVITY_AUTHOR_HOUR_CAP,
    ACTIVITY_GLOBAL_CAP,
    ACTIVITY_MIN_AGE_MS,
} = require('../functions/src/shoutout');
const { publishShoutoutOnce } = require('../functions/src/shoutoutPublish');
const { announceActivity, retractActivity, retractIfRemoved, activityShouldRetract } = require('../functions/src/activityShoutout');
const bridge = require('../functions/src/telegramBridge');

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
            delete: async function() { delete docs[docPath]; },
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

test('the name comes from the user profile, and a forged author name is ignored', function() {
    const plan = planActivityShoutout({
        kind: 'forum',
        id: 'post1',
        uid: 'uid_phil',
        item: forumItem({ authorName: '[click](https://evil.example) @NotPhil' }),
        user: user({ username: 'phil' }),
    });
    assert.strictEqual(plan.post, true);
    assert.ok(plan.text.indexOf('@phil just posted') !== -1);
    assert.strictEqual(plan.text.indexOf('NotPhil'), -1);
    assert.strictEqual(plan.text.indexOf('evil.example'), -1);
    assert.strictEqual(plan.text.split('@').length - 1, 1);
    const forged = planActivityShoutout({
        kind: 'marketplace',
        id: 'list1',
        uid: 'uid_phil',
        item: listingItem({ sellerName: 'Admin' }),
        user: user({ username: 'phil@desk' }),
    });
    assert.strictEqual(forged.post, true);
    assert.ok(forged.text.indexOf('@phildesk listed') !== -1);
    assert.strictEqual(forged.text.indexOf('Admin'), -1);
    assert.strictEqual(forged.text.split('@').length - 1, 1);
});

test('a title keeps exactly one @, the profile mention', function() {
    const plan = planActivityShoutout({
        kind: 'forum',
        id: 'post1',
        uid: 'uid_phil',
        item: forumItem({ title: 'hello @other and @third' }),
        user: user({ username: 'Dihn Aviney' }),
    });
    assert.strictEqual(plan.post, true);
    assert.ok(plan.text.indexOf('@Dihn Aviney just posted') !== -1);
    assert.strictEqual(plan.text.indexOf('@other'), -1);
    assert.strictEqual(plan.text.indexOf('@third'), -1);
    assert.strictEqual(plan.text.split('@').length - 1, 1);
    assert.ok(plan.text.indexOf('hello other and third') !== -1);
});

test('a missing profile or a blocked name is not announced', function() {
    assert.strictEqual(planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil', item: forumItem(), user: null,
    }).reason, 'no_user');
    assert.strictEqual(planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil', item: forumItem(), user: { banned: false },
    }).reason, 'no_user');
    assert.strictEqual(planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil', item: forumItem(),
        user: user({ username: 'shit' }),
    }).reason, 'profanity');
    assert.strictEqual(planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil', item: forumItem(),
        user: user({ username: 'phil@example.com' }),
    }).reason, 'email');
    assert.strictEqual(planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil', item: forumItem(),
        user: user({ isAnonymous: true }),
    }).reason, 'anonymous');
    const fresh = Date.now();
    assert.strictEqual(planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil', item: forumItem(),
        user: user({ created: fresh }), nowMs: fresh,
    }).reason, 'too_new');
    const aged = planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil', item: forumItem(),
        user: user({ created: fresh - ACTIVITY_MIN_AGE_MS }), nowMs: fresh,
    });
    assert.strictEqual(aged.post, true);
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
        hour: { stamps: [] },
        global: { stamps: [] },
    });
    assert.strictEqual(open.allow, true);
    assert.strictEqual(open.hour.stamps.length, 1);
    const hourStamps = [];
    for (let i = 0; i < ACTIVITY_AUTHOR_HOUR_CAP; i++) hourStamps.push(now - 1000);
    const crowded = applyActivityRate({
        nowMs: now,
        author: {},
        hour: { stamps: hourStamps },
        global: { stamps: [] },
    });
    assert.strictEqual(crowded.allow, false);
    assert.strictEqual(crowded.reason, 'author_hour');
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

test('telegram activity links are absolute quest URLs', function() {
    const forum = planActivityShoutout({
        kind: 'forum', id: 'post1', uid: 'uid_phil', item: forumItem(), user: user(),
    });
    const market = planActivityShoutout({
        kind: 'marketplace', id: 'list1', uid: 'uid_phil', item: listingItem(), user: user(),
    });
    assert.strictEqual(
        bridge.toTelegramText(forum.text),
        '📝 @phil just posted in PlebTalk: "Why the halving matters" → https://bitcoineducation.quest/#forum/post/post1'
    );
    assert.strictEqual(
        bridge.toTelegramText(market.text),
        '🛒 @phil listed a new item in the Marketplace: "Coldcard" for 1,500 sats → https://bitcoineducation.quest/#marketplace/listing/list1'
    );
    assert.strictEqual(bridge.toTelegramText(forum.text).indexOf('→ Read it'), -1);
    assert.strictEqual(bridge.toTelegramText('[Raid](#raid)'), 'Raid');
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
    assert.strictEqual(db.docs['shoutout_limits/hour_uid_phil'].stamps.length, 2);
    assert.ok(db.docs['global_chat/shoutout_market_list1'].text.indexOf('1,500 sats') !== -1);
    seedActivity(db, 'forum', 'post3', forumItem({ title: 'A third thought' }));
    let slept = 0;
    const third = await announceActivity({
        kind: 'forum', id: 'post3', db: db, admin: admin, graceMs: 10000,
        nowMs: now + ACTIVITY_AUTHOR_WINDOW_MS + 5000,
        eventData: forumItem({ title: 'A third thought' }),
        sleep: async function() { slept += 1; },
        mirror: async function() {},
    });
    assert.strictEqual(third.posted, false);
    assert.strictEqual(third.reason, 'author_hour');
    assert.strictEqual(slept, 0);
    assert.strictEqual(db.docs['global_chat/shoutout_forum_post3'], undefined);
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
    assert.ok(index.indexOf('exports.onForumShoutoutDeleted') !== -1);
    assert.ok(index.indexOf('exports.onMarketplaceShoutoutDeleted') !== -1);
    assert.ok(index.indexOf('exports.onForumShoutoutUpdated') !== -1);
    assert.ok(index.indexOf('exports.onMarketplaceShoutoutUpdated') !== -1);
    assert.ok(index.indexOf('retractIfRemoved({') !== -1);
    assert.ok(index.indexOf('maxInstances: 10') !== -1 || index.indexOf('maxInstances: ACTIVITY_SHOUTOUT_OPTS.maxInstances') !== -1);
    assert.ok(index.indexOf("announceActivity({") !== -1);
    assert.ok(index.indexOf('retractActivity({') !== -1);
    const activity = fs.readFileSync(path.join(root, 'functions', 'src', 'activityShoutout.js'), 'utf8');
    assert.ok(activity.indexOf('publishShoutoutOnce') !== -1);
    assert.ok(activity.indexOf('mirrorShoutoutOnce') !== -1);
    assert.ok(activity.indexOf('deleteTelegramMessage') !== -1);
    assert.strictEqual(activity.indexOf('authorName'), -1);
    assert.strictEqual(activity.indexOf('sellerName'), -1);
    assert.strictEqual(activity.indexOf(".collection('global_chat').add"), -1);
    const planner = fs.readFileSync(path.join(root, 'functions', 'src', 'shoutout.js'), 'utf8');
    const planFn = planner.slice(planner.indexOf('function planActivityShoutout'));
    assert.strictEqual(planFn.indexOf('item.authorName'), -1);
    assert.strictEqual(planFn.indexOf('item.sellerName'), -1);
    assert.strictEqual(planFn.indexOf('.authorName'), -1);
    assert.strictEqual(planFn.indexOf('.sellerName'), -1);
    assert.ok(planFn.indexOf('src.user.username') !== -1);
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
    const notes = fs.readFileSync(path.join(root, 'patch-notes.html'), 'utf8');
    const oct22At = notes.indexOf('id="2026-10-22"');
    const nextCard = notes.indexOf('<details class="patch"', oct22At + 1);
    assert.ok(oct22At !== -1 && nextCard > oct22At);
    const oct22 = notes.slice(oct22At, nextCard);
    assert.ok(oct22.indexOf('October 22, 2026') !== -1);
    assert.ok(oct22.indexOf('Nacho now gives a shout in Global Chat when someone starts a new PlebTalk thread or posts a Marketplace listing.') !== -1);
});

queue.push(later('a guest account is skipped after the cheap checks, without sleeping when rate limited', async function() {
    const now = 1_700_000_000_000;
    const db = memoryDb();
    seedActivity(db, 'forum', 'post1', forumItem());
    let lookups = 0;
    const guest = await announceActivity({
        kind: 'forum', id: 'post1', db: db, admin: admin, graceMs: 0, nowMs: now,
        eventData: forumItem(),
        getAuthUser: async function() { lookups += 1; return { providerData: [] }; },
        mirror: async function() {},
    });
    assert.strictEqual(guest.posted, false);
    assert.strictEqual(guest.reason, 'anonymous');
    assert.strictEqual(lookups, 1);
    assert.strictEqual(db.docs['global_chat/shoutout_forum_post1'], undefined);
    assert.strictEqual(db.docs['shoutout_claims/shoutout_forum_post1'].reason, 'anonymous');

    const limited = memoryDb();
    seedActivity(limited, 'forum', 'post9', forumItem());
    limited.docs['shoutout_limits/forum_uid_phil'] = { lastAtMs: now - 1000 };
    let slept = 0;
    let guestLookups = 0;
    const early = await announceActivity({
        kind: 'forum', id: 'post9', db: limited, admin: admin, graceMs: 10000, nowMs: now,
        eventData: forumItem(),
        sleep: async function() { slept += 1; },
        getAuthUser: async function() { guestLookups += 1; return { providerData: [{ providerId: 'google.com' }] }; },
        mirror: async function() {},
    });
    assert.strictEqual(early.posted, false);
    assert.strictEqual(early.reason, 'author_rate');
    assert.strictEqual(slept, 0);
    assert.strictEqual(guestLookups, 0);

    let titleSlept = 0;
    const noTitle = await announceActivity({
        kind: 'forum', id: 'notitle', db: db, admin: admin, graceMs: 10000,
        eventData: { authorId: 'uid_phil', body: 'no title yet' },
        sleep: async function() { titleSlept += 1; },
        mirror: async function() {},
    });
    assert.strictEqual(noTitle.posted, false);
    assert.strictEqual(noTitle.reason, 'missing');
    assert.strictEqual(titleSlept, 0);
}));

queue.push(later('deleting the source removes the matching Nacho post and its Telegram message', async function() {
    const db = memoryDb();
    db.docs['global_chat/shoutout_forum_post1'] = {
        uid: 'nacho-bot',
        activityRef: 'forum:post1',
        text: 'hello',
        telegramChatId: '-100',
        telegramMsgId: '55',
    };
    db.docs['notifications/shoutout_forum_post1'] = { type: 'chat_mention' };
    const dropped = [];
    const removed = await retractActivity({
        kind: 'forum', id: 'post1', db: db,
        deleteTelegram: async function(args) { dropped.push(args.chatId + ':' + args.messageId); },
    });
    assert.strictEqual(removed.deleted, true);
    assert.deepStrictEqual(dropped, ['-100:55']);
    assert.strictEqual(db.docs['global_chat/shoutout_forum_post1'], undefined);
    assert.strictEqual(db.docs['notifications/shoutout_forum_post1'], undefined);

    db.docs['global_chat/shoutout_market_list1'] = { uid: 'uid_phil', activityRef: 'market:list1', text: 'fake' };
    const mismatch = await retractActivity({
        kind: 'marketplace', id: 'list1', db: db,
        deleteTelegram: async function() { throw new Error('should not delete'); },
    });
    assert.strictEqual(mismatch.deleted, false);
    assert.strictEqual(mismatch.reason, 'mismatch');
    assert.strictEqual(db.docs['global_chat/shoutout_market_list1'].text, 'fake');
}));

test('a soft-delete or hide is the change that pulls a shoutout', function() {
    assert.strictEqual(activityShouldRetract({ status: 'active' }, { status: 'deleted', deletedAt: 1 }), true);
    assert.strictEqual(activityShouldRetract({ status: 'active' }, { status: 'removed' }), true);
    assert.strictEqual(activityShouldRetract({ status: 'active' }, { status: 'hidden' }), true);
    assert.strictEqual(activityShouldRetract({}, { hidden: true }), true);
    assert.strictEqual(activityShouldRetract({}, { deletedAt: { seconds: 1 } }), true);
    assert.strictEqual(activityShouldRetract({ status: 'active' }, { moderated: true }), true);
    assert.strictEqual(activityShouldRetract({ status: 'active' }, { moderationHidden: true }), true);
    assert.strictEqual(activityShouldRetract({ status: 'active' }, { status: 'moderated' }), true);
    assert.strictEqual(activityShouldRetract({ status: 'active' }, { status: 'banned' }), true);
    assert.strictEqual(activityShouldRetract({ moderated: true }, { moderated: true, views: 2 }), false);
    assert.strictEqual(activityShouldRetract({ status: 'active' }, { status: 'sold' }), false);
    assert.strictEqual(activityShouldRetract({ status: 'active' }, { status: 'active', replyCount: 2 }), false);
    assert.strictEqual(activityShouldRetract({ status: 'deleted', deletedAt: 1 }, { status: 'deleted', deletedAt: 1, views: 3 }), false);
});

queue.push(later('marking a listing deleted removes the Nacho post, and a sale does not', async function() {
    const db = memoryDb();
    db.docs['global_chat/shoutout_market_list1'] = {
        uid: 'nacho-bot',
        activityRef: 'market:list1',
        text: 'listed',
        telegramChatId: '9',
        telegramMsgId: '8',
    };
    const dropped = [];
    const sold = await retractIfRemoved({
        kind: 'marketplace', id: 'list1', db: db,
        before: { status: 'active' },
        after: { status: 'sold' },
        deleteTelegram: async function() { dropped.push('sold'); },
    });
    assert.strictEqual(sold.deleted, false);
    assert.strictEqual(sold.reason, 'still_live');
    assert.strictEqual(db.docs['global_chat/shoutout_market_list1'].text, 'listed');
    const gone = await retractIfRemoved({
        kind: 'marketplace', id: 'list1', db: db,
        before: { status: 'active' },
        after: { status: 'deleted', deletedAt: 5, deletedBy: 'owner' },
        deleteTelegram: async function(args) { dropped.push(args.messageId); },
    });
    assert.strictEqual(gone.deleted, true);
    assert.deepStrictEqual(dropped, ['8']);
    assert.strictEqual(db.docs['global_chat/shoutout_market_list1'], undefined);

    db.docs['global_chat/shoutout_forum_post1'] = {
        uid: 'nacho-bot', activityRef: 'forum:post1', text: 'posted',
    };
    const edit = await retractIfRemoved({
        kind: 'forum', id: 'post1', db: db,
        before: { title: 'Old' },
        after: { title: 'New', edited: true },
        deleteTelegram: async function() { throw new Error('edit should stay'); },
    });
    assert.strictEqual(edit.reason, 'still_live');
    const hidden = await retractIfRemoved({
        kind: 'forum', id: 'post1', db: db,
        before: { title: 'New' },
        after: { title: 'New', hidden: true },
        deleteTelegram: async function() {},
    });
    assert.strictEqual(hidden.deleted, true);
    assert.strictEqual(db.docs['global_chat/shoutout_forum_post1'], undefined);

    db.docs['global_chat/shoutout_forum_post2'] = {
        uid: 'nacho-bot', activityRef: 'forum:post2', text: 'posted',
        telegramChatId: '3', telegramMsgId: '4',
    };
    const moderated = await retractIfRemoved({
        kind: 'forum', id: 'post2', db: db,
        before: { title: 'Live' },
        after: { title: 'Live', status: 'moderated', moderated: true },
        deleteTelegram: async function(args) { dropped.push('mod:' + args.messageId); },
    });
    assert.strictEqual(moderated.deleted, true);
    assert.ok(dropped.indexOf('mod:4') !== -1);
    assert.strictEqual(db.docs['global_chat/shoutout_forum_post2'], undefined);
}));

function changeSourceAfterFreshRead(db, docPath, next) {
    const real = db.collection.bind(db);
    const colName = docPath.split('/')[0];
    const docId = docPath.split('/')[1];
    let reads = 0;
    db.collection = function(name) {
        const col = real(name);
        if (name !== colName) return col;
        const origDoc = col.doc.bind(col);
        col.doc = function(id) {
            const r = origDoc(id);
            if (id !== docId) return r;
            const realGet = r.get.bind(r);
            r.get = async function() {
                reads += 1;
                const snap = await realGet();
                if (reads === 1) next();
                return snap;
            };
            return r;
        };
        return col;
    };
}

queue.push(later('the write re-reads the source and skips a post removed during the grace window', async function() {
    const db = memoryDb();
    seedActivity(db, 'forum', 'post1', forumItem());
    changeSourceAfterFreshRead(db, 'forum_posts/post1', function() {
        delete db.docs['forum_posts/post1'];
    });
    const gone = await announceActivity({
        kind: 'forum', id: 'post1', db: db, admin: admin, graceMs: 0, nowMs: 5000,
        eventData: forumItem(),
        mirror: async function() { throw new Error('removed post should not mirror'); },
    });
    assert.strictEqual(gone.posted, false);
    assert.strictEqual(gone.reason, 'deleted');
    assert.strictEqual(db.docs['global_chat/shoutout_forum_post1'], undefined);
    assert.strictEqual(db.docs['shoutout_claims/shoutout_forum_post1'].status, 'skipped');
    assert.strictEqual(db.docs['shoutout_claims/shoutout_forum_post1'].reason, 'deleted');
    assert.strictEqual(db.docs['shoutout_limits/global'], undefined);

    const moderatedDb = memoryDb();
    seedActivity(moderatedDb, 'forum', 'post2', forumItem());
    changeSourceAfterFreshRead(moderatedDb, 'forum_posts/post2', function() {
        const live = moderatedDb.docs['forum_posts/post2'];
        moderatedDb.docs['forum_posts/post2'] = Object.assign({}, live, { status: 'moderated', moderated: true });
    });
    const moderated = await announceActivity({
        kind: 'forum', id: 'post2', db: moderatedDb, admin: admin, graceMs: 0, nowMs: 5000,
        eventData: forumItem(),
        mirror: async function() { throw new Error('moderated post should not mirror'); },
    });
    assert.strictEqual(moderated.posted, false);
    assert.strictEqual(moderated.reason, 'hidden');
    assert.strictEqual(moderatedDb.docs['global_chat/shoutout_forum_post2'], undefined);
    assert.strictEqual(moderatedDb.docs['shoutout_claims/shoutout_forum_post2'].reason, 'hidden');

    const soldDb = memoryDb();
    seedActivity(soldDb, 'marketplace', 'list1', listingItem());
    changeSourceAfterFreshRead(soldDb, 'marketplace/list1', function() {
        const live = soldDb.docs['marketplace/list1'];
        soldDb.docs['marketplace/list1'] = Object.assign({}, live, { status: 'sold' });
    });
    const sold = await announceActivity({
        kind: 'marketplace', id: 'list1', db: soldDb, admin: admin, graceMs: 0, nowMs: 8000,
        eventData: listingItem(),
        mirror: async function() {},
    });
    assert.strictEqual(sold.posted, true);
    assert.strictEqual(soldDb.docs['global_chat/shoutout_market_list1'].uid, 'nacho-bot');
}));

test('formatChatText chips a multi-word name before posted and listed', function() {
    const vm = require('vm');
    function noop() {}
    const document = {
        addEventListener: noop,
        removeEventListener: noop,
        getElementById: function() { return null; },
        createElement: function() { return { style: {}, appendChild: noop, addEventListener: noop }; },
    };
    const context = vm.createContext({
        document: document,
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        navigator: { userAgent: '' },
        location: { hash: '', pathname: '/' },
        history: { pushState: noop, replaceState: noop },
        localStorage: { getItem: function() { return null; }, setItem: noop },
        fetch: function() { return Promise.resolve({ json: function() { return {}; } }); },
        addEventListener: noop,
        removeEventListener: noop,
        innerWidth: 1024,
        innerHeight: 800,
    });
    context.window = context;
    const chatSrc = fs.readFileSync(path.join(root, 'global-chat.js'), 'utf8');
    for (let attempt = 0; attempt < 12; attempt++) {
        try {
            vm.runInContext(chatSrc, context, { filename: 'global-chat.js' });
            break;
        } catch (err) {
            const missing = String(err && err.message || '').match(/^(\w+) is not defined$/);
            if (!missing || attempt === 11) throw err;
            context[missing[1]] = function() {};
        }
    }
    const esc = function(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    const posted = '📝 @Dihn Aviney just posted in PlebTalk: "Halving" → [Read it](#forum/post/abc)';
    const listed = '🛒 @Dihn Aviney listed a new item in the Marketplace: "Coldcard" → [View it](#marketplace/listing/xyz)';
    const postedHtml = context.formatChatText(esc(posted), 'uid_dihn');
    const listedHtml = context.formatChatText(esc(listed), 'uid_dihn');
    assert.ok(postedHtml.indexOf('>@Dihn Aviney<') !== -1, postedHtml);
    assert.ok(postedHtml.indexOf('data-profile-uid="uid_dihn"') !== -1);
    assert.ok(postedHtml.indexOf('just posted') !== -1);
    assert.ok(postedHtml.indexOf('bqOpenForumPost(\'abc\')') !== -1);
    assert.ok(listedHtml.indexOf('>@Dihn Aviney<') !== -1, listedHtml);
    assert.ok(listedHtml.indexOf('listed') !== -1);
    assert.ok(listedHtml.indexOf('bqOpenMarketListing(\'xyz\')') !== -1);
    const unicode = context.formatChatText(esc('📝 @佐藤 just posted in PlebTalk: "Note"'), 'uid_sato');
    assert.ok(unicode.indexOf('>@佐藤<') !== -1, unicode);
    const jose = '🎉 Shoutout to @José García! They just unlocked a rare Nacho Shoutout. Go send @José García a peer request! 🤝';
    const joseHtml = context.formatChatText(esc(jose), 'uid_jose');
    assert.ok(joseHtml.indexOf('>@José García<') !== -1, joseHtml);
    assert.strictEqual(joseHtml.indexOf('>@Jos<'), -1);
    assert.strictEqual((joseHtml.match(/data-profile-uid="uid_jose"/g) || []).length, 1);
    assert.ok(joseHtml.indexOf('Go send José García a peer request') !== -1, joseHtml);
    const hostile = context.formatChatText(
        esc('🎉 Shoutout to @José <img src=x onerror=alert(1)>! Go send @José a peer request!'),
        '"><img src=x onerror=alert(1)>'
    );
    assert.ok(hostile.indexOf('>@José<') !== -1, hostile);
    assert.strictEqual(hostile.indexOf('<img'), -1);
    assert.strictEqual(hostile.indexOf('<script'), -1);
    assert.ok(hostile.indexOf('&lt;img') !== -1, hostile);
    assert.ok(hostile.indexOf('data-profile-uid="&quot;&gt;&lt;img') !== -1, hostile);
    assert.ok(hostile.indexOf('Go send José a peer request') !== -1, hostile);
});

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
