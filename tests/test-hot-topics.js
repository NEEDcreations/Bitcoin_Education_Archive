// Hot Topics: JSON repair, fail-soft sources, quality-gate alerts. No network.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ht = require('../functions/src/hotTopics');

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

function res(status, body) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return {
        ok: status >= 200 && status < 300,
        status: status,
        text: function() { return Promise.resolve(text); },
        json: function() { return Promise.resolve(JSON.parse(text)); },
    };
}

const RUN_AT = new Date('2026-10-24T02:00:00.000Z');
const GOOD_TOPIC = {
    title: 'BIP-110 data limit',
    summary: 'The thread says BIP-110 would cap arbitrary data in 2026.',
    heatScore: 80,
    sides: [
        { stance: 'for', label: 'The case FOR', summary: 'Posters want less non-monetary data.' },
        { stance: 'against', label: 'The case AGAINST', summary: 'Others say a temporary fork is risky.' },
    ],
    postIndices: [],
};

function fakeDb() {
    const sets = [];
    return {
        sets: sets,
        collection: function(name) {
            return {
                doc: function(id) {
                    return {
                        set: function(data, opts) {
                            sets.push({ collection: name, id: id, data: data, opts: opts });
                            return Promise.resolve();
                        },
                    };
                },
            };
        },
    };
}

const adminStub = {
    firestore: { FieldValue: { serverTimestamp: function() { return 'SERVER_TS'; } } },
};

test('node --check accepts the hot topics module and functions index', function() {
    execFileSync(process.execPath, ['--check', path.join(__dirname, '../functions/src/hotTopics.js')], { stdio: 'pipe' });
    execFileSync(process.execPath, ['--check', path.join(__dirname, '../functions/index.js')], { stdio: 'pipe' });
    execFileSync(process.execPath, ['--check', path.join(__dirname, '../hot-topics.js')], { stdio: 'pipe' });
});

test('strips fences, extracts the first object, and repairs broken JSON', function() {
    const fenced = '```json\n{"topics":[{"title":"BIP-110 data limit","summary":"BIP-110 in 2026.","heatScore":80,"sides":[]}]}\n```';
    const parsedFence = ht.parseModelJson(fenced);
    assert.strictEqual(parsedFence.topics[0].title, 'BIP-110 data limit');

    const trailing = 'Note before {"topics":[{"title":"Fees","summary":"A fee thread from 2026.","heatScore":10,"sides":[]}]} trailing {"nope":1}';
    const parsedTrail = ht.parseModelJson(trailing);
    assert.strictEqual(parsedTrail.topics[0].title, 'Fees');
    assert.ok(!parsedTrail.nope);

    const braces = '{"topics":[{"title":"Script braces","summary":"Alice wrote \\"{not a date}\\" about BIP-110.","heatScore":3,"sides":[]}]}';
    const parsedBraces = ht.parseModelJson('preamble ' + braces + ' tail');
    assert.ok(parsedBraces.topics[0].summary.includes('{not a date}'));

    const repaired = "{ topics: [{ title: 'BIP-110 data', summary: 'Miners discussed BIP-110 in 2026.', heatScore: 70, sides: [], },] }";
    const parsedRepair = ht.parseModelJson(repaired);
    assert.strictEqual(parsedRepair.topics[0].heatScore, 70);
    assert.strictEqual(ht.validateTopicsShape(parsedRepair).ok, true);

    const asArray = '[{"title":"BIP-360","summary":"A quantum hash proposal discussed in 2026.","heatScore":5,"sides":[]}]';
    const parsedArray = ht.parseModelJson(asArray);
    assert.ok(Array.isArray(parsedArray.topics));
    assert.strictEqual(parsedArray.topics[0].title, 'BIP-360');

    const truncated = '{"topics":[{"title":"BIP-110","summary":"Still open in 2026.","heatScore":9,"sides":[]}';
    const parsedCut = ht.parseModelJson(truncated);
    assert.strictEqual(parsedCut.topics[0].title, 'BIP-110');
});

test('rejects a payload that is not a topics object', function() {
    const bad = ht.validateTopicsShape(ht.parseModelJson('{"topics":"nope"}'));
    assert.strictEqual(bad.ok, false);
    const missing = ht.validateTopicsShape({ topics: [{ title: 'BIP-110', summary: '' }] });
    assert.strictEqual(missing.ok, false);
    const ok = ht.validateTopicsShape({ topics: [] });
    assert.strictEqual(ok.ok, true);
});

