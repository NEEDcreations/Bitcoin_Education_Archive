// Satoshi's Favor live post, badge GGs bursts, and the transactional reset.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const live = require('../functions/src/favorLiveAnnounce');
const ending = require('../functions/src/favorEndingAnnounce');
const mirror = require('../functions/src/chatTelegramMirror');
const badgeGg = require('../functions/src/badgeGg');
const { resetExpiredFavorWith } = require('../functions/src/satoshiFavor');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
    const run = fn();
    const ok = function () { console.log('✅ ' + name); passed++; };
    const bad = function (e) { console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e)); failed++; };
    if (run && typeof run.then === 'function') return run.then(ok, bad);
    try { ok(); } catch (e) { bad(e); }
    return Promise.resolve();
}

const admin = {
    firestore: {
        FieldValue: {
            serverTimestamp: function () { return { _serverTimestamp: true }; },
        },
    },
};

function memoryDb(seed) {
    const docs = Object.assign({}, seed || {});
    let chain = Promise.resolve();
    function rowsUnder(prefix) {
        const head = prefix + '/';
        const out = [];
        Object.keys(docs).forEach(function (p) {
            if (p.indexOf(head) !== 0) return;
            const rest = p.slice(head.length);
            if (!rest || rest.indexOf('/') !== -1) return;
            out.push({
                id: rest,
                exists: true,
                data: function () { return docs[p] ? Object.assign({}, docs[p]) : {}; },
            });
        });
        return out;
    }
    function pack(list) {
        return {
            empty: list.length === 0,
            size: list.length,
            docs: list,
            forEach: function (fn) { list.forEach(fn); },
        };
    }
    function ref(docPath) {
        return {
            path: docPath,
            id: docPath.split('/').pop(),
            collection: function (name) { return collectionAt(docPath + '/' + name); },
            get: async function () {
                const data = docs[docPath];
                return {
                    exists: data != null,
                    id: docPath.split('/').pop(),
                    data: function () { return data ? Object.assign({}, data) : undefined; },
                };
            },
        };
    }
    function collectionAt(prefix) {
        return {
            path: prefix,
            doc: function (id) { return ref(prefix + '/' + id); },
            get: async function () { return pack(rowsUnder(prefix)); },
            where: function (field, op, value) {
                return {
                    get: async function () {
                        const list = rowsUnder(prefix).filter(function (doc) {
                            const data = doc.data();
                            return op === '==' && data[field] === value;
                        });
                        return pack(list);
                    },
                };
            },
            orderBy: function () {
                const ordered = {
                    limit: function () { return ordered; },
                    get: async function () { return pack(rowsUnder(prefix)); },
                };
                return ordered;
            },
        };
    }
    return {
        docs: docs,
        collection: function (name) { return collectionAt(name); },
        runTransaction: function (fn) {
            const run = chain.then(async function () {
                const staged = [];
                const t = {
                    get: function (r) { return r.get(); },
                    set: function (r, data) { staged.push({ path: r.path, data: data }); },
                };
                const result = await fn(t);
                staged.forEach(function (w) {
                    const copy = {};
                    Object.keys(w.data || {}).forEach(function (key) {
                        const value = w.data[key];
                        copy[key] = Array.isArray(value) ? value.map(function (item) {
                            return (item && typeof item === 'object') ? Object.assign({}, item) : item;
                        }) : value;
                    });
                    docs[w.path] = copy;
                });
                return result;
            });
            chain = run.then(function () { return null; }, function () { return null; });
            return run;
        },
    };
}

function contributor(id, fields) {
    return ['satoshiFavor/current/contributors/' + id, Object.assign({ pointsAdded: 1, timestamp: 2000 }, fields)];
}

const queue = [];

