// Faucet abuse rules. No Firebase, no wallet.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const guard = require('../functions/src/faucetGuard');

let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) {
    try {
        const out = fn();
        if (out && typeof out.then === 'function') {
            queue.push(out.then(function() {
                console.log('✅ ' + name);
                passed++;
            }, function(e) {
                console.log('❌ ' + name + ': ' + e.message);
                failed++;
            }));
            return;
        }
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

const COPY = guard.LN_LOCK_COPY;
const EMAIL = guard.SUPPORT_EMAIL;

test('claim and daily caps are 200 sats', function() {
    assert.strictEqual(guard.MAX_PER_CLAIM_SATS, 200);
    assert.strictEqual(guard.MAX_DAILY_PER_USER_SATS, 200);
    assert.strictEqual(guard.assessClaimAmount(200).ok, true);
    assert.strictEqual(guard.assessClaimAmount(201).ok, false);
    assert.strictEqual(guard.assessClaimAmount(100).amount, 100);
    assert.strictEqual(guard.assessClaimAmount(99).ok, false);
});

test('a lightning address is required and a raw invoice is ignored', function() {
    const missing = guard.requireLightningAddress({ invoice: 'lnbc1something' });
    assert.strictEqual(missing.ok, false);
    assert.ok(/Lightning Address is required/i.test(missing.error));
    const ok = guard.requireLightningAddress({
        invoice: 'lnbc1shouldbeignored',
        lightningAddress: '  You@WalletOfSatoshi.com ',
    });
    assert.strictEqual(ok.ok, true);
    assert.strictEqual(ok.address, 'you@walletofsatoshi.com');
    assert.strictEqual(ok.ignoredInvoice, true);
    assert.strictEqual(guard.requireLightningAddress({ lightningAddress: 'not-an-address' }).ok, false);
});

test('the first address locks and a second address is rejected', function() {
    const first = guard.assessAddressLock({
        callerUid: 'alice',
        requested: 'You@Wallet.com',
        saved: '',
        lockOwner: '',
    });
    assert.strictEqual(first.ok, true);
    assert.strictEqual(first.address, 'you@wallet.com');
    assert.strictEqual(first.createLock, true);

    const again = guard.assessAddressLock({
        callerUid: 'alice',
        requested: 'you@wallet.com',
        saved: 'you@wallet.com',
        lockOwner: 'alice',
    });
    assert.strictEqual(again.ok, true);
    assert.strictEqual(again.createLock, false);

    const changed = guard.assessAddressLock({
        callerUid: 'alice',
        requested: 'other@wallet.com',
        saved: 'you@wallet.com',
        lockOwner: 'alice',
    });
    assert.strictEqual(changed.ok, false);
    assert.strictEqual(changed.code, 'address_changed');
    assert.ok(changed.error.indexOf(EMAIL) !== -1);
});

test('an address locked to another uid is rejected and flagged, not auto-banned', function() {
    const conflict = guard.assessAddressLock({
        callerUid: 'bob',
        requested: 'you@wallet.com',
        saved: 'you@wallet.com',
        lockOwner: 'alice',
    });
    assert.strictEqual(conflict.ok, false);
    assert.strictEqual(conflict.code, 'address_conflict');
    assert.strictEqual(conflict.flag, true);
    assert.strictEqual(conflict.autoBan, undefined);
    assert.ok(conflict.error.indexOf(EMAIL) !== -1);
});

test('an address used by a banned account is rejected', function() {
    const byLock = guard.assessAddressLock({
        callerUid: 'bob',
        requested: 'you@wallet.com',
        saved: '',
        lockOwner: 'alice',
        lockOwnerBanned: true,
    });
    assert.strictEqual(byLock.ok, false);
    assert.strictEqual(byLock.flag, true);
    assert.ok(byLock.error.indexOf(EMAIL) !== -1);

    const byProfile = guard.assessAddressLock({
        callerUid: 'bob',
        requested: 'you@wallet.com',
        saved: '',
        lockOwner: '',
        otherBanned: true,
    });
    assert.strictEqual(byProfile.code, 'address_banned');
    assert.strictEqual(guard.assessBan({ satsDisabled: true }, {}).ok, false);
    assert.strictEqual(guard.assessBan({}, { banned: true }).ok, false);
    assert.strictEqual(guard.assessBan({ satsDisabled: false }, { banned: false }).ok, true);
});

test('a fingerprint tied to another account is abuse', function() {
    const fresh = guard.assessFingerprint([], 'alice');
    assert.strictEqual(fresh.ok, true);
    const same = guard.assessFingerprint(['alice'], 'alice');
    assert.strictEqual(same.ok, true);
    const other = guard.assessFingerprint(['alice'], 'bob');
    assert.strictEqual(other.ok, false);
    assert.strictEqual(other.log, 'FINGERPRINT ABUSE');
    assert.deepStrictEqual(other.others, ['alice']);
    assert.ok(other.error.indexOf(EMAIL) !== -1);
    const many = guard.assessFingerprint(['alice', 'carol'], 'bob');
    assert.strictEqual(many.ok, false);
    assert.strictEqual(guard.fingerprintDocId('abc_1234'), 'abc_1234');
    assert.strictEqual(guard.fingerprintDocId('short'), '');
});

test('IPv4 /24 and IPv6 /64 are keyed along with the exact IP', function() {
    const v4 = guard.networkKeys('203.0.113.44');
    assert.strictEqual(v4.exactId, '203_0_113_44');
    assert.strictEqual(v4.rangeId, '203_0_113_0_24');
    assert.strictEqual(v4.rangeLabel, '203.0.113.0/24');
    const v6 = guard.networkKeys('2001:db8:85a3::8a2e:370:7334');
    assert.strictEqual(v6.version, 6);
    assert.ok(v6.rangeId.indexOf('64') !== -1);
    assert.strictEqual(v6.rangeLabel, '2001:db8:85a3:0::/64');
    const mapped = guard.networkKeys('::ffff:203.0.113.9');
    assert.strictEqual(mapped.version, 4);
    assert.strictEqual(mapped.rangeId, '203_0_113_0_24');
    assert.strictEqual(guard.networkKeys('unknown'), null);
    assert.strictEqual(guard.networkKeys('203.0.113.08'), null);
});

test('a forged leftmost X-Forwarded-For is ignored', function() {
    const forged = guard.clientIpFromRequest({
        headers: { 'x-forwarded-for': '198.51.100.1, 203.0.113.44' },
        ip: '198.51.100.1',
        socket: { remoteAddress: '198.51.100.1' },
    });
    assert.strictEqual(forged, '203.0.113.44');
    assert.strictEqual(guard.networkKeys(forged).exactId, '203_0_113_44');
    const fallback = guard.clientIpFromRequest({
        headers: { 'x-forwarded-for': '   ' },
        ip: '1.2.3.4',
        socket: { remoteAddress: '::ffff:203.0.113.9' },
    });
    assert.strictEqual(fallback, '203.0.113.9');
    assert.strictEqual(guard.networkKeys(fallback).rangeId, '203_0_113_0_24');
});

test('subnet allows a later account after 24h, and the exact IP blocks a third recent account', function() {
    const now = 1_700_000_000_000;
    const recent = now - 60_000;
    const old = now - guard.NETWORK_ACCOUNT_WINDOW_MS - 5;
    const subnetBusy = guard.assessSubnetSlot({
        seen: { alice: recent },
        lastUid: 'alice',
        lastClaimMs: recent,
    }, 'bob', now);
    assert.strictEqual(subnetBusy.code, 'network_24h');
    assert.ok(subnetBusy.error.indexOf(EMAIL) !== -1);

    const subnetLater = guard.assessSubnetSlot({
        seen: { alice: now - guard.SUBNET_WINDOW_MS - 1, bob: now - guard.SUBNET_WINDOW_MS - 1, carol: now - guard.SUBNET_WINDOW_MS - 1 },
        lastUid: 'carol',
        lastClaimMs: now - guard.SUBNET_WINDOW_MS - 1,
    }, 'dave', now);
    assert.strictEqual(subnetLater.ok, true);
    assert.strictEqual(subnetLater.seen.dave, now);

    const staleSubnet = guard.assessSubnetSlot({
        seen: { alice: old, bob: old },
        uids: ['alice', 'bob', 'carol', 'dave', 'erin'],
        lastUid: 'erin',
        lastClaimMs: now - guard.SUBNET_WINDOW_MS - 5,
    }, 'frank', now);
    assert.strictEqual(staleSubnet.ok, true);
    assert.strictEqual(staleSubnet.seen.alice, undefined);

    const exactThird = guard.assessExactIpSlot({
        seen: { alice: recent, bob: recent },
        lastUid: 'bob',
        lastClaimMs: now - guard.SUBNET_WINDOW_MS - 5,
    }, 'carol', now);
    assert.strictEqual(exactThird.code, 'network_hard');
    assert.ok(exactThird.error.indexOf(EMAIL) !== -1);

    const exactStale = guard.assessExactIpSlot({
        seen: { alice: old, bob: old },
        lastUid: 'bob',
        lastClaimMs: now - guard.SUBNET_WINDOW_MS - 5,
    }, 'carol', now);
    assert.strictEqual(exactStale.ok, true);

    const sameUser = guard.assessExactIpSlot({
        seen: { alice: recent, bob: recent },
        lastUid: 'alice',
        lastClaimMs: recent,
    }, 'alice', now);
    assert.strictEqual(sameUser.ok, true);
});

test('per-address claim history is pruned inside the 24h window', function() {
    const now = 1_700_000_000_000;
    const old = { uid: 'alice', ts: now - guard.ADDRESS_WINDOW_MS - 10, amount: 100 };
    const recent = { uid: 'alice', ts: now - 1000, amount: 100 };
    const pruned = guard.pruneAddressClaims([old, recent, { ts: 'nope' }, null], now);
    assert.deepStrictEqual(pruned, [{ uid: 'alice', ts: recent.ts, amount: 100 }]);
    assert.strictEqual(guard.assessAddressRate([old, recent], now).ok, true);
    const blocked = guard.assessAddressRate([recent, { uid: 'alice', ts: now - 2000, amount: 150 }], now);
    assert.strictEqual(blocked.ok, false);
    assert.strictEqual(blocked.recent.length, 2);
});

test('balance errors and explicit refusals refund; timeouts are looked up', function() {
    const balance = guard.decideFaucetPayment({ phase: 'balance', error: new Error('[TIMEOUT] getBalance') });
    assert.strictEqual(balance.action, 'refund');
    assert.strictEqual(balance.reason, 'balance');

    const low = guard.decideFaucetPayment({ phase: 'balance', error: new Error('WALLET_LOW') });
    assert.strictEqual(low.action, 'refund');

    const refused = guard.decideFaucetPayment({ phase: 'pay', error: { code: 'PAYMENT_FAILED', message: 'no' } });
    assert.strictEqual(refused.action, 'refund');
    assert.strictEqual(refused.reason, 'refused');
    assert.strictEqual(guard.decideFaucetPayment({ phase: 'pay', error: new Error('INSUFFICIENT_BALANCE') }).action, 'refund');
    assert.strictEqual(guard.decideFaucetPayment({ phase: 'pay', error: new Error('QUOTA_EXCEEDED') }).action, 'refund');
    assert.strictEqual(guard.decideFaucetPayment({ phase: 'pay', error: new Error('RATE_LIMITED') }).action, 'refund');

    const timeout = guard.decideFaucetPayment({ phase: 'pay', error: new Error('[TIMEOUT] payInvoice timed out after 30000ms') });
    assert.strictEqual(timeout.action, 'lookup');
    const empty = guard.decideFaucetPayment({ phase: 'pay', error: new Error('NO_PREIMAGE'), payResult: {} });
    assert.strictEqual(empty.action, 'lookup');

    const paid = guard.decideFaucetPayment({ phase: 'pay', payResult: { preimage: 'abc' } });
    assert.deepStrictEqual(paid, { action: 'record', preimage: 'abc' });
});

test('only an explicit failed lookup refunds; settled records; anything else stays unknown', function() {
    assert.deepStrictEqual(guard.decideFaucetLookupResult({ action: 'paid', preimage: 'dead' }), { action: 'record', preimage: 'dead' });
    assert.deepStrictEqual(guard.decideFaucetLookupResult({ action: 'release' }), { action: 'refund', reason: 'lookup_failed' });
    assert.deepStrictEqual(guard.decideFaucetLookupResult({ action: 'hold' }), { action: 'unknown' });
    assert.deepStrictEqual(guard.decideFaucetLookupResult(null), { action: 'unknown' });
});

test('lookupInvoice retries and a settled lookup is a normal payment', async function() {
    let calls = 0;
    const settlement = await guard.lookupSettlement({
        attempts: 3,
        intervalMs: 0,
        sleep: function() { return Promise.resolve(); },
        lookup: function() {
            calls++;
            if (calls < 2) return Promise.resolve({ state: 'pending', payment_hash: 'hh' });
            return Promise.resolve({ state: 'settled', preimage: 'beef' });
        },
    });
    assert.strictEqual(calls, 2);
    assert.deepStrictEqual(guard.decideFaucetLookupResult(settlement), { action: 'record', preimage: 'beef' });

    const failed = await guard.lookupSettlement({
        attempts: 2,
        intervalMs: 0,
        sleep: function() { return Promise.resolve(); },
        lookup: function() { return Promise.resolve({ state: 'failed' }); },
    });
    assert.strictEqual(guard.decideFaucetLookupResult(failed).action, 'refund');

    const unknown = await guard.lookupSettlement({
        attempts: 2,
        intervalMs: 0,
        sleep: function() { return Promise.resolve(); },
        lookup: function() { return Promise.reject(new Error('[TIMEOUT] lookupInvoice')); },
    });
    assert.strictEqual(guard.decideFaucetLookupResult(unknown).action, 'unknown');
});

test('the daily report clusters shared signals and never includes emails', function() {
    const now = 1_700_000_000_000;
    const report = guard.buildAbuseReport({
        now: now,
        claims: [
            { uid: 'a', username: 'Alice', email: 'alice@secret.test', fingerprint: 'fp1', subnet: '203_0_113_0_24', lightningAddress: 'Alice@Wallet.com', at: now - 1000 },
            { uid: 'b', displayName: 'bob@secret.test', email: 'bob@secret.test', fingerprint: 'fp1', subnet: '203_0_113_0_24', lightningAddress: 'other@wallet.com', at: now - 2000 },
        ],
        signups: [
            { uid: 'c', username: 'Cara', email: 'cara@secret.test', lightningAddress: 'shared@wallet.com', at: now - 3000 },
        ],
        bannedAccounts: [
            { uid: 'banned1', username: 'BannedBen', email: 'ben@secret.test', lightningAddress: 'shared@wallet.com', fingerprint: 'fp9' },
        ],
        unknownPayments: [
            { uid: 'a', username: 'Alice', email: 'alice@secret.test', amount: 150, paymentHash: 'hh', at: now - 500 },
        ],
        addressConflicts: [
            { uid: 'b', username: 'Bob', email: 'bob@secret.test', otherUid: 'a', otherDisplayName: 'Alice', address: 'You@Wallet.com', at: now - 400 },
        ],
    });
    assert.ok(report.clusters.some(function(c) { return c.kind === 'fingerprint' && c.key === 'fp1' && c.accounts.length === 2; }));
    assert.ok(report.clusters.some(function(c) { return c.kind === 'subnet' && c.bannedLink === false; }));
    const ln = report.clusters.filter(function(c) { return c.kind === 'lightning' && c.key === 'shared@wallet.com'; })[0];
    assert.ok(ln);
    assert.strictEqual(ln.bannedLink, true);
    assert.ok(ln.accounts.some(function(a) { return a.uid === 'banned1' && a.displayName === 'BannedBen'; }));
    assert.ok(ln.accounts.some(function(a) { return a.uid === 'c' && a.displayName === 'Cara'; }));
    assert.strictEqual(report.unknownPayments.length, 1);
    assert.strictEqual(report.unknownPayments[0].displayName, 'Alice');
    assert.strictEqual(report.addressConflicts[0].address, 'you@wallet.com');
    assert.strictEqual(report.clusters.filter(function(c) { return c.kind === 'fingerprint'; })[0].accounts.filter(function(a) { return a.uid === 'b'; })[0].displayName, 'Bitcoiner');
    const dumped = JSON.stringify(report);
    assert.ok(dumped.indexOf('secret.test') === -1);
    assert.ok(dumped.indexOf('"email"') === -1);
    assert.ok(report.counts.unknownPayments === 1);
    assert.ok(report.counts.addressConflicts === 1);
});

test('old claims and signups outside 48h stay out of the report', function() {
    const now = 1_700_000_000_000;
    const report = guard.buildAbuseReport({
        now: now,
        claims: [
            { uid: 'a', username: 'Alice', fingerprint: 'fp1', at: now - guard.REPORT_WINDOW_MS - 10 },
            { uid: 'b', username: 'Bob', fingerprint: 'fp1', at: now - guard.REPORT_WINDOW_MS - 20 },
        ],
        unknownPayments: [
            { uid: 'a', username: 'Alice', amount: 100, at: now - guard.REPORT_WINDOW_MS - 5 },
        ],
    });
    assert.strictEqual(report.clusters.length, 0);
    assert.strictEqual(report.unknownPayments.length, 0);
});

test('claimSats enforces App Check, drops invoices, and bans before network lookups', function() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    // claimSats, registerReferral, approveHouseholdDevice, and the four PvP callables.
    assert.strictEqual((src.match(/enforceAppCheck:\s*true/g) || []).length, 7);
    ['pvpSubmitAnswer', 'pvpTimeoutOpponent', 'pvpStoreAnswerKey', 'pvpCreateMatch'].forEach(function (name) {
        const at = src.indexOf('exports.' + name);
        assert.ok(at > 0, name);
        assert.ok(src.slice(at, at + 160).indexOf('enforceAppCheck: true') !== -1, name);
    });
    const start = src.indexOf('exports.claimSats');
    const end = src.indexOf('function _withTimeout');
    assert.ok(start > 0 && end > start);
    const body = src.slice(start, end);
    assert.ok(body.indexOf('enforceAppCheck: true') !== -1);
    assert.ok(body.indexOf('data.invoice') === -1);
    assert.ok(body.indexOf('FINGERPRINT ABUSE') !== -1);
    const banAt = body.indexOf('assessBan');
    const netAt = body.indexOf('assertPublicHost');
    assert.ok(banAt > 0 && netAt > banAt);
    assert.ok(body.indexOf('clientIpFromRequest') !== -1);
    assert.ok(body.indexOf('rawRequest.ip') === -1);
    assert.ok(body.indexOf('assessExactIpSlot') !== -1);
    assert.ok(body.indexOf('assessSubnetSlot') !== -1);
    assert.ok(body.indexOf('assessNetworkSlot') === -1);
    assert.ok(body.indexOf('timeoutSeconds: 300') !== -1);
    assert.ok(src.indexOf('exports.banReportedFaucetUser') !== -1);
    assert.ok(src.indexOf('context.auth.token.admin !== true') !== -1);
    assert.ok(src.indexOf("schedule: '0 13 * * *'") !== -1);
    assert.ok(src.indexOf('exports.dailyFaucetAbuseReport') !== -1);
    assert.ok(src.indexOf('hashForFavor') === -1 || src.indexOf('enforceAppCheck') < src.indexOf('hashForFavor') || src.slice(src.indexOf('hashForFavor') - 200, src.indexOf('hashForFavor')).indexOf('enforceAppCheck') === -1);
});

test('the lock copy is the sentence shown before an address is saved', function() {
    assert.strictEqual(COPY, 'You can only add one lightning address to your account, and it can\'t be changed later. If you ever need to change it, email support at info.603btc@gmail.com.');
    const ranking = fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const lightning = fs.readFileSync(path.join(__dirname, '..', 'lightning.js'), 'utf8');
    const count = ranking.split(COPY).length - 1;
    assert.ok(count >= 2, 'faucet UI should show the lock copy when adding and when locked');
    assert.ok(html.indexOf(COPY) !== -1);
    assert.ok(lightning.indexOf(COPY) !== -1);
    assert.ok(lightning.indexOf('permission-denied') !== -1);
    assert.ok(ranking.indexOf('firebase.appCheck') !== -1);
    assert.ok(ranking.indexOf('6Le37votAAAAAD3n0_u1uPxgcvm4XtmOEeK1Ti9j') !== -1);
    assert.ok(ranking.indexOf('6LcTlnYsAAAAAMR0KkaRoCrIlvceClMGkWXr9ahv') === -1);
    const activateAt = ranking.indexOf('firebase.appCheck().activate');
    const tokenAt = ranking.indexOf('firebase.appCheck().getToken');
    const claimAt = ranking.indexOf("httpsCallable('claimSats')");
    assert.strictEqual((ranking.match(/firebase\.appCheck\(\)\.activate/g) || []).length, 1);
    assert.ok(activateAt > 0 && tokenAt > activateAt && claimAt > tokenAt);
    const worker = fs.readFileSync(path.join(__dirname, '..', 'workers', 'seo-router', 'worker.js'), 'utf8');
    const workerScript = worker.indexOf('script-src');
    const workerConnect = worker.indexOf('connect-src');
    const workerFrame = worker.indexOf('frame-src');
    assert.ok(workerScript > 0 && workerConnect > workerScript && workerFrame > workerConnect);
    const scriptPolicy = worker.slice(workerScript, workerConnect);
    const connectPolicy = worker.slice(workerConnect, workerFrame);
    const framePolicy = worker.slice(workerFrame, worker.indexOf('font-src'));
    assert.ok(scriptPolicy.indexOf('https://www.google.com') !== -1);
    assert.ok(scriptPolicy.indexOf('https://www.gstatic.com') !== -1);
    assert.ok(connectPolicy.indexOf('https://www.gstatic.com') !== -1);
    assert.ok(connectPolicy.indexOf('https://*.google.com') !== -1);
    assert.ok(framePolicy.indexOf('https://www.google.com') !== -1);
    assert.ok(ranking.indexOf('banReportedFaucetUser') !== -1);
    assert.ok(ranking.indexOf('btc_admin_http_token') === -1);
    assert.ok(ranking.indexOf('satsClaimInvoice') === -1);
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    assert.ok(rules.indexOf('function lightningLockOk()') !== -1);
    assert.ok(rules.indexOf('lnAddress') !== -1);
    assert.ok(rules.indexOf('&& lightningLockOk()') !== -1);
    assert.ok(rules.indexOf('match /lightning_addresses/{addrId}') !== -1);
    assert.ok(rules.indexOf('resource.data.uid == request.auth.uid') !== -1);
    assert.ok(rules.indexOf('match /faucet_abuse_reports/{docId}') !== -1);
    assert.ok(rules.indexOf('match /faucet_subnet_log/{docId}') !== -1);
    assert.ok(rules.indexOf('match /faucet_uid_signals/{docId}') !== -1);
    assert.ok(rules.indexOf('match /faucet_admin_flags/{docId}') !== -1);
    const hosting = fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8');
    assert.ok(hosting.indexOf('https://www.google.com') !== -1);
    assert.ok(hosting.indexOf('https://www.recaptcha.net') !== -1);
});

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
