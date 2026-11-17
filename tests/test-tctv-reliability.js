// Timechain TV reliability: dead or stalled videos are skipped, channel loads
// are debounced and cancellable, leaving TV tears the player down, and the
// channel rows work from the keyboard. Runs the real helper block from
// timechain-tv.js inside a small stub of the TV closure.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const tv = fs.readFileSync(path.join(root, 'timechain-tv.js'), 'utf8');
const lines = tv.split('\n');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; } catch (err) { console.log('❌ ' + name + ': ' + err.message); failed++; }
}

const helperLine = lines.find(l => l.startsWith('/* TCTV reliability (SW v2589)'));
const helperIdx = lines.indexOf(helperLine);
const helperSrc = lines.slice(helperIdx, lines.findIndex((l, k) => k > helperIdx && l === 'tctvInstallKeys();') + 1).join('\n');
const schedStart = tv.indexOf('function n(i){var pv=tctvPlayable(i);');
const schedEnd = tv.indexOf('var a=null,r=null,d=null,l=null,s={};');
const schedSrc = tv.slice(schedStart, schedEnd);

function makeStations() {
    const mk = (prefix, count, dur) => Array.from({ length: count }, (_, k) => ({ id: (prefix + 'xxxxxxxxxxx').slice(0, 9) + String(k).padStart(2, '0'), title: prefix + k, duration: dur }));
    return [
        { id: 'alpha', name: 'Alpha', emoji: 'A', videos: mk('alpha', 4, 100) },
        { id: 'beta', name: 'Beta', emoji: 'B', videos: mk('beta', 3, 50) },
    ];
}

function makeSandbox(opts) {
    opts = opts || {};
    const store = Object.assign({}, opts.store || {});
    const timers = [];
    let now = opts.now || 1700000000000;
    const listeners = {};
    const calls = { load: [], create: [], toast: [], tap: 0, stuck: 0, remote: [], yi: [], switched: [] };
    const sandbox = {
        console,
        JSON, Math, Object, Array, String, Number,
        Date: { now: () => now },
        localStorage: {
            getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
        },
        setTimeout: (fn, ms) => { timers.push({ fn, at: now + (ms || 0), id: timers.length + 1 }); return timers.length; },
        clearTimeout: id => { const t = timers.find(x => x.id === id); if (t) t.cancelled = true; },
        clearInterval: () => {},
        showToast: msg => calls.toast.push(msg),
        document: {
            hidden: false,
            getElementById: () => null,
            addEventListener: (type, fn) => { listeners[type] = fn; },
        },
        navigator: {},
    };
    sandbox.window = sandbox;
    sandbox.window._tctvActive = true;
    sandbox.window.tctvRemoteChannel = d => { calls.remote.push(d); };
    vm.createContext(sandbox);
    vm.runInContext('var i=' + JSON.stringify(opts.stations || makeStations()) + ',P=null,W=null,L=!1,r="alpha",e=!1,H=!1,O=null,X=!1,j=!1,Q=!0;' +
        'function yi(s,v){__calls.yi.push([s,v&&v.id])}function _(id,off){__calls.create.push([id,off])}function li(){}function ni(){}function G(){__calls.g=(__calls.g||0)+1}function x(){}function Z(){__calls.z=(__calls.z||0)+1}', Object.assign(sandbox, { __calls: calls }));
    vm.runInContext(schedSrc, sandbox);
    vm.runInContext(helperSrc, sandbox);
    vm.runInContext('tctvSkipToastAt=-1e15', sandbox);
    sandbox.tctvShowTap = () => { calls.tap++; };
    sandbox.tctvShowStuck = () => { calls.stuck++; };
    return {
        sandbox, calls, store, listeners,
        run: src => vm.runInContext(src, sandbox),
        advance: ms => {
            now += ms;
            for (;;) {
                const due = timers.filter(t => !t.cancelled && !t.done && t.at <= now).sort((a, b) => a.at - b.at)[0];
                if (!due) break;
                due.done = true;
                due.fn();
            }
        },
        setNow: v => { now = v; },
    };
}

function readyPlayer(env, state) {
    const p = {
        state: state === undefined ? 1 : state,
        loadVideoById: (id, off) => env.calls.load.push([id, off]),
        playVideo: () => {},
        mute: () => {},
        isMuted: () => false,
        getPlayerState: () => p.state,
        getIframe: () => ({ isConnected: true }),
        destroy: () => { p.destroyed = true; },
    };
    env.sandbox.P = p;
    env.run('tctvReady=!0');
    return p;
}

