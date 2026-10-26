// GGs and global chat are mirrored to Telegram once. No Firebase.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mirror = require('../functions/src/chatTelegramMirror');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) {
    try {
        const out = fn();
        if (out && typeof out.then === 'function') {
            queue.push(out.then(function () {
                console.log('✅ ' + name);
                passed++;
            }, function (e) {
                console.log('❌ ' + name + ': ' + e.message);
                failed++;
            }));
            return;
        }
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

function memoryDb(seed) {
    const docs = Object.assign({}, seed || {});
    let chain = Promise.resolve();
    function clone(data) {
        const copy = {};
        Object.keys(data || {}).forEach(function (key) {
            const value = data[key];
            if (Array.isArray(value)) copy[key] = value.slice();
            else if (value && typeof value === 'object') copy[key] = Object.assign({}, value);
            else copy[key] = value;
        });
        return copy;
    }
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
                data: function () { return clone(docs[p]); },
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
            get: async function () {
                const data = docs[docPath];
                return {
                    exists: data != null,
                    id: docPath.split('/').pop(),
                    data: function () { return data ? clone(data) : undefined; },
                };
            },
        };
    }
    function collectionAt(prefix) {
        return {
            path: prefix,
            doc: function (id) { return ref(prefix + '/' + id); },
            where: function (field, op, value) {
                const filters = [{ field: field, op: op, value: value }];
                const query = {
                    _limit: 0,
                    where: function (nextField, nextOp, nextValue) {
                        filters.push({ field: nextField, op: nextOp, value: nextValue });
                        return query;
                    },
                    _order: 'nextAttemptAt',
                    orderBy: function (field) { query._order = field || query._order; return query; },
                    limit: function (n) { query._limit = n; return query; },
                    get: async function () {
                        let list = rowsUnder(prefix).filter(function (doc) {
                            const data = doc.data();
                            return filters.every(function (filter) {
                                const left = data[filter.field];
                                if (filter.op === '==') return left === filter.value;
                                if (filter.op === '<') return Number(left) < Number(filter.value);
                                if (filter.op === '<=') return Number(left) <= Number(filter.value);
                                return false;
                            });
                        });
                        const orderField = query._order || 'nextAttemptAt';
                        list.sort(function (a, b) {
                            return (Number(a.data()[orderField]) || 0) - (Number(b.data()[orderField]) || 0);
                        });
                        if (query._limit) list = list.slice(0, query._limit);
                        return pack(list);
                    },
                };
                return query;
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
                    set: function (r, data) { staged.push({ path: r.path, data: clone(data), merge: false }); },
                    update: function (r, data) { staged.push({ path: r.path, data: clone(data), merge: true }); },
                };
                const result = await fn(t);
                staged.forEach(function (w) {
                    if (w.merge) docs[w.path] = Object.assign({}, docs[w.path], w.data);
                    else docs[w.path] = w.data;
                });
                return result;
            });
            chain = run.then(function () { return null; }, function () { return null; });
            return run;
        },
    };
}

function msg(extra) {
    return Object.assign({ uid: 'user_pat', name: 'Pat', text: 'hello' }, extra || {});
}

test('a chat doc is forwarded once and a retry does not send again', async function () {
    const now = 1700000000000;
    const db = memoryDb({
        'global_chat/m1': msg(),
    });
    const calls = [];
    const token = 'test-token-value';
    const options = {
        token: token,
        chatId: '-1003827558565',
        log: function (line) { calls.push('log:' + line); },
        fetch: async function (url, init) {
            calls.push(init.body);
            calls.usedToken = url.indexOf(token) !== -1;
            return {
                ok: true,
                status: 200,
                json: async function () {
                    return { ok: true, result: { message_id: 77, chat: { id: -1003827558565 } } };
                },
            };
        },
    };
    const first = await mirror.enqueueChatMirror(db, 'global_chat', 'm1', msg(), null, now);
    const second = await mirror.enqueueChatMirror(db, 'global_chat', 'm1', msg(), null, now + 1);
    assert.strictEqual(first.queued, true);
    assert.strictEqual(second.queued, false);
    assert.strictEqual(second.reason, 'claimed');
    assert.strictEqual(db.docs['telegram_mirror_claims/global_chat__m1'].status, 'queued');
    const flushed = await mirror.flushTelegramMirror(db, now, options);
    assert.strictEqual(flushed.sent, 1);
    const bodies = calls.filter(function (row) { return row.charAt(0) === '{'; });
    assert.strictEqual(bodies.length, 1);
    const sent = JSON.parse(bodies[0]);
    assert.strictEqual(sent.parse_mode, 'HTML');
    assert.strictEqual(sent.chat_id, '-1003827558565');
    assert.strictEqual(sent.text, '[Global] Pat: hello');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(sent, 'photo'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(sent, 'image'), false);
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__m1'].status, 'sent');
    assert.strictEqual(db.docs['global_chat/m1'].telegramMirrored, true);
    assert.strictEqual(db.docs['global_chat/m1'].telegramMsgId, '77');
    assert.strictEqual(db.docs['global_chat/m1'].telegramBatched, undefined);
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__m1'].uid, 'user_pat');
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__m1'].expireAtMs, now + mirror.RETAIN_MS);
    assert.ok(sent.text.indexOf('user_pat') === -1);
    const again = await mirror.flushTelegramMirror(db, now + 10, options);
    assert.strictEqual(again.sent, 0);
    assert.strictEqual(bodies.length, 1);
    assert.strictEqual(calls.usedToken, true);
    assert.ok(calls.filter(function (row) { return typeof row === 'string'; }).join('\n').indexOf(token) === -1);
});

