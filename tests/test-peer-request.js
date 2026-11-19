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
    var messaging = read('messaging.js');
    [
        'window._peerActionSafeId = function',
        'window._ensurePeerActionStyles = function',
        'window._peerBtnCss = function',
        'window._paintPeerAction = function',
        'window._refreshPeerActionBtn = async function',
        'window._sendPeerRequest = async function',
        'window._unsendPeerRequest = function',
        'window._confirmUnsendPeer = function',
        'window._doUnsendPeerRequest = async function'
    ].forEach(function(sig) {
        vm.runInContext(extractFunction(messaging, sig), sandbox);
    });
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

queue.push(test('profile send shows a pending state, then Request sent after the callable', async function() {
    const h = harness();
    const btn = mockBtn('🧡 Add Peer');
    const pending = h.sandbox.window._sendPeerRequest(btn, 'peer-1234');
    assert.strictEqual(btn.textContent, 'Sending…');
    assert.strictEqual(btn.disabled, true);
    assert.strictEqual(btn._busy, '1');
    assert.deepStrictEqual(h.state.toasts, []);
    assert.strictEqual(h.state.calls.length, 1);
    assert.strictEqual(h.state.calls[0].data.action, 'send');
    assert.strictEqual(h.state.calls[0].data.targetUid, 'peer-1234');
    h.state.release({ data: { success: true } });
    await pending;
    assert.strictEqual(btn.textContent, 'Request sent ✓');
    assert.strictEqual(btn.disabled, true);
    assert.deepStrictEqual(h.state.toasts, ['Request sent ✓']);
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
    assert.ok(h.state.toasts.indexOf('Too many pending requests. Unsend some first.') !== -1);
}));

queue.push(test('profile send maps already-exists to peers, incoming, or request sent', async function() {
    const peers = harness();
    const btn = mockBtn('🧡 Add Peer');
    const pending = peers.sandbox.window._sendPeerRequest(btn, 'peer-1234');
    peers.state.fail(Object.assign(new Error('Already peers'), { code: 'functions/already-exists' }));
    await pending;
    assert.strictEqual(btn.textContent, '🧡 Peers');
    assert.strictEqual(btn.disabled, true);
    assert.ok(peers.sandbox.window._myPeers.has('peer-1234'));

    const incoming = harness();
    const btnIn = mockBtn('🧡 Add Peer');
    const pendingIn = incoming.sandbox.window._sendPeerRequest(btnIn, 'peer-1234');
    incoming.state.fail(Object.assign(new Error('This user already sent you a request — check your notifications'), { code: 'functions/already-exists' }));
    await pendingIn;
    assert.strictEqual(btnIn.textContent, 'Accept');
    assert.strictEqual(btnIn.disabled, false);

    const sent = harness();
    const btn2 = mockBtn('🧡 Add Peer');
    const pending2 = sent.sandbox.window._sendPeerRequest(btn2, 'peer-1234');
    sent.state.fail(new Error('already-exists'));
    await pending2;
    assert.strictEqual(btn2.textContent, 'Request sent ✓');
    assert.strictEqual(btn2.disabled, true);
    assert.deepStrictEqual(sent.state.toasts, ['Request already sent']);
}));

queue.push(test('profile unsend cancels the request and resend is allowed', async function() {
    const h = harness();
    const btn = mockBtn('🧡 Add Peer');
    const sending = h.sandbox.window._sendPeerRequest(btn, 'peer-1234');
    h.state.release({ data: { success: true } });
    await sending;
    assert.strictEqual(btn.textContent, 'Request sent ✓');

    h.state.mode = 'pending';
    h.state.calls.length = 0;
    h.state.toasts.length = 0;
    const unsending = h.sandbox.window._doUnsendPeerRequest('peer-1234', btn);
    assert.strictEqual(btn.textContent, 'Unsending…');
    assert.strictEqual(h.state.calls.length, 1);
    assert.strictEqual(h.state.calls[0].data.action, 'cancel');
    assert.strictEqual(h.state.calls[0].data.targetUid, 'peer-1234');
    assert.deepStrictEqual(h.state.toasts, []);
    h.state.release({ data: { success: true } });
    await unsending;
    assert.strictEqual(btn.textContent, '🧡 Add Peer');
    assert.strictEqual(btn.disabled, false);
    assert.deepStrictEqual(h.state.toasts, ['Request unsent']);

    h.state.mode = 'pending';
    h.state.calls.length = 0;
    h.state.toasts.length = 0;
    const resend = h.sandbox.window._sendPeerRequest(btn, 'peer-1234');
    assert.strictEqual(btn.textContent, 'Sending…');
    assert.strictEqual(h.state.calls[0].data.action, 'send');
    h.state.release({ data: { success: true } });
    await resend;
    assert.strictEqual(btn.textContent, 'Request sent ✓');
    assert.deepStrictEqual(h.state.toasts, ['Request sent ✓']);
}));