test('the helper block and schedule wrapper are in timechain-tv.js', () => {
    assert.ok(helperLine, 'helper line missing');
    assert.ok(helperSrc.endsWith('tctvInstallKeys();'));
    assert.ok(schedStart > 0 && schedEnd > schedStart);
    assert.ok(helperIdx < lines.findIndex(l => l.startsWith('var p=0,m=0,T=null,S=null,f=0,w=null;')));
});

test('a clean station keeps the shared schedule untouched', () => {
    const env = makeSandbox();
    const st = env.sandbox.i[0];
    assert.strictEqual(env.run('tctvPlayable(i[0])'), st.videos);
    env.setNow(1000 * 150 * 1000 + 1000 * 10); // 150000s + 10s
    const sc = env.run('n(i[0])');
    assert.strictEqual(sc.video.id, st.videos[sc.videoIndex].id);
});

test('a bad video drops out of the schedule and guide indexes still point at the original list', () => {
    const env = makeSandbox();
    const st = env.sandbox.i[0];
    env.run('tctvMarkBad(' + JSON.stringify(st.videos[1].id) + ',!1)');
    const pv = env.run('tctvPlayable(i[0])');
    assert.strictEqual(pv.length, 3);
    assert.ok(!pv.some(v => v.id === st.videos[1].id));
    for (let t = 0; t < 300; t += 7) {
        env.setNow(t * 1000);
        const sc = env.run('n(i[0])');
        assert.notStrictEqual(sc.video.id, st.videos[1].id);
        assert.strictEqual(st.videos[sc.videoIndex].id, sc.video.id);
    }
});

test('a station where every video failed falls back to the full list', () => {
    const env = makeSandbox();
    env.run('i[1].videos.forEach(function(v){tctvMarkBad(v.id,!1)})');
    assert.strictEqual(env.run('tctvPlayable(i[1])').length, 3);
});

test('hard errors persist only after the next video really plays, with TTL and a cap', () => {
    const now = 1700000000000;
    const old = { abcdefghij0: now - 8 * 864e5, abcdefghij1: now - 864e5, 'bad id': now };
    const env = makeSandbox({ now, store: { tctv_bad_ids: JSON.stringify(old) } });
    assert.strictEqual(env.run('tctvIsBad("abcdefghij0")'), false, 'expired entry must be ignored');
    assert.strictEqual(env.run('tctvIsBad("abcdefghij1")'), true);
    env.run('W="alphaxxxx01";tctvOnError(150)');
    let saved = JSON.parse(env.store.tctv_bad_ids);
    assert.ok(!saved.alphaxxxx01, 'not persisted before a successful play');
    assert.strictEqual(env.run('tctvIsBad("alphaxxxx01")'), true, 'skipped for this session');
    env.run('tctvOnState(1)');
    saved = JSON.parse(env.store.tctv_bad_ids);
    assert.ok(saved.alphaxxxx01);
    assert.ok(!saved['bad id']);
    const many = {};
    for (let k = 0; k < 400; k++) many[('id' + k + 'xxxxxxxxxxx').slice(0, 11)] = now - k;
    const env2 = makeSandbox({ now, store: { tctv_bad_ids: JSON.stringify(many) } });
    env2.run('tctvMarkBad("zzzzzzzzzzz",!0);tctvCommitBad()');
    assert.ok(Object.keys(JSON.parse(env2.store.tctv_bad_ids)).length <= 300);
});

test('a soft error (code 5) is skipped for the session but never saved', () => {
    const env = makeSandbox();
    env.run('W="alphaxxxx02";tctvOnError(5);tctvOnState(1)');
    assert.ok(!env.store.tctv_bad_ids || !JSON.parse(env.store.tctv_bad_ids).alphaxxxx02);
    assert.strictEqual(env.run('tctvIsBad("alphaxxxx02")'), true);
});

test('an error auto-skips to the next good video instead of a dead screen', () => {
    const env = makeSandbox({ now: 5 * 1000 });
    readyPlayer(env, -1);
    const first = env.run('n(i[0])').video.id;
    env.run('W=' + JSON.stringify(first) + ';tctvOnError(100)');
    env.advance(300);
    assert.strictEqual(env.calls.load.length, 1);
    assert.notStrictEqual(env.calls.load[0][0], first);
    assert.strictEqual(env.calls.toast.length, 1);
    assert.ok(/unavailable/.test(env.calls.toast[0]));
    assert.ok(!/\u2014/.test(env.calls.toast[0]));
});

