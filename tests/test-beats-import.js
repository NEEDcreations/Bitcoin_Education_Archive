#!/usr/bin/env node
// Fixture dry-run and fixture apply for functions/scripts/beats_import.js.
// Never contacts Firestore.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const script = path.join(root, 'functions', 'scripts', 'beats_import.js');
const fixtureDir = path.join(__dirname, 'fixtures', 'beats-import');
const importer = require(script);

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function run(extra) {
    return execFileSync(process.execPath, [script].concat(extra), {
        encoding: 'utf8',
        env: Object.assign({}, process.env, { GOOGLE_APPLICATION_CREDENTIALS: '' })
    });
}

const baseArgs = [
    '--data-dir', fixtureDir,
    '--fixture', path.join(fixtureDir, 'existing-tracks.json'),
    '--fixture-artists', path.join(fixtureDir, 'existing-artists.json'),
    '--flag-artist', 'Falz'
];

test('dry-run prints counts only and does not require credentials', function () {
    const output = run(baseArgs);
    assert.ok(!/private_key|BEGIN |client_email|service.account|AIza/i.test(output));
    assert.ok(!/storage\.googleapis\.com/.test(output));
    assert.strictEqual(output.trim(), [
        'mode: dry-run',
        'tracks_upsert: 2',
        'tracks_new: 1',
        'tracks_update: 1',
        'artists_upsert: 2',
        'artists_new: 1',
        'artists_update: 1',
        'would_hide_nc: 2',
        'would_hide_grindcore: 0',
        'hidden_license_nc: 0',
        'stream_url_existing: 1',
        'needs_review: 1',
        'audit_tracks_listed: 2',
        'audit_grindcore_listed: 0',
        'skipped: 0'
    ].join('\n'));
});

test('fixture apply leaves NC archive tracks visible, hotlinks Wavlake, and flags Falz', function () {
    const out = path.join(os.tmpdir(), 'beats-import-fixture.json');
    const output = run(baseArgs.concat(['--apply', '--out', out]));
    assert.ok(output.indexOf('mode: fixture-apply') === 0);
    assert.ok(output.includes('would_hide_nc: 2'));
    assert.ok(output.includes('hidden_license_nc: 0'));
    const result = JSON.parse(fs.readFileSync(out, 'utf8'));
    const byId = {};
    result.tracks.forEach(function (track) { byId[track.id] = track; });

    assert.notStrictEqual(byId['old-archive-1'].hidden, true);
    assert.notStrictEqual(byId['old-archive-2'].hidden, true);
    assert.strictEqual(byId['old-archive-1'].archiveLicense, 'http://creativecommons.org/licenses/by-nc-nd/3.0/');
    assert.ok(byId['old-archive-1'].audioUrl.indexOf('storage.googleapis.com') !== -1);

    const wav = byId['old-wav'];
    assert.ok(wav.streamUrl.indexOf('https://op3.dev/') === 0);
    assert.ok(wav.audioUrl.indexOf('storage.googleapis.com') !== -1);
    assert.strictEqual(wav.plays, 9);
    assert.strictEqual(wav.license, 'Value-for-Value open RSS (Wavlake Open Music)');
    assert.notStrictEqual(wav.hidden, true);

    const mac = byId['incompetech:USUAN1100763'];
    assert.ok(mac, 'new track is keyed by its source id');
    assert.strictEqual(mac.license, 'CC BY 4.0');
    assert.ok(mac.attribution.indexOf('Kevin MacLeod (incompetech.com)') !== -1);
    assert.ok(mac.attribution.indexOf('By Attribution 4.0') !== -1);
    assert.strictEqual(mac.streamUrl, undefined);
    assert.notStrictEqual(mac.hidden, true);

    assert.strictEqual(byId['falz-1'].needsReview, true);
    assert.notStrictEqual(byId['falz-1'].hidden, true);
    assert.strictEqual(byId['user-1'].hidden, undefined);
    assert.strictEqual(byId['user-1'].needsReview, undefined);
    assert.strictEqual(byId['user-1'].title, 'My Upload');

    const artists = {};
    result.artists.forEach(function (artist) { artists[artist.id] = artist; });
    assert.strictEqual(artists['21satsnode'].claimed, true);
    assert.strictEqual(artists['21satsnode'].claimedUid, 'real-user-uid');
    assert.strictEqual(artists['kevin-macleod'].name, 'Kevin MacLeod');
    fs.unlinkSync(out);
});

