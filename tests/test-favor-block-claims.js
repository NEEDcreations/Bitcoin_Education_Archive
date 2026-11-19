'use strict';
// Satoshi's Favor per-block self-claim (#245 rework, Nov 14 2026).
// Only the archived winner of a block can claim it, once, to the address
// frozen at close, inside the caps and the kill switch.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const core = require(path.join(root, 'functions/src/favorBlockClaims.js'));
const { shouldLookupPay, lookupSettlement } = require(path.join(root, 'functions/src/cipherClaim.js'));

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name: name, fn: fn }); }

// ---------- in-memory Firestore with serialized transactions ----------
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function makeDb() {
    const store = new Map();
    const writes = [];
    let auto = 0;
    let lock = Promise.resolve();
    function apply(k, data, opts) {
        const cur = store.get(k);
        const incoming = clone(data);
        store.set(k, opts && opts.merge && cur ? Object.assign({}, cur, incoming) : incoming);
        writes.push(k);
    }
    function snap(k, id) {
        const v = store.get(k);
        return { id: id, exists: v !== undefined, data: function () { return clone(v); } };
    }
    function docRef(col, id) {
        const k = col + '/' + id;
        return {
            id: id, _k: k,
            async get() { return snap(k, id); },
            async set(d, o) { apply(k, d, o); },
            async create(d) { if (store.has(k)) { const e = new Error('ALREADY_EXISTS'); e.code = 6; throw e; } apply(k, d); },
            async update(d) { if (!store.has(k)) throw new Error('NOT_FOUND'); apply(k, d, { merge: true }); },
        };
    }
    function collection(col) {
        return {
            doc: function (id) { return docRef(col, id); },
            add: async function (d) { const id = 'auto' + (++auto); apply(col + '/' + id, d); return docRef(col, id); },
            get: async function () {
                const docs = [];
                store.forEach(function (v, k) {
                    if (k.indexOf(col + '/') !== 0) return;
                    const id = k.slice(col.length + 1);
                    if (id.indexOf('/') === -1) docs.push(snap(k, id));
                });
                return { docs: docs, empty: !docs.length, size: docs.length };
            },
            where: function (field, op, val) {
                return {
                    limit: function () { return this; },
                    get: async function () {
                        const docs = [];
                        store.forEach(function (v, k) {
                            if (k.indexOf(col + '/') !== 0) return;
                            const id = k.slice(col.length + 1);
                            if (id.indexOf('/') !== -1) return;
                            if (op === '==' && v[field] === val) docs.push(snap(k, id));
                        });
                        return { docs: docs, empty: !docs.length, size: docs.length };
                    },
                };
            },
        };
    }
    async function runTransaction(fn) {
        let release;
        const prev = lock;
        lock = new Promise(function (r) { release = r; });
        await prev;
        const buf = [];
        const tx = {
            get: async function (ref) { return snap(ref._k, ref.id); },
            set: function (ref, d, o) { buf.push(['set', ref._k, d, o]); },
            update: function (ref, d) { buf.push(['set', ref._k, d, { merge: true }]); },
            create: function (ref, d) { buf.push(['create', ref._k, d]); },
        };
        try {
            const out = await fn(tx);
            buf.forEach(function (w) {
                if (w[0] === 'create' && store.has(w[1])) throw new Error('ALREADY_EXISTS');
            });
            buf.forEach(function (w) { apply(w[1], w[2], w[3]); });
            return out;
        } finally { release(); }
    }
    return { store: store, writes: writes, collection: collection, runTransaction: runTransaction };
}

// ---------- fixtures ----------
const ALICE = 'aliceUid000001';   // epoch 1 blocks 0,1,2
const BOB = 'bobUid00000002';     // epoch 1 block 3
const CARA = 'caraUid0000003';    // epoch 1 block 4
const MALLORY = 'malloryUid0099'; // never won
const CLOSED_MS = Date.UTC(2026, 9, 23, 13, 48);

function history(epoch, uids, extra) {
    return Object.assign({
        epochNumber: epoch,
        blocks: uids.map(function (u, i) { return { uid: u, username: 'p' + i, value: 'x', foundAt: { seconds: CLOSED_MS / 1000 - 3600 + i } }; }),
        completedAt: { seconds: CLOSED_MS / 1000 },
        totalSats: 21000,
    }, extra || {});
}

function seed(db, opts) {
    const o = opts || {};
    db.store.set('sfPoolHistory/h1', history(1, [ALICE, ALICE, ALICE, BOB, CARA]));
    for (let e = 2; e <= (o.epochs || 1); e++) db.store.set('sfPoolHistory/h' + e, history(e, [BOB, CARA, ALICE, BOB, CARA]));
    if (o.openEpoch) db.store.set('satoshiFavor/poolEpoch', { epochNumber: o.openEpoch, blocks: [{ uid: ALICE }] });
    db.store.set('users/' + ALICE, { lightningAddress: 'alice@wallet.example' });
    db.store.set('users/' + BOB, { lightningAddress: 'bob@wallet.example' });
    db.store.set('users/' + CARA, { lightningAddress: o.caraLn || 'cara@wallet.example' });
    db.store.set('users/' + MALLORY, { lightningAddress: 'mallory@evil.example' });
    // Address locks made before the close (first save), unless a test says otherwise.
    [[ALICE, 'alice@wallet.example'], [BOB, 'bob@wallet.example'], [CARA, o.caraLn || 'cara@wallet.example'], [MALLORY, 'mallory@evil.example']].forEach(function (p) {
        if (o.noLocks) return;
        if (!db.store.has('lightning_addresses/' + p[1])) db.store.set('lightning_addresses/' + p[1], { uid: p[0], address: p[1], lockedAt: { seconds: CLOSED_MS / 1000 - 86400 } });
    });
    db.store.set('config/satoshiFavorPayouts', Object.assign({ claimsEnabled: true, enabledEpochs: [1] }, o.config || {}));
}

const OWN_NODE = '02' + 'cd'.repeat(32);
const PAYEE = '03' + 'ef'.repeat(32);

function makeHarness(opts) {
    const o = opts || {};
    const db = makeDb();
    seed(db, o);
    const h = {
        db: db,
        clock: o.nowMs || Date.UTC(2026, 10, 14, 17, 0),
        offline: false,
        gate: function () { return { ok: true }; },
        stepUpThrows: false,
        recent: true,
        balanceSats: o.balanceSats == null ? 1000000 : o.balanceSats,
        payMode: 'paid',
        lookupState: 'pending',
        invoiceMutator: null,
        pays: [],
        alerts: [],
        statusAtPay: [],
        infoMode: 'ok',        // 'ok' | 'throw' | 'null'
        ownPubkey: OWN_NODE,   // '' = hidden pubkey (live Alby Hub)
        balanceThrows: false,
        warns: [],
    };
    h.deps = {
        db: db,
        nowMs: function () { return h.clock; },
        isOffline: async function () { return h.offline; },
        accountGate: async function (uid) { return h.gate(uid); },
        stepUp: async function () { if (h.stepUpThrows) throw new Error('Enter a fresh authenticator code'); },
        recentSignIn: function () { return h.recent; },
        wallet: function () {
            return {
                getBalance: async function () { if (h.balanceThrows) throw new Error('[TIMEOUT] getBalance'); return { balance: h.balanceSats * 1000 }; },
                getInfo: async function () {
                    if (h.infoMode === 'throw') throw new Error('[TIMEOUT] getInfo');
                    if (h.infoMode === 'null') return null;
                    return { pubkey: h.ownPubkey };
                },
                payInvoice: async function (req) {
                    const cid = Array.from(db.store.keys()).filter(function (k) { return k.indexOf('sf_block_claims/') === 0; })
                        .map(function (k) { return db.store.get(k); }).filter(function (c) { return c.status === 'paying'; });
                    h.statusAtPay.push(cid.length);
                    h.pays.push(req.invoice);
                    if (h.payMode === 'refuse') { const e = new Error('PAYMENT_FAILED'); e.code = 'PAYMENT_FAILED'; throw e; }
                    if (h.payMode === 'refuse_text') throw new Error('PAYMENT_FAILED'); // message only, no code
                    if (h.payMode === 'timeout') throw new Error('[TIMEOUT] payInvoice');
                    return { preimage: crypto.randomBytes(32).toString('hex'), fees_paid: h.routingFeeMsat || 0 };
                },
                lookupInvoice: async function () { h.lookups = (h.lookups || 0) + 1; return { state: h.lookupState }; },
            };
        },
        resolveInvoice: async function (ln, sats) {
            h.lastResolve = { ln: ln, sats: sats };
            return 'lnbc' + sats + 'n1fake' + crypto.randomBytes(8).toString('hex');
        },
        decodeInvoice: function (bolt) {
            const m = /^lnbc(\d+)n1/.exec(bolt);
            const d = {
                millisatoshis: String(Number(m[1]) * 1000),
                timeExpireDate: Math.floor(h.clock / 1000) + 600,
                payeeNodeKey: PAYEE,
                tags: [{ tagName: 'payment_hash', data: crypto.createHash('sha256').update(bolt).digest('hex') }],
            };
            return h.invoiceMutator ? h.invoiceMutator(d) : d;
        },
        shouldLookupPay: shouldLookupPay,
        lookupSettlement: lookupSettlement,
        classifyLookup: require(path.join(root, 'functions/src/cipherClaim.js')).classifyLookup,
        lookupIntervalMs: 0,
        notifyAdmin: async function (text) { h.alerts.push(text); },
        logWarn: function (msg, data) { h.warns.push({ msg: msg, data: data }); },
    };
    h.svc = core.createBlockClaimService(h.deps);
    return h;
}

function ctx(uid, provider) {
    if (!uid) return { auth: null };
    return { auth: { uid: uid, token: { firebase: { sign_in_provider: provider || 'password' }, auth_time: 1 } } };
}
async function freeze(h, epoch) {
    const r = await h.svc.freezeEpoch(epoch, { source: 'backfill' });
    assert.ok(r.ok, 'freeze ' + epoch + ' ' + JSON.stringify(r));
    return r;
}
function keys(h, prefix) { return Array.from(h.db.store.keys()).filter(function (k) { return k.indexOf(prefix) === 0; }); }
function audits(h) { return keys(h, 'sf_claim_audit/').map(function (k) { return h.db.store.get(k); }); }

// ---------- pure helpers ----------
test('ids: only plain small integers; forged, padded, negative and junk ids refused', function () {
    assert.deepStrictEqual(core.parseClaimIds({ epoch: 1, block: 0 }), { epoch: 1, block: 0 });
    assert.deepStrictEqual(core.parseClaimIds({ epoch: '1', block: '4' }), { epoch: 1, block: 4 });
    const bad = [
        { epoch: 'epoch_9001', block: 0 }, { epoch: 9001 * 10, block: 0 }, { epoch: -1, block: 0 }, { epoch: 0, block: 0 },
        { epoch: 1, block: -1 }, { epoch: 1, block: 5 }, { epoch: 1.5, block: 0 }, { epoch: '01', block: 0 },
        { epoch: ' 1', block: 0 }, { epoch: '1 ', block: 0 }, { epoch: '1e0', block: 0 }, { epoch: '+1', block: 0 },
        { epoch: 1, block: '0 ' }, { epoch: [1], block: 0 }, { epoch: { n: 1 }, block: 0 }, { epoch: true, block: 0 },
        { epoch: NaN, block: 0 }, { epoch: Infinity, block: 0 }, null, [], 'e1_b0',
    ];
    bad.forEach(function (b) { assert.strictEqual(core.parseClaimIds(b), null, JSON.stringify(b)); });
});

