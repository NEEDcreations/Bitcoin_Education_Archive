// New-user fixes for the closed test (Week 1 onboarding batch).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

// Return the source of `function name(...) {...}` (or `async function`).
function fnSource(src, name) {
    const re = new RegExp('(async )?function ' + name + '\\s*\\(');
    const m = re.exec(src);
    assert.ok(m, name + ' not found');
    let i = src.indexOf('{', m.index);
    let depth = 0;
    let quote = null;
    for (; i < src.length; i++) {
        const c = src[i];
        if (quote) {
            if (c === '\\') { i++; continue; }
            if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
        if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return src.slice(m.index, i + 1); }
    }
    throw new Error('unbalanced ' + name);
}

let passed = 0;
let failed = 0;
const pending = [];
function test(name, fn) {
    pending.push(Promise.resolve().then(fn).then(function () {
        console.log('✅ ' + name); passed++;
    }).catch(function (e) {
        console.log('❌ ' + name + ': ' + e.message); failed++;
    }));
}

// Run the provider sign-in handler for a brand-new account with stubs and
// record which prompt it opens.
async function socialSignupPrompt(pendingName, nameFails) {
    const src = read('ranking.js');
    const calls = [];
    const store = {};
    if (pendingName) store.btc_pending_username = pendingName;
    const doc = { get: async function () { return { exists: false, data: function () { return {}; } }; }, set: async function () {}, delete: async function () {} };
    const sandbox = {
        console: { log: function () {}, error: function () {} },
        setTimeout: function (fn) { fn(); return 0; },
        localStorage: {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
            setItem: function (k, v) { store[k] = String(v); },
            removeItem: function (k) { delete store[k]; }
        },
        db: { collection: function () { return { doc: function () { return doc; } }; } },
        clientCreatePayload: function (x) { return Object.assign({}, x); },
        normalizeClientLn: function (x) { return x; },
        clientLnValid: function () { return false; },
        flushSignupFaction: async function () {},
        applyServerUsername: async function () { if (nameFails) throw new Error('taken'); return pendingName; },
        tryLinkGuest: async function () { return null; },
        loadUser: function () {},
        attachReferral: function () {},
        hideUsernamePrompt: function () {},
        showToast: function () {},
        // A signed-in user tapping the sign-up prompt gets Settings.
        showUsernamePrompt: function () { calls.push('settings'); },
        showNewAccountNamePrompt: function () { calls.push('username-step'); },
        showUsernameRepickPrompt: function () { calls.push('username-step'); }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fnSource(src, '_handleSignInResultGlobal') + '\nthis._run = _handleSignInResultGlobal;', sandbox);
    await sandbox._run({ uid: 'newuser1', isAnonymous: false }, null, null);
    return calls;
}

test('a new social account with no name opens the username step', async function () {
    const calls = await socialSignupPrompt('', false);
    assert.deepStrictEqual(calls, ['username-step']);
});

test('a new social account whose typed name is taken opens the username step', async function () {
    const calls = await socialSignupPrompt('takenname', true);
    assert.deepStrictEqual(calls, ['username-step']);
});

test('new-account paths never send a signed-in user to the sign-up prompt', function () {
    const src = read('ranking.js');
    assert.ok(!src.includes('setTimeout(showUsernamePrompt, 400)'));
    const helper = fnSource(src, 'showNewAccountNamePrompt');
    assert.ok(helper.includes('showUsernameRepickPrompt({ fresh: true })'));
    const prompt = fnSource(src, 'showUsernameRepickPrompt');
    assert.ok(prompt.includes('opts.fresh'));
    assert.ok(prompt.includes('ageDecisionPending()'));
    assert.ok(prompt.includes('runAfterAge'));
    assert.ok(prompt.includes('_ageWaitTries'));
    assert.ok(prompt.includes('waitTries < 100'));
    assert.ok(prompt.includes('ageOverlayOpen()'));
    assert.ok(fnSource(src, 'ageOverlayOpen').includes('ageConfirmOverlay'));
    assert.ok(fnSource(src, 'ageDecisionPending').includes("_bqAgeDecision === 'pending'"));
});