test('telegram-sourced, deleted, moderated, and DM docs are not forwarded', async function () {
    const now = 1700000000000;
    const cases = [
        { id: 'tg', data: msg({ source: 'telegram', text: 'from telegram' }), reason: 'telegram' },
        { id: 'del', data: msg({ deleted: true }), reason: 'deleted' },
        { id: 'gone', data: msg({ uid: 'deleted', text: 'removed' }), reason: 'deleted' },
        { id: 'hide', data: msg({ hidden: true }), reason: 'hidden' },
        { id: 'flag', data: msg({ flagged: true }), reason: 'moderated' },
        { id: 'mod', data: msg({ moderationRejected: true }), reason: 'moderated' },
        { id: 'spam', data: msg({ spam: true }), reason: 'moderated' },
        { id: 'dm', data: msg({ dm: true, text: 'secret dm' }), reason: 'private' },
        { id: 'ops', data: msg({ adminOnly: true }), reason: 'private' },
        { id: 'alert', data: msg({ type: 'alert', text: 'internal' }), reason: 'private' },
    ];
    const db = memoryDb();
    for (let i = 0; i < cases.length; i++) {
        const row = cases[i];
        const result = await mirror.enqueueChatMirror(db, 'global_chat', row.id, row.data, null, now);
        assert.strictEqual(result.queued, false, row.id);
        assert.strictEqual(result.reason, row.reason, row.id);
        assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__' + row.id], undefined, row.id);
    }
    const dmCol = mirror.decideMirror({ collection: 'dm_conversations', data: msg({ text: 'dm body' }) });
    assert.strictEqual(dmCol.forward, false);
    assert.strictEqual(dmCol.reason, 'collection');
    db.docs['users/shade'] = { username: 'Shade', shadowbanned: true };
    const shaded = await mirror.handleChatMirror(db, 'global_chat', 'shade2', msg({ uid: 'shade', name: 'Shade', text: 'hidden life' }), now);
    assert.strictEqual(shaded.reason, 'shadowbanned');
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__shade2'], undefined);
    db.docs['users/blocked'] = { username: 'B', blocked: true };
    const blocked = await mirror.handleChatMirror(db, 'announcements', 'b1', {
        uid: 'blocked', name: 'B', text: 'nope',
    }, now);
    assert.strictEqual(blocked.reason, 'blocked');
    db.docs['users/muted'] = { username: 'M', chatMuted: true };
    const muted = await mirror.handleChatMirror(db, 'global_chat', 'mute1', msg({ uid: 'muted', name: 'M' }), now);
    assert.strictEqual(muted.reason, 'muted');
});

test('lines are escaped and do not carry pings, contacts, uids, or uploads', function () {
    const uid = 'user_pat_12345';
    const decision = mirror.decideMirror({
        collection: 'announcements',
        data: {
            uid: 'nacho-bot',
            name: '<img src=x onerror=alert(1)>',
            text: '<script>alert(1)</script> @everyone fish & chips pat@mail.com 8.8.8.8 ' + uid + ' [click](javascript:alert(1))',
            mentionUid: uid,
        },
    });
    assert.strictEqual(decision.forward, true);
    assert.ok(decision.line.indexOf('[GGs] ') === 0);
    assert.ok(decision.line.indexOf('🦌 Nacho') !== -1);
    assert.ok(decision.line.indexOf('<') === -1);
    assert.ok(decision.line.indexOf('>') === -1);
    assert.ok(decision.line.indexOf('@everyone') === -1);
    assert.ok(decision.line.indexOf('everyone') !== -1);
    assert.ok(decision.line.indexOf('&amp;') !== -1);
    assert.ok(decision.line.indexOf('pat@mail.com') === -1);
    assert.ok(decision.line.indexOf('8.8.8.8') === -1);
    assert.ok(decision.line.indexOf(uid) === -1);
    assert.ok(decision.line.indexOf('javascript') === -1);
    assert.ok(decision.line.indexOf('mentionUid') === -1);

    const image = mirror.decideMirror({
        collection: 'global_chat',
        data: msg({
            text: 'look',
            imageBase64: 'QUJD' + 'A'.repeat(120),
            imageUrl: 'https://api.telegram.org/file/bot12345:SECRETTOKEN/photo.jpg',
        }),
    });
    assert.ok(image.line.indexOf('[image]') !== -1);
    assert.ok(image.line.indexOf('SECRETTOKEN') === -1);
    assert.ok(image.line.indexOf('QUJD') === -1);

    const link = mirror.decideMirror({
        collection: 'global_chat',
        data: msg({
            text: 'https://media.giphy.com/media/abc/giphy.gif',
            isGif: true,
            gifUrl: 'https://media.giphy.com/media/abc/giphy.gif',
        }),
    });
    assert.ok(link.line.indexOf('https://media.giphy.com/media/abc/giphy.gif') !== -1);
    assert.ok(link.line.indexOf('[image]') === -1);

    const signed = mirror.decideMirror({
        collection: 'global_chat',
        data: msg({
            text: '',
            imageUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg?alt=media&token=sekret',
        }),
    });
    assert.ok(signed.line.indexOf('[image]') !== -1);
    assert.ok(signed.line.indexOf('sekret') === -1);
});

test('a burst is one Telegram message and a full minute stays queued', async function () {
    const now = 1700000000000;
    const db = memoryDb();
    const bodies = [];
    const options = {
        token: 'test-token-value',
        chatId: '-1003827558565',
        log: function () {},
        fetch: async function (_url, init) {
            bodies.push(JSON.parse(init.body).text);
            return {
                ok: true,
                status: 200,
                json: async function () {
                    return { ok: true, result: { message_id: 9, chat: { id: -1003827558565 } } };
                },
            };
        },
    };
    for (let i = 0; i < 25; i++) {
        const id = 'b' + i;
        db.docs['global_chat/' + id] = msg({ uid: 'user_burst_' + i, text: 'line ' + i });
        const queued = await mirror.enqueueChatMirror(db, 'global_chat', id, db.docs['global_chat/' + id], null, now + i);
        assert.strictEqual(queued.queued, true, id);
    }
    const flushed = await mirror.flushTelegramMirror(db, now + 24, options);
    assert.strictEqual(flushed.sent, 1);
    assert.strictEqual(bodies.length, 1);
    assert.strictEqual(bodies[0].split('\n').length, 25);
    assert.ok(bodies[0].indexOf('[Global] Pat: line 0') !== -1);
    assert.ok(bodies[0].indexOf('[Global] Pat: line 24') !== -1);
    for (let i = 0; i < 25; i++) {
        const queuedRow = db.docs['telegram_mirror_queue/global_chat__b' + i];
        const source = db.docs['global_chat/b' + i];
        assert.strictEqual(queuedRow.status, 'sent');
        assert.strictEqual(queuedRow.telegramMsgId, undefined);
        assert.strictEqual(source.telegramBatched, true);
        assert.strictEqual(source.telegramMsgId, undefined);
    }

    const capped = memoryDb({
        'telegram_mirror_state/group': { sentAtMs: Array(mirror.MAX_SENDS_PER_MINUTE).fill(now - 1000) },
    });
    capped.docs['global_chat/hold'] = msg({ text: 'wait' });
    await mirror.enqueueChatMirror(capped, 'global_chat', 'hold', capped.docs['global_chat/hold'], null, now);
    const held = await mirror.flushTelegramMirror(capped, now, options);
    assert.strictEqual(held.sent, 0);
    assert.strictEqual(capped.docs['telegram_mirror_queue/global_chat__hold'].status, 'pending');
    assert.ok(held.waitUntil > now);

    const wide = memoryDb();
    const wideBodies = [];
    const wideOpts = {
        token: 'test-token-value',
        chatId: '-100',
        log: function () {},
        fetch: async function (_url, init) {
            wideBodies.push(JSON.parse(init.body).text);
            return {
                ok: true,
                status: 200,
                json: async function () { return { ok: true, result: { message_id: 3, chat: { id: -100 } } }; },
            };
        },
    };
    for (let i = 0; i < 8; i++) {
        const text = 'W' + String(i) + 'x'.repeat(998);
        wide.docs['announcements/w' + i] = { uid: 'nacho-bot', name: '🦌 Nacho', text: text };
        await mirror.enqueueChatMirror(wide, 'announcements', 'w' + i, wide.docs['announcements/w' + i], null, now + i);
    }
    const wideFlush = await mirror.flushTelegramMirror(wide, now + 7, wideOpts);
    assert.strictEqual(wideFlush.sent, 3);
    assert.strictEqual(wideBodies.length, 3);
    for (let i = 0; i < 8; i++) {
        assert.strictEqual(wide.docs['telegram_mirror_queue/announcements__w' + i].status, 'sent', 'w' + i);
    }
});

