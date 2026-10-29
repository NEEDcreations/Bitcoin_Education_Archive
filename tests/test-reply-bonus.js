#!/usr/bin/env node
// Hidden reply bonus. The server reads the chat message and decides the XP.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const bonus = require(path.join(root, 'functions/src/replyBonus'));

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) {
    queue.push(Promise.resolve().then(fn).then(function () {
        passed++;
        console.log('  ok  ' + name);
    }).catch(function (e) {
        failed++;
        console.log('  FAIL ' + name + ': ' + (e && e.stack ? e.stack : e));
    }));
}

function HttpsError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

function createWorld(seed, opts) {
    const clock = { ms: Date.parse('2026-10-22T12:00:00Z') };
    const authOptions = {
        providerData: [{ providerId: 'password' }],
        creationTime: new Date(clock.ms - (48 * 60 * 60 * 1000)).toUTCString(),
        authError: null,
    };
    if (opts && Object.prototype.hasOwnProperty.call(opts, 'providerData')) authOptions.providerData = opts.providerData;
    if (opts && Object.prototype.hasOwnProperty.call(opts, 'creationTime')) authOptions.creationTime = opts.creationTime;
    if (opts && opts.authError) authOptions.authError = opts.authError;
    const docs = Object.assign({}, seed || {});
    function apply(pathKey, data, merge) {
        const cur = merge ? Object.assign({}, docs[pathKey] || {}) : {};
        Object.keys(data || {}).forEach(function (k) {
            const v = data[k];
            if (v && v._inc != null) cur[k] = (Number(cur[k]) || 0) + v._inc;
            else cur[k] = v;
        });
        docs[pathKey] = cur;
    }
    function ref(pathKey) {
        return {
            path: pathKey,
            collection: function (name) { return col(pathKey + '/' + name); },
        };
    }
    function col(pathKey) {
        return { doc: function (id) { return ref(pathKey + '/' + id); } };
    }
    function snap(pathKey) {
        const data = docs[pathKey];
        return {
            exists: data != null,
            data: function () { return data ? Object.assign({}, data) : undefined; },
        };
    }
    const admin = {
        firestore: {
            FieldValue: {
                serverTimestamp: function () {
                    const ms = clock.ms;
                    return { _server: true, toMillis: function () { return ms; } };
                },
                increment: function (n) { return { _inc: n }; },
            },
        },
    };
    const db = {
        collection: function (name) { return col(name); },
        runTransaction: async function (fn) {
            const writes = [];
            const tx = {
                get: async function (r) { return snap(r.path); },
                set: function (r, data, opts) { writes.push({ path: r.path, data: data, merge: !!(opts && opts.merge) }); },
                update: function (r, data) { writes.push({ path: r.path, data: data, merge: true }); },
            };
            const result = await fn(tx);
            writes.forEach(function (w) { apply(w.path, w.data, w.merge); });
            return result;
        },
    };
    const handlers = bonus.createReplyBonusHandlers({
        admin: admin,
        db: db,
        now: function () { return clock.ms; },
        HttpsError: HttpsError,
        getAuthUser: async function () {
            if (authOptions.authError) throw authOptions.authError;
            const metadata = {};
            if (authOptions.creationTime != null && authOptions.creationTime !== '') {
                metadata.creationTime = authOptions.creationTime;
            }
            return { providerData: authOptions.providerData, metadata: metadata };
        },
    });
    return { clock: clock, docs: docs, handlers: handlers, authOptions: authOptions };
}

function auth(uid) {
    return { auth: { uid: uid, token: { firebase: { sign_in_provider: 'password' } } } };
}

function anon(uid) {
    return { auth: { uid: uid, token: { firebase: { sign_in_provider: 'anonymous' } } } };
}

const NOW = Date.parse('2026-10-22T12:00:00Z');

function parent(uid, text) {
    return { uid: uid, text: text || 'hello there', ts: NOW - 5000, isNachoAuto: false };
}

function reply(replyTo, text, extra) {
    return Object.assign({
        uid: 'user1',
        text: text || 'hey there',
        replyTo: replyTo,
        ts: NOW - 1000,
        isNachoAuto: false,
    }, extra || {});
}

function baseDocs(extra) {
    return Object.assign({
        'users/user1': { points: 10 },
        'global_chat/parentUserA': parent('alice01'),
        'global_chat/replyMsg001': reply('parentUserA'),
    }, extra || {});
}

function notes(docs) {
    return Object.keys(docs).filter(function (k) { return k.indexOf('notifications/') === 0; });
}

test('self-reply gets 0', async function () {
    const world = createWorld(baseDocs({
        'global_chat/selfParent1': parent('user1', 'note to self'),
        'global_chat/selfReply01': reply('selfParent1', 'talking to myself'),
    }));
    const res = await world.handlers.claimReplyBonus({
        messageId: 'selfReply01', xp: 50, first: true, replyTo: 'parentUserA',
    }, auth('user1'));
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'self');
    assert.strictEqual(res.xp, 0);
    assert.strictEqual(res.showToast, false);
    assert.strictEqual(world.docs['users/user1'].points, 10);
    assert.strictEqual(world.docs['reply_bonus_claims/selfReply01'], undefined);
    assert.strictEqual(notes(world.docs).length, 0);
});

