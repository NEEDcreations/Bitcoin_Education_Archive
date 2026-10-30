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
const updates = [];

function sentNachoSources(files) {
    const found = {};
    files.forEach(function (file) {
        let src = fs.readFileSync(file, 'utf8');
        src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
        let match;
        const typeRe = /type:\s*'([A-Za-z0-9+]+)'/g;
        while ((match = typeRe.exec(src))) {
            if (match[1] === 'playlist' || match[1] === 'track') continue;
            found[match[1]] = true;
        }
        const callRe = /(?:nachoTrackTopic|reply)\([\s\S]{0,180}?,\s*'([A-Za-z0-9+]+)'\s*\)/g;
        while ((match = callRe.exec(src))) found[match[1]] = true;
        if (/source\s*\|\|\s*'unknown'/.test(src)) found.unknown = true;
    });
    return Object.keys(found).sort();
}

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

function nestUpdate(args) {
    const data = {};
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i];
        const value = args[i + 1];
        if (key && key.segments) {
            let cur = data;
            for (let s = 0; s < key.segments.length - 1; s++) {
                const seg = key.segments[s];
                if (!cur[seg] || typeof cur[seg] !== 'object') cur[seg] = {};
                cur = cur[seg];
            }
            cur[key.segments[key.segments.length - 1]] = value;
        } else {
            data[key] = value;
        }
    }
    return data;
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
            update: function (docRef, dataOrPath) {
                const raw = Array.prototype.slice.call(arguments, 1);
                const varargs = typeof dataOrPath === 'string' || (dataOrPath && dataOrPath.segments);
                const data = varargs ? nestUpdate(raw) : dataOrPath;
                updates.push(raw);
                pending.push({ path: docRef.path, data: data, merge: true, raw: raw });
            },
        };
        const result = await fn(tx);
        pending.forEach(function (write) { apply(write.path, write.data, write.merge); });
        return result;
    },
};

function FieldValue() {}
FieldValue.serverTimestamp = function () { return { _ts: true }; };
FieldValue.increment = function (n) { return { _inc: n }; };
function FieldPath() {
    this.segments = Array.prototype.slice.call(arguments);
}
function HttpsError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

let now = 1_700_000_000_000;
const record = analytics.createRecordNachoAnalytics({
    admin: { firestore: { FieldValue: FieldValue, FieldPath: FieldPath } },
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

    const plus = await record({
        kind: 'question',
        topic: 'basics',
        source: 'ai+kb',
        eventId: 'question03',
    }, signedIn('ada'));
    assert.strictEqual(plus.counted, true);
    assert.strictEqual(docs['stats/nacho-analytics'].sources['ai+kb'], 1);
    assert.strictEqual(docs['stats/nacho-analytics'].sources.ai, undefined);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(docs['stats/nacho-analytics'], 'sources.ai+kb'), false);
    assert.strictEqual(docs['stats/nacho-analytics'].sources['ai+kb.pwned'], undefined);
    const plusUpdate = updates[updates.length - 1];
    const sourcePath = plusUpdate.filter(function (part) { return part && part.segments && part.segments[0] === 'sources'; })[0];
    assert.deepStrictEqual(sourcePath.segments, ['sources', 'ai+kb']);
    plusUpdate.forEach(function (part) {
        if (typeof part === 'string') assert.strictEqual(part.indexOf('sources.'), -1);
    });

    const sent = sentNachoSources([
        path.join(root, 'nacho-qa.js'),
        path.join(root, 'app.js'),
    ]);
    sent.forEach(function (name) {
        const parsed = analytics.normalizeEvent({
            kind: 'question',
            eventId: 'sourceok01',
            topic: 'basics',
            source: name,
        });
        assert.strictEqual(parsed.event.source, name, name + ' must stay on the allowlist');
    });
    ['ai+kb', 'site', 'websearch', 'math', 'deepsearch', 'statement', 'live'].forEach(function (name) {
        assert.ok(sent.indexOf(name) !== -1, name + ' is sent by the client');
    });
    assert.strictEqual(analytics.normalizeEvent({
        kind: 'question', eventId: 'sourceok01', source: 'ai+kb.extra', topic: 'basics',
    }).event.source, 'unknown');

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
    assert.strictEqual(docs['stats/nacho-analytics'].totalQuestions, 3);

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