test('Cloudflare JSON mode body carries the schema, and an object response unwraps', function() {
    const body = ht.buildCloudflareBody('prompt', true);
    assert.strictEqual(body.response_format.type, 'json_schema');
    assert.ok(Array.isArray(body.response_format.json_schema.required));
    assert.deepStrictEqual(body.guided_json, ht.HOT_TOPICS_SCHEMA);
    const plain = ht.buildCloudflareBody('prompt', false);
    assert.ok(!plain.response_format);
    const unwrapped = ht.unwrapCloudflare({
        success: true,
        result: { response: { topics: [GOOD_TOPIC] } },
    });
    assert.strictEqual(unwrapped.topics[0].title, GOOD_TOPIC.title);
});

test('prompt uses the run date and does not bake in June 2026 facts', function() {
    const built = ht.buildPrompt([{ source: 'reddit', title: 'A thread', url: 'https://reddit.com/x', body: '' }], RUN_AT);
    assert.ok(built.prompt.includes('Friday, October 23, 2026'));
    assert.ok(/never invent dates/i.test(built.prompt));
    assert.ok(built.prompt.indexOf('KNOWN FACTS') === -1);
    assert.ok(built.prompt.indexOf('June 2026') === -1);
    assert.ok(built.prompt.indexOf('Jameson Lopp') === -1);
    assert.ok(built.prompt.indexOf('0.3%') === -1);
    assert.ok(built.prompt.indexOf('chain split') === -1);
});

test('quality gate still rejects boilerplate and keeps specific topics', function() {
    assert.strictEqual(ht.isRealTopics([{
        title: 'Fee Discussion',
        summary: 'The Bitcoin community is actively discussing fees this week.',
    }]), false);
    assert.strictEqual(ht.isRealTopics([{
        title: 'Something',
        summary: 'people talked about fees.',
    }]), false);
    assert.strictEqual(ht.isRealTopics([GOOD_TOPIC]), true);
    assert.strictEqual(ht.isRealTopics([]), false);
    assert.strictEqual(ht.isRealTopics(ht.emptyWeekTopic()), true);
});

test('X queries stay inside the read budget and cover every curated account', function() {
    const queries = ht.buildXSearchQueries(ht.CURATED_X_ACCOUNTS);
    assert.strictEqual(ht.CURATED_X_ACCOUNTS.length, 44);
    assert.ok(queries.length >= 1);
    assert.ok(queries.length <= 2);
    queries.forEach(function(q) {
        assert.ok(q.length <= 512, 'query length ' + q.length);
        assert.ok(q.indexOf('site:x.com') === -1);
        assert.ok(q.endsWith('-is:retweet'));
    });
    ht.CURATED_X_ACCOUNTS.forEach(function(name) {
        assert.ok(queries.some(q => q.indexOf('from:' + name) !== -1), name);
    });
    const cost = ht.xCostEstimate();
    assert.strictEqual(cost.perPostUsd, 0.005);
    assert.strictEqual(cost.maxResults, 10);
    assert.strictEqual(cost.searchCallBudget, 3);
    assert.strictEqual(cost.happyPathCalls, queries.length);
    assert.strictEqual(cost.happyPathMaxUsd, Number((queries.length * 10 * 0.005).toFixed(2)));
    assert.ok(cost.happyPathMaxUsd <= 0.1);
});

