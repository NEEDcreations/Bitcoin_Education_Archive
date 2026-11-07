#!/usr/bin/env node
// Edit and soft-delete moderation. No emulator. Rewards stay create-only.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mod = require(path.join(root, 'functions', 'src', 'chatModeration'));

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        const ret = fn();
        if (ret && typeof ret.then === 'function') throw new Error('async test was not awaited');
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e.stack || e.message));
        failed++;
    }
}
async function testAsync(name, fn) {
    try {
        await fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e.stack || e.message));
        failed++;
    }
}

function stamp(ms) {
    return { _ms: ms, toMillis: function () { return ms; } };
}

function fakeAdmin() {
    return {
        firestore: {
            FieldValue: { delete: function () { return { __op: 'delete' }; } },
            Timestamp: { fromMillis: function (ms) { return stamp(ms); } },
        },
    };
}

function fakeDb(initial) {
    const docs = new Map();
    Object.keys(initial || {}).forEach(function (key) {
        docs.set(key, Object.assign({}, initial[key]));
    });
    function apply(docPath, data) {
        const next = Object.assign({}, docs.get(docPath) || {});
        Object.keys(data || {}).forEach(function (key) {
            if (data[key] && data[key].__op === 'delete') delete next[key];
            else next[key] = data[key];
        });
        docs.set(docPath, next);
    }
    function ref(docPath) {
        return {
            path: docPath,
            id: docPath.split('/').pop(),
            get: async function () {
                return {
                    exists: docs.has(docPath),
                    id: docPath.split('/').pop(),
                    data: function () { return docs.has(docPath) ? Object.assign({}, docs.get(docPath)) : undefined; },
                };
            },
            set: async function (data) { docs.set(docPath, Object.assign({}, data)); },
            update: async function (data) { apply(docPath, data); },
            delete: async function () { docs.delete(docPath); },
            collection: function (name) { return col(docPath + '/' + name); },
        };
    }
    function valueOf(v) {
        if (v && typeof v.toMillis === 'function') return v.toMillis();
        if (v && v._ms != null) return v._ms;
        return v;
    }
    function col(colPath) {
        const q = { filters: [], limitN: 0, order: null, desc: false };
        const api = {
            where: function (field, op, value) { q.filters.push({ field: field, op: op, value: value }); return api; },
            orderBy: function (field, dir) { q.order = field; q.desc = dir === 'desc'; return api; },
            limit: function (n) { q.limitN = n; return api; },
            doc: function (id) { return ref(colPath + '/' + id); },
            get: async function () {
                let rows = [];
                docs.forEach(function (data, key) {
                    const prefix = colPath + '/';
                    if (!key.startsWith(prefix)) return;
                    if (key.slice(prefix.length).includes('/')) return;
                    for (let i = 0; i < q.filters.length; i++) {
                        const f = q.filters[i];
                        const left = valueOf(data[f.field]);
                        const right = valueOf(f.value);
                        if (f.op === '==' && left !== right) return;
                        if (f.op === '<' && !(left < right)) return;
                    }
                    rows.push({ path: key, data: data });
                });
                if (q.order) {
                    rows.sort(function (a, b) {
                        const av = Number(valueOf(a.data[q.order])) || 0;
                        const bv = Number(valueOf(b.data[q.order])) || 0;
                        return q.desc ? bv - av : av - bv;
                    });
                }
                if (q.limitN) rows = rows.slice(0, q.limitN);
                const out = rows.map(function (row) {
                    return {
                        id: row.path.split('/').pop(),
                        ref: ref(row.path),
                        data: function () { return Object.assign({}, docs.get(row.path)); },
                    };
                });
                return { empty: out.length === 0, size: out.length, docs: out };
            },
        };
        return api;
    }
    return {
        docs: docs,
        collection: function (name) { return col(name); },
        batch: function () {
            const ops = [];
            return {
                delete: function (r) { ops.push(r.path); },
                commit: async function () { ops.forEach(function (p) { docs.delete(p); }); },
            };
        },
        runTransaction: async function (fn) {
            return fn({
                get: function (r) { return r.get(); },
                set: function (r, data) { apply(r.path, data); },
                update: function (r, data) { return r.update(data); },
            });
        },
    };
}

