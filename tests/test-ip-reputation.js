// IP reputation and device holds. No Firebase, no network, no production data.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ipHmac = require('../functions/src/ipHmac');
const rep = require('../functions/src/ipReputation');
const migrate = require('../scripts/migrate-faucet-ip-hmac');

const SECRET = 'referral-secret-test-value';
const API_KEY = 'ipqs-test-key-0001';
const ROOT = path.join(__dirname, '..');

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

function read(name) {
    return fs.readFileSync(path.join(ROOT, name), 'utf8');
}

function bindings() {
    return {
        increment: function(n) { return { __inc: n }; },
        fromMillis: function(ms) { return { toMillis: function() { return ms; } }; },
    };
}

function memoryDb() {
    const docs = {};
    function storeValue(prev, value) {
        if (value && typeof value === 'object' && value.__inc != null) {
            return (Number(prev) || 0) + Number(value.__inc);
        }
        if (value && typeof value === 'object' && value.__delete) return undefined;
        if (value && typeof value === 'object' && typeof value.toMillis === 'function') return value.toMillis();
        return JSON.parse(JSON.stringify(value));
    }
    function apply(docPath, data, opts) {
        const prev = docs[docPath] ? JSON.parse(JSON.stringify(docs[docPath])) : {};
        const next = opts && opts.merge ? Object.assign({}, prev) : {};
        Object.keys(data || {}).forEach(function(key) {
            const stored = storeValue(prev[key], data[key]);
            if (stored === undefined) delete next[key];
            else next[key] = stored;
        });
        docs[docPath] = next;
    }
    function ref(docPath) {
        return {
            id: docPath.split('/').pop(),
            path: docPath,
            get: async function() {
                const data = docs[docPath];
                return {
                    exists: !!data,
                    id: docPath.split('/').pop(),
                    data: function() { return data ? JSON.parse(JSON.stringify(data)) : undefined; },
                    ref: ref(docPath),
                };
            },
            set: async function(data, opts) { apply(docPath, data, opts); },
            update: async function(data) { apply(docPath, data, { merge: true }); },
            delete: async function() { delete docs[docPath]; },
        };
    }
    return {
        _docs: docs,
        _deleteField: function() { return { __delete: true }; },
        collection: function(name) {
            return {
                doc: function(id) { return ref(name + '/' + id); },
                get: async function() {
                    const prefix = name + '/';
                    const list = Object.keys(docs).filter(function(docPath) {
                        return docPath.indexOf(prefix) === 0;
                    }).map(function(docPath) {
                        return {
                            id: docPath.slice(prefix.length),
                            data: function() { return JSON.parse(JSON.stringify(docs[docPath])); },
                            ref: ref(docPath),
                        };
                    });
                    return { size: list.length, docs: list };
                },
            };
        },
        runTransaction: async function(fn) {
            const writes = [];
            const t = {
                get: function(target) { return target.get(); },
                set: function(target, data, opts) { writes.push({ kind: 'set', target: target, data: data, opts: opts }); },
                delete: function(target) { writes.push({ kind: 'delete', target: target }); },
            };
            await fn(t);
            for (let i = 0; i < writes.length; i++) {
                if (writes[i].kind === 'delete') await writes[i].target.delete();
                else await writes[i].target.set(writes[i].data, writes[i].opts);
            }
        },
    };
}

function jsonResponse(status, body) {
    return {
        status: status,
        json: async function() { return body; },
    };
}

function cleanBody(extra) {
    return Object.assign({
        success: true,
        fraud_score: 10,
        vpn: false,
        proxy: false,
        tor: false,
        connection_type: 'Residential',
        recent_abuse: false,
        bot_status: false,
        country_code: 'US',
    }, extra || {});
}

function scriptedFetch(handler) {
    const calls = [];
    const impl = function(url) {
        calls.push(String(url));
        return Promise.resolve(handler(String(url), calls.length));
    };
    impl.calls = calls;
    return impl;
}

function gateOpts(db, extra) {
    return Object.assign({
        db: db,
        secret: SECRET,
        apiKey: API_KEY,
        cap: 30,
        now: 1_700_000_000_000,
        bindings: bindings(),
        timeoutMs: 50,
        uid: 'alice01',
        ip: '203.0.113.50',
        userAgent: 'QuestTest',
        language: 'en',
    }, extra || {});
}

test('scoring table denies datacenters, botnets, and scores of 90 or more', function() {
    delete process.env.IPQS_DENY_RECENT_ABUSE;
    delete process.env.IPQS_HOLD_SCORE_BAND;
    const dc = rep.scoreIpLookup(cleanBody({ connection_type: 'Data Center', fraud_score: 10 }));
    assert.strictEqual(dc.action, 'deny');
    assert.strictEqual(dc.reason, 'datacenter');
    const dcVpn = rep.scoreIpLookup(cleanBody({ connection_type: 'Data Center', vpn: true, fraud_score: 20 }));
    assert.strictEqual(dcVpn.action, 'hold');
    assert.strictEqual(dcVpn.reason, 'vpn');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ bot_status: true, fraud_score: 10 })).reason, 'botnet');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ bot_status: true, fraud_score: 10 })).action, 'deny');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ recent_abuse: true, fraud_score: 10 })).action, 'allow');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ recent_abuse: true }), { denyRecentAbuse: true }).action, 'deny');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ recent_abuse: true }), { denyRecentAbuse: true }).reason, 'recent-abuse');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ fraud_score: 90 })).action, 'deny');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ fraud_score: 90 })).reason, 'fraud-score');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ fraud_score: 99, vpn: true })).action, 'deny');
});

