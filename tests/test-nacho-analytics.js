'use strict';

// Nacho counters are server-written. A client amount is ignored. Repeats dedupe.
// The reset script is dry-run unless --apply, and this test does not apply it.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const analytics = require(path.join(__dirname, '..', 'functions/src/nachoAnalytics'));
const reset = require(path.join(__dirname, '..', 'functions/scripts/reset_nacho_analytics'));

const docs = Object.create(null);
const sets = [];

function apply(pathKey, data, merge) {
    const cur = merge && docs[pathKey] ? Object.assign({}, docs[pathKey]) : {};
    Object.keys(data || {}).forEach(function (key) {
        const value = data[key];
        if (value && value._inc != null && key.indexOf('.') !== -1) {
            const parts = key.split('.');
            const parent = cur[parts[0]] && typeof cur[parts[0]] === 'object' ? Object.assign({}, cur[parts[0]]) : {};
            parent[parts[1]] = (Number(parent[parts[1]]) || 0) + value._inc;
            cur[parts[0]] = parent;
        } else if (value && value._inc != null) {
            cur[key] = (Number(cur[key]) || 0) + value._inc;
        } else if (value && value._ts) {
            cur[key] = 1;
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            const nested = merge && cur[key] && typeof cur[key] === 'object' ? Object.assign({}, cur[key]) : {};
            Object.keys(value).forEach(function (child) {
                nested[child] = value[child] && value[child]._inc != null
                    ? (Number(nested[child]) || 0) + value[child]._inc
                    : value[child];
            });
            cur[key] = nested;
        } else {
            cur[key] = value;
        }
    });
    docs[pathKey] = cur;
}

function snap(pathKey) {
    const data = docs[pathKey];
    return {
        exists: data != null,
        data: function () { return data ? Object.assign({}, data) : undefined; },
    };
}

function ref(pathKey) {
    return {
        path: pathKey,
        get: async function () { return snap(pathKey); },
        set: async function (data) { sets.push(pathKey); apply(pathKey, data, false); },
    };
}

const db = {
    collection: function (name) {
        return { doc: function (id) { return ref(name + '/' + id); } };
    },
    runTransaction: async function (fn) {
        const pending = [];
        const tx = {
            get: async function (docRef) { return snap(docRef.path); },
            set: function (docRef, data) { pending.push({ path: docRef.path, data: data, merge: false }); },
            update: function (docRef, data) { pending.push({ path: docRef.path, data: data, merge: true }); },
        };
        const result = await fn(tx);
        pending.forEach(function (write) { apply(write.path, write.data, write.merge); });
        return result;
    },
};

function FieldValue() {}
FieldValue.serverTimestamp = function () { return { _ts: true }; };
FieldValue.increment = function (n) { return { _inc: n }; };
function HttpsError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

let now = 1_700_000_000_000;
const record = analytics.createRecordNachoAnalytics({
    admin: { firestore: { FieldValue: FieldValue } },
    db: db,
    HttpsError: HttpsError,
    now: function () { return now; },
});

function signedIn(uid) {
    return { auth: { uid: uid, token: { firebase: { sign_in_provider: 'password' } } } };
}

