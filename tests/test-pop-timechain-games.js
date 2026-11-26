// Proof of Play hub: Timechain Arcade live link-outs, independent + Galaxy Mind
// additions, and Timechain 'Coming soon' titles kept hidden.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'proof-of-play.js'), 'utf8');
let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }
}

function extractArray(varName) {
    const start = src.indexOf('var ' + varName + ' = [');
    assert.ok(start !== -1, varName + ' missing');
    const end = src.indexOf('];', start);
    return eval(src.slice(start + ('var ' + varName + ' = ').length, end + 1));
}

const GAMES = extractArray('POP_GAMES');
const INDIE = extractArray('POP_INDEPENDENT_GAMES');

const LINK_OUTS = [
    { title: 'Mempool Space Invaders', url: 'https://www.mempooldotspaceinvaders.space/' },
    { title: 'HashCorp Miners', url: 'https://timechainarcade.com/games/hashcorpminers' },
    { title: 'HODL Cycle', url: 'https://timechainarcade.com/games/hodlcycle' },
    { title: 'Bitcoin Kart', url: 'https://galaxymind.space/bitcoin-kart' },
    { title: 'CHOP', url: 'https://galaxymind.space/chop' },
    { title: 'The HODL Trail', url: 'https://galaxymind.space/trail' },
    { title: 'RyRacer', url: 'https://ryracer.com' }
];

const HIDDEN = [
    { title: 'HODL', slug: 'hodl', url: 'https://timechainarcade.com/games/hodl' },
    { title: 'Lightning Pinball', slug: 'lightningpinball', url: 'https://timechainarcade.com/games/lightningpinball' },
    { title: 'Block Template', slug: 'blocktemplate', url: 'https://timechainarcade.com/games/blocktemplate' },
    { title: 'RoboBTC 2140', slug: 'robobtc2140', url: 'https://timechainarcade.com/games/robobtc2140' },
    { title: 'Fiat Fighters', slug: 'fiatfighters', url: 'https://timechainarcade.com/games/fiatfighters' },
    { title: 'Node Defense', slug: 'nodedefense', url: 'https://timechainarcade.com/games/nodedefense' },
    { title: 'Honey Badger', slug: 'honeybadger', url: 'https://timechainarcade.com/games/honeybadger' },
    { title: 'Spam Defense', slug: 'spamdefense', url: 'https://timechainarcade.com/games/spamdefense' },
    { title: 'Coin Control', slug: 'coincontrol', url: 'https://timechainarcade.com/games/coincontrol' }
];

const LIVE_ADDED = {
    hodlcycle: 'HODL Cycle',
    hashcorpminers: 'HashCorp Miners',
    consensusclash: 'Consensus Clash'
};

test('hub lists 14 live Timechain games with unique slugs', () => {
    assert.strictEqual(GAMES.length, 14);
    assert.strictEqual(new Set(GAMES.map((g) => g.slug)).size, 14);
    GAMES.forEach((g) => {
        assert.ok(g.url.indexOf('https://timechainarcade.com/games/') === 0, g.slug);
    });
});

test('each remaining added Timechain game uses its slug, poster and tagline', () => {
    Object.keys(LIVE_ADDED).forEach((slug) => {
        const g = GAMES.find((x) => x.slug === slug);
        assert.ok(g, slug);
        assert.strictEqual(g.title, LIVE_ADDED[slug]);
        assert.strictEqual(g.url, 'https://timechainarcade.com/games/' + slug);
        assert.ok(/^https:\/\/timechainarcade\.com\/images\/poster-[a-z0-9-]+\.jpg$/.test(g.thumb), slug);
        assert.ok(g.desc && g.desc.length < 80, slug);
        assert.ok(!/\b(sats?|earn|reward|xp|tickets?)\b/i.test(g.desc), slug + ' must not claim rewards');
        assert.strictEqual(g.hot, false);
    });
    assert.strictEqual(GAMES.find((g) => g.slug === 'hodlcycle').desc, 'Out-ride Scamcoin, Rugpull and FUD on the grid.');
});