test('scoring table holds vpn, proxy, and tor, and the score band stays off', function() {
    delete process.env.IPQS_HOLD_SCORE_BAND;
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ vpn: true, fraud_score: 20 })).action, 'hold');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ vpn: true, fraud_score: 20 })).reason, 'vpn');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ proxy: true, fraud_score: 20 })).reason, 'proxy');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ tor: true, fraud_score: 20 })).reason, 'tor');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ fraud_score: 75 })).action, 'allow');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ fraud_score: 89 })).action, 'allow');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ fraud_score: 75 }), { holdScoreBand: true }).action, 'hold');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ fraud_score: 75 }), { holdScoreBand: true }).reason, 'score-hold');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ fraud_score: 89 }), { holdScoreBand: true }).action, 'hold');
    const clean = rep.scoreIpLookup(cleanBody({ fraud_score: 74 }));
    assert.strictEqual(clean.action, 'allow');
    assert.strictEqual(clean.reason, 'clean');
    const premium = rep.scoreIpLookup(cleanBody({ connection_type: 'Premium required.', fraud_score: 12 }));
    assert.strictEqual(premium.action, 'allow');
    assert.strictEqual(premium.datacenter, false);
});

test('a failed lookup or a credit error falls open', function() {
    const missing = rep.scoreIpLookup({ success: false, message: 'Insufficient credits remaining' });
    assert.strictEqual(missing.action, 'fallback');
    assert.strictEqual(missing.reason, 'credits');
    assert.strictEqual(rep.failureReason({ message: 'nope' }, 402), 'credits');
    assert.strictEqual(rep.failureReason({ success: false }, 500), 'http');
    assert.strictEqual(rep.DENY_CONNECTION, "To prevent abuse, sats can't be claimed from this connection. You can still use everything else in the app. Try claiming from your home Wi-Fi or mobile data.");
    assert.strictEqual(rep.HOLD_CONNECTION, "To prevent abuse, sats can't be claimed over a VPN, proxy or Tor. You can still use everything else in the app. Turn it off and tap claim again to get your sats.");
    assert.strictEqual(rep.HOLD_REFERRAL, "To prevent abuse, invite rewards aren't paid over a VPN, proxy or Tor. You can still use everything else in the app. Your reward is waiting and will pay automatically once you're on a regular connection.");
    assert.ok(rep.HOLD_REFERRAL.indexOf("once you're on a regular connection") !== -1);
    assert.strictEqual(rep.HOLD_DEVICE, 'This device is already linked to another account. Contact support if this is a shared household.');
    assert.strictEqual(rep.DENY_DEVICE, "This device can't claim rewards right now. Contact support.");
    assert.ok(rep.HOLD_DEVICE.indexOf('Contact support') !== -1);
    assert.ok(rep.DENY_DEVICE.indexOf('Contact support') !== -1);
});

test('high scores expire in 24 hours and clean scores last 7 days', function() {
    assert.strictEqual(rep.cacheTtlMs({ action: 'deny', fraudScore: 95 }), rep.HIGH_TTL_MS);
    assert.strictEqual(rep.cacheTtlMs({ action: 'hold', fraudScore: 80 }), rep.HIGH_TTL_MS);
    assert.strictEqual(rep.cacheTtlMs({ action: 'allow', fraudScore: 74 }), rep.CACHE_TTL_MS);
    assert.strictEqual(rep.HIGH_TTL_MS, 24 * 60 * 60 * 1000);
    assert.strictEqual(rep.CACHE_TTL_MS, 7 * 24 * 60 * 60 * 1000);
    assert.strictEqual(rep.DEFAULT_DAILY_CAP, 30);
    assert.strictEqual(rep.TIMEOUT_MS, 2500);
});

test('quota stops a second lookup and a cache hit does not spend a credit', async function() {
    const db = memoryDb();
    let fetches = 0;
    const fetchImpl = scriptedFetch(function() {
        fetches++;
        return jsonResponse(200, cleanBody({ fraud_score: 12 }));
    });
    const first = await rep.assessReward(gateOpts(db, { cap: 1, fetchImpl: fetchImpl, requestId: '' }));
    assert.strictEqual(first.action, 'allow');
    const again = await rep.assessReward(gateOpts(db, { cap: 1, fetchImpl: fetchImpl, requestId: '' }));
    assert.strictEqual(again.action, 'allow');
    assert.strictEqual(fetches, 1);
    const other = await rep.assessReward(gateOpts(db, {
        cap: 1,
        fetchImpl: fetchImpl,
        ip: '203.0.113.51',
        requestId: '',
    }));
    assert.strictEqual(other.action, 'fallback');
    assert.strictEqual(other.message, '');
    assert.strictEqual(fetches, 1);
    const usage = db._docs['ipqs_usage/2023-11-14'];
    assert.strictEqual(usage.lookups, 1);
    assert.ok(usage.errors >= 1);
    assert.ok(usage.quotaSkips >= 1);
    assert.strictEqual(usage.lastError, 'quota');
});

