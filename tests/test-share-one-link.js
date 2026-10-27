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
    assert.ok(pvp.includes("shareDeepUrl('https://bitcoineducation.quest/#pvp')"));
    const pvpUrl = tickets.shareDeepUrl('https://bitcoineducation.quest/#pvp', 's2rP0nRE');
    assert.strictEqual(linkCount(pvpText + '\n' + pvpUrl), 1);
    assert.strictEqual(pvpUrl, 'https://bitcoineducation.quest/?ref=s2rP0nRE#pvp');
});

test('patch notes keep one Latest line and pages match', () => {
    const notes = read('patch-notes.html');
    assert.strictEqual((notes.match(/Latest:/g) || []).length, 1);
    const latestAt = notes.indexOf('Latest: Timechain TV:');
    const noteAt = notes.indexOf(NOTE);
    assert.ok(latestAt >= 0 && noteAt > latestAt);
    assert.strictEqual(read('index.html'), read('404.html'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
