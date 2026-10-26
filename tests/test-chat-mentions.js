// Global chat @mentions: multi-word usernames must not swallow the rest of the message.
// Regression for "@chill guy2 heyyy!" rendering as "@chill guy2!" (Oct 26, 2026).
// Notifications use the same longest-known-username match. Recipients are cache
// uids that already pass the notification rules, never a uid taken from the text.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function noop() {}
const context = vm.createContext({
    document: {
        addEventListener: noop, removeEventListener: noop,
        getElementById: function() { return null; },
        createElement: function() { return { style: {}, appendChild: noop, addEventListener: noop }; },
    },
    console: { log: noop, warn: noop, error: noop },
    setTimeout: function() { return 0; }, clearTimeout: noop,
    setInterval: function() { return 0; }, clearInterval: noop,
    navigator: { userAgent: '' },
    location: { hash: '', pathname: '/' },
    history: { pushState: noop, replaceState: noop },
    localStorage: { getItem: function() { return null; }, setItem: noop },
    fetch: function() { return Promise.resolve({ json: function() { return {}; } }); },
    addEventListener: noop, removeEventListener: noop,
    innerWidth: 1024, innerHeight: 800,
});
context.window = context;
const raw = fs.readFileSync(path.join(__dirname, '..', 'global-chat.js'), 'utf8');
const hook = 'var _chatUsers = {};';
assert.ok(raw.indexOf(hook) !== -1, 'username cache declaration moved; update this test');
const src = raw.replace(hook, 'var _chatUsers = window.__testChatUsers = {};');
for (let attempt = 0; attempt < 12; attempt++) {
    try { vm.runInContext(src, context, { filename: 'global-chat.js' }); break; }
    catch (err) {
        const missing = String(err && err.message || '').match(/^(\w+) is not defined$/);
        if (!missing || attempt === 11) throw err;
        context[missing[1]] = noop;
    }
}
const users = context.__testChatUsers;
users.u1 = 'chill guy2';
users.u2 = '1f31e';
users.u3 = 'Big boss';
users.u4 = 'Big boss ross';
users.u5 = 'José García';

