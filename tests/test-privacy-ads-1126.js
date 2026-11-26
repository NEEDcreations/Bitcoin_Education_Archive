// Privacy page advertising section and Bitcoin Quest titles on legal pages.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

const privacy = read('privacy.html');
function adsSection() {
    const start = privacy.indexOf('<h2 id="advertising">Advertising</h2>');
    assert.ok(start > 0, 'advertising section missing');
    const end = privacy.indexOf('<h2>', start + 10);
    assert.ok(end > start);
    return privacy.slice(start, end);
}

test('privacy has one Advertising section between Cookies and Nacho', function () {
    assert.strictEqual(privacy.split('id="advertising"').length, 2);
    const ads = privacy.indexOf('id="advertising"');
    assert.ok(privacy.indexOf('id="cookies"') < ads);
    assert.ok(ads < privacy.indexOf('<h2>8. Nacho (AI Mascot) Privacy</h2>'));
});

test('the section names AdSense, cookies, and the 18+ and guest rules', function () {
    const s = adsSection();
    assert.ok(s.includes('Google AdSense'));
    assert.ok(s.includes('Google and its partners may use cookies, device identifiers, or similar technologies'));
    assert.ok(s.includes('only to signed-in users who have confirmed they are 18 or older'));
    assert.ok(s.includes('Guests never see ads.'));
    assert.ok(s.includes('A-ADS'));
    assert.ok(s.includes('Timechain TV'));
});

test('the section links Google Ads Settings, partner sites, and the opt-out pages', function () {
    const s = adsSection();
    [
        'https://adssettings.google.com',
        'https://policies.google.com/technologies/partner-sites',
        'https://www.aboutads.info/choices',
        'https://youronlinechoices.eu',
        'https://aads.com/privacy_policy/',
    ].forEach(function (u) { assert.ok(s.includes('href="' + u + '"'), u); });
    const links = s.match(/<a [^>]*>/g) || [];
    links.forEach(function (a) { assert.ok(a.includes('rel="noopener"'), a); });
});

test('the section has no em-dashes', function () {
    assert.ok(!adsSection().includes('\u2014'));
});

test('legal page titles say Bitcoin Quest', function () {
    assert.ok(privacy.includes('<title>Privacy Policy - Bitcoin Quest</title>'));
    assert.ok(read('terms.html').includes('<title>Terms of Service - Bitcoin Quest</title>'));
    assert.ok(read('deletion.html').includes('<title>Data Deletion \u2013 Bitcoin Quest</title>'));
    ['privacy.html', 'terms.html', 'deletion.html'].forEach(function (f) {
        const title = /<title>([^<]*)<\/title>/.exec(read(f))[1];
        assert.ok(!title.includes('Bitcoin Education Archive'), f);
    });
});

test('headings and legal body wording are unchanged', function () {
    assert.ok(privacy.includes('<h1>Privacy Policy</h1>'));
    assert.ok(read('terms.html').includes('<h1>Terms of Service</h1>'));
    assert.ok(read('deletion.html').includes('<h1>🗑️ User Data Deletion</h1>'));
    // The trademark and party names in the body stay as they were.
    assert.ok(privacy.includes('"Bitcoin Education Archive" is a trademark'));
    assert.ok(read('terms.html').includes('By accessing or using the Bitcoin Education Archive website'));
    assert.ok(read('deletion.html').includes('<p><strong>Bitcoin Education Archive</strong>'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
