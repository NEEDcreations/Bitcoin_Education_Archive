#!/usr/bin/env node
'use strict';
// Guest access: everyone can use every mini app. Only logged-in accounts earn
// XP, badges, OrangeTix or sats, link accounts, or chat. Covers the shared
// notice, isGuest / ensureGuestSession, the "+N XP if logged in" result note,
// device-only guest progress (2A), guest share links, and the server policy.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) { queue.push([name, fn]); }

// ---- tiny DOM ----
function makeNode(tag) {
    const n = {
        tagName: String(tag).toUpperCase(), children: [], parentNode: null, attrs: {}, style: {},
        textContent: '', placeholder: '', readOnly: false, disabled: false,
        setAttribute(k, v) { this.attrs[k] = String(v); },
        getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
        removeAttribute(k) { delete this.attrs[k]; },
        appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
        insertBefore(c, ref) {
            if (c.parentNode) c.parentNode.removeChild(c);
            c.parentNode = this;
            const i = ref ? this.children.indexOf(ref) : -1;
            if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
            return c;
        },
        removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; },
        get firstChild() { return this.children[0] || null; },
        get nextSibling() { if (!this.parentNode) return null; const s = this.parentNode.children; return s[s.indexOf(this) + 1] || null; },
        querySelector(sel) {
            const m = /^\[([\w-]+)\]$/.exec(sel);
            const walk = (node) => {
                for (const c of node.children) {
                    if (m && c.getAttribute(m[1]) != null) return c;
                    const r = walk(c); if (r) return r;
                }
                return null;
            };
            return walk(this);
        },
        text() { return this.textContent + this.children.map((c) => c.text()).join(' '); },
    };
    return n;
}
function makeStorage() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}

function loadGuest(opts) {
    opts = opts || {};
    const calls = { signIn: 0, toasts: [], anon: 0 };
    const auth = { currentUser: opts.user === undefined ? null : opts.user };
    auth.signInAnonymously = function () {
        calls.anon++;
        if (opts.anonError) return Promise.reject(opts.anonError);
        auth.currentUser = { uid: 'anonU1', isAnonymous: true };
        return Promise.resolve({ user: auth.currentUser });
    };
    const win = {
        auth,
        localStorage: opts.localStorage || makeStorage(),
        sessionStorage: opts.sessionStorage || makeStorage(),
        document: { createElement: makeNode },
        showSignInPrompt() { calls.signIn++; },
        showToast(m) { calls.toasts.push(m); },
        anonymousSignInBlockedNow: opts.blocked ? () => true : undefined,
    };
    win.window = win;
    const ctx = vm.createContext(win);
    vm.runInContext(read('guest-access.js'), ctx, { filename: 'guest-access.js' });
    return { g: win.bqGuest, win, auth, calls };
}

const anonUser = { uid: 'anonU1', isAnonymous: true };
const realUser = { uid: 'realUser1', isAnonymous: false };

test('copy matches the agreed wording and has no em-dash', function () {
    const { g } = loadGuest();
    assert.strictEqual(g.COPY.banner, 'Playing as a guest. Log in to earn XP, badges, OrangeTix and sats, and to chat.');
    assert.strictEqual(g.COPY.tctv, 'Sign in to earn XP, badges and sats while you watch, and to join the chat.');
    assert.strictEqual(g.COPY.chat, 'Sign in to chat');
    Object.keys(g.COPY).forEach((k) => assert.ok(!/[\u2014\u2013]/.test(g.COPY[k]), k + ' has a dash'));
});

test('new guest copy in touched files has no em-dash', function () {
    const src = read('guest-access.js');
    assert.ok(!/\u2014/.test(src));
});

test('the shared module is in the bundle', function () {
    assert.ok(/guest-access\.js/.test(read('build.sh')));
    assert.ok(read('bundle.src.js').includes('Playing as a guest. Log in to earn XP'));
});

