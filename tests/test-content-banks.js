// Schema, rotation, and duplicate checks for trivia, polls, and quizzes.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }
function load(code, name) {
    const ctx = vm.createContext({});
    vm.runInContext(code + '\nthis.__E=' + name + ';', ctx);
    return ctx.__E;
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function norm(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const questSrc = read('quests.js');
const marker = questSrc.indexOf('// ── STATIC QUEST INDEX');
const QB = load(questSrc.slice(0, marker), 'QUESTION_BANK');
const trivia = load(read('data/trivia-bank.js'), 'TRIVIA_BANK');
const polls = load(read('data/poll-bank.js'), 'POLL_BANK');
const lqSrc = read('learning-quests.js');
const lqAt = lqSrc.indexOf('var LQ_TOPICS = [');
const lqEnd = lqSrc.indexOf('var ALL_SLUGS', lqAt);
const topics = load(lqSrc.slice(lqAt, lqEnd), 'LQ_TOPICS');

test('trivia schema, answer spread, and mod 7', () => {
    assert.ok(trivia.length > 400);
    assert.notStrictEqual(trivia.length % 7, 0);
    const dist = [0, 0, 0, 0];
    const seen = new Set();
    trivia.forEach((item, i) => {
        assert.strictEqual(item.options.length, 4, 'options at ' + i);
        assert.ok(Number.isInteger(item.answer) && item.answer >= 0 && item.answer < 4, 'answer at ' + i);
        assert.ok(item.q && item.explanation);
        assert.ok(!item.q.includes('\\') && !item.explanation.includes('\\'));
        item.options.forEach(opt => assert.ok(!String(opt).includes('\\')));
        const n = norm(item.q);
        assert.ok(!seen.has(n), 'duplicate trivia ' + item.q);
        seen.add(n);
        dist[item.answer]++;
    });
    assert.ok(Math.max.apply(null, dist) - Math.min.apply(null, dist) <= 1);
});

test('daily trivia rotation visits every index once per cycle', () => {
    const len = trivia.length;
    const seen = new Set();
    for (let day = 0; day < len; day++) {
        const seed = ((day * 7 + 2026) % len + len) % len;
        seen.add(seed);
    }
    assert.strictEqual(seen.size, len);
});

function activePollIndexes(list) {
    const idx = [];
    list.forEach((poll, i) => { if (!poll.retired) idx.push(i); });
    return idx;
}

test('poll schema, unique ids, and mod 13', () => {
    assert.ok(polls.length > 380);
    const active = activePollIndexes(polls);
    assert.notStrictEqual(active.length % 13, 0);
    const ids = new Set();
    const seen = new Set();
    polls.forEach(poll => {
        assert.ok(/^poll_\d+$/.test(poll.id));
        assert.ok(!ids.has(poll.id), poll.id);
        ids.add(poll.id);
        assert.strictEqual(poll.options.length, 4, poll.id);
        assert.ok(poll.q && poll.category);
        const n = norm(poll.q);
        assert.ok(!seen.has(n), 'duplicate poll ' + poll.q);
        seen.add(n);
        poll.options.forEach(opt => assert.ok(!String(opt).includes('\\')));
    });
    for (let n = 121; n <= 135; n++) assert.ok(ids.has('poll_' + String(n).padStart(3, '0')));
    assert.ok(ids.has('poll_146') && ids.has('poll_147'));
    const retired = ['poll_007','poll_009','poll_012','poll_015','poll_021','poll_065','poll_075','poll_089','poll_101','poll_104','poll_106','poll_107','poll_109','poll_115','poll_118','poll_120'];
    retired.forEach((id, i) => {
        const poll = polls.find(p => p.id === id);
        assert.ok(poll && poll.retired, id);
        const fresh = polls.find(p => p.id === 'poll_' + String(440 + i).padStart(3, '0'));
        assert.ok(fresh && !fresh.retired, id);
        assert.notStrictEqual(norm(poll.q), norm(fresh.q));
    });
    assert.ok(questSrc.includes('if (!POLL_BANK[i].retired) active.push(i);'));
});

test('daily poll rotation visits every active index once per cycle', () => {
    const active = activePollIndexes(polls);
    const len = active.length;
    const seen = new Set();
    for (let day = 0; day < len; day++) {
        const seed = ((day * 13 + 2026) % len + len) % len;
        seen.add(active[seed]);
    }
    assert.strictEqual(seen.size, len);
    polls.forEach((poll, i) => {
        if (poll.retired) assert.ok(!seen.has(i), poll.id);
    });
});

test('quiz topics, parts of 5, and no duplicate text inside a part', () => {
    const keyRe = /^[A-Za-z0-9_-]{1,80}$/;
    let questions = 0;
    Object.keys(QB).forEach(topic => {
        assert.ok(keyRe.test(topic), topic);
        const list = QB[topic];
        assert.strictEqual(list.length % 5, 0, topic);
        assert.ok(list.length / 5 <= 41, topic);
        questions += list.length;
        for (let p = 0; p < list.length / 5; p++) {
            const part = new Set();
            for (let i = 0; i < 5; i++) {
                const item = list[p * 5 + i];
                assert.strictEqual(item.wrong.length, 3);
                assert.ok(item.q && item.a);
                [item.q, item.a].concat(item.wrong).forEach(s => assert.ok(!String(s).includes('\\'), topic));
                const n = norm(item.q);
                assert.ok(!part.has(n), topic + ' part ' + p);
                part.add(n);
            }
        }
    });
    assert.ok(questions > 1500);
});

test('no exact duplicate question text across trivia, quizzes, and lessons', () => {
    const seen = new Map();
    function add(label, q) {
        const n = norm(q);
        assert.ok(!seen.has(n), label + ' duplicates ' + seen.get(n) + ' :: ' + q);
        seen.set(n, label);
    }
    trivia.forEach((item, i) => add('trivia#' + i, item.q));
    Object.keys(QB).forEach(topic => QB[topic].forEach((item, i) => add(topic + '#' + i, item.q)));
    topics.forEach(topic => topic.questions.forEach((item, i) => add('lq:' + topic.slug + '#' + i, item.q)));
});

test('trivia shuffle is wired and keeps the correct answer text', () => {
    assert.ok(questSrc.includes('function _shuffleTriviaOptions'));
    assert.ok(questSrc.includes('function _getTriviaToday'));
    const today = questSrc.slice(questSrc.indexOf('function _getTriviaToday'));
    assert.ok(today.slice(0, 800).includes('_shuffleTriviaOptions'));
    assert.ok(questSrc.includes('function _triviaStatIndex'));
    assert.ok(questSrc.includes("statsUpdate['option_' + _bankIdx]"));
    const shuffleSrc = questSrc.slice(
        questSrc.indexOf('function _hashTriviaSeed'),
        questSrc.indexOf('function _getTriviaToday')
    );
    const fn = new Function(shuffleSrc + '\nreturn { shuffle: _shuffleTriviaOptions, stat: _triviaStatIndex };');
    const api = fn();
    const sample = { q: 'Sample?', options: ['red', 'blue', 'green', 'gold'], answer: 2, explanation: 'because' };
    const a = api.shuffle(sample, '2026-10-22');
    const b = api.shuffle(sample, '2026-10-22');
    assert.deepStrictEqual(a.options, b.options);
    assert.strictEqual(a.options[a.answer], 'green');
    assert.strictEqual(a.bankIndexOfDisplay[a.answer], 2);
    assert.strictEqual(api.stat(a, a.answer), 2);
    const other = api.shuffle(sample, '2026-01-02');
    assert.strictEqual(other.options[other.answer], 'green');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
