// One-time Lightning address reset. Firestore is in memory. The resolver is injected.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createResetHandlers } = require('../functions/src/resetLightningAddress');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        const pending = fn();
        if (pending && typeof pending.then === 'function') {
            return pending.then(function () {
                console.log('✅ ' + name);
                passed++;
            }).catch(function (e) {
                console.log('❌ ' + name + ': ' + e.message);
                failed++;
            });
        }
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
    return Promise.resolve();
}

function memDb(initial) {
    const store = Object.assign({}, initial || {});
    const writes = [];
    function snap(docPath) {
        const data = store[docPath];
        return {
            exists: data !== undefined,
            id: docPath.split('/').pop(),
            data: function () { return data ? Object.assign({}, data) : undefined; },
        };
    }
    function querySnap(paths) {
        return {
            forEach: function (fn) {
                paths.forEach(function (docPath) {
                    fn({
                        id: docPath.split('/').pop(),
                        data: function () { return Object.assign({}, store[docPath]); },
                    });
                });
            },
        };
    }
    function docRef(docPath) {
        return {
            path: docPath,
            id: docPath.split('/').pop(),
            get: function () { return Promise.resolve(snap(docPath)); },
        };
    }
    function collection(name) {
        return {
            doc: function (id) { return docRef(name + '/' + id); },
            where: function (field, op, value) {
                return {
                    limit: function () {
                        return {
                            get: function () {
                                const hits = Object.keys(store).filter(function (docPath) {
                                    return docPath.indexOf(name + '/') === 0 && store[docPath] && store[docPath][field] === value;
                                });
                                return Promise.resolve(querySnap(hits));
                            },
                        };
                    },
                };
            },
        };
    }
    return {
        store: store,
        writes: writes,
        db: {
            collection: collection,
            runTransaction: async function (fn) {
                const t = {
                    get: function (target) { return target.get(); },
                    set: function (ref, data, opts) {
                        writes.push({ path: ref.path, data: data });
                        const prev = (opts && opts.merge && store[ref.path]) ? store[ref.path] : {};
                        const next = Object.assign({}, prev);
                        Object.keys(data || {}).forEach(function (key) { next[key] = data[key]; });
                        store[ref.path] = next;
                    },
                };
                await fn(t);
            },
        },
    };
}

const admin = { firestore: { FieldValue: { serverTimestamp: function () { return { ts: 1 }; } } } };

function signedIn(uid) {
    return {
        auth: {
            uid: uid,
            token: {
                email_verified: true,
                firebase: { sign_in_provider: 'google.com' },
            },
        },
    };
}

function handlers(mem, resolve) {
    const calls = [];
    return {
        calls: calls,
        api: createResetHandlers({
            db: mem.db,
            admin: admin,
            verifyTurnstile: async function () { return true; },
            requireSecondFactor: async function () {},
            resolveLnurlInvoice: async function (opts) {
                calls.push(opts);
                return resolve(opts);
            },
        }),
    };
}

const queue = [];

queue.push(test('a working address is not replaced and the resolver is not asked for the new one', async function () {
    const mem = memDb({
        'users/user1': { lightningAddress: 'good@walletofsatoshi.com', emailVerified: true, providers: ['google.com'] },
    });
    const h = handlers(mem, async function () { return { pr: 'lnbc', domain: 'walletofsatoshi.com' }; });
    const out = await h.api.resetLightningAddressOnce({
        lightningAddress: 'new@blink.sv',
        turnstileToken: 'ok',
    }, signedIn('user1'));
    assert.strictEqual(out.ok, false);
    assert.strictEqual(out.code, 'address_works');
    assert.strictEqual(h.calls.length, 1);
    assert.strictEqual(h.calls[0].address, 'good@walletofsatoshi.com');
    assert.strictEqual(mem.writes.length, 0);
    assert.strictEqual(mem.store['ln_resets/user1'], undefined);
}));

queue.push(test('the reset can be used once', async function () {
    const mem = memDb({
        'users/user1': { lightningAddress: '', emailVerified: true, providers: ['google.com'] },
        'ln_resets/user1': { ln_reset_used: { ts: 1 }, domain: 'old.example' },
    });
    const h = handlers(mem, async function () { throw new Error('should not fetch'); });
    const out = await h.api.resetLightningAddressOnce({
        lightningAddress: 'new@blink.sv',
        turnstileToken: 'ok',
    }, signedIn('user1'));
    assert.strictEqual(out.ok, false);
    assert.strictEqual(out.code, 'already_used');
    assert.strictEqual(h.calls.length, 0);
}));