test('isGuest: no user and anonymous are guests, a real login is not', function () {
    assert.strictEqual(loadGuest().g.isGuest(), true);
    assert.strictEqual(loadGuest({ user: anonUser }).g.isGuest(), true);
    assert.strictEqual(loadGuest({ user: realUser }).g.isGuest(), false);
    const { g } = loadGuest();
    assert.strictEqual(g.isGuest(null), true);
    assert.strictEqual(g.isGuest(realUser), false);
});

test('ensureGuestSession signs in anonymously once and dedupes', async function () {
    const { g, calls } = loadGuest();
    const [a, b] = await Promise.all([g.ensureGuestSession('quiz'), g.ensureGuestSession('quiz')]);
    assert.strictEqual(calls.anon, 1);
    assert.strictEqual(a.uid, 'anonU1');
    assert.strictEqual(b.uid, 'anonU1');
});

test('ensureGuestSession never replaces an existing session', async function () {
    const { g, calls } = loadGuest({ user: realUser });
    const u = await g.ensureGuestSession('quiz');
    assert.strictEqual(u.uid, 'realUser1');
    assert.strictEqual(calls.anon, 0);
});

test('ensureGuestSession respects the sign-in hold', async function () {
    const { g, calls } = loadGuest({ blocked: true });
    assert.strictEqual(await g.ensureGuestSession('quiz'), null);
    assert.strictEqual(calls.anon, 0);
});

test('ensureGuestSession reports anonymous sign-in switched off and stops retrying', async function () {
    const { g, calls } = loadGuest({ anonError: { code: 'auth/operation-not-allowed' } });
    assert.strictEqual(await g.ensureGuestSession('quiz'), null);
    assert.strictEqual(g.state.anonDisabled, true);
    assert.strictEqual(await g.ensureGuestSession('quiz'), null);
    assert.strictEqual(calls.anon, 1);
});

test('banner shows once per session per app, never to logged-in players', function () {
    const { g } = loadGuest({ user: anonUser });
    const host = makeNode('div');
    const b = g.mountBanner(host, 'quiz');
    assert.ok(b);
    assert.strictEqual(host.firstChild, b);
    assert.ok(b.text().includes(g.COPY.banner));
    assert.ok(b.querySelector('[data-guest-login]'), 'has a Log in button');
    assert.strictEqual(g.mountBanner(makeNode('div'), 'quiz'), null, 'second mount same session');
    assert.ok(g.mountBanner(makeNode('div'), 'flex'), 'other app still shows');
    const logged = loadGuest({ user: realUser }).g;
    assert.strictEqual(logged.mountBanner(makeNode('div'), 'quiz'), null);
});

test('banner Log in opens the existing sign-in prompt', function () {
    const { g, calls } = loadGuest({ user: anonUser });
    const b = g.mountBanner(makeNode('div'), 'quiz');
    b.querySelector('[data-guest-login]').onclick({ stopPropagation() {} });
    assert.strictEqual(calls.signIn, 1);
});

test('chat input: guests see "Sign in to chat", logged-in players are restored', function () {
    const t = loadGuest({ user: anonUser });
    const input = makeNode('input'); input.placeholder = 'Say something';
    const send = makeNode('button');
    assert.strictEqual(t.g.gateChatInput(input, send), true);
    assert.strictEqual(input.placeholder, 'Sign in to chat');
    assert.strictEqual(input.readOnly, true);
    assert.strictEqual(send.disabled, true);
    input.onfocus();
    assert.strictEqual(t.calls.signIn, 1);
    t.auth.currentUser = realUser;
    assert.strictEqual(t.g.gateChatInput(input, send), false);
    assert.strictEqual(input.placeholder, 'Say something');
    assert.strictEqual(send.disabled, false);
});

