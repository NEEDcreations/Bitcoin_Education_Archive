#!/usr/bin/env node
'use strict';
// PvP guest rules (Phil 1A, Nov 18, 2026): a match against a guest pays
// nobody. Guest status is stamped once at create time, and settle, badges and
// the played count read only that stamp, so linking a sign-in method before a
// (possibly kill-switch-deferred) settle pays nothing. Also: the shared guest
// definition, create caps, guest battle names.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pvpFlow = require(path.join(root, 'functions', 'src', 'pvpFlow.js'));
const guestPolicy = require(path.join(root, 'functions', 'src', 'guestPolicy.js'));
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + '\n   ' + (e && e.stack ? e.stack : e)); failed++; }
}
function ctx(provider, identities) {
    return { auth: { uid: 'u1', token: { firebase: { sign_in_provider: provider, identities: identities || {} } } } };
}

// ---- shared guest definition ----
test('guest: no session, anonymous, and username-only (anonymous + profile) are guests', function () {
    assert.strictEqual(guestPolicy.isGuestContext(null), true);
    assert.strictEqual(guestPolicy.isGuestContext({}), true);
    assert.strictEqual(guestPolicy.isGuestContext(ctx('anonymous')), true);
    assert.strictEqual(guestPolicy.isGuestContext(ctx('')), true);
});
for (const p of ['password', 'emailLink', 'google.com', 'twitter.com', 'github.com', 'facebook.com', 'phone', 'custom']) {
    test('logged in: sign_in_provider ' + p, function () {
        assert.strictEqual(guestPolicy.isGuestContext(ctx(p)), false);
    });
}
test('logged in: anonymous session that already has a real provider linked', function () {
    assert.strictEqual(guestPolicy.isGuestContext(ctx('anonymous', { 'google.com': ['1'], email: ['a@b.c'] })), false);
});
test('record: email alone (no provider) is a guest; providers and Nostr/Lightning are not', function () {
    assert.strictEqual(guestPolicy.isGuestRecord({ uid: 'x', email: 'a@b.c', providerData: [] }, {}), true);
    assert.strictEqual(guestPolicy.isGuestRecord({ uid: 'x', providerData: [] }, { username: 'bob' }), true);
    assert.strictEqual(guestPolicy.isGuestRecord({ uid: 'x', providerData: [{ providerId: 'password' }] }, {}), false);
    assert.strictEqual(guestPolicy.isGuestRecord({ uid: 'nostr:ab', providerData: [] }, {}), false);
    assert.strictEqual(guestPolicy.isGuestRecord({ uid: 'ln:02ab', providerData: [] }, {}), false);
    assert.strictEqual(guestPolicy.isGuestRecord({ uid: 'x', providerData: [] }, { signInLinks: ['nostr'] }), false);
    assert.strictEqual(guestPolicy.isGuestRecord({ uid: 'x', providerData: [] }, { signInLinks: ['lightning'] }), false);
    assert.strictEqual(guestPolicy.isGuestRecord(null, {}), true);
});
test('pvpAccountFlags uses the shared record rule, not "has email"', function () {
    const src = read('functions/index.js');
    const i = src.indexOf('async function pvpAccountFlags');
    const body = src.slice(i, i + 1400);
    assert.ok(/guestPolicy\.isGuestRecord\(authUser/.test(body));
    assert.ok(!/!authUser\.email/.test(body));
});

// ---- stamp ----
test('stamp: either guest makes a guest match; missing stamp fails closed', function () {
    assert.deepStrictEqual(pvpFlow.planGuestStamp(false, false), { version: 1, player1: false, player2: false, guestMatch: false });
    assert.strictEqual(pvpFlow.planGuestStamp(false, true).guestMatch, true);
    assert.strictEqual(pvpFlow.planGuestStamp(true, false).guestMatch, true);
    assert.strictEqual(pvpFlow.readGuestStamp(null).guestMatch, true);
    assert.strictEqual(pvpFlow.readGuestStamp({}).missing, true);
    assert.strictEqual(pvpFlow.readGuestStamp({ guestStamp: { version: 1, player1: 'no', player2: false } }).guestMatch, true);
    assert.strictEqual(pvpFlow.readGuestStamp({ guestStamp: pvpFlow.planGuestStamp(false, false) }).guestMatch, false);
});

function finished() {
    return {
        status: 'finished',
        player1: { uid: 'p1', score: 300, answers: [{ won: true }, { won: true }, { won: true }] },
        player2: { uid: 'p2', score: 0, answers: [{ won: false }, { won: false }, { won: false }] },
    };
}
function keyDoc(stamp) {
    return { playerUids: { player1: 'p1', player2: 'p2' }, player1Name: 'Alice', player2Name: 'Guest', guestStamp: stamp };
}

test('link before settle (settle deferred by the kill switch) pays nothing', function () {
    // Create time: p2 is a guest, so the stamp says guest match.
    const stamp = pvpFlow.planGuestStamp(false, true);
    // The kill switch defers settle. Meanwhile the guest links Google, so
    // live Auth now says both are signed in.
    const liveFlags1 = { banned: false, anonymous: false };
    const liveFlags2 = { banned: false, anonymous: false };
    const r = pvpFlow.settleRewardPlan({ matchId: 'm1', after: finished(), keyData: keyDoc(stamp), flags1: liveFlags1, flags2: liveFlags2 });
    assert.strictEqual(r.plan.grant, false);
    assert.strictEqual(r.plan.reason, 'guest_match');
    r.plan.players.forEach(function (p) { assert.strictEqual(p.points, 0); assert.strictEqual(p.pvpWins, 0); assert.strictEqual(p.pvpLosses, 0); });
});
test('a stamped signed-in match still pays the winner', function () {
    const r = pvpFlow.settleRewardPlan({ matchId: 'm2', after: finished(), keyData: keyDoc(pvpFlow.planGuestStamp(false, false)), flags1: {}, flags2: {} });
    assert.strictEqual(r.plan.grant, true);
    const w = r.plan.players.find(function (p) { return p.uid === 'p1'; });
    assert.strictEqual(w.points, pvpFlow.WIN_POINTS);
});
test('signed-in at create, live Auth says anonymous later: stamp still decides', function () {
    const r = pvpFlow.settleRewardPlan({ matchId: 'm3', after: finished(), keyData: keyDoc(pvpFlow.planGuestStamp(false, false)), flags1: { anonymous: true }, flags2: { anonymous: true } });
    assert.strictEqual(r.plan.grant, true);
});
test('a match with no stamp (created before this change) pays nothing', function () {
    const r = pvpFlow.settleRewardPlan({ matchId: 'm4', after: finished(), keyData: keyDoc(undefined), flags1: {}, flags2: {} });
    assert.strictEqual(r.plan.grant, false);
});
test('a forfeit against a guest pays nothing', function () {
    const after = Object.assign(finished(), { status: 'forfeit', forfeitedBy: 'p2', forfeitReason: 'manual_leave' });
    const r = pvpFlow.settleRewardPlan({ matchId: 'm5', after: after, keyData: keyDoc(pvpFlow.planGuestStamp(false, true)), flags1: {}, flags2: {} });
    assert.strictEqual(r.plan.grant, false);
});

test('index.js: create stamps the key doc and match doc; settle and badges read only the stamp', function () {
    const src = read('functions/index.js');
    const c = src.slice(src.indexOf('exports.pvpCreateMatch ='), src.indexOf('// ── Scholar Exam'));
    assert.ok(/guestStamp: guestStamp/.test(c), 'key doc stamp');
    assert.ok(/guestMatch: guestStamp\.guestMatch/.test(c), 'match doc stamp');
    assert.ok(/guest: guestStamp\.player1/.test(c) && /guest: guestStamp\.player2/.test(c));
    const st = src.slice(src.indexOf('async function settlePvpMatch'), src.indexOf('async function settlePvpMatch') + 2000);
    assert.ok(/pvpFlow\.settleRewardPlan\(/.test(st));
    const fin = src.slice(src.indexOf('exports.onPvpMatchFinished'), src.indexOf('exports.onPvpMatchFinished') + 3000);
    assert.ok(/readGuestStamp/.test(fin));
    assert.ok(!/pvpAccountFlags/.test(fin), 'onPvpMatchFinished must not read live Auth');
    assert.ok(/guestMatch: stamp\.guestMatch/.test(fin));
});

// ---- caps ----
test('caps: a guest match never charges a waiting signed-in player1; global and network caps apply', function () {
    const g = pvpFlow.planMatchCharges({ p1Guest: false, p2Guest: true, hasNetwork: true });
    assert.ok(!g.some(function (c) { return c.who === 'player1'; }), 'signed-in p1 not charged');
    assert.ok(g.some(function (c) { return c.who === 'player2' && c.max === 20; }));
    assert.ok(g.some(function (c) { return c.who === 'global' && c.max === pvpFlow.PVP_ANON_GLOBAL_PER_HOUR; }));
    assert.ok(g.some(function (c) { return c.who === 'network' && c.max === pvpFlow.PVP_ANON_NETWORK_PER_HOUR; }));
    const s = pvpFlow.planMatchCharges({ p1Guest: false, p2Guest: false, hasNetwork: true });
    assert.deepStrictEqual(s.map(function (c) { return c.who; }).sort(), ['player1', 'player2']);
});
test('caps (K10a): a signed-in caller starting a guest match spends their own hourly cap and the network bucket', function () {
    const g2 = pvpFlow.planMatchCharges({ p1Guest: true, p2Guest: false, hasNetwork: true });
    const who = g2.map(function (c) { return c.who; }).sort();
    assert.deepStrictEqual(who, ['global', 'network', 'player1', 'player2']);
    assert.ok(g2.some(function (c) { return c.who === 'player2' && c.bucket === 'match_hour' && c.max === 60; }), 'signed-in caller charged at the signed-in cap');
    assert.ok(g2.some(function (c) { return c.who === 'player1' && c.max === 20; }));
    assert.ok(g2.some(function (c) { return c.who === 'network' && c.max === pvpFlow.PVP_ANON_NETWORK_PER_HOUR; }));
    const noIp = pvpFlow.planMatchCharges({ p1Guest: true, p2Guest: false, hasNetwork: false });
    assert.ok(!noIp.some(function (c) { return c.who === 'network'; }), 'no network charge without an IP');
    const both = pvpFlow.planMatchCharges({ p1Guest: true, p2Guest: true, hasNetwork: true });
    assert.deepStrictEqual(both.map(function (c) { return c.who; }).sort(), ['global', 'network', 'player1', 'player2']);
});
test('caps (K10a): 15 anonymous lobbies from one signed-in caller stop at the caller and network caps, far below the global bucket', function () {
    // Simulate one signed-in caller (one IP) joining fresh anonymous lobby uids.
    const buckets = {};
    let made = 0;
    for (let i = 0; i < 500; i++) {
        const charges = pvpFlow.planMatchCharges({ p1Guest: true, p2Guest: false, hasNetwork: true });
        const keys = charges.map(function (c) {
            if (c.who === 'player1') return 'p1_' + i; // a fresh anonymous uid each time
            if (c.who === 'player2') return 'caller';
            return c.who;
        });
        const ok = charges.every(function (c, ci) { return (buckets[keys[ci]] || 0) < c.max; });
        if (!ok) continue;
        keys.forEach(function (k) { buckets[k] = (buckets[k] || 0) + 1; });
        made++;
    }
    assert.strictEqual(made, pvpFlow.PVP_ANON_NETWORK_PER_HOUR);
    assert.ok(buckets.global < pvpFlow.PVP_ANON_GLOBAL_PER_HOUR / 5, 'global bucket left for everyone else');
});
test('index.js (K10a): the network bucket is computed for any guest match, not only a guest caller', function () {
    const src = read('functions/index.js');
    const c = src.slice(src.indexOf('exports.pvpCreateMatch ='), src.indexOf('// ── Scholar Exam'));
    assert.ok(/if \(guestStamp\.guestMatch && createIp\)/.test(c));
    assert.ok(!/if \(callerGuest && createIp\)/.test(c));
    assert.ok(c.indexOf('const guestStamp = pvpFlow.planGuestStamp') < c.indexOf('guestStamp.guestMatch && createIp'));
});

// ---- lobby summary work cap (K10b) ----
test('lobby (K10b): create, delete and status changes count; heartbeats do not', function () {
    const w = { uid: 'a', status: 'waiting', lastSeen: 1 };
    assert.strictEqual(pvpFlow.isLobbyStructuralEvent(null, w), true);
    assert.strictEqual(pvpFlow.isLobbyStructuralEvent(w, null), true);
    assert.strictEqual(pvpFlow.isLobbyStructuralEvent(w, Object.assign({}, w, { status: 'matched' })), true);
    assert.strictEqual(pvpFlow.isLobbyStructuralEvent(w, Object.assign({}, w, { lastSeen: 9000 })), false);
    assert.strictEqual(pvpFlow.isLobbyStructuralEvent(null, null), false);
});
test('lobby (K10b): the per-uid window allows about 6 events a minute, then skips until the window resets', function () {
    assert.strictEqual(pvpFlow.PVP_LOBBY_EVENTS_PER_MIN, 6);
    let doc = null;
    const t0 = 1000000;
    const results = [];
    for (let i = 0; i < 10; i++) {
        const p = pvpFlow.planLobbyEventWindow(doc, t0 + i * 1000);
        results.push(p.ok);
        if (p.ok) doc = Object.assign({}, doc || {}, p.write, { lastLobbyShoutMs: 5 });
    }
    assert.deepStrictEqual(results, [true, true, true, true, true, true, false, false, false, false]);
    assert.strictEqual(doc.lastLobbyShoutMs, 5, 'shares pvp_rate/{uid} with the shout timer without clobbering it');
    const later = pvpFlow.planLobbyEventWindow(doc, t0 + pvpFlow.PVP_LOBBY_EVENTS_WINDOW_MS + 1);
    assert.strictEqual(later.ok, true);
    assert.strictEqual(later.write.lobbyCount, 1);
});
test('index.js (K10b): syncPvpLobbyLive caps per uid before the Auth lookup and skips the summary transaction for blocked players', function () {
    const src = read('functions/index.js');
    const start = src.indexOf('async function syncPvpLobbyLive');
    const fn = src.slice(start, src.indexOf('exports.onPvpLobbyLive'));
    const rate = fn.indexOf('pvpLobbyEventAllowed(docId, now)');
    const auth = fn.indexOf('pvpAccountFlags(docId)');
    const tx = fn.indexOf('db.runTransaction');
    assert.ok(rate > 0 && auth > rate, 'rate window before the Auth lookup');
    assert.ok(/isLobbyStructuralEvent\(before, after\)/.test(fn));
    const blockedReturn = fn.indexOf('if (blocked && !(await summaryRow())) return;');
    assert.ok(blockedReturn > auth && blockedReturn < tx, 'blocked players return before the transaction');
    const leaveReturn = fn.indexOf("if ((!after || after.status !== 'waiting') && !(await summaryRow())) return;");
    assert.ok(leaveReturn > 0 && leaveReturn < tx, 'a leave with no summary row skips the transaction');
    const helper = src.slice(src.indexOf('async function pvpLobbyEventAllowed'), start);
    assert.ok(/collection\('pvp_rate'\)\.doc\(docId\)/.test(helper));
    assert.ok(/planLobbyEventWindow/.test(helper) && /merge: true/.test(helper));
});

test('index.js: hourly caps are charged inside the claim transaction', function () {
    const src = read('functions/index.js');
    const c = src.slice(src.indexOf('exports.pvpCreateMatch ='), src.indexOf('// ── Scholar Exam'));
    const tx = c.indexOf('db.runTransaction');
    assert.ok(tx > 0);
    assert.ok(c.indexOf('pvpTxCharge(') > tx, 'charge inside the transaction');
    assert.ok(!/pvpRateLimit\([^)]*'match_hour'/.test(c), 'no out-of-transaction hour charge');
    assert.ok(/pvp_anon_global_/.test(c) && /pvp_anon_net_/.test(c));
});

// ---- names ----
test('names: staff and brand names are replaced, with look-alikes and case folded', function () {
    ['Phil', 'phil', 'RealPhil', 'ph1l', 'PHIL official', 'NEEDcreations', 'N33Dcreati0ns', 'Nacho', 'N\u0430cho', 'Rufus',
        'rufus bot', 'admin', 'Adm1n', 'mod', 'Staff', 'Bitcoin Quest', 'BitcoinQuest', 'b1tc0in qu3st', 'Bitcoin Education', 'Support',
        '603btc', '603BTC', '6o3btc'].forEach(function (n) {
        assert.strictEqual(pvpFlow.guestBattleName(n), pvpFlow.GUEST_FALLBACK_NAME, n);
    });
    ['alice', 'Satoshi', 'philosopher', 'modern', 'Hodler 21', 'bqfan'].forEach(function (n) {
        assert.notStrictEqual(pvpFlow.guestBattleName(n), pvpFlow.GUEST_FALLBACK_NAME, n);
    });
});
test('names: rufus and 603btc stay substring-blocked for guest battle names only', function () {
    // Username policy treats rufus and 603btc as whole names (rufusfan is
    // allowed as a username). Guest battle names keep the existing substring
    // policy, so rufusfan and 603btcfoo are still replaced.
    ['rufusfan', 'RUFU5fan', 'xx603btc', '603BTCfoo'].forEach(function (n) {
        assert.strictEqual(pvpFlow.guestBattleName(n), pvpFlow.GUEST_FALLBACK_NAME, n);
    });
});
test('names: markup and quote characters are stripped like the rules refuse them', function () {
    const n = pvpFlow.safeDisplayName('<b>"x\'</b>');
    assert.ok(!/[<>"']/.test(n), n);
    const rules = read('firestore.rules');
    const m = rules.slice(rules.indexOf('match /pvp_lobby/{docId}'), rules.indexOf('match /pvp_lobby/{docId}') + 2500);
    assert.ok(m.indexOf('<>') > 0 && m.indexOf('~|') > 0, 'lobby regex refuses < > ~ |');
    assert.ok(/pvpLobbyNameAllowed/.test(m));
});
test('client: shows the server-written names and the stamped guest note', function () {
    const src = read('pvp.js.src');
    assert.ok(/pvpState\.opponentName = String\(data\[oppKey\]\.name\)/.test(src));
    assert.ok(/pvpState\.myName = String\(data\[myKey\]\.name\)/.test(src));
    assert.ok(/Your opponent played as a guest/.test(src));
    assert.ok(/You played this match as a guest/.test(src));
});

// ---- answer caps ----
test('caps: every answer charges the uid; guests also charge the network when an IP is present', function () {
    const signed = pvpFlow.planAnswerCharges({ guest: false, hasNetwork: true });
    assert.deepStrictEqual(signed.map(function (c) { return c.who; }), ['player']);
    assert.strictEqual(signed[0].max, pvpFlow.PVP_ANSWER_PER_MIN);
    const guestNoIp = pvpFlow.planAnswerCharges({ guest: true, hasNetwork: false });
    assert.deepStrictEqual(guestNoIp.map(function (c) { return c.who; }), ['player']);
    const guest = pvpFlow.planAnswerCharges({ guest: true, hasNetwork: true });
    assert.ok(guest.some(function (c) { return c.who === 'player' && c.max === pvpFlow.PVP_ANSWER_PER_MIN; }));
    assert.ok(guest.some(function (c) { return c.bucket === 'anon_ans_min' && c.max === pvpFlow.PVP_ANON_ANSWER_NETWORK_PER_MIN; }));
    assert.ok(guest.some(function (c) { return c.bucket === 'anon_ans_hour' && c.max === pvpFlow.PVP_ANON_ANSWER_NETWORK_PER_HOUR; }));
});
test('index.js: answer submit charges the uid and, for a guest, the hashed-IP buckets', function () {
    const src = read('functions/index.js');
    const c = src.slice(src.indexOf('exports.pvpSubmitAnswer ='), src.indexOf('exports.pvpTimeoutOpponent ='));
    assert.ok(/pvpRateLimit\(uid, 'answer', pvpFlow\.PVP_ANSWER_PER_MIN/.test(c));
    assert.ok(/isAnonymousAuth\(context\)/.test(c));
    assert.ok(/pvp_anon_ans_min_/.test(c) && /pvp_anon_ans_hour_/.test(c));
    assert.ok(/networkRateDocId/.test(c));
});

// ---- K11: server opponent name ----
test('K11: pvpCreateMatch returns the server-checked opponent name and the client uses it, not the lobby name', function () {
    const src = read('functions/index.js');
    const c = src.slice(src.indexOf('exports.pvpCreateMatch ='), src.indexOf('// ── Scholar Exam'));
    assert.ok(/opponentName = p1Name;/.test(c));
    assert.ok(/return \{ matchId: matchRef\.id, guestMatch: guestStamp\.guestMatch, opponentName: opponentName \}/.test(c));
    const client = read('pvp.js.src');
    assert.ok(!/pvpState\.opponentName = \(waitingData && waitingData\.name\)/.test(client), 'raw lobby name not shown');
    assert.ok(/pvpState\.opponentName = \(res\.data && typeof res\.data\.opponentName === 'string' && res\.data\.opponentName\) \|\| 'Opponent'/.test(client));
});
test('K11: the pvp_lobby create rule applies the name list to everyone (no server-username bypass)', function () {
    const rules = read('firestore.rules');
    assert.ok(!/pvpHasServerUsername/.test(rules));
    const m = rules.slice(rules.indexOf('match /pvp_lobby/{docId}'), rules.indexOf('match /pvp_lobby_live/{docId}'));
    assert.ok(/&& pvpLobbyNameAllowed\(request\.resource\.data\.name\)/.test(m));
});

// ---- K12: guest quick battle names ----
function loadClientNameHelpers(opts) {
    const src = read('pvp.js.src');
    function grab(name) {
        const i = src.indexOf('    function ' + name + '(');
        assert.ok(i > 0, name);
        const j = src.indexOf('\n    }\n', i);
        return src.slice(i, j + 6);
    }
    const body = grab('pvpCleanName') + grab('pvpNameReserved') + grab('lobbyDisplayName') +
        'return { pvpCleanName: pvpCleanName, pvpNameReserved: pvpNameReserved, lobbyDisplayName: lobbyDisplayName };';
    // eslint-disable-next-line no-new-func
    return new Function('getMyDisplayName', 'isPvpGuest', 'currentUser', body)(
        function () { return opts.name; }, function () { return opts.guest; }, opts.currentUser);
}
test('K12: a guest with a reserved quick name gets Guest Bitcoiner even when currentUser.username is set', function () {
    const h = loadClientNameHelpers({ name: 'Nacho Fan', guest: true, currentUser: { username: 'Nacho Fan' } });
    assert.strictEqual(h.lobbyDisplayName(), 'Guest Bitcoiner');
    const plain = loadClientNameHelpers({ name: 'Hodler 21', guest: true, currentUser: { username: 'Hodler 21' } });
    assert.strictEqual(plain.lobbyDisplayName(), 'Hodler 21');
    ['Phil', 'real phil', 'NEEDcreations', 'Rufus', 'admin', 'Bitcoin Quest', 'mod', '603btc'].forEach(function (n) {
        assert.strictEqual(h.pvpNameReserved(n), true, n);
    });
    ['Hodler 21', 'philosopher', 'modern', 'Satoshi'].forEach(function (n) {
        assert.strictEqual(h.pvpNameReserved(n), false, n);
    });
});
test('K12: a logged-in player whose username trips the list sends a plain lobby name (the match uses the username)', function () {
    const h = loadClientNameHelpers({ name: 'nachofan', guest: false, currentUser: { username: 'nachofan' } });
    assert.strictEqual(h.lobbyDisplayName(), 'Bitcoiner');
    const ok = loadClientNameHelpers({ name: 'satoshi21', guest: false, currentUser: { username: 'satoshi21' } });
    assert.strictEqual(ok.lobbyDisplayName(), 'satoshi21');
});
test('K12: the quick-name submit refuses reserved names and never writes currentUser.username', function () {
    const src = read('pvp.js.src');
    const sub = src.slice(src.indexOf('window.pvpQuickNameSubmit'), src.indexOf('window.enterPVPMode'));
    const reserved = sub.indexOf('pvpNameReserved(');
    const signIn = sub.indexOf('signInAnonymously');
    assert.ok(reserved > 0 && reserved < signIn, 'reserved check before anonymous sign-in');
    assert.ok(/That name is reserved/.test(sub));
    assert.ok(!/currentUser\.username\s*=/.test(sub));
    const enter = src.slice(src.indexOf('window.enterPVPMode'), src.indexOf('window.enterPVPMode') + 2000);
    assert.ok(!/currentUser\.username\s*=/.test(enter));
    const ldn = src.slice(src.indexOf('function lobbyDisplayName'), src.indexOf('function addToLobbyAndListen'));
    const code = ldn.split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
    assert.ok(/isPvpGuest\(\)/.test(code) && !/currentUser/.test(code));
});


// ---- K14: leaving a tied match resets the leaver's win streak ----
// Mirrors the settle transaction: streaks change only for a granted plan and
// only through planStreakUpdate(streak, best, outcome, leaver).
function applySettleStreaks(users, after, stamp, matchId) {
    const r = pvpFlow.settleRewardPlan({ matchId: matchId, after: after, keyData: keyDoc(stamp), flags1: {}, flags2: {} });
    if (!r.plan.grant) return r;
    r.plan.players.forEach(function (p) {
        const u = users[p.uid] || {};
        const st = pvpFlow.planStreakUpdate(u.pvpWinStreak, u.pvpBestStreak, p.outcome, p.leaver === true);
        users[p.uid] = Object.assign({}, u, st);
    });
    return r;
}
function tiedLeave(leaver, wins) {
    const n = wins || 0;
    const a = []; const b = [];
    for (let i = 0; i < n; i++) { a.push({ won: true }); b.push({ won: true }); }
    return {
        status: 'forfeit', forfeitedBy: leaver, forfeitReason: 'manual_leave',
        player1: { uid: 'p1', score: 0, answers: a },
        player2: { uid: 'p2', score: 0, answers: b.concat([{ won: false }]) },
    };
}
function drawMatch() {
    return {
        status: 'finished',
        player1: { uid: 'p1', score: 200, answers: [{ won: true }, { won: false }] },
        player2: { uid: 'p2', score: 200, answers: [{ won: false }, { won: true }] },
    };
}
const signedIn = function () { return pvpFlow.planGuestStamp(false, false); };

test('K14: a tied leave (0-0) resets only the leaver\'s streak', function () {
    const users = { p1: { pvpWinStreak: 2, pvpBestStreak: 2 }, p2: { pvpWinStreak: 2, pvpBestStreak: 4 } };
    const r = applySettleStreaks(users, tiedLeave('p1', 0), signedIn(), 'k14a');
    assert.strictEqual(r.plan.reason, 'forfeit_void');
    assert.strictEqual(r.plan.players.find(function (p) { return p.uid === 'p1'; }).leaver, true);
    assert.strictEqual(r.plan.players.find(function (p) { return p.uid === 'p2'; }).leaver, false);
    assert.deepStrictEqual(users.p1, { pvpWinStreak: 0, pvpBestStreak: 2 });
    assert.deepStrictEqual(users.p2, { pvpWinStreak: 2, pvpBestStreak: 4 });
});
test('K14: a tied leave at 1-1 by player2 resets only player2', function () {
    const users = { p1: { pvpWinStreak: 1, pvpBestStreak: 3 }, p2: { pvpWinStreak: 2, pvpBestStreak: 2 } };
    applySettleStreaks(users, tiedLeave('p2', 1), signedIn(), 'k14b');
    assert.deepStrictEqual(users.p1, { pvpWinStreak: 1, pvpBestStreak: 3 });
    assert.deepStrictEqual(users.p2, { pvpWinStreak: 0, pvpBestStreak: 2 });
});
test('K14: a normal draw keeps both streaks', function () {
    const users = { p1: { pvpWinStreak: 2, pvpBestStreak: 2 }, p2: { pvpWinStreak: 1, pvpBestStreak: 5 } };
    const r = applySettleStreaks(users, drawMatch(), signedIn(), 'k14c');
    assert.strictEqual(r.plan.reason, 'draw');
    r.plan.players.forEach(function (p) { assert.ok(!p.leaver); });
    assert.deepStrictEqual(users.p1, { pvpWinStreak: 2, pvpBestStreak: 2 });
    assert.deepStrictEqual(users.p2, { pvpWinStreak: 1, pvpBestStreak: 5 });
});
test('K14: leaving while behind is still a loss for the leaver and a win for the other side', function () {
    const after = {
        status: 'forfeit', forfeitedBy: 'p2', forfeitReason: 'manual_leave',
        player1: { uid: 'p1', score: 100, answers: [{ won: true }] },
        player2: { uid: 'p2', score: 0, answers: [{ won: false }] },
    };
    const users = { p1: { pvpWinStreak: 1, pvpBestStreak: 1 }, p2: { pvpWinStreak: 2, pvpBestStreak: 2 } };
    applySettleStreaks(users, after, signedIn(), 'k14d');
    assert.deepStrictEqual(users.p1, { pvpWinStreak: 2, pvpBestStreak: 2 });
    assert.deepStrictEqual(users.p2, { pvpWinStreak: 0, pvpBestStreak: 2 });
});
test('K14: win, then leave every tied match before a loss: streak never reaches 3', function () {
    const users = { p1: { pvpWinStreak: 0, pvpBestStreak: 0 }, p2: {} };
    let maxStreak = 0;
    for (let i = 0; i < 10; i++) {
        applySettleStreaks(users, finished(), signedIn(), 'k14w' + i);      // p1 wins
        maxStreak = Math.max(maxStreak, users.p1.pvpWinStreak);
        applySettleStreaks(users, tiedLeave('p1', i % 3), signedIn(), 'k14l' + i); // p1 walks out tied
        maxStreak = Math.max(maxStreak, users.p1.pvpWinStreak);
    }
    assert.ok(maxStreak < 3, 'max streak ' + maxStreak);
    assert.ok(users.p1.pvpBestStreak < 3, 'best ' + users.p1.pvpBestStreak);
    assert.strictEqual(users.p1.pvpWinStreak, 0);
});
test('K14: a guest match tied leave grants nothing and changes no streak', function () {
    const users = { p1: { pvpWinStreak: 2, pvpBestStreak: 2 }, p2: { pvpWinStreak: 2, pvpBestStreak: 2 } };
    const r = applySettleStreaks(users, tiedLeave('p1', 0), pvpFlow.planGuestStamp(false, true), 'k14g');
    assert.strictEqual(r.plan.grant, false);
    assert.deepStrictEqual(users.p1, { pvpWinStreak: 2, pvpBestStreak: 2 });
    assert.deepStrictEqual(users.p2, { pvpWinStreak: 2, pvpBestStreak: 2 });
});
test('K14: planStreakUpdate resets only with leaver === true', function () {
    assert.deepStrictEqual(pvpFlow.planStreakUpdate(2, 4, 'void', true), { pvpWinStreak: 0, pvpBestStreak: 4 });
    assert.deepStrictEqual(pvpFlow.planStreakUpdate(2, 4, 'void', false), { pvpWinStreak: 2, pvpBestStreak: 4 });
    assert.deepStrictEqual(pvpFlow.planStreakUpdate(2, 4, 'void', 'yes'), { pvpWinStreak: 2, pvpBestStreak: 4 });
    assert.deepStrictEqual(pvpFlow.planStreakUpdate(2, 4, 'draw'), { pvpWinStreak: 2, pvpBestStreak: 4 });
});
test('index.js (K14): the settle transaction passes the leaver flag to planStreakUpdate', function () {
    const src = read('functions/index.js');
    const st = src.slice(src.indexOf('async function settlePvpMatch'), src.indexOf('const { createLobbyPush }'));
    assert.ok(/pvpFlow\.planStreakUpdate\(pvpUser\.pvpWinStreak, pvpUser\.pvpBestStreak, p\.outcome, p\.leaver === true\)/.test(st));
    assert.ok(st.indexOf('planStreakUpdate') > st.indexOf('db.runTransaction'), 'inside the pvp_rewards transaction');
});

// ---- K15: network bucket keys IPv6 by /64 and warns (without the IP) when skipped ----
test('index.js (K15): skipped network buckets warn with the error code only, never the IP', function () {
    const src = read('functions/index.js');
    const c = src.slice(src.indexOf('exports.pvpCreateMatch ='), src.indexOf('// ── Scholar Exam'));
    const m = c.match(/console\.warn\('\[pvp\] create network bucket skipped: '[^;]*;/);
    assert.ok(m, 'create warn');
    assert.ok(!/createIp/.test(m[0]));
    const a = src.slice(src.indexOf('exports.pvpSubmitAnswer'), src.indexOf('exports.pvpSubmitAnswer') + 2500);
    const m2 = a.match(/console\.warn\('\[pvp\] answer network bucket skipped: '[^;]*;/);
    assert.ok(m2, 'answer warn');
    assert.ok(!/answerIp/.test(m2[0]));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