test('derive: needs exactly one closed archived epoch with 5 winner blocks', function () {
    const ok = core.deriveEpochBlocks([{ id: 'h', data: history(1, [ALICE, ALICE, ALICE, BOB, CARA]) }], 1);
    assert.ok(ok.ok);
    assert.deepStrictEqual(ok.rows.map(function (r) { return r.amount; }), [4200, 4200, 4200, 4200, 4200]);
    assert.strictEqual(core.deriveEpochBlocks([], 1).reason, 'no_history');
    const dup = [{ id: 'a', data: history(1, [ALICE, ALICE, ALICE, BOB, CARA]) }, { id: 'b', data: history(1, [MALLORY, MALLORY, MALLORY, MALLORY, MALLORY]) }];
    assert.strictEqual(core.deriveEpochBlocks(dup, 1).reason, 'duplicate_history');
    assert.strictEqual(core.deriveEpochBlocks([{ id: 'h', data: history(1, [ALICE, BOB]) }], 1).reason, 'not_closed');
    assert.strictEqual(core.deriveEpochBlocks([{ id: 'h', data: history(1, [ALICE, ALICE, ALICE, BOB, ''] ) }], 1).reason, 'bad_block');
    assert.strictEqual(core.deriveEpochBlocks([{ id: 'h', data: history(1, [ALICE, ALICE, ALICE, BOB, CARA], { totalSats: 99999 }) }], 1).reason, 'pot_mismatch');
});

test('invoice: exact amount, not zero-amount, not expired, mainnet, not our own node', function () {
    const now = 1000000;
    const good = { millisatoshis: '4190000', timeExpireDate: now + 60, payeeNodeKey: PAYEE, tags: [{ tagName: 'payment_hash', data: 'aa' }] };
    assert.ok(core.validateInvoice('lnbc41900n1x', good, 4190, now, OWN_NODE).ok);
    assert.strictEqual(core.validateInvoice('lnbc1x', Object.assign({}, good, { millisatoshis: null }), 4190, now, OWN_NODE).reason, 'zero_amount');
    assert.strictEqual(core.validateInvoice('lnbc1x', Object.assign({}, good, { millisatoshis: '4200000' }), 4190, now, OWN_NODE).reason, 'amount_mismatch');
    assert.strictEqual(core.validateInvoice('lnbc1x', Object.assign({}, good, { millisatoshis: '9999999000' }), 4190, now, OWN_NODE).reason, 'amount_mismatch');
    assert.strictEqual(core.validateInvoice('lnbc1x', Object.assign({}, good, { timeExpireDate: now - 1 }), 4190, now, OWN_NODE).reason, 'expired');
    assert.strictEqual(core.validateInvoice('lnbc1x', Object.assign({}, good, { payeeNodeKey: OWN_NODE }), 4190, now, OWN_NODE).reason, 'own_node');
    assert.strictEqual(core.validateInvoice('lntb1x', good, 4190, now, OWN_NODE).reason, 'wrong_network');
    assert.strictEqual(core.validateInvoice('lnbcrt1x', good, 4190, now, OWN_NODE).reason, 'wrong_network');
});

test('config: per-claim cap can never exceed 5,000; default is claims OFF with only epoch 1 enabled', function () {
    const d = core.readConfig({});
    assert.strictEqual(d.claimsEnabled, false);
    assert.deepStrictEqual(d.enabledEpochs, [1]);
    assert.strictEqual(core.readConfig({ perClaimCapSats: 50000 }).perClaimCapSats, 5000);
    assert.strictEqual(core.readConfig({ perClaimCapSats: 0 }).perClaimCapSats, 5000);
});

// ---------- the winner check ----------
test('happy path: the real winner gets one 4,200 block, paid to the frozen address', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.ok(r.success, JSON.stringify(r));
    assert.strictEqual(r.amount, 4200);
    assert.strictEqual(r.sent, 4190);
    assert.deepStrictEqual(h.lastResolve, { ln: 'bob@wallet.example', sats: 4190 });
    assert.strictEqual(h.pays.length, 1);
    const payout = h.db.store.get('sf_block_payouts/e1_b3');
    assert.ok(payout && payout.paymentHash && payout.uidMasked === 'bobUi\u2026' && payout.frozenLn === 'bob@wallet.example');
    assert.ok(!('uid' in payout), 'permanent payout record keeps a masked uid only');
    assert.ok(audits(h).some(function (a) { return a.type === 'paid' && a.epoch === 1 && a.block === 3; }));
});

test('non-winner is refused, nothing written to claims, nothing paid, audit row kept', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    const r = await h.svc.claim(ctx(MALLORY), { epoch: 1, block: 0 });
    assert.strictEqual(r.code, 'not_winner');
    assert.strictEqual(h.pays.length, 0);
    assert.strictEqual(keys(h, 'sf_block_claims/').length, 0);
    assert.ok(audits(h).some(function (a) { return a.code === 'not_winner'; }));
});

test('signed-out and anonymous callers are refused', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    assert.strictEqual((await h.svc.claim(ctx(null), { epoch: 1, block: 3 })).code, 'unauthenticated');
    assert.strictEqual((await h.svc.claim(ctx(BOB, 'anonymous'), { epoch: 1, block: 3 })).code, 'unauthenticated');
    assert.strictEqual(h.pays.length, 0);
});

test('a winner cannot claim someone else\'s block, even naming their own uid/amount/address in the request', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 0, uid: BOB, amount: 4200, lightningAddress: 'bob@wallet.example', invoice: 'lnbc1forged' });
    assert.strictEqual(r.code, 'not_winner');
    const r2 = await h.svc.claim(ctx(MALLORY), { epoch: 1, block: 3, uid: BOB, winnerUid: BOB });
    assert.strictEqual(r2.code, 'not_winner');
    assert.strictEqual(h.pays.length, 0);
});

test('client-sent amount and address are ignored on a real claim', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    const r = await h.svc.claim(ctx(CARA), { epoch: 1, block: 4, amount: 999999, lightningAddress: 'mallory@evil.example' });
    assert.ok(r.success);
    assert.strictEqual(r.amount, 4200);
    assert.strictEqual(h.lastResolve.ln, 'cara@wallet.example');
});

test('forged epoch/block ids and open or unarchived epochs are refused', async function () {
    const h = makeHarness({ openEpoch: 9, config: { enabledEpochs: [1, 9, 9001] } });
    await freeze(h, 1);
    assert.strictEqual((await h.svc.claim(ctx(ALICE), { epoch: 'epoch_9001', block: 0 })).code, 'bad_id');
    assert.strictEqual((await h.svc.claim(ctx(ALICE), { epoch: 9001, block: 0 })).code, 'epoch_not_ready');
    assert.strictEqual((await h.svc.claim(ctx(ALICE), { epoch: 9, block: 0 })).code, 'epoch_not_ready', 'open epoch has no archived result');
    assert.strictEqual((await h.svc.claim(ctx(ALICE), { epoch: -1, block: 0 })).code, 'bad_id');
    assert.strictEqual((await h.svc.claim(ctx(ALICE), { epoch: ' 1', block: 0 })).code, 'bad_id');
    assert.strictEqual((await h.svc.claim(ctx(ALICE), { epoch: 1, block: 5 })).code, 'bad_id');
    assert.strictEqual(h.pays.length, 0);
});

test('a tampered result doc that disagrees with sfPoolHistory is refused and alerts an admin', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    const res = h.db.store.get('sf_payout_results/epoch_1');
    res.blocks[0].uid = MALLORY;
    h.db.store.set('sf_payout_results/epoch_1', res);
    const r = await h.svc.claim(ctx(MALLORY), { epoch: 1, block: 0 });
    assert.strictEqual(r.code, 'history_mismatch');
    assert.ok(h.alerts.length >= 1);
    assert.strictEqual(h.pays.length, 0);
});

test('a second sfPoolHistory doc for the same epoch (injected winner) fails closed', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.db.store.set('sfPoolHistory/evil', history(1, [MALLORY, MALLORY, MALLORY, MALLORY, MALLORY]));
    assert.strictEqual((await h.svc.claim(ctx(MALLORY), { epoch: 1, block: 0 })).code, 'history_mismatch');
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'history_mismatch');
});

// ---------- double claims ----------
test('double claim: sequential repeat is refused; one payment, one payout record', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    assert.ok((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).success);
    h.clock += 120000;
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'already_paid');
    assert.strictEqual(h.pays.length, 1);
    assert.strictEqual(keys(h, 'sf_block_payouts/').length, 1);
});

test('double claim: five parallel claims of one block pay exactly once', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    const rs = await Promise.all([0, 1, 2, 3, 4].map(function () { return h.svc.claim(ctx(BOB), { epoch: 1, block: 3 }); }));
    assert.strictEqual(rs.filter(function (r) { return r.success; }).length, 1);
    assert.strictEqual(h.pays.length, 1);
});

test('multiple blocks in one epoch are separate claims, each paid once', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    for (const b of [0, 1, 2]) {
        const r = await h.svc.claim(ctx(ALICE), { epoch: 1, block: b });
        assert.ok(r.success, 'block ' + b + ' ' + JSON.stringify(r));
    }
    assert.strictEqual(h.pays.length, 3);
    assert.deepStrictEqual(keys(h, 'sf_block_payouts/').sort(), ['sf_block_payouts/e1_b0', 'sf_block_payouts/e1_b1', 'sf_block_payouts/e1_b2']);
});

test('claim is marked paying in the database before the wallet is called', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.deepStrictEqual(h.statusAtPay, [1]);
});

// ---------- switches ----------
test('disabled epoch: epoch 2 refused while only epoch 1 is enabled', async function () {
    const h = makeHarness({ epochs: 2 });
    await freeze(h, 1); await freeze(h, 2);
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 2, block: 0 })).code, 'epoch_disabled');
    assert.strictEqual(h.pays.length, 0);
});

test('global off switch refuses every claim', async function () {
    const h = makeHarness({ config: { claimsEnabled: false } });
    await freeze(h, 1);
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'claims_off');
});

test('kill switch on refuses; the same claim succeeds after it is off (no expiry, nothing voided)', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.offline = true;
    const r1 = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.strictEqual(r1.code, 'offline');
    assert.strictEqual(h.pays.length, 0);
    assert.strictEqual(keys(h, 'sf_block_claims/').length, 0, 'an offline refusal leaves the block untouched');
    const mine = await h.svc.listMine(ctx(BOB), { epochNumbers: [1] });
    assert.strictEqual(mine.claims[0].status, 'not_open');
    h.offline = false;
    h.clock += 420 * 24 * 3600 * 1000; // through the offline months to the 2027 relaunch
    const r2 = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.ok(r2.success, JSON.stringify(r2));
});

test('kill switch reader failure fails closed', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.svc = core.createBlockClaimService(Object.assign({}, { db: h.db, isOffline: async function () { throw new Error('unreadable'); } }));
    const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.strictEqual(r.success, false);
});

// ---------- account state ----------
test('banned, deleted and merged accounts are refused by the account gate', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    for (const code of ['banned', 'deleted', 'merged', 'disabled', 'hold']) {
        h.gate = function () { return { ok: false, code: code }; };
        const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
        assert.strictEqual(r.code, 'account_blocked', code);
    }
    assert.strictEqual(h.pays.length, 0);
});

test('payout-gate 48h hold returns address_hold and pays nothing', async function () {
    const faucetGuard = require(path.join(root, 'functions/src/faucetGuard.js'));
    const h = makeHarness();
    await freeze(h, 1);
    h.gate = function () { return { ok: false, code: 'address_hold' }; };
    const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.code, 'address_hold');
    assert.strictEqual(r.error, faucetGuard.ADDRESS_CHANGE_HOLD_ERROR);
    assert.strictEqual(h.pays.length, 0);
    assert.strictEqual(keys(h, 'sf_block_claims/').length, 0);
    assert.strictEqual(keys(h, 'sf_block_payouts/').length, 0);
});

test('L1: the 48h address-change hold is re-checked inside the reserve transaction', async function () {
    const HOLD = 48 * 60 * 60 * 1000;
    const h = makeHarness();
    await freeze(h, 1);
    // A reset stamp written after beginPayout's gate (gate stubbed ok here).
    h.db.store.set('users/' + BOB, { lightningAddress: 'bob@wallet.example', lightningAddressChangedAt: h.clock - 60000 });
    const held = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.strictEqual(held.success, false);
    assert.strictEqual(held.code, 'address_hold');
    assert.strictEqual(h.pays.length, 0);
    h.db.store.set('users/' + BOB, { lightningAddress: 'bob@wallet.example', lightningAddressChangedAt: 'garbage' });
    const bad = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.strictEqual(bad.code, 'address_hold');
    assert.strictEqual(h.pays.length, 0);
    h.db.store.set('users/' + BOB, { lightningAddress: 'bob@wallet.example', lightningAddressChangedAt: h.clock - HOLD - 1000 });
    const ok = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.strictEqual(ok.success, true, JSON.stringify(ok));
    assert.strictEqual(h.pays.length, 1);
});

