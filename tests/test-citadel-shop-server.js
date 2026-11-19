'use strict';
// Citadel shop callables (functions/src/citadelShop.js). Premium gate, hard
// 120 OrangeTix weekly cap in one transaction with the debit, server prices and
// stage order, requestId idempotency, lesson grant once per uid. No network.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const core = require(path.join(root, 'functions/src/citadelShop.js'));

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name: name, fn: fn }); }

// ---------- in-memory Firestore with serialized transactions ----------
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function deepMerge(a, b) {
    const out = Object.assign({}, a);
    Object.keys(b).forEach(function (k) {
        const v = b[k];
        out[k] = v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])
            ? deepMerge(out[k], v) : v;
    });
    return out;
}
function makeDb() {
    const store = new Map();
    let lock = Promise.resolve();
    let txCount = 0;
    function apply(k, data, opts) {
        const cur = store.get(k);
        const incoming = clone(data);
        store.set(k, opts && opts.merge && cur ? deepMerge(cur, incoming) : incoming);
    }
    function snap(k, id) {
        const v = store.get(k);
        return { id: id, exists: v !== undefined, data: function () { return clone(v); } };
    }
    function docRef(col, id) {
        const k = col + '/' + id;
        return { id: id, _k: k, async get() { return snap(k, id); }, async set(d, o) { apply(k, d, o); } };
    }
    function collection(col) { return { doc: function (id) { return docRef(col, id); } }; }
    async function runTransaction(fn) {
        txCount++;
        let release;
        const prev = lock;
        lock = new Promise(function (r) { release = r; });
        await prev;
        const buf = [];
        const tx = {
            get: async function (ref) { return snap(ref._k, ref.id); },
            set: function (ref, d, o) { buf.push(['set', ref._k, d, o]); },
            create: function (ref, d) { buf.push(['create', ref._k, d]); },
        };
        try {
            const out = await fn(tx);
            buf.forEach(function (w) { if (w[0] === 'create' && store.has(w[1])) throw new Error('ALREADY_EXISTS'); });
            buf.forEach(function (w) { apply(w[1], w[2], w[3]); });
            return out;
        } finally { release(); }
    }
    return { store: store, collection: collection, runTransaction: runTransaction, txCount: function () { return txCount; } };
}

// ---------- fixtures ----------
const NOW = Date.UTC(2027, 0, 13, 17, 0); // Wed Jan 13, 2027, 12:00 PM ET
const OLD = NOW - 60 * 86400000;
const PREM = 'premUid000001';
const FREE = 'freeUid000002';
const LAPSED = 'lapsUid000003';
const GUEST = 'guestUid00004';
const ACTIVE_ENT = { subscriptionUntilMs: NOW + 20 * 86400000, subscriptionPlan: 'monthly' };

function ctx(uid) { return { auth: { uid: uid, token: { firebase: { sign_in_provider: uid === GUEST ? 'anonymous' : 'password' } } } }; }
function setup(o) {
    const opt = o || {};
    const db = makeDb();
    const logs = [];
    function put(k, v) { db.store.set(k, clone(v)); }
    put('users/' + PREM, { orangeTickets: 500, lqPassed: ['lq_mining'] });
    put('users/' + FREE, { orangeTickets: 500, lqPassed: ['lq_what_is_bitcoin', 'lq_nodes', 'lq_privacy'] });
    put('users/' + LAPSED, { orangeTickets: 500, citadel: { stages: { walls: 2 } } });
    put('users/' + GUEST, { orangeTickets: 500 });
    put('premium_entitlements/' + PREM, ACTIVE_ENT);
    put('premium_entitlements/' + LAPSED, { subscriptionUntilMs: NOW - 86400000, subscriptionPlan: 'monthly' });
    if (opt.config) put('config/citadelShop', opt.config);
    const svc = core.createCitadelShopService({
        db: db,
        nowMs: function () { return opt.now || NOW; },
        isOffline: async function () { return opt.offline === true; },
        isGuest: async function (c) { return c.auth.uid === GUEST; },
        accountCreatedMs: async function (uid) { return opt.created && uid in opt.created ? opt.created[uid] : OLD; },
        isStaging: function () { return opt.staging === true; },
        log: function (m) { logs.push(m); },
    });
    return { db: db, svc: svc, logs: logs, get: function (k) { return clone(db.store.get(k)); } };
}
let rid = 0;
function req() { return 'req' + String(++rid).padStart(8, '0'); }
function buy(t, uid, partId, stage, requestId) { return t.svc.buy(ctx(uid), { partId: partId, stage: stage, requestId: requestId || req() }); }

