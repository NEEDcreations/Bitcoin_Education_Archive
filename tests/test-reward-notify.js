// Reward notification helper: message shape, badge/rank ids, and day grouping.
const assert = require('assert');
const rn = require('../functions/src/rewardNotify');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

test('gift message joins XP and tickets', () => {
    const msg = rn.formatRewardMessage({ xp: 150, tickets: 3, sourceLabel: 'opening a gift' });
    assert.strictEqual(msg, '+150 XP and +3 🎟️ from opening a gift');
});

test('purchase deduction uses the colon form', () => {
    const msg = rn.formatRewardMessage({
        tickets: -50,
        deduction: true,
        sourceLabel: 'bought Double XP',
    });
    assert.strictEqual(msg, '-50 🎟️: bought Double XP');
});

test('badge copy includes the icon, name, and description', () => {
    const msg = rn.badgeMessage('explorer_10');
    assert.ok(msg.indexOf('🧭') === 0, msg);
    assert.ok(msg.indexOf('New badge: Explorer!') !== -1, msg);
    assert.ok(msg.indexOf('Visited 10 topics') !== -1, msg);
});

test('badge doc id is stable per user and badge', () => {
    const a = rn.badgeDocId('user_1', 'explorer_10');
    const b = rn.badgeDocId('user_1', 'explorer_10');
    const c = rn.badgeDocId('user_1', 'explorer_25');
    assert.strictEqual(a, b);
    assert.notStrictEqual(a, c);
    assert.ok(a.indexOf('badge_') === 0);
});

test('rank-up fires once per crossed level, including Maxi', () => {
    const jumped = rn.levelsCrossed(2100, 50).map(function(l) { return l.name; });
    assert.deepStrictEqual(jumped, ['Maxi']);
    const again = rn.levelsCrossed(2140, 50);
    assert.strictEqual(again.length, 0);
    const plans = rn.plan({ uid: 'abc', pointsBefore: 2100, pointsDelta: 50 });
    assert.strictEqual(plans.length, 1);
    assert.strictEqual(plans[0].id, rn.rankDocId('abc', 'Maxi'));
    assert.ok(plans[0].data.message.indexOf('Rank up: Maxi!') !== -1);
});

test('high-frequency sources share one doc per day and add totals', () => {
    assert.strictEqual(rn.groupForAction('tctv_watch_10m'), 'tctv');
    assert.strictEqual(rn.groupForAction('tctv_watch_ticket'), 'tctv');
    assert.strictEqual(rn.groupForAction('quiz_correct'), 'quiz');
    assert.strictEqual(rn.groupForAction('quest_complete'), null);
    const day = '2026-10-22';
    const id = rn.groupDocId('abc', 'tctv', day);
    assert.strictEqual(rn.groupDocId('abc', 'tctv', day), id);
    assert.notStrictEqual(rn.groupDocId('abc', 'tctv', '2026-10-23'), id);
    const plans = rn.plan({
        uid: 'abc',
        action: 'tctv_watch_10m',
        day: day,
        xp: 10,
        tickets: 1,
        existing: { xp: 10, tickets: 2, sats: 0, freezes: 0, boosterHashes: 0, count: 2 },
    });
    assert.strictEqual(plans.length, 1);
    assert.strictEqual(plans[0].id, id);
    assert.strictEqual(plans[0].grouped, false);
    assert.strictEqual(plans[0].data.xp, 20);
    assert.strictEqual(plans[0].data.tickets, 3);
    assert.strictEqual(plans[0].data.count, 3);
    assert.ok(plans[0].data.message.indexOf('+20 XP and +3 🎟️ from Timechain TV (3)') === 0, plans[0].data.message);
});

test('a grouped plan without a prior read is merged later', () => {
    const plans = rn.plan({ uid: 'abc', action: 'quiz_correct', day: '2026-10-22', xp: 10 });
    assert.strictEqual(plans[0].grouped, true);
    assert.strictEqual(plans[0].delta.xp, 10);
});

test('an unchanged rank or grouped notice is not written again', () => {
    const rank = rn.plan({ uid: 'abc', pointsBefore: 2100, pointsDelta: 50 })[0];
    const stored = Object.assign({}, rank.data, { read: true, createdAt: 'old' });
    assert.strictEqual(rn.sameNoticeContent(stored, rank.data), true);
    assert.strictEqual(rn.prepareNoticeWrite(rank.data, stored, 'now'), null);
    const changed = Object.assign({}, stored, { xp: 25, message: stored.message + ' more' });
    const rewritten = rn.prepareNoticeWrite(rank.data, changed, 'now');
    assert.strictEqual(rewritten.read, false);
    assert.strictEqual(rewritten.createdAt, 'now');
});

test('a grouped rewrite stays read until the totals change', async () => {
    const store = {};
    function ref(id) { return { id: id }; }
    const db = {
        collection: function() { return { doc: ref }; },
        runTransaction: async function(fn) {
            const t = {
                get: async function(r) {
                    const data = store[r.id];
                    return { exists: !!data, data: function() { return data; } };
                },
                set: function(r, data) { store[r.id] = Object.assign({}, store[r.id], data); },
            };
            await fn(t);
        },
    };
    const day = '2026-10-22';
    const first = rn.plan({ uid: 'abc', action: 'quiz_correct', day: day, xp: 10 });
    await rn.commit(db, 't1', first);
    const id = first[0].id;
    assert.strictEqual(store[id].read, false);
    assert.strictEqual(store[id].xp, 10);
    store[id].read = true;
    await rn.commit(db, 't2', rn.plan({ uid: 'abc', action: 'quiz_correct', day: day, xp: 10 }));
    assert.strictEqual(store[id].xp, 20);
    assert.strictEqual(store[id].read, false);

    const rank = rn.plan({ uid: 'abc', pointsBefore: 2100, pointsDelta: 50 });
    await rn.commit(db, 'r1', rank);
    const rankId = rank[0].id;
    assert.strictEqual(store[rankId].read, false);
    store[rankId].read = true;
    await rn.commit(db, 'r2', rn.plan({ uid: 'abc', pointsBefore: 2100, pointsDelta: 50 }));
    assert.strictEqual(store[rankId].read, true, 'same rank copy must not become unread');
});

test('sumSpec adds a second hash-booster debit onto the same day', () => {
    const merged = rn.sumSpec({ boosterHashes: -4, count: 4, xp: 0 }, { boosterHashes: -1, count: 1 });
    assert.strictEqual(merged.boosterHashes, -5);
    assert.strictEqual(merged.count, 5);
    const msg = rn.formatRewardMessage(Object.assign({}, merged, { sourceLabel: "Satoshi's Favor" }));
    assert.ok(msg.indexOf('-5 hash-booster hashes') === 0, msg);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
