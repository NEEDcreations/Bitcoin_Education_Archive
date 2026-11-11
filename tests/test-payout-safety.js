// Payout safety follow-up to #273: fee_over_cap alerts, 2-in-1h global satsHold,
// cipher 500 sats / 24h overpaid-fee pause. Pure + fake-Firestore tests.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const ps = require('../functions/src/payoutSafety');
let passed = 0, failed = 0;
const pending = [];
function test(name, fn) {
    pending.push((async () => {
        try { await fn(); console.log('✅ ' + name); passed++; }
        catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
    }));
}
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const H = 60 * 60 * 1000;
const T0 = 1762700000000;

// Minimal fake Firestore: collection().doc().get/set, runTransaction, auto ids.
function fakeDb(seed) {
    const store = Object.assign({}, seed || {});
    let auto = 0;
    const docRef = (col, id) => ({
        _key: col + '/' + id,
        async get() { const v = store[col + '/' + id]; return { exists: v !== undefined, data: () => v }; },
        async set(v, opt) { store[col + '/' + id] = opt && opt.merge ? Object.assign({}, store[col + '/' + id] || {}, v) : v; },
    });
    const db = {
        store,
        failReads: false,
        collection(col) { return { doc(id) { return docRef(col, id === undefined ? 'auto' + (++auto) : id); } }; },
        async runTransaction(fn) {
            const writes = [];
            const t = {
                async get(ref) { if (db.failReads) throw new Error('boom'); return ref.get(); },
                set(ref, v, opt) { writes.push([ref, v, opt]); },
            };
            await fn(t);
            for (const [ref, v, opt] of writes) await ref.set(v, opt);
        },
    };
    return db;
}

