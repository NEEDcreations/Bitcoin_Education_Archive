'use strict';
// Pot watch-minute audit. No Firestore. The audit script is read-only.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const M = require('../scripts/tctv-view-minutes');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e && e.message)); failed++; }
}

const NOW = Date.parse('2026-11-09T18:00:00Z');
const TODAY = M.dayKeyFromMs(NOW);

test('offset day and window', function () {
    assert.strictEqual(TODAY, '2026-11-09');
    assert.strictEqual(M.windowStartDay(TODAY, 7), '2026-11-03');
    assert.strictEqual(M.daysArg(['node', 'x', '--days', '14']), 14);
    assert.strictEqual(M.daysArg(['node', 'x']), 7);
    assert.strictEqual(M.creditMode(['node', 'x']), 'dry-run');
    assert.strictEqual(M.creditMode(['node', 'x', '--apply']), 'apply');
    assert.strictEqual(M.auditRejectsApply(['node', 'x', '--apply']), true);
    assert.strictEqual(M.potIsOpen('filling'), true);
    assert.strictEqual(M.potIsOpen('full'), true);
    assert.strictEqual(M.potIsOpen('distributing'), false);
});

test('a prompt that is still open measures uncredited minutes', function () {
    const due = NOW - 12 * 60 * 1000;
    const stuck = M.promptStuckState({ promptToken: 'abc', promptDueMs: due, lastCheckMs: NOW }, NOW);
    assert.strictEqual(stuck.stuck, true);
    assert.strictEqual(stuck.stuckCreditSeconds, 12 * 60);
    assert.strictEqual(M.promptStuckState({ promptToken: '', promptDueMs: due, lastCheckMs: NOW }, NOW).stuck, false);
    assert.strictEqual(M.promptStuckState({ promptToken: 'abc', promptDueMs: NOW + 60000, lastCheckMs: NOW }, NOW).stuck, false);
});

test('verified minutes use today plus finished daily goals, not days before the pot', function () {
    const v = M.verifiedWatchSeconds({
        today: TODAY,
        daily: { day: TODAY, seconds: 180, lifeDay: TODAY, lifeDaySeconds: 900 },
        claims: [
            { day: '2026-11-08' },
            { day: '2026-11-08' },
            { day: '2026-11-01' },
            { day: TODAY },
        ],
        potCreatedMs: Date.parse('2026-11-07T12:00:00Z'),
        windowStart: '2026-11-03',
    });
    // today is max(180, 900, 600). Nov 8 is one claim. Nov 1 is before the pot.
    assert.strictEqual(v.todayVerified, 900);
    assert.strictEqual(v.pastClaimSeconds, 600);
    assert.strictEqual(v.verified, 1500);
    assert.strictEqual(v.claimDays, 2);
});

test('missed minutes are the watch log minus pot seconds, with or without a prompt', function () {
    const row = M.assessPotCredit({
        uid: 'u1',
        potSeconds: 120,
        verifiedSeconds: 1500,
        promptStuck: false,
        ageOk: true,
        blocked: false,
        potOpen: true,
        hasDripDoc: true,
    });
    assert.strictEqual(row.reason, 'watch-log-short');
    assert.strictEqual(row.accurate, false);
    assert.strictEqual(row.owedSeconds, 1380);
    assert.strictEqual(row.willCredit, true);
    assert.strictEqual(row.gapSeconds, 1500 - 120);
    const patch = M.creditPatch(row.owedSeconds, NOW);
    assert.strictEqual(patch.secondsDelta, 1380);
    assert.strictEqual(patch.viewMinuteCreditApplied, true);
    const again = M.assessPotCredit({
        uid: 'u1', potSeconds: 1500, verifiedSeconds: 1500, ageOk: true, potOpen: true, hasDripDoc: true, alreadyApplied: true,
    });
    assert.strictEqual(again.reason, 'already-applied');
    assert.strictEqual(again.willCredit, false);
});

test('a watch-log gap is credited even when the prompt is not open', function () {
    const row = M.assessPotCredit({
        uid: 'u2',
        potSeconds: 0,
        verifiedSeconds: 600,
        promptStuck: false,
        ageOk: true,
        potOpen: true,
        hasDripDoc: true,
    });
    assert.strictEqual(row.reason, 'watch-log-short');
    assert.strictEqual(row.willCredit, true);
    assert.strictEqual(row.owedSeconds, 600);
    assert.strictEqual(row.gapMinutes, 10);
});

