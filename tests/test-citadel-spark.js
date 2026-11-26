// Citadel Spark launch (RLDA-38): time gate, Citadel tab launch view, More quests glow,
// and the public Waitlist copy/player. Tiny fake DOM, no network.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function makeEl(tag) {
    const n = {
        tagName: String(tag).toUpperCase(), children: [], attrs: {}, listeners: {}, style: {},
        _text: '', className: '', hidden: false, parentNode: null,
        classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
        setAttribute(k, v) { this.attrs[k] = String(v); },
        getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        appendChild(c) { c.parentNode = n; n.children.push(c); return c; },
        addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
        dispatch(t, e) { (this.listeners[t] || []).forEach((f) => f(e || { preventDefault() {} })); },
        set textContent(v) { this._text = String(v); this.children = []; },
        get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); },
        set innerHTML(v) { this._html = String(v); },
        get innerHTML() { return this._html || ''; },
        reset() {}, focus() {}
    };
    return n;
}
function all(node, out) { out = out || []; out.push(node); node.children.forEach((c) => all(c, out)); return out; }

function load(opts) {
    opts = opts || {};
    const head = makeEl('head'), body = makeEl('body');
    const citadelRow = makeEl('button');
    const store = {};
    const fetches = [];
    const document = {
        readyState: 'complete', head, body,
        createElement: makeEl,
        getElementById(id) {
            if (id === 'todayCitadelBtn') return opts.noRow ? null : citadelRow;
            return all(head).find((n) => n.id === id) || null;
        },
        addEventListener() {}, dispatchEvent() {}
    };
    body.contains = () => true;
    const sandbox = {
        document, console, URLSearchParams, Promise, setTimeout: () => 0,
        location: { hostname: opts.host || 'bitcoineducation.quest', search: opts.search || '' },
        sessionStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } },
        localStorage: { setItem() {}, getItem() { return null; } },
        fetch: (u, o) => { fetches.push([u, o]); return new Promise(() => {}); },
        CustomEvent: function () {}
    };
    sandbox.window = sandbox;
    sandbox.Date = opts.now ? class extends Date { static now() { return opts.now; } } : Date;
    vm.createContext(sandbox);
    vm.runInContext(read('citadel-spark.js'), sandbox);
    return { cs: sandbox.CitadelSpark, citadelRow, sandbox, fetches, head };
}

const BEFORE = Date.UTC(2026, 10, 28, 4, 59, 59);
const AT = Date.UTC(2026, 10, 28, 5, 0, 0);

test('launch is Sat Nov 28, 2026, 12:00 AM ET (05:00 UTC)', () => {
    const { cs } = load({ now: BEFORE });
    assert.strictEqual(cs.LAUNCH_AT, AT);
    assert.strictEqual(new Date(cs.LAUNCH_AT).toLocaleString('en-US', { timeZone: 'America/New_York' }), '11/28/2026, 12:00:00 AM');
});

test('gate is closed before launch and open at launch on production', () => {
    const { cs } = load({ now: BEFORE });
    assert.strictEqual(cs.isLive(BEFORE), false);
    assert.strictEqual(cs.isLive(AT), true);
    assert.strictEqual(cs.isLive(AT + 86400000), true);
});

test('?cs_preview=1 is ignored on production', () => {
    const { cs } = load({ now: BEFORE, search: '?cs_preview=1' });
    assert.strictEqual(cs.isLive(BEFORE), false);
});

test('?cs_preview=1 opens the gate early on staging previews and localhost', () => {
    ['citadel-spark-1128.bq-staging.pages.dev', 'dev.bitcoineducation.quest', 'localhost'].forEach((host) => {
        const { cs } = load({ now: BEFORE, host, search: '?cs_preview=1' });
        assert.strictEqual(cs.isLive(BEFORE), true, host);
    });
    const { cs } = load({ now: BEFORE, host: 'dev.bitcoineducation.quest' });
    assert.strictEqual(cs.isLive(BEFORE), false, 'staging without the flag stays gated');
});

test('Citadel tab: renderTab does nothing before launch (quests.js keeps Coming Soon)', () => {
    const { cs } = load({ now: BEFORE });
    const body = makeEl('div');
    assert.strictEqual(cs.renderTab(body, BEFORE), false);
    assert.strictEqual(body.children.length, 0);
});