// Run finishEmailSignIn for a brand-new (or unnamed) account with stubs and
// record which prompt it opens.
async function emailLinkSignupPrompt(opts) {
    opts = opts || {};
    const src = read('ranking.js');
    const calls = [];
    const store = {};
    if (opts.pendingName) store.btc_pending_username = opts.pendingName;
    const userDoc = {
        exists: !!opts.existing,
        data: function () { return opts.existingData || {}; },
        get: async function () { return userDoc; },
        set: async function () {},
        delete: async function () {}
    };
    const sandbox = {
        console: { log: function () {}, error: function () {} },
        setTimeout: function (fn) { fn(); return 0; },
        localStorage: {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
            setItem: function (k, v) { store[k] = String(v); },
            removeItem: function (k) { delete store[k]; }
        },
        window: { history: { replaceState: function () {} } },
        history: { replaceState: function () {} },
        location: { pathname: '/', hash: '' },
        TOS_CURRENT_VERSION: 1,
        firebase: { firestore: { FieldValue: { serverTimestamp: function () { return 'ts'; }, increment: function (n) { return n; } } } },
        auth: {
            currentUser: null,
            signInWithEmailLink: async function () { return { user: { uid: 'emailuid1', isAnonymous: false } }; }
        },
        db: {
            collection: function () {
                return {
                    doc: function () { return userDoc; },
                    set: async function () { return {}; }
                };
            }
        },
        finishAccountEmailLink: async function () { return false; },
        clientCreatePayload: function (x) { return Object.assign({}, x); },
        normalizeClientLn: function (x) { return x; },
        clientLnValid: function () { return false; },
        flushSignupFaction: async function () {},
        applyServerUsername: async function () { if (opts.nameFails) throw new Error('taken'); return opts.pendingName; },
        tryLinkGuest: async function () {
            if (opts.guestBringsName) {
                userDoc.exists = true;
                opts.existingData = Object.assign({}, opts.existingData || {}, { username: opts.guestBringsName });
            }
            return opts.guestLinkResult || null;
        },
        currentUser: opts.currentUser || null,
        loadUser: function () {},
        attachReferral: function () {},
        showToast: function () {},
        showUsernamePrompt: function () { calls.push('settings'); },
        showNewAccountNamePrompt: function () { calls.push('username-step'); },
        showUsernameRepickPrompt: function () { calls.push('username-step'); },
        surfaceMfaRequired: function () { return false; },
        anonymousSignInBlockedNow: function () { return false; }
    };
    sandbox.window = Object.assign(sandbox.window, sandbox);
    vm.createContext(sandbox);
    vm.runInContext(fnSource(src, 'finishEmailSignIn') + '\nthis._run = finishEmailSignIn;', sandbox);
    await sandbox._run('new@example.com', 'https://example.com/link');
    return calls;
}

test('a new email-link account with no name opens the username step', async function () {
    const calls = await emailLinkSignupPrompt({});
    assert.deepStrictEqual(calls, ['username-step']);
});

test('a new email-link account whose typed name is taken opens the username step', async function () {
    const calls = await emailLinkSignupPrompt({ pendingName: 'takenname', nameFails: true });
    assert.deepStrictEqual(calls, ['username-step']);
});

test('a new email-link account whose typed name saves does not open the username step', async function () {
    const calls = await emailLinkSignupPrompt({ pendingName: 'freshname', nameFails: false });
    assert.deepStrictEqual(calls, []);
});

test('an email-link return with a username already set does not open the username step', async function () {
    const calls = await emailLinkSignupPrompt({ existing: true, existingData: { username: 'QuestFan' } });
    assert.deepStrictEqual(calls, []);
});

test('an email-link merge that brings a guest username does not open the username step', async function () {
    const calls = await emailLinkSignupPrompt({ existing: true, existingData: {}, guestBringsName: 'GuestName' });
    assert.deepStrictEqual(calls, []);
});

