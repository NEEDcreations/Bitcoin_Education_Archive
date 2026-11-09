// Anti-drain payout guards (Red Team, Nov 9 2026, after the Nov 8 LNbits drain wave).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const ad = require('../functions/src/antiDrain');
const ps = require('../functions/src/payoutSafety');
const cipherClaim = require('../functions/src/cipherClaim');
let passed = 0, failed = 0;
const pending = [];
function test(name, fn) {
    pending.push(async () => {
        try { await fn(); console.log('✅ ' + name); passed++; }
        catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
    });
}
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const H = 3600000, D = 24 * H, T0 = 1762700000000;

function fakeDb(seed) {
    const store = Object.assign({}, seed || {});
    let auto = 0;
    const ref = (col, id) => ({
        async get() { const v = store[col + '/' + id]; return { exists: v !== undefined, data: () => v }; },
        async set(v, opt) { store[col + '/' + id] = opt && opt.merge ? Object.assign({}, store[col + '/' + id] || {}, v) : v; },
    });
    return {
        store,
        collection(col) { return { doc(id) { return ref(col, id === undefined ? 'a' + (++auto) : id); } }; },
        async runTransaction(fn) {
            const w = [];
            await fn({ get: (r) => r.get(), set: (r, v, o) => w.push([r, v, o]) });
            for (const [r, v, o] of w) await r.set(v, o);
        },
    };
}
const verified = { email: 'a@b.co', emailVerified: true, providerData: [{ providerId: 'password' }] };