queue.push(test('a window opening posts one breakdown, and retries do not post again', async function () {
    const seed = {
        'satoshiFavor/current': { points: 21, favorActive: true, currentCycleId: 'cycle_2000', lastReset: 1000 },
    };
    const players = ['p1', 'p2', 'p3', 'p4', 'p5'];
    for (let i = 0; i < 12; i++) {
        const row = contributor('flex' + i, {
            uid: players[i % 5], source: 'badge_earned', badgeId: 'flex_pattern_25', detail: 'flex_pattern_25', timestamp: 1100 + i,
        });
        seed[row[0]] = row[1];
    }
    for (let i = 0; i < 5; i++) {
        const row = contributor('badge' + i, {
            uid: players[i % 5], source: 'badge_earned', badgeId: 'quest_1', detail: 'quest_1', timestamp: 1200 + i,
        });
        seed[row[0]] = row[1];
    }
    for (let i = 0; i < 4; i++) {
        const row = contributor('tri' + i, {
            uid: players[i % 5], source: 'daily_all_three', timestamp: 1300 + i,
        });
        seed[row[0]] = row[1];
    }
    const old = contributor('old', { uid: 'p9', source: 'badge_earned', badgeId: 'quest_1', timestamp: 500 });
    const backfill = contributor('bf', { uid: 'p8', source: 'backfill', backfill: true, badgeId: 'quest_5', timestamp: 1800, pointsAdded: 9 });
    seed[old[0]] = old[1];
    seed[backfill[0]] = backfill[1];
    const db = memoryDb(seed);
    const after = { points: 21, favorActive: true, currentCycleId: 'cycle_2000', lastReset: 1000 };
    const before = { points: 20, favorActive: false, currentCycleId: null };
    const calls = [];
    for (let i = 0; i < 5; i++) calls.push(live.handleFavorLiveWrite(db, admin, before, after));
    const results = await Promise.all(calls);
    const posted = results.filter(function (row) { return row && row.posted; });
    assert.strictEqual(posted.length, 1);
    const text = "⚡ Satoshi's Favor is LIVE! 21 points from 5 players: 12 flex badges, 5 badges, 4 daily trifectas. Window open for 60 min.";
    assert.strictEqual(posted[0].text, text);
    assert.strictEqual(db.docs['global_chat/sf_live_cycle_2000'].text, text);
    assert.strictEqual(db.docs['global_chat/sf_live_cycle_2000'].uid, 'nacho-bot');
    assert.strictEqual(db.docs['global_chat/sf_live_cycle_2000'].name, '🦌 Nacho');
    assert.strictEqual(db.docs['global_chat/sf_live_cycle_2000'].isNachoAuto, false);
    players.concat(['p8', 'p9']).forEach(function (uid) {
        assert.ok(text.indexOf(uid) === -1, uid);
    });
    const again = await live.handleFavorLiveWrite(db, admin, before, after);
    assert.strictEqual(again.posted, false);
    assert.strictEqual(Object.keys(db.docs).filter(function (key) { return key.indexOf('global_chat/') === 0; }).length, 1);
}));

queue.push(test('nothing is posted below 21 or when the window was already open', async function () {
    const below = { points: 20, favorActive: true, currentCycleId: 'cycle_low' };
    assert.strictEqual(live.shouldAnnounceLive({ favorActive: false }, below), false);
    const db = memoryDb({});
    const skipped = await live.handleFavorLiveWrite(db, admin, { favorActive: false, points: 19 }, below);
    assert.strictEqual(skipped.posted, false);
    assert.strictEqual(Object.keys(db.docs).length, 0);
    const open = { points: 21, favorActive: true, currentCycleId: 'cycle_open' };
    assert.strictEqual(live.shouldAnnounceLive({ favorActive: true, points: 21 }, open), false);
    assert.strictEqual(live.shouldAnnounceLive(null, { favorActive: false, points: 21, currentCycleId: 'cycle_x' }), false);
}));

queue.push(test('badges in one 60s burst become one GGs post', async function () {
    const db = memoryDb({ 'users/pat': { username: 'Pat' } });
    const start = 1700000000000;
    const ids = [];
    for (let i = 0; i < 12; i++) ids.push('flex_pattern_' + (i + 1));
    for (let i = 0; i < ids.length; i++) {
        const queued = await badgeGg.queueBadgeGg(db, admin, 'pat', ids[i], { source: 'awardBadge', favorPoint: true }, start + i * 1000);
        assert.strictEqual(queued.queued, true, ids[i]);
    }
    const early = await badgeGg.flushDueBursts(db, admin, start + 30000);
    assert.strictEqual(early.length, 0);
    const flushed = await badgeGg.flushDueBursts(db, admin, start + badgeGg.BURST_WINDOW_MS);
    assert.strictEqual(flushed.length, 1);
    assert.strictEqual(flushed[0].posted, true);
    assert.strictEqual(flushed[0].text, '🏅 @Pat earned 12 flex badges (+12 SF points)');
    const annId = badgeGg.announcementId('pat', start);
    assert.strictEqual(db.docs['announcements/' + annId].text, flushed[0].text);
    assert.deepStrictEqual(db.docs['announcements/' + annId].badgeIds, ids);
    assert.strictEqual(db.docs['announcements/' + annId].text.indexOf('<'), -1);
    assert.strictEqual(db.docs['announcements/' + annId].postedByUid, 'badge-gg');
    assert.strictEqual(db.docs['announcements/' + annId].mentionUid, 'pat');
    assert.strictEqual(db.docs['announcements/' + annId].uid, 'nacho-bot');
    assert.ok(flushed[0].text.indexOf('pat') === -1);
    const second = await badgeGg.flushDueBursts(db, admin, start + badgeGg.BURST_WINDOW_MS + 5000);
    assert.strictEqual(second.filter(function (row) { return row.posted; }).length, 0);
    assert.strictEqual(Object.keys(db.docs).filter(function (key) { return key.indexOf('announcements/') === 0; }).length, 1);
}));

