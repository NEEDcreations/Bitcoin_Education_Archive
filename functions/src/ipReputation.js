'use strict';

// IPQualityScore reputation and device checks for reward paths.
// The API key stays on the server. Cache keys and device docs are HMACs.
// Nothing in this file logs a raw IP, a device id, a request id, or the key.

const faucetGuard = require('./faucetGuard');
const ipHmac = require('./ipHmac');

const TIMEOUT_MS = 2500;
const DEFAULT_DAILY_CAP = 30;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HIGH_TTL_MS = 24 * 60 * 60 * 1000;
const DEVICE_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const USAGE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const FRESH_MS = 2 * 60 * 1000;

const DENY_CONNECTION = "This connection can't claim sats. Turn off your VPN or contact support.";
const HOLD_CONNECTION = 'Switch to a regular connection to claim sats. A VPN, proxy, or Tor exit can\'t claim right now.';
const HOLD_DEVICE = 'This device is already linked to another account. Contact support if this is a shared household.';
const DENY_DEVICE = "This device can't claim rewards right now. Contact support.";

const IP_URL = 'https://ipqualityscore.com/api/json/ip/';
const POSTBACK_URL = 'https://ipqualityscore.com/api/json/postback/';

function flag(value) {
    return value === true || value === 'true' || value === 1;
}

function isDatacenter(value) {
    return String(value || '').trim().toLowerCase() === 'data center';
}