test('a re-created account (new uid) cannot claim the old account\'s block', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.db.store.set('users/bobNewUid0003', { lightningAddress: 'bob@wallet.example' });
    assert.strictEqual((await h.svc.claim(ctx('bobNewUid0003'), { epoch: 1, block: 3 })).code, 'not_winner');
});

test('2FA accounts need a fresh step-up', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.stepUpThrows = true;
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'step_up_required');
    h.stepUpThrows = false;
    assert.ok((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).success);
});

// ---------- addresses ----------
test('shared Lightning address goes to manual review, never paid automatically', async function () {
    const h = makeHarness({ caraLn: 'bob@wallet.example' });
    await freeze(h, 1);
    const r = await h.svc.claim(ctx(CARA), { epoch: 1, block: 4 });
    assert.strictEqual(r.code, 'manual_review');
    assert.strictEqual(h.db.store.get('sf_block_claims/e1_b4').status, 'manual_review');
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'manual_review');
    assert.strictEqual(h.pays.length, 0);
    assert.ok(h.alerts.length >= 1);
});

test('address changed after close: pays only the frozen address, alerts admin, needs a recent sign-in', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.db.store.set('users/' + BOB, { lightningAddress: 'bob-new@other.example' });
    h.recent = false;
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'step_up_required');
    assert.ok(h.alerts.some(function (a) { return /changed their Lightning address/.test(a); }));
    h.recent = true;
    const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.ok(r.success);
    assert.strictEqual(h.lastResolve.ln, 'bob@wallet.example');
});

test('backfill: an address reset after close is held for manual review', async function () {
    const h = makeHarness();
    h.db.store.set('ln_resets/' + BOB, { ln_reset_used: { seconds: CLOSED_MS / 1000 + 86400 } });
    await freeze(h, 1);
    assert.strictEqual(h.db.store.get('sf_payout_results/epoch_1').blocks[3].manualReview, 'address_changed_after_close');
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'manual_review');
});

// ---------- invoices and wallet ----------
test('bad invoices (wrong amount, zero, expired, own node) release the block, nothing paid', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    const muts = [
        function (d) { d.millisatoshis = '4200000'; return d; },
        function (d) { d.millisatoshis = null; return d; },
        function (d) { d.timeExpireDate = 1; return d; },
        function (d) { d.payeeNodeKey = OWN_NODE; return d; },
    ];
    for (const m of muts) {
        h.invoiceMutator = m;
        const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
        assert.strictEqual(r.code, 'bad_invoice');
        h.clock += 120000;
        const c = h.db.store.get('sf_block_claims/e1_b3');
        if (c.status === 'manual_review') break;
    }
    assert.strictEqual(h.pays.length, 0);
    const site = h.db.store.get('sf_claim_counters/site_2026-11-14');
    assert.strictEqual(site.sats, 0, 'reservations released');
});

test('unknown payment result is held for a person and never retried', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.payMode = 'timeout';
    h.lookupState = 'pending';
    const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.strictEqual(r.code, 'held_unknown');
    assert.strictEqual(h.db.store.get('sf_block_claims/e1_b3').status, 'unknown');
    h.payMode = 'paid'; h.clock += 3600000;
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'held_unknown');
    assert.strictEqual(h.pays.length, 1);
});

test('repeat wallet refusals: PAYMENT_FAILED + pending lookup is held_unknown on the first try, counters reserved, never retried (N5)', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.payMode = 'refuse';
    h.lookupState = 'pending'; // an HTLC still in flight after the refusal
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'held_unknown');
    assert.ok(h.lookups >= 1, 'a refusal is looked up');
    const c = h.db.store.get('sf_block_claims/e1_b3');
    assert.strictEqual(c.status, 'unknown');
    assert.strictEqual(c.needsReview, true);
    assert.ok(c.paymentHash, 'payment hash kept on the claim');
    const site = h.db.store.get('sf_claim_counters/site_2026-11-14');
    assert.ok(site && site.sats > 0, 'counters stay reserved');
    h.clock += 3600000; h.payMode = 'paid';
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'held_unknown');
    assert.strictEqual(h.pays.length, 1, 'no automatic second pay');
});

test('PAYMENT_FAILED + error/empty/unclassified lookup also holds', async function () {
    for (const st of ['', 'mystery']) {
        const h = makeHarness();
        await freeze(h, 1);
        h.payMode = 'refuse'; h.lookupState = st;
        assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'held_unknown', st);
        assert.strictEqual(h.pays.length, 1);
    }
    const h = makeHarness();
    await freeze(h, 1);
    h.payMode = 'refuse';
    const realWallet = h.deps.wallet;
    h.deps.wallet = function (cfg) { const w = realWallet(cfg); w.lookupInvoice = async function () { const e = new Error('NOT_FOUND'); e.code = 'NOT_FOUND'; throw e; }; return w; };
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'held_unknown');
    assert.strictEqual(h.pays.length, 1);
});

test('PAYMENT_FAILED + confirmed-failed lookup releases; 3 confirmed failures go to manual review (no loop) and obey the cooldown', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.payMode = 'refuse';
    h.lookupState = 'failed';
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'pay_failed');
    assert.strictEqual(h.lookups, 1, 'released only after the lookup');
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'cooldown');
    h.clock += 120000;
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'pay_failed');
    h.clock += 120000;
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'pay_failed');
    assert.strictEqual(h.db.store.get('sf_block_claims/e1_b3').status, 'manual_review');
    h.clock += 120000; h.payMode = 'paid';
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'manual_review');
    assert.strictEqual(h.pays.length, 3);
    const site = h.db.store.get('sf_claim_counters/site_2026-11-14');
    assert.strictEqual(site.sats, 0, 'confirmed failures release their reservations');
});

test('PAYMENT_FAILED + settled lookup is paid exactly once, never re-paid', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.payMode = 'refuse';
    h.lookupState = 'settled';
    const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.strictEqual(r.success, true, JSON.stringify(r));
    assert.strictEqual(h.db.store.get('sf_block_claims/e1_b3').status, 'paid');
    assert.strictEqual(h.db.store.get('sf_block_claims/e1_b3').paidVia, 'lookup');
    h.clock += 3600000; h.payMode = 'paid';
    const again = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.notStrictEqual(again.success, true);
    assert.strictEqual(h.pays.length, 1, 'no second pay');
});

test('PAYMENT_FAILED only in the message (no code) is looked up and held', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.payMode = 'refuse_text';
    h.lookupState = 'pending';
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'held_unknown');
    assert.ok(h.lookups >= 1);
    assert.strictEqual(h.pays.length, 1);
});

test('wallet balance floor halts claims and alerts', async function () {
    const h = makeHarness({ balanceSats: 9000 });
    await freeze(h, 1);
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'wallet_low');
    assert.ok(h.alerts.some(function (a) { return /floor/.test(a); }));
    assert.strictEqual(h.pays.length, 0);
});

// ---------- caps ----------
test('per-uid daily cap (12,600 = 3 blocks) and site daily cap hold', async function () {
    const h = makeHarness({ epochs: 2, config: { enabledEpochs: [1, 2] } });
    await freeze(h, 1); await freeze(h, 2);
    for (const b of [0, 1, 2]) assert.ok((await h.svc.claim(ctx(ALICE), { epoch: 1, block: b })).success);
    assert.strictEqual((await h.svc.claim(ctx(ALICE), { epoch: 2, block: 2 })).code, 'uid_daily_cap');
    h.clock += 24 * 3600 * 1000;
    assert.ok((await h.svc.claim(ctx(ALICE), { epoch: 2, block: 2 })).success);
    const h2 = makeHarness({ epochs: 2, config: { enabledEpochs: [1, 2], siteDailySats: 8400 } });
    await freeze(h2, 1); await freeze(h2, 2);
    assert.ok((await h2.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).success);
    assert.ok((await h2.svc.claim(ctx(CARA), { epoch: 1, block: 4 })).success);
    assert.strictEqual((await h2.svc.claim(ctx(BOB), { epoch: 2, block: 0 })).code, 'site_daily_cap');
});

// ---------- one-time catch-up (epochs 1-8) ----------
test('catch-up: epochs 1-8 skip the monthly limit but keep per-claim and daily caps', async function () {
    const h = makeHarness({ epochs: 3, config: { enabledEpochs: [1, 2, 3], monthlySats: 4200, perUidDailySats: 1000000, siteDailySats: 1000000 } });
    await freeze(h, 1); await freeze(h, 2); await freeze(h, 3);
    assert.ok((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).success);
    assert.ok((await h.svc.claim(ctx(CARA), { epoch: 1, block: 4 })).success, 'over the 4,200 monthly limit, but catch-up');
    assert.ok((await h.svc.claim(ctx(BOB), { epoch: 2, block: 0 })).success);
    assert.strictEqual(h.db.store.get('sf_claim_counters/month_2026-11'), undefined, 'catch-up does not consume the normal monthly budget');
    const cu = h.db.store.get('sf_claim_counters/' + core.CATCH_UP_COUNTER_ID);
    assert.strictEqual(cu.sats, 3 * 4190);
    assert.strictEqual(cu.ceilingSats, 15 * 4200 + core.CATCH_UP_FEE_ALLOWANCE_SATS);
});

test('catch-up ceiling: archived epoch 1-8 blocks + fee allowance, enforced in the claim transaction', async function () {
    assert.strictEqual(core.catchUpCeiling(168000), 168000 + core.CATCH_UP_FEE_ALLOWANCE_SATS);
    assert.strictEqual(core.catchUpCeiling(999999), 168000 + core.CATCH_UP_FEE_ALLOWANCE_SATS);
    const h = makeHarness({ config: { perUidDailySats: 1000000 } });
    await freeze(h, 1);
    // Pretend a bug already spent almost the whole epoch-1 ceiling.
    h.db.store.set('sf_claim_counters/' + core.CATCH_UP_COUNTER_ID, { sats: 21000 + core.CATCH_UP_FEE_ALLOWANCE_SATS - 4000 });
    const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.strictEqual(r.code, 'catch_up_ceiling');
    assert.strictEqual(h.pays.length, 0);
});

test('catch-up ceiling counts routing fees: overpaid fees cannot push spend past the ceiling', async function () {
    const h = makeHarness({ config: { perUidDailySats: 1000000, siteDailySats: 1000000 } });
    await freeze(h, 1);
    h.routingFeeMsat = 900 * 1000;
    // A 900-sat fee is over the routing-fee limit, so each paid claim halts
    // claims; clear the halt between claims (as an admin would) to reach the ceiling.
    function clearHalt() {
        assert.strictEqual(h.db.store.get('sf_claim_counters/' + core.FEE_HALT_DOC_ID).halted, true);
        h.db.store.set('sf_claim_counters/' + core.FEE_HALT_DOC_ID, { halted: false });
    }
    for (const b of [0, 1, 2]) { assert.ok((await h.svc.claim(ctx(ALICE), { epoch: 1, block: b })).success); clearHalt(); }
    const cu = h.db.store.get('sf_claim_counters/' + core.CATCH_UP_COUNTER_ID);
    assert.strictEqual(cu.sats, 3 * (4190 + 900));
    assert.ok((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).success); clearHalt();
    assert.strictEqual((await h.svc.claim(ctx(CARA), { epoch: 1, block: 4 })).code, 'catch_up_ceiling', '4 x 5,090 = 20,360; + 4,200 > 23,000');
});

test('catch-up is hardcoded to epochs 1-8: epoch 9 uses the normal monthly limit', async function () {
    assert.ok(core.isCatchUpEpoch(1) && core.isCatchUpEpoch(8));
    assert.ok(!core.isCatchUpEpoch(9) && !core.isCatchUpEpoch(0) && !core.isCatchUpEpoch(10));
    const h = makeHarness({ epochs: 9, config: { enabledEpochs: [1, 9], monthlySats: 4200, perUidDailySats: 1000000, siteDailySats: 1000000 } });
    await freeze(h, 1); await freeze(h, 9);
    assert.ok((await h.svc.claim(ctx(BOB), { epoch: 9, block: 0 })).success);
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 9, block: 3 })).code, 'monthly_cap');
    assert.ok((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).success, 'epoch 1 still catch-up');
});

