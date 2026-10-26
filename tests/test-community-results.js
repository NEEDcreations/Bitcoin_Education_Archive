// Post-answer trivia and poll totals use the live community tally.
// A just-submitted vote is merged once, and the listener is dropped on close.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

test('post-answer path does not bake a single-vote total', function() {
    assert.strictEqual(src.includes('_triviaOptimisticStats'), false);
    assert.strictEqual(src.includes('{ total: 1 }'), false);
    assert.strictEqual(src.includes('_drawPollResults(body, htmlPrefix, poll, [], 1'), false);
    assert.ok(src.includes("db.collection('trivia_stats')"));
    assert.ok(src.includes("db.collection('poll_votes')"));
    assert.ok(src.includes('.onSnapshot('));
    assert.ok(src.includes('Loading community results...'));
    assert.ok(src.includes('Community results are unavailable right now.'));
    var triviaListen = src.slice(src.indexOf('function _listenTriviaStats'), src.indexOf('function _captureTriviaBaseline'));
    var pollListen = src.slice(src.indexOf('function _listenPollStats'), src.indexOf('function _showPollLoading'));
    assert.ok(triviaListen.includes("_markCommunityResultsUnavailable('triviaTotalVotes')"));
    assert.ok(pollListen.includes("_markCommunityResultsUnavailable('pollTotalVotes')"));
    assert.strictEqual(triviaListen.includes('function() {}'), false);
    assert.strictEqual(pollListen.includes('function() {}'), false);
    assert.strictEqual(src.includes("db.collection('trivia_stats').doc(todayKey).set"), false);
    assert.strictEqual(src.includes("db.collection('trivia_cumulative')"), true);
    const closeStart = src.indexOf('function _closeQuestScreen');
    const closeEnd = src.indexOf('function _ensureQuestScreen');
    assert.ok(closeStart >= 0 && closeEnd > closeStart);
    assert.ok(src.slice(closeStart, closeEnd).includes('_detachCommunityResultListeners()'));
    assert.ok(src.includes("var statKey = 'option_' + _triviaStatIndex(trivia, oi)"));
});

function createDom() {
    function linkChildren(el) {
        el.childNodes.forEach(function(child, index) {
            child.parentNode = el;
            child.previousSibling = index > 0 ? el.childNodes[index - 1] : null;
            child.nextSibling = el.childNodes[index + 1] || null;
        });
    }
    function createElement(tag) {
        var el = {
            nodeType: 1,
            tagName: String(tag || 'div').toUpperCase(),
            id: '',
            className: '',
            style: {},
            attrs: {},
            childNodes: [],
            parentNode: null,
            disabled: false
        };
        el.appendChild = function(child) {
            if (child.parentNode && child.parentNode !== el) child.parentNode.removeChild(child);
            el.childNodes.push(child);
            linkChildren(el);
            return child;
        };
        el.removeChild = function(child) {
            var index = el.childNodes.indexOf(child);
            if (index >= 0) el.childNodes.splice(index, 1);
            child.parentNode = null;
            linkChildren(el);
            return child;
        };
        el.remove = function() { if (el.parentNode) el.parentNode.removeChild(el); };
        Object.defineProperty(el, 'textContent', {
            get: function() {
                var out = '';
                el.childNodes.forEach(function(child) {
                    if (child.nodeType === 3) out += child.nodeValue || '';
                    else out += child.textContent || '';
                });
                return out;
            },
            set: function(value) {
                el.childNodes = [];
                if (value != null && String(value) !== '') {
                    el.childNodes.push({ nodeType: 3, nodeValue: String(value), parentNode: el });
                }
                linkChildren(el);
            }
        });
        Object.defineProperty(el, 'innerHTML', {
            get: function() { return el._html || ''; },
            set: function(html) {
                el._html = String(html || '');
                el.childNodes = [];
                var re = /<([a-zA-Z][\w-]*)([^<>]*\sid="([^"]+)"[^<>]*)>([^<]*)<\/\1>/g;
                var match;
                while ((match = re.exec(el._html))) {
                    var child = createElement(match[1]);
                    child.id = match[3];
                    var styleMatch = match[2].match(/style="([^"]*)"/);
                    if (styleMatch) child.style.cssText = styleMatch[1];
                    if (match[4]) child.textContent = match[4];
                    el.appendChild(child);
                }
            }
        });
        return el;
    }
    var document = {
        createElement: createElement,
        createTextNode: function(text) { return { nodeType: 3, nodeValue: String(text) }; },
        querySelectorAll: function() { return []; }
    };
    var html = createElement('html');
    var body = createElement('body');
    html.appendChild(body);
    document.documentElement = html;
    document.body = body;
    document.getElementById = function(id) {
        var found = null;
        function walk(node) {
            if (!node || found) return;
            if (node.id === id) { found = node; return; }
            (node.childNodes || []).forEach(walk);
        }
        walk(html);
        return found;
    };
    return document;
}

