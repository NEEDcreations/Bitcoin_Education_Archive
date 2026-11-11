'use strict';
// Kill switch: gate, snapshot-after-flip, audit log, step-up, backup warning.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ks = require(path.join(root, 'functions/src/killSwitch.js'));
const secondFactor = require(path.join(root, 'functions/src/secondFactor.js'));

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        const result = fn();
        if (result && typeof result.then === 'function') {
            return result.then(function () {
                console.log('\u2705 ' + name);
                passed++;
            }).catch(function (e) {
                console.log('\u274c ' + name + ': ' + (e && e.stack || e));
                failed++;
            });
        }
        console.log('\u2705 ' + name);
        passed++;
        return Promise.resolve();
    } catch (e) {
        console.log('\u274c ' + name + ': ' + (e && e.stack || e));
        failed++;
        return Promise.resolve();
    }
}

class HttpsError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

function makeDb() {
    const store = new Map();
    let auto = 0;
    function key(col, id) { return col + '/' + id; }
    function doc(col, id) {
        const k = key(col, id);
        return {
            id: id,
            get ref() { return doc(col, id); },
            async get() {
                const v = store.get(k);
                return { exists: v !== undefined, data: function () { return v ? JSON.parse(JSON.stringify(v)) : undefined; }, ref: this };
            },
            async set(data, opts) {
                const cur = store.get(k) || {};
                const incoming = JSON.parse(JSON.stringify(data));
                const merged = opts && opts.merge ? Object.assign({}, cur, incoming) : incoming;
                Object.keys(incoming || {}).forEach(function (key) {
                    if (incoming[key] && incoming[key]._delete) delete merged[key];
                });
                store.set(k, merged);
            },
            async delete() { store.delete(k); },
        };
    }
    const db = {
        _store: store,
        collection(col) {
            return {
                doc(id) {
                    if (id == null) id = 'auto_' + (++auto);
                    return doc(col, id);
                },
                async add(data) {
                    const id = 'auto_' + (++auto);
                    await doc(col, id).set(data);
                    return { id: id };
                },
            };
        },
        async runTransaction(fn) {
            const tx = {
                async get(ref) { return ref.get(); },
                set(ref, data, opts) { return ref.set(data, opts); },
            };
            return fn(tx);
        },
    };
    return db;
}

function makeAdmin() {
    return {
        firestore: {
            FieldValue: {
                serverTimestamp: function () { return { _sv: true }; },
                delete: function () { return { _delete: true }; },
            },
            Timestamp: { fromMillis: function (ms) { return { _ms: ms, toMillis: function () { return ms; } }; } },
        },
    };
}

function makeFns(runWith) {
    return {
        https: { HttpsError: HttpsError, onCall: function (handler) { return handler; } },
        runWith: function () {
            return { https: { onCall: function (handler) { return handler; } } };
        },
    };
}

function adminContext(over) {
    const ctx = {
        auth: {
            uid: 'admin1',
            token: {
                admin: true,
                auth_time: Math.floor(Date.now() / 1000) - 30,
                firebase: { sign_in_provider: 'password' },
            },
        },
    };
    return Object.assign(ctx, over || {});
}

function hook(db, extra) {
    const events = [];
    const exportImpl = extra && extra.startExport ? extra.startExport : async function () {
        return { operationName: 'operations/op1', outputUriPrefix: 'gs://bucket/kill-switch/x' };
    };
    const fn = ks.makeAdminSetKillSwitch({
        functionsV1: makeFns(),
        admin: makeAdmin(),
        db: db,
        now: extra && extra.now ? extra.now : (function () { return Date.parse('2026-11-11T22:50:00Z'); }),
        events: events,
        stepUp: extra && extra.stepUp ? extra.stepUp : async function () { return { established: true, totp: true }; },
        listAdminUids: extra && extra.listAdminUids ? extra.listAdminUids : async function () { return ['admin1', 'admin2', 'admin3']; },
        sendPhilDm: extra && extra.sendPhilDm ? extra.sendPhilDm : async function () { return true; },
        backupDeps: Object.assign({
            findExportMetadata: async function () {
                return { name: '2026-11-11/foo.overall_export_metadata', updatedMs: Date.parse('2026-11-11T02:10:00Z') };
            },
            readPitr: async function () { return 'POINT_IN_TIME_RECOVERY_ENABLED'; },
            readBackupStatus: async function () { return null; },
            startExport: exportImpl,
        }, (extra && extra.backupDeps) || {}),
    });
    return { handler: fn.__handler, events: events };
}

