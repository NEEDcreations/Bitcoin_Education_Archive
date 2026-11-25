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
    assert.ok(prompt.includes('opts && opts.fresh'));
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

Promise.all(pending).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
});