test('bot, Nacho, system, and Telegram replies get 0', async function () {
    const cases = [
        ['nachoParent', { uid: 'nacho-bot', text: 'hi plebs', ts: NOW - 4000, isNachoAuto: true }],
        ['systemPost1', { uid: 'system', text: 'announcement', ts: NOW - 4000, isSystemPost: true }],
        ['tgParent001', { uid: 'tg_424242', text: 'mirrored', ts: NOW - 4000, source: 'telegram' }],
        ['djParent001', { uid: 'nacho-dj', text: 'now playing', ts: NOW - 4000, isNachoAuto: true }],
        ['fakeNacho01', { uid: 'alice01', text: 'pretend', ts: NOW - 4000, isNachoAuto: true }],
    ];
    for (let i = 0; i < cases.length; i++) {
        const parentId = cases[i][0];
        const replyId = 'botReply0' + i + 'x';
        const world = createWorld({
            'users/user1': { points: 10 },
            ['global_chat/' + parentId]: cases[i][1],
            ['global_chat/' + replyId]: reply(parentId, 'hello friend'),
        });
        const res = await world.handlers.claimReplyBonus({ messageId: replyId, xp: 50 }, auth('user1'));
        assert.strictEqual(res.code, 'bot', parentId);
        assert.strictEqual(res.xp, 0);
        assert.strictEqual(world.docs['users/user1'].points, 10);
        assert.strictEqual(world.docs['reply_bonus_claims/' + replyId], undefined);
    }
    const ownBot = createWorld(baseDocs({
        'global_chat/replyNacho01': reply('parentUserA', 'hello', { isNachoAuto: true }),
    }));
    const posted = await ownBot.handlers.claimReplyBonus({ messageId: 'replyNacho01' }, auth('user1'));
    assert.strictEqual(posted.code, 'not-real');
    assert.strictEqual(posted.xp, 0);
    assert.strictEqual(ownBot.docs['users/user1'].points, 10);
});

test('5-minute cooldown blocks a second reward', async function () {
    const world = createWorld(baseDocs({
        'global_chat/parentUserB': parent('bobuser01', 'welcome'),
    }));
    const first = await world.handlers.claimReplyBonus({ messageId: 'replyMsg001', xp: 9999 }, auth('user1'));
    assert.strictEqual(first.code, 'ok');
    assert.strictEqual(first.xp, 50);
    world.clock.ms += 60 * 1000;
    world.docs['global_chat/replyMsg002'] = {
        uid: 'user1', text: 'hey bob', replyTo: 'parentUserB', ts: world.clock.ms - 1000,
    };
    const early = await world.handlers.claimReplyBonus({ messageId: 'replyMsg002' }, auth('user1'));
    assert.strictEqual(early.code, 'cooldown');
    assert.strictEqual(early.xp, 0);
    assert.strictEqual(early.showToast, false);
    assert.strictEqual(world.docs['users/user1'].points, 60);
    assert.strictEqual(world.docs['reply_bonus_claims/replyMsg002'], undefined);

    world.clock.ms = NOW + bonus.COOLDOWN_MS;
    world.docs['global_chat/replyMsg003'] = {
        uid: 'user1', text: 'hey again', replyTo: 'parentUserB', ts: world.clock.ms - 1000,
    };
    const later = await world.handlers.claimReplyBonus({ messageId: 'replyMsg003' }, auth('user1'));
    assert.strictEqual(later.code, 'ok');
    assert.strictEqual(later.xp, 25);
    assert.strictEqual(later.first, false);
    assert.strictEqual(world.docs['users/user1'].points, 85);
});

test('one reward per replier and replied-to user per hour', async function () {
    const world = createWorld(baseDocs());
    const first = await world.handlers.claimReplyBonus({ messageId: 'replyMsg001' }, auth('user1'));
    assert.strictEqual(first.xp, 50);
    world.clock.ms += bonus.COOLDOWN_MS + 1000;
    world.docs['global_chat/replyMsg002'] = {
        uid: 'user1', text: 'still you', replyTo: 'parentUserA', ts: world.clock.ms - 1000,
    };
    const same = await world.handlers.claimReplyBonus({ messageId: 'replyMsg002' }, auth('user1'));
    assert.strictEqual(same.code, 'pair');
    assert.strictEqual(same.xp, 0);
    assert.strictEqual(world.docs['users/user1'].points, 60);
    assert.strictEqual(world.docs['reply_bonus_claims/replyMsg002'], undefined);

    world.clock.ms = NOW + bonus.PAIR_WINDOW_MS + 1000;
    world.docs['global_chat/replyMsg003'] = {
        uid: 'user1', text: 'an hour later', replyTo: 'parentUserA', ts: world.clock.ms - 1000,
    };
    const after = await world.handlers.claimReplyBonus({ messageId: 'replyMsg003' }, auth('user1'));
    assert.strictEqual(after.code, 'ok');
    assert.strictEqual(after.xp, 25);
    assert.strictEqual(world.docs['users/user1'].points, 85);
});

