// Article publish XP. The trigger re-reads the article and pays once.
// Run: node tests/test-article-publish-xp.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    handleArticlePublishWrite,
    grantArticlePublish,
    stripMarkup,
    PUBLISH_XP,
    REVERSE_WINDOW_MS,
    MAX_BODY_CHARS,
    MIN_WORDS,
} = require('../functions/src/articlePublishXp');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
    let run;
    try { run = fn(); }
    catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
        failed++;
        return Promise.resolve();
    }
    const finish = function () {
        console.log('✅ ' + name);
        passed++;
    };
    const fail = function (e) {
        console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
        failed++;
    };
    if (run && typeof run.then === 'function') return run.then(finish, fail);
    finish();
    return Promise.resolve();
}

const admin = {
    firestore: {
        FieldValue: {
            serverTimestamp: function () { return { _serverTimestamp: true }; },
            increment: function (n) { return { _increment: n }; },
        },
    },
};

function applyWrite(docs, write) {
    const prev = docs[write.path];
    const base = write.merge && prev ? Object.assign({}, prev) : {};
    const next = write.merge ? base : {};
    Object.keys(write.data).forEach(function (key) {
        const value = write.data[key];
        if (value && value._increment) next[key] = (Number(next[key]) || 0) + value._increment;
        else next[key] = value;
    });
    docs[write.path] = next;
}

function memoryDb(seed) {
    const docs = Object.assign({}, seed || {});
    function ref(docPath) {
        return {
            path: docPath,
            collection: function (name) {
                return { doc: function (id) { return ref(docPath + '/' + name + '/' + id); } };
            },
            get: async function () {
                const data = docs[docPath];
                return {
                    exists: data != null,
                    data: function () { return data ? Object.assign({}, data) : undefined; },
                };
            },
        };
    }
    return {
        docs: docs,
        collection: function (name) {
            return { doc: function (id) { return ref(name + '/' + id); } };
        },
        runTransaction: async function (fn) {
            const staged = [];
            const t = {
                get: function (r) { return r.get(); },
                set: function (r, data, options) {
                    staged.push({ path: r.path, data: data, merge: !!(options && options.merge) });
                },
                update: function (r, data) {
                    staged.push({ path: r.path, data: data, merge: true, update: true });
                },
            };
            const result = await fn(t);
            staged.forEach(function (w) {
                if (w.update && docs[w.path] == null) throw new Error('update missing ' + w.path);
                applyWrite(docs, w);
            });
            return result;
        },
    };
}

const NOW = Date.UTC(2026, 9, 26, 12, 0, 0);
const LONG = 'Bitcoin is sound money. '.repeat(20);

function article(extra) {
    return Object.assign({
        title: 'Why Bitcoin is sound money',
        body: LONG,
        authorId: 'author1',
        status: 'published',
    }, extra || {});
}

function seedUser(extra) {
    const docs = {
        'users/author1': Object.assign({ points: 10, weeklyXP: 10, monthlyXP: 10 }, extra || {}),
    };
    return docs;
}

function pointsOf(db) {
    return db.docs['users/author1'].points;
}

async function publish(db, articleId, data, uid) {
    db.docs['articles/' + articleId] = data;
    return handleArticlePublishWrite({
        db: db,
        admin: admin,
        articleId: articleId,
        before: null,
        after: data,
        uid: uid,
        nowMs: NOW,
    });
}

const queue = [];