queue.push(test('a banned account is rejected before any lookup', async function () {
    const mem = memDb({
        'users/user1': { lightningAddress: 'old@dead.example', satsDisabled: true, emailVerified: true },
    });
    const h = handlers(mem, async function () { throw new Error('should not fetch'); });
    const out = await h.api.resetLightningAddressOnce({
        lightningAddress: 'new@blink.sv',
        turnstileToken: 'ok',
    }, signedIn('user1'));
    assert.strictEqual(out.ok, false);
    assert.strictEqual(out.code, 'banned');
    assert.strictEqual(h.calls.length, 0);
}));

queue.push(test('an address locked to someone else is rejected', async function () {
    const mem = memDb({
        'users/user1': { emailVerified: true, providers: ['google.com'] },
        'users/other': { lightningAddress: 'taken@blink.sv' },
        'lightning_addresses/taken@blink.sv': { uid: 'other' },
    });
    const h = handlers(mem, async function (opts) {
        return { pr: 'lnbc', domain: opts.address.split('@')[1] };
    });
    const out = await h.api.resetLightningAddressOnce({
        lightningAddress: 'Lightning:Taken@Blink.sv',
        turnstileToken: 'ok',
    }, signedIn('user1'));
    assert.strictEqual(out.ok, false);
    assert.strictEqual(out.code, 'address_conflict');
    assert.strictEqual(mem.store['ln_resets/user1'], undefined);
    assert.strictEqual(mem.store['users/user1'].lightningAddress, undefined);
}));

queue.push(test('a broken address can be replaced once and the marker stores the domain only', async function () {
    const mem = memDb({
        'users/user1': { lightningAddress: 'old@dead.example', emailVerified: true, providers: ['google.com'] },
    });
    const h = handlers(mem, async function (opts) {
        if (opts.address === 'old@dead.example') {
            const err = new Error('Could not resolve Lightning Address. Check the address and try again.');
            err.code = 'resolve_failed';
            throw err;
        }
        return { pr: 'lnbc', domain: 'blink.sv' };
    });
    const out = await h.api.resetLightningAddressOnce({
        lightningAddress: 'mailto:Fresh@Blink.sv',
        turnstileToken: 'ok',
    }, signedIn('user1'));
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.address, 'fresh@blink.sv');
    assert.strictEqual(mem.store['users/user1'].lightningAddress, 'fresh@blink.sv');
    assert.strictEqual(mem.store['users/user1'].lightning, 'fresh@blink.sv');
    assert.strictEqual(mem.store['ln_resets/user1'].domain, 'blink.sv');
    assert.strictEqual(mem.store['ln_resets/user1'].ln_reset_used.ts, 1);
    assert.ok(JSON.stringify(mem.store['ln_resets/user1']).indexOf('fresh@') === -1);
    assert.strictEqual(mem.store['lightning_addresses/fresh@blink.sv'].uid, 'user1');
    const again = await h.api.resetLightningAddressOnce({
        lightningAddress: 'other@speed.app',
        turnstileToken: 'ok',
    }, signedIn('user1'));
    assert.strictEqual(again.code, 'already_used');
}));

queue.push(test('rules deny client address edits once one is saved, and the reset doc is server-only', function () {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    const resetSrc = fs.readFileSync(path.join(root, 'functions/src/resetLightningAddress.js'), 'utf8');
    assert.ok(rules.indexOf('function lightningLockOk()') > 0);
    assert.ok(rules.indexOf('let hasAny = oldL.size() > 0 || oldA.size() > 0 || oldN.size() > 0;') > 0);
    assert.ok(rules.indexOf("hasAny(['lightning', 'lightningAddress', 'lnAddress', 'ln_reset_used'])") > 0);
    assert.ok(rules.indexOf('return (!touched) || (!hasAny && firstSet);') > 0);
    const resetRule = rules.slice(rules.indexOf('match /ln_resets/{uid}'));
    assert.ok(resetRule.indexOf('allow read, write: if false;') === resetRule.indexOf('allow'));
    assert.ok(rules.indexOf("'flexFullDays', 'flexFullDay'") > 0);
    assert.strictEqual((index.match(/enforceAppCheck:\s*true/g) || []).length, 6);
    assert.ok(resetSrc.indexOf('enforceAppCheck: true') > 0);
    assert.ok(index.indexOf('bindResetLightningAddress') > 0);
    assert.ok(index.indexOf('exports.resetLightningAddressOnce') > 0);
    const start = index.indexOf('exports.claimSats');
    const end = index.indexOf('function _withTimeout');
    const body = index.slice(start, end);
    assert.ok(body.indexOf('data.invoice') === -1);
    assert.ok(body.indexOf('resolveLnurlInvoice') > 0);
    assert.ok(body.indexOf('address_unresolved') > 0);
    const banAt = body.indexOf('assessBan');
    const hostAt = body.indexOf('assertPublicHost');
    assert.ok(banAt > 0 && hostAt > banAt);
}));

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});