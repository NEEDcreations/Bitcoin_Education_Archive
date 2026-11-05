// Faction race end prizes: winner detection, exact pot split, exclusions, copy.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('../functions/src/factionRacePrizes');
const root = path.join(__dirname, '..');
let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}
const NOW = Date.UTC(2026, 10, 5);
function c(uid, contribution, extra) {
    return Object.assign({ uid: uid, contribution: contribution, user: { username: 'p_' + uid }, ledger: {}, authKnown: true, ageDays: 30, emailVerified: true }, extra || {});
}

test('no winner below 10,000', () => assert.strictEqual(P.decideWinner({ cyber_hornets: 9999.9, honey_badgers: 5 }), null));
test('first to 10,000 wins', () => assert.strictEqual(P.decideWinner({ cyber_hornets: 10000, honey_badgers: 9000 }), 'cyber_hornets'));
test('both over: higher total wins; exact tie waits', () => {
    assert.strictEqual(P.decideWinner({ cyber_hornets: 10001, honey_badgers: 10002 }), 'honey_badgers');
    assert.strictEqual(P.decideWinner({ cyber_hornets: 10000, honey_badgers: 10000 }), null);
});
test('default pots: 121,000 winners, 2,100 losers top 10', () => {
    const cfg = P.readConfig({});
    assert.strictEqual(cfg.winnerPotSats, 121000);
    assert.strictEqual(cfg.loserPotSats, 2100);
    assert.strictEqual(cfg.loserTopN, 10);
});
test('bad config values fall back to defaults', () => {
    const cfg = P.readConfig({ winnerPotSats: -1, loserPotSats: 'x', loserTopN: 0 });
    assert.strictEqual(cfg.winnerPotSats, 121000); assert.strictEqual(cfg.loserPotSats, 2100); assert.strictEqual(cfg.loserTopN, 10);
});
test('split always adds up to the pot exactly', () => {
    for (let k = 0; k < 200; k++) {
        const rows = [];
        const n = 1 + (k % 37);
        for (let i = 0; i < n; i++) rows.push({ uid: 'u' + i, contribution: 1 + ((i * 7919 + k) % 97) / 3 });
        const pot = 1 + (k * 613) % 121000;
        const s = P.splitPot(pot, rows);
        assert.strictEqual(s.reduce((a, b) => a + b, 0), pot);
        s.forEach(x => assert.ok(Number.isInteger(x) && x >= 0));
    }
});
test('exclusions: ban, multi-account, hold, min, age, email, moved faction, deleted', () => {
    const list = [
        c('ok1', 50), c('ban', 40, { user: { banned: true } }), c('multi', 40, { user: { multiAccount: true } }),
        c('hold', 40, { user: { satsHold: NOW + 1000 } }), c('tiny', 1), c('young', 40, { ageDays: 2 }),
        c('noemail', 40, { emailVerified: false }), c('moved', 40, { factionMismatch: true }), c('gone', 40, { user: null }),
    ];
    const pot = P.buildPot(list, 121000, P.readConfig({}), NOW, 0);
    assert.deepStrictEqual(pot.recipients.map(r => r.uid), ['ok1']);
    assert.strictEqual(pot.recipients[0].sats, 121000);
    assert.strictEqual(pot.excluded.length, 8);
    pot.excluded.forEach(x => assert.ok(x.reason));
});
test('losers: only top 10 eligible split the small pot; rest listed as outside top 10', () => {
    const list = []; for (let i = 0; i < 15; i++) list.push(c('u' + String(i).padStart(2, '0'), 100 - i));
    const pot = P.buildPot(list, 2100, P.readConfig({}), NOW, 10);
    assert.strictEqual(pot.recipients.length, 10);
    assert.strictEqual(pot.satsTotal, 2100); assert.ok(pot.balanced);
    assert.strictEqual(pot.excluded.filter(x => /top 10/.test(x.reason)).length, 5);
    const pct = pot.recipients.reduce((a, r) => a + r.sharePct, 0);
    assert.ok(Math.abs(pct - 100) < 0.1);
});
test('empty pot side reports unallocated, no recipients', () => {
    const pot = P.buildPot([], 2100, P.readConfig({}), NOW, 10);
    assert.strictEqual(pot.unallocated, 2100); assert.strictEqual(pot.recipients.length, 0);
});
test('breakdown rows carry truncated uid only', () => {
    const pot = P.buildPot([c('abcdefghijklmnop', 10)], 100, P.readConfig({}), NOW, 0);
    assert.strictEqual(pot.recipients[0].uidShort, 'abcdef…');
});
test('tally uses race points for the matching faction only', () => {
    const by = P.tallyContributions([
        { uid: 'a', faction: 'honey_badgers', factionPoints: 1.2, pointsAdded: 1 },
        { uid: 'a', faction: 'honey_badgers', pointsAdded: 5 },
        { uid: 'b', faction: 'cyber_hornets', pointsAdded: 9 },
    ], 'honey_badgers');
    assert.deepStrictEqual(by, { a: 6.2 });
});
test('announcement copy rules', () => {
    ['cyber_hornets', 'honey_badgers'].forEach(f => {
        const t = P.announcementText(f, { cyber_hornets: 10000, honey_badgers: 8301 });
        assert.ok(/pot of sats/.test(t));
        assert.ok(!/worth|\$|usd|price|satoshimon|zero fees/i.test(t));
        assert.ok(t.indexOf('10,000') !== -1);
    });
});
test('grant patch: winners get champion badge, title, 30-day flair; losers get Comeback Kid', () => {
    const FV = { arrayUnion: function () { return { u: Array.from(arguments) }; } };
    const w = P.grantPatch('winner', 'honey_badgers', NOW, FV);
    assert.deepStrictEqual(w.factionRaceBadges.u, ['race_10k_finisher', 'race_champion_badgers']);
    assert.deepStrictEqual(w.earnedTitles.u, ['honey_badger_champion']);
    assert.strictEqual(w.factionChampionUntil, NOW + 30 * 86400000);
    const l = P.grantPatch('loser', 'cyber_hornets', NOW, FV);
    assert.deepStrictEqual(l.factionRaceBadges.u, ['race_10k_finisher', 'race_comeback_kid']);
    assert.ok(!('factionChampionUntil' in l));
});
test('rules: results server-only, public banner read-only, prize fields server-only, flair gated', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    assert.ok(/match \/faction_race_results\/\{raceId\} \{\s*allow read, write: if false;/.test(rules));
    assert.ok(/match \/faction_race_public\/\{docId\} \{\s*allow read: if true;\s*allow write: if false;/.test(rules));
    ['factionRaceBadges', 'factionChampionUntil', 'factionChampionFlair'].forEach(f => assert.ok(rules.indexOf("'" + f + "'") !== -1));
    assert.ok(/hasFactionChampion == true[\s\S]{0,400}factionChampionUntil > request\.time/.test(rules));
});
test('claimCipherWin only accepts faction amounts when admin-approved', () => {
    const g = fs.readFileSync(path.join(root, 'functions/src/gifting.js'), 'utf8');
    assert.ok(/win\.source === 'faction_race' && win\.adminApproved === true/.test(g));
});
test('approve callable is admin-only and needs typed confirmation', () => {
    const j = fs.readFileSync(path.join(root, 'functions/src/factionRaceJobs.js'), 'utf8');
    assert.ok(/token\.admin !== true/.test(j));
    assert.ok(/data\.confirm !== 'APPROVE ' \+ raceId/.test(j));
    assert.ok(/\.create\(\{/.test(j));
});
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
