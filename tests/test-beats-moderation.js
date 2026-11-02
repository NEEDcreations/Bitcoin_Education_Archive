// Hidden-track filter and default Beats profanity mask.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

const { beatsCensor } = require('../beats-censor.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
    return function() {
        try {
            const result = fn();
            if (result && typeof result.then === 'function') {
                return result.then(function() {
                    console.log('✅ ' + name);
                    passed++;
                }).catch(function(e) {
                    console.log('❌ ' + name + ': ' + e.message);
                    failed++;
                });
            }
            console.log('✅ ' + name);
            passed++;
        } catch (e) {
            console.log('❌ ' + name + ': ' + e.message);
            failed++;
        }
        return Promise.resolve();
    };
}

function makeEl(tag) {
    return {
        tag: tag || 'div',
        id: '',
        className: '',
        value: '',
        textContent: '',
        style: {},
        attrs: {},
        children: [],
        parentNode: null,
        _html: '',
        appendChild: function(child) {
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
        insertBefore: function(child) {
            child.parentNode = this;
            this.children.unshift(child);
            return child;
        },
        remove: function() {},
        setAttribute: function(k, v) { this.attrs[k] = String(v); },
        getAttribute: function(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
        querySelector: function() { return null; },
        querySelectorAll: function(sel) {
            const out = [];
            const walk = function(node) {
                if (sel === '[data-beats-text]' && node.attrs && node.attrs['data-beats-text']) out.push(node);
                (node.children || []).forEach(walk);
            };
            walk(this);
            return out;
        },
        set innerHTML(html) {
            this._html = String(html || '');
            this.children = [];
            const re = /data-beats-text="([^"]+)"/g;
            let match;
            while ((match = re.exec(this._html))) {
                const span = makeEl('span');
                span.attrs['data-beats-text'] = match[1];
                span.parentNode = this;
                this.children.push(span);
            }
        },
        get innerHTML() { return this._html; }
    };
}

const store = {};
const sandbox = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    localStorage: {
        getItem: function(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function(k, v) { store[k] = String(v); },
        removeItem: function(k) { delete store[k]; }
    },
    sessionStorage: {
        getItem: function() { return null; },
        setItem: function() {},
        removeItem: function() {}
    },
    location: { hash: '', href: 'http://localhost/' },
    navigator: {},
    addEventListener: function() {},
    removeEventListener: function() {},
    Audio: function() {
        return {
            volume: 1,
            pause: function() {},
            play: function() { return Promise.resolve(); },
            addEventListener: function() {}
        };
    },
    escapeHtml: function(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },
    safeJSON: function() { return []; },
    _safeCover: function(src) { return src || ''; },
    beatsFormatTime: function() { return '0:00'; },
    beatsCensor: beatsCensor,
    showToast: function() {},
    auth: { currentUser: null, onAuthStateChanged: function() {} },
    document: null
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.document = {
    body: makeEl('body'),
    head: makeEl('head'),
    getElementById: function(id) { return this._els[id] || null; },
    createElement: function(tag) { return makeEl(tag); },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    _els: {}
};
sandbox.document.body.appendChild = function(child) {
    child.parentNode = sandbox.document.body;
    sandbox.document.body.children.push(child);
    if (child.id) sandbox.document._els[child.id] = child;
    return child;
};
global.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(read('beats.js'), sandbox, { filename: 'beats.js' });
vm.runInContext(read('notifications.js'), sandbox, { filename: 'notifications.js' });

function doc(id, data) {
    return {
        id: id,
        exists: true,
        data: function() { return data; }
    };
}
function snap(docs) {
    return {
        empty: docs.length === 0,
        docs: docs,
        forEach: function(fn) { docs.forEach(fn); }
    };
}

const queue = [];

queue.push(test('masks profanity and keeps the first and last letters', function() {
    delete sandbox._beatsShowUncensored;
    assert.strictEqual(beatsCensor('Fuck'), 'F**k');
    assert.strictEqual(beatsCensor('FUCK'), 'F**K');
    assert.strictEqual(beatsCensor('fuck'), 'f**k');
    assert.strictEqual(beatsCensor('Shit'), 'S**t');
    assert.strictEqual(beatsCensor('fucking'), 'f*****g');
    assert.strictEqual(beatsCensor("fuckin'"), "f****n'");
    assert.strictEqual(beatsCensor('motherfucker'), 'm**********r');
    assert.strictEqual(beatsCensor('bullshit'), 'b******t');
    assert.strictEqual(beatsCensor('shitter'), 's*****r');
    assert.strictEqual(beatsCensor('Digital Gold (Fuck Your Control)'), 'Digital Gold (F**k Your Control)');
    assert.strictEqual(beatsCensor('F**k'), 'F**k');
}));

queue.push(test('leaves ordinary words alone', function() {
    ['class', 'assets', 'cocktail', 'Dick Greaser', 'spicy', 'Scunthorpe', 'assignment'].forEach(function(word) {
        assert.strictEqual(beatsCensor(word), word, word);
    });
}));

queue.push(test('the show-uncensored switch is display-only and shared text stays masked', function() {
    sandbox._beatsShowUncensored = true;
    assert.strictEqual(beatsCensor('Fuck'), 'Fuck');
    assert.strictEqual(beatsCensor('Fuck', true), 'F**k');
    assert.strictEqual(beatsCensor('Digital Gold (Fuck Your Control)', true), 'Digital Gold (F**k Your Control)');
    sandbox._beatsShowUncensored = false;
    assert.strictEqual(beatsCensor('Fuck'), 'F**k');
}));

queue.push(test('hidden is only the boolean true', function() {
    assert.strictEqual(sandbox._beatsIsHidden({ hidden: true }), true);
    assert.strictEqual(sandbox._beatsIsHidden({ hidden: 'true' }), false);
    assert.strictEqual(sandbox._beatsIsHidden({ hidden: 1 }), false);
    assert.strictEqual(sandbox._beatsIsHidden({}), false);
    assert.strictEqual(sandbox._beatsIsHidden(null), false);
    assert.strictEqual(sandbox._beatsTrackFromDoc(doc('hid', { title: 'Nope', hidden: true })), null);
    assert.strictEqual(sandbox._beatsTrackFromDoc({ id: 'missing', exists: false, data: function() { return { title: 'Gone' }; } }), null);
    const visible = sandbox._beatsTrackFromDoc(doc('ok', { title: 'Class', hidden: 'true' }));
    assert.strictEqual(visible.id, 'ok');
    assert.strictEqual(visible.title, 'Class');
    const list = [];
    sandbox._beatsPushDocs(list, snap([
        doc('hid', { title: 'Fuck', hidden: true }),
        doc('ok', { title: 'Digital Gold (Fuck Your Control)', artist: 'Dick Greaser' })
    ]));
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, 'ok');
}));