test('Reddit RSS and Stacker News parse, and a 403 does not throw', async function() {
    const redditXml = '<?xml version="1.0"?><feed><entry>' +
        '<title>BIP-110 signaling thread</title>' +
        '<link rel="alternate" href="https://www.reddit.com/r/Bitcoin/comments/abc/bip110/"/>' +
        '<content type="html">&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;</content>' +
        '</entry></feed>';
    const items = ht.parseFeedItems(redditXml);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].url, 'https://www.reddit.com/r/Bitcoin/comments/abc/bip110/');
    assert.ok(items[0].body.indexOf('Hello & welcome') !== -1);

    const calls = [];
    const fetch = function(url, init) {
        calls.push({ url: String(url), ua: init.headers['User-Agent'] });
        if (String(url).indexOf('www.reddit.com') !== -1) return Promise.resolve(res(403, 'blocked'));
        if (String(url).indexOf('old.reddit.com') !== -1 && String(url).indexOf('/hot.rss') !== -1) {
            return Promise.resolve(res(200, redditXml));
        }
        if (String(url).indexOf('old.reddit.com') !== -1) return Promise.resolve(res(500, 'nope'));
        return Promise.resolve(res(500, 'unexpected'));
    };
    const reddit = await ht.fetchRedditHot({ fetch: fetch, env: {} });
    assert.strictEqual(reddit.failed, false);
    assert.strictEqual(reddit.items.length, 1);
    assert.strictEqual(reddit.items[0].source, 'reddit');
    assert.ok(calls.every(c => c.ua === ht.SOURCE_UA));

    const stacker = await ht.fetchStackerNews({
        env: {},
        fetch: function(url) {
            if (String(url).indexOf('/rss') !== -1) return Promise.resolve(res(403, 'no rss'));
            if (String(url).indexOf('graphql') !== -1) {
                return Promise.resolve(res(200, {
                    data: { items: { items: [{ id: 42, title: 'Soft fork thread', text: 'BIP-110 again', sats: 1000, ncomments: 4 }] } },
                }));
            }
            return Promise.resolve(res(500, 'no'));
        },
    });
    assert.strictEqual(stacker.failed, false);
    assert.strictEqual(stacker.items[0].url, 'https://stacker.news/items/42');
    assert.strictEqual(stacker.items[0].source, 'stackernews');

    const dead = await ht.fetchStackerNews({
        env: {},
        fetch: function() { return Promise.reject(new Error('network down')); },
    });
    assert.strictEqual(dead.failed, true);
    assert.deepStrictEqual(dead.items, []);
});

test('one dead source does not drop the others, and X stops on 429', async function() {
    const seen = [];
    const fetch = function(url) {
        const u = String(url);
        seen.push(u);
        if (u.indexOf('/oauth2/token') !== -1) return Promise.resolve(res(200, { access_token: 'app-token' }));
        if (u.indexOf('/2/tweets/search/recent') !== -1) return Promise.resolve(res(429, { title: 'Too Many Requests' }));
        if (u.indexOf('://www.reddit.com') !== -1 || u.indexOf('://old.reddit.com') !== -1) return Promise.resolve(res(403, 'blocked'));
        if (u.indexOf('://stacker.news') !== -1) return Promise.resolve(res(500, 'down'));
        if (u.indexOf('nacho-search') !== -1) {
            assert.ok(u.indexOf('site:x.com') === -1);
            assert.ok(u.indexOf('site:twitter.com') === -1);
            return Promise.resolve(res(200, { results: [{ title: 'Fee debate', url: 'https://example.com/fees', snippet: 'fees' }] }));
        }
        if (u.indexOf('bitcointalk.org') !== -1) {
            return Promise.resolve(res(200, '<span id="msg_9"><a href="https://bitcointalk.org/index.php?topic=9.0">A long Bitcoin thread title</a></span>'));
        }
        return Promise.reject(new Error('unexpected ' + u));
    };
    const gathered = await ht.gatherTrendingSignals({
        fetch: fetch,
        env: { X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: 't', X_ACCESS_SECRET: 'ts' },
        now: RUN_AT,
    });
    assert.strictEqual(gathered.allFailed, false);
    assert.ok(gathered.signals.some(s => s.source === 'bitcointalk'));
    assert.ok(gathered.signals.some(s => s.source === 'web'));
    const byName = {};
    gathered.report.forEach(row => { byName[row.name] = row; });
    ['x', 'reddit', 'bitcointalk', 'web', 'stackernews'].forEach(name => assert.ok(byName[name], name));
    assert.strictEqual(byName.x.failed, true);
    assert.strictEqual(byName.reddit.failed, true);
    assert.strictEqual(byName.stackernews.failed, true);
    assert.strictEqual(byName.bitcointalk.failed, false);
    assert.ok(byName.bitcointalk.count >= 1);
    assert.ok(byName.web.count >= 1);
    const searchCalls = seen.filter(u => u.indexOf('/2/tweets/search/recent') !== -1);
    assert.strictEqual(searchCalls.length, 1);
    assert.ok(searchCalls.length <= ht.X_SEARCH_CALL_BUDGET);
});