test('a 429 keeps the batch queued with backoff', async function () {
    const now = 1700000000000;
    const db = memoryDb({ 'global_chat/rate1': msg({ text: 'slow' }) });
    await mirror.enqueueChatMirror(db, 'global_chat', 'rate1', db.docs['global_chat/rate1'], null, now);
    const logs = [];
    const token = 'test-token-value';
    const result = await mirror.flushTelegramMirror(db, now, {
        token: token,
        chatId: '-100',
        log: function (line) { logs.push(line); },
        fetch: async function () {
            return {
                ok: false,
                status: 429,
                json: async function () {
                    return { ok: false, error_code: 429, parameters: { retry_after: 3 } };
                },
            };
        },
    });
    assert.strictEqual(result.sent, 0);
    const row = db.docs['telegram_mirror_queue/global_chat__rate1'];
    assert.strictEqual(row.status, 'pending');
    assert.strictEqual(row.attempts, 1);
    assert.ok(row.nextAttemptAt >= now + 3000);
    assert.strictEqual(mirror.backoffMs(1, 3), 3000);
    const early = await mirror.flushTelegramMirror(db, now + 1000, {
        token: token,
        chatId: '-100',
        log: function () {},
        fetch: async function () { throw new Error('should not send before backoff'); },
    });
    assert.strictEqual(early.sent, 0);
    assert.ok(logs.join('\n').indexOf(token) === -1);
    const src = fs.readFileSync(path.join(root, 'functions', 'src', 'chatTelegramMirror.js'), 'utf8');
    assert.strictEqual(src.indexOf('console.log'), -1);
    assert.ok(src.indexOf("console.error('[TG MIRROR] hold ' + code)") !== -1);
    assert.strictEqual((src.match(/console\.error/g) || []).length, 1);
    assert.strictEqual(src.indexOf('ops alert'), -1);
});

test('clients and the callable do not post, and mirror collections are server-only', function () {
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    const gc = fs.readFileSync(path.join(root, 'global-chat.js'), 'utf8');
    const favor = fs.readFileSync(path.join(root, 'satoshi-favor.js'), 'utf8');
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    assert.strictEqual(gc.indexOf('bridgeToTelegram'), -1);
    assert.strictEqual(favor.indexOf('bridgeToTelegram'), -1);
    assert.ok(index.indexOf('exports.onGlobalChatTelegram') !== -1);
    assert.ok(index.indexOf('exports.onAnnouncementsTelegram') !== -1);
    assert.ok(index.indexOf('exports.flushTelegramMirror') !== -1);
    assert.ok(index.indexOf('exports.onGlobalChatTelegramDeleted') !== -1);
    assert.ok(index.indexOf('exports.onAnnouncementsTelegramUpdated') !== -1);
    assert.strictEqual(index.indexOf("handleChatMirror(db, 'dm_conversations'"), -1);
    assert.ok(index.indexOf("skipped: 'server_mirror'") !== -1);
    ['telegram_mirror_claims', 'telegram_mirror_queue', 'telegram_mirror_state'].forEach(function (name) {
        const at = rules.indexOf('match /' + name + '/');
        const block = rules.slice(at, at + 120);
        assert.ok(at !== -1, name);
        assert.ok(block.indexOf('allow read, write: if false') !== -1, name);
    });
    assert.strictEqual(mirror.DEFAULT_CHAT_ID, '-1003827558565');
    assert.strictEqual(mirror.MAX_SENDS_PER_MINUTE, 20);
});

function loneSurrogate(text) {
    return /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(text) || /(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text);
}

test('truncation keeps whole emoji and does not split a surrogate', function () {
    const split = 'x'.repeat(3498) + '😀' + 'y';
    const clipped = mirror.clipLine(split);
    assert.ok(clipped.length <= mirror.MAX_BATCH_CHARS);
    assert.strictEqual(loneSurrogate(clipped), false);
    assert.strictEqual(Buffer.from(clipped, 'utf8').toString('utf8'), clipped);
    const body = 'a'.repeat(999) + '😀';
    const decision = mirror.decideMirror({
        collection: 'global_chat',
        data: msg({ text: body }),
    });
    assert.strictEqual(decision.forward, true);
    assert.strictEqual(loneSurrogate(decision.line), false);
    assert.strictEqual(decision.line.indexOf('\uD83D'), decision.line.indexOf('😀'));
    const family = '👨‍👩‍👧‍👦';
    const familyLine = mirror.clipUnits('b'.repeat(999) + family, 1000);
    assert.strictEqual(loneSurrogate(familyLine), false);
    assert.ok(familyLine === 'b'.repeat(999) || familyLine.indexOf(family) !== -1);
    assert.ok(familyLine.indexOf('\u200D') === -1 || familyLine.indexOf(family) !== -1);
});

test('profanity and scam text are not forwarded', async function () {
    const now = 1700000000000;
    const cases = [
        { id: 'bad', text: 'fuck you scam send btc to bc1qexample', reason: 'profanity' },
        { id: 'scam', text: 'please send me 5 btc today', reason: 'scam' },
        { id: 'wallet', text: 'send sats to bc1qexampleaddress', reason: 'scam' },
    ];
    const db = memoryDb();
    for (let i = 0; i < cases.length; i++) {
        const row = cases[i];
        const decision = mirror.decideMirror({ collection: 'global_chat', data: msg({ text: row.text }) });
        assert.strictEqual(decision.forward, false, row.id);
        assert.strictEqual(decision.reason, row.reason, row.id);
        const queued = await mirror.enqueueChatMirror(db, 'global_chat', row.id, msg({ text: row.text }), null, now);
        assert.strictEqual(queued.queued, false, row.id);
        assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__' + row.id], undefined, row.id);
    }
});

