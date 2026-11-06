'use strict';

// Collection-completion recognition. The first grant of a collection bonus
// queues one item per player. Items that land inside one minute share a
// single Nacho line in Global Chat and one GGs announcement. The chat write
// is writeNachoGlobalPost (the same helper publishShoutoutOnce uses). The
// GGs write is writeAnnouncement (the badge burst writer). A banned, deleted,
// or test account is not posted. A failed post leaves the burst open so the
// minutely flush can retry it. The bonus grant itself is already committed.

const { BURST_WINDOW_MS, writeAnnouncement } = require('./badgeGg');
const { writeNachoGlobalPost } = require('./shoutoutPublish');

const RECOGNITION_WINDOW_MS = BURST_WINDOW_MS;
const BURSTS = 'collection_recog_bursts';
const CLAIMS = 'collection_recog_claims';
const NEUTRAL_NAME = 'A Bitcoiner';

function safeId(raw) {
    return String(raw || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
}

function cleanCollectionName(raw) {
    const name = String(raw || 'collection').replace(/[\r\n<>@]/g, ' ').replace(/\s+/g, ' ').trim();
    return name || 'collection';
}

function recognitionChatId(uid, startedAtMs) {
    return 'colrecog_' + safeId(uid) + '_' + Number(startedAtMs);
}

function recognitionAnnouncementId(uid, startedAtMs) {
    return 'colgg_' + safeId(uid) + '_' + Number(startedAtMs);
}

function claimDocId(uid, bonusId) {
    return safeId(uid) + '__' + safeId(bonusId);
}

// Banned, deleted, and test accounts are not congratulated. A missing user
// doc is treated as deleted. Profile "[deleted]" is the same.
function recognitionSkip(user, ledger, profile) {
    if (!user) return 'deleted';
    if (user.deleted === true || user.accountDeleted === true || user.status === 'deleted') return 'deleted';
    if (user.username === '[deleted]') return 'deleted';
    if (user.banned === true || user.ban_reason) return 'banned';
    if (ledger && ledger.banned === true) return 'banned';
    if (user.isTest === true || user.isBot === true || user.accountType === 'test') return 'test';
    if (profile && (profile.deleted === true || profile.username === '[deleted]')) return 'deleted';
    return '';
}

function mentionName(profile, user) {
    const mentionUsername = require('./collectionBonus').mentionUsername;
    return mentionUsername(profile) || mentionUsername(user) || '';
}

function joinCollectionNames(names) {
    if (names.length === 2) return 'the ' + names[0] + ' and ' + names[1] + ' collections';
    return 'the ' + names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1] + ' collections';
}

function recognitionText(username, names) {
    const clean = [];
    (names || []).forEach(function (name) {
        const next = cleanCollectionName(name);
        if (next && clean.indexOf(next) === -1) clean.push(next);
    });
    const list = clean.length ? clean : ['collection'];
    if (list.length === 1) {
        return require('./collectionBonus').collectionCongratsText(username, list[0]);
    }
    const who = username ? ('@' + username) : NEUTRAL_NAME;
    return '🎉 ' + who + ' completed ' + joinCollectionNames(list) + '! The whole set is yours. Congratulations!';
}

function burstFields(burst) {
    return {
        uid: burst.uid,
        startedAtMs: burst.startedAtMs,
        flushAfterMs: burst.flushAfterMs,
        items: burst.items || [],
    };
}

function clearPending(t, db, burst) {
    const uid = burst && burst.uid;
    (burst && burst.items || []).forEach(function (item) {
        if (!uid || !item || !item.bonusId) return;
        const awardRef = db.collection('users').doc(uid).collection('badge_awards').doc(item.bonusId);
        t.set(awardRef, { congratsPending: false }, { merge: true });
    });
}

async function stageRecognitionPosts(t, db, adminSdk, burst, username) {
    const names = (burst.items || []).map(function (item) { return item && item.name; });
    const text = recognitionText(username, names).slice(0, 500);
    const docId = recognitionChatId(burst.uid, burst.startedAtMs);
    const annId = recognitionAnnouncementId(burst.uid, burst.startedAtMs);
    const chatSnap = await t.get(db.collection('global_chat').doc(docId));
    const annSnap = await t.get(db.collection('announcements').doc(annId));
    const serverTimestamp = function () { return adminSdk.firestore.FieldValue.serverTimestamp(); };
    const mentionUid = username ? burst.uid : '';
    let wroteChat = false;
    if (!chatSnap.exists) {
        writeNachoGlobalPost(t, db, {
            authorUid: 'nacho-bot',
            authorName: '🦌 Nacho',
            text: text,
            isNachoAuto: false,
            mentionUid: mentionUid,
            docId: docId,
            collection: 'global_chat',
        }, serverTimestamp);
        wroteChat = true;
    }
    writeAnnouncement(t, db, adminSdk, {
        annId: annId,
        text: text,
        mentionUid: mentionUid,
        postedByUid: 'collection-gg',
        ggKind: 'earned',
        existingSnap: annSnap,
    });
    clearPending(t, db, burst);
    return { wroteChat: wroteChat, text: text, docId: docId, annId: annId, mentionUid: mentionUid };
}

