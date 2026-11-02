// Keys and ciphers with the same label and sender share one row.
// Opening or sending still uses the underlying items one at a time.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) {
    queue.push(Promise.resolve().then(fn).then(function() {
        console.log('✅ ' + name);
        passed++;
    }, function(e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
    }));
}

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

function item(id, label, extra) {
    return Object.assign({ id: id, label: label, status: 'inventory', sentBy: null, sentByName: null }, extra || {});
}

async function render(holdings, hooks) {
    const nodes = [];
    function create(tag) {
        const node = {
            tagName: String(tag || 'div').toUpperCase(),
            style: {},
            className: '',
            id: '',
            textContent: '',
            type: '',
            disabled: false,
            open: false,
            onclick: null,
            attributes: {},
            children: [],
            childNodes: [],
            parentNode: null,
            nodeType: 1,
            appendChild: function(child) {
                child.parentNode = node;
                node.children.push(child);
                node.childNodes.push(child);
                return child;
            },
            removeChild: function(child) {
                node.children = node.children.filter(function(c) { return c !== child; });
                node.childNodes = node.childNodes.filter(function(c) { return c !== child; });
                child.parentNode = null;
                return child;
            },
            remove: function() {
                if (node.parentNode) node.parentNode.removeChild(node);
            },
            setAttribute: function(k, v) {
                node.attributes[k] = String(v);
                if (k === 'id') node.id = String(v);
            },
            getAttribute: function(k) { return node.attributes[k]; },
            addEventListener: function() {},
            focus: function() {},
        };
        Object.defineProperty(node, 'innerHTML', {
            configurable: true,
            get: function() { return node._html || ''; },
            set: function(v) {
                node._html = String(v);
                if (v === '') {
                    node.children.length = 0;
                    node.childNodes.length = 0;
                }
            },
        });
        nodes.push(node);
        return node;
    }
    const document = {
        createElement: create,
        head: create('head'),
        body: create('body'),
        activeElement: null,
        getElementById: function(id) {
            for (let i = 0; i < nodes.length; i++) if (nodes[i].id === id) return nodes[i];
            return null;
        },
        querySelectorAll: function() { return []; },
    };
    function docs(rows) {
        return {
            docs: rows.map(function(row) {
                return {
                    id: row.id,
                    data: function() {
                        const copy = Object.assign({}, row);
                        delete copy.id;
                        return copy;
                    },
                };
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
                const label = (filters.find(function(f) { return f.field === 'label'; }) || {}).value;
                let rows = [];
                if (name === 'keys' && status === 'inventory') rows = holdings.own;
                else if (name === 'keys' && status === 'sent') rows = holdings.peer;
                else if (name === 'locked_ciphers') rows = holdings.ciphers;
                if (label) rows = rows.filter(function(row) { return row.label === label; });
                return Promise.resolve(docs(rows));
            },
        };
        return q;
    }
    const calls = { open: [], send: [] };
    const sandbox = {
        console: console,
        document: document,
        setInterval: setInterval,
        clearInterval: clearInterval,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        audioEnabled: false,
        auth: { currentUser: { uid: 'me', isAnonymous: false } },
        currentUser: { peers: ['p1'], satsDisabled: false },
        _myPeers: new Set(['p1']),
        showToast: function() {},
        firebase: {
            functions: function() {
                return {
                    httpsCallable: function(name) {
                        return function() {
                            if (name === 'decryptCipher') {
                                return Promise.resolve({ data: { reward: { rewardType: 'xp_bonus', xpAmount: 50 } } });
                            }
                            return Promise.resolve({ data: { wins: [] } });
                        };
                    },
                };
            },
        },
        db: {
            collection: function(name) {
                return {
                    doc: function() {
                        return {
                            get: function() {
                                return Promise.resolve({
                                    exists: true,
                                    data: function() { return { peers: ['p1'], satsDisabled: false, username: 'Bitcoiner' }; },
                                });
                            },
                        };
                    },
                    where: function(field, op, value) { return query(name, [{ field: field, value: value }]); },
                };
            },
        },
        addEventListener: function() {},
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(read('gifting.js'), sandbox);
    const origOpen = sandbox.openCipherWithMatch;
    sandbox.openCipherWithMatch = function(cipherId, label) {
        calls.open.push({ cipherId: cipherId, label: label });
        return origOpen(cipherId, label);
    };
    sandbox.showPeerPickerForKeys = function(ids) { calls.send.push(ids.slice()); };
    if (hooks && hooks.beforeRender) hooks.beforeRender(sandbox);
    const host = document.createElement('div');
    host.id = 'nookKeysCiphers';
    await sandbox.renderKeysAndCiphersPanel(host);
    return { host: host, nodes: nodes, calls: calls, sandbox: sandbox };
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

function countCards(node) {
    let n = 0;
    walk(node, function(el) { if (el.className === 'kc-card') n++; });
    return n;
}

test('repeated keys and ciphers group by label and sender', async function() {
    const nasty = 'Ada<img src=x onerror=alert(1)>';
    const view = await render({
        own: [
            item('o1', '7F'), item('o2', '7F'), item('o3', '7F'), item('o4', '7F'), item('o5', '7F'),
            item('o6', 'B2'),
            item('o7', '3A'), item('o8', '3A'),
        ],
        peer: [
            item('p1', '7F', { status: 'sent', sentBy: 'uid-krs', sentByName: 'KRSc21' }),
            item('p2', '7F', { status: 'sent', sentBy: 'uid-krs', sentByName: 'KRSc21' }),
            item('p3', '7F', { status: 'sent', sentBy: 'uid-krs', sentByName: 'KRSc21' }),
            item('p4', 'B2', { status: 'sent', sentBy: 'uid-krs', sentByName: 'KRSc21' }),
            item('p5', '7F', { status: 'sent', sentBy: 'uid-ada', sentByName: nasty }),
            item('p6', '7F', { status: 'sent', sentBy: 'uid-ada', sentByName: nasty }),
            item('p7', 'C9', { status: 'sent', sentBy: 'uid-krs', sentByName: 'KRSc21' }),
        ],
        ciphers: [
            item('c1', '7F'), item('c2', '7F'), item('c3', '7F'),
            item('c4', 'B2'),
            item('c5', 'C4'), item('c6', 'C4'),
        ],
    });
    const text = texts(view.host);
    assert.ok(text.includes('🔑 7F ×5'), text);
    assert.ok(text.includes('🔑 3A ×2'), text);
    assert.ok(text.includes('🔑 B2'), text);
    assert.ok(!text.includes('🔑 B2 ×'), text);
    assert.ok(text.includes('7F ×3 from KRSc21'), text);
    assert.ok(text.includes('B2 from KRSc21'), text);
    assert.ok(!text.includes('B2 ×1'), text);
    assert.ok(!text.includes('B2 ×2 from KRSc21'), text);
    assert.ok(text.includes('7F ×2 from ' + nasty), text);
    assert.ok(text.includes('C9 from KRSc21'), text);
    assert.ok(text.includes('7F ×3'), text);
    assert.ok(text.includes('C4 ×2'), text);

    let peerRows = 0;
    let sendButtons = 0;
    walk(view.host, function(n) {
        if (n.className === 'kc-copy-title' && String(n.textContent).indexOf(' from ') !== -1) peerRows++;
        if (n.tagName === 'IMG') assert.fail('username was parsed as HTML');
        if (n.className === 'key-send-btn') sendButtons++;
        if (n._html && String(n._html).indexOf(nasty) !== -1) assert.fail('username was written with innerHTML');
        if (n._html && String(n._html).indexOf('KRSc21') !== -1) assert.fail('sender was written with innerHTML');
    });
    assert.strictEqual(peerRows, 4);
    assert.strictEqual(sendButtons, 3);
    assert.ok(countCards(view.host) < 20);

    let sent = null;
    walk(view.host, function(n) {
        if (n.className !== 'key-send-btn' || !n.parentNode) return;
        const cardText = texts(n.parentNode.parentNode || n.parentNode);
        if (cardText.indexOf('7F ×5') !== -1) {
            n.onclick();
            sent = view.calls.send[view.calls.send.length - 1];
        }
    });
    assert.ok(sent, 'send button for the 7F stack did not run');
    assert.strictEqual(sent.length, 3);
    sent.forEach(function(id) {
        assert.ok(['o1', 'o2', 'o3', 'o4', 'o5'].indexOf(id) !== -1, id);
    });
});

test('opening one cipher spends one key and the grouped count drops', async function() {
    const view = await render({
        own: [item('o1', 'B2')],
        peer: [
            item('p1', '7F', { status: 'sent', sentBy: 'uid-krs', sentByName: 'KRSc21' }),
            item('p2', '7F', { status: 'sent', sentBy: 'uid-krs', sentByName: 'KRSc21' }),
            item('p3', '7F', { status: 'sent', sentBy: 'uid-krs', sentByName: 'KRSc21' }),
        ],
        ciphers: [item('c1', '7F'), item('c2', '7F'), item('c3', '7F')],
    });
    assert.ok(texts(view.host).includes('7F ×3 from KRSc21'));
    let opener = null;
    walk(view.host, function(n) {
        if (n.className !== 'cipher-open-btn' || n.textContent !== 'Open 7F') return;
        const card = n.parentNode;
        if (card && texts(card).indexOf('7F ×3 from KRSc21') !== -1) opener = n;
    });
    assert.ok(opener, 'grouped open button missing');
    opener.onclick();
    assert.strictEqual(view.calls.open.length, 1);
    assert.strictEqual(view.calls.open[0].cipherId, 'c1');
    assert.strictEqual(view.calls.open[0].label, '7F');
    assert.strictEqual(typeof view.calls.open[0].cipherId, 'string');

    const started = Date.now();
    let next = '';
    while (Date.now() - started < 4000) {
        next = texts(view.host);
        if (next.includes('7F ×2 from KRSc21') && !next.includes('7F ×3 from KRSc21')) break;
        await new Promise(function(resolve) { setTimeout(resolve, 50); });
    }
    assert.ok(next.includes('7F ×2 from KRSc21'), next);
    assert.ok(!next.includes('7F ×3 from KRSc21'), next);
    assert.ok(next.includes('7F ×2'), next);
});

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
