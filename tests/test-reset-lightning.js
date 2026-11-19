// One-time Lightning address reset. Firestore is in memory. The resolver is injected.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createResetHandlers, REAUTH_MAX_AGE_SEC } = require('../functions/src/resetLightningAddress');

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
const NOW_SEC = 1700000000;

function signedIn(uid, authTime) {
    return {
        auth: {
            uid: uid,
            token: {
                email_verified: true,
                firebase: { sign_in_provider: 'google.com' },
                auth_time: authTime === undefined ? NOW_SEC : authTime,
            },
        },
    };
}

function handlers(mem, resolve) {
    const calls = [];
    const stepUpCalls = [];
    return {
        calls: calls,
        stepUpCalls: stepUpCalls,
        api: createResetHandlers({
            db: mem.db,
            admin: admin,
            verifyTurnstile: async function () { return true; },
            requireSecondFactor: async function () { stepUpCalls.push(1); },
            nowSec: function () { return NOW_SEC; },
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

queue.push(test('an address already saved on another account is not locked by a reset', async function () {
    const mem = memDb({
        'users/user1': { lightningAddress: 'old@dead.example', emailVerified: true, providers: ['google.com'] },
        'users/alice': { lightning: 'alice@walletofsatoshi.com' },
    });
    const h = handlers(mem, async function (opts) {
        if (opts.address === 'old@dead.example') {
            const err = new Error('Could not resolve Lightning Address. Check the address and try again.');
            err.code = 'resolve_failed';
            throw err;
        }
        return { pr: 'lnbc', domain: opts.address.split('@')[1] };
    });
    const out = await h.api.resetLightningAddressOnce({
        lightningAddress: 'Alice@WalletOfSatoshi.com',
        turnstileToken: 'ok',
    }, signedIn('user1'));
    assert.strictEqual(out.ok, false);
    assert.strictEqual(out.code, 'address_conflict');
    assert.strictEqual(mem.store['lightning_addresses/alice@walletofsatoshi.com'], undefined);
    assert.strictEqual(mem.store['ln_resets/user1'], undefined);
    assert.strictEqual(mem.store['users/user1'].lightningAddress, 'old@dead.example');
    assert.strictEqual(mem.store['users/alice'].lightning, 'alice@walletofsatoshi.com');
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
    assert.ok(mem.store['users/user1'].lightningAddressChangedAt, 'reset stamps the 48h payout hold');
    assert.strictEqual(mem.store['ln_resets/user1'].domain, 'blink.sv');
    assert.strictEqual(mem.store['ln_resets/user1'].ln_reset_used.ts, 1);
    assert.ok(JSON.stringify(mem.store['ln_resets/user1']).indexOf('fresh@') === -1);
    assert.strictEqual(mem.store['lightning_addresses/fresh@blink.sv'].uid, 'user1');
    assert.ok(h.stepUpCalls.length >= 1);
    const again = await h.api.resetLightningAddressOnce({
        lightningAddress: 'other@speed.app',
        turnstileToken: 'ok',
    }, signedIn('user1'));
    assert.strictEqual(again.code, 'already_used');
}));

queue.push(test('a session without a recent sign-in cannot reset the address', async function () {
    const mem = memDb({
        'users/user1': { emailVerified: true, providers: ['google.com'] },
    });
    const h = handlers(mem, async function () { return { pr: 'lnbc', domain: 'walletofsatoshi.com' }; });
    let err = null;
    try {
        await h.api.resetLightningAddressOnce({
            lightningAddress: 'fresh@walletofsatoshi.com',
            turnstileToken: 'ok',
        }, signedIn('user1', NOW_SEC - REAUTH_MAX_AGE_SEC - 1));
    } catch (e) { err = e; }
    assert.ok(err, 'expected refusal');
    assert.strictEqual(err.code, 'failed-precondition');
    assert.ok(String(err.message).indexOf('Sign in again') !== -1);
    assert.strictEqual(h.calls.length, 0);
    assert.strictEqual(h.stepUpCalls.length, 0);
    assert.ok(!mem.store['users/user1'].lightningAddress);
    assert.ok(!mem.store['ln_resets/user1']);
}));

queue.push(test('a session with no sign-in time cannot reset the address', async function () {
    const mem = memDb({
        'users/user1': { emailVerified: true, providers: ['google.com'] },
    });
    const h = handlers(mem, async function () { return { pr: 'lnbc', domain: 'walletofsatoshi.com' }; });
    const ctx = signedIn('user1');
    delete ctx.auth.token.auth_time;
    let err = null;
    try {
        await h.api.resetLightningAddressOnce({
            lightningAddress: 'fresh@walletofsatoshi.com',
            turnstileToken: 'ok',
        }, ctx);
    } catch (e) { err = e; }
    assert.ok(err, 'expected refusal');
    assert.strictEqual(err.code, 'failed-precondition');
    assert.ok(String(err.message).indexOf('Sign in again') !== -1);
    assert.strictEqual(h.calls.length, 0);
    assert.strictEqual(h.stepUpCalls.length, 0);
    assert.ok(!mem.store['ln_resets/user1']);
}));

queue.push(test('a sign-in at the window edge can still reach the address checks', async function () {
    const mem = memDb({
        'users/user1': { emailVerified: true, providers: ['google.com'] },
    });
    const h = handlers(mem, async function () { return { pr: 'lnbc', domain: 'walletofsatoshi.com' }; });
    const out = await h.api.resetLightningAddressOnce({
        lightningAddress: 'fresh@walletofsatoshi.com',
        turnstileToken: 'ok',
    }, signedIn('user1', NOW_SEC - REAUTH_MAX_AGE_SEC));
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.address, 'fresh@walletofsatoshi.com');
    assert.strictEqual(mem.store['users/user1'].lightningAddress, 'fresh@walletofsatoshi.com');
    assert.ok(mem.store['ln_resets/user1'].ln_reset_used);
    assert.strictEqual(h.stepUpCalls.length, 1);
}));


queue.push(test('an anonymous session is refused before the authenticator step', async function () {
    const mem = memDb({
        'users/user1': { emailVerified: true, providers: ['google.com'] },
    });
    const h = handlers(mem, async function () { return { pr: 'lnbc', domain: 'walletofsatoshi.com' }; });
    const ctx = signedIn('user1');
    ctx.auth.token.firebase.sign_in_provider = 'anonymous';
    let err = null;
    try {
        await h.api.resetLightningAddressOnce({
            lightningAddress: 'fresh@walletofsatoshi.com',
            turnstileToken: 'ok',
        }, ctx);
    } catch (e) { err = e; }
    assert.ok(err, 'expected refusal');
    assert.strictEqual(err.code, 'permission-denied');
    assert.ok(String(err.message).indexOf('Account required') !== -1);
    assert.strictEqual(h.stepUpCalls.length, 0);
    assert.strictEqual(h.calls.length, 0);
    assert.ok(!mem.store['ln_resets/user1']);
}));

queue.push(test('a signed-out call is refused before the authenticator step', async function () {
    const mem = memDb({
        'users/user1': { emailVerified: true, providers: ['google.com'] },
    });
    const h = handlers(mem, async function () { throw new Error('should not fetch'); });
    let err = null;
    try {
        await h.api.resetLightningAddressOnce({
            lightningAddress: 'fresh@walletofsatoshi.com',
            turnstileToken: 'ok',
        }, {});
    } catch (e) { err = e; }
    assert.ok(err, 'expected refusal');
    assert.strictEqual(err.code, 'unauthenticated');
    assert.strictEqual(h.stepUpCalls.length, 0);
    assert.strictEqual(h.calls.length, 0);
}));

queue.push(test('a successful reset stamps lightningAddressChangedAt for the 48h payout hold', async function () {
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
        lightningAddress: 'fresh@blink.sv',
        turnstileToken: 'ok',
    }, signedIn('user1'));
    assert.strictEqual(out.ok, true);
    assert.ok(mem.store['users/user1'].lightningAddressChangedAt);
    const resetSrc = fs.readFileSync(path.join(root, 'functions/src/resetLightningAddress.js'), 'utf8');
    assert.ok(resetSrc.indexOf('lightningAddressChangedAt') !== -1);
    const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    assert.ok(index.indexOf('assessAddressChangeHold') !== -1, 'claimSats must refuse payouts during the 48h hold');
    assert.ok(index.indexOf('firstSetHold') !== -1, 'claimSats first-set stamps the hold and does not pay in the same call');
    assert.ok(index.indexOf('lightningAddressChangedAt: stamp') !== -1 || index.indexOf('lightningAddressChangedAt: stamp') !== -1);
    const emailSrc = fs.readFileSync(path.join(root, 'functions/src/emailChange.js'), 'utf8');
    const beginAt = emailSrc.indexOf('async function beginPayout');
    const begin = emailSrc.slice(beginAt, emailSrc.indexOf('function createEmailChangeHandlers', beginAt));
    assert.ok(begin.indexOf('assessAddressChangeHold') !== -1, 'beginPayout must apply the 48h hold to every payout path');
    assert.ok(begin.indexOf('userReadable') !== -1, 'an unreadable hold key holds the payout');
    const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    assert.ok(ranking.indexOf("For safety, payouts are paused for 48 hours.") !== -1, 'reset success screen mentions the 48h pause');
    assert.ok(ranking.indexOf("id = 'lnAddrStepSuccess'") !== -1 || ranking.indexOf("id = 'lnAddrStepSuccess'") !== -1 || ranking.indexOf("lnAddrStepSuccess") !== -1);
    const keysFn = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const keys = keysFn.slice(keysFn.indexOf('function userProfileServerOnlyKeys()'), keysFn.indexOf('match /users/{userId}'));
    assert.ok(keys.indexOf("'lightningAddressChangedAt'") !== -1, 'hold key is in the server-only list');
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
    assert.strictEqual((index.match(/enforceAppCheck:\s*true/g) || []).length, 9);
    assert.ok(resetSrc.indexOf('enforceAppCheck: true') > 0);
    assert.ok(index.indexOf('bindResetLightningAddress') > 0);
    assert.ok(index.indexOf('exports.resetLightningAddressOnce') > 0);
    assert.ok(index.indexOf("requireFreshStepUp(secondFactor.stamp(data, context), 'resetLightningAddress')") > 0);
    assert.ok(resetSrc.indexOf('authTimeOk(context.auth, nowSec())') > 0);
    assert.ok(resetSrc.indexOf('REAUTH_MAX_AGE_SEC') > 0);
    const handlerAt = resetSrc.indexOf('async function resetLightningAddressOnce');
    const handlerEnd = resetSrc.indexOf('\n    return { resetLightningAddressOnce', handlerAt);
    const handlerBody = resetSrc.slice(handlerAt, handlerEnd);
    const anonAt = handlerBody.indexOf("provider === 'anonymous'");
    const authAt = handlerBody.indexOf('authTimeOk(context.auth, nowSec())');
    const stepAt = handlerBody.indexOf('await requireSecondFactor(data, context)');
    assert.ok(handlerAt > 0 && handlerEnd > handlerAt);
    assert.ok(anonAt > 0 && authAt > anonAt && stepAt > authAt);
    assert.ok(handlerBody.indexOf("payoutAlerts.emit") > 0);
    const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    const callAt = ranking.indexOf('function _callResetLightning');
    assert.ok(callAt > 0);
    const callEnd = ranking.indexOf('\nfunction showWithdrawalAddressReadonly', callAt);
    const callBody = ranking.slice(callAt, callEnd);
    assert.ok(callBody.indexOf("reauthForSensitiveAction('changing your Lightning Address')") > 0);
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