test('daily cap is 10 reply rewards', async function () {
    const seeded = createWorld(baseDocs({
        'users/user1/daily_action_counts/2026-10-22_reply_bonus': { count: 10 },
    }));
    const blocked = await seeded.handlers.claimReplyBonus({ messageId: 'replyMsg001', xp: 50 }, auth('user1'));
    assert.strictEqual(blocked.code, 'daily');
    assert.strictEqual(blocked.xp, 0);
    assert.strictEqual(seeded.docs['users/user1'].points, 10);
    assert.strictEqual(seeded.docs['reply_bonus_claims/replyMsg001'], undefined);

    const world = createWorld({ 'users/user1': { points: 10 } });
    for (let i = 0; i < 10; i++) {
        const parentId = 'parent' + String(i).padStart(4, '0');
        const replyId = 'replyA' + String(i).padStart(4, '0');
        const target = 'pal' + String(1000 + i);
        world.docs['global_chat/' + parentId] = {
            uid: target, text: 'hello there', ts: world.clock.ms - 2000,
        };
        world.docs['global_chat/' + replyId] = {
            uid: 'user1', text: 'thanks', replyTo: parentId, ts: world.clock.ms - 500,
        };
        const res = await world.handlers.claimReplyBonus({ messageId: replyId, xp: 5000, first: true }, auth('user1'));
        assert.strictEqual(res.code, 'ok', 'reward ' + i);
        assert.strictEqual(res.xp, i === 0 ? 50 : 25);
        assert.strictEqual(res.first, i === 0);
        world.clock.ms += bonus.COOLDOWN_MS + 1000;
    }
    assert.strictEqual(world.docs['users/user1'].points, 10 + 50 + (9 * 25));
    assert.strictEqual(world.docs['users/user1/daily_action_counts/2026-10-22_reply_bonus'].count, 10);
    const parentId = 'parent0010';
    const replyId = 'replyA0010';
    world.docs['global_chat/' + parentId] = {
        uid: 'pal2000', text: 'hello there', ts: world.clock.ms - 2000,
    };
    world.docs['global_chat/' + replyId] = {
        uid: 'user1', text: 'thanks', replyTo: parentId, ts: world.clock.ms - 500,
    };
    const eleventh = await world.handlers.claimReplyBonus({ messageId: replyId }, auth('user1'));
    assert.strictEqual(eleventh.code, 'daily');
    assert.strictEqual(eleventh.xp, 0);
    assert.strictEqual(world.docs['users/user1'].points, 10 + 50 + (9 * 25));
});

test('first reply is 50 XP and every later one is 25', async function () {
    const world = createWorld(baseDocs({
        'global_chat/parentUserB': parent('bobuser01', 'welcome in'),
    }));
    const hostile = {
        messageId: 'replyMsg001',
        xp: 9999,
        first: false,
        text: 'not the stored message',
        replyTo: 'parentUserB',
    };
    const first = await world.handlers.claimReplyBonus(hostile, auth('user1'));
    assert.strictEqual(first.code, 'ok');
    assert.strictEqual(first.xp, 50);
    assert.strictEqual(first.first, true);
    assert.strictEqual(first.showToast, true);
    assert.strictEqual(world.docs['users/user1'].points, 60);
    assert.strictEqual(world.docs['users/user1'].weeklyXP, 50);
    assert.strictEqual(world.docs['users/user1'].monthlyXP, 50);
    assert.strictEqual(world.docs['reply_bonus_state/user1'].firstClaimed, true);
    const notice = world.docs['notifications/' + bonus.noticeId('replyMsg001')];
    assert.ok(notice);
    assert.strictEqual(notice.message, bonus.replyToastText(50, true));
    assert.strictEqual(notice.xp, 50);
    assert.strictEqual(notice.recipientId, 'user1');
    assert.strictEqual(notice.type, 'reward');
    assert.strictEqual(notice.message.includes('alice'), false);
    assert.strictEqual(notice.message.includes('hey'), false);

    world.clock.ms += bonus.COOLDOWN_MS + 1000;
    world.docs['global_chat/replyMsg002'] = {
        uid: 'user1', text: 'hey bob', replyTo: 'parentUserB', ts: world.clock.ms - 1000,
    };
    const second = await world.handlers.claimReplyBonus({
        messageId: 'replyMsg002', xp: 50, first: true,
    }, auth('user1'));
    assert.strictEqual(second.code, 'ok');
    assert.strictEqual(second.xp, 25);
    assert.strictEqual(second.first, false);
    assert.strictEqual(second.showToast, true);
    assert.strictEqual(world.docs['users/user1'].points, 85);
    const laterNote = world.docs['notifications/' + bonus.noticeId('replyMsg002')];
    assert.strictEqual(laterNote.message, bonus.replyToastText(25, false));
    assert.strictEqual(laterNote.xp, 25);
});

