// Server Telegram mirror for Nacho shoutouts. No Firebase.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const bridge = require('../functions/src/telegramBridge');
const cli = require('../functions/mirror-shoutout');
const { shoutoutText } = require('../functions/src/shoutout');

let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) {
    try {
        const out = fn();
        if (out && typeof out.then === 'function') {
            queue.push(out.then(function() {
                console.log('✅ ' + name);
                passed++;
            }, function(e) {
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

function memoryDb(initial) {
    const docs = Object.assign({}, initial || {});
    return {
        docs: docs,
        getDoc: async function(id) {
            return docs[id] ? Object.assign({}, docs[id]) : null;
        },
        updateDoc: async function(id, patch) {
            docs[id] = Object.assign({}, docs[id], patch);
        },
    };
}

test('a shoutout is mirrored once, as Nacho, and stamped for reactions', async function() {
    const raw = '🎉 Shoutout to <span data-profile-uid="uid_phil">@phil</span>! They just unlocked a rare Nacho Shoutout. Go send phil a peer request! 🤝';
    const db = memoryDb({
        shoutout_gift_abc: { uid: 'nacho-bot', text: raw },
    });
    const posts = [];
    const first = await bridge.mirrorShoutoutOnce({
        docId: 'shoutout_gift_abc',
        text: raw,
        getDoc: db.getDoc,
        updateDoc: db.updateDoc,
        post: async function(payload) {
            posts.push(payload);
            return { ok: true, telegramMsgId: '4242', chatId: '-1003745860336' };
        },
    });
    assert.strictEqual(first.mirrored, true);
    assert.strictEqual(posts.length, 1);
    assert.deepStrictEqual(posts[0], {
        user: '🦌 Nacho',
        text: '🎉 Shoutout to @phil! They just unlocked a rare Nacho Shoutout. Go send phil a peer request! 🤝',
        source: 'server',
        uid: 'nacho',
    });
    assert.ok(posts[0].text.indexOf('@phil') !== -1);
    assert.ok(posts[0].text.indexOf('<') === -1);
    assert.ok(posts[0].text.indexOf('uid_phil') === -1);
    const saved = db.docs.shoutout_gift_abc;
    assert.strictEqual(saved.telegramMsgId, '4242');
    assert.strictEqual(saved.telegramChatId, '-1003745860336');
    assert.strictEqual(saved.telegramMirrored, true);

    const second = await bridge.mirrorShoutoutOnce({
        docId: 'shoutout_gift_abc',
        text: raw,
        getDoc: db.getDoc,
        updateDoc: db.updateDoc,
        post: async function() {
            posts.push('again');
            return { ok: true, telegramMsgId: '999', chatId: '1' };
        },
    });
    assert.strictEqual(second.mirrored, false);
    assert.strictEqual(second.reason, 'already_mirrored');
    assert.strictEqual(posts.length, 1);
});

test('mirroring is idempotent when the doc was already stamped', async function() {
    let calls = 0;
    async function post() {
        calls++;
        return { ok: true, telegramMsgId: '1', chatId: '2' };
    }
    const flagged = await bridge.mirrorShoutoutOnce({
        docId: 'shoutout_gift_abc',
        getDoc: async function() { return { text: 'hi', telegramMirrored: true }; },
        updateDoc: async function() { throw new Error('should not update'); },
        post: post,
    });
    const linked = await bridge.mirrorShoutoutOnce({
        docId: 'shoutout_gift_abc',
        getDoc: async function() { return { text: 'hi', telegramMsgId: '55' }; },
        updateDoc: async function() { throw new Error('should not update'); },
        post: post,
    });
    assert.strictEqual(flagged.reason, 'already_mirrored');
    assert.strictEqual(linked.reason, 'already_mirrored');
    assert.strictEqual(calls, 0);
});

test('a bridge failure is swallowed and does not stamp the chat doc', async function() {
    const db = memoryDb({
        shoutout_gift_abc: { uid: 'nacho-bot', text: shoutoutText('phil') },
    });
    let updates = 0;
    const logs = [];
    const secret = 'bridge-secret-value';
    const thrown = await bridge.mirrorShoutoutOnce({
        docId: 'shoutout_gift_abc',
        secret: secret,
        log: { warn: function(m) { logs.push(m); }, error: function(m) { logs.push(m); } },
        getDoc: db.getDoc,
        updateDoc: async function() { updates++; },
        post: async function() {
            throw new Error('request to https://bridge.example/webhook/firestore?token=' + secret + ' failed Bearer ' + secret);
        },
    });
    assert.strictEqual(thrown.mirrored, false);
    assert.strictEqual(thrown.reason, 'error');
    assert.strictEqual(updates, 0);
    assert.ok(!db.docs.shoutout_gift_abc.telegramMirrored);
    const rejected = await bridge.mirrorShoutoutOnce({
        docId: 'shoutout_gift_abc',
        log: { warn: function() {}, error: function() {} },
        getDoc: db.getDoc,
        updateDoc: async function() { updates++; },
        post: async function() { return { ok: false, error: 'request_failed' }; },
    });
    assert.strictEqual(rejected.mirrored, false);
    assert.strictEqual(updates, 0);
    const joined = logs.join('\n');
    assert.ok(joined.indexOf(secret) === -1);
    assert.ok(joined.indexOf('?') === -1);
    assert.ok(joined.indexOf('https://') === -1);
});

test('the helper posts with a 5s timeout and reads the worker message id', async function() {
    const secret = 'bridge-secret-value';
    const logs = [];
    const log = { warn: function(m) { logs.push(m); }, error: function(m) { logs.push(m); } };
    let seen = null;
    const ok = await bridge.postToTelegramBridge({
        user: '🦌 Nacho',
        text: 'hello',
        source: 'server',
        uid: 'nacho',
    }, {
        secret: secret,
        url: 'https://chat-bridge.example/webhook/firestore',
        log: log,
        fetch: async function(url, init) {
            seen = { url: url, init: init };
            return {
                ok: true,
                status: 200,
                json: async function() {
                    return {
                        ok: true,
                        result: {
                            ok: true,
                            description: 'leak ' + secret,
                            result: {
                                message_id: 4242,
                                chat: { id: -1003745860336 },
                                text: '[🌐 🦌 Nacho]\nhello',
                            },
                        },
                    };
                },
            };
        },
    });
    assert.strictEqual(ok.ok, true);
    assert.strictEqual(ok.telegramMsgId, '4242');
    assert.strictEqual(ok.chatId, '-1003745860336');
    assert.strictEqual(seen.init.timeout, bridge.DEFAULT_TIMEOUT_MS);
    assert.strictEqual(seen.init.timeout, 5000);
    assert.strictEqual(seen.init.headers.Authorization, 'Bearer ' + secret);
    assert.deepStrictEqual(JSON.parse(seen.init.body), {
        user: '🦌 Nacho',
        text: 'hello',
        source: 'server',
        uid: 'nacho',
    });
    assert.strictEqual(logs.length, 0);

    const top = bridge.extractTelegramIds({ ok: true, telegramMsgId: 7, chatId: -5 });
    assert.strictEqual(top.telegramMsgId, '7');
    assert.strictEqual(top.chatId, '-5');

    let jsonCalled = false;
    const httpFail = await bridge.postToTelegramBridge({ text: 'x' }, {
        secret: secret,
        url: 'https://chat-bridge.example/webhook/firestore?token=' + secret,
        log: log,
        fetch: async function() {
            return {
                ok: false,
                status: 500,
                json: async function() {
                    jsonCalled = true;
                    return { token: secret, body: 'secret=' + secret };
                },
            };
        },
    });
    assert.strictEqual(httpFail.ok, false);
    assert.strictEqual(jsonCalled, false);
    assert.ok(logs.join('\n').indexOf(secret) === -1);
    assert.ok(logs.join('\n').indexOf('?') === -1);
});

test('a hung bridge times out and the plain shoutout text is left intact', async function() {
    const started = Date.now();
    const result = await bridge.postToTelegramBridge({ text: 'hi' }, {
        secret: 's',
        url: 'https://chat-bridge.example/webhook/firestore',
        timeoutMs: 40,
        log: { warn: function() {}, error: function() {} },
        fetch: function(url, init) {
            return new Promise(function(resolve, reject) {
                if (init.signal) {
                    init.signal.addEventListener('abort', function() {
                        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
                    });
                }
            });
        },
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'timeout');
    assert.ok(Date.now() - started < 2000);
    assert.strictEqual(bridge.toTelegramText(shoutoutText('phil')), shoutoutText('phil'));
    assert.strictEqual(bridge.WEB_BRIDGE_TIMEOUT_MS, 60000);
});

test('a caller with db defers to the chat mirror', async function() {
    let calls = 0;
    const deferred = await bridge.mirrorShoutoutOnce({
        db: {},
        docId: 'shoutout_gift_abc',
        post: async function() {
            calls++;
            return { ok: true, telegramMsgId: '1', chatId: '2' };
        },
    });
    assert.strictEqual(deferred.mirrored, false);
    assert.strictEqual(deferred.reason, 'server_mirror');
    assert.strictEqual(calls, 0);
});

test('normal bridge posts keep the caller username and ignore data.user', function() {
    const payload = bridge.buildWebBridgePayload('Phil', 'uid_phil', {
        user: '🦌 Nacho',
        uid: 'nacho',
        text: 'hello from me',
        gifUrl: 'https://example.test/a.gif',
        imageUrl: '',
        replyToName: 'Ada',
        replyToText: 'hi',
        messageId: 'm1',
    });
    assert.strictEqual(payload.user, 'Phil');
    assert.strictEqual(payload.uid, 'uid_phil');
    assert.strictEqual(payload.source, 'web');
    assert.strictEqual(payload.text, 'hello from me');
    assert.strictEqual(payload.gifUrl, 'https://example.test/a.gif');
    assert.strictEqual(payload.replyToName, 'Ada');
    assert.ok(!Object.prototype.hasOwnProperty.call(payload, 'messageId'));

    const indexSrc = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const start = indexSrc.indexOf('exports.bridgeToTelegram');
    const end = indexSrc.indexOf('exports.claimSats');
    const fn = indexSrc.slice(start, end);
    assert.ok(start !== -1 && end > start);
    assert.ok(fn.indexOf("skipped: 'server_mirror'") !== -1);
    assert.strictEqual(fn.indexOf('postToTelegramBridge'), -1);
    assert.strictEqual(fn.indexOf('buildWebBridgePayload'), -1);
    assert.strictEqual(fn.indexOf('data.user'), -1);
    assert.strictEqual(fn.indexOf("user: data.user"), -1);

    const giftSrc = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'gifting.js'), 'utf8');
    const gStart = giftSrc.indexOf('async function maybeAnnounceShoutout');
    const gEnd = giftSrc.indexOf('function nachoSatsText');
    const announce = giftSrc.slice(gStart, gEnd);
    assert.ok(announce.indexOf("plan.reason === 'already_posted'") !== -1);
    assert.ok(announce.indexOf('mirrorShoutoutQuiet(shoutoutDocId') !== -1);
    const publishAt = announce.indexOf('await publishShoutout');
    const afterPublish = announce.indexOf('mirrorShoutoutQuiet(plan.docId');
    assert.ok(publishAt !== -1 && afterPublish > publishAt);
    assert.ok(giftSrc.indexOf('function mirrorShoutoutQuiet') !== -1);
    assert.ok(giftSrc.indexOf('mirrorShoutoutOnce') !== -1);
});

test('a Telegram copy is deleted when the chat doc is gone before the id is linked', async function() {
    let reads = 0;
    const updates = [];
    const deletes = [];
    const removed = await bridge.mirrorShoutoutOnce({
        docId: 'shoutout_forum_post1',
        text: '📝 @phil just posted in PlebTalk: "Halving"',
        getDoc: async function() {
            reads += 1;
            if (reads > 1) return null;
            return { uid: 'nacho-bot', text: 'hi', activityRef: 'forum:post1' };
        },
        updateDoc: async function() { updates.push('stamp'); },
        deleteTelegram: async function(args) { deletes.push(String(args.chatId) + ':' + String(args.messageId)); },
        post: async function() { return { ok: true, telegramMsgId: '77', chatId: '-100' }; },
    });
    assert.strictEqual(removed.mirrored, false);
    assert.strictEqual(removed.reason, 'removed');
    assert.deepStrictEqual(deletes, ['-100:77']);
    assert.strictEqual(updates.length, 0);

    const replaced = await bridge.mirrorShoutoutOnce({
        docId: 'shoutout_forum_post1',
        getDoc: async function() {
            return { uid: 'uid_phil', text: 'not nacho' };
        },
        updateDoc: async function() { throw new Error('should not stamp a replaced doc'); },
        deleteTelegram: async function(args) { deletes.push('replaced:' + args.messageId); },
        post: async function() { return { ok: true, telegramMsgId: '88', chatId: '-100' }; },
    });
    assert.strictEqual(replaced.reason, 'removed');
    assert.ok(deletes.indexOf('replaced:88') !== -1);
});

test('the backfill script is dry-run unless --apply and only accepts shoutouts', function() {
    assert.deepStrictEqual(cli.parseArgs(['shoutout_gift_abc']), { id: 'shoutout_gift_abc', apply: false });
    assert.deepStrictEqual(cli.parseArgs(['shoutout_gift_abc', '--apply']), { id: 'shoutout_gift_abc', apply: true });
    assert.strictEqual(cli.parseArgs(['--apply']).id, '');
    assert.throws(function() { cli.parseArgs(['--nope']); });
    assert.strictEqual(cli.isShoutoutDoc('shoutout_gift_abc', { uid: 'nacho-bot' }), true);
    assert.strictEqual(cli.isShoutoutDoc('shoutout_gift_abc', { uid: 'someone' }), false);
    assert.strictEqual(cli.isShoutoutDoc('msg_1', { uid: 'nacho-bot' }), false);
    assert.strictEqual(cli.isShoutoutDoc('shoutout_../x', { uid: 'nacho-bot' }), false);
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'mirror-shoutout.js'), 'utf8');
    assert.ok(src.indexOf('ADMIN_TOKEN') !== -1);
    assert.ok(src.indexOf('--apply') !== -1);
    assert.ok(src.indexOf('dry-run') !== -1);
});

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