test('New badge on the four newest live Timechain games only', () => {
    const fresh = GAMES.filter((g) => g.isNew).map((g) => g.slug).sort();
    assert.deepStrictEqual(fresh, ['bcracers', 'breakingoutbitcoin', 'hashcorpminers', 'hodlcycle']);
    assert.ok(src.includes("(game.hot ? ' hot' : (game.isNew ? ' is-new' : ''))"));
    assert.ok(src.includes(".pop-game-card.is-new::after"));
});

test('arcade cards open outside BQ, every Timechain game on the allowlisted host', () => {
    GAMES.forEach((g) => assert.ok(g.url.indexOf('https://timechainarcade.com/games/') === 0, g.slug));
    const card = src.slice(src.indexOf('function _popBuildArcadeCard'), src.indexOf('// ---- Game catalogue ----'));
    assert.ok(card.includes("label.textContent = 'Opens outside BQ'"));
    assert.ok(card.includes('_popOpenOutside(url)'));
    assert.ok(!card.includes('iframe'));
    assert.ok(src.includes("'timechainarcade.com': true"));
    assert.ok(src.includes("rel', 'noopener noreferrer"));
});

test('seven approved link-outs are present with the catalog URLs', () => {
    const gmPath = {
        'Bitcoin Kart': 'bitcoin-kart',
        'CHOP': 'chop',
        'The HODL Trail': 'trail'
    };
    LINK_OUTS.forEach((item) => {
        assert.ok(src.includes(item.title) || src.includes(item.title.toUpperCase()), item.title + ' title missing');
        if (gmPath[item.title]) {
            assert.strictEqual('https://galaxymind.space/' + gmPath[item.title], item.url);
            assert.ok(src.includes("path: '" + gmPath[item.title] + "'"), item.title + ' path missing');
        } else {
            assert.ok(src.includes(item.url), item.title + ' url missing: ' + item.url);
        }
    });
    assert.ok(src.includes("_popAllowedExternalUrl('https://galaxymind.space/' + g.path)"));
    const hashcorp = GAMES.find((g) => g.slug === 'hashcorpminers');
    const hodlCycle = GAMES.find((g) => g.slug === 'hodlcycle');
    const mempool = INDIE.find((g) => g.slug === 'mempool-space-invaders');
    assert.ok(hashcorp && hashcorp.url === 'https://timechainarcade.com/games/hashcorpminers');
    assert.ok(hodlCycle && hodlCycle.url === 'https://timechainarcade.com/games/hodlcycle');
    assert.ok(mempool, 'Mempool Space Invaders missing from independent list');
    assert.strictEqual(mempool.title, 'Mempool Space Invaders');
    assert.strictEqual(mempool.url, 'https://www.mempooldotspaceinvaders.space/');
    assert.strictEqual(mempool.thumb, 'https://mempooldotspaceinvaders.space/og-image.png');
    assert.ok(src.includes("_popOpenOutside('https://ryracer.com')") || src.includes("_popExternalAnchor('https://ryracer.com'"));
    assert.ok(src.includes("'mempooldotspaceinvaders.space': true"));
    assert.ok(src.includes("'www.mempooldotspaceinvaders.space': true"));
});

test("nine Timechain Arcade Coming soon titles are hidden", () => {
    const slugs = new Set(GAMES.map((g) => g.slug).concat(INDIE.map((g) => g.slug)));
    const titles = new Set(GAMES.map((g) => g.title).concat(INDIE.map((g) => g.title)));
    HIDDEN.forEach((item) => {
        assert.ok(!slugs.has(item.slug), item.slug + ' should be hidden');
        assert.ok(!titles.has(item.title), item.title + ' should be hidden');
        const exact = item.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(exact + "(?![A-Za-z0-9-])");
        assert.ok(!re.test(src), item.url + ' should not appear in the hub');
        assert.ok(!src.includes("slug: '" + item.slug + "'"), item.slug + ' slug still listed');
    });
    // Do not hide HODL Cycle when hiding HODL.
    assert.ok(titles.has('HODL Cycle'));
    assert.ok(src.includes('https://timechainarcade.com/games/hodlcycle'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
