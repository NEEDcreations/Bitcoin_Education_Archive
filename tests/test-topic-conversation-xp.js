// Topic conversation XP. Awards happen inside the server transaction that
// accepts the original post. Mirrored copies, self-replies, short posts,
// near-duplicates, and banned users earn nothing.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const td = require('../functions/src/topicDiscussion');
const forum = require('../functions/src/topicForumMirror');
const xp = require('../functions/src/topicConversationXp');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        const result = fn();
        if (result && typeof result.then === 'function') throw new Error('use testAsync');
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
    }
}
async function testAsync(name, fn) {
    try {
        await fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
    }
}

class HttpsError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

function clone(value) {
    if (value == null || typeof value !== 'object') return value;
    if (typeof value.toMillis === 'function') return value;
    if (Array.isArray(value)) return value.map(clone);
    const out = {};
    Object.keys(value).forEach(function(key) { out[key] = clone(value[key]); });
    return out;
}

function createMemoryDb() {
    const docs = new Map();
    let seq = 0;
    function snap(docPath) {
        if (!docs.has(docPath)) return { exists: false, id: docPath.split('/').pop(), data: function() { return undefined; } };
        return { exists: true, id: docPath.split('/').pop(), data: function() { return clone(docs.get(docPath)); } };
    }
    function ref(parts) {
        const docPath = parts.join('/');
        return {
            id: parts[parts.length - 1],
            path: docPath,
            collection: function(name) { return coll(parts.concat(name)); },
            get: async function() { return snap(docPath); },
            set: async function(data, opts) { write(docPath, data, opts); },
            delete: async function() { docs.delete(docPath); },
        };
    }
    function write(docPath, data, opts) {
        const base = opts && opts.merge && docs.has(docPath) ? docs.get(docPath) : {};
        docs.set(docPath, Object.assign({}, clone(base), clone(data)));
    }
    function coll(parts) {
        return { doc: function(id) { return ref(parts.concat(id || ('auto' + (++seq)))); } };
    }
    return {
        collection: function(name) { return coll([name]); },
        dump: function() { return Array.from(docs.keys()); },
        read: function(docPath) { return docs.has(docPath) ? clone(docs.get(docPath)) : null; },
        seed: function(docPath, data) { docs.set(docPath, clone(data)); },
        runTransaction: async function(fn) {
            const staged = new Map();
            const deleted = new Set();
            const tx = {
                get: async function(docRef) {
                    if (deleted.has(docRef.path)) return { exists: false, data: function() { return undefined; } };
                    if (staged.has(docRef.path)) return { exists: true, id: docRef.id, data: function() { return clone(staged.get(docRef.path)); } };
                    return snap(docRef.path);
                },
                set: function(docRef, data, opts) {
                    let base = {};
                    if (opts && opts.merge) {
                        if (staged.has(docRef.path)) base = staged.get(docRef.path);
                        else if (docs.has(docRef.path) && !deleted.has(docRef.path)) base = docs.get(docRef.path);
                    }
                    staged.set(docRef.path, Object.assign({}, clone(base), clone(data)));
                    deleted.delete(docRef.path);
                },
                update: function(docRef, data) {
                    if (deleted.has(docRef.path) || (!staged.has(docRef.path) && !docs.has(docRef.path))) {
                        const err = new Error('NOT_FOUND');
                        err.code = 5;
                        throw err;
                    }
                    const base = staged.has(docRef.path) ? staged.get(docRef.path) : docs.get(docRef.path);
                    staged.set(docRef.path, Object.assign({}, clone(base), clone(data)));
                },
                delete: function(docRef) {
                    deleted.add(docRef.path);
                    staged.delete(docRef.path);
                },
            };
            const result = await fn(tx);
            deleted.forEach(function(docPath) { docs.delete(docPath); });
            staged.forEach(function(value, docPath) { docs.set(docPath, clone(value)); });
            return result;
        },
    };
}

function Timestamp(ms) { this.ms = ms; }
Timestamp.prototype.toMillis = function() { return this.ms; };