queue.push(test('a retried award is claimed once and mixed badges share a line', async function () {
    const db = memoryDb({ 'users/pat': { username: 'Pat' } });
    const start = 1700000000000;
    const first = await badgeGg.queueBadgeGg(db, admin, 'pat', 'quest_5', { source: 'awardPoints', favorPoint: true }, start);
    const retry = await badgeGg.queueBadgeGg(db, admin, 'pat', 'quest_5', { source: 'awardPoints', favorPoint: true }, start + 10);
    const spin = await badgeGg.queueBadgeGg(db, admin, 'pat', 'spin_1', { source: 'awardBadge', favorPoint: false }, start + 2000);
    assert.strictEqual(first.queued, true);
    assert.strictEqual(retry.reason, 'claimed');
    assert.strictEqual(spin.joined, true);
    assert.strictEqual(db.docs['badge_gg_bursts/pat'].items.length, 2);
    const text = badgeGg.formatBadgeGg('Pat', db.docs['badge_gg_bursts/pat'].items);
    assert.strictEqual(text, '🏅 @Pat just earned the 🏆 Quest Champion badge! 🎉 Also: First Spin (+1 SF point)');
    const major = badgeGg.formatBadgeGg('Pat', [{ badgeId: 'explorer_50', favorPoint: true }]);
    assert.strictEqual(major, '🏅 @Pat just earned the 🏕️ Pathfinder badge! 🎉 (+1 SF point)');
    const quiet = badgeGg.formatBadgeGg('Pat', [{ badgeId: 'explorer_50', favorPoint: false }]);
    assert.strictEqual(quiet, '🏅 @Pat just earned the 🏕️ Pathfinder badge! 🎉');
    const mixed = badgeGg.formatBadgeGg('Pat', [
        { badgeId: 'flex_pattern_25', favorPoint: true },
        { badgeId: 'spin_1', favorPoint: true },
        { badgeId: 'quest_1', favorPoint: true },
    ]);
    assert.strictEqual(mixed, '🏅 @Pat earned 3 badges: Pattern ×25, First Spin, Quester (+3 SF points)');
    assert.ok(mixed.indexOf('flex_pattern_25') === -1);
    assert.ok(mixed.indexOf('Flex Pattern') === -1);
    assert.ok(mixed.indexOf('pat@') === -1);
    const loneFlex = badgeGg.formatBadgeGg('Pat', [{ badgeId: 'flex_pattern_25', favorPoint: true }]);
    assert.strictEqual(loneFlex, '🏅 @Pat earned Pattern ×25 (+1 SF point)');
    const hidden = badgeGg.formatBadgeGg('Pat', [{ badgeId: 'p01', favorPoint: false }]);
    assert.strictEqual(hidden, '🏅 @Pat earned Checkmate Puzzle 1');
    assert.strictEqual(hidden.indexOf('p01'), -1);
    assert.strictEqual(hidden.indexOf('P01'), -1);
    const lastPuzzle = badgeGg.formatBadgeGg('Pat', [{ badgeId: 'p80', favorPoint: false }]);
    assert.strictEqual(lastPuzzle, '🏅 @Pat earned Checkmate Puzzle 80');
    const capped = badgeGg.formatBadgeGg('Pat', [
        { badgeId: 'quest_1', favorPoint: true },
        { badgeId: 'spin_1', favorPoint: true },
        { badgeId: 'peer_1', favorPoint: true },
        { badgeId: 'say_hi_1', favorPoint: true },
        { badgeId: 'chat_first', favorPoint: true },
        { badgeId: 'forum_first', favorPoint: true },
        { badgeId: 'explorer_5', favorPoint: true },
    ]);
    assert.strictEqual(capped, '🏅 @Pat earned 7 badges: Quester, First Spin, First Peer, Hello World, First Words and 2 more (+7 SF points)');
    assert.strictEqual(capped.indexOf('First Post'), -1);
    assert.strictEqual(capped.indexOf('Curious Mind'), -1);
    const also = badgeGg.formatBadgeGg('Pat', [
        { badgeId: 'explorer_50', favorPoint: false },
        { badgeId: 'quest_1', favorPoint: false },
        { badgeId: 'spin_1', favorPoint: false },
        { badgeId: 'peer_1', favorPoint: false },
        { badgeId: 'say_hi_1', favorPoint: false },
        { badgeId: 'chat_first', favorPoint: false },
        { badgeId: 'forum_first', favorPoint: false },
    ]);
    assert.ok(also.indexOf('Also: Quester, First Spin, First Peer, Hello World, First Words and 1 more') !== -1);
    assert.strictEqual(also.indexOf('First Post'), -1);
}));

