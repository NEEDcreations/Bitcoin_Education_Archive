// Sidebar topic buttons: one button per topic, approved display labels,
// and the three broken keycap emoji repaired.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

const LABELS = {
    whitepaper: 'Whitepaper',
    decentralized: 'Decentralized, Censorship-Resistant',
    scarce: 'Scarce, Unforgeable',
    secure: 'Secure, Fungible',
    money: 'Money, Deflationary',
    peaceful: 'Peaceful, Neutral',
    dominant: 'Dominant, Recognizable',
    organic: 'Organic, Empowering',
    supranational: 'Supranational, Lindy',
    programmable: 'Programmable, Interoperable',
    'use-cases': 'Use Cases',
    maximalism: 'Maximalism',
    'problems-of-money': 'Problems of Money',
    'self-custody': 'Self-Custody & Security',
    'privacy-nonkyc': 'Privacy & Non-KYC',
    nodes: 'Nodes',
    mining: 'Mining',
    'pow-vs-pos': 'PoW vs PoS',
    energy: 'Energy',
    'difficulty-adjustment': 'Difficulty Adjustment',
    'layer-2-lightning': 'Lightning (Layer 2)',
    'fedi-ark': 'Fedi & Ark (Layer 2)',
    'chaumian-mints': 'Chaumian Mints & Ecash',
    'ctv-covenants': 'CTV (BIP-119) & Covenants',
    'extension-blocks': 'Extension Blocks',
    'op-codes': 'Opcodes & Simplicity',
    bitvm: 'BitVM',
    'layer-3-sidechains': 'Sidechains (Layer 3)',
    stablecoins: 'Stablecoins',
    'smart-contracts': 'Smart Contracts',
    'blockchain-timechain': 'Blockchain (Timechain)',
    regulation: 'Regulation & Policy',
    cryptography: 'Cryptography & Cypherpunks',
    'core-source-code': 'Bitcoin Core Source Code',
    developers: 'Developers',
    'investment-strategy': 'Investment Strategy',
    'evidence-against-alts': 'Evidence Against Altcoins',
    consensus: 'Consensus',
    'one-stop-shop': 'One-Stop Shop',
    'faq-glossary': 'FAQ & Glossary',
    nostr: 'Nostr',
    'misconceptions-fud': 'Misconceptions & FUD',
    books: 'Books',
    videos: 'Videos',
    podcasts: 'Podcasts',
    'articles-threads': 'Articles & Threads',
    'informational-sites': 'Informational Sites',
    curriculum: 'Curriculum',
    'research-theses': 'Research & Theses',
    games: 'Games',
    music: 'Music',
    'movies-tv': 'Movies & TV',
    hardware: 'Hardware',
    'poems-stories': 'Poems & Stories',
    'apps-tools': 'Apps & Tools',
    'projects-diy': 'DIY Projects',
    'art-inspiration': 'Art & Inspiration',
    graphics: 'Graphics',
    charts: 'Charts',
    'swag-merch': 'Swag & Merch',
    'jobs-earn': 'Jobs & Earning Bitcoin',
    'social-media': 'Social Media',
    'fun-facts': 'Fun Facts',
    'news-adoption': 'News & Adoption',
    history: 'History',
    international: 'International',
    'satoshi-nakamoto': 'Satoshi Nakamoto',
    'giga-chad': 'Giga Chad',
    health: 'Health',
    web5: 'Web5',
    'memes-funny': 'Memes & Humor',
    'block_time-block-size': 'Block Time & Block Size',
    'chaumian_e-cash_and_blind_signatures': 'Chaumian Ecash',
    'coin_mixing_coinjoin_coin_control_utxo': 'Coin Mixing & CoinJoin',
    'peace_and_anti-war': 'Peace & Anti-War',
    'public_key_vs_private_key': 'Public vs Private Keys',
    '2__solved_technical_problems': 'Solved Technical Problems',
    'referral-links': 'Free BTC Referral Links'
};

const NO_FE0F = [
    'secure', 'peaceful', 'supranational', 'use-cases', 'fedi-ark', 'bitvm',
    'blockchain-timechain', 'regulation', 'developers', 'evidence-against-alts',
    'research-theses', 'byzantine_generals__problem', 'derivation_path',
    'elevator_pitches', 'governance', 'mev', 'peace_and_anti-war', 'politics',
    'public_key_vs_private_key', 'rbf', 'risks__threats__attack_vectors__weaknes',
    'sidechains', 'simplified_payment_verification__spv', 'swaps', 'toxicity',
    'utxos', 'vbyte'
];