function countryCode(body) {
    const code = String((body && (body.country_code || body.country)) || '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : '';
}

function failureReason(body, status) {
    const msg = String((body && body.message) || '').toLowerCase();
    if (status === 402 || status === 429) return 'credits';
    if (msg.indexOf('credit') !== -1 || msg.indexOf('insufficient') !== -1) return 'credits';
    if (status && status >= 400) return 'http';
    if (body && body.success === false) return 'lookup';
    return 'lookup';
}

function scoreIpLookup(body) {
    if (!body || typeof body !== 'object' || body.success === false) {
        return {
            action: 'fallback',
            reason: failureReason(body, 0),
            fraudScore: null,
            vpn: false,
            proxy: false,
            tor: false,
            datacenter: false,
            recentAbuse: false,
            botnet: false,
            countryCode: '',
        };
    }
    const score = Number(body.fraud_score);
    const fraudScore = Number.isFinite(score) ? score : null;
    const vpn = flag(body.vpn) || flag(body.active_vpn);
    const proxy = flag(body.proxy);
    const tor = flag(body.tor) || flag(body.active_tor);
    const knownVpn = vpn || proxy || tor;
    const datacenter = isDatacenter(body.connection_type);
    const recentAbuse = flag(body.recent_abuse);
    const botnet = flag(body.bot_status);
    const base = {
        fraudScore: fraudScore,
        vpn: vpn,
        proxy: proxy,
        tor: tor,
        datacenter: datacenter,
        recentAbuse: recentAbuse,
        botnet: botnet,
        countryCode: countryCode(body),
    };
    if ((datacenter && !knownVpn) || botnet || recentAbuse || (fraudScore != null && fraudScore >= 90)) {
        let reason = 'fraud-score';
        if (datacenter && !knownVpn) reason = 'datacenter';
        else if (botnet) reason = 'botnet';
        else if (recentAbuse) reason = 'recent-abuse';
        return Object.assign({ action: 'deny', reason: reason }, base);
    }
    if (knownVpn || (fraudScore != null && fraudScore >= 75 && fraudScore <= 89)) {
        let reason = 'score-hold';
        if (vpn) reason = 'vpn';
        else if (proxy) reason = 'proxy';
        else if (tor) reason = 'tor';
        return Object.assign({ action: 'hold', reason: reason }, base);
    }
    return Object.assign({ action: 'allow', reason: 'clean' }, base);
}

function cacheTtlMs(verdict) {
    const score = verdict && verdict.fraudScore;
    if (!verdict || verdict.action !== 'allow' || (score != null && score >= 75)) return HIGH_TTL_MS;
    return CACHE_TTL_MS;
}

function canonicalIp(ip) {
    const net = faucetGuard.networkKeys(ip);
    if (!net) return '';
    if (net.version === 4) return net.exactId.split('_').join('.');
    const groups = String(net.exactId || '').split('_');
    if (groups.length !== 8) return '';
    return groups.join(':');
}

function canonicalRange(ip) {
    const net = faucetGuard.networkKeys(ip);
    if (!net) return '';
    if (net.version === 4) {
        const parts = net.exactId.split('_');
        return parts[0] + '.' + parts[1] + '.' + parts[2] + '.0/24';
    }
    const groups = String(net.exactId || '').split('_');
    if (groups.length < 4) return '';
    return groups.slice(0, 4).join(':') + '::/64';
}

function isHmacId(id) {
    return /^[a-f0-9]{64}$/.test(String(id || ''));
}

function canonicalFromExactId(docId) {
    const id = String(docId || '');
    const v4 = id.match(/^(\d{1,3})_(\d{1,3})_(\d{1,3})_(\d{1,3})$/);
    if (v4) {
        const parts = [v4[1], v4[2], v4[3], v4[4]];
        const ok = parts.every(function(part) {
            const n = Number(part);
            return n <= 255 && String(n) === part;
        });
        return ok ? parts.join('.') : '';
    }
    const groups = id.split('_');
    if (groups.length === 8 && groups.every(function(group) { return /^[0-9a-f]{4}$/.test(group); })) {
        return groups.join(':');
    }
    return '';
}

function canonicalFromRangeId(docId) {
    const id = String(docId || '');
    const v4 = id.match(/^(\d{1,3})_(\d{1,3})_(\d{1,3})_0_24$/);
    if (v4) {
        const parts = [v4[1], v4[2], v4[3]];
        const ok = parts.every(function(part) {
            const n = Number(part);
            return n <= 255 && String(n) === part;
        });
        return ok ? parts.join('.') + '.0/24' : '';
    }
    const groups = id.split('_');
    if (groups.length === 5 && groups[4] === '64' && groups.slice(0, 4).every(function(group) { return /^[0-9a-f]{4}$/.test(group); })) {
        return groups.slice(0, 4).join(':') + '::/64';
    }
    return '';
}

function networkDocIds(ip, secret) {
    const ipCanon = canonicalIp(ip);
    const rangeCanon = canonicalRange(ip);
    if (!ipCanon || !rangeCanon) return null;
    try {
        const ipId = ipHmac.hmacIp(ipCanon, secret);
        const rangeId = ipHmac.hmacIp(rangeCanon, secret);
        if (!ipId || !rangeId || ipId === rangeId) return null;
        return { ipId: ipId, rangeId: rangeId };
    } catch (e) {
        return null;
    }
}

function planDocRekey(docId, kind, secret) {
    if (isHmacId(docId)) return { action: 'skip', reason: 'already-hmac' };
    const canonical = kind === 'range' ? canonicalFromRangeId(docId) : canonicalFromExactId(docId);
    if (!canonical) return { action: 'skip', reason: 'unparsed' };
    let to = '';
    try {
        to = ipHmac.hmacIp(canonical, secret);
    } catch (e) {
        return { action: 'skip', reason: 'secret' };
    }
    if (!isHmacId(to)) return { action: 'skip', reason: 'secret' };
    return { action: 'rekey', to: to };
}

function planSignalFields(data, secret) {
    const src = data || {};
    const changes = {};
    const drop = [];
    if (src.ipExact && !isHmacId(src.ipExact)) {
        const canon = canonicalFromExactId(src.ipExact) || canonicalIp(String(src.ipExact).replace(/_/g, '.'));
        if (canon) {
            try { changes.ipExact = ipHmac.hmacIp(canon, secret); } catch (e) { /* secret missing */ }
        }
    }
    if (src.subnet && !isHmacId(src.subnet)) {
        const canon = canonicalFromRangeId(src.subnet);
        if (canon) {
            try { changes.subnet = ipHmac.hmacIp(canon, secret); } catch (e) { /* secret missing */ }
        }
    }
    if (src.label != null && String(src.label) !== '') drop.push('label');
    if (src.ip != null && !isHmacId(src.ip)) drop.push('ip');
    return { changes: changes, drop: drop };
}

function mergeSlot(dest, source) {
    const left = dest && typeof dest === 'object' ? dest : {};
    const right = source && typeof source === 'object' ? source : {};
    const seen = {};
    function take(map) {
        if (!map || typeof map !== 'object' || Array.isArray(map)) return;
        Object.keys(map).forEach(function(uid) {
            const ms = Number(map[uid]) || 0;
            if (!uid || !ms) return;
            if (!seen[uid] || ms > seen[uid]) seen[uid] = ms;
        });
    }
    take(left.seen);
    take(right.seen);
    const leftMs = left.lastClaim && left.lastClaim.toMillis ? left.lastClaim.toMillis() : Number(left.lastClaimMs) || 0;
    const rightMs = right.lastClaim && right.lastClaim.toMillis ? right.lastClaim.toMillis() : Number(right.lastClaimMs) || 0;
    const newer = rightMs >= leftMs ? right : left;
    const out = {
        seen: seen,
        claimCount: Math.max(Number(left.claimCount) || 0, Number(right.claimCount) || 0),
        lastUid: String(newer.lastUid || left.lastUid || right.lastUid || ''),
    };
    if (newer.lastClaim) out.lastClaim = newer.lastClaim;
    return out;
}

function cleanRequestId(raw) {
    const id = String(raw || '').trim();
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) return '';
    return id;
}