test('a timeout falls open and counts an error without storing the address', async function() {
    const db = memoryDb();
    const fetchImpl = function(url, options) {
        return new Promise(function(resolve, reject) {
            const signal = options && options.signal;
            if (signal) {
                signal.addEventListener('abort', function() {
                    const err = new Error('aborted');
                    err.name = 'AbortError';
                    reject(err);
                });
            }
        });
    };
    const result = await rep.assessReward(gateOpts(db, { fetchImpl: fetchImpl, timeoutMs: 40, requestId: 'req_timeout1' }));
    assert.strictEqual(result.action, 'fallback');
    assert.strictEqual(result.reason, 'timeout');
    assert.strictEqual(result.message, '');
    const blob = JSON.stringify(db._docs);
    assert.strictEqual(blob.includes('203.0.113'), false);
    assert.strictEqual(blob.includes(API_KEY), false);
    const usage = Object.keys(db._docs).filter(function(key) {
        return key.indexOf('ipqs_usage/') === 0 && key.indexOf('_u_') === -1;
    });
    assert.strictEqual(usage.length, 1);
    assert.strictEqual(db._docs[usage[0]].lastError, 'timeout');
    assert.ok(db._docs[usage[0]].errors >= 1);
    assert.strictEqual(Object.keys(db._docs).some(function(key) { return key.indexOf('ip_reputation/') === 0; }), false);
});

test('reputation docs are HMACs and never store a raw address or the API key', async function() {
    const db = memoryDb();
    const urls = [];
    const fetchImpl = scriptedFetch(function(url) {
        urls.push(url);
        return jsonResponse(200, cleanBody({ fraud_score: 11, isp: 'Example ISP', city: 'Nowhere', host: '203.0.113.50' }));
    });
    const result = await rep.assessReward(gateOpts(db, { fetchImpl: fetchImpl, requestId: '' }));
    assert.strictEqual(result.action, 'allow');
    const ids = Object.keys(db._docs).filter(function(key) { return key.indexOf('ip_reputation/') === 0; });
    assert.strictEqual(ids.length, 1);
    const expected = ipHmac.hmacIp('203.0.113.50', SECRET);
    assert.strictEqual(ids[0], 'ip_reputation/' + expected);
    assert.ok(rep.isHmacId(expected));
    const doc = db._docs[ids[0]];
    assert.strictEqual(doc.action, 'allow');
    assert.strictEqual(doc.countryCode, 'US');
    assert.ok(doc.expireAt > 1_700_000_000_000);
    const blob = JSON.stringify(db._docs);
    assert.strictEqual(blob.includes('203.0.113'), false);
    assert.strictEqual(blob.includes(API_KEY), false);
    assert.strictEqual(blob.includes('Example ISP'), false);
    assert.strictEqual(blob.includes('Nowhere'), false);
    assert.ok(urls[0].indexOf('strictness=1') !== -1);
    assert.ok(urls[0].indexOf('allow_public_access_points=true') !== -1);
    assert.strictEqual(urls[0].indexOf(API_KEY) !== -1, true);
});

test('the first account on a device is allowed and a later account is held', async function() {
    const db = memoryDb();
    const now = 1_700_000_000_000;
    let posts = 0;
    const fetchImpl = function(url) {
        const text = String(url);
        if (text.indexOf('/postback/') !== -1) {
            posts++;
            return Promise.resolve(jsonResponse(200, {
                success: true,
                device_id: 'DeviceAlpha1',
                fraud_chance: 10,
                time: Math.floor(now / 1000),
                ip_address: '203.0.113.50',
            }));
        }
        return Promise.resolve(jsonResponse(200, cleanBody()));
    };
    const first = await rep.assessReward(gateOpts(db, {
        fetchImpl: fetchImpl,
        now: now,
        requestId: 'req_alice_01',
        deviceEnabled: true,
    }));
    assert.strictEqual(first.action, 'allow');
    assert.strictEqual(first.deviceAction, 'allow');
    assert.ok(rep.isHmacId(first.deviceHmac));
    assert.strictEqual(first.deviceHmac, ipHmac.hmacValue('DeviceAlpha1', SECRET));
    const second = await rep.assessReward(gateOpts(db, {
        fetchImpl: fetchImpl,
        now: now + 1000,
        uid: 'bobuser',
        requestId: 'req_bob_0002',
        deviceEnabled: true,
    }));
    assert.strictEqual(second.action, 'hold');
    assert.strictEqual(second.reason, 'later-account');
    assert.strictEqual(second.message, rep.HOLD_DEVICE);
    assert.strictEqual(db._docs['device_holds/bobuser'].held, true);
    assert.strictEqual(db._docs['device_holds/bobuser'].approved, false);
    const postsAfter = posts;
    const bypass = await rep.assessReward(gateOpts(db, {
        fetchImpl: fetchImpl,
        now: now + 2000,
        uid: 'bobuser',
        requestId: '',
        deviceEnabled: true,
    }));
    assert.strictEqual(bypass.action, 'hold');
    assert.strictEqual(bypass.reason, 'existing-hold');
    assert.strictEqual(posts, postsAfter);
    const link = db._docs['device_links/' + first.deviceHmac];
    assert.ok(link.uids.alice01);
    assert.ok(link.uids.bobuser);
    assert.strictEqual(JSON.stringify(db._docs).includes('DeviceAlpha1'), false);
});

test('a device fraud chance of 90 denies the reward', async function() {
    const db = memoryDb();
    const now = 1_700_000_000_000;
    const fetchImpl = function(url) {
        if (String(url).indexOf('/postback/') !== -1) {
            return Promise.resolve(jsonResponse(200, {
                success: true,
                device_id: 'DeviceFraud9',
                fraud_chance: 90,
                time: Math.floor(now / 1000),
                ip_address: '203.0.113.50',
            }));
        }
        return Promise.resolve(jsonResponse(200, cleanBody()));
    };
    const result = await rep.assessReward(gateOpts(db, { fetchImpl: fetchImpl, now: now, requestId: 'req_fraud_01', deviceEnabled: true }));
    assert.strictEqual(result.action, 'deny');
    assert.strictEqual(result.reason, 'device-fraud');
    assert.strictEqual(result.message, rep.DENY_DEVICE);
    assert.strictEqual(db._docs['device_holds/alice01'].reason, 'device-fraud');
    assert.strictEqual(db._docs['device_holds/alice01'].held, true);
});