test('Citadel tab after launch: label, teaser, 3 images, waitlist form', () => {
    const { cs } = load({ now: AT });
    const body = makeEl('div');
    assert.strictEqual(cs.renderTab(body, AT), true);
    const nodes = all(body);
    const text = body.textContent;
    assert.ok(text.includes('LAUNCHING JANUARY 3, 2027'));
    assert.ok(!/coming soon/i.test(text));
    const video = nodes.find((n) => n.tagName === 'VIDEO');
    assert.ok(video, 'teaser video');
    assert.strictEqual(video.src, '/images/waitlist/citadel-spark-teaser.mp4');
    assert.ok(!('autoplay' in video.attrs) && !video.autoplay, 'no autoplay');
    assert.strictEqual(video.muted, false, 'sound on');
    const play = nodes.find((n) => n.className === 'cs-play');
    assert.ok(play && /Play/.test(play.getAttribute('aria-label')));
    video.play = () => Promise.resolve();
    play.dispatch('click');
    assert.strictEqual(video.muted, false);
    assert.strictEqual(video.controls, true);
    assert.strictEqual(play.hidden, true);
    assert.strictEqual(play.parentNode.classList.contains('cs-on'), true, 'video takes taps only once playing');
    video.dispatch('ended');
    assert.strictEqual(play.hidden, false);
    assert.strictEqual(play.parentNode.classList.contains('cs-on'), false);
    const imgs = nodes.filter((n) => n.tagName === 'IMG').map((n) => n.src);
    assert.deepStrictEqual(imgs, ['/images/waitlist/citadel-demo-1-overview.jpg', '/images/waitlist/citadel-demo-2-raid.jpg', '/images/waitlist/citadel-demo-3-nook-shop.jpg']);
    const email = nodes.find((n) => n.type === 'email');
    assert.ok(email && email.maxLength === 254);
    assert.ok(nodes.find((n) => n.name === 'website'), 'honeypot');
    assert.ok(text.includes('when Citadel Spark launches'));
});

test('new in-app marketing copy does not mention bitcoin', () => {
    const { cs } = load({ now: AT });
    const body = makeEl('div');
    cs.renderTab(body, AT);
    assert.ok(!/bitcoin/i.test(body.textContent), body.textContent);
});

