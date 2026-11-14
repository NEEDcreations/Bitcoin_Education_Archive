// Satoshi's Favor difficulty: 25,000 target, difficulty-based history %, live
// target from payout_config/favorDifficulty, Bitcoin-style retarget once per
// full (5/5) epoch aiming for one epoch per 14 days, 100,000 sats/month budget.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const fd = require('../functions/src/favorDifficulty');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) {
    queue.push(Promise.resolve().then(fn).then(
        function () { console.log('✅ ' + name); passed++; },
        function (e) { console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }));
}
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const DAY = 86400000;

function fakeDb(docs) {
    const store = Object.assign({}, docs || {});
    function snap(p) { const d = store[p]; return { exists: d !== undefined, data: () => (d === undefined ? undefined : JSON.parse(JSON.stringify(d))) }; }
    function setDoc(p, v, opt) { store[p] = (opt && opt.merge && store[p]) ? Object.assign({}, store[p], v) : Object.assign({}, v); }
    const db = {
        docs: store,
        collection(c) { return {
            doc(id) { const p = c + '/' + id; return { _p: p, get: async () => snap(p), set: async (v, o) => setDoc(p, v, o) }; },
            where(field, op, val) { return { get: async () => {
                const rows = Object.keys(store).filter(k => k.startsWith(c + '/')).map(k => store[k])
                    .filter(d => (op === '>' ? d[field] > val : op === '==' ? d[field] === val : false));
                return { forEach(fn) { rows.forEach(d => fn({ data: () => JSON.parse(JSON.stringify(d)) })); } };
            } }; },
        }; },
        async runTransaction(fn) { return fn({ get: async (ref) => snap(ref._p), set: (ref, v, o) => setDoc(ref._p, v, o) }); },
    };
    return db;
}

test('difficulty % = (newDifficulty - oldDifficulty) / oldDifficulty, so 20,000 -> 25,000 is -20%', () => {
    assert.strictEqual(fd.changeLabel(20000, 25000), '-20%');
    assert.strictEqual(Math.round(fd.difficultyChangePct(20000, 25000) * 100) / 100, -20);
    assert.strictEqual(fd.changeLabel(25000, 6250), '+300%');
    assert.strictEqual(fd.changeLabel(8000, 7000), '+14.3%');
    assert.strictEqual(fd.changeLabel(null, 1000), 'Genesis');
});

