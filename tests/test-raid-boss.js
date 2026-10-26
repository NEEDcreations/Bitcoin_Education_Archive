#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const engine = require('../functions/src/raidBossEngine');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
    const run = fn.length ? fn : function () { return fn(); };
    return Promise.resolve().then(run).then(function () {
        console.log('ok ' + name);
        passed += 1;
    }).catch(function (err) {
        failed += 1;
        console.error('FAIL ' + name);
        console.error(err && err.stack || err);
    });
}

function memoryDb() {
    const docs = new Map();
    const order = [];
    let seq = 0;
    function keyOf(parts) { return parts.join('/'); }
    function ref(parts) {
        return {
            id: parts[parts.length - 1],
            path: keyOf(parts),
            get: async function () {
                const value = docs.get(keyOf(parts));
                return {
                    exists: value != null,
                    id: parts[parts.length - 1],
                    data: function () { return value ? Object.assign({}, value) : undefined; },
                    ref: this,
                };
            },
            set: async function (data, opts) {
                order.push(keyOf(parts));
                const prev = docs.get(keyOf(parts)) || {};
                docs.set(keyOf(parts), (opts && opts.merge) ? Object.assign({}, prev, data) : Object.assign({}, data));
            },
            update: async function (data) {
                order.push(keyOf(parts));
                const prev = docs.get(keyOf(parts));
                if (!prev) throw new Error('missing ' + keyOf(parts));
                docs.set(keyOf(parts), Object.assign({}, prev, data));
            },
            collection: function (name) { return col(parts.concat(name)); },
        };
    }
    function rows(parts) {
        const prefix = keyOf(parts) + '/';
        const found = [];
        docs.forEach(function (value, key) {
            if (key.indexOf(prefix) !== 0) return;
            const rest = key.slice(prefix.length);
            if (rest.indexOf('/') !== -1) return;
            found.push({ id: rest, data: function () { return Object.assign({}, value); } });
        });
        return found;
    }
    function col(parts) {
        return {
            doc: function (id) {
                return ref(parts.concat(id || ('auto' + (++seq))));
            },
            add: async function (data) {
                const child = ref(parts.concat('auto' + (++seq)));
                await child.set(data);
                return child;
            },
            get: async function () {
                const list = rows(parts);
                return { empty: list.length === 0, docs: list, size: list.length, forEach: function (fn) { list.forEach(fn); } };
            },
            where: function (field, op, value) {
                const filters = [{ field: field, op: op, value: value }];
                const query = {
                    orderBy: function () { return query; },
                    limit: function (n) { query._limit = n; return query; },
                    get: async function () {
                        let list = rows(parts).filter(function (row) {
                            const data = row.data();
                            return filters.every(function (filter) {
                                const left = data[filter.field];
                                const lms = left && left.toDate ? left.toDate().getTime() : left;
                                const rms = filter.value && filter.value.toDate ? filter.value.toDate().getTime() : filter.value;
                                if (filter.op === '<') return lms < rms;
                                return false;
                            });
                        });
                        list.sort(function (a, b) {
                            const am = a.data().startTime && a.data().startTime.toDate ? a.data().startTime.toDate().getTime() : 0;
                            const bm = b.data().startTime && b.data().startTime.toDate ? b.data().startTime.toDate().getTime() : 0;
                            return bm - am;
                        });
                        if (query._limit) list = list.slice(0, query._limit);
                        return { empty: list.length === 0, docs: list, forEach: function (fn) { list.forEach(fn); } };
                    },
                };
                return query;
            },
        };
    }
    return {
        order: order,
        docs: docs,
        collection: function (name) { return col([name]); },
        runTransaction: async function (fn) {
            const writes = [];
            const tx = {
                get: function (r) { return r.get(); },
                set: function (r, data, opts) { writes.push({ r: r, data: data, opts: opts, kind: 'set' }); },
                update: function (r, data) { writes.push({ r: r, data: data, kind: 'update' }); },
            };
            const result = await fn(tx);
            for (let i = 0; i < writes.length; i++) {
                const write = writes[i];
                if (write.kind === 'set') await write.r.set(write.data, write.opts);
                else await write.r.update(write.data);
            }
            return result;
        },
    };
}