test('the same user is limited to one line per 3s and ten per minute', async function () {
    const now = 1700000000000;
    const db = memoryDb();
    const first = await mirror.enqueueChatMirror(db, 'global_chat', 'r0', msg({ text: 'one' }), null, now);
    assert.strictEqual(first.queued, true);
    const fast = await mirror.enqueueChatMirror(db, 'global_chat', 'r1', msg({ text: 'two' }), null, now + 1000);
    assert.strictEqual(fast.queued, false);
    assert.strictEqual(fast.reason, 'rate');
    let at = now;
    let queued = 1;
    for (let i = 1; i < 12; i++) {
        at += mirror.USER_GAP_MS;
        const result = await mirror.enqueueChatMirror(db, 'global_chat', 'm' + i, msg({ text: 'n' + i }), null, at);
        if (result.queued) queued += 1;
        else assert.strictEqual(result.reason, 'rate');
    }
    assert.strictEqual(queued, mirror.USER_MAX_PER_MINUTE);
    const nacho = await mirror.enqueueChatMirror(db, 'announcements', 'n1', {
        uid: 'nacho-bot', name: '🦌 Nacho', text: 'server one',
    }, null, now);
    const nacho2 = await mirror.enqueueChatMirror(db, 'announcements', 'n2', {
        uid: 'nacho-bot', name: '🦌 Nacho', text: 'server two',
    }, null, now + 10);
    assert.strictEqual(nacho.queued, true);
    assert.strictEqual(nacho2.queued, true);
});

test('a 400 batch is split and a poison line fails without blocking the rest', async function () {
    const now = 1700000000000;
    const db = memoryDb({
        'global_chat/good': msg({ uid: 'user_good', text: 'hello there' }),
        'global_chat/bad': msg({ uid: 'user_bad', text: 'BADLINE' }),
    });
    await mirror.enqueueChatMirror(db, 'global_chat', 'good', db.docs['global_chat/good'], null, now);
    await mirror.enqueueChatMirror(db, 'global_chat', 'bad', db.docs['global_chat/bad'], null, now + mirror.USER_GAP_MS);
    const calls = [];
    const result = await mirror.flushTelegramMirror(db, now + mirror.USER_GAP_MS, {
        token: 'test-token-value',
        chatId: '-100',
        log: function () {},
        fetch: async function (_url, init) {
            const text = JSON.parse(init.body).text;
            calls.push(text);
            if (text.indexOf('\n') !== -1 || text.indexOf('BADLINE') !== -1) {
                return { ok: false, status: 400, json: async function () { return { ok: false, error_code: 400 }; } };
            }
            return { ok: true, status: 200, json: async function () { return { ok: true, result: { message_id: 5, chat: { id: -100 } } }; } };
        },
    });
    assert.ok(result.sent >= 1);
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__good'].status, 'sent');
    assert.strictEqual(db.docs['global_chat/good'].telegramMsgId, '5');
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__bad'].status, 'failed');
    assert.ok(db.docs['telegram_mirror_queue/global_chat__bad'].lastError);
    db.docs['global_chat/next'] = msg({ uid: 'user_next', text: 'still going' });
    const later = await mirror.enqueueChatMirror(db, 'global_chat', 'next', db.docs['global_chat/next'], null, now + 60000);
    assert.strictEqual(later.queued, true);
    const follow = await mirror.flushTelegramMirror(db, now + 60000, {
        token: 'test-token-value',
        chatId: '-100',
        log: function () {},
        fetch: async function () {
            return { ok: true, status: 200, json: async function () { return { ok: true, result: { message_id: 6, chat: { id: -100 } } }; } };
        },
    });
    assert.strictEqual(follow.sent, 1);
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__bad'].status, 'failed');
    assert.ok(calls.length >= 2);
});

test('retryable sends stop after five attempts', async function () {
    const now = 1700000000000;
    const db = memoryDb({ 'global_chat/retry': msg({ text: 'again' }) });
    await mirror.enqueueChatMirror(db, 'global_chat', 'retry', db.docs['global_chat/retry'], null, now);
    const options = {
        token: 'test-token-value',
        chatId: '-100',
        log: function () {},
        fetch: async function () {
            return { ok: false, status: 500, json: async function () { return { ok: false, error_code: 500 }; } };
        },
    };
    let at = now;
    for (let i = 0; i < mirror.MAX_ATTEMPTS - 1; i++) {
        await mirror.flushTelegramMirror(db, at, options);
        const row = db.docs['telegram_mirror_queue/global_chat__retry'];
        assert.strictEqual(row.status, 'pending', 'attempt ' + (i + 1));
        at = row.nextAttemptAt;
    }
    await mirror.flushTelegramMirror(db, at, options);
    const failed = db.docs['telegram_mirror_queue/global_chat__retry'];
    assert.strictEqual(failed.status, 'failed');
    assert.strictEqual(failed.attempts, mirror.MAX_ATTEMPTS);
    assert.ok(failed.lastError);
    let called = false;
    await mirror.flushTelegramMirror(db, at + 999999, {
        token: 'test-token-value',
        chatId: '-100',
        log: function () {},
        fetch: async function () { called = true; return { ok: true, status: 200, json: async function () { return { ok: true }; } }; },
    });
    assert.strictEqual(called, false);
});

test('a hung send aborts and the lease outlasts the timeout', async function () {
    assert.ok(mirror.SENDING_LEASE_MS > mirror.SEND_TIMEOUT_MS);
    const now = 1700000000000;
    const db = memoryDb({ 'global_chat/slow': msg({ text: 'slow line' }) });
    await mirror.enqueueChatMirror(db, 'global_chat', 'slow', db.docs['global_chat/slow'], null, now);
    const result = await mirror.flushTelegramMirror(db, now, {
        token: 'test-token-value',
        chatId: '-100',
        timeoutMs: 20,
        log: function () {},
        fetch: function (_url, init) {
            return new Promise(function (_resolve, reject) {
                const timer = setTimeout(function () { reject(new Error('hung')); }, 1000);
                if (init && init.signal) {
                    init.signal.addEventListener('abort', function () {
                        clearTimeout(timer);
                        const err = new Error('aborted');
                        err.name = 'AbortError';
                        reject(err);
                    });
                }
            });
        },
    });
    assert.strictEqual(result.sent, 0);
    const row = db.docs['telegram_mirror_queue/global_chat__slow'];
    assert.strictEqual(row.status, 'pending');
    assert.ok(row.attempts >= 1);
});