test('linked accounts are credited once and banned accounts are skipped', function () {
    const shared = { fingerprint: 'device-1', email: 'a@example.com' };
    const rows = M.selectCreditRows([
        M.assessPotCredit({ uid: 'a', potSeconds: 0, verifiedSeconds: 600, ageOk: true, potOpen: true, hasDripDoc: true }),
        M.assessPotCredit({ uid: 'b', potSeconds: 0, verifiedSeconds: 1200, ageOk: true, potOpen: true, hasDripDoc: true }),
        M.assessPotCredit({ uid: 'c', potSeconds: 0, verifiedSeconds: 600, ageOk: true, potOpen: true, hasDripDoc: true, blocked: true }),
    ].map(function (row, i) {
        const users = [shared, shared, { fingerprint: 'other', email: 'c@example.com' }];
        row.user = Object.assign({ uid: row.uid }, users[i]);
        return row;
    }));
    const by = {};
    rows.forEach(function (row) { by[row.uid] = row; });
    assert.strictEqual(by.b.willCredit, true);
    assert.strictEqual(by.a.reason, 'linked-duplicate');
    assert.strictEqual(by.a.willCredit, false);
    assert.strictEqual(by.c.reason, 'ineligible');
    const report = M.creditReport(rows);
    assert.strictEqual(report.totalSeconds, 1200);
    assert.strictEqual(report.top10.length, 1);
    assert.strictEqual(report.top10[0].uid, 'b');
});

test('ineligible, closed, and age-blocked rows are not credited', function () {
    const blocked = M.assessPotCredit({
        uid: 'bot', potSeconds: 0, verifiedSeconds: 600, promptStuck: true, stuckCreditSeconds: 600,
        ageOk: true, blocked: true, potOpen: true, hasDripDoc: true,
    });
    assert.strictEqual(blocked.reason, 'ineligible');
    assert.strictEqual(blocked.willCredit, false);
    const young = M.assessPotCredit({
        uid: 'new', potSeconds: 0, verifiedSeconds: 600, promptStuck: true, stuckCreditSeconds: 600,
        ageOk: false, potOpen: true, hasDripDoc: true,
    });
    assert.strictEqual(young.reason, 'age-ineligible');
    const closed = M.assessPotCredit({
        uid: 'old', potSeconds: 0, verifiedSeconds: 600, promptStuck: true, stuckCreditSeconds: 600,
        ageOk: true, potOpen: false, hasDripDoc: true,
    });
    assert.strictEqual(closed.reason, 'pot-closed');
    assert.strictEqual(closed.accurate, true);
    const none = M.assessPotCredit({
        uid: 'ghost', potSeconds: 0, verifiedSeconds: 600, ageOk: true, potOpen: true, hasDripDoc: false,
    });
    assert.strictEqual(none.reason, 'no-drip-doc');
    assert.strictEqual(none.willCredit, false);
});

test('audit script is read-only and the credit script defaults to dry-run', function () {
    const root = path.join(__dirname, '..');
    const audit = fs.readFileSync(path.join(root, 'scripts', 'tctv-view-minutes-audit.js'), 'utf8');
    const credit = fs.readFileSync(path.join(root, 'scripts', 'tctv-drip-minute-credit.js'), 'utf8');
    assert.ok(audit.includes('auditRejectsApply'));
    assert.ok(audit.includes('process.exit(2)'));
    assert.ok(!audit.includes('.update(') && !audit.includes('.delete(') && !audit.includes('.create(') && !audit.includes('.batch(') && !audit.includes('FieldValue'), 'audit must not write');
    assert.ok(!/\.doc\([^)]*\)\.set\(/.test(audit), 'audit must not write a document');
    assert.ok(credit.includes('creditMode'));
    assert.ok(credit.includes('dry-run: no Firestore writes'));
    assert.ok(credit.includes("mode === 'apply'"));
    assert.ok(credit.includes('viewMinuteCreditApplied'));
    assert.ok(credit.includes('selectCreditRows'));
    assert.ok(credit.includes('totalSeconds') && credit.includes('top10'));
    assert.ok(!credit.includes('cipherSatsBalance'), 'credit adds watch seconds, not a sats balance');
    execFileSync(process.execPath, ['--check', path.join(root, 'scripts', 'tctv-view-minutes.js')], { stdio: 'pipe' });
    execFileSync(process.execPath, ['--check', path.join(root, 'scripts', 'tctv-view-minutes-audit.js')], { stdio: 'pipe' });
    execFileSync(process.execPath, ['--check', path.join(root, 'scripts', 'tctv-drip-minute-credit.js')], { stdio: 'pipe' });
});

test('no Coldcard, Coinkite, Blockclock, or NVK video remains on Timechain TV', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'timechain-tv.js'), 'utf8');
    assert.ok(src.includes('id:"tutorials"'));
    assert.ok(!src.includes('NVK (Coinkite)'));
    assert.ok(!src.includes('32SZtxE0sWQ') && !src.includes('N6ax-ZmTsDc') && !src.includes('Ro6FdAnF_W0'));
    const re = /\{id:"([^"]+)",title:"([^"]*)",duration:(\d+)\}/g;
    const bad = [];
    let m;
    let n = 0;
    const banned = /cold\s*card|coinkite|block\s*clock|opendime|sats\s*card|tapsigner|\bnvk\b|novak|rodolfo/i;
    while ((m = re.exec(src))) {
        n++;
        if (banned.test(m[2])) bad.push(m[1] + ' ' + m[2]);
    }
    assert.ok(n > 7000);
    assert.deepStrictEqual(bad, []);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