function makeApi() {
    const db = createMemoryDb();
    let now = Date.UTC(2026, 9, 22, 16, 0, 0);
    const api = td.createTopicDiscussion({
        db: db,
        admin: { firestore: { Timestamp: { fromMillis: function(ms) { return new Timestamp(ms); } } } },
        HttpsError: HttpsError,
        now: function() { return now; },
        askNacho: async function() { return { answer: 'A nonce is the value miners change.' }; },
        mirror: async function() {},
    });
    return {
        db: db,
        api: api,
        admin: { firestore: { Timestamp: { fromMillis: function(ms) { return new Timestamp(ms); } } } },
        setNow: function(ms) { now = ms; },
        advance: function(ms) { now += ms; },
        now: function() { return now; },
    };
}

function auth(uid, extra) {
    return { auth: { uid: uid, token: Object.assign({ firebase: { sign_in_provider: 'password' }, admin: false }, extra || {}) } };
}

function seedUser(db, uid, user, ledger) {
    db.seed('users/' + uid, Object.assign({ username: 'Learner', points: 0, weeklyXP: 0, monthlyXP: 0 }, user || {}));
    if (ledger) db.seed('faucet_ledger/' + uid, ledger);
}

function pointsOf(db, uid) {
    const user = db.read('users/' + uid);
    return user ? Number(user.points) || 0 : 0;
}

function ledgers(db, uid) {
    return db.dump()
        .filter(function(p) { return p.indexOf('users/' + uid + '/xp_ledger/') === 0; })
        .map(function(p) { return db.read(p); });
}

function dayKey(ms) {
    return td.offsetDateKey(ms);
}

const LONG = 'Bitcoin stays scarce because the supply is fixed';

test('near-duplicate window and short text are detectable', () => {
    assert.strictEqual(xp.nonWhitespaceCount('a b c'), 3);
    assert.strictEqual(xp.assessText('too short', []).reason, 'short');
    assert.strictEqual(xp.assessText(LONG, []).ok, true);
    assert.strictEqual(xp.assessText(LONG, [xp.normalizeMessage(LONG)]).reason, 'duplicate');
    const near = LONG.slice(0, -1) + 'e';
    assert.strictEqual(xp.isNearDuplicate(xp.normalizeMessage(near), [xp.normalizeMessage(LONG)]), true);
    const older = ['one', 'two', 'three', 'four', 'five'];
    assert.strictEqual(xp.isNearDuplicate('one', older.slice(-5)), true);
    assert.strictEqual(xp.isNearDuplicate('one', older.slice(-5).slice(1).concat(['six'])), false);
});