test('waitlist signup: bad email or missing Turnstile token never posts', () => {
    const { cs, sandbox, fetches } = load({ now: AT });
    const body = makeEl('div');
    cs.renderTab(body, AT);
    const nodes = all(body);
    const form = nodes.find((n) => n.tagName === 'FORM');
    const email = nodes.find((n) => n.type === 'email');
    const msg = nodes.find((n) => n.className && n.className.indexOf('cs-msg') === 0);
    email.value = 'nope';
    form.dispatch('submit');
    assert.strictEqual(fetches.length, 0);
    assert.ok(/doesn't look right/.test(msg.textContent));
    email.value = 'a@example.com';
    sandbox.turnstile = { getResponse: () => '' };
    form.dispatch('submit');
    assert.strictEqual(fetches.length, 0, 'no token, no post');
    assert.ok(/security check/.test(msg.textContent));
});

test('More quests Citadel row glows only after launch', () => {
    const a = load({ now: BEFORE });
    assert.strictEqual(a.cs.applyGlow(BEFORE), false);
    assert.strictEqual(a.citadelRow.classList.contains('cs-glow'), false);
    const b = load({ now: AT });
    assert.strictEqual(b.citadelRow.classList.contains('cs-glow'), true, 'applied on load after launch');
});

test('index.html and 404.html load citadel-spark.js and tag the Citadel row', () => {
    ['index.html', '404.html'].forEach((f) => {
        const h = read(f);
        assert.ok(h.includes('<script src="/citadel-spark.js?v=20261125_v2695" defer></script>'), f);
        assert.ok(h.includes('id="todayCitadelBtn" class="today-more-item"'), f);
    });
    const q = read('quests.js');
    assert.ok(/function _renderCitadelTab\(body\) \{\s*\/\/[^\n]*\n\s*if \(window\.CitadelSpark/.test(q));
    assert.ok(q.includes('>Coming Soon<'), 'pre-launch label kept');
});

test('Waitlist page: Citadel Spark arrives copy, no back/offline wording', () => {
    const h = read('waitlist.html');
    assert.ok(h.includes('Citadel Spark arrives January 3, 2027. Want a heads-up when the gates open?'));
    assert.ok(h.includes('to tell you when Citadel Spark launches'));
    assert.ok(!/Back January 3/i.test(h));
    assert.ok(!/when we're back|we're back|offline/i.test(h));
    assert.ok(!/when we're back|offline/i.test(read('waitlist.js')));
});

test('Waitlist page teaser: no autoplay, not muted, big play button, social links right below', () => {
    const h = read('waitlist.html');
    const v = h.match(/<video[^>]*id="wlTeaser"[^>]*>/)[0];
    assert.ok(!/\bautoplay\b/.test(v) && !/\bmuted\b/.test(v), v);
    const iPlay = h.indexOf('id="wlPlay"'), iNav = h.indexOf('<nav class="follow'), iGal = h.indexOf('<div class="gallery">');
    assert.ok(iPlay > 0 && iNav > iPlay && iGal > iNav, 'teaser, then social links, then images');
    assert.ok(h.indexOf('</main>') < iPlay, 'social links no longer inside the signup card');
    assert.ok(/\.play\{[^}]*top:50%;left:50%;transform:translate\(-50%,-50%\);width:92px;height:92px/.test(h));
    const js = read('waitlist.js');
    assert.ok(/v\.muted = false;[\s\S]*v\.play\(\)/.test(js));
});

test('QA mobile: play buttons sit above the video and the idle video never takes the tap', () => {
    const js = read('citadel-spark.js');
    assert.ok(/\.cs-play\{position:absolute;z-index:2;/.test(js), 'cs-play z-index');
    assert.ok(js.includes('.cs-play:active{transform:translate(-50%,-50%) scale(.96)!important}'), 'cs-play keeps translate on :active');
    assert.ok(/\.cs-player video\{position:relative;z-index:0;/.test(js));
    assert.ok(js.includes('.cs-player:not(.cs-on) video{pointer-events:none}'));
    const h = read('waitlist.html');
    assert.ok(/\.play\{position:absolute;z-index:2;/.test(h), '/waitlist .play z-index');
    assert.ok(/\.player video\.teaser\{position:relative;z-index:0;/.test(h));
    assert.ok(h.includes('.player:not(.on) video.teaser{pointer-events:none}'));
    const w = read('waitlist.js');
    assert.ok(/play\.hidden = true;\s*on\(true\);/.test(w) && /'ended', function \(\) \{ play\.hidden = false; on\(false\); \}/.test(w));
    // /waitlist is a standalone page; it must not inherit index.html's button:active scale that drops translate.
    assert.ok(!/button:active\s*\{\s*transform\s*:/.test(h), 'waitlist has no global button:active transform');
});

test('signed-in play starts Spark Citizen credit; ended completes; guests do not call', () => {
    const calls = [];
    const { cs, sandbox } = load({ now: AT });
    sandbox.firebase = {
        auth() { return { currentUser: { uid: 'u1', isAnonymous: false } }; },
        functions() { return { httpsCallable(name) { return (body) => { calls.push([name, body]); return Promise.resolve({ data: { ok: true } }); }; } }; }
    };
    const body = makeEl('div');
    cs.renderTab(body, AT);
    const nodes = all(body);
    const btn = nodes.find((n) => n.className === 'cs-play');
    const video = nodes.find((n) => n.tagName === 'VIDEO');
    video.play = () => Promise.resolve();
    btn.dispatch('click');
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0][0], 'sparkCitizenTeaser');
    assert.strictEqual(calls[0][1].phase, 'start');
    video.dispatch('ended');
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(calls[1][0], 'sparkCitizenTeaser');
    assert.strictEqual(calls[1][1].phase, 'complete');
    calls.length = 0;
    sandbox.firebase.auth = () => ({ currentUser: { uid: 'g', isAnonymous: true } });
    cs.creditTeaser('start');
    assert.strictEqual(calls.length, 0);
});

(async () => {
    // Good email + Turnstile token posts to the same Worker as /waitlist, tagged src=app-citadels.
    try {
        const { cs, sandbox, fetches } = load({ now: AT });
        sandbox.turnstile = { render: () => 'w1', getResponse: (id) => (id === 'w1' ? 'tok123' : ''), reset() {} };
        const body = makeEl('div');
        cs.renderTab(body, AT);
        await new Promise((r) => setImmediate(r));
        const nodes = all(body);
        nodes.find((n) => n.type === 'email').value = ' a@example.com ';
        nodes.find((n) => n.tagName === 'FORM').dispatch('submit');
        assert.strictEqual(fetches.length, 1);
        const [url, o] = fetches[0];
        assert.strictEqual(url, '/api/waitlist');
        assert.strictEqual(o.method, 'POST');
        assert.strictEqual(o.credentials, 'omit');
        const b = o.body;
        assert.strictEqual(b.get('email'), 'a@example.com');
        assert.strictEqual(b.get('consent'), 'on');
        assert.strictEqual(b.get('website'), '');
        assert.strictEqual(b.get('cf-turnstile-response'), 'tok123');
        assert.strictEqual(b.get('src'), 'app-citadels');
        assert.ok(/^[a-z0-9][a-z0-9-]{0,31}$/.test(b.get('src')), 'src passes the Worker SRC_RE');
        console.log('✅ waitlist signup posts the public Worker fields with src=app-citadels'); passed++;
    } catch (e) { console.log('❌ waitlist signup posts the public Worker fields: ' + e.message); failed++; }
    console.log(`\nCitadel Spark: ${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
})();