function boot() {
    var document = createDom();
    var store = {};
    var listeners = [];
    var docs = {
        trivia_stats: { total: 10, option_0: 4, option_1: 3, option_2: 2, option_3: 1 },
        poll_votes: { votes: [8, 5, 3, 2], total: 18 }
    };
    function snap(data) {
        return { exists: true, data: function() { return data; } };
    }
    function thenable(doc) {
        return {
            then: function(ok) {
                ok(doc);
                return { catch: function() { return this; } };
            },
            catch: function() { return this; }
        };
    }
    var db = {
        collection: function(name) {
            return {
                doc: function(id) {
                    return {
                        id: id,
                        get: function() { return thenable(snap(docs[name] || {})); },
                        onSnapshot: function(cb, err) {
                            var rec = { name: name, id: id, cb: cb, err: err, unsubbed: false };
                            listeners.push(rec);
                            return function() { rec.unsubbed = true; };
                        },
                        set: function() { return { catch: function() {} }; }
                    };
                }
            };
        }
    };
    var sandbox = {
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        document: document,
        db: db,
        listeners: listeners,
        docs: docs,
        Date: Date,
        Math: Math,
        Number: Number,
        String: String,
        parseInt: parseInt,
        isFinite: isFinite,
        getDailyKey: function() { return '2026-10-24'; },
        localStorage: {
            getItem: function(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
            setItem: function(key, value) { store[key] = String(value); }
        },
        history: { replaceState: function() {}, pushState: function() {} },
        location: { hash: '', pathname: '/' },
        TRIVIA_BANK: [{
            q: 'How many people already answered?',
            options: ['One', 'A few', 'The whole block', 'Nobody'],
            answer: 2,
            explanation: 'The tally counts everyone who answered today.',
            bankIndexOfDisplay: [2, 0, 1, 3]
        }],
        POLL_BANK: [{
            id: 'poll_test',
            q: 'Where do you keep your bitcoin?',
            options: ['Hardware', 'Phone', 'Exchange', 'Paper']
        }]
    };
    sandbox.addEventListener = function() {};
    sandbox.removeEventListener = function() {};
    document.readyState = 'loading';
    document.head = document.createElement('head');
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { filename: 'quests.js' });
    sandbox.document = document;
    return sandbox;
}

function mount(sandbox) {
    var overlay = sandbox.document.createElement('div');
    overlay.id = 'questHubOverlay';
    var body = sandbox.document.createElement('div');
    body.id = 'questHubBody';
    overlay.appendChild(body);
    sandbox.document.body.appendChild(overlay);
    return body;
}

test('trivia post-answer render shows the community total and detaches on close', function() {
    var page = boot();
    var body = mount(page);
    page.localStorage.setItem('btc_trivia_state', JSON.stringify({
        date: '2026-10-24', chosen: 1, correct: false, index: 0
    }));
    page._captureTriviaBaseline('2026-10-24', 0, function() {});
    assert.strictEqual(page._triviaBaseline.known, true);
    assert.strictEqual(page._triviaBaseline.total, 10);
    assert.strictEqual(page._triviaBaseline.counts.option_0, 4);

    page._renderTriviaTab(body, { chosenIdx: 1 });
    var total = page.document.getElementById('triviaTotalVotes');
    var chosenPct = page.document.getElementById('triviaPct_1');
    assert.ok(total);
    assert.ok(chosenPct);
    assert.strictEqual(total.textContent, '11 answers today');
    assert.strictEqual(chosenPct.textContent, '45% (5)');
    assert.notStrictEqual(total.textContent, '1 answer today');
    assert.notStrictEqual(chosenPct.textContent, '100% (1)');
    assert.ok(page.listeners.some(function(rec) { return rec.name === 'trivia_stats' && !rec.unsubbed; }));

    var live = page.listeners.filter(function(rec) { return rec.name === 'trivia_stats' && !rec.unsubbed; });
    live[0].cb({ exists: true, data: function() { return page.docs.trivia_stats; } });
    assert.strictEqual(page.document.getElementById('triviaTotalVotes').textContent, '11 answers today');
    assert.strictEqual(page.document.getElementById('triviaPct_1').textContent, '45% (5)');

    live[0].cb({
        exists: true,
        data: function() { return { total: 11, option_0: 5, option_1: 3, option_2: 2, option_3: 1 }; }
    });
    assert.strictEqual(page.document.getElementById('triviaTotalVotes').textContent, '11 answers today');
    assert.strictEqual(page._triviaAwaitingWrite, false);

    live[0].cb({
        exists: true,
        data: function() { return { total: 14, option_0: 6, option_1: 4, option_2: 2, option_3: 2 }; }
    });
    assert.strictEqual(page.document.getElementById('triviaTotalVotes').textContent, '14 answers today');
    assert.strictEqual(page.document.getElementById('triviaPct_1').textContent, '43% (6)');

    var first = live[0];
    page._renderTriviaTab(body, { chosenIdx: 1 });
    assert.strictEqual(first.unsubbed, true);
    var second = page.listeners.filter(function(rec) { return rec.name === 'trivia_stats' && !rec.unsubbed; });
    assert.strictEqual(second.length, 1);

    var frozen = page.document.getElementById('triviaTotalVotes').textContent;
    page._closeQuestScreen();
    assert.strictEqual(second[0].unsubbed, true);
    assert.strictEqual(page.window._triviaStatsUnsub, null);
    assert.strictEqual(page.document.getElementById('questHubOverlay'), null);
    first.cb({ exists: true, data: function() { return { total: 1, option_0: 1, option_1: 0, option_2: 0, option_3: 0 }; } });
    second[0].cb({ exists: true, data: function() { return { total: 1, option_0: 1, option_1: 0, option_2: 0, option_3: 0 }; } });
    assert.strictEqual(frozen, '14 answers today');
});

