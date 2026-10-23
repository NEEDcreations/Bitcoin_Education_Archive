// Satoshi's Favor window posts: once per window, no emails, no client writes.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const fa = require('../functions/src/favorAnnounce');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}
function later(name, fn) {
    return fn().then(function() {
        console.log('✅ ' + name);
        passed++;
    }).catch(function(e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    });
}

function memoryDb() {
    const docs = {};
    function makeDoc(docPath) {
        return {
            path: docPath,
            get: function() {
                const data = docs[docPath];
                return Promise.resolve({
                    exists: !!data,
                    data: function() { return data ? Object.assign({}, data) : undefined; },
                });
            },
            set: function(data, options) {
                if (options && options.merge && docs[docPath]) docs[docPath] = Object.assign({}, docs[docPath], data);
                else docs[docPath] = Object.assign({}, data);
                return Promise.resolve();
            },
            delete: function() {
                delete docs[docPath];
                return Promise.resolve();
            },
        };
    }
    return {
        docs: docs,
        collection: function(name) {
            return { doc: function(id) { return makeDoc(name + '/' + id); } };
        },
        runTransaction: function(fn) {
            const staged = [];
            const t = {
                get: function(ref) { return ref.get(); },
                set: function(ref, data, options) { staged.push({ ref: ref, data: data, options: options }); },
            };
            return Promise.resolve(fn(t)).then(function(result) {
                let chain = Promise.resolve();
                staged.forEach(function(row) {
                    chain = chain.then(function() { return row.ref.set(row.data, row.options); });
                });
                return chain.then(function() { return result; });
            });
        },
    };
}

const START = 1700000000000;
function liveState(extra) {
    return Object.assign({
        favorActive: true,
        currentCycleId: 'cycle_100',
        favorStart: START,
        favorEndBase: START + 60 * 60 * 1000,
        bonusMinutes: 0,
        uniqueHashers: 4,
        winnersThisWindow: [
            { username: 'Ada', uid: 'uid_secret' },
            { username: 'a@b.co', uid: 'uid_mail' },
        ],
    }, extra || {});
}