queue.push(test('a published article pays 30 once, and an edit does not pay again', async function () {
    const db = memoryDb(seedUser());
    const data = article();
    const first = await publish(db, 'artOnce', data);
    assert.strictEqual(first.paid, true);
    assert.strictEqual(first.awarded, PUBLISH_XP);
    assert.strictEqual(pointsOf(db), 40);
    assert.strictEqual(db.docs['article_xp/artOnce'].reason, 'paid');
    assert.strictEqual(db.docs['users/author1/article_publish_days/2026-10-26'].count, 1);
    assert.strictEqual(db.docs['users/author1/daily_points/2026-10-26'].total, 30);

    const again = await handleArticlePublishWrite({
        db: db, admin: admin, articleId: 'artOnce',
        before: data, after: Object.assign({}, data, { body: LONG + ' more' }), nowMs: NOW,
    });
    assert.strictEqual(again.reason, 'not_publish');
    const direct = await grantArticlePublish({
        db: db, admin: admin, articleId: 'artOnce', uid: 'author1', nowMs: NOW,
    });
    assert.strictEqual(direct.reason, 'already');
    assert.strictEqual(pointsOf(db), 40);
}));

queue.push(test('the credited uid must be the article author', async function () {
    const db = memoryDb(seedUser());
    db.docs['users/bob'] = { points: 5, weeklyXP: 5, monthlyXP: 5 };
    db.docs['articles/artAuthor'] = article({ authorId: 'author1' });
    const result = await grantArticlePublish({
        db: db, admin: admin, articleId: 'artAuthor', uid: 'bob', nowMs: NOW,
    });
    assert.strictEqual(result.reason, 'wrong_author');
    assert.strictEqual(db.docs['users/bob'].points, 5);
    assert.strictEqual(pointsOf(db), 10);
    assert.strictEqual(db.docs['article_xp/artAuthor'], undefined);
}));

queue.push(test('a draft does not pay or lock, and publishing it later does', async function () {
    const db = memoryDb(seedUser());
    const draft = article({ status: 'draft' });
    db.docs['articles/artDraft'] = draft;
    const held = await handleArticlePublishWrite({
        db: db, admin: admin, articleId: 'artDraft', before: null, after: draft, nowMs: NOW,
    });
    assert.strictEqual(held.reason, 'not_publish');
    const reread = await grantArticlePublish({
        db: db, admin: admin, articleId: 'artDraft', uid: 'author1', nowMs: NOW,
    });
    assert.strictEqual(reread.reason, 'draft');
    assert.strictEqual(pointsOf(db), 10);
    assert.strictEqual(db.docs['article_xp/artDraft'], undefined);

    const published = article();
    db.docs['articles/artDraft'] = published;
    const paid = await handleArticlePublishWrite({
        db: db, admin: admin, articleId: 'artDraft', before: draft, after: published, nowMs: NOW,
    });
    assert.strictEqual(paid.awarded, 30);
    assert.strictEqual(pointsOf(db), 40);
}));

queue.push(test('a short body and a filtered body do not pay, and a later edit still does not', async function () {
    const db = memoryDb(seedUser());
    const short = article({ body: '<p>hi</p><b>' + 'x'.repeat(40) + '</b>' });
    const first = await publish(db, 'artShort', short);
    assert.strictEqual(first.reason, 'too_short');
    assert.strictEqual(first.awarded, 0);
    assert.strictEqual(pointsOf(db), 10);
    assert.strictEqual(db.docs['article_xp/artShort'].reason, 'too_short');
    db.docs['articles/artShort'] = article();
    const edited = await grantArticlePublish({
        db: db, admin: admin, articleId: 'artShort', uid: 'author1', nowMs: NOW,
    });
    assert.strictEqual(edited.reason, 'already');
    assert.strictEqual(pointsOf(db), 10);

    const scam = article({ body: LONG + ' send me 2 btc' });
    const filtered = await publish(db, 'artScam', scam);
    assert.strictEqual(filtered.reason, 'filtered');
    assert.strictEqual(pointsOf(db), 10);
    assert.strictEqual(db.docs['users/author1/article_publish_days/2026-10-26'], undefined);
}));