test('X falls back from a rejected bearer token to OAuth 1.0a within the budget', async function() {
    const auths = [];
    let searchCalls = 0;
    const fetch = function(url, init) {
        const u = String(url);
        if (u.indexOf('/oauth2/token') !== -1) return Promise.resolve(res(200, { access_token: 'app-token' }));
        if (u.indexOf('/2/tweets/search/recent') !== -1) {
            searchCalls++;
            auths.push(init.headers.Authorization);
            if (init.headers.Authorization.indexOf('Bearer ') === 0) return Promise.resolve(res(403, { title: 'Forbidden' }));
            assert.ok(init.headers.Authorization.indexOf('OAuth ') === 0);
            return Promise.resolve(res(200, {
                data: [{ id: '100' + searchCalls, text: 'BIP-110 look at this week', author_id: 'u1', public_metrics: { like_count: 2, reply_count: 1 } }],
                includes: { users: [{ id: 'u1', username: 'nvk' }] },
            }));
        }
        return Promise.resolve(res(500, 'no'));
    };
    const outcome = await ht.fetchCuratedXPosts({
        fetch: fetch,
        env: { X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: 't', X_ACCESS_SECRET: 'ts' },
    });
    assert.strictEqual(outcome.failed, false);
    assert.ok(outcome.items.length >= 1);
    assert.ok(outcome.items[0].url.indexOf('https://x.com/nvk/status/') === 0);
    assert.ok(searchCalls <= ht.X_SEARCH_CALL_BUDGET);
    assert.strictEqual(searchCalls, 3);
    assert.ok(auths[0].indexOf('Bearer ') === 0);
    assert.ok(auths[1].indexOf('OAuth ') === 0);
});

test('AI retries parse failures with backoff, then accepts a repaired payload', async function() {
    const sleeps = [];
    let calls = 0;
    const fetch = function(url, init) {
        calls++;
        const body = JSON.parse(init.body);
        assert.strictEqual(body.response_format.type, 'json_schema');
        if (calls < 3) {
            return Promise.resolve(res(200, { success: true, result: { response: 'not json at all' } }));
        }
        return Promise.resolve(res(200, {
            success: true,
            result: { response: '```json\n' + JSON.stringify({ topics: [GOOD_TOPIC] }) + '\n```' },
        }));
    };
    const ai = await ht.callAiForTopics('prompt', {
        fetch: fetch,
        env: { CF_ACCOUNT_ID: 'acct', CF_AI_TOKEN: 'tok' },
        sleep: function(ms) { sleeps.push(ms); return Promise.resolve(); },
    });
    assert.strictEqual(calls, 3);
    assert.deepStrictEqual(sleeps, [400, 800]);
    assert.strictEqual(ai.topics[0].title, GOOD_TOPIC.title);
});

test('a JSON-mode 400 is retried once without the schema', async function() {
    const bodies = [];
    const fetch = function(url, init) {
        const body = JSON.parse(init.body);
        bodies.push(body);
        if (body.response_format) {
            return Promise.resolve(res(400, { errors: [{ message: 'unknown field response_format' }] }));
        }
        return Promise.resolve(res(200, { success: true, result: { response: { topics: [GOOD_TOPIC] } } }));
    };
    const ai = await ht.callAiForTopics('prompt', {
        fetch: fetch,
        env: { CF_ACCOUNT_ID: 'acct', CF_AI_TOKEN: 'tok' },
        sleep: function() { throw new Error('schema retry should not backoff'); },
    });
    assert.strictEqual(bodies.length, 2);
    assert.ok(bodies[0].response_format);
    assert.ok(!bodies[1].response_format);
    assert.strictEqual(ai.topics.length, 1);
});

test('three bad AI payloads fall back, and the gate still rejects that fallback', async function() {
    const topics = await ht.clusterAndSummarize([
        { source: 'web', title: 'bitcoin fee debate', url: 'https://example.com/fees', body: 'fees' },
    ], {
        env: { CF_ACCOUNT_ID: 'acct', CF_AI_TOKEN: 'tok' },
        now: RUN_AT,
        sleep: function() { return Promise.resolve(); },
        fetch: function() {
            return Promise.resolve(res(200, { success: true, result: { response: 'no json here' } }));
        },
    });
    assert.ok(topics.length >= 1);
    assert.strictEqual(ht.isRealTopics(topics), false);
});

