#!/usr/bin/env node
// Bitcoin Beats catalog import.
// Default is dry-run and prints counts only. --apply writes.
// Firestore is used only when GOOGLE_APPLICATION_CREDENTIALS is set and
// --fixture is not. This script does not print credentials, paths, or track bodies.
// The owner runs --apply after merge. Do not point it at production from CI.
// Owner decision: keep the existing NC archive.org tracks visible.
// --hide-nc stays available and is never the default.
// Falz is flagged needsReview by default. A later import never clears
// hidden, hiddenReason, or coverRemovedReason, and it does not put back a
// coverUrl that was removed on purpose.
// A new or updated track whose title, artist, or album matches the explicit
// check is hidden. An existing hide is never cleared or renamed.
// --takedown hides a track and deletes its Storage audio object.
const fs = require('fs');
const https = require('https');
const path = require('path');
const { beatsCensor } = require('../src/beats-censor.js');

const DEFAULT_FLAG_ARTISTS = ['Falz'];

const TRACK_FIELDS = [
    'title', 'artist', 'artistDocId', 'genre', 'duration', 'source', 'feedTitle',
    'v4vGuid', 'v4vSplits', 'hasV4VSplits', 'authorId', 'authorName', 'copyrightConfirmed',
    'v4vLicense', 'license', 'attribution', 'mood', 'audioVerified', 'description',
    'albumId', 'albumTitle', 'albumType', 'trackNumber', 'albumTotalTracks', 'albumYear',
    'releaseDate', 'isrc', 'archiveLicense'
];
const TRACK_URL_FIELDS = ['sourceUrl', 'feedUrl', 'pageUrl', 'licenseUrl', 'licenseProofUrl', 'coverUrl', 'coverArt'];
const PRESERVE_FIELDS = ['plays', 'likes', 'likedBy', 'commentCount', 'createdAt'];