// ---------- basics ----------
test('server catalog is the draft: 15 stages, 1,500 OrangeTix, cap 120', function () {
    let stages = 0, total = 0;
    Object.keys(core.PARTS).forEach(function (k) { stages += core.PARTS[k].stages; total += core.PARTS[k].stages * core.PARTS[k].price; });
    assert.strictEqual(stages, 15);
    assert.strictEqual(total, 1500);
    assert.strictEqual(core.WEEKLY_CAP_OT, 120);
    assert.strictEqual(core.MIN_ACCOUNT_AGE_DAYS, 7);
});

test('lesson map matches the client CONFIG.LESSON_PART_MAP', function () {
    const src = fs.readFileSync(path.join(root, 'citadel-shop.js'), 'utf8');
    Object.keys(core.LESSON_PART_MAP).forEach(function (id) {
        const m = core.LESSON_PART_MAP[id];
        const re = new RegExp("id: '" + id + "',\\s+part: '" + m.part + "'.*lesson: '" + m.lesson + "'");
        assert.ok(re.test(src), id);
    });
});

test('Premium buy debits OrangeTix, advances the stage, records the purchase', async function () {
    const t = setup();
    const r = await buy(t, PREM, 'walls', 1, 'reqAAAAAAAA1');
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.price, 75);
    assert.strictEqual(r.newTickets, 425);
    assert.strictEqual(r.weekSpent, 75);
    const u = t.get('users/' + PREM);
    assert.strictEqual(u.orangeTickets, 425);
    assert.strictEqual(u.citadel.stages.walls, 1);
    const wk = core.weekInfo(NOW);
    const w = t.get('citadel_weekly/' + PREM + '_' + wk.key);
    assert.strictEqual(w.spent, 75);
    assert.strictEqual(new Date(w.expireAt).getTime(), wk.endMs + 14 * 86400000, 'expireAt = week end + 14 days');
    const p = t.get('citadel_purchases/' + PREM + '_reqAAAAAAAA1');
    assert.strictEqual(p.kind, 'stage');
    assert.strictEqual(p.price, 75);
    assert.ok(p.retainUntilMs > NOW + 390 * 86400000 && p.retainUntilMs < NOW + 400 * 86400000, '13 months');
});

test('purchase and counter rows carry no email, IP or wallet fields', async function () {
    const t = setup();
    await buy(t, PREM, 'walls', 1, 'reqBBBBBBBB1');
    const bad = /email|ip|wallet|lightning|lnaddress|nwc|invoice/i;
    t.db.store.forEach(function (v, k) {
        if (!/^citadel_/.test(k)) return;
        Object.keys(v).concat(Object.keys(v.result || {})).forEach(function (f) { assert.ok(!bad.test(f), k + ' field ' + f); });
    });
});

test('logs use masked uids', async function () {
    const t = setup();
    await buy(t, PREM, 'walls', 1);
    await t.svc.claimLessons(ctx(FREE));
    assert.ok(t.logs.length >= 2);
    t.logs.forEach(function (l) {
        assert.ok(l.indexOf(PREM) === -1 && l.indexOf(FREE) === -1, 'raw uid in log: ' + l);
    });
    assert.ok(t.logs[0].indexOf(core.maskUid(PREM)) !== -1);
});

test('client price and out-of-order stage are ignored or refused', async function () {
    const t = setup();
    const r1 = await t.svc.buy(ctx(PREM), { partId: 'walls', stage: 1, price: 1, requestId: req() });
    assert.strictEqual(r1.price, 75);
    const r2 = await buy(t, PREM, 'walls', 3);
    assert.strictEqual(r2.code, 'wrong_stage');
    const r3 = await buy(t, PREM, 'moat', 1);
    assert.strictEqual(r3.code, 'bad_request');
    const r4 = await t.svc.buy(ctx(PREM), { partId: 'walls', stage: 2, requestId: 'x' });
    assert.strictEqual(r4.code, 'bad_request');
});

test('a complete part cannot be bought again', async function () {
    const t = setup();
    t.db.store.set('users/' + PREM, { orangeTickets: 500, citadel: { stages: { turret: 2 } } });
    assert.strictEqual((await buy(t, PREM, 'turret', 3)).code, 'already_owned');
});