test('each messageId can be rewarded only once', async function () {
    const world = createWorld(baseDocs());
    const first = await world.handlers.claimReplyBonus({ messageId: 'replyMsg001', xp: 50 }, auth('user1'));
    assert.strictEqual(first.xp, 50);
    const again = await world.handlers.claimReplyBonus({ messageId: 'replyMsg001', xp: 50, first: true }, auth('user1'));
    assert.strictEqual(again.success, true);
    assert.strictEqual(again.code, 'already');
    assert.strictEqual(again.xp, 0);
    assert.strictEqual(again.showToast, false);
    assert.strictEqual(world.docs['users/user1'].points, 60);
    assert.strictEqual(notes(world.docs).length, 1);

    world.clock.ms += 10 * 60 * 1000;
    const late = await world.handlers.claimReplyBonus({ messageId: 'replyMsg001' }, auth('user1'));
    assert.strictEqual(late.code, 'already');
    assert.strictEqual(late.xp, 0);
    assert.strictEqual(world.docs['users/user1'].points, 60);
    assert.strictEqual(notes(world.docs).length, 1);
    assert.strictEqual(world.docs['reply_bonus_claims/replyMsg001'].xp, 50);
});

test('banned and linked accounts get nothing', async function () {
    const cases = [
        { user: { points: 10, banned: true }, ledger: {} },
        { user: { points: 10, satsDisabled: true }, ledger: {} },
        { user: { points: 10 }, ledger: { banned: true } },
    ];
    for (let i = 0; i < cases.length; i++) {
        const world = createWorld(baseDocs({
            'users/user1': cases[i].user,
            'faucet_ledger/user1': cases[i].ledger,
        }));
        const res = await world.handlers.claimReplyBonus({ messageId: 'replyMsg001', xp: 50 }, auth('user1'));
        assert.strictEqual(res.code, 'unavailable');
        assert.strictEqual(res.xp, 0);
        assert.strictEqual(world.docs['users/user1'].points, 10);
        assert.strictEqual(world.docs['reply_bonus_claims/replyMsg001'], undefined);
    }
});

test('accounts under 24 hours or without a linked provider get nothing', async function () {
    const hour = 60 * 60 * 1000;
    function utc(ms) { return new Date(ms).toUTCString(); }

    // A forged old profile created does not make a young Auth account eligible.
    const young = createWorld(baseDocs({
        'users/user1': { points: 10, created: NOW - (365 * 24 * hour) },
    }), { creationTime: utc(NOW - (23 * hour)) });
    const youngRes = await young.handlers.claimReplyBonus({ messageId: 'replyMsg001', xp: 50 }, auth('user1'));
    assert.strictEqual(youngRes.code, 'unavailable');
    assert.strictEqual(youngRes.xp, 0);
    assert.strictEqual(youngRes.showToast, false);
    assert.strictEqual(young.docs['users/user1'].points, 10);
    assert.strictEqual(young.docs['reply_bonus_claims/replyMsg001'], undefined);
    assert.strictEqual(young.docs['rate_limits/reply_user1'].lastReward, undefined);

    // Missing Auth creationTime fails closed, even when the profile field is old.
    const missingTime = createWorld(baseDocs({
        'users/user1': { points: 10, created: NOW - (365 * 24 * hour), createdAt: NOW - (365 * 24 * hour) },
    }), { creationTime: null });
    const missingTimeRes = await missingTime.handlers.claimReplyBonus({ messageId: 'replyMsg001' }, auth('user1'));
    assert.strictEqual(missingTimeRes.code, 'unavailable');
    assert.strictEqual(missingTime.docs['users/user1'].points, 10);
    assert.strictEqual(missingTime.docs['reply_bonus_claims/replyMsg001'], undefined);

    const blankTime = createWorld(baseDocs({
        'users/user1': { points: 10, created: NOW - (48 * hour) },
    }), { creationTime: '' });
    const blankRes = await blankTime.handlers.claimReplyBonus({ messageId: 'replyMsg001' }, auth('user1'));
    assert.strictEqual(blankRes.code, 'unavailable');
    assert.strictEqual(blankTime.docs['reply_bonus_claims/replyMsg001'], undefined);

    // Missing profile created still pays when the Auth account is old enough.
    const noProfileCreated = createWorld(baseDocs());
    const openRes = await noProfileCreated.handlers.claimReplyBonus({ messageId: 'replyMsg001' }, auth('user1'));
    assert.strictEqual(openRes.code, 'ok');
    assert.strictEqual(openRes.xp, 50);
    assert.strictEqual(noProfileCreated.docs['users/user1'].created, undefined);

    const oldEnough = createWorld(baseDocs({
        'users/user1': { points: 10, created: NOW - hour },
    }), { creationTime: utc(NOW - bonus.MIN_ACCOUNT_AGE_MS) });
    const oldRes = await oldEnough.handlers.claimReplyBonus({ messageId: 'replyMsg001' }, auth('user1'));
    assert.strictEqual(oldRes.code, 'ok');
    assert.strictEqual(oldRes.xp, 50);

    const noProvider = createWorld(baseDocs(), { providerData: [] });
    const guest = await noProvider.handlers.claimReplyBonus({ messageId: 'replyMsg001', xp: 50 }, auth('user1'));
    assert.strictEqual(guest.code, 'unavailable');
    assert.strictEqual(guest.xp, 0);
    assert.strictEqual(noProvider.docs['users/user1'].points, 10);
    assert.strictEqual(noProvider.docs['reply_bonus_claims/replyMsg001'], undefined);

    const anonProfile = createWorld(baseDocs({
        'users/user1': { points: 10, isAnonymous: true },
    }));
    const anonRes = await anonProfile.handlers.claimReplyBonus({ messageId: 'replyMsg001' }, auth('user1'));
    assert.strictEqual(anonRes.code, 'unavailable');
    assert.strictEqual(anonProfile.docs['reply_bonus_claims/replyMsg001'], undefined);

    const missing = createWorld(baseDocs(), { authError: { code: 'auth/user-not-found' } });
    const missingRes = await missing.handlers.claimReplyBonus({ messageId: 'replyMsg001' }, auth('user1'));
    assert.strictEqual(missingRes.code, 'unavailable');
    assert.strictEqual(missing.docs['reply_bonus_claims/replyMsg001'], undefined);

    const down = createWorld(baseDocs(), { authError: new Error('auth down') });
    const downRes = await down.handlers.claimReplyBonus({ messageId: 'replyMsg001' }, auth('user1'));
    assert.strictEqual(downRes.code, 'unavailable');
    assert.strictEqual(down.docs['users/user1'].points, 10);
    assert.strictEqual(down.docs['reply_bonus_claims/replyMsg001'], undefined);

    const kept = createWorld(baseDocs());
    const first = await kept.handlers.claimReplyBonus({ messageId: 'replyMsg001' }, auth('user1'));
    assert.strictEqual(first.xp, 50);
    kept.authOptions.providerData = [];
    kept.authOptions.authError = new Error('auth down');
    const again = await kept.handlers.claimReplyBonus({ messageId: 'replyMsg001', xp: 50 }, auth('user1'));
    assert.strictEqual(again.code, 'already');
    assert.strictEqual(again.xp, 0);
    assert.strictEqual(kept.docs['users/user1'].points, 60);
});

