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
                docs.set(keyOf(parts), applyFields(prev, data, !!(opts && opts.merge)));
            },
            update: async function (data) {
                order.push(keyOf(parts));
                const prev = docs.get(keyOf(parts));
                if (!prev) throw new Error('missing ' + keyOf(parts));
                docs.set(keyOf(parts), applyFields(prev, data, true));
            },
            delete: async function () {
                docs.delete(keyOf(parts));
            },
            collection: function (name) { return col(parts.concat(name)); },
        };
    }
    function applyFields(prev, data, merge) {
        const base = merge ? Object.assign({}, prev) : {};
        Object.keys(data || {}).forEach(function (key) {
            const val = data[key];
            if (val && typeof val === 'object' && Object.prototype.hasOwnProperty.call(val, '_inc')) {
                base[key] = Math.round(((Number(merge ? prev[key] : 0) || 0) + Number(val._inc)) * 1000) / 1000;
            } else {
                base[key] = val;
            }
        });
        return base;
    }
    function sortedRows(list, field, dir) {
        const name = field || 'startTime';
        const desc = !field || dir === 'desc';
        list.sort(function (a, b) {
            const av = a.data()[name];
            const bv = b.data()[name];
            const am = av && av.toDate ? av.toDate().getTime() : (Number(av) || 0);
            const bm = bv && bv.toDate ? bv.toDate().getTime() : (Number(bv) || 0);
            return desc ? bm - am : am - bm;
        });
        return list;
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
            orderBy: function (field, dir) {
                const query = {
                    _order: field,
                    _dir: dir || 'asc',
                    orderBy: function (next, nextDir) { query._order = next; query._dir = nextDir || 'asc'; return query; },
                    limit: function (n) { query._limit = n; return query; },
                    get: async function () {
                        let list = sortedRows(rows(parts), query._order, query._dir);
                        if (query._limit) list = list.slice(0, query._limit);
                        return { empty: list.length === 0, docs: list, size: list.length, forEach: function (fn) { list.forEach(fn); } };
                    },
                };
                return query;
            },
            where: function (field, op, value) {
                const filters = [{ field: field, op: op, value: value }];
                const query = {
                    orderBy: function (orderField, dir) { query._order = orderField; query._dir = dir || 'asc'; return query; },
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
                        sortedRows(list, query._order, query._dir);
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
        const forum = engine.bossForMonth('2027-02');
        assert.ok(forum.description.indexOf('substantial, original') !== -1);
        assert.strictEqual(forum.description.indexOf('300'), -1);
        assert.strictEqual(forum.description.indexOf('40 words'), -1);
        assert.strictEqual(engine.bossForMonth('2026-12').image, '');
        const quests = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
        assert.strictEqual(quests.indexOf('cipher-cracker.png'), -1);
        assert.strictEqual(quests.indexOf('300 characters'), -1);
        const schedule = fs.readFileSync(path.join(root, 'functions/src/scheduleRaidBoss.js'), 'utf8');
        assert.strictEqual(schedule.indexOf('invoker'), -1);
        assert.strictEqual(fs.readFileSync(path.join(root, 'functions/src/raidBossEngine.js'), 'utf8').indexOf('cipher-cracker.png'), -1);
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
        assert.strictEqual(boss.goalApproximate, undefined);
        assert.strictEqual(boss.goalFormula, undefined);
        const meta = (await db.collection('raid_boss_meta').doc('2026-11').get()).data();
        assert.strictEqual(meta.goal, 335);
        assert.strictEqual(meta.goalSource, 'fallback');
        assert.strictEqual(meta.goalCount, null);
        assert.strictEqual(meta.goalFormula, 'raid-goal-v1');
        assert.strictEqual(meta.goalFloor, 250);
        assert.strictEqual(meta.goalCeiling, 500);
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
        assert.strictEqual(winner.data().satsAwarded, undefined);
        assert.strictEqual(Object.prototype.hasOwnProperty.call(winner.data(), 'satsAwarded'), false);
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
        const weekly = index.slice(index.indexOf('exports.raidBossWeeklyAnnouncement'), index.indexOf('exports.raidBossWeeklyAnnouncement') + 280);
        assert.strictEqual(weekly.indexOf('invoker'), -1);
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
        const meta = (await db.collection('raid_boss_meta').doc('2026-11').get()).data();
        assert.strictEqual(boss.goalCount, undefined);
        assert.strictEqual(boss.communityTarget, 335);
        assert.strictEqual(boss.damageScale, engine.damageScaleForGoal(335));
        assert.strictEqual(meta.goalCount, 248);
        assert.strictEqual(meta.goalFormula, 'raid-goal-v1');
        assert.ok(meta.goalApproximate.indexOf('cap of 10') !== -1);
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
        assert.strictEqual(boss.communityTarget, 25);
        assert.strictEqual(boss.goalApproximate, undefined);
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

    await test('two players get credit for the same day key', async function () {
        const db = memoryDb();
        const admin = adminFor();
        const start = engine.zonedTimeToUtc(2027, 5, 1, 13, 0, 0);
        const end = engine.zonedTimeToUtc(2027, 6, 1, 13, 0, 0);
        await db.collection('raid_bosses').doc('2027-05').set({
            name: 'Trivia-Tactician',
            metric: 'triviaCorrect',
            sources: ['triviaCorrect'],
            target: 1000,
            damageScale: engine.damageScaleForGoal(176),
            dailyCap: 1,
            current: 0,
            defeated: false,
            placeholder: false,
            startTime: ts(start),
            endTime: ts(end),
        });
        await db.collection('users').doc('ada').set({ username: 'ada' });
        await db.collection('users').doc('bob').set({ username: 'bob' });
        const now = new Date('2027-05-15T18:00:00.000Z');
        const ada = await engine.creditTrusted(db, admin, {
            metric: 'triviaCorrect', uid: 'ada', dedupeKey: 'trivia-2027-05-15', amount: 1,
            grantTickets: null, badges: false, now: now,
        });
        const bob = await engine.creditTrusted(db, admin, {
            metric: 'triviaCorrect', uid: 'bob', dedupeKey: 'trivia-2027-05-15', amount: 1,
            grantTickets: null, badges: false, now: now,
        });
        assert.strictEqual(ada.status, 'ok');
        assert.strictEqual(bob.status, 'ok');
        assert.strictEqual((await db.collection('raid_damage_events').doc('2027-05_ada_trivia-2027-05-15').get()).exists, true);
        assert.strictEqual((await db.collection('raid_damage_events').doc('2027-05_bob_trivia-2027-05-15').get()).exists, true);
        const again = await engine.creditTrusted(db, admin, {
            metric: 'triviaCorrect', uid: 'ada', dedupeKey: 'trivia-2027-05-15', amount: 1,
            grantTickets: null, badges: false, now: now,
        });
        assert.strictEqual(again.status, 'dup');
    });

    await test('boss HP does not move backwards', async function () {
        const db = memoryDb();
        const admin = adminFor();
        await engine.runScheduledSpawn(db, admin, new Date('2026-11-01T18:00:00.000Z'));
        await db.collection('raid_bosses').doc('2026-11').update({ current: 40 });
        await db.collection('users').doc('ada').set({ username: 'ada' });
        const hit = await engine.creditTrusted(db, admin, {
            metric: 'chatMessages', uid: 'ada', dedupeKey: 'chat-one', amount: 1, text: '12345678',
            grantTickets: null, badges: false, now: new Date('2026-11-15T18:00:00.000Z'),
        });
        assert.strictEqual(hit.status, 'ok');
        const boss = (await db.collection('raid_bosses').doc('2026-11').get()).data();
        assert.ok(boss.current >= 40);
        assert.ok(boss.current > 40);
    });

    await test('October legacy boss still takes damage until November spawns', async function () {
        const db = memoryDb();
        const admin = adminFor();
        const start = engine.zonedTimeToUtc(2026, 10, 1, 13, 0, 0);
        const end = engine.zonedTimeToUtc(2026, 11, 1, 13, 0, 0);
        await db.collection('raid_bosses').doc('legacyOctober').set({
            name: 'Poll-Patroller',
            metric: 'pollVotes',
            sources: ['pollVotes'],
            target: 1000,
            damageScale: 1,
            current: 10,
            defeated: false,
            placeholder: false,
            startTime: ts(start),
            endTime: ts(end),
        });
        await db.collection('users').doc('ada').set({ username: 'ada' });
        const hit = await engine.creditTrusted(db, admin, {
            metric: 'pollVotes', uid: 'ada', dedupeKey: 'poll-ada-day', amount: 1,
            grantTickets: null, badges: false, now: new Date('2026-10-20T16:00:00.000Z'),
        });
        assert.strictEqual(hit.status, 'ok');
        const part = await db.collection('raid_bosses').doc('legacyOctober').collection('participants').doc('ada').get();
        assert.strictEqual(part.exists, true);
        const second = await engine.creditTrusted(db, admin, {
            metric: 'pollVotes', uid: 'ada', dedupeKey: 'poll-ada-day-2', amount: 1,
            grantTickets: null, badges: false, now: new Date('2026-10-20T16:00:00.000Z'),
        });
        assert.strictEqual(second.status, 'cap');
        assert.strictEqual(engine.dailyCapFor({ name: 'Poll-Patroller', metric: 'pollVotes' }), 1);
        assert.strictEqual(engine.dailyCapFor({ name: 'No-Such-Boss', metric: 'watchMinutes' }), 1);
    });

    await test('a live boss with no dailyCap falls back to 1 when it is not in the schedule', async function () {
        const db = memoryDb();
        const admin = adminFor();
        const start = engine.zonedTimeToUtc(2026, 10, 1, 13, 0, 0);
        const end = engine.zonedTimeToUtc(2026, 11, 1, 13, 0, 0);
        await db.collection('raid_bosses').doc('legacyUnknown').set({
            name: 'Old-Boss',
            metric: 'watchMinutes',
            sources: ['watchMinutes'],
            target: 1000,
            damageScale: 1,
            current: 0,
            defeated: false,
            placeholder: false,
            startTime: ts(start),
            endTime: ts(end),
        });
        await db.collection('users').doc('ada').set({ username: 'ada' });
        const now = new Date('2026-10-20T16:00:00.000Z');
        const hit = await engine.creditTrusted(db, admin, {
            metric: 'watchMinutes', uid: 'ada', dedupeKey: 'watch-1', amount: 1,
            grantTickets: null, badges: false, now: now,
        });
        const second = await engine.creditTrusted(db, admin, {
            metric: 'watchMinutes', uid: 'ada', dedupeKey: 'watch-2', amount: 1,
            grantTickets: null, badges: false, now: now,
        });
        assert.strictEqual(hit.status, 'ok');
        assert.strictEqual(second.status, 'cap');
    });

    await test('forum damage is not queued outside Forum-Forge and old pending docs settle', async function () {
        const db = memoryDb();
        const admin = adminFor();
        await engine.runScheduledSpawn(db, admin, new Date('2026-11-01T18:00:00.000Z'));
        const now = new Date('2026-11-10T18:00:00.000Z');
        await db.collection('users').doc('ada').set({
            username: 'ada',
            anonymous: false,
            created: ts(new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)),
        });
        const words = [];
        for (let i = 0; i < 30; i++) words.push('novemberword' + i);
        while (words.join(' ').length < 320 || words.length < 45) words.push('novemberword' + (words.length % 30));
        const body = words.join(' ');
        const queued = await engine.queueForumDamage(db, admin, {
            kind: 'forum', sourceId: 'nov1', uid: 'ada', now: now,
            data: { title: 'Later', body: body, authorId: 'ada' },
        });
        assert.strictEqual(queued.reason, 'metric');
        assert.strictEqual((await db.collection('raid_forum_pending').doc('forum-nov1').get()).exists, false);
        await db.collection('forum_posts').doc('old1').set({
            title: 'Later', body: body, authorId: 'ada', createdAt: ts(now),
        });
        await db.collection('raid_forum_pending').doc('forum-old1').set({
            status: 'pending',
            kind: 'forum',
            sourceId: 'old1',
            uid: 'ada',
            metric: 'forumPosts',
            readyAt: ts(new Date(now.getTime() - 60 * 60 * 1000)),
        });
        const swept = await engine.sweepForumDamage(db, admin, now);
        assert.strictEqual(swept.credited, 0);
        assert.ok(swept.skipped >= 1);
        const pending = (await db.collection('raid_forum_pending').doc('forum-old1').get()).data();
        assert.strictEqual(pending.status, 'skipped');
        const again = await engine.sweepForumDamage(db, admin, new Date('2027-02-10T18:00:00.000Z'));
        assert.strictEqual(again.credited, 0);
    });

    await test('Phil DM logs a missing chat id and does not send', async function () {
        const prevId = process.env.PHIL_TELEGRAM_CHAT_ID;
        const prevToken = process.env.TG_BOT_TOKEN;
        delete process.env.PHIL_TELEGRAM_CHAT_ID;
        delete process.env.TG_BOT_TOKEN;
        let sent = false;
        const ok = await engine.sendPhilDm('Raid boss spawned', {
            send: async function () { sent = true; return true; },
        });
        if (prevId == null) delete process.env.PHIL_TELEGRAM_CHAT_ID;
        else process.env.PHIL_TELEGRAM_CHAT_ID = prevId;
        if (prevToken == null) delete process.env.TG_BOT_TOKEN;
        else process.env.TG_BOT_TOKEN = prevToken;
        assert.strictEqual(ok, false);
        assert.strictEqual(sent, false);
    });

    function sentenceCount(text) {
        return String(text || '').split(/[.!?]+/).map(function (part) { return part.trim(); }).filter(Boolean).length;
    }

    await test('history recap is a deterministic template and hides uid and email', function () {
        const history = require('../functions/src/raidHistory');
        const start = engine.zonedTimeToUtc(2026, 10, 1, 13, 0, 0);
        const end = engine.zonedTimeToUtc(2026, 11, 1, 13, 0, 0);
        const base = {
            name: 'Poll-Patroller',
            emoji: '🗳️',
            metric: 'pollVotes',
            communityTarget: 500,
            target: 1000,
            current: 1000,
            damageScale: 2,
            defeated: true,
            startTime: ts(start),
            endTime: ts(end),
            image: 'javascript:alert(1)',
        };
        const people = [
            { id: 'uid-secret-abc', username: 'Banned', contributed: 400, email: 'banned@example.com', banned: true },
            { id: 'secret-two', username: 'Divine', contributed: 600, email: 'divine@example.com', lastUpdate: ts(new Date(start.getTime() + 9 * 86400000)) },
            { id: 'secret-three', username: 'sneaky@mail.test', contributed: 10 },
            { id: 'secret-four', username: 'Pip', contributed: 5 },
        ];
        const doc = history.buildHistoryDoc('2026-10', base, people, [], end.getTime());
        assert.strictEqual(doc.monthLabel, 'October 2026');
        assert.strictEqual(doc.goalText, 'Cast 500 poll votes in the Quest Hub');
        assert.strictEqual(doc.result, 'defeated');
        assert.strictEqual(doc.prizeWon, true);
        assert.strictEqual(doc.prizeWinner, '');
        assert.strictEqual(doc.image, history.IMAGE_BY_NAME['Poll-Patroller']);
        assert.strictEqual(doc.playerCount, 4);
        assert.deepStrictEqual(doc.topDealers.map(function (row) { return row.username; }), ['Divine', 'Banned', 'Raider']);
        assert.ok(doc.recap.indexOf('Divine') !== -1);
        assert.ok(doc.recap.indexOf('cast 500 votes') !== -1);
        const sentences = sentenceCount(doc.recap);
        assert.ok(sentences >= 2 && sentences <= 3, doc.recap);
        const again = history.buildHistoryDoc('2026-10', base, people, [], end.getTime());
        assert.strictEqual(again.recap, doc.recap);
        const packed = JSON.stringify(doc);
        assert.strictEqual(packed.indexOf('uid-secret-abc'), -1);
        assert.strictEqual(packed.indexOf('secret-two'), -1);
        assert.strictEqual(packed.indexOf('banned@example.com'), -1);
        assert.strictEqual(packed.indexOf('sneaky@mail.test'), -1);
        assert.strictEqual(packed.indexOf('javascript:'), -1);
        assert.strictEqual(Object.prototype.hasOwnProperty.call(doc, 'uid'), false);
        assert.strictEqual(Object.prototype.hasOwnProperty.call(doc, 'email'), false);
        const indexes = {};
        for (let n = 0; n < 80; n++) indexes[history.templateIndex('boss-' + n)] = true;
        assert.ok(Object.keys(indexes).length > 1);
        const survived = history.buildHistoryDoc('2026-09', Object.assign({}, base, {
            name: 'Chat-Charger',
            metric: 'chatMessages',
            defeated: false,
            current: 250,
            image: '',
        }), people.slice(0, 1), [{ username: 'Divine', uid: 'nope', email: 'nope@example.com' }], end.getTime());
        assert.strictEqual(survived.result, 'survived');
        assert.strictEqual(survived.prizeWon, false);
        assert.strictEqual(survived.prizeWinner, '');
        assert.strictEqual(survived.image, history.IMAGE_BY_NAME['Chat-Charger']);
        assert.ok(sentenceCount(survived.recap) >= 2 && sentenceCount(survived.recap) <= 3);
        assert.strictEqual(JSON.stringify(survived).indexOf('nope@example.com'), -1);
        assert.strictEqual(history.publicName('a&#39;b'), '');
        assert.strictEqual(history.publicName('a&quot;b'), '');
        assert.strictEqual(history.publicName('Ada_1.b-c'), 'Ada_1.b-c');
        const xss = history.buildHistoryDoc('xss-boss', base, [
            { username: 'a&#39;b', contributed: 9 },
            { username: 'a&quot;b', contributed: 8 },
        ], end.getTime());
        assert.deepStrictEqual(xss.topDealers.map(function (row) { return row.username; }), ['Raider', 'Raider']);
        assert.strictEqual(JSON.stringify(xss).indexOf('&#39;'), -1);
        assert.strictEqual(JSON.stringify(xss).indexOf('&quot;'), -1);
        assert.strictEqual(xss.prizeWinner, '');
        const vm = require('vm');
        const questsSrc = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
        const linkSrc = questsSrc.slice(questsSrc.indexOf('function _raidEsc'), questsSrc.indexOf('function _raidHistoryDate'));
        const sandbox = {};
        vm.runInNewContext(linkSrc + '\nthis.link = _raidUserLink;', sandbox);
        const brokenQuote = sandbox.link('a&#39;b');
        const brokenQuot = sandbox.link('a&quot;b');
        assert.strictEqual(brokenQuote.indexOf('onclick'), -1);
        assert.strictEqual(brokenQuote.indexOf('data-u'), -1);
        assert.ok(brokenQuote.indexOf('&amp;#39;') !== -1);
        assert.strictEqual(brokenQuot.indexOf('onclick'), -1);
        assert.ok(brokenQuot.indexOf('&amp;quot;') !== -1);
        const safeLink = sandbox.link('Ada_1');
        assert.ok(safeLink.indexOf('data-u="Ada_1"') !== -1);
        assert.strictEqual(safeLink.indexOf('onclick'), -1);
        assert.ok(questsSrc.indexOf("addEventListener('click'") !== -1);
        assert.ok(questsSrc.indexOf("getAttribute('data-u')") !== -1);
    });

    await test('defeat writes history once, and a later winner fills only the username', async function () {
        const db = memoryDb();
        const admin = adminFor();
        const start = engine.zonedTimeToUtc(2026, 10, 1, 13, 0, 0);
        const end = engine.zonedTimeToUtc(2026, 11, 1, 13, 0, 0);
        const ref = db.collection('raid_bosses').doc('2026-10');
        await ref.set({
            name: 'Poll-Patroller',
            metric: 'pollVotes',
            communityTarget: 500,
            target: 1000,
            current: 1000,
            damageScale: 2,
            defeated: true,
            placeholder: false,
            startTime: ts(start),
            endTime: ts(end),
            image: 'https://assets.bitcoineducation.quest/images/raid-bosses/poll-patroller.png',
        });
        await ref.collection('participants').doc('uid-secret-abc').set({
            username: 'Banned',
            contributed: 400,
            email: 'banned@example.com',
            banned: true,
        });
        await ref.collection('participants').doc('secret-two').set({
            username: 'Divine',
            contributed: 600,
            lastUpdate: ts(new Date(start.getTime() + 9 * 86400000)),
        });
        const open = await engine.recordBossHistory(db, admin, db.collection('raid_bosses').doc('still-open'), 'still-open', { now: end });
        assert.strictEqual(open.reason, 'missing');
        const live = db.collection('raid_bosses').doc('2026-12');
        await live.set({
            name: 'Cipher-Cracker',
            metric: 'cipherPeerKey',
            target: 1000,
            current: 10,
            defeated: false,
            placeholder: false,
            startTime: ts(end),
            endTime: ts(engine.zonedTimeToUtc(2027, 1, 1, 13, 0, 0)),
        });
        const active = await engine.recordBossHistory(db, admin, live, '2026-12', { now: end });
        assert.strictEqual(active.reason, 'active');
        const first = await engine.recordBossHistory(db, admin, ref, '2026-10', { now: end });
        assert.strictEqual(first.wrote, true);
        const saved = (await db.collection('raid_history').doc('2026-10').get()).data();
        assert.strictEqual(saved.prizeWinner, '');
        assert.strictEqual(saved.result, 'defeated');
        assert.strictEqual(saved.monthLabel, 'October 2026');
        assert.ok(saved.image.indexOf('https://') === 0);
        assert.strictEqual(saved.topDealers[0].username, 'Divine');
        assert.strictEqual(saved.topDealers[1].username, 'Banned');
        const packed = JSON.stringify(saved);
        assert.strictEqual(packed.indexOf('uid-secret-abc'), -1);
        assert.strictEqual(packed.indexOf('banned@example.com'), -1);
        const second = await engine.recordBossHistory(db, admin, ref, '2026-10', { now: end });
        assert.strictEqual(second.wrote, false);
        await ref.update({ current: 1 });
        assert.strictEqual((await db.collection('raid_history').doc('2026-10').get()).data().current, saved.current);
        await ref.collection('winners').doc('winner-uid').set({
            uid: 'winner-uid',
            username: 'Divine',
            email: 'divine@example.com',
            drawnAt: ts(end),
        });
        await db.collection('stats').doc('raffle_2026-10_snapshot').set({
            winner: 'Nia',
            winnerUid: 'raffle-uid-secret',
            email: 'nia@example.com',
        });
        const sync = await engine.syncPrizeWinner(db, admin, '2026-10');
        assert.strictEqual(sync.updated, true);
        const withWinner = (await db.collection('raid_history').doc('2026-10').get()).data();
        assert.strictEqual(withWinner.prizeWinner, 'Nia');
        assert.strictEqual(withWinner.recap, saved.recap);
        assert.strictEqual(withWinner.current, saved.current);
        const winnerPacked = JSON.stringify(withWinner);
        assert.strictEqual(winnerPacked.indexOf('winner-uid'), -1);
        assert.strictEqual(winnerPacked.indexOf('divine@example.com'), -1);
        assert.strictEqual(winnerPacked.indexOf('raffle-uid-secret'), -1);
        assert.strictEqual(winnerPacked.indexOf('nia@example.com'), -1);
        await db.collection('stats').doc('raffle_2026-10_snapshot').set({ winner: 'a&#39;b', winnerUid: 'raffle-uid-secret' });
        const dirty = await engine.syncPrizeWinner(db, admin, '2026-10');
        assert.strictEqual(dirty.updated, false);
        assert.strictEqual((await db.collection('raid_history').doc('2026-10').get()).data().prizeWinner, 'Nia');
        const again = await engine.syncPrizeWinner(db, admin, '2026-10');
        assert.strictEqual(again.updated, false);

        const survivedRef = db.collection('raid_bosses').doc('2026-09');
        await survivedRef.set({
            name: 'Chat-Charger',
            metric: 'chatMessages',
            communityTarget: 335,
            target: 1000,
            current: 250,
            defeated: false,
            placeholder: false,
            startTime: ts(engine.zonedTimeToUtc(2026, 9, 1, 13, 0, 0)),
            endTime: ts(start),
        });
        await survivedRef.collection('participants').doc('uid-secret-abc').set({ username: 'Banned', contributed: 250, email: 'banned@example.com' });
        const closed = await engine.closeEndedBosses(db, admin, end);
        assert.ok(closed.wrote >= 1);
        const stood = (await db.collection('raid_history').doc('2026-09').get()).data();
        assert.strictEqual(stood.result, 'survived');
        assert.strictEqual(stood.prizeWon, false);
        assert.strictEqual(stood.prizeWinner, '');
        assert.strictEqual(stood.monthLabel, 'September 2026');
        await survivedRef.collection('winners').doc('winner-uid').set({ username: 'Divine', uid: 'winner-uid', drawnAt: ts(end) });
        const noFill = await engine.syncPrizeWinner(db, admin, '2026-09');
        assert.strictEqual(noFill.updated, false);
        assert.strictEqual((await db.collection('raid_history').doc('2026-09').get()).data().prizeWinner, '');

        const plan = await engine.backfillRaidHistory(db, admin, end, { apply: false });
        assert.strictEqual(plan.wouldCreate, 0);
        assert.strictEqual(plan.created, 0);
        const fresh = memoryDb();
        const freshRef = fresh.collection('raid_bosses').doc('2026-08');
        await freshRef.set({
            name: 'Quiz-Crusader',
            metric: 'quizCompletions',
            communityTarget: 100,
            target: 1000,
            current: 1000,
            defeated: true,
            placeholder: false,
            startTime: ts(engine.zonedTimeToUtc(2026, 8, 1, 13, 0, 0)),
            endTime: ts(engine.zonedTimeToUtc(2026, 9, 1, 13, 0, 0)),
        });
        await fresh.collection('stats').doc('raffle_2026-08_snapshot').set({
            winner: 'Ada',
            winnerUid: 'raffle-uid-secret',
            email: 'ada@example.com',
        });
        await fresh.collection('raid_bosses').doc('2026-12').set({
            name: 'Cipher-Cracker',
            defeated: false,
            placeholder: false,
            startTime: ts(end),
            endTime: ts(engine.zonedTimeToUtc(2027, 1, 1, 13, 0, 0)),
            current: 0,
            target: 1000,
        });
        await fresh.collection('raid_history').doc('old-win').set({
            result: 'defeated',
            prizeWon: true,
            prizeWinner: '',
            recap: 'kept',
        });
        await fresh.collection('raid_bosses').doc('old-win').set({
            name: 'Forum-Forge',
            defeated: true,
            placeholder: false,
            startTime: ts(start),
            endTime: ts(end),
            current: 1000,
            target: 1000,
        });
        await fresh.collection('raid_bosses').doc('old-win').collection('winners').doc('winner-uid').set({
            username: 'Divine',
            uid: 'winner-uid',
            email: 'divine@example.com',
        });
        await fresh.collection('stats').doc('raffle_2026-10_snapshot').set({
            winner: 'Nia',
            winnerUid: 'raffle-uid-secret',
        });
        const dry = await engine.backfillRaidHistory(fresh, admin, end, { apply: false });
        assert.strictEqual(dry.wouldCreate, 1);
        assert.strictEqual(dry.wouldFillWinners, 1);
        assert.strictEqual((await fresh.collection('raid_history').doc('2026-08').get()).exists, false);
        assert.strictEqual((await fresh.collection('raid_history').doc('old-win').get()).data().prizeWinner, '');
        const applied = await engine.backfillRaidHistory(fresh, admin, end, { apply: true });
        assert.strictEqual(applied.created, 1);
        assert.strictEqual(applied.filledWinners, 1);
        const made = (await fresh.collection('raid_history').doc('2026-08').get()).data();
        assert.strictEqual(made.prizeWinner, 'Ada');
        assert.strictEqual(made.result, 'defeated');
        assert.strictEqual(JSON.stringify(made).indexOf('winner-uid'), -1);
        assert.strictEqual(JSON.stringify(made).indexOf('ada@example.com'), -1);
        const filled = (await fresh.collection('raid_history').doc('old-win').get()).data();
        assert.strictEqual(filled.prizeWinner, 'Nia');
        assert.strictEqual(filled.recap, 'kept');
        assert.strictEqual(JSON.stringify(filled).indexOf('nia@example.com'), -1);
        const script = fs.readFileSync(path.join(root, 'functions/scripts/backfill_raid_history.js'), 'utf8');
        assert.ok(script.indexOf('dry-run') !== -1 || script.indexOf('Dry-run') !== -1);
        assert.ok(script.indexOf("'--apply'") !== -1);
        const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
        const at = rules.indexOf('match /raid_history/{bossId}');
        const block = rules.slice(at, at + 220);
        assert.ok(at > 0);
        assert.ok(block.indexOf('allow read: if true') !== -1);
        assert.ok(block.indexOf('allow create, update, delete: if false') !== -1);
        const quests = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
        assert.ok(quests.indexOf("orderBy('endedAtMs', 'desc').limit(12)") !== -1);
        assert.ok(quests.indexOf('Winner announced soon') !== -1);
        assert.ok(quests.indexOf('showUserProfileByUsername') !== -1);
        assert.ok(quests.indexOf('📜 Boss History') !== -1);
        assert.ok(quests.indexOf('id="raidBossHistoryBody" style="display:none;') !== -1);
        const mountAt = quests.indexOf('function _mountRaidHistory');
        const mount = quests.slice(mountAt, quests.indexOf('window._toggleRaidHistory = function'));
        assert.strictEqual(mount.indexOf('.get('), -1);
        assert.ok(quests.indexOf('window._raidHistoryCache') !== -1);
        assert.ok(quests.indexOf('window._raidHistoryCache = null') !== -1);
        assert.ok(quests.indexOf('if (window._raidHistoryCache || window._raidHistoryLoading) return;') !== -1);
        const callable = fs.readFileSync(path.join(root, 'functions/src/contributeRaid.js'), 'utf8');
        assert.ok(callable.indexOf('recordBossHistory') !== -1);
        assert.ok(callable.indexOf('syncPrizeWinner') !== -1);
    });

    await test('a defeating hit writes the history doc from the raid engine', async function () {
        const db = memoryDb();
        const admin = adminFor();
        const start = engine.zonedTimeToUtc(2026, 11, 1, 13, 0, 0);
        const end = engine.zonedTimeToUtc(2026, 12, 1, 13, 0, 0);
        await db.collection('raid_bosses').doc('2026-11').set({
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
            communityTarget: 335,
            startTime: ts(start),
            endTime: ts(end),
            image: 'https://assets.bitcoineducation.quest/images/raid-bosses/chat-charger.png',
        });
        await db.collection('users').doc('uid-secret-abc').set({ username: 'Ada', email: 'ada@example.com' });
        const hit = await engine.creditTrusted(db, admin, {
            metric: 'chatMessages',
            uid: 'uid-secret-abc',
            dedupeKey: 'chat-win',
            amount: 1,
            text: '12345678',
            grantTickets: null,
            badges: false,
            now: new Date('2026-11-15T18:00:00.000Z'),
        });
        assert.strictEqual(hit.defeated, true);
        const saved = (await db.collection('raid_history').doc('2026-11').get()).data();
        assert.strictEqual(saved.result, 'defeated');
        assert.strictEqual(saved.prizeWinner, '');
        await db.collection('stats').doc('raffle_2026-11_snapshot').set({
            winner: 'Nia',
            winnerUid: 'raffle-uid-secret',
        });
        const named = await engine.syncPrizeWinner(db, admin, '2026-11');
        assert.strictEqual(named.updated, true);
        assert.strictEqual((await db.collection('raid_history').doc('2026-11').get()).data().prizeWinner, 'Nia');
        assert.strictEqual(saved.goalText, 'Send 335 real Global Chat messages');
        assert.strictEqual(saved.monthLabel, 'November 2026');
        assert.ok(saved.image.indexOf('chat-charger.png') !== -1);
        const packed = JSON.stringify(saved);
        assert.strictEqual(packed.indexOf('uid-secret-abc'), -1);
        assert.strictEqual(packed.indexOf('ada@example.com'), -1);
        assert.ok(sentenceCount(saved.recap) >= 2 && sentenceCount(saved.recap) <= 3);
        const packedWinner = JSON.stringify((await db.collection('raid_history').doc('2026-11').get()).data());
        assert.strictEqual(packedWinner.indexOf('raffle-uid-secret'), -1);
    });

    await test('a survived card waits 10 minutes and can be upgraded to defeated', async function () {
        const db = memoryDb();
        const admin = adminFor();
        const history = require('../functions/src/raidHistory');
        const start = engine.zonedTimeToUtc(2026, 9, 1, 13, 0, 0);
        const end = engine.zonedTimeToUtc(2026, 10, 1, 13, 0, 0);
        const ref = db.collection('raid_bosses').doc('2026-09');
        await ref.set({
            name: 'Chat-Charger',
            metric: 'chatMessages',
            communityTarget: 335,
            target: 1000,
            current: 250,
            defeated: false,
            placeholder: false,
            monthKey: '2026-09',
            startTime: ts(start),
            endTime: ts(end),
        });
        await ref.collection('participants').doc('uid-secret-abc').set({
            username: 'Banned',
            contributed: 250,
            email: 'banned@example.com',
        });
        const early = await engine.recordBossHistory(db, admin, ref, '2026-09', { now: end });
        assert.strictEqual(early.reason, 'grace');
        assert.strictEqual((await db.collection('raid_history').doc('2026-09').get()).exists, false);
        const readyAt = new Date(end.getTime() + history.SURVIVE_GRACE_MS);
        const wrote = await engine.recordBossHistory(db, admin, ref, '2026-09', { now: readyAt });
        assert.strictEqual(wrote.wrote, true);
        assert.strictEqual((await db.collection('raid_history').doc('2026-09').get()).data().result, 'survived');
        await ref.update({ defeated: true, current: 1000, defeatedAt: ts(readyAt) });
        await ref.collection('winners').doc('uid-secret-abc').set({
            uid: 'uid-secret-abc',
            username: 'Banned',
            drawnAt: ts(readyAt),
        });
        const upgraded = await engine.recordBossHistory(db, admin, ref, '2026-09', { now: readyAt });
        assert.strictEqual(upgraded.upgraded, true);
        const fallen = (await db.collection('raid_history').doc('2026-09').get()).data();
        assert.strictEqual(fallen.result, 'defeated');
        assert.strictEqual(fallen.prizeWon, true);
        assert.strictEqual(fallen.prizeWinner, '');
        assert.ok(fallen.recap.indexOf('community prize is won') !== -1);
        assert.strictEqual(JSON.stringify(fallen).indexOf('uid-secret-abc'), -1);
        assert.strictEqual(JSON.stringify(fallen).indexOf('banned@example.com'), -1);
        const again = await engine.recordBossHistory(db, admin, ref, '2026-09', { now: new Date(readyAt.getTime() + 60000) });
        assert.strictEqual(again.reason, 'exists');
        assert.strictEqual((await db.collection('raid_history').doc('2026-09').get()).data().recap, fallen.recap);
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