test('every client history label matches the difficulty formula, newest row is 25,000 / -20%', () => {
    const src = read('satoshi-favor.js');
    const rows = [...src.matchAll(/\{ date: '(\d{4}-\d{2}-\d{2})', target: (\d+),\s*label: '([^']+)'/g)].map(m => ({ date: m[1], target: +m[2], label: m[3] }));
    assert.ok(rows.length >= 9);
    for (let i = 1; i < rows.length; i++) {
        const want = Math.round(fd.difficultyChangePct(rows[i - 1].target, rows[i].target) * 10) / 10;
        const got = parseFloat(rows[i].label);
        assert.ok(Math.abs(want - got) < 0.06, rows[i].date + ' label ' + rows[i].label + ' want ' + want);
    }
    const last = rows[rows.length - 1];
    assert.deepStrictEqual(last, { date: '2026-11-07', target: 25000, label: '-20%' });
    assert.ok(/const DIFFICULTY_TARGET = 25000;/.test(src));
    assert.ok(!src.includes('-12.5%'));
});

test('server fallback history ends at 25,000 and matches the client', () => {
    const s = read('functions/src/satoshiFavor.js');
    assert.ok(s.includes("{ target: 25000, since: '2026-11-07' }"));
    assert.ok(!s.includes('-12.5%'));
    assert.ok(/const winner = val < LIVE_TARGET;/.test(s), 'winner uses live target');
    assert.ok(s.includes("['target_' + LIVE_TARGET]"));
});

test('quests.js fallback % is computed from difficulty, not target', () => {
    const q = read('quests.js');
    assert.ok(q.includes('(prevTarget / row.target - 1) * 100'));
    assert.ok(!q.includes('(row.target - prevTarget) / prevTarget * 100'));
});

test('budget: 100,000 sats/month = 45,000 Favor + 55,000 everything else; other payouts do not reduce Favor', () => {
    assert.strictEqual(fd.MONTHLY_TOTAL, 100000);
    assert.strictEqual(fd.FAVOR_BUDGET, 45000);
    assert.strictEqual(fd.OTHER_BUDGET, 55000);
    assert.strictEqual(fd.FAVOR_BUDGET + fd.OTHER_BUDGET, fd.MONTHLY_TOTAL);
    assert.strictEqual(fd.favorBudgetPerMonth(0), 45000);
    assert.strictEqual(fd.favorBudgetPerMonth(999999), 45000, 'faucet spend no longer zeroes the Favor budget');
    // one 21,000-sat epoch per 14 days IS the 45,000 / 30-day Favor budget
    assert.strictEqual(fd.EPOCH_SATS * fd.DAYS_PER_MONTH / fd.TARGET_EPOCH_DAYS, fd.FAVOR_BUDGET);
    assert.strictEqual(fd.TARGET_EPOCH_DAYS, 14);
    assert.strictEqual(fd.BLOCKS_PER_EPOCH, 5);
    assert.strictEqual(fd.BUFFER, undefined);
    assert.strictEqual(fd.FAVOR_CAP, undefined);
    const src = read('functions/src/favorDifficulty.js');
    assert.ok(!/10,?500|\b1,?500\b|25,000 total/.test(src.replace(/\/\/.*$/gm, '')), 'no old 25,000 / 10,500 / 1,500 budget constants');
    assert.ok(!/favor_?cap|buffer/i.test(src.replace(/\/\/.*$/gm, '')));
    assert.ok(!/faucet_stats|cipher_sats_site_daily|otherPaid/.test(src), 'other payouts are not read');
    const index = read('functions/index.js');
    assert.ok(!index.includes('min(10,500'));
    assert.ok(index.includes('100,000 sats/month = 45,000 Favor + 55,000'));
});

test('epoch faster than 14 days -> harder, clamped to 4x (target / 4)', () => {
    const fast = fd.planRetarget({ currentTarget: 25000, epochDurationMs: 1.73 * DAY });
    assert.strictEqual(fast.target, 6250);
    assert.strictEqual(fast.factor, 0.25);
    assert.strictEqual(fast.clamped, true);
    assert.strictEqual(fast.label, '+300%');
    const halfway = fd.planRetarget({ currentTarget: 25000, epochDurationMs: 7 * DAY });
    assert.strictEqual(halfway.target, 12500, '7 days = 2x too fast = half the target');
    assert.strictEqual(halfway.label, '+100%');
    assert.ok(halfway.target < 25000, 'smaller target is harder');
});

test('epoch slower than 14 days -> easier, clamped to 4x (target * 4)', () => {
    const slow = fd.planRetarget({ currentTarget: 25000, epochDurationMs: 21 * DAY });
    assert.strictEqual(slow.target, 37500);
    assert.ok(slow.target > 25000, 'bigger target is easier');
    const verySlow = fd.planRetarget({ currentTarget: 25000, epochDurationMs: 200 * DAY });
    assert.strictEqual(verySlow.target, 100000);
    assert.strictEqual(verySlow.label, '-75%');
    assert.strictEqual(verySlow.clamped, true);
});

test('epoch of exactly 14 days -> target unchanged', () => {
    const same = fd.planRetarget({ currentTarget: 25000, epochDurationMs: 14 * DAY });
    assert.strictEqual(same.target, 25000);
    assert.strictEqual(same.factor, 1);
    assert.strictEqual(same.label, '0%');
    const two = fd.planRetarget({ currentTarget: 25000, epochDurationMs: 28 * DAY, epochs: 2 });
    assert.strictEqual(two.target, 25000, 'two epochs in 28 days is on target');
});

test('floor/ceiling sanity bounds still apply; bad durations never guess a direction', () => {
    assert.strictEqual(fd.planRetarget({ currentTarget: 120, epochDurationMs: 1 * DAY }).target, fd.MIN_TARGET);
    assert.strictEqual(fd.planRetarget({ currentTarget: fd.MAX_TARGET, epochDurationMs: 56 * DAY }).target, fd.MAX_TARGET);
    assert.strictEqual(fd.planRetarget({ currentTarget: 25000, epochDurationMs: 0 }), null);
    assert.strictEqual(fd.planRetarget({ currentTarget: 25000, epochDurationMs: -5 }), null);
    assert.strictEqual(fd.planRetarget({ currentTarget: 25000 }), null);
});

test('live target reads payout_config/favorDifficulty with a hardcoded fallback', async () => {
    fd._resetCache();
    assert.strictEqual(await fd.getTarget(fakeDb({}), 25000, 1), 25000);
    fd._resetCache();
    assert.strictEqual(await fd.getTarget(fakeDb({ 'payout_config/favorDifficulty': { target: 6250 } }), 25000, 2), 6250);
    fd._resetCache();
    assert.strictEqual(await fd.getTarget(fakeDb({ 'payout_config/favorDifficulty': { target: 'x' } }), 25000, 3), 25000);
    fd._resetCache();
    const bad = { collection() { return { doc() { return { get: async () => { throw new Error('down'); } }; } }; } };
    assert.strictEqual(await fd.getTarget(bad, 25000, 4), 25000);
    fd._resetCache();
});

test('expired reset stamps the live target on lastWindow', async () => {
    const { resetExpiredFavorWith } = require('../functions/src/satoshiFavor');
    fd._resetCache();
    const past = Date.now() - 3600000;
    const db = fakeDb({
        'payout_config/favorDifficulty': { target: 6250 },
        'satoshiFavor/current': { points: 21, favorActive: true, bonusMinutes: 0, eraHashes: 5, currentCycleId: 'c1', totalHashes: 3 },
    });
    // favorEndBase needs toMillis; add after JSON clone-safe seeding
    db.docs['satoshiFavor/current'].favorEndBase = { toMillis: () => past };
    const origRun = db.runTransaction;
    db.runTransaction = async function (fn) {
        return fn({
            get: async (ref) => ({ exists: true, data: () => Object.assign({}, db.docs[ref._p]) }),
            set: (ref, v, o) => { db.docs[ref._p] = (o && o.merge && db.docs[ref._p]) ? Object.assign({}, db.docs[ref._p], v) : Object.assign({}, v); },
            update: (ref, v) => { db.docs[ref._p] = Object.assign({}, db.docs[ref._p], v); },
        });
    };
    const r = await resetExpiredFavorWith(db, Date.now());
    assert.strictEqual(r.reset, true);
    assert.strictEqual(db.docs['satoshiFavor/lastWindow'].difficultyTarget, 6250);
    db.runTransaction = origRun;
    fd._resetCache();
});

const E6_CLOSED = Date.parse('2026-11-10T15:15:09Z');
function migratedSeed(extra) {
    const seedAt = Date.parse('2026-11-07T01:03:00Z');
    return Object.assign({ target: 25000, previous: 20000, label: '-20%', lastRetargetMs: seedAt, nextRetargetMs: seedAt + 14 * DAY,
        history: [{ date: '2026-11-07', since: seedAt, target: 25000, previous: 20000, label: '-20%' }],
        lastRetargetEpoch: 6, lastRetargetEpochClosedMs: E6_CLOSED, retargetRule: 'epoch' }, extra || {});
}

test('no time-based retarget: unmigrated config never moves, even long after the old nextRetargetMs', async () => {
    const seedAt = Date.parse('2026-11-07T01:03:00Z');
    const old = { target: 25000, lastRetargetMs: seedAt, nextRetargetMs: seedAt + 14 * DAY, history: [] };
    const db = fakeDb({ 'payout_config/favorDifficulty': old, 'sfPoolHistory/a': { epochNumber: 7, completedAt: E6_CLOSED + DAY } });
    for (const at of [Date.parse('2026-11-21T05:10:00Z'), seedAt + 60 * DAY]) {
        const r = await fd.runRetarget(db, null, at);
        assert.strictEqual(r.skipped, 'not_migrated');
    }
    assert.strictEqual(db.docs['payout_config/favorDifficulty'].target, 25000);
    assert.strictEqual(db.docs['satoshiFavor/difficultyStats'], undefined);
    // migrated, but no new epoch closed: 60 days later still nothing
    const db2 = fakeDb({ 'payout_config/favorDifficulty': migratedSeed(), 'sfPoolHistory/e6': { epochNumber: 6, completedAt: E6_CLOSED } });
    const r2 = await fd.runRetarget(db2, null, E6_CLOSED + 60 * DAY);
    assert.deepStrictEqual(r2, { skipped: 'no_new_epoch', waitingForEpoch: 7 });
    assert.strictEqual(db2.docs['payout_config/favorDifficulty'].target, 25000);
    const src = read('functions/src/favorDifficulty.js');
    assert.ok(!/now\s*<\s*next|RETARGET_DAYS\s*\*/.test(src), 'no clock check left');
});

test('epoch close retargets once (idempotent per epoch), writes history + public mirror, keeps epoch records', async () => {
    const e7Closed = E6_CLOSED + 3.5 * DAY;
    const e7 = { epochNumber: 7, completedAt: e7Closed, totalSats: 21000, blocks: [1, 2, 3, 4, 5] };
    const db = fakeDb({ 'payout_config/favorDifficulty': migratedSeed(), 'sfPoolHistory/e6': { epochNumber: 6, completedAt: E6_CLOSED }, 'sfPoolHistory/e7': e7 });
    const now = e7Closed + 3 * 3600000;
    const r = await fd.runRetarget(db, null, now);
    assert.strictEqual(r.retargeted, true);
    assert.strictEqual(r.epoch, 7);
    assert.strictEqual(r.target, 6250, '3.5 days vs 14 = 4x too fast -> 4x harder');
    const cfg = db.docs['payout_config/favorDifficulty'];
    assert.strictEqual(cfg.target, 6250);
    assert.strictEqual(cfg.lastRetargetEpoch, 7);
    assert.strictEqual(cfg.lastRetargetEpochClosedMs, e7Closed);
    assert.strictEqual(cfg.nextRetargetMs, null);
    assert.strictEqual(cfg.history.length, 2);
    const h = cfg.history[1];
    assert.strictEqual(h.previous, 25000);
    assert.strictEqual(h.target, 6250);
    assert.strictEqual(h.factor, 0.25);
    assert.strictEqual(h.epochDurationDays, 3.5);
    assert.strictEqual(h.epoch, 7);
    assert.ok(/Epoch #7 filled 5\/5/.test(h.reason));
    const pub = db.docs['satoshiFavor/difficultyStats'].config;
    assert.strictEqual(pub.target, 6250);
    assert.strictEqual(pub.odds, 16000);
    assert.strictEqual(pub.nextRetargetEpoch, 8);
    assert.strictEqual(pub.nextRetargetMs, null);
    assert.strictEqual(pub.retargetRule, 'epoch');
    assert.ok(!JSON.stringify(pub).includes('reason'));
    // same epoch again (later daily runs): no second retarget
    for (const at of [now + 1000, now + DAY, now + 30 * DAY]) {
        const again = await fd.runRetarget(db, null, at);
        assert.deepStrictEqual(again, { skipped: 'no_new_epoch', waitingForEpoch: 8 });
    }
    assert.strictEqual(db.docs['payout_config/favorDifficulty'].target, 6250);
    assert.strictEqual(db.docs['payout_config/favorDifficulty'].history.length, 2);
    assert.deepStrictEqual(db.docs['sfPoolHistory/e7'], e7, 'epoch record untouched');
    // a run that lost the race to another run for the same epoch writes nothing
    const db3 = fakeDb({ 'payout_config/favorDifficulty': migratedSeed(), 'sfPoolHistory/e7': e7 });
    const racedTx = db3.runTransaction;
    db3.runTransaction = async (fn) => { db3.docs['payout_config/favorDifficulty'].lastRetargetEpoch = 7; return racedTx(fn); };
    assert.deepStrictEqual(await fd.runRetarget(db3, null, now), { skipped: 'raced' });
    assert.strictEqual(db3.docs['payout_config/favorDifficulty'].target, 25000);
});

test('slow epoch eases, missing anchor falls back to the previous epoch record, two closed epochs step once each', async () => {
    const e7Closed = E6_CLOSED + 21 * DAY;
    const seed = migratedSeed({ lastRetargetEpochClosedMs: undefined });
    delete seed.lastRetargetEpochClosedMs;
    const db = fakeDb({ 'payout_config/favorDifficulty': seed, 'sfPoolHistory/e6': { epochNumber: 6, completedAt: E6_CLOSED },
        'sfPoolHistory/e7': { epochNumber: 7, completedAt: e7Closed } });
    const r = await fd.runRetarget(db, null, e7Closed + 1000);
    assert.strictEqual(r.target, 37500);
    const noAnchor = fakeDb({ 'payout_config/favorDifficulty': seed, 'sfPoolHistory/e7': { epochNumber: 7, completedAt: e7Closed } });
    assert.deepStrictEqual(await fd.runRetarget(noAnchor, null, e7Closed + 1000), { skipped: 'no_epoch_start', epoch: 7 });
    assert.strictEqual(noAnchor.docs['payout_config/favorDifficulty'].target, 25000);
    const two = fakeDb({ 'payout_config/favorDifficulty': migratedSeed(),
        'sfPoolHistory/e7': { epochNumber: 7, completedAt: E6_CLOSED + 2 * DAY },
        'sfPoolHistory/e8': { epochNumber: 8, completedAt: E6_CLOSED + 3 * DAY } });
    const r2 = await fd.runRetarget(two, null, E6_CLOSED + 3 * DAY + 1000);
    assert.strictEqual(r2.target, 1563, 'two fast epochs: 4x then 4x (25000 -> 6250 -> 1563), not one combined step');
    assert.strictEqual(r2.epochs, 2);
    assert.strictEqual(r2.previousTarget, 25000);
    assert.strictEqual(two.docs['payout_config/favorDifficulty'].lastRetargetEpoch, 8);
    const hist = two.docs['payout_config/favorDifficulty'].history;
    assert.strictEqual(hist.length, 3, 'one history row per epoch step, plus the seed row');
    assert.strictEqual(hist[1].epoch, 7);
    assert.strictEqual(hist[1].previous, 25000);
    assert.strictEqual(hist[1].target, 6250);
    assert.strictEqual(hist[2].epoch, 8);
    assert.strictEqual(hist[2].previous, 6250);
    assert.strictEqual(hist[2].target, 1563);
    const missing = await fd.runRetarget(fakeDb({}), null, Date.now());
    assert.strictEqual(missing.skipped, 'missing');
});

test('three fast epochs each clamp to 4x, compounding to 4^3 harder', async () => {
    const db = fakeDb({
        'payout_config/favorDifficulty': migratedSeed(),
        'sfPoolHistory/e7': { epochNumber: 7, completedAt: E6_CLOSED + 2 * DAY },
        'sfPoolHistory/e8': { epochNumber: 8, completedAt: E6_CLOSED + 4 * DAY },
        'sfPoolHistory/e9': { epochNumber: 9, completedAt: E6_CLOSED + 6 * DAY },
    });
    const r = await fd.runRetarget(db, null, E6_CLOSED + 6 * DAY + 1000);
    assert.strictEqual(r.retargeted, true);
    assert.strictEqual(r.epochs, 3);
    assert.strictEqual(r.epoch, 9);
    assert.strictEqual(r.previousTarget, 25000);
    // 25000 * 0.25 = 6250; 6250 * 0.25 = 1562.5 -> 1563; 1563 * 0.25 = 390.75 -> 391
    assert.strictEqual(r.target, 391);
    assert.ok(r.target >= fd.MIN_TARGET);
    const cfg = db.docs['payout_config/favorDifficulty'];
    assert.strictEqual(cfg.target, 391);
    assert.strictEqual(cfg.lastRetargetEpoch, 9);
    assert.strictEqual(cfg.history.length, 4);
    assert.deepStrictEqual(cfg.history.slice(1).map((h) => [h.epoch, h.previous, h.target]), [
        [7, 25000, 6250],
        [8, 6250, 1563],
        [9, 1563, 391],
    ]);
    const pub = db.docs['satoshiFavor/difficultyStats'].config;
    assert.strictEqual(pub.target, 391);
    assert.strictEqual(pub.nextRetargetEpoch, 10);
    const again = await fd.runRetarget(db, null, E6_CLOSED + 7 * DAY);
    assert.deepStrictEqual(again, { skipped: 'no_new_epoch', waitingForEpoch: 10 });
    assert.strictEqual(db.docs['payout_config/favorDifficulty'].history.length, 4);
});

test('migration script is dry-run by default and refuses to write without --apply', () => {
    const m = read('scripts/migrate-favor-epoch-retarget.js');
    assert.ok(m.includes("process.argv.includes('--apply')"));
    assert.ok(/if \(!APPLY\)[^\n]*return/.test(m));
    assert.ok(m.includes('lastRetargetEpoch'));
    assert.ok(m.includes("refusing: already migrated"));
    assert.ok(!/\.delete\(\)|recursiveDelete|sfPoolHistory'\)\.doc\([^)]*\)\.(set|update)/.test(m), 'never deletes or rewrites epoch records');
});

test('--apply without --project refuses and does not default to the live project', () => {
    const { spawnSync } = require('child_process');
    const r = spawnSync(process.execPath, ['scripts/migrate-favor-epoch-retarget.js', '--apply'], {
        cwd: root, encoding: 'utf8', env: Object.assign({}, process.env, { GOOGLE_APPLICATION_CREDENTIALS: '' }),
    });
    assert.ok(r.status !== 0);
    const out = (r.stderr || '') + (r.stdout || '');
    assert.ok(/--apply requires an explicit --project=/.test(out), out);
    assert.ok(!/\(APPLY\)/.test(out), 'must refuse before initializing the live default');
});

test('migration allows lastRetargetEpoch = 0 when the open epoch is #1 and uses the epoch start as the baseline', () => {
    const { resolveAnchor } = require('../scripts/migrate-favor-epoch-retarget.js');
    const start = Date.parse('2026-11-01T15:00:00Z');
    const a = resolveAnchor({ openEpoch: 1, openStartMs: start, pinLast: null, historyClosedMs: 0 });
    assert.strictEqual(a.lastEpoch, 0);
    assert.strictEqual(a.closedMs, start);
    assert.strictEqual(a.openEpoch, 1);
    const pinned = resolveAnchor({ openEpoch: 1, openStartMs: start, pinLast: '0', historyClosedMs: 0 });
    assert.strictEqual(pinned.lastEpoch, 0);
    assert.strictEqual(pinned.closedMs, start);
    let threw = false;
    try { resolveAnchor({ openEpoch: 1, openStartMs: 0, pinLast: null, historyClosedMs: 0 }); }
    catch (e) { threw = /no close time for epoch 0/.test(e.message); }
    assert.ok(threw, 'missing start and history must refuse');
    let threwHigh = false;
    try { resolveAnchor({ openEpoch: 1, openStartMs: start, pinLast: '1', historyClosedMs: 0 }); }
    catch (e) { threwHigh = /must be below the open epoch 1/.test(e.message); }
    assert.ok(threwHigh);
    const later = resolveAnchor({ openEpoch: 7, openStartMs: start + 86400000, pinLast: null, historyClosedMs: start });
    assert.strictEqual(later.lastEpoch, 6);
    assert.strictEqual(later.closedMs, start);
});

test('retarget pays nothing and binds no secrets', () => {
    const src = read('functions/src/favorDifficulty.js');
    assert.ok(!/nwc|payInvoice|sendPayment|lnurl|faucet_ledger|defineSecret/i.test(src.replace(/faucet_stats/g, '')));
    const index = read('functions/index.js');
    const at = index.indexOf('exports.favorDifficultyRetarget = onSchedule(');
    assert.ok(at > 0);
    const line = index.slice(at, index.indexOf('\n', at));
    assert.ok(line.includes("schedule: '*/30 * * * *'") && line.includes("timeZone: 'America/New_York'"));
    assert.ok(!line.includes('secrets'));
});

test('rules: payout_config stays server-only, difficultyStats stays client-unwritable', () => {
    const rules = read('firestore.rules');
    assert.ok(!/match \/payout_config/.test(rules), 'no rule opens payout_config (default deny)');
    const at = rules.indexOf('match /satoshiFavor/difficultyStats');
    const block = rules.slice(at, rules.indexOf('}', at));
    assert.ok(/allow write: if false;/.test(block));
    assert.ok(/match \/\{document=\*\*\} \{\s*allow read, write: if false;/.test(rules));
});

test('client merges server history and reads the live target, odds and next date', () => {
    const src = read('satoshi-favor.js');
    const start = src.indexOf('function _sfMergeDifficultyHistory');
    const end = src.indexOf('window._sfMergeDifficultyHistory');
    const merge = new Function(src.slice(start, end) + '; return _sfMergeDifficultyHistory;')();
    const base = [{ date: '2026-10-01', target: 20000, label: '-50%', hashes: null, luck: null }, { date: '2026-11-07', target: 25000, label: '-20%', hashes: null, luck: null }];
    const out = merge(base, [{ date: '2026-11-07', target: 25000, label: '-20%' }, { date: '2026-11-21', target: 6250, label: '+300%' }, { date: 'bad', target: 1 }]);
    assert.deepStrictEqual(out.map(r => r.target), [20000, 25000, 6250]);
    assert.strictEqual(out[2].label, '+300%');
    assert.strictEqual(out[1].liveStats, true);
    assert.ok(src.includes("db.collection('satoshiFavor').doc('difficultyStats').get()"));
    assert.ok(src.includes("That\\'s a 1 in ' + _sfOddsText()"));
    assert.ok(!src.includes('1:5,000</div>'));
    const q = read('quests.js');
    assert.ok(q.includes('Next difficulty adjustment: '));
    assert.ok(q.includes("'when Epoch #' + _nextEpoch + ' fills 5/5'"));
    assert.ok(q.includes("'when the current epoch fills 5/5'"));
    assert.ok(!q.includes('SF_DIFFICULTY_NEXT_RETARGET_MS'));
    assert.ok(!q.includes('(about every 14 days)'));
    assert.ok(src.includes('window.SF_DIFFICULTY_NEXT_RETARGET_EPOCH'));
    assert.ok(read('resets.html').includes('When an epoch fills 5/5 (checked every 30 minutes)'));
    assert.ok(!read('resets.html').includes('RETARGET_DAYS'));
    assert.ok(!read('resets.html').includes('12:10 AM ET daily'));
    assert.ok(read('terms.html').includes('adjusted each time an epoch fills 5 of 5 blocks'));
});

Promise.all(queue).then(() => {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
});
