'use strict';

// Titles and chat flair. The server decides what a player has earned and
// writes activeTitle, chatFlairEmoji, earnedTitles and earnedFlair. Clients
// cannot write those fields (firestore.rules). See tests/test-title-flair.js.

const TITLE_DEFS = require('./title-defs.json');
const collectionBonus = require('./collectionBonus');

// Nook "Chat Flair" item (ownedCosmetics: chat_flair) unlocks these.
const NOOK_FLAIR = ['🔥', '⚡', '🦌', '🧡', '💎', '👑', '🎯', '⛏️', '🟠'];
// Time-limited title written by the BIP Breakthrough flow (PR #238).
const CORE_CONTRIBUTOR = { id: 'core_contributor', title: 'Core Contributor', emoji: '🔧', flavor: 'Merged this week\'s BIP after 7 daily spins. Bit Devs energy.' };

function toMs(v) {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v instanceof Date) return v.getTime();
    if (typeof v._seconds === 'number') return v._seconds * 1000;
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    return 0;
}

function collectionTitleRows() {
    return collectionBonus.collections().filter(function (col) { return col.title && col.title.id; });
}

// Every title the server knows: badge titles, collection titles, core contributor.
function titleCatalog() {
    const out = {};
    TITLE_DEFS.forEach(function (t) { out[t.id] = { id: t.id, title: t.title, emoji: t.emoji, source: 'badge', requiredBadge: t.requiredBadge }; });
    collectionTitleRows().forEach(function (col) {
        out[col.title.id] = { id: col.title.id, title: col.title.title, emoji: col.title.emoji, source: 'collection', collectionId: col.id, bonusId: col.bonusId };
    });
    out[CORE_CONTRIBUTOR.id] = Object.assign({ source: 'bip' }, CORE_CONTRIBUTOR);
    return out;
}

function flairCatalog() {
    const set = new Set(NOOK_FLAIR);
    collectionTitleRows().forEach(function (col) { if (col.flair) set.add(col.flair); });
    return set;
}

function stringList(v, max) {
    return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string' && x.length > 0 && x.length <= (max || 64); }) : [];
}

// held: Set of server-held badge ids (collectionBonus.collectionHeldIds).
function earnedFor(user, held, nowMs) {
    const u = user || {};
    const titles = [];
    const flair = [];
    const catalog = titleCatalog();
    function addTitle(id) { if (catalog[id] && titles.indexOf(id) < 0) titles.push(id); }
    function addFlair(e) { if (e && flair.indexOf(e) < 0) flair.push(e); }
    TITLE_DEFS.forEach(function (t) { if (t.requiredBadge && held.has(t.requiredBadge)) addTitle(t.id); });
    collectionTitleRows().forEach(function (col) {
        if (held.has(col.bonusId)) { addTitle(col.title.id); addFlair(col.flair); }
    });
    if (toMs(u.coreContributorUntil) > (Number(nowMs) || Date.now())) addTitle(CORE_CONTRIBUTOR.id);
    // Grandfathered by the migration: kept as long as the id is still a real title.
    stringList(u.grandfatheredTitles).forEach(addTitle);
    const owned = stringList(u.ownedCosmetics);
    if (owned.indexOf('chat_flair') >= 0) NOOK_FLAIR.forEach(addFlair);
    const allFlair = flairCatalog();
    stringList(u.grandfatheredFlair, 16).forEach(function (e) { if (allFlair.has(e)) addFlair(e); });
    return { titles: titles, flair: flair };
}

// Pure check for equip. title/flair: string id, null to unequip, undefined to leave.
function planEquip(earned, req) {
    const r = req || {};
    const patch = {};
    if (r.title !== undefined) {
        if (r.title === null || r.title === '') patch.activeTitle = null;
        else if (typeof r.title === 'string' && earned.titles.indexOf(r.title) >= 0) patch.activeTitle = r.title;
        else return { ok: false, reason: 'title-not-earned' };
    }
    if (r.flair !== undefined) {
        if (r.flair === null || r.flair === '') patch.chatFlairEmoji = null;
        else if (typeof r.flair === 'string' && earned.flair.indexOf(r.flair) >= 0) patch.chatFlairEmoji = r.flair;
        else return { ok: false, reason: 'flair-not-earned' };
    }
    return { ok: true, patch: patch };
}

async function loadEarned(db, uid, nowMs) {
    const userRef = db.collection('users').doc(uid);
    const [userSnap, awardsSnap] = await Promise.all([userRef.get(), userRef.collection('badge_awards').get()]);
    const user = userSnap.exists ? (userSnap.data() || {}) : {};
    const rows = {};
    awardsSnap.forEach(function (d) { rows[d.id] = d.data() || {}; });
    const held = collectionBonus.collectionHeldIds(user, rows);
    return { user: user, userRef: userRef, earned: earnedFor(user, held, nowMs) };
}

function sameList(a, b) {
    const x = stringList(a).slice().sort();
    const y = (b || []).slice().sort();
    return x.length === y.length && x.every(function (v, i) { return v === y[i]; });
}

// Callable body. action: 'list' (default) or 'equip'.
async function handle(db, adminSdk, uid, data, nowMs) {
    const action = data && data.action === 'equip' ? 'equip' : 'list';
    const loaded = await loadEarned(db, uid, nowMs);
    const earned = loaded.earned;
    const user = loaded.user;
    const del = adminSdk.firestore.FieldValue.delete();
    const patch = {};
    if (!sameList(user.earnedTitles, earned.titles)) patch.earnedTitles = earned.titles;
    if (!sameList(user.earnedFlair, earned.flair)) patch.earnedFlair = earned.flair;
    let active = typeof user.activeTitle === 'string' ? user.activeTitle : null;
    let flair = typeof user.chatFlairEmoji === 'string' ? user.chatFlairEmoji : null;
    if (action === 'equip') {
        const plan = planEquip(earned, { title: data.title, flair: data.flair });
        if (!plan.ok) return { ok: false, reason: plan.reason, titles: earned.titles, flair: earned.flair, activeTitle: active, chatFlairEmoji: flair };
        if ('activeTitle' in plan.patch) { active = plan.patch.activeTitle; patch.activeTitle = active === null ? del : active; }
        if ('chatFlairEmoji' in plan.patch) { flair = plan.patch.chatFlairEmoji; patch.chatFlairEmoji = flair === null ? del : flair; }
    } else {
        // A title or flair that is no longer earned (an expired Core Contributor) comes off.
        if (active && earned.titles.indexOf(active) < 0) { active = null; patch.activeTitle = del; }
        if (flair && earned.flair.indexOf(flair) < 0) { flair = null; patch.chatFlairEmoji = del; }
    }
    if (Object.keys(patch).length) await loaded.userRef.set(patch, { merge: true });
    return { ok: true, titles: earned.titles, flair: earned.flair, activeTitle: active, chatFlairEmoji: flair };
}

module.exports = {
    NOOK_FLAIR: NOOK_FLAIR,
    CORE_CONTRIBUTOR: CORE_CONTRIBUTOR,
    titleCatalog: titleCatalog,
    flairCatalog: flairCatalog,
    earnedFor: earnedFor,
    planEquip: planEquip,
    handle: handle,
    toMs: toMs,
};
