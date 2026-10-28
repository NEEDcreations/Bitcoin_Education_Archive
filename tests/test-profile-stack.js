// Add Peer stays above a leaderboard or chat panel that was raised above
// the profile, at phone widths. elementFromPoint is the real hit test.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');
const net = require('net');

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

test('peer count uses a loaded list and panels drop a raised z-index on close', function() {
    const gifting = read('gifting.js');
    const countFn = gifting.slice(gifting.indexOf('async function _readPeerCount'), gifting.indexOf('function _copy'));
    const fetchAt = countFn.indexOf("db.collection('users')");
    assert.ok(fetchAt > 0);
    assert.ok(countFn.indexOf('return window._myPeers.size') > 0);
    assert.ok(countFn.indexOf('return window._myPeers.size') < fetchAt);
    assert.ok(countFn.indexOf('return currentUser.peers.length') > 0);
    assert.ok(countFn.indexOf('return currentUser.peers.length') < fetchAt);
    assert.ok(gifting.includes("modal.style.zIndex = '2300000'"));
    assert.ok(!gifting.includes("zIndex = '460000'"));
    assert.ok(gifting.includes('you can accept them there'));

    const ranking = read('ranking.js');
    assert.ok(ranking.includes('function _resetLeaderboardZ(lb)'));
    assert.strictEqual((ranking.match(/_resetLeaderboardZ\(lb\)/g) || []).length, 5);
    const chat = read('global-chat.js');
    assert.strictEqual((chat.match(/panel\.style\.zIndex = '250000'/g) || []).length, 2);

    function userGetsFor(setup) {
        let gets = 0;
        function chain() {
            const q = {
                where: function() { return q; },
                limit: function() { return q; },
                get: function() {
                    return Promise.resolve({ docs: [], empty: true, size: 0, forEach: function() {} });
                },
            };
            return q;
        }
        const document = {
            createElement: function() {
                const node = {
                    style: {}, className: '', id: '', textContent: '', children: [],
                    appendChild: function(child) { node.children.push(child); return child; },
                    setAttribute: function() {},
                    addEventListener: function() {},
                };
                Object.defineProperty(node, 'innerHTML', { set: function() {}, get: function() { return ''; } });
                return node;
            },
            getElementById: function() { return null; },
            querySelectorAll: function() { return []; },
            head: { appendChild: function() {} },
            body: { appendChild: function() {} },
        };
        const sandbox = {
            console: console,
            document: document,
            setInterval: function() { return 0; },
            clearInterval: function() {},
            setTimeout: function() { return 0; },
            auth: { currentUser: { uid: 'me', isAnonymous: false } },
            currentUser: setup.currentUser,
            db: {
                collection: function(name) {
                    return {
                        doc: function() {
                            return {
                                get: function() {
                                    if (name === 'users') gets++;
                                    return Promise.resolve({
                                        exists: true,
                                        data: function() { return { peers: ['server-peer'], satsDisabled: false }; },
                                    });
                                },
                            };
                        },
                        where: function() { return chain(); },
                    };
                },
            },
        };
        sandbox.window = sandbox;
        if (setup.peers) sandbox._myPeers = setup.peers;
        vm.createContext(sandbox);
        vm.runInContext(read('gifting.js'), sandbox);
        const host = document.createElement('div');
        return sandbox.renderKeysAndCiphersPanel(host).then(function() { return gets; });
    }

    return Promise.all([
        userGetsFor({ peers: new Set(['a', 'b']), currentUser: {} }),
        userGetsFor({ currentUser: { peers: ['a'] } }),
        userGetsFor({ currentUser: {} }),
    ]).then(function(got) {
        assert.strictEqual(got[0], 1, 'loaded _myPeers still read users ' + got[0] + ' times');
        assert.strictEqual(got[1], 1, 'loaded currentUser.peers still read users ' + got[1] + ' times');
        assert.strictEqual(got[2], 2, 'missing peers should read the user doc once');
    });
});