test('open text names the window and the hash link', function() {
    const text = fa.openText(12);
    assert.strictEqual(text, "⛏️ Satoshi's Favor is OPEN! Hash now for a shot at sats. Ends in 12 min → [Hash now](#favor)");
    assert.ok(text.indexOf('(#favor)') !== -1);
    assert.ok(!/https?:\/\//.test(text));
});

test('the same window is not opened twice', function() {
    const now = START + 60 * 1000;
    const state = liveState();
    const first = fa.planOpen(state, null, now);
    assert.strictEqual(first.post, true);
    assert.strictEqual(first.docId, undefined);
    assert.strictEqual(first.windowId, 'cycle_100');
    const marker = {};
    marker[fa.OPEN_FLAG] = true;
    const second = fa.planOpen(state, marker, now);
    assert.strictEqual(second.post, false);
    assert.strictEqual(second.reason, 'already_posted');
    const claim = fa.claimFavorPost(null, first);
    assert.strictEqual(claim.write, true);
    const again = fa.claimFavorPost(claim.markerPatch, first);
    assert.strictEqual(again.write, false);
    assert.strictEqual(again.reason, 'already_posted');
});

test('reminder is one last-5-minute post and only on a long window', function() {
    const end = START + 60 * 60 * 1000;
    const late = end - 4 * 60 * 1000;
    const state = liveState();
    const opened = {};
    opened[fa.OPEN_FLAG] = true;
    const due = fa.planReminder(state, opened, late, {});
    assert.strictEqual(due.post, true);
    assert.ok(due.text.indexOf('About 4 min left') !== -1);
    assert.ok(due.text.indexOf('Last 5 minutes') === -1);
    assert.strictEqual(due.docId, undefined);
    const extendedEnd = START + 90 * 60 * 1000;
    const extended = liveState({ bonusMinutes: 30, favorEndBase: START + 60 * 60 * 1000 });
    const extendedLate = extendedEnd - 4 * 60 * 1000;
    const moved = fa.planReminder(extended, opened, extendedLate, {});
    assert.strictEqual(moved.post, true);
    assert.ok(moved.text.indexOf('Last 5 minutes') === -1);
    assert.ok(moved.text.indexOf('About 4 min left') !== -1);
    const done = Object.assign({}, opened);
    done[fa.REMINDER_FLAG] = true;
    assert.strictEqual(fa.planReminder(state, done, late, {}).reason, 'already_posted');
    assert.strictEqual(fa.planReminder(state, opened, late, { openJustPosted: true }).reason, 'open_just_posted');
    assert.strictEqual(fa.planReminder(state, opened, START + 10 * 60 * 1000, {}).reason, 'not_yet');
    const short = liveState({ favorEndBase: START + 10 * 60 * 1000 });
    assert.strictEqual(fa.planReminder(short, opened, START + 6 * 60 * 1000, {}).reason, 'window_too_short');
});

test('recap uses public display names and drops emails and uids', function() {
    const plan = fa.planRecap(liveState(), null);
    assert.strictEqual(plan.post, true);
    assert.ok(plan.text.indexOf('@Ada') !== -1);
    assert.ok(plan.text.indexOf('4 plebs hashed') !== -1);
    assert.ok(plan.text.indexOf('a@b.co') === -1);
    assert.ok(plan.text.indexOf('@') === plan.text.indexOf('@Ada'));
    assert.ok(plan.text.indexOf('uid_secret') === -1);
    assert.ok(plan.text.indexOf('uid_mail') === -1);
    assert.strictEqual(fa.safeDisplayName('a@b.co'), '');
    assert.strictEqual(fa.planRecap(liveState(), { recapPosted: true }).reason, 'already_posted');
    const none = fa.recapText({ hashers: 0, winners: [], winnerCount: 0 });
    assert.ok(none.indexOf('No blocks') !== -1);
    assert.ok(none.indexOf('@') === -1);
});

test('push is once per window and only explicit device opt-ins', function() {
    const now = START + 1000;
    const state = liveState();
    assert.strictEqual(fa.planPush(state, null, now).send, true);
    assert.strictEqual(fa.planPush(state, { pushSent: true }, now).reason, 'already_sent');
    assert.strictEqual(fa.claimFlag({ pushSent: true }, fa.PUSH_FLAG).write, false);
    const rows = [
        { uid: 'user_ok', favor: true, hasDevice: true, master: true },
        { uid: 'user_ok', favor: true, hasDevice: true, master: true },
        { uid: 'user_off', favor: false, hasDevice: true, master: true },
        { uid: 'user_default', hasDevice: true, master: true },
        { uid: 'user_unset', favor: true, hasDevice: true },
        { uid: 'user_disabled', favor: true, hasDevice: true, master: true, satsDisabled: true },
        { uid: 'user_banned', favor: true, hasDevice: true, master: true, banned: true },
        { uid: 'user_reason', favor: true, hasDevice: true, master: true, banReason: 'spam' },
        { uid: 'user_ledger', favor: true, hasDevice: true, master: true, ledgerBanned: true },
        { uid: 'user_anon', favor: true, hasDevice: true, master: true, anonymous: true },
        { uid: 'user_master', favor: true, hasDevice: true, master: false },
        { uid: 'user_nodevice', favor: true, hasDevice: false, master: true },
        { uid: 'x', favor: true, hasDevice: true, master: true },
    ];
    const picked = fa.selectPushRecipients(rows);
    assert.deepStrictEqual(picked.map(function(r) { return r.uid; }), ['user_ok']);
    assert.strictEqual(picked[0].token, undefined);
    const msg = fa.favorPushPayload();
    assert.ok(msg.url.indexOf('#favor') !== -1);
    assert.ok(JSON.stringify(msg).indexOf('@') === -1);
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'favorAnnounce.js'), 'utf8');
    assert.strictEqual(src.indexOf('fcmToken'), -1);
    assert.strictEqual(src.indexOf('pushEnabled'), -1);
    assert.strictEqual(src.indexOf('pushToken'), -1);
    assert.ok(src.indexOf("send(recipients[i].uid, 'favor'") !== -1);
    assert.ok(src.indexOf('row.master !== true') !== -1);
    assert.ok(src.indexOf('ban_reason') !== -1);
});

