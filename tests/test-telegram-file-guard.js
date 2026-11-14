// Telegram bot file URLs must not be written to Firestore.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const guard = require('../functions/src/telegramFileGuard');
const scrub = require('../scripts/scrub-telegram-urls');
const mirror = require('../functions/src/chatTelegramMirror');

const TOKEN = '12345:TESTTOKEN';
const FILE_URL = 'https://api.telegram.org/file/bot' + TOKEN + '/photos/file_1.jpg';
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
        return JSON.parse(JSON.stringify(data));
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
    return {
        docs: docs,
        collection: function (name) {
            return { doc: function (id) { return ref(name + '/' + id); } };
        },
        runTransaction: function (fn) {
            const run = chain.then(async function () {
                const staged = [];
                const t = {
                    get: function (r) { return r.get(); },
                    set: function (r, data) { staged.push({ path: r.path, data: clone(data) }); },
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

test('guard refuses file URLs and /bot<digits>: strings', function () {
    assert.strictEqual(guard.containsTelegramBotMaterial(FILE_URL), true);
    assert.strictEqual(guard.containsTelegramBotMaterial('see /bot12345:TESTTOKEN here'), true);
    assert.strictEqual(guard.containsTelegramBotMaterial('https://API.TELEGRAM.ORG/FILE/BOT' + TOKEN + '/a.jpg'), true);
    assert.strictEqual(guard.containsTelegramBotMaterial('https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg?alt=media'), false);
    assert.strictEqual(guard.containsTelegramBotMaterial('https://media.tenor.com/abc/g.gif'), false);
    assert.strictEqual(guard.containsTelegramBotMaterial('https://api.telegram.org/bot'), false);

    assert.throws(function () {
        guard.assertFirestoreSafe({ imageUrl: FILE_URL, text: 'hi' });
    }, function (err) {
        assert.strictEqual(err.message, 'refusing to write telegram bot material');
        assert.strictEqual(err.field, 'imageUrl');
        assert.ok(err.message.indexOf(TOKEN) === -1);
        assert.ok(String(err.field).indexOf(TOKEN) === -1);
        return true;
    });

    assert.throws(function () {
        guard.assertFirestoreSafe({ nested: { caption: 'prefix /bot99:ABCDEF' } });
    }, function (err) {
        assert.strictEqual(err.field, 'nested.caption');
        return true;
    });

    guard.assertFirestoreSafe({
        imageUrl: 'https://firebasestorage.googleapis.com/v0/b/bucket/o/chat-images%2Ftg%2Fabc.jpg?alt=media&token=dltoken',
        gifUrl: null,
        text: 'hello',
    });

    const hits = guard.listTelegramBotMaterial({
        imageUrl: FILE_URL,
        gifUrl: 'https://c.tenor.com/x.gif',
        extra: ['ok', 'see /bot7:ZZZZ'],
    });
    assert.strictEqual(hits.length, 2);
    assert.deepStrictEqual(hits[0].path, ['imageUrl']);
    assert.deepStrictEqual(hits[1].path, ['extra', 1]);
});

test('redact removes the token and storage paths stay unguessable', function () {
    const redacted = guard.redactSecrets('url ' + FILE_URL + ' and /bot12345:TESTTOKEN end');
    assert.ok(redacted.indexOf(TOKEN) === -1);
    assert.ok(redacted.indexOf('TESTTOKEN') === -1);
    assert.ok(redacted.indexOf('[telegram-file]') !== -1);
    const bytes = Buffer.from('0123456789abcdef');
    const objectPath = guard.objectPathFromBytes(bytes, 'jpg');
    assert.ok(objectPath.indexOf(guard.STORAGE_PREFIX) === 0);
    assert.ok(objectPath.indexOf('file_1') === -1);
    assert.ok(!/chat-images\/tg\/\d+_/.test(objectPath));
    const url = guard.storageDownloadUrl('bucket', objectPath, 'dltoken');
    assert.ok(url.indexOf('https://firebasestorage.googleapis.com/v0/b/bucket/o/') === 0);
    assert.ok(url.indexOf('token=dltoken') !== -1);
    guard.assertFirestoreSafe(url);
    assert.strictEqual(guard.extensionFromTelegramFileUrl(FILE_URL), 'jpg');
    assert.deepStrictEqual(guard.SCRUB_COLLECTIONS, ['global_chat']);
});

test('worker rehosts telegram files and guards every Firestore write', function () {
    const worker = fs.readFileSync(path.join(root, 'workers/chat-bridge/worker.js'), 'utf8');
    const builds = worker.match(/api\.telegram\.org\/file\/bot/g) || [];
    assert.strictEqual(builds.length, 1);
    assert.ok(worker.indexOf('function rehostTelegramPath') !== -1 || worker.indexOf('async function rehostTelegramPath') !== -1);
    assert.ok(worker.indexOf('telegramFileGuard.assertFirestoreSafe(doc)') !== -1);
    assert.ok(worker.indexOf('telegramFileGuard.assertFirestoreSafe(fields)') !== -1);
    assert.ok(worker.indexOf('crypto.getRandomValues') !== -1);
    assert.ok(worker.indexOf('error: e.message') === -1);
    assert.ok(worker.indexOf("console.error('Worker error:', e)") === -1);
    assert.ok(worker.indexOf("imageUrl = 'https://api.telegram.org") === -1);
    assert.ok(worker.indexOf('imageUrl = tmpUrl') === -1);
    assert.ok(worker.indexOf('gifUrl = ') !== -1);
});

test('mirror does not queue or send a bot file secret', async function () {
    const db = memoryDb();
    const queued = await mirror.enqueueChatMirror(db, 'global_chat', 'm1', {
        uid: 'user_pat',
        name: 'Pat',
        text: 'look ' + FILE_URL,
    }, null, 1700000000000);
    assert.strictEqual(queued.queued, false);
    assert.strictEqual(queued.reason, 'telegram_file_secret');
    const dumped = JSON.stringify(db.docs);
    assert.ok(dumped.indexOf(TOKEN) === -1);
    assert.ok(dumped.indexOf('TESTTOKEN') === -1);
    assert.strictEqual(db.docs['telegram_mirror_claims/global_chat__m1'].reason, 'telegram_file_secret');
    assert.ok(!db.docs['telegram_mirror_queue/global_chat__m1']);

    let fetched = false;
    const sent = await mirror.sendTelegramText('photo ' + FILE_URL, {
        token: 'not-the-bot-token',
        chatId: '-100',
        fetch: function () { fetched = true; return Promise.resolve({ ok: true, json: async function () { return { ok: true }; } }); },
    });
    assert.strictEqual(fetched, false);
    assert.strictEqual(sent.ok, false);
    assert.strictEqual(sent.error, 'telegram_file_secret');
    assert.strictEqual(sent.retry, false);
    assert.ok(JSON.stringify(sent).indexOf(TOKEN) === -1);
});

test('scrub dry-run prints ids only and apply rehosts or clears', async function () {
    const secretUrl = FILE_URL;
    const goneUrl = 'https://api.telegram.org/file/bot' + TOKEN + '/missing.gif';
    const rows = [
        { id: 'keep', data: { text: 'plain', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg?alt=media' } },
        { id: 'photo', data: { text: 'pic', imageUrl: secretUrl } },
        { id: 'gone', data: { text: 'old', gifUrl: goneUrl } },
    ];
    const logs = [];
    const updates = [];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-scrub-'));
    const db = {
        collection: function () {
            return { doc: function () { return { get: async function () { return { exists: false, data: function () { return null; } }; } }; } };
        },
    };
    const dry = await scrub.runScrub({
        apply: false,
        db: db,
        backupDir: dir,
        log: function (line) { logs.push(line); },
        listDocs: async function () { return rows; },
        updateDoc: function () { throw new Error('dry-run wrote'); },
        rehost: function () { throw new Error('dry-run fetched'); },
    });
    assert.strictEqual(dry.wrote, false);
    assert.strictEqual(dry.affected, 2);
    const dryText = logs.join('\n');
    assert.ok(dryText.indexOf('mode=dry-run') !== -1);
    assert.ok(dryText.indexOf('doc=global_chat/photo fields=imageUrl') !== -1);
    assert.ok(dryText.indexOf('doc=global_chat/gone fields=gifUrl') !== -1);
    assert.ok(dryText.indexOf('keep') === -1);
    assert.ok(dryText.indexOf(TOKEN) === -1);
    assert.ok(dryText.indexOf('TESTTOKEN') === -1);
    assert.ok(dryText.indexOf('api.telegram.org') === -1);
    assert.strictEqual(fs.readdirSync(dir).length, 0);

    logs.length = 0;
    const marker = {};
    const applyDb = {
        collection: function (name) {
            return {
                doc: function (id) {
                    return {
                        get: async function () {
                            if (marker.applied) return { exists: true, data: function () { return marker; } };
                            return { exists: false, data: function () { return null; } };
                        },
                        set: async function (data) {
                            assert.strictEqual(name, guard.SCRUB_MARKER.collection);
                            assert.strictEqual(id, guard.SCRUB_MARKER.id);
                            Object.assign(marker, data);
                        },
                    };
                },
            };
        },
    };
    const applied = await scrub.runScrub({
        apply: true,
        db: applyDb,
        backupDir: dir,
        nowIso: '2026-11-09T00:00:00.000Z',
        log: function (line) { logs.push(line); },
        listDocs: async function () { return rows; },
        updateDoc: async function (collection, id, patch) {
            assert.ok(fs.readdirSync(dir).length === 1);
            guard.assertFirestoreSafe(patch);
            assert.ok(JSON.stringify(patch).indexOf(TOKEN) === -1);
            updates.push({ collection: collection, id: id, patch: patch });
        },
        rehost: async function (url) {
            if (url.indexOf('missing') !== -1) return null;
            const ext = guard.extensionFromTelegramFileUrl(url);
            return guard.storageDownloadUrl('bucket', guard.objectPathFromBytes(Buffer.from('0123456789abcdef'), ext), 'dltoken');
        },
    });
    assert.strictEqual(applied.wrote, true);
    assert.strictEqual(applied.affected, 2);
    assert.strictEqual(applied.rehosted, 1);
    assert.strictEqual(applied.removed, 1);
    const photo = updates.filter(function (row) { return row.id === 'photo'; })[0];
    const gone = updates.filter(function (row) { return row.id === 'gone'; })[0];
    assert.ok(photo.patch.imageUrl.indexOf('https://firebasestorage.googleapis.com/') === 0);
    assert.ok(photo.patch.imageUrl.indexOf('chat-images%2Ftg%2F') !== -1);
    assert.strictEqual(gone.patch.gifUrl, null);
    assert.strictEqual(gone.patch.mediaRemoved, true);
    const backup = JSON.parse(fs.readFileSync(path.join(dir, fs.readdirSync(dir)[0]), 'utf8'));
    assert.strictEqual(backup.docs.length, 2);
    assert.strictEqual(backup.docs[0].data.imageUrl, secretUrl);
    const applyText = logs.join('\n');
    assert.ok(applyText.indexOf(TOKEN) === -1);
    assert.ok(applyText.indexOf('updated=global_chat/photo action=rehosted') !== -1);
    assert.ok(applyText.indexOf('updated=global_chat/gone action=removed') !== -1);
    assert.strictEqual(marker.applied, true);

    const againLogs = [];
    let listed = false;
    const again = await scrub.runScrub({
        apply: true,
        db: applyDb,
        backupDir: dir,
        log: function (line) { againLogs.push(line); },
        listDocs: async function () { listed = true; return rows; },
        updateDoc: function () { throw new Error('second run wrote'); },
        rehost: function () { throw new Error('second run fetched'); },
    });
    assert.strictEqual(again.alreadyApplied, true);
    assert.strictEqual(again.wrote, false);
    assert.strictEqual(listed, false);
    assert.ok(againLogs.join('\n').indexOf('already-applied') !== -1);
    assert.ok(againLogs.join('\n').indexOf(TOKEN) === -1);
});

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