test('constants match the Security Team ask', () => {
    assert.strictEqual(ps.FEE_FLAG_LIMIT, 2);
    assert.strictEqual(ps.FEE_FLAG_WINDOW_MS, H);
    assert.strictEqual(ps.CIPHER_OVERPAID_LIMIT_SATS, 500);
    assert.strictEqual(ps.CIPHER_OVERPAID_WINDOW_MS, 24 * H);
    assert.deepStrictEqual(ps.CIPHER_PATHS.slice().sort(), ['claimCipherSats', 'claimCipherWin']);
});
test('overpaid = paid - charged, never negative', () => {
    assert.strictEqual(ps.overpaidSats(10, 14), 4);
    assert.strictEqual(ps.overpaidSats(10, 3), 0);
    assert.strictEqual(ps.overpaidSats(10, null), 0);
});
test('one flag alerts but does not hold', () => {
    const p = ps.planFeeEvent(null, null, { path: 'claimSats', charged: 10, feePaid: 12 }, T0);
    assert.strictEqual(p.hourCount, 1);
    assert.strictEqual(p.setSatsHold, false);
    assert.strictEqual(p.setCipherHold, false);
});
test('second flag inside 1h sets the global satsHold', () => {
    const a = ps.planFeeEvent(null, null, { path: 'claimSats', charged: 10, feePaid: 12 }, T0);
    const b = ps.planFeeEvent({ events: a.events }, null, { path: 'claimCipherSats', charged: 10, feePaid: 11 }, T0 + 59 * 60 * 1000);
    assert.strictEqual(b.hourCount, 2);
    assert.strictEqual(b.setSatsHold, true);
    assert.ok(b.holdUntil > T0 + 24 * H);
});
test('second flag after 1h does not hold', () => {
    const a = ps.planFeeEvent(null, null, { path: 'claimSats', charged: 10, feePaid: 12 }, T0);
    const b = ps.planFeeEvent({ events: a.events }, null, { path: 'claimSats', charged: 10, feePaid: 12 }, T0 + H + 1);
    assert.strictEqual(b.hourCount, 1);
    assert.strictEqual(b.setSatsHold, false);
});
test('already held: no second hold write', () => {
    const a = ps.planFeeEvent(null, null, { path: 'claimSats', charged: 10, feePaid: 12 }, T0);
    const b = ps.planFeeEvent({ events: a.events }, { satsHold: T0 + 10 * H }, { path: 'claimSats', charged: 10, feePaid: 12 }, T0 + 1000);
    assert.strictEqual(b.setSatsHold, false);
});
test('cipher overpaid 500 exactly does not pause, 501 does', () => {
    const at500 = ps.planFeeEvent(null, null, { path: 'claimCipherWin', charged: 10, feePaid: 510 }, T0);
    assert.strictEqual(at500.cipherOverpaid24h, 500);
    assert.strictEqual(at500.setCipherHold, false);
    const at501 = ps.planFeeEvent({ events: at500.events }, null, { path: 'claimCipherSats', charged: 10, feePaid: 11 }, T0 + 2 * H);
    assert.strictEqual(at501.cipherOverpaid24h, 501);
    assert.strictEqual(at501.setCipherHold, true);
    assert.strictEqual(at501.setSatsHold, false);
});
test('faucet overpaid fees do not count toward the cipher total', () => {
    const p = ps.planFeeEvent(null, null, { path: 'claimSats', charged: 10, feePaid: 900 }, T0);
    assert.strictEqual(p.cipherOverpaid24h, 0);
    assert.strictEqual(p.setCipherHold, false);
});
test('cipher total rolls off after 24h', () => {
    const a = ps.planFeeEvent(null, null, { path: 'claimCipherWin', charged: 10, feePaid: 410 }, T0);
    const b = ps.planFeeEvent({ events: a.events }, null, { path: 'claimCipherWin', charged: 10, feePaid: 210 }, T0 + 24 * H + 1);
    assert.strictEqual(b.cipherOverpaid24h, 200);
    assert.strictEqual(b.setCipherHold, false);
});
test('event list is bounded', () => {
    let st = null;
    for (let i = 0; i < 400; i++) st = { events: ps.planFeeEvent(st, { satsHold: T0 * 2, cipherHold: T0 * 2 }, { path: 'claimSats', charged: 10, feePaid: 11 }, T0 + i).events };
    assert.ok(st.events.length <= 200);
});
test('assessHold: satsHold blocks every path, cipherHold only cipher', () => {
    for (const p of ps.PAYOUT_PATHS) assert.strictEqual(ps.assessHold({ satsHold: T0 + 1 }, p, T0).ok, false, p);
    assert.strictEqual(ps.assessHold({ cipherHold: T0 + 1 }, 'claimSats', T0).ok, true);
    assert.strictEqual(ps.assessHold({ cipherHold: T0 + 1 }, 'claimCipherSats', T0).ok, false);
    assert.strictEqual(ps.assessHold({ cipherHold: T0 + 1 }, 'claimCipherWin', T0).ok, false);
    assert.strictEqual(ps.assessHold({ satsHold: T0 - 1, cipherHold: 0 }, 'claimCipherWin', T0).ok, true);
    assert.strictEqual(ps.assessHold(null, 'claimSats', T0).ok, true);
});
test('recordFeeOverCap: 1st alerts, 2nd in 1h holds + audits + alerts', async () => {
    const db = fakeDb();
    const notes = [];
    const notify = async (_db, _admin, n) => { notes.push(n); return 1; };
    await ps.recordFeeOverCap(db, {}, { path: 'claimSats', uid: 'u1', charged: 10, feePaid: 13 }, { nowMs: T0, notify });
    assert.strictEqual(notes.length, 1);
    assert.ok(/paid 13 sats, charged 10/.test(notes[0].message));
    assert.strictEqual(db.store['payout_safety/hold'], undefined);
    await ps.recordFeeOverCap(db, {}, { path: 'claimCipherWin', uid: 'u2', charged: 10, feePaid: 12 }, { nowMs: T0 + 1000, notify });
    assert.strictEqual(notes.length, 2);
    assert.ok(/ALL sats payouts paused/.test(notes[1].message));
    assert.ok(db.store['payout_safety/hold'].satsHold > T0 + 1000);
    assert.ok(Object.keys(db.store).some(k => k.indexOf('payout_safety_audit/') === 0));
    assert.ok(notes.every(n => n.message.length <= 180));
    // No uid kept on the rolling fee watch (faucet_admin_flags has it already).
    assert.ok(db.store['payout_safety/fee_watch'].events.every(e => e.uid === undefined));
});
test('recordFeeOverCap never throws (tx + notify failures)', async () => {
    const db = fakeDb();
    db.failReads = true;
    const res = await ps.recordFeeOverCap(db, {}, { path: 'claimSats', charged: 10, feePaid: 20 }, { nowMs: T0, notify: async () => { throw new Error('x'); } });
    assert.strictEqual(res, null);
});
test('assertPayoutsOpen: open, held, and fail-closed on read error', async () => {
    const db = fakeDb();
    assert.strictEqual(await ps.assertPayoutsOpen(db, 'claimSats', T0), true);
    db.store['payout_safety/hold'] = { cipherHold: T0 + H };
    assert.strictEqual(await ps.assertPayoutsOpen(db, 'claimSats', T0), true);
    await assert.rejects(ps.assertPayoutsOpen(db, 'claimCipherSats', T0), e => e.code === 'PAYOUT_GUARD' && e.reason === 'cipherHold');
    const broken = { collection() { return { doc() { return { async get() { throw new Error('down'); } }; } }; } };
    await assert.rejects(ps.assertPayoutsOpen(broken, 'claimSats', T0), e => e.code === 'PAYOUT_GUARD' && e.reason === 'hold_unreadable');
});