test('live hasher count uses session lastHash and ignores stale rows', function() {
    const now = 500000;
    const cycle = 'cycle_100';
    const n = fa.countLiveHashers([
        { cycleId: cycle, lastHash: now - 1000 },
        { cycleId: cycle, lastHash: now - fa.PRESENCE_MS - 1 },
        { cycleId: 'other', lastHash: now - 1000 },
        { cycleId: cycle, lastHash: { toMillis: function() { return now - 5000; } } },
    ], cycle, now);
    assert.strictEqual(n, 2);
    const indexes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firestore.indexes.json'), 'utf8'));
    const hit = (indexes.indexes || []).filter(function(item) {
        return item.collectionGroup === 'session_hashes'
            && (item.fields || []).some(function(field) { return field.fieldPath === 'lastHash'; });
    });
    assert.strictEqual(hit.length, 1);
    assert.deepStrictEqual(hit[0].fields.map(function(field) { return field.fieldPath; }), ['cycleId', 'lastHash']);
});

test('hashForFavor rejects satsDisabled and ledger bans before rolling a hash', function() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'satoshiFavor.js'), 'utf8');
    const body = src.slice(src.indexOf('exports.hashForFavor'), src.indexOf('exports.checkFavorState'));
    const ban = body.indexOf('isSatsBanned');
    const accountBan = body.indexOf('userData.banned === true');
    const roll = body.indexOf('crypto.randomInt');
    const session = body.indexOf("collection('session_hashes')");
    const first = body.indexOf('sameWindow');
    const unique = body.indexOf('updatePayload.uniqueHashers');
    assert.ok(ban !== -1 && roll !== -1 && ban < roll);
    assert.ok(accountBan !== -1 && accountBan < roll);
    assert.ok(body.indexOf('SATS_BANNED_ERROR') !== -1);
    assert.ok(session !== -1 && first !== -1 && first < unique);
    const payout = body.indexOf('favorPayoutBlocked');
    const epochPay = body.indexOf('sfepoch_');
    assert.ok(payout !== -1 && epochPay !== -1 && payout < epochPay);
    const helper = src.slice(src.indexOf('async function favorPayoutBlocked'), src.indexOf('exports.hashForFavor'));
    assert.ok(helper.indexOf('ban_reason') !== -1);
    assert.ok(helper.indexOf('isSatsBanned') !== -1);
    assert.strictEqual(body.indexOf("doc('presence')"), -1);
    assert.strictEqual(body.indexOf('nextPresence'), -1);
    assert.strictEqual(body.indexOf('hashingNow'), -1);
});

