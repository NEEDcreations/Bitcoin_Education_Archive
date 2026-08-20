#!/usr/bin/env node
/* migrate-channel-icons.mjs
 *
 * The emoji shown beside every topic lives inside the `title` field of
 * channel_index.js — 128 of 145 titles begin with one, and there are 110
 * distinct glyphs, chosen ad hoc. They cannot be replaced in CSS.
 *
 * This adds an `icon` field per channel and strips the leading emoji from
 * `title`. Icons are assigned by keyword first (so "mining" gets a pickaxe),
 * then by category as the fallback. Titles are otherwise untouched — the long
 * keyword strings are a separate, editorial decision.
 *
 *   node scripts/migrate-channel-icons.mjs --check
 *   node scripts/migrate-channel-icons.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'channel_index.js';

// Keyword → icon. First match on the channel key or title wins.
const BY_KEYWORD = [
    [/whitepaper|satoshi|book|paper|read|library|literature/, 'file'],
    [/mining|miner|hashrate|asic|difficulty|pow|proof-of-work/, 'pickaxe'],
    [/lightning|layer-2|channel-|ln-|sats-?vs|payment/, 'lightning'],
    [/wallet|custody|cold-?storage|hardware|seed|backup|multisig|key/, 'wallet'],
    [/security|attack|threat|scam|fraud|phish|risk|warn/, 'shield'],
    [/privacy|kyc|anon|coinjoin|tor|surveil/, 'lock'],
    [/node|run-?a-?node|full-?node|core|client|software|dev|code|program/, 'robot'],
    [/price|chart|market|cycle|halving|valuation|stock|metric|data|analys/, 'chart'],
    [/money|monetary|inflation|fiat|econom|currenc|gold|store-?of-?value/, 'coin'],
    [/community|social|meetup|people|pleb|culture|discord|forum/, 'users'],
    [/global|country|nation|adoption|world|legal-?tender|salvador|geo/, 'globe'],
    [/video|tv|stream|podcast|film|documentar|watch|youtube/, 'tv'],
    [/quest|quiz|game|challenge|play|trivia/, 'quest'],
    [/history|timeline|origin|genesis|early|cypherpunk|old/, 'scroll'],
    [/link|resource|tool|site|directory|exchange|referral|shop|buy/, 'link'],
    [/energy|environment|climate|power|electric|green|renewable/, 'flame'],
    [/graphic|meme|art|image|chart-?porn|funny|swag|merch/, 'image'],
    [/grow|organic|seed-?phrase|start|beginner|intro|new-?to/, 'seed'],
    [/decentral|censor|govern|trustless|permissionless|sovereign|freedom/, 'globe'],
    [/scarce|supply|21|cap|unforgeable|hard/, 'coin'],
    [/education|learn|teach|school|course|guide|explain|orange-?pill/, 'book'],
];

// Category → icon, used when no keyword matches.
const BY_CATEGORY = {
    'Properties Layer 1': 'coin',
    'Experienced Topics': 'robot',
    'Resources':          'link',
    'Additional Info':    'book',
    'Referral Links':     'external',
};

const LEADING_EMOJI = new RegExp(
    '^(?:' +
        '[\\uD83C-\\uD83E][\\uDC00-\\uDFFF]' +
        '|[\\u2190-\\u21FF]|[\\u2300-\\u27BF]|[\\u2B00-\\u2BFF]' +
        '|[\\u00A9\\u00AE\\u2122]' +
        '|[\\uFE00-\\uFE0F\\u200D\\u20E3]' +
    ')+\\s*'
);

// Keywords must sit on a word boundary. Plain substring matching produced
// false positives — "upDATAble" matched `data`, so `decentralized-…-updatable`
// was handed the chart icon.
const wordBounded = (re) => new RegExp('(?:^|[^a-z])(?:' + re.source + ')(?:[^a-z]|$)', 'i');
const BOUNDED = BY_KEYWORD.map(([re, name]) => [wordBounded(re), name]);

const pickIcon = (key, title, cat) => {
    const hay = (key + ' ' + title).toLowerCase();
    for (const [re, name] of BOUNDED) if (re.test(hay)) return name;
    return BY_CATEGORY[cat] || 'book';
};

const check = process.argv.includes('--check');
const src = readFileSync(FILE, 'utf8');

// The file is `var CHANNELS = {…};` — parse it rather than regexing the JSON.
const open = src.indexOf('{');
const close = src.lastIndexOf('}');
if (open < 0 || close < 0) { console.error('could not locate the CHANNELS object'); process.exit(1); }
const head = src.slice(0, open);
const tail = src.slice(close + 1);
const data = JSON.parse(src.slice(open, close + 1));

let stripped = 0, iconed = 0;
const usage = {};
for (const [key, meta] of Object.entries(data)) {
    const had = LEADING_EMOJI.test(meta.title || '');
    if (had) { meta.title = meta.title.replace(LEADING_EMOJI, ''); stripped++; }
    const name = pickIcon(key, meta.title || '', meta.cat || '');
    meta.icon = name; iconed++;
    usage[name] = (usage[name] || 0) + 1;
}

console.log(`channels:        ${Object.keys(data).length}`);
console.log(`emoji stripped:  ${stripped}`);
console.log(`icons assigned:  ${iconed}`);
console.log('\nicon distribution:');
Object.entries(usage).sort((a, b) => b[1] - a[1])
    .forEach(([n, c]) => console.log(`  ${String(c).padStart(4)}  ${n}`));

console.log('\nsamples:');
['whitepaper', 'mining', 'money', 'dominant', 'peaceful', 'scarce'].forEach(k => {
    if (data[k]) console.log(`  ${k.padEnd(14)} icon=${String(data[k].icon).padEnd(10)} title="${data[k].title.slice(0, 46)}"`);
});

if (!check) {
    writeFileSync(FILE, head + JSON.stringify(data) + tail);
    console.log(`\nwrote ${FILE}`);
} else {
    console.log('\n[check] no files written');
}