queue.push(test('backfill and admin awards are not posted', async function () {
    const db = memoryDb({ 'users/pat': { username: 'Pat' } });
    const start = 1700000000000;
    const skipped = [
        { source: 'counter_backfill' },
        { source: 'badge_backfill' },
        { source: 'awardBadge', xpSource: 'badge_backfill' },
        { source: 'legacy' },
        { source: 'admin' },
        { source: 'admin_grant' },
        { source: 'awardBadge', backfill: true },
        { source: 'awardBadge', ggSkip: true },
    ];
    for (let i = 0; i < skipped.length; i++) {
        const result = await badgeGg.queueBadgeGg(db, admin, 'pat', 'quest_' + i, skipped[i], start);
        assert.strictEqual(result.reason, 'skip', JSON.stringify(skipped[i]));
    }
    assert.strictEqual(db.docs['badge_gg_bursts/pat'], undefined);
    assert.strictEqual(Object.keys(db.docs).filter(function (key) { return key.indexOf('badge_gg_claims/') === 0; }).length, 0);
    const real = await badgeGg.queueBadgeGg(db, admin, 'pat', 'quest_1', { source: 'combo', favorPoint: true }, start);
    assert.strictEqual(real.queued, true);
    const fanDb = memoryDb({ 'users/fan': { username: 'satoshi_fan', name: 'Real Name' } });
    await badgeGg.queueBadgeGg(fanDb, admin, 'fan', 'quest_1', { source: 'awardBadge', favorPoint: true }, start);
    const fanFlush = await badgeGg.flushDueBursts(fanDb, admin, start + badgeGg.BURST_WINDOW_MS);
    assert.strictEqual(fanFlush[0].text, '🏅 @satoshi_fan earned Quester (+1 SF point)');
    assert.strictEqual(fanFlush[0].text.indexOf('Real Name'), -1);
    assert.strictEqual(fanFlush[0].text.indexOf('satoshifan'), -1);
    assert.strictEqual(fanFlush[0].text.indexOf('\\_'), -1);
    const anonDb = memoryDb({ 'users/anon': { name: 'Real Name' } });
    await badgeGg.queueBadgeGg(anonDb, admin, 'anon', 'quest_1', { source: 'awardBadge', favorPoint: false }, start);
    const anonFlush = await badgeGg.flushDueBursts(anonDb, admin, start + badgeGg.BURST_WINDOW_MS);
    assert.strictEqual(anonFlush[0].text, '🏅 A player earned Quester');
    assert.strictEqual(anonFlush[0].text.indexOf('@A player'), -1);
    assert.strictEqual(anonFlush[0].text.indexOf('Real Name'), -1);
    const email = badgeGg.formatBadgeGg('pat@example.com 10.0.0.8', [{ badgeId: 'quest_1', favorPoint: true }]);
    assert.ok(email.indexOf('@example.com') === -1);
    assert.ok(email.indexOf('10.0.0.8') === -1);
    assert.ok(email.indexOf('🏅 A player') !== -1);
    assert.strictEqual(email.indexOf('@A player'), -1);
    const rudeDb = memoryDb({ 'users/rude': { username: 'fuck' } });
    await badgeGg.queueBadgeGg(rudeDb, admin, 'rude', 'quest_1', { source: 'awardBadge', favorPoint: false }, start);
    const rudeFlush = await badgeGg.flushDueBursts(rudeDb, admin, start + badgeGg.BURST_WINDOW_MS);
    assert.strictEqual(rudeFlush.length, 1);
    assert.strictEqual(rudeFlush[0].text, '🏅 A player earned Quester');
    assert.strictEqual(rudeFlush[0].text.indexOf('fuck'), -1);
    assert.strictEqual(rudeFlush[0].text.indexOf('@A player'), -1);
    const namedDb = memoryDb({ 'users/dickens': { username: 'Dickens' } });
    await badgeGg.queueBadgeGg(namedDb, admin, 'dickens', 'quest_1', { source: 'awardBadge', favorPoint: false }, start);
    const namedFlush = await badgeGg.flushDueBursts(namedDb, admin, start + badgeGg.BURST_WINDOW_MS);
    assert.strictEqual(namedFlush[0].text, '🏅 @Dickens earned Quester');
}));

queue.push(test('an expired reset keeps eraHashes inside the transaction', async function () {
    const past = Date.now() - 60 * 60 * 1000;
    const db = memoryDb({
        'satoshiFavor/current': {
            points: 21,
            favorActive: true,
            bonusMinutes: 0,
            eraHashes: 4242,
            currentCycleId: 'cycle_old',
            totalHashes: 8,
            winnersThisWindow: [{ uid: 'hidden-uid' }],
            favorStart: { toMillis: function () { return past - 60 * 60 * 1000; } },
            favorEndBase: { toMillis: function () { return past; } },
        },
    });
    const result = await resetExpiredFavorWith(db, Date.now());
    assert.strictEqual(result.reset, true);
    assert.strictEqual(result.eraHashes, 4242);
    assert.strictEqual(db.docs['satoshiFavor/current'].eraHashes, 4242);
    assert.strictEqual(db.docs['satoshiFavor/current'].favorActive, false);
    assert.strictEqual(db.docs['satoshiFavor/current'].points, 0);
    assert.strictEqual(db.docs['satoshiFavor/lastWindow'].difficultyTarget, 20000);
    assert.strictEqual(db.docs['satoshiFavor/lastWindow'].totalHashes, 8);
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    const cronAt = index.indexOf('exports.satoshiFavorAutoReset');
    const cron = index.slice(cronAt, cronAt + 500);
    assert.ok(cron.includes('resetExpiredFavor'));
    assert.ok(!cron.includes('archivedBy'));
    const cronBody = index.slice(cronAt, index.indexOf('// ===== TELEGRAM REACTION BRIDGE ====='));
    assert.ok(cronBody.includes('announceFavorEnding'));
    assert.ok(cronBody.includes('onSchedule'));
    assert.ok(!cronBody.includes("invoker: 'public'"));
    assert.ok(!cronBody.includes('invoker: "public"'));
    assert.ok(!cronBody.includes('onRequest'));
    assert.ok(!index.includes("invoker: 'public'"));
    assert.ok(!index.includes('invoker: "public"'));
    const favor = fs.readFileSync(path.join(root, 'functions', 'src', 'satoshiFavor.js'), 'utf8');
    const stateAt = favor.indexOf('exports.checkFavorState');
    const stateFn = favor.slice(stateAt, stateAt + 1200);
    assert.ok(stateFn.includes('resetExpiredFavor'));
    assert.ok(!stateFn.includes('await stateRef.set'));
    ['onSatoshiFavorLive', 'onBadgeAwardCreated', 'onGlobalChatTelegram', 'onAnnouncementsTelegram'].forEach(function (name) {
        const at = index.indexOf('exports.' + name);
        const body = index.slice(at, at + 220);
        assert.ok(body.includes('retry: true'), name);
    });
}));