function loadFreshPromptSandbox(opts) {
    opts = opts || {};
    const src = read('ranking.js');
    const timers = [];
    const nodes = Object.assign({}, opts.nodes || {});
    const created = [];
    const getCalls = [];
    const document = {
        getElementById: function (id) { return nodes[id] || null; },
        addEventListener: function () {},
        createElement: function (tag) {
            const el = {
                tagName: String(tag).toUpperCase(),
                style: {},
                id: '',
                innerHTML: '',
                setAttribute: function () {},
                addEventListener: function () {},
                appendChild: function () { return el; }
            };
            return el;
        },
        head: { appendChild: function () {} },
        body: { appendChild: function (el) { if (el && el.id) nodes[el.id] = el; created.push(el && el.id); } }
    };
    const sandbox = {
        document: document,
        window: { runAfterTos: function (fn) { fn(); } },
        tosBlocking: function () { return false; },
        setTimeout: function (fn) { timers.push(fn); return timers.length; },
        console: { log: function () {}, error: function () {} }
    };
    if (opts.auth) sandbox.auth = opts.auth;
    if (opts.withDb) {
        sandbox.db = {
            collection: function () {
                return {
                    doc: function (uid) {
                        return {
                            get: async function () {
                                getCalls.push(uid);
                                const name = typeof opts.serverName === 'function' ? opts.serverName() : (opts.serverName || '');
                                return { exists: true, data: function () { return name ? { username: name } : {}; } };
                            }
                        };
                    }
                };
            }
        };
    }
    if (opts.ageDecision) sandbox.window._bqAgeDecision = opts.ageDecision;
    sandbox.window.document = document;
    sandbox.window.btcOnboardingQueue = null;
    vm.createContext(sandbox);
    const names = [
        'ageOverlayOpen', 'ageDecisionPending', 'ageConfirmBlocking',
        'runAfterAge', 'flushAfterAge', 'signedInEmailUid',
        'readServerUsername', 'copyUsernamePromptOpts',
        'ensureUsernameRepickStyle', 'showUsernameRepickPrompt'
    ];
    vm.runInContext(
        names.map(function (n) { return fnSource(src, n); }).join('\n') + '\n' +
        names.map(function (n) { return 'this.' + n + ' = ' + n + ';'; }).join('\n') + '\n' +
        'this.window.runAfterAge = runAfterAge;\n' +
        'this.window.flushAfterAge = flushAfterAge;',
        sandbox
    );
    return { sandbox: sandbox, nodes: nodes, created: created, timers: timers, getCalls: getCalls };
}

test('the fresh username step waits for the age overlay, then opens', function () {
    const ctx = loadFreshPromptSandbox({ nodes: { ageConfirmOverlay: { id: 'ageConfirmOverlay' } } });
    ctx.sandbox.showUsernameRepickPrompt({ fresh: true });
    assert.deepStrictEqual(ctx.created, []);
    assert.strictEqual(ctx.timers.length, 1);
    delete ctx.nodes.ageConfirmOverlay;
    ctx.timers.shift()();
    assert.ok(ctx.created.indexOf('usernameRepick') !== -1);
});

test('the fresh username step stops quietly after 100 age-wait tries', function () {
    const ctx = loadFreshPromptSandbox({ nodes: { ageConfirmOverlay: { id: 'ageConfirmOverlay' } } });
    ctx.sandbox.showUsernameRepickPrompt({ fresh: true });
    for (let i = 0; i < 100; i++) {
        assert.strictEqual(ctx.timers.length, 1, 'age-wait try ' + i);
        ctx.timers.shift()();
    }
    assert.deepStrictEqual(ctx.created, []);
    assert.strictEqual(ctx.timers.length, 0);
});

test('the fresh username step never opens while the age overlay is still visible', function () {
    const ctx = loadFreshPromptSandbox({ nodes: { ageConfirmOverlay: { id: 'ageConfirmOverlay' } } });
    ctx.sandbox.showUsernameRepickPrompt({ fresh: true });
    for (let i = 0; i < 100; i++) ctx.timers.shift()();
    assert.deepStrictEqual(ctx.created, []);
    // Cap hit and overlay still up: do not open, even if we try again.
    ctx.sandbox.showUsernameRepickPrompt({ fresh: true, _ageWaitTries: 100 });
    assert.deepStrictEqual(ctx.created, []);
});

test('the fresh username step waits for the age decision with no overlay, then opens on flushAfterAge', function () {
    const ctx = loadFreshPromptSandbox({ ageDecision: 'pending' });
    ctx.sandbox.showUsernameRepickPrompt({ fresh: true });
    assert.deepStrictEqual(ctx.created, []);
    assert.ok(ctx.timers.length >= 1, 'fallback timer armed');
    ctx.sandbox.flushAfterAge();
    assert.ok(ctx.created.indexOf('usernameRepick') !== -1);
});

test('an email-link sign-in does not trust an in-memory guest username when the server doc has none', async function () {
    const calls = await emailLinkSignupPrompt({
        existing: true,
        existingData: {},
        currentUser: { username: 'GuestName' }
    });
    assert.deepStrictEqual(calls, ['username-step']);
});

