// Satoshi's Favor difficulty: 25,000 target, difficulty-based history %, live
// target from payout_config/favorDifficulty, 14-day retarget within budget.
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
        collection(c) { return { doc(id) { const p = c + '/' + id; return { _p: p, get: async () => snap(p), set: async (v, o) => setDoc(p, v, o) }; } }; },
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

test('budget = min(10,500, 25,000 - 1,500 - other payouts)', () => {
    assert.strictEqual(fd.favorBudgetPerMonth(0), 10500);
    assert.strictEqual(fd.favorBudgetPerMonth(13000), 10500);
    assert.strictEqual(fd.favorBudgetPerMonth(20000), 3500);
    assert.strictEqual(fd.favorBudgetPerMonth(40000), 0);
});

test('retarget moves at most 4x either way and lands on budget inside the clamp', () => {
    // budget 10,500 -> 0.5 epoch/month -> 2.5 blocks/30 days
    const onBudget = fd.planRetarget({ currentTarget: 25000, windowDays: 14, blocksInWindow: 2, otherPaidInWindow: 0 });
    const wantFactor = (2.5 / 30) / (2 / 14);
    assert.strictEqual(onBudget.target, Math.round(25000 * wantFactor));
    const harder = fd.planRetarget({ currentTarget: 25000, windowDays: 14, blocksInWindow: 19, otherPaidInWindow: 0 });
    assert.strictEqual(harder.target, 6250);
    assert.strictEqual(harder.label, '+300%');
    const noBudget = fd.planRetarget({ currentTarget: 25000, windowDays: 14, blocksInWindow: 1, otherPaidInWindow: 50000 });
    assert.strictEqual(noBudget.target, 6250);
    assert.strictEqual(noBudget.favorBudgetPerMonth, 0);
    const easier = fd.planRetarget({ currentTarget: 25000, windowDays: 14, blocksInWindow: 0, otherPaidInWindow: 0 });
    assert.strictEqual(easier.target, 100000);
    assert.strictEqual(easier.label, '-75%');
    const floor = fd.planRetarget({ currentTarget: 120, windowDays: 14, blocksInWindow: 50, otherPaidInWindow: 0 });
    assert.strictEqual(floor.target, fd.MIN_TARGET);
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

test('scheduled retarget waits for nextRetargetMs, then writes config, history and the public mirror once', async () => {
    const apply = Date.parse('2026-11-07T01:00:00Z');
    const seed = { target: 25000, previous: 20000, label: '-20%', lastRetargetMs: apply, nextRetargetMs: apply + 14 * DAY,
        history: [{ date: '2026-11-07', since: apply, target: 25000, previous: 20000, label: '-20%' }] };
    const db = fakeDb({ 'payout_config/favorDifficulty': seed });
    const deps = { countBlocks: async () => 19, sumOtherPaid: async () => 0 };
    const early = await fd.runRetarget(db, null, apply + 13 * DAY, deps);
    assert.strictEqual(early.skipped, 'not_due');
    assert.strictEqual(db.docs['payout_config/favorDifficulty'].target, 25000);
    const now = apply + 14 * DAY + 600000;
    const r = await fd.runRetarget(db, null, now, deps);
    assert.strictEqual(r.retargeted, true);
    const cfg = db.docs['payout_config/favorDifficulty'];
    assert.strictEqual(cfg.target, 6250);
    assert.strictEqual(cfg.nextRetargetMs, now + 14 * DAY);
    assert.strictEqual(cfg.history.length, 2);
    assert.strictEqual(cfg.history[1].label, '+300%');
    const pub = db.docs['satoshiFavor/difficultyStats'].config;
    assert.strictEqual(pub.target, 6250);
    assert.strictEqual(pub.odds, 16000);
    assert.strictEqual(pub.history.length, 2);
    assert.ok(!JSON.stringify(pub).includes('favorBudgetPerMonth'));
    const again = await fd.runRetarget(db, null, now + 1000, deps);
    assert.strictEqual(again.skipped, 'not_due');
    const missing = await fd.runRetarget(fakeDb({}), null, now, deps);
    assert.strictEqual(missing.skipped, 'missing');
});

test('retarget pays nothing and binds no secrets', () => {
    const src = read('functions/src/favorDifficulty.js');
    assert.ok(!/nwc|payInvoice|sendPayment|lnurl|faucet_ledger|defineSecret/i.test(src.replace(/faucet_stats/g, '')));
    const index = read('functions/index.js');
    const at = index.indexOf('exports.favorDifficultyRetarget = onSchedule(');
    assert.ok(at > 0);
    const line = index.slice(at, index.indexOf('\n', at));
    assert.ok(line.includes("schedule: '10 0 * * *'") && line.includes("timeZone: 'America/New_York'"));
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
    assert.ok(read('quests.js').includes('Next difficulty adjustment: '));
});

Promise.all(queue).then(() => {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
});