function logs(db) {
    const out = [];
    db.docs.forEach(function (data, key) {
        if (key.indexOf('chat_moderation_log/') === 0) out.push(data);
    });
    return out;
}

test('an 11th edit in the same minute is flagged and the 10th is not', function () {
    let prev = null;
    for (let i = 1; i <= 10; i++) {
        const next = mod.nextRate(prev, 1_000, 'e' + i);
        prev = next.data;
        assert.strictEqual(next.data.flagged, false, 'count ' + i);
    }
    const eleventh = mod.nextRate(prev, 1_000 + 1000, 'e11');
    assert.strictEqual(eleventh.data.count, 11);
    assert.strictEqual(eleventh.data.flagged, true);
    const later = mod.nextRate(eleventh.data, 1_000 + mod.RATE_WINDOW_MS + 5, 'e12');
    assert.strictEqual(later.data.count, 1);
    assert.strictEqual(later.data.flagged, true);
    const again = mod.nextRate(later.data, 2_000, 'e12');
    assert.strictEqual(again.changed, false);
});

test('profanity, scam, and spam are the edit block reasons', function () {
    assert.strictEqual(mod.blockReason('hello friends'), '');
    assert.strictEqual(mod.blockReason('what the fuck'), 'profanity');
    assert.strictEqual(mod.blockReason('double your bitcoin please'), 'scam');
    assert.strictEqual(mod.blockReason('A'.repeat(21)), 'spam');
});