queue.push(test('only two articles pay per day, and the third locks without paying', async function () {
    const db = memoryDb(seedUser());
    const a = await publish(db, 'artDay1', article());
    const b = await publish(db, 'artDay2', article());
    const c = await publish(db, 'artDay3', article());
    assert.strictEqual(a.awarded, 30);
    assert.strictEqual(b.awarded, 30);
    assert.strictEqual(c.reason, 'daily_limit');
    assert.strictEqual(c.awarded, 0);
    assert.strictEqual(pointsOf(db), 70);
    assert.strictEqual(db.docs['users/author1/article_publish_days/2026-10-26'].count, 2);
    assert.strictEqual(db.docs['article_xp/artDay3'].reason, 'daily_limit');
}));

queue.push(test('the daily cap tapers the grant and a full cap pays nothing without using a slot', async function () {
    const tapered = memoryDb(Object.assign(seedUser({ points: 980 }), {
        'users/author1/daily_points/2026-10-26': { total: 980 },
    }));
    const partial = await publish(tapered, 'artTaper', article());
    assert.strictEqual(partial.awarded, 7);
    assert.strictEqual(tapered.docs['users/author1'].points, 987);
    assert.strictEqual(tapered.docs['users/author1/daily_points/2026-10-26'].total, 987);
    assert.strictEqual(tapered.docs['users/author1/article_publish_days/2026-10-26'].count, 1);

    const capped = memoryDb(Object.assign(seedUser({ points: 1000, premium: true }), {
        'users/author1/daily_points/2026-10-26': { total: 1000 },
    }));
    const none = await publish(capped, 'artCap', article());
    assert.strictEqual(none.reason, 'cap');
    assert.strictEqual(none.awarded, 0);
    assert.strictEqual(capped.docs['users/author1'].points, 1000);
    assert.strictEqual(capped.docs['users/author1/article_publish_days/2026-10-26'], undefined);
    capped.docs['users/author1/daily_points/2026-10-26'] = { total: 0 };
    const next = await publish(capped, 'artAfterCap', article());
    assert.strictEqual(next.awarded, 30);
    assert.strictEqual(capped.docs['users/author1'].points, 1030);
}));

queue.push(test('premium and double XP do not add extra, and a delete within 24h reverses the grant', async function () {
    const db = memoryDb(seedUser({
        premium: true,
        doubleXpUntil: NOW + 60 * 60 * 1000,
    }));
    const paid = await publish(db, 'artBoost', article());
    assert.strictEqual(paid.awarded, 30);
    assert.strictEqual(pointsOf(db), 40);

    const undone = await handleArticlePublishWrite({
        db: db, admin: admin, articleId: 'artBoost', before: article(), after: null,
        nowMs: NOW + 60 * 60 * 1000,
    });
    assert.strictEqual(undone.reversed, true);
    assert.strictEqual(pointsOf(db), 10);
    assert.strictEqual(db.docs['users/author1'].weeklyXP, 10);
    assert.strictEqual(db.docs['users/author1/daily_points/2026-10-26'].total, 0);
    assert.strictEqual(db.docs['users/author1/article_publish_days/2026-10-26'].count, 0);
    assert.strictEqual(db.docs['article_xp/artBoost'].reversed, true);

    const republish = await grantArticlePublish({
        db: db, admin: admin, articleId: 'artBoost', uid: 'author1', nowMs: NOW + 60 * 60 * 1000,
    });
    assert.strictEqual(republish.reason, 'already');
    assert.strictEqual(pointsOf(db), 10);
    const freed = await publish(db, 'artAfterDelete', article());
    assert.strictEqual(freed.awarded, 30);
    assert.strictEqual(pointsOf(db), 40);
    assert.strictEqual(db.docs['users/author1/article_publish_days/2026-10-26'].count, 1);

    const lateDb = memoryDb(seedUser());
    await publish(lateDb, 'artLate', article());
    const kept = await handleArticlePublishWrite({
        db: lateDb, admin: admin, articleId: 'artLate', before: article(), after: null,
        nowMs: NOW + REVERSE_WINDOW_MS + 1,
    });
    assert.strictEqual(kept.reason, 'window');
    assert.strictEqual(lateDb.docs['users/author1'].points, 40);
    assert.strictEqual(lateDb.docs['article_xp/artLate'].reversed, false);
}));

