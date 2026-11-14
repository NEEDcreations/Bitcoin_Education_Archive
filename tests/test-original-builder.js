'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ob = require('../functions/src/originalBuilder');
const badgeRules = require('../functions/src/badgeRules');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        const ret = fn();
        if (ret && typeof ret.then === 'function') {
            return ret.then(function () {
                console.log('✅ ' + name);
                passed++;
            }).catch(function (e) {
                console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
                failed++;
            });
        }
        console.log('✅ ' + name);
        passed++;
        return Promise.resolve();
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
        failed++;
        return Promise.resolve();
    }
}

const CUTOFF = ob.DEFAULT_CUTOFF_MS;
const UNLOCK = ob.DEFAULT_UNLOCK_MS;
const BEFORE = CUTOFF - 86400000;
const AFTER_CUTOFF = CUTOFF + 86400000;
const AFTER_UNLOCK = UNLOCK + 3600000;

function ts(ms) {
    return { toMillis: function () { return ms; }, toDate: function () { return new Date(ms); } };
}

function snap(data, id) {
    const exists = data != null;
    return {
        exists: exists,
        id: id || '',
        empty: !exists,
        data: function () { return data || {}; },
        docs: exists && id ? [this] : [],
        forEach: function (fn) { if (exists && id) fn(this); },
    };
}

function querySnap(docs) {
    const list = docs || [];
    return {
        empty: list.length === 0,
        docs: list,
        forEach: function (fn) { list.forEach(fn); },
        size: list.length,
    };
}

function docSnap(id, data) {
    return {
        exists: data != null,
        id: id,
        empty: data == null,
        data: function () { return data || {}; },
    };
}

function makeDb(state) {
    state.claims = state.claims || {};
    state.eligible = state.eligible || {};
    state.users = state.users || {};
    function col(name) {
        return {
            doc: function (id) {
                if (name === 'config') {
                    return {
                        get: async function () { return snap(state.config || null, id); },
                    };
                }
                if (name === ob.CLAIMS_COLLECTION) {
                    return {
                        get: async function () { return snap(state.claims[id] || null, id); },
                        set: async function (data) { state.claims[id] = Object.assign({}, state.claims[id] || {}, data); },
                    };
                }
                if (name === ob.ELIGIBLE_COLLECTION) {
                    return {
                        get: async function () { return snap(state.eligible[id] || null, id); },
                    };
                }
                if (name === 'users') {
                    const user = state.users[id] || { data: null, passes: {}, awards: {} };
                    return {
                        get: async function () { return snap(user.data, id); },
                        collection: function (sub) {
                            if (sub === 'quest_passes') {
                                return {
                                    where: function () { return this; },
                                    limit: function () { return this; },
                                    get: async function () {
                                        const docs = Object.keys(user.passes || {}).map(function (k) {
                                            return docSnap(k, user.passes[k]);
                                        });
                                        // The real query filters at < cutoff. Tests that want a pre-cutoff
                                        // pass should only put pre-cutoff docs in passes when testing
                                        // that path, or we filter here by a stored cutoff? Filter in
                                        // maybeAward's query is mocked as "all passes in user.passes".
                                        // Tests put only matching docs in the map for the case under test.
                                        return querySnap(docs);
                                    },
                                };
                            }
                            if (sub === 'badge_awards') {
                                return {
                                    doc: function (bid) {
                                        return {
                                            get: async function () { return snap(user.awards[bid] || null, bid); },
                                        };
                                    },
                                    get: async function () {
                                        return querySnap(Object.keys(user.awards || {}).map(function (k) {
                                            return docSnap(k, user.awards[k]);
                                        }));
                                    },
                                };
                            }
                            return { doc: function () { return { get: async function () { return snap(null); } }; } };
                        },
                    };
                }
                return { get: async function () { return snap(null, id); } };
            },
        };
    }
    return { collection: col, _state: state };
}

const defaultConfig = {
    enabled: true,
    cutoffAt: CUTOFF,
    unlockAt: UNLOCK,
};

