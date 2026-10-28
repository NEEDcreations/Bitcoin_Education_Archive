// Optimistic poll results are display-only. XP is shown only after the
// server returns a positive awarded count. A failed vote rolls the UI back.
// Trivia shows checking immediately and does not grade from the client bank.
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

function relLum(r, g, b) {
    function lin(c) {
        c = c / 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    var R = lin(r), G = lin(g), B = lin(b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrast(a, b) {
    var L1 = relLum(a[0], a[1], a[2]);
    var L2 = relLum(b[0], b[1], b[2]);
    var hi = Math.max(L1, L2);
    var lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
}

function composite(bg, fg, alpha) {
    return [
        Math.round(bg[0] * (1 - alpha) + fg[0] * alpha),
        Math.round(bg[1] * (1 - alpha) + fg[1] * alpha),
        Math.round(bg[2] * (1 - alpha) + fg[2] * alpha)
    ];
}

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
        el.setAttribute = function(key, value) { el.attrs[key] = String(value); };
        el.getAttribute = function(key) { return Object.prototype.hasOwnProperty.call(el.attrs, key) ? el.attrs[key] : null; };
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
    var calls = [];
    var pending = { resolve: null, reject: null };
    var listeners = [];
    var xp = [];
    var pollHooks = [];
    var toasts = [];
    function snap(data) {
        return { exists: !!data, data: function() { return data || {}; } };
    }
    var docs = {
        poll_votes: { votes: [8, 5, 3, 2], total: 18 },
        trivia_stats: { total: 10, option_0: 4, option_1: 3, option_2: 2, option_3: 1 }
    };
    var db = {
        collection: function(name) {
            return {
                doc: function() {
                    return {
                        get: function() {
                            calls.push('get:' + name);
                            return {
                                then: function(ok) {
                                    ok(snap(docs[name]));
                                    return { catch: function() { return this; } };
                                },
                                catch: function() { return this; }
                            };
                        },
                        onSnapshot: function(cb) {
                            calls.push('snap:' + name);
                            var rec = { name: name, cb: cb, unsubbed: false };
                            listeners.push(rec);
                            return function() { rec.unsubbed = true; };
                        }
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
        Date: Date,
        Math: Math,
        Number: Number,
        String: String,
        parseInt: parseInt,
        isFinite: isFinite,
        JSON: JSON,
        Object: Object,
        Array: Array,
        safeJSON: function(key, fallback) {
            try { return JSON.parse(store[key]); } catch (e) { return fallback; }
        },
        getDailyKey: function() { return '2026-10-24'; },
        showToast: function(message) { toasts.push(String(message)); },
        localStorage: {
            getItem: function(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
            setItem: function(key, value) { store[key] = String(value); },
            removeItem: function(key) { delete store[key]; }
        },
        history: { replaceState: function() {}, pushState: function() {} },
        location: { hash: '', pathname: '/' },
        TRIVIA_BANK: [{
            q: 'How many people already answered?',
            options: ['One', 'A few', 'The whole block', 'Nobody'],
            answer: 2,
            explanation: 'The tally counts everyone who answered today.'
        }],
        POLL_BANK: [{
            id: 'poll_test',
            q: "What's your view on debt?",
            options: ['Eliminate all debt as fast as possible', 'Only mortgage debt is acceptable', 'Strategic debt for assets with positive return is fine', 'Debt is just a tool — timing matters']
        }],
        auth: { currentUser: { uid: 'voter', isAnonymous: false } },
        firebase: {
            functions: function() {
                return {
                    httpsCallable: function(name) {
                        return function(payload) {
                            calls.push(name);
                            if (name !== 'dailyPollVote' && name !== 'answerTrivia') {
                                return { then: function() { return { catch: function() { return this; } }; }, catch: function() { return this; } };
                            }
                            return {
                                then: function(ok) {
                                    pending.resolve = ok;
                                    pending.name = name;
                                    pending.payload = payload;
                                    return {
                                        catch: function(errFn) {
                                            pending.reject = errFn;
                                            return this;
                                        }
                                    };
                                }
                            };
                        };
                    }
                };
            }
        }
    };
    sandbox.addEventListener = function() {};
    sandbox.removeEventListener = function() {};
    document.readyState = 'loading';
    document.head = document.createElement('head');
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { filename: 'quests.js' });
    sandbox.document = document;
    sandbox.calls = calls;
    sandbox.pending = pending;
    sandbox.listeners = listeners;
    sandbox.toasts = toasts;
    sandbox.store = store;
    sandbox._raidOnXPEarned = function(amount) { xp.push(amount); };
    sandbox._raidOnPollVote = function() { pollHooks.push('poll'); };
    sandbox._raidOnTriviaCorrect = function() { pollHooks.push('trivia'); };
    sandbox.xp = xp;
    sandbox.pollHooks = pollHooks;
    return sandbox;
}

function mount(page) {
    var overlay = page.document.createElement('div');
    overlay.id = 'questHubOverlay';
    var body = page.document.createElement('div');
    body.id = 'questHubBody';
    overlay.appendChild(body);
    page.document.body.appendChild(overlay);
    page.window._questHubTab = 'poll';
    return body;
}

function xpText(page) {
    return page.document.getElementById('questHubBody').textContent || '';
}

// Arrays built inside the quests.js vm are a different realm, so deepStrictEqual
// rejects them even when the numbers match. Copy into this realm first.
function hostList(list) {
    return Array.prototype.slice.call(list || []);
}

test('a poll tap paints the +1 tally before the server answers, with no XP', function() {
    var page = boot();
    var body = mount(page);
    page._pollLiveKey = 'poll_test_2026-10-24';
    page._pollLiveDoc = { votes: [8, 5, 3, 2], total: 18 };
    page._pollVoteReady = true;
    var started = Date.now();
    page.pollVote(2);
    var elapsed = Date.now() - started;
    assert.ok(elapsed < 100, 'tap to result took ' + elapsed + 'ms');
    assert.strictEqual(page.calls.indexOf('dailyPollVote') > -1, true);
    assert.strictEqual(page.calls.indexOf('get:poll_votes'), -1);
    assert.ok(page.pending.resolve, 'callable is still in flight');
    var preview = page._optimisticPollCounts([8, 5, 3, 2], 18, 2, 4);
    assert.deepStrictEqual(hostList(preview.votes), [8, 5, 4, 2]);
    assert.strictEqual(preview.total, 19);
    assert.strictEqual(page.document.getElementById('pollCount_2').textContent, '4 votes');
    assert.strictEqual(page.document.getElementById('pollPct_2').textContent, '21%');
    assert.strictEqual(page.document.getElementById('pollTotalVotes').textContent.indexOf('19 total votes'), 0);
    var text = xpText(page);
    assert.ok(text.indexOf('XP pending') !== -1, text);
    assert.strictEqual(text.indexOf('+50'), -1, text);
    assert.strictEqual(text.indexOf('+'), -1, text);
    assert.strictEqual(page.store.btc_poll_state, undefined);
    assert.deepStrictEqual(page.xp, []);
    assert.deepStrictEqual(page.pollHooks, []);
    assert.strictEqual(page.toasts.length, 0);
});

test('a failed poll vote rolls the choice back and still grants no XP', function() {
    var page = boot();
    mount(page);
    page._pollLiveKey = 'poll_test_2026-10-24';
    page._pollLiveDoc = { votes: [8, 5, 3, 2], total: 18 };
    page._pollVoteReady = true;
    page.pollVote(2);
    assert.ok(page.document.getElementById('pollCount_2'));
    page.pending.reject(new Error('unavailable'));
    assert.strictEqual(page.document.getElementById('pollCount_2'), null);
    var note = page.document.getElementById('pollRetryNote');
    assert.ok(note, 'retry message missing');
    assert.strictEqual(note.textContent, 'Vote didn\u2019t save. Try again.');
    assert.strictEqual(page.store.btc_poll_state, undefined);
    assert.deepStrictEqual(page.xp, []);
    assert.deepStrictEqual(page.pollHooks, []);
    assert.ok(page.toasts.some(function(t) { return t.indexOf('didn\u2019t save') !== -1; }));
    // The pre-vote offer returns. Awarded XP and the pending pill do not.
    assert.ok(xpText(page).indexOf('+50 XP for voting') !== -1, xpText(page));
    assert.strictEqual(xpText(page).indexOf('XP pending'), -1);
    page._pollVoteReady = true;
    page.pollVote(1);
    assert.strictEqual(page.document.getElementById('pollCount_1').textContent, '6 votes');
    assert.ok(xpText(page).indexOf('XP pending') !== -1);
    assert.deepStrictEqual(page.xp, []);
});

test('poll XP appears only when the server returns a positive award', function() {
    var page = boot();
    mount(page);
    page._pollLiveKey = 'poll_test_2026-10-24';
    page._pollLiveDoc = { votes: [8, 5, 3, 2], total: 18 };
    page._pollVoteReady = true;
    page.pollVote(2);
    page.pending.resolve({ data: { awarded: 0, already: false } });
    var saved = JSON.parse(page.store.btc_poll_state);
    assert.strictEqual(saved.chosen, 2);
    assert.strictEqual(saved.awarded, 0);
    assert.strictEqual(xpText(page).indexOf('+'), -1);
    assert.strictEqual(xpText(page).indexOf('XP pending'), -1);
    assert.deepStrictEqual(page.xp, []);
    assert.deepStrictEqual(page.pollHooks, ['poll']);
    assert.ok(page.toasts.some(function(t) { return t.indexOf('Vote recorded') !== -1 && t.indexOf('+') === -1; }));

    page = boot();
    mount(page);
    page._pollLiveKey = 'poll_test_2026-10-24';
    page._pollLiveDoc = { votes: [8, 5, 3, 2], total: 18 };
    page._pollVoteReady = true;
    page.pollVote(2);
    assert.deepStrictEqual(page.xp, []);
    page.pending.resolve({ data: { awarded: 50, already: false } });
    saved = JSON.parse(page.store.btc_poll_state);
    assert.strictEqual(saved.awarded, 50);
    assert.ok(xpText(page).indexOf('+50 XP') !== -1, xpText(page));
    assert.deepStrictEqual(page.xp, [50]);
    assert.ok(page.toasts.some(function(t) { return t.indexOf('+50 XP') !== -1; }));
    assert.strictEqual(page._pollXpPillText('pending', 50), 'XP pending');
    assert.strictEqual(page._pollXpPillText('awarded', 0), '');
    assert.strictEqual(page._pollXpPillText('awarded', 50), '+50 XP');
});

test('trivia shows checking immediately and does not grade from the client bank', function() {
    var page = boot();
    var body = mount(page);
    page._renderTriviaTab(body);
    assert.ok(xpText(page).indexOf('+50 XP for a correct answer') !== -1);
    var mark = page.calls.length;
    var started = Date.now();
    page.triviaAnswer(0);
    var elapsed = Date.now() - started;
    assert.ok(elapsed < 100, 'checking took ' + elapsed + 'ms');
    var during = page.calls.slice(mark);
    var checking = page.document.getElementById('triviaChecking');
    assert.ok(checking, 'checking state missing');
    assert.strictEqual(checking.textContent, 'checking\u2026');
    assert.strictEqual(during[0], 'answerTrivia');
    assert.strictEqual(during.indexOf('get:trivia_stats'), -1);
    page._renderTriviaTab(body);
    checking = page.document.getElementById('triviaChecking');
    assert.ok(checking, 'checking marker dropped on re-render');
    assert.strictEqual(checking.textContent, 'checking\u2026');
    assert.ok(page._triviaChecking && page._triviaChecking.todayKey === '2026-10-24');
    assert.strictEqual(page.store.btc_trivia_state, undefined);
    assert.deepStrictEqual(page.xp, []);
    assert.strictEqual(page.pollHooks.length, 0);
    var text = xpText(page);
    assert.ok(text.indexOf('XP pending') !== -1, text);
    assert.strictEqual(text.indexOf('+50'), -1, text);
    assert.strictEqual(text.indexOf('The tally counts everyone'), -1);
    assert.strictEqual(src.includes('chosenIdx === t.answer'), false);
    page.pending.reject(new Error('network'));
    assert.strictEqual(page.document.getElementById('triviaChecking'), null);
    assert.strictEqual(page.store.btc_trivia_state, undefined);
    assert.deepStrictEqual(page.xp, []);
    assert.ok(page.toasts.some(function(t) { return t.indexOf('Could not grade trivia') !== -1; }));
});

test('trivia XP is shown only after the server awards it', function() {
    var page = boot();
    var body = mount(page);
    page._triviaLiveKey = '2026-10-24';
    page._triviaLiveDoc = { total: 10, option_0: 4, option_1: 3, option_2: 2, option_3: 1 };
    page._renderTriviaTab(body);
    page.triviaAnswer(2);
    assert.deepStrictEqual(page.xp, []);
    page.pending.resolve({ data: { success: true, correct: true, awarded: 0, statsRecorded: true } });
    var saved = JSON.parse(page.store.btc_trivia_state);
    assert.strictEqual(saved.correct, true);
    assert.strictEqual(saved.awarded, 0);
    assert.strictEqual(xpText(page).indexOf('+'), -1);
    assert.deepStrictEqual(page.xp, []);
    assert.ok(page.toasts.some(function(t) { return t === '✅ Correct!'; }));

    page = boot();
    body = mount(page);
    page._triviaLiveKey = '2026-10-24';
    page._triviaLiveDoc = { total: 10, option_0: 4, option_1: 3, option_2: 2, option_3: 1 };
    page._renderTriviaTab(body);
    page.triviaAnswer(0);
    page.pending.resolve({ data: { success: true, correct: false, awarded: 0, statsRecorded: true } });
    saved = JSON.parse(page.store.btc_trivia_state);
    assert.strictEqual(saved.correct, false);
    assert.strictEqual(saved.awarded, 0);
    assert.deepStrictEqual(page.xp, []);
    assert.strictEqual(xpText(page).indexOf('+50'), -1);
    assert.ok(page.toasts.some(function(t) { return t.indexOf('Not quite') !== -1 && t.indexOf('+') === -1; }));

    page = boot();
    body = mount(page);
    page._triviaLiveKey = '2026-10-24';
    page._triviaLiveDoc = { total: 10, option_0: 4, option_1: 3, option_2: 2, option_3: 1 };
    page._renderTriviaTab(body);
    page.triviaAnswer(2);
    page.pending.resolve({ data: { success: true, correct: true, awarded: 50, statsRecorded: true } });
    assert.deepStrictEqual(page.xp, [50]);
    assert.ok(xpText(page).indexOf('+50 XP') !== -1, xpText(page));
    assert.strictEqual(page._triviaXpPillText('pending', 50), 'XP pending');
    assert.strictEqual(page._triviaXpPillText('answered', 0), '');
    assert.strictEqual(page._triviaXpPillText('answered', 50), '+50 XP');
});

test('trivia with no cached snapshot shows the server total, not a local +1', function() {
    var page = boot();
    var body = mount(page);
    page._renderTriviaTab(body);
    assert.ok(!page._triviaLiveDoc);
    var mark = page.calls.length;
    page.triviaAnswer(0);
    var during = page.calls.slice(mark);
    assert.strictEqual(during[0], 'answerTrivia');
    assert.strictEqual(during.indexOf('get:trivia_stats'), -1);
    assert.strictEqual(page._triviaBaseline.known, false);
    page.pending.resolve({ data: { success: true, correct: false, awarded: 0, statsRecorded: true } });
    var live = page.listeners.filter(function(rec) { return rec.name === 'trivia_stats' && !rec.unsubbed; });
    assert.strictEqual(live.length, 1);
    live[0].cb({
        exists: true,
        data: function() { return { total: 11, option_0: 5, option_1: 3, option_2: 2, option_3: 1 }; }
    });
    assert.strictEqual(page.document.getElementById('triviaTotalVotes').textContent, '11 answers today');
    assert.strictEqual(page.document.getElementById('triviaPct_0').textContent, '45% (5)');
});

test('a cached trivia snapshot still adds one until the server doc includes it', function() {
    var page = boot();
    var body = mount(page);
    page._triviaLiveKey = '2026-10-24';
    page._triviaLiveDoc = { total: 10, option_0: 4, option_1: 3, option_2: 2, option_3: 1 };
    page._renderTriviaTab(body);
    var gets = page.calls.filter(function(name) { return name === 'get:trivia_stats'; }).length;
    page.triviaAnswer(0);
    assert.strictEqual(page._triviaBaseline.known, true);
    assert.strictEqual(page._triviaBaseline.total, 10);
    assert.strictEqual(page.calls.filter(function(name) { return name === 'get:trivia_stats'; }).length, gets);
    page.pending.resolve({ data: { success: true, correct: false, awarded: 0, statsRecorded: true } });
    assert.strictEqual(page.document.getElementById('triviaTotalVotes').textContent, '11 answers today');
    assert.strictEqual(page.document.getElementById('triviaPct_0').textContent, '45% (5)');
});

test('a long trivia option keeps its count on the row', function() {
    assert.ok(src.includes('min-width:0;overflow-wrap:anywhere'));
    assert.ok(src.includes('flex-shrink:0;white-space:nowrap'));
    var page = boot();
    var body = mount(page);
    page.TRIVIA_BANK[0].options[0] = 'CheckSequenceVerify';
    page.localStorage.setItem('btc_trivia_state', JSON.stringify({
        date: '2026-10-24', chosen: 0, correct: true, index: 0, awarded: 50
    }));
    page._triviaLiveKey = '2026-10-24';
    page._triviaLiveDoc = { total: 11, option_0: 5, option_1: 3, option_2: 2, option_3: 1 };
    page._renderTriviaTab(body);
    var html = body.innerHTML;
    assert.ok(html.indexOf('CheckSequenceVerify') !== -1);
    assert.ok(html.indexOf('min-width:0;overflow-wrap:anywhere') !== -1);
    assert.ok(html.indexOf('flex-shrink:0;white-space:nowrap') !== -1);
    assert.strictEqual(page.document.getElementById('triviaPct_0').textContent, '45% (5)');
});

test('dimmed trivia counts stay WCAG AA against the row background', function() {
    var page = boot();
    var body = mount(page);
    page.localStorage.setItem('btc_trivia_state', JSON.stringify({
        date: '2026-10-24', chosen: 0, correct: false, index: 0, awarded: 0
    }));
    page._triviaLiveKey = '2026-10-24';
    page._triviaLiveDoc = { total: 20, option_0: 2, option_1: 1, option_2: 16, option_3: 1 };
    page._renderTriviaTab(body);
    var html = body.innerHTML;
    assert.ok(html.indexOf('data-dimmed="1"') !== -1);
    assert.strictEqual(/opacity:0\.5/.test(html), false, html);
    assert.ok(html.indexOf('color:var(--text-dim)') !== -1);
    assert.ok(html.indexOf('color:var(--text);font-weight:800') !== -1);
    var styles = page._triviaCommunityRowStyles(false, false);
    assert.strictEqual(styles.dimmed, true);
    assert.strictEqual(styles.rowOpacity, '1');
    assert.strictEqual(styles.pctColor, 'var(--text)');
    assert.strictEqual(styles.labelColor, 'var(--text-dim)');

    var darkCard = composite([15, 23, 42], [255, 255, 255], 0.03);
    var lightCard = composite([255, 255, 255], [0, 0, 0], 0.03);
    assert.ok(contrast([226, 232, 240], darkCard) >= 4.5, 'dark pct contrast');
    assert.ok(contrast([30, 41, 59], lightCard) >= 4.5, 'light pct contrast');
    var oldText = composite(darkCard, [100, 116, 139], 0.5);
    assert.ok(contrast(oldText, darkCard) < 4.5, 'old dimmed pct was below AA');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
