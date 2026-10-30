// Server-side ticket grants, Double XP, and badges saved at the daily cap.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const awardActions = require('../functions/src/awardActions');
const ticketGrants = require('../functions/src/ticketGrants');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

test('fixed grants keep the old amounts and day keys', () => {
    assert.strictEqual(ticketGrants.get('daily_chat_ticket').tickets, 2);
    assert.strictEqual(ticketGrants.get('flashcard_ticket').tickets, 5);
    assert.strictEqual(ticketGrants.get('strava_connect_ticket').tickets, 5);
    assert.strictEqual(ticketGrants.get('forum_post_ticket').tickets, 1);
    assert.strictEqual(ticketGrants.claimId('forum_post_ticket', '2026-10-22'), '2026-10-22_forum_post_ticket');
    assert.strictEqual(ticketGrants.claimId('strava_connect_ticket', '2026-10-22'), 'once_strava_connect_ticket');
    assert.strictEqual(ticketGrants.claimId('raid_damage_ticket', '2026-10-22', 3), '2026-10-22_raid_damage_ticket_3');
    assert.strictEqual(ticketGrants.get('pvp_win_ticket'), null);
});

test('raid tickets follow the damage and stop at 10 a day', () => {
    assert.strictEqual(ticketGrants.raidTickets(12.9), 12);
    assert.strictEqual(ticketGrants.raidTickets(0.4), 1);
    assert.strictEqual(ticketGrants.planRaidTickets(0.4, 9), 1);
    assert.strictEqual(ticketGrants.planRaidTickets(0.4, 10), 0);
    assert.strictEqual(ticketGrants.ACTIONS.raid_damage_ticket.dailyTickets, 10);
    let used = 0;
    function take(damage) {
        const n = ticketGrants.planRaidTickets(damage, used);
        used += n;
        return n;
    }
    assert.strictEqual(take(250), 10);
    assert.strictEqual(take(240), 0);
    assert.strictEqual(used, 10);
    used = 7;
    assert.strictEqual(take(6), 3);
    assert.strictEqual(take(50), 0);
    assert.strictEqual(used, 10);
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions/src/grantServerTickets.js'), 'utf8');
    const tx = src.slice(src.indexOf('runTransaction'), src.indexOf('return { tickets: tickets }'));
    assert.ok(tx.indexOf('planRaidTickets') > 0);
    assert.ok(tx.indexOf('countData.tickets') > 0);
    assert.ok(tx.indexOf('countWrite.tickets') > 0);
});

test('tctv and trifecta tickets come from the verified award', () => {
    assert.deepStrictEqual(
        ticketGrants.bonusTickets('tctv_watch_10m', 10, {}),
        { tickets: 1, kinds: ['tctv_watch_ticket'] }
    );
    assert.strictEqual(ticketGrants.bonusTickets('tctv_watch_10m', 10, { tctvClaimed: true }).tickets, 0);
    assert.strictEqual(ticketGrants.bonusTickets('tctv_watch_10m', 0, {}).tickets, 0);
    const done = ticketGrants.bonusTickets('poll_vote', 50, { quiz: true, trivia: true });
    assert.deepStrictEqual(done, { tickets: 1, kinds: ['daily_trifecta_ticket'] });
    assert.strictEqual(ticketGrants.bonusTickets('poll_vote', 50, { quiz: true }).tickets, 0);
    assert.strictEqual(ticketGrants.bonusTickets('poll_vote', 0, { quiz: true, trivia: true }).tickets, 0);
});

test('trifecta proof docs match the award claim ids', () => {
    const trivia = awardActions.resolveAction({ action: '🧠 Trivia Quest correct!', pts: 50 });
    const poll = awardActions.resolveAction({ action: '📊 Poll Quest vote', pts: 50 });
    const quiz = awardActions.resolveAction({ action: '🎮 Quiz correct!', pts: 5 });
    assert.strictEqual(awardActions.claimId(trivia, '2026-10-22', 1), '2026-10-22_trivia_trivia');
    assert.strictEqual(awardActions.claimId(poll, '2026-10-22', 1), '2026-10-22_poll_vote_poll');
    assert.strictEqual(awardActions.countDocId(quiz, '2026-10-22'), '2026-10-22_quiz_correct');
});

