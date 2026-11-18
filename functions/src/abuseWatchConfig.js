// Server-only abuse-watch lists. The values live in Firestore at
// private_banks/abuse_watch (Admin SDK only; clients cannot read it) and are
// read at request time. When the document is missing or malformed, every list
// is empty, so the admin reports simply show no matches.
'use strict';

const DOC_PATH = ['private_banks', 'abuse_watch'];
const MAX_ITEMS = 500;

function strList(v) {
    if (!Array.isArray(v)) return [];
    return v.filter(function (x) { return typeof x === 'string' && x.trim(); })
        .map(function (x) { return x.trim(); })
        .slice(0, MAX_ITEMS);
}

function patternList(v) {
    if (!Array.isArray(v)) return [];
    const out = [];
    for (const p of v.slice(0, MAX_ITEMS)) {
        if (!p || typeof p.source !== 'string' || !p.source) continue;
        const flags = typeof p.flags === 'string' ? p.flags.replace(/[^imsu]/g, '') : 'i';
        try { out.push(new RegExp(p.source, flags)); } catch (e) { /* skip invalid */ }
    }
    return out;
}

function normalize(data) {
    const d = data && typeof data === 'object' ? data : {};
    return {
        watchlistUids: strList(d.watchlistUids),
        blacklistedLn: strList(d.blacklistedLn),
        knownEmailPatterns: patternList(d.knownEmailPatterns),
    };
}

async function loadAbuseWatchConfig(db) {
    try {
        const snap = await db.collection(DOC_PATH[0]).doc(DOC_PATH[1]).get();
        if (!snap.exists) {
            console.warn('[abuseWatchConfig] config document missing; using empty lists');
            return normalize(null);
        }
        return normalize(snap.data());
    } catch (e) {
        console.warn('[abuseWatchConfig] read failed; using empty lists');
        return normalize(null);
    }
}

module.exports = { loadAbuseWatchConfig, normalize, DOC_PATH };