test('balance below the price is refused with no debit', async function () {
    const t = setup();
    t.db.store.set('users/' + PREM, { orangeTickets: 74 });
    assert.strictEqual((await buy(t, PREM, 'walls', 1)).code, 'balance');
    assert.strictEqual(t.get('users/' + PREM).orangeTickets, 74);
});

// ---------- cap ----------
test('the 120 cap is hard: a stage over what is left is refused', async function () {
    const t = setup();
    assert.strictEqual((await buy(t, PREM, 'walls', 1)).success, true); // 75
    const r = await buy(t, PREM, 'walls', 2); // 75 more = 150
    assert.strictEqual(r.code, 'weekly_cap');
    assert.strictEqual(t.get('users/' + PREM).orangeTickets, 425);
    const v = await buy(t, PREM, 'vault', 1); // 120 > 45 left
    assert.strictEqual(v.code, 'weekly_cap');
});

test('cap race: parallel buys never pass 120 in a week', async function () {
    const t = setup();
    t.db.store.set('users/' + PREM, { orangeTickets: 5000 });
    const calls = [buy(t, PREM, 'walls', 1), buy(t, PREM, 'turret', 1), buy(t, PREM, 'tower', 1), buy(t, PREM, 'keep', 1), buy(t, PREM, 'vault', 1)];
    const out = await Promise.all(calls);
    const ok = out.filter(function (r) { return r.success; });
    const spent = ok.reduce(function (n, r) { return n + r.price; }, 0);
    assert.ok(spent <= 120, 'spent ' + spent);
    assert.strictEqual(ok.length, 1);
    const w = t.get('citadel_weekly/' + PREM + '_' + core.weekInfo(NOW).key);
    assert.strictEqual(w.spent, spent);
    assert.strictEqual(t.get('users/' + PREM).orangeTickets, 5000 - spent);
});

test('cap resets at Monday 12:00 AM ET', async function () {
    const t = setup({ now: NOW });
    await buy(t, PREM, 'walls', 1);
    const next = core.weekInfo(NOW).endMs;
    const t2 = setup({ now: next });
    t2.db.store.forEach(function (v, k) { t2.db.store.delete(k); });
    t.db.store.forEach(function (v, k) { t2.db.store.set(k, clone(v)); });
    const r = await buy(t2, PREM, 'walls', 2);
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.weekSpent, 75);
});

// ---------- idempotency ----------
test('double requestId returns the first result and debits once', async function () {
    const t = setup();
    const a = await buy(t, PREM, 'walls', 1, 'reqDUPLICATE1');
    const b = await buy(t, PREM, 'walls', 1, 'reqDUPLICATE1');
    assert.strictEqual(a.success, true);
    assert.strictEqual(b.success, true);
    assert.strictEqual(b.repeat, true);
    assert.strictEqual(b.newTickets, a.newTickets);
    assert.strictEqual(t.get('users/' + PREM).orangeTickets, 425);
    assert.strictEqual(t.get('users/' + PREM).citadel.stages.walls, 1);
});

test('double requestId in parallel still debits once', async function () {
    const t = setup();
    const out = await Promise.all([buy(t, PREM, 'walls', 1, 'reqPARALLEL1'), buy(t, PREM, 'walls', 1, 'reqPARALLEL1')]);
    assert.ok(out.every(function (r) { return r.success; }));
    assert.strictEqual(t.get('users/' + PREM).orangeTickets, 425);
});

test('another player cannot replay someone else\u2019s requestId', async function () {
    const t = setup();
    t.db.store.set('premium_entitlements/' + FREE, ACTIVE_ENT);
    await buy(t, PREM, 'walls', 1, 'reqSHARED001');
    const r = await buy(t, FREE, 'walls', 1, 'reqSHARED001');
    assert.strictEqual(r.repeat, undefined);
    assert.strictEqual(t.get('users/' + FREE).orangeTickets, 425);
});

// ---------- gates ----------
test('free player buy is rejected with no writes', async function () {
    const t = setup();
    const before = JSON.stringify([...t.db.store]);
    const r = await buy(t, FREE, 'walls', 1);
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.code, 'not_premium');
    assert.strictEqual(JSON.stringify([...t.db.store]), before);
});