test('an approved household can claim without a fresh request id', async function() {
    const db = memoryDb();
    const now = 1_700_000_000_000;
    db._docs['device_holds/carol01'] = {
        held: false,
        approved: true,
        deviceHmac: 'a'.repeat(64),
        expireAt: now + 100000,
    };
    let fetches = 0;
    const fetchImpl = function() {
        fetches++;
        return Promise.resolve(jsonResponse(200, cleanBody()));
    };
    const result = await rep.assessReward(gateOpts(db, {
        fetchImpl: fetchImpl,
        now: now,
        uid: 'carol01',
        ip: '',
        requestId: '',
        deviceEnabled: true,
    }));
    assert.strictEqual(result.action, 'allow');
    assert.strictEqual(result.reason, 'household');
    assert.strictEqual(fetches, 0);
    const decision = rep.decideDevice({
        uids: { alice01: now - 1000, carol01: now },
        approved: { carol01: now },
    }, 'carol01', 4);
    assert.strictEqual(decision.action, 'allow');
    assert.strictEqual(decision.reason, 'household');
    assert.strictEqual(rep.decideDevice({ uids: { alice01: now } }, 'alice01', 4).reason, 'first');
    assert.strictEqual(rep.decideDevice({ uids: {} }, 'alice01', 91).action, 'deny');
});

test('a stale postback or an address mismatch is not trusted', function() {
    const now = 1_700_000_000_000;
    const stale = rep.trustDevice({
        success: true,
        device_id: 'DeviceAlpha1',
        time: Math.floor(now / 1000) - 180,
        ip_address: '203.0.113.50',
    }, now, '203.0.113.50');
    assert.strictEqual(stale.ok, false);
    assert.strictEqual(stale.reason, 'stale');
    const mismatch = rep.trustDevice({
        success: true,
        device_id: 'DeviceAlpha1',
        time: Math.floor(now / 1000),
        ip_address: '198.51.100.8',
    }, now, '203.0.113.50');
    assert.strictEqual(mismatch.ok, false);
    assert.strictEqual(mismatch.reason, 'ip-mismatch');
    const fresh = rep.trustDevice({
        success: true,
        device_id: 'DeviceAlpha1',
        time: Math.floor(now / 1000),
        ip_address: '203.0.113.50',
    }, now, '203.0.113.50');
    assert.strictEqual(fresh.ok, true);
    assert.strictEqual(rep.cleanRequestId('short'), '');
    assert.strictEqual(rep.cleanRequestId('req_ok_123'), 'req_ok_123');
    assert.strictEqual(rep.FRESH_MS, 2 * 60 * 1000);
});

test('rekey plans are idempotent and drop raw address fields', function() {
    const hmac = ipHmac.hmacIp('203.0.113.44', SECRET);
    const again = rep.planDocRekey(hmac, 'ip', SECRET);
    assert.strictEqual(again.action, 'skip');
    assert.strictEqual(again.reason, 'already-hmac');
    const plan = rep.planDocRekey('203_0_113_44', 'ip', SECRET);
    assert.strictEqual(plan.action, 'rekey');
    assert.strictEqual(plan.to, hmac);
    assert.strictEqual(plan.to.includes('203.0.113'), false);
    assert.strictEqual(plan.to.includes('203_0_113'), false);
    const range = rep.planDocRekey('203_0_113_0_24', 'range', SECRET);
    assert.strictEqual(range.action, 'rekey');
    assert.strictEqual(range.to, ipHmac.hmacIp('203.0.113.0/24', SECRET));
    assert.strictEqual(rep.planDocRekey('not-an-ip', 'ip', SECRET).reason, 'unparsed');
    const fields = rep.planSignalFields({
        ipExact: '203_0_113_44',
        subnet: '203_0_113_0_24',
        label: '203.0.113.0/24',
        ip: '203.0.113.44',
        uid: 'alice01',
    }, SECRET);
    assert.strictEqual(fields.changes.ipExact, hmac);
    assert.ok(rep.isHmacId(fields.changes.subnet));
    assert.ok(fields.drop.indexOf('label') !== -1);
    assert.ok(fields.drop.indexOf('ip') !== -1);
    const merged = rep.mergeSlot(
        { seen: { alice01: 10 }, claimCount: 2, label: 'raw', ip: '203.0.113.44', lastUid: 'alice01', lastClaimMs: 10 },
        { seen: { bobuser: 20 }, claimCount: 1, label: 'also-raw', lastUid: 'bobuser', lastClaimMs: 20 }
    );
    assert.strictEqual(merged.claimCount, 2);
    assert.strictEqual(merged.lastUid, 'bobuser');
    assert.strictEqual(merged.seen.alice01, 10);
    assert.strictEqual(merged.seen.bobuser, 20);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(merged, 'label'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(merged, 'ip'), false);
    const ids = rep.networkDocIds('203.0.113.44', SECRET);
    assert.ok(rep.isHmacId(ids.ipId));
    assert.ok(rep.isHmacId(ids.rangeId));
    assert.notStrictEqual(ids.ipId, ids.rangeId);
});

