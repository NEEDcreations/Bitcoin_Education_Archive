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
const PRIVATE_BACKUP_ROOT = '/workspace/private';

let passed = 0;
let failed = 0;
const queue = [];
const cleanupDirs = [];

function makePrivateBackupDir() {
    const dir = fs.mkdtempSync(path.join(PRIVATE_BACKUP_ROOT, 'telegram-scrub-backup-test-'));
    cleanupDirs.push(dir);
    return dir;
}

function makeFreshBackupPath() {
    const dir = path.join(
        PRIVATE_BACKUP_ROOT,
        'telegram-scrub-backup-test-' + Date.now() + '-' + Math.random().toString(16).slice(2)
    );
    cleanupDirs.push(dir);
    return dir;
}

function backupJsonFiles(dir) {
    return fs.readdirSync(dir).filter(function (name) {
        return /^backup-[A-Za-z0-9_+-]+\.json$/.test(name);
    });
}

function rmDir(dir) {
    if (!dir) return;
    try { fs.rmSync(dir, { recursive: true, force: true }); }
    catch (err) { /* ignore */ }
}

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
    const dir = makeFreshBackupPath();
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
    assert.strictEqual(fs.existsSync(dir), false);

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
            assert.strictEqual(backupJsonFiles(dir).length, 1);
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
    const backup = JSON.parse(fs.readFileSync(path.join(dir, backupJsonFiles(dir)[0]), 'utf8'));
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

test('scrub CLI uses firebase-admin v14 modular APIs', function () {
    const src = fs.readFileSync(path.join(root, 'scripts', 'scrub-telegram-urls.js'), 'utf8');
    assert.ok(src.indexOf("requireAdmin('firebase-admin/app')") !== -1);
    assert.ok(src.indexOf("requireAdmin('firebase-admin/firestore')") !== -1);
    assert.ok(src.indexOf('getApps') !== -1);
    assert.ok(src.indexOf('getFirestore') !== -1);
    assert.ok(src.indexOf('admin.apps') === -1);
    assert.ok(src.indexOf('admin.firestore()') === -1);
    assert.ok(src.indexOf('admin.firestore.FieldPath') === -1);
    assert.strictEqual(scrub.parseArgs([]).apply, false);
    assert.strictEqual(scrub.parseArgs(['--apply']).apply, true);
    assert.strictEqual(scrub.parseArgs(['--apply']).backupDir, null);
    assert.strictEqual(scrub.parseArgs(['--apply', '--backup-dir', '/workspace/private/x']).backupDir, '/workspace/private/x');
    assert.strictEqual(scrub.parseArgs(['--backup-dir=/workspace/private/x']).backupDir, '/workspace/private/x');
    assert.strictEqual(scrub.parseArgs(['--ids-only']).idsOnly, true);
    assert.strictEqual(scrub.parseArgs([]).idsOnly, false);
    assert.ok(src.indexOf("scripts/.telegram-url-scrub") === -1);
    assert.ok(src.indexOf(".telegram-url-scrub") === -1);

    const inits = [];
    let storageCalled = false;
    const fakeDb = { kind: 'firestore' };
    const clients = scrub.initClients({
        getApps: function () { return inits.slice(); },
        initializeApp: function (opts) { inits.push(opts); return opts; },
        applicationDefault: function () { return { kind: 'adc' }; },
        getFirestore: function () { return fakeDb; },
        FieldPath: { documentId: function () { return 'docId'; } },
        getStorage: function () {
            storageCalled = true;
            return { bucket: function (name) { return { name: name }; } };
        },
    });
    assert.strictEqual(inits.length, 1);
    assert.strictEqual(inits[0].projectId, 'bitcoin-education-archive');
    assert.strictEqual(inits[0].credential.kind, 'adc');
    assert.strictEqual(clients.db, fakeDb);
    assert.strictEqual(clients.fieldPath, 'docId');
    assert.strictEqual(storageCalled, false);
    assert.strictEqual(clients.bucket().name, 'bitcoin-education-archive.firebasestorage.app');
    assert.strictEqual(storageCalled, true);

    const again = scrub.initClients({
        getApps: function () { return inits.slice(); },
        initializeApp: function (opts) { inits.push(opts); return opts; },
        applicationDefault: function () { return { kind: 'adc' }; },
        getFirestore: function () { return fakeDb; },
        FieldPath: { documentId: function () { return 'docId'; } },
        getStorage: function () { return { bucket: function (name) { return { name: name }; } }; },
    });
    assert.strictEqual(inits.length, 1);
    assert.strictEqual(again.db, fakeDb);
});