test('lapsed Premium cannot buy or build, and keeps bought stages', async function () {
    const t = setup();
    assert.strictEqual((await buy(t, LAPSED, 'walls', 3)).code, 'not_premium');
    t.db.store.set('users/' + LAPSED, { orangeTickets: 500, citadel: { stages: { walls: 2 }, lessonParts: { lesson_walls: true } } });
    assert.strictEqual((await t.svc.build(ctx(LAPSED), { lessonPartId: 'lesson_walls', requestId: req() })).code, 'not_premium');
    const s = await t.svc.status(ctx(LAPSED));
    assert.strictEqual(s.premiumActive, false);
    assert.strictEqual(s.stages.walls, 2);
});

test('guest is rejected', async function () {
    const t = setup();
    assert.strictEqual((await buy(t, GUEST, 'walls', 1)).code, 'guest');
    assert.strictEqual((await t.svc.claimLessons(ctx(GUEST))).code, 'guest');
    assert.strictEqual((await t.svc.buy({}, {})).code, 'unauthenticated');
});

test('kill switch refuses buy, build and grant', async function () {
    const t = setup({ offline: true });
    assert.strictEqual((await buy(t, PREM, 'walls', 1)).code, 'kill_switch');
    assert.strictEqual((await t.svc.build(ctx(PREM), { lessonPartId: 'lesson_keep', requestId: req() })).code, 'kill_switch');
    assert.strictEqual((await t.svc.claimLessons(ctx(FREE))).code, 'kill_switch');
    assert.strictEqual(t.db.txCount(), 0);
});

test('account younger than 7 days cannot buy', async function () {
    const created = {};
    created[PREM] = NOW - 3 * 86400000;
    const t = setup({ created: created });
    assert.strictEqual((await buy(t, PREM, 'walls', 1)).code, 'account_age');
    const unknown = {};
    unknown[PREM] = NaN;
    assert.strictEqual((await buy(setup({ created: unknown }), PREM, 'walls', 1)).code, 'account_age', 'unknown age fails closed');
});

test('closed before Jan 3, 2027 unless staging opens early', async function () {
    const before = Date.UTC(2026, 11, 20, 17);
    assert.strictEqual((await buy(setup({ now: before }), PREM, 'walls', 1)).code, 'not_open');
    assert.strictEqual((await buy(setup({ now: before, config: { openEarly: true } }), PREM, 'walls', 1)).code, 'not_open', 'live ignores openEarly');
    const ok = await buy(setup({ now: before, config: { openEarly: true }, staging: true }), PREM, 'walls', 1);
    assert.strictEqual(ok.success, true);
});

test('lesson grant is closed before Jan 3 too; status reports no pending grant', async function () {
    const before = Date.UTC(2026, 11, 20, 17);
    const t = setup({ now: before });
    assert.strictEqual((await t.svc.claimLessons(ctx(FREE))).code, 'not_open');
    assert.strictEqual(t.get('users/' + FREE).citadel, undefined, 'no grant written');
    const st = await t.svc.status(ctx(FREE));
    assert.strictEqual(st.open, false);
    assert.strictEqual(st.lessonGrantPending, false);
    assert.strictEqual((await t.svc.claimLessons(ctx(FREE))).code, 'not_open', 'live ignores openEarly for grants');
    const s2 = setup({ now: before, config: { openEarly: true }, staging: true });
    assert.deepStrictEqual((await s2.svc.claimLessons(ctx(FREE))).granted.sort(), ['lesson_tower', 'lesson_walls']);
});

test('a purchase row owned by another uid is never replayed', async function () {
    const t = setup();
    // uid 'premUid000001' + '_' + 'x_reqCOLLIDE' collides with uid 'premUid000001_x' + 'reqCOLLIDE'
    t.db.store.set('premium_entitlements/premUid000001_x', ACTIVE_ENT);
    t.db.store.set('users/premUid000001_x', { orangeTickets: 500 });
    t.db.store.set('citadel_purchases/premUid000001_x_reqCOLLIDE', { uid: PREM, kind: 'stage', result: { success: true, newTickets: 1 } });
    const r = await buy(t, 'premUid000001_x', 'walls', 1, 'reqCOLLIDE');
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.code, 'bad_request');
    assert.strictEqual(r.newTickets, undefined, 'no other player data leaked');
    const b = await t.svc.build(ctx('premUid000001_x'), { lessonPartId: 'lesson_walls', requestId: 'reqCOLLIDE' });
    assert.strictEqual(b.code, 'bad_request');
});