test('already mirrored docs and Nacho twins are not queued twice', async function () {
    const now = 1700000000000;
    const db = memoryDb();
    const stamped = msg({ text: 'already out', telegramMirrored: true, telegramMsgId: '44' });
    const skipped = await mirror.enqueueChatMirror(db, 'global_chat', 'old', stamped, null, now);
    assert.strictEqual(skipped.reason, 'already_mirrored');
    const block = '⛏️ BLOCK FOUND! ⚡\n\n@Pat solved a block';
    const globalCopy = await mirror.enqueueChatMirror(db, 'global_chat', 'win', {
        uid: 'nacho-bot', name: '🦌 Nacho', text: block,
    }, null, now);
    const ggsCopy = await mirror.enqueueChatMirror(db, 'announcements', 'win', {
        uid: 'nacho-bot', name: '🦌 Nacho', text: block,
    }, null, now);
    assert.strictEqual(globalCopy.queued, true);
    assert.strictEqual(ggsCopy.reason, 'duplicate');
    const epoch = '⛏️ EPOCH #3 COMPLETE! 🎉\n\nwinners';
    const epochCopy = await mirror.enqueueChatMirror(db, 'announcements', 'epoch', {
        uid: 'nacho-bot', name: '🦌 Nacho', text: epoch,
    }, null, now);
    assert.strictEqual(epochCopy.reason, 'duplicate');
});

test('a ban at send time and a deleted single message are handled', async function () {
    const now = 1700000000000;
    const db = memoryDb({
        'global_chat/late': msg({ uid: 'user_late', text: 'hello' }),
        'users/user_late': { username: 'Late' },
        'faucet_ledger/user_late': { banned: false },
    });
    await mirror.enqueueChatMirror(db, 'global_chat', 'late', db.docs['global_chat/late'], null, now);
    db.docs['faucet_ledger/user_late'] = { banned: true };
    const blocked = await mirror.flushTelegramMirror(db, now, {
        token: 'test-token-value',
        chatId: '-100',
        log: function () {},
        fetch: async function () { throw new Error('banned text was sent'); },
    });
    assert.strictEqual(blocked.sent, 0);
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__late'].status, 'skipped');

    const calls = [];
    const removed = await mirror.retractMirroredChat(db, {
        telegramMsgId: '77',
        telegramChatId: '-100',
        text: 'hello',
    }, { hidden: true }, {
        token: 'test-token-value',
        fetch: async function (url, init) {
            calls.push(url + ' ' + init.body);
            return { ok: true, status: 200, json: async function () { return { ok: true, result: true }; } };
        },
    });
    assert.strictEqual(removed.deleted, true);
    assert.ok(calls[0].indexOf('deleteMessage') !== -1);
    const batched = await mirror.retractMirroredChat(db, {
        telegramBatched: true,
        telegramMsgId: '9',
        text: 'hello',
    }, null, {
        fetch: async function () { throw new Error('batched delete'); },
    });
    assert.strictEqual(batched.reason, 'no_id');
});

test('disguised profanity, the old bridge list, decimals, and bad usernames are blocked', async function () {
    const now = 1700000000000;
    const blocked = [
        ['tags', 'fu<b></b>ck you'],
        ['zwsp', 'fu\u200Bck you'],
        ['soft', 'fu\u00ADck you'],
        ['italic', 'sh<i>i</i>t'],
        ['token', 'fu%%x%%ck you'],
        ['hyphen', 'fuck-off'],
        ['fullwidth', 'ｆｕｃｋ'],
        ['link', 'see [fuck](https://example.com)'],
        ['faggot', 'that faggot'],
        ['kike', 'a kike'],
        ['chink', 'a chink'],
        ['spic', 'a spic'],
        ['beaner', 'a beaner'],
        ['nazi', 'a nazi'],
        ['sieg', 'sieg heil'],
        ['gas', 'gas the jews'],
        ['rape', 'rape'],
        ['pedo', 'pedo'],
        ['porn', 'porn'],
        ['mother', 'motherfucker'],
        ['fuckers', 'fuckers'],
        ['bull', 'bullshit'],
        ['trump', 'vote trump'],
    ];
    blocked.forEach(function (row) {
        const decision = mirror.decideMirror({ collection: 'global_chat', data: msg({ text: row[1] }) });
        assert.strictEqual(decision.forward, false, row[0] + ' forwarded: ' + (decision.line || decision.reason));
        assert.strictEqual(decision.reason, 'profanity', row[0]);
    });
    const scam = mirror.decideMirror({
        collection: 'global_chat',
        data: msg({ text: 'send 0.01 btc to bc1qexampleaddress' }),
    });
    assert.strictEqual(scam.forward, false);
    assert.strictEqual(scam.reason, 'scam');
    const named = mirror.decideMirror({
        collection: 'global_chat',
        data: msg({ name: 'fu<b></b>ck', text: 'hello there' }),
    });
    assert.strictEqual(named.forward, true);
    assert.strictEqual(named.name, 'A player');
    assert.strictEqual(named.line, '[Global] A player: hello there');
    assert.strictEqual(named.line.indexOf('fuck'), -1);
    const wideName = mirror.decideMirror({
        collection: 'global_chat',
        data: msg({ name: 'ｆｕｃｋ', text: 'hello there' }),
    });
    assert.strictEqual(wideName.name, 'A player');
    const db = memoryDb();
    const queued = await mirror.enqueueChatMirror(db, 'global_chat', 'hid', msg({ text: 'fu\u200Bck you' }), null, now);
    assert.strictEqual(queued.queued, false);
    assert.strictEqual(queued.reason, 'profanity');
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__hid'], undefined);
    db.docs['global_chat/latebad'] = msg({ text: 'hello there' });
    const late = await mirror.enqueueChatMirror(db, 'global_chat', 'latebad', db.docs['global_chat/latebad'], null, now);
    assert.strictEqual(late.queued, true);
    db.docs['global_chat/latebad'].text = 'sh<i>i</i>t';
    const blockedSend = await mirror.flushTelegramMirror(db, now, {
        token: 'test-token-value',
        chatId: '-100',
        log: function () {},
        fetch: async function () { throw new Error('sanitized profanity was sent'); },
    });
    assert.strictEqual(blockedSend.sent, 0);
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__latebad'].status, 'skipped');
    assert.strictEqual((db.docs['telegram_mirror_state/group'].sentAtMs || []).length, 0);
});