test('schedule alerts admins and skips the save when the gate or every source fails', async function() {
    const db = fakeDb();
    const aiBodies = [];
    const fetch = function(url, init) {
        const u = String(url);
        if (u.indexOf('api.cloudflare.com') !== -1) {
            aiBodies.push(JSON.parse(init.body));
            return Promise.resolve(res(200, {
                success: true,
                result: { response: { topics: [{
                    title: 'Fee Discussion',
                    summary: 'The Bitcoin community is actively discussing fees this week.',
                    heatScore: 20,
                    sides: [],
                }] } },
            }));
        }
        if (u.indexOf('nacho-search') !== -1) return Promise.resolve(res(200, { results: [] }));
        if (u.indexOf('bitcointalk.org') !== -1) {
            return Promise.resolve(res(200, '<span id="msg_3"><a href="https://bitcointalk.org/index.php?topic=3.0">Real fee thread title here</a></span>'));
        }
        if (u.indexOf('reddit.com') !== -1 || u.indexOf('stacker.news') !== -1) return Promise.resolve(res(503, 'down'));
        if (u.indexOf('twitter.com') !== -1) return Promise.resolve(res(401, { title: 'Unauthorized' }));
        return Promise.resolve(res(500, 'down'));
    };
    const gated = await ht.runHotTopicsJob({
        mode: 'schedule',
        fetch: fetch,
        env: { CF_ACCOUNT_ID: 'acct', CF_AI_TOKEN: 'tok', X_API_KEY: 'k', X_API_SECRET: 's' },
        now: RUN_AT,
        sleep: function() { return Promise.resolve(); },
        db: db,
        admin: adminStub,
        listAdminUids: function() { return Promise.resolve(['admin-a', 'admin-b']); },
    });
    assert.strictEqual(gated.qualityGatePassed, false);
    assert.strictEqual(gated.saved, false);
    assert.ok(gated.alert);
    assert.ok(gated.alert.message.indexOf('quality gate blocked the save') !== -1);
    assert.ok(gated.alert.message.length <= 180);
    const notes = db.sets.filter(row => row.collection === 'notifications');
    const savedTopics = db.sets.filter(row => row.collection === 'hotTopics');
    assert.strictEqual(savedTopics.length, 0);
    assert.strictEqual(notes.length, 2);
    assert.strictEqual(notes[0].id, 'hot_topics_2026-10-24_admin-a');
    assert.strictEqual(notes[0].data.recipientId, 'admin-a');
    assert.strictEqual(notes[0].data.senderId, 'system');
    assert.strictEqual(notes[0].data.senderName, 'Bitcoin Quest');
    assert.strictEqual(notes[0].data.type, 'security');
    assert.strictEqual(notes[0].data.targetType, 'hot_topics');
    assert.strictEqual(notes[0].data.targetId, '2026-10-24');
    assert.strictEqual(notes[0].data.read, false);
    assert.strictEqual(notes[0].data.createdAt, 'SERVER_TS');
    assert.deepStrictEqual(notes[0].opts, { merge: true });

    const db2 = fakeDb();
    const allFailed = await ht.runHotTopicsJob({
        mode: 'schedule',
        fetch: function() { return Promise.resolve(res(503, 'down')); },
        env: {},
        now: RUN_AT,
        db: db2,
        admin: adminStub,
        listAdminUids: function() { return Promise.resolve(['admin-a']); },
    });
    assert.strictEqual(allFailed.allSourcesFailed, true);
    assert.strictEqual(allFailed.saved, false);
    assert.ok(allFailed.alert.message.indexOf('every source failed') !== -1);
    assert.strictEqual(db2.sets.filter(row => row.collection === 'hotTopics').length, 0);
    assert.strictEqual(db2.sets.filter(row => row.collection === 'notifications').length, 1);

    const db3 = fakeDb();
    const forced = await ht.runHotTopicsJob({
        mode: 'force',
        fetch: fetch,
        env: { CF_ACCOUNT_ID: 'acct', CF_AI_TOKEN: 'tok', X_API_KEY: 'k', X_API_SECRET: 's' },
        now: RUN_AT,
        sleep: function() { return Promise.resolve(); },
        db: db3,
        admin: adminStub,
        listAdminUids: function() { return Promise.resolve(['admin-a']); },
    });
    assert.strictEqual(forced.saved, true);
    assert.strictEqual(forced.qualityGatePassed, false);
    const forceDoc = db3.sets.find(row => row.collection === 'hotTopics');
    assert.ok(forceDoc);
    assert.strictEqual(forceDoc.id, 'latest');
    assert.strictEqual(forceDoc.data.qualityGatePassed, false);
    assert.strictEqual(forceDoc.data.version, 1);
});