test('catch-up ends by itself: when every epoch 1-8 block is paid nothing else is exempt; no admin flag exists', async function () {
    const h = makeHarness({ config: { perUidDailySats: 1000000, monthlySats: 4200 } });
    await freeze(h, 1);
    for (const [u, b] of [[ALICE, 0], [ALICE, 1], [ALICE, 2], [BOB, 3], [CARA, 4]]) assert.ok((await h.svc.claim(ctx(u), { epoch: 1, block: b })).success);
    for (const b of [0, 1, 2, 3, 4]) assert.strictEqual((await h.svc.claim(ctx(ALICE), { epoch: 1, block: b })).code, b < 3 ? 'already_paid' : 'not_winner');
    const src = fs.readFileSync(path.join(root, 'functions/src/favorBlockClaims.js'), 'utf8');
    assert.ok(!/cfg\.catchUp|catchUpEnabled|catchUpEpochs/.test(src), 'no config flag can widen or keep the exemption on');
    assert.strictEqual(core.readConfig({ catchUpEnabled: true, catchUpEpochs: [9, 10] }).catchUpEnabled, undefined);
});

test('catch-up: an epoch 1-8 block claimed after the 2027 relaunch is still covered (no date expiry)', async function () {
    const h = makeHarness({ config: { monthlySats: 1 } });
    await freeze(h, 1);
    h.clock = Date.UTC(2027, 5, 1);
    assert.ok((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).success);
});

// ---------- freeze / backfill and permanent records ----------
test('freeze is idempotent, deterministic, and never writes sfPoolHistory', async function () {
    const h = makeHarness();
    const before = JSON.stringify(h.db.store.get('sfPoolHistory/h1'));
    const a = await h.svc.freezeEpoch(1, { source: 'backfill' });
    const b = await h.svc.freezeEpoch(1, { source: 'backfill' });
    assert.ok(a.created && b.existed && b.ok);
    assert.strictEqual(JSON.stringify(h.db.store.get('sfPoolHistory/h1')), before);
    assert.ok(!h.db.writes.some(function (k) { return k.indexOf('sfPoolHistory/') === 0; }));
    const dry = await h.svc.freezeEpoch(1, { dryRun: true });
    assert.ok(dry.existed);
    assert.deepStrictEqual(h.db.store.get('sf_payout_results/epoch_1').blocks.map(function (x) { return x.uid; }), [ALICE, ALICE, ALICE, BOB, CARA]);
    assert.strictEqual((await h.svc.freezeEpoch(2, {})).reason, 'no_history');
});

test('no claim path ever writes sfPoolHistory', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    await h.svc.claim(ctx(MALLORY), { epoch: 1, block: 0 });
    assert.ok(!h.db.writes.some(function (k) { return k.indexOf('sfPoolHistory/') === 0; }));
});

test('payout records are write-once: a second write for the same block is refused', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    let threw = false;
    try { await h.db.collection('sf_block_payouts').doc('e1_b3').create({ x: 1 }); } catch (e) { threw = true; }
    assert.ok(threw);
});

test('every refusal (except signed-out and bad_id) and every payment writes an audit row', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    await h.svc.claim(ctx(null), { epoch: 1, block: 3 });
    await h.svc.claim(ctx(MALLORY), { epoch: 1, block: 3 });
    await h.svc.claim(ctx(BOB), { epoch: 'x', block: 3 });
    await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    const rows = audits(h).filter(function (a) { return a.type !== 'freeze'; });
    // Signed-out and bad_id calls are not audited (Spam/Abuse #311 M1).
    assert.deepStrictEqual(rows.map(function (a) { return a.code; }), ['not_winner', 'paid']);
    rows.forEach(function (a) { assert.ok(!('uid' in a), 'audit rows carry a masked uid only'); });
});

test('listMine returns only the caller\'s own blocks', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    const a = await h.svc.listMine(ctx(ALICE), { epochNumbers: [1, 'x', 1] });
    assert.deepStrictEqual(a.claims.map(function (c) { return c.block; }), [0, 1, 2]);
    assert.ok(a.claims.every(function (c) { return c.status === 'claimable' && c.payTo === 'al\u2026@wallet.example'; }));
    assert.deepStrictEqual((await h.svc.listMine(ctx(MALLORY), { epochNumbers: [1] })).claims, []);
    assert.deepStrictEqual((await h.svc.listMine(ctx(null), { epochNumbers: [1] })).claims, []);
});

test('listMine: released claimable stays claimable; unreleased frozen review stays manual_review; paid stays paid', async function () {
    const h = makeHarness();
    // Same setup as a live address-changed-after-close hold.
    h.db.store.set('lightning_addresses/bob@wallet.example', { uid: BOB, address: 'bob@wallet.example', lockedAt: { seconds: CLOSED_MS / 1000 + 60 } });
    const fr = await freeze(h, 1);
    assert.strictEqual(fr.result.blocks[3].manualReview, 'address_changed_after_close');

    const unreleased = await h.svc.listMine(ctx(BOB), { epochNumbers: [1] });
    assert.strictEqual(unreleased.claims.length, 1);
    assert.strictEqual(unreleased.claims[0].block, 3);
    assert.strictEqual(unreleased.claims[0].status, 'manual_review', 'no claim doc yet, frozen flag still hides the button');

    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'manual_review');
    assert.strictEqual((await h.svc.listMine(ctx(BOB), { epochNumbers: [1] })).claims[0].status, 'manual_review');

    const r = await h.svc.resolveReview('adminUid000001', { epoch: 1, block: 3, action: 'release', note: 'address change accepted' });
    assert.strictEqual(r.code, 'released');
    const released = await h.svc.listMine(ctx(BOB), { epochNumbers: [1] });
    assert.strictEqual(released.claims[0].status, 'claimable');
    assert.strictEqual(released.claims[0].block, 3);
    assert.strictEqual(h.db.store.get('sf_payout_results/epoch_1').blocks[3].manualReview, 'address_changed_after_close', 'frozen review flag is left in place');

    const p = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.ok(p.success, JSON.stringify(p));
    assert.strictEqual((await h.svc.listMine(ctx(BOB), { epochNumbers: [1] })).claims[0].status, 'paid');
});

// ---------- claimFavorBlock gate order (QA case e) ----------
async function freezeAddressChange(h) {
    h.db.store.set('lightning_addresses/bob@wallet.example', { uid: BOB, address: 'bob@wallet.example', lockedAt: { seconds: CLOSED_MS / 1000 + 60 } });
    const fr = await freeze(h, 1);
    assert.strictEqual(fr.result.blocks[3].manualReview, 'address_changed_after_close');
    return fr;
}

test('claimFavorBlock: paid released block, second claim returns already_paid', async function () {
    const h = makeHarness();
    await freezeAddressChange(h);
    const rel = await h.svc.resolveReview('adminUid000001', { epoch: 1, block: 3, action: 'release', note: 'address change accepted' });
    assert.strictEqual(rel.code, 'released');
    const p = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.ok(p.success, JSON.stringify(p));
    assert.strictEqual(h.db.store.get('sf_block_claims/e1_b3').status, 'paid');
    assert.strictEqual(h.db.store.get('sf_payout_results/epoch_1').blocks[3].manualReview, 'address_changed_after_close', 'frozen review flag is left in place');
    h.clock += 120000;
    const again = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.strictEqual(again.code, 'already_paid');
    assert.strictEqual(h.pays.length, 1);
});

test('claimFavorBlock: paying released block returns already in progress', async function () {
    const h = makeHarness();
    await freezeAddressChange(h);
    const rel = await h.svc.resolveReview('adminUid000001', { epoch: 1, block: 3, action: 'release', note: 'address change accepted' });
    assert.strictEqual(rel.code, 'released');
    const rec = Object.assign({}, h.db.store.get('sf_block_claims/e1_b3'), { status: 'paying' });
    h.db.store.set('sf_block_claims/e1_b3', rec);
    const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.strictEqual(r.code, 'in_progress');
    assert.strictEqual(h.pays.length, 0);
    assert.strictEqual(h.db.store.get('sf_block_claims/e1_b3').status, 'paying');
});

test('claimFavorBlock: released then re-held stays manual_review', async function () {
    const h = makeHarness();
    await freezeAddressChange(h);
    const rel = await h.svc.resolveReview('adminUid000001', { epoch: 1, block: 3, action: 'release', note: 'address change accepted' });
    assert.strictEqual(rel.code, 'released');
    const rec = h.db.store.get('sf_block_claims/e1_b3');
    assert.strictEqual(rec.reviewReleased, true);
    assert.strictEqual(rec.status, 'claimable');
    h.db.store.set('sf_block_claims/e1_b3', Object.assign({}, rec, { status: 'manual_review' }));
    const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.strictEqual(r.code, 'manual_review');
    assert.strictEqual(h.pays.length, 0);
    assert.strictEqual(h.db.store.get('sf_block_claims/e1_b3').status, 'manual_review');
    assert.strictEqual(h.db.store.get('sf_block_claims/e1_b3').reviewReleased, true);
});

test('claimFavorBlock: unreleased frozen block stays manual_review', async function () {
    const h = makeHarness();
    await freezeAddressChange(h);
    const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.strictEqual(r.code, 'manual_review');
    assert.strictEqual(h.pays.length, 0);
    assert.strictEqual(h.db.store.get('sf_block_claims/e1_b3').status, 'manual_review');
    assert.ok(!h.db.store.get('sf_block_claims/e1_b3').reviewReleased);
});

// ---------- routing-fee cap (Red Team #311 item 2) ----------
function hint(base, ppm) {
    return { tagName: 'routing_info', data: [{ pubkey: '03' + '11'.repeat(32), short_channel_id: '0000010000020003', fee_base_msat: base, fee_proportional_millionths: ppm, cltv_expiry_delta: 40 }] };
}

test('route-hint fee: limit is max(10 sats, 1%) and the worst path is summed per hop', function () {
    assert.strictEqual(core.routeFeeLimitMsat(4190), 41900);
    assert.strictEqual(core.routeFeeLimitMsat(500), 10000);
    const two = { tags: [hint(1000, 100), { tagName: 'routing_info', data: [
        { fee_base_msat: 20000, fee_proportional_millionths: 1000 }, { fee_base_msat: 20000, fee_proportional_millionths: 1000 }] }] };
    const r = core.routeHintFeeMsat(two, 4190000);
    assert.strictEqual(r.paths, 2);
    assert.strictEqual(r.worstMsat, 2 * (20000 + 4190), 'second path, both hops summed');
    assert.strictEqual(core.routeHintFeeMsat({ tags: [] }, 4190000).worstMsat, 0);
    assert.strictEqual(core.routeHintFeeMsat({ tags: [{ tagName: 'routing_info', data: [{ fee_base_msat: 'x' }] }] }, 1).worstMsat, Infinity, 'malformed fails closed');
    assert.ok(core.checkRouteFees({ tags: [hint(1000, 100)] }, 4190).ok);
    assert.ok(!core.checkRouteFees({ tags: [hint(50000, 50000)] }, 4190).ok);
    assert.ok(!core.checkRouteFees({ tags: [hint(41901, 0)] }, 4190).ok, 'one msat over the limit');
    assert.ok(core.checkRouteFees({ tags: [hint(41900, 0)] }, 4190).ok, 'exactly the limit is allowed');
});