function sidebarButtons(html) {
    const start = html.indexOf('id="channelList"');
    const end = html.indexOf('id="randomToggleBtn"');
    assert.ok(start > 0 && end > start);
    const buttons = [];
    let section = '';
    html.slice(start, end).split('\n').forEach(function (line) {
        const cat = line.match(/class="cat-label cat-toggle"[^>]*>([^<]+)/);
        if (cat) section = cat[1].trim();
        const btn = line.match(/<button class="ch-btn" onclick="go\('([^']+)',this\)">([^<]*)<\/button>/);
        if (!btn) return;
        const raw = btn[2].replace(/&amp;/g, '&');
        const sp = raw.indexOf(' ');
        buttons.push({
            id: btn[1],
            section: section,
            emoji: raw.slice(0, sp),
            label: raw.slice(sp + 1)
        });
    });
    return buttons;
}

function loadChannels() {
    const sandbox = {};
    vm.runInNewContext(read('channel_index.js'), sandbox);
    return sandbox.CHANNELS;
}

test('sidebar has 145 unique topic buttons and each id resolves', () => {
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.strictEqual((html.match(/class="ch-btn"/g) || []).length, 145);
    const buttons = sidebarButtons(html);
    assert.strictEqual(buttons.length, 145);
    const ids = buttons.map(function (b) { return b.id; });
    const dupes = ids.filter(function (id, i) { return ids.indexOf(id) !== i; });
    assert.deepStrictEqual(dupes, []);
    const channels = loadChannels();
    const keys = Object.keys(channels);
    assert.strictEqual(keys.length, 145);
    ids.forEach(function (id) {
        assert.ok(channels[id], 'sidebar id missing from CHANNELS: ' + id);
        assert.ok(channels[id].file, 'topic has no file: ' + id);
        assert.ok(fs.existsSync(path.join(root, channels[id].file)), 'missing ' + channels[id].file);
    });
    keys.forEach(function (id) {
        assert.ok(ids.includes(id), 'topic has no sidebar button: ' + id);
    });
    assert.deepStrictEqual(buttons.filter(function (b) { return b.id === 'stablecoins'; }).map(function (b) { return b.section; }), ['Experienced Topics']);
    assert.deepStrictEqual(buttons.filter(function (b) { return b.id === 'consensus'; }).map(function (b) { return b.section; }), ['Experienced Topics']);
    assert.strictEqual(channels.stablecoins.cat, 'Additional Info');
    assert.strictEqual(channels.consensus.cat, 'Additional Info');
});

test('approved sidebar labels and the three keycap emoji', () => {
    assert.strictEqual(Object.keys(LABELS).length, 78);
    assert.strictEqual(NO_FE0F.length, 27);
    const buttons = sidebarButtons(read('index.html'));
    const byId = {};
    buttons.forEach(function (b) { byId[b.id] = b; });
    Object.keys(LABELS).forEach(function (id) {
        assert.ok(byId[id], 'missing ' + id);
        assert.strictEqual(byId[id].label, LABELS[id], id);
        assert.strictEqual(byId[id].label.includes("'"), false, id);
    });
    assert.strictEqual(byId['0_mining__hashing'].label, 'Mining (Hashing)');
    assert.strictEqual(byId['0_mining__hashing'].emoji, '0\uFE0F\u20E3');
    assert.strictEqual(byId['2__solved_technical_problems'].emoji, '2\uFE0F\u20E3');
    assert.strictEqual(byId.web5.emoji, '5\uFE0F\u20E3');
    assert.strictEqual(byId['1_first_principles'].emoji, '1\uFE0F\u20E3');
    assert.strictEqual(byId.consensus.emoji, '\u{1F91D}');
    ['bitvm', 'vbyte', 'utxos', 'rbf', 'mev', 'simplified_payment_verification__spv'].forEach(function (id) {
        assert.ok(byId[id], id);
    });
    assert.strictEqual(byId.bitvm.label, 'BitVM');
    assert.strictEqual(byId.vbyte.label, 'vByte');
    assert.strictEqual(byId.utxos.label, 'UTXOs');
    assert.strictEqual(byId.rbf.label, 'RBF');
    assert.strictEqual(byId.mev.label, 'MEV');
    assert.strictEqual(byId['simplified_payment_verification__spv'].label, 'SPV');
    NO_FE0F.forEach(function (id) {
        assert.ok(byId[id], id);
        assert.strictEqual(byId[id].emoji.includes('\uFE0F'), false, id);
    });
    const fe0f = buttons.filter(function (b) { return b.emoji.includes('\uFE0F'); }).map(function (b) { return b.id; });
    assert.deepStrictEqual(fe0f.sort(), ['0_mining__hashing', '1_first_principles', '2__solved_technical_problems', 'web5']);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
