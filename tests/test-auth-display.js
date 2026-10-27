// Display snapshot: sign-out and uid mismatch must drop it.
// The stored object is display-only and cannot carry private fields.
const assert = require('assert');
const display = require('../auth-display.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function mem() {
    var data = {};
    return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
        setItem: function (k, v) { data[k] = String(v); },
        removeItem: function (k) { delete data[k]; },
        dump: function () { return data; }
    };
}

test('write keeps only display fields', () => {
    const storage = mem();
    const snap = display.write({
        uid: 'userUid123456',
        username: 'MeasurePleb',
        avatar: 'https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg?alt=media',
        xp: 2500,
        email: 'secret@example.com',
        lightning: 'pleb@getalby.com',
        admin: true,
        idToken: 'tok',
        refreshToken: 'ref',
        stsTokenManager: { accessToken: 'nope' }
    }, storage);
    assert.deepStrictEqual(Object.keys(snap).sort(), ['avatar', 'level', 'uid', 'username', 'xp']);
    const raw = JSON.parse(storage.getItem(display.KEY));
    assert.strictEqual(raw.email, undefined);
    assert.strictEqual(raw.lightning, undefined);
    assert.strictEqual(raw.admin, undefined);
    assert.strictEqual(raw.idToken, undefined);
    assert.strictEqual(raw.refreshToken, undefined);
    assert.strictEqual(raw.stsTokenManager, undefined);
    assert.strictEqual(raw.username, 'MeasurePleb');
    assert.strictEqual(raw.level, 'Maxi');
    assert.strictEqual(raw.xp, 2500);
    assert.ok(raw.avatar.indexOf('https://firebasestorage.googleapis.com/') === 0);
});

test('unsafe avatar and private-looking urls are dropped', () => {
    assert.strictEqual(display.safeAvatar('javascript:alert(1)'), '');
    assert.strictEqual(display.safeAvatar('https://evil.example/a.png'), '');
    assert.strictEqual(display.safeAvatar('data:image/png;base64,aaaa'), '');
    const storage = mem();
    const snap = display.write({
        uid: 'userUid123456',
        username: 'Pleb',
        profilePic: 'https://evil.example/a.png',
        points: 10
    }, storage);
    assert.strictEqual(snap.avatar, '');
    assert.strictEqual(snap.level, 'Curious');
});

test('clear on sign-out removes the snapshot', () => {
    const storage = mem();
    display.write({ uid: 'userUid123456', username: 'MeasurePleb', xp: 144 }, storage);
    assert.ok(display.read(storage));
    const signedOut = display.plan(display.read(storage), null);
    assert.strictEqual(signedOut.action, 'clear');
    assert.strictEqual(signedOut.reason, 'signed-out');
    assert.strictEqual(signedOut.snapshot, null);
    display.clear(storage);
    assert.strictEqual(display.read(storage), null);
    assert.strictEqual(storage.getItem(display.KEY), null);
    const anon = display.plan({ uid: 'userUid123456', username: 'MeasurePleb', xp: 1 }, { uid: 'userUid123456', isAnonymous: true });
    assert.strictEqual(anon.action, 'clear');
    assert.strictEqual(anon.reason, 'signed-out');
});

test('uid mismatch clears and does not keep the previous account', () => {
    const stored = { uid: 'userUidAAAAAA', username: 'Alice', xp: 5000, email: 'alice@example.com' };
    const decision = display.plan(stored, { uid: 'userUidBBBBBB', isAnonymous: false });
    assert.strictEqual(decision.action, 'clear');
    assert.strictEqual(decision.reason, 'uid-mismatch');
    assert.strictEqual(decision.snapshot, null);
    const storage = mem();
    display.write({ uid: 'userUidAAAAAA', username: 'Alice', xp: 5000 }, storage);
    const next = display.plan(display.read(storage), { uid: 'userUidBBBBBB' });
    assert.strictEqual(next.action, 'clear');
    display.clear(storage);
    assert.strictEqual(display.read(storage), null);
    const same = display.plan({ uid: 'userUidAAAAAA', username: 'Alice', xp: 5000, email: 'alice@example.com' }, { uid: 'userUidAAAAAA' });
    assert.strictEqual(same.action, 'keep');
    assert.strictEqual(same.snapshot.username, 'Alice');
    assert.strictEqual(same.snapshot.email, undefined);
});

test('pending auth keeps the display, and the module does not touch rewards', () => {
    const pending = display.plan({ uid: 'userUid123456', username: 'MeasurePleb', xp: 10 }, undefined);
    assert.strictEqual(pending.action, 'show');
    assert.strictEqual(pending.snapshot.username, 'MeasurePleb');
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'auth-display.js'), 'utf8');
    assert.ok(src.indexOf('awardPoints') === -1);
    assert.ok(src.indexOf('rankingReady') === -1);
    assert.ok(src.indexOf('_isAdminClaim') === -1);
    assert.ok(src.indexOf('httpsCallable') === -1);
});

test('ranking drops the snapshot on sign-out, delete, and a different uid', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8');
    const signOutAt = src.indexOf('async function signOutUser');
    const signOut = src.slice(signOutAt, signOutAt + 2800);
    assert.ok(signOut.indexOf('clearAuthDisplay()') !== -1);
    assert.ok(signOut.indexOf('clearAuthDisplay()') < signOut.indexOf('auth.signOut()'));
    const delAt = src.indexOf('window.confirmDeleteAccount');
    const del = src.slice(delAt, delAt + 4500);
    assert.ok(del.indexOf('clearAuthDisplay()') !== -1);
    const listenAt = src.indexOf('auth.onAuthStateChanged(user => {');
    const listen = src.slice(listenAt, listenAt + 2500);
    assert.ok(listen.indexOf('prevUid !== user.uid') !== -1);
    assert.ok(listen.indexOf('clearAuthDisplay()') !== -1);
    const pubAt = src.indexOf('function publishAuthDisplay');
    const pub = src.slice(pubAt, pubAt + 700);
    assert.ok(pub.indexOf('auth.currentUser.uid !== uid') !== -1);
    assert.ok(pub.indexOf('isAnonymous') !== -1);
    assert.ok(pub.indexOf('awardPoints') === -1);
    assert.ok(pub.indexOf('httpsCallable') === -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