test('TCTV note sits under the player for guests only', function () {
    const { g } = loadGuest({ user: anonUser });
    const wrap = makeNode('div'); const player = makeNode('div'); wrap.appendChild(player);
    const n = g.mountTctvNote(player);
    assert.strictEqual(wrap.children[1], n);
    assert.ok(n.text().includes(g.COPY.tctv));
    assert.strictEqual(g.mountTctvNote(player), n, 'no duplicate');
    const w2 = makeNode('div'); const p2 = makeNode('div'); w2.appendChild(p2);
    assert.strictEqual(loadGuest({ user: realUser }).g.mountTctvNote(p2), null);
});

test('3A: per-result note reads "+N XP if logged in" with a Log in button', function () {
    const { g } = loadGuest({ user: anonUser });
    assert.strictEqual(g.rewardText(50), '+50 XP if logged in');
    assert.strictEqual(g.rewardText(-3), '+0 XP if logged in');
    assert.strictEqual(g.prizeText('🎫 5 OrangeTix'), '🎫 5 OrangeTix if logged in');
    const note = g.rewardNote(100);
    assert.ok(note.text().includes('+100 XP if logged in'));
    assert.ok(note.querySelector('[data-guest-login]'));
});

test('3A: the note is only placed after a result, never as a popup during play', function () {
    const quests = read('quests.js');
    const i = quests.indexOf('rewardNote(');
    assert.ok(i > 0);
    // Quiz note lives in the final results screen.
    assert.ok(/questGuestReward[\s\S]{0,600}rewardNote\(/.test(quests));
    assert.ok(!/showToast\([^)]*XP if logged in/.test(quests + read('learning-quests.js') + read('modules.js') + read('scholar.js')));
});

test('requireLogin blocks guests with a toast and sign-in, passes logged-in players', function () {
    const t = loadGuest({ user: anonUser });
    assert.strictEqual(t.g.requireLogin('Log in to connect a wallet.'), false);
    assert.deepStrictEqual(t.calls.toasts, ['Log in to connect a wallet.']);
    assert.strictEqual(t.calls.signIn, 1);
    const r = loadGuest({ user: realUser });
    assert.strictEqual(r.g.requireLogin('x'), true);
    assert.strictEqual(r.calls.signIn, 0);
});

test('account links ask for a login in the UI', function () {
    assert.ok(/requireLogin\('Log in to connect a wallet\.'\)/.test(read('lightning.js')));
    const pow = read('proof-of-walk.js');
    assert.ok(/requireLogin\('Log in to connect Strava\.'\)/.test(pow));
    assert.ok(/requireLogin\('Log in to sync Strava\.'\)/.test(pow));
    assert.ok(/requireLogin\('Log in to save a Lightning address\.'\)/.test(read('ranking.js')));
});

test('2A: guest progress is device only, flags only, and never blocks the first logged-in payout', function () {
    const ls = makeStorage();
    const t = loadGuest({ user: anonUser, localStorage: ls });
    assert.strictEqual(t.g.progress.record('lq:what-is-money'), true);
    assert.strictEqual(t.g.progress.guestCompleted('lq:what-is-money'), true);
    assert.strictEqual(t.g.progress.paysWhenLoggedIn('lq:what-is-money'), false, 'guests are never paid');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(t.g.progress.forMerge())), { 'lq:what-is-money': { guestCompleted: true } });
    // Sign up on the same device.
    t.auth.currentUser = realUser;
    assert.strictEqual(t.g.progress.record('lq:other'), false, 'logged-in completions are not guest records');
    assert.strictEqual(t.g.progress.guestCompleted('lq:what-is-money'), true, 'progress moves to the account');
    assert.strictEqual(t.g.progress.paysWhenLoggedIn('lq:what-is-money'), true, 'first logged-in completion pays');
    assert.strictEqual(t.g.progress.paysWhenLoggedIn('lq:what-is-money', ['lq:what-is-money']), false, 'paid once by the server');
    assert.strictEqual(t.g.progress.paysWhenLoggedIn('lq:what-is-money', { 'lq:what-is-money': true }), false);
});