test('a banned original author gets no bonus', async function () {
    const cases = [
        { 'users/alice01': { satsDisabled: true } },
        { 'faucet_ledger/alice01': { banned: true } },
        { 'users/alice01': { banned: true } },
    ];
    for (let i = 0; i < cases.length; i++) {
        const world = createWorld(baseDocs(Object.assign({
            'users/user1': { points: 10, created: NOW - (48 * 60 * 60 * 1000) },
        }, cases[i])));
        const res = await world.handlers.claimReplyBonus({ messageId: 'replyMsg001', xp: 50 }, auth('user1'));
        assert.strictEqual(res.code, 'unavailable', 'case ' + i);
        assert.strictEqual(res.xp, 0);
        assert.strictEqual(res.showToast, false);
        assert.strictEqual(world.docs['users/user1'].points, 10);
        assert.strictEqual(world.docs['reply_bonus_claims/replyMsg001'], undefined);
        assert.strictEqual(world.docs['reply_bonus_state/user1'], undefined);
        assert.strictEqual(world.docs['rate_limits/reply_user1'].lastReward, undefined);
        assert.strictEqual(notes(world.docs).length, 0);
    }
});

test('short, link-only, stale, and stolen messages get 0', async function () {
    const samples = [
        ['replyShort01', reply('parentUserA', 'a'), 'short'],
        ['replyLink001', reply('parentUserA', '[link removed]'), 'empty'],
        ['replySpam001', reply('parentUserA', 'aaaaaaa'), 'short'],
        ['replyOld0001', reply('parentUserA', 'hey there', { ts: NOW - (3 * 60 * 1000) }), 'old'],
        ['replyOther01', reply('parentUserA', 'hey there', { uid: 'bobuser01' }), 'not-owner'],
    ];
    for (let i = 0; i < samples.length; i++) {
        const world = createWorld(baseDocs({
            ['global_chat/' + samples[i][0]]: samples[i][1],
        }));
        const res = await world.handlers.claimReplyBonus({ messageId: samples[i][0], xp: 50, text: 'hello there' }, auth('user1'));
        assert.strictEqual(res.code, samples[i][2], samples[i][0]);
        assert.strictEqual(res.xp, 0);
        assert.strictEqual(world.docs['users/user1'].points, 10);
        assert.strictEqual(world.docs['reply_bonus_claims/' + samples[i][0]], undefined);
    }
    const emoji = createWorld(baseDocs({
        'global_chat/replyEmoji01': reply('parentUserA', '🎉🎉'),
    }));
    const ok = await emoji.handlers.claimReplyBonus({ messageId: 'replyEmoji01' }, auth('user1'));
    assert.strictEqual(ok.code, 'ok');
    assert.strictEqual(ok.xp, 50);
});