function expectCode(fn, code) {
    let caught = null;
    try { fn(); }
    catch (err) { caught = err; }
    assert.ok(caught, 'expected error ' + code);
    assert.strictEqual(caught.code, code);
}

test('apply requires a private absolute backup-dir', function () {
    expectCode(function () { scrub.assertBackupDir(); }, 'backup-dir-required');
    expectCode(function () { scrub.assertBackupDir(''); }, 'backup-dir-required');
    expectCode(function () { scrub.assertBackupDir('   '); }, 'backup-dir-required');
    expectCode(function () { scrub.assertBackupDir('scripts/.telegram-url-scrub'); }, 'backup-dir-relative');
    expectCode(function () { scrub.assertBackupDir('./telegram-scrub-backup'); }, 'backup-dir-relative');
    expectCode(function () { scrub.assertBackupDir('../private/telegram-scrub-backup'); }, 'backup-dir-relative');
    expectCode(function () {
        scrub.assertBackupDir(path.join(root, 'scripts', '.telegram-url-scrub'));
    }, 'backup-dir-repo');
    expectCode(function () { scrub.assertBackupDir(path.join(root, 'backup')); }, 'backup-dir-repo');
    expectCode(function () { scrub.assertBackupDir('/tmp/telegram-scrub-backup'); }, 'backup-dir-shared');
    expectCode(function () { scrub.assertBackupDir(path.join(os.tmpdir(), 'telegram-scrub-backup')); }, 'backup-dir-shared');
    expectCode(function () { scrub.assertBackupDir('/workspace/telegram-scrub-backup'); }, 'backup-dir-workspace');
    expectCode(function () { scrub.assertBackupDir('/workspace/private-not-allowed'); }, 'backup-dir-workspace');
    expectCode(function () {
        scrub.assertBackupDir(path.join(os.homedir(), 'Downloads', 'telegram-scrub-backup'));
    }, 'backup-dir-home');
    expectCode(function () {
        scrub.assertBackupDir(path.join(os.homedir(), 'Desktop', 'telegram-scrub-backup'));
    }, 'backup-dir-home');
    expectCode(function () { scrub.assertBackupDir(os.homedir()); }, 'backup-dir-home');

    const allowed = path.join(PRIVATE_BACKUP_ROOT, 'telegram-scrub-backup-20261118');
    assert.strictEqual(scrub.assertBackupDir(allowed), path.resolve(allowed));

    expectCode(function () {
        scrub.assertApplyAllowed({
            apply: true,
            projectId: scrub.APPLY_PROJECT_ID,
            backupDir: null,
        });
    }, 'backup-dir-required');
});