test('--hide-nc hides the audited tracks and --hide-nc=grindcore does not', function () {
    const out = path.join(os.tmpdir(), 'beats-import-hide-nc.json');
    const output = run(baseArgs.concat(['--hide-nc', '--apply', '--out', out]));
    assert.ok(output.includes('hidden_license_nc: 2'));
    const result = JSON.parse(fs.readFileSync(out, 'utf8'));
    const byId = {};
    result.tracks.forEach(function (track) { byId[track.id] = track; });
    assert.strictEqual(byId['old-archive-1'].hidden, true);
    assert.strictEqual(byId['old-archive-1'].hiddenReason, 'license-nc');
    assert.strictEqual(byId['old-archive-2'].hidden, true);
    assert.notStrictEqual(byId['user-1'].hidden, true);
    fs.unlinkSync(out);

    const grind = path.join(os.tmpdir(), 'beats-import-grindcore.json');
    const grindOut = run(baseArgs.concat(['--hide-nc=grindcore', '--apply', '--out', grind]));
    assert.ok(grindOut.includes('would_hide_grindcore: 0'));
    assert.ok(grindOut.includes('hidden_license_nc: 0'));
    const grindResult = JSON.parse(fs.readFileSync(grind, 'utf8'));
    grindResult.tracks.forEach(function (track) {
        assert.notStrictEqual(track.hidden, true);
    });
    fs.unlinkSync(grind);
});

test('grindcore hides only the Torn Flesh Records tracks', function () {
    const torn = {
        id: 'TFR100-VA-TornFleshRecordsPresentsVestigialSickness',
        creator: 'Torn Flesh Records',
        tracks: 42,
        license: 'http://creativecommons.org/licenses/by-nc-nd/3.0/',
        sourceUrl: 'https://archive.org/details/TFR100-VA-TornFleshRecordsPresentsVestigialSickness'
    };
    const other = {
        id: 'DWK301',
        creator: 'Mounika',
        tracks: 7,
        sourceUrl: 'https://archive.org/details/DWK301'
    };
    const existing = [
        { id: 'other', source: 'archive.org', sourceUrl: other.sourceUrl, v4vGuid: 'a1', archiveLicense: 'http://creativecommons.org/licenses/by-nc-nd/3.0/' },
        { id: 'torn', source: 'archive.org', sourceUrl: torn.sourceUrl, v4vGuid: 'a2', artist: 'Torn Flesh' }
    ];
    const off = importer.planCatalog({
        tracks: [], artists: [], feeds: [], audit: [torn, other],
        existingTracks: existing, existingArtists: []
    });
    assert.strictEqual(off.counts.wouldHideNc, 2);
    assert.strictEqual(off.counts.wouldHideGrindcore, 1);
    assert.strictEqual(off.counts.hidden, 0);
    assert.strictEqual(off.counts.auditGrindcoreListed, 42);
    assert.notStrictEqual(off.tracks[0].hidden, true);
    assert.notStrictEqual(off.tracks[1].hidden, true);

    const only = importer.planCatalog({
        tracks: [], artists: [], feeds: [], audit: [torn, other],
        existingTracks: existing, existingArtists: [], hideNc: 'grindcore'
    });
    const byId = {};
    only.tracks.forEach(function (track) { byId[track.id] = track; });
    assert.strictEqual(only.counts.hidden, 1);
    assert.strictEqual(byId.torn.hidden, true);
    assert.strictEqual(byId.torn.hiddenReason, 'license-nc');
    assert.notStrictEqual(byId.other.hidden, true);
    assert.strictEqual(importer.isGrindcoreItem(torn), true);
    assert.strictEqual(importer.isGrindcoreItem(other), false);
});

test('flagging an artist does not hide their tracks', function () {
    const plan = importer.planCatalog({
        tracks: [],
        artists: [],
        feeds: [],
        audit: [],
        existingTracks: [{ id: 'f', artist: 'Falz', source: 'podcastindex', v4vGuid: 'g', audioUrl: 'https://storage.googleapis.com/b/a.mp3' }],
        existingArtists: [],
        flagArtists: ['Falz']
    });
    assert.strictEqual(plan.counts.needsReview, 1);
    assert.strictEqual(plan.counts.hidden, 0);
    assert.strictEqual(plan.trackWrites[0].after.needsReview, true);
    assert.notStrictEqual(plan.trackWrites[0].after.hidden, true);
});

test('javascript license URLs are dropped', function () {
    assert.strictEqual(importer.httpsUrl('javascript:alert(1)'), '');
    assert.strictEqual(importer.httpsUrl('http://creativecommons.org/licenses/by/4.0/'), '');
    assert.ok(importer.httpsUrl('https://creativecommons.org/licenses/by/4.0/'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