test('2A: Learning Quests and Trails keep guest passes apart from paid passes', function () {
    const lq = read('learning-quests.js');
    assert.ok(/guestPassed/.test(lq));
    assert.ok(/progress\.record\('lq:'/.test(lq));
    const mods = read('modules.js');
    assert.ok(/btc_trail_guest_passed/.test(mods));
    assert.ok(/progress\.record\('trail:'/.test(mods));
    // A guest pass does not touch the paid list, so the first logged-in pass still pays.
    const fn = mods.slice(mods.indexOf('function renderTrailExamResults'));
    const guestBranch = fn.slice(fn.indexOf('if (passed && trailGuest)'), fn.indexOf('} else if (passed)'));
    assert.ok(!/savePassed|awardPoints|awardHiddenBadge/.test(guestBranch));
});

test('spin wheel: guests spin locally, nothing banks, prize says "if logged in"', function () {
    const app = read('app.js');
    assert.ok(/guestSpin/.test(app));
    assert.ok(/btc_guest_spin_date/.test(app));
    assert.ok(/prizeNote\(|rewardNote\(/.test(app));
});

test('price prediction no longer hard-blocks guests', function () {
    const f = read('features.js');
    const fn = f.slice(f.indexOf('function showPricePrediction'), f.indexOf('function showPricePrediction') + 800);
    assert.ok(!/isAnonymous\)\s*\{\s*if \(typeof showToast/.test(fn));
});

// ---- guest share links ----
function loadTickets(user) {
    const src = read('tickets.js');
    function grab(name) {
        const s = src.indexOf('function ' + name + '(');
        assert.ok(s >= 0, name);
        let depth = 0; let i = src.indexOf('{', s);
        for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) break; } }
        return src.slice(s, i + 1);
    }
    const ctx = vm.createContext({
        auth: { currentUser: user },
        currentUser: user ? { uid: user.uid, referralCode: user.isAnonymous ? 'anonU1xx' : 'REALCODE1' } : null,
    });
    vm.runInContext([grab('getReferralCode'), grab('liveRefCode'), grab('shareDeepUrl')].join('\n'), ctx);
    return ctx;
}

test('guest share links carry no ref', function () {
    const anon = loadTickets(anonUser);
    assert.strictEqual(anon.getReferralCode(), null);
    assert.strictEqual(anon.liveRefCode(), '');
    assert.strictEqual(anon.shareDeepUrl('https://bitcoineducation.quest/#quiz'), 'https://bitcoineducation.quest/#quiz');
    const none = loadTickets(null);
    assert.strictEqual(none.liveRefCode(), '');
});

test('logged-in share links still carry the ref', function () {
    const real = loadTickets(realUser);
    assert.strictEqual(real.liveRefCode(), 'REALCODE1');
    assert.strictEqual(real.shareDeepUrl('https://bitcoineducation.quest/#quiz'), 'https://bitcoineducation.quest/?ref=REALCODE1#quiz');
});

// ---- server policy ----
test('guestPolicy: no auth and anonymous are guests; linked providers are logged in', function () {
    const gp = require(path.join(root, 'functions', 'src', 'guestPolicy.js'));
    assert.strictEqual(gp.isGuestContext(null), true);
    assert.strictEqual(gp.isGuestContext({}), true);
    assert.strictEqual(gp.isGuestContext({ auth: { uid: 'a', token: { firebase: { sign_in_provider: 'anonymous' } } } }), true);
    ['password', 'google.com', 'twitter.com', 'emailLink', 'custom'].forEach(function (p) {
        assert.strictEqual(gp.isGuestContext({ auth: { uid: 'a', token: { firebase: { sign_in_provider: p } } } }), false, p);
    });
    const r = gp.guestRewardResult();
    assert.strictEqual(r.guest, true);
    assert.strictEqual(r.awarded, 0);
    assert.strictEqual(r.success, false);
});

(async function main() {
    for (const [name, fn] of queue) {
        try { await fn(); console.log('\u2705 ' + name); passed++; }
        catch (e) { console.log('\u274c ' + name + '\n   ' + (e && e.stack ? e.stack : e)); failed++; }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