function postbackAgeMs(body, now) {
    const src = body || {};
    const time = Number(src.time != null ? src.time : src.timestamp);
    if (time > 1e12) return now - time;
    if (time > 1e9) return now - (time * 1000);
    const rawDate = src.click_date || src.creation_date || src.request_timestamp || '';
    if (rawDate) {
        const parsed = Date.parse(String(rawDate).replace(' ', 'T') + (String(rawDate).indexOf('Z') === -1 && String(rawDate).indexOf('+') === -1 ? 'Z' : ''));
        if (Number.isFinite(parsed)) return now - parsed;
    }
    return null;
}

function ipsMatch(clientIp, reported) {
    if (reported == null || String(reported).trim() === '') return null;
    const left = canonicalIp(clientIp);
    const right = canonicalIp(reported);
    if (!left || !right) return null;
    return left === right;
}

function trustDevice(body, now, clientIp) {
    if (!body || typeof body !== 'object' || body.success === false) {
        return { ok: false, reason: failureReason(body, 0) };
    }
    const age = postbackAgeMs(body, now);
    if (age == null || age > FRESH_MS || age < -30000) return { ok: false, reason: 'stale' };
    const reported = body.ip_address || body.ip || '';
    const match = ipsMatch(clientIp, reported);
    if (match === false) return { ok: false, reason: 'ip-mismatch' };
    const deviceId = String(body.device_id || '').trim();
    if (!deviceId || deviceId.length > 256) return { ok: false, reason: 'no-device' };
    return { ok: true, deviceId: deviceId };
}

function decideDevice(link, uid, fraudChance) {
    const chance = Number(fraudChance);
    if (Number.isFinite(chance) && chance >= 90) {
        return { action: 'deny', reason: 'device-fraud', recordUid: true, recordHold: true, holdReason: 'device-fraud' };
    }
    const src = link || {};
    const uids = src.uids && typeof src.uids === 'object' && !Array.isArray(src.uids) ? src.uids : {};
    const approved = src.approved && typeof src.approved === 'object' && !Array.isArray(src.approved) ? src.approved : {};
    if (approved[uid]) return { action: 'allow', reason: 'household', recordUid: true, recordHold: false };
    let firstUid = '';
    let firstMs = Infinity;
    Object.keys(uids).forEach(function(id) {
        const ms = Number(uids[id]) || 0;
        if (!id || !ms) return;
        if (ms < firstMs) {
            firstMs = ms;
            firstUid = id;
        }
    });
    if (!firstUid || firstUid === uid) {
        return { action: 'allow', reason: 'first', recordUid: true, recordHold: false };
    }
    return { action: 'hold', reason: 'later-account', recordUid: true, recordHold: true, holdReason: 'later-account' };
}

function dailyCap(opts) {
    if (opts && Number.isFinite(Number(opts.cap))) return Math.max(0, Math.floor(Number(opts.cap)));
    const raw = process.env.IPQS_DAILY_CAP;
    const n = Number(raw);
    if (raw != null && raw !== '' && Number.isFinite(n) && n >= 0) return Math.floor(n);
    return DEFAULT_DAILY_CAP;
}