function pageHtml() {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body>
<style>
  #usernameModal { display:none; position:fixed; inset:0; z-index:2100008; background:#111; }
  #usernameModal.open { display:block; }
  #questHubOverlay { position:fixed; inset:0; z-index:450000; background:#222; }
  #leaderboard { display:none; position:fixed; right:20px; bottom:20px; width:340px; max-height:70vh; z-index:300000; background:#333; }
  #leaderboard.open { display:block; }
  @media (max-width:900px) {
    #leaderboard { right:10px; left:10px; bottom:10px; width:auto; max-height:60vh; }
  }
  #chatOverlay { position:fixed; bottom:0; left:0; right:0; height:92vh; z-index:250000; background:#444; transform:translateY(100%); }
  #addPeerBtn { position:fixed; left:24px; bottom:24px; width:140px; height:44px; }
</style>
<div id="usernameModal" class="open"></div>
<div id="questHubOverlay"></div>
<div id="leaderboard"></div>
<div id="chatOverlay"></div>
<div id="host"></div>
<pre id="stack-result">PENDING</pre>
<script>
  window._chatOverlayOpen = false;
  window.toggleChatOverlay = function() {
    window._chatOverlayOpen = !window._chatOverlayOpen;
    var panel = document.getElementById('chatOverlay');
    panel.style.transform = window._chatOverlayOpen ? 'translateY(0)' : 'translateY(100%)';
  };
  window.toggleLeaderboard = function() {
    var lb = document.getElementById('leaderboard');
    if (lb.classList.contains('open') && !lb.classList.contains('minimized')) {
      lb.classList.remove('open');
      lb.classList.remove('minimized');
      return;
    }
    lb.classList.remove('minimized');
    lb.classList.add('open');
  };
  window._closeQuestScreen = function() {
    var hub = document.getElementById('questHubOverlay');
    if (hub) hub.remove();
  };
  window.showUserProfile = function() {
    var old = document.getElementById('userProfileModal');
    if (old) old.remove();
    var modal = document.createElement('div');
    modal.id = 'userProfileModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:400000;background:rgba(0,0,0,0.7);';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'addPeerBtn';
    btn.textContent = 'Add Peer';
    modal.appendChild(btn);
    document.body.appendChild(modal);
  };
  window.auth = { currentUser: { uid: 'me', isAnonymous: false } };
  window.currentUser = { peers: [] };
  window._myPeers = new Set();
  function emptySnap() {
    return Promise.resolve({ docs: [], empty: true, size: 0, exists: true, forEach: function() {}, data: function() { return { peers: [], satsDisabled: false }; } });
  }
  function chain() {
    var q = { where: function() { return q; }, limit: function() { return q; }, get: function() { return emptySnap(); } };
    return q;
  }
  window.db = {
    collection: function() {
      return { doc: function() { return { get: function() { return emptySnap(); } }; }, where: function() { return chain(); } };
    }
  };
</script>
<script src="gifting.js"></script>
<script>
  function arm(which) {
    var settings = document.getElementById('usernameModal');
    if (!settings) {
      settings = document.createElement('div');
      settings.id = 'usernameModal';
      document.body.appendChild(settings);
    }
    settings.classList.add('open');
    if (!document.getElementById('questHubOverlay')) {
      var hub = document.createElement('div');
      hub.id = 'questHubOverlay';
      hub.style.cssText = 'position:fixed;inset:0;z-index:450000;background:#222;';
      document.body.appendChild(hub);
    }
    var old = document.getElementById('userProfileModal');
    if (old) old.remove();
    if (which === 'leaderboard') {
      var lb = document.getElementById('leaderboard');
      lb.classList.remove('open');
      lb.style.zIndex = '460000';
      var chat = document.getElementById('chatOverlay');
      chat.style.transform = 'translateY(100%)';
      window._chatOverlayOpen = false;
    } else {
      var panel = document.getElementById('chatOverlay');
      panel.style.zIndex = '460000';
      panel.style.transform = 'translateY(100%)';
      window._chatOverlayOpen = false;
      document.getElementById('leaderboard').classList.remove('open');
    }
  }
  function buttonIn(root, text) {
    var buttons = root.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) if (buttons[i].textContent === text) return buttons[i];
    return null;
  }
  function hit() {
    var btn = document.getElementById('addPeerBtn');
    var rect = btn.getBoundingClientRect();
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;
    var top = document.elementFromPoint(x, y);
    var onButton = !!(top && (top === btn || btn.contains(top)));
    return {
      onButton: onButton,
      id: top && top.id,
      text: top && (top.textContent || '').slice(0, 40),
      width: window.innerWidth,
      height: window.innerHeight,
      x: Math.round(x),
      y: Math.round(y),
      bw: Math.round(rect.width),
      bh: Math.round(rect.height)
    };
  }
  function closePanel(which) {
    if (which === 'leaderboard') {
      var lb = document.getElementById('leaderboard');
      if (lb.classList.contains('open')) window.toggleLeaderboard();
      return lb.style.zIndex;
    }
    if (window._chatOverlayOpen) window.toggleChatOverlay();
    return document.getElementById('chatOverlay').style.zIndex;
  }
  (async function() {
    var out = { width: window.innerWidth, height: window.innerHeight, cases: {} };
    try {
      var host = document.getElementById('host');
      await window.renderKeysAndCiphersPanel(host);
      var help = document.getElementById('keySendHelp');
      var cases = [
        ['explainer-leaderboard', 'leaderboard', function() { buttonIn(help, 'Open Leaderboard').click(); }],
        ['explainer-chat', 'chat', function() { buttonIn(help, 'Open Global Chat').click(); }],
      ];
      for (var i = 0; i < cases.length; i++) {
        var name = cases[i][0];
        var which = cases[i][1];
        arm(which);
        cases[i][2]();
        window.showUserProfile('peer-1');
        await new Promise(function(r) { setTimeout(r, 450); });
        var seen = hit();
        var zAfter = closePanel(which);
        out.cases[name] = { hit: seen, zAfterClose: zAfter, settingsOpen: document.getElementById('usernameModal').classList.contains('open'), hub: !!document.getElementById('questHubOverlay') };
      }
      arm('leaderboard');
      await window.showPeerPickerForKeys(['k1']);
      buttonIn(document.getElementById('peerPickerOverlay'), 'Open Leaderboard').click();
      window.showUserProfile('peer-1');
      await new Promise(function(r) { setTimeout(r, 450); });
      out.cases['picker-leaderboard'] = { hit: hit(), zAfterClose: closePanel('leaderboard') };
      arm('chat');
      await window.showPeerPickerForKeys(['k1']);
      buttonIn(document.getElementById('peerPickerOverlay'), 'Open Global Chat').click();
      window.showUserProfile('peer-1');
      await new Promise(function(r) { setTimeout(r, 450); });
      out.cases['picker-chat'] = { hit: hit(), zAfterClose: closePanel('chat') };
    } catch (e) {
      out.error = String(e && e.stack || e);
    }
    document.getElementById('stack-result').textContent = JSON.stringify(out);
  })();