(async function main() {
    const admin = fakeAdmin();
    const now = 1_700_000_000_000;

    function at(ms) { return stamp(ms); }

    await testAsync('a clean edit is logged and the message text stays', async function () {
        const before = { uid: 'u1', text: 'hello there', editCount: 0 };
        const after = { uid: 'u1', text: 'hello there friend', editCount: 1, edited: true, editedAt: at(now) };
        const db = fakeDb({ 'global_chat/m1': after });
        const res = await mod.handleGlobalUpdate(db, admin, 'm1', before, after, now, { eventId: 'evt-clean' });
        assert.strictEqual(res.action, 'edit');
        assert.strictEqual(res.blocked, '');
        assert.strictEqual(db.docs.get('global_chat/m1').text, 'hello there friend');
        const row = logs(db)[0];
        assert.strictEqual(row.before, 'hello there');
        assert.strictEqual(row.after, 'hello there friend');
        assert.strictEqual(row.surface, 'global');
        assert.strictEqual(row.action, 'edit');
        assert.strictEqual(row.uid, 'u1');
        assert.strictEqual(row.expireAt.toMillis(), now + mod.RETENTION_MS);
        assert.ok(Array.from(db.docs.keys()).some(function (key) { return key.indexOf('evt-clean') !== -1 || key.indexOf('evt_clean') !== -1; }));
        assert.strictEqual(db.docs.get('chat_edit_rate/u1').count, 1);
        assert.strictEqual(db.docs.get('chat_edit_rate/u1').flagged, false);
    });

    await testAsync('a profane edit is logged and reverted, and the revert write is ignored', async function () {
        const before = { uid: 'u1', text: 'hello there', editCount: 0, edited: false };
        const after = { uid: 'u1', text: 'hello fuck', editCount: 1, edited: true, editedAt: at(now) };
        const db = fakeDb({ 'global_chat/m1': Object.assign({}, after) });
        const res = await mod.handleGlobalUpdate(db, admin, 'm1', before, after, now, { eventId: 'evt-bad' });
        assert.strictEqual(res.reverted, true);
        assert.strictEqual(res.blocked, 'profanity');
        const restored = db.docs.get('global_chat/m1');
        assert.strictEqual(restored.text, 'hello there');
        assert.strictEqual(restored.editCount, 0);
        assert.strictEqual(restored.filterRemoved, true);
        assert.strictEqual(restored.revertSeq, 1);
        const row = logs(db)[0];
        assert.strictEqual(row.before, 'hello there');
        assert.strictEqual(row.after, 'hello fuck');
        assert.strictEqual(row.blocked, 'profanity');
        const skip = await mod.handleGlobalUpdate(db, admin, 'm1', after, restored, now + 1, { eventId: 'evt-revert' });
        assert.strictEqual(skip.skipped, 'server');
        assert.strictEqual(logs(db).length, 1);
        assert.strictEqual(db.docs.has('chat_edit_rate/u1'), true);
        assert.strictEqual(db.docs.get('chat_edit_rate/u1').count, 1);
    });

    await testAsync('reactions and reply-quote blanks are not new edits', async function () {
        const db = fakeDb({
            'global_chat/m1': { uid: 'u1', text: 'hello there', replyToText: 'old' },
        });
        const before = db.docs.get('global_chat/m1');
        const reacted = Object.assign({}, before, { reactions: { '🔥': ['u2'] } });
        assert.strictEqual((await mod.handleGlobalUpdate(db, admin, 'm1', before, reacted, now)).skipped, 'server');
        const quoted = Object.assign({}, before, { replyToText: 'message deleted' });
        assert.strictEqual((await mod.handleGlobalUpdate(db, admin, 'm1', before, quoted, now)).skipped, 'server');
        assert.strictEqual(logs(db).length, 0);
    });

    await testAsync('a soft delete blanks reply quotes and keeps the doc text empty in the log', async function () {
        const db = fakeDb({
            'global_chat/m1': { uid: 'u1', text: 'hello there' },
            'global_chat/m2': { uid: 'u2', text: 'reply', replyTo: 'm1', replyToText: 'hello there' },
            'global_chat/m3': { uid: 'u3', text: 'other', replyTo: 'm9', replyToText: 'leave me' },
        });
        const before = Object.assign({}, db.docs.get('global_chat/m1'));
        const after = { uid: 'u1', text: '', deleted: true, deletedAt: at(now) };
        db.docs.set('global_chat/m1', Object.assign({}, after));
        const res = await mod.handleGlobalUpdate(db, admin, 'm1', before, after, now, { eventId: 'evt-del' });
        assert.strictEqual(res.action, 'delete');
        assert.strictEqual(logs(db)[0].before, 'hello there');
        assert.strictEqual(logs(db)[0].after, '');
        assert.strictEqual(logs(db)[0].action, 'delete');
        assert.strictEqual(db.docs.get('global_chat/m2').replyToText, 'message deleted');
        assert.strictEqual(db.docs.get('global_chat/m3').replyToText, 'leave me');
        assert.ok(db.docs.has('global_chat/m1'));
    });

    await testAsync('an admin hard delete is logged and quotes are blanked', async function () {
        const db = fakeDb({
            'global_chat/m1': { uid: 'u1', text: 'evidence' },
            'global_chat/m2': { uid: 'u2', replyTo: 'm1', replyToText: 'evidence' },
        });
        const res = await mod.handleGlobalDelete(db, admin, 'm1', db.docs.get('global_chat/m1'), now, { eventId: 'evt-hard' });
        assert.strictEqual(res.hard, true);
        assert.strictEqual(logs(db)[0].action, 'delete');
        assert.strictEqual(logs(db)[0].before, 'evidence');
        assert.strictEqual(db.docs.get('global_chat/m2').replyToText, 'message deleted');
    });

    await testAsync('eleven edits flag the uid and do not take any other action', async function () {
        const db = fakeDb({});
        for (let i = 1; i <= 11; i++) {
            const before = { uid: 'u1', text: 'hello there ' + i, editCount: 0 };
            const after = { uid: 'u1', text: 'hello there ' + i + '!', editCount: 1, editedAt: at(now + i) };
            await mod.handleGlobalUpdate(db, admin, 'm' + i, before, after, now + i, { eventId: 'burst-' + i });
        }
        const rate = db.docs.get('chat_edit_rate/u1');
        assert.strictEqual(rate.count, 11);
        assert.strictEqual(rate.flagged, true);
        assert.strictEqual(Object.keys(Object.fromEntries(db.docs)).filter(function (k) { return k.indexOf('chat_edit_rate/') === 0; }).length, 1);
    });

    await testAsync('the latest DM edit updates lastMessage and an older one does not', async function () {
        const db = fakeDb({
            'dm_conversations/c1': { lastMessage: 'old', lastMessageTime: 1, unread_u2: 3 },
            'dm_conversations/c1/messages/old': { senderUid: 'u1', text: 'old line', createdAt: stamp(100) },
            'dm_conversations/c1/messages/new': { senderUid: 'u1', text: 'latest line', createdAt: stamp(200) },
        });
        await mod.handleDmUpdate(db, admin, 'c1', 'old', { senderUid: 'u1', text: 'old line', editCount: 0 }, { senderUid: 'u1', text: 'old line edited', editCount: 1, editedAt: at(now) }, now, { eventId: 'dm-old' });
        assert.strictEqual(db.docs.get('dm_conversations/c1').lastMessage, 'old');
        assert.strictEqual(db.docs.get('dm_conversations/c1').unread_u2, 3);
        const res = await mod.handleDmUpdate(db, admin, 'c1', 'new', { senderUid: 'u1', text: 'latest line', editCount: 0 }, { senderUid: 'u1', text: 'latest line edited', editCount: 1, editedAt: at(now + 1) }, now, { eventId: 'dm-new' });
        assert.strictEqual(res.preview.lastMessage, 'latest line edited');
        assert.strictEqual(db.docs.get('dm_conversations/c1').lastMessageTime, 1);
        const deleted = { senderUid: 'u1', text: '', deleted: true, deletedAt: at(now + 2), editCount: 1 };
        await mod.handleDmUpdate(db, admin, 'c1', 'new', { senderUid: 'u1', text: 'latest line edited', editCount: 1 }, deleted, now + 1, { eventId: 'dm-del' });
        assert.strictEqual(db.docs.get('dm_conversations/c1').lastMessage, 'Message deleted');
        assert.strictEqual(logs(db).filter(function (row) { return row.surface === 'dm'; }).length, 3);
    });

    await testAsync('a Nacho message is not reverted', async function () {
        const db = fakeDb({
            'global_chat/egg': { uid: 'nacho-bot', text: 'hello there', isNachoAuto: true },
        });
        const before = Object.assign({}, db.docs.get('global_chat/egg'));
        const after = { uid: 'nacho-bot', text: 'hello fuck', isNachoAuto: true, editCount: 1, editedAt: at(now) };
        const res = await mod.handleGlobalUpdate(db, admin, 'egg', before, after, now, { eventId: 'egg' });
        assert.strictEqual(res.skipped, 'protected');
        assert.strictEqual(db.docs.get('global_chat/egg').text, 'hello there');
        assert.strictEqual(logs(db).length, 0);
        assert.strictEqual(db.docs.has('chat_edit_rate/nacho-bot'), false);
    });

    await testAsync('purge removes logs whose 90-day field has passed', async function () {
        const db = fakeDb({
            'chat_moderation_log/old': { uid: 'u1', expireAt: stamp(now - 1000), before: 'x' },
            'chat_moderation_log/fresh': { uid: 'u1', expireAt: stamp(now + 1000), before: 'y' },
        });
        const res = await mod.purgeExpired(db, admin, now);
        assert.strictEqual(res.removed, 1);
        assert.strictEqual(db.docs.has('chat_moderation_log/old'), false);
        assert.strictEqual(db.docs.get('chat_moderation_log/fresh').before, 'y');
    });

    await testAsync('account deletion and mention scrubbing are not edits', async function () {
        const db = fakeDb({
            'global_chat/m1': { uid: 'u1', text: 'hello there', name: 'Phil' },
            'global_chat/m2': { uid: 'u2', text: 'hi @Phil', mentionUid: 'u1' },
        });
        const tombBefore = { uid: 'u1', text: 'hello there', name: 'Phil' };
        const tombAfter = { uid: 'deleted', text: '[deleted]', name: '[deleted]', deleted: true };
        const tomb = await mod.handleGlobalUpdate(db, admin, 'm1', tombBefore, tombAfter, now, { eventId: 'acct' });
        assert.strictEqual(tomb.skipped, 'server');
        const scrubBefore = { uid: 'u2', text: 'hi @Phil', mentionUid: 'u1' };
        const scrubAfter = { uid: 'u2', text: 'hi @[deleted]', mentionUid: '' };
        db.docs.set('global_chat/m1', Object.assign({}, tombAfter));
        db.docs.set('global_chat/m2', Object.assign({}, scrubAfter));
        const scrub = await mod.handleGlobalUpdate(db, admin, 'm2', scrubBefore, scrubAfter, now, { eventId: 'scrub' });
        assert.strictEqual(scrub.skipped, 'server');
        assert.strictEqual(logs(db).length, 0);
        assert.strictEqual(Array.from(db.docs.keys()).some(function (key) { return key.indexOf('chat_edit_rate/') === 0; }), false);
        assert.strictEqual(db.docs.get('global_chat/m1').text, '[deleted]');
        assert.strictEqual(db.docs.get('global_chat/m1').uid, 'deleted');
        assert.strictEqual(db.docs.get('global_chat/m2').text, 'hi @[deleted]');
        const hard = await mod.handleGlobalDelete(db, admin, 'm1', tombAfter, now, { eventId: 'hard-deleted' });
        assert.strictEqual(hard.skipped, 'deleted-account');
        assert.strictEqual(logs(db).length, 0);
    });

    await testAsync('a revert skips when a later edit already landed, and a dirty previous text is blanked', async function () {
        const firstBefore = { uid: 'u1', text: 'hello there', editCount: 0 };
        const firstAfter = { uid: 'u1', text: 'hello fuck', editCount: 1, editedAt: at(now) };
        const later = { uid: 'u1', text: 'hello shit', editCount: 2, editedAt: at(now + 5) };
        const db = fakeDb({ 'global_chat/m1': later });
        const raced = await mod.handleGlobalUpdate(db, admin, 'm1', firstBefore, firstAfter, now, { eventId: 'race' });
        assert.strictEqual(raced.reverted, false);
        assert.strictEqual(raced.revert.skipped, 'changed');
        assert.strictEqual(db.docs.get('global_chat/m1').text, 'hello shit');
        const dirtyBefore = { uid: 'u1', text: 'hello fuck', editCount: 1, editedAt: at(now) };
        db.docs.set('global_chat/m1', Object.assign({}, later));
        const blanked = await mod.handleGlobalUpdate(db, admin, 'm1', dirtyBefore, later, now + 5, { eventId: 'blank' });
        assert.strictEqual(blanked.reverted, true);
        assert.strictEqual(blanked.revert.blanked, true);
        assert.strictEqual(db.docs.get('global_chat/m1').text, '');
        assert.strictEqual(db.docs.get('global_chat/m1').filterRemoved, true);
    });

    await testAsync('soft delete removes a chat-images or dm-images object and ignores other urls', async function () {
        const image = 'https://firebasestorage.googleapis.com/v0/b/bitcoin-education-archive.firebasestorage.app/o/chat-images%2Fu1%2Fpic.jpg?alt=media&token=abc';
        const tenor = 'https://media.tenor.com/x.gif';
        const removed = [];
        const before = { uid: 'u1', text: 'cap', imageUrl: image, gifUrl: tenor, caption: 'cap' };
        const after = { uid: 'u1', text: '', imageUrl: '', gifUrl: '', caption: '', deleted: true, deletedAt: at(now) };
        const db = fakeDb({ 'global_chat/m1': Object.assign({}, after) });
        const res = await mod.handleGlobalUpdate(db, admin, 'm1', before, after, now, {
            eventId: 'media',
            deleteFile: async function (path) { removed.push(path); },
        });
        assert.deepStrictEqual(removed, ['chat-images/u1/pic.jpg']);
        assert.deepStrictEqual(res.removed, ['chat-images/u1/pic.jpg']);
        const dmUrl = 'https://bitcoin-education-archive.firebasestorage.app/dm-images/u1/a.png?alt=media';
        const dmBefore = { senderUid: 'u1', text: '', imageUrl: dmUrl };
        const dmAfter = { senderUid: 'u1', text: '', imageUrl: '', deleted: true, deletedAt: at(now) };
        const dm = fakeDb({
            'dm_conversations/c1': { lastMessage: 'pic' },
            'dm_conversations/c1/messages/m': Object.assign({ createdAt: at(now) }, dmAfter),
        });
        const gone = [];
        await mod.handleDmUpdate(dm, admin, 'c1', 'm', dmBefore, dmAfter, now, {
            eventId: 'dm-media',
            deleteFile: async function (path) { gone.push(path); },
        });
        assert.deepStrictEqual(gone, ['dm-images/u1/a.png']);
        assert.strictEqual(mod.storageObjectPath('https://media.tenor.com/x.gif'), '');
    });

    test('rewards stay on create and the new triggers do not grant them', function () {
        const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
        const src = fs.readFileSync(path.join(root, 'functions', 'src', 'chatModeration.js'), 'utf8');
        const mirror = fs.readFileSync(path.join(root, 'functions', 'src', 'chatTelegramMirror.js'), 'utf8');
        const chat = fs.readFileSync(path.join(root, 'global-chat.js'), 'utf8');
        const dm = fs.readFileSync(path.join(root, 'messaging.js'), 'utf8');
        const privacy = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');
        const claims = fs.readFileSync(path.join(root, 'functions', 'src', 'claimReqs.js'), 'utf8');
        assert.ok(index.includes('exports.onGlobalChatEdited = onDocumentUpdated'));
        assert.ok(index.includes('exports.onDmMessageEdited = onDocumentUpdated'));
        assert.ok(index.includes('exports.onGlobalChatHardDeleted = onDocumentDeleted'));
        assert.ok(index.includes('exports.purgeChatModerationLog = onSchedule'));
        assert.ok(index.includes('exports.onChatMessageCreated = onDocumentCreated'));
        assert.ok(index.includes('exports.onDmMessageCreated = onDocumentCreated'));
        assert.ok(index.includes('exports.onChatBadgeCount = onDocumentCreated'));
        assert.ok(index.includes('exports.onDmBadgeCount = onDocumentCreated'));
        assert.ok(index.includes('exports.onGlobalChatEasterEgg = onDocumentCreated'));
        ['awardPoints', 'claimReplyBonus', 'recordChat', 'recordDm', 'grantServerTickets', 'handle('].forEach(function (name) {
            assert.strictEqual(src.includes(name), false, name);
        });
        assert.ok(mirror.includes('src.deleted === true'));
        assert.ok(chat.includes('window.saveChatEdit'));
        assert.ok(chat.includes('window.softDeleteChatMsg'));
        assert.ok(chat.includes('CHAT_EDIT_CAP = 5'));
        assert.ok(chat.includes('15 * 60 * 1000'));
        assert.ok(chat.includes('🚫 message deleted'));
        assert.strictEqual(chat.includes("prompt('Edit your message:"), false);
        assert.ok(dm.includes('window.beginDmEdit'));
        assert.ok(dm.includes('window.deleteDmMsg'));
        assert.ok(dm.includes('DM_EDIT_MAX = 1000'));
        assert.ok(dm.includes('🚫 message deleted'));
        assert.ok(privacy.includes('Edited and deleted chat and direct messages are kept for up to 90 days for moderation and safety, then removed.'));
        assert.ok(claims.includes('msg.deleted === true'));
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})().catch(function (e) {
    console.error(e);
    process.exit(1);
});
