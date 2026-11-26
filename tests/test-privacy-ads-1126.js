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

// Insurance/Legal text, verbatim. Link tags are stripped before comparing.
const LEGAL_TEXT = "We show ads only to signed-in users who have confirmed they are 18 or older. We never show ads to guests or to Kids or Classroom accounts. We don't sell personal information for money. When Google AdSense shows you an ad, Google may collect cookie and device identifiers, which some state laws, including California's, may treat as 'sharing' for cross-context behavioral advertising. We don't show A-ADS ads to users who opt out or whose browser sends a Global Privacy Control signal. You can opt out of this sharing at any time with the Your Privacy Choices link at the bottom of every page. We also honor Global Privacy Control (GPC) signals from your browser as an opt-out. When you opt out, you'll see only non-personalized ads. You can also manage Google's ad personalization in Google's Ads Settings. We don't knowingly sell or share personal information of anyone under 18. We don't currently show ads in the EEA, UK or Switzerland.";
function plain(html) { return html.replace(/<[^>]+>/g, ''); }
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

test('the section carries the Insurance/Legal text verbatim', function () {
    const s = plain(adsSection());
    assert.ok(s.includes('Advertising and your choices. ' + LEGAL_TEXT));
    assert.ok(!privacy.includes('[A-ADS SENTENCE TBD]'));
    assert.strictEqual(privacy.split("We don't show A-ADS ads to users who opt out or whose browser sends a Global Privacy Control signal.").length, 3);
});

test('the section links Google Ads Settings and nothing else from the old draft', function () {
    const s = adsSection();
    assert.ok(s.includes('href="https://adssettings.google.com"'));
    assert.ok(!s.includes('youronlinechoices.eu'));
    const links = s.match(/<a [^>]*>/g) || [];
    links.forEach(function (a) { assert.ok(a.includes('rel="noopener"') || a.includes('href="#'), a); });
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

test('the ad-free group is 20% and the section names the storage keys', function () {
    const sec = adsSection();
    assert.ok(sec.includes('about 20% of eligible users are placed in an ad-free group'));
    ['bq_ads_device', 'bq_ads_agg_today', 'bq_ads_agg_yday'].forEach(function (k) { assert.ok(sec.includes('<code>' + k + '</code>'), k); });
    assert.ok(sec.indexOf('Advertising and your choices.') < sec.indexOf('Ad-free group.'));
    assert.ok(privacy.includes('<code>bq_ads_device</code> is a random device id used only to place this device in or out of the ad-free group'));
    const storage = privacy.slice(privacy.indexOf('<h3>Browser localStorage</h3>'), privacy.indexOf('<h3>Service Worker Cache</h3>'));
    assert.ok(storage.includes('bq_ads_device'));
});

test('S20 Sale and share uses the same text and drops the [LEGAL REVIEW] draft', function () {
    const sale = privacy.slice(privacy.indexOf('<h3>Sale and share</h3>'), privacy.indexOf('<h3>Legal bases'));
    assert.ok(plain(sale).includes('Advertising and your choices. ' + LEGAL_TEXT));
    assert.ok(!privacy.includes('[LEGAL REVIEW]'));
    assert.ok(sale.includes('other than Google AdSense and A-ADS, are so they can run the Site'));
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
    assert.ok(s5.includes('Ads in the home, Learn, and arcade ad slots, only for signed-in users who have confirmed they are 18 or older. Users who opt out get non-personalized ads only</td>'));
    assert.ok(s5.includes('Ads in the home, Learn, and arcade ad slots, only for signed-in users who have confirmed they are 18 or older and have not opted out</td>'));
    assert.ok(!s5.includes('Ads on some Learn and arcade pages'));
    assert.ok(!s5.includes('An ad on the home page'));
});

test('the storage list has the ad group count keys', function () {
    const storage = privacy.slice(privacy.indexOf('<h3>Browser localStorage</h3>'), privacy.indexOf('<h3>Service Worker Cache</h3>'));
    assert.ok(storage.includes('<code>bq_ads_agg_today</code>'));
    assert.ok(storage.includes('<code>bq_ads_agg_yday</code>'));
});

test('no email opt-out promise and no sell-for-advertising line remain', function () {
    const sale = privacy.slice(privacy.indexOf('<h3>Sale and share</h3>'), privacy.indexOf('<h3>Legal bases'));
    assert.ok(!sale.includes('with the subject'));
    assert.ok(!sale.includes('info.603btc@gmail.com'));
    assert.ok(!privacy.includes('sell your personal information for advertising'));
    assert.ok(privacy.includes('Our commitment: We do not sell your personal information for money.'));
});

test('the section adds Premium ad-free and the partner-sites link after the Legal text', function () {
    const sec = adsSection();
    const legalEnd = sec.indexOf("We don't currently show ads in the EEA, UK or Switzerland.");
    const extra = sec.indexOf('<p>Premium accounts are ad-free.');
    assert.ok(legalEnd > 0 && extra > legalEnd);
    assert.ok(sec.includes('href="https://policies.google.com/technologies/partner-sites"'));
    assert.ok(plain(sec).includes('Google explains how it uses this data in How Google uses information from sites or apps that use our services.'));
    assert.ok(extra < sec.indexOf('Ad-free group.'));
});

test('Terms no longer says it does not sell for advertising', function () {
    const terms = read('terms.html');
    assert.ok(!terms.includes('sell your personal information for advertising'));
    assert.ok(terms.includes('We do not sell your personal information for money.'));
});

test('privacy choice storage keys and account fields are listed', function () {
    const storage = privacy.slice(privacy.indexOf('<h3>Browser localStorage</h3>'), privacy.indexOf('<h3>Service Worker Cache</h3>'));
    ['bq_privacy_share_opt_out', 'bq_privacy_share_opt_out_at', 'bq_ads_country', 'btc_open_privacy_choices'].forEach(function (k) {
        assert.ok(storage.includes('<code>' + k + '</code>'), k);
    });
    assert.ok(storage.includes('Both clear when the tab closes'));
    const account = privacy.slice(privacy.indexOf('<h3>Account Data (stored in Firebase)</h3>'), privacy.indexOf('<h3>Direct Messages'));
    assert.ok(account.includes('<tr><td>Privacy choice (privacyShareOptOut, privacyShareOptOutAt)</td>'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
