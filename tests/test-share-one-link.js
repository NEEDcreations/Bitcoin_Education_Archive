#!/usr/bin/env node
// Every share post carries exactly one http(s) or domain link.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const share = require('../achievement-share.js');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function linkCount(text) {
    return (String(text || '').match(/https?:\/\/[^\s<>"')]+|bitcoineducation\.quest/gi) || []).length;
}

function grab(src, name) {
    const re = new RegExp('function ' + name + '\\s*\\([^)]*\\)\\s*\\{');
    const m = re.exec(src);
    if (!m) throw new Error('missing function ' + name);
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < src.length && depth) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') depth--;
        i++;
    }
    return src.slice(m.index, i);
}

function loadFns(src, names, extra) {
    const sandbox = Object.assign({ encodeURIComponent: encodeURIComponent }, extra || {});
    vm.createContext(sandbox);
    vm.runInContext(names.map(function (name) { return grab(src, name); }).join('\n'), sandbox);
    return sandbox;
}

const TAG = 'Learn Bitcoin and earn sats on Bitcoin Quest 👇';
const NOTE = 'A share post now carries one link, your referral link, and the tagline no longer repeats the site name.';

test('streak, badge, and the other cards post one referral link', () => {
    assert.strictEqual(share.CTA, 'Learn Bitcoin and earn sats at bitcoineducation.quest');
    assert.strictEqual(share.SHARE_LINE, TAG);
    assert.ok(read('achievement-share.js').includes('wrapFill(ctx, model.cta || CTA'));
    assert.deepStrictEqual(share.shareResult(), { xp: 0, sats: 0, tickets: 0 });
    assert.strictEqual(share.shareGrantsReward(), false);
    share.SHARE_TYPES.forEach(function (type) {
        const withCode = share.cardModel({ type: type, days: 30, title: type === 'streak' ? '' : 'Badge ' + type, code: 'abc12345' }, { username: 'Ada' });
        const text = share.shareText(withCode);
        assert.strictEqual(linkCount(text), 1, type);
        assert.ok(text.includes(TAG), type);
        assert.ok(text.includes('https://bitcoineducation.quest/?ref=abc12345&a=' + type), type);
        assert.strictEqual(text.includes('at bitcoineducation.quest'), false, type);
        const payload = share.nativeSharePayload(withCode);
        assert.strictEqual(payload.url, undefined, type);
        assert.strictEqual(linkCount(payload.text), 1, type);
        const intent = share.xIntent(withCode);
        assert.strictEqual(intent.includes('&url='), false, type);
        assert.strictEqual(linkCount(decodeURIComponent(intent.split('text=')[1])), 1, type);
        const tg = share.telegramShare(withCode);
        assert.strictEqual(linkCount(tg.text), 0, type);
        assert.strictEqual(linkCount(tg.text + '\n' + tg.url), 1, type);
        assert.strictEqual(linkCount(withCode.url), 1, type);
        const bare = share.cardModel({ type: type, days: 1, title: 'Quest' }, {});
        const bareText = share.shareText(bare);
        assert.strictEqual(linkCount(bareText), 1, type + ' logged out');
        assert.ok(bareText.endsWith('\nhttps://bitcoineducation.quest'), type + ' logged out');
        assert.strictEqual(bare.url.includes('ref='), false, type);
        assert.strictEqual(bare.url.includes('?'), false, type);
    });
});

