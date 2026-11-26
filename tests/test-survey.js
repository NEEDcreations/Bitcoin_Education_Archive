#!/usr/bin/env node
'use strict';
// In-app survey: server validation, once-per-uid 25 OrangeTix grant, rate
// limit, kill-switch close, client/server question parity, and the
// Phil-approved pause / offline copy.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const survey = require(path.join(root, 'functions/src/survey.js'));
const tombstone = require(path.join(root, 'functions/src/accountTombstone.js'));
// Test-only HMAC key so the real tombstone lookup runs against the fake db.
process.env.DELETION_HMAC_SECRET = 'test-only-hmac-key-not-a-secret-0123';
const ks = require(path.join(root, 'functions/src/killSwitch.js'));

let passed = 0;
let failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e)); failed++; }
}

// ---------------------------------------------------------------- fake db
const DELETE = {};
function makeAdmin() {
    function Ts(ms) { this.ms = ms; }
    Ts.prototype.toMillis = function () { return this.ms; };
    return {
        firestore: {
            FieldValue: {
                serverTimestamp: function () { return { __ts: true }; },
                increment: function (n) { return { __inc: n }; },
            },
            Timestamp: { fromMillis: function (ms) { return new Ts(ms); } },
        },
    };
}
function makeDb(seed) {
    const store = new Map(Object.entries(seed || {}));
    let autoId = 0;
    function resolve(v, prev) {
        if (v && v.__ts) return { toMillis: function () { return Date.now(); }, __server: true };
        if (v && typeof v.__inc === 'number') return (typeof prev === 'number' ? prev : 0) + v.__inc;
        return v;
    }
    function docRef(p) {
        return {
            path: p,
            id: p.split('/').pop(),
            collection: function (c) { return colRef(p + '/' + c); },
            get: async function () { return snap(p); },
        };
    }
    function colRef(p) {
        return { doc: function (id) { return docRef(p + '/' + (id || ('auto' + (++autoId)))); } };
    }
    function snap(p) {
        const d = store.get(p);
        return { exists: d !== undefined, data: function () { return d === undefined ? undefined : JSON.parse(JSON.stringify(d, function (k, v) { return v; })) && d; } };
    }
    function write(p, data, mode) {
        const prev = store.get(p);
        if (mode === 'create' && prev !== undefined) { const e = new Error('ALREADY_EXISTS ' + p); e.code = 6; throw e; }
        if (mode === 'update' && prev === undefined) { const e = new Error('NOT_FOUND ' + p); e.code = 5; throw e; }
        const base = mode === 'update' ? Object.assign({}, prev) : {};
        Object.keys(data).forEach(function (k) { base[k] = resolve(data[k], base[k]); });
        store.set(p, base);
    }
    let txLock = Promise.resolve();
    const db = {
        store: store,
        writes: 0,
        collection: function (c) { return colRef(c); },
        runTransaction: async function (fn) {
            // Serialize transactions so concurrent submits behave like Firestore retries.
            let release;
            const prior = txLock;
            txLock = new Promise(function (r) { release = r; });
            await prior;
            const ops = [];
            const tx = {
                get: async function (ref) { return snap(ref.path); },
                set: function (ref, data) { ops.push([ref.path, data, 'set']); },
                update: function (ref, data) { ops.push([ref.path, data, 'update']); },
                create: function (ref, data) { ops.push([ref.path, data, 'create']); },
            };
            try {
                const out = await fn(tx);
                ops.forEach(function (o) { write(o[0], o[1], o[2]); db.writes++; });
                return out;
            } finally { release(); }
        },
    };
    return db;
}
function HttpsError(code, message, details) {
    const e = new Error(message);
    e.code = code;
    e.details = details;
    return e;
}
function makeFunctionsV1(captured) {
    return {
        https: { HttpsError: HttpsError, onCall: function (h) { const f = function () {}; f.__endpoint = { callableTrigger: {} }; f.__h = h; return f; } },
        runWith: function (opts) {
            captured.opts = opts;
            return { https: { onCall: function (h) { const f = function () {}; f.__endpoint = { callableTrigger: {} }; f.__h = h; return f; } } };
        },
    };
}
// Auth records: any uid not listed is an old, active account.
const OLD_AUTH = { disabled: false, email: 'old@example.test', emailVerified: true, metadata: { creationTime: 'Wed, 01 Jan 2025 00:00:00 GMT' } };
function setup(seed, nowMs, authUsers) {
    const db = makeDb(seed);
    const authMap = authUsers || {};
    const captured = {};
    const fn = survey.makeSubmitSurvey({
        runWith: { enforceAppCheck: true },
        functionsV1: makeFunctionsV1(captured),
        admin: makeAdmin(),
        getDb: function () { return db; },
        now: function () { return nowMs || Date.parse('2026-11-15T12:00:00Z'); },
        getAuth: function () {
            return {
                getUser: async function (uid) {
                    if (authMap[uid] === null) { const e = new Error('no user'); e.code = 'auth/user-not-found'; throw e; }
                    return authMap[uid] || OLD_AUTH;
                },
            };
        },
    });
    return { db: db, call: fn.__surveyHandler, opts: captured.opts };
}
function ctx(uid, extra) {
    return Object.assign({ auth: { uid: uid, token: { firebase: { sign_in_provider: 'password' } } }, app: { appId: 'x' } }, extra || {});
}
const goodFull = { surveyId: survey.SURVEY_ID, variant: 'full', answers: { q1: 'friend', q2: ['lessons', 'rewards'], q3: 'Wheel errors', q4: 4, q6: 5, q8: 'yes', q9: 'building', q10: ['cosmetics'], q11: 9, q12: 'Keep it up' } };
const user = function (extra) { return Object.assign({ orangeTickets: 10 }, extra || {}); };
async function rejects(p, code) {
    let err = null;
    try { await p; } catch (e) { err = e; }
    assert.ok(err, 'expected rejection ' + code);
    assert.strictEqual(err.code, code, 'got ' + err.code + ' ' + err.message);
    return err;
}