test('client does not post the window and rules deny announcement writes', function() {
    const root = path.join(__dirname, '..');
    const client = fs.readFileSync(path.join(root, 'satoshi-favor.js'), 'utf8');
    assert.strictEqual(client.indexOf('_nachoSFAnnounce'), -1);
    assert.strictEqual(client.indexOf('announceDedup'), -1);
    assert.ok(client.indexOf('btc_sf_popup_') !== -1);
    assert.ok(client.indexOf('btc_sf_pill_') !== -1);
    assert.ok(client.indexOf("title.textContent = \"⛏️ Satoshi's Favor is active\"") !== -1 || client.indexOf('title.textContent = "⛏️ Satoshi\'s Favor is active"') !== -1);
    assert.ok(client.indexOf('sfFavorPopup') !== -1);
    assert.ok(client.indexOf('_sfMarkBubbleSeen()') !== -1);
    assert.ok(client.indexOf("e.key !== 'Escape'") !== -1);
    assert.strictEqual(client.indexOf("SATOSHI'S FAVOR IS ACTIVE"), -1);
    assert.strictEqual(client.indexOf('top:10px'), -1);
    assert.ok(client.indexOf('env(safe-area-inset-top, 0px)') !== -1);
    const favorSrc = fs.readFileSync(path.join(root, 'functions', 'src', 'satoshiFavor.js'), 'utf8');
    const indexSrc = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    assert.strictEqual((favorSrc.match(/mirror: \(o\) => mirrorShoutoutOnce\(o\)/g) || []).length, 2);
    assert.ok(favorSrc.indexOf('push: false') !== -1);
    const cron = indexSrc.slice(indexSrc.indexOf('exports.satoshiFavorAutoReset'), indexSrc.indexOf('TELEGRAM REACTION BRIDGE'));
    assert.strictEqual((cron.match(/mirror: \(o\) => mirrorShoutoutOnce\(o\)/g) || []).length, 2);
    assert.ok(cron.indexOf('eraHashes: stateData.eraHashes || 0') !== -1);
    assert.ok(cron.indexOf('refreshHashingNow') !== -1);
    const notes = fs.readFileSync(path.join(root, 'patch-notes.html'), 'utf8');
    assert.ok(notes.indexOf('now tells you when it') !== -1);
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    function block(start) {
        const at = rules.indexOf(start);
        assert.ok(at !== -1, start);
        return rules.slice(at, rules.indexOf('match /', at + start.length));
    }
    ['match /satoshiFavorAnnouncements/{windowId}', 'match /satoshiFavor/presence', 'match /satoshiFavor/announceDedup', 'match /satoshiFavor/current'].forEach(function(name) {
        const text = block(name);
        assert.ok(text.indexOf('allow write: if false') !== -1 || text.indexOf('allow read, write: if false') !== -1, name);
        assert.ok(!/allow create, update: if request\.auth/.test(text), name);
    });
});

test('Nacho search links hash now to the favor hashing screen', function() {
    const reg = require('../features.registry.js');
    const hit = reg.resolveNachoFeature('hash now');
    assert.ok(hit && hit.featureId === 'favor');
    assert.ok(hit.siteAction.indexOf("'favor'") !== -1);
    const search = reg.searchFeatures('start hashing').slice(0, 3).map(function(row) { return row.feature.id; });
    assert.ok(search.indexOf('favor') !== -1, search.join(','));
    const favor = reg.BY_ID.favor;
    assert.ok(favor.kw.indexOf('hash now') !== -1);
    assert.ok(favor.openFns.indexOf('openSatoshiFavorMiner') !== -1);
});

const sequence = later('publishing the open post is idempotent and mirrors once', async function() {
    const db = memoryDb();
    const mirrors = [];
    const state = liveState();
    const now = START + 60 * 1000;
    const plan = fa.planOpen(state, null, now);
    const opts = {
        mirror: function(args) {
            mirrors.push(args.docId);
            return Promise.resolve({ mirrored: true });
        },
    };
    const first = await fa.publishOnce(db, plan, opts);
    const second = await fa.publishOnce(db, plan, opts);
    assert.strictEqual(first.posted, true);
    assert.strictEqual(first.mirrored, true);
    assert.strictEqual(second.posted, false);
    assert.strictEqual(second.reason, 'already_posted');
    assert.deepStrictEqual(mirrors, [first.docId]);
    assert.ok(first.docId && first.docId.indexOf('sf_open_') !== 0);
    assert.strictEqual(db.docs['global_chat/' + first.docId].text, plan.text);
    assert.strictEqual(db.docs['satoshiFavorAnnouncements/cycle_100'].openPosted, true);
    assert.strictEqual(db.docs['satoshiFavorAnnouncements/cycle_100'].openChatId, first.docId);
    const chatDocs = Object.keys(db.docs).filter(function(k) { return k.indexOf('global_chat/') === 0; });
    assert.strictEqual(chatDocs.length, 1);
});

