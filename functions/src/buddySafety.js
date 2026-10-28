'use strict';

const crypto = require('crypto');

// Buddy conversation checks. High-confidence requests lock the sender.
// A link on an unknown site, or a nudge toward Telegram, WhatsApp, or
// Signal, only files a report and a short note. Players never see this
// module's names.

const HIGH_REASONS = ['seed_request', 'address_send', 'admin_funds'];
const MEDIUM_REASONS = ['send_value', 'giveaway_invest', 'unknown_link', 'off_platform'];
const ADMIN_ACTIONS = ['unlock', 'keep_locked', 'ban', 'unlock_and_dismiss'];
const KNOWN_HOSTS = {
    'bitcoineducation.quest': true,
    'www.bitcoineducation.quest': true,
    'bitcoin.org': true,
    'www.bitcoin.org': true,
    'github.com': true,
    'www.github.com': true,
    'wikipedia.org': true,
    'en.wikipedia.org': true,
    'mempool.space': true,
    'lightning.engineering': true,
};

const WARNING_HIGH = 'Safety heads-up: never send bitcoin, sats, seed words or keys to anyone you meet here. This chat is paused while we review it.';
const WARNING_LOW = 'Safety heads-up: never send bitcoin, sats, seed words or keys to anyone you meet here.';

const CONFUSABLES = {
    '\u0455': 's', '\u0405': 's',
    '\u0435': 'e', '\u0415': 'e',
    '\u0430': 'a', '\u0410': 'a',
    '\u043e': 'o', '\u041e': 'o',
    '\u0440': 'p', '\u0420': 'p',
    '\u0441': 'c', '\u0421': 'c',
    '\u0456': 'i', '\u0406': 'i',
    '\u0443': 'y', '\u0423': 'y',
    '\u0445': 'x', '\u0425': 'x',
    '\u0458': 'j', '\u0408': 'j',
};

function mapConfusables(text) {
    let out = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const code = ch.charCodeAt(0);
        if (code >= 0xFF01 && code <= 0xFF5E) {
            out += String.fromCharCode(code - 0xFEE0);
            continue;
        }
        out += CONFUSABLES[ch] || ch;
    }
    return out;
}

function collapseSpacedLetters(text) {
    return text.replace(/\b(?:[a-z][.\s]+){2,}[a-z]\b/g, function (run) {
        return run.replace(/[.\s]+/g, '');
    });
}

function normalizeRiskText(text) {
    let s = String(text || '');
    if (typeof s.normalize === 'function') s = s.normalize('NFKC');
    s = s.replace(/[\u00AD\u200B-\u200F\u2060\uFEFF]/g, '');
    s = mapConfusables(s).toLowerCase();
    s = s.replace(/_/g, ' ');
    s = s.replace(/\bwhats\b/g, "what's");
    s = s.replace(/\bur\b/g, 'your');
    s = s.replace(/\bu\b/g, 'you');
    s = s.replace(/\bwrds\b/g, 'words');
    s = s.replace(/\bseed[\s-]*phrase\b/g, 'seed phrase');
    s = s.replace(/\bprivat(?:e)?\s*key\b/g, 'private key');
    s = s.replace(/\bprivte key\b/g, 'private key');
    s = s.replace(/\bprivatekey\b/g, 'private key');
    s = s.replace(/\bpharse\b/g, 'phrase');
    s = s.replace(/\brecovry\b/g, 'recovery');
    s = s.replace(/\btwelve\b/g, '12');
    s = s.replace(/\btwenty[\s-]*four\b/g, '24');
    s = collapseSpacedLetters(s);
    s = s.replace(/\bsendme\b/g, 'send me');
    s = s.replace(/\bgiveme\b/g, 'give me');
    s = s.replace(/\btellme\b/g, 'tell me');
    s = s.replace(/\bdmme\b/g, 'dm me');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
}

function splitQuotes(text) {
    const quoted = [];
    const unquoted = text.replace(/(^|[\s])["“]([^"”]+)["”]|(^|[\s])'([^']+)'/g, function (_m, _a, dbl, _c, sgl) {
        quoted.push(dbl || sgl || '');
        return ' ';
    });
    return { unquoted: unquoted, quoted: quoted };
}

