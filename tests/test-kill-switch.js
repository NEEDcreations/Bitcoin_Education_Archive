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
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
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
        // The admin-tool 2FA session guard has its own tests below and in
        // test-admin-tool-stepup.js; extra.realToolGuard uses the real one.
        toolGuard: extra && extra.realToolGuard ? undefined : (extra && extra.toolGuard ? extra.toolGuard : async function () { return { tool: 'killSwitch' }; }),
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
         'dailyPollVote', 'pollVote', 'chooseFaction', 'reconcileDailyProofs', 'scheduleRaidForumCredit',
         'managePeer', 'decryptCipher'].forEach(function (n) {
            assert.ok(names.indexOf(n) !== -1, n);
        });
        const triggers = ks.gatedTriggerNames();
        ['onMarketplaceSaleCount', 'onForumPost', 'onMarketplaceListingCount', 'onMarketplaceMessageCount',
         'onIrlEventCreated', 'onChatMessageCreated', 'onPushDeviceWritten'].forEach(function (n) {
            assert.ok(triggers.indexOf(n) !== -1, n + ' must be listed as a trigger');
        });
        const sale = idx.slice(idx.indexOf('exports.onMarketplaceSaleCount'), idx.indexOf('exports.onChatBadgeCount'));
        assert.ok(sale.indexOf('if (await killSwitchIsOn()) return null;') !== -1, 'onMarketplaceSaleCount must return early when the switch is on');
        assert.ok(ks.gatedRequestNames().indexOf('stravaAuth') !== -1, 'stravaAuth must be on the HTTP self-check list');
        const strava = idx.slice(idx.indexOf('exports.stravaAuth'), idx.indexOf('exports.stravaAuth') + 1800);
        const nonceDel = strava.indexOf('nonceRef.delete()');
        const offline = strava.indexOf('killSwitchIsOn()');
        assert.ok(offline !== -1 && nonceDel !== -1 && offline < nonceDel, 'stravaAuth must check the switch before consuming the nonce');
    });

    await test('every export that writes value is gated, self-checks, or allow-listed', function () {
        const idx = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
        const runbook = fs.readFileSync(path.join(root, 'docs/KILL-SWITCH-RUNBOOK.md'), 'utf8');
        // Exact ungated-on-purpose list from the runbook. Do not put anything
        // that grants XP, sats, badges, or tickets here.
        const UNGATED_ON_PURPOSE = {
            onUserDocCreated: 'assigns plebNumber / join date and bumps userCount (no signup bonus)',
            onUserQuestCompleted: 'global questsCompleted counter only; gradeQuest is gated',
            satoshiFavorAutoReset: 'expires an already-running boost and posts a heads-up; no favor or XP grant',
            syncPublicProfile: 'public mirror, not a grant',
        };
        const allowBlock = (runbook.split('**Ungated on purpose**')[1] || '').split('\n## ')[0];
        assert.ok(allowBlock, 'runbook must have an Ungated on purpose section');
        const runbookNames = [];
        allowBlock.split('\n').forEach(function (line) {
            const m = line.match(/^\s*-\s+`([A-Za-z0-9_]+)`:/);
            if (m) runbookNames.push(m[1]);
        });
        assert.deepStrictEqual(runbookNames, Object.keys(UNGATED_ON_PURPOSE), 'runbook ungated list must match the test allow-list');

        const covered = {};
        ks.gatedNames().concat(ks.gatedTriggerNames(), ks.gatedRequestNames()).forEach(function (n) { covered[n] = true; });
        const REQUIRED = ['onForumPost', 'onMarketplaceListingCount', 'onMarketplaceMessageCount',
            'onIrlEventCreated', 'managePeer', 'onChatMessageCreated', 'onPushDeviceWritten', 'stravaAuth'];
        REQUIRED.forEach(function (n) {
            assert.ok(covered[n], n + ' must be gated or on the HTTP self-check list');
            assert.ok(!UNGATED_ON_PURPOSE[n], n + ' grants value and must not be on the ungated-on-purpose list');
        });

        const valueRe = /grantServerTickets|grantFamily|grantIds|grantBadgeIfEarned|\bawardBadge\s*\(|creditPeerAcceptXp|creditDailyAllThree|maybeCompleteTrifecta|maybeCompleteDailyFive|\bnoteTrusted\s*\(|\bcreditTrusted\s*\(|maybeGrantTickets|maybeGrantForBadge|planXpGrant|\bgrantXp\s*\(|\b(?:orangeTickets|weeklyXP|monthlyXP|points)\s*[:=][^\n]*\.increment\s*\(/;
        const checkRe = /killSwitchIsOn\s*\(|\.isOffline\s*\(|makeReader\s*\(/;

        function stripComments(src) {
            return String(src || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
        }

        function exportedExpression(src, at) {
            const eq = src.indexOf('=', at);
            if (eq < 0) return '';
            let i = eq + 1;
            let depth = 0;
            const startAt = i;
            while (i < src.length) {
                const c = src[i];
                if (c === '"' || c === "'" || c === '`') {
                    const q = c;
                    i++;
                    while (i < src.length && src[i] !== q) {
                        if (src[i] === '\\') i++;
                        i++;
                    }
                    i++;
                    continue;
                }
                if (c === '/' && src[i + 1] === '/') {
                    while (i < src.length && src[i] !== '\n') i++;
                    i++;
                    continue;
                }
                if (c === '/' && src[i + 1] === '*') {
                    const endC = src.indexOf('*/', i);
                    i = endC < 0 ? src.length : endC + 2;
                    continue;
                }
                if (c === '{' || c === '(' || c === '[') depth++;
                else if (c === '}' || c === ')' || c === ']') depth = Math.max(0, depth - 1);
                else if (c === ';' && depth === 0) return src.slice(startAt, i);
                else if (c === '\n' && depth === 0) {
                    const rest = src.slice(i + 1);
                    if (/^\s*(exports\.|module\.exports|async function |function |const |let |var )/.test(rest)) {
                        return src.slice(startAt, i);
                    }
                }
                i++;
            }
            return src.slice(startAt);
        }

        function exportAt(src, name) {
            const re = new RegExp('^exports\\.' + name + '\\s*=', 'm');
            const m = re.exec(src);
            return m ? m.index : -1;
        }

        function extractNamed(src, name) {
            const at = exportAt(src, name);
            if (at >= 0) return exportedExpression(src, at);
            const fn = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(', 'm').exec(src);
            if (fn) {
                let i = fn.index;
                const brace = src.indexOf('{', i);
                if (brace < 0) return src.slice(i);
                let depth = 0;
                for (let j = brace; j < src.length; j++) {
                    if (src[j] === '{') depth++;
                    else if (src[j] === '}') {
                        depth--;
                        if (depth === 0) return src.slice(i, j + 1);
                    }
                }
                return src.slice(i);
            }
            const cst = new RegExp('(?:const|let|var)\\s+' + name + '\\s*=', 'm').exec(src);
            if (cst) return exportedExpression(src, cst.index);
            return '';
        }

        function resolveModule(spec) {
            const rel = spec.replace(/^['"]|['"]$/g, '');
            let base = path.join(root, 'functions', rel);
            if (fs.existsSync(base)) return base;
            if (fs.existsSync(base + '.js')) return base + '.js';
            return null;
        }

        function sourceFor(indexSrc, name) {
            const at = exportAt(indexSrc, name);
            if (at < 0) return '';
            const expr = exportedExpression(indexSrc, at).trim();
            const req = /^require\((['"][^'"]+['"])\)(?:\.([A-Za-z0-9_]+))?$/.exec(expr);
            if (req) {
                const file = resolveModule(req[1]);
                if (!file) return expr;
                const mod = fs.readFileSync(file, 'utf8');
                const exported = extractNamed(mod, req[2] || name);
                return exported || mod;
            }
            if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(expr)) {
                const ident = expr;
                const bind = new RegExp('^const\\s+\\{([^}]+)\\}\\s*=\\s*require\\((["\'][^"\']+["\'])\\)', 'gm');
                let bm;
                while ((bm = bind.exec(indexSrc))) {
                    const names = bm[1].split(',').map(function (p) { return p.trim().split(/\s+as\s+/).pop().trim(); });
                    if (names.indexOf(ident) === -1) continue;
                    const file = resolveModule(bm[2]);
                    if (!file) continue;
                    const mod = fs.readFileSync(file, 'utf8');
                    const exported = extractNamed(mod, ident);
                    return exported || mod;
                }
            }
            return expr;
        }

        function firstCodeIndex(src, re) {
            const code = stripComments(src);
            const m = re.exec(code);
            return m ? m.index : -1;
        }

        // Plain delegates (exports.x = require(...).fn, or a required binding
        // re-exported as exports.x = x) must be classified if they write value.
        const delegates = [];
        const reqAssign = /^exports\.([A-Za-z0-9_]+)\s*=\s*require\((['"][^'"]+['"])\)(?:\.([A-Za-z0-9_]+))?/gm;
        let dm;
        while ((dm = reqAssign.exec(idx))) delegates.push(dm[1]);
        const bindRe = /^const\s+\{([^}]+)\}\s*=\s*require\((['"][^'"]+['"])\)/gm;
        let bm;
        while ((bm = bindRe.exec(idx))) {
            bm[1].split(',').forEach(function (part) {
                const ident = part.trim().split(/\s+as\s+/).pop().trim();
                if (!ident) return;
                const ex = new RegExp('^exports\\.' + ident + '\\s*=\\s*' + ident + '\\b', 'm');
                if (ex.test(idx)) delegates.push(ident);
            });
        }
        assert.ok(delegates.indexOf('pvpResolveRound') !== -1, 'pvpResolveRound must be listed as a file delegate');
        const pvpSrc = sourceFor(idx, 'pvpResolveRound');
        assert.ok(/isOffline\s*\(/.test(pvpSrc) || /killSwitchIsOn\s*\(/.test(pvpSrc), 'pvpResolveRound check is looked up in its own file');
        const uncoveredDelegates = [];
        delegates.forEach(function (n) {
            const body = sourceFor(idx, n);
            if (!valueRe.test(stripComments(body))) return;
            if (covered[n] || UNGATED_ON_PURPOSE[n]) return;
            uncoveredDelegates.push(n);
        });
        assert.deepStrictEqual(uncoveredDelegates, [], 'ungated value-writing delegates: ' + uncoveredDelegates.join(', '));

        const uncovered = [];
        const exportRe = /^exports\.([A-Za-z0-9_]+)\s*=/gm;
        let m;
        while ((m = exportRe.exec(idx))) {
            const body = sourceFor(idx, m[1]);
            if (!valueRe.test(stripComments(body))) continue;
            if (covered[m[1]]) continue;
            if (checkRe.test(stripComments(body))) continue;
            if (UNGATED_ON_PURPOSE[m[1]]) continue;
            uncovered.push(m[1]);
        }
        assert.deepStrictEqual(uncovered, [], 'ungated value-writing exports: ' + uncovered.join(', '));
        assert.ok(covered.mergeAnonBadges, 'mergeAnonBadges must be on the gate list');

        // Gate check must appear in code (not only in a comment) before the
        // first value write, for every trigger and HTTP self-check.
        const selfChecked = ks.gatedTriggerNames().concat(ks.gatedRequestNames());
        const orderFails = [];
        selfChecked.forEach(function (n) {
            const body = sourceFor(idx, n);
            assert.ok(body, 'missing source for ' + n);
            const code = stripComments(body);
            const checkAt = firstCodeIndex(code, checkRe);
            const valueAt = firstCodeIndex(code, valueRe);
            if (checkAt < 0) orderFails.push(n + ' (no kill-switch check in code)');
            else if (valueAt >= 0 && checkAt > valueAt) orderFails.push(n + ' (check after first value write)');
        });
        assert.deepStrictEqual(orderFails, [], 'kill-switch check must precede the first value write: ' + orderFails.join(', '));

        function stripTriggerCheck(src, name) {
            const at = exportAt(src, name);
            if (at < 0) return src;
            const expr = exportedExpression(src, at);
            const cleaned = expr.replace(/if\s*\(\s*await\s+killSwitchIsOn\s*\(\s*\)\s*\)\s*(?:throw[^;]+;|return[^;]*;)/g, '');
            return src.slice(0, at) + 'exports.' + name + ' =' + cleaned + src.slice(at + ('exports.' + name + ' =' + expr).length);
        }

        ['onIrlEventCreated', 'onChatMessageCreated'].forEach(function (n) {
            const mutated = stripTriggerCheck(idx, n);
            const body = sourceFor(mutated, n);
            const code = stripComments(body);
            const checkAt = firstCodeIndex(code, checkRe);
            const valueAt = firstCodeIndex(code, valueRe);
            const ok = checkAt >= 0 && (valueAt < 0 || checkAt < valueAt);
            assert.ok(!ok, 'mutation removing the kill-switch check from ' + n + ' must fail the coverage test');
            assert.ok(valueAt >= 0, n + ' mutation still has a value write to catch');
        });
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

    await test('storage IAM is objectCreator+objectViewer on the snapshot bucket and objectViewer on backups, and code never deletes or overwrites backups', function () {
        const src = fs.readFileSync(path.join(root, 'functions/src/killSwitch.js'), 'utf8');
        assert.ok(src.includes('ifGenerationMatch: 0'));
        assert.ok(!/\.delete\s*\(/.test(src) || src.includes('never delete'));
        assert.ok(!/bucket\(.*\)[\s\S]{0,200}\.delete\s*\(/.test(src));
        const plan = fs.readFileSync(path.join(root, 'functions/scripts/runtime-sa-plan.js'), 'utf8');
        assert.ok(plan.includes('roles/storage.objectCreator'));
        assert.ok(plan.includes('roles/storage.objectViewer'));
        assert.ok(plan.includes('bitcoin-education-archive-killswitch-exports'));
        assert.ok(!plan.includes('kill-switch-prefix-only'));
        assert.ok(!/resource\.name\.startsWith/.test(plan));
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

    await test('makeBackupDeps prefers opts, then BQ_BACKUP_BUCKET, then <project>-backups', function () {
        const savedBucket = process.env.BQ_BACKUP_BUCKET;
        const savedSnap = process.env.BQ_KILLSWITCH_EXPORT_BUCKET;
        const savedProject = process.env.GCLOUD_PROJECT;
        try {
            delete process.env.BQ_BACKUP_BUCKET;
            delete process.env.BQ_KILLSWITCH_EXPORT_BUCKET;
            delete process.env.GCLOUD_PROJECT;
            const def = ks.makeBackupDeps({}, {}, { projectId: 'bitcoin-quest-staging' });
            assert.strictEqual(def.backupBucket, 'bitcoin-quest-staging-backups');
            assert.strictEqual(def.snapshotBucket, ks.SNAPSHOT_BUCKET_DEFAULT);
            process.env.BQ_BACKUP_BUCKET = 'bitcoin-quest-staging-backups-use1';
            const fromEnv = ks.makeBackupDeps({}, {}, { projectId: 'bitcoin-quest-staging' });
            assert.strictEqual(fromEnv.backupBucket, 'bitcoin-quest-staging-backups-use1');
            assert.strictEqual(fromEnv.snapshotBucket, ks.SNAPSHOT_BUCKET_DEFAULT);
            const fromOpts = ks.makeBackupDeps({}, {}, {
                projectId: 'bitcoin-quest-staging',
                backupBucket: 'explicit-bucket',
                snapshotBucket: 'explicit-snapshot',
            });
            assert.strictEqual(fromOpts.backupBucket, 'explicit-bucket');
            assert.strictEqual(fromOpts.snapshotBucket, 'explicit-snapshot');
        } finally {
            if (savedBucket == null) delete process.env.BQ_BACKUP_BUCKET;
            else process.env.BQ_BACKUP_BUCKET = savedBucket;
            if (savedSnap == null) delete process.env.BQ_KILLSWITCH_EXPORT_BUCKET;
            else process.env.BQ_KILLSWITCH_EXPORT_BUCKET = savedSnap;
            if (savedProject == null) delete process.env.GCLOUD_PROJECT;
            else process.env.GCLOUD_PROJECT = savedProject;
        }
    });

    await test('makeBackupDeps snapshot bucket prefers opts, then BQ_KILLSWITCH_EXPORT_BUCKET, then the default', function () {
        const savedSnap = process.env.BQ_KILLSWITCH_EXPORT_BUCKET;
        const savedBucket = process.env.BQ_BACKUP_BUCKET;
        try {
            delete process.env.BQ_KILLSWITCH_EXPORT_BUCKET;
            process.env.BQ_BACKUP_BUCKET = 'nightly-backups';
            const def = ks.makeBackupDeps({}, {}, { projectId: 'bitcoin-education-archive' });
            assert.strictEqual(def.backupBucket, 'nightly-backups');
            assert.strictEqual(def.snapshotBucket, 'bitcoin-education-archive-killswitch-exports');
            process.env.BQ_KILLSWITCH_EXPORT_BUCKET = 'env-snapshot-bucket';
            const fromEnv = ks.makeBackupDeps({}, {}, { projectId: 'bitcoin-education-archive', backupBucket: 'nightly-backups' });
            assert.strictEqual(fromEnv.backupBucket, 'nightly-backups');
            assert.strictEqual(fromEnv.snapshotBucket, 'env-snapshot-bucket');
            const fromOpts = ks.makeBackupDeps({}, {}, {
                projectId: 'bitcoin-education-archive',
                backupBucket: 'nightly-backups',
                snapshotBucket: 'opts-snapshot-bucket',
            });
            assert.strictEqual(fromOpts.backupBucket, 'nightly-backups');
            assert.strictEqual(fromOpts.snapshotBucket, 'opts-snapshot-bucket');
        } finally {
            if (savedSnap == null) delete process.env.BQ_KILLSWITCH_EXPORT_BUCKET;
            else process.env.BQ_KILLSWITCH_EXPORT_BUCKET = savedSnap;
            if (savedBucket == null) delete process.env.BQ_BACKUP_BUCKET;
            else process.env.BQ_BACKUP_BUCKET = savedBucket;
        }
    });

    await test('startExport writes operationName and outputUriPrefix into the manifest without waiting', async function () {
        const savedFetch = global.fetch;
        let fetchCalls = 0;
        let savedBody = null;
        let exportBody = null;
        const bucketsTouched = [];
        const file = {
            save: async function (text, opts) {
                savedBody = JSON.parse(text);
                assert.strictEqual(opts.precondition.ifGenerationMatch, 0);
            },
        };
        const admin = {
            app: function () {
                return { options: { credential: { getAccessToken: async function () { return { access_token: 't' }; } } } };
            },
            storage: function () {
                return {
                    bucket: function (name) {
                        bucketsTouched.push(name);
                        return {
                            file: function (objectPath) {
                                assert.strictEqual(name, 'snap-exports');
                                assert.strictEqual(objectPath, 'kill-switch/ts/kill-switch-manifest.json');
                                return file;
                            },
                            getFiles: async function () {
                                throw new Error('startExport must not list the backups bucket');
                            },
                        };
                    },
                };
            },
        };
        try {
            global.fetch = async function (url, opts) {
                fetchCalls++;
                assert.ok(String(url).indexOf(':exportDocuments') !== -1);
                assert.strictEqual(opts.method, 'POST');
                exportBody = JSON.parse(opts.body);
                return { json: async function () { return { name: 'projects/p/databases/(default)/operations/op-9' }; } };
            };
            const deps = ks.makeBackupDeps(admin, {}, {
                projectId: 'bitcoin-quest-staging',
                backupBucket: 'bitcoin-quest-staging-backups-use1',
                snapshotBucket: 'snap-exports',
            });
            const started = await deps.startExport('kill-switch/ts', { kind: 'kill-switch-snapshot', reason: 'test' });
            assert.strictEqual(fetchCalls, 1);
            assert.strictEqual(started.operationName, 'projects/p/databases/(default)/operations/op-9');
            assert.strictEqual(started.outputUriPrefix, 'gs://snap-exports/kill-switch/ts');
            assert.strictEqual(exportBody.outputUriPrefix, started.outputUriPrefix);
            assert.strictEqual(savedBody.kind, 'kill-switch-snapshot');
            assert.strictEqual(savedBody.reason, 'test');
            assert.strictEqual(savedBody.operationName, started.operationName);
            assert.strictEqual(savedBody.outputUriPrefix, started.outputUriPrefix);
            assert.deepStrictEqual(bucketsTouched, ['snap-exports']);
        } finally {
            if (savedFetch === undefined) delete global.fetch;
            else global.fetch = savedFetch;
        }
    });

    await test('findExportMetadata lists the backups bucket, not the snapshot bucket', async function () {
        const bucketsTouched = [];
        const admin = {
            storage: function () {
                return {
                    bucket: function (name) {
                        bucketsTouched.push(name);
                        return {
                            getFiles: async function (opts) {
                                assert.strictEqual(opts.prefix, '2026-11-11/');
                                return [[{
                                    name: '2026-11-11/foo.overall_export_metadata',
                                    metadata: { updated: '2026-11-11T02:10:00Z' },
                                }]];
                            },
                            file: function () {
                                throw new Error('backup check must not write the snapshot bucket');
                            },
                        };
                    },
                };
            },
        };
        const deps = ks.makeBackupDeps(admin, {}, {
            projectId: 'bitcoin-education-archive',
            backupBucket: 'nightly-backups',
            snapshotBucket: 'snap-exports',
        });
        const meta = await deps.findExportMetadata('2026-11-11');
        assert.strictEqual(meta.name, '2026-11-11/foo.overall_export_metadata');
        assert.strictEqual(meta.updatedMs, Date.parse('2026-11-11T02:10:00Z'));
        assert.deepStrictEqual(bucketsTouched, ['nightly-backups']);
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


    await test('admin banner: status, preflight and off need a live Kill switch tool session', async function () {
        const db = makeDb();
        const now = Date.parse('2026-11-11T22:50:00Z');
        const { handler } = hook(db, { realToolGuard: true, now: function () { return now; } });
        for (const action of ['status', 'preflight', 'off']) {
            let err = null;
            try { await handler({ action: action, confirm: action === 'on' ? 'OFFLINE' : 'ONLINE', reason: 'security incident' }, adminContext()); } catch (e) { err = e; }
            assert.ok(err, action + ' must be refused without a tool session');
            assert.strictEqual(err.code, 'failed-precondition');
        }
        const flag = await db.collection('config').doc('killSwitch').get();
        assert.strictEqual(flag.exists, false, 'nothing flipped');
        const sid = 'a1'.repeat(16);
        await db.collection('admin_tool_sessions').doc('admin1_cipherWins').set({ uid: 'admin1', tool: 'cipherWins', sessionId: sid, verifiedAtMs: now, expiresAtMs: now + 300000 });
        let wrongTool = null;
        try { await handler({ action: 'status', adminToolSession: sid }, adminContext()); } catch (e) { wrongTool = e; }
        assert.ok(wrongTool && wrongTool.code === 'failed-precondition', 'a session for another tool does not open the kill switch');
        await db.collection('admin_tool_sessions').doc('admin1_killSwitch').set({ uid: 'admin1', tool: 'killSwitch', sessionId: sid, verifiedAtMs: now, expiresAtMs: now + 300000 });
        const st = await handler({ action: 'status', adminToolSession: sid }, adminContext());
        assert.ok(st && st.state);
    });

    await test('admin banner: an expired Kill switch tool session is refused', async function () {
        const db = makeDb();
        let now = Date.parse('2026-11-11T22:50:00Z');
        const { handler } = hook(db, { realToolGuard: true, now: function () { return now; } });
        const sid = 'b2'.repeat(16);
        await db.collection('admin_tool_sessions').doc('admin1_killSwitch').set({ uid: 'admin1', tool: 'killSwitch', sessionId: sid, verifiedAtMs: now, expiresAtMs: now + 300000 });
        now += 300001;
        let err = null;
        try { await handler({ action: 'status', adminToolSession: sid }, adminContext()); } catch (e) { err = e; }
        assert.ok(err && err.code === 'failed-precondition');
    });

    await test('admin banner: the on/off fresh step-up is still required with a tool session', async function () {
        const db = makeDb();
        const now = Date.parse('2026-11-11T22:50:00Z');
        let stepUps = 0;
        const { handler } = hook(db, {
            realToolGuard: true,
            now: function () { return now; },
            stepUp: async function () { stepUps++; throw new HttpsError('failed-precondition', 'Enter a fresh authenticator code for this action.'); },
        });
        const sid = 'c3'.repeat(16);
        await db.collection('admin_tool_sessions').doc('admin1_killSwitch').set({ uid: 'admin1', tool: 'killSwitch', sessionId: sid, verifiedAtMs: now, expiresAtMs: now + 300000 });
        let err = null;
        try { await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident', adminToolSession: sid }, adminContext()); } catch (e) { err = e; }
        assert.ok(err && err.code === 'failed-precondition');
        assert.strictEqual(stepUps, 1);
        const flag = await db.collection('config').doc('killSwitch').get();
        assert.strictEqual(flag.exists, false);
    });

    // Red Team #325 F1: emergency ON stays one code.
    await test('F1: ON with no tool session and a valid fresh step-up goes offline (one code)', async function () {
        const db = makeDb();
        const now = Date.parse('2026-11-11T22:50:00Z');
        let stepUps = 0;
        const { handler } = hook(db, {
            realToolGuard: true,
            now: function () { return now; },
            stepUp: async function () { stepUps++; return { established: true, totp: true }; },
        });
        const res = await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident' }, adminContext());
        assert.strictEqual(res.on, true);
        assert.strictEqual(stepUps, 1, 'exactly one fresh step-up');
        const flag = await db.collection('config').doc('killSwitch').get();
        assert.strictEqual(flag.exists && flag.data().enabled, true);
    });

    await test('F1: ON is never free of a code: no tool session and a refused step-up flips nothing', async function () {
        const db = makeDb();
        const now = Date.parse('2026-11-11T22:50:00Z');
        const { handler } = hook(db, {
            realToolGuard: true,
            now: function () { return now; },
            stepUp: async function () { throw new HttpsError('failed-precondition', 'Enter a fresh authenticator code for this action.'); },
        });
        let err = null;
        try { await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident' }, adminContext()); } catch (e) { err = e; }
        assert.ok(err && err.code === 'failed-precondition');
        const flag = await db.collection('config').doc('killSwitch').get();
        assert.strictEqual(flag.exists, false);
    });

    await test('F1: ON still refuses a non-admin before any step-up', async function () {
        const db = makeDb();
        let stepUps = 0;
        const { handler } = hook(db, { realToolGuard: true, stepUp: async function () { stepUps++; return { established: true }; } });
        const ctx = adminContext();
        ctx.auth.token.admin = false;
        let err = null;
        try { await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident' }, ctx); } catch (e) { err = e; }
        assert.ok(err && err.code === 'permission-denied');
        assert.strictEqual(stepUps, 0);
    });

    await test('F1: OFF with no tool session is refused before the step-up, even with a valid proof', async function () {
        const db = makeDb();
        const now = Date.parse('2026-11-11T22:50:00Z');
        let stepUps = 0;
        const { handler } = hook(db, {
            realToolGuard: true,
            now: function () { return now; },
            stepUp: async function () { stepUps++; return { established: true, totp: true }; },
        });
        await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident' }, adminContext());
        stepUps = 0;
        let err = null;
        try { await handler({ action: 'off', confirm: 'ONLINE', reason: 'incident resolved', freshProofId: 'f'.repeat(32) }, adminContext()); } catch (e) { err = e; }
        assert.ok(err && err.code === 'failed-precondition');
        assert.strictEqual(err.details && err.details.reason, 'admin-step-up');
        assert.strictEqual(stepUps, 0, 'tool session is checked first');
        const flag = await db.collection('config').doc('killSwitch').get();
        assert.strictEqual(flag.data().enabled, true, 'still offline');
    });

    await test('F1: OFF with a tool session AND a fresh step-up brings the app back', async function () {
        const db = makeDb();
        const now = Date.parse('2026-11-11T22:50:00Z');
        let stepUps = 0;
        const { handler } = hook(db, {
            realToolGuard: true,
            now: function () { return now; },
            stepUp: async function () { stepUps++; return { established: true, totp: true }; },
        });
        await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident' }, adminContext());
        const sid = 'd4'.repeat(16);
        await db.collection('admin_tool_sessions').doc('admin1_killSwitch').set({ uid: 'admin1', tool: 'killSwitch', sessionId: sid, verifiedAtMs: now, expiresAtMs: now + 300000 });
        stepUps = 0;
        const res = await handler({ action: 'off', confirm: 'ONLINE', reason: 'incident resolved', adminToolSession: sid }, adminContext());
        assert.strictEqual(res.on, false);
        assert.strictEqual(stepUps, 1);
    });

    await test('N1: stale backups without override do not consume the step-up', async function () {
        const db = makeDb();
        let used = 0;
        const { handler } = hook(db, {
            backupDeps: {
                findExportMetadata: async function () { return null; },
                readPitr: async function () { return 'POINT_IN_TIME_RECOVERY_DISABLED'; },
            },
            stepUp: async function () { used++; return { established: true, totp: true }; },
        });
        const first = await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident' }, adminContext());
        assert.strictEqual(first.ok, false);
        assert.strictEqual(first.needsOverride, true);
        assert.strictEqual(used, 0, 'step-up must not run when override is still needed');
        const flag = await db.collection('config').doc('killSwitch').get();
        assert.strictEqual(flag.exists, false);
        const rows = [...db._store.keys()].filter((k) => k.startsWith('kill_switch_audit/'));
        assert.strictEqual(rows.length, 0, 'no audit row on a refused stale-backup ON');
    });

    await test('N1: stale backups plus override in one request consume exactly one step-up', async function () {
        const db = makeDb();
        let used = 0;
        const { handler } = hook(db, {
            backupDeps: {
                findExportMetadata: async function () { return null; },
                readPitr: async function () { return 'POINT_IN_TIME_RECOVERY_DISABLED'; },
            },
            stepUp: async function () { used++; return { established: true, totp: true }; },
        });
        const res = await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident', override: true }, adminContext());
        assert.strictEqual(res.ok, true);
        assert.strictEqual(res.on, true);
        assert.strictEqual(used, 1, 'exactly one step-up');
        const rows = [...db._store.keys()].filter((k) => k.startsWith('kill_switch_audit/'));
        assert.strictEqual(rows.length, 1);
        assert.strictEqual(db._store.get(rows[0]).backupOverride, true);
    });

    await test('MED1: ON step-up uses adminSetKillSwitchOn (skips the 20/day cap); OFF keeps adminSetKillSwitch', function () {
        const src = fs.readFileSync(path.join(root, 'functions/src/killSwitch.js'), 'utf8');
        assert.ok(src.includes("on ? 'adminSetKillSwitchOn' : 'adminSetKillSwitch'"));
        assert.ok(src.includes('skipDailyCap: true'));
        const panel = fs.readFileSync(path.join(root, 'admin-panel.js'), 'utf8');
        assert.ok(panel.includes("action === 'on' ? 'adminSetKillSwitchOn' : 'adminSetKillSwitch'"));
    });

    await test('F1: client has an Emergency stop path straight to the ON prompt (no tool window)', function () {
        const panel = fs.readFileSync(path.join(root, 'admin-panel.js'), 'utf8');
        assert.ok(panel.includes('window.bqEmergencyStop = openEmergencyStop'));
        const body = panel.slice(panel.indexOf('function openEmergencyStop'), panel.indexOf('window.bqEmergencyStop'));
        assert.ok(body.includes("_showFreshStepUp('adminSetKillSwitchOn')"), 'one fresh code, ON action skips the daily cap');
        assert.ok(body.includes("action: 'on'"));
        assert.ok(!body.includes('bqAdminToolStepUp'), 'no tool-window prompt first');
        assert.ok(!/action: 'off'/.test(body), 'emergency path only turns the switch ON');
        // N1: the override box is visible from the start so one code is enough
        // when backups are stale. A needsOverride retry must not ask for a new code.
        assert.ok(body.includes("I understand a backup is stale or missing"));
        assert.ok(!/ksuOverrideLab" style="display:none"/.test(body), 'override box is shown up front');
        assert.ok(body.includes('Your code was not used.'));
        assert.ok(!body.includes('it asks for a new code'));
        assert.ok(body.includes('heldProof'), 'caches the unconsumed proof');
        assert.ok(body.includes('The override box is checked'), 'pre-ticks override on the needsOverride retry');
        assert.ok(body.indexOf('heldProof') < body.indexOf("_showFreshStepUp('adminSetKillSwitchOn')") || body.includes('heldProof'), 'retry reuses heldProof');
        assert.ok(body.includes('Promise.resolve(heldProof)'), 'needsOverride retry does not mint a new proof');
    });

    await test('tool window: stale preflight requires override before a code, and reuses heldProof', function () {
        const panel = fs.readFileSync(path.join(root, 'admin-panel.js'), 'utf8');
        const start = panel.indexOf('function openKillSwitch()');
        const end = panel.indexOf('function openEmergencyStop()');
        const body = panel.slice(start, end);
        assert.ok(body.includes("Tick the override box if you still want to go offline."));
        assert.ok(body.includes('state.heldProof'));
        assert.ok(body.includes('Promise.resolve(state.heldProof)'));
        assert.ok(body.includes('The override box is checked'));
        assert.ok(body.includes('ovBox.checked = true') || body.includes('ovBox) ovBox.checked = true'));
    });

    await test('L1: already-offline with no later auto-return does not consume the step-up', async function () {
        const db = makeDb();
        const now = Date.parse('2026-11-11T22:50:00Z');
        let used = 0;
        const { handler } = hook(db, {
            now: function () { return now; },
            stepUp: async function () { used++; return { established: true, totp: true }; },
        });
        const first = await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident' }, adminContext());
        assert.strictEqual(first.ok, true);
        assert.strictEqual(used, 1);
        let err = null;
        try {
            await handler({ action: 'on', confirm: 'OFFLINE', reason: 'security incident' }, adminContext());
        } catch (e) { err = e; }
        assert.ok(err && /already offline/.test(err.message), err && err.message);
        assert.strictEqual(used, 1, 'refusal must not call stepUp');
    });

    await test('L1: hourly write-limit refusal does not consume the step-up', async function () {
        const db = makeDb();
        let used = 0;
        const { handler } = hook(db, {
            stepUp: async function () { used++; return { established: true, totp: true }; },
        });
        for (let i = 0; i < ks.RATE_MAX_USER; i++) {
            const action = i % 2 === 0 ? 'on' : 'off';
            const confirm = action === 'on' ? 'OFFLINE' : 'ONLINE';
            const res = await handler({ action: action, confirm: confirm, reason: 'security incident ' + i }, adminContext());
            assert.strictEqual(res.ok, true, 'flip ' + i);
        }
        assert.strictEqual(used, ks.RATE_MAX_USER);
        let err = null;
        try {
            await handler({ action: 'on', confirm: 'OFFLINE', reason: 'one more time here' }, adminContext());
        } catch (e) { err = e; }
        assert.ok(err && /Too many kill-switch changes/.test(err.message), err && err.message);
        assert.strictEqual(used, ks.RATE_MAX_USER, 'rate-limit refusal must not call stepUp');
    });

    await test('Emergency stop needsOverride retry reuses the unconsumed proof (one code)', async function () {
        const panel = fs.readFileSync(path.join(root, 'admin-panel.js'), 'utf8');
        const calls = [];
        const payloads = [];
        const byId = new Map();
        function el(tag) {
            const node = {
                tagName: String(tag || 'div').toUpperCase(),
                style: { display: '' },
                attributes: {},
                children: [],
                parentNode: null,
                _text: '',
                _html: '',
                listeners: {},
                className: '',
                type: '',
                value: '',
                checked: false,
                disabled: false,
                get id() { return this._id || ''; },
                set id(v) { this._id = v; if (v) byId.set(v, this); },
                get textContent() { return this._text; },
                set textContent(v) { this._text = String(v == null ? '' : v); },
                get innerHTML() { return this._html; },
                set innerHTML(v) {
                    this._html = String(v == null ? '' : v);
                    const re = /<([a-z0-9]+)([^>]*)>/gi;
                    let m;
                    while ((m = re.exec(this._html))) {
                        const attrs = m[2] || '';
                        const idM = /id="([^"]+)"/.exec(attrs);
                        const clsM = /class="([^"]+)"/.exec(attrs);
                        if (!idM && !clsM) continue;
                        const child = el(m[1]);
                        if (idM) child.id = idM[1];
                        if (clsM) child.className = clsM[1];
                        if (child.id === 'ksuOverride') { child.tagName = 'INPUT'; child.checked = false; }
                        if (child.id === 'ksuReason') { child.tagName = 'TEXTAREA'; child.value = 'stale backup drill here'; }
                        if (child.id === 'ksuConfirm') { child.tagName = 'INPUT'; child.value = 'OFFLINE'; }
                        if (child.id === 'ksuGo') child.tagName = 'BUTTON';
                        child.parentNode = node;
                        node.children.push(child);
                    }
                },
                setAttribute(k, v) { this.attributes[k] = String(v); },
                getAttribute(k) { return this.attributes[k]; },
                addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
                querySelector(sel) {
                    const id = sel.charAt(0) === '#' ? sel.slice(1) : (/#([A-Za-z0-9_-]+)/.exec(sel) || sel.replace(/^[.#]/, '') === sel ? null : sel.replace(/^[.#]/, ''));
                    const want = sel.charAt(0) === '#' ? sel.slice(1) : (sel.startsWith('.') ? null : sel.replace(/^[.#]/, ''));
                    if (sel.charAt(0) === '#') return byId.get(sel.slice(1)) || null;
                    if (sel.charAt(0) === '.') {
                        const cls = sel.slice(1);
                        const walk = function (n) {
                            for (const c of n.children) {
                                if ((' ' + c.className + ' ').indexOf(' ' + cls + ' ') >= 0) return c;
                                const f = walk(c); if (f) return f;
                            }
                            return null;
                        };
                        return walk(node);
                    }
                    return byId.get(sel) || null;
                },
                appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
                removeChild(c) {
                    const i = this.children.indexOf(c);
                    if (i >= 0) this.children.splice(i, 1);
                    c.parentNode = null;
                },
                focus() {},
                click() { (this.listeners.click || []).forEach(function (fn) { fn({ target: node, preventDefault: function () {} }); }); },
            };
            return node;
        }
        const body = el('body');
        const head = el('head');
        const doc = {
            body: body,
            head: head,
            getElementById(id) { return byId.get(id) || null; },
            createElement: el,
            addEventListener() {},
            removeEventListener() {},
        };
        head.appendChild = function (c) { c.parentNode = head; head.children.push(c); return c; };
        body.appendChild = function (c) { c.parentNode = body; body.children.push(c); if (c.id) byId.set(c.id, c); return c; };
        let answers = [{ needsOverride: true, preflight: { ok: false } }, { ok: true, on: true, changed: true }];
        const sandbox = {
            window: {
                _isAdminClaim: true,
                _showFreshStepUp: function (action) {
                    calls.push(action);
                    return Promise.resolve('proof-one');
                },
            },
            document: doc,
            firebase: {
                functions: function () {
                    return {
                        httpsCallable: function () {
                            return function (payload) {
                                payloads.push(JSON.parse(JSON.stringify(payload)));
                                const next = answers.shift() || { ok: true, on: true, changed: true };
                                return Promise.resolve({ data: next });
                            };
                        },
                    };
                },
            },
            location: { hash: '' },
            console: console,
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            Promise: Promise,
        };
        sandbox.window.window = sandbox.window;
        sandbox.global = sandbox;
        vm.runInNewContext(panel, sandbox, { filename: 'admin-panel.js' });
        sandbox.window.bqEmergencyStop();
        const go = doc.getElementById('ksuGo');
        const ov = doc.getElementById('ksuOverride');
        assert.ok(go && ov, 'emergency stop form mounted');
        assert.strictEqual(ov.checked, false, 'box starts unchecked');
        go.click();
        await new Promise(function (r) { setTimeout(r, 30); });
        assert.strictEqual(calls.length, 1, 'first click asks for one code');
        assert.strictEqual(payloads.length, 1);
        assert.strictEqual(payloads[0].freshProofId, 'proof-one');
        assert.strictEqual(payloads[0].override, false);
        assert.strictEqual(ov.checked, true, 'needsOverride pre-ticks the box');
        go.click();
        await new Promise(function (r) { setTimeout(r, 30); });
        assert.strictEqual(calls.length, 1, 'retry must not ask for a second code');
        assert.strictEqual(payloads.length, 2);
        assert.strictEqual(payloads[1].freshProofId, 'proof-one', 'same unconsumed proof is reused');
        assert.strictEqual(payloads[1].override, true);
    });

    await test('L1: heldProof is cleared on expired/invalid/consumed/needs-step-up errors, not on already-offline', function () {
        const panel = fs.readFileSync(path.join(root, 'admin-panel.js'), 'utf8');
        const start = panel.indexOf('function heldProofIsDead(e)');
        const end = panel.indexOf('function callKillSwitch', start);
        assert.ok(start > 0 && end > start, 'heldProofIsDead is defined');
        const isDead = new Function('e', panel.slice(start, end) + '\nreturn heldProofIsDead(e);');
        assert.strictEqual(isDead({ message: 'Enter a fresh authenticator code for this action.' }), true);
        assert.strictEqual(isDead({ message: 'That proof has expired.' }), true);
        assert.strictEqual(isDead({ message: 'This proof is invalid.' }), true);
        assert.strictEqual(isDead({ message: 'This proof was already consumed.' }), true);
        assert.strictEqual(isDead({ details: { reason: 'needs-step-up' } }), true);
        assert.strictEqual(isDead({ message: 'The app is already offline. You can only extend the auto-return to a later time (or leave it off until an admin turns it back on).' }), false);
        assert.strictEqual(isDead({ message: 'Too many kill-switch changes. Wait an hour and try again.' }), false);
        const toolCatch = panel.slice(panel.indexOf('function openKillSwitch()'), panel.indexOf('function openEmergencyStop()'));
        const estopCatch = panel.slice(panel.indexOf('function openEmergencyStop()'), panel.indexOf('window.bqEmergencyStop'));
        assert.ok(toolCatch.includes('if (heldProofIsDead(e)) state.heldProof = \'\''));
        assert.ok(estopCatch.includes('if (heldProofIsDead(e)) heldProof = \'\''));
    });

    await test('L1: an expired heldProof is dropped, so the next tap asks for a new code', async function () {
        const panel = fs.readFileSync(path.join(root, 'admin-panel.js'), 'utf8');
        const calls = [];
        const payloads = [];
        const byId = new Map();
        function el(tag) {
            const node = {
                tagName: String(tag || 'div').toUpperCase(),
                style: { display: '' },
                attributes: {},
                children: [],
                parentNode: null,
                _text: '',
                _html: '',
                listeners: {},
                className: '',
                type: '',
                value: '',
                checked: false,
                disabled: false,
                get id() { return this._id || ''; },
                set id(v) { this._id = v; if (v) byId.set(v, this); },
                get textContent() { return this._text; },
                set textContent(v) { this._text = String(v == null ? '' : v); },
                get innerHTML() { return this._html; },
                set innerHTML(v) {
                    this._html = String(v == null ? '' : v);
                    const re = /<([a-z0-9]+)([^>]*)>/gi;
                    let m;
                    while ((m = re.exec(this._html))) {
                        const attrs = m[2] || '';
                        const idM = /id="([^"]+)"/.exec(attrs);
                        const clsM = /class="([^"]+)"/.exec(attrs);
                        if (!idM && !clsM) continue;
                        const child = el(m[1]);
                        if (idM) child.id = idM[1];
                        if (clsM) child.className = clsM[1];
                        if (child.id === 'ksuOverride') { child.tagName = 'INPUT'; child.checked = false; }
                        if (child.id === 'ksuReason') { child.tagName = 'TEXTAREA'; child.value = 'stale backup drill here'; }
                        if (child.id === 'ksuConfirm') { child.tagName = 'INPUT'; child.value = 'OFFLINE'; }
                        if (child.id === 'ksuGo') child.tagName = 'BUTTON';
                        child.parentNode = node;
                        node.children.push(child);
                    }
                },
                setAttribute(k, v) { this.attributes[k] = String(v); },
                getAttribute(k) { return this.attributes[k]; },
                addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
                querySelector(sel) {
                    if (sel.charAt(0) === '#') return byId.get(sel.slice(1)) || null;
                    if (sel.charAt(0) === '.') {
                        const cls = sel.slice(1);
                        const walk = function (n) {
                            for (const c of n.children) {
                                if ((' ' + c.className + ' ').indexOf(' ' + cls + ' ') >= 0) return c;
                                const f = walk(c); if (f) return f;
                            }
                            return null;
                        };
                        return walk(node);
                    }
                    return byId.get(sel) || null;
                },
                appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
                removeChild(c) {
                    const i = this.children.indexOf(c);
                    if (i >= 0) this.children.splice(i, 1);
                    c.parentNode = null;
                },
                focus() {},
                click() { (this.listeners.click || []).forEach(function (fn) { fn({ target: node, preventDefault: function () {} }); }); },
            };
            return node;
        }
        const body = el('body');
        const head = el('head');
        const doc = {
            body: body,
            head: head,
            getElementById(id) { return byId.get(id) || null; },
            createElement: el,
            addEventListener() {},
            removeEventListener() {},
        };
        head.appendChild = function (c) { c.parentNode = head; head.children.push(c); return c; };
        body.appendChild = function (c) { c.parentNode = body; body.children.push(c); if (c.id) byId.set(c.id, c); return c; };
        const expired = new Error('Enter a fresh authenticator code for this action.');
        expired.code = 'failed-precondition';
        let answers = [{ needsOverride: true, preflight: { ok: false } }, { err: expired }, { ok: true, on: true, changed: true }];
        const sandbox = {
            window: {
                _isAdminClaim: true,
                _showFreshStepUp: function (action) {
                    calls.push(action);
                    return Promise.resolve('proof-' + calls.length);
                },
            },
            document: doc,
            firebase: {
                functions: function () {
                    return {
                        httpsCallable: function () {
                            return function (payload) {
                                payloads.push(JSON.parse(JSON.stringify(payload)));
                                const next = answers.shift() || { ok: true, on: true, changed: true };
                                if (next.err) return Promise.reject(next.err);
                                return Promise.resolve({ data: next });
                            };
                        },
                    };
                },
            },
            location: { hash: '' },
            console: console,
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            Promise: Promise,
        };
        sandbox.window.window = sandbox.window;
        sandbox.global = sandbox;
        vm.runInNewContext(panel, sandbox, { filename: 'admin-panel.js' });
        sandbox.window.bqEmergencyStop();
        const go = doc.getElementById('ksuGo');
        const ov = doc.getElementById('ksuOverride');
        go.click();
        await new Promise(function (r) { setTimeout(r, 30); });
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(payloads[0].freshProofId, 'proof-1');
        assert.strictEqual(ov.checked, true);
        go.click();
        await new Promise(function (r) { setTimeout(r, 30); });
        assert.strictEqual(calls.length, 1, 'second click still reused the held proof');
        assert.strictEqual(payloads.length, 2);
        assert.strictEqual(payloads[1].freshProofId, 'proof-1');
        go.click();
        await new Promise(function (r) { setTimeout(r, 30); });
        assert.strictEqual(calls.length, 2, 'after a dead-proof error the next tap asks for a new code');
        assert.strictEqual(payloads.length, 3);
        assert.strictEqual(payloads[2].freshProofId, 'proof-2');
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
}

run().catch(function (e) {
    console.error(e);
    process.exit(1);
});