test('disguised letters, lookalikes, and ordinary words', function () {
    const blocked = [
        ['vs', 'f\uFE0Fuck'],
        ['mark', 'fuc\u0301k'],
        ['spaced', 'f u c k you'],
        ['shit-spaced', 's h i t'],
        ['kike-spaced', 'k i k e'],
        ['newline', 'fu\nck'],
        ['line-letters', 'f\nu\nc\nk'],
        ['star', 'f*ck'],
        ['stars', 'f**k'],
        ['star-sep', 'f*u*c*k'],
        ['cyr', 'fu\u0441k'],
        ['splice', 'fu[x](https://a.b)ck'],
        ['ph-space', 'ph uck'],
        ['ph-word', 'phuck'],
        ['leet', 'p0rn'],
        ['tits', 't1ts'],
        ['exact-dick', 'dick'],
        ['exact-cock', 'cock'],
        ['exact-rape', 'rape'],
        ['exact-spic', 'a spic'],
        ['exact-trump', 'vote trump'],
        ['exact-republican', 'republican'],
        ['republicans', 'the republicans'],
        ['exact-democrat', 'democrat'],
        ['democrats', 'the democrats'],
        ['exact-maga', 'maga'],
        ['exact-shit', 'shit'],
        ['exact-cunt', 'cunt'],
        ['slur', 'nigger'],
    ];
    blocked.forEach(function (row) {
        const decision = mirror.decideMirror({ collection: 'global_chat', data: msg({ text: row[1] }) });
        assert.strictEqual(decision.forward, false, row[0] + ' forwarded: ' + (decision.line || decision.reason));
        assert.strictEqual(decision.reason, 'profanity', row[0]);
    });
    const allowed = [
        ['magazine', 'Bitcoin Magazine'],
        ['suspicious', 'that looks suspicious'],
        ['block', 'block 71750'],
        ['spicy', 'spicy'],
        ['grape', 'a grape'],
        ['dickens', 'Dickens wrote that'],
        ['trumpet', 'a trumpet'],
        ['cocktail', 'a cocktail'],
        ['scunthorpe', 'Scunthorpe'],
        ['democratic', 'a democratic vote'],
        ['therapist', 'a therapist'],
        ['class', 'classic class'],
        ['phone', 'my phone'],
    ];
    allowed.forEach(function (row) {
        const decision = mirror.decideMirror({ collection: 'global_chat', data: msg({ text: row[1] }) });
        assert.strictEqual(decision.forward, true, row[0] + ' blocked: ' + decision.reason);
    });
});

test('separator allowlist, lookalikes, squeeze, and scam fold', function () {
    const blocked = [
        ['s-cunt-horpe', 's-cunt-horpe'],
        ['s.cunt.horpe', 's.cunt.horpe'],
        ['scunt-horpe', 'scunt-horpe'],
        ['g-rape', 'g-rape'],
        ['g_rape', 'g_rape'],
        ['spic-y', 'spic-y'],
        ['s.pic.y', 's.pic.y'],
        ['sus-pic-ious', 'sus-pic-ious'],
        ['de-spic-able', 'de-spic-able'],
        ['maga-zine', 'maga-zine'],
        ['maga.zine', 'maga.zine'],
        ['tor-pedo', 'tor-pedo'],
        ['ty-coon', 'ty-coon'],
        ['rac.coon', 'rac.coon'],
        ['co_coon', 'co_coon'],
        ['dick-ens', 'dick-ens'],
        ['cock-tail', 'cock-tail'],
        ['cock.pit', 'cock.pit'],
        ['trump-et', 'trump-et'],
        ['dem-ocrats', 'dem-ocrats'],
        ['the-rapeutic', 'the-rapeutic'],
        ['line-scunthorpe', 's\ncunthorpe'],
        ['spaced-scunthorpe', 's c u n t h o r p e'],
        ['scrape-d', 'scrape-d'],
        ['trump-eter', 'trump-eter'],
        ['suspicious-ly', 'suspicious-ly'],
        ['spice-d', 'spice-d'],
        ['concat-magazine', 'magazinemaga'],
        ['concat-spicy', 'spicyspic'],
        ['beside-maga', 'maga magazine'],
        ['greek-upsilon', 'f\u03C5ck'],
        ['greek-sigma', 'fu\u03C2k'],
        ['greek-iota', 'sh\u03B9t'],
        ['greek-omicron', 'p\u03BFrn'],
        ['greek-alpha', 'n\u03B1zi'],
        ['greek-kike', '\u03BA\u03B9\u03BAe'],
        ['cyr-ka', 'fuc\u043Ak'],
        ['cyr-shha', '\u0455\u04BBit'],
        ['small-caps', '\uA730\u1D1C\u1D04\u1D0B'],
        ['fill-115f', 'f\u115Fuck'],
        ['fill-1160', 'f\u1160uck'],
        ['fill-3164', 'f\u3164uck'],
        ['fill-ffa0', 'f\uFFA0uck'],
        ['fill-2800', 'f\u2800uck'],
        ['emoji-fire', 'f\u{1F525}uck'],
        ['emoji-poop', 'sh\u{1F4A9}it'],
        ['repeat-fuck', 'fuuuck'],
        ['repeat-fuck-long', 'fuuuuuuck'],
        ['repeat-shit', 'shiiiit'],
        ['repeat-bitch', 'biiitch'],
        ['squeeze-to-two', 'niggger'],
        ['cocked', 'cocked'],
        ['grape-emoji', 'grape\u{1F347}juice'],
        ['star-shit', 'sh*t'],
        ['star-sit', 's*it'],
    ];
    blocked.forEach(function (row) {
        const decision = mirror.decideMirror({ collection: 'global_chat', data: msg({ text: row[1] }) });
        assert.strictEqual(decision.forward, false, row[0] + ' forwarded: ' + (decision.line || decision.reason));
        assert.strictEqual(decision.reason, 'profanity', row[0]);
    });
    const scams = [
        ['soft-send', 'sen\u00ADd 0.01 btc to bc1q'],
        ['soft-addr', 'send 0.01 btc to b\u00ADc1q'],
        ['fullwidth', '\uFF53\uFF45\uFF4E\uFF44 0.01 btc to bc1q'],
        ['cyr-send', 's\u0435nd 0.01 btc to bc1q'],
        ['plain', 'send 0.01 btc to bc1'],
    ];
    scams.forEach(function (row) {
        const decision = mirror.decideMirror({ collection: 'global_chat', data: msg({ text: row[1] }) });
        assert.strictEqual(decision.forward, false, row[0] + ' forwarded: ' + (decision.line || decision.reason));
        assert.strictEqual(decision.reason, 'scam', row[0]);
    });
    const allowed = [
        ['magazine', 'magazine'],
        ['bitcoin-magazine', 'Bitcoin Magazine'],
        ['scunthorpe', 'Scunthorpe'],
        ['cocktail', 'cocktail'],
        ['block', 'block 71750'],
        ['trap', "it's a *trap*"],
        ['sushi', '*sushi* tonight'],
        ['adam', '*Adam* said'],
        ['suspiciously', 'suspiciously'],
        ['spiced', 'spiced'],
        ['scraped', 'scraped'],
        ['draped', 'draped'],
        ['torpedoed', 'torpedoed'],
        ['grapevine', 'grapevine'],
        ['trumpeter', 'trumpeter'],
        ['democratic', 'democratic'],
        ['moon', 'Moooon'],
        ['good', 'gooood'],
        ['hey', 'heyyyy'],
        ['yes', 'yesss'],
        ['hmm', 'hmmm'],
        ['woo', 'woooo'],
        ['comma-btc', 'send 0,01 BTC'],
    ];
    allowed.forEach(function (row) {
        const decision = mirror.decideMirror({ collection: 'global_chat', data: msg({ text: row[1] }) });
        assert.strictEqual(decision.forward, true, row[0] + ' blocked: ' + decision.reason);
    });
});