test('certificate, invite, badge celebration, Nacho, channel, beats, and PVP post one link', () => {
    const certCtx = {
        window: {},
        document: { getElementById: function () { return null; }, addEventListener: function () {} },
        console: console,
        history: { pushState: function () {} },
        navigator: {}
    };
    certCtx.window = certCtx;
    vm.createContext(certCtx);
    vm.runInContext(read('shareable-certs.js'), certCtx);
    const certOn = certCtx.certShareText('Scholar', 'CERT-ABC12', 'abc12345');
    assert.strictEqual(linkCount(certOn), 1);
    assert.ok(certOn.includes('https://bitcoineducation.quest/?ref=abc12345#cert/CERT-ABC12'));
    assert.ok(certOn.includes(TAG));
    const certOff = certCtx.certShareText('Scholar', 'CERT-ABC12', '');
    assert.strictEqual(linkCount(certOff), 1);
    assert.strictEqual(certOff.endsWith('\nhttps://bitcoineducation.quest/#cert/CERT-ABC12'), true);
    assert.strictEqual(certCtx.certShareUrl('', ''), 'https://bitcoineducation.quest');
    assert.ok(!read('shareable-certs.js').includes('&url='));

    const tickets = loadFns(read('tickets.js'), ['liveRefCode', 'shareHomeUrl', 'shareDeepUrl', 'inviteSharePayload'], {
        getReferralCode: function () { return ''; },
        currentUser: null
    });
    const inviteOff = tickets.inviteSharePayload('');
    assert.strictEqual(linkCount(inviteOff.text), 0);
    assert.strictEqual(inviteOff.url, 'https://bitcoineducation.quest');
    assert.strictEqual(linkCount(inviteOff.text + '\n' + inviteOff.url), 1);
    const inviteOn = tickets.inviteSharePayload('https://bitcoineducation.quest/?ref=abc12345');
    assert.strictEqual(linkCount(inviteOn.text + '\n' + inviteOn.url), 1);
    assert.strictEqual(inviteOn.url, 'https://bitcoineducation.quest/?ref=abc12345');
    assert.strictEqual('url' in inviteOn && inviteOn.text.includes('http'), false);

    const badges = loadFns(read('badges.js'), ['badgeShareLink', 'badgeShareLead', 'badgeShareText', 'badgeShareCopy'], {
        shareHomeUrl: function () { return 'https://bitcoineducation.quest/?ref=abc12345'; }
    });
    const badgeText = badges.badgeShareText('🔥', 'Streak', 'Kept a streak');
    assert.strictEqual(linkCount(badgeText), 1);
    assert.ok(badgeText.includes(TAG));
    assert.ok(badgeText.endsWith('\nhttps://bitcoineducation.quest/?ref=abc12345'));
    assert.strictEqual(linkCount(badges.badgeShareLead('🔥', 'Streak', 'Kept a streak')), 0);
    assert.strictEqual(linkCount(badges.badgeShareCopy('🔥', 'Streak')), 1);
    assert.ok(!read('badges.js').includes('&url=' + 'encodeURIComponent(shareUrl)'));
    assert.ok(read('badges.js').includes('shareNostr(window._badgeShareLead, window._badgeShareUrl)'));

    const appSrc = read('app.js');
    const app = loadFns(appSrc, ['nachoSharePayload', 'shareNote']);
    const nachoOn = app.nachoSharePayload('Blocks are scarce.', 'abc12345');
    assert.strictEqual(nachoOn.url, undefined);
    assert.strictEqual(linkCount(nachoOn.text), 1);
    assert.ok(nachoOn.text.includes(TAG));
    assert.ok(nachoOn.text.includes('https://bitcoineducation.quest/?ref=abc12345'));
    assert.strictEqual(nachoOn.text.includes('at bitcoineducation.quest'), false);
    const nachoOff = app.nachoSharePayload('Blocks are scarce.', '');
    assert.strictEqual(linkCount(nachoOff.text), 1);
    assert.ok(nachoOff.text.endsWith('\nhttps://bitcoineducation.quest'));
    const channelText = 'Mining — Bitcoin Education Archive';
    const channelOn = tickets.shareDeepUrl('https://bitcoineducation.quest/#mining', 'abc12345');
    assert.strictEqual(linkCount(channelText), 0);
    assert.strictEqual(linkCount(app.shareNote(channelText, channelOn)), 1);
    assert.strictEqual(channelOn, 'https://bitcoineducation.quest/?ref=abc12345#mining');
    const channelOff = tickets.shareDeepUrl('https://bitcoineducation.quest/#mining', '');
    assert.strictEqual(linkCount(channelText + '\n' + channelOff), 1);
    assert.strictEqual(channelOff, 'https://bitcoineducation.quest/#mining');
    assert.strictEqual(linkCount(app.shareNote(badgeText, 'https://bitcoineducation.quest/?ref=abc12345')), 1);

    const beats = loadFns(read('beats.js'), ['beatsShareUrl'], { shareDeepUrl: tickets.shareDeepUrl });
    const beatText = '🎸 Listen to "Halving" on Bitcoin Beats!';
    const beatUrl = beats.beatsShareUrl('https://bitcoineducation.quest/#beats/track1');
    assert.strictEqual(linkCount(beatText), 0);
    assert.strictEqual(linkCount(beatText + '\n' + beatUrl), 1);
    const beatsSrc = read('beats.js');
    assert.ok(beatsSrc.includes("var text = '🎸 Listen to \"' + shown + '\" on Bitcoin Beats!';"));
    assert.strictEqual(beatsSrc.includes("on Bitcoin Beats!\\n' + url"), false);

    const pvp = read('pvp.js');
    const pvpText = 'Challenge me to a Bitcoin trivia battle right now! ⚔️';
    assert.ok(pvp.includes("text:'" + pvpText + "'"));
    assert.ok(pvp.includes("var base = 'https://bitcoineducation.quest/#pvp';"));
    assert.ok(pvp.includes('function pvpShareUrl()'));
    const pvpUrl = tickets.shareDeepUrl('https://bitcoineducation.quest/#pvp', 's2rP0nRE');
    assert.strictEqual(linkCount(pvpText + '\n' + pvpUrl), 1);
    assert.strictEqual(pvpUrl, 'https://bitcoineducation.quest/?ref=s2rP0nRE#pvp');
});