test('apply refuses a retargeted project and dry-run prints the target', function () {
    assert.strictEqual(scrub.resolveProjectId({}), 'bitcoin-education-archive');
    assert.strictEqual(scrub.resolveProjectId({ GCLOUD_PROJECT: 'other-project' }), 'other-project');
    assert.strictEqual(scrub.resolveProjectId({ GOOGLE_CLOUD_PROJECT: 'from-google' }), 'from-google');
    assert.strictEqual(scrub.resolveProjectId({
        GCLOUD_PROJECT: 'from-gcloud',
        GOOGLE_CLOUD_PROJECT: 'from-google',
    }), 'from-gcloud');
    assert.strictEqual(scrub.resolveBucket({}), 'bitcoin-education-archive.firebasestorage.app');
    assert.strictEqual(scrub.resolveBucket({ FIREBASE_STORAGE_BUCKET: 'custom-bucket' }), 'custom-bucket');

    const dir = makeFreshBackupPath();
    expectCode(function () {
        scrub.assertApplyAllowed({
            apply: true,
            projectId: 'other-project',
            backupDir: dir,
        });
    }, 'apply-project');
    expectCode(function () {
        scrub.assertApplyAllowed({
            apply: true,
            projectId: 'bitcoin-quest-staging',
            backupDir: dir,
        });
    }, 'apply-project');
    expectCode(function () {
        scrub.assertApplyAllowed({
            apply: true,
            idsOnly: true,
            projectId: scrub.APPLY_PROJECT_ID,
            backupDir: dir,
        });
    }, 'apply-ids-only');
    assert.strictEqual(
        scrub.assertApplyAllowed({
            apply: true,
            projectId: 'bitcoin-education-archive',
            backupDir: dir,
        }),
        path.resolve(dir)
    );
    scrub.assertApplyAllowed({ apply: false, projectId: 'other-project' });

    const dryLogs = [];
    const dry = scrub.prepareRun([], { GCLOUD_PROJECT: 'bitcoin-quest-staging', FIREBASE_STORAGE_BUCKET: 'staging-bucket' }, function (line) {
        dryLogs.push(line);
    });
    assert.strictEqual(dry.apply, false);
    assert.strictEqual(dry.projectId, 'bitcoin-quest-staging');
    assert.strictEqual(dry.bucketName, 'staging-bucket');
    assert.ok(dryLogs.indexOf('projectId=bitcoin-quest-staging') !== -1);
    assert.ok(dryLogs.indexOf('bucket=staging-bucket') !== -1);

    const applyLogs = [];
    const prepared = scrub.prepareRun(
        ['--apply', '--backup-dir', dir],
        { GCLOUD_PROJECT: 'bitcoin-education-archive' },
        function (line) { applyLogs.push(line); }
    );
    assert.strictEqual(prepared.apply, true);
    assert.strictEqual(prepared.projectId, 'bitcoin-education-archive');
    assert.ok(applyLogs.indexOf('projectId=bitcoin-education-archive') !== -1);
    assert.ok(applyLogs.indexOf('bucket=bitcoin-education-archive.firebasestorage.app') !== -1);

    const refusedLogs = [];
    expectCode(function () {
        scrub.prepareRun(
            ['--apply', '--backup-dir', dir],
            { GCLOUD_PROJECT: 'other-project', GOOGLE_CLOUD_PROJECT: 'other-project' },
            function (line) { refusedLogs.push(line); }
        );
    }, 'apply-project');
    assert.ok(refusedLogs.indexOf('projectId=other-project') !== -1);
    assert.ok(refusedLogs.indexOf('bucket=bitcoin-education-archive.firebasestorage.app') !== -1);
});

test('ids-only scan prints ids and field names, never URLs', async function () {
    const secretUrl = FILE_URL;
    const logs = [];
    const listed = [];
    const scan = await scrub.runIdsOnlyScan({
        log: function (line) { logs.push(line); },
        listDocs: async function (name) {
            listed.push(name);
            if (name === 'telegram_mirror_queue') {
                return [
                    { id: 'q1', data: { text: 'plain' } },
                    { id: 'q2', data: { imageUrl: secretUrl, caption: 'photo ' + secretUrl } },
                ];
            }
            if (name === 'announcements') {
                return [
                    { id: 'a1', data: { text: 'hello ' + secretUrl, link: 'https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg?alt=media' } },
                ];
            }
            throw new Error('unexpected collection ' + name);
        },
        updateDoc: function () { throw new Error('ids-only wrote'); },
    });
    assert.deepStrictEqual(listed, ['telegram_mirror_queue', 'announcements']);
    assert.deepStrictEqual(scrub.IDS_ONLY_COLLECTIONS, ['telegram_mirror_queue', 'announcements']);
    assert.strictEqual(scan.wrote, false);
    assert.strictEqual(scan.affected, 2);
    assert.strictEqual(scan.matches.length, 2);
    assert.strictEqual(scan.matches[0].id, 'q2');
    assert.strictEqual(scan.matches[0].collection, 'telegram_mirror_queue');
    assert.ok(scan.matches[0].fields.indexOf('imageUrl') !== -1);
    assert.ok(scan.matches[0].fields.indexOf('caption') !== -1);
    assert.strictEqual(scan.matches[1].id, 'a1');
    const text = logs.join('\n');
    assert.ok(text.indexOf('doc=telegram_mirror_queue/q2 fields=') !== -1);
    assert.ok(text.indexOf('imageUrl') !== -1);
    assert.ok(text.indexOf('caption') !== -1);
    assert.ok(text.indexOf('doc=announcements/a1 fields=text') !== -1);
    assert.ok(text.indexOf('ids-only matches=2') !== -1);
    assert.ok(text.indexOf('q1') === -1);
    assert.ok(text.indexOf(TOKEN) === -1);
    assert.ok(text.indexOf('TESTTOKEN') === -1);
    assert.ok(text.indexOf('api.telegram.org') === -1);
    assert.ok(text.indexOf(secretUrl) === -1);
    assert.ok(JSON.stringify(scan).indexOf(TOKEN) === -1);
    assert.ok(JSON.stringify(scan).indexOf('api.telegram.org') === -1);

    const preparedLogs = [];
    const prepared = scrub.prepareRun(['--ids-only'], { GCLOUD_PROJECT: 'bitcoin-quest-staging' }, function (line) {
        preparedLogs.push(line);
    });
    assert.strictEqual(prepared.idsOnly, true);
    assert.strictEqual(prepared.apply, false);
    assert.ok(preparedLogs.indexOf('projectId=bitcoin-quest-staging') !== -1);
});