async function postRecognitionBurst(db, adminSdk, burstId, nowMs) {
    const burstRef = db.collection(BURSTS).doc(burstId);
    const at = Number(nowMs) || Date.now();
    return db.runTransaction(async function (t) {
        const burstSnap = await t.get(burstRef);
        if (!burstSnap || !burstSnap.exists) return { posted: false, reason: 'missing' };
        const burst = burstSnap.data() || {};
        if (burst.posted === true) return { posted: false, reason: 'posted' };
        if ((Number(burst.flushAfterMs) || 0) > at) return { posted: false, reason: 'wait' };
        if (!burst.items || !burst.items.length || !burst.uid) return { posted: false, reason: 'empty' };
        const userSnap = await t.get(db.collection('users').doc(burst.uid));
        const profileSnap = await t.get(db.collection('public_profiles').doc(burst.uid));
        const ledgerSnap = await t.get(db.collection('faucet_ledger').doc(burst.uid));
        const user = userSnap && userSnap.exists ? (userSnap.data() || {}) : null;
        const profile = profileSnap && profileSnap.exists ? (profileSnap.data() || {}) : null;
        const ledger = ledgerSnap && ledgerSnap.exists ? (ledgerSnap.data() || {}) : null;
        const skip = recognitionSkip(user, ledger, profile);
        if (skip) {
            clearPending(t, db, burst);
            t.set(burstRef, Object.assign(burstFields(burst), { posted: true, skipped: skip }));
            return { posted: false, reason: skip };
        }
        const written = await stageRecognitionPosts(t, db, adminSdk, burst, mentionName(profile, user));
        t.set(burstRef, Object.assign(burstFields(burst), {
            posted: true,
            announcementId: written.annId,
            chatId: written.docId,
        }));
        return {
            posted: written.wroteChat,
            reason: written.wroteChat ? 'ok' : 'already_posted',
            text: written.text,
            mentionUid: written.mentionUid,
            docId: written.docId,
            annId: written.annId,
        };
    });
}

async function pushMention(outcome) {
    if (!outcome || !outcome.posted || !outcome.mentionUid) return;
    try {
        const push = require('./push');
        await push.sendUserPush(outcome.mentionUid, 'mentions', {
            title: 'You were mentioned',
            body: '🦌 Nacho mentioned you in chat.',
            url: 'https://bitcoineducation.quest/#chat',
        });
    } catch (err) {
        console.warn('[collectionRecognition] mention push failed', err && err.message ? err.message : err);
    }
}

async function flushOne(db, adminSdk, burstId, nowMs) {
    let outcome;
    try {
        const host = require('./collectionBonus');
        const poster = host.postRecognitionBurst || postRecognitionBurst;
        outcome = await poster(db, adminSdk, burstId, nowMs);
    } catch (err) {
        console.error('[collectionRecognition] post failed', err && err.message ? err.message : err);
        return { posted: false, reason: 'error' };
    }
    await pushMention(outcome);
    return outcome || { posted: false, reason: 'empty' };
}

function snapDocs(snap) {
    const ids = [];
    const visit = function (doc) {
        const data = doc && doc.data ? (doc.data() || {}) : {};
        if (data.posted === true) return;
        ids.push(doc.id);
    };
    if (snap && typeof snap.forEach === 'function') snap.forEach(visit);
    else if (snap && snap.docs) snap.docs.forEach(visit);
    return ids;
}

async function flushDueRecognitions(db, adminSdk, nowMs) {
    const at = Number(nowMs) || Date.now();
    if (!db || typeof db.collection !== 'function') return [];
    let query = db.collection(BURSTS);
    if (typeof query.where === 'function') query = query.where('posted', '==', false);
    if (!query || typeof query.get !== 'function') return [];
    const snap = await query.get();
    const ids = [];
    snapDocs(snap).forEach(function (id) { ids.push(id); });
    // snapDocs already dropped posted bursts. Also drop ones still inside
    // the window when the query could not filter them.
    const due = [];
    for (let i = 0; i < ids.length; i++) {
        due.push(await flushOne(db, adminSdk, ids[i], at));
    }
    return due.filter(function (row) { return row && row.reason !== 'wait'; });
}

