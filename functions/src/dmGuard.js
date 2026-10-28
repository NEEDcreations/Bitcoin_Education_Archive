'use strict';

// Server-side DM scan. Messages live in plaintext at
// dm_conversations/{cid}/messages/{mid} (senderUid, text, imageUrl).
// There is no end-to-end encryption. This module never sends email.
// An external monitor reads admin_dm_flags and admin_dm_alerts and sets alerted.
//
// No DM-sending callable exists today. Client creates are blocked by rules
// when users/{uid}.dmDisabled is true. Any future callable that writes a DM
// must call assertDmSendAllowed before the write. The Admin SDK bypasses rules.

const { isBip39Word } = require('./bip39-en');

const SCORE_THRESHOLD = 60;
const EXCERPT_MAX = 200;
const NEW_ACCOUNT_MS = 72 * 60 * 60 * 1000;
const MASS_WINDOW_MS = 15 * 60 * 1000;
const BLAST_WINDOW_MS = 60 * 60 * 1000;
const MASS_DM_COUNT = 5;
const BLAST_COUNT = 4;
const BLAST_MIN_CHARS = 12;
const SEED_EXTRA_TOKENS = 6;

// Same admin list as marketplace.js / forum.js / functions/src/satoshiFavor.js,
// plus the admin custom claim checked by Firestore rules.
const ADMIN_EMAILS = ['needcreations@gmail.com', 'info.603btc@gmail.com', 'najemchris8@gmail.com'];
const ADMIN_UIDS = ['Rv2KwSy4flQmYMiHobV1V03KJDX2', 'ZVlpC6mfs1W7GlKsY9TQN3Jr8Hd4'];

const SHORTENERS = [
    'bit.ly', 'tinyurl.com', 'tiny.cc', 'goo.gl', 'is.gd', 'buff.ly', 'ow.ly',
    'rebrand.ly', 'cutt.ly', 'shorturl.at', 'rb.gy', 't.ly', 'v.gd', 'clck.ru'
];

const SAFE_HOSTS = [
    'bitcoin.org', 'bitcoincore.org', 'github.com', 'mempool.space', 'wikipedia.org',
    'youtube.com', 'youtu.be', 'medium.com', 'stacker.news', 'learnmeabitcoin.com',
    'bitcoinops.org', 'lightning.engineering', 'bitcoin.it', 'giphy.com', 'tenor.com',
    'firebasestorage.googleapis.com', 'firebasestorage.app'
];

const BRANDS = [
    ['metamask', ['metamask.io']],
    ['ledger', ['ledger.com']],
    ['trezor', ['trezor.io']],
    ['phantom', ['phantom.app']],
    ['trustwallet', ['trustwallet.com']],
    ['walletconnect', ['walletconnect.com', 'walletconnect.org']],
    ['electrum', ['electrum.org']],
    ['sparrowwallet', ['sparrowwallet.com']]
];

const DRAINER_HOST = /(?:claim[-.]?airdrop|airdrop[-.]?claim|wallet[-.]?connect|seed[-.]?phrase|double[-.]?(?:your|btc)|free[-.]?btc|verify[-.]?wallet|wallet[-.]?verify|connect[-.]?wallet|wallet[-.]?drain)/i;