queue.push(test('client copies and the tweet use the new wording', function () {
    const quests = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
    assert.ok(quests.includes("return '+3 min'"));
    assert.ok(quests.includes("return 'window open'"));
    assert.ok(quests.includes("return rem + ' more to go'"));
    assert.ok(!quests.includes('+1 SF point'));
    const badges = fs.readFileSync(path.join(root, 'badges.js'), 'utf8');
    assert.ok(!badges.includes('nachoGlobalAnnounce'));
    const features = fs.readFileSync(path.join(root, 'features.js'), 'utf8');
    const hiddenAt = features.indexOf('window.awardHiddenBadge');
    const hidden = features.slice(hiddenAt, hiddenAt + 900);
    assert.ok(!hidden.includes('nachoGlobalAnnounce'));
    const favorJs = fs.readFileSync(path.join(root, 'satoshi-favor.js'), 'utf8');
    assert.ok(favorJs.includes("if (type === 'start') return;"));
    assert.ok(!favorJs.includes("_nachoSFAnnounce('start')"));
    assert.ok(!favorJs.includes("SATOSHI'S FAVOR IS NOW ACTIVE"));
    assert.ok(favorJs.includes('btc_sf_activations'));
    const tweet = fs.readFileSync(path.join(root, 'functions', 'src', 'tweetSatoshisFavor.js'), 'utf8');
    assert.ok(tweet.includes('const durationMin = 60'));
    assert.ok(!tweet.includes('const durationMin = 90'));
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const dedupAt = rules.indexOf('match /satoshiFavor/announceDedup');
    const dedup = rules.slice(dedupAt, dedupAt + 180);
    assert.ok(dedup.includes('allow read: if true'));
    assert.ok(dedup.includes('allow write: if false'));
    assert.ok(rules.includes('match /sf_live_announcements/{cycleId}'));
    const endingRulesAt = rules.indexOf('match /sf_ending_announcements/{cycleId}');
    const endingRules = rules.slice(endingRulesAt, endingRulesAt + 120);
    assert.ok(endingRules.includes('allow read, write: if false'));
    assert.ok(rules.includes('match /badge_gg_bursts/{uid}'));
    assert.ok(rules.includes('match /badge_gg_claims/{claimId}'));
    const notes = fs.readFileSync(path.join(root, 'patch-notes.html'), 'utf8');
    assert.strictEqual((notes.match(/Latest:/g) || []).length, 1);
    assert.ok(notes.includes('Latest: Search any player on the XP, Daily Streaks, Quests and Top Predictors leaderboards and see their exact rank, even outside the top 25.'));
    assert.ok(notes.includes('Daily trivia shows the explanation after you answer, and a guest answer does not earn XP.'));
    assert.ok(!notes.includes('Latest: Daily trivia'));
    assert.ok(notes.includes("Earned posts in GGs chat have a 🎉 button. Tap once to celebrate, and tap again to take it back."));
    assert.ok(!notes.includes('Latest: Earned posts in GGs chat'));
    assert.ok(notes.includes("The daily wheel finishes sooner and only shows the server's prize, and a cipher, claim, key send, or inventory opened from the gift screen stays in front."));
    assert.ok(!notes.includes('Latest: The daily wheel'));
    assert.ok(notes.includes('Fixed leaderboards and your saved profile taking too long to load.'));
    assert.ok(!notes.includes('Latest: Fixed leaderboards'));
    const streaksNote = 'Daily Streaks sits above Top Predictors, with the longest streaks and the ones still going.';
    assert.ok(notes.includes(streaksNote));
    assert.ok(!notes.includes('Latest: ' + streaksNote));
    assert.ok(!/\d/.test(streaksNote));
    assert.strictEqual(streaksNote.indexOf('@'), -1);
    assert.strictEqual(streaksNote.toLowerCase().indexOf('threshold'), -1);
    assert.ok(notes.includes('Double XP now applies to every way you earn XP.'));
    assert.ok(!notes.includes('Latest: Double XP'));
    assert.ok(notes.includes('Referral badges line up with the meetup tiers, and only friends who reached Maxi count.'));
    assert.ok(!notes.includes('Latest: Referral badges'));
    const headsUp = "Global Chat now gives a heads-up when Satoshi's Favor is about to end.";
    assert.ok(notes.includes(headsUp));
    assert.ok(!notes.includes('Latest: ' + headsUp));
    assert.ok(!/\d/.test(headsUp));
    assert.strictEqual(headsUp.indexOf('@'), -1);
    assert.strictEqual(headsUp.toLowerCase().indexOf('threshold'), -1);
    assert.ok(!notes.includes('Latest: Global Chat'));
    assert.ok(notes.includes('Tap Nacho to ask a question, read his story, or open his closet. The minimize button stays out of the way, and the first visit shows a short hint that stays off the buttons and tiles.'));
    assert.ok(!notes.includes('Latest: Tap Nacho'));
    assert.ok(notes.includes('Raid bosses spawn at 1 PM Eastern on the first of the month. Chat-Charger counts real Global Chat messages on the server, and each month\'s boss has a goal the community can actually reach.'));
    assert.ok(!notes.includes('Latest: Raid bosses'));
    assert.ok(notes.includes('The raid boss shows HP remaining, the same remaining over max HP as the raid screen.'));
    assert.ok(!notes.includes('Latest: The raid boss'));
    assert.ok(notes.includes('Timechain TV: 29 new full-length documentaries on the History & Documentaries channel.'));
    assert.ok(!notes.includes('Latest: Timechain TV: 29'));
    assert.ok(notes.includes('Fixed: the Invite button and Invites tile on the homepage open your invite card again.'));
    assert.ok(!notes.includes('Latest: Fixed: the Invite button'));
    assert.ok(notes.includes('Publishing an article awards 30 XP, once per article, up to 2 a day.'));
    assert.ok(!notes.includes('Latest: Publishing an article'));
    assert.ok(notes.includes('Inventory explains how sending keys works. Add Peer is on a profile opened from Global Chat or the leaderboard, and one send can include up to 3 keys per peer each day.'));
    assert.ok(!notes.includes('Latest: Inventory explains'));
    assert.ok(notes.includes('Scholar and Protocol Expert exams keep the answer key on the server, and a passing certificate shows a real verification link.'));
    assert.ok(!notes.includes('Latest: Scholar and Protocol Expert'));
    assert.ok(notes.includes('Missing XP has been awarded to affected users.'));
    assert.ok(!notes.includes('Latest: Missing XP'));
    assert.ok(notes.includes('Settings → Sats now lists the XP you can actually earn, including the daily cap.'));
    assert.ok(!notes.includes('Latest: Settings → Sats'));
    assert.ok(notes.includes('Inventory explains how sending keys works. Add Peer is on a profile opened from Global Chat or the leaderboard, and one send can include up to 3 keys per peer each day.'));
    assert.ok(!notes.includes('Latest: Inventory explains'));
    assert.ok(notes.includes("A miner's public name is what Satoshi's Favor saves, and a player with no name shows as Anon."));
    assert.ok(!notes.includes("Latest: A miner's public name"));
    assert.ok(notes.includes("Passing the Bitcoin Scholar or Protocol Expert certification pays 2,100 XP outside the daily cap, and the Learn tab opens Quests for lessons, trails, daily quests, and both certifications."));
    assert.ok(!notes.includes("Latest: Passing the Bitcoin Scholar"));
    assert.ok(notes.includes('On a computer, Browse topics opens a full-screen browser of every topic, grouped like the sidebar, with live title search and the same completed, locked, and new marks.'));
    assert.ok(!notes.includes('Latest: On a computer'));
    assert.ok(notes.includes('A miner\'s public name is what Satoshi\'s Favor saves, and a player with no name shows as Anon.'));
    assert.ok(!notes.includes('Latest: A miner'));
    assert.ok(notes.includes('Sidebar topic names are easier to read, the extra Stablecoins and Consensus buttons are gone, and the number emoji on Mining, Solved Technical Problems, and Web5 display correctly.'));
    assert.ok(!notes.includes('Latest: Sidebar topic names'));
    assert.ok(notes.includes('Badge tooltips are back in GGs chat, so each badge name in a single or grouped post opens the icon, name, description, and how to earn it.'));
    assert.ok(!notes.includes('Latest: Badge tooltips'));
    assert.ok(notes.includes('Opening gifts is faster, every button responds right away, and your prize shows the moment a gift opens.'));
    assert.ok(!notes.includes('Latest: Opening gifts'));
    assert.ok(notes.includes('Sidebar topic names are easier to read, the extra Stablecoins and Consensus buttons are gone, and the number emoji on Mining, Solved Technical Problems, and Web5 display correctly.'));
    assert.ok(!notes.includes('Latest: Sidebar'));
    assert.ok(notes.includes('The Invite button now stays on the home screen as a small pill, so you can always invite a friend.'));
    assert.ok(!notes.includes('Latest: The Invite button'));
    assert.ok(notes.includes('The daily XP bar now labels the full, half and quarter rate sections underneath so it is clear how much XP each part pays.'));
    assert.ok(!notes.includes('Latest: The daily XP bar'));
    assert.ok(notes.includes('On a computer, Browse topics opens a full-screen browser of every topic, grouped like the sidebar, with live title search and the same completed, locked, and new marks.'));
    assert.ok(!notes.includes('Latest: On a computer'));
    assert.ok(notes.includes('Trivia and poll community totals now update the moment you answer and stay live while the results are open.'));
    assert.ok(!notes.includes('Latest: Trivia'));
    assert.ok(notes.includes('A More tools button beside chat opens AI Tools, Metrics, and Leaderboard, and those three apps are in the desktop Explore Apps grid too.'));
    assert.ok(!notes.includes('Latest: A More tools button'));
    assert.ok(notes.includes('Nacho now announces in global chat when Satoshi\'s Favor goes live, every badge you earn shows in GGs chat, and GGs and global chat now appear in our Telegram group.'));
    assert.ok(!notes.includes('Latest: Nacho now announces'));
    assert.ok(!notes.includes('Latest: Nacho now announces in global chat when Satoshi\'s Favor goes live, and every badge you earn now shows in GGs chat.'));
}));