queue.push(test('rules deny the marker, authorship cannot move, and awardPoints does not pay the phrase', function () {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    const actions = fs.readFileSync(path.join(root, 'functions', 'src', 'awardActions.js'), 'utf8');
    const payer = fs.readFileSync(path.join(root, 'functions', 'src', 'articlePublishXp.js'), 'utf8');
    const forum = fs.readFileSync(path.join(root, 'forum.js'), 'utf8');
    const guide = fs.readFileSync(path.join(root, 'earn-xp-guide.js'), 'utf8');
    assert.ok(rules.includes('match /article_xp/{articleId}'));
    assert.ok(rules.includes('match /users/{userId}/article_publish_days/{docId}'));
    const xp = rules.slice(rules.indexOf('match /article_xp/{articleId}'), rules.indexOf('match /article_xp/{articleId}') + 120);
    assert.ok(xp.includes('allow read, write: if false'));
    const days = rules.slice(rules.indexOf('match /users/{userId}/article_publish_days/{docId}'), rules.indexOf('match /users/{userId}/article_publish_days/{docId}') + 140);
    assert.ok(days.includes('allow read, write: if false'));
    const articles = rules.slice(rules.indexOf('match /articles/{articleId}'), rules.indexOf('match /article_replies/{replyId}'));
    assert.ok(articles.includes('request.resource.data.authorId == resource.data.authorId'));
    assert.ok(index.includes('exports.onArticlePublishXp'));
    assert.ok(index.includes('handleArticlePublishWrite'));
    const trigger = index.slice(index.indexOf('exports.onArticlePublishXp'), index.indexOf('exports.dailyPollVote'));
    assert.ok(trigger.includes('retry: true'));
    assert.ok(articles.includes('request.resource.data.body.size() <= 50000'));
    assert.ok(articles.includes('request.resource.data.title.size() <= 120'));
    assert.ok(articles.includes('request.resource.data.title.size() >= 10'));
    assert.ok(!actions.includes('📝 Article published'));
    assert.ok(!payer.includes('boostPoints'));
    assert.ok(!payer.includes('doubleXp'));
    assert.ok(!forum.includes("awardPoints(30, '📝 Article published')"));
    assert.ok(guide.includes('Publish an article: <strong>30 XP</strong>, once per article, up to 2 a day, at least 300 characters and 50 words'));
    assert.strictEqual(guide.includes('Publish an article: <strong>30 XP</strong>, once per article, up to 2 a day.'), false);
}));

queue.push(test('a megabyte of angle brackets or square brackets pays nothing and finishes quickly', async function () {
    const angles = '<'.repeat(1000000);
    const brackets = '['.repeat(1000000);
    const t0 = Date.now();
    const strippedAngles = stripMarkup(angles);
    const t1 = Date.now();
    const strippedBrackets = stripMarkup(brackets);
    const t2 = Date.now();
    assert.strictEqual(strippedAngles, angles);
    assert.strictEqual(strippedBrackets, brackets);
    assert.ok(t1 - t0 < 200, 'angle strip took ' + (t1 - t0) + 'ms');
    assert.ok(t2 - t1 < 200, 'bracket strip took ' + (t2 - t1) + 'ms');
    const db = memoryDb(seedUser());
    const g0 = Date.now();
    const huge = await publish(db, 'artHuge', article({ body: angles }));
    const g1 = Date.now();
    const boxed = await publish(db, 'artBoxes', article({ body: brackets }));
    const g2 = Date.now();
    assert.ok(g1 - g0 < 200, 'angle grant took ' + (g1 - g0) + 'ms');
    assert.ok(g2 - g1 < 200, 'bracket grant took ' + (g2 - g1) + 'ms');
    assert.strictEqual(huge.reason, 'too_long');
    assert.strictEqual(huge.awarded, 0);
    assert.strictEqual(boxed.reason, 'too_long');
    assert.strictEqual(boxed.awarded, 0);
    assert.strictEqual(pointsOf(db), 10);
    assert.strictEqual(db.docs['article_xp/artHuge'].reason, 'too_long');
    assert.strictEqual(db.docs['article_xp/artBoxes'].reason, 'too_long');
    assert.ok(angles.length > MAX_BODY_CHARS);
    const again = await grantArticlePublish({
        db: db, admin: admin, articleId: 'artHuge', uid: 'author1', nowMs: NOW,
    });
    assert.strictEqual(again.reason, 'already');
}));