test('a doubled amount is rejected unless Double XP is active', () => {
    const doubled = { actionKey: 'flex_action', flexActionId: 'steak', pts: 10, action: 'flex' };
    const base = { actionKey: 'flex_action', flexActionId: 'steak', pts: 5, action: 'flex' };
    const off = awardActions.applyAward({ users: {} }, 'u', doubled, {});
    assert.strictEqual(off.success, false);
    assert.strictEqual(off.awarded, 0);
    const on = awardActions.applyAward({ users: {} }, 'u', doubled, { doubleXpActive: true });
    assert.strictEqual(on.awarded, 10);
    const plain = awardActions.applyAward({ users: {} }, 'u', base, {});
    assert.strictEqual(plain.awarded, 5);
    assert.strictEqual(awardActions.resolveAction({ action: '🎮 Quiz correct!', pts: 10 }).requiresDoubleXp, false);
    assert.strictEqual(awardActions.resolveAction({ action: '🎮 Quiz correct!', pts: 20 }).requiresDoubleXp, true);
    const spinBase = awardActions.resolveAction({ action: 'Daily Spin', pts: 100 });
    const spinDoubled = awardActions.resolveAction({ action: 'Daily Spin', pts: 200 });
    assert.strictEqual(spinBase.ok, true);
    assert.strictEqual(spinBase.xp, 0);
    assert.strictEqual(spinBase.requiresDoubleXp, false);
    assert.strictEqual(spinDoubled.ok, true);
    assert.strictEqual(spinDoubled.xp, 0);
    assert.strictEqual(spinDoubled.requiresDoubleXp, false);
    const future = ticketGrants.doubleXpActive({ toMillis: function() { return Date.now() + 1000; } }, Date.now());
    const past = ticketGrants.doubleXpActive({ toMillis: function() { return Date.now() - 1000; } }, Date.now());
    assert.strictEqual(future, true);
    assert.strictEqual(past, false);
});

test('a badge at the daily cap is saved and the XP is dropped', () => {
    const mem = {
        users: { u: { points: 10, orangeTickets: 0, ban_reason: '' } },
        daily: { u: { total: 1000, triviaQuiz: 0 } },
    };
    const result = awardActions.applyAward(mem, 'u', {
        action: 'badge_earned',
        badgeId: 'first_save',
        pts: 50,
    }, { badgeCatalog: { first_save: 50 } });
    assert.strictEqual(result.awarded, 0);
    assert.strictEqual(result.badgeSaved, true);
    assert.strictEqual(mem.users.u.points, 10);
    assert.strictEqual(mem.claims['u/badge/first_save'], true);
    assert.strictEqual(mem.counts['u/2026-10-22_badge_earned'], 1);
});

test('the server hooks grant each listed ticket and skip PvP', () => {
    const root = path.join(__dirname, '..');
    const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    const raid = fs.readFileSync(path.join(root, 'functions/src/contributeRaid.js'), 'utf8');
    ['forum_post_ticket', 'daily_chat_ticket', 'marketplace_listing_ticket', 'irl_listing_ticket', 'strava_connect_ticket', 'claimNachoChat'].forEach(function(name) {
        assert.ok(index.indexOf(name) > 0, name);
    });
    // awardPoints and the ticket hooks never grant a PvP win. settlePvpMatch
    // is the only writer, and it claims the ticket once per finished match.
    const settleStart = index.indexOf('async function settlePvpMatch');
    const settleEnd = index.indexOf('async function pushPvpLobby');
    assert.ok(settleStart > 0 && settleEnd > settleStart);
    assert.ok(index.slice(0, settleStart).indexOf('pvp_win_ticket') === -1);
    assert.ok(index.slice(settleEnd).indexOf('pvp_win_ticket') === -1);
    const settle = index.slice(settleStart, settleEnd);
    assert.ok(settle.indexOf("action: 'pvp_win_ticket'") > 0);
    assert.ok(settle.indexOf('_pvp_win_ticket') > 0);
    assert.ok(raid.indexOf("metric === 'flashcardCompletions' && effectiveAmount > 0") > 0);
    assert.ok(raid.indexOf('flashcard_ticket') > raid.indexOf('effectiveAmount > 0'));
    assert.ok(raid.indexOf('damage: scaledDamage') > 0);
    assert.ok(index.indexOf('athleteId: data.athlete && data.athlete.id') > 0);
    assert.strictEqual(ticketGrants.stravaTicketAllowed(false, false, 99), true);
    assert.strictEqual(ticketGrants.stravaTicketAllowed(true, false, 99), false);
    assert.strictEqual(ticketGrants.stravaTicketAllowed(false, true, 99), false);
    assert.strictEqual(ticketGrants.stravaTicketAllowed(false, false, ''), false);
    const tickets = fs.readFileSync(path.join(root, 'tickets.js'), 'utf8');
    const bundle = fs.readFileSync(path.join(root, 'bundle.min.js'), 'utf8');
    assert.ok(tickets.indexOf('Orange Ticket — Welcome back') === -1);
    assert.ok(bundle.indexOf('Orange Ticket for posting in PlebTalk') === -1);
    assert.ok(bundle.indexOf('Orange Ticket for posting a listing') === -1);
    assert.ok(bundle.indexOf('🎫 +1 Ticket — Keep watching') === -1);
    assert.ok(bundle.indexOf('Ticket + XP every 10 min') === -1);
    assert.ok(bundle.indexOf('tctv_watch_10m') === -1);
    assert.ok(bundle.indexOf('e.data.tickets>0') === -1);
    assert.ok(bundle.indexOf('awardOrangeTickets(5,"🎯 Daily challenge!")') === -1);
    const modules = fs.readFileSync(path.join(root, 'modules.js'), 'utf8');
    assert.ok(modules.indexOf('awardOrangeTickets') === -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