test('route-hint fee: an invoice with a high-fee hint is never paid, held for review, counters released, audited', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.invoiceMutator = function (d) { d.tags.push(hint(50000, 50000)); return d; };
    const r = await h.svc.claim(ctx(ALICE), { epoch: 1, block: 0 });
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.code, 'route_fee_high');
    assert.strictEqual(h.pays.length, 0, 'wallet never called');
    const c = h.db.store.get('sf_block_claims/e1_b0');
    assert.strictEqual(c.status, 'manual_review');
    assert.strictEqual(c.reviewReason, 'route_fee_high');
    keys(h, 'sf_claim_counters/').forEach(function (k) { assert.strictEqual(h.db.store.get(k).sats || 0, 0, k + ' released'); });
    const a = audits(h).filter(function (x) { return x.code === 'route_fee_high'; });
    assert.strictEqual(a.length, 1);
    assert.strictEqual(a[0].detail.worstHintFeeMsat, 50000 + Math.ceil(50000 * 4190000 / 1e6));
    assert.strictEqual(a[0].detail.limitMsat, 41900);
    assert.ok(h.alerts.some(function (t) { return /route-hint fee/.test(t); }));
    assert.ok(!keys(h, 'sf_block_payouts/').length);
    // Retrying does not reach the wallet: the block waits for a person.
    h.clock += 3600 * 1000;
    assert.strictEqual((await h.svc.claim(ctx(ALICE), { epoch: 1, block: 0 })).code, 'manual_review');
    assert.strictEqual(h.pays.length, 0);
});

test('route-hint fee: a normal invoice (small hint or none) pays as before', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.invoiceMutator = function (d) { d.tags.push(hint(1000, 100)); return d; };
    const r = await h.svc.claim(ctx(ALICE), { epoch: 1, block: 0 });
    assert.ok(r.success, JSON.stringify(r));
    h.invoiceMutator = null;
    h.routingFeeMsat = 41900; // exactly the limit: no halt
    assert.ok((await h.svc.claim(ctx(ALICE), { epoch: 1, block: 1 })).success);
    assert.strictEqual(h.pays.length, 2);
    const halt = h.db.store.get('sf_claim_counters/' + core.FEE_HALT_DOC_ID);
    assert.ok(!halt || halt.halted !== true);
});

test('post-pay overspend: a routing fee over the limit records the payout, halts every further claim, audited', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.routingFeeMsat = 41901; // 1 msat over max(10, 1% of 4,190)
    const r = await h.svc.claim(ctx(ALICE), { epoch: 1, block: 0 });
    assert.ok(r.success, 'the payment happened, so it is recorded as paid');
    const p = h.db.store.get('sf_block_payouts/e1_b0');
    assert.strictEqual(p.routingFeeSats, 42);
    assert.strictEqual(p.walletSpentSats, 4190 + 42);
    const halt = h.db.store.get('sf_claim_counters/' + core.FEE_HALT_DOC_ID);
    assert.strictEqual(halt.halted, true);
    assert.strictEqual(halt.reason, 'routing_fee_over_limit');
    assert.ok(audits(h).some(function (a) { return a.type === 'fee_halt' && a.routingFeeSats === 42 && a.limitSats === 42; }));
    assert.ok(h.alerts.some(function (t) { return /HALTED/.test(t); }));
    h.routingFeeMsat = 0;
    const next = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.strictEqual(next.code, 'fee_halt');
    assert.strictEqual(h.pays.length, 1, 'no further wallet call while halted');
    assert.ok(audits(h).some(function (a) { return a.type === 'refused' && a.code === 'fee_halt' && a.block === 3; }));
    keys(h, 'sf_claim_counters/').filter(function (k) { return k.indexOf('uid_') !== -1; }).forEach(function (k) {
        assert.ok(h.db.store.get(k).sats === 4200 || h.db.store.get(k).sats === undefined || h.db.store.get(k).sats === 0);
    });
    // An admin clears it; claims resume.
    h.db.store.set('sf_claim_counters/' + core.FEE_HALT_DOC_ID, { halted: false });
    assert.ok((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).success);
});

test('wiring: the NWC pay call carries only the invoice; staging mock can add hint fees; halt is clearable by admin only', function () {
    const src = fs.readFileSync(path.join(root, 'functions/src/favorBlockClaims.js'), 'utf8');
    assert.ok(/checkRouteFees\(decoded, net\)[\s\S]{0,600}release\('route_fee_high'[\s\S]{0,200}review: 'route_fee_high'/.test(src));
    assert.ok(src.indexOf("checkRouteFees(decoded, net)") < src.indexOf('wallet.payInvoice('), 'fee check runs before the wallet call');
    const fns = fs.readFileSync(path.join(root, 'functions/src/favorBlockClaimsFns.js'), 'utf8');
    assert.ok(/if \(staging\) return mockInvoice\(sats, mockHintFor\(ln, cfg\)\)/.test(fns));
    const m = require(path.join(root, 'functions/src/favorBlockClaimsFns.js'));
    assert.strictEqual(m.mockHintFor('sf-x+highfee@staging.test', {}), 'high');
    assert.strictEqual(m.mockHintFor('sf-x+normalhint@staging.test', {}), 'normal');
    assert.strictEqual(m.mockHintFor('sf-x@staging.test', { mockRouteHint: 'none' }), 'none');
    assert.ok(/d\.clearFeeHalt === true/.test(fns) && /requireAdmin\(context\);[\s\S]{0,200}requireAdminStepUp/.test(fns));
    const mod = require(path.join(root, 'functions/src/favorBlockClaimsFns.js'));
    const bolt11 = require(path.join(root, 'functions/node_modules/bolt11'));
    const hi = bolt11.decode(mod.mockInvoice(4190, 'high'));
    const lo = bolt11.decode(mod.mockInvoice(4190, 'normal'));
    const none = bolt11.decode(mod.mockInvoice(4190));
    assert.ok(!core.checkRouteFees(hi, 4190).ok);
    assert.ok(core.checkRouteFees(lo, 4190).ok && core.routeHintFeeMsat(lo, 4190000).paths === 1);
    assert.ok(core.checkRouteFees(none, 4190).ok && core.routeHintFeeMsat(none, 4190000).paths === 0);
});

test('admin approve payout functions are not exported, so they cannot be redeployed', function () {
    const idx = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    assert.ok(!/exports\.adminApproveFavorPayout\b/.test(idx));
    assert.ok(!/exports\.adminApproveFactionPayout\b/.test(idx));
});

// ---------- Spam/Abuse #311 fixes ----------
test('M1: signed-out and malformed calls write no audit row and no counter', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    const before = keys(h, 'sf_claim_audit/').length;
    const writesBefore = h.db.writes.length;
    assert.strictEqual((await h.svc.claim(ctx(null), { epoch: 1, block: 0 })).code, 'unauthenticated');
    assert.strictEqual(h.db.writes.length, writesBefore, 'signed-out call writes nothing');
    assert.strictEqual((await h.svc.claim(ctx(ALICE), { epoch: 'x', block: 0 })).code, 'bad_id');
    assert.strictEqual((await h.svc.claim(ctx(ALICE), { epoch: 1, block: 9 })).code, 'bad_id');
    assert.strictEqual(keys(h, 'sf_claim_audit/').length, before, 'no audit rows for unauthenticated or bad_id');
});

test('M1: per-uid call limit refuses past RATE_MAX in the window, audits once, then resets', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    for (let i = 0; i < core.RATE_MAX; i++) assert.notStrictEqual((await h.svc.claim(ctx(MALLORY), { epoch: 1, block: 0 })).code, 'rate_limited');
    assert.strictEqual((await h.svc.claim(ctx(MALLORY), { epoch: 1, block: 0 })).code, 'rate_limited');
    assert.strictEqual((await h.svc.claim(ctx(MALLORY), { epoch: 1, block: 0 })).code, 'rate_limited');
    assert.strictEqual(audits(h).filter(function (a) { return a.code === 'rate_limited'; }).length, 1, 'only the first refused call is audited');
    // Another player is not affected.
    assert.ok((await h.svc.claim(ctx(ALICE), { epoch: 1, block: 0 })).success);
    h.clock += core.RATE_WINDOW_MS;
    assert.strictEqual((await h.svc.claim(ctx(MALLORY), { epoch: 1, block: 0 })).code, 'not_winner');
});

test('M1: repeat manual-review, address-changed and history-mismatch alerts fire once per key per ET day', async function () {
    const h = makeHarness({ caraLn: 'alice@wallet.example' });
    await freeze(h, 1);
    for (let i = 0; i < 3; i++) await h.svc.claim(ctx(CARA), { epoch: 1, block: 4 });
    assert.strictEqual(h.alerts.filter(function (t) { return /manual review: epoch 1 block 4/.test(t); }).length, 1);
    h.db.store.set('users/' + BOB, { lightningAddress: 'bob2@wallet.example' });
    for (let i = 0; i < 3; i++) await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.strictEqual(h.alerts.filter(function (t) { return /changed their Lightning address/.test(t); }).length, 1);
    const hist = h.db.store.get('sfPoolHistory/h1');
    hist.blocks[0].uid = MALLORY; h.db.store.set('sfPoolHistory/h1', hist);
    for (let i = 0; i < 3; i++) assert.strictEqual((await h.svc.claim(ctx(ALICE), { epoch: 1, block: 1 })).code, 'history_mismatch');
    assert.strictEqual(h.alerts.filter(function (t) { return /does not match sfPoolHistory/.test(t); }).length, 1);
    // Next ET day: alerts again.
    h.clock += 24 * 3600 * 1000;
    await h.svc.claim(ctx(ALICE), { epoch: 1, block: 1 });
    assert.strictEqual(h.alerts.filter(function (t) { return /does not match sfPoolHistory/.test(t); }).length, 2);
    assert.strictEqual(core.etDayKey(Date.UTC(2026, 10, 15, 4, 30)), '2026-11-14', '11:30 PM ET is still the 14th');
});

test('M2: backfill sends a winner whose address lock postdates the close (or has no time) to review', async function () {
    const h = makeHarness();
    h.db.store.set('lightning_addresses/bob@wallet.example', { uid: BOB, address: 'bob@wallet.example', lockedAt: { seconds: CLOSED_MS / 1000 + 60 } });
    h.db.store.delete('lightning_addresses/cara@wallet.example');
    const r = await freeze(h, 1);
    const b = r.result.blocks;
    assert.strictEqual(b[0].manualReview, '');
    assert.strictEqual(b[3].manualReview, 'address_changed_after_close');
    assert.strictEqual(b[3].lnChangedAfterClose, true);
    assert.strictEqual(b[4].manualReview, 'address_changed_after_close', 'no lock = unknown time = review');
    const c = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.ok(['manual_review', 'step_up_required'].indexOf(c.code) !== -1);
    assert.strictEqual(h.pays.length, 0);
});

test('M2: the close-time freeze is not affected by the lock check', async function () {
    const h = makeHarness({ noLocks: true });
    const r = await h.svc.freezeEpoch(1, { source: 'close' });
    assert.ok(r.ok);
    assert.ok(r.result.blocks.every(function (b) { return b.manualReview === ''; }));
});

test('LOW: shared-address flagging looks across epochs and across accounts', async function () {
    const h = makeHarness({ epochs: 2 });
    await freeze(h, 1);
    // Epoch 2: BOB now uses ALICE's epoch-1 address.
    h.db.store.set('users/' + BOB, { lightningAddress: 'alice@wallet.example' });
    const r2 = await freeze(h, 2);
    r2.result.blocks.filter(function (x) { return x.uid === BOB; }).forEach(function (x) { assert.strictEqual(x.manualReview, 'shared_address'); });
    // Another account holding the address right now also counts.
    const h2 = makeHarness();
    h2.db.store.set('users/someoneElse', { lightningAddress: 'cara@wallet.example' });
    const r = await freeze(h2, 1);
    assert.strictEqual(r.result.blocks[4].manualReview, 'shared_address');
    assert.strictEqual(r.result.blocks[0].manualReview, '');
});

test('LOW: a wallet that cannot be built releases the reservation instead of leaving paying', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    const svc = core.createBlockClaimService(Object.assign({}, h.deps, { wallet: function () { throw new Error('NO_WALLET'); } }));
    const r = await svc.claim(ctx(ALICE), { epoch: 1, block: 0 });
    assert.strictEqual(r.code, 'wallet_unavailable');
    const c = h.db.store.get('sf_block_claims/e1_b0');
    assert.strictEqual(c.status, 'claimable');
    keys(h, 'sf_claim_counters/').filter(function (k) { return /uid_|site_|catchup/.test(k); }).forEach(function (k) { assert.strictEqual(h.db.store.get(k).sats, 0, k); });
});