test('Nacho quotes drop other links, channel shares read the ref at click, and PVP shows the copied URL', () => {
    const tickets = loadFns(read('tickets.js'), ['stripShareLinks', 'liveRefCode', 'shareHomeUrl', 'shareDeepUrl'], {
        getReferralCode: function () { return ''; },
        currentUser: null
    });
    const quoted = 'Fees are on mempool.space and https://bitcoin.org/bitcoin.pdf plus 21lessons.com and www.bitcoin.org';
    assert.strictEqual(tickets.stripShareLinks(quoted), 'Fees are on mempool and plus 21lessons and');
    assert.strictEqual(tickets.stripShareLinks('Check mempool.space for fees'), 'Check mempool for fees');
    assert.strictEqual(tickets.stripShareLinks('Read it at 21lessons.com!'), 'Read it at 21lessons!');
    assert.strictEqual(tickets.stripShareLinks('Node.js and Mt.Gox stayed.Next too'), 'Node.js and Mt.Gox stayed.Next too');
    assert.strictEqual(tickets.stripShareLinks('Email a@bitcoin.org now'), 'Email now');
    assert.strictEqual(tickets.stripShareLinks('Ask a@mempool.space today'), 'Ask today');
    assert.strictEqual(tickets.stripShareLinks('See www.bitcoin.org and https://bitcoin.org/bitcoin.pdf today'), 'See and today');
    assert.ok(tickets.stripShareLinks('Learn Bitcoin Quest').includes('Bitcoin Quest'));
    assert.ok(read('tickets.js').includes(".slice(0, 1000)"));
    const nachoFn = grab(read('app.js'), 'nachoSharePayload');
    assert.ok(nachoFn.indexOf('.slice(0, 1000)') < nachoFn.indexOf('stripShareLinks'));
    assert.ok(nachoFn.indexOf('stripShareLinks') < nachoFn.indexOf('substring(0, 280)'));

    const app = loadFns(read('app.js'), ['nachoSharePayload'], { stripShareLinks: tickets.stripShareLinks });
    const nacho = app.nachoSharePayload(quoted, 'abc12345');
    assert.strictEqual(linkCount(nacho.text), 1);
    assert.ok(nacho.text.includes(TAG));
    assert.ok(nacho.text.includes('https://bitcoineducation.quest/?ref=abc12345'));
    assert.strictEqual(nacho.text.includes('mempool.space'), false);
    assert.strictEqual(nacho.text.includes('bitcoin.org'), false);
    assert.strictEqual(nacho.text.includes('21lessons.com'), false);

    const appSrc = read('app.js');
    const heroAt = appSrc.indexOf("document.getElementById('hero').innerHTML =");
    const heroEnd = appSrc.indexOf("document.getElementById('hero').classList.remove", heroAt);
    const heroSrc = appSrc.slice(heroAt, heroEnd);
    assert.ok(heroAt >= 0 && heroEnd > heroAt);
    assert.strictEqual(heroSrc.includes('shareDeepUrl'), false);
    assert.ok(heroSrc.includes("shareChannel(\\'x\\'"));
    assert.ok(heroSrc.includes("shareChannel(\\'nostr\\'"));
    assert.ok(heroSrc.includes("shareChannel(\\'copy\\'"));

    const answers = [
        'https://bitcoineducation.quest/#mining',
        'https://bitcoineducation.quest/?ref=abc12345#mining'
    ];
    const channel = loadFns(appSrc, ['channelShareParts'], {
        document: {
            getElementById: function () {
                return { querySelector: function () { return { textContent: 'Mining' }; } };
            }
        },
        shareDeepUrl: function () { return answers.shift(); }
    });
    const before = channel.channelShareParts('mining');
    const after = channel.channelShareParts('mining');
    assert.strictEqual(before.url, 'https://bitcoineducation.quest/#mining');
    assert.strictEqual(after.url, 'https://bitcoineducation.quest/?ref=abc12345#mining');
    assert.strictEqual(before.text, 'Mining — Bitcoin Education Archive');
    assert.strictEqual(linkCount(after.text + '\n' + after.url), 1);
    assert.ok(appSrc.includes('window.shareChannel = shareChannel'));

    const beatsSrc = read('beats.js');
    assert.ok(beatsSrc.includes('function beatsShareTitle(raw)'));
    assert.ok(beatsSrc.includes('stripShareLinks(shown)'));
    const beats = loadFns(beatsSrc, ['beatsShareTitle', 'beatsShareUrl'], {
        stripShareLinks: tickets.stripShareLinks,
        shareDeepUrl: function (url) { return tickets.shareDeepUrl(url, 'abc12345'); }
    });
    const shown = beats.beatsShareTitle('Halving https://evil.example/x and mempool.space');
    const beatText = '🎸 Listen to "' + shown + '" on Bitcoin Beats!';
    const beatUrl = beats.beatsShareUrl('https://bitcoineducation.quest/#beats/track1');
    assert.strictEqual(shown.includes('evil.example'), false);
    assert.strictEqual(shown.includes('mempool.space'), false);
    assert.ok(shown.includes('Halving'));
    assert.strictEqual(linkCount(beatText + '\n' + beatUrl), 1);
    assert.strictEqual(beatUrl, 'https://bitcoineducation.quest/?ref=abc12345#beats/track1');

    const box = { textContent: '' };
    let copied = '';
    const pvpFns = loadFns(read('pvp.js'), ['pvpShareUrl', 'pvpCopyShareLink'], {
        shareDeepUrl: function (base) { return tickets.shareDeepUrl(base, 's2rP0nRE'); },
        document: { getElementById: function () { return box; } },
        navigator: { clipboard: { writeText: function (url) { copied = url; return Promise.resolve(); } } },
        showToast: function () {}
    });
    const pvp = read('pvp.js');
    assert.ok(pvp.includes('id="pvpShareLink"'));
    assert.ok(pvp.includes("'+pvpShareUrl()+'"));
    assert.ok(pvp.includes('pvpCopyShareLink()'));
    assert.ok(pvp.includes('pvpCopyShareLink(true)'));
    assert.strictEqual(pvp.includes('>https://bitcoineducation.quest/#pvp<'), false);
    const displayed = pvpFns.pvpShareUrl();
    const copiedUrl = pvpFns.pvpCopyShareLink();
    assert.strictEqual(displayed, 'https://bitcoineducation.quest/?ref=s2rP0nRE#pvp');
    assert.strictEqual(copiedUrl, displayed);
    assert.strictEqual(box.textContent, displayed);
    assert.strictEqual(copied, displayed);
    assert.strictEqual(linkCount('Challenge me to a Bitcoin trivia battle right now! ⚔️\n' + displayed), 1);
});