test('config defaults (flagged for Phil)', () => {
    assert.strictEqual(ad.MIN_PAYOUT_ACCOUNT_AGE_DAYS, 7);
    assert.strictEqual(ad.USER_MAX_PAYOUTS_PER_HOUR, 3);
    assert.strictEqual(ad.USER_MAX_PAYOUTS_PER_DAY, 6);
    assert.strictEqual(ad.WALLET_DAILY_CAP_SATS, 2500);
    assert.strictEqual(ad.FLOAT_DROP_SATS, 5000);
    assert.strictEqual(ad.FLOAT_DROP_WINDOW_MS, H);
});
test('one account-age constant for every payout path', () => {
    assert.strictEqual(cipherClaim.MIN_ACCOUNT_AGE_DAYS, ad.MIN_PAYOUT_ACCOUNT_AGE_DAYS);
    assert.ok(/MIN_ACCOUNT_AGE_DAYS: require\('\.\/src\/antiDrain'\)\.MIN_PAYOUT_ACCOUNT_AGE_DAYS/.test(read('functions/index.js')));
});
test('identity: anonymous, unverified, missing user rejected; verified passes', () => {
    assert.strictEqual(ad.assessIdentity({ firebase: { sign_in_provider: 'anonymous' } }, verified).reason, 'anonymous');
    assert.strictEqual(ad.assessIdentity({ firebase: { sign_in_provider: 'password' } }, null).ok, false);
    assert.strictEqual(ad.assessIdentity({ firebase: { sign_in_provider: 'password' } }, { email: 'a@b.co', emailVerified: false, providerData: [] }).reason, 'unverified');
    assert.strictEqual(ad.assessIdentity({ firebase: { sign_in_provider: 'password' } }, verified).ok, true);
});
test('identity: Nostr/Lightning custom-token account with a verified email still passes', () => {
    const tok = { firebase: { sign_in_provider: 'custom' }, email: 'n@b.co', email_verified: true };
    assert.strictEqual(ad.assessIdentity(tok, { providerData: [] }).ok, true);
    assert.strictEqual(ad.assessIdentity({ firebase: { sign_in_provider: 'custom' } }, { providerData: [] }).reason, 'unverified');
});
test('account age: unknown fails closed, 6 rejected, 7 ok', () => {
    assert.strictEqual(ad.assessAccountAge(undefined).reason, 'age_unknown');
    assert.strictEqual(ad.assessAccountAge(NaN).ok, false);
    assert.strictEqual(ad.assessAccountAge(6.9).ok, false);
    assert.strictEqual(ad.assessAccountAge(7).ok, true);
    assert.ok(/at least 7 days/.test(ad.assessAccountAge(2).error));
});
test('user rate: 3 per hour, 6 per 24h', () => {
    let st = null;
    for (let i = 0; i < 3; i++) { const r = ad.planUserRate(st, 'claimSats', T0 + i * 1000); assert.ok(r.ok); st = { events: r.events }; }
    assert.strictEqual(ad.planUserRate(st, 'claimSats', T0 + 5000).ok, false);
    const later = ad.planUserRate(st, 'claimSats', T0 + H + 5000);
    assert.ok(later.ok);
    st = { events: later.events };
    for (let i = 0; i < 2; i++) { const r = ad.planUserRate(st, 'claimCipherSats', T0 + 2 * H + i * H); assert.ok(r.ok, 'day ' + i); st = { events: r.events }; }
    assert.strictEqual(ad.planUserRate(st, 'claimCipherWin', T0 + 5 * H).reason, 'user_rate');
    assert.ok(ad.planUserRate(st, 'claimCipherWin', T0 + D + 1001).ok, 'rolls off after 24h');
});
test('honest day still fits: faucet + 2 cipher-sats claims + a prize', () => {
    let st = null;
    const steps = [['claimSats', 0], ['claimCipherSats', 2 * H], ['claimCipherSats', 6 * H], ['claimCipherWin', 9 * H]];
    for (const [p, at] of steps) { const r = ad.planUserRate(st, p, T0 + at); assert.ok(r.ok, p); st = { events: r.events }; }
});
test('wallet cap: 2,500 per address in a rolling 24h', () => {
    let st = null;
    for (const s of [1000, 1000, 500]) { const r = ad.planWalletCap(st, s, 'claimSats', T0); assert.ok(r.ok, String(s)); st = { events: r.events }; }
    assert.strictEqual(ad.planWalletCap(st, 1, 'claimSats', T0 + 1).reason, 'wallet_cap');
    assert.ok(ad.planWalletCap(st, 1000, 'claimSats', T0 + D + 1).ok);
});
test('wallet key: case-insensitive, hashed, empty refused', () => {
    assert.strictEqual(ad.walletKey('Phil@Getalby.com'), ad.walletKey('phil@getalby.com '));
    assert.ok(/^[0-9a-f]{40}$/.test(ad.walletKey('a@b.co')));
    assert.strictEqual(ad.walletKey(''), '');
});
test('float breaker: steady payouts ok, fast drop trips, top-ups raise peak', () => {
    let st = null;
    let bal = 60000;
    for (let i = 0; i < 10; i++) { const r = ad.planFloat(st, bal, T0 + i * 5 * 60000); assert.strictEqual(r.trip, false); st = { samples: r.samples }; bal -= 400; }
    const trip = ad.planFloat({ samples: [{ ms: T0, sats: 60000 }] }, 54999, T0 + 30 * 60000);
    assert.strictEqual(trip.trip, true);
    assert.strictEqual(trip.drop, 5001);
    assert.strictEqual(ad.planFloat({ samples: [{ ms: T0, sats: 60000 }] }, 55000, T0 + 30 * 60000).trip, false, 'exactly 5000 ok');
    assert.strictEqual(ad.planFloat({ samples: [{ ms: T0, sats: 60000 }] }, 50000, T0 + H + 1).trip, false, 'outside window');
    assert.strictEqual(ad.planFloat({ samples: [{ ms: T0, sats: 20000 }] }, 80000, T0 + 1000).trip, false, 'top-up');
});
test('reservePayout records user + wallet + float on success', async () => {
    const db = fakeDb();
    await ad.reservePayout(db, {}, { uid: 'u1', path: 'claimSats', address: 'a@b.co', sats: 1000, walletSats: 50000, nowMs: T0 });
    assert.strictEqual(db.store['payout_guard_users/u1'].events.length, 1);
    assert.strictEqual(db.store['payout_guard_wallets/' + ad.walletKey('a@b.co')].events[0].sats, 1000);
    assert.strictEqual(db.store['payout_safety/float'].samples.length, 1);
});
test('reservePayout: wallet cap shared across accounts', async () => {
    const db = fakeDb();
    await ad.reservePayout(db, {}, { uid: 'u1', path: 'claimSats', address: 'x@y.co', sats: 1000, walletSats: 50000, nowMs: T0 });
    await ad.reservePayout(db, {}, { uid: 'u2', path: 'claimCipherSats', address: 'x@y.co', sats: 1000, walletSats: 49000, nowMs: T0 + 1 });
    await assert.rejects(ad.reservePayout(db, {}, { uid: 'u3', path: 'claimCipherWin', address: 'X@y.co', sats: 600, walletSats: 48000, nowMs: T0 + 2 }), e => e.code === 'PAYOUT_GUARD' && e.reason === 'wallet_cap');
    assert.strictEqual(db.store['payout_guard_users/u3'], undefined, 'refused attempt not recorded');
});
test('reservePayout: float trip sets global satsHold + audit + alert, then refuses', async () => {
    const db = fakeDb({ 'payout_safety/float': { samples: [{ ms: T0, sats: 60000 }] } });
    const notes = [];
    await assert.rejects(
        ad.reservePayout(db, {}, { uid: 'u1', path: 'claimSats', address: 'a@b.co', sats: 100, walletSats: 40000, nowMs: T0 + 60000 }, { notify: async (_d, _a, n) => { notes.push(n); } }),
        e => e.code === 'PAYOUT_GUARD' && e.reason === 'float_breaker'
    );
    assert.ok(db.store['payout_safety/hold'].satsHold > T0 + D);
    assert.ok(Object.keys(db.store).some(k => k.indexOf('payout_safety_audit/') === 0));
    assert.strictEqual(notes.length, 1);
    assert.ok(/ALL sats payouts paused/.test(notes[0].message));
    // Next attempt is refused by the hold itself.
    await assert.rejects(ad.reservePayout(db, {}, { uid: 'u2', path: 'claimCipherSats', address: 'c@d.co', sats: 100, walletSats: 40000, nowMs: T0 + 120000 }), e => e.reason === 'satsHold');
    assert.strictEqual(ps.assessHold(db.store['payout_safety/hold'], 'claimSats', T0 + 2 * H).ok, false);
});
test('reservePayout refuses missing uid or address', async () => {
    const db = fakeDb();
    await assert.rejects(ad.reservePayout(db, {}, { uid: '', path: 'claimSats', address: 'a@b.co', sats: 1, walletSats: 1, nowMs: T0 }), e => e.code === 'PAYOUT_GUARD');
    await assert.rejects(ad.reservePayout(db, {}, { uid: 'u', path: 'claimSats', address: '', sats: 1, walletSats: 1, nowMs: T0 }), e => e.code === 'PAYOUT_GUARD');
});

