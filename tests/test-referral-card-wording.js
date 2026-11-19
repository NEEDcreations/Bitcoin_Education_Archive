#!/usr/bin/env node
'use strict';
// Referral card fixes promised Nov 17 (Phil 9:57 AM ET):
// 1. "3 reached 2,140 XP, 1 qualifies (2 joined before using your code)"
//    instead of a "reached" count that only counted qualifying referrals.
// 2. The stored users.referralInvited counter runs low (8 vs 15 live docs),
//    so the card uses the live referral list and never paints the counter.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (n) => fs.readFileSync(path.join(root, n), 'utf8');
const tiers = require(path.join(root, 'functions/referral-tiers.js'));

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }

test('browser and functions copies of referral-tiers.js match', () => {
    assert.strictEqual(read('referral-tiers.js'), read('functions/referral-tiers.js'));
});

test('tile line: reached vs qualifies, with why the rest do not count', () => {
    assert.strictEqual(tiers.reachedRewardLabel(3, 1, { qualifies: 1, late: 2 }), '3 reached 2,140 XP, 1 qualifies (2 joined before using your code)');
    assert.strictEqual(tiers.reachedRewardLabel(3, 3, { qualifies: 3, late: 0 }), '3 reached 2,140 XP, 3 qualify');
    assert.strictEqual(tiers.reachedRewardLabel(4, 1, { qualifies: 1, late: 2 }), '4 reached 2,140 XP, 1 qualifies (2 joined before using your code, 1 not counted yet)');
    assert.strictEqual(tiers.reachedRewardLabel(0, 0, { qualifies: 0, late: 0 }), '0 reached 2,140 XP, 0 qualify');
    // qualifies can never exceed reached; late can never exceed the gap.
    assert.strictEqual(tiers.reachedRewardLabel(1, 0, { qualifies: 5, late: 9 }), '1 reached 2,140 XP, 1 qualifies');
    assert.strictEqual(tiers.reachedRewardLabel(2, 0, { qualifies: -1, late: 'x' }), '2 reached 2,140 XP, 0 qualify (2 not counted yet)');
    // Without the live breakdown it is the old server-counter line.
    assert.strictEqual(tiers.reachedRewardLabel(1, 1), '1 reached 2,140 XP · 1 rewarded');
});

test('help text: live invited count, reached, qualifies; no invited sentence before the list loads', () => {
    assert.strictEqual(tiers.maxiCountHelp(15, 3, 1, { qualifies: 1, late: 2 }),
        "You've invited 15 people. 3 reached 2,140 XP (Scholar exam points don't count). 1 qualifies (2 joined before using your code). 1 rewarded. Tickets unlock after the account is 7 days old and passes checks. Tier badges use rewarded referrals.");
    assert.strictEqual(tiers.maxiCountHelp(12, 3, 2),
        "You've invited 12 people. 3 reached 2,140 XP (Scholar exam points don't count). 2 rewarded. Tickets unlock after the account is 7 days old and passes checks. Tier badges use rewarded referrals.");
    const pre = tiers.maxiCountHelp(null, 1, 1);
    assert.ok(pre.indexOf("You've invited") === -1, pre);
    assert.ok(pre.indexOf('1 reached 2,140 XP') === 0);
});