function defaultBindings() {
    const admin = require('firebase-admin');
    return {
        increment: function(n) { return admin.firestore.FieldValue.increment(n); },
        fromMillis: function(ms) { return admin.firestore.Timestamp.fromMillis(ms); },
    };
}

function dayKey(now) {
    return new Date(now).toISOString().slice(0, 10);
}

function usageRef(db, now) {
    return db.collection('ipqs_usage').doc(dayKey(now));
}

async function reserveLookup(db, now, cap, bindings) {
    if (!db) return false;
    const ref = usageRef(db, now);
    let allowed = false;
    await db.runTransaction(async function(t) {
        const snap = await t.get(ref);
        const lookups = snap.exists ? (Number(snap.data().lookups) || 0) : 0;
        if (lookups >= cap) {
            t.set(ref, {
                errors: bindings.increment(1),
                quotaSkips: bindings.increment(1),
                lastError: 'quota',
                day: dayKey(now),
                updatedAtMs: now,
                expireAt: bindings.fromMillis(now + USAGE_TTL_MS),
            }, { merge: true });
            allowed = false;
            return;
        }
        t.set(ref, {
            lookups: bindings.increment(1),
            day: dayKey(now),
            updatedAtMs: now,
            expireAt: bindings.fromMillis(now + USAGE_TTL_MS),
        }, { merge: true });
        allowed = true;
    });
    return allowed;
}

async function recordError(opts, reason) {
    if (!opts || !opts.db) return;
    const bindings = opts.bindings;
    const now = opts.now || Date.now();
    const code = String(reason || 'lookup').slice(0, 24);
    try {
        const ref = usageRef(opts.db, now);
        await opts.db.runTransaction(async function(t) {
            t.set(ref, {
                errors: bindings.increment(1),
                lastError: code,
                day: dayKey(now),
                updatedAtMs: now,
                expireAt: bindings.fromMillis(now + USAGE_TTL_MS),
            }, { merge: true });
        });
    } catch (e) {
        console.error('[ipqs] error counter failed');
    }
}

function logVerdict(docId, action, reason, score) {
    const prefix = String(docId || '').slice(0, 8);
    const shown = score == null ? '' : String(Math.floor(Number(score)));
    console.log('[ipqs] hmac=' + prefix + ' action=' + action + ' reason=' + reason + ' score=' + shown);
}

function fallback(reason) {
    return { action: 'fallback', reason: reason || 'lookup', verdict: null };
}

function defaultFetch(url, options) {
    if (typeof fetch !== 'function') return Promise.reject(Object.assign(new Error('http'), { code: 'http' }));
    return fetch(url, options);
}

function fetchTimeout(fetchImpl, url, ms) {
    const impl = fetchImpl || defaultFetch;
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    return new Promise(function(resolve, reject) {
        let settled = false;
        const timer = setTimeout(function() {
            if (settled) return;
            settled = true;
            if (ac) {
                try { ac.abort(); } catch (e) { /* already settled */ }
            }
            const err = new Error('timeout');
            err.code = 'timeout';
            reject(err);
        }, ms);
        Promise.resolve().then(function() {
            return impl(url, {
                method: 'GET',
                redirect: 'manual',
                signal: ac ? ac.signal : undefined,
            });
        }).then(function(res) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (res && res.status >= 300 && res.status < 400) {
                const err = new Error('http');
                err.code = 'http';
                reject(err);
                return;
            }
            resolve(res);
        }, function(err) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (err && (err.code === 'timeout' || err.name === 'AbortError')) {
                const timeoutErr = new Error('timeout');
                timeoutErr.code = 'timeout';
                reject(timeoutErr);
                return;
            }
            const http = new Error('http');
            http.code = 'http';
            reject(http);
        });
    });
}