test('LOW wiring: App Check on all four callables, own freeze step-up action, staging refuses NWC_URL', function () {
    const fns = fs.readFileSync(path.join(root, 'functions/src/favorBlockClaimsFns.js'), 'utf8');
    assert.ok(/const claimFavorBlock = functionsV1\.runWith\(\{\s*enforceAppCheck: true,/.test(fns));
    ['myFavorEpochClaims', 'adminSetFavorClaims', 'adminFreezeFavorEpoch'].forEach(function (n) {
        assert.ok(new RegExp('const ' + n + ' = functionsV1\\.runWith\\(\\{ enforceAppCheck: true \\}\\)').test(fns), n);
    });
    assert.ok(/requireAdminStepUp\(secondFactor\.stamp\(data, context\), 'adminFreezeFavorEpoch'\)/.test(fns));
    const sf = fs.readFileSync(path.join(root, 'functions/src/secondFactor.js'), 'utf8');
    assert.ok(/adminFreezeFavorEpoch: true/.test(sf));
    assert.ok(/if \(nwcUrl\(\)\) throw new Error\('staging must not have NWC_URL'\)/.test(fns));
    // beginPayout's 48h hold must surface as address_hold, not a generic hold
    // that claimFavorBlock would map to account_blocked.
    assert.ok(/if \(gate\.error === faucetGuard\.ADDRESS_CHANGE_HOLD_ERROR\) return \{ ok: false, code: 'address_hold' \}/.test(fns));
});

test('seeder hard-refuses every project but staging before any write', function () {
    const cp = require('child_process');
    const os = require('os');
    const seedPath = path.join(root, 'scripts/staging/seed-favor-winners.js');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seedtest-'));
    try {
        function run(keyProject, argProject, envProject) {
            const kf = path.join(tmp, 'k.json');
            fs.writeFileSync(kf, JSON.stringify({ project_id: keyProject }));
            const env = Object.assign({}, process.env, { GOOGLE_APPLICATION_CREDENTIALS: kf, GCLOUD_PROJECT: envProject });
            delete env.FIREBASE_SA_JSON; delete env.GOOGLE_CLOUD_PROJECT;
            return cp.spawnSync(process.execPath, [seedPath, '--project', argProject, '--epoch', '2', '--dry-run'], { env: env, encoding: 'utf8', timeout: 20000 });
        }
        const live = 'bitcoin-education-archive';
        [[live, live, live], ['bitcoin-quest-staging', live, 'bitcoin-quest-staging'], [live, 'bitcoin-quest-staging', 'bitcoin-quest-staging'],
         ['bitcoin-quest-staging', 'bitcoin-quest-staging', live], ['bitcoin-quest-staging', 'bitcoin-quest-staging', '']].forEach(function (c) {
            const r = run(c[0], c[1], c[2]);
            assert.strictEqual(r.status, 2, JSON.stringify(c) + ' must exit 2: ' + r.stderr);
            assert.ok(/REFUSED: project is/.test(r.stderr), r.stderr);
        });
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    const src = fs.readFileSync(seedPath, 'utf8');
    assert.ok(src.indexOf('if (project !== STAGING) die(') < src.indexOf("require(path.join(__dirname, '../../functions/src/firebaseAdmin.js'))"), 'project check runs before the admin SDK loads');
});

// ---------- adminResolveFavorReview (Spam/Abuse NEW LOW, Red Team rules) ----------
const ADMIN = 'adminUid000001';
function reviewHarness() {
    const h = makeHarness();
    // BOB's lock postdates the close -> frozen as address_changed_after_close.
    h.db.store.set('lightning_addresses/bob@wallet.example', { uid: BOB, address: 'bob@wallet.example', lockedAt: { seconds: CLOSED_MS / 1000 + 60 } });
    return h;
}
function claimDoc(h, id) { return h.db.store.get('sf_block_claims/' + id); }
function reviewAudits(h) { return audits(h).filter(function (a) { return a.type === 'admin_review'; }); }

test('review release: frozen-review block goes back to claimable for its frozen winner, audited with admin, before/after, note', async function () {
    const h = reviewHarness();
    const fr = await freeze(h, 1);
    assert.strictEqual(fr.result.blocks[3].manualReview, 'address_changed_after_close');
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'manual_review');
    const r = await h.svc.resolveReview(ADMIN, { epoch: 1, block: 3, action: 'release', note: 'lock missing: faucet never used; address checked' });
    assert.ok(r.ok && r.code === 'released', JSON.stringify(r));
    assert.strictEqual(r.before, 'manual_review'); assert.strictEqual(r.after, 'claimable');
    const c = claimDoc(h, 'e1_b3');
    assert.strictEqual(c.status, 'claimable'); assert.strictEqual(c.reviewReleased, true);
    assert.strictEqual(c.uid, BOB); assert.strictEqual(c.frozenLn, 'bob@wallet.example');
    const a = reviewAudits(h);
    assert.strictEqual(a.length, 1);
    assert.deepStrictEqual([a[0].action, a[0].code, a[0].by, a[0].before, a[0].after, a[0].epoch, a[0].block], ['release', 'released', 'admin\u2026', 'manual_review', 'claimable', 1, 3]);
    assert.ok(/faucet never used/.test(a[0].note));
    // The winner now goes through every normal check and is paid to the frozen address.
    const p = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.ok(p.success, JSON.stringify(p));
    assert.strictEqual(h.lastResolve.ln, 'bob@wallet.example');
    assert.strictEqual(h.db.store.get('sf_block_payouts/e1_b3').frozenLn, 'bob@wallet.example');
});

test('review release: no admin input for uid, address or amount; non-winners still refused; idempotent', async function () {
    const h = reviewHarness();
    await freeze(h, 1);
    const r = await h.svc.resolveReview(ADMIN, { epoch: 1, block: 3, action: 'release', note: 'ok', uid: MALLORY, frozenLn: 'evil@evil.example', address: 'evil@evil.example', amount: 99999 });
    assert.strictEqual(r.code, 'released');
    const c = claimDoc(h, 'e1_b3');
    assert.strictEqual(c.uid, BOB); assert.strictEqual(c.frozenLn, 'bob@wallet.example'); assert.strictEqual(c.amount, 4200);
    assert.strictEqual((await h.svc.claim(ctx(MALLORY), { epoch: 1, block: 3 })).code, 'not_winner');
    const again = await h.svc.resolveReview(ADMIN, { epoch: 1, block: 3, action: 'release', note: 'again' });
    assert.strictEqual(again.code, 'noop');
    assert.strictEqual(reviewAudits(h).length, 2, 'every call is audited, noops too');
    const src = fs.readFileSync(path.join(root, 'functions/src/favorBlockClaimsFns.js'), 'utf8');
    assert.ok(/resolveReview\(context\.auth\.uid, \{ epoch: d\.epoch, block: d\.block, action: d\.action, note: d\.note \}\)/.test(src), 'only epoch, block, action, note reach the service');
});

test('review release: refused on a paid block, on a rejected block, without a note, with a bad action, and for a no-address block', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    assert.ok((await h.svc.claim(ctx(ALICE), { epoch: 1, block: 0 })).success);
    const r = await h.svc.resolveReview(ADMIN, { epoch: 1, block: 0, action: 'release', note: 'try' });
    assert.strictEqual(r.code, 'refused_paid'); assert.strictEqual(r.ok, false);
    assert.strictEqual(claimDoc(h, 'e1_b0').status, 'paid');
    assert.strictEqual((await h.svc.resolveReview(ADMIN, { epoch: 1, block: 0, action: 'reject', note: 'try' })).code, 'refused_paid');
    assert.strictEqual((await h.svc.resolveReview(ADMIN, { epoch: 1, block: 1, action: 'release' })).code, 'note_required');
    assert.strictEqual((await h.svc.resolveReview(ADMIN, { epoch: 1, block: 1, action: 'pay', note: 'x' })).code, 'bad_action');
    assert.strictEqual((await h.svc.resolveReview(ADMIN, { epoch: 1, block: 1, action: 'release', note: 'x' })).code, 'not_in_review', 'a normal claimable block is not in review');
    const h2 = makeHarness({ caraLn: 'not-an-address' });
    await freeze(h2, 1);
    assert.strictEqual((await h2.svc.resolveReview(ADMIN, { epoch: 1, block: 4, action: 'release', note: 'x' })).code, 'no_frozen_address');
    assert.strictEqual(h.pays.length, 1, 'no admin path ever pays');
});

test('review release: paying/unknown or a block with a paymentHash needs an explicit failed lookup first', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.payMode = 'timeout'; h.lookupState = 'pending';
    assert.strictEqual((await h.svc.claim(ctx(ALICE), { epoch: 1, block: 0 })).code, 'held_unknown');
    assert.strictEqual(claimDoc(h, 'e1_b0').status, 'unknown');
    const site = function () { return h.db.store.get(keys(h, 'sf_claim_counters/site_')[0]).sats; };
    assert.strictEqual(site(), 4200, 'reserved while unknown');
    for (const st of ['pending', 'expired', 'settled']) {
        h.lookupState = st;
        const r = await h.svc.resolveReview(ADMIN, { epoch: 1, block: 0, action: 'release', note: 'check ' + st });
        assert.strictEqual(r.code, st === 'settled' ? 'refused_payment_not_failed' : 'refused_payment_not_failed', st);
        assert.strictEqual(claimDoc(h, 'e1_b0').status, 'unknown');
    }
    h.lookupState = 'failed';
    const ok = await h.svc.resolveReview(ADMIN, { epoch: 1, block: 0, action: 'release', note: 'wallet says failed' });
    assert.strictEqual(ok.code, 'released'); assert.strictEqual(ok.lookup, 'failed');
    assert.strictEqual(claimDoc(h, 'e1_b0').status, 'claimable');
    assert.strictEqual(site(), 0, 'reservation returned only after a proven failure');
    // paying with no hash cannot be verified
    h.db.store.set('sf_block_claims/e1_b1', { epoch: 1, block: 1, uid: ALICE, amount: 4200, frozenLn: 'alice@wallet.example', status: 'paying', attempts: 1 });
    assert.strictEqual((await h.svc.resolveReview(ADMIN, { epoch: 1, block: 1, action: 'release', note: 'x' })).code, 'refused_unverifiable');
    // manual_review that still carries the last hash: lookup must prove failure
    h.db.store.set('sf_block_claims/e1_b2', { epoch: 1, block: 2, uid: ALICE, amount: 4200, frozenLn: 'alice@wallet.example', status: 'manual_review', reviewReason: 'route_fee_high', attempts: 2, paymentHash: 'abc' });
    h.lookupState = 'pending';
    assert.strictEqual((await h.svc.resolveReview(ADMIN, { epoch: 1, block: 2, action: 'release', note: 'x' })).code, 'refused_payment_not_failed');
});

test('review release: does not reset attempts or bypass fee_halt, route-hint check or caps', async function () {
    const h = reviewHarness();
    await freeze(h, 1);
    // attempts kept: a block at max strikes is refused by release (see the repeat_failures test)
    h.db.store.set('sf_block_claims/e1_b4', { epoch: 1, block: 4, uid: CARA, amount: 4200, frozenLn: 'cara@wallet.example', status: 'manual_review', reviewReason: 'repeat_failures', attempts: 3 });
    assert.strictEqual((await h.svc.resolveReview(ADMIN, { epoch: 1, block: 4, action: 'release', note: 'x' })).code, 'refused_repeat_failures');
    assert.strictEqual(claimDoc(h, 'e1_b4').attempts, 3);
    assert.strictEqual((await h.svc.claim(ctx(CARA), { epoch: 1, block: 4 })).code, 'manual_review');
    // fee_halt still applies
    await h.svc.resolveReview(ADMIN, { epoch: 1, block: 3, action: 'release', note: 'x' });
    h.db.store.set('sf_claim_counters/' + core.FEE_HALT_DOC_ID, { halted: true });
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'fee_halt');
    h.db.store.set('sf_claim_counters/' + core.FEE_HALT_DOC_ID, { halted: false });
    // route-hint fee check still applies
    h.invoiceMutator = function (d) { d.tags.push(hint(50000, 50000)); return d; };
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'route_fee_high');
    assert.strictEqual(h.pays.length, 0);
    // caps still apply
    const h2 = reviewHarness();
    await freeze(h2, 1);
    await h2.svc.resolveReview(ADMIN, { epoch: 1, block: 3, action: 'release', note: 'x' });
    h2.db.store.set('sf_claim_counters/site_' + new Date(h2.clock).toISOString().slice(0, 10), { sats: 21000 });
    assert.strictEqual((await h2.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'site_daily_cap');
});