queue.push(test('a short visible page keeps fetching', function() {
    const pages = [
        [doc('h1', { hidden: true, title: 'Fuck' }), doc('h2', { hidden: true, title: 'Shit' })],
        [doc('ok', { title: 'Digital Gold (Fuck Your Control)', audioUrl: 'https://example.test/a.mp3' })]
    ];
    let calls = 0;
    return sandbox._beatsCollectVisible(function() {
        return {
            startAfter: function() { return this; },
            limit: function() { return this; },
            get: function() {
                const docs = pages[calls++] || [];
                return Promise.resolve(snap(docs));
            }
        };
    }, 2, 1, 4, null).then(function(res) {
        assert.strictEqual(calls, 2);
        assert.strictEqual(res.tracks.length, 1);
        assert.strictEqual(res.tracks[0].title, 'Digital Gold (Fuck Your Control)');
        assert.strictEqual(res.exhausted, true);
    });
}));

queue.push(test('search still matches the raw title and skips hidden tracks', function() {
    const tracks = [
        doc('gold', { title: 'Digital Gold (Fuck Your Control)', artist: 'Dick Greaser', genre: 'rock', audioUrl: 'https://example.test/gold.mp3' }),
        doc('hid', { title: 'Fuck Your Control (hidden)', artist: 'Nope', hidden: true, audioUrl: 'https://example.test/hid.mp3' }),
        doc('safe', { title: 'Class Assets Cocktail', artist: 'Dick Greaser', genre: 'jazz' })
    ];
    sandbox.db = {
        collection: function() {
            return {
                orderBy: function() { return this; },
                where: function() { return this; },
                limit: function() { return this; },
                get: function() { return Promise.resolve(snap(tracks)); }
            };
        }
    };
    const input = makeEl('input');
    input.value = 'fuck your control';
    const list = makeEl('div');
    list.id = 'beatsTrackList';
    sandbox.document._els.beatsSearchInput = input;
    sandbox.document._els.beatsTrackList = list;
    sandbox.beatsPerformSearch();
    let wait = Promise.resolve();
    for (let step = 0; step < 8; step++) wait = wait.then(function() {});
    return wait.then(function() {
        const ids = (sandbox._beatsQueue || []).map(function(t) { return t.id; });
        assert.strictEqual(ids.join(','), 'gold', list._html.slice(0, 500));
        assert.ok(list._html.indexOf('Digital Gold (Fuck Your Control)') === -1, 'raw title was written into html');
        const shown = list.querySelectorAll('[data-beats-text]').map(function(node) { return node.textContent; });
        assert.ok(shown.indexOf('Digital Gold (F**k Your Control)') !== -1, 'censored title missing: ' + shown.join(' | '));
        assert.ok(shown.indexOf('Dick Greaser') !== -1);
    });
}));