test('openEarly is honored only when the project id is bitcoin-quest-staging', function () {
    const fns = fs.readFileSync(path.join(root, 'functions/src/citadelShopFns.js'), 'utf8');
    assert.ok(fns.includes("const STAGING_PROJECT = 'bitcoin-quest-staging';"));
    assert.ok(fns.includes('isStaging: function () { return projectId() === STAGING_PROJECT; }'));
    const src = fs.readFileSync(path.join(root, 'functions/src/citadelShop.js'), 'utf8');
    assert.ok(src.includes("openEarly: d.openEarly === true && !!(deps.isStaging && deps.isStaging())"));
});

test('kill switch gate wraps the three value callables, not status', function () {
    const ks = require(path.join(root, 'functions/src/killSwitch.js'));
    const names = ks.gatedNames();
    ['buyCitadelStage', 'buildCitadelPart', 'claimLessonParts'].forEach(function (n) { assert.ok(names.indexOf(n) !== -1, n); });
    assert.ok(names.indexOf('getCitadelShopStatus') === -1);
});

test('referral-week Premium buys only when config/citadelShop flag is on', async function () {
    const ent = Object.assign({}, ACTIVE_ENT, { referralWeekUntilMs: NOW + 86400000 });
    const t = setup();
    t.db.store.set('premium_entitlements/' + PREM, ent);
    assert.strictEqual((await buy(t, PREM, 'walls', 1)).code, 'flag_off');
    const t2 = setup({ config: { referralWeekPremiumBuy: true } });
    t2.db.store.set('premium_entitlements/' + PREM, ent);
    assert.strictEqual((await buy(t2, PREM, 'walls', 1)).success, true);
});

test('trial Premium cannot buy (TRIAL_CAN_BUY false)', async function () {
    const t = setup();
    t.db.store.set('premium_entitlements/' + PREM, Object.assign({}, ACTIVE_ENT, { trialUntilMs: NOW + 86400000 }));
    assert.strictEqual(core.TRIAL_CAN_BUY, false);
    assert.strictEqual((await buy(t, PREM, 'walls', 1)).code, 'trial');
});

// ---------- lesson parts ----------
test('grant reads lqPassed, works for free players, and running twice grants once', async function () {
    const t = setup();
    const a = await t.svc.claimLessons(ctx(FREE));
    assert.deepStrictEqual(a.granted.sort(), ['lesson_tower', 'lesson_walls']);
    const b = await t.svc.claimLessons(ctx(FREE));
    assert.deepStrictEqual(b.granted, []);
    assert.deepStrictEqual(Object.keys(b.lessonParts).sort(), ['lesson_tower', 'lesson_walls']);
    const u = t.get('users/' + FREE);
    assert.deepStrictEqual(u.citadel.lessonParts, { lesson_walls: true, lesson_tower: true });
    assert.strictEqual(u.orangeTickets, 500);
});

test('grant in parallel twice still grants once', async function () {
    const t = setup();
    const out = await Promise.all([t.svc.claimLessons(ctx(FREE)), t.svc.claimLessons(ctx(FREE))]);
    const total = out.reduce(function (n, r) { return n + r.granted.length; }, 0);
    assert.strictEqual(total, 2);
});

test('grant ignores client lqProgress', async function () {
    const t = setup();
    t.db.store.set('users/' + FREE, { lqProgress: { mining: { passed: true } } });
    assert.deepStrictEqual((await t.svc.claimLessons(ctx(FREE))).granted, []);
});

test('status reports pending grant, week, flags and Premium', async function () {
    const t = setup();
    const s = await t.svc.status(ctx(FREE));
    assert.strictEqual(s.lessonGrantPending, true);
    assert.strictEqual(s.premiumActive, false);
    assert.strictEqual(s.weekCap, 120);
    assert.strictEqual(s.weekSpent, 0);
    assert.strictEqual(s.weekResetsAt, core.weekInfo(NOW).endMs);
    assert.deepStrictEqual(s.flags, { referralWeekPremiumBuy: false });
    await t.svc.claimLessons(ctx(FREE));
    assert.strictEqual((await t.svc.status(ctx(FREE))).lessonGrantPending, false);
    const p = await t.svc.status(ctx(PREM));
    assert.strictEqual(p.premiumActive, true);
});