test('apply backup uses mode 0700/0600 and is refused without a valid dir', async function () {
    const dir = makeFreshBackupPath();
    const file = scrub.writeBackup(dir, [{ collection: 'global_chat', id: 'n1', data: { text: 'ok' } }], '2026-11-18T00:00:00.000Z');
    const dirMode = fs.statSync(dir).mode & 0o777;
    const fileMode = fs.statSync(file).mode & 0o777;
    assert.strictEqual(dirMode, 0o700);
    assert.strictEqual(fileMode, 0o600);

    let listed = false;
    let wrote = false;
    let caught = null;
    try {
        await scrub.runScrub({
            apply: true,
            projectId: scrub.APPLY_PROJECT_ID,
            db: {
                collection: function () {
                    return { doc: function () { return { get: async function () { return { exists: false, data: function () { return null; } }; } }; } };
                },
            },
            listDocs: async function () { listed = true; return []; },
            updateDoc: function () { wrote = true; throw new Error('apply wrote without backup-dir'); },
            rehost: function () { throw new Error('apply fetched without backup-dir'); },
        });
    } catch (err) { caught = err; }
    assert.ok(caught);
    assert.strictEqual(caught.code, 'backup-dir-required');
    assert.strictEqual(listed, false);
    assert.strictEqual(wrote, false);

    let stagingListed = false;
    try {
        await scrub.runScrub({
            apply: true,
            projectId: 'bitcoin-quest-staging',
            backupDir: dir,
            db: {
                collection: function () {
                    return { doc: function () { return { get: async function () { return { exists: false, data: function () { return null; } }; } }; } };
                },
            },
            listDocs: async function () { stagingListed = true; return []; },
            updateDoc: function () { throw new Error('staging apply wrote'); },
        });
    } catch (err) { caught = err; }
    assert.strictEqual(caught.code, 'apply-project');
    assert.strictEqual(stagingListed, false);
});


function expectRefused(fn, codes) {
    let caught = null;
    try { fn(); }
    catch (err) { caught = err; }
    assert.ok(caught, 'expected refusal ' + codes.join('|'));
    assert.ok(codes.indexOf(caught.code) !== -1, 'expected one of ' + codes.join(',') + ' got ' + (caught && caught.code) + ' ' + (caught && caught.message));
}

test('backup-dir refuses world-writable paths and symlinks into them', function () {
    expectRefused(function () {
        scrub.assertBackupDir('/dev/shm/telegram-scrub-backup');
    }, ['backup-dir-shared', 'backup-dir-writable']);

    const holder = makePrivateBackupDir();
    const link = path.join(holder, 'link-shm');
    fs.symlinkSync('/dev/shm', link);
    expectRefused(function () {
        scrub.assertBackupDir(path.join(link, 'backup'));
    }, ['backup-dir-shared', 'backup-dir-writable']);

    const ww = makePrivateBackupDir();
    fs.chmodSync(ww, 0o777);
    try {
        expectCode(function () { scrub.assertBackupDir(ww); }, 'backup-dir-writable');
        expectCode(function () { scrub.assertBackupDir(path.join(ww, 'child')); }, 'backup-dir-writable');
        const holder2 = makePrivateBackupDir();
        const linkWw = path.join(holder2, 'link-ww');
        fs.symlinkSync(ww, linkWw);
        expectCode(function () {
            scrub.assertBackupDir(path.join(linkWw, 'backup'));
        }, 'backup-dir-writable');
    } finally {
        try { fs.chmodSync(ww, 0o700); } catch (err) { /* ignore */ }
    }
});