const SEED_REQ = /\b(?:send|give|share|reveal|drop|tell|provide)\s+(?:me\s+)?(?:your|ur|the)\s+(?:seed(?:\s+phrase)?|recovery\s+phrase|mnemonic(?:\s+phrase)?)\b|\b(?:paste|enter|type)\s+(?:me\s+)?(?:your|ur|the)\s+(?:seed(?:\s+phrase)?|recovery\s+phrase|mnemonic(?:\s+phrase)?)\b[\s\S]{0,30}\b(?:here|below|website|site|link|chat|box|form)\b/i;
const SEED_WHAT = /\bwhat(?:'s| is|s)\s+your\s+(?:seed(?:\s+phrase)?|recovery\s+phrase|mnemonic(?:\s+phrase)?)\b/i;
const WORDS_REQ = /\b(?:send|give|share|reveal|tell|provide)\s+(?:me\s+)?(?:your\s+)?(?:12|24|twelve|twenty[- ]four)[- ]words?\b|\b(?:paste|enter|type)\s+(?:your\s+)?(?:12|24|twelve|twenty[- ]four)[- ]words?\b[\s\S]{0,24}\b(?:here|below|website|site|link|chat|me)\b/i;
const PK_REQ = /\b(?:send|give|share|reveal|drop|tell|provide)\s+(?:me\s+)?(?:your|ur|the)\s+private\s+key\b|\b(?:paste|enter|type)\s+(?:me\s+)?(?:your|ur|the)\s+private\s+key\b[\s\S]{0,30}\b(?:here|below|website|site|link|chat|box|form)\b/i;
const PK_WHAT = /\bwhat(?:'s| is|s)\s+your\s+private\s+key\b/i;
const WIF_RE = /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g;

const DOUBLE_RE = /(?:send\s+(?:me\s+)?(?:\d[\d,.]*)?\s*(?:sats?|satoshis|btc|bitcoin)\b[\s\S]{0,48}(?:double|triple|twice|2x)|(?:i'll|i will|ill)\s+(?:double|triple|send\s+back)\b[\s\S]{0,40}(?:if\s+you\s+send|when\s+you\s+send|send\s+me)|send\s+me\s+(?:some\s+)?(?:sats?|btc|bitcoin)\b[\s\S]{0,40}(?:i'll|i will|ill)\s+double)/i;

const INVOICE_RE = /(?:pay|settle)\s+(?:this\s+)?invoice\b[\s\S]{0,60}\b(?:unlock|release|withdraw|verify|fee|gas)\b|\binvoice\b[\s\S]{0,30}\b(?:overdue|required)\b[\s\S]{0,30}\b(?:unlock|release|withdraw|verify)\b|pay\s+(?:a\s+)?(?:fee|gas)\s+to\s+(?:unlock|release|withdraw|receive)\b|(?:send|pay)\b[\s\S]{0,24}\b(?:btc|sats)\b[\s\S]{0,30}\b(?:unlock|release|withdraw your)\b/i;

const UID_RE = /^[A-Za-z0-9_-]{4,128}$/;

function fold(text) {
    return String(text || '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[0@$!]/g, function (c) {
            return { '0': 'o', '@': 'a', '$': 's', '!': 'i' }[c] || c;
        })
        .replace(/1/g, 'i')
        .replace(/3/g, 'e')
        .replace(/4/g, 'a')
        .replace(/5/g, 's')
        .replace(/7/g, 't');
}

function negated(text, index) {
    const from = Math.max(0, index - 24);
    return /\b(?:never|don't|do not|dont|won't|will not)\b/i.test(String(text || '').slice(from, index));
}

function firstIndex(re, text) {
    const flags = re.flags.indexOf('g') === -1 ? re.flags + 'g' : re.flags;
    const copy = new RegExp(re.source, flags);
    const hit = copy.exec(text);
    return hit ? hit.index : -1;
}

function hitUnlessNegated(re, text) {
    const index = firstIndex(re, text);
    if (index === -1) return false;
    return !negated(text, index);
}

function excerptOf(text) {
    const clean = String(text || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    return clean.length <= EXCERPT_MAX ? clean : clean.slice(0, EXCERPT_MAX);
}

function tokensOf(text) {
    return String(text || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

function seedPaste(text) {
    const tokens = tokensOf(text);
    if (tokens.length < 12) return false;
    const widths = tokens.length >= 24 ? [24, 12] : [12];
    for (let w = 0; w < widths.length; w++) {
        const width = widths[w];
        if (tokens.length < width) continue;
        if (tokens.length - width > SEED_EXTRA_TOKENS) continue;
        for (let i = 0; i <= tokens.length - width; i++) {
            let ok = true;
            for (let j = 0; j < width; j++) {
                if (!isBip39Word(tokens[i + j])) { ok = false; break; }
            }
            if (ok) return true;
        }
    }
    return false;
}

function privateKeyMaterial(text) {
    const raw = String(text || '');
    WIF_RE.lastIndex = 0;
    const hit = WIF_RE.exec(raw);
    if (!hit) return false;
    return raw.length <= hit[0].length + 80;
}

function hostAllowed(host, okList) {
    for (let i = 0; i < okList.length; i++) {
        const ok = okList[i];
        if (host === ok || host.endsWith('.' + ok)) return true;
    }
    return false;
}

function isSafeHost(host) {
    return hostAllowed(host, SAFE_HOSTS);
}

function isShortHost(host) {
    for (let i = 0; i < SHORTENERS.length; i++) {
        const s = SHORTENERS[i];
        if (host === s || host.endsWith('.' + s)) return true;
    }
    return false;
}

function brandImpersonation(host) {
    for (let i = 0; i < BRANDS.length; i++) {
        const name = BRANDS[i][0];
        const ok = BRANDS[i][1];
        if (host.indexOf(name) !== -1 && !hostAllowed(host, ok)) return true;
    }
    return false;
}

function extractUrls(text) {
    const raw = String(text || '');
    const found = [];
    const withScheme = raw.match(/\b(?:https?:\/\/|www\.)[^\s<>"']+/gi) || [];
    for (let i = 0; i < withScheme.length; i++) found.push(withScheme[i]);
    const bare = new RegExp('\\b((?:' + SHORTENERS.join('|').replace(/\./g, '\\.') + ')\\/[^\\s<>"\']+)', 'gi');
    const bareHits = raw.match(bare) || [];
    for (let j = 0; j < bareHits.length; j++) found.push('https://' + bareHits[j]);
    return found;
}

function hostOf(url) {
    try {
        const prefixed = /^https?:\/\//i.test(url) ? url : 'https://' + url;
        const host = new URL(prefixed).hostname.toLowerCase().replace(/\.$/, '');
        return host.indexOf('www.') === 0 ? host.slice(4) : host;
    } catch (e) {
        return '';
    }
}

function scoreLinks(text) {
    const reasons = [];
    let score = 0;
    const urls = extractUrls(text);
    let short = false;
    let drainer = false;
    let phish = false;
    for (let i = 0; i < urls.length; i++) {
        const host = hostOf(urls[i]);
        if (!host || isSafeHost(host)) continue;
        if (isShortHost(host)) short = true;
        else if (DRAINER_HOST.test(host)) drainer = true;
        else if (brandImpersonation(host)) phish = true;
    }
    if (drainer) {
        reasons.push('drainer_domain');
        score += 90;
    }
    if (phish) {
        reasons.push('phishing_link');
        score += 80;
    }
    if (short) {
        reasons.push('short_link');
        let add = 50;
        const pitched = /\b(?:verify your|click here|claim|airdrop|connect your|free\s+btc)\b/i.test(text);
        const leftover = String(text || '')
            .replace(/\b(?:https?:\/\/|www\.)\S+/gi, ' ')
            .replace(new RegExp('\\b(?:' + SHORTENERS.join('|').replace(/\./g, '\\.') + ')\\S*', 'gi'), ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (pitched || leftover.length < 24) add += 40;
        score += add;
    }
    return { score: score, reasons: reasons };
}

function staffClaim(text) {
    return /\b(?:i am|i'm|im|this is)\b[\s\S]{0,30}\b(?:an?\s+)?(?:site\s+|official\s+)?(?:admin|administrator|moderator|support agent|support team|customer support)\b/i.test(text)
        || /\b(?:bitcoin quest|bitcoineducation|btc quest)\s+(?:admin|support|staff|team)\b/i.test(text)
        || /\b(?:official|verified)\s+(?:admin|support)\b/i.test(text);
}

function scoreImpersonation(text) {
    const claim = staffClaim(text);
    const threat = /\byour account\b[\s\S]{0,40}\b(?:suspended|banned|locked|restricted|disabled)\b/i.test(text);
    const cta = /\b(?:verify your|click here|private key|seed phrase|password|unlock your|confirm your wallet)\b/i.test(text) || /https?:\/\//i.test(text);
    const softened = /\b(?:never|don't|do not|dont|won't|will not)\b/i.test(text)
        && !/\b(?:click here|verify your|send me|send your|https?:\/\/)\b/i.test(text);
    if (softened) return false;
    if (claim && (cta || threat)) return true;
    if (threat && cta) return true;
    return false;
}

function scoreDmText(text, imageUrl) {
    const original = String(text || '');
    const folded = fold(original);
    const reasons = [];
    let score = 0;
    const views = original === folded ? [original] : [original, folded];

    function add(reason, weight, ok) {
        if (!ok || reasons.indexOf(reason) !== -1) return;
        reasons.push(reason);
        score += weight;
    }

    const asks = /^(?:why|how|what)\b/i.test(original.trim());
    for (let i = 0; i < views.length; i++) {
        const view = views[i];
        add('seed_request', 80, hitUnlessNegated(SEED_REQ, view) || hitUnlessNegated(SEED_WHAT, view) || hitUnlessNegated(WORDS_REQ, view));
        add('private_key_request', 80, hitUnlessNegated(PK_REQ, view) || hitUnlessNegated(PK_WHAT, view));
        if (!asks) {
            add('double_scam', 80, hitUnlessNegated(DOUBLE_RE, view));
            add('invoice_scam', 80, hitUnlessNegated(INVOICE_RE, view));
        }
        add('admin_impersonation', 80, scoreImpersonation(view));
    }
    add('seed_paste', 80, seedPaste(original));
    add('private_key_material', 80, privateKeyMaterial(original));

    const linkText = original + (imageUrl ? (' ' + String(imageUrl)) : '');
    const links = scoreLinks(linkText);
    for (let r = 0; r < links.reasons.length; r++) {
        add(links.reasons[r], 0, true);
    }
    score += links.score;

    return {
        score: score,
        reasons: reasons,
        over: score >= SCORE_THRESHOLD
    };
}

function rateSignals(convoDocs, senderUid, nowMs, accountCreatedMs) {
    const reasons = [];
    let score = 0;
    let mass = 0;
    const identicalCounts = Object.create(null);
    const docs = convoDocs || [];
    for (let i = 0; i < docs.length; i++) {
        const data = docs[i] || {};
        if (data.lastSenderUid !== senderUid) continue;
        const at = timeMs(data.lastMessageTime);
        if (!at) continue;
        const parts = Array.isArray(data.participants) ? data.participants : [];
        if (parts.indexOf(senderUid) === -1) continue;
        const text = String(data.lastMessage || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (nowMs - at <= MASS_WINDOW_MS) mass += 1;
        if (text.length >= BLAST_MIN_CHARS && nowMs - at <= BLAST_WINDOW_MS) {
            identicalCounts[text] = (identicalCounts[text] || 0) + 1;
        }
    }
    const isNew = accountCreatedMs > 0 && nowMs - accountCreatedMs >= 0 && nowMs - accountCreatedMs < NEW_ACCOUNT_MS;
    if (isNew && mass >= MASS_DM_COUNT) {
        reasons.push('mass_dm_new_account');
        score += 80;
    }
    const keys = Object.keys(identicalCounts);
    for (let k = 0; k < keys.length; k++) {
        if (identicalCounts[keys[k]] >= BLAST_COUNT) {
            reasons.push('identical_blast');
            score += 80;
            break;
        }
    }
    return { score: score, reasons: reasons };
}

function timeMs(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number' && isFinite(value)) return value;
    return 0;
}

function assertDmSendAllowed(userData) {
    if (userData && userData.dmDisabled === true) {
        const err = new Error('dm-disabled');
        err.code = 'permission-denied';
        throw err;
    }
}

function callerIsAdmin(caller) {
    if (!caller || !caller.uid) return false;
    if (caller.token && caller.token.admin === true) return true;
    if (ADMIN_UIDS.indexOf(caller.uid) !== -1) return true;
    const email = String((caller.token && (caller.token.email || caller.token.email_address)) || '').toLowerCase();
    return !!email && ADMIN_EMAILS.indexOf(email) !== -1;
}

function userRecordIsAdmin(uid, userData, authUser) {
    if (uid && ADMIN_UIDS.indexOf(uid) !== -1) return true;
    if (userData && (userData.isAdmin === true || userData.admin === true || userData.role === 'admin')) return true;
    const docEmail = userData && userData.email ? String(userData.email).toLowerCase() : '';
    if (docEmail && ADMIN_EMAILS.indexOf(docEmail) !== -1) return true;
    const authEmail = authUser && authUser.email ? String(authUser.email).toLowerCase() : '';
    if (authEmail && ADMIN_EMAILS.indexOf(authEmail) !== -1) return true;
    const claims = authUser && authUser.customClaims;
    return !!(claims && claims.admin === true);
}

async function readUser(db, uid) {
    if (!uid) return null;
    try {
        const snap = await db.collection('users').doc(uid).get();
        return snap && snap.exists ? (snap.data() || {}) : null;
    } catch (e) {
        return null;
    }
}

async function readAuthUser(auth, uid) {
    if (!auth || typeof auth.getUser !== 'function' || !uid) return null;
    try {
        return await auth.getUser(uid);
    } catch (e) {
        return null;
    }
}

async function writeOnce(db, col, id, data) {
    const ref = db.collection(col).doc(id);
    const cur = await ref.get();
    if (cur && cur.exists) return false;
    await ref.set(data);
    return true;
}

function stamp(admin) {
    return admin.firestore.FieldValue.serverTimestamp();
}

async function handleDmMessageCreated(deps, event) {
    const db = deps && deps.db;
    const admin = deps && deps.admin;
    const auth = deps && deps.auth;
    const snap = event && event.data;
    if (!db || !admin || !snap || typeof snap.data !== 'function') return null;
    const msg = snap.data() || {};
    const params = event.params || {};
    const convoId = String(params.cid || '');
    const messageId = String(params.mid || '');
    const senderUid = String(msg.senderUid || '');
    if (!UID_RE.test(senderUid) || !convoId || !messageId) return null;

    let recipientUid = '';
    try {
        const convo = await db.collection('dm_conversations').doc(convoId).get();
        const participants = convo && convo.exists && convo.data() ? (convo.data().participants || []) : [];
        recipientUid = participants.filter(function (id) { return id && id !== senderUid; })[0] || '';
    } catch (e) {
        recipientUid = '';
    }

    const text = typeof msg.text === 'string' ? msg.text : '';
    const imageUrl = typeof msg.imageUrl === 'string' ? msg.imageUrl : '';
    const excerpt = excerptOf(text) || (imageUrl ? '[image]' : '');
    const docId = (convoId + '_' + messageId).replace(/\//g, '_').slice(0, 700);
    const createdAt = stamp(admin);

    const senderAuth = await readAuthUser(auth, senderUid);
    const senderData = await readUser(db, senderUid);
    const recipientAuth = recipientUid ? await readAuthUser(auth, recipientUid) : null;
    const recipientData = recipientUid ? await readUser(db, recipientUid) : null;
    const senderAdmin = userRecordIsAdmin(senderUid, senderData, senderAuth);
    const recipientAdmin = recipientUid ? userRecordIsAdmin(recipientUid, recipientData, recipientAuth) : false;

    if (senderAdmin || recipientAdmin) {
        const side = senderAdmin && recipientAdmin ? 'both' : (senderAdmin ? 'sender' : 'recipient');
        await writeOnce(db, 'admin_dm_alerts', docId, {
            senderUid: senderUid,
            recipientUid: recipientUid,
            convoId: convoId,
            messageId: messageId,
            excerpt: excerpt,
            adminSide: side,
            alerted: false,
            createdAt: createdAt
        });
    }

    if (msg.isNachoAuto === true) return { alertedAdmin: senderAdmin || recipientAdmin, flagged: false };

    const textScore = scoreDmText(text, imageUrl);
    let rate = { score: 0, reasons: [] };
    try {
        const recent = await db.collection('dm_conversations')
            .where('participants', 'array-contains', senderUid)
            .orderBy('lastMessageTime', 'desc')
            .limit(12)
            .get();
        const docs = [];
        recent.forEach(function (doc) { docs.push(doc.data() || {}); });
        const created = senderAuth && senderAuth.metadata ? Date.parse(senderAuth.metadata.creationTime || '') : NaN;
        rate = rateSignals(docs, senderUid, Date.now(), Number.isFinite(created) ? created : 0);
    } catch (e) {
        rate = { score: 0, reasons: [] };
    }

    const reasons = textScore.reasons.concat(rate.reasons.filter(function (r) {
        return textScore.reasons.indexOf(r) === -1;
    }));
    const score = textScore.score + rate.score;
    if (score < SCORE_THRESHOLD) {
        return { alertedAdmin: senderAdmin || recipientAdmin, flagged: false, score: score, reasons: reasons };
    }

    await db.collection('users').doc(senderUid).set({
        dmDisabled: true,
        dmDisabledReason: reasons.join(',').slice(0, 180),
        dmDisabledAt: createdAt
    }, { merge: true });
    await writeOnce(db, 'admin_dm_flags', docId, {
        senderUid: senderUid,
        recipientUid: recipientUid,
        convoId: convoId,
        messageId: messageId,
        excerpt: excerpt,
        reasons: reasons,
        score: score,
        alerted: false,
        createdAt: createdAt
    });
    return { alertedAdmin: senderAdmin || recipientAdmin, flagged: true, score: score, reasons: reasons };
}

async function reenableDms(deps, caller, targetUid) {
    if (!callerIsAdmin(caller)) {
        const err = new Error('admin-only');
        err.code = 'permission-denied';
        throw err;
    }
    const uid = String(targetUid || '');
    if (!UID_RE.test(uid)) {
        const err = new Error('invalid-user');
        err.code = 'invalid-argument';
        throw err;
    }
    const db = deps.db;
    const admin = deps.admin;
    await db.collection('users').doc(uid).set({
        dmDisabled: false,
        dmDisabledReason: admin.firestore.FieldValue.delete(),
        dmDisabledAt: admin.firestore.FieldValue.delete(),
        dmReenabledAt: admin.firestore.FieldValue.serverTimestamp(),
        dmReenabledBy: caller.uid
    }, { merge: true });
    return { ok: true };
}

function bindAdminReenableDms(functionsV1, db, admin) {
    return functionsV1.https.onCall(async function (data, context) {
        try {
            const uid = data && data.uid;
            return await reenableDms({ db: db, admin: admin }, context && context.auth, uid);
        } catch (err) {
            const code = err && err.code === 'invalid-argument' ? 'invalid-argument' : 'permission-denied';
            throw new functionsV1.https.HttpsError(code, code === 'invalid-argument' ? 'Invalid user' : 'Admin only');
        }
    });
}

module.exports = {
    SCORE_THRESHOLD: SCORE_THRESHOLD,
    EXCERPT_MAX: EXCERPT_MAX,
    NEW_ACCOUNT_MS: NEW_ACCOUNT_MS,
    MASS_WINDOW_MS: MASS_WINDOW_MS,
    BLAST_WINDOW_MS: BLAST_WINDOW_MS,
    MASS_DM_COUNT: MASS_DM_COUNT,
    BLAST_COUNT: BLAST_COUNT,
    ADMIN_EMAILS: ADMIN_EMAILS,
    ADMIN_UIDS: ADMIN_UIDS,
    scoreDmText: scoreDmText,
    rateSignals: rateSignals,
    excerptOf: excerptOf,
    assertDmSendAllowed: assertDmSendAllowed,
    callerIsAdmin: callerIsAdmin,
    handleDmMessageCreated: handleDmMessageCreated,
    reenableDms: reenableDms,
    bindAdminReenableDms: bindAdminReenableDms
};