(async function main() {
    const root = path.join(__dirname, '..');
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const statsAt = rules.indexOf('match /stats/{statId}');
    const statsBlock = rules.slice(statsAt, rules.indexOf('match /analytics/{docId}', statsAt));
    assert.strictEqual(statsBlock.includes("statId == 'nacho-analytics'\n"), false);
    assert.strictEqual(statsBlock.includes('allow create, update: if statId == \'nacho-analytics\''), false);
    assert.ok(statsBlock.includes('recordNachoAnalytics'));
    const analyticsAt = rules.indexOf('match /analytics/{docId}');
    const analyticsBlock = rules.slice(analyticsAt, rules.indexOf('\n    match /', analyticsAt + 10));
    assert.ok(analyticsBlock.includes('allow read, write: if false;'));
    const client = fs.readFileSync(path.join(root, 'nacho-qa.js'), 'utf8');
    assert.ok(client.includes("httpsCallable('recordNachoAnalytics')"));
    assert.strictEqual(client.includes("doc('nacho-analytics')"), false);
    assert.strictEqual(client.includes("collection('analytics')"), false);
    assert.strictEqual(client.includes("collection('nacho_feedback')"), false);
    assert.strictEqual(client.includes("collection('nacho_misses')"), false);
    const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    assert.ok(ranking.includes('recordNachoAnalytics: 1'));
    const server = fs.readFileSync(path.join(root, 'functions/src/nachoAnalytics.js'), 'utf8');
    assert.ok(server.includes('enforceAppCheck: true'));
    const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    assert.ok(index.includes('exports.recordNachoAnalytics'));

    await assert.rejects(record({ kind: 'question', eventId: 'question01' }, null), function (err) {
        return err.code === 'unauthenticated';
    });
    await assert.rejects(record({ kind: 'question', eventId: 'question01' }, {
        auth: { uid: 'anon', token: { firebase: { sign_in_provider: 'anonymous' } } },
    }), function (err) {
        return err.code === 'permission-denied';
    });
    await assert.rejects(record({ kind: 'question', eventId: 'short', totalQuestions: 999999 }, signedIn('ada')), function (err) {
        return err.code === 'invalid-argument';
    });

    const first = await record({
        kind: 'question',
        topic: 'not-a-topic',
        source: '<script>',
        eventId: 'question01',
        totalQuestions: 999999,
    }, signedIn('ada'));
    assert.strictEqual(first.counted, true);
    assert.strictEqual(docs['stats/nacho-analytics'].totalQuestions, 1);
    assert.strictEqual(docs['stats/nacho-analytics'].topics.other, 1);
    assert.strictEqual(docs['stats/nacho-analytics'].sources.unknown, 1);
    assert.strictEqual(docs['stats/nacho-analytics'].topics['not-a-topic'], undefined);

    const again = await record({
        kind: 'question',
        topic: 'lightning',
        source: 'kb',
        eventId: 'question01',
        totalQuestions: 999999,
    }, signedIn('ada'));
    assert.strictEqual(again.duplicate, true);
    assert.strictEqual(docs['stats/nacho-analytics'].totalQuestions, 1);

    const second = await record({
        kind: 'question',
        topic: 'lightning',
        source: 'kb',
        eventId: 'question02',
    }, signedIn('ada'));
    assert.strictEqual(second.counted, true);
    assert.strictEqual(docs['stats/nacho-analytics'].totalQuestions, 2);
    assert.strictEqual(docs['stats/nacho-analytics'].topics.lightning, 1);
    assert.strictEqual(docs['stats/nacho-analytics'].topics.other, 1);

    const up = await record({ kind: 'vote', rating: 1, eventId: 'vote_msg_up' }, signedIn('ada'));
    assert.strictEqual(up.counted, true);
    assert.strictEqual(docs['stats/nacho-analytics'].upvotes, 1);
    assert.strictEqual(docs['analytics/nacho_feedback'].thumbsUp, 1);
    assert.strictEqual(docs['analytics/nacho_feedback'].total, 1);
    const upAgain = await record({ kind: 'vote', rating: 1, eventId: 'vote_msg_up' }, signedIn('ada'));
    assert.strictEqual(upAgain.duplicate, true);
    assert.strictEqual(docs['stats/nacho-analytics'].upvotes, 1);

    const miss = await record({ kind: 'miss', topic: 'wallets', eventId: 'miss_0001' }, signedIn('ada'));
    assert.strictEqual(miss.counted, true);
    assert.strictEqual(docs['stats/nacho-analytics'].missCount, 1);
    assert.strictEqual(docs['analytics/nacho_misses'].total, 1);

    now += 1000;
    docs['rate_limits/nacho_analytics_ada'].count = analytics.WINDOW_MAX;
    docs['rate_limits/nacho_analytics_ada'].windowStartMs = now;
    await assert.rejects(record({
        kind: 'question', topic: 'basics', source: 'kb', eventId: 'question99',
    }, signedIn('ada')), function (err) {
        return err.code === 'resource-exhausted';
    });
    assert.strictEqual(docs['stats/nacho-analytics'].totalQuestions, 2);

    const capped = Object.assign({}, docs['rate_limits/nacho_analytics_ada'], {
        count: 0,
        windowStartMs: now - 120000,
        dayKey: analytics.offsetDay(now),
        dayCount: analytics.DAY_MAX,
    });
    docs['rate_limits/nacho_analytics_ada'] = capped;
    await assert.rejects(record({
        kind: 'question', topic: 'basics', source: 'kb', eventId: 'question98',
    }, signedIn('ada')), function (err) {
        return err.code === 'resource-exhausted';
    });

    const poisoned = {
        totalQuestions: 999999,
        upvotes: 50,
        downvotes: 1,
        missCount: 8,
        topics: { lightning: 10, pwned: 999 },
        sources: { kb: 4 },
        recentMisses: { t1: { q: 'secret question text' } },
        junk: 'ignore-me',
    };
    const plan = analytics.resetPlan(poisoned);
    assert.strictEqual(plan.before.totalQuestions, 999999);
    assert.strictEqual(plan.before.topicKeys, 2);
    assert.strictEqual(plan.before.recentMisses, 1);
    assert.strictEqual(plan.before.extraKeys, 1);
    assert.strictEqual(reset.parseArgs([]).apply, false);
    assert.strictEqual(reset.parseArgs(['--apply']).apply, true);
    const fake = {
        collection: function () {
            return { doc: function () { return ref('stats/nacho-analytics'); } };
        },
    };
    docs['stats/nacho-analytics'] = poisoned;
    sets.length = 0;
    const dry = await reset.runReset(fake, FieldValue, { apply: false });
    assert.strictEqual(dry.mode, 'dry-run');
    assert.strictEqual(dry.written, false);
    assert.strictEqual(sets.length, 0);
    assert.strictEqual(docs['stats/nacho-analytics'].totalQuestions, 999999);
    assert.strictEqual(docs['stats/nacho-analytics'].recentMisses.t1.q, 'secret question text');
    const applied = await reset.runReset(fake, FieldValue, { apply: true });
    assert.strictEqual(applied.written, true);
    assert.strictEqual(docs['stats/nacho-analytics'].totalQuestions, 0);
    assert.strictEqual(docs['stats/nacho-analytics'].upvotes, 0);
    assert.strictEqual(docs['stats/nacho-analytics'].downvotes, 0);
    assert.strictEqual(docs['stats/nacho-analytics'].missCount, 0);
    assert.deepStrictEqual(docs['stats/nacho-analytics'].topics, {});
    assert.strictEqual(docs['stats/nacho-analytics'].recentMisses, undefined);
    assert.strictEqual(docs['stats/nacho-analytics'].junk, undefined);
    const script = fs.readFileSync(path.join(root, 'functions/scripts/reset_nacho_analytics.js'), 'utf8');
    assert.ok(script.includes('Dry-run is the default'));
    assert.ok(script.includes("argv.indexOf('--apply')"));
    assert.ok(script.includes('require.main === module'));
    console.log('nacho analytics tests ok');
})().catch(function (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
