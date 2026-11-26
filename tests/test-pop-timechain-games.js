// Proof of Play hub lists all 21 Timechain Arcade games. The 10 added Nov 19
// open outside BQ (timechainarcade.com sends X-Frame-Options SAMEORIGIN) and
// never claim BQ rewards or sats.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'proof-of-play.js'), 'utf8');
let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }
}
const start = src.indexOf('var POP_GAMES = [');
const end = src.indexOf('];', start);
const GAMES = eval(src.slice(start + 'var POP_GAMES = '.length, end + 1));
const ADDED = {
    hodlcycle: 'HODL Cycle', lightningpinball: 'Lightning Pinball', robobtc2140: 'RoboBTC 2140',
    fiatfighters: 'Fiat Fighters', nodedefense: 'Node Defense', honeybadger: 'Honey Badger',
    spamdefense: 'Spam Defense', coincontrol: 'Coin Control', hashcorpminers: 'HashCorp Miners',
    consensusclash: 'Consensus Clash'
};

test('hub lists 21 Timechain games with unique slugs', () => {
    assert.strictEqual(GAMES.length, 21);
    assert.strictEqual(new Set(GAMES.map((g) => g.slug)).size, 21);
});

test('each added game uses its Timechain slug, poster and tagline', () => {
    Object.keys(ADDED).forEach((slug) => {
        const g = GAMES.find((x) => x.slug === slug);
        assert.ok(g, slug);
        assert.strictEqual(g.title, ADDED[slug]);
        assert.strictEqual(g.url, 'https://timechainarcade.com/games/' + slug);
        assert.ok(/^https:\/\/timechainarcade\.com\/images\/poster-[a-z0-9-]+\.jpg$/.test(g.thumb), slug);
        assert.ok(g.desc && g.desc.length < 80, slug);
        assert.ok(!/\b(sats?|earn|reward|xp|tickets?)\b/i.test(g.desc), slug + ' must not claim rewards');
        assert.strictEqual(g.hot, false);
    });
    assert.strictEqual(GAMES.find((g) => g.slug === 'hodlcycle').desc, 'Out-ride Scamcoin, Rugpull and FUD on the grid.');
});

test('New badge on the five newest games only', () => {
    const fresh = GAMES.filter((g) => g.isNew).map((g) => g.slug).sort();
    assert.deepStrictEqual(fresh, ['bcracers', 'breakingoutbitcoin', 'hodlcycle', 'lightningpinball', 'robobtc2140']);
    assert.ok(src.includes("(game.hot ? ' hot' : (game.isNew ? ' is-new' : ''))"));
    assert.ok(src.includes(".pop-game-card.is-new::after"));
});

test('arcade cards open outside BQ, every game on the allowlisted host', () => {
    GAMES.forEach((g) => assert.ok(g.url.indexOf('https://timechainarcade.com/games/') === 0, g.slug));
    const card = src.slice(src.indexOf('function _popBuildArcadeCard'), src.indexOf('// ---- Game catalogue ----'));
    assert.ok(card.includes("label.textContent = 'Opens outside BQ'"));
    assert.ok(card.includes('_popOpenOutside(url)'));
    assert.ok(!card.includes('iframe'));
    assert.ok(src.includes("'timechainarcade.com': true"));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