test('apply refuses a retargeted storage bucket and still prints it', function () {
    const dir = makeFreshBackupPath();
    expectCode(function () {
        scrub.assertApplyAllowed({
            apply: true,
            projectId: scrub.APPLY_PROJECT_ID,
            bucketName: 'not-the-live-bucket',
            env: {},
            backupDir: dir,
        });
    }, 'apply-bucket');
    expectCode(function () {
        scrub.assertApplyAllowed({
            apply: true,
            projectId: scrub.APPLY_PROJECT_ID,
            bucketName: scrub.APPLY_BUCKET,
            env: { FIREBASE_STORAGE_BUCKET: 'not-the-live-bucket' },
            backupDir: dir,
        });
    }, 'apply-bucket');
    assert.strictEqual(
        scrub.assertApplyAllowed({
            apply: true,
            projectId: scrub.APPLY_PROJECT_ID,
            bucketName: scrub.APPLY_BUCKET,
            env: {},
            backupDir: dir,
        }),
        path.resolve(dir)
    );
    assert.strictEqual(
        scrub.assertApplyAllowed({
            apply: true,
            projectId: scrub.APPLY_PROJECT_ID,
            bucketName: scrub.APPLY_BUCKET,
            env: { FIREBASE_STORAGE_BUCKET: scrub.APPLY_BUCKET },
            backupDir: dir,
        }),
        path.resolve(dir)
    );

    const refusedLogs = [];
    expectCode(function () {
        scrub.prepareRun(
            ['--apply', '--backup-dir', dir],
            {
                GCLOUD_PROJECT: 'bitcoin-education-archive',
                FIREBASE_STORAGE_BUCKET: 'not-the-live-bucket',
            },
            function (line) { refusedLogs.push(line); }
        );
    }, 'apply-bucket');
    assert.ok(refusedLogs.indexOf('projectId=bitcoin-education-archive') !== -1);
    assert.ok(refusedLogs.indexOf('bucket=not-the-live-bucket') !== -1);

    const applyLogs = [];
    const prepared = scrub.prepareRun(
        ['--apply', '--backup-dir', dir],
        {
            GCLOUD_PROJECT: 'bitcoin-education-archive',
            FIREBASE_STORAGE_BUCKET: 'bitcoin-education-archive.firebasestorage.app',
        },
        function (line) { applyLogs.push(line); }
    );
    assert.strictEqual(prepared.apply, true);
    assert.strictEqual(prepared.bucketName, scrub.APPLY_BUCKET);
    assert.ok(applyLogs.indexOf('bucket=bitcoin-education-archive.firebasestorage.app') !== -1);

    const dryLogs = [];
    const dry = scrub.prepareRun(
        [],
        { GCLOUD_PROJECT: 'bitcoin-quest-staging', FIREBASE_STORAGE_BUCKET: 'staging-bucket' },
        function (line) { dryLogs.push(line); }
    );
    assert.strictEqual(dry.apply, false);
    assert.strictEqual(dry.bucketName, 'staging-bucket');
    assert.ok(dryLogs.indexOf('bucket=staging-bucket') !== -1);

    const idsLogs = [];
    const ids = scrub.prepareRun(['--ids-only'], {}, function (line) { idsLogs.push(line); });
    assert.strictEqual(ids.apply, false);
    assert.ok(idsLogs.indexOf('bucket=bitcoin-education-archive.firebasestorage.app') !== -1);
});