// Same escaping global-chat.js applies before formatChatText.
const esc = function(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
const render = function(t) { return context.formatChatText(esc(t)); };
const visible = function(h) { return h.replace(/<[^>]+>/g, ''); };
const chips = function(h) {
    const out = [];
    h.replace(/<span[^>]*title="View profile"[^>]*>([^<]*)<\/span>/g, function(_, n) { out.push(n); });
    return out;
};

test('stored messages from the bug report keep their full text', function() {
    [
        '@chill guy2 hello!',
        '@chill guy2 heyyy!',
        '@chill guy2 heyyyy',
        '@chill guy2 from the desktop again!',
        '@chill guy2 hi! this is from my phone browser (firefox on Android). the previous one was from the desktop browser (chromium on Ubuntu LTS)',
        '@chill guy2 the refreshed video collection in TCTV is fantastic. Very orange-pilling and inspiring.',
    ].forEach(function(t) {
        const html = render(t);
        assert.strictEqual(visible(html), t, html);
        assert.deepStrictEqual(chips(html), ['@chill guy2'], html);
    });
});

test('multi-word mention in the middle and at the end', function() {
    let html = render('gm @chill guy2 how are you');
    assert.strictEqual(visible(html), 'gm @chill guy2 how are you');
    assert.deepStrictEqual(chips(html), ['@chill guy2']);
    html = render('thanks @chill guy2');
    assert.strictEqual(visible(html), 'thanks @chill guy2');
    assert.deepStrictEqual(chips(html), ['@chill guy2']);
});

test('mention before punctuation', function() {
    ['!', '?', '.', '...'].forEach(function(p) {
        const t = 'hey @chill guy2' + p + ' nice';
        const html = render(t);
        assert.strictEqual(visible(html), t, html);
        assert.deepStrictEqual(chips(html), ['@chill guy2'], p + ' ' + html);
    });
});

test('multiple mentions, multi-word and single-word', function() {
    const t = '@chill guy2 and @1f31e and @José García hi!';
    const html = render(t);
    assert.strictEqual(visible(html), t, html);
    assert.deepStrictEqual(chips(html), ['@chill guy2', '@1f31e', '@José García'], html);
});

test('longest known username wins, and a longer unknown name is not cut to a prefix', function() {
    let html = render('@Big boss ross welcome!');
    assert.strictEqual(visible(html), '@Big boss ross welcome!');
    assert.deepStrictEqual(chips(html), ['@Big boss ross']);
    html = render('@Big boss rossi welcome!');
    assert.strictEqual(visible(html), '@Big boss rossi welcome!');
    assert.deepStrictEqual(chips(html), ['@Big boss'], html);
});

test('unknown multi-word text falls back to a single-word chip without losing text', function() {
    const t = '@stranger says hi!';
    const html = render(t);
    assert.strictEqual(visible(html), t);
    assert.deepStrictEqual(chips(html), ['@stranger']);
});

test('HTML escaping and XSS protection stay intact', function() {
    const html = render('@chill guy2 <img src=x onerror=alert(1)> "><script>alert(1)</script>');
    assert.strictEqual(html.indexOf('<img'), -1, html);
    assert.strictEqual(html.indexOf('<script'), -1, html);
    assert.ok(html.indexOf('&lt;img src=x onerror=alert(1)&gt;') !== -1, html);
    assert.deepStrictEqual(chips(html), ['@chill guy2']);
    // The leftover text must never land inside the onclick attribute.
    const onclicks = html.match(/onclick="[^"]*"/g) || [];
    onclicks.forEach(function(o) { assert.ok(/lookupUserByName\('chill guy2'\)/.test(o), o); });
    const quoteName = render("@chill guy2 ');alert(1);//");
    assert.strictEqual((quoteName.match(/onclick=/g) || []).length, 1, quoteName);
    assert.ok(quoteName.indexOf("lookupUserByName('chill guy2')\"") !== -1, quoteName);
});

test('uid-tagged shoutouts are unchanged', function() {
    const html = context.formatChatText(esc('🎉 Shoutout to @chill guy2! Go send @chill guy2 a peer request! 🤝'), 'uid_chill');
    assert.ok(html.indexOf('>@chill guy2<') !== -1, html);
    assert.strictEqual((html.match(/data-profile-uid="uid_chill"/g) || []).length, 1);
    assert.ok(visible(html).indexOf('Go send chill guy2 a peer request') !== -1, html);
});

function mentionUids(text) {
    // Copy out of the vm realm so deepStrictEqual can compare prototypes.
    const hits = context._chatMentionTargets(text);
    const out = [];
    for (let i = 0; i < hits.length; i++) out.push(String(hits[i].uid));
    return out;
}

test('underscore usernames stay one mention beside a spaced name', function() {
    users.cg = 'chill_guy2';
    const t = 'hey @chill_guy2 meet @chill guy2';
    const html = render(t);
    assert.strictEqual(visible(html), t, html);
    assert.deepStrictEqual(chips(html), ['@chill_guy2', '@chill guy2'], html);
});

test('mention notifications resolve spaces, dots, and non-English letters', function() {
    users.ch = 'chill';
    users.sato = '佐藤';
    users.hy = 'cool-name';
    users.us = 'cool_name';
    users.cool = 'cool';
    users.dot = 'cool.name';
    assert.deepStrictEqual(mentionUids('@chill guy2 heyyy!'), ['u1']);
    assert.deepStrictEqual(mentionUids('@chill guy2!'), ['u1']);
    assert.deepStrictEqual(mentionUids('@chill guy2?'), ['u1']);
    assert.deepStrictEqual(mentionUids('@chill guy2, hello'), ['u1']);
    assert.deepStrictEqual(mentionUids('@chill hey'), ['ch']);
    assert.deepStrictEqual(mentionUids('@chill guy2 and @chill hey'), ['u1', 'ch']);
    assert.deepStrictEqual(mentionUids('@chillguy2 hey'), []);
    assert.deepStrictEqual(mentionUids('@José García hi!'), ['u5']);
    assert.deepStrictEqual(mentionUids('@佐藤 hello'), ['sato']);
    assert.deepStrictEqual(mentionUids('@佐藤 and @José García hi'), ['sato', 'u5']);
    assert.deepStrictEqual(mentionUids('@1f31e!'), ['u2']);
    users.cg = 'chill_guy2';
    assert.deepStrictEqual(mentionUids('@chill_guy2 hey'), ['cg']);
    assert.deepStrictEqual(mentionUids('@chill_guy2 and @chill guy2'), ['cg', 'u1']);
    assert.deepStrictEqual(mentionUids('@cool-name and @cool_name'), ['hy', 'us']);
    assert.deepStrictEqual(mentionUids('@cool.name hi'), ['dot']);
    assert.deepStrictEqual(mentionUids('@cool hi'), ['cool']);
    assert.deepStrictEqual(mentionUids('@cool.nameX'), ['cool']);
    assert.deepStrictEqual(mentionUids('@Big boss ross welcome'), ['u4']);
    assert.deepStrictEqual(mentionUids('@Big boss rossi welcome'), ['u3']);
    assert.deepStrictEqual(mentionUids('@chill guy2 @chill guy2'), ['u1']);
    assert.deepStrictEqual(mentionUids('chill guy2 heyyy'), []);
    assert.deepStrictEqual(mentionUids('@stranger says hi'), []);
});

test('mention notifications stay inside the chat cache and the rules id shape', function() {
    users.oMV6lAbCdEfGhIjKlMnOpQrSt = 'someone else';
    users['not a uid'] = 'Bad Actor';
    users['x/y'] = 'Slash Name';
    users['a'.repeat(65)] = 'Too Long Name';
    users['abc-def_12'] = 'ok hyphen';
    assert.deepStrictEqual(mentionUids('@chill guy2 please ping oMV6lAbCdEfGhIjKlMnOpQrSt'), ['u1']);
    assert.deepStrictEqual(mentionUids('hello oMV6lAbCdEfGhIjKlMnOpQrSt'), []);
    assert.deepStrictEqual(mentionUids('@Bad Actor hi'), []);
    assert.deepStrictEqual(mentionUids('@Slash Name hi'), []);
    assert.deepStrictEqual(mentionUids('@Too Long Name'), []);
    assert.deepStrictEqual(mentionUids('@ok hyphen'), ['abc-def_12']);
    const hits = context._chatMentionTargets('@chill guy2 hi');
    assert.strictEqual(hits.length, 1);
    assert.strictEqual(hits[0].name, 'chill guy2');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(users, hits[0].uid), true);
});

