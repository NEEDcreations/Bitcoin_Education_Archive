// Peer request optimistic UI, managePeer round-trips, preferRest, and the
// Quest Hub tab label. No Firebase project and no network.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        const out = fn();
        if (out && typeof out.then === 'function') {
            return out.then(function() {
                console.log('✅ ' + name);
                passed++;
            }, function(e) {
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
}

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

function extractFunction(src, signature) {
    const start = src.indexOf(signature);
    assert(start >= 0, 'missing ' + signature);
    let i = src.indexOf('{', start);
    let depth = 0;
    let quote = null;
    for (; i < src.length; i++) {
        const c = src[i];
        if (quote) {
            if (c === quote && src[i - 1] !== '\\') quote = null;
            continue;
        }
        if (c === "'" || c === '"' || c === '`') {
            quote = c;
            continue;
        }
        if (c === '{') depth++;
        else if (c === '}') {
            depth--;
            if (depth === 0) return src.slice(start, i + 1);
        }
    }
    throw new Error('unterminated ' + signature);
}

function mockBtn(text) {
    return {
        disabled: false,
        textContent: text,
        style: { opacity: '', cursor: '', background: '' },
        parentElement: null,
        _busy: null,
        getAttribute(name) { return name === 'data-peer-busy' ? this._busy : null; },
        setAttribute(name, value) { if (name === 'data-peer-busy') this._busy = value; },
        removeAttribute(name) { if (name === 'data-peer-busy') this._busy = null; }
    };
}

function harness() {
    const state = {
        calls: [],
        toasts: [],
        events: [],
        release: null,
        fail: null,
        mode: 'pending'
    };
    const sandbox = {
        console: { log: function() {}, warn: function() {}, error: function() {} },
        setTimeout: function(fn, ms) { sandbox._timeouts.push(ms); return 0; },
        _timeouts: [],
        auth: { currentUser: { uid: 'me' } },
        window: { _myPeers: new Set() },
        checkBadges: function() {},
        showToast: function(msg) {
            state.toasts.push(msg);
            state.events.push('toast');
        },
        firebase: {
            functions: function() {
                return {
                    httpsCallable: function(name) {
                        return function(data) {
                            state.events.push('call');
                            state.calls.push({ name: name, data: data });
                            if (state.mode === 'pending') {
                                return new Promise(function(resolve, reject) {
                                    state.release = resolve;
                                    state.fail = reject;
                                });
                            }
                            if (state.mode === 'success') return Promise.resolve({ data: { success: true } });
                            if (state.mode === 'nosuccess') return Promise.resolve({ data: { success: false } });
                            return Promise.reject(state.mode);
                        };
                    }
                };
            }
        }
    };
    vm.createContext(sandbox);
    vm.runInContext(extractFunction(read('messaging.js'), 'window._sendPeerRequest = async function'), sandbox);
    vm.runInContext(extractFunction(read('ranking.js'), 'window.managePeer = async function'), sandbox);
    return { state: state, sandbox: sandbox };
}

function walkJs(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function(ent) {
        if (ent.name === 'node_modules') return;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walkJs(full, out);
        else if (ent.name.endsWith('.js')) out.push(full);
    });
    return out;
}

const queue = [];

queue.push(test('profile send updates the button and toast before the callable', async function() {
    const h = harness();
    const btn = mockBtn('🧡 Add Peer');
    const pending = h.sandbox.window._sendPeerRequest(btn, 'peer-1234');
    assert.strictEqual(btn.textContent, '🧡 Sent!');
    assert.strictEqual(btn.disabled, true);
    assert.strictEqual(btn._busy, '1');
    assert.deepStrictEqual(h.state.toasts, ['Peer request sent! 🧡']);
    assert.deepStrictEqual(h.state.events.slice(0, 2), ['toast', 'call']);
    assert.strictEqual(h.state.calls.length, 1);
    assert.strictEqual(h.state.calls[0].data.action, 'send');
    assert.strictEqual(h.state.calls[0].data.targetUid, 'peer-1234');
    h.state.release({ data: { success: true } });
    await pending;
    assert.strictEqual(btn.textContent, '🧡 Sent!');
    assert.strictEqual(btn.disabled, true);
}));

queue.push(test('profile send ignores a second tap while the first is in flight', async function() {
    const h = harness();
    const btn = mockBtn('🧡 Add Peer');
    const first = h.sandbox.window._sendPeerRequest(btn, 'peer-1234');
    const second = h.sandbox.window._sendPeerRequest(btn, 'peer-1234');
    assert.strictEqual(h.state.calls.length, 1);
    assert.strictEqual(await second, undefined);
    h.state.release({ data: { success: true } });
    await first;
}));

queue.push(test('profile send rolls the button back and shows the error toast', async function() {
    const h = harness();
    const btn = mockBtn('🧡 Add Peer');
    btn.style.background = 'rgba(249,115,22,0.12)';
    const pending = h.sandbox.window._sendPeerRequest(btn, 'peer-1234');
    h.state.fail(Object.assign(new Error('Too many pending peer requests'), { code: 'resource-exhausted' }));
    await pending;
    assert.strictEqual(btn.textContent, '🧡 Add Peer');
    assert.strictEqual(btn.disabled, false);
    assert.strictEqual(btn._busy, null);
    assert.strictEqual(btn.style.background, 'rgba(249,115,22,0.12)');
    assert.ok(h.state.toasts.indexOf('Too many pending peer requests') !== -1);
}));

queue.push(test('profile send treats already-exists code and message as success', async function() {
    const byCode = harness();
    const btn = mockBtn('🧡 Add Peer');
    const pending = byCode.sandbox.window._sendPeerRequest(btn, 'peer-1234');
    byCode.state.fail(Object.assign(new Error('Already peers'), { code: 'functions/already-exists' }));
    await pending;
    assert.strictEqual(btn.textContent, '🧡 Sent!');
    assert.strictEqual(btn.disabled, true);
    assert.deepStrictEqual(byCode.state.toasts, ['Peer request sent! 🧡']);

    const byMsg = harness();
    const btn2 = mockBtn('🧡 Add Peer');
    const pending2 = byMsg.sandbox.window._sendPeerRequest(btn2, 'peer-1234');
    byMsg.state.fail(new Error('already-exists'));
    await pending2;
    assert.strictEqual(btn2.textContent, '🧡 Sent!');
    assert.strictEqual(btn2.disabled, true);
}));

queue.push(test('managePeer send, accept, decline, and remove update before the callable', async function() {
    const h = harness();
    const cases = [
        ['send', '🧡 Sent!', 'Peer request sent! 🧡'],
        ['accept', '🧡 Accepted!', 'Peer accepted! 🧡'],
        ['decline', 'Declined', 'Request declined'],
        ['remove', 'Removed', 'Peer removed']
    ];
    for (const row of cases) {
        h.state.calls.length = 0;
        h.state.toasts.length = 0;
        h.sandbox.window._peerInflight = {};
        const btn = mockBtn(row[0]);
        const pending = h.sandbox.window.managePeer(row[0], 'peer-1234', btn);
        assert.strictEqual(btn.textContent, row[1], row[0] + ' label');
        assert.strictEqual(btn.disabled, true);
        assert.strictEqual(h.state.toasts[0], row[2], row[0] + ' toast');
        assert.deepStrictEqual(h.state.events.slice(0, 2), ['toast', 'call']);
        h.state.events.length = 0;
        assert.strictEqual(h.state.calls.length, 1);
        assert.strictEqual(h.state.calls[0].data.action, row[0]);
        h.state.release({ data: { success: true } });
        await pending;
        assert.strictEqual(btn.textContent, row[1]);
    }
}));

queue.push(test('managePeer shares one in-flight promise and disables the sibling button', async function() {
    const h = harness();
    const accept = mockBtn('Accept');
    const decline = mockBtn('Decline');
    const parent = {
        querySelectorAll: function() { return [accept, decline]; }
    };
    accept.parentElement = parent;
    decline.parentElement = parent;
    const first = h.sandbox.window.managePeer('accept', 'peer-1234', accept);
    const second = h.sandbox.window.managePeer('accept', 'peer-1234', accept);
    assert.strictEqual(h.state.calls.length, 1);
    assert.strictEqual(decline.disabled, true);
    h.state.release({ data: { success: true } });
    await first;
    await second;
    assert.ok(h.sandbox.window._myPeers.has('peer-1234'));
}));

queue.push(test('managePeer rolls accept and remove back when the callable fails', async function() {
    const h = harness();
    h.sandbox.window._myPeers = new Set(['peer-1234']);
    const removeBtn = mockBtn('Remove');
    const removing = h.sandbox.window.managePeer('remove', 'peer-1234', removeBtn);
    assert.strictEqual(h.sandbox.window._myPeers.has('peer-1234'), false);
    h.state.fail(Object.assign(new Error('Not peers'), { code: 'not-found' }));
    await removing;
    assert.strictEqual(h.sandbox.window._myPeers.has('peer-1234'), true);
    assert.strictEqual(removeBtn.textContent, 'Remove');
    assert.strictEqual(removeBtn.disabled, false);
    assert.ok(h.state.toasts.indexOf('Not peers') !== -1);

    h.state.toasts.length = 0;
    h.sandbox.window._peerInflight = {};
    const acceptBtn = mockBtn('Accept');
    const accepting = h.sandbox.window.managePeer('accept', 'peer-9999', acceptBtn);
    assert.strictEqual(h.sandbox.window._myPeers.has('peer-9999'), true);
    h.state.fail(Object.assign(new Error('Peer request not found'), { code: 'not-found' }));
    await accepting;
    assert.strictEqual(h.sandbox.window._myPeers.has('peer-9999'), false);
    assert.strictEqual(acceptBtn.textContent, 'Accept');
    assert.strictEqual(acceptBtn.disabled, false);
}));

queue.push(test('managePeer keeps the optimistic accept when the server says already-exists', async function() {
    const h = harness();
    const btn = mockBtn('Accept');
    const pending = h.sandbox.window.managePeer('accept', 'peer-1234', btn);
    h.state.fail(Object.assign(new Error('Already peers'), { code: 'already-exists' }));
    await pending;
    assert.strictEqual(btn.textContent, '🧡 Accepted!');
    assert.strictEqual(btn.disabled, true);
    assert.ok(h.sandbox.window._myPeers.has('peer-1234'));
    assert.deepStrictEqual(h.state.toasts, ['Peer accepted! 🧡']);
    assert.ok(h.sandbox._timeouts.indexOf(1500) !== -1);
}));

queue.push(test('managePeer asks the user to sign in and does not call the function', async function() {
    const h = harness();
    h.sandbox.auth.currentUser = null;
    const btn = mockBtn('Accept');
    const result = await h.sandbox.window.managePeer('accept', 'peer-1234', btn);
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(h.state.toasts, ['Sign in first']);
    assert.strictEqual(h.state.calls.length, 0);
    assert.strictEqual(btn.textContent, 'Accept');
}));

queue.push(test('settings buttons pass the clicked element into managePeer', function() {
    const ranking = read('ranking.js');
    assert.ok(ranking.includes("managePeer(\\'accept\\',\\'' + d.from + '\\',this)"));
    assert.ok(ranking.includes("managePeer(\\'decline\\',\\'' + d.from + '\\',this)"));
    assert.ok(ranking.includes('data-peer-action="remove"'));
    assert.ok(ranking.includes("managePeer('remove', uid, btnEl)"));
}));

queue.push(test('managePeer send reads in one batch and writes the request with the notification', function() {
    const src = read('functions/index.js');
    const start = src.indexOf('exports.managePeer = functionsV1.https.onCall');
    const end = src.indexOf('exports.awardPoints = functionsV1.https.onCall');
    assert(start > 0 && end > start);
    const fn = src.slice(start, end);
    assert.strictEqual(fn.includes('runWith'), false);
    assert.strictEqual(fn.includes('minInstances'), false);
    assert.strictEqual(fn.includes('memory'), false);
    const send = fn.slice(fn.indexOf("if (action === 'send')"), fn.indexOf("if (action === 'accept')"));
    assert.ok(send.includes('userRef.get()'));
    assert.ok(send.includes('targetRef.get()'));
    assert.ok(send.includes(".where('from', '==', uid).where('status', '==', 'pending').limit(51).get()"));
    assert.ok(send.includes('reqRef.get()'));
    assert.ok(send.includes('revReqRef.get()'));
    assert.strictEqual((send.match(/await /g) || []).length, 3, 'send awaits the parallel read, the batch commit, and the category push');
    assert.ok(send.includes('await sendUserPush'));
    assert.ok(send.includes('batch.set(reqRef,'));
    assert.ok(send.includes("batch.set(db.collection('notifications').doc(),"));
    assert.ok(send.includes("type: 'peer_request'"));
    assert.strictEqual(send.includes('notifications\')\n            .add') || send.includes(".add({"), false);
    const checks = [
        'Must be signed in',
        'Must use a real account to connect with peers',
        'Unknown action',
        'Invalid targetUid',
        'Cannot peer with yourself',
        'Your account not found',
        'Target user not found',
        'Already peers',
        'outSnap.size >= 50',
        'Too many pending peer requests',
        'Peer request already sent',
        'This user already sent you a request',
        'Peer request not found or already handled',
        'Not your request to accept',
        'Not your request to decline',
        'Not your request to cancel',
        'Not peers'
    ];
    checks.forEach(function(text) {
        assert.ok(fn.includes(text), 'missing check: ' + text);
    });
    const accept = fn.slice(fn.indexOf("if (action === 'accept')"), fn.indexOf("if (action === 'decline')"));
    const acceptCommit = accept.indexOf('await batch.commit()');
    assert.ok(accept.includes('revReqRef.get()') && accept.includes('userRef.get()'));
    assert.ok(accept.indexOf('Promise.all') < accept.indexOf('batch.update(revReqRef'));
    assert.ok(accept.includes("type: 'peer_accepted'"));
    assert.ok(acceptCommit < accept.indexOf("familyFor('peerCount')"), 'badge grants stay after the accept commit');
    const decline = fn.slice(fn.indexOf("if (action === 'decline')"), fn.indexOf("if (action === 'cancel')"));
    assert.ok(decline.includes('revReqRef.get()') && decline.includes('revReqRef.delete()'));
    const remove = fn.slice(fn.indexOf("if (action === 'remove')"));
    assert.ok(remove.includes('userRef.get()'));
    assert.ok(remove.includes('arrayRemove(targetUid)'));
    assert.ok(remove.includes('batch.delete(reqRef)'));
    assert.ok(remove.includes('batch.delete(revReqRef)'));
}));

queue.push(test('preferRest is enabled once before any Firestore use', function() {
    const src = read('functions/index.js');
    const call = 'db.settings({ preferRest: true })';
    assert.strictEqual(src.indexOf(call), src.lastIndexOf(call));
    assert.ok(src.indexOf(call) > 0);
    assert.ok(src.indexOf(call) < src.indexOf('db.collection('));
    assert.ok(src.indexOf(call) < src.indexOf("require('./src/"));
    assert.ok(src.includes('__btcFirestorePreferRest'));
}));

queue.push(test('no Cloud Function uses a Firestore snapshot listener', function() {
    const files = walkJs(path.join(root, 'functions'), []);
    const hit = [];
    files.forEach(function(file) {
        const text = fs.readFileSync(file, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '');
        if (/onSnapshot|\.on\(\s*['"]snapshot|snapshots\(/.test(text)) hit.push(path.relative(root, file));
    });
    assert.deepStrictEqual(hit, []);
}));

queue.push(test('More quests opens Nook/Inv from the Today card', function() {
    const html = read('index.html');
    const quests = read('quests.js');
    const buttons = html.match(/<button[^>]*id="todayNookBtn"[^>]*>[\s\S]*?<\/button>/g) || [];
    assert.strictEqual(buttons.length, 1);
    assert.ok(buttons[0].includes('aria-label="Nook / Inventory"'));
    assert.ok(buttons[0].includes('>Nook/Inventory</span>'));
    assert.ok(html.includes('id="todayCard"'));
    assert.ok(html.includes('id="todayFavorStrip"'));
    assert.ok(html.includes('>Earn Favor</button>'));
    assert.ok(html.includes('More quests'));
    assert.strictEqual(html.includes('id="qhTabNook"'), false);
    assert.strictEqual(quests.includes('id="qhTabNook"'), false);
    assert.strictEqual(quests.includes('Nook/Inventory</button>'), false);
    assert.strictEqual(quests.includes('>🦌 Nook/Inventory'), false);
    assert.ok(quests.includes('window._focusTodayCard'));
}));

queue.push(test('cache busters are current and index.html matches 404.html', function() {
    const html = read('index.html');
    const html404 = read('404.html');
    const sw = read('sw.js');
    assert.strictEqual(html, html404);
    assert.ok(html.includes('ranking.js?v=20261024_v2363'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2357'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2356'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2355'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2354'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2352'));
    assert.ok(!html.includes('ranking.js?v=20261024_repickc'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2350'));
    assert.ok(!html.includes('ranking.js?v=20261024_repickb'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2351'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2349'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2342'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2341'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2334'));
    assert.strictEqual(html.includes('ranking.js?v=20261023_v2333'), false);
    assert.strictEqual(html.includes('ranking.js?v=20261022_v2269'), false);
    assert.strictEqual(html.includes('ranking.js?v=20261022_lightfix'), false);
    assert.ok(html.includes('gifting.js?v=20261024_v2358'));
    assert.ok(!html.includes('gifting.js?v=20261024_v2357'));
    assert.ok(!html.includes('gifting.js?v=20261022_v2254'));
    assert.ok(html.includes('notifications.js?v=20261024_v2357'));
    assert.ok(!html.includes('notifications.js?v=20261024_v2355'));
    assert.ok(!html.includes('notifications.js?v=20261024_v2354'));
    assert.ok(!html.includes('notifications.js?v=20261024_v2352'));
    assert.strictEqual(html.includes('notifications.js?v=20261022_v2262'), false);
    assert.strictEqual(html.includes('notifications.js?v=20261022_v2254'), false);
    assert.strictEqual(html.includes('gifting.js?v=20261022_lightfix'), false);
    assert.strictEqual(html.includes('ranking.js?v=20261022_lightfix'), false);
    assert.strictEqual(html.includes('gifting.js?v=20261022_v2251'), false);
    assert.ok(html.includes('bundle.min.js?v=20261024_v2363'));
    assert.ok(!html.includes('bundle.min.js?v=20261024_v2358'));
    assert.ok(!html.includes('bundle.min.js?v=20261024_v2361'));
    assert.ok(!html.includes('bundle.min.js?v=20261024_v2360'));
    assert.ok(!html.includes('bundle.min.js?v=20261024_v2350'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2345'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2344'));
    assert.strictEqual(html.includes('bundle.min.js?v=20261023_v2348'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261023_v2347'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261023_v2346'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261023_v2345'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261023_v2344'), false);
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2343'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2342'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2341'));
    assert.strictEqual(html.includes('bundle.min.js?v=20261023_v2341'), false);
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2340'));
    assert.strictEqual(html.includes('bundle.min.js?v=20261023_v2340'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261023_v2333'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261022_v2295'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261022_v2293'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261022_v2279'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261022_v2271'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261022_v2268'), false);
    assert.ok(html.includes('global-chat.js?v=20261024_v2360'));
    assert.ok(!html.includes('global-chat.js?v=20261024_v2350'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2345'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2343'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2342'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2341'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2333'));
    assert.strictEqual(html.includes('global-chat.js?v=20261023_v2345'), false);
    assert.strictEqual(html.includes('global-chat.js?v=20261023_v2333'), false);
    assert.strictEqual(html.includes('global-chat.js?v=20261022_v2272'), false);
    assert.strictEqual(html.includes('global-chat.js?v=20261022_v2269'), false);
    assert.strictEqual(html.includes('global-chat.js?v=20261022_v2267'), false);
    assert.strictEqual(html.includes('global-chat.js?v=20261022_v2265'), false);
    assert.strictEqual(html.includes('global-chat.js?v=20261022_v2264'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261022_v2268'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261022_v2266'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261022_v2265'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261022_v2263'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261022_v2261'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261022_v2252'), false);
    assert.strictEqual(html.includes('global-chat.js?v=20261022_v2263'), false);
    assert.strictEqual(html.includes('global-chat.js?v=20261022_v2261'), false);
    assert.strictEqual(html.includes('global-chat.js?v=20261022_v2252'), false);
    assert.ok(html.includes('features.registry.js?v=20261024_v2358'));
    assert.ok(!html.includes('features.registry.js?v=20261024_v2357'));
    assert.ok(!html.includes('features.registry.js?v=20261024_v2355'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2342'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2341'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2339'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2330'));
    assert.strictEqual(html.includes('features.registry.js?v=20261022_v2266'), false);
    assert.strictEqual(html.includes('features.registry.js?v=20261022_v2265'), false);
    assert.ok(html.includes('satoshi-favor.js?v=20261024_v2363'));
    assert.ok(!html.includes('satoshi-favor.js?v=20261024_v2351'));
    assert.ok(!html.includes('satoshi-favor.js?v=20261023_v2323'));
    assert.strictEqual(html.includes('satoshi-favor.js?v=20261022_v2250'), false);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261024_v2358/g) || []).length, 4);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261024_v2352/g) || []).length, 0);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261024_v2351/g) || []).length, 0);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261024_v2350/g) || []).length, 0);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261023_v2341/g) || []).length, 0);
    assert.ok(!html.includes('quests.js?v=20261023_v2334'));
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261023_v2333/g) || []).length, 0);
    assert.strictEqual((html.match(/learning-quests\.js\?v=20261023_v2324/g) || []).length, 3);
    assert.strictEqual((html.match(/quests\.js\?v=20261022_v2279/g) || []).length, 0);
    assert.strictEqual((html.match(/quests\.js\?v=20261022_v2263/g) || []).length, 0);
    assert.ok(html.includes('lightning-tips.js?v=20261022_v2279'));
    assert.strictEqual(html.includes('ranking.js?v=20261022_v2250'), false);
    assert.strictEqual(html.includes('ranking.js?v=20261022_v2246'), false);
    assert.strictEqual(html.includes('ranking.js?v=20261022_v2245'), false);
    assert.strictEqual(html.includes('ranking.js?v=20261022_peerux'), false);
    assert.strictEqual(html.includes('ranking.js?v=20261022_appcheck'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261022_v2250'), false);
    assert.strictEqual(html.includes('bundle.min.js?v=20261022_gifts'), false);
    assert.strictEqual(html.includes('quests.js?v=20261022_v2250'), false);
    assert.strictEqual(html.includes('quests.js?v=20261022_v2245'), false);
    assert.strictEqual(html.includes('quests.js?v=20261022_openpolish'), false);
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2363'"));
    assert.ok(!sw.includes('btc-archive-v2362'));
    assert.ok(!sw.includes('btc-archive-v2361'));
    assert.ok(!sw.includes('btc-archive-v2360'));
    assert.ok(!sw.includes('btc-archive-v2359'));
    assert.ok(!sw.includes('btc-archive-v2358'));
    assert.ok(!sw.includes('btc-archive-v2357'));
    assert.ok(!sw.includes('btc-archive-v2356'));
    assert.ok(!sw.includes('btc-archive-v2355'));
    assert.ok(!sw.includes('btc-archive-v2354'));
    assert.ok(!sw.includes('btc-archive-v2353'));
    assert.ok(!sw.includes('btc-archive-v2352'));
    assert.ok(!sw.includes('btc-archive-v2351'));
    assert.ok(!sw.includes('btc-archive-v2350'));
    assert.ok(!sw.includes('btc-archive-v2349'));
    assert.ok(!sw.includes('btc-archive-v2348'));
    assert.ok(!sw.includes('btc-archive-v2347'));
    assert.ok(!sw.includes('btc-archive-v2346'));
    assert.ok(!sw.includes('btc-archive-v2345'));
    assert.ok(!sw.includes('btc-archive-v2344'));
    assert.ok(!sw.includes('btc-archive-v2343'));
    assert.ok(!sw.includes('btc-archive-v2342'));
    assert.ok(!sw.includes('btc-archive-v2340'));
    assert.ok(!sw.includes('btc-archive-v2341'));
    assert.ok(!sw.includes('btc-archive-v2339'));
    assert.ok(!sw.includes('btc-archive-v2338'));
    assert.ok(!sw.includes('btc-archive-v2334'));
    assert.strictEqual(sw.includes('btc-archive-v2333'), false);
    assert.strictEqual(sw.includes('btc-archive-v2332'), false);
    assert.ok(!sw.includes('btc-archive-v2331'));
    assert.ok(!sw.includes('btc-archive-v2330'));
    assert.strictEqual(sw.includes('btc-archive-v2329'), false);
    assert.strictEqual(sw.includes('btc-archive-v2327'), false);
    assert.strictEqual(sw.includes('btc-archive-v2326'), false);
    assert.strictEqual(sw.includes('btc-archive-v2325'), false);
    assert.strictEqual(sw.includes('btc-archive-v2324'), false);
    assert.strictEqual(sw.includes('btc-archive-v2322'), false);
    assert.strictEqual(sw.includes('btc-archive-v2323'), false);
    assert.strictEqual(sw.includes('btc-archive-v2301'), false);
    assert.strictEqual(sw.includes('btc-archive-v2295'), false);
    assert.strictEqual(sw.includes('btc-archive-v2293'), false);
    assert.strictEqual(sw.includes('btc-archive-v2286'), false);
    assert.strictEqual(sw.includes('btc-archive-v2279'), false);
    assert.strictEqual(sw.includes('btc-archive-v2272'), false);
    assert.strictEqual(sw.includes('nacho-fly.svg'), false);
    assert.ok(sw.includes('nacho-deer.svg'));
    assert.strictEqual(sw.includes('btc-archive-v2272'), false);
    assert.strictEqual(sw.includes('btc-archive-v2271'), false);
    assert.strictEqual(sw.includes('btc-archive-v2270'), false);
    assert.strictEqual(sw.includes('btc-archive-v2269'), false);
    assert.strictEqual(sw.includes('btc-archive-v2268'), false);
    assert.strictEqual(sw.includes('btc-archive-v2267'), false);
    assert.strictEqual(sw.includes('btc-archive-v2266'), false);
    assert.strictEqual(sw.includes('btc-archive-v2265'), false);
    assert.strictEqual(sw.includes('btc-archive-v2264'), false);
    assert.strictEqual(sw.includes('btc-archive-v2263'), false);
    assert.strictEqual(sw.includes('btc-archive-v2262'), false);
    assert.strictEqual(sw.includes('btc-archive-v2261'), false);
    assert.strictEqual(sw.includes('btc-archive-v2260'), false);
    assert.strictEqual(sw.includes('btc-archive-v2255'), false);
    assert.strictEqual(sw.includes('btc-archive-v2254'), false);
    assert.strictEqual(sw.includes('btc-archive-v2253'), false);
    assert.strictEqual(sw.includes('btc-archive-v2252'), false);
    assert.strictEqual(sw.includes('btc-archive-v2251'), false);
    assert.strictEqual(sw.includes('btc-archive-v2250'), false);
    assert.strictEqual(sw.includes('btc-archive-v2249'), false);
    assert.strictEqual(sw.includes('btc-archive-v2248'), false);
    assert.strictEqual(sw.includes('btc-archive-v2246'), false);
    assert.strictEqual(sw.includes('btc-archive-v2245'), false);
    assert.strictEqual(sw.includes('btc-archive-v2242'), false);
    assert.strictEqual(sw.includes('btc-archive-v2240'), false);
    const bundle = read('bundle.min.js');
    assert.ok(bundle.includes('data-peer-busy'), 'bundle.min.js was not rebuilt from messaging.js');
}));

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