function openWindow(cycleId, now, remainingMs, extra) {
    return Object.assign({
        favorActive: true,
        currentCycleId: cycleId,
        favorEndBase: now + remainingMs,
        bonusMinutes: 0,
        points: 21,
        winnersThisWindow: [{ uid: 'uid-alice', username: 'Alice' }],
    }, extra || {});
}

function chatPaths(db) {
    return Object.keys(db.docs).filter(function (key) { return key.indexOf('global_chat/') === 0; });
}

queue.push(test('ten minutes left posts once, and a retry reuses the stored chat id', async function () {
    const now = 1700000000000;
    const state = openWindow('cycle_2000', now, ending.HEADS_UP_MS);
    const db = memoryDb({ 'satoshiFavor/current': state });
    const calls = [];
    for (let i = 0; i < 5; i++) calls.push(ending.announceFavorEnding(db, admin, now));
    const results = await Promise.all(calls);
    const posted = results.filter(function (row) { return row && row.posted; });
    assert.strictEqual(posted.length, 1);
    const text = "⏳ Satoshi's Favor ends soon. Hash now!";
    assert.strictEqual(ending.formatEndingAnnouncement(), text);
    assert.strictEqual(posted[0].text, text);
    assert.strictEqual(text.indexOf('⚡'), -1);
    assert.strictEqual(text.indexOf('#favor'), -1);
    const liveText = live.formatLiveAnnouncement({ total: 21, players: 5, flex: 12, badges: 5, trifectas: 4 }, 21);
    assert.strictEqual(liveText.indexOf('#favor'), -1);
    assert.ok(!/\d/.test(text));
    assert.strictEqual(ending.HEADS_UP_MS, 10 * 60 * 1000);
    const chatId = posted[0].chatId;
    assert.ok(/^[a-f0-9]{32}$/.test(chatId));
    assert.strictEqual(chatId.indexOf('cycle_2000'), -1);
    assert.strictEqual(chatId.indexOf('sf_ending'), -1);
    const chat = db.docs['global_chat/' + chatId];
    assert.strictEqual(chat.text, text);
    assert.strictEqual(chat.uid, 'nacho-bot');
    assert.strictEqual(chat.name, '🦌 Nacho');
    assert.strictEqual(chat.isNachoAuto, false);
    assert.strictEqual(chat.cycleId, 'cycle_2000');
    assert.strictEqual(db.docs['sf_ending_announcements/cycle_2000'].chatId, chatId);
    assert.strictEqual(text.indexOf('Alice'), -1);
    assert.strictEqual(text.indexOf('uid-alice'), -1);
    assert.strictEqual(text.indexOf('@'), -1);
    const forwarded = mirror.decideMirror({ collection: 'global_chat', data: chat });
    assert.strictEqual(forwarded.forward, true);
    assert.ok(forwarded.line.indexOf('ends soon') !== -1);
    let transactions = 0;
    const origTx = db.runTransaction;
    db.runTransaction = function (fn) {
        transactions += 1;
        return origTx(fn);
    };
    const again = await ending.announceFavorEnding(db, admin, now);
    assert.strictEqual(again.posted, false);
    assert.strictEqual(again.reason, 'exists');
    assert.strictEqual(again.chatId, chatId);
    assert.strictEqual(transactions, 0);
    assert.strictEqual(chatPaths(db).length, 1);
    assert.strictEqual(Object.keys(db.docs).filter(function (key) { return key.indexOf('sf_ending_announcements/') === 0; }).length, 1);
}));