test('backup-dir must be a new dedicated directory', function () {
    expectCode(function () { scrub.assertBackupDir('/workspace/private'); }, 'backup-dir-dedicated');
    expectCode(function () { scrub.assertBackupDir('/workspace/private/'); }, 'backup-dir-dedicated');
    expectCode(function () {
        scrub.assertBackupDir('/workspace/private/redteam-audit');
    }, 'backup-dir-dedicated');
    expectCode(function () {
        scrub.assertBackupDir('/workspace/private/redteam-audit/nested');
    }, 'backup-dir-dedicated');

    const dirty = makePrivateBackupDir();
    fs.writeFileSync(path.join(dirty, 'keep.txt'), 'leave-me');
    fs.chmodSync(dirty, 0o755);
    const before = fs.statSync(dirty).mode & 0o777;
    expectCode(function () { scrub.assertBackupDir(dirty); }, 'backup-dir-not-empty');
    expectCode(function () {
        scrub.writeBackup(dirty, [{ collection: 'global_chat', id: 'n1', data: { text: 'ok' } }], '2026-11-18T01:00:00.000Z');
    }, 'backup-dir-not-empty');
    assert.strictEqual(fs.statSync(dirty).mode & 0o777, before);
    assert.deepStrictEqual(fs.readdirSync(dirty), ['keep.txt']);
    assert.strictEqual(fs.readFileSync(path.join(dirty, 'keep.txt'), 'utf8'), 'leave-me');

    const freshName = path.join(PRIVATE_BACKUP_ROOT, 'telegram-scrub-backup-fresh-' + Date.now());
    cleanupDirs.push(freshName);
    assert.strictEqual(scrub.assertBackupDir(freshName), path.resolve(freshName));
    assert.strictEqual(fs.existsSync(freshName), false);
    const created = scrub.writeBackup(freshName, [{ collection: 'global_chat', id: 'n2', data: { text: 'ok' } }], '2026-11-18T01:00:00.000Z');
    assert.strictEqual(fs.statSync(freshName).mode & 0o777, 0o700);
    assert.strictEqual(fs.statSync(created).mode & 0o777, 0o600);
});

test('backup writes use wx and keep the first file on retry', function () {
    const dir = makeFreshBackupPath();
    const stamp = '2026-11-18T00:00:00.000Z';
    const first = scrub.writeBackup(dir, [{ collection: 'global_chat', id: 'x', data: { text: 'first' } }], stamp);
    const firstBody = fs.readFileSync(first, 'utf8');
    assert.ok(firstBody.indexOf('"id":"x"') !== -1);
    assert.strictEqual(fs.lstatSync(first).isSymbolicLink(), false);
    assert.strictEqual(fs.statSync(first).mode & 0o777, 0o600);
    assert.strictEqual(fs.statSync(dir).mode & 0o777, 0o700);

    const second = scrub.writeBackup(dir, [{ collection: 'global_chat', id: 'y', data: { text: 'second' } }], stamp);
    assert.notStrictEqual(second, first);
    assert.strictEqual(fs.readFileSync(first, 'utf8'), firstBody);
    const secondBody = fs.readFileSync(second, 'utf8');
    assert.ok(secondBody.indexOf('"id":"y"') !== -1);
    assert.ok(secondBody.indexOf('"id":"x"') === -1);
    assert.strictEqual(fs.statSync(second).mode & 0o777, 0o600);
    assert.ok(second.indexOf('backup-2026-11-18T00-00-00-000Z-2.json') !== -1);

    const plantedDir = makeFreshBackupPath();
    scrub.writeBackup(plantedDir, [{ collection: 'global_chat', id: 'seed', data: { text: 'seed' } }], '2026-11-18T01:59:00.000Z');
    const intended = path.join(plantedDir, 'backup-2026-11-18T02-00-00-000Z.json');
    const leakTarget = path.join(PRIVATE_BACKUP_ROOT, 'telegram-scrub-symlink-target-' + Date.now() + '.json');
    cleanupDirs.push(leakTarget);
    fs.writeFileSync(leakTarget, 'ORIGINAL-DO-NOT-CLOBBER', { mode: 0o600 });
    fs.symlinkSync(leakTarget, intended);
    const written = scrub.writeBackup(
        plantedDir,
        [{ collection: 'global_chat', id: 'z', data: { text: 'safe' } }],
        '2026-11-18T02:00:00.000Z'
    );
    assert.notStrictEqual(written, intended);
    assert.strictEqual(fs.lstatSync(intended).isSymbolicLink(), true);
    assert.strictEqual(fs.readFileSync(leakTarget, 'utf8'), 'ORIGINAL-DO-NOT-CLOBBER');
    assert.strictEqual(fs.lstatSync(written).isSymbolicLink(), false);
    assert.ok(fs.readFileSync(written, 'utf8').indexOf('"id":"z"') !== -1);
    assert.strictEqual(fs.statSync(written).mode & 0o777, 0o600);

    const escapeDir = makeFreshBackupPath();
    const escaped = scrub.writeBackup(
        escapeDir,
        [{ collection: 'global_chat', id: 'e', data: { text: 'ok' } }],
        '2026-11-18T00:00:00.000Z/../escape'
    );
    assert.strictEqual(path.dirname(escaped), path.resolve(escapeDir));
    assert.ok(fs.existsSync(escaped));
});