function adminFor() {
    return {
        firestore: {
            FieldValue: {
                serverTimestamp: function () {
                    const at = new Date();
                    return { toDate: function () { return at; } };
                },
                increment: function (n) { return { _inc: n }; },
            },
            Timestamp: {
                fromDate: function (date) {
                    return { toDate: function () { return date; } };
                },
            },
        },
    };
}

function ts(date) {
    return { toDate: function () { return date; } };
}

async function main() {
    await test('1 PM Eastern is 18:00 UTC in November and March, 17:00 UTC in July', function () {
        assert.strictEqual(engine.zonedTimeToUtc(2026, 11, 1, 13, 0, 0).toISOString(), '2026-11-01T18:00:00.000Z');
        assert.strictEqual(engine.zonedTimeToUtc(2026, 3, 1, 13, 0, 0).toISOString(), '2026-03-01T18:00:00.000Z');
        assert.strictEqual(engine.zonedTimeToUtc(2026, 7, 1, 13, 0, 0).toISOString(), '2026-07-01T17:00:00.000Z');
        assert.strictEqual(engine.inSpawnWindow(new Date('2026-11-01T17:30:00.000Z')), false);
        assert.strictEqual(engine.inSpawnWindow(new Date('2026-11-01T18:00:00.000Z')), true);
        assert.strictEqual(engine.inSpawnWindow(new Date('2026-11-02T05:00:00.000Z')), true);
        assert.strictEqual(engine.inSpawnWindow(new Date('2026-11-03T18:00:00.000Z')), false);
    });

    await test('goal scale crosses 1000 on the goal hit and not before', function () {
        function sum(goal, hits) {
            const scale = engine.damageScaleForGoal(goal);
            let total = 0;
            for (let i = 0; i < hits; i++) total += engine.hitDamage(1, scale);
            return Math.round(total * 1000) / 1000;
        }
        assert.ok(sum(335, 334) < 1000);
        assert.ok(sum(335, 335) >= 1000);
        assert.ok(sum(7, 6) < 1000);
        assert.ok(sum(7, 7) >= 1000);
        assert.strictEqual(Math.round(engine.damageScaleForGoal(335) * 1000), 2986);
    });

    await test('schedule is twelve months, November stays 335, others use 1.35', function () {
        assert.strictEqual(engine.SCHEDULE.length, 12);
        assert.strictEqual(engine.SCHEDULE[0].name, 'Chat-Charger');
        assert.strictEqual(engine.SCHEDULE[0].goal, 335);
        assert.notStrictEqual(engine.SCHEDULE[0].goal, engine.goalFromTypical(230));
        engine.SCHEDULE.slice(1).forEach(function (entry) {
            assert.strictEqual(entry.goal, engine.goalFromTypical(entry.typical), entry.name);
        });
        const names = engine.SCHEDULE.map(function (entry) { return entry.name; });
        assert.ok(names.indexOf('Cipher-Cracker') !== -1);
        assert.ok(names.indexOf('TV-Titan') === -1);
        assert.ok(names.indexOf('Beats-Baron') === -1);
        assert.ok(names.indexOf('Lightning-Lancer') === -1);
        engine.SCHEDULE.forEach(function (entry) {
            assert.ok(engine.isServerOnlyMetric(entry.metric), entry.metric);
        });
    });

    await test('final and weekly text are plain and include the required lines', function () {
        const down = engine.finalText({ name: 'Chat-Charger', defeated: true, current: 1000, target: 1000 });
        assert.ok(down.indexOf('we took it down') !== -1);
        assert.ok(down.indexOf('an extra Orange Ticket giveaway winner will be announced by the end of the week') !== -1);
        const up = engine.finalText({ name: 'Chat-Charger', defeated: false, current: 250, target: 1000 });
        assert.ok(up.indexOf('25%') !== -1);
        assert.ok(up.indexOf('We got partway there') !== -1);
        const week = engine.weeklyText({ name: 'Chat-Charger', defeated: false, current: 0, target: 1000 });
        assert.ok(week.indexOf(engine.REWARD_LINE) !== -1);
        assert.ok(week.indexOf('Open Quest Hub, then Raid.') !== -1);
        assert.ok(week.indexOf('**') === -1);
        const won = engine.weeklyText({ name: 'Chat-Charger', defeated: true, current: 1000, target: 1000 });
        assert.ok(won.indexOf('we took down Chat-Charger') !== -1);
        assert.ok(won.indexOf('The victory stands') !== -1);
        assert.ok(won.indexOf('21,000') !== -1);
        assert.ok(won.indexOf('**') === -1);
    });

    await test('spawn is idempotent, posts the final first, and copies scale fields', async function () {
        const db = memoryDb();
        const admin = adminFor();
        const prevStart = engine.zonedTimeToUtc(2026, 10, 1, 13, 0, 0);
        await db.collection('raid_bosses').doc('legacyBoss').set({
            name: 'Old-Boss',
            current: 400,
            target: 1000,
            defeated: false,
            placeholder: false,
            startTime: ts(prevStart),
            damageScale: 1,
            communityTarget: 999,
            liveDamageMultiplier: 3,
            email: 'hidden@example.com',
            notes: { secret: true },
        });
        const first = await engine.runScheduledSpawn(db, admin, new Date('2026-11-01T18:00:00.000Z'));
        assert.strictEqual(first.created, true);
        const boss = (await db.collection('raid_bosses').doc('2026-11').get()).data();
        assert.strictEqual(boss.name, 'Chat-Charger');
        assert.strictEqual(boss.communityTarget, 335);
        assert.strictEqual(boss.target, 1000);
        assert.strictEqual(boss.liveDamageMultiplier, 3);
        assert.strictEqual(boss.placeholder, false);
        assert.ok(!boss.email);
        assert.strictEqual(boss.damageScale, engine.damageScaleForGoal(335));
        const chat = await db.collection('global_chat').doc('raid-final-legacyBoss').get();
        assert.strictEqual(chat.exists, true);
        assert.strictEqual(chat.data().uid, 'nacho-bot');
        assert.strictEqual(chat.data().name, '🦌 Nacho');
        assert.strictEqual(chat.data().isNachoAuto, false);
        assert.ok(chat.data().text.indexOf('40%') !== -1);
        const chatAt = db.order.indexOf('global_chat/raid-final-legacyBoss');
        const bossAt = db.order.indexOf('raid_bosses/2026-11');
        assert.ok(chatAt !== -1 && chatAt < bossAt);
        const second = await engine.runScheduledSpawn(db, admin, new Date('2026-11-01T19:00:00.000Z'));
        assert.strictEqual(second.skipped, 'exists');
        assert.strictEqual((await db.collection('raid_bosses').doc('2026-11').get()).data().current, 0);
        const early = memoryDb();
        const tooSoon = await engine.runScheduledSpawn(early, admin, new Date('2026-11-01T17:30:00.000Z'));
        assert.strictEqual(tooSoon.skipped, 'out-of-window');
        assert.strictEqual((await early.collection('raid_bosses').doc('2026-11').get()).exists, false);
        const march = await engine.runScheduledSpawn(memoryDb(), admin, new Date('2026-03-01T18:00:00.000Z'));
        assert.strictEqual(march.skipped, 'unscheduled');
    });

    await test('a missing final blocks the new boss, and day-2 catch-up still spawns', async function () {
        const db = memoryDb();
        const admin = adminFor();
        db.runTransaction = async function () { throw new Error('final failed'); };
        let threw = false;
        try {
            await engine.spawnOrAlert(db, admin, new Date('2026-11-02T15:00:00.000Z'), {
                chatId: '12345',
                token: 'test-token',
                send: async function () { return false; },
            });
        } catch (e) { threw = true; }
        assert.strictEqual(threw, true);
        assert.strictEqual((await db.collection('raid_bosses').doc('2026-11').get()).exists, false);
        const alert = await db.collection('raid_boss_alerts').doc('2026-11').get();
        assert.strictEqual(alert.data().notified, true);
        assert.strictEqual(alert.data().dmSent, false);
        const notes = await db.collection('admin_notifications').get();
        assert.strictEqual(notes.size, 1);
        assert.strictEqual(notes.docs[0].data().type, 'raid_spawn_failure');
        assert.strictEqual(notes.docs[0].data().text, engine.spawnFailureMessage('2026-11'));
        const again = await engine.alertSpawnFailure(db, admin, '2026-11', new Error('again'), {
            chatId: '12345',
            token: 'test-token',
            send: async function () { return true; },
        });
        assert.strictEqual(again.dmSent, true);
        assert.strictEqual((await db.collection('admin_notifications').get()).size, 1);
        let sent = false;
        await engine.alertSpawnFailure(memoryDb(), admin, '2026-12', new Error('nope'), {
            chatId: '-1003827558565',
            token: 'test-token',
            send: async function () { sent = true; return true; },
        });
        assert.strictEqual(sent, false);
        const caught = memoryDb();
        const made = await engine.runScheduledSpawn(caught, admin, new Date('2026-11-02T15:00:00.000Z'));
        assert.strictEqual(made.created, true);
        assert.strictEqual((await caught.collection('raid_bosses').doc('2026-11').get()).data().name, 'Chat-Charger');
    });

    await test('weekly post is once per week and still posts after a win', async function () {
        const db = memoryDb();
        const admin = adminFor();
        const start = engine.zonedTimeToUtc(2026, 11, 1, 13, 0, 0);
        const end = engine.zonedTimeToUtc(2026, 12, 1, 13, 0, 0);
        await db.collection('raid_bosses').doc('2026-11').set({
            name: 'Chat-Charger',
            current: 10,
            target: 1000,
            defeated: false,
            placeholder: false,
            startTime: ts(start),
            endTime: ts(end),
        });
        const when = new Date('2026-11-08T23:00:00.000Z');
        const week = engine.isoWeekKey(when);
        const first = await engine.postWeekly(db, admin, when);
        const second = await engine.postWeekly(db, admin, when);
        assert.strictEqual(first.wrote, true);
        assert.strictEqual(second.wrote, false);
        const chat = await db.collection('global_chat').doc('raid-weekly-' + week).get();
        assert.ok(chat.data().text.indexOf('Rewards: Orange Tickets') !== -1);
        assert.strictEqual(chat.data().isNachoAuto, false);
        await db.collection('raid_bosses').doc('2026-11').set({
            name: 'Chat-Charger',
            current: 1000,
            target: 1000,
            defeated: true,
            placeholder: false,
            startTime: ts(start),
            endTime: ts(end),
        });
        const later = new Date('2026-11-15T23:00:00.000Z');
        const victory = await engine.postWeekly(db, admin, later);
        assert.strictEqual(victory.wrote, true);
        const won = await db.collection('global_chat').doc('raid-weekly-' + engine.isoWeekKey(later)).get();
        assert.ok(won.data().text.indexOf('we took down Chat-Charger') !== -1);
        assert.ok(won.data().text.indexOf('The victory stands') !== -1);
    });

    await test('chat damage enforces length, daily cap, bans, and defeat recording', async function () {
        const db = memoryDb();
        const admin = adminFor();
        await engine.runScheduledSpawn(db, admin, new Date('2026-11-01T18:00:00.000Z'));
        await db.collection('users').doc('ada').set({ username: 'ada' });
        await db.collection('users').doc('bad').set({ username: 'bad', ban_reason: 'banned' });
        const now = new Date('2026-11-15T18:00:00.000Z');
        const opts = { grantTickets: null, badges: false, now: now, metric: 'chatMessages', amount: 1 };
        const short = await engine.creditTrusted(db, admin, Object.assign({}, opts, { uid: 'ada', dedupeKey: 'chat-short', text: 'hi \u200B' }));
        assert.strictEqual(short.status, 'short');
        const bot = await engine.creditTrusted(db, admin, Object.assign({}, opts, { uid: 'nacho-bot', dedupeKey: 'chat-bot', text: '12345678' }));
        assert.strictEqual(bot.status, 'bot');
        const banned = await engine.creditTrusted(db, admin, Object.assign({}, opts, { uid: 'bad', dedupeKey: 'chat-ban', text: '12345678' }));
        assert.strictEqual(banned.status, 'banned');
        let last = null;
        for (let i = 0; i < 10; i++) {
            last = await engine.creditTrusted(db, admin, Object.assign({}, opts, { uid: 'ada', dedupeKey: 'chat-' + i, text: '12345678' }));
            assert.strictEqual(last.status, 'ok');
        }
        const cap = await engine.creditTrusted(db, admin, Object.assign({}, opts, { uid: 'ada', dedupeKey: 'chat-over', text: '12345678' }));
        assert.strictEqual(cap.status, 'cap');
        const dup = await engine.creditTrusted(db, admin, Object.assign({}, opts, { uid: 'ada', dedupeKey: 'chat-0', text: '12345678' }));
        assert.strictEqual(dup.status, 'dup');
        const self = await engine.creditTrusted(db, admin, Object.assign({}, opts, { uid: 'ada', otherUid: 'ada', dedupeKey: 'chat-self', text: '12345678' }));
        assert.strictEqual(self.status, 'self');
        const boss = (await db.collection('raid_bosses').doc('2026-11').get()).data();
        assert.ok(boss.current > 0 && boss.current < 1000);
        assert.strictEqual(boss.defeated, false);

        const slim = memoryDb();
        const start = engine.zonedTimeToUtc(2026, 11, 1, 13, 0, 0);
        const end = engine.zonedTimeToUtc(2026, 12, 1, 13, 0, 0);
        await slim.collection('raid_bosses').doc('2026-11').set({
            name: 'Chat-Charger',
            metric: 'chatMessages',
            sources: ['chatMessages'],
            target: 1000,
            damageScale: 1000,
            dailyCap: 5,
            minVisibleChars: 8,
            current: 0,
            defeated: false,
            placeholder: false,
            startTime: ts(start),
            endTime: ts(end),
        });
        await slim.collection('users').doc('ada').set({ username: 'ada' });
        const hit = await engine.creditTrusted(slim, admin, Object.assign({}, opts, { uid: 'ada', dedupeKey: 'chat-win', text: '12345678' }));
        assert.strictEqual(hit.defeated, true);
        const winner = await slim.collection('raid_bosses').doc('2026-11').collection('winners').doc('ada').get();
        assert.strictEqual(winner.data().satsAwarded, 1000);
        assert.strictEqual(winner.data().paid, false);
        const after = await engine.creditTrusted(slim, admin, Object.assign({}, opts, { uid: 'ada', dedupeKey: 'chat-after', text: '12345678' }));
        assert.strictEqual(after.status, 'no-boss');
    });

    await test('client callable source rejects server metrics before any cap write', function () {
        const src = fs.readFileSync(path.join(root, 'functions/src/contributeRaid.js'), 'utf8');
        assert.ok(src.indexOf('requireSecondFactor') !== -1);
        const guard = src.indexOf('isServerOnlyMetric');
        const cap = src.indexOf('raid_daily_caps');
        assert.ok(guard > 0 && guard < cap);
        assert.ok(src.indexOf("permission-denied") !== -1);
        const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
        assert.ok(index.indexOf("schedule: '0 19 * * 0'") !== -1);
        assert.ok(index.indexOf("timeZone: 'America/New_York'") !== -1);
        assert.strictEqual(index.indexOf('0 23 * * 0'), -1);
        const schedule = fs.readFileSync(path.join(root, 'functions/src/scheduleRaidBoss.js'), 'utf8');
        assert.ok(schedule.indexOf("schedule: '0 13 1 * *'") !== -1);
        assert.ok(schedule.indexOf("schedule: '0 * 1,2 * *'") !== -1);
        assert.ok(schedule.indexOf('placeholder: true') === -1);
    });

    if (failed) {
        console.error(failed + ' failed, ' + passed + ' passed');
        process.exit(1);
    }
    console.log(passed + ' passed');
}

main().catch(function (err) {
    console.error(err && err.stack || err);
    process.exit(1);
});