queue.push(test('a forged chat doc does not suppress the heads-up, and the marker does', async function () {
    const now = 1700000000000;
    const state = openWindow('cycle_forge', now, 9 * 60 * 1000 + 1);
    const db = memoryDb({
        'satoshiFavor/current': state,
        'global_chat/sf_ending_cycle_forge': { uid: 'user1', name: 'phil', text: 'not the heads-up' },
    });
    const first = await ending.announceFavorEnding(db, admin, now);
    assert.strictEqual(first.posted, true);
    assert.strictEqual(first.text, "⏳ Satoshi's Favor ends soon. Hash now!");
    assert.strictEqual(db.docs['global_chat/sf_ending_cycle_forge'].uid, 'user1');
    assert.strictEqual(db.docs['global_chat/sf_ending_cycle_forge'].text, 'not the heads-up');
    assert.notStrictEqual(first.chatId, 'sf_ending_cycle_forge');
    assert.strictEqual(db.docs['global_chat/' + first.chatId].uid, 'nacho-bot');
    assert.strictEqual(chatPaths(db).length, 2);
    const held = memoryDb({
        'satoshiFavor/current': state,
        'sf_ending_announcements/cycle_forge': { cycleId: 'cycle_forge', chatId: 'a1b2c3d4e5f67890' },
    });
    let transactions = 0;
    const origTx = held.runTransaction;
    held.runTransaction = function (fn) {
        transactions += 1;
        return origTx(fn);
    };
    const second = await ending.announceFavorEnding(held, admin, now);
    assert.strictEqual(second.posted, false);
    assert.strictEqual(second.reason, 'exists');
    assert.strictEqual(second.chatId, 'a1b2c3d4e5f67890');
    assert.strictEqual(transactions, 0);
    assert.strictEqual(chatPaths(held).length, 0);
}));