test('isolation refreshes the lease and stops on 429', async function () {
    const now = 1700000000000;
    const db = memoryDb({
        'global_chat/a': msg({ uid: 'user_a', text: 'alpha line' }),
        'global_chat/b': msg({ uid: 'user_b', text: 'beta line' }),
        'global_chat/c': msg({ uid: 'user_c', text: 'gamma line' }),
    });
    await mirror.enqueueChatMirror(db, 'global_chat', 'a', db.docs['global_chat/a'], null, now);
    await mirror.enqueueChatMirror(db, 'global_chat', 'b', db.docs['global_chat/b'], null, now + 10);
    await mirror.enqueueChatMirror(db, 'global_chat', 'c', db.docs['global_chat/c'], null, now + 20);
    let tick = now;
    const seen = [];
    const calls = [];
    const logs = [];
    const result = await mirror.flushTelegramMirror(db, now + 20, {
        token: 'test-token-value',
        chatId: '-100',
        clock: function () { return tick; },
        log: function (line) { logs.push(line); },
        fetch: async function (_url, init) {
            const text = JSON.parse(init.body).text;
            calls.push(text);
            if (text.indexOf('\n') !== -1) {
                tick = now + 12000;
                return { ok: false, status: 400, json: async function () { return { ok: false, error_code: 400, description: 'Bad Request: can\'t parse entities' }; } };
            }
            seen.push(text + '@' + db.docs['telegram_mirror_queue/global_chat__' + (text.indexOf('alpha') !== -1 ? 'a' : 'b')].sendingAt);
            if (text.indexOf('alpha') !== -1) {
                tick = now + 32000;
                return { ok: true, status: 200, json: async function () { return { ok: true, result: { message_id: 4, chat: { id: -100 } } }; } };
            }
            return {
                ok: false,
                status: 429,
                json: async function () { return { ok: false, error_code: 429, parameters: { retry_after: 9 } }; },
            };
        },
    });
    assert.strictEqual(result.sent, 1);
    assert.strictEqual(calls.length, 3);
    assert.ok(seen[0].indexOf(String(now + 12000)) !== -1);
    assert.ok(seen[1].indexOf(String(now + 32000)) !== -1);
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__a'].status, 'sent');
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__b'].status, 'pending');
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__c'].status, 'pending');
    assert.ok(db.docs['telegram_mirror_queue/global_chat__b'].nextAttemptAt >= now + 20 + 9000);
    assert.ok(logs.join('\n').indexOf('429') !== -1);
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__c'].status, 'pending');
});

test('chat-level errors stay queued and expired leases are not hidden', async function () {
    const now = 1700000000000;
    const db = memoryDb({
        'global_chat/k1': msg({ uid: 'user_k1', text: 'keep one' }),
        'global_chat/k2': msg({ uid: 'user_k2', text: 'keep two' }),
    });
    await mirror.enqueueChatMirror(db, 'global_chat', 'k1', db.docs['global_chat/k1'], null, now);
    await mirror.enqueueChatMirror(db, 'global_chat', 'k2', db.docs['global_chat/k2'], null, now + 10);
    const logs = [];
    let calls = 0;
    const held = await mirror.flushTelegramMirror(db, now + 10, {
        token: 'test-token-value',
        chatId: '-100',
        log: function (line) { logs.push(line); },
        fetch: async function () {
            calls += 1;
            return {
                ok: false,
                status: 401,
                json: async function () { return { ok: false, error_code: 401, description: 'Unauthorized' }; },
            };
        },
    });
    assert.strictEqual(calls, 1);
    assert.strictEqual(held.sent, 0);
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__k1'].status, 'pending');
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__k2'].status, 'pending');
    assert.ok(logs.join('\n').indexOf('401') !== -1);
    assert.ok(logs.join('\n').indexOf('test-token-value') === -1);

    const missing = memoryDb({
        'global_chat/gone': msg({ uid: 'user_gone', text: 'still here' }),
    });
    await mirror.enqueueChatMirror(missing, 'global_chat', 'gone', missing.docs['global_chat/gone'], null, now);
    let missingCalls = 0;
    await mirror.flushTelegramMirror(missing, now, {
        token: 'test-token-value',
        chatId: '-100',
        log: function () {},
        fetch: async function () {
            missingCalls += 1;
            return {
                ok: false,
                status: 400,
                json: async function () { return { ok: false, error_code: 400, description: 'Bad Request: chat not found' }; },
            };
        },
    });
    assert.strictEqual(missingCalls, 1);
    assert.strictEqual(missing.docs['telegram_mirror_queue/global_chat__gone'].status, 'pending');

    const stuck = memoryDb();
    for (let i = 0; i < 10; i++) {
        stuck.docs['telegram_mirror_queue/global_chat__fresh' + i] = {
            status: 'sending',
            sendingAt: now,
            nextAttemptAt: now,
            collection: 'global_chat',
            docId: 'fresh' + i,
            line: '[Global] Pat: fresh ' + i,
            createdAtMs: now,
            attempts: 1,
        };
        stuck.docs['global_chat/fresh' + i] = msg({ uid: 'user_fresh_' + i, text: 'fresh ' + i });
    }
    stuck.docs['telegram_mirror_queue/global_chat__old'] = {
        status: 'sending',
        sendingAt: now - mirror.SENDING_LEASE_MS - 5000,
        nextAttemptAt: now - 1000,
        collection: 'global_chat',
        docId: 'old',
        line: '[Global] Pat: old line',
        createdAtMs: now - 1000,
        attempts: 1,
    };
    stuck.docs['global_chat/old'] = msg({ uid: 'user_old', text: 'old line' });
    const recovered = [];
    const recover = await mirror.flushTelegramMirror(stuck, now, {
        token: 'test-token-value',
        chatId: '-100',
        log: function () {},
        fetch: async function (_url, init) {
            recovered.push(JSON.parse(init.body).text);
            return { ok: true, status: 200, json: async function () { return { ok: true, result: { message_id: 8, chat: { id: -100 } } }; } };
        },
    });
    assert.strictEqual(recover.sent, 1);
    assert.strictEqual(recovered.length, 1);
    assert.ok(recovered[0].indexOf('old line') !== -1);
    assert.strictEqual(stuck.docs['telegram_mirror_queue/global_chat__old'].status, 'sent');
    assert.strictEqual(stuck.docs['telegram_mirror_queue/global_chat__fresh0'].status, 'sending');
    const src = fs.readFileSync(path.join(root, 'functions', 'src', 'chatTelegramMirror.js'), 'utf8');
    const indexes = fs.readFileSync(path.join(root, 'firestore.indexes.json'), 'utf8');
    assert.ok(src.indexOf("query.where('sendingAt', '<', cutoff)") !== -1);
    assert.ok(indexes.indexOf('"fieldPath": "sendingAt"') !== -1);
});