test('review release: a repeat_failures block (attempts >= maxAttempts) is refused, writes nothing, is audited, never resets attempts', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    // Real path: three wallet refusals, each confirmed failed by lookup, put the block in review as repeat_failures.
    h.payMode = 'refuse';
    h.lookupState = 'failed';
    for (let i = 0; i < 3; i++) {
        assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'pay_failed');
        h.clock += 120000;
    }
    const before = clone(claimDoc(h, 'e1_b3'));
    assert.strictEqual(before.status, 'manual_review'); assert.strictEqual(before.reviewReason, 'repeat_failures'); assert.strictEqual(before.attempts, 3);
    const storeBefore = JSON.stringify(Array.from(h.db.store.entries()).filter(function (e) { return e[0].indexOf('sf_claim_audit/') !== 0; }));
    let lookups = 0;
    const realWallet = h.deps.wallet;
    h.deps.wallet = function (cfg) { const w = realWallet(cfg); const lk = w.lookupInvoice; w.lookupInvoice = async function (q) { lookups++; return lk(q); }; return w; };
    const r = await h.svc.resolveReview(ADMIN, { epoch: 1, block: 3, action: 'release', note: 'wallet looked fine' });
    assert.strictEqual(r.code, 'refused_repeat_failures', JSON.stringify(r)); assert.strictEqual(r.ok, false);
    assert.strictEqual(r.before, 'manual_review'); assert.strictEqual(r.after, 'manual_review');
    assert.strictEqual(r.attempts, 3); assert.strictEqual(r.maxAttempts, 3);
    assert.strictEqual(lookups, 0, 'no wallet lookup for a release that cannot help');
    // Nothing written except the audit row.
    const storeAfter = JSON.stringify(Array.from(h.db.store.entries()).filter(function (e) { return e[0].indexOf('sf_claim_audit/') !== 0; }));
    assert.strictEqual(storeAfter, storeBefore, 'release refusal writes nothing outside the audit log');
    assert.deepStrictEqual(claimDoc(h, 'e1_b3'), before);
    assert.ok(!claimDoc(h, 'e1_b3').reviewReleased);
    const a = reviewAudits(h);
    assert.strictEqual(a.length, 1);
    assert.deepStrictEqual([a[0].action, a[0].code, a[0].by, a[0].before, a[0].after, a[0].epoch, a[0].block], ['release', 'refused_repeat_failures', 'admin\u2026', 'manual_review', 'manual_review', 1, 3]);
    assert.ok(/wallet looked fine/.test(a[0].note));
    // The claim is still refused the same way, and nothing was paid by the admin path.
    h.payMode = 'paid';
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'manual_review');
    assert.strictEqual(claimDoc(h, 'e1_b3').attempts, 3, 'attempts never reset');
    assert.strictEqual(h.pays.length, 3);
    // A raised maxAttempts is honored by both paths: release then works, attempts still kept.
    h.db.store.set('config/satoshiFavorPayouts', Object.assign({}, h.db.store.get('config/satoshiFavorPayouts'), { maxAttempts: 4 }));
    h.lookupState = 'failed'; // the last refused attempt left a hash: the wallet must prove it failed
    const r2 = await h.svc.resolveReview(ADMIN, { epoch: 1, block: 3, action: 'release', note: 'raised limit' });
    assert.strictEqual(r2.code, 'released', JSON.stringify(r2));
    assert.strictEqual(claimDoc(h, 'e1_b3').attempts, 3, 'a release never resets attempts');
    assert.ok((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).success);
    assert.strictEqual(claimDoc(h, 'e1_b3').attempts, 4);
});

test('review reject is final: create-only marker, no path back to claimable, claims refused', async function () {
    const h = reviewHarness();
    await freeze(h, 1);
    const r = await h.svc.resolveReview(ADMIN, { epoch: 1, block: 3, action: 'reject', note: 'not the winner\u2019s wallet' });
    assert.strictEqual(r.code, 'rejected'); assert.strictEqual(r.after, 'rejected');
    assert.ok(h.db.store.get('sf_claim_reviews/e1_b3_rejected'));
    assert.strictEqual(claimDoc(h, 'e1_b3').status, 'rejected');
    assert.strictEqual((await h.svc.resolveReview(ADMIN, { epoch: 1, block: 3, action: 'release', note: 'undo' })).code, 'refused_rejected');
    assert.strictEqual((await h.svc.resolveReview(ADMIN, { epoch: 1, block: 3, action: 'reject', note: 'again' })).code, 'noop');
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'review_rejected');
    // Even if the claim doc were flipped back by hand, the marker still refuses.
    h.db.store.set('sf_block_claims/e1_b3', Object.assign({}, claimDoc(h, 'e1_b3'), { status: 'claimable', reviewReleased: true }));
    assert.strictEqual((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).code, 'review_rejected');
    assert.strictEqual(h.pays.length, 0);
    assert.ok(core.PERMANENT_COLLECTIONS.indexOf('sf_claim_reviews') !== -1);
    assert.ok(reviewAudits(h).every(function (a) { return a.by === 'admin\u2026' && 'before' in a && 'after' in a && typeof a.note === 'string'; }));
});

