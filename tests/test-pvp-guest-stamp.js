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
test('caps: a guest match never charges the signed-in player; global and network caps apply', function () {
    const g = pvpFlow.planMatchCharges({ p1Guest: false, p2Guest: true, hasNetwork: true });
    assert.ok(!g.some(function (c) { return c.who === 'player1'; }), 'signed-in p1 not charged');
    assert.ok(g.some(function (c) { return c.who === 'player2'; }));
    assert.ok(g.some(function (c) { return c.who === 'global' && c.max === pvpFlow.PVP_ANON_GLOBAL_PER_HOUR; }));
    assert.ok(g.some(function (c) { return c.who === 'network' && c.max === pvpFlow.PVP_ANON_NETWORK_PER_HOUR; }));
    const g2 = pvpFlow.planMatchCharges({ p1Guest: true, p2Guest: false, hasNetwork: true });
    assert.ok(!g2.some(function (c) { return c.who === 'player2'; }), 'signed-in p2 not charged');
    const s = pvpFlow.planMatchCharges({ p1Guest: false, p2Guest: false, hasNetwork: true });
    assert.deepStrictEqual(s.map(function (c) { return c.who; }).sort(), ['player1', 'player2']);
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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