// Wiring: every path that calls nwc.payInvoice runs identity + reservePayout first.
test('wiring: claimSats', () => {
    const src = read('functions/index.js');
    const s = src.indexOf('exports.claimSats ='); const body = src.slice(s, src.indexOf('\nexports.', s + 20));
    assert.ok(body.indexOf("sign_in_provider === 'anonymous'") > 0 && body.indexOf("sign_in_provider === 'anonymous'") < body.indexOf('verifyTurnstile'));
    assert.ok(body.indexOf('antiDrain.assessIdentity(') > 0);
    const r = body.indexOf('antiDrain.reservePayout(');
    assert.ok(r > 0 && r < body.indexOf('nwc.payInvoice'));
});
test('wiring: claimCipherWin and claimCipherSats', () => {
    const src = read('functions/src/gifting.js');
    const win = src.slice(src.indexOf('const claimCipherWin ='), src.indexOf('function requireAdmin'));
    assert.ok(win.indexOf("assessIdentity(") > 0);
    assert.ok(win.indexOf("path: 'claimCipherWin'") < win.indexOf('nwc.payInvoice'));
    assert.ok(/reservePayout\(db, admin, \{ uid: uid, path: 'claimCipherWin', address: payoutAddress/.test(win));
    const sats = src.slice(src.indexOf('const claimCipherSats ='), src.indexOf('const adminResolveCipherSatsClaim ='));
    assert.ok(sats.indexOf('assessIdentity(') > 0);
    assert.ok(sats.indexOf('payCipherBalanceInvoice(invoice, { uid: uid, address: reserved.address, sats: reserved.amount })') > 0);
    const bal = src.slice(src.indexOf('async function payCipherBalanceInvoice'), src.indexOf('async function payCipherBalanceInvoice') + 1400);
    assert.ok(bal.indexOf("reservePayout(") > 0 && bal.indexOf("reservePayout(") < bal.indexOf('nwc.payInvoice'));
});
test('wiring: no other function sends sats (payInvoice inventory)', () => {
    const files = ['functions/index.js', 'functions/src/gifting.js', 'functions/tctv-drip.js', 'functions/src/tipService.js', 'functions/src/factionRacePrizes.js', 'functions/src/satoshiFavor.js'];
    let count = 0;
    for (const f of files) { if (fs.existsSync(path.join(root, f))) count += (read(f).match(/\.payInvoice\(/g) || []).length; }
    // claimSats, claimCipherWin, payCipherBalanceInvoice (claimCipherSats). Update antiDrain if this changes.
    assert.strictEqual(count, 3);
});
test('reward paths that credit sats reject anonymous accounts', () => {
    const g = read('functions/src/gifting.js');
    for (const fn of ['decryptCipher', 'ackCipherShare', 'openGift', 'awardDailyGifts']) {
        const at = g.indexOf('const ' + fn + ' = ');
        assert.ok(at > 0, fn);
        assert.ok(g.slice(at, at + 900).indexOf('requireUser(context)') > 0, fn);
    }
    assert.ok(/sign_in_provider === 'anonymous'\) \{\s*throw httpsError\('unauthenticated'/.test(g));
    const drip = read('functions/tctv-drip.js');
    assert.ok(drip.indexOf("sign_in_provider") > 0 && /anonymous/.test(drip));
});
test('rules + retention', () => {
    const rules = read('firestore.rules');
    assert.ok(/match \/payout_guard_users\/\{docId\} \{\s*allow read, write: if false;/.test(rules));
    assert.ok(/match \/payout_guard_wallets\/\{docId\} \{\s*allow read, write: if false;/.test(rules));
    const del = read('functions/src/deleteAccount.js');
    assert.ok(del.indexOf("'payout_guard_users'") > 0 && del.indexOf("'payout_guard_wallets'") > 0);
});

(async () => {
    for (const p of pending) await p();
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
