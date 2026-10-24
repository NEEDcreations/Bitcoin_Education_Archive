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
                set: function(target, data, opts) { writes.push({ target: target, data: data, opts: opts }); },
            };
            await fn(t);
            for (let i = 0; i < writes.length; i++) {
                await writes[i].target.set(writes[i].data, writes[i].opts);
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

test('scoring table denies datacenters, botnets, recent abuse, and scores of 90 or more', function() {
    const dc = rep.scoreIpLookup(cleanBody({ connection_type: 'Data Center', fraud_score: 10 }));
    assert.strictEqual(dc.action, 'deny');
    assert.strictEqual(dc.reason, 'datacenter');
    const dcVpn = rep.scoreIpLookup(cleanBody({ connection_type: 'Data Center', vpn: true, fraud_score: 20 }));
    assert.strictEqual(dcVpn.action, 'hold');
    assert.strictEqual(dcVpn.reason, 'vpn');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ bot_status: true, fraud_score: 10 })).reason, 'botnet');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ bot_status: true, fraud_score: 10 })).action, 'deny');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ recent_abuse: true })).action, 'deny');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ recent_abuse: true })).reason, 'recent-abuse');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ fraud_score: 90 })).action, 'deny');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ fraud_score: 90 })).reason, 'fraud-score');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ fraud_score: 99, vpn: true })).action, 'deny');
});

test('scoring table holds vpn, proxy, tor, and scores from 75 through 89', function() {
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ vpn: true, fraud_score: 20 })).action, 'hold');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ vpn: true, fraud_score: 20 })).reason, 'vpn');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ proxy: true, fraud_score: 20 })).reason, 'proxy');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ tor: true, fraud_score: 20 })).reason, 'tor');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ fraud_score: 75 })).action, 'hold');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ fraud_score: 75 })).reason, 'score-hold');
    assert.strictEqual(rep.scoreIpLookup(cleanBody({ fraud_score: 89 })).action, 'hold');
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
    assert.strictEqual(rep.DENY_CONNECTION, "This connection can't claim sats. Turn off your VPN or contact support.");
    assert.ok(rep.HOLD_CONNECTION.indexOf('Switch to a regular connection') === 0);
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
    const usage = Object.keys(db._docs).filter(function(key) { return key.indexOf('ipqs_usage/') === 0; });
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
    const result = await rep.assessReward(gateOpts(db, { fetchImpl: fetchImpl, now: now, requestId: 'req_fraud_01' }));
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
    assert.ok(claim.indexOf('assessReward') < claim.indexOf('resolveLnurlInvoice'));
    assert.ok(claim.includes('networkDocIds'));
    assert.ok(claim.includes('ipqsRequestId'));
    assert.strictEqual(claim.includes('doc(net.exactId)'), false);
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
    const onboarding = read('functions/src/onboardingApi.js');
    assert.ok(onboarding.includes('setUsername: functionsV1.runWith({ enforceAppCheck: false })'));
    const rules = read('firestore.rules');
    ['ip_reputation', 'ipqs_usage', 'device_links', 'device_holds', 'user_devices'].forEach(function(name) {
        const at = rules.indexOf('match /' + name + '/{docId}');
        assert.ok(at !== -1, name);
        const block = rules.slice(at, rules.indexOf('match /', at + 10));
        assert.ok(block.includes('allow read, write: if false'), name);
    });
    const privacy = read('privacy.html');
    assert.ok(privacy.includes('IPQualityScore'));
    assert.ok(privacy.includes('device signals'));
    assert.ok(privacy.includes('multi-account reward abuse'));
    const terms = read('terms.html');
    assert.ok(terms.includes('one account per person'));
    assert.ok(terms.includes('VPN, proxy, or Tor'));
    const ranking = read('ranking.js');
    assert.ok(ranking.includes('var IPQS_DEVICE_TRACKER_ID'));
    assert.ok(ranking.includes('IPQS_DEVICE_SCRIPT_HOST'));
    assert.ok(ranking.includes('faucet: 1, referral: 1, favor: 1'));
    assert.strictEqual(ranking.includes('IPQS_API_KEY'), false);
    const worker = read('workers/seo-router/worker.js');
    assert.ok(worker.includes('https://www.ipqscdn.com'));
    assert.ok(worker.includes('https://ipqualityscore.com'));
    const bundle = read('bundle.min.js');
    assert.ok(bundle.includes('btcShowReferralRewardNote'));
    assert.ok(bundle.includes('ipqsRequestId'));
    const referrals = read('functions/src/referrals.js');
    assert.ok(referrals.includes('deviceHmac'));
    assert.ok(referrals.includes('ipqs-hold'));
    assert.strictEqual(referrals.includes('same-fingerprint') && referrals.includes('deviceHmac'), true);
});

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