test('daily XP cap uses the shared helper', async function () {
    const world = createWorld(baseDocs({
        'users/user1': { points: 10 },
        'users/user1/daily_points/2026-10-22': { total: 980 },
    }));
    const res = await world.handlers.claimReplyBonus({ messageId: 'replyMsg001' }, auth('user1'));
    // 50 raw in the quarter tier credits floor(50 / 4) = 12, short of the last 20.
    assert.strictEqual(res.xp, 12);
    assert.strictEqual(res.first, true);
    assert.strictEqual(res.showToast, true);
    assert.strictEqual(world.docs['users/user1'].points, 22);
    assert.strictEqual(world.docs['users/user1'].pendingOverflow, undefined);
    assert.strictEqual(world.docs['users/user1/daily_points/2026-10-22'].total, 992);
});

test('signed-out and anonymous callers are rejected', async function () {
    const world = createWorld(baseDocs());
    await assert.rejects(function () {
        return world.handlers.claimReplyBonus({ messageId: 'replyMsg001' }, {});
    }, function (e) { return e.code === 'unauthenticated'; });
    await assert.rejects(function () {
        return world.handlers.claimReplyBonus({ messageId: 'replyMsg001' }, anon('user1'));
    }, function (e) { return e.code === 'unauthenticated'; });
    const bad = await world.handlers.claimReplyBonus({ messageId: 'short' }, auth('user1'));
    assert.strictEqual(bad.code, 'no-message');
    assert.strictEqual(world.docs['users/user1'].points, 10);
});