sequence.then(function() {
    return later('ensureLive posts open and push once, then only the reminder', async function() {
        const db = memoryDb();
        const mirrors = [];
        const pushes = [];
        const state = liveState();
        const opts = {
            nowMs: START + 60 * 1000,
            loadRecipients: function() {
                return Promise.resolve([
                    { uid: 'user_ok', favor: true, hasDevice: true, master: true },
                    { uid: 'user_no', favor: true, hasDevice: true, master: true, satsDisabled: true },
                ]);
            },
            sendUserPush: function(uid, category, payload) {
                pushes.push(uid + ':' + category + ':' + payload.url);
                return Promise.resolve({ sent: 1 });
            },
            mirror: function(args) {
                mirrors.push(args.docId);
                return Promise.resolve({ mirrored: true });
            },
            clearPresence: function() { return Promise.resolve(); },
        };
        let txs = 0;
        const origTx = db.runTransaction.bind(db);
        db.runTransaction = function(fn) { txs++; return origTx(fn); };
        await fa.ensureLive(db, state, opts);
        await fa.ensureLive(db, state, opts);
        assert.strictEqual(mirrors.length, 1);
        assert.ok(mirrors[0].indexOf('sf_open_') !== 0);
        assert.strictEqual(db.docs['satoshiFavorAnnouncements/cycle_100'].openChatId, mirrors[0]);
        assert.deepStrictEqual(pushes, ['user_ok:favor:https://bitcoineducation.quest/#favor']);
        const txsAfterOpen = txs;
        await fa.ensureLive(db, state, opts);
        assert.strictEqual(txs, txsAfterOpen);
        opts.nowMs = START + 56 * 60 * 1000;
        await fa.ensureLive(db, state, opts);
        await fa.ensureLive(db, state, opts);
        assert.strictEqual(mirrors.length, 2);
        assert.ok(mirrors[1].indexOf('sf_remind_') !== 0);
        assert.strictEqual(pushes.length, 1);
        opts.push = false;
        const beforeQuiet = pushes.length;
        await fa.ensureLive(db, state, opts);
        assert.strictEqual(pushes.length, beforeQuiet);
        db.docs['global_chat/sf_recap_cycle_100'] = { text: 'client junk', uid: 'attacker' };
        const closed = await fa.announceClosed(db, state, opts);
        const closedAgain = await fa.announceClosed(db, state, opts);
        assert.strictEqual(closed.posted, true);
        assert.strictEqual(closedAgain.posted, false);
        assert.notStrictEqual(closed.docId, 'sf_recap_cycle_100');
        assert.strictEqual(db.docs['global_chat/sf_recap_cycle_100'].text, 'client junk');
        assert.ok(db.docs['global_chat/' + closed.docId].text.indexOf('uid_secret') === -1);
        assert.strictEqual(db.docs['satoshiFavorAnnouncements/cycle_100'].recapChatId, closed.docId);
        assert.ok(mirrors.indexOf(closed.docId) !== -1);
    });
}).then(function() {
    return later('the window push goes through sendUserPush and stops after the marker', async function() {
        const db = memoryDb();
        db.docs['push_tokens/user_keep'] = { token: 'leave-this-parent' };
        const calls = [];
        const sent = await fa.sendPushOnce(db, liveState({ currentCycleId: 'cycle_user_keep' }), {
            nowMs: START + 1000,
            loadRecipients: function() {
                return Promise.resolve([{ uid: 'user_keep', favor: true, hasDevice: true, master: true }]);
            },
            sendUserPush: function(uid, category, payload) {
                calls.push(uid + ':' + category + ':' + (payload && payload.url));
                return Promise.resolve({ sent: 1, reason: 'rate' });
            },
        });
        assert.strictEqual(sent.sent, 1);
        assert.deepStrictEqual(calls, ['user_keep:favor:https://bitcoineducation.quest/#favor']);
        assert.ok(db.docs['push_tokens/user_keep']);
        const skipped = await fa.sendPushOnce(db, liveState({ currentCycleId: 'cycle_skip' }), {
            nowMs: START + 1000,
            marker: { pushSent: true },
            loadRecipients: function() { throw new Error('should not load'); },
            sendUserPush: function() { throw new Error('should not send'); },
        });
        assert.strictEqual(skipped.reason, 'already_sent');
    });
}).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
