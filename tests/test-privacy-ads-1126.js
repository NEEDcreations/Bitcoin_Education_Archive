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

test('headings are unchanged and back links and subtitle say Bitcoin Quest', function () {
    const terms = read('terms.html');
    const deletion = read('deletion.html');
    assert.ok(privacy.includes('<h1>Privacy Policy</h1>'));
    assert.ok(terms.includes('<h1>Terms of Service</h1>'));
    assert.ok(deletion.includes('<h1>🗑️ User Data Deletion</h1>'));
    assert.ok(privacy.includes('<a href="/" class="back">← Back to Bitcoin Quest</a>'));
    assert.ok(terms.includes('<a href="/" class="back">← Back to Bitcoin Quest</a>'));
    assert.ok(!privacy.includes('Back to Bitcoin Education Archive'));
    assert.ok(!terms.includes('Back to Bitcoin Education Archive'));
    assert.ok(deletion.includes('<p><strong>Bitcoin Quest</strong>'));
    // Trademark wording stays as it was.
    assert.ok(privacy.includes('"Bitcoin Education Archive" is a trademark'));
});

test('no line still says the Site has no ad networks or ad cookies', function () {
    assert.ok(!privacy.includes('use a third-party analytics product, advertising network, or tracking pixel'));
    assert.ok(!privacy.includes('Facebook Pixel, ad networks, or any'));
    assert.ok(!privacy.includes('<li>Advertising or marketing cookies</li>'));
    assert.ok(!privacy.includes('<li>Cross-site tracking cookies</li>'));
    assert.ok(!privacy.includes('There is no sale or share to opt out of.'));
    assert.ok(!privacy.includes('we do not share it for cross-context behavioral advertising'));
});

test('reworded lines match ads.js: 18+ only, AdSense plus A-ADS, ad cookies', function () {
    assert.ok(privacy.includes('We use two ad networks, Google AdSense and A-ADS, only for signed-in users who have confirmed they are 18 or older'));
    assert.ok(privacy.includes('Google AdSense and A-ADS show ads only to signed-in users who have confirmed they are 18 or older, and they can use their own ad and measurement cookies'));
    assert.ok(privacy.includes('<li>Advertising or marketing cookies of our own. When Google AdSense or A-ADS shows an ad'));
    assert.ok(privacy.includes('<li>Cross-site tracking cookies of our own</li>'));
});

test('the ad-free group is 20% and bq_ads_device is in the storage list', function () {
    assert.ok(adsSection().includes('about 20% of eligible users are placed in an ad-free group'));
    assert.ok(privacy.includes('<code>bq_ads_device</code> is a random device id used only to place this device in or out of the ad-free group'));
    const storage = privacy.slice(privacy.indexOf('<h3>Browser localStorage</h3>'), privacy.indexOf('<h3>Service Worker Cache</h3>'));
    assert.ok(storage.includes('bq_ads_device'));
});

test('the CCPA line has a Do not sell or share draft marked [LEGAL REVIEW]', function () {
    const sale = privacy.slice(privacy.indexOf('<h3>Sale and share</h3>'), privacy.indexOf('<h3>Legal bases'));
    assert.ok(sale.includes('[LEGAL REVIEW]'));
    assert.ok(sale.includes('Do not sell or share:'));
    assert.ok(sale.includes('href="https://adssettings.google.com"'));
    assert.ok(sale.includes('href="https://www.aboutads.info/choices"'));
    assert.ok(!sale.includes('\u2014'));
});

test('Terms 34a no longer says there are no ad cookies and points to Advertising', function () {
    const terms = read('terms.html');
    assert.ok(!terms.includes('We do <strong>not</strong> use advertising cookies, cross-site tracking cookies, or third-party analytics'));
    assert.ok(terms.includes('We do <strong>not</strong> set advertising cookies or cross-site tracking cookies of our own'));
    assert.ok(terms.includes('Google AdSense and A-ADS may set their own ad and measurement cookies only when they show an ad to a signed-in user who has confirmed they are 18 or older'));
    assert.ok(terms.includes('href="/privacy.html#advertising"'));
    assert.ok(terms.includes('We do not set advertising cookies of our own.'));
});

test('Section 5 lists Google AdSense and A-ADS as providers', function () {
    const s5 = privacy.slice(privacy.indexOf('<h2>5. Third-Party Services</h2>'), privacy.indexOf('<h2>6. Data Sharing</h2>'));
    assert.ok(s5.includes('<tr><td>Google AdSense</td>'));
    assert.ok(s5.includes('<tr><td>A-ADS</td>'));
    assert.strictEqual((s5.match(/confirmed they are 18 or older<\/td>/g) || []).length, 2);
});

test('the storage list has the ad group count keys', function () {
    const storage = privacy.slice(privacy.indexOf('<h3>Browser localStorage</h3>'), privacy.indexOf('<h3>Service Worker Cache</h3>'));
    assert.ok(storage.includes('<code>bq_ads_agg_today</code>'));
    assert.ok(storage.includes('<code>bq_ads_agg_yday</code>'));
});

test('the Do not sell or share draft has no email opt-out promise', function () {
    const sale = privacy.slice(privacy.indexOf('<h3>Sale and share</h3>'), privacy.indexOf('<h3>Legal bases'));
    assert.ok(!sale.includes('with the subject'));
    assert.ok(!sale.includes('info.603btc@gmail.com'));
    assert.ok(sale.includes('Google Ads Settings</a> or by using'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
