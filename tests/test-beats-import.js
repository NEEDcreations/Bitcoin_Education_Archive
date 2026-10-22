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
    '--fixture-artists', path.join(fixtureDir, 'existing-artists.json')
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
        'stream_url_unresolved: 1',
        'feeds_fetched: 0',
        'feeds_failed: 0',
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

test('Falz is needsReview without a CLI flag', function () {
    const plan = importer.planCatalog({
        tracks: [],
        artists: [],
        feeds: [],
        audit: [],
        existingTracks: [{ id: 'f', artist: 'Falz', source: 'podcastindex', v4vGuid: 'g', audioUrl: 'https://storage.googleapis.com/b/a.mp3' }],
        existingArtists: []
    });
    assert.strictEqual(plan.counts.needsReview, 1);
    assert.strictEqual(plan.trackWrites[0].after.needsReview, true);
    assert.notStrictEqual(plan.trackWrites[0].after.hidden, true);
    assert.deepStrictEqual(importer.mergeFlagArtists(['falz', 'Other']), ['Falz', 'Other']);
});

test('a takedown hide survives an import that includes the guid', function () {
    const plan = importer.planCatalog({
        tracks: [{
            v4vGuid: 'keep-me',
            title: 'Kept',
            artist: 'A',
            source: 'incompetech',
            license: 'CC BY 4.0',
            audioUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/x.mp3'
        }],
        artists: [],
        feeds: [],
        audit: [],
        existingTracks: [{
            id: 'hidden-1',
            v4vGuid: 'keep-me',
            title: 'Old',
            artist: 'A',
            hidden: true,
            hiddenReason: 'takedown',
            audioUrl: 'https://storage.googleapis.com/b/a.mp3',
            plays: 3
        }],
        existingArtists: []
    });
    const track = plan.tracks.filter(function (row) { return row.id === 'hidden-1'; })[0];
    assert.strictEqual(track.hidden, true);
    assert.strictEqual(track.hiddenReason, 'takedown');
    assert.strictEqual(track.plays, 3);
    assert.strictEqual(track.audioUrl.indexOf('storage.googleapis.com') !== -1, true);
    const write = plan.trackWrites.filter(function (row) { return row.id === 'hidden-1'; })[0];
    assert.strictEqual(importer.hiddenFieldCleared(write.before, write.after), false);

    const cleared = importer.planCatalog({
        tracks: [{ v4vGuid: 'nc-1', title: 'N', artist: 'A', source: 'incompetech', license: 'CC BY 4.0', audioUrl: 'https://incompetech.com/a.mp3' }],
        artists: [], feeds: [], audit: [],
        existingTracks: [{ id: 'nc', v4vGuid: 'nc-1', title: 'N', artist: 'A', hidden: true, hiddenReason: 'license-nc', audioUrl: 'https://storage.googleapis.com/b/a.mp3' }],
        existingArtists: []
    });
    const nc = cleared.tracks.filter(function (row) { return row.id === 'nc'; })[0];
    assert.strictEqual(nc.hidden, true);
    assert.strictEqual(nc.hiddenReason, 'license-nc');
    assert.strictEqual(importer.hiddenFieldCleared(cleared.trackWrites[0].before, cleared.trackWrites[0].after), false);
});

