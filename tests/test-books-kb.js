#!/usr/bin/env node
// Book KB: legal links, catalog coverage, and stable routing for older questions.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
const SKIP = new Set(['why-bitcoin', 'bitcoin-freedom']);
const SLUGS = ["the-book-of-satoshi","mastering-bitcoin","bitcoin-for-the-befuddled","the-bitcoin-big-bang","bitcoin-the-future-of-money","digital-gold","bitcoin-basics","the-internet-of-money","the-politics-of-bitcoin","the-internet-of-money-volume-two","the-bitcoin-standard","programming-bitcoin","bitcoin-money","grokking-bitcoin","bitcoin-sovereignty-through-mathematics","bitcoin-billionaires","inventing-bitcoin","bitcoin-and-black-america","the-little-bitcoin-book","why-buy-bitcoin","the-internet-of-money-volume-three","the-price-of-tomorrow","21-lessons","truth-decay","bitcoin-independence-reimagined","bitcoin-clarity","this-book-will-save-you-time","magic-internet-money","thank-god-for-bitcoin","bitcoin-hard-money-you-cant-f-ck-with","layered-money","cryptoeconomics","the-blocksize-war","the-7th-property","l-earn-bitcoin","the-bitcoin-shortcut","the-bullish-case-for-bitcoin","the-fiat-standard","mastering-the-lightning-network","bitcoin-and-the-american-dream","bitcoin-is-venice","the-simplest-bitcoin-book-ever-written","check-your-financial-privilege","bitcoin-everything-divided-by-21-million","why-bitcoin","bitcoin-and-exponential-freedom","bitcoin-evangelism","do-bitcoin","tracers-in-the-dark","softwar","the-bitcoin-handbook","a-progressives-case-for-bitcoin","b-is-for-bitcoin","why-bitcoin-2023","bitcoin-vs-altcoins","proof-of-money","abundance-through-scarcity","decrypting-money","history-echoes-bitcoin","cryptosovereignty","fiat-ruins-everything","broken-money","the-bible-and-bitcoin","bitcoin-is-better","mastering-bitcoin-3rd-edition","gradually-then-suddenly","the-hidden-cost-of-money","the-genesis-book","the-dao-of-bitcoin","the-conservative-case-for-bitcoin","parallel","introduction-to-bitcoin","hijacking-bitcoin","twenty-one-questions","resistance-money","shells-to-satoshi","would-mao-hold-bitcoin","national-security-in-the-digital-age","the-nakamoto-consensus","pay-attention-to-bitcoin","bitcoin-the-inverse-of-clown-world","bitcoin-prophecy","the-big-bitcoin-book","bitcoin-explained-like-im-5","the-bushido-of-bitcoin","the-gospel-according-to-bitcoin","the-42-page-bitcoin-book","the-bitcoin-times","the-little-book-of-bitcoin","21-views-from-mount-fuji","the-big-print","the-bitcoin-age","the-privatization-of-money","money-love-and-bitcoin","bitcoin-age","the-mysterious-mr-nakamoto","the-satoshi-papers","principles-of-bitcoin","the-great-harvest","self-bitcoinization","the-bitcoin-enlightenment","moral-money","bitcoin-freedom","modern-chains","future-proof","bitcoin-one-million","the-devil-takes-bitcoin","getting-off-zero","bitcoin-is-for-everyone","defending-bitcoin","black-red-and-orange","orange-black-and-red","why-zack-polanski-should-embrace-bitcoin"];
const FORBIDDEN = /littlebitcoinbook\.com|libgen|z-lib|zlibrary|annas-archive|oceanofpdf|pdfdrive|drive\.google|proton\.me|annas\.archive/i;

(async function main() {
    const logic = await import(pathToFileURL(path.join(root, 'workers/nacho-search/nacho-logic.mjs')).href);
    const indexMod = await import(pathToFileURL(path.join(root, 'workers/nacho-search/kb-index.mjs')).href);
    const baseline = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/kb-route-baseline.json'), 'utf8'));
    const keys = Object.keys(baseline);
    assert.strictEqual(keys.length, 4380, 'baseline size');
    let missing = 0;
    let changed = 0;
    keys.forEach(function (key) {
        const now = indexMod.INDEX.exact[key];
        if (!now) missing += 1;
        else if (now !== baseline[key]) changed += 1;
    });
    assert.strictEqual(missing, 0, 'baseline keys missing ' + missing);
    assert.strictEqual(changed, 0, 'baseline keys retargeted ' + changed);

    const part = fs.readFileSync(path.join(root, 'workers/nacho-search/kb-src/part-h.mjs'), 'utf8');
    SLUGS.forEach(function (slug) {
        if (SKIP.has(slug)) {
            assert.ok(!part.includes('books-' + slug + '"'), 'skipped slug still has an entry ' + slug);
            return;
        }
        assert.ok(part.includes(slug), 'catalog slug missing from part-h ' + slug);
    });
    assert.ok(!part.includes('littlebitcoinbook.com'));
    assert.ok(!part.includes('why-bitcoin"') || part.includes('why-bitcoin-2023'));

    const books = logic.kbEntries().filter(function (entry) { return entry.category === 'books'; });
    assert.ok(books.length >= 300, 'book entries ' + books.length);
    const aiRun = async function () { return { response: 'MODEL_FALLBACK_NOT_KB' }; };
    for (let i = 0; i < books.length; i++) {
        const entry = books[i];
        const blob = entry.question + '\n' + entry.answer + '\n' + (entry.sources || '');
        assert.ok(!FORBIDDEN.test(blob), entry.id);
        assert.ok(!/https?:\/\/|www\./i.test(entry.answer), 'url form ' + entry.id);
        assert.ok(entry.sources, entry.id);
        const direct = await logic.answerTurn({ question: entry.question }, { aiRun: aiRun });
        assert.strictEqual(direct && direct.kbId, entry.id, entry.question);
        const alts = (entry.alts || []).slice(0, 2);
        assert.ok(alts.length >= 2, 'alts ' + entry.id);
        for (let a = 0; a < alts.length; a++) {
            const routed = await logic.answerTurn({ question: alts[a] }, { aiRun: aiRun });
            assert.strictEqual(routed && routed.kbId, entry.id, entry.id + ' alt ' + alts[a]);
        }
    }
    console.log('book KB ' + books.length + ' entries, ' + keys.length + ' older routes unchanged');
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
