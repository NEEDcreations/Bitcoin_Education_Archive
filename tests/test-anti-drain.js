// Anti-drain payout guards (Red Team, Nov 9 2026, after the Nov 8 LNbits drain wave).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
// Fake test-only HMAC key (the real one lives in Secret Manager).
process.env.PAYOUT_GUARD_HMAC_KEY = 'test-only-payout-guard-key-not-real';
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
test('wallet key: case-insensitive, HMAC keyed, empty refused', () => {
    assert.strictEqual(ad.walletKey('Phil@Getalby.com'), ad.walletKey('phil@getalby.com '));
    assert.ok(/^[0-9a-f]{40}$/.test(ad.walletKey('a@b.co')));
    assert.strictEqual(ad.walletKey(''), '');
    // Keyed: a different key gives a different id (no static salt).
    const a = ad.walletKey('a@b.co');
    const saved = process.env.PAYOUT_GUARD_HMAC_KEY;
    process.env.PAYOUT_GUARD_HMAC_KEY = 'another-test-only-key-0000';
    assert.notStrictEqual(ad.walletKey('a@b.co'), a);
    process.env.PAYOUT_GUARD_HMAC_KEY = saved;
    // Not the old static-salt sha256.
    const legacy = require('crypto').createHash('sha256').update('bq-wallet:a@b.co').digest('hex').slice(0, 40);
    assert.notStrictEqual(a, legacy);
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
    assert.strictEqual(db.store['payout_guard_users/' + ad.userKey('u1')].events.length, 1);
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
    assert.ok(sats.indexOf("payCipherBalanceInvoice(invoice, { uid: uid, address: reserved.address, callback: satsResolved.callbackKey || '', sats: reserved.amount })") > 0);
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

// ---- Fix pass Nov 11: User Data/Backups + Spam/Abuse + Red Team must-fixes ----
test('M1: guard doc ids are HMACs; no raw uid or address is stored', async () => {
    const db = fakeDb();
    await ad.reservePayout(db, {}, { uid: 'EzWnUserUid123', path: 'claimSats', address: 'Bob@Wallet.example', callback: 'api.wallet.example/lnurlp/bob/callback', sats: 500, walletSats: 50000, nowMs: T0 });
    const keys = Object.keys(db.store);
    const dump = JSON.stringify(db.store);
    assert.ok(dump.indexOf('EzWnUserUid123') === -1, 'raw uid in store');
    assert.ok(dump.toLowerCase().indexOf('bob@wallet.example') === -1, 'raw address in store');
    assert.ok(keys.indexOf('payout_guard_users/' + ad.userKey('EzWnUserUid123')) !== -1);
    assert.ok(/^[0-9a-f]{40}$/.test(ad.userKey('EzWnUserUid123')));
    assert.ok(keys.every(k => k.indexOf('EzWn') === -1));
});
test('M1: every guard write carries a 30-day expireAt for the TTL policy, events pruned to 24h', async () => {
    assert.strictEqual(ad.GUARD_TTL_MS, 30 * D);
    const old = { events: [{ ms: T0 - 2 * D, path: 'claimSats' }, { ms: T0 - 40 * D, path: 'claimSats' }] };
    const db = fakeDb({ ['payout_guard_users/' + ad.userKey('u1')]: old });
    await ad.reservePayout(db, {}, { uid: 'u1', path: 'claimSats', address: 'a@b.co', sats: 100, walletSats: 50000, nowMs: T0 });
    const u = db.store['payout_guard_users/' + ad.userKey('u1')];
    const w = db.store['payout_guard_wallets/' + ad.walletKey('a@b.co')];
    assert.strictEqual(u.events.length, 1, 'events older than 24h pruned on write');
    assert.strictEqual(u.expireAt.getTime(), T0 + 30 * D);
    assert.strictEqual(w.expireAt.getTime(), T0 + 30 * D);
});
test('M1: missing HMAC key fails closed (no payout, nothing written)', async () => {
    const saved = process.env.PAYOUT_GUARD_HMAC_KEY;
    try {
        delete process.env.PAYOUT_GUARD_HMAC_KEY;
        assert.strictEqual(ad.secretReady(), false);
        assert.strictEqual(ad.walletKey('a@b.co'), '');
        const db = fakeDb();
        await assert.rejects(ad.reservePayout(db, {}, { uid: 'u1', path: 'claimSats', address: 'a@b.co', sats: 100, walletSats: 50000, nowMs: T0 }), e => e.code === 'PAYOUT_GUARD' && e.reason === 'guard_key_missing');
        assert.strictEqual(Object.keys(db.store).length, 0);
        process.env.PAYOUT_GUARD_HMAC_KEY = 'short';
        assert.strictEqual(ad.secretReady(), false);
    } finally { process.env.PAYOUT_GUARD_HMAC_KEY = saved; }
});
test('M1: the key is a Secret Manager param bound on exactly the 3 payout callables', () => {
    assert.ok(read('functions/src/payoutGuardSecret.js').indexOf("defineSecret('PAYOUT_GUARD_HMAC_KEY')") > 0);
    const idx = read('functions/index.js');
    const g = read('functions/src/gifting.js');
    const claimSats = idx.slice(idx.indexOf('exports.claimSats ='), idx.indexOf('exports.claimSats =') + 400);
    assert.ok(claimSats.indexOf('payoutGuardSecret') > 0);
    const win = g.slice(g.indexOf('const claimCipherWin ='), g.indexOf('const claimCipherWin =') + 300);
    assert.ok(win.indexOf('payoutGuardSecret') > 0);
    const sats = g.slice(g.indexOf('const claimCipherSats ='), g.indexOf('const claimCipherSats =') + 400);
    assert.ok(sats.indexOf('payoutGuardSecret') > 0);
    const re = /require\('\.\/(?:src\/)?payoutGuardSecret'\)\.payoutGuardSecret/g;
    const n = (idx.match(re) || []).length + (g.match(re) || []).length;
    assert.strictEqual(n, 3);
    assert.ok(read('functions/src/antiDrain.js').indexOf("'bq-wallet:'") === -1, 'static salt removed');
});
test('M2: wallet fingerprint folds prefixes, www, trailing dot, port and alias domains', () => {
    const fp = ad.walletFingerprint;
    assert.strictEqual(fp('lightning:Bob@Example.com'), 'bob@example.com');
    assert.strictEqual(fp('bob@www.example.com'), 'bob@example.com');
    assert.strictEqual(fp('bob@example.com.'), 'bob@example.com');
    assert.strictEqual(fp('bob@example.com:443'), 'bob@example.com');
    assert.strictEqual(fp('bob@pay.bitcoinbeach.com'), 'bob@blink.sv');
    assert.strictEqual(ad.walletKey('BOB@pay.bitcoinbeach.com'), ad.walletKey('bob@blink.sv'));
    assert.strictEqual(fp(''), '');
});
test('M2: LNURL (bech32) form of an address maps to the same wallet as the address', () => {
    // bech32 of https://example.com/.well-known/lnurlp/bob
    const bech32 = require('../functions/node_modules/bech32');
    const words = bech32.toWords(Buffer.from('https://example.com/.well-known/lnurlp/bob', 'utf8'));
    const lnurl = bech32.encode('lnurl', words, 1023);
    assert.strictEqual(ad.walletFingerprint(lnurl), 'bob@example.com');
    assert.strictEqual(ad.walletKey(lnurl.toUpperCase()), ad.walletKey('bob@example.com'));
    const other = bech32.encode('lnurl', bech32.toWords(Buffer.from('https://pay.example.org/api/abc', 'utf8')), 1023);
    assert.strictEqual(ad.walletFingerprint(other), 'url:pay.example.org/api/abc');
});
test('M2: two alias addresses on one wallet callback share one 2,500 cap', async () => {
    const db = fakeDb();
    const cb = 'api.custodian.example/lnurlp/bob/callback';
    await ad.reservePayout(db, {}, { uid: 'u1', path: 'claimSats', address: 'bob@alias-one.example', callback: cb, sats: 1000, walletSats: 50000, nowMs: T0 });
    await ad.reservePayout(db, {}, { uid: 'u2', path: 'claimCipherSats', address: 'bob@alias-two.example', callback: cb, sats: 1000, walletSats: 49000, nowMs: T0 + 1 });
    await assert.rejects(ad.reservePayout(db, {}, { uid: 'u3', path: 'claimCipherWin', address: 'bob@alias-three.example', callback: cb, sats: 600, walletSats: 48000, nowMs: T0 + 2 }), e => e.reason === 'wallet_cap');
    // A different callback and address is a different wallet.
    await ad.reservePayout(db, {}, { uid: 'u4', path: 'claimSats', address: 'carol@other.example', callback: 'other.example/cb/carol', sats: 600, walletSats: 48000, nowMs: T0 + 3 });
    // Refused attempt recorded nothing on the alias address.
    assert.strictEqual(db.store['payout_guard_wallets/' + ad.walletKey('bob@alias-three.example')], undefined);
});
test('M2: callback key ignores trailing slash and is stable across scheme', () => {
    assert.strictEqual(ad.callbackFingerprint('https://API.x.example/cb/bob/'), 'cb:api.x.example/cb/bob');
    assert.strictEqual(ad.callbackKey('api.x.example/cb/bob'), ad.callbackKey('https://api.x.example/cb/bob'));
    assert.strictEqual(ad.callbackKey(''), '');
    const lr = read('functions/src/lnurlResolve.js');
    assert.ok(lr.indexOf('callbackKey: cbUrl.hostname.toLowerCase() + cbUrl.pathname + cbUrl.search') > 0);
});
test('M2: every payout path passes the resolved callback to reservePayout', () => {
    const idx = read('functions/index.js');
    assert.ok(idx.indexOf("lnCallbackKey = resolved.callbackKey || ''") > 0);
    assert.ok(idx.indexOf("address: lnNorm, callback: lnCallbackKey,") > 0);
    const g = read('functions/src/gifting.js');
    assert.ok(g.indexOf("out.callbackKey = resolved.callbackKey || ''") > 0);
    assert.ok(g.indexOf("_resolvePrizeInvoice('', payoutAddress, netAmount, winResolved)") > 0);
    assert.ok(g.indexOf("callback: winResolved.callbackKey || ''") > 0);
    assert.ok(g.indexOf("_resolvePrizeInvoice('', reserved.address, reserved.net, satsResolved)") > 0);
    assert.ok(g.indexOf("callback: g.callback || ''") > 0);
});
test('should-fix: claimCipherWin uses tombstone effectiveAgeDays like the other two paths', () => {
    const g = read('functions/src/gifting.js');
    const cw = g.indexOf('const claimCipherWin =');
    const win = g.slice(cw, g.indexOf('await db.runTransaction', cw));
    assert.ok(win.indexOf('accountTombstone.effectiveAgeDays(ageDays, looked.summary)') > 0);
});
test('10-minute wallet drain check: schedule, own SA, NWC secret only, never pays', () => {
    const idx = read('functions/index.js');
    const at = idx.indexOf('exports.payoutFloatWatch = onSchedule({');
    assert.ok(at > 0);
    const body = idx.slice(at, idx.indexOf('\n});', at));
    assert.ok(body.indexOf("schedule: 'every 10 minutes'") > 0);
    assert.ok(body.indexOf("serviceAccount: runtimeSa('payoutFloatWatch')") > 0);
    assert.ok(body.indexOf('secrets: [nwcUrlSecret]') > 0);
    assert.ok(body.indexOf('payInvoice') === -1);
    assert.ok(body.indexOf('antiDrain\').watchFloat(') > 0);
    assert.strictEqual(require('../functions/src/runtimeServiceAccounts').RUNTIME_SERVICE_ACCOUNTS.payoutFloatWatch.id, 'fn-payout-float-watch');
});
test('watchFloat: a drain outside our functions trips the hold + audit + one alert', async () => {
    const db = fakeDb({ 'payout_safety/float': { samples: [{ ms: T0, sats: 60000 }] } });
    const notes = [];
    const notify = async (_d, _a, n) => { notes.push(n); };
    const ok = await ad.watchFloat(db, {}, 58000, { nowMs: T0 + 10 * 60000, notify });
    assert.strictEqual(ok.trip, false);
    const res = await ad.watchFloat(db, {}, 54000, { nowMs: T0 + 20 * 60000, notify });
    assert.strictEqual(res.trip, true);
    assert.ok(db.store['payout_safety/hold'].satsHold > T0);
    const audits = Object.keys(db.store).filter(k => k.indexOf('payout_safety_audit/') === 0).map(k => db.store[k]);
    assert.strictEqual(audits.length, 1);
    assert.strictEqual(audits[0].source, 'float_watch');
    assert.strictEqual(notes.length, 1);
    // Already held: sample recorded, no second hold or alert.
    const again = await ad.watchFloat(db, {}, 50000, { nowMs: T0 + 30 * 60000, notify });
    assert.strictEqual(again.alreadyHeld, true);
    assert.strictEqual(notes.length, 1);
    assert.strictEqual(Object.keys(db.store).filter(k => k.indexOf('payout_safety_audit/') === 0).length, 1);
    // Unreadable balance records nothing.
    const before = JSON.stringify(db.store);
    assert.strictEqual((await ad.watchFloat(db, {}, -1, { nowMs: T0 + 40 * 60000, notify })).skipped, true);
    assert.strictEqual(JSON.stringify(db.store), before);
});
test('watchFloat: steady 10-minute samples with top-ups never trip', async () => {
    const db = fakeDb();
    const bals = [60000, 59000, 58200, 70000, 69000, 68000, 66000];
    for (let i = 0; i < bals.length; i++) {
        const r = await ad.watchFloat(db, {}, bals[i], { nowMs: T0 + i * 10 * 60000, notify: async () => {} });
        assert.strictEqual(r.trip, false, 'sample ' + i);
    }
});
test('Phil Nov 9 values', () => {
    assert.strictEqual(ad.MIN_PAYOUT_ACCOUNT_AGE_DAYS, 7);
    assert.strictEqual(ad.USER_MAX_PAYOUTS_PER_HOUR, 3);
    assert.strictEqual(ad.USER_MAX_PAYOUTS_PER_DAY, 6);
    assert.strictEqual(ad.WALLET_DAILY_CAP_SATS, 2500);
    assert.strictEqual(ad.FLOAT_DROP_SATS, 5000);
    assert.strictEqual(ad.FLOAT_DROP_WINDOW_MS, H);
});
test('unverified accounts keep earning: reward credit paths have no verified-email gate', () => {
    const g = read('functions/src/gifting.js');
    for (const fn of ['decryptCipher', 'ackCipherShare', 'openGift', 'awardDailyGifts']) {
        const at = g.indexOf('const ' + fn + ' = ');
        const body = g.slice(at, at + 1500);
        assert.ok(body.indexOf('assessIdentity') === -1 && body.indexOf('email_verified') === -1, fn);
    }
    assert.ok(ad.assessIdentity({ email: 'a@b.co', email_verified: false }, { email: 'a@b.co', emailVerified: false, providerData: [] }).reason === 'unverified');
});

(async () => {
    for (const p of pending) await p();
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
