'use strict';
// Maps a Giphy search response to the {thumb, full} list the chat GIF pickers use.
// "full" is the smaller downsized rendition (Giphy keeps these near or under 2 MB)
// so a GIF in chat never makes every viewer load a huge original file.
// Only https URLs on Giphy's media hosts are returned.

const GIPHY_MEDIA = /^https:\/\/(?:media[0-9]?\.giphy\.com|i\.giphy\.com)\/[^\s"'<>]+$/i;
const MAX_FULL_BYTES = 5 * 1024 * 1024;

function okUrl(u) {
    return typeof u === 'string' && u.length <= 2048 && GIPHY_MEDIA.test(u);
}

function pick(images, keys, maxBytes) {
    for (const k of keys) {
        const r = images[k];
        if (!r || !okUrl(r.url)) continue;
        const size = parseInt(r.size, 10);
        if (maxBytes && size > maxBytes) continue;
        return r.url;
    }
    return '';
}

function mapGiphyResults(json) {
    if (!json || !Array.isArray(json.data)) return [];
    const out = [];
    for (const gif of json.data) {
        const images = (gif && gif.images) || {};
        const thumb = pick(images, ['fixed_height_small', 'fixed_height', 'downsized'], 0);
        const full = pick(images, ['downsized', 'downsized_medium', 'fixed_height', 'original'], MAX_FULL_BYTES) || thumb;
        if (thumb && full) out.push({ thumb, full });
    }
    return out;
}

function clampQuery(q) {
    return String(q || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 100);
}

function clampLimit(n) {
    return Math.min(Math.max(parseInt(n, 10) || 20, 1), 50);
}

module.exports = { mapGiphyResults, clampQuery, clampLimit, okUrl, MAX_FULL_BYTES };