test('apply refuses a pre-existing backup-dir unless it has this tool\'s marker', function () {
    const existing = makePrivateBackupDir();
    expectCode(function () { scrub.assertBackupDir(existing); }, 'backup-dir-exists');
    expectCode(function () {
        scrub.writeBackup(existing, [{ collection: 'global_chat', id: 'n1', data: { text: 'ok' } }], '2026-11-18T03:00:00.000Z');
    }, 'backup-dir-exists');
    assert.strictEqual(fs.readdirSync(existing).length, 0);

    const holder = makePrivateBackupDir();
    const link = path.join(holder, 'link-dir');
    fs.symlinkSync(existing, link);
    expectCode(function () { scrub.assertBackupDir(link); }, 'backup-dir-symlink');
    expectCode(function () {
        scrub.writeBackup(link, [{ collection: 'global_chat', id: 'n1', data: { text: 'ok' } }], '2026-11-18T03:00:00.000Z');
    }, 'backup-dir-symlink');
    assert.strictEqual(fs.lstatSync(link).isSymbolicLink(), true);
    assert.strictEqual(fs.readdirSync(existing).length, 0);

    const fresh = makeFreshBackupPath();
    const file = scrub.writeBackup(fresh, [{ collection: 'global_chat', id: 'a', data: { text: 'ok' } }], '2026-11-18T03:00:00.000Z');
    assert.strictEqual(scrub.assertBackupDir(fresh), path.resolve(fresh));
    assert.ok(fs.existsSync(path.join(fresh, scrub.BACKUP_DIR_MARKER)));
    assert.strictEqual(fs.lstatSync(fresh).isSymbolicLink(), false);
    assert.strictEqual(fs.statSync(fresh).mode & 0o777, 0o700);
    const second = scrub.writeBackup(fresh, [{ collection: 'global_chat', id: 'b', data: { text: 'ok' } }], '2026-11-18T03:00:00.000Z');
    assert.notStrictEqual(second, file);
    assert.ok(fs.existsSync(file));
    assert.strictEqual(backupJsonFiles(fresh).length, 2);
});