// ---- getReferralStats against a fake Firestore ----
const TICKETS = read('tickets.js');
function statsSandbox(docs, users, opts) {
    const o = opts || {};
    const gets = [];
    const sb = {
        console, Promise, setTimeout, Date, Math,
        referralTiers: tiers,
        currentUser: { referralInvited: 8, referralCount: 1, referralMaxiReachedCount: 1 },
        auth: { currentUser: { uid: 'phil', isAnonymous: false } },
        db: {
            collection: (name) => ({
                where: (f, op, v) => ({
                    get: async () => {
                        if (o.queryFails) throw new Error('offline');
                        assert.strictEqual(name, 'referrals'); assert.strictEqual(f, 'referrerUid'); assert.strictEqual(v, 'phil');
                        return { size: docs.length, forEach: (fn) => docs.forEach((d) => fn({ id: d.id, data: () => d.data })) };
                    },
                }),
                doc: (id) => ({
                    get: async () => {
                        assert.strictEqual(name, 'users');
                        gets.push(id);
                        if (o.readFails && o.readFails.indexOf(id) !== -1) throw new Error('denied');
                        const u = users[id];
                        return { exists: !!u, data: () => u };
                    },
                }),
            }),
        },
    };
    sb.window = sb;
    vm.createContext(sb);
    const start = TICKETS.indexOf('var _inviteStatsCache');
    const end = TICKETS.indexOf('// ---- Render tickets section');
    const lineStart = TICKETS.indexOf('function _inviteCountLine');
    const lineEnd = TICKETS.indexOf('function _fillInviteCard');
    assert.ok(start > 0 && end > start && lineStart > 0 && lineEnd > lineStart);
    vm.runInContext(TICKETS.slice(start, end) + '\n' + TICKETS.slice(lineStart, lineEnd) +
        '\nthis.getReferralStats = getReferralStats; this._inviteCountLine = _inviteCountLine;', sb);
    return { sb, gets };
}

function philDocs() {
    // 15 live referrals; the counter says 8. One paid (Bonzi), two late
    // accounts past the bar (LOm, grayruby), the rest under the bar.
    const docs = [{ id: 'bonzi', data: { referrerUid: 'phil', referredUserUid: 'bonzi', status: 'paid', verified: true, ticketsAwarded: true, maxiReachedAt: { seconds: 1 } } },
        { id: 'lom', data: { referrerUid: 'phil', referredUserUid: 'lom', status: 'late' } },
        { id: 'grayruby', data: { referrerUid: 'phil', referredUserUid: 'grayruby', status: 'late' } }];
    for (let i = 0; i < 12; i++) docs.push({ id: 'f' + i, data: { referrerUid: 'phil', referredUserUid: 'f' + i, status: i % 3 ? 'pending' : 'late' } });
    const users = { lom: { points: 5000 }, grayruby: { points: 3000, scholarPoints: 100 } };
    for (let i = 0; i < 12; i++) users['f' + i] = { points: 500 + i, scholarPoints: 0 };
    // A friend past 2,140 only with Scholar exam points does not count as reached.
    users.f0 = { points: 2500, scholarPoints: 1000 };
    return { docs, users };
}

test('live stats: 15 invited from the list (not the 8 counter), 3 reached, 1 qualifies, 2 late', async () => {
    const { docs, users } = philDocs();
    const { sb, gets } = statsSandbox(docs, users);
    const s = await sb.getReferralStats();
    assert.strictEqual(s.invited, 15);
    assert.strictEqual(s.reached, 3);
    assert.strictEqual(s.qualifies, 1);
    assert.strictEqual(s.lateReached, 2);
    assert.strictEqual(s.rewarded, 1);
    assert.strictEqual(s.live, true);
    assert.ok(gets.indexOf('bonzi') === -1, 'qualifying referrals need no profile read');
    assert.strictEqual(gets.length, 14);
    assert.strictEqual(sb._inviteCountLine(s), '15 friends invited · 3 reached 2,140 XP, 1 qualifies (2 joined before using your code) · 1 rewarded');
});

test('live stats: profile reads are capped at 25, a failed read counts as not reached, self-referral ids skipped', async () => {
    const docs = [];
    const users = {};
    for (let i = 0; i < 40; i++) { docs.push({ id: 'u' + i, data: { referrerUid: 'phil', referredUserUid: 'u' + i, status: 'late' } }); users['u' + i] = { points: 9999 }; }
    docs.push({ id: 'phil', data: { referrerUid: 'phil', referredUserUid: 'phil', status: 'rejected' } });
    const { sb, gets } = statsSandbox(docs, users, { readFails: ['u0'] });
    const s = await sb.getReferralStats();
    assert.strictEqual(gets.length, 25);
    assert.ok(gets.indexOf('phil') === -1);
    assert.strictEqual(s.invited, 41);
    assert.strictEqual(s.reached, 24);
    assert.strictEqual(s.lateReached, 24);
});

