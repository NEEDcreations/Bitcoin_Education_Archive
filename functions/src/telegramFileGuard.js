'use strict';

// Refuse Telegram bot file URLs before they reach Firestore.
// A file URL looks like https://api.telegram.org/file/bot<digits>:<secret>/...
// The bot token in that path is a credential. global_chat is world-readable,
// so the token must never be stored, logged, or returned to a client.
//
// The only server writer that builds these URLs is workers/chat-bridge. It
// downloads the file and stores a Firebase Storage download URL instead.
// Both that worker and scripts/scrub-telegram-urls.js call assertFirestoreSafe
// on every Firestore payload. The chat mirror uses the same check so a leaked
// URL cannot be copied into telegram_mirror_queue.

const FILE_MARKER = 'api.telegram.org/file/bot';
const BOT_TOKEN_RE = /\/bot\d+:/i;

// The chat-bridge worker writes Telegram media into global_chat only
// (group messages and the broadcast channel). No other server path builds
// an api.telegram.org/file/bot URL.
const SCRUB_COLLECTIONS = ['global_chat'];

const SCRUB_MARKER = {
    collection: 'maintenance',
    id: 'telegram_file_url_scrub',
};

const STORAGE_PREFIX = 'chat-images/tg/';

function containsTelegramBotMaterial(value) {
    if (typeof value !== 'string' || !value) return false;
    if (value.toLowerCase().indexOf(FILE_MARKER) !== -1) return true;
    return BOT_TOKEN_RE.test(value);
}

function findTelegramBotMaterial(value, path) {
    const here = path || [];
    if (typeof value === 'string') {
        return containsTelegramBotMaterial(value) ? { path: here.slice() } : null;
    }
    if (value == null || typeof value !== 'object') return null;
    if (typeof value.toDate === 'function') return null;
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            const hit = findTelegramBotMaterial(value[i], here.concat(i));
            if (hit) return hit;
        }
        return null;
    }
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (containsTelegramBotMaterial(key)) return { path: here.concat(key) };
        const hit = findTelegramBotMaterial(value[key], here.concat(key));
        if (hit) return hit;
    }
    return null;
}

function listTelegramBotMaterial(value, path, out) {
    const here = path || [];
    const found = out || [];
    if (typeof value === 'string') {
        if (containsTelegramBotMaterial(value)) found.push({ path: here.slice(), value: value });
        return found;
    }
    if (value == null || typeof value !== 'object') return found;
    if (typeof value.toDate === 'function') return found;
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) listTelegramBotMaterial(value[i], here.concat(i), found);
        return found;
    }
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (containsTelegramBotMaterial(key)) found.push({ path: here.concat(key), value: key });
        listTelegramBotMaterial(value[key], here.concat(key), found);
    }
    return found;
}

function fieldLabel(path) {
    const parts = path || [];
    if (!parts.length) return '$';
    let label = '';
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (typeof part === 'number') label += '[' + part + ']';
        else label += (label ? '.' : '') + part;
    }
    return containsTelegramBotMaterial(label) ? '$' : label;
}

function assertFirestoreSafe(value) {
    const hit = findTelegramBotMaterial(value, []);
    if (!hit) return;
    const err = new Error('refusing to write telegram bot material');
    err.code = 'telegram-bot-material';
    err.field = fieldLabel(hit.path);
    throw err;
}

function redactSecrets(value) {
    return String(value == null ? '' : value)
        .replace(/https?:\/\/api\.telegram\.org\/file\/bot[^\s"'<>\\]*/gi, '[telegram-file]')
        .replace(/\/bot\d+:[A-Za-z0-9_-]+/gi, '/bot[redacted]');
}

function hexOf(bytes) {
    const list = bytes || [];
    let hex = '';
    for (let i = 0; i < list.length; i++) {
        const n = list[i] & 255;
        hex += (n < 16 ? '0' : '') + n.toString(16);
    }
    return hex;
}

function extensionOf(filePath) {
    const base = String(filePath || '').split('/').pop().split('?')[0].split('#')[0];
    const dot = base.lastIndexOf('.');
    const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
    if (!/^[a-z0-9]{1,8}$/.test(ext)) return 'bin';
    return ext;
}

function extensionFromTelegramFileUrl(url) {
    const text = String(url || '');
    const idx = text.toLowerCase().indexOf(FILE_MARKER);
    if (idx === -1) return extensionOf(text);
    const rest = text.slice(idx + FILE_MARKER.length);
    const slash = rest.indexOf('/');
    if (slash === -1) return 'bin';
    return extensionOf(rest.slice(slash + 1));
}

function mimeForExtension(ext) {
    const key = String(ext || '').toLowerCase();
    if (key === 'jpg' || key === 'jpeg') return 'image/jpeg';
    if (key === 'png') return 'image/png';
    if (key === 'webp') return 'image/webp';
    if (key === 'gif') return 'image/gif';
    if (key === 'mp4') return 'video/mp4';
    return 'application/octet-stream';
}

function objectPathFromBytes(bytes, ext) {
    const hex = hexOf(bytes);
    if (!hex || hex.length < 32) {
        throw new Error('storage object path needs 16 random bytes');
    }
    const safe = String(ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
    return STORAGE_PREFIX + hex + '.' + safe;
}

function storageDownloadUrl(bucket, objectPath, downloadToken) {
    const name = String(objectPath || '');
    if (!name || name.indexOf('..') !== -1 || containsTelegramBotMaterial(name)) {
        throw new Error('refusing storage path');
    }
    const encoded = encodeURIComponent(name);
    let url = 'https://firebasestorage.googleapis.com/v0/b/' + bucket + '/o/' + encoded + '?alt=media';
    if (downloadToken) url += '&token=' + encodeURIComponent(String(downloadToken));
    assertFirestoreSafe(url);
    return url;
}

function setAt(root, path, value) {
    if (!path || !path.length) return value;
    const key = path[0];
    const rest = path.slice(1);
    if (!rest.length) {
        if (Array.isArray(root)) {
            const copy = root.slice();
            copy[key] = value;
            return copy;
        }
        const copy = Object.assign({}, root);
        copy[key] = value;
        return copy;
    }
    const child = root == null ? null : root[key];
    const updated = setAt(child, rest, value);
    if (Array.isArray(root)) {
        const copy = root.slice();
        copy[key] = updated;
        return copy;
    }
    const copy = Object.assign({}, root);
    copy[key] = updated;
    return copy;
}

module.exports = {
    FILE_MARKER: FILE_MARKER,
    SCRUB_COLLECTIONS: SCRUB_COLLECTIONS,
    SCRUB_MARKER: SCRUB_MARKER,
    STORAGE_PREFIX: STORAGE_PREFIX,
    containsTelegramBotMaterial: containsTelegramBotMaterial,
    findTelegramBotMaterial: findTelegramBotMaterial,
    listTelegramBotMaterial: listTelegramBotMaterial,
    fieldLabel: fieldLabel,
    assertFirestoreSafe: assertFirestoreSafe,
    redactSecrets: redactSecrets,
    hexOf: hexOf,
    extensionOf: extensionOf,
    extensionFromTelegramFileUrl: extensionFromTelegramFileUrl,
    mimeForExtension: mimeForExtension,
    objectPathFromBytes: objectPathFromBytes,
    storageDownloadUrl: storageDownloadUrl,
    setAt: setAt,
};