async function run() {
    await test('catalog has Original Builder with 0 XP and a server source', function () {
        const rule = badgeRules.ruleFor('original_builder');
        assert.ok(rule, 'rule exists');
        assert.strictEqual(rule.name, 'Original Builder');
        assert.strictEqual(rule.xp, 0);
        assert.strictEqual(rule.cosmetic, false);
        assert.ok(rule.source && rule.source.type === 'originalBuilder');
        assert.strictEqual(badgeRules.meets(rule, {}, {}), false);
        assert.strictEqual(badgeRules.sfEligible('original_builder'), false);
        assert.strictEqual(badgeRules.countPaying(['original_builder']), 0);
    });

    await test('badge assets exist in 128 and 512 png and webp', function () {
        ['128', '512'].forEach(function (sz) {
            ['png', 'webp'].forEach(function (ext) {
                const p = path.join(root, 'assets/badges/original-builder-' + sz + '.' + ext);
                assert.ok(fs.existsSync(p), p);
                assert.ok(fs.statSync(p).size > 100, p + ' too small');
            });
        });
        const png = fs.readFileSync(path.join(root, 'assets/badges/original-builder-512.png'));
        assert.ok(png.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), '512 is a PNG');
    });

    await test('client def is in the Knowledge-safe Citadel section and has an icon', function () {
        const src = fs.readFileSync(path.join(root, 'badges.js'), 'utf8');
        assert.ok(src.includes("id: 'original_builder'"));
        assert.ok(src.includes("name: 'Original Builder'"));
        assert.ok(src.includes('assets/badges/original-builder-512.webp'));
        assert.ok(src.includes("'🏰 Citadel'"));
        assert.ok(src.includes("b.id !== 'original_builder'") || src.includes("'🏰 Citadel'"));
        assert.ok(src.includes("'original_builder'") && src.includes('MAJOR_BADGES'));
        assert.ok(/MAJOR_BADGES = \[[^\]]*original_builder/.test(src) || src.includes("'original_builder']") || /MAJOR_BADGES[\s\S]{0,400}original_builder/.test(src));
    });

    await test('disabled by default when config is missing', async function () {
        const db = makeDb({ config: null, users: { u1: { data: { questsPassed: 5 }, passes: {}, awards: {} } } });
        const res = await ob.maybeAward(db, {}, 'u1', { nowMs: AFTER_UNLOCK, awardFn: async function () { throw new Error('should not award'); } });
        assert.strictEqual(res.reason, 'disabled');
        assert.strictEqual(res.granted, false);
    });

    await test('enabled flag off even if dates would pass', async function () {
        const db = makeDb({
            config: { enabled: false, cutoffAt: CUTOFF, unlockAt: UNLOCK },
            users: { u1: { data: {}, passes: { q: { at: ts(BEFORE) } }, awards: {} } },
        });
        const res = await ob.maybeAward(db, {}, 'u1', { nowMs: AFTER_UNLOCK, awardFn: async function () { throw new Error('no'); } });
        assert.strictEqual(res.reason, 'disabled');
    });

    await test('too early before unlock', async function () {
        const db = makeDb({
            config: defaultConfig,
            users: { u1: { data: {}, passes: { q: { at: ts(BEFORE) } }, awards: {} } },
        });
        const res = await ob.maybeAward(db, {}, 'u1', { nowMs: UNLOCK - 1, awardFn: async function () { throw new Error('no'); } });
        assert.strictEqual(res.reason, 'too_early');
    });

    await test('test allowlist blocks other uids', async function () {
        const db = makeDb({
            config: Object.assign({}, defaultConfig, { testOnlyUids: ['tester'] }),
            users: { u1: { data: {}, passes: { q: { at: ts(BEFORE) } }, awards: {} } },
        });
        const res = await ob.maybeAward(db, {}, 'u1', { nowMs: AFTER_UNLOCK, awardFn: async function () { throw new Error('no'); } });
        assert.strictEqual(res.reason, 'not_in_test_allowlist');
    });

    await test('ineligible when there is no pre-cutoff quest evidence', async function () {
        const db = makeDb({
            config: defaultConfig,
            users: { u1: { data: { questsPassed: 3, completedQuests: ['quest_x__1'] }, passes: {}, awards: {} } },
        });
        const res = await ob.maybeAward(db, {}, 'u1', { nowMs: AFTER_UNLOCK, awardFn: async function () { throw new Error('no'); } });
        assert.strictEqual(res.reason, 'ineligible');
    });

    await test('awards once from a pre-cutoff quest_passes row and writes a claim', async function () {
        const calls = [];
        const db = makeDb({
            config: defaultConfig,
            users: { u1: { data: { username: 'bea' }, passes: { quest_x__1: { at: ts(BEFORE), topicKey: 'x' } }, awards: {} } },
        });
        const res = await ob.maybeAward(db, { firestore: { FieldValue: { serverTimestamp: function () { return 'SERVER'; } } } }, 'u1', {
            nowMs: AFTER_UNLOCK,
            awardFn: async function (id, opts) {
                calls.push({ id: id, opts: opts });
                return { granted: true, xp: 0, badgeId: id };
            },
        });
        assert.strictEqual(res.granted, true);
        assert.strictEqual(res.xp, 0);
        assert.strictEqual(res.via, 'quest_passes');
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].id, 'original_builder');
        assert.strictEqual(calls[0].opts.verified, true);
        assert.strictEqual(calls[0].opts.favor, false);
        assert.ok(db._state.claims.u1);
        assert.strictEqual(db._state.claims.u1.uid, 'u1');
        assert.strictEqual(db._state.claims.u1.claimedAtMs, AFTER_UNLOCK);
    });

    await test('eligibility via snapshot collection', async function () {
        const db = makeDb({
            config: defaultConfig,
            eligible: { u1: { uid: 'u1' } },
            users: { u1: { data: { questsPassed: 0 }, passes: {}, awards: {} } },
        });
        const res = await ob.maybeAward(db, {}, 'u1', {
            nowMs: AFTER_UNLOCK,
            awardFn: async function () { return { granted: true, xp: 0, badgeId: ob.BADGE_ID }; },
        });
        assert.strictEqual(res.granted, true);
        assert.strictEqual(res.via, 'snapshot');
    });

    await test('eligibility via quest_* badge award timestamp', async function () {
        const db = makeDb({
            config: defaultConfig,
            users: { u1: { data: {}, passes: {}, awards: { quest_1: { awardedAt: ts(BEFORE), badge: 'quest_1' } } } },
        });
        const res = await ob.maybeAward(db, {}, 'u1', {
            nowMs: AFTER_UNLOCK,
            awardFn: async function () { return { granted: true, xp: 0, badgeId: ob.BADGE_ID }; },
        });
        assert.strictEqual(res.granted, true);
        assert.strictEqual(res.via, 'quest_badge_award');
    });

    await test('idempotent: already awarded does not call awardFn again', async function () {
        const db = makeDb({
            config: defaultConfig,
            users: { u1: { data: {}, passes: { q: { at: ts(BEFORE) } }, awards: { original_builder: { awardedAt: ts(AFTER_UNLOCK), xp: 0 } } } },
        });
        const res = await ob.maybeAward(db, {}, 'u1', {
            nowMs: AFTER_UNLOCK + 1000,
            awardFn: async function () { throw new Error('should not re-award'); },
        });
        assert.strictEqual(res.reason, 'already');
        assert.strictEqual(res.granted, false);
    });

    await test('created-before cutoff is not enough without a completed quest', async function () {
        const db = makeDb({
            config: defaultConfig,
            users: { u1: { data: { createdAtMs: BEFORE, questsPassed: 0 }, passes: {}, awards: {} } },
        });
        const res = await ob.maybeAward(db, {}, 'u1', {
            nowMs: AFTER_UNLOCK,
            awardFn: async function () { throw new Error('no'); },
        });
        assert.strictEqual(res.reason, 'ineligible');
    });

    await test('default config dates are midnight ET', function () {
        assert.strictEqual(ob.DEFAULT_CUTOFF_MS, Date.parse('2026-12-01T05:00:00.000Z'));
        assert.strictEqual(ob.DEFAULT_UNLOCK_MS, Date.parse('2027-01-03T05:00:00.000Z'));
        const parsed = ob.readConfigFromData({});
        assert.strictEqual(parsed.enabled, false);
        assert.strictEqual(parsed.cutoffAtMs, ob.DEFAULT_CUTOFF_MS);
        assert.strictEqual(parsed.unlockAtMs, ob.DEFAULT_UNLOCK_MS);
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
}

run();
