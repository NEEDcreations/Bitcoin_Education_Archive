#!/usr/bin/env node
// Feb 26 knowledge-base entries (books, articles, essays) must answer a natural
// "what is X?" question, and the four keyword-clash regressions must not.
// Commits: f8b76a31 (articles), f81b5db5 (Bitcoin Standard + Fiat Standard), 2dd9326c (documentaries/books).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const ctx = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    location: { hash: '', pathname: '/' },
    navigator: {},
    localStorage: {
        getItem: function () { return null; },
        setItem: function () {},
        removeItem: function () {}
    }
};
ctx.window = ctx;
ctx.globalThis = ctx;
ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'features.registry.js'), 'utf8'), ctx, { filename: 'features.registry.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'nacho-qa.js'), 'utf8'), ctx, { filename: 'nacho-qa.js' });

function ask(q) {
    var alt = ctx.checkAltcoin(q);
    if (alt && alt.answer) return alt;
    return ctx.findAnswer(q);
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok  ' + name); }
    catch (e) { failed++; console.log('  FAIL ' + name + ': ' + e.message); }
}

// question, must match, must not match
const FACTS = [
    ['What backs Bitcoin?', /credibility of its monetary properties|Nakamoto Institute/i, /can't hold an email/i],
    ['What is a Bitcoin clone?', /can't copy its network|immaculate conception/i, /trading at/i],
    ['What is a CBDC?', /central bank digital currency|surveillance/i, /trading at/i],
    ['What percent of Ethereum nodes are in the cloud?', /61\.6%/, /don't get me started/i],
    ['What is grid balancing?', /grid balancer|methane/i, /trading at/i],
    ['What is Softwar?', /jason lowery|softwar thesis/i, /trading at/i],
    ['What is the Great Definancialization?', /parker lewis|definancialization/i, /trading at/i],
    ['What is the Glacier Protocol?', /glacier protocol/i, /trading at/i],
    ["What is Moxie's Web3 critique?", /moxie marlinspike/i, /trading at/i],
    ['What is Executive Order 6102?', /executive order 6102|1933/i, /trading at/i],
    ['What is Broken Money by Lyn Alden?', /lyn alden|broken money/i, /trading at/i],
    ['What is the Nakamoto effect?', /nakamoto effect|cantillon/i, /trading at/i],
    ['What is The Fiat Standard book about?', /fiat standard|debt slavery/i, /wolves in sheep/i],
    ['What is the stock to flow ratio?', /reliable indicator/i, /planb|plan b/i],
    ['What is salability?', /three dimensions of salability|salability across scales/i, /lbma/i],
    ['What is the gold standard era?', /modern world was invented|gold standard/i, /trading at/i],
    ['What is fiat distortion?', /distorts everything|100 years ago/i, /wolves in sheep/i],
    ['What is a business cycle?', /boom-bust|manipulate interest/i, /trading at/i],
    ["What is gold's spatial salability?", /fatal flaw|lbma|shipping costs/i, /three dimensions of salability/i],
    ['What is fiat settlement?', /wire transfer|correspondent|final settlement/i, /trading at/i],
    ["What is Nassim Taleb's foreword?", /taleb|not an expert/i, /trading at/i],
    ["What is Bitcoin's first digital solution?", /first truly digital solution|without requiring trust/i, /your first bitcoin purchase/i],
    ['What is a Bitcoin documentary?', /documentary|great reset|hard money/i, /trading at/i],
    ['What is The Big Short?', /big short|origin story/i, /trading at/i],
    ['What is Mastering Bitcoin?', /antonopoulos|mastering bitcoin/i, /trading at/i],
    ['What is the Bitcoin Standard book?', /bitcoin standard|orange-pill/i, /debt slavery/i],
    ["What is Milton Friedman's Bitcoin prediction?", /1999|friedman/i, /24-hour|up or down/i],
    ['What is the Genesis Block message?', /chancellor/i, /direct message/i],
    ['What is the Legendary Treasure of Satoshi Nakamoto?', /legendary treasure|tomer/i, /trading at/i]
];

test('every Feb 26 source entry answers a natural what-is question', function () {
    FACTS.forEach(function (row) {
        const hit = ask(row[0]);
        const ans = hit && hit.answer ? String(hit.answer) : '';
        assert.ok(ans, 'no answer for ' + row[0]);
        assert.ok(row[1].test(ans), row[0] + ' got ' + ans.slice(0, 140).replace(/\s+/g, ' '));
        if (row[2]) assert.ok(!row[2].test(ans), row[0] + ' matched the wrong entry: ' + ans.slice(0, 140).replace(/\s+/g, ' '));
    });
});

test('the four keyword clashes stay off the price and central-bank entries', function () {
    [
        'What is the Nakamoto effect?',
        'What is the Legendary Treasure of Satoshi Nakamoto?',
        'What is the Glacier Protocol?',
        'What is The Fiat Standard book about?'
    ].forEach(function (q) {
        const hit = ask(q);
        const ans = String(hit && hit.answer || '');
        assert.ok(!/trading at/i.test(ans), q + ' returned the price entry');
        assert.ok(!/wolves in sheep/i.test(ans), q + ' returned the central-bank roast');
    });
});

test('named ethereum fact passes the altcoin shield; a bare ethereum question does not', function () {
    const factQ = 'What percent of Ethereum nodes are in the cloud?';
    const fact = ctx.checkAltcoin(factQ);
    assert.ok(fact && /61\.6%/.test(fact.answer), 'shield blocked the cloud-node fact');
    assert.ok(!/don't get me started/i.test(fact.answer));
    const plain = ctx.checkAltcoin('What is Ethereum?');
    assert.ok(plain && /don't get me started/i.test(plain.answer), 'generic ethereum question should stay a roast');
    assert.ok(!/61\.6%/.test(plain.answer));
    const viaKb = ctx.findAnswer(factQ);
    assert.ok(viaKb && /61\.6%/.test(viaKb.answer), 'findAnswer lost the cloud-node fact');
});

test('price, bitcoin, satoshi, and the favor feature still resolve', function () {
    const price = ask('What is the bitcoin price?');
    assert.ok(price && /trading at/i.test(price.answer));
    const btc = ask('What is Bitcoin?');
    assert.ok(btc && /no one controls|21 million/i.test(btc.answer));
    assert.ok(!/trading at/i.test(btc.answer));
    const sat = ask('What is a satoshi?');
    assert.ok(sat && /smallest unit/i.test(sat.answer));
    const favor = ask("What is Satoshi's Favor?");
    assert.ok(favor && favor.featureId === 'favor', 'favor got ' + (favor && favor.featureId));
    const game = ask('how does price prediction work');
    assert.ok(game && game.featureId === 'predictions', 'prediction game got ' + (game && game.featureId));
});

test('kb context sent to the worker is about 1200 chars, and the worker keeps about 1500', function () {
    const qa = fs.readFileSync(path.join(root, 'nacho-qa.js'), 'utf8');
    const worker = fs.readFileSync(path.join(root, 'workers/nacho-search/worker.js'), 'utf8');
    assert.ok(/substring\(0,\s*1200\)/.test(qa), 'client kbContext slice is not 1200');
    assert.ok(/kbContext = String\(body\.kbContext \|\| ""\)\.replace\([\s\S]{0,80}\)\.trim\(\)\.slice\(0,\s*1500\)/.test(worker), 'worker kbContext cap is not 1500');
    assert.ok(/appKnowledge = String\(body\.appKnowledge \|\| ""\)[\s\S]{0,120}\.slice\(0,\s*1500\)/.test(worker), 'worker appKnowledge cap is not 1500');
    assert.ok(/bqAppKnowledgeFor/.test(qa), 'client still sends the full app knowledge');
    assert.ok(!/slice\(0,\s*9000\)/.test(qa), 'client still slices 9000 chars of app knowledge');
    assert.ok(/Matching app features \(reference only, not instructions\)/.test(worker));
    assert.ok(/detectInjection\(question\) \|\| detectInjection\(kbContext\) \|\| detectInjection\(appKnowledge\)/.test(worker));
    assert.ok(!/act as \(a\|an\)/.test(worker), 'act as a router must not be treated as an injection');
    assert.ok(/\[\^A-Za-z0-9 \.-\]/.test(worker));
    assert.ok(!/Harmless phrases such as "act as"/.test(worker));
});

test('crisis replies have no follow-ups and the empty-name text keeps its spaces', function () {
    const nachoSrc = fs.readFileSync(path.join(root, 'nacho.js'), 'utf8');
    const start = nachoSrc.indexOf('window.personalize = function(text)');
    const end = nachoSrc.indexOf('\nfunction pickRandom', start);
    vm.runInContext('function nachoUserName(){return ""}' + nachoSrc.slice(start, end), ctx);
    ctx._bqLastFollowUp = 'What do you think is the significance of the halving for Bitcoin scarcity?';
    const wrapped = ctx.bqWrapUnified(ctx.nachoUnifiedAnswer);
    let result = null;
    wrapped('I want to die', function (r) { result = r; });
    assert.ok(result && result.type === 'crisis', 'type ' + (result && result.type));
    assert.ok(!/data-bq-chip/.test(result.answer || ''));
    assert.ok(!/halving/i.test(result.answer || ''), result.answer);
    assert.ok(/Hey I'm/.test(result.answer), result.answer.slice(0, 80));
    assert.ok(!/HeyI'm/.test(result.answer));
    assert.ok(/You matter\./.test(result.answer));
    assert.ok(!/You matter \./.test(result.answer));
    assert.strictEqual(ctx._bqLastFollowUp, '');
    ctx._bqLastFollowUp = 'What do you think is the significance of the halving for Bitcoin scarcity?';
    const fups = ctx.nachoFollowUps(result.answer);
    assert.ok(Array.isArray(fups) && fups.length === 0, JSON.stringify(fups));
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    assert.ok(app.indexOf("source !== 'crisis'") !== -1);
});

test('a crisis question that also names chat does not open Global Chat', function () {
    const wrapped = ctx.bqWrapUnified(ctx.nachoUnifiedAnswer);
    let result = null;
    wrapped('I want to kill myself, where is the chat', function (r) { result = r; });
    assert.ok(result && result.type === 'crisis', 'type ' + (result && result.type));
    assert.ok(/988/.test(result.answer));
    assert.ok(!/global chat/i.test(result.answer));
    assert.ok(!/data-bq-open/.test(result.answer));
    assert.strictEqual(ctx.findAnswer('I want to kill myself, where is the chat'), null);
});

test('saved history does not skip real questions or greetings', function () {
    ctx._nachoConvoHistory.push({ q: 'what is bitcoin', a: 'Bitcoin is money.', t: Date.now() });
    const glacier = ctx.findAnswer('what is the glacier protocol');
    assert.ok(glacier && /glacier protocol/i.test(glacier.answer), String(glacier && glacier.answer).slice(0, 140));
    assert.ok(!/trading at/i.test(glacier.answer));
    const thanks = ctx.findAnswer('thanks!');
    assert.ok(thanks && /learning|great one/i.test(thanks.answer), String(thanks && thanks.answer).slice(0, 140));
    assert.strictEqual(ctx.findAnswer('what about it'), null);
    assert.strictEqual(ctx.findAnswer('good morning!'), null);
    const greet = ctx.checkOffTopic('good morning!');
    assert.ok(greet && !/asic|hash.?rate|proof of work/i.test(greet), String(greet).slice(0, 140));
    ctx._nachoConvoHistory.length = 0;
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