test('import does not clear a hide or restore a removed cover', function () {
    const plan = importer.planCatalog({
        tracks: [{
            v4vGuid: 'ffs-guid',
            title: 'Covered again',
            artist: 'X',
            source: 'archive.org',
            coverUrl: 'https://archive.org/download/ffs104/cover.jpg',
            coverArt: 'https://archive.org/download/ffs104/cover.jpg',
            audioUrl: 'https://archive.org/download/ffs104/a.mp3',
            license: 'CC BY-NC-ND 3.0'
        }, {
            v4vGuid: 'plain-hide',
            title: 'Still hidden',
            artist: 'Y',
            source: 'incompetech',
            license: 'CC BY 4.0',
            audioUrl: 'https://incompetech.com/a.mp3'
        }],
        artists: [],
        feeds: [],
        audit: [],
        existingTracks: [{
            id: 'ffs',
            v4vGuid: 'ffs-guid',
            title: 'Old',
            artist: 'X',
            hidden: true,
            source: 'archive.org',
            sourceUrl: 'https://archive.org/details/ffs104',
            audioUrl: 'https://storage.googleapis.com/b/ffs.mp3',
            coverRemovedReason: 'ffs104'
        }, {
            id: 'plain',
            v4vGuid: 'plain-hide',
            title: 'Old hidden',
            artist: 'Y',
            hidden: true,
            audioUrl: 'https://storage.googleapis.com/b/plain.mp3'
        }],
        existingArtists: []
    });
    const ffs = plan.tracks.filter(function (row) { return row.id === 'ffs'; })[0];
    assert.strictEqual(ffs.hidden, true);
    assert.strictEqual(ffs.coverRemovedReason, 'ffs104');
    assert.strictEqual(ffs.coverUrl, undefined);
    assert.strictEqual(ffs.coverArt, undefined);
    assert.ok(ffs.audioUrl.indexOf('storage.googleapis.com') !== -1);
    const write = plan.trackWrites.filter(function (row) { return row.id === 'ffs'; })[0];
    assert.strictEqual(Object.prototype.hasOwnProperty.call(write.after, 'coverUrl'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(write.after, 'coverArt'), false);
    assert.strictEqual(importer.hiddenFieldCleared(write.before, write.after), false);
    const dirty = Object.assign({}, write.after, { coverUrl: 'https://archive.org/download/ffs104/cover.jpg', coverArt: 'https://archive.org/download/ffs104/cover.jpg' });
    const payload = importer.payloadFrom(dirty, null, false, write.before);
    assert.strictEqual(payload.hidden, true);
    assert.strictEqual(payload.coverRemovedReason, 'ffs104');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(payload, 'coverUrl'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(payload, 'coverArt'), false);
    const plain = plan.tracks.filter(function (row) { return row.id === 'plain'; })[0];
    assert.strictEqual(plain.hidden, true);
    assert.strictEqual(plain.hiddenReason, undefined);
});

test('RSS enclosures resolve an existing Wavlake track and keep the Storage file', function () {
    const xml = '<rss><channel><item><guid isPermaLink="false">abc-123</guid>' +
        '<enclosure url="https://op3.dev/e,pg=feed-guid/https://d12wklypp119aj.cloudfront.net/track/abc-123.mp3" type="audio/mpeg"/>' +
        '</item></channel></rss>';
    const map = importer.parseRssEnclosures(xml);
    assert.ok(map['abc-123'].indexOf('https://op3.dev/') === 0);
    const plan = importer.planCatalog({
        tracks: [], artists: [], feeds: [], audit: [],
        existingTracks: [{ id: 'w', v4vGuid: 'abc-123', artist: 'X', source: 'podcastindex', sourceUrl: 'https://wavlake.com/feed/music/album', audioUrl: 'https://storage.googleapis.com/b/a.mp3' }],
        existingArtists: [],
        enclosures: map
    });
    assert.strictEqual(plan.counts.streamUrlExisting, 1);
    assert.strictEqual(plan.counts.streamUrlUnresolved, 0);
    assert.ok(plan.tracks[0].audioUrl.indexOf('storage.googleapis.com') !== -1);
    assert.ok(plan.tracks[0].streamUrl.indexOf('https://op3.dev/') === 0);
    assert.strictEqual(importer.parseRssEnclosures('<item><enclosure url="javascript:alert(1)"/></item>')['x'], undefined);
});

test('takedown plan hides the track and names a Storage object without writing', function () {
    const plan = importer.planTakedown({
        id: 'old-archive-1',
        audioUrl: 'https://storage.googleapis.com/example-bucket/beats-v4v/grind.mp3'
    });
    assert.strictEqual(plan.found, true);
    assert.strictEqual(plan.hide, true);
    assert.strictEqual(plan.deleteStorage, true);
    assert.strictEqual(plan.bucket, 'example-bucket');
    assert.strictEqual(plan.path, 'beats-v4v/grind.mp3');
    const firebase = importer.storageObjectFromUrl('https://firebasestorage.googleapis.com/v0/b/example/o/beats%2Fmine.mp3?alt=media');
    assert.strictEqual(firebase.bucket, 'example');
    assert.strictEqual(firebase.path, 'beats/mine.mp3');
    assert.strictEqual(importer.planTakedown(null).found, false);
    const output = run(['--takedown', 'old-archive-1', '--fixture', path.join(fixtureDir, 'existing-tracks.json')]);
    assert.strictEqual(output.trim(), ['mode: dry-run', 'takedown: 1', 'takedown_storage: 1'].join('\n'));
    assert.ok(!/example-bucket|GOOGLE_APPLICATION/.test(output));
});

test('javascript license URLs are dropped', function () {
    assert.strictEqual(importer.httpsUrl('javascript:alert(1)'), '');
    assert.strictEqual(importer.httpsUrl('http://creativecommons.org/licenses/by/4.0/'), '');
    assert.ok(importer.httpsUrl('https://creativecommons.org/licenses/by/4.0/'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