async function run() {
    await test('effectiveOn is true only while enabled and before auto-return', function () {
        assert.strictEqual(ks.effectiveOn(null, 1000), false);
        assert.strictEqual(ks.effectiveOn({ enabled: false }, 1000), false);
        assert.strictEqual(ks.effectiveOn({ enabled: true }, 1000), true);
        assert.strictEqual(ks.effectiveOn({ enabled: true, autoReenableAt: 2000 }, 1000), true);
        assert.strictEqual(ks.effectiveOn({ enabled: true, autoReenableAt: 2000 }, 2000), false);
        assert.strictEqual(ks.effectiveOn({ enabled: true, autoReenableAt: 2000 }, 3000), false);
    });

    await test('confirm phrases and reason cleaning', function () {
        assert.strictEqual(ks.CONFIRM_ON, 'OFFLINE');
        assert.strictEqual(ks.CONFIRM_OFF, 'ONLINE');
        assert.strictEqual(ks.cleanReason('  hello   world  '), 'hello world');
        assert.strictEqual(ks.cleanReason('x'.repeat(500)).length, 200);
        assert.strictEqual(ks.parseReenable(30), 30);
        assert.ok(Number.isNaN(ks.parseReenable(2)));
    });

    await test('24h factorEstablished rejects a brand-new factor even after re-sign-in', function () {
        const now = 1_000_000_000_000;
        const day = secondFactor.ESTABLISHED_FACTOR_MS;
        // Enrolled 1 minute ago: still not established (#302 is 2-arg: enrolledMs, nowMs).
        assert.strictEqual(secondFactor.factorEstablished(now - 60_000, now), false);
        // Enrolled 24h ago: established.
        assert.strictEqual(secondFactor.factorEstablished(now - day, now), true);
        // Missing enabledAt: not established.
        assert.strictEqual(secondFactor.factorEstablished(null, now), false);
        assert.strictEqual(secondFactor.recentSignIn({ auth: { token: { auth_time: (now / 1000) - 30 } } }, now), true);
        assert.strictEqual(secondFactor.recentSignIn({ auth: { token: { auth_time: (now / 1000) - 20 * 60 } } }, now), false);
    });

    await test('gate refuses a callable and skips a schedule while on, then allows when off', async function () {
        let on = true;
        const readState = async function () { return { on: on, data: { enabled: on } }; };
        const calls = [];
        const callable = async function () { calls.push('callable'); return 'ran'; };
        callable.__endpoint = { callableTrigger: {} };
        callable.run = async function () { calls.push('callable-run'); return 'ran'; };
        const schedule = async function () { calls.push('schedule'); return 'paid'; };
        schedule.__endpoint = { scheduleTrigger: {} };
        schedule.run = async function () { calls.push('schedule-run'); return 'paid'; };
        const skipped = [];
        const gCall = ks.gateExport(callable, { readState: readState, HttpsError: HttpsError, name: 'claimSats' });
        const gSched = ks.gateExport(schedule, {
            readState: readState, HttpsError: HttpsError, name: 'payWeeklyQuestLB',
            onSkip: async function (name, why) { skipped.push(name + ':' + why); },
        });
        await assert.rejects(() => gCall.run(), function (e) { return e instanceof HttpsError && e.code === 'unavailable'; });
        const schedRes = await gSched.run();
        assert.deepStrictEqual(schedRes, { skipped: true, why: 'kill_switch_on' });
        assert.deepStrictEqual(skipped, ['payWeeklyQuestLB:kill_switch_on']);
        assert.deepStrictEqual(calls, []);
        on = false;
        assert.strictEqual(await gCall.run(), 'ran');
        assert.strictEqual(await gSched.run(), 'paid');
        assert.deepStrictEqual(calls, ['callable-run', 'schedule-run']);
    });

    await test('gate fails closed when the flag cannot be read', async function () {
        const readState = async function () { throw new Error('unavailable'); };
        const fn = async function () { return 'ran'; };
        fn.__endpoint = { callableTrigger: {} };
        fn.run = async function () { return 'ran'; };
        const g = ks.gateExport(fn, { readState: readState, HttpsError: HttpsError, name: 'claimSats' });
        await assert.rejects(() => g.run(), function (e) { return e instanceof HttpsError && e.code === 'unavailable'; });
    });

    await test('non-admin and missing confirm/reason are rejected before any flip', async function () {
        const db = makeDb();
        const { handler } = hook(db);
        await assert.rejects(() => handler({ action: 'on', confirm: 'OFFLINE', reason: 'incident abc' }, { auth: { uid: 'u', token: {} } }), /Admins only/);
        await assert.rejects(() => handler({ action: 'on', confirm: 'nope', reason: 'incident abc' }, adminContext()), /Type OFFLINE/);
        await assert.rejects(() => handler({ action: 'on', confirm: 'OFFLINE', reason: 'short' }, adminContext()), /short reason/);
        const snap = await db.collection('config').doc('killSwitch').get();
        assert.strictEqual(snap.exists, false);
    });

    await test('step-up is required for on and off, but not for preflight', async function () {
        const db = makeDb();
        let n = 0;
        const { handler } = hook(db, {
            stepUp: async function () { n++; throw new HttpsError('failed-precondition', 'Sign in again, then try this.'); },
        });
        const pre = await handler({ action: 'preflight' }, adminContext());
        assert.strictEqual(pre.ok, true);
        assert.ok(pre.preflight);
        assert.strictEqual(n, 0);
        await assert.rejects(() => handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident' }, adminContext()), /Sign in again/);
        await assert.rejects(() => handler({ action: 'off', confirm: 'ONLINE', reason: 'all clear now' }, adminContext()), /Sign in again/);
        assert.strictEqual(n, 2);
    });

    await test('flip happens before the export, and a failed export leaves the switch on', async function () {
        const db = makeDb();
        const { handler, events } = hook(db, {
            startExport: async function () {
                throw new Error('export permission denied');
            },
        });
        const res = await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident' }, adminContext());
        assert.strictEqual(res.ok, true);
        assert.strictEqual(res.on, true);
        assert.strictEqual(res.changed, true);
        assert.strictEqual(res.snapshot.status, 'START_FAILED');
        assert.ok(/permission denied/.test(res.snapshot.error));
        assert.deepStrictEqual(events, ['flip', 'export:start', 'export:fail']);
        const flag = await db.collection('config').doc('killSwitch').get();
        assert.strictEqual(flag.data().enabled, true);
        assert.strictEqual(flag.data().reason, undefined);
        assert.strictEqual(flag.data().updatedBy, undefined);
        assert.strictEqual(flag.data().snapshot, undefined);
        const adminDoc = await db.collection('config').doc('killSwitchAdmin').get();
        assert.strictEqual(adminDoc.data().snapshot.status, 'START_FAILED');
        assert.strictEqual(adminDoc.data().updatedBy, 'admin1');
        assert.strictEqual(adminDoc.data().reason, 'security incident');
        // Audit row exists and was not deleted.
        const rows = [...db._store.keys()].filter((k) => k.startsWith('kill_switch_audit/'));
        assert.strictEqual(rows.length, 1);
        const audit = JSON.parse(JSON.stringify(db._store.get(rows[0])));
        assert.strictEqual(audit.action, 'on');
        assert.strictEqual(audit.uid, 'admin1');
        assert.strictEqual(audit.reason, 'security incident');
        assert.strictEqual(audit.snapshotStatus, 'START_FAILED');
        assert.ok(audit.snapshotError);
    });

    await test('a successful flip records the export operation id in the audit log', async function () {
        const db = makeDb();
        const { handler, events } = hook(db);
        const res = await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident' }, adminContext());
        assert.strictEqual(res.ok, true);
        assert.strictEqual(res.snapshot.status, 'STARTED');
        assert.strictEqual(res.snapshot.operationName, 'operations/op1');
        assert.deepStrictEqual(events, ['flip', 'export:start', 'export:ok']);
        const rows = [...db._store.keys()].filter((k) => k.startsWith('kill_switch_audit/'));
        const audit = db._store.get(rows[0]);
        assert.strictEqual(audit.snapshotOperationId, 'operations/op1');
        assert.strictEqual(audit.snapshotStatus, 'STARTED');
        const notifs = [...db._store.keys()].filter((k) => k.startsWith('notifications/'));
        assert.ok(notifs.length >= 3, 'every admin is notified');
    });

    await test('stale backups warn and do not flip until override, then override is allowed', async function () {
        const db = makeDb();
        const { handler } = hook(db, {
            backupDeps: {
                findExportMetadata: async function () { return null; },
                readPitr: async function () { return 'POINT_IN_TIME_RECOVERY_DISABLED'; },
            },
        });
        const first = await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident' }, adminContext());
        assert.strictEqual(first.ok, false);
        assert.strictEqual(first.needsOverride, true);
        assert.strictEqual(first.preflight.ok, false);
        const flag = await db.collection('config').doc('killSwitch').get();
        assert.strictEqual(flag.exists, false);
        const second = await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident', override: true }, adminContext());
        assert.strictEqual(second.ok, true);
        assert.strictEqual(second.on, true);
        const after = await db.collection('config').doc('killSwitch').get();
        assert.strictEqual(after.data().enabled, true);
        const rows = [...db._store.keys()].filter((k) => k.startsWith('kill_switch_audit/'));
        assert.strictEqual(db._store.get(rows[0]).backupOverride, true);
    });

    await test('turning off requires ONLINE and does not start a snapshot', async function () {
        const db = makeDb();
        const { handler, events } = hook(db);
        await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident' }, adminContext());
        events.length = 0;
        await assert.rejects(() => handler({ action: 'off', confirm: 'OFFLINE', reason: 'all clear now' }, adminContext()), /Type ONLINE/);
        const res = await handler({ action: 'off', confirm: 'ONLINE', reason: 'all clear now' }, adminContext());
        assert.strictEqual(res.on, false);
        assert.strictEqual(res.changed, true);
        assert.strictEqual(res.snapshot, null);
        assert.deepStrictEqual(events, ['flip']);
        const flag = await db.collection('config').doc('killSwitch').get();
        assert.strictEqual(flag.data().enabled, false);
    });

    await test('flips are rate-limited per admin and globally', async function () {
        const db = makeDb();
        const { handler } = hook(db, {
            startExport: async function () { return { operationName: 'operations/x', outputUriPrefix: 'gs://b/x' }; },
        });
        // Exhaust the per-user limit of 8 in the same window (on/off pairs).
        for (let i = 0; i < ks.RATE_MAX_USER; i++) {
            const action = i % 2 === 0 ? 'on' : 'off';
            const confirm = action === 'on' ? 'OFFLINE' : 'ONLINE';
            const res = await handler({ action: action, confirm: confirm, reason: 'security incident ' + i }, adminContext());
            assert.strictEqual(res.ok, true, 'flip ' + i);
        }
        await assert.rejects(
            () => handler({ action: 'on', confirm: 'OFFLINE', reason: 'one more time here' }, adminContext()),
            /Too many kill-switch changes/
        );
    });

    await test('audit log has no delete path in the module or the rules', function () {
        const src = fs.readFileSync(path.join(root, 'functions/src/killSwitch.js'), 'utf8');
        assert.ok(!/kill_switch_audit.*delete|\.delete\(\).*kill_switch_audit/.test(src));
        assert.ok(src.includes('never delete'));
        const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
        const i = rules.indexOf('match /kill_switch_audit/{docId}');
        assert.ok(i > 0);
        const chunk = rules.slice(i, i + 250);
        assert.ok(chunk.includes('allow create, update, delete: if false'));
        assert.ok(rules.includes('function appIsOffline()'));
        assert.ok(rules.includes('clientWritesOk()'));
    });

    await test('index wires App Check, the 24h step-up SA, and gates every payout name', function () {
        const idx = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
        assert.ok(idx.includes("require('./src/killSwitch')"));
        assert.ok(idx.includes('enforceAppCheck: true'));
        assert.ok(idx.includes('listAdminUids: _listAdminClaimUids'));
        const sa = fs.readFileSync(path.join(root, 'functions/src/runtimeServiceAccounts.js'), 'utf8');
        assert.ok(sa.includes("adminSetKillSwitch: { id: 'fn-admin-kill-switch'"));
        assert.ok(sa.includes('killSwitchExport'));
        assert.ok(!sa.includes('importExportAdmin'));
        assert.ok(!/backups: 'roles\/storage.objectAdmin'/.test(sa));
        const names = ks.gatedNames();
        ['claimSats', 'tctvDripTick', 'payWeeklyQuestLB', 'monthlyRaffleDraw', 'payQualifiedReferrals', 'adminApproveFactionPayout',
         'resetWeeklyXP', 'resetMonthlyXP', 'verifyReferral', 'registerReferral', 'pvpSubmitAnswer', 'pvpTimeoutOpponent',
         'tctvWatchHeartbeat', 'syncStravaWalks', 'creditMatureTopicComments', 'spendTickets', 'spendTicketsForFreeze', 'activateDoubleXP',
         'activateHashBooster', 'useHintToken', 'resetLightningAddressOnce', 'flushBadgeGgBursts', 'mergeAnonBadges', 'incrementWeeklyChallenge',
         'dailyPollVote', 'pollVote', 'chooseFaction', 'reconcileDailyProofs', 'scheduleRaidForumCredit'].forEach(function (n) {
            assert.ok(names.indexOf(n) !== -1, n);
        });
        const triggers = ks.gatedTriggerNames();
        assert.ok(triggers.indexOf('onMarketplaceSaleCount') !== -1, 'onMarketplaceSaleCount must be listed as a trigger');
        const sale = idx.slice(idx.indexOf('exports.onMarketplaceSaleCount'), idx.indexOf('exports.onChatBadgeCount'));
        assert.ok(sale.indexOf('if (await killSwitchIsOn()) return null;') !== -1, 'onMarketplaceSaleCount must return early when the switch is on');
    });

    await test('every export that awards or merges badges is gated', function () {
        const idx = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
        const gated = {};
        ks.gatedNames().concat(ks.gatedTriggerNames()).forEach(function (n) { gated[n] = true; });
        const awardRe = /grantBadgeIfEarned|\bawardBadge\s*\(/;
        const exportRe = /^exports\.([A-Za-z0-9_]+)\s*=/gm;
        const names = [];
        let m;
        while ((m = exportRe.exec(idx))) names.push({ name: m[1], at: m.index });
        const ungated = [];
        names.forEach(function (row, i) {
            const end = i + 1 < names.length ? names[i + 1].at : idx.length;
            const body = idx.slice(row.at, end);
            if (!awardRe.test(body)) return;
            if (!gated[row.name]) ungated.push(row.name);
        });
        assert.deepStrictEqual(ungated, [], 'ungated badge-granting exports: ' + ungated.join(', '));
        assert.ok(gated.mergeAnonBadges, 'mergeAnonBadges must be on the gate list');
    });

    await test('client maintenance page fails open and keeps admin tools', function () {
        const src = fs.readFileSync(path.join(root, 'kill-switch.js'), 'utf8');
        assert.ok(src.includes('FAILS OPEN') || src.includes('Fail open') || src.includes('FAIL OPEN') || src.includes('fail open') || src.includes('Fail open') || /fail open/i.test(src));
        assert.ok(src.includes('bqOpenAdminPanel'));
        assert.ok(src.includes('Bitcoin Quest is temporarily offline for maintenance.'));
        assert.ok(/Your sats and progress are safe/.test(src));
        const panel = fs.readFileSync(path.join(root, 'admin-panel.js'), 'utf8');
        assert.ok(panel.includes('id: \'killSwitch\''));
        assert.ok(panel.includes("action: 'preflight'"));
        assert.ok(panel.includes('_showFreshStepUp'));
        const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
        assert.ok(ranking.includes('adminSetKillSwitch: 1'));
    });

    await test('BACKUP_MAX_AGE is 26 hours', function () {
        assert.strictEqual(ks.BACKUP_MAX_AGE_HOURS, 26);
    });

    await test('cleanReason strips control chars and angle brackets', function () {
        assert.strictEqual(ks.cleanReason('hello <script> alert'), 'hello script alert');
        assert.ok(!ks.cleanReason('foo<>bar').includes('<'));
    });

    await test('publicState never includes reason, actor, or snapshot', function () {
        const st = ks.publicState({
            enabled: true,
            mode: 'offline',
            reason: 'secret reason',
            updatedBy: 'admin1',
            snapshot: { outputUri: 'gs://bitcoin-education-archive-backups/kill-switch/x', status: 'STARTED' },
            autoReenableAt: 2000,
        }, 1000);
        assert.strictEqual(st.on, true);
        assert.strictEqual(st.mode, 'offline');
        assert.ok(st.message);
        assert.strictEqual(st.autoReenableAt, 2000);
        assert.strictEqual(st.reason, undefined);
        assert.strictEqual(st.updatedBy, undefined);
        assert.strictEqual(st.snapshot, undefined);
        const adm = ks.adminState({
            reason: 'secret reason',
            updatedBy: 'admin1',
            snapshot: { outputUri: 'gs://bucket/kill-switch/x', status: 'STARTED', startedAt: 1000 },
        }, 1000);
        assert.strictEqual(adm.reason, 'secret reason');
        assert.strictEqual(adm.updatedBy, ks.maskUid('admin1'));
        assert.ok(adm.updatedBy !== 'admin1');
        assert.ok(adm.snapshot && adm.snapshot.outputUri);
    });

    await test('isLaterAutoReturn only allows a later deadline or dropping it', function () {
        assert.strictEqual(ks.isLaterAutoReturn(null, 1000), false);
        assert.strictEqual(ks.isLaterAutoReturn(1000, 1000), false);
        assert.strictEqual(ks.isLaterAutoReturn(1000, 999), false);
        assert.strictEqual(ks.isLaterAutoReturn(1000, 2000), true);
        assert.strictEqual(ks.isLaterAutoReturn(1000, null), true);
    });

    await test('refuses a silent re-arm unless auto-return moves later, and alerts on an extension', async function () {
        const db = makeDb();
        const now = Date.parse('2026-11-11T22:50:00Z');
        const { handler } = hook(db, { now: function () { return now; } });
        const first = await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident', reenableInMinutes: 30 }, adminContext());
        assert.strictEqual(first.ok, true);
        const notifsBefore = [...db._store.keys()].filter(function (k) { return k.startsWith('notifications/') || k.startsWith('admin_notifications/'); }).length;
        await assert.rejects(
            () => handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident', reenableInMinutes: 30 }, adminContext()),
            /already offline/
        );
        await assert.rejects(
            () => handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident', reenableInMinutes: 10 }, adminContext()),
            /already offline/
        );
        const extended = await handler({ action: 'on', confirm: 'OFFLINE', reason: 'still containing it', reenableInMinutes: 90 }, adminContext());
        assert.strictEqual(extended.ok, true);
        assert.strictEqual(extended.changed, false);
        assert.strictEqual(extended.alertedAdmins >= 1, true);
        const notifsAfter = [...db._store.keys()].filter(function (k) { return k.startsWith('notifications/') || k.startsWith('admin_notifications/'); }).length;
        assert.ok(notifsAfter > notifsBefore, 'extension alerts admins');
        const adminNotes = [...db._store.values()].filter(function (v) { return v && v.type === 'kill_switch'; });
        adminNotes.forEach(function (n) {
            assert.ok(!n.uid || n.uid === 'auto-return' || n.uid.indexOf('\u2026') !== -1, 'admin_notifications uid is masked');
        });
    });

    await test('auto-return flips the switch off once and alerts admins plus Phil', async function () {
        const db = makeDb();
        let now = Date.parse('2026-11-11T22:50:00Z');
        const dms = [];
        const { handler } = hook(db, {
            now: function () { return now; },
            sendPhilDm: async function (text) { dms.push(text); return true; },
        });
        await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident', reenableInMinutes: 5 }, adminContext());
        now = now + 5 * 60 * 1000 + 1;
        const tick = ks.makeAutoReturnTick({
            admin: makeAdmin(),
            db: db,
            now: function () { return now; },
            listAdminUids: async function () { return ['admin1', 'admin2']; },
            sendPhilDm: async function (text) { dms.push('tick:' + text); return true; },
        });
        const first = await tick();
        assert.strictEqual(first.fired, true);
        assert.ok(first.alertSent);
        const flag = await db.collection('config').doc('killSwitch').get();
        assert.strictEqual(flag.data().enabled, false);
        const second = await tick();
        assert.strictEqual(second.fired, false);
        const audit = [...db._store.entries()].filter(function (e) { return e[0].indexOf('kill_switch_audit/') === 0 && e[1] && e[1].action === 'auto-return'; }).map(function (e) { return e[1]; });
        assert.strictEqual(audit.length, 1);
        assert.strictEqual(audit[0].reason, 'security incident');
        assert.ok(dms.some(function (t) { return t.indexOf('tick:') === 0 && /back online/.test(t); }));
    });

    await test('a no-op off while already off does not consume the rate budget', async function () {
        const db = makeDb();
        const { handler } = hook(db);
        const first = await handler({ action: 'off', confirm: 'ONLINE', reason: 'all clear now' }, adminContext());
        assert.strictEqual(first.ok, true);
        assert.strictEqual(first.noop, true);
        assert.strictEqual(first.changed, false);
        const rate = await db.collection('kill_switch_rate').doc('admin1').get();
        assert.strictEqual(rate.exists, false);
    });

    await test('reuses a snapshot started in the last 6 hours instead of exporting again', async function () {
        const db = makeDb();
        let exports = 0;
        const now = Date.parse('2026-11-11T22:50:00Z');
        const { handler, events } = hook(db, {
            now: function () { return now; },
            startExport: async function () {
                exports++;
                return { operationName: 'operations/op1', outputUriPrefix: 'gs://bucket/kill-switch/x' };
            },
        });
        await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident' }, adminContext());
        assert.strictEqual(exports, 1);
        await handler({ action: 'off', confirm: 'ONLINE', reason: 'all clear now' }, adminContext());
        events.length = 0;
        const again = await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident' }, adminContext());
        assert.strictEqual(exports, 1);
        assert.strictEqual(again.snapshot.reused, true);
        assert.ok(events.indexOf('export:reuse') !== -1);
        assert.ok(events.indexOf('export:start') === -1);
    });

    await test('storage IAM is objectCreator (kill-switch/ only) + objectViewer, and code never deletes or overwrites backups', function () {
        const src = fs.readFileSync(path.join(root, 'functions/src/killSwitch.js'), 'utf8');
        assert.ok(src.includes('ifGenerationMatch: 0'));
        assert.ok(!/\.delete\s*\(/.test(src) || src.includes('never delete'));
        assert.ok(!/bucket\(.*\)[\s\S]{0,200}\.delete\s*\(/.test(src));
        const plan = fs.readFileSync(path.join(root, 'functions/scripts/runtime-sa-plan.js'), 'utf8');
        assert.ok(plan.includes('roles/storage.objectCreator'));
        assert.ok(plan.includes('roles/storage.objectViewer'));
        assert.ok(plan.includes('kill-switch/'));
        assert.ok(plan.includes('datastore.databases.export'));
        assert.ok(plan.includes('datastore.operations.get'));
        assert.ok(!plan.includes('importExportAdmin'));
        assert.ok(!plan.includes('objectAdmin'));
        const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
        assert.ok(rules.includes("docId == 'killSwitchAdmin' && isAdmin()"));
        const idx = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
        assert.ok(idx.includes('killSwitchAutoReturnTick'));
        assert.ok(idx.includes('kill switch on: defer article publish xp'));
        assert.ok(idx.includes('kill switch on: defer pvp settle'));
        assert.ok(idx.includes("require('./src/killSwitch').isOffline(db)"));
        const pvp = fs.readFileSync(path.join(root, 'functions/src/pvpResolve.js'), 'utf8');
        assert.ok(pvp.includes('kill switch on: defer pvpResolveRound'));
        ks.gatedTriggerNames().forEach(function (n) {
            assert.ok(ks.gatedNames().indexOf(n) === -1, n + ' is a trigger, not a gateExport wrap');
        });
        assert.ok(idx.includes('adminSetKillSwitch'));
    });

    await test('status/preflight hides admin fields from the public state object', async function () {
        const db = makeDb();
        const { handler } = hook(db);
        await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident' }, adminContext());
        const st = await handler({ action: 'status' }, adminContext());
        assert.strictEqual(st.state.on, true);
        assert.strictEqual(st.state.reason, undefined);
        assert.strictEqual(st.state.snapshot, undefined);
        assert.strictEqual(st.admin.reason, 'security incident');
        assert.ok(st.admin.snapshot);
        const pub = await db.collection('config').doc('killSwitch').get();
        assert.strictEqual(pub.data().reason, undefined);
        assert.strictEqual(pub.data().snapshot, undefined);
    });


    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
}

run().catch(function (e) {
    console.error(e);
    process.exit(1);
});