test('stripShareLinks names path domains and leaves ordinary words alone', () => {
    const tickets = loadFns(read('tickets.js'), ['stripShareLinks']);
    assert.strictEqual(tickets.stripShareLinks('bitcoin.org/bitcoin.pdf'), 'bitcoin');
    assert.strictEqual(tickets.stripShareLinks('99bitcoins.com/bitcoin-obituaries'), '99bitcoins');
    assert.strictEqual(tickets.stripShareLinks('Read it free at bitcoin.org/bitcoin.pdf please'), 'Read it free at bitcoin please');
    assert.strictEqual(tickets.stripShareLinks('The site 99bitcoins.com/bitcoin-obituaries tracks it'), 'The site 99bitcoins tracks it');
    assert.strictEqual(tickets.stripShareLinks('**mempool.space**'), '**mempool**');
    assert.strictEqual(tickets.stripShareLinks('mempool.space\u2019s'), 'mempool\u2019s');
    assert.strictEqual(tickets.stripShareLinks('See BITCOIN.ORG today'), 'See BITCOIN today');
    assert.strictEqual(tickets.stripShareLinks('Press ? to'), 'Press ? to');
    assert.strictEqual(tickets.stripShareLinks('this.is fine'), 'this.is fine');
    assert.strictEqual(tickets.stripShareLinks('hello  there'), 'hello there');
    const app = loadFns(read('app.js'), ['nachoSharePayload'], { stripShareLinks: tickets.stripShareLinks });
    const deer = app.nachoSharePayload('Hello 🦌 world', 'abc12345');
    assert.ok(deer.text.includes('Hello world'));
    assert.strictEqual(deer.text.includes('Helloworld'), false);
    const canned = app.nachoSharePayload('Read bitcoin.org/bitcoin.pdf and 99bitcoins.com/bitcoin-obituaries', 'abc12345');
    assert.strictEqual(linkCount(canned.text), 1);
    assert.strictEqual(canned.text.includes('bitcoin.org'), false);
    assert.strictEqual(canned.text.includes('99bitcoins.com'), false);
    assert.ok(canned.text.includes('bitcoin'));
    assert.ok(canned.text.includes('99bitcoins'));
});

test('stripShareLinks finishes a 1 MB dotted string in under 50 ms', () => {
    const tickets = loadFns(read('tickets.js'), ['stripShareLinks']);
    const big = 'a.'.repeat(500000);
    assert.ok(big.length >= 1000000);
    const start = process.hrtime.bigint();
    const cleaned = tickets.stripShareLinks(big);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    assert.ok(ms < 50, 'took ' + ms + 'ms');
    assert.ok(cleaned.length <= 1000);
    assert.strictEqual(cleaned.includes('http'), false);
});

test('patch notes keep one Latest line and pages match', () => {
    const notes = read('patch-notes.html');
    assert.strictEqual((notes.match(/Latest:/g) || []).length, 1);
    const latestAt = notes.indexOf("Latest: A key from a peer shows that player's name as a tag you can tap, Send key back uses the same send checks, and your peership level shows beside each peer and on their profile.");
    assert.ok(notes.includes('The raid boss shows HP remaining, the same remaining over max HP as the raid screen.'));
    assert.ok(!notes.includes('Latest: The raid boss'));
    const noteAt = notes.indexOf(NOTE);
    assert.ok(latestAt >= 0 && noteAt > latestAt);
    assert.strictEqual(read('index.html'), read('404.html'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