test('apply prints the backup-dir path and same-dir retry keeps earlier backups', async function () {
    const dir = makeFreshBackupPath();
    const resolved = path.resolve(dir);
    const secretUrl = FILE_URL;
    const rows = [
        { id: 'photo', data: { text: 'pic', imageUrl: secretUrl } },
        { id: 'gone', data: { text: 'old', gifUrl: secretUrl } },
    ];
    const leftoverRows = [
        { id: 'gone', data: { text: 'old', gifUrl: secretUrl } },
        { id: 'done', data: { text: 'done', mediaRemoved: true, gifUrl: null } },
    ];

    function makeDb(markerState) {
        const marker = markerState || {};
        return {
            collection: function (name) {
                return {
                    doc: function (id) {
                        return {
                            get: async function () {
                                if (marker.applied) return { exists: true, data: function () { return marker; } };
                                return { exists: false, data: function () { return null; } };
                            },
                            set: async function (data) { Object.assign(marker, data); },
                        };
                    },
                };
            },
        };
    }

    const logs = [];
    let caught = null;
    try {
        await scrub.runScrub({
            apply: true,
            db: makeDb({}),
            backupDir: dir,
            nowIso: '2026-11-18T04:00:00.000Z',
            log: function (line) { logs.push(line); },
            listDocs: async function () { return rows; },
            updateDoc: async function (collection, id) {
                if (id === 'gone') throw new Error('simulated mid-apply failure');
            },
            rehost: async function () { return null; },
        });
    } catch (err) { caught = err; }
    assert.ok(caught);
    assert.ok(String(caught.message).indexOf('simulated mid-apply failure') !== -1);
    const text = logs.join('\n');
    assert.ok(text.indexOf('backup-dir=' + resolved) !== -1);
    assert.ok(text.indexOf('partial failure. re-run with the SAME --backup-dir ' + resolved) !== -1);
    assert.ok(text.indexOf(TOKEN) === -1);
    const startIdx = logs.findIndex(function (line) { return line === 'backup-dir=' + resolved; });
    const writtenIdx = logs.findIndex(function (line) { return line.indexOf('backup-written') !== -1; });
    const endIdx = logs.findIndex(function (line) { return line.indexOf('SAME --backup-dir ' + resolved) !== -1; });
    assert.ok(startIdx !== -1 && writtenIdx !== -1 && endIdx !== -1);
    assert.ok(startIdx < writtenIdx);
    assert.ok(writtenIdx < endIdx);
    assert.strictEqual(backupJsonFiles(dir).length, 1);
    const firstFile = path.join(dir, backupJsonFiles(dir)[0]);
    const firstBody = fs.readFileSync(firstFile, 'utf8');
    assert.ok(firstBody.indexOf('"id":"photo"') !== -1);
    assert.ok(firstBody.indexOf('"id":"gone"') !== -1);
    assert.ok(fs.existsSync(path.join(dir, scrub.BACKUP_DIR_MARKER)));

    const retryLogs = [];
    const retry = await scrub.runScrub({
        apply: true,
        db: makeDb({}),
        backupDir: dir,
        nowIso: '2026-11-18T04:00:00.000Z',
        log: function (line) { retryLogs.push(line); },
        listDocs: async function () { return leftoverRows; },
        updateDoc: async function () { return; },
        rehost: async function () { return null; },
    });
    assert.strictEqual(retry.wrote, true);
    assert.strictEqual(backupJsonFiles(dir).length, 2);
    assert.ok(retry.backupFile.indexOf('backup-2026-11-18T04-00-00-000Z-2.json') !== -1);
    assert.strictEqual(fs.readFileSync(firstFile, 'utf8'), firstBody);
    assert.strictEqual(fs.statSync(retry.backupFile).mode & 0o777, 0o600);
    const retryText = retryLogs.join('\n');
    assert.ok(retryText.indexOf(TOKEN) === -1);
    const retryStart = retryLogs.findIndex(function (line) { return line === 'backup-dir=' + resolved; });
    const retryEnd = retryLogs.lastIndexOf('backup-dir=' + resolved);
    assert.ok(retryStart !== -1 && retryEnd > retryStart);
    assert.ok(retryText.indexOf('new backup-dir') === -1);
    assert.ok(retryText.indexOf('WARNING:') === -1);

    const fresh = makeFreshBackupPath();
    const freshResolved = path.resolve(fresh);
    const freshLogs = [];
    const freshRun = await scrub.runScrub({
        apply: true,
        db: makeDb({}),
        backupDir: fresh,
        nowIso: '2026-11-18T05:00:00.000Z',
        log: function (line) { freshLogs.push(line); },
        listDocs: async function () { return leftoverRows; },
        updateDoc: async function () { return; },
        rehost: async function () { return null; },
    });
    assert.strictEqual(freshRun.wrote, true);
    const freshText = freshLogs.join('\n');
    assert.ok(freshText.indexOf('backup-dir=' + freshResolved) !== -1);
    assert.ok(freshLogs[0] === 'backup-dir=' + freshResolved || freshLogs.indexOf('backup-dir=' + freshResolved) === 0 || freshLogs.indexOf('backup-dir=' + freshResolved) !== -1);
    const freshStart = freshLogs.findIndex(function (line) { return line === 'backup-dir=' + freshResolved; });
    const freshEnd = freshLogs.lastIndexOf('backup-dir=' + freshResolved);
    assert.ok(freshStart !== -1 && freshEnd > freshStart);
    assert.ok(freshText.indexOf('WARNING: some documents already have mediaRemoved set') !== -1);
    assert.ok(freshText.indexOf('SAME --backup-dir') !== -1);
    assert.ok(freshText.indexOf('A new directory only backs up remaining documents.') !== -1);
    assert.ok(freshText.indexOf(TOKEN) === -1);
});

Promise.all(queue).then(function () {
    cleanupDirs.forEach(rmDir);
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