test('six failures in a row stop skipping and show the help card, without saving the run', () => {
    const env = makeSandbox();
    readyPlayer(env, -1);
    for (let k = 0; k < 6; k++) { env.run('W=i[0].videos[' + (k % 4) + '].id;tctvOnError(150)'); env.advance(300); }
    assert.strictEqual(env.calls.stuck, 1);
    assert.ok(!env.store.tctv_bad_ids, 'nothing saved while nothing plays');
});

test('a live stream that fails drops back to the schedule', () => {
    const env = makeSandbox();
    env.run('r="pleb-underground";H=!0;O={videoId:"liveliveliv"};W="liveliveliv";tctvOnError(150)');
    assert.strictEqual(env.calls.g, 1);
    assert.strictEqual(env.run('tctvBadSession.liveliveliv'), 1);
});

test('rapid channel switches load once, for the last channel', () => {
    const env = makeSandbox();
    readyPlayer(env);
    env.run('["a","b","c","d","e"].forEach(function(id){tctvQueueLoad(function(){tctvLoad(id+"xxxxxxxxxx",0)},!1)})');
    env.advance(100);
    assert.strictEqual(env.calls.load.length, 0);
    env.advance(100);
    assert.strictEqual(JSON.stringify(env.calls.load), JSON.stringify([['exxxxxxxxxx', 0]]));
});

test('a forced or first switch loads right away', () => {
    const env = makeSandbox();
    readyPlayer(env);
    env.run('tctvQueueLoad(function(){tctvLoad("fxxxxxxxxxx",3.7)},!0)');
    assert.strictEqual(JSON.stringify(env.calls.load), JSON.stringify([['fxxxxxxxxxx', 3]]));
});

test('a load while the player is still starting waits for onReady instead of rebuilding it', () => {
    const env = makeSandbox();
    const p = readyPlayer(env);
    env.run('tctvReady=!1;tctvCreatedAt=Date.now()');
    env.sandbox.document.getElementById = id => (id === 'tctv-player' ? {} : null);
    env.run('tctvLoad("gxxxxxxxxxx",10)');
    assert.strictEqual(env.calls.create.length, 0);
    assert.strictEqual(env.calls.load.length, 0);
    env.advance(2000);
    env.sandbox.__p = p;
    env.run('tctvReady=!0;tctvAfterReady(__p)');
    assert.strictEqual(env.calls.load.length, 1);
    assert.strictEqual(env.calls.load[0][0], 'gxxxxxxxxxx');
    assert.ok(env.calls.load[0][1] >= 11, 'offset moves with the wait');
});

test('a detached player is rebuilt instead of silently ignored', () => {
    const env = makeSandbox();
    const p = readyPlayer(env);
    p.getIframe = () => ({ isConnected: false });
    env.run('tctvLoad("hxxxxxxxxxx",0)');
    assert.strictEqual(env.calls.load.length, 0);
    assert.strictEqual(JSON.stringify(env.calls.create), JSON.stringify([['hxxxxxxxxxx', 0]]));
});

test('a video that ends before its slot moves on to the next video, not a replay loop', () => {
    const env = makeSandbox({ now: 50 * 1000 });
    readyPlayer(env, 0);
    const sc = env.run('n(i[0])');
    env.run('W=' + JSON.stringify(sc.video.id) + ';tctvOnEnded()');
    assert.strictEqual(env.calls.load.length, 1);
    assert.notStrictEqual(env.calls.load[0][0], sc.video.id);
    assert.strictEqual(env.calls.load[0][1], 0);
});

test('the watchdog skips a stall, offers tap to play when autoplay is blocked, and ignores hidden tabs', () => {
    const env = makeSandbox({ now: 10 * 1000 });
    const p = readyPlayer(env, 3);
    env.run('W=n(i[0]).video.id');
    env.run('tctvTick()');
    env.advance(21000);
    env.run('tctvTick()');
    assert.strictEqual(env.calls.load.length, 1, 'stalled video replaced');
    const env2 = makeSandbox({ now: 10 * 1000 });
    readyPlayer(env2, -1);
    env2.run('W=n(i[0]).video.id;tctvTick()');
    env2.advance(9000);
    env2.run('tctvTick()');
    assert.strictEqual(env2.calls.tap, 1);
    assert.strictEqual(env2.calls.load.length, 0, 'blocked autoplay is not a dead video');
    const env3 = makeSandbox({ now: 10 * 1000 });
    readyPlayer(env3, 3);
    env3.sandbox.document.hidden = true;
    env3.run('W=n(i[0]).video.id;tctvTick()');
    env3.advance(30000);
    env3.run('tctvTick()');
    assert.strictEqual(env3.calls.load.length, 0);
    void p;
});