test('the migration script dry-runs unless --apply is passed', async function() {
    assert.strictEqual(migrate.parseArgs([]).apply, false);
    assert.strictEqual(migrate.parseArgs(['--dry-run']).apply, false);
    assert.strictEqual(migrate.parseArgs(['--apply']).apply, true);
    const source = read('scripts/migrate-faucet-ip-hmac.js');
    assert.ok(source.includes('--apply'));
    assert.ok(source.includes('dry-run'));
    assert.ok(source.includes('Nothing was read'));
    const db = memoryDb();
    const raw = {
        seen: { alice01: 10 },
        claimCount: 2,
        label: '203.0.113.44',
        ip: '203.0.113.44',
        lastUid: 'alice01',
        lastClaimMs: 10,
    };
    db._docs['faucet_ip_log/203_0_113_44'] = raw;
    const preview = await migrate.rekeyCollection(db, 'faucet_ip_log', 'ip', SECRET, false);
    assert.strictEqual(preview.rekey, 1);
    assert.strictEqual(preview.deleted, 0);
    assert.ok(db._docs['faucet_ip_log/203_0_113_44']);
    const applied = await migrate.rekeyCollection(db, 'faucet_ip_log', 'ip', SECRET, true);
    assert.strictEqual(applied.deleted, 1);
    assert.strictEqual(db._docs['faucet_ip_log/203_0_113_44'], undefined);
    const hmacId = ipHmac.hmacIp('203.0.113.44', SECRET);
    const copy = db._docs['faucet_ip_log/' + hmacId];
    assert.ok(copy);
    assert.strictEqual(copy.claimCount, 2);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(copy, 'label'), false);
    assert.strictEqual(JSON.stringify(db._docs).includes('203.0.113'), false);
    const second = await migrate.rekeyCollection(db, 'faucet_ip_log', 'ip', SECRET, true);
    assert.strictEqual(second.rekey, 0);
    assert.strictEqual(second.skip, 1);
    assert.ok(db._docs['faucet_ip_log/' + hmacId]);
});