function recognitionItem(col) {
    return {
        bonusId: col.bonusId,
        collectionId: col.id,
        name: cleanCollectionName(col.name),
    };
}

async function enqueueRecognition(db, adminSdk, uid, col, nowMs) {
    const at = Number(nowMs) || Date.now();
    const safeUid = safeId(uid);
    if (!db || !adminSdk || !safeUid || !col || !col.bonusId) return { queued: false, reason: 'bad_plan' };
    const burstRef = db.collection(BURSTS).doc(safeUid);
    const claimRef = db.collection(CLAIMS).doc(claimDocId(uid, col.bonusId));
    const awardRef = db.collection('users').doc(uid).collection('badge_awards').doc(col.bonusId);
    let pre = null;
    try {
        const preSnap = await burstRef.get();
        pre = preSnap && preSnap.exists ? (preSnap.data() || {}) : null;
    } catch (err) {
        pre = null;
    }
    let flushed = null;
    if (pre && pre.posted !== true && pre.startedAtMs && at > pre.startedAtMs + RECOGNITION_WINDOW_MS && pre.items && pre.items.length) {
        flushed = await flushOne(db, adminSdk, safeUid, at);
    }
    const queued = await db.runTransaction(async function (t) {
        const claimSnap = await t.get(claimRef);
        const burstSnap = await t.get(burstRef);
        const userSnap = await t.get(db.collection('users').doc(uid));
        const profileSnap = await t.get(db.collection('public_profiles').doc(uid));
        const ledgerSnap = await t.get(db.collection('faucet_ledger').doc(uid));
        const user = userSnap && userSnap.exists ? (userSnap.data() || {}) : null;
        const profile = profileSnap && profileSnap.exists ? (profileSnap.data() || {}) : null;
        const ledger = ledgerSnap && ledgerSnap.exists ? (ledgerSnap.data() || {}) : null;
        const skip = recognitionSkip(user, ledger, profile);
        const claim = claimSnap && claimSnap.exists ? (claimSnap.data() || {}) : null;
        if (skip) {
            if (!claim) t.set(claimRef, { uid: uid, bonusId: col.bonusId, at: at, skipped: skip });
            t.set(awardRef, { congratsPending: false }, { merge: true });
            return { queued: false, reason: skip, settled: true };
        }
        if (claim) {
            if (claim.skipped) {
                t.set(awardRef, { congratsPending: false }, { merge: true });
                return { queued: false, reason: claim.skipped, settled: true };
            }
            const burst = burstSnap && burstSnap.exists ? (burstSnap.data() || {}) : null;
            if (burst && burst.posted === true) {
                t.set(awardRef, { congratsPending: false }, { merge: true });
                return { queued: false, reason: 'already_posted', settled: true };
            }
            return { queued: false, reason: 'claimed' };
        }
        const item = recognitionItem(col);
        const burst = burstSnap && burstSnap.exists ? (burstSnap.data() || {}) : null;
        const open = burst && burst.posted !== true && burst.startedAtMs && at <= burst.startedAtMs + RECOGNITION_WINDOW_MS;
        const keep = burst && burst.posted !== true && burst.items && burst.items.length;
        if (open || keep) {
            const items = Array.isArray(burst.items) ? burst.items.slice() : [];
            if (!items.some(function (row) { return row && row.bonusId === item.bonusId; })) items.push(item);
            t.set(claimRef, { uid: uid, bonusId: col.bonusId, at: at });
            t.set(burstRef, {
                uid: burst.uid || uid,
                startedAtMs: burst.startedAtMs,
                flushAfterMs: burst.flushAfterMs || (burst.startedAtMs + RECOGNITION_WINDOW_MS),
                posted: false,
                items: items,
            });
            return { queued: true, joined: true };
        }
        t.set(claimRef, { uid: uid, bonusId: col.bonusId, at: at });
        t.set(burstRef, {
            uid: uid,
            startedAtMs: at,
            flushAfterMs: at + RECOGNITION_WINDOW_MS,
            posted: false,
            items: [item],
        });
        return { queued: true, started: true };
    });
    if (flushed) queued.flushed = flushed;
    return queued;
}

module.exports = {
    RECOGNITION_WINDOW_MS: RECOGNITION_WINDOW_MS,
    recognitionSkip: recognitionSkip,
    recognitionText: recognitionText,
    recognitionChatId: recognitionChatId,
    recognitionAnnouncementId: recognitionAnnouncementId,
    postRecognitionBurst: postRecognitionBurst,
    enqueueRecognition: enqueueRecognition,
    flushDueRecognitions: flushDueRecognitions,
};