test('offline fallback: the stored counter is marked fromCounter and shown as "at least"', async () => {
    const { sb, gets } = statsSandbox([], {}, { queryFails: true });
    const s = await sb.getReferralStats();
    assert.strictEqual(s.fromCounter, true);
    assert.strictEqual(s.invited, 8);
    assert.strictEqual(gets.length, 0);
    assert.ok(/^At least 8 friends invited · /.test(sb._inviteCountLine(s)), sb._inviteCountLine(s));
});

// ---- Home Invites tile (ranking.js) ----
const RANKING = read('ranking.js');
function tileSandbox(user) {
    const els = {};
    ['homeInvitesTier', 'homeInvitesNote', 'homeInvitesProgress', 'homeInvitesTile', 'homeInvitesOpen', 'homeInvitesInfoText'].forEach((id) => {
        els[id] = { id, textContent: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); } };
    });
    const sb = {
        console, Math, Number, String, isFinite,
        referralTiers: tiers,
        currentUser: user,
        document: { getElementById: (id) => els[id] || null },
        renderReferralTierLadder() {},
    };
    sb.window = sb;
    sb.auth = { currentUser: { uid: 'phil' } };
    vm.createContext(sb);
    const start = RANKING.indexOf('function referralTierApi() {');
    const end = RANKING.indexOf('window.paintInviteTier = paintInviteTier;');
    assert.ok(start > 0 && end > start);
    vm.runInContext(RANKING.slice(start, end) + '\nthis.paintInviteTier = paintInviteTier;\nthis.setLive = function (v) { _homeInviteLive = v; };', sb);
    return { sb, els };
}

test('tile: first paint never shows the stale counter; live stats paint reached vs qualifies and stick on repaint', () => {
    const { sb, els } = tileSandbox({ referralInvited: 8, referralMaxiCount: 1, referralMaxiReachedCount: 1 });
    sb.paintInviteTier(1);
    assert.ok(els.homeInvitesInfoText.textContent.indexOf("You've invited 8") === -1, els.homeInvitesInfoText.textContent);
    assert.strictEqual(els.homeInvitesNote.textContent, '1 reached 2,140 XP · 1 rewarded');
    sb.setLive({ uid: 'phil', invited: 15, reached: 3, breakdown: { qualifies: 1, late: 2 } });
    sb.paintInviteTier(1, 15, 3, { qualifies: 1, late: 2 });
    assert.strictEqual(els.homeInvitesNote.textContent, '3 reached 2,140 XP, 1 qualifies (2 joined before using your code)');
    assert.ok(els.homeInvitesInfoText.textContent.indexOf("You've invited 15 people.") === 0);
    // paintHomeStrip repaints with the count only; the live numbers stay.
    sb.paintInviteTier(1);
    assert.strictEqual(els.homeInvitesNote.textContent, '3 reached 2,140 XP, 1 qualifies (2 joined before using your code)');
    assert.ok(els.homeInvitesInfoText.textContent.indexOf("You've invited 15 people.") === 0);
    assert.ok(/1 qualifies \(2 joined before using your code\)/.test(els.homeInvitesOpen.attrs['aria-label']));
    // Another account's live stats are never reused.
    sb.auth.currentUser.uid = 'someoneElse';
    sb.paintInviteTier(0);
    assert.strictEqual(els.homeInvitesNote.textContent, '1 reached 2,140 XP · 0 rewarded');
});

test('source: refreshHomeStrip ignores the counter fallback and stores live stats per uid; no referralInvited display', () => {
    const at = RANKING.indexOf('window.refreshHomeStrip = function()');
    const body = RANKING.slice(at, at + 2600);
    assert.ok(body.includes('stats.fromCounter'));
    assert.ok(body.includes('_homeInviteLive = { uid: uidNow'));
    assert.ok(body.includes('stats.qualifies'));
    assert.strictEqual(/referralInvited/.test(RANKING), false, 'ranking.js never reads the stale counter');
    assert.ok(read('bundle.src.js').includes('INVITE_LOOKUP_MAX = 25'), 'bundle rebuilt from tickets.js');
});

(async function main() {
    for (const t of queue) {
        try { await t.fn(); console.log('\u2705 ' + t.name); passed++; }
        catch (e) { console.log('\u274c ' + t.name + ': ' + (e && e.stack || e)); failed++; }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