// Wiring: every Lightning payout checks the hold right before pay_invoice and
// every fee_over_cap flag feeds recordFeeOverCap.
test('claimSats wiring', () => {
    const src = read('functions/index.js');
    const start = src.indexOf('exports.claimSats =');
    const body = src.slice(start, src.indexOf('\nexports.', start + 20));
    const guard = body.indexOf("assertPayoutsOpen(db, 'claimSats')", body.indexOf("phase = 'balance'"));
    assert.ok(guard > 0 && guard < body.indexOf('nwc.payInvoice'), 'pre-pay guard');
    assert.ok(body.indexOf("payError.code === 'PAYOUT_GUARD'") > 0);
    const fee = src.slice(src.indexOf('async function _flagFeeOver'), src.indexOf('async function _notifySatsReview'));
    assert.ok(/recordFeeOverCap\(db, admin, \{\s*path: 'claimSats'/.test(fee));
});
test('cipher wiring', () => {
    const src = read('functions/src/gifting.js');
    const win = src.slice(src.indexOf('const claimCipherWin ='), src.indexOf('function requireAdmin'));
    assert.ok(win.indexOf("assertPayoutsOpen(db, 'claimCipherWin')") > 0);
    const pre = win.lastIndexOf("assertPayoutsOpen(db, 'claimCipherWin')");
    assert.ok(pre < win.indexOf('nwc.payInvoice'), 'win pre-pay guard');
    assert.ok(/recordFeeOverCap\(db, admin, \{\s*path: 'claimCipherWin'/.test(win));
    const bal = src.slice(src.indexOf('async function payCipherBalanceInvoice'), src.indexOf('async function payCipherBalanceInvoice') + 1200);
    assert.ok(bal.indexOf("assertPayoutsOpen(db, 'claimCipherSats')") < bal.indexOf('nwc.payInvoice'));
    const sats = src.slice(src.indexOf('const claimCipherSats ='), src.indexOf('const adminResolveCipherSatsClaim ='));
    assert.ok(/recordFeeOverCap\(db, admin, \{\s*path: 'claimCipherSats'/.test(sats));
    assert.ok(sats.indexOf('paid.guard') > 0);
    // Every fee_over_cap flag site also records.
    const flags = (src.match(/type: 'fee_over_cap'/g) || []).length;
    const recs = (src.match(/recordFeeOverCap\(/g) || []).length;
    assert.strictEqual(flags, recs);
});
test('rules: payout_safety is server-only', () => {
    const rules = read('firestore.rules');
    assert.ok(/match \/payout_safety\/\{docId\} \{\s*allow read: if isAdmin\(\);\s*allow write: if false;/.test(rules));
    assert.ok(/match \/payout_safety_audit\/\{docId\} \{\s*allow read: if isAdmin\(\);\s*allow write: if false;/.test(rules));
});

// ---- Phil Nov 9: 30-day auto-holds + admin Clear Hold button ----
test('auto-holds last 30 days, then lapse on their own', () => {
    assert.strictEqual(ps.HOLD_MS, 30 * 24 * H);
    const hold = { satsHold: T0 + ps.HOLD_MS };
    assert.strictEqual(ps.assessHold(hold, 'claimSats', T0 + ps.HOLD_MS - 1).ok, false);
    assert.strictEqual(ps.assessHold(hold, 'claimSats', T0 + ps.HOLD_MS).ok, true);
});
test('planClearHold clears only active fields and keeps the prior reason', () => {
    const hold = { satsHold: T0 + H, satsHoldReason: 'fee_over_cap x2 in 1h', satsHoldSetAtMs: T0 - 1, cipherHold: T0 - 1 };
    const p = ps.planClearHold(hold, 'all', T0);
    assert.deepStrictEqual(p.cleared, ['satsHold']);
    assert.strictEqual(p.patch.satsHold, 0);
    assert.strictEqual(p.patch.cipherHold, undefined);
    assert.strictEqual(p.prior.satsHold.reason, 'fee_over_cap x2 in 1h');
    assert.strictEqual(ps.planClearHold(hold, 'cipherHold', T0).cleared.length, 0);
    assert.strictEqual(ps.planClearHold(hold, 'users', T0).ok, false);
    assert.strictEqual(ps.planClearHold(hold, '__proto__', T0).ok, false);
});
test('clearHold: one transaction, hold off, permanent audit row, admin alert', async () => {
    const db = fakeDb({ 'payout_safety/hold': { satsHold: T0 + H, satsHoldReason: 'float dropped 6000 sats in 60 min', cipherHold: T0 + H } });
    const alerts = [];
    const p = await ps.clearHold(db, null, { which: 'satsHold', adminUid: 'adminA' }, { nowMs: T0, notify: async (_d, _a, n) => alerts.push(n) });
    assert.deepStrictEqual(p.cleared, ['satsHold']);
    const h = db.store['payout_safety/hold'];
    assert.strictEqual(h.satsHold, 0);
    assert.strictEqual(h.satsHoldClearedBy, 'adminA');
    assert.strictEqual(h.cipherHold, T0 + H, 'cipher hold untouched');
    assert.strictEqual(await ps.assertPayoutsOpen(db, 'claimSats', T0), true);
    await assert.rejects(ps.assertPayoutsOpen(db, 'claimCipherSats', T0), e => e.reason === 'cipherHold');
    const audits = Object.keys(db.store).filter(k => k.indexOf('payout_safety_audit/') === 0).map(k => db.store[k]);
    assert.strictEqual(audits.length, 1);
    assert.strictEqual(audits[0].action, 'clear_hold');
    assert.strictEqual(audits[0].byUid, 'adminA');
    assert.strictEqual(audits[0].prior.satsHold.reason, 'float dropped 6000 sats in 60 min');
    assert.strictEqual(alerts.length, 1);
});
test('clearHold with nothing active still audits, no alert', async () => {
    const db = fakeDb({});
    const alerts = [];
    const p = await ps.clearHold(db, null, { which: 'all', adminUid: 'adminA' }, { nowMs: T0, notify: async () => alerts.push(1) });
    assert.deepStrictEqual(p.cleared, []);
    assert.strictEqual(Object.keys(db.store).filter(k => k.indexOf('payout_safety_audit/') === 0).length, 1);
    assert.strictEqual(alerts.length, 0);
    await assert.rejects(ps.clearHold(db, null, { which: 'all', adminUid: '' }, { nowMs: T0 }));
});
test('adminClearPayoutHold: admin claim only, App Check, 2FA, confirm phrase, own runtime SA, sends nothing', () => {
    assert.ok(read('functions/index.js').indexOf("exports.adminClearPayoutHold = require('./src/adminPayoutHold').adminClearPayoutHold;") > 0);
    const body = read('functions/src/adminPayoutHold.js');
    assert.ok(body.indexOf('enforceAppCheck: true') > 0);
    assert.ok(body.indexOf("serviceAccount: runtimeSa('adminClearPayoutHold')") > 0);
    assert.ok(body.indexOf('context.auth.token.admin !== true') > 0);
    assert.ok(body.indexOf('requireFreshStepUp') > 0);
    // Red Team follow-up: an enrolled factor is required, checked before the hold is touched.
    const fresh = body.indexOf("secondFactor.requireFreshStepUp(secondFactor.stamp(data, context), 'clearPayoutHold')");
    const recent = body.indexOf('payoutSafety.recentAuth(context.auth.token.auth_time, Date.now())');
    assert.ok(recent > 0 && fresh > recent, 'recent sign-in, then fresh step-up');
    assert.ok(read('functions/src/secondFactor.js').indexOf('clearPayoutHold: true') > 0, 'step-up action registered');
    const req = body.indexOf('if (!payoutSafety.secondFactorEnrolled(sf))');
    assert.ok(req > fresh);
    assert.ok(req > 0 && req < body.indexOf('payoutSafety.clearHold('));
    assert.ok(body.indexOf("'failed-precondition', 'Turn on two-factor authentication") > 0);
    assert.ok(body.indexOf('confirmPhrase(which)') > 0);
    assert.ok(!/email/i.test(body), 'never an email gate');
    assert.ok(body.indexOf('payInvoice') === -1 && body.indexOf('secrets:') === -1);
    assert.strictEqual(ps.confirmPhrase('satsHold'), 'CLEAR satsHold');
    const sa = require('../functions/src/runtimeServiceAccounts').RUNTIME_SERVICE_ACCOUNTS.adminClearPayoutHold;
    assert.strictEqual(sa.id, 'fn-admin-clear-payout-hold');
    assert.strictEqual(sa.noSecrets, true);
});
test('secondFactorEnrolled: only an enrolled authenticator or phone passes', () => {
    assert.strictEqual(ps.secondFactorEnrolled({ uid: 'a', totp: false, phone: false }), false);
    assert.strictEqual(ps.secondFactorEnrolled(null), false);
    assert.strictEqual(ps.secondFactorEnrolled(undefined), false);
    assert.strictEqual(ps.secondFactorEnrolled({ totp: 'yes' }), false);
    assert.strictEqual(ps.secondFactorEnrolled({ totp: true, phone: false }), true);
    assert.strictEqual(ps.secondFactorEnrolled({ totp: false, phone: true }), true);
});
test('recentAuth: only a sign-in within 10 minutes passes', () => {
    const now = 1_800_000_000_000;
    assert.strictEqual(ps.recentAuth(now / 1000 - 60, now), true);
    assert.strictEqual(ps.recentAuth(now / 1000 - 9 * 60, now), true);
    assert.strictEqual(ps.recentAuth(now / 1000 - 11 * 60, now), false);
    assert.strictEqual(ps.recentAuth(now / 1000 - 86400, now), false);
    assert.strictEqual(ps.recentAuth(undefined, now), false);
    assert.strictEqual(ps.recentAuth('x', now), false);
    assert.strictEqual(ps.recentAuth(now / 1000 + 3600, now), false, 'future auth_time');
});
test('client: Clear Hold asks for re-sign-in and a fresh code before calling', () => {
    const r = read('ranking.js');
    const fn = r.slice(r.indexOf('window.clearPayoutHold = function'), r.indexOf('window.renderFaucetAbuseAdmin = function'));
    const re = fn.indexOf("reauthForSensitiveAction('clearing a payout hold')");
    const fc = fn.indexOf("_showFreshStepUp('clearPayoutHold')");
    const call = fn.indexOf("httpsCallable('adminClearPayoutHold')(payload)");
    assert.ok(re > 0 && fc > re && call > fc);
    assert.ok(r.indexOf("clearPayoutHold: 'Enter a fresh authenticator code to clear a payout hold.") > 0);
});
test('client: Clear Hold card is admin-claim gated and on the App Check list', () => {
    const r = read('ranking.js');
    assert.ok(r.indexOf('adminClearPayoutHold: 1,') > 0);
    const card = r.slice(r.indexOf('window.renderPayoutHoldAdmin = function'), r.indexOf('window.renderFaucetAbuseAdmin = function'));
    assert.ok(card.indexOf("window._isAdminClaim !== true") > 0);
    assert.ok(card.indexOf("httpsCallable('adminClearPayoutHold')") > 0);
    assert.ok(card.indexOf("'CLEAR ' + which") > 0);
    assert.ok(card.indexOf('Clear Hold') > 0);
    assert.ok(r.indexOf('<div id="payoutHoldAdmin"') > 0);
    assert.ok(r.indexOf("window.renderPayoutHoldAdmin('payoutHoldAdmin')") > 0);
});

(async () => {
    for (const p of pending) await p();
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