test('rules, terms, and the client toast come from the server payload', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const block = rules.split('match /users/{userId}/xp_ledger/{docId}')[1].split('match /')[0];
    assert.ok(block.includes('allow read, write: if false;'));
    const terms = fs.readFileSync(path.join(root, 'terms.html'), 'utf8');
    const xpSection = terms.split('<h2>5. Points, Badges & Ranking</h2>')[1].split('<h2>')[0];
    assert.ok(xpSection.includes('Starting a conversation earns 10 XP'));
    assert.ok(xpSection.includes('A reply earns 5 XP'));
    assert.ok(xpSection.includes('capped at 40 XP'));
    assert.ok(xpSection.includes('up to 5 of those awards'));
    const topic = terms.split('11a. Topic discussions')[1].split('<h2>')[0];
    assert.ok(!topic.includes('does not award XP, tickets, or sats'));
    assert.ok(topic.includes('Copies do not award XP or tickets'));
    const client = fs.readFileSync(path.join(root, 'topic-discussions.js'), 'utf8');
    assert.ok(client.includes('if (data && data.toast) toast(data.toast);'));
    assert.strictEqual(client.includes("toast('+10 XP')"), false);
    assert.strictEqual(client.includes("toast('+5 XP')"), false);
    assert.ok(client.includes('A new conversation can earn XP.'));
    const notes = fs.readFileSync(path.join(root, 'patch-notes.html'), 'utf8');
    assert.strictEqual((notes.match(/Latest:/g) || []).length, 1);
    assert.ok(notes.includes('Latest: Encrypted account backups keep email addresses, phone numbers, and password hashes for 90 days.'));
    assert.ok(notes.includes('You can delete your account from Settings → Account after confirming your username, and you can change the email on an email sign-in.'));
    assert.ok(!notes.includes('Latest: You can delete your account'));
    assert.ok(notes.includes('Topic conversation links open the paragraph they started from, highlight it, and leave the thread ready to reply.'));
    assert.ok(!notes.includes('Latest: Topic conversation links'));
    assert.ok(notes.includes('The share card says Let me teach you about Bitcoin, and the daily earn line and the sats stat both show 200.'));
    assert.ok(!notes.includes('Latest: The share card'));
    assert.ok(notes.includes('Key and cipher help now says that when an accepted peer opens a matching cipher with a key you sent, you both get the same prize and you see a reveal of what you won.'));
    assert.ok(!notes.includes('Latest: Key and cipher help'));
    assert.ok(notes.includes('When you send a key and a peer opens a matching cipher with it, you both win the same prize.'));
    assert.ok(!notes.includes('Latest: When you send a key'));
    assert.ok(notes.includes('Guests and Lightning-only accounts can link an email or Google from Sign-in methods, and sign-out warns them first.'));
    assert.ok(!notes.includes('Latest: Guests and Lightning-only'));
    assert.ok(notes.includes('Badges you already earned appear once, and one toast shows them.'));
    assert.ok(!notes.includes('Latest: Badges you already earned'));
    assert.ok(notes.includes('Timechain TV Music drops off-topic tracks, moves interviews and events onto the stations they belong on, and adds freedom and Bitcoin songs.'));
    assert.ok(!notes.includes('Latest: Timechain TV Music'));
    assert.ok(notes.includes('If your username was cleared, pick a new one from the prompt, and Satoshi\'s Favor shows your public name instead of Anonymous.'));
    assert.ok(!notes.includes('Latest: If your username'));
    assert.ok(notes.includes('Flex XP syncs on tap again, and Say hi shows a green dot after you say hi.'));
    assert.ok(!notes.includes('Latest: Flex XP'));
    assert.ok(notes.includes('Nacho answers from a large vetted Bitcoin knowledge base, with follow-ups he can answer and a steer back to Bitcoin.'));
    assert.ok(!notes.includes('Latest: Nacho answers from'));
    assert.ok(notes.includes("On a phone, the chat, Nacho, stats, and trophy buttons sit above the bottom navigation with space from the screen edge, and Nacho's speech bubble sits fully above that row."));
    assert.ok(!notes.includes('Latest: On a phone'));
    assert.ok(notes.includes('New badges cover gifts, keys, ciphers, Nook, raffles, and setup.'));
    assert.ok(!notes.includes('Latest: New badges'));
    assert.ok(notes.includes('Topic conversations earn XP, a new one is also posted on Pleb Talk, and replies stay mirrored.'));
    assert.ok(!notes.includes('Latest: Topic conversations'));
});