</script>
</body></html>`;
}

function freePort() {
    return new Promise(function(resolve, reject) {
        const server = net.createServer();
        server.listen(0, '127.0.0.1', function() {
            const port = server.address().port;
            server.close(function() { resolve(port); });
        });
        server.on('error', reject);
    });
}

function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
}

// Node 22 has a global WebSocket. Node 20 does not, so use the ws package
// when it is installed. Without either, the hit tests skip instead of throwing.
function devtoolsWebSocket() {
    if (devtoolsWebSocket.ctor !== undefined) return devtoolsWebSocket.ctor;
    if (typeof globalThis.WebSocket === 'function') {
        devtoolsWebSocket.ctor = globalThis.WebSocket;
        devtoolsWebSocket.pkg = false;
        return devtoolsWebSocket.ctor;
    }
    try {
        devtoolsWebSocket.ctor = require('ws');
        devtoolsWebSocket.pkg = true;
    } catch (e) {
        devtoolsWebSocket.ctor = null;
        devtoolsWebSocket.pkg = false;
    }
    return devtoolsWebSocket.ctor;
}

function openDevtoolsSocket(url) {
    var Ctor = devtoolsWebSocket();
    if (!Ctor) return null;
    var ws = new Ctor(url);
    var pkg = devtoolsWebSocket.pkg;
    return {
        send: function(data) { ws.send(data); },
        close: function() { try { ws.close(); } catch (e) {} },
        ready: new Promise(function(resolve, reject) {
            function fail(err) { reject(err instanceof Error ? err : new Error('websocket error')); }
            if (!pkg && typeof ws.addEventListener === 'function') {
                ws.addEventListener('open', function() { resolve(); });
                ws.addEventListener('error', fail);
                return;
            }
            ws.on('open', function() { resolve(); });
            ws.on('error', fail);
        }),
        onMessage: function(fn) {
            function text(data) { return typeof data === 'string' ? data : String(data); }
            if (!pkg && typeof ws.addEventListener === 'function') {
                ws.addEventListener('message', function(ev) { fn(text(ev && ev.data)); });
                return;
            }
            ws.on('message', function(data) { fn(text(data)); });
        }
    };
}

async function runChrome(width) {
    const dir = fs.mkdtempSync(path.join('/tmp', 'profile-stack-'));
    fs.writeFileSync(path.join(dir, 'index.html'), pageHtml());
    fs.symlinkSync(path.join(root, 'gifting.js'), path.join(dir, 'gifting.js'));
    const port = await freePort();
    const child = spawn('google-chrome', [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--allow-file-access-from-files',
        '--hide-scrollbars',
        '--remote-debugging-port=' + port,
        '--user-data-dir=' + path.join(dir, 'chrome'),
        'about:blank',
    ], { stdio: 'ignore' });
    try {
        let version = null;
        for (let i = 0; i < 50; i++) {
            try {
                const res = await fetch('http://127.0.0.1:' + port + '/json/version');
                if (res.ok) { version = await res.json(); break; }
            } catch (e) { /* chrome is still starting */ }
            await sleep(100);
        }
        if (!version) throw new Error('chrome did not open a debugging port');
        let target = null;
        for (let i = 0; i < 20 && !target; i++) {
            const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
            target = list.find(function(item) { return item.type === 'page' && item.webSocketDebuggerUrl; });
            if (!target) await sleep(100);
        }
        if (!target || !target.webSocketDebuggerUrl) throw new Error('no chrome page target');
        const ws = openDevtoolsSocket(target.webSocketDebuggerUrl);
        if (!ws) throw new Error('WebSocket is not defined and require("ws") failed');
        await ws.ready;
        let nextId = 0;
        const pending = new Map();
        ws.onMessage(function(data) {
            const msg = JSON.parse(data);
            if (!msg.id || !pending.has(msg.id)) return;
            const waiter = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) waiter.reject(new Error(JSON.stringify(msg.error)));
            else waiter.resolve(msg.result);
        });
        function send(method, params) {
            const id = ++nextId;
            return new Promise(function(resolve, reject) {
                pending.set(id, { resolve: resolve, reject: reject });
                ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
            });
        }
        await send('Page.enable');
        await send('Emulation.setDeviceMetricsOverride', {
            width: width,
            height: 800,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await send('Page.navigate', { url: 'file://' + path.join(dir, 'index.html') });
        let text = 'PENDING';
        let last = '';
        for (let i = 0; i < 50; i++) {
            await sleep(200);
            const evaled = await send('Runtime.evaluate', {
                expression: "(function(){ var el = document.getElementById('stack-result'); var raw = el ? el.textContent : ''; return JSON.stringify({ raw: raw || '', width: window.innerWidth }); })()",
                returnByValue: true,
            });
            const snap = JSON.parse(evaled.result.value);
            last = snap.raw + ' @' + snap.width;
            if (snap.raw && snap.raw !== 'PENDING' && snap.width === width) {
                text = snap.raw;
                break;
            }
        }
        ws.close();
        if (!text || text === 'PENDING') throw new Error('stack result still pending (' + last + ')');
        return JSON.parse(text);
    } finally {
        child.kill('SIGKILL');
    }
}

[390, 320].forEach(function(width) {
    test('Add Peer is the hit target from leaderboard and chat at ' + width + 'px', async function() {
        if (!devtoolsWebSocket()) {
            console.log('skip: Add Peer hit target at ' + width + 'px — this Node has no global WebSocket and require("ws") failed. Node 22 provides WebSocket; Node 20 needs the ws package.');
            return;
        }
        const result = await runChrome(width);
        if (result.error) throw new Error(result.error);
        assert.strictEqual(result.width, width, 'innerWidth ' + result.width);
        ['explainer-leaderboard', 'explainer-chat', 'picker-leaderboard', 'picker-chat'].forEach(function(name) {
            const row = result.cases[name];
            assert.ok(row, 'missing ' + name);
            assert.strictEqual(row.hit.onButton, true, name + ' hit ' + JSON.stringify(row.hit));
            assert.ok(row.hit.bw > 0 && row.hit.bh > 0, name + ' button has no box');
            if (name.indexOf('leaderboard') !== -1) assert.strictEqual(row.zAfterClose, '', name + ' z-index ' + row.zAfterClose);
            else assert.strictEqual(row.zAfterClose, '250000', name + ' z-index ' + row.zAfterClose);
        });
        assert.strictEqual(result.cases['explainer-leaderboard'].settingsOpen, false);
        assert.strictEqual(result.cases['explainer-leaderboard'].hub, false);
        assert.strictEqual(result.cases['explainer-chat'].settingsOpen, false);
        assert.strictEqual(result.cases['explainer-chat'].hub, false);
    });
});

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