(async function main() {
    await test('questions: 11 in the full set, no rename question, lapsed set is 1,3,8,12 + stop', function () {
        assert.strictEqual(survey.VARIANTS.full.length, 11);
        assert.ok(survey.VARIANTS.full.indexOf('q7') === -1);
        assert.deepStrictEqual(Array.from(survey.VARIANTS.lapsed), ['q1', 'q3', 'q8', 'q12', 'stop']);
        assert.strictEqual(survey.REWARD_TICKETS, 25);
    });

    await test('validate: accepts a full answer set and a lapsed set; only q1 required', function () {
        assert.ok(survey.validate(goodFull).ok);
        assert.ok(survey.validate({ surveyId: survey.SURVEY_ID, variant: 'full', answers: { q1: 'x' } }).ok);
        const lap = survey.validate({ surveyId: survey.SURVEY_ID, variant: 'lapsed', answers: { q1: 'other', stop: 'Too busy', q8: 'maybe' } });
        assert.ok(lap.ok);
        assert.strictEqual(survey.validate({ surveyId: survey.SURVEY_ID, variant: 'full', answers: { q2: ['chat'] } }).why, 'missing_required');
    });

    await test('validate: refuses bad survey, variant, options, scales, extras and long text', function () {
        const base = function (answers, variant) { return { surveyId: survey.SURVEY_ID, variant: variant || 'full', answers: answers }; };
        assert.strictEqual(survey.validate(null).why, 'bad_payload');
        assert.strictEqual(survey.validate({ surveyId: 'other', variant: 'full', answers: { q1: 'x' } }).why, 'bad_survey');
        assert.strictEqual(survey.validate(base({ q1: 'x' }, 'admin')).why, 'bad_variant');
        assert.strictEqual(survey.validate(base({ q1: 'x' }, '__proto__')).why, 'bad_variant');
        assert.strictEqual(survey.validate(base({ q1: 'tiktok' })).why, 'bad_option');
        assert.strictEqual(survey.validate(base({ q1: 'x', q7: 'love' })).why, 'unknown_question');
        assert.strictEqual(survey.validate(base({ q1: 'x', stop: 'why' })).why, 'unknown_question');
        assert.strictEqual(survey.validate(base({ q1: 'x', q2: 'lessons' })).why, 'bad_multi');
        assert.strictEqual(survey.validate(base({ q1: 'x', q2: ['lessons', 'lessons'] })).why, 'dup_option');
        assert.strictEqual(survey.validate(base({ q1: 'x', q10: ['none', 'cosmetics'] })).why, 'exclusive_option');
        assert.strictEqual(survey.validate(base({ q1: 'x', q4: 6 })).why, 'bad_scale');
        assert.strictEqual(survey.validate(base({ q1: 'x', q4: 2.5 })).why, 'bad_scale');
        assert.strictEqual(survey.validate(base({ q1: 'x', q11: -1 })).why, 'bad_scale');
        assert.strictEqual(survey.validate(base({ q1: 'x', q4: '4' })).why, 'bad_scale');
        assert.strictEqual(survey.validate(base({ q1: 'x', q3: 5 })).why, 'bad_text');
        assert.strictEqual(survey.validate(base({ q1: 'x', q3: 'a'.repeat(1001) })).why, 'text_too_long');
        assert.strictEqual(survey.validate(base(['q1'])).why, 'bad_answers');
    });

    await test('validate: strips markup characters and control characters from text', function () {
        const v = survey.validate({ surveyId: survey.SURVEY_ID, variant: 'full', answers: { q1: 'x', q3: '<img src=x onerror=alert(1)>\u0007 hi' } });
        assert.ok(v.ok);
        assert.strictEqual(v.answers.q3.indexOf('<'), -1);
        assert.strictEqual(v.answers.q3.indexOf('>'), -1);
        assert.strictEqual(v.answers.q3.indexOf('\u0007'), -1);
    });

    await test('closedReason: open before any flip, closed while on, closed for good after a later flip', function () {
        const opened = survey.OPENED_AT_DEFAULT_MS;
        const t = opened + 86400000;
        assert.strictEqual(survey.closedReason(null, null, t), null);
        assert.strictEqual(survey.closedReason({ enabled: false, since: opened - 1000 }, null, t), null);
        assert.strictEqual(survey.closedReason({ enabled: true }, null, t), 'kill_switch_on');
        assert.strictEqual(survey.closedReason({ enabled: false, since: opened + 1000 }, null, t), 'kill_switch_flipped');
        assert.strictEqual(survey.closedReason({ enabled: true, autoReenableAt: t - 1, since: opened - 5 }, null, t), null);
        assert.strictEqual(survey.closedReason(null, { closed: true }, t), 'closed_by_admin');
        assert.strictEqual(survey.closedReason({ enabled: false, since: opened + 1000 }, { openedAt: opened + 2000 }, t), null);
    });

    await test('submitSurvey is App Check enforced and refuses to build without it', function () {
        const s = setup({});
        assert.strictEqual(s.opts.enforceAppCheck, true);
        assert.throws(function () {
            survey.makeSubmitSurvey({ functionsV1: makeFunctionsV1({}), admin: makeAdmin(), getDb: function () { return makeDb(); } });
        }, /App Check/);
        const idx = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
        assert.ok(/exports\.submitSurvey = require\('\.\/src\/survey'\)\.makeSubmitSurvey\(\{\n(\s+\/\/[^\n]*\n)?\s+runWith: \{ enforceAppCheck: true, secrets: \[deletionHmacSecret\] \}/.test(idx));
    });

    await test('submitSurvey is gated by the kill switch (rewards list) and the client waits for App Check', function () {
        assert.ok(ks.gatedNames().indexOf('submitSurvey') !== -1);
        const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
        assert.ok(ranking.indexOf('    submitSurvey: 1,') !== -1);
    });

    await test('refuses signed-out, anonymous and missing App Check before any write', async function () {
        const s = setup({ 'users/u1': user() });
        await rejects(s.call(goodFull, {}), 'unauthenticated');
        await rejects(s.call(goodFull, ctx('u1', { auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'anonymous' } } } })), 'permission-denied');
        await rejects(s.call(goodFull, ctx('u1', { app: undefined })), 'failed-precondition');
        assert.strictEqual(s.db.writes, 0);
    });

    await test('grants 25 OrangeTix once, stores the response, claim, done flag and one audit row', async function () {
        const s = setup({ 'users/u1': user() });
        const r = await s.call(goodFull, ctx('u1'));
        assert.deepStrictEqual(r, { ok: true, already: false, granted: true, tickets: 25 });
        const st = s.db.store;
        assert.strictEqual(st.get('users/u1').orangeTickets, 35);
        assert.ok(st.get('users/u1')[survey.USER_DONE_FIELD]);
        const resp = st.get('survey_responses/u1');
        assert.strictEqual(resp.variant, 'full');
        assert.strictEqual(resp.answers.q1, 'friend');
        assert.strictEqual(resp.uid, 'u1');
        assert.ok(st.get('users/u1/award_claims/' + survey.CLAIM_ID));
        const audits = Array.from(st.keys()).filter(function (k) { return k.indexOf('survey_audit/') === 0; });
        assert.strictEqual(audits.length, 1);
        const a = st.get(audits[0]);
        assert.strictEqual(a.action, 'survey_reward_granted');
        assert.strictEqual(a.tickets, 25);
        assert.strictEqual(a.uidMasked, '***');
        assert.strictEqual(a.uid, undefined);
        assert.strictEqual(survey.maskUid('abcdefghijkl'), 'abc***jkl');
    });

    await test('second submit and concurrent submits grant nothing more (idempotent per uid)', async function () {
        const s = setup({ 'users/u2': user({ orangeTickets: 0 }) });
        const results = await Promise.all([s.call(goodFull, ctx('u2')), s.call(goodFull, ctx('u2')), s.call(goodFull, ctx('u2'))]);
        assert.strictEqual(results.filter(function (r) { return r.tickets === 25; }).length, 1);
        assert.strictEqual(results.filter(function (r) { return r.already === true; }).length, 2);
        const again = await s.call({ surveyId: survey.SURVEY_ID, variant: 'lapsed', answers: { q1: 'x' } }, ctx('u2'));
        assert.deepStrictEqual(again, { ok: true, already: true, granted: true, tickets: 0 });
        assert.strictEqual(s.db.store.get('users/u2').orangeTickets, 25);
        assert.strictEqual(s.db.store.get('survey_responses/u2').variant, 'full');
        const audits = Array.from(s.db.store.keys()).filter(function (k) { return k.indexOf('survey_audit/') === 0; });
        assert.strictEqual(audits.length, 1);
    });

    await test('an existing award claim alone also blocks a second grant', async function () {
        const seed = { 'users/u3': user({ orangeTickets: 3 }) };
        seed['users/u3/award_claims/' + survey.CLAIM_ID] = { tickets: 25 };
        const s = setup(seed);
        const r = await s.call(goodFull, ctx('u3'));
        assert.strictEqual(r.already, true);
        assert.strictEqual(s.db.store.get('users/u3').orangeTickets, 3);
    });

    await test('a fresh account (created after openedAt) gets its answers saved but no OrangeTix', async function () {
        const fresh = { disabled: false, metadata: { creationTime: new Date(Date.parse('2026-11-14T18:00:01Z')).toUTCString() } };
        const s = setup({ 'users/new1': user({ orangeTickets: 0 }) }, null, { new1: fresh });
        const r = await s.call(goodFull, ctx('new1'));
        assert.deepStrictEqual(r, { ok: true, already: false, granted: false, reason: 'account_too_new', tickets: 0 });
        const st = s.db.store;
        assert.strictEqual(st.get('users/new1').orangeTickets, 0);
        assert.ok(st.get('users/new1')[survey.USER_DONE_FIELD]);
        const resp = st.get('survey_responses/new1');
        assert.strictEqual(resp.answers.q3, 'Wheel errors');
        assert.strictEqual(resp.granted, false);
        assert.strictEqual(resp.noGrantReason, 'account_too_new');
        assert.ok(!st.has('users/new1/award_claims/' + survey.CLAIM_ID));
        const audits = Array.from(st.keys()).filter(function (k) { return k.indexOf('survey_audit/') === 0; }).map(function (k) { return st.get(k); });
        assert.strictEqual(audits.length, 1);
        assert.strictEqual(audits[0].action, 'survey_response_no_grant');
        assert.strictEqual(audits[0].tickets, 0);
        assert.strictEqual(audits[0].uidMasked, '***');
        assert.strictEqual(audits[0].uid, undefined);
        // A repeat stays a no-op.
        const again = await s.call(goodFull, ctx('new1'));
        assert.deepStrictEqual(again, { ok: true, already: true, granted: false, tickets: 0 });
        assert.strictEqual(st.get('users/new1').orangeTickets, 0);
        // config/survey.openedAt moves the cutoff.
        const s2 = setup({ 'users/new1': user({ orangeTickets: 0 }), 'config/survey': { openedAt: Date.parse('2026-12-01T00:00:00Z') } }, Date.parse('2026-12-02T00:00:00Z'), { new1: fresh });
        const r2 = await s2.call(goodFull, ctx('new1'));
        assert.strictEqual(r2.granted, true);
        assert.strictEqual(s2.db.store.get('users/new1').orangeTickets, 25);
        // No creation time at all is treated as new.
        assert.strictEqual(survey.grantBlockReason({ metadata: {} }, {}, survey.OPENED_AT_DEFAULT_MS, { configured: true, docs: [] }), 'account_too_new');
    });

    await test('disabled, merged, deleted and re-created accounts get no grant', async function () {
        const cases = [
            ['d1', {}, { disabled: true, metadata: OLD_AUTH.metadata }, 'account_disabled'],
            ['d2', { disabled: true }, OLD_AUTH, 'account_disabled'],
            ['m1', { mergedInto: 'someoneElse' }, OLD_AUTH, 'account_merged'],
            ['x1', { deletedAt: 123 }, OLD_AUTH, 'account_deleted'],
            ['x2', { deleted: true }, OLD_AUTH, 'account_deleted'],
            ['x3', {}, null, 'account_deleted'],
        ];
        // Re-created account: its verified email matches a deleted_accounts tombstone.
        const again = Object.assign({}, OLD_AUTH, { email: 'Gone@Example.test' });
        const tombId = tombstone.emailHmac('gone@example.test');
        assert.ok(/^[a-f0-9]{64}$/.test(tombId));
        const seedR = { 'users/r1': user({ orangeTickets: 4 }) };
        seedR['deleted_accounts/' + tombId] = { deletedAt: 1, ageDays: 40 };
        const sr = setup(seedR, null, { r1: again });
        const rr = await sr.call(goodFull, ctx('r1'));
        assert.deepStrictEqual(rr, { ok: true, already: false, granted: false, reason: 'account_recreated', tickets: 0 });
        assert.strictEqual(sr.db.store.get('users/r1').orangeTickets, 4);
        assert.ok(sr.db.store.has('survey_responses/r1'));
        // A different email with no tombstone is still paid.
        const so = setup(seedR, null, { r1: OLD_AUTH });
        assert.strictEqual((await so.call(goodFull, ctx('r1'))).granted, true);
        // Tombstone secret missing: fail closed (answers saved, no grant).
        const saved = process.env.DELETION_HMAC_SECRET;
        delete process.env.DELETION_HMAC_SECRET;
        try {
            const su = setup({ 'users/s1': user({ orangeTickets: 4 }) });
            const ru = await su.call(goodFull, ctx('s1'));
            assert.strictEqual(ru.granted, false);
            assert.strictEqual(ru.reason, 'identity_check_unavailable');
            assert.strictEqual(su.db.store.get('users/s1').orangeTickets, 4);
        } finally { process.env.DELETION_HMAC_SECRET = saved; }
        for (let i = 0; i < cases.length; i++) {
            const c = cases[i];
            const seed = {}; seed['users/' + c[0]] = user(Object.assign({ orangeTickets: 4 }, c[1]));
            const auth = {}; auth[c[0]] = c[2];
            const s = setup(seed, null, auth);
            const r = await s.call(goodFull, ctx(c[0]));
            assert.deepStrictEqual(r, { ok: true, already: false, granted: false, reason: c[3], tickets: 0 }, c[0]);
            assert.strictEqual(s.db.store.get('users/' + c[0]).orangeTickets, 4, c[0]);
            assert.ok(s.db.store.has('survey_responses/' + c[0]), c[0]);
            assert.ok(!s.db.store.has('users/' + c[0] + '/award_claims/' + survey.CLAIM_ID), c[0]);
        }
    });

    await test('client shows a neutral thank-you and no reward promise for ineligible accounts', function () {
        const clientSrc = fs.readFileSync(path.join(root, 'survey.js'), 'utf8');
        assert.ok(clientSrc.indexOf("var DONE_PLAIN = 'Thanks! Your answers are saved.';") !== -1);
        assert.ok(/d\.granted === false \|\| !d\.tickets\) showDone\(card, DONE_PLAIN\)/.test(clientSrc));
        assert.ok(/rewardShown\(\) \? SURVEY_BANNER : SURVEY_BANNER_PLAIN/.test(clientSrc));
        assert.ok(/rewardShown\(\) \? SURVEY_INTRO : SURVEY_INTRO_PLAIN/.test(clientSrc));
        ['SURVEY_BANNER_PLAIN', 'SURVEY_INTRO_PLAIN', 'DONE_PLAIN'].forEach(function (k) {
            const m = clientSrc.match(new RegExp('var ' + k + " = '([^']*)'"));
            assert.ok(m && !/OrangeTix|\u2014/.test(m[1]), k);
        });
        const server = fs.readFileSync(path.join(root, 'functions/src/survey.js'), 'utf8');
        assert.ok(/must render them as plain text only/.test(server));
    });

    await test('account deletion removes survey_responses/{uid} but keeps survey_audit', function () {
        const del = fs.readFileSync(path.join(root, 'functions/src/deleteAccount.js'), 'utf8');
        assert.ok(/\['survey_responses', uid, \[\]\]/.test(del));
        assert.ok(del.indexOf('survey_audit') === -1 || !/deleteWhere\(db, batcher, 'survey_audit'/.test(del));
    });

    await test('closed after the kill switch flips: no response, no tickets', async function () {
        const s = setup({ 'users/u4': user(), 'config/killSwitch': { enabled: false, since: Date.parse('2026-11-28T15:00:00Z') } }, Date.parse('2027-01-04T12:00:00Z'));
        const e = await rejects(s.call(goodFull, ctx('u4')), 'failed-precondition');
        assert.strictEqual(e.message, survey.CLOSED_MESSAGE);
        assert.strictEqual(e.details.why, 'kill_switch_flipped');
        assert.ok(!s.db.store.get('survey_responses/u4'));
        assert.strictEqual(s.db.store.get('users/u4').orangeTickets, 10);
    });

    await test('closed while the switch is on, and when config/survey.closed is set', async function () {
        const s = setup({ 'users/u5': user(), 'config/killSwitch': { enabled: true } });
        assert.strictEqual((await rejects(s.call(goodFull, ctx('u5')), 'failed-precondition')).details.why, 'kill_switch_on');
        const s2 = setup({ 'users/u5': user(), 'config/survey': { closed: true } });
        assert.strictEqual((await rejects(s2.call(goodFull, ctx('u5')), 'failed-precondition')).details.why, 'closed_by_admin');
    });

    await test('banned and missing accounts get nothing', async function () {
        const s = setup({ 'users/b1': user({ ban_reason: 'spam' }) });
        await rejects(s.call(goodFull, ctx('b1')), 'permission-denied');
        await rejects(s.call(goodFull, ctx('ghost')), 'failed-precondition');
        assert.strictEqual(s.db.store.get('users/b1').orangeTickets, 10);
        assert.ok(!s.db.store.get('survey_responses/b1'));
        assert.ok(!s.db.store.get('users/ghost'));
    });

    await test('invalid answers are refused without a response or grant', async function () {
        const s = setup({ 'users/u6': user() });
        const e = await rejects(s.call({ surveyId: survey.SURVEY_ID, variant: 'full', answers: { q1: 'x', q4: 99 } }, ctx('u6')), 'invalid-argument');
        assert.strictEqual(e.details.why, 'bad_scale');
        assert.ok(!s.db.store.get('survey_responses/u6'));
        assert.strictEqual(s.db.store.get('users/u6').orangeTickets, 10);
    });

    await test('rate limit: call 11 in 10 minutes is refused before validation', async function () {
        const s = setup({ 'users/u7': user() });
        for (let i = 0; i < survey.RATE_MAX; i++) {
            await rejects(s.call({ surveyId: 'nope' }, ctx('u7')), 'invalid-argument');
        }
        await rejects(s.call(goodFull, ctx('u7')), 'resource-exhausted');
        assert.ok(!s.db.store.get('survey_responses/u7'));
        const rl = s.db.store.get('rate_limits/survey_u7');
        assert.strictEqual(rl.count, survey.RATE_MAX);
        assert.ok(rl.expireAt && rl.expireAt.toMillis() > 0, 'rate row must carry expireAt for the cleanup sweep');
    });

    // ------------------------------------------------------------ client
    const clientSrc = fs.readFileSync(path.join(root, 'survey.js'), 'utf8');
    function loadClient() {
        const sandbox = { window: {}, document: { readyState: 'complete', getElementById: function () { return null; } }, localStorage: { getItem: function () { return null; }, setItem: function () {} }, location: { search: '', hash: '' }, setTimeout: function () {}, setInterval: function () { return 0; }, clearInterval: function () {}, URLSearchParams: URLSearchParams, console: console };
        sandbox.window = sandbox;
        vm.createContext(sandbox);
        vm.runInContext(clientSrc, sandbox);
        return sandbox.bqSurveySpec;
    }

    await test('client question ids and option keys match the server', function () {
        const spec = loadClient();
        assert.deepStrictEqual(JSON.parse(JSON.stringify(spec.variants)), JSON.parse(JSON.stringify(survey.VARIANTS)));
        survey.QUESTIONS.forEach(function (q) {
            const c = spec.questions[q.id];
            assert.ok(c, 'client missing ' + q.id);
            assert.strictEqual(c.type, q.type, q.id);
            if (q.options) assert.deepStrictEqual(JSON.parse(JSON.stringify(c.options.map(function (o) { return o[0]; }))), Array.from(q.options), q.id);
            if (q.type === 'scale') { assert.strictEqual(c.min, q.min); assert.strictEqual(c.max, q.max); }
            assert.strictEqual(!!c.required, !!q.required, q.id);
        });
        assert.deepStrictEqual(JSON.parse(JSON.stringify(spec.lapsedOrder.slice().sort())), survey.VARIANTS.lapsed.slice().sort());
        assert.strictEqual(Object.keys(spec.questions).length, survey.QUESTIONS.length);
    });

    await test('survey question wording matches Rebrand Plan (Q7 removed)', function () {
        const spec = loadClient();
        assert.strictEqual(spec.questions.q1.text, 'How did you first find the app?');
        assert.strictEqual(spec.questions.q3.text, 'What\u2019s the most frustrating part right now?');
        assert.strictEqual(spec.questions.q8.text, 'Would you play a build-and-defend mode where you build a Citadel and defend it from scam-coin raiders?');
        assert.strictEqual(spec.questions.q11.text, 'How likely are you to recommend the app to a friend?');
        assert.strictEqual(spec.questions.stop.text, 'What made you stop?');
        assert.ok(!/renam/i.test(clientSrc), 'no rename question');
    });

    await test('the planned pause notice and Citadels offline page copy are gone', function () {
        const spec = loadClient();
        assert.strictEqual(spec.pauseText, undefined);
        assert.strictEqual(spec.returnDate, undefined);
        assert.ok(clientSrc.indexOf('bqPauseNotice') === -1);
        assert.ok(clientSrc.indexOf('PAUSE_TEXT') === -1);
        assert.ok(clientSrc.indexOf('taking a short break') === -1);
        const killSrc = fs.readFileSync(path.join(root, 'kill-switch.js'), 'utf8');
        assert.ok(killSrc.indexOf('OFFLINE_BODY') === -1);
        assert.ok(killSrc.indexOf('OFFLINE_RETURN_DATE') === -1);
        assert.ok(killSrc.indexOf('longPause') === -1);
        assert.ok(!/Bitcoin Quest is back January 3/i.test(killSrc));
        assert.ok(!/taking a short break/i.test(killSrc));
        assert.ok(killSrc.indexOf("var MESSAGE = 'Bitcoin Quest is temporarily offline for maintenance.';") !== -1);
    });

    await test('no em-dashes in new user-facing copy; survey copy does not lead with Bitcoin', function () {
        assert.strictEqual(clientSrc.indexOf('\u2014'), -1);
        assert.strictEqual(clientSrc.indexOf('\\u2014'), -1);
        const killSrc = fs.readFileSync(path.join(root, 'kill-switch.js'), 'utf8');
        assert.strictEqual(killSrc.indexOf('\u2014'), -1);
        ['SURVEY_TITLE', 'SURVEY_BANNER', 'SURVEY_BANNER_BUTTON', 'SURVEY_INTRO'].forEach(function (k) {
            const m = clientSrc.match(new RegExp('var ' + k + " = '([^']*)'"));
            assert.ok(m, k);
            assert.ok(!/^\s*bitcoin/i.test(m[1]), k + ' leads with Bitcoin');
        });
    });

    await test('survey answers never land in client-readable places and the client grants nothing', function () {
        assert.ok(!/orangeTickets/.test(clientSrc));
        assert.ok(!/survey_responses/.test(clientSrc));
        assert.ok(/httpsCallable\('submitSurvey'\)/.test(clientSrc));
    });

    await test('index.html and 404.html load survey.js right after kill-switch.js', function () {
        ['index.html', '404.html'].forEach(function (f) {
            const html = fs.readFileSync(path.join(root, f), 'utf8');
            const a = html.search(/<script src="\/kill-switch\.js\?v=[^"]+" defer><\/script>/);
            const b = html.indexOf('<script src="/survey.js?v=20261126_v2696" defer></script>');
            assert.ok(a !== -1 && b !== -1 && a < b, f);
            // Pins on kill-switch.js and ranking.js stay at the gh-pages values; do not re-pin here.
            assert.ok(html.includes('kill-switch.js?v=20261126_v2696'), f);
            assert.ok(html.includes('ranking.js?v=20261126_v2718'), f);
            assert.ok(!html.includes('kill-switch.js?v=20261114_v2570'), f);
            assert.ok(!html.includes('ranking.js?v=20261114_v2570'), f);
        });
    });

    await test('rules: survey responses and audit are admin-read only, no client writes, config/survey readable', function () {
        const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
        const resp = rules.slice(rules.indexOf('match /survey_responses/{uid}'), rules.indexOf('match /survey_audit/{docId}'));
        assert.ok(/allow read: if isAdmin\(\);/.test(resp));
        assert.ok(/allow create, update, delete: if false;/.test(resp));
        assert.ok(rules.indexOf("allow read: if docId == 'survey';") !== -1);
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
