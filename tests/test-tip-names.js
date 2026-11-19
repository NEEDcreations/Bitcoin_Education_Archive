// Tip buttons and the tip overlay only accept a text name.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) {
    queue.push(async function() {
        try { await fn(); console.log('✅ ' + name); passed++; }
        catch (e) { console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }
    });
}

function htmlDoc() {
    function makeEl() {
        const kids = [];
        const el = {
            style: { cssText: '' },
            innerHTML: '',
            id: '',
            onclick: null,
            children: kids,
            appendChild: function(n) { kids.push(n); n.parentNode = el; return n; },
        };
        return el;
    }
    const body = makeEl();
    const els = {};
    const document = {
        body: body,
        createElement: function() { return makeEl(); },
        createTextNode: function(s) { return { textContent: String(s), text: String(s) }; },
        getElementById: function(id) { return els[id] || null; },
        addEventListener: function() {},
    };
    // escapeHtml writes through createElement('div') + createTextNode + innerHTML
    const origCreate = document.createElement;
    document.createElement = function(tag) {
        const el = origCreate();
        let text = '';
        el.appendChild = function(n) {
            text += (n && (n.textContent || n.text) != null) ? String(n.textContent || n.text) : '';
            return n;
        };
        Object.defineProperty(el, 'innerHTML', {
            get: function() {
                return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            },
            set: function(v) { text = String(v == null ? '' : v); },
        });
        return el;
    };
    return { document: document, body: body, els: els };
}