queue.push(test('repeated script and style openers finish in one pass', function () {
    const scripts = '<script>'.repeat(6250);
    const styles = '<style>'.repeat(6250);
    const t0 = Date.now();
    const strippedScripts = stripMarkup(scripts);
    const t1 = Date.now();
    const strippedStyles = stripMarkup(styles);
    const t2 = Date.now();
    assert.ok(t1 - t0 < 100, 'script strip took ' + (t1 - t0) + 'ms');
    assert.ok(t2 - t1 < 100, 'style strip took ' + (t2 - t1) + 'ms');
    assert.strictEqual(strippedScripts, '');
    assert.strictEqual(strippedStyles, '');
    const kept = stripMarkup('<script>secret</script> Hello world');
    assert.ok(kept.indexOf('Hello') !== -1);
    assert.strictEqual(kept.indexOf('secret'), -1);
}));

queue.push(test('a Cyrillic article pays, and padding still does not', async function () {
    const sentence = 'Биткоин хранит ценность лучше любого старого металла и служит людям по всему миру. ';
    const cyrillic = sentence.repeat(8);
    const db = memoryDb(seedUser());
    const paid = await publish(db, 'artCyr', article({
        title: 'Почему Биткоин сохраняет ценность',
        body: cyrillic,
    }));
    assert.strictEqual(paid.reason, 'paid');
    assert.strictEqual(paid.awarded, 30);
    assert.strictEqual(pointsOf(db), 40);

    const blanks = await publish(db, 'artBlank', article({ body: '\u200B'.repeat(300) }));
    assert.strictEqual(blanks.reason, 'too_short');
    assert.strictEqual(blanks.awarded, 0);
    const letters = await publish(db, 'artLetter', article({ body: 'a'.repeat(300) }));
    assert.strictEqual(letters.reason, 'too_short');
    const repeated = await publish(db, 'artSame', article({ body: 'aa '.repeat(80) }));
    assert.strictEqual(repeated.reason, 'too_short');
    assert.strictEqual(pointsOf(db), 40);
}));

queue.push(test('invisible padding and a one-letter body do not meet the minimum', async function () {
    const db = memoryDb(seedUser());
    const blanks = await publish(db, 'artBlank', article({ body: '\u200B'.repeat(300) }));
    assert.strictEqual(blanks.reason, 'too_short');
    assert.strictEqual(blanks.awarded, 0);
    assert.strictEqual(db.docs['article_xp/artBlank'].reason, 'too_short');
    const letters = await publish(db, 'artLetter', article({ body: 'a'.repeat(300) }));
    assert.strictEqual(letters.reason, 'too_short');
    assert.strictEqual(letters.awarded, 0);
    const repeated = await publish(db, 'artSame', article({ body: 'aa '.repeat(80) }));
    assert.strictEqual(repeated.reason, 'too_short');
    assert.strictEqual(pointsOf(db), 10);
    assert.ok(MIN_WORDS >= 50);
    const tagged = stripMarkup('<p>Hello</p> [link](http://example.test) &amp; there');
    assert.ok(tagged.indexOf('Hello') !== -1);
    assert.ok(tagged.indexOf('there') !== -1);
    assert.strictEqual(tagged.indexOf('example.test'), -1);
}));

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