queue.push(test('an early close or no time left does not post', async function () {
    const now = 1700000000000;
    const early = memoryDb({
        'satoshiFavor/current': openWindow('cycle_early', now, 20 * 60 * 1000, { favorActive: false }),
    });
    const closed = await ending.announceFavorEnding(early, admin, now);
    assert.strictEqual(closed.posted, false);
    assert.strictEqual(closed.reason, 'inactive');
    assert.strictEqual(Object.keys(early.docs).filter(function (key) { return key.indexOf('sf_ending_') === 0 || key.indexOf('global_chat/') === 0; }).length, 0);
    const done = memoryDb({
        'satoshiFavor/current': openWindow('cycle_done', now, -1000),
    });
    const none = await ending.announceFavorEnding(done, admin, now);
    assert.strictEqual(none.posted, false);
    assert.strictEqual(none.reason, 'no_time');
    assert.strictEqual(Object.keys(done.docs).length, 1);
    const later = memoryDb({
        'satoshiFavor/current': openWindow('cycle_later', now, ending.HEADS_UP_MS + 1),
    });
    const waiting = await ending.announceFavorEnding(later, admin, now);
    assert.strictEqual(waiting.posted, false);
    assert.strictEqual(waiting.reason, 'not_yet');
    const extended = memoryDb({
        'satoshiFavor/current': openWindow('cycle_bonus', now, 8 * 60 * 1000, { bonusMinutes: 5 }),
    });
    const bonus = await ending.announceFavorEnding(extended, admin, now);
    assert.strictEqual(bonus.posted, false);
    assert.strictEqual(bonus.reason, 'not_yet');
    const raced = memoryDb({
        'satoshiFavor/current': openWindow('cycle_race', now, 5 * 60 * 1000),
    });
    const orig = raced.runTransaction;
    raced.runTransaction = function (fn) {
        return orig(async function (t) {
            const get = t.get;
            t.get = async function (r) {
                if (r.path === 'satoshiFavor/current') raced.docs['satoshiFavor/current'].favorActive = false;
                return get(r);
            };
            return fn(t);
        });
    };
    const lost = await ending.announceFavorEnding(raced, admin, now);
    assert.strictEqual(lost.posted, false);
    assert.strictEqual(lost.reason, 'inactive');
    assert.strictEqual(raced.docs['sf_ending_announcements/cycle_race'], undefined);
    assert.strictEqual(chatPaths(raced).length, 0);
    const one = memoryDb({
        'satoshiFavor/current': openWindow('cycle_one', now, 1, {
            favorEndBase: { toMillis: function () { return now + 1; } },
        }),
    });
    const last = await ending.announceFavorEnding(one, admin, now);
    assert.strictEqual(last.posted, true);
    assert.strictEqual(last.text, "⏳ Satoshi's Favor ends soon. Hash now!");
    assert.strictEqual(last.text.indexOf('Alice'), -1);
    assert.ok(!/\d/.test(last.text));
}));

queue.reduce(function (p, next) { return p.then(function () { return next; }); }, Promise.resolve()).then(function () {
    console.log(passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
});