function loadEscape() {
    const page = htmlDoc();
    const sandbox = {
        document: page.document,
        window: {},
        console: { log: function() {}, warn: function() {}, error: function() {} },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    const src = read('utils.js');
    const start = src.indexOf('function escapeHtml(str) {');
    const end = src.indexOf('\n// ---- Safe URL', start);
    if (start < 0 || end < 0) throw new Error('could not find escapeHtml');
    vm.runInContext(src.slice(start, end) + '\nthis.escapeHtml = escapeHtml;', sandbox);
    return sandbox;
}

function loadTips() {
    const page = htmlDoc();
    const sandbox = {
        document: page.document,
        console: { log: function() {}, warn: function() {}, error: function() {} },
        localStorage: { getItem: function() { return null; }, setItem: function() {} },
        setTimeout: function() { return 0; },
        escapeHtml: function(s) {
            if (typeof s === 'number') s = String(s);
            else if (typeof s !== 'string') return '';
            return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(read('lightning-tips.js.src'), sandbox, { filename: 'lightning-tips.js.src' });
    return { sandbox: sandbox, page: page };
}

function loadArticle(authorName) {
    const seen = [];
    const els = {};
    function makeEl(id) {
        return {
            id: id || '', innerHTML: '', style: {}, listeners: {},
            addEventListener: function() {},
            appendChild: function() {},
            querySelector: function() { return null; },
        };
    }
    const document = {
        readyState: 'complete',
        head: { appendChild: function() {} },
        body: { appendChild: function() {} },
        createElement: function() { return makeEl(''); },
        createTextNode: function(s) { return { textContent: String(s) }; },
        addEventListener: function() {},
        getElementById: function(id) {
            if (!els[id]) els[id] = makeEl(id);
            return els[id];
        },
        querySelector: function() { return null; },
    };
    const sandbox = {
        document: document,
        console: { log: function() {}, warn: function() {}, error: function() {} },
        sessionStorage: { getItem: function() { return null; }, setItem: function() {} },
        localStorage: { getItem: function() { return null; }, setItem: function() {} },
        history: { pushState: function() {} },
        setTimeout: function() { return 0; },
        clearTimeout: function() {},
        MutationObserver: function() { this.observe = function() {}; this.disconnect = function() {}; },
        auth: { currentUser: { uid: 'viewer1', isAnonymous: false } },
        timeAgo: function() { return 'now'; },
        getLevel: function() { return { emoji: '*' }; },
        mdToHtml: function() { return ''; },
        firebase: { firestore: { FieldValue: {} } },
        db: {
            collection: function() {
                return {
                    doc: function() {
                        return {
                            get: async function() {
                                return {
                                    exists: true,
                                    data: function() {
                                        return {
                                            title: 'Hello',
                                            body: 'Hi',
                                            authorId: 'author1',
                                            authorName: authorName,
                                            authorPoints: 0,
                                            wordCount: 200,
                                        };
                                    },
                                };
                            },
                        };
                    },
                };
            },
        },
        tipButtonHtml: function(p) { seen.push(p); return '<button data-tip="stub"></button>'; },
    };
    sandbox.window = sandbox;
    sandbox._isAdminClaim = false;
    sandbox._factionNameStyle = function() { return ''; };
    vm.createContext(sandbox);
    vm.runInContext(read('forum.js'), sandbox, { filename: 'forum.js' });
    return { sandbox: sandbox, seen: seen, els: els };
}

const hostile = {
    toString: function() { return this; },
    valueOf: function() { return this; },
};

test('escapeHtml returns empty text for objects, arrays and null', function() {
    const s = loadEscape();
    assert.strictEqual(typeof s.escapeHtml, 'function');
    assert.strictEqual(s.escapeHtml({ a: 1 }), '');
    assert.strictEqual(s.escapeHtml(['x']), '');
    assert.strictEqual(s.escapeHtml(null), '');
    assert.strictEqual(s.escapeHtml(undefined), '');
    assert.doesNotThrow(function() { s.escapeHtml(hostile); });
    assert.strictEqual(s.escapeHtml(hostile), '');
});

test('escapeHtml keeps numbers and strings', function() {
    const s = loadEscape();
    assert.strictEqual(s.escapeHtml(0), '0');
    assert.strictEqual(s.escapeHtml(42), '42');
    assert.strictEqual(s.escapeHtml('Ada'), 'Ada');
    assert.strictEqual(s.escapeHtml('<b>'), '&lt;b&gt;');
    assert.strictEqual(s.escapeHtml('a"b'), 'a&quot;b');
});

test('showTipOverlay refuses a non-string name without opening or throwing', function() {
    [ {}, [], null, 12, hostile ].forEach(function(name) {
        const t = loadTips();
        const before = t.page.body.children.length;
        assert.doesNotThrow(function() {
            t.sandbox.showTipOverlay({ recipientName: name, recipientUid: 'author1' });
        });
        assert.strictEqual(t.page.body.children.length, before);
        assert.strictEqual(t.page.document.getElementById('tipOverlay'), null);
    });
});

test('showTipOverlay still opens for a text name', function() {
    const t = loadTips();
    t.sandbox.showTipOverlay({ recipientName: 'Ada', recipientUid: 'author1' });
    assert.ok(t.page.body.children.length >= 1);
    const ov = t.page.body.children[0];
    assert.strictEqual(ov.id, 'tipOverlay');
    assert.ok(String(ov.innerHTML).includes('Ada'));
});

test('articleView passes only a string name into the tip button', async function() {
    const cases = [
        [ { first: 'Ada' }, 'map' ],
        [ ['Ada'], 'array' ],
        [ null, 'null' ],
    ];
    for (const pair of cases) {
        const t = loadArticle(pair[0]);
        await t.sandbox.articleView('article1');
        assert.ok(t.seen.length >= 1, 'tip button called for ' + pair[1]);
        assert.strictEqual(typeof t.seen[0].recipientName, 'string', pair[1]);
        assert.strictEqual(t.seen[0].recipientName, '', pair[1]);
    }
    const ok = loadArticle('Ada');
    await ok.sandbox.articleView('article1');
    assert.strictEqual(ok.seen[0].recipientName, 'Ada');
});

const H = require('./helpers-markup.js');

function parseTipAction(html) {
    const m = String(html).match(/data-tip-action="([^"]*)"/);
    if (!m) throw new Error('missing tip action in ' + String(html).slice(0, 200));
    return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
}

function loadLbRow(username) {
    const RANK = read('ranking.js');
    const sandbox = {
        auth: { currentUser: { uid: 'me1' } },
        currentUser: { points: 0 },
        getLevel: function() { return { emoji: '*' }; },
        _lbBadgeEmoji: function(e) { return e || '*'; },
        escapeHtml: function(s) {
            if (typeof s === 'number') s = String(s);
            else if (typeof s !== 'string') return '';
            return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        },
        console: { log: function() {}, warn: function() {}, error: function() {} },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    const code = H.sliceFunction(RANK, 'function _lbXpRowHtml(') + '\nthis._lbXpRowHtml = _lbXpRowHtml;\n';
    vm.runInContext(code, sandbox, { filename: 'ranking.js' });
    return sandbox._lbXpRowHtml({ id: 'u1', username: username, points: 10 }, 'alltime', 0);
}

function loadPvpRow(username) {
    const RANK = read('ranking.js');
    const sandbox = {
        auth: { currentUser: { uid: 'me1' } },
        currentUser: { pvpWins: 0, pvpLosses: 0, username: 'me' },
        LbPrefix: { pvpRecordText: function(w, l) { return w + 'W-' + l + 'L'; } },
        escapeHtml: function(s) {
            if (typeof s === 'number') s = String(s);
            else if (typeof s !== 'string') return '';
            return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        },
        _lbSplitRows: function(rows, render) {
            var html = '';
            (rows || []).forEach(function(r, i) { html += render(r, i); });
            return { html: html, rest: '', total: (rows || []).length };
        },
        console: { log: function() {}, warn: function() {}, error: function() {} },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    const code = H.sliceFunction(RANK, 'function _renderPvpSnapshot(') + '\nthis._renderPvpSnapshot = _renderPvpSnapshot;\n';
    vm.runInContext(code, sandbox, { filename: 'ranking.js' });
    const container = { innerHTML: '' };
    sandbox._renderPvpSnapshot(container, { rows: [{ uid: 'u1', username: username, rank: 1, wins: 2, losses: 1 }] });
    return container.innerHTML;
}

function loadBeatsTips() {
    const BEATS = read('beats.js');
    const seen = [];
    const sandbox = {
        console: { log: function() {}, warn: function() {}, error: function() {} },
        document: { body: {}, addEventListener: function() {}, getElementById: function() { return null; } },
        setTimeout: function() { return 0; },
        showTipOverlay: function(opts) { seen.push(opts); },
        showToast: function() {},
        _beatsIsHidden: function() { return false; },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    const code = [
        H.sliceFunction(BEATS, 'function _beatsFindQueued('),
        H.sliceFunction(BEATS, 'window.beatsTipCurrentArtist = function('),
        H.sliceFunction(BEATS, 'window.beatsTipCurrentArtistById = function('),
        H.sliceFunction(BEATS, 'window.beatsShowV4VTip = async function('),
    ].join('\n');
    vm.runInContext(code, sandbox, { filename: 'beats.js' });
    return { sandbox: sandbox, seen: seen };
}

function loadIntegrations(track) {
    const SRC = read('tips-integrations.js.src');
    const tipButtons = [];
    const likeBtn = { tag: 'button' };
    const row = {
        attrs: { onclick: 'beatsPlayTrack(0)' },
        getAttribute: function(k) { return this.attrs[k] || ''; },
        querySelector: function(sel) {
            if (sel === '[data-tip-action]') return tipButtons[0] || null;
            if (String(sel).indexOf('beatsToggleLike') !== -1 || String(sel).indexOf('beatsTrackMenu') !== -1) return likeBtn;
            return null;
        },
        insertBefore: function(el) { tipButtons.push(el); return el; },
        appendChild: function(el) { tipButtons.push(el); return el; },
    };
    const fc = {
        querySelectorAll: function() { return [row]; },
    };
    const sandbox = {
        console: { log: function() {}, warn: function() {}, error: function() {} },
        document: {
            readyState: 'complete',
            addEventListener: function() {},
            getElementById: function(id) { return id === 'forumContainer' ? fc : null; },
            createElement: function() {
                const attrs = {};
                return {
                    attrs: attrs,
                    style: { cssText: '' },
                    textContent: '',
                    title: '',
                    setAttribute: function(k, v) { attrs[k] = v; },
                    getAttribute: function(k) { return attrs[k]; },
                };
            },
        },
        setTimeout: function() { return 0; },
        MutationObserver: function() { this.observe = function() {}; },
        escapeHtml: function(s) { return String(s == null ? '' : s); },
        _beatsQueue: [track],
        showTipOverlay: function() {},
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(H.sliceFunction(SRC, 'function injectBeatsTips(') + '\ninjectBeatsTips();', sandbox, { filename: 'tips-integrations.js.src' });
    return tipButtons;
}

function loadProfile(username) {
    const els = {};
    function makeEl(id) {
        return {
            id: id || '', innerHTML: '', style: {},
            remove: function() {},
            appendChild: function() {},
        };
    }
    const bodyKids = [];
    const document = {
        readyState: 'complete',
        body: {
            appendChild: function(n) { bodyKids.push(n); if (n && n.id) els[n.id] = n; return n; },
        },
        createElement: function() {
            const el = makeEl('');
            Object.defineProperty(el, 'firstChild', {
                get: function() {
                    const child = makeEl('userProfileModal');
                    child.innerHTML = el.innerHTML;
                    return child;
                },
            });
            return el;
        },
        getElementById: function(id) {
            if (els[id]) return els[id];
            if (id === 'userProfileModal') {
                els[id] = makeEl(id);
                return els[id];
            }
            return null;
        },
        addEventListener: function() {},
    };
    const profile = { username: username, points: 0, lastSeen: null };
    const sandbox = {
        document: document,
        console: { log: function() {}, warn: function() {}, error: function() {} },
        sessionStorage: { getItem: function() { return null; }, setItem: function() {} },
        localStorage: { getItem: function() { return null; }, setItem: function() {} },
        setTimeout: function() { return 0; },
        auth: { currentUser: { uid: 'viewer1', isAnonymous: false } },
        currentUser: { username: 'viewer' },
        escapeHtml: function(s) {
            if (typeof s === 'number') s = String(s);
            else if (typeof s !== 'string') return '';
            return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        },
        getOnlineStatus: function() { return { text: 'offline', color: '#888' }; },
        getLevel: function() { return { name: 'Newbie', emoji: '*' }; },
        profileJoinLabel: function() { return 'now'; },
        _canAccountDM: function() { return { ok: false }; },
        isUserBlocked: function() { return false; },
        profileStat: function(e, v, l) { return '<div>' + e + String(v) + l + '</div>'; },
        sanitizeUrl: function(u) { return u; },
        showToast: function() {},
        db: {
            collection: function() {
                return {
                    doc: function() {
                        return {
                            get: function() { return Promise.resolve({ exists: true, data: function() { return profile; } }); },
                        };
                    },
                };
            },
        },
    };
    sandbox.window = sandbox;
    sandbox._myPeers = { has: function() { return false; } };
    vm.createContext(sandbox);
    vm.runInContext(H.sliceFunction(read('messaging.js'), 'window.showUserProfile = function('), sandbox, { filename: 'messaging.js' });
    sandbox.showUserProfile('author1');
    return Promise.resolve().then(function() {}).then(function() { return sandbox; });
}

const badNames = [
    [{ first: 'Ada' }, 'map'],
    [['Ada'], 'array'],
    [null, 'null'],
];

test('leaderboard tip JSON passes only a string name', function() {
    badNames.forEach(function(pair) {
        const tip = parseTipAction(loadLbRow(pair[0]));
        assert.strictEqual(typeof tip.recipientName, 'string', pair[1]);
        assert.strictEqual(tip.recipientName, 'Anon', pair[1]);
        assert.strictEqual(tip.label, 'Tip Anon', pair[1]);
    });
    const ok = parseTipAction(loadLbRow('Ada'));
    assert.strictEqual(ok.recipientName, 'Ada');
    assert.strictEqual(ok.label, 'Tip Ada');
});

test('PvP tip JSON passes only a string name', function() {
    badNames.forEach(function(pair) {
        const tip = parseTipAction(loadPvpRow(pair[0]));
        assert.strictEqual(typeof tip.recipientName, 'string', pair[1]);
        assert.strictEqual(tip.recipientName, 'Anon', pair[1]);
        assert.strictEqual(tip.label, 'Tip Anon', pair[1]);
    });
    const ok = parseTipAction(loadPvpRow('Ada'));
    assert.strictEqual(ok.recipientName, 'Ada');
});

test('profile tip data passes only a string name', async function() {
    for (const pair of badNames) {
        const s = await loadProfile(pair[0]);
        const data = s._profileTipData;
        assert.ok(data, 'tip data set for ' + pair[1]);
        assert.strictEqual(typeof data.recipientName, 'string', pair[1]);
        assert.strictEqual(data.recipientName, 'Bitcoiner', pair[1]);
        assert.strictEqual(data.label, 'Tip Bitcoiner', pair[1]);
    }
    const ok = await loadProfile('Ada');
    assert.strictEqual(ok._profileTipData.recipientName, 'Ada');
    assert.strictEqual(ok._profileTipData.label, 'Tip Ada');
});

test('beats tip callers pass only a string name', async function() {
    const cases = [
        { artist: { first: 'Ada' }, authorName: ['Ada'] },
        { artist: null, authorName: { first: 'Ada' } },
        { artist: ['Ada'], authorName: null },
        { artist: null, authorName: null },
    ];
    for (const names of cases) {
        const t = loadBeatsTips();
        t.sandbox._beatsQueue = [{ id: 't1', authorId: 'artist1', title: 'Song', artist: names.artist, authorName: names.authorName }];
        t.sandbox._beatsQueueIdx = 0;
        t.sandbox.beatsTipCurrentArtist();
        t.sandbox.beatsTipCurrentArtistById('artist1', 't1');
        await t.sandbox.beatsShowV4VTip(t.sandbox._beatsQueue[0]);
        assert.ok(t.seen.length >= 3, 'all three callers ran');
        t.seen.forEach(function(opts, i) {
            assert.strictEqual(typeof opts.recipientName, 'string', 'caller ' + i);
            assert.strictEqual(opts.recipientName, 'Artist', 'caller ' + i);
        });
    }
    const ok = loadBeatsTips();
    ok.sandbox._beatsQueue = [{ id: 't1', authorId: 'artist1', title: 'Song', artist: 'Ada', authorName: { first: 'x' } }];
    ok.sandbox._beatsQueueIdx = 0;
    ok.sandbox.beatsTipCurrentArtist();
    assert.strictEqual(ok.seen[0].recipientName, 'Ada');
    const fallback = loadBeatsTips();
    fallback.sandbox._beatsQueue = [{ id: 't1', authorId: 'artist1', title: 'Song', artist: { first: 'x' }, authorName: 'Ada' }];
    fallback.sandbox._beatsQueueIdx = 0;
    fallback.sandbox.beatsTipCurrentArtist();
    assert.strictEqual(fallback.seen[0].recipientName, 'Ada');
});

test('beats integration tip buttons pass only a string name', function() {
    const cases = [
        { artist: { first: 'Ada' }, authorName: ['Ada'] },
        { artist: null, authorName: ['Ada'] },
        { artist: ['Ada'], authorName: null },
        { artist: null, authorName: null },
    ];
    cases.forEach(function(names, i) {
        const buttons = loadIntegrations({ id: 't1', authorId: 'artist1', artist: names.artist, authorName: names.authorName });
        assert.ok(buttons.length >= 1, 'button injected ' + i);
        const tip = JSON.parse(buttons[0].attrs['data-tip-action']);
        assert.strictEqual(typeof tip.recipientName, 'string', 'case ' + i);
        assert.strictEqual(tip.recipientName, 'Artist', 'case ' + i);
    });
    const ok = loadIntegrations({ id: 't1', authorId: 'artist1', artist: 'Ada', authorName: { first: 'x' } });
    assert.strictEqual(JSON.parse(ok[0].attrs['data-tip-action']).recipientName, 'Ada');
    const fallback = loadIntegrations({ id: 't1', authorId: 'artist1', artist: { first: 'x' }, authorName: 'Ada' });
    assert.strictEqual(JSON.parse(fallback[0].attrs['data-tip-action']).recipientName, 'Ada');
});

(async function() {
    for (const run of queue) await run();
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})();