function clausesOf(text) {
    return String(text || '').split(/[,.!?;]+/).map(function (part) { return part.trim(); }).filter(Boolean);
}

function clauseNegated(clause) {
    return /\b(?:don't|dont|never|do not)\s+(?:send|give|share|tell|paste|pay|need|dm|type|ask)\b/.test(clause);
}

function isDeviceOrStorage(clause) {
    if (/\b(?:send|give|dm)\s+me\b/.test(clause)) return false;
    return /\b(?:on the device|into the coldcard|into the trezor|into the ledger|coldcard|trezor|hardware wallet|own wallet|storage method|backup plan|backup)\b/.test(clause);
}

function secretPattern() {
    return '(?:seed phrase|seed words|recovery phrase|recovery words|private key|mnemonic|12 words|24 words|seed)';
}

function addressPattern() {
    return /\b(?:bc1[ac-hj-np-z02-9]{11,}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|lnbc[0-9a-z]{20,})\b/i;
}

function lockHit(clause) {
    if (!clause || clauseNegated(clause) || isDeviceOrStorage(clause)) return '';
    const secret = secretPattern();
    const ask = new RegExp(
        '\\b(?:send|give|share|tell|paste|pay|need|dm)\\b(?:\\s+me)?(?:\\s+(?:your|the|you))?\\s+' + secret + '\\b'
        + '|\\btype here\\b(?:\\s+your)?\\s+' + secret + '\\b'
        + '|\\btyping\\s+your\\s+' + secret + '\\b'
        + '|\\bwhat(?:\'s| is| are) your\\s+' + secret + '\\b'
        + '|\\b' + secret + '\\s+with me\\b',
        'i'
    );
    if (ask.test(clause)) return 'seed_request';
    if (/\b(?:pay|send|zap)\b/.test(clause) && addressPattern().test(clause)) return 'address_send';
    const impersonates = /\b(?:i am|i'm|this is) (?:an |a |the )?(?:admin|support)\b|\bfrom support\b|\bbitcoin quest support\b/.test(clause);
    const asksFor = ask.test(clause) || (/\b(?:send|pay|give)\s+me\b/.test(clause) && /\b(?:sats|btc|bitcoin|funds)\b/.test(clause));
    if (impersonates && asksFor && !clauseNegated(clause)) return 'admin_funds';
    return '';
}

function protectiveFrame(text) {
    return /\b(?:never|don't ever|do not ever|if someone asks|block them|ignore anyone)\b/.test(text);
}

function hostOf(url) {
    const match = String(url || '').match(/^https?:\/\/([^/?#]+)/i);
    if (!match) return '';
    return match[1].toLowerCase().replace(/:\d+$/, '').replace(/^www\./, function (prefix) {
        return prefix;
    });
}

function knownHost(url) {
    const host = hostOf(url).replace(/^www\./, '');
    if (!host) return false;
    if (KNOWN_HOSTS[host] || KNOWN_HOSTS['www.' + host]) return true;
    return false;
}

function pushReason(list, reason) {
    if (list.indexOf(reason) === -1) list.push(reason);
}

function addMedium(text, reasons) {
    clausesOf(text).forEach(function (clause) {
        if (isDeviceOrStorage(clause)) return;
        if (clauseNegated(clause)) return;
        if (/\b(?:send|transfer)\b/.test(clause) && /\b(?:sats|satoshis|btc|bitcoin)\b/.test(clause) && !addressPattern().test(clause)) {
            pushReason(reasons, 'send_value');
        }
    });
    if (/\b(?:double your (?:btc|bitcoin|sats)|guaranteed (?:profit|returns?)|investment opportunity)\b/.test(text)
        || (/\bgiveaway\b/.test(text) && /\b(?:send|claim)\b/.test(text) && /\b(?:btc|bitcoin|sats)\b/.test(text))) {
        pushReason(reasons, 'giveaway_invest');
    }
    if (addressPattern().test(text)) pushReason(reasons, 'bare_address');
    const urls = String(text || '').match(/https?:\/\/[^\s)]+/gi) || [];
    for (let i = 0; i < urls.length; i++) {
        if (!knownHost(urls[i])) pushReason(reasons, 'unknown_link');
    }
    if (/\b(?:telegram|whatsapp|signal)\b/.test(text) && /\b(?:move|continue|message me|chat on|add me|talk on|switch to)\b/.test(text)) {
        pushReason(reasons, 'off_platform');
    }
}

function detectBuddyRisk(text) {
    const normalized = normalizeRiskText(text);
    const parts = splitQuotes(normalized);
    const lockReasons = [];
    clausesOf(parts.unquoted).forEach(function (clause) {
        const hit = lockHit(clause);
        if (hit) pushReason(lockReasons, hit);
    });
    const mediumReasons = [];
    addMedium(normalized, mediumReasons);
    parts.quoted.forEach(function (quoted) {
        clausesOf(quoted).forEach(function (clause) {
            if (lockHit(clause)) pushReason(mediumReasons, 'quoted_request');
        });
    });
    if (lockReasons.length && !protectiveFrame(normalized)) {
        return { severity: 'high', reasons: lockReasons.concat(mediumReasons.filter(function (reason) {
            return lockReasons.indexOf(reason) === -1;
        })), lock: true };
    }
    if (lockReasons.length && protectiveFrame(normalized)) {
        lockReasons.forEach(function (reason) { pushReason(mediumReasons, reason); });
    }
    if (protectiveFrame(normalized) && new RegExp(secretPattern(), 'i').test(normalized)) {
        const onlySafe = clausesOf(parts.unquoted).every(function (clause) { return isDeviceOrStorage(clause); });
        if (!onlySafe) pushReason(mediumReasons, 'protective');
    }
    if (mediumReasons.length) return { severity: 'medium', reasons: mediumReasons, lock: false };
    return { severity: 'none', reasons: [], lock: false };
}

function snippetOf(text) {
    const raw = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
    return raw.length > 200 ? raw.slice(0, 200) : raw;
}

function shortUid(uid) {
    const s = String(uid || '');
    return s.length <= 6 ? s : s.slice(0, 6);
}

function hourBucket(now) {
    return Math.floor((Number(now) || 0) / 3600000);
}

function flagDocId(convoId, reason, now) {
    const id = String(convoId || '').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 180);
    return 'buddydm_' + id + '_' + reason + '_' + hourBucket(now);
}

function warningCopy(severity) {
    return severity === 'high' ? WARNING_HIGH : WARNING_LOW;
}

function warningDocId() {
    return 'safety-review';
}

// Same collection and base fields as the report button in messaging.js,
// plus the fields the email routine needs in order to show admin options.
function buildBuddyReport(input) {
    const src = input || {};
    const reasons = Array.isArray(src.reasons) ? src.reasons.slice() : [];
    const severity = src.severity === 'high' ? 'high' : 'medium';
    const reportedShort = shortUid(src.reportedUid);
    const otherShort = shortUid(src.otherUid);
    return {
        reportedUid: reportedShort,
        reportedName: String(src.reportedName || '').slice(0, 80),
        reporterUid: 'system',
        reporterName: 'Bitcoin Quest',
        reason: reasons.join(', ').slice(0, 180) || severity,
        createdAt: src.createdAt || null,
        status: 'pending',
        type: severity === 'high' ? 'buddy_dm_lock' : 'buddy_dm_flag',
        severity: severity,
        reasons: reasons,
        reportedUidShort: reportedShort,
        otherUidShort: otherShort,
        snippet: snippetOf(src.snippet),
        lockApplied: severity === 'high',
        actions: ADMIN_ACTIONS.slice(),
    };
}

function randomDocId(prefix) {
    return prefix + crypto.randomBytes(9).toString('hex');
}

function publicLock(at) {
    return { state: 'locked', at: at || 0, source: 'buddy_dm' };
}

function accountLocked(user) {
    const lock = user && user.lock;
    return !!(lock && lock.state === 'locked');
}

function alreadyLockedFor(user) {
    return accountLocked(user);
}

function flagCountsForLock(row, convoId, reported, unlockedAt) {
    if (!row || row.source !== 'server' || row.severity !== 'high') return false;
    if (row.convoId !== convoId || row.reportedUid !== reported) return false;
    if (row.status === 'resolved' || row.status === 'dismissed') return false;
    if (Array.isArray(row.reasons) && row.reasons.length === 1 && row.reasons[0] === 'user_report') return false;
    const at = Number(row.createdAtMs) || 0;
    if (unlockedAt && (!at || at <= Number(unlockedAt))) return false;
    return true;
}

function planAdminResolve(action) {
    if (ADMIN_ACTIONS.indexOf(action) === -1) return { error: 'action' };
    if (action === 'unlock') {
        return { clearLock: true, resumeChat: true, ban: false, reportStatus: 'unlocked' };
    }
    if (action === 'keep_locked') {
        return { clearLock: false, resumeChat: false, ban: false, reportStatus: 'kept' };
    }
    if (action === 'ban') {
        return { clearLock: false, resumeChat: false, ban: true, reportStatus: 'banned' };
    }
    return { clearLock: true, resumeChat: true, ban: false, reportStatus: 'dismissed' };
}

function planUserReportLock(report, flags, convo) {
    if (!isBuddyUserReport(report)) return { lock: false };
    const reporter = String((report && report.reporterUid) || '');
    const reported = String((report && report.reportedUid) || '');
    if (!reporter || !reported || reporter === reported) return { lock: false };
    const participants = convo && Array.isArray(convo.participants) ? convo.participants : [];
    if (participants.indexOf(reporter) === -1 || participants.indexOf(reported) === -1) return { lock: false };
    const convoId = convo && convo.id ? String(convo.id) : '';
    const unlockedAt = convo && convo.unlockedAt;
    const high = (flags || []).some(function (row) {
        return flagCountsForLock(row, convoId, reported, unlockedAt);
    });
    if (!high) return { lock: false };
    return { lock: true, convoId: convoId, sender: reported };
}

function isBuddyUserReport(data) {
    const row = data || {};
    if (row.type === 'buddy_dm_lock' || row.type === 'buddy_dm_flag') return false;
    return row.type === 'buddy' || row.reason === 'buddy';
}

const UID_RE = /^[A-Za-z0-9_:-]{1,128}$/;

function senderGoalOf(match, sender) {
    const data = match || {};
    if (data.user1 && data.user1.uid === sender) return data.user1.goal || '';
    if (data.user2 && data.user2.uid === sender) return data.user2.goal || '';
    return '';
}

function otherOf(match, sender) {
    const data = match || {};
    const ids = [data.user1 && data.user1.uid, data.user2 && data.user2.uid].filter(Boolean);
    return ids.filter(function (id) { return id !== sender; })[0] || '';
}

function createSafetyHandlers(deps) {
    const admin = deps.admin;
    const db = deps.db;
    const HttpsError = deps.HttpsError;

    async function stageReview(tx, spec) {
        const sender = spec.sender;
        const convoId = spec.convoId;
        const userRef = db.collection('users').doc(sender);
        const convoRef = db.collection('dm_conversations').doc(convoId);
        const userSnap = await tx.get(userRef);
        const warnRef = convoRef.collection('messages').doc('safety-review');
        const warnSnap = await tx.get(warnRef);
        const user = userSnap.exists ? (userSnap.data() || {}) : {};
        const lockMetaRef = db.collection('buddy_locks').doc(sender);
        const lockMetaSnap = await tx.get(lockMetaRef);
        const existingFlags = await tx.get(db.collection('buddy_flags').where('convoId', '==', convoId).limit(40));
        const existing = [];
        existingFlags.forEach(function (doc) { existing.push(doc.data() || {}); });
        const flags = [];
        const reasons = spec.reasons || [];
        const hourAgo = (spec.now || 0) - 3600000;
        for (let i = 0; i < reasons.length; i++) {
            const reason = reasons[i];
            const recent = existing.some(function (row) {
                return row && Array.isArray(row.reasons) && row.reasons.indexOf(reason) !== -1
                    && Number(row.createdAtMs) >= hourAgo
                    && row.status !== 'resolved' && row.status !== 'dismissed';
            });
            if (recent) continue;
            const id = randomDocId('bf');
            flags.push({
                reason: reason,
                id: id,
                ref: db.collection('reports').doc(id),
                flagRef: db.collection('buddy_flags').doc(id),
            });
        }
        const high = spec.severity === 'high';
        const ts = admin.firestore.FieldValue.serverTimestamp();
        const reportIds = flags.map(function (item) { return item.id; });
        if (spec.clientReportId && reportIds.indexOf(spec.clientReportId) === -1) reportIds.push(spec.clientReportId);
        if (high && userSnap.exists && !alreadyLockedFor(user)) {
            tx.set(userRef, { lock: publicLock(spec.now) }, { merge: true });
            tx.set(lockMetaRef, {
                state: 'locked',
                reason: reasons.join(', ').slice(0, 180),
                at: spec.now,
                convId: convoId,
                reportIds: reportIds,
                clientReportId: spec.clientReportId || '',
                unlockedAt: lockMetaSnap.exists ? (lockMetaSnap.data() || {}).unlockedAt || 0 : 0,
            }, { merge: true });
            tx.set(convoRef, { reviewPaused: true }, { merge: true });
        }
        const warnText = warningCopy(spec.severity);
        if (!warnSnap.exists) {
            tx.set(warnRef, {
                senderUid: 'nacho-bot',
                senderName: 'Nacho',
                text: warnText,
                createdAt: ts,
                isNachoAuto: true,
                safetyNotice: true,
            });
            if (spec.other) {
                tx.set(db.collection('notifications').doc(randomDocId('bn')), {
                    recipientId: spec.other,
                    senderId: 'system',
                    senderName: 'Bitcoin Quest',
                    type: 'buddy',
                    message: warnText.slice(0, 180),
                    targetType: 'buddy',
                    targetId: null,
                    read: false,
                    createdAt: ts,
                });
            }
        } else if (high && (warnSnap.data() || {}).text !== WARNING_HIGH) {
            tx.set(warnRef, { text: WARNING_HIGH }, { merge: true });
        }
        flags.forEach(function (item) {
            tx.set(item.flagRef, {
                reportedUid: sender,
                otherUid: spec.other || '',
                convoId: convoId,
                severity: spec.severity,
                reasons: [item.reason],
                snippet: snippetOf(spec.snippet),
                source: 'server',
                reportId: item.id,
                status: 'open',
                createdAtMs: spec.now || 0,
                createdAt: ts,
            });
            const report = buildBuddyReport({
                reportedUid: sender,
                reportedName: spec.reportedName || '',
                reasons: [item.reason],
                severity: spec.severity,
                otherUid: spec.other,
                snippet: spec.snippet,
            });
            report.createdAt = ts;
            tx.set(item.ref, report);
        });
        return { locked: high && userSnap.exists && !alreadyLockedFor(user, convoId), warned: !warnSnap.exists };
    }

    async function onBuddyDmSafety(event) {
        const snap = event && event.data;
        if (!snap) return null;
        const message = snap.data() || {};
        const messageId = event.params && event.params.mid;
        const convoId = event.params && event.params.cid;
        const sender = String(message.senderUid || '');
        if (!convoId || !sender) return null;
        const text = typeof message.text === 'string' ? message.text : '';
        const convoRef = db.collection('dm_conversations').doc(convoId);
        let convo = null;
        try {
            const convoSnap = await convoRef.get();
            if (!convoSnap.exists) return null;
            convo = convoSnap.data() || {};
        } catch (err) {
            console.warn('[onBuddyDmSafety] read', err && err.message ? err.message : err);
            return null;
        }
        const preview = message.safetyNotice === true
            ? warningCopy('high').slice(0, 100)
            : (text || (message.imageUrl ? 'Image' : ''));
        if (preview) {
            try {
                await convoRef.set({
                    lastMessage: preview.slice(0, 100),
                    lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
                    lastSenderUid: sender,
                }, { merge: true });
            } catch (err) {
                console.warn('[onBuddyDmSafety] preview', err && err.message ? err.message : err);
            }
        }
        if (sender === 'nacho-bot' || sender === 'system' || message.isNachoAuto === true || message.safetyNotice === true) return null;
        if (!text.trim()) return null;
        if (convo.isBuddyMatch !== true) return null;
        let match = {};
        try {
            const matchSnap = await db.collection('buddy_matches').doc(convoId).get();
            if (matchSnap.exists) match = matchSnap.data() || {};
        } catch (err) {
            console.warn('[onBuddyDmSafety] match', err && err.message ? err.message : err);
        }
        const detection = detectBuddyRisk(text, { senderGoal: senderGoalOf(match, sender) });
        if (detection.severity === 'none') return null;
        const other = otherOf(match, sender);
        try {
            await db.runTransaction(function (tx) {
                return stageReview(tx, {
                    sender: sender,
                    other: other,
                    convoId: convoId,
                    severity: detection.severity,
                    reasons: detection.reasons,
                    now: Date.now(),
                    snippet: text,
                    messageId: messageId,
                    reportedName: message.senderName || '',
                });
            });
        } catch (err) {
            console.warn('[onBuddyDmSafety]', err && err.message ? err.message : err);
        }
        return null;
    }

    async function recordReportQuota(reporter, reported) {
        const ref = db.collection('buddy_report_quota').doc(reporter);
        const now = Date.now();
        const day = new Date(now).toISOString().slice(0, 10);
        await db.runTransaction(async function (tx) {
            const snap = await tx.get(ref);
            const data = snap.exists ? (snap.data() || {}) : {};
            const sameDay = data.day === day;
            const targets = sameDay && data.targets && typeof data.targets === 'object' ? Object.assign({}, data.targets) : {};
            targets[reported] = now;
            tx.set(ref, {
                day: day,
                count: sameDay ? (Number(data.count) || 0) + 1 : 1,
                targets: targets,
            });
        });
    }

    async function onBuddyReport(event) {
        const snap = event && event.data;
        if (!snap) return null;
        const report = snap.data() || {};
        if (!isBuddyUserReport(report)) return null;
        const reporter = String(report.reporterUid || '');
        const reported = String(report.reportedUid || '');
        if (!UID_RE.test(reported) || !UID_RE.test(reporter) || reporter === reported) return null;
        try {
            await recordReportQuota(reporter, reported);
        } catch (err) {
            console.warn('[onBuddyReport] quota', err && err.message ? err.message : err);
        }
        const convoId = reporter < reported ? reporter + '_' + reported : reported + '_' + reporter;
        let decision = { lock: false };
        try {
            const convoSnap = await db.collection('dm_conversations').doc(convoId).get();
            if (!convoSnap.exists) return null;
            const participants = (convoSnap.data() || {}).participants || [];
            const found = await db.collection('buddy_flags').where('convoId', '==', convoId).limit(40).get();
            const flags = (found.docs || []).map(function (doc) { return doc.data() || {}; });
            const lockSnap = await db.collection('buddy_locks').doc(reported).get();
            const unlockedAt = lockSnap.exists ? Number((lockSnap.data() || {}).unlockedAt) || 0 : 0;
            decision = planUserReportLock(report, flags, { id: convoId, participants: participants, unlockedAt: unlockedAt });
        } catch (err) {
            console.warn('[onBuddyReport] query', err && err.message ? err.message : err);
            return null;
        }
        if (!decision.lock) return null;
        try {
            await db.runTransaction(function (tx) {
                return stageReview(tx, {
                    sender: reported,
                    other: reporter,
                    convoId: decision.convoId,
                    severity: 'high',
                    reasons: [],
                    now: Date.now(),
                    snippet: '',
                    clientReportId: snap.id || '',
                    reportedName: report.reportedName || '',
                });
            });
        } catch (err) {
            console.warn('[onBuddyReport]', err && err.message ? err.message : err);
        }
        return null;
    }

    async function adminResolveLock(data, context) {
        if (!context || !context.auth || !context.auth.uid) {
            throw new HttpsError('unauthenticated', 'Sign in required.');
        }
        if (!context.auth.token || context.auth.token.admin !== true) {
            throw new HttpsError('permission-denied', 'Admin only.');
        }
        const uid = String((data && data.uid) || '');
        if (!UID_RE.test(uid)) throw new HttpsError('invalid-argument', 'That account id is not valid.');
        const plan = planAdminResolve(data && data.action);
        if (plan.error) throw new HttpsError('invalid-argument', 'Choose unlock, keep locked, ban, or unlock and dismiss.');
        const userRef = db.collection('users').doc(uid);
        const logRef = db.collection('buddy_lock_actions').doc();
        await db.runTransaction(async function (tx) {
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists) {
                throw new HttpsError('not-found', 'That account was not found.');
            }
            const metaRef = db.collection('buddy_locks').doc(uid);
            const metaSnap = await tx.get(metaRef);
            const meta = metaSnap.exists ? (metaSnap.data() || {}) : {};
            const convId = typeof meta.convId === 'string' ? meta.convId : '';
            const reportIds = []
                .concat(Array.isArray(meta.reportIds) ? meta.reportIds : [])
                .concat(meta.clientReportId ? [meta.clientReportId] : []);
            const reportSnaps = [];
            const flagSnaps = [];
            for (let i = 0; i < reportIds.length && i < 20; i++) {
                const id = reportIds[i];
                if (typeof id !== 'string' || !id || id.indexOf('/') !== -1) continue;
                reportSnaps.push(await tx.get(db.collection('reports').doc(id)));
                flagSnaps.push(await tx.get(db.collection('buddy_flags').doc(id)));
            }
            let convoFlags = [];
            if (convId && convId.indexOf('/') === -1) {
                const found = await tx.get(db.collection('buddy_flags').where('convoId', '==', convId).limit(40));
                found.forEach(function (doc) { convoFlags.push(doc); });
            }
            const ts = admin.firestore.FieldValue.serverTimestamp();
            const now = Date.now();
            const flagStatus = plan.reportStatus === 'dismissed' ? 'dismissed' : 'resolved';
            if (plan.clearLock) {
                tx.set(userRef, { lock: admin.firestore.FieldValue.delete() }, { merge: true });
            }
            if (plan.resumeChat && convId && convId.indexOf('/') === -1) {
                tx.set(db.collection('dm_conversations').doc(convId), { reviewPaused: false }, { merge: true });
            }
            if (plan.ban) {
                const reason = String(meta.reason || 'buddy review').slice(0, 200);
                tx.set(userRef, {
                    withdrawals_disabled: true,
                    satsDisabled: true,
                    flagged: true,
                    ban_reason: reason,
                }, { merge: true });
                tx.set(db.collection('faucet_ledger').doc(uid), {
                    banned: true,
                    ban_reason: reason,
                    bannedAt: ts,
                }, { merge: true });
            }
            reportSnaps.forEach(function (snap) {
                if (!snap.exists) return;
                tx.set(snap.ref, { status: plan.reportStatus }, { merge: true });
            });
            flagSnaps.forEach(function (snap) {
                if (!snap.exists) return;
                tx.set(snap.ref, { status: flagStatus }, { merge: true });
            });
            convoFlags.forEach(function (doc) {
                const row = doc.data() || {};
                if (row.reportedUid !== uid) return;
                tx.set(doc.ref, { status: flagStatus }, { merge: true });
            });
            if (metaSnap.exists) {
                tx.set(metaRef, {
                    state: plan.clearLock ? 'unlocked' : meta.state || 'locked',
                    unlockedAt: plan.clearLock ? now : (meta.unlockedAt || 0),
                    status: flagStatus,
                }, { merge: true });
            }
            tx.set(logRef, {
                uid: uid,
                action: data.action,
                adminUid: context.auth.uid,
                convId: convId,
                reportStatus: plan.reportStatus,
                at: ts,
            });
        });
        return { ok: true, action: data.action, uid: uid };
    }

    return {
        onBuddyDmSafety: onBuddyDmSafety,
        onBuddyReport: onBuddyReport,
        adminResolveLock: adminResolveLock,
    };
}

module.exports = {
    HIGH_REASONS: HIGH_REASONS,
    MEDIUM_REASONS: MEDIUM_REASONS,
    ADMIN_ACTIONS: ADMIN_ACTIONS,
    WARNING_HIGH: WARNING_HIGH,
    WARNING_LOW: WARNING_LOW,
    detectBuddyRisk: detectBuddyRisk,
    snippetOf: snippetOf,
    shortUid: shortUid,
    hourBucket: hourBucket,
    flagDocId: flagDocId,
    warningCopy: warningCopy,
    warningDocId: warningDocId,
    buildBuddyReport: buildBuddyReport,
    publicLock: publicLock,
    randomDocId: randomDocId,
    flagCountsForLock: flagCountsForLock,
    accountLocked: accountLocked,
    alreadyLockedFor: alreadyLockedFor,
    planAdminResolve: planAdminResolve,
    isBuddyUserReport: isBuddyUserReport,
    planUserReportLock: planUserReportLock,
    knownHost: knownHost,
    createSafetyHandlers: createSafetyHandlers,
    senderGoalOf: senderGoalOf,
};