test('leaving TV destroys the player and clears pending work', () => {
    const env = makeSandbox();
    const p = readyPlayer(env);
    env.run('tctvQueueLoad(function(){tctvLoad("ixxxxxxxxxx",0)},!1);window._currentStation="alpha";tctvTeardown()');
    env.advance(1000);
    assert.ok(p.destroyed);
    assert.strictEqual(env.sandbox.P, null);
    assert.strictEqual(env.sandbox.window._tctvYtPlayer, null);
    assert.strictEqual(env.sandbox.window._currentStation, null);
    assert.strictEqual(env.calls.load.length + env.calls.create.length, 0);
});

test('keyboard: [ and ] or TV remote keys change channel, Enter tunes a focused row, inputs are left alone', () => {
    const env = makeSandbox();
    const keydown = env.listeners.keydown;
    assert.ok(keydown, 'keydown listener installed');
    const ev = (key, target) => ({ key, target: target || { tagName: 'DIV', getAttribute: () => null }, preventDefault() { this.prevented = true; }, stopPropagation() {} });
    keydown(ev(']'));
    keydown(ev('ChannelDown'));
    keydown(ev(']', { tagName: 'INPUT', getAttribute: () => null }));
    assert.deepStrictEqual(env.calls.remote, [1, -1]);
    env.sandbox.window.switchStation = id => env.calls.switched.push(id);
    const e1 = ev('Enter', { tagName: 'DIV', getAttribute: k => (k === 'data-station-id' ? 'beta' : null) });
    keydown(e1);
    assert.deepStrictEqual(env.calls.switched, ['beta']);
    assert.ok(e1.prevented);
    env.sandbox.window._tctvActive = false;
    keydown(ev(']'));
    assert.deepStrictEqual(env.calls.remote, [1, -1]);
});

test('the player wiring uses the helpers', () => {
    const logic = lines.find(l => l.startsWith('var p=0,m=0,T=null,S=null,f=0,w=null;'));
    assert.ok(logic.includes('Q=!0,z=!1'), 'muted autoplay for every browser');
    assert.ok(logic.includes('onError:function(i){i&&i.target&&P&&i.target!==P||tctvOnError(i&&i.data)}'));
    assert.ok(logic.includes('t.data===YT.PlayerState.ENDED&&(e=!1,tctvOnEnded())'));
    assert.ok(logic.includes('void setTimeout(function(){tctvSeq===tctvLoadSeq&&window._tctvActive&&_(i,t+.2)},200)'), 'stale API retries cancel');
    assert.ok(logic.includes('function pi(){tctvTick();'));
    assert.ok(logic.includes('tctvClearNoise(),e.id="tctvChNoise"'));
    assert.ok(logic.includes('window._currentStation=e'), 'swipe and BlockSurf read the current station');
    assert.ok(logic.includes('tctvQueueLoad(function(){if(r===e){var s2=n(d);'));
    assert.ok(logic.includes('role="button" tabindex="0" data-station-id="'));
    assert.ok(logic.includes('tctvTeardown();var i=document.getElementById("tctv-player")'));
    assert.ok(logic.includes('P=window._tctvYtPlayer=new YT.Player("tctv-player"'));
    assert.ok(!/navigator\.userAgent\|\|"";if\(\/iPhone/.test(logic));
});

test('user-facing copy has no em-dashes', () => {
    const copy = (helperSrc.match(/textContent="[^"]*"|showToast\("[^"]*"\)/g) || []).join('\n');
    assert.ok(copy.length > 0);
    assert.ok(!/\u2014/.test(copy));
});

test('audited dead videos are gone from the channel data', () => {
    const deadFile = path.join(root, 'tools', 'tctv-import', 'dead_videos_20261117.json');
    const dead = JSON.parse(fs.readFileSync(deadFile, 'utf8'));
    assert.ok(Array.isArray(dead.removed) && dead.removed.length > 0);
    const data = lines.slice(0, helperIdx).join('\n');
    dead.removed.forEach(d => assert.ok(!data.includes('id:"' + d.id + '"'), 'still listed: ' + d.id));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