test('a fresh username step does not open when the server account already has a username', async function () {
    const ctx = loadFreshPromptSandbox({
        withDb: true,
        serverName: 'GuestName',
        auth: { currentUser: { uid: 'emailuid1', isAnonymous: false } }
    });
    ctx.sandbox.showUsernameRepickPrompt({ fresh: true });
    await Promise.resolve();
    await Promise.resolve();
    assert.deepStrictEqual(ctx.created, []);
    assert.deepStrictEqual(ctx.getCalls, ['emailuid1']);
});

test('a deferred fresh prompt does not open if the server name lands before the age step finishes', async function () {
    let name = '';
    const ctx = loadFreshPromptSandbox({
        withDb: true,
        serverName: function () { return name; },
        auth: { currentUser: { uid: 'emailuid1', isAnonymous: false } },
        ageDecision: 'pending'
    });
    ctx.sandbox.showUsernameRepickPrompt({ fresh: true });
    await Promise.resolve();
    await Promise.resolve();
    assert.deepStrictEqual(ctx.created, []);
    name = 'GuestName';
    ctx.sandbox.flushAfterAge();
    await Promise.resolve();
    await Promise.resolve();
    assert.deepStrictEqual(ctx.created, []);
});

test('age-confirm marks the age decision pending on sign-in and flushes after finishQueue', function () {
    const src = read('age-confirm.js');
    const finish = fnSource(src, 'finishQueue');
    assert.ok(finish.includes('flushAfterAge'), 'finishQueue flushes the age wait');
    assert.ok(finish.includes('_bqAgeDecision'), 'finishQueue records the decision');
    const onAuth = fnSource(src, 'onAuthUser');
    assert.ok(onAuth.includes("_bqAgeDecision = 'pending'"), 'sign-in marks age pending');
});

test('the username step sits above the onboarding questions', function () {
    const src = read('ranking.js');
    const m = /#usernameRepick\{position:fixed;inset:0;z-index:(\d+);/.exec(src);
    assert.ok(m, 'username step style');
    const onboarding = read('onboarding.js.src');
    const tops = (onboarding.match(/z-index:(\d+)/g) || []).map(function (s) { return Number(s.split(':')[1]); });
    assert.ok(Number(m[1]) > Math.max.apply(null, tops), 'username step z-index ' + m[1]);
});

test('on phones the Experience bar moves below the Invite and Quest pills', function () {
    ['index.html', '404.html'].forEach(function (name) {
        const html = read(name);
        const at = html.indexOf('body.home-signed-in:has(#inviteCard[data-show="1"][data-state="min"]) #bqHomeModeBar');
        assert.ok(at !== -1, name + ' invite rule');
        const block = html.slice(html.lastIndexOf('@media (max-width: 900px)', at), html.indexOf('}', html.indexOf('{', at)) + 1);
        assert.ok(block.includes('body.home-signed-in:has(#nachoQuestPill) #bqHomeModeBar'), name + ' quest rule');
        const m = /margin-top:\s*(\d+)px/.exec(block);
        // The pills are about 35px tall in a band that starts where the wallet strip ends.
        assert.ok(m && Number(m[1]) >= 44, name + ' clearance');
    });
});

test('the account and Settings sheet starts below the phone status bar', function () {
    ['index.html', '404.html'].forEach(function (name) {
        const html = read(name);
        const m = /#usernameModal \{[^}]*\}/.exec(html);
        assert.ok(m, name + ' sheet style');
        assert.ok(/padding:\s*env\(safe-area-inset-top, 0px\)/.test(m[0]), name + ' top inset');
        assert.ok(m[0].includes('box-sizing: border-box'), name + ' box sizing');
    });
});

function siteCsp() {
    const src = read('workers/seo-router/worker.js');
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(fnSource(src, 'buildCSP') + '\nthis._csp = buildCSP;', sandbox);
    const csp = sandbox._csp('testnonce', {});
    const out = {};
    String(csp).split(';').forEach(function (part) {
        const bits = part.trim().split(/\s+/);
        if (bits[0]) out[bits[0]] = bits.slice(1);
    });
    return out;
}

test('the site policy lets the language switch load Google Translate', function () {
    const csp = siteCsp();
    // translate.google.com serves element.js, which then loads its main
    // script, language list and stylesheet from these hosts.
    ['https://translate.google.com', 'https://translate.googleapis.com', 'https://translate-pa.googleapis.com'].forEach(function (host) {
        assert.ok(csp['script-src'].includes(host), 'script-src ' + host);
    });
    assert.ok(csp['style-src'].includes('https://www.gstatic.com'), 'style-src gstatic');
});

Promise.all(pending).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
});