test('rules keep XP, the bonus flag, and replyTo on the server', function () {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const users = rules.slice(rules.indexOf('match /users/{userId} {'), rules.indexOf('match /public_profiles/{uid}'));
    ['points', 'xp', 'weeklyXP', 'monthlyXP', 'pendingOverflow', 'replyBonusClaimed', 'replyBonusFirstClaimed', 'replyBonusLastAt', 'replyBonusCount'].forEach(function (field) {
        assert.ok(users.includes("'" + field + "'"), 'denylist missing ' + field);
    });
    const createBlock = users.slice(users.indexOf('allow create:'), users.indexOf('allow update:'));
    assert.ok(createBlock.includes("!('created' in request.resource.data)"));
    assert.ok(createBlock.includes('request.resource.data.created == request.time'));
    const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    assert.ok((ranking.match(/clientCreatePayload\(/g) || []).length >= 3);
    assert.strictEqual((ranking.match(/anonData\.created = firebase\.firestore\.FieldValue\.serverTimestamp\(\)/g) || []).length, 0);
    const createdLines = ranking.match(/created:\s*[^\n]+/g) || [];
    assert.ok(createdLines.length >= 2);
    createdLines.forEach(function (line) {
        assert.ok(line.indexOf('serverTimestamp()') !== -1, line);
    });
    const chat = rules.slice(rules.indexOf('match /global_chat/{msgId}'), rules.indexOf('// NOTIFICATIONS'));
    assert.ok(chat.includes('replyTo.size() >= 8'));
    assert.ok(chat.includes('replyTo.size() <= 128'));
    assert.ok(chat.includes("replyTo.matches('^[A-Za-z0-9_-]+$')"));
    assert.ok(chat.includes('replyTo != msgId'));
    assert.ok(chat.includes("hasOnly(['text','editCount','edited'])"));
    const editAllow = chat.slice(chat.indexOf('Message edit:'));
    assert.ok(editAllow.includes("hasOnly(['text','editCount','edited'])"));
    assert.strictEqual(editAllow.includes('replyTo'), false);
    ['reply_bonus_state', 'reply_bonus_claims', 'reply_bonus_pairs', 'rate_limits'].forEach(function (name) {
        const block = rules.slice(rules.indexOf('match /' + name + '/{docId}'), rules.indexOf('match /' + name + '/{docId}') + 180);
        assert.ok(block.includes('allow read, write: if false'), name);
    });
    const actions = rules.slice(rules.indexOf('match /users/{userId}/daily_action_counts/{docId}'), rules.indexOf('match /users/{userId}/badge_awards'));
    assert.ok(actions.includes('allow write: if false'));
});

test('callable source ignores client XP and enforces App Check', function () {
    const src = fs.readFileSync(path.join(root, 'functions/src/replyBonus.js'), 'utf8');
    const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    assert.ok(src.includes('enforceAppCheck: true'));
    assert.ok(src.includes("require('./sayHi')"));
    assert.ok(src.includes('extractSayHiText'));
    assert.ok(src.includes('withoutRemovedLinks'));
    assert.ok(src.includes('isSpamRepeat'));
    assert.ok(src.includes('meaningfulLength'));
    assert.ok(src.includes('isSayHiBlocked'));
    assert.strictEqual(src.includes('function meaningfulLength'), false);
    assert.strictEqual(src.includes('function isSpamRepeat'), false);
    assert.strictEqual(src.includes('function withoutRemovedLinks'), false);
    assert.strictEqual(src.includes('function timestampMs'), false);
    assert.strictEqual(src.includes('function offsetDateKey'), false);
    const claimFn = src.slice(src.indexOf('const claimReplyBonus'), src.indexOf('return { claimReplyBonus'));
    const providerAt = claimFn.indexOf('readAuthAccount');
    const txAt = claimFn.indexOf('runTransaction');
    assert.ok(providerAt > 0 && providerAt < txAt);
    assert.ok(src.includes('metadata.creationTime'));
    assert.ok(src.includes('authCreatedMs'));
    assert.strictEqual(src.includes('user.created'), false);
    assert.strictEqual(src.includes('createdAt'), false);
    assert.ok(src.includes('runTransaction'));
    assert.ok(src.includes('planDailyXp'));
    assert.ok(!src.includes('data.xp'));
    assert.ok(!src.includes('data.first'));
    assert.ok(!src.includes('data.text'));
    assert.ok(!src.includes('data.replyTo'));
    assert.ok(index.includes('exports.claimReplyBonus'));
    assert.ok(index.includes('bindReplyBonus'));
    const claimSats = index.slice(index.indexOf('exports.claimSats'), index.indexOf('exports.claimSats') + 400);
    assert.ok(claimSats.includes('enforceAppCheck: true'));
});

test('client shows the server amount and does not render user text', function () {
    const gc = fs.readFileSync(path.join(root, 'global-chat.js'), 'utf8');
    const section = gc.slice(gc.indexOf('// REPLY-BONUS START'), gc.indexOf('// REPLY-BONUS END'));
    assert.ok(section.length > 200);
    assert.strictEqual(section.includes('innerHTML'), false);
    assert.ok(section.includes('claimReplyBonus'));
    assert.ok(section.includes('getToken(false)'));
    assert.ok(section.includes('messageId: messageId'));
    assert.ok(section.includes("data.xp"));
    assert.ok(section.includes("data.first === true"));
    assert.ok(section.includes('XP for joining the conversation!'));
    assert.ok(!section.includes('awardPoints'));
    assert.ok(!section.includes(".collection('users')"));
    assert.ok(!section.includes('replyToName'));
    assert.ok(!section.includes('replyToText'));
    assert.strictEqual((gc.match(/_maybeClaimReplyBonus\(docRef\.id\)/g) || []).length, 3);
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.strictEqual(html, fs.readFileSync(path.join(root, '404.html'), 'utf8'));
    assert.ok(!html.includes('joining the conversation'));
    assert.ok(html.includes('global-chat.js?v=20261028_v2415'));
    assert.ok(!html.includes('global-chat.js?v=20261026_v2379'));
    assert.ok(!html.includes('global-chat.js?v=20261026_v2378'));
    assert.ok(!html.includes('global-chat.js?v=20261026_v2396'));
    assert.ok(!html.includes('global-chat.js?v=20261026_v2400'));
    assert.ok(!html.includes('global-chat.js?v=20261026_v2381'));
    assert.ok(!html.includes('global-chat.js?v=20261026_v2369'));
    assert.ok(!html.includes('global-chat.js?v=20261026_v2380'));
    assert.ok(!html.includes('global-chat.js?v=20261026_v2372'));
    assert.ok(!html.includes('global-chat.js?v=20261026_v2368'));
    assert.ok(!html.includes('global-chat.js?v=20261024_v2360'));
    assert.ok(!html.includes('global-chat.js?v=20261026_v2373'));
    assert.ok(!html.includes('global-chat.js?v=20261026_v2363'));
    assert.ok(!html.includes('global-chat.js?v=20261024_v2350'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2345'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2343'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2342'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2341'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2333'));
    assert.strictEqual(html.includes('global-chat.js?v=20261023_v2333'), false);
    assert.ok(!html.includes('global-chat.js?v=20261023_v2333'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2272'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2269'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2267'));
    assert.ok(html.includes('ranking.js?v=20261028_v2412'));
    assert.ok(!html.includes('ranking.js?v=20261026_v2378'));
    assert.ok(!html.includes('ranking.js?v=20261026_v2400'));
    assert.ok(!html.includes('ranking.js?v=20261026_v2377'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2358'));
    assert.ok(!html.includes('ranking.js?v=20261026_v2367'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2361'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2357'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2356'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2355'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2354'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2352'));
    assert.ok(!html.includes('ranking.js?v=20261024_repickc'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2350'));
    assert.ok(!html.includes('ranking.js?v=20261024_repickb'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2351'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2349'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2342'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2341'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2334'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2333'));
    assert.ok(!html.includes('ranking.js?v=20261022_v2269'));
    const swText = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

    assert.ok(swText.includes("const CACHE_NAME = 'btc-archive-v2418'"));
    assert.ok(!swText.includes('btc-archive-v2391'));
    assert.ok(!swText.includes('btc-archive-v2386'));
    assert.ok(!swText.includes('btc-archive-v2407'));
    assert.ok(!swText.includes('btc-archive-v2385'));
    assert.ok(!swText.includes('btc-archive-v2425'));
    assert.ok(!swText.includes('btc-archive-v2384'));
    assert.ok(!swText.includes('btc-archive-v2411'));
    assert.ok(!swText.includes('btc-archive-v2383'));
    assert.ok(!swText.includes('btc-archive-v2420'));
    assert.ok(!swText.includes('btc-archive-v2382'));
    assert.ok(!swText.includes('btc-archive-v2381'));
    assert.ok(!swText.includes('btc-archive-v2380'));
    assert.ok(!swText.includes('btc-archive-v2405'));
    assert.ok(!swText.includes('btc-archive-v2379'));
    assert.ok(!swText.includes('btc-archive-v2378'));
    assert.ok(!swText.includes('btc-archive-v2399'));
    assert.ok(!swText.includes('btc-archive-v2378'));
    assert.ok(!swText.includes('btc-archive-v2377'));
    assert.ok(!swText.includes('btc-archive-v2376'));
    assert.ok(!swText.includes('btc-archive-v2375'));
    assert.ok(!swText.includes('btc-archive-v2374'));
    assert.ok(!swText.includes('btc-archive-v2370'));
    assert.ok(!swText.includes('btc-archive-v2373'));
    assert.ok(!swText.includes('btc-archive-v2372'));
    assert.ok(!swText.includes('btc-archive-v2371'));
    assert.ok(!swText.includes('btc-archive-v2370'));
    assert.ok(!swText.includes('btc-archive-v2369'));
    assert.ok(!swText.includes('btc-archive-v2368'));
    assert.ok(!swText.includes('btc-archive-v2367'));
    assert.ok(!swText.includes('btc-archive-v2366'));
    assert.ok(!swText.includes('btc-archive-v2365'));
    assert.ok(!swText.includes('btc-archive-v2364'));
    assert.ok(!swText.includes('btc-archive-v2372'));
    assert.ok(!swText.includes('btc-archive-v2368'));
    assert.ok(!swText.includes('btc-archive-v2362'));
    assert.ok(!swText.includes('btc-archive-v2361'));
    assert.ok(!swText.includes('btc-archive-v2360'));
    assert.ok(!swText.includes('btc-archive-v2359'));
    assert.ok(!swText.includes('btc-archive-v2358'));
    assert.ok(!swText.includes('btc-archive-v2357'));
    assert.ok(!swText.includes('btc-archive-v2356'));
    assert.ok(!swText.includes('btc-archive-v2355'));
    assert.ok(!swText.includes('btc-archive-v2354'));
    assert.ok(!swText.includes('btc-archive-v2353'));
    assert.ok(!swText.includes('btc-archive-v2352'));
    assert.ok(!swText.includes('btc-archive-v2351'));
    assert.ok(!swText.includes('btc-archive-v2350'));
    assert.ok(!swText.includes('btc-archive-v2349'));
    assert.ok(!swText.includes('btc-archive-v2348'));
    assert.ok(!swText.includes('btc-archive-v2347'));
    assert.ok(!swText.includes('btc-archive-v2346'));
    assert.ok(!swText.includes('btc-archive-v2345'));
    assert.ok(!swText.includes('btc-archive-v2344'));
    assert.ok(!swText.includes('btc-archive-v2343'));
    assert.ok(!swText.includes('btc-archive-v2342'));
    assert.ok(!swText.includes('btc-archive-v2340'));
    assert.ok(!swText.includes('btc-archive-v2341'));
    assert.ok(!swText.includes('btc-archive-v2339'));
    assert.ok(!swText.includes('btc-archive-v2338'));
    assert.ok(!swText.includes('btc-archive-v2334'));
    assert.ok(!swText.includes('btc-archive-v2333'));
    assert.ok(!swText.includes('btc-archive-v2332'));
    assert.ok(!swText.includes('btc-archive-v2331'));
    assert.ok(!swText.includes('btc-archive-v2330'));
    const notesHtml = fs.readFileSync(path.join(root, 'patch-notes.html'), 'utf8');
    // The Oct 22 card holds the reply bonus, classic Nacho, shoutout, and edu rows.
    const oct22At = notesHtml.indexOf('id="2026-10-22"');
    const nextCard = notesHtml.indexOf('<details class="patch"', oct22At + 1);
    assert.ok(oct22At !== -1 && nextCard > oct22At);
    const oct22 = notesHtml.slice(oct22At, nextCard);
    assert.ok(oct22.includes('October 22, 2026'));
    assert.ok(oct22.includes('Replying to someone in Global Chat can now earn you bonus XP.'));
    assert.ok(oct22.includes('Nacho is back to his classic look everywhere.'));
    assert.ok(notesHtml.includes('Marketplace fixed: you can post, edit, remove and save listings again.'));
    assert.ok(notesHtml.indexOf('Replying to someone in Global Chat can now earn you bonus XP.') < notesHtml.indexOf('Marketplace fixed: you can post, edit, remove and save listings again.'));
    assert.ok(notesHtml.indexOf('Updated education topics with current facts and fixed broken links and images.') < notesHtml.indexOf('Cleaned up the education topics: removed off-topic and unsafe posts.'));
    assert.strictEqual(oct22.includes('24 hours'), false);
    assert.strictEqual(oct22.includes('banned'), false);
    assert.ok(oct22.includes('Nacho now gives a shout in Global Chat when someone starts a new PlebTalk thread or posts a Marketplace listing.'));
    assert.strictEqual(oct22.includes('+50 XP for joining'), false);
    assert.strictEqual(oct22.includes('+25 XP'), false);
});

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