queue.push(test('playing a hidden track is refused', function() {
    const toasts = [];
    sandbox.showToast = function(message) { toasts.push(message); };
    sandbox._beatsQueue = [{ id: 'hid', hidden: true, title: 'Fuck', audioUrl: 'https://example.test/hid.mp3' }];
    sandbox._beatsQueueIdx = -1;
    sandbox._beatsAudio = null;
    sandbox.beatsPlayTrack(0);
    assert.deepStrictEqual(toasts, ['This track is unavailable']);
    assert.strictEqual(sandbox._beatsAudio, null);
    sandbox._beatsQueue = [{ id: 'str', hidden: 'true', title: 'Class', audioUrl: 'https://example.test/ok.mp3' }];
    sandbox.beatsPlayTrack(0);
    assert.ok(sandbox._beatsAudio, 'a string hidden flag still plays');
}));

queue.push(test('guests start censored and a signed-in account can opt in', function() {
    store.btc_beats_uncensored = '1';
    sandbox.auth = { currentUser: null, onAuthStateChanged: function() {} };
    sandbox._beatsCensorAuthHook = true;
    const box = makeEl('input');
    box.id = 'beatsUncensoredCheck';
    sandbox.document._els.beatsUncensoredCheck = box;
    sandbox._beatsInitCensorPref();
    assert.strictEqual(sandbox._beatsShowUncensored, false);
    assert.strictEqual(box.checked, false);
    assert.strictEqual(store.btc_beats_uncensored, '1');

    let wrote = null;
    sandbox.auth = {
        currentUser: { uid: 'user-1', isAnonymous: false },
        onAuthStateChanged: function() {}
    };
    sandbox.db = {
        collection: function(name) {
            assert.strictEqual(name, 'users');
            return {
                doc: function(id) {
                    assert.strictEqual(id, 'user-1');
                    return {
                        get: function() {
                            return Promise.resolve({
                                exists: true,
                                data: function() { return { beatsShowUncensored: false }; }
                            });
                        },
                        update: function(data) {
                            wrote = data;
                            return Promise.resolve();
                        }
                    };
                }
            };
        }
    };
    sandbox._beatsInitCensorPref();
    assert.strictEqual(sandbox._beatsShowUncensored, true);
    return Promise.resolve().then(function() {
        assert.strictEqual(sandbox._beatsShowUncensored, false);
        assert.strictEqual(store.btc_beats_uncensored, '0');
        sandbox.beatsSetShowUncensored(true);
        assert.strictEqual(sandbox._beatsShowUncensored, true);
        assert.strictEqual(store.btc_beats_uncensored, '1');
        assert.strictEqual(wrote && wrote.beatsShowUncensored, true);
        assert.strictEqual(Object.keys(wrote).join(','), 'beatsShowUncensored');
        sandbox.auth = { currentUser: { uid: 'guest', isAnonymous: true }, onAuthStateChanged: function() {} };
        sandbox.beatsSetShowUncensored(false);
        assert.strictEqual(store.btc_beats_uncensored, '1');
    });
}));

queue.push(test('track notifications are censored at display time', function() {
    sandbox._beatsShowUncensored = false;
    const card = sandbox.notifCardHtml('n1', {
        message: 'liked your track "Digital Gold (Fuck Your Control)"',
        targetType: 'beats_track',
        targetId: 'gold',
        read: true
    });
    assert.ok(card.includes('F**k Your Control'));
    assert.ok(!card.includes('Fuck Your Control'));
    const other = sandbox.notifCardHtml('n2', {
        message: 'Fuck this forum post',
        targetType: 'forum_post',
        targetId: 'post1',
        read: true
    });
    assert.ok(other.includes('Fuck this forum post'));
}));