test('wiring: adminResolveFavorReview needs admin + fresh step-up every call, App Check, kill-switch gate, own FRESH action', function () {
    const fns = fs.readFileSync(path.join(root, 'functions/src/favorBlockClaimsFns.js'), 'utf8');
    assert.ok(/const adminResolveFavorReview = functionsV1\.runWith\(\{\s*enforceAppCheck: true,/.test(fns));
    assert.ok(/requireAdmin\(context\);\s*const secondFactor = require\('\.\/secondFactor'\);\s*await secondFactor\.requireAdminStepUp\(secondFactor\.stamp\(data, context\), 'adminResolveFavorReview'\);/.test(fns));
    assert.ok(/adminResolveFavorReview: true/.test(fs.readFileSync(path.join(root, 'functions/src/secondFactor.js'), 'utf8')));
    const decl = fns.slice(fns.indexOf('const adminResolveFavorReview'), fns.indexOf('.https.onCall', fns.indexOf('const adminResolveFavorReview')));
    assert.ok(decl.indexOf('secrets') === -1 && decl.indexOf('nwcUrlSecret') === -1, 'never binds the wallet secret');
    const ks = require(path.join(root, 'functions/src/killSwitch.js'));
    assert.ok(ks.gatedNames().indexOf('adminResolveFavorReview') !== -1);
    assert.ok(/exports\.adminResolveFavorReview = favorBlockClaimFns\.adminResolveFavorReview;/.test(fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8')));
    const core2 = fs.readFileSync(path.join(root, 'functions/src/favorBlockClaims.js'), 'utf8');
    const body = core2.slice(core2.indexOf('async function resolveReview'), core2.indexOf('return { claim: claim'));
    assert.ok(body.indexOf('payInvoice') === -1 && body.indexOf('resolveInvoice') === -1, 'review never pays');
    assert.ok(!/\.delete\(/.test(body));
});

// ---------- static guards over the repo ----------
function walk(dir, out) {
    fs.readdirSync(dir).forEach(function (n) {
        if (n === 'node_modules' || n.startsWith('.')) return;
        const p = path.join(dir, n);
        if (fs.statSync(p).isDirectory()) walk(p, out); else if (/\.(js|mjs|cjs|py|sh)$/.test(n)) out.push(p);
    });
    return out;
}
const serverFiles = walk(path.join(root, 'functions'), []).concat(fs.existsSync(path.join(root, 'scripts')) ? walk(path.join(root, 'scripts'), []) : []);

test('only the epoch-close transaction in satoshiFavor.js writes sfPoolHistory (admin, backfill and scripts read only)', function () {
    const all = walk(root, []).filter(function (p) { return !/[\\/]tests[\\/]/.test(p); });
    const writers = [];
    all.forEach(function (p) {
        const s = fs.readFileSync(p, 'utf8');
        let i = -1;
        const re = /collection\(\s*['"]sfPoolHistory['"]\s*\)/g;
        let m;
        while ((m = re.exec(s))) {
            const tail = s.slice(m.index, m.index + 160).split(';')[0];
            const assigned = /const\s+(\w+)\s*=\s*$/.exec(s.slice(Math.max(0, m.index - 60), m.index).replace(/db\.\s*$/, '').replace(/\w+\.$/, ''));
            let writes = /\.(set|update|delete|add|create)\(/.test(tail);
            if (assigned) {
                const v = assigned[1];
                writes = writes || new RegExp('\\b' + v + '\\.(set|update|delete|create)\\(|\\.(set|update|delete|create)\\(\\s*' + v + '\\b').test(s);
            }
            if (writes) writers.push(path.relative(root, p));
            i = m.index;
        }
    });
    // The staging QA seeder may add a NEW fake epoch on bitcoin-quest-staging only.
    assert.deepStrictEqual(Array.from(new Set(writers)).sort(), ['functions/src/satoshiFavor.js', 'scripts/staging/seed-favor-winners.js']);
    const seed = fs.readFileSync(path.join(root, 'scripts/staging/seed-favor-winners.js'), 'utf8');
    assert.ok(seed.includes("if (project !== STAGING) die("), 'seeder refuses every project but staging');
    assert.ok(seed.includes("const STAGING = 'bitcoin-quest-staging';"));
    assert.ok(/die\('epoch ' \+ epoch \+ ' already exists with other winners/.test(seed), 'seeder never edits an existing epoch');
    assert.strictEqual((seed.match(/collection\('sfPoolHistory'\)\.doc\(\)\.set\(/g) || []).length, 1, 'seeder only adds a new doc');
    assert.ok(!/sfPoolHistory'\)\.doc\([^)]/.test(seed), 'seeder never addresses an existing history doc');
    const sf = fs.readFileSync(path.join(root, 'functions/src/satoshiFavor.js'), 'utf8');
    assert.strictEqual((sf.match(/collection\('sfPoolHistory'\)/g) || []).length, 1, 'one reference: the close transaction');
    assert.ok(/const histRef = db\.collection\('sfPoolHistory'\)\.doc\(\);\s*\n\s*tx\.set\(histRef/.test(sf));
});

test('no server code or script deletes a permanent Favor record (excluded from every cleanup)', function () {
    const offenders = [];
    serverFiles.forEach(function (p) {
        const s = fs.readFileSync(p, 'utf8');
        core.PERMANENT_COLLECTIONS.forEach(function (c) {
            const re = new RegExp("['\"]" + c + "['\"][^;\\n]*\\.delete\\(|recursiveDelete\\([^)]*" + c + "|['\"]" + c + "['\"][\\s\\S]{0,200}batch\\.delete", 'm');
            if (re.test(s)) offenders.push(path.relative(root, p) + ':' + c);
        });
    });
    assert.deepStrictEqual(offenders, []);
    const fbc = fs.readFileSync(path.join(root, 'functions/src/favorBlockClaims.js'), 'utf8');
    assert.ok(!/\.delete\(/.test(fbc), 'claim module never deletes');
});

test('rules: claim, payout, counter, audit and history docs are not client-writable', function () {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    function block(m) {
        const i = rules.indexOf(m);
        assert.ok(i !== -1, m);
        return rules.slice(i, rules.indexOf('\n    }', i));
    }
    ['match /sf_block_claims/{claimId}', 'match /sf_block_payouts/{claimId}', 'match /sf_claim_counters/{id}', 'match /sf_claim_audit/{id}']
        .forEach(function (m) { assert.ok(/allow read, write: if false;/.test(block(m)), m); });
    assert.ok(/allow write: if false;/.test(block('match /sfPoolHistory/{docId}')));
    assert.ok(/allow write: if false;/.test(block('match /sf_payout_results/{resultId}')));
    assert.ok(/allow write: if false;/.test(block('match /config/satoshiFavorPayouts')));
});

test('no time-based expiry anywhere in the claim module', function () {
    const src = fs.readFileSync(path.join(root, 'functions/src/favorBlockClaims.js'), 'utf8');
    assert.ok(!/claimDeadline|expiresAt|expireAt|claimBy|deadline/i.test(src.replace(/timeExpireDate/g, '')));
});

test('wiring: claimFavorBlock is kill-switch gated, step-up action exists, staging never binds the wallet', function () {
    const ks = require(path.join(root, 'functions/src/killSwitch.js'));
    assert.ok(ks.gatedNames().indexOf('claimFavorBlock') !== -1);
    const sfSrc = fs.readFileSync(path.join(root, 'functions/src/secondFactor.js'), 'utf8');
    assert.ok(/claimFavorBlock: true/.test(sfSrc) && /adminSetFavorClaims: true/.test(sfSrc));
    const fns = fs.readFileSync(path.join(root, 'functions/src/favorBlockClaimsFns.js'), 'utf8');
    assert.ok(fns.includes('secrets: staging ? [deletionHmacSecret] : [deletionHmacSecret, nwcUrlSecret]'));
    assert.ok(/if \(staging\) \{[\s\S]{0,250}if \(nwcUrl\(\)\) throw[\s\S]{0,80}if \(cfg\.mockWallet !== true\)/.test(fns));
    assert.ok(/Mock wallet is staging only/.test(fns));
    const idx = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    assert.ok(!/adminApproveFavorPayout/.test(idx), 'no admin approve step');
});

// ---- Hidden wallet pubkey (live Alby Hub get_info returns pubkey '') ----

function assertRefusedNoPay(h, r, code, label) {
    assert.strictEqual(r.code, code, label + ': ' + JSON.stringify(r));
    assert.strictEqual(h.pays.length, 0, label + ': nothing paid');
    const c = h.db.store.get('sf_block_claims/e1_b3');
    assert.ok(c.status === 'claimable' || c.status === 'manual_review', label + ': block released, got ' + c.status);
    assert.strictEqual(h.db.store.get('sf_claim_counters/site_2026-11-14').sats, 0, label + ': site counter released');
}

test('blank pubkey: a valid claim pays once, logs the skipped own_node check (epoch+block only), records ownNodeCheck false', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.ownPubkey = '';
    const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.ok(r.success, JSON.stringify(r));
    assert.strictEqual(h.pays.length, 1);
    assert.strictEqual(h.db.store.get('sf_block_claims/e1_b3').status, 'paid');
    const payout = h.db.store.get('sf_block_payouts/e1_b3');
    assert.strictEqual(payout.ownNodeCheck, false);
    const paidAudit = keys(h, 'sf_claim_audit/').map(function (k) { return h.db.store.get(k); }).filter(function (a) { return a.type === 'paid'; });
    assert.strictEqual(paidAudit.length, 1); assert.strictEqual(paidAudit[0].ownNodeCheck, false);
    assert.strictEqual(h.warns.length, 1);
    assert.ok(/WITHOUT own_node check/.test(h.warns[0].msg));
    assert.deepStrictEqual(h.warns[0].data, { epoch: 1, block: 3 });
    const blob = JSON.stringify(h.warns);
    assert.ok(blob.indexOf(BOB) === -1 && blob.indexOf('bob@wallet.example') === -1, 'no uid or address in the log');
    // A second claim on the same block does not pay again.
    const again = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.ok(!again.success);
    assert.strictEqual(h.pays.length, 1);
});

test('real pubkey: own_node check runs, no warning, payout records ownNodeCheck true', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    assert.ok((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).success);
    assert.strictEqual(h.warns.length, 0);
    assert.strictEqual(h.db.store.get('sf_block_payouts/e1_b3').ownNodeCheck, true);
});

test('getInfo that throws/times out or returns nothing still fails closed as wallet_unavailable, nothing paid', async function () {
    for (const mode of ['throw', 'null']) {
        const h = makeHarness();
        await freeze(h, 1);
        h.infoMode = mode;
        const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
        assertRefusedNoPay(h, r, 'wallet_unavailable', 'getInfo ' + mode);
        assert.strictEqual(h.warns.length, 0, 'no skip warning when it fails closed');
    }
});

test('getBalance failure still refuses with wallet_unavailable, even with a blank pubkey', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.ownPubkey = '';
    h.balanceThrows = true;
    const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assertRefusedNoPay(h, r, 'wallet_unavailable', 'getBalance');
});

test('wallet floor still holds with a blank pubkey', async function () {
    const h = makeHarness({ balanceSats: 100 });
    await freeze(h, 1);
    h.ownPubkey = '';
    const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assertRefusedNoPay(h, r, 'wallet_low', 'floor');
});

test('real pubkey: an invoice paying our own node is still refused', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.invoiceMutator = function (d) { d.payeeNodeKey = OWN_NODE; return d; };
    const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assertRefusedNoPay(h, r, 'bad_invoice', 'own node');
});

test('blank pubkey: wrong amount, expired, wrong network and missing payee are each still refused', async function () {
    const cases = [
        ['wrong amount', function (d) { d.millisatoshis = '4200000'; return d; }],
        ['expired', function (d) { d.timeExpireDate = 1; return d; }],
        ['no payee', function (d) { d.payeeNodeKey = ''; return d; }],
    ];
    for (const c of cases) {
        const h = makeHarness();
        await freeze(h, 1);
        h.ownPubkey = '';
        h.invoiceMutator = c[1];
        const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
        assertRefusedNoPay(h, r, 'bad_invoice', c[0]);
        assert.strictEqual(h.lastResolve.ln, 'bob@wallet.example', c[0] + ': invoice only for the frozen address');
    }
    // Wrong network: a testnet invoice for the right amount.
    const h = makeHarness();
    await freeze(h, 1);
    h.ownPubkey = '';
    const svc = core.createBlockClaimService(Object.assign({}, h.deps, {
        resolveInvoice: async function (ln, sats) { h.lastResolve = { ln: ln, sats: sats }; return 'lntb' + sats + 'n1fake'; },
        decodeInvoice: function (bolt) {
            return { millisatoshis: String(Number(/^lntb(\d+)n1/.exec(bolt)[1]) * 1000), timeExpireDate: Math.floor(h.clock / 1000) + 600,
                payeeNodeKey: PAYEE, tags: [{ tagName: 'payment_hash', data: 'ab'.repeat(32) }] };
        },
    }));
    assertRefusedNoPay(h, await svc.claim(ctx(BOB), { epoch: 1, block: 3 }), 'bad_invoice', 'wrong network');
});

test('staging mock wallet: mockBlankPubkey is staging-only and makes getInfo return a blank pubkey', function () {
    assert.strictEqual(core.readConfig({}).mockBlankPubkey, false);
    assert.strictEqual(core.readConfig({ mockBlankPubkey: true }).mockBlankPubkey, true);
    assert.strictEqual(core.readConfig({ mockBlankPubkey: 'yes' }).mockBlankPubkey, false);
    const fns = fs.readFileSync(path.join(root, 'functions/src/favorBlockClaimsFns.js'), 'utf8');
    const smwSrc = fs.readFileSync(path.join(root, 'functions/src/stagingMockWallet.js'), 'utf8');
    assert.ok(/getInfo: async function \(\) \{ return \{ pubkey: cfg\.mockBlankPubkey === true \? '' : MOCK_NODE_PUBKEY \}; \}/.test(smwSrc));
    assert.ok(/return require\('\.\/stagingMockWallet'\)\.createMockWallet\(cfg\);/.test(fns));
    assert.ok(/d\.mockBlankPubkey != null \|\| d\.mockLookupOutcome != null \|\| d\.mockBalanceOutcome != null\) \{\s*if \(!staging\) throw new HttpsError\('permission-denied'/.test(fns), 'same staging-only guard as the other mock fields');
    assert.ok(/logWarn: function \(msg, data\) \{ require\('firebase-functions\/logger'\)\.warn\(msg, data \|\| \{\}\); \}/.test(fns));
});

// ---------- reserve-then-pay in msat (max fee included) ----------
test('capCheck: prize caps unchanged; spend check uses reserved msat plus fee headroom', function () {
    const cfg = core.readConfig({ perUidDailySats: 12600, siteDailySats: 21000, monthlySats: 45000 });
    assert.strictEqual(core.capCheck(cfg, 4200, { uidDay: 8400, siteDay: 0, month: 0 }, null), '');
    assert.strictEqual(core.capCheck(cfg, 4200, { uidDay: 8400, siteDay: 0, month: 0 }, null), '', '3rd 4,200 prize still fits');
    assert.strictEqual(core.capCheck(cfg, 4200, { uidDay: 12600, siteDay: 0, month: 0 }, null), 'uid_daily_cap');
    const reserved = 4190 * 1000 + core.routeFeeLimitMsat(4190);
    assert.ok(reserved > 4190 * 1000);
    assert.strictEqual(core.capCheck(cfg, 4200, {
        uidDay: 8400, siteDay: 0, month: 0,
        uidDayMsat: 2 * reserved, siteDayMsat: 0, monthMsat: 0,
        reservedMsat: reserved, feeLimitMsatFn: core.routeFeeLimitMsat,
    }, null), '');
    assert.strictEqual(core.capCheck(cfg, 4200, {
        uidDay: 0, siteDay: 0, month: 4200,
        uidDayMsat: 0, siteDayMsat: 0, monthMsat: reserved,
        reservedMsat: reserved, feeLimitMsatFn: core.routeFeeLimitMsat,
    }, { ceiling: 0 }), 'catch_up_ceiling');
});

test('reserve includes max routing fee in msat; failure releases both sats and msats', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    h.invoiceMutator = function (d) { d.millisatoshis = '1'; return d; };
    const r = await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 });
    assert.strictEqual(r.code, 'bad_invoice');
    const site = h.db.store.get('sf_claim_counters/site_2026-11-14') || {};
    assert.strictEqual(site.sats || 0, 0, 'prize reserve released');
    assert.strictEqual(site.msats || 0, 0, 'msat reserve released');
    assert.strictEqual(h.pays.length, 0);
});

test('paid claim trues spend up to net + actual fee and keeps the prize sats on daily counters', async function () {
    const h = makeHarness();
    await freeze(h, 1);
    assert.ok((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).success);
    const net = 4190;
    const uid = h.db.store.get('sf_claim_counters/uid_' + core.uidHash(BOB) + '_2026-11-14');
    const site = h.db.store.get('sf_claim_counters/site_2026-11-14');
    const month = h.db.store.get('sf_claim_counters/catchup_e1_8');
    assert.strictEqual(uid.sats, 4200);
    assert.strictEqual(site.sats, 4200);
    assert.strictEqual(uid.msats, net * 1000);
    assert.strictEqual(site.msats, net * 1000);
    assert.strictEqual(month.sats, net);
    assert.strictEqual(month.msats, net * 1000);
    const claim = h.db.store.get('sf_block_claims/e1_b3');
    assert.ok(claim.reservedMsat > net * 1000, 'reservation included max fee');
    assert.strictEqual(claim.reservedMsat, net * 1000 + core.routeFeeLimitMsat(net));
});

test('cap hit alerts once and does not pay', async function () {
    const h = makeHarness({ epochs: 2, config: { enabledEpochs: [1, 2], siteDailySats: 4200 } });
    await freeze(h, 1); await freeze(h, 2);
    assert.ok((await h.svc.claim(ctx(BOB), { epoch: 1, block: 3 })).success);
    const r = await h.svc.claim(ctx(CARA), { epoch: 1, block: 4 });
    assert.strictEqual(r.code, 'site_daily_cap');
    assert.ok(h.alerts.some(function (a) { return /site daily cap/.test(a); }));
    assert.strictEqual(h.pays.length, 1);
});

(async function main() {
    for (const t of queue) {
        try { await t.fn(); console.log('\u2705 ' + t.name); passed++; }
        catch (e) { console.log('\u274c ' + t.name + ': ' + (e && e.stack || e)); failed++; }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