queue.push(test('reopening a profile paints a pending outgoing request as already sent', async function() {
    const h = harness();
    const btn = mockBtn('🧡 Add Peer');
    h.sandbox.document = {
        getElementById: function() { return btn; }
    };
    h.sandbox.db = {
        collection: function() {
            return {
                doc: function(id) {
                    return {
                        get: function() {
                            if (id === 'me_peer-1234') {
                                return Promise.resolve({ exists: true, data: function() { return { status: 'pending', from: 'me', to: 'peer-1234' }; } });
                            }
                            return Promise.resolve({ exists: false, data: function() { return {}; } });
                        }
                    };
                }
            };
        }
    };
    await h.sandbox.window._refreshPeerActionBtn('peer-1234');
    assert.strictEqual(btn.textContent, 'Request sent ✓');
    assert.strictEqual(btn.disabled, true);
}));

queue.push(test('managePeer send, accept, decline, and remove update labels and toast after the callable', async function() {
    const h = harness();
    const cases = [
        ['send', 'Sending…', 'Request sent ✓', 'Request sent ✓'],
        ['accept', '🧡 Accepted!', '🧡 Accepted!', 'Peer accepted! 🧡'],
        ['decline', 'Declined', 'Declined', 'Request declined'],
        ['remove', 'Removed', 'Removed', 'Peer removed']
    ];
    for (const row of cases) {
        h.state.calls.length = 0;
        h.state.toasts.length = 0;
        h.state.events.length = 0;
        h.sandbox.window._peerInflight = {};
        const btn = mockBtn(row[0]);
        const pending = h.sandbox.window.managePeer(row[0], 'peer-1234', btn);
        assert.strictEqual(btn.textContent, row[1], row[0] + ' pending label');
        assert.strictEqual(btn.disabled, true);
        assert.deepStrictEqual(h.state.toasts, [], row[0] + ' no early toast');
        assert.strictEqual(h.state.calls.length, 1);
        assert.strictEqual(h.state.calls[0].data.action, row[0]);
        h.state.release({ data: { success: true } });
        await pending;
        assert.strictEqual(btn.textContent, row[2], row[0] + ' done label');
        assert.strictEqual(h.state.toasts[0], row[3], row[0] + ' toast');
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

queue.push(test('profile and notification UI keep a pending request visible', function() {
    const messaging = read('messaging.js');
    assert.ok(messaging.includes('Request sent ✓'));
    assert.ok(messaging.includes('Unsend request'));
    assert.ok(messaging.includes("Couldn't send. Try again".replace("'", "\\'")) || messaging.includes("Couldn\\'t send. Try again") || messaging.indexOf('Couldn') !== -1 && messaging.indexOf('send. Try again') !== -1);
    assert.ok(messaging.includes('_refreshPeerActionBtn'));
    assert.ok(messaging.includes("action: 'cancel'"));
    assert.ok(messaging.includes('min-height:44px'));
    const ranking = read('ranking.js');
    assert.ok(ranking.includes("var openPeers = (tab === 'peers')"));
    assert.ok(ranking.includes('Incoming Requests'));
    assert.ok(ranking.includes('request') && ranking.includes('peersGiftsBadge'));
    const notifs = read('notifications.js');
    assert.ok(notifs.includes("notifType === 'peer_request'"));
    assert.ok(notifs.includes('_pendingPeerRequestItems'));
    assert.ok(notifs.includes("showSettingsPage('peers')"));
    assert.ok(notifs.includes('Could not load notifications. Try again.'));
    assert.ok(notifs.includes('^[A-Za-z0-9_.:-]+$'));
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
    assert.ok(send.includes("batch.set(db.collection('notifications').doc(notifId),"));
    assert.ok(send.includes('notifId: notifId'));
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
    assert.ok(decline.includes('deletePeerRequestNotifications'));
    const cancel = fn.slice(fn.indexOf("if (action === 'cancel')"), fn.indexOf("if (action === 'remove')"));
    assert.ok(cancel.includes('reqRef.get()') && cancel.includes('reqRef.delete()'));
    assert.ok(cancel.includes('deletePeerRequestNotifications'));
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
    // The firebase-admin 14 namespace shim loads first; it only defines
    // helpers and never touches Firestore, so skip it when finding the
    // first ./src module.
    const shim = "require('./src/firebaseAdmin.js')";
    assert.ok(src.indexOf(shim) < 0 || src.indexOf(shim) < src.indexOf(call));
    const firstSrc = src.replace(shim, '').indexOf("require('./src/");
    assert.ok(src.replace(shim, '').indexOf(call) < firstSrc);
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
    assert.ok(html.includes('ranking.js?v=20261119_v2620'));
    assert.ok(html.includes('notifications.js?v=20261119_v2620'));
    assert.ok(html.includes('bundle.min.js?v=20261119_v2620'));
    assert.strictEqual((html.match(/bundle\.min\.js\?v=20261119_v2620/g) || []).length, 2);
    assert.ok(!html.includes('ranking.js?v=20261118_v2605'));
    assert.ok(!html.includes('bundle.min.js?v=20261118_v2602'));
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2620'"));
    assert.ok(!sw.includes("const CACHE_NAME = 'btc-archive-v2605'"));
}));

queue.push(test('inventory explains sending keys and only hints when there are no peers', async function() {
    const src = read('gifting.js');
    assert.ok(src.includes("'(You need to send Peer Requests first)!'"));
    assert.ok(src.includes("'How does sending keys work?'"));
    assert.ok(src.includes("createElement('details')"));
    assert.ok(src.includes('Add Peer'));
    assert.ok(src.includes('you can accept them there'));
    assert.ok(!src.includes('only lists requests'));
    assert.ok(src.includes('.kc-key-note{flex:1 1 12rem;min-width:min(100%,12rem);font-size:0.75rem;'));
    assert.ok(src.includes('.kc-send-hint{margin:0;font-size:0.75rem;'));
    assert.ok(!src.includes("panel.style.zIndex = '460000'"));
    assert.ok(src.includes('openGlobalChatForCipher'));
    assert.ok(src.includes('No peers yet. Open "How does sending keys work?" above.'));
    assert.ok(src.includes('until 5:00 UTC on the next UTC date'));
    assert.ok(src.includes('1 to 3 keys'));
    const sendAt = src.indexOf('send.onclick = function() { window.showPeerPickerForKeys(ids); }');
    const hintAt = src.indexOf('if (peerCount === 0)');
    assert.ok(sendAt > 0 && hintAt > sendAt);
    const hintBlock = src.slice(hintAt, hintAt + 600);
    assert.strictEqual(hintBlock.includes('disabled'), false);

    async function render(peerList, labels) {
        const nodes = [];
        function create(tag) {
            const node = {
                tagName: String(tag).toUpperCase(),
                children: [],
                style: {},
                className: '',
                id: '',
                textContent: '',
                type: '',
                disabled: false,
                open: false,
                onclick: null,
                attributes: {},
                parentNode: null,
                appendChild: function(child) { child.parentNode = node; node.children.push(child); return child; },
                remove: function() {},
                setAttribute: function(k, v) { node.attributes[k] = String(v); },
                getAttribute: function(k) { return node.attributes[k]; },
                addEventListener: function() {},
                focus: function() {},
            };
            Object.defineProperty(node, 'innerHTML', {
                configurable: true,
                get: function() { return node._html || ''; },
                set: function(v) { node._html = String(v); if (v === '') node.children.length = 0; },
            });
            nodes.push(node);
            return node;
        }
        const document = {
            createElement: create,
            head: create('head'),
            body: create('body'),
            getElementById: function(id) {
                for (let i = 0; i < nodes.length; i++) if (nodes[i].id === id) return nodes[i];
                return null;
            },
            querySelectorAll: function() { return []; },
        };
        function docs(rows) {
            return {
                docs: rows.map(function(row) {
                    return { id: row.id, data: function() { const copy = Object.assign({}, row); delete copy.id; return copy; } };
                }),
                empty: rows.length === 0,
                size: rows.length,
                forEach: function() {},
            };
        }
        function query(name, filters) {
            const q = {
                where: function(field, op, value) { return query(name, filters.concat([{ field: field, value: value }])); },
                limit: function() { return q; },
                get: function() {
                    const status = (filters.find(function(f) { return f.field === 'status'; }) || {}).value;
                    if (name === 'keys' && status === 'inventory') {
                        return Promise.resolve(docs(labels.map(function(label, i) { return { id: 'k' + i, label: label }; })));
                    }
                    return Promise.resolve(docs([]));
                },
            };
            return q;
        }
        const sandbox = {
            console: console,
            document: document,
            setInterval: function() { return 0; },
            clearInterval: function() {},
            setTimeout: function() { return 0; },
            auth: { currentUser: { uid: 'me', isAnonymous: false } },
            db: {
                collection: function(name) {
                    return {
                        doc: function() {
                            return {
                                get: function() {
                                    return Promise.resolve({
                                        exists: true,
                                        data: function() { return { peers: peerList, satsDisabled: false }; },
                                    });
                                },
                            };
                        },
                        where: function(field, op, value) { return query(name, [{ field: field, value: value }]); },
                    };
                },
            },
        };
        sandbox.window = sandbox;
        vm.createContext(sandbox);
        vm.runInContext(read('gifting.js'), sandbox);
        const host = document.createElement('div');
        await sandbox.renderKeysAndCiphersPanel(host);
        return host;
    }
    function walk(node, visit) {
        visit(node);
        (node.children || []).forEach(function(child) { walk(child, visit); });
    }
    function texts(node) {
        const out = [];
        walk(node, function(n) { if (n.textContent) out.push(n.textContent); });
        return out.join('\n');
    }
    const zero = await render([], ['3A', '3A', '7F', '<img src=x onerror=alert(1)>']);
    const zeroText = texts(zero);
    assert.ok(zeroText.includes('(You need to send Peer Requests first)!'));
    assert.ok(zeroText.includes('How does sending keys work?'));
    assert.ok(zeroText.includes('Add Peer'));
    assert.ok(zeroText.includes('Open Global Chat'));
    assert.ok(zeroText.includes('Open Leaderboard'));
    assert.ok(zeroText.includes('No peers yet. Open "How does sending keys work?" above.'));
    assert.ok(zeroText.includes('<img src=x onerror=alert(1)>'));
    assert.ok(!zeroText.includes('innerHTML'));
    let details = null;
    let sends = 0;
    walk(zero, function(n) {
        if (n.tagName === 'DETAILS') details = n;
        if (n.className === 'key-send-btn') {
            sends++;
            assert.strictEqual(n.disabled, false);
            assert.strictEqual(typeof n.onclick, 'function');
            assert.ok(n.attributes['aria-describedby']);
        }
        if (n.tagName === 'IMG') assert.fail('key label was parsed as HTML');
    });
    assert.ok(details);
    assert.strictEqual(details.open, false);
    assert.strictEqual(sends, 3);

    const some = await render(['peer-1'], ['F6']);
    const someText = texts(some);
    assert.ok(!someText.includes('No peers yet'));
    walk(some, function(n) {
        if (n.className === 'key-send-btn') {
            assert.strictEqual(n.disabled, false);
            assert.strictEqual(n.attributes['aria-describedby'], undefined);
        }
    });
}));

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