test('trivia with no tally yet says it is loading instead of one answer', function() {
    var page = boot();
    var body = mount(page);
    page.docs.trivia_stats = null;
    page.localStorage.setItem('btc_trivia_state', JSON.stringify({
        date: '2026-10-24', chosen: 0, correct: true, index: 0
    }));
    page._triviaBaseline = { key: '2026-10-24', bankIdx: 2, known: false, total: 0, counts: null };
    page._triviaLiveDoc = null;
    page._triviaLiveKey = null;
    page._renderTriviaTab(body, { chosenIdx: 0 });
    var total = page.document.getElementById('triviaTotalVotes');
    assert.strictEqual(total.textContent, 'Loading community results...');
    assert.strictEqual(total.textContent.indexOf('1 answer'), -1);
    assert.strictEqual(page.document.getElementById('triviaPct_0').textContent, '');
    var live = page.listeners.filter(function(rec) { return rec.name === 'trivia_stats' && !rec.unsubbed; });
    assert.strictEqual(live.length, 1);
    page._closeQuestScreen();
    assert.strictEqual(live[0].unsubbed, true);
});

test('poll post-answer render shows the community total and detaches on close', function() {
    var page = boot();
    var body = mount(page);
    page.window._questHubTab = 'poll';
    page.localStorage.setItem('btc_poll_state', JSON.stringify({
        date: '2026-10-24', index: 0, chosen: 2, pollId: 'poll_test'
    }));
    page._capturePollBaseline('poll_test_2026-10-24', 4, function() {});
    page._pollBaseline.chosenIdx = 2;
    page._pollAwaitingWrite = true;
    page._renderPollTab(body);
    var total = page.document.getElementById('pollTotalVotes');
    var count = page.document.getElementById('pollCount_2');
    assert.ok(total);
    assert.ok(count);
    assert.strictEqual(total.textContent, '19 total votes today · Come back tomorrow for a new poll!');
    assert.strictEqual(count.textContent, '4 votes');
    assert.strictEqual(page.document.getElementById('pollPct_2').textContent, '21%');
    assert.strictEqual(total.textContent.indexOf('1 total vote'), -1);
    var label = count.parentNode.parentNode.textContent;
    assert.ok(label.indexOf('Exchange') !== -1);

    var live = page.listeners.filter(function(rec) { return rec.name === 'poll_votes' && !rec.unsubbed; });
    assert.strictEqual(live.length, 1);
    live[0].cb({ exists: true, data: function() { return { votes: [8, 5, 3, 2], total: 18 }; } });
    assert.strictEqual(page.document.getElementById('pollTotalVotes').textContent.indexOf('19 total votes'), 0);
    live[0].cb({ exists: true, data: function() { return { votes: [8, 5, 4, 2], total: 19 }; } });
    assert.strictEqual(page._pollAwaitingWrite, false);
    assert.strictEqual(page.document.getElementById('pollCount_2').textContent, '4 votes');
    assert.strictEqual(page.document.getElementById('pollTotalVotes').textContent.indexOf('19 total votes'), 0);

    live[0].cb({ exists: true, data: function() { return { votes: [9, 6, 4, 3], total: 22 }; } });
    assert.strictEqual(page.document.getElementById('pollTotalVotes').textContent.indexOf('22 total votes'), 0);
    assert.strictEqual(page.document.getElementById('pollCount_0').textContent, '9 votes');

    var frozen = page.document.getElementById('pollTotalVotes').textContent;
    page._closeQuestScreen();
    assert.strictEqual(live[0].unsubbed, true);
    assert.strictEqual(page.window._pollStatsUnsub, null);
    assert.strictEqual(page.document.getElementById('questHubOverlay'), null);
    live[0].cb({ exists: true, data: function() { return { votes: [1, 0, 0, 0], total: 1 }; } });
    assert.ok(frozen.indexOf('22 total votes') === 0);
});