test('claim and referral paths call the gate and keep new collections server-only', function() {
    const index = read('functions/index.js');
    const claimStart = index.indexOf('exports.claimSats');
    const claimEnd = index.indexOf('\nexports.', claimStart + 20);
    const claim = index.slice(claimStart, claimEnd);
    assert.ok(claim.indexOf('assessBan') < claim.indexOf('assessReward'));
    assert.ok(claim.indexOf('sats_daily') < claim.indexOf('assessReward'));
    assert.ok(claim.indexOf('Cooldown active') < claim.indexOf('assessReward'));
    assert.ok(claim.indexOf('lightning_addresses') < claim.indexOf('assessReward'));
    assert.ok(claim.indexOf('Device verification required.') < claim.indexOf('assessReward'));
    assert.ok(claim.indexOf('Sats claims are paused. Try again later.') < claim.indexOf('assessReward'));
    assert.ok(claim.indexOf('assessReward') < claim.indexOf('resolveLnurlInvoice'));
    assert.ok(claim.includes('networkDocIds'));
    assert.ok(claim.includes('fingerprint_abuse'));
    assert.ok(claim.includes('legacyIpRef'));
    assert.ok(claim.includes('neverClaimed'));
    assert.ok(claim.includes('ipqsRequestId'));
    assert.ok(claim.includes('netIds.ipId'));
    assert.ok(claim.includes('.doc(net.exactId)'));
    assert.strictEqual(claim.includes('label: net.rangeLabel'), false);
    assert.ok(claim.includes('enforceAppCheck: true'));
    const referralStart = index.indexOf('exports.registerReferral');
    const referral = index.slice(referralStart, index.indexOf('exports.approveHouseholdDevice'));
    assert.ok(referral.includes('enforceAppCheck: true'));
    assert.ok(referral.includes('ipqsApiKey'));
    const approveStart = index.indexOf('exports.approveHouseholdDevice');
    const approve = index.slice(approveStart, index.indexOf('exports.deleteMyReferralSignal'));
    assert.ok(approve.includes('enforceAppCheck: true'));
    assert.ok(approve.includes("token.admin !== true"));
    assert.ok(approve.includes('admin_audit_log'));
    assert.ok(approve.includes('deviceHmacPrefix'));
    assert.strictEqual(approve.includes('email'), false);
    assert.strictEqual(approve.includes('rawRequest'), false);
    const favor = read('functions/src/satoshiFavor.js');
    const favorAt = favor.indexOf('exports.hashForFavor');
    const favorBlock = favor.slice(favorAt, favorAt + 400);
    assert.ok(favorBlock.includes('enforceAppCheck: false'));
    assert.ok(favor.includes('assessReward'));
    assert.ok(favor.includes('favor_ip_cache'));
    assert.ok(favor.includes('shouldReuseFavorCheck'));
    const onboarding = read('functions/src/onboardingApi.js');
    const setAt = onboarding.indexOf('setUsername: functionsV1.runWith({');
    assert.ok(setAt !== -1);
    assert.ok(onboarding.slice(setAt, setAt + 240).includes('enforceAppCheck: false'));
    const rules = read('firestore.rules');
    ['ip_reputation', 'ipqs_usage', 'device_links', 'device_holds', 'user_devices', 'favor_ip_cache', 'ops_alerts'].forEach(function(name) {
        const at = rules.indexOf('match /' + name + '/{docId}');
        assert.ok(at !== -1, name);
        const block = rules.slice(at, rules.indexOf('match /', at + 10));
        assert.ok(block.includes('allow read, write: if false'), name);
    });
    const privacy = read('privacy.html');
    assert.ok(privacy.includes('IPQualityScore'));
    assert.ok(privacy.includes('device signals'));
    assert.ok(privacy.includes('not active yet'));
    assert.ok(privacy.includes('including after the account is deleted'));
    assert.ok(privacy.includes('multi-account reward abuse'));
    assert.ok(privacy.includes('browser language header'));
    assert.ok(privacy.includes('while Satoshi\'s Favor is hashing'));
    assert.ok(privacy.includes('referral payout is rechecked'));
    assert.ok(privacy.includes('ipqs_usage'));
    assert.ok(privacy.includes('favor_ip_cache'));
    assert.ok(privacy.includes('kept for 90 days'));
    assert.ok(privacy.includes('kept for 7 days'));
    assert.ok(rules.includes('favor_ip_cache.expireAt'));
    assert.ok(rules.includes('ops_alerts.expireAt'));
    const terms = read('terms.html');
    assert.ok(terms.includes('one account per person'));
    assert.ok(terms.includes('VPN, proxy, or Tor'));
    const ranking = read('ranking.js');
    assert.ok(ranking.includes('id="satsClaimHoldNote"'));
    assert.ok(ranking.includes('Turn off your VPN, proxy, or Tor and tap claim again. The rest of the app still works.'));
    assert.ok(ranking.includes('var IPQS_DEVICE_TRACKER_ID'));
    assert.ok(ranking.includes('IPQS_DEVICE_SCRIPT_HOST'));
    assert.ok(ranking.includes('faucet: 1, referral: 1, favor: 1'));
    assert.strictEqual(ranking.includes('IPQS_API_KEY'), false);
    const worker = read('workers/seo-router/worker.js');
    assert.strictEqual(worker.includes('ipqscdn.com'), false);
    assert.strictEqual(worker.includes('ipqualityscore.com'), false);
    const hosting = read('firebase.json');
    assert.strictEqual(hosting.includes('ipqscdn.com'), false);
    assert.strictEqual(hosting.includes('ipqualityscore.com'), false);
    const bundle = read('bundle.min.js');
    assert.ok(bundle.includes('btcShowReferralRewardNote'));
    assert.ok(bundle.includes('ipqsRequestId'));
    const referrals = read('functions/src/referrals.js');
    assert.ok(referrals.includes('deviceHmac'));
    assert.ok(referrals.includes('referred.fingerprint'));
    assert.ok(referrals.includes('ipqs-hold'));
    assert.strictEqual(referrals.includes('same-fingerprint') && referrals.includes('deviceHmac'), true);
    const service = read('functions/src/referralService.js');
    assert.ok(service.includes('linked-ip-unverified'));
    assert.ok(service.includes('legacyNetworkIds'));
    assert.ok(service.includes("purpose: 'referral'"));
    const pay = service.slice(service.indexOf('async function payIfQualified'), service.indexOf('async function onUserWritten'));
    assert.ok(pay.indexOf('aboutToPayReferral') !== -1);
    assert.ok(pay.indexOf('aboutToPayReferral') < pay.indexOf('assessReward'));
    assert.ok(pay.includes('liveIpVerdict'));
    assert.strictEqual(pay.includes('freshGate.action'), false);
    assert.ok(favor.includes('ipVerdict'));
    const script = read('scripts/migrate-faucet-ip-hmac.js');
    assert.ok(script.includes('REFERRAL_IP_HMAC_SECRET'));
    assert.strictEqual(script.includes('IP_REP_HMAC_SECRET'), false);
    assert.ok(script.includes('slotCovers'));
    assert.ok(script.includes('process.exit(1)'));
    const guard = read('functions/src/faucetGuard.js');
    assert.ok(guard.includes('function assessFingerprint'));
    assert.ok(claim.includes("type: 'fingerprint_abuse'"));
});

test('a forged device id does nothing while the server switch is off', async function() {
    delete process.env.IPQS_DEVICE_ENABLED;
    const db = memoryDb();
    const now = 1_700_000_000_000;
    const ip = '203.0.113.77';
    db._docs['ip_reputation/' + ipHmac.hmacIp(ip, SECRET)] = {
        action: 'deny',
        reason: 'score',
        fraudScore: 95,
        checkedAtMs: now,
        expireAt: now + 100000,
    };
    let fetches = 0;
    const result = await rep.assessReward(gateOpts(db, {
        fetchImpl: function() {
            fetches++;
            return Promise.resolve(jsonResponse(200, cleanBody()));
        },
        now: now,
        ip: ip,
        requestId: 'forged_request_id_0001',
        deviceEnabled: false,
    }));
    assert.strictEqual(result.action, 'deny');
    assert.strictEqual(result.reason, 'score');
    assert.strictEqual(result.deviceAction, 'off');
    assert.strictEqual(result.deviceHmac, '');
    assert.strictEqual(fetches, 0);
    const keys = Object.keys(db._docs);
    assert.strictEqual(keys.some(function(key) { return key.indexOf('device_') === 0; }), false);
    assert.strictEqual(keys.some(function(key) { return key.indexOf('ipqs_usage/') === 0; }), false);
});