test('a good scheduled run saves and does not alert', async function() {
    const db = fakeDb();
    const fetch = function(url) {
        const u = String(url);
        if (u.indexOf('api.cloudflare.com') !== -1) {
            return Promise.resolve(res(200, { success: true, result: { response: { topics: [GOOD_TOPIC] } } }));
        }
        if (u.indexOf('nacho-search') !== -1) return Promise.resolve(res(200, { results: [] }));
        if (u.indexOf('bitcointalk.org') !== -1) {
            return Promise.resolve(res(200, '<span id="msg_8"><a href="https://bitcointalk.org/index.php?topic=8.0">BIP-110 data limit thread</a></span>'));
        }
        return Promise.resolve(res(200, ''));
    };
    const result = await ht.runHotTopicsJob({
        mode: 'schedule',
        fetch: fetch,
        env: { CF_ACCOUNT_ID: 'acct', CF_AI_TOKEN: 'tok' },
        now: RUN_AT,
        db: db,
        admin: adminStub,
        listAdminUids: function() { return Promise.resolve(['admin-a']); },
    });
    assert.strictEqual(result.saved, true);
    assert.strictEqual(result.qualityGatePassed, true);
    assert.strictEqual(result.alert, null);
    assert.strictEqual(db.sets.filter(row => row.collection === 'notifications').length, 0);
    const doc = db.sets.find(row => row.collection === 'hotTopics');
    assert.ok(doc);
    assert.ok(!Object.prototype.hasOwnProperty.call(doc.data, 'qualityGatePassed'));
    assert.strictEqual(doc.data.topics[0].title, GOOD_TOPIC.title);
});

test('scheduler wiring is unchanged and the old X and Reddit paths are gone', function() {
    const index = fs.readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8');
    const src = fs.readFileSync(path.join(__dirname, '../functions/src/hotTopics.js'), 'utf8');
    assert.ok(index.indexOf("schedule: '0 22 * * 0'") !== -1);
    assert.ok(index.indexOf("timeZone: 'America/New_York'") !== -1);
    assert.ok(index.indexOf("schedule: '0 22 * * 5'") === -1);
    assert.ok(index.indexOf('Sunday at 22:00 America/New_York') !== -1);
    assert.ok(index.indexOf('exports.refreshHotTopicsForce') !== -1);
    assert.ok(index.indexOf("mode: 'force'") !== -1);
    assert.ok(index.indexOf("mode: 'schedule'") !== -1);
    assert.ok(index.indexOf('qualityGatePassed') !== -1);
    assert.ok(index.indexOf('exports.refreshBadgeDistribution = onScheduleV2') !== -1);
    assert.ok(index.indexOf('site:x.com') === -1);
    assert.ok(index.indexOf('hot.json') === -1);
    assert.ok(index.indexOf('Jameson Lopp') === -1);
    assert.ok(src.indexOf('site:x.com') === -1);
    assert.ok(src.indexOf('/2/tweets/search/recent') !== -1);
    assert.ok(src.indexOf('/oauth2/token') !== -1);
    assert.ok(src.indexOf('response_format') !== -1);
    assert.ok(src.indexOf('stacker.news/~bitcoin/rss') !== -1);
    const home = fs.readFileSync(path.join(__dirname, '../hot-topics.js'), 'utf8');
    assert.ok(home.indexOf('Stacker News') !== -1);
    assert.ok(home.indexOf('Refreshes every Sunday 10pm ET') !== -1);
    assert.ok(home.indexOf('check back Sunday') !== -1);
    assert.ok(home.indexOf('Friday 10pm ET') === -1);
    assert.ok(home.indexOf('check back Friday') === -1);
    const builder = fs.readFileSync(path.join(__dirname, '../functions/src/hotTopics.js'), 'utf8');
    assert.ok(builder.indexOf('Check back next Sunday') !== -1);
    assert.ok(builder.indexOf('Check back next Friday') === -1);
    assert.strictEqual(
        fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8'),
        fs.readFileSync(path.join(__dirname, '../404.html'), 'utf8')
    );
});

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