test('poll with no tally yet says it is loading instead of one vote', function() {
    var page = boot();
    var body = mount(page);
    page.window._questHubTab = 'poll';
    page.docs.poll_votes = {};
    page._pollLiveDoc = null;
    page._pollLiveKey = null;
    page._pollBaseline = null;
    page._pollAwaitingWrite = false;
    page.localStorage.setItem('btc_poll_state', JSON.stringify({
        date: '2026-10-24', index: 0, chosen: 0, pollId: 'poll_test'
    }));
    page._renderPollTab(body);
    var total = page.document.getElementById('pollTotalVotes');
    assert.strictEqual(total.textContent, 'Loading community results...');
    assert.strictEqual(total.textContent.indexOf('1 total'), -1);
    var live = page.listeners.filter(function(rec) { return rec.name === 'poll_votes' && !rec.unsubbed; });
    assert.strictEqual(live.length, 1);
    page._closeQuestScreen();
    assert.strictEqual(live[0].unsubbed, true);
});

test('a failed listener says results are unavailable and keeps painted counts', function() {
    var unavailable = 'Community results are unavailable right now.';
    var page = boot();
    var body = mount(page);
    page.localStorage.setItem('btc_trivia_state', JSON.stringify({
        date: '2026-10-24', chosen: 0, correct: true, index: 0
    }));
    page._triviaLiveDoc = null;
    page._triviaLiveKey = null;
    page._triviaBaseline = null;
    page._triviaAwaitingWrite = false;
    page._renderTriviaTab(body, null);
    var triviaLive = page.listeners.filter(function(rec) { return rec.name === 'trivia_stats' && !rec.unsubbed; });
    assert.strictEqual(triviaLive.length, 1);
    assert.strictEqual(typeof triviaLive[0].err, 'function');
    assert.strictEqual(page.document.getElementById('triviaTotalVotes').textContent, 'Loading community results...');
    triviaLive[0].err(new Error('unavailable'));
    assert.strictEqual(page.document.getElementById('triviaTotalVotes').textContent, unavailable);
    triviaLive[0].cb({
        exists: true,
        data: function() { return { total: 10, option_0: 4, option_1: 3, option_2: 2, option_3: 1 }; }
    });
    assert.strictEqual(page.document.getElementById('triviaTotalVotes').textContent, '10 answers today');
    triviaLive[0].err(new Error('later'));
    assert.strictEqual(page.document.getElementById('triviaTotalVotes').textContent, '10 answers today');
    page._closeQuestScreen();

    page = boot();
    body = mount(page);
    page.window._questHubTab = 'poll';
    page._pollLiveDoc = null;
    page._pollLiveKey = null;
    page._pollBaseline = null;
    page._pollAwaitingWrite = false;
    page.docs.poll_votes = {};
    page.localStorage.setItem('btc_poll_state', JSON.stringify({
        date: '2026-10-24', index: 0, chosen: 0, pollId: 'poll_test'
    }));
    page._renderPollTab(body);
    var pollLive = page.listeners.filter(function(rec) { return rec.name === 'poll_votes' && !rec.unsubbed; });
    assert.strictEqual(pollLive.length, 1);
    assert.strictEqual(typeof pollLive[0].err, 'function');
    assert.strictEqual(page.document.getElementById('pollTotalVotes').textContent, 'Loading community results...');
    pollLive[0].err(new Error('unavailable'));
    assert.strictEqual(page.document.getElementById('pollTotalVotes').textContent, unavailable);
    pollLive[0].cb({ exists: true, data: function() { return { votes: [8, 5, 3, 2], total: 18 }; } });
    assert.ok(page.document.getElementById('pollTotalVotes').textContent.indexOf('18 total votes') === 0);
    pollLive[0].err(new Error('later'));
    assert.ok(page.document.getElementById('pollTotalVotes').textContent.indexOf('18 total votes') === 0);
    page._closeQuestScreen();
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