test('the fourth fresh lookup for one account is held', async function() {
    const db = memoryDb();
    let fetches = 0;
    const fetchImpl = scriptedFetch(function() {
        fetches++;
        return jsonResponse(200, cleanBody({ fraud_score: 10 }));
    });
    const now = 1_700_000_000_000;
    for (let i = 0; i < 3; i++) {
        const got = await rep.assessReward(gateOpts(db, {
            fetchImpl: fetchImpl,
            now: now,
            ip: '203.0.113.' + (10 + i),
            userCap: 3,
            cap: 30,
        }));
        assert.strictEqual(got.action, 'allow');
    }
    const held = await rep.assessReward(gateOpts(db, {
        fetchImpl: fetchImpl,
        now: now,
        ip: '203.0.113.40',
        userCap: 3,
        cap: 30,
    }));
    assert.strictEqual(held.action, 'hold');
    assert.strictEqual(held.reason, 'user-quota');
    assert.strictEqual(held.message, rep.USER_HOLD);
    assert.strictEqual(fetches, 3);
});

test('purpose caps keep a favor lookup from spending the faucet bucket', async function() {
    const db = memoryDb();
    let fetches = 0;
    const fetchImpl = scriptedFetch(function() {
        fetches++;
        return jsonResponse(200, cleanBody({ fraud_score: 10 }));
    });
    const now = 1_700_000_000_000;
    const purposeCaps = { faucet: 1, favor: 1, referral: 1 };
    const faucet = await rep.assessReward(gateOpts(db, {
        fetchImpl: fetchImpl,
        now: now,
        ip: '203.0.113.10',
        cap: 30,
        purpose: 'faucet',
        purposeCaps: purposeCaps,
    }));
    assert.strictEqual(faucet.action, 'allow');
    const blocked = await rep.assessReward(gateOpts(db, {
        fetchImpl: fetchImpl,
        now: now,
        ip: '203.0.113.11',
        cap: 30,
        purpose: 'faucet',
        purposeCaps: purposeCaps,
    }));
    assert.strictEqual(blocked.action, 'fallback');
    assert.strictEqual(blocked.reason, 'quota');
    const favor = await rep.assessReward(gateOpts(db, {
        fetchImpl: fetchImpl,
        now: now,
        ip: '203.0.113.12',
        cap: 30,
        purpose: 'favor',
        purposeCaps: purposeCaps,
        uid: 'favoruser1',
    }));
    assert.strictEqual(favor.action, 'allow');
    assert.strictEqual(favor.message, '');
    assert.strictEqual(fetches, 2);
    assert.ok(db._docs['ops_alerts/ipqs_2023-11-14']);
    assert.strictEqual(db._docs['ops_alerts/ipqs_2023-11-14'].kind, 'ipqs');
});

test('quota holds a never-claimed faucet account only when that switch is on', async function() {
    delete process.env.IPQS_HOLD_NEVER_CLAIMED;
    const db = memoryDb();
    const now = 1_700_000_000_000;
    db._docs['ipqs_usage/2023-11-14'] = { lookups: 30, faucet: 20, expireAt: now + 100000 };
    const fetchImpl = function() { throw new Error('lookup should not run'); };
    const open = await rep.assessReward(gateOpts(db, {
        fetchImpl: fetchImpl,
        now: now,
        ip: '198.51.100.20',
        cap: 30,
        purpose: 'faucet',
        neverClaimed: true,
    }));
    assert.strictEqual(open.action, 'fallback');
    assert.strictEqual(open.reason, 'quota');
    assert.strictEqual(open.message, '');
    const held = await rep.assessReward(gateOpts(db, {
        fetchImpl: fetchImpl,
        now: now,
        ip: '198.51.100.22',
        cap: 30,
        purpose: 'faucet',
        neverClaimed: true,
        holdNeverClaimed: true,
    }));
    assert.strictEqual(held.action, 'hold');
    assert.strictEqual(held.reason, 'quota');
    assert.strictEqual(held.message, rep.NEVER_CLAIMED_HOLD);
    const returning = await rep.assessReward(gateOpts(db, {
        fetchImpl: fetchImpl,
        now: now,
        ip: '198.51.100.21',
        cap: 30,
        purpose: 'faucet',
        neverClaimed: false,
        uid: 'olduser01',
    }));
    assert.strictEqual(returning.action, 'fallback');
    assert.strictEqual(returning.reason, 'quota');
    assert.strictEqual(returning.message, '');
});

function creditFetch() {
    return {
        status: 402,
        json: async function() {
            return { success: false, message: 'Insufficient credits remaining' };
        },
    };
}

test('zero credits fail open for a new account and do not spend the account cap', async function() {
    delete process.env.IPQS_HOLD_NEVER_CLAIMED;
    const db = memoryDb();
    const now = 1_700_000_000_000;
    let fetches = 0;
    const fetchImpl = function() {
        fetches++;
        return Promise.resolve(creditFetch());
    };
    for (let i = 0; i < 4; i++) {
        const got = await rep.assessReward(gateOpts(db, {
            fetchImpl: fetchImpl,
            now: now,
            ip: '198.51.100.' + (30 + i),
            purpose: 'faucet',
            neverClaimed: true,
            userCap: 3,
        }));
        assert.strictEqual(got.action, 'fallback');
        assert.strictEqual(got.reason, 'credits');
        assert.strictEqual(got.message, '');
        assert.strictEqual(got.ipVerdict, null);
    }
    assert.strictEqual(fetches, 4);
    const userKey = Object.keys(db._docs).filter(function(key) { return key.indexOf('_u_') !== -1; });
    assert.strictEqual(userKey.length, 0);
    assert.ok(db._docs['ops_alerts/ipqs_2023-11-14']);
});