function httpsUrl(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!/^https:\/\/[^\s"'<>\\]+$/i.test(trimmed)) return '';
    const hostPort = trimmed.slice('https://'.length).split('/')[0];
    if (!hostPort || hostPort.indexOf('@') !== -1) return '';
    return trimmed;
}

function hostOf(url) {
    const safe = httpsUrl(url);
    if (!safe) return '';
    const match = safe.match(/^https:\/\/([^\/?#]+)/i);
    return match ? match[1].toLowerCase() : '';
}

function isStorageAudio(url) {
    const host = hostOf(url);
    return host === 'storage.googleapis.com' ||
        host === 'firebasestorage.googleapis.com' ||
        /\.firebasestorage\.app$/i.test(host);
}

function archiveItemId(url) {
    if (typeof url !== 'string') return '';
    const match = url.match(/archive\.org\/(?:details|download)\/([^\/?#]+)/i);
    if (!match) return '';
    try { return decodeURIComponent(match[1]); }
    catch (e) { return match[1]; }
}

function artistMatch(trackArtist, flagName) {
    return String(trackArtist || '').trim().toLowerCase() === String(flagName || '').trim().toLowerCase();
}

// Torn Flesh Records is the 42-track grindcore/noise item in the NC audit.
function isGrindcoreItem(item) {
    if (!item) return false;
    const creator = String(item.creator || '');
    const id = String(item.id || '');
    const note = String(item.genre || item.note || item.tags || '');
    return /torn flesh/i.test(creator) || /^tfr/i.test(id) || /grindcore/i.test(note + ' ' + creator + ' ' + id);
}

function hideNcSelected(item, hideNc) {
    if (!hideNc) return false;
    if (hideNc === true || String(hideNc).toLowerCase() === 'all') return true;
    const needle = String(hideNc).trim().toLowerCase();
    if (!needle) return true;
    if (needle === 'grindcore') return isGrindcoreItem(item);
    const hay = [item && item.id, item && item.creator, item && item.license, item && item.sourceUrl].join(' ').toLowerCase();
    return hay.indexOf(needle) !== -1;
}

function isWavlake(track) {
    const source = String(track && track.source || '').toLowerCase();
    if (source === 'podcastindex' || source === 'wavlake') return true;
    const blob = [track && track.feedUrl, track && track.sourceUrl, track && track.pageUrl, track && track.audioUrl].join(' ');
    return /wavlake\.com|op3\.dev|d12wklypp119aj\.cloudfront\.net/i.test(blob);
}

function enclosureFromItem(item) {
    if (!item) return '';
    if (typeof item.enclosure === 'string') return httpsUrl(item.enclosure);
    if (item.enclosure && typeof item.enclosure.url === 'string') return httpsUrl(item.enclosure.url);
    if (typeof item.enclosureUrl === 'string') return httpsUrl(item.enclosureUrl);
    if (typeof item.audioUrl === 'string') return httpsUrl(item.audioUrl);
    return '';
}

function decodeXml(text) {
    return String(text || '')
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .trim();
}

// Pull guid -> enclosure from a Wavlake (or Podcasting 2.0) RSS document.
// The op3.dev pg= prefix is per feed, so it has to come from the feed itself.
function parseRssEnclosures(xml) {
    const map = Object.create(null);
    if (typeof xml !== 'string' || !xml) return map;
    xml.split(/<item\b/i).slice(1).forEach(function (chunk) {
        const item = chunk.split(/<\/item>/i)[0];
        const encMatch = item.match(/<enclosure\b[^>]*\burl\s*=\s*["']([^"']+)["']/i);
        if (!encMatch) return;
        const url = httpsUrl(decodeXml(encMatch[1]));
        if (!url || isStorageAudio(url)) return;
        const guids = [];
        const guidRe = /<guid\b[^>]*>([\s\S]*?)<\/guid>/gi;
        let match;
        while ((match = guidRe.exec(item))) guids.push(decodeXml(match[1]));
        const podcastGuid = item.match(/<podcast:guid\b[^>]*>([\s\S]*?)<\/podcast:guid>/i);
        if (podcastGuid) guids.push(decodeXml(podcastGuid[1]));
        const fromCdn = url.match(/\/track\/([0-9a-f-]{8,})\.[a-z0-9]+/i);
        if (fromCdn) guids.push(fromCdn[1]);
        guids.forEach(function (guid) {
            if (guid && !map[guid]) map[guid] = url;
        });
    });
    return map;
}

function wavlakeFeedUrl(value) {
    const safe = httpsUrl(value);
    if (!safe) return '';
    const host = hostOf(safe);
    if (host !== 'wavlake.com' && host !== 'www.wavlake.com') return '';
    return safe.split('#')[0];
}

function buildEnclosureMap(tracks, feeds, extra) {
    const map = Object.create(null);
    (feeds || []).forEach(function (feed) {
        const items = (feed && (feed.items || feed.entries)) || [];
        items.forEach(function (item) {
            const guid = item && (item.guid || item.v4vGuid || item.id);
            const enc = enclosureFromItem(item);
            if (guid && enc && !isStorageAudio(enc)) map[String(guid)] = enc;
        });
    });
    (tracks || []).forEach(function (track) {
        if (!track || !track.v4vGuid || !isWavlake(track)) return;
        const enc = httpsUrl(track.audioUrl);
        if (enc && !isStorageAudio(enc)) map[String(track.v4vGuid)] = enc;
    });
    if (extra && typeof extra === 'object') {
        Object.keys(extra).forEach(function (guid) {
            const enc = httpsUrl(extra[guid]);
            if (guid && enc && !isStorageAudio(enc)) map[String(guid)] = enc;
        });
    }
    return map;
}

function mergeFlagArtists(extra) {
    const out = [];
    const seen = Object.create(null);
    DEFAULT_FLAG_ARTISTS.concat(extra || []).forEach(function (name) {
        const trimmed = String(name || '').trim();
        const key = trimmed.toLowerCase();
        if (!key || seen[key]) return;
        seen[key] = 1;
        out.push(trimmed);
    });
    return out;
}

function storageObjectFromUrl(url) {
    const safe = httpsUrl(url);
    if (!safe || !isStorageAudio(safe)) return null;
    const host = hostOf(safe);
    if (host === 'storage.googleapis.com') {
        const rest = safe.slice('https://'.length + host.length + 1);
        const slash = rest.indexOf('/');
        if (slash <= 0) return null;
        const filePath = decodeURIComponent(rest.slice(slash + 1).split('?')[0]);
        if (!filePath || filePath.indexOf('..') !== -1) return null;
        return { bucket: rest.slice(0, slash), path: filePath };
    }
    const match = safe.match(/\/v0\/b\/([^/]+)\/o\/([^?]+)/);
    if (!match) return null;
    const filePath = decodeURIComponent(match[2]);
    if (!filePath || filePath.indexOf('..') !== -1) return null;
    return { bucket: decodeURIComponent(match[1]), path: filePath };
}

function planTakedown(track) {
    if (!track || !track.id) return { found: false, hide: false, deleteStorage: false };
    const storage = storageObjectFromUrl(track.audioUrl) || storageObjectFromUrl(track.streamUrl);
    return {
        found: true,
        hide: true,
        deleteStorage: !!storage,
        bucket: storage ? storage.bucket : '',
        path: storage ? storage.path : ''
    };
}

function hiddenFieldCleared(before, after) {
    if (!before || !after) return false;
    const hiddenGone = Object.prototype.hasOwnProperty.call(before, 'hidden') &&
        !Object.prototype.hasOwnProperty.call(after, 'hidden');
    const reasonGone = Object.prototype.hasOwnProperty.call(before, 'hiddenReason') &&
        !Object.prototype.hasOwnProperty.call(after, 'hiddenReason');
    return hiddenGone || reasonGone;
}

function fetchText(url, redirectsLeft) {
    return new Promise(function (resolve, reject) {
        if (!httpsUrl(url)) {
            reject(new Error('bad url'));
            return;
        }
        const req = https.get(url, {
            headers: {
                'User-Agent': 'BitcoinBeatsCatalogImport/1.0',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            },
            timeout: 20000
        }, function (res) {
            const code = res.statusCode || 0;
            if (code >= 300 && code < 400 && res.headers.location) {
                res.resume();
                if (!redirectsLeft) {
                    reject(new Error('redirect'));
                    return;
                }
                let next = '';
                try { next = new URL(res.headers.location, url).href; }
                catch (e) { next = ''; }
                if (!wavlakeFeedUrl(next) && hostOf(next) !== 'wavlake.com' && hostOf(next) !== 'www.wavlake.com') {
                    reject(new Error('redirect'));
                    return;
                }
                resolve(fetchText(next, redirectsLeft - 1));
                return;
            }
            if (code !== 200) {
                res.resume();
                reject(new Error('status'));
                return;
            }
            const chunks = [];
            let size = 0;
            res.on('data', function (chunk) {
                size += chunk.length;
                if (size > 8 * 1024 * 1024) {
                    req.destroy();
                    reject(new Error('too large'));
                    return;
                }
                chunks.push(chunk);
            });
            res.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
        });
        req.on('error', function () { reject(new Error('fetch')); });
        req.on('timeout', function () { req.destroy(); reject(new Error('timeout')); });
    });
}

async function resolveEnclosuresFromFeeds(existingTracks, feeds) {
    const urls = Object.create(null);
    function add(url) {
        const safe = wavlakeFeedUrl(url);
        if (safe) urls[safe] = 1;
    }
    (feeds || []).forEach(function (feed) { add(feed && (feed.feedUrl || feed.url)); });
    (existingTracks || []).forEach(function (track) {
        if (!isWavlake(track)) return;
        add(track.feedUrl);
        add(track.sourceUrl);
    });
    const list = Object.keys(urls);
    const map = Object.create(null);
    let fetched = 0;
    let failed = 0;
    let cursor = 0;
    async function worker() {
        for (;;) {
            const index = cursor++;
            if (index >= list.length) return;
            try {
                const xml = await fetchText(list[index], 3);
                const parsed = parseRssEnclosures(xml);
                Object.keys(parsed).forEach(function (guid) {
                    if (!map[guid]) map[guid] = parsed[guid];
                });
                fetched++;
            } catch (e) {
                failed++;
            }
        }
    }
    const workers = [];
    const n = Math.min(6, list.length);
    for (let i = 0; i < n; i++) workers.push(worker());
    await Promise.all(workers);
    return { map: map, feedsFetched: fetched, feedsFailed: failed };
}

function sanitizeId(guid) {
    let id = String(guid || '').trim().replace(/\//g, '_');
    if (!id || id === '.' || id === '..') id = 'track';
    if (id.length > 700) id = id.slice(0, 700);
    return id;
}

function allocId(guid, used) {
    const base = sanitizeId(guid);
    if (!used[base]) {
        used[base] = 1;
        return base;
    }
    let n = 2;
    while (used[base + '_' + n]) n++;
    const id = base + '_' + n;
    used[id] = 1;
    return id;
}

function clone(obj) {
    return Object.assign({}, obj || {});
}

function copyDefined(target, raw, key) {
    if (!raw || !Object.prototype.hasOwnProperty.call(raw, key)) return;
    const value = raw[key];
    if (value === undefined || value === null) return;
    target[key] = value;
}

function applyTrackFields(target, raw) {
    TRACK_FIELDS.forEach(function (key) {
        if (key === 'v4vSplits') {
            if (raw && Array.isArray(raw.v4vSplits)) target.v4vSplits = raw.v4vSplits;
            return;
        }
        copyDefined(target, raw, key);
    });
    TRACK_URL_FIELDS.forEach(function (key) {
        if (!raw || !Object.prototype.hasOwnProperty.call(raw, key)) return;
        const safe = httpsUrl(raw[key]);
        if (safe) target[key] = safe;
    });
}

function beatsTextIsExplicit(value) {
    if (typeof value !== 'string' || !value) return false;
    return beatsCensor(value, true) !== value;
}

function trackIsExplicit(track) {
    if (!track) return false;
    return ['title', 'artist', 'authorName', 'albumTitle', 'album', 'feedTitle'].some(function (key) {
        return beatsTextIsExplicit(track[key]);
    });
}

function flagged(track, flagArtists) {
    return (flagArtists || []).some(function (name) {
        return artistMatch(track && track.artist, name) || artistMatch(track && track.authorName, name);
    });
}

function planCatalog(input) {
    const incoming = (input && input.tracks) || [];
    const incomingArtists = (input && input.artists) || [];
    const feeds = (input && input.feeds) || [];
    const audit = (input && input.audit) || [];
    const existingTracks = (input && input.existingTracks) || [];
    const existingArtists = (input && input.existingArtists) || [];
    const flagArtists = mergeFlagArtists(input && input.flagArtists);
    const enclosures = buildEnclosureMap(incoming, feeds, input && input.enclosures);

    const counts = {
        tracksUpsert: 0,
        tracksNew: 0,
        tracksUpdate: 0,
        artistsUpsert: 0,
        artistsNew: 0,
        artistsUpdate: 0,
        hidden: 0,
        wouldHideNc: 0,
        wouldHideGrindcore: 0,
        streamUrlExisting: 0,
        streamUrlUnresolved: 0,
        feedsFetched: 0,
        feedsFailed: 0,
        needsReview: 0,
        explicit: 0,
        auditTracksListed: 0,
        auditGrindcoreListed: 0,
        skipped: 0
    };
    const hideNc = input && input.hideNc;

    const auditById = Object.create(null);
    audit.forEach(function (item) {
        if (!item) return;
        const id = item.id || archiveItemId(item.sourceUrl);
        if (id) auditById[id] = item;
        const listed = Number(item.tracks) || 0;
        counts.auditTracksListed += listed;
        if (isGrindcoreItem(item)) counts.auditGrindcoreListed += listed;
    });

    const byGuid = Object.create(null);
    const usedIds = Object.create(null);
    existingTracks.forEach(function (track) {
        if (track && track.id) usedIds[track.id] = 1;
        if (track && track.v4vGuid && !byGuid[track.v4vGuid]) byGuid[track.v4vGuid] = track;
    });

    const originals = Object.create(null);
    const finalTracks = existingTracks.map(function (track) {
        const copy = clone(track);
        originals[copy.id] = clone(track);
        return copy;
    });
    const byId = Object.create(null);
    finalTracks.forEach(function (track) { byId[track.id] = track; });

    const seenGuids = Object.create(null);
    incoming.forEach(function (raw) {
        const guid = raw && typeof raw.v4vGuid === 'string' ? raw.v4vGuid.trim() : '';
        if (!guid || seenGuids[guid]) {
            counts.skipped++;
            return;
        }
        seenGuids[guid] = 1;
        counts.tracksUpsert++;
        const existing = byGuid[guid];
        let target;
        let isUpdate = false;
        if (existing) {
            isUpdate = true;
            counts.tracksUpdate++;
            target = byId[existing.id];
        } else {
            counts.tracksNew++;
            target = { id: allocId(guid, usedIds) };
            finalTracks.push(target);
            byId[target.id] = target;
        }
        const originalAudio = isUpdate ? existing.audioUrl : '';
        const keepStorage = isUpdate && isStorageAudio(originalAudio);
        applyTrackFields(target, raw);
        const enclosure = isWavlake(raw) ? (enclosures[guid] || '') : '';
        if (keepStorage) target.audioUrl = originalAudio;
        else {
            const audio = httpsUrl(raw.audioUrl);
            if (audio) target.audioUrl = audio;
        }
        if (enclosure) {
            target.streamUrl = enclosure;
            if (isUpdate) counts.streamUrlExisting++;
        }
        if (isUpdate) {
            PRESERVE_FIELDS.forEach(function (key) {
                if (Object.prototype.hasOwnProperty.call(existing, key)) target[key] = existing[key];
            });
            if (existing.authorId) target.authorId = existing.authorId;
            if (existing.needsReview === true) target.needsReview = true;
        } else {
            if (target.plays == null) target.plays = 0;
            if (target.likes == null) target.likes = 0;
        }
    });

    finalTracks.forEach(function (track) {
        const safe = track.v4vGuid && seenGuids[track.v4vGuid];
        if (!safe) {
            const itemId = archiveItemId(track.sourceUrl) || archiveItemId(track.audioUrl) || archiveItemId(track.pageUrl);
            const item = itemId && auditById[itemId];
            if (item) {
                counts.wouldHideNc++;
                if (isGrindcoreItem(item)) counts.wouldHideGrindcore++;
                if (item.license && !track.license && !track.archiveLicense) track.archiveLicense = item.license;
                if (hideNcSelected(item, hideNc)) {
                    track.hidden = true;
                    track.hiddenReason = 'license-nc';
                    counts.hidden++;
                }
            }
        }
        if (safe || !isWavlake(track) || !track.v4vGuid || !enclosures[track.v4vGuid]) return;
        if (track.streamUrl !== enclosures[track.v4vGuid]) {
            track.streamUrl = enclosures[track.v4vGuid];
            counts.streamUrlExisting++;
        }
    });

    finalTracks.forEach(function (track) {
        if (!flagged(track, flagArtists)) return;
        track.needsReview = true;
        counts.needsReview++;
    });

    // Hide a visible track when its title, artist, or album matches the
    // explicit check. Existing hides are restored in the next pass and are
    // never cleared here.
    finalTracks.forEach(function (track) {
        const before = originals[track.id];
        if (before && before.hidden === true) return;
        if (!track.v4vGuid || !seenGuids[track.v4vGuid]) return;
        if (!trackIsExplicit(track)) return;
        track.hidden = true;
        track.hiddenReason = 'explicit';
        track.needsReview = true;
    });

    // Moderation hides and removed covers survive every import path, including
    // a catalog row that still has the old coverUrl.
    finalTracks.forEach(function (track) {
        const before = originals[track.id];
        if (!before) return;
        if (before.hidden === true) {
            track.hidden = true;
            if (before.hiddenReason) track.hiddenReason = before.hiddenReason;
        }
        if (!before.coverRemovedReason) return;
        track.coverRemovedReason = before.coverRemovedReason;
        if (!before.coverUrl) delete track.coverUrl;
        else track.coverUrl = before.coverUrl;
        if (!before.coverArt) delete track.coverArt;
        else track.coverArt = before.coverArt;
    });

    finalTracks.forEach(function (track) {
        if (track.hidden === true && track.hiddenReason === 'explicit') counts.explicit++;
    });

    finalTracks.forEach(function (track) {
        const before = originals[track.id];
        if (!before || !isWavlake(before)) return;
        const stream = httpsUrl(track.streamUrl);
        if (!stream || isStorageAudio(stream)) counts.streamUrlUnresolved++;
    });

    const artistOriginals = Object.create(null);
    const finalArtists = existingArtists.map(function (artist) {
        const copy = clone(artist);
        artistOriginals[copy.id] = clone(artist);
        return copy;
    });
    const artistById = Object.create(null);
    finalArtists.forEach(function (artist) {
        if (artist && artist.id) artistById[artist.id] = artist;
    });
    const seenArtists = Object.create(null);
    incomingArtists.forEach(function (raw) {
        const id = raw && (raw.slug || raw.id) ? String(raw.slug || raw.id).trim() : '';
        if (!id || seenArtists[id]) {
            counts.skipped++;
            return;
        }
        seenArtists[id] = 1;
        counts.artistsUpsert++;
        let target = artistById[id];
        if (target) {
            counts.artistsUpdate++;
        } else {
            counts.artistsNew++;
            target = { id: id };
            finalArtists.push(target);
            artistById[id] = target;
        }
        const claimedLocked = target.claimed === true || (typeof target.claimedUid === 'string' && target.claimedUid.length > 0);
        const claimed = target.claimed === true;
        const claimedUid = target.claimedUid;
        if (raw.name) target.name = String(raw.name);
        if (raw.slug) target.slug = String(raw.slug);
        if (typeof raw.bio === 'string') target.bio = raw.bio;
        if (raw.source) target.source = String(raw.source);
        ['avatarUrl', 'wavlakeUrl'].forEach(function (key) {
            if (!Object.prototype.hasOwnProperty.call(raw, key)) return;
            if (raw[key] == null || raw[key] === '') {
                if (!target[key]) target[key] = '';
                return;
            }
            const safe = httpsUrl(raw[key]);
            if (safe) target[key] = safe;
        });
        if (claimedLocked) {
            target.claimed = claimed || target.claimed === true;
            if (claimedUid) target.claimedUid = claimedUid;
        } else if (!artistOriginals[id]) {
            target.claimed = raw.claimed === true;
            if (typeof raw.claimedUid === 'string' && raw.claimedUid) target.claimedUid = raw.claimedUid;
        }
    });

    function changed(before, after) {
        return JSON.stringify(before || null) !== JSON.stringify(after || null);
    }
    const trackWrites = [];
    finalTracks.forEach(function (track) {
        const before = originals[track.id] || null;
        if (!before || changed(before, track)) trackWrites.push({ id: track.id, before: before, after: track, isNew: !before });
    });
    const artistWrites = [];
    finalArtists.forEach(function (artist) {
        const before = artistOriginals[artist.id] || null;
        if (!before || changed(before, artist)) artistWrites.push({ id: artist.id, before: before, after: artist, isNew: !before });
    });

    return { counts: counts, trackWrites: trackWrites, artistWrites: artistWrites, tracks: finalTracks, artists: finalArtists };
}

function printCounts(mode, counts) {
    console.log([
        'mode: ' + mode,
        'tracks_upsert: ' + counts.tracksUpsert,
        'tracks_new: ' + counts.tracksNew,
        'tracks_update: ' + counts.tracksUpdate,
        'artists_upsert: ' + counts.artistsUpsert,
        'artists_new: ' + counts.artistsNew,
        'artists_update: ' + counts.artistsUpdate,
        'would_hide_nc: ' + counts.wouldHideNc,
        'would_hide_grindcore: ' + counts.wouldHideGrindcore,
        'hidden_license_nc: ' + counts.hidden,
        'stream_url_existing: ' + counts.streamUrlExisting,
        'stream_url_unresolved: ' + (counts.streamUrlUnresolved || 0),
        'feeds_fetched: ' + (counts.feedsFetched || 0),
        'feeds_failed: ' + (counts.feedsFailed || 0),
        'needs_review: ' + counts.needsReview,
        'hidden_explicit: ' + (counts.explicit || 0),
        'audit_tracks_listed: ' + counts.auditTracksListed,
        'audit_grindcore_listed: ' + counts.auditGrindcoreListed,
        'skipped: ' + counts.skipped
    ].join('\n'));
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function credentialsConfigured() {
    return typeof process.env.GOOGLE_APPLICATION_CREDENTIALS === 'string' &&
        process.env.GOOGLE_APPLICATION_CREDENTIALS.length > 0;
}

function safeError(err) {
    const msg = err && err.message ? String(err.message) : 'Import failed';
    if (/private_key|BEGIN |client_email|AIza|GOOGLE_APPLICATION_CREDENTIALS/i.test(msg)) return 'Import failed';
    return msg.slice(0, 300);
}

function parseArgs(argv) {
    const out = { flagArtists: [], apply: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--apply') out.apply = true;
        else if (arg === '--help' || arg === '-h') out.help = true;
        else if (arg === '--data-dir') out.dataDir = argv[++i];
        else if (arg === '--fixture') out.fixture = argv[++i];
        else if (arg === '--fixture-artists') out.fixtureArtists = argv[++i];
        else if (arg === '--out') out.out = argv[++i];
        else if (arg === '--hide-nc') out.hideNc = true;
        else if (arg.indexOf('--hide-nc=') === 0) out.hideNc = arg.slice('--hide-nc='.length) || true;
        else if (arg === '--flag-artist') out.flagArtists.push(argv[++i] || '');
        else if (arg === '--enclosures') out.enclosures = argv[++i];
        else if (arg === '--takedown') out.takedown = argv[++i] || '';
        else if (arg.indexOf('--') === 0) {
            console.error('Unknown argument');
            process.exit(1);
        } else {
            console.error('Unknown argument');
            process.exit(1);
        }
    }
    return out;
}

async function readCollection(db, admin, name) {
    const rows = [];
    const field = admin.firestore.FieldPath.documentId();
    let last = null;
    for (;;) {
        let query = db.collection(name).orderBy(field).limit(400);
        if (last) query = query.startAfter(last);
        const snap = await query.get();
        if (snap.empty) break;
        snap.forEach(function (doc) {
            rows.push(Object.assign({ id: doc.id }, doc.data()));
        });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < 400) break;
    }
    return rows;
}

function payloadFrom(after, admin, isNew, before) {
    const data = Object.assign({}, after);
    delete data.id;
    if (isNew && !data.createdAt) data.createdAt = admin.firestore.FieldValue.serverTimestamp();
    if (before && before.hidden === true) {
        data.hidden = true;
        if (before.hiddenReason) data.hiddenReason = before.hiddenReason;
    }
    if (before && before.coverRemovedReason) {
        data.coverRemovedReason = before.coverRemovedReason;
        if (!before.coverUrl) delete data.coverUrl;
        if (!before.coverArt) delete data.coverArt;
    }
    return data;
}

async function commitPlan(db, admin, plan) {
    let batch = db.batch();
    let pending = 0;
    async function put(ref, data) {
        batch.set(ref, data, { merge: true });
        pending++;
        if (pending >= 400) {
            await batch.commit();
            batch = db.batch();
            pending = 0;
        }
    }
    for (const write of plan.trackWrites) {
        await put(
            db.collection('beats_tracks').doc(write.id),
            payloadFrom(write.after, admin, write.isNew, write.before)
        );
    }
    for (const write of plan.artistWrites) {
        await put(
            db.collection('beats_artists').doc(write.id),
            payloadFrom(write.after, admin, write.isNew, write.before)
        );
    }
    if (pending) await batch.commit();
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log([
            'Bitcoin Beats catalog import. Default is dry-run (counts only).',
            '--apply writes. --fixture never opens Firestore.',
            '--data-dir DIR   tracks.json, artists.json, feeds.json, and the archive audit',
            '--fixture FILE   existing tracks JSON',
            '--fixture-artists FILE',
            '--out FILE       JSON result for --fixture --apply',
            '--flag-artist NAME   also set needsReview (Falz is already the default)',
            '--enclosures FILE    guid -> https enclosure JSON, merged with fetched feeds',
            '--hide-nc            opt in: hide every audited NC archive.org track',
            '--hide-nc=grindcore  opt in: hide only the 42 Torn Flesh Records tracks',
            '--takedown ID        hide that track and delete its Storage audio file',
            '--apply'
        ].join('\n'));
        return;
    }
    if (args.takedown) {
        await runTakedown(args);
        return;
    }
    const dataDir = args.dataDir || process.env.BEATS_DATA_DIR;
    if (!dataDir) {
        console.error('Pass --data-dir or set BEATS_DATA_DIR.');
        process.exit(1);
    }
    const tracks = readJson(path.join(dataDir, 'tracks.json'));
    const artists = readJson(path.join(dataDir, 'artists.json'));
    const feeds = readJson(path.join(dataDir, 'feeds.json'));
    const audit = readJson(path.join(dataDir, 'existing_archive_org_license_audit.json'));

    let existingTracks = [];
    let existingArtists = [];
    let admin = null;
    let db = null;
    if (args.fixture) {
        existingTracks = readJson(args.fixture);
        existingArtists = args.fixtureArtists ? readJson(args.fixtureArtists) : [];
    } else if (!credentialsConfigured()) {
        console.error('Refusing Firestore access. Set GOOGLE_APPLICATION_CREDENTIALS or pass --fixture.');
        process.exit(1);
    } else {
        admin = require('firebase-admin');
        if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.applicationDefault() });
        db = admin.firestore();
        existingTracks = await readCollection(db, admin, 'beats_tracks');
        existingArtists = await readCollection(db, admin, 'beats_artists');
    }

    let enclosureMap = null;
    if (args.enclosures) enclosureMap = readJson(args.enclosures);
    let feedStats = { feedsFetched: 0, feedsFailed: 0, map: null };
    if (!args.fixture) {
        feedStats = await resolveEnclosuresFromFeeds(existingTracks, feeds);
        enclosureMap = Object.assign({}, enclosureMap || {}, feedStats.map || {});
    }
    const plan = planCatalog({
        tracks: tracks,
        artists: artists,
        feeds: feeds,
        audit: audit,
        existingTracks: existingTracks,
        existingArtists: existingArtists,
        flagArtists: args.flagArtists,
        hideNc: args.hideNc || false,
        enclosures: enclosureMap
    });
    plan.counts.feedsFetched = feedStats.feedsFetched || 0;
    plan.counts.feedsFailed = feedStats.feedsFailed || 0;

    if (args.fixture && args.apply) {
        if (!args.out) {
            console.error('Fixture --apply needs --out.');
            process.exit(1);
        }
        fs.writeFileSync(args.out, JSON.stringify({ tracks: plan.tracks, artists: plan.artists }));
        printCounts('fixture-apply', plan.counts);
        return;
    }
    if (args.apply) {
        await commitPlan(db, admin, plan);
        printCounts('apply', plan.counts);
        return;
    }
    printCounts('dry-run', plan.counts);
}

async function loadTrackById(args, id) {
    if (args.fixture) {
        const rows = readJson(args.fixture);
        return (rows || []).find(function (track) { return track && track.id === id; }) || null;
    }
    if (!credentialsConfigured()) {
        console.error('Refusing Firestore access. Set GOOGLE_APPLICATION_CREDENTIALS or pass --fixture.');
        process.exit(1);
    }
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.applicationDefault() });
    const db = admin.firestore();
    const doc = await db.collection('beats_tracks').doc(id).get();
    if (!doc.exists) return null;
    return { admin: admin, db: db, track: Object.assign({ id: doc.id }, doc.data()) };
}

async function runTakedown(args) {
    const id = String(args.takedown || '').trim();
    if (!id || id.indexOf('/') !== -1 || id === '.' || id === '..' || id.length > 700) {
        console.error('Pass --takedown with a track id.');
        process.exit(1);
    }
    let track = null;
    let admin = null;
    let db = null;
    if (args.fixture) {
        track = await loadTrackById(args, id);
    } else {
        const loaded = await loadTrackById(args, id);
        if (loaded) {
            admin = loaded.admin;
            db = loaded.db;
            track = loaded.track;
        }
    }
    const plan = planTakedown(track);
    const mode = args.apply ? (args.fixture ? 'fixture-apply' : 'apply') : 'dry-run';
    if (!plan.found) {
        console.log(['mode: ' + mode, 'takedown: 0', 'takedown_storage: 0'].join('\n'));
        process.exit(1);
    }
    if (args.apply && args.fixture) {
        if (!args.out) {
            console.error('Fixture --apply needs --out.');
            process.exit(1);
        }
        const after = Object.assign({}, track, { hidden: true, hiddenReason: 'takedown' });
        if (plan.deleteStorage) delete after.audioUrl;
        fs.writeFileSync(args.out, JSON.stringify({ track: after, deleteStorage: plan.deleteStorage }));
    } else if (args.apply) {
        await db.collection('beats_tracks').doc(id).set({
            hidden: true,
            hiddenReason: 'takedown'
        }, { merge: true });
        if (plan.deleteStorage) {
            await admin.storage().bucket(plan.bucket).file(plan.path).delete({ ignoreNotFound: true });
        }
    }
    console.log(['mode: ' + mode, 'takedown: 1', 'takedown_storage: ' + (plan.deleteStorage ? 1 : 0)].join('\n'));
}

module.exports = {
    planCatalog: planCatalog,
    httpsUrl: httpsUrl,
    archiveItemId: archiveItemId,
    artistMatch: artistMatch,
    isGrindcoreItem: isGrindcoreItem,
    parseRssEnclosures: parseRssEnclosures,
    planTakedown: planTakedown,
    storageObjectFromUrl: storageObjectFromUrl,
    hiddenFieldCleared: hiddenFieldCleared,
    mergeFlagArtists: mergeFlagArtists,
    payloadFrom: payloadFrom,
    trackIsExplicit: trackIsExplicit
};

if (require.main === module) {
    main().catch(function (err) {
        console.error(safeError(err));
        process.exit(1);
    });
}
