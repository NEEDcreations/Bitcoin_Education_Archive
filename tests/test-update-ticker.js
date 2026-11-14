// Signal ticker: RSS/Atom parse, bitcoin filter, recency, dedupe, one-per-source.
// No network.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ticker = require('../scripts/update-ticker.js');

let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) {
    try {
        const out = fn();
        if (out && typeof out.then === 'function') {
            queue.push(out.then(function() {
                console.log('✅ ' + name);
                passed++;
            }, function(e) {
                console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
                failed++;
            }));
            return;
        }
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Example</title>
<item>
  <title><![CDATA[Bitcoin ETFs lose $1 billion in a week]]></title>
  <link>https://example.com/etf-outflows</link>
  <pubDate>Thu, 12 Nov 2026 16:00:00 +0000</pubDate>
</item>
<item>
  <title>Ethereum scaling project slashes staff</title>
  <link>https://example.com/eth</link>
  <pubDate>Thu, 12 Nov 2026 15:00:00 +0000</pubDate>
</item>
<item>
  <title>Prediction markets app launches nationwide</title>
  <link>https://example.com/pred</link>
  <pubDate>Thu, 12 Nov 2026 14:00:00 +0000</pubDate>
</item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="html">Bitcoin Optech</title>
  <entry xml:lang="en">
    <title type="html">Bitcoin Optech Newsletter #431</title>
    <link href="https://bitcoinops.org/en/newsletters/2026/11/13/" rel="alternate"/>
    <published>2026-11-13T00:00:00+00:00</published>
    <updated>2026-11-13T00:00:00+00:00</updated>
  </entry>
  <entry xml:lang="en">
    <title type="html">Bitcoin Core vs Ethereum client debate</title>
    <link href="https://example.com/eth-debate" rel="alternate"/>
    <published>2026-11-12T00:00:00+00:00</published>
  </entry>
</feed>`;

const NOW = new Date('2026-11-14T22:00:00.000Z');

test('parses RSS titles, links and dates, including CDATA', function() {
    const items = ticker.parseFeed(RSS);
    assert.strictEqual(items.length, 3);
    assert.strictEqual(items[0].title, 'Bitcoin ETFs lose $1 billion in a week');
    assert.strictEqual(items[0].link, 'https://example.com/etf-outflows');
    assert.strictEqual(items[0].timestamp, Date.parse('Thu, 12 Nov 2026 16:00:00 +0000'));
});

test('parses Atom entries with typed titles and href links', function() {
    const items = ticker.parseFeed(ATOM);
    assert.strictEqual(items.length, 2);
    assert.strictEqual(items[0].title, 'Bitcoin Optech Newsletter #431');
    assert.strictEqual(items[0].link, 'https://bitcoinops.org/en/newsletters/2026/11/13/');
    assert.ok(items[0].timestamp > 0);
});

test('decodes HTML entities in titles', function() {
    assert.strictEqual(ticker.decodeEntities('Bill Miller IV: &#8220;They&#8217;re Not Printing More Bitcoin&#8221;'),
        'Bill Miller IV: “They’re Not Printing More Bitcoin”');
    assert.strictEqual(ticker.decodeEntities('Rootstock Labs: &quot;Bitcoin Doesn\'t Need&quot;'),
        'Rootstock Labs: "Bitcoin Doesn\'t Need"');
});

test('rejects altcoin and off-topic titles on general sources', function() {
    const general = { native: false };
    assert.strictEqual(ticker.isBitcoinFocused('Bitcoin ETFs lose $1 billion', general), true);
    assert.strictEqual(ticker.isBitcoinFocused('Ethereum scaling project slashes staff', general), false);
    assert.strictEqual(ticker.isBitcoinFocused('Solana ETF inflows smash records', general), false);
    assert.strictEqual(ticker.isBitcoinFocused('Prediction markets app launches nationwide', general), false);
});

test('native sources can omit the word Bitcoin but still drop altcoins', function() {
    const native = { native: true, name: 'Casa' };
    assert.strictEqual(ticker.isBitcoinFocused('What is a multisig wallet?', native), true);
    assert.strictEqual(ticker.isBitcoinFocused('The Ledger implant: how a sealed device gave up its seed phrase', native), true);
    assert.strictEqual(ticker.isBitcoinFocused('Ethereum staking withdrawals explained', native), false);
});

test('Luke allow-list accepts macro titles but still rejects shitcoins', function() {
    const luke = ticker.SOURCES.find(function(s) { return s.id === 'lukemikic'; });
    assert.ok(luke && luke.keywords);
    assert.strictEqual(ticker.isBitcoinFocused('Bank of Japan Rate Hikes and a Weaker Dollar', luke), true);
    assert.strictEqual(ticker.isBitcoinFocused('Bitcoin to $300,000? Wall Street\'s Game-Changing Move!', luke), true);
    assert.strictEqual(ticker.isBitcoinFocused('Dogecoin EXPLODES: 10x in 4 Days!', luke), false);
});

test('items older than 14 days are dropped', function() {
    const headlines = [
        { title: 'Fresh Bitcoin headline about ETFs', source: 'a', timestamp: Date.parse('2026-11-12T00:00:00Z'), link: 'https://a.example/1' },
        { title: 'Old Bitcoin headline from September', source: 'b', timestamp: Date.parse('2026-09-01T00:00:00Z'), link: 'https://b.example/1' }
    ];
    const picked = ticker.selectTop(headlines, NOW, { maxAgeDays: 14 });
    assert.strictEqual(picked.length, 1);
    assert.strictEqual(picked[0].source, 'a');
});

test('dedupes equivalent titles and identical links', function() {
    const headlines = [
        { title: 'Bitcoin ETFs lose $1 billion!', source: 'a', timestamp: Date.parse('2026-11-14T00:00:00Z'), link: 'https://a.example/story' },
        { title: 'Bitcoin ETFs lose $1 billion', source: 'b', timestamp: Date.parse('2026-11-13T00:00:00Z'), link: 'https://b.example/other' },
        { title: 'Different Bitcoin mining story', source: 'c', timestamp: Date.parse('2026-11-13T12:00:00Z'), link: 'https://a.example/story' },
        { title: 'Bitcoin Core 30 is released', source: 'd', timestamp: Date.parse('2026-11-12T00:00:00Z'), link: 'https://d.example/core' }
    ];
    const picked = ticker.selectTop(headlines, NOW, { maxAgeDays: 14 });
    assert.strictEqual(picked.length, 2);
    assert.deepStrictEqual(picked.map(function(h) { return h.source; }), ['a', 'd']);
});

test('top 3 use at most one item per source', function() {
    const headlines = [
        { title: 'Luke Bitcoin story one', source: 'lukemikic', timestamp: Date.parse('2026-11-14T20:00:00Z'), link: 'https://youtu.be/1' },
        { title: 'Luke Bitcoin story two', source: 'lukemikic', timestamp: Date.parse('2026-11-14T19:00:00Z'), link: 'https://youtu.be/2' },
        { title: 'Luke Bitcoin story three', source: 'lukemikic', timestamp: Date.parse('2026-11-14T18:00:00Z'), link: 'https://youtu.be/3' },
        { title: 'Magazine Bitcoin price falls to $65,000', source: 'bitcoin-magazine', timestamp: Date.parse('2026-11-14T15:00:00Z'), link: 'https://bitcoinmagazine.com/a' },
        { title: 'Optech Newsletter about Bitcoin relays', source: 'bitcoin-optech', timestamp: Date.parse('2026-11-13T00:00:00Z'), link: 'https://bitcoinops.org/431' }
    ];
    const picked = ticker.selectTop(headlines, NOW, { maxAgeDays: 14 });
    assert.strictEqual(picked.length, 3);
    const sources = picked.map(function(h) { return h.source; });
    assert.deepStrictEqual(sources, ['lukemikic', 'bitcoin-magazine', 'bitcoin-optech']);
    assert.strictEqual(new Set(sources).size, 3);
});

test('output schema matches the homepage ticker file', function() {
    const top = [{
        title: 'Bitcoin Optech Newsletter #431',
        snippet: 'Bitcoin Optech',
        link: 'https://bitcoinops.org/en/newsletters/2026/11/13/',
        source: 'bitcoin-optech',
        timestamp: Date.parse('2026-11-13T00:00:00Z')
    }];
    const out = ticker.toOutput('2026-11-14T22:00:00.000Z', top);
    assert.strictEqual(out.updated, '2026-11-14T22:00:00.000Z');
    assert.strictEqual(out.news.length, 1);
    assert.deepStrictEqual(Object.keys(out.news[0]), ['date', 'title', 'snippet', 'link', 'source']);
    assert.strictEqual(out.news[0].date, 'Nov 13, 2026');
    assert.strictEqual(out.news[0].snippet, 'Bitcoin Optech');
});

test('keeps the existing file when no headlines qualify', async function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticker-'));
    const outPath = path.join(dir, 'newsletter-data.json');
    const existing = { updated: '2026-09-01T20:00:48.680Z', news: [{ title: 'old', date: 'Sep 1, 2026', snippet: 'x', link: '', source: 'x' }] };
    fs.writeFileSync(outPath, JSON.stringify(existing));
    const result = await ticker.run({
        now: NOW,
        outPath: outPath,
        fetcher: async function() { return '<rss><channel></channel></rss>'; }
    });
    assert.strictEqual(result.updated, false);
    const kept = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    assert.strictEqual(kept.updated, '2026-09-01T20:00:48.680Z');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('run writes a fresh top-3 from mixed feeds with source variety', async function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticker-'));
    const outPath = path.join(dir, 'newsletter-data.json');
    const feeds = {
        'https://bitcoinmagazine.com/feed': RSS,
        'https://bitcoinops.org/feed.xml': ATOM
    };
    const result = await ticker.run({
        now: NOW,
        outPath: outPath,
        fetcher: async function(url) {
            if (feeds[url]) return feeds[url];
            return '<rss><channel></channel></rss>';
        }
    });
    assert.strictEqual(result.updated, true);
    assert.ok(result.news.length >= 2);
    const sources = result.news.map(function(n) { return n.source; });
    assert.ok(sources.indexOf('bitcoin-magazine') !== -1);
    assert.ok(sources.indexOf('bitcoin-optech') !== -1);
    assert.strictEqual(new Set(sources).size, sources.length);
    const written = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    assert.strictEqual(written.news.length, result.news.length);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('source list stays Bitcoin-focused and includes the new feeds', function() {
    const ids = ticker.SOURCES.map(function(s) { return s.id; });
    ['lukemikic', 'bitcoin-magazine', 'coindesk', 'bitcoin-optech', 'bitcoin-core',
        'delving-bitcoin', 'casa', 'btc-sessions', 'tftc', 'stephan-livera',
        'jameson-lopp', 'brink', 'natalie-brunell', 'what-bitcoin-did'].forEach(function(id) {
        assert.ok(ids.indexOf(id) !== -1, 'missing source ' + id);
    });
    ticker.SOURCES.forEach(function(s) {
        assert.ok(/^https:\/\//.test(s.url), s.id + ' must be https');
    });
});

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