queue.push(test('server and chat announcements are always censored', function() {
    const functions = read('functions/index.js');
    const worker = read('workers/chat-bridge/worker.js');
    const chat = read('global-chat.js');
    const beats = read('beats.js');
    const notes = read('patch-notes.html');
    const radio = read('functions/src/nachoRadio.js');
    assert.ok(functions.includes("if (track.hidden === true) throw new functionsV1.https.HttpsError('not-found', 'Track not found');"));
    assert.ok(functions.includes('const { beatsCensor } = require(\'./src/beats-censor.js\');'));
    assert.ok(!functions.includes('require(\'../beats-censor.js\')'));
    assert.ok(radio.includes('if (t.hidden === true) return false;'));
    assert.ok((radio.match(/isEligible\(/g) || []).length >= 2);
    assert.ok(radio.includes('const publicTitle = beatsCensor(track.title || \'Untitled\');'));
    assert.ok(radio.includes('const publicArtist = beatsCensor(track.artist || track.authorName || \'Unknown\');'));
    assert.ok(radio.includes('Now playing: "${publicTitle}" by ${publicArtist}'));
    assert.ok(functions.includes('`V4V: ${beatsCensor(track.title)}`'));
    assert.ok(worker.includes("tracks = tracks.filter(function(t) { return t.audioUrl && t.hidden !== true; });"));
    assert.ok(worker.includes('beatsCensor(track.title || \'Untitled\')'));
    assert.ok(worker.includes('beatsCensor(track.artist || track.authorName || \'Unknown\')'));
    assert.ok(chat.includes('return (typeof beatsCensor === \'function\') ? beatsCensor(raw, true) : raw;'));
    assert.ok(chat.includes('is now DJing! Playing: "\' + djPublic(track.title, \'Untitled\')'));
    assert.ok(chat.includes('trackTitle: djPublic(track.title, \'Untitled\')'));
    assert.ok(beats.includes("if (!track || _beatsIsHidden(track)) { if (typeof showToast === 'function') showToast('This track is unavailable'); return; }"));
    assert.ok(beats.includes("note.textContent = 'This track is unavailable'"));
    assert.ok(beats.includes('Show uncensored titles'));
    const searchAt = beats.indexOf('if (_beatsIsHidden(t)) return;');
    const titleAt = beats.indexOf("var title  = (t.title      || '').toLowerCase().indexOf(query) !== -1;");
    assert.ok(searchAt !== -1 && titleAt > searchAt);
    assert.ok(notes.includes('Beats now hides strong language in titles by default, with a switch to show it.'));
    assert.ok(notes.includes('Moderated Beats tracks are now hidden everywhere.'));
    assert.ok(notes.includes('Importing a Beats track can never un-hide a moderated one.'));
    assert.ok(notes.indexOf('Beats now hides strong language in titles by default, with a switch to show it.') < notes.indexOf('Moderated Beats tracks are now hidden everywhere.'));
    assert.ok(notes.indexOf('Moderated Beats tracks are now hidden everywhere.') < notes.indexOf('Updated education topics with current facts and fixed broken links and images.'));
    assert.ok(read('privacy.html').includes('beatsShowUncensored'));
    const rules = read('firestore.rules');
    assert.ok(rules.includes('beatsShowUncensored'));
    const beatsRules = rules.slice(rules.indexOf('match /beats_tracks/{trackId}'), rules.indexOf('match /beats_artists/{artistId}'));
    assert.ok(beatsRules.includes("resource.data.get('hidden', false) != true"));
    assert.ok(beatsRules.includes('request.resource.data.hidden == true'));
    assert.ok(beatsRules.includes('isAdmin()'));
    assert.ok(beatsRules.indexOf('request.resource.data.hidden == true') < beatsRules.indexOf('allow delete:'));
    const title = 'Digital Gold (Fuck Your Control)';
    const artist = 'Shit Artist';
    sandbox._beatsShowUncensored = true;
    const announcement = '🦌 Nacho Radio: "' + beatsCensor(title, true) + '" by ' + beatsCensor(artist, true) + ' is up next';
    assert.ok(announcement.includes('F**k Your Control'));
    assert.ok(announcement.includes('S**t Artist'));
    assert.ok(!announcement.includes('Fuck'));
}));

queue.push(test('client and functions beats-censor copies are identical', function() {
    assert.strictEqual(read('beats-censor.js'), read('functions/src/beats-censor.js'));
    const deployed = require('../functions/src/beats-censor.js');
    assert.strictEqual(typeof deployed.beatsCensor, 'function');
    assert.strictEqual(deployed.beatsCensor('Fuck', true), beatsCensor('Fuck', true));
}));

queue.reduce(function(chain, next) {
    return chain.then(next);
}, Promise.resolve()).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