test('build: Premium only, owned lesson part only, once, no OrangeTix', async function () {
    const t = setup();
    assert.strictEqual((await t.svc.build(ctx(PREM), { lessonPartId: 'lesson_keep', requestId: req() })).code, 'not_owned');
    await t.svc.claimLessons(ctx(PREM));
    const r = await t.svc.build(ctx(PREM), { lessonPartId: 'lesson_keep', requestId: 'reqBUILD0001' });
    assert.strictEqual(r.success, true);
    const again = await t.svc.build(ctx(PREM), { lessonPartId: 'lesson_keep', requestId: 'reqBUILD0001' });
    assert.strictEqual(again.repeat, true);
    assert.strictEqual((await t.svc.build(ctx(PREM), { lessonPartId: 'lesson_keep', requestId: req() })).code, 'already_built');
    assert.strictEqual(t.get('users/' + PREM).orangeTickets, 500);
    await t.svc.claimLessons(ctx(FREE));
    assert.strictEqual((await t.svc.build(ctx(FREE), { lessonPartId: 'lesson_walls', requestId: req() })).code, 'not_premium');
});

// ---------- week math ----------
test('week key and end in America/New_York, across DST', function () {
    assert.strictEqual(core.weekInfo(Date.UTC(2026, 10, 23, 4, 59)).key, '2026-11-16');
    assert.strictEqual(core.weekInfo(Date.UTC(2026, 10, 23, 5, 0)).key, '2026-11-23');
    assert.strictEqual(core.weekInfo(Date.UTC(2027, 2, 10, 12)).endMs, Date.UTC(2027, 2, 15, 4));
});

// ---------- wiring, rules, docs ----------
test('index exports the four callables; wiring uses guestGate, kill switch, second factor', function () {
    const idx = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    ['getCitadelShopStatus', 'buyCitadelStage', 'buildCitadelPart', 'claimLessonParts'].forEach(function (n) {
        assert.ok(idx.includes('exports.' + n + ' = citadelShopFns.' + n + ';'), n);
    });
    const fns = fs.readFileSync(path.join(root, 'functions/src/citadelShopFns.js'), 'utf8');
    assert.ok(fns.includes('guestGate.isGuestCaller(admin, context)'));
    assert.ok(fns.includes("require('./killSwitch').isOffline(db)"));
    assert.ok(fns.includes('requireSecondFactor'));
    assert.ok(!/serviceAccount|secrets:/.test(fns), 'no secrets bound');
});

test('rules: citadel_* collections and users.citadel are server-write-only', function () {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    ['citadel_weekly', 'citadel_purchases'].forEach(function (c) {
        assert.ok(new RegExp('match /' + c + '/\\{docId\\} \\{\\s*allow read, write: if false;\\s*\\}').test(rules), c);
    });
    const serverOnly = rules.slice(rules.indexOf('function userProfileServerOnlyKeys()'));
    assert.ok(/'citadel'\s*\n\s*\];/.test(serverOnly.slice(0, serverOnly.indexOf('];') + 2)));
    const src = fs.readFileSync(path.join(root, 'functions/src/citadelShop.js'), 'utf8');
    const cols = src.match(/collection\('citadel_[a-z_]+'\)/g) || [];
    cols.forEach(function (c) { assert.ok(rules.includes('match /' + c.slice(12, -2) + '/'), c); });
});

test('NOTES.md lists the functions as never deployed and the retention rules', function () {
    const notes = fs.readFileSync(path.join(root, 'NOTES.md'), 'utf8');
    assert.ok(/NEVER DEPLOYED/.test(notes));
    assert.ok(/expireAt/.test(notes) && /13 months/.test(notes) && /masked uid/i.test(notes));
    assert.ok(/no TTL policy/i.test(notes));
});

test('no em-dashes in server code', function () {
    ['functions/src/citadelShop.js', 'functions/src/citadelShopFns.js'].forEach(function (f) {
        const s = fs.readFileSync(path.join(root, f), 'utf8');
        assert.ok(!s.includes('\u2014') && !/\\u2014/.test(s), f);
    });
});

(async function () {
    for (const t of queue) {
        try { await t.fn(); console.log('✅ ' + t.name); passed++; }
        catch (e) { console.log('❌ ' + t.name + ': ' + (e && e.message ? e.message : e)); failed++; }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
})();