function expireMillis(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

async function readCache(db, docId, now) {
    const snap = await db.collection('ip_reputation').doc(docId).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const exp = expireMillis(data.expireAt);
    if (exp && exp <= now) return null;
    if (data.action !== 'allow' && data.action !== 'hold' && data.action !== 'deny') return null;
    return data;
}

function verdictDoc(scored, now, bindings) {
    return {
        fraudScore: scored.fraudScore,
        proxy: !!scored.proxy,
        vpn: !!scored.vpn,
        tor: !!scored.tor,
        datacenter: !!scored.datacenter,
        recentAbuse: !!scored.recentAbuse,
        botnet: !!scored.botnet,
        countryCode: scored.countryCode || '',
        action: scored.action,
        reason: scored.reason,
        checkedAtMs: now,
        expireAt: bindings.fromMillis(now + cacheTtlMs(scored)),
    };
}

async function lookupIp(opts) {
    const now = opts.now;
    const canon = canonicalIp(opts.ip);
    if (!canon) return fallback('bad-ip');
    let docId = '';
    try {
        docId = ipHmac.hmacIp(canon, opts.secret);
    } catch (e) {
        await recordError(opts, 'secret');
        return fallback('secret');
    }
    if (!docId) {
        await recordError(opts, 'secret');
        return fallback('secret');
    }
    const cached = await readCache(opts.db, docId, now);
    if (cached) {
        logVerdict(docId, cached.action, 'cache', cached.fraudScore);
        return { action: cached.action, reason: cached.reason || 'cache', verdict: cached, cached: true };
    }
    const apiKey = String(opts.apiKey || process.env.IPQS_API_KEY || '');
    if (apiKey.length < 8) {
        await recordError(opts, 'secret');
        return fallback('secret');
    }
    const cap = dailyCap(opts);
    const reserved = await reserveLookup(opts.db, now, cap, opts.bindings);
    if (!reserved) {
        logVerdict(docId, 'fallback', 'quota', null);
        return fallback('quota');
    }
    const params = new URLSearchParams();
    params.set('strictness', '1');
    params.set('allow_public_access_points', 'true');
    if (opts.userAgent) params.set('user_agent', String(opts.userAgent).slice(0, 256));
    if (opts.language) params.set('user_language', String(opts.language).slice(0, 35));
    const url = IP_URL + encodeURIComponent(apiKey) + '/' + encodeURIComponent(canon) + '?' + params.toString();
    let body = null;
    let status = 0;
    try {
        const res = await fetchTimeout(opts.fetchImpl, url, opts.timeoutMs || TIMEOUT_MS);
        status = res && res.status ? res.status : 0;
        body = await res.json();
    } catch (e) {
        const reason = e && e.code === 'timeout' ? 'timeout' : 'http';
        await recordError(opts, reason);
        logVerdict(docId, 'fallback', reason, null);
        return fallback(reason);
    }
    const scored = scoreIpLookup(body);
    if (scored.action === 'fallback' || (body && body.success === false)) {
        const reason = failureReason(body, status);
        await recordError(opts, reason);
        logVerdict(docId, 'fallback', reason, null);
        return fallback(reason);
    }
    const doc = verdictDoc(scored, now, opts.bindings);
    await opts.db.collection('ip_reputation').doc(docId).set(doc);
    logVerdict(docId, scored.action, scored.reason, scored.fraudScore);
    return { action: scored.action, reason: scored.reason, verdict: doc, cached: false };
}

function holdState(snap, now) {
    if (!snap || !snap.exists) return null;
    const data = snap.data() || {};
    const exp = expireMillis(data.expireAt);
    if (exp && exp <= now) return null;
    return data;
}

async function commitDevice(opts, deviceHmac, uid, fraudChance) {
    const now = opts.now;
    const linkRef = opts.db.collection('device_links').doc(deviceHmac);
    const holdRef = opts.db.collection('device_holds').doc(uid);
    const userRef = opts.db.collection('user_devices').doc(uid);
    let decision = { action: 'fallback', reason: 'lookup' };
    await opts.db.runTransaction(async function(t) {
        const linkSnap = await t.get(linkRef);
        const holdSnap = await t.get(holdRef);
        const link = linkSnap.exists ? (linkSnap.data() || {}) : {};
        decision = decideDevice(link, uid, fraudChance);
        const uids = Object.assign({}, link.uids && typeof link.uids === 'object' ? link.uids : {});
        const approved = Object.assign({}, link.approved && typeof link.approved === 'object' ? link.approved : {});
        if (decision.recordUid && !uids[uid]) uids[uid] = now;
        const hold = holdSnap.exists ? (holdSnap.data() || {}) : {};
        t.set(linkRef, {
            uids: uids,
            approved: approved,
            fraudChance: Number.isFinite(Number(fraudChance)) ? Math.floor(Number(fraudChance)) : null,
            updatedAtMs: now,
            expireAt: opts.bindings.fromMillis(now + DEVICE_TTL_MS),
        });
        t.set(userRef, {
            deviceHmac: deviceHmac,
            updatedAtMs: now,
            expireAt: opts.bindings.fromMillis(now + DEVICE_TTL_MS),
        });
        if (decision.recordHold) {
            t.set(holdRef, {
                held: true,
                approved: false,
                reason: decision.holdReason,
                deviceHmac: deviceHmac,
                sinceMs: Number(hold.sinceMs) || now,
                expireAt: opts.bindings.fromMillis(now + DEVICE_TTL_MS),
            });
        }
    });
    return { action: decision.action, reason: decision.reason, deviceHmac: deviceHmac };
}

async function lookupDevice(opts) {
    const uid = String(opts.uid || '');
    if (!uid) return { action: 'fallback', reason: 'no-user', deviceHmac: '' };
    const now = opts.now;
    const holdSnap = await opts.db.collection('device_holds').doc(uid).get();
    const hold = holdState(holdSnap, now);
    const requestId = cleanRequestId(opts.requestId);
    if (hold && hold.approved === true && !requestId) {
        return { action: 'allow', reason: 'household', deviceHmac: String(hold.deviceHmac || '') };
    }
    if (hold && hold.held === true && hold.approved !== true) {
        const fraud = hold.reason === 'device-fraud';
        return {
            action: fraud ? 'deny' : 'hold',
            reason: 'existing-hold',
            deviceHmac: String(hold.deviceHmac || ''),
        };
    }
    if (!requestId) return { action: 'fallback', reason: 'no-request', deviceHmac: '' };
    const apiKey = String(opts.deviceKey || process.env.IPQS_DEVICE_POSTBACK_KEY || opts.apiKey || process.env.IPQS_API_KEY || '');
    if (apiKey.length < 8) {
        await recordError(opts, 'secret');
        return { action: 'fallback', reason: 'secret', deviceHmac: '' };
    }
    const reserved = await reserveLookup(opts.db, now, dailyCap(opts), opts.bindings);
    if (!reserved) return { action: 'fallback', reason: 'quota', deviceHmac: '' };
    const url = POSTBACK_URL + encodeURIComponent(apiKey) + '?request_id=' + encodeURIComponent(requestId);
    let body = null;
    let status = 0;
    try {
        const res = await fetchTimeout(opts.fetchImpl, url, opts.timeoutMs || TIMEOUT_MS);
        status = res && res.status ? res.status : 0;
        body = await res.json();
    } catch (e) {
        const reason = e && e.code === 'timeout' ? 'timeout' : 'http';
        await recordError(opts, reason);
        if (hold && hold.approved === true) {
            return { action: 'allow', reason: 'household', deviceHmac: String(hold.deviceHmac || '') };
        }
        return { action: 'fallback', reason: reason, deviceHmac: '' };
    }
    const trust = trustDevice(body, now, opts.ip);
    if (!trust.ok) {
        if (trust.reason === 'credits' || trust.reason === 'lookup' || trust.reason === 'http') {
            await recordError(opts, failureReason(body, status));
        }
        if (hold && hold.approved === true && trust.reason !== 'device-fraud') {
            return { action: 'allow', reason: 'household', deviceHmac: String(hold.deviceHmac || '') };
        }
        return { action: 'fallback', reason: trust.reason, deviceHmac: '' };
    }
    let deviceHmac = '';
    try {
        deviceHmac = ipHmac.hmacValue(trust.deviceId, opts.secret);
    } catch (e) {
        await recordError(opts, 'secret');
        return { action: 'fallback', reason: 'secret', deviceHmac: '' };
    }
    if (!deviceHmac) return { action: 'fallback', reason: 'secret', deviceHmac: '' };
    const chance = Number(body.fraud_chance);
    try {
        const saved = await commitDevice(opts, deviceHmac, uid, chance);
        logVerdict(deviceHmac, saved.action, saved.reason, chance);
        return saved;
    } catch (e) {
        await recordError(opts, 'lookup');
        console.error('[ipqs] device write failed');
        return { action: 'fallback', reason: 'lookup', deviceHmac: '' };
    }
}

function messageFor(action, source) {
    if (action === 'deny' && source === 'device') return DENY_DEVICE;
    if (action === 'hold' && source === 'device') return HOLD_DEVICE;
    if (action === 'deny') return DENY_CONNECTION;
    if (action === 'hold') return HOLD_CONNECTION;
    return '';
}

async function assessReward(opts) {
    const src = opts || {};
    const now = Number(src.now) || Date.now();
    const bindings = src.bindings || defaultBindings();
    const packed = {
        db: src.db,
        ip: src.ip || '',
        uid: src.uid || '',
        secret: src.secret,
        apiKey: src.apiKey,
        deviceKey: src.deviceKey,
        cap: src.cap,
        now: now,
        bindings: bindings,
        fetchImpl: src.fetchImpl,
        timeoutMs: src.timeoutMs || TIMEOUT_MS,
        userAgent: src.userAgent || '',
        language: src.language || '',
        requestId: src.requestId || '',
    };
    try {
        let ipResult = { action: 'fallback', reason: 'no-ip', verdict: null };
        if (packed.ip && packed.ip !== 'unknown' && packed.db) {
            ipResult = await lookupIp(packed);
        }
        if (ipResult.action === 'deny' || ipResult.action === 'hold') {
            return {
                action: ipResult.action,
                reason: ipResult.reason,
                message: messageFor(ipResult.action, 'ip'),
                ipVerdict: ipResult.verdict,
                deviceHmac: '',
                deviceAction: 'fallback',
            };
        }
        const device = packed.db
            ? await lookupDevice(packed)
            : { action: 'fallback', reason: 'no-user', deviceHmac: '' };
        if (device.action === 'deny' || device.action === 'hold') {
            return {
                action: device.action,
                reason: device.reason,
                message: messageFor(device.action, 'device'),
                ipVerdict: ipResult.verdict,
                deviceHmac: device.deviceHmac || '',
                deviceAction: device.action,
            };
        }
        const action = ipResult.action === 'allow' || device.action === 'allow' ? 'allow' : 'fallback';
        return {
            action: action,
            reason: device.reason || ipResult.reason,
            message: '',
            ipVerdict: ipResult.verdict,
            deviceHmac: device.deviceHmac || '',
            deviceAction: device.action,
        };
    } catch (e) {
        console.error('[ipqs] gate fallback');
        try { await recordError(packed, 'lookup'); } catch (err) { /* counter is best-effort */ }
        return {
            action: 'fallback',
            reason: 'lookup',
            message: '',
            ipVerdict: null,
            deviceHmac: '',
            deviceAction: 'fallback',
        };
    }
}

module.exports = {
    TIMEOUT_MS: TIMEOUT_MS,
    DEFAULT_DAILY_CAP: DEFAULT_DAILY_CAP,
    CACHE_TTL_MS: CACHE_TTL_MS,
    HIGH_TTL_MS: HIGH_TTL_MS,
    DEVICE_TTL_MS: DEVICE_TTL_MS,
    FRESH_MS: FRESH_MS,
    DENY_CONNECTION: DENY_CONNECTION,
    HOLD_CONNECTION: HOLD_CONNECTION,
    HOLD_DEVICE: HOLD_DEVICE,
    DENY_DEVICE: DENY_DEVICE,
    scoreIpLookup: scoreIpLookup,
    cacheTtlMs: cacheTtlMs,
    canonicalIp: canonicalIp,
    canonicalRange: canonicalRange,
    canonicalFromExactId: canonicalFromExactId,
    canonicalFromRangeId: canonicalFromRangeId,
    isHmacId: isHmacId,
    networkDocIds: networkDocIds,
    planDocRekey: planDocRekey,
    planSignalFields: planSignalFields,
    mergeSlot: mergeSlot,
    cleanRequestId: cleanRequestId,
    trustDevice: trustDevice,
    decideDevice: decideDevice,
    postbackAgeMs: postbackAgeMs,
    assessReward: assessReward,
    reserveLookup: reserveLookup,
    failureReason: failureReason,
};
