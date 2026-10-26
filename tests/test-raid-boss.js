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
            delete: async function () {
                docs.delete(keyOf(parts));
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
                                if (filter.op === '<=') return lms <= rms;
                                if (filter.op === '>') return lms > rms;
                                if (filter.op === '>=') return lms >= rms;
                                if (filter.op === '==') return left === filter.value;
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

    await test('schedule floors and fallbacks stop a solo and stay inside the ceiling', function () {
        assert.strictEqual(engine.SCHEDULE.length, 12);
        const expect = {
            'Chat-Charger': { goal: 335, floor: 250, ceiling: 500, cap: 10 },
            'Cipher-Cracker': { goal: 54, floor: 20, ceiling: 80, cap: 2 },
            'Favor-Fiend': { goal: 1080, floor: 600, ceiling: 2000, cap: 15 },
            'Forum-Forge': { goal: 25, floor: 25, ceiling: 80, cap: 2 },
            'Hello-Herald': { goal: 162, floor: 61, ceiling: 300, cap: 1 },
            'Trifecta-Titan': { goal: 61, floor: 61, ceiling: 120, cap: 1 },
            'Trivia-Tactician': { goal: 176, floor: 80, ceiling: 400, cap: 1 },
            'Scholar-Slayer': { goal: 5, floor: 5, ceiling: 16, cap: 1 },
            'Quiz-Crusader': { goal: 122, floor: 100, ceiling: 250, cap: 3 },
            'Poll-Patroller': { goal: 189, floor: 80, ceiling: 400, cap: 1 },
            'Watch-Warden': { goal: 135, floor: 70, ceiling: 300, cap: 1 },
            'Referral-Ranger': { goal: 31, floor: 31, ceiling: 60, cap: 1 },
        };
        engine.SCHEDULE.forEach(function (entry) {
            const row = expect[entry.name];
            assert.ok(row, entry.name);
            assert.strictEqual(entry.goal, row.goal, entry.name);
            assert.strictEqual(entry.goalFloor, row.floor, entry.name);
            assert.strictEqual(entry.goalCeiling, row.ceiling, entry.name);
            assert.strictEqual(entry.dailyCap, row.cap, entry.name);
            assert.ok(entry.goal >= entry.goalFloor && entry.goal <= entry.goalCeiling, entry.name);
            assert.ok(engine.isServerOnlyMetric(entry.metric), entry.metric);
        });
        assert.strictEqual(engine.SCHEDULE[0].goal, 335);
        assert.notStrictEqual(engine.SCHEDULE[0].goal, engine.goalFromTypical(230));
        assert.strictEqual(engine.clampGoal(0, engine.SCHEDULE[0]), 250);
        assert.strictEqual(engine.clampGoal(248, engine.SCHEDULE[0]), 335);
        assert.strictEqual(engine.clampGoal(1000, engine.SCHEDULE[0]), 500);
        assert.ok(engine.SCHEDULE.map(function (entry) { return entry.name; }).indexOf('TV-Titan') === -1);
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
        assert.ok(won.toLowerCase().indexOf(engine.GIVEAWAY_LINE.toLowerCase()) !== -1);
        assert.ok(won.indexOf('**') === -1);
        assert.strictEqual(down.indexOf('21,000'), -1);
        assert.strictEqual(up.indexOf('21,000'), -1);
        assert.strictEqual(week.indexOf('21,000'), -1);
        assert.strictEqual(won.indexOf('21,000'), -1);
        assert.strictEqual(down.indexOf('sats'), -1);
        assert.strictEqual(week.indexOf('sats'), -1);
        assert.strictEqual(won.indexOf('sats'), -1);
        assert.strictEqual(engine.REWARD_LINE.indexOf('sats'), -1);
        const quests = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
        const raidUi = quests.slice(quests.indexOf('function _raidVictoryBanner'), quests.indexOf('function _raidDmgRateHtml'));
        assert.strictEqual(raidUi.indexOf('21,000'), -1);
        assert.ok(raidUi.indexOf('an extra Orange Ticket giveaway winner will be announced by the end of the week') !== -1);
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
        assert.strictEqual(boss.goal, 335);
        assert.strictEqual(boss.goalSource, 'fallback');
        assert.strictEqual(boss.goalCount, null);
        assert.strictEqual(boss.goalFormula, 'raid-goal-v1');
        assert.strictEqual(boss.goalFloor, 250);
        assert.strictEqual(boss.goalCeiling, 500);
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
        assert.ok(schedule.indexOf("schedule: '15 * * * *'") !== -1);
        assert.ok(schedule.indexOf('sweepForumDamage') !== -1);
        assert.ok(schedule.indexOf('placeholder: true') === -1);
        assert.ok(index.indexOf('queueForumDamage') !== -1);
        assert.ok(index.indexOf('scheduleRaidForumCredit') !== -1);
        const engineSrc = fs.readFileSync(path.join(root, 'functions/src/raidBossEngine.js'), 'utf8');
        assert.strictEqual(engineSrc.indexOf('21,000'), -1);
    });

    function withCounts(db, table) {
        const orig = db.collection.bind(db);
        function wrapQuery(q, key) {
            q.count = function () {
                return { get: async function () {
                    if (!Object.prototype.hasOwnProperty.call(table, key)) throw new Error('no count');
                    return { data: function () { return { count: table[key] }; } };
                } };
            };
            const next = q.where ? q.where.bind(q) : null;
            q.where = function () {
                return wrapQuery(next ? next.apply(q, arguments) : q, key);
            };
            return q;
        }
        db.collection = function (name) {
            const col = orig(name);
            const origWhere = col.where.bind(col);
            const origDoc = col.doc.bind(col);
            col.where = function () { return wrapQuery(origWhere.apply(col, arguments), name); };
            col.doc = function (id) {
                const child = origDoc(id);
                const nested = child.collection.bind(child);
                child.collection = function (sub) {
                    const subCol = nested(sub);
                    const subWhere = subCol.where.bind(subCol);
                    subCol.where = function () { return wrapQuery(subWhere.apply(subCol, arguments), name + '/' + sub); };
                    return subCol;
                };
                return child;
            };
            return col;
        };
        db.collectionGroup = function () {
            return { where: function () { throw new Error('group'); } };
        };
        return db;
    }

    await test('a counted goal is clamped and the Phil DM names it', async function () {
        const db = withCounts(memoryDb(), { global_chat: 248 });
        const admin = adminFor();
        const sent = [];
        const result = await engine.spawnOrAlert(db, admin, new Date('2026-11-01T18:00:00.000Z'), {
            chatId: '4242',
            token: 'test-token',
            send: async function (chatId, text) {
                sent.push({ chatId: chatId, text: text });
                return true;
            },
        });
        assert.strictEqual(result.created, true);
        assert.strictEqual(result.goal, 335);
        assert.strictEqual(result.goalSource, 'count');
        const boss = (await db.collection('raid_bosses').doc('2026-11').get()).data();
        assert.strictEqual(boss.goalCount, 248);
        assert.strictEqual(boss.communityTarget, 335);
        assert.strictEqual(boss.damageScale, engine.damageScaleForGoal(335));
        assert.strictEqual(boss.goalFormula, 'raid-goal-v1');
        assert.ok(boss.goalApproximate.indexOf('cap of 10') !== -1);
        assert.strictEqual(sent.length, 1);
        assert.strictEqual(sent[0].chatId, '4242');
        assert.ok(sent[0].text.indexOf('Goal 335') !== -1);
        assert.ok(sent[0].text.indexOf('count 248') !== -1);
        assert.ok(sent[0].text.indexOf('raid-goal-v1') !== -1);
        assert.strictEqual(sent[0].text.indexOf('@'), -1);
        const chats = await db.collection('global_chat').get();
        chats.forEach(function (doc) {
            assert.ok(doc.data().text.indexOf('Goal 335') === -1);
        });
        const again = await engine.spawnOrAlert(db, admin, new Date('2026-11-01T19:00:00.000Z'), {
            chatId: '4242',
            token: 'test-token',
            send: async function () { sent.push({ chatId: 'again' }); return true; },
        });
        assert.strictEqual(again.skipped, 'exists');
        assert.strictEqual(sent.length, 1);

        const quiet = withCounts(memoryDb(), { global_chat: 0 });
        const low = await engine.runScheduledSpawn(quiet, admin, new Date('2026-11-01T18:00:00.000Z'));
        assert.strictEqual(low.goal, 250);
        assert.strictEqual(low.goalSource, 'count');

        const publicDb = withCounts(memoryDb(), { global_chat: 248 });
        let publicSent = false;
        const made = await engine.spawnOrAlert(publicDb, admin, new Date('2026-11-01T18:00:00.000Z'), {
            chatId: '-1003827558565',
            token: 'test-token',
            send: async function () { publicSent = true; return true; },
        });
        assert.strictEqual(made.created, true);
        assert.strictEqual(publicSent, false);
    });

    function legitBody(stem) {
        const name = stem || 'bitcoinword';
        const words = [];
        for (let i = 0; i < 30; i++) words.push(name + i);
        while (words.join(' ').length < 320 || words.length < 45) words.push(name + (words.length % 30));
        return words.join(' ');
    }

    await test('forum damage waits 24 hours and rejects spam, padding, and duplicates', async function () {
        const db = memoryDb();
        const admin = adminFor();
        await engine.runScheduledSpawn(db, admin, new Date('2027-02-01T18:00:00.000Z'));
        const boss = (await db.collection('raid_bosses').doc('2027-02').get()).data();
        assert.strictEqual(boss.name, 'Forum-Forge');
        assert.strictEqual(boss.goal, 25);
        assert.strictEqual(boss.dailyCap, 2);
        const now = new Date('2027-02-10T18:00:00.000Z');
        const born = ts(new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000));
        await db.collection('users').doc('ada').set({ username: 'ada', created: born, anonymous: false });
        const body = legitBody('bitcoinword');
        const other = legitBody('satoshiword');
        const third = legitBody('hiddenword');
        const spam = await engine.queueForumDamage(db, admin, {
            kind: 'forum', sourceId: 'spam1', uid: 'ada', now: now,
            data: { title: 'Hi', body: 'too short to count', authorId: 'ada' },
        });
        assert.strictEqual(spam.queued, false);
        assert.strictEqual(spam.reason, 'quality');
        assert.strictEqual((await db.collection('raid_forum_pending').doc('forum-spam1').get()).exists, false);
        const padding = await engine.queueForumDamage(db, admin, {
            kind: 'forum', sourceId: 'pad1', uid: 'ada', now: now,
            data: { title: 'Pad', body: 'word '.repeat(80), authorId: 'ada' },
        });
        assert.strictEqual(padding.reason, 'quality');
        assert.strictEqual((await db.collection('raid_forum_pending').doc('forum-pad1').get()).exists, false);

        await db.collection('forum_posts').doc('legit1').set({
            title: 'A real note', body: body, authorId: 'ada', createdAt: ts(now),
        });
        const queued = await engine.queueForumDamage(db, admin, {
            kind: 'forum', sourceId: 'legit1', uid: 'ada', now: now,
            data: { title: 'A real note', body: body, authorId: 'ada' },
        });
        assert.strictEqual(queued.queued, true);
        const pending = await db.collection('raid_forum_pending').doc('forum-legit1').get();
        assert.strictEqual(pending.exists, true);
        const early = await engine.sweepForumDamage(db, admin, new Date(now.getTime() + 60 * 60 * 1000));
        assert.strictEqual(early.credited, 0);
        const dup = await engine.queueForumDamage(db, admin, {
            kind: 'forum', sourceId: 'dup1', uid: 'ada', now: now,
            data: { title: 'A real note', body: body, authorId: 'ada' },
        });
        assert.strictEqual(dup.reason, 'duplicate');
        assert.strictEqual((await db.collection('raid_forum_pending').doc('forum-dup1').get()).exists, false);

        await db.collection('forum_posts').doc('gone1').set({
            title: 'Another note', body: other, authorId: 'ada', createdAt: ts(now),
        });
        const gone = await engine.queueForumDamage(db, admin, {
            kind: 'forum', sourceId: 'gone1', uid: 'ada', now: now,
            data: { title: 'Another note', body: other, authorId: 'ada' },
        });
        assert.strictEqual(gone.queued, true);
        await db.collection('forum_posts').doc('gone1').delete();
        const sweptGone = await engine.sweepForumDamage(db, admin, new Date(now.getTime() + 25 * 60 * 60 * 1000));
        assert.strictEqual(sweptGone.credited, 1);
        assert.ok(sweptGone.skipped >= 1);
        const hit = await db.collection('raid_bosses').doc('2027-02').collection('participants').doc('ada').get();
        assert.strictEqual(hit.exists, true);
        const again = await engine.sweepForumDamage(db, admin, new Date(now.getTime() + 26 * 60 * 60 * 1000));
        assert.strictEqual(again.credited, 0);
        const after = await db.collection('raid_bosses').doc('2027-02').collection('participants').doc('ada').get();
        assert.strictEqual(after.data().contributed, hit.data().contributed);

        await db.collection('forum_posts').doc('hide1').set({
            title: 'Hidden later', body: third, authorId: 'ada', createdAt: ts(now),
        });
        const hidden = await engine.queueForumDamage(db, admin, {
            kind: 'forum', sourceId: 'hide1', uid: 'ada', now: new Date(now.getTime() + 60 * 1000),
            data: { title: 'Hidden later', body: third, authorId: 'ada' },
        });
        assert.strictEqual(hidden.queued, true);
        await db.collection('forum_posts').doc('hide1').set({
            title: 'Hidden later', body: third, authorId: 'ada', hidden: true, createdAt: ts(now),
        });
        const before = after.data().contributed;
        const sweptHidden = await engine.sweepForumDamage(db, admin, new Date(now.getTime() + 30 * 60 * 60 * 1000));
        assert.strictEqual(sweptHidden.credited, 0);
        const still = await db.collection('raid_bosses').doc('2027-02').collection('participants').doc('ada').get();
        assert.strictEqual(still.data().contributed, before);
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