(async function main() {
    await testAsync('start is +10 and a reply is +5, with +2 to the starter', async function() {
        const h = makeApi();
        seedUser(h.db, 'ada', { username: 'Ada' });
        seedUser(h.db, 'bea', { username: 'Bea' });
        const start = await h.api.postTopicComment({ channelId: 'mining', text: LONG, xp: 999 }, auth('ada'));
        assert.strictEqual(start.xp, 10);
        assert.strictEqual(start.toast, '+10 XP');
        assert.strictEqual(pointsOf(h.db, 'ada'), 10);
        const saved = h.db.dump().filter(function(p) { return p.indexOf('topic_discussions/mining/posts/') === 0; }).map(function(p) { return h.db.read(p); })[0];
        assert.strictEqual(saved.xp, undefined);
        assert.strictEqual(saved.xpAuthor, 10);
        const ledger = ledgers(h.db, 'ada');
        assert.strictEqual(ledger.length, 1);
        assert.strictEqual(ledger[0].source, 'topic_conversation');
        assert.strictEqual(ledger[0].kind, 'start');
        assert.strictEqual(ledger[0].amount, 10);
        const forumPost = h.db.read('forum_posts/' + saved.forumPostId);
        assert.strictEqual(forumPost.noAward, true);
        assert.strictEqual(forumPost.origin, 'topic');
        assert.strictEqual(pointsOf(h.db, 'ada'), 10);

        h.advance(31000);
        const reply = await h.api.postTopicComment({
            channelId: 'mining',
            text: 'A reply that is certainly long enough to count',
            parentId: start.postId,
        }, auth('bea'));
        assert.strictEqual(reply.xp, 5);
        assert.strictEqual(reply.toast, '+5 XP');
        assert.strictEqual(pointsOf(h.db, 'bea'), 5);
        assert.strictEqual(pointsOf(h.db, 'ada'), 12);
        assert.strictEqual(ledgers(h.db, 'bea').length, 1);
        assert.strictEqual(ledgers(h.db, 'bea')[0].kind, 'reply');
        const starterBonus = ledgers(h.db, 'ada').filter(function(row) { return row.kind === 'starter_reply'; });
        assert.strictEqual(starterBonus.length, 1);
        assert.strictEqual(starterBonus[0].amount, 2);
        assert.strictEqual(ledgers(h.db, 'bea').length, 1);
    });

    await testAsync('conversation cap is 40 and the shared taper can shrink the award', async function() {
        const h = makeApi();
        seedUser(h.db, 'ada', { username: 'Ada' });
        const openers = [
            'Bitcoin stays scarce because the supply is fixed',
            'Lightning moves payments off the main chain today',
            'Nodes check every block before they pass it on',
            'Keys let you spend coins without asking a bank',
        ];
        for (let n = 0; n < openers.length; n++) {
            if (n) h.advance(31000);
            const posted = await h.api.postTopicComment({
                channelId: 'mining',
                text: openers[n],
            }, auth('ada'));
            assert.strictEqual(posted.xp, 10, openers[n]);
        }
        assert.strictEqual(pointsOf(h.db, 'ada'), 40);
        h.advance(31000);
        const capped = await h.api.postTopicComment({
            channelId: 'mining',
            text: 'Miners search for a hash under the target value',
        }, auth('ada'));
        assert.strictEqual(capped.xp, 0);
        assert.strictEqual(capped.toast, '');
        assert.ok(capped.postId);
        assert.strictEqual(pointsOf(h.db, 'ada'), 40);

        const partial = makeApi();
        const day = dayKey(partial.now());
        seedUser(partial.db, 'ada', { username: 'Ada' });
        partial.db.seed('topic_discussion_limits/ada', { convoDayKey: day, convoXp: 36 });
        const clipped = await partial.api.postTopicComment({ channelId: 'mining', text: LONG + ' partial' }, auth('ada'));
        assert.strictEqual(clipped.xp, 4);
        assert.strictEqual(clipped.toast, '+4 XP');
        assert.strictEqual(pointsOf(partial.db, 'ada'), 4);

        const shared = makeApi();
        const sharedDay = dayKey(shared.now());
        seedUser(shared.db, 'ada', { username: 'Ada', points: 1000 });
        shared.db.seed('users/ada/daily_points/' + sharedDay, { total: 1000 });
        const blocked = await shared.api.postTopicComment({ channelId: 'mining', text: LONG + ' shared full' }, auth('ada'));
        assert.strictEqual(blocked.xp, 0);
        assert.strictEqual(blocked.toast, '');
        assert.strictEqual(pointsOf(shared.db, 'ada'), 1000);
        assert.strictEqual(shared.db.read('users/ada/daily_points/' + sharedDay).total, 1000);

        const taper = makeApi();
        const taperDay = dayKey(taper.now());
        seedUser(taper.db, 'ada', { username: 'Ada', points: 496 });
        taper.db.seed('users/ada/daily_points/' + taperDay, { total: 496 });
        const shrunk = await taper.api.postTopicComment({ channelId: 'mining', text: LONG + ' taper' }, auth('ada'));
        assert.strictEqual(shrunk.xp, 7);
        assert.strictEqual(shrunk.toast, '+7 XP');
        assert.strictEqual(pointsOf(taper.db, 'ada'), 503);
        assert.strictEqual(taper.db.read('users/ada/daily_points/' + taperDay).total, 503);

        const both = makeApi();
        const bothDay = dayKey(both.now());
        seedUser(both.db, 'ada', { username: 'Ada', points: 998 });
        both.db.seed('users/ada/daily_points/' + bothDay, { total: 998 });
        both.db.seed('topic_discussion_limits/ada', { convoDayKey: bothDay, convoXp: 36 });
        const mixed = await both.api.postTopicComment({ channelId: 'mining', text: LONG + ' both caps' }, auth('ada'));
        assert.strictEqual(mixed.xp, 1);
        assert.strictEqual(mixed.toast, '+1 XP');
        assert.strictEqual(pointsOf(both.db, 'ada'), 999);
        assert.strictEqual(both.db.read('topic_discussion_limits/ada').convoXp, 37);
    });

    await testAsync('self-reply, short, duplicate, Nacho, and banned earn nothing', async function() {
        const h = makeApi();
        seedUser(h.db, 'ada', { username: 'Ada' });
        const start = await h.api.postTopicComment({ channelId: 'mining', text: LONG }, auth('ada'));
        h.advance(31000);
        const self = await h.api.postTopicComment({
            channelId: 'mining',
            text: 'I am replying to my own conversation here',
            parentId: start.postId,
        }, auth('ada'));
        assert.strictEqual(self.xp, 0);
        assert.strictEqual(self.toast, '');
        assert.strictEqual(pointsOf(h.db, 'ada'), 10);
        assert.ok(self.postId);

        h.advance(31000);
        const short = await h.api.postTopicComment({ channelId: 'mining', text: 'too short' }, auth('ada'));
        assert.strictEqual(short.xp, 0);
        assert.ok(short.postId);
        assert.strictEqual(pointsOf(h.db, 'ada'), 10);

        h.advance(31000);
        const same = await h.api.postTopicComment({ channelId: 'mining', text: LONG }, auth('ada'));
        assert.strictEqual(same.xp, 0);
        h.advance(31000);
        const near = await h.api.postTopicComment({ channelId: 'mining', text: LONG.slice(0, -1) + 'e' }, auth('ada'));
        assert.strictEqual(near.xp, 0);
        assert.strictEqual(pointsOf(h.db, 'ada'), 10);
        h.advance(31000);
        const fresh = await h.api.postTopicComment({
            channelId: 'mining',
            text: 'Lightning moves payments off the main chain today',
        }, auth('ada'));
        assert.strictEqual(fresh.xp, 10);
        assert.strictEqual(pointsOf(h.db, 'ada'), 20);

        const asked = makeApi();
        seedUser(asked.db, 'ada', { username: 'Ada' });
        const question = await asked.api.postTopicComment({
            channelId: 'mining',
            text: 'What is the block subsidy in bitcoin?',
        }, auth('ada'));
        assert.strictEqual(question.nacho, true);
        assert.strictEqual(question.xp, 10);
        assert.strictEqual(pointsOf(asked.db, 'ada'), 10);
        assert.strictEqual(ledgers(asked.db, 'nacho-bot').length, 0);
        const nacho = asked.db.dump().filter(function(p) { return p.indexOf('topic_discussions/mining/posts/') === 0; })
            .map(function(p) { return asked.db.read(p); })
            .filter(function(post) { return post.isNacho; });
        assert.strictEqual(nacho.length, 1);
        assert.strictEqual(nacho[0].xpAuthor, undefined);

        const banned = makeApi();
        seedUser(banned.db, 'ada', { username: 'Ada', points: 3, banned: true });
        let threw = false;
        try {
            await banned.api.postTopicComment({ channelId: 'mining', text: LONG }, auth('ada'));
        } catch (err) {
            threw = err.code === 'permission-denied';
        }
        assert.strictEqual(threw, true);
        assert.strictEqual(pointsOf(banned.db, 'ada'), 3);
        assert.strictEqual(ledgers(banned.db, 'ada').length, 0);
    });

    await testAsync('starter bonus stops at 5 a day and a banned starter receives none', async function() {
        const h = makeApi();
        seedUser(h.db, 'ada', { username: 'Ada' });
        const start = await h.api.postTopicComment({ channelId: 'mining', text: LONG }, auth('ada'));
        for (let n = 0; n < 6; n++) {
            const uid = 'r' + n;
            seedUser(h.db, uid, { username: 'R' + n });
            h.advance(31000);
            const posted = await h.api.postTopicComment({
                channelId: 'mining',
                text: 'Reply number ' + n + ' is long enough for xp',
                parentId: start.postId,
            }, auth(uid));
            assert.strictEqual(posted.xp, 5);
        }
        assert.strictEqual(pointsOf(h.db, 'ada'), 20);
        assert.strictEqual(h.db.read('topic_discussion_limits/ada').starterReplyCount, 5);

        const bannedStarter = makeApi();
        seedUser(bannedStarter.db, 'ada', { username: 'Ada', points: 4, banned: true });
        bannedStarter.db.seed('topic_discussions/mining/posts/root1', {
            channelId: 'mining',
            uid: 'ada',
            name: 'Ada',
            text: LONG,
            parentId: '',
            deleted: false,
            hidden: false,
            replyCount: 0,
            createdAtMs: bannedStarter.now(),
        });
        seedUser(bannedStarter.db, 'bea', { username: 'Bea' });
        const posted = await bannedStarter.api.postTopicComment({
            channelId: 'mining',
            text: 'Replying to a banned starter still pays the replier',
            parentId: 'root1',
        }, auth('bea'));
        assert.strictEqual(posted.xp, 5);
        assert.strictEqual(pointsOf(bannedStarter.db, 'bea'), 5);
        assert.strictEqual(pointsOf(bannedStarter.db, 'ada'), 4);
    });

    await testAsync('a mirrored forum copy awards nothing and a forum-origin reply awards once', async function() {
        const h = makeApi();
        seedUser(h.db, 'ada', { username: 'Ada' });
        seedUser(h.db, 'bea', { username: 'Bea' });
        const start = await h.api.postTopicComment({ channelId: 'mining', text: LONG }, auth('ada'));
        const root = h.db.dump()
            .filter(function(p) { return p.indexOf('topic_discussions/mining/posts/') === 0; })
            .map(function(p) { return Object.assign({ _path: p }, h.db.read(p)); })
            .filter(function(post) { return !post.parentId; })[0];
        assert.strictEqual(pointsOf(h.db, 'ada'), 10);
        h.advance(31000);
        await h.api.postTopicComment({
            channelId: 'mining',
            text: 'Topic reply that mirrors onto the forum post',
            parentId: start.postId,
        }, auth('bea'));
        assert.strictEqual(pointsOf(h.db, 'bea'), 5);
        assert.strictEqual(pointsOf(h.db, 'ada'), 12);
        const forumReplies = h.db.dump().filter(function(p) { return p.indexOf('forum_replies/') === 0; });
        assert.ok(forumReplies.length >= 1);
        forumReplies.forEach(function(p) {
            const reply = h.db.read(p);
            assert.strictEqual(reply.origin, 'topic');
            assert.strictEqual(reply.noAward, true);
        });
        assert.strictEqual(ledgers(h.db, 'bea').length, 1);

        h.advance(31000);
        seedUser(h.db, 'cy', { username: 'Cy' });
        h.db.seed('forum_replies/forumreplycy1', {
            postId: root.forumPostId,
            body: 'Forum reply long enough to earn the origin award',
            authorId: 'cy',
            authorName: 'Forged',
        });
        const first = await forum.mirrorForumReplyToTopic({
            db: h.db,
            admin: h.admin,
            replyId: 'forumreplycy1',
            nowMs: h.now(),
            data: {
                postId: root.forumPostId,
                body: 'Forum reply long enough to earn the origin award',
                authorId: 'cy',
                authorName: 'Forged',
            },
        });
        assert.strictEqual(first.mirrored, true);
        assert.strictEqual(first.xp, 5);
        assert.strictEqual(pointsOf(h.db, 'cy'), 5);
        assert.strictEqual(pointsOf(h.db, 'ada'), 14);
        const copy = h.db.read('topic_discussions/mining/posts/' + first.topicPostId);
        assert.strictEqual(copy.origin, 'forum');
        assert.strictEqual(copy.xpAuthor, 5);
        const again = await forum.mirrorForumReplyToTopic({
            db: h.db,
            admin: h.admin,
            replyId: 'forumreplycy1',
            nowMs: h.now(),
            data: {
                postId: root.forumPostId,
                body: 'Forum reply long enough to earn the origin award',
                authorId: 'cy',
            },
        });
        assert.strictEqual(again.mirrored, false);
        assert.strictEqual(pointsOf(h.db, 'cy'), 5);
        assert.strictEqual(pointsOf(h.db, 'ada'), 14);
        assert.strictEqual(ledgers(h.db, 'cy').length, 1);

        seedUser(h.db, 'ban', { username: 'Ban', banned: true, points: 9 });
        const refused = await forum.mirrorForumReplyToTopic({
            db: h.db,
            admin: h.admin,
            replyId: 'forumreplyban',
            nowMs: h.now(),
            data: {
                postId: root.forumPostId,
                body: 'A banned forum reply must not earn conversation xp',
                authorId: 'ban',
            },
        });
        assert.strictEqual(refused.mirrored, false);
        assert.strictEqual(refused.reason, 'banned');
        assert.strictEqual(pointsOf(h.db, 'ban'), 9);
        assert.strictEqual(ledgers(h.db, 'ban').length, 0);
    });

    await testAsync('delete within 10 minutes claws back and a later delete does not', async function() {
        const h = makeApi();
        seedUser(h.db, 'ada', { username: 'Ada' });
        seedUser(h.db, 'bea', { username: 'Bea' });
        const start = await h.api.postTopicComment({ channelId: 'mining', text: LONG }, auth('ada'));
        h.advance(31000);
        const reply = await h.api.postTopicComment({
            channelId: 'mining',
            text: 'Reply that should claw back with the starter bonus',
            parentId: start.postId,
        }, auth('bea'));
        assert.strictEqual(pointsOf(h.db, 'ada'), 12);
        assert.strictEqual(pointsOf(h.db, 'bea'), 5);
        await h.api.deleteTopicComment({ channelId: 'mining', postId: reply.postId }, auth('bea'));
        assert.strictEqual(pointsOf(h.db, 'bea'), 0);
        assert.strictEqual(pointsOf(h.db, 'ada'), 10);
        const claw = ledgers(h.db, 'bea').filter(function(row) { return row.kind === 'clawback'; });
        assert.strictEqual(claw.length, 1);
        assert.strictEqual(claw[0].source, 'topic_conversation');
        assert.strictEqual(claw[0].amount, -5);
        const removed = h.db.read('topic_discussions/mining/posts/' + reply.postId);
        assert.strictEqual(removed.xpClawed, true);

        h.advance(11 * 60 * 1000);
        await h.api.deleteTopicComment({ channelId: 'mining', postId: start.postId }, auth('ada'));
        assert.strictEqual(pointsOf(h.db, 'ada'), 10);
        const late = h.db.read('topic_discussions/mining/posts/' + start.postId);
        assert.strictEqual(late.deleted, true);
        assert.notStrictEqual(late.xpClawed, true);
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})().catch(function(err) {
    console.error(err);
    process.exit(1);
});