test('a failed lookup does not count toward the account cap', async function() {
    const db = memoryDb();
    const now = 1_700_000_000_000;
    let fetches = 0;
    const fetchImpl = function() {
        fetches++;
        return Promise.resolve(creditFetch());
    };
    for (let i = 0; i < 3; i++) {
        const got = await rep.assessReward(gateOpts(db, {
            fetchImpl: fetchImpl,
            now: now + i,
            ip: '203.0.113.' + (60 + i),
            purpose: 'referral',
            userCap: 3,
        }));
        assert.strictEqual(got.action, 'fallback');
        assert.strictEqual(got.reason, 'credits');
    }
    const later = await rep.assessReward(gateOpts(db, {
        fetchImpl: fetchImpl,
        now: now,
        ip: '203.0.113.70',
        purpose: 'faucet',
        userCap: 3,
    }));
    assert.strictEqual(later.action, 'fallback');
    assert.strictEqual(later.reason, 'credits');
    assert.notStrictEqual(later.reason, 'user-quota');
    assert.strictEqual(later.message, '');
    assert.strictEqual(fetches, 4);
});

test('an exhausted purpose cap does not hold a later faucet check', async function() {
    const db = memoryDb();
    const now = 1_700_000_000_000;
    let fetches = 0;
    const fetchImpl = scriptedFetch(function() {
        fetches++;
        return jsonResponse(200, cleanBody({ fraud_score: 10 }));
    });
    const purposeCaps = { faucet: 5, favor: 5, referral: 0 };
    const referral = await rep.assessReward(gateOpts(db, {
        fetchImpl: fetchImpl,
        now: now,
        ip: '203.0.113.80',
        purpose: 'referral',
        purposeCaps: purposeCaps,
        userCap: 3,
    }));
    assert.strictEqual(referral.action, 'fallback');
    assert.strictEqual(referral.reason, 'quota');
    assert.strictEqual(fetches, 0);
    const faucet = await rep.assessReward(gateOpts(db, {
        fetchImpl: fetchImpl,
        now: now,
        ip: '203.0.113.81',
        purpose: 'faucet',
        purposeCaps: purposeCaps,
        userCap: 3,
    }));
    assert.strictEqual(faucet.action, 'allow');
    assert.strictEqual(fetches, 1);
    const userKey = 'ipqs_usage/2023-11-14_u_alice01';
    assert.strictEqual(db._docs[userKey].lookups, 1);
});

test('an account already at the cap fails open while the vendor is degraded', async function() {
    const db = memoryDb();
    const now = 1_700_000_000_000;
    db._docs['ipqs_usage/2023-11-14_u_alice01'] = { lookups: 3, expireAt: now + 100000 };
    db._docs['ipqs_usage/2023-11-14'] = { lookups: 3, lastError: 'credits', degraded: true, expireAt: now + 100000 };
    let fetches = 0;
    const result = await rep.assessReward(gateOpts(db, {
        fetchImpl: function() {
            fetches++;
            return Promise.resolve(creditFetch());
        },
        now: now,
        ip: '203.0.113.90',
        userCap: 3,
    }));
    assert.strictEqual(result.action, 'fallback');
    assert.strictEqual(result.reason, 'user-quota');
    assert.strictEqual(result.message, '');
    assert.strictEqual(fetches, 0);
});

test('a missing hmac secret cannot build a network doc id', function() {
    assert.strictEqual(rep.networkDocIds('203.0.113.10', ''), null);
    assert.strictEqual(rep.networkDocIds('203.0.113.10', 'short-secret'), null);
    assert.strictEqual(rep.legacyNetworkIds('203.0.113.10').ipId, '203_0_113_10');
});

test('a favor verdict is reused only for the same window', function() {
    const now = 1_700_000_000_000;
    assert.strictEqual(rep.shouldReuseFavorCheck({
        cycleId: 'cycle-1',
        action: 'hold',
        expireAt: now + 1000,
    }, 'cycle-1', now), true);
    assert.strictEqual(rep.shouldReuseFavorCheck({
        cycleId: 'cycle-1',
        action: 'hold',
        expireAt: now - 1,
    }, 'cycle-1', now), false);
    assert.strictEqual(rep.shouldReuseFavorCheck({
        cycleId: 'cycle-2',
        action: 'allow',
        expireAt: now + 1000,
    }, 'cycle-1', now), false);
    assert.strictEqual(rep.shouldReuseFavorCheck({
        cycleId: 'cycle-1',
        action: 'hold',
        reason: 'user-quota',
        expireAt: now + 1000,
    }, 'cycle-1', now), false);
    assert.strictEqual(rep.shouldReuseFavorCheck({
        cycleId: 'cycle-1',
        action: 'fallback',
        reason: 'credits',
        expireAt: now + 1000,
    }, 'cycle-1', now), false);
    assert.strictEqual(rep.shouldReuseFavorCheck({
        cycleId: 'cycle-1',
        action: 'hold',
        reason: 'vpn',
        expireAt: now + 1000,
    }, 'cycle-1', now), true);
});

test('referral holds use invite wording', async function() {
    const db = memoryDb();
    const result = await rep.assessReward(gateOpts(db, {
        fetchImpl: scriptedFetch(function() {
            return jsonResponse(200, cleanBody({ vpn: true, fraud_score: 80 }));
        }),
        purpose: 'referral',
    }));
    assert.strictEqual(result.action, 'hold');
    assert.strictEqual(result.message, rep.HOLD_REFERRAL);
    assert.ok(result.message.indexOf('claim sats') === -1);
    assert.ok(result.message.indexOf("once you're on a regular connection") !== -1);
});

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