test('the group cap is reserved before the send', async function () {
    const now = 1700000000000;
    const db = memoryDb();
    let during = 0;
    const options = {
        token: 'test-token-value',
        chatId: '-100',
        log: function () {},
        fetch: async function () {
            during = (db.docs['telegram_mirror_state/group'].sentAtMs || []).length;
            return { ok: true, status: 200, json: async function () { return { ok: true, result: { message_id: 1, chat: { id: -100 } } }; } };
        },
    };
    for (let i = 0; i < mirror.MAX_SENDS_PER_MINUTE; i++) {
        const id = 'g' + i;
        db.docs['global_chat/' + id] = msg({ uid: 'user_g_' + i, text: 'g ' + i });
        const queued = await mirror.enqueueChatMirror(db, 'global_chat', id, db.docs['global_chat/' + id], null, now + i * 1000);
        assert.strictEqual(queued.queued, true, id);
        const flushed = await mirror.flushTelegramMirror(db, now + i * 1000, options);
        assert.strictEqual(flushed.sent, 1, id);
    }
    assert.strictEqual(during, mirror.MAX_SENDS_PER_MINUTE);
    assert.strictEqual(db.docs['telegram_mirror_state/group'].sentAtMs.length, mirror.MAX_SENDS_PER_MINUTE);
    db.docs['global_chat/g20'] = msg({ uid: 'user_g_20', text: 'too many' });
    const queued = await mirror.enqueueChatMirror(db, 'global_chat', 'g20', db.docs['global_chat/g20'], null, now + 20000);
    assert.strictEqual(queued.queued, true);
    const held = await mirror.flushTelegramMirror(db, now + 20000, options);
    assert.strictEqual(held.sent, 0);
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__g20'].status, 'pending');
    assert.ok(held.waitUntil > now + 20000);
});

test('chat-level errors stay queued past five attempts', async function () {
    const now = 1700000000000;
    const db = memoryDb({
        'global_chat/hold': msg({ uid: 'user_hold', text: 'still queued' }),
    });
    await mirror.enqueueChatMirror(db, 'global_chat', 'hold', db.docs['global_chat/hold'], null, now);
    let at = now;
    for (let n = 0; n < 6; n++) {
        const result = await mirror.flushTelegramMirror(db, at, {
            token: 'test-token-value',
            chatId: '-100',
            log: function () {},
            fetch: async function () {
                return {
                    ok: false,
                    status: 401,
                    json: async function () { return { ok: false, error_code: 401, description: 'Unauthorized' }; },
                };
            },
        });
        const row = db.docs['telegram_mirror_queue/global_chat__hold'];
        assert.strictEqual(result.sent, 0);
        assert.strictEqual(row.status, 'pending');
        assert.ok(row.nextAttemptAt > at);
        assert.ok(row.nextAttemptAt - at <= mirror.CHAT_HOLD_MAX_MS);
        at = row.nextAttemptAt;
    }
    const row = db.docs['telegram_mirror_queue/global_chat__hold'];
    assert.ok(row.attempts >= 6);
    assert.strictEqual(row.status, 'pending');
    assert.strictEqual(row.lastError, undefined);
    assert.strictEqual(mirror.chatHoldMs(12), mirror.CHAT_HOLD_MAX_MS);
    const src = fs.readFileSync(path.join(root, 'functions', 'src', 'chatTelegramMirror.js'), 'utf8');
    assert.ok(src.indexOf("console.error('[TG MIRROR] hold ' + code)") !== -1);
    assert.strictEqual(src.indexOf('console.error(result'), -1);
    assert.strictEqual(src.indexOf("collection('announcements')"), -1);
});

test('a fully filtered batch does not spend a group slot', async function () {
    const now = 1700000000000;
    const db = memoryDb({
        'global_chat/a': msg({ uid: 'user_a', text: 'clean one' }),
        'global_chat/b': msg({ uid: 'user_b', text: 'clean two' }),
    });
    await mirror.enqueueChatMirror(db, 'global_chat', 'a', db.docs['global_chat/a'], null, now);
    await mirror.enqueueChatMirror(db, 'global_chat', 'b', db.docs['global_chat/b'], null, now + 10);
    db.docs['global_chat/a'].text = 'fuck';
    db.docs['global_chat/b'].text = 'shit';
    const blocked = await mirror.flushTelegramMirror(db, now + 10, {
        token: 'test-token-value',
        chatId: '-100',
        log: function () {},
        fetch: async function () { throw new Error('filtered batch was sent'); },
    });
    assert.strictEqual(blocked.sent, 0);
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__a'].status, 'skipped');
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__b'].status, 'skipped');
    assert.strictEqual((db.docs['telegram_mirror_state/group'].sentAtMs || []).length, 0);

    db.docs['global_chat/c'] = msg({ uid: 'user_c', text: 'keep me' });
    db.docs['global_chat/d'] = msg({ uid: 'user_d', text: 'drop me' });
    await mirror.enqueueChatMirror(db, 'global_chat', 'c', db.docs['global_chat/c'], null, now + 20);
    await mirror.enqueueChatMirror(db, 'global_chat', 'd', db.docs['global_chat/d'], null, now + 30);
    db.docs['global_chat/d'].text = 'fuck';
    let calls = 0;
    const mixed = await mirror.flushTelegramMirror(db, now + 30, {
        token: 'test-token-value',
        chatId: '-100',
        log: function () {},
        fetch: async function () {
            calls += 1;
            return { ok: true, status: 200, json: async function () { return { ok: true, result: { message_id: 3, chat: { id: -100 } } }; } };
        },
    });
    assert.strictEqual(mixed.sent, 1);
    assert.strictEqual(calls, 1);
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__c'].status, 'sent');
    assert.strictEqual(db.docs['telegram_mirror_queue/global_chat__d'].status, 'skipped');
    assert.strictEqual(db.docs['telegram_mirror_state/group'].sentAtMs.length, 1);
});

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