test('the client still notifies through the rules-checked writer', function() {
    const sendAt = raw.indexOf('// Notify @mentioned users');
    const sendEnd = raw.indexOf('db.collection(CHAT_COLLECTION).add(msgData)', sendAt);
    const block = raw.slice(sendAt, sendEnd);
    assert.ok(sendAt !== -1 && sendEnd > sendAt);
    assert.ok(block.includes('_chatMentionTargets(text)'));
    assert.ok(block.includes('notifyChatMention(_mentionTargets[_mti].uid, username, text.substring(0, 60))'));
    assert.strictEqual(block.includes('mentionUid'), false);
    assert.strictEqual(block.includes('/@([a-zA-Z0-9_-]+)/'), false);
    assert.strictEqual(raw.indexOf('/@([a-zA-Z0-9_-]+)/'), -1);
    const notif = fs.readFileSync(path.join(__dirname, '..', 'notifications.js'), 'utf8');
    const fn = notif.slice(notif.indexOf('window.notifyChatMention = function'), notif.indexOf('// Tab switching UI'));
    assert.ok(fn.includes('recipientUid === auth.currentUser.uid'));
    assert.ok(fn.includes("type: 'chat_mention'"));
    assert.ok(fn.includes(".collection('notifications')"));
    const functionsSrc = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    assert.ok(/mentioned !== data\.uid && \/\^\[A-Za-z0-9_-\]\{4,128\}\$\/\.test\(String\(mentioned\)\)/.test(functionsSrc));
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    assert.ok(rules.includes("return v is string && v.matches('^[A-Za-z0-9_-]{1,64}$');"));
    assert.ok(rules.includes('notifIdOk(request.resource.data.recipientId)'));
    const chatRule = rules.slice(rules.indexOf('match /global_chat/{msgId}'), rules.indexOf('match /notifications/{notifId}'));
    assert.strictEqual(chatRule.includes('mentionUid'), false);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
